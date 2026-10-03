#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  stop-websdr.sh
#  Universal stop for the server started by ANY of the start-*.sh scripts
#  (rx888mk2 / airspyhf / rtl / rsp1a / fobos / fobos-hf / hackrf) — one shared
#  stop for all receivers.
#
#  Usage:
#    ./stop-websdr.sh            stop EVERY receiver of this installation
#    ./stop-websdr.sh main       stop only the main receiver (started without
#                                INSTANCE=…), leaving any other one running
#    ./stop-websdr.sh vhf        stop only the receiver started with INSTANCE=vhf
#
#  Stops the watchdog FIRST (so it can't auto-restart anything), then the
#  receiver and server processes. Self-contained: no absolute or user paths.
# ─────────────────────────────────────────────────────────────────────────────

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="${1:-}"
case "$TARGET" in
    ""|all) TARGET="" ;;
    -h|--help)
        echo "usage: $(basename "$0") [instance]   (no instance = stop every receiver)"
        exit 0 ;;
    *[!A-Za-z0-9_-]*)
        echo "usage: $(basename "$0") [instance]   (no instance = stop every receiver)" >&2
        exit 1 ;;
esac

# Which instance a process belongs to: the start-*.sh scripts export
# PHANTOMSDR_INSTANCE to everything they start. No tag means it was started
# before instances existed, which can only have been the main receiver.
instance_of() {
    local v
    v=$(tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | sed -n 's/^PHANTOMSDR_INSTANCE=//p')
    echo "${v:-main}"
}

# Which installation: a second copy of PhantomSDR-Plus on this computer (a test
# tree, another station) may use the same instance names, and its receivers
# are none of this script's business. No tag = started before the tag existed.
tree_of() {
    tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | sed -n 's/^PHANTOMSDR_TREE=//p'
}

# SIGKILL each given PID of this installation that belongs to the target
# (every receiver of this installation without a target).
kill_selected() {
    local pid tree
    for pid in "$@"; do
        tree="$(tree_of "$pid")"
        [ -z "$tree" ] || [ "$tree" = "$PHANTOMDIR" ] || continue
        if [ -z "$TARGET" ] || [ "$(instance_of "$pid")" = "$TARGET" ]; then
            kill -9 "$pid" 2>/dev/null
        fi
    done
}

kill_name() {
    # shellcheck disable=SC2046
    kill_selected $(pgrep -x "$1" 2>/dev/null)
}

# 1) Stop the watchdog spawned by any start-*.sh so it stops monitoring.
#    Anchored to the end of the command line so it matches only the real
#    "…start-<rx>.sh --watchdog" process, never a launcher or an unrelated
#    shell that merely mentions the string.
# shellcheck disable=SC2046
kill_selected $(pgrep -f "start-[^ /]*\.sh --watchdog$" 2>/dev/null)
sleep 1

# 2) Kill the writer (rx888_stream) before the reader (spectrumserver) so the
#    writer doesn't take a spurious Broken-Pipe panic on the FIFO. rx_sdr /
#    rtl_sdr / hackrf_transfer are covered too in case a different front end
#    was in use, and so is cf32_to_real, which sits between rx_sdr and the
#    FIFO on the Fobos HF path. It normally ends by itself once rx_sdr is
#    gone; this is the net.
kill_name rx888_stream
kill_name rx_sdr
kill_name rtl_sdr
kill_name hackrf_transfer
kill_name cf32_to_real
sleep 1
kill_name spectrumserver

# 3) Stop the RADE sidecar and any lpcnet_demo child it spawned. It belongs to
#    the main receiver, so stopping another instance leaves it alone. Harmless
#    when RADE was never started (nothing matches).
if [ -z "$TARGET" ] || [ "$TARGET" = "main" ]; then
    pkill -9 -f "rade_helper\.py" 2>/dev/null
    killall -9 lpcnet_demo 2>/dev/null
fi

sleep 2
exit 0
