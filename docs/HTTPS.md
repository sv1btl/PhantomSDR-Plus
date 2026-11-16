# Secure Access — https://

A PhantomSDR-Plus station can be reached over **https://** as well as http://. The browser then shows the padlock, the connection is encrypted, and browsers allow the page their better audio path (the AudioWorklet), which they keep from plain http pages. The http address keeps working exactly as before, side by side.

It is done by **Caddy**, a small web server placed in front of the receiver on port 443. Caddy obtains a free certificate from **Let's Encrypt** for your station's DNS name and renews it by itself, every couple of months, with nothing for you to do. If you already run a reverse proxy of your own that holds the certificate (nginx, Nginx Proxy Manager, Apache, Traefik …), PhantomSDR-Plus works behind it instead — see *Your own reverse proxy* below.

---

## What you need

| | |
|---|---|
| **A DNS name** | Let's Encrypt certifies names, not bare IP addresses. A free dynamic-DNS name (no-ip, DuckDNS, dynu and the like) pointing at your public address is fine, and it may change address — the name follows. |
| **Two more ports on the router** | Forward TCP **443** (https) and TCP **80** to the receiver computer, as well as your public port (9000). Port 80 is only used to prove to Let's Encrypt that the name is yours when the certificate is issued and renewed. |
| **A station set up with the station questions** | `station.conf` must exist. On a station installed before the station questions, run `bash configure-station.sh` once first — it offers the ports your station already uses, so nothing moves. |

---

## Turning it on

### At installation

Among the station questions, under **Internet**, choose **2** at the https question:

```
    1  no https
    2  https through Caddy, set up here: a free Let's Encrypt certificate,
       renewed by itself; needs a DNS name above and ports 443 and 80 open
    3  my own reverse proxy (nginx, Nginx Proxy Manager, Apache, Caddy,
       Traefik …) already serves https:// and forwards to this receiver
  https? [1]: 2
```

The installer installs Caddy, obtains the certificate and, at the end, shows both addresses.

### On a station that already runs

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

It reads your DNS name from `station.conf`, installs Caddy (from your distribution; on Ubuntu 22.04 from Caddy's own repository), points it at the receiver, rebuilds the page so that it links its https address, restarts the proxy, and waits for the certificate. Choosing **2** at the https question of `bash configure-station.sh` does exactly the same.

When it finishes:

```
  ✔ https://myname.ddns.net/ is live

  https://myname.ddns.net/   — and http://myname.ddns.net:9000/ as before
```

### Checking and turning it off

```bash
bash setup-https.sh --status    # is it on, and does the certificate answer?
bash setup-https.sh --remove    # turn https off; http stays exactly as it is
```

The admin panel shows the same under **Settings → HTTPS**: **🔍 CHECK** on an https station, and on an http-only one **🔒 SET UP HTTPS**, which checks what it can and gives the commands above to copy into a terminal. See [Admin Panel](ADMIN_PANEL_SETUP.md).

Changing the DNS name later with `bash configure-station.sh` moves Caddy to the new name by itself.

---

## How it works

```
  visitor ──https──► Caddy :443 ──► proxy.py :9014 (this computer only) ──► spectrumserver, panel, RADE …
  visitor ──http───────────────────► proxy.py :9000 ───────────────────────► the same
```

| Port | What | Open on the router |
|---|---|---|
| 443 | Caddy — https | yes |
| 80 | Caddy — the certificate check, and a redirect to https | yes |
| 9000 | proxy.py — http, as before | yes |
| 9014 | proxy.py — where Caddy hands the visitors over | no — inside the computer |

---

## What changes for listeners

- **Both addresses work.** Directories and the websdr.org map keep listing the http address; websdr.org's callback and Kiwi clients use http.
- **Better audio over https.** Browsers give a secure page the AudioWorklet, a steadier audio path than the one plain http pages have to use.
- **Receive Diversity with http-only partners.** A browser does not let an https page open plain `ws://` connections, and most PhantomSDR+ stations and every KiwiSDR offer nothing else. From the https page they are therefore reached through the station's diversity relay — see *Receive Diversity over https* below. Partners that have https themselves, and UberSDRs, are reached directly.
- **Rig control (TCI-CAT).** Connections to `127.0.0.1` on the listener's own computer are allowed from an https page in current Chrome, Edge and Firefox. The page connects only once the listener opens **TCI-CAT** or turns **CAT Sync** on; Chrome and Edge then ask once for permission to reach apps and devices on the listener's own computer or network. Refusing it only disables TCI-CAT.

---

## Receive Diversity over https

An https page reaches http-only diversity partners — most PhantomSDR+ stations, every KiwiSDR — through the station's own relay, `websdr_relay.py`, the same one that serves WebSDR partners. The browser connects securely to `wss://myname.ddns.net/relay/…`, and the relay connects onward over `ws://`. The panel does this by itself. The relay carries diversity audio only (PhantomSDR+ `/audio`, KiwiSDR `/kiwi/…/SND`), connects only to public addresses, and keeps its usual limits. Without it running, an https page reaches only partners that have https themselves.

So on an https station, keep the relay on:

- **Turning https on with the station questions:** once https is on, the relay question that follows defaults to yes — keep it, and the relay is installed and started as well. `bash setup-https.sh` on its own does not install it.
- **A station that already runs https:** check with `systemctl is-active phantomsdr-websdr-relay`. If it is not active, run `bash setup_websdr_relay.sh`, or `bash configure-station.sh` and answer yes to the relay question. Behind the proxy it needs no router port and no rebuild.
- **Check:** `https://myname.ddns.net/relay/status` answers with a few lines beginning `"service": "PhantomSDR-Plus WebSDR relay"`.

Through the relay the partner sees your station's address, not the listener's, so a partner with a per-IP limit counts all your relayed listeners together. A station served over http only needs none of this: an http page opens `ws://` and `wss://` connections directly.

---

## The local network only — `--lan`

Without a DNS name, https can still be used inside the house:

```bash
bash setup-https.sh --lan
```

Caddy then issues its own certificate for the computer's local address and name. Browsers do not know that certificate and warn the first time; accept it, or make the computers you use trust Caddy's root certificate:

- on the receiver computer itself: `sudo caddy trust`
- on another computer: copy `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` from the receiver (the exact path is printed by `sudo caddy environ`, under `caddy.AppDataDir`) and import it into the browser or the system as a trusted authority.

---

## Your own reverse proxy

If you already run a reverse proxy that serves https:// for your domains — nginx, Nginx Proxy Manager, Apache, Caddy, Traefik — PhantomSDR-Plus works behind it, and no Caddy is installed. Choose **3** at the https question:

```bash
bash configure-station.sh        # https question: 3
```

The wizard then asks where your proxy connects from:

| Your proxy runs | Answer |
|---|---|
| on this computer | `127.0.0.1` |
| on another computer | its address, e.g. `192.168.1.20` |
| in Docker on this computer (e.g. Nginx Proxy Manager) | `172.16.0.0/12` |

Several addresses are separated by spaces. The answer is saved as `STATION_PROXY_FROM` in `station.conf`, next to `STATION_HTTPS="external"`, and kept by updates and later runs of the wizard. The page then links its https address, the diversity relay is on by default, and the wizard ends with everything your proxy needs. It prints that again at any time:

```bash
bash configure-station.sh --proxy-guide
```

In short:

- **One site, one port.** Forward `https://your.name/` — all of it — to `http://<this computer>:9014/`. The page, `/admin`, `/stats`, `/rade`, `/drm` and `/relay` all come through that one address.
- **WebSockets on.** Audio, waterfall and chat are WebSockets: the proxy must pass `Upgrade` and `Connection`, and allow connections that stay open for a day. In Nginx Proxy Manager, tick **Websockets Support**.
- **The visitor's address** in `X-Forwarded-For` (most proxies add it by themselves). Port 9014 believes that header only from the addresses you gave; any other address gets **403**, so nobody can pass for someone else.
- **Keep internal** 9001–9015: never forward them on the router. Forward 443 (and 80, if your proxy fetches its certificate over it) to your proxy, and keep 9000 forwarded as well for http:// — websdr.org, sdr-list and http-only diversity partners use it.

For nginx, inside the `server { … }` block of your https site (with the proxy on another computer, write this computer's address instead of `127.0.0.1`):

```nginx
location / {
    proxy_pass http://127.0.0.1:9014;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1d;
}
```

For Apache 2.4.47 or newer (with `mod_proxy`, `mod_proxy_http` and `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket timeout=86400
ProxyPassReverse / http://127.0.0.1:9014/
```

Caddy: `your.name { reverse_proxy 127.0.0.1:9014 }`. Traefik: a service with the URL `http://127.0.0.1:9014`; WebSockets pass by themselves.

Then check it from the receiver computer:

```bash
bash setup-https.sh --status
```

It checks that port 9014 listens, that `https://your.name/` answers, that a WebSocket gets through your proxy, and that the page's settings hold no http:// address of the station (an https page cannot load one: mixed content). The admin panel's **🔍 CHECK** shows the same.

If `bash setup-https.sh` finds another web server on port 443 or 80, it does not take it over: it stops and points here.

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| `no certificate yet` | The DNS name must point at your public address (`ping myname.ddns.net` from outside your network), and the router must forward 443 and 80 to this computer. Caddy keeps trying by itself; its log: `sudo journalctl -u caddy -n 50`. |
| The provider blocks port 80 | Caddy also proves the name over port 443 alone, so 443 is enough in most cases; leave 80 forwarded if you can. |
| `too many failed authorizations` in Caddy's log | Let's Encrypt allows a few failures per hour. Fix the cause, wait an hour, then `sudo systemctl restart caddy`. |
| Caddy's log shows `Invalid response … /.well-known/acme-challenge/…` (a 502 or the receiver's page), or `Timeout during connect` | The router sends 80 or 443 somewhere else — often to the receiver's public port. The rules must be TCP 80 → this computer, port **80**, and TCP 443 → this computer, port **443**; switch off the router's own remote management on those ports. Then `sudo systemctl restart caddy` to try again at once. |
| https works at home but not from outside | The router forwards 443 to another computer, or not at all. |
| The listener list or the users panel is empty over https | Run `bash configure-station.sh` once and say yes to the rebuild: the page must know its https address. |
| `Port 443 is already used by another web server` | See *Your own reverse proxy* above. |
| Behind your own proxy: the page loads, but no audio and no waterfall | The proxy does not pass WebSockets. nginx: the `Upgrade` and `Connection` lines; Nginx Proxy Manager: **Websockets Support**. `bash setup-https.sh --status` tests it. |
| Behind your own proxy: `forbidden: not the station's https front` | Your proxy connects from an address that is not in `STATION_PROXY_FROM` — Docker uses networks of its own (`172.16.0.0/12`). Run `bash configure-station.sh` and add it. |
| Behind your own proxy: every listener has the same address, or the fourth is refused | The proxy forwards to 9000 instead of 9014, or sends no `X-Forwarded-For`. |
