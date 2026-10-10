# Annexe — Référence des commandes

Toutes les commandes qu'un sysop utilise pour faire fonctionner une station PhantomSDR-Plus, regroupées par tâche, chacune avec une ligne d'explication. Elles s'exécutent depuis le répertoire `PhantomSDR-Plus`, sauf indication contraire. L'installation manuelle pas à pas (dépendances, Node.js, OpenCL, compilation à la main) n'est pas reprise ici — voir le [Guide d'installation](INSTALLATION.md). La dernière colonne renvoie à la section qui explique la commande ; dans le PDF, le numéro de page suit le lien.

## Installation et configuration de la station

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Télécharge le projet. | [README](README.md#installation) |
| `bash install.sh` | Installeur complet pour Ubuntu/Debian : pose les questions de la station, installe, compile. | [Guide d'installation](INSTALLATION.md#cloner-le-dépôt-et-lancer-linstallateur) |
| `bash install_fedora.sh` | Le même installeur pour Fedora. | [Guide d'installation](INSTALLATION.md#cloner-le-dépôt-et-lancer-linstallateur) |
| `bash install_arch.sh` | Le même installeur pour Arch Linux. | [Guide d'installation](INSTALLATION.md#cloner-le-dépôt-et-lancer-linstallateur) |
| `bash install_opensuse.sh` | Le même installeur pour openSUSE. | [Guide d'installation](INSTALLATION.md#cloner-le-dépôt-et-lancer-linstallateur) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Installation sans surveillance (ici pour un RX888 MkII) ; chaque question prend sa valeur par défaut. | [Guide d'installation](INSTALLATION.md#installation-sans-surveillance) |
| `chmod +x *.sh` | Rend les scripts de nouveau exécutables (par exemple après la décompression d'un zip). | [Guide d'installation](INSTALLATION.md#mettre-à-jour-à-la-main) |
| `bash configure-station.sh` | Assistant de station : pose les questions, enregistre `station.conf` et en déduit tous les fichiers de configuration. | [Guide d'installation](INSTALLATION.md#les-questions-de-la-station) |
| `bash configure-station.sh --ask` | Pose les questions et enregistre seulement `station.conf`. | [Guide d'installation](INSTALLATION.md#les-questions-de-la-station) |
| `bash configure-station.sh --apply` | Réécrit les fichiers de configuration depuis `station.conf` sans rien demander. | [Guide d'installation](INSTALLATION.md#les-questions-de-la-station) |
| `bash configure-station.sh --show` | Affiche les réponses actuelles. | [Guide d'installation](INSTALLATION.md#les-questions-de-la-station) |
| `./add-receiver.sh` | Ajoute un récepteur supplémentaire (par exemple un RTL-SDR pour le 2 m) à côté du principal. | [Guide d'installation](INSTALLATION.md#plusieurs-récepteurs-sur-un-ordinateur) |

## Pilotes des récepteurs

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./setup-rx888-udev.sh` | Installe les règles udev du RX888 pour qu'il fonctionne sans sudo. | [Guide d'installation](INSTALLATION.md#exécuter-rx888_stream-sans-sudo-règles-udev) |
| `./setup-rtlsdr.sh` | Installe le pilote RTL-SDR ; demande si la clé est une Blog V4. | [Guide d'installation](INSTALLATION.md#plusieurs-récepteurs-sur-un-ordinateur) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Installe le pilote RTL-SDR Blog V4 sans demander. | [Guide d'installation](INSTALLATION.md#plusieurs-récepteurs-sur-un-ordinateur) |
| `./setup-rsp1a.sh` | Installe la chaîne de pilotes libre du SDRplay RSP1A. | [Guide d'installation](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Installe la chaîne de pilotes de l'Airspy HF+. | [Guide d'installation](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Installe la chaîne de pilotes du RigExpert Fobos. | [Guide d'installation](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Installe le paquet hackrf et sa règle udev. | [Guide d'installation](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Vérifie que la clé RTL-SDR est détectée. | [Guide d'installation](INSTALLATION.md#testez-le-rtl-sdr) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Vérifie que le RSP1A est détecté (`driver=fobos`, `driver=airspyhf` pour les autres). | [Guide d'installation](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Liste les pilotes SoapySDR installés. | [Guide d'installation](INSTALLATION.md#fobos-ou-airspy-hf-introuvable) |

## Démarrer et arrêter le récepteur

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./start-rx888mk2.sh` | Démarre (ou redémarre) le récepteur RX888 MkII avec son watchdog et affiche le journal jusqu'à ce qu'il soit prêt. | [README](README.md#fonctionnement-de-base) |
| `./start-rtl.sh` | Idem pour un RTL-SDR. | [Guide d'installation](INSTALLATION.md#1-essai) |
| `./start-rsp1a.sh` | Idem pour un SDRplay RSP1A. | [README](README.md#fonctionnement-de-base) |
| `./start-airspyhf.sh` | Idem pour un Airspy HF+. | [README](README.md#fonctionnement-de-base) |
| `./start-hackrf.sh` | Idem pour un HackRF One. | [README](README.md#fonctionnement-de-base) |
| `./start-fobos.sh` | Idem pour un Fobos, entrée RF (25–6000 MHz). | [README](README.md#fonctionnement-de-base) |
| `./start-fobos-hf.sh` | Idem pour un Fobos, échantillonnage direct HF (0–25 MHz). | [README](README.md#fonctionnement-de-base) |
| `./start-all.sh` | Démarre tous les récepteurs listés dans `receivers.toml`. | [Plusieurs récepteurs](MULTI_RECEIVER.md#5-démarrer-et-arrêter) |
| `./start-rx888mk2.sh -q` | Tout script de démarrage avec `-q` : deux lignes de sortie au lieu du journal en direct. | [README](README.md#fonctionnement-de-base) |
| `INSTANCE=vhf ./start-rtl.sh` | Démarre un second récepteur configuré dans `instances/vhf/`. | [Plusieurs récepteurs](MULTI_RECEIVER.md#3-ajouter-un-second-récepteur) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Fixe le serveur sur ces cœurs CPU (`none` = aucune affectation). | [README](README.md#fonctionnement-de-base) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Démarre sans le sidecar RADE. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `./stop-websdr.sh` | Arrête tous les récepteurs de cette installation et leur watchdog. | [Guide d'installation](INSTALLATION.md#7-arrêtez-le-serveur) |
| `./stop-websdr.sh main` | Arrête seulement le récepteur principal. | [Plusieurs récepteurs](MULTI_RECEIVER.md#5-démarrer-et-arrêter) |
| `./stop-websdr.sh vhf` | Arrête seulement le récepteur démarré avec `INSTANCE=vhf`. | [Plusieurs récepteurs](MULTI_RECEIVER.md#5-démarrer-et-arrêter) |
| `tail -f logwebsdr.txt` | Suit le journal du récepteur en direct. | [Guide d'installation](INSTALLATION.md#2-recherchez-déventuelles-erreurs) |

## Démarrage au boot

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `bash setup-autostart.sh` | Démarre le récepteur au boot (le script nommé dans `station.conf`). | [Guide d'installation](INSTALLATION.md#mise-en-place-du-démarrage-automatique) |
| `bash setup-autostart.sh start-rtl.sh` | Idem, pour un script de démarrage précis. | [Guide d'installation](INSTALLATION.md#mise-en-place-du-démarrage-automatique) |
| `bash setup-autostart.sh start-all.sh` | Idem, pour tous les récepteurs de `receivers.toml`. | [Guide d'installation](INSTALLATION.md#mise-en-place-du-démarrage-automatique) |
| `bash setup-autostart.sh --status` | Indique s'il est installé, et pour quel script. | [Guide d'installation](INSTALLATION.md#mise-en-place-du-démarrage-automatique) |
| `bash setup-autostart.sh --remove` | Arrête le démarrage au boot (le récepteur continue de tourner). | [Guide d'installation](INSTALLATION.md#mise-en-place-du-démarrage-automatique) |

## Compilation et mise à jour

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./recompile.sh` | Recompile le serveur et/ou la page web ; demande quoi compiler. | [Guide d'installation](INSTALLATION.md#mettre-à-jour-à-la-main) |
| `./recompile.sh --backend` | Recompile seulement le serveur. | [Guide d'installation](INSTALLATION.md#mettre-à-jour-à-la-main) |
| `./recompile.sh --frontend` | Recompile seulement la page web (bureau et /mobile). | [Guide d'installation](INSTALLATION.md#mettre-à-jour-à-la-main) |
| `./recompile.sh --both` | Recompile les deux. | [Guide d'installation](INSTALLATION.md#mettre-à-jour-à-la-main) |
| `cd frontend && ./build-all.sh` | Compile la page bureau et /mobile. | [Édition des variantes](EDITING_VARIANTS.md#6-après-modification--reconstruire) |
| `cd frontend && ./build-default.sh` | Compile seulement la page bureau. | [Édition des variantes](EDITING_VARIANTS.md#6-après-modification--reconstruire) |
| `cd frontend && ./build-mobile.sh` | Compile seulement /mobile. | [Édition des variantes](EDITING_VARIANTS.md#6-après-modification--reconstruire) |
| `bash update.sh` | Indique ce qu'une nouvelle version changerait, puis demande s'il faut mettre à jour. | [Guide d'installation](INSTALLATION.md#utilisation) |
| `./update.sh --check` | Rapport seul, sans question (pour cron ; code de sortie 10 = mise à jour en attente). | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --apply` | Met à jour, en demandant pour les fichiers que vous avez modifiés. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --apply --yes` | Met à jour sans surveillance ; chaque fichier que vous avez modifié est conservé. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --apply --prune` | Propose aussi de supprimer les fichiers retirés en amont. | [Guide d'installation](INSTALLATION.md#utilisation) |
| `./update.sh --from FILE` | Prend la nouvelle version depuis un `.zip`/`.tar.gz` ou un dossier — sans réseau. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --ref v5.1.0` | Met à jour vers un tag, une branche ou un commit au lieu de l'arbre courant. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --list-excludes` | Affiche les fichiers que l'outil de mise à jour ne touche jamais. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --verbose` | Liste tous les fichiers, pas seulement les 40 premiers. | [Guide d'installation](INSTALLATION.md#autres-options) |
| `./update.sh --restore LAST` | Remet les fichiers écrasés par la dernière mise à jour. | [Guide d'installation](INSTALLATION.md#annuler-une-mise-à-jour) |
| `./update.sh --restore 20260923-164530` | Remet les fichiers de cette exécution précise. | [Guide d'installation](INSTALLATION.md#annuler-une-mise-à-jour) |

## Apparence de la page

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./waterfall.sh` | Change le niveau minimal par défaut de la cascade ; affiche la valeur actuelle et demande. | [README](README.md#plancher-de-la-cascade--waterfallsh) |
| `./waterfall.sh -v -15` | Le règle à −15 dB sans demander (`-y` saute aussi les confirmations). | [README](README.md#plancher-de-la-cascade--waterfallsh) |
| `./waterfall.sh -s` | Affiche seulement les valeurs actuelles. | [README](README.md#plancher-de-la-cascade--waterfallsh) |
| `./smeter_theme.sh` | Choisit le thème par défaut du S-mètre dans un menu. | [Édition des variantes](EDITING_VARIANTS.md#les-trois-cadrans--et-smeter_themesh) |
| `./smeter_theme.sh vintage` | Applique ce thème tout de suite, puis propose la recompilation. | [Édition des variantes](EDITING_VARIANTS.md#les-trois-cadrans--et-smeter_themesh) |
| `./smeter_theme.sh dark --build` | L'applique et recompile sans demander (`--no-build` saute la compilation). | [Édition des variantes](EDITING_VARIANTS.md#les-trois-cadrans--et-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Pour les nouveaux visiteurs seulement ; les autres gardent le leur. | [Édition des variantes](EDITING_VARIANTS.md#les-trois-cadrans--et-smeter_themesh) |

## Panneau d'administration et proxy

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./setup_admin.sh` | Configuration interactive du panneau : ports, scripts, thermal guard, unités systemd. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#étape-2--lancer-le-script-dinstallation) |
| `./setup_admin.sh --sudoers` | Installe seulement la règle sudoers, pour redémarrer les deux unités sans mot de passe. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#étape-2--lancer-le-script-dinstallation) |
| `./setup_admin.sh --proxy-only` | Installe seulement le proxy sur le port public, pour une station sans panneau. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#étape-2--lancer-le-script-dinstallation) |
| `./manage_admin.sh start` | Démarre le panneau et le proxy (hors systemd). | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-a--manage_adminsh-sans-root-rien-à-installer) |
| `./manage_admin.sh stop` | Arrête les deux. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-a--manage_adminsh-sans-root-rien-à-installer) |
| `./manage_admin.sh status` | Indique s'ils tournent, avec leurs PID. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-a--manage_adminsh-sans-root-rien-à-installer) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Redémarre panneau et proxy sous systemd (le récepteur continue de tourner). | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#redémarrer-le-panneau) |
| `sudo systemctl enable --now phantomsdr-admin` | Démarre le panneau maintenant et à chaque boot (`phantomsdr-proxy` de même). | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-b--unités-systemd-démarrage-au-boot-redémarrage-après-plantage) |
| `sudo systemctl disable --now phantomsdr-admin` | Arrête le panneau et ne le démarre plus au boot. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-b--unités-systemd-démarrage-au-boot-redémarrage-après-plantage) |
| `systemctl status phantomsdr-admin` | Affiche l'état du panneau (sans sudo). | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-b--unités-systemd-démarrage-au-boot-redémarrage-après-plantage) |
| `sudo journalctl -u phantomsdr-admin -f` | Suit le journal du panneau. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#méthode-b--unités-systemd-démarrage-au-boot-redémarrage-après-plantage) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Fixe le démon de décodage autorun sur ces cœurs CPU. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#remplacement-manuel-de-lépinglage-cpu-avancé) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Installe la rotation des journaux du panneau, du proxy et d'autorun. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#rotation-de-proxylog-et-adminlog) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Essai à blanc de la rotation des journaux. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#rotation-de-proxylog-et-adminlog) |

## Thermal guard

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `python3 thermal_guard.py --once` | Affiche le capteur, le point de déclenchement et les seuils ; n'agit pas. | [Thermal Guard](THERMAL_GUARD.md#2-démarrage-rapide) |
| `python3 thermal_guard.py --mode log` | Surveille la température en direct, journalisation seule (Ctrl-C pour quitter). | [Thermal Guard](THERMAL_GUARD.md#7-fonctionnement-sans-le-panneau-dadministration) |
| `python3 thermal_guard.py --mode stop+restart` | Le lance armé : arrête le récepteur en cas de surchauffe et le redémarre une fois refroidi. | [Thermal Guard](THERMAL_GUARD.md#7-fonctionnement-sans-le-panneau-dadministration) |
| `python3 thermal_guard.py --config FILE` | Utilise un autre fichier de configuration. | [Thermal Guard](THERMAL_GUARD.md#7-fonctionnement-sans-le-panneau-dadministration) |
| `./setup-cpufreq-perms.sh` | Permet au guard d'abaisser la fréquence CPU sans tourner en root. | [Thermal Guard](THERMAL_GUARD.md#8-activer-létage-throttle-sans-root) |
| `sudo systemctl enable --now thermal-guard` | Fait tourner le guard comme service autonome (seulement sans panneau d'administration). | [Thermal Guard](THERMAL_GUARD.md#7-fonctionnement-sans-le-panneau-dadministration) |

## Connexions, pare-feu et HTTPS

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./setup-firewall.sh --show` | Affiche les règles noyau de limitation des connexions ; ne change rien. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ./setup-firewall.sh --check` | Valide les règles avec votre noyau. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ./setup-firewall.sh --apply` | Charge les règles, avec retour arrière automatique après 60 secondes. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ./setup-firewall.sh --persist` | Recharge les règles à chaque boot. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ./setup-firewall.sh --status` | Affiche les compteurs de paquets de chaque règle. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ./setup-firewall.sh --remove` | Supprime toutes les règles. | [Limites de connexion](CONNECTION_LIMITS.md#5-la-protection-au-niveau-du-noyau) |
| `sudo ufw allow 9000/tcp` | Ouvre le port public dans le pare-feu ufw. | [Guide d'installation](INSTALLATION.md#impossible-daccéder-depuis-dautres-appareils) |
| `bash setup-https.sh` | Active HTTPS avec un certificat Let's Encrypt gratuit ; HTTP continue de fonctionner. | [Accès sécurisé (HTTPS)](HTTPS.md#sur-une-station-qui-tourne-déjà) |
| `bash setup-https.sh --lan` | HTTPS dans le réseau local seulement (les navigateurs avertissent sur le certificat). | [Accès sécurisé (HTTPS)](HTTPS.md#réseau-local-uniquement----lan) |
| `bash setup-https.sh --status` | Indique si HTTPS est actif et si le certificat répond. | [Accès sécurisé (HTTPS)](HTTPS.md#vérifier-et-désactiver) |
| `bash setup-https.sh --remove` | Désactive HTTPS ; le HTTP simple reste inchangé. | [Accès sécurisé (HTTPS)](HTTPS.md#vérifier-et-désactiver) |

## Services optionnels

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `./install-stats-server.sh` | Installe le serveur de statistiques (CPU, température, utilisateurs). | [Serveur de statistiques](../sdr-stats/readme_fr.md#étape-1--exécuter-le-script) |
| `sudo systemctl restart sdr-stats.service` | Le redémarre (`start`, `stop`, `status` de même). | [Serveur de statistiques](../sdr-stats/readme_fr.md#gestion-du-service) |
| `sudo journalctl -u sdr-stats.service -f` | Suit son journal. | [Serveur de statistiques](../sdr-stats/readme_fr.md#gestion-du-service) |
| `curl http://localhost:3001/api/system-stats` | Vérifie qu'il répond. | [Serveur de statistiques](../sdr-stats/readme_fr.md#test-1--vérifier-le-point-de-terminaison-de-lapi) |
| `./install_rade.sh` | Installe le sidecar RADE / FreeDV (`install_rade_ubuntu22.sh` sous Ubuntu 22.04). | [RADE README](RADE_README.md#linstallation--la-voie-courte) |
| `./rade.sh start` | Démarre le sidecar RADE avec son watchdog. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `./rade.sh stop` | L'arrête, avec son watchdog et ses processus de décodage. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `./rade.sh restart` | L'arrête et le redémarre proprement. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `./rade.sh status` | Indique s'il tourne. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Le redémarre en donnant trois cœurs CPU à chaque auditeur. | [RADE README](RADE_README.md#si-les-cœurs-saturent-avant-le-coude) |
| `tail -f rade.log` | Suit le journal RADE. | [RADE README](RADE_README.md#contrôle-du-sidecar) |
| `python3 rade_loadtest.py` | Mesure combien d'auditeurs RADE cette machine supporte. | [RADE README](RADE_README.md#prérequis-1) |
| `./kiwi_install.sh` | Installe l'émulation de client KiwiSDR (pour les logiciels Kiwi comme AetherSDR). | [Émulation de client KiwiSDR](Aether_config.md#2-installer-la-passerelle) |
| `./setup_websdr_relay.sh` | Installe le relais qui permet à la réception en diversité d'utiliser un WebSDR comme second récepteur. | [Diversité de réception](RECEIVE_DIVERSITY.md#installer-le-relais) |

## Contrôle du transceiver (pont TCI)

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Donne à votre utilisateur l'accès au port série du poste (reconnectez-vous ensuite). | [Pilotage du transceiver](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Lit la fréquence du poste via Hamlib — vérifie la liaison CAT (modèle, port et vitesse de votre poste). | [Pilotage du transceiver](RIG_CONTROL.md#exemple--icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Lance le pont sur un `rigctld` déjà en marche. | [Pilotage du transceiver](RIG_CONTROL.md#exemple--yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Lance le pont en pilotant le poste directement via `rigctl` (la méthode sous Windows). | [Pilotage du transceiver](RIG_CONTROL.md#exemple--yaesu-ft-991a) |

## Vérifications et dépannage

| Commande | Ce qu'elle fait | Voir |
|---|---|---|
| `ss -tlnp` | Liste les ports en écoute et les programmes derrière. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#commandes-manuelles-utiles) |
| `sudo lsof -i :9002` | Indique quel programme occupe un port. | [Guide d'installation](INSTALLATION.md#port-déjà-utilisé) |
| `pkill -f admin_server.py` | Termine un panneau lancé à la main (`proxy.py` de même). | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#commandes-manuelles-utiles) |
| `sudo fuser -k 3000/tcp` | Libère un port tenu par un programme bloqué. | [Configuration du panneau d'administration](ADMIN_PANEL_SETUP.md#commandes-manuelles-utiles) |
| `lsusb` | Liste les périphériques USB — le récepteur est-il vu ? | [Guide d'installation](INSTALLATION.md#rtl-sdr-introuvable) |
| `sudo timedatectl set-ntp true` | Garde l'horloge synchronisée — les décodeurs FT8/FT4/WSPR en ont besoin. | [Guide d'installation](INSTALLATION.md#meson-setup-sarrête-sur-clock-skew-detected) |

## Scripts internes (à ne pas lancer à la main)

| Script | Ce qu'il fait | Voir |
|---|---|---|
| `start-*.sh --watchdog` | Le watchdog qu'un script de démarrage lance pour lui-même. | [Guide d'installation](INSTALLATION.md#1-créez-le-fichier-de-service) |
| `setup-sdr-common.sh` | Fonctions communes chargées par les installeurs de pilotes `setup-*.sh`. | [Structure du projet](PROJECT_STRUCTURE.md#arborescence-des-répertoires) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | L'ancienne chaîne de démarrage, conservée pour les stations existantes ; les scripts `start-*.sh` la remplacent. | [Structure du projet](PROJECT_STRUCTURE.md#arborescence-des-répertoires) |
