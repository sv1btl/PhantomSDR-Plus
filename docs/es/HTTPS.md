# Acceso seguro — https://

Una estación PhantomSDR-Plus puede ser accesible por **https://** además de por http://. El navegador muestra entonces el candado, la conexión va cifrada y los navegadores permiten a la página su mejor camino de audio (el AudioWorklet), que niegan a las páginas http simples. La dirección http sigue funcionando exactamente igual que antes, una junto a la otra.

Lo hace **Caddy**, un pequeño servidor web que se coloca delante del receptor en el puerto 443. Caddy obtiene un certificado gratuito de **Let's Encrypt** para el nombre DNS de su estación y lo renueva solo, cada pocos meses, sin que usted tenga que hacer nada. Si ya tiene un proxy inverso propio que guarda el certificado (nginx, Nginx Proxy Manager, Apache, Traefik …), PhantomSDR-Plus funciona detrás de él — vea más abajo *Su propio proxy inverso*.

---

## Qué necesita

| | |
|---|---|
| **Un nombre DNS** | Let's Encrypt certifica nombres, no direcciones IP sueltas. Basta un nombre gratuito de DNS dinámico (no-ip, DuckDNS, dynu y similares) que apunte a su dirección pública, y la dirección puede cambiar: el nombre la sigue. |
| **Dos puertos más en el router** | Redirija TCP **443** (https) y TCP **80** al ordenador del receptor, además de su puerto público (9000). El puerto 80 solo sirve para demostrar a Let's Encrypt que el nombre es suyo cuando se emite y se renueva el certificado. |
| **Una estación configurada con las preguntas de la estación** | Debe existir `station.conf`. En una estación instalada antes de las preguntas de la estación, ejecute antes una vez `bash configure-station.sh`: propone los puertos que su estación ya usa, así que nada se mueve. |

---

## Activarlo

### Durante la instalación

En las preguntas de la estación, en el grupo **Internet**, elija **2** en la pregunta https:

```
    1  no https
    2  https through Caddy, set up here: a free Let's Encrypt certificate,
       renewed by itself; needs a DNS name above and ports 443 and 80 open
    3  my own reverse proxy (nginx, Nginx Proxy Manager, Apache, Caddy,
       Traefik …) already serves https:// and forwards to this receiver
  https? [1]: 2
```

El instalador instala Caddy, obtiene el certificado y al final muestra las dos direcciones.

### En una estación que ya funciona

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

Lee su nombre DNS de `station.conf`, instala Caddy (de su distribución; en Ubuntu 22.04 del repositorio del propio Caddy), lo dirige al receptor, recompila la página para que enlace su dirección https, reinicia el proxy y espera el certificado. Elegir **2** en la pregunta https de `bash configure-station.sh` hace exactamente lo mismo.

Al terminar:

```
  ✔ https://myname.ddns.net/ is live

  https://myname.ddns.net/   — and http://myname.ddns.net:9000/ as before
```

### Comprobar y desactivar

```bash
bash setup-https.sh --status    # ¿está activo y responde el certificado?
bash setup-https.sh --remove    # desactiva https; http queda exactamente igual
```

El panel de administración muestra lo mismo en **Ajustes → HTTPS**: **🔍 CHECK** en una estación con https, y en una solo http **🔒 SET UP HTTPS**, que comprueba lo que puede y da los comandos de arriba para copiarlos en un terminal. Vea [Panel de administración](ADMIN_PANEL_SETUP.md).

Si más adelante cambia el nombre DNS con `bash configure-station.sh`, Caddy pasa solo al nombre nuevo.

---

## Cómo funciona

```
  visitor ──https──► Caddy :443 ──► proxy.py :9014 (this computer only) ──► spectrumserver, panel, RADE …
  visitor ──http───────────────────► proxy.py :9000 ───────────────────────► the same
```

| Puerto | Qué | Abierto en el router |
|---|---|---|
| 443 | Caddy — https | sí |
| 80 | Caddy — la comprobación del certificado y una redirección a https | sí |
| 9000 | proxy.py — http, como antes | sí |
| 9014 | proxy.py — donde Caddy entrega a los visitantes | no — dentro del ordenador |

---

## Qué cambia para los oyentes

- **Funcionan las dos direcciones.** Los directorios y el mapa de websdr.org siguen mostrando la dirección http; la llamada de retorno de websdr.org y los clientes Kiwi usan http.
- **Mejor audio por https.** Los navegadores dan a una página segura el AudioWorklet, un camino de audio más estable que el que deben usar las páginas http simples.
- **Receive Diversity con socios solo http.** Un navegador no permite a una página https abrir conexiones `ws://` simples, y la mayoría de las estaciones PhantomSDR+ y todo KiwiSDR no ofrecen otra cosa. Desde la página https se llega a ellos, por tanto, a través del relay de diversity de la estación — vea *Receive Diversity por https* más abajo. Los socios que tienen https y los UberSDR se alcanzan directamente.
- **Control del equipo (TCI-CAT).** Las conexiones a `127.0.0.1` en el propio ordenador del oyente están permitidas desde una página https en Chrome, Edge y Firefox actuales. La página solo se conecta cuando el oyente abre **TCI-CAT** o activa **CAT Sync**; entonces Chrome y Edge piden una vez permiso para acceder a programas y dispositivos del propio ordenador o red del oyente. Rechazarlo solo desactiva TCI-CAT.

---

## Receive Diversity por https

Una página https llega a los socios de diversity que solo tienen http — la mayoría de las estaciones PhantomSDR+, todo KiwiSDR — a través del propio relay de la estación, `websdr_relay.py`, el mismo que atiende a los socios WebSDR. El navegador se conecta de forma segura a `wss://myname.ddns.net/relay/…` y el relay continúa por `ws://`. El panel lo hace por sí solo. El relay transporta solo audio de diversity (PhantomSDR+ `/audio`, KiwiSDR `/kiwi/…/SND`), se conecta solo a direcciones públicas y mantiene sus límites habituales. Si no está en marcha, una página https solo llega a socios que tienen https.

Así que, en una estación con https, mantenga el relay activo:

- **Activar https con las preguntas de la estación:** una vez activado https, la pregunta del relay que sigue propone sí — déjelo así, y el relay también se instala y se pone en marcha. `bash setup-https.sh` por sí solo no lo instala.
- **Una estación que ya tiene https:** compruébelo con `systemctl is-active phantomsdr-websdr-relay`. Si no está activo, ejecute `bash setup_websdr_relay.sh`, o `bash configure-station.sh` y responda sí a la pregunta del relay. Detrás del proxy no necesita puerto en el router ni recompilar.
- **Comprobación:** `https://myname.ddns.net/relay/status` responde con unas líneas que empiezan por `"service": "PhantomSDR-Plus WebSDR relay"`.

A través del relay el socio ve la dirección de su estación, no la del oyente, así que un socio con límite por IP cuenta juntos a todos sus oyentes que pasan por el relay. Una estación solo con http no necesita nada de esto: una página http abre conexiones `ws://` y `wss://` directamente.

---

## Solo en la red local — `--lan`

Sin nombre DNS, https puede usarse igualmente dentro de casa:

```bash
bash setup-https.sh --lan
```

Caddy emite entonces su propio certificado para la dirección local y el nombre del ordenador. Los navegadores no conocen ese certificado y avisan la primera vez; acéptelo, o haga que los ordenadores que usa confíen en el certificado raíz de Caddy:

- en el propio ordenador del receptor: `sudo caddy trust`
- en otro ordenador: copie `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` desde el receptor (la ruta exacta la muestra `sudo caddy environ`, en `caddy.AppDataDir`) e impórtelo en el navegador o en el sistema como autoridad de confianza.

---

## Su propio proxy inverso

Si ya tiene un proxy inverso que sirve https:// para sus dominios — nginx, Nginx Proxy Manager, Apache, Caddy, Traefik —, PhantomSDR-Plus funciona detrás de él y no se instala Caddy. Elija **3** en la pregunta https:

```bash
bash configure-station.sh        # pregunta https: 3
```

El asistente pregunta entonces desde dónde se conecta su proxy:

| Su proxy funciona | Respuesta |
|---|---|
| en este ordenador | `127.0.0.1` |
| en otro ordenador | su dirección, p. ej. `192.168.1.20` |
| en Docker en este ordenador (p. ej. Nginx Proxy Manager) | `172.16.0.0/12` |

Varias direcciones se separan con espacios. La respuesta se guarda como `STATION_PROXY_FROM` en `station.conf`, junto a `STATION_HTTPS="external"`, y se conserva en las actualizaciones y en las siguientes ejecuciones del asistente. La página enlaza entonces su dirección https, el relay de diversidad está activo por defecto, y el asistente termina con todo lo que necesita su proxy. Lo vuelve a mostrar en cualquier momento:

```bash
bash configure-station.sh --proxy-guide
```

En resumen:

- **Un sitio, un puerto.** Reenvíe `https://su.nombre/` — entero — a `http://<este ordenador>:9014/`. La página, `/admin`, `/stats`, `/rade`, `/drm` y `/relay` pasan todos por esa única dirección.
- **WebSockets activos.** Audio, cascada y chat son WebSockets: el proxy debe pasar `Upgrade` y `Connection` y permitir conexiones que sigan abiertas un día. En Nginx Proxy Manager marque **Websockets Support**.
- **La dirección del visitante** en `X-Forwarded-For` (la mayoría de los proxies la añaden solos). El puerto 9014 cree esa cabecera solo de las direcciones que indicó; cualquier otra dirección recibe **403**, así nadie puede hacerse pasar por otro.
- **Mantenga internos** del 9001 al 9015: nunca los reenvíe en el router. Reenvíe el 443 (y el 80, si su proxy obtiene su certificado por él) a su proxy, y mantenga también reenviado el 9000 para http:// — lo usan websdr.org, sdr-list y los socios de diversidad que solo tienen http.

Para nginx, dentro del bloque `server { … }` de su sitio https (con el proxy en otro ordenador, escriba la dirección de este ordenador en lugar de `127.0.0.1`):

```nginx
location / {
    proxy_pass http://127.0.0.1:9014;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1d;
}
```

Para Apache 2.4.47 o posterior (con `mod_proxy`, `mod_proxy_http` y `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket timeout=86400
ProxyPassReverse / http://127.0.0.1:9014/
```

Caddy: `su.nombre { reverse_proxy 127.0.0.1:9014 }`. Traefik: un servicio con la URL `http://127.0.0.1:9014`; los WebSockets pasan solos.

Después compruébelo desde el ordenador del receptor:

```bash
bash setup-https.sh --status
```

Comprueba que el puerto 9014 escucha, que `https://su.nombre/` responde, que un WebSocket atraviesa su proxy y que los ajustes de la página no contienen ninguna dirección http:// de la estación (una página https no puede cargarla: contenido mixto). **🔍 CHECK** del panel de administración muestra lo mismo.

Si `bash setup-https.sh` encuentra otro servidor web en el puerto 443 u 80, no se apodera de él: se detiene y remite aquí.

---

## Solución de problemas

| Síntoma | Qué comprobar |
|---|---|
| `no certificate yet` | El nombre DNS debe apuntar a su dirección pública (`ping myname.ddns.net` desde fuera de su red), y el router debe redirigir 443 y 80 a este ordenador. Caddy sigue intentándolo solo; su log: `sudo journalctl -u caddy -n 50`. |
| El proveedor bloquea el puerto 80 | Caddy también demuestra el nombre solo por el 443, así que en la mayoría de los casos basta el 443; deje el 80 redirigido si puede. |
| `too many failed authorizations` en el log de Caddy | Let's Encrypt permite pocos fallos por hora. Corrija la causa, espere una hora y luego `sudo systemctl restart caddy`. |
| El log de Caddy muestra `Invalid response … /.well-known/acme-challenge/…` (un 502 o la página del receptor) o `Timeout during connect` | El router envía el 80 o el 443 a otro sitio — a menudo al puerto público del receptor. Las reglas deben ser TCP 80 → este ordenador, puerto **80**, y TCP 443 → este ordenador, puerto **443**; desactive la administración remota del propio router en esos puertos. Después `sudo systemctl restart caddy` para que lo intente de nuevo enseguida. |
| https funciona en casa pero no desde fuera | El router redirige el 443 a otro ordenador, o no lo redirige. |
| La lista de oyentes o el panel de usuarios están vacíos por https | Ejecute una vez `bash configure-station.sh` y responda sí a la recompilación: la página debe conocer su dirección https. |
| `Port 443 is already used by another web server` | Vea arriba *Su propio proxy inverso*. |
| Detrás de su propio proxy: la página carga, pero sin audio ni cascada | El proxy no pasa WebSockets. nginx: las líneas `Upgrade` y `Connection`; Nginx Proxy Manager: **Websockets Support**. `bash setup-https.sh --status` lo prueba. |
| Detrás de su propio proxy: `forbidden: not the station's https front` | Su proxy se conecta desde una dirección que no está en `STATION_PROXY_FROM` — Docker usa redes propias (`172.16.0.0/12`). Ejecute `bash configure-station.sh` y añádala. |
| Detrás de su propio proxy: todos los oyentes tienen la misma dirección, o el cuarto es rechazado | El proxy reenvía al 9000 en lugar del 9014, o no envía `X-Forwarded-For`. |
