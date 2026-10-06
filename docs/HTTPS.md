# Secure Access — https://

A PhantomSDR-Plus station can be reached over **https://** as well as http://. The browser then shows the padlock, the connection is encrypted, and browsers allow the page their better audio path (the AudioWorklet), which they keep from plain http pages. The http address keeps working exactly as before, side by side.

It is done by **Caddy**, a small web server placed in front of the receiver on port 443. Caddy obtains a free certificate from **Let's Encrypt** for your station's DNS name and renews it by itself, every couple of months, with nothing for you to do.

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

Among the station questions, under **Internet**, answer yes to:

```
  Also serve the receiver over https://? [y/N]: y
```

The installer installs Caddy, obtains the certificate and, at the end, shows both addresses.

### On a station that already runs

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

It reads your DNS name from `station.conf`, installs Caddy (from your distribution; on Ubuntu 22.04 from Caddy's own repository), points it at the receiver, rebuilds the page so that it links its https address, restarts the proxy, and waits for the certificate. Answering yes to the https question in `bash configure-station.sh` does exactly the same.

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

Caddy reaches the proxy on a port of its own because, seen from the proxy, every visitor coming through Caddy would otherwise come from the computer itself — and a request from the computer itself is trusted: it may disconnect listeners, and it is not counted against the per-IP limits. On port 9014 the proxy takes the visitor's real address from Caddy and never treats a visitor as local, so the listener list, the per-IP limits and the sysop's kick all work exactly as over http, and nobody can kick a listener through https.

---

## What changes for listeners

- **Both addresses work.** Directories and the websdr.org map keep listing the http address; websdr.org's callback and Kiwi clients use http.
- **Better audio over https.** Browsers give a secure page the AudioWorklet, a steadier audio path than the one plain http pages have to use.
- **Receive Diversity with http-only partners.** A browser does not let an https page open plain `ws://` connections, so from the https page a partner station that has only http cannot be added; partners with https work, and WebSDR partners work through the relay. For an http-only partner, use the http address of the page.
- **Rig control (TCI-CAT).** Connections to `127.0.0.1` on the listener's own computer are allowed from an https page in current Chrome, Edge and Firefox.

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

## A web server is already running on this computer

If nginx, Apache or another Caddy setup already uses port 443 or 80, `setup-https.sh` does not take it over: it stops and prints what to add to your server instead. For nginx, inside the `server { … }` block of your https site:

```nginx
location / {
    proxy_pass http://127.0.0.1:9014;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1d;
}
```

For Apache (with `mod_proxy`, `mod_proxy_http` and `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:9014/
```

Then mark the station as https in `station.conf` so that the proxy opens port 9014 and the page links its https address — the wizard will say once more that the port is taken, which is expected:

```bash
STATION_HTTPS=y bash configure-station.sh
```

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| `no certificate yet` | The DNS name must point at your public address (`ping myname.ddns.net` from outside your network), and the router must forward 443 and 80 to this computer. Caddy keeps trying by itself; its log: `sudo journalctl -u caddy -n 50`. |
| The provider blocks port 80 | Caddy also proves the name over port 443 alone, so 443 is enough in most cases; leave 80 forwarded if you can. |
| `too many failed authorizations` in Caddy's log | Let's Encrypt allows a few failures per hour. Fix the cause, wait an hour, then `sudo systemctl restart caddy`. |
| https works at home but not from outside | The router forwards 443 to another computer, or not at all. |
| The listener list or the users panel is empty over https | Run `bash configure-station.sh` once and say yes to the rebuild: the page must know its https address. |
| `Port 443 is already used by another web server` | See *A web server is already running on this computer* above. |
