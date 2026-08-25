#!/usr/bin/env bash
# Compiles just enough of JS8Call's lib/ to run js8a_decode standalone.
set -e
mkdir -p /build && cd /build
cp -r /js8call/* . 2>/dev/null || true
cp /out/ref_decode.f90 .

# Files that belong to the jt9 side of the tree, not the JS8 decoder, and that
# drag in shared-memory or FFTW-threads symbols we have no use for.
SKIP='ldpcsim|_params\.f90$|jt9|chkfft|all_fft|filbig|fil4|jt65|decoder\.f90|sfrsd'

FFLAGS="-O2 -fbacktrace -fno-range-check -ffixed-line-length-none -Wno-argument-mismatch -fallow-argument-mismatch -I. -Ilib -Ilib/js8 -Ilib/ft8 -J."

echo "[ref] compiling C/C++ helpers"
g++ -O2 -c -o crc12.o lib/crc12.cpp
g++ -O2 -c -o crc14.o lib/crc14.cpp
g++ -O2 -c -o crc10.o lib/crc10.cpp
gcc -O2 -c -o gran.o lib/gran.c
gcc -O2 -c -o init_random_seed.o lib/init_random_seed.c

echo "[ref] compiling Fortran (this takes a while)"
# Order matters: modules before their users.
# Dependency order, hand-resolved: each of these provides a module the next
# ones use. gfortran has no automatic dependency resolution for .mod files.
for f in lib/fftw3mod.f90 lib/iso_c_utilities.f90 lib/timer_module.f90 \
         lib/timer_impl.f90 lib/crc.f90 lib/four2a.f90 lib/js8a_module.f90; do
    [ -f "$f" ] && gfortran $FFLAGS -c "$f" -o "$(basename ${f%.f90}).o"
done

# The remaining modules resolve themselves after a few passes: compiling in a
# loop lets each succeed once whatever it uses has been built.
for pass in 1 2 3 4; do
    for f in $(ls lib/*.f90 lib/js8/*.f90 lib/ft8/*.f90 2>/dev/null | grep -vE "$SKIP"); do
        o="$(basename ${f%.f90}).o"
        [ -f "$o" ] && continue
        gfortran $FFLAGS -c "$f" -o "$o" 2>/dev/null || true
    done
done

# Everything js8a_decode reaches, compiled individually; the link step reports
# anything still missing.
[ -f lib/usleep.c ] && gcc -O2 -c -o usleep.o lib/usleep.c
[ -f lib/wrapkarn.c ] && gcc -O2 -c -o wrapkarn.o lib/wrapkarn.c

gfortran $FFLAGS -O0 -g -fcheck=all -c lib/js8a_decode.f90 -o js8a_decode.o
gfortran $FFLAGS -O0 -g -fcheck=all -c ref_decode.f90 -o ref_decode.o

# Drop objects built from standalone `program` units: each carries its own
# main() and the link would see several.
for f in $(ls lib/*.f90 lib/js8/*.f90 lib/ft8/*.f90 2>/dev/null); do
    if grep -qiE '^[[:space:]]*program[[:space:]]' "$f"; then
        rm -f "$(basename ${f%.f90}).o"
    fi
done

echo "[ref] linking"
gfortran -o ref_decode ref_decode.o $(ls *.o | grep -v '^ref_decode.o$') \
    -lfftw3f -lfftw3 -lstdc++ 2>&1 | grep -E 'undefined|error' | head -20 || true
[ -x ./ref_decode ] || { echo "[ref] LINK FAILED"; exit 1; }

# js8a_decode puts several megabytes of work arrays on the stack (s(1920,372)
# alone is ~2.9 MB), which overflows the default 8 MB once nested.
ulimit -s unlimited || ulimit -s 65536 || true

echo "[ref] running $SLOTS slots from offset $OFFSET"
./ref_decode /work/input.f32 "$OFFSET" "$SLOTS" > /out/ref_decode.txt 2>/tmp/ref_err.txt || {
    echo "[ref] decoder exited non-zero:"; tail -12 /tmp/ref_err.txt; }
echo "[ref] $(grep -c '^DEC' /out/ref_decode.txt || echo 0) decodes"
