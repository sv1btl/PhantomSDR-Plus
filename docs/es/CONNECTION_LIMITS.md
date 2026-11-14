# Límites de conexión — Manual del sysop

**Proteger un receptor público frente a avalanchas de conexiones.**

Un WebSDR es un servicio público que entrega a quien lo pida un flujo continuo de audio y espectro. Ese es su propósito, y ahí está también el problema: para el servidor, nada distingue a un oyente normal de alguien que abre sesiones en bucle. El 16 de septiembre de 2026 este receptor sufrió exactamente eso — una sola dirección abrió 134 sesiones de escucha en un minuto y mantuvo 181 a la vez, mientras el público real de la estación rondaba la docena.

Este manual trata de las tres capas que lo detienen, de lo que cada una puede y no puede hacer, y de cómo saber si las suyas están bien ajustadas.

> **¿Con prisa?** El `config.toml` de ejemplo ya viene con valores sensatos, así que una instalación nueva está protegida sin que haga usted nada. Si su propio `.toml` es anterior y no tiene claves `[limits]` más allá de `audio`/`waterfall`/`events`, los límites por dirección están simplemente **desactivados** — copie el bloque del ejemplo para activarlos. El único comando que conviene conocer después es `grep Refused spectrumserver.log`, que le dice si se está rechazando a alguien.

---

## Contenido

1. [Las tres capas](#1-las-tres-capas)
2. [Límites por dirección — la política de oyentes](#2-límites-por-dirección)
3. [Conexiones inactivas — el ataque silencioso](#3-conexiones-inactivas)
4. [La protección en el núcleo — `setup-firewall.sh`](#4-la-protección-en-el-núcleo)
5. [Referencia de configuración](#5-referencia-de-configuración)
6. [Qué ve un oyente rechazado](#6-qué-ve-un-oyente-rechazado)
7. [Leer los registros y los contadores](#7-leer-los-registros-y-los-contadores)
8. [Elegir sus números](#8-elegir-sus-números)
9. [Trampas que conviene conocer](#9-trampas-que-conviene-conocer)
10. [Desactivarlo todo](#10-desactivarlo-todo)

---

## 1. Las tres capas

```
   internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     tosco, barato, quita volumen antes de que nada      │
   │     lo lea                                              │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] en config.toml           │
   │     exacto, por oyente, sabe quién es quién             │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. el navegador      dice por qué, y nunca reintenta    │
   └─────────────────────────────────────────────────────────┘
```

---

## 2. Límites por dirección

### Qué cuenta como un oyente

Un oyente es **una conexión `/audio`** — o, donde `[kiwi_emulation]` está activado, **una conexión de sonido Kiwi**, que cuenta exactamente igual. Es la misma unidad que ya usan el contador de usuarios, `users.json` y las etiquetas sobre la cascada, así que un cliente Kiwi consume una plaza y aparece en la lista de usuarios igual que un navegador.

Esto importa porque una sola pestaña de navegador de escritorio abre **cuatro** conexiones a su servidor:

| Conexión | Función |
|---|---|
| `/audio` | el flujo de audio demodulado — **este es el oyente** |
| `/waterfall` | la representación del espectro |
| `/events` | lista de usuarios, frecuencias de los demás oyentes |
| `/chat` | el panel de chat |

Un teléfono en `/mobile` abre dos (`/audio` y `/chat`), porque no tiene cascada. Así que un límite que contara conexiones en bruto rechazaría a todo el mundo: tres pestañas son doce conexiones. Con el analizador de audio abierto, una pestaña de escritorio abre una quinta, un `/waterfall` invisible que alimenta sus medidas; tres pestañas así (quince conexiones) siguen cabiendo en el límite derivado de dieciséis.

### Las tres claves

```toml
[limits]
per_ip=3            # oyentes simultáneos desde una dirección
per_ip_sockets=0    # conexiones simultáneas de cualquier tipo; 0 da per_ip * 4 + 4
per_ip_rate=40      # conexiones nuevas por minuto desde una dirección
per_ip_ban_s=600    # cuánto se rechaza a una dirección que rompe el ritmo
```

**`per_ip`** es la cifra principal y en la que pensará. Tres es un buen punto de partida.

**`per_ip_sockets`** existe porque `/audio` no es lo único que merece la pena inundar. `/waterfall` es el flujo más pesado que produce su servidor, y un límite que contara solo oyentes se esquivaría sin más abriendo conexiones de cascada. Dejado en `0` se convierte en `per_ip * 4 + 4`, que da cabida a `per_ip` pestañas de escritorio completas con algo de margen para conexiones que el núcleo aún no ha liberado tras recargar la página.

**`per_ip_rate`** es lo que de verdad termina con una avalancha. El tope por sí solo no lo hace: rechazar una conexión es barato pero no gratis, y un atacante puede seguir reconectando tan rápido como vuelven los rechazos, quemando su CPU en montar y desmontar. El límite de ritmo le da un bloqueo en lugar de una respuesta. Recuerde que una pestaña cuesta cuatro, así que 40/minuto son unas diez cargas de página por minuto desde una dirección.

### Quién queda exento

**El loopback nunca se limita.** El tap de autorun para el reporte de spots, el panel de administración y un navegador abierto en la propia máquina del servidor llegan todos desde `127.0.0.1`, y dejar que consuman plazas significaría que su propia estación deja fuera a sus oyentes.

Esto cubre también `proxy.py`: las conexiones a través del proxy llegan a `spectrumserver` desde loopback, y la dirección real del cliente llega en la cabecera `X-Forwarded-For`, que es sobre la que se aplican los límites.

Desde la v5.0.0 esa cabecera se cree **solo si viene de un par loopback** — un proxy en la misma máquina. Enviada por cualquier otro se ignora y cuenta la dirección TCP, porque de lo contrario un visitante directo podría escribir `X-Forwarded-For: 127.0.0.1` y pasar como loopback por encima de todos los límites de esta página. `proxy.py` además descarta cualquier `X-Forwarded-For` o `X-Real-IP` que envíe un cliente antes de añadir los suyos, y solo responde a la expulsión del sysop (`/~~kick`) para clientes de la misma máquina. Una estación con varios receptores detrás del proxy se describe en [Varios receptores](MULTI_RECEIVER.md); allí los límites se aplican por receptor.

---

## 3. Conexiones inactivas

Hay un ataque que nada de lo anterior puede ver.

Abrir una conexión TCP. No enviar nada. Mantenerla.

Ese interlocutor nunca completa una petición, así que nunca alcanza el código donde viven los límites por dirección — no hay oyente, no hay objeto de cliente, no hay nada con nombre que contar. Mientras tanto, a él le cuesta unos pocos bytes y a usted un descriptor de fichero y una plaza mientras la mantenga.

```toml
[limits]
idle_per_ip=8       # conexiones inactivas (previas a la petición) por dirección
idle_total=512      # tope para todas las direcciones juntas
```

El límite está en **cuántas**, no en **cuánto tiempo**, y esa distinción es todo el diseño. **No hay plazo alguno para una conexión inactiva, y es deliberado.** Un plazo parece la respuesta obvia y es una trampa (vea [§9](#9-trampas-que-conviene-conocer)): hay interlocutores legítimos que se conectan y luego permanecen callados mucho tiempo antes de hablar. Lo que los separa de un ataque es la cantidad — un interlocutor legítimo mantiene una de esas conexiones, un atacante miles.

Una conexión inactiva vive por tanto hasta que hace una petición o muere, y su plaza se libera en ambos casos.

`idle_total` acota una avalancha repartida entre muchas direcciones de origen. Al alcanzar el tope, se rechazan las **nuevas** conexiones inactivas en vez de expulsar las existentes, de modo que una conexión legítima y de larga vida nunca es lo que se sacrifica para hacer sitio.

---

## 4. La protección en el núcleo

`setup-firewall.sh` instala una tabla de nftables que quita volumen antes de que `spectrumserver` lea un solo byte. Es deliberadamente tosca, y sus números quedan muy por encima de los de `config.toml`, de modo que un oyente normal nunca puede quedar atrapado por ambos.

```bash
./setup-firewall.sh --show        # imprime las reglas, no cambia nada
sudo ./setup-firewall.sh --check  # valida contra su núcleo
sudo ./setup-firewall.sh --apply  # carga, con reversión automática a los 60 s
sudo ./setup-firewall.sh --persist # recarga al arrancar
sudo ./setup-firewall.sh --status  # los contadores de paquetes por regla
sudo ./setup-firewall.sh --remove  # deshacer todo
```

Cubre cuatro cosas: un tope de conexiones simultáneas por dirección de origen en sus puertos de proxy y receptor, un ritmo de conexiones nuevas por origen, un freno contra la fuerza bruta en SSH, y la compartición de archivos de Windows cerrada a todo lo que esté fuera de los rangos privados — `smbd` escucha en `0.0.0.0` en muchas máquinas, y que eso sea alcanzable depende de un router que el script no puede ver.

Los puertos se leen de `admin_config.json`, el mismo fichero que usa `proxy.py`, así que sigue su instalación.

### Por qué no puede dejarle fuera

Dos propiedades, ambas deliberadas:

- La política de la tabla es **accept**, y solo descarta patrones concretos y nombrados. Una regla que no casa deja pasar el paquete a lo que sea que tenga configurado. No puede dejar la máquina incomunicada.
- **Las conexiones establecidas se aceptan en la primerísima regla.** La sesión SSH en la que está escribiendo nunca se ve afectada por nada de lo que sigue.

Además, `--apply` arma una reversión automática: carga las reglas y luego espera confirmación en 60 segundos, o las quita. No diga nada, cierre el terminal, pierda la conexión — el conjunto de reglas desaparece solo.

Aproveche bien esa ventana. Compruebe **desde otro dispositivo, fuera de su propia red**, que el receptor sigue cargando y que se abre una sesión SSH *nueva*. Probar con la sesión que ya tiene no demuestra nada, porque la aceptó la regla uno.

---

## 5. Referencia de configuración

Todas las claves de abajo viven bajo `[limits]` en su fichero `.toml`. **Todas vienen desactivadas o con valores generosos**, así que una configuración que no las mencione se comporta exactamente como siempre.

| Clave | Por defecto | Significado |
|---|---|---|
| `per_ip` | `0` (desactivado) | Oyentes simultáneos por dirección |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Conexiones simultáneas de cualquier tipo por dirección |
| `per_ip_rate` | `0` (desactivado) | Conexiones nuevas por minuto y dirección |
| `per_ip_ban_s` | `600` | Segundos de rechazo tras romper el ritmo |
| `idle_per_ip` | `8` | Conexiones inactivas, previas a la petición, por dirección |
| `idle_total` | `512` | Conexiones inactivas en todas las direcciones |

Poner cualquier clave a `0` desactiva esa comprobación concreta.

### Una más, bajo `[server]`

```toml
[server]
min_client_version=0
```

No es un límite sino un rechazo, y como comparte el mismo código de cierre, su sitio está aquí. Las páginas anuncian la versión desde la que se cargaron como `/audio?v=N`, y todo lo que esté por debajo de `min_client_version` se rechaza con *«esta página está desactualizada — recárguela»*.

Las configuraciones que trae PhantomSDR-Plus fijan `min_client_version=2`, la versión actual (`CLIENT_VERSION` en `frontend/src/clientVersion.js`), con un comentario que lo explica; sin la línea vale `0`. Si una actualización futura sube `CLIENT_VERSION`, suba también este valor.

---

## 6. Qué ve un oyente rechazado

### Nada se reconecta nunca

Empiece por aquí, porque gobierna todo lo demás: **una conexión `/audio` caída termina la sesión.** No hay reconexión automática, y es deliberado.

### Los dos códigos de cierre

| Código | Significado | Quién lo envía |
|---|---|---|
| **4003** | rechazado — por encima de un límite por dirección, o página obsoleta | `spectrumserver` |
| **4001** | expulsado o bloqueado por el operador | `spectrumserver`, cuando el panel llama a `/~~kick` |

### En la página

**Rechazado al cargar la página** — el oyente ni siquiera arranca, así que ambas páginas se explican. El escritorio muestra un panel: *«Este receptor ha rechazado la conexión»*, el motivo, y la nota de que todos los que comparten una conexión a internet cuentan como una dirección. `/mobile` muestra lo mismo en su zona de avisos.

**Rechazado o expulsado a mitad de sesión** — la página de escritorio simplemente se detiene, deliberadamente sin mensaje: el bucle de dibujo de la cascada se para y nada más. `/mobile` muestra una línea diciendo al oyente que recargue, salvo tras una expulsión, donde también guarda silencio.

Ese silencio tras una expulsión es intencionado. **Expulsar es el sysop terminando una sesión, no un castigo** — no se anuncia nada, y quien quiera volver carga la página otra vez y es un oyente corriente un segundo después. Lo único que aporta el código 4001 es que el navegador sepa que aquello no fue una conexión caída, de modo que la expulsión surta efecto en lugar de deshacerse sola.

Un **bloqueo** — el ⛔ Ban ▾ del panel de administración — es la única excepción: es la misma expulsión con un rechazo de 8, 16 o 24 horas, así que la recarga se rechaza con 4001 hasta que el bloqueo expira o el operador lo levanta.

## 7. Leer los registros y los contadores

### El servidor

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

Si ahí no hay nada, no se está rechazando a nadie. El registro está limitado a como mucho una línea por dirección cada cinco segundos — sin eso, un ataque se convertiría en escrituras a disco sin límite, que no es más que una forma más lenta de tumbar la estación.

### El núcleo

```bash
sudo ./setup-firewall.sh --status
```

Lea el **`counter packets N`** de cada regla; ese es el número realmente descartado. Todo a cero significa que no se ha bloqueado nada y que sus umbrales están cómodamente holgados.

---

## 8. Elegir sus números

**Recuerde el NAT.** Un club, un colegio, una oficina o un operador móvil aparecen como una sola dirección, y todos los que están detrás comparten un cupo. Esto es inherente a cualquier límite basado en la dirección; la única mitigación es elegir un número con el que se sienta cómodo. Si alguna vez un oyente informa de que no puede conectar, esto es lo primero que hay que sospechar — mire `grep Refused` antes que nada.

---

## 9. Trampas que conviene conocer

### Nunca un plazo para una conexión inactiva

Ya no existe la clave `handshake_s`, y este es el motivo. Un plazo de 30 segundos para conexiones inactivas parece la defensa obvia frente a un slowloris. Se construyó, se activó y en un minuto produjo esto:

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88` es `etgd-websdr.ewi.utwente.nl` — **el propio equipo de retorno de websdr.org**. Se conecta de vuelta a su servidor y luego permanece inactivo, bastante más de 30 segundos, antes de enviar su `GET /~~orgstatus`. El plazo lo cortaba cada vez y el registro dejó de funcionar. La opción se eliminó en lugar de dejarla disponible: un disparo en el pie que rompe su ficha en el directorio no merece las sesenta líneas que lo implementan.

**El mismo razonamiento vale para `open_handshake_timeout` de websocketpp, que sigue ahí.** El valor de diez minutos en `spectrumserver.cpp` parece absurdo y es estructural: es lo que permite que el retorno de websdr.org pueda estar inactivo. Hay una segunda razón — el manejador de `/~~orgstatus` responde desde un hilo que mantiene un `dup()` del socket, y websocketpp termina una conexión caducada con `shutdown()`, una llamada a nivel de socket que atraviesa el duplicado y rompería el retorno aunque el tiempo de inactividad no fuera un problema.

Si necesita acotar las conexiones silenciosas, acote su número, no su edad. Eso es lo que son `idle_per_ip` e `idle_total`.

### Un fichero de nftables debe ser idempotente

`nft -f` **añade** a una tabla que ya existe en lugar de reemplazarla. Un fichero de reglas sin un preámbulo `delete table` duplica por tanto toda la cadena en cada recarga — que es justo lo que hace una unidad de systemd ingenua en cada reinicio del servicio. `setup-firewall.sh` genera el preámbulo por usted; si escribe sus propias reglas, haga lo mismo.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # debe dar 8, no 16
```

---

## 10. Desactivarlo todo

Los límites del servidor: ponga las claves a `0`, o bórrelas de su `.toml`, y reinicie el receptor. No hay más estado; nada sobrevive a un reinicio.

El cortafuegos:

```bash
sudo ./setup-firewall.sh --remove
```

Eso borra la tabla, elimina el conjunto de reglas guardado y desactiva el servicio de arranque. Su máquina vuelve exactamente al estado en que estaba antes — lo que, en la mayoría de instalaciones, significa sin cortafuegos alguno. Merece la pena pensarlo antes de quitarlo.
