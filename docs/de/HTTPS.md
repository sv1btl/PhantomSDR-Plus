# Sicherer Zugang — https://

Eine PhantomSDR-Plus-Station kann über **https://** ebenso wie über http:// erreichbar sein. Der Browser zeigt dann das Schloss, die Verbindung ist verschlüsselt, und Browser erlauben der Seite ihren besseren Audioweg (das AudioWorklet), den sie reinen http-Seiten verweigern. Die http-Adresse funktioniert genau wie bisher weiter, Seite an Seite.

Das übernimmt **Caddy**, ein kleiner Webserver, der vor dem Empfänger auf Port 443 sitzt. Caddy holt für den DNS-Namen Ihrer Station ein kostenloses Zertifikat von **Let's Encrypt** und erneuert es selbstständig alle paar Monate, ohne dass Sie etwas tun müssen.

---

## Was Sie brauchen

| | |
|---|---|
| **Einen DNS-Namen** | Let's Encrypt zertifiziert Namen, keine nackten IP-Adressen. Ein kostenloser Dynamic-DNS-Name (no-ip, DuckDNS, dynu und ähnliche), der auf Ihre öffentliche Adresse zeigt, genügt, und die Adresse darf sich ändern — der Name folgt ihr. |
| **Zwei weitere Ports am Router** | Leiten Sie TCP **443** (https) und TCP **80** auf den Empfängerrechner weiter, zusätzlich zu Ihrem öffentlichen Port (9000). Port 80 dient nur dazu, Let's Encrypt beim Ausstellen und Erneuern des Zertifikats zu beweisen, dass der Name Ihnen gehört. |
| **Eine mit den Stationsfragen eingerichtete Station** | `station.conf` muss vorhanden sein. Auf einer Station, die vor den Stationsfragen installiert wurde, einmal zuerst `bash configure-station.sh` ausführen — es schlägt die Ports vor, die Ihre Station schon verwendet, also ändert sich nichts. |

---

## Einschalten

### Bei der Installation

Bei den Stationsfragen, in der Gruppe **Internet**, mit Ja antworten auf:

```
  Also serve the receiver over https://? [y/N]: y
```

Der Installer installiert Caddy, holt das Zertifikat und zeigt am Ende beide Adressen.

### Auf einer laufenden Station

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

Es liest Ihren DNS-Namen aus `station.conf`, installiert Caddy (aus Ihrer Distribution; unter Ubuntu 22.04 aus Caddys eigenem Repository), richtet ihn auf den Empfänger aus, baut die Seite neu, damit sie ihre https-Adresse verlinkt, startet den Proxy neu und wartet auf das Zertifikat. Ein Ja auf die https-Frage in `bash configure-station.sh` bewirkt genau dasselbe.

Am Ende:

```
  ✔ https://myname.ddns.net/ is live

  https://myname.ddns.net/   — and http://myname.ddns.net:9000/ as before
```

### Prüfen und ausschalten

```bash
bash setup-https.sh --status    # ist es an, und antwortet das Zertifikat?
bash setup-https.sh --remove    # https ausschalten; http bleibt genau wie es ist
```

Ändern Sie den DNS-Namen später mit `bash configure-station.sh`, zieht Caddy von selbst auf den neuen Namen um.

---

## Wie es funktioniert

```
  visitor ──https──► Caddy :443 ──► proxy.py :9014 (this computer only) ──► spectrumserver, panel, RADE …
  visitor ──http───────────────────► proxy.py :9000 ───────────────────────► the same
```

| Port | Was | Am Router offen |
|---|---|---|
| 443 | Caddy — https | ja |
| 80 | Caddy — die Zertifikatsprüfung und eine Umleitung auf https | ja |
| 9000 | proxy.py — http, wie bisher | ja |
| 9014 | proxy.py — hier übergibt Caddy die Besucher | nein — im Rechner |

Caddy erreicht den Proxy über einen eigenen Port, weil aus Sicht des Proxys sonst jeder Besucher, der über Caddy kommt, vom Rechner selbst käme — und einer Anfrage vom Rechner selbst wird vertraut: Sie darf Hörer trennen und zählt nicht für die Pro-IP-Grenzen. Auf Port 9014 übernimmt der Proxy die echte Adresse des Besuchers von Caddy und hält einen Besucher nie für lokal; Hörerliste, Pro-IP-Grenzen und der Kick des Sysops funktionieren deshalb genau wie über http, und niemand kann über https einen Hörer kicken.

---

## Was sich für die Hörer ändert

- **Beide Adressen funktionieren.** Verzeichnisse und die websdr.org-Karte zeigen weiter die http-Adresse; der Rückruf von websdr.org und Kiwi-Clients verwenden http.
- **Besserer Ton über https.** Browser geben einer sicheren Seite das AudioWorklet, einen stabileren Audioweg als den, den reine http-Seiten nutzen müssen.
- **Receive Diversity mit Partnern nur über http.** Ein Browser erlaubt einer https-Seite keine einfachen `ws://`-Verbindungen; von der https-Seite aus lässt sich daher keine Partnerstation hinzufügen, die nur http hat. Partner mit https funktionieren, und WebSDR-Partner funktionieren über das Relay. Für einen Partner nur mit http verwenden Sie die http-Adresse der Seite.
- **Funkgerätesteuerung (TCI-CAT).** Verbindungen zu `127.0.0.1` auf dem eigenen Rechner des Hörers sind von einer https-Seite in aktuellen Chrome-, Edge- und Firefox-Versionen erlaubt.

---

## Nur im lokalen Netz — `--lan`

Ohne DNS-Namen lässt sich https im Haus trotzdem nutzen:

```bash
bash setup-https.sh --lan
```

Caddy stellt dann ein eigenes Zertifikat für die lokale Adresse und den Namen des Rechners aus. Browser kennen dieses Zertifikat nicht und warnen beim ersten Mal; akzeptieren Sie es, oder lassen Sie die Rechner, die Sie benutzen, Caddys Stammzertifikat vertrauen:

- auf dem Empfängerrechner selbst: `sudo caddy trust`
- auf einem anderen Rechner: `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` vom Empfänger kopieren (den genauen Pfad zeigt `sudo caddy environ` unter `caddy.AppDataDir`) und im Browser oder im System als vertrauenswürdige Zertifizierungsstelle importieren.

---

## Auf diesem Rechner läuft schon ein Webserver

Belegen nginx, Apache oder eine andere Caddy-Einrichtung bereits Port 443 oder 80, übernimmt `setup-https.sh` ihn nicht: Es hält an und zeigt, was Sie stattdessen in Ihren Server eintragen. Für nginx, im `server { … }`-Block Ihrer https-Seite:

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

Für Apache (mit `mod_proxy`, `mod_proxy_http` und `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:9014/
```

Markieren Sie die Station dann in `station.conf` als https, damit der Proxy Port 9014 öffnet und die Seite ihre https-Adresse verlinkt — der Assistent meldet noch einmal, dass der Port belegt ist, das ist zu erwarten:

```bash
STATION_HTTPS=y bash configure-station.sh
```

---

## Fehlersuche

| Symptom | Was prüfen |
|---|---|
| `no certificate yet` | Der DNS-Name muss auf Ihre öffentliche Adresse zeigen (`ping myname.ddns.net` von außerhalb Ihres Netzes), und der Router muss 443 und 80 an diesen Rechner weiterleiten. Caddy versucht es selbstständig weiter; sein Log: `sudo journalctl -u caddy -n 50`. |
| Der Provider sperrt Port 80 | Caddy beweist den Namen auch allein über Port 443, meist genügt also 443; lassen Sie 80 weitergeleitet, wenn möglich. |
| `too many failed authorizations` in Caddys Log | Let's Encrypt erlaubt nur wenige Fehlversuche pro Stunde. Ursache beheben, eine Stunde warten, dann `sudo systemctl restart caddy`. |
| https geht zu Hause, aber nicht von außen | Der Router leitet 443 an einen anderen Rechner oder gar nicht weiter. |
| Hörerliste oder Benutzer-Panel über https leer | Einmal `bash configure-station.sh` ausführen und den Neubau bejahen: Die Seite muss ihre https-Adresse kennen. |
| `Port 443 is already used by another web server` | Siehe oben *Auf diesem Rechner läuft schon ein Webserver*. |
