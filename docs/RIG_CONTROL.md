# PhantomSDR-Plus — Rig Control (CAT)

Keep **your own transceiver** and a **PhantomSDR-Plus receiver** on the same frequency, mode and filter. Turn the rig's dial and the waterfall follows; click a signal on the waterfall and the rig tunes to it. Key the rig, and the receiver can fall silent so it does not play your own signal back to you.

It works with **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR** receivers, yours or someone else's, and only ever moves *your* listening session — nobody else on the receiver hears or sees a thing. There is nothing for the receiver's operator to install or configure.

---

## What you need

Two ways to connect a rig, and one requirement on the receiver:

| Piece | What it is | Syncs |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 or later** | The desktop application, with a **Rig** menu. Linux (PC and Raspberry Pi) and Windows. | Frequency, mode, filter width, mute on transmit — in either direction or both |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | A separate Windows program that couples a rig to the receiver page in your browser. | Frequency and mode |
| **The receiver** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR or UberSDR. A PhantomSDR-Plus receiver needs 4.0 with the **September 2026 update** or later for filter width and mute. | An older PhantomSDR-Plus still syncs frequency and mode |

The rest of this manual describes Desktop PhantomSDR+. The CATsync Tool has its own documentation on its website.

---

## Supported receivers

The app recognises the kind of receiver in a station window and drives it through that page's own controls. The Rig control window shows which kind it found next to the station's name.

| Receiver | Frequency and mode | Filter width | Mute on transmit |
|---|---|---|---|
| PhantomSDR-Plus | Yes | With the September 2026 update or later | With the September 2026 update or later |
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
| **Hamlib (all rigs)** | Your rig is anything else — Hamlib knows more than 300 rigs. The app starts Hamlib's `rigctld` for you, on a private local port, and stops it when you disconnect. | Windows: nothing, Hamlib is included. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | A `rigctld` is already running, on this computer or another one on your network. | The host and port (4532 by default) |
| **flrig** | flrig already controls the rig for fldigi, WSJT-X or a logger. | flrig running, with its XML-RPC port (12345 by default) |

### Rigs with a built-in driver

The speed and CI-V address shown are the factory defaults the app fills in. **They are only a starting point — set them to what your rig's menu says.**

| Family | Rigs | Default speed | Notes |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600, and any other CI-V rig | 19200 | CI-V address filled in per model (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Address `70`; check the rig's menu |
| **Yaesu new CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu classic CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bits; tunes in 10 Hz steps |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Filter width syncs |
| **Kenwood-compatible** | FlexRadio SmartSDR CAT (virtual port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, other Kenwood-compatible rigs | 9600–38400 | |

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

### How the two sides are kept from fighting

Every value the app writes shows up a moment later as a change on the other side. If that were taken at face value, the rig and the receiver would chase each other for ever. The app avoids it in three ways:

- The receiver page applies a change at once, so it is read back straight after writing, and that reading becomes the new starting point.
- A rig applies a change a little later, so each value sent to it is remembered. When the rig reports that value, it is recognised as the app's own write rather than a hand on the dial.
- A value the rig refuses — wide FM on an HF rig, for example — is sent **twice** and then left alone until the source side changes, instead of being repeated several times a second.

Retuning the receiver page can make it choose its band's default mode (LSB below 10 MHz, for instance). When the rig is leading, the app puts the rig's own mode back straight away, so a rig in USB on 40 m keeps the receiver in USB.

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

KiwiSDR, WebSDR and UberSDR receivers always have the control. A PhantomSDR-Plus receiver must have the **September 2026 update** or later; on an older one frequency and mode still sync, and the Rig control window says why the filter does not.

---

## Mute while transmitting

Tick **Mute receiver while transmitting**. While the rig is keyed the receiver window is muted, and when it is unkeyed the sound comes back. The receiver's own mute button shows it, and you can still unmute by hand.

If you had already muted the receiver yourself, it is left muted afterwards too.

It needs a rig connection that reports transmit state — all the built-in drivers, flrig, and Hamlib for most rigs — and, on a PhantomSDR-Plus receiver, the September 2026 update.

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
| **Rig to receiver / Receiver to rig / Both directions** | Sync direction |
| **Sync filter width** | On / off |
| **Mute receiver while transmitting** | On / off |
| Status line | *Not connected*, *Connecting...*, *Connected: rig name*, or the last error |

The live frequency readout is in the Rig control window rather than in the menu, which would close itself every time it changed.

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

The `.deb` package of Desktop PhantomSDR+ recommends it, so `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` brings it along; `dpkg -i` does not install recommended packages. The built-in drivers and flrig need no Hamlib.

## Windows

Hamlib's own `rigctld.exe` is included in both the 64-bit and the 32-bit installer. COM ports appear in the port list by name (`COM3`). If a rig's USB driver is needed, install the manufacturer's driver first — the port does not exist until it is.

---

## For receiver operators

Nothing to configure. Rig control uses a small JavaScript interface every PhantomSDR-Plus page already carries; it involves no server setting, no open port and no admin permission. The filter and mute functions came with the September 2026 update to 4.0.0 — after applying it, rebuild the frontend (`./recompile.sh`, option 2); the receiver does not need to be stopped. KiwiSDR, WebSDR and UberSDR receivers need nothing either: the app uses the controls their pages already have.

---

## For developers: the page interface

Both Desktop PhantomSDR+ and the CATsync Tool use these functions, which every PhantomSDR-Plus page puts on `window` once it has loaded (KiwiSDR, WebSDR and UberSDR pages are driven through their own, different controls):

| Function | Returns / does |
|---|---|
| `catsync_ready` | `true` once the functions below are installed |
| `catsync_getFrequency()` | Tuned frequency, Hz |
| `catsync_setFrequency(hz)` | Tune to `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Set the mode; resets the passband to the mode's default |
| `catsync_getBandwidth()` | Whole passband width, Hz |
| `catsync_setBandwidth(hz)` | Set the width — grows upwards in USB, downwards in LSB, evenly otherwise. Call it **after** `catsync_setMode` |
| `catsync_getMute()` | `true` when muted |
| `catsync_setMute(on)` | Mute or unmute, through the page's mute button |

The last four arrived with the September 2026 update, so test before calling:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Setting the frequency retunes audio, so call a setter only when the value has actually changed — polling a setter with the same value is audible. The older KiwiSDR/WebSDR-style entry points (`setfreq`, `set_mode`, `freqset_complete`) are still there for tools that expect them.

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
| Filter does not follow | Receiver without the September 2026 update, or a built-in Kenwood/Yaesu driver | Frequency and mode still sync; use Hamlib for the filter on Kenwood/Yaesu |
| Mute on transmit does nothing | Receiver without the update, or the rig does not report transmit state | As above |
| *Lost the rig ... reconnecting* | The cable was pulled, the rig was switched off, or rigctld died | Nothing — it retries every 3 seconds and carries on when the rig is back |
| The two sides keep jumping | Two programs are controlling the rig at once | Let only one program set the rig, or share it through flrig |

---

## Known limitations

- One rig, one receiver window at a time.
- Receivers other than PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR — OpenWebRX, for example — are not supported.
- The built-in drivers follow the manufacturers' published protocols and were tested against simulated rigs and real Hamlib; for a rig that behaves differently, Hamlib is the fallback.
- Split operation, VFO B, RIT/XIT and memory channels are not synced — only the frequency of the active VFO.
- On Linux the packages use the distribution's Hamlib; none is bundled.
