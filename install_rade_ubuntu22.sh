#!/usr/bin/env bash
# =============================================================================
# install_rade_ubuntu22.sh — RADE / FreeDV sidecar installer for PhantomSDR-Plus
# Ubuntu 22.04 (Jammy) variant: installs websockets>=11.0 via pip instead of
# apt (jammy ships 10.1 which is API-incompatible with rade_helper.py).
# SV1BTL — https://github.com/sv1btl/PhantomSDR-Plus
# =============================================================================
set -euo pipefail

RADAE_DIR="$HOME/radae"
PHANTOM_DIR="$HOME/PhantomSDR-Plus"
MODEL_CHECKPOINT="model19_check3/checkpoints/checkpoint_epoch_100.pth"
REQUIRED_NODE_MAJOR=16

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
section() { echo -e "\n${BOLD}══════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}  $*${NC}"; \
            echo -e "${BOLD}══════════════════════════════════════════${NC}"; }

# =============================================================================
# VERSION CHECK — detect existing install and decide update vs fresh
# =============================================================================
section "Checking existing RADE installation"

NEED_CLONE=true
NEED_BUILD=true

if [[ -d "$RADAE_DIR/.git" ]]; then
    info "Found existing radae repository at $RADAE_DIR"
    cd "$RADAE_DIR"

    LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    git fetch origin --quiet 2>/dev/null || warn "Could not reach GitHub — skipping remote check"
    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

    if [[ "$LOCAL" == "$REMOTE" ]]; then
        ok "radae is already up to date (${LOCAL:0:8})"
        NEED_CLONE=false
        if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
            ok "lpcnet_demo binary already present — skipping rebuild"
            NEED_BUILD=false
        else
            warn "lpcnet_demo missing — will rebuild"
            NEED_CLONE=false
        fi
    else
        warn "Update available: local=${LOCAL:0:8}  remote=${REMOTE:0:8}"
        info "Will pull latest code and rebuild"
        NEED_CLONE=false
    fi
else
    info "No existing radae installation found — performing fresh install"
fi

# =============================================================================
# STEP 1 — System packages
# =============================================================================
section "Step 1 — System requirements"

info "Running apt update…"
sudo apt-get update -qq

info "Installing build tools and system dependencies…"
sudo apt-get install -y \
    build-essential cmake git \
    python3 python3-pip \
    alsa-utils

ok "System packages installed"

# ── Node.js version check ─────────────────────────────────────────────────
info "Checking Node.js version…"
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
    if (( NODE_MAJOR >= REQUIRED_NODE_MAJOR )); then
        ok "Node.js $(node --version) satisfies requirement (>= ${REQUIRED_NODE_MAJOR})"
    else
        warn "Node.js ${NODE_MAJOR} is too old — upgrading to Node 20"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ok "Node.js upgraded to $(node --version)"
    fi
else
    warn "Node.js not found — installing Node 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node.js $(node --version) installed"
fi

# =============================================================================
# STEP 2 — Python packages
# =============================================================================
section "Step 2 — Python packages"

info "Installing numpy, scipy, matplotlib via apt…"
sudo apt-get install -y \
    python3-numpy \
    python3-scipy \
    python3-matplotlib
# NOTE: python3-websockets is intentionally NOT installed via apt on Ubuntu 22.04.
# The jammy repo ships websockets 10.1, which is API-incompatible with rade_helper.py
# (requires >= 11.0). We install a known-good version via pip below.

# pip is only needed for torch.
# Do NOT guess support from version number alone; detect the actual flag.
PIP_VER=$(pip3 --version 2>/dev/null | awk '{print $2}' || echo "unknown")
PIP_FLAGS=""

if pip3 install --help 2>/dev/null | grep -q -- '--break-system-packages'; then
    info "pip ${PIP_VER} supports --break-system-packages"
    PIP_FLAGS="--break-system-packages"
else
    warn "pip ${PIP_VER} does NOT support --break-system-packages — installing without it"
fi

# Check if websockets >= 11.0 is already installed before installing
if python3 -c "import websockets; v=tuple(int(x) for x in websockets.__version__.split('.')[:2]); assert v >= (11,0)" 2>/dev/null; then
    WS_VER=$(python3 -c "import websockets; print(websockets.__version__)")
    ok "websockets ${WS_VER} already installed and satisfies >= 11.0 — skipping"
else
    info "Installing websockets >= 11.0 via pip (apt version on Ubuntu 22.04 is too old)…"
    if [[ -n "$PIP_FLAGS" ]]; then
        pip3 install $PIP_FLAGS "websockets>=11.0"
    else
        pip3 install "websockets>=11.0"
    fi
fi

# Check if torch is already installed before downloading
if python3 -c "import torch" 2>/dev/null; then
    TORCH_VER=$(python3 -c "import torch; print(torch.__version__)")
    ok "torch ${TORCH_VER} already installed — skipping download"
else
    info "Installing torch CPU wheel (this may take a few minutes)…"
    if [[ -n "$PIP_FLAGS" ]]; then
        pip3 install $PIP_FLAGS torch --index-url https://download.pytorch.org/whl/cpu
    else
        pip3 install torch --index-url https://download.pytorch.org/whl/cpu
    fi
fi

info "Verifying Python imports and versions…"
if python3 -c "
import websockets, matplotlib, torch, numpy, scipy
v = tuple(int(x) for x in websockets.__version__.split('.')[:2])
assert v >= (11, 0), f'websockets {websockets.__version__} too old — need >= 11.0'
print(f'websockets {websockets.__version__}  ✓')
print(f'torch      {torch.__version__}  ✓')
print(f'numpy      {numpy.__version__}  ✓')
print('All OK')
"; then
    ok "All Python packages verified"
else
    error "One or more Python packages failed to import or version check — check output above"
    exit 1
fi


# =============================================================================
# STEP 3 — Clone / update the radae repository
# =============================================================================
section "Step 3 — radae repository"

if $NEED_CLONE; then
    info "Cloning radae from GitHub…"
    git clone https://github.com/drowe67/radae.git "$RADAE_DIR"
    ok "Clone complete"
else
    info "Pulling latest changes…"
    cd "$RADAE_DIR"
    git pull
    ok "Repository up to date"
fi

# ── Build ─────────────────────────────────────────────────────────────────
if $NEED_BUILD; then
    info "Building radae (lpcnet_demo and friends)…"
    cd "$RADAE_DIR"
    mkdir -p build && cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j"$(nproc)"

    if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
        ok "lpcnet_demo built successfully"
        ls -lh "$RADAE_DIR/build/src/lpcnet_demo"
    else
        error "Build completed but lpcnet_demo not found — check cmake/make output above"
        exit 1
    fi
fi

# ── Model weights check ───────────────────────────────────────────────────
info "Checking for model19_check3 weights…"
if [[ -f "$RADAE_DIR/$MODEL_CHECKPOINT" ]]; then
    ok "Model weights present: $MODEL_CHECKPOINT"
else
    warn "Model weights NOT found at $RADAE_DIR/$MODEL_CHECKPOINT"
    warn "You may need to download them separately — see the radae README."
fi

# =============================================================================
# STEP 4 — Python dependencies (second confirmation, idempotent)
# =============================================================================
section "Step 4 — Python dependencies (already installed in Step 2)"
ok "Nothing more to do"

# =============================================================================
# STEP 5 — Build the PhantomSDR-Plus frontend
# =============================================================================
section "Step 5 — Build PhantomSDR-Plus frontend"

if [[ -d "$PHANTOM_DIR" ]]; then
    if [[ -x "$PHANTOM_DIR/recompile.sh" ]]; then
        info "Running recompile.sh…"
        cd "$PHANTOM_DIR"
        ./recompile.sh
        ok "Frontend rebuilt"
    else
        warn "recompile.sh not found or not executable in $PHANTOM_DIR — skipping"
    fi
else
    warn "$PHANTOM_DIR not found — skipping frontend build"
    warn "Make sure PhantomSDR-Plus is installed before running rade.sh"
fi

# =============================================================================
# STEP 6 — Make rade.sh executable and do a test start
# =============================================================================
section "Step 6 — rade.sh setup"

if [[ -f "$PHANTOM_DIR/rade.sh" ]]; then
    chmod +x "$PHANTOM_DIR/rade.sh"
    ok "rade.sh is now executable"
    info "Starting RADE sidecar…"
    cd "$PHANTOM_DIR"
    ./rade.sh start
    ok "RADE sidecar started"
else
    warn "rade.sh not found at $PHANTOM_DIR/rade.sh — skipping start"
fi

# =============================================================================
# REPORT
# =============================================================================
section "Installation Report"

echo ""
echo -e "  ${GREEN}✔${NC}  System packages       installed / verified"
echo -e "  ${GREEN}✔${NC}  Node.js               $(node --version 2>/dev/null || echo 'n/a')"
echo -e "  ${GREEN}✔${NC}  Python packages       websockets>=11.0(pip) matplotlib torch numpy scipy"
echo -e "  ${GREEN}✔${NC}  radae repository      $RADAE_DIR"

if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
echo -e "  ${GREEN}✔${NC}  lpcnet_demo           $(ls -lh "$RADAE_DIR/build/src/lpcnet_demo" | awk '{print $5, $9}')"
else
echo -e "  ${RED}✘${NC}  lpcnet_demo           NOT FOUND"
fi

if [[ -f "$RADAE_DIR/$MODEL_CHECKPOINT" ]]; then
echo -e "  ${GREEN}✔${NC}  Model weights         model19_check3  ✓"
else
echo -e "  ${YELLOW}!${NC}  Model weights         NOT FOUND — download manually"
fi
echo ""

# =============================================================================
# ROUTER / FIREWALL REMINDER
# =============================================================================
echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}│  ⚠  ROUTER PORT FORWARD REQUIRED                            │${NC}"
echo -e "${YELLOW}│                                                             │${NC}"
echo -e "${YELLOW}│  Forward TCP port  8074  to this machine's LAN IP.          │${NC}"
echo -e "${YELLOW}│  RADE WebSocket clients connect on port 8074.               │${NC}"
echo -e "${YELLOW}│  Without this, remote RADE decoding will NOT work.          │${NC}"
echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# =============================================================================
# TROUBLESHOOTING QUICK REFERENCE
# =============================================================================
cat <<'EOF'
──────────────────────────────────────────────────────────────────────────────
 TROUBLESHOOTING QUICK REFERENCE
──────────────────────────────────────────────────────────────────────────────

▸ radae_rxe.py: error: unrecognized arguments: model_path
    Use --model_name, NOT a positional argument:
      WRONG:   python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth
      CORRECT: python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth

▸ ModuleNotFoundError: No module named 'matplotlib'
      pip3 install matplotlib

▸ ModuleNotFoundError: No module named 'torch'
      pip3 install torch

▸ lpcnet_demo: No such file or directory
      cd ~/radae/build && cmake .. && make -j$(nproc)
      ls src/lpcnet_demo   # should exist now

──────────────────────────────────────────────────────────────────────────────
 UPDATING RADE v1
──────────────────────────────────────────────────────────────────────────────

Standard update (new code, same model):
  cd ~/radae && git pull
  cd build && cmake .. && make -j$(nproc)
  cd ~/PhantomSDR-Plus && ./rade.sh restart

New model weights only (e.g. model20):
  RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start
  # or permanently:  export RADE_MODEL=... in ~/.bashrc

Verify the update:
  ./rade.sh status
  tail -20 ~/PhantomSDR-Plus/rade.log

──────────────────────────────────────────────────────────────────────────────
 UPDATE CHEAT-SHEET
──────────────────────────────────────────────────────────────────────────────
 What changed            │ Action
 ───────────────────────────────────────────────────────────────────────────
 New model .pth          │ Set RADE_MODEL env var, ./rade.sh restart
 radae_rxe.py changed    │ git pull, ./rade.sh restart
 lpcnet_demo C changed   │ git pull, rebuild, ./rade.sh restart
 radae_rxe.py renamed    │ Update RADAE_RX in rade_helper.py
 --model_name renamed    │ Update radae_cmd in rade_helper.py
 New output sample rate  │ Update SPS_OUT in rade_helper.py + audio.js
 RADE v2 new binary      │ Update RADAE_RX in rade_helper.py
──────────────────────────────────────────────────────────────────────────────
EOF

echo ""
ok "install_rade_ubuntu22.sh finished — 73 de SV1BTL"
