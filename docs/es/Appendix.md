# Apéndice — Referencia de comandos

Todos los comandos que un sysop usa para operar una estación PhantomSDR-Plus, agrupados por tarea, cada uno con una línea de explicación. Se ejecutan dentro del directorio `PhantomSDR-Plus` salvo que la línea indique otra cosa. La instalación manual paso a paso (dependencias, Node.js, OpenCL, compilación a mano) no se repite aquí — consulte la [Guía de instalación](INSTALLATION.md). La última columna enlaza con la sección que explica el comando; en el PDF le sigue el número de página.

## Instalación y configuración de la estación

| Comando | Qué hace | Ver |
|---|---|---|
| `git clone https://github.com/sv1btl/PhantomSDR-Plus` | Descarga el proyecto. | [README](README.md#instalación) |
| `bash install.sh` | Instalador completo para Ubuntu/Debian: hace las preguntas de la estación, instala y compila. | [Guía de instalación](INSTALLATION.md#clonar-el-repositorio-y-ejecutar-el-instalador) |
| `bash install_fedora.sh` | El mismo instalador para Fedora. | [Guía de instalación](INSTALLATION.md#clonar-el-repositorio-y-ejecutar-el-instalador) |
| `bash install_arch.sh` | El mismo instalador para Arch Linux. | [Guía de instalación](INSTALLATION.md#clonar-el-repositorio-y-ejecutar-el-instalador) |
| `bash install_opensuse.sh` | El mismo instalador para openSUSE. | [Guía de instalación](INSTALLATION.md#clonar-el-repositorio-y-ejecutar-el-instalador) |
| `PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh` | Instalación desatendida (aquí para un RX888 MkII); cada pregunta toma su valor por defecto. | [Guía de instalación](INSTALLATION.md#instalación-desatendida) |
| `chmod +x *.sh` | Vuelve a hacer ejecutables los scripts (por ejemplo tras descomprimir un zip). | [Guía de instalación](INSTALLATION.md#actualizar-a-mano) |
| `bash configure-station.sh` | Asistente de la estación: hace las preguntas, guarda `station.conf` y escribe a partir de él todos los ficheros de configuración. | [Guía de instalación](INSTALLATION.md#las-preguntas-de-la-estación) |
| `bash configure-station.sh --ask` | Pregunta y guarda solo `station.conf`. | [Guía de instalación](INSTALLATION.md#las-preguntas-de-la-estación) |
| `bash configure-station.sh --apply` | Reescribe los ficheros de configuración desde `station.conf` sin preguntar. | [Guía de instalación](INSTALLATION.md#las-preguntas-de-la-estación) |
| `bash configure-station.sh --show` | Muestra las respuestas actuales. | [Guía de instalación](INSTALLATION.md#las-preguntas-de-la-estación) |
| `./add-receiver.sh` | Añade otro receptor (por ejemplo un RTL-SDR para 2 m) junto al principal. | [Guía de instalación](INSTALLATION.md#varios-receptores-en-un-ordenador) |

## Controladores de receptores

| Comando | Qué hace | Ver |
|---|---|---|
| `./setup-rx888-udev.sh` | Instala las reglas udev del RX888 para que funcione sin sudo. | [Guía de instalación](INSTALLATION.md#ejecutar-rx888_stream-sin-sudo-reglas-udev) |
| `./setup-rtlsdr.sh` | Instala el controlador RTL-SDR; pregunta si el stick es un Blog V4. | [Guía de instalación](INSTALLATION.md#varios-receptores-en-un-ordenador) |
| `RTL_V4=y ./setup-rtlsdr.sh` | Instala el controlador RTL-SDR Blog V4 sin preguntar. | [Guía de instalación](INSTALLATION.md#varios-receptores-en-un-ordenador) |
| `./setup-rsp1a.sh` | Instala la cadena de controladores abierta para el SDRplay RSP1A. | [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-airspyhf.sh` | Instala la cadena de controladores del Airspy HF+. | [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-fobos.sh` | Instala la cadena de controladores del RigExpert Fobos. | [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `./setup-hackrf.sh` | Instala el paquete hackrf y su regla udev. | [Guía de instalación](INSTALLATION.md#hackrf-one) |
| `rtl_test` | Comprueba que se detecta el stick RTL-SDR. | [Guía de instalación](INSTALLATION.md#pruebe-el-rtl-sdr) |
| `SoapySDRUtil --find="driver=soapyMiri"` | Comprueba que se detecta el RSP1A (`driver=fobos`, `driver=airspyhf` para los demás). | [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `SoapySDRUtil --info` | Lista los controladores SoapySDR instalados. | [Guía de instalación](INSTALLATION.md#no-se-encuentra-el-fobos-o-el-airspy-hf) |

## Arrancar y detener el receptor

| Comando | Qué hace | Ver |
|---|---|---|
| `./start-rx888mk2.sh` | Arranca (o reinicia) el receptor RX888 MkII con su watchdog y muestra el log hasta que está en marcha. | [README](README.md#funcionamiento-básico) |
| `./start-rtl.sh` | Lo mismo para un RTL-SDR. | [Guía de instalación](INSTALLATION.md#1-prueba-de-arranque) |
| `./start-rsp1a.sh` | Lo mismo para un SDRplay RSP1A. | [README](README.md#funcionamiento-básico) |
| `./start-airspyhf.sh` | Lo mismo para un Airspy HF+. | [README](README.md#funcionamiento-básico) |
| `./start-hackrf.sh` | Lo mismo para un HackRF One. | [README](README.md#funcionamiento-básico) |
| `./start-fobos.sh` | Lo mismo para un Fobos, entrada RF (25–6000 MHz). | [README](README.md#funcionamiento-básico) |
| `./start-fobos-hf.sh` | Lo mismo para un Fobos, muestreo directo HF (0–25 MHz). | [README](README.md#funcionamiento-básico) |
| `./start-all.sh` | Arranca todos los receptores listados en `receivers.toml`. | [Varios receptores](MULTI_RECEIVER.md#5-arrancar-y-detener) |
| `./start-rx888mk2.sh -q` | Cualquier script de arranque con `-q`: dos líneas de salida en lugar del log en vivo. | [README](README.md#funcionamiento-básico) |
| `INSTANCE=vhf ./start-rtl.sh` | Arranca un segundo receptor configurado en `instances/vhf/`. | [Varios receptores](MULTI_RECEIVER.md#3-añadir-un-segundo-receptor) |
| `SPECTRUM_CORES=0-3 ./start-rx888mk2.sh` | Fija el servidor a estos núcleos de CPU (`none` = sin fijar). | [README](README.md#funcionamiento-básico) |
| `RADE_ENABLED=0 ./start-rx888mk2.sh` | Arranca sin el sidecar RADE. | [RADE README](RADE_README.md#control-del-sidecar) |
| `./stop-websdr.sh` | Detiene todos los receptores de esta instalación y su watchdog. | [Guía de instalación](INSTALLATION.md#7-detenga-el-servidor) |
| `./stop-websdr.sh main` | Detiene solo el receptor principal. | [Varios receptores](MULTI_RECEIVER.md#5-arrancar-y-detener) |
| `./stop-websdr.sh vhf` | Detiene solo el receptor arrancado con `INSTANCE=vhf`. | [Varios receptores](MULTI_RECEIVER.md#5-arrancar-y-detener) |
| `tail -f logwebsdr.txt` | Sigue el log del receptor en vivo. | [Guía de instalación](INSTALLATION.md#2-compruebe-si-hay-errores) |

## Arranque al iniciar el sistema

| Comando | Qué hace | Ver |
|---|---|---|
| `bash setup-autostart.sh` | Arranca el receptor al iniciar el sistema (el script indicado en `station.conf`). | [Guía de instalación](INSTALLATION.md#configuración-del-arranque-automático) |
| `bash setup-autostart.sh start-rtl.sh` | Lo mismo, para un script de arranque concreto. | [Guía de instalación](INSTALLATION.md#configuración-del-arranque-automático) |
| `bash setup-autostart.sh start-all.sh` | Lo mismo, para todos los receptores de `receivers.toml`. | [Guía de instalación](INSTALLATION.md#configuración-del-arranque-automático) |
| `bash setup-autostart.sh --status` | Muestra si está instalado y para qué script. | [Guía de instalación](INSTALLATION.md#configuración-del-arranque-automático) |
| `bash setup-autostart.sh --remove` | Deja de arrancarlo al iniciar (el receptor sigue funcionando ahora). | [Guía de instalación](INSTALLATION.md#configuración-del-arranque-automático) |

## Compilar y actualizar

| Comando | Qué hace | Ver |
|---|---|---|
| `./recompile.sh` | Recompila el servidor y/o la página web; pregunta qué compilar. | [Guía de instalación](INSTALLATION.md#actualizar-a-mano) |
| `./recompile.sh --backend` | Recompila solo el servidor. | [Guía de instalación](INSTALLATION.md#actualizar-a-mano) |
| `./recompile.sh --frontend` | Recompila solo la página web (escritorio y /mobile). | [Guía de instalación](INSTALLATION.md#actualizar-a-mano) |
| `./recompile.sh --both` | Recompila ambos. | [Guía de instalación](INSTALLATION.md#actualizar-a-mano) |
| `cd frontend && ./build-all.sh` | Compila la página de escritorio y /mobile. | [Edición de variantes](EDITING_VARIANTS.md#6-después-de-editar--reconstruir) |
| `cd frontend && ./build-default.sh` | Compila solo la página de escritorio. | [Edición de variantes](EDITING_VARIANTS.md#6-después-de-editar--reconstruir) |
| `cd frontend && ./build-mobile.sh` | Compila solo /mobile. | [Edición de variantes](EDITING_VARIANTS.md#6-después-de-editar--reconstruir) |
| `bash update.sh` | Informa de lo que cambiaría una nueva versión y pregunta si actualizar. | [Guía de instalación](INSTALLATION.md#ejecución) |
| `./update.sh --check` | Solo informe, nunca pregunta (para cron; código de salida 10 = hay una actualización). | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --apply` | Actualiza, preguntando por los ficheros que usted mismo editó. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --apply --yes` | Actualiza sin preguntar; se conserva cada fichero que usted editó. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --apply --prune` | Ofrece además borrar los ficheros eliminados en el repositorio. | [Guía de instalación](INSTALLATION.md#ejecución) |
| `./update.sh --from FILE` | Toma la nueva versión de un `.zip`/`.tar.gz` o de una carpeta — sin red. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --ref v5.1.0` | Actualiza a una etiqueta, rama o commit en lugar del árbol actual. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --list-excludes` | Muestra los ficheros que el actualizador nunca toca. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --verbose` | Lista todos los ficheros, no solo los 40 primeros. | [Guía de instalación](INSTALLATION.md#otras-opciones) |
| `./update.sh --restore LAST` | Restaura los ficheros que sobrescribió la última actualización. | [Guía de instalación](INSTALLATION.md#deshacer-una-actualización) |
| `./update.sh --restore 20260923-164530` | Restaura los ficheros de esa ejecución concreta. | [Guía de instalación](INSTALLATION.md#deshacer-una-actualización) |

## Aspecto de la página

| Comando | Qué hace | Ver |
|---|---|---|
| `./waterfall.sh` | Cambia el nivel mínimo por defecto de la cascada; muestra el valor actual y pregunta. | [README](README.md#suelo-de-la-cascada--waterfallsh) |
| `./waterfall.sh -v -15` | Lo fija en −15 dB sin preguntar (`-y` omite también las confirmaciones). | [README](README.md#suelo-de-la-cascada--waterfallsh) |
| `./waterfall.sh -s` | Muestra solo los valores actuales. | [README](README.md#suelo-de-la-cascada--waterfallsh) |
| `./smeter_theme.sh` | Elige el tema por defecto del S-meter desde un menú. | [Edición de variantes](EDITING_VARIANTS.md#las-tres-esferas--y-smeter_themesh) |
| `./smeter_theme.sh vintage` | Aplica ese tema de inmediato y ofrece recompilar. | [Edición de variantes](EDITING_VARIANTS.md#las-tres-esferas--y-smeter_themesh) |
| `./smeter_theme.sh dark --build` | Lo aplica y recompila sin preguntar (`--no-build` omite la compilación). | [Edición de variantes](EDITING_VARIANTS.md#las-tres-esferas--y-smeter_themesh) |
| `./smeter_theme.sh amber --no-reset` | Solo para visitantes nuevos; los existentes conservan el suyo. | [Edición de variantes](EDITING_VARIANTS.md#las-tres-esferas--y-smeter_themesh) |

## Panel de administración y proxy

| Comando | Qué hace | Ver |
|---|---|---|
| `./setup_admin.sh` | Configuración interactiva del panel: puertos, scripts, thermal guard, unidades systemd. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#paso-2--ejecutar-el-script-de-configuración) |
| `./setup_admin.sh --sudoers` | Instala solo la regla sudoers para que las dos unidades se reinicien sin contraseña. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#paso-2--ejecutar-el-script-de-configuración) |
| `./setup_admin.sh --proxy-only` | Instala solo el proxy en el puerto público, para una estación sin panel. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#paso-2--ejecutar-el-script-de-configuración) |
| `./manage_admin.sh start` | Arranca el panel y el proxy (cuando no están bajo systemd). | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-a--manage_adminsh-sin-root-sin-instalar-nada) |
| `./manage_admin.sh stop` | Detiene ambos. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-a--manage_adminsh-sin-root-sin-instalar-nada) |
| `./manage_admin.sh status` | Muestra si están en marcha, con sus PID. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-a--manage_adminsh-sin-root-sin-instalar-nada) |
| `sudo systemctl restart phantomsdr-admin phantomsdr-proxy` | Reinicia panel y proxy bajo systemd (el receptor sigue funcionando). | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#reiniciar-el-panel) |
| `sudo systemctl enable --now phantomsdr-admin` | Arranca el panel ahora y en cada inicio (igual `phantomsdr-proxy`). | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-b--unidades-systemd-arranca-al-inicio-se-reinicia-tras-un-fallo) |
| `sudo systemctl disable --now phantomsdr-admin` | Detiene el panel y deja de arrancarlo al iniciar. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-b--unidades-systemd-arranca-al-inicio-se-reinicia-tras-un-fallo) |
| `systemctl status phantomsdr-admin` | Muestra el estado del panel (sin sudo). | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-b--unidades-systemd-arranca-al-inicio-se-reinicia-tras-un-fallo) |
| `sudo journalctl -u phantomsdr-admin -f` | Sigue el log del panel. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#método-b--unidades-systemd-arranca-al-inicio-se-reinicia-tras-un-fallo) |
| `AUTORUN_CORES=2-3 ./manage_admin.sh start` | Fija el demonio decodificador autorun a estos núcleos de CPU. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#sustitución-manual-de-la-fijación-de-cpu-avanzado) |
| `sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr` | Instala la rotación de los logs del panel, del proxy y de autorun. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#rotación-de-proxylog-y-adminlog) |
| `sudo logrotate -d /etc/logrotate.d/phantomsdr` | Prueba en seco de la rotación de logs. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#rotación-de-proxylog-y-adminlog) |

## Thermal guard

| Comando | Qué hace | Ver |
|---|---|---|
| `python3 thermal_guard.py --once` | Muestra el sensor, el punto de disparo y los umbrales; no actúa. | [Thermal Guard](THERMAL_GUARD.md#2-inicio-rápido) |
| `python3 thermal_guard.py --mode log` | Vigila la temperatura en vivo, solo registrando (Ctrl-C para salir). | [Thermal Guard](THERMAL_GUARD.md#7-funcionamiento-sin-el-panel-de-administración) |
| `python3 thermal_guard.py --mode stop+restart` | Lo ejecuta armado: detiene el receptor con exceso de calor y lo reinicia al enfriarse. | [Thermal Guard](THERMAL_GUARD.md#7-funcionamiento-sin-el-panel-de-administración) |
| `python3 thermal_guard.py --config FILE` | Usa otro fichero de configuración. | [Thermal Guard](THERMAL_GUARD.md#7-funcionamiento-sin-el-panel-de-administración) |
| `./setup-cpufreq-perms.sh` | Permite al guard bajar la frecuencia de la CPU sin ejecutarse como root. | [Thermal Guard](THERMAL_GUARD.md#8-activar-la-fase-throttle-sin-root) |
| `sudo systemctl enable --now thermal-guard` | Ejecuta el guard como servicio propio (solo si no se usa el panel de administración). | [Thermal Guard](THERMAL_GUARD.md#7-funcionamiento-sin-el-panel-de-administración) |

## Conexiones, cortafuegos y HTTPS

| Comando | Qué hace | Ver |
|---|---|---|
| `./setup-firewall.sh --show` | Muestra las reglas del núcleo para límites de conexión; no cambia nada. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ./setup-firewall.sh --check` | Valida las reglas con su núcleo. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ./setup-firewall.sh --apply` | Carga las reglas, con reversión automática a los 60 segundos. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ./setup-firewall.sh --persist` | Vuelve a cargar las reglas en cada inicio. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ./setup-firewall.sh --status` | Muestra los contadores de paquetes de cada regla. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ./setup-firewall.sh --remove` | Elimina todas las reglas. | [Límites de conexión](CONNECTION_LIMITS.md#5-la-protección-en-el-núcleo) |
| `sudo ufw allow 9000/tcp` | Abre el puerto público en el cortafuegos ufw. | [Guía de instalación](INSTALLATION.md#no-se-puede-acceder-desde-otros-dispositivos) |
| `bash setup-https.sh` | Activa HTTPS con un certificado gratuito de Let's Encrypt; HTTP sigue funcionando. | [Acceso seguro (HTTPS)](HTTPS.md#en-una-estación-que-ya-funciona) |
| `bash setup-https.sh --lan` | HTTPS solo dentro de la red local (los navegadores avisan del certificado). | [Acceso seguro (HTTPS)](HTTPS.md#solo-en-la-red-local----lan) |
| `bash setup-https.sh --status` | Muestra si HTTPS está activo y si el certificado responde. | [Acceso seguro (HTTPS)](HTTPS.md#comprobar-y-desactivar) |
| `bash setup-https.sh --remove` | Desactiva HTTPS; el HTTP normal queda como está. | [Acceso seguro (HTTPS)](HTTPS.md#comprobar-y-desactivar) |

## Servicios opcionales

| Comando | Qué hace | Ver |
|---|---|---|
| `./install-stats-server.sh` | Instala el servidor de estadísticas (CPU, temperatura, usuarios). | [Servidor de estadísticas](../sdr-stats/readme_es.md#paso-1-ejecutar-el-script) |
| `sudo systemctl restart sdr-stats.service` | Lo reinicia (igual `start`, `stop`, `status`). | [Servidor de estadísticas](../sdr-stats/readme_es.md#gestión-del-servicio) |
| `sudo journalctl -u sdr-stats.service -f` | Sigue su log. | [Servidor de estadísticas](../sdr-stats/readme_es.md#gestión-del-servicio) |
| `curl http://localhost:3001/api/system-stats` | Comprueba que responde. | [Servidor de estadísticas](../sdr-stats/readme_es.md#prueba-1-verificar-el-endpoint-de-la-api) |
| `./install_rade.sh` | Instala el sidecar RADE / FreeDV (`install_rade_ubuntu22.sh` en Ubuntu 22.04). | [RADE README](RADE_README.md#la-instalación--la-vía-rápida) |
| `./rade.sh start` | Arranca el sidecar RADE con su watchdog. | [RADE README](RADE_README.md#control-del-sidecar) |
| `./rade.sh stop` | Lo detiene junto con su watchdog y sus procesos decodificadores. | [RADE README](RADE_README.md#control-del-sidecar) |
| `./rade.sh restart` | Lo detiene y lo arranca limpiamente. | [RADE README](RADE_README.md#control-del-sidecar) |
| `./rade.sh status` | Muestra si está en marcha. | [RADE README](RADE_README.md#control-del-sidecar) |
| `RADE_CORES_PER_CLIENT=3 ./rade.sh restart` | Lo reinicia dando tres núcleos de CPU a cada oyente. | [RADE README](RADE_README.md#si-los-núcleos-se-saturan-antes-del-codo) |
| `tail -f rade.log` | Sigue el log de RADE. | [RADE README](RADE_README.md#control-del-sidecar) |
| `python3 rade_loadtest.py` | Mide cuántos oyentes RADE soporta esta máquina. | [RADE README](RADE_README.md#requisitos) |
| `./kiwi_install.sh` | Instala la emulación de cliente KiwiSDR (para programas Kiwi como AetherSDR). | [Emulación de cliente KiwiSDR](Aether_config.md#2-instalar-el-puente) |
| `./setup_websdr_relay.sh` | Instala el relay que permite a la recepción en diversidad usar un WebSDR como segundo receptor. | [Diversidad de recepción](RECEIVE_DIVERSITY.md#instalar-el-relé) |

## Control del transceptor (puente TCI)

| Comando | Qué hace | Ver |
|---|---|---|
| `sudo usermod -aG dialout $USER` | Da a su usuario acceso al puerto serie del equipo (vuelva a iniciar sesión después). | [Control del transceptor](RIG_CONTROL.md#linux) |
| `rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f` | Lee la frecuencia del equipo mediante Hamlib — comprueba el enlace CAT (modelo, puerto y velocidad de su equipo). | [Control del transceptor](RIG_CONTROL.md#ejemplo-icom-ic-7300) |
| `cd tci-bridge && node tci-rigctld.mjs` | Ejecuta el puente sobre un `rigctld` ya en marcha. | [Control del transceptor](RIG_CONTROL.md#ejemplo-yaesu-ft-991a) |
| `node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200` | Ejecuta el puente controlando el equipo directamente con `rigctl` (la forma de usarlo en Windows). | [Control del transceptor](RIG_CONTROL.md#ejemplo-yaesu-ft-991a) |

## Comprobaciones y resolución de problemas

| Comando | Qué hace | Ver |
|---|---|---|
| `ss -tlnp` | Lista los puertos en escucha y los programas detrás. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#comandos-manuales-útiles) |
| `sudo lsof -i :9002` | Muestra qué programa ocupa un puerto. | [Guía de instalación](INSTALLATION.md#el-puerto-ya-está-en-uso) |
| `pkill -f admin_server.py` | Termina un panel arrancado a mano (igual `proxy.py`). | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#comandos-manuales-útiles) |
| `sudo fuser -k 3000/tcp` | Libera un puerto ocupado por un programa colgado. | [Configuración del panel de administración](ADMIN_PANEL_SETUP.md#comandos-manuales-útiles) |
| `lsusb` | Lista los dispositivos USB — ¿se ve el receptor? | [Guía de instalación](INSTALLATION.md#no-se-encuentra-el-rtl-sdr) |
| `sudo timedatectl set-ntp true` | Mantiene el reloj sincronizado — los decodificadores FT8/FT4/WSPR lo necesitan. | [Guía de instalación](INSTALLATION.md#meson-setup-se-detiene-con-clock-skew-detected) |

## Scripts internos (no se ejecutan a mano)

| Script | Qué hace | Ver |
|---|---|---|
| `start-*.sh --watchdog` | El watchdog que un script de arranque lanza para sí mismo. | [Guía de instalación](INSTALLATION.md#1-cree-el-archivo-de-servicio) |
| `setup-sdr-common.sh` | Funciones comunes que cargan los instaladores de controladores `setup-*.sh`. | [Estructura del proyecto](PROJECT_STRUCTURE.md#árbol-de-directorios) |
| `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh`, `_relaunch.sh` | La cadena de arranque antigua, conservada para estaciones existentes; los scripts `start-*.sh` la sustituyen. | [Estructura del proyecto](PROJECT_STRUCTURE.md#árbol-de-directorios) |
