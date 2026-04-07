# RADE v1 Digital Voice for PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) is FreeDV's flagship HF digital voice mode. It uses a
Machine Learning / DSP hybrid (the FARGAN neural vocoder) to deliver high-quality
speech over HF radio at SNRs as low as −2 dB, in just 1500 Hz of RF bandwidth —
narrower than an SSB signal.

This document covers the complete integration of RADE v1 receive support into
PhantomSDR-Plus, implemented as a Python sidecar (`rade_helper.py`) that bridges
the browser to the `radae_rxe.py` + `lpcnet_demo` decode pipeline.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Architecture Overview](#architecture-overview)
3. [RADEL vs RADEU](#radel-vs-radeu)
4. [Pre-Installation — System Requirements](#pre-installation--system-requirements)
5. [Step 1 — Clone and Build the radae Repository](#step-1--clone-and-build-the-radae-repository)
6. [Step 2 — Install Python Dependencies](#step-2--install-python-dependencies)
7. [Step 3 — Verify the Decode Pipeline](#step-3--verify-the-decode-pipeline)
8. [Step 4 — Deploy the Patched Files](#step-4--deploy-the-patched-files)
9. [Step 5 — Build the Frontend](#step-5--build-the-frontend)
10. [Step 6 — Install rade.sh Control Script](#step-6--install-radesh-control-script)
11. [Step 7 — Open Port 8074](#step-7--open-port-8074)
12. [Step 8 — Start the Server](#step-8--start-the-server)
13. [Step 9 — Start RADE Manually](#step-9--start-rade-manually)
14. [Step 10 — Using RADE in the Browser](#step-10--using-rade-in-the-browser)
15. [Verification and Debugging](#verification-and-debugging)
16. [Environment Variables](#environment-variables)
17. [Files Changed](#files-changed)
18. [Signal Flow Summary](#signal-flow-summary)
19. [Troubleshooting](#troubleshooting)
20. [Updating RADE v1](#updating-rade-v1)

---

## How It Works

RADE v1 cannot run in the browser — it requires PyTorch and the FARGAN neural
vocoder, which are too large for WASM. The solution is a Python sidecar process
(`rade_helper.py`) that runs on the same server as PhantomSDR-Plus.

> **Important:** `freedv_rx` from the codec2 repository does **not** support RADEV1.
> The RADE decode pipeline lives entirely in the separate `radae` repository by
> David Rowe (VK5DGR). Do not attempt to use codec2's `freedv_rx` for RADE.

When you select RADE in the browser:

1. The frontend sets the underlying demodulation to USB or LSB — the C++ server
   demodulates the SSB signal as normal.
2. The raw demodulated PCM is tapped in `audio.js` **before** any mute or squelch
   gating — `radae_rxe.py` needs continuous input to maintain frame sync.
3. Each PCM chunk is zero-padded from real f32 to complex f32 (real + 0.0
   imaginary) — this is what `radae_rxe.py` expects on stdin.
4. The sidecar pipes those samples into `radae_rxe.py`, which outputs vocoder
   features.
5. `lpcnet_demo -fargan-synthesis` converts the features into s16 speech at
   16000 Hz.
6. The sidecar converts s16 → f32 and sends it back to the browser as binary
   WebSocket frames.
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
│       │  binary WebSocket ──► ws://host:8074                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 8074)                                       │
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

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| PhantomSDR-Plus | any | with Vite/Svelte frontend |
| Linux | Ubuntu 22.04+ / Debian Bookworm+ | tested |
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

## Pre-Installation — System Requirements

Before cloning the PhantomSDR-Plus repository or building anything, install all
system-level dependencies on your Ubuntu/Debian server.

### System packages

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    aplay alsa-utils
```

### Node.js (if system version is too old — needs 16+)

```bash
node --version   # check current version
# If below 16.x:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Python packages

```bash
pip3 install websockets matplotlib torch numpy scipy
```

> **websockets version note:** any version from 10.x to 16.x+ is supported.
> `rade_helper.py` auto-detects the API version.

### Verify Python packages

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

---

## Step 1 — Clone and Build the radae Repository

The RADE decoder is **not** part of codec2. It lives in a separate repository and
must be built from source to get the `lpcnet_demo` binary.

```bash
# 1a. Install build dependencies
sudo apt install build-essential cmake git python3-pip

# 1b. Clone the radae repository
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# 1c. Build (produces lpcnet_demo and other binaries)
mkdir build && cd build
cmake ..
make -j$(nproc)

# 1d. Verify lpcnet_demo was built
ls -la ~/radae/build/src/lpcnet_demo
```

You should see `lpcnet_demo` at `~/radae/build/src/lpcnet_demo`.

**Pre-trained model weights** are already included in the repository:

```bash
# Verify model19_check3 weights are present (this is the correct model)
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

## Step 2 — Install Python Dependencies

```bash
# Required
pip3 install websockets matplotlib torch numpy

# Recommended (enables accurate resampling when audioOutputSps > 8000)
pip3 install scipy
```

> **Why matplotlib?** `radae_rxe.py` imports matplotlib at the top of the file
> even when no plots are generated. It must be installed or the script fails
> immediately with `ModuleNotFoundError: No module named 'matplotlib'`.

> **Why torch?** `radae_rxe.py` uses PyTorch for neural vocoder inference.

---

## Step 3 — Verify the Decode Pipeline

Before wiring everything together, verify that the full pipeline works standalone.
This step generates a test RADE signal from a WAV file and decodes it to speakers.

```bash
cd ~/radae

# Step 3a — Generate a RADE-encoded test signal
# Note: --auxdata is required for model19_check3 when using inference.sh
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Wait for it to finish. It prints stats ending with:
```
loss: 0.741 Auxdata BER: 0.012
```

Then decode and play:

```bash
# Step 3b — Decode and play
cat rx.f32 \
    | python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

You should hear a voice. The output shows sync acquisition:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

The `underrun!!!` messages during this offline test are expected — `radae_rxe.py`
processes slower than file I/O. They do **not** appear during live reception
because the browser feeds audio at real-time rate.

> **Key facts about `radae_rxe.py`:**
> - Model path is passed as `--model_name <path>`, **not** as a positional argument
> - `--auxdata` is **enabled by default** — do not pass it as a flag
> - Use `--noauxdata` only if you need to disable it

```bash
# Step 3c — Verify the sidecar starts correctly
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Expected output (no WARNING lines):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/sv1btl/radae/radae_rxe.py
[RADE] model          : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/sv1btl/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Press Ctrl+C to stop it.

---

## Step 4 — Deploy the Patched Files

Copy the following files from the patch set into your PhantomSDR-Plus repository.

### New file — place in repository root alongside `start.sh` (or any start the server script you use):

```
rade_helper.py
```

### Patched frontend files — place in `frontend/src/`:

```
audio.js
App.svelte
App__analog_smeter_.svelte
App__digital_smeter_.svelte
App__v2_analog_smeter_.svelte
App__v2_digital_smeter_.svelte
```

### What the patches do

**`audio.js`** — 5 changes:
- Constructor: 5 new RADE state fields (`decodeRADE`, `_radeSideband`, `_radeSocket`,
  `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Pre-boost PCM save: `pcmArrayPreBoost` saved before the FLAC 300× gain boost so
  RADE receives original amplitude (the boost would saturate `radae_rxe.py`)
- `playAudio()`: RADE PCM tap using pre-boost audio, before mute/squelch gate
- `playAudio()`: `if (this.decodeRADE) return` guard — suppresses raw SSB
  playback while RADE decoded speech plays
- New methods: `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()`
  with gapless scheduled playback via `_radeNextTime` clock
  (plays at **16000 Hz** — the output rate of `lpcnet_demo`)

**Each Svelte variant** — 6 changes:
- `demodulationDefaults`: RADEL `{type:'LSB', offsets:[2200,-700]}`,
  RADEU `{type:'USB', offsets:[-700,2200]}` — passband starts 700 Hz from carrier, 1500 Hz wide
- State variables: `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`,
  `_radeDeactivate()`
- `_radeDeactivate()`: stops the decoder and **restores the band default mode**
  from `bands-config.js` — identical behaviour to FAX, NAVTEX, FSK deactivation
- `_deactivateAll()`: RADE cleanup line
- `activateSelectedDecoder()`: `radel` and `radeu` branches
- Decoder dropdown: two new `<option>` entries
- Status panel: connection dot, sync/SNR status, error banner

### Startup scripts

The main server startup scripts (`go.sh`, `kill.sh`, `start-rx888mk2.sh`,
`stop-websdr.sh`) are **not modified**. RADE is managed independently via
`rade.sh` (see Step 6).

---

## Step 5 — Build the Frontend

```bash
cd ~/PhantomSDR-Plus/frontend
npm install       # only if node_modules is missing
npm run build
```

Watch for Vite/acorn parser errors. The patched code deliberately avoids `?.`,
`??`, and bare `catch {}` to comply with the acorn constraint.

---

## Step 6 — Install rade.sh Control Script

`rade.sh` is the dedicated script for managing the RADE sidecar. The main server
startup scripts (`go.sh`, `kill.sh`, `start-rx888mk2.sh`, `stop-websdr.sh`) are
**not modified** — RADE is started and stopped independently.

Copy `rade.sh` to your PhantomSDR-Plus directory and make it executable:

```bash
cp rade.sh ~/PhantomSDR-Plus/
chmod +x ~/PhantomSDR-Plus/rade.sh
```

Available commands:

```bash
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Sidecar activity is logged to `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Why not integrate into start.sh?**
> Keeping RADE separate means the server can run without RADE (saving CPU when
> no one is using it), and RADE can be restarted independently without touching
> the main server process.

---

## Step 7 — Open Port 8074

The sidecar listens on port **8074**. The browser connects directly to this port.
Port 8074 must be reachable from the outside.

### Check current status

```bash
# Is sidecar listening?
ss -tlnp | grep 8074

# Test from outside (not from the server itself — NAT hairpin will give false results)
# Use: https://portchecker.co  →  your-hostname  →  port 8074
```

> **NAT hairpin warning:** Testing with `curl` from the server to its own public
> hostname often returns `Connection refused` even when the port is open — many
> routers block loopback. Always test from an outside machine or use portchecker.co.

### Open in iptables

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Make permanent across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### Open in ufw

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### Forward in your router

Add a NAT/port-forward rule: `TCP port 8074 → server LAN IP : 8074`

### Alternative: proxy through your existing public port via Nginx

If port 8074 cannot be opened (ISP blocking, etc.), proxy the WebSocket through
your existing public port using Nginx:

```nginx
# Add inside your existing server {} block
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Then change the sidecar URI in `audio.js` inside `setRADEDecoding()`:

```js
// Find:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');

// Change to:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Rebuild the frontend after this change.

---

## Step 8 — Start the Server

Start PhantomSDR-Plus as normal — RADE is **not** started automatically:

```bash
cd ~/PhantomSDR-Plus
./start.sh
```

Or using the alternative start script:

```bash
./start-rx888mk2.sh
```

The server starts without the RADE sidecar. Proceed to Step 9 to activate RADE.

---

## Step 9 — Start RADE Manually

Once the PhantomSDR-Plus server is running, start the RADE sidecar separately:

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
```

Verify it is running:

```bash
./rade.sh status
```

Expected output:
```
[RADE] Running
$USER  python3 /home/sv1btl/PhantomSDR-Plus/rade_helper.py ...
```

Watch the startup log:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Expected log lines:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/sv1btl/radae/radae_rxe.py
[RADE] model          : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/sv1btl/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

To stop RADE without stopping the server:

```bash
./rade.sh stop
```

To restart RADE (e.g. after updating `rade_helper.py`):

```bash
./rade.sh restart
```

> **Note:** `pkill -f rade_helper.py` alone is not sufficient — `rade.sh` runs a
> self-restarting watchdog loop that will respawn the process within 3 seconds.
> Always use `./rade.sh stop` to fully terminate it.

---

## Step 10 — Using RADE in the Browser

1. Open your PhantomSDR-Plus web interface
2. Find active stations at **[qso.freedv.org](https://qso.freedv.org)**
3. Tune to the station's dial frequency
4. In **Decoder Options**, select:
   - **RADE v1 — RADEL (LSB)** for 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** for 20 m / 17 m / 15 m / 12 m / 10 m
5. Click **Decoder: ON**

### Panel indicator states

| Indicator | Meaning |
|---|---|
| 🔴 Red — "Connecting to sidecar…" | Port 8074 unreachable or sidecar not running |
| 🟡 Yellow — "Searching for signal…" | Sidecar connected, no RADE frame detected yet |
| 🟢 Green — "Synced · SNR x.x dB" | Decoding — speech is playing |

### When you turn the decoder OFF

Mode and passband automatically revert to the correct default for the current
frequency as defined in `bands-config.js` — identical to FAX, NAVTEX, FSK.

---

## Verification and Debugging

### Is the sidecar running?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
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

### Quick WebSocket smoke test

```bash
python3 - << 'EOF'
import asyncio, websockets, json

async def test():
    async with websockets.connect('ws://localhost:8074') as ws:
        await ws.send(json.dumps({'type': 'init', 'sps': 8000, 'sideband': 'LSB'}))
        print(await ws.recv())   # expect: {"type": "status", "connected": true}

asyncio.run(test())
EOF
```

### Browser console (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Good — WebSocket opened. The Hz value matches your server's `audioOutputSps` (typically 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Port 8074 is unreachable — check firewall and router NAT rule.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | TCP port the sidecar listens on |
| `RADE_HELPER_HOST` | `0.0.0.0` | Bind address (`127.0.0.1` if behind a proxy) |
| `RADAE_DIR` | `~/radae` | Root of the radae repository |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Model weights |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | lpcnet_demo binary |
| `RADE_AUXDATA` | `1` | Set to `0` to pass `--noauxdata` to `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | PyTorch/OpenBLAS threads per `radae_rxe.py` instance — limits CPU usage |

---

## Files Changed

| File | Type | Notes |
|---|---|---|
| `rade_helper.py` | **New** | Python sidecar: WebSocket server + two-process decode pipeline |
| `frontend/src/audio.js` | Modified | 4 patches |
| `frontend/src/App.svelte` | Modified | 6 patches |
| `frontend/src/App__analog_smeter_.svelte` | Modified | 6 patches |
| `frontend/src/App__digital_smeter_.svelte` | Modified | 6 patches |
| `frontend/src/App__v2_analog_smeter_.svelte` | Modified | 6 patches |
| `frontend/src/App__v2_digital_smeter_.svelte` | Modified | 6 patches |
| `rade.sh` | **New** | RADE sidecar control script (start/stop/restart/status) |
| `go.sh` | **Unchanged** | RADE managed separately via rade.sh |
| `kill.sh` | **Unchanged** | RADE managed separately via rade.sh |
| `start-rx888mk2.sh` | **Unchanged** | RADE managed separately via rade.sh |
| `stop-websdr.sh` | **Unchanged** | RADE managed separately via rade.sh |
| `spectrumserver.cpp` | **Unchanged** | No C++ modifications required |

---

## Signal Flow Summary

```
Antenna → RX-888 MK2 → PhantomSDR-Plus C++ server
                              │
                    FFT + DDC + SSB demodulation
                    (USB or LSB — set by RADEL/RADEU)
                              │
                    Opus/FLAC encode → WebSocket → Browser
                              │
                         audio.js decode()
                              │
                         playAudio(pcmArray)
                              │
               ┌──────────────┴────────────────────────────┐
               │  rawPcm tap (before mute gate)             │
               │  real f32 → zero-padded complex f32 pairs  │
               └──────────────┬────────────────────────────┘
                              │ WebSocket binary → ws://host:8074
                              ▼
                       rade_helper.py
                              │ resample to 8000 Hz if needed
                              │ stdin pipe
                              ▼
          radae_rxe.py  --model_name model19_check3/.../checkpoint_epoch_100.pth
          (PyTorch FARGAN neural vocoder, auxdata ON by default)
                              │ stdout pipe (vocoder features f32)
                              ▼
          lpcnet_demo  -fargan-synthesis  -  -
                              │ stdout: s16 PCM @ 16000 Hz
                              │ sidecar converts s16 → f32
                              │ WebSocket binary frames → browser
                              ▼
                  audio.js  _radePlayPCM()
                  AudioContext.createBuffer(16000 Hz)
                              │
                           Speaker 🔊
```

---

## Troubleshooting

### Red banner — "Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### Port 8074 closed on portchecker.co despite iptables rule

The ISP may be filtering the port, or the router NAT rule is missing. Options:

1. Try a different port: `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Proxy through your existing public port via Nginx (see Step 7)

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

The model path must use `--model_name`, not a positional argument:

```bash
# WRONG — positional argument
python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth

# CORRECT — named argument
python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

### `ModuleNotFoundError: No module named 'matplotlib'`

```bash
pip3 install matplotlib
```

`radae_rxe.py` imports matplotlib unconditionally at the top of the file.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
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

### `size mismatch` error in `inference.sh`

`model19_check3` requires `--auxdata` when encoding with `inference.sh`:

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

Note: when **decoding** with `radae_rxe.py`, `--auxdata` is the default —
do not pass it.

---

### Yellow indicator — "Searching for signal" — never syncs

- Confirm the correct sideband: RADEL for ≤ 10 MHz, RADEU for > 10 MHz
- Check [qso.freedv.org](https://qso.freedv.org) to confirm a station is
  currently transmitting
- RADE v1 uses 30 carriers in 1500 Hz BW — it appears as a compact cluster
  on the waterfall
- Allow up to 1.5 seconds for acquisition

---

### `underrun!!!` from aplay during pipeline test (Step 3)

Expected during offline file testing only. `radae_rxe.py` processes slower than
file I/O, causing the audio buffer to starve. This does not occur during live
reception because the browser feeds audio at real-time rate.

---

### `ConnectionClosedError: received 1011 (internal error)`

The sidecar accepted the WebSocket connection but crashed internally before
responding. This is caused by an incompatible version of `rade_helper.py` — an
older version attempted to pass an asyncio `StreamReader` as a subprocess stdin,
which fails silently and closes with error 1011.

**Fix:** Replace `rade_helper.py` with the current version from the patch set.
The current version uses `os.pipe()` for the inter-process pipe and is compatible
with websockets 10.x through 16.x+.

---

### Multiple simultaneous users

Each browser connection spawns its own independent `radae_rxe.py` + `lpcnet_demo`
pair, so each user can tune to a different frequency freely.

By default `radae_rxe.py` uses **all available CPU cores** for PyTorch matrix
operations, causing ~900% CPU usage per instance. `rade_helper.py` limits this
with two optimisations:

1. `OMP_NUM_THREADS=1` (and MKL/OpenBLAS equivalents) — limits PyTorch to 1 thread
2. Numpy-vectorised audio conversion functions — eliminates Python loop overhead

Result: each instance uses roughly **~8–10%** of one core, sufficient for
real-time RADE decode. If you hear audio dropouts, raise to 2 threads:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Simultaneous RADE users | Approximate CPU |
|---|---|
| 1 | ~9% |
| 5 | ~45% |
| 10 | ~90% |
| 20 | ~180% |

On an i5-12450H (12 threads) with spectrumserver using ~42% and rx888_stream ~11%,
you have roughly **1000% headroom** — enough for **20+ simultaneous** RADE users
before CPU becomes a concern. Upload bandwidth is the real practical limit.

---

## Updating RADE v1

The PhantomSDR-Plus integration (`rade_helper.py`, frontend patches) is a bridge
only — all RADE decode logic lives in the `radae` repository. Updates are
therefore almost always a simple `git pull` + rebuild with no changes to
PhantomSDR-Plus itself.

### Standard update (new code, same model)

```bash
# 1. Pull latest radae code
cd ~/radae
git pull

# 2. Rebuild lpcnet_demo (in case C code changed)
cd build
cmake ..
make -j$(nproc)

# 3. Restart the sidecar — no server restart needed
cd ~/PhantomSDR-Plus
./rade.sh restart
```

That is all. No frontend rebuild, no server restart, no file edits.

### New model weights only

If a new checkpoint is released (e.g. `model20`) without code changes, point
the sidecar at the new weights using the env var — no file editing required:

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### What each type of change requires

| What changed in radae | Action required |
|---|---|
| New model weights (new `.pth` file) | Set `RADE_MODEL` env var, `./rade.sh restart` |
| Code change in `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| `lpcnet_demo` C code changed | `git pull`, rebuild, `./rade.sh restart` |
| `radae_rxe.py` renamed or moved | Update `RADAE_RX` path in `rade_helper.py` (one line) |
| `--model_name` argument renamed | Update `radae_cmd` in `rade_helper.py` (one line) |
| New output sample rate (≠ 16000 Hz) | Update `SPS_OUT` in `rade_helper.py` + `createBuffer()` in `audio.js` |
| RADE v2 uses a different binary | Update `RADAE_RX` in `rade_helper.py` (one line) |

### Verifying the update worked

After restarting, confirm the new code is running:

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

The log should show the model path you expect:
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Staying up to date

Subscribe to the radae repository releases page to be notified of new models
and code updates:

```
https://github.com/drowe67/radae/releases
```

Check the FreeDV blog for announcements about new RADE waveforms and models:

```
https://freedv.org/blog/
```

---

*Developed and tested on PhantomSDR-Plus (sv1btl/PhantomSDR-Plus fork) with
RX-888 MK2 on Ubuntu 22.04. The C++ server is not modified.*

*RADE is developed by David Rowe VK5DGR and the FreeDV team.*
*See [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Full uninstall and fresh re-install

Here's the full teardown before re-running install_rade.sh:
1. Stop the sidecar
cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Remove the radae repo and build
rm -rf ~/radae
3. Remove torch (installed in user local)
pip3 uninstall -y torch
rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Remove apt Python packages (optional — skip if used by other things)
sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets
sudo apt-get autoremove -y
5. Verify everything is gone
python3 -c "import torch" 2>&1        # should say ModuleNotFoundError
ls ~/radae 2>&1                        # should say No such file or directory
6. Fresh install
chmod +x ~/PhantomSDR-Plus/install_rade.sh
~/PhantomSDR-Plus/install_rade.sh


