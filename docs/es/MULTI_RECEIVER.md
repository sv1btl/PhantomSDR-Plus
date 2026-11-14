# Varios receptores — Manual del sysop

> **Números de puerto.** Los ejemplos de abajo usan los puertos que propone `install.sh`: `proxy.py` en el puerto público 9000, el receptor principal en 9001 y los demás receptores en 9002, 9003, etc. Las preguntas de la estación mantienen `receivers.toml` al día: cuando cambia un puerto o la dirección, `configure-station.sh` lleva el receptor principal a su nuevo puerto y escribe cada enlace como `<dirección>/?rx=<id>` — un enlace sin `?rx=` dejaría al visitante en el receptor que recuerda la cookie `rx`. Nunca dé a un receptor el propio puerto público: el proxy se reenviaría a sí mismo, por eso ahora lo rechaza.

**Dos o más receptores en un mismo ordenador, con un selector de receptor en la página.**

Desde la v5.0.0 un ordenador PhantomSDR-Plus puede hacer funcionar varios receptores a la vez — por ejemplo un RX-888 para HF y un RTL-SDR para 2 m — y los oyentes pasan de uno a otro con botones en la cabecera de la página, igual que OpenWebRX ofrece sus perfiles. Cada receptor conserva su propia cascada, chat, marcadores, lista de oyentes y datos de estación; nadie en un receptor resulta nunca molestado por alguien en otro.

> **¿Prisa?** Una estación con un solo receptor no necesita nada de esto y no nota ningún cambio. Para un segundo receptor: cree `instances/<nombre>/` con su propio `config.toml`, arránquelo con `INSTANCE=<nombre> ./start-<radio>.sh`, anote ambos receptores en `receivers.toml` y reinicie el proxy. El ejemplo de la [sección 3](#3-añadir-un-segundo-receptor) lo recorre línea a línea.

> **La manera más fácil:** ejecute `./add-receiver.sh` (los instaladores lo ofrecen al final). Pregunta qué receptor y qué debe cubrir, instala su controlador, escribe todo lo descrito en la [sección 3](#3-añadir-un-segundo-receptor) y la [sección 4](#4-receiverstoml), y ofrece arrancar el receptor y reiniciar el proxy. El resto de este manual explica lo que hace, por si quiere cambiar algo a mano.

> **Desde el panel de administración:** la página **Receivers** lista cada receptor con lo que cubre. **✎ CHANGE SETTINGS** cambia la frecuencia y el ancho de banda de un receptor adicional (y reinicia solo ese), y en cada receptor la frecuencia inicial, el modo, la ganancia y el nombre del botón — un receptor adicional guarda su ganancia en `instances/<id>/instance.env`, el principal en `main.env`, que cada start-*.sh lee el último. **■ STOP** / **▶ START** detiene o arranca un receptor mientras los demás siguen, y **🗑 DELETE** elimina un receptor adicional (lo detiene, lo quita de `receivers.toml`, mueve su carpeta `instances/<id>/` a `admin-backups/`). También prepara un receptor nuevo: guarda sus respuestas y da `./add-receiver.sh --answers instances/.add-rx.env` para ejecutar en una terminal. Vea [Panel de administración](ADMIN_PANEL_SETUP.md).

---

## Contenido

1. [Cómo funciona](#1-cómo-funciona)
2. [Dos maneras de publicar los receptores](#2-dos-maneras-de-publicar-los-receptores)
3. [Añadir un segundo receptor](#3-añadir-un-segundo-receptor)
4. [receivers.toml](#4-receiverstoml)
5. [Arrancar y detener](#5-arrancar-y-detener)
6. [Lo que ven los oyentes](#6-lo-que-ven-los-oyentes)
7. [El S-meter por encima de 30 MHz](#7-el-s-meter-por-encima-de-30-mhz)
8. [Seguridad](#8-seguridad)
9. [Cuántos receptores caben](#9-cuántos-receptores-caben)
10. [Trampas que conviene conocer](#10-trampas-que-conviene-conocer)

---

## 1. Cómo funciona

Cada receptor es un spectrumserver completo y propio, con su propio SDR, su propia configuración y su propio puerto interno. Nunca comparten muestras, ajustes ni oyentes. Lo que los une es `proxy.py`, el proxy inverso que ya sirve el panel de administración: lee `receivers.toml` y envía cada petición a un receptor.

```
                       ┌──► :9001  spectrumserver  RX-888   (HF, el receptor principal)
oyentes ──► proxy.py ──┤
                       └──► 127.0.0.1:9002  spectrumserver  RTL-SDR  (2 m, instancia "vhf")
```

El proxy decide con estos datos, en este orden:

1. `?rx=<id>` en la dirección — `http://su.host:9000/?rx=vhf`. La página lo añade a cada socket, consulta y enlace que abre, de modo que una pestaña se queda en su receptor.
2. La cookie `rx`, que el proxy fija cada vez que una petición lleva un `?rx=` válido.
3. La cabecera Host, si un receptor tiene ese nombre en `hostnames`.
4. Si no, el receptor por defecto.

El **receptor principal** es el que se arranca de la forma habitual (`./start-rx888mk2.sh`). Cualquier otro receptor es una **instancia con nombre**: se arranca con `INSTANCE=<nombre>`, se configura en `instances/<nombre>/` y tiene su propio registro (`logwebsdr-<nombre>.txt`), registro del servidor, bloqueo del watchdog y FIFO. Los procesos se distinguen por una etiqueta `PHANTOMSDR_INSTANCE` en su entorno, no por su nombre, así que dos receptores pueden ejecutar exactamente el mismo programa — dos `rtl_sdr`, o `rx_sdr` para un RSP1A y un Airspy — y reiniciar uno nunca afecta al otro.

---

## 2. Dos maneras de publicar los receptores

**A — el receptor principal conserva su propio puerto.** El receptor principal se queda exactamente donde estaba (por ejemplo `:9001`), sus oyentes no notan nada, y a los demás receptores se llega por el puerto del proxy (`proxy_port` en `admin_config.json`, por ejemplo `:9000`) con `?rx=`. No hay que mover nada ni nada sale del aire; a cambio hay dos puertos públicos.

```
HF:  http://su.host:9001/
2 m: http://su.host:9000/?rx=vhf
```

**B — un solo puerto público para todo.** El proxy se queda con el puerto público y el receptor principal pasa a uno interno. Defina `[front] port` en `receivers.toml`, mueva el `[server] port` del receptor principal y ponga en él `host = "127.0.0.1"`, ponga en `public_port` de `admin_config.json` el nuevo puerto interno y añada `public_port = <el puerto público>` bajo `[websdr]`, para que el directorio siga anunciando el correcto. Así todo queda detrás de un puerto; el precio es un breve corte durante el cambio.

```
HF:  http://su.host:9000/
2 m: http://su.host:9000/?rx=vhf
```

El selector de receptor funciona igual en ambos casos. La disposición A es el comienzo más seguro; la B puede llegar después sin cambiar nada del segundo receptor.

---

## 3. Añadir un segundo receptor

**`add-receiver.sh` añade un receptor** — ejecútelo y responda a sus preguntas; instala el controlador (`setup-rtlsdr.sh` para un RTL-SDR, el `setup-*.sh` correspondiente para los demás), elige un puerto interno libre, escribe la carpeta de la instancia, su configuración y su línea en `receivers.toml`, y da al receptor un nombre según lo que cubre. La página **Receivers** del panel de administración hace lo mismo con ➕ ADD NEW RECEIVER.

---

## 4. receivers.toml

Copie `receivers.toml.example` a `receivers.toml`. Sin ese archivo el proxy sirve un único receptor, como siempre.

```toml
# [front]
# port = 9000        # solo disposición B: el proxy escucha también en este puerto público

[[receiver]]
id       = "hf"
name     = "HF 0-30 MHz (RX-888 MkII)"
port     = 9001
default  = true
launcher = "start-rx888mk2.sh"
url      = "http://su.host:9000/"

[[receiver]]
id       = "vhf"
name     = "2 m (RTL-SDR Blog V4)"
port     = 9002
launcher = "start-rtl.sh"
instance = "vhf"
url      = "http://su.host:9000/?rx=vhf"
```

| Clave | Significado |
|---|---|
| `id` | Nombre corto usado en `?rx=`; letras, dígitos, `-` y `_` |
| `name` | El texto del botón del receptor |
| `port` | El `[server] port` de su spectrumserver |
| `host` | Opcional; dónde funciona ese spectrumserver (por defecto `127.0.0.1`) |
| `default` | El receptor para las peticiones que no nombran ninguno; como mucho uno |
| `launcher` | Su `start-*.sh`, para `start-all.sh`; omítalo en un receptor que este ordenador no arranca |
| `instance` | El nombre de su instancia; omítalo en el receptor principal |
| `url` | Adónde envía su botón al oyente; sin ella, `/?rx=<id>` en el proxy |
| `hostnames` | Nombres DNS opcionales que llevan directamente a este receptor |

El proxy sirve también la lista como `/receivers.json` (ids, nombres y enlaces — nunca los puertos internos), que es lo que lee el selector.

---

## 5. Arrancar y detener

| Orden | Hace |
|---|---|
| `./start-rx888mk2.sh` | Arranca o reinicia el receptor principal |
| `INSTANCE=vhf ./start-rtl.sh` | Arranca o reinicia el receptor `vhf` |
| `./start-all.sh` | Arranca cada receptor de `receivers.toml` que tenga `launcher` |
| `./stop-websdr.sh vhf` | Detiene solo `vhf` |
| `./stop-websdr.sh main` | Detiene solo el receptor principal |
| `./stop-websdr.sh` | Detiene todos los receptores, como siempre |

**Mientras un receptor está detenido**, su botón desaparece del selector — el proxy lista solo los receptores que responden, y las páginas abiertas vuelven a leer la lista cada 15 segundos — y vuelve cuando el receptor arranca de nuevo; con un solo receptor en marcha, la línea *Receivers:* desaparece del todo. Un receptor detenido vuelve solo cada vez que se arrancan todos los receptores: `./start-all.sh`, el **Restart** del panel de administración y un reinicio del thermal guard arrancan todo lo que figura en `receivers.toml`. Para dejar uno apagado para siempre, bórrelo en la página **Receivers** del panel de administración, o quite (o comente) a mano su bloque `[[receiver]]` — el proxy vuelve a leer `receivers.toml` cada vez que cambia, así que un cambio de nombre, una eliminación o un bloque nuevo surten efecto sin reiniciar el proxy (solo el primer `receivers.toml` de una estación, o un cambio de `[front] port`, lo sigue necesitando).

Ponga el **Default start script** del panel de administración en `start-all.sh`. Su Stop ya detiene todos los receptores, y su Restart y la protección térmica usan el script de arranque; con `start-all.sh` devuelven todos los receptores en lugar de solo el principal.

El auxiliar RADE pertenece solo al receptor principal. Una instancia con nombre nunca lo arranca ni lo detiene.

---

## 6. Lo que ven los oyentes

**El selector de receptor.** En una estación con más de un receptor la cabecera de la página recibe una línea propia, *Receivers:*, con un botón por receptor; el actual aparece en amarillo. La página /mobile tiene los mismos botones como segunda fila de su barra superior, y abren la página /mobile del otro receptor.

**Franjas Show All.** Una casilla *Show All* tras los botones de receptor muestra cada uno de los demás receptores bajo la cascada del oyente como una franja en vivo. Un clic ahí abre ese receptor sintonizado en la frecuencia pulsada, y una página que el oyente dejó se reabre con la vista con la que la dejó. Cada franja es un socket solo de cascada hacia el otro receptor (`/waterfall?rx=<id>`): allí no es un oyente —ni el recuento de usuarios ni el límite de oyentes por IP lo ven; `per_ip_sockets` sí— y cuesta unos 10 KB/s de subida por cada oyente que marque la casilla. Está desactivada por defecto y no necesita nada en el servidor. Cuando el otro receptor cubre más de una banda, la cabecera de la franja ofrece sus bandas en una lista desplegable (las mismas que sus botones de banda); una banda encuadra la franja como su botón de banda, y un clic abre entonces el receptor encuadrado en esa banda. La elección se guarda por receptor en el navegador del oyente.

**Cambio por frecuencia.** Una frecuencia fuera de la cobertura de este receptor que otro receptor cubre —escrita, desde un enlace, un marcador o un spot— abre el receptor que la cubre. La página conoce el rango de cada receptor abriendo un instante su socket `/waterfall`, y lo recuerda durante un día.

**Usuarios y estadísticas por receptor.** Las ventanas *Connected Users* y *User Statistics* muestran el receptor en cuya página están, aunque haya varios receptores abiertos uno junto a otro en el mismo navegador. Las estadísticas salen de los propios registros de ese receptor: `logs/` para el receptor principal, `instances/<id>/logs/` para los demás.

**Los datos propios de cada receptor.** Una página abierta en un segundo receptor carga el `site_information.json` de ese receptor antes de arrancar, de modo que los botones de banda, la frecuencia inicial, la lista de oyentes, los datos de estación y los enlaces de Receiver y Antenna son todos suyos. Una visita normal al receptor principal no hace ninguna petición adicional.

Las claves de `site_information.json` para esto:

| Clave | Significado |
|---|---|
| `siteReceiverId` | El receptor al que pertenece esta página (su `id`); omítala en el receptor principal |
| `siteReceiversList` | De dónde lee el selector la lista, p. ej. `http://su.host:9000/receivers.json`; necesaria en un receptor cuya página no se sirve a través del proxy |
| `siteReceiverURL` | Adónde enlaza el nombre de *Receiver* en *Open Additional Info* |
| `siteAntennaURL` | Adónde enlaza el nombre de *Antenna*; `""` muestra el nombre sin enlace |

**Cuándo el selector queda oculto.** El selector solo muestra una lista que nombra el host con el que se abrió la página. Abierta por dirección de la red local (`http://192.168.1.10:9000/`) queda oculto; abierta como `http://su.host:9000/` aparece. Es deliberado: una estación que copió el `site_information.json` de otra sin editarlo nunca muestra los receptores de aquella como propios.

---

## 7. El S-meter por encima de 30 MHz

La norma de la IARU Región 1 sitúa S9 en −73 dBm por debajo de 30 MHz y en **−93 dBm por encima**, con seis dB por unidad S en ambos casos. Los S-meter (la aguja analógica, la barra digital y la barra de /mobile) siguen la frecuencia sintonizada: por encima de 30 MHz indican unidades S de VHF, por debajo como antes. Las cifras en dBm y dBµV no cambian nunca. Si prefiere que los medidores se queden en 0 con el canal vacío, como en un transceptor de VHF/UHF, añada `"siteSMeterGateDb": 6` al `site_information.json` del receptor (sin recompilar): por encima de **60 MHz** la aguja y la barra solo suben entonces cuando una señal supera en esos dB el ruido de su propio entorno (el punto más fuerte de la banda de paso frente al espectro ±100 kHz alrededor). Está **desactivado por defecto** — un medidor calibrado que muestra el ruido real de la banda es la lectura más honesta. La página /mobile, que no tiene cascada, estima el ruido a partir del propio nivel recibido.

Calibre los dBm de un receptor de VHF con `analog_smeter_offset` (aguja y cifras) y `smeter_offset` (barra digital) en `[input]` de su `config.toml`, y luego reinicie ese receptor. Fije primero la ganancia: un RTL-SDR informa de los niveles respecto a su propio fondo de escala, así que cada cambio de ganancia mueve las lecturas. Sin generador de señales, una carga de 50 Ω en lugar de la antena, en USB con filtro de 2,7 kHz, debería marcar unos −136 dBm (el ruido térmico en 2,7 kHz es −139,7 dBm, más la figura de ruido del dispositivo).

Para un RTL-SDR, `add-receiver.sh` escribe una calibración de partida: una ganancia fija `-g 29.7` en `instance.env` (la ganancia automática del sintonizador no se puede calibrar) y `analog_smeter_offset=-55`, `smeter_offset=-38`, medidos en un RTL-SDR Blog V4 con esa ganancia y una señal de −71 dBm (63 µV). Otro dispositivo del mismo modelo suele quedar a pocos dB; compruébelo con una señal conocida y recalibre si cambia la ganancia.

---

## 8. Seguridad

Ate cada receptor al que se llega a través del proxy a `127.0.0.1` (`[server] host`), para que su puerto no pueda usarse rodeando el proxy. Los límites por dirección de [Límites de conexión](CONNECTION_LIMITS.md) se aplican por receptor.

---

## 9. Cuántos receptores caben

El software no pone límite; el hardware sí. Los receptores de banda estrecha son baratos: un RTL-SDR a 2,4 Msps usa un 5–10 % de un núcleo, unas decenas de MB de memoria y unos 38 Mbit/s de USB.

- **El USB 2.0 es el techo habitual.** Todos los dispositivos USB 2 comparten un bus de 480 Mbit/s, incluso en un conector azul USB 3. Tres o cuatro RTL-SDR por bus es una cifra segura; añádalos de uno en uno y vigile cada cascada por si aparecen huecos.
- **Alimentación:** con más de dos dispositivos use un hub alimentado.
- **Un segundo receptor de banda ancha** (otro RX-888, o un HackRF a 20 Msps) es otra cosa: compite con el primero por USB 3, CPU y GPU.
- **Los oyentes cuestan más que los receptores.** Cada oyente cuesta CPU en su receptor y ancho de banda de subida, así que cuenta más el número total de oyentes que el número de receptores.

---

## 10. Trampas que conviene conocer

- **Dos dispositivos del mismo modelo tienen el mismo número de serie.** Todo RTL-SDR Blog V4 indica `00000001`. Dé a cada uno el suyo con `rtl_eeprom -s <serie>` (con un solo dispositivo conectado cada vez) y nómbrelo en `instance.env` (`RX_ARGS="-d <serie> …"`), o tras un reinicio los dispositivos pueden intercambiarse los receptores.
- **Los clientes Kiwi no pueden elegir receptor.** Un cliente KiwiSDR marca una dirección y un puerto sin más; a través del proxy siempre acaba en el receptor por defecto. Mantenga `[kiwi_emulation]` desactivado en los demás.
- **Las cookies son por host, no por puerto.** Un visitante que usó el segundo receptor en `:9000` lleva `rx=vhf` también a `:9001`. Por eso una página decide qué receptor es a partir de `siteReceiverId`, nunca de la cookie.
- **Entradas en los directorios.** Dé a cada receptor su propio nombre en `[websdr]`, y en un receptor detrás del proxy ponga `[websdr] public_port` al puerto que usan los oyentes, o la entrada anunciará el interno.
- **Una compilación del frontend muestra brevemente «Not Found».** `frontend/dist` se recompila en su sitio, así que durante unos segundos de la compilación la página falta en todos los receptores.
- **Nada arranca los receptores al encender el ordenador**, salvo que usted lo prepare. Tras un reinicio, `./start-all.sh` los devuelve todos.
