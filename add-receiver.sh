#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  add-receiver.sh
#  Add one more receiver to this computer — for example an RTL-SDR for 2 m
#  next to an RX-888 for HF — so listeners can switch between them on the page.
#
#  It asks which receiver and what it should cover, then:
#    1. installs or updates its driver (the same setup-*.sh the installers use)
#    2. creates instances/<name>/ — config.toml, instance.env, markers.json and
#       www/ with the receiver's own site_information.json
#    3. adds the receiver (and, the first time, the main one) to receivers.toml
#    4. offers to point the admin panel's start script at start-all.sh, to show
#       the receiver picker on the main page too, to start the new receiver,
#       and to restart the proxy so it routes to it
#
#  Nothing of the main receiver's own configuration is changed, apart from the
#  optional picker entry in frontend/site_information.json. Run it once per
#  extra receiver. The installers offer it at the end; it also runs on its own:
#
#    ./add-receiver.sh
#
#  Every question can be answered in advance (unattended runs, tests):
#    ADD_RX_TYPE=1-7         receiver type (menu below)
#    RTL_V4=y|n              RTL-SDR: is it a Blog V4 (passed to setup-rtlsdr.sh)
#    ADD_RX_DRIVER=y|n       install or update its driver now
#    ADD_RX_FREQ=145M        centre frequency (Hz, or with k/M suffix)
#    ADD_RX_SPS=2.4M         sample rate
#    ADD_RX_NAME=vhf         instance name (letters, digits, - and _)
#    ADD_RX_LABEL="2 m …"    button and listing name
#    ADD_RX_ANTENNA="…"      antenna shown on its page
#    ADD_RX_HOST=host        the station's public host name or IP
#    ADD_RX_MAIN_LAUNCHER=start-rx888mk2.sh   the main receiver's launcher
#    ADD_RX_PICKER_MAIN=y|n  add the picker to the main page (frontend rebuild)
#    ADD_RX_ADMIN=y|n        set the admin panel's start script to start-all.sh
#    ADD_RX_START=y|n        start the new receiver now
#    ADD_RX_PROXY=y|n        restart the proxy now (sudo)
#
#  The complete guide is docs/MULTI_RECEIVER.md.
# ─────────────────────────────────────────────────────────────────────────────
set -o pipefail

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PHANTOMDIR" || exit 1

green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }
die()    { echo -e "\e[31m❌ $*\e[0m" >&2; exit 1; }
warn()   { echo -e "\e[33m⚠️  $*\e[0m"; }

INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1

# ask VAR "question" "default" — answer in $REPLY_VALUE. An ADD_RX_<VAR>
# variable answers it in advance; without a terminal the default is taken.
ask() {
    local var="ADD_RX_$1" q="$2" def="$3" ans
    if [ -n "${!var:-}" ]; then
        REPLY_VALUE="${!var}"
        echo "  $q → $REPLY_VALUE (from $var)"
        return
    fi
    if [ "$INTERACTIVE" = 1 ]; then
        read -r -p "  $q [$def]: " ans
        REPLY_VALUE="${ans:-$def}"
    else
        REPLY_VALUE="$def"
        echo "  $q → $def (default)"
    fi
}

# ask_yn VAR y|n "question" — returns 0 for yes.
ask_yn() {
    local var="ADD_RX_$1" def="$2" q="$3" ans hint
    if [ -n "${!var:-}" ]; then
        echo "  $q → ${!var} (from $var)"
        [[ ${!var} =~ ^[Yy] ]]; return
    fi
    if [ "$INTERACTIVE" = 1 ]; then
        [ "$def" = y ] && hint="\e[1;32mY\e[0m/n (ENTER = Yes)" || hint="y/\e[1;31mN\e[0m (ENTER = No)"
        echo -ne "  $q [$hint] "
        read -r ans
        ans="${ans:-$def}"
    else
        ans="$def"
        echo "  $q → $def (default)"
    fi
    [[ $ans =~ ^[Yy] ]]
}

command -v python3 >/dev/null 2>&1 || die "python3 is required."
[ -x "$PHANTOMDIR/build/spectrumserver" ] \
    || die "build/spectrumserver not found — install PhantomSDR-Plus first (install.sh)."
[ -d "$PHANTOMDIR/frontend/dist" ] \
    || warn "frontend/dist not found — the receiver's page needs a frontend build (./recompile.sh)."

echo ""
blue "══════════════════════════════════════════════════════════════════════"
blue "  PhantomSDR-Plus — add a receiver"
blue "══════════════════════════════════════════════════════════════════════"
echo ""
echo "This adds one more receiver next to the one you already have. Each"
echo "receiver is a server of its own; listeners switch between them with"
echo "buttons on the page. Guide: docs/MULTI_RECEIVER.md"
echo ""

# ── 1. Which receiver ────────────────────────────────────────────────────────
echo "Which receiver are you adding?"
echo "  [1] RX888 MkII / RX888      (HF, direct sampling)"
echo "  [2] RTL-SDR                 (RTL-SDR Blog V3/V4 and other RTL2832U sticks)"
echo "  [3] SDRplay RSP1A"
echo "  [4] RigExpert Fobos SDR — RF path"
echo "  [5] RigExpert Fobos SDR — HF1/HF2 direct sampling (0-25 MHz)"
echo "  [6] Airspy HF+"
echo "  [7] HackRF One"
ask TYPE "Select [1-7]" 2
TYPE="$REPLY_VALUE"

DIRECT=0          # 1 = real (direct-sampling) input: no tuning frequency
RTL_CAL_GAIN=29.7 # RTL-SDR: the fixed gain the S-meter starting calibration was measured at
ARGS_VAR="RX_ARGS"
case "$TYPE" in
    1) LAUNCHER=start-rx888mk2.sh; TEMPLATE=config-rx888mk2.toml; SETUP=rx888
       LABEL_DEF="HF (RX-888 MkII)"; RX_URL="https://www.rx-888.com/rx/"; DIRECT=1; ARGS_VAR="RX888_ARGS" ;;
    2) LAUNCHER=start-rtl.sh; TEMPLATE=config-rtl.toml; SETUP=setup-rtlsdr.sh
       LABEL_DEF="RTL-SDR"; RX_URL="https://www.rtl-sdr.com/" ;;
    3) LAUNCHER=start-rsp1a.sh; TEMPLATE=config-rsp1a.toml; SETUP=setup-rsp1a.sh
       LABEL_DEF="SDRplay RSP1A"; RX_URL="https://www.sdrplay.com/rsp1a/"; ARGS_VAR="RSP1A" ;;
    4) LAUNCHER=start-fobos.sh; TEMPLATE=config-fobos.toml; SETUP=setup-fobos.sh
       LABEL_DEF="Fobos SDR"; RX_URL="https://rigexpert.com/" ;;
    5) LAUNCHER=start-fobos-hf.sh; TEMPLATE=config-fobos-hf.toml; SETUP=setup-fobos.sh
       LABEL_DEF="HF (Fobos SDR)"; RX_URL="https://rigexpert.com/"; DIRECT=1 ;;
    6) LAUNCHER=start-airspyhf.sh; TEMPLATE=config-airspyhf.toml; SETUP=setup-airspyhf.sh
       LABEL_DEF="Airspy HF+"; RX_URL="https://airspy.com/airspy-hf-plus/" ;;
    7) LAUNCHER=start-hackrf.sh; TEMPLATE=config-hackrf.toml; SETUP=setup-hackrf.sh
       LABEL_DEF="HackRF One"; RX_URL="https://greatscottgadgets.com/hackrf/" ;;
    *) die "Invalid choice '$TYPE'." ;;
esac
[ -f "$PHANTOMDIR/$LAUNCHER" ] || die "$LAUNCHER not found — is the source tree complete?"
[ -f "$PHANTOMDIR/$TEMPLATE" ] || die "$TEMPLATE not found — is the source tree complete?"

# ── 2. Its driver ────────────────────────────────────────────────────────────
echo ""
# Asked whether or not the driver is installed now: it also names the receiver.
if [ "$TYPE" = 2 ] && [ -z "${RTL_V4:-}" ]; then
    if ask_yn V4 n "Is the stick an RTL-SDR Blog V4?"; then RTL_V4=y; else RTL_V4=n; fi
    export RTL_V4
fi
if [ "$SETUP" = rx888 ]; then
    if command -v rx888_stream >/dev/null 2>&1 \
       || [ -x "$PHANTOMDIR/rx888_stream/target/release/rx888_stream" ]; then
        green "✅ rx888_stream is already built"
    else
        warn "rx888_stream is not built. Build it with the installer's receiver option 1,"
        warn "then run ./setup-rx888-udev.sh — this script does not build the Rust driver."
    fi
elif ask_yn DRIVER y "Install or update the driver for it now (needs sudo)?"; then
    echo ""
    bash "$PHANTOMDIR/$SETUP" || die "$SETUP failed — fix the error above and run ./add-receiver.sh again."
    echo ""
fi
[ "$TYPE" = 2 ] && [[ ${RTL_V4:-n} =~ ^[Yy] ]] && { LABEL_DEF="RTL-SDR Blog V4"; RX_URL="https://www.rtl-sdr.com/v4/"; }

# ── 3. What it covers ────────────────────────────────────────────────────────
# Values the launcher and the template ship with, read as exact strings — a
# regex over the launcher's configuration block once matched the whole script.
read -r T_FREQ T_SPS T_MOD T_SHOW < <(python3 - "$PHANTOMDIR/$TEMPLATE" <<'PY'
import re, sys
sect, vals = "", {}
for line in open(sys.argv[1], encoding="utf-8"):
    s = line.split("#", 1)[0].strip()
    m = re.match(r"^\[([^\]]+)\]$", s)
    if m:
        sect = m.group(1); continue
    m = re.match(r"^(\w+)\s*=\s*(.+)$", s)
    if m:
        vals[(sect, m.group(1))] = m.group(2).strip().strip('"')
print(vals.get(("input", "frequency"), "0"), vals.get(("input", "sps"), "2048000"),
      vals.get(("input.defaults", "modulation"), "AM"),
      vals.get(("input.defaults", "frequency"), "7100000"))
PY
)

to_hz() {   # 145M, 145.5M, 1242k, 2400000 -> integer Hz
    python3 - "$1" <<'PY'
import sys
v = sys.argv[1].strip().replace(",", ".")
mult = {"k": 1e3, "K": 1e3, "m": 1e6, "M": 1e6, "g": 1e9, "G": 1e9}.get(v[-1:], 1)
if mult != 1: v = v[:-1]
try:
    hz = int(round(float(v) * mult))
except ValueError:
    sys.exit(1)
print(hz if hz >= 0 else sys.exit(1))
PY
}

echo ""
if [ "$DIRECT" = 1 ]; then
    FREQ=0
    echo "  Direct sampling: it covers 0 Hz up to half its sample rate; no tuning frequency."
else
    ask FREQ "Centre frequency (Hz, or e.g. 145M)" "$T_FREQ"
    FREQ="$(to_hz "$REPLY_VALUE")" || die "Not a frequency: $REPLY_VALUE"
fi
ask SPS "Sample rate (e.g. 2.4M)" "$T_SPS"
SPS="$(to_hz "$REPLY_VALUE")" || die "Not a sample rate: $REPLY_VALUE"
[ "$SPS" -gt 0 ] || die "The sample rate must be above 0."

if [ "$DIRECT" = 1 ]; then
    BASE=0; SPAN=$(( SPS / 2 )); MOD="$T_MOD"; SHOW="$T_SHOW"
else
    BASE=$(( FREQ - SPS / 2 )); [ "$BASE" -lt 0 ] && BASE=0
    SPAN="$SPS"; SHOW="$FREQ"
    if [ "$FREQ" -ge 87500000 ] && [ "$FREQ" -le 108000000 ]; then MOD="WBFM"
    elif [ "$FREQ" -gt 30000000 ]; then MOD="FM"
    else MOD="$T_MOD"; fi
fi

# A name that says what it covers, unique among the instances.
if   [ "$DIRECT" = 1 ] || [ "$FREQ" -lt 30000000 ]; then NAME_DEF="hf2"
elif [ "$FREQ" -lt 300000000 ]; then NAME_DEF="vhf"
elif [ "$FREQ" -lt 3000000000 ]; then NAME_DEF="uhf"
else NAME_DEF="rx2"; fi
n=2; base_name="$NAME_DEF"
while [ -e "instances/$NAME_DEF" ] || grep -qs "^id *= *\"$NAME_DEF\"" receivers.toml; do
    NAME_DEF="${base_name}${n}"; n=$(( n + 1 ))
done

ask NAME "Name for it (short, used in ?rx=<name>)" "$NAME_DEF"
NAME="$REPLY_VALUE"
case "$NAME" in
    ""|*[!A-Za-z0-9_-]*) die "The name may only contain letters, digits, - and _." ;;
    main) die "\"main\" is the main receiver's name; choose another." ;;
esac
[ -e "instances/$NAME" ] && die "instances/$NAME already exists. Choose another name, or remove that folder first."
grep -qs "^id *= *\"$NAME\"" receivers.toml && die "receivers.toml already has a receiver \"$NAME\"."

if [ "$DIRECT" = 1 ]; then LABEL_DEF2="$LABEL_DEF"
else LABEL_DEF2="$(python3 -c "import sys; f=int(sys.argv[1]); print(f'{f/1e6:g} MHz ({sys.argv[2]})')" "$FREQ" "$LABEL_DEF")"; fi
ask LABEL "Name on its button" "$LABEL_DEF2"
LABEL="$REPLY_VALUE"
ask ANTENNA "Its antenna (shown on its page)" "Antenna"
ANTENNA="$REPLY_VALUE"

# ── 4. Where it lives on the network ─────────────────────────────────────────
# Main receiver: its launcher, its config, its port.
main_launcher_guess() {
    local pid cfg l
    # A running main spectrumserver (no instance tag) names its config.
    local inst
    for pid in $(pgrep -x spectrumserver 2>/dev/null); do
        inst="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | sed -n 's/^PHANTOMSDR_INSTANCE=//p')"
        [ -n "$inst" ] && [ "$inst" != main ] && continue
        cfg="$(tr '\0' '\n' < "/proc/$pid/cmdline" | sed -n '/^--config$/{n;p}')"
        cfg="$(basename "$cfg" 2>/dev/null)"
        for l in start-*.sh; do
            [ "$l" = start-all.sh ] && continue
            grep -q "^CONFIG=\"\$PHANTOMDIR/$cfg\"" "$l" 2>/dev/null && { echo "$l"; return; }
        done
    done
    l="$(python3 -c "import json;print(json.load(open('admin_config.json')).get('start_script',''))" 2>/dev/null)"
    case "$l" in start-all.sh|"") ;; start-*.sh) [ -f "$l" ] && { echo "$l"; return; } ;; esac
    echo start-rx888mk2.sh
}

if [ ! -f receivers.toml ]; then
    echo ""
    ask MAIN_LAUNCHER "Which launcher starts your main receiver?" "$(main_launcher_guess)"
    MAIN_LAUNCHER="$REPLY_VALUE"
    case "$MAIN_LAUNCHER" in start-all.sh|*/*|"") die "Give the main receiver's own start-*.sh." ;; start-*.sh) ;; *) die "Not a launcher: $MAIN_LAUNCHER" ;; esac
    [ -f "$MAIN_LAUNCHER" ] || die "$MAIN_LAUNCHER not found."
fi

# toml_get FILE SECTION KEY
toml_get() {
    python3 - "$1" "$2" "$3" <<'PY'
import re, sys
f, want_s, want_k = sys.argv[1:4]
sect = ""
try:
    lines = open(f, encoding="utf-8")
except OSError:
    sys.exit(0)
for line in lines:
    s = line.split("#", 1)[0].strip()
    m = re.match(r"^\[([^\]]+)\]$", s)
    if m:
        sect = m.group(1); continue
    m = re.match(r"^(\w+)\s*=\s*(.+)$", s)
    if m and sect == want_s and m.group(1) == want_k:
        print(m.group(2).strip().strip('"')); break
PY
}

PROXY_PORT="$(python3 -c "import json;print(json.load(open('admin_config.json')).get('proxy_port',''))" 2>/dev/null)"

# Every port this computer already uses for PhantomSDR, plus anything listening.
used_ports() {
    python3 - <<'PY'
import glob, json, re
ports = set()
def scan(f):
    sect = ""
    try:
        for line in open(f, encoding="utf-8"):
            s = line.split("#", 1)[0].strip()
            m = re.match(r"^\[\[?([^\]]+)\]?\]$", s)
            if m: sect = m.group(1); continue
            m = re.match(r"^(\w+)\s*=\s*(\d+)$", s)
            if m and m.group(1) == "port" and sect in ("server", "receiver"):
                ports.add(int(m.group(2)))
    except OSError:
        pass
for f in glob.glob("config*.toml") + glob.glob("instances/*/config.toml") + ["receivers.toml"]:
    scan(f)
try:
    for k in ("port", "proxy_port", "public_port"):
        v = json.load(open("admin_config.json")).get(k)
        if v: ports.add(int(v))
except Exception:
    pass
print(" ".join(map(str, sorted(ports))))
PY
    ss -ltnH 2>/dev/null | awk '{print $4}' | sed 's/.*://'
}
USED=" $(used_ports | tr '\n' ' ') "
PORT=9002
while [[ $USED == *" $PORT "* ]]; do PORT=$(( PORT + 1 )); done

# The station's public address, for the links the picker uses.
HOST_DEF=""
if [ -n "${MAIN_LAUNCHER:-}" ]; then
    MAIN_CONFIG="$(sed -n 's/^CONFIG="\$PHANTOMDIR\/\(.*\)"$/\1/p' "$MAIN_LAUNCHER" | head -1)"
else
    MAIN_CONFIG=""
fi
for f in $MAIN_CONFIG config-rx888mk2.toml config.toml; do
    [ -f "$f" ] || continue
    h="$(toml_get "$f" websdr hostname)"
    case "$h" in ""|*" "*) ;; *) HOST_DEF="$h"; break ;; esac
done
[ -n "$HOST_DEF" ] || HOST_DEF="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
ask HOST "This station's public address (host name or IP)" "${HOST_DEF:-localhost}"
# Just the name: the links below add http:// and the port themselves, so a
# pasted address ("http://my.host:8900/") would otherwise become
# "http://http://my.host:8900/:8899" — and the receiver picker then fetches an
# address that does not exist and shows no buttons.
HOST="$(printf '%s' "$REPLY_VALUE" | tr -d '[:space:]')"
HOST="${HOST#*://}"      # scheme, whatever it is
HOST="${HOST%%/*}"       # path and trailing slash
case "$HOST" in
    \[*\]*) HOST="${HOST%%]*}]" ;;   # [IPv6]:port -> [IPv6]
    *:*:*) ;;                        # bare IPv6: leave it alone
    *:*) HOST="${HOST%%:*}" ;;       # host:port -> host
esac
[ -n "$HOST" ] || die "No address given."
[ "$HOST" = "$REPLY_VALUE" ] || echo "  → using \"$HOST\""

if [ -n "$PROXY_PORT" ]; then
    BIND_HOST="127.0.0.1"
    RX_PUBLIC_URL="http://$HOST:$PROXY_PORT/?rx=$NAME"
    LIST_URL="http://$HOST:$PROXY_PORT/receivers.json"
    SITE_IP="http://$HOST:$PROXY_PORT"
else
    warn "No proxy found (proxy_port in admin_config.json). proxy.py comes with the admin"
    warn "panel (setup_admin.sh); without it this receiver is published on its own port"
    warn "$PORT and the page has no receiver picker."
    BIND_HOST=""
    RX_PUBLIC_URL="http://$HOST:$PORT/"
    LIST_URL=""
    SITE_IP="http://$HOST:$PORT"
fi

# ── 5. Write the instance ────────────────────────────────────────────────────
INST="instances/$NAME"
echo ""
blue "Creating $INST/ ..."
mkdir -p "$INST/www" "$INST/logs"

# The launcher's own arguments, with -f and -s set to the answers above.
args_from_launcher() {   # $1 = variable name in the launcher
    python3 - "$PHANTOMDIR/$LAUNCHER" "$1" "$FREQ" "$SPS" "$DIRECT" <<'PY'
import re, sys
path, var, freq, sps, direct = sys.argv[1:6]
text = open(path, encoding="utf-8").read()
for prefix in (var + '="${' + var + ':-', var + '="'):
    i = text.find("\n" + prefix)
    if i < 0:
        continue
    j = i + 1 + len(prefix)
    end = text.find("\n", j)
    line = text[j:end].rstrip()
    line = line[:-2] if line.endswith('}"') else line[:-1] if line.endswith('"') else line
    if direct != "1":
        line = re.sub(r"(-f\s+)\S+", r"\g<1>" + freq, line)
    line = re.sub(r"(-s\s+)\S+", r"\g<1>" + sps, line)
    print(line)
    break
PY
}

{
    echo "# Read by $LAUNCHER when started as INSTANCE=$NAME, after its own settings."
    echo "# Written by add-receiver.sh. -f and -s must match frequency= and sps= in"
    if [ "$TYPE" = 2 ]; then
        echo "# config.toml. -g is a FIXED tuner gain (automatic gain cannot be"
        echo "# calibrated); the S-meter offsets in config.toml were measured at"
        echo "# -g $RTL_CAL_GAIN, so recalibrate them if you change it. Then restart:"
        echo "#   INSTANCE=$NAME ./$LAUNCHER"
    else
        echo "# config.toml; the gain and other options are the launcher's defaults —"
        echo "# change them here, then restart:  INSTANCE=$NAME ./$LAUNCHER"
    fi
    if [ "$ARGS_VAR" = RSP1A ]; then
        echo "RX_ARGS_MIRI=\"$(args_from_launcher RX_ARGS_MIRI)\""
        echo "RX_ARGS_SDRPLAY=\"$(args_from_launcher RX_ARGS_SDRPLAY)\""
    else
        ARGS_LINE="$(args_from_launcher "$ARGS_VAR")"
        # An RTL-SDR left on the tuner's automatic gain moves its level with
        # every signal, and no S-meter offset can calibrate that. A fixed gain
        # goes in, matching the calibration written into config.toml below.
        if [ "$TYPE" = 2 ] && [[ " $ARGS_LINE " != *" -g "* ]]; then
            ARGS_LINE="${ARGS_LINE% -} -g $RTL_CAL_GAIN -"
        fi
        echo "$ARGS_VAR=\"$ARGS_LINE\""
    fi
    # Keep a second receiver off the cores the main one is pinned to: the
    # launchers pin to the lower cores and leave the top few free.
    NPROC="$(nproc 2>/dev/null || echo 0)"
    if [ "$NPROC" -ge 8 ]; then
        echo "SPECTRUM_CORES=$(( NPROC - 4 ))-$(( NPROC - 1 ))   # the top cores"
    fi
} > "$INST/instance.env"

python3 - "$TEMPLATE" "$INST/config.toml" "$PORT" "$BIND_HOST" "$FREQ" "$SPS" "$SHOW" "$MOD" "$LABEL" "$ANTENNA" "$HOST" "$TYPE" "$RTL_CAL_GAIN" <<'PY'
import re, sys
src, dst, port, bind, freq, sps, show, mod, label, antenna, host, rtype, gain = sys.argv[1:14]
lines = open(src, encoding="utf-8").read().split("\n")

def section_range(name):
    start = None
    for i, l in enumerate(lines):
        m = re.match(r"^\s*\[([^\]]+)\]\s*(#.*)?$", l)
        if m:
            if start is not None:
                return start, i
            if m.group(1) == name:
                start = i
    return (start, len(lines)) if start is not None else (None, None)

def set_key(sect, key, value, comment=""):
    a, b = section_range(sect)
    if a is None:
        return False
    new = f"{key}={value}" + (f" # {comment}" if comment else "")
    for i in range(a + 1, b):
        if re.match(rf"^\s*{key}\s*=", lines[i]):
            lines[i] = new
            return True
    lines.insert(a + 1, new)
    return True

q = lambda s: '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
set_key("server", "html_fallback_root", q("../../frontend/dist/"), "the shared page for everything not in www/")
set_key("server", "html_root", q("www/"), "this receiver's own page files")
if bind:
    set_key("server", "host", q(bind), "reachable only through proxy.py (receivers.toml)")
set_key("server", "port", port, "internal port of this receiver")
set_key("input", "sps", sps, "must match -s in instance.env")
set_key("input", "frequency", freq, "must match -f in instance.env")
set_key("input.defaults", "frequency", show, "frequency shown first")
set_key("input.defaults", "modulation", q(mod))
set_key("websdr", "register_online", "false", "a directory listing of its own: give it its own name first")
set_key("websdr", "name", q(label))
set_key("websdr", "antenna", q(antenna))
set_key("websdr", "hostname", q(host))
set_key("websdr.org", "enabled", "false", "one websdr.org entry per public port")
# Kiwi clients dial a bare address and port: through the proxy they always
# reach the default receiver, so a second one never answers them.
set_key("kiwi_emulation", "enabled", "false", "Kiwi clients cannot choose a receiver")
if rtype == "2":
    # A starting calibration rather than none: measured on an RTL-SDR Blog V4
    # at -g 29.7 with a -71 dBm signal. Sticks of one model at one gain read
    # within a few dB of each other; without it the meter reads ~70 dB high.
    set_key("input", "analog_smeter_offset", "-55",
            f"analog needle + dBm figures; calibrated on an RTL-SDR Blog V4 at -g {gain} with -71 dBm: check yours")
    set_key("input", "smeter_offset", "-38",
            f"digital bar (about 1.5 dB per step); same calibration as above")
open(dst, "w", encoding="utf-8").write("\n".join(lines))
PY
[ -f "$INST/config.toml" ] || die "Could not write $INST/config.toml."

echo '{ "markers": [] }' > "$INST/markers.json"
if [ -f frontend/dist/wf-message.json ]; then cp frontend/dist/wf-message.json "$INST/www/"
else echo '{"text": "", "color": "#ffffff"}' > "$INST/www/wf-message.json"; fi

SITE_SRC=frontend/site_information.json
[ -f "$SITE_SRC" ] || SITE_SRC=frontend/dist/site_information.json
python3 - "$SITE_SRC" "$INST/www/site_information.json" "$NAME" "$LABEL" "$ANTENNA" "$RX_URL" "$BASE" "$SPAN" "$SITE_IP" "$LIST_URL" <<'PY'
import json, sys
src, dst, name, label, antenna, rx_url, base, span, site_ip, list_url = sys.argv[1:11]
try:
    d = json.load(open(src, encoding="utf-8"))
except Exception:
    d = {}
d.update({
    "siteReceiver": label, "siteReceiverURL": rx_url,
    "siteAntenna": antenna, "siteAntennaURL": "",
    "siteSDRBaseFrequency": int(base), "siteSDRBandwidth": int(span),
    "siteReceiverId": name, "siteIP": site_ip,
})
if list_url:
    d["siteReceiversList"] = list_url
else:
    # No proxy, no list — and never someone else's, copied from a template.
    d.pop("siteReceiversList", None)
json.dump(d, open(dst, "w", encoding="utf-8"), indent="\t", ensure_ascii=False)
open(dst, "a").write("\n")
PY
echo '[]' > "$INST/www/users.json"
green "✅ $INST/  (config.toml, instance.env, markers.json, www/)"

# ── 6. receivers.toml ────────────────────────────────────────────────────────
if [ ! -f receivers.toml ]; then
    MAIN_PORT="$(toml_get "$MAIN_CONFIG" server port)"
    [ -n "$MAIN_PORT" ] || die "No [server] port in $MAIN_CONFIG."
    MAIN_LABEL="$(python3 -c "import json;print(json.load(open('frontend/site_information.json')).get('siteReceiver',''))" 2>/dev/null)"
    [ -n "$MAIN_LABEL" ] || MAIN_LABEL="Main receiver"
    {
        echo "# Receivers on this computer — read by proxy.py and start-all.sh."
        echo "# Written by add-receiver.sh; see receivers.toml.example and"
        echo "# docs/MULTI_RECEIVER.md. Restart the proxy after editing:"
        echo "#   sudo systemctl restart phantomsdr-proxy"
        echo ""
        echo "[[receiver]]"
        echo "id       = \"main\""
        echo "name     = \"$MAIN_LABEL\""
        echo "port     = $MAIN_PORT"
        echo "default  = true"
        echo "launcher = \"$MAIN_LAUNCHER\""
        echo "url      = \"http://$HOST:$MAIN_PORT/\""
    } > receivers.toml
    green "✅ receivers.toml created, with your main receiver ($MAIN_LAUNCHER, port $MAIN_PORT)"
fi
{
    echo ""
    echo "[[receiver]]"
    echo "id       = \"$NAME\""
    echo "name     = \"${LABEL//\"/\\\"}\""
    echo "port     = $PORT"
    echo "launcher = \"$LAUNCHER\""
    echo "instance = \"$NAME\""
    echo "url      = \"$RX_PUBLIC_URL\""
} >> receivers.toml
python3 -c "import tomllib;tomllib.load(open('receivers.toml','rb'))" 2>/dev/null \
    || die "receivers.toml does not parse after the edit — check it by hand."
green "✅ receivers.toml: \"$NAME\" on port $PORT"

# ── 7. Optional steps ────────────────────────────────────────────────────────
echo ""
if [ -n "$LIST_URL" ] && ! grep -qs '"siteReceiversList"' frontend/site_information.json; then
    echo "The main receiver's page is served by its own server, not by the proxy,"
    echo "so it shows the receiver picker only once its site_information.json says"
    echo "where the list is — which takes a rebuild of the web page."
    if ask_yn PICKER_MAIN y "Add the picker to the main page and rebuild the web page now?"; then
        python3 - frontend/site_information.json "$LIST_URL" <<'PY'
import json, sys
p, url = sys.argv[1:3]
raw = open(p, encoding="utf-8").read()
d = json.loads(raw)
d["siteReceiversList"] = url
json.dump(d, open(p, "w", encoding="utf-8"), indent="\t" if "\n\t" in raw else 2, ensure_ascii=False)
open(p, "a").write("\n")
PY
        if [ -x frontend/build-all.sh ]; then
            ( cd frontend && ./build-all.sh ) || warn "The web page build failed — run ./recompile.sh (frontend) later."
        else
            warn "frontend/build-all.sh not found — run ./recompile.sh (frontend) later."
        fi
    fi
    echo ""
fi

if [ -f admin_config.json ]; then
    CUR="$(python3 -c "import json;print(json.load(open('admin_config.json')).get('start_script',''))" 2>/dev/null)"
    if [ "$CUR" != start-all.sh ]; then
        echo "The admin panel's Restart and the thermal guard start \"${CUR:-nothing}\" —"
        echo "only that receiver would come back after a restart."
        if ask_yn ADMIN y "Set the admin panel's start script to start-all.sh?"; then
            python3 - <<'PY'
import json
p = "admin_config.json"
d = json.load(open(p))
d["start_script"] = "start-all.sh"
json.dump(d, open(p, "w"), indent=2)
PY
            green "✅ admin panel start script: start-all.sh"
        fi
        echo ""
    fi
fi

STARTED=n
if ask_yn START y "Start the new receiver now?"; then
    INSTANCE="$NAME" "$PHANTOMDIR/$LAUNCHER" -q && STARTED=y
fi

PROXY_DONE=n
if [ -n "$PROXY_PORT" ]; then
    echo ""
    if systemctl cat phantomsdr-proxy >/dev/null 2>&1; then
        if ask_yn PROXY y "Restart the proxy now so it routes to \"$NAME\" (sudo)?"; then
            sudo systemctl restart phantomsdr-proxy && PROXY_DONE=y \
                || warn "The proxy did not restart — run: sudo systemctl restart phantomsdr-proxy"
        fi
    else
        warn "No phantomsdr-proxy service found — restart proxy.py the way you run it."
    fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
blue "══════════════════════════════════════════════════════════════════════"
green "  Receiver \"$NAME\" added — $LABEL"
blue "══════════════════════════════════════════════════════════════════════"
echo "  Its page:        $RX_PUBLIC_URL"
echo "  Its folder:      $INST/   (config.toml, instance.env for gain and options)"
echo "  Start/restart:   INSTANCE=$NAME ./$LAUNCHER$([ "$STARTED" = y ] && echo '   (started)')"
echo "  Stop only it:    ./stop-websdr.sh $NAME"
echo "  Start them all:  ./start-all.sh"
echo "  Its log:         logwebsdr-$NAME.txt"
[ -n "$PROXY_PORT" ] && [ "$PROXY_DONE" != y ] \
    && yellow "  Then:            sudo systemctl restart phantomsdr-proxy   (so the proxy knows it)"
[ "$TYPE" = 2 ] && yellow "  Two sticks of the same model? Give each its own serial (rtl_eeprom -s) and
                   add  -d <serial>  to RX_ARGS in $INST/instance.env."
echo "  Guide:           docs/MULTI_RECEIVER.md"
echo ""
