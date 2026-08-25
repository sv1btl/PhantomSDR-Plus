#!/usr/bin/env bash
#
# run_tests.sh — everything that validates the JS8 decoder, in order.
#
#   1. constants vs JS8Call's own Fortran encoder   (Phase 0)
#   2. native end-to-end decode, all five submodes  (Phase 1)
#   3. js8.js message layer vs frames unpacked by JS8Call itself
#   4. reassembly: checksums vs JS8Call, plus real multi-frame messages
#   5. slot scheduling, simulated over minutes of audio
#   6. spotting: what is reportable, the bandplan, and the autorun worker
#   7. the BUILT js8.wasm, loaded the way the browser loads it
#   8. the full chain: synthesised audio -> wasm -> js8.js -> assembled message
#
# Steps 7 and 8 are skipped if frontend/public/decoders/js8.wasm is not built.
#
# Usage: ./run_tests.sh [num_vectors]

set -euo pipefail
cd "$(dirname "$0")"

WORK="${JS8_WORK:-/tmp/js8-phase0}"
FT8_LIB="${FT8_LIB:-$HOME/ft8_lib_ft2}"
mkdir -p "$WORK"

echo "═══ 1. constants vs JS8Call ══════════════════════════════════════════"
./check_against_reference.sh "${1:-2000}"

echo
echo "═══ 2. native decoder, end to end ════════════════════════════════════"
gcc -O2 -Wall -Wextra -I. -I "$FT8_LIB" -o "$WORK/js8_decode_test" \
    js8_decode_test.c js8_decode.c js8_osd.c js8_subtract.c js8_encode.c js8_constants.c \
    "$FT8_LIB/fft/kiss_fft.c" "$FT8_LIB/fft/kiss_fftr.c" -lm
"$WORK/js8_decode_test"

echo
echo "--- reported SNR vs known SNR ---"
"$WORK/js8_decode_test" --snracc 6

echo
echo "═══ 3. message layer vs JS8Call ══════════════════════════════════════"
node js8_frames_test.mjs

echo
echo "═══ 4. reassembly ════════════════════════════════════════════════════"
node js8_reassembly_test.mjs

echo
echo "═══ 5. slot scheduling ═══════════════════════════════════════════════"
node js8_slots_test.mjs

echo
echo "═══ 6. spotting / autorun ════════════════════════════════════════════"
node js8_autorun_test.mjs

echo
echo "═══ 7. built wasm ════════════════════════════════════════════════════"
if [[ -f ../../frontend/public/decoders/js8.wasm ]]; then
    for sm in 0 1 2 3 4; do "$WORK/js8_decode_test" --dump "$sm" "$WORK/slot_$sm.f32" > /dev/null; done
    JS8_SLOT_DIR="$WORK" node js8_wasm_test.mjs
    echo
    echo "═══ 8. full chain: audio -> wasm -> message ══════════════════════════"
    JS8_WORK="$WORK" node js8_chain_test.mjs
else
    echo "  skipped: js8.wasm not built (run ./build_js8_wasm.sh)"
fi

echo
echo "all JS8 tests passed"
