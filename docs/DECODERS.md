# PhantomSDR-Plus — Decoder User Manual

This guide covers every built-in decoder available in PhantomSDR-Plus. All decoders share the same activation workflow, described below, followed by per-decoder setup instructions.

---

## Table of Contents

1. [How to Start a Decoder](#1-how-to-start-a-decoder)
2. [FT8](#2-ft8)
3. [FT4](#3-ft4)
4. [CW — Morse Code](#4-cw--morse-code)
5. [WSPR](#5-wspr)
6. [HF FAX / WEFAX](#6-hf-fax--wefax)
7. [NAVTEX](#7-navtex)
8. [FSK / RTTY](#8-fsk--rtty)
9. [General Tips](#9-general-tips)

---

## 1. How to Start a Decoder

All decoders are accessed from the **Decoder Options** section, located below the Audio Spectrogram controls on the main panel.

**Steps:**

1. Click the **Decoder: OFF** button to switch it to **Decoder: ON** (it turns blue when active).
2. Open the dropdown menu that appears to the right of the button and select the decoder you want.
3. The chosen decoder's panel will appear below the controls — follow the decoder-specific instructions in the relevant section of this guide.
4. To stop decoding, select **— Select decoder —** from the dropdown, or click the **Decoder: ON** button to turn it back OFF.

> Only one decoder can be active at a time. Switching to a different decoder automatically stops the previous one.

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
2. Enable the decoder and select **FT8** from the dropdown.
3. The **FT8 Messages** panel appears automatically below.

### Reading the output

The message list shows decoded transmissions as they arrive. Each 15-second cycle produces a new batch of messages. The **Farthest** field (top-right of the panel) shows the greatest distance decoded in the current session in kilometres.

Typical message format: `CQ DX AA1BB FN31` — a CQ call from callsign AA1BB located in grid square FN31.

> **Tip:** FT8 is tightly time-synchronised. Your browser uses your computer clock; if your system clock drifts by more than a couple of seconds, decoding will fail. Keep your system time synchronised to NTP.

---

## 3. FT4

**What it is:** FT4 is a faster variant of FT8 designed for contest-style operation. Each transmission cycle is 7.5 seconds (half of FT8), making it twice as fast but requiring a slightly stronger signal.

### Recommended frequencies (USB)

| Band | Frequency |
|------|-----------|
| 80m  | 3.575 MHz |
| 40m  | 7.047 MHz |
| 30m  | 10.140 MHz |
| 20m  | 14.080 MHz |
| 15m  | 21.140 MHz |
| 10m  | 28.180 MHz |

### Setup

1. Tune to an FT4 frequency and set mode to **USB**.
2. Enable the decoder and select **FT4** from the dropdown.
3. The **FT4 Messages** panel appears below, identical in layout to the FT8 panel.

> **Note:** FT4 and FT8 use different spectral formats and are not interchangeable. Make sure you are on an FT4 frequency when using this decoder.

---

## 4. CW — Morse Code

**What it is:** The CW decoder listens for Morse code (continuous wave) signals and converts them to text in real time. It automatically tracks the signal frequency and adapts to the operator's sending speed.

### Recommended frequencies

CW is active across amateur bands, typically at the lower portion of each band. Common spots:

| Band | Segment |
|------|---------|
| 40m  | 7.000–7.040 MHz |
| 20m  | 14.000–14.070 MHz |
| 15m  | 21.000–21.080 MHz |

### Setup

1. Tune to a CW signal using **CW** or **CW-L** demodulation mode as appropriate.
2. Enable the decoder and select **CW** from the dropdown.
3. The **CW Decoder** panel appears below.

### Reading the output

- The panel header shows the detected signal frequency in Hz (e.g. `≈ 700 Hz`) and the estimated sending speed in words per minute (e.g. `· 22 WPM`).
- If no signal is detected the header shows **scanning…**
- Decoded text scrolls in amber monospaced text. The blinking cursor (▋) marks where text is currently being written.
- Click **Clear** to erase the output buffer.

> **Tips:**
> - Centre your passband on the CW tone. The decoder works best when the CW signal sits between roughly 400–900 Hz in the audio spectrum.
> - Very fast or very slow sending, and heavily hand-keyed (irregular) Morse, may reduce accuracy.
> - The decoder performs best on a single clean signal. Strong QRM from nearby signals on the same band may confuse it.

---

## 5. WSPR

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
2. The WSPR signal occupies the 1400–1600 Hz audio range. You do not need to adjust the passband further.
3. Enable the decoder and select **WSPR** from the dropdown.
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

## 6. HF FAX / WEFAX

**What it is:** HF Radiofax (also known as WEFAX) is used by coast guard and meteorological services worldwide to broadcast weather maps, sea-state charts, and surface analyses over shortwave. The decoder reconstructs the image line by line as it is received.

### Setup

1. Enable the decoder and select **HF FAX / WEFAX** from the dropdown.
2. The **HF FAX / WEFAX Receiver** panel appears below.
3. **Select a station** from the Station dropdown. Over 20 stations are available covering Europe, Asia, Oceania, and the Americas (e.g. DDH3/DDK3 Germany, SVJ4/GR Greece, JMH Japan, NMG USA New Orleans).
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

## 7. NAVTEX

**What it is:** NAVTEX is the international maritime broadcast system for coastal safety information — navigational warnings, weather forecasts, and search-and-rescue notices. It uses 100-baud FSK (SITOR-B with FEC) and is received on dedicated channels worldwide.

### Available channels

| Channel | Frequency | Usage |
|---------|-----------|-------|
| International | 518 kHz | English-language, international |
| Domestic | 490 kHz | National language broadcasts |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | Long-range HF NAVTEX |

### Setup

1. Enable the decoder and select **NAVTEX** from the dropdown.
2. The **NAVTEX Receiver** panel appears.
3. Select the desired channel from the **Station** dropdown (e.g. `International — 518 kHz`).
4. Click **⇒ Tune & Set IF** to automatically tune the waterfall and narrow the passband to the correct audio window. Mode is set to **USB** automatically. The dial is placed 500 Hz below the channel centre, so the NAVTEX signal appears at 500 Hz audio.

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

`ZCZC` marks the start of a message. The three characters after it identify the station (`M`), subject (`A` = navigational warnings), and sequential number (`12`). `NNNN` marks the end.

Click **Clear** to erase the message buffer.

> **Note:** NAVTEX operates on MF and LF frequencies (518/490 kHz). Reception range is typically 200–400 nautical miles from the transmitter. The HF channels (4–17 MHz) provide much greater range.

---

## 8. FSK / RTTY

**What it is:** A general-purpose FSK (Frequency-Shift Keying) / RTTY decoder supporting three operating variants: Maritime FSK (SITOR), Weather RTTY, and Amateur RTTY. Each variant comes with a preset tuned to its standard parameters.

### Variants and presets

| Variant | Center | Shift | Baud | Framing | Encoding |
|---------|--------|-------|------|---------|----------|
| Maritime FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Weather RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Amateur RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |

### Setup

1. Enable the decoder and select **FSK / RTTY** from the dropdown.
2. The **FSK / RTTY Decoder** panel appears.
3. Select the **Variant** (Maritime, Weather, or Ham). The parameters update automatically.
4. Use the **Known frequency** dropdown to select a common frequency for the chosen variant, then click **Tune** to jump to it.
5. Fine-tune frequency until decoded text becomes stable and readable.

### Known frequencies by variant

**Maritime FSK / SITOR**
- 518.0 kHz — International NAVTEX
- 490.0 kHz — National NAVTEX
- 4209.5 / 6314.0 / 8416.5 / 12579.0 / 16806.5 / 22376.0 kHz — HF SITOR

**Weather RTTY**
- 4583.0 / 7646.0 / 10100.8 / 11039.0 / 14467.3 kHz — DWD (German Weather Service)

**Amateur RTTY**
- 3590 kHz (80m), 7043 kHz (40m), 10143 kHz (30m), 14083 kHz (20m), 21083 kHz (15m), 28083 kHz (10m)

### Parameters

| Parameter | Description |
|-----------|-------------|
| Center audio (Hz) | The audio frequency of the mark/space midpoint |
| Shift (Hz) | Frequency difference between mark and space tones |
| Baud | Symbol rate |
| Framing | Data bits, parity, stop bits (e.g. 7N1 = 7 data, no parity, 1 stop) |
| Encoding | Character set (CCIR-476, ITA2/Baudot, or ASCII) |
| Invert mark / space | Swaps mark and space tones |
| Auto shift detect | Attempts automatic shift measurement from the incoming signal |

### Signal metrics

The status bar shows live measurements:

- **Mark / Space** — measured audio frequency of each tone (Hz)
- **SNR** — signal-to-noise ratio in dB
- **Lock** — decoder lock quality as a percentage
- **Timing** — `LOCKED` when the bit-clock is synchronised, `SEARCH` while still hunting

### Additional controls

- **⇒ Set IF Band-Pass** — narrows the receiver passband to tightly bracket the FSK signal based on the current center and shift settings. Use this after tuning to improve selectivity and reduce adjacent interference.
- **⟳ Auto-tune Center** — triggers an automatic sweep to find and lock onto the mark/space tones. Useful when you are close to the correct frequency but the tones are slightly off.

> **Mode note:** The FSK decoder takes control of the demodulation mode and IF passband while active. Both are restored automatically when you disable the decoder.
>
> **Polarity note:** For RTTY (weather), you usually need to check **Invert mark / space**. For maritime FSK (SITOR/NAVTEX-style) and HAM RTTY, leave it unchecked. If decoded text is garbled, toggling this checkbox is the first thing to try.

---

## 9. General Tips

**Decoder: ON must be engaged first.** The dropdown is disabled (greyed out) until you click the Decoder button to turn it on.

**One decoder at a time.** Selecting a new decoder from the dropdown automatically stops the previously active one and resets any mode or passband changes it made.

**Mode is managed for you.** Several decoders (FAX, NAVTEX, FSK) automatically switch the receiver to USB and adjust the passband when you click their Tune button. When you stop the decoder, the previous mode is restored.

**System clock accuracy matters.** FT8, FT4, and WSPR are time-critical. They decode in fixed UTC-aligned windows. If your computer clock is off by more than 1–2 seconds, decode rates will drop significantly. Use an NTP client to keep your clock accurate.

**Signal quality beats signal strength.** Most of these decoders are designed for weak signals. A quieter band with lower noise is often more productive than a loud, interference-filled signal. Use the waterfall and passband controls to identify and avoid QRM before enabling a decoder.

**Use the Refresh or Clear buttons liberally.** FAX images drift if the dial frequency is slightly off, and text decoders accumulate noise characters. A fresh start after tuning adjustments often produces much cleaner output.

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
