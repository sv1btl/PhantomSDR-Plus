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

```
PhantomSDR-Plus/
.
├── chat_history.txt
├── config-airspyhf.toml
├── config.example.hackrf.toml
├── config.example.rtlsdr.toml
├── config-rsp1a.toml
├── config-rtl.toml
├── config-rx888mk2_hf.toml
├── config-rx888mk2.toml
├── config.toml
├── docs
│   ├── INSTALLATION.md
│   ├── PROJECT_STRUCTURE.md
│   ├── README.md
│   ├── sdr-stats
│   │   ├── install-stats-server.sh
│   │   ├── package.json
│   │   ├── README.md
│   │   └── system-stats-server.js
│   ├── USER_GUIDE.md
│   └── websdr.png
├── favicon.ico
├── fftw_wisdom
├── frequencylist
│   ├── frequencylist.zip
│   └── README.md
├── frontend
│   ├── build-all.sh
│   ├── build-analog.sh
│   ├── build-default.sh
│   ├── build-digital.sh
│   ├── build-v2-analog.sh
│   ├── build-v2-digital.sh
│   ├── debug-title.sh
│   ├── favicon.ico
│   ├── fix-title-python.py
│   ├── index.html
│   ├── jsconfig.json
│   ├── LICENSE
│   ├── package.json
│   ├── package-lock.json
│   ├── pnpm-lock.yaml
│   ├── postcss.config.cjs
│   ├── README.md
│   ├── site_information.json
│   ├── src
│   │   ├── App__analog_smeter_.svelte
│   │   ├── app.css
│   │   ├── App__digital_smeter_.svelte
│   │   ├── App.svelte
│   │   ├── App__v2_analog_smeter_.svelte
│   │   ├── App__v2_digital_smeter_.svelte
│   │   ├── assets
│   │   │   ├── amateurfrequencies.json
│   │   │   ├── background.jpg
│   │   │   ├── shortwavestations.json
│   │   │   └── svelte.png
│   │   ├── audio.js
│   │   ├── bands-config.js
│   │   ├── eventBus.js
│   │   ├── events.js
│   │   ├── fft.js
│   │   ├── lib
│   │   │   ├── backend.js
│   │   │   ├── CheckButton.svelte
│   │   │   ├── colormaps.js
│   │   │   ├── Counter.svelte
│   │   │   ├── FrequencyInput.svelte
│   │   │   ├── FrequencyMarkers.svelte
│   │   │   ├── hammeractions.js
│   │   │   ├── LineThroughButton.svelte
│   │   │   ├── Logger.svelte
│   │   │   ├── opusMlDecoder.js
│   │   │   ├── PassbandTuner.svelte
│   │   │   ├── Popover.svelte
│   │   │   ├── Spectrogram.svelte
│   │   │   ├── storage.js
│   │   │   ├── Tooltip.svelte
│   │   │   ├── VersionSelector.svelte
│   │   │   └── wrappers.js
│   │   ├── main.js
│   │   ├── modules
│   │   │   ├── decode.wasm
│   │   │   ├── encode.wasm
│   │   │   ├── ft8.js
│   │   │   ├── package.json
│   │   │   ├── phantomsdrdsp_bg_fallback.js
│   │   │   ├── phantomsdrdsp_bg.js
│   │   │   ├── phantomsdrdsp_bg.wasm
│   │   │   ├── phantomsdrdsp_bg.wasm.d.ts
│   │   │   ├── phantomsdrdsp.d.ts
│   │   │   ├── phantomsdrdsp.js
│   │   │   ├── phantomsdrdsp_router.js
│   │   │   └── README.md
│   │   ├── unused
│   │   │   ├── AudioProcessor.js
│   │   │   ├── decoder.js
│   │   │   ├── decoding.js
│   │   │   ├── modules-emscripten
│   │   │   │   ├── dav1d.js
│   │   │   │   ├── dav1dnoWasm.js
│   │   │   │   ├── dav1dnoWasm.js.mem
│   │   │   │   ├── dav1d.wasm
│   │   │   │   ├── decode_ft8.js
│   │   │   │   ├── decode_ft8.wasm
│   │   │   │   ├── FoxenFlac.js
│   │   │   │   ├── jsDSP.js
│   │   │   │   ├── jsDSPnoWasm.js
│   │   │   │   ├── jsDSPnoWasm.js.mem
│   │   │   │   ├── jsDSPnoWasm.wasm
│   │   │   │   ├── jsDSP.wasm
│   │   │   │   ├── libzstd.js
│   │   │   │   ├── LiquidDSP.js
│   │   │   │   ├── opus.js
│   │   │   │   ├── opusnoWasm.js
│   │   │   │   ├── opusnoWasm.js.mem
│   │   │   │   ├── opus.wasm
│   │   │   │   ├── redsea.js
│   │   │   │   └── redsea.wasm
│   │   │   ├── unused.js
│   │   │   └── wrappers.js
│   │   ├── vite-env.d.ts
│   │   └── waterfall.js
│   ├── stats.html
│   ├── svelte.config.js
│   ├── switch-version.sh
│   ├── tailwind.config.cjs
│   └── vite.config.js
├── install.sh
├── install_arc.sh
├── install_fedora.sh
├── install_opensusse.sh
├── instractions-for-airspy
├── instractions-for-rsp1a
├── jsdsp
│   ├── compilejs.sh
│   ├── configureredsea.sh
│   ├── extract_EXPORTED_FUNCTIONS.js
│   ├── include
│   │   ├── avif
│   │   │   ├── avif.h
│   │   │   └── internal.h
│   │   └── liquid
│   │       └── liquid.h
│   ├── lib
│   │   ├── ANR.c
│   │   ├── arm_funcs.h
│   │   ├── CMSIS_DSP
│   │   │   ├── BUILDING.txt
│   │   │   └── LICENSE.txt
│   │   ├── dav1d.cpp
│   │   ├── NB.c
│   │   ├── NR_spectral.c
│   │   └── types.h
│   ├── redsea.js
│   ├── redsea.wasm
│   └── src
│       ├── index.js
│       ├── libzstd.js
│       ├── LiquidDSP.js
│       ├── NoiseProcessing.js
│       └── wbfmpll.cpp
├── LICENSE
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── README.md
├── recompile
├── recompile.sh
├── src
│   ├── audio.cpp
│   ├── audio.h
│   ├── chat.cpp
│   ├── chat.h
│   ├── client.cpp
│   ├── client.h
│   ├── compression.cpp
│   ├── compression.h
│   ├── events.cpp
│   ├── events.h
│   ├── fft.cpp
│   ├── fft_cuda.cu
│   ├── fft.h
│   ├── fft_impl.cpp
│   ├── fft_mkl.cpp
│   ├── http.cpp
│   ├── samplereader.cpp
│   ├── samplereader.h
│   ├── signal.cpp
│   ├── signal.h
│   ├── spectrumserver.cpp
│   ├── spectrumserver.h
│   ├── utils
│   │   ├── audioprocessing.cpp
│   │   ├── audioprocessing.h
│   │   ├── dsp.cpp
│   │   └── dsp.h
│   ├── utils.cpp
│   ├── utils.h
│   ├── waterfallcompression.cpp
│   ├── waterfallcompression.h
│   ├── waterfall.cpp
│   ├── waterfall.h
│   ├── websocket.cpp
│   └── websocket.h
├── start-airspyhf.sh
├── start-all-websdr.sh
├── start-rsp1a.sh
├── start-rtl.sh
├── start-rx888mk2.sh
├── stop-websdr.sh
└── subprojects
    ├── fftw3.wrap
    ├── flac.wrap
    ├── glaze.wrap
    ├── libcds.wrap
    ├── libflac.wrap
    ├── libvolk.wrap
    ├── ogg.wrap
    ├── opus.wrap
    ├── tomlplusplus-3.4.0
    │   ├── CHANGELOG.md
    │   ├── cmake
    │   │   ├── install-rules.cmake
    │   │   ├── project-is-top-level.cmake
    │   │   ├── tomlplusplusConfig.cmake
    │   │   ├── tomlplusplusConfig.cmake.meson.in
    │   │   ├── tomlplusplusConfigVersion.cmake.meson.in
    │   │   └── variables.cmake
    │   ├── CMakeLists.txt
    │   ├── CODE_OF_CONDUCT.md
    │   ├── CONTRIBUTING.md
    │   ├── cpp.hint
    │   ├── docs
    │   │   ├── images
    │   │   │   ├── badge-awesome.svg
    │   │   │   ├── badge-C++17.svg
    │   │   │   ├── badge-gitter.svg
    │   │   │   ├── badge-license-MIT.svg
    │   │   │   ├── badge-TOML.svg
    │   │   │   ├── banner.ai
    │   │   │   ├── banner.png
    │   │   │   ├── banner.svg
    │   │   │   ├── favicon.ico
    │   │   │   ├── logo.ai
    │   │   │   └── logo.svg
    │   │   ├── pages
    │   │   │   └── main_page.md
    │   │   └── poxy.toml
    │   ├── examples
    │   │   ├── benchmark_data.toml
    │   │   ├── CMakeLists.txt
    │   │   ├── error_printer.cpp
    │   │   ├── error_printer.vcxproj
    │   │   ├── examples.hpp
    │   │   ├── example.toml
    │   │   ├── merge_base.toml
    │   │   ├── merge_overrides.toml
    │   │   ├── meson.build
    │   │   ├── parse_benchmark.cpp
    │   │   ├── parse_benchmark.vcxproj
    │   │   ├── simple_parser.cpp
    │   │   ├── simple_parser.vcxproj
    │   │   ├── toml_generator.cpp
    │   │   ├── toml_generator.vcxproj
    │   │   ├── toml_merger.cpp
    │   │   ├── toml_merger.vcxproj
    │   │   ├── toml_to_json_transcoder.cpp
    │   │   └── toml_to_json_transcoder.vcxproj
    │   ├── include
    │   │   ├── meson.build
    │   │   └── toml++
    │   │       ├── impl
    │   │       │   ├── array.hpp
    │   │       │   ├── array.inl
    │   │       │   ├── at_path.hpp
    │   │       │   ├── at_path.inl
    │   │       │   ├── date_time.hpp
    │   │       │   ├── formatter.hpp
    │   │       │   ├── formatter.inl
    │   │       │   ├── forward_declarations.hpp
    │   │       │   ├── header_end.hpp
    │   │       │   ├── header_start.hpp
    │   │       │   ├── json_formatter.hpp
    │   │       │   ├── json_formatter.inl
    │   │       │   ├── key.hpp
    │   │       │   ├── make_node.hpp
    │   │       │   ├── node.hpp
    │   │       │   ├── node.inl
    │   │       │   ├── node_view.hpp
    │   │       │   ├── parse_error.hpp
    │   │       │   ├── parse_result.hpp
    │   │       │   ├── parser.hpp
    │   │       │   ├── parser.inl
    │   │       │   ├── path.hpp
    │   │       │   ├── path.inl
    │   │       │   ├── preprocessor.hpp
    │   │       │   ├── print_to_stream.hpp
    │   │       │   ├── print_to_stream.inl
    │   │       │   ├── simd.hpp
    │   │       │   ├── source_region.hpp
    │   │       │   ├── std_except.hpp
    │   │       │   ├── std_initializer_list.hpp
    │   │       │   ├── std_map.hpp
    │   │       │   ├── std_new.hpp
    │   │       │   ├── std_optional.hpp
    │   │       │   ├── std_string.hpp
    │   │       │   ├── std_string.inl
    │   │       │   ├── std_utility.hpp
    │   │       │   ├── std_variant.hpp
    │   │       │   ├── std_vector.hpp
    │   │       │   ├── table.hpp
    │   │       │   ├── table.inl
    │   │       │   ├── toml_formatter.hpp
    │   │       │   ├── toml_formatter.inl
    │   │       │   ├── unicode_autogenerated.hpp
    │   │       │   ├── unicode.hpp
    │   │       │   ├── unicode.inl
    │   │       │   ├── value.hpp
    │   │       │   ├── version.hpp
    │   │       │   ├── yaml_formatter.hpp
    │   │       │   └── yaml_formatter.inl
    │   │       ├── toml.h
    │   │       └── toml.hpp
    │   ├── LICENSE
    │   ├── meson.build
    │   ├── meson_options.txt
    │   ├── README.md
    │   ├── src
    │   │   ├── meson.build
    │   │   └── toml.cpp
    │   ├── tests
    │   │   ├── at_path.cpp
    │   │   ├── conformance_burntsushi_invalid.cpp
    │   │   ├── conformance_burntsushi_valid.cpp
    │   │   ├── conformance_iarna_invalid.cpp
    │   │   ├── conformance_iarna_valid.cpp
    │   │   ├── cpp.hint
    │   │   ├── for_each.cpp
    │   │   ├── formatters.cpp
    │   │   ├── impl_toml.cpp
    │   │   ├── leakproof.hpp
    │   │   ├── lib_catch2.hpp
    │   │   ├── main.cpp
    │   │   ├── manipulating_arrays.cpp
    │   │   ├── manipulating_parse_result.cpp
    │   │   ├── manipulating_tables.cpp
    │   │   ├── manipulating_values.cpp
    │   │   ├── meson.build
    │   │   ├── odr_test_1.cpp
    │   │   ├── odr_test_2.cpp
    │   │   ├── parsing_arrays.cpp
    │   │   ├── parsing_booleans.cpp
    │   │   ├── parsing_comments.cpp
    │   │   ├── parsing_dates_and_times.cpp
    │   │   ├── parsing_floats.cpp
    │   │   ├── parsing_integers.cpp
    │   │   ├── parsing_key_value_pairs.cpp
    │   │   ├── parsing_spec_example.cpp
    │   │   ├── parsing_strings.cpp
    │   │   ├── parsing_tables.cpp
    │   │   ├── path.cpp
    │   │   ├── settings.hpp
    │   │   ├── tests.cpp
    │   │   ├── tests.hpp
    │   │   ├── user_feedback.cpp
    │   │   ├── using_iterators.cpp
    │   │   ├── visit.cpp
    │   │   ├── vs
    │   │   │   ├── odr_test.vcxproj
    │   │   │   ├── test_debug_x64_cpplatest_noexcept_unrel.vcxproj
    │   │   │   ├── test_debug_x64_cpplatest_noexcept.vcxproj
    │   │   │   ├── test_debug_x64_cpplatest_unrel.vcxproj
    │   │   │   ├── test_debug_x64_cpplatest.vcxproj
    │   │   │   ├── test_debug_x64_noexcept_unrel.vcxproj
    │   │   │   ├── test_debug_x64_noexcept.vcxproj
    │   │   │   ├── test_debug_x64_unrel.vcxproj
    │   │   │   ├── test_debug_x64.vcxproj
    │   │   │   ├── test_debug_x86_cpplatest_noexcept_unrel.vcxproj
    │   │   │   ├── test_debug_x86_cpplatest_noexcept.vcxproj
    │   │   │   ├── test_debug_x86_cpplatest_unrel.vcxproj
    │   │   │   ├── test_debug_x86_cpplatest.vcxproj
    │   │   │   ├── test_debug_x86_noexcept_unrel.vcxproj
    │   │   │   ├── test_debug_x86_noexcept.vcxproj
    │   │   │   ├── test_debug_x86_unrel.vcxproj
    │   │   │   ├── test_debug_x86.vcxproj
    │   │   │   ├── test_release_x64_cpplatest_noexcept_unrel.vcxproj
    │   │   │   ├── test_release_x64_cpplatest_noexcept.vcxproj
    │   │   │   ├── test_release_x64_cpplatest_unrel.vcxproj
    │   │   │   ├── test_release_x64_cpplatest.vcxproj
    │   │   │   ├── test_release_x64_noexcept_unrel.vcxproj
    │   │   │   ├── test_release_x64_noexcept.vcxproj
    │   │   │   ├── test_release_x64_unrel.vcxproj
    │   │   │   ├── test_release_x64.vcxproj
    │   │   │   ├── test_release_x86_cpplatest_noexcept_unrel.vcxproj
    │   │   │   ├── test_release_x86_cpplatest_noexcept.vcxproj
    │   │   │   ├── test_release_x86_cpplatest_unrel.vcxproj
    │   │   │   ├── test_release_x86_cpplatest.vcxproj
    │   │   │   ├── test_release_x86_noexcept_unrel.vcxproj
    │   │   │   ├── test_release_x86_noexcept.vcxproj
    │   │   │   ├── test_release_x86_unrel.vcxproj
    │   │   │   └── test_release_x86.vcxproj
    │   │   └── windows_compat.cpp
    │   ├── toml++.code-workspace
    │   ├── toml.hpp
    │   ├── toml++.natvis
    │   ├── toml++.props
    │   ├── toml++.sln
    │   ├── toml-test
    │   │   ├── meson.build
    │   │   ├── README.md
    │   │   ├── tt_decoder.cpp
    │   │   ├── tt_decoder.vcxproj
    │   │   ├── tt_encoder.cpp
    │   │   ├── tt_encoder.vcxproj
    │   │   └── tt.hpp
    │   ├── toml++.vcxproj
    │   ├── toml++.vcxproj.filters
    │   ├── tools
    │   │   ├── ci_single_header_check.py
    │   │   ├── clang_format.bat
    │   │   ├── generate_conformance_tests.py
    │   │   ├── generate_single_header.bat
    │   │   ├── generate_single_header.py
    │   │   ├── generate_windows_test_targets.py
    │   │   ├── requirements.txt
    │   │   ├── utils.py
    │   │   └── version.py
    │   └── vendor
    │       ├── catch.hpp
    │       ├── json.hpp
    │       └── README.md
    ├── tomlplusplus.wrap
    ├── websocketpp.wrap
    ├── zlib.wrap
    └── zstd.wrap

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
| `config-rx888mk2.toml` | RX888 MK2 config | Using RX888 device |
| `config.example.hackrf.toml` | HackRF One example | Using HackRF device |

### Start/Stop Scripts

| Script | Purpose |
|--------|---------|
| `install.sh` | Automated installation and build |
| `start-rtl.sh` | Launch server with RTL-SDR |
| `start-rsp1a.sh` | Launch server with RSP1A |
| `start-airspyhf.sh` | Launch server with Airspy HF+ |
| `start-rx888mk2.sh` | Launch server with RX888 MK2 |
| `start-all-websdr.sh` | Launch multiple instances |
| `stop-websdr.sh` | Stop running server instances |

### Data Files

| File | Purpose | Format |
|------|---------|--------|
| `markers.json` | Frequency bookmarks and markers | JSON |
| `chat_history.txt` | User chat messages | Plain text |
| `favicon.ico` | Website icon | ICO image |
| `fftw_wisdom` | FFT optimization data | FFTW binary |
| `phantom_fftw_wisdom` | Additional FFT optimization | FFTW binary |

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
- AGC and noise reduction

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

#### 2. Waterfall Display (`Waterfall.svelte`)
- Canvas-based spectrum visualization
- Interactive tuning
- Band plan overlay

#### 3. Controls (`Controls.svelte`)
- Frequency input/display
- Mode selection (AM/FM/SSB/CW)
- Filter bandwidth
- AGC/NR/NB controls

#### 4. Audio System (`lib/audio.js`)
- WebSocket audio stream
- FLAC/Opus decoding
- Audio playback control

#### 5. State Management (`stores/`)
- Reactive data stores
- Shared application state
- Event handling

---

### Key Features

- Real-time audio processing
- Digital mode decoding (FT8, RTTY, etc.)
- Audio filtering
- Spectrum analysis

---


## Frequency Lists (`frequencylist/`)

Database files containing frequency allocations and station information.

```
frequencylist/
├── stations.csv              # Station database
├── repeaters.csv             # Repeater frequencies
├── broadcast.csv             # Broadcast stations
└── ...                       # Additional lists
```

### Format Example (`stations.csv`)

```csv
Frequency,Mode,Description,Band
7100000,LSB,40m Phone,40m
14200000,USB,20m Phone,20m
145500000,FM,2m Calling,2m
```

---

## Configuration Files

### Server Configuration (`.toml` files)

Structure of configuration files:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

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

### Site Information (`site-information.json`)

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
  "siteIP": "http://domain.com:9002",
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

## File Dependencies

### Backend Build Dependencies

```
spectrumserver binary depends on:
├── C++ source files (src/**/*.cpp)
├── External libraries:
│   ├── FFTW3
│   ├── WebSocket++
│   ├── FLAC
│   ├── Opus
│   ├── Liquid-DSP
│   ├── Boost
│   ├── zlib
│   ├── zstd
│   └── OpenCL/CUDA (optional)
└── Subproject headers:
    ├── nlohmann/json
    └── toml11
```

### Frontend Build Dependencies

```
frontend/dist/ depends on:
├── Source files (frontend/src/**)
├── npm packages (node_modules/):
│   ├── Svelte
│   ├── Vite
│   ├── @wasm-audio-decoders/opus-ml
│   └── ...
└── Static assets (frontend/public/)
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
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### When you modify frontend code (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
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

## Important Paths

### Runtime Paths

- **Configuration**: `./config-*.toml`
- **HTML Root**: `./frontend/dist/`
- **Markers**: `./markers.json`
- **Chat History**: `./chat_history.txt`
- **FFTW Wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Build Paths

- **Binary Output**: `./build/spectrumserver`
- **Frontend Output**: `./frontend/dist/`
- **Node Modules**: `./frontend/node_modules/`

### Source Paths

- **Backend Source**: `./src/`
- **Frontend Source**: `./frontend/src/`
- **DSP Libraries**: `./jsdsp/`

---

## Common File Operations

### Adding a New SDR Configuration

1. Copy existing config: `cp config-rtl.toml config-mydevice.toml`
2. Edit parameters: `nano config-mydevice.toml`
3. Create start script: `cp start-rtl.sh start-mydevice.sh`
4. Edit start script: `nano start-mydevice.sh`
5. Make executable: `chmod +x start-mydevice.sh`

### Customizing the Frontend

1. Modify source: `nano frontend/src/App.svelte`
2. Rebuild: `cd frontend && npm run build && cd ..`
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

### Files to Track in Git

- Source code (`src/`, `frontend/src/`, `jsdsp/`)
- Configuration examples (`config.example.*.toml`)
- Build system (`meson.build`, `meson_options.txt`)
- Documentation (`*.md`, `docs/`)
- Scripts (`*.sh`)

### Files to Ignore (`.gitignore`)

- Build output (`build/`, `frontend/dist/`)
- Dependencies (`frontend/node_modules/`)
- User data (`chat_history.txt`)
- Personal configs (`config-rtl.toml` if customized)
- Binary data (`*.o`, `*.so`)

---

**This structure documentation should help you navigate and understand the PhantomSDR-Plus codebase.**

For setup instructions, see [INSTALLATION.md](INSTALLATION.md).
For usage information, see [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
