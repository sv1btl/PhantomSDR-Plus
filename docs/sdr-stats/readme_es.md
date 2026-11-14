# Guía de instalación de System Stats

Una guía completa para añadir monitorización de servidor en tiempo real a tu aplicación PhantomSDR mediante el script de instalación automatizado.

## Descripción general

Esta función añade un botón **📊 Stats** a tu interfaz de PhantomSDR que muestra información del sistema en tiempo real:
- Uso de CPU, núcleos, frecuencia, temperatura y procesos principales
- Uso de memoria (usada/total/porcentaje)

Las estadísticas se actualizan automáticamente cada 5 segundos mientras la ventana modal está abierta.

> **No es lo mismo que la página «Gráficos» del panel de administración.** Esta ventana es una instantánea en vivo que se refresca mientras está abierta y no guarda histórico. El panel de administración tiene una página **Gráficos** aparte que muestrea la frecuencia de CPU, la carga, la temperatura y los usuarios conectados cada 2 segundos y los representa en los últimos 15 minutos a 24 horas: véase la [guía del panel de administración](../es/ADMIN_PANEL_SETUP.md).

---

## Requisitos previos

- **Servidor Linux** (se recomienda Ubuntu/Debian)
- **Conexión a Internet** (para descargar Node.js y los paquetes)
- **Acceso Sudo** (para la configuración del servicio systemd)
- **PhantomSDR-Plus** ya instalado y en ejecución
- **lm-sensors** (recomendado para la temperatura de CPU Intel/AMD, instalado automáticamente por el script)

---

## Métodos de instalación

> [!NOTE]
> **El instalador principal ya lo ofrece.** `./install.sh` — y los cuatro instaladores por distribución — ejecutan `install-stats-server.sh` por defecto dentro de la instalación normal de PhantomSDR-Plus, así que en una máquina nueva el servidor de estadísticas suele estar ya en su sitio. Use esta página para instalarlo por separado o para cambiar después su puerto, su dirección o su servicio.

### Opción 1: Instalación automatizada (Recomendada) ⭐

El script automatizado se encarga de todo por ti.

#### Paso 1: Ejecutar el script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANTE:** NO lo ejecutes como root ni con sudo. Ejecútalo como tu usuario normal.

#### Paso 2: Seguir las indicaciones interactivas

El script te guiará a través de:

##### 1. **Instalación de Node.js** (si es necesario)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
El script instala Node.js 22 mediante nvm, en cualquier distribución de Linux: sin root y sin fuente apt. Hace la misma pregunta cuando Node.js está presente pero es anterior a la 22.

##### 2. **Directorio de instalación**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Presiona Enter para el valor predeterminado, o especifica una ruta personalizada.

##### 3. **Configuración del puerto** (¡Mejorada!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Dirección del servidor**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Introduce el dominio público o la dirección IP de tu servidor.

##### 5. **Confirmación**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Configuración del servicio Systemd** (Opcional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recomendado: Elige **y** para que el servidor se inicie automáticamente al arrancar.

#### Paso 3: ¡Instalación completa! ✓

El script mostrará un resumen:
```
Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 9011
  API URL: http://localhost:9011/api/system-stats (inside this computer)

Next steps:

Nothing to edit: configure-station.sh already pointed the receiver page
at /stats, which the proxy on port 9000 carries to this
server. No extra port has to be opened on the router.

╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
╚════════════════════════════════════════════════╝
```

---

## Configura tu aplicación PhantomSDR

En una estación configurada con `install.sh` no hay nada que hacer aquí: las preguntas de la estación ya escribieron `siteStats` como `/stats`, y `proxy.py` lo lleva por el puerto público 9000, así que no se abre ningún otro puerto en el router.

### `site_information.json`

La línea en `site_information.json` tiene este aspecto:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:9000",
  "siteStats": "/stats",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Probar la instalación

### Prueba 1: Verificar el endpoint de la API

```bash
curl http://localhost:9011/api/system-stats
```

Salida esperada (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Prueba 2: Verificar el estado del servicio

Si lo instalaste como servicio:

```bash
sudo systemctl status sdr-stats.service
```

Debería mostrar: `Active: active (running)`

### Prueba 3: Probar en el navegador

1. Abre tu interfaz web de PhantomSDR
2. Desplázate hasta la sección **Additional Info**
3. Haz clic en el botón **Open Additional Info**
4. Busca el botón **📊 Stats** junto a la información del PC
5. Haz clic en él para abrir la ventana modal de estadísticas
6. Verifica que las estadísticas se muestren y se actualicen

---

## Gestión del servicio

Si lo instalaste como servicio systemd, usa estos comandos:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Cambiar el puerto después de la instalación

Ejecute de nuevo `bash configure-station.sh` y dé a las estadísticas un puerto nuevo. El script mueve con él la configuración del servicio y el proxy; la página sigue usando `/stats`, así que no cambia nada más y no se abre nada en el router.

---

## Solución de problemas

### Problema: Puerto ya en uso

**Error:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Solución:**

1. Encuentra qué está usando el puerto:
```bash
sudo lsof -i :9011
```

2. Detén ese proceso:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Inicia el servicio de nuevo:
```bash
sudo systemctl start sdr-stats.service
```

**Alternativa:** Ejecuta el script de instalación de nuevo y elige un puerto diferente cuando se te solicite.

### Problema: El servicio no arranca

**Error:**
```
status=217/USER
```

**Solución:**

1. Comprueba el archivo del servicio:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Verifica que la línea `User=` coincida con tu nombre de usuario:
```bash
whoami
```

3. Edítalo si es necesario:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Recarga y reinicia:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problema: Las estadísticas no se muestran en el navegador

**Síntomas:** La ventana modal se abre pero no hay datos, o muestra valores en 0

**Soluciones:**

1. Comprueba la consola del navegador (F12) en busca de errores
2. Verifica que la API sea accesible:
```bash
curl http://localhost:9011/api/system-stats
```
3. Comprueba que el servicio esté en ejecución:
```bash
sudo systemctl status sdr-stats.service
```
4. Compruebe que `siteStats` en `site_information.json` es `/stats` y que `proxy.py` está en marcha
5. Comprueba los errores de CORS: asegúrate de que el servidor permita tu dominio

### Problema: La temperatura muestra null

**Causa:** La lectura de temperatura no está disponible en tu sistema

**Soluciones:**

1. **Para la mayoría de los sistemas Linux:** Comprueba si existe la zona térmica:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Instala lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Nota:** Es posible que la temperatura no esté disponible en:
- Máquinas virtuales
- Algunos proveedores de VPS
- Windows Subsystem for Linux (WSL)
- Sistemas no Linux

¡Esto es normal! El resto de las estadísticas seguirá funcionando.

### Problema: Node.js no encontrado

**Error:**
```
node: command not found
```

**Solución:**

1. Instala Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Verifica:
```bash
node --version
npm --version
```

---

## Lo que verás

Una vez instalado y configurado, la ventana modal de estadísticas muestra:

### 🖥️ Sección CPU
- **Uso**: Porcentaje de utilización general de la CPU
- **Núcleos**: Cuánta CPU se usa realmente, expresada en núcleos completos —por ejemplo `1.3 / 12 in use` significa que la máquina hace el trabajo de 1,3 núcleos—. Es exacto y no necesita ningún umbral. Deliberadamente no es un recuento de núcleos ocupados: el planificador reparte el trabajo de un núcleo entre muchos, así que ese recuento solo podría aproximar esta cifra.
- **Frecuencia**: Frecuencia actual media de la CPU en todos los núcleos en GHz, con el núcleo más rápido entre paréntesis (si está disponible)
- **Temperatura**: Temperatura de la CPU en grados Celsius (si está disponible), con código de color: 🟢 verde hasta 69 °C, 🟠 naranja 70-79 °C, 🔴 rojo a partir de 80 °C
- **Procesos principales**: Los 5 procesos que más consumen CPU con porcentajes codificados por colores:
  - 🟢 Verde: hasta 50 % de CPU
  - 🟠 Naranja: 51-80 % de CPU
  - 🔴 Rojo: más del 80 % de CPU

### 💾 Sección de memoria
- **Usada**: Memoria en uso (GB)
- **Total**: Memoria total del sistema (GB)
- **Uso**: Porcentaje de uso de memoria (codificado por colores)

### ♻️ Actualización automática
- Las estadísticas se actualizan cada **5 segundos** mientras la ventana modal está abierta
- Deja de actualizarse cuando cierras la ventana modal (ahorra recursos)

---


## Notas de seguridad

- El servidor de estadísticas acepta conexiones de cualquier origen (CORS: *)
- Para producción, considera restringir CORS solo a tu dominio
- La selección de puerto valida la entrada y comprueba conflictos
- La lectura de la temperatura de la CPU es de solo lectura y segura
- No se expone información sensible del sistema

---

## Soporte y recursos

### Desinstalar el servidor de estadísticas:
- Elimina la carpeta /sdr-stats-server
- Si has creado un servicio, simplemente elimínalo usando:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modifica `App.svelte`: Encuentra la parte del código:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  y reemplázala con:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Recompila usando el comando:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Reinicia el PC e inicia el servidor

---

## Referencia rápida de comandos

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:9011/api/system-stats # Test API
curl http://localhost:9011/api/health       # Health check

# Troubleshooting
sudo lsof -i :9011                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

¡Feliz monitorización! 📊🚀
