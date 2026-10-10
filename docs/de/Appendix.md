# Anhang — Befehlsübersicht

Alle Befehle, die ein Sysop zum Betrieb einer PhantomSDR-Plus-Station braucht, nach Aufgabe gruppiert, jeweils mit einer Zeile Erklärung. Sie werden im Verzeichnis `PhantomSDR-Plus` ausgeführt, sofern die Zeile nichts anderes sagt. Die schrittweise manuelle Installation (Abhängigkeiten, Node.js, OpenCL, Bauen von Hand) wird hier nicht wiederholt — siehe die [Installationsanleitung](INSTALLATION.md). Die letzte Spalte verweist auf den Abschnitt, der den Befehl erklärt; im PDF folgt die Seitenzahl.

## Installation und Einrichtung der Station

| Befehl | Was er tut | Siehe |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Lädt das Projekt herunter. | [README](README.md#installation) |
| `bash install.sh` | Vollständiger Installer für Ubuntu/Debian: stellt die Stationsfragen, installiert, baut. | [Installationsanleitung](INSTALLATION.md#repository-klonen-und-installer-starten) |
| `bash install_fedora.sh` | Derselbe Installer für Fedora. | [Installationsanleitung](INSTALLATION.md#repository-klonen-und-installer-starten) |
| `bash install_arch.sh` | Derselbe Installer für Arch Linux. | [Installationsanleitung](INSTALLATION.md#repository-klonen-und-installer-starten) |
| `bash install_opensuse.sh` | Derselbe Installer für openSUSE. | [Installationsanleitung](INSTALLATION.md#repository-klonen-und-installer-starten) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Unbeaufsichtigte Installation (hier für einen RX888 MkII); jede Frage erhält ihren Standardwert. | [Installationsanleitung](INSTALLATION.md#unbeaufsichtigt-installieren) |
| `chmod +x *.sh` | Macht die Skripte wieder ausführbar (etwa nach dem Entpacken eines Zip). | [Installationsanleitung](INSTALLATION.md#von-hand-aktualisieren) |
| `bash configure-station.sh` | Stationsassistent: stellt die Fragen, speichert `station.conf` und schreibt daraus alle Konfigurationsdateien. | [Installationsanleitung](INSTALLATION.md#die-stationsfragen) |
| `bash configure-station.sh --ask` | Fragt und speichert nur `station.conf`. | [Installationsanleitung](INSTALLATION.md#die-stationsfragen) |
| `bash configure-station.sh --apply` | Schreibt die Konfigurationsdateien ohne Fragen aus `station.conf` neu. | [Installationsanleitung](INSTALLATION.md#die-stationsfragen) |
| `bash configure-station.sh --show` | Zeigt die aktuellen Antworten. | [Installationsanleitung](INSTALLATION.md#die-stationsfragen) |
| `./add-receiver.sh` | Fügt einen weiteren Empfänger (etwa einen RTL-SDR für 2 m) neben dem Hauptempfänger hinzu. | [Installationsanleitung](INSTALLATION.md#mehrere-empfänger-auf-einem-rechner) |

## Empfängertreiber

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./setup-rx888-udev.sh` | Installiert die udev-Regeln des RX888, damit er ohne sudo läuft. | [Installationsanleitung](INSTALLATION.md#rx888_stream-ohne-sudo-ausführen-udev-regeln) |
| `./setup-rtlsdr.sh` | Installiert den RTL-SDR-Treiber; fragt, ob der Stick ein Blog V4 ist. | [Installationsanleitung](INSTALLATION.md#mehrere-empfänger-auf-einem-rechner) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Installiert den RTL-SDR-Blog-V4-Treiber ohne Rückfrage. | [Installationsanleitung](INSTALLATION.md#mehrere-empfänger-auf-einem-rechner) |
| `./setup-rsp1a.sh` | Installiert die offene Treiberkette für den SDRplay RSP1A. | [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Installiert die Treiberkette des Airspy HF+. | [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Installiert die Treiberkette des RigExpert Fobos. | [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Installiert das hackrf-Paket und seine udev-Regel. | [Installationsanleitung](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Prüft, ob ein RTL-SDR-Stick erkannt wird. | [Installationsanleitung](INSTALLATION.md#rtl-sdr-testen) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Prüft, ob der RSP1A erkannt wird (`driver=fobos`, `driver=airspyhf` für die anderen). | [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Listet die installierten SoapySDR-Treiber. | [Installationsanleitung](INSTALLATION.md#fobos-oder-airspy-hf-nicht-gefunden) |

## Empfänger starten und stoppen

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./start-rx888mk2.sh` | Startet (oder startet neu) den RX888-MkII-Empfänger mit seinem Watchdog und zeigt das Log, bis er läuft. | [README](README.md#grundlegender-betrieb) |
| `./start-rtl.sh` | Dasselbe für einen RTL-SDR. | [Installationsanleitung](INSTALLATION.md#1-testlauf) |
| `./start-rsp1a.sh` | Dasselbe für einen SDRplay RSP1A. | [README](README.md#grundlegender-betrieb) |
| `./start-airspyhf.sh` | Dasselbe für einen Airspy HF+. | [README](README.md#grundlegender-betrieb) |
| `./start-hackrf.sh` | Dasselbe für einen HackRF One. | [README](README.md#grundlegender-betrieb) |
| `./start-fobos.sh` | Dasselbe für einen Fobos, RF-Eingang (25–6000 MHz). | [README](README.md#grundlegender-betrieb) |
| `./start-fobos-hf.sh` | Dasselbe für einen Fobos, HF-Direktabtastung (0–25 MHz). | [README](README.md#grundlegender-betrieb) |
| `./start-all.sh` | Startet alle in `receivers.toml` eingetragenen Empfänger. | [Mehrere Empfänger](MULTI_RECEIVER.md#5-starten-und-stoppen) |
| `./start-rx888mk2.sh -q` | Jedes Startskript mit `-q`: zwei Zeilen Ausgabe statt des Live-Logs. | [README](README.md#grundlegender-betrieb) |
| `INSTANCE=vhf ./start-rtl.sh` | Startet einen zweiten Empfänger, eingerichtet in `instances/vhf/`. | [Mehrere Empfänger](MULTI_RECEIVER.md#3-einen-zweiten-empfänger-hinzufügen) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Bindet den Server an diese CPU-Kerne (`none` = keine Bindung). | [README](README.md#grundlegender-betrieb) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Startet ohne den RADE-Sidecar. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `./stop-websdr.sh` | Stoppt alle Empfänger dieser Installation und ihren Watchdog. | [Installationsanleitung](INSTALLATION.md#7-server-stoppen) |
| `./stop-websdr.sh main` | Stoppt nur den Hauptempfänger. | [Mehrere Empfänger](MULTI_RECEIVER.md#5-starten-und-stoppen) |
| `./stop-websdr.sh vhf` | Stoppt nur den mit `INSTANCE=vhf` gestarteten Empfänger. | [Mehrere Empfänger](MULTI_RECEIVER.md#5-starten-und-stoppen) |
| `tail -f logwebsdr.txt` | Verfolgt das Live-Log des Empfängers. | [Installationsanleitung](INSTALLATION.md#2-auf-fehler-prüfen) |

## Start beim Booten

| Befehl | Was er tut | Siehe |
|---|---|---|
| `bash setup-autostart.sh` | Startet den Empfänger beim Booten (das in `station.conf` genannte Startskript). | [Installationsanleitung](INSTALLATION.md#automatischen-start-einrichten) |
| `bash setup-autostart.sh start-rtl.sh` | Dasselbe für ein bestimmtes Startskript. | [Installationsanleitung](INSTALLATION.md#automatischen-start-einrichten) |
| `bash setup-autostart.sh start-all.sh` | Dasselbe für alle Empfänger in `receivers.toml`. | [Installationsanleitung](INSTALLATION.md#automatischen-start-einrichten) |
| `bash setup-autostart.sh --status` | Zeigt, ob es installiert ist und für welches Skript. | [Installationsanleitung](INSTALLATION.md#automatischen-start-einrichten) |
| `bash setup-autostart.sh --remove` | Beendet den Start beim Booten (der Empfänger läuft jetzt weiter). | [Installationsanleitung](INSTALLATION.md#automatischen-start-einrichten) |

## Bauen und Aktualisieren

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./recompile.sh` | Baut Server und/oder Webseite neu; fragt, was gebaut werden soll. | [Installationsanleitung](INSTALLATION.md#von-hand-aktualisieren) |
| `./recompile.sh --backend` | Baut nur den Server neu. | [Installationsanleitung](INSTALLATION.md#von-hand-aktualisieren) |
| `./recompile.sh --frontend` | Baut nur die Webseite neu (Desktop und /mobile). | [Installationsanleitung](INSTALLATION.md#von-hand-aktualisieren) |
| `./recompile.sh --both` | Baut beides neu. | [Installationsanleitung](INSTALLATION.md#von-hand-aktualisieren) |
| `cd frontend && ./build-all.sh` | Baut die Desktop-Seite und /mobile. | [Varianten bearbeiten](EDITING_VARIANTS.md#6-nach-dem-bearbeiten--neu-bauen) |
| `cd frontend && ./build-default.sh` | Baut nur die Desktop-Seite. | [Varianten bearbeiten](EDITING_VARIANTS.md#6-nach-dem-bearbeiten--neu-bauen) |
| `cd frontend && ./build-mobile.sh` | Baut nur /mobile. | [Varianten bearbeiten](EDITING_VARIANTS.md#6-nach-dem-bearbeiten--neu-bauen) |
| `bash update.sh` | Meldet, was eine neue Version ändern würde, und fragt, ob aktualisiert werden soll. | [Installationsanleitung](INSTALLATION.md#aufruf) |
| `./update.sh --check` | Nur Bericht, keine Fragen (für cron; Exit-Code 10 = Update verfügbar). | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --apply` | Aktualisiert und fragt bei Dateien, die Sie selbst bearbeitet haben. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --apply --yes` | Aktualisiert unbeaufsichtigt; jede von Ihnen bearbeitete Datei bleibt erhalten. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --apply --prune` | Bietet zusätzlich an, upstream entfernte Dateien zu löschen. | [Installationsanleitung](INSTALLATION.md#aufruf) |
| `./update.sh --from FILE` | Nimmt die neue Version aus einem `.zip`/`.tar.gz` oder Ordner — ohne Netzwerk. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --ref v5.1.0` | Aktualisiert auf einen Tag, Branch oder Commit statt auf den aktuellen Stand. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --list-excludes` | Zeigt die Dateien, die der Updater nie anfasst. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --verbose` | Listet alle Dateien, nicht nur die ersten 40. | [Installationsanleitung](INSTALLATION.md#weitere-optionen) |
| `./update.sh --restore LAST` | Stellt die Dateien wieder her, die das letzte Update überschrieben hat. | [Installationsanleitung](INSTALLATION.md#ein-update-rückgängig-machen) |
| `./update.sh --restore 20260923-164530` | Stellt die Dateien dieses bestimmten Laufs wieder her. | [Installationsanleitung](INSTALLATION.md#ein-update-rückgängig-machen) |

## Aussehen der Seite

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./waterfall.sh` | Ändert den Standard-Minimalpegel des Wasserfalls; zeigt den aktuellen Wert und fragt. | [README](README.md#wasserfall-untergrenze--waterfallsh) |
| `./waterfall.sh -v -15` | Setzt ihn ohne Rückfrage auf −15 dB (`-y` überspringt auch die Bestätigungen). | [README](README.md#wasserfall-untergrenze--waterfallsh) |
| `./waterfall.sh -s` | Zeigt nur die aktuellen Werte. | [README](README.md#wasserfall-untergrenze--waterfallsh) |
| `./smeter_theme.sh` | Wählt das Standard-Design des S-Meters aus einem Menü. | [Varianten bearbeiten](EDITING_VARIANTS.md#die-drei-skalenbilder--und-smeter_themesh) |
| `./smeter_theme.sh vintage` | Setzt dieses Design sofort und bietet dann das Neubauen an. | [Varianten bearbeiten](EDITING_VARIANTS.md#die-drei-skalenbilder--und-smeter_themesh) |
| `./smeter_theme.sh dark --build` | Setzt es und baut ohne Rückfrage neu (`--no-build` überspringt das Bauen). | [Varianten bearbeiten](EDITING_VARIANTS.md#die-drei-skalenbilder--und-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Gilt nur für neue Besucher; bestehende behalten ihres. | [Varianten bearbeiten](EDITING_VARIANTS.md#die-drei-skalenbilder--und-smeter_themesh) |

## Admin-Panel und Proxy

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./setup_admin.sh` | Interaktive Einrichtung des Admin-Panels: Ports, Skripte, Thermal Guard, systemd-Units. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#schritt-2--das-einrichtungsskript-ausführen) |
| `./setup_admin.sh --sudoers` | Installiert nur die sudoers-Regel, damit die beiden Units ohne Passwort neu starten. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#schritt-2--das-einrichtungsskript-ausführen) |
| `./setup_admin.sh --proxy-only` | Installiert nur den Proxy auf dem öffentlichen Port, für eine Station ohne Panel. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#schritt-2--das-einrichtungsskript-ausführen) |
| `./manage_admin.sh start` | Startet Panel und Proxy (wenn sie nicht unter systemd laufen). | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-a--manage_adminsh-kein-root-nichts-zu-installieren) |
| `./manage_admin.sh stop` | Stoppt beide. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-a--manage_adminsh-kein-root-nichts-zu-installieren) |
| `./manage_admin.sh status` | Zeigt, ob sie laufen, mit ihren PIDs. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-a--manage_adminsh-kein-root-nichts-zu-installieren) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Startet Panel und Proxy unter systemd neu (der Empfänger läuft weiter). | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#panel-neu-starten) |
| `sudo systemctl enable --now phantomsdr-admin` | Startet das Panel jetzt und bei jedem Booten (`phantomsdr-proxy` ebenso). | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-b--systemd-units-start-beim-booten-neustart-nach-absturz) |
| `sudo systemctl disable --now phantomsdr-admin` | Stoppt das Panel und startet es beim Booten nicht mehr. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-b--systemd-units-start-beim-booten-neustart-nach-absturz) |
| `systemctl status phantomsdr-admin` | Zeigt den Zustand des Panels (ohne sudo). | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-b--systemd-units-start-beim-booten-neustart-nach-absturz) |
| `sudo journalctl -u phantomsdr-admin -f` | Verfolgt das Log des Panels. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#methode-b--systemd-units-start-beim-booten-neustart-nach-absturz) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Bindet den Autorun-Decoder-Daemon an diese CPU-Kerne. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#manuelles-überschreiben-des-cpu-pinnings-fortgeschritten) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Installiert die Log-Rotation für Panel-, Proxy- und Autorun-Log. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#proxylog-und-adminlog-rotieren) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Probelauf der Log-Rotation. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#proxylog-und-adminlog-rotieren) |

## Thermal Guard

| Befehl | Was er tut | Siehe |
|---|---|---|
| `python3 thermal_guard.py --once` | Zeigt Sensor, Auslösepunkt und Schwellen; unternimmt nichts. | [Thermal Guard](THERMAL_GUARD.md#2-schnellstart) |
| `python3 thermal_guard.py --mode log` | Beobachtet die Temperatur live, nur Protokollierung (Strg-C zum Beenden). | [Thermal Guard](THERMAL_GUARD.md#7-betrieb-ohne-admin-panel) |
| `python3 thermal_guard.py --mode stop+restart` | Läuft scharf: stoppt den Empfänger bei Überhitzung und startet ihn nach dem Abkühlen neu. | [Thermal Guard](THERMAL_GUARD.md#7-betrieb-ohne-admin-panel) |
| `python3 thermal_guard.py --config FILE` | Verwendet eine andere Konfigurationsdatei. | [Thermal Guard](THERMAL_GUARD.md#7-betrieb-ohne-admin-panel) |
| `./setup-cpufreq-perms.sh` | Erlaubt dem Guard, die CPU-Frequenz ohne root-Rechte zu senken. | [Thermal Guard](THERMAL_GUARD.md#8-die-throttle-stufe-ohne-root-aktivieren) |
| `sudo systemctl enable --now thermal-guard` | Betreibt den Guard als eigenen Dienst (nur ohne Admin-Panel). | [Thermal Guard](THERMAL_GUARD.md#7-betrieb-ohne-admin-panel) |

## Verbindungen, Firewall und HTTPS

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./setup-firewall.sh --show` | Zeigt die Kernel-Regeln für Verbindungslimits; ändert nichts. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ./setup-firewall.sh --check` | Prüft die Regeln gegen Ihren Kernel. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ./setup-firewall.sh --apply` | Lädt die Regeln, mit automatischem Rückgängigmachen nach 60 Sekunden. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ./setup-firewall.sh --persist` | Lädt die Regeln bei jedem Booten. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ./setup-firewall.sh --status` | Zeigt die Paketzähler jeder Regel. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ./setup-firewall.sh --remove` | Entfernt alle Regeln. | [Verbindungslimits](CONNECTION_LIMITS.md#5-der-kernel-schutz) |
| `sudo ufw allow 9000/tcp` | Öffnet den öffentlichen Port in der ufw-Firewall. | [Installationsanleitung](INSTALLATION.md#kein-zugriff-von-anderen-geräten) |
| `bash setup-https.sh` | Schaltet HTTPS mit einem kostenlosen Let's-Encrypt-Zertifikat ein; HTTP funktioniert weiter. | [Sicherer Zugang (HTTPS)](HTTPS.md#auf-einer-laufenden-station) |
| `bash setup-https.sh --lan` | HTTPS nur im lokalen Netz (Browser warnen wegen des Zertifikats). | [Sicherer Zugang (HTTPS)](HTTPS.md#nur-im-lokalen-netz----lan) |
| `bash setup-https.sh --status` | Zeigt, ob HTTPS aktiv ist und das Zertifikat antwortet. | [Sicherer Zugang (HTTPS)](HTTPS.md#prüfen-und-ausschalten) |
| `bash setup-https.sh --remove` | Schaltet HTTPS ab; einfaches HTTP bleibt unverändert. | [Sicherer Zugang (HTTPS)](HTTPS.md#prüfen-und-ausschalten) |

## Optionale Dienste

| Befehl | Was er tut | Siehe |
|---|---|---|
| `./install-stats-server.sh` | Installiert den Statistikserver (CPU, Temperatur, Benutzer). | [Statistikserver](../sdr-stats/readme_de.md#schritt-1-das-skript-ausführen) |
| `sudo systemctl restart sdr-stats.service` | Startet ihn neu (`start`, `stop`, `status` ebenso). | [Statistikserver](../sdr-stats/readme_de.md#dienstverwaltung) |
| `sudo journalctl -u sdr-stats.service -f` | Verfolgt sein Log. | [Statistikserver](../sdr-stats/readme_de.md#dienstverwaltung) |
| `curl http://localhost:3001/api/system-stats` | Prüft, ob er antwortet. | [Statistikserver](../sdr-stats/readme_de.md#test-1-api-endpunkt-prüfen) |
| `./install_rade.sh` | Installiert den RADE-/FreeDV-Sidecar (`install_rade_ubuntu22.sh` unter Ubuntu 22.04). | [RADE README](RADE_README.md#installation--der-kurze-weg) |
| `./rade.sh start` | Startet den RADE-Sidecar mit seinem Watchdog. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `./rade.sh stop` | Stoppt ihn, seinen Watchdog und seine Decoder-Prozesse. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `./rade.sh restart` | Stoppt und startet ihn sauber. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `./rade.sh status` | Zeigt, ob er läuft. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Startet ihn neu und gibt jedem Hörer drei CPU-Kerne. | [RADE README](RADE_README.md#wenn-kerne-vor-dem-knick-sättigen) |
| `tail -f rade.log` | Verfolgt das RADE-Log. | [RADE README](RADE_README.md#steuerung-des-sidecars) |
| `python3 rade_loadtest.py` | Misst, wie viele RADE-Hörer dieser Rechner tragen kann. | [RADE README](RADE_README.md#voraussetzungen-1) |
| `./kiwi_install.sh` | Installiert die KiwiSDR-Client-Emulation (für Kiwi-Programme wie AetherSDR). | [KiwiSDR-Client-Emulation](Aether_config.md#2-die-brücke-installieren) |
| `./setup_websdr_relay.sh` | Installiert das Relay, mit dem der Diversity-Empfang einen WebSDR als zweiten Empfänger nutzt. | [Empfangsdiversität](RECEIVE_DIVERSITY.md#das-relay-installieren) |

## Transceiversteuerung (TCI-Brücke)

| Befehl | Was er tut | Siehe |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Gibt Ihrem Benutzer Zugriff auf die serielle Schnittstelle des Geräts (danach neu anmelden). | [Transceiver-Steuerung](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Liest die Frequenz des Geräts über Hamlib — prüft die CAT-Verbindung (Modell, Port, Geschwindigkeit für Ihr Gerät). | [Transceiver-Steuerung](RIG_CONTROL.md#beispiel-icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Betreibt die Brücke an einem bereits laufenden `rigctld`. | [Transceiver-Steuerung](RIG_CONTROL.md#beispiel-yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Betreibt die Brücke und steuert das Gerät direkt über `rigctl` (der Weg unter Windows). | [Transceiver-Steuerung](RIG_CONTROL.md#beispiel-yaesu-ft-991a) |

## Prüfen und Fehlersuche

| Befehl | Was er tut | Siehe |
|---|---|---|
| `ss -tlnp` | Listet die lauschenden Ports und die Programme dahinter. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#nützliche-manuelle-befehle) |
| `sudo lsof -i :9002` | Zeigt, welches Programm einen Port belegt. | [Installationsanleitung](INSTALLATION.md#port-bereits-belegt) |
| `pkill -f admin_server.py` | Beendet ein von Hand gestartetes Panel (`proxy.py` ebenso). | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#nützliche-manuelle-befehle) |
| `sudo fuser -k 3000/tcp` | Gibt einen von einem hängenden Programm belegten Port frei. | [Admin-Panel einrichten](ADMIN_PANEL_SETUP.md#nützliche-manuelle-befehle) |
| `lsusb` | Listet die USB-Geräte — wird der Empfänger erkannt? | [Installationsanleitung](INSTALLATION.md#rtl-sdr-nicht-gefunden) |
| `sudo timedatectl set-ntp true` | Hält die Uhr synchron — die FT8/FT4/WSPR-Decoder brauchen das. | [Installationsanleitung](INSTALLATION.md#meson-setup-bricht-mit-clock-skew-detected-ab) |

## Interne Skripte (nicht von Hand aufrufen)

| Skript | Was es tut | Siehe |
|---|---|---|
| `start-*.sh --watchdog` | Der Watchdog, den ein Startskript für sich selbst startet. | [Installationsanleitung](INSTALLATION.md#1-service-datei-anlegen) |
| `setup-sdr-common.sh` | Gemeinsame Hilfsfunktionen, die die Treiber-Installer `setup-*.sh` einbinden. | [Projektstruktur](PROJECT_STRUCTURE.md#verzeichnisbaum) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | Die ältere Startkette, für bestehende Stationen behalten; die `start-*.sh`-Skripte ersetzen sie. | [Projektstruktur](PROJECT_STRUCTURE.md#verzeichnisbaum) |
