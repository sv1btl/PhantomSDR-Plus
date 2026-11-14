# Emulación de clientes KiwiSDR

**Conectar AetherSDR, kiwiclient y otro software KiwiSDR a PhantomSDR-Plus**

Desde la v4.1.0 PhantomSDR-Plus también puede responder al **protocolo KiwiSDR**, de modo que el software escrito para un KiwiSDR — **AetherSDR**, `kiwiclient` y los demás — se conecta directamente a su receptor. Es un puente dentro del mismo proceso del servidor, en el mismo host y el mismo puerto que ya publica: sin un segundo servicio, sin un segundo puerto, sin proxy.

**Está apagado hasta que usted lo active.** Nada del puente se ejecuta — ni un socket, ni una comprobación — mientras `[kiwi_emulation]` falte o sea `false`, que es el estado de un árbol recién instalado.

---

## Índice

1. [Qué obtiene un cliente Kiwi](#1-qué-obtiene-un-cliente-kiwi)
2. [Instalar el puente](#2-instalar-el-puente)
3. [Activarlo](#3-activarlo)
4. [Referencia de configuración](#4-referencia-de-configuración)
5. [Conectar un cliente](#5-conectar-un-cliente)
6. [Nivel de audio](#6-nivel-de-audio)
7. [El S-meter](#7-el-s-meter)
8. [Cascada y espectro](#8-cascada-y-espectro)
9. [Si algo no funciona bien](#9-si-algo-no-funciona-bien)

---

## 1. Qué obtiene un cliente Kiwi

| | |
|---|---|
| **Audio** | `ws://<host>:<port>/kiwi/<id>/SND` (también `ws://<host>:<port>/<id>/SND`) — audio demodulado en el formato SND propio del Kiwi |
| **Cascada** | `ws://<host>:<port>/kiwi/<id>/W/F` (también `ws://<host>:<port>/<id>/W/F`) — el espectro, en tramas W/F del Kiwi |
| **Sintonía** | real, no cosmética: `SET mod=…` desde el cliente cambia frecuencia, banda lateral y ancho de paso en el lado de PhantomSDR, exactamente como lo haría un oyente desde el navegador |
| **S-meter** | alimentado por la potencia por bloque del propio demodulador, en la misma escala que el S-meter web |
| **IQ** | `SET mod=iq` da 12 kHz de I/Q en las tramas estéreo del Kiwi, como las espera `kiwirecorder.py -m iq`. Sin marcas de tiempo GPS, así que no sirve para TDoA. Solo mientras `[server] iq` esté activado (el valor por defecto) |

La sintonía se admite para una entrada **real** (`signal = "real"` en su `.toml`). Con una entrada IQ la relación entre bin y frecuencia es distinta y no está implementada, así que un receptor IQ servirá audio y cascada pero no seguirá la sintonía de un cliente Kiwi.

---

## 2. Instalar el puente

**Con el instalador.** `install.sh` (y `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) tienen un paso propio para ello — el paso 17, *Kiwi client emulation*. Se ofrece, no se impone: responda `n` y no se parchea nada. Para una ejecución desatendida lo decide `PHANTOM_KIWI=y|n`, y por omisión es sí.

**En un árbol ya instalado**, ejecute el script que viene en la raíz del repositorio:

```bash
cd ~/PhantomSDR-Plus
./kiwi_install.sh
./recompile.sh          # elija [1] Solo backend
```

> **Si acaba de aplicar un archivo de actualización que ya contiene el puente, no necesita ejecutarlo.** Las fuentes parcheadas vienen en el paquete; `kiwi_install.sh` solo le diría que cada parche ya está puesto.

---

## 3. Activarlo

Añada esto al `.toml` con el que realmente arranca su receptor — el mismo archivo que pasa a `spectrumserver`, el que nombra su `start-<radio>.sh`. No `config.example.*`:

```toml
[kiwi_emulation]
enabled = true
```

Después reinicie el receptor:

```bash
./stop-websdr.sh
./start-<su-radio>.sh
```

`kiwi_install.sh` añade el bloque por usted, con `enabled = true`, a los que existan de entre `config.toml`, `config-rx888mk2.toml`, `config-airspyhf.toml`, `config-rtl.toml`, `config-rsp1a.toml`, `config-fobos.toml`, `config-fobos-hf.toml` y `config-hackrf.toml` en la raíz del repositorio. No puede saber de una configuración que usted guarde en otro sitio o con otro nombre, y **los archivos de actualización nunca incluyen un `.toml`**, así que tras una actualización el bloque le corresponde ponerlo a mano. Los `config.example.*.toml` que se distribuyen lo llevan documentado y en `false`.

---

## 4. Referencia de configuración

Todo lo que el puente lee vive en una única sección `[kiwi_emulation]`. Solo `enabled` es obligatorio; los cuatro ajustes finos tienen por omisión el valor calibrado, así que un bloque con solo `enabled = true` ya es correcto.

| Clave | Por omisión | Qué hace |
|---|---|---|
| `enabled` | `false` | Responder al protocolo KiwiSDR. Apagado = completamente inerte. |
| `audio_gain` | `0` | dB. Ganancia de salida, solo para clientes Kiwi. Véase [Nivel de audio](#6-nivel-de-audio). |
| `smeter_offset` | `input.analog_smeter_offset` | dB. Sustituye el desplazamiento del S-meter, solo para clientes Kiwi. Véase [El S-meter](#7-el-s-meter). |
| `wf_cal` | `0` | dB. Ajuste de visualización para la cascada y el espectro. Véase [Cascada y espectro](#8-cascada-y-espectro). |
| `wf_fps_max` | `23` | Cuadros de cascada por segundo. Véase [Cascada y espectro](#8-cascada-y-espectro). |

Un bloque completo, con los valores con los que funciona el receptor de este proyecto:

```toml
[kiwi_emulation]
enabled       = true
audio_gain    = 60.0    # dB, solo clientes Kiwi. 0 = sin tocar.
wf_cal        = -10.0   # dB, cuestión de gusto. 0 = concuerda con el S-meter.
wf_fps_max    = 28      # cuadros/s. 23 es el máximo del protocolo.
# smeter_offset = 5.0   # dB. Por omisión, input.analog_smeter_offset.
```

> **Todas estas claves se leen al arrancar.** Cambiar cualquiera de ellas es un **reinicio**, no una recompilación — `./stop-websdr.sh` y luego su script de arranque. Nunca hace falta recompilar para reajustarlas.

---

## 5. Conectar un cliente

Apunte el cliente a la misma dirección y puerto que usan sus oyentes — sin ruta, sin prefijo. AetherSDR pide un host y un puerto; `kiwiclient` toma `-s` y `-p`:

```bash
# kiwiclient, grabando 30 segundos de 7100 kHz LSB
python3 kiwirecorder.py -s su.receptor.example -p 8073 -f 7100 -m lsb --tlimit=30

# 30 segundos de I/Q alrededor de 6030 kHz, guardados como WAV estéreo
python3 kiwirecorder.py -s su.receptor.example -p 8073 -f 6030 -m iq --tlimit=30
```

El cliente sintoniza, la cascada se llena y el S-meter marca. Si no ocurre absolutamente nada, el puente casi con seguridad sigue desactivado — véase la [sección 3](#3-activarlo).

---

## 6. Nivel de audio

Lo primero que casi todo el mundo nota es que un cliente Kiwi suena más delgado que la página web de PhantomSDR. No es que el puente pierda nada: un solo búfer alimenta a todos los codificadores, y la misma frecuencia con el mismo ancho de paso, medida por la ruta de audio del navegador y por `/SND`, da muestras idénticas. La página web suena fuerte porque `audio.js` reconstruye el sonido en el navegador — realce de graves, filtro de paso de banda, realce de presencia, un compresor con ganancia de compensación y el control de volumen. Un cliente Kiwi no tiene nada de eso y no se le puede dar.

`audio_gain` cierra esa diferencia, solo para clientes Kiwi:

```toml
[kiwi_emulation]
enabled    = true
audio_gain = 55.0       # dB, solo clientes Kiwi. 0 = sin tocar.
```

**Empiece alrededor de 55–60 dB.** 55 dB no es aritmética: es donde un cliente Kiwi y la página web de PhantomSDR se midieron al mismo nivel, escuchando una señal local fuerte en 729 kHz. En la práctica se suele preferir un poco más — este receptor se quedó en 60 — así que elíjalo de oído.

Nada de esto toca la página web, y nada de esto mueve el S-meter — este se deriva de la potencia del demodulador, no de las muestras de audio, así que subir el volumen no puede hacer mentir al instrumento.

---

## 7. El S-meter

El S-meter del Kiwi no se calibra por separado: reproduce lo que muestra su página web, etapa por etapa. La potencia por bloque del demodulador es el punto de partida para ambos, y la página aplica después `input.analog_smeter_offset`, expande el resultado alrededor de −130 dBm y añade su propio desplazamiento de visualización. El puente hace lo mismo, de modo que un cliente Kiwi y la página muestran la misma señal con la misma intensidad — verificado en una emisora local fuerte, donde ambos marcaron −37 dBm.

Si, y solo si, quiere que los clientes Kiwi marquen distinto que su página, dele al puente un desplazamiento propio:

```toml
[kiwi_emulation]
enabled       = true
smeter_offset = 5.0     # sustituye a input.analog_smeter_offset solo para clientes Kiwi
```

---

## 8. Cascada y espectro

### La escala en dB — `wf_cal`

Cada bin de la cascada se convierte a dBm reales antes de enviarse, en la misma escala a la que está calibrado el S-meter. Por tanto una portadora marca **el mismo nivel en todos los niveles de zoom**, que es lo que da un KiwiSDR auténtico, y el espectro concuerda con el propio S-meter de la página web sobre el mismo ancho de paso.

```toml
[kiwi_emulation]
enabled = true
wf_cal  = 0.0           # dB, solo clientes Kiwi
```

Para comprobar la escala, compare la cascada sumada sobre el ancho de paso con el S-meter en una frecuencia **tranquila**. Sobre una portadora, un ancho de paso SSB excluye la propia portadora y ambos no son comparables.

### La tasa de cuadros — `wf_fps_max`

Un cliente Kiwi pide la cascada más rápida que puede tener (`SET wf_speed=4`) y acompasa su desplazamiento — y el promediado de su espectro — a la tasa que el servidor dice que va a entregar. Si las dos no coinciden, la pantalla parece lenta aunque en realidad nada llegue tarde.

```toml
[kiwi_emulation]
enabled    = true
wf_fps_max = 23         # cuadros por segundo
```

`23` es el máximo que declara el propio protocolo KiwiSDR y el valor por omisión seguro. **Siempre gana el menor entre `wf_fps_max` y la tasa propia del receptor**, así que subirlo solo hace algo si su FFT es lo bastante rápida como para tener cuadros de sobra. Ejemplo, para un receptor a 60 Mmuestras/s con una FFT de 4194304 puntos — `2 × 60000000 / 4194304 = 28,6` cuadros por segundo:

| `wf_fps_max` | entregado |
|---|---|
| ausente (por omisión 23) | 23,0 fps |
| `28` | 28,0 fps |
| `40` | 28,6 fps — gana el techo propio del receptor |

---

## 9. Si algo no funciona bien

Cada orden que envía un cliente Kiwi se escribe en **`/tmp/kiwi_retune.log`** — las peticiones de sintonía, los cambios de modo, la autenticación y todo lo que el puente no haya reconocido. No cuesta nada medible y está pensado para dejarlo ahí. Cuando un cliente se comporta de forma extraña, ese archivo muestra qué pidió realmente, que suele ser toda la respuesta.

| Síntoma | Mire |
|---|---|
| El cliente conecta y cae de inmediato | falta `[kiwi_emulation] enabled = true` en la configuración con la que se **arrancó** el servidor |
| Sin audio, sin cascada, sin líneas de registro | el backend no se recompiló tras `kiwi_install.sh` — ejecute `./recompile.sh`, opción `[1]` |
| `kiwi_install.sh` se detiene en un parche | el mensaje nombra el archivo y el anclaje; el árbol ha divergido de lo que el parche espera, y ese archivo quedó intacto |
| Hay audio, pero delgado y bajo | es lo esperado — ponga `audio_gain`, véase la [sección 6](#6-nivel-de-audio) |
| La cascada se desplaza lenta | `wf_fps_max`, véase la [sección 8](#8-cascada-y-espectro) |
| Sintonizar en el cliente no hace nada | una entrada IQ (`signal = "iq"`); la sintonía solo está implementada para entradas reales |
| Un ajuste cambiado no surtió efecto | estas claves se leen al arrancar — reinicie el receptor |

> **El AGC es cosa del cliente.** `SET agc=` desde un cliente Kiwi se acepta y se ignora — el audio llega con el AGC propio de PhantomSDR aplicado, y los controles de AGC del cliente actúan sobre lo que recibe.

---

**Véase también:** [Guía de instalación](INSTALLATION.md) · [Estructura del proyecto](PROJECT_STRUCTURE.md) · [Guía del usuario](USER_GUIDE.md)
