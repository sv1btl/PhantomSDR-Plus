# HFDL decoder in WebAssembly

HFDL (HF Data Link) decoder behind the **HFDL** decoder button. It runs in the browser (`frontend/src/hfdl.worker.js`) and reads the USB audio as the server demodulates it, before the listening aids (NR/NB/NS/AN), like the other PhantomSDR-Plus decoders. The panel is `frontend/src/lib/HfdlPanel.svelte`, the ground-station list `frontend/src/lib/hfdlStations.js`.

Ported from PhantomSDR-ORSAT (F1NSK), which built it on top of:

- **dumphfdl 1.7.0** — Tomasz Lemiech, <https://github.com/szpajder/dumphfdl>, GPL-3.0-or-later. The files needed are in `dumphfdl/`; `hfdl.c` becomes `hfdl_core.c` there (no threads, no SDR channeliser, baseband input at 5400 samples/s). `systable.conf` is the ground-station table (version 52).
- **libacars 2.2.1** — Tomasz Lemiech, MIT; downloaded at build time. `libacars-config/` holds the two files CMake would generate.
- **liquid-dsp** — Joseph Gaeddert, MIT; downloaded at build time.
- **libconfig** — Mark Lindner, LGPL-2.1; downloaded at build time.

`hfdl_wasm.c` (GPL-3.0-or-later) is the glue: real audio to baseband (subcarrier at 1440 Hz), a search for the exact audio rate (±1 %, 11 rates) and frequency offset (±240 Hz in 80 Hz steps, for receiver clock error or approximate tuning) — 77 demodulators in parallel while searching, one once it has locked on the one that decodes. Duplicates are removed; output is JSON plus text.

## How it compares with the KiwiSDR HFDL extension

KiwiSDR runs stock dumphfdl on the Kiwi itself, fed complex IQ (post-AGC, resampled 12 kHz to 36 kHz, scaled to ±1). This decoder runs in the listener's browser on real USB audio instead. Measured on 2026-10-23 against a native build of stock dumphfdl 1.7.0 on identical input:

- Kiwi's own test burst (`HFDL_test_12k_cf13270_df13270.wav`, Hat Yai squitter) in Gaussian noise, 4 noise seeds × 3 bursts: at −10 dB stock 12/12, this one 10/12; at −12 dB stock 10/12, this one 11/12; at −14 dB stock 2/12, this one 0/12. The two are within about 0.5 dB of each other.
- Input level makes no difference from −15 to −75 dBFS rms, including int16 quantisation at the server's mono level (about −67 dBFS, peaks near 67 counts). The server-side ×128 mono scale that ORSAT added is not needed here.
- On air, 4 minutes of 17967 kHz (Al Muharraq) captured from the RX888: stock 38 frames, this one 37; 21955 kHz (Canarias): 11 and 10.

## Rebuilding

```
cd jsdsp/hfdl_wasm
bash build_hfdl_wasm.sh
```

Needs emscripten (emsdk), git and cmake. The script writes `frontend/public/decoders/hfdl.wasm`, `frontend/public/decoders/hfdl_systable.conf` and `frontend/src/modules/hfdl.mjs`, which are already in the repository: rebuilding is only needed when the decoder itself changes.
