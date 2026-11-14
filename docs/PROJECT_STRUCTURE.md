# PhantomSDR-Plus Project Structure

This document provides a comprehensive overview of the PhantomSDR-Plus directory structure, file organization, and component relationships.

---

## Table of Contents

1. [Directory Tree](#directory-tree)
2. [Root Directory](#root-directory)
3. [Source Code (`src/`)](#source-code-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Frequency Lists (`frequencylist/`)](#frequency-lists-frequencylist)
6. [Configuration Files](#configuration-files)
7. [Build System](#build-system)

---

## Directory Tree

*Only the main folders and the files a sysop works with; the repository itself has the full list.*

```
PhantomSDR-Plus
├── add-receiver.sh            # adds one more receiver: driver, instances/<name>/, receivers.toml — see docs/MULTI_RECEIVER.md
├── admin_server.py
├── autorun
├── config-rtl.toml
├── config.toml
├── configure-station.sh       # the station wizard: asks once, writes station.conf, the .toml and site_information.json
├── docs
├── drm                        # built by setup-drm.sh: src/ and bin/ (not in git)
├── frequencylist
├── frontend
├── install.sh
├── instances                  # extra receivers, one folder each (not in git) — see docs/MULTI_RECEIVER.md
├── jsdsp
├── proxy.py                   # the one public port: the page, /admin, /rade, /stats, /relay, and ?rx= receivers
├── rade_helper.py             # the RADE sidecar: V1 through ~/radae, V2 (beta) through ~/rade_c
├── recompile.sh               # rebuild; --backend / --frontend / --both ask nothing
├── receivers.toml.example     # receiver list for proxy.py — copy to receivers.toml
├── setup-https.sh             # https:// in front: Caddy on 443 with a Let's Encrypt certificate — see docs/HTTPS.md
├── src
├── start-rtl.sh
├── start-rx888mk2.sh
├── station.conf               # this station's answers to the wizard (not in git, never touched by update.sh)
├── stop-websdr.sh
├── subprojects
├── tci-bridge
├── thermal_guard.py           # CPU over-temperature guard used by the admin panel (also runs standalone)
├── update.sh                  # updater: report, then "update now?"; --check, --from, --make-known
└── websdr_relay.py            # the relay itself — see docs/RECEIVE_DIVERSITY.md
```
---

## Root Directory

### Configuration Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `config.toml` | Default configuration | Initial setup, testing |
| `config-rtl.toml` | RTL-SDR specific config | Using RTL-SDR device |
| `config-rsp1a.toml` | SDRplay RSP1A config | Using RSP1A device |
| `config-airspyhf.toml` | Airspy HF+ config | Using Airspy device |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 direct sampling (0-25 MHz) | Using a Fobos on HF |
| `config-fobos.toml` | RigExpert Fobos SDR, RF path (25-6000 MHz) | Using a Fobos above 25 MHz |
| `config-hackrf.toml` | HackRF One config | Using a HackRF |
| `config-rx888mk2.toml` | RX888 MK2 config | Using RX888 device |
| `config.example.hackrf.toml` | HackRF One example | Using HackRF device |
| `station.conf` | The station wizard's answers — receiver, band, station, ports, extras. Written by `configure-station.sh`; the start scripts and `proxy.py` read it. Never in git, never touched by `update.sh` | Through `bash configure-station.sh` |
| `main.env` | The main receiver's own `instance.env`: its argument line (`RX888_ARGS` / `RX_ARGS`) with the gain set in Admin → Receivers → ✎ CHANGE SETTINGS. Read last by every start script; absent until a gain is saved. Never in git, never touched by `update.sh` | Admin → Receivers, or by hand |

### Start/Stop and Maintenance Scripts

Each `start-*.sh` below is a **self-contained launcher + watchdog + logger**: it stops any running instance, brings up the receiver + `spectrumserver`, detaches into the background, auto-restarts the chain if it dies, and logs to `logwebsdr.txt`. They share one stop script and a single `flock` lock (only one receiver runs at a time). Edit only the **RECEIVER CONFIGURATION** block at the top of each (receiver args / config / process name). The six launchers built from the same template (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) are identical below that block; `start-rx888mk2.sh` is a script of its own. Since v5.0.0 several receivers can run side by side: start a launcher with `INSTANCE=<name>` and that receiver gets its own folder in `instances/<name>/`, its own log, lock and FIFO — see [Several Receivers](MULTI_RECEIVER.md).

| Script | Purpose |
|--------|---------|
| `install.sh` | Automated installation and build — the station questions first, then everything unattended (also `install_fedora.sh`, `install_arch.sh`, `install_opensuse.sh`) |
| `configure-station.sh` | The station wizard: receiver, band, station, internet, ports and extras, asked once and saved in `station.conf`; from it writes the receiver's `.toml`, `site_information.json` and the relay settings, changing only the keys it owns and backing each file up first. `--show` prints the answers, `--apply` rewrites the files from them — see [Installation Guide](INSTALLATION.md) |
| `setup-autostart.sh` | Start at boot: installs `phantomsdr-receiver.service`, which runs the start script from `station.conf` (or the one named) at boot and `stop-websdr.sh` at shutdown, with the `plugdev` group; `--remove` undoes it |
| `setup-https.sh` | Serves the receiver over https:// as well as http://: installs Caddy on port 443 with a Let's Encrypt certificate for the station's DNS name (renewed by itself) and points it at `proxy.py`'s loopback port `PORT_TLS`, where the proxy takes each visitor's real address from Caddy. `--lan` for the local network with Caddy's own certificate, `--status`, `--remove`; the station questions run it when https is chosen — see [Secure Access](HTTPS.md) |
| `add-receiver.sh` | Adds one more receiver to this computer: asks which receiver and what it covers, installs its driver, creates `instances/<name>/` and the `receivers.toml` entry, and offers to start it and restart the proxy. The installers offer it at the end — see [Several Receivers](MULTI_RECEIVER.md) |
| `start-rtl.sh` | Launch + watchdog server with RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Launch + watchdog server with SDRplay RSP1A (`rx_sdr`); uses libmirisdr-5, or SDRplay's API when that is installed (`RX_DRIVER` forces one) |
| `start-airspyhf.sh` | Launch + watchdog server with Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Launch + watchdog server with RigExpert Fobos SDR, HF1/HF2 direct sampling (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Launch + watchdog server with RigExpert Fobos SDR, RF path (`rx_sdr`) |
| `start-hackrf.sh` | Launch + watchdog server with HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Launch + watchdog server with RX888 MK2 (`rx888_stream`) |
| `start-all.sh` | Starts every receiver listed in `receivers.toml` through its own launcher — set it as the admin panel's start script on a station with several receivers; see [Several Receivers](MULTI_RECEIVER.md) |
| `stop-websdr.sh` | Stop the server + its watchdog — shared by all receivers |
| `stop-websdr.sh <instance>` | Stops one receiver only (`main` for the main one); without an argument every receiver stops, as before |
| `setup-rx888-udev.sh` | Install udev rules so RX-888 `rx888_stream` runs without sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Install the SoapySDR driver chain for the RSP1A, Fobos or Airspy HF+ — SoapySDR from the distribution, the driver and rx_tools built into `sdr_drivers/`, a udev rule — on any of the four supported distributions. Installer options 3, 5 and 6 run them; they also run on their own. Shared code in `setup-sdr-common.sh` — see [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Installs the distribution's `hackrf` package and a udev rule for the HackRF One, on any of the four supported distributions; installer option 7 runs it |
| `setup-rtlsdr.sh` | Installs the RTL-SDR driver on any of the four supported distributions — the distribution's `rtl-sdr` package, or with `RTL_V4=y` the RTL-SDR Blog V4 driver built from source — blacklists the DVB-T driver and adds a udev rule; `add-receiver.sh` runs it |
| `setup-firewall.sh` | Optional kernel-level flood guard: loads an nftables table with a per-source connection ceiling and rate on the receiver ports, an SSH brute-force brake, and Windows file sharing closed outside private ranges. Needs root, cannot lock you out (policy accept, established accepted first) and `--apply` rolls itself back unless confirmed within 60 s — see [Connection Limits](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Grants a `cpufreq` group write access to the per-CPU frequency limit, so the thermal guard's throttle stage works without running the panel as root. Installs a `tmpfiles.d` rule so it survives a reboot; `--revoke` undoes it |
| `update.sh` | Update the installation from the published tree, leaving your configuration, markers, frequency list and local edits alone: it reports, asks "Update these files now?" (ENTER = no), backs up, applies and rebuilds only what changed. `--check` for cron, `--from` a ZIP, tarball or folder without network — see [Installation Guide](INSTALLATION.md) |
| `update-known.txt` | The SHA-256 of every version of every file ever published, shipped with each release, so `update.sh` updates a file that is merely old without asking. Written by `bash update.sh --make-known` in the source tree |
| `recompile.sh` | Rebuild the backend and/or the frontend, and pick the variant served at `/`. With `--backend`, `--frontend` or `--both` it asks nothing and keeps the current variant — how `install.sh` and `update.sh` call it |
| `smeter_theme.sh` | Set the default analog S-meter face (dark / amber / vintage) for all users, and offer the frontend rebuild — see [Editing Variants](https://github.com/sv1btl/PhantomSDR-Plus/blob/main/docs/EDITING_VARIANTS.md) |
| `waterfall.sh` | Change the default minimum waterfall level (dB) in `waterfall.js` + `App.svelte` — see [README](README.md) |
| `kiwi_install.sh` | Install the KiwiSDR client-emulation bridge into a tree that has not got it: patches the backend sources, copies `src/kiwi_bridge.h`, and adds a documented `[kiwi_emulation]` block to the config files in the repository root. Idempotent, and backs up every file it touches — see [KiwiSDR Client Emulation](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Not used by the receiver. A small Node.js program a listener runs next to their own transceiver: it reads frequency, mode and transmit state from Hamlib's `rigctld` and serves them as TCI on port 50001, so the page's **TCI-CAT** button can drive a rig with no TCI of its own, such as the IC-7300 — see [Rig Control](RIG_CONTROL.md) |

### Data Files

| File | Purpose | Format |
|------|---------|--------|
| `markers.json` | Frequency bookmarks and markers | JSON |
| `chat_history.txt` | User chat messages | Plain text |
| `favicon.ico` | Website icon | ICO image |
| `fftw_wisdom` | FFT optimization data | FFTW binary |
| `phantom_fftw_wisdom` | Additional FFT optimization | FFTW binary |

### Admin Panel and Spot Reporting

| File | Purpose |
|------|---------|
| `admin_server.py` | The admin panel itself. Besides the management pages it runs the **Graphs** sampler: a background thread takes CPU frequency, load, temperature and users online every 2 seconds and keeps them in memory only — 1 hour at full resolution plus 24 hours of 30-second averages. Nothing is written to disk, so the history is lost on restart. |
| `admin_config.json` | Admin panel settings (password hash, ports, options, thermal guard thresholds) |
| `proxy.py` | The public port. Serves the page and carries `/admin` to the panel and — on a station set up with the wizard — `/rade`, `/stats` and `/relay` to the services behind it, so only one port is forwarded. Reads its ports from `admin_config.json`, or from `station.conf` when there is no panel (`setup_admin.sh --proxy-only`) |
| `thermal_guard.py` | CPU over-temperature guard. Stops the server when the CPU gets too hot and restarts it once cool, deriving its thresholds from the critical trip point your own CPU publishes instead of a fixed number. It never identifies what supervises the server — while over-temp it re-issues the stop every 2 s, so a watchdog, systemd unit or cron job that revives it is undone until the machine cools. Stdlib-only; imported by `admin_server.py` (ticked from the Graphs sampler) and also runnable standalone for installations without the panel. Defaults to log-only, so it acts on nothing until enabled — see the [Thermal Guard manual](THERMAL_GUARD.md) |
| `autorun/` | The spot-reporting daemon — see [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Which bands/modes to decode and in which UTC hours, identity, destinations and autostart |
| `autorun-stopped` | Present after STOP in the panel: autostart leaves the daemon off, reboots included, until START |
| `autorun-status.json` | Live state of the running daemon — feeds the **per-run** spot counters (the per-decoder tiles), which reset on Stop/Start |
| `autorun-totals.json` | **All-time** uploaded spots per band+mode — the number beside each checkbox; written by the daemon so the counts survive restarts |

### Build System Files

| File | Purpose |
|------|---------|
| `meson.build` | Main build configuration |
| `meson_options.txt` | Configurable build options |
| `.gitattributes` | Git repository attributes |

---

## Source Code (`src/`)

The `src/` directory contains the C++ backend implementation.

### Key Components

#### 1. Main Application (`main.cpp`)
- Parses command-line arguments
- Loads configuration file
- Initializes server components
- Starts event loop

#### 2. Spectrum Server (`spectrumserver.cpp`)
- Coordinates all components
- Manages user connections
- Distributes spectrum data
- Handles user requests

#### 3. SDR Drivers (`drivers/`)
- Abstract interface for SDR hardware
- Read and format sample data
- Handle device-specific features

#### 4. DSP Engine (`dsp/`)
- FFT calculation (CPU/GPU accelerated)
- Demodulation (AM, FM, SSB, CW, etc.)
- Audio filtering and resampling
- AGC per listener — Auto (tuned per mode) or transceiver-style Fast / Medium / Slow, chosen with the `agc_speed` command (`utils/audioprocessing.cpp`) — and noise reduction

#### 5. Web Server (`server/`)
- WebSocket communication
- HTTP static file serving
- User session management
- Real-time data streaming

#### 6. Audio Encoding (`audio/`)
- FLAC compression
- Opus compression
- Streaming optimization

---

## Frontend (`frontend/`)

The web-based user interface built with Svelte and Vite.


#### 1. Main App (`App.svelte`)
- Top-level component
- Layout structure
- Component orchestration
- **Decoders button row** — one button per decoder, on the main panel directly under the Modes; press to start the decoder and open its window, press again to stop. It replaced the former Bandwidth row. RADE-v2U/RADE-v1L/RADE-v1U live in `lib/ModesSelector.svelte` instead, beside the Modes and inside the Modes and Bands pop-ups.
- **Version line** — "PhantomSDR+ | v5.5.0 original from github.com/sv1btl/PhantomSDR-Plus", with the address as a link; the same line is on the /mobile page. The version number and the address live in `lib/version.js`; the line is an author attribution covered by `ADDITIONAL_TERMS.md`.

#### 2. Waterfall Display (`waterfall.js` + `lib/`)
- Canvas-based spectrum and waterfall rendering and colormaps in `waterfall.js` (plain JS, not a component); the **Auto Adj.** brightness/contrast remap is `lib/wfAutoLevel.js`
- Interactive tuning through `lib/PassbandTuner.svelte`
- Band plan and marker overlays through `lib/FrequencyMarkers.svelte`
- The audio analyser is `lib/Spectrogram.svelte`, with the SSB audio report in `lib/SsbReport.svelte` and the AM/FM report in `lib/AmFmReport.svelte`; their RF measurements (occupied width, the SSB carrier and opposite sideband, AM depth and FM deviation, the AM/FM RF view) come from `measureOccupied`, `measureSsb`, `measureAmFm` and `getRfSlice` in `waterfall.js`, which while the analyser is open keeps a hidden fine-detail waterfall connection centred on the dial (`detailFollow`), so they work at any zoom; adapted from PhantomSDR-ORSAT by F1NSK
- The 3D spectrum is `lib/Waterfall3D.svelte` (WebGL2): while it is open, `waterfall.js` hands it every line with the waterfall's own levels (Min/Max and Auto Adj. applied), the zoom range and the colour map through `waterfall.view3d`; adapted from PhantomSDR-ORSAT by F1NSK

#### 3. Controls (`App.svelte` + `lib/`)
- Frequency input/display — `lib/FrequencyInput.svelte`
- Number pad for typing a frequency — `lib/FreqKeypad.svelte`; the typed frequency is tuned with its band's zoom, Min/Max and mode (`tuneTypedFrequency()` in `App.svelte`), and one another receiver covers opens that receiver
- **Show All** strips of the other receivers — `lib/RxStrip.svelte`: one `/waterfall?rx=<id>` socket each, every frame decoded and drawn, in the other receiver's own palette and levels, newest line at the top; the receiver ranges and the links between receivers come from `lib/receivers.js`; with two or more bands in the other receiver's range, a band dropdown in its header (choice in `localStorage` `rxStripView:<id>`, click arrives with `&band=1`)
- Mode selection (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, band switching — `lib/BandSelector.svelte`
- EiBi window — `lib/SwSchedule.svelte`: searches `/eibi.json` with shortwave.live's criteria; a row tunes through the marker-click path (`handleFrequencyMarkerClick()` in `App.svelte`, so decoder modes start their decoder), and its green results and the red "now listening" marker are drawn by `lib/FrequencyMarkers.svelte`, and **Hide HFCC markers** hides the `markers.json` entries that `update-markers.sh` tags `"source": "hfcc"`; CW rows are tuned as the marker mode `MORSE`, so they open the CW decoder
- AGC/NR/NB and the remaining controls live in `App.svelte` itself; there is no separate `Controls.svelte`

#### 3a. Scanner (`scanner.js`)
- Channel scanner: walks the receiver across a range and stops on the first channel carrying a signal. Plain JS, not a component — `App.svelte` supplies the VFO, the mode, the band plan and the tuning call, and receives the UI state back through one callback
- Threshold is dB over the band noise floor rather than an absolute level, reusing the floor `waterfall.js` already tracks (`snrNoiseDb`), so it needs no calibration of its own
- Two ways to cross the band: tune and listen to every channel, or screen the spectrum first and only tune to what it cannot rule out. The spectrum may skip a channel but never stop on one — every stop comes from a real dwell
- Range is either the band plan's band or exactly what the waterfall shows; auto-resume, a max-stay timeout and a lockout list live here too, persisted in `localStorage`

#### 4. Audio System (`audio.js`)
- WebSocket audio stream
- FLAC/Opus decoding. FLAC goes through `flacLowLatency.js`, which decodes each packet the moment it arrives and corrects the stream's true rate (for example 12016.3 Hz) to 12000 Hz with a 64-tap resampler (2.7 ms of delay). The WASM decoder in `modules/` released audio in fixed 1024-sample chunks and held back about 160 ms; it is still used for Opus, for diversity sources, and for FLAC when the page is opened with `?flac=wasm`
- Audio playback control
- Playback buffer control (`playoutControl.js`): `ArrivalMeter` measures how irregularly packets arrive against the stream's own timeline, and the drift between the receiver's sample clock and the listener's sound card; `CushionController` keeps the smallest buffer seen in the last minute close to the buffer preset's margin, by cutting or repeating one pitch-matched period (`spliceOut` / `spliceIn`) of the audio going to the loudspeaker. Decoders and recordings get the untouched stream. Applies to the scheduled-buffer path that every listener on a plain-http station uses; `?drain=0` switches it off, `?diag=1` shows its figures
- Distributes raw PCM (taken before the browser's noise reduction and mute; the server AGC is held on Slow while a decoder is open) to the mode decoders
- AI noise reduction: `lib/rnnoise.js` loads the RNNoise WebAssembly module (`@jitsi/rnnoise-wasm`) on first use; `audio.js` runs it on voice modes only, after the decoder tap, so the decoders never hear it

#### 4a. Mode decoders and their workers

Each of the heavy mode decoders runs in its own Web Worker so that decoding never blocks audio playback or the waterfall. They follow one common pattern — three files per decoder:

| Decoder | Engine | Worker | Main-thread proxy |
|---------|--------|--------|-------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FLDIGI (ALE 2G HAM, FSK/RTTY, PSK31/63/125, QPSK, Olivia, Contestia, PSK Browser, Olivia Browser, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet/APRS) + SERVICES (Maritime FSK / SITOR, Weather RTTY, ALE 2G) | `fsk.js`, `psk31.js`, `olivia.js`, `mfsk.js`, `ifk.js`, `throb.js`, `hell.js`, `mt63.js`, `fldigiFec.js`, `ax25.js`, `ale.js`, `fst4w.js`, `msk144.js`, `pskBrowser.js`, `oliviaBrowser.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| SERVICES (DSC, Time Signals, HF Selcall) | `dsc.js`, `timesig.js` | `services.worker.js` | `servicesWorkerProxy.js` |
| CW, CW Browser | `cwDecoder.js`, `cwBrowser.js` | `cw.worker.js` | `cwWorkerProxy.js` |

#### 4b. Receive Diversity (`diversity.js`)
- Combines the local receiver with a second one elsewhere and follows whichever site currently has the better signal. Plain JS, not a component — it sits on one seam in `audio.js`, which hands it the local PCM and plays back what it returns
- **Selection, not summing.** Two sites hear the same transmission over different ionospheric paths, so their waveforms have unrelated phase; adding them sounds comb-filtered. Coherent combining would need a common clock, which two receivers over the internet cannot share. The two streams are only ever mixed during a 30 ms crossfade
- Alignment correlates the two **audio envelopes** (log power at 100 Hz), never the waveforms — the envelope survives both the path and any codec. A lock is only trusted once a second, independent search agrees with it, which rejects the confident-but-wrong delay two antiphase-fading sites would otherwise produce
- The remote is **rate-locked** to the local stream first. Two receivers are two clocks and two decimation chains, so their audio arrives up to 2% apart even when both declare 12 kHz — 240 samples a second of creep, which no correlation can hold. The ratio is measured from how many samples each side actually delivers and applied by a resampler that carries its fractional phase across blocks, so an arbitrary ratio holds indefinitely
- Site choice uses a percentile SNR measured on **content-aligned** samples, with hysteresis, a dwell timer and a fast escape hatch for a collapsed incumbent. Levels are matched noise-to-noise, so a switch does not change the background hiss
- Decoders keep the **local** stream: FT8, JS8, WSPR and RADE integrate coherently across a slot, and a mid-slot switch is a phase discontinuity that can cost the decode

#### 4c. Diversity sources (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- One contract — `onPcm` / `onState` / `tune` / `canReceive` — so `diversity.js` never learns what is on the other end. Adding a receiver type is one new file
- `remoteSource.js` — another PhantomSDR-Plus over `/audio` (cbor + FLAC), reusing `createDecoder()` from `lib/wrappers.js`
- `kiwiSource.js` — a KiwiSDR: `SND` frames, big-endian PCM, with the 10-byte GPS timestamp a stereo packet inserts before the audio
- `uberSource.js` — an UberSDR over its native `/ws`: Opus in a 21-byte header, retuning over the open socket. The session id must be registered with `POST /connection` first and must be a UUID
- `webSdrSource.js` — a WebSDR, through `websdr_relay.py` on this server: the browser cannot connect directly, because WebSDR checks the `Origin` header and no script may change it. Tuning is a text frame on the same socket; band coverage comes from the relay
- `webSdrCodec.js` — the WebSDR audio format: a tagged byte stream whose compressed blocks drive a 20-tap leaky-LMS predictor. Ported from the WebSDR client and verified sample-for-sample against it
- `diversityList.js` — the saved-receiver list and the address rules for the four types, shared by the desktop panel and the mobile page so one format serves both. Also the transfer — a compact blob, its QR code, and a parser that accepts every shape the two pages have ever written — and `browseUrl()`, which walks a dialled address back into one a browser can open
- `lib/DiversityPanel.svelte` — the UI: endpoint, source type, SNR trim and live status, plus the saved receivers — named, reorderable, and exported to and imported from a JSON file, kept per source type in `localStorage`. Everything is edited inside the panel: `prompt()` and `confirm()` block the main thread, which is where audio frames are pushed into the playback worklet. A **▦ QR** button draws the list as a scannable code, because `localStorage` is per browser and a phone starts empty. `mobile/Mobile.svelte` carries the same feature in a **Div** tab, in that page's own plain CSS. See [Receive Diversity](RECEIVE_DIVERSITY.md)

#### 4d. Mode identifier (`modeId.js`, `modePriors.js`)
- Answers "what am I listening to?". It reads the same raw PCM tap as the decoders and ranks the likely modes, so the operator can pick the right decoder instead of trying all ten. It never decodes anything: it measures physical properties of the signal and scores them against a table of known modes
- Occupied bandwidth is the contiguous −15 dB width around the peak, deliberately not a 99 %-power figure: keying splatter puts long tails on the power integral and made every narrow mode read several times too wide. Symbol rate comes from the **instantaneous frequency** rather than tone energies, because no integration length can both resolve a 170 Hz shift and a 100 Bd symbol. Keying rate comes from the on/off envelope, and doubles as a CW speed readout
- `modePriors.js` adds the one clue the audio cannot carry — where you are tuned. A 100 Bd / 170 Hz signal on 518 kHz is NAVTEX; the identical signal on 14.070 MHz is not. It only reweights what the signal already supported, and never invents a candidate
- FT8, JS8 and FT2 are reported as one group on purpose: they are not separable on bandwidth and tone spacing alone, and pretending otherwise would be a confident wrong answer
- Below roughly 10 dB SNR it stays quiet rather than guessing
- Runs in its own Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), following the same engine/worker/proxy pattern as the decoders above; the result is the chip in `lib/ModeIdChip.svelte`

#### 4e. Connection refusals (`refused.js`, `clientVersion.js`)

- `refused.js` is the shared vocabulary for a connection the server turns away: close code **4003** (over a per-IP limit, or the page is older than `[server] min_client_version`) and **4001** (a sysop kick). Both are final. `audio.js`, `waterfall.js` and `events.js` all import `isRefusal()` from it, because all three open a socket that can be refused and all three must settle their init promise when it is — otherwise the page waits forever on a connection that is never coming
- Nothing retries. A dropped `/audio` socket ends the session by design: `/waterfall` and `/events` never came back with a reconnect, so a retried session was live audio attached to a frozen waterfall, and against a rate limit each retry would extend the very refusal it was working around. The desktop page explains a refusal that happens at page load and simply stops when one happens mid-session; `/mobile` shows one line asking the listener to reload
- `clientVersion.js` holds a single integer, `CLIENT_VERSION`, which the page appends to its audio socket as `/audio?v=N`. The server refuses anything below `[server] min_client_version`, which is how a station forces tabs still running an older build to reload — the only lever there is, since the server cannot reach JavaScript already running in a browser. Bump it when a frontend change must not keep being ignored by open tabs
- Full reference: [Connection Limits](CONNECTION_LIMITS.md)

#### 4f. Chat replies (`lib/chatReply.js`)
- A reply is an ordinary chat message that starts with a marker naming the message it answers, `[RE:<timestamp>|<name>]`; the server stores and relays it like any other line and needs no change
- `chatReply.js` builds and reads that marker and groups replies under their original, one level deep. `App.svelte` and `mobile/Mobile.svelte` both use it, so the two pages thread the chat the same way
- When the original has already left the server's 20-message history, the reply stays where it arrived and shows only the name and time it answers

#### 4g. Listener names and privacy (`lib/identity.js`)
- The name box next to **Open Additional Info** keeps the name or callsign in `localStorage` (`chatusername`) and sends it on `/audio` as `{"cmd":"identity","name":…}`; `audio.js` sends it again whenever its socket opens. A link to a receiver on another address carries it as `?idname=`, read once and removed from the address bar
- The server cleans it (`clean_listener_name` in `utils.cpp`): at most 10 characters and no spaces as on a WebSDR, at least one letter or digit; the chat's reserved names and the `anonymous1234` placeholders count as none. `/users` gives it as `name`; the waterfall labels show it followed by the city
- The public `/users`, `users.json` and the `/logs/users_*.jsonl` that `stats.html` reads carry no IP address: the log copy has an opaque `visitor` code instead (keyed hash, key in `logs/.visitor_salt`); the files on disk keep the addresses. The admin panel reads `/~~users`, answered only to a loopback peer without `X-Forwarded-For`
- The running decoder goes the same way: `App.svelte` sends `{"cmd":"decoder","name":"FT8"}` (empty when none) whenever it changes, and `audio.js` sends it again on a new socket. The server keeps a short label (letters, digits, space, `-+/`, at most 12) and gives it as `decoder` in `/users` and in each `users_*.jsonl` line; a change is logged like a retune, so `stats.html` (Decoder Popularity) and the admin Visitors page can count it
- The admin panel's 8/16/24-hour bans live in `admin_bans.json` (never distributed) and are re-sent to every receiver once a minute; `/~~unban` lifts one

#### 5. State Management (`stores/`)
- Reactive data stores
- Shared application state
- Event handling

---

## Frequency Lists (`frequencylist/`)

The on-waterfall frequency markers. `mymarkers.json` is the list the receiver actually shows; the rest is the raw material `update-markers.sh` turns into it, refreshed from the online schedules. `README.md` in that directory explains the update in all seven languages.

```
frequencylist/
├── mymarkers.json            # the markers the receiver shows — hand-edited, survives an update
├── shortwavestations.json    # shortwave broadcasters, generated by generate-current-shortwave.py
├── 0.TXT                     # the A26 global HF schedule, unpacked and parsed by update-markers.sh
├── a26allx2.zip              # source archive downloaded by update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # supporting lists from the same source (sites, languages, admins, antennas)
├── generate-current-shortwave.py
├── update-eibi.sh            # fetches the EiBi schedule for the EiBi window, at most once a day
├── generate-eibi.py          # turns it into frontend/public/eibi.json and frontend/dist/eibi.json
├── update-markers.sh         # refreshes everything above from the online schedules
└── README.md
```

The EiBi window (the **EiBi** button) uses a second, separate list. `update-markers.sh` first runs `update-eibi.sh`, which checks the EiBi schedule (http://www.eibispace.de/dx/) at most once a day and downloads it only when EiBi has published a new one, switching to the next season's list (summer A, winter B) by itself; `generate-eibi.py` turns it into `eibi.json` for the page and works out each station's receiver mode. Run `./frequencylist/update-eibi.sh --force` to fetch it at once. A failed download never stops the markers update. `update.sh` updates both scripts and asks first if you edited them. `update-markers.sh` also tags every HFCC entry it writes to `markers.json` with `"source": "hfcc"`; the EiBi window's **Hide HFCC markers** hides exactly those.

### Format (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

`mode` is a receiver mode (`USB`, `LSB`, `AM`, `FM`, `CW`, …) or the name of a digital mode — `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV`, `NAVTEX`, `FAX`, `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR`, `PSK31`, `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `OLIVIA`, `CONTESTIA`, `MFSK`, `MFSK16`, `MFSK32`, `MFSK64`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `FELDHELL`, `MT63`, `PACKET`, `APRS`, `RADEU`, `RADEL`, `RADE` or `FREEDV` — in which case a click on the marker starts that decoder ([details](DECODERS.md#starting-a-decoder-from-a-frequency-marker)).

---

## Configuration Files

### Server Configuration (`.toml` files)

Structure of configuration files:

```toml
[server]
# Web server settings
port = 9001
html_root = "frontend/dist/"
threads = 2
otherusers = 1
iq = true

[limits]
# Per-IP connection limits — all default to off or to a sensible value, so a
# config without them behaves as it always did. See CONNECTION_LIMITS.md.
per_ip = 3              # simultaneous listeners from one address
per_ip_rate = 40        # new sockets per minute from one address

[websdr]
# Online registration
register_online = true
name = "WebSDR Name"
antenna = "Antenna Type"
grid_locator = "AB12cd"
hostname = "domain.com"

[input]
# SDR input settings
sps = 2048000           # Sample rate
fft_size = 131072       # FFT size
frequency = 145000000   # Base frequency
signal = "iq"           # Signal type: "iq" or "real"
audio_sps = 12000       # Audio sample rate
audio_compression = "opus"  # "flac" or "opus"
accelerator = "opencl"  # "none", "cuda", "opencl"

[input.driver]
# Driver settings
name = "stdin"
format = "u8"           # Sample format

[input.defaults]
# User interface defaults
frequency = 145500000
modulation = "FM"
```

### Site Information (`site_information.json`)

```json
{
  "siteSysop": "Operator Callsign",
  "siteSysopEmailAddress": "email@example.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Hardware specs",
  "siteSoftware": "Software version",
  "siteReceiver": "SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional notes",
  "siteIP": "http://domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Build System

### Meson Build Configuration

#### `meson.build` (Root)

Defines:
- Project metadata
- Dependencies
- Compiler options
- Source file lists
- Build targets

#### `meson_options.txt`

Available options:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Data Flow

### Server Operation Flow

```
1. SDR Hardware → rtl_sdr/hackrf_transfer/etc.
                ↓
2. Sample Stream → stdin → spectrumserver
                ↓
3. spectrumserver:
   - FFT calculation (waterfall)
   - Demodulation (audio)
   - Compression (FLAC/Opus)
                ↓
4. WebSocket → Browser Client
                ↓
5. Browser:
   - Render waterfall
   - Decode and play audio
   - Display controls
```

### User Interaction Flow

```
1. User clicks on waterfall
                ↓
2. JavaScript sends frequency change request
                ↓
3. WebSocket → spectrumserver
                ↓
4. spectrumserver:
   - Updates demodulator frequency
   - Sends new audio stream
                ↓
5. Browser receives and plays new audio
```

---

## File Modification Guide

### When you modify backend code (`src/**`):

```bash
./recompile.sh --backend
```

### When you modify frontend code (`frontend/src/**`):

```bash
./recompile.sh --frontend
```

### When you modify configuration (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### When you modify markers (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Common File Operations

### Customizing the Frontend

1. Modify source: `nano frontend/src/App.svelte`
2. Rebuild: `./recompile.sh --frontend`
3. Restart server: `./stop-websdr.sh && ./start-rtl.sh`

### Adding Custom Markers

1. Edit markers file: `nano markers.json`
2. Format:
   ```json
   {
     "markers": [
       {
         "frequency": 145500000,
         "label": "2m Calling",
         "mode": "FM"
       }
     ]
   }
   ```
3. Reload browser (no server restart needed)

---

## Version Control

### Publishing a release (maintainer)

Before the files are uploaded, refresh the fingerprint list, so that `update.sh` on every station recognises the versions it has as published ones:

```bash
# 1. copy the changed files to the upload copy, then:
bash update.sh --make-known /path/to/the/upload/copy
# 2. commit update-known.txt and copy it to the upload copy as well
```

The list only grows: entries from earlier releases are kept, so a public copy published once stays recognisable in every later release.

---

For setup instructions, see [INSTALLATION.md](INSTALLATION.md). For usage information, see [USER_GUIDE.md](USER_GUIDE.md). For the KiwiSDR client bridge, see [Aether_config.md](Aether_config.md).

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
