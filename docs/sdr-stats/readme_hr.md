# Vodič za instalaciju System Stats

Sveobuhvatan vodič za dodavanje nadzora poslužitelja u stvarnom vremenu u vašu PhantomSDR aplikaciju pomoću automatizirane instalacijske skripte.

## Pregled

Ova značajka dodaje gumb **📊 Stats** u vaše PhantomSDR sučelje koje prikazuje informacije o sustavu u stvarnom vremenu:
- Korištenje procesora, jezgre, frekvencija, temperatura i vodeći procesi
- Korištenje memorije (iskorišteno/ukupno/postotak)

Statistika se automatski ažurira svakih 5 sekundi dok je modalni prozor otvoren.

> **Nije isto što i stranica „Grafikoni“ na administratorskoj ploči.** Ovaj je prozor trenutačni snimak koji se osvježava dok je otvoren i ne čuva povijest. Administratorska ploča ima zasebnu stranicu **Grafikoni** koja svake 2 sekunde uzorkuje frekvenciju procesora, opterećenje, temperaturu i broj korisnika te ih crta kroz zadnjih 15 minuta do 24 sata — vidi [vodič za administratorsku ploču](../hr/ADMIN_PANEL_SETUP.md).

---

## Preduvjeti

- **Linux poslužitelj** (preporučuje se Ubuntu/Debian)
- **Internetska veza** (za preuzimanje Node.js-a i paketa)
- **Sudo pristup** (za postavljanje systemd usluge)
- **PhantomSDR-Plus** već instaliran i pokrenut
- **lm-sensors** (preporučeno za temperaturu Intel/AMD procesora - skripta ga automatski instalira)

---

## Metode instalacije

> [!NOTE]
> **Glavna instalacijska skripta to već nudi.** `./install.sh` — i četiri distribucijske skripte — pokreću `install-stats-server.sh` prema zadanome u sklopu normalne instalacije PhantomSDR-Plusa, pa je na svježem stroju poslužitelj statistike obično već postavljen. Ovu stranicu koristite da ga instalirate zasebno ili da mu naknadno promijenite port, adresu ili uslugu.

### Opcija 1: Automatizirana instalacija (Preporučeno) ⭐

Automatizirana skripta obavlja sve umjesto vas.

#### Korak 1: Pokrenite skriptu

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**VAŽNO:** NEMOJTE pokretati kao root ili s sudo. Pokrenite kao vaš uobičajeni korisnik.

#### Korak 2: Slijedite interaktivne upite

Skripta će vas voditi kroz:

##### 1. **Instalacija Node.js-a** (ako je potrebno)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Skripta instalira Node.js 22 putem nvm-a, na bilo kojoj Linux distribuciji — bez root ovlasti i bez apt izvora. Isto pitanje postavlja i kada je Node.js prisutan, ali stariji od 22.

##### 2. **Direktorij instalacije**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Pritisnite Enter za zadanu vrijednost ili navedite prilagođenu putanju.

##### 3. **Konfiguracija porta** (Poboljšano!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Adresa poslužitelja**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Unesite javnu domenu ili IP adresu vašeg poslužitelja.

##### 5. **Potvrda**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Postavljanje Systemd usluge** (Opcionalno)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Preporučeno: Odaberite **y** kako bi se poslužitelj automatski pokretao pri podizanju sustava.

#### Korak 3: Instalacija dovršena! ✓

Skripta će prikazati sažetak:
```
Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 9011
  API URL: http://localhost:9011/api/system-stats (inside this computer)

Next steps:

Nothing to edit: configure-station.sh already pointed the receiver page
at /stats, which the proxy on port 9000 carries to this
server. No extra port has to be opened on the router.

╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
╚════════════════════════════════════════════════╝
```

---

## Konfigurirajte svoju PhantomSDR aplikaciju

Na stanici postavljenoj s `install.sh` ovdje nema ništa za napraviti: pitanja o stanici već su upisala `siteStats` kao `/stats`, a `proxy.py` ga prenosi na javnom portu 9000, pa se na routeru ne otvara nijedan drugi port.

### `site_information.json`

Redak u `site_information.json` izgleda ovako:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:9000",
  "siteStats": "/stats",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Testiranje instalacije

### Test 1: Provjerite API krajnju točku

```bash
curl http://localhost:9011/api/system-stats
```

Očekivani izlaz (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2: Provjerite status usluge

Ako ste je instalirali kao uslugu:

```bash
sudo systemctl status sdr-stats.service
```

Trebalo bi prikazati: `Active: active (running)`

### Test 3: Testirajte u pregledniku

1. Otvorite svoje PhantomSDR web sučelje
2. Pomaknite se do odjeljka **Additional Info**
3. Kliknite na gumb **Open Additional Info**
4. Potražite gumb **📊 Stats** pored informacija o računalu
5. Kliknite na njega da biste otvorili modalni prozor statistike
6. Provjerite prikazuje li se i ažurira li se statistika

---

## Upravljanje uslugom

Ako ste je instalirali kao systemd uslugu, koristite ove naredbe:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Promjena porta nakon instalacije

Ponovno pokrenite `bash configure-station.sh` i dajte statistici novi port. Skripta s njim premješta postavku servisa i proxy; stranica i dalje koristi `/stats`, pa se ništa drugo ne mijenja i na routeru se ništa ne otvara.

---

## Rješavanje problema

### Problem: Port je već u upotrebi

**Pogreška:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Rješenje:**

1. Pronađite što koristi port:
```bash
sudo lsof -i :9011
```

2. Zaustavite taj proces:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Ponovno pokrenite uslugu:
```bash
sudo systemctl start sdr-stats.service
```

**Alternativa:** Ponovno pokrenite instalacijsku skriptu i odaberite drugi port kada se od vas zatraži.

### Problem: Usluga se ne pokreće

**Pogreška:**
```
status=217/USER
```

**Rješenje:**

1. Provjerite datoteku usluge:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Provjerite podudara li se redak `User=` s vašim korisničkim imenom:
```bash
whoami
```

3. Uredite ako je potrebno:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Ponovno učitajte i ponovno pokrenite:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problem: Statistika se ne prikazuje u pregledniku

**Simptomi:** Modalni prozor se otvara, ali nema podataka ili prikazuje vrijednosti 0

**Rješenja:**

1. Provjerite konzolu preglednika (F12) za pogreške
2. Provjerite je li API dostupan:
```bash
curl http://localhost:9011/api/system-stats
```
3. Provjerite je li usluga pokrenuta:
```bash
sudo systemctl status sdr-stats.service
```
4. Provjerite je li `siteStats` u `site_information.json` jednak `/stats` i radi li `proxy.py`
5. Provjerite CORS pogreške - osigurajte da poslužitelj dopušta vašu domenu

### Problem: Temperatura prikazuje null

**Uzrok:** Očitavanje temperature nije dostupno na vašem sustavu

**Rješenja:**

1. **Za većinu Linux sustava:** Provjerite postoji li toplinska zona:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Instalirajte lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Napomena:** Temperatura možda neće biti dostupna na:
- Virtualnim strojevima
- Nekim VPS pružateljima usluga
- Windows Subsystem for Linux (WSL)
- Ne-Linux sustavima

To je normalno - ostatak statistike i dalje će raditi!

### Problem: Node.js nije pronađen

**Pogreška:**
```
node: command not found
```

**Rješenje:**

1. Instalirajte Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Provjerite:
```bash
node --version
npm --version
```

---

## Što ćete vidjeti

Nakon instalacije i konfiguracije, modalni prozor statistike prikazuje:

### 🖥️ Odjeljak CPU
- **Korištenje**: Ukupni postotak iskorištenosti procesora
- **Jezgre**: Koliko se procesora doista koristi, izraženo u cijelim jezgrama — npr. `1.3 / 12 in use` znači da stroj obavlja posao 1,3 jezgre. Podatak je točan i ne treba mu nikakav prag. Namjerno nije broj zauzetih jezgri: raspoređivač posao jedne jezgre razmazuje po više njih, pa bi takav broj ovu vrijednost mogao samo približno pogoditi.
- **Frekvencija**: Prosječna trenutna frekvencija procesora na svim jezgrama u GHz, s najbržom jezgrom u zagradi (ako je dostupna)
- **Temperatura**: Temperatura procesora u Celzijevim stupnjevima (ako je dostupna), označena bojom: 🟢 zelena do 69 °C, 🟠 narančasta 70-79 °C, 🔴 crvena od 80 °C naviše
- **Vodeći procesi**: 5 procesa koji najviše troše procesor s postotcima označenim bojama:
  - 🟢 Zelena: do 50 % procesora
  - 🟠 Narančasta: 51-80 % procesora
  - 🔴 Crvena: iznad 80 % procesora

### 💾 Odjeljak memorije
- **Iskorišteno**: Memorija u upotrebi (GB)
- **Ukupno**: Ukupna memorija sustava (GB)
- **Korištenje**: Postotak korištenja memorije (označen bojama)

### ♻️ Automatsko ažuriranje
- Statistika se osvježava svakih **5 sekundi** dok je modalni prozor otvoren
- Prestaje se ažurirati kada zatvorite modalni prozor (štedi resurse)

---


## Sigurnosne napomene

- Poslužitelj statistike prihvaća veze s bilo kojeg izvora (CORS: *)
- Za produkciju razmislite o ograničavanju CORS-a samo na vašu domenu
- Odabir porta provjerava unos i provjerava sukobe
- Očitavanje temperature procesora je samo za čitanje i sigurno je
- Nikakve osjetljive informacije o sustavu nisu izložene

---

## Podrška i resursi

### Deinstalacija poslužitelja statistike:
- Izbrišite mapu /sdr-stats-server
- Ako ste stvorili uslugu, samo je izbrišite koristeći:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Izmijenite `App.svelte`: Pronađite dio koda:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  i zamijenite s:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Ponovno kompilirajte pomoću naredbe:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Ponovno pokrenite računalo i pokrenite poslužitelj

---

## Brza referenca naredbi

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:9011/api/system-stats # Test API
curl http://localhost:9011/api/health       # Health check

# Troubleshooting
sudo lsof -i :9011                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Sretno praćenje! 📊🚀
