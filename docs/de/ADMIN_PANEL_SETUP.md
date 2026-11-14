# PhantomSDR-Plus Admin-Panel — Einrichtungsanleitung

> ⚠️ **Sicherheitshinweis:** Halten Sie dieses Admin-Panel in Ihrem Heimnetz oder hinter einem VPN. Eine öffentliche Freigabe des Admin-Ports ist ohne geeignete Absicherung der Authentifizierung nicht zu empfehlen.

---

## Überblick

Das Admin-Panel besteht aus zwei Python-Diensten:

| Dienst | Datei | Rolle |
|---|---|---|
| Admin-Panel | `admin_server.py` | Flask-Webanwendung, bindet an `127.0.0.1` (nur intern) |
| Reverse-Proxy | `proxy.py` | Stellt sowohl das SDR als auch das Admin-Panel auf einem einzigen öffentlichen Port bereit |

Beide Dienste lesen ihre Konfiguration aus `admin_config.json`, das von `setup_admin.sh` geschrieben wird. **Ändern Sie Portkonstanten nicht direkt in den Python-Dateien** — alle Ports und die IP des SDR-Hosts liegen in `admin_config.json`.

---

## Was das Admin-Panel bietet

- **Dashboard** — Serverstatus in Echtzeit, CPU/RAM, Top-Prozesse, aktuelle Protokollausgabe, Terminal
- **Konfigurationseditor** — beliebige `.toml`-, `.sh`-, `.json`-, `.h`- und `.cpp`-Dateien Ihrer Installation ansehen, bearbeiten und speichern
- **Protokollanzeige** — jede Protokolldatei in Echtzeit verfolgen (SDR-Server, Admin-Panel, RADE, Absturz, Autorun, Proxy)
- **Marker** — Frequenzmarker ansehen und bearbeiten
- **Chatverlauf** — das WebSDR-Chatprotokoll ansehen, vollständig leeren oder einzelne Nachrichten löschen, ohne den Server neu zu starten
- **Wasserfallnachricht** — ein dauerhaftes Banner an alle verbundenen Nutzer senden, in Echtzeit auf der Wasserfallanzeige sichtbar
- **Nutzer** — Live-Liste der verbundenen Hörer mit Name oder Rufzeichen, Standort und IP-Adresse, Frequenz, Betriebsart und Dauer, einer ⚡-Kick-Schaltfläche und einem ⛔-Ban-▾-Menü (8, 16 oder 24 Stunden) und einer Karte, wo sie sind
- **Löschen von Chatnachrichten** — 🗑-Delete-Schaltfläche, die genau diese eine Nachricht sofort aus dem Protokoll entfernt
- **Wasserfall-Rundnachrichten** — erlaubt es, ein dauerhaftes Textbanner in den Wasserfall jedes verbundenen Nutzers zu schieben
- **Spot Reporting** — den Autorun-Decoder für FT8/FT4/JS8/WSPR starten/stoppen, Bänder/Betriebsarten wählen und Spots an PSK Reporter / wsprnet melden (standardmäßig AUS), mit zwei Zählern: Kacheln je Decoder für den aktuellen Lauf und ein Gesamtwert seit Beginn neben jedem Band-/Betriebsart-Kontrollkästchen Für jedes Band und jede Betriebsart lassen sich die UTC-Stunden festlegen, und der Daemon kann nach einem Neustart oder Absturz von selbst starten.
- **Graphen** — CPU-Frequenz, CPU-Last, CPU-Temperatur und verbundene Nutzer, aufgezeichnet über die letzten 15 Minuten / 1 Stunde / 4 Stunden / 12 Stunden / 24 Stunden
- **Thermischer Schutz (Thermal Guard)** — stoppt den Server, wenn die CPU überhitzt, und startet ihn wieder, sobald sie abgekühlt ist; die Schwellen leiten sich aus Ihrer eigenen CPU ab. Funktioniert mit jeder Start-/Stopp-Methode und läuft ausgeliefert nur im Protokollmodus, tut also nichts, bis Sie ihn aktivieren
- **Einstellungen** — Admin-Passwort, SDR-Basisverzeichnis, Prozessname und Spectrumserver-Port ändern (der Hörer-Port steht darunter); das Standard-Start- oder -Stopp-Skript mit ▶ START / ■ STOP ausführen; eine **HTTPS**-Karte, die https prüft oder durch das Einschalten führt
- **Empfänger** — jeder Empfänger der Station mit dem Bereich, den er abdeckt, seiner Bandbreite, seiner Verstärkung und ob er sendet; Einstellungen und Verstärkung eines Empfängers ändern, einen Empfänger stoppen oder starten, umbenennen oder löschen, und einen neuen Empfänger für `add-receiver.sh` vorbereiten
- **Systemzustand** (Dashboard) — jeder Empfänger auf Sendung oder aus, mit seiner Laufzeit, der freie Plattenplatz und die Größe jedes Log-Ordners, der letzte `crash.log`-Eintrag und die letzten Alarme
- **DRM** (Dashboard) — der DRM-Decoder: ob sein Helfer läuft, wie viele Decoder belegt sind und wer welche Frequenz decodiert (Sender, Codec, WMER); DRM ein- oder ausschalten und die Höchstzahl der DRM-Hörer (1–20) festlegen, wirksam innerhalb von 5 s ohne Neustart. Die Benutzerseite zeigt diese Hörer als DRM
- **Receive Diversity** (Dashboard) — jeder Hörer, der Ihren Empfänger per Empfangsdiversität mit einem anderen kombiniert: Name und Ort, Frequenz und Betriebsart, der Partner (PhantomSDR+, KiwiSDR, UberSDR oder WebSDR) und seine Adresse. Nur das Admin-Panel sieht das, nie die öffentliche Benutzerliste
- **Besucher** — private Besucherstatistik für 1 bis 31 Tage: Besucher, Sitzungen, Hörstunden, die meisten gleichzeitig, pro Tag, die stärksten Stunden, Länder, und die Adressen mit den meisten gleichzeitigen Sitzungen, mit ⛔ Ban ▾
- **Alarme** — eine E-Mail und/oder Telegram-Nachricht, wenn ein Empfänger ausfällt, zurückkommt oder neu gestartet wird, der Thermal Guard die Stufe wechselt oder `crash.log` einen neuen Eintrag bekommt
- **Sicherung & Wiederherstellung** — ein Zip mit den eigenen Einstellungen der Station, und eine Wiederherstellung, die jede ersetzte Datei vorher nach `admin-backups/` kopiert
- **Themes** — Phosphor green, Amber display, Metal panel, Modern dark, Light und Auto (hell am Tag, dunkel in der Nacht), gewählt mit **THEME** in der oberen Leiste jeder Seite

---

## Voraussetzungen

- PhantomSDR-Plus bereits installiert und in Betrieb
- Python 3.8+

> [!NOTE]
> **Normalerweise erledigt das Installationsskript dies für Sie.** `./install.sh` — ebenso jedes der vier Distributionsskripte, beide RADE-Skripte und das Statistikserver-Skript — richtet das Admin-Panel standardmäßig ein und installiert zuvor `pip` mit dem Paketmanager des Systems, falls es fehlt. Diese Seite beschreibt, was in diesem Schritt geschieht und was zu tun ist, wenn Sie ihn übersprungen haben oder später etwas ändern wollen.

Die Python-Bibliotheken des Panels (`flask`, `psutil`, `aiohttp`, `tomli-w`) werden von `setup_admin.sh` installiert; sollte das fehlschlagen, gibt es den genauen Befehl aus.

---

## Schritt 1 — Das Einrichtungsskript ausführen

```bash
./setup_admin.sh
```

> **Ohne Admin-Panel:** `bash setup_admin.sh --proxy-only` installiert nur `proxy.py` auf dem öffentlichen Port, mit den Ports aus `station.conf`. Das tut der Installer, wenn Sie das Panel ablehnen, denn den Proxy erreichen die Hörer — und `/rade`, `/stats`, `/relay`.

Das Skript wird:

1. prüfen, ob Python 3 installiert ist
2. das Vorhandensein von `admin_server.py` und `manage_admin.sh` überprüfen
3. `127.0.0.1` als `sdr_host` in der Konfiguration eintragen (siehe [Die Einstellung `sdr_host`](#die-einstellung-sdr_host))
4. nach drei Portnummern fragen. Jede Abfrage bietet einen Vorgabewert in Klammern,
den ein einfaches Enter übernimmt, sodass eine normale Einrichtung drei Tastendrücke braucht:
   - **Spectrumserver-Port** — der Port, auf dem Ihr SDR-Server lauscht (Vorgabe `9001`,
     genau das, was jede `config-*.toml` im Repository mitbringt)
   - **Interner Port des Admin-Panels** — wo `admin_server.py` lokal bindet (Vorgabe `9010`)
   - **Öffentlicher Proxy-Port** — der einzige externe Port, der SDR + Admin vereint (Vorgabe `8902`)
   Auf einer mit den Stationsfragen (`configure-station.sh`) eingerichteten Station sind die drei Vorgaben die eigenen Ports der Station aus `station.conf` — 9001, 9010 und 9000 —, Enter ist also richtig, und das Startskript ist bereits vorausgewählt.

Öffnen Sie nach der Einrichtung Ihren Browser über den Proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Standardpasswort: **`admin`**

> ⚠️ **Ändern Sie das Passwort sofort** — bei der ersten Anmeldung fragt ein Assistent mit nur einem Schritt nur nach einem neuen Passwort. Verzeichnis und Ports stehen bereits in `admin_config.json` (geschrieben von `setup_admin.sh`, das der Installer ausführt); der Assistent zeigt sie nur zur Information an und lässt sie unverändert. Ändern lassen sie sich später in Settings oder mit `./configure-station.sh`.

---

## Schritt 2 — Starten / Stoppen / Neu starten

Es gibt zwei Wege, Panel und Proxy zu betreiben. **Wählen Sie einen und bleiben Sie dabei** — die Warnung am Ende dieses Abschnitts erklärt, was beim Mischen passiert.

> **Methode B (systemd) wird dringend empfohlen**, wo immer systemd verfügbar ist. Der CPU-Überhitzungsschutz läuft im Panel: Ein Panel, das um 03:00 stirbt, oder eine Maschine, die neu startet, lässt die CPU ungeschützt, bis jemand sie von Hand wieder startet. `setup_admin.sh` bietet die Units jetzt standardmäßig an. Nutzen Sie Methode A, wenn es kein systemd gibt — Container, WSL1, OpenRC/sysvinit — oder wenn Sie die Überwachung bewusst selbst übernehmen wollen.

### Methode A — `manage_admin.sh` (kein root, nichts zu installieren)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Ein Skript steuert **beide** Prozesse. Es prüft vor dem Start des Proxys, ob `aiohttp` installiert ist, und gibt andernfalls eine klare Fehlermeldung mit dem Befehl zur Behebung aus.

### Methode B — systemd-Units (Start beim Booten, Neustart nach Absturz)

Das Repository liefert zwei fertige Units mit, `phantomsdr-admin.service` und `phantomsdr-proxy.service`. Passen Sie in beiden `User=` und die Pfade an, dann:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Die täglichen Befehle lauten dann:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Dieselben vier mit `phantomsdr-proxy`, oder beides zugleich: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

Eines sollten Sie einmalig tun: die tmpfiles-Regel aus `tmpfiles/phantomsdr-logs.conf` installieren (zuvor Pfade und Benutzer anpassen). systemd legt diese beiden Logs als `root` an, bevor es auf `User=` wechselt, und der Knopf **Clear Logs** des Panels scheitert dann mit `Permission denied` — siehe unten „Clear Logs meldet Permission denied“. `setup_admin.sh` installiert die Regel für Sie.

Zurück zu Methode A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Mischen Sie die beiden nicht.** Bei aktivierten Units wird `./manage_admin.sh stop` fünf Sekunden später von systemd rückgängig gemacht, und `./manage_admin.sh start` liefert Ihnen eine zweite, unverwaltete Kopie, die mit der von systemd um denselben Port streitet. (`restart` wurde genau deshalb aus dem Skript entfernt; es gibt jetzt einen Fehler aus und verweist auf `systemctl`.) `./manage_admin.sh status` liest nur und bleibt in beiden Fällen nützlich.

### Panel neu starten

Im weiteren Verlauf dieses Dokuments steht an mehreren Stellen „Panel neu starten“. Gemeint ist je nach Methode:

```bash
# Methode B — systemd-Units (die normale Einrichtung)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Methode A — keine Units installiert
./manage_admin.sh stop && ./manage_admin.sh start
```

---

## Schritt 3 — Firewall-Port öffnen

Öffnen Sie in Ihrer Firewall nur den **öffentlichen Proxy-Port**. Der interne Port des Admin-Panels muss nicht nach außen freigegeben werden:

```bash
sudo ufw allow <proxy_port>
```

---

## Schritt 4 — Kick-Funktion

Die Seite Users zeigt jeden aktuell verbundenen Hörer. Jede Zeile nennt den Namen oder das Rufzeichen, das der Hörer eingegeben hat (`--`, wenn keines), den Standort mit der IP-Adresse darunter, die eingestellte Frequenz, die Betriebsart und die Verbindungsdauer. Um einen Nutzer zu trennen, klicken Sie in seiner Zeile auf **⚡ Kick** — nur die Verbindungen dieses Hörers werden beendet. Alle anderen Hörer bleiben verbunden und merken nichts.

Neben der Betriebsart zeigt die Seite Users den Decoder, den ein Hörer in seiner Seite nutzt, zum Beispiel `USB · FT8` (DRM-Hörer erscheinen als `DRM`). Seiten, die vor dem Server-Update geöffnet wurden, melden ihn erst nach einem Neuladen.

Der Kick ist sofort und punktgenau: Der Server startet nicht neu, für niemanden sonst wird der Ton unterbrochen, und der getrennte Nutzer kann sich sofort wieder verbinden (die Funktion dient dem Entfernen störender oder hängender Verbindungen; wer draußen bleiben soll, bekommt die Sperre unten).

**⛔ Ban ▾** öffnet ein kleines Menü — **8**, **16** oder **24 Stunden** — und die gewählte Dauer trennt den Hörer von allen Empfängern der Station und weist seine Adresse so lange ab (24 Stunden sind das Höchste, was der Empfänger annimmt) (Close-Code 4001, den die Seite nicht erneut versucht). Die Sperre wird in `admin_bans.json` neben dem Panel gespeichert und einmal pro Minute erneut an jeden Empfänger geschickt, sodass ein Neustart eines Empfängers sie nicht aufhebt. Solange Sperren gelten, zeigt eine Liste **Banned** unter der Tabelle jede mit Name, Adresse und Ablaufzeit, und eine Schaltfläche **Unban** hebt sie sofort auf. Alle hinter demselben Internetanschluss teilen sich die Adresse und sind mitgesperrt.

---

## Konfiguration — admin_config.json

Die gesamte Laufzeitkonfiguration liegt in `admin_config.json` in Ihrem PhantomSDR-Plus-Verzeichnis. `setup_admin.sh` schreibt die Erstfassung; spätere Änderungen sind über die Seite Settings oder durch direktes Bearbeiten der Datei möglich.

Wichtige von `setup_admin.sh` geschriebene Felder:

| Schlüssel | Beschreibung |
|---|---|
| `port` | Interner Port des Admin-Panels (`admin_server.py` bindet hier) |
| `public_port` | Spectrumserver-Port des Hauptempfängers (9001 hinter proxy.py) — **nicht** der Port der Hörer, das ist `proxy_port`. proxy.py leitet dorthin weiter; Kick, die Seite Users und die Hörerzahl fragen ihn ab |
| `proxy_port` | Öffentlicher Port, auf dem der Proxy lauscht |
| `sdr_host` | Host, über den der Proxy spectrumserver erreicht — `127.0.0.1` (siehe unten) |
| `password_hash` | SHA-256-Hash des Admin-Passworts |
| `sdr_base_dir` | Pfad zu Ihrer PhantomSDR-Plus-Installation |
| `sdr_process_name` | Zu überwachender Prozessname (Standard: `spectrumserver`) |
| `start_script` / `stop_script` | Skripte, mit denen das Panel den SDR-Server startet und stoppt — über sie handelt auch der thermische Schutz |

> **Mehrere Empfänger auf einem Rechner?** Setzen Sie `start_script` auf `start-all.sh`. Das Stoppskript hält bereits jeden Empfänger an, und Restart sowie der Temperaturschutz verwenden das Startskript; mit `start-all.sh` kehren deshalb alle Empfänger aus `receivers.toml` zurück statt nur des Hauptempfängers. Die Seite Users, die Hörerzahl und der Kick umfassen dann ebenfalls jeden Empfänger. Siehe [Mehrere Empfänger](MULTI_RECEIVER.md).

---

## Die Einstellung `sdr_host`

`proxy.py` verbindet sich mit `spectrumserver` über Loopback — `sdr_host` ist `127.0.0.1` in `admin_config.json`, dort von `setup_admin.sh` eingetragen. Sie sollten daran nichts ändern müssen.

Setzen Sie den Wert nur dann auf eine echte Adresse, wenn `spectrumserver` auf einer **anderen Maschine** läuft als der Proxy. Starten Sie danach das [Panel neu starten](#panel-neu-starten) neu.

---

## proxy.py — was es ist und wann Sie es brauchen

`proxy.py` legt sowohl den SDR-Server als auch das Admin-Panel auf einen **einzigen öffentlichen Port** und leitet nach Pfadpräfix weiter:

| Pfad | Weitergeleitet an |
|---|---|
| `/admin*` | Admin-Panel (`localhost:<port>`) |
| Alles andere | Spectrumserver (`<sdr_host>:<public_port>`) |

Ohne den Proxy müssen Sie zwei Ports getrennt freigeben. Mit ihm geben Sie nur einen frei.

Der Proxy hebt außerdem die 4-MB-Grenze für WebSocket-Nachrichten auf (wichtig für große FFT-Rahmen des RX-888 bei 60 MSPS), leitet die echten Client-IPs über `X-Forwarded-*`-Header weiter und hält langlebige Verbindungen mit einem 30-Sekunden-Heartbeat durch NAT hindurch am Leben.

---

## Ports nach der Einrichtung ändern

Bearbeiten Sie `admin_config.json` direkt:

```json
{
  "port":        9010,
  "public_port": 9001,
  "proxy_port":  9000,
  "sdr_host":    "127.0.0.1"
}
```

Starten Sie dann beide Dienste neu:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Nützliche manuelle Befehle

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 9010/tcp

# Check what is listening on a port
ss -tlnp | grep 9010
```

---

## Protokolldateien

| Datei | Inhalt |
|---|---|
| `admin.log` | Ausgabe des Admin-Panels |
| `proxy.log` | Startbanner des Proxys + eine Zugriffszeile je weitergeleiteter Anfrage |
| `logwebsdr.txt` | Log von Startskript und Watchdog — Start/Stopp, Empfängertreiber, Registrierung bei websdr.org |
| `spectrumserver.log` | Die Ausgabe des Empfängerprozesses selbst — FFT- und OpenCL-Einrichtung, Verbindungen einzelner Clients, Fehler. Die größte dieser Dateien; sie wird rotiert, daher kann `spectrumserver.log.1` daneben liegen |
| `rade.log` | Protokoll des RADE-/FreeDV-Sidecars |
| `autorun.log` | Protokoll des Decoder-Daemons — Spots, SNR, Drift |
| `crash.log` | Absturzberichte und thermische Ereignisse: `[CRASH]`-/`[TERMINATE]`-Backtraces, `[EXIT]`-Notizen und `[THERMAL]`-Zeilen des Schutzes. **Normalerweise leer** — was darin steht, lohnt sich zu lesen |

Alle sind über die Reiter der **Log Viewer** im Panel lesbar (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Der Viewer zeigt die letzten 150 Zeilen des gewählten Reiters und aktualisiert bei eingeschalteter Auto-Aktualisierung alle 3 Sekunden; er liest nur das Ende der Datei, deren Größe spielt also keine Rolle.

### proxy.log und admin.log rotieren

`proxy.log` verzeichnet jede weitergeleitete Anfrage und `admin.log` jede Anfrage, die das Panel selbst erreicht. Keine von beiden wird standardmäßig rotiert. Früher dominierten die Abfragen des Dashboards beide Dateien — `/admin/api/status` läuft alle ~3 Sekunden, solange ein Tab offen ist —, doch diese Abfragen werden inzwischen aus beiden Protokollen herausgefiltert (siehe unten); die Rotation begrenzt daher langsames Wachstum statt einer Flut.

Das Repository liefert eine logrotate-Konfiguration unter `logrotate/phantomsdr` (täglich, oder früher, wenn ein Protokoll 10 MB überschreitet; behält 7 gzip-Archive in `logproxy/`, damit sie das Projektwurzelverzeichnis nicht zumüllen). **Sie ist standortspezifisch — öffnen Sie sie und passen Sie die drei Protokollpfade, den `olddir`-Pfad und den `su`-Benutzer an Ihre Maschine an, bevor Sie sie installieren**, dann:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

Die Schaltfläche **Clear Logs** des Panels leert **jede** Datei der obigen Tabelle, `autorun.log` und `proxy.log` eingeschlossen (`CLEAR_EXCLUDE` in `admin_server.py` ist leer). Beachten Sie, was das bei `autorun.log` kostet: Seine Dekodier-Historie ist der einzige Nachweis, was wann gehört wurde, und sie lässt sich nicht rekonstruieren — erhalten bleibt nur, was logrotate bereits nach `logproxy/` rotiert hat, ein Leeren verwirft also alles seit der letzten Rotation Dekodierte. Das Leeren bei laufendem Dekoder ist unbedenklich: Der Daemon hält die Datei mit `O_APPEND` offen und schreibt weiter in denselben Inode. Die Meldung nennt, was geleert wurde, und falls eine Datei nicht beschreibbar war — etwa ein `proxy.log`, das bei getrennten Benutzern einem anderen Benutzer gehört — nennt sie diese Datei und den Fehler, statt Erfolg zu melden, und lässt die Anzeige dieses Protokolls stehen, statt sie zu leeren. Die Dateien werden an Ort und Stelle geleert, nie gelöscht: Sowohl `manage_admin.sh` als auch die systemd-Units öffnen sie mit `O_APPEND`, sodass eine gelöschte Datei bis zum Neustart des Dienstes weiter einen unsichtbaren Inode füllen würde.

Da `proxy.log` ein Zugriffsprotokoll ist, enthält es Besucher-IP-Adressen und User-Agent- Zeichenketten — denken Sie daran, bevor Sie es bei einer Hilfeanfrage weitergeben.

### „Clear Logs“ meldet Permission denied

Auf einer Maschine, auf der die systemd-Units in einem frischen Verzeichnisbaum installiert wurden, kann der Knopf Folgendes zurückgeben:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Es sind immer diese beiden Dateien und nie die anderen fünf, denn nur sie werden von systemd selbst angelegt. `StandardOutput=append:` wird von PID 1 geöffnet, **bevor** auf `User=` gewechselt wird; eine noch nicht vorhandene Logdatei entsteht daher als `root:root 0644`. Das Panel läuft als Ihr Benutzer und kann sie nicht leeren. Die anderen fünf Logs legen die Startskripte an, die ohnehin als Ihr Benutzer laufen, also lassen sie sich normal leeren. Wo die beiden Dateien älter sind als die Units — `manage_admin.sh` hat sie mit `>>` erzeugt —, gehören sie bereits dem richtigen Benutzer und der Knopf funktioniert; deshalb tritt das Problem nur bei einer Neuinstallation auf, die direkt mit systemd begonnen hat.

Prüfen Sie es mit `ls -l admin.log proxy.log`: die fehlschlagenden zeigen `root root`. Reparieren Sie sie:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Ein Neustart ist nicht nötig — systemd schreibt weiter über den bereits geöffneten Dateideskriptor, und Anhängen ändert die Eigentümerschaft nicht. Drücken Sie **Clear Logs** erneut, und beide werden geleert.

Damit es nicht wiederkommt, installieren Sie die tmpfiles-Regel aus dem Repository: `tmpfiles/phantomsdr-logs.conf`. Sie legt beide Logs bei jedem Bootvorgang mit dem richtigen Eigentümer an, bevor die Units starten, sodass eine entfernte Datei — manuelles Aufräumen, Neuinstallation, verschobenes Installationsverzeichnis — nie wieder root-eigen zurückkehrt. **Sie ist maschinenspezifisch: Öffnen Sie sie und passen Sie zuerst die beiden Pfade und user:group an**, dann:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

---

## Zugriffsübersicht

| Aufbau | SDR | Admin-Panel |
|---|---|---|
| Ohne Proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Mit Proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Löschen von Chatnachrichten

Die Seite Chat History listet jede Nachricht des aktuellen Chatprotokolls auf. Jeder Eintrag hat eine Schaltfläche **🗑 Delete**, die genau diese eine Nachricht sofort aus dem Protokoll entfernt — ohne Serverneustart.

So funktioniert es:

- Das Admin-Panel schreibt die Chatprotokolldatei an Ort und Stelle neu und entfernt dabei nur die Zeile der gewählten Nachricht.
- Die Änderung wirkt für jeden Nutzer, der den Chat neu lädt; bereits geladener Chatverlauf in offenen Browser-Tabs wird nicht rückwirkend aktualisiert.
- Das Leeren des gesamten Protokolls (Schaltfläche **Clear All**) kürzt die Datei, was ebenfalls ohne Neustart wirkt.
- Eine **Chat-Antwort** wird als gewöhnliche Nachricht gespeichert, die mit einer Markierung beginnt, welche die beantwortete Nachricht benennt, zum Beispiel `[RE:2026-09-25 12:00:01|SV1BTL]`; in dieser Liste erscheint sie deshalb mit dieser Markierung davor. Das Löschen einer Antwort entfernt nur diese Antwort. Das Löschen der beantworteten Nachricht lässt ihre Antworten stehen; sie zeigen dann nur noch Name und Uhrzeit dessen, worauf sie antworten.

---

## Wasserfall-Rundnachrichten

Das Panel **Waterfall Message** erlaubt es, ein dauerhaftes Textbanner in die Wasserfallanzeige jedes verbundenen Nutzers zu schieben, ohne den Serverprozess anzufassen.

### Eine Nachricht senden

1. Öffnen Sie das Admin-Panel und gehen Sie zu **Waterfall Message**.
2. Geben Sie Ihren Nachrichtentext ein und wählen Sie eine Farbe (hexadezimal, z. B. `#ffdd00`).
3. Klicken Sie auf **Send** — die Nachricht erscheint sofort in allen aktiven Wasserfallansichten.

### Die Nachricht löschen

Klicken Sie auf **Clear**, um das Banner aus allen Wasserfällen zu entfernen. Der Nachrichtenzustand wird vom Admin-Panel im Speicher gehalten; er wird automatisch gelöscht, wenn der Panel-Prozess neu startet.

---

## Systemgraphen

Die Seite **Graphen** zeichnet vier Messgrößen auf einer gemeinsamen Zeitachse:

- **CPU-Frequenz** — mittlerer Takt über alle Kerne, in GHz
- **CPU-Last** — Gesamtauslastung in Prozent
- **CPU-Temperatur** — in °C, mit gestrichelten Marken bei 70 °C (warm) und 80 °C (kritisch)
- **Nutzer online** — zu diesem Zeitpunkt mit dem WebSDR verbundene Hörer

Der Zeitraum wird mit **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS** gewählt. Beim Überfahren mit der Maus erscheint ein Fadenkreuz mit allen vier Werten dieses Moments. Die vier Karten über dem Diagramm zeigen immer den neuesten Messwert.

---

## Thermal Guard

> 📖 **Vollständiges Handbuch: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — die vier Modi und was ein Sysop bei jedem tun muss, Betrieb ohne Panel, die Throttle-Stufe ohne root, Testen und Fehlersuche.

Stoppt den SDR-Server, wenn die CPU gefährlich heiß wird, und startet ihn wieder, sobald sie abgekühlt ist. Er gehört zum Panel — nichts zusätzlich zu installieren — und erscheint als Karte **THERMAL GUARD** im Dashboard, mit seinen Einstellungen unter **Einstellungen**.

Ausgeliefert wird er **untätig**: Der Modus beginnt bei `log`, er zeichnet also zunächst nur auf, was er *getan hätte*. Nichts rührt Ihren Server an, bis Sie den Modus ändern.

---

## Spot Reporting (Autorun FT8/FT4/JS8/WSPR)

Der Reiter **Spot Reporting** steuert den Autorun-Daemon (`autorun/index.js`) — einen Node.js-Prozess, der FT8/FT4/JS8/WSPR serverseitig direkt vom Empfänger dekodiert und die Spots zu den Reporting-Netzwerken hochlädt:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 wird nur mit Normal-Geschwindigkeit gespottet** — dem 15-s-Anrufzyklus, auf dem Heartbeats und CQs laufen. Die Spots stammen aus Heartbeats, Compound-Frames und gerichteten Nachrichten; Gruppenziele wie `@ALLCALL` und vom Decoder nicht aufgelöste Rufzeichen (`<....>`) werden nie gemeldet. JS8 teilt sich die PSK-Reporter-Warteschlange mit FT8 und FT4 und wird genauso getrennt gezählt.


**Das Reporting ist standardmäßig AUS.** Es wird nichts hochgeladen, bis Sie ein Ziel aktivieren und **Start** drücken. Dekodieren und Hochladen sind unabhängig voneinander: Der Daemon kann bei ausgeschaltetem Reporting dekodieren und protokollieren, sodass Sie die Aktivität prüfen können, bevor etwas öffentlich wird.

> ⚠️ Spots werden unter **Ihrem Rufzeichen** in öffentliche Netze hochgeladen. Aktivieren Sie nur Bänder/Betriebsarten, die Ihr Empfänger wirklich hört, und tragen Sie den korrekten Locator ein.

### Voraussetzungen

Der Autorun-Daemon benötigt Node.js 22+, die npm-Pakete `ws` + `cbor-x` (aufgelöst über den Symlink `autorun/node_modules` → `frontend/node_modules`) sowie `util-linux` (`taskset`). Die Installer richten all das automatisch ein — siehe den [Abschnitt Autorun-Spot-Reporter in INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Schlägt **Start** fehl, ist meist dieser Symlink oder `taskset` die Ursache (siehe Fehlerbehebung unten).

### Den Reiter verwenden

1. **Identität** — Rufzeichen und Locator. Vorausgefüllt aus `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, auf 6 Zeichen gekürzt); hier bei Bedarf überschreiben. Die Reporter nehmen nur einen Locator mit 4 oder 6 Zeichen (KM17 oder KM17VX): Ein längerer wird auf sein 6-stelliges Feld gekürzt, und alles, was kein Locator ist, wird beim Speichern abgelehnt.
2. **Band-×-Betriebsart-Matrix** — kreuzen Sie die zu dekodierenden Kombinationen an. Zeilen sind Bänder, Spalten FT8 / FT4 / JS8 / WSPR; nicht unterstützte Felder sind deaktiviert. WSPR deckt zusätzlich die LF-/MF-Bänder (2200 m, 630 m) und einen zusätzlichen 80-m-EU-Kanal ab.
3. **Ziele** — aktivieren Sie **PSK Reporter** und/oder **wsprnet** (beide standardmäßig aus).
4. **Max slots** — eine Grenze dafür, wie viele Band-/Betriebsart-Slots gleichzeitig laufen; mit einem [Zeitplan](#zeitplan-stunden-pro-band-und-betriebsart) wird sie Stunde für Stunde geprüft. **SELECT ALL** daneben hakt alle Bänder und Betriebsarten an.
5. **Start / Stop** — startet/beendet den Daemon (per `taskset` an die obersten CPU-Kerne gebunden, automatisch für die Maschine gewählt — siehe *Ressourcenbedarf und Grenzen* unten). **Save** / **Reload** speichern und lesen die Konfiguration neu; **Free All** leert alle Slots. **Start automatically after a reboot or crash** holt den Daemon von selbst zurück — siehe [unten](#automatischer-start-nach-einem-neustart-oder-absturz).

Die Statuskarte aktualisiert sich alle 5 s und zeigt Laufzustand, Dekodier-/Uploadzähler und den letzten Uploadzeitpunkt. Ein Abzeichen **📶 REPORTING** erscheint im Hauptwasserfall, solange das Reporting aktiv ist.

> **„0 sent" in den ersten Minuten ist normal.** PSK Reporter lädt gebündelt alle **5 Minuten** hoch, wsprnet alle **2 Minuten** — Spots warten bis zum nächsten Absenden. Die Statuskarte zeigt die Anzahl der wartenden Spots und die Taktung.

### Bänder oder Modi im laufenden Betrieb ändern

Eine gespeicherte Änderung erreicht einen laufenden Daemon von selbst. Er prüft `autorun.json` alle 5 Sekunden, und wenn **SAVE CONFIG** die Datei geändert hat, übernimmt er die neuen Bänder, Betriebsarten, Stunden und Ziele ohne Neustart: neue Slots öffnen, entfernte schließen, und `autorun.log` meldet `config reloaded` mit den geöffneten und geschlossenen Slots. Die Zähler laufen weiter. **START** bei laufendem Daemon antwortet weiterhin `already running` — das ist harmlos, die gespeicherte Änderung wird trotzdem übernommen.

Zwei Dinge brauchen weiterhin **STOP** → **START**: Rufzeichen und Locator (das Log meldet, wenn sie sich ändern) sowie ein von Hand eingetragener `server`- oder `cores`-Eintrag in `autorun.json`.

Was ein Neustart mit den Zählern macht:

- **Die Gesamtzahlen neben den Kontrollkästchen bleiben erhalten** — sie stehen in `autorun-totals.json`, die beim Beenden nicht gelöscht wird.
- **Die Decoder-Kacheln werden auf null zurückgesetzt**, sie gelten je Lauf.
- **Nichts aus der Warteschlange geht verloren**: beim Beenden werden offene Spots noch gesendet.
- Ein **neu aktiviertes** Band beginnt bei `0`; ein **zuvor genutztes** Band setzt seine Summe fort.
- Ein **abgewähltes** Band behält seine Zahl neben dem nun leeren Kästchen; die Historie wird nicht gelöscht.

**SELECT ALL** neben MAX SLOTS hakt alle Bänder und Betriebsarten an; sind alle angehakt, heißt der Knopf **DESELECT ALL** und entfernt die Haken.

### Zeitplan (Stunden pro Band und Betriebsart)

Unter BANDS & MODES hat die Karte **SCHEDULE** eine Zeile für jedes angehakte Band und jede Betriebsart, mit 24 Kästchen für die Stunden 00–23 **UTC**. Ein Haken in einem Kästchen bedeutet, dass dieser Slot in dieser Stunde dekodiert und Spots meldet. In den übrigen Stunden ruht er, die Verbindung zum Empfänger ist geschlossen: Er kostet keine CPU und belegt keinen Hörerplatz des Empfängers. Ein Slot mit allen Stunden läuft den ganzen Tag, wie vor den Zeitplänen — so beginnt jede bestehende Konfiguration.

- Ein Klick hakt ein Kästchen an oder ab; Ziehen erfasst mehrere.
- **24h** und **Clear** — alle Stunden oder keine.
- **Day** und **Night** — 06–18 und 18–06 Uhr *Sonnenzeit* am Locator unter REPORTER IDENTITY (für KM17VX ist Day 04–15 UTC). Sonnenzeit statt Uhrzeit, damit es für jede Station stimmt und sich mit der Sommerzeit nicht verschiebt.
- **→ 20m** (das Band der Zeile) — gibt den anderen angehakten Betriebsarten dieses Bandes dieselben Stunden und ersetzt deren eigene.
- **show local time** — beschriftet die Spalten in der Zeit Ihres Browsers; gespeichert wird der Zeitplan weiterhin in UTC.
- Die Zeile **AT ONCE** zählt die Slots, die in jeder Stunde laufen. Eine rote Zahl liegt über **MAX SLOTS**, und **SAVE CONFIG** verweigert das Speichern, bis es behoben ist. MAX SLOTS begrenzt die *gleichzeitig* laufenden Slots, nicht die über den Tag, also teilen sich mit einem Zeitplan mehr Bänder dieselbe CPU — zum Beispiel 10, 12 und 15 m am Tag und 160 und 80 m in der Nacht.
- Der Punkt vor jeder Zeile ist grün, solange der Slot dekodiert, gelb, während er für seine nächste Stunde öffnet oder schließt, und grau, solange er ruht oder der Daemon gestoppt ist. Die Statuskarte zeigt die gerade geplanten Slots und die Zeit der nächsten Änderung.

Ein Slot öffnet etwas vor seiner ersten Stunde — ein Dekodierfenster plus 10 Sekunden, also etwa 25 s für FT8 und JS8 und gut 2 Minuten für WSPR —, damit der erste Zyklus der Stunde dekodiert wird; der während dieses Vorlaufs gehörte Zyklus gehört zur Stunde davor und wird nicht gemeldet. Er schließt wenige Sekunden nach seiner letzten Stunde, sobald die Dekodierung des letzten Zyklus dieser Stunde begonnen hat. Eine abgerissene Verbindung, etwa weil der Empfänger neu gestartet wurde, wird nach 30 Sekunden wieder geöffnet.

### Automatischer Start nach einem Neustart oder Absturz

**Start automatically after a reboot or crash** unter den Knöpfen ist standardmäßig aus und gilt nach **SAVE CONFIG**. Ist es an, startet das Admin-Panel — das systemd beim Booten startet — den Daemon etwa eine Minute, nachdem das Panel hochgefahren ist, prüft dann jede Minute, ob er noch läuft, und startet ihn neu, wenn er beendet wurde. Ein Empfänger, der noch nicht läuft, stört nicht: Der Daemon versucht seine Verbindungen alle 30 Sekunden erneut.

**STOP hat immer Vorrang.** Nach **STOP** bleibt der Daemon aus, auch über Neustarts hinweg, bis Sie **START** drücken; das Panel merkt sich das in der Datei `autorun-stopped`. **FREE ALL SLOTS** stoppt den Daemon ebenfalls und hält ihn genauso an. Die Statuskarte zeigt `Autostart: off`, `ON` oder `ON, held by STOP`.

Ein Daemon, der innerhalb von 15 Minuten 5-mal beendet wird, wird 30 Minuten in Ruhe gelassen, statt jede Minute neu gestartet zu werden. Jeder automatische Start und diese Pause stehen im AUTORUN-Log als `[admin …] autostart: …`.

### Spot-Zähler

Es werden zwei verschiedene Zählungen angezeigt, die unterschiedliche Fragen beantworten.

**SPOTS UPLOADED PER DECODER** — eine Kachel je Decoder (FT8 / FT4 / JS8 / WSPR) mit den Spots, die **seit dem letzten Start des Daemons** hochgeladen wurden, darunter die Zahl der Decodierungen und wie viele noch in der Warteschlange stehen. Stop/Start setzt diese Werte auf null zurück. Ein Decoder, dessen Ziel abgeschaltet ist, zeigt seine Decodierungen und `reporting off` statt einer nackten `0` — dort sind null Uploads eine Einstellung, kein Fehler.

**Die Zahl neben jedem Kontrollkästchen** unter BANDS & MODES ist die Zahl der **insgesamt** hochgeladenen Spots dieser Band-/Modus-Kombination. Sie steht in `autorun-totals.json` und übersteht Neustarts. Ein vorangestellter Punkt (`·123`) in Bernstein bedeutet, dass dieser Slot decodiert, aber noch nichts hochgeladen hat. Zwischen zwei Uploads ist das normal — PSK Reporter sendet alle 5 Minuten, wsprnet alle 2 —, daher stehen FT8/FT4-Zähler nach einem Start die ersten Minuten in Bernstein. Bernstein bleibt es auch, wenn das Ziel dieses Decoders abgeschaltet ist. Eine schlichte `0` ohne Punkt bedeutet, dass der Slot aktiviert ist, aber noch nichts decodiert hat — WSPR steht nach einem Start mehrere Minuten auf null, weil es im 2-Minuten-Takt läuft, während FT8 schon in die Hunderte zählt. Ein Slot, den der Daemon nie ausgeführt hat, zeigt gar nichts. Der Tooltip zeigt Uploads, Decodierungen und den Zeitpunkt des letzten Uploads.

**Zähler zurücksetzen.** **FREE ALL SLOTS** wählt alle Bänder/Modi ab, schaltet beide Ziele aus, stoppt den Daemon und **löscht die Gesamtzähler** — danach steht neben keinem Kontrollkästchen mehr eine Zahl. Das ist die einzige Möglichkeit, sie zurückzusetzen, und sie lässt sich nicht rückgängig machen. Die Schaltfläche stoppt den Daemon und wartet auf dessen Ende, bevor sie `autorun-totals.json` löscht, denn der Daemon schreibt diese Datei beim Beenden neu; ein Löschen bei laufendem Daemon würde die Zahlen einfach zurückholen.

### Ressourcenbedarf und Grenzen

Der Daemon ist bewusst schlank und läuft auf ressourcenarmer Hardware (ein 4-Kern-i5 genügt), es gibt aber reale Grenzen, die man kennen sollte.

**Bekannte Grenzen:**

1. **Der eigentliche Engpass ist spectrumserver + die SDR-Bandbreite, nicht der Daemon.** Ein RX888 bei 30 MHz braucht OpenCL/GPU; eine CPU mit wenigen Kernen ohne leistungsfähige GPU kann diese FFT nicht tragen. Kombinieren Sie schwache Hardware mit einem schmaleren SDR (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR ist der CPU-Flaschenhals.** Sein Fano-Decoder ist eine JS-Portierung (~30 s pro Band, einfädig). Der 4-Worker-Pool führt 4 Dekodierungen parallel aus; mehr als **etwa 4 WSPR-Bänder** gleichzeitig können die Warteschlange über den 120-s-Zeitschlitz hinaus verlängern, besonders während das SDR um Kerne konkurriert. FT8-/FT4-Dekodierungen sind im Vergleich günstig.
3. **Skalierung der Slot-Anzahl.** Die Angabe von ~2–2,5 Kernen / 600–700 MB gilt für die vollen ~28 Slots auf einer 8-Kern-Maschine. Auf 4 gemeinsam genutzten Kernen bleiben Sie bei wenigen Bändern (Richtwert: ≤ 6 FT8/FT4 + ≤ 3 WSPR) und beobachten die `queued`-Statistik des Pools.
4. **Das Pinning setzt eine hybride Intel-Topologie voraus** (untere Kerne = schnellere P-Cores). Auf AMD oder CPUs mit verschränkter SMT-Nummerierung bleibt die automatische Aufteilung gültig (keine Überschneidung, kein Absturz), aber „untere Kerne sind schneller" trifft womöglich nicht wörtlich zu; bei einem 4C/8T-Modell mit Hyperthreading sind die oberen Kerne SMT-Geschwister — eingegrenzt, nicht vollständig isoliert. Wo der automatische Bereich nicht ideal ist, nutzen Sie das **manuelle Überschreiben** unten.
5. **Die Bandabdeckung wird vom Empfänger begrenzt.** Die RX888-Konfiguration (`sps=60000000` → Nyquist bei 30 MHz) erreicht das 6-m-Band und darüber nicht; die Bandtabelle reicht von 160 m bis 10 m. Andere SDRs decken ab, was ihr Abstimmfenster erlaubt.
6. **Reporting-Taktung.** PSK Reporter sendet alle 5 min, wsprnet alle 2 min — „0 sent" in den ersten Minuten ist normal, kein Fehler.

### Dateien und Endpunkte

| Element | Zweck |
|---|---|
| `autorun.json` | Gespeicherte Konfiguration (Identität, Slots mit ihren UTC-`hours`, Ziele, max. Slots, `autostart`, optionales `cores`-Pinning). Vom Reiter geschrieben; von git ignoriert. Ein Slot ohne `hours` läuft den ganzen Tag. |
| `autorun-stopped` | Vorhanden nach **STOP**: Autostart lässt den Daemon aus, auch über Neustarts hinweg, bis **START** die Datei entfernt. Von git ignoriert. |
| `autorun/scheduler.js` | Welche Slots zu einer bestimmten Zeit offen sind: die Stunden, der Vorlauf vor der ersten Stunde und die Nachlaufzeit nach der letzten. Getestet mit `node autorun/scheduler.test.mjs`. |
| `autorun-status.json` | Live-Status, den die Statuskarte liest (PID, Zähler, letzter Upload). Alle 15 s geschrieben; beim Stoppen entfernt. |
| `frontend/dist/autorun-active.json` | Öffentliche Abzeichendaten, ausgeliefert unter `/autorun-active.json`. Leer, wenn das Reporting aus ist. |
| `autorun.log` | Standard- und Fehlerausgabe des Daemons. |
| `GET/POST /admin/api/autorun/config` | `autorun.json` lesen/schreiben (prüft Rufzeichen, Locator, Band-/Betriebsart-Kombinationen, Slot-Grenze). |
| `GET /admin/api/autorun/status` | Laufzustand (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Startet (`taskset -c <auto> node autorun/index.js`) / sendet `SIGTERM`. Der Kernbereich wird von der CPU abgeleitet (siehe oben). |

> **Hinweis:** Nach einem Upgrade von `admin_server.py` müssen Sie das [Panel neu starten](#panel-neu-starten) neu starten, um neue Autorun-Routen oder eine aktualisierte Band-/Betriebsart-Matrix zu laden. Der Daemon läuft als eigener Prozess und übersteht daher Neustarts des Admin-Panels.

---

## Systemzustand (System Health)

Eine Karte im **Dashboard**, alle 30 Sekunden aktualisiert (oder mit **↻ refresh**):

- **Empfänger** — jeder Empfänger der Station (der auf `public_port` und jeder in `receivers.toml`): ein grüner Punkt und *on air, up 15h 5m*, wenn er antwortet, ein rotes **OFF THE AIR**, wenn nicht.
- **Platte & Log-Ordner** — freier Platz auf der Platte der Installation (orange ab 80 % belegt, rot ab 90 %), und die Größe von `logs/`, `logproxy/` und jedem `instances/<id>/logs/`.
- **Letzte Alarme** — was die Alarmüberwachung seit dem Start des Panels gesehen hat (siehe [Alarme](#alarme-e-mail--telegram)), ob eine Nachricht verschickt wurde oder nicht.
- **Letzter crash.log-Eintrag** — die neueste nicht leere `crash.log` aller Empfänger, mit Datum und ihren letzten 12 Zeilen.

---

## Besucherstatistik

Die Seite **Visitors** in der Seitenleiste (am Telefon: **☰ MENU → Visitors** oder die Schaltfläche **📈 VISITOR STATISTICS** auf der Seite Users) zählt die Hörer der Station aus den privaten Logs `logs/users_YYYY-MM-DD.jsonl` jedes Empfängers — den Kopien mit den IP-Adressen, die die öffentlichen Seiten nicht mehr zeigen. Wählen Sie **Today**, **7**, **14** oder **31 days**.

- **Besucher** (verschiedene Adressen), **Sitzungen**, **Hörstunden** und **die meisten gleichzeitig hörenden**.
- **Pro Tag** — dieselben vier Zahlen für jeden Tag.
- **Stärkste Stunden** — wann Sitzungen begannen, nach UTC-Stunde.
- **Länder** — Besucher pro Land.
- **Decoder** — wie viele Sitzungen welchen Decoder benutzt haben (gezählt aus den Logzeilen, die den Decoder enthalten, also seit dem Server-Update).
- **Adressen** — die 20 Adressen mit den meisten Sitzungen *gleichzeitig* zuerst, dann mit den meisten Sitzungen; eine Verbindungsflut wie die vom 16. September 2026 steht sofort oben (**AT ONCE** wird über 3 rot). Jede Zeile hat **BAN ▾** (8, 16 oder 24 Stunden).

Tage und Stunden sind UTC. Die eigenen Decoder der Station (lokale Verbindungen) zählen nicht; eine noch offene Sitzung zählt höchstens 12 Stunden. Namen stehen nicht in diesen Logs, daher zeigt die Seite Adressen, keine Namen. Die Zahlen werden höchstens einmal pro Minute neu berechnet.

---

## Alarme (E-Mail / Telegram)

**Settings → Alerts — Email / Telegram.** Eine Überwachung im Admin-Panel prüft alle 30 Sekunden:

| Ereignis | Wann |
|---|---|
| **off the air** | ein Empfänger antwortet etwa eine Minute lang nicht (zwei Prüfungen hintereinander) |
| **back on air** | er antwortet wieder |
| **restarted** | er antwortet als neuer Prozess — neu gestartet vom Watchdog, einem Startskript oder dem Thermal Guard |
| **thermal guard** | der Guard wechselt die Stufe (normal / warn / throttle / stopped) |
| **crash.log** | eine `crash.log` irgendeines Empfängers bekommt einen neuen Eintrag; die Nachricht enthält ihre letzten Zeilen |

Jedes Ereignis hat sein eigenes Kästchen. Derselbe Alarm wird höchstens einmal in 5 Minuten verschickt. Die erste Prüfung nach dem Start des Panels lernt nur den aktuellen Zustand, ein Neustart des Panels verschickt also nichts.

**Telegram** (am einfachsten):

1. Öffnen Sie in Telegram **@BotFather**, senden Sie `/newbot` und folgen Sie den Schritten; Sie bekommen ein **Bot-Token** (`123456789:AA…`).
2. Öffnen Sie Ihren neuen Bot und drücken Sie **Start** — vorher kann Ihnen ein Bot nicht schreiben.
3. Öffnen Sie **@userinfobot**; die **Id**, die er antwortet, ist Ihre **Chat-ID**.
4. **TELEGRAM** ankreuzen, beides einfügen, **✉ SEND TEST** drücken.

**E-Mail:** **EMAIL** ankreuzen und SMTP-Server, Port und Sicherheit Ihres Anbieters (SSL auf 465, STARTTLS auf 587), User, Passwort und **TO** eintragen. **FROM** kann eine vollständige Adresse sein, `Name <Adresse>` oder nur ein Name — ein Name allein erscheint als Absendername über der **USER**-Adresse, der User muss dann also eine vollständige Adresse sein.

**✉ SEND TEST** speichert zuerst das Formular und sendet dann; die Zeile unter den Schaltflächen zeigt die Antwort jedes Kanals oder was noch fehlt. Die Einstellungen liegen in `admin_config.json` unter `"alerts"` — der privaten Datei des Panels, nie Teil einer Sicherung oder eines Updates. Ein gespeichertes Passwort oder Token erscheint als `********` und bleibt unverändert, solange Sie kein neues eingeben.

---

## Empfänger

**Receivers** im linken Menü (am Telefon: **📡 RX** in der unteren Leiste) listet jeden Empfänger der Station — aus `receivers.toml`, oder auf einer Station mit einem Empfänger nur den Hauptempfänger — mit seinem Namen, seinem `?rx=`-Namen, der Hardware und ihrer Verstärkung, dem abgedeckten Bereich und seiner Mitte, der Bandbreite, der Frequenz und Betriebsart, mit der ein neuer Hörer beginnt, und ob er auf Sendung ist. Jeder Empfänger hat seine eigenen Knöpfe:

| Knopf | Was er tut |
|---|---|
| **✎ CHANGE SETTINGS** | das unten beschriebene Formular |
| **■ STOP** / **▶ START** | stoppt nur diesen Empfänger (mit Rückfrage; die anderen laufen weiter) oder startet ihn wieder. Der Start dauert etwa 20 Sekunden; der Knopf zeigt *STARTING …*, bis der Empfänger auf Sendung ist |
| **🏷 RENAME BUTTON** | nur bei einem Empfänger ohne Änderungsformular: der Name auf seinem Auswahlknopf, gespeichert in `receivers.toml`; nichts startet neu |
| **🗑 DELETE** | nur bei einem zusätzlichen Empfänger, der nicht der Standardempfänger ist — siehe unten |

**✎ CHANGE SETTINGS bei einem zusätzlichen, abstimmbaren Empfänger** (einem in `instances/<name>/`): Geben Sie die Mittenfrequenz in MHz an, wählen Sie die Bandbreite aus den Abtastraten, die diese Hardware kann, und legen Sie fest, wo ein neuer Hörer beginnt, in welcher Betriebsart, seine Verstärkung und den Namen auf seinem Knopf; das Formular zeigt den neuen Bereich, bevor Sie ihn anwenden. Eine Frequenz, die die Hardware nicht abstimmt, eine Abtastrate, die sie nicht kann, oder eine Startfrequenz außerhalb des neuen Bereichs wird abgelehnt. **✔ APPLY AND RESTART THIS RECEIVER** dann:

- setzt `-f`, `-s` und die Verstärkung in `instance.env`, und `frequency`, `sps`, `fft_size` sowie Startfrequenz und Betriebsart in `config.toml` — eine Quarzkorrektur (ein `frequency` einige Hz neben `-f`) bleibt als derselbe Fehler in ppm erhalten und stimmt so auch auf dem neuen Band, und `fft_size` wird skaliert, damit der Wasserfall seine Auflösung behält
- setzt `siteSDRBaseFrequency` und `siteSDRBandwidth` in `www/site_information.json` — die Seite des Empfängers liest sie beim Öffnen, also wird nichts neu gebaut
- setzt den Knopfnamen in `receivers.toml`; der Verzeichnisname und der Hardwarename des Empfängers bleiben, wie sie sind
- legt die alten Dateien in `admin-backups/retune-<name>-<datum>/` ab und startet **nur diesen Empfänger** neu — seine Hörer werden für einige Sekunden getrennt, die anderen merken nichts

**✎ CHANGE SETTINGS beim Hauptempfänger und bei einem direkt abtastenden Empfänger** (RX888, Fobos HF — er deckt 0 Hz bis zur halben Abtastrate ab und hat nichts abzustimmen): Das Formular enthält den Namen auf seinem Knopf, die Startfrequenz, die Betriebsart und die Verstärkung. Startfrequenz und Betriebsart kommen in seine `.toml`, der Name in `receivers.toml`, die alten Dateien in `admin-backups/settings-<name>-<datum>/`. **✔ APPLY** startet diesen Empfänger nur neu, wenn sich Startfrequenz, Betriebsart oder Verstärkung geändert haben; mit dem Hauptempfänger starten auch RADE und DRM neu. Das Band des Hauptempfängers selbst wird mit `bash configure-station.sh` geändert: seine Seite trägt ihr Band aus dem Build, braucht also einen Neubau der Seite, und der Assistent startet die Dienste mit sudo neu. Auf einer Station mit einem Empfänger ohne `receivers.toml` gibt es keinen Auswahlknopf und damit keinen Namen zu setzen.

**AT VOLUME (0 – 100 %)** ist in beiden Formularen die Stellung des Lautstärkereglers, mit der ein Hörer beim ersten Besuch beginnt; sie steht in der `.toml` des Empfängers als `volume` unter `[input.defaults]`. Bleibt das Feld leer, wird die Zeile entfernt und die Seite beginnt bei 50 %. Wer den Regler einmal bewegt hat, behält bei späteren Besuchen seine eigene Einstellung. Eine geänderte Lautstärke startet den Empfänger neu, wie eine geänderte Startfrequenz.

**IQ FOR LISTENERS**, **WIDE IQ** und **WIDE IQ LISTENERS AT ONCE** sind in beiden Formularen die IQ-Einstellungen des Empfängers: `iq`, `iq_wide` und `iq_wide_listeners` unter `[server]` in seiner `.toml` (siehe den Abschnitt über breiteres IQ im Benutzerhandbuch). *off* blendet die IQ-Taste für die Hörer aus. Breites IQ bietet neben den 12 kHz, die jeder bekommt, 24 oder 48 kHz an, und zwar so vielen Hörern gleichzeitig, wie das letzte Feld angibt (`0` = keine Grenze). Geschrieben wird nur eine Einstellung, die Sie ändern, und eine Beispielzeile wie `# iq_wide=48` wird zur echten Zeile. Der Server liest diese Einstellungen nur beim Start, daher startet eine geänderte IQ-Einstellung diesen Empfänger neu.

Bei jedem Empfänger startet eine reine Namensänderung nichts neu.

**Verstärkung.** Für einen RX888 enthält das Formular die VGA-Verstärkung (0–127), den Verstärkungsmodus (low/high), die Dämpfung (0–63) und **PGA on**; für einen RTL-SDR die HF-Verstärkung aus den Stufen, die der Tuner kann, oder *auto* (die AGC des Sticks). Sie werden in die Argumentzeile des Empfängers geschrieben — `RX888_ARGS` oder `RX_ARGS` — bei einem zusätzlichen Empfänger in `instances/<name>/instance.env`, beim Hauptempfänger in `main.env`. `main.env` ist die `instance.env` des Hauptempfängers: jedes Startskript liest sie zuletzt, sie ist nicht in git und `update.sh` ersetzt sie nie. In `station.conf` kann die Verstärkung nicht stehen, weil `configure-station.sh` diese Datei neu schreibt. Ohne `main.env` behält das Startskript seine eingebaute Verstärkung (`-g 50 -a 0 -m low --pga` beim RX888). Andere Empfängertypen haben ihre Verstärkung in derselben Argumentzeile; ändern Sie sie dort von Hand.

**🗑 DELETE** entfernt einen zusätzlichen Empfänger endgültig. Tippen Sie zur Bestätigung seinen Kurznamen ein; dann stoppt es diesen Empfänger (zuerst den Watchdog) und macht nicht weiter, solange noch einer seiner Prozesse läuft, nimmt seinen `[[receiver]]`-Block aus `receivers.toml` (die alte Datei kommt nach `admin-backups/deleted-<name>-<datum>/`) und verschiebt seinen Ordner `instances/<name>/` ebenfalls dorthin — oder löscht den Ordner, wenn Sie *keep a copy* abwählen. Sein Knopf verschwindet von den Seiten; der Treiber und seine Logdatei `logwebsdr-<name>.txt` bleiben.

Der Proxy liest `receivers.toml` neu, sobald sie sich ändert, also erreichen eine Umbenennung, eine Löschung oder ein hinzugefügter Empfänger die Hörer ohne Neustart des Proxys. Offene Seiten lesen die Empfängerliste alle 15 Sekunden neu, also verschwindet der Knopf eines gestoppten Empfängers und kommt von selbst wieder.

**➕ ADD NEW RECEIVER** öffnet ein Formular mit den Fragen von `add-receiver.sh`: der Empfängertyp (mit *RTL-SDR Blog V4* für einen RTL-Stick), Mittenfrequenz, Bandbreite, ein Kurzname (aus dem Band vorgeschlagen und auf Freiheit geprüft), der Name auf seinem Knopf, seine Antenne und die öffentliche Adresse der Station, und ob der Treiber installiert, die Empfängerauswahl auch auf der Hauptseite gezeigt, das Startskript dieses Panels auf `start-all.sh` gesetzt, der Empfänger gestartet und der Proxy neu gestartet werden soll. Darüber listet die Seite die USB-Empfänger, die dieser Computer sieht, damit Sie wissen, dass der Stick eingesteckt ist. **▶ PREPARE** prüft die Antworten, speichert sie in `instances/.add-rx.env` und gibt zwei Zeilen für ein Terminal, jede mit **📋 COPY**:

```bash
cd ~/PhantomSDR-Plus
./add-receiver.sh --answers instances/.add-rx.env
```

Das Skript nimmt jede Antwort aus dieser Datei und fragt nur nach Ihrem sudo-Passwort (Treiber und Proxy-Neustart brauchen es — das Admin-Panel führt nie etwas als root aus), dann entfernt es die Datei. Laden Sie die Seite danach neu, und der neue Empfänger steht in der Liste. `--answers DATEI` funktioniert auch allein: ein `ADD_RX_…=wert` pro Zeile; die Namen stehen oben in `add-receiver.sh`.

---

## Einstellungen — Ports, Start/Stopp und HTTPS

**PORTS**, unter **🔑 UPDATE PASSWORD**, listet jeden Port, den diese Station verwendet — den öffentlichen Port, https (443/80), wenn eingerichtet, den spectrumserver jedes Empfängers, das Admin-Panel, Statistik, RADE, DRM und das Relay — gelesen aus `admin_config.json`, `station.conf` und `receivers.toml`, denselben Dateien, die `proxy.py` liest. Ein grünes ● bedeutet, dass gerade etwas auf dem Port lauscht, ○, dass nichts lauscht. Nur die mit *open on the router* markierten Ports müssen weitergeleitet werden; die übrigen bleiben auf diesem Rechner und werden über den öffentlichen Port erreicht. Nicht installierte Dienste erscheinen nicht.

**SPECTRUMSERVER PORT (MAIN RECEIVER)** ist `public_port`: der Port, auf dem der Spectrumserver des Hauptempfängers lauscht — 9001 hinter `proxy.py` auf einer mit `install.sh` eingerichteten Station. Es ist **nicht** der Port der Hörer; dieser steht schreibgeschützt unter dem Feld als **Listener port (proxy)** (`proxy_port`), oder als *none* auf einer Station ohne Proxy, wo beide gleich sind. **💾 SAVE SETTINGS** prüft die Zahl: der eigene Port des Proxys wird abgelehnt, und ein Port, der vom `[server] port` des laufenden Empfängers abweicht, fragt zuerst nach einer Bestätigung — mit einer falschen Zahl leitet `proxy.py` die Hörer ab seinem nächsten Neustart auf einen Port, an dem nichts antwortet. Um den Spectrumserver wirklich zu verlegen, setzen Sie `[server] port` in der `.toml` des Empfängers, seine Zeile in `receivers.toml` und dieses Feld auf dieselbe Zahl und starten dann Empfänger und Proxy neu.

**▶ START** und **■ STOP** neben **DEFAULT START SCRIPT** und **DEFAULT STOP SCRIPT** führen das **gespeicherte** Skript nach einer Bestätigung sofort aus — beide trennen alle Hörer. Haben Sie eine Auswahl geändert, speichern Sie zuerst: der Knopf lehnt eine ungespeicherte ab. Die ersten Sekunden der Ausgabe erscheinen unter den Knöpfen; die ganze Ausgabe dieser Skripte, und der Neustarts durch den Thermal Guard, landet in `logs/admin-scripts.log`.

**HTTPS** zeigt, ob die Station über https erreichbar ist.

- Auf einer https-Station führt **🔍 CHECK** `setup-https.sh --status` aus: läuft Caddy, und antwortet das Zertifikat?
- Auf einer reinen http-Station prüft **🔒 SET UP HTTPS**, was es kann — `station.conf`, ob Ihr DNS-Name auflöst (eine IP-Adresse bekommt kein Zertifikat), ob die Ports 443 und 80 frei sind oder schon Caddy gehören —, erinnert daran, TCP 443 und 80 im Router weiterzuleiten, und gibt die zwei Zeilen für ein Terminal, jede mit **📋 COPY**. `setup-https.sh` fragt dort nach Ihrem sudo-Passwort: das Admin-Panel führt nie etwas als root aus. Laden Sie die Seite danach neu, und der Knopf wird zu **CHECK**. Siehe [Sicherer Zugang — https://](HTTPS.md).

---

## Sicherung & Wiederherstellung der Stationseinstellungen

**Settings → Backup & restore of the station settings.**

**⬇ DOWNLOAD BACKUP** liefert ein Zip, `phantomsdr-settings-<Rufzeichen>-<Datum>.zip`, mit den eigenen Einstellungen dieser Station:

- jede `*.toml` der Installation (Empfänger-Konfigurationen und `receivers.toml`) und `station.conf`
- `frontend/site_information.json`, `frontend/src/bands-config.js`, `markers.json`
- `autorun.json` (Spot Reporting), `websdr_relay.json`, `drm.json`, `admin_bans.json`
- für jeden weiteren Empfänger: `instances/<id>/config.toml`, `instance.env`, `markers.json`

und eine `BACKUP-INFO.json` mit Datum, Rechner und Dateiliste. **Nicht** enthalten: `admin_config.json` (Admin-Passwort, Alarm-Geheimnisse), die Logs und das Programm selbst.

**⬆ RESTORE** nimmt ein Sicherungs-Zip und schreibt **nur** Dateien derselben Liste zurück — alles andere im Zip wird übersprungen und genannt. Bevor eine Datei ersetzt wird, wird die aktuelle nach `admin-backups/restore-<Datum-Zeit>/` kopiert (von git ignoriert, nie in einem Update), so dass sich eine falsche Wiederherstellung von Hand rückgängig machen lässt. Die Antwort sagt, was als Nächstes zu tun ist: die Empfänger nach einer `.toml`, `instance.env` oder `station.conf` neu starten; die Seite nach Site Information oder Bandeinstellungen neu bauen (`./recompile.sh --frontend`); `phantomsdr-websdr-relay` nach den Relay-Einstellungen neu starten.

---

## Am Telefon oder Tablet

Unter 768 Pixel Breite wird das linke Menü zu einer Schublade. Die untere Leiste hat **DASH**, **RX** (Receivers), **USERS**, **GRAPHS**, **LOGS** und **☰ MENU**, das das ganze Menü mit jeder Seite hereinschiebt; es schließt sich, wenn Sie eine Seite wählen oder daneben tippen, und **MENU** bleibt hervorgehoben, solange Sie auf einer Seite sind, die nicht in der Leiste steht. Am Telefon werden die Tabellen zu einer Karte pro Zeile (die Empfängerliste schon am Tablet, bis 1100 Pixel), Formulare werden einspaltig, und die graue Notiz eines Kartentitels rückt unter den Titel. Top Processes, der Markers-Editor und das Band/Betriebsart-Raster von Spot Reporting bleiben Tabellen und lassen sich seitlich schieben.

---

## Themes

Die Auswahl **THEME** steht in der oberen Leiste jeder Seite, zwischen **ONLINE** und der Uhr, und noch einmal unter **Settings → Appearance**; beide zeigen immer dieselbe Wahl. Ein Theme gilt sofort, ohne Neuladen.

| Theme | Aussehen |
|---|---|
| **Phosphor green** | das klassische grüne Terminal (Standard) |
| **Amber display** | dasselbe in warmem Bernstein, wie die Anzeige eines alten Funkgeräts |
| **Metal panel** | das graue eloxierte Finish der Empfängerseite, beleuchtet von oben rechts |
| **Modern dark** | Anthrazit mit blauem Akzent, ohne Leuchten |
| **Light** | Weiß und Grau, schwarze Schrift — für Tageslicht |
| **Auto (day/night)** | **Light** von Sonnenaufgang bis Sonnenuntergang, **Modern dark** in der Nacht |

Alle Themes verwenden dieselben Schriften und Größen; nur Farben und Finish ändern sich. *On air* bleibt in jedem Theme grün und Warnungen orange und rot, und auch die **Graphs** folgen dem Theme. **Auto** berechnet Sonnenauf- und -untergang am Locator der Station (`siteGridSquare` in Site Info) und schaltet selbst um, solange die Seite offen ist; ohne Locator gilt 07:00–19:00 Ortszeit als Tag. Die Wahl wird pro Browser gespeichert, PC und Telefon können also verschiedene Themes haben. Die Anmeldeseite behält das grüne Aussehen.

---

## Fehlerbehebung

| Problem | Abhilfe |
|---|---|
| Admin-Panel startet nicht | Prüfen Sie `admin.log` — meist ein fehlendes Python-Paket |
| Proxy startet nicht | Führen Sie `python3 -c "import aiohttp"` aus — schlägt es fehl: `pip3 install aiohttp --break-system-packages` |
| Fedora / openSUSE: Panel oder Proxy startet beim Booten nicht (`status=209/STDOUT`, `avc: denied { open } … admin.log` oder `proxy.log` in `sudo ausearch -m avc -ts boot`) | SELinux verbietet systemd, Logdateien in Ihrem Home-Ordner zu öffnen. Führen Sie `./setup_admin.sh --selinux` aus (kennzeichnet beide Logs als `var_log_t`), dann `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Neuinstallationen erledigen das automatisch |
| Fedora / openSUSE: alles läuft, aber niemand außerhalb dieses Rechners kann sich verbinden | firewalld verwirft den öffentlichen Port. Führen Sie `./setup_admin.sh --firewall` aus (öffnet den Proxy-Port dauerhaft). Neuinstallationen erledigen das automatisch; `setup_websdr_relay.sh` bietet es für den Relay-Port an und `setup-https.sh` öffnet 443/80 |
| `systemctl is-active` bleibt bei `activating`, das Log meldet `address already in use` | Eine von Hand mit `manage_admin.sh start` gestartete Kopie belegt noch den Port. `./manage_admin.sh stop`, dann `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Sind die Units installiert, übergibt `manage_admin.sh start` jetzt an systemctl, statt eine zweite Kopie zu starten |
| `proxy.log` ist leer | Prüfen Sie zuerst, ob der Proxy wirklich läuft (`./manage_admin.sh status`). Wenn ja, nutzen Sie eine alte Version: Der Starter muss `python3 -u` verwenden (ungepuffert — sonst verlässt das Startbanner nie den 8-KB-Puffer), und `main()` in `proxy.py` muss `logging.basicConfig()` aufrufen (sonst hat aiohttps Zugriffslogger keinen Handler und jede Anfragezeile geht verloren, weil `web.AppRunner` — anders als `web.run_app` — die Protokollierung nicht konfiguriert). |
| Proxy startet, aber der Wasserfall bleibt leer | Prüfen Sie `sdr_host` in `admin_config.json` — normalerweise `127.0.0.1`. Steht dort noch eine alte LAN-IP aus einer früheren Version, ändern Sie sie und starten Sie das [Panel neu starten](#panel-neu-starten) neu |
| Kick-Schaltfläche meldet „no connections" | Führen Sie `getcap $(which ss)` aus — fehlt `cap_net_admin`, setzen Sie `sudo setcap cap_net_admin+ep $(which ss)` |
| Status zeigt immer OFFLINE | Gehen Sie zu Settings → SDR Process Name — tragen Sie den exakten Namen ein, den `ps -eo comm,args \| grep -v grep` anzeigt |
| Seite Users zeigt keine Daten | Prüfen Sie den Endpunkt: `curl http://127.0.0.1:<public_port>/~~users` |
| Externer Browser meldet NetworkError | Prüfen Sie, ob der Proxy läuft: `./manage_admin.sh status` |
| Proxy nach einer Netzwerkänderung defekt | Nur relevant, wenn `sdr_host` noch eine LAN-IP enthält — setzen Sie ihn auf `127.0.0.1` und starten Sie das [Panel neu starten](#panel-neu-starten) neu |
| Chat-Löschschaltfläche wirkt nicht | Prüfen Sie die Schreibrechte auf die Chatprotokolldatei: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Wasserfallnachricht erscheint nicht | Prüfen Sie, ob der Proxy läuft (`./manage_admin.sh status`) und das Frontend auf einem aktuellen Build mit Overlay-Renderer ist |
| Wasserfallnachricht nach Neustart verschwunden | Erwartet — der Nachrichtenzustand liegt nur im Speicher; senden Sie sie nach dem Neustart des Admin-Panels erneut |
| „Start" bei Spot Reporting schlägt fehl / Daemon beendet sich sofort | Prüfen Sie `autorun.log`. Meist fehlt der Symlink `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) oder `taskset` ist nicht installiert (`sudo apt install -y util-linux`). |
| Spot Reporting: Daemon läuft, aber `decodes` bleibt 0 und `autorun.log` zeigt `504` / `tap closed 1006` | Der Audioabgriff erreicht spectrumserver nicht. Der Daemon erkennt den Port automatisch aus der Konfiguration des **laufenden** Servers; die Protokollzeile `[autorun] tap backend: HOST:PORT` muss zu Ihrem `[server] port` passen. Stimmt sie nicht (oder lief der Server beim Start nicht), fixieren Sie ihn in `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9001 }`, dann Stop→Start. |
| **SAVE CONFIG** verweigert: „N slots at once exceeds cap of M (UTC hour …)" | MAX SLOTS begrenzt die gleichzeitig laufenden Slots. Erhöhen Sie den Wert oder nehmen Sie im SCHEDULE Stunden weg, wo die Zeile AT ONCE rot ist. |
| Spot Reporting startete nach einem Neustart nicht | **Start automatically after a reboot or crash** muss angehakt und gespeichert sein, und ein **STOP** hält an, bis **START** gedrückt wird (die Statuskarte zeigt `ON, held by STOP`). Das AUTORUN-Log zeigt jede Zeile `[admin …] autostart:`; das Panel selbst muss laufen (`sudo systemctl status phantomsdr-admin`). |
| Spot Reporting zeigt „0 sent" | In den ersten Minuten normal — PSK Reporter sendet alle 5 min, wsprnet alle 2 min. Prüfen Sie, ob ein Ziel aktiviert ist und der Daemon läuft. |
| Neue Bänder/Betriebsarten erscheinen nicht in der Matrix | [Panel neu starten](#panel-neu-starten) — die Matrix wird beim Start geladen. |
| `autorun.log` zeigt `MODULE_TYPELESS_PACKAGE_JSON` / „Reparsing as ES module … performance overhead" | Kosmetische Warnung (die Dekodierung funktioniert weiterhin). In `frontend/src/modules/package.json` fehlt `"type": "module"`; fügen Sie die Zeile nahe dem Anfang ein und führen Sie Stop→Start aus. Kein Frontend-Neubau nötig — der Daemon importiert die Quelldatei direkt. |
| „Start" bei Spot Reporting scheitert mit `taskset: … Invalid argument` auf einem alten/kleinen PC | Sollte mit dem konfigurationsbewussten Starter nicht vorkommen — der Kernbereich wird aus der CPU-Anzahl abgeleitet und läuft bei ≤ 4 Kernen ungebunden. Tritt es auf, ist Ihr `admin_server.py` älter als diese Änderung; aktualisieren Sie es (`_autorun_taskset_prefix`) und starten Sie das [Panel neu starten](#panel-neu-starten) neu. |
| REPORTING-Abzeichen fehlt im Wasserfall | Das Reporting muss mit mindestens einem Slot eingeschaltet sein; das Abzeichen liest `/autorun-active.json`. Bauen Sie das Frontend neu, wenn `dist/index.html` älter als das Abzeichen ist. |
| **✉ SEND TEST** meldet "Nothing to send to: …" | Die Meldung nennt, was fehlt: **TELEGRAM** oder **EMAIL** ankreuzen; Telegram braucht Bot-Token und Chat-ID; E-Mail braucht SMTP-Server und **TO**. |
| E-Mail-Test: `5.5.2 … Sender address rejected: need fully-qualified address` | Der Absender ist keine vollständige Adresse. Tragen Sie Ihre Adresse in **FROM** ein, oder lassen Sie dort nur einen Namen und machen Sie **USER** zu Ihrer vollständigen Adresse; [Panel neu starten](#panel-neu-starten), wenn es älter ist als diese Regel. |
| Telegram-Test scheitert mit `Forbidden` / keine Nachricht kommt an | Öffnen Sie zuerst Ihren Bot in Telegram und drücken Sie **Start**; prüfen Sie die Chat-ID mit @userinfobot (Ihre eigene Id, nicht die des Bots). |
| Kein Alarm, als ein Empfänger stoppte | Es dauert etwa eine Minute (zwei Prüfungen); derselbe Alarm kommt höchstens einmal in 5 Minuten; ein Neustart des Panels verschickt nichts; prüfen Sie das Kästchen des Ereignisses. |
| Seite Visitors zeigt "no visitors" | Die Seite liest `logs/users_*.jsonl` (und `instances/<id>/logs/`); diese schreibt die Statistik-Protokollierung der Empfänger — prüfen Sie, dass sie für die gewählten Tage existieren. |
| Auswahl THEME fehlt, oder ein neues Theme greift nicht | [Panel neu starten](#panel-neu-starten), dann die Seite mit **Strg+F5** neu laden, damit der Browser die alte Kopie verwirft. |
