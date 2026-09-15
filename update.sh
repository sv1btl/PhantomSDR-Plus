#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  update.sh
#  Update an installed instance from the GitHub tree, without touching the
#  files that make it THIS site rather than any other site.
#
#  It does not use git. The published tree is downloaded as a tarball and
#  compared file by file against what is on disk, so it works exactly the same
#  whether this instance was cloned, unzipped from update.zip, or copied off a
#  USB stick — and it does not care that the local tree has no matching
#  history.
#
#  Usage:
#    ./update.sh                   report what would change; writes NOTHING
#    ./update.sh --apply           actually update, asking about your own edits
#    ./update.sh --apply --yes     unattended; anything you edited is KEPT
#    ./update.sh --ref v4.1.0      a tag, branch or commit instead of main
#    ./update.sh --apply --prune   also offer to delete files GitHub removed
#    ./update.sh --list-excludes   print the exclusion rules as resolved here
#    ./update.sh --restore LAST    put back the files the last run overwrote
#    ./update.sh --verbose         list every file, not just the first 40
#
#  A tree that holds a file called .update-source-of-truth is the tree the
#  published version is built FROM, so --apply refuses to run in it. Reporting
#  still works, and there it lists what has not been published yet.
#
#  Exit status of a report run: 0 = already up to date, 10 = updates pending.
#  (So `./update.sh || notify-me` works from cron.)
#
#  Env overrides (all optional, same contract as install.sh):
#    PHANTOM_NONINTERACTIVE=1      never ask; use the unattended defaults
#    PHANTOM_STOP_SERVICES=y|n     stop the receiver + panel before writing
#    PHANTOM_RECOMPILE=y|n         run recompile.sh afterwards
#    UPDATE_REF=main               same as --ref
# ─────────────────────────────────────────────────────────────────────────────

set -e
set -o pipefail

if [ -z "${BASH_VERSINFO[0]}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    echo "This script needs bash 4 or newer (it uses associative arrays)." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# Where we are, and what we talk to
# ------------------------------------------------------------------------------
# The instance is wherever this script lives — the same rule the start-*.sh
# launchers use, so a second clone updates itself and not the one on air.
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
# When we have re-executed ourselves from a copy in /tmp (see "Re-exec" below),
# the running file is NOT in the instance — the instance is where the original
# was, and that path is handed over in the environment.
[ -n "${PHANTOM_UPDATE_REEXEC:-}" ] && SCRIPT_PATH="$PHANTOM_UPDATE_REEXEC"
PHANTOM_DIR="$(dirname "$SCRIPT_PATH")"
# Canonical form, for deciding whether a running process belongs to THIS
# instance: symlinks and /home/../home spellings must not make the same
# directory look like a different one.
PHANTOM_DIR_REAL="$(cd "$PHANTOM_DIR" 2>/dev/null && pwd -P)" || PHANTOM_DIR_REAL="$PHANTOM_DIR"

REPO_SLUG="${UPDATE_REPO:-sv1btl/PhantomSDR-Plus}"
REF="${UPDATE_REF:-main}"

STATE_DIR="$PHANTOM_DIR/.update-state"
MANIFEST="$STATE_DIR/manifest.sha256"
BACKUP_ROOT="$PHANTOM_DIR/.update-backups"
KEEP_BACKUPS=3
EXCLUDE_FILE="$PHANTOM_DIR/update-exclude.txt"

MODE="check"          # check | apply | list-excludes | restore
ASSUME_YES=false
PRUNE=false
VERBOSE=false
RESTORE_ARG=""

# ------------------------------------------------------------------------------
# Output helpers — deliberately the same look and the same prompt contract as
# install.sh, so the two scripts do not feel like they came from two projects.
# ------------------------------------------------------------------------------
red()    { echo -e "\e[31m$*\e[0m"; }
green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }
grey()   { echo -e "\e[90m$*\e[0m"; }

STEP_W=70
FRAME_C='\033[34m'
frepeat() { local i out=""; for ((i = 0; i < $2; i++)); do out+="$1"; done; printf '%s' "$out"; }
fline() {
    local text="${1:-}" extra="${2:-0}" pad
    if (( ${#text} + extra > STEP_W )); then text="${text:0:$((STEP_W - 1 - extra))}…"; fi
    pad=$(( STEP_W - ${#text} - extra )); (( pad < 0 )) && pad=0
    printf '%b║\033[0m%s%s%b║\033[0m\n' "$FRAME_C" "$text" "$(frepeat ' ' $pad)" "$FRAME_C"
}
ftop() { printf '%b╔%s╗\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }
fbot() { printf '%b╚%s╝\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }
banner() { echo ""; ftop; fline "  $1"; fbot; }

die()  { red "❌ Fatal: $*"; exit 1; }
warn() { yellow "⚠️  $*"; }

# stdin is not a terminal (piped from curl, run from cron): asking would eat the
# wrong input, so fall back to the unattended defaults exactly as install.sh does.
if [ "${PHANTOM_NONINTERACTIVE:-}" != "1" ] && [ ! -t 0 ]; then
    PHANTOM_NONINTERACTIVE=1
fi

prompt_fence() {
    echo ""
    yellow "  ┌──────────────────────────────────────────────────────────────────┐"
    yellow "  │  ⌨️   YOUR INPUT IS NEEDED                                        │"
    yellow "  └──────────────────────────────────────────────────────────────────┘"
}

# confirm <ENV_NAME> <default-interactive> <default-unattended> <question>
confirm() {
    local envname="$1" def="$2" def_ni="$3" q="$4"
    local override="${!envname:-}" hint word ans

    if [ -n "$override" ]; then
        echo ""; echo "  ❓ $q"
        [[ $override =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (from ${envname}=${override})"
        [[ $override =~ ^[Yy] ]]; return
    fi
    if [ "${PHANTOM_NONINTERACTIVE:-}" = "1" ]; then
        echo ""; echo "  ❓ $q"
        [[ $def_ni =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (unattended default; set ${envname}=y|n to choose)"
        [[ $def_ni =~ ^[Yy] ]]; return
    fi
    if [ "$def" = "y" ]; then hint="\033[1;32mY\033[0m/n"; word="Yes"
    else                      hint="y/\033[1;31mN\033[0m"; word="No"; fi
    prompt_fence
    printf '  ❓ %s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$q" "$hint" "$word"
    # EOF (a closed stdin part-way through) must not kill the run under set -e;
    # it means "no answer", which is what the default is for.
    read -r ans || true
    ans="${ans:-$def}"
    [[ $ans =~ ^[Yy] ]]
}

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------
usage() { sed -n '2,31p' "$SCRIPT_PATH" | sed 's/^# \?//'; }

while [ $# -gt 0 ]; do
    case "$1" in
        --apply)          MODE="apply"; shift ;;
        --check)          MODE="check"; shift ;;
        --list-excludes)  MODE="list-excludes"; shift ;;
        --restore)        MODE="restore"; RESTORE_ARG="${2:-LAST}"; shift 2 ;;
        --ref)            REF="${2:?--ref needs a branch, tag or commit}"; shift 2 ;;
        --yes|-y)         ASSUME_YES=true; shift ;;
        --prune)          PRUNE=true; shift ;;
        --verbose|-v)     VERBOSE=true; shift ;;
        -h|--help)        usage; exit 0 ;;
        *)                die "Unknown argument '$1' — try --help" ;;
    esac
done

# --yes means "do not stop to ask" for the file decisions AND for the service
# questions, so it implies the same unattended defaults everywhere.
[ "$ASSUME_YES" = true ] && PHANTOM_NONINTERACTIVE=1

if [ "$(id -u)" -eq 0 ]; then SUDO=""
elif command -v sudo >/dev/null 2>&1; then SUDO="sudo"
else SUDO=""; fi

# ------------------------------------------------------------------------------
# The source-of-truth guard
# ------------------------------------------------------------------------------
# Exactly one machine must never take files FROM the published tree: the one the
# published tree is made from. Its copies are ahead of anything on GitHub, so
# "differs from upstream" there means "not published yet" rather than "out of
# date", and applying an update would replace current work with the last
# snapshot. Nothing in the files can settle which side is newer — mtimes do not
# survive a tarball and most files carry no version — so the maintainer marks
# the tree by hand, once, and this refuses to write to it ever after.
#
# Reporting still works, and is the useful thing to do there: it says exactly
# what has not been published yet.
GUARD_FILE="$PHANTOM_DIR/.update-source-of-truth"
if [ "$MODE" = "apply" ] && [ -e "$GUARD_FILE" ]; then
    banner "This tree is marked as a source, not a copy"
    echo ""
    red   "  ✋ Refusing to apply an update here."
    echo ""
    echo "     $(basename "$GUARD_FILE") is present, which marks this directory as the"
    echo "     tree the published version is BUILT FROM. Its files are newer than"
    echo "     GitHub's, so applying an update would overwrite them with an older"
    echo "     snapshot of themselves."
    echo ""
    echo "     What to do instead:"
    echo "       ./update.sh          report what is here but not yet published"
    echo "       rm $GUARD_FILE"
    echo "                            remove the marker, if this really is a copy"
    echo ""
    exit 3
fi

# ------------------------------------------------------------------------------
# The exclusion rules
# ------------------------------------------------------------------------------
# TIER A — never written, never even mentioned in a prompt. These are what make
# this installation a particular receiver at a particular place: its config, its
# markers, its admin secret, its logs, its build output. An updater that
# overwrites any of them has not updated the site, it has replaced it.
#
# Patterns are shell globs matched against the path relative to the instance
# root, with `*` crossing directory separators (so `logs/*` covers everything
# beneath it).
TIER_A=(
    # site identity and per-site configuration
    'config.toml' 'config-*.toml' 'config.example.*.toml'
    'admin_config.json' 'markers.json' 'mymarkers.json'
    # The sysop's callsign, locator, city, hardware and antenna — what visitors
    # see. The repository ships the placeholder version of this file, so leaving
    # it out of this list would reset a working site to "your name or callsign".
    'frontend/site_information.json' 'users.json' '*/users.json'
    'autorun.json' 'autorun-status.json' 'autorun-totals.json'
    'frontend/variant.json' '.tap_token'
    # externally refreshed data, permanently dirty by design
    'frequencylist/*'
    # written by users while the site runs
    'chat_history.txt'
    # logs, pids, flags, reports — regenerated, and some are open right now
    '*.log' 'logs/*' 'logwebsdr.txt' 'logwebsdr.flag' 'install.txt'
    '*.pid' '.watchdog.lock' '*.fifo' '*fftw_wisdom'
    # build output and fetched dependencies — never distributed, always rebuilt
    'build/*' 'frontend/dist/*' 'node_modules/*' '*/node_modules/*'
    'subprojects/glaze/*' 'subprojects/packagecache/*' 'subprojects/websocketpp-*/*'
    'rx888_stream/*' '__pycache__/*' '*/__pycache__/*'
    'frontend/stats.html' 'frontend/stats-*.html'
    'frontend/src/lib/VersionSelector.svelte.backup'
    # ours, and the tooling that is not distributed
    '.git/*' '.claude/*' '.update-state/*' '.update-backups/*'
    'update-exclude.txt' 'tools/*'
)

# TIER B — updated, but never silently. These are the files a sysop most often
# has a reason to have edited: the launcher with their own RX888_ARGS or CPU
# pinning, a hand-tuned service unit, an installer they adapted. If we cannot
# prove the local copy is an untouched earlier release (see the manifest below),
# the sysop is asked before anything is written over it.
TIER_B=(
    'start-*.sh' 'stop-websdr.sh' 'go.sh' 'xgo.sh' 'rade.sh' '_relaunch.sh'
    'kill.sh' 'check-go.sh' 'waterfall.sh' 'smeter_theme.sh'
    '*.service' 'logrotate/*'
    'install.sh' 'install_*.sh' 'install-*.sh' 'recompile.sh'
    'setup_admin.sh' 'setup-*.sh' 'manage_admin.sh' 'setup_websdr_relay.sh'
    'proxy.py' 'admin_server.py' 'thermal_guard.py' 'rade_helper.py'
    'websdr_relay.py'
    # The band-plan overlay: shipped with sensible defaults, but the bands a
    # site shows, and their colours and limits, are a matter of where it is
    # and what it is for. Improvements upstream are worth having, so it is
    # offered rather than skipped — and never taken silently.
    'frontend/src/bands-config.js'
)

# A site can add its own Tier A patterns without editing this script.
EXTRA_EXCLUDES=()
if [ -f "$EXCLUDE_FILE" ]; then
    while IFS= read -r line; do
        line="${line%%#*}"; line="${line#"${line%%[![:space:]]*}"}"; line="${line%"${line##*[![:space:]]}"}"
        [ -n "$line" ] && EXTRA_EXCLUDES+=("$line")
    done < "$EXCLUDE_FILE"
fi

matches_any() {
    local path="$1"; shift
    local pat
    for pat in "$@"; do
        # shellcheck disable=SC2053
        [[ $path == $pat ]] && return 0
    done
    return 1
}

tier_of() {
    local path="$1"
    if [ ${#EXTRA_EXCLUDES[@]} -gt 0 ] && matches_any "$path" "${EXTRA_EXCLUDES[@]}"; then echo A; return; fi
    if matches_any "$path" "${TIER_A[@]}"; then echo A; return; fi
    if matches_any "$path" "${TIER_B[@]}"; then echo B; return; fi
    echo C
}

if [ "$MODE" = "list-excludes" ]; then
    banner "Exclusion rules for $PHANTOM_DIR"
    echo ""
    blue "  TIER A — never touched, never prompted:"
    printf '     %s\n' "${TIER_A[@]}"
    if [ ${#EXTRA_EXCLUDES[@]} -gt 0 ]; then
        echo ""
        blue "  TIER A — added by $(basename "$EXCLUDE_FILE"):"
        printf '     %s\n' "${EXTRA_EXCLUDES[@]}"
    else
        echo ""
        grey "  (no $(basename "$EXCLUDE_FILE") — create one, a glob per line, to add your own)"
    fi
    echo ""
    blue "  TIER B — updated only after asking you:"
    printf '     %s\n' "${TIER_B[@]}"
    echo ""
    blue "  TIER C — everything else: updated, after a backup."
    echo ""
    exit 0
fi

# ------------------------------------------------------------------------------
# Restore
# ------------------------------------------------------------------------------
if [ "$MODE" = "restore" ]; then
    [ -d "$BACKUP_ROOT" ] || die "No backups have ever been taken ($BACKUP_ROOT does not exist)."
    if [ "$RESTORE_ARG" = "LAST" ] || [ -z "$RESTORE_ARG" ]; then
        RESTORE_ARG="$(ls -1 "$BACKUP_ROOT" | sort | tail -1)"
        [ -n "$RESTORE_ARG" ] || die "No backups in $BACKUP_ROOT."
    fi
    B="$BACKUP_ROOT/$RESTORE_ARG"
    [ -d "$B" ] || die "No such backup: $RESTORE_ARG (have: $(ls -1 "$BACKUP_ROOT" | tr '\n' ' '))"
    banner "Restoring the files overwritten on $RESTORE_ARG"
    n=0
    while IFS= read -r rel; do
        [ "$rel" = "restore.sh" ] && continue
        mkdir -p "$PHANTOM_DIR/$(dirname "$rel")"
        cp -p "$B/$rel" "$PHANTOM_DIR/$rel"
        echo "     restored  $rel"
        n=$((n + 1))
    done < <(cd "$B" && find . -type f -printf '%P\n' | sort)
    echo ""
    green "  ✅ $n file(s) put back. A rebuild may be needed: ./recompile.sh"
    exit 0
fi

# ------------------------------------------------------------------------------
# Re-exec from a temp copy, so this script can update ITSELF safely
# ------------------------------------------------------------------------------
# bash reads a script incrementally as it runs. Overwriting update.sh while
# update.sh is executing makes it jump into the middle of the new text — the
# classic way a self-updater corrupts its own run. Running from a copy in /tmp
# means the file on disk is just another file we are allowed to replace.
if [ "$MODE" = "apply" ] && [ -z "${PHANTOM_UPDATE_REEXEC:-}" ]; then
    SELF_COPY="$(mktemp "${TMPDIR:-/tmp}/phantom-update-XXXXXX.sh")"
    cat "$SCRIPT_PATH" > "$SELF_COPY"
    chmod +x "$SELF_COPY"
    export PHANTOM_UPDATE_REEXEC="$SCRIPT_PATH"
    # Rebuild the argument list; the flags are all we need to carry over.
    args=(--apply --ref "$REF")
    [ "$ASSUME_YES" = true ] && args+=(--yes)
    [ "$PRUNE"      = true ] && args+=(--prune)
    [ "$VERBOSE"    = true ] && args+=(--verbose)
    exec "$SELF_COPY" "${args[@]}"
fi
trap '[ -n "${SELF_COPY:-}" ] && rm -f "$SELF_COPY"' EXIT

# ------------------------------------------------------------------------------
# Preflight
# ------------------------------------------------------------------------------
banner "PhantomSDR-Plus updater"
echo ""
printf '     %-14s %s\n' "instance"  "$PHANTOM_DIR"
printf '     %-14s %s\n' "source"    "github.com/${REPO_SLUG} @ ${REF}"
printf '     %-14s %s\n' "mode"      "$([ "$MODE" = apply ] && echo 'apply — files WILL be written' || echo 'check — nothing will be written')"
echo ""

for c in curl tar sha256sum find; do
    command -v "$c" >/dev/null 2>&1 || die "'$c' is not installed, and this script needs it."
done
[ -f "$PHANTOM_DIR/meson.build" ] && [ -d "$PHANTOM_DIR/src" ] && [ -d "$PHANTOM_DIR/frontend" ] \
    || die "$PHANTOM_DIR does not look like a PhantomSDR-Plus tree (no meson.build/src/frontend)."
[ "$MODE" != "apply" ] || [ -w "$PHANTOM_DIR" ] \
    || die "$PHANTOM_DIR is not writable by $(id -un)."

TMP="$(mktemp -d "${TMPDIR:-/tmp}/phantom-update-XXXXXX")"
cleanup() { rm -rf "$TMP"; [ -n "${SELF_COPY:-}" ] && rm -f "$SELF_COPY"; return 0; }
trap cleanup EXIT

# ------------------------------------------------------------------------------
# Fetch
# ------------------------------------------------------------------------------
TARBALL="$TMP/tree.tar.gz"
URL="https://codeload.github.com/${REPO_SLUG}/tar.gz/${REF}"
printf '  ⬇  fetching %s ... ' "$REF"
if ! curl -fsSL --retry 2 --connect-timeout 20 -o "$TARBALL" "$URL"; then
    echo ""
    die "Could not download $URL
     Check the network, and that '${REF}' exists in the repository."
fi
green "$(du -h "$TARBALL" | cut -f1)"

UP="$TMP/upstream"
mkdir -p "$UP"
# GitHub wraps everything in one <repo>-<ref> directory; strip it.
tar -xzf "$TARBALL" -C "$UP" --strip-components=1 \
    || die "The download is not a readable tar.gz — the ref may not exist."
[ -f "$UP/meson.build" ] && [ -d "$UP/src" ] \
    || die "The downloaded tree does not look like PhantomSDR-Plus. Refusing to touch anything."

# ------------------------------------------------------------------------------
# Compare
# ------------------------------------------------------------------------------
# The manifest is what makes this more than a diff: it records, for every file,
# the upstream hash AS OF THE LAST UPDATE. So a local file that differs from the
# new upstream can be told apart —
#
#   local == manifest   the sysop never touched it; it is simply an old release
#   local != manifest   the sysop edited it; overwriting would destroy their work
#
# Without that, every update either clobbers local edits or asks about all 300
# files. On the very first run there is no manifest, which is exactly why Tier B
# exists: the likely-edited files are prompted, the rest are taken.
declare -A PREV_SHA=()
if [ -f "$MANIFEST" ]; then
    while read -r sha path; do
        [ -n "$path" ] && PREV_SHA["$path"]="$sha"
    done < "$MANIFEST"
fi

mapfile -t UP_FILES < <(cd "$UP" && find . -type f -printf '%P\n' | sort)
[ ${#UP_FILES[@]} -gt 0 ] || die "The downloaded tree is empty."

# One batch hash of the upstream tree; the local side is compared with cmp,
# which does not read whole files when they differ early.
declare -A UP_SHA=()
while read -r sha path; do
    path="${path#\*}"
    [ -n "$path" ] && UP_SHA["$path"]="$sha"
done < <(cd "$UP" && printf '%s\0' "${UP_FILES[@]}" | xargs -0 sha256sum)

declare -a F_NEW=() F_UPDATE=() F_CONFLICT=() F_SAME=() F_SKIP=() F_GONE=()

printf '  🔍 comparing %d files ... ' "${#UP_FILES[@]}"
for rel in "${UP_FILES[@]}"; do
    tier="$(tier_of "$rel")"
    if [ "$tier" = "A" ]; then F_SKIP+=("$rel"); continue; fi

    local_f="$PHANTOM_DIR/$rel"
    if [ ! -e "$local_f" ]; then F_NEW+=("$rel"); continue; fi
    if cmp -s "$local_f" "$UP/$rel"; then F_SAME+=("$rel"); continue; fi

    lsha="$(sha256sum "$local_f" | cut -d' ' -f1)"
    prev="${PREV_SHA[$rel]:-}"
    if [ -n "$prev" ] && [ "$prev" = "$lsha" ]; then
        # Untouched copy of the previous release — a plain update, whatever tier.
        F_UPDATE+=("$rel")
    elif [ -z "$prev" ] && [ "$tier" = "C" ]; then
        # No history to judge by, and not a file people usually edit.
        F_UPDATE+=("$rel")
    else
        F_CONFLICT+=("$rel")
    fi
done

# Files that used to come from upstream and no longer exist there. Anything else
# in the tree is the sysop's own and is never a deletion candidate.
for rel in "${!PREV_SHA[@]}"; do
    [ -n "${UP_SHA[$rel]:-}" ] && continue
    [ -e "$PHANTOM_DIR/$rel" ] || continue
    [ "$(tier_of "$rel")" = "A" ] && continue
    F_GONE+=("$rel")
done
green "done"

# ------------------------------------------------------------------------------
# Report
# ------------------------------------------------------------------------------
list_files() {
    local colour="$1" mark="$2"; shift 2
    local n=0 f
    for f in "$@"; do
        if [ "$VERBOSE" != true ] && [ "$n" -ge 40 ]; then
            grey "        … and $(($# - 40)) more (--verbose to see them all)"
            break
        fi
        echo -e "        \e[${colour}m${mark}\e[0m $f"
        n=$((n + 1))
    done
}

banner "What this update would change"
echo ""
if [ ${#F_NEW[@]} -gt 0 ]; then
    green "  ➕ ${#F_NEW[@]} new file(s):"
    list_files 32 "+" "${F_NEW[@]}"; echo ""
fi
if [ ${#F_UPDATE[@]} -gt 0 ]; then
    blue "  ⬆  ${#F_UPDATE[@]} file(s) to update:"
    list_files 34 "~" "${F_UPDATE[@]}"; echo ""
fi
if [ ${#F_CONFLICT[@]} -gt 0 ]; then
    yellow "  ✋ ${#F_CONFLICT[@]} file(s) differ AND look edited here — you decide each one:"
    list_files 33 "!" "${F_CONFLICT[@]}"; echo ""
fi
if [ ${#F_GONE[@]} -gt 0 ]; then
    grey "  🗑  ${#F_GONE[@]} file(s) removed upstream (kept unless --prune):"
    list_files 90 "-" "${F_GONE[@]}"; echo ""
fi
grey "  🔒 ${#F_SKIP[@]} site-local file(s) skipped   ·   ${#F_SAME[@]} already current"
echo ""

PENDING=$(( ${#F_NEW[@]} + ${#F_UPDATE[@]} + ${#F_CONFLICT[@]} ))
if [ "$PENDING" -eq 0 ] && { [ "$PRUNE" != true ] || [ ${#F_GONE[@]} -eq 0 ]; }; then
    green "  ✅ This instance is already up to date with ${REF}."
    exit 0
fi

if [ "$MODE" != "apply" ]; then
    echo "     Nothing was written. To do it:  ./update.sh --apply"
    exit 10
fi

# ------------------------------------------------------------------------------
# Decide the conflicts BEFORE anything is stopped or written
# ------------------------------------------------------------------------------
# Asking all the questions first means the receiver is off air for the length of
# the copy, not for the length of the sysop's thinking.
declare -A DECISION=()
if [ ${#F_CONFLICT[@]} -gt 0 ]; then
    banner "Files you appear to have edited"
    echo ""
    echo "     For each one: keep yours, take the new version, or take the new"
    echo "     version alongside yours as <file>.new so you can merge by hand."
    echo ""
    for rel in "${F_CONFLICT[@]}"; do
        if [ "${PHANTOM_NONINTERACTIVE:-}" = "1" ]; then
            DECISION["$rel"]="keep"
            echo "  ❓ $rel → keep yours (unattended default)"
            continue
        fi
        echo ""
        yellow "  ── $rel ──"
        if command -v diff >/dev/null 2>&1; then
            diff -u "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null \
                | sed -n '3,23p' | sed 's/^/     /' || true
            added=$(diff "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null | grep -c '^>' || true)
            removed=$(diff "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null | grep -c '^<' || true)
            grey "     (upstream adds ${added} line(s), drops ${removed})"
        fi
        prompt_fence
        printf '  ❓ %s  [\033[1;32mK\033[0m]eep mine / [u]pstream / [b]oth  \033[90m(ENTER = Keep mine)\033[0m: ' "$(basename "$rel")"
        read -r ans || true
        case "${ans:-k}" in
            [Uu]*) DECISION["$rel"]="upstream" ;;
            [Bb]*) DECISION["$rel"]="both" ;;
            *)     DECISION["$rel"]="keep" ;;
        esac
    done
fi

PRUNE_OK=false
if [ "$PRUNE" = true ] && [ ${#F_GONE[@]} -gt 0 ]; then
    echo ""
    if confirm PHANTOM_PRUNE n n "Delete the ${#F_GONE[@]} file(s) that no longer exist upstream?"; then
        PRUNE_OK=true
    fi
fi

# ------------------------------------------------------------------------------
# Stop what is running
# ------------------------------------------------------------------------------
# Writing into a live tree is how an update turns into an outage that looks like
# a bad release: the binary is replaced while it is mapped, the panel serves a
# frontend directory that has moved under it, and the watchdog cheerfully
# restarts whatever half-written thing it finds.
PHANTOM_UNITS=(phantomsdr-admin.service phantomsdr-proxy.service sdr-stats.service)
STOPPED_UNITS=()
STOPPED_RECEIVER=""

# Is this path a file of the instance we are updating? More than one
# PhantomSDR-Plus can run on one machine — a second clone, or a copy someone is
# testing this very script in — and stopping the wrong one takes a receiver off
# the air for an update it is not even receiving.
owns_path() {
    local p="$1" dir
    [ -n "$p" ] || return 1
    dir="$(cd "$(dirname "$p")" 2>/dev/null && pwd -P)" || return 1
    [ "$dir" = "$PHANTOM_DIR_REAL" ]
}

# The launcher of THIS instance, if it is running. Every matching process is
# examined, not just the first, because the first one found may well belong to
# another tree. The path is taken from /proc rather than from `pgrep -a`, and a
# relative one ("./start-rtl.sh", from someone who started it by hand) is
# resolved against that process's own working directory — resolving it against
# ours would silently make another instance look like this one.
running_receiver_script() {
    local pid path cwd
    while read -r pid; do
        [ -n "$pid" ] || continue
        path="$(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null \
                | grep -m1 -E 'start-(rx888mk2|airspyhf|rtl|rsp1a)\.sh$')" || true
        [ -n "$path" ] || continue
        case "$path" in
            /*) ;;
            *)  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" || continue
                [ -n "$cwd" ] || continue
                path="$cwd/${path#./}" ;;
        esac
        owns_path "$path" || continue
        printf '%s\n' "$path"
        return 0
    done < <(pgrep -f 'start-(rx888mk2|airspyhf|rtl|rsp1a)\.sh' 2>/dev/null)
    return 1
}

# Same question for a systemd unit, answered from its WorkingDirectory and, if
# it declares none, from the directory of the program it starts. A unit we
# cannot place is treated as ours: that is the single-instance machine, where
# the old behaviour was right.
unit_belongs_here() {
    local u="$1" wd
    wd="$(systemctl show -p WorkingDirectory --value "$u" 2>/dev/null)" || wd=""
    if [ -z "$wd" ]; then
        wd="$(systemctl show -p ExecStart --value "$u" 2>/dev/null \
              | grep -oE '/[^ ]+\.py' | head -1)"
        [ -n "$wd" ] && wd="$(dirname "$wd")"
    fi
    [ -n "$wd" ] || return 0
    [ "$(cd "$wd" 2>/dev/null && pwd -P)" = "$PHANTOM_DIR_REAL" ]
}

stop_running_phantom() {
    local u script; local -a live=()
    for u in "${PHANTOM_UNITS[@]}"; do
        systemctl is-active --quiet "$u" 2>/dev/null || continue
        unit_belongs_here "$u" || { grey "  $u serves another directory — left alone."; continue; }
        live+=("$u")
    done
    script="$(running_receiver_script || true)"
    if [ ${#live[@]} -eq 0 ] && [ -z "$script" ]; then
        grey "  Nothing of PhantomSDR-Plus is running — writing straight away."
        return 0
    fi
    banner "Stopping the running receiver first"
    [ -n "$script" ] && echo "     receiver: $script"
    [ ${#live[@]} -gt 0 ] && echo "     services: ${live[*]}"
    if ! confirm PHANTOM_STOP_SERVICES y y \
         "Stop them now, and start them again when the update finishes?"; then
        warn "Updating a live tree can leave the site broken until the next rebuild."
        return 0
    fi
    echo ""
    for u in "${live[@]}"; do
        printf '     %-40s' "stopping ${u} ..."
        if $SUDO systemctl stop "$u" >/dev/null 2>&1; then green "stopped"; STOPPED_UNITS+=("$u")
        else red "failed"; warn "Could not stop ${u} — stop it by hand."; fi
    done
    if [ -n "$script" ]; then
        printf '     %-40s' "stopping the receiver ..."
        if [ -x "$(dirname "$script")/stop-websdr.sh" ] \
           && "$(dirname "$script")/stop-websdr.sh" >/dev/null 2>&1; then
            green "stopped"; STOPPED_RECEIVER="$script"
        else
            red "failed"; warn "Could not stop ${script} — stop it by hand."
        fi
    fi
}

# Only ever restarts what THIS run stopped: something the sysop stopped by hand
# is theirs to start again.
restart_stopped_phantom() {
    local u
    [ ${#STOPPED_UNITS[@]} -gt 0 ] || [ -n "$STOPPED_RECEIVER" ] || return 0
    echo ""
    blue "  Starting again what was stopped:"
    for u in "${STOPPED_UNITS[@]}"; do
        printf '     %-40s' "starting ${u} ..."
        $SUDO systemctl start "$u" >/dev/null 2>&1 && green "running" \
            || { red "failed"; warn "Start it by hand: ${SUDO:+$SUDO }systemctl start ${u}"; }
    done
    if [ -n "$STOPPED_RECEIVER" ]; then
        printf '     %-40s' "starting the receiver ..."
        "$STOPPED_RECEIVER" -q >/dev/null 2>&1 && green "running" \
            || { red "failed"; warn "Start it by hand: $STOPPED_RECEIVER"; }
    fi
    echo ""
}

stop_running_phantom

# ------------------------------------------------------------------------------
# Apply
# ------------------------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR" "$STATE_DIR"

backup_one() {
    local rel="$1"
    [ -e "$PHANTOM_DIR/$rel" ] || return 0
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp -p "$PHANTOM_DIR/$rel" "$BACKUP_DIR/$rel"
}

place() {
    local rel="$1"
    mkdir -p "$PHANTOM_DIR/$(dirname "$rel")"
    cp -p "$UP/$rel" "$PHANTOM_DIR/$rel"
    # A script arriving from a tarball keeps its upstream mode, but a file that
    # was executable here must stay executable even if the archive disagrees.
    [ -x "$BACKUP_DIR/$rel" ] && chmod +x "$PHANTOM_DIR/$rel"
    return 0
}

banner "Applying"
echo ""
n_new=0; n_upd=0; n_kept=0; n_both=0; n_del=0
declare -a APPLIED=()

for rel in "${F_NEW[@]}"; do
    place "$rel"; APPLIED+=("$rel"); n_new=$((n_new + 1))
done
for rel in "${F_UPDATE[@]}"; do
    backup_one "$rel"; place "$rel"; APPLIED+=("$rel"); n_upd=$((n_upd + 1))
done
for rel in "${F_CONFLICT[@]}"; do
    case "${DECISION[$rel]}" in
        upstream) backup_one "$rel"; place "$rel"; APPLIED+=("$rel"); n_upd=$((n_upd + 1)) ;;
        both)     cp -p "$UP/$rel" "$PHANTOM_DIR/$rel.new"; n_both=$((n_both + 1)) ;;
        *)        n_kept=$((n_kept + 1)) ;;
    esac
done
if [ "$PRUNE_OK" = true ]; then
    for rel in "${F_GONE[@]}"; do
        backup_one "$rel"; rm -f "$PHANTOM_DIR/$rel"; n_del=$((n_del + 1))
    done
fi

printf '     %-28s %d\n' "new files"          "$n_new"
printf '     %-28s %d\n' "updated"            "$n_upd"
printf '     %-28s %d\n' "yours, kept"        "$n_kept"
printf '     %-28s %d\n' "written as .new"    "$n_both"
[ "$n_del" -gt 0 ] && printf '     %-28s %d\n' "deleted (--prune)" "$n_del"
printf '     %-28s %d\n' "site-local, untouched" "${#F_SKIP[@]}"

# ------------------------------------------------------------------------------
# The manifest and the backup's own restore script
# ------------------------------------------------------------------------------
# Recorded for every upstream file, including the ones whose local copy we left
# alone: next time, "local still equals what upstream had" is the whole test.
: > "$MANIFEST.tmp"
for rel in "${UP_FILES[@]}"; do
    [ "$(tier_of "$rel")" = "A" ] && continue
    printf '%s %s\n' "${UP_SHA[$rel]}" "$rel" >> "$MANIFEST.tmp"
done
mv "$MANIFEST.tmp" "$MANIFEST"
printf '%s\n' "$REF" > "$STATE_DIR/last-ref"
date -Is > "$STATE_DIR/last-run"

if [ -n "$(find "$BACKUP_DIR" -type f -print -quit)" ]; then
    cat > "$BACKUP_DIR/restore.sh" <<'RESTORE'
#!/bin/bash
# Put back exactly the files the update of this timestamp overwrote.
# Equivalent to: ./update.sh --restore <this directory's name>
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$(cd "$HERE/../.." && pwd)"
cd "$HERE"
find . -type f ! -name restore.sh -printf '%P\n' | while read -r f; do
    mkdir -p "$DEST/$(dirname "$f")"
    cp -p "$f" "$DEST/$f"
    echo "restored $f"
done
echo "Done. A rebuild may be needed: $DEST/recompile.sh"
RESTORE
    chmod +x "$BACKUP_DIR/restore.sh"
    echo ""
    grey "  💾 Overwritten files saved in .update-backups/$STAMP  (restore.sh inside)"
else
    rmdir "$BACKUP_DIR" 2>/dev/null || true
fi

# Keep the last few only; these are whole file copies and they add up.
if [ -d "$BACKUP_ROOT" ]; then
    while IFS= read -r old; do
        [ -n "$old" ] && rm -rf "$BACKUP_ROOT/$old"
    done < <(ls -1 "$BACKUP_ROOT" 2>/dev/null | sort | head -n -"$KEEP_BACKUPS")
fi

# ------------------------------------------------------------------------------
# Rebuild and restart
# ------------------------------------------------------------------------------
NEEDS_BUILD=false
for rel in ${APPLIED[@]+"${APPLIED[@]}"}; do
    case "$rel" in
        src/*|frontend/*|jsdsp/*|subprojects/*|meson.build|meson_options.txt|*.hpp|*.cpp)
            NEEDS_BUILD=true; break ;;
    esac
done

SELF_UPDATED=false
for rel in ${APPLIED[@]+"${APPLIED[@]}"}; do
    [ "$rel" = "update.sh" ] && SELF_UPDATED=true
done

if [ "$NEEDS_BUILD" = true ]; then
    banner "A rebuild is needed"
    echo ""
    echo "     Source, frontend or build files changed, so the running site will"
    echo "     not show any of this until it is compiled again."
    echo ""
    if confirm PHANTOM_RECOMPILE y n "Run ./recompile.sh now? (it asks its own questions)"; then
        if [ -x "$PHANTOM_DIR/recompile.sh" ]; then
            ( cd "$PHANTOM_DIR" && ./recompile.sh ) || warn "recompile.sh did not finish cleanly — run it by hand."
        else
            warn "recompile.sh is not executable here — run: bash recompile.sh"
        fi
    else
        yellow "     Remember to run ./recompile.sh before the changes take effect."
    fi
fi

restart_stopped_phantom

banner "Update finished"
echo ""
green "  ✅ Updated to ${REPO_SLUG} @ ${REF}."
[ "$n_kept" -gt 0 ] && echo "     ${n_kept} of your own file(s) were kept as they are."
[ "$n_both" -gt 0 ] && echo "     ${n_both} new version(s) are waiting beside yours as *.new."
[ "$SELF_UPDATED" = true ] && echo "     update.sh itself was updated; the new one is in place for next time."
echo ""
grey "     Undo:  ./update.sh --restore LAST"
echo ""
exit 0
