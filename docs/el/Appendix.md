# Παράρτημα — Κατάλογος εντολών

Όλες οι εντολές που χρησιμοποιεί ένας sysop για να λειτουργήσει έναν σταθμό PhantomSDR-Plus, ομαδοποιημένες ανά εργασία, με μία γραμμή εξήγηση η καθεμία. Εκτελούνται μέσα από τον φάκελο `PhantomSDR-Plus`, εκτός αν η γραμμή λέει κάτι άλλο. Η βήμα-βήμα χειροκίνητη εγκατάσταση (εξαρτήσεις, Node.js, OpenCL, χειροκίνητη μεταγλώττιση) δεν επαναλαμβάνεται εδώ — δείτε τον [Οδηγό εγκατάστασης](INSTALLATION.md). Η τελευταία στήλη παραπέμπει στην ενότητα που εξηγεί την εντολή· στο PDF ακολουθεί ο αριθμός σελίδας.

## Εγκατάσταση και ρύθμιση του σταθμού

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Κατεβάζει το έργο. | [README](README.md#εγκατάσταση) |
| `bash install.sh` | Πλήρης εγκατάσταση για Ubuntu/Debian: κάνει τις ερωτήσεις του σταθμού, εγκαθιστά, μεταγλωττίζει. | [Οδηγός εγκατάστασης](INSTALLATION.md#κλωνοποίηση-του-αποθετηρίου-και-εκτέλεση-του-προγράμματος-εγκατάστασης) |
| `bash install_fedora.sh` | Η ίδια εγκατάσταση για Fedora. | [Οδηγός εγκατάστασης](INSTALLATION.md#κλωνοποίηση-του-αποθετηρίου-και-εκτέλεση-του-προγράμματος-εγκατάστασης) |
| `bash install_arch.sh` | Η ίδια εγκατάσταση για Arch Linux. | [Οδηγός εγκατάστασης](INSTALLATION.md#κλωνοποίηση-του-αποθετηρίου-και-εκτέλεση-του-προγράμματος-εγκατάστασης) |
| `bash install_opensuse.sh` | Η ίδια εγκατάσταση για openSUSE. | [Οδηγός εγκατάστασης](INSTALLATION.md#κλωνοποίηση-του-αποθετηρίου-και-εκτέλεση-του-προγράμματος-εγκατάστασης) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Εγκατάσταση χωρίς ερωτήσεις (εδώ για RX888 MkII)· κάθε ερώτηση παίρνει την προεπιλογή της. | [Οδηγός εγκατάστασης](INSTALLATION.md#εγκατάσταση-χωρίς-επίβλεψη) |
| `chmod +x *.sh` | Κάνει ξανά εκτελέσιμα τα scripts (π.χ. μετά την αποσυμπίεση ενός zip). | [Οδηγός εγκατάστασης](INSTALLATION.md#ενημέρωση-με-το-χέρι) |
| `bash configure-station.sh` | Οδηγός σταθμού: κάνει τις ερωτήσεις, αποθηκεύει το `station.conf` και γράφει από αυτό κάθε αρχείο ρυθμίσεων. | [Οδηγός εγκατάστασης](INSTALLATION.md#οι-ερωτήσεις-του-σταθμού) |
| `bash configure-station.sh --ask` | Ρωτά και αποθηκεύει μόνο το `station.conf`. | [Οδηγός εγκατάστασης](INSTALLATION.md#οι-ερωτήσεις-του-σταθμού) |
| `bash configure-station.sh --apply` | Ξαναγράφει τα αρχεία ρυθμίσεων από το `station.conf` χωρίς ερωτήσεις. | [Οδηγός εγκατάστασης](INSTALLATION.md#οι-ερωτήσεις-του-σταθμού) |
| `bash configure-station.sh --show` | Εμφανίζει τις τρέχουσες απαντήσεις. | [Οδηγός εγκατάστασης](INSTALLATION.md#οι-ερωτήσεις-του-σταθμού) |
| `./add-receiver.sh` | Προσθέτει έναν ακόμη δέκτη (π.χ. ένα RTL-SDR για τα 2 m) δίπλα στον κύριο. | [Οδηγός εγκατάστασης](INSTALLATION.md#πολλοί-δέκτες-σε-έναν-υπολογιστή) |

## Οδηγοί δεκτών

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./setup-rx888-udev.sh` | Εγκαθιστά τους κανόνες udev του RX888 ώστε να τρέχει χωρίς sudo. | [Οδηγός εγκατάστασης](INSTALLATION.md#εκτέλεση-του-rx888_stream-χωρίς-sudo-κανόνες-udev) |
| `./setup-rtlsdr.sh` | Εγκαθιστά τον οδηγό RTL-SDR· ρωτά αν το stick είναι Blog V4. | [Οδηγός εγκατάστασης](INSTALLATION.md#πολλοί-δέκτες-σε-έναν-υπολογιστή) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Εγκαθιστά τον οδηγό RTL-SDR Blog V4 χωρίς ερώτηση. | [Οδηγός εγκατάστασης](INSTALLATION.md#πολλοί-δέκτες-σε-έναν-υπολογιστή) |
| `./setup-rsp1a.sh` | Εγκαθιστά την ανοιχτή αλυσίδα οδηγών για το SDRplay RSP1A. | [Οδηγός εγκατάστασης](INSTALLATION.md#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Εγκαθιστά την αλυσίδα οδηγών του Airspy HF+. | [Οδηγός εγκατάστασης](INSTALLATION.md#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Εγκαθιστά την αλυσίδα οδηγών του RigExpert Fobos. | [Οδηγός εγκατάστασης](INSTALLATION.md#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Εγκαθιστά το πακέτο hackrf και τον κανόνα udev του. | [Οδηγός εγκατάστασης](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Ελέγχει ότι το RTL-SDR αναγνωρίζεται. | [Οδηγός εγκατάστασης](INSTALLATION.md#δοκιμάστε-το-rtl-sdr) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Ελέγχει ότι το RSP1A αναγνωρίζεται (`driver=fobos`, `driver=airspyhf` για τα άλλα). | [Οδηγός εγκατάστασης](INSTALLATION.md#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Εμφανίζει τους οδηγούς SoapySDR που είναι εγκατεστημένοι. | [Οδηγός εγκατάστασης](INSTALLATION.md#δεν-βρέθηκε-ο-fobos-ή-ο-airspy-hf) |

## Εκκίνηση και διακοπή του δέκτη

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./start-rx888mk2.sh` | Ξεκινά (ή επανεκκινεί) τον δέκτη RX888 MkII με τον επιτηρητή του και δείχνει το log μέχρι να σηκωθεί. | [README](README.md#βασική-λειτουργία) |
| `./start-rtl.sh` | Το ίδιο για RTL-SDR. | [Οδηγός εγκατάστασης](INSTALLATION.md#1-δοκιμαστική-εκτέλεση) |
| `./start-rsp1a.sh` | Το ίδιο για SDRplay RSP1A. | [README](README.md#βασική-λειτουργία) |
| `./start-airspyhf.sh` | Το ίδιο για Airspy HF+. | [README](README.md#βασική-λειτουργία) |
| `./start-hackrf.sh` | Το ίδιο για HackRF One. | [README](README.md#βασική-λειτουργία) |
| `./start-fobos.sh` | Το ίδιο για Fobos, είσοδος RF (25–6000 MHz). | [README](README.md#βασική-λειτουργία) |
| `./start-fobos-hf.sh` | Το ίδιο για Fobos, άμεση δειγματοληψία HF (0–25 MHz). | [README](README.md#βασική-λειτουργία) |
| `./start-all.sh` | Ξεκινά όλους τους δέκτες του `receivers.toml`. | [Πολλοί δέκτες](MULTI_RECEIVER.md#5-εκκίνηση-και-διακοπή) |
| `./start-rx888mk2.sh -q` | Κάθε script εκκίνησης με `-q`: δύο γραμμές έξοδο αντί για το ζωντανό log. | [README](README.md#βασική-λειτουργία) |
| `INSTANCE=vhf ./start-rtl.sh` | Ξεκινά δεύτερο δέκτη, ρυθμισμένο στο `instances/vhf/`. | [Πολλοί δέκτες](MULTI_RECEIVER.md#3-προσθήκη-δεύτερου-δέκτη) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Δεσμεύει τον server σε αυτούς τους πυρήνες CPU (`none` = χωρίς δέσμευση). | [README](README.md#βασική-λειτουργία) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Ξεκινά χωρίς το RADE sidecar. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `./stop-websdr.sh` | Σταματά όλους τους δέκτες αυτής της εγκατάστασης και τον επιτηρητή τους. | [Οδηγός εγκατάστασης](INSTALLATION.md#7-σταματήστε-τον-διακομιστή) |
| `./stop-websdr.sh main` | Σταματά μόνο τον κύριο δέκτη. | [Πολλοί δέκτες](MULTI_RECEIVER.md#5-εκκίνηση-και-διακοπή) |
| `./stop-websdr.sh vhf` | Σταματά μόνο τον δέκτη που ξεκίνησε με `INSTANCE=vhf`. | [Πολλοί δέκτες](MULTI_RECEIVER.md#5-εκκίνηση-και-διακοπή) |
| `tail -f logwebsdr.txt` | Παρακολουθεί ζωντανά το log του δέκτη. | [Οδηγός εγκατάστασης](INSTALLATION.md#2-ελέγξτε-για-σφάλματα) |

## Εκκίνηση με το boot

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `bash setup-autostart.sh` | Ξεκινά τον δέκτη με το boot (το script εκκίνησης που ορίζει το `station.conf`). | [Οδηγός εγκατάστασης](INSTALLATION.md#ρύθμιση-αυτόματης-εκκίνησης) |
| `bash setup-autostart.sh start-rtl.sh` | Το ίδιο, για συγκεκριμένο script εκκίνησης. | [Οδηγός εγκατάστασης](INSTALLATION.md#ρύθμιση-αυτόματης-εκκίνησης) |
| `bash setup-autostart.sh start-all.sh` | Το ίδιο, για όλους τους δέκτες του `receivers.toml`. | [Οδηγός εγκατάστασης](INSTALLATION.md#ρύθμιση-αυτόματης-εκκίνησης) |
| `bash setup-autostart.sh --status` | Δείχνει αν είναι εγκατεστημένο και για ποιο script. | [Οδηγός εγκατάστασης](INSTALLATION.md#ρύθμιση-αυτόματης-εκκίνησης) |
| `bash setup-autostart.sh --remove` | Σταματά την εκκίνηση με το boot (ο δέκτης συνεχίζει να τρέχει τώρα). | [Οδηγός εγκατάστασης](INSTALLATION.md#ρύθμιση-αυτόματης-εκκίνησης) |

## Μεταγλώττιση και ενημέρωση

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./recompile.sh` | Ξαναχτίζει τον server ή/και τη σελίδα· ρωτά τι να χτίσει. | [Οδηγός εγκατάστασης](INSTALLATION.md#ενημέρωση-με-το-χέρι) |
| `./recompile.sh --backend` | Ξαναχτίζει μόνο τον server. | [Οδηγός εγκατάστασης](INSTALLATION.md#ενημέρωση-με-το-χέρι) |
| `./recompile.sh --frontend` | Ξαναχτίζει μόνο τη σελίδα (desktop και /mobile). | [Οδηγός εγκατάστασης](INSTALLATION.md#ενημέρωση-με-το-χέρι) |
| `./recompile.sh --both` | Ξαναχτίζει και τα δύο. | [Οδηγός εγκατάστασης](INSTALLATION.md#ενημέρωση-με-το-χέρι) |
| `cd frontend && ./build-all.sh` | Χτίζει τη σελίδα desktop και το /mobile. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#6-μετά-την-επεξεργασία--ανακατασκευή) |
| `cd frontend && ./build-default.sh` | Χτίζει μόνο τη σελίδα desktop. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#6-μετά-την-επεξεργασία--ανακατασκευή) |
| `cd frontend && ./build-mobile.sh` | Χτίζει μόνο το /mobile. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#6-μετά-την-επεξεργασία--ανακατασκευή) |
| `bash update.sh` | Αναφέρει τι θα άλλαζε μια νέα έκδοση και ρωτά αν θα γίνει η ενημέρωση. | [Οδηγός εγκατάστασης](INSTALLATION.md#εκτέλεση) |
| `./update.sh --check` | Μόνο αναφορά, χωρίς ερωτήσεις (για cron· κωδικός εξόδου 10 = υπάρχει ενημέρωση). | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --apply` | Ενημερώνει, ρωτώντας για τα αρχεία που επεξεργαστήκατε εσείς. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --apply --yes` | Ενημερώνει χωρίς ερωτήσεις· κάθε αρχείο που επεξεργαστήκατε διατηρείται. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --apply --prune` | Προτείνει επίσης τη διαγραφή αρχείων που αφαιρέθηκαν από το αποθετήριο. | [Οδηγός εγκατάστασης](INSTALLATION.md#εκτέλεση) |
| `./update.sh --from FILE` | Παίρνει τη νέα έκδοση από `.zip`/`.tar.gz` ή φάκελο — χωρίς δίκτυο. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --ref v5.1.0` | Ενημερώνει σε tag, branch ή commit αντί για το τρέχον δέντρο. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --list-excludes` | Εμφανίζει τα αρχεία που ο updater δεν αγγίζει ποτέ. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --verbose` | Εμφανίζει όλα τα αρχεία, όχι μόνο τα πρώτα 40. | [Οδηγός εγκατάστασης](INSTALLATION.md#άλλες-επιλογές) |
| `./update.sh --restore LAST` | Επαναφέρει τα αρχεία που αντικατέστησε η τελευταία ενημέρωση. | [Οδηγός εγκατάστασης](INSTALLATION.md#αναίρεση-μιας-ενημέρωσης) |
| `./update.sh --restore 20260923-164530` | Επαναφέρει τα αρχεία της συγκεκριμένης εκτέλεσης. | [Οδηγός εγκατάστασης](INSTALLATION.md#αναίρεση-μιας-ενημέρωσης) |

## Εμφάνιση της σελίδας

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./waterfall.sh` | Αλλάζει το προεπιλεγμένο ελάχιστο επίπεδο του waterfall· δείχνει την τρέχουσα τιμή και ρωτά. | [README](README.md#κατώτατο-όριο-καταρράκτη--waterfallsh) |
| `./waterfall.sh -v -15` | Το ορίζει στα −15 dB χωρίς ερώτηση (το `-y` παραλείπει και τις επιβεβαιώσεις). | [README](README.md#κατώτατο-όριο-καταρράκτη--waterfallsh) |
| `./waterfall.sh -s` | Δείχνει μόνο τις τρέχουσες τιμές. | [README](README.md#κατώτατο-όριο-καταρράκτη--waterfallsh) |
| `./smeter_theme.sh` | Επιλέγει το προεπιλεγμένο θέμα του S-meter από μενού. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#οι-τρεις-όψεις-του-οργάνου--και-το-smeter_themesh) |
| `./smeter_theme.sh vintage` | Ορίζει αμέσως αυτό το θέμα και προτείνει την επαναμεταγλώττιση. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#οι-τρεις-όψεις-του-οργάνου--και-το-smeter_themesh) |
| `./smeter_theme.sh dark --build` | Το ορίζει και ξαναχτίζει χωρίς ερώτηση (το `--no-build` παραλείπει τη μεταγλώττιση). | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#οι-τρεις-όψεις-του-οργάνου--και-το-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Ισχύει μόνο για νέους επισκέπτες· οι υπάρχοντες κρατούν το δικό τους. | [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md#οι-τρεις-όψεις-του-οργάνου--και-το-smeter_themesh) |

## Πίνακας διαχείρισης και proxy

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./setup_admin.sh` | Διαδραστική ρύθμιση του πίνακα διαχείρισης: θύρες, scripts, thermal guard, μονάδες systemd. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#βήμα-2--εκτελέστε-το-σενάριο-ρύθμισης) |
| `./setup_admin.sh --sudoers` | Εγκαθιστά μόνο τον κανόνα sudoers, ώστε οι δύο μονάδες να επανεκκινούν χωρίς κωδικό. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#βήμα-2--εκτελέστε-το-σενάριο-ρύθμισης) |
| `./setup_admin.sh --proxy-only` | Εγκαθιστά μόνο το proxy στη δημόσια θύρα, για σταθμό χωρίς πίνακα. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#βήμα-2--εκτελέστε-το-σενάριο-ρύθμισης) |
| `./manage_admin.sh start` | Ξεκινά τον πίνακα και το proxy (όταν δεν τρέχουν υπό systemd). | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-α--manage_adminsh-χωρίς-root-χωρίς-εγκατάσταση) |
| `./manage_admin.sh stop` | Σταματά και τα δύο. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-α--manage_adminsh-χωρίς-root-χωρίς-εγκατάσταση) |
| `./manage_admin.sh status` | Δείχνει αν τρέχουν, με τα PID τους. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-α--manage_adminsh-χωρίς-root-χωρίς-εγκατάσταση) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Επανεκκινεί πίνακα και proxy υπό systemd (ο δέκτης συνεχίζει να τρέχει). | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#επανεκκίνηση-του-πίνακα) |
| `sudo systemctl enable --now phantomsdr-admin` | Ξεκινά τον πίνακα τώρα και σε κάθε boot (ομοίως το `phantomsdr-proxy`). | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-β--μονάδες-systemd-εκκίνηση-με-το-boot-επανεκκίνηση-μετά-από-κατάρρευση) |
| `sudo systemctl disable --now phantomsdr-admin` | Σταματά τον πίνακα και δεν τον ξεκινά πια με το boot. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-β--μονάδες-systemd-εκκίνηση-με-το-boot-επανεκκίνηση-μετά-από-κατάρρευση) |
| `systemctl status phantomsdr-admin` | Δείχνει την κατάσταση του πίνακα (χωρίς sudo). | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-β--μονάδες-systemd-εκκίνηση-με-το-boot-επανεκκίνηση-μετά-από-κατάρρευση) |
| `sudo journalctl -u phantomsdr-admin -f` | Παρακολουθεί το log του πίνακα. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#μέθοδος-β--μονάδες-systemd-εκκίνηση-με-το-boot-επανεκκίνηση-μετά-από-κατάρρευση) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Δεσμεύει τον δαίμονα αποκωδικοποίησης autorun σε αυτούς τους πυρήνες CPU. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#χειροκίνητη-αντικατάσταση-καρφιτσώματος-cpu-προχωρημένα) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Εγκαθιστά την περιστροφή των logs του πίνακα, του proxy και του autorun. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#περιστροφή-των-proxylog-και-adminlog) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Δοκιμαστική εκτέλεση της περιστροφής των logs. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#περιστροφή-των-proxylog-και-adminlog) |

## Thermal guard

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `python3 thermal_guard.py --once` | Εμφανίζει τον αισθητήρα, το όριο και τα κατώφλια· δεν κάνει καμία ενέργεια. | [Thermal Guard](THERMAL_GUARD.md#2-γρήγορη-εκκίνηση) |
| `python3 thermal_guard.py --mode log` | Παρακολουθεί ζωντανά τη θερμοκρασία, μόνο καταγραφή (Ctrl-C για έξοδο). | [Thermal Guard](THERMAL_GUARD.md#7-λειτουργία-χωρίς-τον-πίνακα-διαχείρισης) |
| `python3 thermal_guard.py --mode stop+restart` | Το τρέχει οπλισμένο: σταματά τον δέκτη όταν ζεσταθεί και τον ξαναξεκινά όταν κρυώσει. | [Thermal Guard](THERMAL_GUARD.md#7-λειτουργία-χωρίς-τον-πίνακα-διαχείρισης) |
| `python3 thermal_guard.py --config FILE` | Χρησιμοποιεί άλλο αρχείο ρυθμίσεων. | [Thermal Guard](THERMAL_GUARD.md#7-λειτουργία-χωρίς-τον-πίνακα-διαχείρισης) |
| `./setup-cpufreq-perms.sh` | Επιτρέπει στο guard να χαμηλώνει τη συχνότητα της CPU χωρίς να τρέχει ως root. | [Thermal Guard](THERMAL_GUARD.md#8-ενεργοποίηση-του-σταδίου-throttle-χωρίς-root) |
| `sudo systemctl enable --now thermal-guard` | Τρέχει το guard ως δική του υπηρεσία (μόνο όταν δεν χρησιμοποιείται ο πίνακας διαχείρισης). | [Thermal Guard](THERMAL_GUARD.md#7-λειτουργία-χωρίς-τον-πίνακα-διαχείρισης) |

## Συνδέσεις, firewall και HTTPS

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./setup-firewall.sh --show` | Εμφανίζει τους κανόνες ορίων σύνδεσης του πυρήνα· δεν αλλάζει τίποτα. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ./setup-firewall.sh --check` | Ελέγχει τους κανόνες έναντι του πυρήνα σας. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ./setup-firewall.sh --apply` | Φορτώνει τους κανόνες, με αυτόματη αναίρεση σε 60 δευτερόλεπτα. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ./setup-firewall.sh --persist` | Φορτώνει ξανά τους κανόνες σε κάθε boot. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ./setup-firewall.sh --status` | Δείχνει τους μετρητές πακέτων κάθε κανόνα. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ./setup-firewall.sh --remove` | Αφαιρεί όλους τους κανόνες. | [Όρια συνδέσεων](CONNECTION_LIMITS.md#5-η-προστασία-στον-πυρήνα) |
| `sudo ufw allow 9000/tcp` | Ανοίγει τη δημόσια θύρα στο firewall ufw. | [Οδηγός εγκατάστασης](INSTALLATION.md#δεν-υπάρχει-πρόσβαση-από-άλλες-συσκευές) |
| `bash setup-https.sh` | Ενεργοποιεί HTTPS με δωρεάν πιστοποιητικό Let's Encrypt· το HTTP συνεχίζει να λειτουργεί. | [Ασφαλής πρόσβαση (HTTPS)](HTTPS.md#σε-σταθμό-που-ήδη-λειτουργεί) |
| `bash setup-https.sh --lan` | HTTPS μόνο μέσα στο τοπικό δίκτυο (οι browsers προειδοποιούν για το πιστοποιητικό). | [Ασφαλής πρόσβαση (HTTPS)](HTTPS.md#μόνο-για-το-τοπικό-δίκτυο----lan) |
| `bash setup-https.sh --status` | Δείχνει αν το HTTPS είναι ενεργό και αν το πιστοποιητικό απαντά. | [Ασφαλής πρόσβαση (HTTPS)](HTTPS.md#έλεγχος-και-απενεργοποίηση) |
| `bash setup-https.sh --remove` | Απενεργοποιεί το HTTPS· το απλό HTTP μένει ως έχει. | [Ασφαλής πρόσβαση (HTTPS)](HTTPS.md#έλεγχος-και-απενεργοποίηση) |

## Προαιρετικές υπηρεσίες

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `./install-stats-server.sh` | Εγκαθιστά τον διακομιστή στατιστικών (CPU, θερμοκρασία, χρήστες). | [Διακομιστής στατιστικών](../sdr-stats/readme_el.md#βήμα-1-εκτελέστε-το-σενάριο) |
| `sudo systemctl restart sdr-stats.service` | Τον επανεκκινεί (ομοίως `start`, `stop`, `status`). | [Διακομιστής στατιστικών](../sdr-stats/readme_el.md#διαχείριση-υπηρεσίας) |
| `sudo journalctl -u sdr-stats.service -f` | Παρακολουθεί το log του. | [Διακομιστής στατιστικών](../sdr-stats/readme_el.md#διαχείριση-υπηρεσίας) |
| `curl http://localhost:3001/api/system-stats` | Ελέγχει ότι απαντά. | [Διακομιστής στατιστικών](../sdr-stats/readme_el.md#δοκιμή-1-έλεγχος-του-σημείου-πρόσβασης-api) |
| `./install_rade.sh` | Εγκαθιστά το RADE / FreeDV sidecar (`install_rade_ubuntu22.sh` σε Ubuntu 22.04). | [RADE README](RADE_README.md#η-εγκατάσταση--ο-σύντομος-δρόμος) |
| `./rade.sh start` | Ξεκινά το RADE sidecar με τον επιτηρητή του. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `./rade.sh stop` | Το σταματά, μαζί με τον επιτηρητή και τις διεργασίες αποκωδικοποίησης. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `./rade.sh restart` | Το σταματά και το ξεκινά καθαρά. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `./rade.sh status` | Δείχνει αν τρέχει. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Το επανεκκινεί δίνοντας τρεις πυρήνες CPU σε κάθε ακροατή. | [RADE README](RADE_README.md#αν-οι-πυρήνες-κορεστούν-πριν-το-γόνατο) |
| `tail -f rade.log` | Παρακολουθεί το log του RADE. | [RADE README](RADE_README.md#έλεγχος-του-sidecar) |
| `python3 rade_loadtest.py` | Μετρά πόσους ακροατές RADE αντέχει αυτό το μηχάνημα. | [RADE README](RADE_README.md#προϋποθέσεις-1) |
| `./kiwi_install.sh` | Εγκαθιστά την εξομοίωση πελάτη KiwiSDR (για εφαρμογές Kiwi όπως το AetherSDR). | [Εξομοίωση πελάτη KiwiSDR](Aether_config.md#2-εγκατάσταση-της-γέφυρας) |
| `./setup_websdr_relay.sh` | Εγκαθιστά το relay που επιτρέπει στη διαφορική λήψη να χρησιμοποιεί ένα WebSDR ως δεύτερο δέκτη. | [Διαφορική λήψη](RECEIVE_DIVERSITY.md#εγκατάσταση-του-relay) |

## Έλεγχος πομποδέκτη (γέφυρα TCI)

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Δίνει στον χρήστη σας πρόσβαση στη σειριακή θύρα του πομποδέκτη (κάντε ξανά login μετά). | [Έλεγχος πομποδέκτη](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Διαβάζει τη συχνότητα του πομποδέκτη μέσω Hamlib — ελέγχει τη σύνδεση CAT (μοντέλο, θύρα, ταχύτητα για τον δικό σας). | [Έλεγχος πομποδέκτη](RIG_CONTROL.md#παράδειγμα-icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Τρέχει τη γέφυρα πάνω σε `rigctld` που ήδη τρέχει. | [Έλεγχος πομποδέκτη](RIG_CONTROL.md#παράδειγμα-yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Τρέχει τη γέφυρα οδηγώντας τον πομποδέκτη απευθείας μέσω `rigctl` (ο τρόπος για Windows). | [Έλεγχος πομποδέκτη](RIG_CONTROL.md#παράδειγμα-yaesu-ft-991a) |

## Έλεγχοι και αντιμετώπιση προβλημάτων

| Εντολή | Τι κάνει | Βλ. |
|---|---|---|
| `ss -tlnp` | Εμφανίζει τις θύρες σε ακρόαση και τα προγράμματα πίσω τους. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#χρήσιμες-χειροκίνητες-εντολές) |
| `sudo lsof -i :9002` | Δείχνει ποιο πρόγραμμα κρατά μια θύρα. | [Οδηγός εγκατάστασης](INSTALLATION.md#η-θύρα-χρησιμοποιείται-ήδη) |
| `pkill -f admin_server.py` | Τερματίζει πίνακα που ξεκίνησε με το χέρι (ομοίως το `proxy.py`). | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#χρήσιμες-χειροκίνητες-εντολές) |
| `sudo fuser -k 3000/tcp` | Ελευθερώνει θύρα που κρατά ένα κολλημένο πρόγραμμα. | [Πίνακας διαχείρισης](ADMIN_PANEL_SETUP.md#χρήσιμες-χειροκίνητες-εντολές) |
| `lsusb` | Εμφανίζει τις συσκευές USB — φαίνεται ο δέκτης; | [Οδηγός εγκατάστασης](INSTALLATION.md#δεν-βρέθηκε-το-rtl-sdr) |
| `sudo timedatectl set-ntp true` | Κρατά το ρολόι συγχρονισμένο — το χρειάζονται οι αποκωδικοποιητές FT8/FT4/WSPR. | [Οδηγός εγκατάστασης](INSTALLATION.md#το-meson-setup-σταματά-με-clock-skew-detected) |

## Εσωτερικά scripts (δεν εκτελούνται με το χέρι)

| Script | Τι κάνει | Βλ. |
|---|---|---|
| `start-*.sh --watchdog` | Ο επιτηρητής που ξεκινά για τον εαυτό του ένα script εκκίνησης. | [Οδηγός εγκατάστασης](INSTALLATION.md#1-δημιουργήστε-το-αρχείο-υπηρεσίας) |
| `setup-sdr-common.sh` | Κοινές βοηθητικές συναρτήσεις που φορτώνουν τα scripts οδηγών `setup-*.sh`. | [Δομή του έργου](PROJECT_STRUCTURE.md#δέντρο-καταλόγων) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | Η παλαιότερη αλυσίδα εκκίνησης, κρατημένη για υπάρχοντες σταθμούς· τα `start-*.sh` την αντικαθιστούν. | [Δομή του έργου](PROJECT_STRUCTURE.md#δέντρο-καταλόγων) |
