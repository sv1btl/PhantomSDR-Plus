# Panneau d'administration PhantomSDR-Plus — Guide de configuration

> ⚠️ **Avis de sécurité :** gardez ce panneau d'administration sur votre réseau domestique ou derrière un VPN. L'exposition publique du port d'administration n'est pas recommandée sans un durcissement d'authentification approprié.

---

## Vue d'ensemble

Le panneau d'administration se compose de deux services Python :

| Service | Fichier | Rôle |
|---|---|---|
| Panneau d'administration | `admin_server.py` | Application web Flask, liée à `127.0.0.1` (interne uniquement) |
| Proxy inverse | `proxy.py` | Expose à la fois le SDR et le panneau d'administration sur un seul port public |

Les deux services lisent leur configuration dans `admin_config.json`, écrit par `setup_admin.sh`. **Ne modifiez pas directement les constantes de port dans les fichiers Python** — tous les ports et l'adresse IP de l'hôte SDR sont stockés dans `admin_config.json`.

---

## Ce que vous apporte le panneau d'administration

- **Tableau de bord** — état du serveur en direct, CPU/RAM, processus principaux, sortie récente des journaux, terminal
- **Éditeur de configuration** — consultez, modifiez et enregistrez n'importe quel fichier `.toml`, `.sh`, `.json`, `.h`, `.cpp` de votre installation
- **Visionneuse de journaux** — suivez n'importe quel fichier journal en temps réel (serveur SDR, panneau d'administration, RADE, plantages, autorun, proxy)
- **Marqueurs** — consultez et modifiez les marqueurs de fréquence
- **Historique du chat** — consultez le journal du chat WebSDR, effacez-le entièrement ou supprimez des messages individuels sans redémarrer le serveur
- **Message sur la cascade** — diffusez une bannière persistante à tous les utilisateurs connectés, visible en temps réel sur l'affichage en cascade
- **Utilisateurs** — liste en direct des auditeurs connectés avec leur nom ou indicatif, leur localisation et leur adresse IP, la fréquence, le mode et la durée, un bouton ⚡ Kick et un menu ⛔ Ban ▾ (8, 16 ou 24 heures), et une carte de leur position
- **Suppression de messages du chat** — bouton 🗑 Delete qui retire immédiatement ce seul message du journal
- **Messages diffusés sur la cascade** — permet de pousser une bannière de texte persistante sur la cascade de chaque utilisateur connecté
- **Spot Reporting** — démarrez/arrêtez le décodeur autorun FT8/FT4/JS8/WSPR, choisissez les bandes/modes et rapportez les spots à PSK Reporter / wsprnet (désactivé par défaut), avec deux compteurs : des tuiles par décodeur pour l'exécution en cours et un total depuis toujours à côté de chaque case bande/mode Chaque bande et chaque mode tournent aux heures UTC programmées, et le démon peut redémarrer seul après un redémarrage ou un plantage.
- **Graphiques** — fréquence du CPU, charge du CPU, température du CPU et utilisateurs connectés, tracés sur les 15 dernières minutes / 1 heure / 4 heures / 12 heures / 24 heures
- **Protection thermique (Thermal Guard)** — arrête le serveur si le processeur surchauffe et le redémarre une fois refroidi, avec des seuils déduits de votre propre processeur ; fonctionne avec n'importe quelle méthode de démarrage/arrêt et est livrée en mode journalisation seule, elle ne fait donc rien tant que vous ne l'activez pas
- **Paramètres** — modifiez le mot de passe d'administration, le répertoire de base du SDR, le nom du processus et le port de spectrumserver (le port des auditeurs est affiché dessous) ; lancez le script de démarrage ou d'arrêt par défaut avec ▶ START / ■ STOP ; une carte **HTTPS** qui vérifie https, ou vous guide pour l'activer
- **Récepteurs** — chaque récepteur de la station avec la plage qu'il couvre, sa largeur de bande, son gain et s'il est à l'antenne ; changer les réglages et le gain d'un récepteur, arrêter ou démarrer, renommer ou supprimer un récepteur, et préparer un nouveau récepteur pour `add-receiver.sh`
- **État du système** (Dashboard) — chaque récepteur en service ou arrêté, avec sa durée de fonctionnement, l'espace disque libre et la taille de chaque dossier de journaux, la dernière entrée de `crash.log` et les alertes récentes
- **DRM** (Dashboard) — le décodeur DRM : si son assistant tourne, combien de décodeurs sont occupés et qui décode quelle fréquence (station, codec, WMER) ; activer ou désactiver le DRM et fixer le nombre maximal d'auditeurs DRM (1–20), appliqué en 5 s sans redémarrage. La page des utilisateurs affiche ces auditeurs en DRM
- **Receive Diversity** (Dashboard) — chaque auditeur qui combine votre récepteur avec un autre en diversité de réception : nom et ville, fréquence et mode, le partenaire (PhantomSDR+, KiwiSDR, UberSDR ou WebSDR) et son adresse. Seul le panneau d'administration le voit, jamais la liste publique des utilisateurs
- **Visiteurs** — statistiques privées des visiteurs sur 1 à 31 jours : visiteurs, sessions, heures d'écoute, le maximum simultané, par jour, les heures les plus chargées, les pays, et les adresses ayant le plus de sessions simultanées, avec ⛔ Ban ▾
- **Alertes** — un e-mail et/ou un message Telegram quand un récepteur s'arrête, revient ou redémarre, quand le thermal guard change de stade, ou quand `crash.log` reçoit une nouvelle entrée
- **Sauvegarde & restauration** — un zip avec les réglages propres de la station, et une restauration qui copie d'abord chaque fichier remplacé dans `admin-backups/`
- **Thèmes** — Phosphor green, Amber display, Metal panel, Modern dark, Light et Auto (clair le jour, sombre la nuit), choisis avec **THEME** dans la barre du haut de chaque page

---

## Prérequis

- PhantomSDR-Plus déjà installé et en cours d'exécution
- Python 3.8+

> [!NOTE]
> **En temps normal, l'installateur le fait pour vous.** `./install.sh` — comme chacun des quatre installateurs par distribution, les deux installateurs RADE et celui du serveur de statistiques — met le panneau en place par défaut, en installant d'abord `pip` avec le gestionnaire de paquets du système s'il manque. Cette page décrit ce qui se passe à cette étape, et quoi faire si vous l'avez sautée ou souhaitez changer quelque chose ensuite.

Les bibliothèques Python du panneau (`flask`, `psutil`, `aiohttp`, `tomli-w`) sont installées par `setup_admin.sh` ; en cas d'échec, il affiche la commande exacte à lancer.

---

## Étape 1 — Lancer le script d'installation

```bash
./setup_admin.sh
```

> **Sans panneau d'administration :** `bash setup_admin.sh --proxy-only` installe seulement `proxy.py` sur le port public, avec les ports de `station.conf`. C'est ce que fait l'installateur quand vous refusez le panneau, car c'est le proxy que joignent les auditeurs — ainsi que `/rade`, `/stats`, `/relay`.

Le script va :

1. Vérifier que Python 3 est installé
2. Vérifier la présence de `admin_server.py` et `manage_admin.sh`
3. Enregistrer `127.0.0.1` comme `sdr_host` dans la configuration (voir [Le réglage `sdr_host`](#le-réglage-sdr_host))
4. Demander trois numéros de port. Chaque invite propose une valeur par défaut entre crochets
qu'une simple touche Entrée accepte, si bien qu'une installation normale tient en trois frappes :
   - **Port de spectrumserver** — le port sur lequel votre serveur SDR écoute (par défaut `9001`,
     c'est-à-dire celui que livre chaque `config-*.toml` du dépôt)
   - **Port interne du panneau d'administration** — là où `admin_server.py` se lie localement (par défaut `9010`)
   - **Port public du proxy** — l'unique port externe combinant SDR + administration (par défaut `8902`)
   Sur une station configurée avec les questions de la station (`configure-station.sh`), les trois valeurs par défaut sont les ports propres de la station dans `station.conf` — 9001, 9010 et 9000 — ; Entrée convient donc, et le script de démarrage est déjà présélectionné.

Après l'installation, ouvrez votre navigateur via le proxy :
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Mot de passe par défaut : **`admin`**

> ⚠️ **Changez immédiatement le mot de passe** — à la première connexion, un assistant en une seule étape demande uniquement un nouveau mot de passe. Le répertoire et les ports figurent déjà dans `admin_config.json` (écrits par `setup_admin.sh`, que lance l'installateur) ; l'assistant les affiche à titre indicatif et n'y touche pas. Vous pouvez les modifier plus tard dans Settings ou avec `./configure-station.sh`.

---

## Étape 2 — Démarrer / arrêter / redémarrer

Il y a deux façons de faire tourner le panneau et le proxy. **Choisissez-en une et tenez-vous-y** — l'avertissement en fin de section explique ce qui se passe si vous les mélangez.

> **La méthode B (systemd) est fortement recommandée** partout où systemd est disponible. La protection thermique tourne dans le panneau : un panneau qui meurt à 03:00, ou une machine qui redémarre, laisse le processeur sans protection jusqu'à ce que quelqu'un le relance à la main. `setup_admin.sh` propose désormais les unités par défaut. Utilisez la méthode A lorsqu'il n'y a pas de systemd — conteneurs, WSL1, OpenRC/sysvinit — ou si vous voulez délibérément assurer vous-même la supervision.

### Méthode A — `manage_admin.sh` (sans root, rien à installer)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Un seul script pilote **les deux** processus. Il vérifie qu'`aiohttp` est installé avant de démarrer le proxy et affiche une erreur claire avec la commande de correction s'il manque.

### Méthode B — unités systemd (démarrage au boot, redémarrage après plantage)

Le dépôt fournit deux unités prêtes à l'emploi, `phantomsdr-admin.service` et `phantomsdr-proxy.service`. Adaptez `User=` et les chemins dans les deux, puis :

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Les commandes quotidiennes deviennent alors :

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Les mêmes quatre avec `phantomsdr-proxy`, ou les deux à la fois : `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

Une chose à faire une fois pour toutes : installer la règle tmpfiles de `tmpfiles/phantomsdr-logs.conf` (modifiez d'abord ses chemins et son utilisateur). systemd crée ces deux journaux en tant que `root` avant de descendre vers `User=`, et le bouton **Clear Logs** du panneau échoue alors avec `Permission denied` — voir plus bas « Clear Logs indique Permission denied ». `setup_admin.sh` installe la règle pour vous.

Pour revenir à la méthode A :

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Ne mélangez pas les deux.** Avec les unités activées, `./manage_admin.sh stop` est annulé par systemd cinq secondes plus tard, et `./manage_admin.sh start` vous donne une seconde copie non gérée qui se dispute le même port avec celle de systemd. (`restart` a été retiré du script précisément pour cela ; il affiche désormais une erreur qui renvoie à `systemctl`.) `./manage_admin.sh status` ne fait que lire : il reste utile dans les deux cas.

### Redémarrer le panneau

La suite de ce document dit « redémarrez le panneau » à plusieurs endroits. Cela désigne celle de ces commandes qui correspond à votre méthode :

```bash
# Méthode B — unités systemd (l'installation normale)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Méthode A — aucune unité installée
./manage_admin.sh stop && ./manage_admin.sh start
```

---

## Étape 3 — Ouvrir le port du pare-feu

N'ouvrez que le **port public du proxy** dans votre pare-feu. Il est inutile d'exposer le port interne du panneau d'administration :

```bash
sudo ufw allow <proxy_port>
```

---

## Étape 4 — Fonction d'éjection d'utilisateurs

La page Users montre chaque auditeur actuellement connecté. Chaque ligne affiche le nom ou l'indicatif tapé par l'auditeur (`--` s'il n'y en a pas), la localisation avec l'adresse IP en dessous, la fréquence accordée, le mode et la durée de connexion. Pour déconnecter un utilisateur, cliquez sur le bouton **⚡ Kick** de sa ligne — seules les connexions de cet auditeur sont fermées. Tous les autres auditeurs restent connectés et ne remarquent rien.

À côté du mode, la page Users montre le décodeur que l'auditeur utilise dans sa page, par exemple `USB · FT8` (les auditeurs DRM apparaissent comme `DRM`). Les pages ouvertes avant la mise à jour du serveur ne l'indiquent qu'après avoir été rechargées.

L'expulsion est instantanée et chirurgicale : le serveur ne redémarre pas, l'audio de personne d'autre n'est interrompu et l'utilisateur expulsé peut se reconnecter immédiatement (la fonction sert à retirer des connexions gênantes ou bloquées ; pour tenir quelqu'un à l'écart, utilisez le bannissement ci-dessous).

**⛔ Ban ▾** ouvre un petit menu — **8**, **16** ou **24 heures** — et la durée choisie déconnecte l'auditeur de tous les récepteurs de la station et refuse cette adresse pendant ce temps (24 heures est le maximum qu'accepte le récepteur) (code de fermeture 4001, que la page ne retente pas). Le bannissement est conservé dans `admin_bans.json` à côté du panneau et renvoyé à chaque récepteur une fois par minute, si bien qu'un redémarrage de récepteur ne le lève pas. Tant que des bannissements sont en vigueur, une liste **Banned** sous le tableau montre chacun avec son nom, son adresse et son heure de fin, et un bouton **Unban** le lève aussitôt. Tous ceux qui se trouvent derrière la même connexion internet partagent l'adresse et sont bannis avec elle.

---

## Configuration — admin_config.json

Toute la configuration d'exécution se trouve dans `admin_config.json`, dans votre répertoire PhantomSDR-Plus. `setup_admin.sh` écrit le fichier initial ; les modifications ultérieures peuvent se faire via la page Settings ou en éditant directement le fichier.

Champs clés écrits par `setup_admin.sh` :

| Clé | Description |
|---|---|
| `port` | Port interne du panneau d'administration (`admin_server.py` s'y lie) |
| `public_port` | Port spectrumserver du récepteur principal (9001 derrière proxy.py) — **pas** le port des auditeurs, c'est `proxy_port`. proxy.py y renvoie ; Kick, la page Users et le nombre d'auditeurs l'interrogent |
| `proxy_port` | Port public sur lequel le proxy écoute |
| `sdr_host` | Hôte utilisé par le proxy pour atteindre spectrumserver — `127.0.0.1` (voir ci-dessous) |
| `password_hash` | Empreinte SHA-256 du mot de passe d'administration |
| `sdr_base_dir` | Chemin de votre installation PhantomSDR-Plus |
| `sdr_process_name` | Nom du processus à surveiller (par défaut : `spectrumserver`) |
| `start_script` / `stop_script` | Scripts que le panneau exécute pour démarrer et arrêter le serveur SDR — c'est aussi par eux qu'agit la protection thermique |

> **Plusieurs récepteurs sur un ordinateur ?** Mettez `start_script` à `start-all.sh`. Le script d'arrêt arrête déjà tous les récepteurs, et Restart ainsi que la protection thermique utilisent le script de démarrage ; avec `start-all.sh`, ils ramènent tous les récepteurs de `receivers.toml` au lieu du seul principal. La page Users, le nombre d'auditeurs et l'expulsion couvrent alors aussi tous les récepteurs. Voir [Plusieurs récepteurs](MULTI_RECEIVER.md).

---

## Le réglage `sdr_host`

`proxy.py` se connecte à `spectrumserver` par bouclage — `sdr_host` vaut `127.0.0.1` dans `admin_config.json`, écrit là par `setup_admin.sh`. Vous ne devriez pas avoir à le modifier.

Ne mettez une adresse réelle que si `spectrumserver` tourne sur une **autre machine** que le proxy. Ensuite, [Redémarrer le panneau](#redémarrer-le-panneau).

---

## proxy.py — ce que c'est et quand il est nécessaire

`proxy.py` place à la fois le serveur SDR et le panneau d'administration sur un **seul port public**, en routant par préfixe de chemin :

| Chemin | Redirigé vers |
|---|---|
| `/admin*` | Panneau d'administration (`localhost:<port>`) |
| Tout le reste | Spectrumserver (`<sdr_host>:<public_port>`) |

Sans le proxy, vous devez exposer deux ports séparément. Avec lui, vous n'en exposez qu'un.

Le proxy supprime également la limite de 4 Mo sur la taille des messages WebSocket (important pour les grandes trames FFT du RX-888 à 60 MSPS), transmet les vraies IP des clients via les en-têtes `X-Forwarded-*` et maintient les connexions de longue durée à travers le NAT grâce à un battement de cœur toutes les 30 secondes.

---

## Changer de ports après l'installation

Modifiez directement `admin_config.json` :

```json
{
  "port":        9010,
  "public_port": 9001,
  "proxy_port":  9000,
  "sdr_host":    "127.0.0.1"
}
```

Puis redémarrez les deux services :

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Commandes manuelles utiles

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

## Fichiers journaux

| Fichier | Contenu |
|---|---|
| `admin.log` | Sortie du panneau d'administration |
| `proxy.log` | Bannière de démarrage du proxy + une ligne de journal d'accès par requête relayée |
| `logwebsdr.txt` | Journal du lanceur et du chien de garde — démarrage/arrêt, pilote du récepteur, enregistrement sur websdr.org |
| `spectrumserver.log` | La sortie du processus récepteur lui-même — mise en place FFT et OpenCL, connexions de chaque client, erreurs. Le plus gros de ces fichiers ; il est tourné, un `spectrumserver.log.1` peut donc se trouver à côté |
| `rade.log` | Journal du sidecar RADE/FreeDV |
| `autorun.log` | Journal du démon de décodage — spots, SNR, dérive |
| `crash.log` | Rapports de plantage et événements thermiques : traces `[CRASH]` / `[TERMINATE]`, notes `[EXIT]` et lignes `[THERMAL]` de la protection. **Normalement vide** — tout ce qu'il contient mérite d'être lu |

Tous ces fichiers sont consultables depuis les onglets **Log Viewer** du panneau (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Le visualiseur affiche les 150 dernières lignes de l'onglet choisi et se rafraîchit toutes les 3 secondes quand le rafraîchissement automatique est actif ; il ne lit que la fin du fichier, sa taille est donc sans importance.

### Rotation de proxy.log et admin.log

`proxy.log` enregistre chaque requête relayée et `admin.log` chaque requête qui atteint le panneau lui-même. Aucun des deux ne fait l'objet d'une rotation par défaut. L'interrogation du tableau de bord dominait autrefois les deux fichiers — `/admin/api/status` est appelée toutes les ~3 secondes tant qu'un onglet reste ouvert — mais ces interrogations sont désormais filtrées des deux journaux (voir plus bas) ; la rotation sert donc à borner une croissance lente, pas un flot.

Le dépôt fournit une configuration logrotate dans `logrotate/phantomsdr` (quotidienne, ou plus tôt si un journal dépasse 10 Mo ; conserve 7 archives compressées dans `logproxy/`, afin qu'elles n'encombrent pas la racine du projet). **Elle dépend du site — ouvrez-la et changez les trois chemins de journaux, le chemin `olddir` et l'utilisateur `su` pour correspondre à votre machine avant de l'installer**, puis :

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

Le bouton **Clear Logs** du panneau tronque **tous** les fichiers du tableau ci-dessus, `autorun.log` et `proxy.log` compris (`CLEAR_EXCLUDE` dans `admin_server.py` est vide). Notez ce que cela coûte sur `autorun.log` : son historique de décodage est le seul enregistrement de ce qui a été entendu et quand, et il est impossible à reconstituer ; d'un vidage il ne survit que ce que logrotate a déjà basculé dans `logproxy/`, donc tout ce qui a été décodé depuis la dernière rotation est perdu. Le vider sous un décodeur en marche est sans danger : le démon le garde ouvert en `O_APPEND` et continue d'écrire dans le même inode. La notification indique ce qui a été vidé, et si un fichier n'a pas pu être écrit — un `proxy.log` appartenant à un autre utilisateur, par exemple, sur une installation à comptes séparés — elle nomme ce fichier et l'erreur au lieu d'annoncer une réussite, et laisse le volet de ce journal à l'écran au lieu de le vider. Les fichiers sont tronqués sur place, jamais supprimés : `manage_admin.sh` comme les unités systemd les ouvrent en `O_APPEND`, si bien qu'un fichier supprimé continuerait de remplir un inode invisible jusqu'au redémarrage du service.

Comme `proxy.log` est un journal d'accès, il contient les adresses IP des visiteurs et les chaînes user-agent — gardez-le à l'esprit avant de le partager pour demander de l'aide.

### « Clear Logs » indique Permission denied

Sur une machine où les unités systemd ont été installées sur une arborescence vierge, le bouton peut répondre :

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Ce sont toujours ces deux fichiers et jamais les cinq autres, car ce sont les seuls que systemd crée lui-même. `StandardOutput=append:` est ouvert par PID 1 **avant** de descendre vers `User=` ; un journal qui n'existe pas encore est donc créé en `root:root 0644`. Le panneau tourne sous votre utilisateur et ne peut pas le vider. Les cinq autres journaux sont créés par les scripts de lancement, qui tournent déjà sous votre utilisateur : ils se vident normalement. Là où les deux fichiers sont antérieurs aux unités — `manage_admin.sh` les a créés avec `>>` —, ils appartiennent déjà au bon utilisateur et le bouton fonctionne ; c'est pourquoi le problème n'apparaît que sur une installation neuve partie directement de systemd.

Vérifiez avec `ls -l admin.log proxy.log` : ceux qui échouent affichent `root root`. Réparez-les :

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Aucun redémarrage n'est nécessaire — systemd continue d'écrire via le descripteur de fichier qu'il détient déjà, et l'ajout ne change pas la propriété. Appuyez de nouveau sur **Clear Logs** et les deux sont vidés.

Pour que cela ne revienne pas, installez la règle tmpfiles fournie par le dépôt dans `tmpfiles/phantomsdr-logs.conf`. Elle recrée les deux journaux avec le bon propriétaire à chaque démarrage, avant le lancement des unités, de sorte qu'un journal supprimé — nettoyage manuel, réinstallation, répertoire d'installation déplacé — ne revienne jamais appartenant à root. **Elle est spécifique à la machine : ouvrez-la et modifiez d'abord les deux chemins et le user:group pour qu'ils correspondent au vôtre**, puis :

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

---

## Résumé des accès

| Configuration | SDR | Panneau d'administration |
|---|---|---|
| Sans proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Avec proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Suppression de messages du chat

La page Chat History liste tous les messages du journal de chat actuel. Chaque entrée dispose d'un bouton **🗑 Delete** qui retire immédiatement ce seul message du journal — sans redémarrer le serveur.

Fonctionnement :

- Le panneau d'administration réécrit le fichier de journal du chat sur place, en supprimant uniquement la ligne du message sélectionné.
- Le changement prend effet pour tout utilisateur qui recharge le chat ; l'historique déjà chargé dans les onglets ouverts n'est pas mis à jour rétroactivement.
- Effacer tout le journal (bouton **Clear All**) tronque le fichier, ce qui prend également effet sans redémarrage.
- Une **réponse du chat** est stockée comme un message ordinaire qui commence par un marqueur nommant le message auquel elle répond, par exemple `[RE:2026-09-25 12:00:01|SV1BTL]` ; dans cette liste elle apparaît donc précédée de ce marqueur. Supprimer une réponse ne retire que cette réponse. Supprimer le message auquel elle répond laisse ses réponses en place, n'affichant plus que le nom et l'heure auxquels elles répondent.

---

## Messages diffusés sur la cascade

Le panneau **Waterfall Message** permet de pousser une bannière de texte persistante sur l'affichage en cascade de chaque utilisateur connecté, sans toucher au processus du serveur.

### Envoyer un message

1. Ouvrez le panneau d'administration et allez dans **Waterfall Message**.
2. Saisissez le texte de votre message et choisissez une couleur (hexadécimale, p. ex. `#ffdd00`).
3. Cliquez sur **Send** — le message apparaît immédiatement sur toutes les vues en cascade actives.

### Effacer le message

Cliquez sur **Clear** pour retirer la bannière de toutes les cascades. L'état du message est conservé en mémoire par le panneau d'administration ; il est effacé automatiquement si le processus du panneau redémarre.

---

## Graphiques système

La page **Graphiques** trace quatre mesures sur un axe de temps commun :

- **Fréquence du CPU** — fréquence moyenne sur tous les cœurs, en GHz
- **Charge du CPU** — utilisation totale, en pourcentage
- **Température du CPU** — en °C, avec des repères pointillés à 70 °C (chaud) et 80 °C (critique)
- **Utilisateurs en ligne** — auditeurs connectés au WebSDR à cet instant

Choisissez la plage avec **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Le survol du graphique affiche un réticule et les quatre valeurs de cet instant. Les quatre cartes au-dessus montrent toujours l'échantillon le plus récent.

---

## Thermal Guard

> 📖 **Manuel complet : [THERMAL_GUARD.md](THERMAL_GUARD.md)** — les quatre modes et ce que le sysop doit faire pour chacun, le fonctionnement sans le panneau, l'étage throttle sans root, les tests et le dépannage.

Arrête le serveur SDR lorsque le processeur devient dangereusement chaud et le relance une fois refroidi. Elle fait partie du panneau — rien de plus à installer — et apparaît comme une carte **THERMAL GUARD** sur le Tableau de bord, ses réglages se trouvant dans **Paramètres**.

Elle est livrée **inerte** : le mode démarre sur `log`, elle se contente donc d'enregistrer ce qu'elle *aurait* fait. Rien ne touche à votre serveur tant que vous ne changez pas le mode.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

L'onglet **Spot Reporting** contrôle le démon autorun (`autorun/index.js`) — un processus Node.js qui décode FT8/FT4/JS8/WSPR côté serveur, directement depuis le récepteur, et téléverse les spots vers les réseaux de report :

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 n'est spotté qu'à la vitesse Normal** — le cycle d'appel de 15 s, où se trouvent les heartbeats et les CQ. Les spots proviennent des heartbeats, des trames compound et des messages dirigés ; les destinations de groupe comme `@ALLCALL` et les indicatifs que le décodeur n'a pas pu résoudre (`<....>`) ne sont jamais rapportés. JS8 partage la file PSK Reporter avec FT8 et FT4 et est compté séparément, exactement comme eux.


**Le report est DÉSACTIVÉ par défaut.** Rien n'est téléversé tant que vous n'avez pas activé une destination et appuyé sur **Start**. Décodage et téléversement sont indépendants : le démon peut décoder et journaliser avec le report désactivé, ce qui vous permet de vérifier l'activité avant que quoi que ce soit ne devienne public.

> ⚠️ Les spots sont téléversés vers des réseaux publics sous **votre indicatif**. N'activez que les bandes/modes que votre récepteur entend véritablement, et indiquez le bon locator.

### Prérequis

Le démon autorun nécessite Node.js 22+, les paquets npm `ws` + `cbor-x` (résolus via le lien symbolique `autorun/node_modules` → `frontend/node_modules`) et `util-linux` (`taskset`). Les installateurs mettent tout cela en place automatiquement — voir la [section Rapporteur de spots autorun d'INSTALLATION.md](INSTALLATION.md#rapporteur-de-spots-autorun-ft8ft4wspr). Si **Start** échoue, ce lien symbolique ou `taskset` en est la cause habituelle (voir Dépannage ci-dessous).

### Utiliser l'onglet

1. **Identité** — indicatif et locator. Pré-remplis depuis `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, tronqué à 6 caractères) ; remplacez-les ici si nécessaire. Les reporters n'acceptent qu'un locator de 4 ou 6 caractères (KM17 ou KM17VX) : un locator plus long est coupé à son carré de 6 caractères, et ce qui n'est pas un locator est refusé à l'enregistrement.
2. **Matrice bande × mode** — cochez les combinaisons à décoder. Les lignes sont les bandes, les colonnes FT8 / FT4 / JS8 / WSPR ; les cases non prises en charge sont désactivées. WSPR couvre en outre les bandes LF/MF (2200 m, 630 m) et un canal 80 m EU supplémentaire.
3. **Destinations** — activez **PSK Reporter** et/ou **wsprnet** (désactivés par défaut).
4. **Max slots** — une limite au nombre de créneaux bande/mode qui tournent en même temps ; avec un [planning](#planning-heures-par-bande-et-par-mode), elle est vérifiée heure par heure. **SELECT ALL**, à côté, coche toutes les bandes et tous les modes.
5. **Start / Stop** — lance/arrête le démon (épinglé sur les cœurs CPU les plus élevés avec `taskset`, choisis automatiquement selon la machine — voir *Ressources requises et limitations* ci-dessous). **Save** / **Reload** enregistrent et relisent la configuration ; **Free All** libère tous les créneaux. **Start automatically after a reboot or crash** relance le démon tout seul — voir [plus bas](#démarrage-automatique-après-un-redémarrage-ou-un-plantage).

La carte d'état s'actualise toutes les 5 s et indique l'état d'exécution, les compteurs de décodage/téléversement et l'heure du dernier envoi. Un badge **📶 REPORTING** apparaît sur la cascade principale tant que le report est actif.

> **« 0 sent » pendant les premières minutes est normal.** PSK Reporter téléverse par lots toutes les **5 minutes** et wsprnet toutes les **2 minutes** — les spots patientent jusqu'au prochain envoi. La carte d'état affiche le nombre en attente et la cadence.

### Changer de bandes ou de modes en cours de fonctionnement

Une modification enregistrée atteint d'elle-même un démon en marche. Le démon regarde `autorun.json` toutes les 5 secondes et, quand **SAVE CONFIG** l'a modifié, il prend les nouvelles bandes, modes, heures et destinations sans redémarrer : les nouveaux créneaux s'ouvrent, ceux qui ont été retirés se ferment, et `autorun.log` écrit `config reloaded` avec les créneaux ouverts et fermés. Les compteurs continuent. **START** sur un démon en marche répond toujours `already running`, ce qui est sans conséquence : la modification qu'il a enregistrée est prise en compte quand même.

Deux choses demandent encore **STOP** → **START** : l'indicatif et le locator (le journal le signale quand ils changent), et une entrée `server` ou `cores` ajoutée à la main dans `autorun.json`.

Ce qu'un redémarrage fait aux compteurs :

- **Les totaux à côté de chaque case sont conservés** : ils sont dans `autorun-totals.json`, qui n'est pas supprimé à l'arrêt.
- **Les tuiles par décodeur repartent de zéro**, elles valent par exécution.
- **Rien n'est perdu de la file** : l'arrêt envoie les spots en attente.
- Une bande **nouvellement activée** part de `0` ; une bande **déjà utilisée** reprend son total précédent.
- Une bande que vous **décochez garde son nombre** à côté de la case désormais vide ; l'historique n'est pas effacé.

**SELECT ALL**, à côté de MAX SLOTS, coche toutes les bandes et tous les modes ; quand tout est coché, le bouton devient **DESELECT ALL** et décoche tout.

### Planning (heures par bande et par mode)

Sous BANDS & MODES, la carte **SCHEDULE** a une ligne pour chaque bande et mode cochés, avec 24 cases pour les heures 00–23 **UTC**. Une coche dans une case signifie que ce créneau décode et envoie des spots pendant cette heure. Les autres heures, il dort, sa connexion au récepteur fermée : il ne coûte pas de CPU et n'occupe aucune place d'auditeur du récepteur. Un créneau dont toutes les heures sont cochées tourne toute la journée, comme avant les plannings — c'est ainsi que démarre toute configuration existante.

- Un clic coche ou décoche une case ; en faisant glisser, on en prend plusieurs.
- **24h** et **Clear** — toutes les heures, ou aucune.
- **Day** et **Night** — de 06 à 18 h et de 18 à 06 h en heure *solaire* locale au locator de REPORTER IDENTITY (pour KM17VX, Day correspond à 04–15 UTC). L'heure solaire et non l'heure légale, pour que ce soit juste pour toute station et que cela ne bouge pas avec l'heure d'été.
- **→ 20m** (la bande de la ligne) — donne les mêmes heures aux autres modes cochés de cette bande, en remplaçant les leurs.
- **show local time** — affiche les colonnes à l'heure de votre navigateur ; le planning reste enregistré en UTC.
- La ligne **AT ONCE** compte les créneaux qui tournent à chaque heure. Un nombre rouge dépasse **MAX SLOTS**, et **SAVE CONFIG** refuse d'enregistrer tant que ce n'est pas corrigé. MAX SLOTS limite les créneaux qui tournent *en même temps*, pas sur la journée : avec un planning, plus de bandes se partagent le même CPU — par exemple 10, 12 et 15 m le jour et 160 et 80 m la nuit.
- Le point devant chaque ligne est vert tant que le créneau décode, ambre pendant qu'il s'ouvre pour sa prochaine heure ou se ferme, et gris tant qu'il dort ou que le démon est arrêté. La carte d'état montre les créneaux programmés en ce moment et l'heure du prochain changement.

Un créneau s'ouvre un peu avant sa première heure — une fenêtre de décodage plus 10 secondes, soit environ 25 s pour FT8 et JS8 et un peu plus de 2 minutes pour WSPR — afin que le premier cycle de l'heure soit décodé ; le cycle entendu pendant cette avance appartient à l'heure précédente et n'est pas signalé. Il se ferme quelques secondes après sa dernière heure, une fois lancé le décodage du dernier cycle de cette heure. Une connexion qui tombe, parce que le récepteur a redémarré par exemple, est rouverte au bout de 30 secondes.

### Démarrage automatique après un redémarrage ou un plantage

**Start automatically after a reboot or crash**, sous les boutons, est désactivé par défaut et prend effet avec **SAVE CONFIG**. Activé, le panneau d'administration — que systemd lance au démarrage — démarre le démon environ une minute après le lancement du panneau, puis vérifie chaque minute qu'il tourne toujours et le relance s'il s'est arrêté. Un récepteur pas encore démarré ne pose pas de problème : le démon réessaie ses connexions toutes les 30 secondes.

**STOP l'emporte toujours.** Après **STOP**, le démon reste arrêté, redémarrages compris, jusqu'à ce que vous appuyiez sur **START** ; le panneau le note dans le fichier `autorun-stopped`. **FREE ALL SLOTS** arrête aussi le démon et le maintient arrêté de la même façon. La carte d'état affiche `Autostart: off`, `ON` ou `ON, held by STOP`.

Un démon qui s'arrête 5 fois en 15 minutes est laissé tranquille 30 minutes au lieu d'être relancé chaque minute. Chaque démarrage automatique, et cette pause, sont écrits dans le journal AUTORUN sous la forme `[admin …] autostart: …`.

### Compteurs de spots

Deux comptages différents sont affichés ; ils répondent à des questions différentes.

**SPOTS UPLOADED PER DECODER** — une tuile par décodeur (FT8 / FT4 / JS8 / WSPR) avec les spots envoyés **depuis le dernier démarrage du démon**, et en dessous le nombre de décodages et ceux encore en file. Stop/Start les remet à zéro. Un décodeur dont la destination est désactivée affiche ses décodages et `reporting off` plutôt qu'un simple `0` : ici, zéro envoi est un réglage, pas une panne.

**Le nombre à côté de chaque case** dans BANDS & MODES correspond aux spots envoyés **depuis toujours** pour cette bande et ce mode. Ils sont conservés dans `autorun-totals.json` et survivent aux redémarrages. **En ambre avec un point devant** (`·123`), cela signifie que ce créneau a décodé sans encore rien envoyer. C'est normal entre deux envois — PSK Reporter émet toutes les 5 minutes et wsprnet toutes les 2 — de sorte que les compteurs FT8/FT4 restent ambre les premières minutes après un démarrage. Ils restent également ambre si la destination de ce décodeur est désactivée. Un `0` simple, sans point, signifie que ce créneau est activé mais n'a encore rien décodé : WSPR reste à zéro plusieurs minutes après un démarrage, car il fonctionne sur un cycle de 2 minutes alors que FT8 compte déjà par centaines. Un créneau que le démon n'a jamais exécuté n'affiche rien. Le survol affiche les envois, les décodages et l'heure du dernier envoi.

**Remettre les compteurs à zéro.** **FREE ALL SLOTS** décoche toutes les bandes et tous les modes, désactive les deux destinations, arrête le démon et **efface les compteurs cumulés** : ensuite, plus aucun nombre n'apparaît à côté d'une case. C'est le seul moyen de les remettre à zéro, et l'opération est irréversible. Le bouton arrête le démon et attend sa sortie avant de supprimer `autorun-totals.json`, car le démon réécrit ce fichier à l'arrêt ; le supprimer sous un démon actif ne ferait que ramener les nombres.

### Ressources requises et limitations

Le démon est volontairement léger et fonctionne sur du matériel modeste (un i5 4 cœurs convient), mais il existe de vraies limites à connaître.

**Limitations connues :**

1. **Le vrai goulot d'étranglement est spectrumserver + la largeur de bande du SDR, pas le démon.** Un RX888 à 30 MHz nécessite OpenCL/GPU ; un CPU à peu de cœurs sans GPU capable ne peut pas soutenir cette FFT. Associez le matériel modeste à un SDR plus étroit (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR est le poste le plus coûteux en CPU.** Son décodeur de Fano est un portage JS (~30 s par bande, mono-thread). Le pool de 4 workers exécute 4 décodages en parallèle ; activer **plus de ~4 bandes WSPR** à la fois peut faire déborder la file au-delà du créneau de 120 s, surtout pendant que le SDR se dispute les cœurs. Les décodages FT8/FT4 sont peu coûteux en comparaison.
3. **Mise à l'échelle du nombre de créneaux.** Les chiffres de ~2 à 2,5 cœurs / 600 à 700 Mo correspondent aux ~28 créneaux complets sur une machine à 8 cœurs. Sur 4 cœurs partagés, limitez-vous à quelques bandes (règle : ≤ 6 FT8/FT4 + ≤ 3 WSPR) et surveillez la statistique `queued` du pool.
4. **L'épinglage suppose une topologie hybride Intel** (cœurs bas = P-cores plus rapides). Sur AMD ou sur des CPU à numérotation SMT entrelacée, la répartition automatique reste valable (pas de chevauchement, pas de plantage) mais « les cœurs bas sont plus rapides » peut ne pas être littéralement vrai ; sur une puce 4C/8T avec hyperthreading, les cœurs hauts sont des jumeaux SMT — confinés, pas totalement isolés. Là où la plage automatique n'est pas idéale, utilisez le **remplacement manuel** ci-dessous.
5. **La couverture des bandes est limitée par le récepteur.** La configuration RX888 (`sps=60000000` → Nyquist à 30 MHz) ne peut pas atteindre le 6 m et au-delà ; la table des bandes va de 160 m à 10 m. Les autres SDR couvrent ce que permet leur fenêtre d'accord.
6. **Cadence de report.** PSK Reporter envoie toutes les 5 min, wsprnet toutes les 2 min — « 0 sent » les premières minutes est normal, pas un défaut.

### Fichiers et points de terminaison

| Élément | Objet |
|---|---|
| `autorun.json` | Configuration enregistrée (identité, créneaux avec leurs heures UTC `hours`, destinations, max. créneaux, `autostart`, épinglage `cores` optionnel). Écrite par l'onglet ; ignorée par git. Un créneau sans `hours` tourne toute la journée. |
| `autorun-stopped` | Présent après **STOP** : le démarrage automatique laisse le démon arrêté, redémarrages compris, jusqu'à ce que **START** le supprime. Ignoré par git. |
| `autorun/scheduler.js` | Quels créneaux sont ouverts à un moment donné : les heures, l'avance avant la première heure et le délai après la dernière. Testé par `node autorun/scheduler.test.mjs`. |
| `autorun-status.json` | État en direct lu par la carte d'état (pid, compteurs, dernier envoi). Écrit toutes les 15 s ; supprimé à l'arrêt. |
| `frontend/dist/autorun-active.json` | Données publiques du badge, servies à `/autorun-active.json`. Vide quand le report est désactivé. |
| `autorun.log` | Sortie standard/erreur du démon. |
| `GET/POST /admin/api/autorun/config` | Lire / écrire `autorun.json` (valide l'indicatif, le locator, les combinaisons bande/mode, la limite de créneaux). |
| `GET /admin/api/autorun/status` | État d'exécution (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Lance (`taskset -c <auto> node autorun/index.js`) / envoie `SIGTERM`. La plage de cœurs est déduite du CPU (voir ci-dessus). |

> **Remarque :** après une mise à jour de `admin_server.py`, vous devez [Redémarrer le panneau](#redémarrer-le-panneau) pour charger les nouvelles routes autorun ou une matrice bande/mode actualisée. Le démon s'exécute comme un processus distinct : il survit donc aux redémarrages du panneau d'administration.

---

## État du système (System Health)

Une carte du **Dashboard**, rafraîchie toutes les 30 secondes (ou avec **↻ refresh**) :

- **Récepteurs** — chaque récepteur de la station (celui de `public_port` et chaque récepteur de `receivers.toml`) : un point vert et *on air, up 15h 5m* quand il répond, un **OFF THE AIR** rouge sinon.
- **Disque & dossiers de journaux** — l'espace libre sur le disque de l'installation (orange à partir de 80 % utilisé, rouge à partir de 90 %), et la taille de `logs/`, `logproxy/` et de chaque `instances/<id>/logs/`.
- **Alertes récentes** — ce que la surveillance des alertes a vu depuis le démarrage du panneau (voir [Alertes](#alertes-e-mail--telegram)), qu'un message ait été envoyé ou non.
- **Dernière entrée de crash.log** — le `crash.log` non vide le plus récent de tous les récepteurs, avec sa date et ses 12 dernières lignes.

---

## Statistiques des visiteurs

La page **Visitors** du menu latéral (sur un téléphone : **☰ MENU → Visitors**, ou le bouton **📈 VISITOR STATISTICS** de la page Users) compte les auditeurs de la station à partir des journaux privés `logs/users_YYYY-MM-DD.jsonl` de chaque récepteur — les copies avec les adresses IP, que les pages publiques ne montrent plus. Choisissez **Today**, **7**, **14** ou **31 days**.

- **Visiteurs** (adresses distinctes), **sessions**, **heures d'écoute** et **le plus grand nombre d'auditeurs simultanés**.
- **Par jour** — les mêmes quatre chiffres pour chaque jour.
- **Heures les plus chargées** — quand les sessions ont commencé, par heure UTC.
- **Pays** — visiteurs par pays.
- **Décodeurs** — combien de sessions ont utilisé chaque décodeur (compté dans les lignes du journal qui le mentionnent, donc depuis la mise à jour du serveur).
- **Adresses** — les 20 adresses ayant le plus de sessions *simultanées* d'abord, puis le plus de sessions ; un afflux de connexions comme celui du 16 septembre 2026 apparaît tout en haut (**AT ONCE** passe au rouge au-dessus de 3). Chaque ligne a **BAN ▾** (8, 16 ou 24 heures).

Les jours et les heures sont en UTC. Les décodeurs de la station elle-même (connexions locales) ne sont pas comptés ; une session encore ouverte compte au plus 12 heures. Les noms ne figurent pas dans ces journaux, la page montre donc des adresses, pas des noms. Les chiffres sont recalculés au plus une fois par minute.

---

## Alertes (e-mail / Telegram)

**Settings → Alerts — Email / Telegram.** Une surveillance dans le panneau d'administration regarde toutes les 30 secondes :

| Événement | Quand |
|---|---|
| **off the air** | un récepteur ne répond plus depuis environ une minute (deux contrôles de suite) |
| **back on air** | il répond de nouveau |
| **restarted** | il répond sous un nouveau processus — redémarré par le watchdog, un script de démarrage ou le thermal guard |
| **thermal guard** | le guard change de stade (normal / warn / throttle / stopped) |
| **crash.log** | un `crash.log` d'un récepteur reçoit une nouvelle entrée ; le message en contient les dernières lignes |

Chaque événement a sa propre case. La même alerte est envoyée au plus une fois toutes les 5 minutes. Le premier contrôle après le démarrage du panneau ne fait qu'apprendre l'état actuel, donc redémarrer le panneau n'envoie rien.

**Telegram** (le plus simple) :

1. Dans Telegram, ouvrez **@BotFather**, envoyez `/newbot` et suivez les étapes ; il donne un **jeton de bot** (`123456789:AA…`).
2. Ouvrez votre nouveau bot et appuyez sur **Start** — un bot ne peut pas vous écrire avant cela.
3. Ouvrez **@userinfobot** ; l'**Id** qu'il répond est votre **chat ID**.
4. Cochez **TELEGRAM**, collez les deux, appuyez sur **✉ SEND TEST**.

**E-mail :** cochez **EMAIL** et remplissez le serveur SMTP de votre fournisseur, le port et la sécurité (SSL sur 465, STARTTLS sur 587), l'utilisateur, le mot de passe et **TO**. **FROM** peut être une adresse complète, `Nom <adresse>`, ou seulement un nom — un nom seul s'affiche comme nom de l'expéditeur sur l'adresse **USER**, l'utilisateur doit alors être une adresse complète.

**✉ SEND TEST** enregistre d'abord le formulaire, puis envoie ; la ligne sous les boutons montre la réponse de chaque canal, ou ce qui manque encore. Les réglages sont conservés dans `admin_config.json` sous `"alerts"` — le fichier privé du panneau, jamais inclus dans une sauvegarde ou une mise à jour. Un mot de passe ou un jeton enregistré s'affiche `********` et reste inchangé tant que vous n'en tapez pas un nouveau.

---

## Récepteurs

**Receivers** dans le menu de gauche (sur un téléphone : **📡 RX** dans la barre du bas) liste chaque récepteur de la station — d'après `receivers.toml`, ou seulement le principal sur une station à un récepteur — avec son nom, son nom `?rx=`, le matériel et son gain, la plage qu'il couvre et son centre, la largeur de bande, la fréquence et le mode avec lesquels démarre un nouvel auditeur, et s'il est à l'antenne. Chaque récepteur a ses propres boutons :

| Bouton | Ce qu'il fait |
|---|---|
| **✎ CHANGE SETTINGS** | le formulaire décrit ci-dessous |
| **■ STOP** / **▶ START** | arrête seulement ce récepteur (il demande d'abord ; les autres continuent), ou le redémarre. Le démarrage prend une vingtaine de secondes ; le bouton affiche *STARTING …* jusqu'à ce que le récepteur soit à l'antenne |
| **🏷 RENAME BUTTON** | seulement sur un récepteur sans formulaire de changement : le nom sur son bouton du sélecteur, enregistré dans `receivers.toml` ; rien ne redémarre |
| **🗑 DELETE** | seulement sur un récepteur supplémentaire qui n'est pas celui par défaut — voir ci-dessous |

**✎ CHANGE SETTINGS sur un récepteur supplémentaire qui s'accorde** (un récepteur dans `instances/<nom>/`) : indiquez la fréquence centrale en MHz, choisissez la largeur de bande parmi les fréquences d'échantillonnage que ce matériel accepte, et fixez où démarre un nouvel auditeur, dans quel mode, son gain et le nom sur son bouton ; le formulaire affiche la nouvelle plage avant que vous l'appliquiez. Une fréquence que le matériel ne peut pas accorder, une fréquence d'échantillonnage qu'il ne peut pas faire, ou une fréquence de départ hors de la nouvelle plage est refusée. **✔ APPLY AND RESTART THIS RECEIVER** alors :

- règle `-f`, `-s` et le gain dans `instance.env`, ainsi que `frequency`, `sps`, `fft_size` et la fréquence et le mode de départ dans `config.toml` — une correction de quartz (un `frequency` à quelques Hz de `-f`) est conservée comme la même erreur en ppm, elle reste donc juste sur la nouvelle bande, et `fft_size` est mis à l'échelle pour que la cascade garde sa résolution
- règle `siteSDRBaseFrequency` et `siteSDRBandwidth` dans `www/site_information.json` — la page du récepteur le lit à son ouverture, donc rien n'est recompilé
- règle le nom du bouton dans `receivers.toml` ; le nom du récepteur dans les annuaires et le nom du matériel restent tels quels
- garde les anciens fichiers dans `admin-backups/retune-<nom>-<date>/` et redémarre **seulement ce récepteur** — ses auditeurs sont coupés quelques secondes, les autres ne remarquent rien

**✎ CHANGE SETTINGS sur le récepteur principal et sur un récepteur à échantillonnage direct** (RX888, Fobos HF — il couvre de 0 Hz à la moitié de sa fréquence d'échantillonnage et n'a rien à accorder) : le formulaire contient le nom sur son bouton, la fréquence de départ, le mode et le gain. La fréquence et le mode de départ vont dans son `.toml`, le nom dans `receivers.toml`, et les anciens fichiers dans `admin-backups/settings-<nom>-<date>/`. **✔ APPLY** redémarre ce récepteur seulement si la fréquence de départ, le mode ou le gain ont changé ; avec le récepteur principal, RADE et DRM redémarrent aussi. La bande elle-même du récepteur principal se change avec `bash configure-station.sh` : sa page porte sa bande depuis la compilation, il faut donc recompiler la page, et l'assistant redémarre les services avec sudo. Sur une station à un récepteur sans `receivers.toml`, il n'y a pas de bouton de sélecteur, donc pas de nom à régler.

**AT VOLUME (0 – 100 %)**, dans les deux formulaires, est la position du curseur de volume avec laquelle un auditeur commence à sa première visite ; elle s'inscrit dans le `.toml` du récepteur sous `volume` dans `[input.defaults]`. Laissé vide, la ligne est retirée et la page démarre à 50 %. Un auditeur qui a déjà déplacé le curseur garde son propre réglage aux visites suivantes. Un volume modifié redémarre ce récepteur, comme une fréquence de départ modifiée.

**IQ FOR LISTENERS**, **WIDE IQ** et **WIDE IQ LISTENERS AT ONCE**, dans les deux formulaires, sont les réglages IQ du récepteur : `iq`, `iq_wide` et `iq_wide_listeners` sous `[server]` dans son `.toml` (voir la section sur l'IQ plus large dans le Guide de l'utilisateur). *off* masque le bouton IQ aux auditeurs. L'IQ large propose 24 ou 48 kHz, en plus des 12 kHz que reçoit tout le monde, à autant d'auditeurs à la fois que l'indique le dernier champ (`0` = sans limite). Seul un réglage que vous modifiez est écrit, et une ligne d'exemple comme `# iq_wide=48` devient la vraie ligne. Le serveur ne lit ces réglages qu'au démarrage, donc un réglage IQ modifié redémarre ce récepteur.

Sur tout récepteur, changer seulement le nom ne redémarre rien.

**Gain.** Pour un RX888, le formulaire contient le gain VGA (0–127), le mode de gain (low/high), l'atténuation (0–63) et **PGA on** ; pour un RTL-SDR, le gain RF parmi les pas que le tuner accepte, ou *auto* (l'AGC propre de la clé). Ils sont écrits dans la ligne d'arguments du récepteur — `RX888_ARGS` ou `RX_ARGS` — dans `instances/<nom>/instance.env` pour un récepteur supplémentaire, et dans `main.env` pour le principal. `main.env` est le `instance.env` du récepteur principal : chaque script de démarrage le lit en dernier, il n'est pas dans git et `update.sh` ne le remplace jamais. Le gain ne peut pas être dans `station.conf`, car `configure-station.sh` réécrit ce fichier. Sans `main.env`, le script de démarrage garde son gain intégré (`-g 50 -a 0 -m low --pga` pour le RX888). Les autres types de récepteur ont leur gain dans la même ligne d'arguments ; changez-le là à la main.

**🗑 DELETE** supprime définitivement un récepteur supplémentaire. Tapez son nom court pour confirmer ; il arrête alors ce récepteur (d'abord le watchdog) et ne va pas plus loin tant qu'un de ses processus tourne encore, retire son bloc `[[receiver]]` de `receivers.toml` (l'ancien fichier va dans `admin-backups/deleted-<nom>-<date>/`), et y déplace aussi son dossier `instances/<nom>/` — ou supprime le dossier si vous décochez *keep a copy*. Son bouton disparaît des pages ; le pilote et son fichier journal `logwebsdr-<nom>.txt` restent.

Le proxy relit `receivers.toml` dès qu'il change, donc un renommage, une suppression ou un récepteur ajouté atteignent les auditeurs sans redémarrer le proxy. Les pages ouvertes relisent la liste des récepteurs toutes les 15 secondes, donc le bouton d'un récepteur arrêté disparaît et revient de lui-même.

**➕ ADD NEW RECEIVER** ouvre un formulaire avec les questions de `add-receiver.sh` : le type de récepteur (avec *RTL-SDR Blog V4* pour une clé RTL), la fréquence centrale, la largeur de bande, un nom court (proposé d'après la bande, et vérifié libre), le nom de son bouton, son antenne et l'adresse publique de la station, et s'il faut installer le pilote, montrer le sélecteur de récepteur aussi sur la page principale, mettre `start-all.sh` comme script de démarrage de ce panneau, démarrer le récepteur et redémarrer le proxy. Au-dessus, la page liste les récepteurs USB que voit cet ordinateur, pour que vous sachiez que la clé est branchée. **▶ PREPARE** vérifie les réponses, les enregistre dans `instances/.add-rx.env` et donne deux lignes à lancer dans un terminal, chacune avec **📋 COPY** :

```bash
cd ~/PhantomSDR-Plus
./add-receiver.sh --answers instances/.add-rx.env
```

Le script prend chaque réponse dans ce fichier et ne demande que votre mot de passe sudo (le pilote et le redémarrage du proxy en ont besoin — le panneau d'administration n'exécute jamais rien en root), puis supprime le fichier. Rechargez ensuite la page, et le nouveau récepteur est dans la liste. `--answers FICHIER` marche aussi seul : un `ADD_RX_…=valeur` par ligne ; les noms sont listés en tête de `add-receiver.sh`.

---

## Paramètres — ports, démarrage/arrêt et HTTPS

**PORTS**, sous **🔑 UPDATE PASSWORD**, liste chaque port utilisé par la station — le port public, https (443/80) s'il est configuré, le spectrumserver de chaque récepteur, le panneau d'administration, les statistiques, RADE, DRM et le relais — lus dans `admin_config.json`, `station.conf` et `receivers.toml`, les mêmes fichiers que lit `proxy.py`. Un ● vert signifie que quelque chose écoute sur le port en ce moment, ○ que rien n'écoute. Seuls les ports marqués *open on the router* doivent être redirigés ; les autres restent sur cet ordinateur et sont atteints par le port public. Les services non installés n'apparaissent pas.

**SPECTRUMSERVER PORT (MAIN RECEIVER)** est `public_port` : le port sur lequel écoute le spectrumserver du récepteur principal — 9001 derrière `proxy.py` sur une station installée avec `install.sh`. Ce n'est **pas** le port des auditeurs ; celui-ci est affiché en lecture seule sous le champ, **Listener port (proxy)** (`proxy_port`), ou *none* sur une station sans proxy, où les deux sont identiques. **💾 SAVE SETTINGS** vérifie le nombre : le port du proxy lui-même est refusé, et un port différent du `[server] port` du récepteur en marche demande d'abord une confirmation — avec un mauvais nombre, `proxy.py` envoie les auditeurs, dès son prochain redémarrage, vers un port où rien ne répond. Pour déplacer vraiment spectrumserver, mettez le même nombre dans `[server] port` du `.toml` du récepteur, dans sa ligne de `receivers.toml` et dans ce champ, puis redémarrez le récepteur et le proxy.

**▶ START** et **■ STOP**, à côté de **DEFAULT START SCRIPT** et **DEFAULT STOP SCRIPT**, lancent aussitôt le script **enregistré**, après une confirmation — tous deux déconnectent tous les auditeurs. Si vous avez changé une sélection, enregistrez d'abord : le bouton refuse une sélection non enregistrée. Les premières secondes de la sortie s'affichent sous les boutons ; la sortie complète de ces scripts, et des redémarrages par le thermal guard, va dans `logs/admin-scripts.log`.

**HTTPS** indique si la station est servie en https.

- Sur une station en https, **🔍 CHECK** lance `setup-https.sh --status` : Caddy tourne-t-il, et le certificat répond-il ?
- Sur une station uniquement http, **🔒 SET UP HTTPS** vérifie ce qu'il peut — `station.conf`, que votre nom DNS se résout (une adresse IP ne peut pas avoir de certificat), si les ports 443 et 80 sont libres ou déjà à Caddy —, vous rappelle de rediriger TCP 443 et 80 sur le routeur, et donne les deux lignes à lancer dans un terminal, chacune avec **📋 COPY**. `setup-https.sh` y demande votre mot de passe sudo : le panneau d'administration n'exécute jamais rien en root. Rechargez la page une fois terminé, et le bouton devient **CHECK**. Voir [Accès sécurisé — https://](HTTPS.md).

---

## Sauvegarde & restauration des réglages de la station

**Settings → Backup & restore of the station settings.**

**⬇ DOWNLOAD BACKUP** donne un zip, `phantomsdr-settings-<indicatif>-<date>.zip`, avec les réglages propres de cette station :

- chaque `*.toml` de l'installation (configurations des récepteurs et `receivers.toml`) et `station.conf`
- `frontend/site_information.json`, `frontend/src/bands-config.js`, `markers.json`
- `autorun.json` (spot reporting), `websdr_relay.json`, `drm.json`, `admin_bans.json`
- pour chaque récepteur supplémentaire : `instances/<id>/config.toml`, `instance.env`, `markers.json`

et un `BACKUP-INFO.json` avec la date, l'ordinateur et la liste des fichiers. **Non** inclus : `admin_config.json` (mot de passe d'administration, secrets des alertes), les journaux et le programme lui-même.

**⬆ RESTORE** prend un zip de sauvegarde et ne réécrit **que** des fichiers de cette même liste — tout le reste du zip est ignoré et nommé. Avant qu'un fichier soit remplacé, l'actuel est copié dans `admin-backups/restore-<date-heure>/` (ignoré par git, jamais dans une mise à jour), si bien qu'une mauvaise restauration peut être annulée à la main. La réponse indique la suite : redémarrer les récepteurs après un `.toml`, `instance.env` ou `station.conf` ; reconstruire la page (`./recompile.sh --frontend`) après site information ou les réglages de bandes ; redémarrer `phantomsdr-websdr-relay` après les réglages du relais.

---

## Sur un téléphone ou une tablette

Sous 768 pixels de large, le menu de gauche devient un tiroir. La barre du bas a **DASH**, **RX** (Receivers), **USERS**, **GRAPHS**, **LOGS** et **☰ MENU**, qui fait glisser le menu complet avec toutes les pages ; il se ferme quand vous choisissez une page ou touchez à côté, et **MENU** reste allumé tant que vous êtes sur une page absente de la barre. Sur un téléphone, les tableaux deviennent une carte par ligne (la liste des récepteurs déjà sur une tablette, jusqu'à 1100 pixels), les formulaires passent sur une colonne, et la note grise d'un titre de carte passe sous le titre. Top Processes, l'éditeur Markers et la grille bande/mode de Spot Reporting restent des tableaux et défilent sur le côté.

---

## Thèmes

Le sélecteur **THEME** se trouve dans la barre du haut de chaque page, entre **ONLINE** et l'horloge, et de nouveau dans **Settings → Appearance** ; les deux affichent toujours le même choix. Un thème s'applique aussitôt, sans rechargement.

| Thème | Aspect |
|---|---|
| **Phosphor green** | le terminal vert classique (par défaut) |
| **Amber display** | le même en ambre chaud, comme l'affichage d'un vieux transceiver |
| **Metal panel** | la finition grise anodisée de la page du récepteur, éclairée d'en haut à droite |
| **Modern dark** | anthracite avec un accent bleu, sans halo |
| **Light** | blanc et gris, texte noir — pour la lumière du jour |
| **Auto (day/night)** | **Light** du lever au coucher du soleil, **Modern dark** la nuit |

Tous les thèmes utilisent les mêmes polices et les mêmes tailles ; seules les couleurs et la finition changent. *On air* reste vert et les avertissements orange et rouges dans chaque thème, et les **Graphs** suivent aussi le thème. **Auto** calcule le lever et le coucher du soleil au locator de la station (`siteGridSquare` dans Site Info) et bascule de lui-même tant que la page est ouverte ; sans locator, il prend 07:00–19:00 heure locale pour le jour. Le choix est conservé par navigateur, un PC et un téléphone peuvent donc avoir des thèmes différents. La page de connexion garde l'aspect vert.

---

## Dépannage

| Problème | Correctif |
|---|---|
| Le panneau d'administration ne démarre pas | Consultez `admin.log` — généralement un paquet Python manquant |
| Le proxy ne démarre pas | Exécutez `python3 -c "import aiohttp"` — en cas d'échec : `pip3 install aiohttp --break-system-packages` |
| Fedora / openSUSE : le panneau ou le proxy ne démarre pas au boot (`status=209/STDOUT`, `avc: denied { open } … admin.log` ou `proxy.log` dans `sudo ausearch -m avc -ts boot`) | SELinux interdit à systemd d'ouvrir des fichiers journaux dans votre dossier personnel. Exécutez `./setup_admin.sh --selinux` (étiquette les deux journaux `var_log_t`), puis `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Les nouvelles installations le font automatiquement |
| Fedora / openSUSE : tout fonctionne, mais personne en dehors de cette machine ne peut se connecter | firewalld bloque le port public. Exécutez `./setup_admin.sh --firewall` (ouvre le port du proxy de façon permanente). Les nouvelles installations le font automatiquement ; `setup_websdr_relay.sh` le propose pour le port du relais et `setup-https.sh` ouvre 443/80 |
| `systemctl is-active` reste à `activating`, le journal indique `address already in use` | Une copie lancée à la main avec `manage_admin.sh start` occupe encore le port. `./manage_admin.sh stop`, puis `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Lorsque les unités sont installées, `manage_admin.sh start` passe désormais la main à systemctl au lieu de lancer une seconde copie |
| `proxy.log` est vide | Vérifiez d'abord que le proxy tourne réellement (`./manage_admin.sh status`). Si oui, vous êtes sur une ancienne version : le lanceur doit utiliser `python3 -u` (non tamponné — sinon la bannière de démarrage ne sort jamais du tampon de 8 Ko), et le `main()` de `proxy.py` doit appeler `logging.basicConfig()` (sinon le journaliseur d'accès d'aiohttp n'a pas de gestionnaire et chaque ligne de requête est perdue, car `web.AppRunner` — contrairement à `web.run_app` — ne configure pas la journalisation). |
| Le proxy démarre mais la cascade est vide | Vérifiez `sdr_host` dans `admin_config.json` — normalement `127.0.0.1`. S'il contient encore une ancienne IP LAN d'une version précédente, corrigez-la et [Redémarrer le panneau](#redémarrer-le-panneau) |
| Le bouton Kick indique « no connections » | Exécutez `getcap $(which ss)` — sans `cap_net_admin`, lancez `sudo setcap cap_net_admin+ep $(which ss)` |
| L'état affiche toujours OFFLINE | Allez dans Settings → SDR Process Name — indiquez le nom exact affiché par `ps -eo comm,args \| grep -v grep` |
| La page Users n'affiche aucune donnée | Vérifiez que le point de terminaison fonctionne : `curl http://127.0.0.1:<public_port>/~~users` |
| Un navigateur externe obtient NetworkError | Vérifiez que le proxy tourne : `./manage_admin.sh status` |
| Le proxy est cassé après un changement réseau | Concerne uniquement le cas où `sdr_host` contient encore une IP LAN — mettez-le à `127.0.0.1` et [Redémarrer le panneau](#redémarrer-le-panneau) |
| Le bouton de suppression du chat n'a aucun effet | Vérifiez les droits d'écriture sur le fichier de journal du chat : `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Le message sur la cascade n'apparaît pas | Vérifiez que le proxy tourne (`./manage_admin.sh status`) et que le frontend est sur une version récente incluant le rendu de la superposition |
| Message sur la cascade perdu après un redémarrage | Comportement attendu — l'état du message n'est qu'en mémoire ; renvoyez-le après le redémarrage du panneau |
| Le « Start » de Spot Reporting échoue / le démon se termine aussitôt | Consultez `autorun.log`. C'est généralement le lien symbolique `autorun/node_modules` manquant (`ln -sfn ../frontend/node_modules autorun/node_modules`) ou `taskset` non installé (`sudo apt install -y util-linux`). |
| Spot Reporting : le démon tourne mais `decodes` reste à 0 et `autorun.log` montre `504` / `tap closed 1006` | La prise audio n'atteint pas spectrumserver. Le démon détecte automatiquement le port depuis la configuration du serveur **en cours d'exécution** ; la ligne de journal `[autorun] tap backend: HOST:PORT` doit correspondre à votre `[server] port`. Si elle est fausse (ou si le serveur n'était pas lancé au démarrage), fixez-le dans `autorun.json` : `"server": { "host": "127.0.0.1", "port": 9001 }`, puis Stop→Start. |
| **SAVE CONFIG** refusé : « N slots at once exceeds cap of M (UTC hour …) » | MAX SLOTS limite les créneaux qui tournent en même temps. Augmentez-le, ou retirez des heures dans le SCHEDULE là où la ligne AT ONCE est rouge. |
| Spot Reporting n'a pas démarré après un redémarrage | **Start automatically after a reboot or crash** doit être coché et enregistré, et un **STOP** tient jusqu'à **START** (la carte d'état indique `ON, held by STOP`). Le journal AUTORUN montre chaque ligne `[admin …] autostart:` ; le panneau lui-même doit tourner (`sudo systemctl status phantomsdr-admin`). |
| Spot Reporting affiche « 0 sent » | Normal pendant les premières minutes — PSK Reporter envoie toutes les 5 min, wsprnet toutes les 2 min. Vérifiez qu'une destination est activée et que le démon tourne. |
| Les nouvelles bandes/modes n'apparaissent pas dans la matrice | [Redémarrer le panneau](#redémarrer-le-panneau) — la matrice est chargée au démarrage. |
| `autorun.log` affiche `MODULE_TYPELESS_PACKAGE_JSON` / « Reparsing as ES module … performance overhead » | Avertissement cosmétique (le décodage fonctionne toujours). Il manque `"type": "module"` à `frontend/src/modules/package.json` ; ajoutez cette ligne près du début, puis Stop→Start. Aucune recompilation du frontend n'est nécessaire — le démon importe directement le fichier source. |
| Le « Start » de Spot Reporting échoue avec `taskset: … Invalid argument` sur un PC ancien/modeste | Ne devrait pas se produire avec le lanceur tenant compte de la configuration — la plage de cœurs est déduite du nombre de CPU et passe sans épinglage sur ≤ 4 cœurs. Si cela arrive, votre `admin_server.py` est antérieur à ce changement ; mettez-le à jour (`_autorun_taskset_prefix`) et [Redémarrer le panneau](#redémarrer-le-panneau). |
| Le badge REPORTING n'apparaît pas sur la cascade | Le report doit être activé avec au moins un créneau ; le badge lit `/autorun-active.json`. Recompilez le frontend si `dist/index.html` est antérieur au badge. |
| **✉ SEND TEST** indique "Nothing to send to: …" | Le message dit ce qui manque : cochez **TELEGRAM** ou **EMAIL** ; Telegram demande le jeton du bot et le chat ID ; l'e-mail demande le serveur SMTP et **TO**. |
| Test e-mail : `5.5.2 … Sender address rejected: need fully-qualified address` | L'expéditeur n'est pas une adresse complète. Mettez votre adresse dans **FROM**, ou gardez-y seulement un nom et faites de **USER** votre adresse complète ; [redémarrez le panneau](#redémarrer-le-panneau) s'il est antérieur à cette règle. |
| Le test Telegram échoue avec `Forbidden` / aucun message n'arrive | Ouvrez d'abord votre bot dans Telegram et appuyez sur **Start** ; vérifiez le chat ID avec @userinfobot (votre propre Id, pas celui du bot). |
| Aucune alerte quand un récepteur s'est arrêté | Il faut environ une minute (deux contrôles) ; la même alerte arrive au plus une fois toutes les 5 minutes ; un redémarrage du panneau n'envoie rien ; vérifiez la case de l'événement. |
| La page Visitors affiche "no visitors" | La page lit `logs/users_*.jsonl` (et `instances/<id>/logs/`) ; ils sont écrits par la journalisation des statistiques des récepteurs — vérifiez qu'ils existent pour les jours choisis. |
| Le sélecteur THEME manque, ou un nouveau thème ne s'applique pas | [Redémarrez le panneau](#redémarrer-le-panneau), puis rechargez la page avec **Ctrl+F5** pour que le navigateur abandonne l'ancienne copie. |
