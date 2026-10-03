#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-rtlsdr.sh
#  Install what an RTL-SDR stick needs, so that start-rtl.sh can run:
#
#    standard   the distribution's rtl-sdr package (rtl_sdr, rtl_test);
#               apt, dnf, pacman and zypper all call it "rtl-sdr"
#    Blog V4    the RTL-SDR Blog driver built from source — the V4's R828D
#               tuner and its HF upconverter need it; the distribution's
#               package is removed first so the two do not shadow each other
#
#  Both: the kernel's DVB-T driver is blacklisted (while it holds the stick,
#  rtl_sdr cannot open it) and a udev rule lets the receiver run without sudo.
#
#  Used by add-receiver.sh, and can be run on its own on a station that is
#  already installed:
#
#    ./setup-rtlsdr.sh             asks whether the stick is a Blog V4
#    RTL_V4=y ./setup-rtlsdr.sh    Blog V4 driver, no question
#    RTL_V4=n ./setup-rtlsdr.sh    the distribution's driver, no question
#
#  Idempotent — safe to re-run. Run it as your normal user: it calls sudo
#  itself for the parts that need root. The shared steps and the SDR_*
#  overrides are in setup-sdr-common.sh.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

v4="${RTL_V4:-}"
if [ -z "$v4" ]; then
    if [ -t 0 ]; then
        read -r -p "Is the stick an RTL-SDR Blog V4? [y/N] " v4
    else
        v4="n"
    fi
fi

if [[ $v4 =~ ^[Yy] ]]; then
    echo "Setting up the RTL-SDR Blog V4 driver..."

    # The distribution's librtlsdr does not know the V4's tuner; if it stays
    # installed, whichever copy the loader finds first decides what works.
    echo "Removing the distribution's rtl-sdr packages, if any..."
    if command -v apt-get >/dev/null 2>&1; then
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get purge -y '^librtlsdr' rtl-sdr 2>/dev/null || true
    elif command -v dnf >/dev/null 2>&1; then
        $SUDO dnf remove -y 'rtl-sdr*' 'librtlsdr*' 2>/dev/null || true
    elif command -v pacman >/dev/null 2>&1; then
        pacman -Q rtl-sdr >/dev/null 2>&1 && $SUDO pacman -Rdd --noconfirm rtl-sdr || true
    elif command -v zypper >/dev/null 2>&1; then
        $SUDO zypper remove -y rtl-sdr 2>/dev/null || true
    fi

    sdr_install_packages \
        "git cmake build-essential pkg-config libusb-1.0-0-dev" \
        "git cmake gcc gcc-c++ make pkgconf-pkg-config libusb1-devel" \
        "git cmake base-devel pkgconf libusb" \
        "git cmake gcc gcc-c++ make pkg-config libusb-1_0-devel"
    mkdir -p "$SRC_DIR"
    # DETACH_KERNEL_DRIVER lets the library take the stick from the DVB-T
    # driver by itself, so it also works before the blacklist below has had
    # a reboot to take effect.
    sdr_build rtl-sdr-blog https://github.com/rtlsdrblog/rtl-sdr-blog \
        -DINSTALL_UDEV_RULES=ON -DDETACH_KERNEL_DRIVER=ON
    DRIVER_LABEL="RTL-SDR Blog V4 driver (built from source)"
else
    echo "Installing the distribution's rtl-sdr package..."
    sdr_install_packages rtl-sdr rtl-sdr rtl-sdr rtl-sdr
    DRIVER_LABEL="the distribution's rtl-sdr package"
fi

command -v rtl_sdr >/dev/null 2>&1 \
    || die "rtl_sdr is not on PATH after installing $DRIVER_LABEL."
echo ""
green "✅ rtl_sdr installed ($(command -v rtl_sdr)) — $DRIVER_LABEL"

sdr_blacklist_modules /etc/modprobe.d/blacklist-rtl-sdr.conf \
    rtl2832_sdr dvb_usb_rtl28xxu
# The demodulator module stays loaded while the DVB driver used it; it does
# no harm, but unloading it lets the stick be opened without a replug.
$SUDO modprobe -r rtl2832 2>/dev/null || true

sdr_udev_rule /etc/udev/rules.d/70-rtl-sdr.rules \
    "RTL2832U sticks (RTL-SDR, RTL-SDR Blog V3/V4) — allow rtl_sdr to open them without sudo." \
    0bda:2838 0bda:2832

echo ""
green "RTL-SDR ready. Plug the stick in (or replug it), then:"
echo "    rtl_test -t"
if [[ $v4 =~ ^[Yy] ]]; then
    echo "    (a V4 must report: RTL-SDR Blog V4 Detected)"
fi
