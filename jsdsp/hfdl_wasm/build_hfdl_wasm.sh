#!/usr/bin/env bash
# build_hfdl_wasm.sh — compile le décodeur HFDL (dumphfdl + libacars) en WebAssembly
#
# Prérequis : emscripten (paquet Debian/Ubuntu « emscripten », ou emsdk), git, cmake.
#
# Usage :
#   cd ~/PhantomSDR-Plus/jsdsp/hfdl_wasm
#   bash build_hfdl_wasm.sh
#
# Produit :
#   frontend/public/decoders/hfdl.wasm          (le décodeur)
#   frontend/public/decoders/hfdl_systable.conf (stations sol HFDL)
#   frontend/src/modules/hfdl.mjs               (chargeur JavaScript)
#
# Sources : les fichiers de dumphfdl nécessaires sont dans ./dumphfdl
# (dumphfdl 1.7.0, Tomasz Lemiech, GPL-3.0-or-later ; hfdl.c y est adapté en
# hfdl_core.c). libacars, liquid-dsp et libconfig sont téléchargés à des
# versions figées ci-dessous.

set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
ROOT="$(cd ../.. && pwd)"
WORK="${HFDL_WORK:-$HERE/.build}"

LIBACARS_REV=9af09a0121d4ec577339cbd4c7420d7519da48fa     # libacars 2.2.1
LIQUID_REV=10041f70cebbe3b97887e75bb41e48b73dda1b23       # liquid-dsp
LIBCONFIG_REV=82d21512f46bf7381e50cbc521b3df85d67d15e5    # libconfig

command -v emcc >/dev/null || { echo "[build] emcc introuvable (installez emscripten)"; exit 1; }
echo "[build] $(emcc --version | head -1)"

fetch() {   # fetch <url> <dir> <rev>
    local url="$1" dir="$2" rev="$3"
    if [ ! -d "$WORK/$dir/.git" ]; then
        git clone -q "$url" "$WORK/$dir"
    fi
    git -C "$WORK/$dir" fetch -q --depth 1 origin "$rev" 2>/dev/null || true
    git -C "$WORK/$dir" checkout -q "$rev"
}

mkdir -p "$WORK"
fetch https://github.com/szpajder/libacars.git    libacars   "$LIBACARS_REV"
fetch https://github.com/jgaeddert/liquid-dsp.git liquid-dsp "$LIQUID_REV"
fetch https://github.com/hyperrealm/libconfig.git libconfig  "$LIBCONFIG_REV"

# ── liquid-dsp ────────────────────────────────────────────────────────────────
if [ ! -f "$WORK/liquid-dsp/bw/libliquid.a" ]; then
    echo "[build] liquid-dsp"
    rm -rf "$WORK/liquid-dsp/bw"; mkdir -p "$WORK/liquid-dsp/bw"
    ( cd "$WORK/liquid-dsp/bw" && emcmake cmake .. \
        -DBUILD_EXAMPLES=OFF -DBUILD_AUTOTESTS=OFF -DBUILD_BENCHMARKS=OFF \
        -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON \
        -DENABLE_SIMD=OFF -DFIND_SIMD=OFF -DFIND_THREADS=OFF -DFIND_FFTW=OFF \
        -DENABLE_LOGGING=OFF -DENABLE_COLOR=OFF -DENABLE_TIMESTAMPS=OFF \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_FLAGS=-O2 >/dev/null \
      && emmake make -j"$(nproc)" >/dev/null )
fi

# ── libacars (sans zlib, libxml2 ni jansson) ─────────────────────────────────
if [ ! -f "$WORK/libacars-wasm.a" ]; then
    echo "[build] libacars"
    OBJ="$WORK/libacars-obj"; rm -rf "$OBJ"; mkdir -p "$OBJ/gen/libacars"
    cp "$HERE/libacars-config/config.h" "$OBJ/gen/libacars/config.h"
    for f in "$WORK"/libacars/libacars/*.c "$WORK"/libacars/libacars/asn1/*.c "$HERE/libacars-config/version.c"; do
        emcc -O2 -std=gnu11 -I"$OBJ/gen/libacars" -I"$WORK/libacars/libacars" \
             -I"$WORK/libacars/libacars/asn1" -I"$WORK/libacars" \
             -c "$f" -o "$OBJ/$(echo "$f" | md5sum | cut -c1-12)_$(basename "$f" .c).o"
    done
    emar rcs "$WORK/libacars-wasm.a" "$OBJ"/*.o
fi

# ── libconfig (lecture de la table des stations) ──────────────────────────────
if [ ! -f "$WORK/libconfig-wasm.a" ]; then
    echo "[build] libconfig"
    OBJ="$WORK/libconfig-obj"; rm -rf "$OBJ"; mkdir -p "$OBJ"
    for f in grammar libconfig scanctx scanner strbuf strvec util wincompat; do
        emcc -O2 -DHAVE_USELOCALE -DHAVE_NEWLOCALE -DHAVE_FREELOCALE \
             -I"$WORK/libconfig/lib" -c "$WORK/libconfig/lib/$f.c" -o "$OBJ/$f.o"
    done
    emar rcs "$WORK/libconfig-wasm.a" "$OBJ"/*.o
fi

# ── décodeur ──────────────────────────────────────────────────────────────────
echo "[build] hfdl"
SRC=(hfdl_wasm.c dumphfdl/hfdl_core.c dumphfdl/libfec/viterbi27_port.c)
for f in mpdu spdu lpdu hfnpdu acars position fmtr-text fmtr-json util crc \
         ac_cache cache ac_data systable globals metadata; do
    SRC+=("dumphfdl/$f.c")
done

EXPORTS='["_hfdl_init","_hfdl_set_dial","_hfdl_set_offset","_hfdl_reset","_hfdl_input_ptr","_hfdl_process","_hfdl_output_ptr","_hfdl_output_len","_hfdl_output_clear","_hfdl_noise_floor_db","_hfdl_state","_hfdl_frames","_hfdl_rate_ppm","_hfdl_freq_offset","_hfdl_locked","_hfdl_load_systable","_malloc","_free"]'

mkdir -p "$WORK/out"
emcc -O2 -std=gnu11 -Istub -Idumphfdl \
    -I"$WORK/libacars" -I"$WORK/libacars-obj/gen" \
    -I"$WORK/liquid-dsp/bw" -I"$WORK/libconfig/lib" \
    "${SRC[@]}" \
    "$WORK/liquid-dsp/bw/libliquid.a" "$WORK/libacars-wasm.a" "$WORK/libconfig-wasm.a" \
    -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker \
    -s EXPORT_NAME=createHfdlModule -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=1 \
    -s EXPORTED_FUNCTIONS="$EXPORTS" \
    -s EXPORTED_RUNTIME_METHODS='["UTF8ToString"]' \
    -o "$WORK/out/hfdl.mjs"

mkdir -p "$ROOT/frontend/public/decoders" "$ROOT/frontend/src/modules"
cp "$WORK/out/hfdl.wasm" "$ROOT/frontend/public/decoders/hfdl.wasm"
sed 's|new URL("hfdl.wasm",import.meta.url)|new URL(/* @vite-ignore */ "hfdl.wasm",import.meta.url)|' "$WORK/out/hfdl.mjs" > "$ROOT/frontend/src/modules/hfdl.mjs"
cp "$HERE/systable.conf" "$ROOT/frontend/public/decoders/hfdl_systable.conf"
echo "[build] OK : $(stat -c %s "$ROOT/frontend/public/decoders/hfdl.wasm") octets"
