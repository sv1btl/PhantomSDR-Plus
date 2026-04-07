# PhantomSDR-Plus Admin Panel — Setup Guide
# ---
# It is strongly recommended to keep this admin panel private and to use it inside your home network. Public access to this panel may cause security problems.

## What you need
- Ubuntu 22.04
- PhantomSDR-Plus already installed and working
- Port open in your firewall (e.g. 3000)
- Install dependencies (optional. The script will install what needed)
```
pip3 install flask psutil --break-system-packages
```
---

## Step 1 — The files

- Ensure that `admin_server.py` that is inside your PhantomSDR-Plus folder
- Ensure that 'setup_admin.sh` is inside your PhantomSDR-Plus folder and it is ececutable:

```
chmod +x setup_admin.sh
chmod +x manage_admin.sh
```
- Run it and follow instructions:
```
./setup_admin.sh
```

- Select the port. You have to open this particular port in the router (not recommended). Default is 3000, but you can use any port you like. After install, two files will be created, admin.log & admin_config.json

- During setup, you'll be asked if you want to create systemctl script for auto start the admin panel after the boot. You can avoid it, if you want to start it manually.

---

## Step 2 — Run, Stop, Restart it

```
cd ~/PhantomSDR-Plus
./manage_admin.sh start
```

```
cd ~/PhantomSDR-Plus
manage_admin.sh stop
```

```
cd ~/PhantomSDR-Plus
manage_admin.sh restart
```
If running as a systemd service:
```
cd ~/PhantomSDR-Plus
sudo systemctl start phantomsdr-admin
sudo systemctl stop phantomsdr-admin
sudo systemctl restart phantomsdr-admin
sudo systemctl status phantomsdr-admin
```

- Open your browser: `http://YOUR_SERVER_IP:3000/admin`  
- Default password: **admin**

> ⚠️ **Change the password immediately** in Settings after first login.

---

## Step 3 — Run it permanently (survives reboots)

Create a service file:
```
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Paste this — edit `User` and `WorkingDirectory` to match your setup:
```ini
[Unit]
Description=PhantomSDR-Plus Admin Panel
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/PhantomSDR-Plus
ExecStart=/usr/bin/python3 /path/to/PhantomSDR-Plus/admin_server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```
sudo systemctl daemon-reload
sudo systemctl enable phantomsdr-admin
sudo systemctl start phantomsdr-admin
```

Check it is running:
```
sudo systemctl status phantomsdr-admin
```

---

## Step 4 — Open the port in firewall

```
sudo ufw allow 3000
```

## Step 5 — Run the Admin Panel

you will see:
- **Dashboard** with some information of your running server and a terminal window, where you can run commands
- **Config Editor** select a file to see, edit and save it
- **Site Info** select a .json file to see it
- **Markers** to see and edit them
- **Log Viewer** you can change what log file you want to see by changing the code in admin_server.py lines 351 & 1870. Replace e.g. base / "logwebsdr.txt" with the log file of your choice. The results will be shown also in Dashboard -> RECENT LOG OUTPUT
- **Chat History** you can see the chat history or clear it, but the changes will be shown after server's restart.
- **Settings** Manage password for the Admin Panel.

---

## Useful commands with systemctl service

| What | Command |
|---|---|
| Start | `sudo systemctl start phantomsdr-admin` |
| Stop | `sudo systemctl stop phantomsdr-admin` |
| Restart | `sudo systemctl restart phantomsdr-admin` |
| View logs | `sudo journalctl -u phantomsdr-admin -f` |

---

## Working with proxy.py (optional)
1. Install dependency
```
sudo apt install python3-aiohttp
```

2. Configure proxy.py
In the first lines of the file you will find this:
```
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8901
ADMIN_UPSTREAM  = "http://127.0.0.1:3000"
SDR_UPSTREAM    = "http://127.0.0.1:8900"
```
change the values with the actual you use, where LISTEN_PORT is the new port that proxy will hear, ADMIN_UPSTREAM is the port you've selected for admin panel during setup and SDR_UPSTREAM is the port that spectrumserver (the main SDR server) uses. <br/>
You can forward LISTEN_HOST on your router (not recommended).

3. After all these please run: 
./manage_admin.sh start    # start both admin + proxy
./manage_admin.sh stop     # stop both
./manage_admin.sh restart  # restart both
./manage_admin.sh status   # check if running

From now on you can listen your PhantomSDR through the older port, or the newer one proxy uses. The Admin panel will be either on the older port you've defined during setup AND the newer via proxy in form http://your_ip:proxy_port/admin

## Other Useful commands

- python3 /home/sv1btl/PhantomSDR-Plus/admin_server.py & (manually start the server)
- pkill -f admin_server.py (manually kill the server)
- sudo fuser -k 3000/tcp (free the use of the used port, in case starting the server is refused due to "the port is used")

## Access

**Without using proxy:**
Your server is:
```
http://YOUR_SERVER_IP:8900
```
or any other port you've defined

and your admin panel

```
http://YOUR_SERVER_IP:3000/admin
```
or any other port you've defined

---

**or (using proxy):**
```
http://YOUR_SERVER_IP:8901/admin
```
and your server will be when using proxy:
```
http://YOUR_SERVER_IP:8901
```
or any other port you've defined.

