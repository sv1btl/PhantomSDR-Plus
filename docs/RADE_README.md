# RADE v1 Digital Voice for PhantomSDR-Plus

> **Port 9012.** On a station set up by `install.sh` the sidecar listens only inside the computer, on `PORT_RADE` (9012), and the page reaches it as `/rade` on the public port 9000 through `proxy.py`, so there is nothing to open on the router.

**RADE** (Radio AutoencoDEr) is FreeDV's flagship HF digital voice mode. It uses a Machine Learning / DSP hybrid (the FARGAN neural vocoder) to deliver high-quality speech over HF radio at SNRs as low as −2 dB, in just 1500 Hz of RF bandwidth — narrower than an SSB signal.

This document covers the complete integration of RADE v1 receive support into PhantomSDR-Plus, implemented as a Python sidecar (`rade_helper.py`) that bridges the browser to the `radae_rxe.py` + `lpcnet_demo` decode pipeline.

It also decodes **RADE V2 (beta)**, the new waveform of FreeDV 3.0, with the **RADE-v2U** button — see [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

## Installing it — the short way

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

That is the whole installation. The script installs the system packages through whichever package manager the machine has (apt, pacman, dnf or zypper), falls back to pip for anything a distribution does not ship, upgrades `websockets` if the distro version is older than the 11.0 the sidecar needs, clones and builds radae, checks the model weights, rebuilds the frontend and starts the sidecar. On Ubuntu 22.04 it hands over to `install_rade_ubuntu22.sh` for you. `./install.sh` offers to run it as part of the normal PhantomSDR-Plus installation, so on a fresh machine RADE is already there. It also builds FreeDV's rade_c for RADE V2 (beta); if that step fails, RADE V1 is installed anyway.

**This document explains how RADE works and how to run it.** The installation is always done by `./install_rade.sh` (or by `./install.sh`, which offers it).

---

## Table of Contents

1. [Installing it — the short way](#installing-it--the-short-way)
2. [How It Works](#how-it-works)
3. [Architecture Overview](#architecture-overview)
4. [RADEL vs RADEU](#radel-vs-radeu)
   - [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2)
5. [Prerequisites](#prerequisites)
6. [Sidecar control](#sidecar-control)
7. [Port 9012](#port-9012)
8. [Using RADE in the Browser](#using-rade-in-the-browser)
9. [Verification and Debugging](#verification-and-debugging)
10. [Environment Variables](#environment-variables)
11. [Troubleshooting](#troubleshooting)
12. [Updating RADE v1](#updating-rade-v1)

---

## How It Works

RADE v1 cannot run in the browser — it requires PyTorch and the FARGAN neural vocoder, which are too large for WASM. The solution is a Python sidecar process (`rade_helper.py`) that runs on the same server as PhantomSDR-Plus.

> **Important:** `freedv_rx` from the codec2 repository does **not** support RADEV1. The RADE decode pipeline lives entirely in the separate `radae` repository by David Rowe (VK5DGR). Do not attempt to use codec2's `freedv_rx` for RADE.

When you select RADE in the browser:

1. The frontend sets the underlying demodulation to USB or LSB — the C++ server demodulates the SSB signal as normal.
2. The raw demodulated PCM is tapped in `audio.js` **before** any mute or squelch gating — `radae_rxe.py` needs continuous input to maintain frame sync.
3. Each PCM chunk is zero-padded from real f32 to complex f32 (real + 0.0 imaginary) — this is what `radae_rxe.py` expects on stdin.
4. The sidecar pipes those samples into `radae_rxe.py`, which outputs vocoder features.
5. `lpcnet_demo -fargan-synthesis` converts the features into s16 speech at 16000 Hz.
6. The sidecar converts s16 → f32 and sends it back to the browser as binary WebSocket frames.
7. The browser plays the decoded speech via the Web Audio API at 16000 Hz.

The C++ server (`spectrumserver.cpp`) is not modified at all.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:9000/rade                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 9012)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL vs RADEU

RADE v1 is always transmitted over SSB. By convention:

| Mode  | Sideband | Use on bands                             |
|-------|----------|------------------------------------------|
| RADEL | LSB      | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB      | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## RADE V2 (beta) — RADE2

**RADE V2** is the new waveform of FreeDV 3.0: about 800 Hz wide instead of 1500 Hz, with no pilot symbols, and about 3 dB more sensitive at low SNR. It is **still a beta at FreeDV** — only stations testing FreeDV 3.0 send it, and the signal may still change before the release. PhantomSDR-Plus decodes it next to RADE V1:

| Button | Version | Sideband | Filter |
|---|---|---|---|
| **RADE-v2U** (RADE2) | RADE V2 (beta) | USB on every band | 1040–1930 Hz |
| **RADE-v1L** / **RADE-v1U** (RADEL / RADEU) | RADE V1 | LSB / USB | 700–2200 Hz |

V2 is decoded on the server by FreeDV's C port **rade_c** (`radae_rx --v2` and its own `lpcnet_demo`), built in its own folder `~/rade_c`, so the V1 installation in `~/radae` is never touched. `./install_rade.sh` clones and builds it (step "rade_c (RADE V2, beta)"); if that step fails it only warns, and RADE V1 is installed anyway. `rade_helper.py` uses rade_c from the next RADE2 connection — no restart is needed — and without it RADE2 tells the listener "RADE V2 is not installed on this station yet". A V2 decode costs about 1 % of one CPU core per listener (V1: about 70–80 %).

**On the air**

- Tune within about **±30 Hz** of the station's frequency. Further off, V2 still shows "Synced" but the speech is garbled.
- Each over starts **2–3 s late**: while V2 locks it keeps the signal, then plays the beginning of the over.
- Below about **−2 dB SNR** V2's audio is muted and the panel says "Searching for signal…" — unless the last 2 seconds look like real V2 (the decoder sees its signal most of the time and its frequency estimate stays steady); then it plays down to about **−6 dB**. On busy LSB phone frequencies heard on USB (40 m) V2 can lock onto ordinary voices and play garbled sound; those never look steady, so they stay muted. `RADE_V2_MIN_SNR` and `RADE_V2_WEAK_SNR` set the two levels.
- Between overs the panel goes back to "Searching for signal…".

**When FreeDV 3.0 is released**, run `./install_rade.sh` again — or `git pull` in `~/rade_c` and `cmake --build build` — and new RADE2 connections then use the new build.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| PhantomSDR-Plus | any | with Vite/Svelte frontend |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | tested |
| Python | 3.8+ | for `rade_helper.py` and `radae_rxe.py` |
| radae repo | latest master | provides `radae_rxe.py` and `lpcnet_demo` |
| cmake | 3.10+ | to build `lpcnet_demo` from radae |
| PyTorch | 2.0+ | required by `radae_rxe.py` |
| Node.js | 16+ | for `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — all versions supported |
| matplotlib | any | required by `radae_rxe.py` at import time |
| numpy | 1.23+ | required; also enables resampling |
| scipy | any | optional, enables accurate resampling |

---

## Sidecar control

**You normally do not need a separate RADE control script.** The receiver launchers start the sidecar once the server is confirmed up, restart it if it exits, and report its state in their closing summary — `✔ RADE sidecar running`, or a `·` note explaining why it was not activated (not installed, `RADE_ENABLED=0`, or no `python3`). `./stop-websdr.sh` stops it along with the server. To run the server without RADE, start it with `RADE_ENABLED=0`.

`rade.sh` ships for standalone use — running the sidecar without the PhantomSDR-Plus launcher, or testing it on its own:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Sidecar activity is logged to `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Do not mix the two while the server is running.** If a launcher's watchdog is active it will bring the sidecar back within about five seconds, so `./rade.sh stop` looks like it failed. To stop RADE while the server runs, either start the server with `RADE_ENABLED=0`, or stop everything with `./stop-websdr.sh`.

> If you do run `rade.sh` standalone, **always use `./rade.sh stop`** — `pkill -f rade_helper.py` alone will not beat its own watchdog, which respawns the process within 3 seconds.

---

## Port 9012

The sidecar listens on TCP port **9012**, inside the computer only. The browser reaches it through `proxy.py` as `/rade` on the public port 9000, so no other port has to be opened on the router or in a firewall.

```bash
# Is the sidecar listening?
ss -tlnp | grep 9012
```

---

## Using RADE in the Browser

1. Open your PhantomSDR-Plus web interface
2. Find active stations at **[qso.freedv.org](https://qso.freedv.org)**
3. Tune to the station's dial frequency
4. In **Decoder Options**, select:
   - **RADE v2 · RADE2** for RADE V2 (beta), USB on every band
   - **RADE v1 — RADEL (LSB)** for 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** for 20 m / 17 m / 15 m / 12 m / 10 m
5. Click **Decoder: ON**

### The RADE-v1L / RADE-v1U buttons (one-touch)

Steps 4 and 5 can be replaced by a single press. A pair of **RADE-v1L** / **RADE-v1U** buttons is available in three places:

- next to the **Modes** heading on the main panel;
- inside the **Modes** popup window;
- inside the **Bands** popup window.

Pressing one selects the decoder, switches the decoder ON, closes the popup you pressed it in, and scrolls the RADE panel into view. The button turns blue while RADE is running. **Press the same button again to switch RADE off** — the panel closes and mode and passband revert as described below. The buttons, the **Decoder Options** dropdown and the ON/OFF button all share the same state.

A **RADE-v2U** button sits before RADE-v1L and RADE-v1U in the same three places (and a RADE2 button on `/mobile`); it starts RADE V2 (beta) on USB — see [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

### Panel indicator states

| Indicator | Meaning |
|---|---|
| 🔴 Red — "Connecting to sidecar…" | Port 9012 unreachable or sidecar not running |
| 🟡 Yellow — "Searching for signal…" | Sidecar connected, no RADE frame detected yet |
| 🟢 Green — "Synced · SNR x.x dB" | Decoding — speech is playing |

### When you turn the decoder OFF

Mode and passband automatically revert to the correct default for the current frequency as defined in `bands-config.js` — identical to FAX, NAVTEX, FSK.

---

## Verification and Debugging

### Is the sidecar running?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 9012
```

### Watch live activity

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

When a browser connects:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Browser console (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:9000/rade
```
Good — WebSocket opened. The Hz value matches your server's `audioOutputSps` (typically 8000–12000 Hz).

```
[RADE] sidecar socket error
```
The sidecar is unreachable — check that it is running (`ss -tlnp | grep 9012`) and that `proxy.py` is running.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RADE_HELPER_PORT` | `9012` | TCP port the sidecar listens on |
| `RADE_HELPER_HOST` | `0.0.0.0` | Bind address (`127.0.0.1` if behind a proxy) |
| `RADAE_DIR` | `~/radae` | Root of the radae repository |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Model weights |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | lpcnet_demo binary |
| `RADE_AUXDATA` | `1` | Set to `0` to pass `--noauxdata` to `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | PyTorch/OpenBLAS threads per `radae_rxe.py` instance — limits CPU usage |
| `RADE_PIN_CORES` | `1` | Pin each decode pipeline to its own core set; `0` disables pinning |
| `RADE_CORES_PER_CLIENT` | `2` | Cores allocated per client when pinning is enabled |
| `RADE_C_DIR` | `~/rade_c` | Root of rade_c (RADE V2) |
| `RADE_C_RX` | `RADE_C_DIR/build/src/radae_rx` | rade_c receiver program |
| `RADE_C_LPCNET` | `RADE_C_DIR/build/src/lpcnet_demo` | rade_c's own lpcnet_demo |
| `RADE_V2_MIN_SNR` | `-2` | V2 audio is muted below this SNR (dB) |
| `RADE_V2_WEAK_SNR` | `-6` | Down to this SNR (dB) V2 still plays while the signal looks like real V2; set it to `RADE_V2_MIN_SNR` or higher to switch that off |
| `RADE_V2_TARGET_DB` | `-16` | Level V2 speech is brought towards, in dBFS (`0` = off) |

---

## Troubleshooting

### Red banner — "Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &
```

---

### `lpcnet_demo: No such file or directory`

The radae build did not complete. Rebuild:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Yellow indicator — "Searching for signal" — never syncs

- Confirm the correct sideband: RADEL for ≤ 10 MHz, RADEU for > 10 MHz
- Check [qso.freedv.org](https://qso.freedv.org) to confirm a station is currently transmitting
- RADE v1 uses 30 carriers in 1500 Hz BW — it appears as a compact cluster on the waterfall
- Allow up to 1.5 seconds for acquisition

---

### Multiple simultaneous users

Each browser connection spawns its own independent `radae_rxe.py` + `lpcnet_demo` pair, so each user can tune to a different frequency freely.

By default `radae_rxe.py` uses **all available CPU cores** for PyTorch matrix operations, causing ~900% CPU usage per instance. `rade_helper.py` limits this with two optimisations:

1. `OMP_NUM_THREADS=1` (and MKL/OpenBLAS equivalents) — limits PyTorch to 1 thread
2. Numpy-vectorised audio conversion functions — eliminates Python loop overhead

Result: each instance uses roughly **~8–10%** of one core, sufficient for real-time RADE decode. If you hear audio dropouts, raise to 2 threads:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Simultaneous RADE users | Approximate CPU |
|---|---|
| 1 | ~9% |
| 5 | ~45% |
| 10 | ~90% |
| 20 | ~180% |

On an i5-12450H (12 threads) with spectrumserver using ~42% and rx888_stream ~11%, you have roughly **1000% headroom** — enough for **20+ simultaneous** RADE users before CPU becomes a concern.

---

## Updating RADE v1

**To update RADE, run `./install_rade.sh` again.** It pulls the latest radae and rade_c, rebuilds them and restarts the sidecar; the receiver itself needs no restart.

---

*Developed and tested on PhantomSDR-Plus (sv1btl/PhantomSDR-Plus fork) with RX-888 MK2 on Ubuntu 24.04. The C++ server is not modified.*

*RADE is developed by David Rowe VK5DGR and the FreeDV team.* *See [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Full uninstall and fresh re-install

Here's the full teardown before re-running install_rade.sh:
1. Stop the sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Remove the radae repo and build rm -rf ~/radae
3. Remove torch (installed in user local) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Remove apt Python packages (optional — skip if used by other things) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Verify everything is gone python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Fresh install chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh


