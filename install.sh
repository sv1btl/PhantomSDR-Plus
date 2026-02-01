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
echo "Updating package lists and installing necessary packages..."
$SUDO apt-get update
$SUDO apt-get install -y build-essential cmake pkg-config meson libfftw3-dev libwebsocketpp-dev libflac++-dev zlib1g-dev libzstd-dev libboost-all-dev libopus-dev libliquid-dev git libcurlpp-dev curl cargo nlohmann-json3-dev

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
            $SUDO apt-get autoremove -y rustc
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
                $SUDO apt purge ^librtlsdr -y
                $SUDO rm -rvf /usr/lib/librtlsdr* /usr/include/rtl-sdr* /usr/local/lib/librtlsdr* /usr/local/include/rtl-sdr* /usr/local/include/rtl_* /usr/local/bin/rtl_*
                $SUDO apt-get install libusb-1.0-0-dev git cmake pkg-config -y
                git clone https://github.com/rtlsdrblog/rtl-sdr-blog
                cd rtl-sdr-blog
                mkdir build
                cd build
                cmake ../ -DINSTALL_UDEV_RULES=ON
                make
                $SUDO make install
                $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
                $SUDO ldconfig
                echo 'blacklist dvb_usb_rtl28xxu' | $SUDO tee --append /etc/modprobe.d/blacklist-dvb_usb_rtl28xxu.conf
                cd ../..
                echo "Please note: You'll need to reboot after the full installation is complete for RTL-SDR V4 changes to take effect."
            else
                echo "Setting up a non V4 RTLSDR..."
                $SUDO apt-get install libusb-1.0-0-dev git cmake pkg-config librtlsdr0 librtlsdr-dev rtlsdr -y
                echo "RTLSDR setup is complete."
            fi
            ;;
        3) echo "Setting up SDRPlay..."
            git clone https://github.com/ericek111/libmirisdr-5 || { echo "Failed to clone libmirisdr-5 repository."; exit 1; }
            cd libmirisdr-5 || { echo "Failed to enter the libmirisdr-5 directory."; exit 1; }
            
            cmake . || { echo "CMake configuration failed."; exit 1; }
            make || { echo "Make failed."; exit 1; }
            $SUDO make install || { echo "Make install failed."; exit 1; }
            cd ..
            $SUDO rm -rf libmirisdr-5
            
            echo "SDRPlay setup is complete."
            ;;
        4) echo "Skipping SDR driver installation..."
            ;;
        *) echo "Invalid option selected. Exiting."
            exit 1
            ;;
    esac
    
    # Configure site information
    echo ""
    echo "=========================================="
    echo "Site Information Configuration"
    echo "=========================================="
    echo ""
    
    SITE_INFO_PATH="$PHANTOM_DIR/frontend/site_information.json"
    
    if [ ! -f "$SITE_INFO_PATH" ]; then
        echo "Error: site_information.json not found at $SITE_INFO_PATH"
        echo "Please ensure the file exists in the frontend directory."
        exit 1
    fi
    
    echo "Now you will edit your site information..."
    echo "This includes your callsign, location, hardware details, etc."
    echo ""
    read -p "Press ENTER to open the editor..."
    
    # Determine which editor to use
    if command -v nano >/dev/null 2>&1; then
        EDITOR="nano"
    elif command -v vi >/dev/null 2>&1; then
        EDITOR="vi"
    elif command -v vim >/dev/null 2>&1; then
        EDITOR="vim"
    else
        echo "No text editor found (nano/vi/vim). Installing nano..."
        $SUDO apt-get install -y nano
        EDITOR="nano"
    fi
    
    echo "Opening $SITE_INFO_PATH with $EDITOR..."
    echo "Edit your information, then save and exit."
    if [ "$EDITOR" = "nano" ]; then
        echo "(Press Ctrl+X to exit, then Y to save, then ENTER to confirm)"
    fi
    echo ""
    
    $EDITOR "$SITE_INFO_PATH"
    
    if [ $? -ne 0 ]; then
        echo "Error editing the file. Continuing anyway..."
    else
        echo "Site information saved successfully!"
    fi
    
    # Install Frontend Dependencies with specific Vite version
    echo ""
    echo "=========================================="
    echo "Installing Frontend Dependencies"
    echo "=========================================="
    echo ""
    
    if [ ! -d "$PHANTOM_DIR/frontend" ]; then
        echo "❌ Error: Frontend directory not found at $PHANTOM_DIR/frontend"
        exit 1
    fi
    
    cd "$PHANTOM_DIR/frontend"
    
    echo "Cleaning previous installations..."
    rm -rf node_modules package-lock.json
    
    echo ""
    echo "Installing Vite 5.4.16 with Svelte 4 compatible packages..."
    
    # Uninstall any existing versions
    npm uninstall vite @vitejs/plugin-legacy @sveltejs/vite-plugin-svelte 2>/dev/null || true
    
    # Install specific versions compatible with Svelte 4
    npm install --save-dev vite@5.4.16
    npm install --save-dev @sveltejs/vite-plugin-svelte@^3.1.2
    npm install --save-dev @vitejs/plugin-legacy@^5.4.2
    npm install --save-dev svelte@^4.2.20
    npm install --save-dev esbuild@latest
    
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: Some npm packages had installation issues, but continuing..."
    else
        echo "✅ Vite 5.4.16 and compatible packages installed successfully"
    fi
    
    echo ""
    echo "Installing remaining npm dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: npm install had issues, but continuing..."
    else
        echo "✅ npm dependencies installed"
    fi
    
    echo ""
    echo "Installing Opus WASM decoder..."
    npm install @wasm-audio-decoders/opus-ml
    
    if [ $? -eq 0 ]; then
        echo "✅ Opus decoder installed successfully"
    else
        echo "⚠️  Warning: Opus decoder installation had issues, but continuing..."
    fi
    
    echo ""
    echo "Running npm audit fix..."
    npm audit fix
    
    echo ""
    echo "Building frontend..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend built successfully"
    else
        echo "⚠️  Warning: Frontend build had issues, but continuing..."
    fi
    
    cd - > /dev/null
    
    # Build the frontend
    echo ""
    echo "=========================================="
    echo "Building All Frontend Versions"
    echo "=========================================="
    echo ""
    
    BUILD_SCRIPT="$PHANTOM_DIR/frontend/build-all.sh"
    
    if [ ! -f "$BUILD_SCRIPT" ]; then
        echo "Error: build-all.sh not found at $BUILD_SCRIPT"
        echo "Skipping frontend build."
    else
        echo "Running build-all.sh to create all frontend versions..."
        
        # Change to frontend directory
        cd "$PHANTOM_DIR/frontend"
        
        # Make sure the script is executable
        chmod +x ./build-all.sh
        
        ./build-all.sh
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "=========================================="
            echo "✅ Frontend built successfully!"
            echo "=========================================="
        else
            echo ""
            echo "=========================================="
            echo "⚠️  Frontend build encountered errors"
            echo "=========================================="
            echo "Please check the error messages above."
            echo "You may need to run the build manually:"
            echo "  cd $PHANTOM_DIR/frontend"
            echo "  ./build-all.sh"
        fi
        
        cd - > /dev/null
    fi
    
    # OpenCL Installation (Intel CPU)
    echo ""
    echo "=========================================="
    echo "OpenCL Installation (Optional)"
    echo "=========================================="
    echo ""
    echo "OpenCL can accelerate FFT processing on Intel CPUs."
    echo "This is recommended for Intel-based systems."
    echo ""
    read -p "Do you want to install OpenCL support for Intel CPU? (y/n): " install_opencl
    
    if [[ $install_opencl == "y" || $install_opencl == "Y" ]]; then
        echo ""
        echo "Installing OpenCL dependencies..."
        
        # Install OpenCL development packages
        $SUDO apt-get install -y libclfft-dev ocl-icd-opencl-dev clinfo
        
        if [ $? -ne 0 ]; then
            echo "❌ Error: Failed to install OpenCL packages"
            echo "Continuing without OpenCL support..."
        else
            echo "✅ OpenCL development packages installed"
            
            # Install Intel Compute Runtime
            echo ""
            echo "Installing Intel Compute Runtime..."
            
            mkdir -p neo
            cd neo
            
            echo "Downloading Intel Compute Runtime packages..."
            wget -q https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
            wget -q https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
            wget -q https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
            wget -q https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
            wget -q https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
            
            if [ $? -eq 0 ]; then
                echo "Installing Intel Compute Runtime..."
                $SUDO dpkg -i *.deb
                
                # Fix any dependency issues
                $SUDO apt update
                $SUDO apt install -y intel-opencl-icd
                $SUDO apt --fix-broken install -y
                $SUDO apt install -y intel-opencl-icd
                
                echo ""
                echo "Testing OpenCL installation..."
                $SUDO clinfo
                
                if [ $? -eq 0 ]; then
                    echo ""
                    echo "✅ OpenCL installed successfully!"
                    echo ""
                    echo "⚠️  IMPORTANT: You need to REBOOT your system for OpenCL to work properly."
                    NEEDS_REBOOT=true
                else
                    echo "⚠️  OpenCL installation completed but clinfo test failed"
                    echo "You may need to reboot and run 'clinfo' to verify"
                fi
            else
                echo "❌ Error: Failed to download Intel Compute Runtime packages"
                echo "Continuing without Intel Compute Runtime..."
            fi
            
            cd ..
            rm -rf neo
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
    echo "   • Network libraries (libwebsocketpp, libcurlpp)"
    echo "   • Compression libraries (zlib, zstd, FLAC)"
    echo "   • Boost libraries"
    if [[ $install_opencl == "y" || $install_opencl == "Y" ]]; then
        echo "   • OpenCL support (Intel CPU acceleration)"
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
           echo "   • libmirisdr-5 installed"
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
