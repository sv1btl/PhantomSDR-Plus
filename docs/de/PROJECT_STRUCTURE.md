# Projektstruktur von PhantomSDR-Plus

Dieses Dokument gibt einen umfassenden Überblick über die Verzeichnisstruktur von PhantomSDR-Plus, die Dateiorganisation und die Beziehungen zwischen den Komponenten.

---

## Inhaltsverzeichnis

1. [Verzeichnisbaum](#verzeichnisbaum)
2. [Wurzelverzeichnis](#wurzelverzeichnis)
3. [Quellcode (`src/`)](#quellcode-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Frequenzlisten (`frequencylist/`)](#frequenzlisten-frequencylist)
6. [Konfigurationsdateien](#konfigurationsdateien)
7. [Build-System](#build-system)

---

## Verzeichnisbaum
```
PhantomSDR-Plus
├── add-receiver.sh            # fügt einen weiteren Empfänger hinzu: Treiber, instances/<name>/, receivers.toml — siehe docs/MULTI_RECEIVER.md
├── ADDITIONAL_TERMS.md        # Zusatzbestimmungen nach GPL v3 Abschnitt 7: die Zeile „original from“ bleibt erhalten
├── admin_config.json
├── admin_server.py
├── autorun
│   ├── audiotap.js
│   ├── bandplan.js
│   ├── decodeworker.js
│   ├── index.js
│   ├── manager.js
│   ├── package.json
│   ├── pool.js
│   ├── probe-ft8.js
│   ├── probe-js8.js
│   ├── pskreporter.js
│   ├── spotparse.js
│   ├── wasm-shim.js
│   └── wsprnet.js
├── cf32_to_real.c             # Fobos HF: behält I aus dem CF32 von rx_sdr, auf s16 skaliert (gebaut von setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # alt: Watchdog der go.sh-Kette
├── config-airspyhf.toml
├── config.example.hackrf.toml
├── config.example.rtlsdr.toml
├── config-fobos-hf.toml
├── config-fobos.toml
├── config-hackrf.toml
├── config-rsp1a.toml
├── config-rtl.toml
├── config-rx888mk2.toml
├── config.toml
├── configure-station.sh       # der Stationsassistent: fragt einmal, schreibt station.conf, die .toml und site_information.json
├── connection_impl.hpp
├── docs
│   ├── ADMIN_PANEL_SETUP.md
│   ├── Aether_config.md
│   ├── CONNECTION_LIMITS.md
│   ├── de
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-DE.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── DECODERS.md
│   ├── EDITING_VARIANTS.md
│   ├── el
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-EL.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── es
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-ES.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── fr
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-FR.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── hr
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-HR.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── HTTPS.md
│   ├── INSTALLATION.md
│   ├── MULTI_RECEIVER.md
│   ├── PhantomSDR-Plus-Documentation-EN.pdf
│   ├── PROJECT_STRUCTURE.md
│   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   ├── RADE_README.md
│   ├── README.md
│   ├── RECEIVE_DIVERSITY.md
│   ├── RIG_CONTROL.md
│   ├── ru
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── HTTPS.md
│   │   ├── INSTALLATION.md
│   │   ├── MULTI_RECEIVER.md
│   │   ├── PhantomSDR-Plus-Documentation-RU.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── sdr-stats
│   │   ├── package.json
│   │   ├── readme_de.md
│   │   ├── readme_el.md
│   │   ├── readme_es.md
│   │   ├── readme_fr.md
│   │   ├── readme_hr.md
│   │   ├── README.md
│   │   └── readme_ru.md
│   ├── THERMAL_GUARD.md
│   ├── USER_GUIDE.md
│   ├── websdr2.png
│   ├── websdr3.png
│   └── websdr.png
├── favicon.ico
├── fftw_wisdom
├── fix_local_geo.py
├── frequencylist
│   ├── 0.TXT
│   ├── A26all00.TXT           # nicht im Repo: von update-markers.sh aus a26allx2.zip entpackt
│   ├── a26allx2.zip
│   ├── admin.txt
│   ├── antenna.txt
│   ├── broadcas.txt
│   ├── curl-output.txt
│   ├── currentUpdateFile.txt
│   ├── fmorg.txt
│   ├── generate-current-shortwave.py
│   ├── language.txt
│   ├── mymarkers.json
│   ├── README.md
│   ├── shortwavestations.json
│   ├── site.txt
│   └── update-markers.sh
├── frontend
│   ├── build-all.sh
│   ├── build-default.sh
│   ├── build-mobile.sh
│   ├── debug-title.sh
│   ├── favicon.ico
│   ├── fix-title-python.py
│   ├── index.html
│   ├── jsconfig.json
│   ├── LICENSE
│   ├── make-redirect-stubs.sh
│   ├── mobile
│   │   └── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── pnpm-lock.yaml
│   ├── postcss.config.cjs
│   ├── .prettierrc.json      # Prettier-Formatierungsregeln für die Frontend-Quellen
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # JS8-Wörterbuch, erst bei Bedarf geladen
│   │   │   └── js8.wasm       # JS8-Decoder, gebaut aus jsdsp/js8_wasm
│   │   ├── logo.jpg
│   │   ├── stats.html
│   │   ├── users.html
│   │   └── wf-message.json
│   ├── README.md
│   ├── site_information.json
│   ├── src
│   │   ├── app.css
│   │   ├── App.svelte
│   │   ├── assets
│   │   │   ├── amateurfrequencies.json
│   │   │   ├── background.jpg
│   │   │   ├── shortwavestations.json
│   │   │   ├── SSTV.png
│   │   │   ├── SSTV.svg
│   │   │   └── svelte.png
│   │   ├── audio.js
│   │   ├── audio-stream-worklet.js
│   │   ├── bands-config.js
│   │   ├── broadcastSchedules.js
│   │   ├── clientVersion.js
│   │   ├── cwDecoder.js
│   │   ├── cw.worker.js
│   │   ├── cwWorkerProxy.js
│   │   ├── decoder.worker.js
│   │   ├── diversity.js
│   │   ├── diversityList.js
│   │   ├── eventBus.js
│   │   ├── events.js
│   │   ├── fax.js
│   │   ├── fax.worker.js
│   │   ├── faxWorkerProxy.js
│   │   ├── fft.js
│   │   ├── flacLowLatency.js         # FLAC-Decoder, der jedes Paket beim Eintreffen abspielt
│   │   ├── fsk.js
│   │   ├── fsk.worker.js
│   │   ├── fskWorkerProxy.js
│   │   ├── kiwiSource.js
│   │   ├── lib
│   │   │   ├── backend.js
│   │   │   ├── BandSelector.svelte
│   │   │   ├── catsync.js
│   │   │   ├── chatReply.js              # Markierung und Zuordnung von Chat-Antworten
│   │   │   ├── CheckButton.svelte
│   │   │   ├── colormaps.js
│   │   │   ├── Counter.svelte
│   │   │   ├── DiversityPanel.svelte
│   │   │   ├── fftRadix2.js
│   │   │   ├── freedv-reporter.js
│   │   │   ├── FreeDVReporter.svelte
│   │   │   ├── FrequencyInput.svelte
│   │   │   ├── FrequencyMarkers.svelte
│   │   │   ├── FtxSpectrum.svelte
│   │   │   ├── hammeractions.js
│   │   │   ├── LineThroughButton.svelte
│   │   │   ├── Logger.svelte
│   │   │   ├── MagicEyeIndicator.svelte
│   │   │   ├── ModeIdChip.svelte
│   │   │   ├── ModesSelector.svelte
│   │   │   ├── opusMlDecoder.js
│   │   │   ├── PassbandTuner.svelte
│   │   │   ├── Popover.svelte
│   │   │   ├── QrssPanel.svelte
│   │   │   ├── receivers.js           # Daten der Empfängerauswahl (/receivers.json)
│   │   │   ├── rnnoise.js     # lädt RNNoise für die KI-Rauschunterdrückung
│   │   │   ├── rx.js                  # zu welchem Empfänger eine Seite gehört (?rx=)
│   │   │   ├── sideService.js         # wo die Seite RADE und das Relay findet (siteRade / siteRelay)
│   │   │   ├── SMeterAnalog.svelte
│   │   │   ├── SMeterDigital.svelte
│   │   │   ├── Spectrogram.svelte
│   │   │   ├── StatusIndicators.svelte
│   │   │   ├── storage.js
│   │   │   ├── sUnits.js              # S-Stufen-Skala je Frequenz (S9 = −93 dBm oberhalb 30 MHz)
│   │   │   ├── Tooltip.svelte
│   │   │   ├── version.js             # VERSION + ORIGIN_URL für die Empfängerseite und /mobile
│   │   │   ├── VersionSelector.svelte
│   │   │   ├── VideoAreaSelector.svelte
│   │   │   └── wrappers.js
│   │   ├── main.js
│   │   ├── mobile
│   │   │   ├── backend.js
│   │   │   ├── bookmarks.js
│   │   │   ├── main.js
│   │   │   ├── Mobile.svelte
│   │   │   └── tuning.js
│   │   ├── modeId.js
│   │   ├── modeId.worker.js
│   │   ├── modeIdWorkerProxy.js
│   │   ├── modePriors.js
│   │   ├── modules
│   │   │   ├── decode.wasm
│   │   │   ├── encode.wasm
│   │   │   ├── ft4.js
│   │   │   ├── ft8.js
│   │   │   ├── js8-decoder.js
│   │   │   ├── js8-format.js
│   │   │   ├── js8.js
│   │   │   ├── js8-reassembler.js
│   │   │   ├── js8-slots.js
│   │   │   ├── js8-tables.js
│   │   │   ├── package.json
│   │   │   ├── phantomsdrdsp_bg_fallback.js
│   │   │   ├── phantomsdrdsp_bg.js
│   │   │   ├── phantomsdrdsp_bg.wasm
│   │   │   ├── phantomsdrdsp_bg.wasm.d.ts
│   │   │   ├── phantomsdrdsp.d.ts
│   │   │   ├── phantomsdrdsp.js
│   │   │   ├── phantomsdrdsp_router.js
│   │   │   └── wspr.js
│   │   ├── olivia.js
│   │   ├── playoutControl.js         # misst die Verbindung, hält den Wiedergabepuffer klein
│   │   ├── psk31.js
│   │   ├── refused.js
│   │   ├── remoteSource.js
│   │   ├── scanner.js
│   │   ├── siteInfo.js               # site_information.json, überlagert mit der eigenen Kopie des Empfängers
│   │   ├── sstv.js
│   │   ├── sstv.worker.js
│   │   ├── sstvWorkerProxy.js
│   │   ├── uberSource.js
│   │   ├── unused
│   │   │   ├── AudioProcessor.js
│   │   │   ├── decoder.js
│   │   │   ├── decoding.js
│   │   │   ├── modules-emscripten
│   │   │   │   ├── dav1d.js
│   │   │   │   ├── dav1dnoWasm.js
│   │   │   │   ├── dav1dnoWasm.js.mem
│   │   │   │   ├── dav1d.wasm
│   │   │   │   ├── decode_ft8.js
│   │   │   │   ├── decode_ft8.wasm
│   │   │   │   ├── FoxenFlac.js
│   │   │   │   ├── jsDSP.js
│   │   │   │   ├── jsDSPnoWasm.js
│   │   │   │   ├── jsDSPnoWasm.js.mem
│   │   │   │   ├── jsDSPnoWasm.wasm
│   │   │   │   ├── jsDSP.wasm
│   │   │   │   ├── libzstd.js
│   │   │   │   ├── LiquidDSP.js
│   │   │   │   ├── opus.js
│   │   │   │   ├── opusnoWasm.js
│   │   │   │   ├── opusnoWasm.js.mem
│   │   │   │   ├── opus.wasm
│   │   │   │   ├── redsea.js
│   │   │   │   └── redsea.wasm
│   │   │   ├── unused.js
│   │   │   └── wrappers.js
│   │   ├── videoRecorder.js
│   │   ├── vite-env.d.ts
│   │   ├── waterfall.js
│   │   ├── webSdrCodec.js
│   │   └── webSdrSource.js
│   ├── stats.html
│   ├── svelte.config.js
│   ├── tailwind.config.cjs
│   └── vite.config.js
├── go.sh                      # alte Startkette, ersetzt durch start-<radio>.sh
├── install_arch.sh
├── install_fedora.sh
├── install_opensuse.sh
├── install_rade.sh
├── install_rade_ubuntu22.sh
├── install.sh
├── install-stats-server.sh
├── instances                  # weitere Empfänger, je ein Ordner (nicht in git) — siehe docs/MULTI_RECEIVER.md
├── instructions-for-airspy
├── instructions-for-rsp1a
├── jsdsp
│   ├── compilejs.sh
│   ├── configureredsea.sh
│   ├── extract_EXPORTED_FUNCTIONS.js
│   ├── ft8_wasm
│   │   ├── build_ft8_wasm.sh
│   │   ├── README.md
│   │   └── wasm_wrapper.c
│   ├── include
│   │   ├── avif
│   │   │   ├── avif.h
│   │   │   └── internal.h
│   │   └── liquid
│   │       └── liquid.h
│   ├── js8_wasm               # JS8-Decoder in C, als WebAssembly gebaut, mit Tests und Referenz-Prüfstand — siehe dessen README
│   │   ├── build_js8_wasm.sh
│   │   ├── check_against_reference.sh
│   │   ├── extract_js8_constants.py
│   │   ├── extract_js8_varicode.py
│   │   ├── js8_ab_test.mjs
│   │   ├── js8_autorun_test.mjs
│   │   ├── js8_chain_test.mjs
│   │   ├── js8_constants.c
│   │   ├── js8_constants.h
│   │   ├── js8_decode.c
│   │   ├── js8_decode.h
│   │   ├── js8_decode_test.c
│   │   ├── js8_encode.c
│   │   ├── js8_encode.h
│   │   ├── js8_frames_test.mjs
│   │   ├── js8_osd.c
│   │   ├── js8_osd.h
│   │   ├── js8_reassembly_test.mjs
│   │   ├── js8_roundtrip.c
│   │   ├── js8_slots_test.mjs
│   │   ├── js8_subtract.c
│   │   ├── js8_subtract.h
│   │   ├── js8_wasm_test.mjs
│   │   ├── js8_wasm_wrapper.c
│   │   ├── README.md
│   │   ├── reference
│   │   │   ├── build_in_container.sh
│   │   │   ├── build_reference_decoder.sh
│   │   │   ├── build_reference_frames.sh
│   │   │   ├── Containerfile
│   │   │   ├── Containerfile.decoder
│   │   │   ├── ref_decode.f90
│   │   │   ├── ref_decode.txt
│   │   │   ├── ref_frames.cpp
│   │   │   └── ref_frames.txt
│   │   ├── ref_gen.f90
│   │   └── run_tests.sh
│   ├── lib
│   │   ├── ANR.c
│   │   ├── arm_funcs.h
│   │   ├── CMSIS_DSP
│   │   │   ├── BUILDING.txt
│   │   │   └── LICENSE.txt
│   │   ├── dav1d.cpp
│   │   ├── NB.c
│   │   ├── NR_spectral.c
│   │   └── types.h
│   ├── redsea.js
│   ├── redsea.wasm
│   └── src
│       ├── index.js
│       ├── libzstd.js
│       ├── LiquidDSP.js
│       ├── NoiseProcessing.js
│       └── wbfmpll.cpp
├── kill.sh                    # alt: beendet die Serverprozesse, von go.sh aufgerufen
├── kiwi_install.sh             # installiert die KiwiSDR-Brücke in einen bestehenden Baum
├── LICENSE
├── logproxy                   # rotierte Kopien der Panel-/Proxy-/Autorun-Logs
├── logrotate
│   └── phantomsdr             # logrotate-Konfiguration für proxy.log + admin.log (Pfade vor der Installation anpassen)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # Beispiel-systemd-Unit für das Admin-Panel (Start beim Booten, Neustart nach Absturz)
├── phantomsdr-proxy.service   # Beispiel-systemd-Unit für den Proxy, zusammen mit der Panel-Unit zu installieren
├── phantomsdr-websdr-relay.service  # Beispiel-systemd-Unit für das WebSDR-Diversity-Relay
├── proxy.py                   # der eine öffentliche Port: Seite, /admin, /rade, /stats, /relay und ?rx=-Empfänger
├── rade_helper.py
├── rade_loadtest.csv          # Ausgabe von rade_loadtest.py (eine Zeile pro Laststufe)
├── rade_loadtest.py           # RADE-Lasttest: wie viele gleichzeitige Decoder die Maschine trägt — siehe docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh               # Neubau; --backend / --frontend / --both fragen nichts
├── receivers.toml.example     # Empfängerliste für proxy.py — nach receivers.toml kopieren
├── _relaunch.sh               # alt: verzögerter Neustart-Helfer der go.sh-Kette
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # Treiberkette Airspy HF+: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-autostart.sh         # Start beim Booten: phantomsdr-receiver.service für das Startskript aus station.conf
├── setup-cpufreq-perms.sh     # gibt der Gruppe Schreibrecht auf scaling_max_freq, damit der Wächter ohne root drosseln kann
├── setup-firewall.sh          # optionaler nftables-Flutschutz — siehe docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # Treiberkette Fobos: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: Paket hackrf der Distribution + udev (nichts gebaut)
├── setup-https.sh             # https:// davor: Caddy auf 443 mit Let's-Encrypt-Zertifikat — siehe docs/HTTPS.md
├── setup-rsp1a.sh             # Treiberkette RSP1A: libmirisdr-5 + SoapyMiri + rx_sdr + msi2500-Sperre + udev
├── setup-rtlsdr.sh            # RTL-SDR-Treiber: Paket der Distribution oder Blog-V4-Treiber aus dem Quelltext + DVB-Sperre + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # gemeinsame Hilfsfunktionen der drei setup-Skripte oben
├── setup_websdr_relay.sh      # installiert das WebSDR-Diversity-Relay (Port, Identität, systemd)
├── smeter_theme.sh
├── src
│   ├── audio.cpp
│   ├── audio.h
│   ├── chat.cpp
│   ├── chat.h
│   ├── client.cpp
│   ├── client.h
│   ├── compression.cpp
│   ├── compression.h
│   ├── crash_handler.cpp
│   ├── crash_handler.h
│   ├── events.cpp
│   ├── events.h
│   ├── fft.cpp
│   ├── fft_cuda.cu
│   ├── fft.h
│   ├── fft_impl.cpp
│   ├── fft_mkl.cpp
│   ├── http.cpp
│   ├── kiwi_bridge.h          # KiwiSDR-Protokollbrücke — siehe docs/Aether_config.md
│   ├── listing
│   │   ├── software_info.cpp
│   │   └── software_info.h
│   ├── samplereader.cpp
│   ├── samplereader.h
│   ├── signal.cpp
│   ├── signal.h
│   ├── spectrumserver.cpp
│   ├── spectrumserver.h
│   ├── utils
│   │   ├── audioprocessing.cpp
│   │   ├── audioprocessing.h
│   │   ├── dsp.cpp
│   │   └── dsp.h
│   ├── utils.cpp
│   ├── utils.h
│   ├── waterfallcompression.cpp
│   ├── waterfallcompression.h
│   ├── waterfall.cpp
│   ├── waterfall.h
│   ├── websocket.cpp
│   └── websocket.h
├── start-airspyhf.sh
├── start-all.sh               # startet jeden Empfänger aus receivers.toml
├── start-fobos-hf.sh
├── start-fobos.sh
├── start-hackrf.sh
├── start-rsp1a.sh
├── start-rtl.sh
├── start-rx888mk2.sh
├── station.conf               # die Antworten der Station an den Assistenten (nicht in git, von update.sh nie angetastet)
├── stop-websdr.sh
├── subprojects
│   ├── fftw3.wrap
│   ├── flac.wrap
│   ├── glaze.wrap
│   ├── libcds.wrap
│   ├── libflac.wrap
│   ├── libvolk.wrap
│   ├── ogg.wrap
│   ├── opus.wrap
│   ├── tomlplusplus-3.4.0
│   │   ├── CHANGELOG.md
│   │   ├── cmake
│   │   │   ├── install-rules.cmake
│   │   │   ├── project-is-top-level.cmake
│   │   │   ├── tomlplusplusConfig.cmake
│   │   │   ├── tomlplusplusConfig.cmake.meson.in
│   │   │   ├── tomlplusplusConfigVersion.cmake.meson.in
│   │   │   └── variables.cmake
│   │   ├── CMakeLists.txt
│   │   ├── CODE_OF_CONDUCT.md
│   │   ├── CONTRIBUTING.md
│   │   ├── cpp.hint
│   │   ├── docs
│   │   │   ├── images
│   │   │   │   ├── badge-awesome.svg
│   │   │   │   ├── badge-C++17.svg
│   │   │   │   ├── badge-gitter.svg
│   │   │   │   ├── badge-license-MIT.svg
│   │   │   │   ├── badge-TOML.svg
│   │   │   │   ├── banner.ai
│   │   │   │   ├── banner.png
│   │   │   │   ├── banner.svg
│   │   │   │   ├── favicon.ico
│   │   │   │   ├── logo.ai
│   │   │   │   └── logo.svg
│   │   │   ├── pages
│   │   │   │   └── main_page.md
│   │   │   └── poxy.toml
│   │   ├── examples
│   │   │   ├── benchmark_data.toml
│   │   │   ├── CMakeLists.txt
│   │   │   ├── error_printer.cpp
│   │   │   ├── error_printer.vcxproj
│   │   │   ├── examples.hpp
│   │   │   ├── example.toml
│   │   │   ├── merge_base.toml
│   │   │   ├── merge_overrides.toml
│   │   │   ├── meson.build
│   │   │   ├── parse_benchmark.cpp
│   │   │   ├── parse_benchmark.vcxproj
│   │   │   ├── simple_parser.cpp
│   │   │   ├── simple_parser.vcxproj
│   │   │   ├── toml_generator.cpp
│   │   │   ├── toml_generator.vcxproj
│   │   │   ├── toml_merger.cpp
│   │   │   ├── toml_merger.vcxproj
│   │   │   ├── toml_to_json_transcoder.cpp
│   │   │   └── toml_to_json_transcoder.vcxproj
│   │   ├── include
│   │   │   ├── meson.build
│   │   │   └── toml++
│   │   │       ├── impl
│   │   │       │   ├── array.hpp
│   │   │       │   ├── array.inl
│   │   │       │   ├── at_path.hpp
│   │   │       │   ├── at_path.inl
│   │   │       │   ├── date_time.hpp
│   │   │       │   ├── formatter.hpp
│   │   │       │   ├── formatter.inl
│   │   │       │   ├── forward_declarations.hpp
│   │   │       │   ├── header_end.hpp
│   │   │       │   ├── header_start.hpp
│   │   │       │   ├── json_formatter.hpp
│   │   │       │   ├── json_formatter.inl
│   │   │       │   ├── key.hpp
│   │   │       │   ├── make_node.hpp
│   │   │       │   ├── node.hpp
│   │   │       │   ├── node.inl
│   │   │       │   ├── node_view.hpp
│   │   │       │   ├── parse_error.hpp
│   │   │       │   ├── parse_result.hpp
│   │   │       │   ├── parser.hpp
│   │   │       │   ├── parser.inl
│   │   │       │   ├── path.hpp
│   │   │       │   ├── path.inl
│   │   │       │   ├── preprocessor.hpp
│   │   │       │   ├── print_to_stream.hpp
│   │   │       │   ├── print_to_stream.inl
│   │   │       │   ├── simd.hpp
│   │   │       │   ├── source_region.hpp
│   │   │       │   ├── std_except.hpp
│   │   │       │   ├── std_initializer_list.hpp
│   │   │       │   ├── std_map.hpp
│   │   │       │   ├── std_new.hpp
│   │   │       │   ├── std_optional.hpp
│   │   │       │   ├── std_string.hpp
│   │   │       │   ├── std_string.inl
│   │   │       │   ├── std_utility.hpp
│   │   │       │   ├── std_variant.hpp
│   │   │       │   ├── std_vector.hpp
│   │   │       │   ├── table.hpp
│   │   │       │   ├── table.inl
│   │   │       │   ├── toml_formatter.hpp
│   │   │       │   ├── toml_formatter.inl
│   │   │       │   ├── unicode_autogenerated.hpp
│   │   │       │   ├── unicode.hpp
│   │   │       │   ├── unicode.inl
│   │   │       │   ├── value.hpp
│   │   │       │   ├── version.hpp
│   │   │       │   ├── yaml_formatter.hpp
│   │   │       │   └── yaml_formatter.inl
│   │   │       ├── toml.h
│   │   │       └── toml.hpp
│   │   ├── LICENSE
│   │   ├── meson.build
│   │   ├── meson_options.txt
│   │   ├── README.md
│   │   ├── src
│   │   │   ├── meson.build
│   │   │   └── toml.cpp
│   │   ├── tests
│   │   │   ├── at_path.cpp
│   │   │   ├── conformance_burntsushi_invalid.cpp
│   │   │   ├── conformance_burntsushi_valid.cpp
│   │   │   ├── conformance_iarna_invalid.cpp
│   │   │   ├── conformance_iarna_valid.cpp
│   │   │   ├── cpp.hint
│   │   │   ├── for_each.cpp
│   │   │   ├── formatters.cpp
│   │   │   ├── impl_toml.cpp
│   │   │   ├── leakproof.hpp
│   │   │   ├── lib_catch2.hpp
│   │   │   ├── main.cpp
│   │   │   ├── manipulating_arrays.cpp
│   │   │   ├── manipulating_parse_result.cpp
│   │   │   ├── manipulating_tables.cpp
│   │   │   ├── manipulating_values.cpp
│   │   │   ├── meson.build
│   │   │   ├── odr_test_1.cpp
│   │   │   ├── odr_test_2.cpp
│   │   │   ├── parsing_arrays.cpp
│   │   │   ├── parsing_booleans.cpp
│   │   │   ├── parsing_comments.cpp
│   │   │   ├── parsing_dates_and_times.cpp
│   │   │   ├── parsing_floats.cpp
│   │   │   ├── parsing_integers.cpp
│   │   │   ├── parsing_key_value_pairs.cpp
│   │   │   ├── parsing_spec_example.cpp
│   │   │   ├── parsing_strings.cpp
│   │   │   ├── parsing_tables.cpp
│   │   │   ├── path.cpp
│   │   │   ├── settings.hpp
│   │   │   ├── tests.cpp
│   │   │   ├── tests.hpp
│   │   │   ├── user_feedback.cpp
│   │   │   ├── using_iterators.cpp
│   │   │   ├── visit.cpp
│   │   │   ├── vs
│   │   │   │   ├── odr_test.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest.vcxproj
│   │   │   │   ├── test_debug_x64_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_noexcept.vcxproj
│   │   │   │   ├── test_debug_x64_unrel.vcxproj
│   │   │   │   ├── test_debug_x64.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest.vcxproj
│   │   │   │   ├── test_debug_x86_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_noexcept.vcxproj
│   │   │   │   ├── test_debug_x86_unrel.vcxproj
│   │   │   │   ├── test_debug_x86.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest.vcxproj
│   │   │   │   ├── test_release_x64_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x64_noexcept.vcxproj
│   │   │   │   ├── test_release_x64_unrel.vcxproj
│   │   │   │   ├── test_release_x64.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest.vcxproj
│   │   │   │   ├── test_release_x86_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x86_noexcept.vcxproj
│   │   │   │   ├── test_release_x86_unrel.vcxproj
│   │   │   │   └── test_release_x86.vcxproj
│   │   │   └── windows_compat.cpp
│   │   ├── toml++.code-workspace
│   │   ├── toml.hpp
│   │   ├── toml++.natvis
│   │   ├── toml++.props
│   │   ├── toml++.sln
│   │   ├── toml-test
│   │   │   ├── meson.build
│   │   │   ├── README.md
│   │   │   ├── tt_decoder.cpp
│   │   │   ├── tt_decoder.vcxproj
│   │   │   ├── tt_encoder.cpp
│   │   │   ├── tt_encoder.vcxproj
│   │   │   └── tt.hpp
│   │   ├── toml++.vcxproj
│   │   ├── toml++.vcxproj.filters
│   │   ├── tools
│   │   │   ├── ci_single_header_check.py
│   │   │   ├── clang_format.bat
│   │   │   ├── generate_conformance_tests.py
│   │   │   ├── generate_single_header.bat
│   │   │   ├── generate_single_header.py
│   │   │   ├── generate_windows_test_targets.py
│   │   │   ├── requirements.txt
│   │   │   ├── utils.py
│   │   │   └── version.py
│   │   └── vendor
│   │       ├── catch.hpp
│   │       ├── json.hpp
│   │       └── README.md
│   ├── tomlplusplus.wrap
│   ├── websocketpp.wrap
│   ├── zlib.wrap
│   └── zstd.wrap
├── tci-bridge
│   └── tci-rigctld.mjs        # TCI-Server für Hamlib-Funkgeräte (IC-7300…), läuft beim Hörer — siehe docs/RIG_CONTROL.md
├── thermal_guard.py           # CPU-Überhitzungsschutz für das Admin-Panel (läuft auch eigenständig)
├── thermal-guard.service      # Beispiel-systemd-Unit für den Wächter, für Installationen ohne Admin-Panel
├── tmpfiles
│   └── phantomsdr-logs.conf   # hält admin.log + proxy.log im Besitz des Panel-Benutzers (Pfade vor der Installation anpassen)
├── update-known.txt           # Fingerabdrücke jeder veröffentlichten Fassung — update.sh unterscheidet alte von bearbeiteten Dateien
├── update.sh                  # Updater: Bericht, dann „update now?“; --check, --from, --make-known
├── waterfall.sh
├── websdr_relay.json.example  # Konfigurationsvorlage (Port, Limits, Stationskennung)
├── websdr_relay.py            # das Relay selbst — siehe docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # Boost-≥-1.87-Shim: ws_post statt io_service::post
├── websocketpp_asio_endpoint.hpp    # Boost-≥-1.87-Shim: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # Boost-≥-1.87-Shim für websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # alt: startet spectrumserver, von check-go.sh aufgerufen
```
---

## Wurzelverzeichnis

### Konfigurationsdateien

| Datei | Zweck | Wann zu ändern |
|-------|-------|----------------|
| `config.toml` | Standardkonfiguration | Ersteinrichtung, Tests |
| `config-rtl.toml` | RTL-SDR-spezifische Konfiguration | Bei Verwendung eines RTL-SDR |
| `config-rsp1a.toml` | Konfiguration für SDRplay RSP1A | Bei Verwendung eines RSP1A |
| `config-airspyhf.toml` | Konfiguration für Airspy HF+ | Bei Verwendung eines Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 Direktabtastung (0-25 MHz) | Bei Verwendung eines Fobos auf KW |
| `config-fobos.toml` | RigExpert Fobos SDR, RF-Zweig (25-6000 MHz) | Bei Verwendung eines Fobos oberhalb 25 MHz |
| `config-hackrf.toml` | Konfiguration für HackRF One | Bei Verwendung eines HackRF |
| `config-rx888mk2.toml` | Konfiguration für RX888 MK2 | Bei Verwendung eines RX888 |
| `config.example.hackrf.toml` | Beispiel für HackRF One | Bei Verwendung eines HackRF |
| `station.conf` | Die Antworten an den Stationsassistenten — Empfänger, Band, Station, Ports, Zusatzmodule. Geschrieben von `configure-station.sh`; die Startskripte und `proxy.py` lesen sie. Nie in git, von `update.sh` nie angetastet | Über `bash configure-station.sh` |

### Start-/Stopp- und Wartungsskripte

Jedes `start-*.sh` unten ist ein **eigenständiger Starter + Watchdog + Protokollierer**: Es beendet eine laufende Instanz, startet Empfänger + `spectrumserver`, löst sich in den Hintergrund ab, startet die Kette bei einem Absturz automatisch neu und protokolliert in `logwebsdr.txt`. Sie teilen sich ein Stopp-Skript und eine einzige `flock`-Sperre (es läuft immer nur ein Empfänger). Ändern Sie nur den Block **RECEIVER CONFIGURATION** am Anfang (Empfängerargumente / Konfiguration / Prozessname). Die sechs Startskripte aus derselben Vorlage (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) sind unterhalb dieses Blocks identisch; `start-rx888mk2.sh` ist ein eigenes Skript. Seit v5.0.0 können mehrere Empfänger nebeneinander laufen: Ein Startskript mit `INSTANCE=<name>` gestartet, bekommt der Empfänger seinen eigenen Ordner in `instances/<name>/` sowie eigenes Log, eigene Sperre und eigenen FIFO — siehe [Mehrere Empfänger](MULTI_RECEIVER.md).

| Skript | Zweck |
|--------|-------|
| `install.sh` | Automatische Installation und Build — zuerst die Stationsfragen, dann alles unbeaufsichtigt (auch `install_fedora.sh`, `install_arch.sh`, `install_opensuse.sh`) |
| `configure-station.sh` | Der Stationsassistent: Empfänger, Band, Station, Internet, Ports und Zusatzmodule, einmal gefragt und in `station.conf` gespeichert; daraus schreibt er die `.toml` des Empfängers, `site_information.json` und die Relay-Einstellungen, ändert nur die eigenen Schlüssel und sichert jede Datei vorher. `--show` zeigt die Antworten, `--apply` schreibt die Dateien daraus neu — siehe [Installationsanleitung](INSTALLATION.md) |
| `setup-autostart.sh` | Start beim Booten: installiert `phantomsdr-receiver.service`, das beim Booten das Startskript aus `station.conf` (oder das genannte) und beim Herunterfahren `stop-websdr.sh` ausführt, mit der Gruppe `plugdev`; `--remove` macht es rückgängig |
| `setup-https.sh` | Bietet den Empfänger zusätzlich über https:// an: installiert Caddy auf Port 443 mit einem Let's-Encrypt-Zertifikat für den DNS-Namen der Station (erneuert sich selbst) und richtet ihn auf den Loopback-Port `PORT_TLS` von `proxy.py`, wo der Proxy die echte Adresse jedes Besuchers von Caddy übernimmt. `--lan` für das lokale Netz mit Caddys eigenem Zertifikat, `--status`, `--remove`; die Stationsfragen rufen es auf, wenn https gewählt wird — siehe [Sicherer Zugang](HTTPS.md) |
| `add-receiver.sh` | Fügt diesem Rechner einen weiteren Empfänger hinzu: fragt, welcher Empfänger und was er abdeckt, installiert seinen Treiber, legt `instances/<name>/` und den Eintrag in `receivers.toml` an und bietet an, ihn zu starten und den Proxy neu zu starten. Die Installer bieten es am Ende an — siehe [Mehrere Empfänger](MULTI_RECEIVER.md) |
| `start-rtl.sh` | Start + Watchdog des Servers mit RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Start + Watchdog des Servers mit SDRplay RSP1A (`rx_sdr`); verwendet libmirisdr-5 oder die SDRplay-API, wenn diese installiert ist (`RX_DRIVER` erzwingt einen) |
| `start-airspyhf.sh` | Start + Watchdog des Servers mit Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Start + Watchdog des Servers mit RigExpert Fobos SDR, HF1/HF2 Direktabtastung (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Start + Watchdog des Servers mit RigExpert Fobos SDR, RF-Zweig (`rx_sdr`) |
| `start-hackrf.sh` | Start + Watchdog des Servers mit HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Start + Watchdog des Servers mit RX888 MK2 (`rx888_stream`) |
| `start-all.sh` | Startet jeden in `receivers.toml` aufgeführten Empfänger über sein eigenes Startskript — auf einer Station mit mehreren Empfängern als Startskript des Admin-Panels eintragen; siehe [Mehrere Empfänger](MULTI_RECEIVER.md) |
| `stop-websdr.sh` | Beendet Server + Watchdog — von allen Empfängern gemeinsam genutzt |
| `stop-websdr.sh <instanz>` | Stoppt nur einen Empfänger (`main` für den Hauptempfänger); ohne Argument stoppen wie bisher alle Empfänger |
| `setup-rx888-udev.sh` | Installiert udev-Regeln, damit `rx888_stream` des RX-888 ohne sudo läuft |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Installieren die SoapySDR-Treiberkette für RSP1A, Fobos oder Airspy HF+ — SoapySDR aus der Distribution, Treiber und rx_tools gebaut in `sdr_drivers/`, eine udev-Regel — auf jeder der vier unterstützten Distributionen. Die Installer-Optionen 3, 5 und 6 rufen sie auf; sie laufen auch allein. Gemeinsamer Code in `setup-sdr-common.sh` — siehe [Installationsanleitung](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Installiert das Paket `hackrf` der Distribution und eine udev-Regel für den HackRF One, auf jeder der vier unterstützten Distributionen; die Installer-Option 7 ruft es auf |
| `setup-rtlsdr.sh` | Installiert den RTL-SDR-Treiber auf jeder der vier unterstützten Distributionen — das Paket `rtl-sdr` der Distribution oder mit `RTL_V4=y` den aus dem Quelltext gebauten Treiber für den RTL-SDR Blog V4 —, sperrt den DVB-T-Treiber und legt eine udev-Regel an; `add-receiver.sh` ruft es auf |
| `setup-firewall.sh` | Optionaler Flutschutz auf Kernel-Ebene: lädt eine nftables-Tabelle mit einer Obergrenze gleichzeitiger Verbindungen und einer Rate je Quelladresse auf den Empfängerports, einer SSH-Bruteforce-Bremse und Windows-Dateifreigabe, die außerhalb privater Bereiche geschlossen wird. Braucht root, kann Sie nicht aussperren (policy accept, bestehende Verbindungen werden zuerst angenommen) und `--apply` nimmt sich selbst zurück, wenn nicht binnen 60 s bestätigt — siehe [Verbindungslimits](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Gibt einer Gruppe `cpufreq` Schreibzugriff auf das CPU-Frequenzlimit, damit die Throttle-Stufe des Wächters ohne root funktioniert. Installiert eine `tmpfiles.d`-Regel, damit es einen Neustart übersteht; `--revoke` macht es rückgängig |
| `update.sh` | Aktualisiert die Installation aus dem veröffentlichten Stand und lässt Konfiguration, Marker, Frequenzliste und eigene Änderungen in Ruhe: Bericht, Frage „Update these files now?“ (ENTER = nein), Sicherung, Anwenden und Neubau nur dessen, was sich geändert hat. `--check` für Cron, `--from` aus ZIP, Tarball oder Ordner ohne Netz — siehe [Installationsanleitung](INSTALLATION.md) |
| `update-known.txt` | Der SHA-256 jeder jemals veröffentlichten Fassung jeder Datei, mit jeder Version ausgeliefert, damit `update.sh` eine nur ältere Datei ohne Nachfrage aktualisiert. Geschrieben mit `bash update.sh --make-known` im Quellbaum |
| `recompile.sh` | Baut Backend und/oder Frontend neu und wählt die unter `/` ausgelieferte Variante. Mit `--backend`, `--frontend` oder `--both` fragt es nichts und behält die aktuelle Variante — so rufen `install.sh` und `update.sh` es auf |
| `smeter_theme.sh` | Standard-Skalenbild des analogen S-Meters (dark / amber / vintage) für alle Nutzer setzen und den Frontend-Neubau anbieten — siehe [Varianten bearbeiten](EDITING_VARIANTS.md) |
| `waterfall.sh` | Ändert die voreingestellte minimale Wasserfall-Ebene (dB) in `waterfall.js` + `App.svelte` — siehe [README](README.md) |
| `kiwi_install.sh` | Installiert die KiwiSDR-Client-Emulation in einen Baum, der sie noch nicht hat: patcht die Backend-Quellen, kopiert `src/kiwi_bridge.h` und fügt einen dokumentierten `[kiwi_emulation]`-Block in die Konfigurationsdateien im Wurzelverzeichnis ein. Idempotent, und sichert jede Datei, die es anfasst — siehe [Emulation von KiwiSDR-Clients](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Wird vom Empfänger nicht benutzt. Ein kleines Node.js-Programm, das ein Hörer neben seinem eigenen Transceiver ausführt: Es liest Frequenz, Betriebsart und Sendezustand aus Hamlibs `rigctld` und stellt sie auf Port 50001 als TCI bereit, sodass die Schaltfläche **TCI-CAT** der Seite ein Funkgerät ohne eigenes TCI steuern kann, etwa den IC-7300 — siehe [Transceiver-Steuerung](RIG_CONTROL.md) |

**Alte Startkette.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` und `_relaunch.sh` sind die vorige Generation von Start-, Watchdog- und Stoppskripten. Alles, was sie taten, steckt heute in jedem `start-<radio>.sh`, und das ist das, was Sie benutzen sollten. Sie liegen noch auf der Platte, weil bestehende Installationen sie referenzieren, und werden nicht mehr gepflegt.

### Datendateien

| Datei | Zweck | Format |
|-------|-------|--------|
| `markers.json` | Frequenz-Lesezeichen und -Marker | JSON |
| `chat_history.txt` | Chatnachrichten der Nutzer | Klartext |
| `favicon.ico` | Website-Symbol | ICO-Bild |
| `fftw_wisdom` | FFT-Optimierungsdaten | FFTW-Binärdatei |
| `phantom_fftw_wisdom` | Zusätzliche FFT-Optimierung | FFTW-Binärdatei |

### Admin-Panel und Spot-Reporting

| Datei | Zweck |
|-------|-------|
| `admin_server.py` | Das Admin-Panel selbst. Neben den Verwaltungsseiten betreibt es den Sampler der Seite **Graphen**: ein Hintergrund-Thread erfasst alle 2 Sekunden CPU-Takt, Last, Temperatur und Nutzer online und hält sie nur im Speicher — 1 Stunde in voller Auflösung plus 24 Stunden als 30-Sekunden-Mittelwerte. Es wird nichts auf die Festplatte geschrieben, der Verlauf geht beim Neustart verloren. |
| `admin_config.json` | Einstellungen des Admin-Panels (Passwort-Hash, Ports, Optionen, Schwellen des thermischen Schutzes) |
| `proxy.py` | Der öffentliche Port. Liefert die Seite aus und reicht `/admin` an das Panel sowie — auf einer mit dem Assistenten eingerichteten Station — `/rade`, `/stats` und `/relay` an die Dienste dahinter weiter, sodass nur ein Port weitergeleitet wird. Liest seine Ports aus `admin_config.json` oder, ohne Panel, aus `station.conf` (`setup_admin.sh --proxy-only`) |
| `thermal_guard.py` | CPU-Überhitzungsschutz. Stoppt den Server, wenn die CPU zu heiß wird, und startet ihn wieder, sobald sie abgekühlt ist; die Schwellen leitet er aus dem kritischen Grenzwert ab, den Ihre eigene CPU veröffentlicht, statt aus einer festen Zahl. Er versucht nie zu erkennen, was den Server überwacht — solange es zu heiß ist, wiederholt er den Stopp alle 2 Sekunden, sodass ein Watchdog, eine systemd-Unit oder ein Cron-Job, der ihn wiederbelebt, rückgängig gemacht wird, bis die Maschine abkühlt. Nur Standardbibliothek; wird von `admin_server.py` importiert (getaktet vom Graphen-Sampler) und läuft für Installationen ohne Panel auch eigenständig. Standardmäßig nur Protokollmodus, handelt also erst nach Aktivierung — siehe [Admin-Panel]siehe das [Thermal-Guard-Handbuch](THERMAL_GUARD.md) |
| `autorun/` | Der Spot-Reporting-Daemon — siehe [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Zu dekodierende Bänder/Betriebsarten, Identität und Ziele |
| `autorun-status.json` | Laufender Zustand des Daemons — speist die **Zähler des aktuellen Laufs** (die Kacheln je Decoder), die bei Stop/Start zurückgesetzt werden |
| `autorun-totals.json` | **Gesamtwerte seit Beginn** je Band und Betriebsart — die Zahl neben jedem Kontrollkästchen; vom Daemon geschrieben, damit sie Neustarts überstehen |

### Dateien des Build-Systems

| Datei | Zweck |
|-------|-------|
| `meson.build` | Hauptkonfiguration des Builds |
| `meson_options.txt` | Konfigurierbare Build-Optionen |
| `.gitattributes` | Attribute des Git-Repositories |

---

## Quellcode (`src/`)

Das Verzeichnis `src/` enthält die C++-Implementierung des Backends.

### Wichtige Komponenten

#### 1. Hauptanwendung (`main.cpp`)
- Wertet die Kommandozeilenargumente aus
- Lädt die Konfigurationsdatei
- Initialisiert die Serverkomponenten
- Startet die Ereignisschleife

#### 2. Spektrumserver (`spectrumserver.cpp`)
- Koordiniert alle Komponenten
- Verwaltet die Nutzerverbindungen
- Verteilt die Spektrumdaten
- Bearbeitet Nutzeranfragen

#### 3. SDR-Treiber (`drivers/`)
- Abstrakte Schnittstelle für SDR-Hardware
- Liest und formatiert Abtastdaten
- Behandelt gerätespezifische Funktionen

#### 4. DSP-Engine (`dsp/`)
- FFT-Berechnung (CPU-/GPU-beschleunigt)
- Demodulation (AM, FM, SSB, CW usw.)
- Audiofilterung und Resampling
- AGC und Rauschminderung

#### 5. Webserver (`server/`)
- WebSocket-Kommunikation
- Ausliefern statischer HTTP-Dateien
- Verwaltung der Nutzersitzungen
- Echtzeit-Datenstreaming

#### 6. Audiokodierung (`audio/`)
- FLAC-Kompression
- Opus-Kompression
- Optimierung des Streamings

---

## Frontend (`frontend/`)

Die mit Svelte und Vite erstellte webbasierte Benutzeroberfläche.


#### 1. Hauptanwendung (`App.svelte`)
- Oberste Komponente
- Layoutstruktur
- Orchestrierung der Komponenten
- **Decoder-Tastenreihe** — eine Taste je Decoder im Hauptpanel, direkt unter der Modus-Auswahl; ein Druck startet den Decoder und öffnet sein Fenster, ein erneuter Druck stoppt ihn. Sie hat die frühere Bandbreiten-Reihe ersetzt. RADEL/RADEU liegen stattdessen in `lib/ModesSelector.svelte`, neben der Modus-Auswahl und in den Pop-ups **Modes** und **Bands**.
- **Versionszeile** — „PhantomSDR+ | v5.0.0 original from github.com/sv1btl/PhantomSDR-Plus“, die Adresse als Link; dieselbe Zeile steht auf der Seite /mobile. Versionsnummer und Adresse stehen in `lib/version.js`; die Zeile ist eine Urhebernennung nach `ADDITIONAL_TERMS.md`.

#### 2. Wasserfallanzeige (`waterfall.js` + `lib/`)
- Canvas-basierte Darstellung von Spektrum und Wasserfall, Farbpaletten und die adaptive Auto-Anpassung, alles in `waterfall.js` (reines JS, keine Komponente)
- Interaktive Abstimmung über `lib/PassbandTuner.svelte`
- Bandplan- und Marker-Overlays über `lib/FrequencyMarkers.svelte`
- Das Audio-Spektrogramm ist eine eigene Komponente: `lib/Spectrogram.svelte`

#### 3. Bedienelemente (`App.svelte` + `lib/`)
- Frequenzeingabe/-anzeige — `lib/FrequencyInput.svelte`
- Betriebsartenwahl (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, Bandumschaltung — `lib/BandSelector.svelte`
- AGC/NR/NB und die übrigen Bedienelemente liegen in `App.svelte` selbst; eine eigene `Controls.svelte` gibt es nicht

#### 3a. Scanner (`scanner.js`)
- Kanalsuchlauf: führt den Empfänger über einen Bereich und hält beim ersten Kanal mit Signal an. Reines JS, keine Komponente — `App.svelte` liefert VFO, Betriebsart, Bandplan und den Abstimmaufruf und erhält den UI-Zustand über einen einzigen Callback zurück
- Die Schwelle ist ein Abstand in dB zum Grundrauschen des Bandes statt eines absoluten Pegels und nutzt das Rauschen, das `waterfall.js` ohnehin nachführt (`snrNoiseDb`), braucht also keine eigene Kalibrierung
- Zwei Arten, das Band zu durchlaufen: jeden Kanal abstimmen und hineinhören, oder zuerst das Spektrum prüfen und nur abstimmen, was sich nicht ausschließen lässt. Das Spektrum darf einen Kanal überspringen, aber nie auf einem anhalten — jeder Halt stammt aus einem echten Verweilen
- Der Bereich ist entweder das Band aus dem Bandplan oder genau der sichtbare Wasserfall; Fortsetzen nach Ruhe, die Höchstverweildauer und die Ausschlussliste liegen ebenfalls hier und werden in `localStorage` gesichert

#### 4. Audiosystem (`audio.js`)
- WebSocket-Audiostrom
- FLAC-/Opus-Dekodierung
- Steuerung der Audiowiedergabe
- Verteilt rohes PCM (vor AGC, Rauschminderung und Stummschaltung abgegriffen) an die Betriebsartendecoder
- KI-Rauschunterdrückung: `lib/rnnoise.js` lädt das RNNoise-WebAssembly-Modul (`@jitsi/rnnoise-wasm`) beim ersten Gebrauch; `audio.js` wendet es nur in Sprachbetriebsarten an, hinter dem Abgriff für die Decoder, sodass diese es nie hören
- FLAC läuft über `flacLowLatency.js`, das jedes Paket in dem Moment decodiert, in dem es eintrifft, und die tatsächliche Rate des Streams (zum Beispiel 12016,3 Hz) mit einem 64-Tap-Resampler (2,7 ms Verzögerung) auf 12000 Hz bringt. Der WASM-Decoder in `modules/` gab den Ton in festen Blöcken von 1024 Samples frei und hielt rund 160 ms zurück; er wird weiterhin für Opus, für Diversity-Quellen und für FLAC verwendet, wenn die Seite mit `?flac=wasm` geöffnet wird
- Steuerung des Wiedergabepuffers (`playoutControl.js`): `ArrivalMeter` misst, wie unregelmäßig die Pakete gemessen an der eigenen Zeitachse des Streams eintreffen, und die Drift zwischen dem Abtasttakt des Empfängers und der Soundkarte des Hörers; `CushionController` hält den kleinsten Pufferstand der letzten Minute nahe an der Reserve der gewählten Pufferstufe, indem er eine tonhöhengerechte Periode (`spliceOut` / `spliceIn`) des Tons zum Lautsprecher herausschneidet oder wiederholt. Decoder und Aufnahmen erhalten den unveränderten Stream. Gilt für den Pfad mit geplanten Puffern, den jeder Hörer einer reinen http-Station nutzt; `?drain=0` schaltet ihn ab, `?diag=1` zeigt seine Werte

#### 4a. Betriebsartendecoder und ihre Worker

Jeder der rechenintensiven Betriebsartendecoder läuft in einem eigenen Web Worker, sodass die Dekodierung niemals die Audiowiedergabe oder den Wasserfall blockiert. Sie folgen einem gemeinsamen Muster — drei Dateien je Decoder:

| Decoder | Engine | Worker | Proxy im Haupt-Thread |
|---------|--------|--------|------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF-FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- Die **Engine** ist reiner DSP-Code ohne Kenntnis von Workern und lässt sich daher auch direkt ausführen (Unit-Tests oder der Rückfall in den Haupt-Thread).
- Der **Worker** hält eine Engine-Instanz und leitet deren Ereignisse unverändert weiter.
- Der **Proxy** spiegelt die Methodenoberfläche der Engine, sodass `audio.js` ihn genau so aufruft, wie es den Decoder aufrufen würde. Er erzeugt den Worker verzögert beim ersten Einschalten und weicht auf die Ausführung im Haupt-Thread aus, wenn keine Worker verfügbar sind.

Zwei Details sind tragend: Das PCM wird in einen frischen Puffer **kopiert**, bevor es an den Worker übertragen wird (das Übertragen einer Sicht auf den Audio-Akkumulator würde diesen ablösen und die Wiedergabe beenden), und die `init`-Nachricht des Workers wendet die Konfiguration erneut auf eine bereits laufende Engine an, statt eine neue vorauszusetzen.

`fsk.js` bedient sowohl NAVTEX als auch FSK/RTTY aus einer Engine, je Instanz über ein `role`-Feld gewählt; jede Instanz besitzt ihren eigenen Zustand, sodass beide unabhängig laufen können.

Die Rolle `fsk` beherbergt zusätzlich zwei Decoder, die überhaupt kein FSK sind. Wird die Variante `psk31` oder `olivia` gewählt, übergibt `fsk.js` das Audio an `psk31.js` bzw. `olivia.js` statt an die eigene Diskriminatorkette, nutzt aber weiterhin dessen Konfiguration, Worker und Ereignis-Infrastruktur — `fsk.worker.js`, `fskWorkerProxy.js` und `audio.js` müssen von beiden Betriebsarten nichts wissen, und die Oberfläche verarbeitet durchgehend dieselben `char`/`status`/`metrics`-Ereignisse.

- `psk31.js` — BPSK31: komplexes Basisband, angepasstes Filter, Differenzdemodulation und Varicode, mit spektraler Grobsuche und einer Feinregelung über etwa ±25 Hz.
- `olivia.js` — Olivia MFSK: eine Portierung des MFSK-Empfängers von Pawel Jalocha aus fldigi (`pj_mfsk.h`, GPL-3, wie auch dieses Projekt), einschließlich der Walsh/Hadamard-Fehlerkorrektur und der blinden Synchronisationssuche über Blockphase und Frequenzversatz.
- `broadcastSchedules.js` — die UTC-Sendepläne, die FAX-, NAVTEX- und RTTY-Decoder als Voreinstellungen anbieten, aus den NOAA/NWS-Marine-Faxplänen und den veröffentlichten NAVTEX-Stationslisten

#### 4b. Empfangsdiversität (`diversity.js`)
- Verbindet den lokalen Empfänger mit einem zweiten anderswo und folgt dem Standort, der gerade das bessere Signal hat. Reines JS, keine Komponente — es sitzt an einer Nahtstelle in `audio.js`, die ihm das lokale PCM übergibt und wiedergibt, was zurückkommt
- **Auswahl, nicht Addition.** Zwei Standorte hören dieselbe Aussendung über verschiedene ionosphärische Wege, ihre Signalverläufe haben also unabhängige Phase; addiert klingt das kammgefiltert. Kohärentes Zusammenführen bräuchte einen gemeinsamen Takt, den zwei Empfänger über das Internet nicht teilen. Gemischt wird nur während einer 30-ms-Überblendung
- Die Ausrichtung korreliert die beiden **Audio-Hüllkurven** (logarithmische Leistung bei 100 Hz), nie die Signalverläufe — die Hüllkurve übersteht sowohl den Weg als auch jeden Codec. Eine Ausrichtung gilt erst, wenn eine zweite, unabhängige Suche zustimmt; das weist die überzeugte, aber falsche Verzögerung zurück, die zwei gegenphasig schwindende Standorte sonst liefern
- Der entfernte Strom wird zuerst auf die lokale Rate **eingerastet**. Zwei Empfänger sind zwei Takte und zwei Dezimierungsketten, ihr Audio trifft also bis zu 2% auseinander ein, selbst wenn beide 12 kHz melden — 240 Abtastwerte pro Sekunde Drift, die keine Korrelation hält. Das Verhältnis wird daraus gemessen, wie viele Abtastwerte jede Seite tatsächlich liefert, und von einem Resampler angewandt, der seine gebrochene Phase über Blockgrenzen mitführt, sodass ein beliebiges Verhältnis dauerhaft hält
- Die Standortwahl nutzt ein Perzentil-SNR, gemessen an **inhaltlich ausgerichteten** Abtastwerten, mit Hysterese, Haltezeit und einem schnellen Notausgang, wenn der aktive Standort zusammenbricht. Die Pegel werden Rauschen-zu-Rauschen angeglichen, damit ein Wechsel das Grundrauschen nicht verändert
- Die Decoder behalten den **lokalen** Datenstrom: FT8, JS8, WSPR und RADE integrieren kohärent über einen Zeitschlitz, und ein Wechsel mittendrin ist eine Phasenunstetigkeit, die die Dekodierung kosten kann

#### 4c. Diversitätsquellen (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Ein Vertrag — `onPcm` / `onState` / `tune` / `canReceive` — sodass `diversity.js` nie erfährt, was am anderen Ende hängt. Ein weiterer Empfängertyp ist eine neue Datei
- `remoteSource.js` — ein weiterer PhantomSDR-Plus über `/audio` (cbor + FLAC), nutzt `createDecoder()` aus `lib/wrappers.js`
- `kiwiSource.js` — ein KiwiSDR: `SND`-Rahmen, Big-Endian-PCM, samt dem 10-Byte-GPS-Zeitstempel, den ein Stereopaket vor das Audio setzt
- `uberSource.js` — ein UberSDR über sein eigenes `/ws`: Opus in einem 21-Byte-Kopf, Abstimmen über die offene Verbindung. Die Sitzungs-ID muss zuvor per `POST /connection` angemeldet werden und muss eine UUID sein
- `webSdrSource.js` — ein WebSDR, über `websdr_relay.py` auf diesem Server: der Browser kann sich nicht direkt verbinden, weil WebSDR den `Origin`-Header prüft und kein Skript ihn ändern darf. Abgestimmt wird per Textrahmen auf derselben Verbindung; die Bandabdeckung liefert das Relay
- `webSdrCodec.js` — das WebSDR-Audioformat: ein byteweise getaggter Strom, dessen komprimierte Blöcke einen 20-stufigen Leaky-LMS-Prädiktor speisen. Aus dem WebSDR-Client portiert und Sample für Sample dagegen geprüft
- `diversityList.js` — die Liste gespeicherter Empfänger und die Adressregeln der vier Typen, gemeinsam genutzt von der Desktop-Oberfläche und der Mobilseite, damit ein Format beiden dient. Dazu die Übertragung — ein kompakter Blob, sein QR-Code und ein Parser, der jede Form annimmt, die die beiden Seiten je geschrieben haben — sowie `browseUrl()`, das eine angewählte Adresse in eine zurückverwandelt, die ein Browser öffnen kann
- `lib/DiversityPanel.svelte` — die Oberfläche: Adresse, Quellentyp, SNR-Trim und Live-Status, dazu die gespeicherten Empfänger — benannt, frei sortierbar und als JSON-Datei exportier- und importierbar, je Quellentyp im `localStorage`. Bearbeitet wird alles innerhalb des Feldes: `prompt()` und `confirm()` blockieren den Main-Thread, über den die Audioblöcke in das Playback-Worklet geschoben werden. Eine Schaltfläche **▦ QR** zeichnet die Liste als scannbaren Code, denn `localStorage` gehört zu einem Browser und ein Telefon beginnt leer. `mobile/Mobile.svelte` bietet dieselbe Funktion in einem Reiter **Div**, im eigenen einfachen CSS jener Seite. Siehe [Empfangsdiversität](RECEIVE_DIVERSITY.md)

#### 4d. Modus-Erkennung (`modeId.js`, `modePriors.js`)
- Beantwortet „was höre ich da?". Sie liest denselben rohen PCM-Abgriff wie die Decoder und listet die wahrscheinlichen Betriebsarten nach Rang, damit man den richtigen Decoder wählt, statt alle zehn durchzuprobieren. Sie decodiert nie: sie misst physikalische Eigenschaften des Signals und bewertet sie gegen eine Tabelle bekannter Betriebsarten
- Die belegte Bandbreite ist die zusammenhängende −15-dB-Breite um die Spitze, bewusst kein 99-%-Leistungswert: Tastklicks legen lange Ausläufer auf das Leistungsintegral und ließen jede schmale Betriebsart um ein Vielfaches zu breit erscheinen. Die Symbolrate kommt aus der **Momentanfrequenz** statt aus Tonenergien, weil keine Integrationszeit zugleich einen 170-Hz-Hub und ein 100-Bd-Symbol auflösen kann. Die Tastrate kommt aus der Ein/Aus-Hüllkurve und dient zugleich als CW-Tempoanzeige
- `modePriors.js` bringt den einen Hinweis ein, den das Audio nicht tragen kann: wo Sie abgestimmt sind. Ein 100-Bd-/170-Hz-Signal auf 518 kHz ist NAVTEX; dasselbe Signal auf 14,070 MHz ist es nicht. Es gewichtet nur um, was das Signal ohnehin hergab, und erfindet nie einen Kandidaten
- FT8, JS8 und FT2 werden absichtlich als eine Gruppe gemeldet: an Bandbreite und Tonabstand allein sind sie nicht zu trennen, und etwas anderes zu behaupten wäre eine selbstbewusst falsche Antwort
- Unterhalb von etwa 10 dB SNR schweigt sie, statt zu raten
- Läuft in einem eigenen Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`) nach demselben Engine/Worker/Proxy-Muster wie die Decoder oben; das Ergebnis ist der Chip in `lib/ModeIdChip.svelte`

#### 4e. Abgewiesene Verbindungen (`refused.js`, `clientVersion.js`)

- `refused.js` ist das gemeinsame Vokabular für eine Verbindung, die der Server abweist: Schließcode **4003** (über einem Limit pro Adresse, oder die Seite ist älter als `[server] min_client_version`) und **4001** (ein Sysop-Rauswurf). Beide sind endgültig. `audio.js`, `waterfall.js` und `events.js` importieren alle `isRefusal()` von dort, denn alle drei öffnen eine Verbindung, die abgewiesen werden kann, und alle drei müssen dann ihr Init-Promise auflösen — sonst wartet die Seite ewig auf eine Verbindung, die nie kommt
- Nichts versucht es erneut. Eine abgebrochene `/audio`-Verbindung beendet die Sitzung mit Absicht: `/waterfall` und `/events` kamen mit einem Wiederverbinden nie zurück, eine erneut aufgebaute Sitzung war also lebendes Audio an einem eingefrorenen Wasserfall, und gegen ein Ratenlimit würde jeder Versuch genau die Abweisung verlängern, die er umgehen wollte. Die Desktop-Seite erklärt eine Abweisung beim Laden und hört einfach auf, wenn eine mitten in der Sitzung kommt; `/mobile` zeigt eine Zeile, die zum Neuladen auffordert
- `clientVersion.js` enthält eine einzige Ganzzahl, `CLIENT_VERSION`, die die Seite ihrer Audioverbindung als `/audio?v=N` anhängt. Der Server weist alles unterhalb von `[server] min_client_version` ab — so zwingt eine Station Tabs, die noch einen älteren Stand fahren, zum Neuladen, der einzige Hebel, den es gibt, da der Server JavaScript im Browser nicht mehr erreicht. Erhöhen Sie sie, wenn eine Frontend-Änderung von offenen Tabs nicht weiter ignoriert werden darf
- Vollständige Referenz: [Verbindungslimits](CONNECTION_LIMITS.md)

#### 4f. Chat-Antworten (`lib/chatReply.js`)
- Eine Antwort ist eine gewöhnliche Chat-Nachricht, die mit einer Markierung beginnt, welche die beantwortete Nachricht benennt: `[RE:<Zeitstempel>|<Name>]`. Der Server speichert und verteilt sie wie jede andere Zeile und braucht keine Änderung
- `chatReply.js` erzeugt und liest diese Markierung und ordnet Antworten eine Ebene tief unter ihrem Original an. `App.svelte` und `mobile/Mobile.svelte` verwenden es beide, sodass beide Seiten den Chat gleich gliedern
- Ist das Original bereits aus dem Verlauf von 20 Nachrichten des Servers verschwunden, bleibt die Antwort dort, wo sie eintraf, und zeigt nur Name und Uhrzeit dessen, worauf sie antwortet

#### 5. Zustandsverwaltung (`stores/`)
- Reaktive Datenspeicher
- Gemeinsamer Anwendungszustand
- Ereignisbehandlung

---

### Wichtige Funktionen

- Audioverarbeitung in Echtzeit
- Dekodierung digitaler Betriebsarten (FT8, RTTY usw.)
- Audiofilterung
- Spektrumanalyse

---


## Frequenzlisten (`frequencylist/`)

Die Frequenzmarken auf dem Wasserfall. `mymarkers.json` ist die Liste, die der Empfänger tatsächlich anzeigt; der Rest ist das Rohmaterial, das `update-markers.sh` daraus macht, aufgefrischt aus den Online-Sendeplänen. `README.md` in diesem Verzeichnis erklärt die Aktualisierung in allen sieben Sprachen.

```
frequencylist/
├── mymarkers.json            # die Marken, die der Empfänger zeigt — von Hand gepflegt, übersteht eine Aktualisierung
├── shortwavestations.json    # Kurzwellensender, erzeugt von generate-current-shortwave.py
├── 0.TXT                     # der globale A26-KW-Sendeplan, von update-markers.sh entpackt und ausgewertet
├── a26allx2.zip              # Quellarchiv, von update-markers.sh heruntergeladen
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # Hilfslisten aus derselben Quelle (Standorte, Sprachen, Betreiber, Antennen)
├── generate-current-shortwave.py
├── update-markers.sh         # frischt alles Obige aus den Online-Sendeplänen auf
└── README.md
```

### Format (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

---

## Konfigurationsdateien

### Serverkonfiguration (`.toml`-Dateien)

Aufbau der Konfigurationsdateien:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Limits pro Adresse — alle standardmäßig aus oder auf einem sinnvollen Wert,
# eine Konfiguration ohne sie verhält sich wie bisher. Siehe CONNECTION_LIMITS.md.
per_ip = 3              # gleichzeitige Hörer von einer Adresse
per_ip_rate = 40        # neue Verbindungen pro Minute von einer Adresse

[websdr]
# Online registration
register_online = true
name = "WebSDR Name"
antenna = "Antenna Type"
grid_locator = "AB12cd"
hostname = "domain.com"

[input]
# SDR input settings
sps = 2048000           # Sample rate
fft_size = 131072       # FFT size
frequency = 145000000   # Base frequency
signal = "iq"           # Signal type: "iq" or "real"
audio_sps = 12000       # Audio sample rate
audio_compression = "opus"  # "flac" or "opus"
accelerator = "opencl"  # "none", "cuda", "opencl"

[input.driver]
# Driver settings
name = "stdin"
format = "u8"           # Sample format

[input.defaults]
# User interface defaults
frequency = 145500000
modulation = "FM"
```

### Standortinformationen (`site_information.json`)

```json
{
  "siteSysop": "Operator Callsign",
  "siteSysopEmailAddress": "email@example.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Hardware specs",
  "siteSoftware": "Software version",
  "siteReceiver": "SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional notes",
  "siteIP": "http://domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Build-System

### Meson-Build-Konfiguration

#### `meson.build` (Wurzel)

Legt fest:
- Projektmetadaten
- Abhängigkeiten
- Compileroptionen
- Listen der Quelldateien
- Build-Ziele

#### `meson_options.txt`

Verfügbare Optionen:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Dateiabhängigkeiten

### Build-Abhängigkeiten des Backends

```
spectrumserver binary depends on:
├── C++ source files (src/**/*.cpp)
├── External libraries:
│   ├── FFTW3
│   ├── WebSocket++
│   ├── FLAC
│   ├── Opus
│   ├── Liquid-DSP
│   ├── Boost
│   ├── zlib
│   ├── zstd
│   └── OpenCL/CUDA (optional)
└── Subproject headers:
    ├── nlohmann/json
    └── toml11
```

### Build-Abhängigkeiten des Frontends

```
frontend/dist/ depends on:
├── Source files (frontend/src/**)
├── npm packages (node_modules/):
│   ├── Svelte
│   ├── Vite
│   ├── @wasm-audio-decoders/opus-ml
│   └── ...
└── Static assets (frontend/public/)
```

---

## Datenfluss

### Ablauf des Serverbetriebs

```
1. SDR Hardware → rtl_sdr/hackrf_transfer/etc.
                ↓
2. Sample Stream → stdin → spectrumserver
                ↓
3. spectrumserver:
   - FFT calculation (waterfall)
   - Demodulation (audio)
   - Compression (FLAC/Opus)
                ↓
4. WebSocket → Browser Client
                ↓
5. Browser:
   - Render waterfall
   - Decode and play audio
   - Display controls
```

### Ablauf der Nutzerinteraktion

```
1. User clicks on waterfall
                ↓
2. JavaScript sends frequency change request
                ↓
3. WebSocket → spectrumserver
                ↓
4. spectrumserver:
   - Updates demodulator frequency
   - Sends new audio stream
                ↓
5. Browser receives and plays new audio
```

---

## Leitfaden zum Ändern von Dateien

### Wenn Sie Backend-Code ändern (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Wenn Sie Frontend-Code ändern (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Wenn Sie die Konfiguration ändern (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Wenn Sie die Marker ändern (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Wichtige Pfade

### Laufzeitpfade

- **Konfiguration**: `./config-*.toml`
- **HTML-Wurzel**: `./frontend/dist/`
- **Marker**: `./markers.json`
- **Chatverlauf**: `./chat_history.txt`
- **FFTW-Wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Build-Pfade

- **Binärausgabe**: `./build/spectrumserver`
- **Frontend-Ausgabe**: `./frontend/dist/`
- **Node-Module**: `./frontend/node_modules/`

### Quellpfade

- **Backend-Quellen**: `./src/`
- **Frontend-Quellen**: `./frontend/src/`
- **DSP-Bibliotheken**: `./jsdsp/`

---

## Übliche Dateioperationen

### Eine neue SDR-Konfiguration hinzufügen

1. Vorhandene Konfiguration kopieren: `cp config-rtl.toml config-mydevice.toml`
2. Parameter bearbeiten: `nano config-mydevice.toml`
3. Startskript erstellen: `cp start-rtl.sh start-mydevice.sh`
4. Startskript bearbeiten: `nano start-mydevice.sh` — ändern Sie nur den Block **RECEIVER CONFIGURATION** am Anfang (`RX_LABEL`, `RX_COMM` = der Prozessname des Empfängers, `RX_ARGS`, `CONFIG`, `FIFO` sowie der `prestart`-Hook, falls das Gerät einen benötigt). Die darunterliegende Logik für Start/Watchdog/Protokollierung ist allgemein und muss nicht geändert werden.
5. Ausführbar machen: `chmod +x start-mydevice.sh`

> `stop-websdr.sh` beendet bereits jedes `start-*.sh --watchdog`; verwendet Ihr Empfänger einen anderen Prozessnamen als `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, ergänzen Sie dort zusätzlich eine Zeile `killall -9 <Name>`.

### Das Frontend anpassen

1. Quelle ändern: `nano frontend/src/App.svelte`
2. Neu bauen: `cd frontend && npm run build && cd ..`
3. Server neu starten: `./stop-websdr.sh && ./start-rtl.sh`

### Eigene Marker hinzufügen

1. Markerdatei bearbeiten: `nano markers.json`
2. Format:
   ```json
   {
     "markers": [
       {
         "frequency": 145500000,
         "label": "2m Calling",
         "mode": "FM"
       }
     ]
   }
   ```
3. Browser neu laden (kein Serverneustart nötig)

---

## Versionsverwaltung

### In Git zu verfolgende Dateien

- Quellcode (`src/`, `frontend/src/`, `jsdsp/`)
- Konfigurationsbeispiele (`config.example.*.toml`)
- Build-System (`meson.build`, `meson_options.txt`)
- Dokumentation (`*.md`, `docs/`)
- Skripte (`*.sh`)

### Eine Version veröffentlichen (Maintainer)

Vor dem Hochladen die Fingerabdruckliste erneuern, damit `update.sh` auf jeder Station die vorhandenen Fassungen als veröffentlichte erkennt:

```bash
# 1. die geänderten Dateien in die Upload-Kopie kopieren, dann:
bash update.sh --make-known /path/to/the/upload/copy
# 2. update-known.txt committen und ebenfalls in die Upload-Kopie kopieren
```

Die Liste wächst nur: Einträge früherer Versionen bleiben erhalten, sodass eine einmal veröffentlichte öffentliche Kopie in jeder späteren Version erkennbar bleibt.

### Zu ignorierende Dateien (`.gitignore`)

- Build-Ergebnisse (`build/`, `frontend/dist/`)
- Abhängigkeiten (`frontend/node_modules/`)
- Nutzerdaten (`chat_history.txt`)
- Persönliche Konfigurationen (`config-rtl.toml`, sofern angepasst)
- Binärdaten (`*.o`, `*.so`)

---

**Diese Strukturdokumentation soll Ihnen helfen, sich in der Codebasis von PhantomSDR-Plus zurechtzufinden und sie zu verstehen.**

Einrichtungsanweisungen finden Sie in [INSTALLATION.md](INSTALLATION.md). Hinweise zur Bedienung finden Sie in [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL, A7AOF, F1NSK & SV2AMK**
