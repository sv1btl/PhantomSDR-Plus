# PhantomSDR-Plus Admin Panel — Setup Guide

> ⚠️ **Security notice:** Keep this admin panel on your home network or behind a VPN. Public exposure of the admin port is not recommended without proper authentication hardening.

---

## Overview

The admin panel consists of two Python services:

| Service | File | Role |
|---|---|---|
| Admin panel | `admin_server.py` | Flask web app, binds to `127.0.0.1` (internal only) |
| Reverse proxy | `proxy.py` | Exposes both the SDR and the admin panel on a single public port |

Both services read their configuration from `admin_config.json`, which is written by `setup_admin.sh`. **Do not edit port constants directly in the Python files** — all ports and the SDR host IP are stored in `admin_config.json`.

---

## What the admin panel gives you

- **Dashboard** — live server status, CPU/RAM, top processes, recent log output, terminal
- **Config Editor** — view, edit and save any `.toml`, `.sh`, `.json`, `.h`, `.cpp` file in your installation
- **Log Viewer** — tail any log file in real time
- **Markers** — view and edit frequency markers
- **Chat History** — view the WebSDR chat log, clear it entirely, or delete individual messages without restarting the server
- **Waterfall Message** — broadcast a persistent banner message to all connected users, visible on the waterfall display in real time
- **Users** — live list of connected listeners with their tuned frequency, mode, duration and a ⚡ Kick button
- **Chat message deletion** — 🗑 Delete button that removes that single message from the log immediately
- **Waterfall broadcast messages** —  lets you push a persistent text banner to every connected user's waterfall 
- **Spot Reporting** — start/stop the autorun FT8/FT4/WSPR decoder, pick bands/modes, and report spots to PSK Reporter / wsprnet (OFF by default)
- **Settings** — change admin password, SDR base directory, process name, public port

---

## Requirements

- PhantomSDR-Plus already installed and running
- Python 3.8+
- `pip3 install flask psutil aiohttp --break-system-packages`

---

## Step 1 — Files

Place these four files inside your PhantomSDR-Plus directory:

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

Make the shell scripts executable:

```bash
chmod +x setup_admin.sh manage_admin.sh
```

---

## Step 2 — Run the setup script

```bash
./setup_admin.sh
```

The script will:

1. Check that Python 3 is installed
2. Verify `admin_server.py` and `manage_admin.sh` are present
3. Auto-detect your LAN IP (stored as `sdr_host` in config — see [Why LAN IP matters](#why-lan-ip-matters))
4. Ask for three port numbers:
   - **Spectrumserver port** — the port your SDR server listens on (e.g. `8900`)
   - **Admin panel internal port** — where `admin_server.py` binds locally (e.g. `3000`)
   - **Proxy public port** — the single external port that combines SDR + admin (e.g. `8902`)
5. Install `flask`, `psutil` and `aiohttp` via pip
6. Grant `ss` the `cap_net_admin` capability (required for the Kick Users feature)
7. Write `admin_config.json` with all settings
8. Offer to install a systemd service for auto-start on boot

After setup, open your browser via the proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Default password: **`admin`**

> ⚠️ **Change the password immediately** — go to Settings on first login. A first-run wizard will guide you through setting the SDR directory, process name, public port and a new password.

---

## Step 3 — Start / Stop / Restart

Use `manage_admin.sh` to control **both** the admin panel and the proxy together:

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh restart    # restart both
./manage_admin.sh status     # show running status and PIDs
```

`manage_admin.sh` checks that `aiohttp` is installed before starting the proxy and prints a clear error with the fix command if it is missing.

If you installed the systemd service during setup (admin panel only — proxy is always managed via `manage_admin.sh`):

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
sudo systemctl status  phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f   # live logs
```

---

## Step 4 — Open firewall port

Open only the **proxy public port** in your firewall. There is no need to expose the admin panel internal port externally:

```bash
sudo ufw allow <proxy_port>
```

---

## Step 5 — Kick Users feature

The Users page shows every currently connected listener. Each row displays the user's IP, tuned frequency, mode and how long they have been connected. To disconnect one user, click the **⚡ Kick** button on their row — only that TCP connection is dropped. All other listeners stay connected and hear nothing.

The kick is instant and surgical: the server does not restart, no audio is interrupted for anyone else, and the kicked user can reconnect immediately (the feature is for removing misbehaving or stuck connections, not for banning).

Under the hood the kick uses `ss -K dst <IP> dport <port>` to tear down the specific TCP socket. This requires a Linux capability that the setup script grants automatically. If you skipped setup or the button reports an error, apply it manually:

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Configuration — admin_config.json

All runtime configuration lives in `admin_config.json` in your PhantomSDR-Plus directory. `setup_admin.sh` writes the initial file; subsequent changes can be made via the Settings page or by editing the file directly.

Key fields written by `setup_admin.sh`:

| Key | Description |
|---|---|
| `port` | Admin panel internal port (`admin_server.py` binds here) |
| `public_port` | Spectrumserver port (used by the Users page to query `/users`) |
| `proxy_port` | Public port the proxy listens on |
| `sdr_host` | LAN IP used by the proxy to reach spectrumserver (see below) |
| `password_hash` | SHA-256 hash of the admin password |
| `sdr_base_dir` | Path to your PhantomSDR-Plus installation |
| `sdr_process_name` | Process name to monitor (default: `spectrumserver`) |

To change ports after initial setup, edit `admin_config.json` and restart:

```bash
./manage_admin.sh restart
```

---

## Why LAN IP matters

`proxy.py` connects to `spectrumserver` using the machine's **LAN IP** (stored as `sdr_host`), not `127.0.0.1`. This is required because spectrumserver silently drops WebSocket waterfall data for connections that arrive from the loopback address. Using the LAN IP makes spectrumserver treat the proxy as a normal client.

`setup_admin.sh` detects the LAN IP automatically and writes it to `admin_config.json`. If your network changes (e.g. DHCP reassignment), re-run `setup_admin.sh` or update `sdr_host` in `admin_config.json` manually and restart.

---

## proxy.py — what it is and when you need it

`proxy.py` puts both the SDR server and the admin panel on a **single public port**, routing by path prefix:

| Path | Routed to |
|---|---|
| `/admin*` | Admin panel (`localhost:<port>`) |
| Everything else | Spectrumserver (`<sdr_host>:<public_port>`) |

Without the proxy you must expose two ports separately. With the proxy you expose only one.

The proxy also removes the 4 MB WebSocket message-size cap (important for large FFT frames from the RX-888 at 60 MSPS), forwards real client IPs via `X-Forwarded-*` headers, and keeps long-lived connections alive through NAT with a 30-second heartbeat.

---

## Changing ports after setup

Edit `admin_config.json` directly:

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "192.168.1.x"
}
```

Then restart both services:

```bash
./manage_admin.sh restart
```

If you also need `admin_server.py` to bind on a different port at launch (e.g. the systemd service), you can override with the environment variable:

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

By default `admin_server.py` binds to `127.0.0.1` only. To run it standalone without the proxy (development/testing), bind to all interfaces:

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Useful manual commands

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 3000/tcp

# Check what is listening on a port
ss -tlnp | grep 3000
```

---

## Log files

| File | Contents |
|---|---|
| `admin.log` | Admin panel output |
| `proxy.log` | Proxy output |
| `logwebsdr.txt` | Main SDR server log |
| `rade.log` | RADE/FreeDV sidecar log |

---

## Access summary

| Setup | SDR | Admin panel |
|---|---|---|
| Without proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| With proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Chat message deletion

The Chat History page lists every message in the current chat log. Each entry has a **🗑 Delete** button that removes that single message from the log immediately — no server restart required.

How it works:

- The admin panel rewrites the chat log file in place, stripping only the selected message line.
- The change takes effect for any user who reloads the chat; already-loaded chat history in open browser tabs is not retroactively updated.
- Clearing the entire log (the **Clear All** button) truncates the file, which also takes effect without a restart.

The delete button is rendered consistently across all five Svelte App variants. If a deletion appears not to take effect, confirm the admin panel has write permission to the chat log file:

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Waterfall broadcast messages

The **Waterfall Message** panel lets you push a persistent text banner to every connected user's waterfall display without touching the server process.

### Sending a message

1. Open the admin panel and go to **Waterfall Message**.
2. Type your message text and choose a colour (hex, e.g. `#ffdd00`).
3. Click **Send** — the message appears on all active waterfall views immediately.

### Clearing the message

Click **Clear** to remove the banner from all waterfalls. The message state is held in memory by the admin panel; it is cleared automatically if the admin panel process is restarted.

### How it works

The admin panel exposes two internal endpoints that the proxy forwards:

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Set or clear the current banner text and colour |
| `/admin/api/waterfall-message` | `GET` | Return the current message state as JSON |

The frontend polls the message state and renders it as an overlay on the waterfall canvas. No WebSocket reconnection or page reload is needed on the client side.

### Typical uses

- Announce scheduled maintenance: `"Server restart in 10 minutes"`
- Flag band conditions: `"Solar flux 180 — 10m wide open"`
- Welcome message: `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## Spot Reporting (Autorun FT8/FT4/WSPR)

The **Spot Reporting** tab controls the autorun daemon (`autorun/index.js`) — a
Node.js process that decodes FT8/FT4/WSPR server-side straight off the receiver
and uploads spots to the reporting networks:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

**Reporting is OFF by default.** Nothing is uploaded until you enable a
destination and press **Start**. Decoding and uploading are independent: the
daemon can decode and log with reporting off, so you can verify activity before
anything goes public.

> ⚠️ Spots are uploaded to public networks under **your callsign**. Only enable
> bands/modes your receiver genuinely hears, and set the correct grid square.

### Prerequisites

The autorun daemon needs Node.js 22+, the `ws` + `cbor-x` npm packages (resolved
via the `autorun/node_modules` symlink → `frontend/node_modules`), and
`util-linux` (`taskset`). The installers set all of this up automatically — see
the [Autorun Spot Reporter section of INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr).
If **Start** fails, that symlink or `taskset` is the usual cause (see
Troubleshooting below).

### Using the tab

1. **Identity** — callsign and grid. Pre-filled from `frontend/site_information.json`
   (`siteSysop` / `siteGridSquare`, truncated to 6 chars); override here if needed.
2. **Band × mode matrix** — tick the combinations to decode. Rows are bands, columns
   are FT8 / FT4 / WSPR; unsupported cells are disabled. WSPR additionally covers the
   LF/MF bands (2200m, 630m) and an extra 80m EU channel.
3. **Destinations** — enable **PSK Reporter** and/or **wsprnet** (both off by default).
4. **Max slots** — a safety cap on how many band/mode slots can run at once.
5. **Start / Stop** — spawns/kills the daemon (pinned to the top CPU cores with
   `taskset`, chosen automatically for the machine — see *Resource requirements &
   limitations* below). **Save** / **Reload** persist and re-read the config;
   **Free All** clears every slot.

The status card polls every 5 s and shows running state, decode/upload counts and
the last upload time. A **📶 REPORTING** badge appears on the main waterfall while
reporting is active.

> **"0 sent" for the first few minutes is normal.** PSK Reporter uploads batch
> every **5 minutes** and wsprnet every **2 minutes** — spots queue until the next
> flush. The status card shows the pending count and cadence.

### Resource requirements & limitations

The daemon is deliberately lightweight and runs on low-resource hardware (a
4-core i5 is fine), but there are real limits to be aware of.

**CPU pinning is config-aware.** Both spectrumserver (`xgo.sh`) and the autorun
daemon (`admin_server.py`) derive their `taskset` core range from the CPU count
at launch, so neither names a core that doesn't exist. spectrumserver takes the
lower cores, autorun the top few — they never overlap:

| Logical CPUs | spectrumserver | autorun daemon |
|---|---|---|
| ≤ 4 | *unpinned* | *unpinned* |
| 6 | `0-4` | `5` |
| 8 | `0-5` | `6-7` |
| 12 (e.g. i5-12450H, 8P+4E) | `0-7` | `8-11` |
| 16 | `0-11` | `12-15` |

On a **4-core (or fewer)** machine there is nothing to segregate, so both launch
*unpinned* and share all cores — correct and safe, but the SDR FFT and the decode
bursts compete for the same cores.

**Known limitations:**

1. **The real bottleneck is spectrumserver + SDR bandwidth, not the daemon.** An
   RX888 @ 30 MHz needs OpenCL/GPU; a low-core CPU without a capable GPU cannot
   sustain that FFT. Pair low-resource hardware with a narrower SDR (RSP1A ≈ 10 MHz,
   RTL-SDR ≈ 2.4 MHz).
2. **WSPR is the CPU long pole.** Its Fano decoder is a JS port (~30 s per band,
   single-threaded). The 4-worker pool runs 4 decodes in parallel; enabling **more
   than ~4 WSPR bands** at once can queue past the 120 s slot, especially while the
   SDR is competing for cores. FT8/FT4 decodes are cheap by comparison.
3. **Slot-count scaling.** The ~2–2.5 cores / 600–700 MB figure is for the full
   ~28 slots on an 8-core box. On 4 shared cores, keep it to a handful of bands
   (guideline: ≤ 6 FT8/FT4 + ≤ 3 WSPR) and watch the pool's `queued` stat.
4. **Pinning assumes Intel hybrid topology** (lower cores = faster P-cores). On
   AMD or CPUs with interleaved SMT numbering the split is still valid (no overlap,
   no crash) but "lower cores are faster" may not literally hold, and on a
   hyperthreaded 4C/8T part the top cores are SMT siblings — confined, not fully
   isolated. There is currently **no manual core override** — the range is always
   auto-derived.
5. **Band coverage is limited by the receiver.** The RX888 config
   (`sps=60000000` → 30 MHz Nyquist) cannot reach 6 m and above; the band table is
   160 m–10 m. Other SDRs cover whatever their tuned window allows.
6. **Reporting cadence.** PSK Reporter flushes every 5 min, wsprnet every 2 min —
   "0 sent" in the first few minutes is normal, not a fault.

### Files and endpoints

| Item | Purpose |
|---|---|
| `autorun.json` | Saved config (identity, slots, destinations, max slots). Written by the tab; git-ignored. |
| `autorun-status.json` | Live status the status card reads (pid, counts, last upload). Written every 15 s; removed on stop. |
| `frontend/dist/autorun-active.json` | Public badge data served at `/autorun-active.json`. Empty when reporting is off. |
| `autorun.log` | Daemon stdout/stderr. |
| `GET/POST /admin/api/autorun/config` | Read / write `autorun.json` (validates callsign, grid, band/mode combos, slot cap). |
| `GET /admin/api/autorun/status` | Running state (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Spawn (`taskset -c <auto> node autorun/index.js`) / `SIGTERM`. The core range is derived from the CPU (see below). |

> **Note:** after upgrading `admin_server.py` you must `./manage_admin.sh restart`
> to load new autorun routes or an updated band/mode matrix. The daemon runs as a
> separate process, so it survives admin-panel restarts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Admin panel not starting | Check `admin.log` — usually a missing Python package |
| Proxy not starting | Run `python3 -c "import aiohttp"` — if it fails: `pip3 install aiohttp --break-system-packages` |
| Proxy starts but waterfall is blank | Check `sdr_host` in `admin_config.json` — must be your LAN IP, not `127.0.0.1` |
| Kick button says "no connections" | Run `getcap $(which ss)` — if no `cap_net_admin`, run `sudo setcap cap_net_admin+ep $(which ss)` |
| Status always shows OFFLINE | Go to Settings → SDR Process Name — set it to the exact name shown by `ps -eo comm,args \| grep -v grep` |
| Users page shows no data | Verify the endpoint works: `curl http://127.0.0.1:<public_port>/users` |
| External browser gets NetworkError | Check proxy is running: `./manage_admin.sh status` |
| Ports wrong after network change | Update `sdr_host` in `admin_config.json` and run `./manage_admin.sh restart` |
| Chat delete button has no effect | Check write permission on the chat log file: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Waterfall message not appearing | Confirm the proxy is running (`./manage_admin.sh status`) and the frontend is on a recent build that includes the overlay renderer |
| Waterfall message lost after restart | Expected — message state is in-memory only; re-send it after restarting the admin panel |
| Spot Reporting "Start" fails / daemon exits immediately | Check `autorun.log`. Usually the missing `autorun/node_modules` symlink (`ln -sfn ../frontend/node_modules autorun/node_modules`) or `taskset` not installed (`sudo apt install -y util-linux`). |
| Spot Reporting: daemon runs but `decodes` stays 0 and `autorun.log` shows `504` / `tap closed 1006` | The audio tap can't reach spectrumserver. The daemon auto-detects the port from the **running** server's config; the `[autorun] tap backend: HOST:PORT` log line must match your `[server] port`. If it's wrong (or the server wasn't running at start), pin it in `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9002 }`, then Stop→Start. |
| Spot Reporting shows "0 sent" | Normal for the first few minutes — PSK Reporter flushes every 5 min, wsprnet every 2 min. Confirm a destination is enabled and the daemon is running. |
| New bands/modes not showing in the matrix | Restart the admin panel: `./manage_admin.sh restart` (the matrix is loaded at admin start). |
| `autorun.log` shows `MODULE_TYPELESS_PACKAGE_JSON` / "Reparsing as ES module … performance overhead" | Cosmetic warning (decoding still works). `frontend/src/modules/package.json` is missing `"type": "module"`; add that line near the top, then Stop→Start. No frontend rebuild needed — the daemon imports the source file directly. |
| Spot Reporting "Start" fails with `taskset: … Invalid argument` on an old/small PC | Should not happen with the config-aware launcher — the core range is derived from the CPU count and goes unpinned on ≤ 4 cores. If seen, `admin_server.py` predates that change; update it (`_autorun_taskset_prefix`) and `./manage_admin.sh restart`. |
| REPORTING badge not on the waterfall | Reporting must be ON with at least one slot; the badge reads `/autorun-active.json`. Rebuild the frontend if `dist/index.html` predates the badge. |
