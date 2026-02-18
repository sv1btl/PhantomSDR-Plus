# PhantomSDR-Plus Installation Guide for System Operators

This comprehensive guide will walk you through installing and configuring PhantomSDR-Plus on your server.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Preparation](#pre-installation-preparation)
3. [Installing Dependencies](#installing-dependencies)
4. [Installing Node.js and npm](#installing-nodejs-and-npm)
5. [Installing OpenCL (Optional but Recommended)](#installing-opencl-optional-but-recommended)
6. [Installing PhantomSDR-Plus](#installing-phantomsdr-plus)
7. [Installing Opus Audio Codec](#installing-opus-audio-codec)
8. [Configuration](#configuration)
9. [SDR Device-Specific Setup](#sdr-device-specific-setup)
10. [C-QUAM AM Stereo Features](#C-QUAM AM Stereo Features)
11. [Testing and Verification](#testing-and-verification)
12. [Setting Up Autostart](#setting-up-autostart)
13. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Supported Operating Systems

**Primary (Recommended):**
- Ubuntu 22.04 LTS (x86_64) (recommended)

**Alternative:**
- Fedora (latest stable release)

**⚠️ NOT RECOMMENDED:**
- Ubuntu 24.04 (FM demodulation issues - DO NOT USE)

### Hardware Requirements

**Minimum Configuration:**
- CPU: Dual-core processor (2+ GHz)
- RAM: 4 GB
- Storage: 10 GB free space
- Network: 100 Mbps connection

**Recommended Configuration:**
- CPU: Quad-core or better (Ryzen 5 2600, Intel i5-6500T or better)
- RAM: 8 GB or more
- Storage: 20 GB+ SSD
- GPU: AMD/NVIDIA with OpenCL support (highly recommended)
- Network: 1 Gbps connection

**High-Performance Configuration:**
- CPU: 6+ cores (Ryzen 7, Intel i7 or better)
- RAM: 16 GB or more
- Storage: NVMe SSD
- GPU: Dedicated GPU with OpenCL/CUDA support
- Network: 1 Gbps or better

---

## Pre-Installation Preparation

### 1. Update Your System

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Verify Ubuntu Version

```bash
lsb_release -a
```

**Expected output should show:** Ubuntu 22.04 LTS

### 3. Check Available Disk Space

```bash
df -h
```

Ensure you have at least 10 GB free in your home directory.

### 4. Check CPU Information

```bash
lscpu
```

Note the number of cores/threads for configuration optimization.

---

## Installing Dependencies

### Ubuntu 22.04 LTS

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  git \
  psmisc \
  wget \
  curl
```

### Fedora

```bash
sudo dnf install -y \
  g++ \
  meson \
  cmake \
  fftw3-devel \
  websocketpp-devel \
  flac-devel \
  zlib-devel \
  boost-devel \
  libzstd-devel \
  opus-devel \
  liquid-dsp-devel \
  git \
  psmisc \
  wget \
  curl
```

### Verify Installation

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Installing Node.js and npm

PhantomSDR-Plus requires Node.js for building the frontend. We'll use NVM (Node Version Manager) for installation.

### 1. Install NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

### 2. Load NVM

**IMPORTANT:** Close and reopen your terminal, or run:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Verify NVM Installation

```bash
nvm --version
```

Expected output: `0.39.7` or similar

### 4. Install Node.js

```bash
# Install the latest LTS version
nvm install --lts

# Verify installation
node --version
npm --version
```

### 5. Optional: Install Additional Node Versions

```bash
# Install latest version
nvm install node

# Install specific version (if needed)
nvm install 18.10.0

# List installed versions
nvm list

# Use specific version
nvm use --lts
```

---

## Installing OpenCL (Optional but Recommended)

OpenCL dramatically improves performance by offloading FFT calculations to the GPU. This section covers Intel integrated graphics. For AMD/NVIDIA GPUs, refer to manufacturer documentation.

### Intel CPU with Integrated Graphics

#### 1. Install Base OpenCL Components

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  libclfft-dev \
  ocl-icd-opencl-dev \
  clinfo
```

#### 2. Download Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Install Intel OpenCL Runtime

```bash
sudo dpkg -i *.deb
```

If dependency errors occur:

```bash
sudo apt --fix-broken install
```

#### 4. Install OpenCL ICD Loader

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

If errors occur:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Verify OpenCL Installation

```bash
sudo clinfo
```

You should see information about your OpenCL platform and devices. Look for:
- Number of platforms: 1 (or more)
- Platform name: Intel(R) OpenCL (or similar)
- Device type: GPU or CPU

#### 6. Reboot

```bash
sudo reboot
```

### AMD GPU OpenCL

For AMD GPUs, install ROCm:

```bash
# Add ROCm repository
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian/ ubuntu main' | sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install rocm-opencl rocm-clinfo

# Add user to video group
sudo usermod -a -G video $USER

# Reboot
sudo reboot

# Verify
clinfo
```

### NVIDIA GPU OpenCL

For NVIDIA GPUs, install CUDA:

```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-525

# Install CUDA toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install cuda

# Reboot
sudo reboot

# Verify
nvidia-smi
clinfo
```

---

## Installing PhantomSDR-Plus

### Clone the Repository, Make Scripts Executable, Automatic Installation

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```
**⚠️ IMPORTANT:** After `install.sh` completes, **restart your terminal** before continuing.

### 4. Option B: Manual Installation

If you prefer manual installation or if automatic installation fails:

#### Build the Backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Build the Frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Verify Installation

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Installing Opus Audio Codec

Opus provides better audio quality and lower latency compared to FLAC.

### 1. Install libopus System Library

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Install Opus Decoder for Frontend

```bash
cd PhantomSDR-Plus/frontend

# Install npm dependencies if not already done, Install Opus WASM decoder, Fix any vulnerabilities, Rebuild frontend
npm install
npm install @wasm-audio-decoders/opus-ml
npm audit fix
npm run build

# Return to project root
cd ..
```

### 3. Verify Opus Installation

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Configuration

### 1. Choose Your Configuration File

Select the appropriate config file for your SDR:

- `config-rtl.toml` - RTL-SDR dongles
- `config-rsp1a.toml` - SDRplay RSP1A
- `config-airspyhf.toml` - Airspy HF+ Discovery
- `config-rx888mk2.toml` - RX888 MK2
- `config.example.hackrf.toml` - HackRF One

For this example, we'll use RTL-SDR.

### 2. Edit Configuration File

```bash
nano config-rtl.toml
```

#### Key Settings to Configure

```toml
[server]
port = 9002                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
```

#### Sample Rate Guidelines

| Coverage | Sample Rate | FFT Size |
|----------|-------------|----------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 8388608 |

### 3. Configure Site Information

```bash
nano frontend/site-information.json
```

Edit the following fields:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v1.6.1",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**IARU Regions:**
- **1**: Europe, Africa, Middle East, Northern Asia
- **2**: Americas (North, Central, South), Caribbean
- **3**: Asia-Pacific, Oceania

### 4. Customize Frequency Markers (Optional)

```bash
nano markers.json
```

Add your favorite frequencies, repeaters, and broadcast stations.

### 5. Edit Start Script

```bash
nano start-rtl.sh
```

Verify the command matches your configuration:

```bash
#!/bin/bash
rtl_sdr -f 145000000 -s 2048000 - | ./build/spectrumserver --config config-rtl.toml
```

Parameters:
- `-f 145000000`: Center frequency (145 MHz)
- `-s 2048000`: Sample rate (2.048 MSPS)
- `--config config-rtl.toml`: Configuration file

---

## SDR Device-Specific Setup

### RTL-SDR

#### Install RTL-SDR Tools

```bash
sudo apt install -y rtl-sdr
```

#### Test RTL-SDR

```bash
rtl_test
```

Press Ctrl+C to stop. You should see sample rate information.

#### Edit Configuration

```bash
nano config-rtl.toml
```

Common settings for RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### SDRplay RSP1A

#### Install SoapySDR and SDRplay Support

```bash
# Install SoapySDR
sudo apt install -y soapysdr-tools

# Download SDRplay API
cd ~/Downloads
wget https://www.sdrplay.com/software/SDRplay_RSP_API-Linux-3.07.1.run
chmod +x SDRplay_RSP_API-Linux-3.07.1.run
sudo ./SDRplay_RSP_API-Linux-3.07.1.run

# Install SoapySDRPlay
git clone https://github.com/pothosware/SoapySDRPlay.git
cd SoapySDRPlay
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig
```

#### Test SDRplay

```bash
SoapySDRUtil --find="driver=sdrplay"
```

#### Additional Instructions

See the included file: `instractions-for-rsp1a`

### Airspy HF+

#### Install Airspy Tools

```bash
sudo apt install -y airspy
```

#### Test Airspy

```bash
airspy_info
```

#### Additional Instructions

See the included file: `instractions-for-airspy`

### RX888 MK2

#### Install RX888 Tools

```bash
# Install rx_tools
git clone https://github.com/rxseger/rx_tools.git
cd rx_tools
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig

# Install RX888 firmware and support
# Follow manufacturer instructions
```

#### Edit Configuration

```bash
nano config-rx888mk2.toml
```

Common settings for RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 8388608
```

### HackRF One

#### Install HackRF Tools

```bash
sudo apt install -y hackrf
```

#### Test HackRF

```bash
hackrf_info
```

---

## C-QUAM AM Stereo Features

### What is C-QUAM?

C-QUAM (Compatible Quadrature Amplitude Modulation) is a system for transmitting stereo audio on AM broadcast bands. It's backwards-compatible with mono AM receivers.

### How It Works

**Server Side:**
1. SAM PLL locks onto AM carrier
2. Demodulates In-phase (I) and Quadrature (Q) components
3. In C-QUAM: I ≈ (L+R), Q ≈ (L-R)
4. Separate DC blockers for L and R channels
5. Encoder creates stereo Opus or FLAC stream

**Client Side:**
1. Receives stereo audio stream (2 channels)
2. OpusMLDecoder decodes stereo
3. Interleaved L/R audio [L,R,L,R,...]
4. AudioBuffer de-interleaves to separate channels
5. Stereo playback through Web Audio API

### Compressor, AGC and Limiter in AM Stereo
Compressor, AGC and Limiter are dissabled by default, because they can cause distortion. <br />
If you want to enable them, then uncomment them in src/signal.cpp file and recompile.

### Enabling AM Stereo

**From Client:**
```javascript
// Via WebSocket command (if your UI supports it)
{
  "cmd": "am_stereo",
  "enable": true
}
```

**From Server Code:**
```cpp
audioClient->set_am_stereo(true);
```

### How to Test

1. Tune to a C-QUAM AM stereo broadcast
2. Enable AM stereo mode
3. You should hear stereo separation!
4. Check browser console for channel count:
   ```
   OpusMLDecoder ready, channels= 2, target= 12000 Hz
   ```

---


## Testing and Verification

### 1. Test Run

```bash
# For RTL-SDR
./start-rtl.sh
```

### 2. Check for Errors

Watch the output for:
- ✅ Server started successfully
- ✅ WebSocket server listening
- ✅ FFT threads started
- ❌ Any error messages

### 3. Access Web Interface

Open your browser to:
```
http://localhost:9002
```

(Replace port number with your configured port)

### 4. Verify Functionality

- Waterfall should be displaying
- Audio should play when clicking on signals
- S-meter should respond to signals
- User count should show "1"

### 5. Test from Another Device

From another computer on your network:
```
http://YOUR_SERVER_IP:9002
```

### 6. Check Resource Usage

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Stop the Server

Press Ctrl+C or run:
```bash
./stop-websdr.sh
```

---

## Setting Up Autostart

### Using systemd (Recommended)

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Add the following content (adjust paths and user):

```ini
[Unit]
Description=PhantomSDR-Plus WebSDR Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/PhantomSDR-Plus
ExecStart=/home/youruser/PhantomSDR-Plus/start-rtl.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phantomsdr.service

# Start service now
sudo systemctl start phantomsdr.service

# Check status
sudo systemctl status phantomsdr.service
```

#### 3. Manage Service

```bash
# Start
sudo systemctl start phantomsdr

# Stop
sudo systemctl stop phantomsdr

# Restart
sudo systemctl restart phantomsdr

# View logs
sudo journalctl -u phantomsdr -f
```

### Using Screen (Alternative)

#### 1. Install Screen

```bash
sudo apt install -y screen
```

#### 2. Start in Screen Session

```bash
screen -S phantomsdr
./start-rtl.sh
```

Press Ctrl+A, then D to detach.

#### 3. Reattach to Session

```bash
screen -r phantomsdr
```

---

## Troubleshooting

### Build Errors

#### Dependency Issues

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Meson Configuration Fails

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

### Runtime Errors

#### Port Already in Use

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Permission Denied for SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

#### Audio Issues

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### OpenCL Issues

#### clinfo Shows No Devices

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Performance Not Improved

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Network Issues

#### Can't Access from Other Devices

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### High Latency

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### SDR Device Issues

#### RTL-SDR Not Found

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay Not Found

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find
```

---

## Performance Optimization

### CPU Optimization

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Memory Optimization

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Network Optimization

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Updating PhantomSDR-Plus

### Manual Update

```bash
cd PhantomSDR-Plus

# Backup your configuration
cp config-rtl.toml config-rtl.toml.backup
cp frontend/site-information.json frontend/site-information.json.backup

# Pull latest changes
git pull origin main
git submodule update --init --recursive

# Rebuild
meson compile -C build
cd frontend && npm install && npm run build && cd ..
```

### Automatic Update Script

Create `update.sh`:

```bash
#!/bin/bash
cd ~/PhantomSDR-Plus
./stop-websdr.sh
git pull origin main
git submodule update --init --recursive
meson compile -C build
cd frontend && npm install && npm run build && cd ..
./start-rtl.sh
```

---

## Backup and Restore

### Files to Backup

- Configuration files: `*.toml`
- Site information: `frontend/site-information.json`
- Markers: `markers.json`
- Custom scripts: `start-*.sh`, `stop-*.sh`
- Chat history: `chat_history.txt`
- Background image: `frontend/src/assets/background.jpg`

### Backup Command

```bash
cd ~/PhantomSDR-Plus
tar -czf phantomsdr-backup-$(date +%Y%m%d).tar.gz \
  *.toml \
  *.sh \
  markers.json \
  chat_history.txt \
  frontend/site-information.json \
  frontend/src/assets/background.jpg
```

### Restore Command

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Security Considerations

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Reverse Proxy (Optional)

Consider using nginx or Apache as a reverse proxy for:
- SSL/TLS encryption
- Domain name mapping
- Load balancing
- Access control

### User Limits

Edit `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Getting Help

### Resources

- **Documentation**: This guide, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Live Demo**: http://phantomsdr.no-ip.org:8900/

### Reporting Issues

When reporting issues, include:
1. Operating system and version
2. SDR device model
3. Configuration file contents
4. Error messages
5. System resource usage (CPU, RAM, GPU)

### Community Support

- Check existing GitHub issues before creating new ones
- Provide detailed information about your setup
- Include logs and error messages
- Be patient and respectful

---

## Appendix A: Complete Dependency List

### Ubuntu 22.04 Package List

```
build-essential
cmake
pkg-config
meson
libfftw3-dev
libwebsocketpp-dev
libflac++-dev
zlib1g-dev
libzstd-dev
libboost-all-dev
libopus-dev
libliquid-dev
git
psmisc
wget
curl
rtl-sdr (for RTL-SDR)
airspy (for Airspy)
hackrf (for HackRF)
libclfft-dev (for OpenCL)
ocl-icd-opencl-dev (for OpenCL)
clinfo (for OpenCL)
```

---

## Appendix B: Configuration Examples

### Example 1: RTL-SDR for VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Example 2: RX888 for HF (0-30 MHz)

```toml
[input]
sps = 60000000
frequency = 0
signal = "real"
fft_size = 8388608

[input.driver]
format = "s16"

[input.defaults]
frequency = 7100000
modulation = "LSB"
```

### Example 3: HackRF for Wideband FM

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**Installation complete! You should now have a fully functional PhantomSDR-Plus server.**

**73 de SV1BTL & SV2AMK**
