# Several Receivers — Sysop Manual

> **Port numbers.** The examples below use the ports of a station set up before the station questions (8900, 8901, …). On a station set up with `configure-station.sh`, `proxy.py` already owns the public port 9000 and the main receiver is on 9001, so give further receivers 9002, 9003 and so on.

**Running two or more receivers on one computer, with a receiver picker on the page.**

Since v5.0.0 one PhantomSDR-Plus computer can run several receivers at the same time — for example an RX-888 for HF and an RTL-SDR for 2 m — and listeners switch between them with buttons in the page header, the way OpenWebRX offers its profiles. Every receiver keeps its own waterfall, chat, markers, listener list and station details; nobody on one receiver is ever disturbed by someone on another.

> **In a hurry?** A station with one receiver needs none of this and sees no change. For a second receiver: create `instances/<name>/` with its own `config.toml`, start it with `INSTANCE=<name> ./start-<radio>.sh`, list both receivers in `receivers.toml`, and restart the proxy. The worked example in [section 3](#3-adding-a-second-receiver) goes through it line by line.

> **The easiest way:** run `./add-receiver.sh` (the installers offer it at the end). It asks which receiver and what it should cover, installs its driver, writes everything described in [section 3](#3-adding-a-second-receiver) and [section 4](#4-receiverstoml), and offers to start the receiver and restart the proxy. The rest of this manual explains what it does, for when you want to change something by hand.

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
                     ┌──► :8900  spectrumserver  RX-888   (HF, the main receiver)
listeners ──► proxy.py ┤
                     └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, instance "vhf")
```

The proxy decides by these, in order:

1. `?rx=<id>` in the address — `http://your.host:8899/?rx=vhf`. The page adds it to every socket, poll and link it opens, so a tab stays on its receiver.
2. The `rx` cookie, which the proxy sets whenever a request carries a valid `?rx=`.
3. The Host header, if a receiver lists that name under `hostnames`.
4. Otherwise the default receiver.

The **main receiver** is the one started the usual way (`./start-rx888mk2.sh`). Every other receiver is a **named instance**: started with `INSTANCE=<name>`, configured in `instances/<name>/`, and given its own log (`logwebsdr-<name>.txt`), server log, watchdog lock and FIFO. Processes are told apart by a `PHANTOMSDR_INSTANCE` tag in their environment, not by their name, so two receivers may run the very same program — two `rtl_sdr`, or `rx_sdr` for both an RSP1A and an Airspy — and a restart of one never touches the other.

---

## 2. Two ways to publish the receivers

**A — the main receiver keeps its own port.** The main receiver stays exactly where it was (say `:8900`), listeners there notice nothing, and the other receivers are reached through the proxy's port (`proxy_port` in `admin_config.json`, say `:8899`) with `?rx=`. Nothing has to be moved and nothing goes off the air; it does mean two public ports.

```
HF:  http://your.host:8900/
2 m: http://your.host:8899/?rx=vhf
```

**B — one public port for everything.** The proxy takes over the public port and the main receiver moves to an internal one. Set `[front] port` in `receivers.toml`, move the main receiver's `[server] port` and set `host = "127.0.0.1"` on it, set `public_port` in `admin_config.json` to the new internal port, and add `public_port = <the public port>` under `[websdr]` so the directory listing keeps announcing the right one. Everything then lives behind one port; the cost is a short outage while you move it.

```
HF:  http://your.host:8900/
2 m: http://your.host:8900/?rx=vhf
```

Either way the receiver picker works the same. Layout A is the safer start; B can follow later without changing anything for the second receiver.

---

## 3. Adding a second receiver

**`add-receiver.sh` does all of the steps below** — run it and answer its questions; it also installs the driver (`setup-rtlsdr.sh` for an RTL-SDR, the matching `setup-*.sh` for the others), picks a free internal port and names the receiver after what it covers. The steps are written out here so that you can check its work or change it later.

The example adds an RTL-SDR Blog V4 for 2 m as instance `vhf`, next to an RX-888 that keeps port 8900 (layout A).

**1. The driver.** The RTL-SDR Blog V4 needs the RTL-SDR Blog driver rather than the distribution's `rtl-sdr` package, and the kernel's DVB-T driver must let go of the stick. `install.sh` (receiver option 2, "RTL-SDR Blog V4: yes") does both. Check with `rtl_test -t`, which must say `RTL-SDR Blog V4 Detected`.

**2. The instance folder.** Everything that belongs to the receiver lives in `instances/vhf/`, which is never committed and never overwritten by an update:

```
instances/vhf/
├── config.toml          its spectrumserver configuration (required)
├── instance.env         optional: receiver arguments and CPU pinning
├── markers.json         its own markers
└── www/                 its own copies of the page's per-station files
    ├── site_information.json
    └── wf-message.json
```

spectrumserver runs with `instances/vhf/` as its working directory, so its chat history, markers, FFTW wisdom and `logs/` are its own as well.

**3. `config.toml`.** Start from `config-rtl.toml` and change:

```toml
[server]
port=9002                              # its own internal port
host="127.0.0.1"                       # reachable only through the proxy
html_root="www/"                       # its own few files...
html_fallback_root="../../frontend/dist/"   # ...and the shared page for the rest

[input]
sps=2400000                            # must match -s in instance.env
frequency=145000000                    # must match -f in instance.env

[input.defaults]
frequency=145500000
modulation="FM"

[kiwi_emulation]
enabled = false                        # see the traps below
```

`html_fallback_root` lets the instance keep only its own `site_information.json` and `wf-message.json` while everything else — the built page itself — comes from `frontend/dist`, so one frontend build reaches every receiver. A symlinked copy of `frontend/dist` does not work: the server refuses files that resolve outside its own folder.

**4. `instance.env`.** Read by the launcher after its own settings:

```bash
RX_ARGS="-f 145000000 -s 2400000 -g 29.7 -"   # -f and -s match config.toml
SPECTRUM_CORES=8-11                           # keep it off the main receiver's cores
```

**5. Its page details.** Copy `frontend/site_information.json` to `instances/vhf/www/` and edit it: `siteReceiver`, `siteAntenna`, `siteSDRBaseFrequency` and `siteSDRBandwidth` (these choose which band buttons appear), and the keys described in [section 6](#6-what-listeners-see).

**6. Start it.**

```bash
INSTANCE=vhf ./start-rtl.sh
```

**7. List it in `receivers.toml`** and restart the proxy (`sudo systemctl restart phantomsdr-proxy`). The second receiver is now at `http://your.host:8899/?rx=vhf`, and both pages show the picker.

---

## 4. receivers.toml

Copy `receivers.toml.example` to `receivers.toml`. Without that file the proxy serves a single receiver exactly as it always has.

```toml
# [front]
# port = 8900        # layout B only: the proxy also listens on this public port

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 8900
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://your.host:8900/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://your.host:8899/?rx=vhf"
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

**While a receiver is stopped**, its button disappears from the picker — the proxy lists only the receivers that answer, and open pages re-read the list once a minute — and comes back when the receiver starts again; with only one receiver left running, the *Receivers:* line disappears altogether. A stopped receiver does come back by itself whenever every receiver is started: `./start-all.sh`, the admin panel's **Restart** and a thermal-guard restart all start everything listed in `receivers.toml`. To keep one off for good, remove (or comment out) its `[[receiver]]` block and restart the proxy.

Set the admin panel's **Default start script** to `start-all.sh`. Its Stop already stops every receiver, and its Restart and the thermal guard use the start script, so with `start-all.sh` they bring back every receiver instead of only the main one.

The RADE sidecar belongs to the main receiver only. A named instance never starts or stops it.

---

## 6. What listeners see

**The receiver picker.** On a station with more than one receiver the page header gets a line of its own, *Receivers:*, with one button per receiver; the current one is shown in yellow. The /mobile page has the same buttons as a second row in its top bar, and they open the other receiver's /mobile page.

**Each receiver's own details.** A page opened on a second receiver loads that receiver's `site_information.json` before it starts, so the band buttons, the starting frequency, the users list, the station details and the Receiver and Antenna links are all its own. A plain visit to the main receiver makes no extra request.

Keys in `site_information.json` for this:

| Key | Meaning |
|---|---|
| `siteReceiverId` | The receiver this page belongs to (its `id`); leave it out on the main receiver |
| `siteReceiversList` | Where the picker reads the list, e.g. `http://your.host:8899/receivers.json`; needed on a receiver whose page is not served through the proxy |
| `siteReceiverURL` | Where the *Receiver* name in *Open Additional Info* links to |
| `siteAntennaURL` | Where the *Antenna* name links to; `""` shows the name without a link |

**When the picker stays hidden.** The picker only shows a list that names the host the page was opened on. Opened by LAN address (`http://192.168.1.10:8900/`) it stays hidden; opened as `http://your.host:8900/` it appears. That is deliberate: a station that copied someone else's `site_information.json` without editing it never shows that station's receivers as its own.

---

## 7. The S-meter above 30 MHz

The IARU Region 1 standard puts S9 at −73 dBm below 30 MHz and at **−93 dBm above**, six dB per S-unit on both. The S-meters (the analog needle, the digital bar and the /mobile bar) follow the tuned frequency: above 30 MHz they read VHF S-units, below it they read as before. The dBm and dBµV figures are never changed. If you prefer the meters to rest at 0 on an empty channel, like a VHF/UHF transceiver's, add `"siteSMeterGateDb": 6` to the receiver's `site_information.json` (no rebuild needed): above **60 MHz** the needle and the bar then come up only when a signal stands that many dB above the noise in its own neighbourhood (the passband's strongest point against the spectrum ±100 kHz around it). It is **off by default** — a calibrated meter showing the real band noise is the more honest reading. The /mobile page, which has no waterfall, estimates the noise from the received level itself.

Calibrate a VHF receiver's dBm with `analog_smeter_offset` (needle and figures) and `smeter_offset` (digital bar) under `[input]` in its `config.toml`, then restart that receiver. Set the receiver's gain first: an RTL-SDR reports levels relative to its own full scale, so every gain change moves the readings. Without a signal generator, a 50 Ω terminator in place of the antenna, USB with a 2.7 kHz filter, should read about −136 dBm (thermal noise in 2.7 kHz is −139.7 dBm, plus the stick's noise figure).

For an RTL-SDR, `add-receiver.sh` writes a starting calibration: a fixed gain of `-g 29.7` in `instance.env` (the tuner's automatic gain cannot be calibrated) and `analog_smeter_offset=-55`, `smeter_offset=-38`, measured on an RTL-SDR Blog V4 at that gain with a −71 dBm (63 µV) signal. Another stick of the same model reads within a few dB of that; check it with a known signal, and recalibrate if you change the gain.

---

## 8. Security

Putting the proxy in front of listeners closed two holes, both fixed in v5.0.0:

- **The sysop kick through the proxy.** spectrumserver allows `/~~kick` only from its own computer, and to it every request relayed by the proxy comes from its own computer. Anyone who could reach the proxy port could therefore disconnect and ban any listener. The proxy now answers `/~~kick` only for clients on the same computer.
- **Faked client addresses.** spectrumserver believed an `X-Forwarded-For` header from anyone, so a visitor could claim to be `127.0.0.1` and walk past the per-IP limits. The header is now believed only from a local proxy, and the proxy drops any copy a client sends before adding its own.

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
- **Cookies are per host, not per port.** A visitor who used the second receiver on `:8899` carries `rx=vhf` to `:8900` too. That is why a page decides which receiver it is from `siteReceiverId`, never from the cookie.
- **Directory listings.** Give each receiver its own name in `[websdr]`, and on a receiver behind the proxy set `[websdr] public_port` to the port listeners use, or the listing advertises the internal one.
- **A frontend rebuild briefly shows "Not Found".** `frontend/dist` is rebuilt in place, so for a few seconds during a build the page is missing for every receiver.
- **Nothing starts the receivers at boot** unless you arrange it. After a reboot, `./start-all.sh` brings them all back.
