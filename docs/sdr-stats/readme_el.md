# Οδηγός εγκατάστασης του System Stats

Ένας ολοκληρωμένος οδηγός για την προσθήκη παρακολούθησης διακομιστή σε πραγματικό χρόνο στην εφαρμογή σας PhantomSDR χρησιμοποιώντας το αυτοματοποιημένο σενάριο εγκατάστασης.

## Επισκόπηση

Αυτή η λειτουργία προσθέτει ένα κουμπί **📊 Stats** στη διεπαφή σας PhantomSDR που εμφανίζει πληροφορίες συστήματος σε πραγματικό χρόνο:
- Χρήση CPU, πυρήνες, συχνότητα, θερμοκρασία και κορυφαίες διεργασίες
- Χρήση μνήμης (χρησιμοποιούμενη/συνολική/ποσοστό)

Τα στατιστικά ενημερώνονται αυτόματα κάθε 5 δευτερόλεπτα όσο το παράθυρο διαλόγου είναι ανοιχτό.

> **Δεν είναι το ίδιο με τη σελίδα «Γραφήματα» του πίνακα διαχείρισης.** Αυτό το παράθυρο δείχνει στιγμιότυπο που ανανεώνεται όσο είναι ανοιχτό και δεν κρατά ιστορικό. Ο πίνακας διαχείρισης έχει ξεχωριστή σελίδα **Γραφήματα** που δειγματοληπτεί συχνότητα CPU, φόρτο, θερμοκρασία και συνδεδεμένους χρήστες κάθε 2 δευτερόλεπτα και τα σχεδιάζει για τα τελευταία 15 λεπτά έως 24 ώρες — δείτε τον [οδηγό του πίνακα διαχείρισης](../el/ADMIN_PANEL_SETUP.md).

---

## Προαπαιτούμενα

- **Διακομιστής Linux** (συνιστάται Ubuntu/Debian)
- **Σύνδεση στο διαδίκτυο** (για τη λήψη του Node.js και των πακέτων)
- **Πρόσβαση Sudo** (για τη ρύθμιση της υπηρεσίας systemd)
- **PhantomSDR-Plus** ήδη εγκατεστημένο και σε λειτουργία
- **lm-sensors** (συνιστάται για τη θερμοκρασία CPU Intel/AMD - εγκαθίσταται αυτόματα από το σενάριο)

---

## Μέθοδοι εγκατάστασης

> [!NOTE]
> **Το κύριο πρόγραμμα εγκατάστασης το προσφέρει ήδη.** Το `./install.sh` — και τα τέσσερα scripts των διανομών — τρέχουν το `install-stats-server.sh` από προεπιλογή στο πλαίσιο της κανονικής εγκατάστασης, οπότε σε ένα φρέσκο μηχάνημα ο stats server είναι συνήθως ήδη στη θέση του. Χρησιμοποιήστε αυτή τη σελίδα για να τον εγκαταστήσετε ξεχωριστά, ή για να αλλάξετε αργότερα θύρα, διεύθυνση ή υπηρεσία.

### Επιλογή 1: Αυτοματοποιημένη εγκατάσταση (Συνιστάται) ⭐

Το αυτοματοποιημένο σενάριο τα φροντίζει όλα για εσάς.

#### Βήμα 1: Εκτελέστε το σενάριο

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**ΣΗΜΑΝΤΙΚΟ:** ΜΗΝ το εκτελέσετε ως root ή με sudo. Εκτελέστε το ως ο κανονικός σας χρήστης.

#### Βήμα 2: Ακολουθήστε τις διαδραστικές προτροπές

Το σενάριο θα σας καθοδηγήσει μέσα από:

##### 1. **Εγκατάσταση Node.js** (αν χρειάζεται)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Το σενάριο εγκαθιστά το Node.js 22 μέσω nvm, σε οποιαδήποτε διανομή Linux — χωρίς root και χωρίς πηγή apt. Κάνει την ίδια ερώτηση όταν το Node.js υπάρχει αλλά είναι παλαιότερο από 22.

##### 2. **Κατάλογος εγκατάστασης**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Πατήστε Enter για την προεπιλογή ή καθορίστε μια προσαρμοσμένη διαδρομή.

##### 3. **Διαμόρφωση θύρας** (Βελτιωμένη!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Διεύθυνση διακομιστή**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Εισαγάγετε τον δημόσιο τομέα ή τη διεύθυνση IP του διακομιστή σας.

##### 5. **Επιβεβαίωση**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Ρύθμιση υπηρεσίας Systemd** (Προαιρετικό)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Συνιστάται: Επιλέξτε **y** για να ξεκινά ο διακομιστής αυτόματα κατά την εκκίνηση.

#### Βήμα 3: Η εγκατάσταση ολοκληρώθηκε! ✓

Το σενάριο θα εμφανίσει μια σύνοψη:
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

## Διαμορφώστε την εφαρμογή σας PhantomSDR

Σε σταθμό που στήθηκε με το `install.sh` δεν χρειάζεται να κάνετε τίποτα εδώ: οι ερωτήσεις του σταθμού έχουν ήδη γράψει το `siteStats` ως `/stats`, και το `proxy.py` το μεταφέρει στη δημόσια θύρα 9000, οπότε δεν ανοίγει καμία άλλη θύρα στον δρομολογητή.

### `site_information.json`

Η γραμμή στο `site_information.json` μοιάζει έτσι:

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

## Δοκιμή της εγκατάστασης

### Δοκιμή 1: Έλεγχος του σημείου πρόσβασης API

```bash
curl http://localhost:9011/api/system-stats
```

Αναμενόμενη έξοδος (JSON):
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

### Δοκιμή 2: Έλεγχος κατάστασης υπηρεσίας

Αν το εγκαταστήσατε ως υπηρεσία:

```bash
sudo systemctl status sdr-stats.service
```

Θα πρέπει να εμφανίσει: `Active: active (running)`

### Δοκιμή 3: Δοκιμή στο πρόγραμμα περιήγησης

1. Ανοίξτε τη διαδικτυακή διεπαφή σας PhantomSDR
2. Μετακινηθείτε στην ενότητα **Additional Info**
3. Κάντε κλικ στο κουμπί **Open Additional Info**
4. Αναζητήστε το κουμπί **📊 Stats** δίπλα στις πληροφορίες PC
5. Κάντε κλικ πάνω του για να ανοίξετε το παράθυρο διαλόγου στατιστικών
6. Επαληθεύστε ότι τα στατιστικά εμφανίζονται και ενημερώνονται

---

## Διαχείριση υπηρεσίας

Αν το εγκαταστήσατε ως υπηρεσία systemd, χρησιμοποιήστε αυτές τις εντολές:

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

## Αλλαγή της θύρας μετά την εγκατάσταση

Εκτελέστε ξανά το `bash configure-station.sh` και δώστε στα στατιστικά νέα θύρα. Μετακινεί μαζί τη ρύθμιση της υπηρεσίας και τον proxy· η σελίδα συνεχίζει να χρησιμοποιεί το `/stats`, οπότε τίποτε άλλο δεν αλλάζει και τίποτα δεν ανοίγει στον δρομολογητή.

---

## Αντιμετώπιση προβλημάτων

### Πρόβλημα: Η θύρα χρησιμοποιείται ήδη

**Σφάλμα:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Λύση:**

1. Βρείτε τι χρησιμοποιεί τη θύρα:
```bash
sudo lsof -i :9011
```

2. Σταματήστε αυτήν τη διεργασία:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Ξεκινήστε ξανά την υπηρεσία:
```bash
sudo systemctl start sdr-stats.service
```

**Εναλλακτική:** Εκτελέστε ξανά το σενάριο εγκατάστασης και επιλέξτε διαφορετική θύρα όταν σας ζητηθεί.

### Πρόβλημα: Η υπηρεσία δεν ξεκινά

**Σφάλμα:**
```
status=217/USER
```

**Λύση:**

1. Ελέγξτε το αρχείο υπηρεσίας:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Επαληθεύστε ότι η γραμμή `User=` ταιριάζει με το όνομα χρήστη σας:
```bash
whoami
```

3. Επεξεργαστείτε αν χρειάζεται:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Επαναφορτώστε και επανεκκινήστε:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Πρόβλημα: Τα στατιστικά δεν εμφανίζονται στο πρόγραμμα περιήγησης

**Συμπτώματα:** Το παράθυρο διαλόγου ανοίγει αλλά χωρίς δεδομένα, ή εμφανίζει τιμές 0

**Λύσεις:**

1. Ελέγξτε την κονσόλα του προγράμματος περιήγησης (F12) για σφάλματα
2. Επαληθεύστε ότι το API είναι προσβάσιμο:
```bash
curl http://localhost:9011/api/system-stats
```
3. Ελέγξτε ότι η υπηρεσία εκτελείται:
```bash
sudo systemctl status sdr-stats.service
```
4. Επαληθεύστε ότι το `siteStats` στο `site_information.json` είναι `/stats` και ότι τρέχει το `proxy.py`
5. Ελέγξτε για σφάλματα CORS - βεβαιωθείτε ότι ο διακομιστής επιτρέπει τον τομέα σας

### Πρόβλημα: Η θερμοκρασία εμφανίζει null

**Αιτία:** Η ανάγνωση θερμοκρασίας δεν είναι διαθέσιμη στο σύστημά σας

**Λύσεις:**

1. **Για τα περισσότερα συστήματα Linux:** Ελέγξτε αν υπάρχει η θερμική ζώνη:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Εγκαταστήστε το lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Σημείωση:** Η θερμοκρασία μπορεί να μην είναι διαθέσιμη σε:
- Εικονικές μηχανές
- Ορισμένους παρόχους VPS
- Windows Subsystem for Linux (WSL)
- Μη Linux συστήματα

Αυτό είναι φυσιολογικό - τα υπόλοιπα στατιστικά θα εξακολουθούν να λειτουργούν!

### Πρόβλημα: Το Node.js δεν βρέθηκε

**Σφάλμα:**
```
node: command not found
```

**Λύση:**

1. Εγκαταστήστε το Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Επαληθεύστε:
```bash
node --version
npm --version
```

---

## Τι θα δείτε

Μόλις εγκατασταθεί και διαμορφωθεί, το παράθυρο διαλόγου στατιστικών εμφανίζει:

### 🖥️ Ενότητα CPU
- **Χρήση**: Συνολικό ποσοστό αξιοποίησης CPU
- **Πυρήνες**: Πόση CPU χρησιμοποιείται πραγματικά, εκφρασμένη σε ολόκληρους πυρήνες — π.χ. `1.3 / 12 in use` σημαίνει ότι το μηχάνημα κάνει δουλειά 1,3 πυρήνων. Είναι ακριβές μέγεθος και δεν χρειάζεται κατώφλι. Σκόπιμα δεν είναι καταμέτρηση απασχολημένων πυρήνων: ο χρονοπρογραμματιστής απλώνει τη δουλειά ενός πυρήνα σε πολλούς, οπότε μια τέτοια καταμέτρηση θα προσέγγιζε απλώς αυτόν τον αριθμό.
- **Συχνότητα**: Μέση τρέχουσα συχνότητα CPU σε όλους τους πυρήνες σε GHz, με τον ταχύτερο πυρήνα σε παρένθεση (αν είναι διαθέσιμη)
- **Θερμοκρασία**: Θερμοκρασία CPU σε Κελσίου (αν είναι διαθέσιμη), με χρωματική κωδικοποίηση: 🟢 πράσινο έως 69 °C, 🟠 πορτοκαλί 70-79 °C, 🔴 κόκκινο από 80 °C και πάνω
- **Κορυφαίες διεργασίες**: Οι 5 διεργασίες με τη μεγαλύτερη κατανάλωση CPU με ποσοστά κωδικοποιημένα με χρώματα:
  - 🟢 Πράσινο: έως 50 % CPU
  - 🟠 Πορτοκαλί: 51-80 % CPU
  - 🔴 Κόκκινο: πάνω από 80 % CPU

### 💾 Ενότητα μνήμης
- **Χρησιμοποιούμενη**: Μνήμη σε χρήση (GB)
- **Συνολική**: Συνολική μνήμη συστήματος (GB)
- **Χρήση**: Ποσοστό χρήσης μνήμης (κωδικοποιημένο με χρώματα)

### ♻️ Αυτόματη ενημέρωση
- Τα στατιστικά ανανεώνονται κάθε **5 δευτερόλεπτα** όσο το παράθυρο διαλόγου είναι ανοιχτό
- Σταματούν να ενημερώνονται όταν κλείνετε το παράθυρο διαλόγου (εξοικονομεί πόρους)

---


## Σημειώσεις ασφαλείας

- Ο διακομιστής στατιστικών δέχεται συνδέσεις από οποιαδήποτε προέλευση (CORS: *)
- Για παραγωγικό περιβάλλον, εξετάστε τον περιορισμό του CORS μόνο στον τομέα σας
- Η επιλογή θύρας επικυρώνει την είσοδο και ελέγχει για διενέξεις
- Η ανάγνωση της θερμοκρασίας CPU είναι μόνο για ανάγνωση και ασφαλής
- Δεν εκτίθενται ευαίσθητες πληροφορίες συστήματος

---

## Υποστήριξη και πόροι

### Απεγκατάσταση του διακομιστή στατιστικών:
- Διαγράψτε τον φάκελο /sdr-stats-server
- Αν έχετε δημιουργήσει μια υπηρεσία, απλώς διαγράψτε την χρησιμοποιώντας:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Τροποποιήστε το `App.svelte`: Βρείτε το τμήμα του κώδικα:
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
  και αντικαταστήστε με:
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
- Επαναμεταγλωττίστε χρησιμοποιώντας την εντολή:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Επανεκκινήστε τον υπολογιστή και ξεκινήστε τον διακομιστή

---

## Γρήγορη αναφορά εντολών

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

Καλή παρακολούθηση! 📊🚀
