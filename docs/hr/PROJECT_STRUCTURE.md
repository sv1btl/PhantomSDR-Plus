# Struktura projekta PhantomSDR-Plus

Ovaj dokument daje sveobuhvatan pregled strukture direktorija PhantomSDR-Plusa, organizacije datoteka i odnosa među komponentama.

---

## Sadržaj

1. [Stablo direktorija](#stablo-direktorija)
2. [Korijenski direktorij](#korijenski-direktorij)
3. [Izvorni kod (`src/`)](#izvorni-kod-src)
4. [Sučelje (`frontend/`)](#sučelje-frontend)
5. [Popisi frekvencija (`frequencylist/`)](#popisi-frekvencija-frequencylist)
6. [Konfiguracijske datoteke](#konfiguracijske-datoteke)
7. [Sustav izgradnje](#sustav-izgradnje)

---

## Stablo direktorija

*Samo glavne mape i datoteke s kojima sysop radi; potpuni popis je u samom repozitoriju.*

```
PhantomSDR-Plus
├── add-receiver.sh            # dodaje još jedan prijemnik: upravljački program, instances/<ime>/, receivers.toml — vidi docs/MULTI_RECEIVER.md
├── admin_server.py
├── autorun
├── config-rtl.toml
├── config.toml
├── configure-station.sh       # čarobnjak stanice: pita jednom, zapisuje station.conf, .toml i site_information.json
├── docs
├── drm                        # gradi setup-drm.sh: src/ i bin/ (nije u gitu)
├── frequencylist
├── frontend
├── install.sh
├── instances                  # dodatni prijemnici, svaki u svojoj mapi (nije u gitu) — vidi docs/MULTI_RECEIVER.md
├── jsdsp
├── proxy.py                   # jedini javni port: stranica, /admin, /rade, /stats, /relay i prijemnici ?rx=
├── rade_helper.py             # RADE sidecar: V1 kroz ~/radae, V2 (beta) kroz ~/rade_c
├── recompile.sh               # izgradnja; --backend / --frontend / --both ništa ne pitaju
├── receivers.toml.example     # popis prijemnika za proxy.py — kopirati u receivers.toml
├── setup-https.sh             # https:// ispred: Caddy na 443 s Let's Encrypt certifikatom — vidi docs/HTTPS.md
├── src
├── start-rtl.sh
├── start-rx888mk2.sh
├── station.conf               # odgovori stanice čarobnjaku (nije u gitu, update.sh ga nikad ne dira)
├── stop-websdr.sh
├── subprojects
├── tci-bridge
├── thermal_guard.py           # Zaštita od pregrijavanja procesora za administratorsku ploču (radi i samostalno)
├── update.sh                  # ažuriranje: izvješće, zatim „update now?“; --check, --from, --make-known
└── websdr_relay.py            # sam relej — vidi docs/RECEIVE_DIVERSITY.md
```
---

## Korijenski direktorij

### Konfiguracijske datoteke

| Datoteka | Svrha | Kada je mijenjati |
|----------|-------|-------------------|
| `config.toml` | Zadana konfiguracija | Početno postavljanje, testiranje |
| `config-rtl.toml` | Konfiguracija specifična za RTL-SDR | Pri korištenju RTL-SDR uređaja |
| `config-rsp1a.toml` | Konfiguracija za SDRplay RSP1A | Pri korištenju RSP1A |
| `config-airspyhf.toml` | Konfiguracija za Airspy HF+ | Pri korištenju Airspyja |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (0-25 MHz) | Pri korištenju Fobosa na KV |
| `config-fobos.toml` | RigExpert Fobos SDR, RF grana (25-6000 MHz) | Pri korištenju Fobosa iznad 25 MHz |
| `config-hackrf.toml` | Konfiguracija za HackRF One | Pri korištenju HackRF-a |
| `config-rx888mk2.toml` | Konfiguracija za RX888 MK2 | Pri korištenju RX888 |
| `config.example.hackrf.toml` | Primjer za HackRF One | Pri korištenju HackRF-a |
| `station.conf` | Odgovori čarobnjaku stanice — prijemnik, pojas, stanica, portovi, dodaci. Zapisuje ga `configure-station.sh`; čitaju ga skripte za pokretanje i `proxy.py`. Nikad u gitu, `update.sh` ga nikad ne dira | Kroz `bash configure-station.sh` |
| `main.env` | Vlastiti `instance.env` glavnog prijemnika: njegov redak argumenata (`RX888_ARGS` / `RX_ARGS`) s pojačanjem iz Admin → Receivers → ✎ CHANGE SETTINGS. Svaka startna skripta čita ga posljednjeg; ne postoji dok se ne spremi pojačanje. Nikad u gitu, `update.sh` ga nikad ne dira | Admin → Receivers, ili ručno |

### Skripte za pokretanje/zaustavljanje i održavanje

Svaka od donjih `start-*.sh` skripti samostalan je **pokretač + watchdog + zapisivač**: zaustavlja svaku pokrenutu instancu, podiže prijamnik + `spectrumserver`, odvaja se u pozadinu, automatski ponovno pokreće lanac ako se ugasi i zapisuje u `logwebsdr.txt`. Dijele jednu skriptu za zaustavljanje i jedno `flock` zaključavanje (istodobno radi samo jedan prijamnik). Uredite samo blok **RECEIVER CONFIGURATION** na vrhu svake (argumenti prijamnika / konfiguracija / naziv procesa). Šest skripti za pokretanje izrađenih iz istog predloška (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) identične su ispod tog bloka; `start-rx888mk2.sh` je zasebna skripta. Od v5.0.0 više prijemnika može raditi jedan uz drugi: skripta pokrenuta s `INSTANCE=<ime>` daje tom prijemniku vlastitu mapu u `instances/<ime>/` te vlastiti zapisnik, zaključavanje i FIFO — vidi [Više prijemnika](MULTI_RECEIVER.md).

| Skripta | Svrha |
|---------|-------|
| `install.sh` | Automatska instalacija i izgradnja — prvo pitanja o stanici, zatim sve bez nadzora (također `install_fedora.sh`, `install_arch.sh`, `install_opensuse.sh`) |
| `configure-station.sh` | Čarobnjak stanice: prijemnik, pojas, stanica, internet, portovi i dodaci, pitani jednom i spremljeni u `station.conf`; iz njega zapisuje `.toml` prijemnika, `site_information.json` i postavke relaya, mijenjajući samo vlastite ključeve i prije toga spremajući kopiju svake datoteke. `--show` ispisuje odgovore, `--apply` iz njih ponovno zapisuje datoteke — vidi [Vodič za instalaciju](INSTALLATION.md) |
| `setup-autostart.sh` | Pokretanje pri podizanju sustava: instalira `phantomsdr-receiver.service`, koji pri podizanju pokreće skriptu iz `station.conf` (ili navedenu), a pri gašenju `stop-websdr.sh`, s grupom `plugdev`; `--remove` to poništava |
| `setup-https.sh` | Poslužuje prijemnik preko https:// uz http://: instalira Caddy na port 443 s Let's Encrypt certifikatom za DNS ime stanice (sam se obnavlja) i usmjerava ga na loopback port `PORT_TLS` u `proxy.py`, gdje proxy od Caddyja preuzima stvarnu adresu svakog posjetitelja. `--lan` za lokalnu mrežu s Caddyjevim vlastitim certifikatom, `--status`, `--remove`; pitanja o stanici pokreću ga kad se odabere https — vidi [Siguran pristup](HTTPS.md) |
| `add-receiver.sh` | Dodaje još jedan prijemnik ovom računalu: pita koji prijemnik i što pokriva, instalira njegov upravljački program, stvara `instances/<ime>/` i unos u `receivers.toml` te nudi da ga pokrene i ponovno pokrene proxy. Instalacijske skripte nude ga na kraju — vidi [Više prijemnika](MULTI_RECEIVER.md) |
| `start-rtl.sh` | Pokretanje + watchdog poslužitelja s RTL-SDR-om (`rtl_sdr`) |
| `start-rsp1a.sh` | Pokretanje + watchdog poslužitelja sa SDRplay RSP1A (`rx_sdr`); koristi libmirisdr-5, ili SDRplay API kad je instaliran (`RX_DRIVER` nameće jedan) |
| `start-airspyhf.sh` | Pokretanje + watchdog poslužitelja s Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Pokretanje + watchdog poslužitelja s RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Pokretanje + watchdog poslužitelja s RigExpert Fobos SDR, RF grana (`rx_sdr`) |
| `start-hackrf.sh` | Pokretanje + watchdog poslužitelja s HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Pokretanje + watchdog poslužitelja s RX888 MK2 (`rx888_stream`) |
| `start-all.sh` | Pokreće svaki prijemnik iz `receivers.toml` njegovom vlastitom skriptom — na stanici s više prijemnika postavite ga kao skriptu za pokretanje u administratorskoj ploči; vidi [Više prijemnika](MULTI_RECEIVER.md) |
| `stop-websdr.sh` | Zaustavlja poslužitelj i njegov watchdog — zajedničko za sve prijamnike |
| `stop-websdr.sh <instanca>` | Zaustavlja samo jedan prijemnik (`main` za glavni); bez argumenta zaustavljaju se svi, kao i prije |
| `setup-rx888-udev.sh` | Instalira udev pravila da `rx888_stream` za RX-888 radi bez sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Instaliraju SoapySDR lanac upravljačkog programa za RSP1A, Fobos ili Airspy HF+ — SoapySDR iz distribucije, upravljački program i rx_tools izgrađeni u `sdr_drivers/`, udev pravilo — na bilo kojoj od četiri podržane distribucije. Pokreću ih opcije 3, 5 i 6 instalacije; rade i samostalno. Zajednički kod u `setup-sdr-common.sh` — vidi [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Instalira paket `hackrf` iz distribucije i udev pravilo za HackRF One, na bilo kojoj od četiri podržane distribucije; pokreće ga opcija 7 instalacije |
| `setup-rtlsdr.sh` | Instalira RTL-SDR upravljački program na bilo kojoj od četiri podržane distribucije — paket `rtl-sdr` distribucije ili, s `RTL_V4=y`, upravljački program za RTL-SDR Blog V4 izgrađen iz izvornog koda — blokira DVB-T upravljački program i dodaje udev pravilo; pokreće ga `add-receiver.sh` |
| `setup-firewall.sh` | Neobvezna zaštita od poplave na razini jezgre: učitava nftables tablicu s gornjom granicom istodobnih veza i brzinom po izvorišnoj adresi na priključcima prijemnika, kočnicom za grubo pogađanje SSH lozinki i Windows dijeljenjem datoteka zatvorenim izvan privatnih raspona. Treba root, ne može vas zaključati vani (policy accept, uspostavljene veze prihvaćaju se prve), a `--apply` se sam poništi ako se ne potvrdi unutar 60 s — vidi [Ograničenja veza](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Daje grupi `cpufreq` pravo pisanja na ograničenje frekvencije procesora, kako bi throttle faza čuvara radila bez roota. Instalira `tmpfiles.d` pravilo da preživi ponovno pokretanje; `--revoke` sve poništava |
| `update.sh` | Ažurira instalaciju iz objavljenog stabla, ne dirajući vaše postavke, markere, popis frekvencija i lokalne izmjene: izvješće, pitanje „Update these files now?“ (ENTER = ne), sigurnosna kopija, primjena i izgradnja samo onoga što se promijenilo. `--check` za cron, `--from` iz ZIP-a, tarballa ili mape bez mreže — vidi [Vodič za instalaciju](INSTALLATION.md) |
| `update-known.txt` | SHA-256 svake verzije svake datoteke koja je ikad objavljena, isporučen sa svakom verzijom, kako bi `update.sh` bez pitanja ažurirao datoteku koja je samo starija. Zapisuje se s `bash update.sh --make-known` u izvornom stablu |
| `recompile.sh` | Ponovno gradi backend i/ili frontend i bira varijantu na `/`. S `--backend`, `--frontend` ili `--both` ništa ne pita i zadržava trenutnu varijantu — tako ga pozivaju `install.sh` i `update.sh` |
| `smeter_theme.sh` | Postavi zadani izgled analognog S-metra (dark / amber / vintage) za sve korisnike i ponudi ponovnu izgradnju frontenda — vidi [Uređivanje varijanti](https://github.com/sv1btl/PhantomSDR-Plus/blob/main/docs/hr/EDITING_VARIANTS.md) |
| `waterfall.sh` | Mijenja zadanu minimalnu razinu slapa (dB) u `waterfall.js` + `App.svelte` — vidi [README](README.md) |
| `kiwi_install.sh` | Instalira emulaciju KiwiSDR klijenata na stablo koje je nema: zakrpava izvorni kod pozadinskog dijela, kopira `src/kiwi_bridge.h` i dodaje dokumentirani `[kiwi_emulation]` blok u konfiguracijske datoteke u korijenu. Idempotentan je i sprema kopiju svake datoteke koje se dotakne — vidi [Emulacija KiwiSDR klijenata](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Prijemnik ga ne koristi. Mali Node.js program koji slušatelj pokreće uz vlastiti primopredajnik: čita frekvenciju, način rada i stanje odašiljanja iz Hamlibova `rigctld` i nudi ih kao TCI na portu 50001, pa gumb **TCI-CAT** na stranici može upravljati uređajem bez vlastitog TCI-ja, poput IC-7300 — vidi [Upravljanje primopredajnikom](RIG_CONTROL.md) |

### Podatkovne datoteke

| Datoteka | Svrha | Format |
|----------|-------|--------|
| `markers.json` | Frekvencijske oznake i markeri | JSON |
| `chat_history.txt` | Poruke korisničkog razgovora | Običan tekst |
| `favicon.ico` | Ikona web-mjesta | ICO slika |
| `fftw_wisdom` | Podaci za optimizaciju FFT-a | FFTW binarno |
| `phantom_fftw_wisdom` | Dodatna optimizacija FFT-a | FFTW binarno |

### Administratorska ploča i prijavljivanje spotova

| Datoteka | Svrha |
|----------|-------|
| `admin_server.py` | Sama administratorska ploča. Uz stranice za upravljanje pokreće i uzorkivač stranice **Grafikoni**: pozadinska dretva svake 2 sekunde bilježi frekvenciju procesora, opterećenje, temperaturu i broj korisnika te ih drži samo u memoriji — 1 sat u punoj razlučivosti plus 24 sata prosjeka po 30 sekundi. Ništa se ne zapisuje na disk pa se povijest gubi pri ponovnom pokretanju. |
| `admin_config.json` | Postavke administratorske ploče (hash lozinke, portovi, opcije, pragovi toplinske zaštite) |
| `proxy.py` | Javni port. Poslužuje stranicu i prosljeđuje `/admin` ploči te — na stanici postavljenoj čarobnjakom — `/rade`, `/stats` i `/relay` uslugama iza sebe, tako da se prosljeđuje samo jedan port. Portove čita iz `admin_config.json`, ili iz `station.conf` kad nema ploče (`setup_admin.sh --proxy-only`) |
| `thermal_guard.py` | Zaštita od pregrijavanja procesora. Zaustavlja poslužitelj kada procesor postane prevruć i ponovno ga pokreće kad se ohladi, izvodeći pragove iz kritičnog praga koji objavljuje vaš vlastiti procesor umjesto iz fiksnog broja. Nikada ne pokušava prepoznati što nadzire poslužitelj — dok je pregrijan, ponavlja zaustavljanje svake 2 s, pa je watchdog, systemd jedinica ili cron zadatak koji ga oživi poništen dok se stroj ne ohladi. Samo standardna biblioteka; uvozi ga `admin_server.py` (takt daje uzorkivač Grafikona), a radi i samostalno za instalacije bez ploče. Zadano samo zapisuje, pa ni na što ne djeluje dok se ne uključi — vidi [Administratorska ploča]vidi [priručnik Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | Daemon za prijavljivanje spotova — vidi [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Koje pojaseve/načine dekodirati i u kojim UTC satima, identitet, odredišta i automatsko pokretanje |
| `autorun-stopped` | Postoji nakon STOP u ploči: automatsko pokretanje ostavlja daemon zaustavljenim, i nakon ponovnog pokretanja, do START |
| `autorun-status.json` | Trenutačno stanje daemona — puni brojače **tekućeg rada** (pločice po dekoderu), koje Stop/Start vraća na nulu |
| `autorun-totals.json` | **Ukupno** poslani spotovi po pojasu i načinu rada — broj uz svaki potvrdni okvir; zapisuje ga daemon pa preživljava ponovna pokretanja |

### Datoteke sustava izgradnje

| Datoteka | Svrha |
|----------|-------|
| `meson.build` | Glavna konfiguracija izgradnje |
| `meson_options.txt` | Podesive opcije izgradnje |
| `.gitattributes` | Atributi Git repozitorija |

---

## Izvorni kod (`src/`)

Direktorij `src/` sadrži implementaciju pozadinskog dijela u C++-u.

### Ključne komponente

#### 1. Glavna aplikacija (`main.cpp`)
- Raščlanjuje argumente naredbenog retka
- Učitava konfiguracijsku datoteku
- Inicijalizira komponente poslužitelja
- Pokreće petlju događaja

#### 2. Poslužitelj spektra (`spectrumserver.cpp`)
- Koordinira sve komponente
- Upravlja korisničkim vezama
- Distribuira podatke spektra
- Obrađuje korisničke zahtjeve

#### 3. Upravljački programi za SDR (`drivers/`)
- Apstraktno sučelje za SDR hardver
- Čitanje i oblikovanje podataka uzoraka
- Rukovanje značajkama specifičnima za uređaj

#### 4. DSP mehanizam (`dsp/`)
- Izračun FFT-a (ubrzan CPU-om/GPU-om)
- Demodulacija (AM, FM, SSB, CW itd.)
- Filtriranje i ponovno uzorkovanje zvuka
- AGC po slušatelju — Auto (podešen po načinu rada) ili Fast / Medium / Slow kao na primopredajniku, odabran naredbom `agc_speed` (`utils/audioprocessing.cpp`) — i smanjenje šuma

#### 5. Web-poslužitelj (`server/`)
- Komunikacija putem WebSocketa
- Posluživanje statičkih HTTP datoteka
- Upravljanje korisničkim sesijama
- Prijenos podataka u stvarnom vremenu

#### 6. Kodiranje zvuka (`audio/`)
- FLAC kompresija
- Opus kompresija
- Optimizacija emitiranja

---

## Sučelje (`frontend/`)

Web-sučelje izgrađeno pomoću Sveltea i Vitea.


#### 1. Glavna aplikacija (`App.svelte`)
- Komponenta najviše razine
- Struktura rasporeda
- Usklađivanje komponenti
- **Red gumba dekodera** — po jedan gumb za svaki dekoder na glavnoj ploči, odmah ispod izbornika načina rada; jedan pritisak pokreće dekoder i otvara njegov prozor, drugi ga zaustavlja. Zamijenio je dotadašnji red za širinu pojasa. RADE-v2U/RADE-v1L/RADE-v1U su u `lib/ModesSelector.svelte`, uz izbornik načina rada te u skočnim prozorima **Modes** i **Bands**.
- **Redak verzije** — „PhantomSDR+ | v5.5.0 original from github.com/sv1btl/PhantomSDR-Plus”, s adresom kao poveznicom; isti redak nalazi se i na stranici /mobile. Broj verzije i adresa nalaze se u `lib/version.js`; redak je navođenje autorstva obuhvaćeno datotekom `ADDITIONAL_TERMS.md`.

#### 2. Prikaz slapa (`waterfall.js` + `lib/`)
- Iscrtavanje spektra i slapa na platnu (canvas) i palete boja u `waterfall.js` (čisti JS, nije komponenta); preračunavanje svjetline/kontrasta za **Auto Adj.** je `lib/wfAutoLevel.js`
- Interaktivno ugađanje putem `lib/PassbandTuner.svelte`
- Preklopi plana pojaseva i oznaka putem `lib/FrequencyMarkers.svelte`
- Audio analizator je `lib/Spectrogram.svelte`, SSB audio izvještaj `lib/SsbReport.svelte`, a AM/FM izvještaj `lib/AmFmReport.svelte`; njihova RF mjerenja (zauzeta širina, nosilac i suprotni bočni pojas kod SSB-a, dubina AM-a i devijacija FM-a, RF prikaz u AM/FM) daju `measureOccupied`, `measureSsb`, `measureAmFm` i `getRfSlice` u `waterfall.js`, koji dok je analizator otvoren drži nevidljivu vezu slapa fine rezolucije oko ugođene frekvencije (`detailFollow`), pa rade pri bilo kojem zumu; preuzet iz PhantomSDR-ORSAT autora F1NSK
- 3D spektar je `lib/Waterfall3D.svelte` (WebGL2): dok je otvoren, `waterfall.js` mu preko `waterfall.view3d` predaje svaki red s razinama slapa (primijenjeni Min/Max i Auto Adj.), raspon zumiranja i paletu boja; preuzet iz PhantomSDR-ORSAT autora F1NSK

#### 3. Kontrole (`App.svelte` + `lib/`)
- Unos i prikaz frekvencije — `lib/FrequencyInput.svelte`
- Brojčana tipkovnica za upis frekvencije — `lib/FreqKeypad.svelte`; upisana se frekvencija ugađa sa zoomom, Min/Max i načinom rada svog pojasa (`tuneTypedFrequency()` u `App.svelte`), a ona koju pokriva drugi prijemnik otvara taj prijemnik
- Trake **Show All** ostalih prijemnika — `lib/RxStrip.svelte`: po jedan socket `/waterfall?rx=<id>`, svaki okvir dekodiran i nacrtan, u paleti i razinama drugog prijemnika, najnoviji redak na vrhu; rasponi prijemnika i poveznice među njima dolaze iz `lib/receivers.js`; s dva ili više pojasa u rasponu drugog prijemnika, padajući popis pojasa u njezinom zaglavlju (izbor u `localStorage` `rxStripView:<id>`, klik stiže s `&band=1`)
- Odabir načina rada (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, promjena pojasa — `lib/BandSelector.svelte`
- EiBi prozor — `lib/SwSchedule.svelte`: pretražuje `/eibi.json` po kriterijima shortwave.livea; redak ugađa putem klika na marker (`handleFrequencyMarkerClick()` u `App.svelte`, pa načini dekodera pokreću svoj dekoder), a zelene rezultate i crveni marker „sada slušate“ crta `lib/FrequencyMarkers.svelte`, a **Hide HFCC markers** skriva unose u `markers.json` koje `update-markers.sh` označava s `"source": "hfcc"`; CW retci ugađaju se načinom markera `MORSE`, pa otvaraju CW dekoder
- AGC/NR/NB i ostale kontrole nalaze se u samom `App.svelte`; zasebna `Controls.svelte` ne postoji

#### 3a. Skener (`scanner.js`)
- Pretraga kanala: vodi prijemnik preko raspona i zaustavlja se na prvom kanalu sa signalom. Čisti JS, ne komponenta — `App.svelte` daje VFO, način rada, plan pojaseva i poziv za ugađanje, a natrag prima stanje sučelja kroz jedan povratni poziv
- Prag je u dB iznad šuma pojasa umjesto apsolutne razine i koristi šum koji `waterfall.js` ionako prati (`snrNoiseDb`), pa mu ne treba vlastita kalibracija
- Dva načina prelaska pojasa: ugoditi i poslušati svaki kanal, ili najprije pregledati spektar i ugoditi samo ono što se ne može isključiti. Spektar smije preskočiti kanal, ali nikada stati na njemu — svako zaustavljanje dolazi iz stvarnog slušanja
- Raspon je ili pojas iz plana pojaseva ili točno ono što slap prikazuje; automatski nastavak, najdulje zadržavanje i popis isključenih kanala također su ovdje i čuvaju se u `localStorage`

#### 4. Audiosustav (`audio.js`)
- Audiotok putem WebSocketa
- Dekodiranje FLAC-a/Opusa
- Upravljanje reprodukcijom zvuka
- Distribuira sirovi PCM (uzet prije smanjenja šuma i utišavanja u pregledniku; AGC poslužitelja drži se na Slow dok je dekoder otvoren) dekoderima načina rada
- Smanjenje šuma umjetnom inteligencijom: `lib/rnnoise.js` učitava RNNoise WebAssembly modul (`@jitsi/rnnoise-wasm`) pri prvoj uporabi; `audio.js` ga primjenjuje samo u govornim načinima, iza odvojka za dekodere, pa ga oni nikad ne čuju
- FLAC ide kroz `flacLowLatency.js`, koji dekodira svaki paket u trenutku kad stigne i stvarnu brzinu toka (na primjer 12016,3 Hz) svodi na 12000 Hz resamplerom sa 64 koeficijenta (2,7 ms kašnjenja). WASM dekoder u `modules/` puštao je zvuk u fiksnim blokovima od 1024 uzorka i zadržavao oko 160 ms; i dalje se koristi za Opus, za izvore diversity prijema i za FLAC kad se stranica otvori s `?flac=wasm`
- Upravljanje spremnikom reprodukcije (`playoutControl.js`): `ArrivalMeter` mjeri koliko nepravilno paketi stižu u odnosu na vlastitu vremensku os toka te odstupanje između takta uzorkovanja prijamnika i zvučne kartice slušatelja; `CushionController` drži najmanju popunjenost spremnika u posljednjoj minuti blizu rezerve odabranog koraka spremnika tako što izreže ili ponovi jednu periodu usklađenu s visinom tona (`spliceOut` / `spliceIn`) u zvuku koji ide prema zvučniku. Dekoderi i snimke dobivaju netaknut tok. Vrijedi za put s planiranim spremnicima koji koristi svaki slušatelj stanice na običnom http-u; `?drain=0` ga isključuje, `?diag=1` prikazuje njegove vrijednosti

#### 4a. Dekoderi načina rada i njihovi workeri

Svaki od zahtjevnih dekodera načina rada izvodi se u vlastitom Web Workeru, pa dekodiranje nikada ne blokira reprodukciju zvuka ni slap. Slijede jedan zajednički obrazac — tri datoteke po dekoderu:

| Dekoder | Mehanizam | Worker | Proxy na glavnoj dretvi |
|---------|-----------|--------|--------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FLDIGI (ALE 2G HAM, FSK/RTTY, PSK31/63/125, QPSK, Olivia, Contestia, PSK Browser, Olivia Browser, RTTY Browser, MFSK Browser, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet/APRS) + SERVICES (Maritime FSK / SITOR, Weather RTTY, ALE 2G) | `fsk.js`, `psk31.js`, `olivia.js`, `mfsk.js`, `ifk.js`, `throb.js`, `hell.js`, `mt63.js`, `fldigiFec.js`, `ax25.js`, `ale.js`, `fst4w.js`, `msk144.js`, `pskBrowser.js`, `oliviaBrowser.js`, `rttyBrowser.js`, `mfskBrowser.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| SERVICES (DSC, Time Signals, HF Selcall) | `dsc.js`, `timesig.js` | `services.worker.js` | `servicesWorkerProxy.js` |
| CW, CW Browser | `cwDecoder.js`, `cwBrowser.js` | `cw.worker.js` | `cwWorkerProxy.js` |

#### 4b. Diverziti prijam (`diversity.js`)
- Povezuje lokalni prijamnik s drugim na drugoj lokaciji i prati onu koja trenutačno ima bolji signal. Običan JS, ne komponenta — oslanja se na jedno mjesto u `audio.js`, koje mu predaje lokalni PCM i reproducira ono što vrati
- **Odabir, ne zbrajanje.** Dvije lokacije čuju isti prijenos preko različitih ionosferskih putova, pa im valni oblici imaju nepovezanu fazu; zbrajanje zvuči češljasto filtrirano. Koherentno spajanje tražilo bi zajednički takt, koji dva prijamnika preko interneta ne dijele. Miješa se samo tijekom preklapanja od 30 ms
- Poravnanje korelira dvije **zvučne ovojnice** (logaritamska snaga na 100 Hz), nikad valne oblike — ovojnica preživljava i put i bilo koji kodek. Zaključavanje se prihvaća tek kad se druga, neovisna pretraga složi, čime se odbacuje uvjerljivo ali pogrešno kašnjenje koje bi dale dvije lokacije koje blijede u protufazi
- Udaljeni tok se najprije **zaključava po brzini** na lokalni. Dva prijamnika znače dva takta i dva lanca decimacije, pa im zvuk stiže i do 2% razmaknuto čak i kad oba prijavljuju 12 kHz — 240 uzoraka u sekundi klizanja, što nijedna korelacija ne zadržava. Omjer se mjeri iz toga koliko uzoraka svaka strana stvarno isporuči, a primjenjuje ga preuzorkivač koji nosi svoju razlomljenu fazu preko granica blokova, pa proizvoljan omjer drži neograničeno
- Odabir lokacije koristi percentilni SNR mjeren na **sadržajno poravnatim** uzorcima, uz histerezu, mjerač zadržavanja i brzi izlaz ako aktivna lokacija propadne. Razine se usklađuju šum na šum, pa promjena ne mijenja pozadinski šum
- Dekoderi zadržavaju **lokalni** tok: FT8, JS8, WSPR i RADE integriraju koherentno kroz odsječak, a promjena usred njega prekid je faze koji može stajati dekodiranja

#### 4c. Izvori diverzitija (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Jedan ugovor — `onPcm` / `onState` / `tune` / `canReceive` — tako da `diversity.js` nikad ne saznaje što je s druge strane. Dodavanje vrste prijamnika je jedna nova datoteka
- `remoteSource.js` — još jedan PhantomSDR-Plus preko `/audio` (cbor + FLAC), uz ponovnu upotrebu `createDecoder()` iz `lib/wrappers.js`
- `kiwiSource.js` — KiwiSDR: `SND` okviri, big-endian PCM, s 10-bajtnim GPS vremenskim žigom koji stereo paket umeće ispred zvuka
- `uberSource.js` — UberSDR preko vlastitog `/ws`: Opus iza 21-bajtnog zaglavlja, ugađanje preko otvorene veze. Identifikator sesije mora se prije prijaviti s `POST /connection` i mora biti UUID
- `webSdrSource.js` — WebSDR, kroz `websdr_relay.py` na ovom poslužitelju: preglednik se ne može spojiti izravno jer WebSDR provjerava zaglavlje `Origin`, a nijedna skripta ga ne smije mijenjati. Ugađanje ide kao tekstni okvir istom vezom; pokrivenost opsega daje relej
- `webSdrCodec.js` — WebSDR-ov audio format: bajtno označen tok čiji komprimirani blokovi pogone leaky-LMS prediktor s 20 odvoda. Prenesen iz WebSDR klijenta i provjeren uzorak po uzorak
- `diversityList.js` — popis spremljenih prijamnika i pravila adresa za četiri vrste, zajednički stolnoj ploči i mobilnoj stranici, tako da jedan format služi objema. Uz to i prijenos — kompaktan blob, njegov QR kod i parser koji prihvaća svaki oblik koji su dvije stranice ikad zapisale — te `browseUrl()`, koja pozvanu adresu vraća u onu koju preglednik može otvoriti
- `lib/DiversityPanel.svelte` — sučelje: adresa, vrsta izvora, SNR trim i stanje uživo, uz spremljene prijamnike — imenovane, slobodnog redoslijeda, s izvozom i uvozom u JSON datoteku, po vrsti izvora u `localStorage`. Sve se uređuje unutar ploče: `prompt()` i `confirm()` blokiraju glavnu dretvu, a upravo se preko nje zvuk gura u playback worklet. Gumb **▦ QR** crta popis kao kod za skeniranje, jer `localStorage` pripada jednom pregledniku, a mobitel počinje prazan. `mobile/Mobile.svelte` nosi istu funkciju u kartici **Div**, u vlastitom jednostavnom CSS-u te stranice. Vidi [Diverziti prijam](RECEIVE_DIVERSITY.md)

#### 4d. Prepoznavanje načina rada (`modeId.js`, `modePriors.js`)
- Odgovara na pitanje „što slušam?". Čita isti sirovi PCM odvod kao i dekoderi te rangira vjerojatne načine rada, kako bi operator odabrao pravi dekoder umjesto da isproba svih deset. Nikada ne dekodira: mjeri fizikalna svojstva signala i boduje ih prema tablici poznatih načina
- Zauzeta širina je povezana širina na −15 dB oko vrha, namjerno ne vrijednost od 99 % snage: klikovi manipulacije ostavljaju duge repove na integralu snage i činili su da svaki uski način izgleda višestruko preširok. Brzina simbola dolazi iz **trenutne frekvencije**, a ne iz energija tonova, jer nijedno vrijeme integracije ne razlučuje istodobno pomak od 170 Hz i simbol od 100 Bd. Brzina manipulacije dolazi iz on/off ovojnice i ujedno služi kao očitanje brzine CW-a
- `modePriors.js` dodaje jedini trag koji zvuk ne može nositi: gdje ste ugođeni. Signal 100 Bd / 170 Hz na 518 kHz je NAVTEX; isti signal na 14,070 MHz nije. Samo preteže ono što je signal već podupirao i nikada ne izmišlja kandidata
- FT8, JS8 i FT2 namjerno se prijavljuju kao jedna skupina: ne razdvajaju se samo po širini i razmaku tonova, a tvrditi suprotno bilo bi samouvjereno pogrešan odgovor
- Ispod otprilike 10 dB SNR-a šuti umjesto da nagađa
- Radi u vlastitom Web Workeru (`modeId.worker.js` + `modeIdWorkerProxy.js`), po istom obrascu engine/worker/proxy kao i dekoderi iznad; rezultat je oznaka u `lib/ModeIdChip.svelte`

#### 4e. Odbijene veze (`refused.js`, `clientVersion.js`)

- `refused.js` je zajednički rječnik za vezu koju poslužitelj odbija: kôd zatvaranja **4003** (iznad ograničenja po adresi, ili je stranica starija od `[server] min_client_version`) i **4001** (sysopovo izbacivanje). Oba su konačna. `audio.js`, `waterfall.js` i `events.js` svi uvoze `isRefusal()` odande, jer sva tri otvaraju vezu koja može biti odbijena i sva tri tada moraju razriješiti svoje inicijalizacijsko obećanje — inače stranica zauvijek čeka vezu koja nikad neće doći
- Ništa ne pokušava ponovno. Pala `/audio` veza namjerno završava sesiju: `/waterfall` i `/events` nikad se nisu vraćali s ponovnim spajanjem, pa je ponovljena sesija bila živi zvuk na zamrznutom slapu, a pred ograničenjem brzine svaki bi pokušaj produljio upravo ono odbijanje koje je htio zaobići. Stolna stranica objašnjava odbijanje koje se dogodi pri učitavanju i jednostavno stane kad se dogodi usred sesije; `/mobile` prikazuje jedan redak koji slušatelju kaže da osvježi
- `clientVersion.js` sadrži jedan jedini cijeli broj, `CLIENT_VERSION`, koji stranica dodaje svojoj zvučnoj vezi kao `/audio?v=N`. Poslužitelj odbija sve ispod `[server] min_client_version`, i tako stanica prisiljava kartice koje još rade na starijoj inačici da se osvježe — jedina poluga koja postoji, jer poslužitelj ne doseže JavaScript koji već radi u pregledniku. Povećajte ga kad promjenu u frontendu otvorene kartice više ne smiju ignorirati
- Potpuna referenca: [Ograničenja veza](CONNECTION_LIMITS.md)

#### 4f. Odgovori u chatu (`lib/chatReply.js`)
- Odgovor je obična poruka u chatu koja počinje oznakom što imenuje poruku na koju odgovara, `[RE:<vremenska oznaka>|<ime>]`; poslužitelj je sprema i prosljeđuje kao svaki drugi redak i ne treba nikakvu promjenu
- `chatReply.js` stvara i čita tu oznaku te grupira odgovore ispod izvorne poruke, jednu razinu duboko. Koriste ga i `App.svelte` i `mobile/Mobile.svelte`, pa obje stranice jednako slažu chat
- Kad je izvorna poruka već ispala iz povijesti od 20 poruka na poslužitelju, odgovor ostaje ondje gdje je stigao i prikazuje samo ime i vrijeme na koje odgovara

#### 4g. Imena slušatelja i privatnost (`lib/identity.js`)
- Polje za ime pokraj **Open Additional Info** čuva ime ili pozivni znak u `localStorage` (`chatusername`) i šalje ga na `/audio` kao `{"cmd":"identity","name":…}`; `audio.js` ga ponovno šalje svaki put kad se otvori njegov socket. Poveznica na prijemnik na drugoj adresi nosi ga kao `?idname=`, koji se pročita jednom i ukloni iz adresne trake
- Poslužitelj ga čisti (`clean_listener_name` u `utils.cpp`): najviše 10 znakova i bez razmaka kao na WebSDR-u, barem jedno slovo ili znamenka; rezervirana imena chata i `anonymous1234` vrijede kao nikakvo ime. `/users` ga daje kao `name`; oznake waterfalla prikazuju ga, a iza njega grad
- Javni `/users`, `users.json` i `/logs/users_*.jsonl` koje čita `stats.html` ne sadrže IP adresu: kopija dnevnika umjesto nje nosi neprozirni kod `visitor` (hash s ključem, ključ u `logs/.visitor_salt`); datoteke na disku zadržavaju adrese. Administracijska ploča čita `/~~users`, na koji se odgovara samo loopback sugovorniku bez `X-Forwarded-For`
- Dekoder koji radi ide istim putem: `App.svelte` šalje `{"cmd":"decoder","name":"FT8"}` (prazno kad nijedan ne radi) pri svakoj promjeni, a `audio.js` ga ponovno šalje na novom socketu. Poslužitelj čuva kratku oznaku (slova, znamenke, razmak, `-+/`, najviše 12) i daje je kao `decoder` u `/users` i u svakom retku `users_*.jsonl`; promjena se bilježi kao preugađanje, pa je `stats.html` (Decoder Popularity) i stranica Visitors administracije mogu brojati
- Zabrane od 8/16/24 sata iz ploče čuvaju se u `admin_bans.json` (nikad se ne distribuira) i jednom u minuti ponovno šalju svakom prijemniku; `/~~unban` ukida jednu

#### 5. Upravljanje stanjem (`stores/`)
- Reaktivne pohrane podataka
- Zajedničko stanje aplikacije
- Rukovanje događajima

---

## Popisi frekvencija (`frequencylist/`)

Oznake frekvencija na slapu. `mymarkers.json` je popis koji prijamnik doista prikazuje; ostalo je sirovina koju `update-markers.sh` pretvara u njega, osvježena iz mrežnih rasporeda.
`README.md` u toj mapi objašnjava ažuriranje na svih sedam jezika.

```
frequencylist/
├── mymarkers.json            # oznake koje prijamnik prikazuje — ručno uređivane, preživljavaju ažuriranje
├── shortwavestations.json    # kratkovalne postaje, generira ih generate-current-shortwave.py
├── 0.TXT                     # globalni A26 HF raspored, raspakira ga i obrađuje update-markers.sh
├── a26allx2.zip              # izvorna arhiva koju preuzima update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # pomoćni popisi iz istog izvora (lokacije, jezici, administratori, antene)
├── generate-current-shortwave.py
├── update-eibi.sh            # dohvaća EiBi raspored za EiBi prozor, najviše jednom dnevno
├── generate-eibi.py          # pretvara ga u frontend/public/eibi.json i frontend/dist/eibi.json
├── update-markers.sh         # osvježava sve navedeno iz mrežnih rasporeda
└── README.md
```

EiBi prozor (gumb **EiBi**) koristi drugi, zaseban popis. `update-markers.sh` najprije pokreće `update-eibi.sh`, koji EiBi raspored (http://www.eibispace.de/dx/) provjerava najviše jednom dnevno i preuzima ga samo kad EiBi objavi novi, a na popis sljedeće sezone (ljeto A, zima B) prelazi sam; `generate-eibi.py` ga pretvara u `eibi.json` za stranicu i određuje način rada svake postaje. Pokrenite `./frequencylist/update-eibi.sh --force` za odmah. Neuspjelo preuzimanje nikad ne zaustavlja ažuriranje markera. `update.sh` ažurira obje skripte i prvo pita ako ste ih mijenjali. `update-markers.sh` također označava svaki HFCC unos koji piše u `markers.json` s `"source": "hfcc"`; **Hide HFCC markers** u EiBi prozoru skriva upravo te.

### Format (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

`mode` je način rada prijemnika (`USB`, `LSB`, `AM`, `FM`, `CW`, …) ili ime digitalnog načina rada — `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV`, `NAVTEX`, `FAX`, `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR`, `PSK31`, `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `OLIVIA`, `CONTESTIA`, `MFSK`, `MFSK16`, `MFSK32`, `MFSK64`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `FELDHELL`, `MT63`, `PACKET`, `APRS`, `RADEU`, `RADEL`, `RADE` ili `FREEDV` — i tada klik na oznaku pokreće taj dekoder ([pojedinosti](DECODERS.md#pokretanje-dekodera-s-oznake-frekvencije)).

---

## Konfiguracijske datoteke

### Konfiguracija poslužitelja (datoteke `.toml`)

Struktura konfiguracijskih datoteka:

```toml
[server]
# Web server settings
port = 9001
html_root = "frontend/dist/"
threads = 2
otherusers = 1
iq = true

[limits]
# Ograničenja po adresi — sva su zadano isključena ili na razumnoj vrijednosti,
# pa se postava bez njih ponaša kao i prije. Vidi CONNECTION_LIMITS.md.
per_ip = 3              # istodobni slušatelji s jedne adrese
per_ip_rate = 40        # nove veze u minuti s jedne adrese

[websdr]
# Online registration
register_online = true
name = "WebSDR Name"
antenna = "Antenna Type"
grid_locator = "AB12cd"
hostname = "domain.com"

[input]
# SDR input settings
sps = 2048000           # Sample rate
fft_size = 131072       # FFT size
frequency = 145000000   # Base frequency
signal = "iq"           # Signal type: "iq" or "real"
audio_sps = 12000       # Audio sample rate
audio_compression = "opus"  # "flac" or "opus"
accelerator = "opencl"  # "none", "cuda", "opencl"

[input.driver]
# Driver settings
name = "stdin"
format = "u8"           # Sample format

[input.defaults]
# User interface defaults
frequency = 145500000
modulation = "FM"
```

### Podaci o lokaciji (`site_information.json`)

```json
{
  "siteSysop": "Operator Callsign",
  "siteSysopEmailAddress": "email@example.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Hardware specs",
  "siteSoftware": "Software version",
  "siteReceiver": "SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional notes",
  "siteIP": "http://domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Sustav izgradnje

### Konfiguracija izgradnje u Mesonu

#### `meson.build` (korijen)

Definira:
- Metapodatke projekta
- Ovisnosti
- Opcije prevoditelja
- Popise izvornih datoteka
- Ciljeve izgradnje

#### `meson_options.txt`

Dostupne opcije:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Tok podataka

### Tok rada poslužitelja

```
1. SDR Hardware → rtl_sdr/hackrf_transfer/etc.
                ↓
2. Sample Stream → stdin → spectrumserver
                ↓
3. spectrumserver:
   - FFT calculation (waterfall)
   - Demodulation (audio)
   - Compression (FLAC/Opus)
                ↓
4. WebSocket → Browser Client
                ↓
5. Browser:
   - Render waterfall
   - Decode and play audio
   - Display controls
```

### Tok korisničke interakcije

```
1. User clicks on waterfall
                ↓
2. JavaScript sends frequency change request
                ↓
3. WebSocket → spectrumserver
                ↓
4. spectrumserver:
   - Updates demodulator frequency
   - Sends new audio stream
                ↓
5. Browser receives and plays new audio
```

---

## Vodič za izmjenu datoteka

### Kada mijenjate kod pozadinskog dijela (`src/**`):

```bash
./recompile.sh --backend
```

### Kada mijenjate kod sučelja (`frontend/src/**`):

```bash
./recompile.sh --frontend
```

### Kada mijenjate konfiguraciju (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Kada mijenjate oznake (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Uobičajene radnje s datotekama

### Prilagodba sučelja

1. Izmijenite izvorni kod: `nano frontend/src/App.svelte`
2. Ponovno izgradite: `./recompile.sh --frontend`
3. Ponovno pokrenite poslužitelj: `./stop-websdr.sh && ./start-rtl.sh`

### Dodavanje vlastitih oznaka

1. Uredite datoteku oznaka: `nano markers.json`
2. Format:
   ```json
   {
     "markers": [
       {
         "frequency": 145500000,
         "label": "2m Calling",
         "mode": "FM"
       }
     ]
   }
   ```
3. Ponovno učitajte preglednik (ponovno pokretanje poslužitelja nije potrebno)

---

## Upravljanje verzijama

### Objava nove verzije (održavatelj)

Prije prijenosa datoteka osvježite popis otisaka, kako bi `update.sh` na svakoj stanici prepoznao verzije koje ima kao objavljene:

```bash
# 1. kopirajte promijenjene datoteke u kopiju za prijenos, zatim:
bash update.sh --make-known /path/to/the/upload/copy
# 2. napravite commit za update-known.txt i kopirajte ga također u kopiju za prijenos
```

Popis samo raste: unosi ranijih verzija se zadržavaju, pa jednom objavljena javna kopija ostaje prepoznatljiva u svakoj kasnijoj verziji.

---

Za upute o postavljanju pogledajte [INSTALLATION.md](INSTALLATION.md). Za informacije o korištenju pogledajte [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
