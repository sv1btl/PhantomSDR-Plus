# RADE v1 Digitalsprache für PhantomSDR-Plus

> **Port 9012.** Auf einer mit `install.sh` eingerichteten Station lauscht der Sidecar nur innerhalb des Rechners, auf `PORT_RADE` (9012), und die Seite erreicht ihn als `/rade` auf dem öffentlichen Port 9000 über `proxy.py`; am Router muss also nichts geöffnet werden.

**RADE** (Radio AutoencoDEr) ist FreeDVs führende Betriebsart für digitale Sprache auf Kurzwelle. Sie nutzt einen Hybrid aus maschinellem Lernen und DSP (den neuronalen FARGAN-Vocoder) und liefert hochwertige Sprache über Kurzwelle bei Signal-Rausch-Abständen bis hinunter zu −2 dB, in nur 1500 Hz HF-Bandbreite — schmaler als ein SSB-Signal.

Dieses Dokument beschreibt die vollständige Integration des RADE-v1-Empfangs in PhantomSDR-Plus, umgesetzt als Python-Sidecar (`rade_helper.py`), der den Browser mit der Dekodierkette `radae_rxe.py` + `lpcnet_demo` verbindet.

Es dekodiert auch **RADE V2 (beta)**, die neue Wellenform von FreeDV 3.0, mit der Taste **RADE-v2U** — siehe [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

## Installation — der kurze Weg

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

Das ist die gesamte Installation. Das Skript installiert die Systempakete über den Paketmanager der Maschine (apt, pacman, dnf oder zypper), weicht für Module, die eine Distribution nicht mitbringt, auf pip aus, aktualisiert `websockets`, wenn die Distributionsversion älter als die vom Sidecar benötigte 11.0 ist, klont und baut radae, prüft die Modellgewichte, baut das Frontend neu und startet den Sidecar. Unter Ubuntu 22.04 übergibt es für Sie an `install_rade_ubuntu22.sh`. `./install.sh` bietet an, es im Rahmen der normalen PhantomSDR-Plus-Installation auszuführen — auf einer frischen Maschine ist RADE also bereits vorhanden. Außerdem baut es FreeDVs rade_c für RADE V2 (beta); schlägt dieser Schritt fehl, wird RADE V1 trotzdem installiert.

**Dieses Dokument erklärt, wie RADE funktioniert und wie man es betreibt.** Die Installation erledigt immer `./install_rade.sh` (oder `./install.sh`, das sie anbietet).

---

## Inhaltsverzeichnis

1. [Installation — der kurze Weg](#installation--der-kurze-weg)
2. [Funktionsweise](#funktionsweise)
3. [Architekturüberblick](#architekturüberblick)
4. [RADEL gegenüber RADEU](#radel-gegenüber-radeu)
   - [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2)
5. [Voraussetzungen](#voraussetzungen)
6. [Steuerung des Sidecars](#steuerung-des-sidecars)
7. [Port 9012](#port-9012)
8. [RADE im Browser nutzen](#rade-im-browser-nutzen)
9. [Überprüfung und Fehlersuche](#überprüfung-und-fehlersuche)
10. [Umgebungsvariablen](#umgebungsvariablen)
11. [Fehlerbehebung](#fehlerbehebung)
12. [RADE v1 aktualisieren](#rade-v1-aktualisieren)

---

## Funktionsweise

RADE v1 kann nicht im Browser laufen — es benötigt PyTorch und den neuronalen FARGAN-Vocoder, die für WASM zu groß sind. Die Lösung ist ein Python-Sidecar-Prozess (`rade_helper.py`), der auf demselben Server wie PhantomSDR-Plus läuft.

> **Wichtig:** `freedv_rx` aus dem codec2-Repository unterstützt RADEV1 **nicht**. Die RADE-Dekodierkette liegt vollständig im separaten Repository `radae` von David Rowe (VK5DGR). Versuchen Sie nicht, codec2s `freedv_rx` für RADE zu verwenden.

Wenn Sie RADE im Browser auswählen:

1. Das Frontend stellt die zugrunde liegende Demodulation auf USB oder LSB — der C++-Server demoduliert das SSB-Signal wie gewohnt.
2. Das rohe demodulierte PCM wird in `audio.js` **vor** jeder Stummschaltung oder Rauschsperre abgegriffen — `radae_rxe.py` braucht einen kontinuierlichen Eingang, um die Rahmensynchronisation zu halten.
3. Jeder PCM-Block wird von reellem f32 auf komplexes f32 mit Nullen aufgefüllt (Realteil + 0.0 Imaginärteil) — genau das erwartet `radae_rxe.py` auf der Standardeingabe.
4. Der Sidecar leitet diese Abtastwerte an `radae_rxe.py` weiter, das Vocoder-Merkmale ausgibt.
5. `lpcnet_demo -fargan-synthesis` wandelt die Merkmale in s16-Sprache mit 16000 Hz um.
6. Der Sidecar wandelt s16 → f32 und sendet das Ergebnis als binäre WebSocket-Rahmen zurück an den Browser.
7. Der Browser spielt die dekodierte Sprache über die Web-Audio-API mit 16000 Hz ab.

Der C++-Server (`spectrumserver.cpp`) wird überhaupt nicht verändert.

---

## Architekturüberblick

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:9000/rade                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 9012)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL gegenüber RADEU

RADE v1 wird stets über SSB übertragen. Konventionell gilt:

| Betriebsart | Seitenband | Zu verwenden auf den Bändern             |
|-------------|------------|------------------------------------------|
| RADEL       | LSB        | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU       | USB        | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## RADE V2 (beta) — RADE2

**RADE V2** ist die neue Wellenform von FreeDV 3.0: etwa 800 Hz breit statt 1500 Hz, ohne Pilotsymbole und bei niedrigem SNR etwa 3 dB empfindlicher. **Bei FreeDV ist sie noch Beta** — nur Stationen, die FreeDV 3.0 testen, senden sie, und das Signal kann sich vor der Veröffentlichung noch ändern. PhantomSDR-Plus dekodiert sie neben RADE V1:

| Taste | Version | Seitenband | Filter |
|---|---|---|---|
| **RADE-v2U** (RADE2) | RADE V2 (beta) | USB auf jedem Band | 1040–1930 Hz |
| **RADE-v1L** / **RADE-v1U** (RADEL / RADEU) | RADE V1 | LSB / USB | 700–2200 Hz |

V2 wird auf dem Server von FreeDVs C-Portierung **rade_c** dekodiert (`radae_rx --v2` und sein eigenes `lpcnet_demo`), gebaut in einem eigenen Ordner `~/rade_c`, sodass die V1-Installation in `~/radae` nie berührt wird. `./install_rade.sh` lädt und baut es (Schritt „rade_c (RADE V2, beta)“); schlägt dieser Schritt fehl, warnt es nur, und RADE V1 wird trotzdem installiert. `rade_helper.py` verwendet rade_c ab der nächsten RADE2-Verbindung — ein Neustart ist nicht nötig — und ohne es meldet RADE2 dem Hörer „RADE V2 is not installed on this station yet“. Eine V2-Dekodierung kostet etwa 1 % eines CPU-Kerns pro Hörer (V1: etwa 70–80 %).

**Auf Sendung**

- Bis auf etwa **±30 Hz** genau auf die Frequenz der Station abstimmen. Weiter daneben zeigt V2 noch „Synced“, aber die Sprache ist unverständlich.
- Jeder Durchgang beginnt **2–3 s verspätet**: Während V2 einrastet, hält es das Signal fest und spielt dann den Anfang des Durchgangs.
- Unterhalb von etwa **−2 dB SNR** wird der V2-Ton stummgeschaltet und das Panel zeigt „Searching for signal…“ — außer die letzten 2 Sekunden sehen nach echtem V2 aus (der Decoder sieht sein Signal die meiste Zeit und seine Frequenzschätzung bleibt ruhig); dann spielt er bis etwa **−6 dB**. Auf belebten LSB-Telefoniefrequenzen, in USB gehört (40 m), kann V2 auf gewöhnliche Stimmen einrasten und unverständlichen Ton spielen; diese wirken nie ruhig und bleiben daher stumm. `RADE_V2_MIN_SNR` und `RADE_V2_WEAK_SNR` legen die beiden Schwellen fest.
- Zwischen den Durchgängen kehrt das Panel zu „Searching for signal…“ zurück.

**Wenn FreeDV 3.0 erscheint**, `./install_rade.sh` erneut ausführen — oder `git pull` in `~/rade_c` und `cmake --build build` —, dann verwenden neue RADE2-Verbindungen die neue Version.

---

## Voraussetzungen

| Anforderung | Version | Anmerkungen |
|---|---|---|
| PhantomSDR-Plus | beliebig | mit Vite-/Svelte-Frontend |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | getestet |
| Python | 3.8+ | für `rade_helper.py` und `radae_rxe.py` |
| radae-Repository | aktueller master | liefert `radae_rxe.py` und `lpcnet_demo` |
| cmake | 3.10+ | um `lpcnet_demo` aus radae zu bauen |
| PyTorch | 2.0+ | von `radae_rxe.py` benötigt |
| Node.js | 16+ | für `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — alle Versionen unterstützt |
| matplotlib | beliebig | von `radae_rxe.py` beim Import benötigt |
| numpy | 1.23+ | erforderlich; ermöglicht auch Resampling |
| scipy | beliebig | optional, ermöglicht genaues Resampling |

---

## Steuerung des Sidecars

**Normalerweise brauchen Sie kein eigenes Steuerskript für RADE.** Die Startskripte des Empfängers (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) starten das Sidecar selbst, sobald der Server bestätigt läuft, starten es neu, wenn es sich beendet, und melden seinen Zustand in ihrer Abschlusszusammenfassung — `✔ RADE sidecar running`, oder ein `·`-Hinweis, warum es nicht aktiviert wurde (nicht installiert, `RADE_ENABLED=0`, oder kein `python3`). `./stop-websdr.sh` stoppt es zusammen mit dem Server. Um den Server ohne RADE zu betreiben, starten Sie ihn mit `RADE_ENABLED=0`.

`rade.sh` bleibt für den eigenständigen Betrieb erhalten — das Sidecar ohne den PhantomSDR-Plus-Launcher zu betreiben oder es allein zu testen:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Die Sidecar-Aktivität wird nach `~/PhantomSDR-Plus/rade.log` protokolliert:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Mischen Sie beides nicht, während der Server läuft.** Ist der Watchdog eines Startskripts aktiv, holt er das Sidecar innerhalb von etwa fünf Sekunden zurück, sodass `./rade.sh stop` wie ein Fehlschlag aussieht. Um RADE bei laufendem Server zu stoppen, starten Sie den Server entweder mit `RADE_ENABLED=0` oder halten Sie mit `./stop-websdr.sh` alles an.

> Wenn Sie `rade.sh` eigenständig betreiben, **verwenden Sie immer `./rade.sh stop`** — ein bloßes `pkill -f rade_helper.py` schlägt seinen eigenen Watchdog nicht, der den Prozess binnen 3 Sekunden neu startet.

---

## Port 9012

Der Sidecar lauscht auf TCP-Port **9012**, nur innerhalb des Rechners. Der Browser erreicht ihn über `proxy.py` als `/rade` auf dem öffentlichen Port 9000; am Router und in einer Firewall muss also kein weiterer Port geöffnet werden.

```bash
# Is the sidecar listening?
ss -tlnp | grep 9012
```

---

## RADE im Browser nutzen

1. Öffnen Sie Ihre PhantomSDR-Plus-Weboberfläche
2. Aktive Stationen finden Sie unter **[qso.freedv.org](https://qso.freedv.org)**
3. Stimmen Sie auf die Anzeigefrequenz der Station ab
4. Wählen Sie unter **Decoder Options**:
   - **RADE v2 · RADE2** für RADE V2 (beta), USB auf jedem Band
   - **RADE v1 — RADEL (LSB)** für 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** für 20 m / 17 m / 15 m / 12 m / 10 m
5. Klicken Sie auf **Decoder: ON**

### Die Tasten RADE-v1L / RADE-v1U (ein Druck)

Die Schritte 4 und 5 lassen sich durch einen einzigen Druck ersetzen. Ein Tastenpaar **RADE-v1L** / **RADE-v1U** steht an drei Stellen zur Verfügung:

- neben der Überschrift **Modes** im Hauptpanel;
- im Popup-Fenster **Modes**;
- im Popup-Fenster **Bands**.

Ein Druck wählt den Decoder aus, schaltet den Decoder ON, schließt das Popup, in dem Sie gedrückt haben, und holt das RADE-Panel in den sichtbaren Bereich. Die Taste leuchtet blau, solange RADE läuft. **Ein erneuter Druck auf dieselbe Taste schaltet RADE ab** — das Panel schließt sich, und Betriebsart und Durchlassbereich werden wie unten beschrieben zurückgesetzt. Die Tasten, das Dropdown-Menü **Decoder Options** und die ON/OFF-Taste teilen sich denselben Zustand.

Eine Taste **RADE-v2U** steht an denselben drei Stellen vor RADE-v1L und RADE-v1U (und eine RADE2-Taste auf `/mobile`); sie startet RADE V2 (beta) in USB — siehe [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

### Zustände der Anzeige im Bedienfeld

| Anzeige | Bedeutung |
|---|---|
| 🔴 Rot — „Connecting to sidecar…" | Port 9012 nicht erreichbar oder Sidecar läuft nicht |
| 🟡 Gelb — „Searching for signal…" | Sidecar verbunden, noch kein RADE-Rahmen erkannt |
| 🟢 Grün — „Synced · SNR x.x dB" | Dekodierung läuft — Sprache ist zu hören |

### Wenn Sie den Decoder abschalten

Betriebsart und Durchlassbereich kehren automatisch zum korrekten Standard für die aktuelle Frequenz zurück, wie in `bands-config.js` festgelegt — genau wie bei FAX, NAVTEX, FSK.

---

## Überprüfung und Fehlersuche

### Läuft der Sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 9012
```

### Aktivität live beobachten

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Wenn sich ein Browser verbindet:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Browserkonsole (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:9000/rade
```
Gut — der WebSocket ist offen. Der Hz-Wert entspricht dem `audioOutputSps` Ihres Servers (typischerweise 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Der Sidecar ist nicht erreichbar — prüfen Sie, ob er läuft (`ss -tlnp | grep 9012`) und ob `proxy.py` läuft.

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `RADE_HELPER_PORT` | `9012` | TCP-Port, auf dem der Sidecar lauscht |
| `RADE_HELPER_HOST` | `0.0.0.0` | Bindeadresse (`127.0.0.1` hinter einem Proxy) |
| `RADAE_DIR` | `~/radae` | Wurzel des radae-Repositories |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Modellgewichte |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binärdatei lpcnet_demo |
| `RADE_AUXDATA` | `1` | Auf `0` setzen, um `--noauxdata` an `radae_rxe.py` zu übergeben |
| `RADE_TORCH_THREADS` | `1` | PyTorch-/OpenBLAS-Threads je `radae_rxe.py`-Instanz — begrenzt die CPU-Last |
| `RADE_PIN_CORES` | `1` | Bindet jede Dekodierkette an einen eigenen Kernsatz; `0` deaktiviert das Pinning |
| `RADE_CORES_PER_CLIENT` | `2` | Zugewiesene Kerne pro Client, wenn Pinning aktiv ist |
| `RADE_C_DIR` | `~/rade_c` | Wurzel von rade_c (RADE V2) |
| `RADE_C_RX` | `RADE_C_DIR/build/src/radae_rx` | Empfangsprogramm von rade_c |
| `RADE_C_LPCNET` | `RADE_C_DIR/build/src/lpcnet_demo` | Das eigene lpcnet_demo von rade_c |
| `RADE_V2_MIN_SNR` | `-2` | Unter diesem SNR (dB) wird der V2-Ton stummgeschaltet |
| `RADE_V2_WEAK_SNR` | `-6` | Bis zu diesem SNR (dB) spielt V2 weiter, solange das Signal nach echtem V2 aussieht; auf `RADE_V2_MIN_SNR` oder höher setzen, um das abzuschalten |
| `RADE_V2_TARGET_DB` | `-16` | Pegel, auf den die V2-Sprache gebracht wird, in dBFS (`0` = aus) |

---

## Fehlerbehebung

### Rotes Banner — „Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &
```

---

### `lpcnet_demo: No such file or directory`

Der radae-Build wurde nicht abgeschlossen. Neu bauen:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Gelbe Anzeige — „Searching for signal" — rastet nie ein

- Bestätigen Sie das richtige Seitenband: RADEL für ≤ 10 MHz, RADEU für > 10 MHz
- Prüfen Sie auf [qso.freedv.org](https://qso.freedv.org), ob gerade eine Station sendet
- RADE v1 nutzt 30 Träger in 1500 Hz Bandbreite — es erscheint als kompakte Gruppe im Wasserfall
- Rechnen Sie mit bis zu 1,5 Sekunden für das Einrasten

---

### Mehrere gleichzeitige Nutzer

Jede Browserverbindung startet ihr eigenes, unabhängiges Paar aus `radae_rxe.py` + `lpcnet_demo`, sodass jeder Nutzer frei auf eine andere Frequenz abstimmen kann.

Standardmäßig nutzt `radae_rxe.py` **alle verfügbaren CPU-Kerne** für PyTorch-Matrixoperationen und verursacht damit rund 900 % CPU-Last pro Instanz. `rade_helper.py` begrenzt das mit zwei Optimierungen:

1. `OMP_NUM_THREADS=1` (sowie die MKL-/OpenBLAS-Entsprechungen) — begrenzt PyTorch auf 1 Thread
2. Mit numpy vektorisierte Audio-Konvertierungsfunktionen — beseitigen den Aufwand von Python-Schleifen

Ergebnis: Jede Instanz belegt grob **8–10 %** eines Kerns, genug für eine RADE-Dekodierung in Echtzeit. Falls Sie Tonaussetzer hören, erhöhen Sie auf 2 Threads:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Gleichzeitige RADE-Nutzer | Ungefähre CPU-Last |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Auf einem i5-12450H (12 Threads), auf dem spectrumserver ~42 % und rx888_stream ~11 % belegen, haben Sie rund **1000 % Reserve** — genug für **20 und mehr gleichzeitige** RADE-Nutzer, bevor die CPU zum Problem wird.

---

## RADE v1 aktualisieren

**Um RADE zu aktualisieren, führen Sie `./install_rade.sh` erneut aus.** Es holt die neuesten Stände von radae und rade_c, baut sie neu und startet den Sidecar neu; der Empfänger selbst braucht keinen Neustart.

---

*Entwickelt und getestet auf PhantomSDR-Plus (Fork sv1btl/PhantomSDR-Plus) mit RX-888 MK2 unter Ubuntu 24.04. Der C++-Server wird nicht verändert.*

*RADE wird von David Rowe VK5DGR und dem FreeDV-Team entwickelt.* *Siehe [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Vollständige Deinstallation und Neuinstallation

Hier der komplette Rückbau, bevor install_rade.sh erneut ausgeführt wird:
1. Den Sidecar stoppen cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Das radae-Repository und den Build entfernen rm -rf ~/radae
3. torch entfernen (im Benutzerverzeichnis installiert) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Python-Pakete aus apt entfernen (optional — überspringen, wenn andere sie nutzen) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Prüfen, dass alles weg ist python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Neuinstallation chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
