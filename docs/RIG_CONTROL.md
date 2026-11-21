# PhantomSDR-Plus — Rig Control (CAT)

Keep **your own transceiver** and a **PhantomSDR-Plus receiver** on the same frequency, mode and filter. Turn the rig's dial and the waterfall follows; click a signal on the waterfall and the rig tunes to it. Key the rig, and the receiver can fall silent so it does not play your own signal back to you.

It works with **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR** receivers, yours or someone else's, and only ever moves *your* listening session — nobody else on the receiver hears or sees a thing. There is nothing for the receiver's operator to install or configure.

---

## What you need

Two ways to connect a rig, and one requirement on the receiver:

| Piece | What it is | Syncs |
|---|---|---|
| **[Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) 4.0 or later** | The desktop application, with a **Rig** menu. Linux (PC and Raspberry Pi) and Windows. | Frequency, mode, filter width, mute on transmit — in either direction or both |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | A separate Windows program that couples a rig to the receiver page in your browser. | Frequency and mode |
| **TCI-CAT on the receiver page** | A button on the PhantomSDR-Plus page itself, in any browser. Talks TCI to ExpertSDR, AetherSDR or Thetis, or to any Hamlib rig through a small bridge. Only on PhantomSDR-Plus receivers running 4.1.0 or later. | Frequency, mode and filter width both ways; mute on transmit |
| **The receiver** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR or UberSDR. A PhantomSDR-Plus receiver needs **4.1.0** or later for filter width and mute. | An older PhantomSDR-Plus still syncs frequency and mode |

Most of this manual describes Desktop PhantomSDR+. The TCI-CAT button has its own section, [TCI-CAT on the receiver page](#tci-cat-on-the-receiver-page). The CATsync Tool has its own documentation on its website.

---

## Supported receivers

The app recognises the kind of receiver in a station window and drives it through that page's own controls. The Rig control window shows which kind it found next to the station's name.

| Receiver | Frequency and mode | Filter width | Mute on transmit |
|---|---|---|---|
| PhantomSDR-Plus | Yes | With 4.1.0 or later | With 4.1.0 or later |
| KiwiSDR (including Web-888) | Yes | Yes | Yes |
| PA3FWM WebSDR | Yes, switching band on a multi-band site | Yes | Yes |
| UberSDR | Yes | Yes | Yes |

A web receiver has fewer modes than most rigs, so some rig modes share one receiver mode: KiwiSDR and WebSDR have a single CW for both CW and CW-R. The receiver modes named in this manual are PhantomSDR-Plus's; the other receivers use their nearest equivalent. A WebSDR keeps a CW filter under 1 kHz and other filters at 1 kHz or wider, because that is how the page itself tells CW apart, and a frequency outside every band a WebSDR site covers is left alone. UberSDR sets its filter in slider steps, so a width can land up to about 50 Hz from the rig's. Any other kind of page — OpenWebRX, for example — shows *not a receiver this app can drive*, and nothing is synced.

---

## What it does, and what it does not

- It syncs **one rig with one receiver window** at a time.
- It reads both sides several times a second and, when they disagree, sets one to match the other. It does **not** transmit, key the rig, or send audio anywhere.
- Moving the receiver changes only your own session. Other listeners on the same receiver are not affected, and the receiver's operator does not have to allow it.
- A serial port can be opened by **one program at a time**. If WSJT-X, a logger or a manufacturer's utility already has the rig's port, use the **flrig** or **rigctld on network** choice to share the rig instead of fighting over the port.

---

## Quick start

1. Open a station in Desktop PhantomSDR+ as usual.
2. **Rig → Rig control...**
3. Under **Connection**, choose **Built-in** if your rig is in the list, otherwise **Hamlib (all rigs)**.
4. Pick your rig, the serial port, and the speed your rig's own CAT or CI-V menu is set to.
5. Under **Sync**, leave **Both directions** selected.
6. Press **Connect**. The two readouts at the top — transceiver and receiver — should show the same frequency within a second.

Every setting is saved as you change it. Next time, **Rig → Connect** is enough, or tick **Connect when the app starts**.

---

## Choosing how to reach the rig

| Choice | Use it when | Needs |
|---|---|---|
| **Built-in** | Your rig is in the list below. | Nothing else |
| **Icom LAN / WiFi** (Desktop 6.0) | Your Icom is on the network: an IC-705 over WiFi, or an IC-7300MK2, IC-7610, IC-9700, IC-905, IC-R8600, IC-7760, IC-785x over its LAN port. | The radio's IP address, its Network User ID and password, *Network Control* ON |
| **Hamlib (all rigs)** | Your rig is anything else — Hamlib knows more than 300 rigs. The app starts Hamlib's `rigctld` for you, on a private local port, and stops it when you disconnect. | Windows: nothing, Hamlib is included. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | A `rigctld` is already running, on this computer or another one on your network. | The host and port (4532 by default) |
| **flrig** | flrig already controls the rig for fldigi, WSJT-X or a logger. | flrig running, with its XML-RPC port (12345 by default) |

### Rigs with a built-in driver

The speed and CI-V address shown are the factory defaults the app fills in. **They are only a starting point — set them to what your rig's menu says.**

| Family | Rigs | Default speed | Notes |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7300MK2, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600, and any other CI-V rig | 19200 | CI-V address filled in per model (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Address `70`; check the rig's menu |
| **Yaesu new CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu classic CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bits; tunes in 10 Hz steps |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Filter width syncs |
| **Kenwood-compatible** | FlexRadio SmartSDR CAT (virtual port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, other Kenwood-compatible rigs | 9600–38400 | |

**Fastest speed first (Desktop 6.0).** An Icom is connected at 115200 baud first, then at the speed set in the panel, then at 19200, 9600, 38400, 57600 and 4800; the speed that answers is kept. A rig whose *CI-V USB Baud Rate* is *Auto* keeps the first speed it hears after power-on, and the rig waterfall needs the fast one. Hamlib likewise tries 115200 first for the IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610 and IC-7760.

A rig that ought to be compatible but will not talk to a built-in driver usually works with **Hamlib**, which copes with far more variations.

---

## Serial settings

| Setting | What to put there |
|---|---|
| **Serial port** | The rig's port. USB adapters and rigs with a USB port are listed first. **Other / network address...** takes a port the list does not show — `COM7`, `/dev/ttyUSB1` — or `tcp://host:port` for a serial port served over the network by ser2net or similar. |
| **Speed (baud)** | Exactly what the rig's CAT / CI-V baud-rate menu says. A mismatch looks like a rig that never answers. |
| **Stop bits** | 1 for almost everything; 2 for the FT-817/857/897 family. |
| **CI-V address** | Icom only, in hexadecimal (`94`, not `148`). Must match the rig's CI-V address menu. |
| **DTR / RTS** | Leave **off** unless your interface needs them. Many CAT cables key the transmitter, or reset the rig, on one of those lines. |
| **Hardware flow control** | Leave off unless the rig's manual asks for RTS/CTS. |

For **Hamlib** the same settings are passed on to `rigctld`. Stop bits there has a *Rig default* choice, and **Extra rigctld options** takes anything else `rigctld` accepts, for example `--set-conf=post_write_delay=10`. **rigctld program** lets you point at a particular `rigctld` if you have more than one installed.

---

## Sync

### Direction

| Choice | What happens |
|---|---|
| **Rig → receiver** | The receiver window follows the rig. A change made on the waterfall is put back to the rig's frequency. |
| **Receiver → rig** | The rig follows the receiver window. Turning the rig's dial is undone. |
| **Both directions** | Whichever side you touched **last** wins. At the moment you connect, before either has been touched, the rig wins. |

The direction can also be changed from the **Rig** menu while connected.

### Which receiver window

**Receiver window** chooses which station follows the rig:

- **The station window last in front** (default) — with two stations open, click into one and the rig follows that one.
- **A particular station** — pin the rig to it, whether or not it is in front. If that station is not open, nothing is synced until it is.

### Update rate

**Update every** sets how often both sides are read: 150 ms, 300 ms (default), 500 ms or 1 s. Faster feels more immediate on the dial; slower is kinder to an old rig at 4800 or 9600 baud, where each read takes real time on the wire.

---

## Modes

| Rig mode | Receiver listens in |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (reverse) | CW-L |
| AM, synchronous AM, DSB | AM |
| FM, narrow FM | FM |
| Wide FM | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Data modes (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Data LSB, data FM | LSB, FM |

| Receiver mode | Rig is set to |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — most HF rigs refuse it, and are left alone after two tries |
| RADE (upper / lower) | USB / LSB |

A rig in a **data mode** stays in it: the receiver's USB is treated as agreeing with the rig's USB-D, so the receiver never knocks the rig out of data mode.

---

## Filter width

Tick **Sync filter width** to keep the passbands matched. Two differences of less than 60 Hz are treated as equal, since no two filters step alike.

| Rig connection | Filter width |
|---|---|
| Hamlib | Yes, where Hamlib supports it for that rig |
| flrig | Yes |
| Built-in Icom CI-V | Yes — 50 Hz steps up to 500 Hz, then 100 Hz steps up to 3.6 kHz; AM in 200 Hz steps up to 10 kHz; not in FM |
| Built-in Elecraft | Yes, in 10 Hz steps |
| Built-in Kenwood, Yaesu, FT-817 family | No — these rigs select filters from per-model tables. Use Hamlib if you need the filter |

KiwiSDR, WebSDR and UberSDR receivers always have the control. A PhantomSDR-Plus receiver must run **4.1.0** or later; on an older one frequency and mode still sync, and the Rig control window says why the filter does not.

---

## Mute while transmitting

Tick **Mute receiver while transmitting**. While the rig is keyed the receiver window is muted, and when it is unkeyed the sound comes back. The receiver's own mute button shows it, and you can still unmute by hand.

If you had already muted the receiver yourself, it is left muted afterwards too.

It needs a rig connection that reports transmit state — all the built-in drivers, flrig, and Hamlib for most rigs — and, on a PhantomSDR-Plus receiver, 4.1.0 or later.

---

## Frequency offset

**Frequency offset** is added to the rig's frequency to get the receiver's:

> receiver frequency = rig frequency + offset

| Setup | Offset |
|---|---|
| 2 m transverter on a 10 m rig (144.100 MHz shows as 28.100 MHz) | `116000000` |
| 70 cm transverter on a 2 m rig (432 → 144) | `288000000` |
| No transverter | `0` |

---

## The Rig menu

| Item | Does |
|---|---|
| **Rig control...** | Opens the Rig control window |
| **Connect / Disconnect** *rig name* | Starts or stops the sync; for Hamlib this also starts or stops `rigctld` |
| **Power on / Power off...** (Desktop 6.0) | Switches the rig on over CAT and connects, or (after asking) switches it off and releases it. Not over flrig, not for Elecraft |
| **Show rig waterfall and S-meter** (Desktop 6.0) | Shows or hides the rig's own waterfall and S-meter across the top of the receiver window - offered while a rig is connected |
| **Rig to receiver / Receiver to rig / Both directions** | Sync direction |
| **Sync filter width** | On / off |
| **Mute receiver while transmitting** | On / off |
| Status line | *Not connected*, *Connecting...*, *Connected: rig name*, or the last error |

---

## Rig waterfall and S-meter

*Rig → Show rig waterfall and S-meter* (offered while a rig is connected) - or the button of the same name in the Rig control window - puts a strip across the top of the receiver window, above the station's page. The page moves down to make room and keeps its own layout.

- **The waterfall** is your transceiver's own spectrum scope, as the rig sends it over CAT: an Icom IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760, over the **Built-in** or **Icom LAN / WiFi** connection. Through Hamlib or flrig the strip shows the S-meter only, because `rigctld` and flrig cannot pass the scope stream on.
- **Colours** are the station's own: on a PhantomSDR-Plus station the strip uses the colour scheme chosen in the page and follows it when you change it. Other receivers (UberSDR, KiwiSDR, WebSDR) get PhantomSDR's default colour scheme, so the strip looks the same on every station. The **Brightness** slider, before it, sets how much of the band comes into colour: left keeps weak signals dark, right brings them in and then the noise. The **Contrast** slider sets how strongly signals stand out from the noise; it is remembered.
- **Click** on the strip to tune the rig there; the receiver follows through the sync. The red line is the rig's frequency.
- **▴ ▾** make the strip lower or taller, **✕** hides it.
- **The S-meter** is the rig's own, drawn like PhantomSDR's digital S-meter: cyan segments up to S9, red above, on the S1 … +60 dB scale, with the reading beside it; *TX* in red while it transmits.

An IC-7300 sends about 4 sweeps a second over CI-V even at its FAST scope speed; that is the rig's limit, and the strip scrolls smoothly between them. The scope needs the fast CI-V speed: set the rig's *CI-V USB Baud Rate* to 115200 or *Auto*.

**Icom LAN / WiFi.** On the radio: put it on your network (IC-705: *MENU › SET › WLAN Set*), set *Network Control* to ON, and give it a *Network User1 ID* and *Password* (*Remote Settings*). In Rig control choose **Icom LAN / WiFi**, pick the rig, and enter its IP address, the user ID and the password (kept encrypted on this computer). The radio takes one remote program at a time, so close wfview or RS-BA1 first.

---

## Linux

**Serial port permission.** Serial ports belong to the `dialout` group. A user outside it gets *Could not open ttyUSB0*. Add yourself once, then log out and back in:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Install it from your distribution:

```bash
sudo apt install libhamlib-utils
```

The `.deb` package of Desktop PhantomSDR+ recommends it, so `sudo apt install ./phantomsdr-plus-desktop_6.0.0_amd64.deb` brings it along; `dpkg -i` does not install recommended packages. The built-in drivers and flrig need no Hamlib.

## Windows

Hamlib's own `rigctld.exe` is included in both the 64-bit and the 32-bit installer. COM ports appear in the port list by name (`COM3`). If a rig's USB driver is needed, install the manufacturer's driver first — the port does not exist until it is.

---

## TCI-CAT on the receiver page

A PhantomSDR-Plus receiver page can also follow a transceiver **by itself**, with no desktop application: the browser talks straight to a **TCI** server on your own computer. TCI is the WebSocket control protocol of ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) and Thetis (Apache Labs ANAN, Hermes). For a rig without TCI, a small bridge included with PhantomSDR-Plus makes any Hamlib rig look like a TCI server. Since 6.0.0 it can also reach the rig without any TCI software, straight over its USB cable — see *Direct USB* below.

It needs a PhantomSDR-Plus receiver running **4.1.0 or later**. KiwiSDR, WebSDR and UberSDR pages do not have it. Direct USB needs 6.0.0 or later.

### The TCI-CAT button

The button sits in the row with **VFO**, **Modes**, **Bands** and **IF Filters** — **TCI-CAT** in the wide layout, **CAT** in the compact one. Its dot is **green** while a TCI server is connected and **grey** otherwise. It opens a window with: Until 4.2.0 the button was labelled **QRG Sync**. Choosing **Direct USB** changes the window's title to *CAT control via USB*. **CAT Sync**, **Split** and **Mute on TX** sit on one line at the bottom.

| Control | What it does |
|---|---|
| **Connection** | **TCI** — the TCI server or bridge described here — or **Direct USB**, the rig straight over its USB cable (see *Direct USB* below) |
| Status | *Active — TCI (port 50001)* when connected; *Inactive* with ⏳ *Wait* while it searches |
| **CAT Sync** | Frequency, mode and filter sync on or off. Switched on while a rig is connected, it brings the page to the rig's frequency, mode and filter at once |
| **Host** | The computer running the TCI server: `localhost` for this computer, or its address on your network, e.g. `192.168.1.42`. Press Enter or click away to reconnect |
| **Split** | Shown while a rig is connected. On: tuning the page leaves the rig where it is, while the rig still moves the page. Off (default): the rig follows the page, and is brought to it the moment Split is switched off |
| **Mute on TX** | Shown while a rig is connected. On (default): the page falls silent while the rig transmits, with a red **TX** tag; off: the receiver keeps playing |
| **Rig scope** | Direct USB with a rig that sends its scope over CI-V (IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760): the rig's own scope as a waterfall strip under the receiver's — see *Direct USB* below |
| **Rig S-meter** | Direct USB with a rig that has no scope a browser can read — a Yaesu new-CAT rig (FT-710, FT-991A, FTDX10, FTDX101, ...) or an Icom without a scope stream (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100): the rig's own S-meter under the receiver's waterfall, but no waterfall — see *Direct USB* below |

Nothing needs choosing beyond that: ports **50001** (ExpertSDR3, AetherSDR) and **40001** (ExpertSDR2, Thetis) are tried at the same time and retried every few seconds, so the page connects as soon as the software starts. **CAT Sync** and **Host** are remembered by the browser. **Split** and **Mute on TX** are remembered too.

Browsers that ask before a web page may reach your local network — recent Chrome and Edge do — ask once, the first time the page connects. Allow it, or the dot stays grey.

### What is kept in step

| | Behaviour |
|---|---|
| **Rig → receiver: frequency** | Only the dial moves. Zoom, brightness and contrast stay as you left them; the waterfall scrolls only when the frequency is off screen, and the band plan does not change the mode |
| **Rig → receiver: mode** | Follows when the rig's mode changes — USB, LSB, CW, AM, FM; data modes as USB or LSB. A mode the receiver lacks leaves it alone. A running decoder keeps its own mode |
| **Rig → receiver: filter width** | The receiver's passband takes the rig's filter width: turning the rig's filter, or pressing its **FIL** button, changes the passband. A running decoder keeps its own passband |
| **Receiver → rig: frequency** | Typing a frequency, a label or bookmark, a click on the waterfall and a passband drag all move the rig's VFO. A drag sends only changed frequencies |
| **Receiver → rig: mode** | Every mode change on the page — a mode button, the band plan, a decoder, a bookmark — sets the rig's mode (USB, LSB, CW, AM, FM; RADE as USB or LSB). A rig in a data mode (USB-D) stays in it |
| **Receiver → rig: filter width** | The **IF Filters** buttons, the IF slider, a passband drag and a mode change all set the rig's filter; a drag sends only the width it settles on. On Icom rigs the bridge selects FIL1, FIL2 or FIL3 instead — see [Icom filters](#icom-filters-fil1-fil2-fil3) |
| **No echo** | A change that came from the rig is never sent back to it, and a report of the rig's previous mode or filter that arrives just after the page changed it is ignored |
| **Mute on transmit** | The **Mute on TX** switch, on by default and working with CAT Sync off too: the page falls silent while the rig transmits. Moving the volume slider during transmit keeps it silent; on receive the sound returns at the slider's current level |
| **Not handled** | VFO B, RIT/XIT and transverter offsets; only VFO A of the first receiver is followed. **Split** only stops the page from moving the rig |

### Which transceivers it works with

| Transceiver | Works | How |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Yes | Directly — enable the TCI server in the software. Not yet tried with these programs; tested against a simulated TCI server |
| A radio with a CAT port that Hamlib supports — most Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Yes | Through the Hamlib bridge below. Tried on an **Icom IC-7300**, on Linux and Windows; other drivers may differ in mode names or in reporting PTT |
| A radio with a CAT port on USB — Icom and Xiegu CI-V, Yaesu, Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 | Yes | With **Direct USB** below, no other software — in Chrome, Edge, Opera or Firefox 151+ on an https:// page. Tried on an **Icom IC-7300** |
| A radio with no CAT port, or one Hamlib does not support | No | There is nothing to read the frequency from |

### Direct USB (no TCI software, no bridge)

Since 6.0.0 the window has a second connection, **Direct USB**: the page talks to the transceiver itself over its USB cable, through the browser's Web Serial. Nothing else runs on your computer — no TCI software, no Hamlib, no bridge.

| Needs | |
|---|---|
| Browser | Chrome, Edge or Opera, or Firefox 151 or newer, on a desktop computer. Safari and phone browsers have no Web Serial |
| Page address | `https://`, or `http://localhost` on the station computer. On a plain `http://` address the browser hides Web Serial, so **Direct USB** is greyed out with the reason; TCI with the bridge, or Desktop PhantomSDR+, remain the way to go |
| The rig | A CAT port on USB: Icom and Xiegu (CI-V), Yaesu (new CAT and FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 — 54 models. On Linux your user must be in the `dialout` group |

1. Open **TCI-CAT** and choose **Connection: Direct USB**.
2. Choose the **Rig**. Its usual **Baud** rate and, on an Icom, its **CI-V** address are filled in; change them to match the rig's own menu.
3. Click **Choose port…** and pick the rig's USB port in the browser's list. Firefox first asks once to allow serial access for the site. The browser remembers the port for this receiver.
4. Switch **CAT Sync** on. The port opens and the page goes to the rig's frequency, mode and filter.

| Setting | What it does |
|---|---|
| **Rig** | 54 models by maker, the **IC-7300MK2** among them; **Other CI-V rig** or **Other Kenwood-compatible rig** for one that is not listed |
| **Baud** | Filled in from the rig list (115200 for the scope Icoms) and kept from the last connection. Those Icoms are always tried at 115200 first; a rig that does not answer at the set speed is looked for at 115200, 19200, 57600, 38400, 9600 and 4800, and the speed that answers is kept |
| **CI-V** | Icom only: the rig's address in hex — `94` for the IC-7300, `B6` for the IC-7300MK2 |
| **SSB FIL1/2/3** | Icom only: the widths of the rig's three SSB filters, `2700,2400,1800` by default |
| **Lines: DTR, RTS** | Off by default. On many CAT cables DTR or RTS keys the transmitter or resets the rig — tick them only if your interface needs them |

| Button | What it does |
|---|---|
| **Choose port…** | Picks the USB port (asked once; later visits find it again) |
| **Connect** / **Disconnect** | Opens or closes the port. While it is closed, WSJT-X or a logger can use the rig |
| **⏻ Power on** | Shown while not connected: switches the rig on over CAT, waits up to 15 seconds for it to answer, then connects. The rig's power supply must stay on |
| **⏻ Power off** | Shown while connected: after a confirmation, switches the rig off and frees the port |

- The port opens by itself only while **CAT Sync** is on — when the page loads, and when CAT Sync is switched on after a Disconnect or a lost link. Opening the window alone never takes the rig away from another program.
- Frequency, mode and filter follow both ways as in the table above. On Icom rigs a passband change only **selects** the nearest of FIL1/FIL2/FIL3 by the widths in **SSB FIL1/2/3**; the rig's own filter widths are never changed.
- Icom, Kenwood and Yaesu (new and old CAT) can be switched both on and off. Elecraft rigs switch on only through their POWER ON line, so they can only be switched off here and have no **⏻ Power on**.
- Pulling the cable or switching the rig off shows *Link lost*; plugging it back in reconnects by itself.
- **Rig scope.** With a scope rig connected, the **Rig scope** switch shows the rig's own scope as a waterfall strip under the receiver's waterfall, each sweep under the same frequencies as the waterfall above, so a signal lines up in both — the station's antenna above, yours below. Outside the rig's span the strip stays dark, its label shows the rig's span, and a click tunes there. The rig's own span, centre/fixed mode and reference level decide what arrives. The scope needs **115200** baud (at 19200 it manages 2–3 sweeps a second, and the window says so); the stream stops on Disconnect and when the page closes. Zoom the receiver to the band: on the whole 0–30 MHz view a ±25 kHz span is only a couple of pixels wide. Tried on an IC-7300. At the strip's lower left the rig's own **S-meter** shows what your antenna hears on the dial frequency — S-units as the rig reports them (S9 at the middle of its bar, +20/+40/+60 above, a short peak hold, *TX* while the rig transmits), not dBm; it is read only while the Rig scope is on.
- **Rig S-meter (Yaesu and older Icoms).** With a Yaesu new-CAT rig, or an Icom that does not stream a scope over CI-V (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100), the switch reads **Rig S-meter** and shows a short bar under the receiver's waterfall with the rig's own S-meter (S1 … S9+60, *TX* while it transmits). It is read over CAT only while the bar is shown — `SM0` on a Yaesu, CI-V `15 02` on an Icom — at the baud rate set in the rig's menu; the switch never changes it, and no scope command goes to these rigs. There is no waterfall, and the window says why: these Icoms do not send a scope over CI-V, and Yaesu rigs do not send theirs over CAT. The FT-710's goes through a separate FTDI chip in the USB cable, which a browser cannot open; [Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) reads that chip and shows the FT-710's waterfall. The Yaesu meter was checked against a real FT-710: within about 0.5 dB of the rig's own meter. Kenwood, Elecraft, the FT-817/857/897 and the other rigs in the list sync frequency, mode and PTT only.
- **IC-7300 on Auto.** With **CI-V USB Baud Rate** on *Auto*, the IC-7300 keeps the first speed it hears after power-on and ignores a later change in either direction. The page therefore reaches the scope Icoms at 115200 first, also with **⏻ Power on**; a fixed **115200** in the rig's menu avoids the question altogether.
- **Rigs with two USB ports.** The IC-705 and IC-905 show *Serial Port A (CI-V)* and *Serial Port B*, the IC-7610 and IC-9700 an *Enhanced* and a *Standard COM Port*, all with the same USB IDs. Choose the CI-V one — Port A, or the Enhanced port; Windows lists Port B first. If the chosen port does not answer, the page tries the rig's other port by itself and keeps the one that answers.
- **IC-705 on Windows.** Icom's USB driver for the IC-705 blocks the way browsers read a serial port: Edge and Firefox freeze, and the port stays busy until the cable is replugged. The page therefore does not open an IC-705 on Windows; use **Connection: TCI** with the Hamlib bridge (`rigctl -m 3085 -r COM6 -s 115200`, COM6 being Port A) or Desktop PhantomSDR+. On Linux the IC-705 uses the kernel's own driver.
- Tried on an **Icom IC-7300**: frequency, mode, filter, mute on transmit, Power on and Power off.

### The Hamlib bridge (IC-7300 and other rigs without TCI)

`tci-bridge/tci-rigctld.mjs` in the PhantomSDR-Plus tree turns any radio that Hamlib can control into a TCI server for the page. It runs on **your** computer — the one wired to the radio, next to the browser — not on the receiver. Four times a second it asks Hamlib for frequency, mode, filter width and transmit state, sends the page only what changed, and passes the page's frequency, mode and filter changes to the rig.

It reaches Hamlib in one of two ways:

| Way | Chain | Use it when |
|---|---|---|
| **`--rigctl`** (recommended) | transceiver → `rigctl` → `tci-rigctld.mjs` → page | Normally. The bridge starts Hamlib's `rigctl` itself: one window, no network port. **Use this on Windows**, where `rigctld.exe` is often refused with *Access is denied* |
| **`rigctld`** | transceiver → `rigctld` → `tci-rigctld.mjs` → page | Another program, such as WSJT-X, must use the radio at the same time — see [Sharing the radio](#sharing-the-radio-the-rigctld-way) |

**What it needs**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, or your distribution's hamlib package | `hamlib-w64-….zip` from [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), extracted to `C:\hamlib` — `rigctl.exe` is in `C:\hamlib\bin` |
| Node.js | 18 or newer | The LTS *Windows Installer (.msi)* from [nodejs.org](https://nodejs.org), with the default options |
| The `ws` package | Found automatically inside the PhantomSDR-Plus tree | Copy `tci-rigctld.mjs` to a folder such as `C:\tci-bridge` and run `npm install ws` there once |
| The radio's port | `ls /dev/serial/by-id/`. Join the `dialout` group once: `sudo usermod -aG dialout $USER`, then log out and back in | Install the radio's USB driver from the manufacturer; the COM number is in **Device Manager → Ports (COM & LPT)** |

Only one program can hold the rig's CAT port. Close WSJT-X, flrig, JS8Call, RS-BA1 or Desktop PhantomSDR+'s rig connection before starting the bridge.

#### Example: Icom IC-7300

On the radio: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Hamlib's model number for the IC-7300 is `3073`.

**Linux.** The radio is the line containing `IC-7300` in `ls /dev/serial/by-id/`, usually also `/dev/ttyUSB0`.

1. Check that Hamlib reaches the radio — it must print the frequency, e.g. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Start the bridge and leave it running:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** The radio appears in Device Manager as *Silicon Labs CP210x USB to UART Bridge (COM4)* — use your own COM number. In a Command Prompt:

1. Check that Hamlib reaches the radio — it must print the frequency:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Start the bridge and leave the window open:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   The line is long: make sure it really ends in `-s 115200`, or `rigctl` stops with *Type: rigctl --help*.

On both systems the bridge prints, within a second:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Then open the receiver page in a browser on the same computer, open **TCI-CAT** and switch **CAT Sync** on. The dot turns green and the bridge prints `page connected`. Turn the VFO and the receiver follows; click the waterfall and the radio follows (`page -> rig ... Hz`); key the radio and the page goes silent. **Ctrl+C** stops the bridge, and `rigctl` with it.

Everything after `--rigctl` is the `rigctl` program and its own options — exactly the ones that worked in the check. That is the rule for every rig: **when `rigctl … f` prints the frequency, the bridge works with the same options.**

#### Icom filters (FIL1, FIL2, FIL3)

Icom rigs such as the IC-7300 do not take just any filter width: they have three filters, **FIL1**, **FIL2** and **FIL3**, each with a width set in the rig's menu. Given a width, Hamlib would select one of them and also overwrite its width — and on the IC-7300 that width can land on the filter selected before, scrambling the rig's settings. So for Icom rigs the bridge never sends a width: it picks the filter whose reference width is nearest to the page's passband and only **selects** it, with the rig's own CI-V command. The widths set on the rig are never changed.

| Mode | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (and their data modes) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

On the IC-7300 (`-m 3073`) this is automatic. Set the rig's SSB filters to match — FIL1 2.7 kHz, FIL2 2.4 kHz, FIL3 1.8 kHz (hold **FIL** on the radio) — and choosing 2.7 / 2.4 / 1.8 kHz in **IF Filters** selects FIL1 / FIL2 / FIL3, while pressing **FIL** on the radio sets the page's passband to that filter's width. The bridge prints, for example, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`. The IC-7300MK2 (`-m 3094`) is treated the same way, at its own CI-V address B6h; it needs a Hamlib version that knows the MK2.

| Option | Use |
|---|---|
| `--filters 3000,2400,1800` | Other SSB reference widths, in the order FIL1,FIL2,FIL3; also switches filter selection on for another Icom rig |
| `--civ A4` | The rig's CI-V address in hex, when it is not `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Send widths through Hamlib instead, as for other makes |

Both options go before `--rigctl`, e.g. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Tried on an IC-7300 only. Other makes — Yaesu, Kenwood, Elecraft and the rest — receive the page's width through Hamlib, which sets it as closely as the rig allows.

#### Other rigs

The same steps work for any rig Hamlib supports; only the options change.

1. **Prepare the rig.** In its menu, note the CAT (or CI-V) speed, and switch on any *CAT over USB* or *CI-V transceive* setting it has. On Windows, install the manufacturer's USB driver.
2. **Find the Hamlib model number** in the list `rigctl -l` prints:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Find the port.** Linux: `ls /dev/serial/by-id/`. Windows: Device Manager. Some rigs create **two** ports — Yaesu's FT-991A, FTDX10 and FT-710 name them *Enhanced* and *Standard*; CAT is on the **Enhanced** one.
4. **Check, then start the bridge** with `-m <model> -r <port> -s <speed>`, as in the IC-7300 example: first `rigctl -m … -r … -s … f`, then the same options after `--rigctl`.

Some model numbers, from Hamlib 4.5 — confirm them with `rigctl -l`, as another Hamlib version may number a rig differently:

| Rig | `-m` | Rig | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Extra options, only when needed:

- **An Icom rig with a changed CI-V address:** add `-c` and the address in *decimal* — `94h` is `-c 148`.
- **A setting Hamlib offers for that rig:** `rigctl -m <model> -L` lists them; set one with `-C name=value`, e.g. `-C post_write_delay=10` for a slow interface.
- **A rig that keys up or resets when the port opens:** some CAT cables use DTR or RTS for PTT; add `-C dtr_state=OFF -C rts_state=OFF`.

#### Rigs run by other software

Some radios are already run by a program that can do the job — sometimes with no bridge at all. None of these has been tried.

| Radio and program | What to do |
|---|---|
| **SunSDR** with ExpertSDR2/3, **FlexRadio** with AetherSDR, **Apache Labs ANAN / Hermes** with Thetis | No bridge. Switch on the program's **TCI server** and use **TCI-CAT** directly — ports 50001 and 40001 are found automatically |
| **FlexRadio** with SmartSDR (Windows) | Add a port in **SmartSDR CAT**. It speaks Kenwood CAT, so a serial port there works as a TS-2000: `-m 2014 -r COM8 -s 57600`. A TCP port works with Hamlib's FlexRadio model: `-m 2036 -r 127.0.0.1:<port>` |
| **Any rig controlled by flrig** | Leave flrig running and use Hamlib's flrig model; the rig stays shared with fldigi, WSJT-X and loggers: `-m 4 -r 127.0.0.1:12345` |
| **A running rigctld**, or a program offering a *Hamlib NET rigctl* server | Start the bridge without `--rigctl`, with that address: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

As everywhere, the options go after `rigctl` for the check and after `--rigctl rigctl` for the bridge. A network address such as `127.0.0.1:12345` needs no `-s`.

#### Sharing the radio: the rigctld way

When WSJT-X or a logger must use the radio while the bridge runs, start Hamlib's server `rigctld` with the same options, leave it running, and connect both programs to it:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Without `--rigctl` the bridge looks for `rigctld` at `127.0.0.1:4532` and prints `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` uses a `rigctld` on another computer. In WSJT-X choose rig *Hamlib NET rigctl* at the same address. On Windows the server is `C:\hamlib\bin\rigctld.exe` with the same options; if Windows answers *Access is denied*, use `--rigctl` and close the other program while the bridge runs.

**Ports.** The bridge serves TCI on port 50001; another port goes first on the command line, e.g. `node tci-rigctld.mjs 40001 --rigctl …`. If the bridge and the browser are on different computers, put the bridge computer's address in **Host**.

### TCI-CAT troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Dot stays grey | TCI server or bridge not running; wrong **Host**; the browser's local-network permission was refused | Enable TCI in ExpertSDR/Thetis/AetherSDR, or start the bridge; check **Host**; allow local network access in the site settings |
| `rigctl … f` gives an error or waits | Wrong port or speed; no `dialout` permission (Linux) or no USB driver (Windows); another program has the port | Match `-s` to the rig's menu; check the port (`ls /dev/serial/by-id/`, Device Manager); close other rig programs |
| Bridge prints *rigctl stopped … Type: rigctl --help* | The command is incomplete — usually the speed after `-s` is missing | Type the whole line again |
| Bridge prints *The value after -s is missing* | The command line was cut short when it was pasted | Type the end of the line again, e.g. `-s 115200` |
| The filter does not follow in one direction or the other | **CAT Sync** is off, a decoder is running on the page, or (IC-7300) the rig's FIL widths differ from 2700 / 2400 / 1800 Hz | Switch CAT Sync on; stop the decoder; set the FIL widths on the rig, or give `--filters` with the rig's own widths |
| Bridge prints *rigctl stopped … rig_open: error* | `rigctl` cannot open the port | As for `rigctl … f` above |
| Bridge prints *the rig is not answering* | The port opens but the rig does not reply: wrong speed or model, CAT switched off in the rig's menu, or a changed Icom CI-V address | Repeat the `rigctl … f` check; add `-c` for a changed CI-V address |
| Bridge prints *rigctld not reachable* | Started without `--rigctl`, and no `rigctld` is running | Add `--rigctl …`, or start `rigctld` first |
| `rigctld.exe` says *Access is denied* (Windows) | Windows refuses to run it | Use `--rigctl` — it needs only `rigctl.exe` |
| Connected, but the receiver does not move | **CAT Sync** is off | Switch it on — the page goes straight to the rig's frequency, mode and filter. The mute on transmit works without it |
| The rig does not follow the page | **Split** is on | Switch Split off — the rig is brought to the page at once |
| Rig mode does not follow | A mode the receiver has no equivalent for, or the Hamlib driver reports an unusual name | Frequency still syncs; set the mode on the page |
| No mute on transmit | **Mute on TX** is off, or the rig (or its Hamlib driver) does not report transmit state | Switch **Mute on TX** on; otherwise there is nothing to set on the page |
| The dial jumps back and forth | Desktop PhantomSDR+ or another program is also syncing the rig | Use one controller at a time |
| **Direct USB** is greyed out | The page is on a plain http:// address, or the browser has no Web Serial (Safari, phones, Firefox before 151) | Open the receiver over https://, or use TCI with the bridge |
| *Could not open the port* | Another program (WSJT-X, a logger, the bridge) holds it; on Linux, not in the `dialout` group | Close the other program; `sudo usermod -aG dialout $USER`, then log out and in |
| *The rig did not answer at any usual speed* | The rig is off, or **CI-V** or the rig type does not match | Check them; **⏻ Power on** if it is off |
| *The rig did not switch on* | The rig's power supply is off, or the rig does not wake over CAT | Switch the supply on; check **Baud** and **CI-V** |
| *The rig answers only at 19200 baud, so its scope runs slowly* | The rig's **CI-V USB Baud Rate** is fixed at 19200, or on Auto and kept at 19200 since power-on | Set it to 115200, or switch the rig off and on so that Auto hears 115200 first |
| The browser freezes with an IC-705 (Windows) | Icom's IC-705 driver blocks a browser's serial reads | Replug the USB cable to free the port; use TCI with the Hamlib bridge or Desktop PhantomSDR+ |

---

## For receiver operators

Nothing to configure. Rig control uses a small JavaScript interface every PhantomSDR-Plus page already carries; it involves no server setting, no open port and no admin permission. The filter and mute functions came with version 4.1.0 — after applying it, rebuild the frontend (`./recompile.sh`, option 2); the receiver does not need to be stopped. KiwiSDR, WebSDR and UberSDR receivers need nothing either: the app uses the controls their pages already have.

The **TCI-CAT** button came with 4.1.0 too, again a frontend rebuild only. It opens no port on the receiver: the connection runs from each listener's browser to their own computer. The Hamlib bridge, `tci-bridge/tci-rigctld.mjs`, is for listeners to run at home; the receiver does not use it. The browser opens that connection only after the listener opens **TCI-CAT** or turns **CAT Sync** on (remembered per browser), so over https visitors who never use it see no local-network permission prompt.

**Direct USB** (6.0.0) opens nothing on the receiver either: each listener's browser talks to their own rig over USB. Browsers allow that only on a secure page, so remote listeners get it when the receiver is reached over https:// (see [Secure Access (HTTPS)](HTTPS.md)); on a plain-http station they keep TCI and Desktop PhantomSDR+.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Not in the `dialout` group, or another program has the port | `sudo usermod -aG dialout $USER`, log out and in; close WSJT-X, loggers, rig utilities |
| The receiver readout says *not a receiver this app can drive* | Another kind of web receiver, or the page is still loading | Supported are PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR; give a slow page a few seconds |
| *The rig did not answer* | Wrong speed, wrong rig type, wrong CI-V address, rig off | Match the speed to the rig's menu; check the CI-V address; try Hamlib |
| *Hamlib is not installed* | No `rigctld` found | Linux: `sudo apt install libhamlib-utils`. Or set **rigctld program** to its path |
| *rigctld stopped: ...* | Hamlib could not open the rig — its own message follows | Usually the port or speed; the text after the colon is Hamlib's reason |
| *flrig is not running at ...* | flrig closed, or its XML-RPC port differs | Start flrig; check its port in flrig's configuration |
| Connected, but the receiver does not move | No station window open, or **Receiver window** pinned to a station that is closed | Open the station, or choose *The station window last in front* |
| The rig transmits when connecting | DTR or RTS keys the rig through your interface | Untick **DTR on** and **RTS on** |
| Filter does not follow | Receiver older than 4.1.0, or a built-in Kenwood/Yaesu driver | Frequency and mode still sync; use Hamlib for the filter on Kenwood/Yaesu |
| Mute on transmit does nothing | Receiver without the update, or the rig does not report transmit state | As above |
| *Lost the rig ... reconnecting* | The cable was pulled, the rig was switched off, or rigctld died | Nothing — it retries every 3 seconds and carries on when the rig is back |
| The two sides keep jumping | Two programs are controlling the rig at once | Let only one program set the rig, or share it through flrig |

---

## Known limitations

- One rig, one receiver window at a time.
- Receivers other than PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR — OpenWebRX, for example — are not supported.
- The built-in drivers follow the manufacturers' published protocols and were tested against simulated rigs and real Hamlib; for a rig that behaves differently, Hamlib is the fallback.
- Split operation, VFO B, RIT/XIT and memory channels are not synced — only the frequency of the active VFO.
- TCI-CAT and Direct USB on the receiver page do not sync VFO B, RIT/XIT or transverter offsets — **Split** only stops the page from moving the rig — and were tried only on an IC-7300 (TCI through the Hamlib bridge).
- On Linux the packages use the distribution's Hamlib; none is bundled.
