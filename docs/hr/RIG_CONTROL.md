# PhantomSDR-Plus — Upravljanje primopredajnikom (CAT)

Držite **vlastiti primopredajnik** i **PhantomSDR-Plus prijemnik** na istoj frekvenciji, načinu rada i filtru. Okrenite gumb za ugađanje na uređaju i slap ga slijedi; kliknite signal na slapu i uređaj se ugodi na njega. Kad odašiljete, prijemnik može utihnuti kako vam ne bi vraćao vlastiti signal.

Radi s prijemnicima **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR**, vašima ili tuđima, i uvijek pomiče samo *vašu* sesiju slušanja — nitko drugi na prijemniku ništa ne čuje ni ne vidi. Operater prijemnika ne mora ništa instalirati ni podešavati.

---

## Što vam treba

Dva načina povezivanja uređaja i jedan uvjet na strani prijemnika:

| Dio | Što je | Sinkronizira |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 ili noviji** | Desktop aplikacija s izbornikom **Rig**. Linux (PC i Raspberry Pi) i Windows. | Frekvenciju, način rada, širinu filtra, utišavanje pri odašiljanju — u jednom ili oba smjera |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Zaseban Windows program koji povezuje uređaj sa stranicom prijemnika u vašem pregledniku. | Frekvenciju i način rada |
| **Prijemnik** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR ili UberSDR. PhantomSDR-Plus prijemnik treba 4.0 s **ažuriranjem iz rujna 2026.** ili novijim za širinu filtra i utišavanje. | Stariji PhantomSDR-Plus i dalje sinkronizira frekvenciju i način rada |

Ostatak ovog priručnika opisuje Desktop PhantomSDR+. CATsync Tool ima vlastitu dokumentaciju na svojoj web stranici.

---

## Podržani prijemnici

Aplikacija prepoznaje vrstu prijemnika u prozoru stanice i upravlja njime preko vlastitih kontrola te stranice. Prozor Rig control prikazuje pronađenu vrstu pokraj naziva stanice.

| Prijemnik | Frekvencija i način rada | Širina filtra | Utišavanje pri odašiljanju |
|---|---|---|---|
| PhantomSDR-Plus | Da | S ažuriranjem iz rujna 2026. ili novijim | S ažuriranjem iz rujna 2026. ili novijim |
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
| **Hamlib (all rigs)** | Vaš je uređaj bilo što drugo — Hamlib poznaje više od 300. Aplikacija sama pokreće Hamlibov `rigctld` na privatnom lokalnom portu i zaustavlja ga pri odspajanju. | Windows: ništa, Hamlib je uključen. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Već radi `rigctld`, na ovom ili drugom računalu u vašoj mreži. | Host i port (zadano 4532) |
| **flrig** | flrig već upravlja uređajem za fldigi, WSJT-X ili dnevnik veza. | Pokrenut flrig s njegovim XML-RPC portom (zadano 12345) |

### Uređaji s ugrađenim upravljačem

Prikazane brzine i CI-V adrese tvorničke su vrijednosti koje aplikacija upisuje. **To je samo polazište — postavite ih prema izborniku svog uređaja.**

| Obitelj | Uređaji | Zadana brzina | Napomene |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 i svaki drugi CI-V uređaj | 19200 | CI-V adresa upisana po modelu (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresa `70`; provjerite izbornik |
| **Yaesu novi CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu klasični CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bita; ugađa u koracima od 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sinkronizira se i širina filtra |
| **Kompatibilni s Kenwoodom** | FlexRadio SmartSDR CAT (virtualni port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, ostali Kenwood-kompatibilni uređaji | 9600–38400 | |

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

### Kako se sprječava da se strane „svađaju”

Svaka vrijednost koju aplikacija upiše pojavi se trenutak kasnije kao promjena na drugoj strani. Kad bi se to shvatilo doslovno, uređaj i prijemnik beskonačno bi se ganjali. Aplikacija to izbjegava na tri načina:

- Stranica prijemnika primjenjuje promjenu odmah, pa se čita odmah nakon upisa i to očitanje postaje novo polazište.
- Uređaj primjenjuje promjenu nešto kasnije, pa se svaka poslana vrijednost pamti. Kad uređaj javi tu vrijednost, prepoznaje se kao upis aplikacije, a ne kao ruka na gumbu.
- Vrijednost koju uređaj odbije — npr. široki FM na KV uređaju — šalje se **dvaput**, a zatim se ostavlja na miru dok se izvorna strana ne promijeni, umjesto da se ponavlja nekoliko puta u sekundi.

Ponovno ugađanje stranice prijemnika može je navesti da odabere zadani način rada za opseg (npr. LSB ispod 10 MHz). Kad vodi uređaj, aplikacija odmah vraća njegov način rada, pa uređaj u USB-u na 40 m drži i prijemnik u USB-u.

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

Prijemnici KiwiSDR, WebSDR i UberSDR uvijek imaju tu kontrolu. PhantomSDR-Plus prijemnik mora imati **ažuriranje iz rujna 2026.** ili novije; na starijem se frekvencija i način rada i dalje sinkroniziraju, a prozor Rig control objašnjava zašto filtar ne slijedi.

---

## Utišavanje pri odašiljanju

Označite **Mute receiver while transmitting**. Dok uređaj odašilje, prozor prijemnika je utišan, a kad prestane, zvuk se vraća. Gumb za utišavanje prijemnika to pokazuje i zvuk uvijek možete vratiti ručno.

Ako ste prijemnik već sami utišali, ostaje utišan i nakon toga.

Treba vezu koja javlja stanje odašiljanja — svi ugrađeni upravljači, flrig i Hamlib za većinu uređaja — i, na PhantomSDR-Plus prijemniku, ažuriranje iz rujna 2026.

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
| **Rig to receiver / Receiver to rig / Both directions** | Smjer sinkronizacije |
| **Sync filter width** | Da / ne |
| **Mute receiver while transmitting** | Da / ne |
| Statusni redak | *Not connected*, *Connecting...*, *Connected: naziv*, ili posljednja pogreška |

Živi prikaz frekvencije nalazi se u prozoru Rig control, a ne u izborniku, koji bi se inače sam zatvarao pri svakoj promjeni.

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

Paket `.deb` za Desktop PhantomSDR+ ga preporučuje, pa ga `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` donosi sa sobom; `dpkg -i` ne instalira preporučene pakete. Ugrađeni upravljači i flrig ne trebaju Hamlib.

## Windows

Hamlibov vlastiti `rigctld.exe` uključen je i u 64-bitni i u 32-bitni instalacijski program. COM portovi pojavljuju se na popisu pod svojim nazivom (`COM3`). Ako uređaj treba USB upravljački program, najprije instalirajte onaj proizvođača — do tada port ne postoji.

---

## Za operatere prijemnika

Nema se što podešavati. Upravljanje primopredajnikom koristi malo JavaScript sučelje koje svaka PhantomSDR-Plus stranica već ima; ne treba postavka poslužitelja, otvoreni port ni administratorska ovlast. Funkcije filtra i utišavanja stigle su s ažuriranjem 4.0.0 iz rujna 2026. — nakon primjene ponovno izgradite frontend (`./recompile.sh`, opcija 2); prijemnik ne treba zaustavljati. Ni prijemnici KiwiSDR, WebSDR i UberSDR ne trebaju ništa: aplikacija koristi kontrole koje njihove stranice već imaju.

---

## Za programere: sučelje stranice

I Desktop PhantomSDR+ i CATsync Tool koriste ove funkcije, koje svaka PhantomSDR-Plus stranica postavlja na `window` nakon učitavanja (stranicama KiwiSDR, WebSDR i UberSDR upravlja se preko njihovih vlastitih, drugačijih kontrola):

| Funkcija | Vraća / radi |
|---|---|
| `catsync_ready` | `true` čim su funkcije ispod postavljene |
| `catsync_getFrequency()` | Ugođena frekvencija, Hz |
| `catsync_setFrequency(hz)` | Ugađa na `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Postavlja način rada; vraća propusni pojas na zadano za taj način |
| `catsync_getBandwidth()` | Ukupna širina propusnog pojasa, Hz |
| `catsync_setBandwidth(hz)` | Postavlja širinu — raste prema gore u USB-u, prema dolje u LSB-u, inače jednako na obje strane. Pozovite je **nakon** `catsync_setMode` |
| `catsync_getMute()` | `true` kad je utišano |
| `catsync_setMute(on)` | Utišava ili vraća zvuk, preko gumba za utišavanje na stranici |

Posljednje četiri stigle su s ažuriranjem iz rujna 2026., pa ih provjerite prije poziva:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Postavljanje frekvencije ponovno ugađa zvuk, pa setter pozovite samo kad se vrijednost stvarno promijenila — setter koji se stalno poziva s istom vrijednošću čuje se. Stariji ulazi u stilu KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) i dalje postoje za alate koji ih očekuju.

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
| Filtar ne slijedi | Prijemnik bez ažuriranja iz rujna 2026., ili ugrađeni Kenwood/Yaesu upravljač | Frekvencija i način rada i dalje se sinkroniziraju; za filtar na Kenwoodu/Yaesuu koristite Hamlib |
| Utišavanje pri odašiljanju ne radi ništa | Prijemnik bez ažuriranja, ili uređaj ne javlja stanje odašiljanja | Kao gore |
| *Lost the rig ... reconnecting* | Izvučen kabel, isključen uređaj ili je rigctld prestao raditi | Ništa — pokušava ponovno svake 3 sekunde i nastavlja kad se uređaj vrati |
| Obje strane stalno skaču | Dva programa istodobno upravljaju uređajem | Neka samo jedan program podešava uređaj, ili ga dijelite preko flriga |

---

## Poznata ograničenja

- Jedan uređaj, jedan prozor prijemnika istodobno.
- Prijemnici osim PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR — primjerice OpenWebRX — nisu podržani.
- Ugrađeni upravljači prate objavljene protokole proizvođača i testirani su na simuliranim uređajima i stvarnom Hamlibu; za uređaj koji se ponaša drugačije, rezervno rješenje je Hamlib.
- Split, VFO B, RIT/XIT i memorijski kanali ne sinkroniziraju se — samo frekvencija aktivnog VFO-a.
- Na Linuxu paketi koriste Hamlib iz distribucije; vlastiti nije uključen.
