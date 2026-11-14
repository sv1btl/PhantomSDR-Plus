# Panel de administración de PhantomSDR-Plus — Guía de configuración

> ⚠️ **Aviso de seguridad:** mantenga este panel de administración en su red doméstica o detrás de una VPN. No se recomienda exponer públicamente el puerto de administración sin un refuerzo adecuado de la autenticación.

---

## Descripción general

El panel de administración consta de dos servicios de Python:

| Servicio | Archivo | Función |
|---|---|---|
| Panel de administración | `admin_server.py` | Aplicación web Flask, se enlaza a `127.0.0.1` (solo interna) |
| Proxy inverso | `proxy.py` | Expone tanto el SDR como el panel de administración en un único puerto público |

Ambos servicios leen su configuración de `admin_config.json`, que escribe `setup_admin.sh`. **No edite las constantes de puerto directamente en los archivos de Python**: todos los puertos y la IP del host SDR se guardan en `admin_config.json`.

---

## Qué le ofrece el panel de administración

- **Panel de control** — estado del servidor en directo, CPU/RAM, procesos principales, salida reciente de los registros, terminal
- **Editor de configuración** — ver, editar y guardar cualquier archivo `.toml`, `.sh`, `.json`, `.h` o `.cpp` de su instalación
- **Visor de registros** — seguir cualquier archivo de registro en tiempo real (servidor SDR, panel de administración, RADE, fallos, autorun, proxy)
- **Marcadores** — ver y editar los marcadores de frecuencia
- **Historial del chat** — ver el registro del chat del WebSDR, borrarlo por completo o eliminar mensajes concretos sin reiniciar el servidor
- **Mensaje en la cascada** — difundir un cartel persistente a todos los usuarios conectados, visible en tiempo real en la cascada
- **Usuarios** — lista en vivo de los oyentes conectados con su nombre o indicativo, ubicación y dirección IP, frecuencia, modo y duración, un botón ⚡ Kick y un menú ⛔ Ban ▾ (8, 16 o 24 horas), y un mapa de dónde están
- **Eliminación de mensajes del chat** — botón 🗑 Delete que quita de inmediato ese único mensaje del registro
- **Mensajes difundidos en la cascada** — permite enviar un cartel de texto persistente a la cascada de cada usuario conectado
- **Spot Reporting** — iniciar/detener el decodificador autorun de FT8/FT4/JS8/WSPR, elegir bandas y modos e informar de spots a PSK Reporter / wsprnet (desactivado por defecto), con dos contadores: paneles por decodificador para la ejecución actual y un total histórico junto a cada casilla de banda/modo Cada banda y modo funciona en las horas UTC que se programen, y el demonio puede arrancar solo tras un reinicio o un fallo.
- **Gráficas** — frecuencia de CPU, carga de CPU, temperatura de CPU y usuarios conectados, representados en los últimos 15 minutos / 1 hora / 4 horas / 12 horas / 24 horas
- **Protección térmica (Thermal Guard)** — detiene el servidor si la CPU se sobrecalienta y lo reinicia cuando se enfría, con umbrales derivados de su propia CPU; funciona con cualquier método de arranque/parada y se entrega en modo de solo registro, por lo que no hace nada hasta que usted lo active
- **Ajustes** — cambiar la contraseña de administrador, el directorio base del SDR, el nombre del proceso y el puerto de spectrumserver (con el puerto de los oyentes debajo); ejecutar el script de inicio o de parada por defecto con ▶ START / ■ STOP; una tarjeta **HTTPS** que comprueba https o le guía para activarlo
- **Receptores** — cada receptor de la estación con el rango que cubre, su ancho de banda, su ganancia y si está en el aire; cambiar los ajustes y la ganancia de un receptor, detener o arrancar, renombrar o borrar un receptor, y preparar un receptor nuevo para `add-receiver.sh`
- **Estado del sistema** (Dashboard) — cada receptor en el aire o fuera, con su tiempo en marcha, el espacio libre en disco y el tamaño de cada carpeta de registros, la última entrada de `crash.log` y las alertas recientes
- **DRM** (Dashboard) — el decodificador DRM: si su ayudante funciona, cuántos decodificadores están en uso y quién decodifica qué frecuencia (estación, códec, WMER); activar o desactivar DRM y fijar el número máximo de oyentes DRM (1–20), aplicado en 5 s sin reiniciar. La página de usuarios muestra a esos oyentes como DRM
- **Receive Diversity** (Dashboard) — cada oyente que combina su receptor con otro mediante diversidad de recepción: nombre y ciudad, frecuencia y modo, el socio (PhantomSDR+, KiwiSDR, UberSDR o WebSDR) y su dirección. Solo lo ve el panel de administración, nunca la lista pública de usuarios
- **Visitantes** — estadísticas privadas de visitantes de 1 a 31 días: visitantes, sesiones, horas de escucha, el máximo simultáneo, por día, las horas de más actividad, países, y las direcciones con más sesiones a la vez, con ⛔ Ban ▾
- **Alertas** — un correo y/o un mensaje de Telegram cuando un receptor sale del aire, vuelve o se reinicia, cuando el thermal guard cambia de etapa, o cuando `crash.log` recibe una entrada nueva
- **Copia y restauración** — un zip con los ajustes propios de la estación, y una restauración que copia antes cada archivo que reemplaza en `admin-backups/`
- **Temas** — Phosphor green, Amber display, Metal panel, Modern dark, Light y Auto (claro de día, oscuro de noche), elegidos con **THEME** en la barra superior de cada página

---

## Requisitos

- PhantomSDR-Plus ya instalado y en funcionamiento
- Python 3.8+

> [!NOTE]
> **Normalmente el instalador ya hace esto por usted.** `./install.sh` — igual que cada uno de los cuatro instaladores por distribución, los dos instaladores de RADE y el del servidor de estadísticas — configura el panel por defecto, instalando antes `pip` con el gestor de paquetes del sistema si falta. Esta página describe lo que ocurre en ese paso y qué hacer si lo omitió o quiere cambiar algo después.

Las bibliotecas de Python del panel (`flask`, `psutil`, `aiohttp`, `tomli-w`) las instala `setup_admin.sh`; si eso falla, imprime el comando exacto que debe ejecutar.

---

## Paso 1 — Ejecutar el script de configuración

```bash
./setup_admin.sh
```

> **Sin panel de administración:** `bash setup_admin.sh --proxy-only` instala solo `proxy.py` en el puerto público, con los puertos de `station.conf`. Es lo que hace el instalador cuando rechaza el panel, porque al proxy llegan los oyentes — y `/rade`, `/stats`, `/relay`.

El script hará lo siguiente:

1. Comprobar que Python 3 está instalado
2. Verificar que existen `admin_server.py` y `manage_admin.sh`
3. Registrar `127.0.0.1` como `sdr_host` en la configuración (véase [El ajuste `sdr_host`](#el-ajuste-sdr_host))
4. Pedir tres números de puerto. Cada pregunta ofrece un valor predeterminado entre corchetes
que se acepta con un simple Enter, de modo que una instalación normal son tres pulsaciones:
   - **Puerto de spectrumserver** — el puerto en el que escucha su servidor SDR (predeterminado `9001`,
     que es justo el que trae cada `config-*.toml` del repositorio)
   - **Puerto interno del panel de administración** — donde `admin_server.py` se enlaza localmente (predeterminado `9010`)
   - **Puerto público del proxy** — el único puerto externo que combina SDR y administración (predeterminado `8902`)
   En una estación configurada con las preguntas de la estación (`configure-station.sh`), los tres valores por defecto son los puertos propios de la estación en `station.conf` — 9001, 9010 y 9000 —, así que Enter es lo correcto, y el script de arranque ya está preseleccionado.

Tras la configuración, abra el navegador a través del proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Contraseña por defecto: **`admin`**

> ⚠️ **Cambie la contraseña de inmediato**: en el primer inicio de sesión, un asistente de un solo paso pide únicamente una contraseña nueva. El directorio y los puertos ya están en `admin_config.json` (los escribe `setup_admin.sh`, que ejecuta el instalador); el asistente los muestra solo como referencia y no los modifica. Puede cambiarlos más tarde en Settings o con `./configure-station.sh`.

---

## Paso 2 — Iniciar / detener / reiniciar

Hay dos formas de ejecutar el panel y el proxy. **Elija una y manténgala** — la advertencia al final de esta sección explica qué ocurre si las mezcla.

> **El Método B (systemd) se recomienda encarecidamente** siempre que haya systemd. La protección contra sobrecalentamiento se ejecuta dentro del panel, así que un panel que muere a las 03:00 o una máquina que se reinicia dejan la CPU desprotegida hasta que alguien la arranque a mano. `setup_admin.sh` ya ofrece las unidades por defecto. Use el Método A cuando no haya systemd — contenedores, WSL1, OpenRC/sysvinit — o cuando quiera supervisarlo usted deliberadamente.

### Método A — `manage_admin.sh` (sin root, sin instalar nada)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Un único script controla **ambos** procesos. Comprueba que `aiohttp` esté instalado antes de arrancar el proxy y muestra un error claro con el comando de solución si falta.

### Método B — unidades systemd (arranca al inicio, se reinicia tras un fallo)

El repositorio incluye dos unidades listas, `phantomsdr-admin.service` y `phantomsdr-proxy.service`. Ajuste `User=` y las rutas en ambas, y después:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Los comandos del día a día pasan a ser:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Los mismos cuatro con `phantomsdr-proxy`, o ambos a la vez: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

Algo que conviene hacer una vez: instalar la regla tmpfiles de `tmpfiles/phantomsdr-logs.conf` (cambie antes sus rutas y el usuario). systemd crea esos dos registros como `root` antes de bajar a `User=`, y entonces el botón **Clear Logs** del panel falla con `Permission denied` — véase más abajo «Clear Logs dice Permission denied». `setup_admin.sh` instala la regla por usted.

Para volver al Método A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **No mezcle ambos.** Con las unidades activadas, `./manage_admin.sh stop` lo deshace systemd cinco segundos después, y `./manage_admin.sh start` le deja una segunda copia sin gestionar peleando con la de systemd por el mismo puerto. (`restart` se eliminó del script justo por esto; ahora imprime un error remitiéndole a `systemctl`.) `./manage_admin.sh status` solo lee, así que sigue siendo útil en ambos casos.

### Reiniciar el panel

El resto de este documento dice «reinicie el panel» en varios sitios. Significa el que corresponda a su método:

```bash
# Método B — unidades systemd (la configuración normal)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Método A — sin unidades instaladas
./manage_admin.sh stop && ./manage_admin.sh start
```

---

## Paso 3 — Abrir el puerto en el cortafuegos

Abra en el cortafuegos únicamente el **puerto público del proxy**. No es necesario exponer al exterior el puerto interno del panel de administración:

```bash
sudo ufw allow <proxy_port>
```

---

## Paso 4 — Función de expulsar usuarios

La página Users muestra cada oyente conectado en este momento. Cada fila muestra el nombre o indicativo que escribió el oyente (`--` si ninguno), la ubicación con la dirección IP debajo, la frecuencia sintonizada, el modo y el tiempo que lleva conectado. Para desconectar a un usuario, pulse el botón **⚡ Kick** de su fila — solo se cierran las conexiones de ese oyente. Todos los demás oyentes siguen conectados y no notan nada.

Junto al modo, la página Users muestra el decodificador que el oyente usa en su página, por ejemplo `USB · FT8` (los oyentes de DRM aparecen como `DRM`). Las páginas abiertas antes de actualizar el servidor lo indican solo después de recargarlas.

La expulsión es instantánea y quirúrgica: el servidor no se reinicia, el audio de nadie más se interrumpe y el usuario expulsado puede volver a conectarse de inmediato (la función sirve para quitar conexiones problemáticas o colgadas; para mantener a alguien fuera, use el bloqueo de abajo).

**⛔ Ban ▾** abre un pequeño menú — **8**, **16** o **24 horas** — y la duración elegida desconecta al oyente de todos los receptores de la estación y rechaza esa dirección durante ese tiempo (24 horas es lo máximo que acepta el receptor) (código de cierre 4001, que la página no reintenta). El bloqueo se guarda en `admin_bans.json` junto al panel y se envía de nuevo a cada receptor una vez por minuto, de modo que reiniciar un receptor no lo levanta. Mientras haya bloqueos en vigor, una lista **Banned** bajo la tabla muestra cada uno con su nombre, dirección y hora de fin, y un botón **Unban** lo levanta al instante. Todos los que están detrás de la misma conexión a internet comparten la dirección y quedan bloqueados con ella.

---

## Configuración — admin_config.json

Toda la configuración de ejecución reside en `admin_config.json`, dentro de su directorio PhantomSDR-Plus. `setup_admin.sh` escribe el archivo inicial; los cambios posteriores pueden hacerse desde la página Settings o editando el archivo directamente.

Campos clave escritos por `setup_admin.sh`:

| Clave | Descripción |
|---|---|
| `port` | Puerto interno del panel de administración (donde se enlaza `admin_server.py`) |
| `public_port` | Puerto de spectrumserver del receptor principal (9001 detrás de proxy.py) — **no** el puerto de los oyentes, que es `proxy_port`. proxy.py reenvía a él; Kick, la página Users y el recuento de oyentes lo consultan |
| `proxy_port` | Puerto público en el que escucha el proxy |
| `sdr_host` | Host que usa el proxy para llegar a spectrumserver — `127.0.0.1` (véase más abajo) |
| `password_hash` | Hash SHA-256 de la contraseña de administrador |
| `sdr_base_dir` | Ruta de su instalación de PhantomSDR-Plus |
| `sdr_process_name` | Nombre del proceso a vigilar (por defecto: `spectrumserver`) |
| `start_script` / `stop_script` | Scripts que el panel ejecuta para arrancar y detener el servidor SDR — también son la vía por la que actúa la protección térmica |

> **¿Varios receptores en un ordenador?** Ponga `start_script` en `start-all.sh`. El script de parada ya detiene todos los receptores, y Restart y la protección térmica usan el script de arranque; con `start-all.sh` devuelven todos los receptores de `receivers.toml` en lugar de solo el principal. La página Users, el recuento de oyentes y la expulsión abarcan entonces también todos los receptores. Vea [Varios receptores](MULTI_RECEIVER.md).

---

## El ajuste `sdr_host`

`proxy.py` se conecta a `spectrumserver` por bucle local — `sdr_host` es `127.0.0.1` en `admin_config.json`, escrito ahí por `setup_admin.sh`. No debería necesitar cambiarlo.

Póngale una dirección real solo si `spectrumserver` se ejecuta en una **máquina distinta** a la del proxy. Después [Reiniciar el panel](#reiniciar-el-panel).

---

## proxy.py — qué es y cuándo lo necesita

`proxy.py` coloca tanto el servidor SDR como el panel de administración en un **único puerto público**, enrutando según el prefijo de la ruta:

| Ruta | Se dirige a |
|---|---|
| `/admin*` | Panel de administración (`localhost:<port>`) |
| Todo lo demás | Spectrumserver (`<sdr_host>:<public_port>`) |

Sin el proxy tendría que exponer dos puertos por separado. Con él solo expone uno.

El proxy también elimina el límite de 4 MB en el tamaño de los mensajes WebSocket (importante para las tramas FFT grandes del RX-888 a 60 MSPS), reenvía las IP reales de los clientes mediante cabeceras `X-Forwarded-*` y mantiene vivas las conexiones de larga duración a través de NAT con un latido cada 30 segundos.

---

## Cambiar los puertos tras la configuración

Edite `admin_config.json` directamente:

```json
{
  "port":        9010,
  "public_port": 9001,
  "proxy_port":  9000,
  "sdr_host":    "127.0.0.1"
}
```

Después reinicie ambos servicios:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Comandos manuales útiles

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 9010/tcp

# Check what is listening on a port
ss -tlnp | grep 9010
```

---

## Archivos de registro

| Archivo | Contenido |
|---|---|
| `admin.log` | Salida del panel de administración |
| `proxy.log` | Cartel de arranque del proxy + una línea de registro de acceso por cada petición reenviada |
| `logwebsdr.txt` | Registro del lanzador y el watchdog: arranque/parada, driver del receptor, registro en websdr.org |
| `spectrumserver.log` | La salida del propio proceso receptor: configuración de FFT y OpenCL, conexiones de cada cliente, errores. El mayor de estos ficheros; se rota, así que puede haber un `spectrumserver.log.1` a su lado |
| `rade.log` | Registro del sidecar RADE/FreeDV |
| `autorun.log` | Registro del demonio decodificador — spots, SNR, deriva |
| `crash.log` | Informes de fallos y eventos térmicos: trazas `[CRASH]` / `[TERMINATE]`, notas `[EXIT]` y líneas `[THERMAL]` de la protección. **Normalmente vacío**: cualquier cosa que contenga merece leerse |

Todos ellos pueden leerse desde las pestañas del **Log Viewer** del panel (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). El visor muestra las últimas 150 líneas de la pestaña seleccionada y se actualiza cada 3 segundos con la actualización automática activada; solo lee el final del fichero, así que su tamaño da igual.

### Rotación de proxy.log y admin.log

`proxy.log` registra cada petición reenviada y `admin.log` cada petición que llega al propio panel. Ninguno de los dos se rota por defecto. Antes las consultas del panel dominaban ambos archivos —`/admin/api/status` se lanza cada ~3 segundos mientras haya una pestaña abierta—, pero ahora se filtran de los dos registros (véase más abajo), así que la rotación sirve para acotar un crecimiento lento, no una avalancha.

El repositorio incluye una configuración de logrotate en `logrotate/phantomsdr` (diaria, o antes si un registro supera los 10 MB; conserva 7 archivos comprimidos en `logproxy/`, para que no llenen la raíz del proyecto). **Es específica de cada instalación: ábrala y cambie las tres rutas de registro, la ruta `olddir` y el usuario `su` para que coincidan con su máquina antes de instalarla**, y después:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

El botón **Clear Logs** del panel vacía **todos** los archivos de la tabla anterior, incluidos `autorun.log` y `proxy.log` (`CLEAR_EXCLUDE` en `admin_server.py` está vacío). Tenga en cuenta lo que eso cuesta en `autorun.log`: su historial de decodificación es el único registro de qué se escuchó y cuándo, y no puede reconstruirse; de un vaciado solo sobrevive lo que logrotate ya haya rotado a `logproxy/`, así que se descarta todo lo decodificado desde la última rotación. Vaciarlo con el decodificador en marcha es seguro: el demonio lo mantiene abierto con `O_APPEND` y sigue escribiendo en el mismo inodo. El aviso indica qué se vació, y si algún archivo no se pudo escribir —por ejemplo un `proxy.log` que pertenece a otro usuario en una instalación con cuentas separadas— nombra ese archivo y el error en lugar de informar de un éxito, y deja en pantalla el panel de ese registro en vez de vaciarlo. Los archivos se truncan en el sitio, nunca se borran: tanto `manage_admin.sh` como las unidades de systemd los abren con `O_APPEND`, de modo que un archivo borrado seguiría llenando un inodo invisible hasta reiniciar el servicio.

Como `proxy.log` es un registro de acceso, contiene direcciones IP de visitantes y cadenas de user-agent; téngalo en cuenta antes de compartirlo al pedir ayuda.

### «Clear Logs» dice Permission denied

En una máquina donde las unidades systemd se instalaron sobre un árbol limpio, el botón puede responder:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Siempre son esos dos archivos y nunca los otros cinco, porque son los únicos que crea el propio systemd. `StandardOutput=append:` lo abre PID 1 **antes** de bajar a `User=`, así que un registro que aún no existe se crea como `root:root 0644`. El panel se ejecuta como su usuario y no puede vaciarlo. Los otros cinco registros los crean los scripts de arranque, que ya se ejecutan como su usuario, por eso se limpian con normalidad. Donde los dos archivos son anteriores a las unidades —`manage_admin.sh` los creó con `>>`— ya tienen el propietario correcto y el botón funciona; por eso el problema solo aparece en una instalación nueva que empezó directamente con systemd.

Compruébelo con `ls -l admin.log proxy.log`: los que fallan dicen `root root`. Repárelos:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

No hace falta reiniciar: systemd sigue escribiendo por el descriptor de archivo que ya tiene abierto, y añadir datos no cambia la propiedad. Pulse **Clear Logs** de nuevo y ambos se vacían.

Para que no vuelva a ocurrir, instale la regla tmpfiles que incluye el repositorio en `tmpfiles/phantomsdr-logs.conf`. Recrea ambos registros con el propietario correcto en cada arranque, antes de que se inicien las unidades, de modo que un registro eliminado —limpieza manual, reinstalación, directorio de instalación movido— nunca vuelva siendo de root. **Es específica de cada máquina: ábrala y cambie primero las dos rutas y el user:group para que coincidan con su equipo**, y luego:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

---

## Resumen de acceso

| Configuración | SDR | Panel de administración |
|---|---|---|
| Sin proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Con proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Eliminación de mensajes del chat

La página Chat History enumera todos los mensajes del registro de chat actual. Cada entrada tiene un botón **🗑 Delete** que quita de inmediato ese único mensaje del registro, sin reiniciar el servidor.

Cómo funciona:

- El panel de administración reescribe el archivo de registro del chat sobre la marcha, eliminando solo la línea del mensaje seleccionado.
- El cambio surte efecto para cualquier usuario que recargue el chat; el historial ya cargado en pestañas abiertas no se actualiza retroactivamente.
- Vaciar todo el registro (botón **Clear All**) trunca el archivo, lo que también surte efecto sin reiniciar.
- Una **respuesta del chat** se guarda como un mensaje corriente que empieza con una marca que nombra el mensaje al que responde, por ejemplo `[RE:2026-09-25 12:00:01|SV1BTL]`, así que en esta lista aparece con esa marca delante. Borrar una respuesta elimina solo esa respuesta. Borrar el mensaje al que responde deja sus respuestas en su sitio, mostrando solo el nombre y la hora a los que responden.

---

## Mensajes difundidos en la cascada

El panel **Waterfall Message** permite enviar un cartel de texto persistente a la cascada de cada usuario conectado sin tocar el proceso del servidor.

### Enviar un mensaje

1. Abra el panel de administración y vaya a **Waterfall Message**.
2. Escriba el texto del mensaje y elija un color (hexadecimal, p. ej., `#ffdd00`).
3. Pulse **Send**: el mensaje aparece de inmediato en todas las vistas de cascada activas.

### Borrar el mensaje

Pulse **Clear** para quitar el cartel de todas las cascadas. El estado del mensaje se mantiene en memoria en el panel de administración; se borra automáticamente si el proceso del panel se reinicia.

---

## Gráficas del sistema

La página **Gráficas** representa cuatro magnitudes sobre un eje de tiempo común:

- **Frecuencia de CPU** — frecuencia media de todos los núcleos, en GHz
- **Carga de CPU** — utilización total, en porcentaje
- **Temperatura de CPU** — en °C, con guías discontinuas a 70 °C (caliente) y 80 °C (crítica)
- **Usuarios conectados** — oyentes conectados al WebSDR en ese momento

Elija el intervalo con **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Al pasar el ratón por la gráfica aparece una cruz con los cuatro valores de ese instante. Las cuatro tarjetas superiores muestran siempre la muestra más reciente.

---

## Thermal Guard

> 📖 **Manual completo: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — los cuatro modos y qué debe hacer el sysop en cada uno, funcionamiento sin el panel, la fase throttle sin root, pruebas y resolución de problemas.

Detiene el servidor SDR cuando la CPU alcanza una temperatura peligrosa y vuelve a arrancarlo una vez fría. Forma parte del panel —no hay nada más que instalar— y aparece como tarjeta **THERMAL GUARD** en el Panel de control, con sus ajustes en **Ajustes**.

Se entrega **inerte**: el modo empieza en `log`, así que de fábrica solo registra lo que *habría* hecho. Nada toca su servidor hasta que usted cambie el modo.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

La pestaña **Spot Reporting** controla el demonio autorun (`autorun/index.js`), un proceso Node.js que decodifica FT8/FT4/JS8/WSPR en el servidor, directamente del receptor, y sube los spots a las redes de reporte:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 se reporta solo a velocidad Normal** — el ciclo de llamada de 15 s, donde están los heartbeats y las CQ. Los spots proceden de heartbeats, tramas compound y mensajes dirigidos; los destinos de grupo como `@ALLCALL` y los indicativos que el decodificador no pudo resolver (`<....>`) nunca se reportan. JS8 comparte la cola de PSK Reporter con FT8 y FT4 y se contabiliza por separado, igual que ellos.


**El reporte está DESACTIVADO por defecto.** No se sube nada hasta que active un destino y pulse **Start**. Decodificar y subir son procesos independientes: el demonio puede decodificar y registrar con el reporte desactivado, de modo que pueda comprobar la actividad antes de que nada se haga público.

> ⚠️ Los spots se suben a redes públicas con **su indicativo**. Active únicamente las bandas y modos que su receptor oiga de verdad, e indique el localizador correcto.

### Requisitos previos

El demonio autorun necesita Node.js 22+, los paquetes npm `ws` + `cbor-x` (resueltos mediante el enlace simbólico `autorun/node_modules` → `frontend/node_modules`) y `util-linux` (`taskset`). Los instaladores lo preparan todo automáticamente; véase la [sección Autorun Spot Reporter de INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Si **Start** falla, la causa habitual es ese enlace simbólico o `taskset` (véase la resolución de problemas más abajo).

### Uso de la pestaña

1. **Identidad** — indicativo y localizador. Se rellenan previamente desde `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, recortado a 6 caracteres); modifíquelos aquí si es necesario. Los reporters solo aceptan un locator de 4 o 6 caracteres (KM17 o KM17VX): uno más largo se recorta a su cuadrado de 6 caracteres, y lo que no sea un locator se rechaza al guardar.
2. **Matriz banda × modo** — marque las combinaciones que desea decodificar. Las filas son bandas y las columnas FT8 / FT4 / JS8 / WSPR; las celdas no admitidas están desactivadas. WSPR cubre además las bandas de LF/MF (2200 m, 630 m) y un canal adicional de 80 m para Europa.
3. **Destinos** — active **PSK Reporter** y/o **wsprnet** (ambos desactivados por defecto).
4. **Max slots** — un límite de cuántas posiciones banda/modo funcionan a la vez; con un [horario](#horario-horas-por-banda-y-modo) se comprueba hora por hora. **SELECT ALL**, a su lado, marca todas las bandas y modos.
5. **Start / Stop** — lanza o detiene el demonio (fijado a los núcleos de CPU superiores con `taskset`, elegidos automáticamente según la máquina; véase *Requisitos de recursos y limitaciones* más abajo). **Save** / **Reload** guardan y releen la configuración; **Free All** vacía todas las ranuras. **Start automatically after a reboot or crash** vuelve a poner en marcha el demonio por sí solo — vea [más abajo](#arranque-automático-tras-un-reinicio-o-un-fallo).

La tarjeta de estado se actualiza cada 5 s y muestra el estado de ejecución, los contadores de decodificación/subida y la hora de la última subida. Aparece un distintivo **📶 REPORTING** en la cascada principal mientras el reporte está activo.

> **Ver «0 sent» durante los primeros minutos es normal.** PSK Reporter sube por lotes cada **5 minutos** y wsprnet cada **2 minutos**: los spots esperan en cola hasta el siguiente envío. La tarjeta de estado muestra el número pendiente y la cadencia.

### Cambiar bandas o modos mientras está en marcha

Un cambio guardado llega por sí solo a un demonio en marcha. El demonio mira `autorun.json` cada 5 segundos y, cuando **SAVE CONFIG** lo ha cambiado, toma las nuevas bandas, modos, horas y destinos sin reiniciarse: las posiciones nuevas se abren, las retiradas se cierran y `autorun.log` escribe `config reloaded` con las posiciones abiertas y cerradas. Los contadores siguen. **START** con el demonio en marcha sigue respondiendo `already running`, lo cual es inofensivo: el cambio que guardó se aplica igualmente.

Dos cosas siguen necesitando **STOP** → **START**: el indicativo y el localizador (el registro lo indica cuando cambian), y una entrada `server` o `cores` escrita a mano en `autorun.json`.

Qué hace un reinicio con los contadores:

- **Los totales junto a cada casilla se conservan**: están en `autorun-totals.json`, que no se borra al apagar.
- **Las tarjetas por decodificador vuelven a cero**, son por ejecución.
- **No se pierde nada de la cola**: el apagado envía los spots pendientes.
- Una banda **recién activada** empieza en `0`; una banda ya **usada antes** retoma su total anterior.
- Una banda que **desmarque conserva su número** junto a la casilla ahora vacía; el historial no se borra.

**SELECT ALL**, junto a MAX SLOTS, marca todas las bandas y modos; cuando todos están marcados pasa a decir **DESELECT ALL** y los desmarca.

### Horario (horas por banda y modo)

Bajo BANDS & MODES, la tarjeta **SCHEDULE** tiene una fila por cada banda y modo marcados, con 24 casillas para las horas 00–23 **UTC**. Una marca en una casilla significa que esa posición decodifica y envía spots en esa hora. En las demás horas duerme, con su conexión al receptor cerrada: no gasta CPU ni ocupa ningún puesto de oyente del receptor. Una posición con todas las horas marcadas funciona todo el día, como antes de que hubiera horarios — así empieza toda configuración existente.

- Un clic marca o desmarca una casilla; arrastrando se marcan varias.
- **24h** y **Clear** — todas las horas o ninguna.
- **Day** y **Night** — de 06 a 18 y de 18 a 06 en hora *solar* local del localizador de REPORTER IDENTITY (para KM17VX, Day es 04–15 UTC). Hora solar y no hora de reloj, para que valga en cualquier estación y no se mueva con el horario de verano.
- **→ 20m** (la banda de la fila) — da las mismas horas a los demás modos marcados de esa banda, sustituyendo las suyas.
- **show local time** — rotula las columnas con la hora de su navegador; el horario se sigue guardando en UTC.
- La fila **AT ONCE** cuenta las posiciones que funcionan en cada hora. Un número rojo supera **MAX SLOTS**, y **SAVE CONFIG** se niega a guardar hasta corregirlo. MAX SLOTS limita las posiciones que funcionan *a la vez*, no a lo largo del día, así que con un horario más bandas comparten la misma CPU — por ejemplo 10, 12 y 15 m de día y 160 y 80 m de noche.
- El punto delante de cada fila es verde mientras la posición decodifica, ámbar mientras se abre para su próxima hora o se cierra, y gris mientras duerme o el demonio está parado. La tarjeta de estado muestra las posiciones programadas ahora y la hora del próximo cambio.

Una posición se abre un poco antes de su primera hora — una ventana de decodificación más 10 segundos, es decir unos 25 s para FT8 y JS8 y algo más de 2 minutos para WSPR — para que se decodifique el primer ciclo de la hora; el ciclo oído durante esa antesala pertenece a la hora anterior y no se reporta. Se cierra unos segundos después de su última hora, una vez empezada la decodificación del último ciclo de esa hora. Una conexión que se cae, por ejemplo porque se reinició el receptor, se vuelve a abrir a los 30 segundos.

### Arranque automático tras un reinicio o un fallo

**Start automatically after a reboot or crash**, bajo los botones, está desactivado por defecto y surte efecto con **SAVE CONFIG**. Activado, el panel de administración — que systemd arranca al iniciar el equipo — pone en marcha el demonio aproximadamente un minuto después de arrancar el panel, comprueba luego cada minuto que sigue funcionando y lo arranca de nuevo si se ha detenido. Que el receptor aún no esté en marcha no importa: el demonio reintenta sus conexiones cada 30 segundos.

**STOP siempre manda.** Tras **STOP** el demonio sigue parado, también tras reiniciar el equipo, hasta que pulse **START**; el panel lo guarda en el archivo `autorun-stopped`. **FREE ALL SLOTS** también detiene el demonio y lo mantiene parado del mismo modo. La tarjeta de estado muestra `Autostart: off`, `ON` u `ON, held by STOP`.

Un demonio que se detiene 5 veces en 15 minutos se deja en paz 30 minutos en lugar de arrancarlo cada minuto. Cada arranque automático, y esa pausa, se escriben en el registro AUTORUN como `[admin …] autostart: …`.

### Contadores de spots

Se muestran dos recuentos distintos, que responden a preguntas distintas.

**SPOTS UPLOADED PER DECODER** — una tarjeta por decodificador (FT8 / FT4 / JS8 / WSPR) con los spots subidos **desde el último arranque del demonio** y, debajo, el número de decodificaciones y cuántos siguen en cola. Stop/Start los pone a cero. Un decodificador cuyo destino está desactivado muestra sus decodificaciones y `reporting off` en lugar de un `0` a secas, porque ahí cero subidas es un ajuste, no un fallo.

**El número junto a cada casilla** en BANDS & MODES son los spots subidos **de todo el tiempo** para esa banda y modo. Se guardan en `autorun-totals.json` y sobreviven a los reinicios. **En ámbar y con un punto delante** (`·123`) significa que esa ranura ha decodificado pero aún no ha subido nada. Es normal entre envíos —PSK Reporter sube cada 5 minutos y wsprnet cada 2—, así que los contadores de FT8/FT4 quedan en ámbar los primeros minutos tras un arranque. También sigue en ámbar si el destino de ese decodificador está apagado. Un `0` a secas, sin punto, significa que esa ranura está activada pero aún no ha decodificado nada: WSPR se queda en cero varios minutos tras un arranque, porque funciona en un ciclo de 2 minutos mientras FT8 ya cuenta por centenares. Una ranura que el demonio nunca ha ejecutado no muestra nada. Al pasar el ratón se ven las subidas, las decodificaciones y la hora de la última subida.

**Poner a cero los contadores.** **FREE ALL SLOTS** desmarca todas las bandas y modos, apaga ambos destinos, detiene el demonio y **borra los contadores históricos**: después no se muestra ningún número junto a ninguna casilla. Es la única forma de reiniciarlos y no se puede deshacer. El botón detiene el demonio y espera a que termine antes de borrar `autorun-totals.json`, porque el demonio reescribe ese archivo al apagarse; borrarlo con el demonio en marcha simplemente devolvería los números.

### Requisitos de recursos y limitaciones

El demonio es deliberadamente ligero y funciona en hardware modesto (un i5 de cuatro núcleos basta), pero conviene conocer sus límites reales.

**Limitaciones conocidas:**

1. **El verdadero cuello de botella es spectrumserver y el ancho de banda del SDR, no el demonio.** Un RX888 a 30 MHz necesita OpenCL/GPU; una CPU con pocos núcleos y sin una GPU capaz no puede sostener esa FFT. Combine el hardware modesto con un SDR más estrecho (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR es lo que más CPU consume.** Su decodificador de Fano es un port a JS (~30 s por banda, de un solo hilo). El grupo de 4 workers ejecuta 4 decodificaciones en paralelo; activar **más de ~4 bandas de WSPR** a la vez puede hacer que la cola supere la ranura de 120 s, sobre todo mientras el SDR compite por los núcleos. Las decodificaciones de FT8/FT4 son baratas en comparación.
3. **Escalado del número de ranuras.** La cifra de ~2-2,5 núcleos / 600-700 MB corresponde a las ~28 ranuras completas en una máquina de 8 núcleos. Con 4 núcleos compartidos, limítese a unas pocas bandas (orientación: ≤ 6 FT8/FT4 + ≤ 3 WSPR) y vigile la estadística `queued` del grupo.
4. **La fijación presupone una topología híbrida de Intel** (núcleos bajos = P-cores más rápidos). En AMD o en CPU con numeración SMT intercalada, el reparto automático sigue siendo válido (sin solapamientos ni fallos), pero «los núcleos bajos son más rápidos» puede no cumplirse literalmente; en un chip 4C/8T con hyperthreading, los núcleos superiores son hermanos SMT: quedan acotados, no del todo aislados. Cuando el rango automático no sea el idóneo, use la **sustitución manual** que se describe abajo.
5. **La cobertura de bandas la limita el receptor.** La configuración del RX888 (`sps=60000000` → Nyquist de 30 MHz) no llega a 6 m ni por encima; la tabla de bandas va de 160 m a 10 m. Otros SDR cubren lo que permita su ventana sintonizada.
6. **Cadencia de reporte.** PSK Reporter envía cada 5 min y wsprnet cada 2 min: ver «0 sent» los primeros minutos es normal, no un fallo.

### Archivos y puntos finales

| Elemento | Finalidad |
|---|---|
| `autorun.json` | Configuración guardada (identidad, posiciones con sus horas UTC `hours`, destinos, máx. posiciones, `autostart`, anclaje opcional `cores`). La escribe la pestaña; ignorada por git. Una posición sin `hours` funciona todo el día. |
| `autorun-stopped` | Existe tras **STOP**: el arranque automático deja el demonio parado, también tras reiniciar, hasta que **START** lo borra. Ignorado por git. |
| `autorun/scheduler.js` | Qué posiciones están abiertas en un momento dado: las horas, la antesala antes de la primera hora y el margen tras la última. Se prueba con `node autorun/scheduler.test.mjs`. |
| `autorun-status.json` | Estado en directo que lee la tarjeta de estado (pid, contadores, última subida). Se escribe cada 15 s; se elimina al parar. |
| `frontend/dist/autorun-active.json` | Datos públicos del distintivo, servidos en `/autorun-active.json`. Vacío cuando el reporte está desactivado. |
| `autorun.log` | Salida estándar y de error del demonio. |
| `GET/POST /admin/api/autorun/config` | Leer / escribir `autorun.json` (valida indicativo, localizador, combinaciones banda/modo y límite de ranuras). |
| `GET /admin/api/autorun/status` | Estado de ejecución (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Lanza (`taskset -c <auto> node autorun/index.js`) / envía `SIGTERM`. El rango de núcleos se deriva de la CPU (véase más arriba). |

> **Nota:** tras actualizar `admin_server.py` debe [Reiniciar el panel](#reiniciar-el-panel) para cargar las nuevas rutas de autorun o una matriz banda/modo actualizada. El demonio se ejecuta como un proceso aparte, así que sobrevive a los reinicios del panel de administración.

---

## Estado del sistema (System Health)

Una tarjeta del **Dashboard**, actualizada cada 30 segundos (o con **↻ refresh**):

- **Receptores** — cada receptor de la estación (el de `public_port` y cada receptor de `receivers.toml`): un punto verde y *on air, up 15h 5m* cuando responde, un **OFF THE AIR** rojo cuando no.
- **Disco y carpetas de registros** — el espacio libre en el disco de la instalación (naranja desde el 80 % usado, rojo desde el 90 %), y el tamaño de `logs/`, `logproxy/` y de cada `instances/<id>/logs/`.
- **Alertas recientes** — lo que la vigilancia de alertas ha visto desde que arrancó el panel (ver [Alertas](#alertas-correo--telegram)), se haya enviado un mensaje o no.
- **Última entrada de crash.log** — el `crash.log` no vacío más reciente de todos los receptores, con su fecha y sus 12 últimas líneas.

---

## Estadísticas de visitantes

La página **Visitors** de la barra lateral (en el teléfono: **☰ MENU → Visitors**, o el botón **📈 VISITOR STATISTICS** de la página Users) cuenta los oyentes de la estación a partir de los registros privados `logs/users_YYYY-MM-DD.jsonl` de cada receptor — las copias con las direcciones IP, que las páginas públicas ya no muestran. Elija **Today**, **7**, **14** o **31 days**.

- **Visitantes** (direcciones distintas), **sesiones**, **horas de escucha** y **el máximo de oyentes a la vez**.
- **Por día** — las mismas cuatro cifras para cada día.
- **Horas de más actividad** — cuándo empezaron las sesiones, por hora UTC.
- **Países** — visitantes por país.
- **Decodificadores** — cuántas sesiones usaron cada decodificador (contado en las líneas del registro que lo incluyen, es decir, desde que se actualizó el servidor).
- **Direcciones** — las 20 direcciones con más sesiones *a la vez* primero, luego con más sesiones; una avalancha de conexiones como la del 16 de septiembre de 2026 se ve arriba del todo (**AT ONCE** se pone rojo por encima de 3). Cada fila tiene **BAN ▾** (8, 16 o 24 horas).

Los días y las horas están en UTC. Los decodificadores de la propia estación (conexiones locales) no cuentan; una sesión que sigue abierta cuenta como mucho 12 horas. Los nombres no están en estos registros, así que la página muestra direcciones, no nombres. Las cifras se recalculan como mucho una vez por minuto.

---

## Alertas (correo / Telegram)

**Settings → Alerts — Email / Telegram.** Una vigilancia dentro del panel de administración mira cada 30 segundos:

| Evento | Cuándo |
|---|---|
| **off the air** | un receptor no responde durante cerca de un minuto (dos comprobaciones seguidas) |
| **back on air** | vuelve a responder |
| **restarted** | responde como un proceso nuevo — reiniciado por el watchdog, un script de arranque o el thermal guard |
| **thermal guard** | el guard cambia de etapa (normal / warn / throttle / stopped) |
| **crash.log** | un `crash.log` de cualquier receptor recibe una entrada nueva; el mensaje lleva sus últimas líneas |

Cada evento tiene su propia casilla. La misma alerta se envía como mucho una vez cada 5 minutos. La primera comprobación tras arrancar el panel solo aprende el estado actual, así que reiniciar el panel no envía nada.

**Telegram** (lo más sencillo):

1. En Telegram abra **@BotFather**, envíe `/newbot` y siga los pasos; le da un **token del bot** (`123456789:AA…`).
2. Abra su bot nuevo y pulse **Start** — un bot no puede escribirle antes de eso.
3. Abra **@userinfobot**; el **Id** que responde es su **chat ID**.
4. Marque **TELEGRAM**, pegue los dos, pulse **✉ SEND TEST**.

**Correo:** marque **EMAIL** y rellene el servidor SMTP de su proveedor, el puerto y la seguridad (SSL en 465, STARTTLS en 587), el usuario, la contraseña y **TO**. **FROM** puede ser una dirección completa, `Nombre <dirección>`, o solo un nombre — un nombre solo aparece como nombre del remitente sobre la dirección **USER**, así que entonces el usuario debe ser una dirección completa.

**✉ SEND TEST** guarda primero el formulario y luego envía; la línea bajo los botones muestra la respuesta de cada canal, o lo que aún falta. Los ajustes se guardan en `admin_config.json` bajo `"alerts"` — el archivo privado del panel, nunca parte de una copia ni de una actualización. Una contraseña o un token guardados se muestran como `********` y se quedan como están mientras no escriba uno nuevo.

---

## Receptores

**Receivers** en el menú de la izquierda (en el teléfono: **📡 RX** en la barra inferior) lista cada receptor de la estación — de `receivers.toml`, o solo el principal en una estación de un receptor — con su nombre, su nombre `?rx=`, el hardware y su ganancia, el rango que cubre y su centro, el ancho de banda, la frecuencia y el modo con que empieza un oyente nuevo, y si está en el aire. Cada receptor tiene sus propios botones:

| Botón | Qué hace |
|---|---|
| **✎ CHANGE SETTINGS** | el formulario descrito abajo |
| **■ STOP** / **▶ START** | detiene solo este receptor (pregunta antes; los demás siguen), o lo vuelve a arrancar. Arrancar lleva unos 20 segundos; el botón dice *STARTING …* hasta que el receptor está en el aire |
| **🏷 RENAME BUTTON** | solo en un receptor sin formulario de cambio: el nombre de su botón del selector, guardado en `receivers.toml`; nada se reinicia |
| **🗑 DELETE** | solo en un receptor adicional que no es el predeterminado — ver abajo |

**✎ CHANGE SETTINGS en un receptor adicional que sintoniza** (uno en `instances/<nombre>/`): indique la frecuencia central en MHz, elija el ancho de banda entre las tasas de muestreo que ese hardware admite, y fije dónde empieza un oyente nuevo, en qué modo, su ganancia y el nombre de su botón; el formulario muestra el rango nuevo antes de aplicarlo. Se rechaza una frecuencia que el hardware no sintoniza, una tasa que no admite, o una frecuencia inicial fuera del rango nuevo. **✔ APPLY AND RESTART THIS RECEIVER** entonces:

- fija `-f`, `-s` y la ganancia en `instance.env`, y `frequency`, `sps`, `fft_size` y la frecuencia y el modo iniciales en `config.toml` — una corrección del cristal (un `frequency` a unos Hz de `-f`) se conserva como el mismo error en ppm, así sigue siendo correcta en la banda nueva, y `fft_size` se escala para que la cascada conserve su resolución
- fija `siteSDRBaseFrequency` y `siteSDRBandwidth` en `www/site_information.json` — la página del receptor lo lee al abrirse, así que no se recompila nada
- fija el nombre del botón en `receivers.toml`; el nombre del receptor en los directorios y el nombre del hardware quedan como están
- guarda los archivos viejos en `admin-backups/retune-<nombre>-<fecha>/` y reinicia **solo ese receptor** — sus oyentes se cortan unos segundos, los demás no notan nada

**✎ CHANGE SETTINGS en el receptor principal y en uno de muestreo directo** (RX888, Fobos HF — cubre de 0 Hz a la mitad de su tasa de muestreo y no tiene nada que sintonizar): el formulario tiene el nombre de su botón, la frecuencia inicial, el modo y la ganancia. La frecuencia y el modo iniciales van a su `.toml`, el nombre a `receivers.toml`, y los archivos viejos a `admin-backups/settings-<nombre>-<fecha>/`. **✔ APPLY** reinicia ese receptor solo cuando cambió la frecuencia inicial, el modo o la ganancia; con el receptor principal se reinician también RADE y DRM. La banda misma del receptor principal se cambia con `bash configure-station.sh`: su página lleva la banda desde la compilación, así que necesita recompilar la página, y el asistente reinicia los servicios con sudo. En una estación de un receptor sin `receivers.toml` no hay botón en el selector, así que no hay nombre que fijar.

**AT VOLUME (0 – 100 %)**, en ambos formularios, es la posición del deslizador de volumen con la que empieza un oyente en su primera visita; se guarda en el `.toml` del receptor como `volume` bajo `[input.defaults]`. Si se deja vacío, la línea se elimina y la página empieza en el 50 %. Un oyente que ya movió el deslizador conserva su propio ajuste en las visitas siguientes. Un volumen cambiado reinicia ese receptor, igual que una frecuencia inicial cambiada.

**IQ FOR LISTENERS**, **WIDE IQ** y **WIDE IQ LISTENERS AT ONCE**, en ambos formularios, son los ajustes IQ del receptor: `iq`, `iq_wide` e `iq_wide_listeners` bajo `[server]` en su `.toml` (vea la sección sobre IQ más ancho en la Guía del usuario). *off* oculta el botón IQ a los oyentes. El IQ ancho ofrece 24 o 48 kHz, además de los 12 kHz que recibe todo el mundo, a tantos oyentes a la vez como indique el último campo (`0` = sin límite). Solo se escribe un ajuste que usted cambie, y una línea de ejemplo como `# iq_wide=48` se convierte en la línea real. El servidor lee estos ajustes solo al arrancar, así que un ajuste IQ cambiado reinicia ese receptor.

En cualquier receptor, cambiar solo el nombre no reinicia nada.

**Ganancia.** Para un RX888 el formulario tiene la ganancia VGA (0–127), el modo de ganancia (low/high), la atenuación (0–63) y **PGA on**; para un RTL-SDR la ganancia de RF entre los pasos que admite el sintonizador, o *auto* (el AGC del propio stick). Se escriben en la línea de argumentos del receptor — `RX888_ARGS` o `RX_ARGS` — en `instances/<nombre>/instance.env` para un receptor adicional, y en `main.env` para el principal. `main.env` es el `instance.env` del receptor principal: cada script de arranque lo lee el último, no está en git y `update.sh` nunca lo reemplaza. La ganancia no puede ir en `station.conf`, porque `configure-station.sh` reescribe ese archivo. Sin `main.env` el script de arranque conserva su ganancia incorporada (`-g 50 -a 0 -m low --pga` para el RX888). Otros tipos de receptor tienen su ganancia en la misma línea de argumentos; cámbiela allí a mano.

**🗑 DELETE** elimina un receptor adicional para siempre. Escriba su nombre corto para confirmar; entonces detiene ese receptor (primero el watchdog) y no sigue mientras quede alguno de sus procesos en marcha, quita su bloque `[[receiver]]` de `receivers.toml` (el archivo viejo va a `admin-backups/deleted-<nombre>-<fecha>/`), y mueve allí también su carpeta `instances/<nombre>/` — o borra la carpeta si desmarca *keep a copy*. Su botón desaparece de las páginas; el controlador y su archivo de registro `logwebsdr-<nombre>.txt` se quedan.

El proxy vuelve a leer `receivers.toml` cada vez que cambia, así que un cambio de nombre, un borrado o un receptor añadido llegan a los oyentes sin reiniciar el proxy. Las páginas abiertas vuelven a leer la lista de receptores cada 15 segundos, así que el botón de un receptor detenido se va y vuelve solo.

**➕ ADD NEW RECEIVER** abre un formulario con las preguntas de `add-receiver.sh`: el tipo de receptor (con *RTL-SDR Blog V4* para un stick RTL), frecuencia central, ancho de banda, un nombre corto (sugerido según la banda y comprobado que esté libre), el nombre de su botón, su antena y la dirección pública de la estación, y si instalar el controlador, mostrar el selector de receptor también en la página principal, poner `start-all.sh` como script de inicio de este panel, arrancar el receptor y reiniciar el proxy. Encima, la página lista los receptores USB que ve este ordenador, para que sepa que el stick está conectado. **▶ PREPARE** comprueba las respuestas, las guarda en `instances/.add-rx.env` y da dos líneas para un terminal, cada una con **📋 COPY**:

```bash
cd ~/PhantomSDR-Plus
./add-receiver.sh --answers instances/.add-rx.env
```

El script toma cada respuesta de ese archivo y solo pide su contraseña de sudo (la necesitan el controlador y el reinicio del proxy — el panel de administración nunca ejecuta nada como root), y luego borra el archivo. Recargue la página después y el receptor nuevo aparece en la lista. `--answers ARCHIVO` también funciona solo: un `ADD_RX_…=valor` por línea; los nombres están al principio de `add-receiver.sh`.

---

## Ajustes — puertos, inicio/parada y HTTPS

**PORTS**, bajo **🔑 UPDATE PASSWORD**, muestra cada puerto que usa esta estación — el puerto público, https (443/80) si está configurado, el spectrumserver de cada receptor, el panel de administración, las estadísticas, RADE, DRM y el relay — leídos de `admin_config.json`, `station.conf` y `receivers.toml`, los mismos archivos que lee `proxy.py`. Un ● verde indica que algo escucha ahora en el puerto; ○, que nada escucha. Solo hay que redirigir en el router los puertos marcados *open on the router*; los demás se quedan en este ordenador y se alcanzan a través del puerto público. Los servicios no instalados no aparecen.

**SPECTRUMSERVER PORT (MAIN RECEIVER)** es `public_port`: el puerto en el que escucha el spectrumserver del receptor principal — 9001 detrás de `proxy.py` en una estación configurada con `install.sh`. **No** es el puerto de los oyentes; ese aparece de solo lectura bajo la casilla como **Listener port (proxy)** (`proxy_port`), o como *none* en una estación sin proxy, donde ambos coinciden. **💾 SAVE SETTINGS** comprueba el número: se rechaza el puerto propio del proxy, y un puerto distinto del `[server] port` del receptor en marcha pide antes una confirmación — con un número erróneo, `proxy.py` envía a los oyentes, desde su próximo reinicio, a un puerto donde nada responde. Para mover de verdad spectrumserver, ponga el mismo número en `[server] port` del `.toml` del receptor, en su línea de `receivers.toml` y en esta casilla, y reinicie luego el receptor y el proxy.

**▶ START** y **■ STOP**, junto a **DEFAULT START SCRIPT** y **DEFAULT STOP SCRIPT**, ejecutan al momento el script **guardado**, tras una confirmación — ambos desconectan a todos los oyentes. Si cambió una selección, guarde antes: el botón rechaza una sin guardar. Los primeros segundos de la salida aparecen bajo los botones; la salida completa de estos scripts, y de los reinicios del thermal guard, va a `logs/admin-scripts.log`.

**HTTPS** muestra si la estación se sirve por https.

- En una estación con https, **🔍 CHECK** ejecuta `setup-https.sh --status`: ¿funciona Caddy y responde el certificado?
- En una estación solo http, **🔒 SET UP HTTPS** comprueba lo que puede — `station.conf`, que su nombre DNS se resuelve (una dirección IP no puede obtener certificado), si los puertos 443 y 80 están libres o ya son de Caddy —, le recuerda reenviar TCP 443 y 80 en el router, y da las dos líneas para un terminal, cada una con **📋 COPY**. Allí `setup-https.sh` pide su contraseña de sudo: el panel de administración nunca ejecuta nada como root. Recargue la página al terminar, y el botón pasa a ser **CHECK**. Vea [Acceso seguro — https://](HTTPS.md).

---

## Copia y restauración de los ajustes de la estación

**Settings → Backup & restore of the station settings.**

**⬇ DOWNLOAD BACKUP** entrega un zip, `phantomsdr-settings-<indicativo>-<fecha>.zip`, con los ajustes propios de esta estación:

- cada `*.toml` de la instalación (configuraciones de los receptores y `receivers.toml`) y `station.conf`
- `frontend/site_information.json`, `frontend/src/bands-config.js`, `markers.json`
- `autorun.json` (spot reporting), `websdr_relay.json`, `drm.json`, `admin_bans.json`
- para cada receptor adicional: `instances/<id>/config.toml`, `instance.env`, `markers.json`

y un `BACKUP-INFO.json` con la fecha, el ordenador y la lista de archivos. **No** incluye: `admin_config.json` (contraseña de administrador, secretos de las alertas), los registros ni el propio programa.

**⬆ RESTORE** toma un zip de copia y vuelve a escribir **solo** archivos de esa misma lista — todo lo demás del zip se omite y se nombra. Antes de reemplazar un archivo, el actual se copia en `admin-backups/restore-<fecha-hora>/` (ignorado por git, nunca en una actualización), así que una restauración equivocada se puede deshacer a mano. La respuesta dice qué hacer después: reiniciar los receptores tras un `.toml`, `instance.env` o `station.conf`; reconstruir la página (`./recompile.sh --frontend`) tras site information o los ajustes de bandas; reiniciar `phantomsdr-websdr-relay` tras los ajustes del relé.

---

## En un teléfono o tableta

Por debajo de 768 píxeles de ancho el menú de la izquierda se convierte en un cajón. La barra inferior tiene **DASH**, **RX** (Receivers), **USERS**, **GRAPHS**, **LOGS** y **☰ MENU**, que despliega el menú completo con todas las páginas; se cierra al elegir una página o tocar al lado, y **MENU** queda resaltado mientras está en una página que no está en la barra. En el teléfono las tablas pasan a una tarjeta por fila (la lista de receptores ya en la tableta, hasta 1100 píxeles), los formularios quedan en una columna, y la nota gris del título de una tarjeta pasa debajo del título. Top Processes, el editor de Markers y la cuadrícula banda/modo de Spot Reporting siguen siendo tablas y se desplazan de lado.

---

## Temas

El selector **THEME** está en la barra superior de cada página, entre **ONLINE** y el reloj, y otra vez en **Settings → Appearance**; los dos muestran siempre la misma elección. Un tema se aplica enseguida, sin recargar.

| Tema | Aspecto |
|---|---|
| **Phosphor green** | el terminal verde clásico (predeterminado) |
| **Amber display** | lo mismo en ámbar cálido, como la pantalla de un equipo antiguo |
| **Metal panel** | el acabado gris anodizado de la página del receptor, iluminado desde arriba a la derecha |
| **Modern dark** | antracita con acento azul, sin resplandor |
| **Light** | blanco y gris, texto negro — para la luz del día |
| **Auto (day/night)** | **Light** desde la salida hasta la puesta del sol, **Modern dark** de noche |

Todos los temas usan las mismas fuentes y los mismos tamaños; solo cambian los colores y el acabado. *On air* sigue en verde y los avisos en naranja y rojo en cada tema, y los **Graphs** también siguen el tema. **Auto** calcula la salida y la puesta del sol en el locator de la estación (`siteGridSquare` en Site Info) y cambia solo mientras la página está abierta; sin locator toma 07:00–19:00 hora local como día. La elección se guarda por navegador, así que un PC y un teléfono pueden tener temas distintos. La página de acceso mantiene el aspecto verde.

---

## Resolución de problemas

| Problema | Solución |
|---|---|
| El panel de administración no arranca | Consulte `admin.log`: suele faltar un paquete de Python |
| El proxy no arranca | Ejecute `python3 -c "import aiohttp"`; si falla: `pip3 install aiohttp --break-system-packages` |
| Fedora / openSUSE: el panel o el proxy no arranca al iniciar el equipo (`status=209/STDOUT`, `avc: denied { open } … admin.log` o `proxy.log` en `sudo ausearch -m avc -ts boot`) | SELinux impide a systemd abrir archivos de registro en su carpeta personal. Ejecute `./setup_admin.sh --selinux` (etiqueta ambos registros como `var_log_t`) y luego `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Las instalaciones nuevas lo hacen automáticamente |
| Fedora / openSUSE: todo funciona, pero nadie fuera de esta máquina puede conectarse | firewalld descarta el puerto público. Ejecute `./setup_admin.sh --firewall` (abre el puerto del proxy de forma permanente). Las instalaciones nuevas lo hacen automáticamente; `setup_websdr_relay.sh` lo ofrece para el puerto del relay y `setup-https.sh` abre 443/80 |
| `systemctl is-active` se queda en `activating` y el registro dice `address already in use` | Una copia arrancada a mano con `manage_admin.sh start` sigue ocupando el puerto. `./manage_admin.sh stop` y luego `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`. Con los servicios instalados, `manage_admin.sh start` ahora los arranca mediante systemctl en lugar de lanzar una segunda copia |
| `proxy.log` está vacío | Compruebe primero que el proxy realmente se está ejecutando (`./manage_admin.sh status`). Si es así, tiene una versión antigua: el lanzador debe usar `python3 -u` (sin búfer; de lo contrario el cartel de arranque nunca sale del búfer de 8 KB) y el `main()` de `proxy.py` debe llamar a `logging.basicConfig()` (si no, el registrador de accesos de aiohttp no tiene manejador y se descarta cada línea de petición, porque `web.AppRunner` —a diferencia de `web.run_app`— no configura el registro). |
| El proxy arranca pero la cascada aparece en blanco | Compruebe `sdr_host` en `admin_config.json`: normalmente `127.0.0.1`. Si todavía contiene una IP local antigua de una versión anterior, cámbiela y [Reiniciar el panel](#reiniciar-el-panel) |
| El botón Kick dice «no connections» | Ejecute `getcap $(which ss)`; si no aparece `cap_net_admin`, ejecute `sudo setcap cap_net_admin+ep $(which ss)` |
| El estado siempre muestra OFFLINE | Vaya a Settings → SDR Process Name y ponga el nombre exacto que muestra `ps -eo comm,args \| grep -v grep` |
| La página Users no muestra datos | Verifique que el punto final funciona: `curl http://127.0.0.1:<public_port>/~~users` |
| Un navegador externo da NetworkError | Compruebe que el proxy está en marcha: `./manage_admin.sh status` |
| El proxy dejó de funcionar tras un cambio de red | Solo aplica si `sdr_host` todavía contiene una IP local: póngalo en `127.0.0.1` y [Reiniciar el panel](#reiniciar-el-panel) |
| El botón de borrar del chat no hace nada | Compruebe el permiso de escritura del archivo de registro del chat: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| El mensaje de la cascada no aparece | Confirme que el proxy está en marcha (`./manage_admin.sh status`) y que el frontend es de una compilación reciente que incluye el renderizador de la superposición |
| El mensaje de la cascada se pierde tras reiniciar | Es lo previsto: el estado del mensaje solo está en memoria; vuelva a enviarlo tras reiniciar el panel |
| El «Start» de Spot Reporting falla / el demonio se cierra al instante | Consulte `autorun.log`. Suele faltar el enlace simbólico `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) o `taskset` no está instalado (`sudo apt install -y util-linux`). |
| Spot Reporting: el demonio funciona pero `decodes` sigue en 0 y `autorun.log` muestra `504` / `tap closed 1006` | La toma de audio no llega a spectrumserver. El demonio detecta el puerto automáticamente a partir de la configuración del servidor **en ejecución**; la línea de registro `[autorun] tap backend: HOST:PORT` debe coincidir con su `[server] port`. Si es incorrecta (o el servidor no estaba en marcha al arrancar), fíjelo en `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9001 }`, y después Stop→Start. |
| **SAVE CONFIG** rechazado: «N slots at once exceeds cap of M (UTC hour …)» | MAX SLOTS limita las posiciones que funcionan a la vez. Súbalo o quite horas en el SCHEDULE donde la fila AT ONCE está en rojo. |
| Spot Reporting no arrancó tras un reinicio | **Start automatically after a reboot or crash** debe estar marcado y guardado, y un **STOP** se mantiene hasta **START** (la tarjeta de estado indica `ON, held by STOP`). El registro AUTORUN muestra cada línea `[admin …] autostart:`; el propio panel debe estar en marcha (`sudo systemctl status phantomsdr-admin`). |
| Spot Reporting muestra «0 sent» | Normal durante los primeros minutos: PSK Reporter envía cada 5 min y wsprnet cada 2 min. Confirme que hay un destino activado y que el demonio está en marcha. |
| Las bandas o modos nuevos no aparecen en la matriz | [Reiniciar el panel](#reiniciar-el-panel) — la matriz se carga al arrancar el panel. |
| `autorun.log` muestra `MODULE_TYPELESS_PACKAGE_JSON` / «Reparsing as ES module … performance overhead» | Aviso cosmético (la decodificación sigue funcionando). A `frontend/src/modules/package.json` le falta `"type": "module"`; añada esa línea cerca del principio y haga Stop→Start. No hace falta recompilar el frontend: el demonio importa el archivo fuente directamente. |
| El «Start» de Spot Reporting falla con `taskset: … Invalid argument` en un PC antiguo o modesto | No debería ocurrir con el lanzador que tiene en cuenta la configuración: el rango de núcleos se deriva del número de CPU y no se fija con ≤ 4 núcleos. Si sucede, su `admin_server.py` es anterior a ese cambio; actualícelo (`_autorun_taskset_prefix`) y [Reiniciar el panel](#reiniciar-el-panel). |
| El distintivo REPORTING no aparece en la cascada | El reporte debe estar activado con al menos una ranura; el distintivo lee `/autorun-active.json`. Recompile el frontend si `dist/index.html` es anterior al distintivo. |
| **✉ SEND TEST** dice "Nothing to send to: …" | El mensaje dice lo que falta: marque **TELEGRAM** o **EMAIL**; Telegram necesita el token del bot y el chat ID; el correo necesita el servidor SMTP y **TO**. |
| Prueba de correo: `5.5.2 … Sender address rejected: need fully-qualified address` | El remitente no es una dirección completa. Ponga su dirección en **FROM**, o deje allí solo un nombre y haga de **USER** su dirección completa; [reinicie el panel](#reiniciar-el-panel) si es anterior a esta regla. |
| La prueba de Telegram falla con `Forbidden` / no llega ningún mensaje | Abra primero su bot en Telegram y pulse **Start**; compruebe el chat ID con @userinfobot (su propio Id, no el del bot). |
| Ninguna alerta cuando un receptor se paró | Tarda cerca de un minuto (dos comprobaciones); la misma alerta llega como mucho una vez cada 5 minutos; reiniciar el panel no envía nada; revise la casilla del evento. |
| La página Visitors muestra "no visitors" | La página lee `logs/users_*.jsonl` (y `instances/<id>/logs/`); los escribe el registro de estadísticas de los receptores — compruebe que existen para los días elegidos. |
| Falta el selector THEME, o un tema nuevo no se aplica | [Reinicie el panel](#reiniciar-el-panel) y recargue la página con **Ctrl+F5** para que el navegador deje la copia antigua. |
