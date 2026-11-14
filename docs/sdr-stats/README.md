# System Stats Installation Guide

A comprehensive guide to add real-time server monitoring to your PhantomSDR application using the automated installation script.

## Overview

This feature adds a **📊 Stats** button to your PhantomSDR interface that displays real-time system information:
- CPU usage, cores, frequency, temperature, and top processes
- Memory usage (used/total/percentage)

Stats automatically update every 5 seconds while the modal is open.

> **Not the same as the admin panel's Graphs page.** This modal is a live snapshot that refreshes while it is open and keeps no history. The admin panel has a separate **Graphs** page that samples CPU frequency, load, temperature and users online every 2 seconds and plots them over the last 15 minutes to 24 hours — see the [Admin Panel guide](../ADMIN_PANEL_SETUP.md).

---

## Prerequisites

- **Linux server** (Ubuntu/Debian recommended)
- **Internet connection** (for downloading Node.js and packages)
- **Sudo access** (for systemd service setup)
- **PhantomSDR-Plus** already installed and running
- **lm-sensors** (recommended for Intel/AMD CPU temperature - automatically installed by script)

---

## Installation Methods

> [!NOTE]
> **The main installer already offers this.** `./install.sh` — and the four distro installers — run `install-stats-server.sh` by default as part of the normal PhantomSDR-Plus installation, so on a fresh machine the stats server is usually already in place. Use this page to install it separately, or to change its port, address or service afterwards.

### Option 1: Automated Installation (Recommended) ⭐

The automated script handles everything for you.

#### Step 1: Run the script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANT:** Do NOT run as root or with sudo. Run as your regular user.

#### Step 2: Follow the interactive prompts

The script will guide you through:

##### 1. **Node.js Installation** (if needed)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
The script installs Node.js 22 through nvm, on any Linux distribution — no root and no apt source needed. It asks the same question when Node.js is present but older than 22.

##### 2. **Installation Directory**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Press Enter for default, or specify a custom path.

##### 3. **Port Configuration** (Enhanced!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Server Address**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Enter your server's public domain or IP address.

##### 5. **Confirmation**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Systemd Service Setup** (Optional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recommended: Choose **y** to have the server start automatically on boot.

#### Step 3: Installation Complete! ✓

The script will display a summary:
```
Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 9011
  API URL: http://localhost:9011/api/system-stats (inside this computer)

Next steps:

Nothing to edit: configure-station.sh already pointed the receiver page
at /stats, which the proxy on port 9000 carries to this
server. No extra port has to be opened on the router.

╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
╚════════════════════════════════════════════════╝
```

---

## Configure Your PhantomSDR Application

On a station set up by `install.sh` there is nothing to do here: the station questions already wrote `siteStats` as `/stats`, and `proxy.py` carries it on the public port 9000, so no other port is opened on the router.

### `site_information.json`

The line in `site_information.json` looks like this:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:9000",
  "siteStats": "/stats",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Testing the Installation

### Test 1: Check API Endpoint

```bash
curl http://localhost:9011/api/system-stats
```

Expected output (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2: Check Service Status

If you installed as a service:

```bash
sudo systemctl status sdr-stats.service
```

Should show: `Active: active (running)`

### Test 3: Test in Browser

1. Open your PhantomSDR web interface
2. Scroll to **Additional Info** section
3. Click **Open Additional Info** button
4. Look for the **📊 Stats** button next to PC info
5. Click it to open the stats modal
6. Verify stats are displaying and updating

---

## Service Management

If you installed as a systemd service, use these commands:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Changing the Port After Installation

Run `bash configure-station.sh` again and give the statistics a new port. It moves the server's service setting and the proxy with it; the page keeps using `/stats`, so nothing else changes and nothing is opened on the router.

---

## Troubleshooting

### Issue: Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Solution:**

1. Find what's using the port:
```bash
sudo lsof -i :9011
```

2. Stop that process:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Start the service again:
```bash
sudo systemctl start sdr-stats.service
```

**Alternative:** Run the installation script again and choose a different port when prompted.

### Issue: Service won't start

**Error:**
```
status=217/USER
```

**Solution:**

1. Check the service file:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Verify the `User=` line matches your username:
```bash
whoami
```

3. Edit if needed:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Issue: Stats not showing in browser

**Symptoms:** Modal opens but no data, or shows 0 values

**Solutions:**

1. Check browser console (F12) for errors
2. Verify API is accessible:
```bash
curl http://localhost:9011/api/system-stats
```
3. Check service is running:
```bash
sudo systemctl status sdr-stats.service
```
4. Verify that `siteStats` in `site_information.json` is `/stats` and that `proxy.py` is running
5. Check CORS errors - ensure server allows your domain

### Issue: Temperature shows null

**Cause:** Temperature reading not available on your system

**Solutions:**

1. **For most Linux systems:** Check if thermal zone exists:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Install lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Note:** Temperature may not be available on:
- Virtual machines
- Some VPS providers
- Windows Subsystem for Linux (WSL)
- Non-Linux systems

This is normal - the rest of the stats will still work!

### Issue: Node.js not found

**Error:**
```
node: command not found
```

**Solution:**

1. Install Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Verify:
```bash
node --version
npm --version
```

---

## What You'll See

Once installed and configured, the stats modal displays:

### 🖥️ CPU Section
- **Usage**: Overall CPU utilization percentage
- **Cores**: How much of the CPU is actually in use, expressed as whole cores — e.g. `1.3 / 12 in use` means the machine is doing 1.3 cores' worth of work. This is exact and needs no threshold. It is deliberately not a count of busy cores: the scheduler spreads one core's work across many, so any such count would only ever approximate this figure.
- **Frequency**: Average current CPU clock across all cores in GHz, with the fastest core in parentheses (if available)
- **Temperature**: CPU temperature in Celsius (if available), colour-coded: 🟢 green up to 69 °C, 🟠 orange 70-79 °C, 🔴 red at 80 °C and above
- **Top Processes**: Top 5 CPU-consuming processes with color-coded percentages:
  - 🟢 Green: up to 50% CPU
  - 🟠 Orange: 51-80% CPU
  - 🔴 Red: above 80% CPU

### 💾 Memory Section
- **Used**: Memory in use (GB)
- **Total**: Total system memory (GB)
- **Usage**: Memory usage percentage (color-coded)

### ♻️ Auto-Update
- Stats refresh every **5 seconds** while modal is open
- Stops updating when you close the modal (saves resources)

---


## Security Notes

- The stats server accepts connections from any origin (CORS: *)
- For production, consider restricting CORS to your domain only
- Port selection validates input and checks for conflicts
- CPU temperature reading is read-only and safe
- No sensitive system information is exposed

---

## Support & Resources

### Unistall stats-server:
- Delete the folder /sdr-stats-server
- If you've created a service, just delete it using:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modify `App.svelte`: Find the part of the code:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  and replace with:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Recompile using the command:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Restart the PC and start the server

---

## Quick Command Reference

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:9011/api/system-stats # Test API
curl http://localhost:9011/api/health       # Health check

# Troubleshooting
sudo lsof -i :9011                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Happy monitoring! 📊🚀
