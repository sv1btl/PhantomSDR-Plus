# PhantomSDR-Plus User Guide

Welcome to PhantomSDR-Plus! This guide will help you get the most out of your WebSDR listening experience.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Interface Overview](#interface-overview)
4. [Basic Operations](#basic-operations)
5. [Advanced Features](#advanced-features)
6. [Demodulation Modes](#demodulation-modes)
7. [Digital Decoders](#digital-decoders)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Bookmarks](#bookmarks)
10. [Mobile Usage](#mobile-usage)
11. [Tips and Best Practices](#tips-and-best-practices)
12. [Troubleshooting](#troubleshooting)
13. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

### What is PhantomSDR-Plus?

PhantomSDR-Plus is a web-based Software Defined Radio (SDR) that allows you to listen to radio signals over the internet. No special software or hardware is required on your end—just a modern web browser!

### What Can You Listen To?

Depending on the WebSDR's configuration, you can tune into:

- **Amateur Radio**: Ham radio operators worldwide
- **Broadcast Stations**: AM/FM radio, shortwave broadcasting
- **Aviation**: Air traffic control, aircraft communications
- **Marine**: Ship-to-shore, maritime weather
- **Weather Satellites**: NOAA, METEOR-M
- **Digital Modes**: FT8, RTTY, PSK31, and more
- **Utility Stations**: Time signals, military, government

### System Requirements

- **Browser**: Chrome/Edge (recommended), Firefox, Safari
- **Connection**: Broadband internet (1+ Mbps recommended)
- **Audio**: Working speakers or headphones
- **Optional**: Mouse with scroll wheel for easier tuning

---

## Getting Started

### 1. Access the WebSDR

Open your browser and navigate to the WebSDR URL provided by the operator.

Example: `http://websdr.example.com:9002`

### 2. Initial Page Load

When the page loads, you'll see:
- A colorful waterfall display showing radio activity
- Control panel with frequency display and buttons
- S-meter showing signal strength
- User count indicator

### 3. Start Listening

1. **Click on a signal** in the waterfall display
2. **Audio will automatically start** playing
3. **Adjust volume** using your browser's volume control or the on-screen slider
4. **Fine-tune frequency** by clicking precisely on the signal

---

## Interface Overview

### Main Components

```
┌─────────────────────────────────────────────────────────┐
│  Station Info Bar                                       │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │           Waterfall Display                       │ │
│  │        (Spectrum Visualization)                   │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Frequency Display: 7.100.000 MHz          [S-Meter]   │
├─────────────────────────────────────────────────────────┤
│  [AM] [FM] [USB] [LSB] [CW]    Volume: ▓▓▓▓▓▓▓░░░    │
├─────────────────────────────────────────────────────────┤
│  AGC: [Fast] NR: [Off] NB: [Off] SQL: [Auto]          │
├─────────────────────────────────────────────────────────┤
│  Users: 12    Statistics    Chat    Bookmarks          │
└─────────────────────────────────────────────────────────┘
```

### 1. Waterfall Display

The waterfall is a visual representation of radio signals:

- **Horizontal axis**: Frequency
- **Vertical axis**: Time (scrolls downward)
- **Colors**: Signal strength
  - **Dark blue/black**: No signal (noise floor)
  - **Green/yellow**: Weak to moderate signals
  - **Orange/red**: Strong signals
  - **White**: Very strong signals

### 2. Frequency Display

Shows the currently tuned frequency in various formats:
- **MHz**: 7.100.000 MHz (HF bands)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-Meter (analog or digital)

Displays signal strength:
- **S1-S9**: Standard signal strength scale
- **+dB**: Signals above S9 (e.g., S9+20dB)
- **Analog or Digital**: Depending on configuration

### 4. Mode Buttons

Select demodulation mode:
- **AM**: Amplitude Modulation
- **FM**: Frequency Modulation
- **USB**: Upper Sideband
- **LSB**: Lower Sideband
- **CW**: Morse Code (Continuous Wave)
- **WBFM**: Wideband FM (broadcast)

### 5. Control Panel

Additional controls:
- **AGC**: Automatic Gain Control
- **NR**: Noise Reduction
- **NC**: Noise Cancel
- **NB**: Noise Blanker
- **SQL**: Squelch
- **Zoom**: Waterfall zoom level

### 6. Band Plan Overlay

Colored bars showing frequency allocations:
- Different colors for different services
- Helps identify what's allowed on each frequency

---

## Basic Operations

### Tuning to a Frequency

#### Method 1: Click on Waterfall

1. Click directly on a signal in the waterfall
2. The receiver will tune to that frequency
3. Audio will begin playing

#### Method 2: Type Frequency

1. Click on the frequency display
2. Type the desired frequency
3. Press Enter

Examples:
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Method 3: Use Mouse Wheel

1. Hover over the frequency display
2. Scroll wheel up to increase frequency
3. Scroll wheel down to decrease frequency

#### Method 4: Step Buttons

1. Use the **▲** and **▼** buttons next to frequency
2. Step size varies by mode:
   - **AM/FM**: 1 kHz steps
   - **SSB**: 100 Hz steps
   - **CW**: 10 Hz steps

### Selecting Demodulation Mode

Choose the appropriate mode for the signal:

**For Voice Communications:**
- **AM**: Aviation, broadcast AM, some amateur
- **FM**: VHF/UHF repeaters, FM broadcast
- **USB**: HF ham radio (20m, 17m, 15m, 12m, 10m)
- **LSB**: HF ham radio (160m, 80m, 40m, 30m)

**For Data/Digital:**
- **USB**: Most digital modes (FT8, PSK31, RTTY)
- **LSB**: Some digital modes on lower HF bands

**For Morse Code:**
- **CW**: Telegraph/Morse code signals

### Adjusting Volume

- **On-screen slider**: Drag the volume slider
- **Browser volume**: Use browser's media controls
- **System volume**: Adjust your computer's volume
- **Keyboard**: Use + and - keys (if supported)

### Using the S-Meter

The S-meter shows signal strength:

- **S0-S3**: Very weak signal, difficult to copy
- **S4-S6**: Weak to fair signal
- **S7-S9**: Good to strong signal
- **S9+**: Extremely strong signal

**Tip**: For best audio, tune to signals showing S7 or higher.

---

## Advanced Features

### Auto Gain Control (AGC)

AGC automatically adjusts audio levels:

- **Off**: No automatic gain adjustment
- **Slow**: Gradual level changes (best for SSB)
- **Medium**: Balanced response
- **Fast**: Quick adjustment (best for AM)

**Recommendation**: Start with "Fast" for AM, "Slow" for SSB.

### Noise Reduction (NR)

Reduces background noise:

- **Off**: No noise reduction
- **Low**: Mild noise reduction
- **Medium**: Moderate reduction
- **High**: Aggressive reduction (may affect audio quality)

**Use when**: You hear static or white noise behind the signal.

### Noise Blanker (NB)

Removes impulse noise (clicks, pops):

- **Off**: No blanking
- **On**: Active noise blanking

**Use when**: You hear clicks from power lines, motors, or interference.

### Noise Cancel (NC)

Cancels specific interfering signals:

- **Off**: No cancellation
- **On**: Active cancellation

**Use when**: You hear a steady tone or interference on the frequency.

### Auto Squelch (SQL)

Mutes audio when no signal is present:

- **Off**: Always playing (hear static)
- **Auto**: Automatically sets threshold
- **Manual**: Adjust threshold manually

**Use when**: Monitoring a frequency for activity.

### Zoom Function

Magnifies the waterfall display:

- **1x**: Normal view (wide coverage)
- **2x**: 2× magnification
- **4x**: 4× magnification
- **8x**: 8× magnification

**Use when**: You need to see signals more clearly or tune precisely.

---

## Demodulation Modes

### AM (Amplitude Modulation)

**Used for:**
- Aviation communications
- AM broadcast radio
- Some amateur radio
- Maritime communications

**Characteristics:**
- Wide bandwidth (typically 10 kHz)
- Susceptible to noise
- Easy to tune (just click on signal)

**Best Practices:**
- Use Fast AGC
- Enable Noise Blanker if you hear clicks
- Tune to peak of signal on waterfall

### FM (Frequency Modulation)

**Used for:**
- VHF/UHF amateur radio repeaters
- Public service (police, fire, EMS)
- Commercial two-way radio
- Some satellite communications

**Characteristics:**
- Narrow bandwidth (typically 12.5 or 25 kHz)
- Excellent noise immunity
- "Capture effect" (strongest signal wins)

**Best Practices:**
- Tune precisely to center of signal
- Use squelch to mute when idle
- Disable noise reduction (not needed)

### USB (Upper Sideband)

**Used for:**
- HF amateur radio (above 10 MHz)
- Most HF digital modes
- Maritime communications (above 8 MHz)

**Characteristics:**
- Narrow bandwidth (typically 2.4 kHz)
- Efficient use of spectrum
- Requires precise tuning

**Best Practices:**
- Use Slow AGC
- Tune to lower edge of signal on waterfall
- Enable Noise Reduction if needed

### LSB (Lower Sideband)

**Used for:**
- HF amateur radio (below 10 MHz)
- Some HF digital modes
- Maritime communications (below 8 MHz)

**Characteristics:**
- Same as USB but mirror image
- Convention: LSB on lower HF bands

**Best Practices:**
- Use Slow AGC
- Tune to upper edge of signal on waterfall
- Enable Noise Reduction if needed

### CW (Continuous Wave / Morse Code)

**Used for:**
- Amateur radio telegraphy
- Navigational beacons
- Time signal stations

**Characteristics:**
- Very narrow bandwidth (100-500 Hz)
- High efficiency
- Requires learning Morse code to understand

**Best Practices:**
- Use narrow filter (200-400 Hz)
- Tune precisely to tone center
- Enable audio filter for better tone

### WBFM (Wideband FM)

**Used for:**
- FM broadcast radio (88-108 MHz)
- Some satellite downlinks

**Characteristics:**
- Very wide bandwidth (200 kHz)
- Excellent audio quality
- High fidelity

**Best Practices:**
- Tune to exact center frequency
- No squelch needed for broadcast
- Enjoy high-quality audio!

---

## Digital Decoders

PhantomSDR-Plus includes built-in decoders for digital modes.

### FT8 Decoder

**What is FT8?**
- Popular amateur radio digital mode
- Weak signal communication
- 15-second transmissions

**How to use:**
1. Tune to FT8 frequencies (7.074, 14.074, etc.)
2. Select USB mode
3. Enable FT8 decoder from menu
4. Watch decoded messages appear

**Common FT8 Frequencies:**
- 40m: 7.074 MHz
- 20m: 14.074 MHz
- 15m: 21.074 MHz
- 10m: 28.074 MHz

---

## Keyboard Shortcuts

Keyboard shortcuts for faster operation:

### Frequency Control
- **Arrow Up/Down**: Change frequency (large steps)
- **Page Up/Down**: Change frequency (small steps)
- **Mouse Wheel**: Fine-tune frequency
- **Number keys**: Direct frequency entry

---

## Bookmarks

Save your favorite frequencies for quick access. You can also export the list of bookmarks and save it localy, and import the list to any other PhantomSDR. 

When bookmarks and markers overlap:

🔵 Blue bookmarks appear on top <br />
🟡 Yellow markers appear underneath <br />
✅ Bookmark clicks take priority <br />


### Adding a Bookmark

1. Tune to desired frequency
2. Click "Bookmarks" button
3. Click "Add Bookmark"
4. Enter description
5. Click "Save"

┌──────────────┬────────────────┬────────┐
│ Bookmark name│Label (optional)│ [Add]  │
└──────────────┴────────────────┴────────┘

### How to Use:

**Add bookmark:**
- Name: "Local News Station"
- Label: "NEWS"
- Click Add

**View on waterfall:**
- Zoom in until markers appear
- See marine blue box with "NEWS" in bold yellow

**Click bookmark:**
- Tunes to frequency
- Sets demodulation mode
- Works exactly like clicking a marker

### Managing Bookmarks
- **Edit**: Click pencil icon next to bookmark
- **Delete**: Click trash icon next to bookmark
- **Export**: Download bookmarks as JSON file
- **Import**: Upload bookmarks from JSON file

### Sharing Bookmarks

1. Click "Export Bookmarks"
2. Share the JSON file with others
3. Recipients click "Import Bookmarks"
4. Select your file
---

## Mobile Usage

PhantomSDR-Plus works great on mobile devices!

### Mobile-Specific Features

- **Touch-friendly controls**: Large buttons and sliders
- **Swipe to tune**: Swipe left/right on waterfall
- **Pinch to zoom**: Pinch waterfall to zoom in/out
- **Landscape mode**: Rotate for better view

### Mobile Tips

1. **Use WiFi**: Streaming audio uses data
2. **Landscape orientation**: Better waterfall view
3. **Headphones**: Better audio quality
4. **Bookmark favorites**: Easier to revisit stations
5. **Close other apps**: Ensure smooth performance

### Mobile Browser Recommendations

- **Android**: Chrome or Samsung Internet
- **iOS**: Mozilla
- **Both**: Ensure browser is up to date

---

## Tips and Best Practices

### For Best Reception

1. **Choose strong signals**: Look for orange/red on waterfall
2. **Tune precisely**: Click directly on signal center
3. **Select correct mode**: Match the signal type
4. **Adjust AGC**: Fast for AM, Slow for SSB
5. **Use NR/NB**: Help with noisy conditions

### Finding Activity

1. **Watch the waterfall**: Colors show signal strength
2. **Listen on popular frequencies**:
   - 40m: 7.100-7.300 MHz (LSB)
   - 20m: 14.200-14.350 MHz (USB)
   - 2m: 145.200-145.600 MHz (FM)
3. **Check band plan overlay**: Shows frequency allocations
4. **Use bookmarks**: Quick access to active frequencies

### Understanding Band Conditions

**Daytime HF (High Frequency):**
- Higher bands work better (20m, 15m, 10m)
- Long-distance (DX) communication possible
- Broadcast stations audible

**Nighttime HF:**
- Lower bands work better (80m, 40m)
- Different propagation patterns
- Different stations audible

**VHF/UHF:**
- Mostly line-of-sight
- Local communications
- More consistent conditions

### Etiquette

1. **Don't tie up the receiver**: Others want to listen too
2. **Use chat respectfully**: Be courteous to other users
3. **Report problems**: Help the operator maintain the station
4. **Don't ask for tech support**: This is a listening platform. Send a message to the Sysop for help.

---

## Troubleshooting

### No Audio

**Possible causes:**
1. Browser muted → Check browser volume controls
2. System muted → Check computer volume
3. Weak signal → Tune to stronger signal (S7+)
4. Wrong mode → Try different demodulation modes

**Solutions:**
1. Click a strong signal (orange/red on waterfall)
2. Check browser isn't muted (look for mute icon in tab)
3. Try a different frequency
4. Reload the page (F5)

### Distorted Audio

**Possible causes:**
1. Overdriven signal → Signal too strong
2. Wrong mode → AM signal on SSB mode, etc.
3. Interference → Adjacent signals bleeding over

**Solutions:**
1. Reduce volume
2. Try different demodulation mode
3. Use narrower filter bandwidth
4. Tune away from interfering signals

### Waterfall Not Updating

**Possible causes:**
1. Network issue → Slow or interrupted connection
2. Browser performance → Too many tabs open
3. Server overload → Too many users

**Solutions:**
1. Check internet connection
2. Close unnecessary browser tabs
3. Reload page (F5)
4. Try again later when fewer users online

### Can't Tune to Frequency

**Possible causes:**
1. Frequency out of range → SDR doesn't cover that frequency
2. Typing wrong format → Use correct format (e.g., "14200" not "14.200.000")

**Solutions:**
1. Check SDR's frequency coverage (shown on page)
2. Use frequency format examples provided
3. Click on waterfall instead

### Stuttering/Choppy Audio

**Possible causes:**
1. Slow internet connection
2. High server load
3. Browser performance issues

**Solutions:**
1. Close other applications using bandwidth
2. Try again during off-peak hours
3. Close unnecessary browser tabs
4. Use wired connection instead of WiFi

---

## Frequently Asked Questions

### General Questions

**Q: Do I need special equipment to use WebSDR?**
A: No! Just a computer or mobile device with internet access.

**Q: Is WebSDR free to use?**
A: Yes, most WebSDRs are free. They're operated by volunteers.

**Q: Can I transmit with WebSDR?**
A: No, WebSDR is receive-only. You cannot transmit.

**Q: What frequencies can I listen to?**
A: Depends on the WebSDR's configuration. Check the station info.

**Q: Can I record audio?**
A: Some browsers allow recording. Check your browser's features.

### Technical Questions

**Q: What sample rate does the SDR use?**
A: Varies by station. Check the station information page.

**Q: What's the latency?**
A: Typically 2-5 seconds between radio signal and your speakers.

**Q: Can I use multiple instances?**
A: Usually yes, but it may strain the server. Be considerate.

**Q: Does it work offline?**
A: No, WebSDR requires internet connection.

**Q: What browsers are supported?**
A: Chrome, Firefox, Edge, Safari (all recent versions)

### Usage Questions

**Q: How many people can listen at once?**
A: Depends on server capacity. Often 50-200+ users.

**Q: Can I see what others are listening to?**
A: If enabled, yes. Look for "other users" indicators.

**Q: Can I chat with other listeners?**
A: If enabled by operator. Look for chat box.

**Q: Why do some frequencies show nothing?**
A: No signals on that frequency at the moment. Try others!

**Q: What are the colored bands on the waterfall?**
A: Band plan overlay showing frequency allocations.

---

## Resources

### Learning More About Radio

- **Band Plans**: Search "amateur radio band plan" + your region
- **Propagation**: Learn about HF radio wave propagation
- **Digital Modes**: Research FT8, PSK31, RTTY
- **Ham Radio**: Consider getting an amateur radio license!

### Finding More WebSDRs

- **WebSDR Directory**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Getting Help

1. **Station operator**: Check contact info on page
2. **User chat**: Ask other listeners (if available)
3. **Online forums**: Search for WebSDR communities
4. **Documentation**: Refer to this guide!

---

## Appendix: Common Frequencies

### HF Amateur Radio Bands

| Band | Frequency Range | Mode | Activity |
|------|----------------|------|----------|
| 160m | 1.800-2.000 MHz | LSB | Night/Local |
| 80m | 3.500-4.000 MHz | LSB | Night/Regional |
| 40m | 7.000-7.300 MHz | LSB | Day/Night/DX |
| 30m | 10.100-10.150 MHz | USB | Data/CW only |
| 20m | 14.000-14.350 MHz | USB | Daytime/DX |
| 17m | 18.068-18.168 MHz | USB | Daytime/DX |
| 15m | 21.000-21.450 MHz | USB | Daytime/DX |
| 12m | 24.890-24.990 MHz | USB | Daytime/DX |
| 10m | 28.000-29.700 MHz | USB | Sporadic/DX |

### VHF/UHF Amateur Bands

| Band | Frequency Range | Mode | Activity |
|------|----------------|------|----------|
| 6m | 50.000-54.000 MHz | USB/FM | Sporadic |
| 2m | 144.000-148.000 MHz | FM | Very Active |
| 70cm | 420.000-450.000 MHz | FM | Active |

### Broadcast Bands

| Service | Frequency Range | Mode |
|---------|----------------|------|
| AM Radio | 530-1710 kHz | AM |
| Shortwave | 2.3-26.1 MHz | AM |
| FM Radio | 88-108 MHz | WBFM |

### Aviation

| Service | Frequency Range | Mode |
|---------|----------------|------|
| Air Traffic Control | 118-137 MHz | AM |
| ACARS (data) | 130-136 MHz | Data |

### Maritime

| Service | Frequency Range | Mode |
|---------|----------------|------|
| Marine VHF | 156-162 MHz | FM |
| Marine HF | 2-22 MHz | USB |

---

## Glossary

**AGC**: Automatic Gain Control - adjusts audio levels automatically

**AM**: Amplitude Modulation - voice mode used for aviation and broadcast

**Bandwidth**: The frequency range of a signal

**CW**: Continuous Wave - Morse code signals

**DX**: Long distance communication

**FFT**: Fast Fourier Transform - converts time to frequency domain

**FM**: Frequency Modulation - voice mode for VHF/UHF

**HF**: High Frequency (3-30 MHz) - long distance bands

**kHz**: Kilohertz (1,000 Hz)

**LSB**: Lower Sideband - voice mode for lower HF bands

**MHz**: Megahertz (1,000,000 Hz)

**NB**: Noise Blanker - removes impulse noise

**NR**: Noise Reduction - reduces background noise

**PSK**: Phase Shift Keying - digital mode

**RTTY**: Radio Teletype - digital text mode

**S-meter**: Signal strength meter

**SDR**: Software Defined Radio

**SQL**: Squelch - mutes audio when no signal present

**SSB**: Single Sideband (USB or LSB)

**USB**: Upper Sideband - voice mode for higher HF bands

**VHF**: Very High Frequency (30-300 MHz) - line-of-sight

**UHF**: Ultra High Frequency (300-3000 MHz) - line-of-sight

**Waterfall**: Visual display of radio spectrum over time

---

**Enjoy exploring the radio spectrum with PhantomSDR-Plus!**

**73 (Best regards) de SV1BTL & SV2AMK**

For installation instructions, see [INSTALLATION.md](INSTALLATION.md).
For technical details, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
