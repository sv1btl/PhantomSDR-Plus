# PhantomSDR-Plus — Control del transceptor (CAT)

Mantenga **su propio transceptor** y un **receptor PhantomSDR-Plus** en la misma frecuencia, modo y filtro. Gire el dial del equipo y la cascada lo sigue; haga clic en una señal de la cascada y el equipo se sintoniza en ella. Al transmitir, el receptor puede quedar en silencio para no devolverle su propia señal.

Funciona con receptores **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR**, suyos o ajenos, y solo mueve *su* sesión de escucha: nadie más en el receptor oye ni ve nada. El operador del receptor no tiene que instalar ni configurar nada.

---

## Qué necesita

Dos formas de conectar un equipo y un requisito en el receptor:

| Pieza | Qué es | Sincroniza |
|---|---|---|
| **[Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) 4.0 o posterior** | La aplicación de escritorio, con un menú **Rig**. Linux (PC y Raspberry Pi) y Windows. | Frecuencia, modo, ancho de filtro, silencio al transmitir — en un sentido o en ambos |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Un programa aparte para Windows que acopla un equipo a la página del receptor en su navegador. | Frecuencia y modo |
| **TCI-CAT en la página del receptor** | Un botón en la propia página de PhantomSDR-Plus, en cualquier navegador. Habla TCI con ExpertSDR, AetherSDR o Thetis, o con cualquier equipo compatible con Hamlib a través de un pequeño puente. Solo en receptores PhantomSDR-Plus con la versión 4.1.0 o posterior. | Frecuencia, modo y ancho de filtro en ambos sentidos; silencio al transmitir |
| **El receptor** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR o UberSDR. Un receptor PhantomSDR-Plus necesita la **4.1.0** o posterior para ancho de filtro y silencio. | Un PhantomSDR-Plus más antiguo sigue sincronizando frecuencia y modo |

La mayor parte de este manual describe Desktop PhantomSDR+. El botón TCI-CAT tiene su propia sección, [TCI-CAT en la página del receptor](#tci-cat-en-la-página-del-receptor). La CATsync Tool tiene su propia documentación en su sitio web.

---

## Receptores compatibles

La aplicación reconoce el tipo de receptor de una ventana de estación y lo maneja mediante los propios controles de esa página. La ventana Rig control muestra el tipo encontrado junto al nombre de la estación.

| Receptor | Frecuencia y modo | Ancho de filtro | Silencio al transmitir |
|---|---|---|---|
| PhantomSDR-Plus | Sí | Con la 4.1.0 o posterior | Con la 4.1.0 o posterior |
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
| **Icom LAN / WiFi** (Desktop 6.0) | Su Icom está en la red: un IC-705 por WiFi, o un IC-7300MK2, IC-7610, IC-9700, IC-905, IC-R8600, IC-7760, IC-785x por su puerto LAN. | La dirección IP del equipo, su Network User ID y contraseña, *Network Control* en ON |
| **Hamlib (all rigs)** | Su equipo es cualquier otro — Hamlib conoce más de 300. La aplicación inicia el `rigctld` de Hamlib por usted, en un puerto local privado, y lo detiene al desconectar. | Windows: nada, Hamlib va incluido. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Ya hay un `rigctld` en marcha, en este ordenador u otro de su red. | Host y puerto (4532 por defecto) |
| **flrig** | flrig ya controla el equipo para fldigi, WSJT-X o un programa de registro. | flrig en marcha, con su puerto XML-RPC (12345 por defecto) |

### Equipos con controlador integrado

La velocidad y la dirección CI-V que aparecen son los valores de fábrica que rellena la aplicación. **Son solo un punto de partida: póngalos como indique el menú de su equipo.**

| Familia | Equipos | Velocidad por defecto | Notas |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7300MK2, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 y cualquier otro equipo CI-V | 19200 | Dirección CI-V por modelo (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Dirección `70`; compruébela en el menú |
| **Yaesu CAT nuevo** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu CAT clásico** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 bits de parada; sintoniza en pasos de 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sincroniza el ancho de filtro |
| **Compatibles Kenwood** | FlexRadio SmartSDR CAT (puerto virtual), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, otros compatibles Kenwood | 9600–38400 | |

**Primero la velocidad más alta (Desktop 6.0).** Un Icom se conecta primero a 115200 baudios, luego a la velocidad ajustada en la ventana y después a 19200, 9600, 38400, 57600 y 4800; se conserva la velocidad que responde. Un equipo con *CI-V USB Baud Rate* en *Auto* mantiene la primera velocidad que oye tras encenderse, y la cascada del equipo necesita la rápida. Hamlib también prueba primero 115200 para IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610 e IC-7760.

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

Los receptores KiwiSDR, WebSDR y UberSDR tienen siempre el control. Un receptor PhantomSDR-Plus debe tener la **4.1.0** o posterior; en uno más antiguo la frecuencia y el modo siguen sincronizándose, y la ventana Rig control explica por qué el filtro no.

---

## Silencio al transmitir

Marque **Mute receiver while transmitting**. Mientras el equipo transmite, la ventana del receptor queda en silencio, y al dejar de transmitir vuelve el sonido. El botón de silencio del receptor lo muestra y puede quitar el silencio a mano.

Si ya había silenciado el receptor usted mismo, sigue silenciado después.

Necesita una conexión que informe del estado de transmisión — todos los controladores integrados, flrig y Hamlib en la mayoría de equipos — y, en un receptor PhantomSDR-Plus, la 4.1.0 o posterior.

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
| **Power on / Power off...** (Desktop 6.0) | Enciende el equipo por CAT y conecta, o (tras preguntar) lo apaga y lo libera. No por flrig, no para Elecraft |
| **Show rig waterfall and S-meter** (Desktop 6.0) | Muestra u oculta la cascada y el S-meter del equipo en la parte superior de la ventana del receptor - se ofrece mientras hay un equipo conectado |
| **Rig to receiver / Receiver to rig / Both directions** | Sentido de la sincronización |
| **Sync filter width** | Sí / no |
| **Mute receiver while transmitting** | Sí / no |
| Línea de estado | *Not connected*, *Connecting...*, *Connected: nombre*, o el último error |

---

## Cascada y S-meter del equipo

*Rig → Show rig waterfall and S-meter* (se ofrece mientras hay un equipo conectado) - o el botón del mismo nombre en la ventana Rig control - coloca una franja en la parte superior de la ventana del receptor, encima de la página de la estación. La página baja para dejar sitio y conserva su propia disposición.

- **La cascada** es el propio analizador de espectro de su transceptor, tal como el equipo lo envía por CAT: un Icom IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760, con la conexión **Built-in** o **Icom LAN / WiFi**. Mediante Hamlib o flrig la franja muestra solo el S-meter, porque `rigctld` y flrig no pueden transmitir el flujo del scope.
- **Los colores** son los de la estación: en una estación PhantomSDR-Plus la franja usa el esquema de colores elegido en la página y lo sigue cuando lo cambia. Los demás receptores (UberSDR, KiwiSDR, WebSDR) reciben el esquema de colores predeterminado de PhantomSDR, así la franja se ve igual en todas las estaciones. El control **Brightness**, antes de él, fija cuánta parte de la banda toma color: a la izquierda las señales débiles quedan oscuras, a la derecha aparecen y después el ruido. El control **Contrast** fija cuánto destacan las señales sobre el ruido; se recuerda.
- **Un clic** en la franja sintoniza allí el equipo; el receptor lo sigue mediante la sincronización. La línea roja es la frecuencia del equipo.
- **▴ ▾** hacen la franja más baja o más alta, **✕** la oculta.
- **El S-meter** es el del propio equipo, dibujado como el S-meter digital de PhantomSDR: segmentos cian hasta S9, rojos por encima, en la escala S1 … +60 dB, con la lectura al lado; *TX* en rojo mientras transmite.

Un IC-7300 envía unos 4 barridos por segundo por CI-V incluso con el scope en FAST; es el límite del equipo, y la franja se desplaza con suavidad entre ellos. El scope necesita la velocidad CI-V rápida: ponga el *CI-V USB Baud Rate* del equipo en 115200 o *Auto*.

**Icom LAN / WiFi.** En el equipo: conéctelo a su red (IC-705: *MENU › SET › WLAN Set*), ponga *Network Control* en ON y asígnele un *Network User1 ID* y *Password* (*Remote Settings*). En Rig control elija **Icom LAN / WiFi**, el modelo, y escriba la dirección IP, el usuario y la contraseña (guardada cifrada en este ordenador). El equipo admite un programa remoto a la vez: cierre antes wfview o RS-BA1.

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

El paquete `.deb` de Desktop PhantomSDR+ lo recomienda, así que `sudo apt install ./phantomsdr-plus-desktop_6.0.0_amd64.deb` lo trae consigo; `dpkg -i` no instala paquetes recomendados. Los controladores integrados y flrig no necesitan Hamlib.

## Windows

El propio `rigctld.exe` de Hamlib va incluido en el instalador de 64 bits y en el de 32 bits. Los puertos COM aparecen en la lista por su nombre (`COM3`). Si el equipo necesita un controlador USB, instale primero el del fabricante: hasta entonces el puerto no existe.

---

## TCI-CAT en la página del receptor

Una página de receptor PhantomSDR-Plus también puede seguir a un transceptor **por sí misma**, sin la aplicación de escritorio: el navegador habla directamente con un servidor **TCI** en su propio ordenador. TCI es el protocolo de control por WebSocket de ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) y Thetis (Apache Labs ANAN, Hermes). Para un equipo sin TCI, un pequeño puente incluido en PhantomSDR-Plus hace que cualquier equipo de Hamlib parezca un servidor TCI. Desde la 6.0.0 también puede llegar al equipo sin ningún software TCI, directamente por su cable USB — vea *Direct USB* más abajo.

Necesita un receptor PhantomSDR-Plus con la versión **4.1.0 o posterior**. Las páginas KiwiSDR, WebSDR y UberSDR no lo tienen. Direct USB necesita la 6.0.0 o posterior.

### El botón TCI-CAT

El botón está en la fila de **VFO**, **Modes**, **Bands** e **IF Filters** — **TCI-CAT** en el diseño ancho, **CAT** en el compacto. Su punto está **verde** mientras hay un servidor TCI conectado y **gris** en otro caso. Abre una ventana con: Hasta la 4.2.0 el botón se llamaba **QRG Sync**. Al elegir **Direct USB** el título de la ventana pasa a *CAT control via USB*. **CAT Sync**, **Split** y **Mute on TX** están en una sola línea abajo.

| Control | Qué hace |
|---|---|
| **Connection** | **TCI** — el servidor TCI o el puente descritos aquí — o **Direct USB**, el equipo directamente por su cable USB (vea *Direct USB* más abajo) |
| Estado | *Active — TCI (port 50001)* cuando está conectado; *Inactive* con ⏳ *Wait* mientras busca |
| **CAT Sync** | Activa o desactiva la sincronización de frecuencia, modo y filtro. Si se activa con un equipo conectado, la página pasa enseguida a la frecuencia, el modo y el filtro del equipo |
| **Host** | El ordenador con el servidor TCI: `localhost` para este ordenador, o su dirección en la red local, p. ej. `192.168.1.42`. Pulse Intro o haga clic fuera para reconectar |
| **Split** | Visible mientras hay un equipo conectado. Activado: sintonizar la página deja el equipo donde está, aunque el equipo sigue moviendo la página. Desactivado (por defecto): el equipo sigue a la página y se lleva a ella en cuanto se desactiva Split |
| **Mute on TX** | Visible mientras hay un equipo conectado. Activado (por defecto): la página se silencia mientras el equipo transmite, con una marca roja **TX**; desactivado: el receptor sigue sonando |
| **Rig scope** | Direct USB con un equipo que envía su espectroscopio por CI-V (IC-7300, IC-7300MK2, IC-705, IC-9700, IC-905, IC-R8600, IC-7610, IC-7760): el espectroscopio del propio equipo como franja de cascada bajo la del receptor — vea *Direct USB* más abajo |
| **Rig S-meter** | Direct USB con un equipo sin espectroscopio legible por un navegador — un Yaesu de CAT nuevo (FT-710, FT-991A, FTDX10, FTDX101, ...) o un Icom sin flujo de espectroscopio (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100): el S-metro del equipo bajo la cascada del receptor, pero sin cascada — vea *Direct USB* más abajo |

No hay nada más que elegir: los puertos **50001** (ExpertSDR3, AetherSDR) y **40001** (ExpertSDR2, Thetis) se prueban a la vez y se reintentan cada pocos segundos, así que la página se conecta en cuanto arranca el programa. El navegador recuerda **CAT Sync** y **Host**. **Split** y **Mute on TX** también se recuerdan.

Los navegadores que piden permiso antes de que una página web acceda a su red local — las versiones recientes de Chrome y Edge lo hacen — preguntan una vez, la primera vez que la página se conecta. Permítalo, o el punto seguirá gris.

### Qué se mantiene sincronizado

| | Comportamiento |
|---|---|
| **Equipo → receptor: frecuencia** | Solo se mueve el dial. Zoom, brillo y contraste quedan como los dejó; la cascada solo se desplaza cuando la frecuencia sale de la pantalla, y el plan de bandas no cambia el modo |
| **Equipo → receptor: modo** | Sigue cuando cambia el modo del equipo — USB, LSB, CW, AM, FM; los modos de datos como USB o LSB. Un modo que el receptor no tiene lo deja como está. Un decodificador en marcha conserva su propio modo |
| **Equipo → receptor: ancho de filtro** | La banda de paso del receptor toma el ancho de filtro del equipo: cambiar el filtro del equipo, o pulsar su botón **FIL**, cambia la banda de paso. Un decodificador en marcha conserva su propia banda de paso |
| **Receptor → equipo: frecuencia** | Escribir una frecuencia, una etiqueta o marcador, un clic en la cascada y arrastrar la banda de paso mueven el VFO del equipo. Al arrastrar solo se envían las frecuencias que cambian |
| **Receptor → equipo: modo** | Cada cambio de modo en la página — un botón de modo, el plan de bandas, un decodificador, un marcador — fija el modo del equipo (USB, LSB, CW, AM, FM; RADE como USB o LSB). Un equipo en modo de datos (USB-D) sigue en él |
| **Receptor → equipo: ancho de filtro** | Los botones de **IF Filters**, el deslizador IF, arrastrar la banda de paso y un cambio de modo fijan el filtro del equipo; al arrastrar solo se envía el ancho final. En los equipos Icom el puente selecciona en su lugar FIL1, FIL2 o FIL3 — ver [Filtros Icom](#filtros-icom-fil1-fil2-fil3) |
| **Sin eco** | Un cambio que vino del equipo nunca se le devuelve, y se ignora un aviso del modo o filtro anterior del equipo que llegue justo después de un cambio en la página |
| **Silencio al transmitir** | El interruptor **Mute on TX**, activado por defecto y válido también con CAT Sync desactivado: la página se silencia mientras el equipo transmite. Mover el control de volumen durante la transmisión la mantiene en silencio; al recibir el sonido vuelve al nivel actual del control |
| **No se gestiona** | VFO B, RIT/XIT y desplazamientos de transverter; solo se sigue el VFO A del primer receptor. **Split** solo impide que la página mueva el equipo |

### Con qué transceptores funciona

| Transceptor | Funciona | Cómo |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Sí | Directamente — active el servidor TCI en el programa. Aún no probado con estos programas; probado con un servidor TCI simulado |
| Un equipo con puerto CAT compatible con Hamlib — la mayoría de Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Sí | Mediante el puente Hamlib descrito abajo. Probado con un **Icom IC-7300** en Linux y Windows; otros controladores pueden diferir en los nombres de modo o en informar del PTT |
| Un equipo con puerto CAT por USB — Icom y Xiegu CI-V, Yaesu, Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 | Sí | Con **Direct USB** más abajo, sin otro software — en Chrome, Edge, Opera o Firefox 151+ en una página https://. Probado con un **Icom IC-7300** |
| Un equipo sin puerto CAT, o no compatible con Hamlib | No | No hay de dónde leer la frecuencia |

### Direct USB (sin software TCI, sin puente)

Desde la 6.0.0 la ventana tiene una segunda conexión, **Direct USB**: la página habla ella misma con el transceptor por su cable USB, mediante el Web Serial del navegador. No se ejecuta nada más en su ordenador — ni software TCI, ni Hamlib, ni puente.

| Necesita | |
|---|---|
| Navegador | Chrome, Edge u Opera, o Firefox 151 o posterior, en un ordenador de escritorio. Safari y los navegadores de móvil no tienen Web Serial |
| Dirección de la página | `https://`, o `http://localhost` en el ordenador de la estación. Con una dirección `http://` simple el navegador oculta Web Serial, así que **Direct USB** aparece en gris con el motivo; quedan TCI con el puente o Desktop PhantomSDR+ |
| El equipo | Un puerto CAT por USB: Icom y Xiegu (CI-V), Yaesu (CAT nuevo y FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs, (tr)uSDX, Lab599 TX-500 — 54 modelos. En Linux su usuario debe estar en el grupo `dialout` |

1. Abra **TCI-CAT** y elija **Connection: Direct USB**.
2. Elija el **Rig**. Se rellenan su velocidad **Baud** habitual y, en un Icom, su dirección **CI-V**; ajústelas al menú del propio equipo.
3. Pulse **Choose port…** y elija el puerto USB del equipo en la lista del navegador. Firefox pregunta antes una vez si permite el acceso serie al sitio. El navegador recuerda el puerto para este receptor.
4. Active **CAT Sync**. El puerto se abre y la página pasa a la frecuencia, el modo y el filtro del equipo.

| Ajuste | Qué hace |
|---|---|
| **Rig** | 54 modelos por fabricante, entre ellos el **IC-7300MK2**; **Other CI-V rig** u **Other Kenwood-compatible rig** para uno que no está en la lista |
| **Baud** | Se rellena desde la lista de equipos (115200 para los Icom con espectroscopio) y se conserva de la última conexión. Esos Icom se prueban siempre primero a 115200; un equipo que no responde a la velocidad ajustada se busca a 115200, 19200, 57600, 38400, 9600 y 4800, y se queda la velocidad que responde |
| **CI-V** | Solo Icom: la dirección del equipo en hexadecimal — `94` para el IC-7300, `B6` para el IC-7300MK2 |
| **SSB FIL1/2/3** | Solo Icom: los anchos de los tres filtros SSB del equipo, `2700,2400,1800` por defecto |
| **Lines: DTR, RTS** | Desactivados por defecto. En muchos cables CAT, DTR o RTS ponen el transmisor en emisión o reinician el equipo — márquelos solo si su interfaz los necesita |

| Botón | Qué hace |
|---|---|
| **Choose port…** | Elige el puerto USB (se pregunta una vez; las visitas siguientes lo vuelven a encontrar) |
| **Connect** / **Disconnect** | Abre o cierra el puerto. Mientras está cerrado, WSJT-X o un programa de registro pueden usar el equipo |
| **⏻ Power on** | Visible mientras no hay conexión: enciende el equipo por CAT, espera hasta 15 segundos a que responda y luego conecta. La fuente de alimentación del equipo debe seguir encendida |
| **⏻ Power off** | Visible con conexión: tras una confirmación, apaga el equipo y libera el puerto |

- El puerto se abre solo únicamente mientras **CAT Sync** está activado — al cargar la página, y al activar CAT Sync después de un Disconnect o de una conexión perdida. Abrir la ventana por sí solo nunca le quita el equipo a otro programa.
- Frecuencia, modo y filtro se siguen en ambos sentidos como en la tabla de arriba. En los Icom un cambio de paso de banda solo **selecciona** el más cercano de FIL1/FIL2/FIL3 según los anchos de **SSB FIL1/2/3**; los anchos de filtro del propio equipo nunca se cambian.
- Icom, Kenwood y Yaesu (CAT nuevo y antiguo) se pueden encender y apagar. Los Elecraft solo se encienden por su línea POWER ON, así que aquí solo se apagan y no tienen **⏻ Power on**.
- Desconectar el cable o apagar el equipo muestra *Link lost*; al volver a conectarlo se reconecta solo.
- **Rig scope.** Con un equipo con espectroscopio conectado, el interruptor **Rig scope** muestra el espectroscopio del propio equipo como franja de cascada bajo la cascada del receptor, cada barrido bajo las mismas frecuencias que la cascada de arriba, de modo que una señal queda alineada en ambas — arriba la antena de la estación, abajo la suya. Fuera del margen del equipo la franja queda oscura, su etiqueta muestra el margen, y un clic sintoniza allí. El margen, el modo centro/fijo y el nivel de referencia del propio equipo deciden lo que llega. El espectroscopio necesita **115200** baudios (a 19200 hace 2–3 barridos por segundo, y la ventana lo indica); el flujo se detiene con Disconnect y al cerrar la página. Acerque el receptor a la banda: en la vista completa de 0–30 MHz un margen de ±25 kHz ocupa solo un par de píxeles. Probado con un IC-7300. Abajo a la izquierda de la franja, el **S-meter** del equipo muestra lo que oye su antena en la frecuencia sintonizada — unidades S tal como las da el equipo (S9 en el centro de la barra, encima +20/+40/+60, una breve retención de pico, *TX* mientras transmite), no dBm; solo se lee mientras Rig scope está activado.
- **Rig S-meter (Yaesu e Icom antiguos).** Con un Yaesu de CAT nuevo, o un Icom que no envía espectroscopio por CI-V (IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII/II, IC-746PRO, IC-718, IC-R75, Xiegu G90/X6100), el interruptor se llama **Rig S-meter** y muestra bajo la cascada del receptor una franja estrecha con el S-metro del equipo (S1 … S9+60, *TX* al transmitir). Se lee por CAT solo mientras la franja está visible — `SM0` en un Yaesu, CI-V `15 02` en un Icom —, a la velocidad ajustada en el menú del equipo; el interruptor nunca la cambia y no se envía ninguna orden de espectroscopio a estos equipos. No hay cascada, y la ventana explica por qué: estos Icom no envían espectroscopio por CI-V y los Yaesu no envían el suyo por CAT. El del FT-710 pasa por un chip FTDI aparte en el cable USB, que un navegador no puede abrir; [Desktop PhantomSDR+](https://phantomsdr.psychomed.gr/desktop.html) lee ese chip y muestra la cascada del FT-710. El S-metro Yaesu se comprobó con un FT-710 real: a unos 0,5 dB del S-metro del propio equipo. Kenwood, Elecraft, FT-817/857/897 y los demás equipos de la lista sincronizan solo frecuencia, modo y PTT.
- **IC-7300 en Auto.** Con **CI-V USB Baud Rate** en *Auto*, el IC-7300 se queda con la primera velocidad que oye tras encenderse e ignora un cambio posterior en ambos sentidos. Por eso la página llega a los Icom con espectroscopio primero a 115200, también con **⏻ Power on**; un **115200** fijo en el menú del equipo evita la cuestión por completo.
- **Equipos con dos puertos USB.** El IC-705 y el IC-905 muestran *Serial Port A (CI-V)* y *Serial Port B*, el IC-7610 y el IC-9700 un *Enhanced* y un *Standard COM Port*, todos con los mismos identificadores USB. Elija el de CI-V — el Port A o el Enhanced; Windows lista primero el Port B. Si el puerto elegido no responde, la página prueba sola el otro puerto del equipo y se queda con el que responde.
- **IC-705 en Windows.** El controlador USB de Icom para el IC-705 bloquea la forma en que los navegadores leen un puerto serie: Edge y Firefox se congelan y el puerto queda ocupado hasta volver a conectar el cable. Por eso la página no abre un IC-705 en Windows; use **Connection: TCI** con el puente Hamlib (`rigctl -m 3085 -r COM6 -s 115200`, siendo COM6 el Port A) o Desktop PhantomSDR+. En Linux el IC-705 usa el controlador propio del núcleo.
- Probado con un **Icom IC-7300**: frecuencia, modo, filtro, silencio al transmitir, Power on y Power off.

### El puente Hamlib (IC-7300 y otros equipos sin TCI)

`tci-bridge/tci-rigctld.mjs`, en el árbol de PhantomSDR-Plus, convierte cualquier equipo que Hamlib pueda controlar en un servidor TCI para la página. Se ejecuta en **su** ordenador — el conectado al equipo, junto al navegador — no en el receptor. Cuatro veces por segundo pregunta a Hamlib la frecuencia, el modo, el ancho de filtro y el estado de transmisión, envía a la página solo lo que cambió y pasa al equipo los cambios de frecuencia, modo y filtro de la página.

Llega a Hamlib por una de dos vías:

| Vía | Cadena | Cuándo |
|---|---|---|
| **`--rigctl`** (recomendada) | transceptor → `rigctl` → `tci-rigctld.mjs` → página | Normalmente. El puente arranca por sí mismo el `rigctl` de Hamlib: una ventana, ningún puerto de red. **Úsela en Windows**, donde `rigctld.exe` suele rechazarse con *Access is denied* |
| **`rigctld`** | transceptor → `rigctld` → `tci-rigctld.mjs` → página | Otro programa, como WSJT-X, debe usar el equipo al mismo tiempo — ver [Compartir el equipo](#compartir-el-equipo-la-vía-rigctld) |

**Qué necesita**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, o el paquete hamlib de su distribución | `hamlib-w64-….zip` de [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), extraído en `C:\hamlib` — `rigctl.exe` está en `C:\hamlib\bin` |
| Node.js | 18 o posterior | El *Windows Installer (.msi)* LTS de [nodejs.org](https://nodejs.org), con las opciones por defecto |
| El paquete `ws` | Se encuentra automáticamente dentro del árbol PhantomSDR-Plus | Copie `tci-rigctld.mjs` a una carpeta como `C:\tci-bridge` y ejecute allí una vez `npm install ws` |
| El puerto del equipo | `ls /dev/serial/by-id/`. Únase una vez al grupo `dialout`: `sudo usermod -aG dialout $USER`, luego cierre la sesión y vuelva a entrar | Instale el controlador USB del fabricante; el número COM está en **Administrador de dispositivos → Puertos (COM y LPT)** |

Solo un programa puede tener el puerto CAT del equipo. Cierre WSJT-X, flrig, JS8Call, RS-BA1 o la conexión de equipo de Desktop PhantomSDR+ antes de arrancar el puente.

#### Ejemplo: Icom IC-7300

En el equipo: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. El número de modelo de Hamlib para el IC-7300 es `3073`.

**Linux.** El equipo es la línea que contiene `IC-7300` en `ls /dev/serial/by-id/`, normalmente también `/dev/ttyUSB0`.

1. Compruebe que Hamlib llega al equipo — debe mostrar la frecuencia, p. ej. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Arranque el puente y déjelo en marcha:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** El equipo aparece en el Administrador de dispositivos como *Silicon Labs CP210x USB to UART Bridge (COM4)* — use su propio número COM. En un Símbolo del sistema:

1. Compruebe que Hamlib llega al equipo — debe mostrar la frecuencia:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Arranque el puente y deje la ventana abierta:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   La línea es larga: asegúrese de que termina de verdad en `-s 115200`, o `rigctl` se detiene con *Type: rigctl --help*.

En ambos sistemas el puente muestra, en un segundo:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Después abra la página del receptor en un navegador del mismo ordenador, abra **TCI-CAT** y active **CAT Sync**. El punto se pone verde y el puente muestra `page connected`. Gire el VFO y el receptor lo sigue; haga clic en la cascada y el equipo lo sigue (`page -> rig ... Hz`); transmita y la página se silencia. **Ctrl+C** detiene el puente, y con él `rigctl`.

Todo lo que va tras `--rigctl` es el programa `rigctl` y sus propias opciones — exactamente las que funcionaron en la comprobación. Es la regla para cualquier equipo: **si `rigctl … f` muestra la frecuencia, el puente funciona con las mismas opciones.**

#### Filtros Icom (FIL1, FIL2, FIL3)

Los equipos Icom como el IC-7300 no aceptan cualquier ancho de filtro: tienen tres filtros, **FIL1**, **FIL2** y **FIL3**, cada uno con un ancho fijado en el menú del equipo. Con un ancho, Hamlib seleccionaría uno de ellos y además sobrescribiría su ancho — y en el IC-7300 ese ancho puede ir a parar al filtro que estaba seleccionado antes, desordenando los ajustes. Por eso, en los equipos Icom el puente nunca envía un ancho: toma el filtro cuyo ancho de referencia está más cerca de la banda de paso de la página y solo lo **selecciona**, con la orden CI-V del propio equipo. Los anchos fijados en el equipo nunca cambian.

| Modo | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (y sus modos de datos) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

En el IC-7300 (`-m 3073`) es automático. Ajuste los filtros SSB del equipo en consonancia — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (mantenga pulsado **FIL** en el equipo) — y elegir 2,7 / 2,4 / 1,8 kHz en **IF Filters** selecciona FIL1 / FIL2 / FIL3, mientras que pulsar **FIL** en el equipo pone la banda de paso de la página al ancho de ese filtro. El puente muestra, por ejemplo, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`. El IC-7300MK2 (`-m 3094`) se trata igual, en su propia dirección CI-V B6h; necesita una versión de Hamlib que conozca el MK2.

| Opción | Uso |
|---|---|
| `--filters 3000,2400,1800` | Otros anchos de referencia SSB, en el orden FIL1,FIL2,FIL3; también activa la selección de filtro para otro equipo Icom |
| `--civ A4` | La dirección CI-V del equipo en hexadecimal, cuando no es `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Enviar anchos mediante Hamlib, como para otras marcas |

Ambas opciones van antes de `--rigctl`, p. ej. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Probado solo con un IC-7300. Las demás marcas — Yaesu, Kenwood, Elecraft y el resto — reciben el ancho de la página mediante Hamlib, que lo fija tan cerca como el equipo permite.

#### Otros equipos

Los mismos pasos sirven para cualquier equipo compatible con Hamlib; solo cambian las opciones.

1. **Prepare el equipo.** En su menú, anote la velocidad CAT (o CI-V) y active un ajuste como *CAT por USB* o *CI-V transceive* si lo tiene. En Windows, instale el controlador USB del fabricante.
2. **Busque el número de modelo de Hamlib** en la lista que muestra `rigctl -l`:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Busque el puerto.** Linux: `ls /dev/serial/by-id/`. Windows: Administrador de dispositivos. Algunos equipos crean **dos** puertos — los FT-991A, FTDX10 y FT-710 de Yaesu los llaman *Enhanced* y *Standard*; el CAT está en el **Enhanced**.
4. **Compruebe y arranque el puente** con `-m <modelo> -r <puerto> -s <velocidad>`, como en el ejemplo del IC-7300: primero `rigctl -m … -r … -s … f`, luego las mismas opciones tras `--rigctl`.

Algunos números de modelo, de Hamlib 4.5 — confírmelos con `rigctl -l`, ya que otra versión de Hamlib puede numerar un equipo de otra forma:

| Equipo | `-m` | Equipo | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Opciones adicionales, solo si hacen falta:

- **Un equipo Icom con la dirección CI-V cambiada:** añada `-c` con la dirección en *decimal* — `94h` es `-c 148`.
- **Un ajuste que Hamlib ofrece para ese equipo:** `rigctl -m <modelo> -L` los lista; fije uno con `-C nombre=valor`, p. ej. `-C post_write_delay=10` para una interfaz lenta.
- **Un equipo que transmite o se reinicia al abrir el puerto:** algunos cables CAT usan DTR o RTS para el PTT; añada `-C dtr_state=OFF -C rts_state=OFF`.

#### Equipos controlados por otro programa

Algunos equipos ya los controla un programa que puede hacer el trabajo — a veces sin ningún puente. Ninguna de estas vías se ha probado.

| Equipo y programa | Qué hacer |
|---|---|
| **SunSDR** con ExpertSDR2/3, **FlexRadio** con AetherSDR, **Apache Labs ANAN / Hermes** con Thetis | Sin puente. Active el **servidor TCI** del programa y use **TCI-CAT** directamente — los puertos 50001 y 40001 se encuentran solos |
| **FlexRadio** con SmartSDR (Windows) | Añada un puerto en **SmartSDR CAT**. Habla CAT de Kenwood, así que un puerto serie allí funciona como un TS-2000: `-m 2014 -r COM8 -s 57600`. Un puerto TCP funciona con el modelo FlexRadio de Hamlib: `-m 2036 -r 127.0.0.1:<puerto>` |
| **Cualquier equipo controlado por flrig** | Deje flrig en marcha y use el modelo flrig de Hamlib; el equipo sigue compartido con fldigi, WSJT-X y programas de registro: `-m 4 -r 127.0.0.1:12345` |
| **Un rigctld en marcha**, o un programa con servidor *Hamlib NET rigctl* | Arranque el puente sin `--rigctl`, con esa dirección: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Como siempre, las opciones van tras `rigctl` en la comprobación y tras `--rigctl rigctl` en el puente. Una dirección de red como `127.0.0.1:12345` no necesita `-s`.

#### Compartir el equipo: la vía rigctld

Cuando WSJT-X o un programa de registro deba usar el equipo mientras funciona el puente, arranque el servidor de Hamlib `rigctld` con las mismas opciones, déjelo en marcha y conecte ambos programas a él:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Sin `--rigctl` el puente busca `rigctld` en `127.0.0.1:4532` y muestra `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` usa un `rigctld` de otro ordenador. En WSJT-X elija el equipo *Hamlib NET rigctl* en la misma dirección. En Windows el servidor es `C:\hamlib\bin\rigctld.exe` con las mismas opciones; si Windows responde *Access is denied*, use `--rigctl` y cierre el otro programa mientras funciona el puente.

**Puertos.** El puente ofrece TCI en el puerto 50001; otro puerto va primero en la línea de órdenes, p. ej. `node tci-rigctld.mjs 40001 --rigctl …`. Si el puente y el navegador están en ordenadores distintos, ponga en **Host** la dirección del ordenador del puente.

### Solución de problemas de TCI-CAT

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El punto sigue gris | El servidor TCI o el puente no está en marcha; **Host** incorrecto; se denegó el permiso de red local del navegador | Active TCI en ExpertSDR/Thetis/AetherSDR o arranque el puente; revise **Host**; permita el acceso a la red local en los ajustes del sitio |
| `rigctl … f` da un error o se queda esperando | Puerto o velocidad incorrectos; sin permiso `dialout` (Linux) o sin controlador USB (Windows); otro programa tiene el puerto | Ajuste `-s` al menú del equipo; revise el puerto (`ls /dev/serial/by-id/`, Administrador de dispositivos); cierre otros programas del equipo |
| El puente muestra *rigctl stopped … Type: rigctl --help* | La orden está incompleta — normalmente falta la velocidad tras `-s` | Escriba de nuevo la línea completa |
| El puente muestra *The value after -s is missing* | La línea de órdenes se cortó al pegarla | Escriba de nuevo el final de la línea, p. ej. `-s 115200` |
| El filtro no sigue en uno u otro sentido | **CAT Sync** está apagado, hay un decodificador en marcha en la página o (IC-7300) los anchos FIL del equipo difieren de 2700 / 2400 / 1800 Hz | Active CAT Sync; detenga el decodificador; ajuste los anchos FIL en el equipo, o indique `--filters` con los anchos del equipo |
| El puente muestra *rigctl stopped … rig_open: error* | `rigctl` no puede abrir el puerto | Como para `rigctl … f` arriba |
| El puente muestra *the rig is not answering* | El puerto se abre pero el equipo no responde: velocidad o modelo incorrectos, CAT desactivado en el menú, o dirección CI-V de Icom cambiada | Repita la comprobación `rigctl … f`; añada `-c` si la dirección CI-V está cambiada |
| El puente muestra *rigctld not reachable* | Arrancado sin `--rigctl`, y no hay `rigctld` en marcha | Añada `--rigctl …`, o arranque primero `rigctld` |
| `rigctld.exe` dice *Access is denied* (Windows) | Windows se niega a ejecutarlo | Use `--rigctl` — solo necesita `rigctl.exe` |
| Conectado, pero el receptor no se mueve | **CAT Sync** está desactivado | Actívelo — la página pasa enseguida a la frecuencia, el modo y el filtro del equipo. El silencio al transmitir funciona sin él |
| El equipo no sigue a la página | **Split** está activado | Desactive Split — el equipo se lleva a la página enseguida |
| El modo del equipo no sigue | Un modo sin equivalente en el receptor, o el controlador Hamlib informa de un nombre poco habitual | La frecuencia se sincroniza igualmente; ajuste el modo en la página |
| No hay silencio al transmitir | **Mute on TX** está desactivado, o el equipo (o su controlador Hamlib) no informa del estado de transmisión | Active **Mute on TX**; si no, no hay nada que ajustar en la página |
| El dial salta de un lado a otro | Desktop PhantomSDR+ u otro programa también sincroniza el equipo | Use un solo controlador a la vez |
| **Direct USB** aparece en gris | La página está en una dirección http:// simple, o el navegador no tiene Web Serial (Safari, móviles, Firefox anterior a 151) | Abra el receptor por https://, o use TCI con el puente |
| *Could not open the port* | Otro programa (WSJT-X, un programa de registro, el puente) lo tiene; en Linux, el usuario no está en el grupo `dialout` | Cierre el otro programa; `sudo usermod -aG dialout $USER` y vuelva a iniciar sesión |
| *The rig did not answer at any usual speed* | El equipo está apagado, o **CI-V** o el tipo de equipo no coinciden | Compruébelos; **⏻ Power on** si está apagado |
| *The rig did not switch on* | La fuente de alimentación del equipo está apagada, o el equipo no despierta por CAT | Encienda la fuente; compruebe **Baud** y **CI-V** |
| *The rig answers only at 19200 baud, so its scope runs slowly* | El **CI-V USB Baud Rate** del equipo está fijo en 19200, o en Auto y quedado en 19200 desde el encendido | Póngalo en 115200, o apague y encienda el equipo para que Auto oiga primero 115200 |
| El navegador se congela con un IC-705 (Windows) | El controlador IC-705 de Icom bloquea las lecturas serie del navegador | Vuelva a conectar el cable USB para liberar el puerto; use TCI con el puente Hamlib o Desktop PhantomSDR+ |

---

## Para operadores de receptores

Nada que configurar. El control del transceptor usa una pequeña interfaz JavaScript que ya lleva cada página de PhantomSDR-Plus; no requiere ajustes en el servidor, puertos abiertos ni permisos de administrador. Las funciones de filtro y silencio llegaron con la versión 4.1.0 — tras aplicarla, recompile el frontend (`./recompile.sh`, opción 2); no hace falta detener el receptor. Los receptores KiwiSDR, WebSDR y UberSDR tampoco necesitan nada: la aplicación usa los controles que sus páginas ya tienen.

El botón **TCI-CAT** llegó también con la 4.1.0, de nuevo solo con recompilar el frontend. No abre ningún puerto en el receptor: la conexión va del navegador de cada oyente a su propio ordenador. El puente Hamlib, `tci-bridge/tci-rigctld.mjs`, es para que los oyentes lo ejecuten en casa; el receptor no lo usa. El navegador abre esa conexión solo después de que el oyente abra **TCI-CAT** o active **CAT Sync** (se recuerda por navegador), así que por https los visitantes que nunca lo usan no ven ninguna petición de acceso a la red local.

Tampoco **Direct USB** (6.0.0) abre nada en el receptor: el navegador de cada oyente habla con su propio equipo por USB. Los navegadores solo lo permiten en una página segura, así que los oyentes remotos lo tienen cuando el receptor se alcanza por https:// (vea [Acceso seguro (HTTPS)](HTTPS.md)); en una estación solo http les quedan TCI y Desktop PhantomSDR+.

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
| El filtro no sigue | Receptor anterior a la 4.1.0, o controlador integrado Kenwood/Yaesu | Frecuencia y modo siguen sincronizando; use Hamlib para el filtro en Kenwood/Yaesu |
| El silencio al transmitir no hace nada | Receptor sin la actualización, o el equipo no informa del estado de transmisión | Igual que arriba |
| *Lost the rig ... reconnecting* | Se desconectó el cable, se apagó el equipo o se detuvo rigctld | Nada — reintenta cada 3 segundos y continúa cuando vuelve |
| Los dos lados saltan sin parar | Dos programas controlan el equipo a la vez | Deje que solo un programa ajuste el equipo, o compártalo mediante flrig |

---

## Limitaciones conocidas

- Un equipo y una ventana de receptor a la vez.
- Receptores distintos de PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR — OpenWebRX, por ejemplo — no son compatibles.
- Los controladores integrados siguen los protocolos publicados por los fabricantes y se probaron con equipos simulados y con Hamlib real; para un equipo que se comporte de otra forma, la alternativa es Hamlib.
- No se sincronizan split, VFO B, RIT/XIT ni canales de memoria — solo la frecuencia del VFO activo.
- TCI-CAT y Direct USB en la página del receptor no sincronizan VFO B, RIT/XIT ni desplazamientos de transverter — **Split** solo impide que la página mueva el equipo — y solo se han probado con un IC-7300 (TCI a través del puente Hamlib).
- En Linux los paquetes usan el Hamlib de la distribución; no incluyen uno propio.
