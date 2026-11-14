# Administratorska ploča PhantomSDR-Plusa — Vodič za postavljanje

> ⚠️ **Sigurnosna napomena:** držite ovu administratorsku ploču na kućnoj mreži ili iza VPN-a. Javno izlaganje administratorskog porta ne preporučuje se bez odgovarajućeg pojačanja autentifikacije.

---

## Pregled

Administratorska ploča sastoji se od dvije Python usluge:

| Usluga | Datoteka | Uloga |
|---|---|---|
| Administratorska ploča | `admin_server.py` | Flask web-aplikacija, veže se na `127.0.0.1` (samo interno) |
| Obratni proxy | `proxy.py` | Izlaže i SDR i administratorsku ploču na jednom javnom portu |

Obje usluge čitaju konfiguraciju iz `admin_config.json`, koju zapisuje `setup_admin.sh`. **Nemojte izravno mijenjati konstante portova u Python datotekama** — svi portovi i IP adresa SDR poslužitelja pohranjeni su u `admin_config.json`.

---

## Što vam administratorska ploča donosi

- **Nadzorna ploča** — stanje poslužitelja uživo, CPU/RAM, najzahtjevniji procesi, nedavni ispis zapisnika, terminal
- **Uređivač konfiguracije** — pregled, uređivanje i spremanje bilo koje `.toml`, `.sh`, `.json`, `.h` ili `.cpp` datoteke u vašoj instalaciji
- **Preglednik zapisnika** — praćenje bilo koje datoteke zapisnika u stvarnom vremenu (SDR poslužitelj, administratorska ploča, RADE, rušenja, autorun, proxy)
- **Oznake** — pregled i uređivanje frekvencijskih oznaka
- **Povijest razgovora** — pregled zapisnika WebSDR razgovora, potpuno brisanje ili uklanjanje pojedinačnih poruka bez ponovnog pokretanja poslužitelja
- **Poruka na slapu** — emitiranje trajne poruke svim spojenim korisnicima, vidljive u stvarnom vremenu na prikazu slapa
- **Korisnici** — živi popis spojenih slušatelja s imenom ili pozivnim znakom, lokacijom i IP adresom, frekvencijom, načinom i trajanjem, gumbom ⚡ Kick i izbornikom ⛔ Ban ▾ (8, 16 ili 24 sata) te kartom njihovih položaja
- **Brisanje poruka razgovora** — gumb 🗑 Delete koji odmah uklanja tu jednu poruku iz zapisnika
- **Emitirane poruke na slapu** — omogućuje slanje trajnog tekstualnog natpisa na slap svakog spojenog korisnika
- **Spot Reporting** — pokretanje/zaustavljanje autorun dekodera FT8/FT4/JS8/WSPR, odabir pojaseva/načina rada i prijava spotova na PSK Reporter / wsprnet (prema zadanom isključeno), s dva brojača: pločice po dekoderu za tekući rad i ukupan zbroj od početka uz svaki potvrdni okvir pojasa/načina rada Za svaki pojas i način rada mogu se odrediti UTC sati, a daemon se može sam pokrenuti nakon ponovnog pokretanja računala ili rušenja.
- **Grafikoni** — frekvencija procesora, opterećenje procesora, temperatura procesora i povezani korisnici, prikazani kroz zadnjih 15 minuta / 1 sat / 4 sata / 12 sati / 24 sata
- **Toplinska zaštita (Thermal Guard)** — zaustavlja poslužitelj ako se procesor pregrije i ponovno ga pokreće kad se ohladi, s pragovima izvedenima iz vašeg vlastitog procesora; radi s bilo kojim načinom pokretanja/zaustavljanja i isporučuje se u načinu samo zapisivanja, pa ne čini ništa dok ga ne uključite
- **Postavke** — promjena administratorske lozinke, osnovnog direktorija SDR-a, naziva procesa i porta spectrumservera (port slušatelja prikazan je ispod); pokretanje zadane skripte za pokretanje ili zaustavljanje s ▶ START / ■ STOP; kartica **HTTPS** koja provjerava https ili vas vodi kroz uključivanje
- **Prijemnici** — svaki prijemnik stanice s opsegom koji pokriva, širinom pojasa, pojačanjem i je li u eteru; promjena postavki i pojačanja prijemnika, zaustavljanje ili pokretanje, preimenovanje ili brisanje jednog prijemnika, i priprema novog prijemnika za `add-receiver.sh`
- **Stanje sustava** (Dashboard) — svaki prijamnik u eteru ili isključen, s vremenom rada, slobodan prostor na disku i veličina svake mape zapisa, posljednji unos u `crash.log` i nedavna upozorenja
- **DRM** (Dashboard) — DRM dekoder: radi li njegov pomoćnik, koliko je dekodera zauzeto i tko dekodira koju frekvenciju (stanica, kodek, WMER); uključivanje ili isključivanje DRM-a i najveći broj DRM slušatelja (1–20), primjenjuje se unutar 5 s bez ponovnog pokretanja. Stranica korisnika prikazuje te slušatelje kao DRM
- **Receive Diversity** (Dashboard) — svaki slušatelj koji vaš prijemnik kombinira s drugim prijemnom raznolikošću: ime i grad, frekvencija i način rada, partner (PhantomSDR+, KiwiSDR, UberSDR ili WebSDR) i njegova adresa. Vidi ga samo administracijska ploča, nikad javni popis korisnika
- **Posjetitelji** — privatna statistika posjetitelja za 1 do 31 dan: posjetitelji, sesije, sati slušanja, najviše istodobno, po danu, najprometniji sati, zemlje, i adrese s najviše istodobnih sesija, s ⛔ Ban ▾
- **Upozorenja** — e-pošta i/ili Telegram poruka kada prijamnik ispadne iz etera, vrati se ili se ponovno pokrene, kada thermal guard promijeni stupanj, ili kada `crash.log` dobije novi unos
- **Sigurnosna kopija i vraćanje** — jedan zip s vlastitim postavkama stanice, i vraćanje koje svaku datoteku koju zamjenjuje najprije kopira u `admin-backups/`
- **Teme** — Phosphor green, Amber display, Metal panel, Modern dark, Light i Auto (svijetlo danju, tamno noću), birane s **THEME** u gornjoj traci svake stranice

---

## Preduvjeti

- PhantomSDR-Plus već instaliran i pokrenut
- Python 3.8+

> [!NOTE]
> **Uobičajeno to za vas obavlja instalacijska skripta.** `./install.sh` — kao i svaka od četiri distribucijske skripte, obje RADE skripte i skripta poslužitelja statistike — postavlja ploču prema zadanome, uz prethodnu instalaciju `pipa` upraviteljem paketa sustava ako nedostaje. Ova stranica opisuje što se u tom koraku događa i što učiniti ako ste ga preskočili ili želite nešto naknadno promijeniti.

Python biblioteke ploče (`flask`, `psutil`, `aiohttp`, `tomli-w`) instalira `setup_admin.sh`; ako to zakaže, ispisuje točnu naredbu koju treba pokrenuti.

---

## Korak 1 — Pokrenite skriptu za postavljanje

```bash
./setup_admin.sh
```

> **Bez administratorske ploče:** `bash setup_admin.sh --proxy-only` instalira samo `proxy.py` na javnom portu, s portovima iz `station.conf`. To radi instalacijski program kad odbijete ploču, jer do proxyja stižu slušatelji — i `/rade`, `/stats`, `/relay`.

Skripta će:

1. Provjeriti je li instaliran Python 3
2. Provjeriti postoje li `admin_server.py` i `manage_admin.sh`
3. Zabilježiti `127.0.0.1` kao `sdr_host` u konfiguraciji (vidi [Postavka `sdr_host`](#postavka-sdr_host))
4. Zatražiti tri broja porta. Svaki upit nudi zadanu vrijednost u uglatim zagradama koju
prihvaća običan Enter, pa je uobičajeno postavljanje pitanje triju pritisaka tipke:
   - **Port spectrumservera** — port na kojem sluša vaš SDR poslužitelj (zadano `9001`,
     upravo ono što donosi svaki `config-*.toml` u repozitoriju)
   - **Interni port administratorske ploče** — gdje se `admin_server.py` lokalno veže (zadano `9010`)
   - **Javni port proxyja** — jedini vanjski port koji objedinjuje SDR + administraciju (zadano `8902`)
   Na stanici postavljenoj s pitanjima o stanici (`configure-station.sh`) tri zadane vrijednosti su vlastiti portovi stanice iz `station.conf` — 9001, 9010 i 9000 — pa je Enter ispravan, a skripta za pokretanje je već unaprijed odabrana.

Nakon postavljanja otvorite preglednik putem proxyja:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Zadana lozinka: **`admin`**

> ⚠️ **Odmah promijenite lozinku** — pri prvoj prijavi čarobnjak u jednom koraku traži samo novu lozinku. Direktorij i portovi već su u `admin_config.json` (upisuje ih `setup_admin.sh`, koji pokreće instalacijska skripta); čarobnjak ih samo prikazuje radi informacije i ne mijenja ih. Kasnije ih možete promijeniti u Settings ili pomoću `./configure-station.sh`.

---

## Korak 2 — Pokretanje / zaustavljanje / ponovno pokretanje

Postoje dva načina za pokretanje ploče i proxyja. **Odaberite jedan i držite ga se** — upozorenje na kraju ovog odjeljka objašnjava što se događa ako ih miješate.

> **Način B (systemd) snažno se preporučuje** svugdje gdje je systemd dostupan. Zaštita od pregrijavanja procesora radi unutar ploče, pa ploča koja umre u 03:00 ili računalo koje se ponovno digne ostavljaju procesor nezaštićenim dok ga netko ručno ne pokrene. `setup_admin.sh` sada nudi jedinice po zadanome. Način A koristite kad systemda nema — kontejneri, WSL1, OpenRC/sysvinit — ili kad namjerno želite sami nadzirati stvari.

### Način A — `manage_admin.sh` (bez roota, ništa se ne instalira)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Jedna skripta upravlja **objema** procesima. Prije pokretanja proxyja provjerava je li instaliran `aiohttp` i ispisuje jasnu pogrešku s naredbom za ispravak ako ga nema.

### Način B — systemd jedinice (pokreću se pri dizanju sustava, ponovno se pokreću nakon pada)

Repozitorij donosi dvije gotove jedinice, `phantomsdr-admin.service` i `phantomsdr-proxy.service`. U obje prilagodite `User=` i putanje, zatim:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Svakodnevne naredbe tada postaju:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Iste četiri s `phantomsdr-proxy`, ili obje odjednom: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

Jedno napravite jednom: instalirajte tmpfiles pravilo iz `tmpfiles/phantomsdr-logs.conf` (prvo u njemu izmijenite putanje i korisnika). systemd te dvije datoteke stvara kao `root` prije nego se spusti na `User=`, pa gumb **Clear Logs** na ploči na njima pada uz `Permission denied` — vidi niže „Clear Logs javlja Permission denied“. `setup_admin.sh` pravilo instalira umjesto vas.

Povratak na način A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Nemojte ih miješati.** Uz uključene jedinice, `./manage_admin.sh stop` systemd poništi pet sekundi kasnije, a `./manage_admin.sh start` daje vam drugu, neupravljanu kopiju koja se sa systemd-ovom otima za isti port. (`restart` je upravo zbog toga uklonjen iz skripte; sada ispisuje pogrešku i upućuje vas na `systemctl`.) `./manage_admin.sh status` samo čita pa ostaje koristan u oba slučaja.

### Ponovno pokretanje ploče

Ostatak ovog dokumenta na više mjesta kaže „ponovno pokrenite ploču“. To znači ono što odgovara vašem načinu:

```bash
# Način B — systemd jedinice (uobičajena postava)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Način A — jedinice nisu instalirane
./manage_admin.sh stop && ./manage_admin.sh start
```

---

## Korak 3 — Otvorite port na vatrozidu

Na vatrozidu otvorite samo **javni port proxyja**. Interni port administratorske ploče nije potrebno izlagati prema van:

```bash
sudo ufw allow <proxy_port>
```

---

## Korak 4 — Značajka Kick Users

Stranica Users prikazuje svakog trenutačno spojenog slušatelja. Svaki redak prikazuje ime ili pozivni znak koji je slušatelj upisao (`--` ako ga nema), lokaciju s IP adresom ispod, ugođenu frekvenciju, način i koliko je dugo spojen. Da biste odspojili jednog korisnika, kliknite gumb **⚡ Kick** u njegovom retku — zatvaraju se samo veze tog slušatelja. Svi ostali slušatelji ostaju spojeni i ništa ne primjećuju.

Pokraj načina rada stranica Users prikazuje dekoder koji slušatelj koristi na svojoj stranici, na primjer `USB · FT8` (DRM slušatelji prikazuju se kao `DRM`). Stranice otvorene prije ažuriranja poslužitelja javljaju ga tek nakon ponovnog učitavanja.

Izbacivanje je trenutačno i precizno: poslužitelj se ne pokreće ponovno, ničiji se zvuk ne prekida, a izbačeni korisnik može se odmah ponovno spojiti (funkcija služi za uklanjanje problematičnih ili zaglavljenih veza; da nekoga zadržite vani, koristite zabranu ispod).

**⛔ Ban ▾** otvara mali izbornik — **8**, **16** ili **24 sata** — a odabrano trajanje odspaja slušatelja sa svih prijemnika postaje i odbija tu adresu toliko dugo (24 sata najviše je što prijemnik prihvaća) (kod zatvaranja 4001, koji stranica ne pokušava ponovno). Zabrana se čuva u `admin_bans.json` pokraj ploče i jednom u minuti ponovno šalje svakom prijemniku, pa je ponovno pokretanje prijemnika ne ukida. Dok zabrane vrijede, popis **Banned** ispod tablice prikazuje svaku s imenom, adresom i vremenom isteka, a gumb **Unban** odmah je ukida. Svi iza iste internetske veze dijele adresu i zabranjeni su s njom.

---

## Konfiguracija — admin_config.json

Sva konfiguracija izvođenja nalazi se u `admin_config.json` u vašem PhantomSDR-Plus direktoriju. `setup_admin.sh` zapisuje početnu datoteku; kasnije promjene mogu se raditi putem stranice Settings ili izravnim uređivanjem datoteke.

Ključna polja koja zapisuje `setup_admin.sh`:

| Ključ | Opis |
|---|---|
| `port` | Interni port administratorske ploče (ondje se veže `admin_server.py`) |
| `public_port` | Port spectrumservera glavnog prijemnika (9001 iza proxy.py) — **nije** port slušatelja, to je `proxy_port`. proxy.py prosljeđuje na njega; Kick, stranica Users i broj slušatelja ga pitaju |
| `proxy_port` | Javni port na kojem sluša proxy |
| `sdr_host` | Računalo preko kojeg proxy doseže spectrumserver — `127.0.0.1` (vidi dolje) |
| `password_hash` | SHA-256 sažetak administratorske lozinke |
| `sdr_base_dir` | Putanja do vaše PhantomSDR-Plus instalacije |
| `sdr_process_name` | Naziv procesa za nadzor (zadano: `spectrumserver`) |
| `start_script` / `stop_script` | Skripte kojima ploča pokreće i zaustavlja SDR poslužitelj — preko njih djeluje i toplinska zaštita |

> **Više prijemnika na jednom računalu?** Postavite `start_script` na `start-all.sh`. Skripta za zaustavljanje već zaustavlja sve prijemnike, a Restart i toplinska zaštita koriste skriptu za pokretanje; sa `start-all.sh` vraćaju sve prijemnike iz `receivers.toml` umjesto samo glavnoga. Stranica Users, broj slušatelja i izbacivanje tada također obuhvaćaju svaki prijemnik. Vidi [Više prijemnika](MULTI_RECEIVER.md).

---

## Postavka `sdr_host`

`proxy.py` se na `spectrumserver` spaja preko povratne (loopback) adrese — `sdr_host` je `127.0.0.1` u `admin_config.json`, gdje ga upisuje `setup_admin.sh`. Ne biste to trebali morati mijenjati.

Postavite stvarnu adresu samo ako `spectrumserver` radi na **drugom računalu** od proxyja. Zatim [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče).

---

## proxy.py — što je i kada vam treba

`proxy.py` smješta i SDR poslužitelj i administratorsku ploču na **jedan javni port**, usmjeravajući prema prefiksu putanje:

| Putanja | Usmjerava se na |
|---|---|
| `/admin*` | Administratorsku ploču (`localhost:<port>`) |
| Sve ostalo | Spectrumserver (`<sdr_host>:<public_port>`) |

Bez proxyja morate izložiti dva porta zasebno. S proxyjem izlažete samo jedan.

Proxy također uklanja ograničenje veličine WebSocket poruke od 4 MB (važno za velike FFT okvire s RX-888 pri 60 MSPS), prosljeđuje stvarne IP adrese klijenata putem `X-Forwarded-*` zaglavlja i održava dugotrajne veze kroz NAT pomoću otkucaja svakih 30 sekundi.

---

## Promjena portova nakon postavljanja

Uredite `admin_config.json` izravno:

```json
{
  "port":        9010,
  "public_port": 9001,
  "proxy_port":  9000,
  "sdr_host":    "127.0.0.1"
}
```

Zatim ponovno pokrenite obje usluge:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Korisne ručne naredbe

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 9010/tcp

# Check what is listening on a port
ss -tlnp | grep 9010
```

---

## Datoteke zapisnika

| Datoteka | Sadržaj |
|---|---|
| `admin.log` | Ispis administratorske ploče |
| `proxy.log` | Natpis pri pokretanju proxyja + jedan redak pristupa po proslijeđenom zahtjevu |
| `logwebsdr.txt` | Zapisnik pokretača i nadzornika — pokretanje/zaustavljanje, upravljački program prijamnika, registracija na websdr.org |
| `spectrumserver.log` | Izlaz samog procesa prijamnika — postavljanje FFT-a i OpenCL-a, veze pojedinih klijenata, pogreške. Najveća od ovih datoteka; rotira se, pa uz nju može stajati `spectrumserver.log.1` |
| `rade.log` | Zapisnik RADE/FreeDV sidecara |
| `autorun.log` | Zapisnik dekoderskog daemona — spotovi, SNR, drift |
| `crash.log` | Izvještaji o rušenju i toplinski događaji: `[CRASH]` / `[TERMINATE]` backtraceovi, `[EXIT]` bilješke i `[THERMAL]` retci zaštite. **Uobičajeno prazan** — sve što se u njemu nađe vrijedi pročitati |

Sve se to može čitati iz kartica **Log Viewer** na ploči (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Preglednik prikazuje zadnjih 150 redaka odabrane kartice i osvježava se svake 3 sekunde kad je uključeno automatsko osvježavanje; čita samo kraj datoteke, pa njezina veličina nije važna.

### Rotiranje proxy.log i admin.log

`proxy.log` bilježi svaki proslijeđeni zahtjev, a `admin.log` svaki zahtjev koji stigne do same ploče. Nijedan se ne rotira prema zadanom. Ispitivanja nadzorne ploče nekoć su dominirala objema datotekama — `/admin/api/status` okida svakih ~3 sekunde dok je kartica otvorena — ali sada se filtriraju iz oba zapisnika (vidi niže), pa rotacija ograničava spor rast, a ne poplavu.

Repozitorij donosi logrotate konfiguraciju u `logrotate/phantomsdr` (dnevno, ili ranije ako zapisnik prijeđe 10 MB; čuva 7 gzip arhiva u `logproxy/` kako ne bi zatrpavale korijen projekta). **Ovisi o instalaciji — otvorite je i prije instalacije promijenite tri putanje zapisnika, putanju `olddir` i korisnika `su` da odgovaraju vašem računalu**, zatim:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

Gumb **Clear Logs** na ploči prazni **svaku** datoteku iz gornje tablice, uključujući `autorun.log` i `proxy.log` (`CLEAR_EXCLUDE` u `admin_server.py` je prazan). Imajte na umu što to stoji kod `autorun.log`: njegova povijest dekodiranja jedini je zapis o tome što je i kada primljeno i nije je moguće rekonstruirati — pražnjenje preživi samo ono što je logrotate već premjestio u `logproxy/`, pa se gubi sve dekodirano od zadnje rotacije. Pražnjenje uz dekoder u radu je sigurno: daemon datoteku drži otvorenu s `O_APPEND` i nastavlja pisati u isti inode. Obavijest navodi što je ispražnjeno, a ako se u neku datoteku nije moglo pisati — recimo `proxy.log` koji na instalaciji s odvojenim korisnicima pripada drugom korisniku — navodi tu datoteku i pogrešku umjesto da javi uspjeh te ostavlja prikaz tog zapisnika na zaslonu umjesto da ga isprazni. Datoteke se prazne na mjestu, nikada se ne brišu: i `manage_admin.sh` i systemd jedinice otvaraju ih s `O_APPEND`, pa bi obrisana datoteka nastavila puniti nevidljiv inode sve do ponovnog pokretanja usluge.

Budući da je `proxy.log` zapisnik pristupa, sadrži IP adrese posjetitelja i nizove user-agenta — imajte to na umu prije nego što ga podijelite tražeći pomoć.

### „Clear Logs“ javlja Permission denied

Na stroju gdje su systemd jedinice instalirane na čistom stablu, gumb može vratiti:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Uvijek su to te dvije datoteke i nikada ostalih pet, jer ih jedine stvara sam systemd. `StandardOutput=append:` otvara PID 1 **prije** nego se spusti na `User=`, pa se zapisnik koji još ne postoji stvara kao `root:root 0644`. Ploča radi kao vaš korisnik i ne može ga isprazniti. Ostalih pet zapisnika stvaraju skripte za pokretanje, koje ionako rade kao vaš korisnik, pa se brišu normalno. Ondje gdje su te dvije datoteke starije od jedinica — stvorio ih je `manage_admin.sh` s `>>` — vlasnik je već ispravan i gumb radi; zato se problem pojavljuje samo na svježoj instalaciji koja je odmah krenula sa systemd jedinicama.

Provjerite s `ls -l admin.log proxy.log`: one koje ne uspijevaju pokazuju `root root`. Popravite ih:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Ponovno pokretanje nije potrebno — systemd i dalje piše kroz već otvoreni opisnik datoteke, a dopisivanje ne mijenja vlasništvo. Pritisnite **Clear Logs** ponovno i obje se prazne.

Da se ne bi vraćalo, instalirajte tmpfiles pravilo koje repozitorij isporučuje u `tmpfiles/phantomsdr-logs.conf`. Ono pri svakom dizanju sustava, prije pokretanja jedinica, ponovno stvara oba zapisnika s ispravnim vlasnikom, pa se uklonjeni zapisnik — ručno čišćenje, ponovna instalacija, premješten instalacijski direktorij — nikada ne vrati u vlasništvu roota. **Pravilo ovisi o stroju: otvorite ga i najprije promijenite dvije putanje i user:group da odgovaraju vašem sustavu**, a zatim:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

---

## Sažetak pristupa

| Postava | SDR | Administratorska ploča |
|---|---|---|
| Bez proxyja | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| S proxyjem | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Brisanje poruka razgovora

Stranica Chat History navodi svaku poruku u trenutačnom zapisniku razgovora. Svaki unos ima gumb **🗑 Delete** koji odmah uklanja tu jednu poruku iz zapisnika — bez ponovnog pokretanja poslužitelja.

Kako to radi:

- Administratorska ploča prepisuje datoteku zapisnika razgovora na mjestu, uklanjajući samo redak odabrane poruke.
- Promjena vrijedi za svakog korisnika koji ponovno učita razgovor; već učitana povijest u otvorenim karticama preglednika ne ažurira se retroaktivno.
- Brisanje cijelog zapisnika (gumb **Clear All**) prazni datoteku, što također djeluje bez ponovnog pokretanja.
- **Odgovor u chatu** sprema se kao obična poruka koja počinje oznakom što imenuje poruku na koju odgovara, na primjer `[RE:2026-09-25 12:00:01|SV1BTL]`, pa se u ovom popisu prikazuje s tom oznakom ispred. Brisanje odgovora uklanja samo taj odgovor. Brisanje poruke na koju odgovara ostavlja njezine odgovore na mjestu, a oni tada prikazuju samo ime i vrijeme na koje odgovaraju.

---

## Emitirane poruke na slapu

Ploča **Waterfall Message** omogućuje slanje trajnog tekstualnog natpisa na prikaz slapa svakog spojenog korisnika bez diranja procesa poslužitelja.

### Slanje poruke

1. Otvorite administratorsku ploču i idite na **Waterfall Message**.
2. Upišite tekst poruke i odaberite boju (heksadecimalno, npr. `#ffdd00`).
3. Kliknite **Send** — poruka se odmah pojavljuje u svim aktivnim prikazima slapa.

### Uklanjanje poruke

Kliknite **Clear** da uklonite natpis sa svih slapova. Stanje poruke administratorska ploča drži u memoriji; briše se automatski ako se proces ploče ponovno pokrene.

---

## Grafikoni sustava

Stranica **Grafikoni** crta četiri veličine na zajedničkoj vremenskoj osi:

- **Frekvencija procesora** — prosječni takt svih jezgri, u GHz
- **Opterećenje procesora** — ukupna iskorištenost, u postotcima
- **Temperatura procesora** — u °C, s crtkanim oznakama na 70 °C (toplo) i 80 °C (kritično)
- **Korisnici na vezi** — slušatelji spojeni na WebSDR u tom trenutku

Raspon birate s **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Prelaskom miša preko grafikona pojavljuje se nitni križ s sve četiri vrijednosti tog trenutka. Četiri kartice iznad grafikona uvijek prikazuju najnoviji uzorak.

---

## Thermal Guard

> 📖 **Cjeloviti priručnik: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — četiri načina rada i što sysop mora učiniti u svakome, rad bez ploče, throttle faza bez roota, testiranje i rješavanje problema.

Zaustavlja SDR poslužitelj kada procesor postane opasno vruć i ponovno ga pokreće kad se ohladi. Dio je ploče — nema ničega dodatnog za instalirati — i pojavljuje se kao kartica **THERMAL GUARD** na Nadzornoj ploči, a postavke su pod **Postavke**.

Isporučuje se **neaktivna**: način rada počinje na `log`, pa u početku samo bilježi što bi *učinila*. Ništa ne dira vaš poslužitelj dok ne promijenite način rada.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

Kartica **Spot Reporting** upravlja autorun daemonom (`autorun/index.js`) — Node.js procesom koji dekodira FT8/FT4/JS8/WSPR na poslužiteljskoj strani izravno s prijamnika i šalje spotove u mreže za prijavu:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 se spotta samo pri brzini Normal** — pozivnom ciklusu od 15 s, na kojem su heartbeatovi i CQ pozivi. Spotovi dolaze iz heartbeatova, compound okvira i usmjerenih poruka; grupna odredišta poput `@ALLCALL` i pozivni znakovi koje dekoder nije uspio razriješiti (`<....>`) nikada se ne prijavljuju. JS8 dijeli PSK Reporter red s FT8 i FT4 te se broji zasebno, jednako kao i oni.


**Prijavljivanje je prema zadanom ISKLJUČENO.** Ništa se ne šalje dok ne uključite odredište i pritisnete **Start**. Dekodiranje i slanje neovisni su: daemon može dekodirati i zapisivati s isključenim prijavljivanjem, pa možete provjeriti aktivnost prije nego išta postane javno.

> ⚠️ Spotovi se šalju u javne mreže pod **vašim pozivnim znakom**. Uključite samo pojaseve i načine rada koje vaš prijamnik doista čuje i postavite ispravan lokator.

### Preduvjeti

Autorun daemon treba Node.js 22+, npm pakete `ws` + `cbor-x` (razrješavaju se preko simboličke poveznice `autorun/node_modules` → `frontend/node_modules`) i `util-linux` (`taskset`). Instalacijske skripte sve to postavljaju automatski — vidi [odjeljak Autorun Spot Reporter u INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Ako **Start** ne uspije, uobičajeni je uzrok ta poveznica ili `taskset` (vidi Rješavanje problema niže).

### Korištenje kartice

1. **Identitet** — pozivni znak i lokator. Unaprijed popunjeni iz `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, skraćeno na 6 znakova); ovdje ih po potrebi zamijenite. Reporteri primaju samo lokator od 4 ili 6 znakova (KM17 ili KM17VX): dulji se skraćuje na svoj kvadrat od 6 znakova, a ono što nije lokator odbija se pri spremanju.
2. **Matrica pojas × način rada** — označite kombinacije za dekodiranje. Retci su pojasevi, stupci FT8 / FT4 / JS8 / WSPR; nepodržane ćelije su onemogućene. WSPR dodatno pokriva LF/MF pojaseve (2200 m, 630 m) i dodatni europski kanal na 80 m.
3. **Odredišta** — uključite **PSK Reporter** i/ili **wsprnet** (oboje prema zadanom isključeno).
4. **Max slots** — granica koliko slotova pojas/način radi istodobno; uz [raspored](#raspored-sati-po-pojasu-i-načinu-rada) provjerava se sat po sat. **SELECT ALL** pokraj nje označava sve pojaseve i načine.
5. **Start / Stop** — pokreće/gasi daemon (vezan uz gornje CPU jezgre pomoću `taskset`, koje se biraju automatski prema računalu — vidi *Zahtjevi za resursima i ograničenja* niže). **Save** / **Reload** spremaju i ponovno čitaju konfiguraciju; **Free All** prazni sva mjesta. **Start automatically after a reboot or crash** sam vraća daemon — vidi [niže](#automatsko-pokretanje-nakon-ponovnog-pokretanja-ili-rušenja).

Kartica stanja osvježava se svakih 5 s i prikazuje stanje rada, brojače dekodiranja/slanja i vrijeme posljednjeg slanja. Oznaka **📶 REPORTING** pojavljuje se na glavnom slapu dok je prijavljivanje aktivno.

> **„0 sent" prvih nekoliko minuta je normalno.** PSK Reporter šalje skupno svakih **5 minuta**, a wsprnet svake **2 minute** — spotovi čekaju u redu do sljedećeg slanja. Kartica stanja prikazuje broj u čekanju i ritam slanja.

### Promjena pojaseva ili načina rada dok radi

Spremljena promjena sama stiže do daemona koji radi. Daemon gleda `autorun.json` svakih 5 sekundi i, kad ga je **SAVE CONFIG** promijenio, preuzima nove pojaseve, načine, sate i odredišta bez ponovnog pokretanja: novi slotovi se otvaraju, uklonjeni zatvaraju, a `autorun.log` piše `config reloaded` s otvorenim i zatvorenim slotovima. Brojači se nastavljaju. **START** na daemonu koji radi i dalje odgovara `already running`, što je bezopasno: promjena koju je spremio ipak se preuzima.

Dvije stvari i dalje traže **STOP** → **START**: pozivni znak i lokator (log javlja kad se promijene) te ručno upisan unos `server` ili `cores` u `autorun.json`.

Što ponovno pokretanje čini brojačima:

- **Ukupni brojevi uz svaku kućicu ostaju** — nalaze se u `autorun-totals.json`, koji se pri gašenju ne briše.
- **Pločice po dekoderu vraćaju se na nulu**, vrijede po pokretanju.
- **Ništa iz reda se ne gubi**: gašenje prvo pošalje spotove na čekanju.
- **Novouključeni** pojas kreće od `0`; pojas koji ste **već koristili** nastavlja svoj prijašnji zbroj.
- Pojas koji **odznačite zadržava svoj broj** uz sada praznu kućicu; povijest se ne briše.

**SELECT ALL**, pokraj MAX SLOTS, označava sve pojaseve i načine; kad su svi označeni, gumb glasi **DESELECT ALL** i uklanja oznake.

### Raspored (sati po pojasu i načinu rada)

Ispod BANDS & MODES kartica **SCHEDULE** ima redak za svaki označeni pojas i način, s 24 kućice za sate 00–23 **UTC**. Kvačica u kućici znači da taj slot u tom satu dekodira i šalje spotove. U ostalim satima spava, sa zatvorenom vezom prema prijemniku: ne troši CPU i ne zauzima nijedno slušateljsko mjesto prijemnika. Slot sa svim označenim satima radi cijeli dan, kao prije rasporeda — tako počinje svaka postojeća konfiguracija.

- Klik označava ili odznačava kućicu; povlačenjem se zahvaća više njih.
- **24h** i **Clear** — svi sati ili nijedan.
- **Day** i **Night** — 06–18 i 18–06 po lokalnom *sunčevom* vremenu na lokatoru iz REPORTER IDENTITY (za KM17VX Day je 04–15 UTC). Sunčevo, a ne službeno vrijeme, da vrijedi za svaku postaju i da se ne pomiče s ljetnim računanjem vremena.
- **→ 20m** (pojas tog retka) — daje iste sate ostalim označenim načinima tog pojasa i zamjenjuje njihove.
- **show local time** — stupce označava vremenom vašeg preglednika; raspored se i dalje sprema u UTC-u.
- Redak **AT ONCE** broji slotove koji rade u svakom satu. Crveni broj je iznad **MAX SLOTS**, a **SAVE CONFIG** odbija spremanje dok se to ne ispravi. MAX SLOTS ograničava slotove koji rade *istodobno*, a ne kroz dan, pa uz raspored više pojaseva dijeli isti CPU — na primjer 10, 12 i 15 m danju te 160 i 80 m noću.
- Točka ispred svakog retka zelena je dok slot dekodira, narančasta dok se otvara za svoj sljedeći sat ili zatvara, a siva dok spava ili je daemon zaustavljen. Kartica stanja prikazuje slotove koji su upravo na rasporedu i vrijeme sljedeće promjene.

Slot se otvara malo prije svog prvog sata — jedan prozor dekodiranja plus 10 sekundi, dakle oko 25 s za FT8 i JS8 i nešto više od 2 minute za WSPR — kako bi se dekodirao prvi ciklus sata; ciklus čut tijekom tog predbroja pripada prethodnom satu i ne prijavljuje se. Zatvara se nekoliko sekundi nakon svog posljednjeg sata, kad je dekodiranje posljednjeg ciklusa tog sata već počelo. Veza koja pukne, na primjer jer je prijemnik ponovno pokrenut, ponovno se otvara nakon 30 sekundi.

### Automatsko pokretanje nakon ponovnog pokretanja ili rušenja

**Start automatically after a reboot or crash**, ispod gumba, zadano je isključeno i djeluje nakon **SAVE CONFIG**. Kad je uključeno, administratorska ploča — koju systemd pokreće pri dizanju sustava — pokreće daemon otprilike minutu nakon što se ploča podigne, zatim svake minute provjerava radi li još i ponovno ga pokreće ako se zaustavio. Prijemnik koji još nije pokrenut ne smeta: daemon ponovno pokušava svoje veze svakih 30 sekundi.

**STOP uvijek ima prednost.** Nakon **STOP** daemon ostaje zaustavljen, i nakon ponovnog pokretanja računala, dok ne pritisnete **START**; ploča to pamti u datoteci `autorun-stopped`. **FREE ALL SLOTS** također zaustavlja daemon i drži ga zaustavljenim na isti način. Kartica stanja prikazuje `Autostart: off`, `ON` ili `ON, held by STOP`.

Daemon koji se zaustavi 5 puta unutar 15 minuta ostavlja se na miru 30 minuta umjesto da se pokreće svake minute. Svako automatsko pokretanje, i ta stanka, upisuju se u AUTORUN log kao `[admin …] autostart: …`.

### Brojači spotova

Prikazana su dva različita brojanja koja odgovaraju na različita pitanja.

**SPOTS UPLOADED PER DECODER** — pločica po dekoderu (FT8 / FT4 / JS8 / WSPR) sa spotovima poslanima **od zadnjeg pokretanja daemona**, a ispod broj dekodiranja i koliko ih još čeka u redu. Stop/Start ih vraća na nulu. Dekoder čije je odredište isključeno prikazuje svoja dekodiranja i `reporting off` umjesto golog `0`, jer je ondje nula slanja postavka, a ne kvar.

**Broj uz svaku kućicu** u BANDS & MODES je broj **ukupno** poslanih spotova za tu kombinaciju pojasa i načina rada. Čuva se u `autorun-totals.json` i preživljava ponovna pokretanja. **Jantarno s točkom ispred** (`·123`) znači da je taj slot dekodirao, ali još ništa nije poslao. To je normalno između slanja — PSK Reporter šalje svakih 5 minuta, a wsprnet svake 2 — pa FT8/FT4 brojači prvih nekoliko minuta nakon pokretanja stoje jantarno. Jantarno ostaje i ako je odredište tog dekodera isključeno. Obična `0` bez točke znači da je slot uključen, ali još ništa nije dekodirao — WSPR stoji na nuli nekoliko minuta nakon pokretanja jer radi u ciklusu od 2 minute, dok FT8 već broji u stotinama. Slot koji daemon nikada nije pokrenuo ne prikazuje ništa. Prelaskom miša vide se slanja, dekodiranja i vrijeme zadnjeg slanja.

**Poništavanje brojača.** **FREE ALL SLOTS** odznačuje sve pojaseve i načine rada, isključuje oba odredišta, zaustavlja daemon i **briše ukupne brojače** — nakon toga uz nijednu kućicu nema broja. To je jedini način da ih poništite i ne može se poništiti. Gumb zaustavlja daemon i čeka da izađe prije brisanja `autorun-totals.json`, jer daemon tu datoteku ponovno zapisuje pri gašenju; brisanje dok daemon radi samo bi vratilo brojeve.

### Zahtjevi za resursima i ograničenja

Daemon je namjerno lagan i radi na hardveru skromnih resursa (četverojezgreni i5 je dovoljan), ali postoje stvarna ograničenja kojih treba biti svjestan.

**Poznata ograničenja:**

1. **Pravo usko grlo su spectrumserver i širina pojasa SDR-a, a ne daemon.** RX888 na 30 MHz traži OpenCL/GPU; procesor s malo jezgri bez sposobnog GPU-a ne može održati taj FFT. Uparite skromni hardver s užim SDR-om (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR je najzahtjevniji za CPU.** Njegov Fano dekoder je JS port (~30 s po pojasu, jednodretveni). Skup od 4 workera izvodi 4 dekodiranja paralelno; uključivanje **više od ~4 WSPR pojasa** odjednom može produljiti red preko intervala od 120 s, osobito dok se SDR natječe za jezgre. Dekodiranja FT8/FT4 u usporedbi su jeftina.
3. **Skaliranje broja mjesta.** Podatak od ~2–2,5 jezgre / 600–700 MB odnosi se na punih ~28 mjesta na osmojezgrenom računalu. Na 4 dijeljene jezgre ograničite se na nekoliko pojaseva (smjernica: ≤ 6 FT8/FT4 + ≤ 3 WSPR) i pratite statistiku `queued` skupa.
4. **Vezanje pretpostavlja hibridnu Intel topologiju** (niže jezgre = brže P-jezgre). Na AMD-u ili procesorima s isprepletenim SMT numeriranjem automatska podjela i dalje vrijedi (bez preklapanja, bez rušenja), ali „niže jezgre su brže" možda ne vrijedi doslovno; na čipu 4C/8T s hyperthreadingom gornje su jezgre SMT blizanci — ograničene, ali ne i potpuno izolirane. Ondje gdje automatski raspon nije idealan, upotrijebite **ručnu zamjenu** niže.
5. **Pokrivenost pojaseva ograničava prijamnik.** Konfiguracija RX888 (`sps=60000000` → Nyquist na 30 MHz) ne doseže 6 m i više; tablica pojaseva ide od 160 m do 10 m. Drugi SDR-ovi pokrivaju ono što dopušta njihov ugođeni prozor.
6. **Ritam prijavljivanja.** PSK Reporter šalje svakih 5 min, wsprnet svake 2 min — „0 sent" prvih nekoliko minuta normalno je, a ne kvar.

### Datoteke i krajnje točke

| Stavka | Svrha |
|---|---|
| `autorun.json` | Spremljena konfiguracija (identitet, slotovi sa svojim UTC satima `hours`, odredišta, maks. slotova, `autostart`, neobavezno `cores`). Piše je kartica; git je ignorira. Slot bez `hours` radi cijeli dan. |
| `autorun-stopped` | Postoji nakon **STOP**: automatsko pokretanje ostavlja daemon zaustavljenim, i nakon ponovnog pokretanja, dok ga **START** ne ukloni. Git ga ignorira. |
| `autorun/scheduler.js` | Koji su slotovi otvoreni u danom trenutku: sati, predbroj prije prvog sata i odgoda nakon posljednjeg. Testira se s `node autorun/scheduler.test.mjs`. |
| `autorun-status.json` | Trenutačno stanje koje čita kartica stanja (pid, brojači, posljednje slanje). Zapisuje se svakih 15 s; uklanja se pri zaustavljanju. |
| `frontend/dist/autorun-active.json` | Javni podaci oznake, posluženi na `/autorun-active.json`. Prazno kada je prijavljivanje isključeno. |
| `autorun.log` | Standardni izlaz i pogreške daemona. |
| `GET/POST /admin/api/autorun/config` | Čitanje/pisanje `autorun.json` (provjerava pozivni znak, lokator, kombinacije pojas/način rada, ograničenje mjesta). |
| `GET /admin/api/autorun/status` | Stanje rada (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Pokretanje (`taskset -c <auto> node autorun/index.js`) / `SIGTERM`. Raspon jezgri izvodi se iz procesora (vidi gore). |

> **Napomena:** nakon nadogradnje `admin_server.py` morate [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) kako bi se učitale nove autorun rute ili ažurirana matrica pojas/način rada. Daemon radi kao zaseban proces, pa preživljava ponovna pokretanja administratorske ploče.

---

## Stanje sustava (System Health)

Kartica na **Dashboardu**, osvježava se svakih 30 sekundi (ili s **↻ refresh**):

- **Prijamnici** — svaki prijamnik stanice (onaj na `public_port` i svaki iz `receivers.toml`): zelena točka i *on air, up 15h 5m* kad odgovara, crveni **OFF THE AIR** kad ne odgovara.
- **Disk i mape zapisa** — slobodan prostor na disku instalacije (narančasto od 80 % zauzeća, crveno od 90 %), i veličina `logs/`, `logproxy/` i svake `instances/<id>/logs/`.
- **Nedavna upozorenja** — ono što je nadzor upozorenja vidio od pokretanja ploče (vidi [Upozorenja](#upozorenja-e-pošta--telegram)), bez obzira je li poruka poslana.
- **Posljednji unos u crash.log** — najnoviji neprazni `crash.log` svih prijamnika, s datumom i zadnjih 12 redaka.

---

## Statistika posjetitelja

Stranica **Visitors** u bočnom izborniku (na telefonu: **☰ MENU → Visitors**, ili gumb **📈 VISITOR STATISTICS** na stranici Users) broji slušatelje stanice iz privatnih zapisa `logs/users_YYYY-MM-DD.jsonl` svakog prijamnika — kopija s IP adresama, koje javne stranice više ne prikazuju. Odaberite **Today**, **7**, **14** ili **31 days**.

- **Posjetitelji** (različite adrese), **sesije**, **sati slušanja** i **najviše slušatelja istodobno**.
- **Po danu** — iste četiri brojke za svaki dan.
- **Najprometniji sati** — kada su sesije počele, po UTC satu.
- **Zemlje** — posjetitelji po zemlji.
- **Dekoderi** — koliko je sesija koristilo koji dekoder (broji se iz redaka zapisa koji ga sadrže, dakle od ažuriranja poslužitelja).
- **Adrese** — 20 adresa s najviše *istodobnih* sesija prvo, zatim s najviše sesija; poplava veza poput one od 16. rujna 2026. odmah se vidi na vrhu (**AT ONCE** postaje crveno iznad 3). Svaki redak ima **BAN ▾** (8, 16 ili 24 sata).

Dani i sati su u UTC-u. Vlastiti dekoderi stanice (lokalne veze) se ne broje; sesija koja je još otvorena broji se najviše 12 sati. Imena nisu u tim zapisima, pa stranica prikazuje adrese, a ne imena. Brojke se ponovno izračunavaju najviše jednom u minuti.

---

## Upozorenja (e-pošta / Telegram)

**Settings → Alerts — Email / Telegram.** Nadzor unutar administratorske ploče svakih 30 sekundi provjerava:

| Događaj | Kada |
|---|---|
| **off the air** | prijamnik ne odgovara otprilike minutu (dvije provjere zaredom) |
| **back on air** | ponovno odgovara |
| **restarted** | odgovara kao novi proces — ponovno pokrenut od watchdoga, skripte za pokretanje ili thermal guarda |
| **thermal guard** | guard mijenja stupanj (normal / warn / throttle / stopped) |
| **crash.log** | `crash.log` bilo kojeg prijamnika dobije novi unos; poruka sadrži njegove zadnje retke |

Svaki događaj ima svoj kvadratić. Isto upozorenje šalje se najviše jednom u 5 minuta. Prva provjera nakon pokretanja ploče samo upoznaje trenutno stanje, pa ponovno pokretanje ploče ne šalje ništa.

**Telegram** (najjednostavnije):

1. U Telegramu otvorite **@BotFather**, pošaljite `/newbot` i slijedite korake; dobit ćete **bot token** (`123456789:AA…`).
2. Otvorite svog novog bota i pritisnite **Start** — bot vam prije toga ne može pisati.
3. Otvorite **@userinfobot**; **Id** koji odgovori vaš je **chat ID**.
4. Označite **TELEGRAM**, zalijepite oboje, pritisnite **✉ SEND TEST**.

**E-pošta:** označite **EMAIL** i upišite SMTP poslužitelj svog pružatelja, port i zaštitu (SSL na 465, STARTTLS na 587), korisnika, lozinku i **TO**. **FROM** može biti puna adresa, `Ime <adresa>`, ili samo ime — samo ime prikazuje se kao ime pošiljatelja na adresi iz **USER**, pa tada korisnik mora biti puna adresa.

**✉ SEND TEST** najprije spremi obrazac, zatim šalje; redak ispod gumba prikazuje odgovor svakog kanala, ili što još nedostaje. Postavke se čuvaju u `admin_config.json` pod `"alerts"` — privatnoj datoteci ploče, nikad dijelu sigurnosne kopije ili ažuriranja. Spremljena lozinka ili token prikazuju se kao `********` i ostaju kakvi jesu dok ne upišete nove.

---

## Prijemnici

**Receivers** u lijevom izborniku (na telefonu: **📡 RX** u donjoj traci) prikazuje svaki prijemnik stanice — iz `receivers.toml`, ili samo glavni na stanici s jednim prijemnikom — s njegovim imenom, imenom `?rx=`, hardverom i njegovim pojačanjem, opsegom koji pokriva i njegovim središtem, širinom pojasa, frekvencijom i načinom rada s kojima počinje novi slušatelj, i je li u eteru. Svaki prijemnik ima svoje gumbe:

| Gumb | Što radi |
|---|---|
| **✎ CHANGE SETTINGS** | obrazac opisan niže |
| **■ STOP** / **▶ START** | zaustavlja samo ovaj prijemnik (prvo pita; ostali rade dalje), ili ga ponovno pokreće. Pokretanje traje oko 20 sekundi; gumb piše *STARTING …* dok prijemnik ne bude u eteru |
| **🏷 RENAME BUTTON** | samo na prijemniku bez obrasca za promjenu: ime na njegovom gumbu za odabir, spremljeno u `receivers.toml`; ništa se ne pokreće ponovno |
| **🗑 DELETE** | samo na dodatnom prijemniku koji nije zadani — vidi niže |

**✎ CHANGE SETTINGS na dodatnom prijemniku koji se ugađa** (jednom u `instances/<ime>/`): unesite središnju frekvenciju u MHz, odaberite širinu pojasa među brzinama uzorkovanja koje taj hardver može, i odredite gdje počinje novi slušatelj, u kojem načinu rada, njegovo pojačanje i ime na njegovom gumbu; obrazac pokazuje novi opseg prije nego ga primijenite. Frekvencija koju hardver ne može ugoditi, brzina uzorkovanja koju ne može, ili početna frekvencija izvan novog opsega odbijaju se. **✔ APPLY AND RESTART THIS RECEIVER** tada:

- postavlja `-f`, `-s` i pojačanje u `instance.env`, te `frequency`, `sps`, `fft_size` i početnu frekvenciju i način rada u `config.toml` — korekcija kristala (`frequency` nekoliko Hz od `-f`) zadržava se kao ista pogreška u ppm, pa ostaje točna i na novom pojasu, a `fft_size` se skalira da vodopad zadrži razlučivost
- postavlja `siteSDRBaseFrequency` i `siteSDRBandwidth` u `www/site_information.json` — stranica prijemnika čita ga kad se otvori, pa se ništa ne gradi ponovno
- postavlja ime gumba u `receivers.toml`; ime prijemnika u imenicima i ime hardvera ostaju kakvi jesu
- čuva stare datoteke u `admin-backups/retune-<ime>-<datum>/` i ponovno pokreće **samo taj prijemnik** — njegovi slušatelji prekinuti su nekoliko sekundi, ostali ništa ne primjećuju

**✎ CHANGE SETTINGS na glavnom prijemniku i na prijemniku s izravnim uzorkovanjem** (RX888, Fobos HF — pokriva od 0 Hz do polovice brzine uzorkovanja i nema što ugađati): obrazac ima ime na njegovom gumbu, početnu frekvenciju, način rada i pojačanje. Početna frekvencija i način rada idu u njegov `.toml`, ime u `receivers.toml`, a stare datoteke u `admin-backups/settings-<ime>-<datum>/`. **✔ APPLY** ponovno pokreće taj prijemnik samo kad su se promijenili početna frekvencija, način rada ili pojačanje; s glavnim prijemnikom ponovno se pokreću i RADE i DRM. Sam pojas glavnog prijemnika mijenja se s `bash configure-station.sh`: njegova stranica nosi pojas iz builda, pa treba ponovno izgraditi stranicu, a čarobnjak ponovno pokreće servise sa sudo. Na stanici s jednim prijemnikom bez `receivers.toml` nema gumba za odabir, pa nema ni imena za postaviti.

**AT VOLUME (0 – 100 %)**, u oba obrasca, položaj je klizača glasnoće s kojim slušatelj počinje pri prvom posjetu; upisuje se u `.toml` prijemnika kao `volume` pod `[input.defaults]`. Ostane li prazno, redak se uklanja i stranica počinje na 50 %. Slušatelj koji je jednom pomaknuo klizač zadržava svoju postavku pri kasnijim posjetima. Promijenjena glasnoća ponovno pokreće taj prijemnik, kao i promijenjena početna frekvencija.

**IQ FOR LISTENERS**, **WIDE IQ** i **WIDE IQ LISTENERS AT ONCE**, u oba obrasca, IQ su postavke prijemnika: `iq`, `iq_wide` i `iq_wide_listeners` pod `[server]` u njegovoj `.toml` datoteci (vidi odjeljak o širem IQ-u u Korisničkom priručniku). *off* skriva gumb IQ od slušatelja. Široki IQ nudi 24 ili 48 kHz, uz 12 kHz koje dobivaju svi, onolikom broju slušatelja odjednom koliko kaže posljednje polje (`0` = bez ograničenja). Upisuje se samo postavka koju promijenite, a redak-primjer poput `# iq_wide=48` postaje pravi redak. Poslužitelj čita ove postavke samo pri pokretanju, pa promijenjena IQ postavka ponovno pokreće taj prijemnik.

Na svakom prijemniku promjena samo imena ništa ne pokreće ponovno.

**Pojačanje.** Za RX888 obrazac ima VGA pojačanje (0–127), način pojačanja (low/high), prigušenje (0–63) i **PGA on**; za RTL-SDR RF pojačanje među koracima koje tuner podržava, ili *auto* (vlastiti AGC sticka). Upisuju se u redak argumenata prijemnika — `RX888_ARGS` ili `RX_ARGS` — u `instances/<ime>/instance.env` za dodatni prijemnik, i u `main.env` za glavni. `main.env` je `instance.env` glavnog prijemnika: svaka startna skripta čita ga posljednjeg, nije u gitu i `update.sh` ga nikad ne zamjenjuje. Pojačanje ne može biti u `station.conf`, jer `configure-station.sh` tu datoteku ponovno piše. Bez `main.env` startna skripta zadržava ugrađeno pojačanje (`-g 50 -a 0 -m low --pga` za RX888). Ostali tipovi prijemnika imaju pojačanje u istom retku argumenata; promijenite ga ondje ručno.

**🗑 DELETE** trajno uklanja dodatni prijemnik. Upišite njegovo kratko ime za potvrdu; tada zaustavlja taj prijemnik (najprije watchdog) i ne ide dalje dok još radi neki njegov proces, vadi njegov blok `[[receiver]]` iz `receivers.toml` (stara datoteka ide u `admin-backups/deleted-<ime>-<datum>/`), i premješta onamo i njegovu mapu `instances/<ime>/` — ili briše mapu ako odznačite *keep a copy*. Njegov gumb nestaje sa stranica; upravljački program i njegova log datoteka `logwebsdr-<ime>.txt` ostaju.

Proxy ponovno čita `receivers.toml` kad god se promijeni, pa preimenovanje, brisanje ili dodani prijemnik stižu do slušatelja bez ponovnog pokretanja proxyja. Otvorene stranice ponovno čitaju popis prijemnika svakih 15 sekundi, pa gumb zaustavljenog prijemnika nestaje i vraća se sam.

**➕ ADD NEW RECEIVER** otvara obrazac s pitanjima skripte `add-receiver.sh`: vrsta prijemnika (s *RTL-SDR Blog V4* za RTL stick), središnja frekvencija, širina pojasa, kratko ime (predloženo prema pojasu i provjereno da je slobodno), ime na njegovu gumbu, njegova antena i javna adresa stanice, te treba li instalirati upravljački program, prikazati izbor prijemnika i na glavnoj stranici, postaviti `start-all.sh` kao skriptu za pokretanje ove ploče, pokrenuti prijemnik i ponovno pokrenuti proxy. Iznad toga stranica prikazuje USB prijemnike koje ovo računalo vidi, da znate da je stick priključen. **▶ PREPARE** provjerava odgovore, sprema ih u `instances/.add-rx.env` i daje dva retka za terminal, svaki s **📋 COPY**:

```bash
cd ~/PhantomSDR-Plus
./add-receiver.sh --answers instances/.add-rx.env
```

Skripta uzima svaki odgovor iz te datoteke i traži samo vašu sudo lozinku (trebaju je upravljački program i ponovno pokretanje proxyja — administratorska ploča nikad ništa ne pokreće kao root), a zatim briše datoteku. Nakon toga ponovno učitajte stranicu i novi prijemnik je na popisu. `--answers DATOTEKA` radi i samostalno: jedan `ADD_RX_…=vrijednost` po retku; imena su navedena na vrhu `add-receiver.sh`.

---

## Postavke — portovi, pokretanje/zaustavljanje i HTTPS

**PORTS**, ispod **🔑 UPDATE PASSWORD**, navodi svaki port koji ova stanica koristi — javni port, https (443/80) ako je postavljen, spectrumserver svakog prijemnika, administratorsku ploču, statistiku, RADE, DRM i relej — pročitane iz `admin_config.json`, `station.conf` i `receivers.toml`, istih datoteka koje čita `proxy.py`. Zeleni ● znači da nešto upravo sluša na portu, ○ da ništa ne sluša. Na routeru treba proslijediti samo portove označene s *open on the router*; ostali ostaju na ovom računalu i dostupni su preko javnog porta. Usluge koje nisu instalirane ne prikazuju se.

**SPECTRUMSERVER PORT (MAIN RECEIVER)** je `public_port`: port na kojem sluša spectrumserver glavnog prijemnika — 9001 iza `proxy.py` na stanici postavljenoj s `install.sh`. To **nije** port slušatelja; on je prikazan samo za čitanje ispod polja kao **Listener port (proxy)** (`proxy_port`), ili kao *none* na stanici bez proxyja, gdje su oba ista. **💾 SAVE SETTINGS** provjerava broj: vlastiti port proxyja se odbija, a port različit od `[server] port` prijemnika koji radi najprije traži potvrdu — s pogrešnim brojem `proxy.py` od svog sljedećeg ponovnog pokretanja šalje slušatelje na port na kojem ništa ne odgovara. Da biste spectrumserver stvarno premjestili, upišite isti broj u `[server] port` u `.toml` prijemnika, u njegov redak u `receivers.toml` i u ovo polje, a zatim ponovno pokrenite prijemnik i proxy.

**▶ START** i **■ STOP**, pokraj **DEFAULT START SCRIPT** i **DEFAULT STOP SCRIPT**, odmah pokreću **spremljenu** skriptu, nakon potvrde — obje prekidaju vezu svim slušateljima. Ako ste promijenili odabir, najprije spremite: gumb odbija nespremljeni. Prve sekunde izlaza pojavljuju se ispod gumba; cijeli izlaz tih skripti, i ponovnih pokretanja koja radi thermal guard, ide u `logs/admin-scripts.log`.

**HTTPS** pokazuje radi li stanica preko https-a.

- Na https stanici **🔍 CHECK** pokreće `setup-https.sh --status`: radi li Caddy i odgovara li certifikat?
- Na stanici samo s http-om **🔒 SET UP HTTPS** provjerava što može — `station.conf`, razrješava li se vaše DNS ime (IP adresa ne može dobiti certifikat), jesu li portovi 443 i 80 slobodni ili već Caddyjevi —, podsjeća vas da na routeru proslijedite TCP 443 i 80, i daje dva retka za terminal, svaki s **📋 COPY**. Tamo `setup-https.sh` traži vašu sudo lozinku: administratorska ploča nikad ništa ne pokreće kao root. Kad završi, ponovno učitajte stranicu i gumb postaje **CHECK**. Vidi [Siguran pristup — https://](HTTPS.md).

---

## Sigurnosna kopija i vraćanje postavki stanice

**Settings → Backup & restore of the station settings.**

**⬇ DOWNLOAD BACKUP** daje jedan zip, `phantomsdr-settings-<pozivni>-<datum>.zip`, s vlastitim postavkama ove stanice:

- svaki `*.toml` instalacije (konfiguracije prijamnika i `receivers.toml`) i `station.conf`
- `frontend/site_information.json`, `frontend/src/bands-config.js`, `markers.json`
- `autorun.json` (spot reporting), `websdr_relay.json`, `drm.json`, `admin_bans.json`
- za svaki dodatni prijamnik: `instances/<id>/config.toml`, `instance.env`, `markers.json`

i `BACKUP-INFO.json` s datumom, računalom i popisom datoteka. **Nije** uključeno: `admin_config.json` (administratorska lozinka, tajne upozorenja), zapisi i sam program.

**⬆ RESTORE** uzima zip sigurnosne kopije i vraća **samo** datoteke s tog istog popisa — sve ostalo u zipu se preskače i navodi. Prije nego što se datoteka zamijeni, trenutna se kopira u `admin-backups/restore-<datum-vrijeme>/` (git je zanemaruje, nikad u ažuriranju), pa se pogrešno vraćanje može poništiti ručno. Odgovor kaže što dalje: ponovno pokrenuti prijamnike nakon `.toml`, `instance.env` ili `station.conf`; ponovno izgraditi stranicu (`./recompile.sh --frontend`) nakon site information ili postavki opsega; ponovno pokrenuti `phantomsdr-websdr-relay` nakon postavki releja.

---

## Na telefonu ili tabletu

Ispod 768 piksela širine lijevi izbornik postaje ladica. Donja traka ima **DASH**, **RX** (Receivers), **USERS**, **GRAPHS**, **LOGS** i **☰ MENU**, koji uvlači cijeli izbornik sa svim stranicama; zatvara se kad odaberete stranicu ili dodirnete pokraj njega, a **MENU** ostaje istaknut dok ste na stranici koje nema u traci. Na telefonu tablice postaju jedna kartica po retku (popis prijemnika već na tabletu, do 1100 piksela), obrasci prelaze u jedan stupac, a siva bilješka naslova kartice ide ispod naslova. Top Processes, uređivač Markers i mreža pojas/način rada u Spot Reporting ostaju tablice i pomiču se ustranu.

---

## Teme

Izbornik **THEME** nalazi se u gornjoj traci svake stranice, između **ONLINE** i sata, i ponovno u **Settings → Appearance**; oba uvijek pokazuju isti izbor. Tema se primjenjuje odmah, bez ponovnog učitavanja.

| Tema | Izgled |
|---|---|
| **Phosphor green** | klasični zeleni terminal (zadano) |
| **Amber display** | isto u toplom jantaru, poput zaslona starog uređaja |
| **Metal panel** | sivi eloksirani izgled stranice prijamnika, osvijetljen odozgo desno |
| **Modern dark** | antracit s plavim naglaskom, bez sjaja |
| **Light** | bijelo i sivo, crni tekst — za dnevno svjetlo |
| **Auto (day/night)** | **Light** od izlaska do zalaska sunca, **Modern dark** noću |

Sve teme koriste iste fontove i iste veličine; mijenjaju se samo boje i završna obrada. *On air* ostaje zeleno, a upozorenja narančasta i crvena u svakoj temi, i **Graphs** također prate temu. **Auto** izračunava izlazak i zalazak sunca na lokatoru stanice (`siteGridSquare` u Site Info) i sam se prebacuje dok je stranica otvorena; bez lokatora danom smatra 07:00–19:00 po lokalnom vremenu. Izbor se čuva po pregledniku, pa računalo i telefon mogu imati različite teme. Stranica za prijavu zadržava zeleni izgled.

---

## Rješavanje problema

| Problem | Rješenje |
|---|---|
| Administratorska ploča se ne pokreće | Provjerite `admin.log` — obično nedostaje Python paket |
| Proxy se ne pokreće | Izvršite `python3 -c "import aiohttp"` — ako ne uspije: `pip3 install aiohttp --break-system-packages` |
| Fedora / openSUSE: ploča ili proxy se ne pokreće pri podizanju sustava (`status=209/STDOUT`, `avc: denied { open } … admin.log` ili `proxy.log` u `sudo ausearch -m avc -ts boot`) | SELinux ne dopušta systemdu otvaranje datoteka zapisa u vašoj kućnoj mapi. Pokrenite `./setup_admin.sh --selinux` (oba zapisa označava kao `var_log_t`), zatim `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Nove instalacije to rade automatski |
| Fedora / openSUSE: sve radi, ali nitko izvan ovog računala ne može se spojiti | firewalld odbacuje javni port. Pokrenite `./setup_admin.sh --firewall` (trajno otvara port proxyja). Nove instalacije to rade automatski; `setup_websdr_relay.sh` to nudi za port relaya, a `setup-https.sh` otvara 443/80 |
| `systemctl is-active` ostaje na `activating`, zapis kaže `address already in use` | Kopija pokrenuta ručno s `manage_admin.sh start` još drži port. `./manage_admin.sh stop`, zatim `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Kad su jedinice instalirane, `manage_admin.sh start` sada pokretanje prepušta systemctlu umjesto da pokrene drugu kopiju |
| `proxy.log` je prazan | Prvo provjerite radi li proxy uopće (`./manage_admin.sh status`). Ako radi, imate staru verziju: pokretač mora koristiti `python3 -u` (bez međuspremnika — inače natpis pri pokretanju nikad ne napusti međuspremnik od 8 KB), a `main()` u `proxy.py` mora pozvati `logging.basicConfig()` (inače aiohttpov zapisivač pristupa nema rukovatelja i svaki se redak zahtjeva odbacuje, jer `web.AppRunner` — za razliku od `web.run_app` — ne konfigurira zapisivanje). |
| Proxy se pokreće, ali je slap prazan | Provjerite `sdr_host` u `admin_config.json` — uobičajeno `127.0.0.1`. Ako još sadrži stari LAN IP iz prethodne verzije, promijenite ga i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) |
| Gumb Kick javlja „no connections" | Izvršite `getcap $(which ss)` — ako nema `cap_net_admin`, izvršite `sudo setcap cap_net_admin+ep $(which ss)` |
| Stanje uvijek prikazuje OFFLINE | Idite na Settings → SDR Process Name i unesite točan naziv koji prikazuje `ps -eo comm,args \| grep -v grep` |
| Stranica Users ne prikazuje podatke | Provjerite radi li krajnja točka: `curl http://127.0.0.1:<public_port>/~~users` |
| Vanjski preglednik javlja NetworkError | Provjerite radi li proxy: `./manage_admin.sh status` |
| Proxy se pokvario nakon promjene mreže | Odnosi se samo na slučaj kad `sdr_host` još sadrži LAN IP — postavite ga na `127.0.0.1` i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) |
| Gumb za brisanje razgovora nema učinka | Provjerite pravo pisanja u datoteku zapisnika razgovora: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Poruka na slapu se ne pojavljuje | Potvrdite da proxy radi (`./manage_admin.sh status`) i da je sučelje iz novije verzije koja uključuje iscrtavanje preklopa |
| Poruka na slapu izgubljena nakon ponovnog pokretanja | Očekivano — stanje poruke je samo u memoriji; pošaljite je ponovno nakon ponovnog pokretanja ploče |
| „Start" u Spot Reportingu ne uspijeva / daemon se odmah gasi | Provjerite `autorun.log`. Obično nedostaje simbolička poveznica `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) ili nije instaliran `taskset` (`sudo apt install -y util-linux`). |
| Spot Reporting: daemon radi, ali `decodes` ostaje 0, a `autorun.log` pokazuje `504` / `tap closed 1006` | Audio odvod ne može doseći spectrumserver. Daemon automatski otkriva port iz konfiguracije **pokrenutog** poslužitelja; redak zapisnika `[autorun] tap backend: HOST:PORT` mora odgovarati vašem `[server] port`. Ako nije točan (ili poslužitelj nije radio pri pokretanju), zadajte ga u `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9001 }`, zatim Stop→Start. |
| **SAVE CONFIG** odbijen: „N slots at once exceeds cap of M (UTC hour …)" | MAX SLOTS ograničava slotove koji rade istodobno. Povećajte ga ili u SCHEDULE uklonite sate gdje je redak AT ONCE crven. |
| Spot Reporting se nije pokrenuo nakon ponovnog pokretanja | **Start automatically after a reboot or crash** mora biti označeno i spremljeno, a **STOP** vrijedi do **START** (kartica stanja kaže `ON, held by STOP`). AUTORUN log prikazuje svaki redak `[admin …] autostart:`; sama ploča mora raditi (`sudo systemctl status phantomsdr-admin`). |
| Spot Reporting prikazuje „0 sent" | Normalno prvih nekoliko minuta — PSK Reporter šalje svakih 5 min, wsprnet svake 2 min. Provjerite je li uključeno odredište i radi li daemon. |
| Novi pojasevi/načini rada ne prikazuju se u matrici | [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) — matrica se učitava pri pokretanju ploče. |
| `autorun.log` prikazuje `MODULE_TYPELESS_PACKAGE_JSON` / „Reparsing as ES module … performance overhead" | Kozmetičko upozorenje (dekodiranje i dalje radi). U `frontend/src/modules/package.json` nedostaje `"type": "module"`; dodajte taj redak pri vrhu, zatim Stop→Start. Ponovna izgradnja sučelja nije potrebna — daemon izravno uvozi izvornu datoteku. |
| „Start" u Spot Reportingu ne uspijeva uz `taskset: … Invalid argument` na starom/malom računalu | Ne bi se trebalo događati s pokretačem svjesnim konfiguracije — raspon jezgri izvodi se iz broja procesora i na ≤ 4 jezgre radi bez vezanja. Ako se dogodi, vaš `admin_server.py` stariji je od te promjene; ažurirajte ga (`_autorun_taskset_prefix`) i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče). |
| Oznaka REPORTING ne pojavljuje se na slapu | Prijavljivanje mora biti uključeno s barem jednim mjestom; oznaka čita `/autorun-active.json`. Ponovno izgradite sučelje ako je `dist/index.html` stariji od oznake. |
| **✉ SEND TEST** kaže "Nothing to send to: …" | Poruka kaže što nedostaje: označite **TELEGRAM** ili **EMAIL**; Telegram treba i bot token i chat ID; e-pošta treba SMTP poslužitelj i **TO**. |
| Proba e-pošte: `5.5.2 … Sender address rejected: need fully-qualified address` | Pošiljatelj nije puna adresa. Upišite svoju adresu u **FROM**, ili tamo ostavite samo ime i neka **USER** bude vaša puna adresa; [ponovno pokrenite ploču](#ponovno-pokretanje-ploče) ako je stariji od tog pravila. |
| Proba Telegrama ne uspije s `Forbidden` / ne stiže poruka | Najprije otvorite svog bota u Telegramu i pritisnite **Start**; provjerite chat ID s @userinfobot (vaš vlastiti Id, ne botov). |
| Nema upozorenja kad je prijamnik stao | Treba otprilike minuta (dvije provjere); isto upozorenje stiže najviše jednom u 5 minuta; ponovno pokretanje ploče ne šalje ništa; provjerite kvadratić događaja. |
| Stranica Visitors prikazuje "no visitors" | Stranica čita `logs/users_*.jsonl` (i `instances/<id>/logs/`); njih piše bilježenje statistike prijamnika — provjerite postoje li za odabrane dane. |
| Nedostaje izbornik THEME, ili nova tema ne djeluje | [Ponovno pokrenite ploču](#ponovno-pokretanje-ploče), zatim ponovno učitajte stranicu s **Ctrl+F5** da preglednik odbaci staru kopiju. |
