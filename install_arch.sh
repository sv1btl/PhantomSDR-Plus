#!/bin/bash
set -euo pipefail

# ==============================================================================
# PhantomSDR-Plus Installer — Arch Linux
# ==============================================================================

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

NEEDS_REBOOT=false

red()    { echo -e "\e[31m$*\e[0m"; }
green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }

banner() {
    echo ""
    echo "=========================================="
    blue "$1"
    echo "=========================================="
}

die() {
    red "❌ Fatal: $*"
    exit 1
}

run() {
    "$@" || die "Command failed: $*"
}

# ------------------------------------------------------------------------------
# Privilege escalation
# ------------------------------------------------------------------------------

if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    SUDO=""
fi

# ------------------------------------------------------------------------------
# Node.js / npm via nvm
# ------------------------------------------------------------------------------

banner "Checking Node.js and npm"

NVM_VERSION="v0.40.4"
NODE_NEED=22

install_node_via_nvm() {
    echo "Installing nvm ${NVM_VERSION}..."
    run curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    run nvm install ${NODE_NEED}
    run nvm use ${NODE_NEED}
    run nvm alias default ${NODE_NEED}
}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_OK=false
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge ${NODE_NEED} ]; then
        green "✅ Node.js $(node --version) and npm $(npm --version) — OK"
        NODE_OK=true
    else
        yellow "⚠️  Node.js $(node --version) is too old (need ${NODE_NEED}+)"
    fi
fi

if [ "$NODE_OK" = false ]; then
    if [ ! -d "$HOME/.nvm" ]; then
        install_node_via_nvm
    else
        echo "nvm already installed — upgrading Node.js..."
        \. "$NVM_DIR/nvm.sh"
        run nvm install ${NODE_NEED}
        run nvm use ${NODE_NEED}
        run nvm alias default ${NODE_NEED}
    fi
    command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 \
        || die "Node.js / npm installation failed. Install Node.js ${NODE_NEED}+ manually and retry."
    green "✅ Node.js $(node --version) and npm $(npm --version) installed"
fi

echo ""

# ------------------------------------------------------------------------------
# Locate PhantomSDR-Plus source tree
# ------------------------------------------------------------------------------

banner "Locating PhantomSDR-Plus directory"

find_phantom_dir() {
    local candidates=( "." "PhantomSDR-Plus" "../PhantomSDR-Plus" "$HOME/PhantomSDR-Plus" )
    for dir in "${candidates[@]}"; do
        if [ -f "$dir/meson.build" ] && [ -d "$dir/frontend" ] && [ -d "$dir/src" ]; then
            PHANTOM_DIR=$(realpath "$dir")
            green "✅ Found PhantomSDR-Plus at: $PHANTOM_DIR"
            return 0
        fi
    done
    red "❌ Could not locate PhantomSDR-Plus automatically"
    echo ""
    read -rp "Enter the full path to the PhantomSDR-Plus directory: " user_path
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR=$(realpath "$user_path")
        green "✅ Using: $PHANTOM_DIR"
    else
        die "Path '$user_path' is not a valid PhantomSDR-Plus directory."
    fi
}

find_phantom_dir
echo ""

# ------------------------------------------------------------------------------
# System dependencies
# ------------------------------------------------------------------------------

banner "Installing System Dependencies"

# Use -Syu (full sync + upgrade) before installing.
# -Sy alone (sync without upgrade) is unsafe on Arch — it can produce a
# partial-upgrade state where newly installed packages link against newer
# libs than the rest of the system has.
echo "Synchronising and upgrading packages..."
run $SUDO pacman -Syu --needed --noconfirm \
    base-devel cmake pkg-config meson ninja \
    fftw websocketpp flac zlib zstd boost opus liquid-dsp \
    git curl cargo nlohmann-json

# curlpp is in AUR only — handle gracefully.
if ! pacman -Qi curlpp >/dev/null 2>&1; then
    yellow ""
    yellow "⚠️  curlpp is not in the official repos (AUR only)."
    yellow "   Install it with your AUR helper before continuing:"
    yellow "     yay -S curlpp   or   paru -S curlpp"
    yellow ""
    read -rp "Continue without curlpp? (y/n): " skip_curlpp
    [[ $skip_curlpp =~ ^[Yy]$ ]] || die "Please install curlpp and re-run the script."
fi

green "✅ System packages installed"
echo ""

# ------------------------------------------------------------------------------
# Build PhantomSDR-Plus backend
# ------------------------------------------------------------------------------

banner "Building PhantomSDR-Plus Backend"

cd "$PHANTOM_DIR"
echo "Configuring with Meson..."
run meson setup --wipe build
echo "Compiling (2 cores — safe for low-RAM systems)..."
run meson compile -j2 -C build
green "✅ Backend compiled: $PHANTOM_DIR/build/"
cd - > /dev/null
echo ""

# ------------------------------------------------------------------------------
# SDR hardware driver
# ------------------------------------------------------------------------------

banner "SDR Hardware Setup"

echo "Which SDR would you like to set up?"
echo "  [1] RX888 MkII / RX888"
echo "  [2] RTL-SDR"
echo "  [3] SDRPlay (via libmirisdr — AUR)"
echo "  [4] Skip — install SDR driver manually later"
read -rp "Select an option [1-4]: " option

case $option in

    # ------------------------------------------------------------------
    1)  echo ""
        echo "Setting up RX888 MkII / RX888..."
        # Remove system Rust so rustup has a clean environment.
        $SUDO pacman -R --noconfirm rust 2>/dev/null || true

        echo "Installing Rust via rustup..."
        run curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env"

        echo "Cloning rx888_stream..."
        if [ -d "rx888_stream" ]; then
            yellow "rx888_stream directory already exists — pulling latest..."
            cd rx888_stream && run git pull
        else
            run git clone https://github.com/rhgndf/rx888_stream
            cd rx888_stream
        fi

        echo "Building rx888_stream..."
        run RUSTFLAGS="-C target-cpu=native" cargo build --release
        run RUSTFLAGS="-C target-cpu=native" cargo install --path .
        green "✅ RX888 driver built and installed (~/.cargo/bin/rx888_stream)"
        cd ..
        ;;

    # ------------------------------------------------------------------
    2)  echo ""
        read -rp "Do you have an RTL-SDR Blog V4? (y/n): " rtlsdr_v4

        if [[ $rtlsdr_v4 =~ ^[Yy]$ ]]; then
            echo "Setting up RTL-SDR Blog V4..."
            $SUDO pacman -R --noconfirm rtl-sdr 2>/dev/null || true
            $SUDO rm -f \
                /usr/lib/librtlsdr* /usr/include/rtl-sdr* \
                /usr/local/lib/librtlsdr* /usr/local/include/rtl-sdr* \
                /usr/local/include/rtl_* /usr/local/bin/rtl_*

            run $SUDO pacman -S --needed --noconfirm libusb git cmake pkg-config

            if [ -d "rtl-sdr-blog" ]; then
                yellow "rtl-sdr-blog already exists — pulling latest..."
                cd rtl-sdr-blog && run git pull && cd ..
            else
                run git clone https://github.com/rtlsdrblog/rtl-sdr-blog
            fi

            cd rtl-sdr-blog
            mkdir -p build && cd build
            run cmake ../ -DINSTALL_UDEV_RULES=ON
            run make -j4
            run $SUDO make install
            run $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
            run $SUDO ldconfig
            echo "blacklist dvb_usb_rtl28xxu" \
                | $SUDO tee /etc/modprobe.d/blacklist-rtl.conf > /dev/null
            cd ../..

            green "✅ RTL-SDR Blog V4 drivers installed"
            yellow "⚠️  A reboot is required for the RTL-SDR V4 to be recognised."
            NEEDS_REBOOT=true
        else
            echo "Setting up standard RTL-SDR..."
            run $SUDO pacman -S --needed --noconfirm rtl-sdr
            green "✅ Standard RTL-SDR drivers installed"
        fi
        ;;

    # ------------------------------------------------------------------
    3)  echo ""
        yellow "⚠️  libmirisdr is available via AUR only."
        yellow "   Install it with your AUR helper, then re-run this script:"
        yellow "     yay -S libmirisdr-git   or   paru -S libmirisdr-git"
        echo ""
        read -rp "Press Enter to continue (assuming you have already installed it)..."
        ;;

    # ------------------------------------------------------------------
    4)  echo "Skipping SDR driver installation." ;;

    # ------------------------------------------------------------------
    *)  die "Invalid option '$option'." ;;

esac
echo ""

# ------------------------------------------------------------------------------
# Site information
# ------------------------------------------------------------------------------

banner "Site Information"

SITE_INFO_PATH="$PHANTOM_DIR/frontend/site_information.json"
[ -f "$SITE_INFO_PATH" ] \
    || die "site_information.json not found at $SITE_INFO_PATH — is the source tree complete?"

echo "You will now edit your site information (callsign, location, hardware, etc.)."
echo ""
read -rp "Press ENTER to open the editor (or Ctrl+C to skip)..."

if command -v nano >/dev/null 2>&1; then
    VISUAL_EDITOR="nano"
elif command -v vim >/dev/null 2>&1; then
    VISUAL_EDITOR="vim"
elif command -v vi >/dev/null 2>&1; then
    VISUAL_EDITOR="vi"
else
    run $SUDO pacman -S --noconfirm nano
    VISUAL_EDITOR="nano"
fi

[ "$VISUAL_EDITOR" = "nano" ] && echo "(Ctrl+X → Y → ENTER to save and exit)"
echo ""
"$VISUAL_EDITOR" "$SITE_INFO_PATH" || yellow "⚠️  Editor exited non-zero — verify the file manually."
echo ""
green "✅ Site information saved: $SITE_INFO_PATH"
echo ""

# ------------------------------------------------------------------------------
# Frontend dependencies and build
# ------------------------------------------------------------------------------

banner "Installing Frontend Dependencies"

[ -d "$PHANTOM_DIR/frontend" ] \
    || die "Frontend directory not found at $PHANTOM_DIR/frontend"

cd "$PHANTOM_DIR/frontend"

echo "Cleaning previous install artefacts..."
rm -rf node_modules package-lock.json

# ------------------------------------------------------------------------------
# Patch package.json before any npm install
# ------------------------------------------------------------------------------
# This does two things automatically:
#
#   1. Injects an "overrides" block so npm resolves deprecated/vulnerable
#      transitive packages to safe modern versions on first install, avoiding
#      the flood of `npm warn deprecated` messages.
#
#   2. Upgrades ESLint to ^9 in devDependencies if the project still pins ^8.
#      ESLint 8 is deprecated and drags in rimraf@2/3, glob@7, and the
#      @humanwhocodes/* packages.  ESLint 9 replaces all of them.
#      NOTE: ESLint 9 uses flat config (eslint.config.js).  If linting breaks
#      after this upgrade run:  npx @eslint/migrate-config .eslintrc.*
#
# Packages deliberately NOT overridden:
#   inflight@1.0.6  — deprecated but has no API-compatible replacement and
#                     poses no security risk (JS GC handles the leak in
#                     practice for short-lived processes like a build tool).
# ------------------------------------------------------------------------------
echo "Patching package.json -- injecting transitive dependency overrides..."
python3 - "$PHANTOM_DIR/frontend/package.json" << 'PYEOF'
import sys, json

path = sys.argv[1]
with open(path) as fh:
    pkg = json.load(fh)

all_deps = {}
all_deps.update(pkg.get('dependencies', {}))
all_deps.update(pkg.get('devDependencies', {}))

# Repair: if a previous run of this script incorrectly upgraded eslint to ^9
# while eslint-config-* or eslint-plugin-* packages (which pin to eslint@^8)
# are still present, revert eslint back to ^8.0.0.
# eslint-config-standard@17, and most other ESLint configs/plugins published
# before 2025, carry a peer dep of eslint@^8 — they will break under ^9.
has_eslint_ecosystem = any(
    k.startswith('eslint-config-') or k.startswith('eslint-plugin-')
    for k in all_deps
)
for section in ('dependencies', 'devDependencies'):
    cur = pkg.get(section, {}).get('eslint', '')
    if cur and cur.lstrip('^~').startswith('9.') and has_eslint_ecosystem:
        pkg[section]['eslint'] = '^8.0.0'
        print('   eslint: reverted ^9 -> ^8.0.0 (eslint-config/plugin packages require ^8)')

# Force safe versions for deprecated/vulnerable transitive packages.
#   rimraf ^4  - rimraf@2/3 are EOL
#   glob  ^10  - glob@7 has a published ReDoS security advisory
# ESLint 8 deprecation is a warning only, not a security issue — not touched.
# inflight has no API-compatible replacement — not touched.
overrides = {
    'rimraf': '^4.0.0',
    'glob':   '^10.3.0',
}
pkg.setdefault('overrides', {}).update(overrides)
for k, v in overrides.items():
    print('   override', k, '->', v)

with open(path, 'w') as fh:
    json.dump(pkg, fh, indent=2)
    print(file=fh)
PYEOF

echo ""
echo "Installing pinned Vite / Svelte packages..."
# VERSION NOTES (April 2026)
# ─────────────────────────────────────────────────────────────────────────────
# Vite 8 (current stable) requires @sveltejs/vite-plugin-svelte v7, which in
# turn requires Svelte 5.  PhantomSDR-Plus uses Svelte 4 components; upgrading
# requires source migration:  npx sv migrate svelte-5
# Until that migration is done, Vite 5.4.16 + Svelte 4 are the correct pins.
#
# When ready to upgrade replace this block with:
#   vite@latest  "@sveltejs/vite-plugin-svelte@^7"  "svelte@^5"
# and drop @vitejs/plugin-legacy (Vite 8 targets modern browsers by default).
#
# esbuild: NOT pinned here — Vite 5 has a strict peer range (^0.21.x);
# let npm resolve it automatically from Vite's peer dep.
# ─────────────────────────────────────────────────────────────────────────────
run npm install --save-dev \
    vite@5.4.16 \
    "@sveltejs/vite-plugin-svelte@^3.1.2" \
    "@vitejs/plugin-legacy@^5.4.2" \
    "svelte@^4.2.20"

echo ""
echo "Installing remaining dependencies from package.json..."
run npm install

echo ""
echo "Installing Opus WASM decoder..."
run npm install @wasm-audio-decoders/opus-ml

# Run audit fix WITHOUT --force so only safe (non-breaking) patches are
# applied.  --force can silently pull in Vite 6/7/8 or Svelte 5 and break
# the build; we deliberately avoid it here.
echo ""
echo "Running safe audit fix..."
npm audit fix 2>/dev/null || true
# Re-install after audit fix to ensure the lock file is consistent.
run npm install

green "✅ npm dependencies installed"
cd - > /dev/null
echo ""


# ------------------------------------------------------------------------------
# Build all frontend variants
# ------------------------------------------------------------------------------

banner "Building All Frontend Versions"

BUILD_SCRIPT="$PHANTOM_DIR/frontend/build-all.sh"

if [ ! -f "$BUILD_SCRIPT" ]; then
    yellow "⚠️  build-all.sh not found at $BUILD_SCRIPT — skipping."
    yellow "    Run manually once it is in place:"
    yellow "      cd $PHANTOM_DIR/frontend && ./build-all.sh"
else
    chmod +x "$BUILD_SCRIPT"
    cd "$PHANTOM_DIR/frontend"

    if ./build-all.sh; then
        green "✅ All frontend versions built: $PHANTOM_DIR/frontend/dist/"
    else
        yellow "⚠️  build-all.sh exited with errors — check output above."
        yellow "    Re-run: cd $PHANTOM_DIR/frontend && ./build-all.sh"
    fi

    cd - > /dev/null
fi
echo ""

# ------------------------------------------------------------------------------
# OpenCL (optional)
# ------------------------------------------------------------------------------

banner "OpenCL Support (Optional)"

echo "OpenCL can accelerate FFT processing on Intel/AMD/NVIDIA hardware."
echo ""
read -rp "Install OpenCL support? (y/n): " install_opencl

if [[ $install_opencl =~ ^[Yy]$ ]]; then
    echo ""
    echo "Installing OpenCL base packages..."
    run $SUDO pacman -S --needed --noconfirm ocl-icd opencl-headers clinfo

    cpu_vendor=$(lscpu | awk '/Vendor ID/{print $3}')

    case "$cpu_vendor" in
        GenuineIntel)
            echo "Intel CPU detected — installing intel-compute-runtime..."
            # intel-compute-runtime is in the extra/community repo on Arch.
            if $SUDO pacman -S --needed --noconfirm intel-compute-runtime 2>/dev/null; then
                green "✅ Intel Compute Runtime installed"
            else
                yellow "⚠️  intel-compute-runtime not found in repos."
                yellow "   Try: yay -S intel-compute-runtime"
            fi
            ;;
        AuthenticAMD)
            yellow "AMD CPU/GPU detected."
            yellow "   Install ROCm OpenCL with: sudo pacman -S rocm-opencl-runtime"
            ;;
        *)
            yellow "Unknown CPU vendor '$cpu_vendor'."
            yellow "   For NVIDIA: sudo pacman -S opencl-nvidia"
            ;;
    esac

    echo ""
    echo "Testing OpenCL installation (as current user)..."
    if clinfo > /dev/null 2>&1; then
        green "✅ OpenCL device(s) detected"
    else
        yellow "⚠️  clinfo found no devices — reboot and run 'clinfo' to verify."
        NEEDS_REBOOT=true
    fi
else
    echo "Skipping OpenCL."
fi
echo ""

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

banner "Installation Summary"

echo ""
green "✅ System packages:"
echo "   • Node.js $(node --version) / npm $(npm --version)"
echo "   • Build tools (gcc, cmake, meson, ninja)"
echo "   • DSP libs (FFTW3, libopus, libliquid)"
echo "   • Network libs (libwebsocketpp, curl)"
echo "   • Compression libs (zlib, zstd, FLAC)"
echo "   • Boost libraries"
[[ $install_opencl =~ ^[Yy]$ ]] && echo "   • OpenCL"

echo ""
green "✅ Backend:"
echo "   • Compiled: $PHANTOM_DIR/build/"

echo ""
case $option in
    1)  green "✅ SDR hardware: RX888 MkII / RX888"
        echo "   • rx888_stream: installed to ~/.cargo/bin/"
        yellow "   ⚠️  Open a new terminal (or 'source ~/.cargo/env') before using rx888_stream"
        ;;
    2)  green "✅ SDR hardware: RTL-SDR"
        [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] \
            && echo "   • RTL-SDR Blog V4 drivers + udev rules installed" \
            || echo "   • Standard RTL-SDR drivers installed"
        ;;
    3)  yellow "⚠️  SDR hardware: SDRPlay — install libmirisdr-git from AUR manually" ;;
    4)  yellow "⚠️  SDR hardware: skipped — install driver manually" ;;
esac

echo ""
green "✅ Frontend:"
echo "   • Vite 5.4.16 / Svelte 4"
echo "   • Site information: $SITE_INFO_PATH"
[ -d "$PHANTOM_DIR/frontend/dist" ] \
    && echo "   • Built: $PHANTOM_DIR/frontend/dist/"

# ------------------------------------------------------------------------------
# Next steps
# ------------------------------------------------------------------------------

banner "Next Steps"

echo ""
echo "🔧 1. Configure your receiver — edit the appropriate .toml:"
case $option in
    1) echo "      nano $PHANTOM_DIR/rx888.toml" ;;
    2) echo "      nano $PHANTOM_DIR/rtlsdr.toml" ;;
    3) echo "      nano $PHANTOM_DIR/sdrplay.toml" ;;
    4) echo "      nano $PHANTOM_DIR/<your_sdr>.toml" ;;
esac

echo ""
echo "🚀 2. Start the server:"
echo "      cd $PHANTOM_DIR"
case $option in
    1) echo "      ./build/spectrumserver rx888.toml" ;;
    2) echo "      ./build/spectrumserver rtlsdr.toml" ;;
    3) echo "      ./build/spectrumserver sdrplay.toml" ;;
    4) echo "      ./build/spectrumserver <your_sdr>.toml" ;;
esac

echo ""
echo "🌐 3. Open in your browser (replace PORT with the port in your .toml):"
if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "      http://localhost:PORT/              → Analog S-Meter"
    echo "      http://localhost:PORT/digital/      → Digital S-Meter"
    echo "      http://localhost:PORT/v2-analog/    → V2 Analog S-Meter"
    echo "      http://localhost:PORT/v2-digital/   → V2 Digital S-Meter"
else
    echo "      http://localhost:PORT/"
fi

echo ""
echo "📚 Docs / issues: https://github.com/sv1btl/PhantomSDR-Plus"

# ------------------------------------------------------------------------------
# Reboot warning
# ------------------------------------------------------------------------------

if [ "$NEEDS_REBOOT" = true ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║          ⚠️  SYSTEM REBOOT REQUIRED  ⚠️                       ║"
    echo "║                                                              ║"
    [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] && \
    echo "║   RTL-SDR V4 udev rules take effect after reboot.           ║"
    [[ ${install_opencl:-n} =~ ^[Yy]$ ]] && \
    echo "║   OpenCL drivers take effect after reboot.                  ║"
    echo "║                                                              ║"
    echo "║   Run:  sudo reboot                                          ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
fi

# ------------------------------------------------------------------------------
# Done
# ------------------------------------------------------------------------------

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           🎉  INSTALLATION COMPLETE  🎉                      ║"
echo "║                PhantomSDR-Plus WebSDR                        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
