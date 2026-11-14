# Više prijemnika — Priručnik za sysopa

> **Brojevi portova.** Primjeri niže koriste portove koje predlaže `install.sh`: `proxy.py` na javnom portu 9000, glavni prijemnik na 9001, daljnji prijemnici na 9002, 9003 i tako dalje. Pitanja o stanici drže `receivers.toml` usklađenim: kad se promijeni port ili adresa, `configure-station.sh` premješta glavni prijemnik na njegov novi port i zapisuje svaku poveznicu kao `<adresa>/?rx=<id>` — poveznica bez `?rx=` zadržala bi posjetitelja na prijemniku koji pamti kolačić `rx`. Nikad ne dajte prijemniku sam javni port: proxy bi prosljeđivao sam sebi, pa to sada odbija.

**Dva ili više prijemnika na jednom računalu, s izbornikom prijemnika na stranici.**

Od v5.0.0 jedno PhantomSDR-Plus računalo može istodobno pokretati više prijemnika — na primjer RX-888 za kratki val i RTL-SDR za 2 m — a slušatelji prelaze s jednog na drugi gumbima u zaglavlju stranice, kao što OpenWebRX nudi svoje profile. Svaki prijemnik zadržava vlastiti vodopad, chat, oznake, popis slušatelja i podatke o stanici; nitko na jednom prijemniku nikada ne smeta nikome na drugom.

> **Žurite?** Stanici s jednim prijemnikom ništa od ovoga ne treba i ne vidi nikakvu promjenu. Za drugi prijemnik: napravite `instances/<ime>/` s vlastitim `config.toml`, pokrenite ga s `INSTANCE=<ime> ./start-<radio>.sh`, upišite oba prijemnika u `receivers.toml` i ponovno pokrenite proxy. Primjer u [odjeljku 3](#3-dodavanje-drugog-prijemnika) prolazi to redak po redak.

> **Najjednostavnije:** pokrenite `./add-receiver.sh` (instalacijske skripte nude ga na kraju). Pita koji prijemnik i što treba pokrivati, instalira njegov upravljački program, zapisuje sve što je opisano u [odjeljku 3](#3-dodavanje-drugog-prijemnika) i [odjeljku 4](#4-receiverstoml) te nudi pokretanje prijemnika i ponovno pokretanje proxyja. Ostatak priručnika objašnjava što radi, za slučaj da nešto želite promijeniti ručno.

> **Iz administratorske ploče:** stranica **Receivers** prikazuje svaki prijemnik s onim što pokriva. **✎ CHANGE SETTINGS** mijenja frekvenciju i širinu pojasa dodatnog prijemnika (i ponovno pokreće samo njega), a na svakom prijemniku početnu frekvenciju, način rada, pojačanje i ime gumba — dodatni prijemnik drži pojačanje u `instances/<id>/instance.env`, glavni u `main.env`, koji svaki start-*.sh čita posljednjeg. **■ STOP** / **▶ START** zaustavlja ili pokreće jedan prijemnik dok ostali rade dalje, a **🗑 DELETE** uklanja dodatni prijemnik (zaustavlja ga, vadi ga iz `receivers.toml`, premješta njegovu mapu `instances/<id>/` u `admin-backups/`). Također priprema novi prijemnik: sprema vaše odgovore i daje `./add-receiver.sh --answers instances/.add-rx.env` za pokretanje u terminalu. Vidi [Administratorska ploča](ADMIN_PANEL_SETUP.md).

---

## Sadržaj

1. [Kako radi](#1-kako-radi)
2. [Dva načina objave prijemnika](#2-dva-načina-objave-prijemnika)
3. [Dodavanje drugog prijemnika](#3-dodavanje-drugog-prijemnika)
4. [receivers.toml](#4-receiverstoml)
5. [Pokretanje i zaustavljanje](#5-pokretanje-i-zaustavljanje)
6. [Što vide slušatelji](#6-što-vide-slušatelji)
7. [S-metar iznad 30 MHz](#7-s-metar-iznad-30-mhz)
8. [Sigurnost](#8-sigurnost)
9. [Koliko prijemnika stane](#9-koliko-prijemnika-stane)
10. [Zamke koje treba znati](#10-zamke-koje-treba-znati)

---

## 1. Kako radi

Svaki prijemnik je potpun, zaseban spectrumserver, s vlastitim SDR-om, vlastitom konfiguracijom i vlastitim unutarnjim portom. Nikada ne dijele uzorke, postavke ni slušatelje. Povezuje ih `proxy.py`, obrnuti proxy koji već poslužuje administratorsku ploču: čita `receivers.toml` i šalje svaki zahtjev jednom prijemniku.

```
                         ┌──► :9001  spectrumserver  RX-888   (KV, glavni prijemnik)
slušatelji ──► proxy.py ─┤
                         └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, instanca "vhf")
```

Proxy odlučuje prema ovome, ovim redom:

1. `?rx=<id>` u adresi — `http://vas.host:9000/?rx=vhf`. Stranica ga dodaje svakom socketu, upitu i poveznici koju otvara, pa kartica ostaje na svom prijemniku.
2. Kolačić `rx`, koji proxy postavlja kad god zahtjev nosi valjani `?rx=`.
3. Zaglavlje Host, ako neki prijemnik navodi to ime pod `hostnames`.
4. Inače zadani prijemnik.

**Glavni prijemnik** je onaj koji se pokreće na uobičajen način (`./start-rx888mk2.sh`). Svaki drugi prijemnik je **imenovana instanca**: pokreće se s `INSTANCE=<ime>`, konfigurira u `instances/<ime>/` i ima vlastiti zapisnik (`logwebsdr-<ime>.txt`), zapisnik poslužitelja, zaključavanje watchdoga i FIFO. Procesi se razlikuju po oznaci `PHANTOMSDR_INSTANCE` u njihovom okruženju, a ne po imenu, pa dva prijemnika mogu pokretati potpuno isti program — dva `rtl_sdr`, ili `rx_sdr` za RSP1A i Airspy — a ponovno pokretanje jednoga nikada ne dira drugi.

---

## 2. Dva načina objave prijemnika

**A — glavni prijemnik zadržava svoj port.** Glavni prijemnik ostaje točno gdje je bio (npr. `:9001`), njegovi slušatelji ništa ne primjećuju, a do ostalih prijemnika dolazi se preko porta proxyja (`proxy_port` u `admin_config.json`, npr. `:9000`) s `?rx=`. Ništa se ne seli i ništa ne izlazi iz etera; zauzvrat postoje dva javna porta.

```
KV:  http://vas.host:9001/
2 m: http://vas.host:9000/?rx=vhf
```

**B — jedan javni port za sve.** Proxy preuzima javni port, a glavni prijemnik seli se na unutarnji. Postavite `[front] port` u `receivers.toml`, premjestite `[server] port` glavnog prijemnika i u njemu postavite `host = "127.0.0.1"`, u `public_port` datoteke `admin_config.json` upišite novi unutarnji port i dodajte `public_port = <javni port>` pod `[websdr]`, kako bi imenik i dalje objavljivao ispravan. Tada je sve iza jednog porta; cijena je kratak prekid tijekom selidbe.

```
KV:  http://vas.host:9000/
2 m: http://vas.host:9000/?rx=vhf
```

Izbornik prijemnika radi jednako u oba slučaja. Raspored A je sigurniji početak; B može doći kasnije bez ikakve promjene na drugom prijemniku.

---

## 3. Dodavanje drugog prijemnika

**`add-receiver.sh` dodaje prijemnik** — pokrenite ga i odgovorite na njegova pitanja; instalira upravljački program (`setup-rtlsdr.sh` za RTL-SDR, odgovarajući `setup-*.sh` za ostale), bira slobodan interni port, piše mapu instance, njezinu konfiguraciju i njezin redak u `receivers.toml` te imenuje prijemnik prema onome što pokriva. Stranica **Receivers** administratorske ploče radi isto s ➕ ADD NEW RECEIVER.

---

## 4. receivers.toml

Kopirajte `receivers.toml.example` u `receivers.toml`. Bez te datoteke proxy poslužuje jedan prijemnik, kao i uvijek.

```toml
# [front]
# port = 9000        # samo raspored B: proxy sluša i na ovom javnom portu

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 9001
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://vas.host:9000/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://vas.host:9000/?rx=vhf"
```

| Ključ | Značenje |
|---|---|
| `id` | Kratko ime za `?rx=`; slova, znamenke, `-` i `_` |
| `name` | Tekst na gumbu prijemnika |
| `port` | `[server] port` njegovog spectrumservera |
| `host` | Neobavezno; gdje radi taj spectrumserver (zadano `127.0.0.1`) |
| `default` | Prijemnik za zahtjeve koji ne navode nijedan; najviše jedan |
| `launcher` | Njegov `start-*.sh`, za `start-all.sh`; izostavite za prijemnik koji ovo računalo ne pokreće |
| `instance` | Ime njegove instance; izostavite za glavni prijemnik |
| `url` | Kamo njegov gumb šalje slušatelja; bez njega `/?rx=<id>` na proxyju |
| `hostnames` | Neobavezna DNS imena koja vode izravno na ovaj prijemnik |

Proxy popis poslužuje i kao `/receivers.json` (id-ovi, imena i poveznice — nikada unutarnji portovi); to čita izbornik prijemnika.

---

## 5. Pokretanje i zaustavljanje

| Naredba | Radi |
|---|---|
| `./start-rx888mk2.sh` | Pokreće ili ponovno pokreće glavni prijemnik |
| `INSTANCE=vhf ./start-rtl.sh` | Pokreće ili ponovno pokreće prijemnik `vhf` |
| `./start-all.sh` | Pokreće svaki prijemnik iz `receivers.toml` koji ima `launcher` |
| `./stop-websdr.sh vhf` | Zaustavlja samo `vhf` |
| `./stop-websdr.sh main` | Zaustavlja samo glavni prijemnik |
| `./stop-websdr.sh` | Zaustavlja sve prijemnike, kao i uvijek |

**Dok je prijemnik zaustavljen**, njegov gumb nestaje iz izbornika — proxy navodi samo prijemnike koji odgovaraju, a otvorene stranice ponovno čitaju popis svakih 15 sekundi — i vraća se kad se prijemnik ponovno pokrene; kad radi samo jedan prijemnik, redak *Receivers:* potpuno nestaje. Zaustavljeni prijemnik vraća se sam svaki put kad se pokreću svi prijemnici: `./start-all.sh`, **Restart** administratorske ploče i ponovno pokretanje iz thermal guarda pokreću sve što piše u `receivers.toml`. Da jedan ostane trajno ugašen, obrišite ga na stranici **Receivers** administratorske ploče, ili ručno uklonite (ili zakomentirajte) njegov blok `[[receiver]]` — proxy ponovno čita `receivers.toml` kad god se promijeni, pa preimenovanje, uklanjanje ili novi blok djeluju bez ponovnog pokretanja proxyja (samo prvi `receivers.toml` na stanici, ili promjena `[front] port`, još ga traži).

U administratorskoj ploči postavite **Default start script** na `start-all.sh`. Njezin Stop već zaustavlja sve prijemnike, a Restart i toplinska zaštita koriste skriptu za pokretanje; sa `start-all.sh` vraćaju sve prijemnike umjesto samo glavnoga.

Pomoćni program RADE pripada samo glavnom prijemniku. Imenovana instanca ga nikada ne pokreće niti zaustavlja.

---

## 6. Što vide slušatelji

**Izbornik prijemnika.** Na stanici s više prijemnika zaglavlje stranice dobiva vlastiti redak, *Receivers:*, s jednim gumbom po prijemniku; trenutni je prikazan žuto. Stranica /mobile ima iste gumbe kao drugi red u gornjoj traci, a oni otvaraju stranicu /mobile drugog prijemnika.

**Trake Show All.** Kućica *Show All* iza tipki prijemnika prikazuje svaki drugi prijemnik ispod slušateljeva vodopada kao živu traku. Klik na nju otvara taj prijemnik ugođen na kliknutu frekvenciju, a stranica koju je slušatelj napustio ponovno se otvara s prikazom s kojim ju je ostavio. Svaka je traka socket samo za vodopad prema drugom prijemniku (`/waterfall?rx=<id>`): ondje nije slušatelj — ne vide je ni broj korisnika ni ograničenje slušatelja po IP-u, `per_ip_sockets` je vidi — i stoji oko 10 KB/s uploada za svakog slušatelja koji označi kućicu. Zadano je isključena i na poslužitelju ne traži ništa. Kad drugi prijemnik pokriva više od jednog pojasa, zaglavlje trake nudi njegove pojaseve u padajućem popisu (iste kao njegovi gumbi pojasa); pojas uokviruje traku kao njegov gumb pojasa, a klik tada otvara prijemnik uokviren na taj pojas. Izbor se pamti po prijemniku u pregledniku slušatelja.

**Promjena po frekvenciji.** Frekvencija izvan pokrivanja ovog prijemnika koju pokriva drugi prijemnik — upisana, iz poveznice, oznake ili spota — otvara prijemnik koji je pokriva. Stranica doznaje raspon svakog prijemnika tako da na trenutak otvori njegov `/waterfall` socket, i pamti ga jedan dan.

**Korisnici i statistika po prijemniku.** Prozori *Connected Users* i *User Statistics* prikazuju prijemnik na čijoj se stranici nalaze, čak i kad je više prijemnika otvoreno jedan pokraj drugoga u istom pregledniku. Statistika dolazi iz vlastitih zapisa tog prijemnika — `logs/` za glavni prijemnik, `instances/<id>/logs/` za ostale.

**Vlastiti podaci svakog prijemnika.** Stranica otvorena na drugom prijemniku prije pokretanja učitava `site_information.json` tog prijemnika, pa su gumbi opsega, početna frekvencija, popis slušatelja, podaci o stanici te poveznice Receiver i Antenna svi njegovi. Običan posjet glavnom prijemniku ne šalje nikakav dodatni zahtjev.

Ključevi u `site_information.json` za to:

| Ključ | Značenje |
|---|---|
| `siteReceiverId` | Prijemnik kojem ova stranica pripada (njegov `id`); izostavite na glavnom prijemniku |
| `siteReceiversList` | Odakle izbornik čita popis, npr. `http://vas.host:9000/receivers.json`; potrebno na prijemniku čija se stranica ne poslužuje preko proxyja |
| `siteReceiverURL` | Kamo vodi ime kod *Receiver* u *Open Additional Info* |
| `siteAntennaURL` | Kamo vodi ime kod *Antenna*; `""` prikazuje ime bez poveznice |

**Kad izbornik ostaje skriven.** Izbornik prikazuje samo popis koji navodi host pod kojim je stranica otvorena. Otvorena preko adrese lokalne mreže (`http://192.168.1.10:9000/`) ostaje skriven; otvorena kao `http://vas.host:9000/` pojavljuje se. To je namjerno: stanica koja je preuzela tuđi `site_information.json` bez uređivanja nikada ne prikazuje prijemnike te stanice kao svoje.

---

## 7. S-metar iznad 30 MHz

Standard IARU Regije 1 postavlja S9 na −73 dBm ispod 30 MHz i na **−93 dBm iznad**, sa šest dB po S-jedinici u oba slučaja. S-metri (analogna kazaljka, digitalna traka i traka na /mobile) prate ugođenu frekvenciju: iznad 30 MHz pokazuju VHF S-jedinice, ispod kao i prije. Vrijednosti u dBm i dBµV nikada se ne mijenjaju. Ako želite da instrumenti miruju na 0 dok je kanal prazan, kao na VHF/UHF primopredajniku, dodajte `"siteSMeterGateDb": 6` u `site_information.json` prijemnika (bez ponovne izgradnje): iznad **60 MHz** kazaljka i traka tada se dižu tek kad signal za toliko dB nadmaši šum vlastite okoline (najjača točka propusnog pojasa prema spektru ±100 kHz oko nje). **Zadano je isključeno** — kalibrirani instrument koji pokazuje stvarni šum opsega iskrenije je očitanje. Stranica /mobile, koja nema vodopad, procjenjuje šum iz same primljene razine.

Kalibrirajte dBm VHF prijemnika pomoću `analog_smeter_offset` (kazaljka i brojke) i `smeter_offset` (digitalna traka) pod `[input]` u njegovom `config.toml`, a zatim ponovno pokrenite taj prijemnik. Najprije postavite pojačanje: RTL-SDR javlja razine u odnosu na vlastiti puni opseg, pa svaka promjena pojačanja pomiče očitanja. Bez generatora signala, terminator od 50 Ω umjesto antene, u USB-u s filtrom od 2,7 kHz, treba pokazivati oko −136 dBm (toplinski šum u 2,7 kHz iznosi −139,7 dBm, plus faktor šuma sticka).

Za RTL-SDR, `add-receiver.sh` zapisuje početnu kalibraciju: fiksno pojačanje `-g 29.7` u `instance.env` (automatsko pojačanje tunera ne može se kalibrirati) te `analog_smeter_offset=-55` i `smeter_offset=-38`, izmjereno na RTL-SDR Blog V4 pri tom pojačanju sa signalom od −71 dBm (63 µV). Drugi stick istog modela obično odstupa tek nekoliko dB; provjerite ga poznatim signalom i ponovno kalibrirajte ako promijenite pojačanje.

---

## 8. Sigurnost

Vežite svaki prijemnik do kojeg se dolazi preko proxyja na `127.0.0.1` (`[server] host`), kako se njegov port ne bi mogao koristiti zaobilazeći proxy. Ograničenja po adresi iz [Ograničenja veza](CONNECTION_LIMITS.md) vrijede po prijemniku.

---

## 9. Koliko prijemnika stane

Softver ne postavlja ograničenje; hardver da. Uskopojasni prijemnici su skromni: RTL-SDR na 2,4 Msps troši oko 5–10 % jedne jezgre, nekoliko desetaka MB memorije i oko 38 Mbit/s USB-a.

- **USB 2.0 je uobičajena granica.** Svi USB 2 uređaji dijele jednu sabirnicu od 480 Mbit/s, čak i u plavoj USB 3 utičnici. Tri do četiri RTL-SDR-a po sabirnici sigurna su brojka; dodajte ih jedan po jedan i pratite svaki vodopad zbog praznina.
- **Napajanje:** za više od dva sticka koristite hub s vlastitim napajanjem.
- **Drugi širokopojasni prijemnik** (još jedan RX-888, ili HackRF na 20 Msps) druga je priča: s prvim se natječe za USB 3, CPU i GPU.
- **Slušatelji koštaju više od prijemnika.** Svaki slušatelj troši CPU na svom prijemniku i propusnost za slanje, pa je ukupan broj slušatelja važniji od broja prijemnika.

---

## 10. Zamke koje treba znati

- **Dva sticka istog modela imaju isti serijski broj.** Svaki RTL-SDR Blog V4 javlja `00000001`. Dajte svakome vlastiti s `rtl_eeprom -s <serijski>` (s po jednim priključenim stickom) i navedite ga u `instance.env` (`RX_ARGS="-d <serijski> …"`), inače nakon ponovnog pokretanja stickovi mogu zamijeniti prijemnike.
- **Kiwi klijenti ne mogu birati prijemnik.** KiwiSDR klijent bira golu adresu i port; preko proxyja uvijek završi na zadanom prijemniku. Na ostalima držite `[kiwi_emulation]` isključenim.
- **Kolačići vrijede po hostu, ne po portu.** Posjetitelj koji je koristio drugi prijemnik na `:9000` nosi `rx=vhf` i na `:9001`. Zato stranica odlučuje koji je prijemnik prema `siteReceiverId`, nikada prema kolačiću.
- **Unosi u imenicima.** Dajte svakom prijemniku vlastito ime u `[websdr]`, a na prijemniku iza proxyja postavite `[websdr] public_port` na port koji koriste slušatelji, inače unos oglašava unutarnji.
- **Izgradnja frontenda nakratko prikazuje „Not Found".** `frontend/dist` se ponovno gradi na mjestu, pa tijekom nekoliko sekundi izgradnje stranica nedostaje na svakom prijemniku.
- **Ništa ne pokreće prijemnike pri pokretanju računala**, osim ako to sami ne uredite. Nakon ponovnog pokretanja `./start-all.sh` vraća ih sve.
