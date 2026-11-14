# PhantomSDR-Plus — Korisnički priručnik za dekodere

Ovaj vodič obuhvaća sve ugrađene dekodere dostupne u PhantomSDR-Plusu. Svi se dekoderi uključuju na isti način, opisan u nastavku, nakon čega slijede upute za postavljanje svakog pojedinog dekodera.

---

## Sadržaj

1. [Kako pokrenuti dekoder](#1-kako-pokrenuti-dekoder)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morseov kod](#5-cw--morseov-kod)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet i APRS](#10-fldigi--ale-2g-rtty-psk31-olivia-fst4w-mfsk-msk144-dominoex-thor-throb-hellschreiber-mt63-packet-i-aprs)
11. [SSTV](#11-sstv)
12. [SERVICES](#12-services)
13. [DRM](#13-drm)
14. [Opći savjeti](#14-opći-savjeti)

---

## 1. Kako pokrenuti dekoder

Svim se dekoderima pristupa iz odjeljka **Decoder Options**, smještenog ispod kontrola audiospektrograma na glavnoj ploči.

**Koraci:**

1. Kliknite gumb **Decoder: OFF** da biste ga prebacili u **Decoder: ON** (kad je aktivan, postaje plav).
2. Otvorite padajući izbornik koji se pojavljuje desno od gumba i odaberite željeni dekoder.
3. Ploča odabranog dekodera pojavit će se ispod kontrola — slijedite upute za taj dekoder u odgovarajućem odjeljku ovog vodiča.
4. Da biste zaustavili dekodiranje, odaberite **— Select decoder —** iz padajućeg izbornika ili kliknite gumb **Decoder: ON** da ga vratite na OFF.

### Gumbi dekodera na jedan pritisak

Padajući izbornik nije jedini put. Glavna ploča ima red gumba **Decoders** — odmah ispod **Wheel Tuning Steps** — s po jednim gumbom za svaki dekoder:

| Gumb | Dekoder | Gumb | Dekoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **FLDIGI** | ALE 2G HAM, RTTY, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (zrakoplovi), Pomorski FSK / SITOR, Meteorološki RTTY, Mornarički RTTY (PBB), DSC (brodovi), Time Signals (vremenski signali), HF Selcall, ALE 2G |
| **WSPR** | WSPR | **DRM** | DRM — digitalno emitiranje |

Pritisak na gumb odrađuje cijeli slijed odjednom: odabire dekoder, uključuje dekoder (ON) i dovodi njegov prozor na zaslon. Gumb je plav dok njegov dekoder radi. **Ponovni pritisak na isti gumb isključuje dekoder** — njegov se prozor zatvara s njim.

Gumbi, padajući izbornik i gumb ON/OFF upravljaju istim stanjem, pa što god upotrijebili, ostalo ga slijedi.

### Pokretanje dekodera s oznake frekvencije

Oznaka frekvencije (žute oznake iznad vodopada, iz `markers.json`) inače ugađa prijemnik i postavlja način rada upisan u nju. Kada je taj način ime digitalnog načina rada, klik na oznaku umjesto toga pokreće njegov dekoder, točno kao da ste pritisnuli njegov gumb:

| Način rada oznake | Pokreće | Frekvencija oznake je |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | taj dekoder | frekvencija na skali |
| `NAVTEX` | NAVTEX | frekvencija signala (skala ide 500 Hz niže) |
| `FAX`, `WEFAX` | HF FAX | objavljeno središte (skala ide 1900 Hz niže) |
| `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR` | FLDIGI kao amaterski RTTY (`RTTY`); SERVICES na meteorološkom RTTY-u, mornaričkom RTTY-u (PBB CARB) ili pomorskom FSK / SITOR | frekvencija signala (skala ide niže za audio središte ploče) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI u toj inačici | kao gore |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI u toj inačici i tom podnačinu | kao gore |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI u toj inačici i tom podnačinu | kao gore |
| `PACKET`, `APRS` | FLDIGI u toj inačici | kanal; 300 Bd (USB) ispod 30 MHz, 1200 Bd (FM) iznad |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 na gornjem / donjem bočnom pojasu (`RADE` i `FREEDV` znače gornji) | frekvencija dial-a |
| `RADE2` | FreeDV RADE V2 (beta), uvijek gornji bočni pojas | frekvencija dial-a |
| `HFDL` | SERVICES · HFDL | frekvencija skale (USB; HFDL signal je 1440 Hz iznad nje) |
| `DSC`, `SELCALL` | SERVICES na DSC ili HF Selcall | DSC frekvencija ili Selcall kanal (skala ide 1,7 kHz niže) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES na Time Signals, s tom postajom | nosilac (skala ide 1 kHz niže) |
| `ALE` | FLDIGI na ALE 2G HAM na HFLINK kanalu, inače SERVICES na ALE 2G | frekvencija skale (LSB za mreže koje ga koriste) |
| `DRM` | DRM | sredina DRM kanala |
| `MORSE` | CW dekoder, s CW-om i filtrom od ±250 Hz | frekvencija signala |

> Istodobno može biti aktivan samo jedan dekoder. Prelazak na drugi dekoder automatski zaustavlja prethodni.
>
> **QRSS grabber** nije dio ovog izbornika — ima vlastiti odjeljak **QRSS** i može raditi istodobno s nekim dekoderom.

**Dekoder koji radi drži način rada i propusni pojas.** Uobičajeno način rada slijedi plan opsega iz `bands-config.js`: pomaknite ugađanje u odsječak označen kao LSB ili AM i prijamnik se prebaci na njega. Dok dekoder radi, toga više nema. Dekoder zadržava način rada koji mu treba (USB kod većine, vlastiti kod RADE-a) i propusni pojas koji mu treba — PSK31 oko ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber i MT63 svoju punu širinu, RTTY svoj shift — i oboje preživljava preugađanje, uključujući skok na drugi opseg. Bez toga bi FT8 na 40 m prebacio prijamnik na LSB čim se ugađanje pomakne, a uski propusni pojasi dekodera opet bi se raširili na puni SSB filtar.

### Decoder ID — automatsko prepoznavanje načina rada

Iznad gumba dekodera nalazi se okvir **Decoder ID**. Odgovara na pitanje *„što ovo slušam?"* kada naiđete na digitalni signal koji ne možete prepoznati, a zatim vam jednim klikom nudi odgovarajući dekoder.

Prema zadanim postavkama je **isključen** i dok je isključen ne troši ništa. Pritisnite **On** i ostavite signal ugođenim. Otprilike pola minute prikazuje *Listening…* s trakom napretka — mjerenja vremena moraju vidjeti dva potpuna FT8 ciklusa da bi imala smisla — a zatim imenuje način rada:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* **Način rada** i vrijednost **pouzdanosti**. Zeleno iznad 75 %, žuto iznad 50 %, narančasto ispod — narančasti odgovor shvatite kao naznaku, ne kao presudu.
* **Što je zapravo izmjereno**: zauzeta širina pojasa, razmak tonova, brzina simbola, trajanje rafala, UTC mreža kojoj odgovara, odnos signal/šum. To je dokaz iza presude, kako biste mogli i sami prosuditi.
* **Use <način>** pokreće ispravan dekoder, točno kao da ste pritisnuli njegov gumb — i namješta prijamnik za rad tim načinom. Za načine koji žive u FSK ploči dodatno odabire ispravnu varijantu — RTTY, PSK31 ili Olivia u FLDIGI, Weather RTTY u SERVICES.
* Sljedeći kandidati navedeni su iza **or**. Klikom isprobajte njega, pa vas pogrešan prvi odgovor ništa ne stoji.
* **📻** znači da je frekvencija na koju ste ugođeni poznata pozivna frekvencija za taj način rada i da je to utjecalo na poredak.

Nikada sam ne mijenja vaš dekoder. Uvijek samo predlaže. A čim pokrenete dekoder — s reda gumba, s padajućeg izbornika ili s vlastitog gumba **Use** unutar Decoder ID-a — Decoder ID se sam isključuje: njegov je posao bio odabrati jedan, a dekoder sada traži isti zvuk.

**Što prepoznaje:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY na 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV i DSC. **Use DSC** i prijedlog Weather RTTY pokreću SERVICES na toj usluzi (poglavlje 12).

---

## 2. FT8

**Što je to:** FT8 je popularan digitalni način rada za slabe signale koji radioamateri koriste diljem svijeta. Emisije traju točno 15 sekundi, a protokol može primiti signale do 20–25 dB ispod razine šuma. To je najčešće korišten način rada za veze na velike udaljenosti (DX).

### Preporučene frekvencije (USB)

| Pojas | Frekvencija |
|-------|-------------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Postavljanje

1. Ugodite se na jednu od gore navedenih FT8 frekvencija i postavite način rada na **USB**.
2. Uključite dekoder i iz padajućeg izbornika odaberite **FT8**. Ili jednostavno pritisnite gumb **FT8**.
3. Ploča **FT8 Messages** automatski se pojavljuje ispod.

### Čitanje ispisa

Popis poruka prikazuje dekodirane emisije kako pristižu. Svaki ciklus od 15 sekundi donosi novu skupinu poruka. Polje **Farthest** (gore desno na ploči) pokazuje najveću udaljenost dekodiranu u trenutačnoj sesiji, u kilometrima. Duga poruka završava s „…”: kliknite njezin redak da pročitate cijelu poruku, prelomljenu u više redaka, i kliknite ponovno da se zatvori. Dok je neki redak otvoren, popis ostaje gdje jest; inače prati najnovije poruke. FT4 i FT2 koriste isti popis.

Tipičan oblik poruke: `CQ DX AA1BB FN31` — CQ poziv pozivnog znaka AA1BB smještenog u polju FN31.

> **Savjet:** FT8 je usko vremenski sinkroniziran. Vaš preglednik koristi sat vašeg računala; ako sat sustava odstupa više od nekoliko sekundi, dekodiranje neće uspjeti. Držite vrijeme sustava usklađeno putem NTP-a.

---

## 3. FT4-FT2

**Što je to:** FT4 je brža inačica FT8-a namijenjena radu u natjecanjima. Svaki ciklus emitiranja traje 7,5 sekundi (polovica FT8-a), zbog čega je dvostruko brži, ali traži nešto jači signal. FT2 je još brža inačica FT8-a. Riječ je o iznimno brzom 77-bitnom načinu rada s TR razdobljima od 3,75 sekundi (= polovica FT4) — još je eksperimentalan.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Pojas | Frekvencija FT2|
|-------|-----------|
|160 m | 1.843 do 1.846 |
|80 m   | 3.578 do 3.581 |
|60 m   | 5.360 (provjerite lokalne regionalne propise) |
|40 m   | 7.052 do 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Postavljanje

1. Ugodite se na FT4 frekvenciju i postavite način rada na **USB**.
2. Uključite dekoder i iz padajućeg izbornika odaberite **FT4** ili **FT2**. Ili jednostavno pritisnite gumb **FT4** / **FT2**.
3. Ploča **FT4 Messages** ili **FT2 Messages** pojavljuje se ispod, istog rasporeda kao FT8 ploča.

> **Napomena:** FT4 i FT8 koriste različite spektralne formate i nisu zamjenjivi. Pri korištenju ovog dekodera pobrinite se da ste na FT4 frekvenciji.

---

## 4. JS8

**Što je to:** JS8 (način rada koji koristi JS8Call) uzima FT8-ov mehanizam za slabe signale i pretvara ga u način razgovora s tipkovnice na tipkovnicu. Dok FT8 šalje fiksne poruke od 13 znakova, JS8 šalje slobodan tekst u malim dijelovima i spaja uzastopne emisije natrag u cijele rečenice — sve dulje od otprilike dvanaest znakova stiže kroz nekoliko ciklusa od 15 sekundi. Dekodira otprilike jednako duboko kao FT8, pa radi ondje gdje govor i CW više ne prolaze.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija |
|-------|-------------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Brzine

JS8 ima pet brzina. Sve stanice u razgovoru moraju koristiti istu. **Normal** je pozivna brzina i na njoj se odvija gotovo sav promet — počnite od nje.

| Brzina | Ciklus | Širina | Kada se koristi |
|--------|--------|--------|-----------------|
| Slow   | 30 s | 25 Hz  | Vrlo slabe putanje; najosjetljivija |
| Normal | 15 s | 50 Hz  | Uobičajena pozivna brzina |
| Fast   | 10 s | 80 Hz  | Brža razmjena, traži jači signal |
| Turbo  | 6 s  | 160 Hz | Jaki lokalni signali |
| Ultra  | 4 s  | 250 Hz | Eksperimentalna, rijetko se viđa |

### Postavljanje

1. Ugodite se na JS8 frekvenciju i postavite način rada na **USB**.
2. Uključite dekoder i odaberite **JS8** s popisa, ili jednostavno pritisnite tipku **JS8**.
3. Pojavljuje se ploča **JS8 Decoder**. Ostavite **Speed** na *Normal*, osim ako znate da stanica koju tražite koristi drugu.

### Kako čitati ispis

Ploča ima dva popisa.

**Poruke koje još pristižu** prikazuju se na vrhu u zelenoj boji, s trepćućim pokazivačem. JS8 poruka može trajati četiri ciklusa — punu minutu na Normal — pa se ovdje vidi kako se rečenica gradi. Nije greška ako ondje ostane neko vrijeme.

**Dovršene poruke** popunjavaju glavni popis, svaka u svom retku:

| Stupac | Značenje |
|--------|----------|
| Mode | Uvijek `JS8` |
| Hz | Audio frekvencija signala unutar propusnog pojasa |
| dB | Odnos signal-šum u referentnoj širini od 2500 Hz |
| Message | Dekodirani tekst; **pozivni znakovi prikazani su zeleno** |

Tipične poruke:

* `SV1BTL KM17: HB` — heartbeat: stanica javlja da je u eteru, sa svojim lokatorom.
* `KN4CRD: K0OG SNR -05` — usmjerena poruka: KN4CRD javlja K0OG-u da ga prima na −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — slobodan tekst, ovdje opis stanice pristigao kroz četiri ciklusa.

Redak prikazan **blijedo i kurzivom** istekao je prije nego što je stigao njegov posljednji okvir. Tekst je stvaran, ali može biti skraćen.

### Sync offset

Klizač **Sync offset** određuje koliko nakon granice UTC ciklusa počinje snimanje, čime se nadoknađuje kašnjenje audio lanca. Ostavite **Auto** uključen: dekoder mjeri vremenski razmak signala koje čuje i sam se prilagođava.

### Oznake na spektru

> **Savjet:** JS8 je mnogo tiši od FT8. Poslijepodne možete vidjeti jednu emisiju svakih nekoliko minuta, a duga razdoblja bez ičega sasvim su normalna. Dajte mu pet do deset minuta prije nego što zaključite da nešto ne valja. 20m (14.078) i 40m (7.078) uobičajena su mjesta.

---

## 5. CW — Morseov kod

**Što je to:** CW dekoder osluškuje signale Morseova koda (neprekinuti val) i pretvara ih u tekst u stvarnom vremenu. Automatski prati frekvenciju signala i prilagođava se brzini odašiljanja operatera.

### Preporučene frekvencije

CW je aktivan na svim amaterskim pojasevima, obično u njihovu donjem dijelu. Uobičajena mjesta:

| Pojas | Segment |
|-------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Postavljanje

1. Ugodite se na CW signal. Pokretanje dekodera stavlja prijamnik u **CW** (CW-L ostaje CW-L); klik na **CW** u izborniku načina rada također pokreće dekoder.
2. Uključite dekoder i iz padajućeg izbornika odaberite **CW**. Ili jednostavno pritisnite gumb **CW**.
3. Ploča **CW Decoder** pojavljuje se ispod.

### Čitanje ispisa

- Zaglavlje ploče prikazuje otkrivenu frekvenciju signala u Hz (npr. `≈ 700 Hz`) i procijenjenu brzinu odašiljanja u riječima u minuti (npr. `· 22 WPM`).
- Ako signal nije otkriven, zaglavlje prikazuje **scanning…**
- Na praznom kanalu ništa se ne ispisuje, a brzina i ton se ne prikazuju. Dekoder počinje pisati tek kad postoji jasna razlika između pritisnutog i otpuštenog tipkala, što sam šum ne proizvodi, dok signal još čitljiv na oko −10 dB to ima u izobilju.
- Dekodirani tekst kliže u jantarnom fontu jednolike širine. Trepćući pokazivač (▋) označava mjesto na kojem se tekst trenutačno ispisuje.
- Klizač **Pitch** ispred **Clear** postavlja audio ton CW signala dok dekoder radi: od 500 do 800 Hz u koracima od 50 Hz, 600 Hz dok ga ne promijenite. Vaš preglednik pamti izbor. I obično slušanje CW-a je na 600 Hz.
- **Save** sprema dekodirani tekst u datoteku; **Clear** ga briše.

> **Savjeti:**
> - Centrirajte propusni pojas na CW ton. Dekoder radi najbolje kada CW signal leži otprilike između 400 i 900 Hz u audiospektru.
> - Čitaju se brzine od oko 8 do 40 WPM, uključujući Farnsworth odašiljanje (znakovi poslani brzo s duljim razmacima među njima): zaključavanje brzine drži, a slova se ne raspadaju u zasebne riječi. Izrazito ručno tipkan (nepravilan) Morse i dalje može smanjiti točnost.
> - Dekoder daje najbolje rezultate na jednom čistom signalu. Jak QRM od obližnjih signala na istom pojasu može ga zbuniti.
> - Feding (QSB) se prati: signal koji iščezne i vrati se i dalje se čita, a čita se i prva riječ odašiljanja — također na početku odgovora nakon stanke u QSO-u.
> - Svako se slovo odlučuje na samom signalu, a ne na prethodno prebrojanim točkama i crtama, što otprilike prepolovljuje pogrešna slova kod slabih i ručno tipkanih signala.

### CW Browser — svi signali odjednom

Uključite prekidač **Browser — all signals** u CW prozoru da se istodobno dekodiraju svi CW signali između 200 i 3000 Hz, jedan redak po signalu, kao u PSK i Olivia preglednicima. Dok radi, prijemnik se drži na **USB** s filtrom od 200–3000 Hz; vaš način rada i filtar vraćaju se kad ga isključite.

---

## 6. QRSS Grabber

**Što je to:** QRSS je CW odašiljan toliko sporo da jedna točka traje sekundama umjesto milisekundama. Pri toj brzini signal zauzima tek djelić herca, pa dovoljno uska analiza može izvući trag i 20–30 dB *ispod* razine šuma. Uhom se tu nema što pročitati — QRSS se **gleda**, ne sluša. Grabber računa vlastiti vrlo dugi FFT nad zvukom prijamnika i crta klasični grabber prikaz: frekvencija na okomitoj osi, vrijeme klizi slijeva nadesno, a najnoviji stupac je uvijek uz desni rub.

Većina onoga što ćete vidjeti dolazi od MEPT svjetionika (Manned Experimental Propagation Transmitter) — odašiljača vrlo male snage, često nekoliko stotina milivata u žicu, koji se neprekidno identificiraju vrlo sporim Morseom ili FSK uzorcima.

### Gdje gledati

QRSS svjetionici žive u uskim prozorima od 100–200 Hz pri donjem kraju svakog opsega. Ne morate ih pamtiti: grabber ima popis **Band** s prozorima iz tablice, a odabir jednog ugađa na njega i priprema prijamnik za taj način rada (vidi *Otvaranje grabbera*).

| Opseg | Središte prozora | Napomena |
|------|---------------|------|
| 30m | 10.140,00 kHz | Glavni QRSS prozor — daleko najprometniji, danju i noću |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Knights prozor, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Stariji prozor |
| 80m | 3.500,85 kHz | Knights prozor, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Stariji prozor |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | LF QRSS / DFCW |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Stariji prozor |
| 10m | 28.322,00 kHz | Alternativa |
| 6m | 50.294,30 kHz |  |

### Otvaranje grabbera

QRSS grabber **nije** u izborniku dekodera. Ima vlastiti odjeljak **QRSS**, uz kontrole spektrograma i dekodera.

1. Kliknite **🐌 Show**. Pojavljuje se platno grabbera, a kontrole se razotvore pokraj gumba.
2. Odaberite prozor s popisa **Band** i pritisnite **Tune**. To u jednom koraku napravi sve što način rada traži: ugodi na prozor, prebaci prijamnik na **CW** i postavi propusni pojas taman dovoljno širok za odsječak koji gledate. Skala tada pokazuje pravu QRSS frekvenciju, a tragovi padaju na središnju crtu prikaza.
3. Postavite **Speed** prema duljini točke svjetionika.
4. **Centre** i **Span** rade kao i prije; promjena bilo kojega preoblikuje propusni pojas, pa prikaz i prijamnik ostaju usklađeni.
5. Kliknite **🐌 Hide** za zaustavljanje. Vraća se uobičajeni način rada opsega.

### Brzine

| Postavka | Duljina točke | Razlučivost | Prozor analize | Novi stupac svakih |
|----------|---------------|-------------|----------------|--------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

### Kontrole

| Kontrola | Što radi |
|----------|----------|
| **Band** | QRSS prozori iz gornje tablice. **Tune** ugađa na odabrani, u CW-u s prikladnim propusnim pojasom. |
| **Speed** | Postavlja duljinu transformacije — kompromis između frekvencijske i vremenske razlučivosti (tablica gore). |
| **Centre** | Audio frekvencija u sredini prikaza, 100–3000 Hz. |
| **Span** | Visina prikazanog isječka: 20, 50, 100 ili 200 Hz, pri pokretanju 100 Hz — širina jednog QRSS podpojasa. Uži isječak razvlači svaki trag na više piksela. Kod širih isječaka u ploču stane više binova nego što ima redaka piksela; svaki redak tada prikazuje najjači bin koji pokriva, pa se ništa ne može sakriti između redaka. |
| **Gain** | −10 do +40 dB. Pomiče paletu boja u odnosu na izmjerenu razinu šuma; povisite da posvijetlite slabe tragove. |
| **Color** | Rainbow, Green ili Grayscale. |
| **Clear** | Briše platno i poništava referencu šuma. |

### Čitanje prikaza

Frekvencijske oznake teku uz lijevi rub, najviša frekvencija je na vrhu. Ispod platna statusni redak pokazuje odabranu brzinu, stvarno korištenu razlučivost (npr. `0.183 Hz/bin · 5.5 s window`) i brzinu stupaca (npr. `2.7 s/column`).

Što znače oblici:

- **Stabilan nosilac** crta ravnu vodoravnu crtu.
- **Spori Morse** crta tu liniju kao niz kratkih i dugih odsječaka — točke i crte čitaju se slijeva nadesno.
- **Zakrivljeni tragovi ili tragovi koji bježe** dolaze od nestabiliziranog oscilatora svjetionika koji se grije ili hladi. To je normalno i često upravo taj potpis pomaka omogućuje redovitom promatraču da prepozna stanicu.
- **Okomite pruge** preko cijelog isječka su atmosferski praznici ili lokalni impulsi šuma, a ne signal.

> **Savjeti:**
> - Budite strpljivi. Pri QRSS 30 jedan stupac traje 5,5 sekundi, pa cijeli pozivni znak može trebati deset minuta ili više da prijeđe zaslon. Pustite da radi.
> - Ugađanje s popisa **Band** već sužava propusni pojas oko prozora. Ako ste ugodili ručno, učinite to sami: ne mijenja ono što transformacija razlučuje, ali sprječava jake susjede da upravljaju AGC-om prijamnika.
> - Grabber je neovisan o dekoderima — možete ga ostaviti uključenim dok dekoder radi na nečem drugom.
> - Širok span pri sporoj brzini je najzahtjevnija kombinacija; cijela transformacija radi u pregledniku, pa na skromnijem računalu radije odaberite span od 50 Hz.

---

## 7. WSPR

**Što je to:** WSPR (Weak Signal Propagation Reporter, izgovara se „whisper") način je rada svjetionika s iznimno slabim signalima koji kartira putove KV prostiranja diljem svijeta. Svaka emisija traje otprilike 110 sekundi i stane u kanal širine 200 Hz. Dekoder čeka potpuni dvominutni interval usklađen s UTC-om prije dekodiranja.

### Preporučene frekvencije (USB, prikazane)

| Pojas | Prikazana frekvencija |
|-------|------------------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Postavljanje

1. Ugodite se na jednu od gore navedenih prikazanih WSPR frekvencija i postavite način rada na **USB**.
2. WSPR signal zauzima audiopodručje 1400–1600 Hz. Odabir **WSPR**-a obavlja ostalo umjesto vas: prijamnik prelazi na USB, a propusni pojas se sužava na 1350–1650 Hz, što pokriva cijelo područje koje dekoder pretražuje. Dodatno podešavanje nije potrebno.
3. Uključite dekoder i iz padajućeg izbornika odaberite **WSPR**. Ili jednostavno pritisnite gumb **WSPR**.
4. Ploča **WSPR-2 Decoder** pojavljuje se ispod.

### Čitanje ispisa

Ploča prikazuje traku napretka za trenutačni dvominutni interval:

- **Cijan traka se puni** — prikupljaju se podaci signala (0–116 s unutar intervala).
- **Jantarna traka pulsira** — dekodiranje je u tijeku (posljednjih ~4 s intervala).
- **Prazna traka** — čeka se sljedeća parna UTC minuta.

Svaki uspješno dekodirani spot prikazuje se u tablici sa sljedećim stupcima:

| Stupac | Značenje |
|--------|----------|
| UTC | Vrijeme spota (parna minuta) |
| Callsign | Postaja koja je odašiljala |
| Grid | Maidenhead lokator odašiljača |
| Power | Snaga odašiljanja u dBm |
| Freq | Točna audiofrekvencija (Hz) unutar WSPR propusnog pojasa |
| SNR | Omjer signala i šuma u dB |

Kliknite **Clear** da izbrišete popis spotova.

> **Savjet:** WSPR dekodiranje zahtijeva vrlo točno vrijeme sustava (unutar ±1 sekunde od UTC-a). Prvi interval nakon uključivanja dekodera počet će u sljedećoj parnoj UTC minuti — kratko je čekanje uobičajeno.

---

## 8. HF FAX / WEFAX

**Što je to:** HF radiofaks (poznat i kao WEFAX) koriste obalne straže i meteorološke službe diljem svijeta za emitiranje vremenskih karata, karata stanja mora i prizemnih analiza na kratkim valovima. Dekoder rekonstruira sliku redak po redak kako je prima.

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **HF FAX / WEFAX**. Ili jednostavno pritisnite gumb **FAX**.
2. Ploča **HF FAX / WEFAX Receiver** pojavljuje se ispod.
3. **Odaberite postaju** iz padajućeg izbornika Station. Dostupno je više od 20 postaja koje pokrivaju Europu, Aziju, Oceaniju i Ameriku (npr. DDH3/DDK3 Njemačka, SVJ4/GR Grčka, JMH Japan, NMG SAD New Orleans). Tu je i CBM Punta Arenas (Čile). Rasporedi prate NOAA-in svjetski raspored radiofaksa (izdanje od 7. ožujka 2025.); Charleville (VMC, Australija) uključuje svoje dodatne emisije samo na 11030 kHz.
4. Ako postaja emitira na više frekvencija, odaberite željenu iz podizbornika **Frequency**.
5. Kliknite **▶ Tune** da automatski ugodite slap na tu postaju.
6. Način rada automatski se postavlja na **USB**.

### Raspored emitiranja

Kada je postaja odabrana, pojavljuje se tablica odbrojavanja **Next Transmissions** koja prikazuje sljedeće 4 zakazane emisije u UTC-u, uz odbrojavanje u stvarnom vremenu:

- Uobičajeno (sivo/zeleno) — emisija predstoji.
- **Jantarno ⚡** — emisija počinje za manje od 3 minute; odmah pripremite dekoder.
- **Crveno ●** — emisija počinje za manje od 30 sekundi; prijam samo što nije počeo.

### Parametri

Većina postaja koristi standardne zadane vrijednosti (označene s ★). Mijenjajte ih samo ako znate da postaja koristi nestandardne postavke.

| Parametar | Zadano | Opis |
|-----------|--------|------|
| LPM | 120 ★ | Redaka u minuti — brzina vrtnje bubnja |
| IOC | 576 ★ | Indeks suradnje — određuje broj piksela po retku |
| Shift | 800 Hz ★ | Frekvencijski pomak između tonova crnog i bijelog |

### Kontrole

- **⇔ Auto-align** — uključeno prema zadanom. Automatski se sinkronizira s faznim signalom na početku svake slike. Isključite ga samo ako imate problema s poravnanjem na signalu za koji znate da je dobar.
- **⇅ Invert** — zamjenjuje crno i bijelo. Koristite ako slika izgleda kao negativ (bijela područja ondje gdje bi trebalo biti crno).
- **↺ Refresh** — čisti platno i vraća dekoder na početak. Koristite ga između emisija ili ako se slika trga ili pomiče.
- **⤓ Save PNG** — sprema trenutačno platno kao PNG datoteku na vaše računalo.

### Pokazatelji stanja

Na dnu slike dva pokazatelja tona prikazuju:

- **300 Hz phasing** — svijetli cijan kada je otkriven fazni ton početka slike.
- **450 Hz stop** — svijetli crveno kada je otkriven ton završetka slike.

> **Napomena:** slika klizi prema gore — najnoviji primljeni redak uvijek je na dnu platna. Ako u zaglavlju vidite **[PHASING]**, dekoder se uhvatio za početak nove slike.

---

## 9. NAVTEX

**Što je to:** NAVTEX je međunarodni pomorski sustav emitiranja obavijesti o sigurnosti u priobalju — navigacijskih upozorenja, vremenskih prognoza te obavijesti o traganju i spašavanju. Koristi FSK od 100 bauda (SITOR-B s FEC-om) i prima se na namjenskim kanalima diljem svijeta.

### Dostupni kanali

| Kanal | Frekvencija | Namjena |
|-------|-------------|---------|
| Međunarodni | 518 kHz | Na engleskom, međunarodni |
| Nacionalni | 490 kHz | Emisije na nacionalnom jeziku |
| KV (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | KV NAVTEX velikog dometa |

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **NAVTEX**. Ili jednostavno pritisnite gumb **NAVTEX**. Prijamnik automatski prelazi na **USB**.
2. Pojavljuje se ploča **NAVTEX Receiver**.
3. Odaberite željeni kanal iz izbornika **Station** (npr. `International — 518 kHz`).
4. Kliknite **⇒ Tune & Set IF** da automatski ugodite slap i suzite propusni pojas na ispravan audioprozor. Način rada automatski se postavlja na **USB**. Prikazana frekvencija postavlja se 500 Hz ispod središta kanala, pa se NAVTEX signal pojavljuje na 500 Hz u zvuku. Prikaz frekvencije ipak pokazuje **518.000**: dok je uključen HF FAX, NAVTEX ili prozor FLDIGI, prikazuje frekvenciju samog signala (frekvenciju ugađanja plus audio središte dekodera — 1900 Hz za FAX, 500 Hz za NAVTEX, središte ploče za FLDIGI), a frekvencija tada upisana uzima se kao frekvencija signala.

### Raspored emitiranja

Tablica rasporeda navodi sve poznate postaje na odabranom kanalu s:

- njihovim ITU identifikacijskim slovom i zastavom države
- vremenom sljedeće emisije u UTC-u
- odbrojavanjem u stvarnom vremenu do sljedeće emisije
- **Jantarno ⚡** unutar 2 minute / **Crveno ●** unutar 30 sekundi — odmah pripremite dekoder

### Čitanje ispisa

Dekodirani tekst pojavljuje se u tirkiznom fontu jednolike širine. Granice poruka jasno su označene:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` označava početak poruke. Četiri znaka nakon njega označavaju stanicu (`M`), temu (`A` = navigacijska upozorenja) i redni broj (`12`). Natpis čeka cijelo zaglavlje, pa glasi `ZCZC MA12`, a ne `ZCZC ????`. `NNNN` označava kraj.

Kliknite **Clear** da izbrišete međuspremnik poruka.

> **Napomena:** NAVTEX radi na srednjim i dugim valovima (518/490 kHz). Domet prijama obično iznosi 200–400 nautičkih milja od odašiljača. KV kanali (4–17 MHz) pružaju znatno veći domet.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet i APRS

**Što je to:** jedan prozor za uskopojasne tipkovničke načine rada koje je proslavio program fldigi, s četrnaest inačica koje se biraju iz jednog izbornika. Jedna je pravi FSK (frekvencijsko pomično ključanje): amaterski RTTY; njegovi srodnici iz službi, pomorski FSK (SITOR) i meteorološki RTTY, koriste isti dekoder u SERVICES (poglavlje 12). Ostale dijele isti prozor: **PSK31** (te **PSK63** i **PSK125**, u BPSK ili QPSK), fazno ključanje; **Olivia** (uz srodni način **Contestia**) i **MFSK16/32/64**, višetonski načini s korekcijom pogrešaka; **DominoEX** i **THOR**, inkrementalno frekvencijsko ključanje (THOR s korekcijom pogrešaka); **THROB**, dva tona istodobno, jedan znak po impulsu; **Hellschreiber**, koji tekst slika kao sliku umjesto da ga dekodira; **MT63**, 64 nosioca istodobno; te **Packet (AX.25)** i **APRS**, koji dekodiraju AFSK packet radio — packet od 1200 bauda na VHF/UHF i packet od 300 bauda na KV. Svaka inačica dolazi s postavkom prilagođenom svojim standardnim parametrima. Gumb i stavka izbornika oba se zovu **FLDIGI**; dekodira se ovdje, u pregledniku, a sam fldigi nije potreban.

Tri inačice ne potječu iz fldigija. **ALE 2G HAM** je automatsko uspostavljanje veze (MIL-STD-188-141) amaterske mreže HFLINK i ispisuje njezine pozive i soundinge; mreže državnih službi, vojske i službi nalaze se u SERVICES → ALE 2G (poglavlje 12). **FST4W**, vrlo spori način rada svjetionika na pojasevima 2200 m, 630 m i 160 m, i **MSK144**, za meteor scatter na 6 m i 2 m, potječu iz WSJT-X-a. Nijedna od njih ne ispisuje tekući tekst: svaka ispisuje ono što dekodira redak po redak, s vremenom.

### Inačice i postavke

| Inačica | Središte | Shift | Baud | Okvir | Kodiranje |
|---------|----------|-------|------|-------|-----------|
| Amaterski RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31·63·125 (BPSK/QPSK) | 1000 Hz | — | 31.25 / 62.5 / 125 | — | Varicode |
| Olivia / Contestia | 1000 Hz | — | vidi Mode | — | 7 bita + FEC |
| FST4W | 1500 Hz | — | 1,46 / 0,56 / 0,18 / 0,09 | T/R 120–1800 s | LDPC + CRC-24 |
| MFSK16·32·64 | 1500 Hz | — | vidi Mode | — | Varicode + FEC |
| MSK144 | 1500 Hz | — | 2000 bit/s | T/R 15 / 30 s | LDPC + CRC-13 |
| DominoEX | 1500 Hz | — | vidi Mode | — | Varicode po polubajtovima |
| THOR | 1500 Hz | — | vidi Mode | — | Varicode + FEC |
| THROB / THROBX | 1500 Hz | — | 1, 2 ili 4 | — | parovi tonova |
| Hellschreiber | 1500 Hz | — | vidi Mode | — | slika |
| MT63 | 1000 Hz (najniži nosilac na 500 Hz) | — | 5, 10 ili 20 | — | Walsh + preplitanje |
| ALE 2G | 1625 Hz (tonovi 750–2500 Hz) | — | 125 | riječi od 24 bita, ×3 | Golay (24,12) |
| Packet (AX.25) | tonovi 1200 / 2200 Hz, ili 1700 Hz pri 300 Bd | 1000 Hz, ili 200 Hz pri 300 Bd | 1200 ili 300 | HDLC | AX.25 |
| APRS | kao Packet | kao Packet | 1200 ili 300 | HDLC | AX.25 + APRS |

### Postavljanje

1. Uključite dekoder i odaberite **FLDIGI** iz izbornika. Ili jednostavno pritisnite gumb **FLDIGI**.
2. Pojavljuje se ploča dekodera. Naslov prati inačicu — *FSK / RTTY Decoder*, *BPSK31 Decoder* (ili odabrani PSK način), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* ili *APRS Decoder*. ALE 2G HAM prikazuje *ALE 2G HAM Decoder*; FST4W navodi svoje razdoblje, npr. *FST4W-120 Decoder*; MSK144 prikazuje *MSK144 Decoder*.
3. Odaberite **Variant**. Parametri se ažuriraju automatski.
4. Za PSK31, Oliviju, MFSK, DominoEX, THOR, THROB, Hellschreiber i MT63 postavite **Mode** tako da odgovara emisiji — vidi napomene za svaki način niže. Za Packet i APRS postavite **Speed** — vidi napomene o Packetu i APRS-u niže. Za ALE 2G odaberite mrežu i kanal; za FST4W i MSK144 postavite **T/R period** i **F Tol** — vidi njihove napomene niže.
5. Gdje inačica ima popis, iz izbornika **Known frequency** odaberite uobičajenu frekvenciju i kliknite **Tune** da skočite na nju. Ostali načini nemaju stalnih pozivnih frekvencija: potražite signal na vodopadu i koristite **⟳ Auto-tune Center**.
6. Fino ugađajte dok dekodirani tekst ne postane stabilan i čitljiv.

### Poznate frekvencije po inačici

**Amaterski RTTY**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3583 kHz (80 m), 7040 kHz (40 m), 7072,5 kHz (40 m), 10143 kHz (30 m), 14072,5 kHz (20 m), 14108,5 kHz (20 m, 32/1000), 18099 kHz (17 m), 21072,5 kHz (15 m), 24922,5 kHz (12 m), 28122,5 kHz (10 m)

**FST4W** (središte signala; USB skala ide 1,5 kHz niže)
- 137,5 kHz (2200 m, skala 136,000), 475,7 kHz (630 m, skala 474,200), 1838,1 kHz (160 m, WSPR podpojas, skala 1836,600)

**MSK144** (isto: skala ide 1,5 kHz niže)
- skala 144,360 MHz (2 m, IARU regija 1), 144,150 MHz (2 m, Sjeverna Amerika), 50,260 i 50,280 MHz (6 m), 70,230 MHz (4 m), 28,145 MHz (10 m)

**MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63**
- Nema stalnih pozivnih frekvencija; popis se ne prikazuje. Signal potražite na vodopadu.

**Packet i APRS** (isti popis za oba; svaka stavka postavlja i odgovarajuću brzinu)
- 144,800 MHz — APRS u Europi (IARU Regija 1)
- 144,390 MHz — APRS u Sjevernoj Americi
- 145,175 MHz — APRS u Australiji
- 144,640 MHz — APRS u Kini
- 144,660 MHz — APRS u Japanu
- 145,825 MHz — packet digipeater na ISS-u
- 10147,6 kHz — KV APRS na 30 m, frekvencija na skali u USB-u (300 Bd)

### Parametri

| Parametar | Odnosi se na | Opis |
|-----------|--------------|------|
| Center audio (Hz) | sve | Audio frekvencija sredine između mark i space; za PSK31 nosilac, za višetonske načine središte bloka tonova ili skupine nosilaca. Padajući izbornik za FSK inačice, polje za slobodan unos za sve ostale. Za Packet i APRS polje za slobodan unos samo pri 300 Bd; pri 1200 Bd tonovi su fiksni, 1200 / 2200 Hz, i polje ih samo prikazuje |
| Shift (Hz) | samo FSK | Frekvencijska razlika između tonova mark i space |
| Baud | samo FSK | Brzina simbola |
| Framing | samo FSK | Podatkovni bitovi, paritet, stop bitovi (npr. 7N1 = 7 podataka, bez pariteta, 1 stop) |
| Encoding | samo FSK | Skup znakova (CCIR-476, ITA2/Baudot ili ASCII) |
| Invert mark / space | samo FSK | Zamjenjuje tonove mark i space |
| Auto shift detect | samo FSK | Pokušava automatski izmjeriti shift iz dolaznog signala |
| Mode | samo PSK31 | BPSK31/63/125, QPSK31/63/125 — mora odgovarati emisiji |
| Mode (tonovi / Hz) | samo Olivia, Contestia | Broj tonova i širina pojasa — mora točno odgovarati emisiji |
| Squelch (FEC S/N) | samo Olivia, Contestia | Koliko jako podudaranje korekcije pogrešaka mora biti prije ispisa teksta |
| Browser — all signals | PSK31, Olivia, Contestia | Prekidač: istodobno dekodira sve signale odabranog **Mode** (PSK31: sve BPSK31 signale) između 300 i 2700 Hz, jedan redak po signalu — vidi napomene o PSK Browseru i Oliviji |
| Mode | MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63 | Podnačin (brzina, širina, preplitanje) — mora odgovarati emisiji |
| Squelch (FEC metric) | MFSK | Kvaliteta dekodiranja (0–100) koju signal mora dosegnuti prije ispisa teksta; zadano 22 |
| T/R period | FST4W, MSK144 | FST4W: 120, 300, 900 ili 1800 s — mora odgovarati emisiji. MSK144: 15 ili 30 s; poruka ponovljena unutar jednog razdoblja ispisuje se jednom |
| F Tol | FST4W, MSK144 | Koliko daleko s obje strane **Center audio** dekoder traži: ±50, 100 ili 150 Hz za FST4W, ±50 do ±300 Hz za MSK144 |
| Decode | MSK144 | **Fast**, **Normal** ili **Deep** — koliko se temeljito pretražuje svaki blok; Deep pronalazi najviše i troši najviše CPU-a |
| Squelch (tone / noise) | DominoEX, THOR | 0–100: trenutni ton prema razini ostalih pretinaca tonova; zadano 25 |
| Squelch (S/N) | THROB | U dB; zadano 4 |
| Squelch (FEC S/N) | MT63 | Podudaranje Walshova koda; zadano 4 |
| Reverse | FSK Hell 245 / 105, Hell 80 | Drugi ton slika kao tintu |
| Speed | Packet i APRS | **1200 Bd · VHF/UHF (FM)** ili **300 Bd · HF (USB)**. Bira i način rada prijemnika |
| Show raw packet | samo APRS | Iznad svakog dekodiranog retka ispisuje i paket kako je primljen (format TNC2) |
| Squelch (SNR) | Amaterski, meteorološki i mornarički RTTY | Sprječava da se šum ispisuje kao nasumična slova. Počinje na −5 dB za amaterski RTTY i na −7 dB za meteorološki i mornarički; skroz lijevo (**off**) je isključen. Brojka SNR postaje siva dok je squelch zatvoren |

### Dodatne kontrole

- **⇒ Set IF Band-Pass** — sužava propusni pojas prijamnika tako da tijesno obuhvati signal. Širina prati varijantu: 300 Hz za amaterski RTTY (dovoljno usko da ukloni jaču stanicu 250 Hz dalje, a i dalje čita signal razdešen za 40 Hz), 594 Hz za meteorološki RTTY, mark/space plus rezerva za pomorski FSK, oko ±100 Hz za PSK31 (±200 Hz PSK63, ±400 Hz PSK125) i cijela širina bloka tonova plus rezerva za Oliviju. Propusni pojas prati dekoder kad **Auto-tune** ili **Auto shift detect** pomakne tonove te kad promijenite postavku **Baud**. Za packet od 300 Bd oko ±400 Hz, a za packet od 1200 Bd uobičajeni FM kanal. MFSK, DominoEX, THOR, THROB, Hellschreiber i MT63 dobivaju svoju punu širinu uz rezervu (najmanje 60 Hz sa svake strane, 15 % širine za široke načine). ALE 2G dobiva 500–2750 Hz (zrcaljeno ispod skale na LSB mreži), FST4W svoj raspon **F Tol** plus 150 Hz sa svake strane, MSK144 ±1,1 kHz plus **F Tol**.
- **⟳ Auto-tune Center** — automatsko traženje signala. Za FSK inačice traži uravnotežen par tonova, za PSK31 pronalazi nosilac, a za Oliviju najjači blok odabrane širine pojasa. **Auto shift detect** mijenja shift samo kad je prisutan pravi dvotonski signal, pa više ne skače na šum. Za packet od 300 Bd pronalazi najjači par tonova razmaknutih 200 Hz. Za packet od 1200 Bd gumb je skriven, jer su tonovi tamo fiksni. MFSK, DominoEX, THOR, THROB, Hellschreiber i MT63 traže se kao Olivia, preko vlastite širine. Za ALE 2G, FST4W i MSK144 gumb je skriven.

### Napomene o ALE 2G

ALE (MIL-STD-188-141, druga generacija) način je na koji KV mreže državnih službi, vojske, humanitarnih organizacija i radioamatera pronalaze radnu frekvenciju: postaje pretražuju niz kanala, šalju kratke *soundinge* da najave svoju prisutnost i pozivaju jedna drugu s nekoliko sekundi signala od 8 tonova (125 Bd, 750–2500 Hz).

1. Odaberite **ALE 2G HAM**, stavku neposredno prije Packet u **Variant**. Umjesto uobičajenih postavki ploča prikazuje popis **mreža** i popis **kanala**.
2. Odaberite mrežu i jedan od njezinih kanala pa kliknite **⇒ Tune & Set IF**. Frekvencija s popisa je skala; prijemnik prelazi na USB, ili na LSB za nekoliko tako označenih mreža, s filtrom od 500–2750 Hz.
3. Pričekajte. Soundingi dolaze svakih pola sata ili sat, a pozivi samo kad je potrebna veza, pa kanal može dugo šutjeti.

### Napomene o PSK31

- Dekoder sam ispravlja svoju pogrešku ugađanja u rasponu od otprilike **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125), pa je dovoljno da se približite. **Carrier** u retku mjerenja pokazuje gdje se zaista smjestio.
- **IMD** mjeri kvalitetu odašiljača, a ne prijam: čist signal pokazuje oko −20 dB ili bolje. Loša vrijednost znači da suprotna stanica prepobuđuje svoj odašiljač, a ne da ste vi loše ugođeni.
- Tekst se pojavljuje znak po znak bez korekcije pogrešaka, pa se slab signal degradira u povremena kriva slova umjesto da stane.
- **PSK63 i PSK125** isti su način, dva i četiri puta brži i isto toliko širi; **QPSK31/63/125** dodaju korekciju pogrešaka (Viterbijev dekoder), koja popravlja kratke navale šuma uz otprilike istu razinu signala. Podnačin odaberite pod **Mode** — pogrešan ne ispisuje ništa. Većina PSK prometa i dalje je BPSK31; PSK63 je čest u natjecanjima.
- **PSK Browser (BPSK31).** Prekidač **Browser — all signals** ispod **Mode** istodobno dekodira sve BPSK31 signale između 300 i 2700 Hz, kao preglednik signala u fldigiju: jedan redak po signalu (do 16), s frekvencijom, kvalitetom zahvata i najnovijim tekstom. Signali se sami pronalaze za nekoliko sekundi, a onaj koji 30 s šuti uklanja se. Kliknite redak da se dekodira samo taj signal, kao obični BPSK31 na svojem nosiocu. Dok radi, **Mode** pokazuje BPSK31 i zaključan je; kad se isključi, prozor se vraća na prethodni Mode. Dok traje pregledavanje, propusni pojas otvara se na 200–2800 Hz. Svaki redak čuva svojih posljednjih 4000 znakova u okviru visokom oko šest redaka, s vlastitom trakom za pomicanje kad ima više od šest redaka (radi i kotačić miša); okvir miruje dok čitate. **Save Text** sprema sve retke, i one već uklonjene. Dok preglednik radi, postavke pojedinačnog dekodera (Center audio, ⟳ Auto-tune Center i njegova očitanja) su skrivene.

### Napomene o Oliviji

- **Postavka Mode mora točno odgovarati emisiji.** Pogrešna kombinacija tonova i širine pojasa ne dekodira baš ništa — ne iskrivljen tekst, nego tišinu. Ploča se otvara na **8 / 250**, uskoj konfiguraciji koja se ostavlja uključena na pozivnim frekvencijama; **16 / 500** i **32 / 1000** druga su dva u čestoj uporabi, a nudi se i **16 / 1000**.
- **Contestia** je Olivia s manjim blokom korekcije pogrešaka: otprilike dvostruko brža, samo velika slova i nešto manje otporna. Njezine postavke nalaze se na istom popisu **Mode**, pod *Contestia* (uobičajena je 8 / 250, za slabe veze 4 / 125 i 4 / 250); naslov ploče mijenja se u *Contestia Decoder*. Postavka za Oliviju nikad ne dekodira Contestiju, ni obrnuto.
- **Olivia Browser.** Uključite prekidač **Browser — all signals** ispod **Mode** da se istodobno dekodiraju svi Olivia (ili Contestia) signali te konfiguracije između 300 i 2700 Hz, jedan redak po signalu, kao u PSK Browseru; klik na redak dekodira samo taj signal. Radi s jednom konfiguracijom u isto vrijeme: na **8 / 250** ne vidi postaje 16 / 500. Budući da se Olivia koristi ispod šuma, signale ne traži po jačini: propusni pojas pokriva desetak dekodera jedan uz drugi (oko 5 % jedne jezgre), pa se postaja pojavi čim se dekodiraju njezini prvi znakovi, nekoliko sekundi nakon početka. Unutar jedne širine pojasa prikazuje se samo najjača kopija, a redak se pojavi tek kad sadrži nekoliko znakova pravog teksta.
- Olivia ne šalje preambulu, pa dekoder mora tražiti sinkronizaciju. **Pričekajte nekoliko sekundi** nakon ugađanja prije nego što se pojavi tekst. Polje **Sync** pokazuje `SEARCH` dok se ne zaključa.
- Korekcija pogrešaka radi po blokovima, pa tekst stiže **u naletima, a ne u ravnomjernom toku**, uz kašnjenje od nekoliko blokova između emitiranja i prikaza.
- **Squelch (FEC S/N)** određuje koliko sigurna korekcija pogrešaka mora biti prije ispisa. Zadana vrijednost 4,0 drži šum vani; 3,0 je donja granica ispod koje slučajni šum počinje ispisivati pokoji znak. Dobar signal pokazuje 8–9 na mjeraču **FEC**, pa ima dosta prostora za podizanje squelcha na prometnom opsegu.
- Kad emisija završi, tekst jednostavno stane. Svaki se blok provjerava i zasebno, pa nekoliko blokova koje squelch još propusti dok se zatvara više ne ispisuje niz nasumičnih znakova.

### Napomene o FST4W

- **Dekodira jednom po razdoblju, nakon što ono završi.** Razdoblja počinju po UTC satu — FST4W-120 svake parne minute, FST4W-1800 na puni sat i u pola sata — a traka **Period** pokazuje koliko je tekućeg razdoblja snimljeno. Razdoblje uhvaćeno na pola preskače se, jer se pola poruke ne može dekodirati; sljedeće se snima cijelo. Dekodiranje 30-minutnog razdoblja traje nekoliko sekundi.
- **Odaberite pravo T/R razdoblje.** Dekoder gleda samo ono koje odaberete. Većina LF/MF svjetionika koristi FST4W-120; FST4W-300, -900 i -1800 su za najslabije putove.
- **F Tol** određuje koliko se daleko traži s obje strane **Center audio** (1500 Hz). Zadanih ±100 Hz u WSJT-X-u pokriva podpojaseve svjetionika; ±150 Hz je najviše što propusni pojas dopušta.
- Svaki redak prikazuje UTC, SNR (dB), DT (vremenski pomak, s), frekvenciju (MHz) i poruku, kao u WSJT-X-u, a **Save Text** ih sprema u istom obliku.
- Sat računala mora biti točan na otprilike sekundu, kao za WSPR.

### Napomene o MFSK16 / MFSK32 / MFSK64

- **Odaberite inačicu MFSK16·32·64**, a zatim brzinu na njezinu popisu **Mode**. Tri se načina razlikuju samo po brzini i postavka mora odgovarati: pogrešna ne daje ništa čitljivo.
- **Ugađanje:** postavite blok tonova na frekvenciju **Center audio** ili pritisnite **⟳ Auto-tune Center**. Posljednju četvrtinu tona dekoder ispravlja sam — otprilike ±4 Hz kod MFSK16, ±8 Hz kod MFSK32 i ±16 Hz kod MFSK64 — a **Centre** pokazuje gdje se ustalio. Signal koji je dalje dekoder pronalazi sam, do otprilike ±75 Hz od postavljenog središta: računajte s nekoliko sekundi na početku odašiljanja.
- Tekst kasni za signalom nekoliko sekundi, koliko trebaju preplitanje i korekcija pogrešaka. Jedan ili dva zalutala znaka na samom početku emisije su normalni; fldigi ih također prikazuje.
- **Squelch (FEC metric)** zadržava ispis dok kvaliteta dekodiranja ne dosegne postavku. Zadana vrijednost 22 drži šum vani (sam šum doseže oko 20); dobar signal pokazuje 90 % ili više na pokazivaču **FEC**, a 0 isključuje squelch. Kad emisija završi fldigijevom oznakom kraja emisije, ispis odmah prestaje umjesto da propusti još nekoliko sekundi šuma.
- MFSK prijenosi slika se ne dekodiraju.

### Napomene o MSK144

- **Računajte na duge stanke.** Na mirnom pojasu minutama se ništa ne pojavljuje. Tijekom velikih kiša meteora (Kvadrantidi, Perzeidi, Geminidi) i rano ujutro pingova je mnogo više.
- Svaki redak prikazuje UTC (na sekundu), SNR (dB), T (kada je ping stigao unutar svojeg razdoblja, s), frekvenciju (MHz) i poruku. Poruka ponovno čuta u istom T/R razdoblju ispisuje se jednom, osim ako je nova kopija jača. Slabe kopije iste poruke usrednjavaju se, kao u WSJT-X-u.
- **F Tol** određuje koliko daleko s obje strane 1500 Hz dekoder traži; postaje su rijetko točno na frekvenciji, pa je ±100 Hz dobar početak. **Decode** određuje koliko se temeljito pretražuje svaki blok, a **Deep** pronalazi najviše. **CPU** u retku mjerenja pokazuje opterećenje: iznad 100 % dekoder zaostaje, pa na sporom računalu odaberite **Normal** ili **Fast**.
- Kratke poruke od 40 bita (Sh) ne dekodiraju se: potrebni su im pozivni znakovi obiju postaja, koje slušatelj ne zna.

### Napomene o DominoEX-u i THOR-u

- **Mode** mora odgovarati brzini koja se šalje. DominoEX nudi Micro, 4, 5, 8, 11, 16, 22, 44 i 88; THOR nudi Micro, 4, 5, 8, 11, 16, 22 i brze 25 x4, 50 x1, 50 x2 i 100 (ta četiri koriste jači kod i preplitanje od jedne sekunde). DominoEX 11 i THOR 16 čuju se najčešće.
- **Ugađanje:** postavite blok tonova na **Center audio** ili pritisnite **⟳ Auto-tune Center**. Razdešenost od četvrtine širine signala još se čita.
- **Squelch (tone / noise)** uspoređuje primljeni ton s razinom svih ostalih pretinaca tonova, na ljestvici 0–100. Sam šum ostaje na 20 ili niže; čitljiv prijam pokazuje 35 i više; zadano je 25. To nije fldigijev vlastiti broj: on na nekim potpuno čistim signalima pokazuje samo 26, pa bi ih svaka korisna zadana vrijednost odrezala. Kad odašiljanje završi, ispis prestaje unutar nekoliko simbola umjesto da propušta šum.
- Prijamnik slijedi fldigijeve zadane postavke: tri puta razmaknuta za trećinu FFT pretinca, tvrde odluke za DominoEX, meke odluke i otkrivanje preambule za THOR. Neobavezna MultiPSK korekcija pogrešaka DominoEX-a (u fldigiju zadano isključena) ne dekodira se, kao ni sekundarni tekstni kanal (tekst svjetionika stanice u stankama) ni THOR-ov slikovni način.

### Napomene o THROB-u

- **Ugađanje je kritično.** Tonovi THROB-a 1 i 2 razmaknuti su samo 8 Hz, pa dekoder hvata ±3 Hz razdešenosti (±6 Hz za THROB 4), a ostatak ispravlja vlastitim praćenjem frekvencije. Najprije pritisnite **⟳ Auto-tune Center**: pronalazi signal s točnošću od herca ili dva.
- **Mode** mora odgovarati, THROB ili THROBX i brzina.
- **Squelch (S/N)** — sam šum ostaje ispod 1 dB, čitljiv signal pokazuje 10 dB i više; zadano je 4 dB.

### Napomene o MT63

- **Mode:** MT63-500, -1000 ili -2000 (širina), svaki s preplitanjem **short** ili **long**. Oboje mora odgovarati. Najčešći je MT63-1000 long.
- **Ugađanje:** fldigi šalje najniži nosilac na 500 Hz, pa je središte 500 Hz plus polovica širine: 750, 1000 ili 1500 Hz, postavljeno automatski kad odaberete Mode. Odstupanje do 8 nosilaca dekoder pronalazi sam (±125 Hz za MT63-1000).
- **Tekst kasni** za signalom zbog preplitanja: od oko 1,6 s (MT63-2000 short) do 12,8 s (MT63-500 long). Posljednji znakovi emisije stižu nakon što je signal već prestao.
- **Squelch (FEC S/N)** — sam šum pokazuje oko 3, zaključan signal 4,5 i više; zadano je 4. Squelch skriva trenutak koji sinkronizatoru treba da se na početku zaključa.

### Napomene o Packetu i APRS-u

> **Napomena o načinu rada:** dekoder preuzima upravljanje načinom demodulacije i propusnim pojasom MF dok je aktivan. Oboje se automatski vraća kada ga isključite. Sve inačice koriste **USB**, osim Packeta i APRS-a pri 1200 Bd, koji koriste **FM**.
>
> **Napomena o polaritetu (samo FSK inačice):** za meteorološki i mornarički RTTY (PBB) obično treba označiti **Invert mark / space**. Za pomorski FSK (tipa SITOR/NAVTEX) i amaterski RTTY ostavite neoznačeno — amaterski RTTY šalje mark kao višu radiofrekvenciju, a USB je zadržava kao viši audio ton, što je upravo neoznačeni slučaj. Ako je dekodirani tekst iskrivljen, prvo što treba probati jest prebaciti ovaj okvir. Okvir je skriven za sve inačice osim četiri FSK inačice: ostale nemaju par mark/space, a dekodiranje packeta ne ovisi o tome koji je ton koji.
>
> **Napomena o slovima/brojkama (samo FSK inačice):** Baudot drži slova i brojke u dva odvojena stanja, a šum može prebaciti dekoder u pogrešno — što izobličuje svaki sljedeći znak, ne samo oštećeni. Zato se dekoder na svakom razmaku vraća na slova; to je uobičajena praksa i popravlja pokvareno prebacivanje unutar jedne do dvije riječi umjesto cijelog retka. Cijena je da skupine brojki odvojene razmacima traže da pošiljatelj ponovi prebacivanje na brojke nakon svakog razmaka, kako odašiljači inače i rade.

---

## 11. SSTV

**Što je to:** televizija sporog raščlanjivanja prenosi nepomične slike običnim govornim SSB kanalom, redak po redak, kao frekvencijski moduliran ton između 1500 Hz (crno) i 2300 Hz (bijelo). Puna slika traje između 36 sekundi i 4 i pol minute, ovisno o načinu rada.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija | Način rada | Napomene |
|-------|-------------|------------|----------|
| 20 m | 14.230 MHz | USB | Glavna međunarodna pozivna frekvencija za SSTV — daleko najaktivnija |
| 20 m | 14.233 MHz | USB | Pričuvna, kada je 14.230 zauzeta |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Aktivna tijekom otvaranja pojasa |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regionalna, navečer |

**Bočni pojas bira se umjesto vas.** Pokretanjem dekodera odabire se **LSB ispod 10 MHz** i **USB iznad**, prema uobičajenoj amaterskoj praksi. Na pogrešnom bočnom pojasu preslikavanje tonova je obrnuto i slika se neće dekodirati. Ako naiđete na postaju koja zanemaruje konvenciju, jednostavno ručno promijenite bočni pojas — dekoder nastavlja raditi, briše okvir i kreće iznova s novom postavkom.

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **SSTV**. Ili jednostavno pritisnite gumb **SSTV**. Prijamnik automatski mijenja bočni pojas — USB iznad 10 MHz, LSB ispod.
2. Ugodite se tako da tonovi slike padnu u sredinu propusnog pojasa. Ispravno ugođen signal ima sinkroimpulse na 1200 Hz, a sadržaj slike između 1500 i 2300 Hz.
3. Ostavite **Mode** na **Auto** osim ako već znate što se šalje. Slika se gradi redak po redak kako pristiže.

### Načini rada

| Postavka | Slika | Trajanje |
|----------|-------|----------|
| **Auto** | Otkriva se automatski | — |
| Martin M1 / M2 | 320×256 u boji | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 u boji | 110 s / 71 s |
| Scottie DX | 320×256 u boji | 269 s |
| Robot 36 / 72 | 320×240 u boji | 36 s / 72 s |

### Čitanje ispisa

Statusni redak ispod kontrola pokazuje što dekoder radi:

| Stanje | Značenje |
|--------|----------|
| `Waiting for VIS / AUTO lock` | Osluškuje; još ništa nije prepoznato |
| `Martin M1? verifying sync…` | Pronađen je kandidat i potvrđuje se prema sljedećim recima |
| `Martin M1 lock (VIS)` | Zaključano prema VIS zaglavlju |
| `Martin M1 lock (AUTO)` | Zaključano prema vremenskim odnosima sinkroimpulsa |
| `Martin M1 lock (MANUAL)` | Pokrenuto gumbom **⏺ Force** |
| `Candidate rejected (no sync)` | Kandidat nije potvrđen — uobičajeno na šumu |
| `— sync lost, resetting` | Signal je nestao usred slike |
| `Frame complete` | Primljena je cijela slika |

Prepoznati način rada pojavljuje se i zelenom bojom uz naslov **SSTV**, a brojač redaka pokazuje napredak.

### Kontrole

| Gumb | Radnja |
|------|--------|
| **▶ Start** | Priprema dekoder. Sam po sebi ne crta sliku — zaključavanje i dalje mora doći iz VIS zaglavlja ili iz otkrivanja sinkronizacije. |
| **■ Stop** | Zaustavlja dekodiranje. |
| **↺ Reset** | Čisti platno i ponovno priprema dekoder na mjestu. Koristite ga između slika ili nakon ponovnog ugađanja. |
| **⏺ Force** | Počinje crtati **odmah** u načinu odabranom u izborniku, potpuno preskačući VIS i otkrivanje sinkronizacije. Dostupno samo kada Mode nije **Auto**. |
| **💾 Save** | Sprema trenutačnu sliku kao PNG. |

**Kada koristiti Force.** Ako u slapu vidite sliku, ali se dekoder ne može zaključati na nju — neuobičajen način rada, signal preslab ili previše izobličen za detektore, ili propušteno zaglavlje — odaberite način rada ručno i pritisnite **⏺ Force**. Okvir se usidruje u trenutku klika, a oznaka načina rada prikazuje `MANUAL` kako biste ga razlikovali od VIS ili AUTO zaključavanja. Dekoder se i dalje poravnava prema stvarnom sinkroimpulsu ako ga pronađe, pa se klik koji je malo preran ili prekasan ispravlja.

---

## 12. SERVICES

**SERVICES** (gumb se prije zvao **HFDL**) jedan je prozor za uslužne službe. Popis **Service** gore lijevo u prozoru bira što se dekodira: **HFDL** (zrakoplovi), **Maritime FSK / SITOR**, **Weather RTTY**, **Naval RTTY (PBB CARB)**, **DSC** (brodovi), **Time Signals** (vremenski signali), **HF Selcall** i **ALE 2G (MIL-STD-188-141)**. Vaš preglednik pamti izbor. Radi jedna služba u isto vrijeme; svaka postavlja način rada i filtar koji joj treba, ima vlastiti popis frekvencija s **⇒ Tune & Set IF** i dekodira u vašem pregledniku, pa prijemnik ništa ne košta. Svaka služba ima **💾 Save** (tekstna datoteka) i **Clear**, a prozor Users pokazuje koju službu slušatelj koristi. Amaterski ALE kanali nalaze se u prozoru FLDIGI, kao ALE 2G HAM (poglavlje 10).

### HFDL — poruke zrakoplova

HFDL (HF Data Link) prenosi poruke koje zrakoplovi iznad oceana i udaljenih područja razmjenjuju s zemaljskim stanicama na kratkim valovima: izvješća o položaju, ACARS tekstove, prijave i podatke o frekvencijama. Dekoder je dumphfdl (Tomasz Lemiech, GPL-3) preveden u WebAssembly. Radi u vašem pregledniku na USB zvuku, pa prijemnik ništa ne košta.

#### Postavljanje

1. Pritisnite **SERVICES** i odaberite **HFDL** u popisu **Service**. Prijemnik prelazi na USB s filtrom od 150–2750 Hz.
2. Odaberite **zemaljsku stanicu** i jednu od njezinih frekvencija, pa kliknite **⇒ Tune & Set IF**. Frekvencija s popisa je USB skala; HFDL signal je 1440 Hz iznad nje.
3. Pričekajte. Zemaljske stanice šalju squitter svakih 32 s, a zrakoplovi odgovaraju kad imaju promet. Dekoder sam pronalazi točnu brzinu zvuka (±1 %) i odstupanje frekvencije (±240 Hz) te se zaključava na prvom dekodiranom okviru.

#### Frekvencije

Popis sadrži sve HFDL zemaljske stanice. Danju se iz Europe dobro čuju 17967 kHz (Al Muharraq, Bahrein) i 21955 kHz (Kanari); navečer i noću preuzimaju niže frekvencije Shannona, Reykjavika i Kanara. HFDL oznake frekvencija pokreću dekoder kad ih kliknete.

#### Čitanje izlaza

Svaki redak prikazuje vrijeme (UTC), frekvenciju, smjer (▼ zemlja→zrak ili ▲ zrak→zemlja), zemaljsku stanicu, zrakoplov — registraciju, let i 24-bitnu ICAO adresu, svaku kao poveznicu na FlightAware —, vrstu poruke, njezin SNR i brzinu prijenosa te 📍 položaj kad ga poruka sadrži. ACARS tekst pojavljuje se ispod. Prijeđite mišem preko retka da vidite cijeli okvir. Označite **Squitters** da vidite i najave zemaljskih stanica.

**🗺 Map** u ploči prikazuje zrakoplove koji su javili položaj; **⤢ Large map** otvara istu kartu u prozoru koji se može pomicati i mijenjati mu se veličina. Svaki zrakoplov pokazuje smjer svoje putanje i ostavlja crveni trag. **💾 Save** sprema poruke u tekstnu datoteku, **Clear** prazni popis.

### Pomorski FSK / SITOR, meteorološki RTTY i mornarički RTTY

Ove tri emisije službi koriste FSK dekoder i ploču prozora FLDIGI (poglavlje 10), s popisom **Service** ondje gdje FLDIGI ima popis **Variant**. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space**, **Auto shift detect**, **⇒ Set IF Band-Pass** i **⟳ Auto-tune Center** rade kako je ondje opisano.

| Usluga | Središte | Shift | Baud | Okvir | Kodiranje |
|---------|----------|-------|------|-------|-----------|
| Pomorski FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Meteorološki RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Mornarički RTTY (PBB CARB) | 1000 Hz | 850 Hz | 75 | 5N1.5 | ITA2 |

1. Odaberite **Maritime FSK / SITOR**, **Weather RTTY** ili **Naval RTTY (PBB CARB)** u popisu **Service**.
2. Odaberite **Known frequency** i kliknite **Tune**. Frekvencija s popisa je frekvencija signala; USB skala ide niže za središte ploče.
3. Fino ugađajte dok tekst ne postane stabilan. Meteorološki RTTY treba označeno **Invert mark / space** (predložak to radi sam) i ima klizač **Squelch (SNR)** koji počinje na −7 dB; pomorski FSK ostavlja ga neoznačenim. Mornarički RTTY radi jednako (također invertirano, squelch od −7 dB).

**Pomorski FSK / SITOR:** 2174,5 kHz (MF NBDP, radni kanal), 518 i 490 kHz (NAVTEX), 4209,5 kHz (KV NAVTEX) te KV SITOR kanali za pomorske sigurnosne informacije 4210, 6314, 8416,5, 12579, 16806,5, 19680,5, 22376 i 26100,5 kHz. NAVTEX ima i vlastiti gumb, s rasporedima postaja (poglavlje 9).

**Meteorološki RTTY:** odašiljači DWD-a (Njemačka meteorološka služba) 4583, 7646 i 10100,8 kHz (program 1, na engleskom) te 11039, 14467,3 i 147,3 kHz (program 2, na njemačkom; 147,3 kHz koristi pomak od 85 Hz, koji postavlja njegova stavka popisa). Dok je odabrana frekvencija DWD-a, **NEXT BROADCASTS** prikazuje sljedeće emisije.

**Mornarički RTTY (PBB CARB):** emisija Channel Availability / Receipt Broadcast postaje PBB, Kraljevske nizozemske ratne mornarice u Den Helderu, na 2474, 4250, 4280, 5052, 5214, 5659, 5694,5, 6356, 6358,5, 8439, 9264, 9368, 12840,5, 16318, 17116,7, 17947, 18308 i 20098 kHz. Javlja brodovima na kojim kanalima obalna postaja sluša i potvrđuje primljene poruke; ono što brodovi šalju je šifrirano. Ako je tekst iskrivljen, prvo odznačite **Invert mark / space**.

### DSC — Digital Selective Calling

DSC je digitalni sustav pozivanja GMDSS-a: brodovi i obalne postaje pozivaju jedni druge, ispituju svoju opremu i šalju uzbune za opasnost, hitnost i sigurnost na stalnim MF/KV kanalima. Poziv traje nekoliko sekundi (100 Bd, dva tona razmaknuta 170 Hz).

1. Odaberite **DSC** u popisu **Service** i frekvenciju. Kanale **distress & safety** (2187,5, 4207,5, 6312, 8414,5, 12577 i 16804,5 kHz) prati svaka obalna postaja i najprometniji su; kanali za pozive obala→brod i brod→obala slijede u popisu.
2. Kliknite **⇒ Tune & Set IF**. Skala ide 1,7 kHz ispod DSC frekvencije, u USB-u, s filtrom od 1400–2000 Hz.
3. Pričekajte. Obalne postaje odgovaraju i ispituju opremu mnogo puta na sat; danju su obično najprometniji 8414,5 i 12577 kHz, noću 2187,5, 4207,5 i 6312 kHz.

Svaki poziv prikazuje vrijeme, frekvenciju, kategoriju u boji (**DISTRESS** crveno, **URGENCY** narančasto, **SAFETY** žuto, **ROUTINE** plavo), format i polja: tko koga zove (MMSI sa svojom zemljom ili obalna postaja), naredbe, radnu frekvenciju te kod uzbune za opasnost njezinu prirodu, položaj (📍, poveznica na kartu) i vrijeme. ✓ znači da se kontrolni znak slaže; *✓ (1 rebuilt)* znači da je jedan znak izgubljen u obje kopije i obnovljen pomoću njega. **Offset** pokazuje pogrešku ugađanja, a **S/N** omjer signala i šuma.

### Vremenski signali (Time Signals)

Dekodira datum i vrijeme koje šalju dugovalne i kratkovalne postaje točnog vremena te pokazuje koliko je kasno oznaka minute stigla na vašu stranicu.

1. Odaberite **Time Signals** u popisu **Service**, postaju i njezinu frekvenciju pa kliknite **⇒ Tune & Set IF**. Skala ide 1 kHz ispod nosioca, u USB-u, s filtrom od 700–1300 Hz.
2. Pričekajte. Cijela minuta mora stići čista prije nego što se vrijeme može prikazati: jedna do dvije minute uz dobar signal. Sekunde popunjavaju niz od 60 polja kako pristižu.

- **DCF77** (Njemačka, 77,5 kHz) i **MSF** (Engleska, 60 kHz) čitaju se iz uključivanja i isključivanja nosioca: datum, vrijeme i ljetno računanje vremena.
- **WWV / WWVH** (SAD, 2,5 do 25 MHz) čitaju se iz podnosioca od 100 Hz: datum, vrijeme i DUT1.
- **RWM** (Rusija, 4996, 9996 i 14996 kHz) ne šalje datum: samo oznaku minute i DUT1, pa daje samo vremensku referencu.
- CHU (Kanada) zatvoren je 22. lipnja 2026. i nije ponuđen.

### HF Selcall

Selcall (CCIR 493-4) je selektivno pozivanje KV kopnenih pokretnih i pomorskih mreža — Codan, Barrett i drugih: prasak od sekunde ili dvije koji poziva jedan radio, ili skupinu, po broju. Koristi isti signal i iste znakove kao DSC.

1. Odaberite **HF Selcall** u popisu **Service**, kanal (kanali od 7 i 8 MHz s popisa KiwiSDR-a) i kliknite **⇒ Tune & Set IF**. Kanal je središte FSK-a; skala ide 1,7 kHz niže, u USB-u.
2. Svaki poziv prikazuje brojeve pozivajuće i pozvane postaje (4 ili 6 znamenki), vrstu poziva te eventualne naredbe i podatke; Codanov GPS položaj prikazuje se kao sirove znamenke. Postaje se razlikuju po tome koji ton šalju kao mark, pa se čitaju oba polariteta.

### ALE 2G (MIL-STD-188-141)

Soundingi, pozivi i poruke KV mreža državnih službi, vojske i službi: 51 mreža s ALE popisa KiwiSDR-a, u skupinama **Government**, **Military** (među njima MARS) i **Utility**. To je isti dekoder i ista ploča kao ALE 2G HAM u prozoru FLDIGI, koji ima samo amaterske HFLINK kanale — vidi napomene o ALE 2G u poglavlju 10.

1. Odaberite **ALE 2G (MIL-STD-188-141)** u popisu **Service**, mrežu i jedan od njezinih kanala, i kliknite **⇒ Tune & Set IF**. Frekvencija s popisa je frekvencija skale; prijamnik prelazi na USB, ili LSB za tako označene mreže, s filtrom od 500–2750 Hz.
2. Pričekajte. Soundingi dolaze svakih pola sata ili sat, pozivi samo kad je potrebna veza.

To su javni popisi i mogu biti zastarjeli. Prozor Users prikazuje *ALE* za slušatelja koji ga koristi.

---

## 13. DRM

DRM (Digital Radio Mondiale) je digitalno emitiranje na kratkim i srednjim valovima. Za razliku od ostalih dekodera, dekodira se na poslužitelju stanice: kad pritisnete **DRM**, poslužitelj za vas pokreće dekoder — ubersdr-drm, Dream dekoder bez grafičkog sučelja koji koristi i UberSDR — na cijelom DRM kanalu od 10 kHz i šalje vam dekodirani zvuk i njegovo stanje. Zato svira u svakom pregledniku, uključujući xHE-AAC. Stanica istodobno pokreće najviše pet DRM dekodera, jedan po slušatelju.

### Postavljanje

1. Pritisnite **DRM** (ili ga odaberite u padajućem izborniku). Ispod frekvencije piše **DRM**, a propusni pojas pokriva cijeli kanal od 10 kHz.
2. Odaberite emisiju u izborniku i kliknite **⇒ Tune**, ili sami ugodite skalu na sredinu DRM kanala — dekoder prati skalu.
3. Pratite lampice: čim **Audio** postane zelen, čuje se zvuk.

Dok je DRM uključen, jedini zvuk je dekodirani DRM. Vlastiti zvuk prijemnika je utišan, pa bez DRM signala ne čujete ništa. Kod slabog signala ili signala s fedingom oštećeni okvir utihne u kratku jeku i tišinu umjesto u nalet šuma, a dekoder se sam ponovno sinkronizira čim se signal vrati; svaki okvir uz to prolazi i drugi krug ispravljanja pogrešaka.

### Izbornik stanica

Izbornik prikazuje raspored DRM Reception Projecta (drmrx.org), koji poslužitelj osvježava svaki sat: frekvenciju, stanicu, UTC vremena, dane kad se ne emitira svakodnevno, područje kojemu je emisija namijenjena, ✓ kad su je slušatelji potvrdili u eteru i HFCC kad ju je emiter prijavio HFCC-u. Skupine su **Beamed at this station (locator) — on air now**, **On air now — beamed elsewhere, nearest first**, **Later (next 24 h)** i **Medium wave**. **Confirmed only**, uključen prema zadanim postavkama, skriva unose koje nitko nije potvrdio. Redoslijed slijedi lokator stanice (`grid_locator` u odjeljku `[websdr]` konfiguracije): emisija se smatra usmjerenom na stanicu kad joj ciljano područje dopire do oko 1000 km od nje; kad je cilj nepoznat ("Various"), uzima se država odašiljača. Bez lokatora emisije u eteru prikazuju se u jednoj skupini. Emisije usmjerene daleko često se čuju slabo ili nikako. **heard here** označava emisiju koju je ovaj prijemnik dekodirao u posljednjih 30 dana — dekoder bilježi svaku uslugu koju dekodira, nikada tko je slušao — a **Confirmed only** zadržava i njih; emisija koje nema ni u jednom rasporedu, primjerice probno emitiranje, dobiva vlastitu skupinu na vrhu, **Heard on this receiver — on air now, in no schedule**, u polusatima u kojima je čuta.

### Čitanje ploče

| Stavka | Značenje |
|---|---|
| **Signal, Time, Frame, FAC, SDC, Audio** | Lampice sinkronizacije: zeleno OK, narančasto pogreška podataka, crveno CRC pogreška, sivo nije prisutno. Zvuk se čuje kad je **Audio** zelen. |
| **WMER** | Veličina koja predviđa dekodiranje: od oko 10 dB zvuk se dekodira. |
| **MER, SNR** | Omjer pogreške modulacije i omjer signala i šuma, u dB. |
| **Mode, BW, QAM, Prot** | Način otpornosti (A–E), širina kanala, MSC konstelacija i razine zaštite. |
| **Codec** | AAC, AAC+SBR ili xHE-AAC, kako ga stanica signalizira. |

Ispod su ime, zemlja, jezik i način zvuka stanice te njezina tekstna poruka. „No decoder on the server for …“ znači da ova stanica ne može dekodirati taj kodek.

**Za sysope.** Dekoder gradi `./setup-drm.sh` (pokreću ga instalacijske skripte; `update.sh` ga nudi), a pomoćnik `autorun/drm-helper.js` pokreće se i zaustavlja s prijemnikom; `DRM_ENABLED=0` ispred skripte za pokretanje isključuje ga. Pogledajte priručnik za instalaciju. Nakon ažuriranja ponovno pokrenite `./setup-drm.sh`: zakrpa i ponovno gradi dekoder (manje prekida, bez naleta šuma kod xHE-AAC); novi dekoder koristi se čim se pomoćnik ponovno pokrene s prijemnikom.

---

## 14. Opći savjeti

**Filtri šuma ne dopiru do dekodera.** NR, NB, NS i AN pomagala su za slušanje,
namijenjena samo vašim ušima. Svaki dekoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, svaki FLDIGI način, SSTV i QRSS grabber — uzima zvuk *prije* tih filtara, pa ih slobodno namjestite kako najbolje zvuči, bez brige za kvalitetu dekodiranja. Iz istog razloga dekoderi rade i dok je prijamnik utišan ili pod squelchom: možete ugasiti zvučnik i pustiti da dekoder, ili noćno QRSS snimanje, nastavi prikupljati. Jedino što doista prati ono što čujete jest audio spektrogram, koji namjerno prikazuje filtrirani zvuk.

### Automatska prijava spotova i grafikoni poslužitelja

Dekodiranja FT8, FT4 i WSPR može slati i sam poslužitelj — FT8/FT4 na PSK Reporter, WSPR na WSPRnet — pomoću autorun daemona koji sysop pokreće s administratorske ploče. Neovisan je o dekoderima u vašem pregledniku: radi bez obzira sluša li tko ili ne, a ništa što dekodirate u pregledniku ne prijavljuje se. Ondje sysop određuje i na kojim pojasevima, kojim načinima i u kojim UTC satima se prijavljuje.

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
