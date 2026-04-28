#!/usr/bin/env python3
"""
analyze_users.py — PhantomSDR-Plus user statistics from daily JSONL logs.

Usage:
    python3 analyze_users.py                        # today's log
    python3 analyze_users.py 2024-11-15             # specific date
    python3 analyze_users.py 2024-11-01 2024-11-30  # date range
    python3 analyze_users.py --all                  # all available logs

Log files are read from:  <script_dir>/logs/users_YYYY-MM-DD.jsonl
"""

import json
import sys
import os
import glob
from datetime import datetime, timedelta, timezone
from collections import defaultdict, Counter

LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")


# ── helpers ──────────────────────────────────────────────────────────────────

def load_log(path):
    events = []
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"  [WARN] {path}:{lineno} — {e}", file=sys.stderr)
    return events


def load_range(start_date, end_date):
    events = []
    cur = start_date
    while cur <= end_date:
        path = os.path.join(LOG_DIR, f"users_{cur.strftime('%Y-%m-%d')}.jsonl")
        if os.path.exists(path):
            events.extend(load_log(path))
        cur += timedelta(days=1)
    return events


def parse_ts(ts_str):
    return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))


def fmt_dur(seconds):
    h, r = divmod(int(seconds), 3600)
    m, s = divmod(r, 60)
    if h:
        return f"{h}h {m:02d}m {s:02d}s"
    if m:
        return f"{m}m {s:02d}s"
    return f"{s}s"


def band(freq_khz):
    if freq_khz <= 0:       return "?"
    if freq_khz < 300:      return "VLF/LF"
    if freq_khz < 3000:     return "MW"
    if freq_khz < 4000:     return "80m"
    if freq_khz < 5500:     return "60m"
    if freq_khz < 8000:     return "40m"
    if freq_khz < 11000:    return "30m"
    if freq_khz < 15000:    return "20m"
    if freq_khz < 19000:    return "17m"
    if freq_khz < 22000:    return "15m"
    if freq_khz < 25000:    return "12m"
    if freq_khz < 30000:    return "10m"
    return "6m+"


# ── analysis ─────────────────────────────────────────────────────────────────

def analyze(events):
    if not events:
        print("No events found.")
        return

    # ── Best-geo pre-pass ────────────────────────────────────────────────────
    # The first tune event fires before the async geo lookup finishes (~1-3 s)
    # so its geo field is just the raw IP.  Collect the first real geo seen per
    # uid across ALL events so we can back-fill sessions below.
    def is_real_geo(geo, ip):
        return geo and geo != ip and not geo.startswith(('::ffff:', '::')) \
               and not geo[0].isdigit() and geo != '?'

    best_geo = {}
    for ev in events:
        uid = ev.get("id")
        geo = ev.get("geo", "")
        ip  = ev.get("ip",  "")
        if uid and uid not in best_geo and is_real_geo(geo, ip):
            best_geo[uid] = geo

    # ── Pair connects with disconnects to compute session durations ──────────
    sessions = {}   # unique_id → {connect_ts, last_freq, last_mode, geo, ip}
    completed = []  # list of completed session dicts

    for ev in sorted(events, key=lambda e: e["ts"]):
        uid   = ev["id"]
        event = ev["event"]

        if event == "tune":
            if uid not in sessions:
                # First tune event = effective connect
                sessions[uid] = {
                    "start":    parse_ts(ev["ts"]),
                    "freq_khz": ev.get("freq_khz", 0),
                    "mode":     ev.get("mode", "?"),
                    "geo":      best_geo.get(uid) or ev.get("geo", "?"),
                    "ip":       ev.get("ip", "?"),
                }
            else:
                sessions[uid]["freq_khz"] = ev.get("freq_khz", sessions[uid]["freq_khz"])
                sessions[uid]["mode"]     = ev.get("mode", sessions[uid]["mode"])
                # Upgrade geo if this event has a real location
                g = ev.get("geo", "")
                if is_real_geo(g, ev.get("ip", "")):
                    sessions[uid]["geo"] = g

        elif event == "disconnect":
            # duration_s is unreliable (always 0) because the client is erased
            # from signal_slices before broadcast_signal_changes fires.
            # Compute duration from timestamps instead.
            if uid in sessions:
                s = sessions.pop(uid)
                dur = round((parse_ts(ev["ts"]) - s["start"]).total_seconds())
            else:
                raw_dur = ev.get("duration_s", 0)
                dur = raw_dur  # last resort
                s = {
                    "start":    parse_ts(ev["ts"]) - timedelta(seconds=dur),
                    "freq_khz": ev.get("freq_khz", 0),
                    "mode":     ev.get("mode", "?"),
                    "geo":      best_geo.get(uid) or ev.get("geo", "?"),
                    "ip":       ev.get("ip", "?"),
                }
            geo = best_geo.get(uid) or s["geo"]
            completed.append({
                "geo":      geo,
                "ip":       s["ip"],
                "freq_khz": s["freq_khz"],
                "mode":     s["mode"],
                "duration": max(0, dur),
                "hour":     s["start"].astimezone(timezone.utc).hour,
            })

    # sessions still open at log end — compute elapsed time from start to now
    now_utc = datetime.now(timezone.utc)
    for uid, s in sessions.items():
        elapsed = max(0, round((now_utc - s["start"]).total_seconds()))
        completed.append({
            "geo":      best_geo.get(uid) or s["geo"],
            "ip":       s["ip"],
            "freq_khz": s["freq_khz"],
            "mode":     s["mode"],
            "duration": elapsed,
            "hour":     s["start"].astimezone(timezone.utc).hour,
        })

    total_sessions = len(completed)
    total_seconds  = sum(c["duration"] for c in completed)

    # ── unique visitors ───────────────────────────────────────────────────────
    unique_ips  = {ev["ip"]  for ev in events if ev.get("ip") and not ev["ip"].startswith("::ffff:")}
    unique_geos = {ev["geo"] for ev in events if is_real_geo(ev.get("geo",""), ev.get("ip",""))}

    # ── top countries / cities ────────────────────────────────────────────────
    geo_counter = Counter(c["geo"] for c in completed if is_real_geo(c["geo"], c["ip"]))

    # ── top frequencies ───────────────────────────────────────────────────────
    freq_counter = Counter(
        round(c["freq_khz"] / 5) * 5   # bucket to nearest 5 kHz
        for c in completed if c["freq_khz"] > 0
    )

    # ── band popularity ───────────────────────────────────────────────────────
    band_counter = Counter(band(c["freq_khz"]) for c in completed)

    # ── mode popularity ───────────────────────────────────────────────────────
    mode_counter = Counter(c["mode"] for c in completed)

    # ── hourly distribution (UTC) ────────────────────────────────────────────
    hour_counter = Counter(c["hour"] for c in completed)

    # ── average session duration ──────────────────────────────────────────────
    durations    = [c["duration"] for c in completed if c["duration"] > 0]
    avg_duration = sum(durations) / len(durations) if durations else 0
    max_duration = max(durations) if durations else 0

    # ── print report ─────────────────────────────────────────────────────────
    SEP = "─" * 56

    print(f"\n{'═'*56}")
    print(f"  PhantomSDR-Plus  ·  User Statistics Report")
    print(f"{'═'*56}")

    print(f"\n  Total events logged : {len(events)}")
    print(f"  Completed sessions  : {total_sessions}")
    print(f"  Unique IPs          : {len(unique_ips)}")
    print(f"  Unique locations    : {len(unique_geos)}")
    print(f"  Total airtime       : {fmt_dur(total_seconds)}")
    print(f"  Avg session         : {fmt_dur(avg_duration)}")
    print(f"  Longest session     : {fmt_dur(max_duration)}")

    print(f"\n{SEP}")
    print("  TOP LOCATIONS")
    print(SEP)
    for loc, cnt in geo_counter.most_common(10):
        bar = "█" * min(cnt, 30)
        print(f"  {loc:<28}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  BAND POPULARITY")
    print(SEP)
    for b, cnt in band_counter.most_common():
        bar = "█" * min(cnt, 30)
        print(f"  {b:<10}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  MODE POPULARITY")
    print(SEP)
    for mode, cnt in mode_counter.most_common():
        bar = "█" * min(cnt, 30)
        print(f"  {mode.upper():<8}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  TOP FREQUENCIES  (bucketed ±5 kHz)")
    print(SEP)
    for freq_k, cnt in freq_counter.most_common(10):
        label = f"{freq_k/1000:.3f} MHz" if freq_k >= 1000 else f"{freq_k} kHz"
        bar   = "█" * min(cnt, 30)
        print(f"  {label:<14}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  HOURLY DISTRIBUTION  (UTC)")
    print(SEP)
    for hour in range(24):
        cnt = hour_counter.get(hour, 0)
        bar = "█" * min(cnt, 30)
        print(f"  {hour:02d}:00  {cnt:>4}  {bar}")

    print(f"\n{'═'*56}\n")


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    today = datetime.now(timezone.utc).date()

    if not args:
        start = end = today
    elif args[0] == "--all":
        files = sorted(glob.glob(os.path.join(LOG_DIR, "users_*.jsonl")))
        if not files:
            print("No log files found in", LOG_DIR)
            return
        start = datetime.strptime(os.path.basename(files[0]),  "users_%Y-%m-%d.jsonl").date()
        end   = datetime.strptime(os.path.basename(files[-1]), "users_%Y-%m-%d.jsonl").date()
    elif len(args) == 1:
        start = end = datetime.strptime(args[0], "%Y-%m-%d").date()
    elif len(args) == 2:
        start = datetime.strptime(args[0], "%Y-%m-%d").date()
        end   = datetime.strptime(args[1], "%Y-%m-%d").date()
    else:
        print(__doc__)
        sys.exit(1)

    print(f"  Loading logs from {start} to {end} …")
    events = load_range(start, end)
    analyze(events)


if __name__ == "__main__":
    main()
