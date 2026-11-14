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
| **FT4** | FT4 | **FLDIGI** | ALE 2G HAM, RTTY, PSK31·63·125, QPSK, Olivia, Contestia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet, APRS |
| **FT2** | FT2 | **NAVTEX** | NAVTEX |
| **CW** | CW | **FAX** | HF FAX / WEFAX |
| **JS8** | JS8 | **SERVICES** | HFDL (aircraft), Maritime FSK / SITOR, Weather RTTY, Naval RTTY (PBB), DSC (ships), Time Signals, HF Selcall, ALE 2G |
| **WSPR** | WSPR | **DRM** | DRM — digital broadcasting |

Pressing a button does the whole sequence in one go: it selects the decoder, switches the decoder ON, and scrolls its panel into view. The button turns blue while its decoder is running. **Press the same button again to switch the decoder off** — its window closes with it.

The buttons, the dropdown and the ON/OFF button all drive the same state, so whichever you use, the others follow.

### Starting a decoder from a frequency marker

A frequency marker (the yellow labels above the waterfall, from `markers.json`) normally tunes the receiver and sets the mode written in it. When that mode is the name of a digital mode, clicking the marker starts its decoder instead, exactly as if you had pressed the decoder's button:

| Marker mode | Starts | The marker's frequency is |
|---|---|---|
| `FT8`, `FT4`, `FT2`, `JS8`, `WSPR`, `SSTV` | that decoder | the dial frequency |
| `NAVTEX` | NAVTEX | the signal frequency (the dial goes 500 Hz below) |
| `FAX`, `WEFAX` | HF FAX | the published centre (the dial goes 1900 Hz below) |
| `RTTY`, `RTTY-WX`, `RTTY-NAV`, `SITOR` | FLDIGI as Amateur RTTY (`RTTY`); SERVICES on Weather RTTY, Naval RTTY (PBB CARB) or Maritime FSK / SITOR | the signal frequency (the dial goes the panel's audio centre below) |
| `PSK31`, `OLIVIA`, `FST4W`, `MFSK`, `MSK144`, `DOMINOEX`, `THOR`, `THROB`, `HELL`, `MT63` | FLDIGI in that variant | as above |
| `MFSK16`, `MFSK32`, `MFSK64`, `FELDHELL` | FLDIGI in that variant and sub-mode | as above |
| `PSK63`, `PSK125`, `BPSK31`/`63`/`125`, `QPSK31`/`63`/`125`, `CONTESTIA` | FLDIGI in that variant and sub-mode | as above |
| `PACKET`, `APRS` | FLDIGI in that variant | the channel; 300 Bd (USB) below 30 MHz, 1200 Bd (FM) above |
| `RADEU`, `RADE`, `FREEDV` / `RADEL` | FreeDV RADE V1 on upper / lower sideband (`RADE` and `FREEDV` mean upper) | the dial frequency |
| `RADE2` | FreeDV RADE V2 (beta), always upper sideband | the dial frequency |
| `HFDL` | SERVICES · HFDL | the dial frequency (USB; the HFDL signal sits 1440 Hz above it) |
| `DSC`, `SELCALL` | SERVICES on DSC or HF Selcall | the DSC frequency or the Selcall channel (the dial goes 1.7 kHz below) |
| `TIME`, `DCF77`, `MSF`, `RWM`, `WWV`, `WWVH` | SERVICES on Time Signals, with that station | the carrier (the dial goes 1 kHz below) |
| `ALE` | FLDIGI on ALE 2G HAM on an HFLINK channel, otherwise SERVICES on ALE 2G | the dial frequency (LSB for the networks that use it) |
| `DRM` | DRM | the centre of the DRM channel |
| `MORSE` | the CW decoder, with CW and a ±250 Hz filter | the signal frequency |

> Only one decoder can be active at a time. Switching to a different decoder automatically stops the previous one.
>
> The **QRSS grabber** is not part of this dropdown — it has its own **QRSS** section and can run at the same time as a decoder.

**A running decoder owns the mode and the passband.** Normally the mode follows the band plan in `bands-config.js`: move the dial into a segment marked LSB or AM and the receiver switches to it. While a decoder is running that no longer happens. The decoder holds the mode it needs (USB for most, its own for RADE) and the passband it needs — PSK31 about ±100 Hz, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 their full bandwidth, RTTY its shift — and both survive retuning, including a jump to another band. Without this, tuning FT8 on 40 m would flip the receiver to LSB the moment the dial moved, and the narrow decoder passbands would widen back to the full SSB filter.

### Decoder ID — recognising the mode automatically

Above the decoder buttons sits a **Decoder ID** frame. It answers the question *"what am I listening to?"* when you come across a digital signal you cannot place, and then offers the matching decoder in one click.

It is **off by default** and costs nothing while it is off. Press **On** and leave the signal tuned in. For about half a minute it shows *Listening…* with a progress bar — the timing measurements have to see two complete FT8 cycles before they mean anything — and then it names the mode:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* The **mode** and a **confidence** figure. Green above 75%, amber above 50%, orange below — treat an orange answer as a hint, not a verdict.
* **What was actually measured**: occupied bandwidth, tone spacing, symbol rate, burst length, the UTC grid it fits, signal-to-noise. This is the evidence behind the verdict, so you can judge it for yourself.
* **Use <mode>** starts the right decoder, exactly as if you had pressed its button — and sets the receiver up to work that mode. For the modes that live in the FSK panel it also selects the correct variant — RTTY, PSK31 or Olivia in FLDIGI, Weather RTTY in SERVICES.
* Runners-up are listed after **or**. Click one to try it instead, so a wrong first answer costs you nothing.
* **📻** means the frequency you are tuned to is a known calling frequency for that mode, and that this counted towards the ranking.

It never switches your decoder by itself. It only ever suggests. And once you start a decoder — from the button row, from the dropdown, or from Decoder ID's own **Use** button — Decoder ID switches itself off: its job was to choose one, and the decoder now wants the same audio.

**What it recognises:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY at 45.45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV and DSC. **Use DSC** and the Weather RTTY suggestion start SERVICES on that service (chapter 12).

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

> **Tip:** JS8 is much quieter than FT8. On a mid-band afternoon you may see one transmission every couple of minutes, and long stretches of nothing at all are normal. Give it five or ten minutes before concluding something is wrong. 20m (14.078) and 40m (7.078) are the usual places to look.

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

### Opening the grabber

The QRSS grabber is **not** in the Decoder dropdown. It has its own **QRSS** section, alongside the Spectrogram and Decoder controls.

1. Click **🐌 Show**. The grabber canvas appears and its controls unfold next to the button.
2. Pick a window from the **Band** list and press **Tune**. This does everything the mode needs in one step: it tunes to the window, switches the receiver to **CW**, and sets a passband just wide enough for the slice you are watching. The dial then reads the true QRSS frequency, and the traces land on the centre line of the display.
3. Set **Speed** to match the beacon's dot length.
4. **Centre** and **Span** work as before; changing either re-shapes the passband to match, so the display and the receiver stay in step.
5. Click **🐌 Hide** to stop. The band's normal mode comes back.

### Speeds

| Setting | Dot length | Resolution | Analysis window | New column every |
|---------|-----------|------------|-----------------|------------------|
| QRSS 3  | 3 s  | 0.73 Hz | 1.4 s  | 0.7 s  |
| QRSS 6  | 6 s  | 0.37 Hz | 2.7 s  | 1.4 s  |
| QRSS 10 | 10 s | 0.18 Hz | 5.5 s  | 2.7 s  |
| QRSS 30 | 30 s | 0.09 Hz | 10.9 s | 5.5 s  |
| QRSS 60 | 60 s | 0.05 Hz | 21.8 s | 10.9 s |

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

Click **Clear** to erase the message buffer.

> **Note:** NAVTEX operates on MF and LF frequencies (518/490 kHz). Reception range is typically 200–400 nautical miles from the transmitter. The HF channels (4–17 MHz) provide much greater range.

---

## 10. FLDIGI — ALE 2G, RTTY, PSK31, Olivia, FST4W, MFSK, MSK144, DominoEX, THOR, THROB, Hellschreiber, MT63, Packet and APRS

**What it is:** One window for the narrow-band keyboard modes that the program fldigi made popular, with fourteen variants selected from one dropdown. One is true FSK (Frequency-Shift Keying): Amateur RTTY; its utility relatives, Maritime FSK (SITOR) and Weather RTTY, use the same decoder in SERVICES (chapter 12). The others share the same window: **PSK31** (also **PSK63** and **PSK125**, each in BPSK or QPSK), which is phase-shift keying; **Olivia** (with its sibling **Contestia**) and **MFSK16/32/64**, multi-tone modes with forward error correction; **DominoEX** and **THOR**, incremental frequency keying (THOR with error correction); **THROB**, two tones at once, one character per pulse; **Hellschreiber**, which paints text as a picture instead of decoding it; **MT63**, 64 carriers at once; and **Packet (AX.25)** and **APRS**, which decode AFSK packet radio — the 1200 baud packet of VHF/UHF and the 300 baud packet of HF. Each variant comes with a preset tuned to its standard parameters. The button and the dropdown entry are both called **FLDIGI**; the decoding is done here, in the browser, and fldigi itself is not needed.

Three of the variants come from outside fldigi. **ALE 2G HAM** is the automatic link establishment (MIL-STD-188-141) of the amateur HFLINK network, and lists its calls and soundings; the government, military and utility networks are in SERVICES → ALE 2G (chapter 12). **FST4W**, the very slow beacon mode of the 2200 m, 630 m and 160 m bands, and **MSK144**, for meteor scatter on 6 m and 2 m, come from WSJT-X. None of the three prints running text: each lists what it decodes one line at a time, with the time.

### Variants and presets

| Variant | Center | Shift | Baud | Framing | Encoding |
|---------|--------|-------|------|---------|----------|
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

### Setup

1. Enable the decoder and select **FLDIGI** from the dropdown. Or simply press the **FLDIGI** button.
2. The decoder panel appears. Its title follows the variant — *FSK / RTTY Decoder*, *BPSK31 Decoder* (or whichever PSK mode is chosen), *Olivia Decoder*, *Contestia Decoder*, *MFSK Decoder*, *DominoEX Decoder*, *THOR Decoder*, *THROB Decoder*, *Hellschreiber Decoder*, *MT63 Decoder*, *Packet (AX.25) Decoder* or *APRS Decoder*. ALE 2G HAM shows *ALE 2G HAM Decoder*; FST4W names its period, e.g. *FST4W-120 Decoder*; MSK144 shows *MSK144 Decoder*.
3. Select the **Variant**. The parameters update automatically.
4. For PSK31, Olivia, MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63, set **Mode** to match the transmission — see each mode's notes below. For Packet and APRS, set **Speed** — see the Packet and APRS notes below. For ALE 2G, pick a network and a channel; for FST4W and MSK144, set **T/R period** and **F Tol** — see their notes below.
5. Where the variant has one, use the **Known frequency** dropdown to select a common frequency, then click **Tune** to jump to it. The other modes have no fixed calling frequencies: find the signal on the waterfall and use **⟳ Auto-tune Center**.
6. Fine-tune frequency until decoded text becomes stable and readable.

### Known frequencies by variant

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
| Squelch (SNR) | Amateur, Weather and Naval RTTY | Stops noise printing as random letters. Starts at −5 dB for Amateur RTTY and −7 dB for Weather and Naval RTTY; the far left (**off**) disables it. The SNR figure turns grey while the squelch is closed |

### Additional controls

- **⇒ Set IF Band-Pass** — narrows the receiver passband to tightly bracket the signal. The width follows the variant: 300 Hz for Amateur RTTY (narrow enough to remove a stronger station 250 Hz away, while still copying a signal tuned 40 Hz off), 594 Hz for Weather RTTY, mark/space plus margin for Maritime FSK, about ±100 Hz for PSK31 (±200 Hz PSK63, ±400 Hz PSK125), the full tone-block width plus margin for Olivia, about ±400 Hz for 300 Bd packet, and the ordinary FM channel for 1200 Bd packet. The passband follows the decoder when **Auto-tune** or **Auto shift detect** moves the tones, and when you change the **Baud** setting. MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 get their full width plus a margin (at least 60 Hz either side, 15 % of the width for the wide modes). ALE 2G gets 500–2750 Hz (mirrored below the dial on an LSB network), FST4W its **F Tol** range plus 150 Hz either side, MSK144 ±1.1 kHz plus **F Tol**.
- **⟳ Auto-tune Center** — automatic search for the signal. For the FSK variants it looks for a balanced pair of tones; for PSK31 it finds the carrier; for Olivia it finds the strongest block of the selected bandwidth; for 300 Bd packet it finds the strongest pair of tones 200 Hz apart. The button is hidden for 1200 Bd packet, where the tones are fixed. **Auto shift detect** only changes the shift when a real two-tone signal is present, so it no longer jumps on noise. MFSK, DominoEX, THOR, THROB, Hellschreiber and MT63 are searched the same way as Olivia, over their own width. The button is hidden for ALE 2G, FST4W and MSK144.

### ALE 2G notes

ALE (MIL-STD-188-141, second generation) is how government, military, aid-agency and amateur HF networks find a working frequency: the stations scan a set of channels, send short *soundings* to say they are there, and call each other with a few seconds of an 8-tone signal (125 Bd, 750–2500 Hz).

1. Choose **ALE 2G HAM**, the entry just before Packet in **Variant**. In place of the usual settings the panel shows a **network** list and a **channel** list.
2. Pick a network and one of its channels, then click **⇒ Tune & Set IF**. The listed frequency is the dial; the receiver goes to USB, or LSB for the few networks marked so, with a 500–2750 Hz filter.
3. Wait. Soundings come every half hour or hour, and calls only when a link is needed, so a channel can stay quiet for a long time.

### PSK31 notes

- The decoder corrects its own tuning error automatically over roughly **±25 Hz** (±50 Hz PSK63, ±100 Hz PSK125), so you only need to get close. **Carrier** in the metrics row shows where it actually settled.
- **IMD** measures transmitter quality, not reception: a clean signal reads about −20 dB or better. A poor reading means the other station is overdriving, not that you are mistuned.
- Text appears character by character with no error correction, so a weak signal degrades into occasional wrong letters rather than stopping.
- **PSK63 and PSK125** are the same mode two and four times faster, and as many times wider; **QPSK31/63/125** add error correction (a Viterbi decoder), which repairs short bursts of noise at about the same signal level. Pick the sub-mode in **Mode** — the wrong one prints nothing. Most PSK activity is still BPSK31; PSK63 is common in contests.
- **PSK Browser (BPSK31).** The **Browser — all signals** knob under **Mode** decodes every BPSK31 signal between 300 and 2700 Hz at once, as fldigi's signal browser does: one line per signal (up to 16), with its frequency, its lock quality and the latest text. Signals are found by themselves within a few seconds, and one that stays silent for 30 s is dropped. Click a line to decode only that signal, as ordinary BPSK31 on its carrier. While it runs, **Mode** shows BPSK31 and is locked; switched off, the window goes back to the Mode you had. The passband opens to 200–2800 Hz while browsing. Each line keeps its last 4000 characters in a box about six lines tall, with its own scroll bar once it holds more than six lines (the mouse wheel works too); the box holds still while you read. **Save Text** writes every line, also the ones already dropped. While a browser runs, the settings of the single decoder (Center audio, ⟳ Auto-tune Center and its readouts) are hidden.

### Olivia notes

- **The Mode setting must match the transmission exactly.** A wrong tones/bandwidth combination decodes nothing at all — not garbled text, but silence. The panel opens on **8 / 250**, the narrow configuration left running on the calling frequencies; **16 / 500** and **32 / 1000** are the other two in common use, and **16 / 1000** is also offered.
- **Contestia** is Olivia with a smaller error-correction block: about twice as fast, upper case only, and a little less robust. Its configurations are in the same **Mode** list, under *Contestia* (8 / 250 is the usual one, 4 / 125 and 4 / 250 for weak paths); the panel title changes to *Contestia Decoder*. An Olivia setting never decodes Contestia, nor the other way round.
- **Olivia Browser.** Switch on the **Browser — all signals** knob under **Mode** to decode every Olivia (or Contestia) signal of that configuration between 300 and 2700 Hz at once, one line each, in the same way as PSK Browser; click a line to decode only that signal. It works one configuration at a time: on **8 / 250** it does not see 16 / 500 stations. Because Olivia is used below the noise, it does not look for signals by their strength: the passband is covered by about a dozen decoders side by side (about 5 % of one processor core), so a station appears once its first characters are decoded, a few seconds after it starts. Within one bandwidth only the strongest copy is shown, and a line appears only once it holds a few characters of real text.
- Olivia sends no preamble, so the decoder has to search for synchronisation. **Allow a few seconds** after tuning before text appears. The **Sync** field shows `SEARCH` until it locks.
- The error correction works on blocks, so text arrives in **bursts rather than a steady stream**, and there is a delay of several blocks between transmission and display.
- **Squelch (FEC S/N)** sets how confident the error correction must be before printing. The default of 4.0 keeps noise out; 3.0 is the floor, below which random noise starts printing occasional characters. A good signal reads 8–9 on the **FEC** meter, so there is plenty of room to raise the squelch on a busy band.
- When a transmission ends, the text simply stops. Each block is also checked on its own, so the few blocks the squelch still lets through while it settles no longer print a burst of random characters.

### FST4W notes

- **It decodes once per period, after the period ends.** Periods start on the UTC clock — FST4W-120 at every even minute, FST4W-1800 on the hour and the half hour — and the **Period** bar shows how much of the current one has been recorded. A period joined part-way through is skipped, because half a message cannot be decoded; the next one is recorded whole. Decoding a 30-minute period takes a few seconds.
- **Pick the right T/R period.** The decoder looks only at the one you choose. Most LF/MF beacons use FST4W-120; FST4W-300, -900 and -1800 are for the weakest paths.
- **F Tol** sets how far either side of **Center audio** (1500 Hz) it searches. WSJT-X's default of ±100 Hz covers the beacon sub-bands; ±150 Hz is the most the passband allows.
- Each line shows UTC, SNR (dB), DT (the time offset, s), the frequency (MHz) and the message, as in WSJT-X, and **Save Text** writes them in the same style.
- The computer's clock must be right to about a second, as for WSPR.

### MFSK16 / MFSK32 / MFSK64 notes

- **Pick the MFSK16·32·64 variant**, then the speed in its **Mode** list. The three modes differ only in speed, and the setting must match: the wrong one prints nothing readable.
- **Tuning:** put the tone block on the **Center audio** frequency, or press **⟳ Auto-tune Center**. The decoder corrects the last quarter of a tone by itself — about ±4 Hz for MFSK16, ±8 Hz for MFSK32 and ±16 Hz for MFSK64 — and **Centre** shows where it settled. A signal further off is found by the decoder itself, up to about ±75 Hz from the set centre: allow a few seconds at the start of a transmission.
- Text lags the signal by a couple of seconds, the time the interleaver and the error correction need. One or two stray characters at the very start of a transmission are normal; fldigi shows them too.
- **Squelch (FEC metric)** holds printing back until the decoding quality reaches the setting. The default of 22 keeps noise out (noise alone reaches about 20); a good signal reads 90 % or more on the **FEC** meter, and 0 turns the squelch off. When a transmission ends with fldigi's end-of-transmission mark, printing stops at once instead of letting a few seconds of noise through.
- MFSK picture transfers are not decoded.

### MSK144 notes

- **Expect long gaps.** On a quiet band nothing appears for minutes. During the big showers (Quadrantids, Perseids, Geminids) and in the early morning there are many more pings.
- Each line shows UTC (to the second), SNR (dB), T (when the ping came in its period, s), the frequency (MHz) and the message. A message heard again in the same T/R period is listed once, unless the new copy is stronger. Weak copies of the same message are averaged, as in WSJT-X.
- **F Tol** sets how far either side of 1500 Hz the decoder searches; stations are seldom exactly on frequency, so ±100 Hz is a good start. **Decode** sets how hard each block is searched, and **Deep** finds the most. **CPU** in the metrics row shows the load: above 100 % the decoder falls behind, so choose **Normal** or **Fast** on a slow computer.
- The 40-bit short messages (Sh) are not decoded: they need both stations' callsigns, which a listener does not know.

### DominoEX and THOR notes

- **Mode** must match the speed being sent. DominoEX offers Micro, 4, 5, 8, 11, 16, 22, 44 and 88; THOR offers Micro, 4, 5, 8, 11, 16, 22 and the fast 25 x4, 50 x1, 50 x2 and 100 (these four use a stronger code and a one-second interleaver). DominoEX 11 and THOR 16 are the most heard.
- **Tuning:** put the tone block on **Center audio**, or press **⟳ Auto-tune Center**. A tuning error of a quarter of the signal's width still copies.
- **Squelch (tone / noise)** compares the received tone with the floor of all the other tone bins, on a 0–100 scale. Noise alone stays at or under 20; readable copy reads 35 and up; the default is 25. This is not fldigi's own figure: fldigi's reads 26 on some perfectly clean signals, which would have made any useful default cut them off. When a transmission ends, printing stops within a few symbols instead of letting noise through.
- The receiver follows fldigi's default settings: three sub-bin paths, hard decisions for DominoEX, soft decisions and preamble detection for THOR. DominoEX's optional MultiPSK error correction (off by default in fldigi) is not decoded, nor is the secondary text channel (the station's idle beacon text) or THOR's picture mode.

### THROB notes

- **Tuning is critical.** The tones of THROB 1 and 2 are only 8 Hz apart, so the decoder captures ±3 Hz of mistuning (±6 Hz for THROB 4) and corrects the rest with its own frequency tracking. Press **⟳ Auto-tune Center** first: it finds the signal to within a hertz or two.
- **Mode** must match, THROB or THROBX and the speed.
- **Squelch (S/N)** — noise alone stays under 1 dB, a copyable signal reads 10 dB and up; the default is 4 dB.

### MT63 notes

- **Mode:** MT63-500, -1000 or -2000 (the bandwidth), each with **short** or **long** interleave. Both must match. MT63-1000 long is the most used.
- **Tuning:** fldigi sends the lowest carrier at 500 Hz, so the centre is 500 Hz plus half the bandwidth: 750, 1000 or 1500 Hz, set automatically when you pick the mode. The decoder finds the last 8 carriers of error by itself (±125 Hz for MT63-1000).
- **Text lags the signal** by the interleaver: from about 1.6 s (MT63-2000 short) to 12.8 s (MT63-500 long). The last characters of a transmission arrive after the signal has stopped.
- **Squelch (FEC S/N)** — noise alone reads about 3, a locked signal 4.5 and up; the default is 4. The squelch hides the moment the synchroniser needs to lock at the start.

### Packet and APRS notes

> **Mode note:** The decoder takes control of the demodulation mode and IF passband while active. Both are restored automatically when you disable the decoder. All variants use **USB**, except Packet and APRS at 1200 Bd, which use **FM**.
>
> **Polarity note (FSK variants only):** For Weather RTTY and Naval RTTY (PBB) you usually need to check **Invert mark / space**. For Maritime FSK (SITOR/NAVTEX-style) and Amateur RTTY, leave it unchecked — amateur RTTY sends mark as the higher radio frequency, and USB keeps it as the higher audio tone, which is the unchecked case. If decoded text is garbled, toggling this checkbox is the first thing to try. The checkbox is hidden for every variant except the four FSK ones: the others have no mark/space pair, and packet decoding does not depend on which tone is which.
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

---

## 12. SERVICES

**SERVICES** (the button used to be called **HFDL**) is one window for the utility services. The **Service** list at the top left of the window chooses what it decodes: **HFDL** (aircraft), **Maritime FSK / SITOR**, **Weather RTTY**, **Naval RTTY (PBB CARB)**, **DSC** (ships), **Time Signals**, **HF Selcall** and **ALE 2G (MIL-STD-188-141)**. Your browser remembers the choice. One service runs at a time; each sets the mode and filter it needs, has its own frequency list with **⇒ Tune & Set IF**, and decodes in your browser, so it costs the receiver nothing. Every service has **💾 Save** (a text file) and **Clear**, and the Users window shows which service a listener is running. The amateur ALE channels are in the FLDIGI window, as ALE 2G HAM (chapter 10).

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

### Maritime FSK / SITOR, Weather RTTY and Naval RTTY

These three utility broadcasts use the FSK decoder and panel of the FLDIGI window (chapter 10), with the **Service** list where FLDIGI has its **Variant** list. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space**, **Auto shift detect**, **⇒ Set IF Band-Pass** and **⟳ Auto-tune Center** work as described there.

| Service | Center | Shift | Baud | Framing | Encoding |
|---------|--------|-------|------|---------|----------|
| Maritime FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Weather RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Naval RTTY (PBB CARB) | 1000 Hz | 850 Hz | 75 | 5N1.5 | ITA2 |

1. Choose **Maritime FSK / SITOR**, **Weather RTTY** or **Naval RTTY (PBB CARB)** in the **Service** list.
2. Pick a **Known frequency** and click **Tune**. The listed frequency is the signal; the USB dial goes the panel's centre below it.
3. Fine-tune until the text is stable. Weather RTTY needs **Invert mark / space** checked (the preset does it) and has a **Squelch (SNR)** slider, starting at −7 dB; Maritime FSK leaves it unchecked. Naval RTTY works the same way (also inverted, squelch from −7 dB).

**Maritime FSK / SITOR:** 2174.5 kHz (MF NBDP working channel), 518 and 490 kHz (NAVTEX), 4209.5 kHz (HF NAVTEX), and the HF SITOR maritime safety channels 4210, 6314, 8416.5, 12579, 16806.5, 19680.5, 22376 and 26100.5 kHz. NAVTEX also has its own button, with the station schedules (chapter 9).

**Weather RTTY:** the DWD (German Weather Service) outlets 4583, 7646 and 10100.8 kHz (Programme 1, English) and 11039, 14467.3 and 147.3 kHz (Programme 2, German; 147.3 kHz uses an 85 Hz shift, which its list entry sets). While a DWD frequency is chosen, **NEXT BROADCASTS** shows the coming programme.

**Naval RTTY (PBB CARB):** the Channel Availability / Receipt Broadcast of PBB, the Royal Netherlands Navy at Den Helder, on 2474, 4250, 4280, 5052, 5214, 5659, 5694.5, 6356, 6358.5, 8439, 9264, 9368, 12840.5, 16318, 17116.7, 17947, 18308 and 20098 kHz. It tells ships which channels the shore station is listening on and confirms the messages it has received; what the ships send is encrypted. If the text comes out garbled, untick **Invert mark / space** first.

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

### HF Selcall

Selcall (CCIR 493-4) is the selective calling of HF land-mobile and maritime networks — Codan, Barrett and others: a burst of a second or two that rings one radio, or a group, by its number. It uses the same signal and characters as DSC.

1. Choose **HF Selcall** in the **Service** list, pick a channel (the 7 and 8 MHz channels of KiwiSDR's list) and click **⇒ Tune & Set IF**. The channel is the FSK centre; the dial goes 1.7 kHz below it, in USB.
2. Each call shows the calling and the called station's numbers (4 or 6 digits), the type of call, and any commands and data; a Codan GPS position is shown as its raw digits. Stations differ in which tone they send as mark, so both polarities are read.

### ALE 2G (MIL-STD-188-141)

The soundings, calls and messages of government, military and utility HF networks: 51 networks from KiwiSDR's ALE list, grouped as **Government**, **Military** (MARS among them) and **Utility**. It is the same decoder and panel as ALE 2G HAM in the FLDIGI window, which lists only the amateur HFLINK channels — see the ALE 2G notes in chapter 10.

1. Choose **ALE 2G (MIL-STD-188-141)** in the **Service** list, pick a network and one of its channels, and click **⇒ Tune & Set IF**. The listed frequency is the dial; the receiver goes to USB, or LSB for the networks marked so, with a 500–2750 Hz filter.
2. Wait. Soundings come every half hour or hour, calls only when a link is needed.

These are public lists and may be out of date. The Users window shows *ALE* for a listener running it.

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

**The noise filters do not reach the decoders.** NR, NB, NS and AN are listening
aids for your ears only. Every decoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, every FLDIGI mode, SSTV and the QRSS grabber — taps the audio *before* those filters, so set them however sounds best without worrying about decode quality. For the same reason the decoders keep running while the receiver is muted or squelched: you can silence the speaker and leave a decoder or an overnight QRSS grab collecting. The one thing that does follow what you hear is the Audio Spectrogram, which is meant to show the filtered audio.

### Automatic spot reporting and server graphs

FT8, FT4 and WSPR decodes can also be uploaded automatically by the server itself — FT8/FT4 to PSK Reporter, WSPR to WSPRnet — by an autorun daemon the sysop starts from the admin panel, on the bands, modes and hours scheduled there. It is independent of the decoders in your browser: it keeps running whether or not anyone is listening, and nothing you decode in the browser is reported.

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
