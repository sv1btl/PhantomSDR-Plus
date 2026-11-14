# Voix numérique RADE v1 pour PhantomSDR-Plus

> **Port 9012.** Sur une station installée avec `install.sh`, le sidecar n'écoute qu'à l'intérieur de l'ordinateur, sur `PORT_RADE` (9012), et la page l'atteint en `/rade` sur le port public 9000 via `proxy.py` ; il n'y a donc rien à ouvrir sur le routeur.

**RADE** (Radio AutoencoDEr) est le mode phare de voix numérique HF de FreeDV. Il utilise un hybride apprentissage automatique / DSP (le vocodeur neuronal FARGAN) pour offrir une parole de haute qualité en HF avec des SNR descendant jusqu'à −2 dB, dans seulement 1500 Hz de largeur de bande RF — plus étroit qu'un signal BLU.

Ce document couvre l'intégration complète de la réception RADE v1 dans PhantomSDR-Plus, mise en œuvre sous la forme d'un sidecar Python (`rade_helper.py`) qui relie le navigateur à la chaîne de décodage `radae_rxe.py` + `lpcnet_demo`.

Il décode aussi **RADE V2 (beta)**, la nouvelle forme d'onde de FreeDV 3.0, avec le bouton **RADE-v2U** — voir [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

## L'installation — la voie courte

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

C'est toute l'installation. Le script installe les paquets système avec le gestionnaire de paquets présent sur la machine (apt, pacman, dnf ou zypper), se rabat sur pip pour ce qu'une distribution ne fournit pas, met à jour `websockets` si la version de la distribution est antérieure à la 11.0 exigée par le sidecar, clone et compile radae, vérifie les poids du modèle, reconstruit le frontend et démarre le sidecar. Sous Ubuntu 22.04, il passe la main à `install_rade_ubuntu22.sh`. `./install.sh` propose de l'exécuter dans le cadre de l'installation normale : sur une machine neuve, RADE est donc déjà là. Il compile aussi rade_c de FreeDV pour RADE V2 (beta) ; si cette étape échoue, RADE V1 est installé quand même.

**Ce document explique comment fonctionne RADE et comment l'utiliser.** L'installation est toujours faite par `./install_rade.sh` (ou par `./install.sh`, qui la propose).

---

## Table des matières

1. [L'installation — la voie courte](#linstallation--la-voie-courte)
2. [Fonctionnement](#fonctionnement)
3. [Vue d'ensemble de l'architecture](#vue-densemble-de-larchitecture)
4. [RADEL contre RADEU](#radel-contre-radeu)
   - [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2)
5. [Prérequis](#prérequis)
6. [Contrôle du sidecar](#contrôle-du-sidecar)
7. [Le port 9012](#le-port-9012)
8. [Utiliser RADE dans le navigateur](#utiliser-rade-dans-le-navigateur)
9. [Vérification et débogage](#vérification-et-débogage)
10. [Variables d'environnement](#variables-denvironnement)
11. [Dépannage](#dépannage)
12. [Mettre RADE v1 à jour](#mettre-rade-v1-à-jour)

---

## Fonctionnement

RADE v1 ne peut pas s'exécuter dans le navigateur — il exige PyTorch et le vocodeur neuronal FARGAN, trop volumineux pour WASM. La solution est un processus sidecar Python (`rade_helper.py`) qui s'exécute sur le même serveur que PhantomSDR-Plus.

> **Important :** `freedv_rx` du dépôt codec2 ne prend **pas** en charge RADEV1. La chaîne de décodage RADE réside entièrement dans le dépôt distinct `radae` de David Rowe (VK5DGR). N'essayez pas d'utiliser `freedv_rx` de codec2 pour RADE.

Lorsque vous sélectionnez RADE dans le navigateur :

1. Le frontend règle la démodulation sous-jacente sur USB ou LSB — le serveur C++ démodule le signal BLU normalement.
2. Le PCM démodulé brut est prélevé dans `audio.js` **avant** toute coupure ou porte de squelch — `radae_rxe.py` a besoin d'une entrée continue pour maintenir la synchronisation de trame.
3. Chaque bloc PCM est complété par des zéros pour passer de f32 réel à f32 complexe (réel + 0.0 imaginaire) — c'est ce que `radae_rxe.py` attend sur son entrée standard.
4. Le sidecar transmet ces échantillons à `radae_rxe.py`, qui produit des paramètres de vocodeur.
5. `lpcnet_demo -fargan-synthesis` convertit ces paramètres en parole s16 à 16000 Hz.
6. Le sidecar convertit s16 → f32 et renvoie le résultat au navigateur sous forme de trames WebSocket binaires.
7. Le navigateur restitue la parole décodée via l'API Web Audio à 16000 Hz.

Le serveur C++ (`spectrumserver.cpp`) n'est absolument pas modifié.

---

## Vue d'ensemble de l'architecture

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

## RADEL contre RADEU

RADE v1 est toujours transmis en BLU. Par convention :

| Mode  | Bande latérale | À utiliser sur les bandes                |
|-------|----------------|------------------------------------------|
| RADEL | LSB            | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB            | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## RADE V2 (beta) — RADE2

**RADE V2** est la nouvelle forme d'onde de FreeDV 3.0 : environ 800 Hz de large au lieu de 1500 Hz, sans symboles pilotes, et environ 3 dB plus sensible à faible SNR. **Elle est encore en bêta chez FreeDV** — seules les stations qui testent FreeDV 3.0 l'émettent, et le signal peut encore changer avant la sortie. PhantomSDR-Plus la décode à côté de RADE V1 :

| Bouton | Version | Bande latérale | Filtre |
|---|---|---|---|
| **RADE-v2U** (RADE2) | RADE V2 (beta) | USB sur toutes les bandes | 1040–1930 Hz |
| **RADE-v1L** / **RADE-v1U** (RADEL / RADEU) | RADE V1 | LSB / USB | 700–2200 Hz |

V2 est décodée sur le serveur par le portage en C de FreeDV, **rade_c** (`radae_rx --v2` et son propre `lpcnet_demo`), compilé dans son propre dossier `~/rade_c`, de sorte que l'installation V1 dans `~/radae` n'est jamais touchée. `./install_rade.sh` le télécharge et le compile (étape « rade_c (RADE V2, beta) ») ; si cette étape échoue, il se contente d'avertir et RADE V1 est installé quand même. `rade_helper.py` utilise rade_c dès la connexion RADE2 suivante — aucun redémarrage n'est nécessaire — et sans lui RADE2 indique à l'auditeur « RADE V2 is not installed on this station yet ». Un décodage V2 coûte environ 1 % d'un cœur de CPU par auditeur (V1 : environ 70–80 %).

**À l'antenne**

- Accordez-vous à environ **±30 Hz** de la fréquence de la station. Au-delà, V2 affiche encore « Synced » mais la parole est inintelligible.
- Chaque passage commence avec **2–3 s de retard** : pendant que V2 se verrouille il garde le signal, puis joue le début du passage.
- En dessous d'environ **−2 dB de SNR**, le son de V2 est coupé et le panneau affiche « Searching for signal… » — sauf si les 2 dernières secondes ressemblent à du vrai V2 (le décodeur voit son signal la plupart du temps et son estimation de fréquence reste stable) ; il joue alors jusqu'à environ **−6 dB**. Sur les fréquences de phonie LSB chargées écoutées en USB (40 m), V2 peut se verrouiller sur des voix ordinaires et jouer un son inintelligible ; celles-ci ne paraissent jamais stables et restent donc coupées. `RADE_V2_MIN_SNR` et `RADE_V2_WEAK_SNR` règlent les deux seuils.
- Entre les passages, le panneau revient à « Searching for signal… ».

**À la sortie de FreeDV 3.0**, relancez `./install_rade.sh` — ou `git pull` dans `~/rade_c` puis `cmake --build build` — et les nouvelles connexions RADE2 utilisent alors la nouvelle version.

---

## Prérequis

| Élément requis | Version | Remarques |
|---|---|---|
| PhantomSDR-Plus | quelconque | avec le frontend Vite/Svelte |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | testé |
| Python | 3.8+ | pour `rade_helper.py` et `radae_rxe.py` |
| dépôt radae | dernier master | fournit `radae_rxe.py` et `lpcnet_demo` |
| cmake | 3.10+ | pour compiler `lpcnet_demo` depuis radae |
| PyTorch | 2.0+ | requis par `radae_rxe.py` |
| Node.js | 16+ | pour `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — toutes versions prises en charge |
| matplotlib | quelconque | requis par `radae_rxe.py` à l'importation |
| numpy | 1.23+ | requis ; permet aussi le rééchantillonnage |
| scipy | quelconque | facultatif, permet un rééchantillonnage précis |

---

## Contrôle du sidecar

**Vous n'avez normalement pas besoin d'un script de contrôle distinct pour RADE.** Les lanceurs du récepteur (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) démarrent eux-mêmes le sidecar dès que le serveur est confirmé en marche, le relancent s'il s'arrête et signalent son état dans leur résumé de fin — `✔ RADE sidecar running`, ou une note `·` expliquant pourquoi il n'a pas été activé (non installé, `RADE_ENABLED=0`, ou pas de `python3`). `./stop-websdr.sh` l'arrête en même temps que le serveur. Pour faire tourner le serveur sans RADE, démarrez-le avec `RADE_ENABLED=0`.

`rade.sh` reste fourni pour un usage autonome — faire tourner le sidecar sans le lanceur PhantomSDR-Plus, ou le tester seul :

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

L'activité du sidecar est journalisée dans `~/PhantomSDR-Plus/rade.log` :

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Ne mélangez pas les deux pendant que le serveur tourne.** Si le chien de garde d'un lanceur est actif, il ramène le sidecar en cinq secondes environ, si bien que `./rade.sh stop` semble avoir échoué. Pour arrêter RADE alors que le serveur tourne, démarrez le serveur avec `RADE_ENABLED=0`, ou arrêtez tout avec `./stop-websdr.sh`.

> Si vous lancez `rade.sh` de façon autonome, **utilisez toujours `./rade.sh stop`** — un simple `pkill -f rade_helper.py` ne bat pas son propre chien de garde, qui relance le processus en 3 secondes.

---

## Le port 9012

Le sidecar écoute sur le port TCP **9012**, à l'intérieur de l'ordinateur seulement. Le navigateur l'atteint via `proxy.py` en `/rade` sur le port public 9000 ; aucun autre port n'est donc à ouvrir sur le routeur ni dans un pare-feu.

```bash
# Is the sidecar listening?
ss -tlnp | grep 9012
```

---

## Utiliser RADE dans le navigateur

1. Ouvrez votre interface web PhantomSDR-Plus
2. Trouvez les stations actives sur **[qso.freedv.org](https://qso.freedv.org)**
3. Accordez-vous sur la fréquence affichée de la station
4. Dans **Decoder Options**, sélectionnez :
   - **RADE v2 · RADE2** pour RADE V2 (beta), USB sur toutes les bandes
   - **RADE v1 — RADEL (LSB)** pour 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** pour 20 m / 17 m / 15 m / 12 m / 10 m
5. Cliquez sur **Decoder: ON**

### Les boutons RADE-v1L / RADE-v1U (une pression)

Les étapes 4 et 5 peuvent être remplacées par une seule pression. Une paire de boutons **RADE-v1L** / **RADE-v1U** est disponible à trois endroits :

- à côté du titre **Modes** du panneau principal ;
- dans la fenêtre **Modes** ;
- dans la fenêtre **Bands**.

Une pression sélectionne le décodeur, met le décodeur sur ON, ferme la fenêtre depuis laquelle vous avez appuyé et amène le panneau RADE à l'écran. Le bouton devient bleu tant que RADE tourne. **Appuyez de nouveau sur le même bouton pour arrêter RADE** — le panneau se ferme, et le mode ainsi que la bande passante reviennent à leur valeur par défaut comme décrit plus bas. Les boutons, le menu déroulant **Decoder Options** et le bouton ON/OFF partagent le même état.

Un bouton **RADE-v2U** se trouve avant RADE-v1L et RADE-v1U aux trois mêmes endroits (et un bouton RADE2 sur `/mobile`) ; il lance RADE V2 (beta) en USB — voir [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

### États de l'indicateur du panneau

| Indicateur | Signification |
|---|---|
| 🔴 Rouge — « Connecting to sidecar… » | Port 9012 injoignable ou sidecar arrêté |
| 🟡 Jaune — « Searching for signal… » | Sidecar connecté, aucune trame RADE encore détectée |
| 🟢 Vert — « Synced · SNR x.x dB » | Décodage en cours — la parole est audible |

### Quand vous désactivez le décodeur

Le mode et la bande passante reviennent automatiquement à la valeur par défaut correcte pour la fréquence courante, telle que définie dans `bands-config.js` — comme pour FAX, NAVTEX, FSK.

---

## Vérification et débogage

### Le sidecar tourne-t-il ?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 9012
```

### Suivre l'activité en direct

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Lorsqu'un navigateur se connecte :
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Console du navigateur (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:9000/rade
```
Bon signe — le WebSocket est ouvert. La valeur en Hz correspond à l'`audioOutputSps` de votre serveur (typiquement 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Le sidecar est injoignable — vérifiez qu'il tourne (`ss -tlnp | grep 9012`) et que `proxy.py` tourne.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `RADE_HELPER_PORT` | `9012` | Port TCP sur lequel le sidecar écoute |
| `RADE_HELPER_HOST` | `0.0.0.0` | Adresse de liaison (`127.0.0.1` derrière un proxy) |
| `RADAE_DIR` | `~/radae` | Racine du dépôt radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Poids du modèle |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binaire lpcnet_demo |
| `RADE_AUXDATA` | `1` | Mettre à `0` pour passer `--noauxdata` à `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | Threads PyTorch/OpenBLAS par instance de `radae_rxe.py` — limite l'usage CPU |
| `RADE_PIN_CORES` | `1` | Épingle chaque chaîne de décodage sur son propre jeu de cœurs ; `0` désactive l'épinglage |
| `RADE_CORES_PER_CLIENT` | `2` | Cœurs alloués par client lorsque l'épinglage est activé |
| `RADE_C_DIR` | `~/rade_c` | Racine de rade_c (RADE V2) |
| `RADE_C_RX` | `RADE_C_DIR/build/src/radae_rx` | Programme de réception de rade_c |
| `RADE_C_LPCNET` | `RADE_C_DIR/build/src/lpcnet_demo` | Le lpcnet_demo propre à rade_c |
| `RADE_V2_MIN_SNR` | `-2` | En dessous de ce SNR (dB), le son de V2 est coupé |
| `RADE_V2_WEAK_SNR` | `-6` | Jusqu'à ce SNR (dB), V2 continue de jouer tant que le signal ressemble à du vrai V2 ; le régler à `RADE_V2_MIN_SNR` ou plus pour désactiver cela |
| `RADE_V2_TARGET_DB` | `-16` | Niveau vers lequel la parole V2 est amenée, en dBFS (`0` = désactivé) |

---

## Dépannage

### Bannière rouge — « Sidecar not reachable »

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &
```

---

### `lpcnet_demo: No such file or directory`

La compilation de radae n'a pas abouti. Recompilez :

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Indicateur jaune — « Searching for signal » — ne se synchronise jamais

- Confirmez la bonne bande latérale : RADEL pour ≤ 10 MHz, RADEU pour > 10 MHz
- Consultez [qso.freedv.org](https://qso.freedv.org) pour vérifier qu'une station émet actuellement
- RADE v1 utilise 30 porteuses dans 1500 Hz de bande — il apparaît comme un groupe compact dans la cascade
- Comptez jusqu'à 1,5 seconde pour l'acquisition

---

### Plusieurs utilisateurs simultanés

Chaque connexion de navigateur lance sa propre paire indépendante `radae_rxe.py` + `lpcnet_demo`, de sorte que chaque utilisateur peut s'accorder librement sur une fréquence différente.

Par défaut, `radae_rxe.py` utilise **tous les cœurs CPU disponibles** pour les opérations matricielles PyTorch, ce qui provoque une charge d'environ 900 % par instance. `rade_helper.py` limite cela avec deux optimisations :

1. `OMP_NUM_THREADS=1` (et les équivalents MKL/OpenBLAS) — limite PyTorch à 1 thread
2. Fonctions de conversion audio vectorisées avec numpy — éliminent le coût des boucles Python

Résultat : chaque instance consomme environ **8 à 10 %** d'un cœur, suffisant pour un décodage RADE en temps réel. Si vous entendez des coupures audio, passez à 2 threads :

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Utilisateurs RADE simultanés | CPU approximatif |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Sur un i5-12450H (12 threads) avec spectrumserver à ~42 % et rx888_stream à ~11 %, vous disposez d'environ **1000 % de marge** — assez pour **20 utilisateurs RADE simultanés ou plus** avant que le CPU ne devienne un souci.

---

## Mettre RADE v1 à jour

**Pour mettre RADE à jour, relancez `./install_rade.sh`.** Il récupère les dernières versions de radae et rade_c, les recompile et redémarre le sidecar ; le récepteur lui-même n'a pas besoin de redémarrer.

---

*Développé et testé sur PhantomSDR-Plus (fork sv1btl/PhantomSDR-Plus) avec un RX-888 MK2 sous Ubuntu 24.04. Le serveur C++ n'est pas modifié.*

*RADE est développé par David Rowe VK5DGR et l'équipe FreeDV.* *Voir [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Désinstallation complète et réinstallation propre

Voici le démontage complet avant de relancer install_rade.sh :
1. Arrêter le sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Supprimer le dépôt radae et sa compilation rm -rf ~/radae
3. Supprimer torch (installé dans le répertoire local de l'utilisateur) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Supprimer les paquets Python d'apt (facultatif — à ignorer s'ils servent à autre chose) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Vérifier que tout a disparu python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Installation propre chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
