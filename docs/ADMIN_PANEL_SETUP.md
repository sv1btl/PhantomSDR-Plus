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
