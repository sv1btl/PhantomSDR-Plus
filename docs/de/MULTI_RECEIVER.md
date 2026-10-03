# Mehrere Empfänger — Sysop-Handbuch

**Zwei oder mehr Empfänger auf einem Rechner, mit einer Empfängerauswahl auf der Seite.**

Seit v5.0.0 kann ein PhantomSDR-Plus-Rechner mehrere Empfänger gleichzeitig betreiben — zum Beispiel einen RX-888 für Kurzwelle und einen RTL-SDR für 2 m — und die Hörer wechseln mit Schaltflächen im Seitenkopf zwischen ihnen, so wie OpenWebRX seine Profile anbietet. Jeder Empfänger behält seinen eigenen Wasserfall, Chat, seine Markierungen, Hörerliste und Stationsangaben; niemand auf einem Empfänger wird je von jemandem auf einem anderen gestört.

> **Eilig?** Eine Station mit einem Empfänger braucht nichts davon und merkt keinen Unterschied. Für einen zweiten Empfänger: `instances/<name>/` mit eigener `config.toml` anlegen, mit `INSTANCE=<name> ./start-<radio>.sh` starten, beide Empfänger in `receivers.toml` eintragen und den Proxy neu starten. Das Beispiel in [Abschnitt 3](#3-einen-zweiten-empfänger-hinzufügen) geht es Zeile für Zeile durch.

> **Am einfachsten:** Führen Sie `./add-receiver.sh` aus (die Installer bieten es am Ende an). Das Skript fragt, welcher Empfänger und was er abdecken soll, installiert seinen Treiber, schreibt alles, was in [Abschnitt 3](#3-einen-zweiten-empfänger-hinzufügen) und [Abschnitt 4](#4-receiverstoml) beschrieben ist, und bietet an, den Empfänger zu starten und den Proxy neu zu starten. Der Rest dieses Handbuchs erklärt, was es tut — für den Fall, dass Sie etwas von Hand ändern möchten.

---

## Inhalt

1. [Wie es funktioniert](#1-wie-es-funktioniert)
2. [Zwei Arten, die Empfänger zu veröffentlichen](#2-zwei-arten-die-empfänger-zu-veröffentlichen)
3. [Einen zweiten Empfänger hinzufügen](#3-einen-zweiten-empfänger-hinzufügen)
4. [receivers.toml](#4-receiverstoml)
5. [Starten und Stoppen](#5-starten-und-stoppen)
6. [Was die Hörer sehen](#6-was-die-hörer-sehen)
7. [Das S-Meter oberhalb von 30 MHz](#7-das-s-meter-oberhalb-von-30-mhz)
8. [Sicherheit](#8-sicherheit)
9. [Wie viele Empfänger passen](#9-wie-viele-empfänger-passen)
10. [Fallen, die man kennen sollte](#10-fallen-die-man-kennen-sollte)

---

## 1. Wie es funktioniert

Jeder Empfänger ist ein vollständiger eigener spectrumserver mit eigenem SDR-Frontend, eigener Konfiguration und eigenem internen Port. Sie teilen niemals Abtastwerte, Einstellungen oder Hörer. Verbunden werden sie durch `proxy.py`, den Reverse-Proxy, der bereits das Admin-Panel ausliefert: Er liest `receivers.toml` und schickt jede Anfrage an einen Empfänger.

```
                     ┌──► :8900  spectrumserver  RX-888   (KW, der Hauptempfänger)
Hörer ──► proxy.py ──┤
                     └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, Instanz "vhf")
```

Der Proxy entscheidet anhand dieser Merkmale, in dieser Reihenfolge:

1. `?rx=<id>` in der Adresse — `http://ihr.host:8899/?rx=vhf`. Die Seite hängt es an jeden Socket, jede Abfrage und jeden Link an, den sie öffnet, damit ein Tab bei seinem Empfänger bleibt.
2. Das Cookie `rx`, das der Proxy setzt, sobald eine Anfrage ein gültiges `?rx=` trägt.
3. Der Host-Header, wenn ein Empfänger diesen Namen unter `hostnames` führt.
4. Sonst der Standardempfänger.

Der **Hauptempfänger** ist der wie gewohnt gestartete (`./start-rx888mk2.sh`). Jeder weitere Empfänger ist eine **benannte Instanz**: mit `INSTANCE=<name>` gestartet, in `instances/<name>/` konfiguriert und mit eigenem Log (`logwebsdr-<name>.txt`), Server-Log, Watchdog-Sperre und FIFO. Die Prozesse werden an einer Kennung `PHANTOMSDR_INSTANCE` in ihrer Umgebung unterschieden, nicht an ihrem Namen; zwei Empfänger dürfen also dasselbe Programm ausführen — zweimal `rtl_sdr`, oder `rx_sdr` für einen RSP1A und einen Airspy — und ein Neustart des einen berührt den anderen nie.

---

## 2. Zwei Arten, die Empfänger zu veröffentlichen

**A — der Hauptempfänger behält seinen eigenen Port.** Der Hauptempfänger bleibt genau, wo er war (etwa `:8900`), seine Hörer merken nichts, und die anderen Empfänger erreicht man über den Port des Proxys (`proxy_port` in `admin_config.json`, etwa `:8899`) mit `?rx=`. Nichts muss umziehen, nichts geht vom Netz; dafür gibt es zwei öffentliche Ports.

```
KW:  http://ihr.host:8900/
2 m: http://ihr.host:8899/?rx=vhf
```

**B — ein öffentlicher Port für alles.** Der Proxy übernimmt den öffentlichen Port, und der Hauptempfänger zieht auf einen internen um. Setzen Sie `[front] port` in `receivers.toml`, verlegen Sie `[server] port` des Hauptempfängers und setzen Sie dort `host = "127.0.0.1"`, stellen Sie `public_port` in `admin_config.json` auf den neuen internen Port und tragen Sie `public_port = <der öffentliche Port>` unter `[websdr]` ein, damit das Verzeichnis weiterhin den richtigen meldet. Danach liegt alles hinter einem Port; der Preis ist eine kurze Unterbrechung beim Umzug.

```
KW:  http://ihr.host:8900/
2 m: http://ihr.host:8900/?rx=vhf
```

Die Empfängerauswahl funktioniert in beiden Fällen gleich. Variante A ist der sicherere Anfang; B kann später folgen, ohne am zweiten Empfänger etwas zu ändern.

---

## 3. Einen zweiten Empfänger hinzufügen

**`add-receiver.sh` erledigt alle folgenden Schritte** — starten Sie es und beantworten Sie seine Fragen; es installiert auch den Treiber (`setup-rtlsdr.sh` für einen RTL-SDR, das passende `setup-*.sh` für die anderen), wählt einen freien internen Port und benennt den Empfänger nach dem, was er abdeckt. Die Schritte stehen hier ausgeschrieben, damit Sie seine Arbeit prüfen oder später ändern können.

Das Beispiel fügt einen RTL-SDR Blog V4 für 2 m als Instanz `vhf` hinzu, neben einem RX-888, der Port 8900 behält (Variante A).

**1. Der Treiber.** Der RTL-SDR Blog V4 braucht den Treiber von RTL-SDR Blog statt des Pakets `rtl-sdr` der Distribution, und der DVB-T-Treiber des Kernels muss den Stick freigeben. `install.sh` (Empfängeroption 2, „RTL-SDR Blog V4: ja") erledigt beides. Prüfen Sie mit `rtl_test -t`; dort muss `RTL-SDR Blog V4 Detected` stehen.

**2. Der Instanzordner.** Alles, was zum Empfänger gehört, liegt in `instances/vhf/`; dieser Ordner wird nie committet und von keinem Update überschrieben:

```
instances/vhf/
├── config.toml          seine spectrumserver-Konfiguration (Pflicht)
├── instance.env         optional: Empfängerparameter und CPU-Bindung
├── markers.json         seine eigenen Markierungen
└── www/                 eigene Kopien der stationsbezogenen Dateien der Seite
    ├── site_information.json
    └── wf-message.json
```

spectrumserver läuft mit `instances/vhf/` als Arbeitsverzeichnis; Chatverlauf, Markierungen, FFTW-Wisdom und `logs/` gehören damit ebenfalls dem Empfänger.

**3. `config.toml`.** Gehen Sie von `config-rtl.toml` aus und ändern Sie:

```toml
[server]
port=9002                              # eigener interner Port
host="127.0.0.1"                       # nur über den Proxy erreichbar
html_root="www/"                       # seine wenigen eigenen Dateien...
html_fallback_root="../../frontend/dist/"   # ...und für den Rest die gemeinsame Seite

[input]
sps=2400000                            # muss zu -s in instance.env passen
frequency=145000000                    # muss zu -f in instance.env passen

[input.defaults]
frequency=145500000
modulation="FM"

[kiwi_emulation]
enabled = false                        # siehe die Fallen unten
```

Mit `html_fallback_root` behält die Instanz nur ihre eigene `site_information.json` und `wf-message.json`, während alles andere — die gebaute Seite selbst — aus `frontend/dist` kommt; ein einziger Frontend-Build erreicht so jeden Empfänger. Eine per Symlink verlinkte Kopie von `frontend/dist` funktioniert nicht: Der Server verweigert Dateien, die außerhalb seines eigenen Ordners liegen.

**4. `instance.env`.** Wird vom Startskript nach seinen eigenen Einstellungen gelesen:

```bash
RX_ARGS="-f 145000000 -s 2400000 -g 29.7 -"   # -f und -s passen zu config.toml
SPECTRUM_CORES=8-11                           # weg von den Kernen des Hauptempfängers
```

**5. Seine Seitenangaben.** Kopieren Sie `frontend/site_information.json` nach `instances/vhf/www/` und passen Sie an: `siteReceiver`, `siteAntenna`, `siteSDRBaseFrequency` und `siteSDRBandwidth` (diese bestimmen, welche Bandschaltflächen erscheinen) sowie die in [Abschnitt 6](#6-was-die-hörer-sehen) beschriebenen Schlüssel.

**6. Starten.**

```bash
INSTANCE=vhf ./start-rtl.sh
```

**7. In `receivers.toml` eintragen** und den Proxy neu starten (`sudo systemctl restart phantomsdr-proxy`). Der zweite Empfänger ist jetzt unter `http://ihr.host:8899/?rx=vhf` erreichbar, und beide Seiten zeigen die Auswahl.

---

## 4. receivers.toml

Kopieren Sie `receivers.toml.example` nach `receivers.toml`. Ohne diese Datei bedient der Proxy genau wie bisher einen einzigen Empfänger.

```toml
# [front]
# port = 8900        # nur Variante B: der Proxy hört zusätzlich auf diesem öffentlichen Port

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 8900
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://ihr.host:8900/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://ihr.host:8899/?rx=vhf"
```

| Schlüssel | Bedeutung |
|---|---|
| `id` | Kurzname für `?rx=`; Buchstaben, Ziffern, `-` und `_` |
| `name` | Die Beschriftung der Schaltfläche des Empfängers |
| `port` | `[server] port` seines spectrumservers |
| `host` | Optional; wo dieser spectrumserver läuft (Standard `127.0.0.1`) |
| `default` | Der Empfänger für Anfragen, die keinen nennen; höchstens einer |
| `launcher` | Sein `start-*.sh`, für `start-all.sh`; weglassen bei einem Empfänger, den dieser Rechner nicht startet |
| `instance` | Sein Instanzname; beim Hauptempfänger weglassen |
| `url` | Wohin seine Schaltfläche den Hörer schickt; ohne Angabe `/?rx=<id>` auf dem Proxy |
| `hostnames` | Optionale DNS-Namen, die direkt zu diesem Empfänger führen |

Der Proxy liefert die Liste auch als `/receivers.json` aus (IDs, Namen und Links — nie die internen Ports); diese Datei liest die Auswahl.

---

## 5. Starten und Stoppen

| Befehl | Wirkung |
|---|---|
| `./start-rx888mk2.sh` | Startet oder startet den Hauptempfänger neu |
| `INSTANCE=vhf ./start-rtl.sh` | Startet oder startet den Empfänger `vhf` neu |
| `./start-all.sh` | Startet jeden Empfänger in `receivers.toml`, der einen `launcher` hat |
| `./stop-websdr.sh vhf` | Stoppt nur `vhf` |
| `./stop-websdr.sh main` | Stoppt nur den Hauptempfänger |
| `./stop-websdr.sh` | Stoppt jeden Empfänger, wie schon immer |

**Solange ein Empfänger gestoppt ist**, verschwindet seine Schaltfläche aus der Auswahl — der Proxy führt nur die Empfänger auf, die antworten, und offene Seiten lesen die Liste einmal pro Minute neu — und sie kehrt zurück, sobald der Empfänger wieder läuft; läuft nur noch ein Empfänger, verschwindet die Zeile *Receivers:* ganz. Ein gestoppter Empfänger kommt allerdings von selbst zurück, sobald alle Empfänger gestartet werden: `./start-all.sh`, **Restart** im Admin-Panel und ein Neustart durch den Temperaturschutz starten alles, was in `receivers.toml` steht. Soll einer dauerhaft aus bleiben, entfernen Sie seinen Block `[[receiver]]` (oder kommentieren ihn aus) und starten den Proxy neu.

Stellen Sie im Admin-Panel das **Default start script** auf `start-all.sh`. Sein Stop hält bereits jeden Empfänger an, und Restart sowie der Temperaturschutz verwenden das Startskript; mit `start-all.sh` kehren deshalb alle Empfänger zurück statt nur des Hauptempfängers.

Der RADE-Helfer gehört nur zum Hauptempfänger. Eine benannte Instanz startet oder stoppt ihn nie.

---

## 6. Was die Hörer sehen

**Die Empfängerauswahl.** Auf einer Station mit mehr als einem Empfänger bekommt der Seitenkopf eine eigene Zeile, *Receivers:*, mit einer Schaltfläche pro Empfänger; der aktuelle erscheint gelb. Die Seite /mobile hat dieselben Schaltflächen als zweite Reihe in ihrer oberen Leiste, und sie öffnen die /mobile-Seite des anderen Empfängers.

**Die eigenen Angaben jedes Empfängers.** Eine Seite, die auf einem zweiten Empfänger geöffnet wird, lädt vor dem Start dessen `site_information.json`; Bandschaltflächen, Startfrequenz, Hörerliste, Stationsangaben sowie die Links bei Receiver und Antenna gehören damit zu ihm. Ein normaler Besuch beim Hauptempfänger stellt keine zusätzliche Anfrage.

Die Schlüssel in `site_information.json` dafür:

| Schlüssel | Bedeutung |
|---|---|
| `siteReceiverId` | Der Empfänger, zu dem diese Seite gehört (seine `id`); beim Hauptempfänger weglassen |
| `siteReceiversList` | Wo die Auswahl die Liste liest, z. B. `http://ihr.host:8899/receivers.json`; nötig bei einem Empfänger, dessen Seite nicht über den Proxy ausgeliefert wird |
| `siteReceiverURL` | Wohin der Name bei *Receiver* in *Open Additional Info* verlinkt |
| `siteAntennaURL` | Wohin der Name bei *Antenna* verlinkt; `""` zeigt den Namen ohne Link |

**Wann die Auswahl verborgen bleibt.** Die Auswahl zeigt nur eine Liste, die den Host nennt, unter dem die Seite geöffnet wurde. Über die LAN-Adresse geöffnet (`http://192.168.1.10:8900/`) bleibt sie verborgen; als `http://ihr.host:8900/` erscheint sie. Das ist Absicht: Eine Station, die die `site_information.json` einer anderen unverändert übernommen hat, zeigt deren Empfänger nie als ihre eigenen.

---

## 7. Das S-Meter oberhalb von 30 MHz

Nach dem Standard der IARU Region 1 liegt S9 unterhalb von 30 MHz bei −73 dBm und **oberhalb bei −93 dBm**, in beiden Fällen sechs dB je S-Stufe. Die S-Meter (Zeigerinstrument, digitaler Balken und der Balken auf /mobile) folgen der eingestellten Frequenz: Oberhalb von 30 MHz zeigen sie VHF-S-Stufen, darunter wie bisher. Die Werte in dBm und dBµV werden nie verändert. Sollen die Instrumente auf einem leeren Kanal auf 0 ruhen wie bei einem VHF/UHF-Funkgerät, tragen Sie `"siteSMeterGateDb": 6` in die `site_information.json` des Empfängers ein (kein Neubau nötig): Oberhalb von **60 MHz** schlagen Zeiger und Balken dann erst aus, wenn ein Signal so viele dB über dem Rauschen in seiner eigenen Umgebung liegt (der stärkste Punkt im Durchlassbereich gegen das Spektrum ±100 kHz darum herum). Das ist **standardmäßig aus** — ein kalibriertes Instrument, das das echte Bandrauschen zeigt, ist die ehrlichere Anzeige. Die Seite /mobile, die keinen Wasserfall hat, schätzt das Rauschen aus dem empfangenen Pegel selbst.

Kalibrieren Sie die dBm-Anzeige eines VHF-Empfängers mit `analog_smeter_offset` (Zeiger und Zahlen) und `smeter_offset` (digitaler Balken) unter `[input]` in seiner `config.toml` und starten Sie diesen Empfänger danach neu. Stellen Sie zuerst die Verstärkung ein: Ein RTL-SDR meldet Pegel relativ zu seinem eigenen Vollausschlag, jede Änderung der Verstärkung verschiebt also die Anzeige. Ohne Messsender sollte ein 50-Ω-Abschluss statt der Antenne, in USB mit 2,7-kHz-Filter, etwa −136 dBm anzeigen (thermisches Rauschen in 2,7 kHz ist −139,7 dBm, plus die Rauschzahl des Sticks).

Für einen RTL-SDR schreibt `add-receiver.sh` eine Startkalibrierung: eine feste Verstärkung `-g 29.7` in `instance.env` (die automatische Verstärkung des Tuners lässt sich nicht kalibrieren) sowie `analog_smeter_offset=-55` und `smeter_offset=-38`, gemessen an einem RTL-SDR Blog V4 bei dieser Verstärkung mit einem Signal von −71 dBm (63 µV). Ein anderer Stick desselben Modells liegt meist nur wenige dB daneben; prüfen Sie ihn mit einem bekannten Signal und kalibrieren Sie neu, wenn Sie die Verstärkung ändern.

---

## 8. Sicherheit

Den Proxy vor die Hörer zu stellen, hat zwei Lücken geschlossen; beide sind in v5.0.0 behoben:

- **Der Sysop-Kick über den Proxy.** spectrumserver erlaubt `/~~kick` nur vom eigenen Rechner, und für ihn kommt jede vom Proxy weitergeleitete Anfrage vom eigenen Rechner. Wer den Proxy-Port erreichen konnte, konnte deshalb jeden Hörer trennen und sperren. Der Proxy beantwortet `/~~kick` jetzt nur noch für Clients auf demselben Rechner.
- **Gefälschte Client-Adressen.** spectrumserver glaubte einen `X-Forwarded-For`-Header von jedem; ein Besucher konnte sich als `127.0.0.1` ausgeben und an den Limits pro Adresse vorbeigehen. Der Header wird jetzt nur noch von einem lokalen Proxy geglaubt, und der Proxy verwirft jede Kopie, die ein Client mitschickt, bevor er seine eigene anfügt.

Binden Sie jeden Empfänger, der über den Proxy erreicht wird, an `127.0.0.1` (`[server] host`), damit sein Port nicht am Proxy vorbei genutzt werden kann. Die Limits pro Adresse aus [Verbindungslimits](CONNECTION_LIMITS.md) gelten je Empfänger.

---

## 9. Wie viele Empfänger passen

Die Software setzt keine Grenze; die Hardware tut es. Schmalbandige Empfänger sind genügsam: Ein RTL-SDR mit 2,4 Msps braucht etwa 5–10 % eines Kerns, einige Dutzend MB Speicher und etwa 38 Mbit/s auf dem USB.

- **USB 2.0 ist die übliche Grenze.** Alle USB-2-Geräte teilen sich einen Bus mit 480 Mbit/s, auch in einer blauen USB-3-Buchse. Drei bis vier RTL-SDR je Bus sind ein sicherer Wert; fügen Sie sie einzeln hinzu und beobachten Sie jeden Wasserfall auf Lücken.
- **Strom:** Ab mehr als zwei Sticks einen aktiven Hub verwenden.
- **Ein zweiter Breitbandempfänger** (ein weiterer RX-888 oder ein HackRF mit 20 Msps) ist etwas anderes: Er konkurriert mit dem ersten um USB 3, CPU und GPU.
- **Hörer kosten mehr als Empfänger.** Jeder Hörer kostet CPU auf seinem Empfänger und Upload-Bandbreite; die Gesamtzahl der Hörer zählt deshalb mehr als die Zahl der Empfänger.

---

## 10. Fallen, die man kennen sollte

- **Zwei Sticks desselben Modells haben dieselbe Seriennummer.** Jeder RTL-SDR Blog V4 meldet `00000001`. Geben Sie jedem eine eigene mit `rtl_eeprom -s <seriennummer>` (immer nur ein Stick eingesteckt) und nennen Sie sie in `instance.env` (`RX_ARGS="-d <seriennummer> …"`), sonst können die Sticks nach einem Neustart die Empfänger tauschen.
- **Kiwi-Clients können keinen Empfänger wählen.** Ein KiwiSDR-Client wählt eine nackte Adresse und einen Port; über den Proxy landet er immer beim Standardempfänger. Lassen Sie `[kiwi_emulation]` bei den anderen ausgeschaltet.
- **Cookies gelten pro Host, nicht pro Port.** Ein Besucher, der den zweiten Empfänger auf `:8899` benutzt hat, trägt `rx=vhf` auch zu `:8900`. Deshalb entscheidet eine Seite anhand von `siteReceiverId`, welcher Empfänger sie ist, nie anhand des Cookies.
- **Verzeichniseinträge.** Geben Sie jedem Empfänger in `[websdr]` einen eigenen Namen und setzen Sie bei einem Empfänger hinter dem Proxy `[websdr] public_port` auf den Port, den die Hörer benutzen, sonst wirbt der Eintrag mit dem internen.
- **Ein Frontend-Build zeigt kurz „Not Found".** `frontend/dist` wird an Ort und Stelle neu gebaut; einige Sekunden lang fehlt die Seite während eines Builds bei jedem Empfänger.
- **Nichts startet die Empfänger beim Hochfahren**, außer Sie richten es ein. Nach einem Neustart bringt `./start-all.sh` alle zurück.
