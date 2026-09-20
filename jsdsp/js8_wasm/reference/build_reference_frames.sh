#!/usr/bin/env bash
#
# build_reference_frames.sh — regenerate ref_frames.txt, the ground truth for
# frontend/src/modules/js8.js.
#
# Compiles JS8Call's OWN varicode.cpp / jsc.cpp under Qt6 in a rootless podman
# container and has them unpack a batch of frames. js8_frames_test.mjs then
# requires js8.js to produce identical output for the identical frames.
#
# A container is used because JS8Call needs Qt6 and this machine has no Qt dev
# packages -- and installing them system-wide to run a test would be a poor
# trade. Nothing here touches the host beyond the output file.
#
# Usage: ./build_reference_frames.sh [num_random_frames]   (default 5000)
#
# The result is committed, so this only needs re-running when JS8Call changes
# or when more coverage is wanted.

set -euo pipefail
cd "$(dirname "$0")"

N="${1:-5000}"
WORK="${JS8_WORK:-/tmp/js8-phase0}"
SRC="$WORK/js8call"

mkdir -p "$WORK"
if [[ ! -d "$SRC" ]]; then
    echo "[ref] cloning JS8Call into $SRC"
    git clone --depth 1 https://github.com/js8call/js8call.git "$SRC"
fi

echo "[ref] building the Qt6 image"
podman build -q -t js8ref -f Containerfile . >/dev/null

cat > "$WORK/build_in_container.sh" <<'INNER'
set -e
mkdir -p /build && cd /build
cp -r /js8call/* . 2>/dev/null || true
cp /out/ref_frames.cpp .
QTINC="-I/usr/include/x86_64-linux-gnu/qt6 -I/usr/include/x86_64-linux-gnu/qt6/QtCore"
/usr/lib/qt6/libexec/moc varicode.h -o moc_varicode.cpp
echo "[ref] compiling (jsc_list/jsc_map are ~6 MB each; this takes a minute)"
g++ -O0 -fPIC -std=c++17 -I. $QTINC -c \
    varicode.cpp jsc.cpp jsc_list.cpp jsc_map.cpp decodedtext.cpp \
    moc_varicode.cpp ref_frames.cpp
g++ -o ref_frames ref_frames.o varicode.o jsc.o jsc_list.o jsc_map.o \
    moc_varicode.o decodedtext.o -lQt6Core
./ref_frames "$NRANDOM" > /out/ref_frames.txt 2>/dev/null
echo "[ref] wrote $(wc -l < /out/ref_frames.txt) vectors"
INNER

podman run --rm \
    -e NRANDOM="$N" \
    -v "$SRC":/js8call:ro \
    -v "$PWD":/out:z \
    -v "$WORK/build_in_container.sh":/build_in_container.sh:ro \
    js8ref bash /build_in_container.sh
