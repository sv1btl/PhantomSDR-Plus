#!/usr/bin/env bash
#
# check_against_reference.sh — Phase 0 validation for the extracted JS8 constants.
#
# Builds two encoders and diffs them:
#   ref_gen        — JS8Call's own genjs8.f90 + encode174.f90 + crc12.cpp,
#                    compiled from unmodified upstream source
#   js8_roundtrip  — our C, driven purely by js8_constants.{h,c}
#
# A clean diff proves the generator matrix, colorder permutation, CRC-12
# (polynomial and the XOR-42 whitening), the tone mapping and both Costas
# variants are all correct. js8_roundtrip additionally checks the reverse
# direction, the parity tables and CRC rejection; see its header comment.
#
# Usage: ./check_against_reference.sh [num_vectors]   (default 2000)
#
# Needs: git, gfortran, g++, gcc, boost headers (libboost-dev).

set -euo pipefail
cd "$(dirname "$0")"

N="${1:-2000}"
WORK="${JS8_WORK:-/tmp/js8-phase0}"
SRC="$WORK/js8call"

mkdir -p "$WORK"

if [[ ! -d "$SRC" ]]; then
    echo "[1/4] cloning JS8Call (GPL-3) into $SRC"
    git clone --depth 1 https://github.com/js8call/js8call.git "$SRC"
else
    echo "[1/4] using existing JS8Call checkout at $SRC"
fi

echo "[2/4] building the reference encoder from unmodified JS8Call sources"
g++      -c -O2 -o "$WORK/crc12.o"     "$SRC/lib/crc12.cpp"
g++      -c -O2 -o "$WORK/crc14.o"     "$SRC/lib/crc14.cpp"
g++      -c -O2 -o "$WORK/crc10.o"     "$SRC/lib/crc10.cpp"
gfortran -c -O2 -J"$WORK" -o "$WORK/crc.o"       "$SRC/lib/crc.f90"
gfortran -c -O2 -J"$WORK" -I"$SRC/lib/ft8" -o "$WORK/encode174.o" "$SRC/lib/ft8/encode174.f90"
gfortran -c -O2 -J"$WORK" -I"$SRC/lib/js8" -o "$WORK/genjs8.o"    "$SRC/lib/js8/genjs8.f90"
gfortran -O2 -J"$WORK" -o "$WORK/ref_gen" ref_gen.f90 \
    "$WORK/genjs8.o" "$WORK/encode174.o" "$WORK/crc.o" \
    "$WORK/crc12.o" "$WORK/crc14.o" "$WORK/crc10.o" -lstdc++

echo "[3/4] building our encoder from js8_constants.{h,c}"
gcc -O2 -Wall -Wextra -I. -o "$WORK/js8_roundtrip" js8_roundtrip.c js8_encode.c js8_constants.c

echo "[4/4] comparing $N vectors"
"$WORK/js8_roundtrip" --vectors "$N" > "$WORK/vectors.txt"
"$WORK/js8_roundtrip" --emit    "$N" > "$WORK/ours.txt"
"$WORK/ref_gen" < "$WORK/vectors.txt" | sed 's/[[:space:]]*$//' > "$WORK/ref.txt"

if diff -u "$WORK/ref.txt" "$WORK/ours.txt" > "$WORK/diff.txt"; then
    echo "MATCH: $(grep -c '^TONE' "$WORK/ours.txt") vectors bit-identical to JS8Call"
else
    echo "MISMATCH — first differences:"
    head -40 "$WORK/diff.txt"
    exit 1
fi

echo
"$WORK/js8_roundtrip" run "$N"
