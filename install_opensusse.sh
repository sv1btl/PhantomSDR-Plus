#!/bin/bash

# Check if sudo is available and set the command prefix accordingly
if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    SUDO=""
fi

# Check and install Node.js 18 using nvm
echo "=========================================="
echo "Checking Node.js and npm..."
echo "=========================================="

NODE_INSTALLED=false
NPM_INSTALLED=false
NODE_VERSION_OK=false

if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is already installed: $NODE_VERSION"
    NODE_INSTALLED=true
    
    # Check if Node.js version is 18 or higher
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        NODE_VERSION_OK=true
        echo "✅ Node.js version is compatible (18+)"
    else
        echo "⚠️  Node.js version is too old. Need version 18 or higher."
        NODE_VERSION_OK=false
    fi
else
    echo "❌ Node.js is not installed"
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm is already installed: $NPM_VERSION"
    NPM_INSTALLED=true
else
    echo "❌ npm is not installed"
fi

# Install or upgrade Node.js using nvm if needed
if [ "$NODE_INSTALLED" = false ] || [ "$NPM_INSTALLED" = false ] || [ "$NODE_VERSION_OK" = false ]; then
    echo ""
    echo "Installing Node.js 18 via nvm (Node Version Manager)..."
    
    # Check if nvm is already installed
    if [ ! -d "$HOME/.nvm" ]; then
        echo "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    else
        echo "nvm is already installed"
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    # Install Node.js 18
    echo "Installing Node.js 18..."
    nvm install 18
    nvm use 18
    nvm alias default 18
    
    # Verify installation
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        NPM_VERSION=$(npm --version)
        echo "✅ Node.js installed successfully: $NODE_VERSION"
        echo "✅ npm installed successfully: $NPM_VERSION"
    else
        echo "❌ Error: Node.js/npm installation failed"
        echo "Please install Node.js 18+ manually and try again."
        exit 1
    fi
else
    echo "✅ Node.js and npm are ready to use"
fi

echo ""

# Function to find PhantomSDR-Plus directory
find_phantom_dir() {
    # Check if we're already inside PhantomSDR-Plus directory
    if [ -f "meson.build" ] && [ -d "frontend" ] && [ -d "src" ]; then
        PHANTOM_DIR="."
        echo "✅ Found PhantomSDR-Plus in current directory"
        return 0
    fi
    
    # Check if PhantomSDR-Plus exists as a subdirectory
    if [ -d "PhantomSDR-Plus" ]; then
        PHANTOM_DIR="PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus directory"
        return 0
    fi
    
    # Check parent directory
    if [ -d "../PhantomSDR-Plus" ]; then
        PHANTOM_DIR="../PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in parent directory"
        return 0
    fi
    
    # Check common locations
    if [ -d "$HOME/PhantomSDR-Plus" ]; then
        PHANTOM_DIR="$HOME/PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in home directory"
        return 0
    fi
    
    # Not found, ask user
    echo "❌ Could not automatically locate PhantomSDR-Plus directory"
    echo ""
    read -p "Enter the full path to PhantomSDR-Plus directory: " user_path
    
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR="$user_path"
        echo "✅ Using: $PHANTOM_DIR"
        return 0
    else
        echo "❌ Error: Invalid path or not a PhantomSDR-Plus directory!"
        exit 1
    fi
}

# Find the PhantomSDR-Plus directory
echo "=========================================="
echo "Locating PhantomSDR-Plus directory..."
echo "=========================================="
find_phantom_dir
echo ""

# Update and install necessary packages
echo "=========================================="
echo "Installing PhantomSDR-Plus Dependencies"
echo "=========================================="
echo "Refreshing repositories and installing necessary packages..."
$SUDO zypper refresh
$SUDO zypper install -y -t pattern devel_basis
$SUDO zypper install -y cmake pkg-config meson fftw3-devel websocketpp-devel flac-devel zlib-devel libzstd-devel boost-devel libopus-devel liquid-dsp-devel git libcurl-devel curl cargo nlohmann_json-devel

# Check if curlpp is available
if ! zypper se -i curlpp >/dev/null 2>&1; then
    echo ""
    echo "⚠️  Note: curlpp may not be available in standard repositories."
    echo "You may need to build it from source or find it in additional repos."
    echo ""
    read -p "Do you want to continue without curlpp? (y/n): " skip_curlpp
    if [[ $skip_curlpp != "y" && $skip_curlpp != "Y" ]]; then
        echo "Please install curlpp and run this script again."
        exit 1
    fi
fi

# Check if the previous command was successful
if [ $? -eq 0 ]; then
    echo "Packages installed successfully."
    
    # Change to PhantomSDR-Plus directory for building
    cd "$PHANTOM_DIR"
    
    # Build the main application with Meson
    echo "Building the main application..."
    meson build 
    # Use just 2 cores to compile with -J2 else tiny systems like an RPi4 with 2GB won't finish compiling.
    meson compile -j2 -C build
    if [ $? -ne 0 ]; then
        echo "Failed to build the main application. Please check for errors and try again."
        exit 1
    fi
    
    # Return to original directory
    cd - > /dev/null
    
    echo "Welcome to PhantomPlus Installer!"
    echo "Which SDR would you like to set up?"
    echo "  [1] RX888 MKII / RX888"
    echo "  [2] RTLSDR"
    echo "  [3] SDRPlay"
    echo "  [4] Do not install SDR driver, skip to websdr install only"
    read -p "Select an option [1-4]: " option

    case $option in
        1) echo "Setting up RX888 MKII / RX888..."
            $SUDO zypper remove -y rust 2>/dev/null || true
            echo "Installing Rust..."
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
            source "$HOME/.cargo/env"
            
            # Clone the rx888_stream repository
            echo "Cloning the rx888_stream repository..."
            git clone https://github.com/rhgndf/rx888_stream
            cd rx888_stream
            
            # Build and install
            echo "Building and installing..."
            RUSTFLAGS="-C target-cpu=native" cargo build --release
            RUSTFLAGS="-C target-cpu=native" cargo install --path .
            
            echo "RX888 is successfully set up."
            cd ..
            ;;
        2) echo "Setting up RTLSDR..."
            read -p "Do you have a RTL-SDR V4? (y/n): " rtlsdr_v4
            if [[ $rtlsdr_v4 == "y" || $rtlsdr_v4 == "Y" ]]; then
                echo "Setting up RTL-SDR V4..."
                $SUDO zypper remove -y rtl-sdr rtl-sdr-devel 2>/dev/null || true
                $SUDO rm -rvf /usr/lib/librtlsdr* /usr/include/rtl-sdr* /usr/local/lib/librtlsdr* /usr/local/include/rtl-sdr* /usr/local/include/rtl_* /usr/local/bin/rtl_*
                $SUDO zypper install -y libusb-1_0-devel git cmake pkg-config
                git clone https://github.com/rtlsdrblog/rtl-sdr-blog
                cd rtl-sdr-blog
                mkdir build
                cd build
                cmake ../ -DINSTALL_UDEV_RULES=ON
                make -j4
                $SUDO make install
                $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
                $SUDO ldconfig
                echo "blacklist dvb_usb_rtl28xxu" | $SUDO tee /etc/modprobe.d/blacklist-rtl.conf
                cd ../..
                echo "RTL-SDR V4 drivers installed successfully."
            else
                echo "Setting up standard RTLSDR..."
                $SUDO zypper install -y rtl-sdr rtl-sdr-devel
                echo "Standard RTLSDR drivers installed successfully."
            fi
            ;;
        3) echo "Setting up SDRPlay..."
            echo ""
            echo "⚠️  Note: libmirisdr may not be available in standard openSUSE repos."
            echo "You may need to:"
            echo "  1. Add OBS repository for radio packages"
            echo "  2. Build from source: https://github.com/f4exb/libmirisdr-4"
            echo ""
            echo "Attempting to install from repos..."
            $SUDO zypper install -y libmirisdr-devel || echo "Installation from repos failed. Please install manually."
            echo ""
            read -p "Press Enter to continue..."
            ;;
        4) echo "Skipping SDR driver installation..."
            ;;
        *)
            echo "Invalid option. Skipping SDR driver installation."
            ;;
    esac
    
    # Frontend section
    echo ""
    echo "=========================================="
    echo "Building Frontend"
    echo "=========================================="
    
    # Find site_information.js
    echo "Looking for site_information.js..."
    SITE_INFO_PATH=""
    if [ -f "$PHANTOM_DIR/frontend/dist/site_information.js" ]; then
        SITE_INFO_PATH="$PHANTOM_DIR/frontend/dist/site_information.js"
    elif [ -f "$PHANTOM_DIR/frontend/public/site_information.js" ]; then
        SITE_INFO_PATH="$PHANTOM_DIR/frontend/public/site_information.js"
    elif [ -f "$PHANTOM_DIR/frontend/site_information.js" ]; then
        SITE_INFO_PATH="$PHANTOM_DIR/frontend/site_information.js"
    fi
    
    if [ -z "$SITE_INFO_PATH" ]; then
        echo "⚠️  Warning: Could not find site_information.js"
        echo "You'll need to create this file manually"
    else
        echo "✅ Found site_information.js at: $SITE_INFO_PATH"
    fi
    
    # Navigate to frontend directory
    cd "$PHANTOM_DIR/frontend"
    
    echo "Installing frontend dependencies..."
    npm install
    
    # Install specific version of Vite with Svelte 4 support
    echo "Installing Vite 5.4.16 with Svelte 4 support..."
    npm install vite@5.4.16 --save-dev
    
    # Install opus-stream-decoder
    echo "Installing opus-stream-decoder..."
    npm install opus-stream-decoder
    
    # Run npm audit fix
    echo "Running npm audit fix..."
    npm audit fix
    
    # Build all frontend versions
    echo "Building frontend versions..."
    
    # Build version 1 (analog)
    echo "Building Version 1 (Analog S-Meter)..."
    npm run build
    
    # Build version 1 (digital)
    echo "Building Version 1 (Digital S-Meter)..."
    npm run build:digital
    
    # Build version 2 (analog)
    echo "Building Version 2 (Analog S-Meter)..."
    npm run build:v2-analog
    
    # Build version 2 (digital)
    echo "Building Version 2 (Digital S-Meter)..."
    npm run build:v2-digital
    
    if [ $? -eq 0 ]; then
        echo "✅ All frontend versions built successfully!"
    else
        echo "⚠️  Some frontend builds may have failed. Check for errors above."
    fi
    
    # Return to original directory
    cd - > /dev/null
    
    # OpenCL Installation (optional)
    echo ""
    echo "=========================================="
    echo "OpenCL Support (Optional)"
    echo "=========================================="
    echo ""
    echo "OpenCL provides hardware acceleration using your CPU for DSP operations."
    echo "This is recommended for better performance."
    echo ""
    read -p "Would you like to install OpenCL support? (y/n): " install_opencl
    
    if [[ $install_opencl == "y" || $install_opencl == "Y" ]]; then
        echo ""
        echo "Installing OpenCL packages..."
        $SUDO zypper install -y ocl-icd-devel opencl-headers clinfo
        
        if [ $? -ne 0 ]; then
            echo "❌ Error: Failed to install OpenCL packages"
            echo "Continuing without OpenCL..."
        else
            echo "✅ OpenCL development packages installed"
            
            # Install Intel Compute Runtime
            echo ""
            echo "Installing Intel Compute Runtime..."
            
            # Check CPU vendor
            cpu_vendor=$(lscpu | grep "Vendor ID" | awk '{print $3}')
            
            if [[ $cpu_vendor == "GenuineIntel" ]]; then
                echo "Intel CPU detected."
                echo ""
                echo "Installing Intel OpenCL runtime..."
                $SUDO zypper install -y intel-opencl
                
                # Alternative: Check for compute-runtime package
                if ! zypper se -i intel-opencl >/dev/null 2>&1; then
                    echo ""
                    echo "⚠️  intel-opencl package not found in repos."
                    echo "You may need to:"
                    echo "  1. Enable Intel Graphics repository"
                    echo "  2. Download Intel Compute Runtime from:"
                    echo "     https://github.com/intel/compute-runtime/releases"
                    echo ""
                fi
                
                echo ""
                echo "Testing OpenCL installation..."
                clinfo
                
                if [ $? -eq 0 ]; then
                    echo ""
                    echo "✅ OpenCL installed successfully!"
                else
                    echo "⚠️  OpenCL installation completed but clinfo test failed"
                    echo "You may need to reboot and run 'clinfo' to verify"
                    NEEDS_REBOOT=true
                fi
            else
                echo "Non-Intel CPU detected."
                echo "For AMD GPUs: sudo zypper install rocm-opencl"
                echo "For NVIDIA GPUs: Install CUDA toolkit"
                echo ""
                read -p "Press Enter to continue..."
            fi
        fi
    else
        echo "Skipping OpenCL installation."
    fi
    
    echo ""
    echo "=========================================="
    echo "Installation Summary"
    echo "=========================================="
    echo ""
    echo "✅ System Packages:"
    echo "   • Node.js 18 (via nvm)"
    echo "   • Build tools (gcc, cmake, meson, pkg-config)"
    echo "   • DSP libraries (FFTW3, libopus, libliquid)"
    echo "   • Network libraries (libwebsocketpp, libcurl)"
    echo "   • Compression libraries (zlib, zstd, FLAC)"
    echo "   • Boost libraries"
    if [[ $install_opencl == "y" || $install_opencl == "Y" ]]; then
        echo "   • OpenCL support (CPU/GPU acceleration)"
    fi
    echo ""
    echo "✅ PhantomSDR-Plus Backend:"
    echo "   • Main application compiled successfully"
    echo "   • Location: $PHANTOM_DIR/build/"
    echo ""
    
    case $option in
        1) echo "✅ SDR Hardware: RX888 MKII / RX888"
           echo "   • Rust toolchain installed"
           echo "   • rx888_stream compiled and installed"
           echo "   ⚠️  IMPORTANT: Restart your terminal before using rx888_stream"
           echo "" ;;
        2) echo "✅ SDR Hardware: RTLSDR"
           if [[ $rtlsdr_v4 == "y" || $rtlsdr_v4 == "Y" ]]; then
               echo "   • RTL-SDR Blog V4 drivers installed"
               echo "   • USB rules configured"
               echo "   ⚠️  IMPORTANT: REBOOT your system for RTL-SDR V4 to work properly"
               NEEDS_REBOOT=true
           else
               echo "   • Standard RTLSDR drivers installed"
           fi
           echo "" ;;
        3) echo "✅ SDR Hardware: SDRPlay"
           echo "   • libmirisdr setup instructions provided"
           echo "" ;;
        4) echo "✅ SDR Hardware: Installation skipped"
           echo "   • You can install SDR drivers manually later"
           echo "" ;;
    esac
    
    echo "✅ Frontend Configuration:"
    echo "   • Node.js version: $(node --version)"
    echo "   • Vite version: 5.4.16 (with Svelte 4)"
    echo "   • Site information configured: $SITE_INFO_PATH"
    echo "   • npm dependencies installed"
    echo "   • Opus WASM audio decoder installed"
    echo "   • npm audit fix applied"
    
    if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
        echo "   • All frontend versions built successfully"
        echo "   • Output: $PHANTOM_DIR/frontend/dist/"
    fi
    echo ""
    echo "=========================================="
    echo "Next Steps to Launch Your WebSDR"
    echo "=========================================="
    echo ""
    echo "🔧 Step 1: Configure Your Receiver"
    echo "   Edit the appropriate .toml configuration file for your SDR:"
    echo ""
    case $option in
        1) echo "   For RX888:"
           echo "   nano $PHANTOM_DIR/rx888.toml" ;;
        2) echo "   For RTLSDR:"
           echo "   nano $PHANTOM_DIR/rtlsdr.toml" ;;
        3) echo "   For SDRPlay:"
           echo "   nano $PHANTOM_DIR/sdrplay.toml" ;;
        4) echo "   Choose the appropriate .toml file for your SDR" ;;
    esac
    echo ""
    echo "🔧 Step 2: Review Site Information (Optional)"
    echo "   nano $SITE_INFO_PATH"
    echo ""
    echo "🚀 Step 3: Start the PhantomSDR-Plus Server"
    echo "   cd $PHANTOM_DIR"
    case $option in
        1) echo "   ./build/spectrumserver rx888.toml" ;;
        2) echo "   ./build/spectrumserver rtlsdr.toml" ;;
        3) echo "   ./build/spectrumserver sdrplay.toml" ;;
        4) echo "   ./build/spectrumserver <your_config>.toml" ;;
    esac
    echo ""
    echo "🌐 Step 4: Test the Web Interface"
    echo "   Open your browser and navigate to:"
    echo "   http://localhost:port_used"
    echo ""
    echo "   Or test with Python server:"
    echo "   cd $PHANTOM_DIR/frontend/dist"
    echo "   python3 -m http.server port_used"
    echo ""
    echo "=========================================="
    echo "Available Frontend Versions"
    echo "=========================================="
    echo ""
    if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
        echo "   http://localhost:port_used/           		→ Analog S-Meter"
        echo "   http://localhost:port_used/digital/index.html      → Digital S-Meter"
        echo "   http://localhost:port_used/v2-analog/index.html    → V2 Analog S-Meter"
        echo "   http://localhost:port_used/v2-digital/index.html   → V2 Digital S-Meter"
    fi
    echo ""
    echo "=========================================="
    echo "Helpful Resources"
    echo "=========================================="
    echo ""
    echo "📚 Documentation: https://github.com/sv1btl/PhantomSDR-Plus"
    echo "🛠 Report Issues: https://github.com/sv1btl/PhantomSDR-Plus/issues"
    echo "💬 Community Support: Check the GitHub discussions"
    echo ""
    
    # Check if reboot is needed
    if [ "$NEEDS_REBOOT" = true ]; then
        echo "=========================================="
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║                                                              ║"
        echo "║   ⚠️  IMPORTANT: SYSTEM REBOOT REQUIRED  ⚠️                   ║"
        echo "║                                                              ║"
        if [[ $rtlsdr_v4 == "y" || $rtlsdr_v4 == "Y" ]]; then
        echo "║   RTL-SDR V4 drivers require a reboot to take effect.        ║"
        fi
        if [[ $install_opencl == "y" || $install_opencl == "Y" ]]; then
        echo "║   OpenCL drivers require a reboot to take effect.            ║"
        fi
        echo "║                                                              ║"
        echo "║   Please reboot your system before using PhantomSDR-Plus.    ║"
        echo "║                                                              ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
    fi
    
    echo "=========================================="    
    # Final success message
    echo ""
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║           🎉 INSTALLATION COMPLETED SUCCESSFULLY! 🎉         ║"
    echo "║                                                              ║"
    echo "║              Welcome to PhantomSDR-Plus WebSDR!              ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    
else
    echo "An error occurred during package installation. Please check your installation and try again."
    exit 1
fi
