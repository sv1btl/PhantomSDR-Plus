#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  stop-websdr.sh
#  Universal stop for the server started by ANY of the start-*.sh scripts
#  (rx888mk2 / airspyhf / rtl / rsp1a) — one shared stop for all receivers.
#
#  Stops the watchdog FIRST (so it can't auto-restart anything), then the
#  receiver and server processes. Self-contained: no absolute or user paths.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Stop the watchdog spawned by any start-*.sh (rx888mk2 / airspyhf / rtl /
#    rsp1a) so it stops monitoring. Anchored to the end of the command line so it
#    matches only the real "…start-<rx>.sh --watchdog" process, never a launcher
#    or an unrelated shell that merely mentions the string.
pkill -9 -f "start-[^ /]*\.sh --watchdog$" 2>/dev/null
sleep 1

# 2) Kill the writer (rx888_stream) before the reader (spectrumserver) so the
#    writer doesn't take a spurious Broken-Pipe panic on the FIFO. rx_sdr /
#    rtl_sdr are covered too in case a different front end was in use.
killall -9 rx888_stream 2>/dev/null
killall -9 rx_sdr       2>/dev/null
killall -9 rtl_sdr      2>/dev/null
sleep 1
killall -9 spectrumserver 2>/dev/null

# 3) Stop the RADE sidecar and any lpcnet_demo child it spawned. Harmless when
#    RADE was never started (nothing matches).
pkill -9 -f "rade_helper\.py" 2>/dev/null
killall -9 lpcnet_demo 2>/dev/null

sleep 2
exit 0
