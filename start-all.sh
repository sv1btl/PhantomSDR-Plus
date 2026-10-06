#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  start-all.sh
#  Start (or restart) EVERY receiver listed in receivers.toml, each through its
#  own start-*.sh. ./stop-websdr.sh with no argument is the counterpart.
#
#  Set this as the admin panel's start script and its Restart button and the
#  thermal guard bring back every receiver — the stop side (stop-websdr.sh)
#  already stops them all, and starting only the main one would leave the
#  others down.
#
#  Each [[receiver]] in receivers.toml that should be started needs:
#    launcher = "start-rtl.sh"      the start-*.sh for its hardware
#    instance = "vhf"               its instances/<name>/ — omit for the main
#                                   receiver (the one started without INSTANCE)
#  A receiver without a launcher is skipped (for example one that runs on
#  another machine).
#
#  Usage:  ./start-all.sh        a one-receiver station just keeps using its
#                                own start-<rx>.sh
# ─────────────────────────────────────────────────────────────────────────────

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIST="$PHANTOMDIR/receivers.toml"

if [ ! -f "$LIST" ]; then
    echo "start-all.sh: no receivers.toml — start your receiver with its start-<rx>.sh" >&2
    exit 1
fi

# "launcher instance" per line, read with Python's own TOML parser.
entries=$(python3 - "$LIST" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as f:
    cfg = tomllib.load(f)
for r in cfg.get("receiver", []):
    if r.get("launcher"):
        print(str(r["launcher"]), str(r.get("instance", "")))
PY
) || { echo "start-all.sh: cannot read $LIST" >&2; exit 1; }

if [ -z "$entries" ]; then
    echo "start-all.sh: no [[receiver]] in receivers.toml has a launcher" >&2
    exit 1
fi

started=0
while read -r launcher instance; do
    # Only the launchers that ship next to this script, never an arbitrary path.
    case "$launcher" in
        start-all.sh|*/*) echo "  skipped: $launcher" >&2; continue ;;
        start-*.sh) ;;
        *) echo "  skipped: $launcher (not a start-*.sh)" >&2; continue ;;
    esac
    if [ ! -f "$PHANTOMDIR/$launcher" ]; then
        echo "  skipped: $launcher not found" >&2
        continue
    fi
    echo "── $launcher${instance:+ (instance $instance)}"
    INSTANCE="$instance" bash "$PHANTOMDIR/$launcher" -q
    started=$(( started + 1 ))
done <<< "$entries"

echo "start-all.sh: $started receiver(s) started — each one's watchdog carries on in the background"
