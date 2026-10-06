# Accès sécurisé — https://

Une station PhantomSDR-Plus peut être joignable en **https://** aussi bien qu'en http://. Le navigateur affiche alors le cadenas, la connexion est chiffrée, et les navigateurs accordent à la page leur meilleur chemin audio (l'AudioWorklet), qu'ils refusent aux simples pages http. L'adresse http continue de fonctionner exactement comme avant, côte à côte.

C'est **Caddy** qui s'en charge, un petit serveur web placé devant le récepteur sur le port 443. Caddy obtient un certificat gratuit auprès de **Let's Encrypt** pour le nom DNS de votre station et le renouvelle tout seul, tous les quelques mois, sans que vous ayez quoi que ce soit à faire.

---

## Ce qu'il vous faut

| | |
|---|---|
| **Un nom DNS** | Let's Encrypt certifie des noms, pas de simples adresses IP. Un nom de DNS dynamique gratuit (no-ip, DuckDNS, dynu et autres) pointant vers votre adresse publique suffit, et l'adresse peut changer — le nom la suit. |
| **Deux ports de plus sur le routeur** | Redirigez TCP **443** (https) et TCP **80** vers l'ordinateur du récepteur, en plus de votre port public (9000). Le port 80 sert seulement à prouver à Let's Encrypt que le nom est à vous lors de l'émission et du renouvellement du certificat. |
| **Une station configurée avec les questions de la station** | `station.conf` doit exister. Sur une station installée avant les questions de la station, lancez d'abord une fois `bash configure-station.sh` : il propose les ports que votre station utilise déjà, donc rien ne bouge. |

---

## L'activer

### À l'installation

Parmi les questions de la station, dans le groupe **Internet**, répondez oui à :

```
  Also serve the receiver over https://? [y/N]: y
```

L'installateur installe Caddy, obtient le certificat et affiche à la fin les deux adresses.

### Sur une station qui tourne déjà

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

Il lit votre nom DNS dans `station.conf`, installe Caddy (depuis votre distribution ; sous Ubuntu 22.04 depuis le dépôt de Caddy lui-même), le dirige vers le récepteur, reconstruit la page pour qu'elle pointe vers son adresse https, redémarre le proxy et attend le certificat. Répondre oui à la question https de `bash configure-station.sh` fait exactement la même chose.

À la fin :

```
  ✔ https://myname.ddns.net/ is live

  https://myname.ddns.net/   — and http://myname.ddns.net:9000/ as before
```

### Vérifier et désactiver

```bash
bash setup-https.sh --status    # est-ce actif, et le certificat répond-il ?
bash setup-https.sh --remove    # désactive https ; http reste exactement tel quel
```

Si vous changez plus tard le nom DNS avec `bash configure-station.sh`, Caddy passe tout seul au nouveau nom.

---

## Comment ça marche

```
  visitor ──https──► Caddy :443 ──► proxy.py :9014 (this computer only) ──► spectrumserver, panel, RADE …
  visitor ──http───────────────────► proxy.py :9000 ───────────────────────► the same
```

| Port | Quoi | Ouvert sur le routeur |
|---|---|---|
| 443 | Caddy — https | oui |
| 80 | Caddy — la vérification du certificat, et une redirection vers https | oui |
| 9000 | proxy.py — http, comme avant | oui |
| 9014 | proxy.py — là où Caddy remet les visiteurs | non — à l'intérieur de l'ordinateur |

Caddy rejoint le proxy par un port à lui parce que, vu du proxy, tout visiteur passant par Caddy semblerait sinon venir de l'ordinateur lui-même — et une requête de l'ordinateur lui-même est jugée fiable : elle peut déconnecter des auditeurs et n'est pas comptée dans les limites par IP. Sur le port 9014, le proxy prend auprès de Caddy l'adresse réelle du visiteur et ne traite jamais un visiteur comme local ; la liste des auditeurs, les limites par IP et le kick du sysop fonctionnent donc exactement comme en http, et personne ne peut expulser un auditeur par https.

---

## Ce qui change pour les auditeurs

- **Les deux adresses fonctionnent.** Les annuaires et la carte de websdr.org continuent d'afficher l'adresse http ; le rappel de websdr.org et les clients Kiwi utilisent http.
- **Meilleur son en https.** Les navigateurs donnent à une page sécurisée l'AudioWorklet, un chemin audio plus stable que celui que les simples pages http doivent utiliser.
- **Receive Diversity avec des partenaires uniquement http.** Un navigateur ne laisse pas une page https ouvrir de simples connexions `ws://` ; depuis la page https, on ne peut donc pas ajouter une station partenaire qui n'a que http. Les partenaires en https fonctionnent, et les partenaires WebSDR fonctionnent via le relais. Pour un partenaire uniquement http, utilisez l'adresse http de la page.
- **Commande du poste (TCI-CAT).** Les connexions vers `127.0.0.1` sur l'ordinateur de l'auditeur sont autorisées depuis une page https dans les versions actuelles de Chrome, Edge et Firefox.

---

## Réseau local uniquement — `--lan`

Sans nom DNS, https peut tout de même servir à la maison :

```bash
bash setup-https.sh --lan
```

Caddy émet alors son propre certificat pour l'adresse locale et le nom de l'ordinateur. Les navigateurs ne connaissent pas ce certificat et avertissent la première fois ; acceptez-le, ou faites en sorte que les ordinateurs que vous utilisez fassent confiance au certificat racine de Caddy :

- sur l'ordinateur du récepteur lui-même : `sudo caddy trust`
- sur un autre ordinateur : copiez `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` depuis le récepteur (le chemin exact est donné par `sudo caddy environ`, sous `caddy.AppDataDir`) et importez-le dans le navigateur ou le système comme autorité de confiance.

---

## Un serveur web tourne déjà sur cet ordinateur

Si nginx, Apache ou une autre configuration Caddy utilise déjà le port 443 ou 80, `setup-https.sh` ne le reprend pas : il s'arrête et affiche ce qu'il faut ajouter à votre serveur. Pour nginx, dans le bloc `server { … }` de votre site https :

```nginx
location / {
    proxy_pass http://127.0.0.1:9014;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1d;
}
```

Pour Apache (avec `mod_proxy`, `mod_proxy_http` et `mod_proxy_wstunnel`) :

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:9014/
```

Marquez ensuite la station comme https dans `station.conf`, pour que le proxy ouvre le port 9014 et que la page pointe vers son adresse https — l'assistant signalera encore que le port est occupé, ce qui est normal :

```bash
STATION_HTTPS=y bash configure-station.sh
```

---

## Dépannage

| Symptôme | À vérifier |
|---|---|
| `no certificate yet` | Le nom DNS doit pointer vers votre adresse publique (`ping myname.ddns.net` depuis l'extérieur de votre réseau), et le routeur doit rediriger 443 et 80 vers cet ordinateur. Caddy réessaie tout seul ; son journal : `sudo journalctl -u caddy -n 50`. |
| Le fournisseur bloque le port 80 | Caddy prouve aussi le nom par le seul port 443, donc 443 suffit le plus souvent ; laissez 80 redirigé si vous le pouvez. |
| `too many failed authorizations` dans le journal de Caddy | Let's Encrypt n'accepte que quelques échecs par heure. Corrigez la cause, attendez une heure, puis `sudo systemctl restart caddy`. |
| https marche à la maison mais pas de l'extérieur | Le routeur redirige 443 vers un autre ordinateur, ou pas du tout. |
| La liste des auditeurs ou le panneau des utilisateurs est vide en https | Lancez une fois `bash configure-station.sh` et acceptez la reconstruction : la page doit connaître son adresse https. |
| `Port 443 is already used by another web server` | Voir plus haut *Un serveur web tourne déjà sur cet ordinateur*. |
