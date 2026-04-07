#!/bin/bash
# ============================================================
#  PhantomSDR Admin Panel — Start / Stop manager
#  Usage:
#    ./manage_admin.sh start
#    ./manage_admin.sh stop
#    ./manage_admin.sh restart
#    ./manage_admin.sh status
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/admin_server.py"
PROXY_SCRIPT="$SCRIPT_DIR/proxy.py"
PID_FILE="$SCRIPT_DIR/admin.pid"
PROXY_PID_FILE="$SCRIPT_DIR/proxy.pid"
LOG_FILE="$SCRIPT_DIR/admin.log"
PROXY_LOG_FILE="$SCRIPT_DIR/proxy.log"

cmd_start() {
    # ── Admin panel ───────────────────────────────────────────────────────────
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "[!] Admin panel already running (PID=$(cat "$PID_FILE"))"
    else
        echo "[*] Starting admin panel..."
        nohup python3 "$PY_SCRIPT" >> "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        sleep 1
        if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "[OK] Admin panel started — PID=$(cat "$PID_FILE")"
        else
            echo "[ERR] Admin panel failed to start. Check $LOG_FILE"
            rm -f "$PID_FILE"
        fi
    fi

    # ── Proxy ─────────────────────────────────────────────────────────────────
    if [ ! -f "$PROXY_SCRIPT" ]; then
        echo "[–] proxy.py not found, skipping"
        return
    fi
    if [ -f "$PROXY_PID_FILE" ] && kill -0 "$(cat "$PROXY_PID_FILE")" 2>/dev/null; then
        echo "[!] Proxy already running (PID=$(cat "$PROXY_PID_FILE"))"
    else
        echo "[*] Starting proxy..."
        nohup python3 "$PROXY_SCRIPT" >> "$PROXY_LOG_FILE" 2>&1 &
        echo $! > "$PROXY_PID_FILE"
        sleep 1
        if kill -0 "$(cat "$PROXY_PID_FILE")" 2>/dev/null; then
            echo "[OK] Proxy started — PID=$(cat "$PROXY_PID_FILE")"
        else
            echo "[ERR] Proxy failed to start. Check $PROXY_LOG_FILE"
            rm -f "$PROXY_PID_FILE"
        fi
    fi
}

cmd_stop() {
    # ── Admin panel ───────────────────────────────────────────────────────────
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
    else
        PID=$(pgrep -f "python3.*admin_server.py" | head -1)
    fi
    if [ -n "$PID" ]; then
        echo "[*] Stopping admin panel (PID=$PID)..."
        kill "$PID" 2>/dev/null
        sleep 1
        kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null && echo "[OK] Force killed admin" || echo "[OK] Admin stopped"
    else
        echo "[–] Admin panel not running"
    fi
    rm -f "$PID_FILE"

    # ── Proxy ─────────────────────────────────────────────────────────────────
    if [ -f "$PROXY_PID_FILE" ]; then
        PROXY_PID=$(cat "$PROXY_PID_FILE")
    else
        PROXY_PID=$(pgrep -f "python3.*proxy.py" | head -1)
    fi
    if [ -n "$PROXY_PID" ]; then
        echo "[*] Stopping proxy (PID=$PROXY_PID)..."
        kill "$PROXY_PID" 2>/dev/null
        sleep 1
        kill -0 "$PROXY_PID" 2>/dev/null && kill -9 "$PROXY_PID" 2>/dev/null && echo "[OK] Force killed proxy" || echo "[OK] Proxy stopped"
    else
        echo "[–] Proxy not running"
    fi
    rm -f "$PROXY_PID_FILE"
}

cmd_status() {
    # Admin panel
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "[✓] Admin panel running — PID=$(cat "$PID_FILE")"
    else
        PID=$(pgrep -f "python3.*admin_server.py" | head -1)
        [ -n "$PID" ] && echo "[✓] Admin panel running — PID=$PID (no pid file)" || echo "[✗] Admin panel not running"
    fi
    # Proxy
    if [ -f "$PROXY_PID_FILE" ] && kill -0 "$(cat "$PROXY_PID_FILE")" 2>/dev/null; then
        echo "[✓] Proxy running — PID=$(cat "$PROXY_PID_FILE")"
    else
        PROXY_PID=$(pgrep -f "python3.*proxy.py" | head -1)
        [ -n "$PROXY_PID" ] && echo "[✓] Proxy running — PID=$PROXY_PID (no pid file)" || echo "[✗] Proxy not running"
    fi
}

case "$1" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_stop; sleep 1; cmd_start ;;
    status)  cmd_status ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
