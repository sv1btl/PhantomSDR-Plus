#!/usr/bin/env bash
# build_js8_wasm.sh — compile the JS8 decoder to WebAssembly
#
# Output: frontend/public/decoders/js8.wasm
#
# Usage:
#   source ~/emsdk/emsdk_env.sh
#   bash jsdsp/js8_wasm/build_js8_wasm.sh
#
# Unlike the FT8 build this does not need the whole ft8_lib tree -- only its
# kiss_fft. Everything else here is self-contained, which is deliberate: the
# JS8 path must not be able to break the live FT8/FT4/FT2 decoder.
#
# Built with the same STANDALONE_WASM settings as ft8_lib.wasm so the loader in
# frontend/src/modules/ can use one set of Emscripten import stubs for both.

set -euo pipefail
cd "$(dirname "$0")"

FT8_LIB="${FT8_LIB:-$HOME/ft8_lib_ft2}"
OUT="${OUT:-$(cd ../../frontend/public/decoders && pwd)/js8.wasm}"

[[ -d "$FT8_LIB/fft" ]] || { echo "[build] ERROR: no kiss_fft at $FT8_LIB/fft"; exit 1; }
command -v emcc >/dev/null || { echo "[build] ERROR: emcc not on PATH; source ~/emsdk/emsdk_env.sh"; exit 1; }

echo "[build] emcc $(emcc --version | head -1)"

SOURCES=(
    js8_wasm_wrapper.c
    js8_decode.c
    js8_osd.c
    js8_subtract.c
    js8_encode.c
    js8_constants.c
    "$FT8_LIB/fft/kiss_fft.c"
    "$FT8_LIB/fft/kiss_fftr.c"
)

for f in "${SOURCES[@]}"; do
    [[ -f "$f" ]] || { echo "[build] ERROR: missing $f"; exit 1; }
done

EXPORTS='["_js8_decode","_js8_get_payload","_js8_get_i3bit","_js8_get_freq","_js8_get_snr","_js8_get_dt","_js8_get_score","_js8_num_submodes","_js8_submode_name","_js8_submode_period","_js8_submode_txdur","_js8_submode_baud","_js8_submode_start_delay","_malloc","_free"]'

echo "[build] Compiling ${#SOURCES[@]} source files..."

emcc \
    "${SOURCES[@]}" \
    -I . \
    -I "$FT8_LIB" \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="$EXPORTS" \
    -s EXPORTED_RUNTIME_METHODS='[]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s STACK_SIZE=1048576 \
    -s STANDALONE_WASM=1 \
    -s ASSERTIONS=0 \
    -s FILESYSTEM=0 \
    --no-entry \
    -lm \
    -o "$OUT"

echo "[build] Done: $OUT  ($(wc -c < "$OUT") bytes)"
