# PhantomSDR-Plus Benutzerhandbuch

Willkommen bei PhantomSDR-Plus! Dieses Handbuch hilft Ihnen, das Beste aus Ihrem WebSDR-Hörerlebnis herauszuholen.

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Erste Schritte](#erste-schritte)
3. [Überblick über die Oberfläche](#überblick-über-die-oberfläche)
4. [Grundlegende Bedienung](#grundlegende-bedienung)
5. [Erweiterte Funktionen](#erweiterte-funktionen)
6. [Demodulationsarten](#demodulationsarten)
7. [Digitale Decoder](#digitale-decoder)
8. [Tastenkürzel](#tastenkürzel)
9. [Lesezeichen](#lesezeichen)
10. [Nutzung auf Mobilgeräten](#nutzung-auf-mobilgeräten)
11. [Tipps und bewährte Praktiken](#tipps-und-bewährte-praktiken)
12. [Fehlerbehebung](#fehlerbehebung)
13. [Häufig gestellte Fragen](#häufig-gestellte-fragen)

---

## Einführung

### Was ist PhantomSDR-Plus?

PhantomSDR-Plus ist ein webbasiertes Software-Defined Radio (SDR), mit dem Sie Funksignale über das Internet hören können. Auf Ihrer Seite werden weder besondere Software noch Hardware benötigt – nur ein moderner Webbrowser!

### Was können Sie hören?

Je nach Konfiguration des WebSDR können Sie Folgendes empfangen:

- **Amateurfunk**: Funkamateure weltweit
- **Rundfunkstationen**: AM-/UKW-Rundfunk, Kurzwellenrundfunk
- **Luftfahrt**: Flugsicherung, Flugfunk
- **Seefunk**: Schiff-Land-Verkehr, Seewetterdienst
- **Wettersatelliten**: NOAA, METEOR-M
- **Digitale Betriebsarten**: FT8, RTTY, PSK31 und mehr
- **Nutzfunkstationen**: Zeitzeichen, Militär, Behörden

### Systemanforderungen

- **Browser**: Chrome/Edge (empfohlen), Firefox, Safari
- **Verbindung**: Breitband-Internet (1 Mbit/s oder mehr empfohlen)
- **Audio**: funktionierende Lautsprecher oder Kopfhörer
- **Optional**: Maus mit Scrollrad zum leichteren Abstimmen

---

## Erste Schritte

### 1. Auf das WebSDR zugreifen

Öffnen Sie Ihren Browser und rufen Sie die vom Betreiber angegebene WebSDR-Adresse auf.

Beispiel: `http://websdr.example.com:9002`

### 2. Erster Seitenaufbau

Beim Laden der Seite sehen Sie:
- eine farbige Wasserfallanzeige mit der Funkaktivität
- ein Bedienfeld mit Frequenzanzeige und Schaltflächen
- ein S-Meter für die Signalstärke
- eine Anzeige der Nutzerzahl

### 3. Mit dem Hören beginnen

1. **Klicken Sie auf ein Signal** in der Wasserfallanzeige
2. **Der Ton startet automatisch**
3. **Regeln Sie die Lautstärke** über die Lautstärkeregelung des Browsers oder den Regler auf dem Bildschirm
4. **Stimmen Sie fein ab**, indem Sie genau auf das Signal klicken

---

## Überblick über die Oberfläche

### Hauptbestandteile

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes  RADE-v2U       │           · IF Filters     │ [ profile ▾ ]       │
│   RADE-v1L RADE-v1U   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM IQ               │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Die drei Panels unter dem Wasserfall scrollen als eine Seite; in einem schmalen Fenster stapeln sie sich, statt nebeneinander zu stehen. **RADE-v2U**, **RADE-v1L** und **RADE-v1U** sitzen auf der Überschriftenzeile *Modes* selbst, rechts davon.

### 1. Wasserfallanzeige

Der Wasserfall ist eine visuelle Darstellung von Funksignalen:

- **Waagerechte Achse**: Frequenz
- **Senkrechte Achse**: Zeit (läuft nach unten)
- **Farben**: Signalstärke
  - **Dunkelblau/schwarz**: kein Signal (Rauschteppich)
  - **Grün/gelb**: schwache bis mittlere Signale
  - **Orange/rot**: starke Signale
  - **Weiß**: sehr starke Signale

### 2. Frequenzanzeige

Zeigt die aktuell eingestellte Frequenz in verschiedenen Formaten:
- **MHz**: 7.100.000 MHz (KW-Bänder)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-Meter (analog oder digital)

Zeigt die Signalstärke an:
- **S1-S9**: übliche Signalstärkeskala
- **+dB**: Signale über S9 (z. B. S9+20dB)
- **Analog oder digital**: je nach Konfiguration

### 4. Betriebsartentasten

Wählen Sie die Demodulationsart:
- **AM**: Amplitudenmodulation
- **FM**: Frequenzmodulation
- **USB**: oberes Seitenband
- **LSB**: unteres Seitenband
- **CW**: Morsetelegrafie (Continuous Wave)
- **WBFM**: Breitband-FM (Rundfunk)
- **QUAM**: C-QUAM-AM-Stereo — die Beschriftung wird grün, sobald ein Stereopilot erkannt wird
- **IQ**: rohes I/Q — 12 kHz des Bandes, so wie sie ankommen, zum Aufzeichnen oder für ein anderes Programm (siehe den Abschnitt IQ weiter unten)

Neben der Überschrift **Modes** stehen die Tasten **RADE-v2U**, **RADE-v1L** und **RADE-v1U**, die RADE Digital Voice mit einem Druck starten — siehe [Digitale Decoder](#digitale-decoder). **RADE-v2U** startet RADE V2 (beta), immer in USB; **RADE-v1L** und **RADE-v1U** starten RADE v1.

### 5. Bedienfeld

Weitere Bedienelemente:
- **AGC**: automatische Verstärkungsregelung
- **NR**: Rauschminderung (spektral)
- **NB**: Störaustaster (impulsiv)
- **NS**: Grundrauschunterdrückung
- **AN**: automatische Notch
- **CTCSS**: Subton-Rauschsperre (FM). Ein Druck öffnet neben der Taste ein kleines Fenster mit *Any tone* und den 49 Standard-Subtönen (67,0–254,1 Hz); nach der Wahl zeigt die Taste den Ton an (zum Beispiel *88.5* oder *ANY*), und der Ton ist nur zu hören, solange dieser Subton empfangen wird. Die Zeile *Heard:* im Fenster zeigt, welchen Subton der Empfänger gerade auf dem Kanal hört und wie stark er ist — so lässt sich ein unbekannter Relais-Subton ablesen. Solange CTCSS eingeschaltet ist, läuft der FM-Ton 0,4 s hinter dem Empfänger her, damit die Sperre schon offen ist, wenn die ersten Worte einer Station eintreffen; mit *Any tone* kann der Anfang noch leicht abgeschnitten werden, wählen Sie daher nach Möglichkeit den genauen Subton. Ein erneuter Druck schaltet CTCSS aus; Escape oder ein Klick daneben schließt das Fenster, ohne etwas zu ändern. Lesezeichen speichern den gewählten Ton.
- **SQL**: Rauschsperre
- **AI**: KI-Rauschunterdrückung (nur Sprache)
- **Zoom**: Vergrößerungsstufe des Wasserfalls
- **Wheel Tuning Steps**: Schrittweite des Mausrads, von 10 Hz bis 12,5 kHz (12,5 kHz ist der Kanalabstand auf VHF/UHF)
- **Decoders**: Tasten, die jeden Decoder mit einem Druck starten und stoppen

### 6. Bandplan-Overlay

Farbige Balken zeigen die Frequenzzuweisungen:
- unterschiedliche Farben für unterschiedliche Funkdienste
- hilft zu erkennen, was auf welcher Frequenz zulässig ist

---

## Grundlegende Bedienung

### Auf eine Frequenz abstimmen

#### Methode 1: In den Wasserfall klicken

1. Klicken Sie direkt auf ein Signal im Wasserfall
2. Der Empfänger stimmt auf diese Frequenz ab
3. Der Ton beginnt

#### Methode 2: Frequenz eingeben

1. Klicken Sie irgendwo in den schwarzen Frequenz-/S-Meter-Kasten — überall außer auf eine Ziffer und außer auf das analoge S-Meter, dessen Klick den Stil umschaltet
2. Ein Ziffernblock öffnet sich; geben Sie die Frequenz über seine Tasten oder die Tastatur ein (`.` oder `,` als Dezimalzeichen)
3. Drücken Sie **kHz** oder **MHz**, um abzustimmen — die gedrückte Taste legt die Einheit fest; auf der Tastatur bedeutet die Eingabetaste kHz und `M` MHz

**C** löscht die Eingabe, **⌫** löscht die letzte Ziffer, und Escape oder ein Klick daneben schließt den Ziffernblock, ohne abzustimmen. In der erweiterten Mobilansicht öffnet ein Tippen auf das Frequenzfeld selbst die eigene Zifferntastatur des Telefons.

Beispiele:
- `7100` + **kHz** → 7.100 MHz
- `14.2` + **MHz** → 14.200 MHz
- `145.5` + **MHz** → 145.500 MHz

**Eine eingetippte Frequenz bringt ihr Band mit.** Der Empfänger geht in das Band, in das Sie getippt haben, so wie es dessen Bandtaste täte: Der Wasserfall zoomt auf das ganze Band, Helligkeit und Kontrast übernehmen die Einstellungen dieses Bandes, und die Betriebsart folgt dem Bandplan — Sie bleiben aber genau auf der eingetippten Frequenz. Außerhalb aller definierten Bänder ändert sich nur die Frequenz. Hat die Station einen weiteren Empfänger, der die Frequenz abdeckt — etwa `145.5` **MHz**, auf einem KW-Empfänger eingetippt —, öffnet sich stattdessen dessen Seite, schon abgestimmt und genauso eingerahmt (siehe *Einen Empfänger wählen* weiter unten).

#### Methode 3: Maus auf den Ziffern

1. Bewegen Sie den Zeiger über eine Ziffer der Frequenzanzeige — sie leuchtet auf
2. Rad nach oben oder **Linksklick** erhöht diese Ziffer um eins; Rad nach unten oder **Rechtsklick** verringert sie
3. Der Schritt ist der Stellenwert der Ziffer — 1 kHz auf der kHz-Ziffer, 100 Hz auf der ersten Nachkommastelle —, und eine Ziffer, die über 9 hinausgeht, überträgt auf die Ziffer links daneben
4. Überall sonst im schwarzen Frequenzfeld — Bandname, Betriebsartzeile, Uhr — stimmt das Rad im Abstimmschritt ab (**Shift** 1 kHz, **Alt** 10 kHz); nur das analoge S-Meter ist ausgenommen, dort rollt das Rad die Seite

#### Methode 4: Schrittschaltflächen

1. Verwenden Sie die Schaltflächen **▲** und **▼** neben der Frequenz
2. Die Schrittweite hängt von der Betriebsart ab:
   - **AM/FM**: Schritte von 1 kHz
   - **SSB**: Schritte von 100 Hz
   - **CW**: Schritte von 10 Hz

#### Methode 5: Bandschaltflächen

Eine Bandschaltfläche rahmt ihr Band — der Wasserfall zoomt auf das ganze Band, Helligkeit und Kontrast übernehmen die Einstellungen des Bandes — und stimmt auf die Frequenz ab, die Sie zuletzt in diesem Band benutzt haben, gleich wie Sie dorthin gekommen sind (Klick in den Wasserfall, die Ziffern, ein Lesezeichen, ein Chat-Link …). Beim ersten Mal geht sie auf die Vorgabefrequenz des Bandes. Ein zweiter Klick auf die bereits aktive (hervorgehobene) Bandschaltfläche vergisst die gemerkte Frequenz und geht auf die Vorgabe des Bandes. Das Gedächtnis liegt in Ihrem Browser, übersteht also ein Neuladen, und gilt nur für Sie.

### Scanner

Der Scanner führt den Empfänger über einen Bereich von Kanälen und hält beim ersten an, auf dem ein Signal liegt. Er sitzt in der Zeile **Fine Tuning (kHz)** ganz rechts:

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Bedienelement | Funktion |
|---------------|----------|
| **◀ ▶** | Abwärts / aufwärts suchen. Steht der Scanner auf einem Signal, setzt ein Pfeil den Suchlauf fort. |
| **■** | Anhalten. |
| **⊘** | Diesen Kanal vom Suchlauf ausschließen — für Pfeifstellen oder Dauerträger. |
| **30 dB · 4 ▾** | Die Schwelle, daneben der gerade gemessene Pegel. Öffnet die Einstellungen. |

Der Text links zeigt, was der Scanner tut: `Scanner` im Ruhezustand, die erreichte Frequenz während des Suchlaufs, `◉ 3s` während des Rücklaufzählers,
`◉ 30·22s` solange der Kanal noch belegt ist, `◉ hold`, wenn er stehen bleibt.

**Einstellungen**

- **Range** — *Scan Band* durchsucht das Band, in dem der Suchlauf beginnt;
  *Scan Visible* durchsucht genau den sichtbaren Wasserfall und folgt ihm beim
Zoomen und Verschieben.
- **Scan** — *Every channel* stimmt jeden Kanal der Reihe nach ab und hört hinein;
  *Skip empty* liest das Spektrum und springt direkt zu den Signalen.
- **Stop at** — wie weit über dem Grundrauschen des Bandes ein Kanal liegen muss,
damit der Suchlauf anhält, in dB. Das Rauschen wird laufend nachgeführt, eine Einstellung passt daher tags wie nachts. Ein leerer Kanal zeigt nicht 0 dB — beobachten Sie den Live-Wert auf der Schaltfläche und wählen Sie die Schwelle darüber.
- **Resume after** — wie lange ein Kanal ruhig bleiben muss, bevor der Suchlauf
weiterläuft. Sprechpausen starten ihn nicht neu. *Hold* bleibt stehen, bis Sie eine Taste drücken.
- **Max stay** — läuft nach dieser Zeit weiter, auch wenn das Signal noch da ist,
damit ein Dauerträger den Suchlauf nicht dauerhaft festhält.

Die Schrittweite richtet sich nach der Betriebsart — 1 kHz in SSB, 0,1 kHz in CW, 5 kHz in AM, 9 oder 10 kHz auf Mittelwelle und 9 kHz auf Langwelle — und die Haltepunkte liegen im Kanalraster. Der Suchlauf bleibt in seinem Bereich und innerhalb dessen, was der Empfänger abstimmen kann; an einer Grenze läuft er am anderen Ende weiter.

Einstellungen und ausgeschlossene Kanäle merkt sich Ihr Browser.


### Demodulationsart auswählen

Wählen Sie die zum Signal passende Betriebsart:

**Für Sprechfunk:**
- **AM**: Luftfahrt, AM-Rundfunk, teils Amateurfunk
- **FM**: VHF-/UHF-Relaisfunkstellen, UKW-Rundfunk
- **USB**: KW-Amateurfunk (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB**: KW-Amateurfunk (160 m, 80 m, 40 m, 30 m)

**Für Daten/Digital:**
- **USB**: die meisten digitalen Betriebsarten (FT8, PSK31, RTTY)
- **LSB**: einige digitale Betriebsarten auf den unteren KW-Bändern

**Für Morsetelegrafie:**
- **CW**: Telegrafie-/Morsesignale

### Lautstärke einstellen

- **Regler auf dem Bildschirm**: Lautstärkeregler ziehen
- **Browser-Lautstärke**: Mediensteuerung des Browsers verwenden
- **Systemlautstärke**: Lautstärke des Computers anpassen
- **Tastatur**: Tasten + und - verwenden (sofern unterstützt)

### Das S-Meter nutzen

Das S-Meter zeigt die Signalstärke:

- **S0-S3**: sehr schwaches Signal, schwer aufzunehmen
- **S4-S6**: schwaches bis mittleres Signal
- **S7-S9**: gutes bis starkes Signal
- **S9+**: außerordentlich starkes Signal

**Tipp**: Für die beste Tonqualität stimmen Sie auf Signale ab, die S7 oder mehr anzeigen.

**Das Skalenbild wechseln**: Klicken Sie beim analogen Instrument (Zeiger) auf das Instrument selbst — oder wählen Sie es an und drücken Sie Enter oder die Leertaste —, um drei Hintergründe durchzuschalten: dunkles gebürstetes Metall, ein helles blassgraues Zifferblatt und ein warmes Bernstein-Zifferblatt im Vintage-Stil. Ihr Browser merkt sich die Wahl, sie ist also nach einem Neuladen oder Neustart noch da. Sie gilt pro Browser und pro Adresse: Der Aufruf des Empfängers über den Hostnamen und über die IP ergibt zwei getrennte Einstellungen, und ein privates Fenster startet immer mit der Standardeinstellung der Seite.

**Oberhalb von 30 MHz** folgt das S-Meter dem VHF-Standard der IARU Region 1: S9 liegt dort bei −93 dBm statt −73 dBm auf Kurzwelle, weiterhin sechs dB je S-Stufe. Zeiger und Balken stellen sich mit der eingestellten Frequenz von selbst um; die Werte in dBm und dBµV zeigen immer den gemessenen Pegel. Manche Stationen stellen ihre VHF/UHF-Empfänger außerdem so ein, dass die Instrumente **auf einem leeren Kanal auf 0 ruhen**, wie bei einem VHF/UHF-Funkgerät: Oberhalb von 60 MHz schlagen Zeiger und Balken dann erst aus, wenn ein Signal aus dem Rauschen heraustritt. Die Werte in dBm, dBµV, SNR und NF zeigen immer die echten Werte.

### Einen Empfänger wählen

Manche Stationen betreiben mehr als einen Empfänger — zum Beispiel einen für Kurzwelle und einen für das 2-m-Band. Sie zeigen im Seitenkopf eine Zeile *Receivers:* mit einer Schaltfläche pro Empfänger; der, auf dem Sie gerade sind, erscheint gelb. Ein Druck auf eine andere Schaltfläche öffnet die Seite dieses Empfängers, mit eigenem Wasserfall, eigenen Bändern, Chat und eigener Hörerliste. Auf der Seite /mobile sitzen dieselben Schaltflächen in der oberen Leiste. Eine Station mit nur einem Empfänger zeigt keine solche Zeile.

**Show All.** Hinter den Empfänger-Tasten steht ein Kästchen **Show All**. Ist es angehakt, erscheint jeder andere Empfänger der Station unter Ihrem Wasserfall — sein Spektrum und sein Wasserfall, mit eigenen Markern und eigener Frequenzskala, die neueste Zeile oben. Mit der Maus darüber lesen Sie Frequenz und nächsten Marker ab; ein Klick öffnet diesen Empfänger dort, im selben Tab: auf einem Marker in dessen Betriebsart, anderswo in der Betriebsart des Bandplans. Das Kästchen merkt sich Ihr Browser; es ist aus, bis Sie es anhaken, denn jeder Streifen ist ein weiterer Wasserfall-Datenstrom (etwa 10 KB/s).

**Die verlassene Ansicht bleibt erhalten.** Wenn Sie die Seite eines Empfängers verlassen, werden Zoom, Helligkeit, Kontrast, Betriebsart und Frequenz gespeichert. Sein Streifen auf der anderen Seite zeigt dann genau diesen Teil des Bandes, mit einem kleinen grünen ▼ an der zuletzt eingestellten Frequenz; die Taste im Kopf des Streifens zeigt diesen Bereich und **Full span** — drücken Sie sie für den ganzen Bereich des Empfängers und **Last view**, um zurückzukehren. Ein Klick auf eine Frequenz in dieser Ansicht öffnet den Empfänger wieder genau so, mit demselben Zoom, denselben Pegeln und derselben Betriebsart, statt mit seinem ganzen Bereich.

**Ein Band im Streifen wählen.** Deckt der andere Empfänger mehr als ein Band ab — der KW-Empfänger von der 2-m-Seite aus —, zeigt der Kopf des Streifens statt dieser Taste eine Auswahlliste: **Last view**, **Full span** und jedes Band dieses Empfängers, dieselben Bänder wie seine Bandschaltflächen. Wählen Sie ein Band, zeigt der Streifen es so wie diese Bandschaltfläche, von Rand zu Rand mit Helligkeit und Kontrast des Bandes; ein Klick auf den Streifen öffnet dann diesen Empfänger auf dieses Band gerahmt, abgestimmt auf die angeklickte Frequenz. Die Wahl wird in Ihrem Browser gespeichert, für jeden Empfänger getrennt. Ein Empfänger mit nur einem Band, etwa 2 m, behält die Taste.

**Von selbst der richtige Empfänger.** Eine Frequenz, die dieser Empfänger nicht abdeckt, ein anderer Empfänger der Station aber schon — eingetippt, aus einem Link, einem Lesezeichen, einem DX-Spot, einer Chatnachricht oder dem Etikett eines anderen Hörers —, öffnet die Seite jenes Empfängers, dort abgestimmt. Mausrad und Ziffernschritte wechseln nie den Empfänger, ebenso wenig ein über CAT verbundener Transceiver.

---

## Erweiterte Funktionen

### Automatische Verstärkungsregelung (AGC)

Die AGC hält den Ton auf gleichmäßigem Pegel. Die vier Tasten arbeiten wie der AGC-Schalter eines Transceivers: Alle vier ergeben dieselbe Lautstärke und unterscheiden sich nur darin, wie schnell die Verstärkung wieder ansteigt, wenn ein Signal schwächer wird oder verschwindet.

- **Auto**: die empfängereigene AGC, getrennt abgestimmt für SSB, AM und C-QUAM. Das ist die Voreinstellung.
- **Fast**: keine Haltezeit; die Verstärkung erholt sich in etwa 0,3 s. Zwischen den Worten kommt das Rauschen hoch, schnelles Fading wird eng verfolgt. Gut für CW und um eine schwache Station zwischen starken herauszuhören.
- **Medium**: hält 0,25 s, erholt sich dann in etwa 1,2 s. Eine gute Alltagseinstellung für SSB.
- **Slow**: hält 1 s, erholt sich dann in etwa 3 s. Der Hintergrund bleibt zwischen Worten und Durchgängen unten; eine schwache Station direkt nach einer starken klingt einige Sekunden lang leiser.

**Solange ein Decoder geöffnet ist**, wird die AGC auf Slow gehalten, egal welche Taste gewählt ist: Der Decoder hört denselben Ton wie Sie und braucht eine gleichmäßige Verstärkung. Neben der AGC-Überschrift erscheint der kleine Hinweis **Slow (decoder)**, und Ihre eigene Wahl kehrt zurück, sobald der letzte Decoder geschlossen ist.

**Empfehlung**: Beginnen Sie mit „Fast" für AM und „Slow" für SSB.

### Die vier Rauschregler

NR, NB, NS und AN sind getrennte Ein/Aus-Schalter, die jeweils eine andere Art von Störung angehen. Sie sind unabhängig voneinander — einer schaltet keinen anderen mit ein — und lassen sich beliebig kombinieren.

Keiner von ihnen erreicht die Decoder: FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia/Packet/APRS und der QRSS-Grabber lesen das Audio *vor* diesen Filtern. Sie können sie also rein nach Gehör einstellen, ohne zu beeinflussen, was decodiert wird. Siehe das [Decoder-Handbuch](DECODERS.md#14-allgemeine-tipps).

### Rauschminderung (NR)

Spektrale Rauschminderung. Sie schätzt den Rauschpegel in jedem Teil des Audiospektrums und dreht diese Anteile herunter; was über dem Rauschen steht, bleibt unangetastet.

**Verwenden, wenn**: Sie gleichmäßiges Zischen oder weißes Rauschen hinter dem
Signal hören.

Dauertöne — eine CW-Note, ein Träger — werden als Signal erkannt und geschützt. NR frisst also kein CW-Signal, wie es ein naives Filter täte. Typische Wirkung: 10–12 dB weniger Rauschen in den Sprechpausen. Die Sprache selbst verliert bei starken Signalen deutlich unter 1 dB und bei sehr schwachen einige dB, die aber trotzdem verständlicher bleiben als ohne NR.

### Störaustaster (NB)

Entfernt Impulsstörungen: Knacken, Knallen, atmosphärische Entladungen, Zünd- und Netzstörungen. Er beobachtet die Audio-Hüllkurve und schweigt nur die Abtastwerte still, die weit darüber ausschlagen — etwa eine Millisekunde je Knall, mit weichen Flanken, damit die Austastung nicht selbst knackt.

**Verwenden, wenn**: Sie Knacken von Stromleitungen, Motoren, Gewittern oder
Fahrzeugzündungen hören.

Die Netzbrumm-Notches bei 50 Hz und 60 Hz folgen dieser Taste.

### Grundrauschunterdrückung (NS)

Misst über mehrere Sekunden das Grundrauschen des Bandes und senkt alles ab, was auf diesem Pegel liegt — bei hohen Tonfrequenzen stärker als bei tiefen. Wo NR von Moment zu Moment reagiert, ist NS die langsame, ruhige Hand: Sie senkt das Bandrauschen, ohne den Klang des Signals selbst zu verändern.

**Verwenden, wenn**: Das Band ruhig, aber zischig ist und Sie das Rauschen
absenken wollen, ohne den „Unterwasser"-Klang aggressiver NR.

Nur in USB, LSB und AM aktiv — CW, FM und die digitalen Betriebsarten bleiben unberührt. Bei jedem Frequenz- oder Modewechsel wird neu gemessen; das ist nach wenigen Sekunden eingeschwungen.

### Automatische Notch (AN)

Findet und entfernt selbsttätig Dauertöne — Heterodyne, Träger, Pfeifstellen — ohne dass Sie ein Notchfilter von Hand setzen müssen. Sie passt sich laufend an, kann also mehrere Töne gleichzeitig entfernen und bleibt auch an einem driftenden Ton hängen.

**Verwenden, wenn**: Sie einen Pfeifton über dem gewünschten Signal hören.

In CW abgeschaltet, denn dort *ist* das Nutzsignal ein Dauerton.

**Hinweis zur Verzögerung**: NR und NS fügen im eingeschalteten Zustand je rund
40 ms Audioverzögerung hinzu (beide zusammen etwa 80 ms). NB und AN fügen keine hinzu. Das betrifft nur das Hören, nie die Decoder.

### Automatische Rauschsperre (SQL)

Schaltet den Ton stumm, wenn kein Signal anliegt:

- **Off**: immer hörbar (Rauschen zu hören)
- **Auto**: Schwelle wird automatisch gesetzt
- **Manual**: Schwelle manuell einstellen

**Verwenden, wenn**: Sie eine Frequenz auf Aktivität überwachen.

Solange SQ aus ist, wird die Schwellenzahl neben dem Schieberegler grau angezeigt.

### KI-Rauschunterdrückung (AI)

Die Taste **AI** mit einem Stärkeregler daneben sitzt im Bereich Audio & Buffer direkt unter SQ. Auf der Seite /mobile befindet sie sich im Reiter Audio unter Squelch. Sie entfernt Bandrauschen aus Sprache mit RNNoise, einem kleinen, auf Sprache trainierten neuronalen Netz.

Alles geschieht in Ihrem eigenen Browser: Nichts wird an einen fremden Server geschickt, es gibt kein Konto, und der Empfänger hat keine zusätzliche Arbeit.

- **Ein/Aus**: **AI** anklicken; die Taste wird blau. Beim ersten Klick wird das Modul geladen (etwa 1,3 MB), und die Taste pulsiert, solange es lädt.
- **Stärke**: Der Regler bestimmt, wie stark sie wirkt, während jemand spricht — niedrigere Werte behalten mehr vom ursprünglichen Klang. Das obere Ende der Skala ist absichtlich weicher als ein voller Schnitt, damit die Sprache selbst bei 100 % nicht beschädigt wird; 100 % reinigt trotzdem mehr als 50 %. Zwischen den Wörtern arbeitet sie von sich aus stärker, sodass das Rauschen dort weiter sinkt. Voreinstellung ist 50 %. Sie können den Wert auch bei ausgeschalteter KI setzen.
- **Statusanzeige**: Die Anzeige AI unter der Frequenz leuchtet cyan, solange AI arbeitet, und erscheint halb abgedunkelt, wenn AI eingeschaltet ist, die aktuelle Betriebsart aber keine Sprachbetriebsart ist.

**Verwenden, wenn**: Sie SSB- oder AM-Sprache auf einem verrauschten Band hören. Das Rauschen zwischen den Worten sinkt bei der Voreinstellung 50 % typisch um etwa 10 dB, bei 100 % um mehr, bis etwa 20 dB, während die Sprache ihren Pegel behält.

Nur Sprachbetriebsarten — USB, LSB, AM und SAM. In CW, FM, den Datenbetriebsarten und C-QUAM läuft der Ton unverändert durch, weil das Netz einen CW-Ton oder Musik als Rauschen behandelt. Wie die vier Rauschregler erreicht sie nie die Decoder. Bei schwachen Stationen (unter etwa +6 dB SNR) misst sie den Signal-Rausch-Abstand selbst und glättet ihre Entscheidungen stärker, damit die Sprache nicht den blubbernden, „wässrigen“ Klang annimmt, den ein solches Filter erzeugen kann; starke Stationen werden genau wie bisher verarbeitet. Klingt ein sehr schwaches Signal trotzdem bearbeitet, senken Sie den Regler. Sie fügt etwa 50 ms Tonverzögerung hinzu.

### Audiopuffer und Verzögerung

Der Ton erreicht den Browser in kleinen Paketen, bei einem typischen Empfänger je 35 ms, und der Browser hält ein wenig davon vorrätig, damit ein verspätetes Paket keine Lücke verursacht. Dieser Vorrat ist der **Puffer**, und er macht den größten Teil der Verzögerung zwischen Empfänger und Lautsprecher aus.

- **Desktop**: Im Bereich Audio & Buffer erhöht die Taste mit dem Netzwerksymbol den Puffer pro Klick um eine Stufe (sie wird oberhalb der niedrigsten Stufe grün), und der Schieberegler daneben wählt direkt eine Stufe von 1 bis 6. Die niedrigste Stufe passt zu einer Kabelverbindung; Telefone beginnen auf Stufe 2.
- **/mobile**: Die Taste **BUF** und der Regler **Buffer** im Reiter Audio tun dasselbe.

Der Puffer passt sich selbst an. Die Seite misst, wie unregelmäßig Ihre Verbindung den Ton liefert, und hält nur so viel vorrätig, wie die letzte Minute gezeigt hat, plus die Sicherheitsreserve der gewählten Stufe: 20 ms auf Stufe 1, 50 ms auf Stufe 2, mehr auf den höheren Stufen. Nach einer kurzen Netzstörung baut sich die zusätzliche Verzögerung innerhalb von ein, zwei Minuten wieder ab, und ein kleiner Unterschied zwischen dem Takt Ihrer Soundkarte und dem des Empfängers führt nicht mehr alle paar Minuten zu einer Unterbrechung. Die Anpassungen betragen jeweils wenige Millisekunden, erfolgen dort, wo sich der Klang wiederholt, und sind nicht hörbar. Decoder und Ihre Aufnahmen sind nie betroffen: Sie erhalten jedes Sample.

Bricht der Ton ab, erhöhen Sie den Puffer um eine Stufe. Auf einem Telefon im heimischen WLAN beträgt die Verzögerung vom Empfänger bis zum Lautsprecher typisch etwa 100–150 ms; das Netz zwischen Ihnen und dem Empfänger kommt hinzu.

### Ihr Name oder Rufzeichen

Neben **Open Additional Info** steht ein Feld für Ihren Namen oder Ihr Rufzeichen: höchstens 10 Zeichen und keine Leerzeichen, wie bei einem WebSDR. Tippen Sie ihn ein und drücken Sie **Save** (oder Enter); mit **Edit** ändern Sie ihn später. Ihr Browser merkt ihn sich, auch wenn Sie zu den anderen Empfängern der Station wechseln. Lassen Sie das Feld leer, bleiben Sie anonym: im Chat als *anonymous* mit einer Zahl, überall sonst nur mit Ihrem Standort. Auf dem Telefon steht dasselbe Feld über der Frequenzanzeige.

Ihr Name erscheint im Fenster **Users**, in Ihren Chat-Zeilen und auf der Beschriftung, die die anderen Hörer unter ihrem Wasserfall sehen — Ihr Name und danach Ihr Standort, zum Beispiel `SV1BTL-Athens`. Ihre eigene Position ist der gelbe ★ mit Ihrem Namen daneben. Fahren Sie mit der Maus über die Beschriftung eines anderen Hörers, um Frequenz und Betriebsart zu sehen, auf die er eingestellt ist; ein Klick stimmt dorthin ab.

Wie bei einem WebSDR wird keinem Hörer die IP-Adresse eines anderen gezeigt — weder im Fenster Users noch in der Nutzerstatistik, die Besucher über einen anonymen Code zählt.

Das Fenster Users zeigt außerdem, welchen Decoder jeder Hörer gerade nutzt — FT8, CW, DRM, HFDL usw. — als kleine grüne Marke hinter der Betriebsart, und die Nutzerstatistik hat ein Feld **Decoder Popularity**: wie viele Sitzungen welchen Decoder benutzt haben. Im Users-Fenster, das von der Empfängerseite aus geöffnet wurde, stellt **Tune** neben einem Hörer Sie auf das ein, was er hört: dieselbe Frequenz und Betriebsart, seine Filterbandbreite und seinen Decoder — für Sie gestartet, oder Ihrer gestoppt, wenn er keinen verwendet. Danach wird das Band gerahmt wie mit **To Band**: Der Wasserfall zeigt das ganze Band, in dem er sich befindet, mit Helligkeit, Kontrast und Abstimmschritt dieses Bandes.

### Chat

Hat der Betreiber den Chat aktiviert, hat er auf der Desktop-Seite einen eigenen Bereich und auf /mobile einen Reiter **Chat**. Schreiben Sie Ihre Nachricht und senden Sie sie: Sie geht unter dem Namen aus Ihrem Namensfeld hinaus (siehe oben) oder als *anonymous* mit einer Zahl.

Um auf eine bestimmte Nachricht zu antworten, klicken Sie auf **↪ Reply** neben ihrer Uhrzeit. Eine Zeile über dem Eingabefeld zeigt, wem und worauf Sie antworten; schreiben und senden Sie wie gewohnt, oder drücken Sie ✕ bzw. Esc zum Abbrechen. Die Antwort erscheint eingerückt unter der beantworteten Nachricht, mit einer kurzen Zitatzeile. Eine Antwort auf eine Antwort gehört zum selben Faden. Der Server behält die letzten 20 Nachrichten; ist das Original schon aus diesem Verlauf verschwunden, zeigt eine Antwort nur Name und Uhrzeit dessen, worauf sie antwortet.

Eine Frequenz in einer Nachricht ist ein Link: Ein Klick stimmt dorthin ab, in der mitgegebenen Betriebsart. Das Band wird gerahmt wie mit **To Band** — der Wasserfall zeigt das ganze Band mit Helligkeit und Kontrast dieses Bandes —, und die Bandschaltfläche leuchtet auf.

### Zoomfunktion

Vergrößert die Wasserfallanzeige:

- **1x**: Normalansicht (breite Abdeckung)
- **2x**: 2-fache Vergrößerung
- **4x**: 4-fache Vergrößerung
- **8x**: 8-fache Vergrößerung

**Verwenden, wenn**: Sie Signale deutlicher sehen oder genauer abstimmen möchten.

**To Band** zeigt das ganze Band der eingestellten Frequenz, mit 10 kHz Rand an jeder Seite.

### Auto Adj. (Wasserfall)

Der Schalter **Auto Adj.** unter den Wasserfall-Bedienelementen stellt Helligkeit und Kontrast des Wasserfalls selbst ein. Er misst das Grundrauschen über die sichtbare Spanne und macht daraus einen gleichmäßigen, dunklen Hintergrund – auch dort, wo das Rauschen in einem Teil der Spanne anders ist als im anderen – und spreizt alles darüber, sodass schwache Signale hervortreten und die stärksten die obersten Farben erreichen. Das funktioniert mit jeder Farbpalette gleich, und nur der Wasserfall ändert sich: Die Spektrumkurve behält ihre echte dB-Skala. Solange er eingeschaltet ist, sind die Regler Min und Max gesperrt und zeigen das gemessene Grundrauschen und die Spitze; beim Ausschalten kehren sie zu den Einstellungen des Bandes zurück.

### 3D-Spektrum

Die Schaltfläche **3D** neben **Reverse** unter den Wasserfall-Bedienelementen zeigt das Spektrum als Relief der letzten Sekunden: die Frequenz in der Breite, die Zeit in die Tiefe des Bildes, die Signalstärke als Höhe. Es verwendet dieselben Farben, dieselbe Helligkeit (Min), denselben Kontrast (Max) und dasselbe Auto Adj. wie der Wasserfall und folgt Zoom und Verschieben wie das flache Spektrum. Ein Klick stimmt ab, Ziehen verschiebt das Band und das Mausrad zoomt, genau wie im flachen Spektrum. Das Relief verjüngt sich nach hinten wie ein schräg betrachteter Tisch, und je weiter hinten eine Zeile liegt, desto niedriger sind ihre Spitzen. Ein Klick auf eine ältere Zeile stimmt auf deren Frequenz ab, und die Frequenzanzeige unter der Maus nennt dann auch das Alter der Zeile (zum Beispiel 7.074.000 · −6 s). Die Schaltfläche **⚙** öffnet zwei Schieberegler: **Angle** (wie steil der Boden nach hinten ansteigt) und **Depth** (wie stark sich das Relief nach hinten verjüngt und seine Zeilen niedriger werden); **Reset** stellt die Vorgaben wieder her, und Ihre Einstellung wird im Browser gespeichert. Die Marken links zeigen, wie viele Sekunden eine Zeile zurückliegt, die rechts, wie viele dB über dem Min-Pegel eine Spitze reicht (bei eingeschaltetem Auto Adj. sind sie ausgeblendet). **✕ 2D** oder ein erneuter Klick auf 3D kehrt zum flachen Spektrum zurück; die Wahl wird im Browser gespeichert. Die Ansicht braucht WebGL2, das jeder aktuelle Browser bietet; ohne WebGL2 erscheint die Schaltfläche nicht. Eine Videoaufnahme bei geöffneter 3D-Ansicht nimmt die 3D-Ansicht anstelle des flachen Spektrums auf. Die 3D-Ansicht ist von PhantomSDR-ORSAT von F1NSK übernommen.

**Cursorlinie.** Wo immer die Maus über dem Spektrum, dem Wasserfall oder der 3D-Ansicht steht, markiert eine gestrichelte gelbe Linie diese Frequenz im Spektrum und im Wasserfall, und das Spektrum zeigt sie in MHz an.

### Audioanalysator

Die Schaltfläche **📊 Show** im Bereich Spectrogram öffnet den Audioanalysator unter dem Wasserfall; **📊 Hide** schließt ihn. Er zeigt das Audio, das Sie hören, nach der Demodulation als Spektrum mit dB-Raster und gelber Spitzenwertlinie. **Gain** hebt oder senkt die Kurve, **Color** wählt ihre Farben. Das Spektrum wird als Relief gezeichnet, beleuchtet von rechts oben. In den Rainbow-Farben wird jeder Balken danach gefärbt, wie weit er bei seiner Frequenz über dem Rauschen steht — dunkelblau für das Rauschen, auch in Sprechpausen, wenn die AGC es anhebt, dann blau, cyan, gelb, orange und rot für immer stärkere Signale —, während seine Höhe weiterhin an der dB-Skala abzulesen ist. Wie das Hauptspektrum sind der Analysator und seine Berichte auf schwarzem Grund gezeichnet, mit grauen Rasterlinien.

- **Frequenzachse.** Sie folgt der Betriebsart: 0–4,5 kHz bei SSB, 0–2 kHz bei CW, 0–5,5 kHz bei AM und FM. Bei LSB ist sie umgekehrt (hohe Töne links), sodass sie in derselben Richtung wie das HF-Spektrum läuft. Eine cyanfarbene Linie markiert die eingestellte Frequenz (bei CW den 600-Hz-Ton), und unter der Maus zeigt der Analysator die Audiofrequenz und die HF-Frequenz in kHz.
- **Bandbreitenmarken.** Farbige Marken zeigen die empfohlenen Breiten der Betriebsart — SSB-Standard 300–2700 Hz und ESSB 50–4000 Hz, CW 500 Hz und 250 Hz, AM-Rundfunk und AM-Amateurfunk —, ein gestrichelter weißer Rahmen Ihr aktuelles Filter. Die Standardbreite erscheint als durchgezogene cyanfarbene Linie, die Alternative (ESSB, CW 250 Hz, AM-Amateurfunk) gestrichelt in Hellblau.
- **HF-Ansicht bei AM und FM.** Demoduliertes Audio hat keinen Träger, daher zeigt der Analysator die Station in diesen Betriebsarten so, wie sie im Wasserfall steht: Träger in der Mitte, Seitenbänder links und rechts. Ihre Skala zeigt dB über dem Rauschen.
- **Belegte Bandbreite.** Die Zeile unter dem Spektrum nennt die Breite, die die eingestellte Station belegt (−26-dB-Methode, im Wasserfall gemessen), mit einer Bewertung für SSB, AM und CW: grün innerhalb der Norm, gelb breit (eine ESSB-Station erscheint gelb), rot für wahrscheinlichen Splatter, der zusätzlich im Spektrum schattiert wird. Nötig sind etwa 2 s Messungen; statische Störungen (Knacke) werden ignoriert.
- **Kein Zoom nötig.** Solange der Analysator offen ist, hält die Seite eine zweite, unsichtbare Wasserfall-Verbindung, auf die Station zentriert und mit der feinen Auflösung, die die Messungen brauchen — so funktionieren die HF-Ansicht und alle HF-Messungen bei jedem Zoom des Wasserfalls. Sie wird mit dem Analysator geschlossen. Sie kostet etwa 12–14 KB/s (rund 45 MB pro Stunde) zusätzliche Daten, solange der Analysator offen ist; schließen Sie ihn bei einer Verbindung mit Datenvolumen, wenn Sie ihn nicht brauchen.
- **Abstimmen im Analysator.** Die eingestellte Frequenz in der Kopfzeile des Analysators stimmt wie die Hauptanzeige ab: Maus über eine Ziffer und scrollen, oder Linksklick für einen Schritt nach oben und Rechtsklick nach unten; ein Klick neben die Ziffern öffnet das Ziffernfeld. Ein Klick auf das Feld der Betriebsart öffnet ein Menü der Betriebsarten.
- **Mute.** Die Schaltfläche Mute in der Kopfzeile des Analysators schaltet den Empfänger stumm, während die Analyse weiterläuft — um die eigene Aussendung zu prüfen, ohne sie ins Mikrofon zurückzuspielen. Dort stummgeschalteter Ton kommt zurück, wenn der Analysator schließt.

**SSB-Audiobericht.** Bei USB und LSB öffnet sich unter dem Analysator ein Berichtsfeld. Über ein gleitendes Fenster von 20 s, und nur solange die Station spricht, bewertet es die Klangbalance — Tiefen (100–300 Hz) und Präsenz (1,5–2,7 kHz) gegenüber den Mitten, verglichen mit der gewählten Referenz: **Standard SSB**, **DX / punch** oder **ESSB / hi-fi** —, dann Kompression, Netzbrummen (Linien bei 50/100/150 oder 60/120/180 Hz), Trägerrest und Gegenseitenband (beide im Wasserfall gemessen) sowie die belegte Bandbreite. Jede Zeile erhält einen grünen, gelben oder roten Punkt; eine nicht messbare Zeile sagt, warum — meist wegen des Empfangsfilters (für die Tiefen muss seine untere Kante bei etwa 120 Hz oder darunter liegen). Oberhalb von 2,7 kHz wird nichts bewertet, der Analysator zeigt es aber weiterhin. Die mittlere Form der Stimme wird im Analysator als blaue Kurve gezeichnet. **Store A** behält sie als gestrichelte Kurve A, um nach einer Einstellungsänderung der Gegenstation zu vergleichen; **Clear A** entfernt sie, **↺ Restart** beginnt die 20 s von vorn. **Generate a listening report** lädt eine HTML-Datei für die Gegenstation herunter, mit den Bewertungen, einem Bild des Spektrums und den letzten 20 Sekunden Audio. Die Messungen sind Richtwerte: Fading sowie Filter und AGC des Empfängers beeinflussen sie, wählen Sie daher die langsame AGC (Slow). Analysator und Bericht sind übernommen von PhantomSDR-ORSAT von F1NSK.

**AM- und FM-Bericht.** Bei AM, C-QUAM und FM öffnet sich unter dem Analysator stattdessen ein Berichtsfeld für diese Betriebsarten. Hier sagt das Audio des Empfängers wenig über den Sender — der AM-Träger wird aus dem Audio entfernt, und die AGC bestimmt den Pegel —, daher bewertet der Bericht die Station über ein gleitendes Fenster von 20 s vor allem am HF-Spektrum. Bei **AM**: Modulationsgrad (Mittel und Spitze, aus der Leistung der Seitenbänder gegenüber dem Träger), Gleichgewicht der beiden Seitenbänder, Ablage des Trägers von der eingestellten Frequenz, Audiobandbreite, Netzbrummen und belegte Bandbreite. Bei **FM**: Hub (Näherung, aus der 99-%-Bandbreite nach der Carson-Regel), die 99-%-Bandbreite mit dem passenden Kanalraster (12,5 oder 25 kHz), Frequenzablage, Audiobandbreite, gegebenenfalls der CTCSS-Ton und Netzbrummen. Der Wasserfall mittelt jede Zeile über etwa 0,1 s, daher erscheint der Spitzenmodulationsgrad niedriger als auf einem Oszilloskop; ein Träger, der das obere Ende der Wasserfallskala erreicht, ist zu stark zum Messen, und der Bericht sagt das. Die Trägerablage enthält auch den Frequenzfehler des Empfängers selbst. **↺ Restart** und **Generate a listening report** funktionieren wie im SSB-Bericht.

### Transceiver-Steuerung (CAT)

Ihr eigener Transceiver und die Empfängerseite lassen sich auf derselben Frequenz halten: Drehen Sie am Abstimmknopf des Funkgeräts, folgt der Wasserfall – oder klicken Sie auf ein Signal im Wasserfall, und das Funkgerät stimmt darauf ab. Das betrifft nur *Ihre* eigene Hörsitzung; niemand sonst am Empfänger merkt etwas davon.

**Mit Desktop PhantomSDR+ (ab 4.0).** Die Desktop-Anwendung hat ein Menü **Rig**. *Rig → Rig control...* öffnet ein Fenster, in dem Sie Ihr Funkgerät und den Verbindungsweg wählen; das Menü selbst schaltet die Synchronisierung ein und aus. Synchronisiert werden Frequenz, Betriebsart und Filterbreite, in eine Richtung oder in beide, und auf Wunsch wird der Empfänger während des Sendens stummgeschaltet. Neben PhantomSDR-Plus steuert sie auf dieselbe Weise auch Empfänger **KiwiSDR, PA3FWM WebSDR und UberSDR**. Das Funkgerät wird auf einem von vier Wegen erreicht:

- **Integriert** – ohne weitere Software: Icom (CI-V), Yaesu (neues CAT sowie FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs und andere Kenwood-kompatible Geräte.
- **Hamlib** – jedes Funkgerät, das Hamlib kennt, mehr als 300, ausgewählt aus einer durchsuchbaren Liste. Die Windows-Installer enthalten Hamlib; unter Linux installieren Sie `libhamlib-utils`.
- **rigctld im Netzwerk** – ein bereits laufender `rigctld`.
- **flrig** – für ein Funkgerät, das flrig schon mit fldigi, WSJT-X oder einem Logbuch teilt.

Die Anwendung, ihre Installer und das vollständige Handbuch finden Sie unter [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**Mit einem Webbrowser.** Das [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) koppelt ein Funkgerät an die im Browser geöffnete Empfängerseite. Es synchronisiert Frequenz und Betriebsart.

**Filterbreite und Stummschaltung beim Senden** funktionieren mit KiwiSDR-, WebSDR- und UberSDR-Empfängern sowie mit einem PhantomSDR-Plus-Empfänger mit 4.1.0 oder neuer. Bei einem älteren PhantomSDR-Plus werden Frequenz und Betriebsart weiterhin synchronisiert, der Filter nicht.

Das vollständige Handbuch — jede Einstellung, die unterstützten Geräte, wie verhindert wird, dass sich beide Seiten bekämpfen, und die Fehlerbehebung — ist **[Transceiver-Steuerung](RIG_CONTROL.md)**.

**Für Entwickler.** Jede Empfängerseite stellt diese Funktionen auf `window` bereit; beide Werkzeuge nutzen sie:

| Funktion | Wirkung |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Abgestimmte Frequenz in Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Gesamte Durchlassbreite in Hz. Nach der Betriebsart setzen: ein Wechsel der Betriebsart setzt den Durchlassbereich zurück |
| `catsync_getMute()` / `catsync_setMute(on)` | Stummschaltung, über die Stummschalttaste der Seite |
| `catsync_ready` | `true`, sobald die Funktionen installiert sind |

Die letzten drei Zeilen sind mit 4.1.0 hinzugekommen; prüfen Sie vor dem Aufruf, ob eine Funktion vorhanden ist.

---

## Demodulationsarten

### AM (Amplitudenmodulation)

**Verwendet für:**
- Flugfunk
- AM-Rundfunk
- Teile des Amateurfunks
- Seefunk

**Eigenschaften:**
- große Bandbreite (typisch 10 kHz)
- störanfällig
- leicht abzustimmen (einfach auf das Signal klicken)

**Bewährte Praxis:**
- schnelle AGC verwenden
- Störaustaster einschalten, wenn Sie Knacken hören
- auf das Maximum des Signals im Wasserfall abstimmen

### QUAM (C-QUAM-AM-Stereo)

**Verwendet für:**
- Mittelwellensender, die AM-Stereo ausstrahlen

**Eigenschaften:**
- 10 kHz breit, wird als Stereopaar statt als Mono-AM decodiert
- Die Tastenbeschriftung wird von selbst **grün**, sobald der 25-Hz-Stereopilot anliegt — so sehen Sie schon vor dem Umschalten, welche Sender wirklich in Stereo senden
- Aus AM heraus schaltet ein weiterer Druck auf synchrone AM-Demodulation am Träger um; die Beschriftung wird **gelb** und zeigt `SAM`. Ein dritter Druck führt zurück zu einfachem AM
- Solange SAM läuft, erscheint unter den Statusanzeigen eine Zeile wie `SAM +3.2 Hz · 97%` (beim digitalen S-Meter unter VFO | Betriebsart | Bandbreite): wie weit der Träger des Senders von der Abstimmung entfernt ist (+ = darüber) und wie gut der Detektor eingerastet ist — gelb ab 85 %, unter 60 % wieder grau. Gelb heißt nur, dass ein stetiger Träger da ist, nicht welche Betriebsart: Auch ein gewöhnlicher AM-Träger auf einer als DRM markierten Frequenz färbt sie gelb
- C-QUAM-Audio wird mit Opus übertragen, alle anderen Betriebsarten nutzen FLAC

**Bewährte Vorgehensweise:**
- Nachts auf starken Mittelwellensignalen nach der grünen Beschriftung suchen
- Klingt Stereo instabil, ist `SAM` bei schwachem Träger die ruhigere Wahl

### FM (Frequenzmodulation)

**Verwendet für:**
- VHF-/UHF-Amateurfunkrelais
- Behördenfunk (Polizei, Feuerwehr, Rettungsdienst)
- kommerziellen Betriebsfunk
- einige Satellitenverbindungen

**Eigenschaften:**
- schmale Bandbreite (typisch 12,5 oder 25 kHz)
- ausgezeichnete Störfestigkeit
- „Mitnahmeeffekt" (das stärkste Signal setzt sich durch)

**Bewährte Praxis:**
- genau auf die Signalmitte abstimmen
- Rauschsperre nutzen, um im Ruhezustand stummzuschalten
- Rauschminderung ausschalten (nicht nötig)

### USB (oberes Seitenband)

**Verwendet für:**
- KW-Amateurfunk (oberhalb 10 MHz)
- die meisten digitalen KW-Betriebsarten
- Seefunk (oberhalb 8 MHz)

**Eigenschaften:**
- schmale Bandbreite (typisch 2.4 kHz)
- effiziente Spektrumnutzung
- erfordert genaue Abstimmung

**Bewährte Praxis:**
- langsame AGC verwenden
- auf die untere Signalkante im Wasserfall abstimmen
- bei Bedarf Rauschminderung einschalten

### LSB (unteres Seitenband)

**Verwendet für:**
- KW-Amateurfunk (unterhalb 10 MHz)
- einige digitale KW-Betriebsarten
- Seefunk (unterhalb 8 MHz)

**Eigenschaften:**
- wie USB, aber spiegelbildlich
- Konvention: LSB auf den unteren KW-Bändern

**Bewährte Praxis:**
- langsame AGC verwenden
- auf die obere Signalkante im Wasserfall abstimmen
- bei Bedarf Rauschminderung einschalten

### CW (Continuous Wave / Morsetelegrafie)

**Verwendet für:**
- Amateurfunktelegrafie
- Navigationsbaken
- Zeitzeichensender

**Eigenschaften:**
- sehr schmale Bandbreite (100-500 Hz)
- hohe Effizienz
- erfordert Kenntnis des Morsecodes

**Bewährte Praxis:**
- schmales Filter verwenden (400-500 Hz)
- genau auf die Tonmitte abstimmen
- Audiofilter für einen besseren Ton einschalten

### CW-L (CW, unteres Seitenband)

Derselbe ±250-Hz-Morsefilter wie **CW**, der Ton wird aber unterhalb statt oberhalb des Trägers entnommen. Nützlich, wenn ein Signal auf der unteren Seite besser aufzunehmen ist oder ein störender Träger direkt über dem gewünschten liegt.

**Auf der Desktop-Seite gibt es keine CW-L-Taste.** Deren Betriebsartenreihe lautet `USB · LSB · CW · AM · QUAM · FM · IQ`. CW-L wird auf der vereinfachten Seite `/mobile` angeboten; am Desktop lässt es sich weiterhin über einen Link oder ein Lesezeichen setzen, das es benennt.

Auch für KiwiSDR oder UberSDR geschriebene Links funktionieren: `modulation=CWU` (oder `CW-U`) öffnet in CW, `modulation=CWL` in CW-L.

### WBFM (Breitband-FM)

**Verwendet für:**
- UKW-Rundfunk (88-108 MHz)
- einige Satelliten-Downlinks

**Eigenschaften:**
- sehr große Bandbreite (200 kHz)
- ausgezeichnete Tonqualität
- hohe Wiedergabetreue

**Bewährte Praxis:**
- genau auf die Mittenfrequenz abstimmen
- für Rundfunk keine Rauschsperre nötig
- genießen Sie den hochwertigen Klang!

### IQ (rohes I/Q)

**Verwendet für:**
- einen Ausschnitt des Bandes aufzuzeichnen und später in HDSDR, SDR#, SDR++ oder SDRuno abzuspielen
- das Hören mit einem anderen Programm — auch ein KiwiSDR-Client kann es anfordern

**Eigenschaften:**
- 12 kHz des Bandes um die Abstimmung, als I und Q — als Stereo zu hören, I links und Q rechts, so wie ein KiwiSDR es abspielt. Es klingt wie Rauschen: Es ist das Signal vor jeder Demodulation
- verlustfrei übertragen (FLAC), nie mit Opus, das das I/Q zerstören würde
- der Pegel folgt dem Band: Rauschen bleibt leise (etwa −45 dBFS), ein starker Sender wird auf etwa −20 dBFS gebracht. NR, NB, NS, AN, AI und die Rauschsperre wirken nicht, und die Wahl von IQ schaltet einen laufenden Decoder ab
- **Audio** unter *Recording Options* zeichnet das I/Q auf; nach dem Stoppen speichert **Download IQ** es als WAV-Datei (16 Bit Stereo, 12 kHz), zum Beispiel `PhantomSDR_20261026_031500Z_6030000Hz_IQ.wav`. HDSDR, SDR# und SDRuno lesen Frequenz und Uhrzeit aus der Datei, SDR++ aus dem Namen, so dass die Aufnahme schon abgestimmt öffnet
- die Station entscheidet: Die Taste erscheint nur, wo `[server] iq` eingeschaltet ist (die Voreinstellung)

**Bewährte Praxis:**
- den gewünschten Sender in die Mitte legen — die Aufnahme umfasst ±6 kHz um die Abstimmung
- um einen Sender zu hören, ist eine normale Betriebsart einfacher; IQ ist für Aufnahmen, für andere Software und um mehrere Sender zugleich zu hören (unten)

#### IQ-Demodulatoren

Solange der Empfänger in IQ ist, öffnet sich unter den Decodern ein Feld **IQ Demodulators**. Es betreibt bis zu sechs Empfänger auf dem I/Q in Ihrem Browser — der Empfänger wird nicht umgestimmt, und der Rechner der Station hat keine zusätzliche Arbeit:

- Das Bild zeigt die 12 kHz um die Abstimmung mit den echten Frequenzen; jeder Demodulator ist ein farbiges Band, seine eigene Abstimmung eine Linie darin. Ein Klick ins Bild setzt den ausgewählten Demodulator dorthin; das Mausrad darüber verschiebt ihn um 10 Hz (Umschalt 100 Hz)
- Jede Zeile hat die Betriebsart (USB, LSB, CW, AM, DSB, FM), die Frequenz mit den Tasten « ‹ › » (100 und 10 Hz), eine Pegelanzeige, **M** zum Stummschalten und **✕** zum Entfernen. Die ausgewählte Zeile hat zusätzlich **Width**, **Volume** und **Pan**
- **DSB** folgt dem Träger selbst (eine Trägerregelschleife): Auf wenige zehn Hz an den Träger gesetzt, bleibt der Ton sauber und stabil — bei DSB mit unterdrücktem Träger ebenso wie bei AM, wo sie als Synchron-AM arbeitet
- **+ Add** fügt einen Demodulator auf der Abstimmung hinzu, bis zu sechs. **Demodulators** / **Raw I/Q** wählt, ob Sie diese oder das reine I/Q hören
- Sie sind relativ zur Abstimmung gesetzt, das Abstimmen des Empfängers verschiebt also alle zusammen; ein Sender mehr als 6 kHz von der Abstimmung entfernt ist nicht im Datenstrom
- Beispiel: eine DX-Station im Split-Betrieb — ein LSB-Demodulator auf dem DX, nach links gelegt, und einer auf den Rufenden einige kHz höher, nach rechts
- Ihre Demodulatoren merkt sich Ihr Browser. Die Rauschfilter (NR, NB, NS, AN, AI) wirken in IQ nicht: verringern Sie stattdessen **Width**

---

## Digitale Decoder

PhantomSDR-Plus enthält integrierte Decoder für digitale Betriebsarten. Eine vollständige Anleitung finden Sie unter [Decoder](DECODERS.md).

Der schnellste Weg ist die Tastenreihe **Decoders** im Hauptpanel, direkt unter **Wheel Tuning Steps**: zehn Tasten — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, FLDIGI** —, die mit einem einzigen Druck ihren Decoder starten, den Hauptschalter Decoder auf ON stellen und das Fenster des Decoders in den sichtbaren Bereich holen. Die Taste bleibt blau, solange der Decoder läuft; ein erneuter Druck stoppt den Decoder und schließt sein Fenster. Das Dropdown-Menü **Decoder Options** funktioniert weiterhin genau wie bisher und bleibt mit den Tasten synchron.

**RADE-v2U**, **RADE-v1L** und **RADE-v1U** (RADE Digital Voice) haben eigene Tasten neben der Überschrift **Modes** sowie in den Popup-Fenstern **Modes** und **Bands** und arbeiten nach demselben Prinzip: drücken zum Starten, erneut drücken zum Stoppen. **RADE-v2U** startet RADE V2 (beta), immer in USB; **RADE-v1L** und **RADE-v1U** starten RADE v1.

Die Decoder für SSTV, HF-FAX, NAVTEX, FSK/RTTY und CW laufen jeweils in einem eigenen Hintergrund-Thread, sodass das Ein- oder Ausschalten eines Decoders den Ton nie unterbricht und der Wasserfall während des Dekodierens flüssig bleibt. Sie erhalten das Audiosignal vor der Rauschminderung und Stummschaltung Ihres Browsers – Sie können den Empfänger stummschalten, und die Dekodierung läuft unbeeinflusst weiter. Solange ein Decoder geöffnet ist, wird die AGC auf Slow gehalten, damit die Verstärkung für ihn gleichmäßig bleibt.

**Solange ein Decoder läuft, hält er Betriebsart und Durchlassbereich.** Normalerweise folgt die Betriebsart dem Bandplan — stimmen Sie in einen als LSB oder AM markierten Abschnitt, schaltet der Empfänger um. Ein laufender Decoder setzt sich darüber hinweg und behält die Betriebsart und den schmalen Durchlassbereich, die er braucht, selbst wenn Sie auf ein anderes Band gehen. Die bandeigene Betriebsart kehrt zurück, sobald Sie den Decoder abschalten, und die Mode-Schaltflächen greifen jederzeit, wenn Sie übernehmen wollen. Der CW-Decoder ist die Ausnahme: Er dekodiert in der Betriebsart, in der Sie gerade hören.

### FT8-, FT4-Decoder

**Was ist FT8, FT4?**
- weit verbreitete digitale Amateurfunk-Betriebsart
- Verbindungen mit schwachen Signalen
- 15-Sekunden-Aussendungen bei FT8, 7,5-Sekunden-Aussendungen bei FT4

**Anwendung:**
1. Stimmen Sie auf FT8- oder FT4-Frequenzen ab
2. Wählen Sie die Betriebsart USB
3. Aktivieren Sie den FT8-Decoder — drücken Sie die Taste **FT8** oder wählen Sie ihn über das Menü
4. Beobachten Sie, wie die dekodierten Meldungen erscheinen

**Übliche FT8-Frequenzen (USB):**
- 160 Meter: 1.840 MHz
- 80 Meter: 3.573 MHz
- 60 Meter: 5.357 MHz
- 40 Meter: 7.074 MHz
- 30 Meter: 10.136 MHz
- 20 Meter: 14.074 MHz
- 17 Meter: 18.100 MHz
- 15 Meter: 21.074 MHz
- 12 Meter: 24.915 MHz
- 10 Meter: 28.074 MHz
- 6 Meter: 50.313 MHz (50.323 MHz für DX)

**Übliche FT4-Frequenzen (USB):**

- 80 m: 3.575 MHz
- 40 m: 7.0475 MHz
- 30 m: 10.140 MHz
- 20 m: 14.080 MHz
- 17 m: 18.104 MHz
- 15 m: 21.140 MHz
- 12 m: 24.919 MHz
- 10 m: 28.180 MHz
- 6 m: 50.318 MHz

---

### JS8-Decoder

**Was ist JS8?**
- FT8s Schwachsignal-Engine, genutzt für Gespräche von Tastatur zu Tastatur
- Freier Text statt fester Meldungen: lange Nachrichten kommen über mehrere Zyklen
- Fünf Geschwindigkeiten; **Normal** (15 s) ist die Anruf-Geschwindigkeit und trägt fast allen Verkehr

**Bedienung:**
1. Auf eine JS8-Frequenz abstimmen
2. **USB** wählen
3. Den JS8-Decoder einschalten — Taste **JS8** oder Auswahl im Menü
4. **Speed** auf *Normal* und den Sync-Regler auf **Auto** lassen

**Das Fenster lesen:**
- Noch eintreffende Nachrichten stehen oben in Grün mit blinkendem Cursor — bei Normal kann eine Nachricht eine volle Minute brauchen
- Fertige Nachrichten darunter als `Mode | Hz | dB | Message`, **Rufzeichen in Grün**
- Eine blasse, kursive Zeile lief ab, bevor der letzte Rahmen ankam: der Text ist echt, kann aber abgeschnitten sein

**Übliche JS8-Frequenzen (USB):**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 ist viel ruhiger als FT8 — eine Aussendung alle paar Minuten ist normal, Pausen sind kein Fehler. Vollständige Anleitung: [Decoder](DECODERS.md).

---

### CW-Decoder
Drücken Sie einfach die CW-Schaltfläche, und der dekodierte Text erscheint. Drücken Sie die CW-Schaltfläche erneut, um das Fenster zu leeren und den Decoder neu zu starten.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, ausgesprochen „whisper") ist eine Bakenbetriebsart für extrem schwache Signale, die KW-Ausbreitungswege weltweit kartiert. Jede Aussendung dauert etwa 110 Sekunden und passt in einen 200 Hz breiten Kanal. Der Decoder wartet auf einen vollständigen, an UTC ausgerichteten 2-Minuten-Zeitschlitz, bevor er dekodiert. Aktivieren Sie den Decoder und wählen Sie **WSPR** aus der Auswahlliste. Oder drücken Sie einfach die Taste **WSPR**.

---

### HF-FAX / WEFAX

HF-Radiofax (auch WEFAX genannt) wird von Küstenwachen und Wetterdiensten weltweit genutzt, um Wetterkarten, Seegangskarten und Bodenanalysen über Kurzwelle auszustrahlen. Der Decoder setzt das Bild Zeile für Zeile zusammen, während es empfangen wird.

---

### NAVTEX

NAVTEX ist das internationale seefunkgestützte Aussendungssystem für küstennahe Sicherheitsinformationen – Navigationswarnungen, Wettervorhersagen sowie Such- und Rettungsmeldungen.

---

### FLDIGI — RTTY, PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet und APRS

Ein Fenster für die schmalbandigen Tastatur-Betriebsarten, die fldigi bekannt gemacht hat, mit dreizehn Varianten: maritimes FSK (SITOR), Wetter-RTTY, Amateur-RTTY, **PSK31** (Phasenumtastung, 31,25 Baud), **Olivia** und **MFSK16/32/64** (Mehrtonverfahren mit Vorwärtsfehlerkorrektur), **DominoEX** und **THOR** (inkrementelle Frequenzumtastung, THOR mit Fehlerkorrektur), **THROB**, **Hellschreiber** (als Bild gemalt), **MT63** (64 Träger), **Packet (AX.25)** und **APRS**. Es öffnet sich über die Schaltfläche **FLDIGI** oder über **FLDIGI** im Decoder-Menü; fldigi selbst wird nicht benötigt. Das Bedienfeld passt sich der Variante an — die Regler für Shift, Baud und Rahmung verschwinden bei allen außer den drei FSK-Varianten, und die übrigen Betriebsarten ergänzen einen Mode-Wähler und, außer Hellschreiber, einen Squelch-Regler.

Amateur-RTTY und Wetter-RTTY haben einen Regler **Squelch (SNR)**, der verhindert, dass Rauschen als zufällige Buchstaben ausgegeben wird, und alle Varianten außer Olivia zeigen eine echte SNR auf derselben 3-kHz-Skala. Zwei Dinge sind wichtig: PSK31 korrigiert seinen Abstimmfehler über etwa ±25 Hz selbst, Sie müssen also nur in die Nähe kommen; Olivia braucht einen **Mode** (Töne / Bandbreite), der exakt zur Aussendung passt, sendet keine Präambel und benötigt daher einige Sekunden zur Synchronisierung, bevor Text erscheint. Das Bedienfeld startet mit Olivia **8 / 250**. Für die übrigen fldigi-Betriebsarten legen Sie das Signal auf die Mittenfrequenz oder drücken **⟳ Auto-tune Center** und wählen den passenden **Mode**: THROB muss auf ±3 Hz genau abgestimmt sein, DominoEX, THOR und MT63 verzeihen viel mehr, und MFSK, THOR und MT63 geben den Text einige Sekunden nach dem Signal aus. Hellschreiber zeigt ein Bild, keinen Text.

**Packet** gibt jeden gehörten AX.25-Frame aus, wie ein TNC-Monitor; **APRS** macht aus APRS-Paketen Klartext — Position mit Locator, Geschwindigkeit, Höhe, Wetter, Nachrichten, Objekte und Status. Wählen Sie die **Speed**: **1200 Bd** für VHF/UHF, wobei der Empfänger auf **FM** im Kanal umschaltet (144,800 MHz für Europa steht in der Frequenzliste), oder **300 Bd** für KW, in USB. Nur Pakete mit korrekter Prüfsumme werden ausgegeben, auf einem ruhigen Kanal erscheint also nichts. Unter dem Text zeigt eine Karte alle gehörten Stationen mit Position, mit Spuren für bewegte Stationen und Ihrem Empfänger in Bernstein; sie lässt sich verkleinern, und ein Klick auf eine dekodierte Zeile zoomt auf diese Station. Siehe das [Decoder-Handbuch](DECODERS.md#hinweise-zu-packet-und-aprs).

---

### QRSS-Grabber

QRSS ist CW, das so langsam gesendet wird, dass ein einzelner Punkt Sekunden dauert; es wird angesehen statt gehört — der Grabber zeichnet die Spur auf seiner eigenen Anzeige. Er steht nicht im Decoder-Auswahlmenü, sondern hat einen eigenen Bereich **QRSS** und kann gleichzeitig mit einem Decoder laufen.

Drücken Sie **🐌 Show**, wählen Sie dann ein Fenster aus der Liste **Band** und drücken Sie **Tune**: Der Empfänger geht in **CW** auf diese Frequenz, mit einem für die Betriebsart passenden Durchlassbereich, und die Spur landet auf der Mittellinie der Anzeige. 30 m (10.140,00 kHz) ist das belebteste Fenster. Stellen Sie **Speed** passend zur Bake ein — **QRSS 10**, wenn Sie es nicht wissen — und haben Sie Geduld: Ein Rufzeichen kann zehn Minuten brauchen, um über den Schirm zu wandern. Einzelheiten in [Decoder](DECODERS.md).

---

### SSTV

Slow-Scan-Television überträgt Standbilder Zeile für Zeile über einen gewöhnlichen SSB-Kanal. Aktivieren Sie den Decoder, wählen Sie **SSTV** und stimmen Sie auf eine SSTV-Frequenz ab – 14.230 MHz ist die wichtigste internationale Anruffrequenz. Belassen Sie **Mode** auf **Auto**: Der Decoder liest den VIS-Kopf der Aussendung und bestimmt die Betriebsart notfalls anhand des Synchronisationstimings, falls Sie erst nach dem Kopf eingestiegen sind. Die Modi Martin, Scottie und Robot werden unterstützt, und das Bild baut sich Zeile für Zeile auf. Oder drücken Sie einfach die Taste **SSTV**.

### Automatisches Spot-Reporting und Systemgraphen

FT8-, FT4- und WSPR-Dekodierungen kann auch der Server selbst hochladen — FT8/FT4 an PSK Reporter, WSPR an WSPRnet — über einen Autorun-Daemon, den der Sysop im Admin-Panel startet. Er ist von den Decodern in Ihrem Browser unabhängig: er läuft weiter, ob jemand zuhört oder nicht, und nichts, was Sie im Browser dekodieren, wird gemeldet.

Der Sysop verfolgt ihn über zwei Zähler, die leicht zu verwechseln sind: Die Kacheln je Decoder zählen die seit dem letzten Start des Daemons hochgeladenen Spots, während die Zahl neben dem Kontrollkästchen jedes Bands bzw. jeder Betriebsart der Gesamtwert seit Beginn ist und Neustarts übersteht. Dasselbe Panel enthält eine Seite **Graphen**, die CPU-Takt, CPU-Last, CPU-Temperatur und Nutzer online über die letzten 15 Minuten bis 24 Stunden darstellt. Beides beschreibt das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md).


---

## Tastenkürzel

Tastenkürzel für zügigeres Arbeiten.

---

### Frequenzsteuerung

Die **Pfeiltasten** stimmen von überall auf der Seite ab:

- **Pfeil hoch / runter**: ±10 Hz; mit **Shift** ±1 kHz, mit **Ctrl** (oder **Cmd**) ±100 kHz, mit **Shift + Ctrl** ±1 MHz
- **Pfeil links / rechts**: ±100 Hz; mit **Shift** ±10 kHz, mit **Ctrl** (oder **Cmd**) ±500 kHz, mit **Shift + Ctrl** ±10 MHz
- **Rechte Ctrl-Taste**: verwirft die Nachkommastellen und stimmt auf das volle kHz auf oder unter der aktuellen Frequenz ab

Im Chatfeld bewegen Links / Rechts stattdessen den Cursor.

**Maus auf der Frequenzanzeige**: Zeigen Sie auf eine Ziffer; Rad nach oben oder Linksklick erhöht sie, Rad nach unten oder Rechtsklick verringert sie, jeweils um den Stellenwert der Ziffer (neun Ziffern, 100 MHz bis 1 Hz). Zwischen den Ziffern schrittet das Rad mit der Abstimmschrittweite des Bandes (1 kHz, sofern der Bandplan nichts anderes vorgibt); **Shift** für 1 kHz, **Alt** für 10 kHz. Ein Klick an eine andere Stelle des schwarzen Frequenz-/S-Meter-Kastens öffnet den Ziffernblock (Methode 2 unter *Auf eine Frequenz abstimmen*).

**Mausrad über dem Wasserfall**: zoomt. Mit **Ctrl** (oder **Cmd**) bzw. **Shift** wird stattdessen abgestimmt, mit **Shift + Ctrl** auf volle kHz gerundet.

> Page-Up- / Page-Down-Kürzel gibt es nicht.

---

## Lesezeichen

Speichern Sie Ihre Lieblingsfrequenzen für den schnellen Zugriff. Sie können die Lesezeichenliste auch exportieren, lokal speichern und anschließend in ein beliebiges anderes PhantomSDR importieren.

Wenn sich Lesezeichen und Marker überlappen:

🔵 Blaue Lesezeichen erscheinen oben <br /> 🟡 Gelbe Marker erscheinen darunter <br />
✅ Klicks auf Lesezeichen haben Vorrang <br />


### Ein Lesezeichen hinzufügen

1. Auf die gewünschte Frequenz abstimmen
2. Auf die Schaltfläche „Bookmarks" klicken
3. Auf „Add Bookmark" klicken
4. Eine Beschreibung eingeben
5. Auf „Save" klicken

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Verwendung:

**Lesezeichen hinzufügen:**
- Name: „Local News Station"
- Label: „NEWS"
- Auf Add klicken

**Anzeige im Wasserfall:**
- hineinzoomen, bis die Marker erscheinen
- ein marineblauer Kasten mit „NEWS" in fettem Gelb erscheint

**Lesezeichen anklicken:**
- stimmt auf die Frequenz ab
- stellt die Demodulationsart ein
- funktioniert genau wie ein Klick auf einen Marker

### Lesezeichen verwalten
- **Bearbeiten**: auf das Stiftsymbol neben dem Lesezeichen klicken
- **Löschen**: auf das Papierkorbsymbol neben dem Lesezeichen klicken
- **Exportieren**: Lesezeichen als JSON-Datei herunterladen
- **Importieren**: Lesezeichen aus einer JSON-Datei hochladen

### Lesezeichen weitergeben

1. Auf „Export Bookmarks" klicken
2. Die JSON-Datei an andere weitergeben
3. Die Empfänger klicken auf „Import Bookmarks"
4. Sie wählen Ihre Datei aus
---

## Nutzung auf Mobilgeräten

PhantomSDR-Plus funktioniert hervorragend auf Mobilgeräten!

### Zwei mobile Ansichten

Es gibt zwei Wege, den Empfänger auf dem Telefon zu benutzen:

- **`http://ihr_server:PORT/mobile`** — die vereinfachte Seite. Kein Wasserfall, dadurch etwa halb so viel Datenverbrauch. Frequenzeingabe, Abstimmschritte, Betriebsarten, S-Meter, Bänder, Lesezeichen, Benutzerliste und Chat.
- **Die erweiterte Ansicht** — das Telefon-Layout der Hauptoberfläche, mit Wasserfall und dem vollen Umfang der Bedienelemente.

Gewechselt wird mit den Schaltflächen am unteren Rand von `/mobile` (**Mobile extended view**, **Full desktop view**) und mit **Simplified mobile** in der erweiterten Ansicht.

**Ihre Frequenz kommt mit.** Ein Ansichtswechsel lässt Sie auf demselben Signal — Frequenz und Betriebsart reisen im Link mit, Sie landen also nicht mehr auf der Standardfrequenz des Empfängers. Auch die Adresszeile folgt Ihrer Abstimmung: Neuladen, ein Lesezeichen oder ein an jemanden verschickter Link führen genau auf diese Frequenz zurück.

**Die Betriebsart folgt auf beiden Seiten dem Bandplan.** Stimmen Sie in ein Segment ab, das als AM, LSB, USB oder CW eingetragen ist — durch Eingeben einer Frequenz, schrittweises Abstimmen oder eine Bandtaste — schaltet der Empfänger auf diese Betriebsart um, auf der vereinfachten Seite ebenso wie in der vollen Oberfläche. Eine von Hand gewählte Betriebsart bleibt bestehen, solange Sie sich innerhalb desselben Segments bewegen; außerhalb der definierten Bänder wird Ihre Betriebsart nicht angetastet. Während **RADE** (RADEL/RADEU) läuft, behält es den Empfänger, sodass das Abstimmen den Decoder nicht unterbricht.

Beim Wechsel zwischen den beiden Ansichten kommt Ihre aktuelle Betriebsart mit; kennt die Zielansicht sie nicht, entscheidet der Bandplan für diese Frequenz — eine Rundfunkfrequenz kommt in AM an, 40 m in LSB, ein CW-Segment in CW. `SAM` auf der vereinfachten Seite wird in der erweiterten Ansicht zu AM mit dem Synchrondemodulator und umgekehrt. `RADEL` und `RADEU` gibt es nur auf der vereinfachten Seite; wechseln Sie von dort weg, bleibt die Frequenz erhalten und der Bandplan wählt die Betriebsart.

Eine Frequenz außerhalb des Empfangsbereichs wird auf die nächste Bereichsgrenze gezogen, ein alter Link kann Sie also nie außerhalb des Bandes stranden lassen.

### Besonderheiten auf Mobilgeräten

- **Fingerfreundliche Bedienelemente**: große Schaltflächen und Regler
- **Wischen zum Abstimmen**: nach links/rechts über den Wasserfall wischen
- **Zwei-Finger-Zoom**: den Wasserfall zum Vergrößern/Verkleinern aufziehen
- **Querformat**: für eine bessere Ansicht drehen
- **Spektrum und Wasserfall in Telefongröße**: In der erweiterten Ansicht sind beide höher, als es die Proportionen der Desktop-Seite ergäben

### Tipps für Mobilgeräte

1. **WLAN nutzen**: Audiostreaming verbraucht Datenvolumen
2. **Querformat**: bessere Sicht auf den Wasserfall
3. **Kopfhörer**: bessere Tonqualität
4. **Favoriten als Lesezeichen**: erleichtert das Wiederfinden von Stationen
5. **Andere Apps schließen**: sorgt für flüssigen Betrieb

### Empfohlene mobile Browser

- **Android**: Chrome oder Samsung Internet
- **iOS**: Mozilla
- **Beide**: achten Sie darauf, dass der Browser aktuell ist

---

## Tipps und bewährte Praktiken

### Für besten Empfang

1. **Starke Signale wählen**: achten Sie auf Orange/Rot im Wasserfall
2. **Genau abstimmen**: direkt auf die Signalmitte klicken
3. **Richtige Betriebsart wählen**: passend zum Signaltyp
4. **AGC einstellen**: schnell für AM, langsam für SSB
5. **NR/NB nutzen**: hilfreich bei störreichen Bedingungen

### Aktivität finden

1. **Den Wasserfall beobachten**: die Farben zeigen die Signalstärke
2. **Auf beliebten Frequenzen hören**:
   - 40 m: 7.100-7.300 MHz (LSB)
   - 20 m: 14.200-14.350 MHz (USB)
   - 2 m: 145.200-145.600 MHz (FM)
3. **Bandplan-Overlay prüfen**: zeigt die Frequenzzuweisungen
4. **Lesezeichen nutzen**: schneller Zugriff auf aktive Frequenzen

### Ausbreitungsbedingungen verstehen

**Kurzwelle tagsüber:**
- die höheren Bänder funktionieren besser (20 m, 15 m, 10 m)
- Weitverbindungen (DX) sind möglich
- Rundfunkstationen sind hörbar

**Kurzwelle nachts:**
- die niedrigeren Bänder funktionieren besser (80 m, 40 m)
- andere Ausbreitungsmuster
- andere Stationen sind hörbar

**VHF/UHF:**
- überwiegend Sichtverbindung
- örtlicher Funkverkehr
- gleichmäßigere Bedingungen

### Umgangsformen

1. **Blockieren Sie den Empfänger nicht**: andere möchten auch hören
2. **Nutzen Sie den Chat respektvoll**: seien Sie höflich zu anderen Nutzern
3. **Melden Sie Probleme**: helfen Sie dem Betreiber, die Station zu pflegen
4. **Fragen Sie nicht nach technischem Support**: dies ist eine Hörplattform. Schreiben Sie dem SysOp, wenn Sie Hilfe brauchen.

---

## Fehlerbehebung

### Kein Ton

**Mögliche Ursachen:**
1. Browser stummgeschaltet → Lautstärkeregelung des Browsers prüfen
2. System stummgeschaltet → Lautstärke des Rechners prüfen
3. Schwaches Signal → auf ein stärkeres Signal abstimmen (S7+)
4. Falsche Betriebsart → andere Demodulationsarten ausprobieren

**Lösungen:**
1. Auf ein starkes Signal klicken (orange/rot im Wasserfall)
2. Prüfen, ob der Browser nicht stummgeschaltet ist (Stummsymbol im Tab)
3. Eine andere Frequenz ausprobieren
4. Die Seite neu laden (F5)

### Verzerrter Ton

**Mögliche Ursachen:**
1. Übersteuertes Signal → Signal zu stark
2. Falsche Betriebsart → AM-Signal in SSB gehört usw.
3. Störungen → Nachbarsignale strahlen ein

**Lösungen:**
1. Lautstärke verringern
2. Eine andere Demodulationsart ausprobieren
3. Ein schmaleres Filter verwenden
4. Von störenden Signalen wegstimmen

### Ton bricht ab oder hinkt hinterher

**Mögliche Ursachen:**
1. Unregelmäßige Verbindung → Pakete kommen zu spät, und der Puffer läuft leer
2. Ausgelastetes Telefon oder ausgelasteter Computer → der Browser kommt nicht hinterher

**Lösungen:**
1. Erhöhen Sie den Puffer um eine Stufe (siehe *Audiopuffer und Verzögerung*)
2. Ziehen Sie WLAN oder Kabel mobilen Daten vor
3. Schließen Sie andere Tabs und Apps

Für einen genaueren Blick öffnen Sie die Seite mit angehängtem `?diag=1` (zum Beispiel `http://your_server:PORT/mobile?diag=1`). Die Seite /mobile zeigt dann unter ihren Bedienelementen die Verzögerung, wie unregelmäßig die Verbindung ist und wie es um den Puffer steht; die Desktop-Seite schreibt dieselbe Zeile alle zehn Sekunden in die Browserkonsole (F12). Nützlich, wenn Sie dem Betreiber der Station ein Problem melden.

### Wasserfall wird nicht aktualisiert

**Mögliche Ursachen:**
1. Netzwerkproblem → langsame oder unterbrochene Verbindung
2. Browserleistung → zu viele geöffnete Tabs
3. Serverüberlastung → zu viele Nutzer

**Lösungen:**
1. Internetverbindung prüfen
2. Nicht benötigte Browser-Tabs schließen
3. Seite neu laden (F5)
4. Später erneut versuchen, wenn weniger Nutzer online sind

### Abstimmen auf eine Frequenz nicht möglich

**Mögliche Ursachen:**
1. Frequenz außerhalb des Bereichs → das SDR deckt diese Frequenz nicht ab
2. Falsches Eingabeformat → richtiges Format verwenden (z. B. „14200" statt „14.200.000")

**Lösungen:**
1. Frequenzabdeckung des SDR prüfen (auf der Seite angegeben)
2. Die angegebenen Formatbeispiele verwenden
3. Stattdessen in den Wasserfall klicken

### Stotternder/abgehackter Ton

**Mögliche Ursachen:**
1. langsame Internetverbindung
2. hohe Serverlast
3. Leistungsprobleme des Browsers

**Lösungen:**
1. Andere Anwendungen schließen, die Bandbreite verbrauchen
2. Außerhalb der Stoßzeiten erneut versuchen
3. Nicht benötigte Browser-Tabs schließen
4. Kabelverbindung statt WLAN verwenden

---

## Häufig gestellte Fragen

### Allgemeine Fragen

**F: Brauche ich besondere Ausrüstung, um WebSDR zu nutzen?**
A: Nein! Nur einen Computer oder ein Mobilgerät mit Internetzugang.

**F: Ist die Nutzung von WebSDR kostenlos?**
A: Ja, die meisten WebSDRs sind kostenlos. Sie werden von Freiwilligen betrieben.

**F: Kann ich mit WebSDR senden?**
A: Nein, WebSDR ist reiner Empfang. Senden ist nicht möglich.

**F: Welche Frequenzen kann ich hören?**
A: Das hängt von der Konfiguration des WebSDR ab. Sehen Sie in den Stationsinformationen nach.

**F: Kann ich den Ton aufzeichnen?**
A: Einige Browser erlauben Aufnahmen. Prüfen Sie die Funktionen Ihres Browsers.

### Technische Fragen

**F: Welche Abtastrate verwendet das SDR?**
A: Das ist von Station zu Station verschieden. Sehen Sie auf der Stationsinformationsseite nach.

**F: Wie groß ist die Latenz?**
A: Meist einige Zehntelsekunden zwischen Funksignal und Ihren Lautsprechern: die Verarbeitung im Empfänger, das Netz und der Wiedergabepuffer des Browsers, der sich an Ihre Verbindung anpasst (etwa 100–150 ms auf einem Telefon im heimischen WLAN). Siehe *Audiopuffer und Verzögerung*.

**F: Kann ich mehrere Instanzen nutzen?**
A: Meist ja, das kann den Server aber belasten. Bitte nehmen Sie Rücksicht.

**F: Funktioniert es offline?**
A: Nein, WebSDR erfordert eine Internetverbindung.

**F: Welche Browser werden unterstützt?**
A: Chrome, Firefox, Edge, Safari (jeweils aktuelle Versionen)

### Fragen zur Nutzung

**F: Wie viele Personen können gleichzeitig hören?**
A: Das hängt von der Serverkapazität ab. Oft 50-200 Nutzer und mehr.

**F: Kann ich sehen, was andere hören?**
A: Falls aktiviert, ja. Achten Sie auf die Anzeigen für „andere Nutzer".

**F: Kann ich mit anderen Hörern chatten?**
A: Wenn der Betreiber ihn aktiviert hat. Suchen Sie das Chatfeld; **↪ Reply** beantwortet eine bestimmte Nachricht (siehe *Chat* oben).

**F: Warum ist auf manchen Frequenzen nichts zu sehen?**
A: Auf dieser Frequenz sind gerade keine Signale. Probieren Sie andere!

**F: Was sind die farbigen Bänder im Wasserfall?**
A: Das Bandplan-Overlay mit den Frequenzzuweisungen.

---

## Ressourcen

### Mehr über Funk erfahren

- **Bandpläne**: suchen Sie nach „amateur radio band plan" + Ihre Region
- **Ausbreitung**: informieren Sie sich über die Ausbreitung von KW-Funkwellen
- **Digitale Betriebsarten**: informieren Sie sich über FT8, PSK31, RTTY
- **Amateurfunk**: erwägen Sie, eine Amateurfunkgenehmigung zu erwerben!

### Weitere WebSDRs finden

- **WebSDR-Verzeichnis**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Hilfe erhalten

1. **Stationsbetreiber**: Kontaktdaten auf der Seite prüfen
2. **Nutzerchat**: andere Hörer fragen (falls verfügbar)
3. **Onlineforen**: nach WebSDR-Gemeinschaften suchen
4. **Dokumentation**: dieses Handbuch zurate ziehen!

---

## Anhang: übliche Frequenzen

### KW-Amateurfunkbänder

| Band | Frequenzbereich | Betriebsart | Aktivität |
|------|-----------------|-------------|-----------|
| 160 m | 1.800-2.000 MHz | LSB | nachts/lokal |
| 80 m | 3.500-4.000 MHz | LSB | nachts/regional |
| 40 m | 7.000-7.300 MHz | LSB | tags/nachts/DX |
| 30 m | 10.100-10.150 MHz | USB | nur Daten/CW |
| 20 m | 14.000-14.350 MHz | USB | tagsüber/DX |
| 17 m | 18.068-18.168 MHz | USB | tagsüber/DX |
| 15 m | 21.000-21.450 MHz | USB | tagsüber/DX |
| 12 m | 24.890-24.990 MHz | USB | tagsüber/DX |
| 10 m | 28.000-29.700 MHz | USB | sporadisch/DX |

### VHF-/UHF-Amateurbänder

| Band | Frequenzbereich | Betriebsart | Aktivität |
|------|-----------------|-------------|-----------|
| 6 m | 50.000-54.000 MHz | USB/FM | sporadisch |
| 2 m | 144.000-148.000 MHz | FM | sehr rege |
| 70 cm | 420.000-450.000 MHz | FM | rege |

### Rundfunkbänder

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| AM-Rundfunk | 530-1710 kHz | AM |
| Kurzwelle | 2.3-26.1 MHz | AM |
| UKW-Rundfunk | 88-108 MHz | WBFM |

### Luftfahrt

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| Flugsicherung | 118-137 MHz | AM |
| ACARS (Daten) | 130-136 MHz | Daten |

### Seefunk

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| UKW-Seefunk | 156-162 MHz | FM |
| KW-Seefunk | 2-22 MHz | USB |

---

## Glossar

**AGC**: automatische Verstärkungsregelung – passt die Audiopegel automatisch an

**AM**: Amplitudenmodulation – Sprechfunkart für Luftfahrt und Rundfunk

**Bandbreite**: der Frequenzbereich eines Signals

**CW**: Continuous Wave – Morsesignale

**DX**: Weitverbindung

**FFT**: schnelle Fourier-Transformation – wandelt den Zeit- in den Frequenzbereich

**FLDIGI**: das Decoder-Fenster für RTTY, PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet und APRS, benannt nach dem Programm fldigi, das diese Betriebsarten bekannt gemacht hat

**FM**: Frequenzmodulation – Sprechfunkart für VHF/UHF

**HF**: Kurzwelle (3-30 MHz) – Bänder für große Entfernungen

**kHz**: Kilohertz (1.000 Hz)

**LSB**: unteres Seitenband – Sprechfunkart für die unteren KW-Bänder

**MHz**: Megahertz (1.000.000 Hz)

**NB**: Störaustaster – entfernt Impulsstörungen

**NR**: Rauschminderung – vermindert Hintergrundrauschen

**PSK**: Phasenumtastung – digitale Betriebsart

**RTTY**: Funkfernschreiben – digitale Textbetriebsart

**S-Meter**: Signalstärkeanzeige

**SDR**: Software Defined Radio

**SQL**: Rauschsperre – schaltet den Ton bei fehlendem Signal stumm

**SSB**: Einseitenband (USB oder LSB)

**USB**: oberes Seitenband – Sprechfunkart für die oberen KW-Bänder

**VHF**: Ultrakurzwelle (30-300 MHz) – Sichtverbindung

**UHF**: Dezimeterwelle (300-3000 MHz) – Sichtverbindung

**Wasserfall**: visuelle Darstellung des Funkspektrums über die Zeit

---

**Viel Freude beim Erkunden des Funkspektrums mit PhantomSDR-Plus!**

**73 (beste Grüße) de SV1BTL, 9A7AOF, F1NSK & SV2AMK**

Installationsanweisungen finden Sie in [INSTALLATION.md](INSTALLATION.md). Technische Einzelheiten finden Sie in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
