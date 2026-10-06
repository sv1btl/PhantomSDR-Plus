#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  configure-station.sh
#  The station wizard: a handful of questions, and every file that has to
#  agree with every other one is written from the same answers.
#
#  Before it, the receiver's frequency and sample rate had to be typed into
#  three places by hand (the .toml, the start script and
#  site_information.json), the ports into three more, and one wrong number
#  showed up only as a waterfall on the wrong frequencies. Now the answers are
#  kept in ONE file, station.conf, and everything else is derived from it:
#
#    station.conf                    the answers (start scripts and proxy.py
#                                    read it directly)
#    config-<receiver>.toml          port, sample rate, frequency, directory
#                                    listings, websdr.org registration
#    frontend/site_information.json  what visitors see, and where the page
#                                    finds RADE, statistics and the relay
#    websdr_relay.json               the relay's port (if the relay is on)
#
#  Only the keys the wizard owns are changed. Anything else in those files —
#  a hand-tuned fft_size, an extra comment — is left exactly as it was, and
#  each file is copied to <name>.bak-<date> before it is touched.
#
#  Usage:
#    bash configure-station.sh            ask, save station.conf, write the files
#    bash configure-station.sh --ask      ask and save station.conf only
#    bash configure-station.sh --apply    write the files from station.conf only
#    bash configure-station.sh --show     print the current answers
#
#  Run it again at any time: the previous answers are the defaults, so ENTER
#  through everything keeps them. After a change, rebuild the web page and
#  restart the receiver (the wizard says when that is needed).
#
#  install.sh runs --ask before it installs anything and --apply once Python
#  is there, so a new station answers every question in the first two minutes
#  and is left alone after that.
#
#  UNATTENDED USE
#  Every answer can be given in the environment instead (same names as in
#  station.conf, e.g. STATION_RECEIVER=rtl STATION_CALLSIGN=SV1XYZ), and with
#  PHANTOM_NONINTERACTIVE=1 — assumed when stdin is not a terminal — every
#  question takes its default without asking.
#
#  PORTS (a new station)
#    9000  the ONE public port: proxy.py, which serves the receiver page and
#          carries /admin, /rade, /stats and /relay to the services below
#    9001  spectrumserver            9010  admin panel   9011  statistics
#    9012  RADE sidecar              9013  WebSDR relay
#  A port already taken on this computer is skipped for the next free one.
# ─────────────────────────────────────────────────────────────────────────────

if [ -z "${BASH_VERSINFO[0]}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    echo "This script needs bash 4 or newer — run it as: bash configure-station.sh" >&2
    exit 1
fi

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATION_CONF="$PHANTOMDIR/station.conf"

MODE="all"
case "${1:-}" in
    "")       MODE="all" ;;
    --ask)    MODE="ask" ;;
    --apply)  MODE="apply" ;;
    --show)   MODE="show" ;;
    -h|--help)
        n=0
        while IFS= read -r line; do
            n=$((n + 1))
            [ "$n" -le 2 ] && continue
            [[ $line == "# ─"* ]] && break
            line="${line#\#}"; line="${line# }"; line="${line# }"
            printf '%s\n' "$line"
        done < "$0"
        exit 0 ;;
    *)  echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
esac

# ── output helpers ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
    B=$'\033[1m'; DIM=$'\033[90m'; G=$'\033[1;32m'; Y=$'\033[1;33m'; R=$'\033[1;31m'; C=$'\033[1;36m'; N=$'\033[0m'
else
    B=""; DIM=""; G=""; Y=""; R=""; C=""; N=""
fi
say()  { printf '%s\n' "$*"; }
ok()   { printf '  %s✔%s %s\n' "$G" "$N" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '  %s✖%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
title() { printf '\n%s── %s %s\n' "$C" "$*" "$N"; }

PHANTOM_NONINTERACTIVE="${PHANTOM_NONINTERACTIVE:-0}"
if [ "$PHANTOM_NONINTERACTIVE" != "1" ] && [ ! -t 0 ]; then
    PHANTOM_NONINTERACTIVE=1
fi

# ── the answers: environment > station.conf > built-in default ───────────────
# Everything the wizard asks lives in these variables. Values given in the
# environment are remembered before station.conf is read, so they win.
VARS=(STATION_RECEIVER STATION_LAUNCHER STATION_CONFIG STATION_RTL_V4
      STATION_PRESET STATION_FREQ STATION_SPS STATION_DEFAULT_FREQ STATION_MODULATION
      STATION_CALLSIGN STATION_NAME STATION_EMAIL STATION_LOCATOR STATION_CITY
      STATION_ANTENNA STATION_HARDWARE STATION_REGION
      STATION_PUBLIC_HOST STATION_SDR_LIST STATION_WEBSDR_ORG
      PORT_PUBLIC PORT_SDR PORT_ADMIN PORT_STATS PORT_RADE PORT_RELAY
      STATION_ADMIN STATION_RADE STATION_STATS STATION_RELAY STATION_AUTOSTART
      STATION_ACCELERATOR)
declare -A FROM_ENV=()
for v in "${VARS[@]}"; do
    [ -n "${!v+x}" ] && FROM_ENV[$v]="${!v}"
done
if [ -f "$STATION_CONF" ]; then
    # shellcheck disable=SC1090
    . "$STATION_CONF"
fi
SAVED_RECEIVER="${STATION_RECEIVER:-}"      # before the environment overrides it
for v in "${!FROM_ENV[@]}"; do
    printf -v "$v" '%s' "${FROM_ENV[$v]}"
done

if [ "$MODE" = "show" ]; then
    [ -f "$STATION_CONF" ] || die "no station.conf yet — run: bash configure-station.sh"
    while IFS= read -r line; do
        [[ $line =~ ^[[:space:]]*(#|$) ]] || printf '%s\n' "$line"
    done < "$STATION_CONF"
    exit 0
fi

# ── receivers ────────────────────────────────────────────────────────────────
# id | menu label | launcher | config | signal | USB ids (for detection)
RX_IDS=(rx888mk2 rtl rsp1a airspyhf hackrf fobos fobos-hf)
declare -A RX_LABEL=(
    [rx888mk2]="RX888 MkII / RX888"
    [rtl]="RTL-SDR (incl. RTL-SDR Blog V4)"
    [rsp1a]="SDRplay RSP1A"
    [airspyhf]="Airspy HF+"
    [hackrf]="HackRF One"
    [fobos]="RigExpert Fobos SDR — RF (50 MHz – 6 GHz)"
    [fobos-hf]="RigExpert Fobos SDR — HF direct sampling (0 – 25 MHz)"
)
declare -A RX_NAME=(
    [rx888mk2]="RX888 MkII" [rtl]="RTL-SDR" [rsp1a]="SDRplay RSP1A"
    [airspyhf]="Airspy HF+" [hackrf]="HackRF One" [fobos]="RigExpert Fobos SDR"
    [fobos-hf]="RigExpert Fobos SDR"
)
declare -A RX_SIGNAL=(
    [rx888mk2]=real [rtl]=iq [rsp1a]=iq [airspyhf]=iq [hackrf]=iq [fobos]=iq [fobos-hf]=real
)
declare -A RX_USB=(
    [rx888mk2]="04b4:00f1 04b4:00f3"
    [rtl]="0bda:2838 0bda:2832"
    [rsp1a]="1df7:3000 1df7:2500 1df7:3010"
    [airspyhf]="03eb:800c"
    [hackrf]="1d50:6089 1d50:604b 1d50:cc15"
    [fobos]="16d0:132e"
)

# Band presets per receiver:  label | centre Hz | sample rate | start freq | mode
# For a real-sampling receiver (RX888, Fobos HF) the centre is 0 and the page
# covers 0 … sample rate / 2.
presets_for() {
    case "$1" in
        rx888mk2) printf '%s\n' \
            "HF 0 – 30 MHz (60 Msps, the usual RX888 setup)|0|60000000|7120000|LSB" ;;
        fobos-hf) printf '%s\n' \
            "HF 0 – 25 MHz (50 Msps direct sampling)|0|50000000|7100000|LSB" ;;
        rtl) printf '%s\n' \
            "2 m amateur band (144 – 146 MHz)|145000000|2048000|145500000|FM" \
            "70 cm amateur band (433 – 435 MHz)|434000000|2048000|433500000|FM" \
            "Medium wave broadcast (direct sampling, around 1.2 MHz)|1242000|2048000|1170000|AM" ;;
        rsp1a) printf '%s\n' \
            "160 m – 40 m (0 – 8 MHz)|4000000|8000000|3645000|LSB" \
            "40 m – 20 m (7 – 15 MHz)|11000000|8000000|7100000|LSB" \
            "20 m – 10 m (21 – 29 MHz)|25000000|8000000|28500000|USB" ;;
        airspyhf) printf '%s\n' \
            "40 m (6.6 – 7.6 MHz)|7100000|912000|7100000|LSB" \
            "80 m (3.2 – 4.1 MHz)|3650000|912000|3650000|LSB" \
            "Medium wave broadcast (0.5 – 1.5 MHz)|1000000|912000|648000|AM" ;;
        hackrf|fobos) printf '%s\n' \
            "FM broadcast (88 – 108 MHz)|98000000|20000000|92400000|WBFM" \
            "Air band + 2 m (127 – 147 MHz)|137000000|20000000|145500000|FM" ;;
    esac
}

# ── asking ───────────────────────────────────────────────────────────────────
# Every question shows its default; ENTER takes it. Unattended, the default is
# taken without asking.
ask() {           # ask <VAR> <question> [default]
    local var="$1" q="$2" def="${3-}" ans
    [ -n "${!var:-}" ] && def="${!var}"
    if [ -n "${FROM_ENV[$var]+x}" ] || [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        printf -v "$var" '%s' "$def"
        printf '  %s %s→ %s%s\n' "$q" "$DIM" "${def:-(empty)}" "$N"
        return
    fi
    if [ -n "$def" ]; then
        read -r -p "  $q [$def]: " ans
    else
        read -r -p "  $q: " ans
    fi
    ans="${ans#"${ans%%[![:space:]]*}"}"; ans="${ans%"${ans##*[![:space:]]}"}"
    printf -v "$var" '%s' "${ans:-$def}"
}

ask_yn() {        # ask_yn <VAR> <question> <default y|n>
    local var="$1" q="$2" def="$3" ans hint
    [ -n "${!var:-}" ] && def="${!var}"
    if [ -n "${FROM_ENV[$var]+x}" ] || [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        [[ $def =~ ^[Yy] ]] && def=y || def=n
        printf -v "$var" '%s' "$def"
        printf '  %s %s→ %s%s\n' "$q" "$DIM" "$([ "$def" = y ] && echo Yes || echo No)" "$N"
        return
    fi
    if [[ $def =~ ^[Yy] ]]; then hint="${G}Y${N}/n"; else hint="y/${R}N${N}"; fi
    while true; do
        printf '  %s [%s]: ' "$q" "$hint"
        read -r ans
        ans="${ans:-$def}"
        case "$ans" in
            [Yy]*) printf -v "$var" y; return ;;
            [Nn]*) printf -v "$var" n; return ;;
        esac
    done
}

ask_menu() {      # ask_menu <VAR> <question> <default number> <count>
    local var="$1" q="$2" def="$3" count="$4" ans
    if [ -n "${FROM_ENV[$var]+x}" ] || [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        printf -v "$var" '%s' "$def"
        printf '  %s %s→ %s%s\n' "$q" "$DIM" "$def" "$N"
        return
    fi
    while true; do
        read -r -p "  $q [$def]: " ans
        ans="${ans:-$def}"
        if [[ $ans =~ ^[0-9]+$ ]] && [ "$ans" -ge 1 ] && [ "$ans" -le "$count" ]; then
            printf -v "$var" '%s' "$ans"; return
        fi
        warn "Please answer with a number from 1 to $count."
    done
}

# A frequency typed as 7.1M, 7100k, 7100000 or 7.1 (MHz when it has a point
# and is small) → Hz. Prints nothing for something it cannot read.
to_hz() {
    local v="${1// /}" mul=1 num
    v="${v,,}"; v="${v%hz}"
    case "$v" in
        *g) mul=1000000000; v="${v%g}" ;;
        *m) mul=1000000;    v="${v%m}" ;;
        *k) mul=1000;       v="${v%k}" ;;
    esac
    [[ $v =~ ^[0-9]+(\.[0-9]+)?$ ]] || return 0
    if [ "$mul" = 1 ] && [[ $v == *.* ]]; then mul=1000000; fi
    # Pure bash (the wizard runs before any package is installed, and a bare
    # openSUSE has no awk): shift the decimal point by the multiplier's zeros.
    local int="${v%%.*}" frac="" zeros="${mul#1}"
    [[ $v == *.* ]] && frac="${v#*.}"
    while [ "${#frac}" -lt "${#zeros}" ]; do frac="${frac}0"; done
    frac="${frac:0:${#zeros}}"                # anything below 1 Hz is dropped
    num="${int}${frac}"
    num="${num#"${num%%[!0]*}"}"
    printf '%s' "${num:-0}"
}

port_busy() {     # 0 = something already listens on 127.0.0.1:$1
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# The first port from $1 upwards that is free and not already handed out.
declare -A TAKEN=()
next_free_port() {
    local p="$1"
    while [ "$p" -le 65535 ]; do
        if [ -z "${TAKEN[$p]:-}" ] && ! port_busy "$p"; then
            printf '%s' "$p"; return
        fi
        p=$((p + 1))
    done
}

# Suggest a port: the saved one is kept (even while our own service holds it),
# otherwise the first free one from the map's default upwards.
suggest_port() {  # suggest_port <VAR> <map default>
    local var="$1" def="$2" p
    p="${!var:-}"
    if [ -z "$p" ] || [ -n "${TAKEN[$p]:-}" ]; then
        p="$(next_free_port "$def")"
    fi
    TAKEN[$p]=1
    printf -v "$var" '%s' "$p"
}

detect_receiver() {
    command -v lsusb >/dev/null 2>&1 || return 0
    local ids id rx
    local -A present=()
    local _bus _b _dev _d _id idv _rest
    while read -r _bus _b _dev _d _id idv _rest; do
        [ -n "${idv:-}" ] && present[${idv,,}]=1
    done < <(lsusb 2>/dev/null)
    for rx in rx888mk2 rtl rsp1a airspyhf hackrf fobos; do
        for id in ${RX_USB[$rx]}; do
            if [ -n "${present[$id]:-}" ]; then printf '%s' "$rx"; return; fi
        done
    done
}

# Maidenhead locator → ITU region (1 Europe/Africa/Middle East/Russia,
# 2 the Americas, 3 Asia-Pacific). Only a suggestion; the sysop confirms it.
region_from_locator() {
    local loc="${1^^}" lon lat
    [[ $loc =~ ^[A-R][A-R][0-9][0-9] ]] || { printf 1; return; }
    lon=$(( ( $(printf '%d' "'${loc:0:1}") - 65 ) * 20 + ${loc:2:1} * 2 - 180 ))
    lat=$(( ( $(printf '%d' "'${loc:1:1}") - 65 ) * 10 + ${loc:3:1} - 90 ))
    if [ "$lon" -lt -30 ]; then printf 2
    elif [ "$lon" -ge 60 ] && [ "$lat" -lt 50 ]; then printf 3
    elif [ "$lon" -ge 100 ]; then printf 3
    else printf 1
    fi
}

# ── save ─────────────────────────────────────────────────────────────────────
q() {             # a value as a double-quoted shell word
    local v="$1"
    v="${v//\\/\\\\}"; v="${v//\"/\\\"}"; v="${v//\$/\\\$}"; v="${v//\`/\\\`}"
    printf '"%s"' "$v"
}

save_conf() {
    local tmp="$STATION_CONF.tmp.$$"
    {
        echo "# PhantomSDR-Plus station settings — written by configure-station.sh"
        echo "# on $(date '+%Y-%m-%d %H:%M'). Run 'bash configure-station.sh' to change"
        echo "# them; editing by hand works too, then run it with --apply."
        echo "# The start scripts and proxy.py read this file directly."
        echo ""
        echo "# Receiver"
        echo "STATION_RECEIVER=$(q "$STATION_RECEIVER")"
        echo "STATION_LAUNCHER=$(q "$STATION_LAUNCHER")"
        echo "STATION_CONFIG=$(q "$STATION_CONFIG")"
        echo "STATION_RTL_V4=$(q "${STATION_RTL_V4:-n}")"
        echo "STATION_PRESET=$(q "$STATION_PRESET")"
        echo "STATION_FREQ=$(q "$STATION_FREQ")              # Hz, centre (0 = real sampling)"
        echo "STATION_SPS=$(q "$STATION_SPS")                # samples per second"
        echo "STATION_DEFAULT_FREQ=$(q "$STATION_DEFAULT_FREQ")  # where a new visitor starts"
        echo "STATION_MODULATION=$(q "$STATION_MODULATION")"
        echo ""
        echo "# Station"
        echo "STATION_CALLSIGN=$(q "$STATION_CALLSIGN")"
        echo "STATION_NAME=$(q "$STATION_NAME")"
        echo "STATION_EMAIL=$(q "$STATION_EMAIL")"
        echo "STATION_LOCATOR=$(q "$STATION_LOCATOR")"
        echo "STATION_CITY=$(q "$STATION_CITY")"
        echo "STATION_ANTENNA=$(q "$STATION_ANTENNA")"
        echo "STATION_HARDWARE=$(q "$STATION_HARDWARE")"
        echo "STATION_REGION=$(q "$STATION_REGION")"
        echo ""
        echo "# Internet"
        echo "STATION_PUBLIC_HOST=$(q "$STATION_PUBLIC_HOST")"
        echo "STATION_SDR_LIST=$(q "$STATION_SDR_LIST")"
        echo "STATION_WEBSDR_ORG=$(q "$STATION_WEBSDR_ORG")"
        echo ""
        echo "# Ports — only PORT_PUBLIC has to be open on the router"
        echo "PORT_PUBLIC=$PORT_PUBLIC"
        echo "PORT_SDR=$PORT_SDR"
        echo "PORT_ADMIN=$PORT_ADMIN"
        echo "PORT_STATS=$PORT_STATS"
        echo "PORT_RADE=$PORT_RADE"
        echo "PORT_RELAY=$PORT_RELAY"
        echo ""
        echo "# Extras (y/n)"
        echo "STATION_ADMIN=$(q "$STATION_ADMIN")"
        echo "STATION_RADE=$(q "$STATION_RADE")"
        echo "STATION_STATS=$(q "$STATION_STATS")"
        echo "STATION_RELAY=$(q "$STATION_RELAY")"
        echo "STATION_AUTOSTART=$(q "$STATION_AUTOSTART")"
        if [ -n "${STATION_ACCELERATOR:-}" ]; then
            echo ""
            echo "# Set by the installer from what this computer has (opencl or none)"
            echo "STATION_ACCELERATOR=$(q "$STATION_ACCELERATOR")"
        fi
    } > "$tmp" && mv "$tmp" "$STATION_CONF" || die "could not write $STATION_CONF"
}

# ═════════════════════════════════════════════════════════════════════════════
#  THE QUESTIONS
# ═════════════════════════════════════════════════════════════════════════════
ask_everything() {
    say ""
    say "${B}PhantomSDR-Plus — station setup${N}"
    say "A few questions about your receiver and your station. ENTER takes the"
    say "value in [brackets]; you can run this again at any time to change them."

    # ── 1. receiver ──────────────────────────────────────────────────────────
    title "1/5  Receiver"
    local found def_n i n=0 choice
    found="$(detect_receiver)"
    def_n=2
    for i in "${!RX_IDS[@]}"; do
        n=$((i + 1))
        local mark=""
        if [ "${RX_IDS[$i]}" = "${STATION_RECEIVER:-}" ]; then def_n=$n
        elif [ -z "${STATION_RECEIVER:-}" ] && [ "${RX_IDS[$i]}" = "$found" ]; then def_n=$n
        fi
        [ "${RX_IDS[$i]}" = "$found" ] && mark="  ${G}← plugged in${N}"
        printf '   %d) %s%s\n' "$n" "${RX_LABEL[${RX_IDS[$i]}]}" "$mark"
    done
    if [ -n "${FROM_ENV[STATION_RECEIVER]+x}" ]; then
        for i in "${!RX_IDS[@]}"; do
            [ "${RX_IDS[$i]}" = "$STATION_RECEIVER" ] && def_n=$((i + 1))
        done
        FROM_ENV[RX_CHOICE]=1
    fi
    RX_CHOICE=""
    ask_menu RX_CHOICE "Which receiver?" "$def_n" "${#RX_IDS[@]}"
    choice="${RX_IDS[$((RX_CHOICE - 1))]}"
    if [ "$choice" != "$SAVED_RECEIVER" ]; then
        # Another receiver: the old band and rate do not apply to it (but
        # anything given in the environment for this run still does).
        local v
        for v in STATION_PRESET STATION_FREQ STATION_SPS STATION_DEFAULT_FREQ STATION_MODULATION; do
            [ -n "${FROM_ENV[$v]+x}" ] || printf -v "$v" '%s' ""
        done
    fi
    STATION_RECEIVER="$choice"
    STATION_LAUNCHER="start-$choice.sh"
    STATION_CONFIG="config-$choice.toml"
    if [ "$choice" = rtl ]; then
        ask_yn STATION_RTL_V4 "Is it an RTL-SDR Blog V4 (needs its own driver)?" n
    else
        STATION_RTL_V4=n
    fi

    # ── 2. band ──────────────────────────────────────────────────────────────
    title "2/5  What to receive"
    local -a P=()
    mapfile -t P < <(presets_for "$STATION_RECEIVER")
    local custom=$(( ${#P[@]} + 1 )) def_p=1
    for i in "${!P[@]}"; do
        printf '   %d) %s\n' $((i + 1)) "${P[$i]%%|*}"
        [ "${P[$i]%%|*}" = "${STATION_PRESET:-}" ] && def_p=$((i + 1))
    done
    printf '   %d) Something else — I will type the frequency and sample rate\n' "$custom"
    [ "${STATION_PRESET:-}" = "custom" ] && def_p=$custom
    [ -n "${FROM_ENV[STATION_PRESET]+x}" ] && FROM_ENV[BAND_CHOICE]=1
    if [ -n "${FROM_ENV[STATION_FREQ]+x}${FROM_ENV[STATION_SPS]+x}" ] && [ -z "${FROM_ENV[STATION_PRESET]+x}" ]; then
        def_p=$custom; FROM_ENV[BAND_CHOICE]=1
    fi
    BAND_CHOICE=""
    ask_menu BAND_CHOICE "Which band?" "$def_p" "$custom"
    if [ "$BAND_CHOICE" -lt "$custom" ]; then
        IFS='|' read -r STATION_PRESET STATION_FREQ STATION_SPS STATION_DEFAULT_FREQ STATION_MODULATION \
            <<<"${P[$((BAND_CHOICE - 1))]}"
    else
        STATION_PRESET="custom"
        local f
        if [ "${RX_SIGNAL[$STATION_RECEIVER]}" = real ]; then
            STATION_FREQ=0
        else
            while true; do
                ask STATION_FREQ "Centre frequency (e.g. 145000000, 145M or 145.0)" "${STATION_FREQ:-}"
                f="$(to_hz "$STATION_FREQ")"
                [ -n "$f" ] && [ "$f" -gt 0 ] && { STATION_FREQ="$f"; break; }
                warn "Could not read that as a frequency."; STATION_FREQ=""
                [ "$PHANTOM_NONINTERACTIVE" = "1" ] && die "STATION_FREQ is not a frequency"
            done
        fi
        while true; do
            ask STATION_SPS "Sample rate in samples per second (e.g. 2048000 or 2.048M)" "${STATION_SPS:-}"
            f="$(to_hz "$STATION_SPS")"
            [ -n "$f" ] && [ "$f" -gt 0 ] && { STATION_SPS="$f"; break; }
            warn "Could not read that as a sample rate."; STATION_SPS=""
            [ "$PHANTOM_NONINTERACTIVE" = "1" ] && die "STATION_SPS is not a sample rate"
        done
        local start_def="$STATION_FREQ"
        [ "$start_def" = 0 ] && start_def=7100000
        ask STATION_DEFAULT_FREQ "Frequency a new visitor starts on" "${STATION_DEFAULT_FREQ:-$start_def}"
        f="$(to_hz "$STATION_DEFAULT_FREQ")"; [ -n "$f" ] && STATION_DEFAULT_FREQ="$f"
        ask STATION_MODULATION "Mode a new visitor starts in (AM, FM, WBFM, LSB, USB, CW)" "${STATION_MODULATION:-AM}"
        STATION_MODULATION="${STATION_MODULATION^^}"
    fi

    # ── 3. station ───────────────────────────────────────────────────────────
    title "3/5  Your station (shown to visitors)"
    ask STATION_CALLSIGN "Callsign" ""
    STATION_CALLSIGN="${STATION_CALLSIGN^^}"
    ask STATION_NAME "Your name (optional)" ""
    ask STATION_EMAIL "E-mail address" ""
    while true; do
        ask STATION_LOCATOR "QTH locator (e.g. KM18ux)" ""
        [ -z "$STATION_LOCATOR" ] && break
        if [[ ${STATION_LOCATOR^^} =~ ^[A-R]{2}[0-9]{2}([A-X]{2})?$ ]]; then
            local loc="${STATION_LOCATOR^^}"
            local sub="${loc:4:2}"
            STATION_LOCATOR="${loc:0:4}${sub,,}"     # KM18ux: field upper, subsquare lower
            break
        fi
        warn "A locator looks like KM18 or KM18ux."; STATION_LOCATOR=""
        [ "$PHANTOM_NONINTERACTIVE" = "1" ] && break
    done
    ask STATION_CITY "City and country" ""
    ask STATION_ANTENNA "Antenna" ""
    ask STATION_HARDWARE "Computer (optional, e.g. Intel NUC i5)" ""
    ask STATION_REGION "ITU region (1 Europe/Africa, 2 Americas, 3 Asia-Pacific)" \
        "$(region_from_locator "$STATION_LOCATOR")"

    # ── 4. internet ──────────────────────────────────────────────────────────
    title "4/5  Internet"
    say "  The address listeners type to reach you: your public IP address or a"
    say "  DNS name (e.g. myname.ddns.net). Leave it empty if you do not know yet."
    ask STATION_PUBLIC_HOST "Public address" ""
    STATION_PUBLIC_HOST="${STATION_PUBLIC_HOST#http://}"; STATION_PUBLIC_HOST="${STATION_PUBLIC_HOST#https://}"
    STATION_PUBLIC_HOST="${STATION_PUBLIC_HOST%%/*}"
    local list_def=n
    [ -n "$STATION_PUBLIC_HOST" ] && list_def=y
    ask_yn STATION_SDR_LIST "List the receiver on sdr-list.xyz?" "$list_def"
    ask_yn STATION_WEBSDR_ORG "Register it on the websdr.org map?" "$list_def"
    if [ -z "$STATION_PUBLIC_HOST" ] && { [ "$STATION_SDR_LIST" = y ] || [ "$STATION_WEBSDR_ORG" = y ]; }; then
        warn "Both need the public address — they stay off until you set it."
        STATION_SDR_LIST=n; STATION_WEBSDR_ORG=n
    fi

    # ── 5. ports and extras ──────────────────────────────────────────────────
    title "5/5  Ports and extras"
    ask_yn STATION_ADMIN "Admin panel (dashboard, logs, settings, users)?" y
    ask_yn STATION_RADE "FreeDV RADE decoder? (large: ~1 GB download, +20 min install)" y
    ask_yn STATION_STATS "CPU / memory / temperature box on the page?" y
    ask_yn STATION_RELAY "WebSDR diversity relay (advanced, most stations leave it off)?" n
    ask_yn STATION_AUTOSTART "Start the receiver automatically when the computer boots?" y

    say ""
    say "  Only ONE port has to be opened (forwarded) on your router."
    local pub_def=9000
    TAKEN=()
    # A station installed before the wizard already has its ports in
    # admin_config.json (proxy, spectrumserver, panel). Offer those, so running
    # the wizard there does not move anything listeners or the router know.
    if [ ! -f "$STATION_CONF" ] && [ -f "$PHANTOMDIR/admin_config.json" ] && command -v python3 >/dev/null 2>&1; then
        local old
        old="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("proxy_port",""), d.get("public_port",""), d.get("port",""))' \
               "$PHANTOMDIR/admin_config.json" 2>/dev/null)" || old=""
        read -r OLD_PROXY OLD_SDR OLD_ADMIN <<<"$old"
        if [[ ${OLD_PROXY:-} =~ ^[0-9]+$ ]] && [[ ${OLD_SDR:-} =~ ^[0-9]+$ ]]; then
            say "  This station already has ports set up — they are offered as they are."
            : "${PORT_PUBLIC:=$OLD_PROXY}" "${PORT_SDR:=$OLD_SDR}" "${PORT_ADMIN:=${OLD_ADMIN:-}}"
            # The services it already runs stay where they are; the proxy
            # simply reaches them there: RADE's old fixed port, the relay's
            # from its config, statistics from the address the page used.
            local old_stats old_relay
            old_stats="$(python3 -c 'import json,re,sys; v=json.load(open(sys.argv[1])).get("siteStats",""); m=re.search(r":(\d+)/*$", v); print(m.group(1) if m else "")' \
                         "$PHANTOMDIR/frontend/site_information.json" 2>/dev/null)" || old_stats=""
            old_relay="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("port",""))' \
                         "$PHANTOMDIR/websdr_relay.json" 2>/dev/null)" || old_relay=""
            : "${PORT_RADE:=8074}" "${PORT_STATS:=${old_stats:-3001}}" "${PORT_RELAY:=${old_relay:-8898}}"
        fi
    fi
    if [ -n "${PORT_PUBLIC:-}" ]; then pub_def="$PORT_PUBLIC"; TAKEN[$PORT_PUBLIC]=1
    else pub_def="$(next_free_port 9000)"; fi
    while true; do
        ask PORT_PUBLIC "Public port" "$pub_def"
        if [[ $PORT_PUBLIC =~ ^[0-9]+$ ]] && [ "$PORT_PUBLIC" -ge 1 ] && [ "$PORT_PUBLIC" -le 65535 ]; then break; fi
        warn "A port is a number from 1 to 65535."; PORT_PUBLIC=""
        [ "$PHANTOM_NONINTERACTIVE" = "1" ] && die "PORT_PUBLIC is not a port"
    done
    TAKEN=([$PORT_PUBLIC]=1)
    suggest_port PORT_SDR   $((PORT_PUBLIC + 1))
    suggest_port PORT_ADMIN $((PORT_PUBLIC + 10))
    suggest_port PORT_STATS $((PORT_PUBLIC + 11))
    suggest_port PORT_RADE  $((PORT_PUBLIC + 12))
    suggest_port PORT_RELAY $((PORT_PUBLIC + 13))
    printf '\n    %-6s %s\n' "$PORT_PUBLIC" "public — the receiver page; forward this one"
    printf '    %-6s %s\n' "$PORT_SDR"   "spectrumserver (inside this computer)"
    printf '    %-6s %s\n' "$PORT_ADMIN" "admin panel    (reached as /admin)"
    printf '    %-6s %s\n' "$PORT_STATS" "statistics     (reached as /stats)"
    printf '    %-6s %s\n' "$PORT_RADE"  "RADE decoder   (reached as /rade)"
    printf '    %-6s %s\n\n' "$PORT_RELAY" "WebSDR relay   (reached as /relay)"
    CHANGE_PORTS=n
    ask_yn CHANGE_PORTS "Change any of the internal ports?" n
    if [ "$CHANGE_PORTS" = y ]; then
        local pv
        for pv in PORT_SDR PORT_ADMIN PORT_STATS PORT_RADE PORT_RELAY; do
            while true; do
                ask "$pv" "  $pv" "${!pv}"
                [[ ${!pv} =~ ^[0-9]+$ ]] && [ "${!pv}" -ge 1 ] && [ "${!pv}" -le 65535 ] && break
                warn "A port is a number from 1 to 65535."
            done
        done
    fi
}

mhz() {           # Hz → "145.024" (three decimals), integer arithmetic only
    local hz="$1" khz
    [ "$hz" -lt 0 ] && hz=0
    khz=$(( (hz + 500) / 1000 ))
    printf '%d.%03d' $((khz / 1000)) $((khz % 1000))
}

summary() {
    local bw
    if [ "${RX_SIGNAL[$STATION_RECEIVER]}" = real ]; then
        bw="0 – $(mhz $((STATION_SPS / 2))) MHz"
    else
        bw="$(mhz $((STATION_FREQ - STATION_SPS / 2))) – $(mhz $((STATION_FREQ + STATION_SPS / 2))) MHz"
    fi
    say ""
    say "${B}Summary${N}"
    printf '  %-14s %s\n' "Receiver" "${RX_LABEL[$STATION_RECEIVER]}" \
        "Covers" "$bw  (sample rate $STATION_SPS)" \
        "Starts on" "$STATION_DEFAULT_FREQ Hz $STATION_MODULATION" \
        "Station" "${STATION_CALLSIGN:-—}  ${STATION_LOCATOR}  ${STATION_CITY}" \
        "Address" "${STATION_PUBLIC_HOST:-(not set)}:$PORT_PUBLIC" \
        "Listings" "sdr-list.xyz: $STATION_SDR_LIST   websdr.org: $STATION_WEBSDR_ORG" \
        "Extras" "admin: $STATION_ADMIN  RADE: $STATION_RADE  stats: $STATION_STATS  relay: $STATION_RELAY  autostart: $STATION_AUTOSTART"
}

# ═════════════════════════════════════════════════════════════════════════════
#  WRITING THE FILES
# ═════════════════════════════════════════════════════════════════════════════
apply_files() {
    [ -f "$STATION_CONF" ] || die "no station.conf — run: bash configure-station.sh"
    command -v python3 >/dev/null 2>&1 || die "python3 is needed to write the config files"
    local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
    set -a
    # shellcheck disable=SC1090
    . "$STATION_CONF"
    set +a
    STATION_SIGNAL="${RX_SIGNAL[$STATION_RECEIVER]:-iq}" PHANTOMDIR="$PHANTOMDIR" STAMP="$stamp" \
    python3 - <<'PY' || die "writing the config files failed (nothing was half-written)"
import json, os, re, shutil, sys
from pathlib import Path

E = os.environ
root = Path(E["PHANTOMDIR"])
stamp = E["STAMP"]
changed = []

def backup(p: Path):
    if p.exists():
        shutil.copy2(p, p.with_name(p.name + ".bak-" + stamp))

def write(p: Path, text: str):
    if p.exists() and p.read_text() == text:
        print(f"  ✔ {p.relative_to(root)} (already up to date)")
        return
    backup(p)
    tmp = p.with_name(p.name + ".tmp")
    tmp.write_text(text)
    tmp.replace(p)
    changed.append(str(p.relative_to(root)))
    print(f"  ✔ {p.relative_to(root)}")

def tq(s):   # a TOML basic string
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'

yes = lambda k: E.get(k, "n").lower().startswith("y")
host = E.get("STATION_PUBLIC_HOST", "").strip()
call = E.get("STATION_CALLSIGN", "").strip()
port_public = int(E["PORT_PUBLIC"])
port_sdr = int(E["PORT_SDR"])

# ── config-<receiver>.toml ────────────────────────────────────────────────────
# Line-based on purpose: a TOML library would drop every comment, and the
# comments in these files are the documentation sysops actually read.
cfg = root / E["STATION_CONFIG"]
src = cfg if cfg.exists() else cfg.with_name(cfg.name + ".example")
if not src.exists():
    sys.exit(f"  ✖ neither {cfg.name} nor {cfg.name}.example exists")
lines = src.read_text().splitlines()

SEC = re.compile(r"^\s*\[([^\]]+)\]\s*(#.*)?$")

def section_range(name):
    start = None
    for i, l in enumerate(lines):
        m = SEC.match(l)
        if m and start is None and m.group(1).strip() == name:
            start = i
        elif m and start is not None:
            return start, i
    return (start, len(lines)) if start is not None else (None, None)

def set_key(section, key, value):
    s, e = section_range(section)
    if s is None:
        lines.extend(["", f"[{section}]"])
        s, e = len(lines) - 1, len(lines)
    pat = re.compile(r"^(\s*)" + re.escape(key) + r"(\s*)=(\s*)(\"(?:[^\"\\]|\\.)*\"|[^#\s]*)(.*)$")
    for i in range(s + 1, e):
        m = pat.match(lines[i])
        if m:
            lines[i] = f"{m.group(1)}{key}{m.group(2)}={m.group(3)}{value}{m.group(5)}"
            return
    # Not there yet: after the section's last setting, ahead of any comment
    # block that introduces the next section.
    j = s + 1
    for i in range(s + 1, e):
        t = lines[i].strip()
        if t and not t.startswith("#"):
            j = i + 1
    lines.insert(j, f"{key}={value}")

set_key("server", "port", str(port_sdr))
set_key("input", "sps", E["STATION_SPS"])
set_key("input", "frequency", E["STATION_FREQ"])
set_key("input", "signal", tq(E["STATION_SIGNAL"]))
set_key("input.defaults", "frequency", E["STATION_DEFAULT_FREQ"])
set_key("input.defaults", "modulation", tq(E["STATION_MODULATION"]))

set_key("websdr", "register_online", "true" if (yes("STATION_SDR_LIST") and host) else "false")
set_key("websdr", "name", tq(" ".join(x for x in (call, E.get("STATION_CITY", "")) if x) or "PhantomSDR+"))
set_key("websdr", "antenna", tq(E.get("STATION_ANTENNA", "") or "Antenna"))
set_key("websdr", "grid_locator", tq(E.get("STATION_LOCATOR", "")))
set_key("websdr", "hostname", tq(host))
# The port the directories send visitors to: the proxy's, not spectrumserver's.
set_key("websdr", "public_port", str(port_public))
if E.get("STATION_ACCELERATOR") in ("opencl", "none"):
    set_key("input", "accelerator", tq(E["STATION_ACCELERATOR"]))

# [websdr.org] ships commented out. Turning it on replaces that commented
# block with a real section; turning it off sets enabled = false.
org_on = yes("STATION_WEBSDR_ORG") and bool(host)
s, _ = section_range("websdr.org")
if s is None and org_on:
    hdr = next((i for i, l in enumerate(lines) if re.match(r"^\s*#\s*\[websdr\.org\]", l)), None)
    block = ["[websdr.org]",
             "enabled     = true",
             f"public_host = {tq(host)}",
             f"public_port = {port_public}",
             f"qth         = {tq(E.get('STATION_LOCATOR', ''))}",
             f"description = {tq((call + ' PhantomSDR+').strip())}",
             f"email       = {tq(E.get('STATION_EMAIL', ''))}",
             'logo        = "logo.jpg" # in frontend/public; replace the file to use your own']
    if hdr is not None:
        j = hdr + 1
        while j < len(lines) and re.match(r"^\s*#\s*[a-z_]+\s*=", lines[j]):
            j += 1
        lines[hdr:j] = block
    else:
        lines.extend([""] + block)
elif s is not None:
    set_key("websdr.org", "enabled", "true" if org_on else "false")
    if org_on:
        set_key("websdr.org", "public_host", tq(host))
        set_key("websdr.org", "public_port", str(port_public))
        set_key("websdr.org", "qth", tq(E.get("STATION_LOCATOR", "")))
        set_key("websdr.org", "description", tq((call + " PhantomSDR+").strip()))
        set_key("websdr.org", "email", tq(E.get("STATION_EMAIL", "")))

write(cfg, "\n".join(lines) + "\n")

# ── frontend/site_information.json ───────────────────────────────────────────
si = root / "frontend" / "site_information.json"
base = si if si.exists() else root / "frontend" / "site_information.example.json"
info = json.loads(base.read_text()) if base.exists() else {}
sps, freq = int(E["STATION_SPS"]), int(E["STATION_FREQ"])
if E["STATION_SIGNAL"] == "real":
    sdr_base, sdr_bw = 0, sps // 2
else:
    sdr_base, sdr_bw = max(0, freq - sps // 2), sps
name = E.get("STATION_NAME", "").strip()
info.update({
    "siteSysop": f"{name}, {call}" if name and call else (call or name or "Sysop"),
    "siteSysopEmailAddress": E.get("STATION_EMAIL", ""),
    "siteGridSquare": E.get("STATION_LOCATOR", ""),
    "siteCity": E.get("STATION_CITY", ""),
    "siteReceiver": {"rx888mk2": "RX888 MkII", "rtl": "RTL-SDR Blog V4" if yes("STATION_RTL_V4") else "RTL-SDR",
                     "rsp1a": "SDRplay RSP1A", "airspyhf": "Airspy HF+", "hackrf": "HackRF One",
                     "fobos": "RigExpert Fobos SDR", "fobos-hf": "RigExpert Fobos SDR"}.get(E["STATION_RECEIVER"], ""),
    "siteAntenna": E.get("STATION_ANTENNA", ""),
    "siteIP": f"http://{host}:{port_public}" if host else "",
    "siteStats": "/stats" if yes("STATION_STATS") else "",
    "siteRade": "/rade",
    "siteRelay": "/relay",
    "siteSDRBaseFrequency": sdr_base,
    "siteSDRBandwidth": sdr_bw,
    "siteRegion": int(E.get("STATION_REGION") or 1),
})
if E.get("STATION_HARDWARE", "").strip():
    info["siteHardware"] = E["STATION_HARDWARE"].strip()
# The template's descriptive placeholders would be shown to visitors as they
# are; a sysop's own text is never replaced.
for key, placeholder, value in (("siteHardware", "Hardware you are using, ", ""),
                                ("siteSoftware", "Software you are using", "PhantomSDR-Plus")):
    if info.get(key) == placeholder:
        info[key] = value
# The info panel's Receiver link: the maker's page for this receiver, unless
# the sysop put in an address of their own.
maker = {"rx888mk2": "https://www.rx-888.com/rx/", "rtl": "https://www.rtl-sdr.com/",
         "rsp1a": "https://www.sdrplay.com/rsp1a/", "airspyhf": "https://airspy.com/airspy-hf-plus/",
         "hackrf": "https://greatscottgadgets.com/hackrf/one/", "fobos": "https://rigexpert.com/",
         "fobos-hf": "https://rigexpert.com/"}
url = str(info.get("siteReceiverURL", "")).strip()
if not re.match(r"^https?://", url, re.I) or url in maker.values():
    info["siteReceiverURL"] = maker.get(E["STATION_RECEIVER"], "")
write(si, json.dumps(info, indent="\t", ensure_ascii=False) + "\n")

# ── websdr_relay.json (only when the relay is on) ───────────────────────────
if yes("STATION_RELAY"):
    rj = root / "websdr_relay.json"
    ex = root / "websdr_relay.json.example"
    relay = json.loads((rj if rj.exists() else ex).read_text()) if (rj.exists() or ex.exists()) else {}
    relay.update({"port": int(E["PORT_RELAY"]), "bind": "127.0.0.1",
                  "site": f"http://{host}:{port_public}" if host else relay.get("site", ""),
                  "operator": " ".join(x for x in (call, f"<{E['STATION_EMAIL']}>" if E.get("STATION_EMAIL") else "") if x)
                              or relay.get("operator", "")})
    write(rj, json.dumps(relay, indent=2) + "\n")

Path(root / ".station-changed").write_text("\n".join(changed) + ("\n" if changed else ""))
PY
}

# ═════════════════════════════════════════════════════════════════════════════
case "$MODE" in
    ask|all)
        ask_everything
        summary
        SAVE_IT=y
        [ "$PHANTOM_NONINTERACTIVE" = "1" ] || ask_yn SAVE_IT "Save these settings?" y
        [ "$SAVE_IT" = y ] || die "nothing was saved"
        save_conf
        ok "saved station.conf"
        ;;
esac

case "$MODE" in
    apply|all)
        title "Writing the configuration"
        apply_files
        changed="$(cat "$PHANTOMDIR/.station-changed" 2>/dev/null)"
        rm -f "$PHANTOMDIR/.station-changed"
        if [ "$MODE" = all ] && [ -x "$PHANTOMDIR/build/spectrumserver" ]; then
            say ""
            if [[ $changed == *site_information.json* ]]; then
                say "  The page shows the new station details after a frontend rebuild:"
                say "      ${B}./recompile.sh${N}   (choose the frontend)"
            fi
            if [ -n "$changed" ]; then
                say "  Then restart the receiver so it reads the new settings:"
                say "      ${B}./$STATION_LAUNCHER${N}"
            fi
        fi
        ;;
esac
