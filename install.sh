#!/bin/bash
set -euo pipefail

# ==============================================================================
# PhantomSDR-Plus Installer
# Supported: Ubuntu 22.04 LTS · Ubuntu 24.04 LTS · Debian Bookworm · Debian Trixie
#            (amd64 / arm64)
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

# Run a command and exit with a clear message on failure.
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
# OS detection
# ------------------------------------------------------------------------------

detect_os() {
    # Source /etc/os-release — portable across Ubuntu and Debian
    # shellcheck source=/dev/null
    . /etc/os-release
    OS_ID="${ID:-unknown}"                          # ubuntu | debian
    OS_VERSION="${VERSION_ID:-0}"                   # 22.04 | 24.04 | 12 | 13
    OS_CODENAME="${VERSION_CODENAME:-unknown}"       # jammy | noble | bookworm | trixie

    case "${OS_ID}:${OS_CODENAME}" in
        ubuntu:jammy)   OS_LABEL="Ubuntu 22.04 (Jammy)"  ;;
        ubuntu:noble)   OS_LABEL="Ubuntu 24.04 (Noble)"  ;;
        debian:bookworm) OS_LABEL="Debian 12 (Bookworm)" ;;
        debian:trixie)  OS_LABEL="Debian 13 (Trixie)"    ;;
        *)
            yellow "⚠️  Unrecognised distro: ${OS_ID} ${OS_VERSION} (${OS_CODENAME})"
            yellow "   Proceeding anyway — some steps may need manual adjustment."
            OS_LABEL="${OS_ID} ${OS_VERSION}"
            ;;
    esac

    green "✅ Detected: ${OS_LABEL}"
    echo ""
}

detect_os



banner "Checking Node.js and npm"

NVM_VERSION="v0.40.4"
NODE_NEED=22

install_node_via_nvm() {
    echo "Installing nvm ${NVM_VERSION}..."
    # NOTE: Do NOT use `run` here — run() only guards the left side of a pipe.
    # The || die at the end guards the entire pipeline (curl + bash together).
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
        | bash || die "nvm installation script failed"

    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    echo "Installing Node.js ${NODE_NEED}..."
    run nvm install ${NODE_NEED}
    run nvm use ${NODE_NEED}
    run nvm alias default ${NODE_NEED}
}

# Load nvm if already installed
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
        echo "nvm already installed — loading and upgrading Node.js..."
        # shellcheck source=/dev/null
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
    local candidates=(
        "."
        "PhantomSDR-Plus"
        "../PhantomSDR-Plus"
        "$HOME/PhantomSDR-Plus"
    )

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

echo "Updating package lists..."
run $SUDO apt-get update -qq

echo "Installing build tools and libraries..."
run $SUDO apt-get install -y \
    build-essential cmake pkg-config meson ninja-build \
    libfftw3-dev libwebsocketpp-dev libflac++-dev \
    zlib1g-dev libzstd-dev libboost-all-dev \
    libopus-dev libliquid-dev \
    libcurl4-openssl-dev curl \
    nlohmann-json3-dev \
    git \
    util-linux \
    nano

green "✅ System packages installed"
echo ""

# ------------------------------------------------------------------------------
# Build PhantomSDR-Plus backend
# ------------------------------------------------------------------------------

banner "Building PhantomSDR-Plus Backend"

cd "$PHANTOM_DIR"

echo "Configuring with Meson..."
# --wipe reconfigures an existing valid build tree.
# On a fresh clone or after 'rm -rf build', there is no valid tree and
# --wipe will fail.  Check for the sentinel file meson writes on success.
if [ -f build/meson-private/build.ninja ]; then
    run meson setup --wipe build
else
    rm -rf build
    run meson setup build
fi

echo "Compiling (using 2 cores to stay within memory limits on low-RAM systems)..."
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
echo "  [3] SDRPlay (via libmirisdr-5)"
echo "  [4] Skip — install SDR driver manually later"
read -rp "Select an option [1-4]: " option

case $option in

    # ------------------------------------------------------------------
    1)  echo ""
        echo "Setting up RX888 MkII / RX888..."

        # Remove any system-packaged Rust that might conflict.
        $SUDO apt-get remove --purge -y rustc cargo 2>/dev/null || true

        echo "Installing Rust via rustup..."
        # NOTE: Do NOT use `run` here — run() only guards the left side of a pipe.
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
            | sh -s -- -y || die "rustup installation script failed"
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env"

        echo "Cloning rx888_stream..."
        if [ -d "rx888_stream" ]; then
            yellow "rx888_stream directory already exists — pulling latest..."
            cd rx888_stream
            run git pull
        else
            run git clone https://github.com/rhgndf/rx888_stream
            cd rx888_stream
        fi

        echo "Building rx888_stream..."
        run env RUSTFLAGS="-C target-cpu=native" cargo build --release
        run env RUSTFLAGS="-C target-cpu=native" cargo install --path .

        green "✅ RX888 driver built and installed (~/.cargo/bin/rx888_stream)"
        cd ..
        ;;

    # ------------------------------------------------------------------
    2)  echo ""
        read -rp "Do you have an RTL-SDR Blog V4? (y/n): " rtlsdr_v4

        if [[ $rtlsdr_v4 =~ ^[Yy]$ ]]; then
            echo "Setting up RTL-SDR Blog V4..."

            # Remove conflicting upstream packages.
            $SUDO apt-get purge -y "^librtlsdr" 2>/dev/null || true
            $SUDO rm -f \
                /usr/lib/librtlsdr* \
                /usr/include/rtl-sdr* \
                /usr/local/lib/librtlsdr* \
                /usr/local/include/rtl-sdr* \
                /usr/local/include/rtl_* \
                /usr/local/bin/rtl_*

            run $SUDO apt-get install -y libusb-1.0-0-dev git cmake pkg-config

            if [ -d "rtl-sdr-blog" ]; then
                yellow "rtl-sdr-blog already exists — pulling latest..."
                cd rtl-sdr-blog
                run git pull
                cd ..
            else
                run git clone https://github.com/rtlsdrblog/rtl-sdr-blog
            fi

            cd rtl-sdr-blog
            mkdir -p build && cd build
            run cmake ../ -DINSTALL_UDEV_RULES=ON
            run make
            run $SUDO make install
            run $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
            run $SUDO ldconfig
            echo 'blacklist dvb_usb_rtl28xxu' \
                | $SUDO tee /etc/modprobe.d/blacklist-dvb_usb_rtl28xxu.conf > /dev/null
            cd ../..

            green "✅ RTL-SDR Blog V4 drivers installed"
            yellow "⚠️  A reboot is required for the RTL-SDR V4 to be recognised."
            NEEDS_REBOOT=true

        else
            echo "Setting up standard RTL-SDR..."
            run $SUDO apt-get install -y \
                libusb-1.0-0-dev librtlsdr0 librtlsdr-dev rtl-sdr
            green "✅ Standard RTL-SDR drivers installed"
        fi
        ;;

    # ------------------------------------------------------------------
    3)  echo ""
        echo "Setting up SDRPlay via libmirisdr-5..."

        if [ -d "libmirisdr-5" ]; then
            yellow "libmirisdr-5 already exists — re-using existing clone."
        else
            run git clone https://github.com/ericek111/libmirisdr-5
        fi

        cd libmirisdr-5 || die "Failed to enter libmirisdr-5 directory"
        # Build out-of-source (mirrors RTL-SDR section; avoids projects that
        # reject in-source builds and keeps the source tree clean).
        mkdir -p build && cd build
        run cmake ..
        run make
        run $SUDO make install
        run $SUDO ldconfig
        cd ../..

        green "✅ SDRPlay (libmirisdr-5) installed"
        ;;

    # ------------------------------------------------------------------
    4)  echo "Skipping SDR driver installation."
        ;;

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
    echo "No editor found — installing nano..."
    run $SUDO apt-get install -y nano
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
import sys, json, re

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
    # Match major version 9 in any semver range form:
    # ^9, ^9.0.0, ~9.0.0, >=9.0.0, 9, 9.x, 9.0.0, etc.
    if cur and re.search(r'(?:^|[^\d])9(?:\.|$|\s|x)', cur) and has_eslint_ecosystem:
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

echo ""
echo "Installing emoji picker..."
run npm install emoji-picker-element

echo ""
echo "Installing Socket.IO client (FreeDV Reporter live feed)..."
run npm install socket.io-client

# Run audit fix WITHOUT --force so only safe (non-breaking) patches are
# applied.  --force can silently pull in Vite 6/7/8 or Svelte 5 and break
# the build; we deliberately avoid it here.
echo ""
echo "Running safe audit fix..."
npm audit fix 2>/dev/null || true
# Re-install after audit fix to ensure the lock file is consistent.
run npm install

green "✅ npm dependencies installed"

# The autorun spot-reporter daemon reuses the frontend's node_modules (ws +
# cbor-x) through a symlink. It is git-ignored, so a fresh clone won't have it —
# (re)create it here so `node autorun/index.js` can resolve its dependencies.
ln -sfn ../frontend/node_modules "$PHANTOM_DIR/autorun/node_modules"
green "✅ autorun/node_modules linked to frontend/node_modules"
cd - > /dev/null
echo ""


# ------------------------------------------------------------------------------
# Build all frontend variants
# ------------------------------------------------------------------------------

banner "Building All Frontend Versions"

BUILD_SCRIPT="$PHANTOM_DIR/frontend/build-all.sh"

if [ ! -f "$BUILD_SCRIPT" ]; then
    yellow "⚠️  build-all.sh not found at $BUILD_SCRIPT — skipping."
    yellow "    Run it manually once you have the script in place:"
    yellow "      cd $PHANTOM_DIR/frontend && ./build-all.sh"
else
    chmod +x "$BUILD_SCRIPT"
    cd "$PHANTOM_DIR/frontend"

    if ./build-all.sh; then
        green "✅ All frontend versions built: $PHANTOM_DIR/frontend/dist/"
    else
        yellow "⚠️  build-all.sh exited with errors — check output above."
        yellow "    Re-run manually: cd $PHANTOM_DIR/frontend && ./build-all.sh"
    fi

    cd - > /dev/null
fi
echo ""

# ------------------------------------------------------------------------------
# OpenCL (optional, Intel CPU / GPU)
# ------------------------------------------------------------------------------

banner "OpenCL Support (Optional)"

echo "OpenCL can accelerate FFT processing on Intel CPUs and integrated GPUs."
echo "Recommended for Intel-based systems."
echo ""
read -rp "Install OpenCL support? (y/n): " install_opencl

if [[ $install_opencl =~ ^[Yy]$ ]]; then
    echo ""

    # ------------------------------------------------------------------
    # install_intel_opencl_from_repo <ubuntu-codename>
    #   Adds Intel's official graphics repo and installs intel-opencl-icd.
    #   Used for distros where intel-opencl-icd is NOT in the default repos
    #   (Ubuntu 24.04 / Debian Trixie).
    # ------------------------------------------------------------------
    install_intel_opencl_from_repo() {
        local codename="$1"   # noble | jammy (jammy .debs work on Trixie too)
        echo "Adding Intel graphics repository (${codename})..."
        run $SUDO apt-get install -y wget gpg
        wget -qO - https://repositories.intel.com/gpu/intel-graphics.key \
            | $SUDO gpg --dearmor -o /usr/share/keyrings/intel-graphics.gpg
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/intel-graphics.gpg] \
https://repositories.intel.com/gpu/ubuntu ${codename} unified" \
            | $SUDO tee /etc/apt/sources.list.d/intel-gpu.list > /dev/null
        run $SUDO apt-get update -qq
        run $SUDO apt-get install -y intel-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo
    }

    opencl_ok=false

    case "${OS_ID}:${OS_CODENAME}" in

        # Ubuntu 22.04 — intel-opencl-icd is in the default repos
        ubuntu:jammy)
            echo "Installing OpenCL packages (Ubuntu 22.04 — distro repo)..."
            if $SUDO apt-get install -y \
                    ocl-icd-opencl-dev intel-opencl-icd libclfft-dev clinfo; then
                opencl_ok=true
                opencl_provider="intel-opencl-icd"
            fi
            ;;

        # Ubuntu 24.04 — intel-opencl-icd dropped from Noble; use Intel's own repo
        ubuntu:noble)
            echo "Ubuntu 24.04: intel-opencl-icd is not in the Noble repo."
            echo "Choose OpenCL provider:"
            echo "  [1] Intel (via Intel graphics repo — best for 12th-gen+ iGPU)"
            echo "  [2] Mesa / Rusticl  (in Noble repos, supports Intel Gen12+)"
            echo "  [3] POCL            (CPU-only OpenCL, no GPU needed)"
            read -rp "Select [1-3]: " opencl_choice
            case $opencl_choice in
                1)
                    install_intel_opencl_from_repo noble && opencl_ok=true
                    opencl_provider="intel-opencl-icd (Intel repo)"
                    ;;
                2)
                    if $SUDO apt-get install -y \
                            mesa-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="mesa-opencl-icd (Rusticl)"
                    fi
                    ;;
                3)
                    if $SUDO apt-get install -y \
                            pocl-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="pocl-opencl-icd (CPU)"
                    fi
                    ;;
                *)
                    yellow "⚠️  Invalid choice — skipping OpenCL." ;;
            esac
            ;;

        # Debian Bookworm — intel-opencl-icd is in non-free (not enabled by default)
        debian:bookworm)
            echo "Debian Bookworm: intel-opencl-icd requires the 'non-free' repo component."
            echo "Choose OpenCL provider:"
            echo "  [1] Intel (enable non-free repo + install intel-opencl-icd)"
            echo "  [2] Mesa / Rusticl  (in Bookworm main, supports Intel Gen12+)"
            echo "  [3] POCL            (CPU-only OpenCL, no GPU needed)"
            read -rp "Select [1-3]: " opencl_choice
            case $opencl_choice in
                1)
                    echo "Enabling Debian non-free component..."
                    # Add non-free to every line in sources.list that has non-free-firmware
                    # but does not already have non-free (avoids duplicates on re-runs).
                    $SUDO sed -i \
                        '/non-free-firmware/ { /\bnon-free\b/! s/non-free-firmware/non-free-firmware non-free/ }' \
                        /etc/apt/sources.list
                    run $SUDO apt-get update -qq
                    if $SUDO apt-get install -y \
                            ocl-icd-opencl-dev intel-opencl-icd libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="intel-opencl-icd"
                    fi
                    ;;
                2)
                    if $SUDO apt-get install -y \
                            mesa-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="mesa-opencl-icd (Rusticl)"
                    fi
                    ;;
                3)
                    if $SUDO apt-get install -y \
                            pocl-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="pocl-opencl-icd (CPU)"
                    fi
                    ;;
                *)
                    yellow "⚠️  Invalid choice — skipping OpenCL." ;;
            esac
            ;;

        # Debian Trixie — intel-opencl-icd NOT in Trixie (only in sid)
        debian:trixie)
            echo "Debian Trixie: intel-opencl-icd is not in the Trixie repo."
            echo "Choose OpenCL provider:"
            echo "  [1] Intel (via Intel graphics repo, jammy .debs — works on Trixie)"
            echo "  [2] Mesa / Rusticl  (in Trixie repos, supports Intel Gen12+)"
            echo "  [3] POCL            (CPU-only OpenCL, no GPU needed)"
            read -rp "Select [1-3]: " opencl_choice
            case $opencl_choice in
                1)
                    # Intel doesn't publish a Trixie/Debian repo — the Ubuntu
                    # Jammy .debs install cleanly on Trixie in practice.
                    install_intel_opencl_from_repo jammy && opencl_ok=true
                    opencl_provider="intel-opencl-icd (Intel/Jammy repo)"
                    ;;
                2)
                    if $SUDO apt-get install -y \
                            mesa-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="mesa-opencl-icd (Rusticl)"
                    fi
                    ;;
                3)
                    if $SUDO apt-get install -y \
                            pocl-opencl-icd ocl-icd-opencl-dev libclfft-dev clinfo; then
                        opencl_ok=true
                        opencl_provider="pocl-opencl-icd (CPU)"
                    fi
                    ;;
                *)
                    yellow "⚠️  Invalid choice — skipping OpenCL." ;;
            esac
            ;;

        # Unknown distro — try the direct apt approach; may or may not work
        *)
            yellow "⚠️  Unknown distro — attempting direct apt install of intel-opencl-icd..."
            if $SUDO apt-get install -y \
                    ocl-icd-opencl-dev intel-opencl-icd libclfft-dev clinfo; then
                opencl_ok=true
                opencl_provider="intel-opencl-icd"
            fi
            ;;
    esac

    if [ "$opencl_ok" = true ]; then
        green "✅ OpenCL packages installed"
        echo ""
        echo "Testing OpenCL installation..."
        # Run as the current user (not root) — GPU device visibility
        # for the user account is what actually matters.
        if clinfo > /dev/null 2>&1; then
            green "✅ OpenCL device(s) detected"
        else
            yellow "⚠️  clinfo found no devices — reboot and run 'clinfo' to verify."
        fi
        NEEDS_REBOOT=true
    else
        yellow "⚠️  OpenCL package installation failed — continuing without it."
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
echo "   • Network libs (libwebsocketpp, libcurl)"
echo "   • Compression libs (zlib, zstd, FLAC)"
echo "   • Boost libraries"
[[ ${install_opencl:-n} =~ ^[Yy]$ ]] && echo "   • OpenCL (${opencl_provider:-unknown})"

echo ""
green "✅ Backend:"
echo "   • Compiled: $PHANTOM_DIR/build/"

echo ""
case $option in
    1)  green "✅ SDR hardware: RX888 MkII / RX888"
        echo "   • Rust toolchain: $(rustc --version 2>/dev/null || echo 'see ~/.cargo/bin')"
        echo "   • rx888_stream: installed to ~/.cargo/bin/"
        yellow "   ⚠️  Open a new terminal (or 'source ~/.cargo/env') before using rx888_stream"
        ;;
    2)  green "✅ SDR hardware: RTL-SDR"
        [[ $rtlsdr_v4 =~ ^[Yy]$ ]] \
            && echo "   • RTL-SDR Blog V4 drivers + udev rules installed" \
            || echo "   • Standard RTL-SDR drivers installed"
        ;;
    3)  green "✅ SDR hardware: SDRPlay (libmirisdr-5)" ;;
    4)  yellow "⚠️  SDR hardware: skipped — install driver manually" ;;
esac

echo ""
green "✅ Frontend:"
echo "   • Vite 5.4.16 / Svelte 4"
echo "   • emoji-picker-element"
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
    echo "      http://localhost:PORT/                      → Analog S-Meter"
    echo "      http://localhost:PORT/digital/              → Digital S-Meter"
    echo "      http://localhost:PORT/v2-analog/            → V2 Analog S-Meter"
    echo "      http://localhost:PORT/v2-digital/           → V2 Digital S-Meter"
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
    echo "║          ⚠️  SYSTEM REBOOT REQUIRED  ⚠️                      ║"
    echo "║                                                              ║"
    [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] && \
    echo "║   RTL-SDR V4 udev rules take effect after reboot.            ║"
    [[ ${install_opencl:-n} =~ ^[Yy]$ ]] && \
    echo "║   OpenCL drivers take effect after reboot.                   ║"
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