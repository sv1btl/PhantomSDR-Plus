# Guide d'installation de PhantomSDR-Plus pour les opérateurs système

Ce guide complet vous accompagne dans l'installation et la configuration de PhantomSDR-Plus sur votre serveur.

---

## Table des matières

1. [Configuration système requise](#configuration-système-requise)
2. [Installation de PhantomSDR-Plus](#installation-de-phantomsdr-plus) — le script et [ce qu'il fait](#ce-que-fait-linstallateur)
3. [Rapporteur de spots autorun (FT8/FT4/WSPR)](#rapporteur-de-spots-autorun-ft8ft4wspr)
4. [Émulation des clients KiwiSDR (facultatif)](#émulation-des-clients-kiwisdr-facultatif)
5. [Configuration](#configuration)
6. [Configuration propre à chaque appareil SDR](#configuration-propre-à-chaque-appareil-sdr)
7. [Tests et vérification](#tests-et-vérification)
8. [Mise en place du démarrage automatique](#mise-en-place-du-démarrage-automatique)
9. [Protection thermique du processeur](#protection-thermique-du-processeur)
10. [Dépannage](#dépannage)

---

## Configuration système requise

### Systèmes d'exploitation pris en charge

**Principal (recommandé) :**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) et 26.04 LTS (Resolute) — 24.04 recommandée
- Debian 12 (Bookworm) et Debian 13 (Trixie)

**Alternative :**
- Fedora (dernière version stable)
- Arch Linux (rolling release)
- openSUSE Tumbleweed (pas Leap — voir la note plus bas)

### Configuration matérielle requise

**Configuration minimale :**
- Processeur : double cœur (2 GHz ou plus)
- RAM : 4 Go
- Stockage : 10 Go d'espace libre
- Réseau : connexion 100 Mbit/s

**Configuration recommandée :**
- Processeur : quadricœur ou mieux (Ryzen 5 2600, Intel i5-6500T ou supérieur)
- RAM : 8 Go ou plus
- Stockage : SSD de 20 Go ou plus
- GPU : AMD/NVIDIA compatible OpenCL (vivement recommandé)
- Réseau : connexion 1 Gbit/s

**Configuration hautes performances :**
- Processeur : 6 cœurs ou plus (Ryzen 7, Intel i7 ou mieux)
- RAM : 16 Go ou plus
- Stockage : SSD NVMe
- GPU : GPU dédié compatible OpenCL/CUDA
- Réseau : 1 Gbit/s ou mieux

---

## Installation de PhantomSDR-Plus

### Cloner le dépôt et lancer l'installateur

```bash
cd ~
git clone https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
bash install.sh
```

L'installateur pose d'abord quelques questions sur votre station — le récepteur, ce qu'il doit recevoir, votre indicatif et votre locator, votre adresse sur internet et les compléments souhaités — puis il installe tout seul, sans plus rien demander. À la fin il démarre le récepteur et affiche l'adresse qu'utilisent les auditeurs et l'unique port à ouvrir sur votre routeur (9000, sauf si vous en avez choisi un autre). Les questions sont décrites deux sections plus bas, dans *Les questions de la station*.

Tapez `bash install.sh` exactement ainsi : il n'y a pas d'étape `chmod`. Une copie téléchargée en ZIP ou depuis la page GitHub n'a pas de droits d'exécution, et l'installateur les pose lui-même.

> **PhantomSDR-Plus tourne déjà ?** Ne le réinstallez pas : mettez-le à jour. Récupérez une fois l'outil de mise à jour et lancez-le ; il montre ce qui changerait et demande avant d'écrire quoi que ce soit. Votre configuration, vos marqueurs, le mot de passe d'administration, la liste de fréquences et l'historique du chat ne sont jamais touchés :
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> bash update.sh
> ```
>
> Les détails sont dans le chapitre *Mise à jour de PhantomSDR-Plus*. Relancer l'installateur sur une station qui fonctionne n'est nécessaire que si une recompilation échoue faute de paquets système.

Prenez le script qui correspond à votre système. Ils font le même travail et posent les mêmes questions ; seul le gestionnaire de paquets diffère :

| Système | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Un seul installateur pour toutes les versions de Debian et d'Ubuntu.** `install.sh` lit `/etc/os-release` et la version de Boost installée puis s'adapte de lui-même ; les anciens `install_ubuntu22.sh`, `install-Deb12.sh` et `install_ubuntu26.sh` ont disparu. Il définit `DEBIAN_FRONTEND=noninteractive`, afin que le `tzdata` qui arrive avec `python3-matplotlib` ne puisse pas interrompre l'exécution pour demander votre fuseau horaire, puis avaler la réponse destinée à la question suivante. Sur Jammy il appelle directement `install_rade_ubuntu22.sh`, car le `python3-websockets` de Jammy est en 10.1 alors que RADE exige 11.0 ou plus récent. Il sait où se trouve `intel-opencl-icd` sur chaque version : dans les dépôts sur 22.04 et 26.04, dans `non-free` sur Debian 12, et dans le dépôt graphique d'Intel sur 24.04 et Debian 13. Et là où Boost est en 1.87 ou plus récent, le correctif des en-têtes websocketpp cesse d'être facultatif : l'installateur vérifie qu'il a bien été appliqué et refuse de compiler sans lui. Aucun compilateur plus récent n'est jamais nécessaire : le GCC d'origine accepte `-std=c++23` sur les cinq versions, n'installez donc pas `gcc-12` pour cela.

L'installation se déroule en 22 étapes numérotées. Les questions de la station étant posées au début, aucune étape ne s'arrête pour demander quoi que ce soit ; seul le mot de passe sudo est demandé, une fois, juste après les questions, et il reste valable pendant toute l'exécution. `PHANTOM_CLASSIC=1` rétablit l'ancien fonctionnement : chaque question à sa propre étape, encadrée par un bandeau **⌨️  YOUR INPUT IS NEEDED**. Chaque réponse peut aussi être donnée par l'environnement pour une exécution entièrement automatique (`PHANTOM_NONINTERACTIVE=1`) ; voir *Installation sans surveillance* plus bas.

**Chaque exécution écrit `install.txt`.** Quand l'installateur se termine — ou s'arrête en cours de route — il écrit un rapport dans `install.txt`, à la racine du dossier PhantomSDR-Plus : le résultat, chacune des 22 étapes en OK / SKIPPED / PARTIAL / FAILED, ce qu'il a détecté (distribution, Boost, compilateur, Node.js), quels composants ont été installés, et chaque avertissement rencontré. Une exécution qui échoue laisse un rapport qui s'arrête à l'étape fautive, avec la raison et la mention que l'installateur peut être relancé sans risque. C'est le premier fichier à lire quand quelque chose n'a pas marché, et le premier à joindre à un rapport de bogue. Chaque exécution l'écrase : gardez-en une copie si vous voulez comparer deux installations.

> **Ubuntu 26.04, Arch et openSUSE Tumbleweed se compilent, mais n'ont pas été éprouvés en exploitation.** Tous trois embarquent un Boost plus récent que 1.87, qui a supprimé l'API `io_service` pour laquelle le websocketpp 0.8.2 embarqué a été écrit. Les en-têtes corrigés que l'installateur copie comblent cet écart (`io_context`, `executor_work_guard`, `boost::asio::post`, le resolver moderne), et là où Boost est en 1.87 ou plus récent l'installateur traite ce correctif comme obligatoire et non facultatif : il vérifie que les copies sont en place et refuse de compiler sans elles. Une installation complète, pilote du récepteur et tous les composants optionnels compris, a été vérifiée de bout en bout en conteneurs sur Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) et 1.92 (Arch). Cela prouve que le serveur compile et démarre — pas qu'il sert un récepteur pendant des heures. Considérez les trois comme non testés en production tant que personne n'a fait de retour.

> **openSUSE signifie ici Tumbleweed.** C'est là que `install_opensuse.sh` est vérifié. Leap 15.6 ne fonctionne pas : ses dépôts ne contiennent aucun `liquid-dsp-devel`, dont le backend a besoin, et Boost n'existe que sous des noms de paquets versionnés. Prendre en charge Leap imposerait d'ajouter des dépôts OBS tiers ; c'est donc hors périmètre pour l'instant.

### Les questions de la station

`configure-station.sh` — lancé par l'installateur au début, et utilisable seul à tout moment — pose cinq groupes de questions. ENTRÉE accepte la valeur entre crochets ; lors d'une nouvelle exécution, les réponses précédentes sont les valeurs par défaut.

| # | Question | Remarques |
|---|---|---|
| 1 | Quel récepteur | Celui qui est branché est reconnu et proposé (RX888, RTL-SDR, RSP1A, Airspy HF+, HackRF, Fobos). Pour un RTL-SDR, il demande aussi s'il s'agit d'un Blog V4. |
| 2 | Que recevoir | Des choix tout prêts pour chaque récepteur (par exemple *HF 0–30 MHz* pour le RX888, *2 m* pour un RTL-SDR), ou votre propre fréquence centrale et votre taux d'échantillonnage. |
| 3 | Votre station | Indicatif, nom, e-mail, QTH locator, ville et pays, antenne, ordinateur, région UIT (proposée d'après le locator). |
| 4 | Internet | Votre adresse publique (IP ou nom DNS), et si le récepteur doit figurer sur sdr-list.xyz et sur la carte de websdr.org. Et aussi s'il faut servir le récepteur en https:// (nécessite un nom DNS). Saisissez un nom ou une IP, pas un port — le port est demandé à l'étape 5. |
| 5 | Ports et compléments | Panneau d'administration, FreeDV RADE, DRM, statistiques, relais WebSDR, démarrage au boot — et le port public. |

Les réponses sont enregistrées dans **`station.conf`**, et l'assistant en tire tout ce qui doit concorder : le `config-<récepteur>.toml` du récepteur (taux d'échantillonnage, fréquence, port, inscriptions aux annuaires, websdr.org), `frontend/site_information.json` et les réglages du relais. Les scripts de démarrage lisent eux-mêmes la fréquence et le taux d'échantillonnage dans `station.conf` ; on ne les modifie donc jamais. Seuls les réglages qui appartiennent à l'assistant changent, et chaque fichier est copié en `<nom>.bak-<date>` avant d'être modifié.

**Un seul port doit être ouvert sur votre routeur.** Tout ce qu'utilisent les auditeurs passe par lui :

| Port | Quoi | Ouvert sur le routeur |
|---|---|---|
| 9000 | la page du récepteur — `proxy.py`, qui transmet aussi `/admin`, `/rade`, `/drm`, `/stats` et `/relay` | **oui, uniquement celui-ci** |
| 9001 | spectrumserver | non |
| 9010 | panneau d'administration | non |
| 9011 | serveur de statistiques | non |
| 9012 | décodeur FreeDV RADE | non |
| 9013 | relais de diversité WebSDR | non |
| 9015 | décodeur DRM | non |

Un port déjà utilisé sur l'ordinateur est remplacé par le suivant qui est libre. Pour changer quelque chose plus tard :

```bash
bash configure-station.sh          # reposer les questions (ENTRÉE garde chaque réponse)
bash configure-station.sh --show   # afficher les réponses actuelles
```

Sur une station déjà installée, l'assistant reporte ensuite le changement partout où il le faut — nouveaux ports dans `admin_config.json` et dans le service de statistiques, nouveau récepteur dans le démarrage au boot — et demande une fois s'il faut reconstruire la page et redémarrer ce qui tourne. Changer un port se résume donc à cette seule commande, plus la redirection sur votre routeur si le port public a changé. Le port public doit être 1024 ou plus, car le proxy ne tourne pas en root : pour être joignable sur le port 80, gardez 9000 ici et redirigez vers lui le port extérieur 80 du routeur.

### Ce que fait l'installateur

Rien n'est à préparer à la main : pas de liste de dépendances à coller, pas de Node.js à télécharger, pas de paquets OpenCL à chercher. Comptez d'une vingtaine de minutes à bien plus d'une heure, selon la machine et selon que RADE est installé ou non (son téléchargement est la partie longue).

| # | Étape |
|---|---|
| 1 | Affiche les services PhantomSDR-Plus en cours d'exécution et propose de les arrêter avant de toucher à quoi que ce soit (seulement sur un ordinateur qui les a déjà) |
| 2 | Détecte la distribution — viennent ensuite les questions de la station et, une fois, le mot de passe sudo |
| 3–6 | Installe toutes les dépendances de compilation, avec Node.js 22 via nvm si le Node du système manque ou est trop ancien |
| 7 | Compile le backend avec meson |
| 8 | Compile le pilote de votre récepteur avec sa règle udev, afin que le serveur n'ait jamais besoin de `sudo` pour l'appareil |
| 9 | Écrit le `.toml` du récepteur et `site_information.json` à partir de vos réponses |
| 10–11 | Installe les dépendances du frontend et construit la page de bureau et `/mobile` |
| 12 | Installe OpenCL pour le matériel trouvé |
| 13 | Installe le panneau d'administration — ou, sans lui, seulement le proxy sur le port public |
| 14–16 | Installe le relais WebSDR, FreeDV RADE, DRM et le serveur de statistiques, si vous les avez choisis |
| 17 | Réapplique les en-têtes websocketpp corrigés et les vérifie |
| 18 | Installe l'émulation de client KiwiSDR, pour que des clients Kiwi comme AetherSDR puissent se connecter |
| 19 | Recompile le backend à partir des sources corrigées |
| 20 | Choisit l'accélérateur FFT — OpenCL seulement si un périphérique répond réellement, sinon le processeur — et installe le démarrage au boot si vous l'avez choisi, et met en place https:// si vous l'avez choisi |
| 21 | Démarre le récepteur |
| 22 | Affiche le résumé : l'adresse des auditeurs, le port à rediriger, et chaque étape avec son résultat |

#### Installation sans surveillance

Chaque question dispose d'une variable d'environnement qui la remplace, et l'installateur bascule de lui-même sur les valeurs par défaut lorsque l'entrée standard n'est pas un terminal (un tube, un conteneur, un travail de CI). Cela vaut de la même façon pour les quatre : `install.sh`, `install_arch.sh`, `install_fedora.sh` et `install_opensuse.sh`. Définissez `PHANTOM_NONINTERACTIVE=1` et le déroulement se termine sans rien demander :

| Variable | Effet |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_DRM=y\|n` | DRM decoder (default y) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | continuer sans curlpp — Arch et openSUSE seulement (défaut y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | réinitialiser les horodatages des sources datés dans le futur, pour que meson puisse compiler (défaut y) |
| `PHANTOM_START_RECEIVER=y\|n` | démarrer le récepteur à la fin (par défaut y) |
| `PHANTOM_CLASSIC=1` | pas de questions de station : tout est demandé en cours de route, comme avant |
| `STATION_…=…` | toute réponse aux questions de la station, p. ex. `STATION_RECEIVER=rtl STATION_CALLSIGN=SV1XYZ` — voir l'en-tête de `configure-station.sh` |

Avec les questions de la station, les compléments choisis prennent leurs réponses dans `station.conf` et s'exécutent sans terminal ; une exécution sans surveillance les inclut donc sans qu'il faille les nommer ici.

Les trois sous-installateurs marqués *n sans surveillance* sont eux-mêmes interactifs ; une exécution sans surveillance les ignore donc plutôt que de bloquer sur leurs questions. Nommez-les explicitement pour les inclure :

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Après un redémarrage, les règles udev du RX888 et un éventuel pilote OpenCL sont pleinement actifs ; l'installateur vous indique quand un redémarrage ou une reconnexion est nécessaire.

Lorsqu'il installe le panneau d'administration, l'installeur propose aussi les deux unités systemd et **recommande fortement** de les accepter : la protection thermique tourne dans le panneau, donc sans elles un redémarrage ou un plantage laisse la machine sans protection. L'étape est ignorée automatiquement là où systemd ne tourne pas (conteneurs, WSL1, OpenRC) — voir le [guide du panneau](ADMIN_PANEL_SETUP.md).

Chaque extra est un script normal que vous pouvez aussi lancer seul à tout moment — `./setup_admin.sh` ([manuel](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([manuel](RADE_README.md)), `./setup-drm.sh` ([décodeur DRM](DECODERS.md#13-drm)), `./install-stats-server.sh` ([manuel](sdr-stats/README.md)), `./setup-rx888-udev.sh` et les scripts des récepteurs `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` et `./setup-hackrf.sh` — ce sont exactement ceux que l'installateur appelle.

---

## Rapporteur de spots autorun (FT8/FT4/WSPR)

PhantomSDR-Plus est livré avec un **rapporteur de spots autorun** facultatif (dans le répertoire `autorun/`). Il décode FT8/FT4/WSPR côté serveur, directement à partir du récepteur, et téléverse les spots vers les réseaux de report :

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Il se pilote entièrement depuis l'onglet **panneau d'administration → « Spot Reporting »**, et **le report est DÉSACTIVÉ par défaut** — rien n'est transmis ni téléversé tant que vous ne l'activez pas là. Le décodeur s'exécute comme un démon Node.js distinct et prélève l'audio du récepteur localement : il n'ajoute donc aucun matériel RF supplémentaire.

### Prérequis

| Prérequis | Remarques |
|-----------|-----------|
| **Node.js 22+** | Le même environnement d'exécution que la compilation du frontend — installé à l'étape Node.js. |
| **Paquets npm `ws` + `cbor-x`** | Résolus via `autorun/node_modules`, un lien symbolique vers le `node_modules` du frontend (les deux paquets sont déclarés dans `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Le bouton « Start » de l'admin épingle le démon sur les E-cores avec `taskset`. Présent sur pratiquement toutes les distributions ; les installateurs l'ajoutent explicitement. |
| **Indicatif + locator** | Lus dans `frontend/site_information.json` (`siteSysop` / `siteGridSquare`) sauf s'ils sont remplacés dans l'onglet d'administration. Les spots sont téléversés sous cet indicatif. PSK Reporter et WSPRnet ne reçoivent qu'un locator de 4 ou 6 caractères — un plus long (KM17VX69JA) est coupé à son carré (KM17VX). |

> ⚠️ **Ne rapportez que ce que vous recevez réellement.** Les spots sont téléversés vers des réseaux publics sous votre indicatif — n'activez que les bandes/modes que votre récepteur entend véritablement, et utilisez le bon locator.

### Installation automatique

`install.sh` (et les variantes par distribution : `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) s'occupent de tout : ils installent Node.js 22 et `util-linux`, exécutent le `npm install` du frontend, puis créent automatiquement le lien symbolique `autorun/node_modules`. Aucune étape supplémentaire n'est nécessaire — la fonction est prête dès que `install.sh` se termine.

Ouvrez ensuite le panneau d'administration, allez dans l'onglet **Spot Reporting**, renseignez votre identité, cochez les bandes/modes à décoder, activez la ou les destinations, puis appuyez sur **Start**. Un badge « 📶 REPORTING » apparaît sur la cascade principale chaque fois que le report est actif. (PSK Reporter téléverse par lots toutes les 5 minutes et wsprnet toutes les 2 minutes : un démon fraîchement démarré affiche donc « 0 sent » pendant les premières minutes — c'est normal.) Le même onglet fixe les heures UTC où tourne chaque bande et chaque mode, et peut relancer le démon tout seul après un redémarrage ou un plantage — voir [Spot Reporting](ADMIN_PANEL_SETUP.md#spot-reporting-autorun-ft8ft4js8wspr).

Deux compteurs différents sont ensuite affichés, et il est facile de les confondre. Les tuiles **SPOTS UPLOADED PER DECODER** ne comptent que l'exécution en cours : Stop/Start les remet à zéro. Le nombre à côté de chaque case bande/mode est le total **depuis toujours** de cet emplacement, conservé dans `autorun-totals.json` et donc préservé au redémarrage. Voir le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md) pour les deux, ainsi que pour la page **Graphiques**, qui trace la fréquence du processeur, la charge, la température et les utilisateurs connectés sur 15 minutes à 24 heures.

> **Si votre machine chauffe**, le panneau embarque aussi une [protection thermique](ADMIN_PANEL_SETUP.md#thermal-guard) qui arrête le serveur lorsque le processeur atteint une température dangereuse et le relance une fois refroidi. Elle déduit ses seuils du seuil critique de votre propre processeur, il n'y a donc rien à calculer, et elle fonctionne quelle que soit votre méthode de démarrage/arrêt. Installée avec le panneau, elle démarre en mode journalisation seule : elle note ce qu'elle *aurait* fait et ne change rien tant que vous ne l'activez pas dans Paramètres. Le décodage continu occupe un processeur 24 h sur 24, il vaut donc la peine de lire l'onglet CRASH après une semaine d'autorun pour voir jusqu'où votre machine monte réellement.

> **Le port du serveur est détecté automatiquement.** Le démon se branche directement sur le `[server] port` de spectrumserver (boucle locale + jeton, en contournant le proxy). Il lit ce port dans le fichier de configuration avec lequel le spectrumserver en cours a été lancé, ce qui lui permet de fonctionner sur n'importe quel port sans configuration — la ligne `[autorun] tap backend: …` dans `autorun.log` indique ce qu'il a résolu. Si votre serveur ne tournait pas au démarrage du démon, ou si votre installation est atypique, fixez-le dans `autorun.json` :
> ```json
> "server": { "host": "127.0.0.1", "port": 9001 }
> ```
> Un mauvais port se traduit par `504` / `tap closed 1006` dans `autorun.log`, avec `decodes` bloqué à 0.

---

## Émulation des clients KiwiSDR (facultatif)

Depuis la v4.1.0, PhantomSDR-Plus sait aussi répondre au **protocole KiwiSDR**, si bien qu'un logiciel écrit pour un KiwiSDR — **AetherSDR**, `kiwiclient` et les autres — se connecte directement à votre récepteur, sur le même hôte et le même port que vous publiez déjà. C'est désactivé tant que `[kiwi_emulation] enabled = true` n'est pas ajouté à la configuration avec laquelle tourne votre récepteur.

L'installateur le propose à l'étape 17 ; `./kiwi_install.sh` l'applique à une arborescence déjà installée.

> **Documentation complète : [Émulation des clients KiwiSDR](Aether_config.md)** — ce que fait la passerelle, comment l'installer, chaque clé `[kiwi_emulation]`, connecter un client, le niveau audio, le S-mètre, la cadence de la cascade et un tableau des symptômes.

---

## Configuration

> **Installé avec les questions de la station ?** Alors tout ce chapitre est déjà fait à partir de vos réponses : le `.toml`, `site_information.json`, ainsi que la fréquence et le taux d'échantillonnage du script de démarrage. Modifiez-les avec `bash configure-station.sh`. Les étapes ci-dessous concernent ce que l'assistant ne couvre pas, ou une station configurée à la main.

### 1. Choisissez votre fichier de configuration

Sélectionnez le fichier de configuration adapté à votre SDR :

- `config-rtl.toml` – clés RTL-SDR
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 en échantillonnage direct (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, voie RF (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

Pour cet exemple, nous utiliserons le RTL-SDR.

### 2. Modifiez le fichier de configuration

```bash
nano config-rtl.toml
```

#### Réglages clés à configurer

```toml
[server]
port = 9001                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
iq = true                        # Offer the IQ mode to listeners (true/false)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
volume = 50                      # Start volume of a first-time listener, 0-100 (optional)
```

#### Repères pour le taux d'échantillonnage

| Couverture | Taux d'échantillonnage | Taille de FFT |
|------------|------------------------|---------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Configurez les informations du site

```bash
nano frontend/site_information.json
```

Modifiez les champs suivants :

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v5.5.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Régions IARU :**
- **1** : Europe, Afrique, Moyen-Orient, Asie du Nord
- **2** : Amériques (Nord, Centre, Sud), Caraïbes
- **3** : Asie-Pacifique, Océanie

### 4. Personnalisez les marqueurs de fréquence (facultatif)

```bash
nano markers.json
```

Ajoutez vos fréquences préférées, relais et stations de radiodiffusion. Un marqueur dont le mode est un mode numérique, comme `FT8` ou `APRS`, démarre ce décodeur quand on clique dessus — voir [Décodeurs](DECODERS.md#démarrer-un-décodeur-depuis-un-marqueur-de-fréquence).

### 5. Modifiez le script de démarrage

```bash
nano start-rtl.sh
```

> Sur une station configurée avec les questions de la station, la fréquence et le taux d'échantillonnage viennent de `STATION_FREQ` et `STATION_SPS` dans `station.conf` : `bash configure-station.sh` les modifie, et le bloc ci-dessus reste tel qu'il est livré.

Le script de démarrage est un lanceur autonome doublé d'un chien de garde. Ne modifiez que le bloc **RECEIVER CONFIGURATION** près du début, afin que les arguments du récepteur correspondent à votre installation :

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Paramètres à l'intérieur de `RX_ARGS` :
- `-f 145000000` : fréquence centrale (145 MHz)
- `-s 2048000` : taux d'échantillonnage (2,048 MSPS)

`CONFIG` pointe vers votre `.toml`. Vous n'avez **pas** besoin de modifier autre chose dans le script — la logique de démarrage/redémarrage/chien de garde/journalisation est générique. Vous pouvez aussi remplacer les arguments du récepteur au lancement sans modifier le fichier : `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` pour `start-rx888mk2.sh`).

---

## Configuration propre à chaque appareil SDR

### RTL-SDR

Les installateurs installent le pilote pour vous, avec `./setup-rtlsdr.sh` (`RTL_V4=y` pour un RTL-SDR Blog V4).

#### Modifiez la configuration

```bash
nano config-rtl.toml
```

Réglages courants pour le RTL-SDR :
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Récepteurs sur SoapySDR (RSP1A, Fobos, Airspy HF+)

Le SDRplay RSP1A, le RigExpert Fobos SDR et l'Airspy HF+ rejoignent le serveur de la même façon : un pilote SoapySDR pour l'appareil, et `rx_sdr` (de rx_tools) qui transmet ses échantillons à `spectrumserver`. Un script par récepteur installe toute la chaîne :

| Récepteur | Script | Option de l'installateur | Script de lancement | Configuration |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Chaque script :

- installe git, cmake, un compilateur, libusb et **SoapySDR** depuis les paquets de votre distribution — il reconnaît apt, dnf, pacman et zypper, et fonctionne donc aussi bien sur Debian/Ubuntu, Fedora, Arch et openSUSE ;
- compile le pilote du récepteur depuis les sources dans `sdr_drivers/` (non suivi par git) ;
- compile **rx_tools** pour `rx_sdr`, sauf si `rx_sdr` est déjà installé — une seule copie sert à tous les récepteurs ;
- installe une **règle udev** et vous ajoute au groupe `plugdev`, pour que le script de lancement n'ait jamais besoin de `sudo` pour l'appareil. **Déconnectez-vous et reconnectez-vous une fois** pour que le groupe prenne effet ;
- vérifie pour finir que SoapySDR liste bien le pilote, et s'arrête sur une erreur sinon.

Lancez-les avec votre utilisateur normal — ils appellent `sudo` eux-mêmes. Ils sont idempotents : relancer l'un d'eux met à jour les sources du pilote avec `git pull` et recompile. L'installateur appelle exactement ces scripts ; sur une station déjà installée, lancez seul celui de votre récepteur. La partie commune se trouve dans `setup-sdr-common.sh`, qui ne se lance pas seul. Deux variables facultatives valent pour les trois : `SDR_USER=<nom>` met un autre compte dans `plugdev`, et `SDR_SKIP_DEPS=1` saute l'installation des paquets.

Appareil branché, vérifiez que le récepteur est détecté :

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` installe le **pilote open source** : libmirisdr-5, le pilote issu de la rétro-ingénierie des puces Mirics MSi2500/MSi001 des RSP1 et RSP1A, avec son module SoapySDR SoapyMiri (`driver=soapyMiri`). Il ne demande aucun service en arrière-plan ni root. Le script met aussi sur liste noire les pilotes noyau `msi2500` et `msi001` dans `/etc/modprobe.d/blacklist-msi2500.conf`, car ils prennent le RSP1A comme radio V4L2 avant que `rx_sdr` puisse l'ouvrir. Si l'appareil était branché pendant qu'ils étaient chargés, débranchez-le et rebranchez-le une fois (ou redémarrez).

L'API fermée de SDRplay (`driver=sdrplay`, avec SoapySDRPlay et le service `sdrplay`) fonctionne toujours — le fichier inclus `instructions-for-rsp1a` décrit cette installation. `start-rsp1a.sh` choisit seul entre les deux : si SoapySDR a le pilote `sdrplay`, il utilise l'API et redémarre d'abord le service `sdrplay`, sinon il utilise libmirisdr-5. Une station installée sur l'API continue donc de fonctionner sans changement. Pour en imposer un, lancez avec `RX_DRIVER=miri` ou `RX_DRIVER=sdrplay`. Le pilote choisi est écrit dans `logwebsdr.txt` sous la forme `RSP1A driver: miri` ou `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Le Fobos ne diffuse **qu'une voie à la fois** ; il a donc deux scripts de lancement qui partagent le verrou du chien de garde comme tout `start-*.sh` — lancer l'un arrête l'autre :

- **`start-fobos-hf.sh`** — les entrées HF1/HF2 en échantillonnage direct, 0-25 MHz, sur le port 9001. Dans ce mode il n'y a pas d'oscillateur local : l'ADC numérise 0-25 MHz en permanence (`-f 0` est voulu, et l'avertissement *Failed to set center freq* de rx_sdr est attendu). `rx_sdr` fournit du CF32 à 50 Msps ; le petit convertisseur `cf32_to_real` (compilé par `setup-fobos.sh` à partir de `cf32_to_real.c`) garde la voie I et la met à l'échelle en s16, d'où `signal="real"` et `format="s16"` dans `config-fobos-hf.toml`.
- **`start-fobos.sh`** — la voie RF, 25-6000 MHz, IQ, sur le port 9001. Choisissez la fenêtre avant le premier lancement : `-f` (centre) et `-s` (fréquence d'échantillonnage) sur la ligne `RX_ARGS` doivent correspondre à `frequency=` et `sps=` dans `config-fobos.toml`. Les valeurs livrées (97 MHz, 20 Msps) ne sont qu'un point de départ pour vérifier que cela tourne.

> [!IMPORTANT]
> `config-fobos-hf.toml` est livré avec `accelerator="opencl"` : un flux de 50 Msps à travers une FFT de 1M bins est aussi lourd que les 60 Msps du RX888, et sur le CPU il perd des échantillons et fait chauffer la machine. Sur une machine sans périphérique OpenCL, `spectrumserver` ne démarre pas avec ce réglage — mettez-y `accelerator="none"`.

SoapyFobosSDR a besoin des en-têtes de libfobos et de libfobos-sdr-agile pour se compiler, donc `setup-fobos.sh` compile les deux, même pour le firmware standard. La prise en charge du Fobos vient d'un script écrit par une autre station après avoir mis un Fobos en service sous PhantomSDR-Plus ; les valeurs HF de `config-fobos-hf.toml` sont celles qui ont fonctionné chez elle.

#### Airspy HF+

`setup-airspyhf.sh` installe libairspyhf depuis la distribution là où elle est empaquetée (Debian et Ubuntu, Fedora, openSUSE) et la compile depuis les sources ailleurs (Arch ne l'a que dans l'AUR), puis compile SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` fournit 912 ksps IQ en CS16, que `config-airspyhf.toml` lit en `format="s16"`. Le fichier inclus `instructions-for-airspy` décrit la voie manuelle.

### RX888 MK2

L'installateur compile `rx888_stream` et installe ses règles udev pour vous.

#### Exécuter rx888_stream sans sudo (règles udev)

Par défaut, le périphérique USB Cypress FX3 du RX-888 n'est accessible qu'à root, donc `rx888_stream` nécessiterait `sudo`. Exécutez une fois l'assistant fourni pour installer les règles udev et vous ajouter au groupe `plugdev` :

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Il écrit `/etc/udev/rules.d/99-rx888.rules` pour les trois identifiants de produit Cypress FX3 (`04b4:00f1`/`00f3` bootloader et `04b4:8613` firmware chargé), recharge udev et crée un lien symbolique stable `/dev/rx888`. **Déconnectez-vous puis reconnectez-vous** (pour le changement de groupe) et **rebranchez l'appareil** une fois ; ensuite `rx888_stream` — et le lanceur `start-rx888mk2.sh` — s'exécutent sans `sudo`. Le script est idempotent : vous pouvez le relancer sans risque. Pour configurer un autre compte : `RX888_USER=<nom> ./setup-rx888-udev.sh`.

#### Modifiez la configuration

```bash
nano config-rx888mk2.toml
```

Réglages courants pour le RX888 :
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Pour le HackRF, rien n'est compilé : `hackrf_transfer`, du paquet `hackrf` de votre distribution, transmet les échantillons directement à `spectrumserver`. `./setup-hackrf.sh` (option 7 de l'installateur) installe ce paquet avec apt, dnf, pacman ou zypper et ajoute une règle udev et le groupe `plugdev`, pour que `start-hackrf.sh` tourne sans `sudo` — déconnectez-vous et reconnectez-vous une fois ensuite.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` diffuse une fenêtre à la fois. Choisissez-la avant le premier lancement : `-f` (centre) et `-s` (fréquence d'échantillonnage) sur sa ligne `RX_ARGS` doivent correspondre à `frequency=` et `sps=` dans `config-hackrf.toml`. `-l` et `-g` sont les gains du LNA (0-40 dB, pas de 8 dB) et du VGA (0-62 dB, pas de 2 dB), et `-a 1` allume l'amplificateur RF. Les valeurs livrées (98 MHz, 20 Msps) ne sont qu'un point de départ pour vérifier que cela tourne.

`hackrf_transfer` écrit de l'IQ 8 bits **signé**, la configuration a donc besoin de `format="s8"`. `config.example.hackrf.toml` indiquait `u8` jusqu'en septembre 2026 ; avec `u8` chaque échantillon est décalé de 128 et la chute d'eau ne montre que du bruit — vérifiez toute copie plus ancienne.

### Plusieurs récepteurs sur un ordinateur

Un ordinateur peut faire tourner en même temps plusieurs des récepteurs ci-dessus — par exemple un RX-888 pour les ondes courtes et un RTL-SDR pour le 2 m — chacun comme serveur à part, avec un sélecteur de récepteur sur la page. Chaque récepteur supplémentaire se démarre avec `INSTANCE=<nom> ./start-<radio>.sh` et se configure dans `instances/<nom>/` ; `receivers.toml` les recense pour le proxy et pour `start-all.sh`. Tout est décrit dans [Plusieurs récepteurs](MULTI_RECEIVER.md). Le plus rapide pour ajouter un récepteur est `./add-receiver.sh`, que les installeurs proposent à la fin : il installe le pilote (`setup-rtlsdr.sh` pour un RTL-SDR, le `setup-*.sh` correspondant pour les autres) et écrit pour vous le dossier de l'instance et `receivers.toml`.

---

## Tests et vérification

### 1. Essai

```bash
# For RTL-SDR
./start-rtl.sh
```

Cela démarre le serveur **en arrière-plan** (il se détache et rend la main immédiatement) et commence à journaliser dans `logwebsdr.txt`.

### 2. Recherchez d'éventuelles erreurs

Le script journalise sa progression dans `logwebsdr.txt` — suivez-la en direct :

```bash
tail -f logwebsdr.txt
```

Cherchez :
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` ou `ERROR: receiver binary '…' not found` (corrigez les arguments du récepteur ou le `.toml`, ou installez l'outil du récepteur, puis relancez le script de démarrage)

### 3. Accédez à l'interface web

Ouvrez votre navigateur sur :
```
http://localhost:9000
```

(Remplacez le numéro de port par celui que vous avez configuré)

### 4. Vérifiez le fonctionnement

- La cascade doit s'afficher
- L'audio doit jouer lorsque vous cliquez sur des signaux
- Le S-mètre doit réagir aux signaux
- Le nombre d'utilisateurs doit indiquer « 1 »

### 5. Testez depuis un autre appareil

Depuis un autre ordinateur de votre réseau :
```
http://YOUR_SERVER_IP:9000
```

### 6. Vérifiez l'utilisation des ressources

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Arrêtez le serveur

Le serveur s'exécute en arrière-plan sous la surveillance d'un chien de garde : **Ctrl+C ne l'arrêtera donc pas** (et le chien de garde le relancerait). Utilisez le script d'arrêt partagé, valable pour tous les récepteurs — il arrête d'abord le chien de garde, puis le récepteur et `spectrumserver` :

```bash
./stop-websdr.sh
```

---

## Mise en place du démarrage automatique

La manière simple — et ce que fait l'installateur quand vous répondez oui au *démarrage au boot* :

```bash
bash setup-autostart.sh                # le script de démarrage de station.conf
bash setup-autostart.sh start-rtl.sh   # ou nommez-le
bash setup-autostart.sh --remove       # ne plus démarrer au boot
```

Il installe `phantomsdr-receiver.service`, qui lance votre script de démarrage au boot et `stop-websdr.sh` à l'arrêt, avec le groupe `plugdev`, afin que le récepteur USB s'ouvre sans que personne ne soit connecté. La suite de ce chapitre montre la même chose à la main.


---

## Protection thermique du processeur

> 📖 **Manuel complet : [THERMAL_GUARD.md](THERMAL_GUARD.md)** — les quatre modes et ce que le sysop doit faire pour chacun, le fonctionnement sans le panneau, l'étage throttle sans root, les tests et le dépannage.

PhantomSDR-Plus embarque un garde qui arrête le serveur si le processeur atteint une température dangereuse et le relance une fois refroidi. Il déduit ses seuils du seuil critique que publie votre propre processeur, il n'y a donc rien à calculer, et il fonctionne quelle que soit votre méthode de démarrage/arrêt.

**Si vous utilisez le panneau d'administration, vous l'avez déjà** : il tourne dans le panneau et se configure depuis sa page Paramètres. Voir le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md#thermal-guard). Le reste de cette section concerne les installations **sans** panneau.

## Dépannage

### Erreurs de compilation

#### Problèmes de dépendances

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### La configuration Meson échoue

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` s'arrête sur `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

L'arborescence des sources n'est pas en cause. Une ancienne installation par
`pip install --user meson` a laissé un script de lancement dans `~/.local/bin`,
qui passe avant `/usr/bin` dans le `PATH` et masque donc la copie installée par le gestionnaire de paquets. Une montée de version de la distribution (Ubuntu 24.04 → 26.04, par exemple) fait passer Python à une nouvelle version, l'ancien
`site-packages` qui contenait `mesonbuild` n'est plus dans le chemin d'import, et
le script meurt sans avoir rien fait. La même chose peut arriver à `ninja`.

L'installateur détecte ce cas et le contourne le temps de l'exécution, en vous avertissant, mais réparez tout de même le système :

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # doit afficher une version
```

Si vous préférez garder meson installé via pip, réinstallez-le pour le Python dont dispose maintenant ce système :

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` s'arrête sur `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

L'arborescence des sources n'a rien d'anormal : c'est l'horloge du système qui est en retard sur les fichiers. meson et ninja refusent de compiler quand une entrée est plus récente que l'heure courante, car ils ne peuvent pas savoir ce qui est périmé. Cela arrive sur un Raspberry Pi dont le support de pile RTC est vide — chaque démarrage repart de la dernière heure connue, et une compilation lancée avant que NTP ne se synchronise voit toute l'arborescence datée dans le futur — ainsi que sur une arborescence décompressée ou copiée depuis une machine en avance.

Corrigez d'abord l'horloge :

```bash
timedatectl                       # l'heure est-elle juste ? NTP est-il synchronisé ?
sudo timedatectl set-ntp true
```

Attendez quelques secondes, puis relancez l'installateur. Il vérifie ce point avant d'appeler meson et propose de réinitialiser les horodatages fautifs (`PHANTOM_FIX_CLOCK_SKEW=y|n`). À la main, depuis l'arborescence des sources :

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Le backend est compilé mais il n'y a pas de page web

Le symptôme est une installation qui semble avoir largement réussi : `build/spectrumserver` est là, le serveur démarre, et le navigateur ne reçoit rien — parce que `frontend/dist/` n'a jamais été produit. Cherchez dans la sortie de l'installateur :

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` demande `@swc/core` `^1.12.14`, si bien qu'un `npm install` neuf résout vers 1.16.0, dont `printSync()` rejette l'arbre syntaxique que le greffon lui transmet. Cela n'a rien à voir avec votre distribution : chaque installateur épingle désormais la version qui fonctionne, et `frontend/package.json` aussi. Une machine installée avant cet épinglage continue de fonctionner jusqu'à la suppression de son `node_modules` — d'où l'apparition soudaine du problème lors d'une réinstallation.

### Erreurs d'exécution

#### Port déjà utilisé

```bash
# Find process using port
sudo lsof -i :9000

# Kill process
sudo kill -9 <PID>
```

#### Permission refusée pour le SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Pour un **RX-888 MkII**, cela ne suffit pas à soi seul — le périphérique Cypress FX3 a aussi besoin de règles udev. Exécutez l'assistant fourni (il installe les règles *et* vous ajoute à `plugdev`), puis déconnectez-vous/reconnectez-vous et rebranchez l'appareil :

```bash
./setup-rx888-udev.sh
```

### Problèmes OpenCL

#### clinfo n'affiche aucun appareil

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

### Problèmes réseau

#### Impossible d'accéder depuis d'autres appareils

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9000/tcp

# Or disable firewall temporarily for testing
sudo ufw disable

# Fedora / openSUSE (firewalld)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --add-port=9000/tcp
```

Sous Fedora et openSUSE, le pare-feu est firewalld, et non ufw, et il est actif par défaut. `setup_admin.sh` y ouvre lui-même le port public du proxy (ainsi que dans ufw, si vous l'avez activé) ; sur une station installée auparavant, exécutez une fois `./setup_admin.sh --firewall` ou utilisez les lignes `firewall-cmd` ci-dessus. Si le panneau d'administration ou le proxy ne revient pas après un redémarrage sur ces systèmes, la cause habituelle est SELinux : exécutez `./setup_admin.sh --selinux` (voir le tableau de dépannage dans ADMIN_PANEL_SETUP.md).

### Problèmes d'appareil SDR

#### RTL-SDR introuvable

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay introuvable

`grep "RSP1A driver" logwebsdr.txt` indique le pilote choisi par `start-rsp1a.sh`.

Avec le pilote ouvert (libmirisdr-5, `RSP1A driver: miri`) :

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Avec l'API de SDRplay (`RSP1A driver: sdrplay`) :

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos ou Airspy HF+ introuvable

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Si le pilote manque dans la liste, relancez `./setup-fobos.sh` ou `./setup-airspyhf.sh` : il s'arrête en donnant la raison si la compilation ou la vérification SoapySDR échoue.

---

## Mise à jour de PhantomSDR-Plus

Depuis la version 4.1.0, le dépôt fournit **`update.sh`**, un outil qui met une installation à jour à partir de l'arborescence publiée **sans toucher aux fichiers qui font qu'elle est votre station**. Il remplace le script `git pull` que les éditions précédentes de ce guide vous demandaient d'écrire, et il n'a pas besoin de git du tout : l'arborescence publiée est téléchargée sous forme d'archive tar et comparée à la vôtre fichier par fichier. Il fonctionne donc de la même façon que vous ayez cloné le dépôt, décompressé un `update.zip` ou copié l'arborescence depuis une clé USB.

### Si votre installation n'a pas encore update.sh

Une arborescence ancienne ne contient pas le script. Récupérez-le une fois — c'est la seule étape que vous ferez jamais à la main :

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
```

Ensuite tout — sources, frontend, documentation, installateurs et `update.sh` lui-même — arrive par l'outil.

### Utilisation

```bash
cd ~/PhantomSDR-Plus
bash update.sh
```

Il télécharge l'arborescence publiée, la compare à la vôtre et affiche un rapport. Il demande ensuite **Update these files now?** — ENTRÉE signifie *non*, et alors absolument rien n'a été écrit. Répondez `y` et il :

1. arrête le récepteur, le panneau d'administration, le proxy et le relais **de cette installation** (une autre installation sur le même ordinateur continue de tourner),
2. enregistre chaque fichier qu'il va remplacer dans une archive datée dans `update-backups/`,
3. écrit les nouveaux fichiers,
4. recompile seulement ce qui a changé — le serveur, la page ou les deux — sans rien demander,
5. redémarre exactement ce qu'il a arrêté.

Trois sortes de fichiers sont traitées différemment :

| Fichiers | Ce qui se passe |
|---|---|
| `station.conf`, `config.toml`, `config-<récepteur>.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frontend/site_information.json`, `frontend/variant.json`, `frequencylist/`, `chat_history.txt`, les logs, `build/`, `frontend/dist/` | **Jamais touchés**, jamais même montrés dans une question. Ce sont eux qui font de la machine *votre* récepteur. |
| `start-*.sh`, `stop-websdr.sh`, les unités `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `proxy.py`, `admin_server.py`, `frontend/src/bands-config.js` et les autres fichiers qu'un sysop a des raisons de modifier | **Mis à jour si vous ne les avez jamais modifiés ; question posée si vous l'avez fait.** |
| Tout le reste | Mis à jour. |

Chaque version apporte `update-known.txt`, l'empreinte de chaque version de chaque fichier jamais publiée. Un de vos fichiers qui correspond à l'une d'elles est simplement plus ancien et il est mis à jour sans question ; ainsi même une première mise à jour ne pose de questions que sur les fichiers que vous avez vraiment changés. Pour chacun d'eux vous choisissez :

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — votre fichier reste exactement tel quel.
* **upstream** — la nouvelle version est installée ; la vôtre est dans la sauvegarde.
* **both** — la nouvelle version est écrite à côté de la vôtre sous `start-rx888mk2.sh.new`, à fusionner quand vous voulez.

Rien n'est jamais supprimé : les fichiers disparus du dépôt sont signalés, et retirés seulement si vous le demandez avec `--prune`. Une exécution qui n'écrit rien se termine avec `0` si tout est à jour et `10` si une mise à jour attend ; une tâche cron lançant `bash update.sh --check` peut donc vous prévenir quand il y a quelque chose à faire.

### Annuler une mise à jour

```bash
./update.sh --restore LAST
```

Chaque fichier qu'une mise à jour écrase est d'abord sauvegardé, dans une archive datée par exécution, dans le dossier ordinaire et visible `update-backups/` :

```
update-backups/phantomsdr-backup-20260923-164530.zip
```

L'archive ne contient que les fichiers que cette exécution a remplacés, chacun à son chemin dans votre arborescence : elle peut donc être copiée sur une autre machine en un seul fichier, ouverte n'importe où ou décompressée directement sur l'installation. Si `zip` n'est pas installé, elle est écrite en `.tar.gz`. Les trois plus récentes sont gardées. L'une ou l'autre de ces commandes remet ce qu'une mise à jour a remplacé :

```bash
./update.sh --restore LAST
./update.sh --restore phantomsdr-backup-20260923-164530.zip
```

Chaque archive contient aussi son propre `restore.sh`, pour le cas où `update.sh` lui-même serait le problème : décompressez l'archive et donnez-lui le répertoire de votre installation, par exemple `./restore.sh /home/pi/PhantomSDR-Plus`. Pendant la restauration, `update.sh` s'exécute depuis une copie hors de l'arborescence, car il fait généralement partie des fichiers remis en place.

### Autres options

```bash
./update.sh --apply --yes     # ne demande jamais rien ; tout fichier modifié est CONSERVÉ
./update.sh --check           # rapport seul, jamais de question — pour cron (10 = mise à jour en attente)
./update.sh --from FILE|DIR   # la nouvelle version depuis un .zip/.tar.gz ou un dossier — sans réseau
./update.sh --ref v5.5.0      # une étiquette, une branche ou un commit précis
./update.sh --list-excludes   # affiche les règles « ne pas toucher » telles qu'appliquées ici
./update.sh --verbose         # liste tous les fichiers, pas seulement les 40 premiers
```

Vous pouvez ajouter vos propres règles « ne pas toucher » en écrivant un motif par ligne dans
`update-exclude.txt`, à la racine de l'installation.

### Si la recompilation échoue sur une installation très ancienne

`update.sh` met à jour des fichiers, pas des paquets système. Si votre arborescence est
assez ancienne pour que la compilation réclame des bibliothèques que vous n'avez pas,
`recompile.sh` s'arrêtera sur une erreur du compilateur ou de meson. Ce n'est pas une mise à
jour cassée : il manque les dépendances :

```bash
./install.sh
```

L'installateur est lui-même mis à jour par la même exécution, et votre configuration y survit également.

### Sans connexion internet sur le récepteur

Téléchargez tout le dépôt sur un autre ordinateur (GitHub → *Code* → *Download ZIP*), apportez-le, puis :

```bash
bash update.sh --from ~/PhantomSDR-Plus-main.zip
```

Tout le reste se passe exactement comme ci-dessus : rapport, question, sauvegarde, recompilation, redémarrage.

### Mettre à jour à la main

Si vous préférez appliquer vous-même un lot de fichiers :

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # ou le script de démarrage de votre récepteur
```

Sauvegardez d'abord votre configuration — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` et `markers.json` — car un lot de fichiers ne peut pas distinguer vos
modifications de celles de la version publiée. C'est exactement le problème que `update.sh` résout.

---

## Annexe B : exemples de configuration

### Exemple 1 : RTL-SDR pour VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Exemple 2 : RX-888 mk2 pour HF (0-30 MHz)

Le récepteur qu'utilisent la plupart des sysops. Voici une section `[input]` complète, et non un extrait, avec les valeurs du `config-rx888mk2.toml` fourni avec le dépôt.

```toml
[input]
sps = 60000000            # 0-30 MHz par échantillonnage direct
fft_size = 4194304        # voir la note ci-dessous
fft_threads = 8
brightness_offset = -9    # plus négatif si la cascade montre des zones noires
frequency = 0             # bande de base : le RX-888 échantillonne depuis le continu
signal = "real"           # pas "iq" : l'échantillonnage direct donne un flux réel
accelerator = "opencl"    # "none" s'il n'y a pas d'environnement OpenCL
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Il est alimenté par `rx888_stream`, ce dont `start-rx888mk2.sh` se charge pour vous :

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**À propos de `fft_size` :** à 60 MSPS, la bonne taille est 4194304. 8388608 double la résolution de la cascade et, avec elle, la mémoire et le coût CPU de chaque transformée : sur la plupart des machines, on paie des bins plus fins par des trames perdues. Commencez à 4194304 et ne montez que si le serveur est largement au repos.

### Exemple 3 : HackRF pour la FM à large bande

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
