# Dodatak — Popis naredbi

Sve naredbe koje sysop koristi za rad PhantomSDR-Plus stanice, grupirane po zadatku, svaka s jednim retkom objašnjenja. Pokreću se iz direktorija `PhantomSDR-Plus`, osim ako redak kaže drugačije. Ručna instalacija korak po korak (ovisnosti, Node.js, OpenCL, ručno prevođenje) ovdje se ne ponavlja — pogledajte [Vodič za instalaciju](INSTALLATION.md). Zadnji stupac vodi na odjeljak koji objašnjava naredbu; u PDF-u iza poveznice slijedi broj stranice.

## Instalacija i postavljanje stanice

| Naredba | Što radi | Vidi |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Preuzima projekt. | [README](README.md#instalacija) |
| `bash install.sh` | Potpuni instalacijski program za Ubuntu/Debian: postavlja pitanja o stanici, instalira, prevodi. | [Vodič za instalaciju](INSTALLATION.md#kloniranje-repozitorija-i-pokretanje-instalacijskog-programa) |
| `bash install_fedora.sh` | Isti instalacijski program za Fedoru. | [Vodič za instalaciju](INSTALLATION.md#kloniranje-repozitorija-i-pokretanje-instalacijskog-programa) |
| `bash install_arch.sh` | Isti instalacijski program za Arch Linux. | [Vodič za instalaciju](INSTALLATION.md#kloniranje-repozitorija-i-pokretanje-instalacijskog-programa) |
| `bash install_opensuse.sh` | Isti instalacijski program za openSUSE. | [Vodič za instalaciju](INSTALLATION.md#kloniranje-repozitorija-i-pokretanje-instalacijskog-programa) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Instalacija bez pitanja (ovdje za RX888 MkII); svako pitanje dobiva zadanu vrijednost. | [Vodič za instalaciju](INSTALLATION.md#instalacija-bez-nadzora) |
| `chmod +x *.sh` | Ponovno čini skripte izvršnima (npr. nakon raspakiravanja zip arhive). | [Vodič za instalaciju](INSTALLATION.md#ručno-ažuriranje) |
| `bash configure-station.sh` | Čarobnjak stanice: postavlja pitanja, sprema `station.conf` i iz njega piše sve konfiguracijske datoteke. | [Vodič za instalaciju](INSTALLATION.md#pitanja-o-stanici) |
| `bash configure-station.sh --ask` | Pita i sprema samo `station.conf`. | [Vodič za instalaciju](INSTALLATION.md#pitanja-o-stanici) |
| `bash configure-station.sh --apply` | Ponovno piše konfiguracijske datoteke iz `station.conf` bez pitanja. | [Vodič za instalaciju](INSTALLATION.md#pitanja-o-stanici) |
| `bash configure-station.sh --show` | Prikazuje trenutne odgovore. | [Vodič za instalaciju](INSTALLATION.md#pitanja-o-stanici) |
| `./add-receiver.sh` | Dodaje još jedan prijemnik (npr. RTL-SDR za 2 m) uz glavni. | [Vodič za instalaciju](INSTALLATION.md#više-prijemnika-na-jednom-računalu) |

## Upravljački programi prijemnika

| Naredba | Što radi | Vidi |
|---|---|---|
| `./setup-rx888-udev.sh` | Instalira udev pravila za RX888 kako bi radio bez sudo. | [Vodič za instalaciju](INSTALLATION.md#pokretanje-rx888_stream-bez-sudo-udev-pravila) |
| `./setup-rtlsdr.sh` | Instalira RTL-SDR upravljački program; pita je li stick Blog V4. | [Vodič za instalaciju](INSTALLATION.md#više-prijemnika-na-jednom-računalu) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Instalira RTL-SDR Blog V4 upravljački program bez pitanja. | [Vodič za instalaciju](INSTALLATION.md#više-prijemnika-na-jednom-računalu) |
| `./setup-rsp1a.sh` | Instalira otvoreni lanac upravljačkih programa za SDRplay RSP1A. | [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Instalira lanac upravljačkih programa za Airspy HF+. | [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Instalira lanac upravljačkih programa za RigExpert Fobos. | [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Instalira paket hackrf i njegovo udev pravilo. | [Vodič za instalaciju](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Provjerava je li RTL-SDR stick prepoznat. | [Vodič za instalaciju](INSTALLATION.md#testirajte-rtl-sdr) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Provjerava je li RSP1A prepoznat (`driver=fobos`, `driver=airspyhf` za ostale). | [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Prikazuje instalirane SoapySDR upravljačke programe. | [Vodič za instalaciju](INSTALLATION.md#fobos-ili-airspy-hf-nije-pronađen) |

## Pokretanje i zaustavljanje prijemnika

| Naredba | Što radi | Vidi |
|---|---|---|
| `./start-rx888mk2.sh` | Pokreće (ili ponovno pokreće) prijemnik RX888 MkII s nadzornikom i prikazuje log dok se ne podigne. | [README](README.md#osnovni-rad) |
| `./start-rtl.sh` | Isto za RTL-SDR. | [Vodič za instalaciju](INSTALLATION.md#1-probno-pokretanje) |
| `./start-rsp1a.sh` | Isto za SDRplay RSP1A. | [README](README.md#osnovni-rad) |
| `./start-airspyhf.sh` | Isto za Airspy HF+. | [README](README.md#osnovni-rad) |
| `./start-hackrf.sh` | Isto za HackRF One. | [README](README.md#osnovni-rad) |
| `./start-fobos.sh` | Isto za Fobos, RF ulaz (25–6000 MHz). | [README](README.md#osnovni-rad) |
| `./start-fobos-hf.sh` | Isto za Fobos, izravno HF uzorkovanje (0–25 MHz). | [README](README.md#osnovni-rad) |
| `./start-all.sh` | Pokreće sve prijemnike navedene u `receivers.toml`. | [Više prijemnika](MULTI_RECEIVER.md#5-pokretanje-i-zaustavljanje) |
| `./start-rx888mk2.sh -q` | Svaka skripta za pokretanje s `-q`: dva retka ispisa umjesto živog loga. | [README](README.md#osnovni-rad) |
| `INSTANCE=vhf ./start-rtl.sh` | Pokreće drugi prijemnik postavljen u `instances/vhf/`. | [Više prijemnika](MULTI_RECEIVER.md#3-dodavanje-drugog-prijemnika) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Veže poslužitelj uz ove CPU jezgre (`none` = bez vezivanja). | [README](README.md#osnovni-rad) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Pokreće bez RADE sidecara. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `./stop-websdr.sh` | Zaustavlja sve prijemnike ove instalacije i njihov nadzornik. | [Vodič za instalaciju](INSTALLATION.md#7-zaustavite-poslužitelj) |
| `./stop-websdr.sh main` | Zaustavlja samo glavni prijemnik. | [Više prijemnika](MULTI_RECEIVER.md#5-pokretanje-i-zaustavljanje) |
| `./stop-websdr.sh vhf` | Zaustavlja samo prijemnik pokrenut s `INSTANCE=vhf`. | [Više prijemnika](MULTI_RECEIVER.md#5-pokretanje-i-zaustavljanje) |
| `tail -f logwebsdr.txt` | Prati živi log prijemnika. | [Vodič za instalaciju](INSTALLATION.md#2-provjerite-ima-li-pogrešaka) |

## Pokretanje pri podizanju sustava

| Naredba | Što radi | Vidi |
|---|---|---|
| `bash setup-autostart.sh` | Pokreće prijemnik pri podizanju sustava (skripta navedena u `station.conf`). | [Vodič za instalaciju](INSTALLATION.md#postavljanje-automatskog-pokretanja) |
| `bash setup-autostart.sh start-rtl.sh` | Isto, za određenu skriptu za pokretanje. | [Vodič za instalaciju](INSTALLATION.md#postavljanje-automatskog-pokretanja) |
| `bash setup-autostart.sh start-all.sh` | Isto, za sve prijemnike u `receivers.toml`. | [Vodič za instalaciju](INSTALLATION.md#postavljanje-automatskog-pokretanja) |
| `bash setup-autostart.sh --status` | Pokazuje je li instalirano i za koju skriptu. | [Vodič za instalaciju](INSTALLATION.md#postavljanje-automatskog-pokretanja) |
| `bash setup-autostart.sh --remove` | Prestaje s pokretanjem pri podizanju (prijemnik sada nastavlja raditi). | [Vodič za instalaciju](INSTALLATION.md#postavljanje-automatskog-pokretanja) |

## Prevođenje i ažuriranje

| Naredba | Što radi | Vidi |
|---|---|---|
| `./recompile.sh` | Ponovno prevodi poslužitelj i/ili web stranicu; pita što prevesti. | [Vodič za instalaciju](INSTALLATION.md#ručno-ažuriranje) |
| `./recompile.sh --backend` | Prevodi samo poslužitelj. | [Vodič za instalaciju](INSTALLATION.md#ručno-ažuriranje) |
| `./recompile.sh --frontend` | Prevodi samo web stranicu (desktop i /mobile). | [Vodič za instalaciju](INSTALLATION.md#ručno-ažuriranje) |
| `./recompile.sh --both` | Prevodi oboje. | [Vodič za instalaciju](INSTALLATION.md#ručno-ažuriranje) |
| `cd frontend && ./build-all.sh` | Gradi desktop stranicu i /mobile. | [Uređivanje varijanti](EDITING_VARIANTS.md#6-nakon-uređivanja--ponovna-izgradnja) |
| `cd frontend && ./build-default.sh` | Gradi samo desktop stranicu. | [Uređivanje varijanti](EDITING_VARIANTS.md#6-nakon-uređivanja--ponovna-izgradnja) |
| `cd frontend && ./build-mobile.sh` | Gradi samo /mobile. | [Uređivanje varijanti](EDITING_VARIANTS.md#6-nakon-uređivanja--ponovna-izgradnja) |
| `bash update.sh` | Izvještava što bi nova verzija promijenila i pita treba li ažurirati. | [Vodič za instalaciju](INSTALLATION.md#pokretanje) |
| `./update.sh --check` | Samo izvještaj, bez pitanja (za cron; izlazni kod 10 = čeka ažuriranje). | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --apply` | Ažurira, pitajući za datoteke koje ste sami uredili. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --apply --yes` | Ažurira bez pitanja; svaka datoteka koju ste uredili ostaje sačuvana. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --apply --prune` | Nudi i brisanje datoteka uklonjenih u izvornom repozitoriju. | [Vodič za instalaciju](INSTALLATION.md#pokretanje) |
| `./update.sh --from FILE` | Uzima novu verziju iz `.zip`/`.tar.gz` ili mape — bez mreže. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --ref v5.1.0` | Ažurira na oznaku, granu ili commit umjesto trenutnog stabla. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --list-excludes` | Prikazuje datoteke koje alat za ažuriranje nikad ne dira. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --verbose` | Prikazuje sve datoteke, ne samo prvih 40. | [Vodič za instalaciju](INSTALLATION.md#ostale-mogućnosti) |
| `./update.sh --restore LAST` | Vraća datoteke koje je zadnje ažuriranje prepisalo. | [Vodič za instalaciju](INSTALLATION.md#poništavanje-ažuriranja) |
| `./update.sh --restore 20260923-164530` | Vraća datoteke iz tog određenog pokretanja. | [Vodič za instalaciju](INSTALLATION.md#poništavanje-ažuriranja) |

## Izgled stranice

| Naredba | Što radi | Vidi |
|---|---|---|
| `./waterfall.sh` | Mijenja zadanu minimalnu razinu waterfalla; prikazuje trenutnu vrijednost i pita. | [README](README.md#donji-prag-slapa--waterfallsh) |
| `./waterfall.sh -v -15` | Postavlja je na −15 dB bez pitanja (`-y` preskače i potvrde). | [README](README.md#donji-prag-slapa--waterfallsh) |
| `./waterfall.sh -s` | Prikazuje samo trenutne vrijednosti. | [README](README.md#donji-prag-slapa--waterfallsh) |
| `./smeter_theme.sh` | Bira zadanu temu S-metra iz izbornika. | [Uređivanje varijanti](EDITING_VARIANTS.md#tri-izgleda-skale--i-smeter_themesh) |
| `./smeter_theme.sh vintage` | Odmah postavlja tu temu, zatim nudi ponovno prevođenje. | [Uređivanje varijanti](EDITING_VARIANTS.md#tri-izgleda-skale--i-smeter_themesh) |
| `./smeter_theme.sh dark --build` | Postavlja je i prevodi bez pitanja (`--no-build` preskače prevođenje). | [Uređivanje varijanti](EDITING_VARIANTS.md#tri-izgleda-skale--i-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Samo za nove posjetitelje; postojeći zadržavaju svoju. | [Uređivanje varijanti](EDITING_VARIANTS.md#tri-izgleda-skale--i-smeter_themesh) |

## Administratorska ploča i proxy

| Naredba | Što radi | Vidi |
|---|---|---|
| `./setup_admin.sh` | Interaktivno postavljanje administratorske ploče: portovi, skripte, thermal guard, systemd jedinice. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korak-2--pokrenite-skriptu-za-postavljanje) |
| `./setup_admin.sh --sudoers` | Instalira samo sudoers pravilo, kako bi se dvije jedinice ponovno pokretale bez lozinke. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korak-2--pokrenite-skriptu-za-postavljanje) |
| `./setup_admin.sh --proxy-only` | Instalira samo proxy na javnom portu, za stanicu bez ploče. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korak-2--pokrenite-skriptu-za-postavljanje) |
| `./manage_admin.sh start` | Pokreće ploču i proxy (kad nisu pod systemd). | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-a--manage_adminsh-bez-roota-ništa-se-ne-instalira) |
| `./manage_admin.sh stop` | Zaustavlja oboje. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-a--manage_adminsh-bez-roota-ništa-se-ne-instalira) |
| `./manage_admin.sh status` | Pokazuje rade li, s njihovim PID-ovima. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-a--manage_adminsh-bez-roota-ništa-se-ne-instalira) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Ponovno pokreće ploču i proxy pod systemd (prijemnik nastavlja raditi). | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#ponovno-pokretanje-ploče) |
| `sudo systemctl enable --now phantomsdr-admin` | Pokreće ploču sada i pri svakom podizanju (jednako `phantomsdr-proxy`). | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-b--systemd-jedinice-pokreću-se-pri-dizanju-sustava-ponovno-se-pokreću-nakon-pada) |
| `sudo systemctl disable --now phantomsdr-admin` | Zaustavlja ploču i više je ne pokreće pri podizanju. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-b--systemd-jedinice-pokreću-se-pri-dizanju-sustava-ponovno-se-pokreću-nakon-pada) |
| `systemctl status phantomsdr-admin` | Prikazuje stanje ploče (bez sudo). | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-b--systemd-jedinice-pokreću-se-pri-dizanju-sustava-ponovno-se-pokreću-nakon-pada) |
| `sudo journalctl -u phantomsdr-admin -f` | Prati log ploče. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#način-b--systemd-jedinice-pokreću-se-pri-dizanju-sustava-ponovno-se-pokreću-nakon-pada) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Veže autorun demon za dekodiranje uz ove CPU jezgre. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#ručna-zamjena-vezanja-uz-jezgre-napredno) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Instalira rotaciju logova ploče, proxyja i autoruna. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#rotiranje-proxylog-i-adminlog) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Probno pokretanje rotacije logova. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#rotiranje-proxylog-i-adminlog) |

## Thermal guard

| Naredba | Što radi | Vidi |
|---|---|---|
| `python3 thermal_guard.py --once` | Prikazuje senzor, točku okidanja i pragove; ne poduzima ništa. | [Thermal Guard](THERMAL_GUARD.md#2-brzi-početak) |
| `python3 thermal_guard.py --mode log` | Prati temperaturu uživo, samo bilježi (Ctrl-C za izlaz). | [Thermal Guard](THERMAL_GUARD.md#7-rad-bez-administratorske-ploče) |
| `python3 thermal_guard.py --mode stop+restart` | Pokreće ga naoružanog: zaustavlja prijemnik kad se pregrije i ponovno ga pokreće kad se ohladi. | [Thermal Guard](THERMAL_GUARD.md#7-rad-bez-administratorske-ploče) |
| `python3 thermal_guard.py --config FILE` | Koristi drugu konfiguracijsku datoteku. | [Thermal Guard](THERMAL_GUARD.md#7-rad-bez-administratorske-ploče) |
| `./setup-cpufreq-perms.sh` | Dopušta guardu snižavanje frekvencije CPU-a bez pokretanja kao root. | [Thermal Guard](THERMAL_GUARD.md#8-uključivanje-throttle-faze-bez-roota) |
| `sudo systemctl enable --now thermal-guard` | Pokreće guard kao zasebnu uslugu (samo kad se ne koristi administratorska ploča). | [Thermal Guard](THERMAL_GUARD.md#7-rad-bez-administratorske-ploče) |

## Veze, vatrozid i HTTPS

| Naredba | Što radi | Vidi |
|---|---|---|
| `./setup-firewall.sh --show` | Prikazuje pravila jezgre za ograničenje veza; ništa ne mijenja. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ./setup-firewall.sh --check` | Provjerava pravila prema vašoj jezgri. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ./setup-firewall.sh --apply` | Učitava pravila, uz automatsko poništavanje nakon 60 sekundi. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ./setup-firewall.sh --persist` | Ponovno učitava pravila pri svakom podizanju. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ./setup-firewall.sh --status` | Prikazuje brojače paketa za svako pravilo. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ./setup-firewall.sh --remove` | Uklanja sva pravila. | [Ograničenja veza](CONNECTION_LIMITS.md#5-zaštita-u-jezgri) |
| `sudo ufw allow 9000/tcp` | Otvara javni port u ufw vatrozidu. | [Vodič za instalaciju](INSTALLATION.md#nema-pristupa-s-drugih-uređaja) |
| `bash setup-https.sh` | Uključuje HTTPS s besplatnim Let's Encrypt certifikatom; HTTP i dalje radi. | [Siguran pristup (HTTPS)](HTTPS.md#na-stanici-koja-već-radi) |
| `bash setup-https.sh --lan` | HTTPS samo unutar lokalne mreže (preglednici upozoravaju na certifikat). | [Siguran pristup (HTTPS)](HTTPS.md#samo-u-lokalnoj-mreži----lan) |
| `bash setup-https.sh --status` | Pokazuje je li HTTPS uključen i odgovara li certifikat. | [Siguran pristup (HTTPS)](HTTPS.md#provjera-i-isključivanje) |
| `bash setup-https.sh --remove` | Isključuje HTTPS; obični HTTP ostaje kakav jest. | [Siguran pristup (HTTPS)](HTTPS.md#provjera-i-isključivanje) |

## Dodatne usluge

| Naredba | Što radi | Vidi |
|---|---|---|
| `./install-stats-server.sh` | Instalira poslužitelj statistike (CPU, temperatura, korisnici). | [Poslužitelj statistike](../sdr-stats/readme_hr.md#korak-1-pokrenite-skriptu) |
| `sudo systemctl restart sdr-stats.service` | Ponovno ga pokreće (jednako `start`, `stop`, `status`). | [Poslužitelj statistike](../sdr-stats/readme_hr.md#upravljanje-uslugom) |
| `sudo journalctl -u sdr-stats.service -f` | Prati njegov log. | [Poslužitelj statistike](../sdr-stats/readme_hr.md#upravljanje-uslugom) |
| `curl http://localhost:3001/api/system-stats` | Provjerava odgovara li. | [Poslužitelj statistike](../sdr-stats/readme_hr.md#test-1-provjerite-api-krajnju-točku) |
| `./install_rade.sh` | Instalira RADE / FreeDV sidecar (`install_rade_ubuntu22.sh` na Ubuntu 22.04). | [RADE README](RADE_README.md#instalacija--kraći-put) |
| `./rade.sh start` | Pokreće RADE sidecar s nadzornikom. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `./rade.sh stop` | Zaustavlja ga, zajedno s nadzornikom i procesima dekodiranja. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `./rade.sh restart` | Čisto ga zaustavlja i pokreće. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `./rade.sh status` | Pokazuje radi li. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Ponovno ga pokreće dajući svakom slušatelju tri CPU jezgre. | [RADE README](RADE_README.md#ako-se-jezgre-zasite-prije-koljena) |
| `tail -f rade.log` | Prati RADE log. | [RADE README](RADE_README.md#upravljanje-sidecarom) |
| `python3 rade_loadtest.py` | Mjeri koliko RADE slušatelja ovo računalo može podnijeti. | [RADE README](RADE_README.md#preduvjeti-1) |
| `./kiwi_install.sh` | Instalira emulaciju KiwiSDR klijenta (za Kiwi programe poput AetherSDR). | [Emulacija KiwiSDR klijenta](Aether_config.md#2-instalacija-mosta) |
| `./setup_websdr_relay.sh` | Instalira relay koji diversity prijemu omogućuje korištenje WebSDR-a kao drugog prijemnika. | [Diverziti prijam](RECEIVE_DIVERSITY.md#instalacija-releja) |

## Upravljanje primopredajnikom (TCI most)

| Naredba | Što radi | Vidi |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Daje vašem korisniku pristup serijskom portu uređaja (nakon toga se ponovno prijavite). | [Upravljanje primopredajnikom](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Čita frekvenciju uređaja preko Hamliba — provjerava CAT vezu (model, port i brzina za vaš uređaj). | [Upravljanje primopredajnikom](RIG_CONTROL.md#primjer-icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Pokreće most na već pokrenutom `rigctld`. | [Upravljanje primopredajnikom](RIG_CONTROL.md#primjer-yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Pokreće most upravljajući uređajem izravno preko `rigctl` (način za Windows). | [Upravljanje primopredajnikom](RIG_CONTROL.md#primjer-yaesu-ft-991a) |

## Provjere i rješavanje problema

| Naredba | Što radi | Vidi |
|---|---|---|
| `ss -tlnp` | Prikazuje portove koji slušaju i programe iza njih. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korisne-ručne-naredbe) |
| `sudo lsof -i :9002` | Pokazuje koji program drži port. | [Vodič za instalaciju](INSTALLATION.md#port-je-već-zauzet) |
| `pkill -f admin_server.py` | Završava ploču pokrenutu ručno (jednako `proxy.py`). | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korisne-ručne-naredbe) |
| `sudo fuser -k 3000/tcp` | Oslobađa port koji drži zaglavljeni program. | [Postavljanje administratorske ploče](ADMIN_PANEL_SETUP.md#korisne-ručne-naredbe) |
| `lsusb` | Prikazuje USB uređaje — vidi li se prijemnik? | [Vodič za instalaciju](INSTALLATION.md#rtl-sdr-nije-pronađen) |
| `sudo timedatectl set-ntp true` | Održava sat sinkroniziranim — trebaju ga FT8/FT4/WSPR dekoderi. | [Vodič za instalaciju](INSTALLATION.md#meson-setup-staje-uz-clock-skew-detected) |

## Interne skripte (ne pokreću se ručno)

| Skripta | Što radi | Vidi |
|---|---|---|
| `start-*.sh --watchdog` | Nadzornik koji skripta za pokretanje pokreće za sebe. | [Vodič za instalaciju](INSTALLATION.md#1-stvorite-datoteku-usluge) |
| `setup-sdr-common.sh` | Zajedničke pomoćne funkcije koje učitavaju instalacijske skripte `setup-*.sh`. | [Struktura projekta](PROJECT_STRUCTURE.md#stablo-direktorija) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | Stariji lanac pokretanja, zadržan za postojeće stanice; skripte `start-*.sh` ga zamjenjuju. | [Struktura projekta](PROJECT_STRUCTURE.md#stablo-direktorija) |
