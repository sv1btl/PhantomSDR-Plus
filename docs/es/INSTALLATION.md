# Guía de instalación de PhantomSDR-Plus para operadores de sistema

Esta guía completa le acompañará en la instalación y configuración de PhantomSDR-Plus en su servidor.

---

## Índice

1. [Requisitos del sistema](#requisitos-del-sistema)
2. [Instalación de PhantomSDR-Plus](#instalación-de-phantomsdr-plus) — el script y [qué hace](#qué-hace-el-instalador)
3. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
4. [Emulación de clientes KiwiSDR (opcional)](#emulación-de-clientes-kiwisdr-opcional)
5. [Configuración](#configuración)
6. [Configuración específica por dispositivo SDR](#configuración-específica-por-dispositivo-sdr)
7. [Pruebas y verificación](#pruebas-y-verificación)
8. [Configuración del arranque automático](#configuración-del-arranque-automático)
9. [Protección térmica de la CPU](#protección-térmica-de-la-cpu)
10. [Resolución de problemas](#resolución-de-problemas)

---

## Requisitos del sistema

### Sistemas operativos compatibles

**Principal (recomendado):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) y 26.04 LTS (Resolute) — se recomienda 24.04
- Debian 12 (Bookworm) y Debian 13 (Trixie)

**Alternativa:**
- Fedora (última versión estable)
- Arch Linux (rolling)
- openSUSE Tumbleweed (no Leap — vea la nota más abajo)

### Requisitos de hardware

**Configuración mínima:**
- CPU: procesador de doble núcleo (2 GHz o más)
- RAM: 4 GB
- Almacenamiento: 10 GB libres
- Red: conexión de 100 Mbps

**Configuración recomendada:**
- CPU: cuatro núcleos o mejor (Ryzen 5 2600, Intel i5-6500T o superior)
- RAM: 8 GB o más
- Almacenamiento: SSD de 20 GB o más
- GPU: AMD/NVIDIA compatible con OpenCL (muy recomendable)
- Red: conexión de 1 Gbps

**Configuración de alto rendimiento:**
- CPU: 6 núcleos o más (Ryzen 7, Intel i7 o mejor)
- RAM: 16 GB o más
- Almacenamiento: SSD NVMe
- GPU: GPU dedicada compatible con OpenCL/CUDA
- Red: 1 Gbps o superior

---

## Instalación de PhantomSDR-Plus

### Clonar el repositorio y ejecutar el instalador

```bash
cd ~
git clone https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
bash install.sh
```

El instalador hace primero unas pocas preguntas sobre su estación — el receptor, qué recibir, su indicativo y su locator, su dirección en internet y qué extras desea — y después lo instala todo por sí solo, sin preguntar nada más. Al final arranca el receptor y muestra la dirección que usan los oyentes y el único puerto que hay que abrir en el router (9000, salvo que elija otro). Las preguntas se describen dos secciones más abajo, en *Las preguntas de la estación*.

Escriba `bash install.sh` exactamente así: no hay paso `chmod`. Una copia descargada como ZIP o desde la página de GitHub no tiene permisos de ejecución, y el instalador los pone él mismo.

> **¿Ya tiene PhantomSDR-Plus funcionando?** No lo instale de nuevo: actualícelo. Descargue el actualizador una vez y ejecútelo; muestra lo que cambiaría y pregunta antes de escribir nada. Su configuración, marcadores, contraseña de administración, lista de frecuencias e historial del chat no se tocan nunca:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> bash update.sh
> ```
>
> Los detalles están en el capítulo *Actualización de PhantomSDR-Plus*. Volver a ejecutar el instalador sobre una estación que funciona solo hace falta cuando una recompilación falla porque faltan paquetes del sistema.

Use el script que corresponda a su sistema. Todos hacen el mismo trabajo y hacen las mismas preguntas; solo cambia el gestor de paquetes:

| Sistema | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Un único instalador para todas las versiones de Debian y Ubuntu.** `install.sh` lee `/etc/os-release` y la versión de Boost instalada y se adapta solo; los antiguos `install_ubuntu22.sh`, `install-Deb12.sh` e `install_ubuntu26.sh` han desaparecido. Establece `DEBIAN_FRONTEND=noninteractive`, para que el `tzdata` que llega con `python3-matplotlib` no pueda detener la ejecución preguntando por su zona horaria y tragarse después la respuesta destinada a la siguiente pregunta. En Jammy llama directamente a `install_rade_ubuntu22.sh`, porque el `python3-websockets` de Jammy es 10.1 y RADE necesita 11.0 o posterior. Sabe dónde vive `intel-opencl-icd` en cada versión: en los repositorios en 22.04 y 26.04, en `non-free` en Debian 12, y en el propio repositorio gráfico de Intel en 24.04 y Debian 13. Y donde Boost es 1.87 o posterior, el parche de cabeceras de websocketpp deja de ser opcional: el instalador verifica que se aplicó y se niega a compilar sin él. Nunca hace falta un compilador más nuevo: el GCC de serie acepta `-std=c++23` en las cinco versiones, así que no instale `gcc-12` para esto.

La instalación transcurre en 22 pasos numerados. Como las preguntas de la estación se responden al principio, ningún paso se detiene a preguntar nada; solo se pide la contraseña de sudo, una vez, justo después de las preguntas, y se mantiene activa durante toda la ejecución. Con `PHANTOM_CLASSIC=1` vuelve el modo anterior: cada pregunta en su propio paso, enmarcada por un aviso **⌨️  YOUR INPUT IS NEEDED**. Cada respuesta puede darse también desde el entorno para una ejecución totalmente desatendida (`PHANTOM_NONINTERACTIVE=1`); vea *Instalación desatendida* más abajo.

**Cada ejecución escribe `install.txt`.** Cuando el instalador termina —o muere a medio camino— escribe un informe en `install.txt` dentro del directorio PhantomSDR-Plus: el resultado, cada uno de los 22 pasos como OK / SKIPPED / PARTIAL / FAILED, lo que detectó (distribución, Boost, compilador, Node.js), qué componentes se instalaron, y cada aviso que apareció. Una ejecución fallida deja un informe que termina en el paso que falló, con el motivo y la nota de que el instalador puede volver a ejecutarse sin riesgo. Es el primer archivo que hay que leer cuando algo no funcionó, y el primero que adjuntar a un informe de error. Cada ejecución lo sobrescribe, así que guarde una copia si quiere comparar dos instalaciones.

> **Ubuntu 26.04, Arch y openSUSE Tumbleweed compilan, pero no se han puesto en el aire.** Los tres traen un Boost más nuevo que 1.87, que eliminó la API `io_service` para la que se escribió el websocketpp 0.8.2 incluido. Las cabeceras parcheadas que copia el instalador salvan esa distancia (`io_context`, `executor_work_guard`, `boost::asio::post`, el resolver moderno), y donde Boost es 1.87 o posterior el instalador trata ese parche como obligatorio y no opcional: verifica que las copias se aplicaron y se niega a compilar sin ellas. Una instalación completa, con el driver del receptor y todos los componentes opcionales, se ha verificado de principio a fin en contenedores con Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) y 1.92 (Arch). Eso demuestra que el servidor compila y arranca, no que sirva un receptor durante horas. Considere los tres sin probar en producción hasta que alguien informe.

> **openSUSE aquí significa Tumbleweed.** Ahí es donde está verificado `install_opensuse.sh`. Leap 15.6 no funciona: sus repositorios no incluyen `liquid-dsp-devel`, que el backend necesita, y Boost solo está disponible con nombres de paquete versionados. Dar soporte a Leap exigiría añadir repositorios OBS de terceros, así que queda fuera del alcance por ahora.

### Las preguntas de la estación

`configure-station.sh` — lo ejecuta el instalador al principio y puede ejecutarse solo en cualquier momento — hace cinco grupos de preguntas. ENTER acepta el valor entre corchetes; al ejecutarlo de nuevo, las respuestas anteriores son las predeterminadas.

| # | Pregunta | Notas |
|---|---|---|
| 1 | Qué receptor | Reconoce y propone el que está conectado (RX888, RTL-SDR, RSP1A, Airspy HF+, HackRF, Fobos). Para un RTL-SDR pregunta además si es un Blog V4. |
| 2 | Qué recibir | Opciones listas para cada receptor (por ejemplo *HF 0–30 MHz* para el RX888, *2 m* para un RTL-SDR), o su propia frecuencia central y tasa de muestreo. |
| 3 | Su estación | Indicativo, nombre, e-mail, QTH locator, ciudad y país, antena, ordenador, región UIT (propuesta a partir del locator). |
| 4 | Internet | Su dirección pública (IP o nombre DNS), y si el receptor aparecerá en sdr-list.xyz y en el mapa de websdr.org. También si servir el receptor además por https:// (necesita un nombre DNS). Escriba un nombre o una IP, no un puerto — el puerto se pregunta en el paso 5. |
| 5 | Puertos y extras | Panel de administración, FreeDV RADE, DRM, estadísticas, relay WebSDR, arranque al encender — y el puerto público. |

Las respuestas se guardan en **`station.conf`**, y a partir de él el asistente escribe todo lo que debe coincidir: el `config-<receptor>.toml` del receptor (tasa de muestreo, frecuencia, puerto, listados en directorios, websdr.org), `frontend/site_information.json` y la configuración del relay. Los scripts de arranque leen ellos mismos la frecuencia y la tasa de muestreo de `station.conf`, así que nunca se editan. Solo cambian los ajustes que pertenecen al asistente, y cada archivo se copia a `<nombre>.bak-<fecha>` antes de tocarlo.

**En el router solo hay que abrir un puerto.** Todo lo que usan los oyentes pasa por él:

| Puerto | Qué | Abierto en el router |
|---|---|---|
| 9000 | la página del receptor — `proxy.py`, que lleva también `/admin`, `/rade`, `/drm`, `/stats` y `/relay` | **sí, solo este** |
| 9001 | spectrumserver | no |
| 9010 | panel de administración | no |
| 9011 | servidor de estadísticas | no |
| 9012 | decodificador FreeDV RADE | no |
| 9013 | relay de diversidad WebSDR | no |
| 9015 | decodificador DRM | no |

Un puerto que ya está en uso en el ordenador se salta en favor del siguiente libre. Para cambiar algo más adelante:

```bash
bash configure-station.sh          # preguntar de nuevo (ENTER conserva cada respuesta)
bash configure-station.sh --show   # mostrar las respuestas actuales
```

En una estación ya instalada, el asistente lleva después el cambio a todos los sitios necesarios — puertos nuevos a `admin_config.json` y al servicio de estadísticas, un receptor nuevo al arranque al encender — y pregunta una vez si recompilar la página y reiniciar lo que está en marcha. Cambiar un puerto es por tanto esta única orden, más la redirección en el router si cambió el puerto público. El puerto público debe ser 1024 o mayor, porque el proxy no se ejecuta como root: para ser accesible en el puerto 80, mantenga aquí el 9000 y redirija a él el puerto exterior 80 del router.

### Qué hace el instalador

No hay que preparar nada a mano: ninguna lista de dependencias que pegar, ningún Node.js que descargar, ningún paquete OpenCL que buscar. Cuente desde unos veinte minutos hasta bastante más de una hora, según el ordenador y según se instale o no RADE (su descarga es la parte larga).

| # | Paso |
|---|---|
| 1 | Muestra los servicios de PhantomSDR-Plus que están en marcha y ofrece detenerlos antes de tocar nada (solo en un ordenador que ya los tiene) |
| 2 | Detecta la distribución — luego vienen las preguntas de la estación y, una vez, la contraseña de sudo |
| 3–6 | Instala todas las dependencias de compilación, con Node.js 22 mediante nvm si el Node del sistema falta o es antiguo |
| 7 | Compila el backend con meson |
| 8 | Compila el controlador de su receptor con su regla udev, para que el servidor nunca necesite `sudo` para el dispositivo |
| 9 | Escribe el `.toml` del receptor y `site_information.json` a partir de sus respuestas |
| 10–11 | Instala las dependencias del frontend y construye la página de escritorio y `/mobile` |
| 12 | Instala OpenCL para el hardware que encuentra |
| 13 | Instala el panel de administración — o, sin él, solo el proxy en el puerto público |
| 14–16 | Instala el relay WebSDR, FreeDV RADE, DRM y el servidor de estadísticas, si los eligió |
| 17 | Vuelve a aplicar las cabeceras parcheadas de websocketpp y las comprueba |
| 18 | Instala la emulación de cliente KiwiSDR, para que clientes Kiwi como AetherSDR puedan conectarse |
| 19 | Recompila el backend a partir de las fuentes parcheadas |
| 20 | Elige el acelerador FFT — OpenCL solo cuando un dispositivo responde de verdad, si no la CPU — e instala el arranque al encender si lo eligió, y configura https:// si lo eligió |
| 21 | Arranca el receptor |
| 22 | Muestra el resumen: la dirección de los oyentes, el puerto que hay que redirigir y cada paso con su resultado |

#### Instalación desatendida

Cada pregunta tiene una variable de entorno que la sustituye, y el instalador pasa por sí solo a los valores por defecto cuando la entrada estándar no es un terminal (una tubería, un contenedor, un trabajo de CI). Funciona igual en los cuatro: `install.sh`, `install_arch.sh`, `install_fedora.sh` e `install_opensuse.sh`. Ponga `PHANTOM_NONINTERACTIVE=1` y la ejecución termina sin preguntar nada:

| Variable | Efecto |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_DRM=y\|n` | DRM decoder (default y) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | continuar sin curlpp — solo Arch y openSUSE (por defecto y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | restablecer las marcas de tiempo de los fuentes fechadas en el futuro, para que meson pueda compilar (por defecto y) |
| `PHANTOM_START_RECEIVER=y\|n` | arrancar el receptor al final (por defecto y) |
| `PHANTOM_CLASSIC=1` | sin preguntas de la estación: todo se pregunta por el camino, como antes |
| `STATION_…=…` | cualquier respuesta a las preguntas de la estación, p. ej. `STATION_RECEIVER=rtl STATION_CALLSIGN=SV1XYZ` — vea la cabecera de `configure-station.sh` |

Con las preguntas de la estación, los extras elegidos toman sus respuestas de `station.conf` y se ejecutan sin terminal, así que una ejecución desatendida los incluye sin nombrarlos aquí.

Los tres sub-instaladores marcados *n desatendido* son guiones interactivos por su cuenta, así que una ejecución desatendida los omite en lugar de quedarse esperando. Nómbrelos explícitamente para incluirlos:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Tras reiniciar, las reglas udev del RX888 y cualquier driver de OpenCL quedan plenamente activos; el instalador le avisa cuando hace falta reiniciar o volver a iniciar sesión.

Al configurar el panel de administración, el instalador ofrece también las dos unidades systemd y **recomienda encarecidamente** aceptarlas: la protección contra sobrecalentamiento se ejecuta dentro del panel, así que sin ellas un reinicio o un fallo deja la máquina desprotegida. El paso se omite automáticamente donde systemd no está en marcha (contenedores, WSL1, OpenRC) — véase la [guía del panel](ADMIN_PANEL_SETUP.md).

Cada extra es un script normal que también puede ejecutar por separado en cualquier momento — `./setup_admin.sh` ([manual](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([manual](RADE_README.md)), `./setup-drm.sh` ([decodificador DRM](DECODERS.md#13-drm)), `./install-stats-server.sh` ([manual](sdr-stats/README.md)), `./setup-rx888-udev.sh` y los scripts de los receptores `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` y `./setup-hackrf.sh` — son exactamente los que llama el instalador.

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus incluye un **autorun spot reporter** opcional (en el directorio `autorun/`). Decodifica FT8/FT4/WSPR en el servidor, directamente del receptor, y sube los spots a las redes de reporte:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Se controla íntegramente desde la pestaña **panel de administración → «Spot Reporting»**, y **el reporte está DESACTIVADO por defecto**: no se transmite ni se sube nada hasta que lo active ahí. El decodificador se ejecuta como un demonio Node.js aparte y toma el audio del receptor localmente, por lo que no añade hardware de RF adicional.

### Requisitos

| Requisito | Notas |
|-----------|-------|
| **Node.js 22+** | El mismo entorno de ejecución que ya necesita la compilación del frontend; se instala en el paso de Node.js. |
| **Paquetes npm `ws` + `cbor-x`** | Se resuelven a través de `autorun/node_modules`, un enlace simbólico al `node_modules` del frontend (ambos paquetes están declarados en `frontend/package.json`). |
| **`util-linux`** (`taskset`) | El botón «Start» del panel fija el demonio a los E-cores con `taskset`. Está presente en prácticamente todas las distribuciones; los instaladores lo añaden de forma explícita. |
| **Indicativo + localizador** | Se leen de `frontend/site_information.json` (`siteSysop` / `siteGridSquare`) salvo que se sustituyan en la pestaña de administración. Los spots se suben con ese indicativo. PSK Reporter y WSPRnet reciben solo un locator de 4 o 6 caracteres — uno más largo (KM17VX69JA) se recorta a su cuadrado (KM17VX). |

> ⚠️ **Reporte solo lo que realmente recibe.** Los spots se suben a redes públicas con su indicativo: active únicamente las bandas y modos que su receptor oye de verdad, y use su localizador correcto.

### Instalación automática

`install.sh` (y las variantes por distribución: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) se encargan de todo: instalan Node.js 22 y `util-linux`, ejecutan el `npm install` del frontend y después crean automáticamente el enlace simbólico `autorun/node_modules`. No hacen falta pasos adicionales: la función está lista en cuanto termina `install.sh`.

Después abra el panel de administración, vaya a la pestaña **Spot Reporting**, indique su identidad, marque las bandas y modos que desea decodificar, active los destinos y pulse **Start**. Aparecerá un distintivo «📶 REPORTING» en la cascada principal mientras el reporte esté activo. (PSK Reporter sube por lotes cada 5 minutos y wsprnet cada 2 minutos, así que un demonio recién iniciado muestra «0 sent» durante los primeros minutos: es normal.) La misma pestaña fija las horas UTC en que funciona cada banda y modo, y puede arrancar el demonio por sí sola tras un reinicio o un fallo — vea [Spot Reporting](ADMIN_PANEL_SETUP.md#spot-reporting-autorun-ft8ft4js8wspr).

A partir de ahí se muestran dos contadores distintos, fáciles de confundir. Los paneles **SPOTS UPLOADED PER DECODER** cuentan solo la ejecución actual, de modo que Stop/Start los pone a cero; el número junto a cada casilla de banda/modo es el total **histórico** de esa ranura, guardado en `autorun-totals.json` para que sobreviva a los reinicios. Consulte la [guía del panel de administración](ADMIN_PANEL_SETUP.md) para ambos, y para la página **Gráficos**, que representa la frecuencia de CPU, la carga, la temperatura y los usuarios conectados desde 15 minutos hasta 24 horas.

> **Si su máquina se calienta**, el panel incluye además una [protección térmica](ADMIN_PANEL_SETUP.md#thermal-guard) que detiene el servidor cuando la CPU alcanza una temperatura peligrosa y lo reinicia una vez fría. Deriva sus umbrales del límite crítico de su propia CPU, así que no hay nada que calcular, y funciona con cualquier método de arranque/parada. Se instala con el panel pero arranca en modo de solo registro: anota lo que *habría* hecho y no cambia nada hasta que usted la active en Ajustes. La decodificación continua mantiene la CPU ocupada las 24 horas, así que conviene leer la pestaña CRASH tras una semana de autorun para ver hasta dónde llega realmente su máquina.

> **El puerto del servidor se detecta automáticamente.** El demonio se conecta directamente al `[server] port` del propio spectrumserver (bucle local + token, sin pasar por el proxy). Lee ese puerto del archivo de configuración con el que se lanzó el spectrumserver en ejecución, de modo que funciona en cualquier puerto sin configuración; la línea `[autorun] tap backend: …` de `autorun.log` muestra lo que ha resuelto. Si su servidor no estaba en marcha cuando arrancó el demonio, o si tiene una instalación poco habitual, fíjelo en `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9001 }
> ```
> Un puerto incorrecto se manifiesta como `504` / `tap closed 1006` en `autorun.log`, con `decodes` atascado en 0.

---

## Emulación de clientes KiwiSDR (opcional)

Desde la v4.1.0 PhantomSDR-Plus también puede responder al **protocolo KiwiSDR**, de modo que el software escrito para un KiwiSDR — **AetherSDR**, `kiwiclient` y los demás — se conecta directamente a su receptor, en el mismo host y puerto que ya publica. Está apagado hasta que se añade `[kiwi_emulation] enabled = true` a la configuración con la que arranca su receptor.

El instalador lo ofrece como paso 17; `./kiwi_install.sh` lo aplica a un árbol ya instalado.

> **Documentación completa: [Emulación de clientes KiwiSDR](Aether_config.md)** — qué hace el puente, cómo instalarlo, cada clave de `[kiwi_emulation]`, conectar un cliente, el nivel de audio, el S-meter, la tasa de la cascada y una tabla de síntomas.

---

## Configuración

> **¿Instaló con las preguntas de la estación?** Entonces todo lo de este capítulo ya está hecho a partir de sus respuestas: el `.toml`, `site_information.json`, y la frecuencia y la tasa de muestreo del script de arranque. Cámbielos con `bash configure-station.sh`. Los pasos siguientes son para lo que el asistente no cubre, o para una estación configurada a mano.

### 1. Elija su archivo de configuración

Seleccione el archivo de configuración adecuado para su SDR:

- `config-rtl.toml`: llaves RTL-SDR
- `config-rsp1a.toml`: SDRplay RSP1A
- `config-airspyhf.toml`: Airspy HF+ Discovery
- `config-fobos-hf.toml` : RigExpert Fobos SDR, HF1/HF2 en muestreo directo (0-25 MHz)
- `config-fobos.toml` : RigExpert Fobos SDR, rama RF (25-6000 MHz)
- `config-rx888mk2.toml`: RX888 MK2
- `config-hackrf.toml`: HackRF One
- `config.example.hackrf.toml`: HackRF One

En este ejemplo usaremos el RTL-SDR.

### 2. Edite el archivo de configuración

```bash
nano config-rtl.toml
```

#### Ajustes clave

```toml
[server]
port = 9001                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
iq = true                        # Offer the IQ mode to listeners (true/false)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
volume = 50                      # Start volume of a first-time listener, 0-100 (optional)
```

#### Orientación sobre la tasa de muestreo

| Cobertura | Tasa de muestreo | Tamaño de FFT |
|-----------|------------------|---------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Configure la información del sitio

```bash
nano frontend/site_information.json
```

Edite los siguientes campos:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v5.5.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9000",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Regiones de la IARU:**
- **1**: Europa, África, Oriente Medio, norte de Asia
- **2**: América (Norte, Centro y Sur), Caribe
- **3**: Asia-Pacífico, Oceanía

### 4. Personalice los marcadores de frecuencia (opcional)

```bash
nano markers.json
```

Añada sus frecuencias favoritas, repetidores y emisoras de radiodifusión. Un marcador cuyo modo es un modo digital, como `FT8` o `APRS`, inicia ese decodificador al pulsarlo — véase [Decodificadores](DECODERS.md#iniciar-un-decodificador-desde-un-marcador-de-frecuencia).

### 5. Edite el script de arranque

```bash
nano start-rtl.sh
```

> En una estación configurada con las preguntas de la estación, la frecuencia y la tasa de muestreo vienen de `STATION_FREQ` y `STATION_SPS` en `station.conf`: `bash configure-station.sh` las cambia, y el bloque de arriba se queda tal como se distribuye.

El script de arranque es un lanzador autónomo con watchdog integrado. Edite únicamente el bloque **RECEIVER CONFIGURATION** cerca del principio, para que los argumentos del receptor coincidan con su instalación:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parámetros dentro de `RX_ARGS`:
- `-f 145000000`: frecuencia central (145 MHz)
- `-s 2048000`: tasa de muestreo (2,048 MSPS)

`CONFIG` apunta a su `.toml`. **No** necesita editar nada más en el script: la lógica de arranque/reinicio/watchdog/registro es genérica. También puede sustituir los argumentos del receptor al lanzarlo sin editar el archivo: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` para `start-rx888mk2.sh`).

---

## Configuración específica por dispositivo SDR

### RTL-SDR

Los instaladores instalan el controlador por usted, con `./setup-rtlsdr.sh` (`RTL_V4=y` para un RTL-SDR Blog V4).

#### Edite la configuración

```bash
nano config-rtl.toml
```

Ajustes habituales para RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Receptores sobre SoapySDR (RSP1A, Fobos, Airspy HF+)

El SDRplay RSP1A, el RigExpert Fobos SDR y el Airspy HF+ llegan al servidor de la misma forma: un driver SoapySDR para el dispositivo, y `rx_sdr` (de rx_tools) que pasa sus muestras a `spectrumserver`. Un script por receptor instala la cadena completa:

| Receptor | Script | Opción del instalador | Script de arranque | Configuración |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Cada script:

- instala git, cmake, un compilador, libusb y **SoapySDR** desde los paquetes de su distribución — reconoce apt, dnf, pacman y zypper, así que funciona igual en Debian/Ubuntu, Fedora, Arch y openSUSE;
- compila el driver del receptor desde el código fuente en `sdr_drivers/` (fuera de git);
- compila **rx_tools** para `rx_sdr`, salvo que `rx_sdr` ya esté instalado — una copia sirve a todos los receptores;
- instala una **regla udev** y le añade al grupo `plugdev`, para que el script de arranque nunca necesite `sudo` para el dispositivo. **Cierre la sesión y vuelva a entrar una vez** para que el grupo surta efecto;
- termina comprobando que SoapySDR lista de verdad el driver, y se detiene con un error si no lo hace.

Ejecútelos como su usuario normal — llaman a `sudo` por sí mismos. Son idempotentes: volver a ejecutar uno actualiza las fuentes del driver con `git pull` y recompila. El instalador llama exactamente a estos scripts; en una estación ya instalada, ejecute por separado el de su receptor. La parte común está en `setup-sdr-common.sh`, que no se ejecuta por sí solo. Dos variables opcionales valen para los tres: `SDR_USER=<nombre>` pone otra cuenta en `plugdev`, y `SDR_SKIP_DEPS=1` omite la instalación de paquetes.

Con el dispositivo conectado, compruebe que el receptor se detecta:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` instala el **driver de código abierto**: libmirisdr-5, el driver obtenido por ingeniería inversa para los chips Mirics MSi2500/MSi001 del RSP1 y el RSP1A, con su módulo SoapySDR SoapyMiri (`driver=soapyMiri`). No necesita ningún servicio en segundo plano ni root. El script además pone en la lista negra los drivers del kernel `msi2500` y `msi001` en `/etc/modprobe.d/blacklist-msi2500.conf`, porque reclaman el RSP1A como radio V4L2 antes de que `rx_sdr` pueda abrirlo. Si el dispositivo estaba conectado mientras estaban cargados, desconéctelo y vuelva a conectarlo una vez (o reinicie).

La API cerrada de SDRplay (`driver=sdrplay`, con SoapySDRPlay y el servicio `sdrplay`) sigue funcionando — el archivo incluido `instructions-for-rsp1a` describe esa instalación. `start-rsp1a.sh` elige entre ambos por sí mismo: si SoapySDR tiene el driver `sdrplay` usa la API y antes reinicia el servicio `sdrplay`; si no, usa libmirisdr-5. Una estación montada sobre la API sigue funcionando sin cambios. Para forzar uno, arranque con `RX_DRIVER=miri` o `RX_DRIVER=sdrplay`. El driver elegido queda escrito en `logwebsdr.txt` como `RSP1A driver: miri` o `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

El Fobos entrega **una sola rama a la vez**, así que tiene dos scripts de arranque que comparten el bloqueo del watchdog como cualquier `start-*.sh` — arrancar uno detiene el otro:

- **`start-fobos-hf.sh`** — las entradas HF1/HF2 en muestreo directo, 0-25 MHz, en el puerto 9001. En este modo no hay oscilador local: el ADC digitaliza 0-25 MHz en todo momento (`-f 0` es intencionado, y el aviso *Failed to set center freq* de rx_sdr es de esperar). `rx_sdr` entrega CF32 a 50 Msps; el pequeño conversor `cf32_to_real` (compilado por `setup-fobos.sh` a partir de `cf32_to_real.c`) conserva el canal I y lo escala a s16, por eso `config-fobos-hf.toml` usa `signal="real"` y `format="s16"`.
- **`start-fobos.sh`** — la rama RF, 25-6000 MHz, IQ, en el puerto 9001. Elija la ventana antes del primer arranque: `-f` (centro) y `-s` (frecuencia de muestreo) en la línea `RX_ARGS` deben coincidir con `frequency=` y `sps=` de `config-fobos.toml`. Los valores incluidos (97 MHz, 20 Msps) son solo un punto de partida para comprobar que funciona.

> [!IMPORTANT]
> `config-fobos-hf.toml` viene con `accelerator="opencl"`: un flujo de 50 Msps a través de una FFT de 1M bins pesa tanto como los 60 Msps del RX888, y en la CPU se pierden muestras y la máquina se calienta. En una máquina sin dispositivo OpenCL, `spectrumserver` no arranca con ese ajuste — ponga allí `accelerator="none"`.

SoapyFobosSDR necesita para compilarse las cabeceras de libfobos y de libfobos-sdr-agile, así que `setup-fobos.sh` compila ambas, incluso para el firmware estándar. El soporte del Fobos procede de un script que escribió otra estación tras poner en marcha un Fobos con PhantomSDR-Plus; los valores HF de `config-fobos-hf.toml` son los que funcionaron allí.

#### Airspy HF+

`setup-airspyhf.sh` instala libairspyhf desde la distribución donde está empaquetada (Debian y Ubuntu, Fedora, openSUSE) y la compila desde el código fuente donde no lo está (Arch la tiene solo en el AUR); después compila SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` entrega 912 ksps IQ en CS16, que `config-airspyhf.toml` lee como `format="s16"`. El archivo incluido `instructions-for-airspy` describe el camino manual.

### RX888 MK2

El instalador compila `rx888_stream` e instala sus reglas udev por usted.

#### Ejecutar rx888_stream sin sudo (reglas udev)

Por defecto, el dispositivo USB Cypress FX3 del RX-888 solo es accesible para root, de modo que `rx888_stream` necesitaría `sudo`. Ejecute una vez el asistente incluido para instalar las reglas udev y añadirse al grupo `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Escribe `/etc/udev/rules.d/99-rx888.rules` para los tres identificadores de producto Cypress FX3 (`04b4:00f1`/`00f3` gestor de arranque y `04b4:8613` con el firmware cargado), recarga udev y crea un enlace estable `/dev/rx888`. **Cierre la sesión y vuelva a entrar** (por el cambio de grupo) y **reconecte el dispositivo** una vez; después, `rx888_stream` —y el lanzador `start-rx888mk2.sh`— funcionan sin `sudo`. Es idempotente, así que puede volver a ejecutarlo sin problema. Para configurar otra cuenta: `RX888_USER=<nombre> ./setup-rx888-udev.sh`.

#### Edite la configuración

```bash
nano config-rx888mk2.toml
```

Ajustes habituales para el RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Para el HackRF no se compila nada: `hackrf_transfer`, del paquete `hackrf` de su distribución, pasa las muestras directamente a `spectrumserver`. `./setup-hackrf.sh` (opción 7 del instalador) instala ese paquete con apt, dnf, pacman o zypper y añade una regla udev y el grupo `plugdev`, para que `start-hackrf.sh` funcione sin `sudo` — cierre la sesión y vuelva a entrar una vez después.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` entrega una ventana cada vez. Elíjala antes del primer arranque: `-f` (centro) y `-s` (frecuencia de muestreo) en su línea `RX_ARGS` deben coincidir con `frequency=` y `sps=` de `config-hackrf.toml`. `-l` y `-g` son las ganancias del LNA (0-40 dB, pasos de 8 dB) y del VGA (0-62 dB, pasos de 2 dB), y `-a 1` enciende el amplificador de RF. Los valores incluidos (98 MHz, 20 Msps) son solo un punto de partida para comprobar que funciona.

`hackrf_transfer` escribe IQ de 8 bits **con signo**, así que la configuración necesita `format="s8"`. `config.example.hackrf.toml` decía `u8` hasta septiembre de 2026; con `u8` cada muestra está desplazada en 128 y la cascada solo muestra ruido — revise cualquier copia antigua.

### Varios receptores en un ordenador

Un ordenador puede hacer funcionar a la vez más de uno de los receptores anteriores — por ejemplo un RX-888 para HF y un RTL-SDR para 2 m — cada uno como servidor propio, con un selector de receptor en la página. Cada receptor adicional se arranca con `INSTANCE=<nombre> ./start-<radio>.sh` y se configura en `instances/<nombre>/`; `receivers.toml` los enumera para el proxy y para `start-all.sh`. Todo está en [Varios receptores](MULTI_RECEIVER.md). La forma más rápida de añadir un receptor es `./add-receiver.sh`, que los instaladores ofrecen al final: instala el controlador (`setup-rtlsdr.sh` para un RTL-SDR, el `setup-*.sh` correspondiente para los demás) y escribe por usted la carpeta de la instancia y `receivers.toml`.

---

## Pruebas y verificación

### 1. Prueba de arranque

```bash
# For RTL-SDR
./start-rtl.sh
```

Esto inicia el servidor **en segundo plano** (se desvincula y devuelve el control de inmediato) y empieza a registrar en `logwebsdr.txt`.

### 2. Compruebe si hay errores

El script registra su progreso en `logwebsdr.txt`; obsérvelo en directo:

```bash
tail -f logwebsdr.txt
```

Busque:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` o `ERROR: receiver binary '…' not found` (corrija los argumentos del receptor o el `.toml`, o instale la herramienta del receptor, y vuelva a ejecutar el script)

### 3. Acceda a la interfaz web

Abra el navegador en:
```
http://localhost:9000
```

(Sustituya el número de puerto por el que haya configurado)

### 4. Verifique el funcionamiento

- La cascada debe mostrarse
- El audio debe sonar al hacer clic en las señales
- El S-metro debe responder a las señales
- El contador de usuarios debe mostrar «1»

### 5. Pruebe desde otro dispositivo

Desde otro ordenador de su red:
```
http://YOUR_SERVER_IP:9000
```

### 6. Compruebe el uso de recursos

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Detenga el servidor

El servidor se ejecuta en segundo plano bajo un watchdog, así que **Ctrl+C no lo detendrá** (y el watchdog volvería a arrancarlo). Use el script de parada compartido, que sirve para cualquier receptor: primero detiene el watchdog y después el receptor y `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Configuración del arranque automático

La forma sencilla — y lo que hace el instalador cuando responde sí a *arranque al encender*:

```bash
bash setup-autostart.sh                # el script de arranque de station.conf
bash setup-autostart.sh start-rtl.sh   # o indíquelo
bash setup-autostart.sh --remove       # dejar de arrancar al encender
```

Instala `phantomsdr-receiver.service`, que ejecuta su script de arranque al encender y `stop-websdr.sh` al apagar, con el grupo `plugdev`, de modo que el receptor USB se abre sin que nadie haya iniciado sesión. El resto de este capítulo muestra lo mismo a mano.


---

## Protección térmica de la CPU

> 📖 **Manual completo: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — los cuatro modos y qué debe hacer el sysop en cada uno, funcionamiento sin el panel, la fase throttle sin root, pruebas y resolución de problemas.

PhantomSDR-Plus incluye un guardián que detiene el servidor si la CPU alcanza una temperatura peligrosa y lo vuelve a arrancar una vez fría. Deriva sus umbrales del límite crítico que publica su propia CPU, así que no hay nada que calcular, y funciona con cualquier método de arranque/parada.

**Si usa el panel de administración, ya lo tiene**: se ejecuta dentro del panel y se configura en su página de Ajustes. Véase la [guía del panel de administración](ADMIN_PANEL_SETUP.md#thermal-guard). El resto de esta sección es para instalaciones **sin** panel.

## Resolución de problemas

### Errores de compilación

#### Problemas de dependencias

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Falla la configuración de Meson

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` termina con `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

El árbol de fuentes no tiene ningún problema. Una instalación antigua con
`pip install --user meson` dejó un script de arranque en `~/.local/bin`, que en el
`PATH` va antes que `/usr/bin` y oculta la copia que instaló el gestor de paquetes.
Una actualización de la distribución (por ejemplo Ubuntu 24.04 → 26.04) cambia Python a una versión nueva, el antiguo `site-packages` que contenía `mesonbuild` ya no está en la ruta de importación, y el script muere antes de hacer nada. Lo mismo le puede ocurrir a `ninja`.

El instalador lo detecta y lo esquiva durante la ejecución, avisándole, pero repare el sistema:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # debe imprimir una versión
```

Si prefiere conservar meson instalado con pip, reinstálelo para el Python que tiene ahora este sistema:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` se detiene con `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

El árbol de fuentes no tiene ningún problema: es el reloj del sistema el que va por detrás de los archivos. meson y ninja se niegan a compilar cuando una entrada es más reciente que la hora actual, porque no pueden saber qué está obsoleto. Ocurre en una Raspberry Pi sin pila en su soporte RTC — cada arranque parte de la última hora conocida, y una compilación lanzada antes de que NTP se sincronice ve todo el árbol fechado en el futuro — y en cualquier árbol descomprimido o copiado desde una máquina adelantada.

Corrija primero el reloj:

```bash
timedatectl                       # ¿la hora es correcta? ¿NTP está sincronizado?
sudo timedatectl set-ntp true
```

Espere unos segundos y vuelva a ejecutar el instalador. Comprueba esto antes de llamar a meson y ofrece restablecer las marcas de tiempo afectadas (`PHANTOM_FIX_CLOCK_SKEW=y|n`). A mano, desde el árbol de fuentes:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### El backend se compiló pero no hay página web

El síntoma es una instalación que parece casi lograda: `build/spectrumserver` existe, el servidor arranca y el navegador no recibe nada — porque `frontend/dist/` nunca se generó. Busque en la salida del instalador:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` pide `@swc/core` `^1.12.14`, así que un `npm install` limpio resuelve a 1.16.0, cuyo `printSync()` rechaza el árbol sintáctico que le entrega el complemento. No tiene nada que ver con su distribución: todos los instaladores fijan ahora la versión que funciona, y `frontend/package.json` también. Una máquina instalada antes de esa fijación sigue funcionando hasta que se borre su `node_modules`, y por eso esto aparece de la nada en una reinstalación.

### Errores en ejecución

#### El puerto ya está en uso

```bash
# Find process using port
sudo lsof -i :9000

# Kill process
sudo kill -9 <PID>
```

#### Permiso denegado para el SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Para un **RX-888 MkII** esto no basta por sí solo: el dispositivo Cypress FX3 necesita además reglas udev. Ejecute el asistente incluido (instala las reglas *y* le añade a `plugdev`), después cierre la sesión, vuelva a entrar y reconecte el dispositivo:

```bash
./setup-rx888-udev.sh
```

### Problemas con OpenCL

#### clinfo no muestra dispositivos

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

### Problemas de red

#### No se puede acceder desde otros dispositivos

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9000/tcp

# Or disable firewall temporarily for testing
sudo ufw disable

# Fedora / openSUSE (firewalld)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --add-port=9000/tcp
```

En Fedora y openSUSE el cortafuegos es firewalld, no ufw, y viene activado de serie. `setup_admin.sh` abre allí por sí solo el puerto público del proxy (y también en ufw, si lo ha activado); en una estación instalada antes, ejecute una vez `./setup_admin.sh --firewall` o use las líneas `firewall-cmd` de arriba. Si el panel de administración o el proxy no vuelven tras un reinicio en estos sistemas, la causa habitual es SELinux: ejecute `./setup_admin.sh --selinux` (vea la tabla de solución de problemas en ADMIN_PANEL_SETUP.md).

### Problemas con el dispositivo SDR

#### No se encuentra el RTL-SDR

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### No se encuentra el SDRplay

`grep "RSP1A driver" logwebsdr.txt` muestra qué driver eligió `start-rsp1a.sh`.

Con el driver abierto (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Con la API de SDRplay (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### No se encuentra el Fobos o el Airspy HF+

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Si el driver falta en la lista, vuelva a ejecutar `./setup-fobos.sh` o `./setup-airspyhf.sh`: se detiene indicando el motivo si falla la compilación o la comprobación de SoapySDR.

---

## Actualización de PhantomSDR-Plus

Desde la versión 4.1.0 el repositorio incluye **`update.sh`**, una herramienta que pone al día una instalación con el árbol publicado **sin tocar los archivos que la hacen ser su estación**. Sustituye al script `git pull` que las ediciones anteriores de esta guía le pedían escribir, y no necesita git en absoluto: el árbol publicado se descarga como tarball y se compara con el suyo archivo por archivo, de modo que funciona igual tanto si clonó el repositorio como si descomprimió un `update.zip` o copió el árbol desde una memoria USB.

### Si su instalación todavía no tiene update.sh

Un árbol antiguo no contiene el script. Descárguelo una vez; es el único paso que hará nunca a mano:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
```

A partir de ahí todo — fuentes, frontend, documentación, instaladores y el propio `update.sh` — llega a través de la herramienta.

### Ejecución

```bash
cd ~/PhantomSDR-Plus
bash update.sh
```

Descarga el árbol publicado, lo compara con el suyo e imprime un informe. Después pregunta **Update these files now?** — ENTER significa *no*, y entonces no se ha escrito absolutamente nada. Responda `y` y:

1. detiene el receptor, el panel de administración, el proxy y el relay **de esta instalación** (otra instalación en el mismo ordenador sigue funcionando),
2. guarda cada archivo que va a sustituir en un archivo fechado en `update-backups/`,
3. escribe los archivos nuevos,
4. recompila solo lo que cambió — el servidor, la página o ambos — sin preguntar nada,
5. vuelve a arrancar exactamente lo que detuvo.

Hay tres tipos de archivo que se tratan de forma distinta:

| Archivos | Qué ocurre |
|---|---|
| `station.conf`, `config.toml`, `config-<receptor>.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frontend/site_information.json`, `frontend/variant.json`, `frequencylist/`, `chat_history.txt`, los logs, `build/`, `frontend/dist/` | **Nunca se tocan**, ni siquiera aparecen en una pregunta. Son lo que hace del ordenador *su* receptor. |
| `start-*.sh`, `stop-websdr.sh`, las unidades `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `proxy.py`, `admin_server.py`, `frontend/src/bands-config.js` y los demás archivos que un sysop tiene motivos para editar | **Se actualizan si nunca los editó; se pregunta si los editó.** |
| Todo lo demás | Se actualiza. |

Cada versión trae `update-known.txt`, la huella de cada versión de cada archivo publicada alguna vez. Un archivo suyo que coincide con una de ellas simplemente es más antiguo y se actualiza sin preguntar; así, incluso una primera actualización pregunta solo por los archivos que usted cambió de verdad. Para cada uno elige:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — su archivo queda exactamente como está.
* **upstream** — se instala la versión nueva; la suya queda en la copia de seguridad.
* **both** — la versión nueva se escribe junto a la suya como `start-rx888mk2.sh.new`, para fusionarlas cuando quiera.

Nunca se borra nada: los archivos que han desaparecido del repositorio se notifican, y solo se eliminan si lo pide con `--prune`. Una ejecución que no escribe nada termina con `0` si todo está al día y con `10` si hay una actualización esperando, así que una tarea cron con `bash update.sh --check` puede avisarle cuando haya algo que hacer.

### Deshacer una actualización

```bash
./update.sh --restore LAST
```

Todo archivo que una actualización sobrescribe se guarda antes, en un archivo fechado por ejecución dentro de la carpeta normal y visible `update-backups/`:

```
update-backups/phantomsdr-backup-20260923-164530.zip
```

El archivo contiene solo los archivos que esa ejecución sustituyó, cada uno en la ruta que tiene en su árbol, así que puede copiarse a otra máquina como un único archivo, abrirse en cualquier parte o descomprimirse directamente sobre la instalación. Donde `zip` no está instalado se escribe como `.tar.gz`. Se conservan los tres más recientes. Cualquiera de estas órdenes devuelve lo que una actualización sustituyó:

```bash
./update.sh --restore LAST
./update.sh --restore phantomsdr-backup-20260923-164530.zip
```

Cada archivo lleva además su propio `restore.sh`, para el caso de que el problema sea el propio `update.sh`: descomprima el archivo y pásele el directorio de su instalación, por ejemplo `./restore.sh /home/pi/PhantomSDR-Plus`. Durante la restauración `update.sh` se ejecuta desde una copia fuera del árbol, porque normalmente es uno de los archivos que se devuelven.

### Otras opciones

```bash
./update.sh --apply --yes     # no pregunta nunca; TODO lo que usted editó se CONSERVA
./update.sh --check           # solo informe, nunca pregunta — para cron (10 = hay actualización)
./update.sh --from FILE|DIR   # la versión nueva desde .zip/.tar.gz o una carpeta — sin red
./update.sh --ref v5.5.0      # una etiqueta, rama o commit en lugar del árbol actual
./update.sh --list-excludes   # imprime las reglas de "no tocar" tal como se aplican aquí
./update.sh --verbose         # lista todos los archivos, no sólo los 40 primeros
```

Puede añadir sus propias reglas de "no tocar" escribiendo un patrón por línea en
`update-exclude.txt`, en la carpeta raíz de la instalación.

### Si la reconstrucción falla en una instalación muy antigua

`update.sh` actualiza archivos, no paquetes del sistema. Si su árbol es tan antiguo que la
compilación necesita bibliotecas que no tiene, `recompile.sh` se detendrá con un error del compilador o de meson. No es una actualización rota: faltan las dependencias:

```bash
./install.sh
```

El instalador se actualiza en la misma ejecución, y su configuración también sobrevive a él.

### Sin conexión a internet en el receptor

Descargue el repositorio completo en otro ordenador (GitHub → *Code* → *Download ZIP*), llévelo, y:

```bash
bash update.sh --from ~/PhantomSDR-Plus-main.zip
```

Todo lo demás es exactamente como arriba: informe, pregunta, copia de seguridad, recompilación, reinicio.

### Actualizar a mano

Si prefiere aplicar usted mismo un paquete de archivos:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # o el script de arranque de su receptor
```

Haga antes una copia de su configuración — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` y `markers.json` —, porque un paquete de archivos no puede distinguir sus
cambios de los de la versión publicada. Ese es justamente el problema que `update.sh` resuelve.

---

## Apéndice B: ejemplos de configuración

### Ejemplo 1: RTL-SDR para VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Ejemplo 2: RX-888 mk2 para HF (0-30 MHz)

El receptor que usa la mayoría de los sysops. Esta es una sección `[input]` completa, no un fragmento, con los valores del `config-rx888mk2.toml` que acompaña al repositorio.

```toml
[input]
sps = 60000000            # 0-30 MHz por muestreo directo
fft_size = 4194304        # vea la nota de abajo
fft_threads = 8
brightness_offset = -9    # más negativo si la cascada muestra zonas negras
frequency = 0             # banda base: el RX-888 muestrea desde DC
signal = "real"           # no "iq": el muestreo directo da una señal real
accelerator = "opencl"    # "none" si no hay entorno OpenCL
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Se alimenta desde `rx888_stream`, cosa que `start-rx888mk2.sh` hace por usted:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**Sobre `fft_size`:** a 60 MSPS el tamaño adecuado es 4194304. 8388608 duplica la resolución de la cascada y con ella la memoria y el coste de CPU de cada transformada, lo que en la mayoría de las máquinas compra bins más finos a cambio de fotogramas perdidos. Empiece en 4194304 y suba solo si el servidor va sobrado.

### Ejemplo 3: HackRF para FM de banda ancha

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**73 de SV1BTL, 9A7AOF, F1NSK & SV2AMK**
