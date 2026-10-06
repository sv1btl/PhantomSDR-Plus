# Plusieurs récepteurs — Manuel du sysop

> **Numéros de port.** Les exemples ci-dessous utilisent les ports d'une station configurée avant les questions de la station (8900, 8901, …). Sur une station configurée avec `configure-station.sh`, `proxy.py` occupe déjà le port public 9000 et le récepteur principal est sur 9001 ; donnez donc aux récepteurs suivants 9002, 9003, etc.

**Deux récepteurs ou plus sur un même ordinateur, avec un sélecteur de récepteur sur la page.**

Depuis la v5.0.0, un ordinateur PhantomSDR-Plus peut faire tourner plusieurs récepteurs en même temps — par exemple un RX-888 pour les ondes courtes et un RTL-SDR pour le 2 m — et les auditeurs passent de l'un à l'autre par des boutons dans l'en-tête de la page, comme OpenWebRX propose ses profils. Chaque récepteur garde sa propre cascade, son chat, ses repères, sa liste d'auditeurs et ses informations de station ; personne sur un récepteur n'est jamais gêné par quelqu'un sur un autre.

> **Pressé ?** Une station à un seul récepteur n'a besoin de rien de tout cela et ne voit aucun changement. Pour un second récepteur : créez `instances/<nom>/` avec son propre `config.toml`, démarrez-le avec `INSTANCE=<nom> ./start-<radio>.sh`, inscrivez les deux récepteurs dans `receivers.toml` et redémarrez le proxy. L'exemple de la [section 3](#3-ajouter-un-second-récepteur) le détaille ligne par ligne.

> **Le plus simple :** lancez `./add-receiver.sh` (les installeurs le proposent à la fin). Il demande quel récepteur et ce qu'il doit couvrir, installe son pilote, écrit tout ce que décrivent la [section 3](#3-ajouter-un-second-récepteur) et la [section 4](#4-receiverstoml), et propose de démarrer le récepteur et de redémarrer le proxy. Le reste de ce manuel explique ce qu'il fait, pour le jour où vous voulez modifier quelque chose à la main.

---

## Sommaire

1. [Comment cela fonctionne](#1-comment-cela-fonctionne)
2. [Deux façons de publier les récepteurs](#2-deux-façons-de-publier-les-récepteurs)
3. [Ajouter un second récepteur](#3-ajouter-un-second-récepteur)
4. [receivers.toml](#4-receiverstoml)
5. [Démarrer et arrêter](#5-démarrer-et-arrêter)
6. [Ce que voient les auditeurs](#6-ce-que-voient-les-auditeurs)
7. [Le S-mètre au-dessus de 30 MHz](#7-le-s-mètre-au-dessus-de-30-mhz)
8. [Sécurité](#8-sécurité)
9. [Combien de récepteurs tiennent](#9-combien-de-récepteurs-tiennent)
10. [Pièges à connaître](#10-pièges-à-connaître)

---

## 1. Comment cela fonctionne

Chaque récepteur est un spectrumserver complet et indépendant, avec son propre SDR, sa propre configuration et son propre port interne. Ils ne partagent jamais d'échantillons, de réglages ni d'auditeurs. Ce qui les relie, c'est `proxy.py`, le proxy inverse qui sert déjà le panneau d'administration : il lit `receivers.toml` et envoie chaque requête à un récepteur.

```
                         ┌──► :8900  spectrumserver  RX-888   (HF, le récepteur principal)
auditeurs ──► proxy.py ──┤
                         └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, instance "vhf")
```

Le proxy décide d'après ces éléments, dans cet ordre :

1. `?rx=<id>` dans l'adresse — `http://votre.hote:8899/?rx=vhf`. La page l'ajoute à chaque socket, requête et lien qu'elle ouvre, si bien qu'un onglet reste sur son récepteur.
2. Le cookie `rx`, que le proxy pose chaque fois qu'une requête porte un `?rx=` valide.
3. L'en-tête Host, si un récepteur cite ce nom dans `hostnames`.
4. Sinon le récepteur par défaut.

Le **récepteur principal** est celui que l'on démarre comme d'habitude (`./start-rx888mk2.sh`). Tout autre récepteur est une **instance nommée** : démarrée avec `INSTANCE=<nom>`, configurée dans `instances/<nom>/`, avec son propre journal (`logwebsdr-<nom>.txt`), journal du serveur, verrou du watchdog et FIFO. Les processus se distinguent par une étiquette `PHANTOMSDR_INSTANCE` dans leur environnement, pas par leur nom ; deux récepteurs peuvent donc exécuter exactement le même programme — deux `rtl_sdr`, ou `rx_sdr` pour un RSP1A et un Airspy — et le redémarrage de l'un ne touche jamais l'autre.

---

## 2. Deux façons de publier les récepteurs

**A — le récepteur principal garde son propre port.** Le récepteur principal reste exactement où il était (par exemple `:8900`), ses auditeurs ne remarquent rien, et l'on atteint les autres récepteurs par le port du proxy (`proxy_port` dans `admin_config.json`, par exemple `:8899`) avec `?rx=`. Rien ne bouge et rien ne quitte l'antenne ; en contrepartie il y a deux ports publics.

```
HF :  http://votre.hote:8900/
2 m : http://votre.hote:8899/?rx=vhf
```

**B — un seul port public pour tout.** Le proxy prend le port public et le récepteur principal passe sur un port interne. Définissez `[front] port` dans `receivers.toml`, déplacez le `[server] port` du récepteur principal et mettez-y `host = "127.0.0.1"`, mettez le nouveau port interne dans `public_port` de `admin_config.json` et ajoutez `public_port = <le port public>` sous `[websdr]`, pour que l'annuaire continue d'annoncer le bon. Tout se trouve alors derrière un seul port ; le prix est une courte coupure pendant le déplacement.

```
HF :  http://votre.hote:8900/
2 m : http://votre.hote:8900/?rx=vhf
```

Le sélecteur de récepteur fonctionne de la même façon dans les deux cas. La disposition A est le début le plus sûr ; B peut suivre plus tard sans rien changer au second récepteur.

---

## 3. Ajouter un second récepteur

**`add-receiver.sh` effectue toutes les étapes ci-dessous** — lancez-le et répondez à ses questions ; il installe aussi le pilote (`setup-rtlsdr.sh` pour un RTL-SDR, le `setup-*.sh` correspondant pour les autres), choisit un port interne libre et nomme le récepteur d'après ce qu'il couvre. Les étapes sont détaillées ici pour que vous puissiez vérifier son travail ou le modifier plus tard.

L'exemple ajoute un RTL-SDR Blog V4 pour le 2 m comme instance `vhf`, à côté d'un RX-888 qui garde le port 8900 (disposition A).

**1. Le pilote.** Le RTL-SDR Blog V4 a besoin du pilote de RTL-SDR Blog plutôt que du paquet `rtl-sdr` de la distribution, et le pilote DVB-T du noyau doit libérer la clé. `install.sh` (option de récepteur 2, « RTL-SDR Blog V4 : oui ») fait les deux. Vérifiez avec `rtl_test -t`, qui doit afficher `RTL-SDR Blog V4 Detected`.

**2. Le dossier de l'instance.** Tout ce qui appartient au récepteur se trouve dans `instances/vhf/`, jamais versionné et jamais écrasé par une mise à jour :

```
instances/vhf/
├── config.toml          la configuration de son spectrumserver (obligatoire)
├── instance.env         facultatif : paramètres du récepteur et cœurs de CPU
├── markers.json         ses propres repères
└── www/                 ses propres copies des fichiers de station de la page
    ├── site_information.json
    └── wf-message.json
```

spectrumserver tourne avec `instances/vhf/` comme répertoire de travail ; l'historique du chat, les repères, le FFTW wisdom et `logs/` sont donc aussi les siens.

**3. `config.toml`.** Partez de `config-rtl.toml` et modifiez :

```toml
[server]
port=9002                              # son propre port interne
host="127.0.0.1"                       # joignable uniquement par le proxy
html_root="www/"                       # ses quelques fichiers propres...
html_fallback_root="../../frontend/dist/"   # ...et la page commune pour le reste

[input]
sps=2400000                            # identique à -s dans instance.env
frequency=145000000                    # identique à -f dans instance.env

[input.defaults]
frequency=145500000
modulation="FM"

[kiwi_emulation]
enabled = false                        # voir les pièges plus bas
```

`html_fallback_root` permet à l'instance de ne garder que ses propres `site_information.json` et `wf-message.json`, tandis que tout le reste — la page compilée elle-même — vient de `frontend/dist` ; une seule compilation du frontend atteint ainsi chaque récepteur. Une copie de `frontend/dist` faite de liens symboliques ne fonctionne pas : le serveur refuse les fichiers qui aboutissent hors de son propre dossier.

**4. `instance.env`.** Lu par le script de démarrage après ses propres réglages :

```bash
RX_ARGS="-f 145000000 -s 2400000 -g 29.7 -"   # -f et -s identiques à config.toml
SPECTRUM_CORES=8-11                           # hors des cœurs du récepteur principal
```

**5. Les informations de sa page.** Copiez `frontend/site_information.json` dans `instances/vhf/www/` et modifiez : `siteReceiver`, `siteAntenna`, `siteSDRBaseFrequency` et `siteSDRBandwidth` (ils décident quels boutons de bande apparaissent), ainsi que les clés décrites à la [section 6](#6-ce-que-voient-les-auditeurs).

**6. Démarrez-le.**

```bash
INSTANCE=vhf ./start-rtl.sh
```

**7. Inscrivez-le dans `receivers.toml`** et redémarrez le proxy (`sudo systemctl restart phantomsdr-proxy`). Le second récepteur est maintenant à `http://votre.hote:8899/?rx=vhf`, et les deux pages affichent le sélecteur.

---

## 4. receivers.toml

Copiez `receivers.toml.example` en `receivers.toml`. Sans ce fichier, le proxy sert un seul récepteur, comme toujours.

```toml
# [front]
# port = 8900        # disposition B seulement : le proxy écoute aussi sur ce port public

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 8900
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://votre.hote:8900/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://votre.hote:8899/?rx=vhf"
```

| Clé | Signification |
|---|---|
| `id` | Nom court utilisé dans `?rx=` ; lettres, chiffres, `-` et `_` |
| `name` | Le texte du bouton du récepteur |
| `port` | Le `[server] port` de son spectrumserver |
| `host` | Facultatif ; où tourne ce spectrumserver (par défaut `127.0.0.1`) |
| `default` | Le récepteur des requêtes qui n'en nomment aucun ; un seul au plus |
| `launcher` | Son `start-*.sh`, pour `start-all.sh` ; à omettre pour un récepteur que cet ordinateur ne démarre pas |
| `instance` | Le nom de son instance ; à omettre pour le récepteur principal |
| `url` | Où son bouton envoie l'auditeur ; sans elle, `/?rx=<id>` sur le proxy |
| `hostnames` | Noms DNS facultatifs qui mènent directement à ce récepteur |

Le proxy sert aussi la liste sous `/receivers.json` (identifiants, noms et liens — jamais les ports internes) ; c'est ce que lit le sélecteur.

---

## 5. Démarrer et arrêter

| Commande | Effet |
|---|---|
| `./start-rx888mk2.sh` | Démarre ou redémarre le récepteur principal |
| `INSTANCE=vhf ./start-rtl.sh` | Démarre ou redémarre le récepteur `vhf` |
| `./start-all.sh` | Démarre chaque récepteur de `receivers.toml` qui a un `launcher` |
| `./stop-websdr.sh vhf` | Arrête seulement `vhf` |
| `./stop-websdr.sh main` | Arrête seulement le récepteur principal |
| `./stop-websdr.sh` | Arrête tous les récepteurs, comme toujours |

**Tant qu'un récepteur est arrêté**, son bouton disparaît du sélecteur — le proxy ne recense que les récepteurs qui répondent, et les pages ouvertes relisent la liste une fois par minute — et il revient quand le récepteur redémarre ; s'il ne reste qu'un récepteur en marche, la ligne *Receivers:* disparaît entièrement. Un récepteur arrêté revient toutefois de lui-même chaque fois que tous les récepteurs sont démarrés : `./start-all.sh`, le **Restart** du panneau d'administration et un redémarrage par la protection thermique démarrent tout ce que liste `receivers.toml`. Pour en garder un éteint durablement, supprimez (ou commentez) son bloc `[[receiver]]` et redémarrez le proxy.

Réglez le **Default start script** du panneau d'administration sur `start-all.sh`. Son Stop arrête déjà tous les récepteurs, et son Restart ainsi que la protection thermique utilisent le script de démarrage ; avec `start-all.sh`, ils ramènent tous les récepteurs au lieu du seul principal.

L'auxiliaire RADE n'appartient qu'au récepteur principal. Une instance nommée ne le démarre ni ne l'arrête jamais.

---

## 6. Ce que voient les auditeurs

**Le sélecteur de récepteur.** Sur une station à plusieurs récepteurs, l'en-tête de la page reçoit une ligne à lui, *Receivers:*, avec un bouton par récepteur ; le récepteur actuel apparaît en jaune. La page /mobile a les mêmes boutons en deuxième rangée de sa barre supérieure, et ils ouvrent la page /mobile de l'autre récepteur.

**Les informations propres à chaque récepteur.** Une page ouverte sur un second récepteur charge le `site_information.json` de ce récepteur avant de démarrer ; les boutons de bande, la fréquence de départ, la liste des auditeurs, les informations de station et les liens Receiver et Antenna sont donc tous les siens. Une visite ordinaire du récepteur principal ne fait aucune requête supplémentaire.

Les clés de `site_information.json` concernées :

| Clé | Signification |
|---|---|
| `siteReceiverId` | Le récepteur auquel appartient cette page (son `id`) ; à omettre sur le récepteur principal |
| `siteReceiversList` | Où le sélecteur lit la liste, p. ex. `http://votre.hote:8899/receivers.json` ; nécessaire sur un récepteur dont la page n'est pas servie par le proxy |
| `siteReceiverURL` | Vers où pointe le nom de *Receiver* dans *Open Additional Info* |
| `siteAntennaURL` | Vers où pointe le nom de *Antenna* ; `""` affiche le nom sans lien |

**Quand le sélecteur reste caché.** Le sélecteur n'affiche qu'une liste qui cite l'hôte sous lequel la page a été ouverte. Ouverte par l'adresse du réseau local (`http://192.168.1.10:8900/`), il reste caché ; ouverte en `http://votre.hote:8900/`, il apparaît. C'est voulu : une station qui a copié le `site_information.json` d'une autre sans le modifier n'affiche jamais les récepteurs de celle-ci comme les siens.

---

## 7. Le S-mètre au-dessus de 30 MHz

La norme de l'IARU Région 1 place S9 à −73 dBm sous 30 MHz et à **−93 dBm au-dessus**, avec six dB par point S dans les deux cas. Les S-mètres (l'aiguille analogique, la barre numérique et la barre de /mobile) suivent la fréquence accordée : au-dessus de 30 MHz ils indiquent des points S VHF, en dessous comme avant. Les valeurs en dBm et dBµV ne changent jamais. Si vous préférez que les instruments restent à 0 sur un canal vide, comme ceux d'un transceiver VHF/UHF, ajoutez `"siteSMeterGateDb": 6` au `site_information.json` du récepteur (sans recompilation) : au-dessus de **60 MHz**, l'aiguille et la barre ne montent alors que lorsqu'un signal dépasse de ce nombre de dB le bruit de son propre voisinage (le point le plus fort de la bande passante face au spectre ±100 kHz autour). C'est **désactivé par défaut** — un instrument étalonné qui montre le vrai bruit de bande est la lecture la plus honnête. La page /mobile, qui n'a pas de cascade, estime le bruit à partir du niveau reçu lui-même.

Étalonnez les dBm d'un récepteur VHF avec `analog_smeter_offset` (aiguille et valeurs) et `smeter_offset` (barre numérique) sous `[input]` dans son `config.toml`, puis redémarrez ce récepteur. Fixez d'abord le gain : un RTL-SDR donne ses niveaux par rapport à sa propre pleine échelle, donc chaque changement de gain déplace les lectures. Sans générateur, une charge de 50 Ω à la place de l'antenne, en USB avec un filtre de 2,7 kHz, doit indiquer environ −136 dBm (le bruit thermique dans 2,7 kHz vaut −139,7 dBm, plus le facteur de bruit de la clé).

Pour un RTL-SDR, `add-receiver.sh` écrit un étalonnage de départ : un gain fixe `-g 29.7` dans `instance.env` (le gain automatique du tuner ne s'étalonne pas) ainsi que `analog_smeter_offset=-55` et `smeter_offset=-38`, mesurés sur un RTL-SDR Blog V4 à ce gain avec un signal de −71 dBm (63 µV). Une autre clé du même modèle s'en écarte en général de quelques dB seulement ; vérifiez-la avec un signal connu et réétalonnez si vous changez le gain.

---

## 8. Sécurité

Placer le proxy devant les auditeurs a fermé deux failles, toutes deux corrigées dans la v5.0.0 :

- **L'expulsion du sysop à travers le proxy.** spectrumserver n'accepte `/~~kick` que depuis son propre ordinateur, et pour lui chaque requête relayée par le proxy vient de son propre ordinateur. Quiconque atteignait le port du proxy pouvait donc déconnecter et bannir n'importe quel auditeur. Le proxy ne répond désormais à `/~~kick` que pour les clients du même ordinateur.
- **Adresses de client falsifiées.** spectrumserver croyait l'en-tête `X-Forwarded-For` de n'importe qui ; un visiteur pouvait donc se dire `127.0.0.1` et passer outre les limites par adresse. L'en-tête n'est désormais cru que s'il vient d'un proxy local, et le proxy supprime toute copie envoyée par un client avant d'ajouter la sienne.

Liez chaque récepteur joint par le proxy à `127.0.0.1` (`[server] host`), afin que son port ne puisse pas servir à contourner le proxy. Les limites par adresse de [Limites de connexion](CONNECTION_LIMITS.md) s'appliquent par récepteur.

---

## 9. Combien de récepteurs tiennent

Le logiciel ne fixe aucune limite ; le matériel, si. Les récepteurs à bande étroite coûtent peu : un RTL-SDR à 2,4 Msps utilise environ 5 à 10 % d'un cœur, quelques dizaines de Mo de mémoire et environ 38 Mbit/s d'USB.

- **L'USB 2.0 est le plafond habituel.** Tous les périphériques USB 2 partagent un bus de 480 Mbit/s, même dans une prise USB 3 bleue. Trois à quatre RTL-SDR par bus est un chiffre sûr ; ajoutez-les un par un et surveillez chaque cascade pour repérer des trous.
- **Alimentation :** au-delà de deux clés, utilisez un hub alimenté.
- **Un second récepteur large bande** (un autre RX-888, ou un HackRF à 20 Msps) est une autre affaire : il dispute au premier l'USB 3, le CPU et le GPU.
- **Les auditeurs coûtent plus que les récepteurs.** Chaque auditeur coûte du CPU sur son récepteur et de la bande passante montante ; le nombre total d'auditeurs compte donc plus que le nombre de récepteurs.

---

## 10. Pièges à connaître

- **Deux clés du même modèle ont le même numéro de série.** Chaque RTL-SDR Blog V4 indique `00000001`. Donnez à chacune le sien avec `rtl_eeprom -s <série>` (une seule clé branchée à la fois) et nommez-le dans `instance.env` (`RX_ARGS="-d <série> …"`), sinon après un redémarrage les clés peuvent échanger leurs récepteurs.
- **Les clients Kiwi ne peuvent pas choisir de récepteur.** Un client KiwiSDR appelle une simple adresse et un port ; à travers le proxy il aboutit toujours au récepteur par défaut. Laissez `[kiwi_emulation]` désactivé sur les autres.
- **Les cookies valent par hôte, pas par port.** Un visiteur qui a utilisé le second récepteur sur `:8899` emporte aussi `rx=vhf` vers `:8900`. C'est pourquoi une page décide quel récepteur elle est d'après `siteReceiverId`, jamais d'après le cookie.
- **Les entrées d'annuaire.** Donnez à chaque récepteur son propre nom dans `[websdr]`, et sur un récepteur derrière le proxy mettez `[websdr] public_port` au port qu'utilisent les auditeurs, sinon l'entrée annonce le port interne.
- **Une compilation du frontend affiche brièvement « Not Found ».** `frontend/dist` est recompilé sur place ; pendant quelques secondes de compilation, la page manque sur chaque récepteur.
- **Rien ne démarre les récepteurs au démarrage de l'ordinateur**, à moins que vous ne le prévoyiez. Après un redémarrage, `./start-all.sh` les ramène tous.
