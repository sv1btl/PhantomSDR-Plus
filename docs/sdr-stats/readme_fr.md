# Guide d'installation de System Stats

Un guide complet pour ajouter une surveillance de serveur en temps réel à votre application PhantomSDR à l'aide du script d'installation automatisé.

## Aperçu

Cette fonctionnalité ajoute un bouton **📊 Stats** à votre interface PhantomSDR qui affiche des informations système en temps réel :
- Utilisation du CPU, cœurs, fréquence, température et principaux processus
- Utilisation de la mémoire (utilisée/totale/pourcentage)

Les statistiques se mettent à jour automatiquement toutes les 5 secondes tant que la fenêtre modale est ouverte.

> **À ne pas confondre avec la page « Graphiques » du panneau d'administration.** Cette fenêtre est un instantané qui se rafraîchit tant qu'elle est ouverte et ne conserve aucun historique. Le panneau d'administration dispose d'une page **Graphiques** distincte qui échantillonne la fréquence du processeur, la charge, la température et les utilisateurs connectés toutes les 2 secondes et les trace sur les 15 dernières minutes à 24 heures — voir le [guide du panneau d'administration](../fr/ADMIN_PANEL_SETUP.md).

---

## Prérequis

- **Serveur Linux** (Ubuntu/Debian recommandé)
- **Connexion Internet** (pour télécharger Node.js et les paquets)
- **Accès Sudo** (pour la configuration du service systemd)
- **PhantomSDR-Plus** déjà installé et en cours d'exécution
- **lm-sensors** (recommandé pour la température CPU Intel/AMD - installé automatiquement par le script)

---

## Méthodes d'installation

> [!NOTE]
> **L'installateur principal le propose déjà.** `./install.sh` — et les quatre installateurs par distribution — exécutent `install-stats-server.sh` par défaut pendant l'installation normale de PhantomSDR-Plus : sur une machine neuve, le serveur de statistiques est donc généralement déjà en place. Utilisez cette page pour l'installer séparément, ou pour changer ensuite son port, son adresse ou son service.

### Option 1 : Installation automatisée (Recommandée) ⭐

Le script automatisé s'occupe de tout pour vous.

#### Étape 1 : Exécuter le script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANT :** N'exécutez PAS en tant que root ou avec sudo. Exécutez en tant qu'utilisateur normal.

#### Étape 2 : Suivre les invites interactives

Le script vous guidera à travers :

##### 1. **Installation de Node.js** (si nécessaire)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Le script installe Node.js 22 via nvm, sur toute distribution Linux — sans root et sans source apt. Il pose la même question lorsque Node.js est présent mais antérieur à la version 22.

##### 2. **Répertoire d'installation**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Appuyez sur Entrée pour la valeur par défaut, ou spécifiez un chemin personnalisé.

##### 3. **Configuration du port** (Améliorée !)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Adresse du serveur**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Entrez le domaine public ou l'adresse IP de votre serveur.

##### 5. **Confirmation**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Configuration du service Systemd** (Optionnel)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recommandé : Choisissez **y** pour que le serveur démarre automatiquement au démarrage.

#### Étape 3 : Installation terminée ! ✓

Le script affichera un résumé :
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

## Configurer votre application PhantomSDR

Sur une station installée avec `install.sh`, il n'y a rien à faire ici : les questions de la station ont déjà écrit `siteStats` sous la forme `/stats`, et `proxy.py` le transmet sur le port public 9000 ; aucun autre port n'est donc ouvert sur le routeur.

### `site_information.json`

La ligne dans `site_information.json` se présente ainsi :

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

## Tester l'installation

### Test 1 : Vérifier le point de terminaison de l'API

```bash
curl http://localhost:9011/api/system-stats
```

Sortie attendue (JSON) :
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

### Test 2 : Vérifier l'état du service

Si vous l'avez installé en tant que service :

```bash
sudo systemctl status sdr-stats.service
```

Devrait afficher : `Active: active (running)`

### Test 3 : Tester dans le navigateur

1. Ouvrez votre interface web PhantomSDR
2. Faites défiler jusqu'à la section **Additional Info**
3. Cliquez sur le bouton **Open Additional Info**
4. Recherchez le bouton **📊 Stats** à côté des infos PC
5. Cliquez dessus pour ouvrir la fenêtre modale des statistiques
6. Vérifiez que les statistiques s'affichent et se mettent à jour

---

## Gestion du service

Si vous l'avez installé en tant que service systemd, utilisez ces commandes :

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

## Changer le port après l'installation

Relancez `bash configure-station.sh` et donnez un nouveau port aux statistiques. Le script déplace avec lui le réglage du service et le proxy ; la page continue d'utiliser `/stats`, rien d'autre ne change donc et rien n'est ouvert sur le routeur.

---

## Dépannage

### Problème : Port déjà utilisé

**Erreur :**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Solution :**

1. Trouvez ce qui utilise le port :
```bash
sudo lsof -i :9011
```

2. Arrêtez ce processus :
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Redémarrez le service :
```bash
sudo systemctl start sdr-stats.service
```

**Alternative :** Exécutez à nouveau le script d'installation et choisissez un port différent lorsque cela vous est demandé.

### Problème : Le service ne démarre pas

**Erreur :**
```
status=217/USER
```

**Solution :**

1. Vérifiez le fichier de service :
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Vérifiez que la ligne `User=` correspond à votre nom d'utilisateur :
```bash
whoami
```

3. Modifiez si nécessaire :
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Rechargez et redémarrez :
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problème : Les statistiques ne s'affichent pas dans le navigateur

**Symptômes :** La fenêtre modale s'ouvre mais pas de données, ou affiche des valeurs à 0

**Solutions :**

1. Vérifiez la console du navigateur (F12) pour les erreurs
2. Vérifiez que l'API est accessible :
```bash
curl http://localhost:9011/api/system-stats
```
3. Vérifiez que le service est en cours d'exécution :
```bash
sudo systemctl status sdr-stats.service
```
4. Vérifiez que `siteStats` dans `site_information.json` vaut `/stats` et que `proxy.py` tourne
5. Vérifiez les erreurs CORS - assurez-vous que le serveur autorise votre domaine

### Problème : La température affiche null

**Cause :** Lecture de température non disponible sur votre système

**Solutions :**

1. **Pour la plupart des systèmes Linux :** Vérifiez si la zone thermique existe :
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Installez lm-sensors :**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Note :** La température peut ne pas être disponible sur :
- Les machines virtuelles
- Certains fournisseurs VPS
- Windows Subsystem for Linux (WSL)
- Les systèmes non-Linux

C'est normal - le reste des statistiques fonctionnera quand même !

### Problème : Node.js introuvable

**Erreur :**
```
node: command not found
```

**Solution :**

1. Installez Node.js :
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Vérifiez :
```bash
node --version
npm --version
```

---

## Ce que vous verrez

Une fois installé et configuré, la fenêtre modale des statistiques affiche :

### 🖥️ Section CPU
- **Utilisation** : Pourcentage d'utilisation global du CPU
- **Cœurs** : Quelle part du CPU est réellement utilisée, exprimée en cœurs entiers — par exemple `1.3 / 12 in use` signifie que la machine effectue le travail de 1,3 cœur. C'est exact et sans aucun seuil. Ce n'est volontairement pas un décompte de cœurs occupés : l'ordonnanceur répartit le travail d'un cœur sur plusieurs, si bien qu'un tel décompte ne ferait qu'approcher ce chiffre.
- **Fréquence** : Fréquence actuelle moyenne du CPU sur tous les cœurs en GHz, avec le cœur le plus rapide entre parenthèses (si disponible)
- **Température** : Température du CPU en Celsius (si disponible), avec code couleur : 🟢 vert jusqu'à 69 °C, 🟠 orange 70-79 °C, 🔴 rouge à partir de 80 °C
- **Principaux processus** : Les 5 processus les plus gourmands en CPU avec des pourcentages à code couleur :
  - 🟢 Vert : jusqu'à 50 % CPU
  - 🟠 Orange : 51-80 % CPU
  - 🔴 Rouge : au-delà de 80 % CPU

### 💾 Section mémoire
- **Utilisée** : Mémoire en cours d'utilisation (Go)
- **Totale** : Mémoire système totale (Go)
- **Utilisation** : Pourcentage d'utilisation de la mémoire (à code couleur)

### ♻️ Mise à jour automatique
- Les statistiques se rafraîchissent toutes les **5 secondes** tant que la fenêtre modale est ouverte
- La mise à jour s'arrête lorsque vous fermez la fenêtre modale (économise les ressources)

---


## Notes de sécurité

- Le serveur de statistiques accepte les connexions de toute origine (CORS : *)
- Pour la production, envisagez de restreindre CORS à votre domaine uniquement
- La sélection du port valide l'entrée et vérifie les conflits
- La lecture de la température du CPU est en lecture seule et sûre
- Aucune information système sensible n'est exposée

---

## Support et ressources

### Désinstaller le serveur de statistiques :
- Supprimez le dossier /sdr-stats-server
- Si vous avez créé un service, supprimez-le simplement en utilisant :
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modifiez `App.svelte` : Trouvez la partie du code :
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
  et remplacez par :
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
- Recompilez à l'aide de la commande :
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Redémarrez le PC et lancez le serveur

---

## Référence rapide des commandes

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

Bonne surveillance ! 📊🚀
