#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-https.sh
#  Serve the receiver over https:// as well as http://.
#
#  Caddy is put in front, on port 443. It obtains a free certificate from
#  Let's Encrypt for the station's DNS name and renews it by itself; the page,
#  the audio and the waterfall then also work as https://your.name/. The http
#  address (port 9000 on a new station) keeps working unchanged — websdr.org's
#  callback, Kiwi clients and other stations' http pages need it.
#
#  Caddy hands every visitor to proxy.py on a loopback port of its own
#  (PORT_TLS, 9014), where the proxy takes the visitor's real address from
#  Caddy and never mistakes them for this computer: the per-IP limits, the
#  listener list and the kick all keep working.
#
#  Usage:
#    bash setup-https.sh             turn https on for STATION_PUBLIC_HOST
#    bash setup-https.sh --lan       https inside the local network only, with
#                                    Caddy's own certificate (browsers warn)
#    bash setup-https.sh --status    is it on, and does the certificate answer?
#    bash setup-https.sh --remove    turn it off again (http stays as it is)
#
#  Needs: a station set up with configure-station.sh (an older station: run
#  bash configure-station.sh once — it keeps your ports), a DNS name pointing
#  at your public address (a free dynamic-DNS name is fine), and the router
#  forwarding TCP 443 and 80 to this computer. Port 80 is only used to prove
#  the name is yours when the certificate is issued or renewed.
#
#  PHANTOM_NONINTERACTIVE=1 (assumed without a terminal) asks nothing.
# ─────────────────────────────────────────────────────────────────────────────

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATION_CONF="$PHANTOMDIR/station.conf"
CADDYFILE=/etc/caddy/Caddyfile
SNIPPET_DIR=/etc/caddy/Caddyfile.d
SNIPPET="$SNIPPET_DIR/phantomsdr.caddyfile"
MARK="# PhantomSDR-Plus — written by setup-https.sh"

if [ -t 1 ]; then G=$'\033[1;32m'; Y=$'\033[1;33m'; R=$'\033[1;31m'; B=$'\033[1m'; N=$'\033[0m'
else G=""; Y=""; R=""; B=""; N=""; fi
ok()   { printf '  %s✔%s %s\n' "$G" "$N" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '  %s✖%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
say()  { printf '%s\n' "$*"; }

PHANTOM_NONINTERACTIVE="${PHANTOM_NONINTERACTIVE:-0}"
[ -t 0 ] || PHANTOM_NONINTERACTIVE=1

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || die "sudo is needed (Caddy is a system service)"
    SUDO="sudo"
fi

MODE="on"
case "${1:-}" in
    "")         MODE="on" ;;
    --lan)      MODE="lan" ;;
    --status)   MODE="status" ;;
    --remove)   MODE="remove" ;;
    -h|--help)  sed -n '2,/^# ─\{20,\}$/p' "$0" | sed '1d;$d;s/^# \{0,2\}//'; exit 0 ;;
    *)          die "unknown option $1 — try --help" ;;
esac

[ -f "$STATION_CONF" ] || die "no station.conf — run first:  bash configure-station.sh
     (on a station installed before it, it keeps all your ports)"
# shellcheck disable=SC1090
. "$STATION_CONF"
HOST="${STATION_PUBLIC_HOST:-}"

# The wizard keeps station.conf, site_information.json and the proxy in step;
# PHANTOM_FROM_HTTPS stops it from calling this script back.
wizard() {   # wizard <STATION_HTTPS value>
    PHANTOM_FROM_HTTPS=1 PHANTOM_NONINTERACTIVE=1 PHANTOM_PUT_NOW=y STATION_HTTPS="$1" \
        bash "$PHANTOMDIR/configure-station.sh" < /dev/null | sed -n '/Writing/,$p'
}

caddy_active() { systemctl is-active --quiet caddy 2>/dev/null; }

# Ask the local Caddy for the page by name, so neither DNS nor the router's
# hairpin is in the way: the certificate is either there or not.
probe() {   # probe <name> [-k]
    curl -s -o /dev/null -w '%{http_code}' --max-time 10 $2 \
        --resolve "$1:443:127.0.0.1" "https://$1/" 2>/dev/null
}

# ── --status ─────────────────────────────────────────────────────────────────
if [ "$MODE" = status ]; then
    say "https in station.conf : ${STATION_HTTPS:-n}"
    say "Caddy                 : $(caddy_active && echo running || echo 'not running')"
    if [ "${STATION_HTTPS:-n}" = y ] && [ -n "$HOST" ]; then
        code="$(probe "$HOST")"
        if [ "$code" = 200 ]; then ok "https://$HOST/ answers with a valid certificate"
        else warn "https://$HOST/ does not answer with a valid certificate yet (HTTP ${code:-none})"; fi
    elif [ "${STATION_HTTPS:-n}" = lan ]; then
        say "local network         : https://$(hostname -I 2>/dev/null | awk '{print $1}')/ (Caddy's own certificate)"
    fi
    exit 0
fi

# ── --remove ─────────────────────────────────────────────────────────────────
if [ "$MODE" = remove ]; then
    if [ -f "$SNIPPET" ]; then
        $SUDO rm -f "$SNIPPET" && ok "removed $SNIPPET"
    fi
    if [ -f "$CADDYFILE" ] && grep -qF "$MARK" "$CADDYFILE"; then
        if [ -f "$CADDYFILE.bak-phantomsdr" ]; then
            $SUDO mv "$CADDYFILE.bak-phantomsdr" "$CADDYFILE" && ok "Caddyfile put back as it was"
        else
            $SUDO rm -f "$CADDYFILE"
        fi
        $SUDO systemctl disable --now caddy >/dev/null 2>&1 && ok "Caddy stopped"
    elif caddy_active; then
        $SUDO systemctl reload caddy >/dev/null 2>&1 && ok "Caddy reloaded without this station"
    fi
    wizard n
    ok "https is off — the receiver is on http://${HOST:-your-address}:${PORT_PUBLIC:-9000}/ as before"
    exit 0
fi

# ── turning it on ────────────────────────────────────────────────────────────
if [ "$MODE" = on ]; then
    [ -n "$HOST" ] || die "station.conf has no public address — set one with: bash configure-station.sh"
    if [[ $HOST =~ ^[0-9.]+$ ]] || [[ $HOST == *:* ]]; then
        die "$HOST is an IP address. Let's Encrypt certifies names: get a free DNS name
     (a dynamic-DNS service), set it with bash configure-station.sh, and run this again.
     For the local network only: bash setup-https.sh --lan"
    fi
    if command -v getent >/dev/null 2>&1 && ! getent hosts "$HOST" >/dev/null 2>&1; then
        warn "$HOST does not resolve yet — the certificate can only be issued once it does."
    fi
    SITE="$HOST"
    TLS_LINE=""
else
    LANIP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "$LANIP" ] || die "could not find this computer's address on the local network"
    SITE="https://$LANIP, https://$(hostname)"
    TLS_LINE="    tls internal"
fi

# Something else on 443 or 80 (nginx, Apache, another Caddy setup) is not ours
# to take over. Print what to add to it instead.
busy_other() {   # busy_other <port> → 0 when something other than Caddy listens
    local who
    who="$($SUDO ss -ltnpH "sport = :$1" 2>/dev/null)"
    [ -n "$who" ] && ! grep -q '"caddy"' <<<"$who"
}
for port in 443 80; do
    [ "$MODE" = lan ] && [ "$port" = 80 ] && continue
    if busy_other "$port"; then
        say ""
        warn "Port $port is already used by another web server on this computer."
        say "  Leave it in charge, and point it at PhantomSDR-Plus instead. nginx:"
        say ""
        say "    location / {"
        say "        proxy_pass http://127.0.0.1:${PORT_TLS:-9014};"
        say "        proxy_http_version 1.1;"
        say "        proxy_set_header Upgrade \$http_upgrade;"
        say "        proxy_set_header Connection \"upgrade\";"
        say "        proxy_set_header X-Forwarded-For \$remote_addr;"
        say "        proxy_read_timeout 1d;"
        say "    }"
        say ""
        say "  then turn https on in station.conf without Caddy:"
        say "    STATION_HTTPS=y bash configure-station.sh"
        exit 1
    fi
done

# ── Caddy ────────────────────────────────────────────────────────────────────
if ! command -v caddy >/dev/null 2>&1; then
    say "Installing Caddy..."
    if command -v apt-get >/dev/null 2>&1; then
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1
        if ! apt-cache policy caddy 2>/dev/null | grep -q 'Candidate: [0-9]'; then
            # Ubuntu 22.04 has no caddy package: Caddy's own repository.
            $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
                debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null 2>&1
            curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
                | $SUDO gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
            curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
                | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
            $SUDO env DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1
        fi
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then $SUDO dnf install -y -q caddy >/dev/null 2>&1
    elif command -v pacman >/dev/null 2>&1; then $SUDO pacman -S --noconfirm --needed caddy >/dev/null 2>&1
    elif command -v zypper >/dev/null 2>&1; then $SUDO zypper -n -q install caddy >/dev/null 2>&1
    fi
    command -v caddy >/dev/null 2>&1 || die "Caddy could not be installed — install the 'caddy' package, then run this again"
    ok "Caddy $(caddy version 2>/dev/null | awk '{print $1}') installed"
fi

# ── station.conf, site_information.json, proxy.py ─────────────────────────────
want="y"; [ "$MODE" = lan ] && want="lan"
wizard "$want"
# shellcheck disable=SC1090
. "$STATION_CONF"
[ -n "${PORT_TLS:-}" ] || die "station.conf has no PORT_TLS after the update — run: bash configure-station.sh"

# ── the Caddy site ───────────────────────────────────────────────────────────
BLOCK="$MARK
# Remove with: bash $PHANTOMDIR/setup-https.sh --remove
$SITE {
${TLS_LINE:+$TLS_LINE
}    reverse_proxy 127.0.0.1:$PORT_TLS
}"
GLOBAL=""
[ -n "${STATION_EMAIL:-}" ] && [ "$MODE" = on ] && GLOBAL="{
    email $STATION_EMAIL
}
"
# A Caddyfile that is still the distribution's sample page (or ours) is
# replaced, keeping a copy; one the sysop wrote gets ours imported beside it.
if [ ! -f "$CADDYFILE" ] || grep -qF "$MARK" "$CADDYFILE" \
   || grep -q -E '^\s*root \* /usr/share/caddy' "$CADDYFILE"; then
    if [ -f "$CADDYFILE" ] && ! grep -qF "$MARK" "$CADDYFILE"; then
        $SUDO cp "$CADDYFILE" "$CADDYFILE.bak-phantomsdr"
    fi
    printf '%s%s\n' "$GLOBAL" "$BLOCK" | $SUDO tee "$CADDYFILE" >/dev/null
    $SUDO rm -f "$SNIPPET"
else
    $SUDO mkdir -p "$SNIPPET_DIR"
    printf '%s\n' "$BLOCK" | $SUDO tee "$SNIPPET" >/dev/null
    grep -q -E '^\s*import\s+Caddyfile\.d/' "$CADDYFILE" \
        || printf '\nimport Caddyfile.d/*.caddyfile\n' | $SUDO tee -a "$CADDYFILE" >/dev/null
fi
$SUDO caddy validate --adapter caddyfile --config "$CADDYFILE" >/dev/null 2>&1 \
    || die "Caddy does not accept $CADDYFILE — see: sudo caddy validate --config $CADDYFILE"
if [ -d /run/systemd/system ]; then
    $SUDO systemctl enable caddy >/dev/null 2>&1
    if caddy_active; then $SUDO systemctl reload caddy; else $SUDO systemctl start caddy; fi
    caddy_active || die "Caddy did not start — see: sudo journalctl -u caddy -n 30"
    ok "Caddy serves this station on port 443"
else
    warn "no systemd here — start Caddy yourself: sudo caddy run --config $CADDYFILE"
fi

# ── the certificate ──────────────────────────────────────────────────────────
if [ "$MODE" = on ]; then
    say "Waiting for the certificate from Let's Encrypt (up to two minutes)..."
    code=""
    for _ in $(seq 24); do
        code="$(probe "$HOST")"
        [ "$code" = 200 ] && break
        sleep 5
    done
    if [ "$code" = 200 ]; then
        ok "https://$HOST/ is live"
    else
        warn "no certificate yet. Check that $HOST points at your public address and"
        say  "    that the router forwards TCP 443 and 80 to this computer; Caddy keeps"
        say  "    trying by itself. Its log: sudo journalctl -u caddy -n 50"
    fi
    say ""
    say "  ${B}https://$HOST/${N}   — and http://$HOST:${PORT_PUBLIC}/ as before"
    say "  Router: forward TCP 443 and 80 (as well as ${PORT_PUBLIC}) to this computer."
else
    say ""
    say "  ${B}https://$LANIP/${N} on the local network. Browsers warn about Caddy's own"
    say "  certificate until you trust it (see docs/HTTPS.md)."
fi
