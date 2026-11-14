# Digitalni glas RADE v1 za PhantomSDR-Plus

> **Port 9012.** Na stanici postavljenoj s `install.sh` sidecar sluša samo unutar računala, na `PORT_RADE` (9012), a stranica ga doseže kao `/rade` na javnom portu 9000 preko `proxy.py`, pa na routeru ne treba ništa otvarati.

**RADE** (Radio AutoencoDEr) vodeći je FreeDV-ov način rada digitalnog glasa na kratkim valovima. Koristi hibrid strojnog učenja i DSP-a (neuronski vokoder FARGAN) i pruža govor visoke kvalitete na KV-u pri omjerima signal/šum do −2 dB, u tek 1500 Hz RF širine pojasa — uže od SSB signala.

Ovaj dokument obrađuje potpunu integraciju prijama RADE v1 u PhantomSDR-Plus, izvedenu kao sidecar proces u Pythonu (`rade_helper.py`) koji povezuje preglednik s lancem dekodiranja `radae_rxe.py` + `lpcnet_demo`.

Dekodira i **RADE V2 (beta)**, novi valni oblik FreeDV-a 3.0, gumbom **RADE-v2U** — pogledajte [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

## Instalacija — kraći put

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

To je cijela instalacija. Skripta instalira sistemske pakete preko upravitelja paketa koji stroj ima (apt, pacman, dnf ili zypper), za ono što distribucija ne isporučuje poseže za pipom, nadograđuje `websockets` ako je verzija iz distribucije starija od 11.0 koju sidecar treba, klonira i gradi radae, provjerava težine modela, ponovno gradi frontend i pokreće sidecar. Na Ubuntuu 22.04 predaje posao skripti `install_rade_ubuntu22.sh`. `./install.sh` nudi da je pokrene u sklopu normalne instalacije, pa je na svježem stroju RADE već tu. Gradi i FreeDV-ov rade_c za RADE V2 (beta); ako taj korak ne uspije, RADE V1 se svejedno instalira.

**Ovaj dokument objašnjava kako RADE radi i kako se koristi.** Instalaciju uvijek obavlja `./install_rade.sh` (ili `./install.sh`, koji je nudi).

---

## Sadržaj

1. [Instalacija — kraći put](#instalacija--kraći-put)
2. [Kako to radi](#kako-to-radi)
3. [Pregled arhitekture](#pregled-arhitekture)
4. [RADEL naspram RADEU](#radel-naspram-radeu)
   - [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2)
5. [Preduvjeti](#preduvjeti)
6. [Upravljanje sidecarom](#upravljanje-sidecarom)
7. [Vrata 9012](#vrata-9012)
8. [Korištenje RADE-a u pregledniku](#korištenje-rade-a-u-pregledniku)
9. [Provjera i otklanjanje pogrešaka](#provjera-i-otklanjanje-pogrešaka)
10. [Varijable okruženja](#varijable-okruženja)
11. [Rješavanje problema](#rješavanje-problema)
12. [Ažuriranje RADE v1](#ažuriranje-rade-v1)

---

## Kako to radi

RADE v1 ne može raditi u pregledniku — traži PyTorch i neuronski vokoder FARGAN, koji su preveliki za WASM. Rješenje je sidecar proces u Pythonu (`rade_helper.py`) koji radi na istom poslužitelju kao PhantomSDR-Plus.

> **Važno:** `freedv_rx` iz repozitorija codec2 **ne** podržava RADEV1. Lanac dekodiranja RADE u cijelosti se nalazi u zasebnom repozitoriju `radae` Davida Rowea (VK5DGR). Nemojte pokušavati koristiti codec2-ov `freedv_rx` za RADE.

Kada u pregledniku odaberete RADE:

1. Sučelje postavlja osnovnu demodulaciju na USB ili LSB — poslužitelj u C++-u demodulira SSB signal na uobičajen način.
2. Sirovi demodulirani PCM preuzima se u `audio.js` **prije** bilo kakvog utišavanja ili squelch vrata — `radae_rxe.py` treba neprekidan ulaz da bi održao sinkronizaciju okvira.
3. Svaki blok PCM-a dopunjava se nulama iz realnog f32 u kompleksni f32 (realni + 0.0 imaginarni) — upravo to `radae_rxe.py` očekuje na standardnom ulazu.
4. Sidecar te uzorke prosljeđuje u `radae_rxe.py`, koji ispisuje značajke vokodera.
5. `lpcnet_demo -fargan-synthesis` pretvara značajke u govor s16 pri 16000 Hz.
6. Sidecar pretvara s16 → f32 i vraća to pregledniku kao binarne WebSocket okvire.
7. Preglednik reproducira dekodirani govor putem Web Audio API-ja pri 16000 Hz.

Poslužitelj u C++-u (`spectrumserver.cpp`) uopće se ne mijenja.

---

## Pregled arhitekture

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:9000/rade                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 9012)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL naspram RADEU

RADE v1 uvijek se prenosi putem SSB-a. Prema konvenciji:

| Način rada | Bočni pojas | Koristiti na pojasevima                  |
|------------|-------------|------------------------------------------|
| RADEL      | LSB         | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU      | USB         | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## RADE V2 (beta) — RADE2

**RADE V2** je novi valni oblik FreeDV-a 3.0: širok oko 800 Hz umjesto 1500 Hz, bez pilotskih simbola i oko 3 dB osjetljiviji pri niskom SNR-u. **U FreeDV-u je još u beta fazi** — šalju ga samo postaje koje testiraju FreeDV 3.0, a signal se do izlaska još može promijeniti. PhantomSDR-Plus ga dekodira uz RADE V1:

| Gumb | Verzija | Bočni pojas | Filtar |
|---|---|---|---|
| **RADE-v2U** (RADE2) | RADE V2 (beta) | USB na svakom pojasu | 1040–1930 Hz |
| **RADE-v1L** / **RADE-v1U** (RADEL / RADEU) | RADE V1 | LSB / USB | 700–2200 Hz |

V2 se dekodira na poslužitelju FreeDV-ovim prijenosom u C, **rade_c** (`radae_rx --v2` i njegov vlastiti `lpcnet_demo`), izgrađenim u vlastitoj mapi `~/rade_c`, tako da se V1 instalacija u `~/radae` nikada ne dira. `./install_rade.sh` ga preuzima i gradi (korak „rade_c (RADE V2, beta)”); ako taj korak ne uspije, samo upozorava, a RADE V1 se svejedno instalira. `rade_helper.py` koristi rade_c od sljedeće RADE2 veze — ponovno pokretanje nije potrebno — a bez njega RADE2 slušatelju javlja „RADE V2 is not installed on this station yet”. Dekodiranje V2 stoji oko 1 % jedne CPU jezgre po slušatelju (V1: oko 70–80 %).

**U eteru**

- Ugodite se do oko **±30 Hz** od frekvencije postaje. Dalje od toga V2 i dalje pokazuje „Synced”, ali je govor nerazumljiv.
- Svako javljanje počinje **2–3 s kasnije**: dok se V2 zaključava, zadržava signal i zatim reproducira početak javljanja.
- Ispod oko **−2 dB SNR-a** zvuk V2 se utišava, a ploča piše „Searching for signal…” — osim ako zadnje 2 sekunde izgledaju kao pravi V2 (dekoder većinu vremena vidi svoj signal, a njegova procjena frekvencije ostaje mirna); tada svira do oko **−6 dB**. Na zauzetim LSB fonijskim frekvencijama slušanima u USB-u (40 m) V2 se može zaključati na obične glasove i puštati nerazumljiv zvuk; oni nikad ne izgledaju mirno pa ostaju utišani. `RADE_V2_MIN_SNR` i `RADE_V2_WEAK_SNR` određuju oba praga.
- Između javljanja ploča se vraća na „Searching for signal…”.

**Kad izađe FreeDV 3.0**, ponovno pokrenite `./install_rade.sh` — ili `git pull` u `~/rade_c` i `cmake --build build` — i nove RADE2 veze tada koriste novu verziju.

---

## Preduvjeti

| Zahtjev | Verzija | Napomene |
|---|---|---|
| PhantomSDR-Plus | bilo koja | s Vite/Svelte sučeljem |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | testirano |
| Python | 3.8+ | za `rade_helper.py` i `radae_rxe.py` |
| repozitorij radae | najnoviji master | daje `radae_rxe.py` i `lpcnet_demo` |
| cmake | 3.10+ | za izgradnju `lpcnet_demo` iz radae |
| PyTorch | 2.0+ | traži ga `radae_rxe.py` |
| Node.js | 16+ | za `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — podržane sve verzije |
| matplotlib | bilo koja | traži ga `radae_rxe.py` pri uvozu |
| numpy | 1.23+ | obavezan; omogućuje i ponovno uzorkovanje |
| scipy | bilo koja | neobavezno, omogućuje precizno ponovno uzorkovanje |

---

## Upravljanje sidecarom

**Obično vam ne treba zasebna upravljačka skripta za RADE.** Pokretači prijamnika (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) sami pokreću sidecar čim se potvrdi da poslužitelj radi, ponovno ga pokreću ako se ugasi i javljaju njegovo stanje u završnom sažetku — `✔ RADE sidecar running`, ili napomena `·` koja objašnjava zašto nije aktiviran (nije instaliran, `RADE_ENABLED=0` ili nema `python3`). `./stop-websdr.sh` zaustavlja ga zajedno s poslužiteljem. Za rad poslužitelja bez RADE-a pokrenite ga s `RADE_ENABLED=0`.

`rade.sh` i dalje postoji za samostalnu upotrebu — pokretanje sidecara bez PhantomSDR-Plus pokretača ili njegovo zasebno testiranje:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Aktivnost sidecara bilježi se u `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Nemojte miješati to dvoje dok poslužitelj radi.** Ako je čuvar nekog pokretača aktivan, vratit će sidecar u roku od otprilike pet sekundi, pa će izgledati kao da `./rade.sh stop` nije uspio. Da biste zaustavili RADE dok poslužitelj radi, pokrenite poslužitelj s `RADE_ENABLED=0` ili zaustavite sve s `./stop-websdr.sh`.

> Ako `rade.sh` pokrećete samostalno, **uvijek koristite `./rade.sh stop`** — sam `pkill -f rade_helper.py` ne pobjeđuje njegova čuvara, koji proces ponovno pokreće u roku od 3 sekunde.

---

## Vrata 9012

Sidecar sluša na TCP portu **9012**, samo unutar računala. Preglednik ga doseže preko `proxy.py` kao `/rade` na javnom portu 9000, pa na routeru ni u vatrozidu ne treba otvarati nijedan drugi port.

```bash
# Is the sidecar listening?
ss -tlnp | grep 9012
```

---

## Korištenje RADE-a u pregledniku

1. Otvorite svoje web-sučelje PhantomSDR-Plusa
2. Aktivne postaje potražite na **[qso.freedv.org](https://qso.freedv.org)**
3. Ugodite se na prikazanu frekvenciju postaje
4. U **Decoder Options** odaberite:
   - **RADE v2 · RADE2** za RADE V2 (beta), USB na svakom pojasu
   - **RADE v1 — RADEL (LSB)** za 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** za 20 m / 17 m / 15 m / 12 m / 10 m
5. Kliknite **Decoder: ON**

### Gumbi RADE-v1L / RADE-v1U (jedan pritisak)

Korake 4 i 5 može zamijeniti jedan pritisak. Par gumba **RADE-v1L** / **RADE-v1U** dostupan je na tri mjesta:

- uz naslov **Modes** na glavnoj ploči;
- u skočnom prozoru **Modes**;
- u skočnom prozoru **Bands**.

Pritisak odabire dekoder, uključuje dekoder (ON), zatvara skočni prozor u kojem ste ga pritisnuli i dovodi RADE ploču na zaslon. Gumb je plav dok RADE radi. **Ponovni pritisak na isti gumb isključuje RADE** — ploča se zatvara, a način rada i propusni pojas vraćaju se kako je opisano niže. Gumbi, padajući izbornik **Decoder Options** i gumb ON/OFF dijele isto stanje.

Gumb **RADE-v2U** stoji ispred RADE-v1L i RADE-v1U na ista tri mjesta (i gumb RADE2 na `/mobile`); pokreće RADE V2 (beta) u USB-u — pogledajte [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

### Stanja pokazatelja na ploči

| Pokazatelj | Značenje |
|---|---|
| 🔴 Crveno — „Connecting to sidecar…" | Port 9012 nedostupan ili sidecar ne radi |
| 🟡 Žuto — „Searching for signal…" | Sidecar spojen, RADE okvir još nije otkriven |
| 🟢 Zeleno — „Synced · SNR x.x dB" | Dekodiranje — govor se reproducira |

### Kada isključite dekoder

Način rada i propusni pojas automatski se vraćaju na ispravnu zadanu vrijednost za trenutačnu frekvenciju, kako je određeno u `bands-config.js` — jednako kao kod FAX-a, NAVTEX-a i FSK-a.

---

## Provjera i otklanjanje pogrešaka

### Radi li sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 9012
```

### Praćenje aktivnosti uživo

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Kada se preglednik spoji:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Konzola preglednika (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:9000/rade
```
Dobro — WebSocket je otvoren. Vrijednost u Hz odgovara `audioOutputSps` vašeg poslužitelja (obično 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Sidecar nije dostupan — provjerite radi li (`ss -tlnp | grep 9012`) i radi li `proxy.py`.

---

## Varijable okruženja

| Varijabla | Zadano | Opis |
|---|---|---|
| `RADE_HELPER_PORT` | `9012` | TCP port na kojem sluša sidecar |
| `RADE_HELPER_HOST` | `0.0.0.0` | Adresa vezanja (`127.0.0.1` iza proxyja) |
| `RADAE_DIR` | `~/radae` | Korijen repozitorija radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Težine modela |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binarna datoteka lpcnet_demo |
| `RADE_AUXDATA` | `1` | Postavite na `0` da se `radae_rxe.py` proslijedi `--noauxdata` |
| `RADE_TORCH_THREADS` | `1` | PyTorch/OpenBLAS dretve po instanci `radae_rxe.py` — ograničava potrošnju CPU-a |
| `RADE_PIN_CORES` | `1` | Veže svaki lanac dekodiranja uz vlastiti skup jezgri; `0` isključuje vezanje |
| `RADE_CORES_PER_CLIENT` | `2` | Jezgri dodijeljenih po klijentu kada je vezanje uključeno |
| `RADE_C_DIR` | `~/rade_c` | Korijen rade_c (RADE V2) |
| `RADE_C_RX` | `RADE_C_DIR/build/src/radae_rx` | Prijamni program rade_c |
| `RADE_C_LPCNET` | `RADE_C_DIR/build/src/lpcnet_demo` | Vlastiti lpcnet_demo rade_c-a |
| `RADE_V2_MIN_SNR` | `-2` | Ispod ovog SNR-a (dB) zvuk V2 se utišava |
| `RADE_V2_WEAK_SNR` | `-6` | Do ovog SNR-a (dB) V2 i dalje svira dok signal izgleda kao pravi V2; postavite ga na `RADE_V2_MIN_SNR` ili više da to isključite |
| `RADE_V2_TARGET_DB` | `-16` | Razina prema kojoj se dovodi govor V2, u dBFS (`0` = isključeno) |

---

## Rješavanje problema

### Crvena traka — „Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &
```

---

### `lpcnet_demo: No such file or directory`

Izgradnja radae nije dovršena. Izgradite ponovno:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Žuti pokazatelj — „Searching for signal" — nikad se ne sinkronizira

- Potvrdite ispravan bočni pojas: RADEL za ≤ 10 MHz, RADEU za > 10 MHz
- Provjerite na [qso.freedv.org](https://qso.freedv.org) odašilje li neka postaja u tom trenutku
- RADE v1 koristi 30 nosilaca u 1500 Hz širine — u slapu se pojavljuje kao zbijena skupina
- Predvidite do 1,5 sekunde za uspostavu

---

### Više istodobnih korisnika

Svaka veza preglednika pokreće vlastiti neovisni par `radae_rxe.py` + `lpcnet_demo`, pa se svaki korisnik može slobodno ugoditi na drugu frekvenciju.

Prema zadanom, `radae_rxe.py` koristi **sve dostupne CPU jezgre** za matrične operacije PyTorcha, uzrokujući potrošnju CPU-a od ~900 % po instanci. `rade_helper.py` to ograničava s dvije optimizacije:

1. `OMP_NUM_THREADS=1` (i odgovarajuće MKL/OpenBLAS varijable) — ograničava PyTorch na 1 dretvu
2. Funkcije pretvorbe zvuka vektorizirane numpyjem — uklanjaju trošak Python petlji

Rezultat: svaka instanca troši otprilike **8–10 %** jedne jezgre, dovoljno za dekodiranje RADE-a u stvarnom vremenu. Ako čujete ispade zvuka, povećajte na 2 dretve:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Istodobnih korisnika RADE-a | Približno opterećenje CPU-a |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Na i5-12450H (12 dretvi), gdje spectrumserver troši ~42 %, a rx888_stream ~11 %, imate otprilike **1000 % rezerve** — dovoljno za **20 i više istodobnih** korisnika RADE-a prije nego što CPU postane problem.

---

## Ažuriranje RADE v1

**Za ažuriranje RADE-a ponovno pokrenite `./install_rade.sh`.** Dohvaća najnovije radae i rade_c, ponovno ih gradi i ponovno pokreće sidecar; sam prijemnik ne treba ponovno pokretati.

---

*Razvijeno i testirano na PhantomSDR-Plusu (fork sv1btl/PhantomSDR-Plus) s RX-888 MK2 na Ubuntuu 24.04. Poslužitelj u C++-u nije mijenjan.*

*RADE razvijaju David Rowe VK5DGR i FreeDV tim.* *Vidi [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Potpuna deinstalacija i čista ponovna instalacija

Evo potpunog uklanjanja prije ponovnog pokretanja install_rade.sh:
1. Zaustavite sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Uklonite repozitorij radae i izgradnju rm -rf ~/radae
3. Uklonite torch (instaliran u korisničkom direktoriju) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Uklonite Python pakete iz apta (neobavezno — preskočite ako ih koristi nešto drugo) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Provjerite je li sve uklonjeno python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Čista instalacija chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
