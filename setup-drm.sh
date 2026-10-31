#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-drm.sh
#  Build the DRM decoder that autorun/drm-helper.js runs for each listener:
#
#    ubersdr-drm — a headless Dream (GPL-2-or-later) by MadPsy for UberSDR,
#    https://github.com/madpsy/ubersdr-drm. It reads zero-IF I/Q on stdin and
#    writes 12 kHz audio on stdout, with its status as JSON on fd 3.
#
#  Codecs: plain DRM AAC is decoded by FAAD2's DRM build (libfaad_drm.so.2,
#  from the distribution's libfaad2), opened at run time. xHE-AAC needs
#  fdk-aac 2.0.3 or newer — 2.0.2, which Debian and Ubuntu still package,
#  crashes on a DRM xHE-AAC service — so ubersdr-drm's own build.sh fetches
#  2.0.3 and links it in statically. That happens here, on this station:
#  PhantomSDR-Plus ships no decoder binary.
#
#  Output: drm/bin/ubersdr-drm (not tracked by git). The source is cloned into
#  drm/src at the commit below, which is the one this station was tested with.
#
#    ./setup-drm.sh            build (or rebuild) the decoder
#
#  Idempotent — safe to re-run. Run it as your normal user: it calls sudo
#  itself only when a package is missing. SDR_SKIP_DEPS=1 skips packages.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/drm/src"
BIN="$HERE/drm/bin"
REPO="https://github.com/madpsy/ubersdr-drm.git"
REV="93cd711"

APT_PKGS="build-essential cmake pkg-config git libfftw3-dev libspeexdsp-dev zlib1g-dev libfaad2"
DNF_PKGS="gcc-c++ make cmake pkgconf git fftw-devel speexdsp-devel zlib-devel faad2-libs"
PAC_PKGS="base-devel cmake pkgconf git fftw speexdsp zlib faad2"
ZYP_PKGS="gcc-c++ make cmake pkg-config git fftw3-devel speexdsp-devel zlib-devel libfaad2 libfaad_drm2"

missing_apt() {
    local p out=""
    for p in $APT_PKGS; do
        dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "ok installed" || out="$out $p"
    done
    echo "$out"
}

echo "Checking the packages ubersdr-drm needs..."
if command -v dpkg-query >/dev/null 2>&1 && [ -z "$(missing_apt)" ]; then
    green "✅ all packages already installed"
else
    sdr_install_packages "$APT_PKGS" "$DNF_PKGS" "$PAC_PKGS" "$ZYP_PKGS"
fi

echo ""
echo "Fetching ubersdr-drm ($REV)..."
mkdir -p "$HERE/drm"
if [ ! -d "$SRC/.git" ]; then
    git clone -q "$REPO" "$SRC" || die "could not clone $REPO"
fi
git -C "$SRC" fetch -q origin || yellow "  (fetch failed — building the copy already here)"
git -C "$SRC" checkout -q -f "$REV" || die "commit $REV not found in $SRC"

# Local patch: --mlciter N, Dream's iterative MSC decoding. drm-helper.js runs
# the decoder with 2 iterations: on a 20-minute RRI 21470 kHz recording at
# 13 dB WMER that took clean audio frames from 90.8 % to 91.5 % and dropouts
# from 155 to 151; 3 or 4 iterations were no better. checkout -f above undoes
# the patch first, so a re-run applies it to clean source.
git -C "$SRC" apply - <<'PATCH' || die "could not patch ubersdr-drm (--mlciter)"
--- a/src/main-ubersdr.cpp
+++ b/src/main-ubersdr.cpp
@@ -265,6 +265,7 @@ int main(int argc, char **argv)
     std::string writeWav;    // empty = no WAV output
     int  statusFd = 3;       // descriptor for the JSON Lines status channel
     bool wantStatus = true;
+    int  mlcIter = -1;       // Dream "mlciter" (0..4); -1 keeps Dream's 1

     for (int i = 1; i < argc; ++i) {
         if (strcmp(argv[i], "--input-sample-rate") == 0 && i + 1 < argc) {
@@ -283,6 +284,8 @@ int main(int argc, char **argv)
             iqMode = static_cast<EInChanSel>(atoi(argv[++i]));
         } else if (strcmp(argv[i], "--file") == 0 && i + 1 < argc) {
             inputFile = argv[++i];
+        } else if (strcmp(argv[i], "--mlciter") == 0 && i + 1 < argc) {
+            mlcIter = atoi(argv[++i]);
         } else if (strcmp(argv[i], "--write-wav") == 0 && i + 1 < argc) {
             writeWav = argv[++i];
         }
@@ -342,6 +345,7 @@ int main(int argc, char **argv)
     // after LoadSettings() below.
     Settings.Put("Receiver", "samplerateaud", 12000);
     Settings.Put("Receiver", "inchansel", static_cast<int>(iqMode));
+    if (mlcIter >= 0) Settings.Put("Receiver", "mlciter", mlcIter);

     // If a file is specified, use it as the input device (Dream's CAudioFileIn)
     if (!inputFile.empty()) {
PATCH

# Local patch: dropouts. Reverb::apply() took the audio buffers by value, so
# its fade-out, silence and reverb tail never reached the output: on a bad
# frame the decoder replayed the previous frame instead (for xHE-AAC 107 ms,
# again for every bad frame in a row — a stutter/buzz during fades), and its
# integer-division fades were 0. By reference and with real fades, a dropout
# is a short fade into Dream's reverb tail, as upstream Dream does.
git -C "$SRC" apply - <<'PATCH' || die "could not patch ubersdr-drm (dropout masking)"
diff --git a/src/sourcedecoders/reverb.cpp b/src/sourcedecoders/reverb.cpp
--- a/src/sourcedecoders/reverb.cpp
+++ b/src/sourcedecoders/reverb.cpp
@@ -15,7 +15,7 @@ void Reverb::Init(int outputSampleRate, bool bUse)
     OldRight.Init(0);
 }
 
-ETypeRxStatus Reverb::apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REAL> CurLeft, CVector<_REAL> CurRight)
+ETypeRxStatus Reverb::apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REAL>& CurLeft, CVector<_REAL>& CurRight)
 {
     int iResOutBlockSize = CurLeft.Size();
     if(OldLeft.Size()==0) OldLeft.Init(iResOutBlockSize, 0.0);
@@ -47,7 +47,7 @@ ETypeRxStatus Reverb::apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REA
             for (int i = 0; i < iResOutBlockSize; i++)
             {
                 /* Linear attenuation with time of OLD buffer */
-                const _REAL rAtt = 1.0 - _REAL(i / iResOutBlockSize);
+                const _REAL rAtt = 1.0 - _REAL(i) / iResOutBlockSize;
 
                 OldLeft[i] *= rAtt;
                 OldRight[i] *= rAtt;
@@ -55,7 +55,7 @@ ETypeRxStatus Reverb::apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REA
                 if (okToReverb)
                 {
                     /* Fade in input signal for reverberation to avoid clicks */
-                    const _REAL rAttRev = _REAL( i / iResOutBlockSize);
+                    const _REAL rAttRev = _REAL(i) / iResOutBlockSize;
 
                     /* Cross-fade reverberation effect */
                     const _REAL rRevSam = (1.0 - rAtt) * AudioRev.ProcessSample(OldLeft[i] * rAttRev, OldRight[i] * rAttRev);
@@ -118,7 +118,7 @@ ETypeRxStatus Reverb::apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REA
             for (int i = 0; i < iResOutBlockSize; i++)
             {
                 /* Linear attenuation with time */
-                const _REAL rAtt = _REAL( i / iResOutBlockSize);
+                const _REAL rAtt = _REAL(i) / iResOutBlockSize;
 
                 tempLeft[unsigned(i)] *= rAtt;
                 tempRight[unsigned(i)] *= rAtt;
diff --git a/src/sourcedecoders/reverb.h b/src/sourcedecoders/reverb.h
--- a/src/sourcedecoders/reverb.h
+++ b/src/sourcedecoders/reverb.h
@@ -10,7 +10,7 @@ class Reverb
 public:
     Reverb();
     void Init(int outputSampleRate, bool bUse);
-    ETypeRxStatus apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REAL> CurLeft, CVector<_REAL> CurRight);
+    ETypeRxStatus apply(bool bCurBlockOK, bool bCurBlockFaulty, CVector<_REAL>& CurLeft, CVector<_REAL>& CurRight);
 private:
     bool bAudioWasOK, bUseReverbEffect;
     CVector<_REAL> OldLeft;
PATCH

# Local patch: three faults that turned bad xHE-AAC reception into noise or
# long silence (found on CNR-1 15290 kHz, 2026-10-25):
#  - Dream prints diagnostics to stdout, the audio pipe; an odd-length line
#    ("DRM xHE-AAC payload UNDERRUN") shifted the 16-bit stream by a byte and
#    the listener heard loud white noise until the next one. The audio now
#    has a private copy of stdout and fd 1 goes to stderr.
#  - A super frame whose header failed its CRC, or whose directory gave a
#    frame bigger than a whole super frame, was decoded anyway; its carry-over
#    bytes then cut every later frame in the wrong place. Such a super frame
#    is now dropped and the decoder resyncs on the next.
#  - After a corrupt frame the xHE-AAC decoder could turn normal frames into
#    silence for minutes; 2.7 s of that restarts the audio decoder.
# On a 10-minute fading recording: noise 228 s -> 0.1 s, programme 153 s ->
# 515 s of 539 s; plain AAC (RRI 21470 kHz) decodes exactly as before.
git -C "$SRC" apply - <<'PATCH' || die "could not patch ubersdr-drm (xHE-AAC faults)"
diff --git a/src/MSC/xheaacsuperframe.cpp b/src/MSC/xheaacsuperframe.cpp
--- a/src/MSC/xheaacsuperframe.cpp
+++ b/src/MSC/xheaacsuperframe.cpp
@@ -64,11 +64,14 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
     CRCObject.Reset(8);
     CRCObject.AddByte((frameBorderCount << 4) | bitReservoirLevel);
 
-    if(CRCObject.CheckCRC(asf.Separate(8))) {
-        //cerr << endl << "superframe crc ok" << endl;
-    }
-    else {
-        //cerr << endl << "superframe crc bad but will hope the frameBorderCount is OK" << endl;
+    if(!CRCObject.CheckCRC(asf.Separate(8))) {
+        /* A bad header means wrong frame borders: the bytes carried over to
+           the next super frame would then be misaligned, and every frame
+           after it cut in the wrong place (silence for minutes on CNR-1
+           15290 kHz). Drop the carry-over and resync on the next one. */
+        payload.clear();
+        audioFrame.resize(0);
+        return false;
     }
     // TODO handle reservoir
 //    unsigned bitResLevel = (bitReservoirLevel+1) * 384 * numChannels;
@@ -80,7 +83,8 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
     // get the payload
     for (size_t i=2; i < directory_offset; i++) {
         if (asf.Size() == 0) {
-            printf("DRM xHE-AAC asf UNDERRUN 1\n");
+            fprintf(stderr, "DRM xHE-AAC asf UNDERRUN 1\n");
+            payload.clear();
             return false;
         }
         payload.push_back(asf.Separate(8));
@@ -94,7 +98,8 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
         // get the directory
         for (int i = int(frameBorderCount-1); i >= 0; i--) {
             if (asf.Size() == 0) {
-                printf("DRM xHE-AAC asf UNDERRUN 2\n");
+                fprintf(stderr, "DRM xHE-AAC asf UNDERRUN 2\n");
+                payload.clear();
                 return false;
             }
             unsigned frameBorderIndex = asf.Separate(12);
@@ -171,6 +176,17 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
         return ok;
     }
 
+    /* A frame bigger than a whole super frame cannot be real: such borders
+       come from a corrupt directory, and one garbage frame of 600+ bytes
+       (normal: 85-150) can leave the decoder silent for minutes. */
+    for (size_t i=0; i < frameSize.size(); i++) {
+        if (frameSize[i] > superFrameSize) {
+            payload.clear();
+            audioFrame.resize(0);
+            return false;
+        }
+    }
+
     size_t bytesInFrames = 0;
     for (size_t i=0; i < frameSize.size(); i++) bytesInFrames += frameSize[i];
     size_t next = payload.size() - bytesInFrames;
@@ -198,7 +214,8 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
         #endif
 
         if (payload.empty()) {
-            printf("DRM xHE-AAC payload UNDERRUN\n");
+            fprintf(stderr, "DRM xHE-AAC payload UNDERRUN\n");
+            payload.clear();
             return false;
         }
         audioFrame[i].push_back(payload.front());
@@ -210,6 +227,9 @@ bool XHEAACSuperFrame::parse(CVectorEx<_BINARY>& asf)
         }
     }
 
+    /* What is left belongs to the next super frame's first frame, which
+       is always smaller than a super frame; more than that is stale. */
+    if (payload.size() > superFrameSize) payload.clear();
     //cerr << "remaining payload is " << payload.size() << " bytes" << endl;
     //size_t allocated = 2 + 2*frameBorderCount; // bytes of the superframe for the header and directory
     //allocated += bytesInFrames - start; // do count bytes in frames but not the ones from previous superframes
diff --git a/src/sound/soundpipe.cpp b/src/sound/soundpipe.cpp
--- a/src/sound/soundpipe.cpp
+++ b/src/sound/soundpipe.cpp
@@ -7,6 +7,7 @@
 /* 1 = feed stdin IQ to Dream untouched.  See soundpipe.h. */
 int g_iqUpFactor = 1;
 bool g_verbose = false;
+FILE* g_pcmOut = stdout;
 
 /* Half-length of each polyphase branch; 32 taps per branch gives a stopband
    well below the DRM noise floor while staying cheap at these rates. */
@@ -210,11 +211,11 @@ bool CSoundOutPipe::Write(CVector<short>& psData)
         fprintf(stderr, "[soundpipe] Write() call #%d, n=%d samples\n", callCount, n);
     }
     for (int i = 0; i < n; i += 2) {
-        if (fwrite(&psData[i], sizeof(short), 1, stdout) != 1) {
+        if (fwrite(&psData[i], sizeof(short), 1, g_pcmOut) != 1) {
             return true; // write error
         }
         totalWritten++;
     }
-    fflush(stdout);
+    fflush(g_pcmOut);
     return false; // false = OK
 }
diff --git a/src/sound/soundpipe.h b/src/sound/soundpipe.h
--- a/src/sound/soundpipe.h
+++ b/src/sound/soundpipe.h
@@ -16,6 +16,7 @@ extern int g_iqUpFactor;
 
 /* Per-call read/write tracing.  Off unless --verbose is given. */
 extern bool g_verbose;
+extern FILE* g_pcmOut;   /* the audio; fd 1 itself goes to stderr (see main) */
 
 /*
  * CSoundInPipe / CSoundOutPipe
diff --git a/src/sourcedecoders/AudioSourceDecoder.cpp b/src/sourcedecoders/AudioSourceDecoder.cpp
--- a/src/sourcedecoders/AudioSourceDecoder.cpp
+++ b/src/sourcedecoders/AudioSourceDecoder.cpp
@@ -154,6 +154,25 @@ CAudioSourceDecoder::ProcessDataInternal(CParameter & Parameters)
             iResOutBlockSize = vecTempResBufOutCurLeft.Size();
 
             bCurBlockOK = (eDecError == CAudioCodec::DECODER_ERROR_OK);
+            /* Stuck-decoder watchdog: after a corrupt frame the xHE-AAC
+               decoder can keep turning normal-sized frames into silence for
+               minutes (CNR-1 15290 kHz: 11 minutes, while a fresh decoder on
+               the same signal plays). Real programme pauses were at most
+               1.2 s of such frames, so 25 in a row (2.7 s) restart it. */
+            if (bCurBlockOK) {
+                const int nn = vecTempResBufOutCurLeft.Size();
+                double e = 0.0;
+                for (int k = 0; k < nn; k++) e += vecTempResBufOutCurLeft[k] * vecTempResBufOutCurLeft[k];
+                const bool silent = nn > 0 && e / nn < 32768.0 * 32768.0 * 1e-7;   /* -70 dBFS */
+                if (silent && audio_frame.size() >= 60) {
+                    if (++iSilentFrames >= 25) {
+                        cerr << "audio decoder silent on good frames — restarting it" << endl;
+                        iSilentFrames = 0;
+                        SetInitFlag();
+                    }
+                }
+                else iSilentFrames = 0;
+            }
 #ifdef UBERSDR_AUDIO_DEBUG
             { static int nTot=0, nBad=0;
               nTot++; if(eDecError != CAudioCodec::DECODER_ERROR_OK) nBad++;
diff --git a/src/sourcedecoders/AudioSourceDecoder.h b/src/sourcedecoders/AudioSourceDecoder.h
--- a/src/sourcedecoders/AudioSourceDecoder.h
+++ b/src/sourcedecoders/AudioSourceDecoder.h
@@ -120,6 +120,7 @@ protected:
     virtual void ProcessDataInternal(CParameter& Parameters);
     void CloseDecoder();
     Reverb reverb;
+    int iSilentFrames = 0;  /* good frames in a row that decoded to silence */
 };
 
 #endif // AUDIOSOURCEDECODER_H
--- a/src/main-ubersdr.cpp
+++ b/src/main-ubersdr.cpp
@@ -258,6 +258,18 @@
  * ---------------------------------------------------------------------- */
 int main(int argc, char **argv)
 {
+    /* Only the audio may reach stdout. Dream prints diagnostics with printf
+       and cout here and there (xHE-AAC "payload UNDERRUN" on a bad super
+       frame), and one odd-length line shifts the int16 stream by a byte:
+       loud white noise until the next one shifts it back. So the audio gets
+       a private copy of stdout (fd >= 10, clear of the status fd 3) and fd 1
+       itself goes to stderr. */
+    {
+        const int pcmFd = fcntl(STDOUT_FILENO, F_DUPFD, 10);
+        FILE* f = pcmFd >= 0 ? fdopen(pcmFd, "wb") : nullptr;
+        if (f && dup2(STDERR_FILENO, STDOUT_FILENO) >= 0) g_pcmOut = f;
+    }
+
     /* --- Parse our own arguments ---------------------------------------- */
     int inputSampleRate = 12000;
     EInChanSel iqMode = CS_IQ_POS_ZERO; // default: zero-IF baseband from UberSDR
PATCH

echo ""
echo "Building (a few minutes the first time; it fetches fdk-aac 2.0.3)..."
JOBS="$(nproc 2>/dev/null || echo 2)"
[ "$JOBS" -gt 4 ] && JOBS=4          # keep the build cool; it is a one-off
( cd "$SRC" && ./build.sh -j "$JOBS" ) || die "ubersdr-drm build failed (see above)"

ARCH_BIN="$(ls "$SRC"/build/ubersdr-drm_* 2>/dev/null | head -1)"
[ -x "$ARCH_BIN" ] || die "build finished but no ubersdr-drm_* binary in $SRC/build"
mkdir -p "$BIN"
install -m 755 "$ARCH_BIN" "$BIN/ubersdr-drm"

echo ""
green "✅ DRM decoder ready: $BIN/ubersdr-drm"
echo "   Start the helper with:  node autorun/drm-helper.js"
