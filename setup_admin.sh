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

# ── Port ─────────────────────────────────────────────────────────────────────
read -p "Enter admin panel port [default: 3000]: " ADMIN_PORT
ADMIN_PORT=${ADMIN_PORT:-3000}
if ! [[ "$ADMIN_PORT" =~ ^[0-9]+$ ]] || [ "$ADMIN_PORT" -lt 1024 ] || [ "$ADMIN_PORT" -gt 65535 ]; then
    echo "[ERROR] Invalid port."
    exit 1
fi
echo "[OK] Port: $ADMIN_PORT"
echo ""

# ── Save config ───────────────────────────────────────────────────────────────
CONFIG_FILE="$SCRIPT_DIR/admin_config.json"
if [ -f "$CONFIG_FILE" ]; then
    python3 -c "
import json
with open('$CONFIG_FILE') as f: cfg = json.load(f)
cfg['port'] = $ADMIN_PORT
with open('$CONFIG_FILE', 'w') as f: json.dump(cfg, f, indent=2)
print('[OK] Updated admin_config.json')
"
else
    python3 -c "
import json, hashlib
cfg = {
    'password_hash': hashlib.sha256(b'admin').hexdigest(),
    'port': $ADMIN_PORT,
    'sdr_base_dir': '$SCRIPT_DIR',
    'log_lines': 200,
}
with open('$CONFIG_FILE', 'w') as f: json.dump(cfg, f, indent=2)
print('[OK] Created admin_config.json')
"
fi

# ── Python check ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install: sudo apt install python3"
    exit 1
fi
echo "[OK] $(python3 --version)"

# ── Dependencies ──────────────────────────────────────────────────────────────
echo "[*] Installing dependencies..."
pip3 install flask psutil --break-system-packages 2>/dev/null || \
pip3 install flask psutil --user 2>/dev/null || \
echo "[WARN] Run manually: pip3 install flask psutil"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup complete!                                     ║"
echo "║  URL: http://YOUR_IP:${ADMIN_PORT}/admin                      ║"
echo "║  PWD: admin  (change on first login!)                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Systemd service ───────────────────────────────────────────────────────────
read -p "Install as systemd service (auto-start on boot)? [Y/n]: " SVC_CHOICE
case "$SVC_CHOICE" in
    [nN]) ;;
    *)
        sudo tee /etc/systemd/system/phantomsdr-admin.service > /dev/null << UNIT
[Unit]
Description=PhantomSDR Admin Panel
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/python3 $SCRIPT_DIR/admin_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
        sudo systemctl daemon-reload
        sudo systemctl enable phantomsdr-admin
        sudo systemctl restart phantomsdr-admin
        echo "[OK] Service installed and started"
        echo "     sudo systemctl status phantomsdr-admin"
        exit 0
        ;;
esac

# ── Launch now ────────────────────────────────────────────────────────────────
read -p "Launch admin panel now? [Y/n]: " choice
case "$choice" in
    [nN]) echo "Start manually: bash manage_admin.sh start" ;;
    *)
        bash "$SCRIPT_DIR/manage_admin.sh" start
        ;;
esac
