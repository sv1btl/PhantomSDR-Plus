"""
ASN / ISP bans — shared by proxy.py (refuses at connect time) and
admin_server.py (rules, Users list, the sweep that kicks listeners already
connected).

Two files next to this one, neither distributed:

  asn-db/ip2asn-combined.tsv.gz   the free IP-to-ASN table from iptoasn.com
                                  (public domain, rebuilt hourly upstream;
                                  the admin panel fetches it once a week).
                                  Lines: start  end  asn  country  name
  asn_bans.json                   the sysop's rules:
                                  {"rules": [{"id", "kind", "value", "note", "added"}]}
                                  kind "asn" → value is the AS number (int)
                                  kind "isp" → value is text, matched without
                                               regard to case inside the
                                               network's name in the table

The lookup is local on purpose. ip-api.com allows 45 lookups a minute, and a
ban that waits on an outside service cannot refuse anyone at connect time.
Without the table nothing is refused: a missing or broken download must never
lock the listeners out.

A ban lasts until the sysop removes it (the sysop's ruling, 2026-11-21).
"""

import bisect
import gzip
import ipaddress
import json
import os
import socket
import struct
import threading
import time
import urllib.request
from array import array
from pathlib import Path

BASE_DIR   = Path(__file__).resolve().parent
DB_DIR     = BASE_DIR / "asn-db"
DB_FILE    = DB_DIR / "ip2asn-combined.tsv.gz"
RULES_FILE = BASE_DIR / "asn_bans.json"
DB_URL     = "https://iptoasn.com/data/ip2asn-combined.tsv.gz"
DB_MAX_AGE = 7 * 86400          # the admin panel refreshes it once a week


class AsnTable:
    """The IP-to-ASN table in memory: sorted range starts, bisected.

    IPv4 rows sit in arrays (~5 MB for ~500 k rows); IPv6 starts and ends are
    128-bit, so they are plain int lists. Names are kept once per AS.
    """

    def __init__(self):
        self.v4_start = array("I"); self.v4_end = array("I"); self.v4_asn = array("I")
        self.v6_start = []; self.v6_end = []; self.v6_asn = array("I")
        self.names = {}          # asn -> (country, name)
        self.rows = 0
        self.mtime = 0.0

    @classmethod
    def load(cls, path=None):
        # Rows go straight into the arrays: building a list of tuples first
        # tripled the peak memory. iptoasn.com writes the file sorted, IPv4
        # first; a file that is not is sorted afterwards.
        path = path or DB_FILE
        t = cls()
        v4s, v4e, v4a = t.v4_start, t.v4_end, t.v4_asn
        v6s, v6e, v6a = t.v6_start, t.v6_end, t.v6_asn
        names = t.names
        inet4 = socket.inet_aton
        unpack = struct.Struct("!I").unpack
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
            for line in f:
                p = line.rstrip("\n").split("\t", 4)
                if len(p) < 5 or p[2] == "0":          # "Not routed"
                    continue
                try:
                    asn = int(p[2])
                    if ":" in p[0]:
                        v6s.append(int(ipaddress.IPv6Address(p[0])))
                        v6e.append(int(ipaddress.IPv6Address(p[1])))
                        v6a.append(asn)
                    else:
                        s = unpack(inet4(p[0]))[0]; e = unpack(inet4(p[1]))[0]
                        v4s.append(s); v4e.append(e); v4a.append(asn)
                except (ValueError, OSError):
                    continue
                if asn not in names:
                    names[asn] = (p[3] if p[3] != "None" else "", p[4].strip())
        t._sort()
        t.rows = len(v4s) + len(v6s)
        t.mtime = os.path.getmtime(path)
        return t

    def _sort(self):
        for st, en, an, mk in (("v4_start", "v4_end", "v4_asn", lambda: array("I")),
                               ("v6_start", "v6_end", "v6_asn", list)):
            s = getattr(self, st)
            if all(s[i] <= s[i + 1] for i in range(len(s) - 1)):
                continue
            order = sorted(range(len(s)), key=s.__getitem__)
            e, a = getattr(self, en), getattr(self, an)
            ns, ne = mk(), mk()
            na = array("I")
            for i in order:
                ns.append(s[i]); ne.append(e[i]); na.append(a[i])
            setattr(self, st, ns); setattr(self, en, ne); setattr(self, an, na)

    def lookup(self, ip):
        """(asn, country, name) for `ip`, or None (private, unrouted, bad)."""
        ip = (ip or "").strip()
        if ip.startswith("::ffff:"):
            ip = ip[7:]
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            return None
        if not a.is_global:
            return None
        n = int(a)
        if a.version == 4:
            starts, ends, asns = self.v4_start, self.v4_end, self.v4_asn
        else:
            starts, ends, asns = self.v6_start, self.v6_end, self.v6_asn
        i = bisect.bisect_right(starts, n) - 1
        if i < 0 or n > ends[i]:
            return None
        asn = asns[i]
        cc, name = self.names.get(asn, ("", ""))
        return (asn, cc, name)

    def search(self, text, limit=50):
        """The networks whose name contains `text` (or whose number is it)."""
        text = (text or "").strip()
        num = parse_asn(text)
        out = []
        if num is not None:
            if num in self.names:
                out.append(num)
        else:
            q = text.lower()
            if len(q) < 3:
                return [], 0
            out = [asn for asn, (_cc, nm) in self.names.items() if q in nm.lower()]
        out.sort()
        total = len(out)
        return [{"asn": a, "cc": self.names[a][0], "name": self.names[a][1]}
                for a in out[:limit]], total


def parse_asn(text):
    """12345, "AS12345", "as 12345" → 12345; anything else → None."""
    t = str(text or "").strip().upper().replace(" ", "")
    if t.startswith("AS"):
        t = t[2:]
    if t.isdigit() and 0 < int(t) < 4294967296:
        return int(t)
    return None


# ── The table, loaded once and reloaded when the file changes ────────────────
_table = None
_table_lock = threading.Lock()
_loading = False


def table():
    """The loaded table, or None while it is missing or still loading."""
    return _table


def reload_if_changed(block=False):
    """Load the table when the file is new or newer than the one in memory.

    Non-blocking by default: the load (~5 s) runs on its own thread and the
    old table keeps answering meanwhile.
    """
    global _loading
    try:
        m = os.path.getmtime(DB_FILE)
    except OSError:
        return
    with _table_lock:
        if _loading or (_table is not None and _table.mtime == m):
            return
        _loading = True

    def work():
        global _table, _loading
        try:
            t = AsnTable.load()
            _table = t
        except Exception as e:
            print("[asn] cannot load %s: %s" % (DB_FILE, e), flush=True)
        finally:
            _loading = False

    if block:
        work()
    else:
        threading.Thread(target=work, name="asn-load", daemon=True).start()


def db_status():
    t = _table
    try:
        m = os.path.getmtime(DB_FILE)
    except OSError:
        m = 0
    return {"present": bool(m), "file_time": int(m), "loaded": t is not None,
            "rows": t.rows if t else 0, "networks": len(t.names) if t else 0,
            "loading": _loading, "url": DB_URL}


def download():
    """Fetch the table from iptoasn.com; the old file stays until the new
    one has been read back whole."""
    DB_DIR.mkdir(exist_ok=True)
    tmp = DB_FILE.with_name(DB_FILE.name + ".tmp")
    req = urllib.request.Request(DB_URL, headers={"User-Agent": "PhantomSDR-Plus"})
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
    rows = 0
    with gzip.open(tmp, "rt", encoding="utf-8", errors="replace") as f:
        for _ in f:
            rows += 1
    if rows < 100000:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("download looks truncated (%d lines)" % rows)
    os.replace(tmp, DB_FILE)
    return rows


# ── Rules ─────────────────────────────────────────────────────────────────────
_rules_cache = (None, [])        # (mtime, rules)


def load_rules():
    """The rules, re-read only when asn_bans.json changed."""
    global _rules_cache
    try:
        m = os.path.getmtime(RULES_FILE)
    except OSError:
        _rules_cache = (None, [])
        return []
    if _rules_cache[0] == m:
        return _rules_cache[1]
    try:
        d = json.loads(RULES_FILE.read_text())
        rules = [r for r in d.get("rules", []) if isinstance(r, dict)
                 and r.get("kind") in ("asn", "isp") and r.get("value") not in (None, "")]
    except Exception:
        rules = _rules_cache[1]           # a half-written file: keep the last good list
    _rules_cache = (m, rules)
    return rules


def save_rules(rules):
    tmp = RULES_FILE.with_name(RULES_FILE.name + ".tmp")
    tmp.write_text(json.dumps({"rules": rules}, indent=1))
    os.replace(tmp, RULES_FILE)


def match(info, rules=None):
    """The first rule that `info` (a lookup() result) falls under, or None."""
    if not info:
        return None
    asn, _cc, name = info
    lname = name.lower()
    for r in (load_rules() if rules is None else rules):
        if r["kind"] == "asn":
            if parse_asn(r["value"]) == asn:
                return r
        elif str(r["value"]).lower() in lname:
            return r
    return None


def check(ip):
    """(rule, info) when `ip` is banned, else (None, info)."""
    t = _table
    if t is None:
        return None, None
    info = t.lookup(ip)
    return match(info), info


def rule_label(r):
    if r["kind"] == "asn":
        return "AS%s" % parse_asn(r["value"])
    return 'ISP "%s"' % r["value"]


def new_rule(kind, value, note=""):
    if kind == "asn":
        n = parse_asn(value)
        if n is None:
            raise ValueError("an AS number looks like AS12345")
        value = n
    else:
        value = str(value or "").strip()
        if len(value) < 3:
            raise ValueError("an ISP name needs at least 3 letters")
        value = value[:80]
    return {"id": "%x" % int(time.time() * 1000), "kind": kind, "value": value,
            "note": str(note or "").strip()[:80], "added": int(time.time())}
