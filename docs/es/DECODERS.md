# PhantomSDR-Plus — Manual del usuario de los decodificadores

Esta guía cubre todos los decodificadores integrados disponibles en PhantomSDR-Plus. Todos los decodificadores comparten el mismo procedimiento de activación, descrito a continuación, seguido de las instrucciones de configuración de cada uno.

---

## Índice

1. [Cómo iniciar un decodificador](#1-cómo-iniciar-un-decodificador)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — código Morse](#5-cw--código-morse)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [FAX de HF / WEFAX](#8-fax-de-hf--wefax)
9. [NAVTEX](#9-navtex)
10. [FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet y APRS](#10-fldigi--ale-2g-rtty-psk31-olivia-fst4w-mfsk-msk144-dominoex-thor-throb-hellschreiber-mt63-packet-y-aprs)
11. [SSTV](#11-sstv)
12. [SERVICES](#12-services)
13. [DRM](#13-drm)
14. [Consejos generales](#14-consejos-generales)

---

## 1. Cómo iniciar un decodificador

Se accede a todos los decodificadores desde la sección **Decoder Options**, situada bajo los controles del espectrograma de audio en el panel principal.

**Pasos:**

1. Haga clic en el botón **Decoder: OFF** para cambiarlo a **Decoder: ON** (se vuelve azul cuando está activo).
2. Abra el menú desplegable que aparece a la derecha del botón y seleccione el decodificador que desee.
3. El panel del decodificador elegido aparecerá bajo los controles; siga las instrucciones específicas de ese decodificador en la sección correspondiente de esta guía.
4. Para detener la decodificación, seleccione **— Select decoder —** en el desplegable, o haga clic en el botón **Decoder: ON** para volver a ponerlo en OFF.

### Botones de decodificador de una pulsación

El desplegable no es la única vía. El panel principal incluye una fila de botones **Decoders** — justo debajo de **Wheel Tuning Steps** — con un botón por decodificador:

| Botón | Decodificador | Botón | Decodificador |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **FLDIGI** | ALE 2G HAM, RTTY, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (aviones), FSK marítimo / SITOR, RTTY meteorológico, RTTY naval (PBB), DSC (barcos), Time Signals (señales horarias), HF Selcall, ALE 2G |
| **WSPR** | WSPR | **DRM** | DRM — radiodifusión digital |

Pulsar un botón hace toda la secuencia de una vez: selecciona el decodificador, pone el decodificador en ON y desplaza su ventana hasta hacerla visible. El botón se pone azul mientras su decodificador funciona. **Pulse el mismo botón otra vez para detener el decodificador**: su ventana se cierra con él.

Los botones, el desplegable y el botón ON/OFF gobiernan el mismo estado, así que use el que use, los demás lo siguen.

### Iniciar un decodificador desde un marcador de frecuencia

Un marcador de frecuencia (las etiquetas amarillas sobre la cascada, de `markers.json`) normalmente sintoniza el receptor y pone el modo que lleva escrito. Cuando ese modo es el nombre de un modo digital, pulsar el marcador inicia en su lugar el decodificador correspondiente, exactamente como si hubiera pulsado su botón:

| Modo del marcador | Inicia | La frecuencia del marcador es |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | ese decodificador | la frecuencia del dial |
| `NAVTEX` | NAVTEX | la frecuencia de la señal (el dial baja 500 Hz) |
| `FAX`, `WEFAX` | HF FAX | el centro publicado (el dial baja 1900 Hz) |
| `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR` | FLDIGI como RTTY de aficionado (`RTTY`); SERVICES en RTTY meteorológico, RTTY naval (PBB CARB) o FSK marítimo / SITOR | la frecuencia de la señal (el dial baja el centro de audio del panel) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI en esa variante | como arriba |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI en esa variante y ese submodo | como arriba |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI en esa variante y ese submodo | como arriba |
| `PACKET`, `APRS` | FLDIGI en esa variante | el canal; 300 Bd (USB) por debajo de 30 MHz, 1200 Bd (FM) por encima |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 en banda lateral superior / inferior (`RADE` y `FREEDV` significan superior) | la frecuencia del dial |
| `RADE2` | FreeDV RADE V2 (beta), siempre banda lateral superior | la frecuencia del dial |
| `HFDL` | SERVICES · HFDL | la frecuencia del dial (USB; la señal HFDL está 1440 Hz por encima) |
| `DSC`, `SELCALL` | SERVICES en DSC o HF Selcall | la frecuencia DSC o el canal Selcall (el dial va 1,7 kHz por debajo) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES en Time Signals, con esa estación | la portadora (el dial va 1 kHz por debajo) |
| `ALE` | FLDIGI en ALE 2G HAM en un canal HFLINK, si no SERVICES en ALE 2G | la frecuencia del dial (LSB en las redes que lo usan) |
| `DRM` | DRM | el centro del canal DRM |
| `MORSE` | el decodificador CW, con CW y un filtro de ±250 Hz | la frecuencia de la señal |

> Solo puede haber un decodificador activo a la vez. Cambiar a otro decodificador detiene automáticamente el anterior.
>
> El **grabber QRSS** no forma parte de este menú desplegable: tiene su propia sección **QRSS** y puede funcionar al mismo tiempo que un decodificador.

**Un decodificador en marcha manda sobre el modo y el paso de banda.** Normalmente el modo sigue el plan de bandas de `bands-config.js`: lleve el dial a un segmento marcado LSB o AM y el receptor cambia a él. Mientras un decodificador está en marcha eso ya no ocurre. El decodificador mantiene el modo que necesita (USB en casi todos, el suyo propio en RADE) y el paso de banda que necesita —PSK31 unos ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber y MT63 todo su ancho, RTTY su shift— y ambos sobreviven a la resintonía, incluso a un salto a otra banda. Sin esto, sintonizar FT8 en 40 m pasaría el receptor a LSB en cuanto se moviera el dial, y los pasos de banda estrechos de los decodificadores se abrirían de nuevo al filtro SSB completo.

### Decoder ID — reconocer el modo automáticamente

Sobre los botones de decodificador se encuentra el marco **Decoder ID**. Responde a la pregunta *«¿qué estoy escuchando?»* cuando encuentre una señal digital que no sepa identificar, y a continuación le ofrece el decodificador adecuado con un solo clic.

Está **desactivado de forma predeterminada** y no consume nada mientras está apagado. Pulse **On** y deje la señal sintonizada. Durante aproximadamente medio minuto muestra *Listening…* con una barra de progreso — las medidas de temporización necesitan ver dos ciclos completos de FT8 antes de tener sentido — y después nombra el modo:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* El **modo** y una cifra de **confianza**. Verde por encima del 75 %, ámbar por encima del 50 %, naranja por debajo — trate una respuesta naranja como una pista, no como un veredicto.
* **Lo que realmente se midió**: ancho de banda ocupado, separación de tonos, velocidad de símbolo, duración de la ráfaga, la rejilla UTC a la que se ajusta, relación señal/ruido. Ésta es la evidencia detrás del veredicto, para que pueda juzgar usted mismo.
* **Use <modo>** arranca el decodificador correcto, exactamente como si hubiera pulsado su botón — y prepara el receptor para trabajar ese modo. Para los modos que viven en el panel FSK además selecciona la variante correcta — RTTY, PSK31 u Olivia en FLDIGI, Weather RTTY en SERVICES.
* Los candidatos siguientes aparecen tras **or**. Pulse uno para probarlo, de modo que una primera respuesta equivocada no le cuesta nada.
* **📻** significa que la frecuencia en la que está sintonizado es una frecuencia de llamada conocida para ese modo, y que eso contó en la clasificación.

Nunca cambia su decodificador por sí solo. Únicamente sugiere. Y en cuanto arranca un decodificador — desde la fila de botones, desde la lista desplegable o desde el propio botón **Use** de Decoder ID — Decoder ID se apaga solo: su tarea era elegir uno, y ahora el decodificador quiere ese mismo audio.

**Qué reconoce:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY a 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV y DSC. **Use DSC** y la propuesta Weather RTTY inician SERVICES en ese servicio (capítulo 12).

---

## 2. FT8

**Qué es:** FT8 es un modo digital de señal débil muy popular entre los radioaficionados de todo el mundo. Las transmisiones duran exactamente 15 segundos y el protocolo puede copiar señales hasta 20-25 dB por debajo del nivel de ruido. Es el modo más utilizado para contactos a larga distancia (DX).

### Frecuencias recomendadas (USB)

| Banda | Frecuencia |
|-------|------------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Configuración

1. Sintonice una de las frecuencias de FT8 indicadas arriba y ponga el modo en **USB**.
2. Active el decodificador y seleccione **FT8** en el desplegable. O basta con pulsar el botón **FT8**.
3. El panel **FT8 Messages** aparece automáticamente debajo.

### Lectura de la salida

La lista de mensajes muestra las transmisiones decodificadas a medida que llegan. Cada ciclo de 15 segundos produce un nuevo lote de mensajes. El campo **Farthest** (arriba a la derecha del panel) indica la mayor distancia decodificada en la sesión actual, en kilómetros. Un mensaje largo termina en «…»: haga clic en su fila para leer el mensaje completo, en varias líneas, y otra vez para cerrarlo. Mientras una fila está abierta, la lista se queda donde está; si no, sigue los mensajes más recientes. FT4 y FT2 usan la misma lista.

Formato de mensaje típico: `CQ DX AA1BB FN31` — una llamada CQ del indicativo AA1BB situado en el cuadrante FN31.

> **Consejo:** FT8 está estrechamente sincronizado en el tiempo. Su navegador usa el reloj del ordenador; si el reloj del sistema se desvía más de un par de segundos, la decodificación fallará. Mantenga la hora del sistema sincronizada por NTP.

---

## 3. FT4-FT2

**Qué es:** FT4 es una variante más rápida de FT8 diseñada para operar en concursos. Cada ciclo de transmisión dura 7,5 segundos (la mitad que FT8), lo que lo hace el doble de rápido pero exige una señal algo más fuerte. FT2 es una variante aún más rápida de FT8. Es un modo ultrarrápido de 77 bits con periodos TR de 3,75 segundos (= la mitad que FT4); todavía experimental.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Banda | Frecuencia FT2|
|-------|-----------|
|160 m | 1.843 a 1.846 |
|80 m   | 3.578 a 3.581 |
|60 m   | 5.360 (consulte la normativa regional local) |
|40 m   | 7.052 a 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Configuración

1. Sintonice una frecuencia de FT4 y ponga el modo en **USB**.
2. Active el decodificador y seleccione **FT4** o **FT2** en el desplegable. O basta con pulsar el botón **FT4** / **FT2**.
3. El panel **FT4 Messages** o **FT2 Messages** aparece debajo, con la misma disposición que el panel de FT8.

> **Nota:** FT4 y FT8 usan formatos espectrales distintos y no son intercambiables. Asegúrese de estar en una frecuencia de FT4 al usar este decodificador.

---

## 4. JS8

**Qué es:** JS8 (el modo que usa JS8Call) toma el motor de señal débil de FT8 y lo convierte en un modo de conversación de teclado a teclado. Mientras FT8 envía intercambios fijos de 13 caracteres, JS8 envía texto libre en pequeños fragmentos y vuelve a unir las transmisiones consecutivas en frases completas, de modo que todo lo que supere unos doce caracteres llega a lo largo de varios ciclos de 15 segundos. Decodifica aproximadamente tan profundo como FT8, por lo que sirve cuando la voz y la CW ya no pasan.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia |
|-------|------------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Velocidades

JS8 tiene cinco velocidades. Todas las estaciones de una conversación deben usar la misma. **Normal** es la velocidad de llamada y concentra casi todo el tráfico: empiece ahí.

| Velocidad | Ciclo | Ancho de banda | Cuándo se usa |
|-----------|-------|----------------|---------------|
| Slow   | 30 s | 25 Hz  | Trayectos muy débiles; la más sensible |
| Normal | 15 s | 50 Hz  | La velocidad de llamada habitual |
| Fast   | 10 s | 80 Hz  | Intercambios más rápidos, exige más señal |
| Turbo  | 6 s  | 160 Hz | Señales locales fuertes |
| Ultra  | 4 s  | 250 Hz | Experimental, rara vez se ve |

### Configuración

1. Sintonice una frecuencia de JS8 y ponga el modo en **USB**.
2. Active el decodificador y seleccione **JS8** en la lista, o pulse el botón **JS8**.
3. Aparece el panel **JS8 Decoder**. Deje **Speed** en *Normal* salvo que sepa que la estación que busca usa otra.

### Cómo leer la salida

El panel tiene dos listas.

**Mensajes que aún están llegando** aparecen arriba en verde, con un cursor parpadeante. Un mensaje JS8 puede tardar cuatro ciclos —un minuto entero en Normal—, así que aquí se ve la frase construirse. No pasa nada si permanece así un rato.

**Mensajes completos** llenan la lista principal, una fila cada uno:

| Columna | Significado |
|---------|-------------|
| Mode | Siempre `JS8` |
| Hz | Frecuencia de audio de la señal dentro del paso de banda |
| dB | Relación señal/ruido en un ancho de referencia de 2500 Hz |
| Message | El texto decodificado; **los indicativos se muestran en verde** |

Mensajes típicos:

* `SV1BTL KM17: HB` — un heartbeat: la estación anuncia que está en el aire, con su localizador.
* `KN4CRD: K0OG SNR -05` — un mensaje dirigido: KN4CRD indica a K0OG que lo recibe a −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — texto libre, aquí una descripción de estación llegada en cuatro ciclos.

Una fila **atenuada y en cursiva** expiró antes de que llegara su última trama. El texto es real, pero puede estar cortado.

### Sync offset

El deslizador **Sync offset** fija cuánto después del límite del ciclo UTC empieza la captura, compensando el retardo de la cadena de audio. Deje **Auto** marcado: el decodificador mide la temporización de las señales que oye y se ajusta solo.

### Marcas de espectro

> **Consejo:** JS8 es mucho más tranquilo que FT8. Una tarde puede ver una transmisión cada pocos minutos, y los silencios largos son normales. Déle cinco o diez minutos antes de pensar que algo falla. 20m (14.078) y 40m (7.078) son los sitios habituales.

---

## 5. CW — código Morse

**Qué es:** el decodificador de CW escucha señales en código Morse (onda continua) y las convierte en texto en tiempo real. Sigue automáticamente la frecuencia de la señal y se adapta a la velocidad de manipulación del operador.

### Frecuencias recomendadas

La CW está activa en todas las bandas de aficionado, normalmente en la parte baja de cada banda. Puntos habituales:

| Banda | Segmento |
|-------|----------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Configuración

1. Sintonice una señal de CW. Iniciar el decodificador pone el receptor en **CW** (CW-L sigue en CW-L); un clic en **CW** del selector de modos también inicia el decodificador.
2. Active el decodificador y seleccione **CW** en el desplegable. O basta con pulsar el botón **CW**.
3. El panel **CW Decoder** aparece debajo.

### Lectura de la salida

- La cabecera del panel muestra la frecuencia detectada de la señal en Hz (p. ej., `≈ 700 Hz`) y la velocidad de manipulación estimada en palabras por minuto (p. ej., `· 22 WPM`).
- Si no se detecta señal, la cabecera muestra **scanning…**
- En un canal vacío no se imprime nada, y no se muestran ni la velocidad ni el tono. El decodificador solo empieza a escribir cuando hay una diferencia clara entre manipulador pulsado y suelto, algo que el ruido solo no produce, mientras que una señal aún legible a unos −10 dB la tiene de sobra.
- El texto decodificado se desplaza en caracteres ámbar de paso fijo. El cursor parpadeante (▋) marca dónde se está escribiendo.
- El deslizador **Pitch** antes de **Clear** ajusta el tono de audio de la señal CW mientras el decodificador funciona: de 500 a 800 Hz en pasos de 50 Hz, 600 Hz hasta que lo cambie. Su navegador recuerda la elección. La escucha normal de CW también está en 600 Hz.
- **Save** guarda el texto decodificado en un archivo; **Clear** lo borra.

> **Consejos:**
> - Centre el paso de banda en el tono de CW. El decodificador funciona mejor cuando la señal de CW se sitúa aproximadamente entre 400 y 900 Hz en el espectro de audio.
> - Se copian velocidades de unas 8 a 40 PPM, también con manipulación Farnsworth (caracteres enviados rápido con pausas más largas entre ellos): el enganche de velocidad se mantiene y las letras no se parten en palabras sueltas. El Morse muy manual (irregular) todavía puede reducir la precisión.
> - El decodificador rinde mejor con una única señal limpia. Un QRM fuerte de señales cercanas en la misma banda puede confundirlo.
> - El desvanecimiento (QSB) se sigue: una señal que se desvanece y vuelve se sigue leyendo, y también se lee la primera palabra de una transmisión — también al comienzo de una respuesta tras una pausa en el QSO.
> - Cada letra se decide sobre la propia señal y no sobre los puntos y rayas contados primero, lo que reduce aproximadamente a la mitad las letras erróneas en señales débiles y manipuladas a mano.

### CW Browser — todas las señales a la vez

Active el interruptor **Browser — all signals** en la ventana CW para decodificar a la vez todas las señales CW entre 200 y 3000 Hz, una línea por señal, como los navegadores de PSK y Olivia. Mientras funciona, el receptor se mantiene en **USB** con un filtro de 200–3000 Hz; su propio modo y su filtro vuelven al apagarlo.

---

## 6. QRSS Grabber

**Qué es:** QRSS es CW enviado tan despacio que un solo punto dura segundos en lugar de milisegundos. A esa velocidad la señal ocupa solo una fracción de hercio, de modo que un análisis lo bastante estrecho puede sacar la traza desde 20–30 dB *por debajo* del nivel de ruido. No hay nada que leer de oído: el QRSS **se mira**, no se escucha. El grabber calcula su propia FFT muy larga sobre el audio del receptor y dibuja la presentación clásica de grabber: frecuencia en el eje vertical, tiempo desplazándose de izquierda a derecha, con la columna más reciente siempre en el borde derecho.

Casi todo lo que verá procede de balizas MEPT (Manned Experimental Propagation Transmitter): transmisores de muy baja potencia, a menudo unos cientos de milivatios sobre un hilo, que se identifican continuamente en Morse muy lento o con patrones FSK.

### Dónde buscar

Las balizas QRSS viven en ventanas estrechas de 100–200 Hz cerca del extremo inferior de cada banda. No hace falta recordarlas: el grabber tiene una lista **Band** con las ventanas de abajo, y elegir una sintoniza allí y prepara el receptor para ello (véase *Abrir el grabber*).

| Banda | Centro de la ventana | Nota |
|------|---------------|------|
| 30m | 10.140,00 kHz | La ventana QRSS principal: con diferencia la más concurrida, de día y de noche |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Ventana Knights, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Ventana antigua |
| 80m | 3.500,85 kHz | Ventana Knights, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Ventana antigua |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | QRSS / DFCW en LF |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Ventana antigua |
| 10m | 28.322,00 kHz | Alternativa |
| 6m | 50.294,30 kHz |  |

### Abrir el grabber

El grabber QRSS **no** está en el desplegable de decodificadores. Tiene su propia sección **QRSS**, junto a los controles del espectrograma y de los decodificadores.

1. Pulse **🐌 Show**. Aparece el lienzo del grabber y sus controles se despliegan junto al botón.
2. Elija una ventana en la lista **Band** y pulse **Tune**. Eso hace de una vez todo lo que el modo necesita: sintoniza la ventana, pasa el receptor a **CW** y fija un paso de banda justo lo bastante ancho para la porción que está mirando. El dial marca entonces la frecuencia QRSS real, y las trazas caen sobre la línea central de la presentación.
3. Ajuste **Speed** a la duración del punto de la baliza.
4. **Centre** y **Span** funcionan como antes; cambiar cualquiera de los dos reajusta el paso de banda, de modo que la presentación y el receptor siguen acompasados.
5. Pulse **🐌 Hide** para detenerlo. Vuelve el modo normal de la banda.

### Velocidades

| Ajuste | Duración del punto | Resolución | Ventana de análisis | Nueva columna cada |
|--------|--------------------|------------|---------------------|--------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

### Controles

| Control | Qué hace |
|---------|----------|
| **Band** | Las ventanas QRSS de la tabla anterior. **Tune** va a la seleccionada, en CW y con un paso de banda a medida. |
| **Speed** | Fija la longitud de la transformada, es decir el compromiso entre resolución en frecuencia y en tiempo (tabla anterior). |
| **Centre** | Frecuencia de audio en el centro de la presentación, 100–3000 Hz. |
| **Span** | Altura de la franja mostrada: 20, 50, 100 o 200 Hz, con 100 Hz al arrancar: el ancho de una subbanda QRSS. Una franja más estrecha reparte cada traza en más píxeles. En las franjas anchas caben en el panel más bins que filas de píxeles tiene; cada fila muestra entonces el bin más fuerte que abarca, de modo que nada puede esconderse entre filas. |
| **Gain** | De −10 a +40 dB. Desplaza el mapa de color respecto al nivel de ruido medido; súbalo para aclarar trazas débiles. |
| **Color** | Rainbow, Green o Grayscale. |
| **Clear** | Borra el lienzo y reinicia la referencia de ruido. |

### Cómo leer la presentación

Las marcas de frecuencia recorren el borde izquierdo, con la frecuencia más alta arriba. Bajo el lienzo, una línea de estado muestra la velocidad seleccionada, la resolución realmente en uso (p. ej. `0.183 Hz/bin · 5.5 s window`) y el ritmo de columnas (p. ej. `2.7 s/column`).

Qué significan las formas:

- Una **portadora estable** dibuja una línea horizontal recta.
- El **Morse lento** dibuja esa línea como una cadena de segmentos cortos y largos: puntos y rayas que se leen de izquierda a derecha.
- Las **trazas curvadas o a la deriva** corresponden a un oscilador de baliza sin estabilizar que se calienta o se enfría. Es normal, y a menudo es precisamente esa firma de deriva la que permite a un observador habitual reconocer la estación.
- Las **rayas verticales** que cruzan toda la franja son estáticos o ráfagas de ruido local, no señal.

> **Consejos:**
> - Tenga paciencia. En QRSS 30 una sola columna tarda 5,5 segundos, de modo que un indicativo completo puede necesitar diez minutos o más para cruzar la pantalla. Déjelo funcionando.
> - Sintonizar desde la lista **Band** ya estrecha el paso de banda alrededor de la ventana. Si sintonizó a mano, hágalo usted: no cambia lo que resuelve la transformada, pero evita que vecinos fuertes accionen el AGC del receptor.
> - El grabber es independiente de los decodificadores: puede dejarlo funcionando mientras un decodificador trabaja en otra cosa.
> - Un span ancho a velocidad lenta es la combinación más pesada; toda la transformada se ejecuta en el navegador, así que en una máquina modesta es preferible un span de 50 Hz.

---

## 7. WSPR

**Qué es:** WSPR (Weak Signal Propagation Reporter, pronunciado «whisper») es un modo baliza de señales ultradébiles que cartografía las trayectorias de propagación en HF por todo el mundo. Cada transmisión dura unos 110 segundos y cabe en una ranura de 200 Hz de ancho. El decodificador espera a una ranura completa de 2 minutos alineada con UTC antes de decodificar.

### Frecuencias recomendadas (USB, dial)

| Banda | Frecuencia de dial |
|-------|--------------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Configuración

1. Sintonice una de las frecuencias de dial de WSPR anteriores y ponga el modo en **USB**.
2. La señal WSPR ocupa el margen de audio 1400-1600 Hz. Seleccionar **WSPR** hace el resto por usted: el receptor pasa a USB y el paso de banda se estrecha a 1350-1650 Hz, que cubre todo el margen en el que busca el decodificador. No hace falta ajustarlo más.
3. Active el decodificador y seleccione **WSPR** en el desplegable. O basta con pulsar el botón **WSPR**.
4. El panel **WSPR-2 Decoder** aparece debajo.

### Lectura de la salida

El panel muestra una barra de progreso para la ranura de 2 minutos en curso:

- **Barra cian llenándose**: recogida de datos de señal (de 0 a 116 s dentro de la ranura).
- **Barra ámbar parpadeando**: decodificación en curso (los últimos ~4 s de la ranura).
- **Barra vacía**: esperando al siguiente minuto UTC par.

Cada punto (spot) decodificado con éxito se muestra en una tabla con las siguientes columnas:

| Columna | Significado |
|---------|-------------|
| UTC | Hora del spot (minuto par) |
| Callsign | La estación que transmitió |
| Grid | Localizador Maidenhead del transmisor |
| Power | Potencia transmitida en dBm |
| Freq | Frecuencia de audio exacta (Hz) dentro del paso de banda de WSPR |
| SNR | Relación señal/ruido en dB |

Haga clic en **Clear** para borrar la lista de spots.

> **Consejo:** la decodificación de WSPR requiere una hora del sistema muy precisa (±1 segundo respecto a UTC). La primera ranura tras activar el decodificador comenzará en el siguiente minuto UTC par; una breve espera es normal.

---

## 8. FAX de HF / WEFAX

**Qué es:** el radiofax de HF (también conocido como WEFAX) lo utilizan los servicios de guardacostas y meteorológicos de todo el mundo para difundir mapas del tiempo, cartas del estado del mar y análisis de superficie por onda corta. El decodificador reconstruye la imagen línea a línea a medida que se recibe.

### Configuración

1. Active el decodificador y seleccione **HF FAX / WEFAX** en el desplegable. O basta con pulsar el botón **FAX**.
2. El panel **HF FAX / WEFAX Receiver** aparece debajo.
3. **Seleccione una estación** en el desplegable Station. Hay más de 20 estaciones disponibles que cubren Europa, Asia, Oceanía y América (p. ej., DDH3/DDK3 Alemania, SVJ4/GR Grecia, JMH Japón, NMG EE. UU. Nueva Orleans). También está CBM Punta Arenas (Chile). Los horarios siguen el programa mundial de radiofax de la NOAA (edición del 7 de marzo de 2025); Charleville (VMC, Australia) incluye sus emisiones adicionales solo en 11030 kHz.
4. Si la estación emite en más de una frecuencia, seleccione la deseada en el subdesplegable **Frequency**.
5. Haga clic en **▶ Tune** para sintonizar automáticamente la cascada en esa estación.
6. El modo se fuerza automáticamente a **USB**.

### Horario de emisiones

Al seleccionar una estación aparece una tabla de cuenta atrás **Next Transmissions** con las 4 próximas emisiones programadas en UTC y una cuenta atrás en directo:

- Normal (gris/verde): la transmisión está próxima.
- **Ámbar ⚡**: la transmisión empieza en menos de 3 minutos; prepare ya el decodificador.
- **Rojo ●**: la transmisión empieza en menos de 30 segundos; la recepción es inminente.

### Parámetros

La mayoría de las estaciones usan los valores estándar por defecto (marcados con ★). Cámbielos solo si sabe que la estación emplea ajustes no estándar.

| Parámetro | Por defecto | Descripción |
|-----------|-------------|-------------|
| LPM | 120 ★ | Líneas por minuto: la velocidad de giro del tambor |
| IOC | 576 ★ | Índice de cooperación: determina los píxeles por línea |
| Shift | 800 Hz ★ | Desplazamiento de frecuencia entre los tonos de negro y blanco |

### Controles

- **⇔ Auto-align**: activado por defecto. Se sincroniza automáticamente con la señal de fase al principio de cada imagen. Desactívelo solo si tiene problemas de alineación con una señal que sabe que es buena.
- **⇅ Invert**: intercambia blanco y negro. Úselo si la imagen aparece en negativo (zonas blancas donde debería haber negro).
- **↺ Refresh**: borra el lienzo y reinicia el decodificador. Úselo entre transmisiones o si la imagen se rompe o se desplaza.
- **⤓ Save PNG**: guarda el lienzo actual como archivo PNG en su ordenador.

### Indicadores de estado

Bajo la imagen, dos indicadores de tono muestran:

- **300 Hz phasing**: se ilumina en cian cuando se detecta el tono de fase de inicio de imagen.
- **450 Hz stop**: se ilumina en rojo cuando se detecta el tono de parada de fin de imagen.

> **Nota:** la imagen se desplaza hacia arriba; la línea recibida más reciente siempre aparece en la parte inferior del lienzo. Si ve **[PHASING]** en la cabecera, el decodificador se ha enganchado al inicio de una nueva imagen.

---

## 9. NAVTEX

**Qué es:** NAVTEX es el sistema internacional de radiodifusión marítima de información de seguridad costera: avisos a la navegación, previsiones meteorológicas y avisos de búsqueda y rescate. Utiliza FSK a 100 baudios (SITOR-B con FEC) y se recibe en canales dedicados en todo el mundo.

### Canales disponibles

| Canal | Frecuencia | Uso |
|-------|------------|-----|
| Internacional | 518 kHz | En inglés, internacional |
| Nacional | 490 kHz | Emisiones en el idioma nacional |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | NAVTEX de HF de largo alcance |

### Configuración

1. Active el decodificador y seleccione **NAVTEX** en el desplegable. O basta con pulsar el botón **NAVTEX**. El receptor pasa automáticamente a **USB**.
2. Aparece el panel **NAVTEX Receiver**.
3. Seleccione el canal deseado en el desplegable **Station** (p. ej., `International — 518 kHz`).
4. Haga clic en **⇒ Tune & Set IF** para sintonizar automáticamente la cascada y estrechar el paso de banda hasta la ventana de audio correcta. El modo se pone automáticamente en **USB**. El dial se sitúa 500 Hz por debajo del centro del canal, de modo que la señal NAVTEX aparece a 500 Hz en audio. El indicador de frecuencia muestra igualmente **518.000**: mientras HF FAX, NAVTEX o la ventana FLDIGI están activos, muestra la frecuencia de la propia señal (la del dial más el centro de audio del decodificador: 1900 Hz para FAX, 500 Hz para NAVTEX, el centro del panel para FLDIGI), y una frecuencia escrita entonces se toma como la de la señal.

### Horario de emisiones

La tabla de horarios enumera todas las estaciones conocidas del canal seleccionado con:

- su letra identificadora de la UIT y la bandera del país
- la hora de la próxima emisión en UTC
- una cuenta atrás en directo hasta la próxima transmisión
- **Ámbar ⚡** a menos de 2 minutos / **Rojo ●** a menos de 30 segundos: prepare ya el decodificador

### Lectura de la salida

El texto decodificado aparece en color verde azulado y paso fijo. Los límites de los mensajes están claramente marcados:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marca el inicio de un mensaje. Los cuatro caracteres siguientes identifican la estación (`M`), el tema (`A` = avisos a la navegación) y el número de secuencia (`12`). El encabezado espera a tener la cabecera completa, así que muestra `ZCZC MA12` y no `ZCZC ????`. `NNNN` marca el final.

Haga clic en **Clear** para borrar el búfer de mensajes.

> **Nota:** NAVTEX funciona en frecuencias de MF y LF (518/490 kHz). El alcance de recepción suele ser de 200 a 400 millas náuticas desde el transmisor. Los canales de HF (4-17 MHz) ofrecen un alcance mucho mayor.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet y APRS

**Qué es:** una ventana para los modos de teclado de banda estrecha que popularizó el programa fldigi, con catorce variantes seleccionables desde un único menú. Una es FSK auténtico (modulación por desplazamiento de frecuencia): el RTTY de aficionado; sus parientes de los servicios, el FSK marítimo (SITOR) y el RTTY meteorológico, usan el mismo decodificador en SERVICES (capítulo 12). Las demás comparten la misma ventana: **PSK31** (también **PSK63** y **PSK125**, en BPSK o QPSK), que es modulación por desplazamiento de fase; **Olivia** (con su pariente **Contestia**) y **MFSK16/32/64**, modos multitono con corrección de errores; **DominoEX** y **THOR**, modulación por saltos incrementales de frecuencia (THOR con corrección de errores); **THROB**, dos tonos a la vez, un carácter por pulso; **Hellschreiber**, que pinta el texto como una imagen en lugar de decodificarlo; **MT63**, 64 portadoras a la vez; y **Packet (AX.25)** y **APRS**, que decodifican packet radio AFSK — el packet de 1200 baudios de VHF/UHF y el packet de 300 baudios de HF. Cada variante incluye un preajuste adaptado a sus parámetros estándar. El botón y la entrada del menú se llaman ambos **FLDIGI**; la decodificación se hace aquí, en el navegador, y no hace falta tener fldigi.

Tres de las variantes no proceden de fldigi. **ALE 2G HAM** es el establecimiento automático de enlace (MIL-STD-188-141) de la red de radioaficionados HFLINK, y lista sus llamadas y sondeos; las redes gubernamentales, militares y de servicios están en SERVICES → ALE 2G (capítulo 12). **FST4W**, el modo de balizas muy lento de las bandas de 2200 m, 630 m y 160 m, y **MSK144**, para meteor scatter en 6 m y 2 m, proceden de WSJT-X. Ninguna de las tres imprime texto continuo: cada una lista lo que decodifica línea a línea, con la hora.

### Variantes y preajustes

| Variante | Centro | Shift | Baudios | Trama | Codificación |
|----------|--------|-------|---------|-------|--------------|
| RTTY de aficionado | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31·63·125 (BPSK/QPSK) | 1000 Hz | — | 31.25 / 62.5 / 125 | — | Varicode |
| Olivia / Contestia | 1000 Hz | — | ver Mode | — | 7 bits + FEC |
| FST4W | 1500 Hz | — | 1,46 / 0,56 / 0,18 / 0,09 | T/R 120–1800 s | LDPC + CRC-24 |
| MFSK16·32·64 | 1500 Hz | — | ver Mode | — | Varicode + FEC |
| MSK144 | 1500 Hz | — | 2000 bit/s | T/R 15 / 30 s | LDPC + CRC-13 |
| DominoEX | 1500 Hz | — | ver Mode | — | Varicode por nibbles |
| THOR | 1500 Hz | — | ver Mode | — | Varicode + FEC |
| THROB / THROBX | 1500 Hz | — | 1, 2 o 4 | — | pares de tonos |
| Hellschreiber | 1500 Hz | — | ver Mode | — | imagen |
| MT63 | 1000 Hz (portadora más baja en 500 Hz) | — | 5, 10 o 20 | — | Walsh + entrelazado |
| ALE 2G | 1625 Hz (tonos 750–2500 Hz) | — | 125 | palabras de 24 bits, ×3 | Golay (24,12) |
| Packet (AX.25) | tonos de 1200 / 2200 Hz, o 1700 Hz a 300 Bd | 1000 Hz, o 200 Hz a 300 Bd | 1200 o 300 | HDLC | AX.25 |
| APRS | como Packet | como Packet | 1200 o 300 | HDLC | AX.25 + APRS |

### Configuración

1. Active el decodificador y seleccione **FLDIGI** en el menú desplegable. O simplemente pulse el botón **FLDIGI**.
2. Aparece el panel del decodificador. Su título sigue a la variante — *FSK / RTTY Decoder*, *BPSK31 Decoder* (o el modo PSK elegido), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* o *APRS Decoder*. ALE 2G HAM muestra *ALE 2G HAM Decoder*; FST4W indica su periodo, p. ej. *FST4W-120 Decoder*; MSK144 muestra *MSK144 Decoder*.
3. Seleccione la **Variant**. Los parámetros se actualizan automáticamente.
4. En PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber y MT63, ajuste **Mode** para que coincida con la transmisión — vea más abajo las notas de cada modo. En Packet y APRS, ajuste **Speed** — vea más abajo las notas sobre Packet y APRS. En ALE 2G, elija una red y un canal; en FST4W y MSK144, ajuste **T/R period** y **F Tol** — vea sus notas más abajo.
5. Donde la variante la tenga, use la lista desplegable **Known frequency** para elegir una frecuencia habitual y pulse **Tune** para ir a ella. Los demás modos no tienen frecuencias de llamada fijas: busque la señal en la cascada y use **⟳ Auto-tune Center**.
6. Afine la sintonía hasta que el texto decodificado sea estable y legible.

### Frecuencias conocidas por variante

**RTTY de aficionado**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3583 kHz (80 m), 7040 kHz (40 m), 7072,5 kHz (40 m), 10143 kHz (30 m), 14072,5 kHz (20 m), 14108,5 kHz (20 m, 32/1000), 18099 kHz (17 m), 21072,5 kHz (15 m), 24922,5 kHz (12 m), 28122,5 kHz (10 m)

**FST4W** (el centro de la señal; el dial USB va 1,5 kHz por debajo)
- 137,5 kHz (2200 m, dial 136,000), 475,7 kHz (630 m, dial 474,200), 1838,1 kHz (160 m, subbanda WSPR, dial 1836,600)

**MSK144** (igual: el dial va 1,5 kHz por debajo)
- dial 144,360 MHz (2 m, Región 1 de la IARU), 144,150 MHz (2 m, Norteamérica), 50,260 y 50,280 MHz (6 m), 70,230 MHz (4 m), 28,145 MHz (10 m)

**MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63**
- Sin frecuencias de llamada fijas; la lista no se muestra. Busque la señal en la cascada.

**Packet y APRS** (la misma lista para ambos; cada entrada fija también la velocidad adecuada)
- 144,800 MHz — APRS en Europa (Región 1 de la IARU)
- 144,390 MHz — APRS en Norteamérica
- 145,175 MHz — APRS en Australia
- 144,640 MHz — APRS en China
- 144,660 MHz — APRS en Japón
- 145,825 MHz — el digipetidor packet de la ISS
- 10147,6 kHz — APRS en HF, 30 m, frecuencia de dial en USB (300 Bd)

### Parámetros

| Parámetro | Se aplica a | Descripción |
|-----------|-------------|-------------|
| Center audio (Hz) | todas | La frecuencia de audio del punto medio entre mark y space; en PSK31 la portadora, en los modos multitono el centro del bloque de tonos o del grupo de portadoras. Un menú desplegable en las variantes FSK, un campo de entrada libre en todas las demás. En Packet y APRS un campo de entrada libre solo a 300 Bd; a 1200 Bd los tonos son fijos, 1200 / 2200 Hz, y el campo solo los muestra |
| Shift (Hz) | solo FSK | Diferencia de frecuencia entre los tonos mark y space |
| Baud | solo FSK | Velocidad de símbolo |
| Framing | solo FSK | Bits de datos, paridad, bits de parada (p. ej. 7N1 = 7 datos, sin paridad, 1 parada) |
| Encoding | solo FSK | Juego de caracteres (CCIR-476, ITA2/Baudot o ASCII) |
| Invert mark / space | solo FSK | Intercambia los tonos mark y space |
| Auto shift detect | solo FSK | Intenta medir el shift automáticamente a partir de la señal recibida |
| Mode | solo PSK31 | BPSK31/63/125, QPSK31/63/125 — debe coincidir con la transmisión |
| Mode (tonos / Hz) | solo Olivia, Contestia | Número de tonos y ancho de banda — debe coincidir exactamente con la transmisión |
| Squelch (FEC S/N) | solo Olivia, Contestia | Cuán fuerte debe ser la coincidencia de la corrección de errores antes de imprimir texto |
| Browser — all signals | PSK31, Olivia, Contestia, Amateur RTTY, MFSK | Un interruptor: decodifica a la vez todas las señales del **Mode** elegido (PSK31: todas las señales BPSK31; Amateur RTTY: todas las señales del **Shift** y **Baud** elegidos) entre 300 y 2700 Hz, una línea por señal — vea las notas sobre PSK Browser, Olivia, Amateur RTTY Browser y MFSK |
| Mode | MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63 | El submodo (velocidad, ancho, entrelazado) — debe coincidir con la transmisión |
| Squelch (FEC metric) | MFSK | La calidad de decodificación (0–100) que debe alcanzar la señal antes de imprimir texto; por defecto 22 |
| T/R period | FST4W, MSK144 | FST4W: 120, 300, 900 o 1800 s — debe coincidir con la transmisión. MSK144: 15 o 30 s; un mensaje repetido dentro de un periodo se lista una sola vez |
| F Tol | FST4W, MSK144 | Hasta dónde busca el decodificador a cada lado de **Center audio**: ±50, 100 o 150 Hz en FST4W, de ±50 a ±300 Hz en MSK144 |
| Decode | MSK144 | **Fast**, **Normal** o **Deep** — con qué detalle se explora cada bloque; Deep encuentra más y usa más CPU |
| Squelch (tone / noise) | DominoEX, THOR | 0–100: el tono actual frente al fondo de las demás posiciones de tono; por defecto 25 |
| Squelch (S/N) | THROB | En dB; por defecto 4 |
| Squelch (FEC S/N) | MT63 | La coincidencia del código Walsh; por defecto 4 |
| Reverse | FSK Hell 245 / 105, Hell 80 | Pinta el otro tono como tinta |
| Speed | Packet y APRS | **1200 Bd · VHF/UHF (FM)** o **300 Bd · HF (USB)**. También elige el modo del receptor |
| Show raw packet | solo APRS | Imprime además el paquete tal como se recibió (formato TNC2) encima de cada línea decodificada |
| Squelch (SNR) | RTTY de aficionados, meteorológico y naval | Evita que el ruido se imprima como letras al azar. Empieza en −5 dB para el RTTY de aficionados y en −7 dB para el meteorológico y el naval; del todo a la izquierda (**off**) queda desactivado. La cifra de SNR se vuelve gris mientras el squelch está cerrado |

### Controles adicionales

- **⇒ Set IF Band-Pass** — estrecha la banda de paso del receptor para ceñir la señal. El ancho sigue a la variante: 300 Hz para el RTTY de aficionados (lo bastante estrecho para quitar una estación más fuerte a 250 Hz y aun así copiar una señal desintonizada 40 Hz), 594 Hz para el RTTY meteorológico, mark/space más margen para el FSK marítimo, unos ±100 Hz para PSK31 (±200 Hz PSK63, ±400 Hz PSK125) y todo el ancho del bloque de tonos más margen para Olivia. La banda de paso sigue al decodificador cuando **Auto-tune** o **Auto shift detect** mueven los tonos, y cuando se cambia el ajuste **Baud**. Para packet a 300 Bd, unos ±400 Hz; para packet a 1200 Bd, el canal FM normal. MFSK, DominoEX, THOR, THROB, Hellschreiber y MT63 reciben todo su ancho más un margen (al menos 60 Hz a cada lado, el 15 % del ancho en los modos anchos). ALE 2G recibe 500–2750 Hz (reflejado por debajo del dial en una red LSB), FST4W su rango de **F Tol** más 150 Hz a cada lado, MSK144 ±1,1 kHz más **F Tol**.
- **⟳ Auto-tune Center** — búsqueda automática de la señal. En las variantes FSK busca un par equilibrado de tonos, en PSK31 localiza la portadora, y en Olivia encuentra el bloque más fuerte del ancho de banda seleccionado. **Auto shift detect** solo cambia el desplazamiento cuando hay una verdadera señal de dos tonos, así que ya no salta con el ruido. Para packet a 300 Bd busca el par de tonos más fuerte separados 200 Hz. En packet a 1200 Bd el botón se oculta, porque allí los tonos son fijos. MFSK, DominoEX, THOR, THROB, Hellschreiber y MT63 se buscan como Olivia, sobre su propio ancho. En ALE 2G, FST4W y MSK144 el botón está oculto.

### Amateur RTTY Browser

Active el interruptor **Browser — all signals** bajo **Shift** (solo en Amateur RTTY) para decodificar a la vez todas las señales RTTY del **Shift** y **Baud** elegidos entre 300 y 2700 Hz, una línea por señal, como en los navegadores de PSK y Olivia. Las estaciones se encuentran por sus dos tonos separados un shift y aparecen en pocos segundos; cada una recibe su propio decodificador RTTY detrás de su propio filtro estrecho, del ancho que **⇒ Set IF Band-Pass** da a una señal, de modo que una estación fuerte vecina no borra a otra más débil. Un clic en una línea decodifica solo esa estación: el interruptor se apaga y **Center audio** pasa a ella. **Squelch (SNR)**, **Framing**, **Encoding** e **Invert mark / space** se aplican a todas las líneas; **Auto shift detect** queda en gris mientras el navegador funciona, porque se desviaría hacia un vecino. Una línea aparece cuando contiene algunas palabras de texto real, y la que pasa 30 s en silencio se retira. Otros shifts o velocidades (por ejemplo 850 Hz o 75 Bd) necesitan su propio **Shift** y **Baud**.

### Notas sobre ALE 2G

ALE (MIL-STD-188-141, segunda generación) es la forma en que las redes de HF gubernamentales, militares, de ayuda humanitaria y de radioaficionados encuentran una frecuencia de trabajo: las estaciones exploran una serie de canales, envían breves *sondeos* (soundings) para anunciar su presencia y se llaman entre sí con unos segundos de una señal de 8 tonos (125 Bd, 750–2500 Hz).

1. Elija **ALE 2G HAM**, la entrada justo antes de Packet en **Variant**. En lugar de los ajustes habituales, el panel muestra una lista de **redes** y una de **canales**.
2. Elija una red y uno de sus canales, y pulse **⇒ Tune & Set IF**. La frecuencia de la lista es el dial; el receptor pasa a USB, o a LSB en las pocas redes marcadas así, con un filtro de 500–2750 Hz.
3. Espere. Los sondeos llegan cada media hora o cada hora, y las llamadas solo cuando hace falta un enlace, así que un canal puede quedar en silencio mucho tiempo.

### Notas sobre PSK31

- El decodificador corrige por sí mismo su error de sintonía en unos **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125), así que basta con acercarse. **Carrier**, en la fila de métricas, indica dónde se ha estabilizado realmente.
- **IMD** mide la calidad del transmisor, no la recepción: una señal limpia da unos −20 dB o mejor. Una lectura pobre significa que la otra estación está sobreexcitando su equipo, no que usted esté mal sintonizado.
- El texto aparece carácter a carácter sin corrección de errores, por lo que una señal débil se degrada en letras erróneas ocasionales en lugar de detenerse.
- **PSK63 y PSK125** son el mismo modo, dos y cuatro veces más rápido y otras tantas veces más ancho; **QPSK31/63/125** añaden corrección de errores (un decodificador Viterbi), que repara ráfagas cortas de ruido con aproximadamente el mismo nivel de señal. Elija el submodo en **Mode** — el equivocado no imprime nada. La mayor parte de la actividad PSK sigue siendo BPSK31; PSK63 es habitual en concursos.
- **PSK Browser (BPSK31).** El interruptor **Browser — all signals** bajo **Mode** decodifica a la vez todas las señales BPSK31 entre 300 y 2700 Hz, como el navegador de señales de fldigi: una línea por señal (hasta 16), con su frecuencia, la calidad de enganche y el texto más reciente. Las señales se encuentran solas en pocos segundos, y la que queda en silencio 30 s se descarta. Haga clic en una línea para decodificar solo esa señal, como BPSK31 normal sobre su portadora. Mientras funciona, **Mode** muestra BPSK31 y queda bloqueado; al apagarlo, la ventana vuelve al Mode que tenía. Mientras se explora, la banda de paso se abre a 200–2800 Hz. Cada línea guarda sus últimos 4000 caracteres en un cuadro de unas seis líneas de alto, con su propia barra de desplazamiento cuando tiene más de seis líneas (también sirve la rueda del ratón); el cuadro se queda quieto mientras lee. **Save Text** guarda todas las líneas, también las que ya se quitaron. Mientras funciona un navegador, se ocultan los ajustes del decodificador único (Center audio, ⟳ Auto-tune Center y sus lecturas).

### Notas sobre Olivia

- **El ajuste Mode debe coincidir exactamente con la transmisión.** Una combinación errónea de tonos y ancho de banda no decodifica absolutamente nada — no texto ilegible, sino silencio. El panel se abre en **8 / 250**, la configuración estrecha que se deja funcionando en las frecuencias de llamada; **16 / 500** y **32 / 1000** son las otras dos de uso común, y también se ofrece **16 / 1000**.
- **Contestia** es Olivia con un bloque de corrección de errores más pequeño: aproximadamente el doble de rápido, solo mayúsculas y algo menos robusto. Sus configuraciones están en la misma lista **Mode**, bajo *Contestia* (la habitual es 8 / 250; 4 / 125 y 4 / 250 para trayectos débiles); el título del panel cambia a *Contestia Decoder*. Un ajuste de Olivia nunca decodifica Contestia, ni al revés.
- **Olivia Browser.** Active el interruptor **Browser — all signals** bajo **Mode** para decodificar a la vez todas las señales Olivia (o Contestia) de esa configuración entre 300 y 2700 Hz, una línea por señal, igual que PSK Browser; un clic en una línea decodifica solo esa señal. Trabaja con una configuración a la vez: en **8 / 250** no ve las estaciones 16 / 500. Como Olivia se usa por debajo del ruido, no busca las señales por su intensidad: la banda de paso la cubren una docena de decodificadores uno al lado de otro (un 5 % de un núcleo), así que una estación aparece en cuanto se decodifican sus primeros caracteres, unos segundos después de empezar. Dentro de un ancho de banda solo se muestra la copia más fuerte, y una línea aparece solo cuando contiene unos cuantos caracteres de texto real.
- Olivia no envía preámbulo, por lo que el decodificador debe buscar la sincronización. **Deje pasar unos segundos** tras sintonizar antes de que aparezca texto. El campo **Sync** muestra `SEARCH` hasta que engancha.
- La corrección de errores trabaja por bloques, así que el texto llega **a ráfagas en lugar de en flujo continuo**, con un retardo de varios bloques entre la transmisión y su presentación.
- **Squelch (FEC S/N)** fija la confianza que debe alcanzar la corrección de errores antes de imprimir. El valor por defecto de 4,0 mantiene fuera el ruido; 3,0 es el mínimo, por debajo del cual el ruido aleatorio empieza a imprimir caracteres sueltos. Una buena señal marca 8–9 en el indicador **FEC**, de modo que hay margen de sobra para subir el squelch en una banda concurrida.
- Cuando termina una transmisión, el texto simplemente se detiene. Cada bloque se comprueba también por separado, así que los pocos bloques que el squelch aún deja pasar mientras se cierra ya no imprimen una ráfaga de caracteres aleatorios.

### Notas sobre FST4W

- **Decodifica una vez por periodo, cuando este termina.** Los periodos empiezan según el reloj UTC — FST4W-120 en cada minuto par, FST4W-1800 a la hora en punto y a la media — y la barra **Period** muestra cuánto del periodo actual se ha grabado. Un periodo al que se llega a medias se omite, porque medio mensaje no se puede decodificar; el siguiente se graba entero. Decodificar un periodo de 30 minutos lleva unos segundos.
- **Elija el periodo T/R correcto.** El decodificador solo mira el que usted elige. La mayoría de las balizas LF/MF usan FST4W-120; FST4W-300, -900 y -1800 son para los trayectos más débiles.
- **F Tol** fija hasta dónde se busca a cada lado de **Center audio** (1500 Hz). El valor por defecto de WSJT-X, ±100 Hz, cubre las subbandas de balizas; ±150 Hz es lo máximo que permite la banda de paso.
- Cada línea muestra UTC, SNR (dB), DT (el desfase de tiempo, s), la frecuencia (MHz) y el mensaje, como en WSJT-X, y **Save Text** las guarda con el mismo formato.
- El reloj del ordenador debe estar en hora con un margen de un segundo, como para WSPR.

### Notas sobre MFSK16 / MFSK32 / MFSK64

- **Elija la variante MFSK16·32·64** y después la velocidad en su lista **Mode**. Los tres modos solo se diferencian en la velocidad, y el ajuste debe coincidir: el equivocado no imprime nada legible.
- **Sintonía:** coloque el bloque de tonos en la frecuencia **Center audio** o pulse **⟳ Auto-tune Center**. El último cuarto de tono lo corrige el decodificador por sí mismo —unos ±4 Hz en MFSK16, ±8 Hz en MFSK32 y ±16 Hz en MFSK64— y **Centre** muestra dónde se ha asentado. Una señal más alejada la encuentra el propio decodificador, hasta unos ±75 Hz del centro ajustado: cuente con unos segundos al comienzo de una transmisión.
- El texto llega un par de segundos por detrás de la señal, el tiempo que necesitan el entrelazado y la corrección de errores. Uno o dos caracteres sueltos al principio de una transmisión son normales; fldigi también los muestra.
- **Squelch (FEC metric)** retiene la impresión hasta que la calidad de decodificación alcanza el ajuste. El valor por defecto de 22 deja fuera el ruido (el ruido solo llega a unos 20); una buena señal marca 90 % o más en el indicador **FEC**, y 0 desactiva el squelch. Cuando una transmisión termina con la marca de fin de transmisión de fldigi, la impresión se detiene en el acto en lugar de dejar pasar unos segundos de ruido.
- **MFSK Browser.** Active el interruptor **Browser — all signals** bajo **Mode** para decodificar a la vez todas las señales MFSK de ese modo entre 300 y 2700 Hz, una línea por señal, como hace Olivia Browser; un clic en una línea decodifica solo esa señal. MFSK16, MFSK32 y MFSK64 necesitan cada uno su propio **Mode**. Como en Olivia, la banda de paso se cubre con decodificadores uno al lado de otro (alrededor del 9 % de un núcleo del procesador; MFSK64, que solo encuentra una señal cerca de su centro, necesita más, alrededor del 15 %), así que también se encuentran estaciones por debajo del ruido, unos segundos después de empezar. Una línea aparece solo cuando su texto parece texto y sus tonos cambian como cambian los tonos MFSK — si no, las señales FT8 junto a las frecuencias MFSK de 20 m saldrían como líneas sin sentido. La cifra de calidad de cada línea es la métrica **FEC** sobre la que actúa el squelch.
- Las transmisiones de imágenes MFSK no se decodifican.

### Notas sobre MSK144

- **Cuente con largas pausas.** En una banda tranquila no aparece nada durante minutos. Durante las grandes lluvias (Cuadrántidas, Perseidas, Gemínidas) y de madrugada hay muchos más pings.
- Cada línea muestra UTC (al segundo), SNR (dB), T (cuándo llegó el ping dentro de su periodo, s), la frecuencia (MHz) y el mensaje. Un mensaje oído de nuevo en el mismo periodo T/R se lista una vez, salvo que la nueva copia sea más fuerte. Las copias débiles del mismo mensaje se promedian, como en WSJT-X.
- **F Tol** fija hasta dónde busca el decodificador a cada lado de 1500 Hz; las estaciones rara vez están justo en frecuencia, así que ±100 Hz es un buen comienzo. **Decode** fija con qué empeño se explora cada bloque, y **Deep** encuentra más. **CPU** en la fila de medidas muestra la carga: por encima del 100 % el decodificador se retrasa, así que en un ordenador lento elija **Normal** o **Fast**.
- Los mensajes cortos de 40 bits (Sh) no se decodifican: necesitan los indicativos de las dos estaciones, que un oyente no conoce.

### Notas sobre DominoEX y THOR

- **Mode** debe coincidir con la velocidad emitida. DominoEX ofrece Micro, 4, 5, 8, 11, 16, 22, 44 y 88; THOR ofrece Micro, 4, 5, 8, 11, 16, 22 y los rápidos 25 x4, 50 x1, 50 x2 y 100 (estos cuatro usan un código más fuerte y un entrelazador de un segundo). DominoEX 11 y THOR 16 son los que más se oyen.
- **Sintonía:** ponga el bloque de tonos en **Center audio** o pulse **⟳ Auto-tune Center**. Una desintonía de una cuarta parte del ancho de la señal todavía se copia.
- **Squelch (tone / noise)** compara el tono recibido con el fondo de todas las demás posiciones de tono, en una escala de 0–100. El ruido solo se queda en 20 o menos; una copia legible marca 35 o más; el valor por defecto es 25. No es la cifra del propio fldigi: esa marca 26 en algunas señales perfectamente limpias, con lo que cualquier valor útil por defecto las habría cortado. Cuando una transmisión termina, la impresión se detiene en unos pocos símbolos en lugar de dejar pasar ruido.
- El receptor sigue los ajustes por defecto de fldigi: tres caminos separados un tercio de posición FFT, decisiones duras en DominoEX, decisiones suaves y detección de preámbulo en THOR. No se decodifican la corrección de errores MultiPSK opcional de DominoEX (desactivada por defecto en fldigi), el canal de texto secundario (el texto baliza de la estación en las pausas) ni el modo imagen de THOR.

### Notas sobre THROB

- **La sintonía es crítica.** Los tonos de THROB 1 y 2 están a solo 8 Hz, así que el decodificador captura ±3 Hz de desintonía (±6 Hz en THROB 4) y corrige el resto con su propio seguimiento de frecuencia. Pulse primero **⟳ Auto-tune Center**: encuentra la señal con un error de uno o dos hercios.
- **Mode** debe coincidir, THROB o THROBX y la velocidad.
- **Squelch (S/N)** — el ruido solo se queda por debajo de 1 dB, una señal legible marca 10 dB o más; el valor por defecto es 4 dB.

### Notas sobre MT63

- **Mode:** MT63-500, -1000 o -2000 (el ancho), cada uno con entrelazado **short** o **long**. Ambos deben coincidir. El más usado es MT63-1000 long.
- **Sintonía:** fldigi envía la portadora más baja en 500 Hz, así que el centro es 500 Hz más la mitad del ancho: 750, 1000 o 1500 Hz, que se fija automáticamente al elegir el Mode. El decodificador encuentra por sí solo un error de hasta 8 portadoras (±125 Hz en MT63-1000).
- **El texto llega con retraso** respecto a la señal por el entrelazador: de unos 1,6 s (MT63-2000 short) a 12,8 s (MT63-500 long). Los últimos caracteres de una transmisión llegan cuando la señal ya se ha detenido.
- **Squelch (FEC S/N)** — el ruido solo marca unos 3, una señal enganchada 4,5 o más; el valor por defecto es 4. El squelch oculta el momento que necesita el sincronizador para engancharse al principio.

### Notas sobre Packet y APRS

> **Nota sobre el modo:** el decodificador toma el control del modo de demodulación y del paso de banda de FI mientras está activo. Ambos se restauran automáticamente al desactivarlo. Todas las variantes usan **USB**, salvo Packet y APRS a 1200 Bd, que usan **FM**.
>
> **Nota sobre la polaridad (solo variantes FSK):** en RTTY meteorológico y RTTY naval (PBB) normalmente hay que marcar **Invert mark / space**. En FSK marítimo (tipo SITOR/NAVTEX) y RTTY de aficionado, déjelo sin marcar — el RTTY de aficionado envía mark como la radiofrecuencia más alta, y USB la mantiene como el tono de audio más alto, que es justamente el caso sin marcar. Si el texto decodificado sale ilegible, lo primero que conviene probar es cambiar esta casilla. La casilla se oculta en todas las variantes salvo las cuatro FSK: las demás no tienen par mark/space, y la decodificación packet no depende de qué tono es cuál.
>
> **Nota sobre letras/cifras (solo variantes FSK):** el código Baudot mantiene letras y cifras en dos estados separados, y el ruido puede llevar al decodificador al estado equivocado, lo que corrompe todos los caracteres siguientes y no solo el dañado. Por eso el decodificador vuelve a letras en cada espacio; es la práctica habitual y repara un cambio corrompido en una o dos palabras en lugar de una línea entera. El coste es que los grupos de cifras separados por espacios exigen que el transmisor repita el cambio a cifras después de cada espacio, como suelen hacer los equipos.

---

## 11. SSTV

**Qué es:** la televisión de barrido lento transmite imágenes fijas por un canal de voz SSB normal, línea a línea, como un tono modulado en frecuencia entre 1500 Hz (negro) y 2300 Hz (blanco). Una imagen completa tarda entre 36 segundos y 4 minutos y medio según el modo.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia | Modo | Notas |
|-------|------------|------|-------|
| 20 m | 14.230 MHz | USB | La principal frecuencia internacional de llamada SSTV, con diferencia la más activa |
| 20 m | 14.233 MHz | USB | Secundaria, se usa cuando 14.230 está ocupada |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Activa durante las aperturas de banda |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regional, por las tardes |

**La banda lateral se elige por usted.** Al iniciar el decodificador se selecciona **LSB por debajo de 10 MHz** y **USB por encima**, siguiendo la práctica habitual de radioafición. En la banda lateral equivocada la correspondencia de tonos queda invertida y la imagen no se decodificará. Si se encuentra con una estación que ignora la convención, cambie la banda lateral a mano: el decodificador sigue funcionando, borra el cuadro y empieza de nuevo con el nuevo ajuste.

### Configuración

1. Active el decodificador y seleccione **SSTV** en el desplegable. O basta con pulsar el botón **SSTV**. El receptor cambia de banda lateral automáticamente: USB por encima de 10 MHz, LSB por debajo.
2. Sintonice de modo que los tonos de la imagen caigan en el centro del paso de banda. Una señal bien sintonizada tiene sus impulsos de sincronismo a 1200 Hz y el contenido de imagen entre 1500 y 2300 Hz.
3. Deje **Mode** en **Auto** salvo que ya sepa qué se está enviando. La imagen se va formando línea a línea según se recibe.

### Modos

| Ajuste | Imagen | Duración |
|--------|--------|----------|
| **Auto** | Detectado automáticamente | — |
| Martin M1 / M2 | 320×256 color | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 color | 110 s / 71 s |
| Scottie DX | 320×256 color | 269 s |
| Robot 36 / 72 | 320×240 color | 36 s / 72 s |

### Lectura de la salida

La línea de estado bajo los controles informa de lo que está haciendo el decodificador:

| Estado | Significado |
|--------|-------------|
| `Waiting for VIS / AUTO lock` | Escuchando; aún no se ha identificado nada |
| `Martin M1? verifying sync…` | Se ha encontrado un candidato y se está confirmando con las líneas siguientes |
| `Martin M1 lock (VIS)` | Enganchado a partir de la cabecera VIS |
| `Martin M1 lock (AUTO)` | Enganchado a partir de la temporización de sincronismo |
| `Martin M1 lock (MANUAL)` | Iniciado con el botón **⏺ Force** |
| `Candidate rejected (no sync)` | El candidato no se confirmó; normal con ruido |
| `— sync lost, resetting` | La señal desapareció a mitad de imagen |
| `Frame complete` | Se recibió la imagen completa |

El modo detectado también aparece en verde junto al título **SSTV**, y el contador de líneas muestra el avance.

### Controles

| Botón | Acción |
|-------|--------|
| **▶ Start** | Arma el decodificador. No dibuja una imagen por sí solo: el enganche debe venir de la cabecera VIS o de la detección de sincronismo. |
| **■ Stop** | Detiene la decodificación. |
| **↺ Reset** | Borra el lienzo y vuelve a armar en el sitio. Úselo entre imágenes o después de resintonizar. |
| **⏺ Force** | Empieza a dibujar **de inmediato** en el modo seleccionado en el desplegable, omitiendo por completo el VIS y la detección de sincronismo. Solo está disponible cuando Mode no está en **Auto**. |
| **💾 Save** | Guarda la imagen actual como PNG. |

**Cuándo usar Force.** Si ve una imagen en la cascada pero el decodificador no consigue engancharse —un modo poco común, una señal demasiado débil o distorsionada para los detectores, o una cabecera que se perdió—, seleccione el modo a mano y pulse **⏺ Force**. El cuadro se ancla en el momento del clic, y la etiqueta de modo muestra `MANUAL` para que lo distinga de un enganche por VIS o AUTO. El decodificador sigue ajustándose a un impulso de sincronismo real si lo encuentra, así que un clic algo adelantado o retrasado se corrige.

---

## 12. SERVICES

**SERVICES** (el botón se llamaba antes **HFDL**) es una ventana para los servicios utilitarios. La lista **Service**, arriba a la izquierda de la ventana, elige qué se decodifica: **HFDL** (aviones), **Maritime FSK / SITOR**, **Weather RTTY**, **Naval RTTY (PBB CARB)**, **DSC** (barcos), **Time Signals** (señales horarias), **HF Selcall** y **ALE 2G (MIL-STD-188-141)**. Su navegador recuerda la elección. Funciona un servicio a la vez; cada uno ajusta el modo y el filtro que necesita, tiene su propia lista de frecuencias con **⇒ Tune & Set IF** y decodifica en su navegador, así que no cuesta nada al receptor. Cada servicio tiene **💾 Save** (un archivo de texto) y **Clear**, y la ventana Users muestra qué servicio usa cada oyente. Los canales ALE de radioaficionado están en la ventana FLDIGI, como ALE 2G HAM (capítulo 10).

### HFDL — mensajes de aviones

HFDL (HF Data Link) transporta los mensajes que los aviones sobre océanos y zonas remotas intercambian en onda corta con estaciones de tierra: informes de posición, textos ACARS, conexiones y datos de frecuencias. El decodificador es dumphfdl (Tomasz Lemiech, GPL-3) compilado a WebAssembly. Funciona en su navegador sobre el audio USB, así que no le cuesta nada al receptor.

#### Configuración

1. Pulse **SERVICES** y elija **HFDL** en la lista **Service**. El receptor pasa a USB con un filtro de 150–2750 Hz.
2. Elija una **estación de tierra** y una de sus frecuencias, y pulse **⇒ Tune & Set IF**. La frecuencia de la lista es el dial en USB; la señal HFDL está 1440 Hz por encima.
3. Espere. Las estaciones de tierra envían un squitter cada 32 s y los aviones responden cuando tienen tráfico. El decodificador encuentra por sí mismo la velocidad exacta del audio (±1 %) y un desplazamiento de frecuencia (±240 Hz), y se engancha con la primera trama que decodifica.

#### Frecuencias

La lista contiene todas las estaciones de tierra HFDL. De día se oyen bien desde Europa 17967 kHz (Al Muharraq, Baréin) y 21955 kHz (Canarias); al atardecer y de noche toman el relevo las frecuencias más bajas de Shannon, Reikiavik y Canarias. Los marcadores de frecuencia HFDL inician el decodificador al pulsarlos.

#### Leer la salida

Cada línea muestra la hora (UTC), la frecuencia, la dirección (▼ tierra→aire o ▲ aire→tierra), la estación de tierra, el avión — matrícula, vuelo y dirección ICAO de 24 bits, cada uno un enlace a FlightAware —, el tipo de mensaje, su SNR y su velocidad binaria, y 📍 una posición cuando el mensaje la lleva. El texto ACARS aparece debajo. Pase el ratón por una línea para ver la trama completa. Marque **Squitters** para ver también los anuncios de las estaciones de tierra.

**🗺 Map** muestra dentro del panel los aviones que informaron una posición; **⤢ Large map** abre el mismo mapa en una ventana que se puede mover y redimensionar. Cada avión apunta según su rumbo y deja una estela roja. **💾 Save** guarda los mensajes en un archivo de texto y **Clear** vacía la lista.

### FSK marítimo / SITOR, RTTY meteorológico y RTTY naval

Estas tres emisiones de servicio usan el decodificador y el panel FSK de la ventana FLDIGI (capítulo 10), con la lista **Service** donde FLDIGI tiene su lista **Variant**. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space**, **Auto shift detect**, **⇒ Set IF Band-Pass** y **⟳ Auto-tune Center** funcionan como se describe allí.

| Servicio | Centro | Shift | Baudios | Trama | Codificación |
|----------|--------|-------|---------|-------|--------------|
| FSK marítimo / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| RTTY meteorológico | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| RTTY naval (PBB CARB) | 1000 Hz | 850 Hz | 75 | 5N1.5 | ITA2 |

1. Elija **Maritime FSK / SITOR**, **Weather RTTY** o **Naval RTTY (PBB CARB)** en la lista **Service**.
2. Elija una **Known frequency** y pulse **Tune**. La frecuencia de la lista es la de la señal; el dial USB baja el centro del panel.
3. Afine hasta que el texto sea estable. El RTTY meteorológico necesita **Invert mark / space** marcado (el ajuste predefinido lo hace) y tiene un deslizador **Squelch (SNR)** que empieza en −7 dB; el FSK marítimo lo deja sin marcar. El RTTY naval funciona igual (también invertido, squelch desde −7 dB).

**FSK marítimo / SITOR:** 2174,5 kHz (NBDP de MF, canal de trabajo), 518 y 490 kHz (NAVTEX), 4209,5 kHz (NAVTEX de HF), y los canales SITOR de HF de información de seguridad marítima 4210, 6314, 8416,5, 12579, 16806,5, 19680,5, 22376 y 26100,5 kHz. NAVTEX también tiene su propio botón, con los horarios de las estaciones (capítulo 9).

**RTTY meteorológico:** los transmisores del DWD (servicio meteorológico alemán) 4583, 7646 y 10100,8 kHz (programa 1, en inglés) y 11039, 14467,3 y 147,3 kHz (programa 2, en alemán; 147,3 kHz usa un shift de 85 Hz, que fija su entrada de la lista). Mientras hay una frecuencia del DWD elegida, **NEXT BROADCASTS** muestra las próximas emisiones.

**RTTY naval (PBB CARB):** la Channel Availability / Receipt Broadcast de PBB, la Marina Real de los Países Bajos en Den Helder, en 2474, 4250, 4280, 5052, 5214, 5659, 5694,5, 6356, 6358,5, 8439, 9264, 9368, 12840,5, 16318, 17116,7, 17947, 18308 y 20098 kHz. Indica a los barcos en qué canales escucha la estación costera y confirma los mensajes recibidos; lo que envían los barcos va cifrado. Si el texto sale ilegible, desmarque primero **Invert mark / space**.

### DSC — Digital Selective Calling

DSC es el sistema de llamada digital del GMDSS: barcos y estaciones costeras se llaman entre sí, prueban sus equipos y envían alertas de socorro, urgencia y seguridad en canales fijos de MF/HF. Una llamada dura unos segundos (100 Bd, dos tonos separados 170 Hz).

1. Elija **DSC** en la lista **Service** y una frecuencia. Los canales **distress & safety** (2187,5, 4207,5, 6312, 8414,5, 12577 y 16804,5 kHz) los vigila toda estación costera y son los más activos; los canales de llamada costa→barco y barco→costa siguen en la lista.
2. Pulse **⇒ Tune & Set IF**. El dial va 1,7 kHz por debajo de la frecuencia DSC, en USB, con un filtro de 1400–2000 Hz.
3. Espere. Las estaciones costeras responden y hacen pruebas muchas veces por hora; de día suelen ser los más activos 8414,5 y 12577 kHz, de noche 2187,5, 4207,5 y 6312 kHz.

Cada llamada muestra la hora, la frecuencia, su categoría en color (**DISTRESS** rojo, **URGENCY** naranja, **SAFETY** amarillo, **ROUTINE** azul), el formato y sus campos: quién llama a quién (un MMSI con su país, o una estación costera), los comandos, la frecuencia de trabajo y, en una alerta de socorro, su naturaleza, la posición (📍, un enlace a un mapa) y la hora. ✓ significa que el carácter de comprobación coincide; *✓ (1 rebuilt)* significa que un carácter se perdió en las dos copias y se reconstruyó con él. **Offset** muestra el error de sintonía y **S/N** la relación señal/ruido.

### Señales horarias (Time Signals)

Decodifica la fecha y la hora que envían las estaciones horarias de onda larga y onda corta, y muestra con cuánto retraso llegó la marca de minuto a su página.

1. Elija **Time Signals** en la lista **Service**, la estación y su frecuencia, y pulse **⇒ Tune & Set IF**. El dial va 1 kHz por debajo de la portadora, en USB, con un filtro de 700–1300 Hz.
2. Espere. Debe llegar limpio un minuto entero antes de poder mostrar la hora: uno o dos minutos con buena señal. Los segundos llenan una fila de 60 casillas a medida que llegan.

- **DCF77** (Alemania, 77,5 kHz) y **MSF** (Inglaterra, 60 kHz) se leen de la manipulación todo/nada de la portadora: fecha, hora y horario de verano.
- **WWV / WWVH** (EE. UU., de 2,5 a 25 MHz) se leen de la subportadora de 100 Hz: fecha, hora y DUT1.
- **RWM** (Rusia, 4996, 9996 y 14996 kHz) no envía fecha: solo la marca de minuto y DUT1, así que da únicamente la sincronización.
- CHU (Canadá) cerró el 22 de junio de 2026 y no se ofrece.

### HF Selcall

Selcall (CCIR 493-4) es la llamada selectiva de las redes de HF móviles terrestres y marítimas — Codan, Barrett y otras: una ráfaga de uno o dos segundos que llama a una radio, o a un grupo, por su número. Usa la misma señal y los mismos caracteres que DSC.

1. Elija **HF Selcall** en la lista **Service**, un canal (los canales de 7 y 8 MHz de la lista de KiwiSDR) y pulse **⇒ Tune & Set IF**. El canal es el centro del FSK; el dial va 1,7 kHz por debajo, en USB.
2. Cada llamada muestra los números de la estación que llama y de la llamada (4 o 6 cifras), el tipo de llamada y los comandos y datos que lleve; una posición GPS de Codan se muestra como sus cifras en bruto. Las estaciones difieren en qué tono envían como mark, así que se leen las dos polaridades.

### ALE 2G (MIL-STD-188-141)

Los sondeos, llamadas y mensajes de las redes de HF gubernamentales, militares y de servicios: 51 redes de la lista ALE de KiwiSDR, agrupadas como **Government**, **Military** (MARS entre ellas) y **Utility**. Es el mismo decodificador y el mismo panel que ALE 2G HAM en la ventana FLDIGI, que solo lista los canales de radioaficionado de HFLINK — vea las notas de ALE 2G en el capítulo 10.

1. Elija **ALE 2G (MIL-STD-188-141)** en la lista **Service**, una red y uno de sus canales, y pulse **⇒ Tune & Set IF**. La frecuencia de la lista es la del dial; el receptor pasa a USB, o a LSB en las redes marcadas así, con un filtro de 500–2750 Hz.
2. Espere. Los sondeos llegan cada media hora o cada hora, las llamadas solo cuando hace falta un enlace.

Son listas públicas y pueden estar desactualizadas. La ventana Users muestra *ALE* para un oyente que lo usa.

---

## 13. DRM

DRM (Digital Radio Mondiale) es radiodifusión digital en onda corta y onda media. A diferencia de los demás decodificadores, se decodifica en el servidor de la estación: al pulsar **DRM**, el servidor ejecuta para usted un decodificador — ubersdr-drm, el decodificador Dream sin interfaz gráfica que usa UberSDR — sobre todo el canal DRM de 10 kHz, y le envía el audio decodificado y su estado. Por eso suena en cualquier navegador, xHE-AAC incluido. Una estación ejecuta como máximo cinco decodificadores DRM a la vez, uno por oyente.

### Configuración

1. Pulse **DRM** (o elíjalo en el menú desplegable). Debajo de la frecuencia aparece **DRM** y la banda de paso cubre todo el canal de 10 kHz.
2. Elija una emisión en el selector y pulse **⇒ Tune**, o sintonice usted mismo el dial en el centro de un canal DRM — el decodificador sigue al dial.
3. Observe las lámparas: en cuanto **Audio** se pone verde, sale sonido.

Mientras DRM está activo, el único sonido es DRM decodificado. El audio propio del receptor queda silenciado, así que sin señal DRM no oye nada. Con una señal débil o con desvanecimientos, una trama dañada se desvanece en una breve reverberación y silencio en lugar de una ráfaga de ruido, y el decodificador se resincroniza solo cuando vuelve la señal; además, cada trama recibe una segunda pasada de corrección de errores.

### El selector de estaciones

El selector muestra el horario del DRM Reception Project (drmrx.org), que el servidor renueva cada hora: frecuencia, estación, horas UTC, los días cuando no es diaria, la zona a la que se dirige la emisión, ✓ cuando los oyentes la confirmaron en el aire, y HFCC cuando la emisora la registró en la HFCC. Los grupos son **Beamed at this station (locator) — on air now**, **On air now — beamed elsewhere, nearest first**, **Later (next 24 h)** y **Medium wave**. **Confirmed only**, activado por defecto, oculta las entradas que nadie ha confirmado. El orden sigue el localizador de la estación (`grid_locator` en la sección `[websdr]` de la configuración): una emisión cuenta como dirigida a la estación cuando su zona de destino llega a unos 1000 km de ella; si la zona es desconocida ("Various"), se usa el país del transmisor. Sin localizador, las emisiones en el aire aparecen en un solo grupo. Las emisiones dirigidas lejos suelen oírse débiles o nada. **heard here** marca una emisión que este receptor ha decodificado en los últimos 30 días — el decodificador anota cada servicio que decodifica, nunca quién escuchaba — y **Confirmed only** también las conserva; una emisión que no figura en ningún horario, como una transmisión de prueba, tiene su propio grupo arriba, **Heard on this receiver — on air now, in no schedule**, en las medias horas en que se oyó.

### Leer el panel

| Elemento | Significado |
|---|---|
| **Signal, Time, Frame, FAC, SDC, Audio** | Las lámparas de sincronismo: verde OK, ámbar error de datos, rojo error de CRC, gris ausente. Sale sonido cuando **Audio** está en verde. |
| **WMER** | La cifra que predice la decodificación: a partir de unos 10 dB el audio se decodifica. |
| **MER, SNR** | Relación de error de modulación y relación señal/ruido, en dB. |
| **Mode, BW, QAM, Prot** | Modo de robustez (A–E), ancho del canal, constelación MSC y niveles de protección. |
| **Codec** | AAC, AAC+SBR o xHE-AAC, según lo señala la estación. |

Debajo aparecen el nombre, el país, el idioma y el modo de audio de la estación, y su mensaje de texto. «No decoder on the server for …» significa que esta estación no puede decodificar ese códec.

**Para sysops.** El decodificador lo compila `./setup-drm.sh` (lo ejecutan los instaladores; `update.sh` lo ofrece) y el ayudante `autorun/drm-helper.js` arranca y se detiene con el receptor; `DRM_ENABLED=0` delante del script de arranque lo desactiva. Véase el manual de instalación. Tras una actualización, ejecute de nuevo `./setup-drm.sh`: parchea y recompila el decodificador (menos cortes y ninguna ráfaga de ruido en xHE-AAC); el nuevo decodificador se usa en cuanto el ayudante se reinicia con el receptor.

---

## 14. Consejos generales

**Los filtros de ruido no llegan a los decodificadores.** NR, NB, NS y AN son
ayudas de escucha, solo para sus oídos. Todos los decodificadores — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, todos los modos de FLDIGI, SSTV y el grabber QRSS — toman el audio *antes* de esos filtros, así que ajústelos como mejor suene, sin preocuparse por la calidad de la decodificación. Por la misma razón los decodificadores siguen funcionando con el receptor silenciado o con el squelch cerrado: puede apagar el altavoz y dejar un decodificador, o una captura QRSS nocturna, recogiendo datos. Lo único que sí sigue lo que usted oye es el Espectrograma de Audio, pensado para mostrar el audio filtrado.

### Reporte automático de spots y gráficas del servidor

Las decodificaciones de FT8, FT4 y WSPR también puede subirlas el propio servidor — FT8/FT4 a PSK Reporter y WSPR a WSPRnet — mediante un demonio autorun que el sysop inicia desde el panel de administración. Es independiente de los decodificadores de su navegador: sigue funcionando haya o no oyentes, y nada de lo que usted decodifique en el navegador se reporta. Allí el operador del sistema también decide en qué bandas, modos y horas UTC se reporta.

---

*PhantomSDR-Plus — fork de sv1btl — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
