# Installationsanleitung für System Stats

Eine umfassende Anleitung, um Ihrer PhantomSDR-Anwendung mithilfe des automatisierten Installationsskripts eine Serverüberwachung in Echtzeit hinzuzufügen.

## Übersicht

Diese Funktion fügt Ihrer PhantomSDR-Oberfläche eine **📊 Stats**-Schaltfläche hinzu, die Systeminformationen in Echtzeit anzeigt:
- CPU-Auslastung, Kerne, Frequenz, Temperatur und Top-Prozesse
- Speichernutzung (belegt/gesamt/Prozent)

Die Statistiken werden automatisch alle 5 Sekunden aktualisiert, solange das Modalfenster geöffnet ist.

> **Nicht zu verwechseln mit der Seite „Graphen“ des Admin-Panels.** Dieses Fenster zeigt eine Momentaufnahme, die sich beim Öffnen aktualisiert und keinen Verlauf speichert. Das Admin-Panel hat eine eigene Seite **Graphen**, die CPU-Takt, Last, Temperatur und Nutzer online alle 2 Sekunden erfasst und über die letzten 15 Minuten bis 24 Stunden darstellt — siehe das [Admin-Panel-Handbuch](../de/ADMIN_PANEL_SETUP.md).

---

## Voraussetzungen

- **Linux-Server** (Ubuntu/Debian empfohlen)
- **Internetverbindung** (zum Herunterladen von Node.js und Paketen)
- **Sudo-Zugriff** (für die Einrichtung des systemd-Dienstes)
- **PhantomSDR-Plus** bereits installiert und in Betrieb
- **lm-sensors** (empfohlen für Intel/AMD-CPU-Temperatur – wird vom Skript automatisch installiert)

---

## Installationsmethoden

> [!NOTE]
> **Das Hauptinstallationsskript bietet dies bereits an.** `./install.sh` — und die vier Distributionsskripte — führen `install-stats-server.sh` standardmäßig im Rahmen der normalen PhantomSDR-Plus-Installation aus, auf einer frischen Maschine ist der Statistikserver also meist schon eingerichtet. Nutzen Sie diese Seite, um ihn separat zu installieren oder um Port, Adresse oder Dienst später zu ändern.

### Option 1: Automatisierte Installation (Empfohlen) ⭐

Das automatisierte Skript erledigt alles für Sie.

#### Schritt 1: Das Skript ausführen

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**WICHTIG:** Führen Sie es NICHT als root oder mit sudo aus. Führen Sie es als Ihr regulärer Benutzer aus.

#### Schritt 2: Den interaktiven Aufforderungen folgen

Das Skript führt Sie durch:

##### 1. **Node.js-Installation** (falls erforderlich)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Das Skript installiert Node.js 22 über nvm, auf jeder Linux-Distribution — ohne root und ohne apt-Quelle. Dieselbe Frage erscheint, wenn Node.js zwar vorhanden, aber älter als 22 ist.

##### 2. **Installationsverzeichnis**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Drücken Sie die Eingabetaste für die Standardeinstellung oder geben Sie einen benutzerdefinierten Pfad an.

##### 3. **Port-Konfiguration** (Verbessert!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Serveradresse**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Geben Sie die öffentliche Domain oder IP-Adresse Ihres Servers ein.

##### 5. **Bestätigung**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Einrichtung des Systemd-Dienstes** (Optional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Empfohlen: Wählen Sie **y**, damit der Server beim Booten automatisch startet.

#### Schritt 3: Installation abgeschlossen! ✓

Das Skript zeigt eine Zusammenfassung an:
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

## Konfigurieren Sie Ihre PhantomSDR-Anwendung

Auf einer mit `install.sh` eingerichteten Station ist hier nichts zu tun: Die Stationsfragen haben `siteStats` bereits als `/stats` eingetragen, und `proxy.py` leitet es über den öffentlichen Port 9000 weiter; am Router wird also kein weiterer Port geöffnet.

### `site_information.json`

Die Zeile in `site_information.json` sieht so aus:

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

## Die Installation testen

### Test 1: API-Endpunkt prüfen

```bash
curl http://localhost:9011/api/system-stats
```

Erwartete Ausgabe (JSON):
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

### Test 2: Dienststatus prüfen

Wenn Sie es als Dienst installiert haben:

```bash
sudo systemctl status sdr-stats.service
```

Sollte anzeigen: `Active: active (running)`

### Test 3: Im Browser testen

1. Öffnen Sie Ihre PhantomSDR-Weboberfläche
2. Scrollen Sie zum Abschnitt **Additional Info**
3. Klicken Sie auf die Schaltfläche **Open Additional Info**
4. Suchen Sie die Schaltfläche **📊 Stats** neben den PC-Infos
5. Klicken Sie darauf, um das Statistik-Modalfenster zu öffnen
6. Überprüfen Sie, ob die Statistiken angezeigt und aktualisiert werden

---

## Dienstverwaltung

Wenn Sie es als systemd-Dienst installiert haben, verwenden Sie diese Befehle:

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

## Den Port nach der Installation ändern

Führen Sie `bash configure-station.sh` erneut aus und geben Sie der Statistik einen neuen Port. Das Skript verschiebt die Einstellung des Dienstes und den Proxy mit; die Seite verwendet weiterhin `/stats`, sonst ändert sich also nichts, und am Router wird nichts geöffnet.

---

## Fehlerbehebung

### Problem: Port bereits belegt

**Fehler:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Lösung:**

1. Finden Sie heraus, was den Port verwendet:
```bash
sudo lsof -i :9011
```

2. Stoppen Sie diesen Prozess:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Starten Sie den Dienst erneut:
```bash
sudo systemctl start sdr-stats.service
```

**Alternative:** Führen Sie das Installationsskript erneut aus und wählen Sie bei der Aufforderung einen anderen Port.

### Problem: Der Dienst startet nicht

**Fehler:**
```
status=217/USER
```

**Lösung:**

1. Überprüfen Sie die Dienstdatei:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Überprüfen Sie, ob die Zeile `User=` mit Ihrem Benutzernamen übereinstimmt:
```bash
whoami
```

3. Bearbeiten Sie sie bei Bedarf:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Neu laden und neu starten:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problem: Statistiken werden im Browser nicht angezeigt

**Symptome:** Das Modalfenster öffnet sich, aber es gibt keine Daten oder es werden 0-Werte angezeigt

**Lösungen:**

1. Überprüfen Sie die Browser-Konsole (F12) auf Fehler
2. Überprüfen Sie, ob die API erreichbar ist:
```bash
curl http://localhost:9011/api/system-stats
```
3. Überprüfen Sie, ob der Dienst läuft:
```bash
sudo systemctl status sdr-stats.service
```
4. Überprüfen Sie, ob `siteStats` in `site_information.json` `/stats` lautet und ob `proxy.py` läuft
5. Überprüfen Sie auf CORS-Fehler – stellen Sie sicher, dass der Server Ihre Domain zulässt

### Problem: Temperatur zeigt null an

**Ursache:** Temperaturmessung auf Ihrem System nicht verfügbar

**Lösungen:**

1. **Für die meisten Linux-Systeme:** Überprüfen Sie, ob die thermische Zone existiert:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **lm-sensors installieren:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Hinweis:** Die Temperatur ist möglicherweise nicht verfügbar auf:
- Virtuellen Maschinen
- Einigen VPS-Anbietern
- Windows Subsystem for Linux (WSL)
- Nicht-Linux-Systemen

Das ist normal – der Rest der Statistiken funktioniert trotzdem!

### Problem: Node.js nicht gefunden

**Fehler:**
```
node: command not found
```

**Lösung:**

1. Node.js installieren:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Überprüfen:
```bash
node --version
npm --version
```

---

## Was Sie sehen werden

Nach Installation und Konfiguration zeigt das Statistik-Modalfenster Folgendes an:

### 🖥️ CPU-Abschnitt
- **Auslastung**: Gesamt-CPU-Auslastung in Prozent
- **Kerne**: Wie viel CPU tatsächlich genutzt wird, ausgedrückt in ganzen Kernen — z. B. `1.3 / 12 in use` heißt, die Maschine leistet die Arbeit von 1,3 Kernen. Der Wert ist exakt und braucht keine Schwelle. Es ist bewusst keine Zählung belegter Kerne: der Scheduler verteilt die Arbeit eines Kerns auf viele, sodass eine solche Zählung diese Zahl immer nur annähern könnte.
- **Frequenz**: Durchschnittlicher aktueller CPU-Takt über alle Kerne in GHz, mit dem schnellsten Kern in Klammern (falls verfügbar)
- **Temperatur**: CPU-Temperatur in Celsius (falls verfügbar), farblich codiert: 🟢 grün bis 69 °C, 🟠 orange 70-79 °C, 🔴 rot ab 80 °C
- **Top-Prozesse**: Die 5 CPU-intensivsten Prozesse mit farbcodierten Prozentwerten:
  - 🟢 Grün: bis 50 % CPU
  - 🟠 Orange: 51-80 % CPU
  - 🔴 Rot: über 80 % CPU

### 💾 Speicherabschnitt
- **Belegt**: Belegter Speicher (GB)
- **Gesamt**: Gesamter Systemspeicher (GB)
- **Auslastung**: Speicherauslastung in Prozent (farbcodiert)

### ♻️ Automatische Aktualisierung
- Die Statistiken werden alle **5 Sekunden** aktualisiert, solange das Modalfenster geöffnet ist
- Die Aktualisierung stoppt, wenn Sie das Modalfenster schließen (spart Ressourcen)

---


## Sicherheitshinweise

- Der Statistikserver akzeptiert Verbindungen von jeder Herkunft (CORS: *)
- Erwägen Sie für die Produktion, CORS auf Ihre Domain zu beschränken
- Die Portauswahl validiert die Eingabe und prüft auf Konflikte
- Das Lesen der CPU-Temperatur erfolgt schreibgeschützt und sicher
- Es werden keine sensiblen Systeminformationen offengelegt

---

## Support & Ressourcen

### Statistikserver deinstallieren:
- Löschen Sie den Ordner /sdr-stats-server
- Wenn Sie einen Dienst erstellt haben, löschen Sie ihn einfach mit:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Bearbeiten Sie `App.svelte`: Finden Sie den Codeabschnitt:
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
  und ersetzen Sie ihn durch:
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
- Kompilieren Sie mit dem Befehl neu:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Starten Sie den PC neu und starten Sie den Server

---

## Kurzreferenz der Befehle

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

Viel Erfolg beim Überwachen! 📊🚀
