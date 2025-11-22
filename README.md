# PhantomSDR-Plus WebSDR (version 1.6.0)
## Note: Please dont use Ubuntu 24.04, stick to Ubuntu 22.04 as it wont compile on 24.04!
This is different Repo than the Official PhantomSDR Repo

We offer more features as we only maintain support for Linux instead of the official repo
- Futuristic Design,
- Decoders,
- Band Plan in the Waterfall,
- Statistics,
- Better Custom Colorsmap,
- Optimized Flac encoder with balanced latency,
- Analog or digital smeter by choice (files for copy-paste are included, must recompile for newer use),
- New approach in functions as reduced Latency, Noise Reduction, AGC selection, Auto SQL, Buffer adjustments, Auto Adjust waterfall, Mouse wheel use, Keyboard shortcuts, Bookmarks download and upload, Zoom slider, enhanced Mobile GUI,
- WebSDR List (https://sdr-list.xyz),
- Supported receivers RX-888, RTL V.4, Airspy Discovery, HackRF, SDRPLAY RSP1A (original and clone) and many more to be added,
- More to come!...

## Issues
- If you face issues try to run it on Ubuntu, as most was tested on Ubuntu.

## Features
- WebSDR which can handle multiple hundreds of users depending on the Hardware.
- Common demodulation modes.
- Can handle high sample rate SDRs (70MSPS real, 35MSPS IQ).
- Support for both IQ and real data.

## Benchmarks
- Ryzen 5* 2600 - All Cores - RX888 MKii with 64MHZ Sample Rate, 32MHZ IQ takes up 38-40% - per User it takes about nothing, 50 Users dont even take 1% of the CPU.
- RX 580 - RX888 MKII with 64MHZ Sample Rate, 32MHZ IQ takes up 28-35% - same as the Ryzen per User it takes about nothing (should handle many).
- Intel i5-6500T - RX888 MKII - 60MHz Sample Rate, 30MHz IQ, OpenCL installed and enabled, about 10-12%. 100 users is no problem with OpenCL as the GPU does the heavy lifting.
  
(* Ryzen CPU's with internal GPU do not support OpenCL, if you expect high performance add a videocard or use an modern Intel i5 or i7 that supports OpenCL.)

## Screenshots

The SV1BTL WebSDR: http://phantomsdr.no-ip.org:8900/

![Screenshot](/docs/websdr.png)

(https://sdr-list.xyz)

## Building
Optional dependencies such as cuFFT or clFFT can be installed too.

### Ubuntu Prerequisites
```
apt install build-essential cmake pkg-config meson libfftw3-dev libwebsocketpp-dev libflac++-dev zlib1g-dev libzstd-dev libboost-all-dev libopus-dev libliquid-dev git psmisc
```

### Fedora Prerequisites
```
dnf install g++ meson cmake fftw3-devel websocketpp-devel flac-devel zlib-devel boost-devel libzstd-devel opus-devel liquid-dsp-devel git
```

## Building the binary automatically
Restart your Terminal after you ran install.sh otherwise it wont work..
```
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

## Building the binary manually
```
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
meson build --optimization 3
meson compile -C build
```

## Installing nodejs and npm using nvm
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
(Let’s install two more versions, the latest LTS version, and version 18.10.0. This is an optional step, usually the installed version works just fine )
```
nvm install --lts
nvm install 18.10.0
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
Remember to set the frequency and sample rate correctly, in the .sh files, e.g. start-rtl.sh<br />
You have also to modify the  .toml file, e.g. config-rtl.toml

### RTL-SDR
```
rtl_sdr -f 145000000 -s 3200000 - | ./build/spectrumserver --config config.toml
```
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
I also added psutils as it's needed for killall command.<br />
Do not forget to disable opencl if you didn't install it, it's recommened you do.

## After finished install, enter the frontend directory and edit the site-information.json file with your favorite editor.

	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "Your Information",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open source WebSDR project, which is dynamicaly devepoping.",
	"siteIP": "Your site IP:port",
	"siteSDRBaseFrequency": 0,
	"siteSDRBandwidth": 30000000,
	"siteRegion": 1,
	"siteChatEnabled": true

"siteSDRBandwidth": you must type the usefull band with of your receiver, e.g. for RTL is 2048000, for RX-888 is 60000000 or 1200000000 etc.

"siteRegion": , you have to select IARU region, where:<br />
1 is for Africa, Europe, the Middle East, and northern Asia,<br />
2 is for the Americas, including North, Central, and South America, as well as the Caribbean and<br />
3 is for Oceania, East Asia, Southeast Asia, and the Pacific Islands.

"siteChatEnabled": true defines if the chat window will be activated.


## .toml file

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

## Backgroud image

The image is located in PhantomSDR-Plus/frontend/src/assets/background.jpg<br />
Change it with the image you prefer, but keep the name


## Every change in files inside PhantomSDR-Plus/frontend, needs recompile with npm.
```
cd PhantomSDR-Plus
cd frontend
npm install
npm audit fix
npm run build
```

## Every change in files inside PhantomSDR-Plus/src, needs recompile with ninja.
```
cd PhantomSDR-Plus
meson setup build --wipe
meson setup build --backend=ninja
meson compile -C build
```

## Final notes.
In case you re-install or upgrade, please make a backup of your older modified by you files as:<br /> 
site_information.json, waterfall.js (in frontend and frontend/src), markers.json, start and stop scripts and your .toml and maybe chat_history.txt (all located in root of PhantoSDR-Plus folder) and replace the original ones after the installation, so not to edit them again. <br />
Don't forget to recompile after that.


## Start and Stop server.
In case of RTL, type in (command prompt) and start with ./start-rtl.sh or stop with  ./stop-websdr.sh

## -- 73 de SV1BTL & SV2AMK --

