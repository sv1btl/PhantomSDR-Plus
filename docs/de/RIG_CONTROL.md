# PhantomSDR-Plus — Transceiver-Steuerung (CAT)

Halten Sie **Ihren eigenen Transceiver** und einen **PhantomSDR-Plus-Empfänger** auf derselben Frequenz, Betriebsart und Filterbreite. Drehen Sie am Abstimmknopf des Funkgeräts, folgt der Wasserfall; klicken Sie auf ein Signal im Wasserfall, stimmt das Funkgerät darauf ab. Tasten Sie das Funkgerät, kann der Empfänger verstummen, damit er Ihnen nicht Ihr eigenes Signal zurückspielt.

Es funktioniert mit Empfängern **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR und UberSDR**, Ihren eigenen oder fremden, und bewegt immer nur *Ihre* Hörsitzung — niemand sonst am Empfänger hört oder sieht etwas davon. Der Betreiber des Empfängers muss nichts installieren oder einstellen.

---

## Was Sie brauchen

Zwei Wege, ein Funkgerät anzubinden, und eine Voraussetzung beim Empfänger:

| Baustein | Was es ist | Synchronisiert |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) ab 4.0** | Die Desktop-Anwendung mit einem Menü **Rig**. Linux (PC und Raspberry Pi) und Windows. | Frequenz, Betriebsart, Filterbreite, Stummschaltung beim Senden — in eine Richtung oder in beide |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Ein eigenständiges Windows-Programm, das ein Funkgerät an die Empfängerseite im Browser koppelt. | Frequenz und Betriebsart |
| **Der Empfänger** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR oder UberSDR. Ein PhantomSDR-Plus-Empfänger braucht für Filterbreite und Stummschaltung 4.0 mit dem **Update vom September 2026** oder neuer. | Ein älterer PhantomSDR-Plus synchronisiert weiterhin Frequenz und Betriebsart |

Der Rest dieses Handbuchs beschreibt Desktop PhantomSDR+. Das CATsync Tool hat seine eigene Dokumentation auf seiner Website.

---

## Unterstützte Empfänger

Die Anwendung erkennt, welche Art von Empfänger in einem Stationsfenster läuft, und steuert ihn über die eigenen Bedienelemente dieser Seite. Das Fenster Rig control zeigt die erkannte Art neben dem Namen der Station.

| Empfänger | Frequenz und Betriebsart | Filterbreite | Stumm beim Senden |
|---|---|---|---|
| PhantomSDR-Plus | Ja | Mit dem Update vom September 2026 oder neuer | Mit dem Update vom September 2026 oder neuer |
| KiwiSDR (auch Web-888) | Ja | Ja | Ja |
| PA3FWM WebSDR | Ja, mit Bandwechsel auf Mehrband-Sites | Ja | Ja |
| UberSDR | Ja | Ja | Ja |

Ein Web-Empfänger hat weniger Betriebsarten als die meisten Funkgeräte, daher teilen sich manche Betriebsarten des Geräts eine des Empfängers: KiwiSDR und WebSDR haben ein einziges CW für CW und CW-R. Die in diesem Handbuch genannten Empfänger-Betriebsarten sind die von PhantomSDR-Plus; die anderen Empfänger verwenden die jeweils nächstliegende. Ein WebSDR hält einen CW-Filter unter 1 kHz und andere Filter bei 1 kHz oder breiter, weil die Seite selbst CW daran erkennt, und eine Frequenz außerhalb aller Bänder einer WebSDR-Site wird nicht angefahren. UberSDR stellt seinen Filter in Schieberegler-Schritten ein, sodass eine Breite bis zu etwa 50 Hz von der des Geräts abweichen kann. Jede andere Art von Seite — etwa OpenWebRX — zeigt *not a receiver this app can drive*, und nichts wird synchronisiert.

---

## Was es tut und was nicht

- Es synchronisiert **ein Funkgerät mit einem Empfängerfenster** zur selben Zeit.
- Es liest beide Seiten mehrmals pro Sekunde und stellt, wenn sie voneinander abweichen, die eine auf die andere ein. Es sendet **nicht**, tastet das Funkgerät nicht und schickt keinen Ton irgendwohin.
- Das Verstellen des Empfängers ändert nur Ihre eigene Sitzung. Andere Hörer am selben Empfänger merken nichts, und der Betreiber muss es nicht erlauben.
- Eine serielle Schnittstelle kann jeweils nur **ein Programm** öffnen. Hat WSJT-X, ein Logbuch oder ein Hersteller-Tool die Schnittstelle schon belegt, teilen Sie das Funkgerät über **flrig** oder **rigctld im Netzwerk**, statt um die Schnittstelle zu streiten.

---

## Schnellstart

1. Öffnen Sie wie gewohnt eine Station in Desktop PhantomSDR+.
2. **Rig → Rig control...**
3. Wählen Sie unter **Connection** **Built-in**, wenn Ihr Funkgerät in der Liste steht, sonst **Hamlib (all rigs)**.
4. Wählen Sie Ihr Funkgerät, die serielle Schnittstelle und die Geschwindigkeit, auf die das CAT- oder CI-V-Menü des Funkgeräts eingestellt ist.
5. Lassen Sie unter **Sync** **Both directions** ausgewählt.
6. Drücken Sie **Connect**. Die beiden Anzeigen oben — Transceiver und Empfänger — sollten innerhalb einer Sekunde dieselbe Frequenz zeigen.

Jede Einstellung wird gespeichert, sobald Sie sie ändern. Beim nächsten Mal genügt **Rig → Connect**, oder setzen Sie das Häkchen bei **Connect when the app starts**.

---

## Den Verbindungsweg wählen

| Auswahl | Verwenden, wenn | Benötigt |
|---|---|---|
| **Built-in** | Ihr Funkgerät in der Liste unten steht. | Sonst nichts |
| **Hamlib (all rigs)** | Ihr Funkgerät etwas anderes ist — Hamlib kennt mehr als 300 Geräte. Die Anwendung startet Hamlibs `rigctld` für Sie auf einem privaten lokalen Port und beendet ihn beim Trennen. | Windows: nichts, Hamlib ist enthalten. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Bereits ein `rigctld` läuft, auf diesem oder einem anderen Rechner im Netzwerk. | Host und Port (Standard 4532) |
| **flrig** | flrig das Funkgerät bereits für fldigi, WSJT-X oder ein Logbuch steuert. | Laufendes flrig mit seinem XML-RPC-Port (Standard 12345) |

### Funkgeräte mit integriertem Treiber

Geschwindigkeit und CI-V-Adresse sind die Werkseinstellungen, die die Anwendung vorbelegt. **Sie sind nur ein Ausgangspunkt — stellen Sie ein, was im Menü Ihres Funkgeräts steht.**

| Familie | Geräte | Standardgeschwindigkeit | Hinweise |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 und jedes andere CI-V-Gerät | 19200 | CI-V-Adresse je Modell vorbelegt (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresse `70`; im Gerätemenü prüfen |
| **Yaesu neues CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu klassisches CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 Stoppbits; stimmt in 10-Hz-Schritten ab |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Filterbreite wird synchronisiert |
| **Kenwood-kompatibel** | FlexRadio SmartSDR CAT (virtueller Port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, andere Kenwood-kompatible Geräte | 9600–38400 | |

Ein Gerät, das kompatibel sein müsste, aber mit einem integrierten Treiber nicht spricht, funktioniert meist mit **Hamlib**, das mit weit mehr Varianten zurechtkommt.

---

## Serielle Einstellungen

| Einstellung | Was dort hineingehört |
|---|---|
| **Serial port** | Die Schnittstelle des Funkgeräts. USB-Adapter und Geräte mit USB-Anschluss stehen oben. **Other / network address...** nimmt eine Schnittstelle an, die nicht in der Liste steht — `COM7`, `/dev/ttyUSB1` — oder `tcp://host:port` für eine serielle Schnittstelle, die per ser2net o. Ä. über das Netzwerk bereitgestellt wird. |
| **Speed (baud)** | Genau das, was im CAT-/CI-V-Baudraten-Menü des Funkgeräts steht. Eine falsche Rate sieht aus wie ein Gerät, das nie antwortet. |
| **Stop bits** | 1 für fast alles; 2 für die Familie FT-817/857/897. |
| **CI-V address** | Nur Icom, hexadezimal (`94`, nicht `148`). Muss zum CI-V-Adressmenü des Geräts passen. |
| **DTR / RTS** | **Aus** lassen, sofern Ihr Interface sie nicht braucht. Viele CAT-Kabel tasten auf einer dieser Leitungen den Sender oder setzen das Gerät zurück. |
| **Hardware flow control** | Aus lassen, außer das Handbuch verlangt RTS/CTS. |

Bei **Hamlib** werden dieselben Einstellungen an `rigctld` weitergegeben. Stoppbits haben dort zusätzlich *Rig default*, und **Extra rigctld options** nimmt alles, was `rigctld` sonst versteht, z. B. `--set-conf=post_write_delay=10`. Mit **rigctld program** zeigen Sie auf einen bestimmten `rigctld`, wenn mehrere installiert sind.

---

## Synchronisierung

### Richtung

| Auswahl | Was geschieht |
|---|---|
| **Rig → receiver** | Das Empfängerfenster folgt dem Funkgerät. Eine Änderung im Wasserfall wird auf die Frequenz des Funkgeräts zurückgesetzt. |
| **Receiver → rig** | Das Funkgerät folgt dem Empfängerfenster. Drehen am Abstimmknopf wird rückgängig gemacht. |
| **Both directions** | Die Seite, die Sie **zuletzt** berührt haben, gewinnt. Beim Verbinden, bevor eine Seite berührt wurde, gewinnt das Funkgerät. |

Die Richtung lässt sich während der Verbindung auch im Menü **Rig** ändern.

### Wie verhindert wird, dass sich beide Seiten bekämpfen

Jeder Wert, den die Anwendung schreibt, erscheint kurz darauf als Änderung auf der anderen Seite. Würde man das wörtlich nehmen, würden sich Funkgerät und Empfänger endlos gegenseitig jagen. Die Anwendung verhindert das auf drei Arten:

- Die Empfängerseite übernimmt eine Änderung sofort; sie wird direkt nach dem Schreiben zurückgelesen, und dieser Wert wird der neue Ausgangspunkt.
- Ein Funkgerät übernimmt eine Änderung etwas später; deshalb merkt sich die Anwendung jeden gesendeten Wert. Meldet das Gerät diesen Wert, wird er als eigener Schreibvorgang erkannt und nicht als Hand am Knopf.
- Ein Wert, den das Gerät ablehnt — etwa Breitband-FM auf einem KW-Gerät —, wird **zweimal** gesendet und dann in Ruhe gelassen, bis sich die Quellseite ändert, statt mehrmals pro Sekunde wiederholt zu werden.

Das Umstimmen der Empfängerseite kann dazu führen, dass sie die Standard-Betriebsart des Bandes wählt (unter 10 MHz etwa LSB). Führt das Funkgerät, setzt die Anwendung sofort wieder dessen Betriebsart, sodass ein Gerät in USB auf 40 m den Empfänger in USB hält.

### Welches Empfängerfenster

**Receiver window** bestimmt, welche Station dem Funkgerät folgt:

- **The station window last in front** (Standard) — mit zwei offenen Stationen klicken Sie in eine hinein, und das Funkgerät folgt dieser.
- **Eine bestimmte Station** — das Funkgerät bleibt an ihr, ob sie vorne ist oder nicht. Ist diese Station nicht geöffnet, wird nichts synchronisiert, bis sie es ist.

### Aktualisierungsrate

**Update every** legt fest, wie oft beide Seiten gelesen werden: 150 ms, 300 ms (Standard), 500 ms oder 1 s. Schneller fühlt sich am Knopf unmittelbarer an; langsamer schont ein altes Gerät mit 4800 oder 9600 Baud, bei dem jede Abfrage echte Zeit auf der Leitung kostet.

---

## Betriebsarten

| Betriebsart am Funkgerät | Empfänger hört in |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (umgekehrt) | CW-L |
| AM, Synchron-AM, DSB | AM |
| FM, Schmal-FM | FM |
| Breitband-FM | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Datenbetriebsarten (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Daten-LSB, Daten-FM | LSB, FM |

| Betriebsart am Empfänger | Funkgerät wird gesetzt auf |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — die meisten KW-Geräte lehnen es ab und werden nach zwei Versuchen in Ruhe gelassen |
| RADE (oberes / unteres) | USB / LSB |

Ein Gerät in einer **Datenbetriebsart** bleibt darin: USB am Empfänger gilt als übereinstimmend mit USB-D am Gerät, sodass der Empfänger das Gerät nie aus dem Datenbetrieb wirft.

---

## Filterbreite

Setzen Sie das Häkchen bei **Sync filter width**, damit die Durchlassbereiche übereinstimmen. Unterschiede unter 60 Hz gelten als gleich, da keine zwei Filter gleich gestuft sind.

| Verbindung zum Gerät | Filterbreite |
|---|---|
| Hamlib | Ja, soweit Hamlib es für dieses Gerät unterstützt |
| flrig | Ja |
| Integriert Icom CI-V | Ja — 50-Hz-Schritte bis 500 Hz, dann 100-Hz-Schritte bis 3,6 kHz; AM in 200-Hz-Schritten bis 10 kHz; nicht in FM |
| Integriert Elecraft | Ja, in 10-Hz-Schritten |
| Integriert Kenwood, Yaesu, FT-817-Familie | Nein — diese Geräte wählen Filter aus modellspezifischen Tabellen. Für den Filter Hamlib verwenden |

KiwiSDR-, WebSDR- und UberSDR-Empfänger haben die Filtersteuerung immer. Ein PhantomSDR-Plus-Empfänger braucht das **Update vom September 2026** oder neuer; bei einem älteren werden Frequenz und Betriebsart weiterhin synchronisiert, und das Fenster Rig control sagt, warum der Filter nicht folgt.

---

## Stummschaltung beim Senden

Setzen Sie das Häkchen bei **Mute receiver while transmitting**. Solange das Funkgerät getastet ist, ist das Empfängerfenster stumm; beim Loslassen kommt der Ton zurück. Die Stummschalttaste des Empfängers zeigt es an, und Sie können von Hand wieder einschalten.

Hatten Sie den Empfänger schon selbst stummgeschaltet, bleibt er auch danach stumm.

Es braucht eine Geräteverbindung, die den Sendezustand meldet — alle integrierten Treiber, flrig und Hamlib bei den meisten Geräten — und bei einem PhantomSDR-Plus-Empfänger das Update vom September 2026.

---

## Frequenzversatz

**Frequency offset** wird zur Frequenz des Funkgeräts addiert, um die des Empfängers zu erhalten:

> Empfängerfrequenz = Gerätefrequenz + Versatz

| Aufbau | Versatz |
|---|---|
| 2-m-Transverter an einem 10-m-Gerät (144,100 MHz erscheint als 28,100 MHz) | `116000000` |
| 70-cm-Transverter an einem 2-m-Gerät (432 → 144) | `288000000` |
| Kein Transverter | `0` |

---

## Das Menü Rig

| Eintrag | Wirkung |
|---|---|
| **Rig control...** | Öffnet das Fenster Rig control |
| **Connect / Disconnect** *Gerätename* | Startet oder beendet die Synchronisierung; bei Hamlib auch `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Richtung der Synchronisierung |
| **Sync filter width** | Ein / aus |
| **Mute receiver while transmitting** | Ein / aus |
| Statuszeile | *Not connected*, *Connecting...*, *Connected: Gerätename* oder der letzte Fehler |

Die laufende Frequenzanzeige steht im Fenster Rig control und nicht im Menü, das sich sonst bei jeder Änderung selbst schließen würde.

---

## Linux

**Rechte für die serielle Schnittstelle.** Serielle Schnittstellen gehören der Gruppe `dialout`. Ein Benutzer außerhalb davon erhält *Could not open ttyUSB0*. Fügen Sie sich einmal hinzu und melden Sie sich dann ab und wieder an:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Aus der Distribution installieren:

```bash
sudo apt install libhamlib-utils
```

Das `.deb`-Paket von Desktop PhantomSDR+ empfiehlt es, daher bringt `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` es mit; `dpkg -i` installiert empfohlene Pakete nicht. Die integrierten Treiber und flrig brauchen kein Hamlib.

## Windows

Hamlibs eigenes `rigctld.exe` ist im 64-Bit- und im 32-Bit-Installer enthalten. COM-Schnittstellen erscheinen in der Liste mit ihrem Namen (`COM3`). Braucht das Gerät einen USB-Treiber, installieren Sie zuerst den des Herstellers — vorher existiert die Schnittstelle nicht.

---

## Für Empfängerbetreiber

Nichts einzustellen. Die Transceiver-Steuerung nutzt eine kleine JavaScript-Schnittstelle, die jede PhantomSDR-Plus-Seite bereits enthält; sie braucht keine Servereinstellung, keinen offenen Port und keine Admin-Berechtigung. Die Filter- und Stummschaltfunktionen kamen mit dem Update vom September 2026 zu 4.0.0 — danach das Frontend neu bauen (`./recompile.sh`, Option 2); der Empfänger muss nicht angehalten werden. Auch KiwiSDR-, WebSDR- und UberSDR-Empfänger brauchen nichts: Die Anwendung nutzt die Bedienelemente, die ihre Seiten schon haben.

---

## Für Entwickler: die Seitenschnittstelle

Desktop PhantomSDR+ und das CATsync Tool nutzen beide diese Funktionen, die jede PhantomSDR-Plus-Seite nach dem Laden auf `window` bereitstellt (KiwiSDR-, WebSDR- und UberSDR-Seiten werden über ihre eigenen, anderen Bedienelemente gesteuert):

| Funktion | Rückgabe / Wirkung |
|---|---|
| `catsync_ready` | `true`, sobald die Funktionen unten installiert sind |
| `catsync_getFrequency()` | Abgestimmte Frequenz, Hz |
| `catsync_setFrequency(hz)` | Auf `hz` abstimmen |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Betriebsart setzen; setzt den Durchlassbereich auf den Standard der Betriebsart zurück |
| `catsync_getBandwidth()` | Gesamte Durchlassbreite, Hz |
| `catsync_setBandwidth(hz)` | Breite setzen — wächst in USB nach oben, in LSB nach unten, sonst gleichmäßig. **Nach** `catsync_setMode` aufrufen |
| `catsync_getMute()` | `true`, wenn stummgeschaltet |
| `catsync_setMute(on)` | Stumm schalten oder aufheben, über die Stummschalttaste der Seite |

Die letzten vier kamen mit dem Update vom September 2026, daher vor dem Aufruf prüfen:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Das Setzen der Frequenz stimmt den Ton neu ab; rufen Sie einen Setter also nur auf, wenn sich der Wert tatsächlich geändert hat — ein Setter, der ständig mit demselben Wert aufgerufen wird, ist hörbar. Die älteren Einstiegspunkte im KiwiSDR/WebSDR-Stil (`setfreq`, `set_mode`, `freqset_complete`) sind für Werkzeuge, die sie erwarten, weiterhin vorhanden.

---

## Fehlerbehebung

| Symptom | Wahrscheinliche Ursache | Was tun |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Nicht in der Gruppe `dialout`, oder ein anderes Programm hat die Schnittstelle | `sudo usermod -aG dialout $USER`, ab- und anmelden; WSJT-X, Logbücher, Geräte-Tools schließen |
| Die Empfängeranzeige sagt *not a receiver this app can drive* | Eine andere Art von Web-Empfänger, oder die Seite lädt noch | Unterstützt werden PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR und UberSDR; einer langsamen Seite ein paar Sekunden geben |
| *The rig did not answer* | Falsche Geschwindigkeit, falscher Gerätetyp, falsche CI-V-Adresse, Gerät aus | Geschwindigkeit an das Gerätemenü anpassen; CI-V-Adresse prüfen; Hamlib versuchen |
| *Hamlib is not installed* | Kein `rigctld` gefunden | Linux: `sudo apt install libhamlib-utils`. Oder **rigctld program** auf seinen Pfad setzen |
| *rigctld stopped: ...* | Hamlib konnte das Gerät nicht öffnen — seine eigene Meldung folgt | Meist Schnittstelle oder Geschwindigkeit; der Text nach dem Doppelpunkt ist Hamlibs Begründung |
| *flrig is not running at ...* | flrig geschlossen, oder sein XML-RPC-Port weicht ab | flrig starten; den Port in der flrig-Konfiguration prüfen |
| Verbunden, aber der Empfänger bewegt sich nicht | Kein Stationsfenster offen, oder **Receiver window** auf eine geschlossene Station festgelegt | Station öffnen oder *The station window last in front* wählen |
| Das Gerät sendet beim Verbinden | DTR oder RTS tastet das Gerät über Ihr Interface | Häkchen bei **DTR on** und **RTS on** entfernen |
| Filter folgt nicht | Empfänger ohne Update vom September 2026, oder integrierter Kenwood-/Yaesu-Treiber | Frequenz und Betriebsart synchronisieren weiter; für den Filter bei Kenwood/Yaesu Hamlib nutzen |
| Stummschaltung beim Senden wirkt nicht | Empfänger ohne Update, oder das Gerät meldet den Sendezustand nicht | Wie oben |
| *Lost the rig ... reconnecting* | Kabel gezogen, Gerät ausgeschaltet oder rigctld beendet | Nichts — alle 3 Sekunden neuer Versuch, danach geht es weiter |
| Beide Seiten springen ständig | Zwei Programme steuern das Gerät gleichzeitig | Nur ein Programm das Gerät einstellen lassen oder über flrig teilen |

---

## Bekannte Einschränkungen

- Ein Funkgerät, ein Empfängerfenster zur selben Zeit.
- Andere Empfänger als PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR und UberSDR — etwa OpenWebRX — werden nicht unterstützt.
- Die integrierten Treiber folgen den veröffentlichten Protokollen der Hersteller und wurden gegen simulierte Geräte und echtes Hamlib getestet; für ein Gerät, das sich anders verhält, ist Hamlib die Ausweichlösung.
- Split-Betrieb, VFO B, RIT/XIT und Speicherkanäle werden nicht synchronisiert — nur die Frequenz des aktiven VFO.
- Unter Linux verwenden die Pakete das Hamlib der Distribution; keines ist mitgeliefert.
