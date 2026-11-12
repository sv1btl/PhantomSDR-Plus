# PhantomSDR-Plus — Benutzerhandbuch der Decoder

Dieses Handbuch behandelt alle in PhantomSDR-Plus integrierten Decoder. Alle Decoder werden auf dieselbe, nachfolgend beschriebene Weise aktiviert; danach folgen die Einrichtungsanweisungen für jeden einzelnen Decoder.

---

## Inhaltsverzeichnis

1. [Einen Decoder starten](#1-einen-decoder-starten)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morsetelegrafie](#5-cw--morsetelegrafie)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF-FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet und APRS](#10-fldigi--ale-2g-rtty-psk31-olivia-fst4w-mfsk-msk144-dominoex-thor-throb-hellschreiber-mt63-packet-und-aprs)
11. [SSTV](#11-sstv)
12. [SERVICES](#12-services)
13. [DRM](#13-drm)
14. [Allgemeine Tipps](#14-allgemeine-tipps)

---

## 1. Einen Decoder starten

Alle Decoder erreichen Sie über den Abschnitt **Decoder Options** unterhalb der Bedienelemente des Audiospektrogramms im Hauptfenster.

**Schritte:**

1. Klicken Sie auf die Schaltfläche **Decoder: OFF**, um sie auf **Decoder: ON** umzuschalten (sie wird blau, wenn sie aktiv ist).
2. Öffnen Sie das Auswahlmenü, das rechts neben der Schaltfläche erscheint, und wählen Sie den gewünschten Decoder.
3. Das Bedienfeld des gewählten Decoders erscheint unterhalb der Bedienelemente — folgen Sie den decoderspezifischen Anweisungen im entsprechenden Abschnitt dieses Handbuchs.
4. Um die Dekodierung zu beenden, wählen Sie **— Select decoder —** aus dem Menü, oder klicken Sie auf **Decoder: ON**, um wieder auf OFF zu schalten.

### Decoder-Tasten mit einem Druck

Das Dropdown-Menü ist nicht der einzige Weg. Das Hauptpanel enthält eine Tastenreihe **Decoders** — direkt unter **Wheel Tuning Steps** — mit einer Taste je Decoder:

| Taste | Decoder | Taste | Decoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **FLDIGI** | ALE 2G HAM, RTTY, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (Flugzeuge), Maritimes FSK / SITOR, Wetter-RTTY, Marine-RTTY (PBB), DSC (Schiffe), Zeitzeichen, HF Selcall, ALE 2G |
| **WSPR** | WSPR | **DRM** | DRM — digitaler Rundfunk |

Ein Tastendruck erledigt den ganzen Ablauf: Er wählt den Decoder aus, schaltet den Decoder ON und holt sein Fenster in den sichtbaren Bereich. Die Taste leuchtet blau, solange ihr Decoder läuft. **Ein erneuter Druck auf dieselbe Taste schaltet den Decoder ab** — sein Fenster schließt sich mit.

**RADE-v2U**, **RADE-v1L** und **RADE-v1U** fehlen in dieser Reihe absichtlich. Sie sind Digital-Voice-Betriebsarten und keine Text-Decoder, deshalb haben sie eigene Tasten neben der Überschrift **Modes** sowie in den Popup-Fenstern **Modes** und **Bands**. Diese verhalten sich genau gleich — drücken zum Starten, erneut drücken zum Stoppen. Siehe das [RADE-Handbuch](RADE_README.md). **RADE-v2U** startet RADE V2 (beta), immer in USB; **RADE-v1L** und **RADE-v1U** starten RADE v1.

Die Tasten, das Dropdown-Menü und die ON/OFF-Taste steuern denselben Zustand — was Sie auch benutzen, das Übrige folgt.

Wo ein Decoder eine eigene Frequenzliste hat — die QRSS-Liste **Band**, die Stationen von HF FAX und NAVTEX, die FLDIGI-Liste **Known frequency** und die Stationslisten von SERVICES und DRM —, rahmt seine Tune-Taste das Band zusätzlich so ein wie **To Band**: Der Wasserfall zeigt das ganze Band der Station, mit Helligkeit, Kontrast und Abstimmschritt dieses Bandes. Das Band richtet sich nach der gelisteten Frequenz der Station, nicht nach der Skala, sodass 10100,800 kHz (DWD-Wetter-RTTY) auf 30 m öffnet, obwohl die Skala knapp unter 10100 kHz steht.

### Einen Decoder über eine Frequenzmarkierung starten

Eine Frequenzmarkierung (die gelben Beschriftungen über dem Wasserfall, aus `markers.json`) stimmt den Empfänger normalerweise ab und stellt die darin eingetragene Betriebsart ein. Ist diese Betriebsart der Name einer digitalen Betriebsart, startet ein Klick auf die Markierung stattdessen deren Decoder, genau so, als hätten Sie dessen Taste gedrückt:

| Betriebsart der Markierung | Startet | Die Frequenz der Markierung ist |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | diesen Decoder | die Skalenfrequenz |
| `NAVTEX` | NAVTEX | die Signalfrequenz (die Skala geht 500 Hz tiefer) |
| `FAX`, `WEFAX` | HF-FAX | die veröffentlichte Mittenfrequenz (die Skala geht 1900 Hz tiefer) |
| `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR` | FLDIGI als Amateur-RTTY (`RTTY`); SERVICES mit Wetter-RTTY, Marine-RTTY (PBB CARB) oder maritimem FSK / SITOR | die Signalfrequenz (die Skala geht um die Audiomitte des Panels tiefer) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI in dieser Variante | wie oben |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI in dieser Variante und Unterbetriebsart | wie oben |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI in dieser Variante und Unterbetriebsart | wie oben |
| `PACKET`, `APRS` | FLDIGI in dieser Variante | der Kanal; 300 Bd (USB) unter 30 MHz, 1200 Bd (FM) darüber |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 im oberen / unteren Seitenband (`RADE` und `FREEDV` bedeuten oberes) | die Dial-Frequenz |
| `RADE2` | FreeDV RADE V2 (beta), immer oberes Seitenband | die Dial-Frequenz |
| `HFDL` | SERVICES · HFDL | die Skalenfrequenz (USB; das HFDL-Signal liegt 1440 Hz darüber) |
| `DSC`, `SELCALL` | SERVICES mit DSC oder HF Selcall | die DSC-Frequenz bzw. der Selcall-Kanal (die Skala geht 1,7 kHz darunter) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES mit Time Signals, mit diesem Sender | der Träger (die Skala geht 1 kHz darunter) |
| `ALE` | FLDIGI mit ALE 2G HAM auf einem HFLINK-Kanal, sonst SERVICES mit ALE 2G | die Skalenfrequenz (LSB bei den Netzen, die es verwenden) |
| `DRM` | DRM | die Mitte des DRM-Kanals |
| `MORSE` | den CW-Decoder, mit CW und einem ±250-Hz-Filter | die Signalfrequenz |

Ein bereits laufender Decoder bleibt an. `CW` bleibt eine normale Empfänger-Betriebsart, da Baken und Stationen sie verwenden — sie startet nicht den CW-Decoder. Markierungen werden nur angezeigt, solange der Wasserfall 3,5 MHz oder weniger umfasst. Der Decoder stellt seine eigene Betriebsart und sein eigenes Filter ein, wie beim Start über seine Schaltfläche. Um den CW-Decoder von einer Markierung aus zu starten, geben Sie ihr den Modus `MORSE`. Decoder-Marker für jeden Decoder werden in `frequencylist/decodermarkers.json` mit PhantomSDR-Plus ausgeliefert; ein eigener Marker in `mymarkers.json` auf derselben Frequenz hat immer Vorrang.

> Es kann immer nur ein Decoder aktiv sein. Der Wechsel zu einem anderen Decoder beendet den vorherigen automatisch.
>
> Der **QRSS-Grabber** gehört nicht zu diesem Auswahlmenü — er hat einen eigenen Bereich **QRSS** und kann gleichzeitig mit einem Decoder laufen.

**Die Dekodierung läuft im Hintergrund.** SSTV, HF-FAX, NAVTEX, SERVICES, FLDIGI und CW laufen jeweils in einem eigenen Web-Worker-Thread, sodass die Dekodierarbeit nie mit der Audiowiedergabe oder dem Wasserfall konkurriert. Das Starten oder Beenden eines Decoders unterbricht den Ton nicht, und die Oberfläche bleibt reaktionsschnell, während ein Bild oder eine Seite empfangen wird. Alle Decoder erhalten Rohaudio, das *vor* Rauschminderung und Stummschaltung abgegriffen wird — den Empfänger stummzuschalten oder diese Einstellungen nach Gehör zu verändern, wirkt sich also nicht auf die Dekodierung aus. Mit der AGC ist es anders: Der Empfänger wendet sie an, bevor der Ton Ihren Browser erreicht, die Decoder teilen sie also mit Ihnen. Solange irgendein Decoder geöffnet ist, wird sie deshalb auf **Slow** gehalten, egal welche AGC-Taste gewählt ist, und der kleine Hinweis *Slow (decoder)* neben der AGC-Überschrift zeigt das an; Ihre eigene Wahl kehrt zurück, wenn der letzte Decoder geschlossen wird. DRM ist die Ausnahme: Es wird auf dem Server der Station decodiert (Kapitel 13).

**Ein laufender Decoder besitzt Betriebsart und Durchlassbereich.** Normalerweise folgt die Betriebsart dem Bandplan in `bands-config.js`: Fährt die Abstimmung in einen als LSB oder AM gekennzeichneten Abschnitt, schaltet der Empfänger um. Solange ein Decoder läuft, geschieht das nicht mehr. Der Decoder hält die Betriebsart, die er braucht (USB bei den meisten, eine eigene bei RADE), und den Durchlassbereich, den er braucht — PSK31 etwa ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber und MT63 ihre volle Bandbreite, RTTY seinen Shift — und beides überlebt ein Umstimmen, auch den Sprung auf ein anderes Band. Ohne das würde FT8 auf 40 m den Empfänger auf LSB umschalten, sobald die Abstimmung bewegt wird, und die schmalen Decoder-Durchlassbereiche würden wieder auf das volle SSB-Filter aufgehen.

Die bandeigene Betriebsart kehrt in dem Moment zurück, in dem Sie den Decoder abschalten. Von Hand können Sie die Betriebsart jederzeit überstimmen: Die Mode-Schaltflächen sind eine bewusste Entscheidung und setzen sich immer durch. Der CW-Decoder hält auf dieselbe Weise **CW** (CW-L bleibt CW-L), und die Verbindung gilt in beide Richtungen: Wer den CW-Decoder startet, schaltet den Empfänger auf CW, und ein Klick auf **CW** in der Betriebsartenwahl startet den CW-Decoder. Nur der CW Browser verwendet USB, 200–3000 Hz.


### Decoder ID — die Betriebsart automatisch erkennen

Über den Decoder-Tasten liegt das Feld **Decoder ID**. Es beantwortet die Frage *„Was höre ich da eigentlich?"*, wenn Sie auf ein digitales Signal stoßen, das Sie nicht einordnen können, und bietet anschließend den passenden Decoder mit einem Klick an.

Es ist **standardmäßig ausgeschaltet** und kostet im ausgeschalteten Zustand nichts. Drücken Sie **On** und lassen Sie das Signal eingestellt. Etwa eine halbe Minute lang zeigt es *Listening…* mit einem Fortschrittsbalken — die Zeitmessungen müssen zwei vollständige FT8-Zyklen sehen, bevor sie aussagekräftig sind — und benennt dann die Betriebsart:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* Die **Betriebsart** und ein **Vertrauenswert**. Grün über 75 %, gelb über 50 %, orange darunter — eine orange Antwort ist ein Hinweis, kein Urteil.
* **Was tatsächlich gemessen wurde**: belegte Bandbreite, Tonabstand, Symbolrate, Burst-Länge, das passende UTC-Raster, Signal-Rausch-Abstand. Das ist die Beweisgrundlage hinter dem Urteil, damit Sie selbst urteilen können.
* **Use <Betriebsart>** startet den richtigen Decoder, genau so, als hätten Sie dessen Taste gedrückt — und richtet dabei den Empfänger auf diese Betriebsart ein. Bei den Betriebsarten im FSK-Panel wird zusätzlich die richtige Variante gewählt — RTTY, PSK31 oder Olivia in FLDIGI, Wetter-RTTY in SERVICES.
* Die nächstplatzierten Kandidaten stehen nach **or**. Ein Klick probiert stattdessen diesen aus — eine falsche erste Antwort kostet Sie also nichts.
* **📻** bedeutet, dass die eingestellte Frequenz eine bekannte Anruffrequenz für diese Betriebsart ist und dass dies in die Bewertung eingeflossen ist.

Es schaltet Ihren Decoder niemals selbst um. Es schlägt immer nur vor. Und sobald Sie einen Decoder starten — über die Tastenreihe, über die Auswahlliste oder über die Schaltfläche **Use** der Decoder ID — schaltet sich die Decoder ID selbst ab: ihre Aufgabe war es, einen auszuwählen, und der Decoder braucht nun dasselbe Audiosignal.

**Es richtet den Empfänger auf die Betriebsart ein.** Eine Betriebsart zu wählen heißt, sie auch arbeiten zu wollen, also folgt der Empfänger: Die Abstimmfrequenz rückt in die Mitte des Wasserfalls und die Ansicht wird rund 100 kHz breit, das Seitenband wird das, auf dem diese Betriebsart gearbeitet wird, und der Durchlassbereich verengt sich auf das Fenster, in dem diese Betriebsart lebt — das gesamte 3-kHz-Teilband für FT8, FT4, FT2 und JS8, 1350–1650 Hz für WSPR, 250–750 Hz für NAVTEX, 800–2700 Hz für HF-FAX, 900–2600 Hz für SSTV und ±250 Hz beiderseits der Abstimmfrequenz für CW, wobei zusätzlich auf CW umgeschaltet wird. Ein schmaler Durchlassbereich hält die Nachbarsignale aus dem Decoder heraus — genau das, was Sie von Hand getan hätten. Zwei Ausnahmen: SSTV behält das Seitenband, das es selbst gewählt hat — auf 80 und 40 m üblicherweise LSB, wo ein erzwungenes USB die Tonzuordnung umkehren würde — und die FSK-Betriebsarten behalten das Fenster, das ihr eigenes Panel aus Shift oder Bandbreite der Variante ableitet und das enger ist als jeder feste Wert. Ein Druck auf **Use** beim bereits laufenden Decoder schaltet ihn weiterhin ab; der Empfänger bleibt dann genau so, wie er war.

**Die langsamen Betriebsarten brauchen länger.** WSPR liegt auf einem Zwei-Minuten-Raster und SSTV-Bilder laufen ein bis zwei Minuten, deshalb werden diese beiden später benannt als die übrigen — geben Sie ihnen drei bis vier Minuten auf der Frequenz. HF-FAX und SSTV werden außerdem nur erkannt, wenn sie wie üblich abgestimmt sind — das Bildband liegt dann bei etwa 1500 bis 2300 Hz im NF-Bereich, dort, wo es auch ihre Decoder erwarten. Ein Frequenzwechsel startet die Messung von vorn, denn alles bisher Gesammelte beschreibt die gerade verlassene Frequenz.

**Was es erkennt:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY mit 45,45 Bd, Wetter-RTTY (DWD), PSK31, Olivia, HF-FAX, SSTV und DSC. **Use DSC** und der Vorschlag Wetter-RTTY starten SERVICES mit diesem Dienst (Kapitel 12).

**Recentre & retry.** Wo das Signal im NF-Durchlassbereich liegt, spielt zwischen etwa 400 Hz und 2700 Hz keine Rolle. Außerhalb dieses Bereichs verschlechtert sich die Messung, und eine gelbe Schaltfläche **Recentre & retry** erscheint. Ein Druck darauf verschiebt die Abstimmung so, dass das Signal in der Mitte des Durchlassbereichs liegt, und startet eine neue Messung. Das ist ein einzelner berechneter Schritt, keine Suche.

**Drei ehrliche Grenzen:**

* **FT8, JS8 und FT2 sind dasselbe Signal.** Dieselbe 8-FSK-Modulation, derselbe Tonabstand, und JS8 verwendet bei Normal-Geschwindigkeit den 15-Sekunden-Takt von FT8. Am Signal selbst lassen sie sich nicht unterscheiden. An der Frequenz schon: auf einer FT8-Anruffrequenz meldet es FT8, auf einer JS8-Frequenz JS8, und überall sonst meldet es ehrlich die Familie — *FT8 / JS8 / FT2*. Starten Sie einen der beiden Decoder und sehen Sie, welcher Text liefert. FT2 hat einen eigenen, schnelleren Rhythmus (3,75 s), der nicht gemessen wird; ein FT2-Signal wird daher meist gar nicht benannt.
* **Es schweigt lieber, als zu raten.** Unterhalb von etwa 10 dB Signal-Rausch-Abstand meldet es *Nothing above the noise* oder *Not recognised*, statt eine Betriebsart zu benennen, die es nicht wirklich erkennen kann. Das ist Absicht: eine selbstbewusst falsche Antwort ist schlimmer als gar keine. Die 10 dB gelten über die Breite des Signals selbst, schmale Betriebsarten reichen daher viel tiefer: in einer üblichen Empfängerbandbreite von 2,5 kHz wird FT8 bis etwa −5 dB erkannt, FT4 bis etwa 0 dB, WSPR und CW bis etwa −10 dB.
* **Ein schwankendes Signal wird anders gelesen.** WSPR sendet 110 Sekunden ohne Unterbrechung, also länger als ein gewöhnlicher QSB-Einbruch dauert. Ein tiefer Schwund zerschneidet die Aussendung deshalb in Stücke, und ihr Zwei-Minuten-Takt lässt sich daraus nicht mehr ablesen. Er wird dann auf einem anderen Weg zurückgewonnen: Der gesamte Beobachtungszeitraum wird gegen das Zwei-Minuten-Raster geprüft statt gegen einzelne Aussendungen. In der Messzeile steht dann *120 s grid (through fading)*. Das ist ein schwächerer Beleg als eine vollständig gehörte Aussendung, deshalb ist die angezeigte Sicherheit bewusst geringer. Ein Schwund, der das Signal ganz im Rauschen versinken lässt, ist gar nicht mehr zu retten. Olivia ist strenger als die übrigen: Sie wird erst benannt, wenn ihre Symbolrate gemessen ist, und verstummt daher früher.

---

## 2. FT8

**Worum es geht:** FT8 ist eine weit verbreitete digitale Schwachsignal-Betriebsart, die Funkamateure weltweit nutzen. Aussendungen dauern genau 15 Sekunden, und das Protokoll kann Signale bis 20–25 dB unter dem Rauschteppich aufnehmen. Es ist die am häufigsten genutzte Betriebsart für Weitverbindungen (DX).

### Empfohlene Frequenzen (USB)

| Band | Frequenz |
|------|----------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Einrichtung

1. Stimmen Sie auf eine der oben genannten FT8-Frequenzen ab und stellen Sie die Betriebsart auf **USB**.
2. Aktivieren Sie den Decoder und wählen Sie **FT8** aus dem Menü. Oder drücken Sie einfach die Taste **FT8**.
3. Das Bedienfeld **FT8 Messages** erscheint automatisch darunter.

### Die Ausgabe lesen

Die Meldungsliste zeigt dekodierte Aussendungen, sobald sie eintreffen. Jeder 15-Sekunden-Zyklus liefert einen neuen Schwung Meldungen. Das Feld **Farthest** (oben rechts im Bedienfeld) zeigt die größte in der laufenden Sitzung dekodierte Entfernung in Kilometern. Eine lange Meldung endet mit „…“: Ein Klick auf ihre Zeile zeigt die ganze Meldung umbrochen an, ein zweiter Klick schließt sie wieder. Solange eine Zeile offen ist, bleibt die Liste stehen; sonst folgt sie den neuesten Meldungen. FT4 und FT2 verwenden dieselbe Liste.

Typisches Meldungsformat: `CQ DX AA1BB FN31` — ein CQ-Ruf des Rufzeichens AA1BB aus dem Planquadrat FN31.

Die **SNR** bei jeder Dekodierung ist ein echter Signal-Rausch-Abstand, gemessen am dekodierten Signal gegenüber dem umgebenden Rauschen und auf 2500 Hz Bandbreite bezogen, so wie WSJT-X sie angibt. Schwache Stationen zeigen negative Werte bis etwa −20 dB, starke positive; auf denselben Aufnahmen stimmen beide Programme im Mittel überein, bei einer einzelnen Dekodierung typisch auf etwa 3 dB. FT4 und FT2 verwenden dasselbe Verfahren.

**Belebte Bänder und schwache Stationen.** Jede dekodierte Station wird aus dem Audio herausgerechnet und der Rest erneut dekodiert, bis zu dreimal, wie es WSJT-X macht — so kommt auch eine Station heraus, die unter einer stärkeren daneben verborgen war; auf Aufnahmen echter Bänder findet der Decoder 86–88 % dessen, was WSJT-X findet. Gibt die normale Fehlerkorrektur bei einem schwachen FT8-Signal auf, versucht es eine tiefere (Ordered-Statistics-Decoding) noch einmal; sie unterliegt strengen Prüfungen, damit aus Rauschen keine erfundenen Meldungen werden. FT4 und FT2 nutzen das Herausrechnen ebenfalls.

> **Nach einem Update:** Der FT8/FT4/FT2-Decoder ist eine eigene Datei, die Browser lange zwischenspeichern. Liegen alle SNR-Werte weiterhin zwischen etwa 0 und +5 dB, laden Sie die Seite hart neu (**Strg+Umschalt+R**, auf dem Mac **Cmd+Umschalt+R**).

> **Tipp:** FT8 ist eng zeitsynchronisiert. Ihr Browser nutzt die Uhr Ihres Rechners; weicht die Systemzeit um mehr als ein paar Sekunden ab, schlägt die Dekodierung fehl. Halten Sie Ihre Systemzeit per NTP synchron.

---

## 3. FT4-FT2

**Worum es geht:** FT4 ist eine schnellere Variante von FT8, gedacht für Contest-Betrieb. Jeder Sendezyklus dauert 7,5 Sekunden (die Hälfte von FT8), wodurch die Betriebsart doppelt so schnell ist, aber ein etwas stärkeres Signal benötigt. FT2 ist eine noch schnellere Variante von FT8. Es handelt sich um eine ultraschnelle 77-Bit-Betriebsart mit TR-Perioden von 3,75 Sekunden (= die Hälfte von FT4) — noch experimentell.

### Empfohlene Frequenzen (USB)

| Band | Frequenz FT4|
|------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Band | Frequenz FT2|
|------|-----------|
|160 m | 1.843 bis 1.846 |
|80 m   | 3.578 bis 3.581 |
|60 m   | 5.360 (regionale Vorschriften beachten) |
|40 m   | 7.052 bis 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Einrichtung

1. Stimmen Sie auf eine FT4-Frequenz ab und stellen Sie die Betriebsart auf **USB**.
2. Aktivieren Sie den Decoder und wählen Sie **FT4** oder **FT2** aus dem Menü. Oder drücken Sie einfach die Taste **FT4** / **FT2**.
3. Das Bedienfeld **FT4 Messages** bzw. **FT2 Messages** erscheint darunter, im Aufbau identisch mit dem FT8-Bedienfeld.

> **Hinweis:** FT4 und FT8 verwenden unterschiedliche Spektralformate und sind nicht austauschbar. Achten Sie darauf, dass Sie auf einer FT4-Frequenz stehen, wenn Sie diesen Decoder nutzen.

> **Uhr:** FT4 und FT2 dekodieren auch, wenn die Uhr Ihres Computers oder der Audioweg bis zu etwa einer Sekunde nachgeht (FT2 etwa 0,9 s); das Timing des Decoders korrigiert sich dann anhand der Dekodierungen selbst.

---

## 4. JS8

**Was es ist:** JS8 (der Modus von JS8Call) nimmt die Schwachsignal-Engine von FT8 und macht daraus einen Tastatur-zu-Tastatur-Gesprächsmodus. Während FT8 feste Nachrichten mit 13 Zeichen sendet, überträgt JS8 freien Text in kleinen Portionen und fügt aufeinanderfolgende Aussendungen wieder zu ganzen Sätzen zusammen — alles über etwa zwölf Zeichen kommt also über mehrere 15-Sekunden-Zyklen an. Die Empfindlichkeit entspricht etwa der von FT8, sodass er dort funktioniert, wo Sprache und CW nicht mehr durchkommen.

### Empfohlene Frequenzen (USB)

| Band | Frequenz |
|------|----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Geschwindigkeiten

JS8 kennt fünf Geschwindigkeiten. Alle Stationen eines Gesprächs müssen dieselbe verwenden. **Normal** ist die Anruf-Geschwindigkeit und trägt fast den gesamten Verkehr — dort beginnen.

| Geschwindigkeit | Zyklus | Bandbreite | Wofür |
|-----------------|--------|------------|-------|
| Slow   | 30 s | 25 Hz  | Sehr schwache Wege; am empfindlichsten |
| Normal | 15 s | 50 Hz  | Die übliche Anruf-Geschwindigkeit |
| Fast   | 10 s | 80 Hz  | Schnellerer Austausch, braucht stärkeres Signal |
| Turbo  | 6 s  | 160 Hz | Starke lokale Signale |
| Ultra  | 4 s  | 250 Hz | Experimentell, kaum auf dem Band zu sehen |

### Einrichtung

1. Auf eine JS8-Frequenz abstimmen und **USB** einstellen.
2. Decoder einschalten und **JS8** aus der Liste wählen, oder einfach die Taste **JS8** drücken.
3. Das Fenster **JS8 Decoder** erscheint darunter. **Speed** auf *Normal* stehen lassen, sofern die gesuchte Station nicht nachweislich eine andere benutzt.

### Die Ausgabe lesen

Das Fenster hat zwei Listen.

**Noch eintreffende Nachrichten** stehen oben in Grün mit blinkendem Cursor. Eine JS8-Nachricht kann vier Zyklen dauern — bei Normal eine volle Minute — hier sieht man den Satz entstehen. Es ist kein Fehler, wenn das eine Weile so bleibt.

**Fertige Nachrichten** füllen die Hauptliste, je eine Zeile:

| Spalte | Bedeutung |
|--------|-----------|
| Mode | Immer `JS8` |
| Hz | NF-Frequenz des Signals im Durchlassbereich |
| dB | Signal-Rausch-Abstand in 2500 Hz Bezugsbandbreite |
| Message | Der dekodierte Text; **Rufzeichen erscheinen grün** |

Typische Nachrichten:

* `SV1BTL KM17: HB` — ein Heartbeat: die Station meldet, dass sie auf dem Band ist, mit ihrem Locator.
* `KN4CRD: K0OG SNR -05` — eine gerichtete Nachricht: KN4CRD teilt K0OG mit, dass er ihn mit −5 dB hört.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — freier Text, hier eine Stationsbeschreibung über vier Zyklen.

Eine **blass und kursiv** dargestellte Zeile ist abgelaufen, bevor ihr letzter Rahmen ankam. Der Text ist echt, kann aber abgeschnitten sein.

### Sync offset

Der Regler **Sync offset** bestimmt, wie lange nach der UTC-Zyklusgrenze die Aufzeichnung beginnt, und gleicht damit die Laufzeit der Audiokette aus. **Auto** aktiviert lassen: der Decoder misst das Timing der empfangenen Signale und stellt sich selbst nach.

### Spektrum-Markierungen

Der kleine Spektrumstreifen im Fenster zeichnet für jedes im letzten Zyklus dekodierte Signal eine gelbe senkrechte Linie, sodass sich die Hz-Spalte direkt am Display ablesen lässt.

### Die eigenen Spots sehen

Wenn der Empfänger JS8-Spots an PSK Reporter meldet (siehe den Reiter Spot Reporting im Admin-Panel), öffnet die Schaltfläche **📡 JS8 map** im Feld **Note:** die Karte von PSK Reporter, gefiltert auf das Rufzeichen dieses Empfängers und den Modus JS8 — genau wie **📡 FT8 map** und **📡 FT4 map** für jene Modi.

> **Tipp:** JS8 ist viel ruhiger als FT8. An einem Nachmittag kann eine Aussendung alle paar Minuten normal sein, ebenso längere Pausen ganz ohne Betrieb. Geben Sie ihm fünf bis zehn Minuten, bevor Sie einen Fehler vermuten. 20m (14.078) und 40m (7.078) sind die üblichen Anlaufstellen.

> **Tipp:** Wie FT8 ist JS8 streng zeitsynchron und nutzt die Uhr Ihres Rechners. Weicht die Systemzeit um mehr als ein bis zwei Sekunden ab, wird nichts dekodiert. Halten Sie sie per NTP synchron.

---

## 5. CW — Morsetelegrafie

**Worum es geht:** Der CW-Decoder horcht auf Morsesignale (Continuous Wave) und wandelt sie in Echtzeit in Text um. Er verfolgt die Signalfrequenz automatisch und passt sich der Gebegeschwindigkeit des Operators an.

### Empfohlene Frequenzen

CW ist auf allen Amateurbändern aktiv, typischerweise im unteren Teil jedes Bandes. Übliche Stellen:

| Band | Segment |
|------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Einrichtung

1. Stimmen Sie auf ein CW-Signal ab. Der Start des Decoders schaltet den Empfänger auf **CW** (CW-L bleibt CW-L); ein Klick auf **CW** in der Betriebsartenwahl startet den Decoder ebenfalls.
2. Aktivieren Sie den Decoder und wählen Sie **CW** aus dem Menü. Oder drücken Sie einfach die Taste **CW**.
3. Das Bedienfeld **CW Decoder** erscheint darunter.

### Die Ausgabe lesen

- Die Kopfzeile des Bedienfelds zeigt die erkannte Signalfrequenz in Hz (z. B. `≈ 700 Hz`) und die geschätzte Gebegeschwindigkeit in Wörtern pro Minute (z. B. `· 22 WPM`).
- Wird kein Signal erkannt, zeigt die Kopfzeile **scanning…**
- Auf einem leeren Kanal wird nichts ausgegeben, und Geschwindigkeit und Ton werden nicht angezeigt. Der Decoder beginnt erst zu schreiben, wenn sich Taste gedrückt und Taste offen deutlich unterscheiden, was reines Rauschen nicht erzeugt, ein bei etwa −10 dB noch lesbares Signal aber reichlich.
- Der dekodierte Text läuft in bernsteinfarbener Festbreitenschrift durch. Der blinkende Cursor (▋) markiert die Stelle, an der gerade geschrieben wird.
- Der Schieberegler **Pitch** vor **Clear** stellt die Tonhöhe des CW-Signals ein, solange der Decoder läuft: 500 bis 800 Hz in 50-Hz-Schritten, 600 Hz, bis Sie ihn ändern. Ihr Browser merkt sich die Einstellung. Auch das normale CW-Hören liegt bei 600 Hz.
- **Save** speichert den dekodierten Text in eine Datei; **Clear** löscht ihn.

> **Tipps:**
> - Zentrieren Sie Ihren Durchlassbereich auf den CW-Ton. Der Decoder arbeitet am besten, wenn das CW-Signal etwa zwischen 400 und 900 Hz im Audiospektrum liegt.
> - Geschwindigkeiten von etwa 8 bis 40 WPM werden gelesen, auch Farnsworth-Gebung (schnell gegebene Zeichen mit längeren Pausen dazwischen): Die Geschwindigkeitsverriegelung hält, und Buchstaben werden nicht in einzelne Wörter zerlegt. Stark handgetastetes (unregelmäßiges) Morsen kann die Genauigkeit weiterhin verringern.
> - Der Decoder liefert die besten Ergebnisse bei einem einzelnen sauberen Signal. Starkes QRM benachbarter Signale auf demselben Band kann ihn verwirren.
> - Fading (QSB) wird verfolgt: Ein Signal, das schwindet und wiederkommt, wird weiter gelesen, und auch das erste Wort einer Aussendung wird gelesen — ebenso am Anfang einer Antwort nach einer Pause im QSO.
> - Jeder Buchstabe wird am Signal selbst entschieden statt an den zuerst gezählten Punkten und Strichen; das halbiert bei schwachen und von Hand gegebenen Signalen etwa die falschen Buchstaben.

### CW Browser — alle Signale gleichzeitig

Schalten Sie im CW-Fenster den Schalter **Browser — all signals** ein, um alle CW-Signale zwischen 200 und 3000 Hz gleichzeitig zu dekodieren, eine Zeile pro Signal, wie bei den PSK- und Olivia-Browsern. Solange er läuft, wird der Empfänger auf **USB** mit einem Filter von 200–3000 Hz gehalten; Ihre eigene Betriebsart und Ihr Filter kehren zurück, wenn Sie ihn ausschalten.

- Jede Zeile zeigt die Frequenz des Signals (den Träger, in kHz), seine Geschwindigkeit, das Rufzeichen der Station — grün mit **CQ**, wenn sie CQ ruft — und ihren Text. Ein Klick auf eine Zeile schaltet auf **CW** auf dieser Station mit dem normalen Decoder.
- Ein Signal erhält seinen eigenen Decoder, sobald es etwa zwei Sekunden lang da ist; die letzten Sekunden werden mit dekodiert, sodass seine ersten Wörter nicht verloren gehen. Hört eine Station auf, bleibt ihre Zeile noch eine Minute stehen.
- Stationen im Abstand von 40 Hz werden getrennt, und Signale bis etwa −6 dB (in 3 kHz) sind gut lesbar. Zeilen, die nicht nach Morsetext aussehen (ein Datensignal, Rauschen), werden nicht gezeigt, ebenso wenig die Tastseitenbänder einer starken Station, die bis etwa 160 Hz beiderseits von ihr aus dem Rauschen ragen können.
- Das Rufzeichen ist das zwei- oder mehrmals gesendete, sonst das nach **DE** oder **CQ**; auseinandergezogene Buchstaben ("Y O 8 B N C") werden wieder zusammengefügt.
- Jede Zeile behält ihre letzten 4000 Zeichen in einem etwa sechs Zeilen hohen Feld: Sobald sie mehr als sechs Zeilen enthält, bekommt sie eine eigene Bildlaufleiste (das Mausrad geht auch), und das Feld bleibt stehen, während Sie lesen. **Save** speichert alle Zeilen — mit Zeit, Frequenz, Geschwindigkeit und Rufzeichen —, auch die bereits entfernten.
- Etwa zwei Dutzend Stationen gleichzeitig kosten rund 10 % eines Prozessorkerns im Browser des Hörers; der Empfänger wird gar nicht belastet.

---

## 6. QRSS Grabber

**Was es ist:** QRSS ist CW, das so langsam gegeben wird, dass ein einzelner Punkt Sekunden statt Millisekunden dauert. Bei dieser Geschwindigkeit belegt das Signal nur einen Bruchteil eines Hertz, sodass eine entsprechend schmale Analyse die Spur noch 20–30 dB *unter* dem Rauschpegel sichtbar macht. Mit dem Ohr ist dabei nichts zu holen — QRSS wird **angeschaut**, nicht angehört. Der Grabber rechnet eine eigene, sehr lange FFT über das Empfängeraudio und zeichnet die klassische Grabber-Darstellung: Frequenz auf der senkrechten Achse, Zeit von links nach rechts laufend, die neueste Spalte immer am rechten Rand.

Das meiste, was Sie sehen werden, stammt von MEPT-Baken (Manned Experimental Propagation Transmitter) — Sender kleinster Leistung, oft ein paar hundert Milliwatt an einem Draht, die sich fortlaufend in sehr langsamem Morse oder in FSK-Mustern identifizieren.

### Wo man suchen muss

QRSS-Baken leben in schmalen Fenstern von 100–200 Hz nahe dem unteren Bandende. Sie müssen sie nicht auswendig kennen: Der Grabber hat eine Liste **Band** mit den unten aufgeführten Fenstern, und eine Auswahl stimmt darauf ab und richtet den Empfänger dafür ein (siehe *Den Grabber öffnen*).

| Band | Fenstermitte | Hinweis |
|------|---------------|------|
| 30m | 10.140,00 kHz | Das Haupt-QRSS-Fenster — mit Abstand das belebteste, Tag und Nacht |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Knights-Fenster, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Älteres Fenster |
| 80m | 3.500,85 kHz | Knights-Fenster, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Älteres Fenster |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | LF-QRSS / DFCW |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Älteres Fenster |
| 10m | 28.322,00 kHz | Alternative |
| 6m | 50.294,30 kHz |  |

Mehrere Bänder erscheinen doppelt, weil tatsächlich zwei Konventionen in Gebrauch sind. Die moderneren Fenster liegen 200 Hz unterhalb der WSPR-Frequenz des jeweiligen Bandes; die älteren *Knights*-Fenster liegen ganz woanders, auf 40 und 80 m deutlich tiefer. Ist ein Band auf dem einen still, versuchen Sie das andere.

Das sind Konventionen, keine Vorschriften, und einige sind regional — besonders die Werte für 10 m schwanken. Nehmen Sie die Liste als Ausgangspunkt und richten Sie sich nach der örtlichen Praxis.

### Den Grabber öffnen

Der QRSS-Grabber steht **nicht** im Decoder-Auswahlmenü. Er hat einen eigenen Bereich **QRSS**, neben den Bedienelementen für Spektrogramm und Decoder.

1. **🐌 Show** anklicken. Die Grabber-Fläche erscheint, und die Bedienelemente klappen neben der Schaltfläche auf.
2. Ein Fenster aus der Liste **Band** wählen und **Tune** drücken. Das erledigt alles, was die Betriebsart braucht, in einem Schritt: Es stimmt auf das Fenster ab, schaltet den Empfänger auf **CW** und setzt einen Durchlassbereich, der gerade breit genug für den beobachteten Ausschnitt ist. Die Anzeige zeigt danach die echte QRSS-Frequenz, und die Spuren landen auf der Mittellinie der Darstellung.
3. **Speed** auf die Punktlänge der Bake einstellen.
4. **Centre** und **Span** wirken wie bisher; eine Änderung formt den Durchlassbereich mit, sodass Anzeige und Empfänger im Gleichschritt bleiben.
5. **🐌 Hide** anklicken, um zu beenden. Die normale Betriebsart des Bandes kehrt zurück.

Von Hand geht es weiterhin auch — in **USB** etwa 1 kHz unterhalb des Fensters abstimmen, damit die Spuren bei rund 800 Hz Audio landen. Die Liste **Band** erspart Ihnen nur die Rechnerei.

Solange ein Fenster aus der Liste abgestimmt ist, hält der Grabber den Empfänger so fest wie ein Decoder: CW und sein Durchlassbereich überleben ein Umstimmen, und das Fenster folgt der Abstimmung, sodass die Spur beim Absuchen des Bandes auf der Mittellinie bleibt. Er gibt den Empfänger frei, sobald Sie den Grabber ausblenden, eine Mode-Schaltfläche drücken oder einen Decoder starten.

### Geschwindigkeiten

| Einstellung | Punktlänge | Auflösung | Analysefenster | Neue Spalte alle |
|-------------|-----------|-----------|----------------|------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

Eine Einstellung, die schneller ist als die Bake, verschenkt Empfindlichkeit — die Spur wird dünn und verrauscht. Eine langsamere Einstellung verschmiert aufeinanderfolgende Punkte und Striche zu einem einzigen Balken. Das Panel startet mit **QRSS 6**, ein sinnvoller Ausgangspunkt bei einem unbekannten Signal: empfindlicher als QRSS 3, dabei schneller in der Anzeige und toleranter gegenüber Drift als QRSS 10. Sobald die Form der Tastung erkennbar ist, wechseln Sie auf die Geschwindigkeit, die die Bake tatsächlich sendet — jede Stufe schneller kostet 3 dB Empfindlichkeit.

### Bedienelemente

| Bedienelement | Wirkung |
|---------------|---------|
| **Band** | Die oben aufgeführten QRSS-Fenster. **Tune** stimmt auf das gewählte ab, in CW mit passendem Durchlassbereich. |
| **Speed** | Legt die Transformationslänge fest — den Kompromiss zwischen Frequenz- und Zeitauflösung (Tabelle oben). |
| **Centre** | Audiofrequenz in der Mitte der Anzeige, 100–3000 Hz. |
| **Span** | Höhe des dargestellten Ausschnitts: 20, 50, 100 oder 200 Hz, beim Start 100 Hz — die Breite eines QRSS-Subbands. Ein schmalerer Ausschnitt verteilt jede Spur auf mehr Pixel. Bei breiteren Ausschnitten fallen mehr Bins in das Panel, als es Pixelzeilen hat; jede Zeile zeigt dann das stärkste von ihr überdeckte Bin, sodass sich nichts zwischen den Zeilen verstecken kann. |
| **Gain** | −10 bis +40 dB. Verschiebt die Farbskala gegenüber dem gemessenen Rauschpegel; erhöhen, um schwache Spuren aufzuhellen. |
| **Color** | Rainbow, Green oder Grayscale. |
| **Clear** | Löscht die Fläche und setzt die Rauschreferenz zurück. |

### Die Anzeige lesen

Die Frequenzmarken laufen am linken Rand, die höchste Frequenz oben. Unter der Fläche zeigt eine Statuszeile die gewählte Geschwindigkeit, die tatsächlich verwendete Auflösung (z. B. `0.183 Hz/bin · 5.5 s window`) und die Spaltenrate (z. B. `2.7 s/column`).

Die Farbskala bezieht sich auf das **aktuelle** Rauschen, das laufend aus den leeren Teilen jeder Spalte gemessen wird, nicht auf einen absoluten Pegel. Änderungen an Lautstärke, AGC, Antenne oder Band erfordern daher keine neue Gain-Einstellung — die Anzeige hält den Kontrast gegenüber dem jeweiligen Bandrauschen konstant. Wie bei den Decodern wird das Audio vor Rauschunterdrückung und Stummschaltung abgegriffen; Sie können den Empfänger also stummschalten und trotzdem weiter zusehen.

Was die Formen bedeuten:

- Ein **konstanter Träger** zeichnet eine gerade waagerechte Linie.
- **Langsames Morsen** zeichnet diese Linie als Kette kurzer und langer Abschnitte — Punkte und Striche, von links nach rechts zu lesen.
- **Gebogene oder wandernde Spuren** stammen von einem nicht stabilisierten Bakenoszillator beim Aufwärmen oder Abkühlen. Das ist normal, und oft ist gerade diese Driftsignatur das, woran ein regelmäßiger Grabber-Beobachter eine Station wiedererkennt.
- **Senkrechte Streifen** über den ganzen Ausschnitt sind Atmosphärics oder lokale Störimpulse, kein Signal.

> **Tipps:**
> - Geduld. Bei QRSS 30 dauert eine einzelne Spalte 5,5 Sekunden, ein vollständiges Rufzeichen braucht also zehn Minuten oder mehr, um über den Schirm zu wandern. Einfach laufen lassen.
> - Beim Abstimmen über die Liste **Band** ist der Durchlassbereich um das Fenster bereits eingeengt. Wer von Hand abstimmt, macht es selbst: Das ändert nichts an dem, was die Transformation auflöst, hält aber starke Nachbarn davon ab, die AGC des Empfängers zu bedienen.
> - Der Grabber ist von den Decodern unabhängig — Sie können ihn laufen lassen, während ein Decoder an etwas anderem arbeitet.
> - Ein breiter Span bei langsamer Geschwindigkeit ist die aufwendigste Kombination; die gesamte Transformation läuft im Browser, auf einer bescheidenen Maschine also besser 50 Hz Span wählen.

---

## 7. WSPR

**Worum es geht:** WSPR (Weak Signal Propagation Reporter, ausgesprochen „whisper") ist eine Bakenbetriebsart für extrem schwache Signale, die KW-Ausbreitungswege weltweit kartiert. Jede Aussendung dauert etwa 110 Sekunden und passt in einen 200 Hz breiten Kanal. Der Decoder wartet auf einen vollständigen, an UTC ausgerichteten 2-Minuten-Zeitschlitz, bevor er dekodiert.

### Empfohlene Frequenzen (USB, Anzeigefrequenz)

| Band | Anzeigefrequenz |
|------|-----------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Einrichtung

1. Stimmen Sie auf eine der oben genannten WSPR-Anzeigefrequenzen ab und stellen Sie die Betriebsart auf **USB**.
2. Das WSPR-Signal belegt den Audiobereich 1400–1600 Hz. Die Auswahl von **WSPR** erledigt den Rest: Der Empfänger schaltet auf USB und der Durchlassbereich verengt sich auf 1350–1650 Hz, was den gesamten Suchbereich des Decoders abdeckt. Weitere Anpassungen sind nicht nötig.
3. Aktivieren Sie den Decoder und wählen Sie **WSPR** aus dem Menü. Oder drücken Sie einfach die Taste **WSPR**.
4. Das Bedienfeld **WSPR-2 Decoder** erscheint darunter.

### Die Ausgabe lesen

Das Bedienfeld zeigt einen Fortschrittsbalken für den aktuellen 2-Minuten-Zeitschlitz:

- **Cyanfarbener Balken füllt sich** — Signaldaten werden gesammelt (0–116 s im Zeitschlitz).
- **Bernsteinfarbener Balken pulsiert** — Dekodierung läuft (letzte ~4 s des Zeitschlitzes).
- **Leerer Balken** — Warten auf die nächste gerade UTC-Minute.

Jeder erfolgreich dekodierte Spot erscheint in einer Tabelle mit folgenden Spalten:

| Spalte | Bedeutung |
|--------|-----------|
| UTC | Zeit des Spots (gerade Minute) |
| Callsign | Die Station, die gesendet hat |
| Grid | Maidenhead-Locator des Senders |
| Power | Sendeleistung in dBm |
| Freq | Genaue Audiofrequenz (Hz) innerhalb des WSPR-Durchlassbereichs |
| SNR | Signal-Rausch-Verhältnis in dB |

Klicken Sie auf **Clear**, um die Spot-Liste zu löschen.

Auf einem belebten Band arbeitet der Decoder wie WSJT-X: Er nimmt bis zu 40 Kandidaten je Zeitschlitz, rechnet jede dekodierte Station heraus und sucht erneut, bis zu drei Durchgänge — so werden auch die schwächeren Stationen zwischen starken gefunden.

> **Tipp:** Die WSPR-Dekodierung erfordert eine sehr genaue Systemzeit (innerhalb ±1 Sekunde zu UTC). Der erste Zeitschlitz nach dem Aktivieren des Decoders beginnt mit der nächsten geraden UTC-Minute — eine kurze Wartezeit ist normal.

---

## 8. HF-FAX / WEFAX

**Worum es geht:** HF-Radiofax (auch WEFAX genannt) wird von Küstenwachen und Wetterdiensten weltweit genutzt, um Wetterkarten, Seegangskarten und Bodenanalysen über Kurzwelle auszustrahlen. Der Decoder setzt das Bild Zeile für Zeile zusammen, während es empfangen wird.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **HF FAX / WEFAX** aus dem Menü. Oder drücken Sie einfach die Taste **FAX**.
2. Das Bedienfeld **HF FAX / WEFAX Receiver** erscheint darunter.
3. **Wählen Sie eine Station** im Auswahlmenü Station. Über 20 Stationen stehen zur Verfügung und decken Europa, Asien, Ozeanien und Amerika ab (z. B. DDH3/DDK3 Deutschland, SVJ4/GR Griechenland, JMH Japan, NMG USA New Orleans). Auch CBM Punta Arenas (Chile) ist dabei. Die Sendepläne folgen dem weltweiten Radiofax-Plan der NOAA (Ausgabe vom 7. März 2025); Charleville (VMC, Australien) enthält seine zusätzlichen Sendungen, die nur auf 11030 kHz laufen.
4. Sendet die Station auf mehreren Frequenzen, wählen Sie die gewünschte im Untermenü **Frequency**.
5. Klicken Sie auf **▶ Tune**, um den Wasserfall automatisch auf diese Station abzustimmen.
6. Die Betriebsart wird automatisch auf **USB** gesetzt.

### Sendeplan

Ist eine Station gewählt, erscheint eine Countdown-Tabelle **Next Transmissions** mit den nächsten 4 geplanten Aussendungen in UTC und einem laufenden Countdown:

- Normal (grau/grün) — die Aussendung steht bevor.
- **Bernstein ⚡** — die Aussendung beginnt in weniger als 3 Minuten; jetzt den Decoder scharfschalten.
- **Rot ●** — die Aussendung beginnt in weniger als 30 Sekunden; der Empfang steht unmittelbar bevor.

### Parameter

Die meisten Stationen verwenden die Standardvorgaben (mit ★ markiert). Ändern Sie sie nur, wenn Sie wissen, dass die Station abweichende Einstellungen nutzt.

| Parameter | Vorgabe | Beschreibung |
|-----------|---------|--------------|
| LPM | 120 ★ | Zeilen pro Minute — die Trommeldrehzahl |
| IOC | 576 ★ | Kooperationsindex — bestimmt die Pixel pro Zeile |
| Shift | 800 Hz ★ | Frequenzhub zwischen Schwarz- und Weißton |

### Bedienelemente

- **⇔ Auto-align** — standardmäßig aktiviert. Synchronisiert automatisch auf das Phasensignal zu Beginn jedes Bildes. Deaktivieren Sie es nur, wenn Sie bei einem nachweislich guten Signal Ausrichtungsprobleme haben.
- **⇅ Invert** — vertauscht Schwarz und Weiß. Verwenden Sie es, wenn das Bild als Negativ erscheint (weiße Flächen dort, wo Schwarz sein sollte).
- **↺ Refresh** — löscht die Zeichenfläche und setzt den Decoder zurück. Nutzen Sie es zwischen zwei Aussendungen oder wenn das Bild reißt oder verläuft.
- **⤓ Save PNG** — speichert die aktuelle Zeichenfläche als PNG-Datei auf Ihrem Rechner.

### Statusanzeigen

Unter dem Bild zeigen zwei Tonanzeigen:

- **300 Hz phasing** — leuchtet cyan, wenn der Phasenton am Bildanfang erkannt wird.
- **450 Hz stop** — leuchtet rot, wenn der Stoppton am Bildende erkannt wird.

Beide Signale werden an ihrem Rhythmus über die ganze Zeilenbreite erkannt, die echte Start- und Stoppsignale immer ausfüllen und Karteninhalte praktisch nie, sodass schraffierte Flächen einer Karte nicht für ein Startsignal gehalten werden. Sie werden bis herab zu etwa 0 dB SNR erkannt, und bei sehr schwachen Signalen wird das Bild aus dem Mittel mehrerer Phasing-Zeilen ausgerichtet, sodass die Karte trotzdem am linken Rand beginnt.

> **Hinweis:** Das Bild läuft nach oben — die zuletzt empfangene Zeile erscheint immer unten auf der Zeichenfläche. Steht **[PHASING]** in der Kopfzeile, hat der Decoder auf einen neuen Bildanfang eingerastet.

---

## 9. NAVTEX

**Worum es geht:** NAVTEX ist das internationale seefunkgestützte Aussendungssystem für küstennahe Sicherheitsinformationen — Navigationswarnungen, Wettervorhersagen sowie Such- und Rettungsmeldungen. Es verwendet 100-Baud-FSK (SITOR-B mit FEC) und wird weltweit auf eigenen Kanälen empfangen.

### Verfügbare Kanäle

| Kanal | Frequenz | Verwendung |
|-------|----------|------------|
| International | 518 kHz | Englischsprachig, international |
| National | 490 kHz | Aussendungen in der Landessprache |
| KW (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | KW-NAVTEX mit großer Reichweite |

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **NAVTEX** aus dem Menü. Oder drücken Sie einfach die Taste **NAVTEX**. Der Empfänger schaltet automatisch auf **USB**.
2. Das Bedienfeld **NAVTEX Receiver** erscheint.
3. Wählen Sie den gewünschten Kanal im Menü **Station** (z. B. `International — 518 kHz`).
4. Klicken Sie auf **⇒ Tune & Set IF**, um den Wasserfall automatisch abzustimmen und den Durchlassbereich auf das richtige Audiofenster einzuengen. Die Betriebsart wird automatisch auf **USB** gesetzt. Die Anzeigefrequenz liegt 500 Hz unter der Kanalmitte, sodass das NAVTEX-Signal bei 500 Hz im Audio erscheint. Die Frequenzanzeige zeigt trotzdem **518.000**: Solange HF FAX, NAVTEX oder das FLDIGI-Fenster aktiv ist, zeigt sie die Frequenz des Signals selbst (die Abstimmfrequenz plus die Audiomitte des Decoders — 1900 Hz bei FAX, 500 Hz bei NAVTEX, die Mitte des Panels bei FLDIGI), und eine dann eingegebene Frequenz gilt als die des Signals.

### Sendeplan

Die Plantabelle listet alle bekannten Stationen des gewählten Kanals mit:

- ihrem ITU-Kennbuchstaben und der Landesflagge
- der nächsten Sendezeit in UTC
- einem laufenden Countdown bis zur nächsten Aussendung
- **Bernstein ⚡** bei unter 2 Minuten / **Rot ●** bei unter 30 Sekunden — jetzt den Decoder scharfschalten

### Die Ausgabe lesen

Der dekodierte Text erscheint in blaugrüner Festbreitenschrift. Die Meldungsgrenzen sind klar markiert:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` markiert den Anfang einer Meldung. Die vier folgenden Zeichen kennzeichnen Station (`M`), Thema (`A` = Navigationswarnungen) und laufende Nummer (`12`). Das Banner wartet auf die vollständige Kopfzeile und lautet daher `ZCZC MA12`, nicht `ZCZC ????`. `NNNN` markiert das Ende.

Stimmen Sie ein, nachdem eine Meldung schon begonnen hat, oder geht ihre Kopfzeile im Rauschen unter, erscheint der Text trotzdem, unter einem Banner **━━ (header missed) ━━**. Es öffnet sich erst, wenn mehrere Zeichen hintereinander eintreffen, bei denen beide NAVTEX-Aussendungen übereinstimmen, was Rauschen praktisch nie erzeugt. Es schließt wie gewohnt bei `NNNN`, mit **━━ (signal lost) ━━**, wenn das Signal vorher verschwindet, oder wenn eine neue Meldung beginnt. Ein schwaches Signal behält seine Synchronisation auch bei verstümmelten Zeichen: Jedes NAVTEX-Zeichen wird zweimal gesendet, deshalb hält der Decoder über Fehler hinweg fest und lässt erst los, wenn das Signal wirklich weg ist; hat er sich ein Bit neben der wahren Zeichengrenze eingerastet, wechselt er auf die richtige, ohne die Meldung zu schließen. Bei −6 dB in 2,5 kHz kommt so etwa doppelt so viel Text durch.

Klicken Sie auf **Clear**, um den Meldungspuffer zu löschen.

> **Hinweis:** NAVTEX arbeitet auf MF- und LF-Frequenzen (518/490 kHz). Die Empfangsreichweite beträgt typischerweise 200–400 Seemeilen vom Sender. Die KW-Kanäle (4–17 MHz) bieten eine deutlich größere Reichweite.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet und APRS

**Worum es geht:** Ein Fenster für die schmalbandigen Tastatur-Betriebsarten, die das Programm fldigi bekannt gemacht hat, mit vierzehn Varianten in einem einzigen Auswahlmenü. Eine davon ist echtes FSK (Frequency-Shift Keying): Amateur-RTTY; seine Verwandten aus dem Gebrauchsfunk, maritimes FSK (SITOR) und Wetter-RTTY, verwenden denselben Decoder in SERVICES (Kapitel 12). Die übrigen teilen sich dasselbe Fenster: **PSK31** (auch **PSK63** und **PSK125**, jeweils als BPSK oder QPSK), eine Phasenumtastung; **Olivia** (mit seinem Verwandten **Contestia**) und **MFSK16/32/64**, Mehrtonverfahren mit Vorwärtsfehlerkorrektur; **DominoEX** und **THOR**, inkrementelle Frequenzumtastung (THOR mit Fehlerkorrektur); **THROB**, zwei Töne gleichzeitig, ein Zeichen pro Impuls; **Hellschreiber**, das Text als Bild malt, statt ihn zu dekodieren; **MT63**, 64 Träger gleichzeitig; sowie **Packet (AX.25)** und **APRS**, die AFSK-Packet-Radio dekodieren — das 1200-Baud-Packet auf VHF/UHF und das 300-Baud-Packet auf KW. Jede Variante bringt eine auf ihre Standardparameter abgestimmte Voreinstellung mit. Schaltfläche und Menüeintrag heißen beide **FLDIGI**; dekodiert wird hier im Browser, fldigi selbst wird nicht benötigt.

Drei der Varianten stammen nicht aus fldigi. **ALE 2G HAM** ist der automatische Verbindungsaufbau (MIL-STD-188-141) des HFLINK-Amateurnetzes und listet dessen Rufe und Soundings; die Netze der Behörden, des Militärs und der Gebrauchsfunkdienste sind unter SERVICES → ALE 2G (Kapitel 12). **FST4W**, die sehr langsame Bakenbetriebsart der Bänder 2200 m, 630 m und 160 m, und **MSK144** für Meteorscatter auf 6 m und 2 m stammen aus WSJT-X. Keine der drei gibt fortlaufenden Text aus: Jede listet, was sie dekodiert, Zeile für Zeile, mit der Zeit.

### Varianten und Voreinstellungen

| Variante | Mitte | Shift | Baud | Rahmen | Kodierung |
|----------|-------|-------|------|--------|-----------|
| Amateur-RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31·63·125 (BPSK/QPSK) | 1000 Hz | — | 31.25 / 62.5 / 125 | — | Varicode |
| Olivia / Contestia | 1000 Hz | — | siehe Mode | — | 7 Bit + FEC |
| FST4W | 1500 Hz | — | 1,46 / 0,56 / 0,18 / 0,09 | T/R 120–1800 s | LDPC + CRC-24 |
| MFSK16·32·64 | 1500 Hz | — | siehe Mode | — | Varicode + FEC |
| MSK144 | 1500 Hz | — | 2000 bit/s | T/R 15 / 30 s | LDPC + CRC-13 |
| DominoEX | 1500 Hz | — | siehe Mode | — | Nibble-Varicode |
| THOR | 1500 Hz | — | siehe Mode | — | Varicode + FEC |
| THROB / THROBX | 1500 Hz | — | 1, 2 oder 4 | — | Tonpaare |
| Hellschreiber | 1500 Hz | — | siehe Mode | — | Bild |
| MT63 | 1000 Hz (unterster Träger bei 500 Hz) | — | 5, 10 oder 20 | — | Walsh + Interleaving |
| ALE 2G | 1625 Hz (Töne 750–2500 Hz) | — | 125 | 24-Bit-Wörter, ×3 | Golay (24,12) |
| Packet (AX.25) | Töne 1200 / 2200 Hz, oder 1700 Hz bei 300 Bd | 1000 Hz, oder 200 Hz bei 300 Bd | 1200 oder 300 | HDLC | AX.25 |
| APRS | wie Packet | wie Packet | 1200 oder 300 | HDLC | AX.25 + APRS |

Das Bedienfeld passt sich der gewählten Variante an. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** und **Auto shift detect** werden bei allen Varianten außer den FSK-Varianten (Amateur-RTTY sowie maritimes FSK und Wetter-RTTY in SERVICES) ausgeblendet, da keine der übrigen Betriebsarten ein Mark/Space-Tonpaar oder eine UART-artige Rahmung besitzt. Stattdessen wird **Center audio** zu einem frei beschreibbaren Zahlenfeld (das Signal kann überall im Durchlassbereich liegen), und Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber und MT63 erhalten jeweils einen **Mode**-Wähler und — alle außer Hellschreiber — einen **Squelch**-Regler mit eigener Skala. Packet und APRS blenden dieselben FSK-Regler aus und zeigen stattdessen eine Auswahl **Speed**; APRS hat zusätzlich das Kästchen **Show raw packet**. Die Liste **Known frequency** erscheint nur bei den Varianten, die eine haben. ALE 2G HAM ersetzt all dies durch eigene Listen für **Netz** und **Kanal** (siehe seine Hinweise). FST4W und MSK144 haben weder **Mode** noch **Squelch**; sie zeigen stattdessen **T/R period** und **F Tol** (MSK144 auch **Decode**), und **⟳ Auto-tune Center** ist bei beiden ausgeblendet, weil sie den ganzen **F Tol**-Bereich selbst absuchen.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **FLDIGI** aus dem Menü. Oder drücken Sie einfach die Schaltfläche **FLDIGI**.
2. Das Decoder-Bedienfeld erscheint. Sein Titel richtet sich nach der Variante — *FSK / RTTY Decoder*, *BPSK31 Decoder* (bzw. die gewählte PSK-Betriebsart), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* oder *APRS Decoder*. ALE 2G HAM zeigt *ALE 2G HAM Decoder*; FST4W nennt seine Periode, z. B. *FST4W-120 Decoder*; MSK144 zeigt *MSK144 Decoder*.
3. Wählen Sie die **Variant**. Die Parameter werden automatisch aktualisiert.
4. Stellen Sie bei PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber und MT63 den **Mode** passend zur Aussendung ein — siehe die Hinweise zur jeweiligen Betriebsart weiter unten. Wählen Sie bei Packet und APRS die **Speed** — siehe die Hinweise zu Packet und APRS weiter unten. Wählen Sie bei ALE 2G ein Netz und einen Kanal; stellen Sie bei FST4W und MSK144 **T/R period** und **F Tol** ein — siehe deren Hinweise unten.
5. Wo die Variante eine hat, wählen Sie im Menü **Known frequency** eine gebräuchliche Frequenz und klicken Sie dann auf **Tune**, um dorthin zu springen. Die übrigen Betriebsarten haben keine festen Anruffrequenzen: Suchen Sie das Signal im Wasserfall und benutzen Sie **⟳ Auto-tune Center**.
6. Feinabstimmen, bis der dekodierte Text stabil und lesbar wird.

### Bekannte Frequenzen nach Variante

**Amateur-RTTY**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3583 kHz (80 m), 7040 kHz (40 m), 7072,5 kHz (40 m), 10143 kHz (30 m), 14072,5 kHz (20 m), 14108,5 kHz (20 m, 32/1000), 18099 kHz (17 m), 21072,5 kHz (15 m), 24922,5 kHz (12 m), 28122,5 kHz (10 m)

**FST4W** (die Signalmitte; die USB-Skala geht 1,5 kHz darunter)
- 137,5 kHz (2200 m, Skala 136,000), 475,7 kHz (630 m, Skala 474,200), 1838,1 kHz (160 m, WSPR-Teilband, Skala 1836,600)

**MSK144** (ebenso: die Skala geht 1,5 kHz darunter)
- Skala 144,360 MHz (2 m, IARU-Region 1), 144,150 MHz (2 m, Nordamerika), 50,260 und 50,280 MHz (6 m), 70,230 MHz (4 m), 28,145 MHz (10 m)

**MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63**
- Keine festen Anruffrequenzen; die Liste wird nicht angezeigt. Suchen Sie das Signal im Wasserfall.

**Packet und APRS** (dieselbe Liste für beide; jeder Eintrag stellt auch die passende Geschwindigkeit ein)
- 144,800 MHz — APRS in Europa (IARU Region 1)
- 144,390 MHz — APRS in Nordamerika
- 145,175 MHz — APRS in Australien
- 144,640 MHz — APRS in China
- 144,660 MHz — APRS in Japan
- 145,825 MHz — der Packet-Digipeater der ISS
- 10147,6 kHz — KW-APRS auf 30 m, USB-Skalenfrequenz (300 Bd)

### Parameter

| Parameter | Gilt für | Beschreibung |
|-----------|----------|--------------|
| Center audio (Hz) | alle | Die Audiofrequenz der Mitte zwischen Mark und Space; bei PSK31 der Träger, bei den Mehrtonverfahren die Mitte des Tonblocks bzw. der Trägergruppe. Ein Auswahlmenü bei den FSK-Varianten, ein freies Eingabefeld bei allen übrigen. Bei Packet und APRS ein freies Eingabefeld nur bei 300 Bd; bei 1200 Bd liegen die Töne fest auf 1200 / 2200 Hz und das Feld zeigt sie nur an |
| Shift (Hz) | nur FSK | Frequenzunterschied zwischen Mark- und Space-Ton |
| Baud | nur FSK | Symbolrate |
| Framing | nur FSK | Datenbits, Parität, Stoppbits (z. B. 7N1 = 7 Daten, keine Parität, 1 Stopp) |
| Encoding | nur FSK | Zeichensatz (CCIR-476, ITA2/Baudot oder ASCII) |
| Invert mark / space | nur FSK | Vertauscht Mark- und Space-Ton |
| Auto shift detect | nur FSK | Versucht, den Shift automatisch aus dem eingehenden Signal zu messen |
| Mode | nur PSK31 | BPSK31/63/125, QPSK31/63/125 — muss zur Aussendung passen |
| Mode (Töne / Hz) | nur Olivia, Contestia | Anzahl der Töne und Bandbreite — muss exakt zur Aussendung passen |
| Squelch (FEC S/N) | nur Olivia, Contestia | Wie stark die Übereinstimmung der Fehlerkorrektur sein muss, bevor Text ausgegeben wird |
| Browser — all signals | PSK31, Olivia, Contestia | Ein Schalter: dekodiert alle Signale des gewählten **Mode** (PSK31: alle BPSK31-Signale) zwischen 300 und 2700 Hz gleichzeitig, eine Zeile pro Signal — siehe die Hinweise zu PSK Browser und Olivia |
| Mode | MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63 | Die Unterbetriebsart (Geschwindigkeit, Bandbreite, Interleaving) — muss zur Aussendung passen |
| Squelch (FEC metric) | MFSK | Die Dekodierqualität (0–100), die das Signal erreichen muss, bevor Text ausgegeben wird; Vorgabe 22 |
| T/R period | FST4W, MSK144 | FST4W: 120, 300, 900 oder 1800 s — muss zur Aussendung passen. MSK144: 15 oder 30 s; eine innerhalb einer Periode wiederholte Meldung wird einmal gelistet |
| F Tol | FST4W, MSK144 | Wie weit beiderseits von **Center audio** der Decoder sucht: ±50, 100 oder 150 Hz bei FST4W, ±50 bis ±300 Hz bei MSK144 |
| Decode | MSK144 | **Fast**, **Normal** oder **Deep** — wie gründlich jeder Block abgesucht wird; Deep findet am meisten und braucht am meisten CPU |
| Squelch (tone / noise) | DominoEX, THOR | 0–100: der aktuelle Ton gegen den Boden der übrigen Ton-Bins; Vorgabe 25 |
| Squelch (S/N) | THROB | In dB; Vorgabe 4 |
| Squelch (FEC S/N) | MT63 | Die Übereinstimmung des Walsh-Codes; Vorgabe 4 |
| Reverse | FSK Hell 245 / 105, Hell 80 | Malt den anderen Ton als Tinte |
| Speed | Packet und APRS | **1200 Bd · VHF/UHF (FM)** oder **300 Bd · HF (USB)**. Damit wird auch die Betriebsart des Empfängers gewählt |
| Show raw packet | nur APRS | Gibt zusätzlich über jeder dekodierten Zeile das Paket so aus, wie es empfangen wurde (TNC2-Format) |
| Squelch (SNR) | Amateur-, Wetter- und Marine-RTTY | Verhindert, dass Rauschen als zufällige Buchstaben ausgegeben wird. Beginnt bei −5 dB für Amateur-RTTY und −7 dB für Wetter- und Marine-RTTY; ganz links (**off**) ist sie abgeschaltet. Die SNR-Anzeige wird grau, solange die Squelch geschlossen ist |

### Signalmesswerte

Die Statuszeile zeigt Live-Messwerte, und die Felder wechseln mit der Variante:

| Variante | Angezeigte Felder |
|----------|-------------------|
| FSK-Varianten | **Mark / Space** (gemessene Tonfrequenzen), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, nach automatischer Frequenzkorrektur), **IMD** (dB), **SNR**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |
| PSK Browser, Olivia Browser | **Signals** (wie viele Zeilen angezeigt werden) |
| MFSK16 / 32 / 64 | **Centre** (Hz, nach automatischer Frequenzkorrektur), **Mode**, **S/N**, **FEC** (%), **Sync** |
| ALE 2G | **Dial** (warnt, wenn es kein gelisteter Kanal ist), **In sync**, **Events** |
| FST4W | **Period** (wie viel der laufenden Periode aufgezeichnet ist), **Search** (Hz), **Decodes** |
| MSK144 | **Search** (Hz), **Decodes**, **CPU** (der Anteil der Echtzeit, den der Decoder braucht; über 100 % fällt er zurück) |
| DominoEX, THOR, THROB, MT63 | **Centre** (Hz; bei THROB und MT63 nach automatischer Frequenzkorrektur), **Mode**, **S/N**, **Quality** (%), **Sync** |
| Hellschreiber | **Centre**, **Mode**, **Audio** (Eingangspegel, dBFS) |
| Packet und APRS | **Tones** (Hz), **DCD** (leuchtet, solange ein Paket gesendet wird), **Frames** (dekodierte Pakete), **Stations** (verschiedene gehörte Rufzeichen), **Audio** (Eingangspegel, dBFS) |

`Timing`/`Sync` zeigt `LOCKED`/`SYNCED`, sobald der Decoder dem Signal folgt, und `SEARCH`, solange er noch sucht.

Die **SNR** der FSK-Varianten und von PSK31 wird am Signal selbst gemessen und auf 3 kHz Bandbreite bezogen, sodass beide auf derselben Skala liegen: von +20 dB bis −5 dB auf etwa 1 dB genau. Eine leere Frequenz zeigt etwa −12 bis −15 dB, und bei PSK31 ist 0 dB bereits ein starkes Signal. Die **S/N** von Olivia ist etwas anderes: die Qualitätszahl der Fehlerkorrektur. Bei MFSK ist **S/N** das Ton-Rausch-Verhältnis von fldigi und **FEC** seine Dekodierqualität von 0–100. Bei DominoEX und THOR ist **S/N** der empfangene Ton gegen die übrigen Ton-Bins und **Quality** die Skala des Squelch (bei THOR die Sicherheit der Fehlerkorrektur); bei THROB das Zweiton-S/N; bei MT63 die Übereinstimmung der Fehlerkorrektur. Keine dieser Zahlen ist eine SNR in 3 kHz: Es sind die Werte, auf die der Squelch wirkt.

Amateur-RTTY (45,45 Baud, 170 Hz) wird bis herab zu etwa 0 dB fehlerfrei gelesen, mit rund 1,5 % falschen Zeichen bei −3 dB und 20 % bei −6 dB.

### Weitere Bedienelemente

- **⇒ Set IF Band-Pass** — verengt den Durchlassbereich des Empfängers so, dass er das Signal eng umschließt. Die Breite richtet sich nach der Variante: 300 Hz für Amateur-RTTY (schmal genug, um eine stärkere Station 250 Hz daneben zu entfernen, und dennoch lesbar bei einem 40 Hz verstimmten Signal), 594 Hz für Wetter-RTTY, Mark/Space plus Reserve für Maritime FSK, etwa ±100 Hz für PSK31 (±200 Hz PSK63, ±400 Hz PSK125) und die volle Breite des Tonblocks plus Reserve für Olivia. Der Durchlassbereich folgt dem Decoder, wenn **Auto-tune** oder **Auto shift detect** die Töne verschiebt, und wenn Sie die **Baud**-Einstellung ändern. Bei Packet mit 300 Bd sind es etwa ±400 Hz, bei Packet mit 1200 Bd der normale FM-Kanal. MFSK, DominoEX, THOR, THROB, Hellschreiber und MT63 erhalten ihre volle Breite plus einen Rand (mindestens 60 Hz auf jeder Seite, bei den breiten Betriebsarten 15 % der Breite). ALE 2G erhält 500–2750 Hz (bei einem LSB-Netz unter die Skala gespiegelt), FST4W seinen **F Tol**-Bereich plus 150 Hz auf jeder Seite, MSK144 ±1,1 kHz plus **F Tol**.
- **⟳ Auto-tune Center** — automatische Suche nach dem Signal. Bei den FSK-Varianten sucht sie ein ausgewogenes Tonpaar, bei PSK31 findet sie den Träger, bei Olivia den stärksten Block der gewählten Bandbreite. **Auto shift detect** ändert die Shift nur, wenn ein echtes Zweitonsignal vorhanden ist, und springt daher nicht mehr auf Rauschen. Bei Packet mit 300 Bd findet sie das stärkste Tonpaar im Abstand von 200 Hz. Bei Packet mit 1200 Bd ist die Schaltfläche ausgeblendet, da die Töne dort fest liegen. MFSK, DominoEX, THOR, THROB, Hellschreiber und MT63 werden wie Olivia gesucht, über ihre eigene Breite. Bei ALE 2G, FST4W und MSK144 ist die Schaltfläche ausgeblendet.

### Hinweise zu ALE 2G

ALE (MIL-STD-188-141, zweite Generation) ist die Art, wie Behörden-, Militär-, Hilfsorganisations- und Amateur-KW-Netze eine brauchbare Frequenz finden: Die Stationen tasten eine Reihe von Kanälen ab, senden kurze *Soundings*, um ihre Anwesenheit zu melden, und rufen einander mit einigen Sekunden eines 8-Ton-Signals (125 Bd, 750–2500 Hz).

1. Wählen Sie **ALE 2G HAM**, den Eintrag direkt vor Packet unter **Variant**. Anstelle der üblichen Einstellungen zeigt das Panel eine **Netz**- und eine **Kanal**-Liste.
2. Wählen Sie ein Netz und einen seiner Kanäle und klicken Sie auf **⇒ Tune & Set IF**. Die gelistete Frequenz ist die Skala; der Empfänger geht auf USB, oder LSB bei den wenigen so gekennzeichneten Netzen, mit einem Filter von 500–2750 Hz.
3. Warten Sie. Soundings kommen jede halbe oder volle Stunde und Rufe nur, wenn eine Verbindung gebraucht wird, sodass ein Kanal lange still bleiben kann.

- **Ham (HFLINK)** listet alle 31 Amateur-ALE-Kanäle des HFLINK-Kanalplans, von 475,5 kHz bis 144,1625 MHz; 14109 und 7102 kHz gehören zu den wichtigsten Sounding- und Textkanälen von HFLINK. Es ist das einzige Netz in FLDIGI. Die übrigen 51 Netze (Government, Military — darunter MARS — und Utility) stammen aus der ALE-Liste des KiwiSDR und liegen unter SERVICES → ALE 2G (MIL-STD-188-141) (Kapitel 12), das genauso funktioniert. Es sind öffentliche Listen, die veraltet sein können.
- Jedes Ereignis zeigt die Zeit, die Frequenz, seine Art (Sounding, Ruf, Ruf bestätigt, Verbindung hergestellt, Meldung), die Adressen **from** und **to** sowie etwaige Befehle oder Text (AMD- und DTM-Meldungen). Gleiche Wiederholungen werden zu einer Zeile mit ×N zusammengefasst, und **💾 Save** speichert die Ereignisse in eine Textdatei.
- **In sync** zählt, wie viele der 17 Decoder, jeder auf seinem eigenen Frequenzversatz, gerade ALE-Wörter lesen. Ein bis etwa ±1 kHz verstimmtes Signal wird noch gefunden.

### Hinweise zu PSK31

PSK31 ist die verbreitetste Tastatur-zu-Tastatur-Betriebsart auf Kurzwelle. Sie ist nur 62 Hz breit, sodass mehrere Verbindungen innerhalb weniger hundert Hertz um die übliche Sammelfrequenz nebeneinander liegen; das Abstimmen besteht darin, im Wasserfall eine Spur aus der Gruppe herauszugreifen.

- Der Decoder korrigiert seinen Abstimmfehler über etwa **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125) selbst, Sie müssen also nur in die Nähe kommen. **Carrier** in der Messwertzeile zeigt, wo er sich tatsächlich eingependelt hat.
- **IMD** misst die Senderqualität, nicht den Empfang: ein sauberes Signal liegt bei etwa −20 dB oder besser. Ein schlechter Wert bedeutet, dass die Gegenstation übersteuert, nicht dass Sie falsch abgestimmt sind.
- Der Text erscheint Zeichen für Zeichen ohne Fehlerkorrektur; ein schwaches Signal führt daher zu vereinzelten falschen Buchstaben, statt ganz abzubrechen.
- **PSK63 und PSK125** sind dieselbe Betriebsart, zwei- bzw. viermal so schnell und ebenso viel breiter; **QPSK31/63/125** fügen eine Fehlerkorrektur hinzu (Viterbi-Decoder), die kurze Störungen bei etwa gleicher Signalstärke repariert. Wählen Sie die Unterbetriebsart unter **Mode** — die falsche gibt nichts aus. Der Großteil des PSK-Betriebs ist weiterhin BPSK31; PSK63 ist in Contesten verbreitet.
- **PSK Browser (BPSK31).** Der Schalter **Browser — all signals** unter **Mode** dekodiert alle BPSK31-Signale zwischen 300 und 2700 Hz gleichzeitig, wie der Signal-Browser von fldigi: eine Zeile pro Signal (bis zu 16) mit Frequenz, Lock-Qualität und dem neuesten Text. Die Signale werden innerhalb weniger Sekunden von selbst gefunden, und eines, das 30 s lang stumm bleibt, wird entfernt. Klicken Sie auf eine Zeile, um nur dieses Signal zu dekodieren, als normales BPSK31 auf seinem Träger. Solange er läuft, zeigt **Mode** BPSK31 und ist gesperrt; ausgeschaltet kehrt das Fenster zur vorherigen Mode zurück. Beim Browsen öffnet sich der Durchlassbereich auf 200–2800 Hz. Jede Zeile behält ihre letzten 4000 Zeichen in einem etwa sechs Zeilen hohen Feld, mit eigener Bildlaufleiste, sobald sie mehr als sechs Zeilen enthält (das Mausrad geht auch); das Feld bleibt stehen, während Sie lesen. **Save Text** speichert alle Zeilen, auch die bereits entfernten. Während ein Browser läuft, sind die Einstellungen des einzelnen Decoders (Center audio, ⟳ Auto-tune Center und seine Anzeigen) ausgeblendet.

### Hinweise zu Olivia

Olivia tauscht Geschwindigkeit gegen Robustheit. Es ist deutlich langsamer als PSK31, dekodiert aber Signale, die mit dem Ohr nicht mehr hörbar sind — daher seine Beliebtheit für schwache Signale und große Entfernungen.

- **Die Mode-Einstellung muss exakt zur Aussendung passen.** Eine falsche Kombination aus Tönen und Bandbreite dekodiert überhaupt nichts — keinen verstümmelten Text, sondern Stille. Das Bedienfeld startet mit **8 / 250**, der schmalen Konfiguration, die auf den Anruffrequenzen mitläuft; **16 / 500** und **32 / 1000** sind die beiden anderen gebräuchlichen, und **16 / 1000** wird ebenfalls angeboten.
- **Contestia** ist Olivia mit einem kleineren Fehlerkorrekturblock: etwa doppelt so schnell, nur Großbuchstaben und etwas weniger robust. Seine Konfigurationen stehen in derselben **Mode**-Liste unter *Contestia* (üblich ist 8 / 250, für schwache Verbindungen 4 / 125 und 4 / 250); der Titel des Bedienfelds wechselt zu *Contestia Decoder*. Eine Olivia-Einstellung dekodiert nie Contestia und umgekehrt.
- **Olivia Browser.** Schalten Sie unter **Mode** den Schalter **Browser — all signals** ein, um alle Olivia- (oder Contestia-)Signale dieser Konfiguration zwischen 300 und 2700 Hz gleichzeitig zu dekodieren, eine Zeile pro Signal, wie beim PSK Browser; ein Klick auf eine Zeile dekodiert nur dieses Signal. Er arbeitet mit einer Konfiguration zur Zeit: Auf **8 / 250** sieht er keine 16/500-Stationen. Da Olivia unter dem Rauschen verwendet wird, sucht er Signale nicht nach ihrer Stärke: Der Durchlassbereich wird von etwa einem Dutzend Decodern nebeneinander abgedeckt (etwa 5 % eines Prozessorkerns), sodass eine Station erscheint, sobald ihre ersten Zeichen dekodiert sind, wenige Sekunden nach ihrem Beginn. Innerhalb einer Bandbreite wird nur die stärkste Kopie gezeigt, und eine Zeile erscheint erst, wenn sie einige Zeichen echten Text enthält.
- Olivia sendet keine Präambel, der Decoder muss die Synchronisierung daher suchen. **Rechnen Sie nach dem Abstimmen mit einigen Sekunden**, bevor Text erscheint. Das Feld **Sync** zeigt bis zum Einrasten `SEARCH`.
- Die Fehlerkorrektur arbeitet blockweise, der Text trifft daher **schubweise statt gleichmäßig** ein, mit einer Verzögerung von mehreren Blöcken zwischen Aussendung und Anzeige.
- **Squelch (FEC S/N)** legt fest, wie sicher sich die Fehlerkorrektur sein muss, bevor sie ausgibt. Die Voreinstellung 4,0 hält Rauschen fern; 3,0 ist die Untergrenze, unterhalb derer zufälliges Rauschen vereinzelt Zeichen ausgibt. Ein gutes Signal erreicht 8–9 auf der **FEC**-Anzeige, es bleibt also reichlich Spielraum, den Squelch auf einem belegten Band anzuheben.
- Wenn eine Aussendung endet, hört der Text einfach auf. Jeder Block wird zusätzlich für sich geprüft, sodass die wenigen Blöcke, die die Rauschsperre beim Abklingen noch durchlässt, keine Folge zufälliger Zeichen mehr ausgeben.

### Hinweise zu FST4W

FST4W ist die Bakenbetriebsart von WSJT-X für die unteren Bänder, wo sie auf WSPR folgt: vier Töne mit Rufzeichen, Locator und Leistung, einmal pro T/R-Periode von 2, 5, 15 oder 30 Minuten gesendet. Je länger die Periode, desto schwächer das Signal, das dekodiert wird: etwa −31 dB SNR (in 2,5 kHz) bei FST4W-120, und echte 30-Minuten-Signale um −44 dB.

- **Dekodiert wird einmal pro Periode, nach deren Ende.** Die Perioden beginnen nach der UTC-Uhr — FST4W-120 zu jeder geraden Minute, FST4W-1800 zur vollen und zur halben Stunde —, und der Balken **Period** zeigt, wie viel der laufenden Periode aufgezeichnet ist. Eine erst unterwegs begonnene Periode wird übersprungen, weil sich eine halbe Meldung nicht dekodieren lässt; die nächste wird ganz aufgezeichnet. Das Dekodieren einer 30-Minuten-Periode dauert einige Sekunden.
- **Wählen Sie die richtige T/R-Periode.** Der Decoder betrachtet nur die gewählte. Die meisten LF/MF-Baken senden FST4W-120; FST4W-300, -900 und -1800 sind für die schwächsten Wege.
- **F Tol** legt fest, wie weit beiderseits von **Center audio** (1500 Hz) gesucht wird. Der WSJT-X-Standard von ±100 Hz deckt die Baken-Teilbänder ab; ±150 Hz ist das Maximum, das der Durchlassbereich zulässt.
- Jede Zeile zeigt UTC, SNR (dB), DT (den Zeitversatz, s), die Frequenz (MHz) und die Meldung, wie in WSJT-X, und **Save Text** speichert sie im selben Format.
- Die Uhr des Computers muss auf etwa eine Sekunde genau gehen, wie bei WSPR.

### Hinweise zu MFSK16 / MFSK32 / MFSK64

MFSK16, MFSK32 und MFSK64 sind die IZ8BLY-Betriebsarten, wie fldigi sie sendet: 16 Töne, jeweils einer zur Zeit, im Abstand von einem Baud, geschützt durch Faltungs-Fehlerkorrektur und Interleaving. Sie sind schneller als Olivia und etwas weniger robust. MFSK16 (15,625 Baud, 234 Hz breit) liefert sauberen Text bis etwa −12 dB SNR in 2,5 kHz, MFSK32 (31,25 Baud, 469 Hz) bis etwa −10 dB und MFSK64 (62,5 Baud, 938 Hz) bis etwa −7 dB.

- **Wählen Sie die Variante MFSK16·32·64**, dann die Geschwindigkeit in ihrer **Mode**-Liste. Die drei Betriebsarten unterscheiden sich nur in der Geschwindigkeit, und die Einstellung muss passen: die falsche liefert nichts Lesbares.
- **Abstimmung:** den Tonblock auf die Frequenz **Center audio** legen oder **⟳ Auto-tune Center** drücken. Den letzten Viertelton korrigiert der Decoder selbst — etwa ±4 Hz bei MFSK16, ±8 Hz bei MFSK32 und ±16 Hz bei MFSK64 —, und **Centre** zeigt, wo er sich eingependelt hat. Ein weiter entferntes Signal findet der Decoder selbst, bis etwa ±75 Hz von der eingestellten Mitte: Rechnen Sie mit einigen Sekunden am Anfang einer Aussendung.
- Der Text läuft dem Signal um ein paar Sekunden hinterher, die Zeit, die Interleaver und Fehlerkorrektur brauchen. Ein oder zwei verirrte Zeichen ganz am Anfang einer Aussendung sind normal; fldigi zeigt sie ebenfalls.
- **Squelch (FEC metric)** hält die Ausgabe zurück, bis die Dekodierqualität die Einstellung erreicht. Die Vorgabe 22 hält Rauschen fern (Rauschen allein erreicht etwa 20); ein gutes Signal zeigt 90 % oder mehr auf der **FEC**-Anzeige, und 0 schaltet die Squelch ab. Endet eine Aussendung mit der Ende-Kennung von fldigi, stoppt die Ausgabe sofort, statt noch ein paar Sekunden Rauschen durchzulassen.
- MFSK-Bildübertragungen werden nicht dekodiert.

### Hinweise zu MSK144

MSK144 ist die WSJT-X-Betriebsart für Meteorscatter: Signale, die für Sekundenbruchteile an den ionisierten Spuren von Meteoren reflektiert werden, vor allem auf 6 m und 2 m. Jede Station wiederholt ihre Meldung ohne Pause durch ihre ganze 15- oder 30-Sekunden-Periode, 72 ms pro Meldung, sodass ein Ping von einer Zehntelsekunde sie tragen kann.

- **Rechnen Sie mit langen Pausen.** Auf einem ruhigen Band erscheint minutenlang nichts. Während der großen Ströme (Quadrantiden, Perseiden, Geminiden) und am frühen Morgen gibt es viel mehr Pings.
- Jede Zeile zeigt UTC (auf die Sekunde), SNR (dB), T (wann der Ping in seiner Periode kam, s), die Frequenz (MHz) und die Meldung. Eine in derselben T/R-Periode erneut gehörte Meldung wird einmal gelistet, außer die neue Kopie ist stärker. Schwache Kopien derselben Meldung werden gemittelt, wie in WSJT-X.
- **F Tol** legt fest, wie weit beiderseits von 1500 Hz der Decoder sucht; Stationen liegen selten genau auf der Frequenz, ±100 Hz ist ein guter Anfang. **Decode** bestimmt, wie gründlich jeder Block abgesucht wird, und **Deep** findet am meisten. **CPU** in der Messzeile zeigt die Last: Über 100 % fällt der Decoder zurück, wählen Sie auf einem langsamen Computer also **Normal** oder **Fast**.
- Die 40-Bit-Kurzmeldungen (Sh) werden nicht dekodiert: Sie setzen die Rufzeichen beider Stationen voraus, die ein Hörer nicht kennt.

### Hinweise zu DominoEX und THOR

DominoEX und THOR senden 18 Töne, einen nach dem anderen, doch ein Zeichen ist kein Ton: Es ist der *Schritt* vom vorigen Ton (inkrementelle Frequenzumtastung). Derselbe Ton wiederholt sich nie, und eine langsame Drift des ganzen Signals hebt sich auf; beide Betriebsarten verzeihen daher einige Hertz Verstimmung und einen driftenden Sender. **DominoEX** sendet seine Zeichen direkt, ohne Fehlerkorrektur: Ein falscher Ton kostet ein Zeichen. **THOR** fügt dieselbe Faltungs-Fehlerkorrektur und dasselbe Interleaving wie MFSK hinzu und kommt so durch Störknacken und Fading, um den Preis einiger Sekunden Verzögerung.

- **Mode** muss zur gesendeten Geschwindigkeit passen. DominoEX bietet Micro, 4, 5, 8, 11, 16, 22, 44 und 88; THOR bietet Micro, 4, 5, 8, 11, 16, 22 und die schnellen 25 x4, 50 x1, 50 x2 und 100 (diese vier nutzen einen stärkeren Code und einen Interleaver von einer Sekunde). DominoEX 11 und THOR 16 hört man am häufigsten.
- **Abstimmung:** Legen Sie den Tonblock auf **Center audio** oder drücken Sie **⟳ Auto-tune Center**. Eine Verstimmung um ein Viertel der Signalbreite wird noch gelesen.
- **Squelch (tone / noise)** vergleicht den empfangenen Ton mit dem Boden aller übrigen Ton-Bins, auf einer Skala von 0–100. Rauschen allein bleibt bei höchstens 20; lesbare Aussendungen zeigen 35 und mehr; die Vorgabe ist 25. Das ist nicht fldigis eigene Zahl: Sie zeigt bei manchen völlig sauberen Signalen nur 26, sodass jede brauchbare Vorgabe diese abgeschnitten hätte. Endet eine Aussendung, hört die Ausgabe nach wenigen Symbolen auf, statt Rauschen durchzulassen.
- Der Empfänger folgt den Standardeinstellungen von fldigi: drei Pfade im Abstand eines Drittel-Bins, harte Entscheidungen bei DominoEX, weiche Entscheidungen und Präambelerkennung bei THOR. Die optionale MultiPSK-Fehlerkorrektur von DominoEX (bei fldigi standardmäßig aus) wird nicht dekodiert, ebenso wenig der Sekundärtext-Kanal (der Bakentext der Station in Sendepausen) und der Bildmodus von THOR.

### Hinweise zu THROB

THROB sendet jedes Zeichen als einen Impuls aus zwei gleichzeitigen Tönen (bei einigen Zeichen einem einzigen Ton), aus 9 Tönen (THROB) oder 11 (THROBX), mit 1, 2 oder 4 Impulsen pro Sekunde. Es ist langsam, aber sehr robust bei Fading. THROB kennt nur Großbuchstaben, Ziffern und einige Zeichen; THROBX einen größeren Satz.

- **Die Abstimmung ist kritisch.** Die Töne von THROB 1 und 2 liegen nur 8 Hz auseinander; der Decoder fängt daher ±3 Hz Verstimmung ein (±6 Hz bei THROB 4) und korrigiert den Rest mit seiner eigenen Frequenznachführung. Drücken Sie zuerst **⟳ Auto-tune Center**: Es findet das Signal auf ein, zwei Hertz genau.
- **Mode** muss passen, THROB oder THROBX und die Geschwindigkeit.
- **Squelch (S/N)** — Rauschen allein bleibt unter 1 dB, ein lesbares Signal zeigt 10 dB und mehr; die Vorgabe ist 4 dB.

### Hinweise zu Hellschreiber

Hellschreiber wird überhaupt nicht dekodiert: Der Sender tastet jedes Zeichen einer 7 × 14-Schrift Spalte für Spalte ab, und der Empfänger *malt*, was er hört. Das Bedienfeld zeigt daher ein Bild statt Text, und Ihr Auge liest die Buchstaben. Darum bleibt Hell lesbar, wenn es keine Textbetriebsart mehr ist: Ein beschädigter Buchstabe ist ein verschmierter Buchstabe, kein falscher.

- **Mode:** Feld Hell (die übliche, 245 Hz breit), Slow Hell, Hell X5 und X9 (schneller und breiter) sowie die Zweitonverfahren FSK Hell 245, FSK Hell 105 und Hell 80. Die Geschwindigkeit muss passen, sonst erscheinen die Buchstaben gestreckt oder gestaucht.
- **Jede Textzeile wird zweimal gemalt**, eine Kopie über der anderen, so wie fldigi sie malt: Ein kleiner Geschwindigkeitsunterschied zwischen den Stationen neigt den Text, und eine der beiden Kopien ist immer vollständig.
- Es gibt keinen Squelch: Rauschen erscheint als Gesprenkel, das das Auge übergeht. Bei den Zweitonverfahren vertauscht **Reverse**, welcher Ton als Tinte gilt, für eine Station mit umgekehrter Tonfolge.
- **Save Picture** speichert das Bild als PNG; **Clear** beginnt eine leere Seite.

### Hinweise zu MT63

MT63 sendet 64 Träger gleichzeitig, jeder mit einem Bit pro Symbol, und verteilt jedes Zeichen über alle Träger und zeitlich über 32 (short) oder 64 (long) Symbole. Ein Zeichen übersteht daher den Verlust eines guten Teils seiner Träger und einen Störimpuls; deshalb wird MT63 im Notfunk eingesetzt: Es kommt durch Störungen, die schmalere Betriebsarten auslöschen.

- **Mode:** MT63-500, -1000 oder -2000 (die Bandbreite), jeweils mit **short** oder **long** Interleaving. Beides muss passen. Am häufigsten ist MT63-1000 long.
- **Abstimmung:** fldigi sendet den untersten Träger bei 500 Hz; die Mitte liegt daher bei 500 Hz plus der halben Bandbreite: 750, 1000 oder 1500 Hz, automatisch gesetzt, wenn Sie den Mode wählen. Die letzten 8 Träger Ablage findet der Decoder selbst (±125 Hz bei MT63-1000).
- **Der Text folgt dem Signal mit Verzögerung** durch den Interleaver: von etwa 1,6 s (MT63-2000 short) bis 12,8 s (MT63-500 long). Die letzten Zeichen einer Aussendung kommen an, nachdem das Signal schon verstummt ist.
- **Squelch (FEC S/N)** — Rauschen allein zeigt etwa 3, ein eingerastetes Signal 4,5 und mehr; die Vorgabe ist 4. Der Squelch verbirgt den Moment, den die Synchronisation zu Beginn zum Einrasten braucht.

### Hinweise zu Packet und APRS

Packet Radio überträgt Daten in kurzen Blöcken, den Frames. Jeder Frame enthält das Rufzeichen des Absenders, das Ziel, die durchlaufenen Digipeater und eine Prüfsumme. **APRS** (Automatic Packet Reporting System) nutzt diese Frames, um Positionen, Wetterdaten, Nachrichten und Statusmeldungen zu verbreiten, meist auf einer gemeinsamen Frequenz je Region.

- **Packet** gibt jeden Frame aus, wie es ein TNC-Monitor tut: Uhrzeit (UTC), `QUELLE>ZIEL,PFAD`, den Frame-Typ in spitzen Klammern, dann den Text. Neben Aussendungen an alle erscheint auch Verkehr im Connected-Modus (SABM, UA, I-Frames, RR, DISC).
- **APRS** gibt nur die von APRS verwendeten Rundsende-Frames aus und macht aus jedem Klartext: Position mit Maidenhead-Locator, Symbol (Auto, Haus, Wetterstation, …), Geschwindigkeit und Kurs, Höhe, Kommentar, Wetterwerte in metrischen Einheiten, Nachrichten und Bestätigungen, Objekte, Items, Status und Telemetrie. Auch komprimierte und Mic-E-Positionen werden dekodiert. Mit **Show raw packet** erscheint das empfangene Paket über seiner dekodierten Zeile.
- **APRS-Karte.** Unter dem dekodierten Text zeigt die APRS-Variante eine Karte aller gehörten Stationen mit Position, so breit und so hoch wie das Textfenster: eine beschriftete Markierung je Station (Objekte und Items unter ihrem eigenen Namen), eine Spurlinie für bewegte Stationen und eine bernsteinfarbene Markierung für diesen Empfänger, gesetzt nach seinem Locator. Ein Klick auf eine Station zeigt ihre dekodierte Zeile, wann sie zuletzt gehört wurde sowie Entfernung und Richtung vom Empfänger; ein Klick auf eine dekodierte Zeile im Textfenster zoomt die Karte auf diese Station. **Auto fit** (standardmäßig an) passt den Ausschnitt an, wenn Stationen hinzukommen oder sich bewegen; Verschieben oder Zoomen von Hand schaltet es ab, ein Haken schaltet es wieder ein. **Fit all** zeigt einmal alles, **Clear** leert die Karte, und **–** verkleinert sie auf ihre Titelleiste (**□** holt sie zurück) — Stationen werden währenddessen weiter gesammelt. Die Kartenbilder kommen von OpenStreetMap, der Browser des Hörers braucht also Internetzugang, um sie zu zeichnen; die Dekodierung selbst bleibt lokal.
- **Speed 1200 Bd** ist der VHF/UHF-Standard (Bell-202-Töne, 1200 / 2200 Hz). Der Decoder schaltet den Empfänger auf **FM** und stimmt ihn direkt auf den Kanal ab: Wählen Sie in Europa **144,800 MHz**, oder stimmen Sie einen beliebigen Packet-Kanal ab und drücken Sie **⇒ Set IF Band-Pass**. Mit dem **Wheel Tuning Step** von 12,5 kHz bewegen Sie sich im VHF-Kanalraster.
- **Speed 300 Bd** ist KW-Packet, zwei Töne im Abstand von 200 Hz. Der Empfänger geht auf **USB**, und die Skalenfrequenz ist die veröffentlichte Frequenz; die Töne liegen bei 1600 / 1800 Hz. Liegt das Signal etwas daneben, verwenden Sie **⟳ Auto-tune Center**.
- **Nur Frames mit korrekter Prüfsumme werden ausgegeben**, Rauschen erscheint also nie als Zeichensalat — ein leeres Fenster bedeutet einen ruhigen Kanal. Leuchtet **DCD**, ohne dass **Frames** weiterzählt, sind Signale vorhanden, aber zu schwach oder zu verzerrt, um die Prüfsumme zu bestehen.
- Der Decoder arbeitet mit FM-Empfängern mit und ohne Deemphasis und mit Sendern, die einen Ton stärker anheben als den anderen.

> **Hinweis zur Betriebsart:** Der Decoder übernimmt die Kontrolle über Demodulationsart und ZF-Durchlassbereich, solange er aktiv ist. Beides wird beim Abschalten automatisch wiederhergestellt. Alle Varianten verwenden **USB**, außer Packet und APRS mit 1200 Bd, die **FM** verwenden.
>
> **Hinweis zur Polarität (nur FSK-Varianten):** Bei Wetter-RTTY und Marine-RTTY (PBB) muss meist **Invert mark / space** aktiviert werden. Bei maritimem FSK (SITOR/NAVTEX-Art) und Amateur-RTTY lassen Sie es deaktiviert — Amateur-RTTY sendet Mark als die höhere Hochfrequenz, und USB behält sie als den höheren Audioton bei, was genau dem deaktivierten Fall entspricht. Ist der dekodierte Text verstümmelt, sollten Sie zuerst dieses Kästchen umschalten. Bei allen Varianten außer den vier FSK-Varianten ist es ausgeblendet: Die übrigen besitzen kein Mark/Space-Paar, und die Packet-Dekodierung hängt nicht davon ab, welcher Ton welcher ist.
>
> **Hinweis zu Buchstaben/Ziffern (nur FSK-Varianten):** Baudot führt Buchstaben und Ziffern in zwei getrennten Zuständen, und Rauschen kann den Decoder in den falschen kippen — wodurch nicht nur das gestörte, sondern jedes folgende Zeichen verstümmelt wird. Der Decoder kehrt deshalb bei jedem Leerzeichen zu Buchstaben zurück; das ist übliche Praxis und repariert eine verfälschte Umschaltung innerhalb von ein bis zwei Wörtern statt einer ganzen Zeile. Der Preis: Zifferngruppen, die durch Leerzeichen getrennt sind, erfordern, dass die Gegenstelle die Ziffernumschaltung nach jedem Leerzeichen wiederholt — was Sender normalerweise tun.

---

## 11. SSTV

**Worum es geht:** Slow-Scan-Television überträgt Standbilder über einen gewöhnlichen SSB-Sprechfunkkanal, Zeile für Zeile, als frequenzmodulierten Ton zwischen 1500 Hz (Schwarz) und 2300 Hz (Weiß). Ein vollständiges Bild dauert je nach Betriebsart zwischen 36 Sekunden und 4½ Minuten.

### Empfohlene Frequenzen (USB)

| Band | Frequenz | Betriebsart | Anmerkungen |
|------|----------|-------------|-------------|
| 20 m | 14.230 MHz | USB | Die wichtigste internationale SSTV-Anruffrequenz — mit Abstand die aktivste |
| 20 m | 14.233 MHz | USB | Ausweichfrequenz, wenn 14.230 belegt ist |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Aktiv bei Bandöffnungen |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regional, abends |

**Das Seitenband wird für Sie gewählt.** Beim Start des Decoders wird **LSB unterhalb 10 MHz** und **USB oberhalb** gewählt, entsprechend der üblichen Amateurfunkpraxis. Auf dem falschen Seitenband ist die Tonzuordnung invertiert, und das Bild lässt sich nicht dekodieren. Treffen Sie auf eine Station, die sich nicht an die Konvention hält, wechseln Sie das Seitenband einfach von Hand — der Decoder läuft weiter, löscht das Bild und beginnt mit der neuen Einstellung von vorn.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **SSTV** aus dem Menü. Oder drücken Sie einfach die Taste **SSTV**. Der Empfänger wechselt das Seitenband automatisch — USB über 10 MHz, LSB darunter.
2. Stimmen Sie so ab, dass die Bildtöne in der Mitte des Durchlassbereichs liegen. Ein richtig abgestimmtes Signal hat seine Synchronimpulse bei 1200 Hz und den Bildinhalt zwischen 1500 und 2300 Hz.
3. Belassen Sie **Mode** auf **Auto**, sofern Sie nicht bereits wissen, was gesendet wird. Das Bild baut sich Zeile für Zeile auf.

### Betriebsarten

| Einstellung | Bild | Dauer |
|-------------|------|-------|
| **Auto** | automatisch erkannt | — |
| Martin M1 / M2 | 320×256 Farbe | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 Farbe | 110 s / 71 s |
| Scottie DX | 320×256 Farbe | 269 s |
| Robot 36 / 72 | 320×240 Farbe | 36 s / 72 s |

**Auto** arbeitet auf zwei Wegen: Es liest den **VIS-Kopf** — den digitalen Betriebsartencode, der in den ersten 300 ms einer Aussendung gesendet wird — und bestimmt, falls der Kopf verpasst wurde (Sie sind zu spät eingestiegen oder er ging im QSB verloren), die Betriebsart stattdessen aus dem Timing der Synchronimpulse. Die Wahl einer bestimmten Betriebsart erzwingt diese, aber der Decoder prüft dennoch die Synchronisation, bevor er etwas zeichnet — eine falsche Wahl liefert also kein Bild statt Rauschen. Robot 36 wird auch dann richtig erkannt, wenn Sie mitten in einem Bild einschalten (sein Zeilentakt passt auch zu Robot 72 und Scottie DX und wurde früher mit ihnen verwechselt).

**Schwache Bilder** werden bis zum Ende gezeichnet: Auch wenn sich kein einzelner Synchronimpuls vom Rauschen unterscheiden lässt, erkennt der Decoder aus vielen Zeilen zusammen, dass das Bild noch da ist. Endet die Aussendung wirklich, hört er innerhalb weniger Sekunden auf.

### Die Ausgabe lesen

Die Statuszeile unter den Bedienelementen zeigt, was der Decoder gerade tut:

| Status | Bedeutung |
|--------|-----------|
| `Waiting for VIS / AUTO lock` | Horcht; noch nichts erkannt |
| `Martin M1? verifying sync…` | Ein Kandidat wurde gefunden und wird anhand der nächsten Zeilen bestätigt |
| `Martin M1 lock (VIS)` | Eingerastet über den VIS-Kopf |
| `Martin M1 lock (AUTO)` | Eingerastet über das Synchron-Timing |
| `Martin M1 lock (MANUAL)` | Über die Schaltfläche **⏺ Force** gestartet |
| `Candidate rejected (no sync)` | Der Kandidat wurde nicht bestätigt — bei Rauschen normal |
| `— sync lost, resetting` | Das Signal verschwand mitten im Bild |
| `Frame complete` | Das vollständige Bild wurde empfangen |

Die erkannte Betriebsart erscheint außerdem grün neben dem Titel **SSTV**, und der Zeilenzähler zeigt den Fortschritt.

### Bedienelemente

| Schaltfläche | Aktion |
|--------------|--------|
| **▶ Start** | Schaltet den Decoder scharf. Er zeichnet nicht von selbst ein Bild — ein Einrasten muss weiterhin über den VIS-Kopf oder die Synchronerkennung erfolgen. |
| **■ Stop** | Beendet die Dekodierung. |
| **↺ Reset** | Löscht die Zeichenfläche und schaltet an Ort und Stelle wieder scharf. Zwischen zwei Bildern oder nach dem Nachstimmen zu verwenden. |
| **⏺ Force** | Beginnt **sofort** in der im Menü gewählten Betriebsart zu zeichnen und überspringt VIS- und Synchronerkennung vollständig. Nur verfügbar, wenn Mode nicht auf **Auto** steht. |
| **💾 Save** | Speichert das aktuelle Bild als PNG. |

**Wann Force zu verwenden ist.** Wenn Sie im Wasserfall ein Bild sehen, der Decoder aber nicht darauf einrastet — eine ungewöhnliche Betriebsart, ein für die Detektoren zu schwaches oder zu verzerrtes Signal oder ein verpasster Kopf —, wählen Sie die Betriebsart von Hand und drücken Sie **⏺ Force**. Das Bild wird im Moment des Klicks verankert, und die Betriebsartenmarkierung zeigt `MANUAL`, sodass Sie es von einem VIS- oder AUTO-Einrasten unterscheiden können. Der Decoder rastet dennoch auf einen echten Synchronimpuls ein, wenn er einen findet — ein etwas zu früher oder zu später Klick wird also korrigiert.

Da Force sämtliche Sicherheitsprüfungen überspringt, malt es bereitwillig Rauschen, wenn Sie es auf einem leeren Kanal drücken, und es stoppt nicht von allein — drücken Sie **■ Stop** oder **↺ Reset**.

### Anmerkungen

- **Rauschen startet den Decoder nicht.** Statische Entladungen, Funkenstörungen und Netzbrumm reichten früher aus, um eine Dekodierung auszulösen. Jede Erkennungsstufe prüft nun, dass der Ton wirklich ein Ton ist, und bestätigt den Kandidaten anhand der folgenden Zeilen, bevor ein einziger Bildpunkt gezeichnet wird. Erwarten Sie, dass der Decoder auf einem leeren Band still bleibt.
- **Das Bild verläuft schräg, wenn Sie neben der Frequenz liegen.** SSTV verzeiht Abstimmfehler nicht. Neigen sich die Zeilen, stimmen Sie in kleinen Schritten nach und lassen Sie das nächste Bild neu beginnen.
- Farbbalance und Schärfe sind fest eingestellt; es gibt nichts nachzuregeln.

---

## 12. SERVICES

**SERVICES** (die Taste hieß früher **HFDL**) ist ein Fenster für die Gebrauchsfunkdienste. Die Liste **Service** oben links im Fenster wählt, was dekodiert wird: **HFDL** (Flugzeuge), **Maritime FSK / SITOR**, **Weather RTTY**, **Naval RTTY (PBB CARB)**, **DSC** (Schiffe), **Time Signals** (Zeitzeichen), **HF Selcall** und **ALE 2G (MIL-STD-188-141)**. Ihr Browser merkt sich die Wahl. Es läuft immer ein Dienst; jeder stellt die nötige Betriebsart und das Filter ein, hat eine eigene Frequenzliste mit **⇒ Tune & Set IF** und dekodiert in Ihrem Browser, sodass er den Empfänger nichts kostet. Jeder Dienst hat **💾 Save** (eine Textdatei) und **Clear**, und das Users-Fenster zeigt, welchen Dienst ein Hörer verwendet. Die Amateur-ALE-Kanäle sind im FLDIGI-Fenster, als ALE 2G HAM (Kapitel 10).

### HFDL — Flugzeugmeldungen

HFDL (HF Data Link) überträgt die Meldungen, die Flugzeuge über Ozeanen und abgelegenen Gebieten auf Kurzwelle mit Bodenstationen austauschen: Positionsmeldungen, ACARS-Texte, Anmeldungen und Frequenzdaten. Der Decoder ist dumphfdl (Tomasz Lemiech, GPL-3), nach WebAssembly übersetzt. Er läuft in Ihrem Browser auf dem USB-Audio und kostet den Empfänger daher nichts.

#### Einrichtung

1. Drücken Sie **SERVICES** und wählen Sie **HFDL** in der Liste **Service**. Der Empfänger schaltet auf USB mit einem Filter von 150–2750 Hz.
2. Wählen Sie eine **Bodenstation** und eine ihrer Frequenzen und klicken Sie auf **⇒ Tune & Set IF**. Die angezeigte Frequenz ist die USB-Skala; das HFDL-Signal liegt 1440 Hz darüber.
3. Warten Sie. Bodenstationen senden alle 32 s einen Squitter, Flugzeuge antworten, wenn sie Verkehr haben. Der Decoder findet die genaue Audiorate (±1 %) und eine Frequenzablage (±240 Hz) selbst und rastet beim ersten decodierten Rahmen ein.

#### Frequenzen

Die Stationsliste enthält alle HFDL-Bodenstationen. Tagsüber in Europa gut zu hören: 17967 kHz (Al Muharraq, Bahrain) und 21955 kHz (Kanaren); abends und nachts übernehmen die niedrigeren Frequenzen von Shannon, Reykjavik und den Kanaren. HFDL-Frequenzmarkierungen starten den Decoder, wenn Sie sie anklicken.

#### Die Ausgabe lesen

Jede Zeile zeigt die Uhrzeit (UTC), die Frequenz, die Richtung (▼ Boden→Luft oder ▲ Luft→Boden), die Bodenstation, das Flugzeug — Kennzeichen, Flugnummer und 24-Bit-ICAO-Adresse, jeweils ein Link zu FlightAware —, die Meldungsart, ihren SNR und ihre Bitrate sowie 📍 eine Position, wenn die Meldung eine enthält. ACARS-Text erscheint darunter. Fahren Sie mit der Maus über eine Zeile, um den ganzen Rahmen zu sehen. Setzen Sie das Häkchen bei **Squitters**, um auch die Ansagen der Bodenstationen zu sehen.

**🗺 Map** zeigt die Flugzeuge, die eine Position gemeldet haben, im Panel; **⤢ Large map** öffnet dieselbe Karte in einem verschieb- und vergrößerbaren Fenster. Jedes Flugzeug zeigt in Flugrichtung und hinterlässt eine rote Spur. **💾 Save** speichert die Meldungen als Textdatei, **Clear** leert die Liste.

### Maritimes FSK / SITOR, Wetter-RTTY und Marine-RTTY

Diese drei Aussendungen des Gebrauchsfunks verwenden den FSK-Decoder und das Bedienfeld des FLDIGI-Fensters (Kapitel 10), mit der Liste **Service** dort, wo FLDIGI seine Liste **Variant** hat. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space**, **Auto shift detect**, **⇒ Set IF Band-Pass** und **⟳ Auto-tune Center** funktionieren wie dort beschrieben.

| Dienst | Mitte | Shift | Baud | Rahmen | Kodierung |
|----------|-------|-------|------|--------|-----------|
| Maritimes FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Wetter-RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Marine-RTTY (PBB CARB) | 1000 Hz | 850 Hz | 75 | 5N1.5 | ITA2 |

1. Wählen Sie **Maritime FSK / SITOR**, **Weather RTTY** oder **Naval RTTY (PBB CARB)** in der Liste **Service**.
2. Wählen Sie eine **Known frequency** und klicken Sie auf **Tune**. Die gelistete Frequenz ist das Signal; die USB-Skala geht um die Mitte des Bedienfelds tiefer.
3. Stimmen Sie fein nach, bis der Text stabil ist. Wetter-RTTY braucht **Invert mark / space** angekreuzt (die Voreinstellung erledigt das) und hat einen Regler **Squelch (SNR)**, der bei −7 dB beginnt; maritimes FSK lässt es leer. Marine-RTTY funktioniert genauso (ebenfalls invertiert, Squelch ab −7 dB).

**Maritimes FSK / SITOR:** 2174,5 kHz (MF-NBDP, Arbeitskanal), 518 und 490 kHz (NAVTEX), 4209,5 kHz (HF-NAVTEX) sowie die HF-SITOR-Kanäle für maritime Sicherheitsinformationen 4210, 6314, 8416,5, 12579, 16806,5, 19680,5, 22376 und 26100,5 kHz. NAVTEX hat außerdem eine eigene Taste mit den Sendeplänen der Stationen (Kapitel 9).

**Wetter-RTTY:** die Sender des DWD (Deutscher Wetterdienst) 4583, 7646 und 10100,8 kHz (Programm 1, Englisch) sowie 11039, 14467,3 und 147,3 kHz (Programm 2, Deutsch; 147,3 kHz verwendet 85 Hz Shift, den sein Listeneintrag setzt). Solange eine DWD-Frequenz gewählt ist, zeigt **NEXT BROADCASTS** die kommenden Sendungen.

**Marine-RTTY (PBB CARB):** die Channel Availability / Receipt Broadcast von PBB, der Königlich Niederländischen Marine in Den Helder, auf 2474, 4250, 4280, 5052, 5214, 5659, 5694,5, 6356, 6358,5, 8439, 9264, 9368, 12840,5, 16318, 17116,7, 17947, 18308 und 20098 kHz. Sie teilt den Schiffen mit, auf welchen Kanälen die Landstation hört, und bestätigt empfangene Nachrichten; was die Schiffe senden, ist verschlüsselt. Ist der Text verstümmelt, nehmen Sie zuerst das Häkchen bei **Invert mark / space** heraus.

### DSC — Digital Selective Calling

DSC ist das digitale Rufsystem des GMDSS: Schiffe und Küstenfunkstellen rufen einander, testen ihre Anlagen und senden Not-, Dringlichkeits- und Sicherheitsmeldungen auf festen MF/HF-Kanälen. Ein Ruf dauert einige Sekunden (100 Bd, zwei Töne im Abstand von 170 Hz).

1. Wählen Sie **DSC** in der Liste **Service** und eine Frequenz. Die Kanäle **Distress & safety** (2187,5, 4207,5, 6312, 8414,5, 12577 und 16804,5 kHz) werden von jeder Küstenfunkstelle überwacht und sind am belebtesten; die Anrufkanäle Küste→Schiff und Schiff→Küste folgen in der Liste.
2. Klicken Sie auf **⇒ Tune & Set IF**. Die Skala geht 1,7 kHz unter die DSC-Frequenz, in USB, mit einem Filter von 1400–2000 Hz.
3. Warten Sie. Küstenfunkstellen antworten und testen viele Male pro Stunde; tagsüber sind meist 8414,5 und 12577 kHz am belebtesten, nachts 2187,5, 4207,5 und 6312 kHz.

Jeder Ruf zeigt die Zeit, die Frequenz, seine Kategorie in Farbe (**DISTRESS** rot, **URGENCY** orange, **SAFETY** gelb, **ROUTINE** blau), das Format und seine Felder: wer wen ruft (eine MMSI mit ihrem Land oder eine Küstenfunkstelle), die Befehle, die Arbeitsfrequenz und bei einem Notalarm Art, Position (📍, ein Link zu einer Karte) und Zeit. ✓ bedeutet, dass das Prüfzeichen stimmt; *✓ (1 rebuilt)* bedeutet, dass ein Zeichen in beiden Kopien verloren ging und daraus wiederhergestellt wurde. **Offset** zeigt den Abstimmfehler und **S/N** den Signal-Rausch-Abstand.

### Zeitzeichen (Time Signals)

Dekodiert Datum und Uhrzeit der Lang- und Kurzwellen-Zeitzeichensender und zeigt, wie spät die Minutenmarke Ihre Seite erreicht hat.

1. Wählen Sie **Time Signals** in der Liste **Service**, dann den Sender und seine Frequenz, und klicken Sie auf **⇒ Tune & Set IF**. Die Skala geht 1 kHz unter den Träger, in USB, mit einem Filter von 700–1300 Hz.
2. Warten Sie. Eine ganze Minute muss sauber ankommen, bevor die Zeit angezeigt werden kann: ein bis zwei Minuten bei gutem Signal. Die Sekunden füllen beim Eintreffen eine Reihe von 60 Feldern.

- **DCF77** (Deutschland, 77,5 kHz) und **MSF** (England, 60 kHz) werden aus der Ein/Aus-Tastung des Trägers gelesen: Datum, Uhrzeit und Sommerzeit.
- **WWV / WWVH** (USA, 2,5 bis 25 MHz) werden aus dem 100-Hz-Hilfsträger gelesen: Datum, Uhrzeit und DUT1.
- **RWM** (Russland, 4996, 9996 und 14996 kHz) sendet kein Datum, nur die Minutenmarke und DUT1, liefert also nur die Zeitlage.
- CHU (Kanada) wurde am 22. Juni 2026 eingestellt und wird nicht angeboten.

Das Panel zeigt UTC und das Datum; die Zeit, wie der Sender sie sendet (*sent as*, seine eigene bürgerliche Zeit); die **Station time**, also UTC in der Zeitzone des Empfängers, ermittelt aus dem QTH-Locator der Station, mit der Sommerzeit, die Ihr Browser anwendet; DUT1 und etwaige Warnungen; und **Arrived**, wie spät die Minutenmarke gegenüber der Uhr Ihres Computers auf der Seite ankam. Dieser Wert enthält die eigene Verzögerung des WebSDR (einige Zehntelsekunden) und den Fehler Ihrer Uhr. Wenn Fading jede einzelne Minute verdirbt, kombiniert der Decoder mehrere Minuten und übernimmt eine Zeit nur, wenn sie deutlich besser passt als jede andere.

### HF Selcall

Selcall (CCIR 493-4) ist der Selektivruf von KW-Landmobil- und Seefunknetzen — Codan, Barrett und andere: ein Burst von ein bis zwei Sekunden, der ein Funkgerät oder eine Gruppe über seine Nummer anruft. Er verwendet dasselbe Signal und dieselben Zeichen wie DSC.

1. Wählen Sie **HF Selcall** in der Liste **Service**, einen Kanal (die 7- und 8-MHz-Kanäle aus der Liste des KiwiSDR) und klicken Sie auf **⇒ Tune & Set IF**. Der Kanal ist die FSK-Mitte; die Skala geht 1,7 kHz darunter, in USB.
2. Jeder Ruf zeigt die Nummern der rufenden und der gerufenen Station (4 oder 6 Ziffern), die Art des Rufs sowie etwaige Befehle und Daten; eine Codan-GPS-Position wird als rohe Ziffern gezeigt. Die Stationen unterscheiden sich darin, welchen Ton sie als Mark senden, daher werden beide Polaritäten gelesen.

### ALE 2G (MIL-STD-188-141)

Die Soundings, Rufe und Nachrichten von KW-Netzen der Behörden, des Militärs und der Gebrauchsfunkdienste: 51 Netze aus der ALE-Liste des KiwiSDR, gruppiert als **Government**, **Military** (darunter MARS) und **Utility**. Es ist derselbe Decoder und dasselbe Bedienfeld wie ALE 2G HAM im FLDIGI-Fenster, das nur die HFLINK-Amateurkanäle listet — siehe die Hinweise zu ALE 2G in Kapitel 10.

1. Wählen Sie **ALE 2G (MIL-STD-188-141)** in der Liste **Service**, ein Netz und einen seiner Kanäle, und klicken Sie auf **⇒ Tune & Set IF**. Die gelistete Frequenz ist die Skala; der Empfänger geht auf USB, oder LSB bei den so gekennzeichneten Netzen, mit einem Filter von 500–2750 Hz.
2. Warten Sie. Soundings kommen jede halbe oder ganze Stunde, Rufe nur, wenn eine Verbindung gebraucht wird.

Es sind öffentliche Listen, die veraltet sein können. Das Users-Fenster zeigt *ALE* für einen Hörer, der es verwendet.

---

## 13. DRM

DRM (Digital Radio Mondiale) ist digitaler Rundfunk auf Kurz- und Mittelwelle. Anders als die übrigen Decoder wird DRM auf dem Server der Station decodiert: Wenn Sie **DRM** drücken, startet der Server für Sie einen Decoder — ubersdr-drm, den Dream-Decoder ohne Oberfläche, den auch UberSDR verwendet — auf dem ganzen 10-kHz-DRM-Kanal und schickt Ihnen das decodierte Audio und seinen Status. Deshalb spielt es in jedem Browser, auch xHE-AAC. Eine Station betreibt höchstens fünf DRM-Decoder gleichzeitig, einen pro Hörer.

### Einrichtung

1. Drücken Sie **DRM** (oder wählen Sie es im Auswahlmenü). Unter der Frequenz steht **DRM**, und der Durchlassbereich umfasst den ganzen 10-kHz-Kanal.
2. Wählen Sie eine Sendung im Auswahlfeld und klicken Sie auf **⇒ Tune**, oder stellen Sie die Skala selbst auf die Mitte eines DRM-Kanals — der Decoder folgt der Skala.
3. Achten Sie auf die Lampen: Sobald **Audio** grün ist, kommt Ton.

Solange DRM eingeschaltet ist, ist der einzige Ton decodiertes DRM. Das eigene Audio des Empfängers ist stummgeschaltet — ohne DRM-Signal hören Sie also nichts. Bei schwachem oder schwundbehaftetem Signal blendet ein beschädigter Rahmen in einen kurzen Nachhall und Stille aus statt in einen Rauschstoß, und der Decoder synchronisiert sich von selbst neu, sobald das Signal zurückkommt; jeder Rahmen erhält außerdem einen zweiten Durchgang der Fehlerkorrektur.

### Die Stationsauswahl

Das Auswahlfeld zeigt den Sendeplan des DRM Reception Project (drmrx.org), den der Server stündlich erneuert: Frequenz, Sender, UTC-Zeiten, die Wochentage, wenn nicht täglich gesendet wird, das Zielgebiet, ✓ wenn Hörer die Sendung bestätigt haben, und HFCC, wenn der Sender sie bei der HFCC angemeldet hat. Die Gruppen sind **Beamed at this station (locator) — on air now**, **On air now — beamed elsewhere, nearest first**, **Later (next 24 h)** und **Medium wave**. **Confirmed only**, standardmäßig eingeschaltet, blendet unbestätigte Einträge aus. Die Reihenfolge richtet sich nach dem Locator der Station (`grid_locator` im Abschnitt `[websdr]` der Konfiguration): Eine Sendung gilt als auf die Station gerichtet, wenn ihr Zielgebiet bis auf etwa 1000 km an sie heranreicht; ist das Zielgebiet unbekannt ("Various"), zählt das Land des Senders. Ohne Locator stehen die laufenden Sendungen in einer Gruppe. Weit entfernt ausgerichtete Sendungen sind oft schwach oder gar nicht zu hören. **heard here** kennzeichnet eine Sendung, die dieser Empfänger in den letzten 30 Tagen decodiert hat — der Decoder merkt sich jeden Dienst, den er decodiert, nie aber, wer zugehört hat —, und **Confirmed only** lässt auch diese stehen; eine Sendung, die in keinem Sendeplan steht, etwa eine Testaussendung, erhält oben eine eigene Gruppe, **Heard on this receiver — on air now, in no schedule**, über die halben Stunden, in denen sie gehört wurde.

Gut zu empfangen in Europa (Winterplan ab 25. Oktober 2026): Radio Romania International auf 9720 kHz (17:00–18:00 UTC), 9570 kHz (18:00–19:00), 6110 kHz (19:00–20:00) und 5955 kHz (19:00–19:30). Die Sendepläne wechseln Ende März und Ende Oktober, und die Auswahl folgt ihnen.

### Das Panel lesen

| Element | Bedeutung |
|---|---|
| **Signal, Time, Frame, FAC, SDC, Audio** | Die Synchronlampen: grün OK, gelb Datenfehler, rot CRC-Fehler, grau nicht vorhanden. Ton kommt, wenn **Audio** grün ist. |
| **WMER** | Die Größe, die über das Decodieren entscheidet: ab etwa 10 dB wird das Audio decodiert. |
| **MER, SNR** | Modulationsfehlerverhältnis und Signal-Rausch-Verhältnis, in dB. |
| **Mode, BW, QAM, Prot** | Robustheitsmodus (A–E), Kanalbandbreite, MSC-Konstellation und Schutzstufen. |
| **Codec** | AAC, AAC+SBR oder xHE-AAC, wie der Sender es signalisiert. |

Darunter stehen Name, Land, Sprache und Audiomodus des Senders sowie seine Textmeldung. „No decoder on the server for …“ bedeutet, dass diese Station den Codec nicht decodieren kann.

**Für Sysops.** Der Decoder wird von `./setup-drm.sh` gebaut (die Installer führen es aus, `update.sh` bietet es an), und der Helfer `autorun/drm-helper.js` startet und stoppt mit dem Empfänger; `DRM_ENABLED=0` vor dem Startskript schaltet ihn ab. Siehe das Installationshandbuch. Führen Sie nach einem Update `./setup-drm.sh` erneut aus: Es patcht und baut den Decoder neu (weniger Aussetzer, keine Rauschstöße bei xHE-AAC); der neue Decoder wird verwendet, sobald der Helfer mit dem Empfänger neu startet.

---

## 14. Allgemeine Tipps

**Decoder: ON muss zuerst eingeschaltet werden.** Das Auswahlmenü ist deaktiviert (ausgegraut), bis Sie die Decoder-Schaltfläche anklicken.

**Immer nur ein Decoder.** Die Auswahl eines neuen Decoders im Menü beendet automatisch den zuvor aktiven und setzt alle von ihm vorgenommenen Betriebsart- oder Durchlassbereichsänderungen zurück.

**Die Betriebsart wird für Sie verwaltet.** HF-FAX und NAVTEX schalten den Empfänger sofort nach der Auswahl auf USB, SSTV wählt das Seitenband anhand des Bandes (LSB unter 10 MHz, USB darüber), und FAX passt zusätzlich den Durchlassbereich an, wenn Sie seine Tune-Schaltfläche anklicken. NAVTEX verengt den Durchlassbereich sofort beim Start auf 350–650 Hz NF, FLDIGI auf das Fenster seiner Variante — ob über die Schaltfläche, die Auswahlliste oder eine Markierung. Ein Klick in den Wasserfall stellt das eigene Filter des Decoders wieder her; das Ziehen der Filterkanten oder das Mausrad lässt ein von Hand eingestelltes Filter unverändert. FT8, FT4, FT2, JS8 und WSPR tun dasselbe, sobald Sie sie auswählen — über die Schaltflächenreihe oder das Auswahlmenü: Der Empfänger schaltet auf USB und erhält den passenden Durchlassbereich — das gesamte 3-kHz-Teilband für die FT8-Familie, 1350–1650 Hz für WSPR. Beim Beenden des Decoders wird die Standardbetriebsart des Bandes wiederhergestellt.

**Das Einschalten eines Decoders unterbricht den Ton nicht mehr.** Die Decoder laufen in eigenen Threads, sodass es beim Starten, Stoppen oder Wechseln weder Lücke noch Klick noch Aussetzer gibt.

**Die Genauigkeit der Systemuhr zählt.** FT8, FT4 und WSPR sind zeitkritisch. Sie dekodieren in festen, an UTC ausgerichteten Fenstern. Weicht Ihre Rechneruhr um mehr als 1–2 Sekunden ab, sinken die Dekodierraten deutlich. Halten Sie Ihre Uhr mit einem NTP-Client genau.

**Die Rauschfilter erreichen die Decoder nicht.** NR, NB, NS und AN sind
Hörhilfen, ausschließlich für Ihre Ohren. Jeder Decoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, jede FLDIGI-Betriebsart, SSTV und der QRSS-Grabber — greift das Audio *vor* diesen Filtern ab; stellen Sie sie also so ein, wie es am besten klingt, ohne sich um die Decodierqualität zu sorgen. Aus demselben Grund laufen die Decoder weiter, während der Empfänger stummgeschaltet oder zugerauscht ist: Sie können den Lautsprecher abschalten und einen Decoder oder eine Nacht-QRSS-Aufzeichnung weiterlaufen lassen. Was dem Gehörten tatsächlich folgt, ist allein das Audio-Spektrogramm, das bewusst das gefilterte Audio zeigt.

**Signalqualität schlägt Signalstärke.** Die meisten dieser Decoder sind für schwache Signale ausgelegt. Ein ruhigeres Band mit geringerem Rauschen ist oft ergiebiger als ein lautes, störungsreiches Signal. Nutzen Sie Wasserfall und Durchlassbereichseinstellungen, um QRM zu erkennen und zu meiden, bevor Sie einen Decoder aktivieren.

**Nutzen Sie die Schaltflächen Refresh oder Clear großzügig.** FAX-Bilder verlaufen, wenn die Anzeigefrequenz leicht danebenliegt, und Textdecoder sammeln Störzeichen an. Ein Neuanfang nach Abstimmkorrekturen liefert oft eine deutlich sauberere Ausgabe.

### Automatisches Spot-Reporting und Systemgraphen

FT8-, FT4- und WSPR-Dekodierungen kann auch der Server selbst hochladen — FT8/FT4 an PSK Reporter, WSPR an WSPRnet — über einen Autorun-Daemon, den der Sysop im Admin-Panel startet. Er ist von den Decodern in Ihrem Browser unabhängig: er läuft weiter, ob jemand zuhört oder nicht, und nichts, was Sie im Browser dekodieren, wird gemeldet. Der Sysop legt dort auch fest, auf welchen Bändern, in welchen Betriebsarten und zu welchen UTC-Stunden gemeldet wird.

Der Sysop verfolgt ihn über zwei Zähler, die leicht zu verwechseln sind: Die Kacheln je Decoder zählen die seit dem letzten Start des Daemons hochgeladenen Spots, während die Zahl neben dem Kontrollkästchen jedes Bands bzw. jeder Betriebsart der Gesamtwert seit Beginn ist und Neustarts übersteht. Dasselbe Panel enthält eine Seite **Graphen**, die CPU-Takt, CPU-Last, CPU-Temperatur und Nutzer online über die letzten 15 Minuten bis 24 Stunden darstellt. Beides beschreibt das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — sv1btl-Fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
