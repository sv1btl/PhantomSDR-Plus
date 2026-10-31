# Guide de l'utilisateur PhantomSDR-Plus

Bienvenue dans PhantomSDR-Plus ! Ce guide vous aidera à tirer le meilleur parti de votre écoute WebSDR.

---

## Table des matières

1. [Introduction](#introduction)
2. [Premiers pas](#premiers-pas)
3. [Vue d'ensemble de l'interface](#vue-densemble-de-linterface)
4. [Opérations de base](#opérations-de-base)
5. [Fonctions avancées](#fonctions-avancées)
6. [Modes de démodulation](#modes-de-démodulation)
7. [Décodeurs numériques](#décodeurs-numériques)
8. [Raccourcis clavier](#raccourcis-clavier)
9. [Favoris](#favoris)
10. [Utilisation sur mobile](#utilisation-sur-mobile)
11. [Conseils et bonnes pratiques](#conseils-et-bonnes-pratiques)
12. [Dépannage](#dépannage)
13. [Foire aux questions](#foire-aux-questions)

---

## Introduction

### Qu'est-ce que PhantomSDR-Plus ?

PhantomSDR-Plus est une radio logicielle (SDR) accessible par le web qui vous permet d'écouter des signaux radio via Internet. Aucun logiciel ni matériel particulier n'est requis de votre côté — il suffit d'un navigateur web moderne !

### Que pouvez-vous écouter ?

Selon la configuration du WebSDR, vous pouvez vous accorder sur :

- **Radioamateurs** : opérateurs radioamateurs du monde entier
- **Stations de radiodiffusion** : radio AM/FM, radiodiffusion en ondes courtes
- **Aviation** : contrôle aérien, communications aéronautiques
- **Maritime** : liaisons navire-côte, météo maritime
- **Satellites météo** : NOAA, METEOR-M
- **Modes numériques** : FT8, RTTY, PSK31 et davantage
- **Stations utilitaires** : signaux horaires, militaires, gouvernementaux

### Configuration requise

- **Navigateur** : Chrome/Edge (recommandé), Firefox, Safari
- **Connexion** : Internet haut débit (1 Mbit/s ou plus recommandé)
- **Audio** : haut-parleurs ou écouteurs fonctionnels
- **Facultatif** : souris à molette pour un accord plus facile

---

## Premiers pas

### 1. Accéder au WebSDR

Ouvrez votre navigateur et rendez-vous à l'adresse du WebSDR fournie par l'opérateur.

Exemple : `http://websdr.example.com:9002`

### 2. Chargement initial de la page

Au chargement de la page, vous verrez :
- un affichage en cascade coloré montrant l'activité radio
- un panneau de commande avec l'affichage de fréquence et des boutons
- un S-mètre indiquant la force du signal
- un indicateur du nombre d'utilisateurs

### 3. Commencer à écouter

1. **Cliquez sur un signal** dans l'affichage en cascade
2. **L'audio démarre automatiquement**
3. **Réglez le volume** avec la commande de volume de votre navigateur ou le curseur à l'écran
4. **Affinez la fréquence** en cliquant précisément sur le signal

---

## Vue d'ensemble de l'interface

### Composants principaux

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes  RADE-v2U       │           · IF Filters     │ [ profile ▾ ]       │
│   RADE-v1L RADE-v1U   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM IQ               │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Les trois panneaux sous la cascade défilent comme une seule page ; dans une fenêtre étroite ils s'empilent au lieu de se placer côte à côte. **RADE-v2U**, **RADE-v1L** et **RADE-v1U** se trouvent sur la ligne de titre *Modes* elle-même, à sa droite.

### 1. Affichage en cascade

La cascade est une représentation visuelle des signaux radio :

- **Axe horizontal** : la fréquence
- **Axe vertical** : le temps (défile vers le bas)
- **Couleurs** : la force du signal
  - **Bleu foncé/noir** : aucun signal (plancher de bruit)
  - **Vert/jaune** : signaux faibles à moyens
  - **Orange/rouge** : signaux forts
  - **Blanc** : signaux très forts

### 2. Affichage de la fréquence

Indique la fréquence actuellement accordée dans divers formats :
- **MHz** : 7.100.000 MHz (bandes HF)
- **kHz** : 14200 kHz
- **Hz** : 145500000 Hz (VHF/UHF)

### 3. S-mètre (analogique ou numérique)

Affiche la force du signal :
- **S1-S9** : échelle standard de force de signal
- **+dB** : signaux au-dessus de S9 (p. ex. S9+20dB)
- **Analogique ou numérique** : selon la configuration

### 4. Boutons de mode

Sélectionnez le mode de démodulation :
- **AM** : modulation d'amplitude
- **FM** : modulation de fréquence
- **USB** : bande latérale supérieure
- **LSB** : bande latérale inférieure
- **CW** : code Morse (onde entretenue)
- **WBFM** : FM à large bande (radiodiffusion)
- **QUAM** : AM stéréo C-QUAM — le libellé passe au vert dès qu'un pilote stéréo est détecté
- **IQ** : I/Q brut — 12 kHz de la bande tels qu'ils arrivent, pour enregistrer ou pour un autre logiciel (voir la section IQ plus bas)

À côté du titre **Modes** se trouvent les boutons **RADE-v2U**, **RADE-v1L** et **RADE-v1U**, qui lancent la voix numérique RADE en une seule pression — voir [Décodeurs numériques](#décodeurs-numériques). **RADE-v2U** lance RADE V2 (beta), toujours en USB ; **RADE-v1L** et **RADE-v1U** lancent RADE v1.

### 5. Panneau de commande

Commandes supplémentaires :
- **AGC** : contrôle automatique de gain
- **NR** : réduction de bruit (spectrale)
- **NB** : silencieux d'impulsions
- **NS** : suppression du bruit de fond
- **AN** : notch automatique
- **CTCSS** : squelch à sous-tonalité (FM). Un appui ouvre à côté du bouton une petite fenêtre avec *Any tone* et les 49 sous-tonalités normalisées (67,0–254,1 Hz) ; une fois la tonalité choisie, le bouton l'affiche (par exemple *88.5*, ou *ANY*) et l'audio ne passe que tant que cette tonalité est reçue. La ligne *Heard:* de la fenêtre indique la sous-tonalité que le récepteur entend sur le canal à cet instant et son intensité, ce qui permet de lire la tonalité inconnue d'un relais. Tant que le CTCSS est activé, l'audio FM est joué 0,4 s derrière le récepteur, afin que le squelch soit déjà ouvert quand arrivent les premiers mots d'une station ; avec *Any tone*, le début peut encore être légèrement coupé, choisissez donc la tonalité exacte quand vous le pouvez. Un nouvel appui désactive le CTCSS ; Échap ou un clic à l'extérieur ferme la fenêtre sans rien changer. Les signets conservent la tonalité choisie.
- **SQL** : squelch
- **AI** : réduction de bruit par IA (modes phonie)
- **Zoom** : niveau de zoom de la cascade
- **Wheel Tuning Steps** : pas d'accord de la molette de la souris, de 10 Hz à 12,5 kHz (12,5 kHz est l'espacement des canaux en VHF/UHF)
- **Decoders** : boutons qui démarrent et arrêtent chaque décodeur en une pression

### 6. Superposition du plan de bandes

Barres colorées indiquant les attributions de fréquences :
- des couleurs différentes pour différents services
- aide à identifier ce qui est autorisé sur chaque fréquence

---

## Opérations de base

### S'accorder sur une fréquence

#### Méthode 1 : cliquer sur la cascade

1. Cliquez directement sur un signal dans la cascade
2. Le récepteur s'accorde sur cette fréquence
3. L'audio démarre

#### Méthode 2 : saisir la fréquence

1. Cliquez n'importe où dans le cadre noir fréquence / S-mètre — partout sauf sur un chiffre, et sauf sur le S-mètre analogique, dont le clic change le style
2. Un pavé numérique s'ouvre ; tapez la fréquence avec ses touches ou au clavier (`.` ou `,` pour la virgule décimale)
3. Appuyez sur **kHz** ou **MHz** pour accorder — la touche choisie fixe l'unité ; au clavier, Entrée vaut kHz et `M` vaut MHz

**C** efface la saisie, **⌫** efface le dernier chiffre, et Échap ou un clic à l'extérieur ferme le pavé sans accorder. Dans la vue mobile étendue, toucher le champ de fréquence lui-même ouvre le clavier numérique du téléphone.

Exemples :
- `7100` + **kHz** → 7.100 MHz
- `14.2` + **MHz** → 14.200 MHz
- `145.5` + **MHz** → 145.500 MHz

**Une fréquence tapée amène sa bande.** Le récepteur va dans la bande où se trouve la fréquence tapée comme le ferait le bouton de cette bande : la cascade montre toute la bande, la luminosité et le contraste prennent les réglages de la bande et le mode suit le plan de bande — mais vous restez exactement sur la fréquence tapée. En dehors des bandes définies, seule la fréquence change. Si la station possède un autre récepteur qui couvre cette fréquence — par exemple `145.5` **MHz** tapé sur un récepteur HF —, c'est la page de ce récepteur qui s'ouvre, déjà accordée et cadrée de la même façon (voir *Choisir un récepteur* plus bas).

#### Méthode 3 : la souris sur les chiffres

1. Placez le pointeur sur un chiffre de l'affichage de fréquence — il s'allume
2. Molette vers le haut ou **clic gauche** augmente ce chiffre d'une unité ; molette vers le bas ou **clic droit** le diminue
3. Le pas est la valeur de position du chiffre — 1 kHz sur le chiffre des kHz, 100 Hz sur la première décimale — et un chiffre qui dépasse 9 reporte une retenue sur le chiffre à sa gauche
4. Partout ailleurs dans le cadre noir de la fréquence — nom de bande, ligne de mode, horloge — la molette accorde au pas d'accord (**Shift** 1 kHz, **Alt** 10 kHz) ; seul le S-mètre analogique est exclu, la molette y fait défiler la page

#### Méthode 4 : boutons de pas

1. Utilisez les boutons **▲** et **▼** à côté de la fréquence
2. Le pas varie selon le mode :
   - **AM/FM** : pas de 1 kHz
   - **BLU** : pas de 100 Hz
   - **CW** : pas de 10 Hz

#### Méthode 5 : boutons de bande

Un bouton de bande cadre sa bande — la cascade zoome sur toute la bande, la luminosité et le contraste prennent les réglages de la bande — et accorde sur la dernière fréquence que vous avez utilisée dans cette bande, quelle que soit la façon dont vous y êtes allé (clic dans la cascade, les chiffres, un favori, un lien du chat…). La première fois, il va sur la fréquence par défaut de la bande. Un second clic sur le bouton de bande déjà actif (en surbrillance) oublie la fréquence mémorisée et va sur celle par défaut de la bande. La mémoire est gardée dans votre navigateur, elle survit donc à un rechargement, et elle n'appartient qu'à vous.

### Scanner

Le scanner promène le récepteur sur une plage de canaux et s'arrête sur le premier qui porte un signal. Il se trouve sur la ligne **Fine Tuning (kHz)**, tout à droite :

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Commande | Rôle |
|----------|------|
| **◀ ▶** | Balayer vers le bas / le haut. À l'arrêt sur un signal, une flèche relance le balayage. |
| **■** | Arrêter. |
| **⊘** | Exclure ce canal du balayage — pour une porteuse permanente ou un birdie. |
| **30 dB · 4 ▾** | Le seuil, et à côté le niveau mesuré à l'instant. Ouvre les réglages. |

Le texte à gauche indique ce que fait le scanner : `Scanner` au repos, la fréquence atteinte pendant le balayage, `◉ 3s` pendant le décompte avant reprise, `◉ 30·22s` tant que le canal est encore occupé, `◉ hold` quand il reste en place.

**Réglages**

- **Range** — *Scan Band* balaie la bande où commence le balayage ;
  *Scan Visible* balaie exactement ce que montre la cascade et la suit si vous
zoomez ou la déplacez.
- **Scan** — *Every channel* accorde et écoute chaque canal à son tour ;
  *Skip empty* lit le spectre et saute directement aux signaux.
- **Stop at** — de combien un canal doit dépasser le bruit de fond de la bande
pour arrêter le balayage, en dB. Le bruit est suivi en continu : le même réglage convient de jour comme de nuit. Un canal vide n'affiche pas 0 dB — regardez un instant la valeur sur le bouton et placez le seuil au-dessus.
- **Resume after** — combien de temps un canal doit rester calme avant que le
balayage reparte. Les pauses de la parole ne le relancent pas. *Hold* reste en place jusqu'à ce que vous appuyiez sur un bouton.
- **Max stay** — repart au bout de ce temps même si le signal est toujours là,
pour qu'une porteuse permanente ne bloque pas le balayage indéfiniment.

Le pas suit le mode — 1 kHz en BLU, 0,1 kHz en CW, 5 kHz en AM, 9 ou 10 kHz en ondes moyennes et 9 kHz en grandes ondes — et les arrêts tombent sur la grille des canaux. Le balayage reste dans sa plage et dans ce que le récepteur peut accorder ; à une extrémité il reprend à l'autre.

Les réglages et les canaux exclus sont mémorisés dans votre navigateur.


### Choisir le mode de démodulation

Choisissez le mode adapté au signal :

**Pour les communications vocales :**
- **AM** : aviation, radiodiffusion AM, certains trafics amateurs
- **FM** : relais VHF/UHF, radiodiffusion FM
- **USB** : radioamateur HF (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB** : radioamateur HF (160 m, 80 m, 40 m, 30 m)

**Pour les données / le numérique :**
- **USB** : la plupart des modes numériques (FT8, PSK31, RTTY)
- **LSB** : certains modes numériques sur les bandes HF basses

**Pour le code Morse :**
- **CW** : signaux télégraphiques / Morse

### Régler le volume

- **Curseur à l'écran** : faites glisser le curseur de volume
- **Volume du navigateur** : utilisez les commandes multimédias du navigateur
- **Volume système** : ajustez le volume de votre ordinateur
- **Clavier** : utilisez les touches + et - (si prises en charge)

### Utiliser le S-mètre

Le S-mètre indique la force du signal :

- **S0-S3** : signal très faible, difficile à copier
- **S4-S6** : signal faible à moyen
- **S7-S9** : signal bon à fort
- **S9+** : signal extrêmement fort

**Astuce** : pour un meilleur son, accordez-vous sur des signaux affichant S7 ou plus.

**Changer le cadran de l'instrument** : sur le S-mètre analogique (à aiguille), cliquez sur l'instrument lui-même — ou sélectionnez-le et appuyez sur Entrée ou Espace — pour faire défiler trois fonds : métal brossé sombre, un cadran clair gris pâle et un cadran ambre chaud de style vintage. Votre navigateur retient le choix : il est toujours là après un rafraîchissement ou un redémarrage. Il vaut par navigateur et par adresse : ouvrir le récepteur par nom d'hôte et par IP donne deux réglages distincts, et une fenêtre privée repart toujours du réglage par défaut du site.

**Au-dessus de 30 MHz**, le S-mètre suit la norme VHF de l'IARU Région 1 : S9 y vaut −93 dBm au lieu de −73 dBm en ondes courtes, toujours avec six dB par point S. L'aiguille et la barre basculent d'elles-mêmes selon la fréquence accordée ; les valeurs en dBm et dBµV indiquent toujours le niveau mesuré. Certaines stations règlent en outre leurs récepteurs VHF/UHF pour que les instruments restent à **0 sur un canal vide**, comme sur un transceiver VHF/UHF : au-dessus de 60 MHz, l'aiguille et la barre ne montent alors que lorsqu'un signal sort du bruit. Les valeurs dBm, dBµV, SNR et NF indiquent toujours les valeurs réelles.

### Choisir un récepteur

Certaines stations ont plus d'un récepteur — par exemple un pour les ondes courtes et un pour la bande des 2 m. Elles affichent dans l'en-tête de la page une ligne *Receivers:* avec un bouton par récepteur ; celui sur lequel vous êtes apparaît en jaune. Appuyer sur un autre bouton ouvre la page de ce récepteur, avec sa propre cascade, ses bandes, son chat et sa liste d'auditeurs. Sur la page /mobile, les mêmes boutons se trouvent dans la barre supérieure. Une station à un seul récepteur n'affiche pas cette ligne.

**Show All.** Après les boutons de récepteur se trouve une case **Show All**. Cochée, elle fait apparaître chaque autre récepteur de la station sous votre cascade — son spectre et sa cascade, avec ses propres marqueurs et sa propre échelle de fréquences, la ligne la plus récente en haut. Survolez-la pour lire la fréquence et le marqueur le plus proche ; un clic ouvre ce récepteur à cet endroit, dans le même onglet : sur un marqueur dans le mode du marqueur, ailleurs dans le mode donné par le plan de bande. Votre navigateur retient la case, décochée tant que vous ne la cochez pas, car chaque bande est un flux de cascade de plus (environ 10 Ko/s).

**La vue que vous avez quittée est conservée.** Quand vous quittez la page d'un récepteur, son zoom, sa luminosité, son contraste, son mode et sa fréquence sont mémorisés. Sa bande sur l'autre page montre alors cette même partie de la bande, avec un petit ▼ vert là où vous étiez accordé ; le bouton dans l'en-tête de la bande affiche cette plage et **Full span** — appuyez dessus pour toute la plage du récepteur, et sur **Last view** pour revenir. Un clic sur une fréquence de cette vue rouvre le récepteur tel quel, avec le même zoom, les mêmes niveaux et le même mode, au lieu de toute sa plage.

**Choisir une bande radio dans la bande Show All.** Quand l'autre récepteur couvre plus d'une bande — le récepteur HF vu depuis la page 2 m —, l'en-tête de sa bande Show All porte une liste déroulante à la place de ce bouton : **Last view**, **Full span** et chaque bande de ce récepteur, les mêmes que ses boutons de bande. Choisissez une bande et la bande Show All l'affiche comme le fait ce bouton de bande, d'un bord à l'autre avec la luminosité et le contraste de la bande ; un clic dessus ouvre alors ce récepteur cadré sur la bande, accordé là où vous avez cliqué. Votre choix est mémorisé dans votre navigateur, séparément pour chaque récepteur. Un récepteur à une seule bande, comme le 2 m, garde le bouton.

**Le bon récepteur, tout seul.** Une fréquence que ce récepteur ne couvre pas mais qu'un autre récepteur de la station couvre — tapée, issue d'un lien, d'un signet, d'un spot DX, d'un message du chat ou de l'étiquette d'un autre auditeur — ouvre la page de ce récepteur, accordée à cet endroit. La molette de la souris et les pas des chiffres ne changent jamais de récepteur, pas plus qu'un transceiver relié en CAT.

---

## Fonctions avancées

### Contrôle automatique de gain (AGC)

L'AGC maintient l'audio à un niveau stable. Les quatre boutons fonctionnent comme le commutateur d'AGC d'un transceiver : tous les quatre donnent le même volume et ne diffèrent que par la vitesse à laquelle le gain remonte lorsqu'un signal faiblit ou s'arrête.

- **Auto** : l'AGC propre au récepteur, réglée séparément pour la BLU, l'AM et le C-QUAM. C'est le réglage par défaut.
- **Fast** : pas de maintien ; le gain remonte en 0,3 s environ. Le bruit remonte entre les mots et le fading rapide est suivi de près. Bien pour la CW et pour extraire une station faible entre des fortes.
- **Medium** : maintient 0,25 s, puis remonte en 1,2 s environ. Un bon réglage de tous les jours pour la BLU.
- **Slow** : maintient 1 s, puis remonte en 3 s environ. Le fond reste bas entre les mots et entre les passages ; une station faible juste après une forte paraît plus faible pendant quelques secondes.

**Tant qu'un décodeur est ouvert**, l'AGC est maintenue sur Slow, quel que soit le bouton choisi : le décodeur entend le même audio que vous et a besoin d'un gain stable. Une petite mention **Slow (decoder)** apparaît à côté du titre AGC, et votre propre choix revient dès que le dernier décodeur est fermé.

**Recommandation** : commencez par « Fast » pour l'AM, « Slow » pour la BLU.

### Les quatre commandes de bruit

NR, NB, NS et AN sont des boutons marche/arrêt distincts, chacun s'attaquant à un type de bruit différent. Ils sont indépendants — en activer un n'en active aucun autre — et se combinent librement.

Aucun n'atteint les décodeurs : FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia/Packet/APRS et le grabber QRSS lisent l'audio *avant* ces filtres. Vous pouvez donc les régler purement à l'oreille sans influer sur ce qui est décodé. Voir le [manuel des décodeurs](DECODERS.md#14-conseils-généraux).

### Réduction de bruit (NR)

Réduction de bruit spectrale. Elle estime le niveau de bruit dans chaque partie du spectre audio et baisse ces parties, en laissant tranquille ce qui dépasse du bruit.

**À utiliser quand** : vous entendez un souffle régulier ou un bruit blanc
derrière le signal.

Les tonalités continues — une note CW, une porteuse — sont reconnues comme du signal et protégées : NR ne mange donc pas un signal CW comme le ferait un filtre naïf. Effet typique : 10 à 12 dB de bruit en moins entre les mots. La parole elle-même perd bien moins de 1 dB sur les signaux forts et quelques dB sur les très faibles, qui restent pourtant plus compréhensibles que sans NR.

### Silencieux d'impulsions (NB)

Supprime le bruit impulsionnel : clics, claquements, parasites atmosphériques, allumage et bruit de ligne électrique. Il surveille l'enveloppe audio et ne silence que les échantillons qui la dépassent largement — environ une milliseconde par parasite, avec des rampes d'entrée et de sortie pour que le blanking ne claque pas lui-même.

**À utiliser quand** : vous entendez des clics ou des claquements dus aux lignes
électriques, aux moteurs, aux orages ou à l'allumage des véhicules.

Les notchs de ronflement secteur 50 Hz et 60 Hz suivent ce bouton.

### Suppression du bruit de fond (NS)

Mesure sur plusieurs secondes le plancher de bruit propre à la bande et applique une atténuation fixe à ce qui s'y trouve, plus profonde dans l'aigu que dans le grave. Là où NR réagit d'instant en instant, NS est la main lente et sûre : elle abaisse le souffle de la bande sans changer la sonorité du signal.

**À utiliser quand** : la bande est calme mais soufflante et vous voulez faire
descendre le bruit sans la sonorité « sous-marine » d'une NR agressive.

Active seulement en USB, LSB et AM — CW, FM et les modes numériques restent intacts. Elle remesure le plancher à chaque changement de fréquence ou de mode et se stabilise en quelques secondes.

### Notch automatique (AN)

Trouve et supprime automatiquement les tonalités parasites continues — hétérodynes, porteuses, sifflements — sans que vous ayez à placer un notch à la main. Il s'adapte en continu : plusieurs tonalités peuvent être supprimées à la fois, et une tonalité qui dérive reste notchée.

**À utiliser quand** : vous entendez un sifflement ou une tonalité par-dessus le
signal voulu.

Contourné en CW, où le signal utile *est* une tonalité continue.

**Note sur le retard** : NR et NS ajoutent chacun environ 40 ms de retard audio
lorsqu'ils sont activés (les deux ensemble, environ 80 ms). NB et AN n'en ajoutent aucun. Cela ne concerne que l'écoute, jamais les décodeurs.

### Squelch automatique (SQL)

Coupe l'audio en l'absence de signal :

- **Off** : audio permanent (souffle audible)
- **Auto** : seuil défini automatiquement
- **Manual** : réglage manuel du seuil

**À utiliser quand** : vous surveillez une fréquence en attendant du trafic.

Tant que SQ est désactivé, le nombre du seuil à côté du curseur s'affiche en gris.

### Réduction de bruit par IA (AI)

Le bouton **AI**, avec un curseur d'intensité à côté, se trouve dans le panneau Audio & Buffer, juste sous SQ. Sur la page /mobile, il est dans l'onglet Audio, sous Squelch. Il retire le bruit de bande de la parole grâce à RNNoise, un petit réseau de neurones entraîné sur la voix.

Tout se passe dans votre propre navigateur : rien n'est envoyé à un serveur extérieur, aucun compte n'est nécessaire, et le récepteur n'a aucun travail supplémentaire.

- **Marche/arrêt** : cliquez sur **AI** ; le bouton devient bleu. Le premier clic télécharge le module (environ 1,3 Mo), et le bouton pulse pendant le chargement.
- **Intensité** : règle l'intensité de son action pendant que quelqu'un parle — des valeurs plus basses gardent davantage du son d'origine. Le haut de l'échelle est volontairement plus doux qu'une coupure totale, pour que la parole ne soit pas abîmée même à 100 %, qui nettoie pourtant davantage que 50 %. Entre les mots, elle agit plus fort d'elle-même, si bien que le souffle y baisse davantage. La valeur par défaut est 50 %. Vous pouvez la régler même quand l'IA est coupée.
- **Voyant d'état** : le voyant AI sous l'affichage de fréquence s'allume en cyan quand AI travaille, et apparaît à demi atténué quand AI est actif mais que le mode courant n'est pas un mode phonie.

**À utiliser quand** : vous écoutez de la phonie SSB ou AM sur une bande bruyante. Le souffle entre les mots baisse en général d'environ 10 dB avec les 50 % par défaut, et davantage à 100 %, jusqu'à environ 20 dB, tandis que la parole garde son niveau.

Modes phonie seulement — USB, LSB, AM et SAM. En CW, FM, modes numériques et C-QUAM, le son passe sans modification, car le réseau traite une tonalité CW ou de la musique comme du bruit. Comme les quatre commandes de bruit, elle n'atteint jamais les décodeurs. Sur les stations faibles (en dessous d'environ +6 dB de SNR), elle mesure elle-même le rapport signal/bruit et lisse davantage ses décisions, pour que la parole ne prenne pas le son gargouillant, « aqueux », que peut donner ce type de filtre ; les stations fortes sont traitées exactement comme avant. Si un signal très faible sonne encore traité, baissez le curseur. Elle ajoute environ 50 ms de retard au son.

### Tampon audio et retard

Le son arrive au navigateur par petits paquets, de 35 ms chacun sur un récepteur typique, et le navigateur en garde un peu en réserve pour qu'un paquet en retard ne provoque pas de trou. Cette réserve est le **tampon**, et elle représente l'essentiel du retard entre le récepteur et votre haut-parleur.

- **Ordinateur** : dans le panneau Audio & Buffer, le bouton à l'icône réseau monte le tampon d'un cran par clic (il passe au vert au-dessus du cran le plus bas), et le curseur à côté choisit directement un cran de 1 à 6. Le cran le plus bas convient à une connexion filaire ; les téléphones commencent au cran 2.
- **/mobile** : le bouton **BUF** et le curseur **Buffer** de l'onglet Audio font la même chose.

Le tampon se règle tout seul. La page mesure l'irrégularité avec laquelle votre connexion livre le son et ne garde en réserve que ce que la dernière minute a montré nécessaire, plus la marge de sécurité du cran choisi : 20 ms au cran 1, 50 ms au cran 2, davantage aux crans supérieurs. Après un moment de difficulté réseau, le retard supplémentaire se résorbe en une ou deux minutes, et une petite différence entre l'horloge de votre carte son et celle du récepteur ne provoque plus de coupure toutes les quelques minutes. Les ajustements sont de quelques millisecondes à la fois, faits là où le son se répète, et sont inaudibles. Les décodeurs et vos enregistrements ne sont jamais touchés : ils reçoivent chaque échantillon.

Si le son se coupe, montez le tampon d'un cran. Sur un téléphone en Wi-Fi domestique, le retard du récepteur au haut-parleur est en général d'environ 100–150 ms ; le réseau entre vous et le récepteur s'y ajoute.

### Votre nom ou indicatif

À côté de **Open Additional Info** se trouve une case pour votre nom ou indicatif : 10 caractères au plus et sans espace, comme sur un WebSDR. Tapez-le et appuyez sur **Save** (ou Entrée) ; **Edit** permet de le changer plus tard. Votre navigateur le retient, y compris quand vous passez aux autres récepteurs de la station. Laissez la case vide et vous restez anonyme : *anonymous* suivi d'un nombre dans le chat, et seulement votre localisation partout ailleurs. Sur un téléphone, la même case se trouve au-dessus de l'affichage de fréquence.

Votre nom apparaît dans la fenêtre **Users**, sur vos lignes de chat et sur l'étiquette que les autres auditeurs voient sous leur waterfall — votre nom puis votre localisation, par exemple `SV1BTL-Athens`. Votre propre position est l'★ jaune avec votre nom à côté. Survolez l'étiquette d'un autre auditeur pour voir la fréquence et le mode sur lesquels il est accordé ; un clic vous y accorde.

Comme sur un WebSDR, l'adresse IP d'aucun auditeur n'est montrée aux autres — ni dans la fenêtre Users, ni dans les Statistiques des utilisateurs, qui comptent les visiteurs par un code anonyme.

La fenêtre Users montre aussi quel décodeur chaque auditeur utilise — FT8, CW, DRM, HFDL, etc. — sous forme d'une petite étiquette verte après le mode, et les Statistiques des utilisateurs ont un panneau **Decoder Popularity** : combien de sessions ont utilisé chaque décodeur. Dans la fenêtre Users ouverte depuis la page du récepteur, **Tune** à côté d'un auditeur vous place sur ce qu'il écoute : la même fréquence et le même mode, sa largeur de filtre et son décodeur — lancé pour vous, ou le vôtre arrêté s'il n'en utilise aucun. La bande est ensuite cadrée comme avec **To Band** : la cascade montre toute la bande où il se trouve, avec la luminosité, le contraste et le pas d'accord de cette bande.

### Chat

Quand l'opérateur a activé le chat, il a son propre panneau sur la page de bureau et un onglet **Chat** sur /mobile. Tapez votre message et envoyez-le : il part sous le nom de votre case de nom (voir ci-dessus), ou en *anonymous* suivi d'un nombre.

Pour répondre à un message précis, cliquez sur **↪ Reply** à côté de son heure. Une ligne au-dessus de la zone de saisie indique à qui et à quoi vous répondez ; tapez et envoyez comme d'habitude, ou appuyez sur ✕ ou Échap pour annuler. La réponse apparaît en retrait sous le message auquel elle répond, avec une courte ligne de citation. Une réponse à une réponse rejoint le même fil. Le serveur garde les 20 derniers messages ; quand l'original a déjà quitté cet historique, la réponse n'affiche que le nom et l'heure auxquels elle répond.

Une fréquence dans un message est un lien : un clic accorde dessus, dans le mode indiqué avec elle. La bande est cadrée comme avec **To Band** — la cascade montre toute la bande, avec la luminosité et le contraste de cette bande — et le bouton de la bande s'allume.

### Fonction de zoom

Agrandit l'affichage en cascade :

- **1x** : vue normale (large couverture)
- **2x** : grossissement ×2
- **4x** : grossissement ×4
- **8x** : grossissement ×8

**À utiliser quand** : vous devez mieux voir les signaux ou vous accorder finement.

**To Band** affiche toute la bande de la fréquence en cours, avec 10 kHz de marge à chaque bord.

### Auto Adj. (cascade)

L'interrupteur **Auto Adj.** des commandes de la cascade règle pour vous la luminosité et le contraste de la cascade. Il mesure le bruit de fond sur toute l'étendue visible et en fait un fond sombre et régulier — y compris là où le bruit diffère d'une partie de l'étendue à l'autre — puis étire tout ce qui se trouve au-dessus, si bien que les signaux faibles ressortent et que les plus forts atteignent les couleurs du haut. Il fonctionne de la même façon avec toutes les palettes, et seule la cascade change : la trace du spectre garde sa véritable échelle en dB. Tant qu'il est actif, les curseurs Min et Max sont verrouillés et affichent le bruit de fond et le pic mesurés ; en le désactivant, ils reviennent aux réglages de la bande.

### Spectre 3D

Le bouton **3D**, à côté de **Reverse** dans les commandes de la cascade, affiche le spectre en relief sur les dernières secondes : la fréquence en largeur, le temps vers le fond de l'écran, la force du signal en hauteur. Il utilise les mêmes couleurs, la même luminosité (Min), le même contraste (Max) et le même Auto Adj. que la cascade, et suit le zoom et le glissement comme le spectre plat. Un clic accorde, un glissement parcourt la bande et la molette de la souris zoome, exactement comme sur le spectre plat. Le relief se rétrécit vers le fond comme une table vue de biais, et plus une ligne est loin, plus ses pics sont bas. Un clic sur une ligne plus ancienne accorde sur la fréquence de cette ligne, et la fréquence affichée sous la souris indique alors aussi l'âge de la ligne (par exemple 7.074.000 · −6 s). Le bouton **⚙** ouvre deux curseurs : **Angle** (la pente du sol vers le fond) et **Depth** (combien le relief se rétrécit et ses lignes s'abaissent vers le fond) ; **Reset** rétablit les valeurs par défaut, et votre réglage est mémorisé dans le navigateur. Les repères de gauche indiquent à combien de secondes remonte une ligne, ceux de droite de combien de dB un pic dépasse le niveau Min (ils sont masqués tant qu'Auto Adj. est actif). **✕ 2D**, ou de nouveau le bouton 3D, revient au spectre plat, et votre choix est mémorisé dans le navigateur. La vue nécessite WebGL2, que propose tout navigateur actuel ; sans lui, le bouton n'apparaît pas. Un enregistrement vidéo fait avec la vue 3D ouverte enregistre la vue 3D à la place du spectre plat. La vue 3D est adaptée de PhantomSDR-ORSAT de F1NSK.

**Ligne du curseur.** Partout où se trouve la souris au-dessus du spectre, de la cascade ou de la vue 3D, une ligne jaune pointillée marque cette fréquence sur le spectre et sur la cascade, et le spectre l'affiche en MHz.

### Analyseur audio

Le bouton **📊 Show** de la section Spectrogram ouvre l'analyseur audio sous la cascade ; **📊 Hide** le ferme. Il montre l'audio que vous entendez, après démodulation, sous forme de spectre avec une grille en dB et une ligne de crête jaune. **Gain** monte ou baisse la courbe et **Color** choisit ses couleurs. Le spectre est dessiné en relief, éclairé depuis le haut à droite. Dans les couleurs Rainbow, chaque barre est colorée selon son écart au bruit à sa fréquence — bleu foncé pour le bruit, y compris dans les pauses de la parole quand l'AGC le remonte, puis bleu, cyan, jaune, orange et rouge pour des signaux de plus en plus forts —, tandis que sa hauteur se lit toujours sur l'échelle en dB. Comme le spectre principal, l'analyseur et ses rapports sont dessinés sur fond noir, avec un quadrillage gris.

- **Axe des fréquences.** Il suit le mode : 0–4,5 kHz en SSB, 0–2 kHz en CW, 0–5,5 kHz en AM et FM. En LSB il est inversé (les aigus à gauche), pour se lire dans le même sens que le spectre RF. Un trait cyan marque la fréquence d'accord (en CW, la note à 600 Hz), et sous la souris l'analyseur affiche la fréquence audio et la fréquence RF en kHz.
- **Balises de largeur de bande.** Des balises colorées montrent les largeurs préconisées pour le mode — SSB standard 300–2700 Hz et ESSB 50–4000 Hz, CW 500 Hz et 250 Hz, AM radiodiffusion et AM radioamateur — et un cadre blanc pointillé montre votre filtre actuel. La largeur standard est tracée en trait cyan continu, l'alternative (ESSB, CW 250 Hz, AM radioamateur) en pointillé bleu clair.
- **Vue RF en AM et FM.** L'audio démodulé n'a plus de porteuse ; dans ces modes l'analyseur montre donc la station telle qu'elle est dans la cascade : porteuse au centre, bandes latérales de part et d'autre. Son échelle est en dB au-dessus du bruit.
- **Largeur occupée.** La ligne sous le spectre donne la largeur occupée par la station accordée (méthode −26 dB, mesurée sur la cascade) avec un verdict pour SSB, AM et CW : vert conforme, ambre large (une station ESSB apparaît en ambre), rouge pour un splatter probable, aussi ombré sur le spectre. Il faut environ 2 s de mesures ; les parasites statiques sont ignorés.
- **Pas besoin de zoomer.** Tant que l'analyseur est ouvert, la page garde une seconde connexion de cascade, invisible, centrée sur la station et à la résolution fine dont les mesures ont besoin : la vue RF et toutes les mesures RF fonctionnent donc quel que soit le zoom de la cascade. Elle se ferme avec l'analyseur. Elle coûte environ 12–14 Ko/s (quelque 45 Mo par heure) de données en plus tant que l'analyseur est ouvert ; sur une connexion facturée au volume, fermez-le quand vous n'en avez pas besoin.
- **Accorder depuis l'analyseur.** La fréquence de l'en-tête de l'analyseur s'accorde comme l'affichage principal : survolez un chiffre et tournez la molette, ou clic gauche pour monter d'un pas et clic droit pour descendre ; un clic à côté des chiffres ouvre le pavé numérique. Un clic sur l'étiquette du mode ouvre un menu des modes.
- **Mute.** Le bouton Mute dans l'en-tête de l'analyseur coupe le son du récepteur pendant que l'analyse continue — pour contrôler votre propre émission sans la renvoyer dans votre micro. Le son coupé depuis là revient à la fermeture de l'analyseur.

**Bilan audio SSB.** En USB et LSB, un panneau de bilan s'ouvre sous l'analyseur. Sur une fenêtre glissante de 20 s, et seulement pendant que la station parle, il juge l'équilibre tonal — graves (100–300 Hz) et présence (1,5–2,7 kHz) par rapport au médium, comparés à la référence choisie : **Standard SSB**, **DX / punch** ou **ESSB / hi-fi** — puis la compression, la ronflette secteur (raies à 50/100/150 ou 60/120/180 Hz), la porteuse résiduelle et la bande opposée (toutes deux mesurées sur la cascade) et la largeur occupée. Chaque ligne reçoit un point vert, ambre ou rouge ; une ligne non mesurable dit pourquoi, le plus souvent à cause du filtre de réception (pour les graves, son bord bas doit être vers 120 Hz ou en dessous). Rien n'est jugé au-dessus de 2,7 kHz, même si l'analyseur continue de l'afficher. La forme moyenne de la voix est tracée sur l'analyseur en courbe bleue. **Store A** la garde comme courbe A en pointillés, pour comparer après un réglage du correspondant ; **Clear A** l'efface et **↺ Restart** recommence les 20 s. **Generate a listening report** télécharge un fichier HTML à envoyer au correspondant, avec les verdicts, une image du spectre et les 20 dernières secondes d'audio. Les mesures sont indicatives : le fading, le filtre et l'AGC du récepteur influent, préférez donc l'AGC lente (Slow). L'analyseur et le bilan sont adaptés de PhantomSDR-ORSAT de F1NSK.

**Bilan AM et FM.** En AM, C-QUAM et FM, c'est un panneau de bilan propre à ces modes qui s'ouvre sous l'analyseur. Ici l'audio du récepteur renseigne peu sur l'émetteur — la porteuse AM est retirée de l'audio et l'AGC fixe le niveau —, le bilan juge donc la station surtout sur le spectre RF, sur une fenêtre glissante de 20 s. En **AM** : le taux de modulation (moyen et crête, d'après la puissance des bandes latérales face à la porteuse), l'équilibre des deux bandes latérales, l'écart de la porteuse par rapport à la fréquence d'accord, la largeur de l'audio, la ronflette secteur et la largeur occupée. En **FM** : l'excursion (approchée, d'après la largeur à 99 % par la règle de Carson), la largeur à 99 % avec le canal où elle tient (12,5 ou 25 kHz), l'écart de fréquence, la largeur de l'audio, la tonalité CTCSS s'il y en a une, et la ronflette secteur. La cascade moyenne chaque ligne sur environ 0,1 s, si bien que le taux de crête paraît plus bas qu'à l'oscilloscope ; une porteuse qui atteint le haut de l'échelle de la cascade est trop forte pour être mesurée, et le bilan le signale. L'écart de la porteuse inclut aussi l'erreur de fréquence du récepteur lui-même. **↺ Restart** et **Generate a listening report** fonctionnent comme dans le bilan SSB.

### Pilotage du transceiver (CAT)

Votre propre transceiver et la page du récepteur peuvent rester sur la même fréquence : tournez le bouton d'accord du poste et la cascade suit, ou cliquez sur un signal dans la cascade et le poste s'y accorde. Cela ne concerne que *votre* session d'écoute ; personne d'autre sur le récepteur n'est affecté.

**Avec Desktop PhantomSDR+ (4.0 ou ultérieur).** L'application de bureau possède un menu **Rig**. *Rig → Rig control...* ouvre une fenêtre où vous choisissez votre poste et la façon de le joindre, et le menu lui-même active ou coupe la synchronisation. Elle synchronise la fréquence, le mode et la largeur de filtre, dans un sens ou dans les deux, et peut couper le son du récepteur pendant que vous émettez. Outre PhantomSDR-Plus, elle pilote de la même façon les récepteurs **KiwiSDR, PA3FWM WebSDR et UberSDR**. Le poste est joint de l'une de ces quatre façons :

- **Intégré** — sans autre logiciel : Icom (CI-V), Yaesu (nouveau CAT et FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs et autres postes compatibles Kenwood.
- **Hamlib** — tous les postes que connaît Hamlib, plus de 300, choisis dans une liste avec recherche. Les installateurs Windows incluent Hamlib ; sous Linux, installez `libhamlib-utils`.
- **rigctld sur le réseau** — un `rigctld` déjà lancé.
- **flrig** — pour un poste que flrig partage déjà avec fldigi, WSJT-X ou un logiciel de carnet de trafic.

L'application, ses installateurs et son manuel complet se trouvent sur [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**Avec un navigateur web.** Le [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) couple un poste à la page du récepteur ouverte dans votre navigateur. Il synchronise la fréquence et le mode.

**La largeur de filtre et la coupure du son en émission** fonctionnent sur les récepteurs KiwiSDR, WebSDR et UberSDR, et sur un récepteur PhantomSDR-Plus en 4.1.0 ou ultérieure. Sur un PhantomSDR-Plus plus ancien, la fréquence et le mode se synchronisent toujours ; le filtre non.

Le manuel complet — chaque réglage, les postes pris en charge, comment on empêche les deux côtés de se battre, et le dépannage — est **[Pilotage du transceiver](RIG_CONTROL.md)**.

**Pour les développeurs.** Chaque page de récepteur propose ces fonctions sur `window` ; ce sont elles qu'utilisent les deux outils :

| Fonction | Rôle |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Fréquence d'accord, en Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Largeur totale de la bande passante, en Hz. À régler après le mode : changer de mode réinitialise la bande passante |
| `catsync_getMute()` / `catsync_setMute(on)` | Coupure du son, via le bouton muet de la page |
| `catsync_ready` | `true` dès que les fonctions sont installées |

Les trois dernières lignes sont nouvelles avec la 4.1.0 ; vérifiez qu'une fonction existe avant de l'appeler.

---

## Modes de démodulation

### AM (modulation d'amplitude)

**Utilisé pour :**
- les communications aéronautiques
- la radiodiffusion AM
- certains trafics radioamateurs
- les communications maritimes

**Caractéristiques :**
- large bande passante (typiquement 10 kHz)
- sensible au bruit
- facile à accorder (il suffit de cliquer sur le signal)

**Bonnes pratiques :**
- utilisez l'AGC rapide (Fast)
- activez le silencieux d'impulsions si vous entendez des clics
- accordez-vous sur le maximum du signal dans la cascade

### QUAM (AM stéréo C-QUAM)

**Utilisé pour :**
- Les émetteurs en ondes moyennes diffusant en AM stéréo

**Caractéristiques :**
- 10 kHz de large, décodé en paire stéréo plutôt qu'en AM mono
- Le libellé du bouton passe au **vert** de lui-même dès que le pilote stéréo de 25 Hz est présent : on voit ainsi quelles stations émettent réellement en stéréo avant de sélectionner le mode
- Depuis l'AM, un nouvel appui bascule en détection synchrone sur la porteuse ; le libellé passe au **jaune** et affiche `SAM`. Un troisième appui revient à l'AM simple
- Tant que le SAM tourne, une ligne comme `SAM +3.2 Hz · 97%` apparaît sous les indicateurs d'état (avec le S-mètre numérique, sous VFO | mode | largeur de bande) : l'écart entre la porteuse de la station et l'accord (+ = au-dessus) et la qualité du verrouillage du détecteur — jaune à partir de 85 %, de nouveau grise sous 60 %. Le jaune indique seulement qu'une porteuse stable est présente, pas le mode : une simple porteuse AM sur une fréquence marquée DRM la fait aussi passer au jaune
- L'audio C-QUAM est transporté en Opus ; tous les autres modes utilisent FLAC

**Bonnes pratiques :**
- Cherchez le libellé vert sur les signaux puissants en ondes moyennes la nuit
- Si la stéréo est instable, `SAM` est plus stable sur une porteuse faible

### FM (modulation de fréquence)

**Utilisé pour :**
- les relais radioamateurs VHF/UHF
- les services publics (police, pompiers, secours)
- la radio professionnelle bidirectionnelle
- certaines communications par satellite

**Caractéristiques :**
- bande passante étroite (typiquement 12,5 ou 25 kHz)
- excellente immunité au bruit
- « effet de capture » (le signal le plus fort l'emporte)

**Bonnes pratiques :**
- accordez-vous précisément au centre du signal
- utilisez le squelch pour couper l'audio au repos
- désactivez la réduction de bruit (inutile)

### USB (bande latérale supérieure)

**Utilisé pour :**
- le radioamateurisme HF (au-dessus de 10 MHz)
- la plupart des modes numériques HF
- les communications maritimes (au-dessus de 8 MHz)

**Caractéristiques :**
- bande passante étroite (typiquement 2.4 kHz)
- utilisation efficace du spectre
- exige un accord précis

**Bonnes pratiques :**
- utilisez l'AGC lente (Slow)
- accordez-vous sur le bord inférieur du signal dans la cascade
- activez la réduction de bruit si nécessaire

### LSB (bande latérale inférieure)

**Utilisé pour :**
- le radioamateurisme HF (en dessous de 10 MHz)
- certains modes numériques HF
- les communications maritimes (en dessous de 8 MHz)

**Caractéristiques :**
- identique à l'USB mais en image miroir
- convention : LSB sur les bandes HF basses

**Bonnes pratiques :**
- utilisez l'AGC lente (Slow)
- accordez-vous sur le bord supérieur du signal dans la cascade
- activez la réduction de bruit si nécessaire

### CW (onde entretenue / code Morse)

**Utilisé pour :**
- la télégraphie radioamateur
- les balises de radionavigation
- les stations de signaux horaires

**Caractéristiques :**
- bande passante très étroite (100-500 Hz)
- grande efficacité
- nécessite d'apprendre le code Morse pour être compris

**Bonnes pratiques :**
- utilisez un filtre étroit (400-500 Hz)
- accordez-vous précisément sur le centre de la tonalité
- activez le filtre audio pour une meilleure tonalité

### CW-L (CW, bande latérale inférieure)

Le même filtre morse de ±250 Hz que **CW**, mais la tonalité est prise sous la porteuse au lieu d'au-dessus. Utile lorsqu'un signal se copie mieux du côté bas, ou lorsqu'une porteuse brouilleuse se trouve juste au-dessus de celle visée.

**Il n'y a pas de bouton CW-L sur la page de bureau.** Sa rangée de modes est `USB · LSB · CW · AM · QUAM · FM · IQ`. CW-L est proposé sur la page simplifiée `/mobile` ; sur le bureau il reste accessible par un lien ou un signet qui le nomme.

Les liens écrits pour KiwiSDR ou UberSDR fonctionnent aussi : `modulation=CWU` (ou `CW-U`) ouvre en CW et `modulation=CWL` en CW-L.

### WBFM (FM à large bande)

**Utilisé pour :**
- la radiodiffusion FM (88-108 MHz)
- certaines liaisons descendantes satellite

**Caractéristiques :**
- bande passante très large (200 kHz)
- excellente qualité audio
- haute fidélité

**Bonnes pratiques :**
- accordez-vous exactement sur la fréquence centrale
- aucun squelch nécessaire pour la radiodiffusion
- profitez d'un son de haute qualité !

### IQ (I/Q brut)

**Utilisé pour :**
- enregistrer un morceau de la bande pour le relire plus tard dans HDSDR, SDR#, SDR++ ou SDRuno
- écouter avec un autre logiciel — un client KiwiSDR peut aussi le demander

**Caractéristiques :**
- 12 kHz de la bande centrés sur l'accord, en I et Q — entendus en stéréo, I à gauche et Q à droite, comme un KiwiSDR les joue. Cela sonne comme un souffle : c'est le signal avant toute démodulation
- transmis sans perte (FLAC), jamais en Opus, qui détruirait l'I/Q
- le niveau suit la bande : le bruit reste discret (environ −45 dBFS) et une station forte est amenée vers −20 dBFS. NR, NB, NS, AN, AI et le squelch ne s'appliquent pas, et choisir IQ arrête tout décodeur en cours
- **Audio** sous *Recording Options* enregistre l'I/Q ; à l'arrêt, **Download IQ** l'enregistre en fichier WAV (16 bits stéréo, 12 kHz) nommé par exemple `PhantomSDR_20261026_031500Z_6030000Hz_IQ.wav`. HDSDR, SDR# et SDRuno lisent la fréquence et l'heure dans le fichier, SDR++ dans le nom : l'enregistrement s'ouvre déjà accordé
- c'est la station qui décide : le bouton n'apparaît que là où `[server] iq` est activé (le réglage par défaut)

**Bonnes pratiques :**
- placez la station voulue au milieu — l'enregistrement couvre ±6 kHz autour de l'accord
- pour écouter une station, un mode normal est plus simple ; IQ sert à enregistrer, aux autres logiciels et à écouter plusieurs stations à la fois (ci-dessous)

#### Démodulateurs IQ

Tant que le récepteur est en IQ, un panneau **IQ Demodulators** s'ouvre sous les décodeurs. Il fait tourner jusqu'à six récepteurs sur l'I/Q dans votre navigateur — le récepteur n'est pas réaccordé et l'ordinateur de la station n'a rien de plus à faire :

- L'image montre les 12 kHz autour de l'accord avec les fréquences réelles ; chaque démodulateur est une bande de couleur, son propre accord une ligne à l'intérieur. Un clic sur l'image y place le démodulateur sélectionné ; la molette de la souris au-dessus le déplace de 10 Hz (Maj 100 Hz)
- Chaque ligne porte le mode (USB, LSB, CW, AM, DSB, FM), la fréquence avec les boutons « ‹ › » (100 et 10 Hz), une barre de niveau, **M** pour couper le son et **✕** pour supprimer. La ligne sélectionnée a en plus **Width**, **Volume** et **Pan**
- **DSB** suit la porteuse d’elle-même (une boucle de poursuite de porteuse) : placée à quelques dizaines de Hz de la porteuse, l’audio reste propre et stable, en DSB à porteuse supprimée comme en AM, où elle fait office d’AM synchrone
- **+ Add** ajoute un démodulateur sur l'accord, jusqu'à six. **Demodulators** / **Raw I/Q** choisit si vous les entendez ou l'I/Q brut
- Ils sont placés par rapport à l'accord : réaccorder le récepteur les déplace tous ensemble ; une station à plus de 6 kHz de l'accord n'est pas dans le flux
- Exemple : une station DX en split — un démodulateur LSB sur le DX, à gauche, et un sur les appelants quelques kHz plus haut, à droite
- Votre navigateur retient vos démodulateurs. Les filtres de bruit (NR, NB, NS, AN, AI) n'agissent pas en IQ : réduisez plutôt **Width**

---

## Décodeurs numériques

PhantomSDR-Plus intègre des décodeurs pour les modes numériques. Pour un guide complet, voir [Décodeurs](DECODERS.md).

Le plus rapide est la rangée de boutons **Decoders** du panneau principal, juste sous **Wheel Tuning Steps** : dix boutons — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, FLDIGI** — qui, en une seule pression, démarrent leur décodeur, basculent l'interrupteur principal Decoder sur ON et amènent la fenêtre du décodeur à l'écran. Le bouton reste bleu tant que le décodeur tourne ; appuyez de nouveau pour l'arrêter et fermer sa fenêtre. Le menu déroulant **Decoder Options** fonctionne exactement comme avant et reste synchronisé avec les boutons.

**RADE-v2U**, **RADE-v1L** et **RADE-v1U** (voix numérique RADE) disposent de leurs propres boutons à côté du titre **Modes** ainsi que dans les fenêtres **Modes** et **Bands**, et fonctionnent de la même manière : une pression pour démarrer, une seconde pour arrêter. **RADE-v2U** lance RADE V2 (beta), toujours en USB ; **RADE-v1L** et **RADE-v1U** lancent RADE v1.

Les décodeurs SSTV, FAX HF, NAVTEX, FSK/RTTY et CW s'exécutent chacun sur leur propre thread d'arrière-plan : activer ou désactiver un décodeur n'interrompt jamais l'audio, et la cascade reste fluide pendant le décodage. Ils reçoivent l'audio prélevé avant la réduction de bruit et la coupure du son de votre navigateur — vous pouvez couper le son du récepteur, le décodage se poursuit sans être affecté. Tant qu'un décodeur est ouvert, l'AGC est maintenue sur Slow pour que le gain reste stable pour lui.

**Tant qu'un décodeur tourne, il conserve le mode et la bande passante.** Normalement le mode suit le plan de bande : accordez dans un segment marqué LSB ou AM et le récepteur bascule. Un décodeur en marche l'emporte sur ce comportement et garde le mode et la bande passante étroite qu'il lui faut, même si vous partez sur une autre bande. Le mode propre à la bande revient dès que vous arrêtez le décodeur, et les boutons de mode restent utilisables à tout moment si vous voulez reprendre la main. Le décodeur CW fait exception : il décode dans le mode où vous écoutez.

### Décodeur FT8, FT4

**Qu'est-ce que FT8, FT4 ?**
- mode numérique radioamateur très répandu
- communication à signaux faibles
- transmissions de 15 secondes pour FT8, de 7,5 secondes pour FT4

**Comment l'utiliser :**
1. Accordez-vous sur les fréquences FT8 ou FT4
2. Sélectionnez le mode USB
3. Activez le décodeur FT8 — appuyez sur le bouton **FT8** ou choisissez-le depuis le menu
4. Observez l'apparition des messages décodés

**Fréquences FT8 courantes (USB) :**
- 160 mètres : 1.840 MHz
- 80 mètres : 3.573 MHz
- 60 mètres : 5.357 MHz
- 40 mètres : 7.074 MHz
- 30 mètres : 10.136 MHz
- 20 mètres : 14.074 MHz
- 17 mètres : 18.100 MHz
- 15 mètres : 21.074 MHz
- 12 mètres : 24.915 MHz
- 10 mètres : 28.074 MHz
- 6 mètres : 50.313 MHz (50.323 MHz pour le DX)

**Fréquences FT4 courantes (USB) :**

- 80 m : 3.575 MHz
- 40 m : 7.0475 MHz
- 30 m : 10.140 MHz
- 20 m : 14.080 MHz
- 17 m : 18.104 MHz
- 15 m : 21.140 MHz
- 12 m : 24.919 MHz
- 10 m : 28.180 MHz
- 6 m : 50.318 MHz

---

### Décodeur JS8

**Qu'est-ce que JS8 ?**
- Le moteur signal faible de FT8, utilisé pour converser au clavier
- Du texte libre au lieu d'échanges figés : les messages longs arrivent sur plusieurs cycles
- Cinq vitesses ; **Normal** (15 s) est la vitesse d'appel et porte presque tout le trafic

**Utilisation :**
1. Accordez-vous sur une fréquence JS8
2. Choisissez le mode **USB**
3. Activez le décodeur JS8 — bouton **JS8** ou depuis le menu
4. Laissez **Speed** sur *Normal* et le sync offset sur **Auto**

**Lire le panneau :**
- Les messages en cours d'arrivée s'affichent en haut en vert avec un curseur clignotant — en Normal, un message peut demander une minute entière
- Les messages terminés se listent en dessous sous la forme `Mode | Hz | dB | Message`, **indicatifs en vert**
- Une ligne grisée et en italique a expiré avant sa dernière trame : le texte est authentique mais peut être tronqué

**Fréquences JS8 courantes (USB) :**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 est bien plus calme que FT8 : une émission toutes les quelques minutes est normale, et les silences ne sont pas une panne. Guide complet : [Décodeurs](DECODERS.md).

---

### Décodeur CW
Appuyez simplement sur le bouton CW et le texte décodé apparaîtra. Appuyez de nouveau sur le bouton CW pour effacer la fenêtre et redémarrer le décodeur.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, prononcé « whisper ») est un mode balise à signaux ultra-faibles qui cartographie les chemins de propagation HF dans le monde entier. Chaque transmission dure environ 110 secondes et tient dans un créneau de 200 Hz de large. Le décodeur attend un créneau complet de 2 minutes aligné sur l'UTC avant de décoder. Activez le décodeur et sélectionnez **WSPR** dans la liste déroulante. Ou appuyez simplement sur le bouton **WSPR**.

---

### FAX HF / WEFAX

Le radiofax HF (également appelé WEFAX) est utilisé par les garde-côtes et les services météorologiques du monde entier pour diffuser des cartes météo, des cartes d'état de la mer et des analyses de surface en ondes courtes. Le décodeur reconstitue l'image ligne par ligne au fur et à mesure de sa réception.

---

### NAVTEX

NAVTEX est le système international de diffusion maritime des informations de sécurité côtière — avertissements de navigation, prévisions météorologiques et avis de recherche et de sauvetage.

---

### FLDIGI — RTTY, PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet et APRS

Une fenêtre pour les modes clavier à bande étroite que fldigi a popularisés, avec treize variantes : FSK maritime (SITOR), RTTY météo, RTTY amateur, **PSK31** (modulation par déplacement de phase, 31,25 bauds), **Olivia** et **MFSK16/32/64** (multitons avec correction d'erreurs), **DominoEX** et **THOR** (sauts de fréquence incrémentaux, THOR avec correction d'erreurs), **THROB**, **Hellschreiber** (peint comme une image), **MT63** (64 porteuses), **Packet (AX.25)** et **APRS**. Elle s'ouvre par le bouton **FLDIGI**, ou par **FLDIGI** dans le menu des décodeurs ; fldigi lui-même n'est pas nécessaire. Le panneau s'adapte à la variante — les commandes de shift, de bauds et de trame disparaissent pour toutes sauf les trois FSK, et les autres modes ajoutent un sélecteur Mode et, sauf Hellschreiber, un curseur de squelch.

Le RTTY amateur et le RTTY météo ont un curseur **Squelch (SNR)** qui empêche le bruit de s'afficher en lettres aléatoires, et toutes les variantes sauf Olivia affichent un vrai SNR sur la même échelle de 3 kHz. Deux points à retenir : PSK31 corrige lui-même son erreur d'accord sur environ ±25 Hz, il suffit donc de s'approcher ; Olivia exige que **Mode** (tonalités / largeur de bande) corresponde exactement à l'émission, n'envoie pas de préambule et met donc quelques secondes à se synchroniser avant que du texte apparaisse. Le panneau s'ouvre sur Olivia **8 / 250**. Pour les autres modes de fldigi, placez le signal sur la fréquence centrale ou appuyez sur **⟳ Auto-tune Center** et choisissez le bon **Mode** : THROB demande un accord à ±3 Hz près, DominoEX, THOR et MT63 pardonnent bien davantage, et MFSK, THOR et MT63 affichent le texte quelques secondes après le signal. Hellschreiber affiche une image, pas du texte.

**Packet** affiche chaque trame AX.25 entendue, comme un moniteur de TNC ; **APRS** transforme les paquets APRS en texte clair — position avec locator, vitesse, altitude, météo, messages, objets et état. Choisissez la **Speed** : **1200 Bd** pour les VHF/UHF, qui passe le récepteur en **FM** sur le canal (le 144,800 MHz européen est dans la liste des fréquences), ou **300 Bd** pour les HF, en USB. Seuls les paquets dont la somme de contrôle est correcte sont affichés, donc rien n'apparaît sur un canal calme. Sous le texte, une carte montre chaque station entendue avec une position, avec des traces pour celles qui se déplacent et votre récepteur en ambre ; elle peut être réduite, et un clic sur une ligne décodée centre la carte sur cette station. Voir le [manuel des décodeurs](DECODERS.md#notes-sur-packet-et-aprs).

---

### Grabber QRSS

La QRSS est de la CW envoyée si lentement qu'un seul point dure plusieurs secondes ; elle se regarde plutôt qu'elle ne s'écoute — le grabber trace le signal sur son propre affichage. Il ne figure pas dans le menu des décodeurs : il a sa propre section **QRSS** et peut tourner en même temps qu'un décodeur.

Cliquez sur **🐌 Show**, choisissez ensuite une fenêtre dans la liste **Band** et appuyez sur **Tune** : le récepteur se place sur cette fréquence en **CW**, avec une bande passante taillée pour le mode, et la trace tombe sur la ligne centrale de l'affichage. La fenêtre la plus fréquentée est celle du 30 m (10 140,00 kHz). Réglez **Speed** sur la balise — **QRSS 10** si vous l'ignorez — et soyez patient : un indicatif peut mettre dix minutes à traverser l'écran. Tous les détails dans [Décodeurs](DECODERS.md).

---

### SSTV

La télévision à balayage lent transmet des images fixes sur un canal BLU ordinaire, une ligne à la fois. Activez le décodeur, sélectionnez **SSTV** et accordez-vous sur une fréquence SSTV — 14.230 MHz est la principale fréquence d'appel internationale. Laissez **Mode** sur **Auto** : le décodeur lit l'en-tête VIS de la transmission et, si vous vous êtes accordé après l'en-tête, identifie le mode d'après la synchronisation. Les modes Martin, Scottie et Robot sont pris en charge, et l'image se construit ligne par ligne à mesure qu'elle arrive. Ou appuyez simplement sur le bouton **SSTV**.

### Report automatique des spots et graphiques du serveur

Les décodages FT8, FT4 et WSPR peuvent aussi être téléversés par le serveur lui-même — FT8/FT4 vers PSK Reporter, WSPR vers WSPRnet — par un démon autorun que le sysop démarre depuis le panneau d'administration. Il est indépendant des décodeurs de votre navigateur : il continue de tourner qu'il y ait des auditeurs ou non, et rien de ce que vous décodez dans le navigateur n'est rapporté.

Le sysop le suit à l'aide de deux compteurs, faciles à confondre : les tuiles par décodeur comptent les spots téléversés depuis le dernier démarrage du démon, tandis que le nombre à côté de chaque case bande/mode est le total depuis toujours de cet emplacement et survit aux redémarrages. Le même panneau propose une page **Graphiques** traçant la fréquence du processeur, la charge, la température et les utilisateurs connectés sur les 15 dernières minutes à 24 heures. Les deux sont décrits dans le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md).


---

## Raccourcis clavier

Raccourcis clavier pour une utilisation plus rapide.

---

### Commande de fréquence

Les **touches fléchées** accordent depuis n'importe où sur la page :

- **Flèche haut / bas** : ±10 Hz ; avec **Shift** ±1 kHz, avec **Ctrl** (ou **Cmd**) ±100 kHz, avec **Shift + Ctrl** ±1 MHz
- **Flèche gauche / droite** : ±100 Hz ; avec **Shift** ±10 kHz, avec **Ctrl** (ou **Cmd**) ±500 kHz, avec **Shift + Ctrl** ±10 MHz
- **Ctrl droit** : supprime la partie décimale et accorde sur le kHz entier égal ou inférieur à la fréquence actuelle

Dans la zone de chat, gauche / droite déplacent le curseur à la place.

**Souris sur l'affichage de fréquence** : placez le pointeur sur un chiffre ; molette vers le haut ou clic gauche l'augmente, molette vers le bas ou clic droit le diminue, chaque fois de la valeur de position du chiffre (neuf chiffres, de 100 MHz à 1 Hz). Entre les chiffres, la molette avance du pas d'accord de la bande (1 kHz sauf indication du plan de bandes) ; **Shift** pour 1 kHz, **Alt** pour 10 kHz. Un clic ailleurs dans le cadre noir fréquence / S-mètre ouvre le pavé numérique (Méthode 2 dans *S'accorder sur une fréquence*).

**Molette au-dessus de la cascade** : zoome. Maintenez **Ctrl** (ou **Cmd**) ou **Shift** pour accorder au lieu de zoomer, et **Shift + Ctrl** ensemble pour caler sur le kHz entier le plus proche.

> Il n'y a pas de raccourcis Page précédente / Page suivante.

---

## Favoris

Enregistrez vos fréquences préférées pour y accéder rapidement. Vous pouvez aussi exporter la liste des favoris et la sauvegarder localement, puis l'importer dans n'importe quel autre PhantomSDR.

Lorsque favoris et marqueurs se chevauchent :

🔵 Les favoris bleus apparaissent au-dessus <br /> 🟡 Les marqueurs jaunes apparaissent en dessous <br />
✅ Les clics sur les favoris sont prioritaires <br />


### Ajouter un favori

1. Accordez-vous sur la fréquence souhaitée
2. Cliquez sur le bouton « Bookmarks »
3. Cliquez sur « Add Bookmark »
4. Saisissez une description
5. Cliquez sur « Save »

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Comment l'utiliser :

**Ajouter un favori :**
- Nom : « Local News Station »
- Étiquette : « NEWS »
- Cliquez sur Add

**Affichage dans la cascade :**
- zoomez jusqu'à ce que les marqueurs apparaissent
- vous verrez un cadre bleu marine avec « NEWS » en jaune gras

**Cliquer sur un favori :**
- s'accorde sur la fréquence
- règle le mode de démodulation
- fonctionne exactement comme un clic sur un marqueur

### Gérer les favoris
- **Modifier** : cliquez sur l'icône crayon à côté du favori
- **Supprimer** : cliquez sur l'icône corbeille à côté du favori
- **Exporter** : téléchargez les favoris sous forme de fichier JSON
- **Importer** : envoyez des favoris depuis un fichier JSON

### Partager des favoris

1. Cliquez sur « Export Bookmarks »
2. Partagez le fichier JSON avec d'autres personnes
3. Les destinataires cliquent sur « Import Bookmarks »
4. Ils sélectionnent votre fichier
---

## Utilisation sur mobile

PhantomSDR-Plus fonctionne très bien sur les appareils mobiles !

### Deux vues mobiles

Il y a deux façons d'utiliser le récepteur sur un téléphone :

- **`http://votre_serveur:PORT/mobile`** — la page simplifiée. Pas de cascade, donc environ moitié moins de données. Saisie de fréquence, pas d'accord, modes, S-mètre, bandes, favoris, utilisateurs et chat.
- **La vue étendue** — la disposition téléphone de l'interface principale, avec la cascade et l'ensemble des commandes.

On passe de l'une à l'autre avec les boutons en bas de `/mobile` (**Mobile extended view**, **Full desktop view**) et avec **Simplified mobile** dans la vue étendue.

**Votre fréquence vous suit.** Changer de vue vous laisse sur le même signal — la fréquence et le mode voyagent dans le lien, vous n'atterrissez donc plus sur la fréquence par défaut du récepteur. La barre d'adresse suit également votre accord : recharger la page, la mettre en favori ou envoyer le lien à quelqu'un ramènent exactement à cette fréquence.

**Le mode suit le plan de bande sur les deux pages.** Accordez-vous sur un segment déclaré AM, LSB, USB ou CW — en saisissant une fréquence, en avançant par pas ou en appuyant sur un bouton de bande — et le récepteur bascule sur ce mode, sur la page simplifiée comme dans l'interface complète. Un mode choisi à la main est conservé tant que vous vous déplacez à l'intérieur du même segment, et hors des bandes définies votre mode n'est pas touché. Tant que **RADE** (RADEL/RADEU) tourne, il garde le récepteur : s'accorder ne l'interrompt pas.

Lors d'un changement de vue, votre mode actuel vous accompagne ; si la vue d'arrivée n'a pas d'équivalent, le plan de bande décide pour cette fréquence — une fréquence de radiodiffusion arrive en AM, le 40 m en LSB, un segment CW en CW. `SAM` sur la page simplifiée devient AM avec le détecteur synchrone dans la vue étendue, et inversement. `RADEL` et `RADEU` n'existent que sur la page simplifiée : en la quittant, la fréquence est conservée et le plan de bande choisit le mode.

Une fréquence hors de la couverture du récepteur est ramenée au bord le plus proche : un ancien lien ne peut donc jamais vous laisser hors bande.

### Fonctions propres au mobile

- **Commandes tactiles** : grands boutons et curseurs
- **Balayage pour s'accorder** : balayez vers la gauche/droite sur la cascade
- **Pincement pour zoomer** : pincez la cascade pour zoomer/dézoomer
- **Mode paysage** : tournez l'appareil pour une meilleure vue
- **Spectre et cascade à la taille du téléphone** : dans la vue étendue, ils sont plus hauts que ne le donneraient les proportions du bureau

### Conseils pour mobile

1. **Utilisez le Wi-Fi** : la diffusion audio consomme des données
2. **Orientation paysage** : meilleure vue de la cascade
3. **Écouteurs** : meilleure qualité audio
4. **Enregistrez vos favoris** : plus facile de revenir sur des stations
5. **Fermez les autres applications** : garantit des performances fluides

### Navigateurs mobiles recommandés

- **Android** : Chrome ou Samsung Internet
- **iOS** : Mozilla
- **Les deux** : veillez à ce que le navigateur soit à jour

---

## Conseils et bonnes pratiques

### Pour une réception optimale

1. **Choisissez des signaux forts** : cherchez l'orange/rouge dans la cascade
2. **Accordez-vous précisément** : cliquez au centre du signal
3. **Sélectionnez le bon mode** : adaptez-le au type de signal
4. **Réglez l'AGC** : rapide pour l'AM, lente pour la BLU
5. **Utilisez NR/NB** : utile en conditions bruyantes

### Trouver de l'activité

1. **Observez la cascade** : les couleurs indiquent la force des signaux
2. **Écoutez sur les fréquences populaires** :
   - 40 m : 7.100-7.300 MHz (LSB)
   - 20 m : 14.200-14.350 MHz (USB)
   - 2 m : 145.200-145.600 MHz (FM)
3. **Consultez la superposition du plan de bandes** : elle montre les attributions de fréquences
4. **Utilisez les favoris** : accès rapide aux fréquences actives

### Comprendre les conditions de propagation

**HF de jour (hautes fréquences) :**
- les bandes hautes fonctionnent mieux (20 m, 15 m, 10 m)
- communications à longue distance (DX) possibles
- stations de radiodiffusion audibles

**HF de nuit :**
- les bandes basses fonctionnent mieux (80 m, 40 m)
- schémas de propagation différents
- stations différentes audibles

**VHF/UHF :**
- principalement à vue directe
- communications locales
- conditions plus stables

### Savoir-vivre

1. **Ne monopolisez pas le récepteur** : d'autres veulent aussi écouter
2. **Utilisez le chat avec respect** : soyez courtois envers les autres utilisateurs
3. **Signalez les problèmes** : aidez l'opérateur à entretenir la station
4. **Ne demandez pas d'assistance technique** : c'est une plateforme d'écoute. Envoyez un message au SysOp pour obtenir de l'aide.

---

## Dépannage

### Aucun son

**Causes possibles :**
1. Navigateur en sourdine → vérifiez les commandes de volume du navigateur
2. Système en sourdine → vérifiez le volume de l'ordinateur
3. Signal faible → accordez-vous sur un signal plus fort (S7+)
4. Mauvais mode → essayez d'autres modes de démodulation

**Solutions :**
1. Cliquez sur un signal fort (orange/rouge dans la cascade)
2. Vérifiez que le navigateur n'est pas en sourdine (icône de coupure dans l'onglet)
3. Essayez une autre fréquence
4. Rechargez la page (F5)

### Son déformé

**Causes possibles :**
1. Signal saturé → signal trop fort
2. Mauvais mode → signal AM écouté en BLU, etc.
3. Interférences → signaux adjacents qui débordent

**Solutions :**
1. Baissez le volume
2. Essayez un autre mode de démodulation
3. Utilisez un filtre plus étroit
4. Éloignez-vous des signaux perturbateurs

### Le son se coupe ou traîne

**Causes possibles :**
1. Connexion irrégulière → les paquets arrivent en retard et le tampon se vide
2. Téléphone ou ordinateur surchargé → le navigateur ne suit pas

**Solutions :**
1. Montez le tampon d'un cran (voir *Tampon audio et retard*)
2. Préférez le Wi-Fi ou le câble aux données mobiles
3. Fermez les autres onglets et applications

Pour y regarder de plus près, ouvrez la page en ajoutant `?diag=1` à son adresse (par exemple `http://your_server:PORT/mobile?diag=1`). La page /mobile affiche alors sous ses commandes le retard, l'irrégularité de la connexion et l'état du tampon ; la page de bureau écrit la même ligne dans la console du navigateur (F12) toutes les dix secondes. Utile pour signaler un problème à l'opérateur de la station.

### La cascade ne se met pas à jour

**Causes possibles :**
1. Problème réseau → connexion lente ou interrompue
2. Performances du navigateur → trop d'onglets ouverts
3. Serveur surchargé → trop d'utilisateurs

**Solutions :**
1. Vérifiez votre connexion Internet
2. Fermez les onglets inutiles
3. Rechargez la page (F5)
4. Réessayez plus tard, quand il y a moins d'utilisateurs

### Impossible de s'accorder sur une fréquence

**Causes possibles :**
1. Fréquence hors plage → le SDR ne couvre pas cette fréquence
2. Format de saisie incorrect → utilisez le bon format (p. ex. « 14200 » et non « 14.200.000 »)

**Solutions :**
1. Vérifiez la couverture en fréquence du SDR (indiquée sur la page)
2. Utilisez les exemples de format de fréquence fournis
3. Cliquez plutôt dans la cascade

### Son haché ou saccadé

**Causes possibles :**
1. connexion Internet lente
2. charge élevée du serveur
3. problèmes de performances du navigateur

**Solutions :**
1. Fermez les autres applications qui consomment de la bande passante
2. Réessayez en dehors des heures de pointe
3. Fermez les onglets inutiles
4. Utilisez une connexion filaire plutôt que le Wi-Fi

---

## Foire aux questions

### Questions générales

**Q : Ai-je besoin d'un équipement spécial pour utiliser un WebSDR ?**
R : Non ! Juste un ordinateur ou un appareil mobile connecté à Internet.

**Q : L'utilisation du WebSDR est-elle gratuite ?**
R : Oui, la plupart des WebSDR sont gratuits. Ils sont exploités par des bénévoles.

**Q : Puis-je émettre avec un WebSDR ?**
R : Non, le WebSDR est uniquement en réception. Vous ne pouvez pas émettre.

**Q : Quelles fréquences puis-je écouter ?**
R : Cela dépend de la configuration du WebSDR. Consultez les informations de la station.

**Q : Puis-je enregistrer l'audio ?**
R : Certains navigateurs permettent l'enregistrement. Vérifiez les fonctions de votre navigateur.

### Questions techniques

**Q : Quel taux d'échantillonnage le SDR utilise-t-il ?**
R : Cela varie selon la station. Consultez la page d'informations de la station.

**Q : Quelle est la latence ?**
R : En général quelques dixièmes de seconde entre le signal radio et vos haut-parleurs : le traitement dans le récepteur, le réseau et le tampon de lecture du navigateur, qui s'adapte à votre connexion (environ 100–150 ms sur un téléphone en Wi-Fi domestique). Voir *Tampon audio et retard*.

**Q : Puis-je ouvrir plusieurs instances ?**
R : En général oui, mais cela peut solliciter le serveur. Soyez prévenant.

**Q : Cela fonctionne-t-il hors ligne ?**
R : Non, le WebSDR nécessite une connexion Internet.

**Q : Quels navigateurs sont pris en charge ?**
R : Chrome, Firefox, Edge, Safari (toutes versions récentes)

### Questions d'utilisation

**Q : Combien de personnes peuvent écouter en même temps ?**
R : Cela dépend de la capacité du serveur. Souvent 50 à 200 utilisateurs ou plus.

**Q : Puis-je voir ce que les autres écoutent ?**
R : Si la fonction est activée, oui. Cherchez les indicateurs « autres utilisateurs ».

**Q : Puis-je discuter avec les autres auditeurs ?**
R : Si l'opérateur l'a activé. Cherchez la zone de chat ; **↪ Reply** répond à un message précis (voir *Chat* plus haut).

**Q : Pourquoi certaines fréquences n'affichent-elles rien ?**
R : Aucun signal sur cette fréquence pour le moment. Essayez-en d'autres !

**Q : Que sont les bandes colorées sur la cascade ?**
R : La superposition du plan de bandes, qui montre les attributions de fréquences.

---

## Ressources

### Pour en savoir plus sur la radio

- **Plans de bandes** : recherchez « amateur radio band plan » + votre région
- **Propagation** : renseignez-vous sur la propagation des ondes HF
- **Modes numériques** : documentez-vous sur FT8, PSK31, RTTY
- **Radioamateurisme** : pensez à passer une licence radioamateur !

### Trouver d'autres WebSDR

- **Annuaire WebSDR** : http://sdr-list.xyz
- **WebSDR.org** : http://websdr.org
- **KiwiSDR** : http://kiwisdr.com/public/

### Obtenir de l'aide

1. **Opérateur de la station** : coordonnées indiquées sur la page
2. **Chat des utilisateurs** : demandez aux autres auditeurs (si disponible)
3. **Forums en ligne** : cherchez des communautés WebSDR
4. **Documentation** : reportez-vous à ce guide !

---

## Annexe : fréquences courantes

### Bandes radioamateurs HF

| Bande | Plage de fréquences | Mode | Activité |
|-------|---------------------|------|----------|
| 160 m | 1.800-2.000 MHz | LSB | Nuit/local |
| 80 m | 3.500-4.000 MHz | LSB | Nuit/régional |
| 40 m | 7.000-7.300 MHz | LSB | Jour/nuit/DX |
| 30 m | 10.100-10.150 MHz | USB | Données/CW uniquement |
| 20 m | 14.000-14.350 MHz | USB | Jour/DX |
| 17 m | 18.068-18.168 MHz | USB | Jour/DX |
| 15 m | 21.000-21.450 MHz | USB | Jour/DX |
| 12 m | 24.890-24.990 MHz | USB | Jour/DX |
| 10 m | 28.000-29.700 MHz | USB | Sporadique/DX |

### Bandes radioamateurs VHF/UHF

| Bande | Plage de fréquences | Mode | Activité |
|-------|---------------------|------|----------|
| 6 m | 50.000-54.000 MHz | USB/FM | Sporadique |
| 2 m | 144.000-148.000 MHz | FM | Très active |
| 70 cm | 420.000-450.000 MHz | FM | Active |

### Bandes de radiodiffusion

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| Radio AM | 530-1710 kHz | AM |
| Ondes courtes | 2.3-26.1 MHz | AM |
| Radio FM | 88-108 MHz | WBFM |

### Aviation

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| Contrôle du trafic aérien | 118-137 MHz | AM |
| ACARS (données) | 130-136 MHz | Données |

### Maritime

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| VHF marine | 156-162 MHz | FM |
| HF marine | 2-22 MHz | USB |

---

## Glossaire

**AGC** : contrôle automatique de gain — ajuste automatiquement les niveaux audio

**AM** : modulation d'amplitude — mode phonie utilisé en aviation et en radiodiffusion

**Bande passante** : la plage de fréquences occupée par un signal

**CW** : onde entretenue — signaux en code Morse

**DX** : communication à longue distance

**FFT** : transformée de Fourier rapide — convertit le domaine temporel en domaine fréquentiel

**FLDIGI** : la fenêtre de décodage pour RTTY, PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet et APRS, nommée d'après le logiciel fldigi qui a popularisé ces modes

**FM** : modulation de fréquence — mode phonie pour la VHF/UHF

**HF** : hautes fréquences (3-30 MHz) — bandes à longue portée

**kHz** : kilohertz (1 000 Hz)

**LSB** : bande latérale inférieure — mode phonie pour les bandes HF basses

**MHz** : mégahertz (1 000 000 Hz)

**NB** : silencieux d'impulsions — supprime le bruit impulsionnel

**NR** : réduction de bruit — atténue le bruit de fond

**PSK** : modulation par déplacement de phase — mode numérique

**RTTY** : télétype radio — mode texte numérique

**S-mètre** : indicateur de force du signal

**SDR** : radio logicielle

**SQL** : squelch — coupe l'audio en l'absence de signal

**BLU (SSB)** : bande latérale unique (USB ou LSB)

**USB** : bande latérale supérieure — mode phonie pour les bandes HF hautes

**VHF** : très hautes fréquences (30-300 MHz) — propagation à vue directe

**UHF** : ultra hautes fréquences (300-3000 MHz) — propagation à vue directe

**Cascade** : affichage visuel du spectre radio au fil du temps

---

**Bonne exploration du spectre radio avec PhantomSDR-Plus !**

**73 (meilleures salutations) de SV1BTL, 9A7AOF, F1NSK & SV2AMK**

Pour les instructions d'installation, voir [INSTALLATION.md](INSTALLATION.md). Pour les détails techniques, voir [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
