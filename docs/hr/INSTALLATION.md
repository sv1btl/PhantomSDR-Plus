# Vodič za instalaciju PhantomSDR-Plusa za sistemske operatere

Ovaj sveobuhvatni vodič vodi vas kroz instalaciju i konfiguraciju PhantomSDR-Plusa na vašem poslužitelju.

---

## Sadržaj

1. [Sistemski zahtjevi](#sistemski-zahtjevi)
2. [Instalacija PhantomSDR-Plusa](#instalacija-phantomsdr-plusa) — skripta i [što radi](#što-instalacijska-skripta-radi)
3. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
4. [Emulacija KiwiSDR klijenata (neobavezno)](#emulacija-kiwisdr-klijenata-neobavezno)
5. [Konfiguracija](#konfiguracija)
6. [Postavljanje ovisno o SDR uređaju](#postavljanje-ovisno-o-sdr-uređaju)
7. [Testiranje i provjera](#testiranje-i-provjera)
8. [Postavljanje automatskog pokretanja](#postavljanje-automatskog-pokretanja)
9. [Toplinska zaštita procesora](#toplinska-zaštita-procesora)
10. [Rješavanje problema](#rješavanje-problema)

---

## Sistemski zahtjevi

### Podržani operacijski sustavi

**Primarni (preporučeno):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) i 26.04 LTS (Resolute) — preporučuje se 24.04
- Debian 12 (Bookworm) i Debian 13 (Trixie)

**Alternativa:**
- Fedora (najnovije stabilno izdanje)
- Arch Linux (kotrljajuće izdanje)
- openSUSE Tumbleweed (ne Leap — vidjeti napomenu niže)

### Hardverski zahtjevi

**Minimalna konfiguracija:**
- Procesor: dvojezgreni (2+ GHz)
- RAM: 4 GB
- Pohrana: 10 GB slobodnog prostora
- Mreža: veza od 100 Mbit/s

**Preporučena konfiguracija:**
- Procesor: četverojezgreni ili bolji (Ryzen 5 2600, Intel i5-6500T ili bolji)
- RAM: 8 GB ili više
- Pohrana: SSD od 20 GB ili više
- GPU: AMD/NVIDIA s podrškom za OpenCL (vrlo preporučljivo)
- Mreža: veza od 1 Gbit/s

**Konfiguracija visokih performansi:**
- Procesor: 6+ jezgri (Ryzen 7, Intel i7 ili bolji)
- RAM: 16 GB ili više
- Pohrana: NVMe SSD
- GPU: namjenski GPU s podrškom za OpenCL/CUDA
- Mreža: 1 Gbit/s ili bolja

---

## Instalacija PhantomSDR-Plusa

### Kloniranje repozitorija i pokretanje instalacijskog programa

```bash
cd ~
git clone https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
bash install.sh
```

Instalacijski program najprije postavi nekoliko pitanja o vašoj stanici — prijemnik, što primati, vaš pozivni znak i lokator, vašu adresu na internetu i koje dodatke želite — a zatim sve instalira sam, bez daljnjih pitanja. Na kraju pokreće prijemnik i prikazuje adresu kojom se slušatelji služe te jedini port koji treba otvoriti na usmjerniku (9000, osim ako ste odabrali drugi). Pitanja su opisana dva odjeljka niže, u *Pitanja o stanici*.

Upišite `bash install.sh` točno tako: nema koraka `chmod`. Kopija preuzeta kao ZIP ili preko web-stranice GitHuba nema prava izvršavanja, a instalacijski program ih postavlja sam.

> **PhantomSDR-Plus već radi?** Nemojte ga instalirati ponovno — ažurirajte ga. Jednom preuzmite alat za ažuriranje i pokrenite ga; prikazuje što bi se promijenilo i pita prije nego što bilo što zapiše. Vaše postavke, markeri, administratorska lozinka, popis frekvencija i povijest chata nikad se ne diraju:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> bash update.sh
> ```
>
> Pojedinosti su u poglavlju *Ažuriranje PhantomSDR-Plusa*. Ponovno pokretanje instalacijskog programa na stanici koja radi potrebno je samo kad ponovna izgradnja ne uspije jer nedostaju paketi sustava.

Uzmite skriptu koja odgovara vašem sustavu. Sve rade isti posao i postavljaju ista pitanja; razlikuje se samo upravitelj paketa:

| Sustav | Skripta |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Jedan instalacijski program za svako izdanje Debiana i Ubuntua.** `install.sh` čita `/etc/os-release` i instaliranu inačicu Boosta te se sam prilagođava; stari `install_ubuntu22.sh`, `install-Deb12.sh` i `install_ubuntu26.sh` više ne postoje. Postavlja `DEBIAN_FRONTEND=noninteractive`, kako `tzdata` koji stiže uz `python3-matplotlib` ne bi mogao zaustaviti izvođenje pitanjem o vašoj vremenskoj zoni, a zatim progutati odgovor namijenjen sljedećem pitanju. Na Jammyju izravno poziva `install_rade_ubuntu22.sh`, jer je Jammyjev `python3-websockets` 10.1, a RADE traži 11.0 ili noviji. Zna gdje se `intel-opencl-icd` nalazi na svakom izdanju: u repozitorijima na 22.04 i 26.04, u `non-free` na Debianu 12 te u Intelovu vlastitom grafičkom repozitoriju na 24.04 i Debianu 13. A ondje gdje je Boost 1.87 ili noviji, zakrpa websocketpp zaglavlja prestaje biti neobavezna — instalacijski program provjerava da je primijenjena i bez nje odbija graditi. Noviji prevoditelj nikada nije potreban: tvornički GCC prihvaća `-std=c++23` na svih pet izdanja, pa zbog toga nemojte instalirati `gcc-12`.

Instalacija se odvija u 22 numerirana koraka. Budući da se pitanja o stanici odgovaraju na početku, nijedan korak ne staje da bi nešto pitao; traži se samo lozinka za sudo, jednom, odmah nakon pitanja, i vrijedi za cijelo izvođenje. S `PHANTOM_CLASSIC=1` vraća se stari način — svako pitanje u svom koraku, uokvireno natpisom **⌨️  YOUR INPUT IS NEEDED**. Svaki odgovor može se zadati i kroz okruženje, za potpuno samostalno izvođenje (`PHANTOM_NONINTERACTIVE=1`); vidi *Instalacija bez nadzora* niže.

**Svako pokretanje zapisuje `install.txt`.** Kada instalacijski program završi — ili prekine na pola puta — zapisuje izvještaj u `install.txt` u mapi PhantomSDR-Plus: rezultat, svaki od 22 koraka kao OK / SKIPPED / PARTIAL / FAILED, što je otkrio (distribuciju, Boost, prevoditelj, Node.js), koje su komponente instalirane i svako upozorenje koje se pojavilo. Neuspjelo pokretanje ostavlja izvještaj koji završava na koraku koji je pao, s razlogom i napomenom da se instalacijski program smije sigurno ponovno pokrenuti. To je prva datoteka koju treba pročitati kada nešto nije uspjelo i prva koju treba priložiti prijavi greške. Svako pokretanje je prepisuje, pa sačuvajte kopiju ako želite usporediti dvije instalacije.

> **Ubuntu 26.04, Arch i openSUSE Tumbleweed se prevode, ali nisu isprobani u stvarnom radu.** Sva tri donose Boost noviji od 1.87, koji je uklonio `io_service` API za koji je pisan ugrađeni websocketpp 0.8.2. Zakrpana zaglavlja koja instalacijski program kopira premošćuju taj jaz (`io_context`, `executor_work_guard`, `boost::asio::post`, moderni resolver), a ondje gdje je Boost 1.87 ili noviji program tu zakrpu smatra obveznom, a ne neobaveznom — provjerava da su kopije stigle i bez njih odbija graditi. Potpuna instalacija, uključujući upravljački program prijamnika i sve neobavezne komponente, provjerena je od početka do kraja u kontejnerima na Boostu 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) i 1.92 (Arch). To dokazuje da se poslužitelj prevodi i pokreće — ne i da satima poslužuje prijamnik. Smatrajte sva tri neprovjerenima u produkciji dok netko ne javi.

> **openSUSE ovdje znači Tumbleweed.** Ondje je `install_opensuse.sh` provjeren. Leap 15.6 ne radi: u njegovim repozitorijima uopće nema `liquid-dsp-devel` koji poslužitelj treba, a Boost postoji samo pod verzioniranim nazivima paketa. Podrška za Leap značila bi dodavanje vanjskih OBS repozitorija, pa je zasad izvan opsega.

### Pitanja o stanici

`configure-station.sh` — pokreće ga instalacijski program na početku, a može se pokrenuti i sam u bilo kojem trenutku — postavlja pet skupina pitanja. ENTER prihvaća vrijednost u uglatim zagradama; pri ponovnom pokretanju prethodni odgovori su zadane vrijednosti.

| # | Pitanje | Napomene |
|---|---|---|
| 1 | Koji prijemnik | Prepoznaje i predlaže onaj koji je priključen (RX888, RTL-SDR, RSP1A, Airspy HF+, HackRF, Fobos). Za RTL-SDR pita i je li to Blog V4. |
| 2 | Što primati | Gotovi izbori za svaki prijemnik (npr. *HF 0–30 MHz* za RX888, *2 m* za RTL-SDR) ili vlastita središnja frekvencija i brzina uzorkovanja. |
| 3 | Vaša stanica | Pozivni znak, ime, e-pošta, QTH lokator, grad i država, antena, računalo, ITU regija (predložena prema lokatoru). |
| 4 | Internet | Vaša javna adresa (IP ili DNS ime) te treba li prijemnik biti na sdr-list.xyz i na karti websdr.org. Također hoće li se prijemnik posluživati i preko https:// (treba DNS ime). Upišite ime ili IP, ne port — port se pita u koraku 5. |
| 5 | Portovi i dodaci | Administratorska ploča, FreeDV RADE, DRM, statistika, WebSDR relay, pokretanje pri podizanju sustava — i javni port. |

Odgovori se spremaju u **`station.conf`**, a iz njega čarobnjak zapisuje sve što se mora slagati: `config-<prijemnik>.toml` prijemnika (brzina uzorkovanja, frekvencija, port, upisi u imenike, websdr.org), `frontend/site_information.json` i postavke relaya. Skripte za pokretanje same čitaju frekvenciju i brzinu uzorkovanja iz `station.conf`, pa se nikad ne uređuju. Mijenjaju se samo postavke koje pripadaju čarobnjaku, a svaka se datoteka prije promjene kopira u `<ime>.bak-<datum>`.

**Na usmjerniku mora biti otvoren samo jedan port.** Sve čime se slušatelji služe prolazi kroz njega:

| Port | Što | Otvoren na usmjerniku |
|---|---|---|
| 9000 | stranica prijemnika — `proxy.py`, koji prosljeđuje i `/admin`, `/rade`, `/drm`, `/stats` i `/relay` | **da, samo ovaj** |
| 9001 | spectrumserver | ne |
| 9010 | administratorska ploča | ne |
| 9011 | poslužitelj statistike | ne |
| 9012 | FreeDV RADE dekoder | ne |
| 9013 | WebSDR diversity relay | ne |
| 9015 | DRM dekoder | ne |

Port koji je na računalu već zauzet preskače se u korist sljedećeg slobodnog. Za kasnije promjene:

```bash
bash configure-station.sh          # ponovno pitaj (ENTER zadržava svaki odgovor)
bash configure-station.sh --show   # prikaži trenutne odgovore
```

Na već instaliranoj stanici čarobnjak zatim prenosi promjenu svugdje gdje treba — nove portove u `admin_config.json` i u uslugu statistike, novi prijemnik u pokretanje pri podizanju sustava — i jednom pita treba li ponovno izgraditi stranicu i ponovno pokrenuti ono što radi. Promjena porta je dakle ova jedna naredba, uz prosljeđivanje na usmjerniku ako se javni port promijenio. Javni port mora biti 1024 ili veći, jer proxy ne radi kao root: da bi stanica bila dostupna na portu 80, ovdje zadržite 9000 i na usmjerniku proslijedite vanjski port 80 na njega.

### Što instalacijska skripta radi

Ništa ne treba ručno pripremati — nema popisa ovisnosti za lijepljenje, nema Node.js-a za preuzimanje, nema paketa OpenCL za traženje. Računajte s dvadesetak minuta do znatno više od sat vremena, ovisno o računalu i o tome instalira li se RADE (njegovo preuzimanje je dugi dio).

| # | Korak |
|---|---|
| 1 | Prikazuje usluge PhantomSDR-Plusa koje upravo rade i nudi da ih zaustavi prije nego što išta dira (samo na računalu koje ih već ima) |
| 2 | Prepoznaje distribuciju — slijede pitanja o stanici i, jednom, lozinka za sudo |
| 3–6 | Instalira sve ovisnosti za izgradnju, s Node.js 22 preko nvm-a ako sistemski Node nedostaje ili je prestar |
| 7 | Gradi backend s meson |
| 8 | Gradi upravljački program vašeg prijemnika s njegovim udev pravilom, tako da poslužitelj nikad ne treba `sudo` za uređaj |
| 9 | Zapisuje `.toml` prijemnika i `site_information.json` iz vaših odgovora |
| 10–11 | Instalira ovisnosti frontenda i gradi stranicu za računalo i `/mobile` |
| 12 | Instalira OpenCL za pronađeni hardver |
| 13 | Instalira administratorsku ploču — ili, bez nje, samo proxy na javnom portu |
| 14–16 | Instalira WebSDR relay, FreeDV RADE, DRM i poslužitelj statistike, ako ste ih odabrali |
| 17 | Ponovno primjenjuje zakrpane websocketpp zaglavlja i provjerava ih |
| 18 | Instalira emulaciju KiwiSDR klijenta, kako bi se Kiwi klijenti poput AetherSDR-a mogli spojiti |
| 19 | Ponovno gradi backend iz zakrpanih izvora |
| 20 | Bira FFT ubrzivač — OpenCL samo kad uređaj stvarno odgovara, inače procesor — i instalira pokretanje pri podizanju sustava ako ste ga odabrali, te postavlja https:// ako ste ga odabrali |
| 21 | Pokreće prijemnik |
| 22 | Ispisuje sažetak: adresu za slušatelje, port koji treba proslijediti i svaki korak s rezultatom |

#### Instalacija bez nadzora

Svako pitanje ima varijablu okoline koja ga nadjačava, a instalacijski program i sam prelazi na zadane vrijednosti kada stdin nije terminal (cijev, kontejner, CI posao). Jednako vrijedi za sva četiri: `install.sh`, `install_arch.sh`, `install_fedora.sh` i `install_opensuse.sh`. Postavite `PHANTOM_NONINTERACTIVE=1` i cijelo se izvođenje dovrši bez ijednog pitanja:

| Varijabla | Učinak |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_DRM=y\|n` | DRM decoder (default y) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | nastavi bez curlpp-a — samo Arch i openSUSE (zadano y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | poništi vremenske oznake izvornih datoteka datirane u budućnost, kako bi meson mogao graditi (zadano y) |
| `PHANTOM_START_RECEIVER=y\|n` | pokreni prijemnik na kraju (zadano y) |
| `PHANTOM_CLASSIC=1` | bez pitanja o stanici: sve se pita usput, kao prije |
| `STATION_…=…` | bilo koji odgovor na pitanja o stanici, npr. `STATION_RECEIVER=rtl STATION_CALLSIGN=SV1XYZ` — vidi zaglavlje `configure-station.sh` |

S pitanjima o stanici odabrani dodaci uzimaju svoje odgovore iz `station.conf` i rade bez terminala, pa ih izvođenje bez nadzora uključuje a da ih ovdje ne treba navoditi.

Tri pod-instalacijska programa označena s *n bez nadzora* i sami su interaktivni, pa ih izvođenje bez nadzora preskače umjesto da zapne na njihovim pitanjima. Navedite ih izrijekom da bi bili uključeni:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Nakon ponovnog pokretanja udev pravila za RX888 i eventualni OpenCL upravljački program potpuno su na snazi; skripta vam kaže kada je potrebno ponovno pokretanje ili ponovna prijava.

Pri postavljanju administratorske ploče instalater nudi i dvije systemd jedinice te **snažno preporučuje** da ih prihvatite: zaštita od pregrijavanja procesora radi unutar ploče, pa bez njih ponovno dizanje sustava ili pad ostavljaju računalo nezaštićenim. Korak se automatski preskače ondje gdje systemd ne radi (kontejneri, WSL1, OpenRC) — vidi [vodič za ploču](ADMIN_PANEL_SETUP.md).

Svaki je dodatak obična skripta koju možete pokrenuti i zasebno, kad god želite — `./setup_admin.sh` ([priručnik](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([priručnik](RADE_README.md)), `./setup-drm.sh` ([DRM dekoder](DECODERS.md#13-drm)), `./install-stats-server.sh` ([priručnik](sdr-stats/README.md)), `./setup-rx888-udev.sh` i skripte prijamnika `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` i `./setup-hackrf.sh` — upravo njih poziva instalacijska skripta.

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus dolazi s neobaveznim **autorun spot reporterom** (u direktoriju `autorun/`). Dekodira FT8/FT4/WSPR na poslužiteljskoj strani izravno s prijamnika i šalje spotove u mreže za prijavu:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Upravlja se u cijelosti s kartice **administratorska ploča → „Spot Reporting"**, a **prijavljivanje je prema zadanom ISKLJUČENO** — ništa se ne odašilje ni ne šalje dok to ondje ne uključite. Dekoder radi kao zaseban Node.js daemon i lokalno preuzima zvuk prijamnika, pa ne dodaje nikakav dodatni RF hardver.

### Preduvjeti

| Preduvjet | Napomene |
|-----------|----------|
| **Node.js 22+** | Isto radno okruženje koje već treba izgradnja sučelja — instalira se u koraku Node.js. |
| **npm paketi `ws` + `cbor-x`** | Razrješavaju se preko `autorun/node_modules`, simboličke poveznice na `node_modules` sučelja (oba su paketa navedena u `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Gumb „Start" u administraciji veže daemon uz E-jezgre pomoću naredbe `taskset`. Prisutan je u gotovo svakoj distribuciji; instalacijske skripte dodaju ga izričito. |
| **Pozivni znak + lokator** | Čitaju se iz `frontend/site_information.json` (`siteSysop` / `siteGridSquare`), osim ako se ne promijene na administratorskoj kartici. Spotovi se šalju pod tim pozivnim znakom. PSK Reporter i WSPRnet dobivaju samo lokator od 4 ili 6 znakova — dulji (KM17VX69JA) skraćuje se na svoj kvadrat (KM17VX). |

> ⚠️ **Prijavljujte samo ono što doista primate.** Spotovi se šalju u javne mreže pod vašim pozivnim znakom — uključite samo pojaseve/načine rada koje vaš prijamnik stvarno čuje i koristite ispravan lokator.

### Automatska instalacija

`install.sh` (i inačice po distribucijama: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) obavljaju sve umjesto vas: instaliraju Node.js 22 i `util-linux`, pokreću `npm install` za sučelje i zatim automatski stvaraju simboličku poveznicu `autorun/node_modules`. Nisu potrebni dodatni koraci — značajka je spremna čim `install.sh` završi.

Zatim otvorite administratorsku ploču, idite na karticu **Spot Reporting**, postavite svoj identitet, označite pojaseve/načine rada za dekodiranje, uključite odredišta i pritisnite **Start**. Oznaka „📶 REPORTING" pojavljuje se na glavnom slapu dok je prijavljivanje aktivno. (PSK Reporter šalje skupno svakih 5 minuta, a wsprnet svake 2 minute, pa svježe pokrenut daemon prvih nekoliko minuta pokazuje „0 sent" — to je normalno.) Ista kartica određuje UTC sate u kojima radi svaki pojas i način te može sama pokrenuti daemon nakon ponovnog pokretanja ili rušenja — vidi [Spot Reporting](ADMIN_PANEL_SETUP.md#spot-reporting-autorun-ft8ft4js8wspr).

Zatim se prikazuju dva različita brojača koja je lako zamijeniti. Pločice **SPOTS UPLOADED PER DECODER** broje samo trenutačni rad, pa ih Stop/Start vraća na nulu; broj uz svaki potvrdni okvir pojasa/načina rada je **ukupan** zbroj tog mjesta od početka, spremljen u `autorun-totals.json` pa preživljava ponovna pokretanja. Oboje opisuje [vodič za administratorsku ploču](ADMIN_PANEL_SETUP.md), kao i stranicu **Grafikoni**, koja crta frekvenciju procesora, opterećenje, temperaturu i broj korisnika u rasponu od 15 minuta do 24 sata.

> **Ako vam se stroj grije**, ploča nosi i [toplinsku zaštitu](ADMIN_PANEL_SETUP.md#thermal-guard) koja zaustavlja poslužitelj kada procesor dosegne opasnu temperaturu i pokreće ga ponovno kad se ohladi. Pragove izvodi iz kritičnog praga vašeg vlastitog procesora, pa nema ničega za računati, i radi s bilo kojim načinom pokretanja/zaustavljanja. Instalira se s pločom, ali kreće u načinu samo zapisivanja: bilježi što bi *učinila* i ne mijenja ništa dok je ne uključite u Postavkama. Neprekidno dekodiranje drži procesor zaposlenim danonoćno, pa se isplati pročitati karticu CRASH nakon tjedan dana autoruna i vidjeti koliko vam se stroj zaista približi.

> **Port poslužitelja otkriva se automatski.** Daemon se spaja izravno na `[server] port` samog spectrumservera (petlja + token, zaobilazeći proxy). Taj port čita iz konfiguracijske datoteke s kojom je pokrenut spectrumserver koji radi, pa funkcionira na bilo kojem portu bez konfiguracije — redak `[autorun] tap backend: …` u `autorun.log` pokazuje što je razriješio. Ako vaš poslužitelj nije radio kada je daemon pokrenut ili imate neobičnu postavu, zadajte ga u `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9001 }
> ```
> Pogrešan port očituje se kao `504` / `tap closed 1006` u `autorun.log`, uz `decodes` zaglavljen na 0.

---

## Emulacija KiwiSDR klijenata (neobavezno)

Od v4.1.0 PhantomSDR-Plus može odgovarati i na **KiwiSDR protokol**, pa se softver pisan za KiwiSDR — **AetherSDR**, `kiwiclient` i ostali — spaja izravno na vaš prijamnik, na istom računalu i portu koje već objavljujete. Isključeno je dok se u konfiguraciju s kojom radi vaš prijamnik ne doda `[kiwi_emulation] enabled = true`.

Instalacijski program to nudi kao korak 17; `./kiwi_install.sh` primjenjuje most na već instalirano stablo.

> **Potpuna dokumentacija: [Emulacija KiwiSDR klijenata](Aether_config.md)** — što most radi, kako ga instalirati, svaki ključ iz `[kiwi_emulation]`, spajanje klijenta, razina zvuka, S-metar, brzina slapa i tablica simptoma.

---

## Konfiguracija

> **Instalirali ste s pitanjima o stanici?** Tada je sve u ovom poglavlju već napravljeno iz vaših odgovora — `.toml`, `site_information.json` te frekvencija i brzina uzorkovanja skripte za pokretanje. Mijenjate ih s `bash configure-station.sh`. Koraci u nastavku služe za ono što čarobnjak ne pokriva ili za ručno postavljenu stanicu.

### 1. Odaberite konfiguracijsku datoteku

Odaberite odgovarajuću konfiguracijsku datoteku za svoj SDR:

- `config-rtl.toml` – RTL-SDR uređaji
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, RF grana (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

U ovom primjeru koristit ćemo RTL-SDR.

### 2. Uredite konfiguracijsku datoteku

```bash
nano config-rtl.toml
```

#### Ključne postavke

```toml
[server]
port = 9001                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
iq = true                        # Offer the IQ mode to listeners (true/false)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
volume = 50                      # Start volume of a first-time listener, 0-100 (optional)
```

#### Smjernice za frekvenciju uzorkovanja

| Pokrivenost | Frekvencija uzorkovanja | Veličina FFT-a |
|-------------|--------------------------|-----------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Postavite podatke o lokaciji

```bash
nano frontend/site_information.json
```

Uredite sljedeća polja:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v5.5.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**IARU regije:**
- **1**: Europa, Afrika, Bliski istok, sjeverna Azija
- **2**: Amerike (Sjeverna, Srednja, Južna), Karibi
- **3**: Azija i Pacifik, Oceanija

### 4. Prilagodite frekvencijske oznake (neobavezno)

```bash
nano markers.json
```

Dodajte svoje omiljene frekvencije, repetitore i radiodifuzijske postaje. Oznaka čiji je način rada digitalan, poput `FT8` ili `APRS`, pokreće taj dekoder kada je kliknete — vidi [Dekoderi](DECODERS.md#pokretanje-dekodera-s-oznake-frekvencije).

### 5. Uredite početnu skriptu

```bash
nano start-rtl.sh
```

> Na stanici postavljenoj s pitanjima o stanici frekvencija i brzina uzorkovanja dolaze iz `STATION_FREQ` i `STATION_SPS` u `station.conf`: mijenja ih `bash configure-station.sh`, a blok iznad ostaje kakav je isporučen.

Početna skripta samostalan je pokretač s watchdogom. Uredite samo blok **RECEIVER CONFIGURATION** pri vrhu kako bi argumenti prijamnika odgovarali vašoj postavi:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parametri unutar `RX_ARGS`:
- `-f 145000000`: središnja frekvencija (145 MHz)
- `-s 2048000`: frekvencija uzorkovanja (2,048 MSPS)

`CONFIG` pokazuje na vašu `.toml` datoteku. Ništa drugo u skripti **ne** morate mijenjati — logika pokretanja/ponovnog pokretanja/watchdoga/zapisivanja je općenita. Argumente prijamnika možete zamijeniti i pri pokretanju, bez uređivanja datoteke: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` za `start-rx888mk2.sh`).

---

## Postavljanje ovisno o SDR uređaju

### RTL-SDR

Instalacijske skripte instaliraju upravljački program umjesto vas, sa `./setup-rtlsdr.sh` (`RTL_V4=y` za RTL-SDR Blog V4).

#### Uredite konfiguraciju

```bash
nano config-rtl.toml
```

Uobičajene postavke za RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Prijamnici preko SoapySDR-a (RSP1A, Fobos, Airspy HF+)

SDRplay RSP1A, RigExpert Fobos SDR i Airspy HF+ do poslužitelja stižu na isti način: SoapySDR upravljački program za uređaj i `rx_sdr` (iz rx_tools) koji njegove uzorke prosljeđuje `spectrumserver`-u. Jedna skripta po prijamniku instalira cijeli lanac:

| Prijamnik | Skripta | Opcija instalacije | Skripta za pokretanje | Konfiguracija |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Svaka skripta:

- instalira git, cmake, prevoditelj, libusb i **SoapySDR** iz paketa vaše distribucije — prepoznaje apt, dnf, pacman i zypper, pa jednako radi na Debianu/Ubuntuu, Fedori, Archu i openSUSE-u;
- gradi upravljački program prijamnika iz izvornog koda u `sdr_drivers/` (git ga ne prati);
- gradi **rx_tools** za `rx_sdr`, osim ako je `rx_sdr` već instaliran — jedna kopija služi svim prijamnicima;
- instalira **udev pravilo** i dodaje vas u grupu `plugdev`, pa skripti za pokretanje nikad ne treba `sudo` za uređaj. **Jednom se odjavite i ponovno prijavite** da grupa počne vrijediti;
- na kraju provjerava da SoapySDR stvarno navodi upravljački program, a ako ne, zaustavlja se s greškom.

Pokrenite ih kao običan korisnik — same pozivaju `sudo`. Idempotentne su: ponovno pokretanje ažurira izvorni kod upravljačkog programa s `git pull` i ponovno gradi. Instalacijska skripta poziva upravo te skripte; na već instaliranoj stanici pokrenite zasebno onu za svoj prijamnik. Zajednički dio nalazi se u `setup-sdr-common.sh`, koja se ne pokreće sama. Dvije neobavezne varijable vrijede za sve tri: `SDR_USER=<ime>` stavlja drugi račun u `plugdev`, a `SDR_SKIP_DEPS=1` preskače instalaciju paketa.

S priključenim uređajem provjerite da je prijamnik pronađen:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` instalira **upravljački program otvorenog koda**: libmirisdr-5, upravljački program nastao obrnutim inženjeringom za Mirics čipove MSi2500/MSi001 u RSP1 i RSP1A, s njegovim SoapySDR modulom SoapyMiri (`driver=soapyMiri`). Ne treba mu pozadinska usluga ni root. Skripta također stavlja na crnu listu upravljačke programe jezgre `msi2500` i `msi001` u `/etc/modprobe.d/blacklist-msi2500.conf`, jer oni zauzmu RSP1A kao V4L2 radio prije nego što ga `rx_sdr` može otvoriti. Ako je uređaj bio priključen dok su bili učitani, jednom ga iskopčajte i ponovno ukopčajte (ili ponovno pokrenite računalo).

Zatvoreni SDRplay API (`driver=sdrplay`, sa SoapySDRPlay i uslugom `sdrplay`) i dalje radi — priložena datoteka `instructions-for-rsp1a` opisuje tu instalaciju. `start-rsp1a.sh` sam bira između njih: ako SoapySDR ima upravljački program `sdrplay`, koristi API i prije toga ponovno pokreće uslugu `sdrplay`, a inače koristi libmirisdr-5. Stanica postavljena na API tako nastavlja raditi bez promjena. Da nametnete jedan, pokrenite s `RX_DRIVER=miri` ili `RX_DRIVER=sdrplay`. Odabrani upravljački program upisuje se u `logwebsdr.txt` kao `RSP1A driver: miri` ili `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Fobos šalje **samo jednu granu odjednom**, pa ima dvije skripte za pokretanje koje dijele zaključavanje watchdoga kao svaka `start-*.sh` — pokretanje jedne zaustavlja drugu:

- **`start-fobos-hf.sh`** — ulazi HF1/HF2 u izravnom uzorkovanju, 0-25 MHz, na portu 9001. U tom načinu rada nema lokalnog oscilatora: ADC neprestano digitalizira 0-25 MHz (`-f 0` je namjerno, a upozorenje *Failed to set center freq* iz rx_sdr je očekivano). `rx_sdr` daje CF32 na 50 Msps; mali pretvarač `cf32_to_real` (gradi ga `setup-fobos.sh` iz `cf32_to_real.c`) zadržava kanal I i skalira ga na s16, pa `config-fobos-hf.toml` koristi `signal="real"` i `format="s16"`.
- **`start-fobos.sh`** — RF grana, 25-6000 MHz, IQ, na portu 9001. Odaberite prozor prije prvog pokretanja: `-f` (središte) i `-s` (brzina uzorkovanja) u retku `RX_ARGS` moraju odgovarati `frequency=` i `sps=` u `config-fobos.toml`. Isporučene vrijednosti (97 MHz, 20 Msps) samo su polazište za provjeru da radi.

> [!IMPORTANT]
> `config-fobos-hf.toml` dolazi s `accelerator="opencl"`: tok od 50 Msps kroz FFT od 1M binova težak je kao 60 Msps RX888, a na CPU-u gubi uzorke i grije računalo. Na računalu bez OpenCL uređaja `spectrumserver` se s tom postavkom ne pokreće — ondje postavite `accelerator="none"`.

SoapyFobosSDR za izgradnju treba zaglavlja i od libfobos i od libfobos-sdr-agile, pa `setup-fobos.sh` gradi oboje, čak i za standardni firmware. Podrška za Fobos potječe iz skripte koju je napisala druga stanica nakon što je pokrenula Fobos na PhantomSDR-Plus; HF vrijednosti u `config-fobos-hf.toml` su one koje su ondje radile.

#### Airspy HF+

`setup-airspyhf.sh` instalira libairspyhf iz distribucije gdje je zapakirana (Debian i Ubuntu, Fedora, openSUSE), a gradi je iz izvornog koda gdje nije (Arch je ima samo u AUR-u), zatim gradi SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` daje 912 ksps IQ u CS16, što `config-airspyhf.toml` čita kao `format="s16"`. Priložena datoteka `instructions-for-airspy` opisuje ručni put.

### RX888 MK2

Instalacijska skripta gradi `rx888_stream` i instalira njegova udev pravila umjesto vas.

#### Pokretanje rx888_stream bez sudo (udev pravila)

Prema zadanom, USB uređaj Cypress FX3 na RX-888 dostupan je samo rootu, pa bi `rx888_stream` trebao `sudo`. Pokrenite jednom priloženi pomoćni skript kako biste instalirali udev pravila i dodali se u grupu `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Skripta zapisuje `/etc/udev/rules.d/99-rx888.rules` za sva tri identifikatora proizvoda Cypress FX3 (`04b4:00f1`/`00f3` bootloader i `04b4:8613` s učitanim firmverom), ponovno učitava udev i stvara stabilnu poveznicu `/dev/rx888`. **Odjavite se i ponovno prijavite** (zbog promjene grupe) i jednom **ponovno priključite uređaj**; nakon toga `rx888_stream` — i pokretač `start-rx888mk2.sh` — rade bez `sudo`. Skripta je idempotentna pa ju je sigurno ponovno pokrenuti. Za drugi korisnički račun: `RX888_USER=<ime> ./setup-rx888-udev.sh`.

#### Uredite konfiguraciju

```bash
nano config-rx888mk2.toml
```

Uobičajene postavke za RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Za HackRF ništa se ne gradi: `hackrf_transfer` iz paketa `hackrf` vaše distribucije prosljeđuje uzorke izravno `spectrumserver`-u. `./setup-hackrf.sh` (opcija 7 instalacije) instalira taj paket s apt, dnf, pacman ili zypper te dodaje udev pravilo i grupu `plugdev`, pa `start-hackrf.sh` radi bez `sudo` — nakon toga se jednom odjavite i ponovno prijavite.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` šalje jedan prozor odjednom. Odaberite ga prije prvog pokretanja: `-f` (središte) i `-s` (brzina uzorkovanja) u njegovu retku `RX_ARGS` moraju odgovarati `frequency=` i `sps=` u `config-hackrf.toml`. `-l` i `-g` su pojačanja LNA (0-40 dB, koraci od 8 dB) i VGA (0-62 dB, koraci od 2 dB), a `-a 1` uključuje RF pojačalo. Isporučene vrijednosti (98 MHz, 20 Msps) samo su polazište za provjeru da radi.

`hackrf_transfer` piše 8-bitni IQ **s predznakom**, pa konfiguracija treba `format="s8"`. `config.example.hackrf.toml` je do rujna 2026. imao `u8`; s `u8` svaki je uzorak pomaknut za 128 i vodopad pokazuje samo šum — provjerite svaku stariju kopiju.

### Više prijemnika na jednom računalu

Jedno računalo može istodobno pokretati više gore navedenih prijemnika — na primjer RX-888 za kratki val i RTL-SDR za 2 m — svaki kao zaseban poslužitelj, s izbornikom prijemnika na stranici. Svaki dodatni prijemnik pokreće se s `INSTANCE=<ime> ./start-<radio>.sh` i podešava u `instances/<ime>/`; `receivers.toml` ih navodi za proxy i za `start-all.sh`. Sve je opisano u [Više prijemnika](MULTI_RECEIVER.md). Najbrže se prijemnik dodaje s `./add-receiver.sh`, koji instalacijske skripte nude na kraju: instalira upravljački program (`setup-rtlsdr.sh` za RTL-SDR, odgovarajući `setup-*.sh` za ostale) i za vas zapisuje mapu instance i `receivers.toml`.

---

## Testiranje i provjera

### 1. Probno pokretanje

```bash
# For RTL-SDR
./start-rtl.sh
```

Time se poslužitelj pokreće **u pozadini** (odvaja se i odmah vraća upravljanje) i počinje zapisivati u `logwebsdr.txt`.

### 2. Provjerite ima li pogrešaka

Skripta bilježi napredak u `logwebsdr.txt` — pratite ga uživo:

```bash
tail -f logwebsdr.txt
```

Potražite:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` ili `ERROR: receiver binary '…' not found` (ispravite argumente prijamnika ili `.toml`, ili instalirajte alat prijamnika, pa ponovno pokrenite skriptu)

### 3. Pristupite web-sučelju

Otvorite preglednik na:
```
http://localhost:9000
```

(Zamijenite broj porta svojim konfiguriranim portom)

### 4. Provjerite funkcionalnost

- Slap se mora prikazivati
- Zvuk se mora reproducirati pri kliku na signale
- S-metar mora reagirati na signale
- Brojač korisnika mora pokazivati „1"

### 5. Testirajte s drugog uređaja

S drugog računala u svojoj mreži:
```
http://YOUR_SERVER_IP:9000
```

### 6. Provjerite potrošnju resursa

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Zaustavite poslužitelj

Poslužitelj radi u pozadini pod watchdogom, pa ga **Ctrl+C neće zaustaviti** (a watchdog bi ga ionako ponovno pokrenuo). Koristite zajedničku skriptu za zaustavljanje, koja radi za svaki prijamnik — prvo zaustavlja watchdog, zatim prijamnik i `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Postavljanje automatskog pokretanja

Jednostavan način — i ono što instalacijski program radi kad potvrdite *pokretanje pri podizanju sustava*:

```bash
bash setup-autostart.sh                # skripta za pokretanje iz station.conf
bash setup-autostart.sh start-rtl.sh   # ili je navedite
bash setup-autostart.sh --remove       # više ne pokretati pri podizanju
```

Instalira `phantomsdr-receiver.service`, koji pri podizanju sustava pokreće vašu skriptu, a pri gašenju `stop-websdr.sh`, s grupom `plugdev`, tako da se USB prijemnik otvara i kad nitko nije prijavljen. Ostatak ovog poglavlja pokazuje isto ručno.


---

## Toplinska zaštita procesora

> 📖 **Cjeloviti priručnik: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — četiri načina rada i što sysop mora učiniti u svakome, rad bez ploče, throttle faza bez roota, testiranje i rješavanje problema.

PhantomSDR-Plus donosi čuvara koji zaustavlja poslužitelj ako procesor dosegne opasnu temperaturu i pokreće ga ponovno kad se ohladi. Pragove izvodi iz kritičnog praga koji objavljuje vaš vlastiti procesor, pa nema ničega za računati, i radi s bilo kojim načinom pokretanja/zaustavljanja.

**Ako koristite administratorsku ploču, već ga imate** — radi unutar ploče i podešava se na njezinoj stranici Postavke. Vidi [vodič za administratorsku ploču](ADMIN_PANEL_SETUP.md#thermal-guard). Ostatak ovog odjeljka odnosi se na instalacije **bez** ploče.

## Rješavanje problema

### Pogreške pri izgradnji

#### Problemi s ovisnostima

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Neuspjela konfiguracija Mesona

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` puca uz `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

Izvorni kod nije kriv. Zaostala instalacija preko `pip install --user meson` ostavila je skriptu u `~/.local/bin`, koja na `PATH`-u dolazi prije `/usr/bin` i zato zaklanja ispravnu kopiju koju je instalirao upravitelj paketa. Nadogradnja distribucije (primjerice Ubuntu 24.04 → 26.04) prebacuje Python na novu verziju, stari `site-packages` u kojem je bio `mesonbuild` više nije na putanji uvoza, pa skripta pada prije nego išta napravi. Isto se može dogoditi i `ninji`.

Instalacijska skripta to prepoznaje i zaobilazi za vrijeme trajanja instalacije, uz upozorenje, ali sustav ipak popravite:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # mora ispisati verziju
```

Ako radije želite zadržati meson instaliran preko pipa, ponovno ga instalirajte za Python koji sustav sada ima:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` staje uz `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

S izvornim stablom nije ništa u redu: sistemski sat kasni za datotekama. meson i ninja odbijaju graditi kada je ulazna datoteka novija od trenutnog vremena jer ne mogu znati što je zastarjelo. Događa se na Raspberry Piju bez baterije u RTC ležištu — svako pokretanje kreće od zadnjeg poznatog vremena, pa gradnja pokrenuta prije nego se NTP uskladi vidi cijelo stablo datirano u budućnost — kao i na stablu raspakiranom ili kopiranom sa stroja koji žuri.

Najprije ispravite sat:

```bash
timedatectl                       # je li vrijeme točno? je li NTP usklađen?
sudo timedatectl set-ntp true
```

Pričekajte nekoliko sekundi pa ponovno pokrenite instalater. On to provjerava prije poziva mesona i nudi poništavanje spornih vremenskih oznaka (`PHANTOM_FIX_CLOCK_SKEW=y|n`). Ručno, iz izvornog stabla:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Pozadinski dio je izgrađen, ali web-stranice nema

Simptom je instalacija koja izgleda kao da je uglavnom uspjela: `build/spectrumserver` postoji, poslužitelj se pokreće, a preglednik ne dobiva ništa — jer `frontend/dist/` nikada nije proizveden. Potražite u ispisu instalacijskog programa:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` traži `@swc/core` `^1.12.14`, pa čisti `npm install` razriješi na 1.16.0, čiji `printSync()` odbija sintaksno stablo koje mu dodatak predaje. To nema veze s vašom distribucijom — svaki instalacijski program sada pribada verziju koja radi, kao i `frontend/package.json`. Stroj postavljen prije tog pribadanja nastavlja raditi dok se njegov `node_modules` ne obriše, zbog čega se ovo pri ponovnoj instalaciji pojavi niotkuda.

### Pogreške pri izvođenju

#### Port je već zauzet

```bash
# Find process using port
sudo lsof -i :9000

# Kill process
sudo kill -9 <PID>
```

#### Pristup SDR-u odbijen

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Za **RX-888 MkII** to samo po sebi nije dovoljno — uređaj Cypress FX3 traži i udev pravila. Pokrenite priloženi pomoćni skript (instalira pravila *i* dodaje vas u `plugdev`), zatim se odjavite i prijavite te ponovno priključite uređaj:

```bash
./setup-rx888-udev.sh
```

### Problemi s OpenCL-om

#### clinfo ne prikazuje uređaje

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

### Mrežni problemi

#### Nema pristupa s drugih uređaja

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9000/tcp

# Or disable firewall temporarily for testing
sudo ufw disable

# Fedora / openSUSE (firewalld)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --add-port=9000/tcp
```

Na Fedori i openSUSE-u vatrozid je firewalld, a ne ufw, i uključen je prema zadanim postavkama. `setup_admin.sh` ondje sam otvara javni port proxyja (i u ufw-u, ako ste ga uključili); na stanici instaliranoj ranije jednom pokrenite `./setup_admin.sh --firewall` ili upotrijebite gornje retke `firewall-cmd`. Ako se administratorska ploča ili proxy na tim sustavima ne vrate nakon ponovnog pokretanja, uobičajeni je uzrok SELinux: pokrenite `./setup_admin.sh --selinux` (vidi tablicu za rješavanje problema u ADMIN_PANEL_SETUP.md).

### Problemi sa SDR uređajem

#### RTL-SDR nije pronađen

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay nije pronađen

`grep "RSP1A driver" logwebsdr.txt` pokazuje koji je upravljački program odabrao `start-rsp1a.sh`.

S otvorenim upravljačkim programom (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Sa SDRplay API-jem (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos ili Airspy HF+ nije pronađen

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Ako upravljačkog programa nema na popisu, ponovno pokrenite `./setup-fobos.sh` ili `./setup-airspyhf.sh`: zaustavlja se i navodi razlog ako izgradnja ili provjera SoapySDR-a ne uspije.

---

## Ažuriranje PhantomSDR-Plusa

Od verzije 4.1.0 repozitorij donosi **`update.sh`**, alat koji instalirani prijamnik dovodi u skladu s objavljenim stablom **bez diranja datoteka koje ga čine vašom postajom**. Zamjenjuje ručno pisanu `git pull` skriptu koju su ranija izdanja ovog priručnika tražila da napišete i git mu uopće nije potreban: objavljeno stablo preuzima se kao tarball i uspoređuje s vašim datoteku po datoteku, pa radi jednako bilo da ste repozitorij klonirali, raspakirali
`update.zip` ili stablo prekopirali s USB stika.

### Ako vaša instalacija još nema update.sh

Starije stablo ne sadrži skriptu. Preuzmite je jednom — to je jedini korak koji ćete ikad raditi ručno:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
```

Od tada sve — izvori, frontend, dokumentacija, instalacijski programi i sam `update.sh` — stiže preko alata.

### Pokretanje

```bash
cd ~/PhantomSDR-Plus
bash update.sh
```

Preuzima objavljeno stablo, uspoređuje ga s vašim i ispisuje izvješće. Zatim pita **Update these files now?** — ENTER znači *ne*, i tada ništa nije zapisano. Odgovorite `y` i alat:

1. zaustavlja prijemnik, administratorsku ploču, proxy i relay **ove instalacije** (druga instalacija na istom računalu nastavlja raditi),
2. sprema svaku datoteku koju će zamijeniti u datiranu arhivu u `update-backups/`,
3. zapisuje nove datoteke,
4. ponovno gradi samo ono što se promijenilo — poslužitelj, stranicu ili oboje — bez ikakvih pitanja,
5. ponovno pokreće točno ono što je zaustavio.

Tri vrste datoteka obrađuju se različito:

| Datoteke | Što se događa |
|---|---|
| `station.conf`, `config.toml`, `config-<prijemnik>.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frontend/site_information.json`, `frontend/variant.json`, `frequencylist/`, `chat_history.txt`, logovi, `build/`, `frontend/dist/` | **Nikad se ne diraju**, niti se prikazuju u pitanju. One čine računalo *vašim* prijemnikom. |
| `start-*.sh`, `stop-websdr.sh`, jedinice `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `proxy.py`, `admin_server.py`, `frontend/src/bands-config.js` i druge datoteke koje sysop ima razloga uređivati | **Ažuriraju se ako ih nikad niste uređivali; pita se ako jeste.** |
| Sve ostalo | Ažurira se. |

Svaka verzija donosi `update-known.txt`, otisak svake verzije svake datoteke koja je ikad objavljena. Vaša datoteka koja odgovara jednoj od njih jednostavno je starija i ažurira se bez pitanja — tako čak i prvo ažuriranje pita samo za datoteke koje ste stvarno promijenili. Za svaku od njih birate:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — vaša datoteka ostaje točno kakva jest.
* **upstream** — instalira se nova verzija; vaša je u sigurnosnoj kopiji.
* **both** — nova verzija zapisuje se pokraj vaše kao `start-rx888mk2.sh.new`, za spajanje kad vam odgovara.

Ništa se nikad ne briše: datoteke koje su nestale iz repozitorija se prijavljuju, a uklanjaju se samo ako to zatražite s `--prune`. Izvođenje koje ništa ne zapisuje završava s `0` kad je sve ažurno i s `10` kad čeka ažuriranje, pa vas cron zadatak s `bash update.sh --check` može obavijestiti kad ima posla.

### Poništavanje ažuriranja

```bash
./update.sh --restore LAST
```

Svaka datoteka koju ažuriranje prepiše najprije se sprema, u jednu arhivu s datumom po pokretanju, u običnu, vidljivu mapu `update-backups/`:

```
update-backups/phantomsdr-backup-20260923-164530.zip
```

Arhiva sadrži samo datoteke koje je to pokretanje zamijenilo, svaku na putanji koju ima u vašem stablu, pa se može kopirati na drugo računalo kao jedna datoteka, otvoriti bilo gdje ili raspakirati izravno preko instalacije. Gdje `zip` nije instaliran, zapisuje se kao `.tar.gz`. Čuvaju se tri najnovije. Bilo koja od ovih naredbi vraća ono što je ažuriranje zamijenilo:

```bash
./update.sh --restore LAST
./update.sh --restore phantomsdr-backup-20260923-164530.zip
```

Svaka arhiva nosi i vlastiti `restore.sh`, za slučaj da je problem sam `update.sh`: raspakirajte arhivu i dajte mu direktorij svoje instalacije, na primjer `./restore.sh /home/pi/PhantomSDR-Plus`. Tijekom vraćanja `update.sh` radi iz kopije izvan stabla, jer je obično i sam jedna od datoteka koje se vraćaju.

### Ostale mogućnosti

```bash
./update.sh --apply --yes     # nikada ne pita; svaka vaša izmijenjena datoteka OSTAJE
./update.sh --check           # samo izvješće, nikad pitanje — za cron (10 = čeka ažuriranje)
./update.sh --from FILE|DIR   # nova verzija iz .zip/.tar.gz ili mape — bez mreže
./update.sh --ref v5.5.0      # oznaka, grana ili commit umjesto trenutnog stabla
./update.sh --list-excludes   # ispisuje pravila "ne diraj" kako vrijede ovdje
./update.sh --verbose         # nabraja sve datoteke, ne samo prvih 40
```

Vlastita pravila "ne diraj" dodajete tako da u `update-exclude.txt` u korijenskoj mapi instalacije upišete jedan uzorak po retku.

### Ako izgradnja padne na vrlo staroj instalaciji

`update.sh` ažurira datoteke, a ne sistemske pakete. Ako je vaše stablo toliko staro da
izgradnja sada traži biblioteke kojih nemate, `recompile.sh` će stati s greškom prevoditelja ili mesona. To nije pokvareno ažuriranje — nedostaju ovisnosti:

```bash
./install.sh
```

Instalacijska skripta i sama se ažurira istim pokretanjem, a vaša konfiguracija preživljava i nju.

### Bez internetske veze na prijemniku

Preuzmite cijeli repozitorij na drugom računalu (GitHub → *Code* → *Download ZIP*), prenesite ga, i:

```bash
bash update.sh --from ~/PhantomSDR-Plus-main.zip
```

Sve ostalo je točno kao gore — izvješće, pitanje, sigurnosna kopija, izgradnja, ponovno pokretanje.

### Ručno ažuriranje

Ako paket datoteka radije primjenjujete sami:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # ili skripta za pokretanje vašeg prijamnika
```

Prvo sigurnosno pohranite svoju konfiguraciju — `config-*.toml`,
`frontend/site_information.json`, `admin_config.json` i `markers.json` — jer paket datoteka ne
može razlikovati vaše izmjene od onih iz izdanja. Upravo taj problem `update.sh` rješava.

---

## Dodatak B: primjeri konfiguracije

### Primjer 1: RTL-SDR za VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Primjer 2: RX-888 mk2 za KV (0-30 MHz)

Prijamnik koji koristi većina sysopa. Ovo je cijeli `[input]` odjeljak, a ne isječak, s vrijednostima iz `config-rx888mk2.toml` koji dolazi uz repozitorij.

```toml
[input]
sps = 60000000            # 0-30 MHz izravnim uzorkovanjem
fft_size = 4194304        # vidjeti napomenu ispod
fft_threads = 8
brightness_offset = -9    # negativnije ako slap pokazuje crne mrlje
frequency = 0             # osnovni pojas: RX-888 uzorkuje od DC-a
signal = "real"           # ne "iq" - izravno uzorkovanje daje realni tok
accelerator = "opencl"    # "none" ako nema OpenCL okruženja
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Napaja ga `rx888_stream`, što za vas obavlja `start-rx888mk2.sh`:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**O `fft_size`:** pri 60 MSPS ispravna je veličina 4194304. 8388608 udvostručuje razlučivost slapa, a s njom i memoriju te procesorsku cijenu svake transformacije; na većini strojeva oštrije binove plaćate izgubljenim okvirima. Počnite s 4194304 i povećavajte samo ako poslužitelj ima obilje rezerve.

### Primjer 3: HackRF za širokopojasni FM

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
