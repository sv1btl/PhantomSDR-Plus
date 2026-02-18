# PhantomSDR-Plus

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/version-1.7.0-cyan.svg)](https://github.com/sv1btl/PhantomSDR-Plus)

**An enhanced open-source WebSDR server with advanced features and futuristic design**

PhantomSDR-Plus is a fork of PhantomSDR that provides a high-performance Software Defined Radio (SDR) web server capable of handling hundreds of simultaneous users. It features an enhanced user interface, multiple decoder support, band plan visualization, and compatibility with various SDR hardware platforms.

---

## 🌟 Key Features

### Performance & Scalability
- **Multi-user support**: Handle hundreds of concurrent users depending on hardware
- **High sample rate**: Support for SDRs up to 70 MSPS (real) / 35 MSPS (IQ)
- **Hardware acceleration**: OpenCL and CUDA support for GPU-accelerated processing
- **Optimized streaming**: Low-latency FLAC and Opus audio compression

### User Interface
- **Futuristic design**: Modern, responsive web interface
- **Mobile-optimized**: Enhanced mobile GUI for on-the-go listening
- **Band plan visualization**: Interactive waterfall with frequency band overlays
- **Customizable colormaps**: Multiple waterfall color schemes
- **Dual S-meter**: Choice between analog or digital signal meter display

### Signal Processing
- **Multiple demodulation modes**: AM, FM, USB, LSB, CW, C-QUAM AM Stereo and more
- **Synchronous AM detection**: Improved AM reception quality
- **Noise reduction**: Advanced NR, NC (Noise Cancel), and NB (Noise Blanker)
- **AGC options**: Multiple Automatic Gain Control modes
- **Auto squelch**: Automatic noise-based squelch threshold

### Advanced Features
- **Digital decoders**: Built-in support for various digital modes
- **Statistics dashboard**: Real-time server and user statistics
- **Bookmark system**: Import/export frequency bookmarks
- **Keyboard shortcuts**: Efficient navigation and control
- **Mouse wheel support**: Intuitive frequency tuning
- **WebSDR directory**: Integration with https://sdr-list.xyz

---

## 📋 Supported Hardware

PhantomSDR-Plus supports a wide range of SDR receivers:

| Device | Sample Rate | Format | Interface |
|--------|-------------|--------|-----------|
| **RX888 MK2** | Up to 64 MHz | 16-bit | Native |
| **RTL-SDR** | Up to 3.2 MHz | 8-bit | rtl_sdr |
| **HackRF One** | Up to 20 MHz | 8-bit | hackrf_transfer |
| **Airspy HF+** | Up to 912 kHz | 16-bit | airspy_rx |
| **Airspy Discovery** | Variable | 16-bit | SoapySDR |
| **SDRplay RSP1A** | Up to 10 MHz | 16-bit | SoapySDR |
| **Other devices** | Variable | Various | SoapySDR/rx_tools |

---

## 🚀 Quick Start

### System Requirements

**Minimum:**
- Ubuntu 22.04 LTS (recommended) or Fedora
- 2-core CPU
- 4 GB RAM
- 10 GB disk space

**Recommended:**
- Ubuntu 22.04 LTS
- 4+ core CPU (Ryzen 5 2600 or Intel i5-6500T or better)
- 8 GB RAM
- GPU with OpenCL support (optional but highly recommended)
- SSD storage

### Installation

```bash
# Clone the repository
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Make scripts executable
chmod +x *.sh

# Run automatic installation
./install.sh
```

**Note:** After running `install.sh`, restart your terminal before proceeding.

For detailed installation instructions, see [INSTALLATION.md](INSTALLATION.md).

---

## 📊 Performance Benchmarks

| Hardware | Sample Rate | CPU Usage | User Capacity |
|----------|-------------|-----------|---------------|
| Ryzen 5 2600 (all cores) | 64 MHz (32 MHz IQ) | 38-40% | 100+ users |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28-35% | 100+ users |
| Intel i5-6500T (with OpenCL) | 60 MHz (30 MHz IQ) | 10-12% | 100+ users |

*Note: Per-user CPU overhead is minimal (<1% per user) when hardware acceleration is enabled.*

---

## 🎯 Usage

### Basic Operation

1. **Configure your SDR**: Edit the appropriate config file (e.g., `config-rtl.toml`)
2. **Update site information**: Edit `frontend/site-information.json`
3. **Start the server**: Run the appropriate start script:
   ```bash
   ./start-rtl.sh      # For RTL-SDR
   ./start-rsp1a.sh    # For SDRplay RSP1A
   ./start-airspyhf.sh # For Airspy HF+
   ./start-rx888mk2.sh # For RX888 MK2
   ```
4. **Access the interface**: Open your browser to `http://localhost:PORT` (default varies by config)

### Stopping the Server

```bash
./stop-websdr.sh
```

---

## 🔧 Configuration

### Essential Configuration Files

1. **`config-[device].toml`** - Server and SDR configuration
   - Server settings (port, threads, HTML root)
   - Input settings (sample rate, FFT size, frequency)
   - WebSDR registration options
   - Audio compression settings
   - After modification restart server.

2. **`frontend/site-information.json`** - Public site information
   - Operator details (callsign, email, location)
   - Hardware and antenna information
   - Region and bandwidth settings
   - Chat enable/disable
   - After modification run compile.sh in the terminal.

3. **`markers.json`** - Frequency markers and band plan

4. **`frontend/src/bands-config.js`** - Public site information
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

For configuration examples, see the included sample files:
- `config-rtl.toml` - RTL-SDR configuration
- `config-rsp1a.toml` - SDRplay RSP1A configuration
- `config-airspyhf.toml` - Airspy HF+ configuration
- `config-rx888mk2.toml` - RX888 MK2 configuration

---

## 🎨 Customization

### Changing the Background Image

Replace `frontend/src/assets/background.jpg` with your preferred image (keep the same filename).

- After modification run compile.sh in the terminal.


### Audio Codec Selection

Choose between FLAC and Opus in your `.toml` configuration:
```toml
[input]
audio_compression="opus"  # or "flac"
```
- After modification restart server.

### GUI Variants

Multiple GUI variants are available in the frontend directory. To switch:
- Run compile.sh in the terminal.

---

## 📚 Documentation

- **[INSTALLATION.md](INSTALLATION.md)** - Complete installation guide for system operators
- **[USER_GUIDE.md](USER_GUIDE.md)** - End-user guide for operating the WebSDR
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Directory structure and code organization
- **[COMPLETE_FIX_SUMMARY.md](COMPLETE_FIX_SUMMARY.md)** - Fixes done for final production

---

## 🌐 Online WebSDR List

Register your WebSDR on the official directory: https://sdr-list.xyz

Set `register_online=true` in your `.toml` configuration file to automatically register.

---

## 🐛 Troubleshooting

### Common Issues

**Ubuntu 24.04 Compatibility**
- Do not use Ubuntu 24.04 - FM demodulation issues exist
- Stick to Ubuntu 22.04 LTS for best results

**OpenCL Not Working**
- Ensure drivers are properly installed
- Check with `clinfo` command
- See INSTALLATION.md for detailed OpenCL setup

**Audio Latency Issues**
- Try switching between FLAC and Opus codecs
- Adjust buffer settings in configuration
- Ensure adequate CPU/GPU resources

**Build Failures**
- Verify all dependencies are installed
- Try cleaning build directory: `rm -rf build && meson setup build`
- Check for conflicting library versions

---

## 🤝 Contributing

Contributions are welcome! This is an independent fork with additional features. Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors & Credits

- **SV1BTL & SV2AMK** - PhantomSDR-Plus development and enhancements
- Based on the original PhantomSDR project

---

## 🔗 Links

- **Live Demo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR Directory**: https://sdr-list.xyz
- **GitHub Repository**: https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Support

- **Issues**: Report bugs via [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **Email**: contact sv1btl@otenet.gr 

---

## ⚡ Performance Tips

1. **Enable OpenCL/CUDA** for GPU acceleration - dramatically reduces CPU usage
2. **Use SSD storage** for better I/O performance
3. **Allocate sufficient RAM** - at least 8 GB recommended
4. **Optimize FFT size** - larger FFT = better resolution but more CPU usage
5. **Consider dedicated GPU** - AMD or NVIDIA with OpenCL support

---

**73 de SV1BTL & SV2AMK**

*For detailed setup instructions, see INSTALLATION.md*
*For end-user operation guide, see USER_GUIDE.md*
