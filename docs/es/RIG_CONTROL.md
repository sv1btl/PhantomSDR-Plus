# PhantomSDR-Plus — Control del transceptor (CAT)

Mantenga **su propio transceptor** y un **receptor PhantomSDR-Plus** en la misma frecuencia, modo y filtro. Gire el dial del equipo y la cascada lo sigue; haga clic en una señal de la cascada y el equipo se sintoniza en ella. Al transmitir, el receptor puede quedar en silencio para no devolverle su propia señal.

Funciona con receptores **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR**, suyos o ajenos, y solo mueve *su* sesión de escucha: nadie más en el receptor oye ni ve nada. El operador del receptor no tiene que instalar ni configurar nada.

---

## Qué necesita

Dos formas de conectar un equipo y un requisito en el receptor:

| Pieza | Qué es | Sincroniza |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 o posterior** | La aplicación de escritorio, con un menú **Rig**. Linux (PC y Raspberry Pi) y Windows. | Frecuencia, modo, ancho de filtro, silencio al transmitir — en un sentido o en ambos |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Un programa aparte para Windows que acopla un equipo a la página del receptor en su navegador. | Frecuencia y modo |
| **El receptor** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR o UberSDR. Un receptor PhantomSDR-Plus necesita la 4.0 con la **actualización de septiembre de 2026** o posterior para ancho de filtro y silencio. | Un PhantomSDR-Plus más antiguo sigue sincronizando frecuencia y modo |

El resto de este manual describe Desktop PhantomSDR+. La CATsync Tool tiene su propia documentación en su sitio web.

---

## Receptores compatibles

La aplicación reconoce el tipo de receptor de una ventana de estación y lo maneja mediante los propios controles de esa página. La ventana Rig control muestra el tipo encontrado junto al nombre de la estación.

| Receptor | Frecuencia y modo | Ancho de filtro | Silencio al transmitir |
|---|---|---|---|
| PhantomSDR-Plus | Sí | Con la actualización de septiembre de 2026 o posterior | Con la actualización de septiembre de 2026 o posterior |
| KiwiSDR (incluido Web-888) | Sí | Sí | Sí |
| PA3FWM WebSDR | Sí, con cambio de banda en sitios multibanda | Sí | Sí |
| UberSDR | Sí | Sí | Sí |

Un receptor web tiene menos modos que la mayoría de equipos, así que algunos modos del equipo comparten un modo del receptor: KiwiSDR y WebSDR tienen un único CW para CW y CW-R. Los modos de receptor que nombra este manual son los de PhantomSDR-Plus; los demás receptores usan el equivalente más cercano. Un WebSDR mantiene un filtro CW por debajo de 1 kHz y los demás filtros en 1 kHz o más, porque así distingue la propia página el CW, y una frecuencia fuera de todas las bandas de un sitio WebSDR se deja en paz. UberSDR ajusta su filtro en pasos del deslizador, así que un ancho puede quedar hasta unos 50 Hz del del equipo. Cualquier otro tipo de página — OpenWebRX, por ejemplo — muestra *not a receiver this app can drive* y no se sincroniza nada.

---

## Qué hace y qué no hace

- Sincroniza **un equipo con una ventana de receptor** a la vez.
- Lee ambos lados varias veces por segundo y, cuando no coinciden, ajusta uno para que coincida con el otro. **No** transmite, no activa el PTT ni envía audio a ninguna parte.
- Mover el receptor solo cambia su propia sesión. Los demás oyentes del mismo receptor no se ven afectados y el operador no tiene que permitirlo.
- Un puerto serie solo puede abrirlo **un programa a la vez**. Si WSJT-X, un programa de registro o una utilidad del fabricante ya tiene el puerto, use la opción **flrig** o **rigctld on network** para compartir el equipo en lugar de pelear por el puerto.

---

## Inicio rápido

1. Abra una estación en Desktop PhantomSDR+ como de costumbre.
2. **Rig → Rig control...**
3. En **Connection**, elija **Built-in** si su equipo está en la lista; si no, **Hamlib (all rigs)**.
4. Elija su equipo, el puerto serie y la velocidad a la que está configurado el menú CAT o CI-V del equipo.
5. En **Sync**, deje seleccionado **Both directions**.
6. Pulse **Connect**. Las dos lecturas de arriba — transceptor y receptor — deberían mostrar la misma frecuencia en un segundo.

Cada ajuste se guarda al cambiarlo. La próxima vez basta con **Rig → Connect**, o marque **Connect when the app starts**.

---

## Cómo llegar al equipo

| Opción | Úsela cuando | Necesita |
|---|---|---|
| **Built-in** | Su equipo está en la lista de abajo. | Nada más |
| **Hamlib (all rigs)** | Su equipo es cualquier otro — Hamlib conoce más de 300. La aplicación inicia el `rigctld` de Hamlib por usted, en un puerto local privado, y lo detiene al desconectar. | Windows: nada, Hamlib va incluido. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Ya hay un `rigctld` en marcha, en este ordenador u otro de su red. | Host y puerto (4532 por defecto) |
| **flrig** | flrig ya controla el equipo para fldigi, WSJT-X o un programa de registro. | flrig en marcha, con su puerto XML-RPC (12345 por defecto) |

### Equipos con controlador integrado

La velocidad y la dirección CI-V que aparecen son los valores de fábrica que rellena la aplicación. **Son solo un punto de partida: póngalos como indique el menú de su equipo.**

| Familia | Equipos | Velocidad por defecto | Notas |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 y cualquier otro equipo CI-V | 19200 | Dirección CI-V por modelo (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Dirección `70`; compruébela en el menú |
| **Yaesu CAT nuevo** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu CAT clásico** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 bits de parada; sintoniza en pasos de 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sincroniza el ancho de filtro |
| **Compatibles Kenwood** | FlexRadio SmartSDR CAT (puerto virtual), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, otros compatibles Kenwood | 9600–38400 | |

Un equipo que debería ser compatible pero no se entiende con un controlador integrado suele funcionar con **Hamlib**, que tolera muchas más variantes.

---

## Ajustes del puerto serie

| Ajuste | Qué poner |
|---|---|
| **Serial port** | El puerto del equipo. Los adaptadores USB y los equipos con puerto USB aparecen primero. **Other / network address...** acepta un puerto que no esté en la lista — `COM7`, `/dev/ttyUSB1` — o `tcp://host:port` para un puerto serie servido por la red con ser2net o similar. |
| **Speed (baud)** | Exactamente lo que diga el menú de velocidad CAT / CI-V del equipo. Una velocidad errónea parece un equipo que nunca responde. |
| **Stop bits** | 1 para casi todo; 2 para la familia FT-817/857/897. |
| **CI-V address** | Solo Icom, en hexadecimal (`94`, no `148`). Debe coincidir con el menú de dirección CI-V. |
| **DTR / RTS** | Déjelos **desactivados** salvo que su interfaz los necesite. Muchos cables CAT activan el transmisor, o reinician el equipo, con una de esas líneas. |
| **Hardware flow control** | Desactivado, salvo que el manual pida RTS/CTS. |

Con **Hamlib** los mismos ajustes pasan a `rigctld`. Allí los bits de parada tienen además *Rig default*, y **Extra rigctld options** acepta cualquier otra opción de `rigctld`, por ejemplo `--set-conf=post_write_delay=10`. **rigctld program** permite apuntar a un `rigctld` concreto si tiene más de uno instalado.

---

## Sincronización

### Sentido

| Opción | Qué ocurre |
|---|---|
| **Rig → receiver** | La ventana del receptor sigue al equipo. Un cambio hecho en la cascada vuelve a la frecuencia del equipo. |
| **Receiver → rig** | El equipo sigue a la ventana del receptor. Girar el dial del equipo se deshace. |
| **Both directions** | Gana el lado que haya tocado **en último lugar**. Al conectar, antes de tocar ninguno, gana el equipo. |

El sentido también se cambia desde el menú **Rig** con la conexión activa.

### Cómo se evita que los dos lados se peleen

Cada valor que escribe la aplicación aparece un momento después como un cambio en el otro lado. Si se tomara al pie de la letra, el equipo y el receptor se perseguirían sin fin. La aplicación lo evita de tres formas:

- La página del receptor aplica un cambio al instante, así que se vuelve a leer justo después de escribir y esa lectura pasa a ser el nuevo punto de partida.
- Un equipo aplica un cambio un poco después, así que se recuerda cada valor enviado. Cuando el equipo informa de ese valor, se reconoce como escritura de la aplicación y no como una mano en el dial.
- Un valor que el equipo rechaza — FM ancha en un equipo de HF, por ejemplo — se envía **dos veces** y después se deja en paz hasta que cambie el lado de origen, en lugar de repetirse varias veces por segundo.

Resintonizar la página del receptor puede hacer que elija el modo por defecto de la banda (LSB por debajo de 10 MHz, por ejemplo). Cuando manda el equipo, la aplicación repone enseguida el modo del equipo, así que un equipo en USB en 40 m mantiene el receptor en USB.

### Qué ventana de receptor

**Receiver window** elige qué estación sigue al equipo:

- **The station window last in front** (por defecto) — con dos estaciones abiertas, haga clic en una y el equipo la sigue.
- **Una estación concreta** — el equipo queda fijado a ella, esté delante o no. Si esa estación no está abierta, no se sincroniza nada hasta que lo esté.

### Frecuencia de actualización

**Update every** fija cada cuánto se leen ambos lados: 150 ms, 300 ms (por defecto), 500 ms o 1 s. Más rápido se nota más inmediato en el dial; más lento es más amable con un equipo antiguo a 4800 o 9600 baudios, donde cada lectura tarda tiempo real en la línea.

---

## Modos

| Modo del equipo | El receptor escucha en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (invertido) | CW-L |
| AM, AM síncrona, DSB | AM |
| FM, FM estrecha | FM |
| FM ancha | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Modos de datos (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Datos LSB, datos FM | LSB, FM |

| Modo del receptor | El equipo se pone en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — la mayoría de equipos de HF lo rechazan y se les deja en paz tras dos intentos |
| RADE (superior / inferior) | USB / LSB |

Un equipo en **modo de datos** se queda en él: el USB del receptor se considera coincidente con el USB-D del equipo, así que el receptor nunca saca al equipo del modo de datos.

---

## Ancho de filtro

Marque **Sync filter width** para que coincidan las bandas de paso. Diferencias de menos de 60 Hz se consideran iguales, porque no hay dos filtros con los mismos pasos.

| Conexión del equipo | Ancho de filtro |
|---|---|
| Hamlib | Sí, donde Hamlib lo admita para ese equipo |
| flrig | Sí |
| Icom CI-V integrado | Sí — pasos de 50 Hz hasta 500 Hz, luego de 100 Hz hasta 3,6 kHz; AM en pasos de 200 Hz hasta 10 kHz; no en FM |
| Elecraft integrado | Sí, en pasos de 10 Hz |
| Kenwood, Yaesu y familia FT-817 integrados | No — estos equipos eligen filtros de tablas propias de cada modelo. Use Hamlib si necesita el filtro |

Los receptores KiwiSDR, WebSDR y UberSDR tienen siempre el control. Un receptor PhantomSDR-Plus debe tener la **actualización de septiembre de 2026** o posterior; en uno más antiguo la frecuencia y el modo siguen sincronizándose, y la ventana Rig control explica por qué el filtro no.

---

## Silencio al transmitir

Marque **Mute receiver while transmitting**. Mientras el equipo transmite, la ventana del receptor queda en silencio, y al dejar de transmitir vuelve el sonido. El botón de silencio del receptor lo muestra y puede quitar el silencio a mano.

Si ya había silenciado el receptor usted mismo, sigue silenciado después.

Necesita una conexión que informe del estado de transmisión — todos los controladores integrados, flrig y Hamlib en la mayoría de equipos — y, en un receptor PhantomSDR-Plus, la actualización de septiembre de 2026.

---

## Desplazamiento de frecuencia

**Frequency offset** se suma a la frecuencia del equipo para obtener la del receptor:

> frecuencia del receptor = frecuencia del equipo + desplazamiento

| Instalación | Desplazamiento |
|---|---|
| Transverter de 2 m con equipo de 10 m (144,100 MHz aparece como 28,100 MHz) | `116000000` |
| Transverter de 70 cm con equipo de 2 m (432 → 144) | `288000000` |
| Sin transverter | `0` |

---

## El menú Rig

| Elemento | Qué hace |
|---|---|
| **Rig control...** | Abre la ventana Rig control |
| **Connect / Disconnect** *nombre del equipo* | Inicia o detiene la sincronización; con Hamlib también inicia o detiene `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Sentido de la sincronización |
| **Sync filter width** | Sí / no |
| **Mute receiver while transmitting** | Sí / no |
| Línea de estado | *Not connected*, *Connecting...*, *Connected: nombre*, o el último error |

La lectura de frecuencia en directo está en la ventana Rig control y no en el menú, que de lo contrario se cerraría solo con cada cambio.

---

## Linux

**Permiso del puerto serie.** Los puertos serie pertenecen al grupo `dialout`. Un usuario fuera de él obtiene *Could not open ttyUSB0*. Añádase una vez y luego cierre sesión y vuelva a entrar:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Instálelo desde su distribución:

```bash
sudo apt install libhamlib-utils
```

El paquete `.deb` de Desktop PhantomSDR+ lo recomienda, así que `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` lo trae consigo; `dpkg -i` no instala paquetes recomendados. Los controladores integrados y flrig no necesitan Hamlib.

## Windows

El propio `rigctld.exe` de Hamlib va incluido en el instalador de 64 bits y en el de 32 bits. Los puertos COM aparecen en la lista por su nombre (`COM3`). Si el equipo necesita un controlador USB, instale primero el del fabricante: hasta entonces el puerto no existe.

---

## Para operadores de receptores

Nada que configurar. El control del transceptor usa una pequeña interfaz JavaScript que ya lleva cada página de PhantomSDR-Plus; no requiere ajustes en el servidor, puertos abiertos ni permisos de administrador. Las funciones de filtro y silencio llegaron con la actualización de septiembre de 2026 de la 4.0.0 — tras aplicarla, recompile el frontend (`./recompile.sh`, opción 2); no hace falta detener el receptor. Los receptores KiwiSDR, WebSDR y UberSDR tampoco necesitan nada: la aplicación usa los controles que sus páginas ya tienen.

---

## Para desarrolladores: la interfaz de la página

Tanto Desktop PhantomSDR+ como la CATsync Tool usan estas funciones, que cada página de PhantomSDR-Plus pone en `window` al cargarse (las páginas de KiwiSDR, WebSDR y UberSDR se manejan con sus propios controles, distintos):

| Función | Devuelve / hace |
|---|---|
| `catsync_ready` | `true` en cuanto las funciones de abajo están instaladas |
| `catsync_getFrequency()` | Frecuencia sintonizada, Hz |
| `catsync_setFrequency(hz)` | Sintoniza `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Fija el modo; restablece la banda de paso al valor por defecto del modo |
| `catsync_getBandwidth()` | Ancho total de la banda de paso, Hz |
| `catsync_setBandwidth(hz)` | Fija el ancho — crece hacia arriba en USB, hacia abajo en LSB y por igual en los demás. Llámela **después** de `catsync_setMode` |
| `catsync_getMute()` | `true` cuando está en silencio |
| `catsync_setMute(on)` | Silencia o quita el silencio, mediante el botón de silencio de la página |

Las cuatro últimas llegaron con la actualización de septiembre de 2026, así que compruébelas antes de llamarlas:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Fijar la frecuencia resintoniza el audio, así que llame a un setter solo cuando el valor haya cambiado de verdad: llamar continuamente a un setter con el mismo valor se oye. Los antiguos puntos de entrada al estilo KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) siguen disponibles para las herramientas que los esperan.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | No está en el grupo `dialout`, u otro programa tiene el puerto | `sudo usermod -aG dialout $USER`, cerrar y abrir sesión; cierre WSJT-X, programas de registro, utilidades del equipo |
| La lectura del receptor dice *not a receiver this app can drive* | Otro tipo de receptor web, o la página aún está cargando | Son compatibles PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR; dele unos segundos a una página lenta |
| *The rig did not answer* | Velocidad errónea, tipo de equipo erróneo, dirección CI-V errónea, equipo apagado | Ajuste la velocidad al menú del equipo; revise la dirección CI-V; pruebe Hamlib |
| *Hamlib is not installed* | No se encontró `rigctld` | Linux: `sudo apt install libhamlib-utils`. O indique su ruta en **rigctld program** |
| *rigctld stopped: ...* | Hamlib no pudo abrir el equipo — sigue su propio mensaje | Suele ser el puerto o la velocidad; el texto tras los dos puntos es el motivo según Hamlib |
| *flrig is not running at ...* | flrig cerrado, o su puerto XML-RPC es otro | Inicie flrig; revise el puerto en su configuración |
| Conectado, pero el receptor no se mueve | No hay ventana de estación abierta, o **Receiver window** fijado a una estación cerrada | Abra la estación o elija *The station window last in front* |
| El equipo transmite al conectar | DTR o RTS activan el equipo a través de su interfaz | Desmarque **DTR on** y **RTS on** |
| El filtro no sigue | Receptor sin la actualización de septiembre de 2026, o controlador integrado Kenwood/Yaesu | Frecuencia y modo siguen sincronizando; use Hamlib para el filtro en Kenwood/Yaesu |
| El silencio al transmitir no hace nada | Receptor sin la actualización, o el equipo no informa del estado de transmisión | Igual que arriba |
| *Lost the rig ... reconnecting* | Se desconectó el cable, se apagó el equipo o se detuvo rigctld | Nada — reintenta cada 3 segundos y continúa cuando vuelve |
| Los dos lados saltan sin parar | Dos programas controlan el equipo a la vez | Deje que solo un programa ajuste el equipo, o compártalo mediante flrig |

---

## Limitaciones conocidas

- Un equipo y una ventana de receptor a la vez.
- Receptores distintos de PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR — OpenWebRX, por ejemplo — no son compatibles.
- Los controladores integrados siguen los protocolos publicados por los fabricantes y se probaron con equipos simulados y con Hamlib real; para un equipo que se comporte de otra forma, la alternativa es Hamlib.
- No se sincronizan split, VFO B, RIT/XIT ni canales de memoria — solo la frecuencia del VFO activo.
- En Linux los paquetes usan el Hamlib de la distribución; no incluyen uno propio.
