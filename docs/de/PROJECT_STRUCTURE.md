# Projektstruktur von PhantomSDR-Plus

Dieses Dokument gibt einen umfassenden Überblick über die Verzeichnisstruktur von PhantomSDR-Plus, die Dateiorganisation und die Beziehungen zwischen den Komponenten.

---

## Inhaltsverzeichnis

1. [Verzeichnisbaum](#verzeichnisbaum)
2. [Wurzelverzeichnis](#wurzelverzeichnis)
3. [Quellcode (`src/`)](#quellcode-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Frequenzlisten (`frequencylist/`)](#frequenzlisten-frequencylist)
6. [Konfigurationsdateien](#konfigurationsdateien)
7. [Build-System](#build-system)

---

## Verzeichnisbaum

*Nur die wichtigsten Ordner und die Dateien, mit denen ein Sysop arbeitet; die vollständige Liste zeigt das Repository selbst.*

```
PhantomSDR-Plus
├── add-receiver.sh            # fügt einen weiteren Empfänger hinzu: Treiber, instances/<name>/, receivers.toml — siehe docs/MULTI_RECEIVER.md
├── admin_server.py
├── autorun
├── config-rtl.toml
├── config.toml
├── configure-station.sh       # der Stationsassistent: fragt einmal, schreibt station.conf, die .toml und site_information.json
├── docs
├── drm                        # von setup-drm.sh gebaut: src/ und bin/ (nicht in git)
├── frequencylist
├── frontend
├── install.sh
├── instances                  # weitere Empfänger, je ein Ordner (nicht in git) — siehe docs/MULTI_RECEIVER.md
├── jsdsp
├── proxy.py                   # der eine öffentliche Port: Seite, /admin, /rade, /stats, /relay und ?rx=-Empfänger
├── rade_helper.py             # der RADE-Sidecar: V1 über ~/radae, V2 (beta) über ~/rade_c
├── recompile.sh               # Neubau; --backend / --frontend / --both fragen nichts
├── receivers.toml.example     # Empfängerliste für proxy.py — nach receivers.toml kopieren
├── setup-https.sh             # https:// davor: Caddy auf 443 mit Let's-Encrypt-Zertifikat — siehe docs/HTTPS.md
├── src
├── start-rtl.sh
├── start-rx888mk2.sh
├── station.conf               # die Antworten der Station an den Assistenten (nicht in git, von update.sh nie angetastet)
├── stop-websdr.sh
├── subprojects
├── tci-bridge
├── thermal_guard.py           # CPU-Überhitzungsschutz für das Admin-Panel (läuft auch eigenständig)
├── update.sh                  # Updater: Bericht, dann „update now?“; --check, --from, --make-known
└── websdr_relay.py            # das Relay selbst — siehe docs/RECEIVE_DIVERSITY.md
```
---

## Wurzelverzeichnis

### Konfigurationsdateien

| Datei | Zweck | Wann zu ändern |
|-------|-------|----------------|
| `config.toml` | Standardkonfiguration | Ersteinrichtung, Tests |
| `config-rtl.toml` | RTL-SDR-spezifische Konfiguration | Bei Verwendung eines RTL-SDR |
| `config-rsp1a.toml` | Konfiguration für SDRplay RSP1A | Bei Verwendung eines RSP1A |
| `config-airspyhf.toml` | Konfiguration für Airspy HF+ | Bei Verwendung eines Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 Direktabtastung (0-25 MHz) | Bei Verwendung eines Fobos auf KW |
| `config-fobos.toml` | RigExpert Fobos SDR, RF-Zweig (25-6000 MHz) | Bei Verwendung eines Fobos oberhalb 25 MHz |
| `config-hackrf.toml` | Konfiguration für HackRF One | Bei Verwendung eines HackRF |
| `config-rx888mk2.toml` | Konfiguration für RX888 MK2 | Bei Verwendung eines RX888 |
| `config.example.hackrf.toml` | Beispiel für HackRF One | Bei Verwendung eines HackRF |
| `station.conf` | Die Antworten an den Stationsassistenten — Empfänger, Band, Station, Ports, Zusatzmodule. Geschrieben von `configure-station.sh`; die Startskripte und `proxy.py` lesen sie. Nie in git, von `update.sh` nie angetastet | Über `bash configure-station.sh` |
| `main.env` | Die eigene `instance.env` des Hauptempfängers: seine Argumentzeile (`RX888_ARGS` / `RX_ARGS`) mit der Verstärkung aus Admin → Receivers → ✎ CHANGE SETTINGS. Von jedem Startskript zuletzt gelesen; fehlt, bis eine Verstärkung gespeichert wird. Nie in git, von `update.sh` nie angetastet | Admin → Receivers, oder von Hand |

### Start-/Stopp- und Wartungsskripte

Jedes `start-*.sh` unten ist ein **eigenständiger Starter + Watchdog + Protokollierer**: Es beendet eine laufende Instanz, startet Empfänger + `spectrumserver`, löst sich in den Hintergrund ab, startet die Kette bei einem Absturz automatisch neu und protokolliert in `logwebsdr.txt`. Sie teilen sich ein Stopp-Skript und eine einzige `flock`-Sperre (es läuft immer nur ein Empfänger). Ändern Sie nur den Block **RECEIVER CONFIGURATION** am Anfang (Empfängerargumente / Konfiguration / Prozessname). Die sechs Startskripte aus derselben Vorlage (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) sind unterhalb dieses Blocks identisch; `start-rx888mk2.sh` ist ein eigenes Skript. Seit v5.0.0 können mehrere Empfänger nebeneinander laufen: Ein Startskript mit `INSTANCE=<name>` gestartet, bekommt der Empfänger seinen eigenen Ordner in `instances/<name>/` sowie eigenes Log, eigene Sperre und eigenen FIFO — siehe [Mehrere Empfänger](MULTI_RECEIVER.md).

| Skript | Zweck |
|--------|-------|
| `install.sh` | Automatische Installation und Build — zuerst die Stationsfragen, dann alles unbeaufsichtigt (auch `install_fedora.sh`, `install_arch.sh`, `install_opensuse.sh`) |
| `configure-station.sh` | Der Stationsassistent: Empfänger, Band, Station, Internet, Ports und Zusatzmodule, einmal gefragt und in `station.conf` gespeichert; daraus schreibt er die `.toml` des Empfängers, `site_information.json` und die Relay-Einstellungen, ändert nur die eigenen Schlüssel und sichert jede Datei vorher. `--show` zeigt die Antworten, `--apply` schreibt die Dateien daraus neu — siehe [Installationsanleitung](INSTALLATION.md) |
| `setup-autostart.sh` | Start beim Booten: installiert `phantomsdr-receiver.service`, das beim Booten das Startskript aus `station.conf` (oder das genannte) und beim Herunterfahren `stop-websdr.sh` ausführt, mit der Gruppe `plugdev`; `--remove` macht es rückgängig |
| `setup-https.sh` | Bietet den Empfänger zusätzlich über https:// an: installiert Caddy auf Port 443 mit einem Let's-Encrypt-Zertifikat für den DNS-Namen der Station (erneuert sich selbst) und richtet ihn auf den Loopback-Port `PORT_TLS` von `proxy.py`, wo der Proxy die echte Adresse jedes Besuchers von Caddy übernimmt. `--lan` für das lokale Netz mit Caddys eigenem Zertifikat, `--status`, `--remove`; die Stationsfragen rufen es auf, wenn https gewählt wird — siehe [Sicherer Zugang](HTTPS.md) |
| `add-receiver.sh` | Fügt diesem Rechner einen weiteren Empfänger hinzu: fragt, welcher Empfänger und was er abdeckt, installiert seinen Treiber, legt `instances/<name>/` und den Eintrag in `receivers.toml` an und bietet an, ihn zu starten und den Proxy neu zu starten. Die Installer bieten es am Ende an — siehe [Mehrere Empfänger](MULTI_RECEIVER.md) |
| `start-rtl.sh` | Start + Watchdog des Servers mit RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Start + Watchdog des Servers mit SDRplay RSP1A (`rx_sdr`); verwendet libmirisdr-5 oder die SDRplay-API, wenn diese installiert ist (`RX_DRIVER` erzwingt einen) |
| `start-airspyhf.sh` | Start + Watchdog des Servers mit Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Start + Watchdog des Servers mit RigExpert Fobos SDR, HF1/HF2 Direktabtastung (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Start + Watchdog des Servers mit RigExpert Fobos SDR, RF-Zweig (`rx_sdr`) |
| `start-hackrf.sh` | Start + Watchdog des Servers mit HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Start + Watchdog des Servers mit RX888 MK2 (`rx888_stream`) |
| `start-all.sh` | Startet jeden in `receivers.toml` aufgeführten Empfänger über sein eigenes Startskript — auf einer Station mit mehreren Empfängern als Startskript des Admin-Panels eintragen; siehe [Mehrere Empfänger](MULTI_RECEIVER.md) |
| `stop-websdr.sh` | Beendet Server + Watchdog — von allen Empfängern gemeinsam genutzt |
| `stop-websdr.sh <instanz>` | Stoppt nur einen Empfänger (`main` für den Hauptempfänger); ohne Argument stoppen wie bisher alle Empfänger |
| `setup-rx888-udev.sh` | Installiert udev-Regeln, damit `rx888_stream` des RX-888 ohne sudo läuft |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Installieren die SoapySDR-Treiberkette für RSP1A, Fobos oder Airspy HF+ — SoapySDR aus der Distribution, Treiber und rx_tools gebaut in `sdr_drivers/`, eine udev-Regel — auf jeder der vier unterstützten Distributionen. Die Installer-Optionen 3, 5 und 6 rufen sie auf; sie laufen auch allein. Gemeinsamer Code in `setup-sdr-common.sh` — siehe [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Installiert das Paket `hackrf` der Distribution und eine udev-Regel für den HackRF One, auf jeder der vier unterstützten Distributionen; die Installer-Option 7 ruft es auf |
| `setup-rtlsdr.sh` | Installiert den RTL-SDR-Treiber auf jeder der vier unterstützten Distributionen — das Paket `rtl-sdr` der Distribution oder mit `RTL_V4=y` den aus dem Quelltext gebauten Treiber für den RTL-SDR Blog V4 —, sperrt den DVB-T-Treiber und legt eine udev-Regel an; `add-receiver.sh` ruft es auf |
| `setup-firewall.sh` | Optionaler Flutschutz auf Kernel-Ebene: lädt eine nftables-Tabelle mit einer Obergrenze gleichzeitiger Verbindungen und einer Rate je Quelladresse auf den Empfängerports, einer SSH-Bruteforce-Bremse und Windows-Dateifreigabe, die außerhalb privater Bereiche geschlossen wird. Braucht root, kann Sie nicht aussperren (policy accept, bestehende Verbindungen werden zuerst angenommen) und `--apply` nimmt sich selbst zurück, wenn nicht binnen 60 s bestätigt — siehe [Verbindungslimits](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Gibt einer Gruppe `cpufreq` Schreibzugriff auf das CPU-Frequenzlimit, damit die Throttle-Stufe des Wächters ohne root funktioniert. Installiert eine `tmpfiles.d`-Regel, damit es einen Neustart übersteht; `--revoke` macht es rückgängig |
| `update.sh` | Aktualisiert die Installation aus dem veröffentlichten Stand und lässt Konfiguration, Marker, Frequenzliste und eigene Änderungen in Ruhe: Bericht, Frage „Update these files now?“ (ENTER = nein), Sicherung, Anwenden und Neubau nur dessen, was sich geändert hat. `--check` für Cron, `--from` aus ZIP, Tarball oder Ordner ohne Netz — siehe [Installationsanleitung](INSTALLATION.md) |
| `update-known.txt` | Der SHA-256 jeder jemals veröffentlichten Fassung jeder Datei, mit jeder Version ausgeliefert, damit `update.sh` eine nur ältere Datei ohne Nachfrage aktualisiert. Geschrieben mit `bash update.sh --make-known` im Quellbaum |
| `recompile.sh` | Baut Backend und/oder Frontend neu und wählt die unter `/` ausgelieferte Variante. Mit `--backend`, `--frontend` oder `--both` fragt es nichts und behält die aktuelle Variante — so rufen `install.sh` und `update.sh` es auf |
| `smeter_theme.sh` | Standard-Skalenbild des analogen S-Meters (dark / amber / vintage) für alle Nutzer setzen und den Frontend-Neubau anbieten — siehe [Varianten bearbeiten](https://github.com/sv1btl/PhantomSDR-Plus/blob/main/docs/de/EDITING_VARIANTS.md) |
| `waterfall.sh` | Ändert die voreingestellte minimale Wasserfall-Ebene (dB) in `waterfall.js` + `App.svelte` — siehe [README](README.md) |
| `kiwi_install.sh` | Installiert die KiwiSDR-Client-Emulation in einen Baum, der sie noch nicht hat: patcht die Backend-Quellen, kopiert `src/kiwi_bridge.h` und fügt einen dokumentierten `[kiwi_emulation]`-Block in die Konfigurationsdateien im Wurzelverzeichnis ein. Idempotent, und sichert jede Datei, die es anfasst — siehe [Emulation von KiwiSDR-Clients](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Wird vom Empfänger nicht benutzt. Ein kleines Node.js-Programm, das ein Hörer neben seinem eigenen Transceiver ausführt: Es liest Frequenz, Betriebsart und Sendezustand aus Hamlibs `rigctld` und stellt sie auf Port 50001 als TCI bereit, sodass die Schaltfläche **TCI-CAT** der Seite ein Funkgerät ohne eigenes TCI steuern kann, etwa den IC-7300 — siehe [Transceiver-Steuerung](RIG_CONTROL.md) |

### Datendateien

| Datei | Zweck | Format |
|-------|-------|--------|
| `markers.json` | Frequenz-Lesezeichen und -Marker | JSON |
| `chat_history.txt` | Chatnachrichten der Nutzer | Klartext |
| `favicon.ico` | Website-Symbol | ICO-Bild |
| `fftw_wisdom` | FFT-Optimierungsdaten | FFTW-Binärdatei |
| `phantom_fftw_wisdom` | Zusätzliche FFT-Optimierung | FFTW-Binärdatei |

### Admin-Panel und Spot-Reporting

| Datei | Zweck |
|-------|-------|
| `admin_server.py` | Das Admin-Panel selbst. Neben den Verwaltungsseiten betreibt es den Sampler der Seite **Graphen**: ein Hintergrund-Thread erfasst alle 2 Sekunden CPU-Takt, Last, Temperatur und Nutzer online und hält sie nur im Speicher — 1 Stunde in voller Auflösung plus 24 Stunden als 30-Sekunden-Mittelwerte. Es wird nichts auf die Festplatte geschrieben, der Verlauf geht beim Neustart verloren. |
| `admin_config.json` | Einstellungen des Admin-Panels (Passwort-Hash, Ports, Optionen, Schwellen des thermischen Schutzes) |
| `proxy.py` | Der öffentliche Port. Liefert die Seite aus und reicht `/admin` an das Panel sowie — auf einer mit dem Assistenten eingerichteten Station — `/rade`, `/stats` und `/relay` an die Dienste dahinter weiter, sodass nur ein Port weitergeleitet wird. Liest seine Ports aus `admin_config.json` oder, ohne Panel, aus `station.conf` (`setup_admin.sh --proxy-only`) |
| `thermal_guard.py` | CPU-Überhitzungsschutz. Stoppt den Server, wenn die CPU zu heiß wird, und startet ihn wieder, sobald sie abgekühlt ist; die Schwellen leitet er aus dem kritischen Grenzwert ab, den Ihre eigene CPU veröffentlicht, statt aus einer festen Zahl. Er versucht nie zu erkennen, was den Server überwacht — solange es zu heiß ist, wiederholt er den Stopp alle 2 Sekunden, sodass ein Watchdog, eine systemd-Unit oder ein Cron-Job, der ihn wiederbelebt, rückgängig gemacht wird, bis die Maschine abkühlt. Nur Standardbibliothek; wird von `admin_server.py` importiert (getaktet vom Graphen-Sampler) und läuft für Installationen ohne Panel auch eigenständig. Standardmäßig nur Protokollmodus, handelt also erst nach Aktivierung — siehe [Admin-Panel]siehe das [Thermal-Guard-Handbuch](THERMAL_GUARD.md) |
| `autorun/` | Der Spot-Reporting-Daemon — siehe [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Welche Bänder/Betriebsarten in welchen UTC-Stunden dekodiert werden, Identität, Ziele und Autostart |
| `autorun-stopped` | Vorhanden nach STOP im Panel: Autostart lässt den Daemon aus, auch über Neustarts hinweg, bis START |
| `autorun-status.json` | Laufender Zustand des Daemons — speist die **Zähler des aktuellen Laufs** (die Kacheln je Decoder), die bei Stop/Start zurückgesetzt werden |
| `autorun-totals.json` | **Gesamtwerte seit Beginn** je Band und Betriebsart — die Zahl neben jedem Kontrollkästchen; vom Daemon geschrieben, damit sie Neustarts überstehen |

### Dateien des Build-Systems

| Datei | Zweck |
|-------|-------|
| `meson.build` | Hauptkonfiguration des Builds |
| `meson_options.txt` | Konfigurierbare Build-Optionen |
| `.gitattributes` | Attribute des Git-Repositories |

---

## Quellcode (`src/`)

Das Verzeichnis `src/` enthält die C++-Implementierung des Backends.

### Wichtige Komponenten

#### 1. Hauptanwendung (`main.cpp`)
- Wertet die Kommandozeilenargumente aus
- Lädt die Konfigurationsdatei
- Initialisiert die Serverkomponenten
- Startet die Ereignisschleife

#### 2. Spektrumserver (`spectrumserver.cpp`)
- Koordiniert alle Komponenten
- Verwaltet die Nutzerverbindungen
- Verteilt die Spektrumdaten
- Bearbeitet Nutzeranfragen

#### 3. SDR-Treiber (`drivers/`)
- Abstrakte Schnittstelle für SDR-Hardware
- Liest und formatiert Abtastdaten
- Behandelt gerätespezifische Funktionen

#### 4. DSP-Engine (`dsp/`)
- FFT-Berechnung (CPU-/GPU-beschleunigt)
- Demodulation (AM, FM, SSB, CW usw.)
- Audiofilterung und Resampling
- AGC pro Hörer — Auto (je Betriebsart abgestimmt) oder Fast / Medium / Slow wie am Transceiver, gewählt mit dem Befehl `agc_speed` (`utils/audioprocessing.cpp`) — und Rauschminderung

#### 5. Webserver (`server/`)
- WebSocket-Kommunikation
- Ausliefern statischer HTTP-Dateien
- Verwaltung der Nutzersitzungen
- Echtzeit-Datenstreaming

#### 6. Audiokodierung (`audio/`)
- FLAC-Kompression
- Opus-Kompression
- Optimierung des Streamings

---

## Frontend (`frontend/`)

Die mit Svelte und Vite erstellte webbasierte Benutzeroberfläche.


#### 1. Hauptanwendung (`App.svelte`)
- Oberste Komponente
- Layoutstruktur
- Orchestrierung der Komponenten
- **Decoder-Tastenreihe** — eine Taste je Decoder im Hauptpanel, direkt unter der Modus-Auswahl; ein Druck startet den Decoder und öffnet sein Fenster, ein erneuter Druck stoppt ihn. Sie hat die frühere Bandbreiten-Reihe ersetzt. RADE-v2U/RADE-v1L/RADE-v1U liegen stattdessen in `lib/ModesSelector.svelte`, neben der Modus-Auswahl und in den Pop-ups **Modes** und **Bands**.
- **Versionszeile** — „PhantomSDR+ | v5.5.0 original from github.com/sv1btl/PhantomSDR-Plus“, die Adresse als Link; dieselbe Zeile steht auf der Seite /mobile. Versionsnummer und Adresse stehen in `lib/version.js`; die Zeile ist eine Urhebernennung nach `ADDITIONAL_TERMS.md`.

#### 2. Wasserfallanzeige (`waterfall.js` + `lib/`)
- Canvas-basierte Darstellung von Spektrum und Wasserfall sowie Farbpaletten in `waterfall.js` (reines JS, keine Komponente); die Helligkeits-/Kontrast-Umrechnung von **Auto Adj.** ist `lib/wfAutoLevel.js`
- Interaktive Abstimmung über `lib/PassbandTuner.svelte`
- Bandplan- und Marker-Overlays über `lib/FrequencyMarkers.svelte`
- Der Audioanalysator ist `lib/Spectrogram.svelte`, der SSB-Audiobericht `lib/SsbReport.svelte` und der AM/FM-Bericht `lib/AmFmReport.svelte`; ihre HF-Messungen (belegte Bandbreite, Träger und Gegenseitenband bei SSB, AM-Modulationsgrad und FM-Hub, die HF-Ansicht in AM/FM) liefern `measureOccupied`, `measureSsb`, `measureAmFm` und `getRfSlice` in `waterfall.js`, das bei offenem Analysator eine unsichtbare, fein aufgelöste Wasserfall-Verbindung um die eingestellte Frequenz hält (`detailFollow`), sodass sie bei jedem Zoom funktionieren; übernommen von PhantomSDR-ORSAT von F1NSK
- Das 3D-Spektrum ist `lib/Waterfall3D.svelte` (WebGL2): Solange es geöffnet ist, übergibt `waterfall.js` ihm über `waterfall.view3d` jede Zeile mit den Pegeln des Wasserfalls (Min/Max und Auto Adj. angewendet), den Zoombereich und die Farbpalette; übernommen von PhantomSDR-ORSAT von F1NSK

#### 3. Bedienelemente (`App.svelte` + `lib/`)
- Frequenzeingabe/-anzeige — `lib/FrequencyInput.svelte`
- Ziffernblock zur Frequenzeingabe — `lib/FreqKeypad.svelte`; die eingetippte Frequenz wird mit Zoom, Min/Max und Betriebsart ihres Bandes abgestimmt (`tuneTypedFrequency()` in `App.svelte`), und eine, die ein anderer Empfänger abdeckt, öffnet jenen Empfänger
- **Show-All**-Streifen der anderen Empfänger — `lib/RxStrip.svelte`: je ein Socket `/waterfall?rx=<id>`, jeder Frame dekodiert und gezeichnet, in Farbtabelle und Pegeln des anderen Empfängers, neueste Zeile oben; die Empfängerbereiche und die Links zwischen Empfängern kommen aus `lib/receivers.js`; mit zwei oder mehr Bändern im Bereich des anderen Empfängers eine Band-Auswahlliste in seinem Kopf (Wahl in `localStorage` `rxStripView:<id>`, der Klick kommt mit `&band=1` an)
- Betriebsartenwahl (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, Bandumschaltung — `lib/BandSelector.svelte`
- EiBi-Fenster — `lib/SwSchedule.svelte`: durchsucht `/eibi.json` mit den Kriterien von shortwave.live; eine Zeile stimmt über den Weg des Marker-Klicks ab (`handleFrequencyMarkerClick()` in `App.svelte`, daher starten Decoder-Betriebsarten ihren Decoder), und seine grünen Ergebnisse sowie der rote „jetzt gehört“-Marker werden von `lib/FrequencyMarkers.svelte` gezeichnet, und **Hide HFCC markers** blendet die Einträge von `markers.json` aus, die `update-markers.sh` mit `"source": "hfcc"` kennzeichnet; CW-Zeilen werden mit der Marker-Betriebsart `MORSE` abgestimmt und öffnen so den CW-Decoder
- AGC/NR/NB und die übrigen Bedienelemente liegen in `App.svelte` selbst; eine eigene `Controls.svelte` gibt es nicht

#### 3a. Scanner (`scanner.js`)
- Kanalsuchlauf: führt den Empfänger über einen Bereich und hält beim ersten Kanal mit Signal an. Reines JS, keine Komponente — `App.svelte` liefert VFO, Betriebsart, Bandplan und den Abstimmaufruf und erhält den UI-Zustand über einen einzigen Callback zurück
- Die Schwelle ist ein Abstand in dB zum Grundrauschen des Bandes statt eines absoluten Pegels und nutzt das Rauschen, das `waterfall.js` ohnehin nachführt (`snrNoiseDb`), braucht also keine eigene Kalibrierung
- Zwei Arten, das Band zu durchlaufen: jeden Kanal abstimmen und hineinhören, oder zuerst das Spektrum prüfen und nur abstimmen, was sich nicht ausschließen lässt. Das Spektrum darf einen Kanal überspringen, aber nie auf einem anhalten — jeder Halt stammt aus einem echten Verweilen
- Der Bereich ist entweder das Band aus dem Bandplan oder genau der sichtbare Wasserfall; Fortsetzen nach Ruhe, die Höchstverweildauer und die Ausschlussliste liegen ebenfalls hier und werden in `localStorage` gesichert

#### 4. Audiosystem (`audio.js`)
- WebSocket-Audiostrom
- FLAC-/Opus-Dekodierung
- Steuerung der Audiowiedergabe
- Verteilt rohes PCM (vor Rauschminderung und Stummschaltung des Browsers abgegriffen; die Server-AGC wird auf Slow gehalten, solange ein Decoder geöffnet ist) an die Betriebsartendecoder
- KI-Rauschunterdrückung: `lib/rnnoise.js` lädt das RNNoise-WebAssembly-Modul (`@jitsi/rnnoise-wasm`) beim ersten Gebrauch; `audio.js` wendet es nur in Sprachbetriebsarten an, hinter dem Abgriff für die Decoder, sodass diese es nie hören
- FLAC läuft über `flacLowLatency.js`, das jedes Paket in dem Moment decodiert, in dem es eintrifft, und die tatsächliche Rate des Streams (zum Beispiel 12016,3 Hz) mit einem 64-Tap-Resampler (2,7 ms Verzögerung) auf 12000 Hz bringt. Der WASM-Decoder in `modules/` gab den Ton in festen Blöcken von 1024 Samples frei und hielt rund 160 ms zurück; er wird weiterhin für Opus, für Diversity-Quellen und für FLAC verwendet, wenn die Seite mit `?flac=wasm` geöffnet wird
- Steuerung des Wiedergabepuffers (`playoutControl.js`): `ArrivalMeter` misst, wie unregelmäßig die Pakete gemessen an der eigenen Zeitachse des Streams eintreffen, und die Drift zwischen dem Abtasttakt des Empfängers und der Soundkarte des Hörers; `CushionController` hält den kleinsten Pufferstand der letzten Minute nahe an der Reserve der gewählten Pufferstufe, indem er eine tonhöhengerechte Periode (`spliceOut` / `spliceIn`) des Tons zum Lautsprecher herausschneidet oder wiederholt. Decoder und Aufnahmen erhalten den unveränderten Stream. Gilt für den Pfad mit geplanten Puffern, den jeder Hörer einer reinen http-Station nutzt; `?drain=0` schaltet ihn ab, `?diag=1` zeigt seine Werte

#### 4a. Betriebsartendecoder und ihre Worker

Jeder der rechenintensiven Betriebsartendecoder läuft in einem eigenen Web Worker, sodass die Dekodierung niemals die Audiowiedergabe oder den Wasserfall blockiert. Sie folgen einem gemeinsamen Muster — drei Dateien je Decoder:

| Decoder | Engine | Worker | Proxy im Haupt-Thread |
|---------|--------|--------|------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF-FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FLDIGI (ALE 2G HAM, FSK/RTTY, PSK31/63/125, QPSK, Olivia, Contestia, PSK Browser, Olivia Browser, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet/APRS) + SERVICES (Maritime FSK / SITOR, Weather RTTY, ALE 2G) | `fsk.js`, `psk31.js`, `olivia.js`, `mfsk.js`, `ifk.js`, `throb.js`, `hell.js`, `mt63.js`, `fldigiFec.js`, `ax25.js`, `ale.js`, `fst4w.js`, `msk144.js`, `pskBrowser.js`, `oliviaBrowser.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| SERVICES (DSC, Time Signals, HF Selcall) | `dsc.js`, `timesig.js` | `services.worker.js` | `servicesWorkerProxy.js` |
| CW, CW Browser | `cwDecoder.js`, `cwBrowser.js` | `cw.worker.js` | `cwWorkerProxy.js` |

#### 4b. Empfangsdiversität (`diversity.js`)
- Verbindet den lokalen Empfänger mit einem zweiten anderswo und folgt dem Standort, der gerade das bessere Signal hat. Reines JS, keine Komponente — es sitzt an einer Nahtstelle in `audio.js`, die ihm das lokale PCM übergibt und wiedergibt, was zurückkommt
- **Auswahl, nicht Addition.** Zwei Standorte hören dieselbe Aussendung über verschiedene ionosphärische Wege, ihre Signalverläufe haben also unabhängige Phase; addiert klingt das kammgefiltert. Kohärentes Zusammenführen bräuchte einen gemeinsamen Takt, den zwei Empfänger über das Internet nicht teilen. Gemischt wird nur während einer 30-ms-Überblendung
- Die Ausrichtung korreliert die beiden **Audio-Hüllkurven** (logarithmische Leistung bei 100 Hz), nie die Signalverläufe — die Hüllkurve übersteht sowohl den Weg als auch jeden Codec. Eine Ausrichtung gilt erst, wenn eine zweite, unabhängige Suche zustimmt; das weist die überzeugte, aber falsche Verzögerung zurück, die zwei gegenphasig schwindende Standorte sonst liefern
- Der entfernte Strom wird zuerst auf die lokale Rate **eingerastet**. Zwei Empfänger sind zwei Takte und zwei Dezimierungsketten, ihr Audio trifft also bis zu 2% auseinander ein, selbst wenn beide 12 kHz melden — 240 Abtastwerte pro Sekunde Drift, die keine Korrelation hält. Das Verhältnis wird daraus gemessen, wie viele Abtastwerte jede Seite tatsächlich liefert, und von einem Resampler angewandt, der seine gebrochene Phase über Blockgrenzen mitführt, sodass ein beliebiges Verhältnis dauerhaft hält
- Die Standortwahl nutzt ein Perzentil-SNR, gemessen an **inhaltlich ausgerichteten** Abtastwerten, mit Hysterese, Haltezeit und einem schnellen Notausgang, wenn der aktive Standort zusammenbricht. Die Pegel werden Rauschen-zu-Rauschen angeglichen, damit ein Wechsel das Grundrauschen nicht verändert
- Die Decoder behalten den **lokalen** Datenstrom: FT8, JS8, WSPR und RADE integrieren kohärent über einen Zeitschlitz, und ein Wechsel mittendrin ist eine Phasenunstetigkeit, die die Dekodierung kosten kann

#### 4c. Diversitätsquellen (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Ein Vertrag — `onPcm` / `onState` / `tune` / `canReceive` — sodass `diversity.js` nie erfährt, was am anderen Ende hängt. Ein weiterer Empfängertyp ist eine neue Datei
- `remoteSource.js` — ein weiterer PhantomSDR-Plus über `/audio` (cbor + FLAC), nutzt `createDecoder()` aus `lib/wrappers.js`
- `kiwiSource.js` — ein KiwiSDR: `SND`-Rahmen, Big-Endian-PCM, samt dem 10-Byte-GPS-Zeitstempel, den ein Stereopaket vor das Audio setzt
- `uberSource.js` — ein UberSDR über sein eigenes `/ws`: Opus in einem 21-Byte-Kopf, Abstimmen über die offene Verbindung. Die Sitzungs-ID muss zuvor per `POST /connection` angemeldet werden und muss eine UUID sein
- `webSdrSource.js` — ein WebSDR, über `websdr_relay.py` auf diesem Server: der Browser kann sich nicht direkt verbinden, weil WebSDR den `Origin`-Header prüft und kein Skript ihn ändern darf. Abgestimmt wird per Textrahmen auf derselben Verbindung; die Bandabdeckung liefert das Relay
- `webSdrCodec.js` — das WebSDR-Audioformat: ein byteweise getaggter Strom, dessen komprimierte Blöcke einen 20-stufigen Leaky-LMS-Prädiktor speisen. Aus dem WebSDR-Client portiert und Sample für Sample dagegen geprüft
- `diversityList.js` — die Liste gespeicherter Empfänger und die Adressregeln der vier Typen, gemeinsam genutzt von der Desktop-Oberfläche und der Mobilseite, damit ein Format beiden dient. Dazu die Übertragung — ein kompakter Blob, sein QR-Code und ein Parser, der jede Form annimmt, die die beiden Seiten je geschrieben haben — sowie `browseUrl()`, das eine angewählte Adresse in eine zurückverwandelt, die ein Browser öffnen kann
- `lib/DiversityPanel.svelte` — die Oberfläche: Adresse, Quellentyp, SNR-Trim und Live-Status, dazu die gespeicherten Empfänger — benannt, frei sortierbar und als JSON-Datei exportier- und importierbar, je Quellentyp im `localStorage`. Bearbeitet wird alles innerhalb des Feldes: `prompt()` und `confirm()` blockieren den Main-Thread, über den die Audioblöcke in das Playback-Worklet geschoben werden. Eine Schaltfläche **▦ QR** zeichnet die Liste als scannbaren Code, denn `localStorage` gehört zu einem Browser und ein Telefon beginnt leer. `mobile/Mobile.svelte` bietet dieselbe Funktion in einem Reiter **Div**, im eigenen einfachen CSS jener Seite. Siehe [Empfangsdiversität](RECEIVE_DIVERSITY.md)

#### 4d. Modus-Erkennung (`modeId.js`, `modePriors.js`)
- Beantwortet „was höre ich da?". Sie liest denselben rohen PCM-Abgriff wie die Decoder und listet die wahrscheinlichen Betriebsarten nach Rang, damit man den richtigen Decoder wählt, statt alle zehn durchzuprobieren. Sie decodiert nie: sie misst physikalische Eigenschaften des Signals und bewertet sie gegen eine Tabelle bekannter Betriebsarten
- Die belegte Bandbreite ist die zusammenhängende −15-dB-Breite um die Spitze, bewusst kein 99-%-Leistungswert: Tastklicks legen lange Ausläufer auf das Leistungsintegral und ließen jede schmale Betriebsart um ein Vielfaches zu breit erscheinen. Die Symbolrate kommt aus der **Momentanfrequenz** statt aus Tonenergien, weil keine Integrationszeit zugleich einen 170-Hz-Hub und ein 100-Bd-Symbol auflösen kann. Die Tastrate kommt aus der Ein/Aus-Hüllkurve und dient zugleich als CW-Tempoanzeige
- `modePriors.js` bringt den einen Hinweis ein, den das Audio nicht tragen kann: wo Sie abgestimmt sind. Ein 100-Bd-/170-Hz-Signal auf 518 kHz ist NAVTEX; dasselbe Signal auf 14,070 MHz ist es nicht. Es gewichtet nur um, was das Signal ohnehin hergab, und erfindet nie einen Kandidaten
- FT8, JS8 und FT2 werden absichtlich als eine Gruppe gemeldet: an Bandbreite und Tonabstand allein sind sie nicht zu trennen, und etwas anderes zu behaupten wäre eine selbstbewusst falsche Antwort
- Unterhalb von etwa 10 dB SNR schweigt sie, statt zu raten
- Läuft in einem eigenen Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`) nach demselben Engine/Worker/Proxy-Muster wie die Decoder oben; das Ergebnis ist der Chip in `lib/ModeIdChip.svelte`

#### 4e. Abgewiesene Verbindungen (`refused.js`, `clientVersion.js`)

- `refused.js` ist das gemeinsame Vokabular für eine Verbindung, die der Server abweist: Schließcode **4003** (über einem Limit pro Adresse, oder die Seite ist älter als `[server] min_client_version`) und **4001** (ein Sysop-Rauswurf). Beide sind endgültig. `audio.js`, `waterfall.js` und `events.js` importieren alle `isRefusal()` von dort, denn alle drei öffnen eine Verbindung, die abgewiesen werden kann, und alle drei müssen dann ihr Init-Promise auflösen — sonst wartet die Seite ewig auf eine Verbindung, die nie kommt
- Nichts versucht es erneut. Eine abgebrochene `/audio`-Verbindung beendet die Sitzung mit Absicht: `/waterfall` und `/events` kamen mit einem Wiederverbinden nie zurück, eine erneut aufgebaute Sitzung war also lebendes Audio an einem eingefrorenen Wasserfall, und gegen ein Ratenlimit würde jeder Versuch genau die Abweisung verlängern, die er umgehen wollte. Die Desktop-Seite erklärt eine Abweisung beim Laden und hört einfach auf, wenn eine mitten in der Sitzung kommt; `/mobile` zeigt eine Zeile, die zum Neuladen auffordert
- `clientVersion.js` enthält eine einzige Ganzzahl, `CLIENT_VERSION`, die die Seite ihrer Audioverbindung als `/audio?v=N` anhängt. Der Server weist alles unterhalb von `[server] min_client_version` ab — so zwingt eine Station Tabs, die noch einen älteren Stand fahren, zum Neuladen, der einzige Hebel, den es gibt, da der Server JavaScript im Browser nicht mehr erreicht. Erhöhen Sie sie, wenn eine Frontend-Änderung von offenen Tabs nicht weiter ignoriert werden darf
- Vollständige Referenz: [Verbindungslimits](CONNECTION_LIMITS.md)

#### 4f. Chat-Antworten (`lib/chatReply.js`)
- Eine Antwort ist eine gewöhnliche Chat-Nachricht, die mit einer Markierung beginnt, welche die beantwortete Nachricht benennt: `[RE:<Zeitstempel>|<Name>]`. Der Server speichert und verteilt sie wie jede andere Zeile und braucht keine Änderung
- `chatReply.js` erzeugt und liest diese Markierung und ordnet Antworten eine Ebene tief unter ihrem Original an. `App.svelte` und `mobile/Mobile.svelte` verwenden es beide, sodass beide Seiten den Chat gleich gliedern
- Ist das Original bereits aus dem Verlauf von 20 Nachrichten des Servers verschwunden, bleibt die Antwort dort, wo sie eintraf, und zeigt nur Name und Uhrzeit dessen, worauf sie antwortet

#### 4g. Hörernamen und Datenschutz (`lib/identity.js`)
- Das Namensfeld neben **Open Additional Info** hält Name oder Rufzeichen in `localStorage` (`chatusername`) und sendet ihn auf `/audio` als `{"cmd":"identity","name":…}`; `audio.js` sendet ihn bei jedem Öffnen seines Sockets erneut. Ein Link zu einem Empfänger unter einer anderen Adresse trägt ihn als `?idname=`, das einmal gelesen und aus der Adresszeile entfernt wird
- Der Server bereinigt ihn (`clean_listener_name` in `utils.cpp`): höchstens 10 Zeichen und keine Leerzeichen wie bei einem WebSDR, mindestens ein Buchstabe oder eine Ziffer; die reservierten Namen des Chats und die Platzhalter `anonymous1234` gelten als kein Name. `/users` liefert ihn als `name`; die Wasserfall-Beschriftungen zeigen ihn, gefolgt von der Stadt
- Das öffentliche `/users`, `users.json` und die `/logs/users_*.jsonl`, die `stats.html` liest, enthalten keine IP-Adresse: Die Log-Kopie trägt stattdessen einen undurchsichtigen `visitor`-Code (Hash mit Schlüssel, Schlüssel in `logs/.visitor_salt`); die Dateien auf der Platte behalten die Adressen. Das Admin-Panel liest `/~~users`, das nur einem Loopback-Peer ohne `X-Forwarded-For` antwortet
- Der laufende Decoder geht denselben Weg: `App.svelte` sendet bei jeder Änderung `{"cmd":"decoder","name":"FT8"}` (leer, wenn keiner läuft), `audio.js` sendet ihn auf einem neuen Socket erneut. Der Server behält eine kurze Bezeichnung (Buchstaben, Ziffern, Leerzeichen, `-+/`, höchstens 12) und gibt sie als `decoder` in `/users` und in jeder Zeile von `users_*.jsonl` aus; ein Wechsel wird wie ein Umstimmen protokolliert, sodass `stats.html` (Decoder Popularity) und die Admin-Seite Visitors ihn zählen können
- Die 8/16/24-Stunden-Sperren des Admin-Panels liegen in `admin_bans.json` (wird nie verteilt) und werden einmal pro Minute erneut an jeden Empfänger geschickt; `/~~unban` hebt eine auf

#### 5. Zustandsverwaltung (`stores/`)
- Reaktive Datenspeicher
- Gemeinsamer Anwendungszustand
- Ereignisbehandlung

---

## Frequenzlisten (`frequencylist/`)

Die Frequenzmarken auf dem Wasserfall. `mymarkers.json` ist die Liste, die der Empfänger tatsächlich anzeigt; der Rest ist das Rohmaterial, das `update-markers.sh` daraus macht, aufgefrischt aus den Online-Sendeplänen. `README.md` in diesem Verzeichnis erklärt die Aktualisierung in allen sieben Sprachen.

```
frequencylist/
├── mymarkers.json            # die Marken, die der Empfänger zeigt — von Hand gepflegt, übersteht eine Aktualisierung
├── shortwavestations.json    # Kurzwellensender, erzeugt von generate-current-shortwave.py
├── 0.TXT                     # der globale A26-KW-Sendeplan, von update-markers.sh entpackt und ausgewertet
├── a26allx2.zip              # Quellarchiv, von update-markers.sh heruntergeladen
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # Hilfslisten aus derselben Quelle (Standorte, Sprachen, Betreiber, Antennen)
├── generate-current-shortwave.py
├── update-eibi.sh            # holt den EiBi-Sendeplan für das EiBi-Fenster, höchstens einmal am Tag
├── generate-eibi.py          # macht daraus frontend/public/eibi.json und frontend/dist/eibi.json
├── update-markers.sh         # frischt alles Obige aus den Online-Sendeplänen auf
└── README.md
```

Das EiBi-Fenster (die Schaltfläche **EiBi**) nutzt eine zweite, eigene Liste. `update-markers.sh` ruft zuerst `update-eibi.sh` auf, das den EiBi-Sendeplan (http://www.eibispace.de/dx/) höchstens einmal am Tag prüft und nur herunterlädt, wenn EiBi einen neuen veröffentlicht hat; zur nächsten Saison (Sommer A, Winter B) wechselt es von selbst. `generate-eibi.py` macht daraus `eibi.json` für die Seite und ermittelt die Betriebsart jeder Station. Mit `./frequencylist/update-eibi.sh --force` wird sofort geholt. Ein fehlgeschlagener Download hält die Aktualisierung der Marker nie auf. `update.sh` aktualisiert beide Skripte und fragt vorher, wenn Sie sie geändert haben. `update-markers.sh` kennzeichnet außerdem jeden HFCC-Eintrag, den es in `markers.json` schreibt, mit `"source": "hfcc"`; **Hide HFCC markers** im EiBi-Fenster blendet genau diese aus.

### Format (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

`mode` ist eine Empfänger-Betriebsart (`USB`, `LSB`, `AM`, `FM`, `CW`, …) oder der Name einer digitalen Betriebsart — `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV`, `NAVTEX`, `FAX`, `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR`, `PSK31`, `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `OLIVIA`, `CONTESTIA`, `MFSK`, `MFSK16`, `MFSK32`, `MFSK64`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `FELDHELL`, `MT63`, `PACKET`, `APRS`, `RADEU`, `RADEL`, `RADE` oder `FREEDV` —; dann startet ein Klick auf die Markierung diesen Decoder ([Einzelheiten](DECODERS.md#einen-decoder-über-eine-frequenzmarkierung-starten)).

---

## Konfigurationsdateien

### Serverkonfiguration (`.toml`-Dateien)

Aufbau der Konfigurationsdateien:

```toml
[server]
# Web server settings
port = 9001
html_root = "frontend/dist/"
threads = 2
otherusers = 1
iq = true

[limits]
# Limits pro Adresse — alle standardmäßig aus oder auf einem sinnvollen Wert,
# eine Konfiguration ohne sie verhält sich wie bisher. Siehe CONNECTION_LIMITS.md.
per_ip = 3              # gleichzeitige Hörer von einer Adresse
per_ip_rate = 40        # neue Verbindungen pro Minute von einer Adresse

[websdr]
# Online registration
register_online = true
name = "WebSDR Name"
antenna = "Antenna Type"
grid_locator = "AB12cd"
hostname = "domain.com"

[input]
# SDR input settings
sps = 2048000           # Sample rate
fft_size = 131072       # FFT size
frequency = 145000000   # Base frequency
signal = "iq"           # Signal type: "iq" or "real"
audio_sps = 12000       # Audio sample rate
audio_compression = "opus"  # "flac" or "opus"
accelerator = "opencl"  # "none", "cuda", "opencl"

[input.driver]
# Driver settings
name = "stdin"
format = "u8"           # Sample format

[input.defaults]
# User interface defaults
frequency = 145500000
modulation = "FM"
```

### Standortinformationen (`site_information.json`)

```json
{
  "siteSysop": "Operator Callsign",
  "siteSysopEmailAddress": "email@example.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Hardware specs",
  "siteSoftware": "Software version",
  "siteReceiver": "SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional notes",
  "siteIP": "http://domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Build-System

### Meson-Build-Konfiguration

#### `meson.build` (Wurzel)

Legt fest:
- Projektmetadaten
- Abhängigkeiten
- Compileroptionen
- Listen der Quelldateien
- Build-Ziele

#### `meson_options.txt`

Verfügbare Optionen:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Datenfluss

### Ablauf des Serverbetriebs

```
1. SDR Hardware → rtl_sdr/hackrf_transfer/etc.
                ↓
2. Sample Stream → stdin → spectrumserver
                ↓
3. spectrumserver:
   - FFT calculation (waterfall)
   - Demodulation (audio)
   - Compression (FLAC/Opus)
                ↓
4. WebSocket → Browser Client
                ↓
5. Browser:
   - Render waterfall
   - Decode and play audio
   - Display controls
```

### Ablauf der Nutzerinteraktion

```
1. User clicks on waterfall
                ↓
2. JavaScript sends frequency change request
                ↓
3. WebSocket → spectrumserver
                ↓
4. spectrumserver:
   - Updates demodulator frequency
   - Sends new audio stream
                ↓
5. Browser receives and plays new audio
```

---

## Leitfaden zum Ändern von Dateien

### Wenn Sie Backend-Code ändern (`src/**`):

```bash
./recompile.sh --backend
```

### Wenn Sie Frontend-Code ändern (`frontend/src/**`):

```bash
./recompile.sh --frontend
```

### Wenn Sie die Konfiguration ändern (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Wenn Sie die Marker ändern (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Übliche Dateioperationen

### Das Frontend anpassen

1. Quelle ändern: `nano frontend/src/App.svelte`
2. Neu bauen: `./recompile.sh --frontend`
3. Server neu starten: `./stop-websdr.sh && ./start-rtl.sh`

### Eigene Marker hinzufügen

1. Markerdatei bearbeiten: `nano markers.json`
2. Format:
   ```json
   {
     "markers": [
       {
         "frequency": 145500000,
         "label": "2m Calling",
         "mode": "FM"
       }
     ]
   }
   ```
3. Browser neu laden (kein Serverneustart nötig)

---

## Versionsverwaltung

### Eine Version veröffentlichen (Maintainer)

Vor dem Hochladen die Fingerabdruckliste erneuern, damit `update.sh` auf jeder Station die vorhandenen Fassungen als veröffentlichte erkennt:

```bash
# 1. die geänderten Dateien in die Upload-Kopie kopieren, dann:
bash update.sh --make-known /path/to/the/upload/copy
# 2. update-known.txt committen und ebenfalls in die Upload-Kopie kopieren
```

Die Liste wächst nur: Einträge früherer Versionen bleiben erhalten, sodass eine einmal veröffentlichte öffentliche Kopie in jeder späteren Version erkennbar bleibt.

---

Einrichtungsanweisungen finden Sie in [INSTALLATION.md](INSTALLATION.md). Hinweise zur Bedienung finden Sie in [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
