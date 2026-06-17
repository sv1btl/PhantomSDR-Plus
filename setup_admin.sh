#!/bin/bash
# ============================================================
#  PhantomSDR-Plus Admin Panel — Setup Script
#  Run from inside your PhantomSDR-Plus directory:
#    chmod +x setup_admin.sh && ./setup_admin.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      PhantomSDR-Plus Admin Panel — Setup             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Sanity checks ─────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install: sudo apt install python3"
    exit 1
fi
echo "[OK] $(python3 --version)"

if [ ! -f "$SCRIPT_DIR/admin_server.py" ]; then
    echo "[ERROR] admin_server.py not found in $SCRIPT_DIR"
    echo "        Run this script from the PhantomSDR-Plus directory."
    exit 1
fi
echo "[OK] admin_server.py found"

if [ ! -f "$SCRIPT_DIR/manage_admin.sh" ]; then
    echo "[ERROR] manage_admin.sh not found in $SCRIPT_DIR"
    exit 1
fi
echo "[OK] manage_admin.sh found"
echo ""

# ── LAN IP detection ─────────────────────────────────────────────────────────
# spectrumserver drops WebSocket data for loopback (127.0.0.1) connections.
# The proxy must connect via the LAN IP so spectrumserver treats it as a
# normal client.  We detect this once at setup time and store it in config.
SDR_HOST=$(python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('8.8.8.8', 80))
    print(s.getsockname()[0])
    s.close()
except Exception:
    print('127.0.0.1')
" 2>/dev/null)
if [ -z "$SDR_HOST" ] || [ "$SDR_HOST" = "127.0.0.1" ]; then
    # Fallback: first non-loopback IP from hostname -I
    SDR_HOST=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$SDR_HOST" ]; then
    SDR_HOST="127.0.0.1"
    echo "[WARN] Could not detect LAN IP — defaulting to 127.0.0.1"
    echo "       Set 'sdr_host' manually in admin_config.json if waterfall"
    echo "       doesn't appear when accessed via the proxy."
else
    echo "[OK] LAN IP detected: $SDR_HOST (will be stored as sdr_host)"
fi
echo ""

# ── Port helper ───────────────────────────────────────────────────────────────
ask_port() {
    local label="$1"
    local varname="$2"
    local value
    while true; do
        read -p "$label: " value
        if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]; then
            eval "$varname=$value"
            echo "[OK] $label: $value"
            break
        else
            echo "[ERROR] Enter a valid port number (1-65535)."
        fi
    done
}

# ── Ports ─────────────────────────────────────────────────────────────────────
echo "Enter the port numbers for your setup:"
echo ""
ask_port "PhantomSDR server port (spectrumserver)"  SDR_PORT
ask_port "Admin panel internal port"                ADMIN_PORT
ask_port "Proxy public port (combines SDR + admin)" PROXY_PORT
echo ""

# ── Python dependencies ───────────────────────────────────────────────────────
echo "[*] Installing Python dependencies..."
pip3 install flask psutil aiohttp --break-system-packages 2>/dev/null || \
pip3 install flask psutil aiohttp --user 2>/dev/null || \
echo "[WARN] Auto-install failed. Run manually: pip3 install flask psutil aiohttp"

# ── ss capability (needed for the Kick Users feature) ────────────────────────
echo ""
SS_BIN="$(which ss 2>/dev/null || echo /usr/bin/ss)"
if command -v getcap &>/dev/null && getcap "$SS_BIN" 2>/dev/null | grep -q cap_net_admin; then
    echo "[OK] ss already has cap_net_admin"
else
    echo "[*] Granting ss cap_net_admin (required for Kick Users feature)..."
    if sudo setcap cap_net_admin+ep "$SS_BIN" 2>/dev/null; then
        echo "[OK] setcap applied to $SS_BIN"
    else
        echo "[WARN] Could not set capability. Kick Users may not work."
        echo "       Run manually later: sudo setcap cap_net_admin+ep $SS_BIN"
    fi
fi

# ── Write admin_config.json ───────────────────────────────────────────────────
echo ""
CONFIG_FILE="$SCRIPT_DIR/admin_config.json"
python3 - <<PYEOF
import json, hashlib

cfg_path = '$CONFIG_FILE'
defaults = {
    'password_hash':    hashlib.sha256(b'admin').hexdigest(),
    'sdr_base_dir':     '$SCRIPT_DIR',
    'log_lines':        200,
    'start_script':     '',
    'stop_script':      '',
    'sdr_process_name': 'spectrumserver',
}

cfg = {}
try:
    with open(cfg_path) as f:
        content = f.read().strip()
    if content:
        cfg = json.loads(content)
except (FileNotFoundError, json.JSONDecodeError):
    pass

for k, v in defaults.items():
    if k not in cfg:
        cfg[k] = v

# Always overwrite ports — these are the source of truth
cfg['port']        = $ADMIN_PORT   # admin panel internal port
cfg['public_port'] = $SDR_PORT     # spectrumserver port (used by Users page)
cfg['proxy_port']  = $PROXY_PORT   # proxy public port
cfg['sdr_host']    = '$SDR_HOST'   # LAN IP — proxy connects to spectrumserver via this

# setup_complete intentionally NOT set — first browser login triggers wizard

with open(cfg_path, 'w') as f:
    json.dump(cfg, f, indent=2)
print('[OK] admin_config.json saved')
PYEOF

# ── Systemd service ───────────────────────────────────────────────────────────
echo ""
read -p "Install as systemd service (auto-start on boot)? [y/N]: " SVC_CHOICE
SERVICE_INSTALLED=false
case "$SVC_CHOICE" in
    [yY]*)
        if ! sudo -n true 2>/dev/null; then
            echo "[*] sudo needed for systemd service..."
        fi
        PYTHON_BIN="$(command -v python3)"
        sudo tee /etc/systemd/system/phantomsdr-admin.service > /dev/null << UNIT
[Unit]
Description=PhantomSDR Admin Panel
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SCRIPT_DIR
ExecStart=$PYTHON_BIN $SCRIPT_DIR/admin_server.py
Restart=always
RestartSec=5
Environment=ADMIN_PORT=$ADMIN_PORT

[Install]
WantedBy=multi-user.target
UNIT
        sudo systemctl daemon-reload
        sudo systemctl enable phantomsdr-admin
        sudo systemctl restart phantomsdr-admin
        echo "[OK] Service installed and started (admin panel)"
        # systemd only manages admin_server.py — bring the proxy up too.
        # manage_admin.sh's start will correctly see the systemd-managed
        # admin panel via its pgrep fallback and only start the proxy.
        chmod +x "$SCRIPT_DIR/manage_admin.sh"
        bash "$SCRIPT_DIR/manage_admin.sh" start
        SERVICE_INSTALLED=true
        ;;
esac

# ── Ready banner ──────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Ready!                                                "
echo "║                                                        "
echo "║  Spectrumserver  : port ${SDR_PORT}  (LAN IP: ${SDR_HOST})"
if [ "$SERVICE_INSTALLED" = true ]; then
echo "║  Admin panel     : port ${ADMIN_PORT} (internal, systemd) "
else
echo "║  Admin panel     : port ${ADMIN_PORT} (internal)       "
fi
echo "║  Proxy           : port ${PROXY_PORT} (public)         "
echo "║                                                        "
if [ "$SERVICE_INSTALLED" = true ]; then
echo "║  Already running — auto-starts on boot                "
echo "║  Status : sudo systemctl status phantomsdr-admin       "
else
echo "║  1. Start : bash manage_admin.sh start                 "
fi
echo "║  2. Open  : http://YOUR_IP:${PROXY_PORT}/admin         "
echo "║  3. Login : password = admin  (change on first login!) "
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ "$SERVICE_INSTALLED" = true ]; then
    exit 0
fi

# ── Launch now ────────────────────────────────────────────────────────────────
read -p "Launch admin panel now? [Y/n]: " LAUNCH
case "$LAUNCH" in
    [nN]*) echo "Start later: bash manage_admin.sh start" ;;
    *)
        chmod +x "$SCRIPT_DIR/manage_admin.sh"
        bash "$SCRIPT_DIR/manage_admin.sh" restart
        ;;
esac
