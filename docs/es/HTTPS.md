# Acceso seguro — https://

Una estación PhantomSDR-Plus puede ser accesible por **https://** además de por http://. El navegador muestra entonces el candado, la conexión va cifrada y los navegadores permiten a la página su mejor camino de audio (el AudioWorklet), que niegan a las páginas http simples. La dirección http sigue funcionando exactamente igual que antes, una junto a la otra.

Lo hace **Caddy**, un pequeño servidor web que se coloca delante del receptor en el puerto 443. Caddy obtiene un certificado gratuito de **Let's Encrypt** para el nombre DNS de su estación y lo renueva solo, cada pocos meses, sin que usted tenga que hacer nada.

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

En las preguntas de la estación, en el grupo **Internet**, responda sí a:

```
  Also serve the receiver over https://? [y/N]: y
```

El instalador instala Caddy, obtiene el certificado y al final muestra las dos direcciones.

### En una estación que ya funciona

```bash
cd ~/PhantomSDR-Plus
bash setup-https.sh
```

Lee su nombre DNS de `station.conf`, instala Caddy (de su distribución; en Ubuntu 22.04 del repositorio del propio Caddy), lo dirige al receptor, recompila la página para que enlace su dirección https, reinicia el proxy y espera el certificado. Responder sí a la pregunta https de `bash configure-station.sh` hace exactamente lo mismo.

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

Caddy llega al proxy por un puerto propio porque, visto desde el proxy, todo visitante que pasa por Caddy parecería venir del propio ordenador, y a una petición del propio ordenador se le concede confianza: puede desconectar oyentes y no cuenta para los límites por IP. En el puerto 9014 el proxy toma de Caddy la dirección real del visitante y nunca trata a un visitante como local, de modo que la lista de oyentes, los límites por IP y el kick del sysop funcionan exactamente igual que por http, y nadie puede expulsar a un oyente por https.

---

## Qué cambia para los oyentes

- **Funcionan las dos direcciones.** Los directorios y el mapa de websdr.org siguen mostrando la dirección http; la llamada de retorno de websdr.org y los clientes Kiwi usan http.
- **Mejor audio por https.** Los navegadores dan a una página segura el AudioWorklet, un camino de audio más estable que el que deben usar las páginas http simples.
- **Receive Diversity con socios solo http.** Un navegador no permite a una página https abrir conexiones `ws://` simples, así que desde la página https no se puede añadir una estación socia que solo tenga http; los socios con https funcionan, y los socios WebSDR funcionan a través del relay. Para un socio solo http, use la dirección http de la página.
- **Control del equipo (TCI-CAT).** Las conexiones a `127.0.0.1` en el propio ordenador del oyente están permitidas desde una página https en Chrome, Edge y Firefox actuales.

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

## Ya hay un servidor web en este ordenador

Si nginx, Apache u otra configuración de Caddy usan ya el puerto 443 o el 80, `setup-https.sh` no se los quita: se detiene y muestra qué añadir a su servidor. Para nginx, dentro del bloque `server { … }` de su sitio https:

```nginx
location / {
    proxy_pass http://127.0.0.1:9014;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1d;
}
```

Para Apache (con `mod_proxy`, `mod_proxy_http` y `mod_proxy_wstunnel`):

```apache
ProxyPass        / http://127.0.0.1:9014/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:9014/
```

Después marque la estación como https en `station.conf`, para que el proxy abra el puerto 9014 y la página enlace su dirección https; el asistente volverá a decir que el puerto está ocupado, lo cual es lo esperado:

```bash
STATION_HTTPS=y bash configure-station.sh
```

---

## Solución de problemas

| Síntoma | Qué comprobar |
|---|---|
| `no certificate yet` | El nombre DNS debe apuntar a su dirección pública (`ping myname.ddns.net` desde fuera de su red), y el router debe redirigir 443 y 80 a este ordenador. Caddy sigue intentándolo solo; su log: `sudo journalctl -u caddy -n 50`. |
| El proveedor bloquea el puerto 80 | Caddy también demuestra el nombre solo por el 443, así que en la mayoría de los casos basta el 443; deje el 80 redirigido si puede. |
| `too many failed authorizations` en el log de Caddy | Let's Encrypt permite pocos fallos por hora. Corrija la causa, espere una hora y luego `sudo systemctl restart caddy`. |
| https funciona en casa pero no desde fuera | El router redirige el 443 a otro ordenador, o no lo redirige. |
| La lista de oyentes o el panel de usuarios están vacíos por https | Ejecute una vez `bash configure-station.sh` y responda sí a la recompilación: la página debe conocer su dirección https. |
| `Port 443 is already used by another web server` | Vea arriba *Ya hay un servidor web en este ordenador*. |
