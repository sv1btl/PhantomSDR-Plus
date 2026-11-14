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
| **TCI-CAT auf der Empfängerseite** | Eine Schaltfläche auf der PhantomSDR-Plus-Seite selbst, in jedem Browser. Spricht TCI mit ExpertSDR, AetherSDR oder Thetis, oder über eine kleine Brücke mit jedem Hamlib-Funkgerät. Nur auf PhantomSDR-Plus-Empfängern mit Version 4.1.0 oder neuer. | Frequenz, Betriebsart und Filterbreite in beide Richtungen; Stummschaltung beim Senden |
| **Der Empfänger** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR oder UberSDR. Ein PhantomSDR-Plus-Empfänger braucht für Filterbreite und Stummschaltung **4.1.0** oder neuer. | Ein älterer PhantomSDR-Plus synchronisiert weiterhin Frequenz und Betriebsart |

Der größte Teil dieses Handbuchs beschreibt Desktop PhantomSDR+. Die Schaltfläche TCI-CAT hat einen eigenen Abschnitt, [TCI-CAT auf der Empfängerseite](#tci-cat-auf-der-empfängerseite). Das CATsync Tool hat seine eigene Dokumentation auf seiner Website.

---

## Unterstützte Empfänger

Die Anwendung erkennt, welche Art von Empfänger in einem Stationsfenster läuft, und steuert ihn über die eigenen Bedienelemente dieser Seite. Das Fenster Rig control zeigt die erkannte Art neben dem Namen der Station.

| Empfänger | Frequenz und Betriebsart | Filterbreite | Stumm beim Senden |
|---|---|---|---|
| PhantomSDR-Plus | Ja | Mit 4.1.0 oder neuer | Mit 4.1.0 oder neuer |
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

KiwiSDR-, WebSDR- und UberSDR-Empfänger haben die Filtersteuerung immer. Ein PhantomSDR-Plus-Empfänger braucht **4.1.0** oder neuer; bei einem älteren werden Frequenz und Betriebsart weiterhin synchronisiert, und das Fenster Rig control sagt, warum der Filter nicht folgt.

---

## Stummschaltung beim Senden

Setzen Sie das Häkchen bei **Mute receiver while transmitting**. Solange das Funkgerät getastet ist, ist das Empfängerfenster stumm; beim Loslassen kommt der Ton zurück. Die Stummschalttaste des Empfängers zeigt es an, und Sie können von Hand wieder einschalten.

Hatten Sie den Empfänger schon selbst stummgeschaltet, bleibt er auch danach stumm.

Es braucht eine Geräteverbindung, die den Sendezustand meldet — alle integrierten Treiber, flrig und Hamlib bei den meisten Geräten — und bei einem PhantomSDR-Plus-Empfänger 4.1.0 oder neuer.

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

## TCI-CAT auf der Empfängerseite

Eine PhantomSDR-Plus-Empfängerseite kann einem Transceiver auch **selbst** folgen, ohne Desktop-Anwendung: Der Browser spricht direkt mit einem **TCI**-Server auf Ihrem eigenen Computer. TCI ist das WebSocket-Steuerprotokoll von ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) und Thetis (Apache Labs ANAN, Hermes). Für ein Funkgerät ohne TCI lässt eine kleine, in PhantomSDR-Plus enthaltene Brücke jedes Hamlib-Funkgerät wie einen TCI-Server aussehen.

Voraussetzung ist ein PhantomSDR-Plus-Empfänger mit **4.1.0 oder neuer**. KiwiSDR-, WebSDR- und UberSDR-Seiten haben diese Funktion nicht.

### Die Schaltfläche TCI-CAT

Die Schaltfläche liegt in der Reihe mit **VFO**, **Modes**, **Bands** und **IF Filters** — **TCI-CAT** im breiten Layout, **CAT** im kompakten. Ihr Punkt ist **grün**, solange ein TCI-Server verbunden ist, sonst **grau**. Sie öffnet ein Fenster mit: Bis 4.2.0 hieß die Schaltfläche **QRG Sync**.

| Element | Funktion |
|---|---|
| Status | *Active — TCI (port 50001)* bei bestehender Verbindung; *Inactive* mit ⏳ *Wait*, solange gesucht wird |
| **CAT Sync** | Schaltet die Synchronisation von Frequenz, Betriebsart und Filter ein oder aus. Die Stummschaltung beim Senden wirkt in beiden Fällen |
| **Host** | Der Computer mit dem TCI-Server: `localhost` für diesen Computer, sonst seine Adresse im lokalen Netz, z. B. `192.168.1.42`. Mit Enter oder einem Klick daneben wird neu verbunden |

Mehr ist nicht zu wählen: Die Ports **50001** (ExpertSDR3, AetherSDR) und **40001** (ExpertSDR2, Thetis) werden gleichzeitig probiert und alle paar Sekunden wiederholt, sodass die Seite sich verbindet, sobald die Software läuft. **CAT Sync** und **Host** merkt sich der Browser.

Browser, die fragen, bevor eine Webseite das lokale Netz erreichen darf — aktuelle Versionen von Chrome und Edge tun das — fragen einmal, beim ersten Verbindungsversuch. Erlauben Sie es, sonst bleibt der Punkt grau.

### Was synchron gehalten wird

| | Verhalten |
|---|---|
| **Funkgerät → Empfänger: Frequenz** | Nur die Skala bewegt sich. Zoom, Helligkeit und Kontrast bleiben, wie Sie sie eingestellt haben; das Wasserfalldiagramm scrollt nur, wenn die Frequenz außerhalb des Bildes liegt, und der Bandplan ändert die Betriebsart nicht |
| **Funkgerät → Empfänger: Betriebsart** | Folgt, wenn sich die Betriebsart des Funkgeräts ändert — USB, LSB, CW, AM, FM; Datenbetriebsarten als USB oder LSB. Eine Betriebsart, die der Empfänger nicht hat, lässt ihn unverändert. Ein laufender Decoder behält seine eigene Betriebsart |
| **Funkgerät → Empfänger: Filterbreite** | Der Durchlassbereich des Empfängers übernimmt die Filterbreite des Funkgeräts: Das Verstellen des Filters oder die Taste **FIL** am Funkgerät ändert den Durchlassbereich. Ein laufender Decoder behält seinen eigenen Durchlassbereich |
| **Empfänger → Funkgerät: Frequenz** | Eine eingetippte Frequenz, ein Label oder Lesezeichen, ein Klick in den Wasserfall und das Ziehen des Durchlassbereichs bewegen den VFO des Funkgeräts. Beim Ziehen werden nur geänderte Frequenzen gesendet |
| **Empfänger → Funkgerät: Betriebsart** | Jede Änderung der Betriebsart auf der Seite — eine Betriebsart-Taste, der Bandplan, ein Decoder, ein Lesezeichen — stellt die Betriebsart des Funkgeräts ein (USB, LSB, CW, AM, FM; RADE als USB oder LSB). Ein Funkgerät in einer Datenbetriebsart (USB-D) bleibt darin |
| **Empfänger → Funkgerät: Filterbreite** | Die Tasten unter **IF Filters**, der IF-Schieberegler, das Ziehen des Durchlassbereichs und ein Betriebsartwechsel stellen den Filter des Funkgeräts ein; beim Ziehen wird nur die endgültige Breite gesendet. Bei Icom-Geräten wählt die Brücke stattdessen FIL1, FIL2 oder FIL3 — siehe [Icom-Filter](#icom-filter-fil1-fil2-fil3) |
| **Kein Echo** | Eine Änderung, die vom Funkgerät kam, wird nie an das Funkgerät zurückgesendet, und eine Meldung der vorherigen Betriebsart oder des vorherigen Filters, die kurz nach einer Änderung auf der Seite eintrifft, wird ignoriert |
| **Stummschaltung beim Senden** | Immer aktiv, auch mit CAT Sync aus: Die Seite verstummt, solange das Funkgerät sendet. Wird der Lautstärkeregler während des Sendens bewegt, bleibt sie stumm; beim Empfang kehrt der Ton mit der aktuellen Reglerstellung zurück |
| **Nicht unterstützt** | Split, VFO B, RIT/XIT und Transverter-Versatz. Nur VFO A des ersten Empfängers wird verfolgt |

### Mit welchen Transceivern es funktioniert

| Transceiver | Funktioniert | Wie |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Ja | Direkt — den TCI-Server in der Software aktivieren. Mit diesen Programmen noch nicht ausprobiert; getestet gegen einen simulierten TCI-Server |
| Ein Funkgerät mit CAT-Anschluss, das Hamlib unterstützt — die meisten von Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Ja | Über die Hamlib-Brücke unten. Ausprobiert mit einem **Icom IC-7300** unter Linux und Windows; andere Treiber können sich bei Betriebsartnamen oder der PTT-Meldung unterscheiden |
| Ein Funkgerät ohne CAT-Anschluss oder eines, das Hamlib nicht unterstützt | Nein | Es gibt nichts, woraus die Frequenz gelesen werden kann |

### Die Hamlib-Brücke (IC-7300 und andere Funkgeräte ohne TCI)

`tci-bridge/tci-rigctld.mjs` im PhantomSDR-Plus-Verzeichnis macht aus jedem Funkgerät, das Hamlib steuern kann, einen TCI-Server für die Seite. Sie läuft auf **Ihrem** Computer — dem, der mit dem Funkgerät verbunden ist, neben dem Browser — nicht auf dem Empfänger. Viermal pro Sekunde fragt sie Hamlib nach Frequenz, Betriebsart, Filterbreite und Sendezustand, schickt der Seite nur Änderungen und gibt die Frequenz-, Betriebsart- und Filteränderungen der Seite an das Funkgerät weiter.

Sie erreicht Hamlib auf einem von zwei Wegen:

| Weg | Kette | Wann |
|---|---|---|
| **`--rigctl`** (empfohlen) | Transceiver → `rigctl` → `tci-rigctld.mjs` → Seite | Im Normalfall. Die Brücke startet Hamlibs `rigctl` selbst: ein Fenster, kein Netzwerkport. **Unter Windows diesen Weg nehmen**, wo `rigctld.exe` oft mit *Access is denied* abgewiesen wird |
| **`rigctld`** | Transceiver → `rigctld` → `tci-rigctld.mjs` → Seite | Ein anderes Programm, etwa WSJT-X, soll das Funkgerät gleichzeitig benutzen — siehe [Das Funkgerät teilen](#das-funkgerät-teilen-der-rigctld-weg) |

**Was sie braucht**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils` oder das hamlib-Paket Ihrer Distribution | `hamlib-w64-….zip` von [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), entpackt nach `C:\hamlib` — `rigctl.exe` liegt in `C:\hamlib\bin` |
| Node.js | 18 oder neuer | Der LTS-*Windows Installer (.msi)* von [nodejs.org](https://nodejs.org), mit den Standardoptionen |
| Das Paket `ws` | Wird im PhantomSDR-Plus-Verzeichnis automatisch gefunden | `tci-rigctld.mjs` in einen Ordner wie `C:\tci-bridge` kopieren und dort einmal `npm install ws` ausführen |
| Der Port des Funkgeräts | `ls /dev/serial/by-id/`. Einmal der Gruppe `dialout` beitreten: `sudo usermod -aG dialout $USER`, dann ab- und wieder anmelden | Den USB-Treiber des Herstellers installieren; die COM-Nummer steht im **Geräte-Manager → Anschlüsse (COM & LPT)** |

Nur ein Programm kann den CAT-Anschluss des Funkgeräts belegen. Schließen Sie WSJT-X, flrig, JS8Call, RS-BA1 oder die Funkgeräteverbindung von Desktop PhantomSDR+, bevor Sie die Brücke starten.

#### Beispiel: Icom IC-7300

Am Funkgerät: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Hamlibs Modellnummer für den IC-7300 ist `3073`.

**Linux.** Das Funkgerät ist die Zeile mit `IC-7300` in `ls /dev/serial/by-id/`, meist auch `/dev/ttyUSB0`.

1. Prüfen, ob Hamlib das Funkgerät erreicht — es muss die Frequenz ausgeben, z. B. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Die Brücke starten und laufen lassen:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** Das Funkgerät erscheint im Geräte-Manager als *Silicon Labs CP210x USB to UART Bridge (COM4)* — verwenden Sie Ihre eigene COM-Nummer. In einer Eingabeaufforderung:

1. Prüfen, ob Hamlib das Funkgerät erreicht — es muss die Frequenz ausgeben:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Die Brücke starten und das Fenster offen lassen:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   Die Zeile ist lang: Achten Sie darauf, dass sie wirklich mit `-s 115200` endet, sonst beendet sich `rigctl` mit *Type: rigctl --help*.

Auf beiden Systemen meldet die Brücke innerhalb einer Sekunde:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Öffnen Sie dann die Empfängerseite in einem Browser auf demselben Computer, öffnen Sie **TCI-CAT** und schalten Sie **CAT Sync** ein. Der Punkt wird grün und die Brücke meldet `page connected`. Drehen Sie am VFO, und der Empfänger folgt; klicken Sie in den Wasserfall, und das Funkgerät folgt (`page -> rig ... Hz`); tasten Sie das Funkgerät, und die Seite verstummt. **Strg+C** beendet die Brücke und mit ihr `rigctl`.

Alles nach `--rigctl` ist das Programm `rigctl` mit seinen eigenen Optionen — genau denen, die bei der Prüfung funktioniert haben. Das ist die Regel für jedes Funkgerät: **Wenn `rigctl … f` die Frequenz ausgibt, funktioniert die Brücke mit denselben Optionen.**

#### Icom-Filter (FIL1, FIL2, FIL3)

Icom-Geräte wie der IC-7300 nehmen nicht einfach jede Filterbreite an: Sie haben drei Filter, **FIL1**, **FIL2** und **FIL3**, deren Breite jeweils im Menü des Funkgeräts eingestellt wird. Mit einer Breite würde Hamlib einen davon wählen und zugleich seine Breite überschreiben — und beim IC-7300 kann diese Breite auf dem zuvor gewählten Filter landen, was die Einstellungen des Funkgeräts durcheinanderbringt. Bei Icom-Geräten sendet die Brücke daher nie eine Breite: Sie nimmt den Filter, dessen Referenzbreite dem Durchlassbereich der Seite am nächsten liegt, und **wählt** ihn nur aus, mit dem eigenen CI-V-Befehl des Funkgeräts. Die am Funkgerät eingestellten Breiten werden nie verändert.

| Betriebsart | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (und ihre Datenbetriebsarten) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

Beim IC-7300 (`-m 3073`) geschieht das automatisch. Stellen Sie die SSB-Filter des Funkgeräts passend ein — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (**FIL** am Funkgerät gedrückt halten) —, dann wählt 2,7 / 2,4 / 1,8 kHz unter **IF Filters** FIL1 / FIL2 / FIL3, und die Taste **FIL** am Funkgerät setzt den Durchlassbereich der Seite auf die Breite dieses Filters. Die Brücke meldet zum Beispiel `page -> rig filter 2398 Hz  LSB  → FIL2  sent`.

| Option | Zweck |
|---|---|
| `--filters 3000,2400,1800` | Andere SSB-Referenzbreiten, in der Reihenfolge FIL1,FIL2,FIL3; schaltet die Filterauswahl auch für ein anderes Icom-Gerät ein |
| `--civ A4` | Die CI-V-Adresse des Funkgeräts in Hex, wenn sie nicht `94` ist (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Breiten stattdessen über Hamlib senden, wie bei anderen Herstellern |

Beide Optionen stehen vor `--rigctl`, z. B. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Nur mit einem IC-7300 ausprobiert. Andere Hersteller — Yaesu, Kenwood, Elecraft und die übrigen — erhalten die Breite der Seite über Hamlib, das sie so genau einstellt, wie das Funkgerät es erlaubt.

#### Andere Funkgeräte

Dieselben Schritte gelten für jedes Funkgerät, das Hamlib unterstützt; nur die Optionen ändern sich.

1. **Das Funkgerät vorbereiten.** Im Menü die CAT- (oder CI-V-)Geschwindigkeit notieren und eine Einstellung wie *CAT über USB* oder *CI-V Transceive* einschalten, falls vorhanden. Unter Windows den USB-Treiber des Herstellers installieren.
2. **Die Hamlib-Modellnummer finden** in der Liste, die `rigctl -l` ausgibt:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Den Port finden.** Linux: `ls /dev/serial/by-id/`. Windows: Geräte-Manager. Manche Funkgeräte legen **zwei** Ports an — Yaesus FT-991A, FTDX10 und FT-710 nennen sie *Enhanced* und *Standard*; CAT liegt auf dem **Enhanced**-Port.
4. **Prüfen, dann die Brücke starten** mit `-m <Modell> -r <Port> -s <Geschwindigkeit>`, wie im IC-7300-Beispiel: zuerst `rigctl -m … -r … -s … f`, dann dieselben Optionen nach `--rigctl`.

Einige Modellnummern aus Hamlib 4.5 — prüfen Sie sie mit `rigctl -l`, da eine andere Hamlib-Version ein Gerät anders nummerieren kann:

| Funkgerät | `-m` | Funkgerät | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Zusätzliche Optionen, nur wenn nötig:

- **Ein Icom-Gerät mit geänderter CI-V-Adresse:** `-c` mit der Adresse *dezimal* hinzufügen — `94h` ist `-c 148`.
- **Eine Einstellung, die Hamlib für dieses Gerät anbietet:** `rigctl -m <Modell> -L` listet sie auf; eine setzen mit `-C name=wert`, z. B. `-C post_write_delay=10` für eine langsame Schnittstelle.
- **Ein Funkgerät, das beim Öffnen des Ports sendet oder neu startet:** Manche CAT-Kabel nutzen DTR oder RTS für PTT; `-C dtr_state=OFF -C rts_state=OFF` hinzufügen.

#### Funkgeräte, die andere Software steuert

Manche Funkgeräte werden bereits von einem Programm gesteuert, das die Aufgabe übernehmen kann — manchmal ganz ohne Brücke. Keiner dieser Wege wurde ausprobiert.

| Funkgerät und Programm | Was tun |
|---|---|
| **SunSDR** mit ExpertSDR2/3, **FlexRadio** mit AetherSDR, **Apache Labs ANAN / Hermes** mit Thetis | Keine Brücke. Den **TCI-Server** des Programms einschalten und **TCI-CAT** direkt verwenden — die Ports 50001 und 40001 werden automatisch gefunden |
| **FlexRadio** mit SmartSDR (Windows) | In **SmartSDR CAT** einen Port anlegen. Er spricht Kenwood-CAT, daher funktioniert ein serieller Port dort als TS-2000: `-m 2014 -r COM8 -s 57600`. Ein TCP-Port funktioniert mit Hamlibs FlexRadio-Modell: `-m 2036 -r 127.0.0.1:<Port>` |
| **Jedes von flrig gesteuerte Funkgerät** | flrig laufen lassen und Hamlibs flrig-Modell verwenden; das Funkgerät bleibt mit fldigi, WSJT-X und Logbüchern geteilt: `-m 4 -r 127.0.0.1:12345` |
| **Ein laufender rigctld** oder ein Programm mit einem *Hamlib NET rigctl*-Server | Die Brücke ohne `--rigctl` mit dieser Adresse starten: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Wie überall stehen die Optionen bei der Prüfung nach `rigctl` und bei der Brücke nach `--rigctl rigctl`. Eine Netzwerkadresse wie `127.0.0.1:12345` braucht kein `-s`.

#### Das Funkgerät teilen: der rigctld-Weg

Wenn WSJT-X oder ein Logbuch das Funkgerät benutzen soll, während die Brücke läuft, starten Sie Hamlibs Server `rigctld` mit denselben Optionen, lassen ihn laufen und verbinden beide Programme damit:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Ohne `--rigctl` sucht die Brücke `rigctld` unter `127.0.0.1:4532` und meldet `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` nutzt einen `rigctld` auf einem anderen Computer. In WSJT-X das Rig *Hamlib NET rigctl* unter derselben Adresse wählen. Unter Windows ist der Server `C:\hamlib\bin\rigctld.exe` mit denselben Optionen; antwortet Windows mit *Access is denied*, nehmen Sie `--rigctl` und schließen das andere Programm, solange die Brücke läuft.

**Ports.** Die Brücke stellt TCI auf Port 50001 bereit; ein anderer Port steht als Erstes in der Befehlszeile, z. B. `node tci-rigctld.mjs 40001 --rigctl …`. Laufen Brücke und Browser auf verschiedenen Computern, tragen Sie die Adresse des Brücken-Computers unter **Host** ein.

### Fehlerbehebung bei TCI-CAT

| Symptom | Wahrscheinliche Ursache | Was tun |
|---|---|---|
| Punkt bleibt grau | TCI-Server oder Brücke läuft nicht; falscher **Host**; die Erlaubnis des Browsers für das lokale Netz wurde verweigert | TCI in ExpertSDR/Thetis/AetherSDR aktivieren oder die Brücke starten; **Host** prüfen; lokalen Netzzugriff in den Website-Einstellungen erlauben |
| `rigctl … f` meldet einen Fehler oder wartet | Falscher Port oder falsche Geschwindigkeit; keine `dialout`-Berechtigung (Linux) oder kein USB-Treiber (Windows); ein anderes Programm belegt den Port | `-s` an das Menü des Funkgeräts anpassen; Port prüfen (`ls /dev/serial/by-id/`, Geräte-Manager); andere Funkgeräteprogramme schließen |
| Brücke meldet *rigctl stopped … Type: rigctl --help* | Der Befehl ist unvollständig — meist fehlt die Geschwindigkeit nach `-s` | Die ganze Zeile neu eingeben |
| Brücke meldet *The value after -s is missing* | Die Befehlszeile wurde beim Einfügen abgeschnitten | Das Ende der Zeile neu eingeben, z. B. `-s 115200` |
| Der Filter folgt in einer Richtung nicht | **CAT Sync** ist aus, auf der Seite läuft ein Decoder, oder (IC-7300) die FIL-Breiten des Funkgeräts weichen von 2700 / 2400 / 1800 Hz ab | CAT Sync einschalten; den Decoder beenden; die FIL-Breiten am Funkgerät einstellen oder `--filters` mit den Breiten des Funkgeräts angeben |
| Brücke meldet *rigctl stopped … rig_open: error* | `rigctl` kann den Port nicht öffnen | Wie bei `rigctl … f` oben |
| Brücke meldet *the rig is not answering* | Der Port öffnet sich, aber das Funkgerät antwortet nicht: falsche Geschwindigkeit oder falsches Modell, CAT im Menü ausgeschaltet oder geänderte Icom-CI-V-Adresse | Die Prüfung `rigctl … f` wiederholen; bei geänderter CI-V-Adresse `-c` hinzufügen |
| Brücke meldet *rigctld not reachable* | Ohne `--rigctl` gestartet, und kein `rigctld` läuft | `--rigctl …` hinzufügen oder zuerst `rigctld` starten |
| `rigctld.exe` meldet *Access is denied* (Windows) | Windows verweigert die Ausführung | `--rigctl` verwenden — dafür genügt `rigctl.exe` |
| Verbunden, aber der Empfänger bewegt sich nicht | **CAT Sync** ist aus | Einschalten — die Stummschaltung beim Senden wirkt auch ohne |
| Betriebsart des Funkgeräts folgt nicht | Eine Betriebsart ohne Entsprechung im Empfänger, oder der Hamlib-Treiber meldet einen ungewöhnlichen Namen | Die Frequenz wird trotzdem synchronisiert; Betriebsart auf der Seite einstellen |
| Keine Stummschaltung beim Senden | Das Funkgerät oder sein Hamlib-Treiber meldet den Sendezustand nicht | Auf der Seite ist nichts einzustellen |
| Die Skala springt hin und her | Desktop PhantomSDR+ oder ein anderes Programm synchronisiert das Funkgerät ebenfalls | Immer nur eine Steuerung verwenden |

---

## Für Empfängerbetreiber

Nichts einzustellen. Die Transceiver-Steuerung nutzt eine kleine JavaScript-Schnittstelle, die jede PhantomSDR-Plus-Seite bereits enthält; sie braucht keine Servereinstellung, keinen offenen Port und keine Admin-Berechtigung. Die Filter- und Stummschaltfunktionen kamen mit Version 4.1.0 — danach das Frontend neu bauen (`./recompile.sh`, Option 2); der Empfänger muss nicht angehalten werden. Auch KiwiSDR-, WebSDR- und UberSDR-Empfänger brauchen nichts: Die Anwendung nutzt die Bedienelemente, die ihre Seiten schon haben.

Die Schaltfläche **TCI-CAT** kam ebenfalls mit 4.1.0, wieder nur ein Neubau des Frontends. Sie öffnet keinen Port auf dem Empfänger: Die Verbindung läuft vom Browser jedes Hörers zu seinem eigenen Computer. Die Hamlib-Brücke `tci-bridge/tci-rigctld.mjs` ist für Hörer zu Hause gedacht; der Empfänger benutzt sie nicht. Der Browser baut diese Verbindung erst auf, nachdem der Hörer **TCI-CAT** geöffnet oder **CAT Sync** eingeschaltet hat (pro Browser gespeichert); über https sehen Besucher, die es nie nutzen, daher keine Abfrage zum lokalen Netzwerk.

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
| Filter folgt nicht | Empfänger älter als 4.1.0, oder integrierter Kenwood-/Yaesu-Treiber | Frequenz und Betriebsart synchronisieren weiter; für den Filter bei Kenwood/Yaesu Hamlib nutzen |
| Stummschaltung beim Senden wirkt nicht | Empfänger ohne Update, oder das Gerät meldet den Sendezustand nicht | Wie oben |
| *Lost the rig ... reconnecting* | Kabel gezogen, Gerät ausgeschaltet oder rigctld beendet | Nichts — alle 3 Sekunden neuer Versuch, danach geht es weiter |
| Beide Seiten springen ständig | Zwei Programme steuern das Gerät gleichzeitig | Nur ein Programm das Gerät einstellen lassen oder über flrig teilen |

---

## Bekannte Einschränkungen

- Ein Funkgerät, ein Empfängerfenster zur selben Zeit.
- Andere Empfänger als PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR und UberSDR — etwa OpenWebRX — werden nicht unterstützt.
- Die integrierten Treiber folgen den veröffentlichten Protokollen der Hersteller und wurden gegen simulierte Geräte und echtes Hamlib getestet; für ein Gerät, das sich anders verhält, ist Hamlib die Ausweichlösung.
- Split-Betrieb, VFO B, RIT/XIT und Speicherkanäle werden nicht synchronisiert — nur die Frequenz des aktiven VFO.
- TCI-CAT auf der Empfängerseite synchronisiert weder Split noch VFO B, RIT/XIT oder Transverter-Versatz und wurde nur mit einem IC-7300 über die Hamlib-Brücke ausprobiert.
- Unter Linux verwenden die Pakete das Hamlib der Distribution; keines ist mitgeliefert.
