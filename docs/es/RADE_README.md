# Voz digital RADE v1 para PhantomSDR-Plus

> **Puerto 9012.** En una estación configurada con `install.sh` el sidecar escucha solo dentro del ordenador, en `PORT_RADE` (9012), y la página lo alcanza como `/rade` en el puerto público 9000 a través de `proxy.py`, así que no hay que abrir nada en el router.

**RADE** (Radio AutoencoDEr) es el modo estrella de voz digital en HF de FreeDV. Utiliza un híbrido de aprendizaje automático y DSP (el vocoder neuronal FARGAN) para ofrecer voz de alta calidad por HF con relaciones señal/ruido de hasta −2 dB, en apenas 1500 Hz de ancho de banda de RF: más estrecho que una señal de BLU.

Este documento cubre la integración completa de la recepción de RADE v1 en PhantomSDR-Plus, implementada como un proceso sidecar de Python (`rade_helper.py`) que conecta el navegador con la cadena de decodificación `radae_rxe.py` + `lpcnet_demo`.

También decodifica **RADE V2 (beta)**, la nueva forma de onda de FreeDV 3.0, con el botón **RADE-v2U** — consulte [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

## La instalación — la vía rápida

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

Esa es toda la instalación. El script instala los paquetes del sistema con el gestor de paquetes que tenga la máquina (apt, pacman, dnf o zypper), recurre a pip para lo que una distribución no incluya, actualiza `websockets` si la versión de la distribución es anterior a la 11.0 que necesita el sidecar, clona y compila radae, comprueba los pesos del modelo, recompila el frontend y arranca el sidecar. En Ubuntu 22.04 pasa el testigo a `install_rade_ubuntu22.sh`. `./install.sh` ofrece ejecutarlo como parte de la instalación normal de PhantomSDR-Plus, así que en una máquina nueva RADE ya está. También compila rade_c de FreeDV para RADE V2 (beta); si ese paso falla, RADE V1 se instala igualmente.

**Este documento explica cómo funciona RADE y cómo usarlo.** La instalación la hace siempre `./install_rade.sh` (o `./install.sh`, que la ofrece).

---

## Índice

1. [La instalación — la vía rápida](#la-instalación--la-vía-rápida)
2. [Cómo funciona](#cómo-funciona)
3. [Descripción de la arquitectura](#descripción-de-la-arquitectura)
4. [RADEL frente a RADEU](#radel-frente-a-radeu)
   - [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2)
5. [Requisitos previos](#requisitos-previos)
6. [Control del sidecar](#control-del-sidecar)
7. [El puerto 9012](#el-puerto-9012)
8. [Usar RADE en el navegador](#usar-rade-en-el-navegador)
9. [Verificación y depuración](#verificación-y-depuración)
10. [Variables de entorno](#variables-de-entorno)
11. [Resolución de problemas](#resolución-de-problemas)
12. [Actualizar RADE v1](#actualizar-rade-v1)

---

## Cómo funciona

RADE v1 no puede ejecutarse en el navegador: necesita PyTorch y el vocoder neuronal FARGAN, demasiado grandes para WASM. La solución es un proceso sidecar de Python (`rade_helper.py`) que se ejecuta en el mismo servidor que PhantomSDR-Plus.

> **Importante:** `freedv_rx` del repositorio codec2 **no** admite RADEV1. La cadena de decodificación de RADE reside por completo en el repositorio independiente `radae` de David Rowe (VK5DGR). No intente usar `freedv_rx` de codec2 para RADE.

Cuando selecciona RADE en el navegador:

1. El frontend fija la demodulación subyacente en USB o LSB: el servidor en C++ demodula la señal BLU con normalidad.
2. El PCM demodulado sin procesar se toma en `audio.js` **antes** de cualquier silenciado o puerta de squelch: `radae_rxe.py` necesita una entrada continua para mantener el sincronismo de trama.
3. Cada bloque de PCM se rellena con ceros para pasar de f32 real a f32 complejo (real + 0.0 imaginario): eso es lo que `radae_rxe.py` espera en su entrada estándar.
4. El sidecar canaliza esas muestras hacia `radae_rxe.py`, que produce características de vocoder.
5. `lpcnet_demo -fargan-synthesis` convierte las características en voz s16 a 16000 Hz.
6. El sidecar convierte s16 → f32 y lo devuelve al navegador en tramas binarias de WebSocket.
7. El navegador reproduce la voz decodificada mediante la Web Audio API a 16000 Hz.

El servidor en C++ (`spectrumserver.cpp`) no se modifica en absoluto.

---

## Descripción de la arquitectura

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:9000/rade                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 9012)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL frente a RADEU

RADE v1 siempre se transmite por BLU. Por convención:

| Modo  | Banda lateral | Usar en las bandas                       |
|-------|---------------|------------------------------------------|
| RADEL | LSB           | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB           | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## RADE V2 (beta) — RADE2

**RADE V2** es la nueva forma de onda de FreeDV 3.0: unos 800 Hz de ancho en lugar de 1500 Hz, sin símbolos piloto y unos 3 dB más sensible con SNR bajo. **Todavía es beta en FreeDV**: solo la emiten las estaciones que prueban FreeDV 3.0, y la señal aún puede cambiar antes del lanzamiento. PhantomSDR-Plus la decodifica junto a RADE V1:

| Botón | Versión | Banda lateral | Filtro |
|---|---|---|---|
| **RADE-v2U** (RADE2) | RADE V2 (beta) | USB en todas las bandas | 1040–1930 Hz |
| **RADE-v1L** / **RADE-v1U** (RADEL / RADEU) | RADE V1 | LSB / USB | 700–2200 Hz |

V2 se decodifica en el servidor con el port en C de FreeDV, **rade_c** (`radae_rx --v2` y su propio `lpcnet_demo`), compilado en su propia carpeta `~/rade_c`, de modo que la instalación de V1 en `~/radae` nunca se toca. `./install_rade.sh` lo descarga y lo compila (paso «rade_c (RADE V2, beta)»); si ese paso falla, solo avisa, y RADE V1 se instala igualmente. `rade_helper.py` usa rade_c desde la siguiente conexión RADE2 —no hace falta reiniciar— y sin él RADE2 indica al oyente «RADE V2 is not installed on this station yet». Una decodificación V2 cuesta alrededor del 1 % de un núcleo de CPU por oyente (V1: alrededor del 70–80 %).

**En el aire**

- Sintonice a menos de unos **±30 Hz** de la frecuencia de la estación. Más lejos, V2 sigue mostrando «Synced», pero la voz sale ininteligible.
- Cada pasada empieza con **2–3 s de retraso**: mientras V2 se engancha guarda la señal y luego reproduce el principio de la pasada.
- Por debajo de unos **−2 dB de SNR** el audio de V2 se silencia y el panel muestra «Searching for signal…», salvo que los últimos 2 segundos parezcan V2 real (el decodificador ve su señal la mayor parte del tiempo y su estimación de frecuencia se mantiene estable); entonces suena hasta unos **−6 dB**. En frecuencias de fonía LSB concurridas escuchadas en USB (40 m), V2 puede engancharse en voces normales y reproducir un sonido ininteligible; esas nunca parecen estables, así que siguen silenciadas. `RADE_V2_MIN_SNR` y `RADE_V2_WEAK_SNR` fijan los dos umbrales.
- Entre pasadas el panel vuelve a «Searching for signal…».

**Cuando salga FreeDV 3.0**, vuelva a ejecutar `./install_rade.sh` —o `git pull` en `~/rade_c` y `cmake --build build`—; las nuevas conexiones RADE2 usarán entonces la nueva versión.

---

## Requisitos previos

| Requisito | Versión | Notas |
|---|---|---|
| PhantomSDR-Plus | cualquiera | con frontend Vite/Svelte |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | probado |
| Python | 3.8+ | para `rade_helper.py` y `radae_rxe.py` |
| repositorio radae | último master | aporta `radae_rxe.py` y `lpcnet_demo` |
| cmake | 3.10+ | para compilar `lpcnet_demo` desde radae |
| PyTorch | 2.0+ | lo requiere `radae_rxe.py` |
| Node.js | 16+ | para `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — todas las versiones admitidas |
| matplotlib | cualquiera | lo requiere `radae_rxe.py` al importarse |
| numpy | 1.23+ | obligatorio; también habilita el remuestreo |
| scipy | cualquiera | opcional, habilita un remuestreo preciso |

---

## Control del sidecar

**Normalmente no necesita un script de control aparte para RADE.** Los lanzadores del receptor (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) arrancan el sidecar por sí mismos en cuanto se confirma que el servidor está en marcha, lo reinician si termina e informan de su estado en el resumen final — `✔ RADE sidecar running`, o una nota `·` que explica por qué no se activó (no instalado, `RADE_ENABLED=0`, o sin `python3`). `./stop-websdr.sh` lo detiene junto con el servidor. Para ejecutar el servidor sin RADE, arránquelo con `RADE_ENABLED=0`.

`rade.sh` se mantiene para uso autónomo: ejecutar el sidecar sin el lanzador de PhantomSDR-Plus, o probarlo por separado:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

La actividad del sidecar se registra en `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **No mezcle ambos con el servidor en marcha.** Si el vigilante de un lanzador está activo, devolverá el sidecar en unos cinco segundos, de modo que `./rade.sh stop` parecerá haber fallado. Para detener RADE con el servidor en marcha, arranque el servidor con `RADE_ENABLED=0` o detenga todo con `./stop-websdr.sh`.

> Si ejecuta `rade.sh` de forma autónoma, **use siempre `./rade.sh stop`**: un simple `pkill -f rade_helper.py` no vence a su propio vigilante, que reengendra el proceso en 3 segundos.

---

## El puerto 9012

El sidecar escucha en el puerto TCP **9012**, solo dentro del ordenador. El navegador lo alcanza a través de `proxy.py` como `/rade` en el puerto público 9000, así que no hay que abrir ningún otro puerto en el router ni en el cortafuegos.

```bash
# Is the sidecar listening?
ss -tlnp | grep 9012
```

---

## Usar RADE en el navegador

1. Abra su interfaz web de PhantomSDR-Plus
2. Busque estaciones activas en **[qso.freedv.org](https://qso.freedv.org)**
3. Sintonice la frecuencia de dial de la estación
4. En **Decoder Options**, seleccione:
   - **RADE v2 · RADE2** para RADE V2 (beta), USB en todas las bandas
   - **RADE v1 — RADEL (LSB)** para 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** para 20 m / 17 m / 15 m / 12 m / 10 m
5. Haga clic en **Decoder: ON**

### Los botones RADE-v1L / RADE-v1U (una pulsación)

Los pasos 4 y 5 pueden sustituirse por una sola pulsación. Hay un par de botones **RADE-v1L** / **RADE-v1U** en tres lugares:

- junto al encabezado **Modes** del panel principal;
- dentro de la ventana emergente **Modes**;
- dentro de la ventana emergente **Bands**.

Al pulsar uno de ellos se selecciona el decodificador, se pone el decodificador en ON, se cierra la ventana emergente desde la que se pulsó y el panel de RADE se desplaza hasta quedar visible. El botón se pone azul mientras RADE funciona. **Pulse el mismo botón otra vez para detener RADE**: el panel se cierra y el modo y el paso de banda vuelven a su valor tal como se describe más abajo. Los botones, el desplegable **Decoder Options** y el botón ON/OFF comparten el mismo estado.

Un botón **RADE-v2U** está antes de RADE-v1L y RADE-v1U en los mismos tres lugares (y un botón RADE2 en `/mobile`); inicia RADE V2 (beta) en USB — consulte [RADE V2 (beta) — RADE2](#rade-v2-beta--rade2).

### Estados del indicador del panel

| Indicador | Significado |
|---|---|
| 🔴 Rojo — «Connecting to sidecar…» | Puerto 9012 inalcanzable o sidecar detenido |
| 🟡 Amarillo — «Searching for signal…» | Sidecar conectado, aún sin trama RADE detectada |
| 🟢 Verde — «Synced · SNR x.x dB» | Decodificando: se está reproduciendo la voz |

### Cuando desactiva el decodificador

El modo y el paso de banda vuelven automáticamente al valor correcto por defecto para la frecuencia actual, según se define en `bands-config.js`, igual que con FAX, NAVTEX y FSK.

---

## Verificación y depuración

### ¿Está funcionando el sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 9012
```

### Observar la actividad en directo

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Cuando se conecta un navegador:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Consola del navegador (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:9000/rade
```
Bien: el WebSocket se ha abierto. El valor en Hz coincide con el `audioOutputSps` de su servidor (normalmente 8000-12000 Hz).

```
[RADE] sidecar socket error
```
El sidecar no es accesible — compruebe que está en marcha (`ss -tlnp | grep 9012`) y que `proxy.py` está en marcha.

---

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `RADE_HELPER_PORT` | `9012` | Puerto TCP en el que escucha el sidecar |
| `RADE_HELPER_HOST` | `0.0.0.0` | Dirección de enlace (`127.0.0.1` si está tras un proxy) |
| `RADAE_DIR` | `~/radae` | Raíz del repositorio radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Pesos del modelo |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binario lpcnet_demo |
| `RADE_AUXDATA` | `1` | Póngalo a `0` para pasar `--noauxdata` a `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | Hilos de PyTorch/OpenBLAS por instancia de `radae_rxe.py`: limita el uso de CPU |
| `RADE_PIN_CORES` | `1` | Fija cada cadena de decodificación a su propio conjunto de núcleos; `0` desactiva la fijación |
| `RADE_CORES_PER_CLIENT` | `2` | Núcleos asignados por cliente cuando la fijación está activa |
| `RADE_C_DIR` | `~/rade_c` | Raíz de rade_c (RADE V2) |
| `RADE_C_RX` | `RADE_C_DIR/build/src/radae_rx` | Programa receptor de rade_c |
| `RADE_C_LPCNET` | `RADE_C_DIR/build/src/lpcnet_demo` | El lpcnet_demo propio de rade_c |
| `RADE_V2_MIN_SNR` | `-2` | Por debajo de este SNR (dB) el audio de V2 se silencia |
| `RADE_V2_WEAK_SNR` | `-6` | Hasta este SNR (dB) V2 sigue sonando mientras la señal parezca V2 real; póngalo en `RADE_V2_MIN_SNR` o más para desactivarlo |
| `RADE_V2_TARGET_DB` | `-16` | Nivel hacia el que se lleva la voz de V2, en dBFS (`0` = desactivado) |

---

## Resolución de problemas

### Cartel rojo — «Sidecar not reachable»

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &
```

---

### `lpcnet_demo: No such file or directory`

La compilación de radae no llegó a completarse. Vuelva a compilar:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Indicador amarillo — «Searching for signal» — nunca sincroniza

- Confirme la banda lateral correcta: RADEL para ≤ 10 MHz, RADEU para > 10 MHz
- Consulte [qso.freedv.org](https://qso.freedv.org) para confirmar que hay una estación transmitiendo en ese momento
- RADE v1 usa 30 portadoras en 1500 Hz de ancho de banda: aparece como un grupo compacto en la cascada
- Deje hasta 1,5 segundos para la adquisición

---

### Varios usuarios simultáneos

Cada conexión de navegador genera su propio par independiente `radae_rxe.py` + `lpcnet_demo`, de modo que cada usuario puede sintonizar libremente una frecuencia distinta.

Por defecto, `radae_rxe.py` usa **todos los núcleos de CPU disponibles** para las operaciones matriciales de PyTorch, lo que provoca un uso de CPU del ~900 % por instancia. `rade_helper.py` lo limita con dos optimizaciones:

1. `OMP_NUM_THREADS=1` (y los equivalentes de MKL/OpenBLAS): limita PyTorch a 1 hilo
2. Funciones de conversión de audio vectorizadas con numpy: eliminan la sobrecarga de los bucles de Python

Resultado: cada instancia usa aproximadamente el **8-10 %** de un núcleo, suficiente para decodificar RADE en tiempo real. Si oye cortes de audio, suba a 2 hilos:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Usuarios de RADE simultáneos | CPU aproximada |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

En un i5-12450H (12 hilos) con spectrumserver usando ~42 % y rx888_stream ~11 %, dispone de aproximadamente un **1000 % de margen**, suficiente para **más de 20 usuarios simultáneos** de RADE antes de que la CPU sea un problema.

---

## Actualizar RADE v1

**Para actualizar RADE, ejecute de nuevo `./install_rade.sh`.** Descarga lo último de radae y rade_c, los recompila y reinicia el sidecar; el receptor no necesita reiniciarse.

---

*Desarrollado y probado en PhantomSDR-Plus (fork sv1btl/PhantomSDR-Plus) con un RX-888 MK2 en Ubuntu 24.04. El servidor en C++ no se modifica.*

*RADE lo desarrollan David Rowe VK5DGR y el equipo de FreeDV.* *Véase [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Desinstalación completa y reinstalación limpia

Este es el desmontaje completo antes de volver a ejecutar install_rade.sh:
1. Detener el sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Eliminar el repositorio radae y la compilación rm -rf ~/radae
3. Eliminar torch (instalado en el directorio local del usuario) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Eliminar los paquetes de Python de apt (opcional: omítalo si los usan otros programas) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Comprobar que no queda nada python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Instalación limpia chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
