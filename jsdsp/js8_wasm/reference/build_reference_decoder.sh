#!/usr/bin/env bash
#
# build_reference_decoder.sh — compile JS8Call's OWN JS8 Normal decoder into a
# standalone binary, and run it over a raw float32 recording.
#
# This is the Phase 7 reference. The rest of the suite checks our encoder and
# our unpackers against JS8Call; this is the only thing that checks our
# RECEIVER against theirs, on identical audio.
#
# Usage: ./build_reference_decoder.sh <file.f32> <startOffsetSamples> <numSlots>
#
# Output goes to ref_decode.txt next to this script, as
#     DEC <slot> <snr> <dt> <freq> <message>

set -euo pipefail
cd "$(dirname "$0")"

FILE="${1:?need a .f32 recording}"
OFFSET="${2:-0}"
SLOTS="${3:-20}"

WORK="${JS8_WORK:-/tmp/js8-phase0}"
SRC="$WORK/js8call"
mkdir -p "$WORK"

if [[ ! -d "$SRC" ]]; then
    echo "[ref] cloning JS8Call into $SRC"
    git clone --depth 1 https://github.com/js8call/js8call.git "$SRC"
fi

echo "[ref] building the gfortran image"
podman build -q -t js8refdec -f Containerfile.decoder . >/dev/null

cp "$FILE" "$WORK/input.f32"

podman run --rm \
    -v "$SRC":/js8call:ro \
    -v "$PWD":/out:z \
    -v "$WORK":/work:z \
    -e OFFSET="$OFFSET" -e SLOTS="$SLOTS" \
    js8refdec bash /out/build_in_container.sh
