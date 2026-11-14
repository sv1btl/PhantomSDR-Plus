# Several Receivers — Sysop Manual

> **Port numbers.** The examples below use the ports `install.sh` suggests: `proxy.py` on the public port 9000, the main receiver on 9001, further receivers on 9002, 9003 and so on. The station questions keep `receivers.toml` in step: when a port or the address changes, `configure-station.sh` moves the main receiver to its new port and writes every link as `<address>/?rx=<id>` — a link without `?rx=` would keep a visitor on the receiver the `rx` cookie remembers. Never give a receiver the public port itself: the proxy would forward to itself, so it now refuses that.

**Running two or more receivers on one computer, with a receiver picker on the page.**

Since v5.0.0 one PhantomSDR-Plus computer can run several receivers at the same time — for example an RX-888 for HF and an RTL-SDR for 2 m — and listeners switch between them with buttons in the page header, the way OpenWebRX offers its profiles. Every receiver keeps its own waterfall, chat, markers, listener list and station details; nobody on one receiver is ever disturbed by someone on another.

> **In a hurry?** A station with one receiver needs none of this and sees no change. For a second receiver: create `instances/<name>/` with its own `config.toml`, start it with `INSTANCE=<name> ./start-<radio>.sh`, list both receivers in `receivers.toml`, and restart the proxy. The worked example in [section 3](#3-adding-a-second-receiver) goes through it line by line.

> **The easiest way:** run `./add-receiver.sh` (the installers offer it at the end). It asks which receiver and what it should cover, installs its driver, writes everything described in [section 3](#3-adding-a-second-receiver) and [section 4](#4-receiverstoml), and offers to start the receiver and restart the proxy. The rest of this manual explains what it does, for when you want to change something by hand.

> **From the admin panel:** the **Receivers** page lists every receiver with what it covers. **✎ CHANGE SETTINGS** changes an extra receiver's frequency and bandwidth (and restarts only that one), and on every receiver the start frequency, mode, gain and button name — an extra receiver keeps its gain in `instances/<id>/instance.env`, the main one in `main.env`, which every start-*.sh reads last. **■ STOP** / **▶ START** stops or starts one receiver while the others keep running, and **🗑 DELETE** removes an extra receiver (stops it, takes it out of `receivers.toml`, moves its `instances/<id>/` folder to `admin-backups/`). It also prepares a new receiver: it saves your answers and gives `./add-receiver.sh --answers instances/.add-rx.env` to run in a terminal. See [Admin Panel](ADMIN_PANEL_SETUP.md).

---

## Contents

1. [How it works](#1-how-it-works)
2. [Two ways to publish the receivers](#2-two-ways-to-publish-the-receivers)
3. [Adding a second receiver](#3-adding-a-second-receiver)
4. [receivers.toml](#4-receiverstoml)
5. [Starting and stopping](#5-starting-and-stopping)
6. [What listeners see](#6-what-listeners-see)
7. [The S-meter above 30 MHz](#7-the-s-meter-above-30-mhz)
8. [Security](#8-security)
9. [How many receivers fit](#9-how-many-receivers-fit)
10. [Traps worth knowing about](#10-traps-worth-knowing-about)

---

## 1. How it works

Each receiver is a complete spectrumserver of its own, with its own SDR front end, its own configuration and its own internal port. They never share samples, settings or listeners. What ties them together is `proxy.py`, the reverse proxy that already serves the admin panel: it reads `receivers.toml` and sends every request to one receiver.

```
                     ┌──► :9001  spectrumserver  RX-888   (HF, the main receiver)
listeners ──► proxy.py ┤
                     └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, instance "vhf")
```

The proxy decides by these, in order:

1. `?rx=<id>` in the address — `http://your.host:9000/?rx=vhf`. The page adds it to every socket, poll and link it opens, so a tab stays on its receiver.
2. The `rx` cookie, which the proxy sets whenever a request carries a valid `?rx=`.
3. The Host header, if a receiver lists that name under `hostnames`.
4. Otherwise the default receiver.

The **main receiver** is the one started the usual way (`./start-rx888mk2.sh`). Every other receiver is a **named instance**: started with `INSTANCE=<name>`, configured in `instances/<name>/`, and given its own log (`logwebsdr-<name>.txt`), server log, watchdog lock and FIFO. Processes are told apart by a `PHANTOMSDR_INSTANCE` tag in their environment, not by their name, so two receivers may run the very same program — two `rtl_sdr`, or `rx_sdr` for both an RSP1A and an Airspy — and a restart of one never touches the other.

---

## 2. Two ways to publish the receivers

**A — the main receiver keeps its own port.** The main receiver stays exactly where it was (say `:9001`), listeners there notice nothing, and the other receivers are reached through the proxy's port (`proxy_port` in `admin_config.json`, say `:9000`) with `?rx=`. Nothing has to be moved and nothing goes off the air; it does mean two public ports.

```
HF:  http://your.host:9001/
2 m: http://your.host:9000/?rx=vhf
```

**B — one public port for everything.** The proxy takes over the public port and the main receiver moves to an internal one. Set `[front] port` in `receivers.toml`, move the main receiver's `[server] port` and set `host = "127.0.0.1"` on it, set `public_port` in `admin_config.json` to the new internal port, and add `public_port = <the public port>` under `[websdr]` so the directory listing keeps announcing the right one. Everything then lives behind one port; the cost is a short outage while you move it.

```
HF:  http://your.host:9000/
2 m: http://your.host:9000/?rx=vhf
```

Either way the receiver picker works the same. Layout A is the safer start; B can follow later without changing anything for the second receiver.

---

## 3. Adding a second receiver

**`add-receiver.sh` adds a receiver** — run it and answer its questions; it installs the driver (`setup-rtlsdr.sh` for an RTL-SDR, the matching `setup-*.sh` for the others), picks a free internal port, writes the instance folder, its configuration and its line in `receivers.toml`, and names the receiver after what it covers. The admin panel's **Receivers** page does the same with ➕ ADD NEW RECEIVER.

---

## 4. receivers.toml

Copy `receivers.toml.example` to `receivers.toml`. Without that file the proxy serves a single receiver exactly as it always has.

```toml
# [front]
# port = 9000        # layout B only: the proxy also listens on this public port

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 9001
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://your.host:9000/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://your.host:9000/?rx=vhf"
```

| Key | Meaning |
|---|---|
| `id` | Short name used in `?rx=`; letters, digits, `-` and `_` |
| `name` | The text on the receiver's button |
| `port` | Its spectrumserver's `[server] port` |
| `host` | Optional; where that spectrumserver runs (default `127.0.0.1`) |
| `default` | The receiver for requests that name none; at most one |
| `launcher` | Its `start-*.sh`, for `start-all.sh`; leave it out for a receiver this computer does not start |
| `instance` | Its instance name; leave it out for the main receiver |
| `url` | Where its button sends a listener; without it, `/?rx=<id>` on the proxy |
| `hostnames` | Optional DNS names routed straight to this receiver |

The proxy also serves the list as `/receivers.json` (ids, names and links — never the internal ports), which is what the picker reads.

---

## 5. Starting and stopping

| Command | Does |
|---|---|
| `./start-rx888mk2.sh` | Starts or restarts the main receiver |
| `INSTANCE=vhf ./start-rtl.sh` | Starts or restarts the `vhf` receiver |
| `./start-all.sh` | Starts every receiver in `receivers.toml` that has a `launcher` |
| `./stop-websdr.sh vhf` | Stops only `vhf` |
| `./stop-websdr.sh main` | Stops only the main receiver |
| `./stop-websdr.sh` | Stops every receiver, as it always did |

**While a receiver is stopped**, its button disappears from the picker — the proxy lists only the receivers that answer, and open pages re-read the list every 15 seconds — and comes back when the receiver starts again; with only one receiver left running, the *Receivers:* line disappears altogether. A stopped receiver does come back by itself whenever every receiver is started: `./start-all.sh`, the admin panel's **Restart** and a thermal-guard restart all start everything listed in `receivers.toml`. To keep one off for good, delete it on the admin panel's **Receivers** page, or remove (or comment out) its `[[receiver]]` block by hand — the proxy re-reads `receivers.toml` when it changes, so a rename, a removal or a new block takes effect without a proxy restart (only the first `receivers.toml` on a station, or a change of `[front] port`, still needs one).

Set the admin panel's **Default start script** to `start-all.sh`. Its Stop already stops every receiver, and its Restart and the thermal guard use the start script, so with `start-all.sh` they bring back every receiver instead of only the main one.

The RADE sidecar belongs to the main receiver only. A named instance never starts or stops it.

---

## 6. What listeners see

**The receiver picker.** On a station with more than one receiver the page header gets a line of its own, *Receivers:*, with one button per receiver; the current one is shown in yellow. The /mobile page has the same buttons as a second row in its top bar, and they open the other receiver's /mobile page.

**Show All strips.** A *Show All* checkbox after the receiver buttons puts each other receiver under the listener's waterfall as a live strip. A click there opens that receiver tuned to the frequency clicked, and a page the listener left reopens on the view they left it with. Each strip is a waterfall-only socket to the other receiver (`/waterfall?rx=<id>`): it is not a listener there — the user count and the per-IP listener limit do not see it, `per_ip_sockets` does — and it costs about 10 KB/s of upload for each listener who ticks the box. It is off by default and needs nothing on the server. When the other receiver covers more than one band, the strip's header offers that receiver's bands in a dropdown (the same ones its band buttons show); a band frames the strip as its band button does, and a click then opens the receiver framed on that band. The choice is kept per receiver in the listener's browser.

**Switching by frequency.** A frequency outside this receiver's coverage that another receiver covers — typed, from a link, a bookmark or a spot — opens the receiver that covers it. The page learns each receiver's range by opening its `/waterfall` socket for a moment, and remembers it for a day.

**Users and statistics per receiver.** The *Connected Users* and *User Statistics* windows show the receiver whose page they are on, even with several receivers open side by side in one browser. The statistics come from that receiver's own logs — `logs/` for the main receiver, `instances/<id>/logs/` for the others.

**Each receiver's own details.** A page opened on a second receiver loads that receiver's `site_information.json` before it starts, so the band buttons, the starting frequency, the users list, the station details and the Receiver and Antenna links are all its own. A plain visit to the main receiver makes no extra request.

Keys in `site_information.json` for this:

| Key | Meaning |
|---|---|
| `siteReceiverId` | The receiver this page belongs to (its `id`); leave it out on the main receiver |
| `siteReceiversList` | Where the picker reads the list, e.g. `http://your.host:9000/receivers.json`; needed on a receiver whose page is not served through the proxy |
| `siteReceiverURL` | Where the *Receiver* name in *Open Additional Info* links to |
| `siteAntennaURL` | Where the *Antenna* name links to; `""` shows the name without a link |

**When the picker stays hidden.** The picker only shows a list that names the host the page was opened on. Opened by LAN address (`http://192.168.1.10:9000/`) it stays hidden; opened as `http://your.host:9000/` it appears. That is deliberate: a station that copied someone else's `site_information.json` without editing it never shows that station's receivers as its own.

---

## 7. The S-meter above 30 MHz

The IARU Region 1 standard puts S9 at −73 dBm below 30 MHz and at **−93 dBm above**, six dB per S-unit on both. The S-meters (the analog needle, the digital bar and the /mobile bar) follow the tuned frequency: above 30 MHz they read VHF S-units, below it they read as before. The dBm and dBµV figures are never changed. If you prefer the meters to rest at 0 on an empty channel, like a VHF/UHF transceiver's, add `"siteSMeterGateDb": 6` to the receiver's `site_information.json` (no rebuild needed): above **60 MHz** the needle and the bar then come up only when a signal stands that many dB above the noise in its own neighbourhood (the passband's strongest point against the spectrum ±100 kHz around it). It is **off by default** — a calibrated meter showing the real band noise is the more honest reading. The /mobile page, which has no waterfall, estimates the noise from the received level itself.

Calibrate a VHF receiver's dBm with `analog_smeter_offset` (needle and figures) and `smeter_offset` (digital bar) under `[input]` in its `config.toml`, then restart that receiver. Set the receiver's gain first: an RTL-SDR reports levels relative to its own full scale, so every gain change moves the readings. Without a signal generator, a 50 Ω terminator in place of the antenna, USB with a 2.7 kHz filter, should read about −136 dBm (thermal noise in 2.7 kHz is −139.7 dBm, plus the stick's noise figure).

For an RTL-SDR, `add-receiver.sh` writes a starting calibration: a fixed gain of `-g 29.7` in `instance.env` (the tuner's automatic gain cannot be calibrated) and `analog_smeter_offset=-55`, `smeter_offset=-38`, measured on an RTL-SDR Blog V4 at that gain with a −71 dBm (63 µV) signal. Another stick of the same model reads within a few dB of that; check it with a known signal, and recalibrate if you change the gain.

---

## 8. Security

Bind every receiver that is reached through the proxy to `127.0.0.1` (`[server] host`), so its port cannot be used around the proxy. The per-IP limits in [Connection Limits](CONNECTION_LIMITS.md) apply per receiver.

---

## 9. How many receivers fit

The software sets no limit; the hardware does. Narrowband receivers are cheap: an RTL-SDR at 2.4 Msps uses about 5–10 % of one core, a few dozen MB of memory, and about 38 Mbit/s of USB.

- **USB 2.0 is the usual ceiling.** Every USB 2 device shares one 480 Mbit/s bus, even in a blue USB 3 socket. Three to four RTL-SDRs per bus is a safe figure; add them one at a time and watch every waterfall for gaps.
- **Power:** use a powered hub beyond two sticks.
- **A second wideband receiver** (another RX-888, or a HackRF at 20 Msps) is a different matter: it competes with the first for USB 3, CPU and GPU.
- **Listeners cost more than receivers.** Each listener costs CPU on the receiver they are on and upload bandwidth, so the total number of listeners matters more than the number of receivers.

---

## 10. Traps worth knowing about

- **Two sticks of the same model have the same serial.** Every RTL-SDR Blog V4 reports `00000001`. Give each its own with `rtl_eeprom -s <serial>` (one stick plugged in at a time) and name it in `instance.env` (`RX_ARGS="-d <serial> …"`), or after a reboot the sticks may swap receivers.
- **Kiwi clients cannot choose a receiver.** A KiwiSDR client dials a bare address and port; through the proxy it always lands on the default receiver. Keep `[kiwi_emulation]` off on the others.
- **Cookies are per host, not per port.** A visitor who used the second receiver on `:9000` carries `rx=vhf` to `:9001` too. That is why a page decides which receiver it is from `siteReceiverId`, never from the cookie.
- **Directory listings.** Give each receiver its own name in `[websdr]`, and on a receiver behind the proxy set `[websdr] public_port` to the port listeners use, or the listing advertises the internal one.
- **A frontend rebuild briefly shows "Not Found".** `frontend/dist` is rebuilt in place, so for a few seconds during a build the page is missing for every receiver.
- **Nothing starts the receivers at boot** unless you arrange it. After a reboot, `./start-all.sh` brings them all back.
