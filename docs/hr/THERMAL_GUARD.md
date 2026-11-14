# Thermal Guard — Priručnik za sysopa

**Zaštita od pregrijavanja procesora za PhantomSDR-Plus.**

WebSDR je jedna od rijetkih stvari koje drže svaku jezgru zaposlenom, cijeli dan, zauvijek. Ako se ventilator začepi, pumpa stane ili se prostorija u kolovozu pregrije, nitko vam to neće reći — poslužitelj jednostavno nastavlja dekodirati dok se procesor ne skuha. Thermal guard je dio koji to primijeti i izvuče utikač umjesto vas.

Isporučuje se **neaktivan**: iz kutije samo zapisuje u dnevnik. Ništa nije zaštićeno dok ne odaberete način rada. Ovaj priručnik govori o tome kako donijeti tu odluku i živjeti s njom.

> **Žurite se?** Pokrenite `python3 thermal_guard.py --once`, pročitajte pragove koje ispiše i postavite `thermal_mode` na `stop+restart` u administratorskoj ploči. To je cijeli posao. Sve ostalo niže je *zašto*.

---

## Sadržaj

1. [Što radi](#1-što-radi)
2. [Brzi početak](#2-brzi-početak)
3. [Kako odlučuje](#3-kako-odlučuje)
4. [Četiri načina rada — što svaki radi i što vi morate učiniti](#4-četiri-načina-rada)
5. [Odabir načina rada](#5-odabir-načina-rada)
6. [Referenca postavki](#6-referenca-postavki)
7. [Rad bez administratorske ploče](#7-rad-bez-administratorske-ploče)
8. [Uključivanje throttle faze bez roota](#8-uključivanje-throttle-faze-bez-roota)
9. [Rad bez nadzora — kad nitko ne gleda](#9-rad-bez-nadzora)
10. [Isprobajte ga prije nego mu povjerite stroj](#10-isprobajte-ga-prije-nego-mu-povjerite-stroj)
11. [Čitanje dnevnika](#11-čitanje-dnevnika)
12. [Lockout i ograničenje broja zaustavljanja](#12-lockout-i-ograničenje-broja-zaustavljanja)
13. [Rješavanje problema](#13-rješavanje-problema)
14. [Isključivanje ili uklanjanje](#14-isključivanje-ili-uklanjanje)

---

## 1. Što radi

Svake 2 sekunde čuvar čita temperaturu jezgre procesora i uspoređuje je s četiri praga. Kad temperatura dovoljno dugo ostane iznad nekog od njih, penje se ljestvama:

```
   normalno ──►  warn  ──►  throttle  ──►  stop  ──►  (hlađenje)  ──►  restart
               redak u    snižavanje    pokretanje    poslužitelj    pokretanje
               dnevniku   takta         stop skripte  ostaje ugašen  start skripte
```

---

## 2. Brzi početak

**1. Pogledajte kako vaš stroj izgleda čuvaru.** Uvijek prvo ovo:

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 65.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

Ako `sensor` kaže `NONE`, stanite ovdje i pročitajte [Rješavanje problema](#13-rješavanje-problema) — čuvar ne može zaštititi stroj koji ne može izmjeriti, i to će vam reći umjesto da se pretvara.

**2. Ostavite ga nekoliko dana u načinu `log`.** Već radi unutar administratorske ploče. Neka promatra jedan normalan tjedan — ljetna popodneva, veliko prevođenje, prometnu subotu s natjecanjem — i vidite bi li se ikad oglasio.

**3. Naoružajte ga.** Administratorska ploča → **Settings** → **THERMAL GUARD** → **MODE** → `stop+restart` → 💾 **SAVE THERMAL SETTINGS**. Vrijedi za otprilike 2 sekunde; ponovno pokretanje nije potrebno.

---

## 3. Kako odlučuje

### Senzor

Čuvar vjeruje samo stvarnim senzorima na jezgri procesora:

| Izvor | Tipičan hardver |
|---|---|
| `coretemp` | Intel |
| `k10temp`, `zenpower`, `zenpower3` | AMD |
| `cpu_thermal`, `soc_thermal` | Raspberry Pi, ARM pločice |
| Toplinska zona `x86_pkg_temp` | rezerva na x86 |

### Pragovi

Svaki je odmak ispod kritičnog praga koji stroj sam objavljuje:

| Prag | Odmak ispod crit | Značenje |
|---|---|---|
| warn | −12 °C | Nešto nije u redu, zabilježi |
| throttle | −8 °C | Pokušaj hlađenja usporavanjem procesora |
| stop | −5 °C | Preblizu rubu — zaustavi poslužitelj |
| resume | −25 °C | Doista opet hladno, povratak je siguran |

U praksi to izgleda ovako:

| Vaš procesor prijavljuje | warn | throttle | **stop** | resume |
|---|---|---|---|---|
| Intel, crit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, crit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, crit 85 °C | 73 | 77 | **80** | 60 |

Ako stroj uopće ne objavljuje kritičnu točku, čuvar se vraća na konzervativan fiksni skup i to izrijekom kaže. Svaki prag možete nadjačati apsolutnom vrijednošću (vidi [Referencu postavki](#6-referenca-postavki)), ali ne biste trebali morati.

### Vremena zadržavanja — zašto vršak nikad ne djeluje

Ništa se ne događa na temelju jednog vrućeg očitanja. Prag mora biti zadržan **neprekidno**:

- **warn** i **throttle**: 30 s (`thermal_warn_sustain_s`)
- **stop**: 60 s (`thermal_sustain_s`)
- **resume**: 300 s ispod praga povratka prije ponovnog pokretanja (`thermal_resume_s`)

---

## 4. Četiri načina rada

`thermal_mode` jedini je prekidač koji određuje koliko se visoko čuvar smije popeti ljestvama. Svaki način **uključuje sve što rade prethodni**.

| Način | Upozorava | Usporava | Zaustavlja | Ponovno pokreće | Može li poslužitelj pasti? |
|---|:--:|:--:|:--:|:--:|---|
| `log` | ✓ | — | — | — | Ne — ništa ne dira |
| `throttle` | ✓ | ✓ | — | — | Ne |
| `stop` | ✓ | ✓ | ✓ | — | Da, ostaje ugašen dok ne reagirate |
| `stop+restart` | ✓ | ✓ | ✓ | ✓ | Da, vraća se sam |

---

### `log` — promatraj i izvijesti (tvornička postavka)

**Što radi:** sve što rade i ostali načini, samo bez djelovanja. Prolazi cijelim ljestvama i u `crash.log` zapisuje što bi *bio* učinio. Nikad ne pokreće vašu stop skriptu, ne dira takt procesora, ne prekida nijednog slušatelja.

**Što morate učiniti:** ništa — već radi. Nakon tjedan dana otvorite karticu **CRASH** u ploči ili pokrenite:

```
grep THERMAL crash.log
```

- **Nema ničega?** Vaše hlađenje je u redu i čuvara možete mirno naoružati.
- **`STOP level reached ... NOT stopping`?** Čuvar bi vam bio ugasio poslužitelj. To je stvaran toplinski problem s kojim ste radili — popravite hlađenje *i* naoružajte čuvara.

**Koristite ga kad:** ste tek instalirali čuvara i još ne znate kako se vaš stroj ponaša. To je način za uhodavanje, a ne odredište — čuvar u načinu `log` ne štiti ništa.

---

### `throttle` — uspori procesor, nikad ne prekidaj uslugu

**Što radi:** na throttle pragu snižava najveću frekvenciju procesora za 20 %, a vraća je čim se temperatura vrati ispod linije upozorenja. Vaš WebSDR cijelo vrijeme ostaje na mreži. Slušatelji pod velikim opterećenjem možda primijete nešto slabije performanse; većina neće primijetiti ništa.

Ako temperatura ipak nastavi rasti preko praga zaustavljanja, ovaj način to **samo zabilježi i ne učini ništa** — neće zaustaviti poslužitelj.

**Što morate učiniti:**

1. Dati čuvaru pravo pisanja na ograničenje frekvencije procesora — treba mu, a po zadanome ga ima samo root. Jednom pokrenite `./setup-cpufreq-perms.sh`; vidi [odjeljak 8](#8-uključivanje-throttle-faze-bez-roota).
2. Provjeriti s `python3 thermal_guard.py --once` da ispisuje `cpufreq : writable, throttle stage available`. Ako piše *not writable*, ovaj način ne radi ništa više od `log`, i to će svaki put reći u dnevniku.

**Koristite ga kad:** tražite granični problem hlađenja i želite braniti stroj bez ijednog izgubljenog slušatelja. **Imajte na umu da to nije potpuna zaštita** — ako usporavanje nije dovoljno, ništa se drugo ne događa. Dobar kao prvi korak, loš kao konačan odgovor.

---

### `stop` — ugasi poslužitelj i ostavi ga ugašenim

**Što radi:** na pragu zaustavljanja pokreće vašu stop skriptu, a zatim drži **lockout** — ponovno zaustavlja poslužitelj svake 2 sekunde dok je stroj pregrijan, tako da ga ništa ne oživi iza vaših leđa. Kad procesor 5 minuta bude ispod praga povratka, lockout se otpušta. **Poslužitelj se ne vraća sam.** Vi ga pokrećete kad se uvjerite da je uzrok otklonjen.

**Što morate učiniti:**

1. Osigurati da čuvar zna kako zaustaviti vaš poslužitelj. U ploči je to podešena stop skripta (`./stop-websdr.sh` uz isporučene pokretače). Ako nije postavljena, čuvar se vraća na `SIGTERM` prema imenu procesa, pa `SIGKILL` nakon 10 sekundi počeka — radi, ali prava stop skripta je čišća.
2. Prihvatiti da će **vaš WebSDR biti izvan mreže dok to ne primijetite**. Osigurajte da doznate: nadzor dostupnosti, kartica CRASH ili jednostavno svakodnevna provjera.

**Koristite ga kad:** stroj vam je važniji od usluge, obično ste u blizini, ili je toplinski događaj dovoljno ozbiljan da želite pregledati stroj prije nego nastavi. Također pravi izbor ako ne vjerujete automatskom ponovnom pokretanju na svom hardveru.

---

### `stop+restart` — ugasi, ohladi se, vrati se sam

**Što radi:** sve što i `stop`, uz dodatak: kad procesor 5 minuta ostane ispod praga povratka, pokreće vašu start skriptu i WebSDR se vraća sam.

Lepršanje sprječava `thermal_max_stops_hour` (zadano 2). Nakon dva toplinska zaustavljanja unutar sat vremena čuvar **isključuje automatsko ponovno pokretanje** i ostavlja poslužitelj ugašenim da ga pogledate. Uočite važan detalj: ograničenje gasi *ponovno pokretanje*, nikad *zaštitu* — lockout i dalje zaustavlja poslužitelj dok je vruć, koliko god se puta već oglasio.

**Što morate učiniti:**

1. Osigurati da su **obje** skripte podešene i da doista rade samostalno — i start i stop. Isprobajte ih ručno: `./stop-websdr.sh`, pa `./start-rx888mk2.sh`.
2. Ništa više. Ovo je način „postavi i zaboravi“.

**Koristite ga kad:** je WebSDR javan, bez nadzora ili udaljen — dakle u većini slučajeva. To je preporučeni način za normalnu instalaciju.

---

## 5. Odabir načina rada

| Vaša situacija | Način |
|---|---|
| Tek ste instalirali čuvara, stroj još ne poznajete | `log` tjedan dana |
| Javni WebSDR, bez nadzora, treba se brinuti sam o sebi | **`stop+restart`** |
| Udaljena lokacija do koje teško dolazite | **`stop+restart`** |
| Želite pregledati stroj nakon svakog toplinskog događaja | `stop` |
| Hardver kojem ne vjerujete automatsko ponovno pokretanje | `stop` |
| Granično hlađenje, ne smijete gubiti slušatelje | `throttle`, pa dalje na `stop+restart` |
| Stroj bez pouzdanog senzora procesora | nijedan neće raditi — prvo riješite senzor |

---

## 6. Referenca postavki

Svi ključevi nalaze se u `admin_config.json` pokraj `thermal_guard.py`, a svaki od njih može se urediti i u **Settings → THERMAL GUARD**. Čuvar **ponovno čita datoteku u svakom ciklusu**, pa promjene vrijede unutar ~2 sekunde — bez ponovnog pokretanja.

| Ključ | Zadano | Značenje |
|---|---|---|
| `thermal_enabled` | `true` | Glavni prekidač. `false` potpuno isključuje čuvara. |
| `thermal_mode` | `"log"` | `log` \| `throttle` \| `stop` \| `stop+restart` — vidi [odjeljak 4](#4-četiri-načina-rada). |
| `thermal_warn` | `null` | Apsolutni prag upozorenja u °C. `null` = izvedi iz kritičnog praga. |
| `thermal_throttle` | `null` | Apsolutni throttle prag. `null` = izveden. |
| `thermal_stop` | `null` | Apsolutni prag zaustavljanja. `null` = izveden. |
| `thermal_resume` | `null` | Apsolutni prag povratka. `null` = izveden. |
| `thermal_sustain_s` | `60` | Sekunde zadržavanja praga zaustavljanja prije gašenja. Najmanje 5. |
| `thermal_warn_sustain_s` | `30` | Sekunde za faze upozorenja i throttlea. Najmanje 5. |
| `thermal_resume_s` | `300` | Sekunde ispod praga povratka prije otpuštanja lockouta. Najmanje 30. |
| `thermal_max_stops_hour` | `2` | Toplinska zaustavljanja na sat nakon kojih se gasi automatsko pokretanje. Zaštita se nastavlja. |
| `thermal_test_temp` | `null` | Pretvara se da je procesor na ovoj temperaturi. Samo za testiranje — vidi [odjeljak 10](#10-isprobajte-ga-prije-nego-mu-povjerite-stroj). |

Samostalni čuvar dodatno koristi `start_script`, `stop_script`, `sdr_process_name` i `sdr_base_dir` iz iste datoteke.

**Nadjačavanje praga.** Učinite to samo ako imate razlog. Čest je ovaj: vaš se stroj opravdano grije pri prevođenju i ne želite da se to broji. Podizanje `thermal_stop` kupuje vam prostor po cijenu odmaka od kritične točke — nikad ga ne postavljajte iznad svoje crit vrijednosti, inače će procesor prvi doći do vlastitog nužnog gašenja, a čuvar postaje ukras.

---

## 7. Rad bez administratorske ploče

Mnogi sysopi nikad ne instaliraju ploču. Čuvar sasvim dobro radi i sam — ista datoteka, isto ponašanje.

**Prvo ga isprobajte u prvom planu:**

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once            # što bi se ovdje dogodilo?
python3 thermal_guard.py --mode log        # gledajte uživo, Ctrl-C za izlaz
```

`--mode` nadjačava `thermal_mode` iz naredbenog retka, pa nikad ne morate ručno pisati JSON:

```
python3 thermal_guard.py --mode stop+restart
python3 thermal_guard.py --config /etc/phantomsdr/thermal.json
```

**Zatim ga učinite trajnim** pomoću ogledne jedinice isporučene u projektu:

```
sudo cp thermal-guard.service /etc/systemd/system/
sudo nano /etc/systemd/system/thermal-guard.service   # postavite User= i putanje
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Pročitajte komentare na vrhu `thermal-guard.service` prije nego je omogućite. Dvije stvari su najvažnije:

- **`User=` mora biti račun koji doista može pokrenuti vaše start i stop skripte.** Pokretanje čuvara kao root obično je pogrešan odgovor: tada bi i te skripte pokretao kao root.
- Ili ga uputite na `admin_config.json` koji sadrži `start_script` i `stop_script`, ili proslijedite `--mode` u retku `ExecStart`. Dovoljna je minimalna konfiguracija:

```json
{
  "sdr_base_dir": "/home/vaskorisnik/PhantomSDR-Plus",
  "sdr_process_name": "spectrumserver",
  "start_script": "start-rx888mk2.sh",
  "stop_script": "stop-websdr.sh",
  "thermal_mode": "stop+restart"
}
```

Sve što čuvar radi i dalje ide u `crash.log` pokraj te konfiguracijske datoteke, uz systemd journal (`journalctl -u thermal-guard`).

---

## 8. Uključivanje throttle faze bez roota

Po zadanome `python3 thermal_guard.py --once` javlja:

```
cpufreq    : not writable — throttle stage disabled
```

```
cd ~/PhantomSDR-Plus
./setup-cpufreq-perms.sh
```

Traži vašu lozinku jednom — i samo jednom, pri postavljanju — a zatim:

1. stvara sistemsku grupu `cpufreq` i dodaje vas u nju;
2. instalira `/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf` kako bi se grupa i prava `0664` ponovno primijenili **pri svakom pokretanju sustava** — prava u sysfs-u sama ne preživljavaju ponovno pokretanje;
3. primjenjuje promjenu odmah, da možete testirati bez ponovnog pokretanja.

Zatim, ovim redom:

```
# 1. odjavite se i ponovno prijavite (ili ponovno pokrenite sustav) — nova
#    grupa dolazi do vaših procesa samo kroz novu prijavu
id | grep cpufreq

# 2. ponovno pokrenite ploču; čuvar pravo pisanja provjerava jednom, pri pokretanju
sudo systemctl restart phantomsdr-admin
#    (ovako odjava nije potrebna — systemd iznova gradi popis grupa pri
#     svakom pokretanju. Samo ako jedinice NISU instalirane:
#     ./manage_admin.sh stop && ./manage_admin.sh start — nikad oboje, bore se za port 9010)

# 3. potvrdite
python3 thermal_guard.py --once
#    cpufreq    : writable, throttle stage available
```

Za potpuno poništavanje: `sudo ./setup-cpufreq-perms.sh --revoke`.

**Napomene**

- Throttle faza *djeluje* samo ako je `thermal_mode` `throttle` ili viši. Sama dozvola ne mijenja ništa.
- Čuvar snižava za 20 % ono ograničenje koje je *tada* na snazi i vraća točno tu vrijednost. Ako već ograničavate procesor (primjerice `MAX_SPEED` u `/etc/init.d/cpufrequtils`), vraća se vaše ograničenje — čuvar vam neće potiho vratiti viši takt od onoga koji ste tražili.
- Neki strojevi uopće ne izlažu cpufreq upravljački program — mnogi VPS-ovi, većina kontejnera. Skripta to prepoznaje i ne mijenja ništa. Tamo koristite `stop` ili `stop+restart`; oni ne ovise o cpufreq-u.

---

## 9. Rad bez nadzora

Najčešće pitanje o čuvaru: *što se događa kad nitko ne gleda?* Kratak odgovor: upravo je za taj slučaj i napravljen.

**Djeluje bez pitanja.** Nema dijaloga za potvrdu ni obavijesti koju treba čekati. Na pragu zaustavljanja zaustavlja poslužitelj, i točka. Upravo je to smisao.

**Kako ćete saznati poslije.** Otprilike po korisnosti:

| Gdje | Što dobivate |
|---|---|
| `crash.log` / kartica **CRASH** | Svaki postupak, s vremenskom oznakom. Trajni zapis. |
| Kartica **THERMAL GUARD** na nadzornoj ploči | Stanje uživo: temperatura, faza, lockout, zaustavljanja u zadnjem satu. |
| Stranica **Graphs** (temperatura procesora, 24 h) | Oblik događaja — koliko brzo je rasla, koliko je trajalo hlađenje. |
| `journalctl -u thermal-guard` | Samo u samostalnom načinu. |

Razumna rutina za lokaciju bez nadzora: naoružan `stop+restart` i `grep THERMAL crash.log` kad se ionako prijavite. Ako je prazno, nema se što doznati.

---

## 10. Isprobajte ga prije nego mu povjerite stroj

Nemojte čekati pravi toplinski val da biste doznali radi li vaša stop skripta.

**`thermal_test_temp`** navodi čuvara da vjeruje kako je procesor na temperaturi koju vi odaberete. Sve ostalo ponaša se posve normalno — vremena zadržavanja, ljestve, lockout, vaše stvarne skripte.

1. Ploča → **Settings** → **THERMAL GUARD** → **TEST TEMPERATURE**.
2. Unesite vrijednost iznad svog praga zaustavljanja (primjerice `97` na Intelu).
3. Spremite i pratite karticu na nadzornoj ploči te karticu CRASH.
4. **Ispraznite polje kad završite.** Zaostala testna temperatura znači da čuvar više ne čita stvarni senzor.

U načinu `log` ovo vam pokazuje cijele ljestve bez ikakvog rizika — siguran prvi test i onaj koji treba obaviti prije naoružavanja bilo čega.

U načinu `stop+restart` ovo je **test uživo**: vaš će se poslužitelj doista zaustaviti i doista vratiti otprilike pet minuta nakon što ispraznite polje. Učinite to kad nitko ne sluša. Vrijedi to obaviti jednom, jer je to jedini način da znate da vaše stop i start skripte rade kad ih pozove nešto drugo, a ne vi.

Istovrijednice u samostalnom načinu:

```
python3 thermal_guard.py --once                 # samo pragovi, bez djelovanja
python3 thermal_guard.py --mode log             # gledanje ljestava uživo
```

---

## 11. Čitanje dnevnika

Sve se dodaje u `crash.log` pokraj konfiguracijske datoteke, jedan događaj po retku, svaki s prefiksom `[THERMAL]`:

```
grep THERMAL crash.log
```

Reci su namjerno jednoretčani i prikladni za grep. Što ćete vidjeti:

| Redak | Značenje |
|---|---|
| `warn: 88.4C (warn=88.0 crit=100) sustained 30s` | Prva prečka. Ništa nije učinjeno. |
| `throttle: 92.1C sustained 30s — cpufreq max lowered 20%` | Takt procesora snižen. |
| `throttle level reached: ... (no cpufreq write access — stage skipped)` | Vidi [odjeljak 8](#8-uključivanje-throttle-faze-bez-roota). |
| `STOP level reached: ... mode is 'log', NOT stopping` | Bio bi zaustavio poslužitelj. Naoružajte ga. |
| `STOPPED server: 95.2C sustained 60s (stop=95.0 crit=100) — ran stop-websdr.sh` | Pravi slučaj. |
| `lockout: process reappeared at 96.0C — re-stopped (...) [12 time(s) so far]` | Nešto ponovno pokreće vaš poslužitelj; čuvar pobjeđuje. Ograničeno na jedan redak u minuti. |
| `rate limit: 2 thermal stops within the hour — automatic restart is now DISABLED` | Ostaje ugašen da istražite. Zaštita se nastavlja. |
| `recovered: 54.0C held below 75.0 — lockout cleared` | Opet hladno. |
| `auto-restart: ran start-rx888mk2.sh` | Ponovno na mreži. |
| `back to normal: 59.0C (warn=88.0)` | Sišao s ljestava a da se nikad nije zaustavio. |

---

## 12. Lockout i ograničenje broja zaustavljanja

**Lockout** je ono što čini da čuvar djeluje upravo protiv *vaše* postave. Kad zaustavi poslužitelj, ne šalje samo jednu naredbu i nada se. Označi se zaključanim i u svakom ciklusu od 2 sekunde, dok je temperatura iznad praga povratka, provjerava je li se proces vratio — i ako jest, opet ga zaustavlja. Vaš watchdog, systemdov `Restart=always`, cron posao, nestrpljiv sysop: svi gube tu raspravu dok se procesor ne ohladi. Otpušta se sam čim temperatura ostane ispod praga povratka `thermal_resume_s` (zadano 5 minuta).

**Gumb CLEAR LOCKOUT** na kartici nadzorne ploče otpušta lockout *i* brojač zaustavljanja po satu, za slučaj kad ste popravili hlađenje i ne želite čekati. **Ne** razoružava čuvara: ako je stroj još vruć, sljedeća provjera opet će zaustaviti poslužitelj. To je namjerno.

**Ograničenje** (`thermal_max_stops_hour`, zadano 2) sprječava da neispravan stroj cijelu noć ide gore-dolje. Kad se ograničenje dosegne, čuvar **isključuje automatsko ponovno pokretanje** i ostavlja poslužitelj ugašenim. Pročitajte pažljivo: isključuje ponovno pokretanje, a ne zaštitu. Lockout i dalje zaustavlja poslužitelj dok je pregrijan, koliko god se puta već oglasio. Čuvar koji bi zašutio točno kad je stroju najgore bio bi gori od nikakvog čuvara.

---

## 13. Rješavanje problema

**`sensor : NONE — no trusted CPU sensor on this machine`**
Čuvar nije našao nijedan dopušteni senzor i odbija nagađati. Pokušajte `sensors` (iz `lm-sensors`; `sudo apt install lm-sensors && sudo sensors-detect`). U virtualnom stroju ili kontejneru često doista nema izloženog senzora jezgre — čuvar takav stroj ne može zaštititi i ispravno se proglašava isključenim umjesto da se pretvara.

**`cpufreq : not writable — throttle stage disabled`**
Očekivano dok ne pokrenete `./setup-cpufreq-perms.sh` — vidi [odjeljak 8](#8-uključivanje-throttle-faze-bez-roota). Utječe samo na throttle fazu; `stop` i `stop+restart` nisu pogođeni.

**Pokrenuo sam `setup-cpufreq-perms.sh`, i dalje piše not writable**
Dva vjerojatna uzroka: niste se otad odjavili i ponovno prijavili (nova grupa dolazi do procesa samo kroz novu prijavu — provjerite s `id`), ili ploča otad nije ponovno pokrenuta (čuvar pravo pisanja provjerava jednom, pri pokretanju). Učinite oboje, tim redom.

**Pragovi mi izgledaju pogrešno za moj procesor**
Provjerite što stroj objavljuje: `cat /sys/class/hwmon/hwmon*/temp*_crit`. Ako je vaš crit neuobičajen ili ga nema, postavite apsolutne vrijednosti u `thermal_stop` i srodne.

**Zaustavio mi je poslužitelj, a mislim da nije bio vruć**
Provjerite je li `thermal_test_temp` ostao postavljen od nekog testa. To je daleko najčešći uzrok.

**Nikad se ne oglasi iako se stroj grije**
Potvrdite da način nije `log`, da je `thermal_enabled` postavljen na `true`, i usporedite temperaturu koju vidite s pragovima iz `--once`. Zapamtite da prag mora biti prijeđen *neprekidno* kroz cijelo vrijeme zadržavanja.

**Poslužitelj se stalno ponovno pokreće tijekom toplinskog događaja**
To je lockout na djelu, a reci `lockout:` njegov su izvještaj o uspjehu — vaš nadzornik nastavlja pokušavati, čuvar nastavlja poništavati. Nema se što popravljati.

**Ploča ne radi, radi li onda čuvar?**
Ne — u načinu s pločom čuvar živi unutar `admin_server.py`. Želite li zaštitu neovisnu o ploči, koristite samostalnu uslugu iz [odjeljka 7](#7-rad-bez-administratorske-ploče).

---

## 14. Isključivanje ili uklanjanje

- **Pauza:** postavite `thermal_mode` na `log`. Nastavlja promatrati i izvještavati, ali nikad ne djeluje.
- **Potpuno isključivanje:** postavite `thermal_enabled` na `false`.
- **Samostalno:** `sudo systemctl disable --now thermal-guard`.
- **Poništavanje cpufreq prava:** `sudo ./setup-cpufreq-perms.sh --revoke`.

---

## Vidi također

- [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#thermal-guard) — kartica Thermal Guard u kontekstu
- [Instalacija](INSTALLATION.md#toplinska-zaštita-procesora) — toplinska zaštita pri svježoj instalaciji
- [Struktura projekta](PROJECT_STRUCTURE.md) — gdje se nalazi `thermal_guard.py`
