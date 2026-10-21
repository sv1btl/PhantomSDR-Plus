# Siguran pristup — https://

Stanica PhantomSDR-Plus može biti dostupna preko **https://** jednako kao preko http://. Preglednik tada prikazuje lokot, veza je šifrirana, a preglednici stranici dopuštaju svoj bolji put zvuka (AudioWorklet), koji uskraćuju običnim http stranicama. Adresa http i dalje radi točno kao prije, jedna uz drugu.

To obavlja **Caddy**, mali web-poslužitelj postavljen ispred prijemnika na portu 443. Caddy od **Let's Encrypta** dobiva besplatan certifikat za DNS ime vaše stanice i sam ga obnavlja, svakih nekoliko mjeseci, a da vi ništa ne morate raditi.

---

## Što vam treba

| | |
|---|---|
| **DNS ime** | Let's Encrypt certificira imena, ne gole IP adrese. Dovoljno je besplatno ime dinamičkog DNS-a (no-ip, DuckDNS, dynu i slični) koje pokazuje na vašu javnu adresu, a adresa se smije mijenjati — ime je prati. |
| **Još dva porta na usmjerniku** | Proslijedite TCP **443** (https) i TCP **80** na računalo prijemnika, uz vaš javni port (9000). Port 80 služi samo tome da se Let's Encryptu dokaže da je ime vaše kad se certifikat izdaje i obnavlja. |
| **Stanica postavljena s pitanjima o stanici** | Mora postojati `station.conf`. Na stanici instaliranoj prije pitanja o stanici najprije jednom pokrenite `bash configure-station.sh` — predlaže portove koje vaša stanica već koristi, pa se ništa ne pomiče. |

---

## Uključivanje

### Pri instalaciji

Među pitanjima o stanici, u skupini **Internet**, odgovorite da na:

```
  Also serve the receiver over https://? [y/N]: y
```

Instalacijski program instalira Caddy, dobiva certifikat i na kraju prikazuje obje adrese.

### Na stanici koja već radi

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

Čita vaše DNS ime iz `station.conf`, instalira Caddy (iz vaše distribucije; na Ubuntu 22.04 iz Caddyjeva vlastitog repozitorija), usmjerava ga na prijemnik, ponovno gradi stranicu kako bi upućivala na svoju https adresu, ponovno pokreće proxy i čeka certifikat. Odgovor da na https pitanje u `bash configure-station.sh` radi točno isto.

Kad završi:

```
  ✔ https://myname.ddns.net/ is live

  https://myname.ddns.net/   — and http://myname.ddns.net:9000/ as before
```

### Provjera i isključivanje

```bash
bash setup-https.sh --status    # je li uključeno i odgovara li certifikat?
bash setup-https.sh --remove    # isključuje https; http ostaje točno kakav jest
```

Promijenite li kasnije DNS ime s `bash configure-station.sh`, Caddy sam prelazi na novo ime.

---

## Kako radi

```
  visitor ──https──► Caddy :443 ──► proxy.py :9014 (this computer only) ──► spectrumserver, panel, RADE …
  visitor ──http───────────────────► proxy.py :9000 ───────────────────────► the same
```

| Port | Što | Otvoren na usmjerniku |
|---|---|---|
| 443 | Caddy — https | da |
| 80 | Caddy — provjera certifikata i preusmjeravanje na https | da |
| 9000 | proxy.py — http, kao prije | da |
| 9014 | proxy.py — gdje Caddy predaje posjetitelje | ne — unutar računala |

Caddy doseže proxy kroz vlastiti port jer bi, gledano iz proxyja, svaki posjetitelj koji dolazi preko Caddyja inače dolazio sa samog računala — a zahtjevu sa samog računala vjeruje se: smije odspajati slušatelje i ne broji se u ograničenja po IP-u. Na portu 9014 proxy od Caddyja preuzima stvarnu adresu posjetitelja i nikad posjetitelja ne smatra lokalnim, pa popis slušatelja, ograničenja po IP-u i sysopov kick rade točno kao preko http-a, a nitko ne može izbaciti slušatelja preko https-a.

---

## Što se mijenja za slušatelje

- **Obje adrese rade.** Imenici i karta websdr.org i dalje prikazuju http adresu; povratni poziv websdr.org-a i Kiwi klijenti koriste http.
- **Bolji zvuk preko https-a.** Preglednici sigurnoj stranici daju AudioWorklet, stabilniji put zvuka od onoga koji moraju koristiti obične http stranice.
- **Receive Diversity s partnerima samo na http-u.** Preglednik ne dopušta https stranici otvarati obične `ws://` veze, a većina PhantomSDR+ stanica i svaki KiwiSDR ne nude ništa drugo. S https stranice zato se do njih dolazi preko diversity relaya stanice — vidi *Receive Diversity preko https-a* niže. Partneri koji i sami imaju https, te UberSDR-ovi, dosežu se izravno.
- **Upravljanje uređajem (TCI-CAT).** Veze prema `127.0.0.1` na slušateljevu vlastitom računalu dopuštene su s https stranice u aktualnim Chromeu, Edgeu i Firefoxu. Stranica se spaja tek kad slušatelj otvori **TCI-CAT** ili uključi **CAT Sync**; Chrome i Edge tada jednom traže dopuštenje za pristup programima i uređajima na slušateljevu računalu ili mreži. Odbijanje isključuje samo TCI-CAT.

---

## Receive Diversity preko https-a

Https stranica dolazi do diversity partnera samo na http-u — većine PhantomSDR+ stanica, svakog KiwiSDR-a — preko vlastitog relaya stanice, `websdr_relay.py`, istog koji poslužuje WebSDR partnere. Preglednik se sigurno spaja na `wss://myname.ddns.net/relay/…`, a relay nastavlja preko `ws://`. Panel to radi sam. Relay prenosi samo diversity zvuk (PhantomSDR+ `/audio`, KiwiSDR `/kiwi/…/SND`), spaja se samo na javne adrese i zadržava svoja uobičajena ograničenja. Ako ne radi, https stranica dolazi samo do partnera koji i sami imaju https.

Na https stanici zato ostavite relay uključen:

- **Uključivanje https-a pitanjima stanice:** kad je https uključen, pitanje o relayu koje slijedi predlaže da — ostavite tako, i relay se također instalira i pokreće. Sam `bash setup-https.sh` ga ne instalira.
- **Stanica koja već ima https:** provjerite s `systemctl is-active phantomsdr-websdr-relay`. Ako nije aktivan, pokrenite `bash setup_websdr_relay.sh`, ili `bash configure-station.sh` i odgovorite da na pitanje o relayu. Iza proxyja ne treba port na routeru ni ponovnu izgradnju.
- **Provjera:** `https://myname.ddns.net/relay/status` odgovara s nekoliko redaka koji počinju s `"service": "PhantomSDR-Plus WebSDR relay"`.

Preko relaya partner vidi adresu vaše stanice, ne slušateljevu, pa partner s ograničenjem po IP-u broji sve vaše slušatelje preko relaya zajedno. Stanici samo na http-u ništa od ovoga ne treba: http stranica izravno otvara `ws://` i `wss://` veze.

---

## Samo u lokalnoj mreži — `--lan`

Bez DNS imena https se ipak može koristiti kod kuće:

```bash
bash setup-https.sh --lan
```

Caddy tada izdaje vlastiti certifikat za lokalnu adresu i ime računala. Preglednici taj certifikat ne poznaju i upozoravaju prvi put; prihvatite ga, ili neka računala koja koristite vjeruju Caddyjevu korijenskom certifikatu:

- na samom računalu prijemnika: `sudo caddy trust`
- na drugom računalu: kopirajte `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` s prijemnika (točnu putanju prikazuje `sudo caddy environ`, pod `caddy.AppDataDir`) i uvezite ga u preglednik ili sustav kao pouzdano tijelo.

---

## Na ovom računalu već radi web-poslužitelj

Ako nginx, Apache ili druga Caddy postavka već koristi port 443 ili 80, `setup-https.sh` ga ne preuzima: zaustavlja se i ispisuje što dodati vašem poslužitelju. Za nginx, unutar bloka `server { … }` vašeg https sitea:

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

Za Apache (s `mod_proxy`, `mod_proxy_http` i `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:9014/
```

Zatim označite stanicu kao https u `station.conf`, kako bi proxy otvorio port 9014 i stranica upućivala na svoju https adresu — čarobnjak će još jednom reći da je port zauzet, što je očekivano:

```bash
STATION_HTTPS=y bash configure-station.sh
```

---

## Rješavanje problema

| Simptom | Što provjeriti |
|---|---|
| `no certificate yet` | DNS ime mora pokazivati na vašu javnu adresu (`ping myname.ddns.net` izvan vaše mreže), a usmjernik mora prosljeđivati 443 i 80 na ovo računalo. Caddy sam nastavlja pokušavati; njegov log: `sudo journalctl -u caddy -n 50`. |
| Davatelj usluge blokira port 80 | Caddy dokazuje ime i samo preko porta 443, pa je u većini slučajeva dovoljan 443; ostavite 80 proslijeđen ako možete. |
| `too many failed authorizations` u Caddyjevu logu | Let's Encrypt dopušta tek nekoliko neuspjeha na sat. Uklonite uzrok, pričekajte sat vremena, zatim `sudo systemctl restart caddy`. |
| Caddyjev log prikazuje `Invalid response … /.well-known/acme-challenge/…` (502 ili stranicu prijemnika) ili `Timeout during connect` | Router šalje 80 ili 443 negdje drugdje — često na javni port prijemnika. Pravila moraju biti TCP 80 → ovo računalo, port **80**, i TCP 443 → ovo računalo, port **443**; isključite udaljeno upravljanje samog routera na tim portovima. Zatim `sudo systemctl restart caddy` da odmah pokuša ponovno. |
| https radi kod kuće, ali ne izvana | Usmjernik prosljeđuje 443 na drugo računalo, ili nikamo. |
| Popis slušatelja ili ploča korisnika prazni su preko https-a | Jednom pokrenite `bash configure-station.sh` i potvrdite ponovnu izgradnju: stranica mora znati svoju https adresu. |
| `Port 443 is already used by another web server` | Vidi gore *Na ovom računalu već radi web-poslužitelj*. |
