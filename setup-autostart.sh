#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-autostart.sh
#  Start the receiver when the computer boots.
#
#  Installs one systemd unit, phantomsdr-receiver.service, that runs the
#  receiver's start script at boot and ./stop-websdr.sh at shutdown. The start
#  script keeps its own watchdog, log and restart logic exactly as when it is
#  run by hand; the unit only decides WHEN it runs.
#
#  Usage:
#    bash setup-autostart.sh                 the start script from station.conf
#    bash setup-autostart.sh start-rtl.sh    a particular start script
#    bash setup-autostart.sh start-all.sh    every receiver in receivers.toml
#    bash setup-autostart.sh --remove        stop starting at boot
#    bash setup-autostart.sh --status        is it installed, and for what?
#
#  The unit runs as the user who installed it, with the plugdev group the
#  receivers' udev rules give access to — so it opens the USB device at boot
#  without anyone logged in, and without logging out and back in first.
#
#  Starting or restarting the receiver by hand (./start-*.sh) or from the
#  admin panel keeps working as before; ./stop-websdr.sh still stops it.
# ─────────────────────────────────────────────────────────────────────────────

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_NAME="phantomsdr-receiver"
UNIT_PATH="/etc/systemd/system/$UNIT_NAME.service"

if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { "$@"; }
fi

no_systemd() {
    echo "[–] systemd is not running on this machine (a container, WSL1 or a"
    echo "    non-systemd init), so there is nothing to install. Start the"
    echo "    receiver by hand with its start script after each boot."
    exit 0
}

case "${1:-}" in
    --remove)
        [ -d /run/systemd/system ] || no_systemd
        if [ -f "$UNIT_PATH" ]; then
            # disable only: stopping the unit would stop the receiver too.
            sudo systemctl disable "$UNIT_NAME" >/dev/null 2>&1 || true
            sudo rm -f "$UNIT_PATH"
            sudo systemctl daemon-reload
            echo "[OK] The receiver no longer starts at boot (it keeps running now)."
        else
            echo "[OK] Nothing to remove — $UNIT_NAME is not installed."
        fi
        exit 0 ;;
    --status)
        if [ -f "$UNIT_PATH" ]; then
            echo "Installed: $(sed -n 's/^ExecStart=.* \(\S*\.sh\).*/\1/p' "$UNIT_PATH")"
            systemctl is-enabled "$UNIT_NAME" 2>/dev/null
        else
            echo "Not installed — the receiver does not start at boot."
        fi
        exit 0 ;;
    -h|--help)
        sed -n '2,/^# ─\{20,\}$/p' "$0" | sed '1d;$d;s/^# \{0,2\}//'
        exit 0 ;;
esac

LAUNCHER="${1:-}"
if [ -z "$LAUNCHER" ] && [ -f "$PHANTOMDIR/station.conf" ]; then
    LAUNCHER="$(. "$PHANTOMDIR/station.conf"; printf '%s' "${STATION_LAUNCHER:-}")"
fi
# Several receivers listed in receivers.toml: start them all.
if [ -z "$1" ] && [ -f "$PHANTOMDIR/receivers.toml" ] && [ -f "$PHANTOMDIR/start-all.sh" ]; then
    LAUNCHER="start-all.sh"
fi
LAUNCHER="$(basename "$LAUNCHER")"
if [ -z "$LAUNCHER" ] || [ ! -f "$PHANTOMDIR/$LAUNCHER" ]; then
    echo "[ERROR] Which start script? e.g.  bash setup-autostart.sh start-rtl.sh"
    exit 1
fi

[ -d /run/systemd/system ] || no_systemd
sudo true || { echo "[ERROR] sudo is needed to install a systemd unit."; exit 1; }

# plugdev opens the USB receiver; cpufreq (when setup-cpufreq-perms.sh made
# it) lets the thermal guard lower the clock of a receiver it restarted.
SUPP=()
getent group plugdev >/dev/null 2>&1 && SUPP+=(plugdev)
getent group cpufreq >/dev/null 2>&1 && SUPP+=(cpufreq)
GROUPS_LINE=""
[ ${#SUPP[@]} -gt 0 ] && GROUPS_LINE="SupplementaryGroups=${SUPP[*]}"

# Type=oneshot + RemainAfterExit: the start script launches the receiver chain
# and its watchdog in the background and returns; the unit then stays
# "active" until shutdown, when stop-websdr.sh takes the chain down cleanly
# before systemd sweeps up anything left in the unit's cgroup.
sudo tee "$UNIT_PATH" >/dev/null <<UNIT
# PhantomSDR-Plus — written by setup-autostart.sh. Remove with:
#   bash $PHANTOMDIR/setup-autostart.sh --remove
[Unit]
Description=PhantomSDR-Plus receiver ($LAUNCHER)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$(id -un)
$GROUPS_LINE
WorkingDirectory=$PHANTOMDIR
ExecStart=/bin/bash $PHANTOMDIR/$LAUNCHER -q
ExecStop=/bin/bash $PHANTOMDIR/stop-websdr.sh
TimeoutStartSec=300
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable "$UNIT_NAME" >/dev/null 2>&1
echo "[OK] $LAUNCHER will start at every boot ($UNIT_NAME.service)."
echo "     Start it now:   sudo systemctl start $UNIT_NAME"
echo "     Undo:           bash setup-autostart.sh --remove"
