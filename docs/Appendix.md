# Appendix — Command Reference

Every command a sysop uses to run a PhantomSDR-Plus station, grouped by task, each with a one-line explanation. Run them from inside the `PhantomSDR-Plus` directory unless a line says otherwise. The step-by-step manual installation (dependencies, Node.js, OpenCL, building by hand) is not repeated here — see the [Installation Guide](INSTALLATION.md). The last column links to the section that explains the command; in the PDF the page number follows the link.

## Installing and setting up the station

| Command | What it does | See |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Downloads the project. | [README](README.md#installation) |
| `bash install.sh` | Full installer for Ubuntu/Debian: asks the station questions, installs, builds. | [Installation Guide](INSTALLATION.md#clone-the-repository-and-run-the-installer) |
| `bash install_fedora.sh` | The same installer for Fedora. | [Installation Guide](INSTALLATION.md#clone-the-repository-and-run-the-installer) |
| `bash install_arch.sh` | The same installer for Arch Linux. | [Installation Guide](INSTALLATION.md#clone-the-repository-and-run-the-installer) |
| `bash install_opensuse.sh` | The same installer for openSUSE. | [Installation Guide](INSTALLATION.md#clone-the-repository-and-run-the-installer) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Unattended install (here for an RX888 MkII); every question takes its default. | [Installation Guide](INSTALLATION.md#installing-unattended) |
| `chmod +x *.sh` | Makes the scripts executable again (for example after unpacking a zip). | [Installation Guide](INSTALLATION.md#updating-by-hand) |
| `bash configure-station.sh` | Station wizard: asks the questions, saves `station.conf`, writes every config file from it. | [Installation Guide](INSTALLATION.md#the-station-questions) |
| `bash configure-station.sh --ask` | Asks and saves `station.conf` only. | [Installation Guide](INSTALLATION.md#the-station-questions) |
| `bash configure-station.sh --apply` | Rewrites the config files from `station.conf` without asking. | [Installation Guide](INSTALLATION.md#the-station-questions) |
| `bash configure-station.sh --show` | Prints the current answers. | [Installation Guide](INSTALLATION.md#the-station-questions) |
| `./add-receiver.sh` | Adds one more receiver (for example an RTL-SDR for 2 m) next to the main one. | [Installation Guide](INSTALLATION.md#several-receivers-on-one-computer) |

## Receiver drivers

| Command | What it does | See |
|---|---|---|
| `./setup-rx888-udev.sh` | Installs the RX888 udev rules so it runs without sudo. | [Installation Guide](INSTALLATION.md#run-rx888_stream-without-sudo-udev-rules) |
| `./setup-rtlsdr.sh` | Installs the RTL-SDR driver; asks whether the stick is a Blog V4. | [Installation Guide](INSTALLATION.md#several-receivers-on-one-computer) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Installs the RTL-SDR Blog V4 driver without asking. | [Installation Guide](INSTALLATION.md#several-receivers-on-one-computer) |
| `./setup-rsp1a.sh` | Installs the open driver chain for the SDRplay RSP1A. | [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Installs the Airspy HF+ driver chain. | [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Installs the RigExpert Fobos driver chain. | [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Installs the HackRF package and its udev rule. | [Installation Guide](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Checks that an RTL-SDR stick is seen. | [Installation Guide](INSTALLATION.md#test-rtl-sdr) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Checks that the RSP1A is seen (`driver=fobos`, `driver=airspyhf` for the others). | [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Lists the SoapySDR drivers that are installed. | [Installation Guide](INSTALLATION.md#fobos-or-airspy-hf-not-found) |

## Starting and stopping the receiver

| Command | What it does | See |
|---|---|---|
| `./start-rx888mk2.sh` | Starts (or restarts) the RX888 MkII receiver with its watchdog and shows the log until it is up. | [README](README.md#basic-operation) |
| `./start-rtl.sh` | The same for an RTL-SDR. | [Installation Guide](INSTALLATION.md#1-test-run) |
| `./start-rsp1a.sh` | The same for an SDRplay RSP1A. | [README](README.md#basic-operation) |
| `./start-airspyhf.sh` | The same for an Airspy HF+. | [README](README.md#basic-operation) |
| `./start-hackrf.sh` | The same for a HackRF One. | [README](README.md#basic-operation) |
| `./start-fobos.sh` | The same for a Fobos, RF input (25–6000 MHz). | [README](README.md#basic-operation) |
| `./start-fobos-hf.sh` | The same for a Fobos, HF direct sampling (0–25 MHz). | [README](README.md#basic-operation) |
| `./start-all.sh` | Starts every receiver listed in `receivers.toml`. | [Several Receivers](MULTI_RECEIVER.md#5-starting-and-stopping) |
| `./start-rx888mk2.sh -q` | Any start script with `-q`: two lines of output instead of the live log. | [README](README.md#basic-operation) |
| `INSTANCE=vhf ./start-rtl.sh` | Starts a second receiver set up in `instances/vhf/`. | [Several Receivers](MULTI_RECEIVER.md#3-adding-a-second-receiver) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Pins the server to these CPU cores (`none` = no pinning). | [README](README.md#basic-operation) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Starts without the RADE sidecar. | [RADE README](RADE_README.md#sidecar-control) |
| `./stop-websdr.sh` | Stops every receiver of this installation and its watchdog. | [Installation Guide](INSTALLATION.md#7-stop-the-server) |
| `./stop-websdr.sh main` | Stops only the main receiver. | [Several Receivers](MULTI_RECEIVER.md#5-starting-and-stopping) |
| `./stop-websdr.sh vhf` | Stops only the receiver started with `INSTANCE=vhf`. | [Several Receivers](MULTI_RECEIVER.md#5-starting-and-stopping) |
| `tail -f logwebsdr.txt` | Follows the receiver's live log. | [Installation Guide](INSTALLATION.md#2-check-for-errors) |

## Starting at boot

| Command | What it does | See |
|---|---|---|
| `bash setup-autostart.sh` | Starts the receiver at boot (the start script named in `station.conf`). | [Installation Guide](INSTALLATION.md#setting-up-autostart) |
| `bash setup-autostart.sh start-rtl.sh` | The same, for a particular start script. | [Installation Guide](INSTALLATION.md#setting-up-autostart) |
| `bash setup-autostart.sh start-all.sh` | The same, for every receiver in `receivers.toml`. | [Installation Guide](INSTALLATION.md#setting-up-autostart) |
| `bash setup-autostart.sh --status` | Shows whether it is installed, and for which script. | [Installation Guide](INSTALLATION.md#setting-up-autostart) |
| `bash setup-autostart.sh --remove` | Stops starting at boot (the receiver keeps running now). | [Installation Guide](INSTALLATION.md#setting-up-autostart) |

## Building and updating

| Command | What it does | See |
|---|---|---|
| `./recompile.sh` | Rebuilds the server and/or the web page; asks what to build. | [Installation Guide](INSTALLATION.md#updating-by-hand) |
| `./recompile.sh --backend` | Rebuilds the server only. | [Installation Guide](INSTALLATION.md#updating-by-hand) |
| `./recompile.sh --frontend` | Rebuilds the web page only (desktop and /mobile). | [Installation Guide](INSTALLATION.md#updating-by-hand) |
| `./recompile.sh --both` | Rebuilds both. | [Installation Guide](INSTALLATION.md#updating-by-hand) |
| `cd frontend && ./build-all.sh` | Builds the desktop page and /mobile. | [Editing Variants](EDITING_VARIANTS.md#6-after-you-edit--rebuilding) |
| `cd frontend && ./build-default.sh` | Builds just the desktop page. | [Editing Variants](EDITING_VARIANTS.md#6-after-you-edit--rebuilding) |
| `cd frontend && ./build-mobile.sh` | Builds just /mobile. | [Editing Variants](EDITING_VARIANTS.md#6-after-you-edit--rebuilding) |
| `bash update.sh` | Reports what a new version would change, then asks whether to update. | [Installation Guide](INSTALLATION.md#running-it) |
| `./update.sh --check` | Reports only, never asks (for cron; exit code 10 = an update is waiting). | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --apply` | Updates, asking about the files you edited yourself. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --apply --yes` | Updates unattended; every file you edited is kept. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --apply --prune` | Also offers to delete files that were removed upstream. | [Installation Guide](INSTALLATION.md#running-it) |
| `./update.sh --from FILE` | Takes the new version from a `.zip`/`.tar.gz` or a folder — no network. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --ref v5.1.0` | Updates to a tag, branch or commit instead of the current tree. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --list-excludes` | Prints the files the updater never touches. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --verbose` | Lists every file, not only the first 40. | [Installation Guide](INSTALLATION.md#other-options) |
| `./update.sh --restore LAST` | Puts back the files the last update overwrote. | [Installation Guide](INSTALLATION.md#undoing-an-update) |
| `./update.sh --restore 20260923-164530` | Puts back the files from that particular run. | [Installation Guide](INSTALLATION.md#undoing-an-update) |

## Look of the page

| Command | What it does | See |
|---|---|---|
| `./waterfall.sh` | Changes the default minimum waterfall level; shows the current value and asks. | [README](README.md#waterfall-floor--waterfallsh) |
| `./waterfall.sh -v -15` | Sets it to −15 dB without asking (`-y` also skips the confirmations). | [README](README.md#waterfall-floor--waterfallsh) |
| `./waterfall.sh -s` | Shows the current values only. | [README](README.md#waterfall-floor--waterfallsh) |
| `./smeter_theme.sh` | Chooses the default S-meter theme from a menu. | [Editing Variants](EDITING_VARIANTS.md#the-three-meter-faces--and-smeter_themesh) |
| `./smeter_theme.sh vintage` | Sets that theme straight away, then offers the rebuild. | [Editing Variants](EDITING_VARIANTS.md#the-three-meter-faces--and-smeter_themesh) |
| `./smeter_theme.sh dark --build` | Sets it and rebuilds without asking (`--no-build` skips the rebuild). | [Editing Variants](EDITING_VARIANTS.md#the-three-meter-faces--and-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Applies to new visitors only; existing users keep theirs. | [Editing Variants](EDITING_VARIANTS.md#the-three-meter-faces--and-smeter_themesh) |

## Admin panel and proxy

| Command | What it does | See |
|---|---|---|
| `./setup_admin.sh` | Interactive setup of the admin panel: ports, scripts, thermal guard, systemd units. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#step-2--run-the-setup-script) |
| `./setup_admin.sh --sudoers` | Installs only the sudoers rule so the two units restart without a password. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#step-2--run-the-setup-script) |
| `./setup_admin.sh --proxy-only` | Installs only the proxy on the public port, for a station without the panel. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#step-2--run-the-setup-script) |
| `./manage_admin.sh start` | Starts the panel and the proxy (when they are not under systemd). | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-a--manage_adminsh-no-root-nothing-installed) |
| `./manage_admin.sh stop` | Stops both. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-a--manage_adminsh-no-root-nothing-installed) |
| `./manage_admin.sh status` | Shows whether they run, with their PIDs. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-a--manage_adminsh-no-root-nothing-installed) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Restarts panel and proxy under systemd (the receiver keeps running). | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#restarting-the-panel) |
| `sudo systemctl enable --now phantomsdr-admin` | Starts the panel now and at every boot (`phantomsdr-proxy` likewise). | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-b--systemd-units-starts-at-boot-restarts-after-a-crash) |
| `sudo systemctl disable --now phantomsdr-admin` | Stops the panel and no longer starts it at boot. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-b--systemd-units-starts-at-boot-restarts-after-a-crash) |
| `systemctl status phantomsdr-admin` | Shows the panel's state (no sudo needed). | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-b--systemd-units-starts-at-boot-restarts-after-a-crash) |
| `sudo journalctl -u phantomsdr-admin -f` | Follows the panel's log. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#method-b--systemd-units-starts-at-boot-restarts-after-a-crash) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Pins the autorun decoder daemon to these CPU cores. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#manual-cpu-pin-override-advanced) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Installs log rotation for the panel, proxy and autorun logs. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#rotating-proxylog-and-adminlog) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Dry run of the log rotation. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#rotating-proxylog-and-adminlog) |

## Thermal guard

| Command | What it does | See |
|---|---|---|
| `python3 thermal_guard.py --once` | Prints the sensor, trip point and thresholds; takes no action. | [Thermal Guard](THERMAL_GUARD.md#2-quick-start) |
| `python3 thermal_guard.py --mode log` | Watches the temperature live, logging only (Ctrl-C to quit). | [Thermal Guard](THERMAL_GUARD.md#7-running-it-without-the-admin-panel) |
| `python3 thermal_guard.py --mode stop+restart` | Runs it armed: stops the receiver when too hot, restarts it when cool. | [Thermal Guard](THERMAL_GUARD.md#7-running-it-without-the-admin-panel) |
| `python3 thermal_guard.py --config FILE` | Uses another configuration file. | [Thermal Guard](THERMAL_GUARD.md#7-running-it-without-the-admin-panel) |
| `./setup-cpufreq-perms.sh` | Lets the guard lower the CPU frequency without running as root. | [Thermal Guard](THERMAL_GUARD.md#8-enabling-the-throttle-stage-without-root) |
| `sudo systemctl enable --now thermal-guard` | Runs the guard as its own service (only when the admin panel is not used). | [Thermal Guard](THERMAL_GUARD.md#7-running-it-without-the-admin-panel) |

## Connections, firewall and HTTPS

| Command | What it does | See |
|---|---|---|
| `./setup-firewall.sh --show` | Prints the kernel connection-limit rules; changes nothing. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ./setup-firewall.sh --check` | Checks the rules against your kernel. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ./setup-firewall.sh --apply` | Loads the rules, with a 60-second automatic rollback. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ./setup-firewall.sh --persist` | Reloads the rules at every boot. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ./setup-firewall.sh --status` | Shows the per-rule packet counters. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ./setup-firewall.sh --remove` | Removes all of the rules. | [Connection Limits](CONNECTION_LIMITS.md#5-the-kernel-guard) |
| `sudo ufw allow 9000/tcp` | Opens the public port in the ufw firewall. | [Installation Guide](INSTALLATION.md#cant-access-from-other-devices) |
| `bash setup-https.sh` | Turns on HTTPS with a free Let's Encrypt certificate; HTTP keeps working. | [Secure Access (HTTPS)](HTTPS.md#on-a-station-that-already-runs) |
| `bash setup-https.sh --lan` | HTTPS inside the local network only (browsers warn about the certificate). | [Secure Access (HTTPS)](HTTPS.md#the-local-network-only----lan) |
| `bash setup-https.sh --status` | Shows whether HTTPS is on and the certificate answers. | [Secure Access (HTTPS)](HTTPS.md#checking-and-turning-it-off) |
| `bash setup-https.sh --remove` | Turns HTTPS off; plain HTTP stays as it is. | [Secure Access (HTTPS)](HTTPS.md#checking-and-turning-it-off) |

## Optional services

| Command | What it does | See |
|---|---|---|
| `./install-stats-server.sh` | Installs the statistics server (CPU, temperature, users). | [Statistics Server](sdr-stats/README.md#step-1-run-the-script) |
| `sudo systemctl restart sdr-stats.service` | Restarts it (`start`, `stop`, `status` likewise). | [Statistics Server](sdr-stats/README.md#service-management) |
| `sudo journalctl -u sdr-stats.service -f` | Follows its log. | [Statistics Server](sdr-stats/README.md#service-management) |
| `curl http://localhost:3001/api/system-stats` | Checks that it answers. | [Statistics Server](sdr-stats/README.md#test-1-check-api-endpoint) |
| `./install_rade.sh` | Installs the RADE / FreeDV decoder sidecar (`install_rade_ubuntu22.sh` on Ubuntu 22.04). | [RADE README](RADE_README.md#installing-it--the-short-way) |
| `./rade.sh start` | Starts the RADE sidecar with its watchdog. | [RADE README](RADE_README.md#sidecar-control) |
| `./rade.sh stop` | Stops it, its watchdog and its decoder processes. | [RADE README](RADE_README.md#sidecar-control) |
| `./rade.sh restart` | Stops and starts it cleanly. | [RADE README](RADE_README.md#sidecar-control) |
| `./rade.sh status` | Shows whether it runs. | [RADE README](RADE_README.md#sidecar-control) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Restarts it giving each listener three CPU cores. | [RADE README](RADE_README.md#if-cores-saturate-before-the-knee) |
| `tail -f rade.log` | Follows the RADE log. | [RADE README](RADE_README.md#sidecar-control) |
| `python3 rade_loadtest.py` | Measures how many RADE listeners this machine can carry. | [RADE README](RADE_README.md#requirements) |
| `./kiwi_install.sh` | Installs the KiwiSDR client emulation (for Kiwi apps such as AetherSDR). | [KiwiSDR Client Emulation](Aether_config.md#2-installing-the-bridge) |
| `./setup_websdr_relay.sh` | Installs the relay that lets receive diversity use a WebSDR as the second receiver. | [Receive Diversity](RECEIVE_DIVERSITY.md#installing-the-relay) |

## Rig control (TCI bridge)

| Command | What it does | See |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Gives your user access to the rig's serial port (log in again afterwards). | [Rig Control](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Reads the rig's frequency through Hamlib — checks the CAT link (model, port, speed for your rig). | [Rig Control](RIG_CONTROL.md#example-icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Runs the bridge against a `rigctld` already running. | [Rig Control](RIG_CONTROL.md#example-yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Runs the bridge driving the rig through `rigctl` directly (the way to use on Windows). | [Rig Control](RIG_CONTROL.md#example-yaesu-ft-991a) |

## Checking and troubleshooting

| Command | What it does | See |
|---|---|---|
| `ss -tlnp` | Lists the listening ports and the programs behind them. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#useful-manual-commands) |
| `sudo lsof -i :9002` | Shows which program holds a port. | [Installation Guide](INSTALLATION.md#port-already-in-use) |
| `pkill -f admin_server.py` | Ends a panel that was started by hand (`proxy.py` likewise). | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#useful-manual-commands) |
| `sudo fuser -k 3000/tcp` | Frees a port held by a stuck program. | [Admin Panel Setup](ADMIN_PANEL_SETUP.md#useful-manual-commands) |
| `lsusb` | Lists the USB devices — is the receiver seen? | [Installation Guide](INSTALLATION.md#rtl-sdr-not-found) |
| `sudo timedatectl set-ntp true` | Keeps the clock in sync — the FT8/FT4/WSPR decoders need it. | [Installation Guide](INSTALLATION.md#meson-setup-stops-with-clock-skew-detected) |

## Internal scripts (not run by hand)

| Script | What it does | See |
|---|---|---|
| `start-*.sh --watchdog` | The watchdog a start script launches for itself. | [Installation Guide](INSTALLATION.md#1-create-service-file) |
| `setup-sdr-common.sh` | Shared helpers sourced by the `setup-*.sh` driver installers. | [Project Structure](PROJECT_STRUCTURE.md#directory-tree) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | The older launcher chain, kept for existing stations; the `start-*.sh` scripts replace it. | [Project Structure](PROJECT_STRUCTURE.md#directory-tree) |
