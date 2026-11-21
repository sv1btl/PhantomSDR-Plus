# PhantomSDR-Plus — Upravljanje primopredajnikom (CAT)

Držite **vlastiti primopredajnik** i **PhantomSDR-Plus prijemnik** na istoj frekvenciji, načinu rada i filtru. Okrenite gumb za ugađanje na uređaju i slap ga slijedi; kliknite signal na slapu i uređaj se ugodi na njega. Kad odašiljete, prijemnik može utihnuti kako vam ne bi vraćao vlastiti signal.

Radi s prijemnicima **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR**, vašima ili tuđima, i uvijek pomiče samo *vašu* sesiju slušanja — nitko drugi na prijemniku ništa ne čuje ni ne vidi. Operater prijemnika ne mora ništa instalirati ni podešavati.

---

## Što vam treba

Dva načina povezivanja uređaja i jedan uvjet na strani prijemnika:

| Dio | Što je | Sinkronizira |
|---|---|---|
| **[Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) 4.0 ili noviji** | Desktop aplikacija s izbornikom **Rig**. Linux (PC i Raspberry Pi) i Windows. | Frekvenciju, način rada, širinu filtra, utišavanje pri odašiljanju — u jednom ili oba smjera |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Zaseban Windows program koji povezuje uređaj sa stranicom prijemnika u vašem pregledniku. | Frekvenciju i način rada |
| **TCI-CAT na stranici prijemnika** | Gumb na samoj PhantomSDR-Plus stranici, u bilo kojem pregledniku. Govori TCI s ExpertSDR-om, AetherSDR-om ili Thetisom, ili s bilo kojim uređajem koji podržava Hamlib preko malog mosta. Samo na PhantomSDR-Plus prijemnicima s inačicom 4.1.0 ili novijom. | Frekvenciju, način rada i širinu filtra u oba smjera; utišavanje pri odašiljanju |
| **Prijemnik** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR ili UberSDR. PhantomSDR-Plus prijemnik treba **4.1.0** ili noviju za širinu filtra i utišavanje. | Stariji PhantomSDR-Plus i dalje sinkronizira frekvenciju i način rada |

Veći dio ovog priručnika opisuje Desktop PhantomSDR+. Gumb TCI-CAT ima vlastiti odjeljak, [TCI-CAT na stranici prijemnika](#tci-cat-na-stranici-prijemnika). CATsync Tool ima vlastitu dokumentaciju na svojoj web stranici.

---

## Podržani prijemnici

Aplikacija prepoznaje vrstu prijemnika u prozoru stanice i upravlja njime preko vlastitih kontrola te stranice. Prozor Rig control prikazuje pronađenu vrstu pokraj naziva stanice.

| Prijemnik | Frekvencija i način rada | Širina filtra | Utišavanje pri odašiljanju |
|---|---|---|---|
| PhantomSDR-Plus | Da | S 4.1.0 ili novijom | S 4.1.0 ili novijom |
| KiwiSDR (uključujući Web-888) | Da | Da | Da |
| PA3FWM WebSDR | Da, uz promjenu opsega na stranicama s više opsega | Da | Da |
| UberSDR | Da | Da | Da |

Web prijemnik ima manje načina rada od većine uređaja, pa neki načini uređaja dijele jedan način prijemnika: KiwiSDR i WebSDR imaju jedan CW za CW i CW-R. Načini prijemnika navedeni u ovom priručniku su PhantomSDR-Plusovi; ostali prijemnici koriste najbliži ekvivalent. WebSDR drži CW filtar ispod 1 kHz, a ostale filtre na 1 kHz ili šire, jer tako sama stranica prepoznaje CW, a frekvencija izvan svih opsega WebSDR stranice ostavlja se na miru. UberSDR podešava filtar u koracima klizača, pa širina može odstupati do oko 50 Hz od širine na uređaju. Svaka druga vrsta stranice — primjerice OpenWebRX — prikazuje *not a receiver this app can drive* i ništa se ne sinkronizira.

---

## Što radi, a što ne

- Sinkronizira **jedan uređaj s jednim prozorom prijemnika** istodobno.
- Čita obje strane nekoliko puta u sekundi i, kad se razlikuju, jednu podesi prema drugoj. **Ne** odašilje, ne uključuje PTT i nikamo ne šalje zvuk.
- Pomicanje prijemnika mijenja samo vašu sesiju. Ostali slušatelji istog prijemnika to ne osjete, a operater to ne mora dopustiti.
- Serijski port može otvoriti samo **jedan program istodobno**. Ako WSJT-X, dnevnik veza ili alat proizvođača već drži port, upotrijebite izbor **flrig** ili **rigctld on network** kako biste dijelili uređaj umjesto da se programi otimaju za port.

---

## Brzi početak

1. Otvorite stanicu u Desktop PhantomSDR+ kao i obično.
2. **Rig → Rig control...**
3. Pod **Connection** odaberite **Built-in** ako je vaš uređaj na popisu, inače **Hamlib (all rigs)**.
4. Odaberite uređaj, serijski port i brzinu na koju je podešen CAT ili CI-V izbornik uređaja.
5. Pod **Sync** ostavite odabrano **Both directions**.
6. Pritisnite **Connect**. Dva prikaza na vrhu — primopredajnik i prijemnik — trebali bi unutar sekunde pokazati istu frekvenciju.

Svaka se postavka sprema čim je promijenite. Sljedeći put dovoljno je **Rig → Connect**, ili označite **Connect when the app starts**.

---

## Odabir načina povezivanja

| Izbor | Koristite kada | Treba |
|---|---|---|
| **Built-in** | Vaš je uređaj na popisu ispod. | Ništa drugo |
| **Icom LAN / WiFi** (Desktop 6.0) | Vaš je Icom na mreži: IC-705 preko WiFi-ja, ili IC-7300MK2, IC-7610, IC-9700, IC-905, IC-R8600, IC-7760, IC-785x preko LAN priključka. | IP adresa uređaja, Network User ID i lozinka, *Network Control* na ON |
| **Hamlib (all rigs)** | Vaš je uređaj bilo što drugo — Hamlib poznaje više od 300. Aplikacija sama pokreće Hamlibov `rigctld` na privatnom lokalnom portu i zaustavlja ga pri odspajanju. | Windows: ništa, Hamlib je uključen. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Već radi `rigctld`, na ovom ili drugom računalu u vašoj mreži. | Host i port (zadano 4532) |
| **flrig** | flrig već upravlja uređajem za fldigi, WSJT-X ili dnevnik veza. | Pokrenut flrig s njegovim XML-RPC portom (zadano 12345) |

### Uređaji s ugrađenim upravljačem

Prikazane brzine i CI-V adrese tvorničke su vrijednosti koje aplikacija upisuje. **To je samo polazište — postavite ih prema izborniku svog uređaja.**

| Obitelj | Uređaji | Zadana brzina | Napomene |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7300MK2, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 i svaki drugi CI-V uređaj | 19200 | CI-V adresa upisana po modelu (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresa `70`; provjerite izbornik |
| **Yaesu novi CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu klasični CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bita; ugađa u koracima od 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sinkronizira se i širina filtra |
| **Kompatibilni s Kenwoodom** | FlexRadio SmartSDR CAT (virtualni port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, ostali Kenwood-kompatibilni uređaji | 9600–38400 | |

**Prvo najveća brzina (Desktop 6.0).** Icom se spaja prvo na 115200 bauda, zatim na brzinu iz prozora, pa na 19200, 9600, 38400, 57600 i 4800; zadržava se brzina koja odgovori. Uređaj s *CI-V USB Baud Rate* na *Auto* zadržava prvu brzinu koju čuje nakon uključivanja, a vodopad uređaja treba brzu. I Hamlib prvo pokušava 115200 za IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610 i IC-7760.

Uređaj koji bi trebao biti kompatibilan, a ne razgovara s ugrađenim upravljačem, obično radi s **Hamlibom**, koji podnosi mnogo više inačica.

---

## Postavke serijskog porta

| Postavka | Što upisati |
|---|---|
| **Serial port** | Port uređaja. USB adapteri i uređaji s USB portom navedeni su prvi. **Other / network address...** prima port kojeg nema na popisu — `COM7`, `/dev/ttyUSB1` — ili `tcp://host:port` za serijski port koji preko mreže poslužuje ser2net ili slično. |
| **Speed (baud)** | Točno ono što piše u CAT / CI-V izborniku brzine uređaja. Pogrešna brzina izgleda kao uređaj koji nikad ne odgovara. |
| **Stop bits** | 1 za gotovo sve; 2 za obitelj FT-817/857/897. |
| **CI-V address** | Samo Icom, heksadecimalno (`94`, ne `148`). Mora odgovarati izborniku CI-V adrese. |
| **DTR / RTS** | Ostavite **isključeno** osim ako ih vaše sučelje treba. Mnogi CAT kabeli na jednoj od tih linija uključuju odašiljač ili resetiraju uređaj. |
| **Hardware flow control** | Isključeno, osim ako priručnik traži RTS/CTS. |

Za **Hamlib** iste se postavke prosljeđuju `rigctld`-u. Stop bitovi tamo imaju i izbor *Rig default*, a **Extra rigctld options** prima sve ostalo što `rigctld` razumije, npr. `--set-conf=post_write_delay=10`. **rigctld program** pokazuje na određeni `rigctld` ako ih je instalirano više.

---

## Sinkronizacija

### Smjer

| Izbor | Što se događa |
|---|---|
| **Rig → receiver** | Prozor prijemnika slijedi uređaj. Promjena na slapu vraća se na frekvenciju uređaja. |
| **Receiver → rig** | Uređaj slijedi prozor prijemnika. Okretanje gumba na uređaju poništava se. |
| **Both directions** | Pobjeđuje strana koju ste **zadnju** dotaknuli. U trenutku spajanja, prije nego što je ijedna dotaknuta, pobjeđuje uređaj. |

Smjer se može promijeniti i iz izbornika **Rig** tijekom veze.

### Koji prozor prijemnika

**Receiver window** bira koja stanica slijedi uređaj:

- **The station window last in front** (zadano) — s dvije otvorene stanice kliknite u jednu i uređaj slijedi nju.
- **Određena stanica** — uređaj ostaje vezan uz nju, bila ona u prvom planu ili ne. Ako ta stanica nije otvorena, ništa se ne sinkronizira dok se ne otvori.

### Brzina osvježavanja

**Update every** određuje koliko se često čitaju obje strane: 150 ms, 300 ms (zadano), 500 ms ili 1 s. Brže se na gumbu osjeća neposrednije; sporije je blaže prema starom uređaju na 4800 ili 9600 bauda, gdje svako čitanje traje stvarno vrijeme na liniji.

---

## Načini rada

| Način na uređaju | Prijemnik sluša u |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (obrnuto) | CW-L |
| AM, sinkroni AM, DSB | AM |
| FM, uski FM | FM |
| Široki FM | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Podatkovni načini (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Podatkovni LSB, podatkovni FM | LSB, FM |

| Način na prijemniku | Uređaj se postavlja na |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — većina KV uređaja to odbija i ostavljaju se na miru nakon dva pokušaja |
| RADE (gornji / donji) | USB / LSB |

Uređaj u **podatkovnom načinu** u njemu i ostaje: USB prijemnika smatra se usklađenim s USB-D uređaja, pa prijemnik nikad ne izbacuje uređaj iz podatkovnog načina.

---

## Širina filtra

Označite **Sync filter width** da se propusni pojasevi poklapaju. Razlike manje od 60 Hz smatraju se jednakima jer nikoja dva filtra nemaju iste korake.

| Veza s uređajem | Širina filtra |
|---|---|
| Hamlib | Da, gdje ga Hamlib podržava za taj uređaj |
| flrig | Da |
| Ugrađeni Icom CI-V | Da — koraci od 50 Hz do 500 Hz, zatim od 100 Hz do 3,6 kHz; AM u koracima od 200 Hz do 10 kHz; ne u FM-u |
| Ugrađeni Elecraft | Da, u koracima od 10 Hz |
| Ugrađeni Kenwood, Yaesu, obitelj FT-817 | Ne — ti uređaji biraju filtre iz tablica za pojedini model. Za filtar koristite Hamlib |

Prijemnici KiwiSDR, WebSDR i UberSDR uvijek imaju tu kontrolu. PhantomSDR-Plus prijemnik mora imati **4.1.0** ili noviju; na starijem se frekvencija i način rada i dalje sinkroniziraju, a prozor Rig control objašnjava zašto filtar ne slijedi.

---

## Utišavanje pri odašiljanju

Označite **Mute receiver while transmitting**. Dok uređaj odašilje, prozor prijemnika je utišan, a kad prestane, zvuk se vraća. Gumb za utišavanje prijemnika to pokazuje i zvuk uvijek možete vratiti ručno.

Ako ste prijemnik već sami utišali, ostaje utišan i nakon toga.

Treba vezu koja javlja stanje odašiljanja — svi ugrađeni upravljači, flrig i Hamlib za većinu uređaja — i, na PhantomSDR-Plus prijemniku, inačicu 4.1.0 ili noviju.

---

## Pomak frekvencije

**Frequency offset** dodaje se frekvenciji uređaja da bi se dobila frekvencija prijemnika:

> frekvencija prijemnika = frekvencija uređaja + pomak

| Postava | Pomak |
|---|---|
| Transverter za 2 m na uređaju za 10 m (144,100 MHz prikazuje se kao 28,100 MHz) | `116000000` |
| Transverter za 70 cm na uređaju za 2 m (432 → 144) | `288000000` |
| Bez transvertera | `0` |

---

## Izbornik Rig

| Stavka | Što radi |
|---|---|
| **Rig control...** | Otvara prozor Rig control |
| **Connect / Disconnect** *naziv uređaja* | Pokreće ili zaustavlja sinkronizaciju; za Hamlib pokreće ili zaustavlja i `rigctld` |
| **Power on / Power off...** (Desktop 6.0) | Uključuje uređaj preko CAT-a i spaja se, ili (nakon pitanja) ga isključuje i oslobađa. Ne preko flriga, ne za Elecraft |
| **Show rig waterfall and S-meter** (Desktop 6.0) | Prikazuje ili skriva vodopad i S-metar uređaja na vrhu prozora prijemnika - nudi se dok je uređaj spojen |
| **Rig to receiver / Receiver to rig / Both directions** | Smjer sinkronizacije |
| **Sync filter width** | Da / ne |
| **Mute receiver while transmitting** | Da / ne |
| Statusni redak | *Not connected*, *Connecting...*, *Connected: naziv*, ili posljednja pogreška |

---

## Vodopad i S-metar uređaja

*Rig → Show rig waterfall and S-meter* (nudi se dok je uređaj spojen) - ili istoimeni gumb u prozoru Rig control - stavlja traku na vrh prozora prijemnika, iznad stranice stanice. Stranica se spušta da napravi mjesta i zadržava vlastiti raspored.

- **Vodopad** je spektralni prikaz (scope) samog vašeg primopredajnika, kako ga uređaj šalje preko CAT-a: Icom IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760, preko veze **Built-in** ili **Icom LAN / WiFi**. Preko Hamliba ili flriga traka prikazuje samo S-metar, jer `rigctld` i flrig ne mogu proslijediti tok scopea.
- **Boje** su boje stanice: na PhantomSDR-Plus stanici traka koristi shemu boja odabranu na stranici i slijedi je kad je promijenite. Ostali prijemnici (UberSDR, KiwiSDR, WebSDR) dobivaju zadanu shemu boja PhantomSDR-a, pa traka izgleda jednako na svakoj stanici. Klizač **Brightness**, ispred njega, određuje koliko pojasa dobiva boju: lijevo slabi signali ostaju tamni, desno se pojavljuju, a zatim i šum. Klizač **Contrast** određuje koliko se signali ističu iz šuma; pamti se.
- **Klik** na traku ugađa uređaj na to mjesto; prijemnik slijedi preko usklađivanja. Crvena crta je frekvencija uređaja.
- **▴ ▾** čine traku nižom ili višom, **✕** je skriva.
- **S-metar** je S-metar samog uređaja, iscrtan kao digitalni S-metar PhantomSDR-a: cijan segmenti do S9, crveni iznad, na ljestvici S1 … +60 dB, s očitanjem pokraj; *TX* crveno dok odašilje.

IC-7300 šalje oko 4 prolaza u sekundi preko CI-V-a čak i sa scopeom na FAST; to je granica uređaja, a traka se između njih pomiče glatko. Scope treba brzu CI-V brzinu: postavite *CI-V USB Baud Rate* uređaja na 115200 ili *Auto*.

**Icom LAN / WiFi.** Na uređaju: spojite ga na mrežu (IC-705: *MENU › SET › WLAN Set*), postavite *Network Control* na ON i dodijelite *Network User1 ID* i *Password* (*Remote Settings*). U Rig control odaberite **Icom LAN / WiFi**, model, te upišite IP adresu, korisnički ID i lozinku (čuva se šifrirana na ovom računalu). Uređaj prima jedan program za daljinsko upravljanje odjednom, pa prvo zatvorite wfview ili RS-BA1.

---

## Linux

**Dozvola za serijski port.** Serijski portovi pripadaju grupi `dialout`. Korisnik izvan nje dobiva *Could not open ttyUSB0*. Dodajte se jednom, zatim se odjavite i ponovno prijavite:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Instalirajte ga iz svoje distribucije:

```bash
sudo apt install libhamlib-utils
```

Paket `.deb` za Desktop PhantomSDR+ ga preporučuje, pa ga `sudo apt install ./phantomsdr-plus-desktop_6.0.0_amd64.deb` donosi sa sobom; `dpkg -i` ne instalira preporučene pakete. Ugrađeni upravljači i flrig ne trebaju Hamlib.

## Windows

Hamlibov vlastiti `rigctld.exe` uključen je i u 64-bitni i u 32-bitni instalacijski program. COM portovi pojavljuju se na popisu pod svojim nazivom (`COM3`). Ako uređaj treba USB upravljački program, najprije instalirajte onaj proizvođača — do tada port ne postoji.

---

## TCI-CAT na stranici prijemnika

Stranica PhantomSDR-Plus prijemnika može pratiti primopredajnik i **sama**, bez desktop aplikacije: preglednik izravno razgovara s **TCI** poslužiteljem na vašem vlastitom računalu. TCI je WebSocket protokol za upravljanje programa ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) i Thetis (Apache Labs ANAN, Hermes). Za uređaj bez TCI-ja, mali most koji dolazi s PhantomSDR-Plus čini da bilo koji Hamlib uređaj izgleda kao TCI poslužitelj. Od verzije 6.0.0 do uređaja može doći i bez ikakvog TCI softvera, izravno preko njegova USB kabela — vidi *Direct USB* niže.

Potreban je PhantomSDR-Plus prijemnik s inačicom **4.1.0 ili novijom**. Stranice KiwiSDR, WebSDR i UberSDR to nemaju. Direct USB traži 6.0.0 ili noviju.

### Gumb TCI-CAT

Gumb je u redu s **VFO**, **Modes**, **Bands** i **IF Filters** — **TCI-CAT** u širokom rasporedu, **CAT** u sažetom. Njegova točka je **zelena** dok je TCI poslužitelj spojen, a inače **siva**. Otvara prozor s: Do verzije 4.2.0 gumb se zvao **QRG Sync**. Uz **Direct USB** naslov prozora postaje *CAT control via USB*. **CAT Sync**, **Split** i **Mute on TX** stoje u jednom retku pri dnu.

| Kontrola | Što radi |
|---|---|
| **Connection** | **TCI** — ovdje opisani TCI poslužitelj ili most — ili **Direct USB**, uređaj izravno preko USB kabela (vidi *Direct USB* niže) |
| Stanje | *Active — TCI (port 50001)* kad je spojeno; *Inactive* s ⏳ *Wait* dok traži |
| **CAT Sync** | Uključuje ili isključuje usklađivanje frekvencije, načina rada i filtra. Uključen dok je uređaj spojen, odmah dovodi stranicu na frekvenciju, način rada i filtar uređaja |
| **Host** | Računalo na kojem radi TCI poslužitelj: `localhost` za ovo računalo, inače njegova adresa u lokalnoj mreži, npr. `192.168.1.42`. Pritisnite Enter ili kliknite izvan polja za ponovno spajanje |
| **Split** | Vidljiv dok je uređaj spojen. Uključen: ugađanje stranice ostavlja uređaj gdje jest, a uređaj i dalje pomiče stranicu. Isključen (zadano): uređaj prati stranicu i dovodi se na nju čim se Split isključi |
| **Mute on TX** | Vidljiv dok je uređaj spojen. Uključen (zadano): stranica utihne dok uređaj odašilje, uz crvenu oznaku **TX**; isključen: prijamnik nastavlja svirati |
| **Rig scope** | Direct USB s uređajem koji šalje svoj spektroskop preko CI-V-a (IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760): spektroskop samog uređaja kao traka vodopada ispod vodopada prijamnika — vidi *Direct USB* niže |
| **Rig S-meter** | Direct USB s uređajem bez spektroskopa koji preglednik može čitati — Yaesu s novim CAT-om (FT-710, FT-991A, FTDX10, FTDX101, ...) ili Icom bez toka spektroskopa (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100): S-metar uređaja ispod waterfalla prijemnika, ali bez waterfalla — vidi *Direct USB* niže |

Ništa drugo ne treba birati: portovi **50001** (ExpertSDR3, AetherSDR) i **40001** (ExpertSDR2, Thetis) pokušavaju se istodobno i ponovno svakih nekoliko sekundi, pa se stranica spoji čim se program pokrene. **CAT Sync** i **Host** preglednik pamti. **Split** i **Mute on TX** također se pamte.

Preglednici koji traže dopuštenje prije nego što web stranica pristupi lokalnoj mreži — to rade novije inačice Chromea i Edgea — pitaju jednom, pri prvom spajanju. Dopustite, inače točka ostaje siva.

### Što se drži usklađenim

| | Ponašanje |
|---|---|
| **Uređaj → prijemnik: frekvencija** | Pomiče se samo skala. Zoom, svjetlina i kontrast ostaju kako ste ih ostavili; vodopad se pomiče samo kad frekvencija izađe iz prikaza, a plan opsega ne mijenja način rada |
| **Uređaj → prijemnik: način rada** | Prati kad se promijeni način rada uređaja — USB, LSB, CW, AM, FM; digitalni načini kao USB ili LSB. Način koji prijemnik nema ostavlja ga nepromijenjenim. Dekoder koji radi zadržava svoj način |
| **Uređaj → prijemnik: širina filtra** | Propusni opseg prijemnika preuzima širinu filtra uređaja: promjena filtra ili tipka **FIL** na uređaju mijenja propusni opseg. Dekoder koji radi zadržava svoj propusni opseg |
| **Prijemnik → uređaj: frekvencija** | Upisana frekvencija, oznaka ili knjižna oznaka, klik na vodopad i povlačenje propusnog opsega pomiču VFO uređaja. Pri povlačenju šalju se samo promijenjene frekvencije |
| **Prijemnik → uređaj: način rada** | Svaka promjena načina rada na stranici — tipka načina, plan opsega, dekoder, knjižna oznaka — postavlja način rada uređaja (USB, LSB, CW, AM, FM; RADE kao USB ili LSB). Uređaj u digitalnom načinu (USB-D) ostaje u njemu |
| **Prijemnik → uređaj: širina filtra** | Tipke **IF Filters**, IF klizač, povlačenje propusnog opsega i promjena načina rada postavljaju filtar uređaja; pri povlačenju šalje se samo konačna širina. Na Icom uređajima most umjesto toga odabire FIL1, FIL2 ili FIL3 — vidi [Icom filtri](#icom-filtri-fil1-fil2-fil3) |
| **Bez jeke** | Promjena koja je došla s uređaja nikad mu se ne vraća, a javljanje prethodnog načina ili filtra uređaja koje stigne odmah nakon promjene na stranici zanemaruje se |
| **Utišavanje pri odašiljanju** | Prekidač **Mute on TX**, zadano uključen i djelotvoran i uz isključen CAT Sync: stranica utihne dok uređaj odašilje. Pomicanje klizača glasnoće tijekom odašiljanja ostavlja je tihom; pri prijamu zvuk se vraća na trenutnu razinu klizača |
| **Nije podržano** | VFO B, RIT/XIT i pomaci transvertera; prati se samo VFO A prvog prijamnika. **Split** samo sprječava da stranica pomiče uređaj |

### S kojim primopredajnicima radi

| Primopredajnik | Radi | Kako |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Da | Izravno — uključite TCI poslužitelj u programu. Još nije isprobano s tim programima; testirano sa simuliranim TCI poslužiteljem |
| Uređaj s CAT portom koji Hamlib podržava — većina Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Da | Preko Hamlib mosta opisanog dolje. Isprobano s **Icom IC-7300** na Linuxu i Windowsima; drugi upravljački programi mogu se razlikovati u nazivima načina rada ili javljanju PTT-a |
| Uređaj s CAT priključkom preko USB-a — Icom i Xiegu CI-V, Yaesu, Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 | Da | S **Direct USB** niže, bez drugog softvera — u Chromeu, Edgeu, Operi ili Firefoxu 151+ na https:// stranici. Isprobano na **Icom IC-7300** |
| Uređaj bez CAT porta, ili koji Hamlib ne podržava | Ne | Nema odakle pročitati frekvenciju |

### Direct USB (bez TCI softvera, bez mosta)

Od verzije 6.0.0 prozor ima drugu vezu, **Direct USB**: stranica sama razgovara s primopredajnikom preko njegova USB kabela, kroz Web Serial preglednika. Na vašem računalu ne radi ništa drugo — ni TCI softver, ni Hamlib, ni most.

| Potrebno | |
|---|---|
| Preglednik | Chrome, Edge ili Opera, ili Firefox 151 ili noviji, na stolnom računalu. Safari i preglednici na mobitelu nemaju Web Serial |
| Adresa stranice | `https://`, ili `http://localhost` na računalu stanice. Na običnoj `http://` adresi preglednik skriva Web Serial pa je **Direct USB** zasivljen s razlogom; ostaju TCI s mostom ili Desktop PhantomSDR+ |
| Uređaj | CAT priključak preko USB-a: Icom i Xiegu (CI-V), Yaesu (novi CAT i FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 — 54 modela. Na Linuxu vaš korisnik mora biti u grupi `dialout` |

1. Otvorite **TCI-CAT** i odaberite **Connection: Direct USB**.
2. Odaberite **Rig**. Upisuju se uobičajena brzina **Baud** i, kod Icoma, adresa **CI-V**; prilagodite ih izborniku uređaja.
3. Kliknite **Choose port…** i odaberite USB priključak uređaja s popisa preglednika. Firefox prvo jednom pita smije li stranica dobiti serijski pristup. Preglednik pamti priključak za ovaj prijamnik.
4. Uključite **CAT Sync**. Priključak se otvara, a stranica prelazi na frekvenciju, način rada i filtar uređaja.

| Postavka | Što radi |
|---|---|
| **Rig** | 54 modela po proizvođaču, među njima **IC-7300MK2**; **Other CI-V rig** ili **Other Kenwood-compatible rig** za uređaj kojeg nema na popisu |
| **Baud** | Upisuje se s popisa uređaja (115200 za Icome sa spektroskopom) i pamti iz zadnje veze. Ti se Icomi uvijek najprije pokušavaju na 115200; uređaj koji ne odgovara na postavljenoj brzini traži se na 115200, 19200, 57600, 38400, 9600 i 4800, a zadržava se brzina koja odgovori |
| **CI-V** | Samo Icom: adresa uređaja heksadecimalno — `94` za IC-7300, `B6` za IC-7300MK2 |
| **SSB FIL1/2/3** | Samo Icom: širine triju SSB filtara uređaja, zadano `2700,2400,1800` |
| **Lines: DTR, RTS** | Zadano isključeni. Na mnogim CAT kabelima DTR ili RTS uključuje odašiljač ili resetira uređaj — označite ih samo ako ih vaše sučelje treba |

| Gumb | Što radi |
|---|---|
| **Choose port…** | Bira USB priključak (pita se jednom; kasniji posjeti ga ponovno nalaze) |
| **Connect** / **Disconnect** | Otvara ili zatvara priključak. Dok je zatvoren, WSJT-X ili dnevnik veza mogu koristiti uređaj |
| **⏻ Power on** | Vidljiv dok nema veze: uključuje uređaj preko CAT-a, čeka do 15 sekundi da odgovori, pa se spaja. Napajanje uređaja mora ostati uključeno |
| **⏻ Power off** | Vidljiv dok je veza uspostavljena: nakon potvrde isključuje uređaj i oslobađa priključak |

- Priključak se sam otvara samo dok je **CAT Sync** uključen — pri učitavanju stranice i kad se CAT Sync uključi nakon Disconnecta ili izgubljene veze. Samo otvaranje prozora nikad ne oduzima uređaj drugom programu.
- Frekvencija, način rada i filtar prate se u oba smjera kao u tablici gore. Kod Icoma promjena propusnog pojasa samo **odabire** najbliži od FIL1/FIL2/FIL3 prema širinama u **SSB FIL1/2/3**; širine filtara samog uređaja nikad se ne mijenjaju.
- Icom, Kenwood i Yaesu (novi i stari CAT) mogu se uključiti i isključiti. Elecraft se uključuje samo preko svoje linije POWER ON, pa se ovdje može samo isključiti i nema **⏻ Power on**.
- Izvlačenje kabela ili isključivanje uređaja prikazuje *Link lost*; nakon ponovnog priključivanja sam se spaja.
- **Rig scope.** Sa spojenim uređajem koji ima spektroskop, prekidač **Rig scope** prikazuje spektroskop samog uređaja kao traku vodopada ispod vodopada prijamnika, svaki prolaz ispod istih frekvencija kao vodopad iznad, pa se signal u oba poravna — antena stanice gore, vaša dolje. Izvan raspona uređaja traka ostaje tamna, natpis pokazuje raspon, a klik ugađa onamo. Raspon, način centar/fiksno i referentna razina samog uređaja određuju što stiže. Spektroskop treba **115200** bauda (na 19200 stigne 2–3 prolaza u sekundi, i prozor to kaže); tok se zaustavlja pri Disconnectu i zatvaranju stranice. Približite prijamnik na pojas: u punom prikazu 0–30 MHz raspon od ±25 kHz širok je tek par piksela. Isprobano na IC-7300. Dolje lijevo u traci **S-metar** uređaja pokazuje što vaša antena čuje na namještenoj frekvenciji — S-jedinice kako ih uređaj javlja (S9 na sredini trake, iznad +20/+40/+60, kratko zadržavanje vrha, *TX* dok uređaj odašilje), ne dBm; čita se samo dok je Rig scope uključen.
- **Rig S-meter (Yaesu i stariji Icomi).** S Yaesu uređajem s novim CAT-om, ili Icomom koji ne šalje spektroskop preko CI-V-a (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100), prekidač se zove **Rig S-meter** i ispod waterfalla prijemnika prikazuje usku traku sa S-metrom uređaja (S1 … S9+60, *TX* tijekom predaje). Čita se preko CAT-a samo dok je traka vidljiva — `SM0` na Yaesuu, CI-V `15 02` na Icomu — brzinom postavljenom u izborniku uređaja; prekidač je nikad ne mijenja i tim uređajima ne ide nijedna naredba spektroskopa. Waterfalla nema, a prozor objašnjava zašto: ti Icomi ne šalju spektroskop preko CI-V-a, a Yaesu uređaji ne šalju svoj preko CAT-a. Kod FT-710 on ide kroz zaseban FTDI čip u USB kabelu, koji preglednik ne može otvoriti; [Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) čita taj čip i prikazuje waterfall FT-710. Yaesu S-metar provjeren je na pravom FT-710: oko 0,5 dB od vlastitog S-metra uređaja. Kenwood, Elecraft, FT-817/857/897 i ostali uređaji s popisa usklađuju samo frekvenciju, način rada i PTT.
- **IC-7300 na Auto.** S **CI-V USB Baud Rate** na *Auto*, IC-7300 zadržava prvu brzinu koju čuje nakon uključivanja i ne prihvaća kasniju promjenu ni u jednom smjeru. Zato stranica Icomima sa spektroskopom pristupa najprije na 115200, i uz **⏻ Power on**; fiksnih **115200** u izborniku uređaja potpuno izbjegava to pitanje.
- **Uređaji s dva USB priključka.** IC-705 i IC-905 pokazuju *Serial Port A (CI-V)* i *Serial Port B*, IC-7610 i IC-9700 *Enhanced* i *Standard COM Port*, svi s istim USB oznakama. Odaberite CI-V priključak — Port A, odnosno Enhanced; Windows navodi Port B prvi. Ako odabrani priključak ne odgovara, stranica sama pokuša drugi priključak uređaja i zadrži onaj koji odgovori.
- **IC-705 na Windowsu.** Icomov USB upravljački program za IC-705 blokira način na koji preglednici čitaju serijski priključak: Edge i Firefox se zamrznu, a priključak ostaje zauzet dok se kabel ponovno ne priključi. Zato stranica na Windowsu ne otvara IC-705; koristite **Connection: TCI** s Hamlib mostom (`rigctl -m 3085 -r COM6 -s 115200`, COM6 = Port A) ili Desktop PhantomSDR+. Na Linuxu IC-705 koristi upravljački program jezgre.
- Isprobano na **Icom IC-7300**: frekvencija, način rada, filtar, utišavanje pri odašiljanju, Power on i Power off.

### Hamlib most (IC-7300 i drugi uređaji bez TCI-ja)

`tci-bridge/tci-rigctld.mjs` u PhantomSDR-Plus stablu pretvara svaki uređaj kojim Hamlib može upravljati u TCI poslužitelj za stranicu. Radi na **vašem** računalu — onom spojenom na uređaj, uz preglednik — ne na prijemniku. Četiri puta u sekundi pita Hamlib za frekvenciju, način rada, širinu filtra i stanje odašiljanja, šalje stranici samo promjene i prosljeđuje uređaju promjene frekvencije, načina rada i filtra sa stranice.

Do Hamliba dolazi na jedan od dva načina:

| Način | Lanac | Kada |
|---|---|---|
| **`--rigctl`** (preporučeno) | primopredajnik → `rigctl` → `tci-rigctld.mjs` → stranica | Uobičajeno. Most sam pokreće Hamlibov `rigctl`: jedan prozor, bez mrežnog porta. **Koristite ga na Windowsima**, gdje se `rigctld.exe` često odbija porukom *Access is denied* |
| **`rigctld`** | primopredajnik → `rigctld` → `tci-rigctld.mjs` → stranica | Drugi program, poput WSJT-X-a, mora istodobno koristiti uređaj — vidi [Dijeljenje uređaja](#dijeljenje-uređaja-put-preko-rigctld) |

**Što mu treba**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, ili hamlib paket vaše distribucije | `hamlib-w64-….zip` s [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), raspakiran u `C:\hamlib` — `rigctl.exe` je u `C:\hamlib\bin` |
| Node.js | 18 ili noviji | LTS *Windows Installer (.msi)* s [nodejs.org](https://nodejs.org), sa zadanim opcijama |
| Paket `ws` | Unutar PhantomSDR-Plus stabla pronalazi se automatski | Kopirajte `tci-rigctld.mjs` u mapu poput `C:\tci-bridge` i ondje jednom pokrenite `npm install ws` |
| Port uređaja | `ls /dev/serial/by-id/`. Jednom se pridružite grupi `dialout`: `sudo usermod -aG dialout $USER`, zatim se odjavite i ponovno prijavite | Instalirajte USB upravljački program proizvođača; COM broj je u **Upravitelj uređaja → Priključci (COM i LPT)** |

Samo jedan program može držati CAT port uređaja. Prije pokretanja mosta zatvorite WSJT-X, flrig, JS8Call, RS-BA1 ili vezu s uređajem u Desktop PhantomSDR+.

#### Primjer: Icom IC-7300

Na uređaju: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Hamlibov broj modela za IC-7300 je `3073`.

**Linux.** Uređaj je redak koji sadrži `IC-7300` u `ls /dev/serial/by-id/`, obično i `/dev/ttyUSB0`.

1. Provjerite da Hamlib dolazi do uređaja — mora ispisati frekvenciju, npr. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Pokrenite most i ostavite ga da radi:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** Uređaj se u Upravitelju uređaja prikazuje kao *Silicon Labs CP210x USB to UART Bridge (COM4)* — koristite svoj COM broj. U naredbenom retku:

1. Provjerite da Hamlib dolazi do uređaja — mora ispisati frekvenciju:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Pokrenite most i ostavite prozor otvoren:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   Redak je dugačak: provjerite da stvarno završava s `-s 115200`, inače se `rigctl` zaustavlja porukom *Type: rigctl --help*.

Na oba sustava most unutar sekunde ispiše:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Zatim otvorite stranicu prijemnika u pregledniku na istom računalu, otvorite **TCI-CAT** i uključite **CAT Sync**. Točka postaje zelena, a most ispiše `page connected`. Okrenite VFO i prijemnik prati; kliknite na vodopad i uređaj prati (`page -> rig ... Hz`); prijeđite na odašiljanje i stranica utihne. **Ctrl+C** zaustavlja most, a s njim i `rigctl`.

Sve iza `--rigctl` je program `rigctl` s vlastitim opcijama — upravo onima koje su radile pri provjeri. To je pravilo za svaki uređaj: **kad `rigctl … f` ispiše frekvenciju, most radi s istim opcijama.**

#### Icom filtri (FIL1, FIL2, FIL3)

Icom uređaji poput IC-7300 ne prihvaćaju bilo koju širinu filtra: imaju tri filtra, **FIL1**, **FIL2** i **FIL3**, svaki sa širinom postavljenom u izborniku uređaja. S nekom širinom Hamlib bi odabrao jedan od njih i ujedno prepisao njegovu širinu — a na IC-7300 ta širina može završiti na prethodno odabranom filtru i pomiješati postavke. Zato na Icom uređajima most nikad ne šalje širinu: uzima filtar čija je referentna širina najbliža propusnom opsegu stranice i samo ga **odabire**, vlastitom CI-V naredbom uređaja. Širine postavljene na uređaju nikad se ne mijenjaju.

| Način rada | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (i njihovi digitalni načini) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

Na IC-7300 (`-m 3073`) to je automatski. Postavite SSB filtre uređaja odgovarajuće — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (držite **FIL** na uređaju) — pa odabir 2,7 / 2,4 / 1,8 kHz u **IF Filters** odabire FIL1 / FIL2 / FIL3, a pritisak na **FIL** na uređaju postavlja propusni opseg stranice na širinu tog filtra. Most ispisuje, na primjer, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`. IC-7300MK2 (`-m 3094`) obrađuje se jednako, na vlastitoj CI-V adresi B6h; treba mu inačica Hamliba koja poznaje MK2.

| Opcija | Namjena |
|---|---|
| `--filters 3000,2400,1800` | Druge SSB referentne širine, redom FIL1,FIL2,FIL3; uključuje odabir filtra i za drugi Icom uređaj |
| `--civ A4` | CI-V adresa uređaja heksadecimalno, kad nije `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Slati širine preko Hamliba, kao za druge proizvođače |

Obje opcije idu prije `--rigctl`, npr. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Isprobano samo s IC-7300. Drugi proizvođači — Yaesu, Kenwood, Elecraft i ostali — dobivaju širinu stranice preko Hamliba, koji je postavlja koliko god točno uređaj dopušta.

#### Drugi uređaji

Isti koraci vrijede za svaki uređaj koji Hamlib podržava; mijenjaju se samo opcije.

1. **Pripremite uređaj.** U izborniku zabilježite CAT (ili CI-V) brzinu i uključite postavku poput *CAT preko USB-a* ili *CI-V transceive*, ako postoji. Na Windowsima instalirajte USB upravljački program proizvođača.
2. **Pronađite Hamlibov broj modela** na popisu koji ispisuje `rigctl -l`:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Pronađite port.** Linux: `ls /dev/serial/by-id/`. Windows: Upravitelj uređaja. Neki uređaji stvaraju **dva** porta — Yaesuovi FT-991A, FTDX10 i FT-710 zovu ih *Enhanced* i *Standard*; CAT je na **Enhanced** portu.
4. **Provjerite, zatim pokrenite most** s `-m <model> -r <port> -s <brzina>`, kao u primjeru za IC-7300: najprije `rigctl -m … -r … -s … f`, zatim iste opcije iza `--rigctl`.

Neki brojevi modela, iz Hamliba 4.5 — potvrdite ih s `rigctl -l`, jer druga inačica Hamliba može drukčije numerirati uređaj:

| Uređaj | `-m` | Uređaj | `-m` |
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

Dodatne opcije, samo kad zatrebaju:

- **Icom uređaj s promijenjenom CI-V adresom:** dodajte `-c` s adresom u *decimalnom* obliku — `94h` je `-c 148`.
- **Postavka koju Hamlib nudi za taj uređaj:** `rigctl -m <model> -L` ih ispisuje; postavite jednu s `-C ime=vrijednost`, npr. `-C post_write_delay=10` za sporo sučelje.
- **Uređaj koji pri otvaranju porta prelazi na odašiljanje ili se ponovno pokreće:** neki CAT kabeli koriste DTR ili RTS za PTT; dodajte `-C dtr_state=OFF -C rts_state=OFF`.

#### Uređaji kojima upravlja drugi program

Nekim uređajima već upravlja program koji može obaviti posao — ponekad bez ikakvog mosta. Nijedan od ovih načina nije isproban.

| Uređaj i program | Što učiniti |
|---|---|
| **SunSDR** s ExpertSDR2/3, **FlexRadio** s AetherSDR, **Apache Labs ANAN / Hermes** s Thetisom | Bez mosta. Uključite **TCI poslužitelj** programa i koristite **TCI-CAT** izravno — portovi 50001 i 40001 pronalaze se automatski |
| **FlexRadio** sa SmartSDR (Windows) | Dodajte port u **SmartSDR CAT**. Govori Kenwood CAT, pa serijski port ondje radi kao TS-2000: `-m 2014 -r COM8 -s 57600`. TCP port radi s Hamlibovim FlexRadio modelom: `-m 2036 -r 127.0.0.1:<port>` |
| **Bilo koji uređaj kojim upravlja flrig** | Ostavite flrig da radi i koristite Hamlibov flrig model; uređaj ostaje dijeljen s fldigi, WSJT-X-om i programima za dnevnik: `-m 4 -r 127.0.0.1:12345` |
| **Pokrenuti rigctld**, ili program s *Hamlib NET rigctl* poslužiteljem | Pokrenite most bez `--rigctl`, s tom adresom: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Kao i svugdje, opcije idu iza `rigctl` pri provjeri i iza `--rigctl rigctl` za most. Mrežna adresa poput `127.0.0.1:12345` ne treba `-s`.

#### Dijeljenje uređaja: put preko rigctld

Kad WSJT-X ili program za dnevnik mora koristiti uređaj dok most radi, pokrenite Hamlibov poslužitelj `rigctld` s istim opcijama, ostavite ga da radi i spojite oba programa na njega:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Bez `--rigctl` most traži `rigctld` na `127.0.0.1:4532` i ispiše `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` koristi `rigctld` na drugom računalu. U WSJT-X-u odaberite uređaj *Hamlib NET rigctl* na istoj adresi. Na Windowsima je poslužitelj `C:\hamlib\bin\rigctld.exe` s istim opcijama; ako Windows odgovori *Access is denied*, koristite `--rigctl` i zatvorite drugi program dok most radi.

**Portovi.** Most nudi TCI na portu 50001; drugi port stavlja se prvi u naredbeni redak, npr. `node tci-rigctld.mjs 40001 --rigctl …`. Ako su most i preglednik na različitim računalima, u **Host** upišite adresu računala s mostom.

### Rješavanje problema s TCI-CAT

| Simptom | Vjerojatni uzrok | Što učiniti |
|---|---|---|
| Točka ostaje siva | TCI poslužitelj ili most ne radi; pogrešan **Host**; odbijeno je dopuštenje preglednika za lokalnu mrežu | Uključite TCI u ExpertSDR/Thetis/AetherSDR ili pokrenite most; provjerite **Host**; dopustite pristup lokalnoj mreži u postavkama stranice |
| `rigctl … f` javlja pogrešku ili čeka | Pogrešan port ili brzina; nema dopuštenja `dialout` (Linux) ili USB upravljačkog programa (Windows); drugi program drži port | Uskladite `-s` s izbornikom uređaja; provjerite port (`ls /dev/serial/by-id/`, Upravitelj uređaja); zatvorite druge programe za uređaj |
| Most ispisuje *rigctl stopped … Type: rigctl --help* | Naredba je nepotpuna — obično nedostaje brzina iza `-s` | Ponovno upišite cijeli redak |
| Most ispisuje *The value after -s is missing* | Naredbeni redak skraćen je pri lijepljenju | Ponovno upišite kraj retka, npr. `-s 115200` |
| Filtar ne prati u jednom ili drugom smjeru | **CAT Sync** je isključen, na stranici radi dekoder, ili (IC-7300) FIL širine uređaja razlikuju se od 2700 / 2400 / 1800 Hz | Uključite CAT Sync; zaustavite dekoder; postavite FIL širine na uređaju ili navedite `--filters` sa širinama uređaja |
| Most ispisuje *rigctl stopped … rig_open: error* | `rigctl` ne može otvoriti port | Kao za `rigctl … f` gore |
| Most ispisuje *the rig is not answering* | Port se otvara, ali uređaj ne odgovara: pogrešna brzina ili model, CAT isključen u izborniku, ili promijenjena Icom CI-V adresa | Ponovite provjeru `rigctl … f`; za promijenjenu CI-V adresu dodajte `-c` |
| Most ispisuje *rigctld not reachable* | Pokrenut bez `--rigctl`, a `rigctld` ne radi | Dodajte `--rigctl …`, ili najprije pokrenite `rigctld` |
| `rigctld.exe` javlja *Access is denied* (Windows) | Windows ga odbija pokrenuti | Koristite `--rigctl` — treba mu samo `rigctl.exe` |
| Spojeno, ali se prijamnik ne miče | **CAT Sync** je isključen | Uključite ga — stranica odmah prelazi na frekvenciju, način rada i filtar uređaja. Utišavanje pri odašiljanju radi i bez njega |
| Uređaj ne prati stranicu | **Split** je uključen | Isključite Split — uređaj se odmah dovodi na stranicu |
| Način rada uređaja ne prati | Način bez odgovarajućeg na prijemniku, ili Hamlib upravljački program javlja neobičan naziv | Frekvencija se svejedno sinkronizira; način rada postavite na stranici |
| Nema utišavanja pri odašiljanju | **Mute on TX** je isključen, ili uređaj (odnosno njegov Hamlib upravljački program) ne javlja stanje odašiljanja | Uključite **Mute on TX**; inače na stranici nema što podesiti |
| Skala skače naprijed-natrag | Desktop PhantomSDR+ ili drugi program također sinkronizira uređaj | Koristite samo jedan upravljač odjednom |
| **Direct USB** je zasivljen | Stranica je na običnoj http:// adresi, ili preglednik nema Web Serial (Safari, mobiteli, Firefox prije 151) | Otvorite prijamnik preko https://, ili koristite TCI s mostom |
| *Could not open the port* | Drugi program (WSJT-X, dnevnik veza, most) ga drži; na Linuxu korisnik nije u grupi `dialout` | Zatvorite drugi program; `sudo usermod -aG dialout $USER`, pa se odjavite i ponovno prijavite |
| *The rig did not answer at any usual speed* | Uređaj je isključen, ili se **CI-V** ili vrsta uređaja ne poklapaju | Provjerite ih; **⏻ Power on** ako je isključen |
| *The rig did not switch on* | Napajanje uređaja je isključeno, ili se uređaj ne budi preko CAT-a | Uključite napajanje; provjerite **Baud** i **CI-V** |
| *The rig answers only at 19200 baud, so its scope runs slowly* | **CI-V USB Baud Rate** uređaja fiksiran je na 19200, ili je na Auto i od uključivanja ostao na 19200 | Postavite 115200, ili isključite i uključite uređaj da Auto najprije čuje 115200 |
| Preglednik se zamrzne s IC-705 (Windows) | Icomov IC-705 upravljački program blokira serijska čitanja preglednika | Ponovno priključite USB kabel da se priključak oslobodi; koristite TCI s Hamlib mostom ili Desktop PhantomSDR+ |

---

## Za operatere prijemnika

Nema se što podešavati. Upravljanje primopredajnikom koristi malo JavaScript sučelje koje svaka PhantomSDR-Plus stranica već ima; ne treba postavka poslužitelja, otvoreni port ni administratorska ovlast. Funkcije filtra i utišavanja stigle su s inačicom 4.1.0 — nakon primjene ponovno izgradite frontend (`./recompile.sh`, opcija 2); prijemnik ne treba zaustavljati. Ni prijemnici KiwiSDR, WebSDR i UberSDR ne trebaju ništa: aplikacija koristi kontrole koje njihove stranice već imaju.

Gumb **TCI-CAT** stigao je također s inačicom 4.1.0, opet samo uz ponovnu izgradnju frontenda. Ne otvara nijedan port na prijemniku: veza ide iz preglednika svakog slušatelja prema njegovom vlastitom računalu. Hamlib most, `tci-bridge/tci-rigctld.mjs`, slušatelji pokreću kod kuće; prijemnik ga ne koristi. Preglednik otvara tu vezu tek nakon što slušatelj otvori **TCI-CAT** ili uključi **CAT Sync** (pamti se po pregledniku), pa preko https posjetitelji koji ga nikad ne koriste ne vide upit za pristup lokalnoj mreži.

Ni **Direct USB** (6.0.0) ne otvara ništa na prijamniku: preglednik svakog slušatelja razgovara s njegovim uređajem preko USB-a. Preglednici to dopuštaju samo na sigurnoj stranici, pa ga udaljeni slušatelji imaju kad je prijamnik dostupan preko https:// (vidi [Siguran pristup (HTTPS)](HTTPS.md)); na stanici samo s http-om ostaju im TCI i Desktop PhantomSDR+.

---

## Rješavanje problema

| Simptom | Vjerojatan uzrok | Što učiniti |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Niste u grupi `dialout`, ili drugi program drži port | `sudo usermod -aG dialout $USER`, odjava i prijava; zatvorite WSJT-X, dnevnike veza, alate uređaja |
| Prikaz prijemnika kaže *not a receiver this app can drive* | Druga vrsta web prijemnika, ili se stranica još učitava | Podržani su PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR; sporoj stranici dajte nekoliko sekundi |
| *The rig did not answer* | Pogrešna brzina, pogrešan tip uređaja, pogrešna CI-V adresa, uređaj isključen | Uskladite brzinu s izbornikom uređaja; provjerite CI-V adresu; pokušajte Hamlib |
| *Hamlib is not installed* | `rigctld` nije pronađen | Linux: `sudo apt install libhamlib-utils`. Ili upišite putanju u **rigctld program** |
| *rigctld stopped: ...* | Hamlib nije mogao otvoriti uređaj — slijedi njegova poruka | Obično port ili brzina; tekst nakon dvotočke Hamlibov je razlog |
| *flrig is not running at ...* | flrig je zatvoren, ili je njegov XML-RPC port drugačiji | Pokrenite flrig; provjerite port u njegovim postavkama |
| Spojeno, ali se prijemnik ne pomiče | Nije otvoren prozor stanice, ili je **Receiver window** vezan uz zatvorenu stanicu | Otvorite stanicu ili odaberite *The station window last in front* |
| Uređaj odašilje pri spajanju | DTR ili RTS preko sučelja uključuje odašiljač | Uklonite oznake **DTR on** i **RTS on** |
| Filtar ne slijedi | Prijemnik stariji od 4.1.0, ili ugrađeni Kenwood/Yaesu upravljač | Frekvencija i način rada i dalje se sinkroniziraju; za filtar na Kenwoodu/Yaesuu koristite Hamlib |
| Utišavanje pri odašiljanju ne radi ništa | Prijemnik bez ažuriranja, ili uređaj ne javlja stanje odašiljanja | Kao gore |
| *Lost the rig ... reconnecting* | Izvučen kabel, isključen uređaj ili je rigctld prestao raditi | Ništa — pokušava ponovno svake 3 sekunde i nastavlja kad se uređaj vrati |
| Obje strane stalno skaču | Dva programa istodobno upravljaju uređajem | Neka samo jedan program podešava uređaj, ili ga dijelite preko flriga |

---

## Poznata ograničenja

- Jedan uređaj, jedan prozor prijemnika istodobno.
- Prijemnici osim PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR — primjerice OpenWebRX — nisu podržani.
- Ugrađeni upravljači prate objavljene protokole proizvođača i testirani su na simuliranim uređajima i stvarnom Hamlibu; za uređaj koji se ponaša drugačije, rezervno rješenje je Hamlib.
- Split, VFO B, RIT/XIT i memorijski kanali ne sinkroniziraju se — samo frekvencija aktivnog VFO-a.
- TCI-CAT i Direct USB na stranici prijamnika ne usklađuju VFO B, RIT/XIT ni pomake transvertera — **Split** samo sprječava da stranica pomiče uređaj — i isprobani su samo na IC-7300 (TCI preko Hamlib mosta).
- Na Linuxu paketi koriste Hamlib iz distribucije; vlastiti nije uključen.
