# PhantomSDR-Plus — Manuel d'utilisation des décodeurs

Ce guide couvre tous les décodeurs intégrés à PhantomSDR-Plus. Tous les décodeurs partagent la même procédure d'activation, décrite ci-dessous, suivie des instructions de configuration propres à chacun.

---

## Table des matières

1. [Comment démarrer un décodeur](#1-comment-démarrer-un-décodeur)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — code Morse](#5-cw--code-morse)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [FAX HF / WEFAX](#8-fax-hf--wefax)
9. [NAVTEX](#9-navtex)
10. [FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet et APRS](#10-fldigi--ale-2g-rtty-psk31-olivia-fst4w-mfsk-msk144-dominoex-thor-throb-hellschreiber-mt63-packet-et-aprs)
11. [SSTV](#11-sstv)
12. [SERVICES](#12-services)
13. [DRM](#13-drm)
14. [Conseils généraux](#14-conseils-généraux)

---

## 1. Comment démarrer un décodeur

Tous les décodeurs se trouvent dans la section **Decoder Options**, située sous les commandes du spectrogramme audio, sur le panneau principal.

**Étapes :**

1. Cliquez sur le bouton **Decoder: OFF** pour le faire passer à **Decoder: ON** (il devient bleu lorsqu'il est actif).
2. Ouvrez le menu déroulant qui apparaît à droite du bouton et sélectionnez le décodeur souhaité.
3. Le panneau du décodeur choisi apparaît sous les commandes — suivez les instructions propres à ce décodeur dans la section correspondante de ce guide.
4. Pour arrêter le décodage, sélectionnez **— Select decoder —** dans le menu déroulant, ou cliquez sur le bouton **Decoder: ON** pour le remettre sur OFF.

### Boutons de décodeur en une pression

Le menu déroulant n'est pas la seule voie. Le panneau principal comporte une rangée de boutons **Decoders** — juste sous **Wheel Tuning Steps** — avec un bouton par décodeur :

| Bouton | Décodeur | Bouton | Décodeur |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **FLDIGI** | ALE 2G HAM, RTTY, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (avions), FSK maritime / SITOR, RTTY météo, RTTY naval (PBB), DSC (navires), Time Signals (signaux horaires), HF Selcall, ALE 2G |
| **WSPR** | WSPR | **DRM** | DRM — radiodiffusion numérique |

Une pression effectue toute la séquence d'un coup : elle sélectionne le décodeur, met le décodeur sur ON et amène sa fenêtre à l'écran. Le bouton devient bleu tant que son décodeur tourne. **Appuyez de nouveau sur le même bouton pour arrêter le décodeur** — sa fenêtre se ferme avec lui.

Les boutons, le menu déroulant et le bouton ON/OFF pilotent le même état : quel que soit celui que vous utilisez, les autres suivent.

### Démarrer un décodeur depuis un marqueur de fréquence

Un marqueur de fréquence (les étiquettes jaunes au-dessus de la cascade, issues de `markers.json`) accorde normalement le récepteur et règle le mode qui y est inscrit. Lorsque ce mode est le nom d'un mode numérique, un clic sur le marqueur démarre à la place son décodeur, exactement comme si vous aviez appuyé sur son bouton :

| Mode du marqueur | Démarre | La fréquence du marqueur est |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | ce décodeur | la fréquence affichée |
| `NAVTEX` | NAVTEX | la fréquence du signal (l'affichage descend de 500 Hz) |
| `FAX`, `WEFAX` | HF FAX | le centre publié (l'affichage descend de 1900 Hz) |
| `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR` | FLDIGI en RTTY amateur (`RTTY`) ; SERVICES sur RTTY météo, RTTY naval (PBB CARB) ou FSK maritime / SITOR | la fréquence du signal (l'affichage descend du centre audio du panneau) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI dans cette variante | comme ci-dessus |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI dans cette variante et ce sous-mode | comme ci-dessus |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI dans cette variante et ce sous-mode | comme ci-dessus |
| `PACKET`, `APRS` | FLDIGI dans cette variante | le canal ; 300 Bd (USB) sous 30 MHz, 1200 Bd (FM) au-dessus |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 en bande latérale supérieure / inférieure (`RADE` et `FREEDV` signifient supérieure) | la fréquence du cadran |
| `RADE2` | FreeDV RADE V2 (beta), toujours bande latérale supérieure | la fréquence du cadran |
| `HFDL` | SERVICES · HFDL | la fréquence affichée (USB ; le signal HFDL est 1440 Hz au-dessus) |
| `DSC`, `SELCALL` | SERVICES sur DSC ou HF Selcall | la fréquence DSC ou le canal Selcall (le cadran va 1,7 kHz en dessous) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES sur Time Signals, avec cette station | la porteuse (le cadran va 1 kHz en dessous) |
| `ALE` | FLDIGI sur ALE 2G HAM sur un canal HFLINK, sinon SERVICES sur ALE 2G | la fréquence affichée (LSB pour les réseaux qui l'utilisent) |
| `DRM` | DRM | le centre du canal DRM |
| `MORSE` | le décodeur CW, en CW avec un filtre de ±250 Hz | la fréquence du signal |

> Un seul décodeur peut être actif à la fois. Passer à un autre décodeur arrête automatiquement le précédent.
>
> Le **grabber QRSS** ne fait pas partie de ce menu déroulant : il possède sa propre section **QRSS** et peut fonctionner en même temps qu'un décodeur.

**Un décodeur en marche impose le mode et la bande passante.** Normalement le mode suit le plan de bande de `bands-config.js` : amenez l'accord dans un segment marqué LSB ou AM et le récepteur bascule dessus. Tant qu'un décodeur tourne, cela n'a plus lieu. Le décodeur conserve le mode qu'il lui faut (USB pour la plupart, le sien pour RADE) et la bande passante qu'il lui faut — PSK31 environ ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber et MT63 toute leur largeur, RTTY son shift — et les deux survivent à un changement de fréquence, y compris un saut vers une autre bande. Sans cela, FT8 sur 40 m ferait passer le récepteur en LSB dès que l'accord bouge, et les bandes passantes étroites des décodeurs se rouvriraient au filtre SSB complet.

### Decoder ID — reconnaître le mode automatiquement

Au-dessus des boutons de décodeur se trouve le cadre **Decoder ID**. Il répond à la question *« qu'est-ce que j'écoute ? »* lorsque vous tombez sur un signal numérique que vous n'arrivez pas à identifier, puis vous propose le décodeur correspondant en un clic.

Il est **désactivé par défaut** et ne coûte rien tant qu'il est éteint. Appuyez sur **On** et laissez le signal accordé. Pendant environ une demi-minute il affiche *Listening…* avec une barre de progression — les mesures de temporisation doivent voir deux cycles FT8 complets avant d'avoir un sens — puis il nomme le mode :

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* Le **mode** et un indice de **confiance**. Vert au-dessus de 75 %, jaune au-dessus de 50 %, orange en dessous — une réponse orange est une piste, pas un verdict.
* **Ce qui a réellement été mesuré** : largeur de bande occupée, écart entre tons, rapidité de modulation, durée de la salve, la grille UTC à laquelle il correspond, rapport signal/bruit. Ce sont les éléments de preuve derrière le verdict, afin que vous puissiez juger par vous-même.
* **Use <mode>** démarre le bon décodeur, exactement comme si vous aviez appuyé sur son bouton — et règle le récepteur pour travailler ce mode. Pour les modes qui vivent dans le panneau FSK, il sélectionne en plus la bonne variante — RTTY, PSK31 ou Olivia dans FLDIGI, Weather RTTY dans SERVICES.
* Les candidats suivants figurent après **or**. Cliquez sur l'un d'eux pour l'essayer : une première réponse erronée ne vous coûte donc rien.
* **📻** signifie que la fréquence sur laquelle vous êtes accordé est une fréquence d'appel connue pour ce mode, et que cela a compté dans le classement.

Il ne change jamais votre décodeur de lui-même. Il ne fait que suggérer. Et dès que vous démarrez un décodeur — depuis la rangée de boutons, depuis la liste déroulante ou depuis le bouton **Use** de Decoder ID lui-même — Decoder ID s'éteint tout seul : son rôle était d'en choisir un, et le décodeur veut maintenant le même signal audio.

**Ce qu'il reconnaît :** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY à 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV et DSC. **Use DSC** et la proposition Weather RTTY démarrent SERVICES sur ce service (chapitre 12).

---

## 2. FT8

**De quoi s'agit-il :** FT8 est un mode numérique à signaux faibles très répandu chez les radioamateurs du monde entier. Les transmissions durent exactement 15 secondes et le protocole peut copier des signaux jusqu'à 20-25 dB sous le plancher de bruit. C'est le mode le plus utilisé pour les contacts à longue distance (DX).

### Fréquences recommandées (USB)

| Bande | Fréquence |
|-------|-----------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Configuration

1. Accordez-vous sur une fréquence FT8 listée ci-dessus et réglez le mode sur **USB**.
2. Activez le décodeur et sélectionnez **FT8** dans le menu déroulant. Ou appuyez simplement sur le bouton **FT8**.
3. Le panneau **FT8 Messages** apparaît automatiquement en dessous.

### Lecture des résultats

La liste des messages affiche les transmissions décodées à mesure qu'elles arrivent. Chaque cycle de 15 secondes produit un nouveau lot de messages. Le champ **Farthest** (en haut à droite du panneau) indique la plus grande distance décodée durant la session en cours, en kilomètres. Un message long se termine par « … » : cliquez sur sa ligne pour lire le message entier, sur plusieurs lignes, et cliquez à nouveau pour le refermer. Tant qu'une ligne est ouverte, la liste reste en place ; sinon elle suit les messages les plus récents. FT4 et FT2 utilisent la même liste.

Format de message typique : `CQ DX AA1BB FN31` — un appel CQ de l'indicatif AA1BB situé dans le carré locator FN31.

> **Astuce :** FT8 est étroitement synchronisé dans le temps. Votre navigateur utilise l'horloge de votre ordinateur ; si celle-ci dérive de plus de quelques secondes, le décodage échouera. Gardez l'heure système synchronisée sur NTP.

---

## 3. FT4-FT2

**De quoi s'agit-il :** FT4 est une variante plus rapide de FT8, conçue pour l'exploitation en concours. Chaque cycle de transmission dure 7,5 secondes (la moitié de FT8), ce qui le rend deux fois plus rapide mais exige un signal légèrement plus fort. FT2 est une variante encore plus rapide de FT8. C'est un mode ultrarapide à 77 bits avec des périodes T/R de 3,75 secondes (= la moitié de FT4) — encore expérimental.

### Fréquences recommandées (USB)

| Bande | Fréquence FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Bande | Fréquence FT2|
|-------|-----------|
|160 m | 1.843 à 1.846 |
|80 m   | 3.578 à 3.581 |
|60 m   | 5.360 (vérifiez la réglementation régionale locale) |
|40 m   | 7.052 à 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Configuration

1. Accordez-vous sur une fréquence FT4 et réglez le mode sur **USB**.
2. Activez le décodeur et sélectionnez **FT4** ou **FT2** dans le menu déroulant. Ou appuyez simplement sur le bouton **FT4** / **FT2**.
3. Le panneau **FT4 Messages** ou **FT2 Messages** apparaît en dessous, avec la même disposition que le panneau FT8.

> **Remarque :** FT4 et FT8 utilisent des formats spectraux différents et ne sont pas interchangeables. Assurez-vous d'être sur une fréquence FT4 lorsque vous utilisez ce décodeur.

---

## 4. JS8

**De quoi il s'agit :** JS8 (le mode utilisé par JS8Call) reprend le moteur signal faible de FT8 et en fait un mode de conversation au clavier. Là où FT8 envoie des échanges figés de 13 caractères, JS8 transmet du texte libre par petits morceaux et recolle les émissions successives en phrases complètes — tout ce qui dépasse une douzaine de caractères arrive donc sur plusieurs cycles de 15 secondes. Sa sensibilité est proche de celle de FT8, ce qui le rend utilisable là où la phonie et la CW ne passent plus.

### Fréquences recommandées (USB)

| Bande | Fréquence |
|-------|-----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Vitesses

JS8 propose cinq vitesses. Toutes les stations d'une conversation doivent utiliser la même. **Normal** est la vitesse d'appel et concentre la quasi-totalité du trafic — commencez par elle.

| Vitesse | Cycle | Largeur | Usage |
|---------|-------|---------|-------|
| Slow   | 30 s | 25 Hz  | Trajets très faibles ; la plus sensible |
| Normal | 15 s | 50 Hz  | La vitesse d'appel habituelle |
| Fast   | 10 s | 80 Hz  | Échanges plus rapides, demande plus de signal |
| Turbo  | 6 s  | 160 Hz | Signaux locaux forts |
| Ultra  | 4 s  | 250 Hz | Expérimentale, rarement rencontrée |

### Mise en route

1. Accordez-vous sur une fréquence JS8 et passez en **USB**.
2. Activez le décodeur et choisissez **JS8** dans la liste, ou appuyez simplement sur le bouton **JS8**.
3. Le panneau **JS8 Decoder** apparaît en dessous. Laissez **Speed** sur *Normal*, sauf si vous savez que la station visée en utilise une autre.

### Lire le résultat

Le panneau comporte deux listes.

**Les messages en cours d'arrivée** s'affichent en haut, en vert, avec un curseur clignotant. Un message JS8 peut demander quatre cycles — une minute entière en Normal — c'est donc là que l'on voit la phrase se construire. Rien d'anormal s'il y reste un moment.

**Les messages terminés** remplissent la liste principale, une ligne chacun :

| Colonne | Signification |
|---------|---------------|
| Mode | Toujours `JS8` |
| Hz | Fréquence audio du signal dans la bande passante |
| dB | Rapport signal/bruit dans une largeur de référence de 2500 Hz |
| Message | Le texte décodé ; **les indicatifs sont affichés en vert** |

Messages typiques :

* `SV1BTL KM17: HB` — un heartbeat : la station signale qu'elle est à l'écoute, avec son locator.
* `KN4CRD: K0OG SNR -05` — un message dirigé : KN4CRD indique à K0OG qu'il le reçoit à −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — texte libre, ici une description de station arrivée en quatre cycles.

Une ligne **grisée et en italique** a expiré avant l'arrivée de sa dernière trame. Le texte est authentique, mais peut être tronqué.

### Sync offset

Le curseur **Sync offset** règle le délai après la limite du cycle UTC avant le début de la capture, ce qui compense le retard de la chaîne audio. Laissez **Auto** coché : le décodeur mesure la synchronisation des signaux reçus et s'ajuste tout seul.

### Repères de spectre

> **Astuce :** JS8 est bien plus calme que FT8. Un après-midi, une émission toutes les quelques minutes est normale, tout comme de longues périodes sans rien. Laissez-lui cinq à dix minutes avant de conclure à un problème. 20m (14.078) et 40m (7.078) sont les endroits habituels.

---

## 5. CW — code Morse

**De quoi s'agit-il :** le décodeur CW écoute les signaux en code Morse (onde entretenue) et les convertit en texte en temps réel. Il suit automatiquement la fréquence du signal et s'adapte à la vitesse de manipulation de l'opérateur.

### Fréquences recommandées

La CW est active sur toutes les bandes amateurs, généralement dans la partie basse de chaque bande. Endroits courants :

| Bande | Segment |
|-------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Configuration

1. Accordez-vous sur un signal CW. Démarrer le décodeur met le récepteur en **CW** (CW-L reste CW-L) ; un clic sur **CW** dans le sélecteur de modes démarre aussi le décodeur.
2. Activez le décodeur et sélectionnez **CW** dans le menu déroulant. Ou appuyez simplement sur le bouton **CW**.
3. Le panneau **CW Decoder** apparaît en dessous.

### Lecture des résultats

- L'en-tête du panneau indique la fréquence détectée du signal en Hz (p. ex. `≈ 700 Hz`) et la vitesse de manipulation estimée en mots par minute (p. ex. `· 22 WPM`).
- Si aucun signal n'est détecté, l'en-tête affiche **scanning…**
- Sur un canal vide rien ne s'affiche, et ni la vitesse ni la tonalité ne sont indiquées. Le décodeur ne commence à écrire que lorsqu'il existe une nette différence entre manipulateur appuyé et relâché, ce que le bruit seul ne produit pas, alors qu'un signal encore lisible vers −10 dB en a largement.
- Le texte décodé défile en caractères ambrés à chasse fixe. Le curseur clignotant (▋) marque l'endroit où le texte s'écrit actuellement.
- Le curseur **Pitch** avant **Clear** règle la tonalité audio du signal CW pendant que le décodeur tourne : de 500 à 800 Hz par pas de 50 Hz, 600 Hz tant que vous ne le changez pas. Votre navigateur retient le choix. L'écoute CW normale est aussi à 600 Hz.
- **Save** enregistre le texte décodé dans un fichier ; **Clear** l'efface.

> **Astuces :**
> - Centrez votre bande passante sur la tonalité CW. Le décodeur fonctionne au mieux lorsque le signal CW se situe entre environ 400 et 900 Hz dans le spectre audio.
> - Les vitesses d'environ 8 à 40 mots/min sont lues, y compris la manipulation Farnsworth (caractères envoyés vite avec des pauses plus longues entre eux) : le verrouillage de vitesse tient et les lettres ne sont pas coupées en mots séparés. Un Morse très manuel (irrégulier) peut encore réduire la précision.
> - Le décodeur donne ses meilleurs résultats sur un signal unique et propre. Un QRM fort provenant de signaux voisins sur la même bande peut le perturber.
> - Le fading (QSB) est suivi : un signal qui s'évanouit et revient continue d'être lu, et le premier mot d'une émission est lu aussi — de même au début d'une réponse après une pause dans le QSO.
> - Chaque lettre est décidée sur le signal lui-même plutôt que sur les points et traits comptés d'abord, ce qui divise à peu près par deux les lettres fausses sur les signaux faibles et manipulés à la main.

### CW Browser — tous les signaux à la fois

Activez l'interrupteur **Browser — all signals** dans la fenêtre CW pour décoder à la fois tous les signaux CW entre 200 et 3000 Hz, une ligne par signal, comme les navigateurs PSK et Olivia. Pendant qu'il tourne, le récepteur est maintenu en **USB** avec un filtre de 200–3000 Hz ; votre mode et votre filtre reviennent quand vous l'éteignez.

---

## 6. QRSS Grabber

**De quoi il s'agit :** le QRSS est de la CW émise si lentement qu'un point dure des secondes au lieu de millisecondes. À cette vitesse le signal n'occupe qu'une fraction de hertz, si bien qu'une analyse suffisamment étroite fait ressortir la trace depuis 20 à 30 dB *sous* le plancher de bruit. Il n'y a rien à lire à l'oreille : le QRSS **se regarde**, il ne s'écoute pas. Le grabber calcule sa propre FFT très longue sur l'audio du récepteur et trace l'affichage classique des grabbers : fréquence sur l'axe vertical, temps défilant de gauche à droite, la colonne la plus récente toujours au bord droit.

L'essentiel de ce que vous verrez provient de balises MEPT (Manned Experimental Propagation Transmitter) — des émetteurs de très faible puissance, souvent quelques centaines de milliwatts dans un fil, qui s'identifient en permanence en morse très lent ou par motifs FSK.

### Où chercher

Les balises QRSS occupent des fenêtres étroites de 100 à 200 Hz près du bas de chaque bande. Inutile de les retenir : le grabber propose une liste **Band** des fenêtres ci-dessous, et en choisir une accorde le récepteur dessus et le prépare pour ce mode (voir *Ouvrir le grabber*).

| Bande | Centre de la fenêtre | Remarque |
|------|---------------|------|
| 30m | 10 140,00 kHz | La fenêtre QRSS principale — de loin la plus fréquentée, de jour comme de nuit |
| 40m | 7 039,90 kHz |  |
| 40m | 7 000,85 kHz | Fenêtre Knights, 7 000,8–7 000,9 kHz |
| 20m | 14 096,90 kHz |  |
| 80m | 3 569,90 kHz |  |
| 80m | 3 568,60 kHz | Ancienne fenêtre |
| 80m | 3 500,85 kHz | Fenêtre Knights, 3 500,8–3 500,9 kHz |
| 160m | 1 837,90 kHz |  |
| 160m | 1 843,30 kHz | Ancienne fenêtre |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | QRSS / DFCW en LF |
| 60m | 5 288,55 kHz |  |
| 17m | 18 105,90 kHz |  |
| 15m | 21 095,90 kHz |  |
| 12m | 24 925,90 kHz |  |
| 10m | 28 125,70 kHz |  |
| 10m | 28 000,85 kHz | Ancienne fenêtre |
| 10m | 28 322,00 kHz | Variante |
| 6m | 50 294,30 kHz |  |

### Ouvrir le grabber

Le grabber QRSS ne figure **pas** dans le menu des décodeurs. Il dispose de sa propre section **QRSS**, à côté des commandes du spectrogramme et des décodeurs.

1. Cliquez sur **🐌 Show**. Le canevas du grabber apparaît et ses commandes se déploient à côté du bouton.
2. Choisissez une fenêtre dans la liste **Band** et appuyez sur **Tune**. Cela fait d'un coup tout ce que le mode réclame : accord sur la fenêtre, passage du récepteur en **CW** et bande passante juste assez large pour la tranche observée. L'affichage indique alors la véritable fréquence QRSS, et les traces tombent sur la ligne centrale de l'écran.
3. Réglez **Speed** sur la durée du point de la balise.
4. **Centre** et **Span** agissent comme avant ; modifier l'un ou l'autre remodèle la bande passante, si bien que l'affichage et le récepteur restent accordés entre eux.
5. Cliquez sur **🐌 Hide** pour arrêter. Le mode normal de la bande revient.

### Vitesses

| Réglage | Durée du point | Résolution | Fenêtre d'analyse | Nouvelle colonne toutes les |
|---------|----------------|------------|-------------------|------------------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

### Commandes

| Commande | Effet |
|----------|-------|
| **Band** | Les fenêtres QRSS du tableau ci-dessus. **Tune** accorde sur celle choisie, en CW avec une bande passante adaptée. |
| **Speed** | Fixe la longueur de la transformée, c'est-à-dire le compromis entre résolution en fréquence et en temps (tableau ci-dessus). |
| **Centre** | Fréquence audio au milieu de l'affichage, 100–3000 Hz. |
| **Span** | Hauteur de la tranche affichée : 20, 50, 100 ou 200 Hz, 100 Hz au démarrage — la largeur d'une sous-bande QRSS. Une tranche plus étroite étale chaque trace sur davantage de pixels. Les tranches larges font entrer dans le panneau plus de bins qu'il n'a de lignes de pixels ; chaque ligne affiche alors le bin le plus fort qu'elle couvre, si bien que rien ne peut se cacher entre les lignes. |
| **Gain** | De −10 à +40 dB. Décale la palette par rapport au plancher de bruit mesuré ; augmentez-le pour éclaircir les traces faibles. |
| **Color** | Rainbow, Green ou Grayscale. |
| **Clear** | Efface le canevas et réinitialise la référence de bruit. |

### Lire l'affichage

Les graduations de fréquence courent le long du bord gauche, la fréquence la plus haute en haut. Sous le canevas, une ligne d'état indique la vitesse choisie, la résolution réellement utilisée (par ex. `0.183 Hz/bin · 5.5 s window`) et la cadence de colonnes (par ex. `2.7 s/column`).

Ce que signifient les formes :

- Une **porteuse stable** trace une ligne horizontale droite.
- Le **morse lent** trace cette ligne comme une suite de segments courts et longs — points et traits qui se lisent de gauche à droite.
- Les **traces courbes ou dérivantes** viennent d'un oscillateur de balise non stabilisé qui chauffe ou refroidit. C'est normal, et c'est souvent cette signature de dérive qui permet à un observateur régulier de reconnaître une station.
- Les **stries verticales** traversant toute la tranche sont des parasites atmosphériques ou du bruit local, pas du signal.

> **Conseils :**
> - Soyez patient. En QRSS 30 une seule colonne prend 5,5 secondes : un indicatif complet peut demander dix minutes ou plus pour traverser l'écran. Laissez tourner.
> - Accorder depuis la liste **Band** resserre déjà la bande passante autour de la fenêtre. Si vous avez accordé à la main, faites-le vous-même : cela ne change rien à ce que la transformée résout, mais empêche des voisins puissants d'agir sur l'AGC du récepteur.
> - Le grabber est indépendant des décodeurs : vous pouvez le laisser tourner pendant qu'un décodeur travaille sur autre chose.
> - Un span large à vitesse lente est la combinaison la plus lourde ; toute la transformée s'exécute dans le navigateur, alors préférez un span de 50 Hz sur une machine modeste.

---

## 7. WSPR

**De quoi s'agit-il :** WSPR (Weak Signal Propagation Reporter, prononcé « whisper ») est un mode balise à signaux ultra-faibles qui cartographie les chemins de propagation HF dans le monde entier. Chaque transmission dure environ 110 secondes et tient dans un créneau de 200 Hz de large. Le décodeur attend un créneau complet de 2 minutes aligné sur l'UTC avant de décoder.

### Fréquences recommandées (USB, affichée)

| Bande | Fréquence affichée |
|-------|---------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Configuration

1. Accordez-vous sur une fréquence affichée WSPR ci-dessus et réglez le mode sur **USB**.
2. Le signal WSPR occupe la plage audio 1400-1600 Hz. Sélectionner **WSPR** fait le reste pour vous : le récepteur bascule en USB et la bande passante se resserre sur 1350-1650 Hz, ce qui couvre toute la plage explorée par le décodeur. Aucun autre ajustement n'est nécessaire.
3. Activez le décodeur et sélectionnez **WSPR** dans le menu déroulant. Ou appuyez simplement sur le bouton **WSPR**.
4. Le panneau **WSPR-2 Decoder** apparaît en dessous.

### Lecture des résultats

Le panneau affiche une barre de progression pour le créneau de 2 minutes en cours :

- **Barre cyan qui se remplit** — collecte des données du signal (de 0 à 116 s dans le créneau).
- **Barre ambrée qui pulse** — décodage en cours (les ~4 dernières secondes du créneau).
- **Barre vide** — attente de la prochaine minute UTC paire.

Chaque spot décodé avec succès est affiché dans un tableau avec les colonnes suivantes :

| Colonne | Signification |
|---------|---------------|
| UTC | Heure du spot (minute paire) |
| Callsign | La station qui a émis |
| Grid | Locator Maidenhead de l'émetteur |
| Power | Puissance émise en dBm |
| Freq | Fréquence audio exacte (Hz) dans la bande passante WSPR |
| SNR | Rapport signal/bruit en dB |

Cliquez sur **Clear** pour effacer la liste des spots.

> **Astuce :** le décodage WSPR exige une heure système très précise (à ±1 seconde de l'UTC). Le premier créneau après l'activation du décodeur commencera à la prochaine minute UTC paire — une courte attente est normale.

---

## 8. FAX HF / WEFAX

**De quoi s'agit-il :** le radiofax HF (également appelé WEFAX) est utilisé par les garde-côtes et les services météorologiques du monde entier pour diffuser des cartes météo, des cartes d'état de la mer et des analyses de surface en ondes courtes. Le décodeur reconstitue l'image ligne par ligne au fur et à mesure de sa réception.

### Configuration

1. Activez le décodeur et sélectionnez **HF FAX / WEFAX** dans le menu déroulant. Ou appuyez simplement sur le bouton **FAX**.
2. Le panneau **HF FAX / WEFAX Receiver** apparaît en dessous.
3. **Sélectionnez une station** dans la liste déroulante Station. Plus de 20 stations sont disponibles, couvrant l'Europe, l'Asie, l'Océanie et les Amériques (p. ex. DDH3/DDK3 Allemagne, SVJ4/GR Grèce, JMH Japon, NMG États-Unis La Nouvelle-Orléans). CBM Punta Arenas (Chili) en fait aussi partie. Les horaires suivent le programme mondial de radiofax de la NOAA (édition du 7 mars 2025) ; Charleville (VMC, Australie) inclut ses émissions supplémentaires sur 11030 kHz uniquement.
4. Si la station émet sur plusieurs fréquences, sélectionnez la fréquence souhaitée dans le sous-menu **Frequency**.
5. Cliquez sur **▶ Tune** pour accorder automatiquement la cascade sur cette station.
6. Le mode est automatiquement forcé sur **USB**.

### Horaires de diffusion

Lorsqu'une station est sélectionnée, un tableau de compte à rebours **Next Transmissions** apparaît, indiquant les 4 prochaines diffusions programmées en UTC, avec un décompte en direct :

- Normal (gris/vert) — la transmission est à venir.
- **Ambre ⚡** — la transmission commence dans moins de 3 minutes ; armez le décodeur maintenant.
- **Rouge ●** — la transmission commence dans moins de 30 secondes ; la réception est imminente.

### Paramètres

La plupart des stations utilisent les valeurs par défaut standard (marquées ★). Ne les modifiez que si vous savez que la station emploie des réglages non standard.

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| LPM | 120 ★ | Lignes par minute — la vitesse de rotation du tambour |
| IOC | 576 ★ | Indice de coopération — détermine le nombre de pixels par ligne |
| Shift | 800 Hz ★ | Écart de fréquence entre les tonalités noir et blanc |

### Commandes

- **⇔ Auto-align** — activé par défaut. Se synchronise automatiquement sur le signal de phasage au début de chaque image. Ne le désactivez que si vous rencontrez des problèmes d'alignement sur un signal connu comme bon.
- **⇅ Invert** — inverse le noir et le blanc. À utiliser si l'image apparaît en négatif (zones blanches là où le noir devrait être).
- **↺ Refresh** — efface le canevas et réinitialise le décodeur. À utiliser entre deux transmissions ou si l'image se déchire ou dérive.
- **⤓ Save PNG** — enregistre le canevas actuel sous forme de fichier PNG sur votre ordinateur.

### Indicateurs d'état

En bas de l'image, deux indicateurs de tonalité montrent :

- **300 Hz phasing** — s'allume en cyan lorsque la tonalité de phasage de début d'image est détectée.
- **450 Hz stop** — s'allume en rouge lorsque la tonalité d'arrêt de fin d'image est détectée.

> **Remarque :** l'image défile vers le haut — la ligne reçue la plus récente apparaît toujours en bas du canevas. Si vous voyez **[PHASING]** dans l'en-tête, le décodeur s'est verrouillé sur un nouveau début d'image.

---

## 9. NAVTEX

**De quoi s'agit-il :** NAVTEX est le système international de diffusion maritime des informations de sécurité côtière — avertissements de navigation, prévisions météorologiques et avis de recherche et de sauvetage. Il utilise le FSK à 100 bauds (SITOR-B avec FEC) et est reçu sur des canaux dédiés dans le monde entier.

### Canaux disponibles

| Canal | Fréquence | Usage |
|-------|-----------|-------|
| International | 518 kHz | En anglais, international |
| National | 490 kHz | Diffusions en langue nationale |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | NAVTEX HF longue portée |

### Configuration

1. Activez le décodeur et sélectionnez **NAVTEX** dans le menu déroulant. Ou appuyez simplement sur le bouton **NAVTEX**. Le récepteur passe automatiquement en **USB**.
2. Le panneau **NAVTEX Receiver** apparaît.
3. Sélectionnez le canal souhaité dans la liste **Station** (p. ex. `International — 518 kHz`).
4. Cliquez sur **⇒ Tune & Set IF** pour accorder automatiquement la cascade et resserrer la bande passante sur la bonne fenêtre audio. Le mode est réglé automatiquement sur **USB**. La fréquence affichée est placée 500 Hz sous le centre du canal, de sorte que le signal NAVTEX apparaît à 500 Hz en audio. L'affichage de fréquence indique pourtant **518.000** : tant que HF FAX, NAVTEX ou la fenêtre FLDIGI est actif, il montre la fréquence du signal lui-même (celle du cadran plus le centre audio du décodeur — 1900 Hz pour le FAX, 500 Hz pour NAVTEX, le centre du panneau pour FLDIGI), et une fréquence tapée alors est prise comme celle du signal.

### Horaires de diffusion

Le tableau des horaires liste toutes les stations connues sur le canal sélectionné avec :

- leur lettre d'identification UIT et le drapeau du pays
- l'heure de la prochaine diffusion en UTC
- un décompte en direct jusqu'à la prochaine transmission
- **Ambre ⚡** à moins de 2 minutes / **Rouge ●** à moins de 30 secondes — armez le décodeur maintenant

### Lecture des résultats

Le texte décodé apparaît en caractères sarcelle à chasse fixe. Les limites des messages sont clairement marquées :

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marque le début d'un message. Les quatre caractères qui suivent identifient la station (`M`), le sujet (`A` = avertissements de navigation) et le numéro d'ordre (`12`). La bannière attend l'en-tête complet, elle affiche donc `ZCZC MA12` et non `ZCZC ????`. `NNNN` marque la fin.

Cliquez sur **Clear** pour effacer la mémoire tampon des messages.

> **Remarque :** NAVTEX fonctionne sur des fréquences MF et LF (518/490 kHz). La portée de réception est généralement de 200 à 400 milles marins depuis l'émetteur. Les canaux HF (4-17 MHz) offrent une portée bien supérieure.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet et APRS

**De quoi s'agit-il :** une fenêtre pour les modes clavier à bande étroite que le logiciel fldigi a popularisés, avec quatorze variantes accessibles depuis un seul menu. Une seule est du véritable FSK (Frequency-Shift Keying) : le RTTY amateur ; ses cousins des services, le FSK maritime (SITOR) et le RTTY météo, utilisent le même décodeur dans SERVICES (chapitre 12). Les autres partagent la même fenêtre : **PSK31** (ainsi que **PSK63** et **PSK125**, en BPSK ou QPSK), une modulation par déplacement de phase ; **Olivia** (avec son proche parent **Contestia**) et **MFSK16/32/64**, des modes multitons avec correction d'erreurs ; **DominoEX** et **THOR**, à sauts de fréquence incrémentaux (THOR avec correction d'erreurs) ; **THROB**, deux tonalités à la fois, un caractère par impulsion ; **Hellschreiber**, qui peint le texte comme une image au lieu de le décoder ; **MT63**, 64 porteuses à la fois ; ainsi que **Packet (AX.25)** et **APRS**, qui décodent le packet radio en AFSK — le packet à 1200 bauds des VHF/UHF et le packet à 300 bauds des HF. Chaque variante est fournie avec un préréglage adapté à ses paramètres standard. Le bouton et l'entrée du menu s'appellent tous deux **FLDIGI** ; le décodage se fait ici, dans le navigateur, et fldigi lui-même n'est pas nécessaire.

Trois des variantes ne viennent pas de fldigi. **ALE 2G HAM** est l'établissement automatique de liaison (MIL-STD-188-141) du réseau radioamateur HFLINK, et liste ses appels et ses soundings ; les réseaux gouvernementaux, militaires et utilitaires sont dans SERVICES → ALE 2G (chapitre 12). **FST4W**, le mode de balises très lent des bandes 2200 m, 630 m et 160 m, et **MSK144**, pour le meteor scatter sur 6 m et 2 m, viennent de WSJT-X. Aucune des trois n'affiche de texte continu : chacune liste ce qu'elle décode ligne par ligne, avec l'heure.

### Variantes et préréglages

| Variante | Centre | Shift | Bauds | Trame | Codage |
|----------|--------|-------|-------|-------|--------|
| RTTY amateur | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31·63·125 (BPSK/QPSK) | 1000 Hz | — | 31.25 / 62.5 / 125 | — | Varicode |
| Olivia / Contestia | 1000 Hz | — | voir Mode | — | 7 bits + FEC |
| FST4W | 1500 Hz | — | 1,46 / 0,56 / 0,18 / 0,09 | T/R 120–1800 s | LDPC + CRC-24 |
| MFSK16·32·64 | 1500 Hz | — | voir Mode | — | Varicode + FEC |
| MSK144 | 1500 Hz | — | 2000 bit/s | T/R 15 / 30 s | LDPC + CRC-13 |
| DominoEX | 1500 Hz | — | voir Mode | — | Varicode par quartets |
| THOR | 1500 Hz | — | voir Mode | — | Varicode + FEC |
| THROB / THROBX | 1500 Hz | — | 1, 2 ou 4 | — | paires de tonalités |
| Hellschreiber | 1500 Hz | — | voir Mode | — | image |
| MT63 | 1000 Hz (porteuse la plus basse à 500 Hz) | — | 5, 10 ou 20 | — | Walsh + entrelacement |
| ALE 2G | 1625 Hz (tonalités 750–2500 Hz) | — | 125 | mots de 24 bits, ×3 | Golay (24,12) |
| Packet (AX.25) | tonalités 1200 / 2200 Hz, ou 1700 Hz à 300 Bd | 1000 Hz, ou 200 Hz à 300 Bd | 1200 ou 300 | HDLC | AX.25 |
| APRS | comme Packet | comme Packet | 1200 ou 300 | HDLC | AX.25 + APRS |

### Réglage

1. Activez le décodeur et sélectionnez **FLDIGI** dans le menu. Ou appuyez simplement sur le bouton **FLDIGI**.
2. Le panneau du décodeur apparaît. Son titre suit la variante — *FSK / RTTY Decoder*, *BPSK31 Decoder* (ou le mode PSK choisi), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* ou *APRS Decoder*. ALE 2G HAM affiche *ALE 2G HAM Decoder* ; FST4W indique sa période, par ex. *FST4W-120 Decoder* ; MSK144 affiche *MSK144 Decoder*.
3. Sélectionnez la **Variant**. Les paramètres se mettent à jour automatiquement.
4. Pour PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber et MT63, réglez **Mode** pour qu'il corresponde à l'émission — voir les notes de chaque mode ci-dessous. Pour Packet et APRS, réglez **Speed** — voir les notes sur Packet et APRS ci-dessous. Pour ALE 2G, choisissez un réseau et un canal ; pour FST4W et MSK144, réglez **T/R period** et **F Tol** — voir leurs notes plus bas.
5. Lorsque la variante en a une, utilisez la liste **Known frequency** pour choisir une fréquence courante, puis cliquez sur **Tune** pour y aller. Les autres modes n'ont pas de fréquences d'appel fixes : cherchez le signal dans la cascade et utilisez **⟳ Auto-tune Center**.
6. Affinez l'accord jusqu'à ce que le texte décodé devienne stable et lisible.

### Fréquences connues par variante

**RTTY amateur**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3583 kHz (80 m), 7040 kHz (40 m), 7072,5 kHz (40 m), 10143 kHz (30 m), 14072,5 kHz (20 m), 14108,5 kHz (20 m, 32/1000), 18099 kHz (17 m), 21072,5 kHz (15 m), 24922,5 kHz (12 m), 28122,5 kHz (10 m)

**FST4W** (le centre du signal ; le cadran USB va 1,5 kHz en dessous)
- 137,5 kHz (2200 m, cadran 136,000), 475,7 kHz (630 m, cadran 474,200), 1838,1 kHz (160 m, sous-bande WSPR, cadran 1836,600)

**MSK144** (de même : le cadran va 1,5 kHz en dessous)
- cadran 144,360 MHz (2 m, Région 1 de l'IARU), 144,150 MHz (2 m, Amérique du Nord), 50,260 et 50,280 MHz (6 m), 70,230 MHz (4 m), 28,145 MHz (10 m)

**MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63**
- Pas de fréquences d'appel fixes ; la liste n'est pas affichée. Cherchez le signal dans la cascade.

**Packet et APRS** (la même liste pour les deux ; chaque entrée règle aussi la bonne vitesse)
- 144,800 MHz — APRS en Europe (Région 1 de l'IARU)
- 144,390 MHz — APRS en Amérique du Nord
- 145,175 MHz — APRS en Australie
- 144,640 MHz — APRS en Chine
- 144,660 MHz — APRS au Japon
- 145,825 MHz — le digipeater packet de l'ISS
- 10147,6 kHz — APRS HF sur 30 m, fréquence affichée en USB (300 Bd)

### Paramètres

| Paramètre | S'applique à | Description |
|-----------|--------------|-------------|
| Center audio (Hz) | toutes | La fréquence audio du milieu entre mark et space ; pour PSK31 la porteuse, pour les modes multitons le centre du bloc de tonalités ou du groupe de porteuses. Un menu déroulant pour les variantes FSK, un champ libre pour toutes les autres. Pour Packet et APRS un champ libre à 300 Bd seulement ; à 1200 Bd les tonalités sont fixes, 1200 / 2200 Hz, et le champ ne fait que les afficher |
| Shift (Hz) | FSK seulement | Écart de fréquence entre les tonalités mark et space |
| Baud | FSK seulement | Débit de symboles |
| Framing | FSK seulement | Bits de données, parité, bits d'arrêt (par ex. 7N1 = 7 données, sans parité, 1 arrêt) |
| Encoding | FSK seulement | Jeu de caractères (CCIR-476, ITA2/Baudot ou ASCII) |
| Invert mark / space | FSK seulement | Permute les tonalités mark et space |
| Auto shift detect | FSK seulement | Tente de mesurer automatiquement le shift à partir du signal reçu |
| Mode | PSK31 seulement | BPSK31/63/125, QPSK31/63/125 — doit correspondre à l'émission |
| Mode (tonalités / Hz) | Olivia, Contestia seulement | Nombre de tonalités et largeur de bande — doit correspondre exactement à l'émission |
| Squelch (FEC S/N) | Olivia, Contestia seulement | Force que doit atteindre la correction d'erreurs avant que du texte soit affiché |
| Browser — all signals | PSK31, Olivia, Contestia | Un interrupteur : décode à la fois tous les signaux du **Mode** choisi (PSK31 : tous les signaux BPSK31) entre 300 et 2700 Hz, une ligne par signal — voir les notes sur PSK Browser et Olivia |
| Mode | MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63 | Le sous-mode (vitesse, largeur, entrelacement) — doit correspondre à l'émission |
| Squelch (FEC metric) | MFSK | La qualité de décodage (0–100) que le signal doit atteindre avant que le texte ne s'affiche ; 22 par défaut |
| T/R period | FST4W, MSK144 | FST4W : 120, 300, 900 ou 1800 s — doit correspondre à l'émission. MSK144 : 15 ou 30 s ; un message répété dans une même période n'est listé qu'une fois |
| F Tol | FST4W, MSK144 | Jusqu'où le décodeur cherche de part et d'autre de **Center audio** : ±50, 100 ou 150 Hz pour FST4W, de ±50 à ±300 Hz pour MSK144 |
| Decode | MSK144 | **Fast**, **Normal** ou **Deep** — le soin avec lequel chaque bloc est exploré ; Deep trouve le plus et utilise le plus de CPU |
| Squelch (tone / noise) | DominoEX, THOR | 0–100 : la tonalité actuelle face au plancher des autres cases de tonalité ; 25 par défaut |
| Squelch (S/N) | THROB | En dB ; 4 par défaut |
| Squelch (FEC S/N) | MT63 | La correspondance du code de Walsh ; 4 par défaut |
| Reverse | FSK Hell 245 / 105, Hell 80 | Peint l'autre tonalité comme encre |
| Speed | Packet et APRS | **1200 Bd · VHF/UHF (FM)** ou **300 Bd · HF (USB)**. Choisit aussi le mode du récepteur |
| Show raw packet | APRS seulement | Affiche en plus le paquet tel qu'il a été reçu (format TNC2) au-dessus de chaque ligne décodée |
| Squelch (SNR) | RTTY amateur, météo et naval | Empêche le bruit de s'afficher en lettres aléatoires. Démarre à −5 dB pour le RTTY amateur et à −7 dB pour le RTTY météo et naval ; tout à gauche (**off**) il est désactivé. Le chiffre de SNR passe au gris tant que le squelch est fermé |

### Commandes supplémentaires

- **⇒ Set IF Band-Pass** — resserre la bande passante du récepteur autour du signal. La largeur suit la variante : 300 Hz pour le RTTY amateur (assez étroit pour éliminer une station plus forte à 250 Hz tout en lisant un signal décalé de 40 Hz), 594 Hz pour le RTTY météo, mark/space plus une marge pour le FSK maritime, environ ±100 Hz pour PSK31 (±200 Hz PSK63, ±400 Hz PSK125) et toute la largeur du bloc de tonalités plus une marge pour Olivia. La bande passante suit le décodeur quand **Auto-tune** ou **Auto shift detect** déplace les tonalités, et quand vous changez le réglage **Baud**. Pour le packet à 300 Bd, environ ±400 Hz ; pour le packet à 1200 Bd, le canal FM normal. MFSK, DominoEX, THOR, THROB, Hellschreiber et MT63 reçoivent toute leur largeur plus une marge (au moins 60 Hz de chaque côté, 15 % de la largeur pour les modes larges). ALE 2G reçoit 500–2750 Hz (en miroir sous le cadran pour un réseau LSB), FST4W sa plage **F Tol** plus 150 Hz de chaque côté, MSK144 ±1,1 kHz plus **F Tol**.
- **⟳ Auto-tune Center** — recherche automatique du signal. Pour les variantes FSK elle cherche une paire équilibrée de tonalités, pour PSK31 elle trouve la porteuse, et pour Olivia le bloc le plus fort de la largeur de bande sélectionnée. **Auto shift detect** ne change le shift que lorsqu'un vrai signal à deux tonalités est présent, il ne saute donc plus sur le bruit. Pour le packet à 300 Bd, elle trouve la paire de tonalités la plus forte espacées de 200 Hz. Pour le packet à 1200 Bd le bouton est masqué, car les tonalités y sont fixes. MFSK, DominoEX, THOR, THROB, Hellschreiber et MT63 sont cherchés comme Olivia, sur leur propre largeur. Pour ALE 2G, FST4W et MSK144 le bouton est masqué.

### Notes sur ALE 2G

L'ALE (MIL-STD-188-141, deuxième génération) est la façon dont les réseaux HF gouvernementaux, militaires, humanitaires et radioamateurs trouvent une fréquence de travail : les stations balaient une série de canaux, envoient de courts *soundings* pour signaler leur présence et s'appellent par quelques secondes d'un signal à 8 tonalités (125 Bd, 750–2500 Hz).

1. Choisissez **ALE 2G HAM**, l'entrée juste avant Packet dans **Variant**. À la place des réglages habituels, le panneau affiche une liste de **réseaux** et une liste de **canaux**.
2. Choisissez un réseau et l'un de ses canaux, puis cliquez sur **⇒ Tune & Set IF**. La fréquence de la liste est celle du cadran ; le récepteur passe en USB, ou en LSB pour les quelques réseaux marqués ainsi, avec un filtre de 500–2750 Hz.
3. Patientez. Les soundings arrivent toutes les demi-heures ou toutes les heures, et les appels seulement quand une liaison est nécessaire : un canal peut rester silencieux longtemps.

### Notes sur PSK31

- Le décodeur corrige lui-même son erreur d'accord sur environ **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125), il suffit donc de s'approcher. **Carrier**, dans la ligne de mesures, indique où il s'est réellement stabilisé.
- **IMD** mesure la qualité de l'émetteur, pas la réception : un signal propre affiche environ −20 dB ou mieux. Une mauvaise valeur signifie que la station d'en face surmodule, non que vous êtes mal accordé.
- Le texte apparaît caractère par caractère sans correction d'erreurs ; un signal faible se dégrade donc en lettres fausses occasionnelles plutôt que de s'interrompre.
- **PSK63 et PSK125** sont le même mode, deux et quatre fois plus rapide et d'autant plus large ; **QPSK31/63/125** ajoutent une correction d'erreurs (décodeur de Viterbi), qui répare de courtes rafales de bruit à niveau de signal à peu près égal. Choisissez le sous-mode dans **Mode** — un mauvais choix n'affiche rien. L'essentiel de l'activité PSK reste en BPSK31 ; le PSK63 est courant en concours.
- **PSK Browser (BPSK31).** L'interrupteur **Browser — all signals** sous **Mode** décode à la fois tous les signaux BPSK31 entre 300 et 2700 Hz, comme le navigateur de signaux de fldigi : une ligne par signal (jusqu'à 16), avec sa fréquence, sa qualité d'accrochage et le texte le plus récent. Les signaux sont trouvés seuls en quelques secondes, et celui qui reste muet 30 s est retiré. Cliquez sur une ligne pour ne décoder que ce signal, en BPSK31 ordinaire sur sa porteuse. Pendant qu'il tourne, **Mode** affiche BPSK31 et reste verrouillé ; une fois éteint, la fenêtre revient au Mode d'avant. Pendant la navigation, la bande passante s'ouvre à 200–2800 Hz. Chaque ligne garde ses 4000 derniers caractères dans un cadre d'environ six lignes de haut, avec sa propre barre de défilement au-delà de six lignes (la molette marche aussi) ; le cadre reste immobile pendant que vous lisez. **Save Text** enregistre toutes les lignes, y compris celles déjà retirées. Pendant qu'un navigateur tourne, les réglages du décodeur unique (Center audio, ⟳ Auto-tune Center et ses mesures) sont masqués.

### Notes sur Olivia

- **Le réglage Mode doit correspondre exactement à l'émission.** Une combinaison tonalités/largeur de bande erronée ne décode absolument rien — pas du texte brouillé, mais le silence. Le panneau s'ouvre sur **8 / 250**, la configuration étroite laissée en veille sur les fréquences d'appel ; **16 / 500** et **32 / 1000** sont les deux autres d'usage courant, et **16 / 1000** est également proposé.
- **Contestia** est un Olivia avec un bloc de correction d'erreurs plus petit : environ deux fois plus rapide, en majuscules seulement, et un peu moins robuste. Ses configurations sont dans la même liste **Mode**, sous *Contestia* (8 / 250 est la plus courante, 4 / 125 et 4 / 250 pour les liaisons faibles) ; le titre du panneau devient *Contestia Decoder*. Un réglage Olivia ne décode jamais du Contestia, et inversement.
- **Olivia Browser.** Activez l'interrupteur **Browser — all signals** sous **Mode** pour décoder à la fois tous les signaux Olivia (ou Contestia) de cette configuration entre 300 et 2700 Hz, une ligne par signal, comme PSK Browser ; un clic sur une ligne ne décode plus que ce signal. Il travaille avec une configuration à la fois : sur **8 / 250**, il ne voit pas les stations 16 / 500. Comme Olivia s'emploie sous le bruit, il ne cherche pas les signaux d'après leur force : la bande passante est couverte par une douzaine de décodeurs côte à côte (environ 5 % d'un cœur), si bien qu'une station apparaît dès que ses premiers caractères sont décodés, quelques secondes après son début. Dans une même largeur de bande, seule la copie la plus forte est affichée, et une ligne n'apparaît qu'une fois qu'elle contient quelques caractères de vrai texte.
- Olivia n'envoie pas de préambule, le décodeur doit donc chercher la synchronisation. **Comptez quelques secondes** après l'accord avant que du texte apparaisse. Le champ **Sync** affiche `SEARCH` jusqu'au verrouillage.
- La correction d'erreurs travaille par blocs : le texte arrive **par rafales plutôt qu'en flux continu**, avec un retard de plusieurs blocs entre l'émission et l'affichage.
- **Squelch (FEC S/N)** définit le degré de confiance que doit atteindre la correction d'erreurs avant d'afficher. La valeur par défaut de 4,0 tient le bruit à l'écart ; 3,0 est le plancher, en dessous duquel le bruit aléatoire commence à imprimer des caractères isolés. Un bon signal affiche 8–9 sur l'indicateur **FEC**, il reste donc une large marge pour relever le squelch sur une bande encombrée.
- Quand une émission se termine, le texte s'arrête simplement. Chaque bloc est aussi vérifié isolément, si bien que les quelques blocs que le squelch laisse encore passer le temps de se refermer n'affichent plus une rafale de caractères aléatoires.

### Notes sur FST4W

- **Il décode une fois par période, à la fin de celle-ci.** Les périodes commencent selon l'horloge UTC — FST4W-120 à chaque minute paire, FST4W-1800 à l'heure pile et à la demie — et la barre **Period** montre la part de la période en cours déjà enregistrée. Une période prise en cours de route est sautée, car un demi-message ne se décode pas ; la suivante est enregistrée en entier. Décoder une période de 30 minutes prend quelques secondes.
- **Choisissez la bonne période T/R.** Le décodeur ne regarde que celle que vous choisissez. La plupart des balises LF/MF utilisent FST4W-120 ; FST4W-300, -900 et -1800 servent aux liaisons les plus faibles.
- **F Tol** fixe jusqu'où la recherche s'étend de part et d'autre de **Center audio** (1500 Hz). La valeur par défaut de WSJT-X, ±100 Hz, couvre les sous-bandes des balises ; ±150 Hz est le maximum que permet la bande passante.
- Chaque ligne affiche UTC, SNR (dB), DT (le décalage temporel, s), la fréquence (MHz) et le message, comme dans WSJT-X, et **Save Text** les enregistre au même format.
- L'horloge de l'ordinateur doit être juste à une seconde près environ, comme pour WSPR.

### Notes sur MFSK16 / MFSK32 / MFSK64

- **Choisissez la variante MFSK16·32·64**, puis la vitesse dans sa liste **Mode**. Les trois modes ne diffèrent que par la vitesse, et le réglage doit correspondre : le mauvais n'affiche rien de lisible.
- **Accord :** placez le bloc de tons sur la fréquence **Center audio**, ou appuyez sur **⟳ Auto-tune Center**. Le décodeur corrige seul le dernier quart de ton — environ ±4 Hz en MFSK16, ±8 Hz en MFSK32 et ±16 Hz en MFSK64 — et **Centre** indique où il s'est calé. Un signal plus éloigné est trouvé par le décodeur lui-même, jusqu'à environ ±75 Hz du centre réglé : comptez quelques secondes au début d'une émission.
- Le texte suit le signal avec quelques secondes de retard, le temps nécessaire à l'entrelacement et à la correction d'erreurs. Un ou deux caractères parasites tout au début d'une émission sont normaux ; fldigi les affiche aussi.
- **Squelch (FEC metric)** retient l'affichage jusqu'à ce que la qualité de décodage atteigne le réglage. La valeur par défaut de 22 écarte le bruit (le bruit seul atteint environ 20) ; un bon signal affiche 90 % ou plus sur l'indicateur **FEC**, et 0 désactive le squelch. Lorsqu'une émission se termine par la marque de fin d'émission de fldigi, l'affichage s'arrête aussitôt au lieu de laisser passer quelques secondes de bruit.
- Les transmissions d'images MFSK ne sont pas décodées.

### Notes sur MSK144

- **Attendez-vous à de longs silences.** Sur une bande calme, rien n'apparaît pendant des minutes. Pendant les grands essaims (Quadrantides, Perséides, Géminides) et tôt le matin, les pings sont bien plus nombreux.
- Chaque ligne affiche UTC (à la seconde), SNR (dB), T (à quel moment de sa période le ping est arrivé, s), la fréquence (MHz) et le message. Un message entendu de nouveau dans la même période T/R n'est listé qu'une fois, sauf si la nouvelle copie est plus forte. Les copies faibles d'un même message sont moyennées, comme dans WSJT-X.
- **F Tol** fixe jusqu'où le décodeur cherche de part et d'autre de 1500 Hz ; les stations sont rarement pile sur la fréquence, ±100 Hz est donc un bon début. **Decode** fixe l'effort consacré à chaque bloc, et **Deep** trouve le plus. **CPU** dans la ligne de mesures indique la charge : au-delà de 100 % le décodeur prend du retard, choisissez donc **Normal** ou **Fast** sur un ordinateur lent.
- Les messages courts de 40 bits (Sh) ne sont pas décodés : ils exigent les indicatifs des deux stations, qu'un auditeur ne connaît pas.

### Notes sur DominoEX et THOR

- **Mode** doit correspondre à la vitesse émise. DominoEX propose Micro, 4, 5, 8, 11, 16, 22, 44 et 88 ; THOR propose Micro, 4, 5, 8, 11, 16, 22 et les rapides 25 x4, 50 x1, 50 x2 et 100 (ces quatre-là utilisent un code plus fort et un entrelaceur d'une seconde). DominoEX 11 et THOR 16 sont les plus entendus.
- **Accord :** placez le bloc de tonalités sur **Center audio**, ou appuyez sur **⟳ Auto-tune Center**. Un désaccord d'un quart de la largeur du signal se lit encore.
- **Squelch (tone / noise)** compare la tonalité reçue au plancher de toutes les autres cases de tonalité, sur une échelle de 0 à 100. Le bruit seul reste à 20 ou moins ; une réception lisible affiche 35 et plus ; la valeur par défaut est 25. Ce n'est pas le chiffre de fldigi lui-même : celui-ci affiche 26 sur certains signaux parfaitement propres, si bien que toute valeur par défaut utile les aurait coupés. Quand une émission se termine, l'affichage s'arrête en quelques symboles au lieu de laisser passer le bruit.
- Le récepteur suit les réglages par défaut de fldigi : trois chemins espacés d'un tiers de case FFT, décisions dures pour DominoEX, décisions souples et détection du préambule pour THOR. La correction d'erreurs MultiPSK facultative de DominoEX (désactivée par défaut dans fldigi) n'est pas décodée, pas plus que le canal de texte secondaire (le texte balise de la station pendant les pauses) ni le mode image de THOR.

### Notes sur THROB

- **L'accord est critique.** Les tonalités de THROB 1 et 2 ne sont espacées que de 8 Hz : le décodeur capture ±3 Hz de désaccord (±6 Hz pour THROB 4) et corrige le reste par son propre suivi de fréquence. Appuyez d'abord sur **⟳ Auto-tune Center** : il trouve le signal à un ou deux hertz près.
- **Mode** doit correspondre, THROB ou THROBX et la vitesse.
- **Squelch (S/N)** — le bruit seul reste sous 1 dB, un signal lisible affiche 10 dB et plus ; la valeur par défaut est 4 dB.

### Notes sur MT63

- **Mode :** MT63-500, -1000 ou -2000 (la largeur), chacun avec entrelacement **short** ou **long**. Les deux doivent correspondre. Le plus utilisé est MT63-1000 long.
- **Accord :** fldigi émet la porteuse la plus basse à 500 Hz ; le centre est donc 500 Hz plus la moitié de la largeur : 750, 1000 ou 1500 Hz, réglé automatiquement quand vous choisissez le Mode. Le décodeur retrouve seul jusqu'à 8 porteuses d'écart (±125 Hz pour MT63-1000).
- **Le texte arrive en retard** sur le signal à cause de l'entrelaceur : d'environ 1,6 s (MT63-2000 short) à 12,8 s (MT63-500 long). Les derniers caractères d'une émission arrivent après l'arrêt du signal.
- **Squelch (FEC S/N)** — le bruit seul affiche environ 3, un signal accroché 4,5 et plus ; la valeur par défaut est 4. Le squelch masque le moment dont le synchroniseur a besoin pour s'accrocher au début.

### Notes sur Packet et APRS

> **Note sur le mode :** le décodeur prend le contrôle du mode de démodulation et de la bande passante FI tant qu'il est actif. Les deux sont rétablis automatiquement à sa désactivation. Toutes les variantes utilisent l'**USB**, sauf Packet et APRS à 1200 Bd, qui utilisent la **FM**.
>
> **Note sur la polarité (variantes FSK uniquement) :** pour le RTTY météo et le RTTY naval (PBB), il faut généralement cocher **Invert mark / space**. Pour le FSK maritime (type SITOR/NAVTEX) et le RTTY amateur, laissez la case décochée — le RTTY amateur émet le mark sur la radiofréquence la plus haute, et l'USB le conserve comme la tonalité audio la plus haute, ce qui correspond précisément au cas décoché. Si le texte décodé est brouillé, la première chose à essayer est de basculer cette case. Elle est masquée pour toutes les variantes sauf les quatre FSK : les autres n'ont pas de paire mark/space, et le décodage packet ne dépend pas de quelle tonalité est laquelle.
>
> **Note sur lettres/chiffres (variantes FSK uniquement) :** le code Baudot gère les lettres et les chiffres dans deux états distincts, et le bruit peut faire basculer le décodeur dans le mauvais — ce qui brouille tous les caractères suivants, pas seulement celui qui a été altéré. Le décodeur revient donc aux lettres à chaque espace ; c'est la pratique courante et cela répare un basculement corrompu en un ou deux mots au lieu d'une ligne entière. En contrepartie, les groupes de chiffres séparés par des espaces exigent que l'émetteur répète le passage aux chiffres après chaque espace, ce que font normalement les émetteurs.

---

## 11. SSTV

**De quoi s'agit-il :** la télévision à balayage lent transmet des images fixes sur un canal phonie SSB ordinaire, une ligne à la fois, sous forme d'une tonalité modulée en fréquence entre 1500 Hz (noir) et 2300 Hz (blanc). Une image complète prend entre 36 secondes et 4 minutes 30 selon le mode.

### Fréquences recommandées (USB)

| Bande | Fréquence | Mode | Remarques |
|-------|-----------|------|-----------|
| 20 m | 14.230 MHz | USB | La principale fréquence d'appel SSTV internationale — de loin la plus active |
| 20 m | 14.233 MHz | USB | Secondaire, utilisée quand 14.230 est occupée |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Active pendant les ouvertures de bande |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Régionale, en soirée |

**La bande latérale est choisie pour vous.** Le démarrage du décodeur sélectionne la **LSB en dessous de 10 MHz** et l'**USB au-dessus**, selon l'usage amateur habituel. Sur la mauvaise bande latérale, la correspondance des tonalités est inversée et l'image ne sera pas décodée. Si vous rencontrez une station qui ignore la convention, changez simplement la bande latérale à la main — le décodeur reste actif, efface l'image et repart à zéro avec le nouveau réglage.

### Configuration

1. Activez le décodeur et sélectionnez **SSTV** dans le menu déroulant. Ou appuyez simplement sur le bouton **SSTV**. Le récepteur change automatiquement de bande latérale — USB au-dessus de 10 MHz, LSB en dessous.
2. Accordez-vous de sorte que les tonalités de l'image tombent au milieu de la bande passante. Un signal correctement accordé a ses impulsions de synchronisation à 1200 Hz et le contenu de l'image entre 1500 et 2300 Hz.
3. Laissez **Mode** sur **Auto**, sauf si vous savez déjà ce qui est transmis. L'image se construit ligne par ligne au fur et à mesure de la réception.

### Modes

| Réglage | Image | Durée |
|---------|-------|-------|
| **Auto** | Détecté automatiquement | — |
| Martin M1 / M2 | 320×256 couleur | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 couleur | 110 s / 71 s |
| Scottie DX | 320×256 couleur | 269 s |
| Robot 36 / 72 | 320×240 couleur | 36 s / 72 s |

### Lecture des résultats

La ligne d'état sous les commandes indique ce que fait le décodeur :

| État | Signification |
|------|---------------|
| `Waiting for VIS / AUTO lock` | À l'écoute ; rien d'identifié pour l'instant |
| `Martin M1? verifying sync…` | Un candidat a été trouvé et est confirmé sur les lignes suivantes |
| `Martin M1 lock (VIS)` | Verrouillé d'après l'en-tête VIS |
| `Martin M1 lock (AUTO)` | Verrouillé d'après la synchronisation |
| `Martin M1 lock (MANUAL)` | Démarré par le bouton **⏺ Force** |
| `Candidate rejected (no sync)` | Le candidat n'a pas été confirmé — normal sur du bruit |
| `— sync lost, resetting` | Le signal a disparu en cours d'image |
| `Frame complete` | L'image complète a été reçue |

Le mode détecté apparaît aussi en vert à côté du titre **SSTV**, et le compteur de lignes indique la progression.

### Commandes

| Bouton | Action |
|--------|--------|
| **▶ Start** | Arme le décodeur. Il ne dessine pas d'image de lui-même — un verrouillage doit encore provenir de l'en-tête VIS ou de la détection de synchronisation. |
| **■ Stop** | Arrête le décodage. |
| **↺ Reset** | Efface le canevas et réarme sur place. À utiliser entre deux images ou après un réaccord. |
| **⏺ Force** | Commence à dessiner **immédiatement** dans le mode sélectionné dans la liste, en sautant entièrement le VIS et la détection de synchronisation. Disponible uniquement quand Mode n'est pas sur **Auto**. |
| **💾 Save** | Enregistre l'image actuelle au format PNG. |

**Quand utiliser Force.** Si vous voyez une image dans la cascade mais que le décodeur ne parvient pas à s'y verrouiller — mode inhabituel, signal trop faible ou trop déformé pour les détecteurs, ou en-tête manqué — sélectionnez le mode à la main et appuyez sur **⏺ Force**. L'image est calée au moment du clic, et le badge de mode affiche `MANUAL` pour que vous puissiez la distinguer d'un verrouillage VIS ou AUTO. Le décodeur se recale tout de même sur une véritable impulsion de synchronisation s'il en trouve une : un clic légèrement en avance ou en retard est donc corrigé.

---

## 12. SERVICES

**SERVICES** (le bouton s'appelait auparavant **HFDL**) est une fenêtre pour les services utilitaires. La liste **Service**, en haut à gauche de la fenêtre, choisit ce qui est décodé : **HFDL** (avions), **Maritime FSK / SITOR**, **Weather RTTY**, **Naval RTTY (PBB CARB)**, **DSC** (navires), **Time Signals** (signaux horaires), **HF Selcall** et **ALE 2G (MIL-STD-188-141)**. Votre navigateur retient ce choix. Un seul service fonctionne à la fois ; chacun règle le mode et le filtre dont il a besoin, a sa propre liste de fréquences avec **⇒ Tune & Set IF** et décode dans votre navigateur, sans rien coûter au récepteur. Chaque service a **💾 Save** (un fichier texte) et **Clear**, et la fenêtre Users montre quel service utilise chaque auditeur. Les canaux ALE radioamateurs sont dans la fenêtre FLDIGI, sous le nom ALE 2G HAM (chapitre 10).

### HFDL — messages d'avions

Le HFDL (HF Data Link) transporte les messages que les avions au-dessus des océans et des régions isolées échangent en ondes courtes avec des stations au sol : rapports de position, textes ACARS, connexions et données de fréquences. Le décodeur est dumphfdl (Tomasz Lemiech, GPL-3) compilé en WebAssembly. Il tourne dans votre navigateur sur l'audio USB et ne coûte donc rien au récepteur.

#### Mise en route

1. Appuyez sur **SERVICES** et choisissez **HFDL** dans la liste **Service**. Le récepteur passe en USB avec un filtre de 150–2750 Hz.
2. Choisissez une **station au sol** et l'une de ses fréquences, puis cliquez sur **⇒ Tune & Set IF**. La fréquence de la liste est la fréquence affichée en USB ; le signal HFDL est 1440 Hz au-dessus.
3. Patientez. Les stations au sol envoient un squitter toutes les 32 s et les avions répondent quand ils ont du trafic. Le décodeur trouve seul la cadence exacte de l'audio (±1 %) et un écart de fréquence (±240 Hz), puis se verrouille sur la première trame décodée.

#### Fréquences

La liste comprend toutes les stations au sol HFDL. De jour, on entend bien depuis l'Europe 17967 kHz (Al Muharraq, Bahreïn) et 21955 kHz (Canaries) ; le soir et la nuit, les fréquences plus basses de Shannon, Reykjavik et des Canaries prennent le relais. Les marqueurs de fréquence HFDL lancent le décodeur quand on clique dessus.

#### Lire la sortie

Chaque ligne indique l'heure (UTC), la fréquence, le sens (▼ sol→air ou ▲ air→sol), la station au sol, l'avion — immatriculation, vol et adresse OACI 24 bits, chacun un lien vers FlightAware —, le type de message, son SNR et son débit, et 📍 une position quand le message en contient une. Le texte ACARS s'affiche dessous. Survolez une ligne pour voir la trame complète. Cochez **Squitters** pour voir aussi les annonces des stations au sol.

**🗺 Map** montre dans le panneau les avions qui ont transmis une position ; **⤢ Large map** ouvre la même carte dans une fenêtre déplaçable et redimensionnable. Chaque avion est orienté selon sa route et laisse une trace rouge. **💾 Save** enregistre les messages dans un fichier texte, **Clear** vide la liste.

### FSK maritime / SITOR, RTTY météo et RTTY naval

Ces trois émissions de service utilisent le décodeur et le panneau FSK de la fenêtre FLDIGI (chapitre 10), avec la liste **Service** à la place de la liste **Variant** de FLDIGI. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space**, **Auto shift detect**, **⇒ Set IF Band-Pass** et **⟳ Auto-tune Center** fonctionnent comme décrit là-bas.

| Service | Centre | Shift | Bauds | Trame | Codage |
|----------|--------|-------|-------|-------|--------|
| FSK maritime / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| RTTY météo | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| RTTY naval (PBB CARB) | 1000 Hz | 850 Hz | 75 | 5N1.5 | ITA2 |

1. Choisissez **Maritime FSK / SITOR**, **Weather RTTY** ou **Naval RTTY (PBB CARB)** dans la liste **Service**.
2. Choisissez une **Known frequency** et cliquez sur **Tune**. La fréquence de la liste est celle du signal ; l'affichage USB descend du centre du panneau.
3. Affinez l'accord jusqu'à ce que le texte soit stable. Le RTTY météo demande **Invert mark / space** coché (le préréglage s'en charge) et a un curseur **Squelch (SNR)** qui démarre à −7 dB ; le FSK maritime le laisse décoché. Le RTTY naval fonctionne de la même façon (également inversé, squelch à partir de −7 dB).

**FSK maritime / SITOR :** 2174,5 kHz (NBDP MF, canal de travail), 518 et 490 kHz (NAVTEX), 4209,5 kHz (NAVTEX HF), et les canaux SITOR HF d'informations de sécurité maritime 4210, 6314, 8416,5, 12579, 16806,5, 19680,5, 22376 et 26100,5 kHz. NAVTEX a aussi son propre bouton, avec les horaires des stations (chapitre 9).

**RTTY météo :** les émetteurs du DWD (service météorologique allemand) 4583, 7646 et 10100,8 kHz (programme 1, en anglais) et 11039, 14467,3 et 147,3 kHz (programme 2, en allemand ; 147,3 kHz utilise un shift de 85 Hz, que son entrée de liste règle). Tant qu'une fréquence du DWD est choisie, **NEXT BROADCASTS** affiche les prochaines émissions.

**RTTY naval (PBB CARB) :** la Channel Availability / Receipt Broadcast de PBB, la Marine royale néerlandaise à Den Helder, sur 2474, 4250, 4280, 5052, 5214, 5659, 5694,5, 6356, 6358,5, 8439, 9264, 9368, 12840,5, 16318, 17116,7, 17947, 18308 et 20098 kHz. Elle indique aux navires sur quels canaux la station côtière écoute et accuse réception des messages ; ce que les navires émettent est chiffré. Si le texte est brouillé, décochez d'abord **Invert mark / space**.

### DSC — Digital Selective Calling

Le DSC est le système d'appel numérique du SMDSM (GMDSS) : navires et stations côtières s'appellent, testent leur équipement et envoient des alertes de détresse, d'urgence et de sécurité sur des canaux MF/HF fixes. Un appel dure quelques secondes (100 Bd, deux tonalités espacées de 170 Hz).

1. Choisissez **DSC** dans la liste **Service**, puis une fréquence. Les canaux **distress & safety** (2187,5, 4207,5, 6312, 8414,5, 12577 et 16804,5 kHz) sont veillés par toutes les stations côtières et sont les plus actifs ; les canaux d'appel côte→navire et navire→côte suivent dans la liste.
2. Cliquez sur **⇒ Tune & Set IF**. Le cadran va 1,7 kHz sous la fréquence DSC, en USB, avec un filtre de 1400–2000 Hz.
3. Patientez. Les stations côtières répondent et font des essais plusieurs fois par heure ; le jour, 8414,5 et 12577 kHz sont en général les plus actifs, la nuit 2187,5, 4207,5 et 6312 kHz.

Chaque appel affiche l'heure, la fréquence, sa catégorie en couleur (**DISTRESS** rouge, **URGENCY** orange, **SAFETY** jaune, **ROUTINE** bleu), le format et ses champs : qui appelle qui (un MMSI avec son pays, ou une station côtière), les commandes, la fréquence de travail et, pour une alerte de détresse, sa nature, la position (📍, un lien vers une carte) et l'heure. ✓ signifie que le caractère de contrôle concorde ; *✓ (1 rebuilt)* signifie qu'un caractère perdu dans les deux copies a été reconstruit grâce à lui. **Offset** montre l'erreur d'accord et **S/N** le rapport signal/bruit.

### Signaux horaires (Time Signals)

Décode la date et l'heure envoyées par les stations horaires en ondes longues et en ondes courtes, et montre avec quel retard le top de la minute a atteint votre page.

1. Choisissez **Time Signals** dans la liste **Service**, la station et sa fréquence, puis cliquez sur **⇒ Tune & Set IF**. Le cadran va 1 kHz sous la porteuse, en USB, avec un filtre de 700–1300 Hz.
2. Patientez. Une minute entière doit arriver propre avant que l'heure puisse être affichée : une à deux minutes sur un bon signal. Les secondes remplissent une rangée de 60 cases à mesure qu'elles arrivent.

- **DCF77** (Allemagne, 77,5 kHz) et **MSF** (Angleterre, 60 kHz) sont lus d'après la manipulation tout ou rien de la porteuse : date, heure et heure d'été.
- **WWV / WWVH** (États-Unis, 2,5 à 25 MHz) sont lus d'après la sous-porteuse à 100 Hz : date, heure et DUT1.
- **RWM** (Russie, 4996, 9996 et 14996 kHz) n'envoie pas de date : seulement le top de la minute et DUT1, il ne donne donc que le calage.
- CHU (Canada) a fermé le 22 juin 2026 et n'est pas proposé.

### HF Selcall

Le Selcall (CCIR 493-4) est l'appel sélectif des réseaux HF mobiles terrestres et maritimes — Codan, Barrett et d'autres : une salve d'une ou deux secondes qui appelle une radio, ou un groupe, par son numéro. Il utilise le même signal et les mêmes caractères que le DSC.

1. Choisissez **HF Selcall** dans la liste **Service**, un canal (les canaux 7 et 8 MHz de la liste de KiwiSDR) et cliquez sur **⇒ Tune & Set IF**. Le canal est le centre du FSK ; le cadran va 1,7 kHz en dessous, en USB.
2. Chaque appel affiche les numéros de la station appelante et de la station appelée (4 ou 6 chiffres), le type d'appel et les éventuelles commandes et données ; une position GPS Codan est affichée sous forme de chiffres bruts. Les stations diffèrent sur la tonalité qu'elles envoient comme mark, aussi les deux polarités sont-elles lues.

### ALE 2G (MIL-STD-188-141)

Les soundings, appels et messages des réseaux HF gouvernementaux, militaires et utilitaires : 51 réseaux de la liste ALE de KiwiSDR, regroupés en **Government**, **Military** (dont MARS) et **Utility**. C'est le même décodeur et le même panneau que ALE 2G HAM dans la fenêtre FLDIGI, qui ne liste que les canaux radioamateurs HFLINK — voir les notes ALE 2G au chapitre 10.

1. Choisissez **ALE 2G (MIL-STD-188-141)** dans la liste **Service**, un réseau et l'un de ses canaux, puis cliquez sur **⇒ Tune & Set IF**. La fréquence de la liste est celle affichée ; le récepteur passe en USB, ou en LSB pour les réseaux ainsi marqués, avec un filtre de 500–2750 Hz.
2. Patientez. Les soundings arrivent toutes les demi-heures ou toutes les heures, les appels seulement quand une liaison est nécessaire.

Ce sont des listes publiques, qui peuvent être périmées. La fenêtre Users affiche *ALE* pour un auditeur qui l'utilise.

---

## 13. DRM

Le DRM (Digital Radio Mondiale) est la radiodiffusion numérique en ondes courtes et moyennes. Contrairement aux autres décodeurs, il est décodé sur le serveur de la station : quand vous appuyez sur **DRM**, le serveur lance pour vous un décodeur — ubersdr-drm, le décodeur Dream sans interface graphique qu'utilise UberSDR — sur tout le canal DRM de 10 kHz, et vous envoie l'audio décodé et son état. Il fonctionne donc dans tous les navigateurs, xHE-AAC compris. Une station fait tourner au plus cinq décodeurs DRM à la fois, un par auditeur.

### Mise en route

1. Appuyez sur **DRM** (ou choisissez-le dans le menu déroulant). Sous la fréquence s'affiche **DRM**, et la bande passante couvre tout le canal de 10 kHz.
2. Choisissez une émission dans le sélecteur et cliquez sur **⇒ Tune**, ou accordez vous-même la fréquence sur le centre d'un canal DRM — le décodeur suit l'accord.
3. Surveillez les voyants : dès que **Audio** passe au vert, le son sort.

Tant que le DRM est actif, le seul son est du DRM décodé. L'audio propre du récepteur est coupé : sans signal DRM, vous n'entendez rien. Sur un signal faible ou affecté de fading, une trame endommagée s'éteint dans une courte réverbération puis le silence au lieu d'une rafale de bruit, et le décodeur se resynchronise seul dès que le signal revient ; chaque trame reçoit aussi une seconde passe de correction d'erreurs.

### Le sélecteur de stations

Le sélecteur affiche la grille du DRM Reception Project (drmrx.org), que le serveur actualise toutes les heures : fréquence, station, heures UTC, les jours quand ce n'est pas quotidien, la zone visée, ✓ quand des auditeurs l'ont confirmée à l'antenne, et HFCC quand le diffuseur l'a déclarée à la HFCC. Les groupes sont **Beamed at this station (locator) — on air now**, **On air now — beamed elsewhere, nearest first**, **Later (next 24 h)** et **Medium wave**. **Confirmed only**, activé par défaut, masque les entrées que personne n'a confirmées. L'ordre suit le locator de la station (`grid_locator` dans la section `[websdr]` de la configuration) : une émission compte comme dirigée vers la station quand sa zone visée arrive à environ 1000 km d'elle ; quand la zone est inconnue ("Various"), c'est le pays de l'émetteur qui compte. Sans locator, les émissions à l'antenne sont listées dans un seul groupe. Les émissions dirigées au loin sont souvent faibles ou absentes. **heard here** signale une émission que ce récepteur a décodée au cours des 30 derniers jours — le décodeur note chaque service qu'il décode, jamais qui écoutait — et **Confirmed only** les garde aussi ; une émission qu'aucune grille ne mentionne, comme une émission d'essai, a son propre groupe en tête, **Heard on this receiver — on air now, in no schedule**, sur les demi-heures où elle a été entendue.

### Lire le panneau

| Élément | Signification |
|---|---|
| **Signal, Time, Frame, FAC, SDC, Audio** | Les voyants de synchronisation : vert OK, orange erreur de données, rouge erreur CRC, gris absent. Le son sort quand **Audio** est vert. |
| **WMER** | La valeur qui prédit le décodage : à partir d'environ 10 dB, l'audio se décode. |
| **MER, SNR** | Taux d'erreur de modulation et rapport signal/bruit, en dB. |
| **Mode, BW, QAM, Prot** | Mode de robustesse (A–E), largeur du canal, constellation MSC et niveaux de protection. |
| **Codec** | AAC, AAC+SBR ou xHE-AAC, tel que la station le signale. |

Dessous apparaissent le nom, le pays, la langue et le mode audio de la station, ainsi que son message texte. « No decoder on the server for … » signifie que cette station ne peut pas décoder ce codec.

**Pour les sysops.** Le décodeur est compilé par `./setup-drm.sh` (les installateurs le lancent ; `update.sh` le propose) et l'assistant `autorun/drm-helper.js` démarre et s'arrête avec le récepteur ; `DRM_ENABLED=0` devant le script de démarrage le désactive. Voir le manuel d'installation. Après une mise à jour, relancez `./setup-drm.sh` : il corrige et recompile le décodeur (moins de coupures, plus de rafales de bruit en xHE-AAC) ; le nouveau décodeur est utilisé dès que l'assistant redémarre avec le récepteur.

---

## 14. Conseils généraux

**Les filtres de bruit n'atteignent pas les décodeurs.** NR, NB, NS et AN sont
des aides à l'écoute, pour vos oreilles seulement. Tous les décodeurs — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, tous les modes FLDIGI, SSTV et le grabber QRSS — prennent l'audio *avant* ces filtres : réglez-les donc comme cela sonne le mieux, sans vous soucier de la qualité de décodage. Pour la même raison, les décodeurs continuent de tourner pendant que le récepteur est coupé ou silencé : vous pouvez éteindre le haut-parleur et laisser un décodeur, ou une capture QRSS nocturne, poursuivre. La seule chose qui suive réellement ce que vous entendez est le spectrogramme audio, qui est fait pour montrer l'audio filtré.

### Report automatique des spots et graphiques du serveur

Les décodages FT8, FT4 et WSPR peuvent aussi être téléversés par le serveur lui-même — FT8/FT4 vers PSK Reporter, WSPR vers WSPRnet — par un démon autorun que le sysop démarre depuis le panneau d'administration. Il est indépendant des décodeurs de votre navigateur : il continue de tourner qu'il y ait des auditeurs ou non, et rien de ce que vous décodez dans le navigateur n'est rapporté. L'opérateur y choisit aussi les bandes, les modes et les heures UTC où les spots sont envoyés.

---

*PhantomSDR-Plus — fork sv1btl — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
