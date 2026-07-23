# PhantomSDR-Plus WebSDR (version 3.5.0)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-cyan.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/version-3.5.0-cyan.svg)](https://github.com/sv1btl/PhantomSDR-Plus)

## Note: Tested on Debian 12 (Bookworm), Debian 13 (Trixie), Ubuntu 22.04, Ubuntu 24.04,  Ubuntu 26.04.

**New in v. 3.5.0**

- **Automatic spot reporting to PSK Reporter and WSPRnet** — a built-in *autorun* engine decodes signals off-air locally and uploads your spots to the reporting networks, with no extra software required:
  - **FT8 / FT4 → [PSK Reporter](https://pskreporter.info/)**, over the native IPFIX/UDP protocol, with spots batched and flushed on the recommended ≥5-minute cycle,
  - **WSPR → [WSPRnet](https://wsprnet.org/)**, via the standard upload endpoint (WSPR is sent *only* to WSPRnet, to avoid duplicate spots),
  - Runs several band/mode slots at once (e.g. `20m:ft8`, `40m:ft8`), independently of connected users,
  - Each network can be enabled or disabled separately, and your identity (callsign + Maidenhead grid) is taken from your site configuration,
  - A **dry-run** mode logs the spots it *would* send without actually uploading them, for safe testing.

We also offer many more **features**:
- **New install.sh** procedure that simplifies the initial setup,
- **recompile.sh** script for fast and simple rebuilding of the backend and/or the frontend,
- Futuristic design,
- **CATsync** support, via the [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) application,
- Full-featured Admin Panel, password protected, for controlling the server remotely without SSH access. It provides rich control over many functions, such as viewing logs, moderating the chat, sending messages to users, deleting chat messages without restarting the server, kicking a user, running commands and editing files without a terminal,
- Decoders for **FT8, FT4, FT2, CW, WSPR, HF FAX, SSTV, NAVTEX, FSK/RTTY, FreeDV RADE V1** (see [Decoders](docs/DECODERS.md)) **and C-QUAM AM Stereo** (C-QUAM uses Opus audio compression by default, while the rest of the audio stays in FLAC),
- FreeDV Reporter and DX Cluster tools included,
- When a C-QUAM station is detected, the button text turns green. While in AM mode, clicking the button again activates SAM on the AM carrier; the button text then turns yellow and shows "SAM". Pressing it once more returns to AM,
- Band Plan in the waterfall, with configurable brightness, start frequency and visibility for each band,
- Improved custom colourmap. A reversed spectrum and waterfall is the default layout for all variants, but this can also be changed manually,
- Optimized FLAC and Opus encoders with balanced latency, both running at 16-bit for a 96 dB dynamic range ⭐,
- Many reworked functions, including reduced latency, Noise Reduction, Noise Cancel and Noise Blanker, Synchronous AM by default, AGC selection, Auto SQL, buffer adjustments, Auto Adjust waterfall, mouse-wheel tuning, keyboard shortcuts, a zoom slider, an enhanced mobile GUI, a selectable Noise Gate with presets, and precise tuning with the mouse plus a frequency readout on the waterfall,
- Compressor and Equalizer, with manual settings and reset,
- Redesigned Bookmarks, with on-screen labels and a download/upload function,
- 4 different GUI templates, selectable from a floating popup menu,
- Optional monitor tool that adds real-time server monitoring to your PhantomSDR application,
- On-screen audio spectrogram,
- 'Magic Eye' indicator tool, emulating the EM84 tubes found in older radios,
- Record Audio, or Video + Audio, of the full waterfall or a selected area,
- Real-time user list with geolocation and maps, plus user statistics for any time period,
- Improved server stability. A crash.log is written if the spectrumserver malfunctions,
- The crash.log is also available in the Admin Panel if the spectrumserver fails for any reason; you can read it from the root directory as well. The Admin Panel also offers many functions, such as file editors, a terminal window for running commands, kicking users, deleting chat messages without restarting the server, and posting on-screen messages from the SysOp,
- Optimized mobile GUI,
- Minimizes the CPU and RAM load on the CLIENT as much as possible,
- WebSDR directories (https://sdr-list.xyz, https://sdr.shbrg.nl/sdr/, http://websdr.org/) — now registered on all of them,
- Supported receivers: RX-888, RTL V.4, Airspy Discovery, HackRF, SDRplay RSP1A (original and clone) via Soapy, and many more to be added,
- More to come!...

## Features
- WebSDR which can handle multiple hundreds of users depending on the Hardware.
- Common demodulation modes.
- Can handle high sample rate SDRs (70MSPS real, 35MSPS IQ).
- Support for both IQ and real data.
- Full decoder support.

## Benchmarks
- Ryzen 5* 2600 - All Cores - RX888 MKii with 64MHZ Sample Rate, 32MHZ IQ takes up 38-40% - per User it takes about nothing, 50 Users don't even take 1% of the CPU.
- RX 580 - RX888 MKII with 64MHZ Sample Rate, 32MHZ IQ takes up 28-35% - same as the Ryzen per User it takes about nothing (should handle many).
- Intel i5-6500T - RX888 MKII - 60MHz Sample Rate, 30MHz IQ, OpenCL installed and enabled, about 10-12%. 100 users is no problem with OpenCL as the GPU does the heavy lifting.

## Screenshots

The SV1BTL WebSDR: http://phantomsdr.no-ip.org:8900/

![Screenshot](/docs/websdr.png) ![Screenshot](/docs/websdr2.png)

(https://sdr-list.xyz)

## Building
Optional dependencies such as cuFFT or clFFT can be installed too.

### Ubuntu Prerequisites
```
sudo apt-get install curl build-essential cmake pkg-config meson libusb-1.0-0-dev libfftw3-dev libwebsocketpp-dev libflac++-dev zlib1g-dev libzstd-dev libboost-all-dev libopus-dev libliquid-dev git psmisc
```

### Fedora Prerequisites
```
dnf install g++ meson cmake fftw3-devel websocketpp-devel flac-devel zlib-devel boost-devel libzstd-devel opus-devel liquid-dsp-devel git
```
Inside the PhantomSDR folder there is a script for Fedora named **install_fedora.sh**.

### For use with Arch and openSUSE
Inside the PhantomSDR folder there are scripts for Arch and openSUSE named **install_arc.sh** and **install_opensusse.sh**.

### Step 1 - Building the binary automatically
Restart your terminal after running install.sh, otherwise it won't work.
```
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```
The install.sh script will install everything needed to run the server. <br />

**NB** The script can also install OpenCL for Intel CPUs if you answer "yes" when prompted. Please make sure your PC supports OpenCL first. The script will also check for compatible versions of Vite, Node.js, npm, etc., as follows:<br />

> [!NOTE]
> 
> **🎯 NB - After the final installation**  
>
> If you want to be **registered on the websdr.org map**, follow these instructions: <br />
> 1.- Prepare your .toml file, as explained in the section "The .toml file": <br />
>
> [websdr.org] <br />
> enabled     = true # or false <br />
> public_host = "your_ip_address" <br />
> public_port = PORT <br />
> qth         = "QTH_Locator" <br />
> description = "CALLSIGN PhantomSDR+" <br />
> email       = "mail@domain.com" <br />
> logo        = "logo.jpg" <br />
>
> 2.- Then run the following in a terminal:
> ```
> cp ~/PhantomSDR-Plus/request.hpp  ~/PhantomSDR-Plus/subprojects/websocketpp-0.8.2/websocketpp/http/request.hpp && cp ~/PhantomSDR-Plus/connection_impl.hpp  ~/PhantomSDR-Plus/subprojects/websocketpp-0.8.2/websocketpp/impl/connection_impl.hpp
> ```
> 3.- and finally recompile the frontend and backend in a terminal:
> ```
> cd PhantomSDR-Plus/
> ./recompile.sh
> ```

### Step 2 - Building other options manually

## Installing stats server
```
cd PhantomSDR-Plus
./install-stats-server.sh
```

## Installing Admin Panel
```
cd PhantomSDR-Plus
./setup_admin.sh
```

## Installing the FreeDV RADE V1 decoder
For Debian Bookworm, Debian Trixie or Ubuntu 24.04
```
cd PhantomSDR-Plus
./install_rade.sh
```

or for Ubuntu 22.04
```
cd PhantomSDR-Plus
./install_rade_ubuntu22.sh
```
-----------------

## OPENCL INSTALL (Intel CPU)
```
sudo apt install build-essential cmake pkg-config meson libfftw3-dev libwebsocketpp-dev libflac++-dev zlib1g-dev libzstd-dev libboost-all-dev libopus-dev libliquid-dev
sudo apt install libclfft-dev
sudo apt install ocl-icd-opencl-dev clinfo
sudo reboot
```
```
mkdir neo
cd neo
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
sudo dpkg -i *.deb
```
```
sudo apt update
sudo apt install intel-opencl-icd
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
sudo clinfo
```

## Examples
Remember to set the frequency and sample rate correctly in the .sh files, e.g. start-rtl.sh <br />
You also need to modify the .toml file, e.g. config-rtl.toml

### RTL-SDR
```
rtl_sdr -f 145000000 -s 2048000 - | ./build/spectrumserver --config config.toml
```
**in .toml** <br />
sps=2048000 # RTLSDR Input Sample Rate for 144-146 MHz receiving <br />
frequency=145000000 # Baseband frequency <br />

frequency=145000000 # Default frequency to show user <br />
modulation="FM" # Default modulation <br />

**and in sites-information** <br />
"siteSDRBaseFrequency": 145000000,<br />
"siteSDRBandwidth": 2048000,

### HackRF (10 Msps, WBFM; format: s8)
```
hackrf_transfer -r - -f 100900000 -s 10000000 | ./build/spectrumserver --config config.toml
```
### Airspy HF+ (912 ksps, AM; format: s16)
```
airspy_rx -r - -f 648000 -s 912000 | ./build/spectrumserver --config config.toml
```
### SDRplay RSP1A (8 Msps, LSB; format: s16)
```
rx_sdr -d driver=sdrplay -f 7100000 -s 8000000 - | ./build/spectrumserver --config config.toml
```
### RX888 MK2 (real sampling 6 Msps; format: s16, signal=real)
```
rx888_stream -s 6000000 | ./build/spectrumserver --config config.toml
```

## Start files and configs added for various receivers
Some require Soapy and RX_TOOLS to be installed, otherwise they will not work — for example the Airspy Discovery and the SDRplay RSP1A.<br />
I've also added psutils, as it is needed for the killall command.<br />
Don't forget to disable OpenCL if you didn't install it (though installing it is recommended).


## During installation, the script will open the site-information.json file in your favourite editor for you to edit and save. Don't skip this step!

	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your site IP:port",
	"siteStats": "http://Your site IP:3001",
	"siteSDRBaseFrequency": 0,
	"siteSDRBandwidth": 30000000,
	"siteRegion": 1,
	"siteChatEnabled": true


Where: <br />

**"siteInformation"**: "https://github.com/sv1btl/PhantomSDR-Plus" — please don't change this. It points to the project's GitHub repository.<br />
**"siteIP": "http://Your site IP:port"** — e.g. http://mysite.com:9002 <br />
**"siteStats": "http://Your site IP:3001"** — e.g. http://mysite.com:3001, or any other port you chose during the monitor tool setup. <br />
**"siteSDRBandwidth"**: enter the usable bandwidth of your receiver — e.g. 2048000 for the RTL, or 60000000 or 1200000000 for the RX-888, etc.<br />

**"siteRegion"**: select your IARU region, where:<br />
1 is for Africa, Europe, the Middle East and northern Asia,<br />
2 is for the Americas — North, Central and South America, as well as the Caribbean — and<br />
3 is for Oceania, East Asia, Southeast Asia and the Pacific Islands.<br />

"siteChatEnabled": **true** determines whether the chat window is enabled.<br />


## The .toml file

You also need to edit these sections in the .toml file you use:

[server]
port=PORT # Server port
html_root="frontend/dist/" # HTML files to be hosted
otherusers=1 # Send where other users are listening, 0 to disable
threads=6

[websdr]
register_online=true # Enable directory registration updates
register_urls=[
  "https://sdr-list.xyz/api/update_websdr",
  "https://sdr.shbrg.nl/api/update_websdr"
  ] # One or more directory endpoints that accept the same JSON payload
name="CALSIGN CATsync PhantomSDR+" # Name that is shown on https://sdr-list.xyz and/or https://sdr.shbrg.nl/sdr/
antenna="WIRE" # Antenna that is shown on https://sdr-list.xyz
grid_locator="QTH_LOCATOR" # 4- or 6-character grid locator, shown on https://sdr-list.xyz and used for the distance of FT8 signals
hostname="your_IP" # If you use ddns or something to host with a domain enter it here for https://sdr-list.xyz

[server]<br />
port=9002 # Select your Server port<br />
html_root="frontend/dist/" # HTML files to be hosted<br />
otherusers=1 # Send where other users are listening, 0 to disable<br />
threads=2<br />

[websdr.org]
enabled     = true # or false
public_host = "your_ip_address"
public_port = PORT
qth         = "QTH_Locator"
description = "CALLSIGN PhantomSDR+"
email       = "mail@domain.com"
logo        = "logo.jpg"

[websdr]<br />
register_online=true # or false. If the SDR should be registered on https://sdr-list.xyz then put it to true<br />
name="Name" # Name that is shown on https://sdr-list.xyz<br />
antenna="Whip" # Antenna that is shown on https://sdr-list.xyz<br />
grid_locator="QTH Locator" # 4- or 6-character grid locator, shown on https://sdr-list.xyz and used for the distance of FT8 signals<br />
hostname="your IP, or ddns, or no-ip" # If you host with a domain via ddns or similar, enter it here for https://sdr-list.xyz<br />

[input] # depends on the receiver you use. The following settings are for the RTL<br />
sps=1536000 # RTL Input Sample Rate. For RX888 sps will be 60000000 for 0-30 MHz receiving<br />
fft_size=131072 # For RTL. FFT bins alternative for RX888 are 1048576, 2097152, 4194304, 8388608 (default for RX888), 16777216, look at https://www.mymathtables.com/numbers/power-exponentiation/power-of-2.html<br />
brightness_offset=-10 # Waterfall brightness offset. Reduce to negative if you see black regions in the waterfall<br />
frequency=1242000 # Baseband frequency<br />
signal="iq" # real or iq (real for RX888)<br />
fft_threads=2<br />
accelerator="none" # Accelerator: none, cuda, opencl<br />
audio_sps=12000 # Audio Sample Rate. Keep it always to 12000 for FT8 and Opus<br />
audio_compression="flac" # flac or opus<br />
smeter_offset=-2<br />
waterfall_size=1024<br />
waterfall_compression="zstd"<br />

[input.driver]<br />
name="stdin" # Driver name<br />
format="u8" # Sample format: u8, s8, u16, s16, u32, s32, f32, f64 -> use s16 for RX888<br />

[input.defaults]<br />
frequency=1170000 # Default frequency to show user<br />
modulation="AM" # Default modulation<br />


## The bands-config.js
This file is located in frontend/src/bands-config.js and defines the bands the SysOp creates. <br />
- You will see something like the following, and you are free to edit it as you like:
   ```
   - const bands = 
   .....
   - { ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
   .....
   etc
   ```
   **Where:** <br />
   - **ITU** is the region in which the server is located,
   - **min & max** are the waterfall brightness limits for the given band,
   - **initFreq** is the initial frequency to tune to when the band is selected,
   - **publishBand** sets whether the band is shown: 1 for amateur bands, 2 for broadcast bands,
   - **startFreq & endFreq** define the band limits,
   - **stepi** is the default mouse-wheel step for the band, and **modes** is the preferred default mode for the band.

- After making changes, **run recompile.sh in a terminal** from the PhantomSDR-Plus folder.


## Background image

The image is located at PhantomSDR-Plus/frontend/src/assets/background.jpg<br />
Replace it with the image you prefer, but keep the same filename.


## The recompile tool
The **recompile.sh** script is located in the root folder of PhantomSDR-Plus and must be run in a terminal window. <br />
It offers the following options: <br />
```
What would you like to recompile?

  [1] Backend only
  [2] Frontend only (with default App.svelte selection)
  [3] Both backend and frontend
  [0] Exit

Select an option [0-3]: 
```
If you select [2] Frontend only (with default App.svelte selection), you will be given these options:

```
==========================================
Select Default App.svelte Variant
==========================================

Which version should be the default App.svelte?

  [1] Analog S-Meter (App__analog_smeter_.svelte)
  [2] Digital S-Meter (App__digital_smeter_.svelte)
  [3] V2 Analog S-Meter (App__v2_analog_smeter_.svelte)
  [4] V2 Digital S-Meter (App__v2_digital_smeter_.svelte)

Select default variant [1-4]: 
```
Pick the default layout to be loaded initially. The other variants can still be selected from a floating popup window. <br /> 
Then a new options menu appears: <br />
```
==========================================
Frontend Build Options
==========================================

Select which frontend build script to run:

  [1] build-all.sh           - Build all versions (recommended)
  [2] build-default.sh       - Build default version only
  [3] build-analog.sh        - Build analog S-meter version
  [4] build-digital.sh       - Build digital S-meter version
  [5] build-v2-analog.sh     - Build V2 analog S-meter version
  [6] build-v2-digital.sh    - Build V2 digital S-meter version
  [7] Custom selection       - Choose multiple builds
  [0] Skip frontend build

Select an option [0-7]: 
```
The script will build the separate /dist folders, each with its own index.html, and will include the favicon.ico and the SysOp name in the title of each web page.


## The Monitor tool
This is an optional feature that adds real-time server monitoring to your PhantomSDR application through an automated installation script.<br />
Please refer to the **[Readme](docs/sdr-stats/README.md)** for detailed instructions.


## The Admin area
This is an optional feature that adds a real-time admin control panel to your PhantomSDR application through an automated installation script.<br />
Please refer to the **[Readme](docs/ADMIN_SETUP.md)** for detailed instructions.


## Final notes
If you reinstall or upgrade, please back up your previous installation, as you may need some of these files: <br /> 
- site_information.json (in frontend),
- markers.json, the start and stop scripts, your .toml file and possibly chat_history.txt (all located in the root of the PhantomSDR-Plus folder),
- bands-config.js (in frontend/src). <br />
Restore your originals after the installation, so you don't have to edit them again. <br />
Don't forget to recompile afterwards.


## 📚 Documentation

For detailed information about installation, usage, and project structure, please refer to the comprehensive documentation:

### 📖 For System Operators:

- **[Readme](docs/README.md)** - General instructions
  - Key Features
  - Supported Hardware
  - Quick Start
  - Installation
  - Performance Benchmarks
  - Usage
  - Configuration, Customization

- **[Installation Guide](docs/INSTALLATION.md)** - Complete step-by-step installation instructions
  - System requirements and preparation
  - Dependency installation (Ubuntu/Fedora)
  - Node.js and npm setup
  - OpenCL configuration (Intel/AMD/NVIDIA)
  - SDR device-specific setup
  - Systemd service configuration
  - Troubleshooting and optimization

- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Directory tree and code organization
  - Complete directory tree visualization
  - Source code structure and organization
  - Configuration file formats
  - Build system documentation
  - File modification guidelines

- **[Monitor Tool](docs/sdr-stats/README.md)** - for detailed instructions adding the monitor tool.
  - Auto installation script
  - Files for manual installation
  
- **[Admin area](docs/ADMIN_PANEL_SETUP.md)** - for detailed instructions adding the admin control tool.
  - Auto installation script
  - Files for manual installation    

### 👥 For End Users:

- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for using the WebSDR
  - Interface overview and navigation
  - Tuning and demodulation modes
  - Advanced features (AGC, NR, NB, etc.)
  - Digital mode decoders (FT8)
  - Keyboard shortcuts and bookmarks
  - Mobile device usage
  - Troubleshooting and FAQ
- **[Decoders](docs/DECODERS.md)** - Complete guide for using the decoders of the PhantomSDR

### 🎯 Quick Links:

- **Live Demo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR Directory**: https://sdr-list.xyz
- **GitHub Issues**: [Report bugs or request features](https://github.com/sv1btl/PhantomSDR-Plus/issues)

---

## -- 73 de SV1BTL & SV2AMK --
