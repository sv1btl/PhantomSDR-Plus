# Estructura del proyecto PhantomSDR-Plus

Este documento ofrece una visión general completa de la estructura de directorios de PhantomSDR-Plus, la organización de los archivos y las relaciones entre componentes.

---

## Índice

1. [Árbol de directorios](#árbol-de-directorios)
2. [Directorio raíz](#directorio-raíz)
3. [Código fuente (`src/`)](#código-fuente-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Listas de frecuencias (`frequencylist/`)](#listas-de-frecuencias-frequencylist)
6. [Archivos de configuración](#archivos-de-configuración)
7. [Sistema de compilación](#sistema-de-compilación)

---

## Árbol de directorios

*Solo las carpetas principales y los archivos con los que trabaja un sysop; la lista completa está en el propio repositorio.*

```
PhantomSDR-Plus
├── add-receiver.sh            # añade un receptor más: controlador, instances/<nombre>/, receivers.toml — vea docs/MULTI_RECEIVER.md
├── admin_server.py
├── autorun
├── config-rtl.toml
├── config.toml
├── configure-station.sh       # el asistente de la estación: pregunta una vez, escribe station.conf, el .toml y site_information.json
├── docs
├── drm                        # lo crea setup-drm.sh: src/ y bin/ (no está en git)
├── frequencylist
├── frontend
├── install.sh
├── instances                  # receptores adicionales, una carpeta cada uno (no en git) — vea docs/MULTI_RECEIVER.md
├── jsdsp
├── proxy.py                   # el único puerto público: la página, /admin, /rade, /stats, /relay y receptores ?rx=
├── rade_helper.py             # el sidecar RADE: V1 con ~/radae, V2 (beta) con ~/rade_c
├── recompile.sh               # recompilación; --backend / --frontend / --both no preguntan nada
├── receivers.toml.example     # lista de receptores para proxy.py — copiar a receivers.toml
├── setup-https.sh             # https:// delante: Caddy en el 443 con certificado de Let's Encrypt — vea docs/HTTPS.md
├── src
├── start-rtl.sh
├── start-rx888mk2.sh
├── station.conf               # las respuestas de la estación al asistente (no está en git, update.sh nunca lo toca)
├── stop-websdr.sh
├── subprojects
├── tci-bridge
├── thermal_guard.py           # Protección contra sobrecalentamiento de la CPU para el panel (también funciona sola)
├── update.sh                  # actualizador: informe, luego «update now?»; --check, --from, --make-known
└── websdr_relay.py            # el relé en sí — véase docs/RECEIVE_DIVERSITY.md
```
---

## Directorio raíz

### Archivos de configuración

| Archivo | Finalidad | Cuándo modificarlo |
|---------|-----------|--------------------|
| `config.toml` | Configuración por defecto | Configuración inicial, pruebas |
| `config-rtl.toml` | Configuración específica de RTL-SDR | Al usar un RTL-SDR |
| `config-rsp1a.toml` | Configuración de SDRplay RSP1A | Al usar un RSP1A |
| `config-airspyhf.toml` | Configuración de Airspy HF+ | Al usar un Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 en muestreo directo (0-25 MHz) | Al usar un Fobos en HF |
| `config-fobos.toml` | RigExpert Fobos SDR, rama RF (25-6000 MHz) | Al usar un Fobos por encima de 25 MHz |
| `config-hackrf.toml` | Configuración de HackRF One | Al usar un HackRF |
| `config-rx888mk2.toml` | Configuración de RX888 MK2 | Al usar un RX888 |
| `config.example.hackrf.toml` | Ejemplo para HackRF One | Al usar un HackRF |
| `station.conf` | Las respuestas al asistente de la estación — receptor, banda, estación, puertos, extras. Lo escribe `configure-station.sh`; lo leen los scripts de arranque y `proxy.py`. Nunca en git, `update.sh` nunca lo toca | Con `bash configure-station.sh` |
| `main.env` | El propio `instance.env` del receptor principal: su línea de argumentos (`RX888_ARGS` / `RX_ARGS`) con la ganancia fijada en Admin → Receivers → ✎ CHANGE SETTINGS. Cada script de arranque lo lee el último; no existe hasta que se guarda una ganancia. Nunca en git, `update.sh` nunca lo toca | Admin → Receivers, o a mano |

### Scripts de arranque, parada y mantenimiento

Cada `start-*.sh` de los siguientes es un **lanzador autónomo + watchdog + registrador**: detiene cualquier instancia en marcha, levanta el receptor y `spectrumserver`, pasa a segundo plano, reinicia automáticamente la cadena si se cae y registra en `logwebsdr.txt`. Comparten un único script de parada y un solo bloqueo `flock` (solo funciona un receptor a la vez). Edite únicamente el bloque **RECEIVER CONFIGURATION** de la parte superior de cada uno (argumentos del receptor / configuración / nombre del proceso). Los seis scripts de arranque hechos con la misma plantilla (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) son idénticos por debajo de ese bloque; `start-rx888mk2.sh` es un script propio. Desde la v5.0.0 pueden funcionar varios receptores a la vez: si un script de arranque se lanza con `INSTANCE=<nombre>`, ese receptor tiene su propia carpeta en `instances/<nombre>/` y su propio registro, bloqueo y FIFO — vea [Varios receptores](MULTI_RECEIVER.md).

| Script | Finalidad |
|--------|-----------|
| `install.sh` | Instalación y compilación automáticas — primero las preguntas de la estación, después todo desatendido (también `install_fedora.sh`, `install_arch.sh`, `install_opensuse.sh`) |
| `configure-station.sh` | El asistente de la estación: receptor, banda, estación, internet, puertos y extras, preguntados una vez y guardados en `station.conf`; a partir de él escribe el `.toml` del receptor, `site_information.json` y la configuración del relay, cambiando solo sus propias claves y guardando antes una copia de cada archivo. `--show` muestra las respuestas, `--apply` reescribe los archivos a partir de ellas — vea la [Guía de instalación](INSTALLATION.md) |
| `setup-autostart.sh` | Arranque al encender: instala `phantomsdr-receiver.service`, que ejecuta el script de arranque de `station.conf` (o el indicado) al encender y `stop-websdr.sh` al apagar, con el grupo `plugdev`; `--remove` lo deshace |
| `setup-https.sh` | Sirve el receptor por https:// además de http://: instala Caddy en el puerto 443 con un certificado de Let's Encrypt para el nombre DNS de la estación (se renueva solo) y lo dirige al puerto de loopback `PORT_TLS` de `proxy.py`, donde el proxy toma de Caddy la dirección real de cada visitante. `--lan` para la red local con el certificado propio de Caddy, `--status`, `--remove`; las preguntas de la estación lo ejecutan cuando se elige https — vea [Acceso seguro](HTTPS.md) |
| `add-receiver.sh` | Añade un receptor más a este ordenador: pregunta qué receptor y qué cubre, instala su controlador, crea `instances/<nombre>/` y la entrada en `receivers.toml`, y ofrece arrancarlo y reiniciar el proxy. Los instaladores lo ofrecen al final — vea [Varios receptores](MULTI_RECEIVER.md) |
| `start-rtl.sh` | Arranque + watchdog del servidor con RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Arranque + watchdog del servidor con SDRplay RSP1A (`rx_sdr`); usa libmirisdr-5, o la API de SDRplay cuando está instalada (`RX_DRIVER` fuerza uno) |
| `start-airspyhf.sh` | Arranque + watchdog del servidor con Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Arranque + watchdog del servidor con RigExpert Fobos SDR, HF1/HF2 en muestreo directo (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Arranque + watchdog del servidor con RigExpert Fobos SDR, rama RF (`rx_sdr`) |
| `start-hackrf.sh` | Arranque + watchdog del servidor con HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Arranque + watchdog del servidor con RX888 MK2 (`rx888_stream`) |
| `start-all.sh` | Arranca cada receptor de `receivers.toml` con su propio script — póngalo como script de arranque del panel de administración en una estación con varios receptores; vea [Varios receptores](MULTI_RECEIVER.md) |
| `stop-websdr.sh` | Detiene el servidor y su watchdog: compartido por todos los receptores |
| `stop-websdr.sh <instancia>` | Detiene un solo receptor (`main` para el principal); sin argumento se detienen todos, como antes |
| `setup-rx888-udev.sh` | Instala reglas udev para que `rx888_stream` del RX-888 funcione sin sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Instalan la cadena de driver SoapySDR del RSP1A, el Fobos o el Airspy HF+ — SoapySDR desde la distribución, driver y rx_tools compilados en `sdr_drivers/`, una regla udev — en cualquiera de las cuatro distribuciones admitidas. Las opciones 3, 5 y 6 del instalador los ejecutan; también funcionan solos. Código común en `setup-sdr-common.sh` — vea la [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Instala el paquete `hackrf` de la distribución y una regla udev para el HackRF One, en cualquiera de las cuatro distribuciones admitidas; la opción 7 del instalador lo ejecuta |
| `setup-rtlsdr.sh` | Instala el controlador RTL-SDR en cualquiera de las cuatro distribuciones admitidas — el paquete `rtl-sdr` de la distribución o, con `RTL_V4=y`, el controlador del RTL-SDR Blog V4 compilado desde el código —, bloquea el controlador DVB-T y añade una regla udev; lo ejecuta `add-receiver.sh` |
| `setup-firewall.sh` | Guardia de avalanchas opcional en el núcleo: carga una tabla nftables con un tope de conexiones simultáneas y una tasa por dirección de origen en los puertos del receptor, un freno contra fuerza bruta en SSH y la compartición de archivos de Windows cerrada fuera de los rangos privados. Necesita root, no puede dejarle fuera (policy accept, las conexiones establecidas se aceptan primero) y `--apply` se revierte solo si no se confirma en 60 s — vea [Límites de conexión](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Concede a un grupo `cpufreq` permiso de escritura sobre el límite de frecuencia de la CPU, para que la fase throttle del guardián funcione sin root. Instala una regla `tmpfiles.d` para que sobreviva a un reinicio; `--revoke` lo deshace |
| `update.sh` | Actualiza la instalación desde el árbol publicado sin tocar su configuración, marcadores, lista de frecuencias ni sus cambios locales: informa, pregunta «Update these files now?» (ENTER = no), hace copia, aplica y recompila solo lo que cambió. `--check` para cron, `--from` desde ZIP, tarball o carpeta sin red — vea la [Guía de instalación](INSTALLATION.md) |
| `update-known.txt` | El SHA-256 de cada versión de cada archivo publicada alguna vez, incluido en cada versión, para que `update.sh` actualice sin preguntar un archivo que solo es antiguo. Se escribe con `bash update.sh --make-known` en el árbol fuente |
| `recompile.sh` | Recompila el backend y/o el frontend y elige la variante servida en `/`. Con `--backend`, `--frontend` o `--both` no pregunta nada y conserva la variante actual — así lo llaman `install.sh` y `update.sh` |
| `smeter_theme.sh` | Fijar la esfera por defecto del S-meter analógico (dark / amber / vintage) para todos los usuarios y ofrecer la reconstrucción del frontend — véase [Editar variantes](https://github.com/sv1btl/PhantomSDR-Plus/blob/main/docs/es/EDITING_VARIANTS.md) |
| `waterfall.sh` | Cambia el nivel mínimo de cascada predeterminado (dB) en `waterfall.js` + `App.svelte` — véase [README](README.md) |
| `kiwi_install.sh` | Instala la emulación de clientes KiwiSDR en un árbol que no la tiene: parchea las fuentes del backend, copia `src/kiwi_bridge.h` y añade un bloque `[kiwi_emulation]` documentado a los archivos de configuración de la raíz. Idempotente, y respalda cada archivo que toca — véase [Emulación de clientes KiwiSDR](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | El receptor no lo usa. Un pequeño programa Node.js que el oyente ejecuta junto a su propio transceptor: lee frecuencia, modo y estado de transmisión del `rigctld` de Hamlib y los ofrece como TCI en el puerto 50001, para que el botón **TCI-CAT** de la página controle un equipo sin TCI propio, como el IC-7300 — ver [Control del transceptor](RIG_CONTROL.md) |

### Archivos de datos

| Archivo | Finalidad | Formato |
|---------|-----------|---------|
| `markers.json` | Marcadores de frecuencia | JSON |
| `chat_history.txt` | Mensajes de chat de los usuarios | Texto plano |
| `favicon.ico` | Icono del sitio web | Imagen ICO |
| `fftw_wisdom` | Datos de optimización de la FFT | Binario FFTW |
| `phantom_fftw_wisdom` | Optimización adicional de la FFT | Binario FFTW |

### Panel de administración y reporte de spots

| Archivo | Finalidad |
|---------|-----------|
| `admin_server.py` | El propio panel de administración. Además de las páginas de gestión ejecuta el muestreador de la página **Gráficos**: un hilo en segundo plano toma cada 2 segundos la frecuencia de CPU, la carga, la temperatura y los usuarios conectados, y los guarda solo en memoria: 1 hora a resolución completa más 24 horas de promedios de 30 segundos. No se escribe nada en disco, así que el historial se pierde al reiniciar. |
| `admin_config.json` | Ajustes del panel de administración (hash de contraseña, puertos, opciones, umbrales de la protección térmica) |
| `proxy.py` | El puerto público. Sirve la página y lleva `/admin` al panel y — en una estación configurada con el asistente — `/rade`, `/stats` y `/relay` a los servicios que hay detrás, de modo que solo se redirige un puerto. Lee sus puertos de `admin_config.json`, o de `station.conf` cuando no hay panel (`setup_admin.sh --proxy-only`) |
| `thermal_guard.py` | Protección contra sobrecalentamiento de la CPU. Detiene el servidor cuando la CPU se calienta demasiado y lo reinicia una vez fría, derivando sus umbrales del límite crítico que publica su propia CPU en lugar de una cifra fija. Nunca intenta identificar qué supervisa el servidor: mientras hay exceso de temperatura repite la parada cada 2 s, de modo que un watchdog, una unidad de systemd o una tarea cron que lo reviva queda deshecha hasta que la máquina se enfríe. Solo biblioteca estándar; lo importa `admin_server.py` (temporizado por el muestreador de Gráficos) y también se ejecuta por su cuenta en instalaciones sin panel. Por defecto solo registra, así que no actúa sobre nada hasta que se active — véase [Panel de administración]véase el [manual del Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | El demonio de reporte de spots — véase [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Qué bandas/modos decodificar y en qué horas UTC, identidad, destinos y arranque automático |
| `autorun-stopped` | Existe tras STOP en el panel: el arranque automático deja el demonio parado, también tras reiniciar, hasta START |
| `autorun-status.json` | Estado en vivo del demonio: alimenta los contadores **de la ejecución actual** (los paneles por decodificador), que se ponen a cero con Stop/Start |
| `autorun-totals.json` | Spots subidos **históricos** por banda y modo: el número junto a cada casilla; lo escribe el demonio para que sobreviva a los reinicios |

### Archivos del sistema de compilación

| Archivo | Finalidad |
|---------|-----------|
| `meson.build` | Configuración principal de compilación |
| `meson_options.txt` | Opciones de compilación configurables |
| `.gitattributes` | Atributos del repositorio Git |

---

## Código fuente (`src/`)

El directorio `src/` contiene la implementación del backend en C++.

### Componentes clave

#### 1. Aplicación principal (`main.cpp`)
- Analiza los argumentos de la línea de órdenes
- Carga el archivo de configuración
- Inicializa los componentes del servidor
- Arranca el bucle de eventos

#### 2. Servidor de espectro (`spectrumserver.cpp`)
- Coordina todos los componentes
- Gestiona las conexiones de los usuarios
- Distribuye los datos de espectro
- Atiende las peticiones de los usuarios

#### 3. Controladores de SDR (`drivers/`)
- Interfaz abstracta para el hardware SDR
- Lectura y formateo de los datos de muestras
- Manejo de las funciones propias de cada dispositivo

#### 4. Motor de DSP (`dsp/`)
- Cálculo de la FFT (acelerado por CPU/GPU)
- Demodulación (AM, FM, SSB, CW, etc.)
- Filtrado y remuestreo de audio
- AGC por oyente — Auto (ajustado por modo) o Fast / Medium / Slow como en un transceptor, elegido con la orden `agc_speed` (`utils/audioprocessing.cpp`) — y reducción de ruido

#### 5. Servidor web (`server/`)
- Comunicación por WebSocket
- Servicio de archivos estáticos por HTTP
- Gestión de sesiones de usuario
- Transmisión de datos en tiempo real

#### 6. Codificación de audio (`audio/`)
- Compresión FLAC
- Compresión Opus
- Optimización de la transmisión

---

## Frontend (`frontend/`)

La interfaz de usuario web construida con Svelte y Vite.


#### 1. Aplicación principal (`App.svelte`)
- Componente de nivel superior
- Estructura del diseño
- Orquestación de componentes
- **Fila de botones de decodificador** — un botón por decodificador en el panel principal, justo debajo del selector de modos; una pulsación inicia el decodificador y abre su ventana, una segunda lo detiene. Sustituyó a la antigua fila de ancho de banda. RADE-v2U/RADE-v1L/RADE-v1U están en `lib/ModesSelector.svelte`, junto al selector de modos y dentro de las ventanas emergentes **Modes** y **Bands**.
- **Línea de versión** — «PhantomSDR+ | v5.5.0 original from github.com/sv1btl/PhantomSDR-Plus», con la dirección como enlace; la misma línea aparece en la página /mobile. El número de versión y la dirección están en `lib/version.js`; la línea es una atribución de autoría cubierta por `ADDITIONAL_TERMS.md`.

#### 2. Cascada (`waterfall.js` + `lib/`)
- Representación del espectro y de la cascada en canvas y mapas de color en `waterfall.js` (JS puro, no un componente); el reajuste de brillo/contraste de **Auto Adj.** es `lib/wfAutoLevel.js`
- Sintonía interactiva mediante `lib/PassbandTuner.svelte`
- Superposiciones del plan de bandas y de los marcadores mediante `lib/FrequencyMarkers.svelte`
- El analizador de audio es `lib/Spectrogram.svelte`, el informe de audio SSB `lib/SsbReport.svelte` y el informe de AM/FM `lib/AmFmReport.svelte`; sus medidas de RF (ancho ocupado, portadora y banda lateral opuesta en SSB, profundidad de AM y desviación de FM, la vista RF en AM/FM) salen de `measureOccupied`, `measureSsb`, `measureAmFm` y `getRfSlice` en `waterfall.js`, que con el analizador abierto mantiene una conexión de cascada invisible y de resolución fina en torno a la frecuencia sintonizada (`detailFollow`), de modo que funcionan con cualquier zoom; adaptado de PhantomSDR-ORSAT, de F1NSK
- El espectro 3D es `lib/Waterfall3D.svelte` (WebGL2): mientras está abierto, `waterfall.js` le entrega a través de `waterfall.view3d` cada línea con los niveles de la cascada (Min/Max y Auto Adj. aplicados), el rango de zoom y el mapa de color; adaptado de PhantomSDR-ORSAT, de F1NSK

#### 3. Controles (`App.svelte` + `lib/`)
- Entrada e indicación de frecuencia — `lib/FrequencyInput.svelte`
- Teclado numérico para escribir una frecuencia — `lib/FreqKeypad.svelte`; la frecuencia escrita se sintoniza con el zoom, Min/Max y modo de su banda (`tuneTypedFrequency()` en `App.svelte`), y una que cubre otro receptor abre ese receptor
- Franjas **Show All** de los demás receptores — `lib/RxStrip.svelte`: un socket `/waterfall?rx=<id>` cada una, todos los fotogramas decodificados y dibujados, con la paleta y los niveles del otro receptor, la línea más reciente arriba; los rangos de los receptores y los enlaces entre ellos vienen de `lib/receivers.js`; con dos o más bandas en el rango del otro receptor, una lista desplegable de bandas en su cabecera (elección en `localStorage` `rxStripView:<id>`, el clic llega con `&band=1`)
- Selección de modo (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, cambio de banda — `lib/BandSelector.svelte`
- Ventana EiBi — `lib/SwSchedule.svelte`: busca en `/eibi.json` con los criterios de shortwave.live; una fila sintoniza por el camino del clic en un marcador (`handleFrequencyMarkerClick()` en `App.svelte`, por eso los modos de decodificador arrancan su decodificador), y sus resultados verdes y el marcador rojo de «escuchando ahora» los dibuja `lib/FrequencyMarkers.svelte`, y **Hide HFCC markers** oculta las entradas de `markers.json` que `update-markers.sh` marca con `"source": "hfcc"`; las filas CW se sintonizan con el modo de marcador `MORSE`, así que abren el decodificador CW
- AGC/NR/NB y el resto de controles están en el propio `App.svelte`; no existe un `Controls.svelte` aparte

#### 3a. Escáner (`scanner.js`)
- Explorador de canales: recorre el receptor por un margen y se detiene en el primer canal con señal. JS puro, no un componente — `App.svelte` aporta el VFO, el modo, el plan de bandas y la llamada de sintonía, y recibe de vuelta el estado de la interfaz por una sola función de retorno
- El umbral es en dB sobre el ruido de fondo de la banda en vez de un nivel absoluto, reutilizando el ruido que `waterfall.js` ya sigue (`snrNoiseDb`), así que no necesita calibración propia
- Dos maneras de recorrer la banda: sintonizar y escuchar cada canal, o examinar antes el espectro y sintonizar sólo lo que no pueda descartarse. El espectro puede saltarse un canal pero nunca detenerse en uno — toda parada procede de una escucha real
- El margen es la banda del plan de bandas o exactamente lo que muestra la cascada; la reanudación automática, el tiempo máximo de permanencia y la lista de exclusión también viven aquí, guardados en `localStorage`

#### 4. Sistema de audio (`audio.js`)
- Flujo de audio por WebSocket
- Decodificación FLAC/Opus
- Control de la reproducción de audio
- Distribuye el PCM en bruto (tomado antes de la reducción de ruido y el silenciado del navegador; el AGC del servidor se mantiene en Slow mientras haya un decodificador abierto) a los decodificadores de modo
- Reducción de ruido por IA: `lib/rnnoise.js` carga el módulo WebAssembly de RNNoise (`@jitsi/rnnoise-wasm`) en el primer uso; `audio.js` lo aplica solo en modos de voz, después de la toma de los decodificadores, así que estos nunca lo oyen
- FLAC pasa por `flacLowLatency.js`, que decodifica cada paquete en el momento en que llega y lleva la frecuencia real del flujo (por ejemplo 12016,3 Hz) a 12000 Hz con un remuestreador de 64 coeficientes (2,7 ms de retardo). El decodificador WASM de `modules/` entregaba el audio en bloques fijos de 1024 muestras y retenía unos 160 ms; se sigue usando para Opus, para las fuentes de diversidad y para FLAC cuando la página se abre con `?flac=wasm`
- Control del búfer de reproducción (`playoutControl.js`): `ArrivalMeter` mide lo irregular que es la llegada de los paquetes respecto a la propia línea de tiempo del flujo, y la deriva entre el reloj de muestreo del receptor y la tarjeta de sonido del oyente; `CushionController` mantiene el menor búfer del último minuto cerca del margen del paso de búfer elegido, recortando o repitiendo un periodo ajustado al tono (`spliceOut` / `spliceIn`) del audio que va al altavoz. Los decodificadores y las grabaciones reciben el flujo intacto. Se aplica a la ruta de búferes programados que usa todo oyente de una estación en http simple; `?drain=0` lo desactiva y `?diag=1` muestra sus cifras

#### 4a. Decodificadores de modo y sus workers

Cada uno de los decodificadores de modo más pesados se ejecuta en su propio Web Worker, de modo que la decodificación nunca bloquea la reproducción de audio ni la cascada. Todos siguen un mismo patrón: tres archivos por decodificador.

| Decodificador | Motor | Worker | Proxy en el hilo principal |
|---------------|-------|--------|-----------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| FAX de HF | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FLDIGI (ALE 2G HAM, FSK/RTTY, PSK31/63/125, QPSK, Olivia, Contestia, PSK Browser, Olivia Browser, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet/APRS) + SERVICES (Maritime FSK / SITOR, Weather RTTY, ALE 2G) | `fsk.js`, `psk31.js`, `olivia.js`, `mfsk.js`, `ifk.js`, `throb.js`, `hell.js`, `mt63.js`, `fldigiFec.js`, `ax25.js`, `ale.js`, `fst4w.js`, `msk144.js`, `pskBrowser.js`, `oliviaBrowser.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| SERVICES (DSC, Time Signals, HF Selcall) | `dsc.js`, `timesig.js` | `services.worker.js` | `servicesWorkerProxy.js` |
| CW, CW Browser | `cwDecoder.js`, `cwBrowser.js` | `cw.worker.js` | `cwWorkerProxy.js` |

#### 4b. Diversidad de recepción (`diversity.js`)
- Combina el receptor local con un segundo receptor en otro lugar y sigue al emplazamiento que en cada momento tiene mejor señal. JS puro, no un componente — se apoya en una única costura de `audio.js`, que le entrega el PCM local y reproduce lo que devuelve
- **Selección, no suma.** Dos emplazamientos oyen la misma emisión por caminos ionosféricos distintos, así que sus formas de onda tienen fase no relacionada; sumarlas suena a filtro de peine. La combinación coherente exigiría un reloj común, que dos receptores por internet no comparten. Solo se mezclan durante un fundido de 30 ms
- La alineación correla las dos **envolventes de audio** (potencia logarítmica a 100 Hz), nunca las formas de onda — la envolvente sobrevive al camino y a cualquier códec. Un enganche solo se acepta cuando una segunda búsqueda independiente coincide, lo que descarta el retardo rotundo pero equivocado que darían dos emplazamientos desvaneciéndose en antifase
- El flujo remoto se **enclava en velocidad** con el local antes que nada. Dos receptores son dos relojes y dos cadenas de diezmado, así que su audio llega hasta un 2% desparejado aunque ambos declaren 12 kHz — 240 muestras por segundo de deriva, que ninguna correlación aguanta. La relación se mide a partir de cuántas muestras entrega realmente cada lado y la aplica un remuestreador que arrastra su fase fraccionaria entre bloques, de modo que una relación arbitraria se sostiene indefinidamente
- La elección de emplazamiento usa un SNR por percentiles medido sobre muestras **alineadas en contenido**, con histéresis, temporizador de permanencia y una salida rápida si el emplazamiento activo se hunde. Los niveles se igualan ruido contra ruido, de modo que un cambio no altera el siseo de fondo
- Los decodificadores conservan el flujo **local**: FT8, JS8, WSPR y RADE integran de forma coherente durante una ranura, y un cambio a mitad es una discontinuidad de fase que puede costar la decodificación

#### 4c. Fuentes de diversidad (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Un único contrato — `onPcm` / `onState` / `tune` / `canReceive` — de modo que `diversity.js` nunca sabe qué hay al otro lado. Añadir un tipo de receptor es un fichero nuevo
- `remoteSource.js` — otro PhantomSDR-Plus por `/audio` (cbor + FLAC), reutilizando `createDecoder()` de `lib/wrappers.js`
- `kiwiSource.js` — un KiwiSDR: tramas `SND`, PCM big-endian, con la marca de tiempo GPS de 10 bytes que un paquete estéreo inserta antes del audio
- `uberSource.js` — un UberSDR por su `/ws` nativo: Opus tras una cabecera de 21 bytes, resintonizando sobre la conexión abierta. El identificador de sesión debe registrarse antes con `POST /connection` y debe ser un UUID
- `webSdrSource.js` — un WebSDR, a través de `websdr_relay.py` en este servidor: el navegador no puede conectarse directamente porque WebSDR comprueba la cabecera `Origin` y ningún script puede cambiarla. La sintonía va como trama de texto por la misma conexión; la cobertura de bandas la aporta el relé
- `webSdrCodec.js` — el formato de audio de WebSDR: un flujo etiquetado byte a byte cuyos bloques comprimidos alimentan un predictor leaky-LMS de 20 tomas. Portado del cliente de WebSDR y verificado muestra a muestra contra él
- `diversityList.js` — la lista de receptores guardados y las reglas de dirección de los cuatro tipos, compartidas por el panel de escritorio y la página móvil para que un solo formato sirva a ambos. También la transferencia — un blob compacto, su código QR y un analizador que acepta todas las formas que las dos páginas han escrito alguna vez — y `browseUrl()`, que devuelve una dirección marcada a una que un navegador puede abrir
- `lib/DiversityPanel.svelte` — la interfaz: dirección, tipo de fuente, ajuste de SNR y estado en vivo, más los receptores guardados — con nombre, reordenables y exportables e importables como archivo JSON, por tipo de fuente en `localStorage`. Todo se edita dentro del panel: `prompt()` y `confirm()` bloquean el hilo principal, que es por donde el audio llega al worklet de reproducción. Un botón **▦ QR** dibuja la lista como código escaneable, porque `localStorage` pertenece a un navegador y un teléfono empieza vacío. `mobile/Mobile.svelte` lleva la misma función en una pestaña **Div**, con el CSS sencillo propio de esa página. Véase [Diversidad de recepción](RECEIVE_DIVERSITY.md)

#### 4d. Identificador de modo (`modeId.js`, `modePriors.js`)
- Responde a «¿qué estoy escuchando?». Lee la misma toma de PCM en bruto que los decodificadores y ordena los modos probables, para que el operador elija el decodificador correcto en vez de probar los diez. Nunca decodifica: mide propiedades físicas de la señal y las puntúa contra una tabla de modos conocidos
- El ancho ocupado es la anchura contigua a −15 dB alrededor del pico, deliberadamente no una cifra del 99 % de potencia: los clics de manipulación dejan colas largas en la integral de potencia y hacían que todo modo estrecho pareciera varias veces más ancho. La velocidad de símbolo sale de la **frecuencia instantánea** y no de las energías de los tonos, porque ninguna integración resuelve a la vez un desplazamiento de 170 Hz y un símbolo de 100 Bd. La velocidad de manipulación sale de la envolvente on/off y sirve además como lectura de velocidad en CW
- `modePriors.js` aporta la única pista que el audio no puede llevar: dónde está sintonizado. Una señal de 100 Bd / 170 Hz en 518 kHz es NAVTEX; la misma señal en 14,070 MHz no lo es. Solo repondera lo que la señal ya sostenía, y nunca inventa un candidato
- FT8, JS8 y FT2 se informan como un grupo a propósito: no se separan solo por ancho y separación de tonos, y fingir lo contrario sería una respuesta equivocada dicha con seguridad
- Por debajo de unos 10 dB de SNR calla en lugar de adivinar
- Corre en su propio Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), con el mismo patrón motor/worker/proxy que los decodificadores anteriores; el resultado es la etiqueta de `lib/ModeIdChip.svelte`

#### 4e. Conexiones rechazadas (`refused.js`, `clientVersion.js`)

- `refused.js` es el vocabulario compartido para una conexión que el servidor rechaza: código de cierre **4003** (por encima de un límite por dirección, o la página es anterior a `[server] min_client_version`) y **4001** (una expulsión del sysop). Ambos son definitivos. `audio.js`, `waterfall.js` y `events.js` importan `isRefusal()` de ahí, porque los tres abren una conexión que puede ser rechazada y los tres deben resolver su promesa de inicio cuando ocurre — si no, la página espera para siempre una conexión que nunca llegará
- Nada reintenta. Una conexión `/audio` caída termina la sesión a propósito: `/waterfall` y `/events` nunca volvían con una reconexión, así que una sesión reintentada era audio vivo sobre una cascada congelada, y frente a un límite de tasa cada intento alargaría justo el rechazo que trataba de sortear. La página de escritorio explica un rechazo que ocurre al cargar y simplemente se detiene cuando ocurre a mitad de sesión; `/mobile` muestra una línea pidiendo al oyente que recargue
- `clientVersion.js` contiene un único entero, `CLIENT_VERSION`, que la página añade a su conexión de audio como `/audio?v=N`. El servidor rechaza todo lo inferior a `[server] min_client_version`, que es como una estación obliga a recargar a las pestañas que aún ejecutan una versión anterior — la única palanca que hay, ya que el servidor no alcanza el JavaScript que ya corre en un navegador. Increméntelo cuando un cambio del frontend no deba seguir siendo ignorado por pestañas abiertas
- Referencia completa: [Límites de conexión](CONNECTION_LIMITS.md)

#### 4f. Respuestas en el chat (`lib/chatReply.js`)
- Una respuesta es un mensaje de chat corriente que empieza con una marca que nombra el mensaje al que responde, `[RE:<marca de tiempo>|<nombre>]`; el servidor la guarda y la reenvía como cualquier otra línea y no necesita cambios
- `chatReply.js` crea y lee esa marca y agrupa las respuestas bajo su original, con un nivel de profundidad. La usan tanto `App.svelte` como `mobile/Mobile.svelte`, de modo que las dos páginas organizan el chat igual
- Cuando el original ya ha salido del historial de 20 mensajes del servidor, la respuesta se queda donde llegó y muestra solo el nombre y la hora a los que responde

#### 4g. Nombres de los oyentes y privacidad (`lib/identity.js`)
- La casilla de nombre junto a **Open Additional Info** guarda el nombre o indicativo en `localStorage` (`chatusername`) y lo envía por `/audio` como `{"cmd":"identity","name":…}`; `audio.js` lo vuelve a enviar cada vez que se abre su socket. Un enlace a un receptor en otra dirección lo lleva como `?idname=`, que se lee una vez y se quita de la barra de direcciones
- El servidor lo limpia (`clean_listener_name` en `utils.cpp`): hasta 10 caracteres y sin espacios como en un WebSDR, al menos una letra o cifra; los nombres reservados del chat y los `anonymous1234` cuentan como ninguno. `/users` lo da como `name`; las etiquetas de la cascada lo muestran seguido de la ciudad
- El `/users` público, `users.json` y los `/logs/users_*.jsonl` que lee `stats.html` no llevan dirección IP: la copia del log lleva en su lugar un código opaco `visitor` (hash con clave, clave en `logs/.visitor_salt`); los archivos en disco conservan las direcciones. El panel de administración lee `/~~users`, que solo se responde a un par loopback sin `X-Forwarded-For`
- El decodificador en uso sigue el mismo camino: `App.svelte` envía `{"cmd":"decoder","name":"FT8"}` (vacío cuando no hay ninguno) cada vez que cambia, y `audio.js` lo reenvía en un socket nuevo. El servidor guarda una etiqueta corta (letras, dígitos, espacio, `-+/`, como máximo 12) y la da como `decoder` en `/users` y en cada línea de `users_*.jsonl`; un cambio se registra como una resintonía, para que `stats.html` (Decoder Popularity) y la página Visitors del panel lo cuenten
- Los bloqueos de 8/16/24 horas del panel se guardan en `admin_bans.json` (nunca se distribuye) y se reenvían a cada receptor una vez por minuto; `/~~unban` levanta uno

#### 5. Gestión del estado (`stores/`)
- Almacenes de datos reactivos
- Estado compartido de la aplicación
- Manejo de eventos

---

## Listas de frecuencias (`frequencylist/`)

Los marcadores de frecuencia sobre la cascada. `mymarkers.json` es la lista que el receptor muestra realmente; el resto es la materia prima que `update-markers.sh` convierte en ella, actualizada desde las programaciones en línea. El `README.md` de ese directorio explica la actualización en los siete idiomas.

```
frequencylist/
├── mymarkers.json            # los marcadores que muestra el receptor — editados a mano, sobreviven a una actualización
├── shortwavestations.json    # emisoras de onda corta, generado por generate-current-shortwave.py
├── 0.TXT                     # la programación global de HF A26, descomprimida y analizada por update-markers.sh
├── a26allx2.zip              # archivo de origen descargado por update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # listas auxiliares de la misma fuente (emplazamientos, idiomas, administradores, antenas)
├── generate-current-shortwave.py
├── update-eibi.sh            # trae el horario EiBi para la ventana EiBi, como mucho una vez al día
├── generate-eibi.py          # lo convierte en frontend/public/eibi.json y frontend/dist/eibi.json
├── update-markers.sh         # actualiza todo lo anterior desde las programaciones en línea
└── README.md
```

La ventana EiBi (el botón **EiBi**) usa una segunda lista, aparte. `update-markers.sh` ejecuta primero `update-eibi.sh`, que comprueba el horario EiBi (http://www.eibispace.de/dx/) como mucho una vez al día y solo lo descarga cuando EiBi ha publicado uno nuevo, pasando por sí solo a la lista de la temporada siguiente (verano A, invierno B); `generate-eibi.py` lo convierte en `eibi.json` para la página y deduce el modo de cada estación. Ejecute `./frequencylist/update-eibi.sh --force` para traerlo enseguida. Una descarga fallida nunca detiene la actualización de los marcadores. `update.sh` actualiza los dos scripts y pregunta antes si los ha modificado. `update-markers.sh` marca además cada entrada HFCC que escribe en `markers.json` con `"source": "hfcc"`; **Hide HFCC markers** de la ventana EiBi oculta exactamente esas.

### Formato (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

`mode` es un modo del receptor (`USB`, `LSB`, `AM`, `FM`, `CW`, …) o el nombre de un modo digital — `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV`, `NAVTEX`, `FAX`, `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR`, `PSK31`, `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `OLIVIA`, `CONTESTIA`, `MFSK`, `MFSK16`, `MFSK32`, `MFSK64`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `FELDHELL`, `MT63`, `PACKET`, `APRS`, `RADEU`, `RADEL`, `RADE` o `FREEDV` —, en cuyo caso pulsar el marcador inicia ese decodificador ([detalles](DECODERS.md#iniciar-un-decodificador-desde-un-marcador-de-frecuencia)).

---

## Archivos de configuración

### Configuración del servidor (archivos `.toml`)

Estructura de los archivos de configuración:

```toml
[server]
# Web server settings
port = 9001
html_root = "frontend/dist/"
threads = 2
otherusers = 1
iq = true

[limits]
# Límites por dirección — todos desactivados o con un valor sensato por defecto,
# así que una configuración sin ellos se comporta como siempre. Vea CONNECTION_LIMITS.md.
per_ip = 3              # oyentes simultáneos desde una dirección
per_ip_rate = 40        # conexiones nuevas por minuto desde una dirección

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

### Información del sitio (`site_information.json`)

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
  "siteIP": "http://domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Sistema de compilación

### Configuración de compilación con Meson

#### `meson.build` (raíz)

Define:
- Metadatos del proyecto
- Dependencias
- Opciones del compilador
- Listas de archivos fuente
- Objetivos de compilación

#### `meson_options.txt`

Opciones disponibles:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Flujo de datos

### Flujo de funcionamiento del servidor

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

### Flujo de interacción del usuario

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

## Guía de modificación de archivos

### Cuando modifica el código del backend (`src/**`):

```bash
./recompile.sh --backend
```

### Cuando modifica el código del frontend (`frontend/src/**`):

```bash
./recompile.sh --frontend
```

### Cuando modifica la configuración (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Cuando modifica los marcadores (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Operaciones habituales con archivos

### Personalizar el frontend

1. Modifique el código fuente: `nano frontend/src/App.svelte`
2. Recompile: `./recompile.sh --frontend`
3. Reinicie el servidor: `./stop-websdr.sh && ./start-rtl.sh`

### Añadir marcadores propios

1. Edite el archivo de marcadores: `nano markers.json`
2. Formato:
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
3. Recargue el navegador (no hace falta reiniciar el servidor)

---

## Control de versiones

### Publicar una versión (mantenedor)

Antes de subir los archivos, renueve la lista de huellas, para que `update.sh` reconozca en cada estación las versiones que tiene como publicadas:

```bash
# 1. copie los archivos cambiados a la copia para subir, y luego:
bash update.sh --make-known /path/to/the/upload/copy
# 2. haga commit de update-known.txt y cópielo también a la copia para subir
```

La lista solo crece: se conservan las entradas de versiones anteriores, así que una copia pública publicada una vez sigue siendo reconocible en todas las versiones posteriores.

---

Para las instrucciones de instalación, consulte [INSTALLATION.md](INSTALLATION.md). Para información sobre el uso, consulte [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
