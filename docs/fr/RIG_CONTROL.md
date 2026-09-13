# PhantomSDR-Plus — Pilotage du transceiver (CAT)

Gardez **votre propre transceiver** et un **récepteur PhantomSDR-Plus** sur la même fréquence, le même mode et le même filtre. Tournez le bouton d'accord du poste et la cascade suit ; cliquez sur un signal dans la cascade et le poste s'y accorde. Passez en émission, et le récepteur peut se taire pour ne pas vous renvoyer votre propre signal.

Cela fonctionne avec les récepteurs **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR**, le vôtre ou celui d'un autre, et ne déplace jamais que *votre* session d'écoute — personne d'autre sur le récepteur n'entend ni ne voit rien. L'opérateur du récepteur n'a rien à installer ni à configurer.

---

## Ce qu'il vous faut

Deux façons de raccorder un poste, et une condition côté récepteur :

| Élément | Ce que c'est | Synchronise |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 ou ultérieur** | L'application de bureau, avec un menu **Rig**. Linux (PC et Raspberry Pi) et Windows. | Fréquence, mode, largeur de filtre, coupure du son en émission — dans un sens ou dans les deux |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Un programme Windows séparé qui couple un poste à la page du récepteur dans votre navigateur. | Fréquence et mode |
| **Le récepteur** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR ou UberSDR. Un récepteur PhantomSDR-Plus demande la 4.0 avec la **mise à jour de septembre 2026** ou ultérieure pour la largeur de filtre et la coupure du son. | Un PhantomSDR-Plus plus ancien synchronise toujours fréquence et mode |

La suite de ce manuel décrit Desktop PhantomSDR+. Le CATsync Tool a sa propre documentation sur son site.

---

## Récepteurs pris en charge

L'application reconnaît le type de récepteur d'une fenêtre de station et le pilote par les commandes propres à cette page. La fenêtre Rig control indique le type trouvé à côté du nom de la station.

| Récepteur | Fréquence et mode | Largeur de filtre | Coupure du son en émission |
|---|---|---|---|
| PhantomSDR-Plus | Oui | Avec la mise à jour de septembre 2026 ou ultérieure | Avec la mise à jour de septembre 2026 ou ultérieure |
| KiwiSDR (y compris Web-888) | Oui | Oui | Oui |
| PA3FWM WebSDR | Oui, avec changement de bande sur un site multibande | Oui | Oui |
| UberSDR | Oui | Oui | Oui |

Un récepteur web a moins de modes que la plupart des postes, si bien que certains modes du poste partagent un mode du récepteur : KiwiSDR et WebSDR n'ont qu'un seul CW pour CW et CW-R. Les modes de récepteur cités dans ce manuel sont ceux de PhantomSDR-Plus ; les autres récepteurs utilisent l'équivalent le plus proche. Un WebSDR garde un filtre CW sous 1 kHz et les autres filtres à 1 kHz ou plus, parce que c'est ainsi que la page elle-même reconnaît le CW, et une fréquence hors de toutes les bandes d'un site WebSDR est laissée de côté. UberSDR règle son filtre par pas de curseur, de sorte qu'une largeur peut tomber jusqu'à environ 50 Hz de celle du poste. Tout autre type de page — OpenWebRX, par exemple — affiche *not a receiver this app can drive*, et rien n'est synchronisé.

---

## Ce qu'il fait, et ce qu'il ne fait pas

- Il synchronise **un poste avec une fenêtre de récepteur** à la fois.
- Il lit les deux côtés plusieurs fois par seconde et, s'ils diffèrent, règle l'un sur l'autre. Il **n'émet pas**, ne commande pas le PTT et n'envoie de son nulle part.
- Déplacer le récepteur ne change que votre propre session. Les autres auditeurs du même récepteur ne sont pas affectés, et l'opérateur n'a pas à l'autoriser.
- Un port série ne peut être ouvert que par **un programme à la fois**. Si WSJT-X, un carnet de trafic ou un utilitaire du constructeur tient déjà le port, utilisez le choix **flrig** ou **rigctld on network** pour partager le poste au lieu de vous disputer le port.

---

## Démarrage rapide

1. Ouvrez une station dans Desktop PhantomSDR+ comme d'habitude.
2. **Rig → Rig control...**
3. Sous **Connection**, choisissez **Built-in** si votre poste est dans la liste, sinon **Hamlib (all rigs)**.
4. Choisissez votre poste, le port série et la vitesse réglée dans le menu CAT ou CI-V du poste.
5. Sous **Sync**, laissez **Both directions** sélectionné.
6. Appuyez sur **Connect**. Les deux affichages du haut — transceiver et récepteur — doivent montrer la même fréquence en moins d'une seconde.

Chaque réglage est enregistré dès que vous le modifiez. La fois suivante, **Rig → Connect** suffit, ou cochez **Connect when the app starts**.

---

## Choisir comment joindre le poste

| Choix | À utiliser quand | Il faut |
|---|---|---|
| **Built-in** | Votre poste figure dans la liste ci-dessous. | Rien d'autre |
| **Hamlib (all rigs)** | Votre poste est autre chose — Hamlib en connaît plus de 300. L'application lance pour vous le `rigctld` de Hamlib, sur un port local privé, et l'arrête à la déconnexion. | Windows : rien, Hamlib est inclus. Linux : `sudo apt install libhamlib-utils` |
| **rigctld on network** | Un `rigctld` tourne déjà, sur cet ordinateur ou un autre de votre réseau. | L'hôte et le port (4532 par défaut) |
| **flrig** | flrig pilote déjà le poste pour fldigi, WSJT-X ou un carnet de trafic. | flrig lancé, avec son port XML-RPC (12345 par défaut) |

### Postes avec pilote intégré

La vitesse et l'adresse CI-V indiquées sont les valeurs d'usine que l'application préremplit. **Ce n'est qu'un point de départ — réglez-les selon le menu de votre poste.**

| Famille | Postes | Vitesse par défaut | Remarques |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 et tout autre poste CI-V | 19200 | Adresse CI-V préremplie par modèle (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresse `70` ; vérifiez le menu |
| **Yaesu nouveau CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu CAT classique** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 bits de stop ; s'accorde par pas de 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | La largeur de filtre est synchronisée |
| **Compatibles Kenwood** | FlexRadio SmartSDR CAT (port virtuel), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, autres postes compatibles Kenwood | 9600–38400 | |

Un poste censé être compatible mais qui ne dialogue pas avec un pilote intégré fonctionne généralement avec **Hamlib**, qui s'accommode de bien plus de variantes.

---

## Réglages du port série

| Réglage | Quoi y mettre |
|---|---|
| **Serial port** | Le port du poste. Les adaptateurs USB et les postes à port USB sont listés en premier. **Other / network address...** accepte un port absent de la liste — `COM7`, `/dev/ttyUSB1` — ou `tcp://hôte:port` pour un port série servi sur le réseau par ser2net ou équivalent. |
| **Speed (baud)** | Exactement ce qu'indique le menu de débit CAT / CI-V du poste. Un débit erroné ressemble à un poste qui ne répond jamais. |
| **Stop bits** | 1 pour presque tout ; 2 pour la famille FT-817/857/897. |
| **CI-V address** | Icom uniquement, en hexadécimal (`94`, pas `148`). Doit correspondre au menu d'adresse CI-V. |
| **DTR / RTS** | Laissez-les **désactivés** sauf si votre interface en a besoin. Beaucoup de câbles CAT déclenchent l'émetteur, ou réinitialisent le poste, sur l'une de ces lignes. |
| **Hardware flow control** | Désactivé, sauf si le manuel demande RTS/CTS. |

Avec **Hamlib**, les mêmes réglages sont transmis à `rigctld`. Les bits de stop y ont en plus un choix *Rig default*, et **Extra rigctld options** accepte toute autre option de `rigctld`, par exemple `--set-conf=post_write_delay=10`. **rigctld program** permet de désigner un `rigctld` précis si plusieurs sont installés.

---

## Synchronisation

### Sens

| Choix | Ce qui se passe |
|---|---|
| **Rig → receiver** | La fenêtre du récepteur suit le poste. Une modification dans la cascade est ramenée à la fréquence du poste. |
| **Receiver → rig** | Le poste suit la fenêtre du récepteur. Tourner le bouton du poste est annulé. |
| **Both directions** | Le côté touché **en dernier** l'emporte. Au moment de la connexion, avant qu'aucun ne soit touché, c'est le poste. |

Le sens se change aussi depuis le menu **Rig** en cours de connexion.

### Comment on empêche les deux côtés de se battre

Chaque valeur écrite par l'application réapparaît un instant plus tard comme un changement de l'autre côté. Pris au pied de la lettre, le poste et le récepteur se courraient après sans fin. L'application l'évite de trois façons :

- La page du récepteur applique un changement immédiatement ; elle est donc relue juste après l'écriture, et cette lecture devient le nouveau point de départ.
- Un poste applique un changement un peu plus tard ; chaque valeur envoyée est donc mémorisée. Quand le poste renvoie cette valeur, elle est reconnue comme une écriture de l'application et non comme une main sur le bouton.
- Une valeur que le poste refuse — la FM large sur un poste HF, par exemple — est envoyée **deux fois** puis laissée tranquille jusqu'à ce que le côté source change, au lieu d'être répétée plusieurs fois par seconde.

Réaccorder la page du récepteur peut lui faire choisir le mode par défaut de la bande (LSB sous 10 MHz, par exemple). Quand c'est le poste qui mène, l'application remet aussitôt le mode du poste, si bien qu'un poste en USB sur 40 m garde le récepteur en USB.

### Quelle fenêtre de récepteur

**Receiver window** choisit quelle station suit le poste :

- **The station window last in front** (par défaut) — avec deux stations ouvertes, cliquez dans l'une et le poste la suit.
- **Une station précise** — le poste y reste attaché, qu'elle soit au premier plan ou non. Si cette station n'est pas ouverte, rien n'est synchronisé jusqu'à son ouverture.

### Cadence de mise à jour

**Update every** fixe la fréquence de lecture des deux côtés : 150 ms, 300 ms (par défaut), 500 ms ou 1 s. Plus rapide paraît plus immédiat au bouton ; plus lent ménage un vieux poste à 4800 ou 9600 bauds, où chaque lecture prend un vrai temps sur la ligne.

---

## Modes

| Mode du poste | Le récepteur écoute en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (inversé) | CW-L |
| AM, AM synchrone, DSB | AM |
| FM, FM étroite | FM |
| FM large | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Modes données (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Données LSB, données FM | LSB, FM |

| Mode du récepteur | Le poste est mis en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — la plupart des postes HF le refusent et sont laissés tranquilles après deux essais |
| RADE (supérieur / inférieur) | USB / LSB |

Un poste en **mode données** y reste : l'USB du récepteur est considéré comme d'accord avec l'USB-D du poste, si bien que le récepteur ne fait jamais sortir le poste du mode données.

---

## Largeur de filtre

Cochez **Sync filter width** pour aligner les bandes passantes. Des écarts de moins de 60 Hz sont tenus pour égaux, puisque deux filtres n'ont jamais les mêmes pas.

| Liaison avec le poste | Largeur de filtre |
|---|---|
| Hamlib | Oui, là où Hamlib la prend en charge pour ce poste |
| flrig | Oui |
| Icom CI-V intégré | Oui — pas de 50 Hz jusqu'à 500 Hz, puis de 100 Hz jusqu'à 3,6 kHz ; AM par pas de 200 Hz jusqu'à 10 kHz ; pas en FM |
| Elecraft intégré | Oui, par pas de 10 Hz |
| Kenwood, Yaesu, famille FT-817 intégrés | Non — ces postes choisissent leurs filtres dans des tables propres à chaque modèle. Utilisez Hamlib si vous avez besoin du filtre |

Les récepteurs KiwiSDR, WebSDR et UberSDR ont toujours la commande. Un récepteur PhantomSDR-Plus doit avoir la **mise à jour de septembre 2026** ou ultérieure ; sur un plus ancien, la fréquence et le mode se synchronisent toujours, et la fenêtre Rig control explique pourquoi le filtre ne suit pas.

---

## Coupure du son en émission

Cochez **Mute receiver while transmitting**. Tant que le poste est en émission, la fenêtre du récepteur est muette, et le son revient au retour en réception. Le bouton muet du récepteur l'indique, et vous pouvez toujours rétablir le son à la main.

Si vous aviez déjà coupé le son vous-même, il reste coupé ensuite.

Il faut une liaison qui signale l'état d'émission — tous les pilotes intégrés, flrig, et Hamlib pour la plupart des postes — et, sur un récepteur PhantomSDR-Plus, la mise à jour de septembre 2026.

---

## Décalage de fréquence

**Frequency offset** est ajouté à la fréquence du poste pour obtenir celle du récepteur :

> fréquence du récepteur = fréquence du poste + décalage

| Installation | Décalage |
|---|---|
| Transverter 2 m sur un poste 10 m (144,100 MHz s'affiche 28,100 MHz) | `116000000` |
| Transverter 70 cm sur un poste 2 m (432 → 144) | `288000000` |
| Pas de transverter | `0` |

---

## Le menu Rig

| Élément | Rôle |
|---|---|
| **Rig control...** | Ouvre la fenêtre Rig control |
| **Connect / Disconnect** *nom du poste* | Démarre ou arrête la synchronisation ; avec Hamlib, démarre ou arrête aussi `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Sens de synchronisation |
| **Sync filter width** | Oui / non |
| **Mute receiver while transmitting** | Oui / non |
| Ligne d'état | *Not connected*, *Connecting...*, *Connected: nom*, ou la dernière erreur |

L'affichage de fréquence en direct se trouve dans la fenêtre Rig control et non dans le menu, qui sinon se refermerait à chaque changement.

---

## Linux

**Droits sur le port série.** Les ports série appartiennent au groupe `dialout`. Un utilisateur qui n'en fait pas partie obtient *Could not open ttyUSB0*. Ajoutez-vous une fois, puis déconnectez-vous et reconnectez-vous :

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Installez-le depuis votre distribution :

```bash
sudo apt install libhamlib-utils
```

Le paquet `.deb` de Desktop PhantomSDR+ le recommande, donc `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` l'installe avec ; `dpkg -i` n'installe pas les paquets recommandés. Les pilotes intégrés et flrig n'ont pas besoin de Hamlib.

## Windows

Le `rigctld.exe` de Hamlib lui-même est inclus dans l'installateur 64 bits comme dans le 32 bits. Les ports COM apparaissent dans la liste sous leur nom (`COM3`). Si le poste demande un pilote USB, installez d'abord celui du constructeur — le port n'existe pas avant.

---

## Pour les opérateurs de récepteurs

Rien à configurer. Le pilotage du transceiver passe par une petite interface JavaScript que chaque page PhantomSDR-Plus possède déjà ; il ne demande ni réglage serveur, ni port ouvert, ni droit d'administration. Les fonctions de filtre et de coupure du son sont arrivées avec la mise à jour de septembre 2026 de la 4.0.0 — après l'avoir appliquée, recompilez le frontend (`./recompile.sh`, option 2) ; inutile d'arrêter le récepteur. Les récepteurs KiwiSDR, WebSDR et UberSDR n'ont besoin de rien non plus : l'application utilise les commandes que leurs pages possèdent déjà.

---

## Pour les développeurs : l'interface de la page

Desktop PhantomSDR+ comme le CATsync Tool utilisent ces fonctions, que chaque page PhantomSDR-Plus place sur `window` une fois chargée (les pages KiwiSDR, WebSDR et UberSDR sont pilotées par leurs propres commandes, différentes) :

| Fonction | Renvoie / fait |
|---|---|
| `catsync_ready` | `true` dès que les fonctions ci-dessous sont installées |
| `catsync_getFrequency()` | Fréquence d'accord, Hz |
| `catsync_setFrequency(hz)` | S'accorde sur `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Règle le mode ; ramène la bande passante à la valeur par défaut du mode |
| `catsync_getBandwidth()` | Largeur totale de la bande passante, Hz |
| `catsync_setBandwidth(hz)` | Règle la largeur — s'élargit vers le haut en USB, vers le bas en LSB, également des deux côtés sinon. À appeler **après** `catsync_setMode` |
| `catsync_getMute()` | `true` si le son est coupé |
| `catsync_setMute(on)` | Coupe ou rétablit le son, via le bouton muet de la page |

Les quatre dernières sont arrivées avec la mise à jour de septembre 2026 ; testez donc avant de les appeler :

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Régler la fréquence réaccorde l'audio : n'appelez un setter que lorsque la valeur a réellement changé — un setter appelé en boucle avec la même valeur s'entend. Les anciens points d'entrée de style KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) restent disponibles pour les outils qui les attendent.

---

## Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Pas dans le groupe `dialout`, ou un autre programme tient le port | `sudo usermod -aG dialout $USER`, se déconnecter et se reconnecter ; fermer WSJT-X, carnets de trafic, utilitaires du poste |
| L'affichage du récepteur indique *not a receiver this app can drive* | Un autre type de récepteur web, ou la page est encore en chargement | Sont pris en charge PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR ; laisser quelques secondes à une page lente |
| *The rig did not answer* | Mauvaise vitesse, mauvais type de poste, mauvaise adresse CI-V, poste éteint | Aligner la vitesse sur le menu du poste ; vérifier l'adresse CI-V ; essayer Hamlib |
| *Hamlib is not installed* | Aucun `rigctld` trouvé | Linux : `sudo apt install libhamlib-utils`. Ou indiquer son chemin dans **rigctld program** |
| *rigctld stopped: ...* | Hamlib n'a pas pu ouvrir le poste — son propre message suit | Généralement le port ou la vitesse ; le texte après les deux-points est la raison donnée par Hamlib |
| *flrig is not running at ...* | flrig fermé, ou son port XML-RPC diffère | Lancer flrig ; vérifier le port dans sa configuration |
| Connecté, mais le récepteur ne bouge pas | Aucune fenêtre de station ouverte, ou **Receiver window** attaché à une station fermée | Ouvrir la station, ou choisir *The station window last in front* |
| Le poste passe en émission à la connexion | DTR ou RTS déclenche le poste via votre interface | Décocher **DTR on** et **RTS on** |
| Le filtre ne suit pas | Récepteur sans la mise à jour de septembre 2026, ou pilote intégré Kenwood/Yaesu | Fréquence et mode se synchronisent toujours ; utiliser Hamlib pour le filtre sur Kenwood/Yaesu |
| La coupure en émission ne fait rien | Récepteur sans la mise à jour, ou le poste ne signale pas l'état d'émission | Comme ci-dessus |
| *Lost the rig ... reconnecting* | Câble débranché, poste éteint ou rigctld arrêté | Rien — nouvel essai toutes les 3 secondes, puis reprise dès le retour du poste |
| Les deux côtés sautent sans arrêt | Deux programmes pilotent le poste en même temps | Ne laisser qu'un programme régler le poste, ou le partager via flrig |

---

## Limites connues

- Un poste, une fenêtre de récepteur à la fois.
- Les récepteurs autres que PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR — OpenWebRX, par exemple — ne sont pas pris en charge.
- Les pilotes intégrés suivent les protocoles publiés par les constructeurs et ont été testés contre des postes simulés et un vrai Hamlib ; pour un poste qui se comporte autrement, Hamlib est la solution de repli.
- Le split, le VFO B, le RIT/XIT et les canaux mémoire ne sont pas synchronisés — seulement la fréquence du VFO actif.
- Sous Linux, les paquets utilisent le Hamlib de la distribution ; aucun n'est embarqué.
