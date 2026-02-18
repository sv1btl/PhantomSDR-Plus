# PhantomSDR-Plus WebSDR (version 1.7.0)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/version-1.7.0-cyan.svg)](https://github.com/sv1btl/PhantomSDR-Plus)

## Note: Please dont use Ubuntu 24.04, stick to Ubuntu 22.04 as it wont compile successfully on 24.04 (FM demodulation problems)!
This is a **different Repo than the Official PhantomSDR Repo**

We offer more **features**:
- **New install.sh** procedure, that simplifies initial setup,
- **recompile.sh** script for fast and simply recostruction of either backend and/or frontend,
- Futuristic Design,
- Decoders, **FT8 & C-QUAM AM Stereo (best workink whem Opus audio_compression is used)**
- Band Plan in the Waterfall, definition for different brigthness, start frequency and visibility for each band, 
- Better Custom Colorsmap,
- Optimized Flac and Opus encoder with balanced latency, both working in 16 bit, Dynamic Range 96 dB ⭐
- New approach in functions as reduced Latency, Noise Reduction, Noise Cancel & Noise Blanker, Synchronous AM by default, AGC selection, Auto SQL, Buffer adjustments, Auto Adjust waterfall, Mouse wheel use, Keyboard shortcuts, Zoom slider, enhanced Mobile GUI, selectable Noise Gate with presets, Precise tuning with mouse and frequency index in the waterfall with mouse,
- New Bookmarks design with on screen labels and download/upload function, 
- 4 different GUI templates, that can be selected using a popup float menu,
- Optional monitor tool that adds real-time server monitoring to your PhantomSDR application.
- On screen audio spectrogram.
- Increased server's stability.
- WebSDR List (https://sdr-list.xyz),
- Supported receivers RX-888, RTL V.4, Airspy Discovery, HackRF, SDRPLAY RSP1A (original and clone) via Soapy and many more to be added,
- More to come!...

## Features
- WebSDR which can handle multiple hundreds of users depending on the Hardware.
- Common demodulation modes.
- Can handle high sample rate SDRs (70MSPS real, 35MSPS IQ).
- Support for both IQ and real data.

## Benchmarks
- Ryzen 5* 2600 - All Cores - RX888 MKii with 64MHZ Sample Rate, 32MHZ IQ takes up 38-40% - per User it takes about nothing, 50 Users don't even take 1% of the CPU.
- RX 580 - RX888 MKII with 64MHZ Sample Rate, 32MHZ IQ takes up 28-35% - same as the Ryzen per User it takes about nothing (should handle many).
- Intel i5-6500T - RX888 MKII - 60MHz Sample Rate, 30MHz IQ, OpenCL installed and enabled, about 10-12%. 100 users is no problem with OpenCL as the GPU does the heavy lifting.

## Screenshots

The SV1BTL WebSDR: http://phantomsdr.no-ip.org:8900/

![Screenshot](/docs/websdr.png)

(https://sdr-list.xyz)

## Building
Optional dependencies such as cuFFT or clFFT can be installed too.

### Ubuntu Prerequisites
```
sudo apt-get install curl build-essential cmake pkg-config meson curl libfftw3-dev libwebsocketpp-dev libflac++-dev zlib1g-dev libzstd-dev libboost-all-dev libopus-dev libliquid-dev git psmisc
```

### Fedora Prerequisites
```
dnf install g++ meson cmake fftw3-devel websocketpp-devel flac-devel zlib-devel boost-devel libzstd-devel opus-devel liquid-dsp-devel git
```
Inside the PhantomSDR folder, there is a script for use in Fedora named: **install_fedora.sh**

### for use with Arc and openSUSSE
Inside the PhantomSDR folder, there are a scripts for use in Arc and openSUSSE named: **install_arc.sh** and **install_opensusse.sh**


## Building the binary automatically
Restart your Terminal after you ran install.sh otherwise it wont work..
```
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```
The script install.sh, will install everything needed so to run the server. <br />

**NB** The script will install OpenCL for Intel CPU as well, if you answer "yes" when it asks for it. Please ensure thst your pc supports OpenCL. The script will also check for compatible Vite,, Node.js, npm etc as follows:<br />

1. Node.js 18 Installation via nvm <br />

- Automatically detects if Node.js is installed and checks version
- Installs Node.js 18 using nvm (Node Version Manager) if needed
- Ensures compatibility with Vite 5.4.16

2. Vite 5.4.16 with Svelte 4 Compatible Packages <br />
Added a dedicated section that:<br />

- Cleans previous installations (node_modules, package-lock.json)
- Uninstalls conflicting packages
- Installs the exact compatible versions:

vite@5.4.16 <br />
@sveltejs/vite-plugin-svelte@^3.1.2 (compatible with Svelte 4) <br />
@vitejs/plugin-legacy@^5.4.2 (compatible with Vite 5) <br />
svelte@^4.2.20 <br />
esbuild@latest (fixes security vulnerability) <br />


## Manually Installing nodejs and npm using nvm
During installation procedure, the script will check if npm is installed. If not, it will try to install all the packets needed.<br />
You can always install manually: <br />

(Do not use sudo , as it will enable nvm for the root user. Follow instructions - https://linuxize.com/post/how-to-install-node-js-on-ubuntu-20-04/#installing-nodejs-and-npm-using-nvm)
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```
(verify) : 
```
nvm --version
nvm list-remote
nvm install node
node --version
```

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
Remember to set the frequency and sample rate correctly, in the .sh files, e.g. start-rtl.sh <br />
You have also to modify the  .toml file, e.g. config-rtl.toml

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

## Added start files and configs for various recievers. 
Some need Soapy and RX_TOOLS installed else they do not work, e.g. Airspy Discovery and SDRPlay RSP1A.<br />
I've also added psutils as it's needed for killall command.<br />
Do not forget to disable opencl if you didn't install it, it's recommended you do.


## During install procedure, the script will edit and save the site-information.json file with your favorite editor. Don't avoid to do this!

	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open source WebSDR project, which is dynamicaly developing.",
	"siteIP": "http://Your site IP:port",
	"siteStats": "http://Your site IP:3001",
	"siteSDRBaseFrequency": 0,
	"siteSDRBandwidth": 30000000,
	"siteRegion": 1,
	"siteChatEnabled": true


Where: <br />

**"siteInformation"**: "https://github.com/sv1btl/PhantomSDR-Plus" please don't change it. It indicates the github repo of the project.<br />
**"siteIP": "http://Your site IP:port"** e.g. http://mysite.com:9002 <br />
**"siteStats": "http://Your site IP:3001"**  e.g. http://mysite.com:3001 or any other port that you want to use, during the monitor's tool setup. <br />
**"siteSDRBandwidth"**: you must type the usefull band with of your receiver, e.g. for RTL is 2048000, for RX-888 is 60000000 or 1200000000 etc.<br />

**"siteRegion"**: , you have to select IARU region, where:<br />
1 is for Africa, Europe, the Middle East, and northern Asia,<br />
2 is for the Americas, including North, Central, and South America, as well as the Caribbean and<br />
3 is for Oceania, East Asia, Southeast Asia, and the Pacific Islands.<br />

"siteChatEnabled": **true** defines if the chat window will be activated.<br />


## The .toml file

You have also to edit these topics in .toml file you use:

[server]<br />
port=9002 # Select your Server port<br />
html_root="frontend/dist/" # HTML files to be hosted<br />
otherusers=1 # Send where other users are listening, 0 to disable<br />
threads=2<br />

[websdr]<br />
register_online=true # or false. If the SDR should be registered on https://sdr-list.xyz then put it to true<br />
name="Name" # Name that is shown on https://sdr-list.xyz<br />
antenna="Whip" # Antenna that is shown on https://sdr-list.xyz<br />
grid_locator="QTH Locator" # 4 or 6 length Grid Locatlr shown on https://sdr-list.xyz and for the Distance of FT8 Signals<br />
hostname="your IP, or ddns, or no-ip" # If you use ddns or something to host with a domain enter it here for https://sdr-list.xyzv<br />

[input] # it depends of the receiver you use. The following settings are for RTL<br />
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
The file is located in frontend/src/bands-config.js and build the bands that SySop creates. <br />
- You will see something like this, and you are free to edit as you like:
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
   - **ITU** is the region the server is located, 
   - **min & max** is the brightness of the waterfall for given band, 
   - **initFreq** is the initial frequency of the band when it is selected, 
   - **publishband** declares if the band will be shown or not 1 for amateur band, 2 for broadcasting bands, 
   - **startFreq & endFreq** declare the band limits, 
   - **stepi** is the default wheel step for the band, modes is the prefered default mode for the band.

- After modification **run recompile.sh in the terminal** located in PhantomSDR-Plus folder.


## Backgroud image

The image is located in PhantomSDR-Plus/frontend/src/assets/background.jpg<br />
Change it with the image you prefer, but keep the name.


## The recompile tool.
The script **recompile.sh** is located in the root folder of PhantomSDR-Plus and it needs to run in a terminal window <br />
There are these options: <br />
```
What would you like to recompile?

  [1] Backend only
  [2] Frontend only (with default App.svelte selection)
  [3] Both backend and frontend
  [0] Exit

Select an option [0-3]: 
```
If [2]Frontend only (with default App.svelte selection) is selected then you will receive these options:

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
Pick up your default layout to be initially loaded. The other option will be shown and selected in a popup float window <br /> 
Then a new option menu appears: <br />
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
The script will build all separate /dist folders with their index.html files, and it will include the favico.ico and the Sysop in the title of each webpage.


## The Monitor tool.
This is an optional feature that adds real-time server monitoring to your PhantomSDR application using an automated installation script.<br />
Please refer to **[Readme](docs/sdr-stats/README.md)** - for detailed instructions.


## Final notes.
In case you re-install or upgrade, please make a backup of your older installation in case you will need some files as: <br /> 
- site_information.json (in frontend), 
- markers.json, start and stop scripts & your .toml and maybe chat_history.txt (all located in the root of PhantoSDR-Plus folder)
- bands-config.js (in frontend/src) <br />
and replace the original ones after the installation, so not to edit them again. <br />
Don't forget to recompile after that.


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

### 👥 For End Users:

- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for using the WebSDR
  - Interface overview and navigation
  - Tuning and demodulation modes
  - Advanced features (AGC, NR, NB, etc.)
  - Digital mode decoders (FT8)
  - Keyboard shortcuts and bookmarks
  - Mobile device usage
  - Troubleshooting and FAQ

### 🎯 Quick Links:

- **Live Demo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR Directory**: https://sdr-list.xyz
- **GitHub Issues**: [Report bugs or request features](https://github.com/sv1btl/PhantomSDR-Plus/issues)

---

## -- 73 de SV1BTL & SV2AMK --
