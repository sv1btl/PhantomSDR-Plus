# PhantomSDR-Plus — Decoder User Manual

This guide covers every built-in decoder available in PhantomSDR-Plus. All decoders share the same activation workflow, described below, followed by per-decoder setup instructions.

---

## Table of Contents

1. [How to Start a Decoder](#1-how-to-start-a-decoder)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morse Code](#5-cw--morse-code)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet and APRS](#10-fldigi--ale-2g-rtty-psk31-olivia-fst4w-mfsk-msk144-dominoex-thor-throb-hellschreiber-mt63-packet-and-aprs)
11. [SSTV](#11-sstv)
12. [SERVICES](#12-services)
13. [DRM](#13-drm)
14. [General Tips](#14-general-tips)

---

## 1. How to Start a Decoder

All decoders are accessed from the **Decoder Options** section, located below the Audio Spectrogram controls on the main panel.

**Steps:**

1. Click the **Decoder: OFF** button to switch it to **Decoder: ON** (it turns blue when active).
2. Open the dropdown menu that appears to the right of the button and select the decoder you want.
3. The chosen decoder's panel will appear below the controls — follow the decoder-specific instructions in the relevant section of this guide.
4. To stop decoding, select **— Select decoder —** from the dropdown, or click the **Decoder: ON** button to turn it back OFF.

### One-touch decoder buttons

The dropdown is not the only way in. The main panel carries a **Decoders** button row — directly below **Wheel Tuning Steps** — with one button per decoder:

| Button | Decoder | Button | Decoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **FLDIGI** | ALE 2G, RTTY, SITOR, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (aircraft), DSC (ships), Time Signals, HF Selcall |
| **WSPR** | WSPR | **DRM** | DRM — digital broadcasting |

Pressing a button does the whole sequence in one go: it selects the decoder, switches the decoder ON, and scrolls its panel into view. The button turns blue while its decoder is running. **Press the same button again to switch the decoder off** — its window closes with it.

**RADE-v2U**, **RADE-v1L** and **RADE-v1U** are deliberately *not* in this row. They are digital-voice modes rather than text decoders, so they have their own buttons next to the **Modes** heading, and inside the **Modes** and **Bands** popup windows. Those behave in exactly the same way — press to start, press again to stop. See the [RADE manual](RADE_README.md). **RADE-v2U** starts RADE V2 (beta), always on USB; **RADE-v1L** and **RADE-v1U** start RADE v1.

The buttons, the dropdown and the ON/OFF button all drive the same state, so whichever you use, the others follow.

Where a decoder has its own list of frequencies — the QRSS **Band** list, the HF FAX and NAVTEX stations, the FLDIGI **Known frequency** list, and the SERVICES and DRM station lists — its Tune button also frames the band as **To Band** does: the waterfall shows the whole band the station is in, with that band's brightness, contrast and tuning step. The band is chosen by the station's listed frequency, not by the dial, so 10100.800 kHz (DWD weather RTTY) opens on 30 m even though the dial sits a little below 10100 kHz.

### Starting a decoder from a frequency marker

A frequency marker (the yellow labels above the waterfall, from `markers.json`) normally tunes the receiver and sets the mode written in it. When that mode is the name of a digital mode, clicking the marker starts its decoder instead, exactly as if you had pressed the decoder's button:

| Marker mode | Starts | The marker's frequency is |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | that decoder | the dial frequency |
| `NAVTEX` | NAVTEX | the signal frequency (the dial goes 500 Hz below) |
| `FAX`, `WEFAX` | HF FAX | the published centre (the dial goes 1900 Hz below) |
| `RTTY`, `RTTY-WX`, `SITOR` | FLDIGI as Amateur, Weather or Maritime | the signal frequency (the dial goes the panel's audio centre below) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI in that variant | as above |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI in that variant and sub-mode | as above |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI in that variant and sub-mode | as above |
| `PACKET`, `APRS` | FLDIGI in that variant | the channel; 300 Bd (USB) below 30 MHz, 1200 Bd (FM) above |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 on upper / lower sideband (`RADE` and `FREEDV` mean upper) | the dial frequency |
| `RADE2` | FreeDV RADE V2 (beta), always upper sideband | the dial frequency |
| `HFDL` | SERVICES · HFDL | the dial frequency (USB; the HFDL signal sits 1440 Hz above it) |
| `DSC`, `SELCALL` | SERVICES on DSC or HF Selcall | the DSC frequency or the Selcall channel (the dial goes 1.7 kHz below) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES on Time Signals, with that station | the carrier (the dial goes 1 kHz below) |
| `ALE` | FLDIGI on ALE 2G | the dial frequency (LSB for the networks that use it) |
| `DRM` | DRM | the centre of the DRM channel |
| `MORSE` | the CW decoder, with CW and a ±250 Hz filter | the signal frequency |

A decoder that is already running stays on. `CW` remains an ordinary receiver mode, because beacons and stations use it — it does not start the CW decoder. Markers are shown only while the waterfall spans 3.5 MHz or less. The decoder sets its own mode and filter, as it does when started from its button. To start the CW decoder from a marker, give it the mode `MORSE`. Decoder markers for every decoder come with PhantomSDR-Plus in `frequencylist/decodermarkers.json`; a marker of your own in `mymarkers.json` on the same frequency always wins.

> Only one decoder can be active at a time. Switching to a different decoder automatically stops the previous one.
>
> The **QRSS grabber** is not part of this dropdown — it has its own **QRSS** section and can run at the same time as a decoder.

**Decoding runs in the background.** SSTV, HF FAX, NAVTEX, SERVICES, FLDIGI and CW each run in a separate Web Worker thread, so the decoding work never competes with audio playback or the waterfall. Starting or stopping a decoder does not interrupt the audio, and the interface stays responsive while a picture or a page is being received. All decoders are fed raw audio taken *before* noise reduction and mute — so muting the receiver, or changing those settings to suit your ears, does not affect decoding. The AGC is different: the receiver applies it before the audio reaches your browser, so the decoders share it with you. While any decoder is open it is therefore held on **Slow**, whichever AGC button is selected, and a small *Slow (decoder)* note next to the AGC heading says so; your own choice returns when the last decoder closes. DRM is the exception: it is decoded on the station's server (chapter 13).

**A running decoder owns the mode and the passband.** Normally the mode follows the band plan in `bands-config.js`: move the dial into a segment marked LSB or AM and the receiver switches to it. While a decoder is running that no longer happens. The decoder holds the mode it needs (USB for most, its own for RADE) and the passband it needs — PSK31 about ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 their full bandwidth, RTTY its shift — and both survive retuning, including a jump to another band. Without this, tuning FT8 on 40 m would flip the receiver to LSB the moment the dial moved, and the narrow decoder passbands would widen back to the full SSB filter.

The band's own mode returns the moment you switch the decoder off. You can still override the mode by hand at any time: the mode buttons are a deliberate choice and always win. The CW decoder holds **CW** in the same way (CW-L stays CW-L), and the link works both ways: starting the CW decoder puts the receiver in CW, and clicking **CW** in the Mode selector starts the CW decoder. Only the CW Browser uses USB, 200–3000 Hz.


### Decoder ID — recognising the mode automatically

Above the decoder buttons sits a **Decoder ID** frame. It answers the question *"what am I listening to?"* when you come across a digital signal you cannot place, and then offers the matching decoder in one click.

It is **off by default** and costs nothing while it is off. Press **On** and leave the signal tuned in. For about half a minute it shows *Listening…* with a progress bar — the timing measurements have to see two complete FT8 cycles before they mean anything — and then it names the mode:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* The **mode** and a **confidence** figure. Green above 75%, amber above 50%, orange below — treat an orange answer as a hint, not a verdict.
* **What was actually measured**: occupied bandwidth, tone spacing, symbol rate, burst length, the UTC grid it fits, signal-to-noise. This is the evidence behind the verdict, so you can judge it for yourself.
* **Use <mode>** starts the right decoder, exactly as if you had pressed its button — and sets the receiver up to work that mode. For the modes that live in the FSK panel it also selects the correct variant — RTTY, Weather RTTY, PSK31 or Olivia.
* Runners-up are listed after **or**. Click one to try it instead, so a wrong first answer costs you nothing.
* **📻** means the frequency you are tuned to is a known calling frequency for that mode, and that this counted towards the ranking.

It never switches your decoder by itself. It only ever suggests. And once you start a decoder — from the button row, from the dropdown, or from Decoder ID's own **Use** button — Decoder ID switches itself off: its job was to choose one, and the decoder now wants the same audio.

**It sets the receiver up for the mode.** Choosing a mode is a decision to work it, so the receiver follows: the tuned frequency moves to the middle of the waterfall and the view becomes about 100 kHz wide around it, the sideband becomes the one that mode is worked on, and the passband narrows to the window that mode lives in — the whole 3 kHz sub-band for FT8, FT4, FT2 and JS8, 1350–1650 Hz for WSPR, 250–750 Hz for NAVTEX, 800–2700 Hz for HF FAX, 900–2600 Hz for SSTV, and ±250 Hz either side of the dial for CW, which also switches the receiver to CW. A narrow passband keeps the neighbouring signals out of the decoder, which is what you would have done by hand. Two exceptions: SSTV keeps the sideband it chose for itself — LSB on 80 and 40 m by convention, where forcing USB would invert its tone mapping — and the FSK modes keep the window their own panel derives from the variant's shift or bandwidth, which is tighter than any fixed figure. Pressing **Use** for the decoder that is already running still switches it off, and then the receiver is left exactly as it was.

**The slow modes take longer.** WSPR sits on a two-minute grid and SSTV pictures run for a minute or two, so those two are named later than the rest — give them three or four minutes on frequency. HF FAX and SSTV are also recognised only when they are tuned the usual way — the picture band sitting between about 1500 and 2300 Hz in the audio, which is where their decoders expect it too. Retuning starts the measurement again from scratch, because everything gathered so far describes the frequency you have just left.

**What it recognises:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY at 45.45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV and DSC. **Use DSC** starts SERVICES on DSC (chapter 12).

**Recentre & retry.** Where the signal sits in the audio passband makes no difference between about 400 Hz and 2700 Hz. Outside that range the measurement degrades, and an amber **Recentre & retry** button appears. Pressing it moves the dial so that the signal lands in the middle of the passband, and starts a fresh measurement. It is a single calculated move, not a search.

**Three honest limits:**

* **FT8, JS8 and FT2 are the same signal.** The same 8-FSK modulation, the same tone spacing, and JS8 at Normal speed uses FT8's 15-second cadence. Nothing in the signal itself separates them. Frequency does: on an FT8 calling frequency it reports FT8, on a JS8 one it reports JS8, and anywhere else it honestly reports the family — *FT8 / JS8 / FT2*. Start either decoder and see which one produces text. FT2 has a faster rhythm of its own (3.75 s) that is not measured, so an FT2 signal is usually not named at all.
* **It goes quiet rather than guessing.** Below roughly 10 dB signal-to-noise it reports *Nothing above the noise* or *Not recognised* instead of naming a mode it cannot really see. This is deliberate: a confident wrong answer is worse than no answer at all. The 10 dB is measured across the signal's own width, so narrow modes go much deeper: in a normal 2.5 kHz receiver bandwidth FT8 is named down to about −5 dB, FT4 to about 0 dB, and WSPR and CW to about −10 dB.
* **A fading signal is read a different way.** WSPR transmits for 110 seconds without a break, which is longer than an ordinary QSB fade, so a deep fade cuts the transmission into pieces and its two-minute rhythm can no longer be read from them. It is then recovered by another route — matching the whole listening history against the two-minute grid instead of against single transmissions — and the evidence line says *120 s grid (through fading)*. That is weaker evidence than a transmission heard whole, so the confidence shown is deliberately lower. A fade deep enough to bury the signal in the noise cannot be recovered at all, and Olivia is stricter than the rest: it will not be named until its symbol rate has been measured, so it falls silent earlier than the other modes.

---

## 2. FT8

**What it is:** FT8 is a popular weak-signal digital mode used by amateur radio operators worldwide. Transmissions last exactly 15 seconds, and the protocol can copy signals up to 20–25 dB below the noise floor. It is the most commonly used mode for long-distance (DX) contacts.

### Recommended frequencies (USB)

| Band | Frequency |
|------|-----------|
| 160m | 1.840 MHz |
| 80m  | 3.573 MHz |
| 40m  | 7.074 MHz |
| 30m  | 10.136 MHz |
| 20m  | 14.074 MHz |
| 17m  | 18.100 MHz |
| 15m  | 21.074 MHz |
| 12m  | 24.915 MHz |
| 10m  | 28.074 MHz |

### Setup

1. Tune to an FT8 frequency listed above and set mode to **USB**.
2. Enable the decoder and select **FT8** from the dropdown. Or simply press the **FT8** button.
3. The **FT8 Messages** panel appears automatically below.

### Reading the output

The message list shows decoded transmissions as they arrive. Each 15-second cycle produces a new batch of messages. The **Farthest** field (top-right of the panel) shows the greatest distance decoded in the current session in kilometres. A long message ends in “…”: click its row to read the whole message, wrapped, and click again to close it. While a row is open the list stays where it is; otherwise it follows the newest messages. FT4 and FT2 use the same list.

Typical message format: `CQ DX AA1BB FN31` — a CQ call from callsign AA1BB located in grid square FN31.

The **SNR** shown with each decode is a real signal-to-noise ratio, measured on the decoded signal against the noise around it and referred to a 2500 Hz bandwidth, the way WSJT-X reports it. Weak stations read negative, down to about −20 dB, and strong ones positive; on the same recordings the two programs agree on average, typically within about 3 dB for a single decode. FT4 and FT2 use the same method.

**Busy bands and weak stations.** Each decoded station is subtracted from the audio and the rest is decoded again, up to three times, as WSJT-X does, so a station hidden under a stronger one next to it still comes out; on recordings from real bands the decoder finds 86–88 % of what WSJT-X finds. When the normal error correction gives up on a weak FT8 signal, a deeper one (ordered-statistics decoding) tries again; it is held to strict checks, so noise does not turn into made-up messages. FT4 and FT2 use the subtraction too.

> **After an update:** the FT8/FT4/FT2 decoder is a separate file that browsers keep for a long time. If every SNR still sits between about 0 and +5 dB, reload the page with a hard refresh (**Ctrl+Shift+R**, or **Cmd+Shift+R** on a Mac).

> **Tip:** FT8 is tightly time-synchronised. Your browser uses your computer clock; if your system clock drifts by more than a couple of seconds, decoding will fail. Keep your system time synchronised to NTP.

---

## 3. FT4-FT2

**What it is:** FT4 is a faster variant of FT8 designed for contest-style operation. Each transmission cycle is 7.5 seconds (half of FT8), making it twice as fast but requiring a slightly stronger signal. FT2 is an even faster variant of FT8. It is an ultra-fast 77-bit mode with TR periods of 3.75 seconds (= 1/2 of FT4) — still experimental.

### Recommended frequencies (USB)

| Band | Frequency FT4|
|------|-----------|
| 80m  | 3.575 MHz |
| 40m  | 7.047 MHz |
| 30m  | 10.140 MHz |
| 20m  | 14.080 MHz |
| 15m  | 21.140 MHz |
| 10m  | 28.180 MHz |

| Band | Frequency FT2|
|------|-----------|
|160m | 1.843 to 1.846 |
|80m   | 3.578  to  3.581 |
|60m   | 5.360 (Check local regional regulations) |
|40m   | 7.052  to 7.062 |
|30m   | 10.144 |
|20m   | 14.084 |
|17m   | 18.108 |
|15m   | 21.144 |
|12m   | 24.923 |
|10m   | 28.184 |

### Setup

1. Tune to an FT4 frequency and set mode to **USB**.
2. Enable the decoder and select **FT4** or **FT2** from the dropdown. Or simply press the **FT4** / **FT2** button.
3. The **FT4 Messages** or  **FT2 Messages** panel appears below, identical in layout to the FT8 panel.

> **Note:** FT4 and FT8 use different spectral formats and are not interchangeable. Make sure you are on an FT4 frequency when using this decoder.

> **Clock:** FT4 and FT2 also decode when your computer clock or the audio path is up to about a second late (FT2 about 0.9 s); the decoder's own timing then corrects itself from the decodes.

---

## 4. JS8

**What it is:** JS8 (the mode used by JS8Call) takes FT8's weak-signal engine and turns it into a keyboard-to-keyboard conversation mode. Where FT8 sends fixed 13-character exchanges, JS8 sends free text a few characters at a time and stitches consecutive transmissions back into whole sentences — so anything longer than about twelve characters arrives over several 15-second cycles. It decodes about as deep as FT8, which makes it usable when voice and CW are not.

### Recommended frequencies (USB)

| Band | Frequency |
|------|-----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Speeds

JS8 has five speeds. Every station in a conversation must use the same one. **Normal** is the calling speed and is where almost all activity is — start there.

| Speed | Cycle | Bandwidth | When it is used |
|--------|-------|-----------|-----------------|
| Slow   | 30 s  | 25 Hz  | Very weak paths; the most sensitive |
| Normal | 15 s  | 50 Hz  | The standard calling speed |
| Fast   | 10 s  | 80 Hz  | Quicker exchanges, needs a stronger signal |
| Turbo  | 6 s   | 160 Hz | Strong local signals |
| Ultra  | 4 s   | 250 Hz | Experimental, rarely seen on the air |

### Setup

1. Tune to a JS8 frequency and set mode to **USB**.
2. Enable the decoder and select **JS8** from the dropdown, or simply press the **JS8** button.
3. The **JS8 Decoder** panel appears below. Leave **Speed** on *Normal* unless you know the station you are after is using another.

### Reading the output

The panel has two lists.

**Messages still arriving** appear at the top in green, with a blinking cursor. A JS8 message can take four cycles — a full minute on Normal — so this is where you watch a sentence build up. Nothing has gone wrong if it sits there for a while.

**Completed messages** fill the main list, one row each:

| Column | Meaning |
|--------|---------|
| Mode | Always `JS8` |
| Hz | Audio frequency of the signal inside the passband |
| dB | Signal-to-noise ratio in a 2500 Hz reference bandwidth |
| Message | The decoded text; **callsigns are shown in green** |

Typical messages:

* `SV1BTL KM17: HB` — a heartbeat: the station is announcing it is on the air, with its grid square.
* `KN4CRD: K0OG SNR -05` — a directed message: KN4CRD tells K0OG it is hearing them at −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — free text, in this case a station description that arrived over four cycles.

A message shown **dimmed and in italics** timed out before its last frame arrived. The text is real, but it may be cut short.

### Sync offset

The **Sync offset** slider sets how long after the UTC cycle boundary the receiver starts capturing, which compensates for delay through the audio pipeline. Leave **Auto** ticked: the decoder measures the timing of the signals it hears and adjusts on its own. Only touch the slider if you have a reason to.

### Spectrum marks

The small spectrum strip in the panel draws a yellow vertical line at the frequency of every signal decoded in the last cycle, so the Hz column can be read straight off the display.

### Seeing your own spots

If the receiver is uploading JS8 spots to PSK Reporter (see the admin panel's Spot Reporting tab), the **📡 JS8 map** button in the **Note:** panel opens PSK Reporter's map filtered to this receiver's callsign and mode JS8 — the same thing the **📡 FT8 map** and **📡 FT4 map** buttons do for those modes.

> **Tip:** JS8 is much quieter than FT8. On a mid-band afternoon you may see one transmission every couple of minutes, and long stretches of nothing at all are normal. Give it five or ten minutes before concluding something is wrong. 20m (14.078) and 40m (7.078) are the usual places to look.

> **Tip:** Like FT8, JS8 is tightly time-synchronised and uses your computer's clock. If your system time drifts by more than a second or two, nothing will decode. Keep it synchronised to NTP.

---

## 5. CW — Morse Code

**What it is:** The CW decoder listens for Morse code (continuous wave) signals and converts them to text in real time. It automatically tracks the signal frequency and adapts to the operator's sending speed.

### Recommended frequencies

CW is active across amateur bands, typically at the lower portion of each band. Common spots:

| Band | Segment |
|------|---------|
| 40m  | 7.000–7.040 MHz |
| 20m  | 14.000–14.070 MHz |
| 15m  | 21.000–21.080 MHz |

### Setup

1. Tune to a CW signal. Starting the decoder switches the receiver to **CW** (CW-L stays CW-L); clicking **CW** in the Mode selector starts the decoder as well.
2. Enable the decoder and select **CW** from the dropdown. Or simply press the **CW** button.
3. The **CW Decoder** panel appears below.

### Reading the output

- The panel header shows the detected signal frequency in Hz (e.g. `≈ 700 Hz`) and the estimated sending speed in words per minute (e.g. `· 22 WPM`).
- If no signal is detected the header shows **scanning…**
- On an empty channel nothing prints, and the speed and tone are not shown. The decoder only starts printing when there is a clear difference between key-down and key-up, which plain noise does not produce, while a signal still readable at about −10 dB has plenty.
- Decoded text scrolls in amber monospaced text. The blinking cursor (▋) marks where text is currently being written.
- The **Pitch** slider before **Clear** sets the audio tone of the CW signal while the decoder runs: 500 to 800 Hz in 50 Hz steps, 600 Hz until you change it. Your browser remembers the choice. Plain CW listening is at 600 Hz too.
- **Save** writes the decoded text to a file; **Clear** erases it.

> **Tips:**
> - Centre your passband on the CW tone. The decoder works best when the CW signal sits between roughly 400–900 Hz in the audio spectrum.
> - Speeds from about 8 to 40 WPM are copied, including Farnsworth sending (characters sent fast with longer gaps between them): the speed lock holds and letters are not split into separate words. Heavily hand-keyed (irregular) Morse may still reduce accuracy.
> - The decoder performs best on a single clean signal. Strong QRM from nearby signals on the same band may confuse it.
> - Fading (QSB) is followed: a signal that fades and comes back keeps being read, and the first word of a transmission is read too — also at the start of a reply after a pause in the QSO.
> - Each letter is decided on the signal itself rather than on the dots and dashes counted first, which roughly halves the wrong letters on weak and hand-keyed signals.

### CW Browser — every signal at once

Switch on the **Browser — all signals** knob in the CW window to decode every CW signal between 200 and 3000 Hz at once, one line each, like the PSK and Olivia browsers. While it runs the receiver is held on **USB** with a 200–3000 Hz filter; your own mode and filter come back when you switch it off.

- Each line shows the signal's frequency (the carrier, in kHz), its speed, the station's callsign — green with **CQ** when it calls CQ — and its text. Click a line to switch to **CW** on that station with the normal decoder.
- A signal gets its own decoder once it has been on for about two seconds; the last few seconds are decoded too, so its first words are not lost. When a station stops, its line stays for a minute, then goes.
- Stations 40 Hz apart are kept apart, and signals down to about −6 dB (in 3 kHz) read well. Lines that do not look like Morse text (a data signal, noise) are not shown, and neither are the keying sidebands of a strong station, which can stand out of the noise up to about 160 Hz either side of it.
- The callsign is the one sent twice or more, otherwise the one after **DE** or **CQ**; letters that came out spaced apart ("Y O 8 B N C") are joined back up.
- Each line keeps its last 4000 characters in a box about six lines tall: once it holds more than six lines it gets its own scroll bar (the mouse wheel works too), and the box holds still while you read. **Save** writes every line — with time, frequency, speed and callsign — including the lines already dropped.
- About two dozen stations at once cost roughly 10 % of one processor core in the listener's browser; the receiver is not loaded at all.

---

## 6. QRSS Grabber

**What it is:** QRSS is CW sent so slowly that a single dot lasts seconds instead of milliseconds. At that speed the signal occupies only a fraction of a hertz, so an analysis narrow enough to match it can pull the trace out from 20–30 dB *below* the noise floor. There is nothing to read by ear — QRSS is **looked at**, not listened to. The grabber runs its own very long FFT over the receiver audio and paints the classic grabber display: frequency on the vertical axis, time scrolling from left to right, the newest column always at the right-hand edge.

Most of what you will see comes from MEPT beacons (Manned Experimental Propagation Transmitter) — low-power transmitters, often a few hundred milliwatts into a wire, identifying continuously in very slow Morse or in patterned FSK.

### Where to look

QRSS beacons live in narrow 100–200 Hz windows near the bottom of each band. You do not have to remember them: the grabber has a **Band** list of the windows below, and picking one tunes there and sets the receiver up for it (see *Opening the grabber*).

| Band | Window centre | Note |
|------|---------------|------|
| 30m  | 10,140.00 kHz | The main QRSS window — busiest by far, day and night |
| 40m  | 7,039.90 kHz | |
| 40m  | 7,000.85 kHz | Knights window, 7,000.8–7,000.9 kHz |
| 20m  | 14,096.90 kHz | |
| 80m  | 3,569.90 kHz | |
| 80m  | 3,568.60 kHz | Older window |
| 80m  | 3,500.85 kHz | Knights window, 3,500.8–3,500.9 kHz |
| 160m | 1,837.90 kHz | |
| 160m | 1,843.30 kHz | Older window |
| 630m | 476.10 kHz | |
| 2200m | 137.70 kHz | LF QRSS / DFCW |
| 60m  | 5,288.55 kHz | |
| 17m  | 18,105.90 kHz | |
| 15m  | 21,095.90 kHz | |
| 12m  | 24,925.90 kHz | |
| 10m  | 28,125.70 kHz | |
| 10m  | 28,000.85 kHz | Older window |
| 10m  | 28,322.00 kHz | Alternative |
| 6m   | 50,294.30 kHz | |

Several bands appear twice because two conventions are genuinely in use. The modern windows sit 200 Hz below that band's WSPR frequency; the older *Knights* windows are somewhere else entirely, and on 40 and 80 m much lower down. If a band is quiet on one, try the other.

These are conventions, not regulations, and some are regional — the 10 m figures in particular vary. Treat the list as a starting point and follow local practice.

### Opening the grabber

The QRSS grabber is **not** in the Decoder dropdown. It has its own **QRSS** section, alongside the Spectrogram and Decoder controls.

1. Click **🐌 Show**. The grabber canvas appears and its controls unfold next to the button.
2. Pick a window from the **Band** list and press **Tune**. This does everything the mode needs in one step: it tunes to the window, switches the receiver to **CW**, and sets a passband just wide enough for the slice you are watching. The dial then reads the true QRSS frequency, and the traces land on the centre line of the display.
3. Set **Speed** to match the beacon's dot length.
4. **Centre** and **Span** work as before; changing either re-shapes the passband to match, so the display and the receiver stay in step.
5. Click **🐌 Hide** to stop. The band's normal mode comes back.

You can still do it by hand instead — tune in **USB** about 1 kHz below the window so the traces land near 800 Hz of audio. The **Band** list only saves you the arithmetic.

While a window from the list is tuned, the grabber holds the receiver the way a decoder does: CW and its passband survive retuning, and the window follows the dial, so the trace stays on the centre line as you hunt along the band. It hands the receiver back when you hide the grabber, click a mode button, or start a decoder.

### Speeds

| Setting | Dot length | Resolution | Analysis window | New column every |
|---------|-----------|------------|-----------------|------------------|
| QRSS 3  | 3 s  | 0.73 Hz | 1.4 s  | 0.7 s  |
| QRSS 6  | 6 s  | 0.37 Hz | 2.7 s  | 1.4 s  |
| QRSS 10 | 10 s | 0.18 Hz | 5.5 s  | 2.7 s  |
| QRSS 30 | 30 s | 0.09 Hz | 10.9 s | 5.5 s  |
| QRSS 60 | 60 s | 0.05 Hz | 21.8 s | 10.9 s |

A setting faster than the beacon wastes sensitivity — the trace comes out thin and noisy. A setting slower than the beacon smears consecutive dots and dashes into one bar. The panel opens at **QRSS 6**, which is a reasonable place to start on an unknown signal: it is more sensitive than QRSS 3, and quicker to update and more forgiving of drift than QRSS 10. Once you can see the shape of the keying, move to the speed the beacon is actually sending — every step up in speed setting costs 3 dB of sensitivity.

### Controls

| Control | What it does |
|---------|--------------|
| **Band** | The QRSS windows listed above. **Tune** goes to the selected one in CW with a matching passband. |
| **Speed** | Sets the transform length — the trade between frequency resolution and time resolution (table above). |
| **Centre** | Audio frequency at the middle of the display, 100–3000 Hz. |
| **Span** | Height of the displayed slice: 20, 50, 100 or 200 Hz, opening at 100 Hz — the width of a QRSS sub-band. A narrower span spreads each trace over more pixels. Wider spans fit more bins into the panel than it has pixel rows; each row then shows the strongest bin it covers, so nothing can hide between rows. |
| **Gain** | −10 to +40 dB. Shifts the colour map relative to the measured noise floor; raise it to brighten faint traces. |
| **Color** | Rainbow, Green or Grayscale. |
| **Clear** | Wipes the canvas and resets the noise reference. |

### Reading the display

Frequency ticks run down the left edge, highest frequency at the top. Under the canvas a status line shows the selected speed, the resolution actually in use (e.g. `0.183 Hz/bin · 5.5 s window`) and the column rate (e.g. `2.7 s/column`).

The colour map is referenced to the **current** noise, measured continuously from the empty parts of each column, not to an absolute level. Volume, AGC, antenna and band changes therefore do not require re-adjusting Gain — the display keeps a constant contrast against whatever the band noise happens to be. As with the decoders, the audio is taken before noise reduction and mute, so you can mute the receiver and keep watching.

What the shapes mean:

- A **steady carrier** draws a straight horizontal line.
- **Slow Morse** draws that line as a chain of short and long segments — dots and dashes read left to right.
- **Curved or drifting traces** are an unstabilised beacon oscillator warming up or cooling down. This is normal, and the drift signature is often how a regular grabber-watcher recognises a station.
- **Vertical streaks** across the whole slice are static crashes or local noise bursts, not signal.

> **Tips:**
> - Be patient. At QRSS 30 a single column takes 5.5 seconds, so a complete callsign can take ten minutes or more to cross the screen. Leave it running.
> - Tuning from the **Band** list already narrows the passband around the window. If you tuned by hand, do it yourself: it does not change what the transform resolves, but it keeps strong neighbours from working the receiver's AGC.
> - The grabber is independent of the decoders — you can leave it running while a decoder works on something else.
> - A wide span at a slow speed is the heaviest combination; the whole transform runs in the browser, so on a modest machine prefer a 50 Hz span.

---

## 7. WSPR

**What it is:** WSPR (Weak Signal Propagation Reporter, pronounced "whisper") is an ultra-weak-signal beacon mode that maps HF propagation paths worldwide. Each transmission takes approximately 110 seconds and fits inside a 200 Hz-wide slot. The decoder waits for a complete 2-minute UTC-aligned slot before decoding.

### Recommended frequencies (USB, dial)

| Band | Dial frequency |
|------|---------------|
| 160m | 1.836.600 MHz |
| 80m  | 3.568.600 MHz |
| 40m  | 7.038.600 MHz |
| 30m  | 10.138.700 MHz |
| 20m  | 14.095.600 MHz |
| 17m  | 18.104.600 MHz |
| 15m  | 21.094.600 MHz |

### Setup

1. Tune to a WSPR dial frequency above and set mode to **USB**.
2. The WSPR signal occupies the 1400–1600 Hz audio range. Selecting **WSPR** does the rest for you: the receiver switches to USB and the passband narrows to 1350–1650 Hz, which covers the whole range the decoder searches. You do not need to adjust it further.
3. Enable the decoder and select **WSPR** from the dropdown. Or simply press the **WSPR** button.
4. The **WSPR-2 Decoder** panel appears below.

### Reading the output

The panel shows a progress bar for the current 2-minute slot:

- **Cyan bar filling** — collecting signal data (0–116 s into the slot).
- **Amber bar pulsing** — decoding in progress (last ~4 s of the slot).
- **Empty bar** — waiting for the next even UTC minute.

Each successfully decoded spot is shown in a table with the following columns:

| Column | Meaning |
|--------|---------|
| UTC | Time of the spot (even minute) |
| Callsign | The station that transmitted |
| Grid | Maidenhead locator of the transmitter |
| Power | Transmitted power in dBm |
| Freq | Exact audio frequency (Hz) within the WSPR passband |
| SNR | Signal-to-noise ratio in dB |

Click **Clear** to erase the spot list.

On a busy band the decoder works the way WSJT-X does: it takes up to 40 candidates per slot, subtracts every station it has decoded and searches again, up to three passes, so the weaker stations between strong ones are found as well.

> **Tip:** WSPR decoding requires very accurate system time (within ±1 second of UTC). The first slot after enabling the decoder will begin at the next even UTC minute — a short wait is normal.

---

## 8. HF FAX / WEFAX

**What it is:** HF Radiofax (also known as WEFAX) is used by coast guard and meteorological services worldwide to broadcast weather maps, sea-state charts, and surface analyses over shortwave. The decoder reconstructs the image line by line as it is received.

### Setup

1. Enable the decoder and select **HF FAX / WEFAX** from the dropdown. Or simply press the **FAX** button.
2. The **HF FAX / WEFAX Receiver** panel appears below.
3. **Select a station** from the Station dropdown. Over 20 stations are available covering Europe, Asia, Oceania, and the Americas (e.g. DDH3/DDK3 Germany, SVJ4/GR Greece, JMH Japan, NMG USA New Orleans, CBM Punta Arenas Chile). The timetables follow the NOAA worldwide radiofax schedule (edition of 7 March 2025); Charleville (VMC, Australia) includes its extra broadcasts on 11030 kHz only.
4. If the station broadcasts on more than one frequency, select the desired frequency from the **Frequency** sub-dropdown.
5. Click **▶ Tune** to automatically tune the waterfall to that station.
6. The mode is forced to **USB** automatically.

### Broadcast schedule

When a station is selected, a **Next Transmissions** countdown table appears showing the next 4 scheduled broadcasts in UTC, with a live countdown:

- Normal (grey/green) — transmission is coming up.
- **Amber ⚡** — transmission starts within 3 minutes; arm the decoder now.
- **Red ●** — transmission starts within 30 seconds; reception is imminent.

### Parameters

Most stations use the standard defaults (marked ★). Change only if you know the station uses non-standard settings.

| Parameter | Default | Description |
|-----------|---------|-------------|
| LPM | 120 ★ | Lines per minute — the drum rotation speed |
| IOC | 576 ★ | Index of cooperation — determines pixels per line |
| Shift | 800 Hz ★ | Frequency shift between black and white tones |

### Controls

- **⇔ Auto-align** — enabled by default. Automatically synchronises to the phasing signal at the start of each image. Disable only if you are experiencing alignment problems on a known-good signal.
- **⇅ Invert** — swaps black and white. Use if the image appears as a negative (white areas where black should be).
- **↺ Refresh** — clears the canvas and resets the decoder. Use this between transmissions or if the image tears or drifts.
- **⤓ Save PNG** — saves the current canvas as a PNG file to your computer.

### Status indicators

At the bottom of the image, two tone indicators show:

- **300 Hz phasing** — lights cyan when the start-of-image phasing tone is detected.
- **450 Hz stop** — lights red when the end-of-image stop tone is detected.

Both signals are recognised by their rhythm across the whole width of a line, which the real start and stop signals always fill and chart content practically never does, so hatched areas in a chart are not taken for a start signal. They are recognised down to about 0 dB SNR, and on very weak signals the image is lined up from the average of several phasing lines, so the chart still starts at the left edge.

> **Note:** The image scrolls upward — the newest received line always appears at the bottom of the canvas. If you see **[PHASING]** in the header, the decoder has locked onto a new image start.

---

## 9. NAVTEX

**What it is:** NAVTEX is the international maritime broadcast system for coastal safety information — navigational warnings, weather forecasts, and search-and-rescue notices. It uses 100-baud FSK (SITOR-B with FEC) and is received on dedicated channels worldwide.

### Available channels

| Channel | Frequency | Usage |
|---------|-----------|-------|
| International | 518 kHz | English-language, international |
| Domestic | 490 kHz | National language broadcasts |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | Long-range HF NAVTEX |

### Setup

1. Enable the decoder and select **NAVTEX** from the dropdown. Or simply press the **NAVTEX** button. The receiver switches to **USB** automatically.
2. The **NAVTEX Receiver** panel appears.
3. Select the desired channel from the **Station** dropdown (e.g. `International — 518 kHz`).
4. Click **⇒ Tune & Set IF** to automatically tune the waterfall and narrow the passband to the correct audio window. Mode is set to **USB** automatically. The dial is placed 500 Hz below the channel centre, so the NAVTEX signal appears at 500 Hz audio. The frequency display still reads **518.000**: while HF FAX, NAVTEX or the FLDIGI window is on, it shows the signal's own frequency (the dial plus the decoder's audio centre — 1900 Hz for FAX, 500 Hz for NAVTEX, the panel's centre for FLDIGI), and a frequency typed then is taken as the signal's.

### Broadcast schedule

The schedule table lists all known stations on the selected channel with:

- Their ITU identifier letter and country flag
- Next broadcast time in UTC
- Live countdown to the next transmission
- **Amber ⚡** within 2 minutes / **Red ●** within 30 seconds — arm the decoder now

### Reading the output

Decoded text appears in teal monospace. Message boundaries are clearly marked:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marks the start of a message. The four characters after it identify the station (`M`), subject (`A` = navigational warnings), and sequential number (`12`). The banner waits for the whole header, so it reads `ZCZC MA12`, not `ZCZC ????`. `NNNN` marks the end.

If you tune in after a message has started, or its header is lost to noise, the text still appears, under a **━━ (header missed) ━━** banner. That banner only opens once several characters in a row arrive with both of their NAVTEX transmissions agreeing, which noise practically never produces. It closes at `NNNN` as usual, with **━━ (signal lost) ━━** if the signal disappears first, or when a new message begins. A weak signal keeps its sync through corrupted characters: every NAVTEX character is sent twice, so the decoder holds on through errors and lets go only when the signal is really gone, and if it locked one bit away from the true character boundary it moves to the right one without closing the message. At −6 dB in 2.5 kHz this roughly doubles the text that gets through.

Click **Clear** to erase the message buffer.

> **Note:** NAVTEX operates on MF and LF frequencies (518/490 kHz). Reception range is typically 200–400 nautical miles from the transmitter. The HF channels (4–17 MHz) provide much greater range.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet and APRS

**What it is:** One window for the narrow-band keyboard modes that the program fldigi made popular, with sixteen variants selected from one dropdown. Three are true FSK (Frequency-Shift Keying): Maritime FSK (SITOR), Weather RTTY and Amateur RTTY. The others share the same window: **PSK31** (also **PSK63** and **PSK125**, each in BPSK or QPSK), which is phase-shift keying; **Olivia** (with its sibling **Contestia**) and **MFSK16/32/64**, multi-tone modes with forward error correction; **DominoEX** and **THOR**, incremental frequency keying (THOR with error correction); **THROB**, two tones at once, one character per pulse; **Hellschreiber**, which paints text as a picture instead of decoding it; **MT63**, 64 carriers at once; and **Packet (AX.25)** and **APRS**, which decode AFSK packet radio — the 1200 baud packet of VHF/UHF and the 300 baud packet of HF. Each variant comes with a preset tuned to its standard parameters. The button and the dropdown entry are both called **FLDIGI**; the decoding is done here, in the browser, and fldigi itself is not needed.

Three of the variants come from outside fldigi. **ALE 2G** is the automatic link establishment of HF government, military and amateur networks (MIL-STD-188-141), and lists their calls and soundings. **FST4W**, the very slow beacon mode of the 2200 m, 630 m and 160 m bands, and **MSK144**, for meteor scatter on 6 m and 2 m, come from WSJT-X. None of the three prints running text: each lists what it decodes one line at a time, with the time.

### Variants and presets

| Variant | Center | Shift | Baud | Framing | Encoding |
|---------|--------|-------|------|---------|----------|
| Maritime FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Weather RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Amateur RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31·63·125 (BPSK/QPSK) | 1000 Hz | — | 31.25 / 62.5 / 125 | — | Varicode |
| Olivia / Contestia | 1000 Hz | — | see mode | — | 7-bit + FEC |
| FST4W | 1500 Hz | — | 1.46 / 0.56 / 0.18 / 0.09 | T/R 120–1800 s | LDPC + CRC-24 |
| MFSK16·32·64 | 1500 Hz | — | see mode | — | Varicode + FEC |
| MSK144 | 1500 Hz | — | 2000 bit/s | T/R 15 / 30 s | LDPC + CRC-13 |
| DominoEX | 1500 Hz | — | see mode | — | nibble Varicode |
| THOR | 1500 Hz | — | see mode | — | Varicode + FEC |
| THROB / THROBX | 1500 Hz | — | 1, 2 or 4 | — | tone pairs |
| Hellschreiber | 1500 Hz | — | see mode | — | picture |
| MT63 | 1000 Hz (lowest carrier at 500 Hz) | — | 5, 10 or 20 | — | Walsh + interleave |
| ALE 2G | 1625 Hz (tones 750–2500 Hz) | — | 125 | 24-bit words, ×3 | Golay (24,12) |
| Packet (AX.25) | 1200 / 2200 Hz tones, or 1700 Hz at 300 Bd | 1000 Hz, or 200 Hz at 300 Bd | 1200 or 300 | HDLC | AX.25 |
| APRS | as Packet | as Packet | 1200 or 300 | HDLC | AX.25 + APRS |

The panel adapts to the variant you choose. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** and **Auto shift detect** are hidden for every variant except the three FSK ones, because none of the other modes has a mark/space tone pair or UART-style framing. In their place, **Center audio** becomes a free-entry number field (the signal can sit anywhere in the passband), and Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 each gain a **Mode** selector and — all except Hellschreiber — a **Squelch** slider with its own scale. Packet and APRS hide the same FSK controls and show a **Speed** selector instead; APRS also has a **Show raw packet** checkbox. The **Known frequency** list appears only for the variants that have one. ALE 2G replaces all of these with its own **network** and **channel** lists (see its notes). FST4W and MSK144 have no **Mode** or **Squelch**; they show **T/R period** and **F Tol** instead (MSK144 also **Decode**), and **⟳ Auto-tune Center** is hidden for both, because they search the whole **F Tol** range themselves.

### Setup

1. Enable the decoder and select **FLDIGI** from the dropdown. Or simply press the **FLDIGI** button.
2. The decoder panel appears. Its title follows the variant — *FSK / RTTY Decoder*, *BPSK31 Decoder* (or whichever PSK mode is chosen), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* or *APRS Decoder*. ALE 2G shows *ALE 2G Decoder*; FST4W names its period, e.g. *FST4W-120 Decoder*; MSK144 shows *MSK144 Decoder*.
3. Select the **Variant**. The parameters update automatically.
4. For PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63, set **Mode** to match the transmission — see each mode's notes below. For Packet and APRS, set **Speed** — see the Packet and APRS notes below. For ALE 2G, pick a network and a channel; for FST4W and MSK144, set **T/R period** and **F Tol** — see their notes below.
5. Where the variant has one, use the **Known frequency** dropdown to select a common frequency, then click **Tune** to jump to it. The other modes have no fixed calling frequencies: find the signal on the waterfall and use **⟳ Auto-tune Center**.
6. Fine-tune frequency until decoded text becomes stable and readable.

### Known frequencies by variant

**Maritime FSK / SITOR**
- 518.0 kHz — International NAVTEX
- 490.0 kHz — National NAVTEX
- 4209.5 / 6314.0 / 8416.5 / 12579.0 / 16806.5 / 22376.0 kHz — HF SITOR

**Weather RTTY**
- 4583.0 / 7646.0 / 10100.8 / 11039.0 / 14467.3 kHz — DWD (German Weather Service)

**Amateur RTTY**
- 3590 kHz (80m), 7043 kHz (40m), 10143 kHz (30m), 14083 kHz (20m), 21083 kHz (15m), 28083 kHz (10m)

**PSK31**
- 3580.15 kHz (80m), 7040.15 kHz (40m), 10142.15 kHz (30m), 14070.15 kHz (20m), 18100.15 kHz (17m), 21080.15 kHz (15m), 24920.15 kHz (12m), 28120.15 kHz (10m)

**Olivia**
- 3583 kHz (80m), 7040 kHz (40m), 7072.5 kHz (40m), 10143 kHz (30m), 14072.5 kHz (20m), 14108.5 kHz (20m, 32/1000), 18099 kHz (17m), 21072.5 kHz (15m), 24922.5 kHz (12m), 28122.5 kHz (10m)

**FST4W** (the signal's centre; the USB dial goes 1.5 kHz below it)
- 137.5 kHz (2200 m, dial 136.000), 475.7 kHz (630 m, dial 474.200), 1838.1 kHz (160 m, WSPR sub-band, dial 1836.600)

**MSK144** (the same: the dial goes 1.5 kHz below)
- dial 144.360 MHz (2 m, IARU Region 1), 144.150 MHz (2 m, North America), 50.260 and 50.280 MHz (6 m), 70.230 MHz (4 m), 28.145 MHz (10 m)

**MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63**
- No fixed calling frequencies; the list is not shown. Find the signal on the waterfall.

**Packet and APRS** (the same list for both; each entry also sets the right speed)
- 144.800 MHz — APRS in Europe (IARU Region 1)
- 144.390 MHz — APRS in North America
- 145.175 MHz — APRS in Australia
- 144.640 MHz — APRS in China
- 144.660 MHz — APRS in Japan
- 145.825 MHz — the ISS packet digipeater
- 10147.6 kHz — HF APRS on 30 m, USB dial (300 Bd)

### Parameters

| Parameter | Applies to | Description |
|-----------|------------|-------------|
| Center audio (Hz) | all | The audio frequency of the mark/space midpoint; for PSK31 the carrier, for the multi-tone modes the centre of the tone block or carrier group. A dropdown for the FSK variants, a free-entry field for all the others. For Packet and APRS a free-entry field at 300 Bd only; at 1200 Bd the tones are fixed at 1200 / 2200 Hz and the field just shows them |
| Shift (Hz) | FSK only | Frequency difference between mark and space tones |
| Baud | FSK only | Symbol rate |
| Framing | FSK only | Data bits, parity, stop bits (e.g. 7N1 = 7 data, no parity, 1 stop) |
| Encoding | FSK only | Character set (CCIR-476, ITA2/Baudot, or ASCII) |
| Invert mark / space | FSK only | Swaps mark and space tones |
| Auto shift detect | FSK only | Attempts automatic shift measurement from the incoming signal |
| Mode | PSK31 only | BPSK31/63/125, QPSK31/63/125 — must match the transmission |
| Mode (tones / Hz) | Olivia, Contestia only | Number of tones and bandwidth — must match the transmission exactly |
| Squelch (FEC S/N) | Olivia, Contestia only | How strong the error-correction match must be before text is printed |
| Browser — all signals | PSK31, Olivia, Contestia | A knob: decodes every signal of the chosen **Mode** (PSK31: every BPSK31 signal) between 300 and 2700 Hz at once, one line each — see the PSK Browser and Olivia notes |
| Mode | MFSK, DominoEX, THOR, THROB, Hellschreiber, MT63 | The sub-mode (speed, bandwidth, interleave) — must match the transmission |
| Squelch (FEC metric) | MFSK | The 0–100 decoding quality the signal must reach before text is printed; default 22 |
| T/R period | FST4W, MSK144 | FST4W: 120, 300, 900 or 1800 s — must match the transmission. MSK144: 15 or 30 s; a message repeated within one period is listed once |
| F Tol | FST4W, MSK144 | How far either side of **Center audio** the decoder searches: ±50, 100 or 150 Hz for FST4W, ±50 to ±300 Hz for MSK144 |
| Decode | MSK144 | **Fast**, **Normal** or **Deep** — how thoroughly each block is searched; Deep finds the most and uses the most CPU |
| Squelch (tone / noise) | DominoEX, THOR | 0–100: the current tone against the floor of the other tone bins; default 25 |
| Squelch (S/N) | THROB | In dB; default 4 |
| Squelch (FEC S/N) | MT63 | The Walsh-code match quality; default 4 |
| Reverse | FSK Hell 245 / 105, Hell 80 | Paints the other tone as ink |
| Speed | Packet and APRS | **1200 Bd · VHF/UHF (FM)** or **300 Bd · HF (USB)**. It also chooses the receiver mode |
| Show raw packet | APRS only | Also prints the packet as received (TNC2 format) above each decoded line |
| Squelch (SNR) | Amateur and Weather RTTY | Stops noise printing as random letters. Starts at −5 dB for Amateur RTTY and −7 dB for Weather RTTY; the far left (**off**) disables it. The SNR figure turns grey while the squelch is closed |

### Signal metrics

The status bar shows live measurements, and the fields change with the variant:

| Variant | Fields shown |
|---------|--------------|
| FSK variants | **Mark / Space** (measured tone frequencies), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, after automatic frequency correction), **IMD** (dB), **SNR**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |
| PSK Browser, Olivia Browser | **Signals** (how many lines are on screen) |
| MFSK16 / 32 / 64 | **Centre** (Hz, after automatic frequency correction), **Mode**, **S/N**, **FEC** (%), **Sync** |
| ALE 2G | **Dial** (warns when it is not a listed channel), **In sync**, **Events** |
| FST4W | **Period** (how much of the current period has been recorded), **Search** (Hz), **Decodes** |
| MSK144 | **Search** (Hz), **Decodes**, **CPU** (the share of real time the decoder needs; above 100 % it falls behind) |
| DominoEX, THOR, THROB, MT63 | **Centre** (Hz; THROB and MT63 after automatic frequency correction), **Mode**, **S/N**, **Quality** (%), **Sync** |
| Hellschreiber | **Centre**, **Mode**, **Audio** (input level, dBFS) |
| Packet and APRS | **Tones** (Hz), **DCD** (lit while a packet is on the air), **Frames** (packets decoded), **Stations** (different callsigns heard), **Audio** (input level, dBFS) |

`Timing`/`Sync` reads `LOCKED`/`SYNCED` once the decoder is tracking, and `SEARCH` while it is still hunting.

**SNR** for the FSK variants and PSK31 is measured on the signal itself and given in a 3 kHz bandwidth, so the two read on the same scale: within about 1 dB of the true value from +20 dB down to −5 dB. An empty frequency reads about −12 to −15 dB, and for PSK31 0 dB is already a strong signal. Olivia's **S/N** is different: it is the error-correction quality figure. For MFSK, **S/N** is fldigi's tone-to-noise figure and **FEC** its 0–100 decoding quality. For DominoEX and THOR, **S/N** is the received tone against the other tone bins and **Quality** the squelch scale (THOR: its error-correction confidence); for THROB the two-tone S/N; for MT63 the error-correction match. None of these is a 3 kHz SNR: they are the figures the squelch acts on.

Amateur RTTY (45.45 baud, 170 Hz) copies without errors down to about 0 dB, with about 1.5% of characters wrong at −3 dB and 20% at −6 dB.

### Additional controls

- **⇒ Set IF Band-Pass** — narrows the receiver passband to tightly bracket the signal. The width follows the variant: 300 Hz for Amateur RTTY (narrow enough to remove a stronger station 250 Hz away, while still copying a signal tuned 40 Hz off), 594 Hz for Weather RTTY, mark/space plus margin for Maritime FSK, about ±100 Hz for PSK31 (±200 Hz PSK63, ±400 Hz PSK125), the full tone-block width plus margin for Olivia, about ±400 Hz for 300 Bd packet, and the ordinary FM channel for 1200 Bd packet. The passband follows the decoder when **Auto-tune** or **Auto shift detect** moves the tones, and when you change the **Baud** setting. MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 get their full width plus a margin (at least 60 Hz either side, 15 % of the width for the wide modes). ALE 2G gets 500–2750 Hz (mirrored below the dial on an LSB network), FST4W its **F Tol** range plus 150 Hz either side, MSK144 ±1.1 kHz plus **F Tol**.
- **⟳ Auto-tune Center** — automatic search for the signal. For the FSK variants it looks for a balanced pair of tones; for PSK31 it finds the carrier; for Olivia it finds the strongest block of the selected bandwidth; for 300 Bd packet it finds the strongest pair of tones 200 Hz apart. The button is hidden for 1200 Bd packet, where the tones are fixed. **Auto shift detect** only changes the shift when a real two-tone signal is present, so it no longer jumps on noise. MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 are searched the same way as Olivia, over their own width. The button is hidden for ALE 2G, FST4W and MSK144.

### ALE 2G notes

ALE (MIL-STD-188-141, second generation) is how government, military, aid-agency and amateur HF networks find a working frequency: the stations scan a set of channels, send short *soundings* to say they are there, and call each other with a few seconds of an 8-tone signal (125 Bd, 750–2500 Hz).

1. Choose **ALE 2G**, the entry just before Packet in **Variant**. In place of the usual settings the panel shows a **network** list and a **channel** list.
2. Pick a network and one of its channels, then click **⇒ Tune & Set IF**. The listed frequency is the dial; the receiver goes to USB, or LSB for the few networks marked so, with a 500–2750 Hz filter.
3. Wait. Soundings come every half hour or hour, and calls only when a link is needed, so a channel can stay quiet for a long time.

- **Ham (HFLINK)** lists all 31 amateur ALE channels of the HFLINK channel plan, from 475.5 kHz to 144.1625 MHz; 14109 and 7102 kHz are among the main HFLINK sounding and texting channels. The other 51 networks (Govt, Milcom, Utility, and MARS under Amateur) come from KiwiSDR's ALE list. They are public lists and may be out of date.
- Each event shows the time, the frequency, its kind (sounding, call, call acknowledged, link established, message), the **from** and **to** addresses, and any commands or text (AMD and DTM messages). Identical repeats are merged into one line with ×N, and **💾 Save** writes the events to a text file.
- **In sync** counts how many of the 17 decoders, each on its own frequency offset, are reading ALE words at that moment. A signal up to about ±1 kHz off is still found.

### PSK31 notes

PSK31 is the most common keyboard-to-keyboard mode on HF. It is only 62 Hz wide, so several QSOs sit side by side within a few hundred hertz of the watering-hole frequency, and tuning is a matter of picking one trace out of the group on the waterfall.

- The decoder corrects its own tuning error automatically over roughly **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125), so you only need to get close. **Carrier** in the metrics row shows where it actually settled.
- **IMD** measures transmitter quality, not reception: a clean signal reads about −20 dB or better. A poor reading means the other station is overdriving, not that you are mistuned.
- Text appears character by character with no error correction, so a weak signal degrades into occasional wrong letters rather than stopping.
- **PSK63 and PSK125** are the same mode two and four times faster, and as many times wider; **QPSK31/63/125** add error correction (a Viterbi decoder), which repairs short bursts of noise at about the same signal level. Pick the sub-mode in **Mode** — the wrong one prints nothing. Most PSK activity is still BPSK31; PSK63 is common in contests.
- **PSK Browser (BPSK31).** The **Browser — all signals** knob under **Mode** decodes every BPSK31 signal between 300 and 2700 Hz at once, as fldigi's signal browser does: one line per signal (up to 16), with its frequency, its lock quality and the latest text. Signals are found by themselves within a few seconds, and one that stays silent for 30 s is dropped. Click a line to decode only that signal, as ordinary BPSK31 on its carrier. While it runs, **Mode** shows BPSK31 and is locked; switched off, the window goes back to the Mode you had. The passband opens to 200–2800 Hz while browsing. Each line keeps its last 4000 characters in a box about six lines tall, with its own scroll bar once it holds more than six lines (the mouse wheel works too); the box holds still while you read. **Save Text** writes every line, also the ones already dropped. While a browser runs, the settings of the single decoder (Center audio, ⟳ Auto-tune Center and its readouts) are hidden.

### Olivia notes

Olivia trades speed for robustness. It is far slower than PSK31 but decodes signals that are inaudible by ear, which makes it popular for weak-signal and long-distance contacts.

- **The Mode setting must match the transmission exactly.** A wrong tones/bandwidth combination decodes nothing at all — not garbled text, but silence. The panel opens on **8 / 250**, the narrow configuration left running on the calling frequencies; **16 / 500** and **32 / 1000** are the other two in common use, and **16 / 1000** is also offered.
- **Contestia** is Olivia with a smaller error-correction block: about twice as fast, upper case only, and a little less robust. Its configurations are in the same **Mode** list, under *Contestia* (8 / 250 is the usual one, 4 / 125 and 4 / 250 for weak paths); the panel title changes to *Contestia Decoder*. An Olivia setting never decodes Contestia, nor the other way round.
- **Olivia Browser.** Switch on the **Browser — all signals** knob under **Mode** to decode every Olivia (or Contestia) signal of that configuration between 300 and 2700 Hz at once, one line each, in the same way as PSK Browser; click a line to decode only that signal. It works one configuration at a time: on **8 / 250** it does not see 16 / 500 stations. Because Olivia is used below the noise, it does not look for signals by their strength: the passband is covered by about a dozen decoders side by side (about 5 % of one processor core), so a station appears once its first characters are decoded, a few seconds after it starts. Within one bandwidth only the strongest copy is shown, and a line appears only once it holds a few characters of real text.
- Olivia sends no preamble, so the decoder has to search for synchronisation. **Allow a few seconds** after tuning before text appears. The **Sync** field shows `SEARCH` until it locks.
- The error correction works on blocks, so text arrives in **bursts rather than a steady stream**, and there is a delay of several blocks between transmission and display.
- **Squelch (FEC S/N)** sets how confident the error correction must be before printing. The default of 4.0 keeps noise out; 3.0 is the floor, below which random noise starts printing occasional characters. A good signal reads 8–9 on the **FEC** meter, so there is plenty of room to raise the squelch on a busy band.
- When a transmission ends, the text simply stops. Each block is also checked on its own, so the few blocks the squelch still lets through while it settles no longer print a burst of random characters.

### FST4W notes

FST4W is the WSJT-X beacon mode for the low bands, where it follows WSPR: four tones carrying a callsign, a locator and a power, sent once per T/R period of 2, 5, 15 or 30 minutes. The longer the period, the weaker the signal it decodes: about −31 dB SNR (in 2.5 kHz) for FST4W-120, and real 30-minute signals near −44 dB.

- **It decodes once per period, after the period ends.** Periods start on the UTC clock — FST4W-120 at every even minute, FST4W-1800 on the hour and the half hour — and the **Period** bar shows how much of the current one has been recorded. A period joined part-way through is skipped, because half a message cannot be decoded; the next one is recorded whole. Decoding a 30-minute period takes a few seconds.
- **Pick the right T/R period.** The decoder looks only at the one you choose. Most LF/MF beacons use FST4W-120; FST4W-300, -900 and -1800 are for the weakest paths.
- **F Tol** sets how far either side of **Center audio** (1500 Hz) it searches. WSJT-X's default of ±100 Hz covers the beacon sub-bands; ±150 Hz is the most the passband allows.
- Each line shows UTC, SNR (dB), DT (the time offset, s), the frequency (MHz) and the message, as in WSJT-X, and **Save Text** writes them in the same style.
- The computer's clock must be right to about a second, as for WSPR.

### MFSK16 / MFSK32 / MFSK64 notes

MFSK16, MFSK32 and MFSK64 are the IZ8BLY modes as sent by fldigi: 16 tones, one at a time, spaced one baud apart, protected by convolutional error correction and interleaving. They are faster than Olivia and a little less robust. MFSK16 (15.625 baud, 234 Hz wide) prints cleanly down to about −12 dB SNR in 2.5 kHz, MFSK32 (31.25 baud, 469 Hz) to about −10 dB, and MFSK64 (62.5 baud, 938 Hz) to about −7 dB.

- **Pick the MFSK16·32·64 variant**, then the speed in its **Mode** list. The three modes differ only in speed, and the setting must match: the wrong one prints nothing readable.
- **Tuning:** put the tone block on the **Center audio** frequency, or press **⟳ Auto-tune Center**. The decoder corrects the last quarter of a tone by itself — about ±4 Hz for MFSK16, ±8 Hz for MFSK32 and ±16 Hz for MFSK64 — and **Centre** shows where it settled. A signal further off is found by the decoder itself, up to about ±75 Hz from the set centre: allow a few seconds at the start of a transmission.
- Text lags the signal by a couple of seconds, the time the interleaver and the error correction need. One or two stray characters at the very start of a transmission are normal; fldigi shows them too.
- **Squelch (FEC metric)** holds printing back until the decoding quality reaches the setting. The default of 22 keeps noise out (noise alone reaches about 20); a good signal reads 90 % or more on the **FEC** meter, and 0 turns the squelch off. When a transmission ends with fldigi's end-of-transmission mark, printing stops at once instead of letting a few seconds of noise through.
- MFSK picture transfers are not decoded.

### MSK144 notes

MSK144 is the WSJT-X mode for meteor scatter: signals reflected for a fraction of a second by the ionised trails of meteors, mostly on 6 m and 2 m. Each station repeats its message without a break all through its 15- or 30-second period, 72 ms per message, so a ping of a tenth of a second can carry it.

- **Expect long gaps.** On a quiet band nothing appears for minutes. During the big showers (Quadrantids, Perseids, Geminids) and in the early morning there are many more pings.
- Each line shows UTC (to the second), SNR (dB), T (when the ping came in its period, s), the frequency (MHz) and the message. A message heard again in the same T/R period is listed once, unless the new copy is stronger. Weak copies of the same message are averaged, as in WSJT-X.
- **F Tol** sets how far either side of 1500 Hz the decoder searches; stations are seldom exactly on frequency, so ±100 Hz is a good start. **Decode** sets how hard each block is searched, and **Deep** finds the most. **CPU** in the metrics row shows the load: above 100 % the decoder falls behind, so choose **Normal** or **Fast** on a slow computer.
- The 40-bit short messages (Sh) are not decoded: they need both stations' callsigns, which a listener does not know.

### DominoEX and THOR notes

DominoEX and THOR send 18 tones, one at a time, but a character is not a tone: it is the *step* from the previous tone (incremental frequency keying). The same tone never repeats, and a slow drift of the whole signal cancels out, so both modes forgive a few hertz of mistuning and a drifting transmitter. **DominoEX** sends its characters straight, without error correction: a bad tone costs one character. **THOR** adds the same convolutional error correction and interleaving as MFSK, so it copies through static crashes and fading at the cost of a couple of seconds' delay.

- **Mode** must match the speed being sent. DominoEX offers Micro, 4, 5, 8, 11, 16, 22, 44 and 88; THOR offers Micro, 4, 5, 8, 11, 16, 22 and the fast 25 x4, 50 x1, 50 x2 and 100 (these four use a stronger code and a one-second interleaver). DominoEX 11 and THOR 16 are the most heard.
- **Tuning:** put the tone block on **Center audio**, or press **⟳ Auto-tune Center**. A tuning error of a quarter of the signal's width still copies.
- **Squelch (tone / noise)** compares the received tone with the floor of all the other tone bins, on a 0–100 scale. Noise alone stays at or under 20; readable copy reads 35 and up; the default is 25. This is not fldigi's own figure: fldigi's reads 26 on some perfectly clean signals, which would have made any useful default cut them off. When a transmission ends, printing stops within a few symbols instead of letting noise through.
- The receiver follows fldigi's default settings: three sub-bin paths, hard decisions for DominoEX, soft decisions and preamble detection for THOR. DominoEX's optional MultiPSK error correction (off by default in fldigi) is not decoded, nor is the secondary text channel (the station's idle beacon text) or THOR's picture mode.

### THROB notes

THROB sends each character as one pulse of two tones at once (or one tone for a few characters), from 9 tones (THROB) or 11 (THROBX), at 1, 2 or 4 pulses a second. It is slow but very robust in fading. THROB has only capitals, figures and a few marks; THROBX has a larger set.

- **Tuning is critical.** The tones of THROB 1 and 2 are only 8 Hz apart, so the decoder captures ±3 Hz of mistuning (±6 Hz for THROB 4) and corrects the rest with its own frequency tracking. Press **⟳ Auto-tune Center** first: it finds the signal to within a hertz or two.
- **Mode** must match, THROB or THROBX and the speed.
- **Squelch (S/N)** — noise alone stays under 1 dB, a copyable signal reads 10 dB and up; the default is 4 dB.

### Hellschreiber notes

Hellschreiber is not decoded at all: the transmitter scans each character of a 7 × 14 font column by column, and the receiver *paints* what it hears. The panel therefore shows a picture instead of text, and your eye reads the letters. That is why Hell stays readable when no text mode is: a damaged letter is a smudged letter, not a wrong one.

- **Mode:** Feld Hell (the common one, 245 Hz wide), Slow Hell, Hell X5 and X9 (faster and wider), and the two-tone modes FSK Hell 245, FSK Hell 105 and Hell 80. The speed must match, or the letters come out stretched or squashed.
- **Each line of text is painted twice**, one copy above the other, as fldigi paints it: a small speed difference between the stations slants the text, and one of the two copies is always whole.
- There is no squelch: noise shows as speckle, which the eye ignores. For the two-tone modes, **Reverse** swaps which tone is ink, for a station with the tone order the other way round.
- **Save Picture** saves the picture as a PNG; **Clear** starts a clean page.

### MT63 notes

MT63 sends 64 carriers at once, each carrying one bit per symbol, and spreads every character over all of them and over 32 (short) or 64 (long) symbols in time. A character therefore survives the loss of a good part of its carriers and a burst of noise, which is why MT63 is used for emergency traffic: it copies through interference that wipes out narrower modes.

- **Mode:** MT63-500, -1000 or -2000 (the bandwidth), each with **short** or **long** interleave. Both must match. MT63-1000 long is the most used.
- **Tuning:** fldigi sends the lowest carrier at 500 Hz, so the centre is 500 Hz plus half the bandwidth: 750, 1000 or 1500 Hz, set automatically when you pick the mode. The decoder finds the last 8 carriers of error by itself (±125 Hz for MT63-1000).
- **Text lags the signal** by the interleaver: from about 1.6 s (MT63-2000 short) to 12.8 s (MT63-500 long). The last characters of a transmission arrive after the signal has stopped.
- **Squelch (FEC S/N)** — noise alone reads about 3, a locked signal 4.5 and up; the default is 4. The squelch hides the moment the synchroniser needs to lock at the start.

### Packet and APRS notes

Packet radio sends data in short bursts called frames. Each frame carries the sender's callsign, the destination, the digipeaters it went through, and a checksum. **APRS** (Automatic Packet Reporting System) uses these frames to report positions, weather, messages and status, mostly on one shared frequency per region.

- **Packet** prints every frame, the way a TNC monitor does: time (UTC), `SOURCE>DESTINATION,PATH`, the frame type in angle brackets, then the text. Connected-mode traffic (SABM, UA, I-frames, RR, DISC) shows up as well as broadcasts.
- **APRS** prints only the broadcast frames APRS uses, and turns each into plain text: position with a Maidenhead locator, symbol (car, house, weather station, …), speed and course, altitude, comment, weather readings in metric units, messages and acknowledgements, objects, items, status and telemetry. Compressed and Mic-E positions are decoded too. With **Show raw packet** on, the received packet is printed above its decoded line.
- **APRS map.** Under the decoded text, the APRS variant shows a map of every station heard with a position, the same width and height as the text pane: a labelled marker per station (objects and items under their own name), a track line for moving stations, and an amber marker for this receiver, placed from its grid square. Click a station for its decoded line, when it was last heard, and its distance and bearing from the receiver; click a decoded line in the pane to zoom the map to that station. **Auto fit** (on by default) re-frames the map as stations arrive and move; panning or zooming by hand turns it off, and ticking it turns it back on. **Fit all** frames everything once, **Clear** empties the map, and **–** minimises it to its title bar (**□** brings it back) — stations keep collecting meanwhile. The map images come from OpenStreetMap, so the listener's browser needs internet access to draw them; the decoding itself stays local.
- **Speed 1200 Bd** is the VHF/UHF standard (Bell 202 tones, 1200 / 2200 Hz). The decoder switches the receiver to **FM** and tunes it on the channel itself: pick **144.800 MHz** in Europe, or tune any packet channel and press **⇒ Set IF Band-Pass**. The 12.5 kHz **Wheel Tuning Step** moves along the VHF channel grid.
- **Speed 300 Bd** is HF packet, two tones 200 Hz apart. The receiver goes to **USB** and the dial is the published frequency; the tones sit at 1600 / 1800 Hz. Use **⟳ Auto-tune Center** if the signal is a little off.
- **Only frames with a correct checksum are printed**, so noise never prints as garbage — a quiet pane means a quiet channel. If **DCD** lights but **Frames** does not count up, the signals are there but too weak or distorted to pass the checksum.
- The decoder works with FM receivers that use de-emphasis and those that do not, and with transmitters that boost one tone more than the other.

> **Mode note:** The decoder takes control of the demodulation mode and IF passband while active. Both are restored automatically when you disable the decoder. All variants use **USB**, except Packet and APRS at 1200 Bd, which use **FM**.
>
> **Polarity note (FSK variants only):** For Weather RTTY you usually need to check **Invert mark / space**. For Maritime FSK (SITOR/NAVTEX-style) and Amateur RTTY, leave it unchecked — amateur RTTY sends mark as the higher radio frequency, and USB keeps it as the higher audio tone, which is the unchecked case. If decoded text is garbled, toggling this checkbox is the first thing to try. The checkbox is hidden for every variant except the three FSK ones: the others have no mark/space pair, and packet decoding does not depend on which tone is which.
>
> **Letters/figures note (FSK variants only):** Baudot carries letters and figures in two separate states, and noise can flip the decoder into the wrong one — which garbles every following character, not just the damaged one. The decoder therefore returns to letters on every space, standard practice that repairs a corrupted shift within a word or two instead of a whole line. The cost is that groups of digits separated by spaces need the sender to repeat the figures shift after each space, as transmitters normally do.

---

## 11. SSTV

**What it is:** Slow-Scan Television transmits still pictures over a normal SSB voice channel, one line at a time, as a frequency-modulated tone between 1500 Hz (black) and 2300 Hz (white). A full picture takes between 36 seconds and 4½ minutes depending on the mode.

### Recommended frequencies (USB)

| Band | Frequency | Mode | Notes |
|------|-----------|------|-------|
| 20m | 14.230 MHz | USB | The main international SSTV calling frequency — by far the most active |
| 20m | 14.233 MHz | USB | Secondary, used when 14.230 is busy |
| 15m | 21.340 MHz | USB | |
| 10m | 28.680 MHz | USB | Active during band openings |
| 40m | 7.171 MHz | LSB | |
| 80m | 3.845 MHz | LSB | Regional, evenings |

**Sideband is chosen for you.** Starting the decoder selects **LSB below 10 MHz** and **USB above it**, following normal amateur practice. On the wrong sideband the tone mapping is inverted and the picture will not decode. If you meet a station that ignores the convention, simply change the sideband by hand — the decoder stays running, clears the frame and starts fresh on the new setting.

### Setup

1. Enable the decoder and select **SSTV** from the dropdown. Or simply press the **SSTV** button. The receiver switches sideband automatically — USB above 10 MHz, LSB below.
2. Tune so the picture tones fall in the middle of the passband. A correctly tuned signal has its sync pulses at 1200 Hz and the picture content between 1500 and 2300 Hz.
3. Leave **Mode** on **Auto** unless you already know what is being sent. The image builds line by line as it is received.

### Modes

| Setting | Picture | Duration |
|---------|---------|----------|
| **Auto** | Detected automatically | — |
| Martin M1 / M2 | 320×256 colour | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 colour | 110 s / 71 s |
| Scottie DX | 320×256 colour | 269 s |
| Robot 36 / 72 | 320×240 colour | 36 s / 72 s |

**Auto** works two ways: it reads the **VIS header** — the digital mode code sent in the first 300 ms of a transmission — and, if the header was missed (you tuned in late, or it was lost in QSB), it identifies the mode from the sync-pulse timing instead. Selecting a specific mode forces that mode, but the decoder still verifies the sync before it draws anything, so a wrong choice produces no picture rather than noise. Robot 36 is recognised correctly even when you tune in in the middle of a picture (its line timing also fits Robot 72 and Scottie DX, and used to be mistaken for them).

**Weak pictures** keep drawing to the end: even when no single sync pulse can be told apart from the noise, the decoder sees from many lines together that the picture is still there. When the transmission really ends, it stops within a few seconds.

### Reading the output

The status line under the controls reports what the decoder is doing:

| Status | Meaning |
|--------|---------|
| `Waiting for VIS / AUTO lock` | Listening; nothing identified yet |
| `Martin M1? verifying sync…` | A candidate was found and is being confirmed against the next lines |
| `Martin M1 lock (VIS)` | Locked from the VIS header |
| `Martin M1 lock (AUTO)` | Locked from sync-pulse timing |
| `Martin M1 lock (MANUAL)` | Started by the **⏺ Force** button |
| `Candidate rejected (no sync)` | The candidate failed confirmation — normal on noise |
| `— sync lost, resetting` | The signal disappeared mid-picture |
| `Frame complete` | The full picture was received |

The detected mode also appears in green next to the **SSTV** title, and the line counter shows progress.

### Controls

| Button | Action |
|--------|--------|
| **▶ Start** | Arms the decoder. It does not draw a picture by itself — a lock still has to come from the VIS header or from sync detection. |
| **■ Stop** | Stops decoding. |
| **↺ Reset** | Clears the canvas and re-arms in place. Use it between pictures, or after retuning. |
| **⏺ Force** | Starts drawing **immediately** in the mode selected in the dropdown, skipping VIS and sync detection entirely. Only available when Mode is not **Auto**. |
| **💾 Save** | Saves the current image as a PNG. |

**When to use Force.** If you can see a picture in the waterfall but the decoder will not lock onto it — an unusual mode, a signal too weak or too distorted for the detectors, or a header you missed — select the mode by hand and press **⏺ Force**. The frame is anchored at the moment you click, and the mode badge shows `MANUAL` so you can tell it from a VIS or AUTO lock. The decoder still snaps to a real sync pulse if it finds one, so a click that is slightly early or late is corrected.

Because Force skips every safety check, it will happily paint noise if you press it on an empty channel, and it will not stop on its own — press **■ Stop** or **↺ Reset**.

### Notes

- **Noise will not start the decoder.** Static crashes, sparks and mains hash used to be enough to trigger a decode. Every detection stage now tests that the tone is a genuine tone and confirms the candidate against the following lines before a single pixel is drawn. Expect the decoder to sit quietly on an empty band.
- **The picture drifts diagonally if you are off frequency.** SSTV is unforgiving of tuning error. If lines slant, adjust the dial in small steps and let the next picture start.
- Colour balance and sharpness are fixed; there are no adjustments to make.

---

## 12. SERVICES

**SERVICES** (the button used to be called **HFDL**) is one window for the utility services. The **Service** list at the top left of the window chooses what it decodes: **HFDL** (aircraft), **DSC** (ships), **Time Signals** and **HF Selcall**. Your browser remembers the choice. One service runs at a time; each sets the mode and filter it needs, has its own frequency list with **⇒ Tune & Set IF**, and decodes in your browser, so it costs the receiver nothing. Every service has **💾 Save** (a text file) and **Clear**, and the Users window shows which service a listener is running. ALE 2G, which also links HF stations, is in the FLDIGI window (chapter 10).

### HFDL — aircraft messages

HFDL (HF Data Link) carries the messages that aircraft over oceans and remote areas exchange with ground stations on shortwave: position reports, ACARS text, logons and frequency data. The decoder is dumphfdl (Tomasz Lemiech, GPL-3) compiled to WebAssembly. It runs in your browser on the USB audio, so it costs the receiver nothing.

#### Setup

1. Press **SERVICES** and choose **HFDL** in the **Service** list. The receiver switches to USB with a 150–2750 Hz filter.
2. Pick a **ground station** and one of its frequencies, then click **⇒ Tune & Set IF**. The listed frequency is the USB dial; the HFDL signal sits 1440 Hz above it.
3. Wait. Ground stations send a squitter every 32 s, and aircraft answer when they have traffic. The decoder finds the exact audio rate (±1 %) and a frequency offset (±240 Hz) by itself and locks on the first frame it decodes.

#### Frequencies

The station list covers every HFDL ground station. Heard well from Europe in daytime: 17967 kHz (Al Muharraq, Bahrain) and 21955 kHz (Canarias); in the evening and at night the lower frequencies of Shannon, Reykjavik and Canarias take over. HFDL frequency markers start the decoder when you click them.

#### Reading the output

Each line shows the time (UTC), the frequency, the direction (▼ ground→air or ▲ air→ground), the ground station, the aircraft — registration, flight and 24-bit ICAO address, each a link to FlightAware — the message type, its SNR and bit rate, and 📍 a position when the message carries one. ACARS text appears underneath. Hover over a line to see the whole frame. Tick **Squitters** to see the ground stations' announcements as well.

**🗺 Map** shows the aircraft that reported a position, inside the panel; **⤢ Large map** opens the same map in a window you can move and resize. Each aircraft points along its track and leaves a red trail. **💾 Save** writes the messages to a text file, **Clear** empties the list.

### DSC — Digital Selective Calling

DSC is the digital calling system of the GMDSS: ships and coast stations call each other, test their equipment and send distress, urgency and safety alerts on fixed MF/HF channels. A call lasts a few seconds (100 Bd, two tones 170 Hz apart).

1. Choose **DSC** in the **Service** list and pick a frequency. The **distress & safety** channels (2187.5, 4207.5, 6312, 8414.5, 12577 and 16804.5 kHz) are watched by every coast station and are the busiest; the coast→ship and ship→coast calling channels follow in the list.
2. Click **⇒ Tune & Set IF**. The dial goes 1.7 kHz below the DSC frequency, in USB, with a 1400–2000 Hz filter.
3. Wait. Coast stations answer and test many times an hour; by day 8414.5 and 12577 kHz are usually the busiest, at night 2187.5, 4207.5 and 6312 kHz.

Each call shows the time, the frequency, its category in colour (**DISTRESS** red, **URGENCY** orange, **SAFETY** yellow, **ROUTINE** blue), the format and its fields: who calls whom (an MMSI with its country, or a coast station), the commands, the working frequency, and for a distress alert its nature, position (📍, a link to a map) and time. ✓ means the error-check character agrees; *✓ (1 rebuilt)* means one character was lost in both copies and rebuilt from it. **Offset** shows the tuning error and **S/N** the signal-to-noise ratio.

### Time Signals

Decodes the date and time sent by the long-wave and shortwave time stations, and shows how late the minute mark reached your page.

1. Choose **Time Signals** in the **Service** list, pick the station and its frequency, and click **⇒ Tune & Set IF**. The dial goes 1 kHz below the carrier, in USB, with a 700–1300 Hz filter.
2. Wait. A whole minute has to come in clean before the time can be shown: one to two minutes on a good signal. The seconds fill a row of 60 cells as they arrive.

- **DCF77** (Germany, 77.5 kHz) and **MSF** (England, 60 kHz) are read from the carrier's on/off keying: date, time and summer time.
- **WWV / WWVH** (USA, 2.5 to 25 MHz) are read from the 100 Hz subcarrier: date, time and DUT1.
- **RWM** (Russia, 4996, 9996 and 14996 kHz) sends no date: only the minute mark and DUT1, so it gives timing only.
- CHU (Canada) closed on 22 June 2026 and is not offered.

The panel shows UTC and the date; the time as the transmitter sends it (*sent as*, its own civil time); the **Station time**, which is UTC in the receiver's own time zone, worked out from the station's QTH locator, with summer time applied by your browser; DUT1 and any warnings; and **Arrived**, how late the minute mark reached the page against your computer's clock. That figure includes the WebSDR's own delay (a few tenths of a second) and your clock's error. When fading spoils every single minute, the decoder combines several minutes and accepts a time only when it fits them clearly better than any other.

### HF Selcall

Selcall (CCIR 493-4) is the selective calling of HF land-mobile and maritime networks — Codan, Barrett and others: a burst of a second or two that rings one radio, or a group, by its number. It uses the same signal and characters as DSC.

1. Choose **HF Selcall** in the **Service** list, pick a channel (the 7 and 8 MHz channels of KiwiSDR's list) and click **⇒ Tune & Set IF**. The channel is the FSK centre; the dial goes 1.7 kHz below it, in USB.
2. Each call shows the calling and the called station's numbers (4 or 6 digits), the type of call, and any commands and data; a Codan GPS position is shown as its raw digits. Stations differ in which tone they send as mark, so both polarities are read.

---

## 13. DRM

DRM (Digital Radio Mondiale) is digital broadcasting on shortwave and medium wave. Unlike the other decoders it is decoded on the station's server: when you press **DRM**, the server runs a decoder for you — ubersdr-drm, the headless Dream decoder that UberSDR uses — on the whole 10 kHz DRM channel, and sends you the decoded audio and its status. It therefore plays in every browser, xHE-AAC included. A station runs at most five DRM decoders at a time, one per listener.

### Setup

1. Press **DRM** (or pick it in the dropdown). The mode under the frequency reads **DRM** and the passband covers the whole 10 kHz channel.
2. Pick a broadcast in the selector and click **⇒ Tune**, or tune the dial to the centre of a DRM channel yourself — the decoder follows the dial.
3. Watch the lamps: once **Audio** is green, sound comes out.

While DRM is on, the only sound is decoded DRM. The receiver's own audio is muted, so with no DRM signal you hear nothing. On a weak or fading signal a damaged frame fades out into a short reverb and silence instead of a burst of noise, and the decoder resynchronises by itself when the signal comes back; each frame also gets a second round of error correction.

### The station selector

The selector lists the schedule of the DRM Reception Project (drmrx.org), which the server refreshes every hour: frequency, station, UTC times, the days when it is not daily, the area the broadcast is beamed to, ✓ when listeners confirmed it on air, and HFCC when the broadcaster registered it with the HFCC. The groups are **Beamed at this station (locator) — on air now**, **On air now — beamed elsewhere, nearest first**, **Later (next 24 h)** and **Medium wave**. **Confirmed only**, on by default, hides the entries nobody has confirmed. The ranking follows the station's grid locator (`grid_locator` in the `[websdr]` section of the config): a broadcast counts as beamed at the station when its target area comes within about 1000 km of it; when the target is unknown ("Various"), the transmitter's country is used instead. Without a locator the on-air broadcasts are listed in one group. Broadcasts beamed far away are often weak or absent. **heard here** marks a broadcast this receiver has decoded in the last 30 days — the decoder notes every service it decodes, never who listened — and **Confirmed only** keeps those too; one that no schedule lists, such as a test transmission, gets its own group at the top, **Heard on this receiver — on air now, in no schedule**, over the half-hours it was heard.

Good catches from Europe (winter schedule from 25 October 2026): Radio Romania International on 9720 kHz (17:00–18:00 UTC), 9570 kHz (18:00–19:00), 6110 kHz (19:00–20:00) and 5955 kHz (19:00–19:30). Broadcast schedules change at the end of March and the end of October, and the selector follows them.

### Reading the panel

| Item | Meaning |
|---|---|
| **Signal, Time, Frame, FAC, SDC, Audio** | The sync lamps: green OK, amber data error, red CRC error, grey not present. Sound comes out when **Audio** is green. |
| **WMER** | The figure that predicts decoding: from about 10 dB the audio decodes. |
| **MER, SNR** | Modulation error ratio and signal-to-noise ratio, in dB. |
| **Mode, BW, QAM, Prot** | Robustness mode (A–E), channel bandwidth, MSC constellation and protection levels. |
| **Codec** | AAC, AAC+SBR or xHE-AAC, as the station signals it. |

Below them come the station's name, country, language and audio mode, and its text message. "No decoder on the server for …" means this station cannot decode that codec.

**For sysops.** The decoder is built by `./setup-drm.sh` (the installers run it; `update.sh` offers it) and the helper `autorun/drm-helper.js` starts and stops with the receiver; `DRM_ENABLED=0` in front of the start script switches it off. See the installation manual. After an update, run `./setup-drm.sh` again: it patches and rebuilds the decoder (fewer dropouts, no bursts of noise on xHE-AAC), and the new decoder is used once the helper restarts with the receiver.

---

## 14. General Tips

**Decoder: ON must be engaged first.** The dropdown is disabled (greyed out) until you click the Decoder button to turn it on.

**One decoder at a time.** Selecting a new decoder from the dropdown automatically stops the previously active one and resets any mode or passband changes it made.

**Mode is managed for you.** HF FAX and NAVTEX switch the receiver to USB as soon as you select them, and SSTV picks the sideband from the band (LSB below 10 MHz, USB above), and FAX also adjusts the passband when you click its Tune button. NAVTEX narrows the passband to 350–650 Hz audio as soon as it starts, and FLDIGI to the window of its variant — from the button, the dropdown or a marker. A click on the waterfall puts a decoder's own filter back; dragging the filter edges or turning the mouse wheel leaves a filter you shaped by hand as it is. FT8, FT4, FT2, JS8 and WSPR do the same as soon as you select them — from the button row or the dropdown — switching the receiver to USB and setting their own passband: the whole 3 kHz sub-band for the FT8 family, 1350–1650 Hz for WSPR. When you stop the decoder, the band's default mode is restored.

**Switching a decoder on no longer interrupts the audio.** The decoders run on their own threads, so there is no gap, click or dropout when one starts, stops, or is swapped for another.

**System clock accuracy matters.** FT8, FT4, and WSPR are time-critical. They decode in fixed UTC-aligned windows. If your computer clock is off by more than 1–2 seconds, decode rates will drop significantly. Use an NTP client to keep your clock accurate.

**The noise filters do not reach the decoders.** NR, NB, NS and AN are listening
aids for your ears only. Every decoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, every FLDIGI mode, SSTV and the QRSS grabber — taps the audio *before* those filters, so set them however sounds best without worrying about decode quality. For the same reason the decoders keep running while the receiver is muted or squelched: you can silence the speaker and leave a decoder or an overnight QRSS grab collecting. The one thing that does follow what you hear is the Audio Spectrogram, which is meant to show the filtered audio.

**Signal quality beats signal strength.** Most of these decoders are designed for weak signals. A quieter band with lower noise is often more productive than a loud, interference-filled signal. Use the waterfall and passband controls to identify and avoid QRM before enabling a decoder.

**Use the Refresh or Clear buttons liberally.** FAX images drift if the dial frequency is slightly off, and text decoders accumulate noise characters. A fresh start after tuning adjustments often produces much cleaner output.

### Automatic spot reporting and server graphs

FT8, FT4 and WSPR decodes can also be uploaded automatically by the server itself — FT8/FT4 to PSK Reporter, WSPR to WSPRnet — by an autorun daemon the sysop starts from the admin panel. It is independent of the decoders in your browser: it keeps running whether or not anyone is listening, and nothing you decode in the browser is reported.

The sysop follows it with two counters, which are easy to mistake for each other: the per-decoder tiles count the spots uploaded since the daemon last started, while the number beside each band/mode checkbox is that slot's all-time total and survives restarts. The same panel has a **Graphs** page plotting CPU frequency, CPU load, CPU temperature and users online over the last 15 minutes to 24 hours. Both are described in the [Admin Panel guide](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
