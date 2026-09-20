# JS8 decoder — Phases 0–11

Constants and validation harness for a JS8 decoder built on the same ft8_lib
tree that already produces `frontend/public/decoders/ft8_lib.wasm`.

| File | Purpose |
|---|---|
| `js8_constants.h` / `.c` | **Generated.** LDPC(174,87) tables, Costas patterns, CRC-12 parameters, submode table |
| `extract_js8_constants.py` | Generator — parses the JS8Call Fortran sources |
| `js8_encode.h` / `.c` | Transmit side: pack, CRC-12, LDPC encode, tone mapping |
| `js8_decode.h` / `.c` | Receive side: STFT monitor, Costas search, soft symbols, BP, CRC |
| `js8_wasm_wrapper.c` | Browser-facing API; returns raw payload bits, not text |
| `build_js8_wasm.sh` | emcc invocation → `frontend/public/decoders/js8.wasm` |
| `js8_roundtrip.c` | Phase 0 checks: encode parity, round trip, parity tables |
| `js8_decode_test.c` | Phase 1 checks: synthesise audio, decode, SNR sweep |
| `js8_wasm_test.mjs` | Loads the built wasm from node, the way the browser does |
| `extract_js8_varicode.py` | Generates the message-layer tables and the JSC dictionary |
| `js8_frames_test.mjs` | Phase 2 checks: `js8.js` vs frames unpacked by JS8Call |
| `js8_reassembly_test.mjs` | Phase 3 checks: checksums vs JS8Call, real multi-frame messages |
| `js8_slots_test.mjs` | Phase 4 checks: slot scheduling simulated over minutes |
| `js8_autorun_test.mjs` | Phase 6 checks: spot eligibility, bandplan, the autorun worker |
| `js8_osd.c` / `.h` | Order-1 ordered-statistics decoding — implemented, **off by default** |
| `js8_subtract.c` / `.h` | Coherent subtraction of a decoded signal, for multi-pass decoding |
| `js8_ab_test.mjs` | Phase 7: our receiver vs JS8Call's, on identical recorded audio |
| `reference/build_reference_decoder.sh` | Builds JS8Call's own `js8a_decode` standalone |
| `js8_chain_test.mjs` | Full chain: audio → wasm → `js8.js` → message |
| `reference/` | Containerised JS8Call build that produces the ground truth |
| `ref_gen.f90` | Driver around JS8Call's *unmodified* `genjs8()` |
| `check_against_reference.sh` | Builds both encoders and diffs them |
| `run_tests.sh` | All of the above, in order |

The message layer itself lives in the frontend, not here:

| File | Purpose |
|---|---|
| `frontend/src/modules/js8.js` | Frame decoding: callsigns, grids, commands, varicode text |
| `frontend/src/modules/js8-reassembler.js` | Stitches frames into whole messages |
| `frontend/src/modules/js8-decoder.js` | Browser bridge to `js8.wasm` |
| `frontend/src/modules/js8-slots.js` | Slot geometry: cycles, capture length, acceptance window |
| `frontend/src/modules/js8-format.js` | Message and frame text, shared by the panel and the spectrum marks |
| `frontend/src/modules/js8-tables.js` | **Generated.** Huffman, commands, basecalls, alphabets |
| `frontend/public/decoders/js8_dict.bin` | **Generated.** JSC word dictionary, lazily fetched |

`~/ft8_lib_ft2/ft8/js8_constants.{h,c}` are **symlinks back into this
directory**, matching the arrangement used for `jsdsp/ft8_wasm/wasm_wrapper.c`:
exactly one copy of each file, and it is the tracked one.

## Building and validating

```sh
cd ~/PhantomSDR-Plus/jsdsp/js8_wasm
source ~/emsdk/emsdk_env.sh
./build_js8_wasm.sh        # -> frontend/public/decoders/js8.wasm (~30 kB)
./run_tests.sh             # constants, native decoder, and the built wasm
```

`check_against_reference.sh` alone runs just the constants check. It needs
`git`, `gcc`, `g++`, `gfortran` and boost headers, and clones JS8Call into
`/tmp/js8-phase0` (override with `JS8_WORK`), builds an encoder from upstream
Fortran, builds ours from these constants, and diffs the 87 information bits and
79 channel tones for every vector. Last run: **2000/2000 bit-identical**.

Three separate things are checked; see the header comment in `js8_roundtrip.c`.
The third is worth calling out: the generator matrix comes from
`ldpc_174_87_params.f90` but the parity tables `Nm`/`Mn`/`nrw` come from
`bpdecode174.f90`, so the syndrome checks validate those two files against each
other rather than trusting either alone.

## What JS8 actually is

JS8 is FT8 **v1**, not v2. Relative to the FT8 code already in ft8_lib:

| | FT8 v2 (in tree) | JS8 |
|---|---|---|
| LDPC | (174, 91) | (174, **87**) |
| CRC | 14 bits | **12 bits**, poly `0xC06`, result **XOR 42** |
| Payload | 77 bits | **75 bits** |
| Gray map | yes | **none** — 3 codeword bits map straight to a tone |
| Codeword order | `[message｜parity]` | `[parity｜message]`, then permuted by `colorder` |
| Costas | one pattern, ×3 | submode A one pattern ×3; B/C/E/I **three distinct** |

Frame geometry is identical to FT8: 79 symbols, `S7 D29 S7 D29 S7`.

### Submodes

Taken from `lib/js8/js8{a,b,c,e,i}_params.f90` and asserted by the generator, so
these cannot drift from upstream silently.

| Name | Letter | NSUBMODE | Costas | NSPS | Baud / tone spacing | BW | T/R | Frame | Lead-in |
|---|---|---|---|---|---|---|---|---|---|
| Normal | A | 0 | 1 | 1920 | 6.25 Hz | 50 Hz | 15 s | 12.64 s | 0.5 s |
| Fast | B | 1 | 2 | 1200 | 10 Hz | 80 Hz | 10 s | 7.90 s | 0.2 s |
| Turbo | C | 2 | 2 | 600 | 20 Hz | 160 Hz | 6 s | 3.95 s | 0.1 s |
| Slow | E | 4 | 2 | 3840 | 3.125 Hz | 25 Hz | 28 s | 25.28 s | 0.5 s |
| Ultra | I | 8 | 2 | 384 | 31.25 Hz | 250 Hz | 4 s | 2.52 s | 0.1 s |

### Frame types

The 3 bits between the 72-bit payload and the CRC (`varicode.h`):

```
000 heartbeat      010 compound directed    10X data
001 compound       011 directed             11X data, compressed
```

## Phase 1: the decoder

`js8_decode.c` is a **parallel** implementation, not an extension of ft8_lib's
`decode.c` / `ldpc.c` / `crc.c`. That is a change from the original plan, made
after reading those files: they hardcode `FTX_LDPC_K = 91`, a 14-bit CRC,
Gray-mapped symbols and an unpermuted `[message|parity]` codeword. JS8 differs
in every one of those, so the "shared" path would have been a parameter struct
threaded through the entire live FT8/FT4/FT2 decoder in exchange for very
little actually-shared code — a real risk to a working receiver for no gain.
Only kiss_fft is shared. `ft8_lib.wasm` is untouched.

The pipeline is the familiar one: STFT → Costas candidate search over the three
sync blocks → soft 8-FSK symbol likelihoods → belief propagation → colorder
un-permutation → CRC-12.

It stops at the 75 payload bits. A JS8 frame is not a message — varicode,
callsign unpacking and multi-frame reassembly are Phase 2/3 and live in JS.

### Measured sensitivity

`./js8_decode_test --sweep 20`, decode rate in a 2500 Hz reference bandwidth:

| SNR dB | Normal | Fast | Turbo | Slow | Ultra |
|---|---|---|---|---|---|
| −12 | 100% | 100% | 100% | 100% | 95% |
| −14 | 100% | 100% | 90% | 100% | 15% |
| −16 | 100% | 100% | 15% | 100% | 0% |
| −18 | 100% | 75% | 0% | 100% | 0% |
| −20 | 55% | 0% | 0% | 100% | 0% |
| −22 | 0% | 0% | 0% | 75% | 0% |

That looked like **~5–6 dB short of JS8Call's published thresholds** (−25
Normal, −23 Fast, −20 Turbo, −28 Slow, −18 Ultra).

> **That comparison was wrong, and Phase 11 measured the real figure: 0.5 dB.**
> Those published numbers are theoretical Eb/N0 figures from the Fortran
> params comments, not measured decode thresholds on the 2500 Hz SNR scale.
> Running both decoders over identical audio puts the gap at half a dB. The
> paragraphs below are left as written; treat the "5 dB" framing they carry as
> superseded.

The two things JS8Call does that this does not:

- **OSD** (ordered-statistics decoding, `osd174.f90`) when BP fails
- **multi-pass decoding with signal subtraction** (`subtractjs8.f90`)

Both are additive later; neither blocks the frontend work.

### Oversampling is already at its optimum

`nfft = block_size * freq_osr`, so raising `freq_osr` *lengthens* the STFT
analysis window and smears adjacent symbols. Measured: `freq_osr` 4 costs about
2 dB versus 2. `time_osr` 4 buys nothing except a little on Slow, at double the
CPU. **2/2 is the measured optimum — do not change it without re-running the
sweep.**

## Phase 2: the message layer

`frontend/src/modules/js8.js` turns the wasm's 75 payload bits into a frame:

```
bits 0..2    frame type  (heartbeat / compound / compound-directed / data)
bits 3..71   type-specific fields
bits 72..74  i3bit -- a BITFIELD, not a type: first / last / raw-data
```

Two three-bit fields is the trap here. `i3bit` says whether this frame starts or
ends a multi-frame message (and whether it is a headerless data frame); the
*frame type* is a separate field at the front of the payload. Phase 1 originally
exported `i3bit` under the name `frame_type`; that is now fixed.

Frame layouts, all 72 bits:

| Type | Layout |
|---|---|
| Heartbeat / compound | `[3 type][50 callsign][11 num_hi][5 num_lo][3 unused]` |
| Directed | `[3 type][28 from][28 to][5 cmd][1 port_from][1 port_to][6 extra]` |
| Data | `[1 data][1 compressed][70 payload]`, pad = one `0` then all `1`s |

### The dictionary problem, resolved

Plain data frames use a 44-entry character Huffman table, which is inlined.
Compressed frames use JSC, a 262144-word dictionary — 12 MB of C++ source
upstream. Two things make that tractable:

- JS8Call ships the dictionary **twice** (`list` sorted for compression lookup,
  `map` indexed by codeword for decompression). A receiver needs only `map`.
- Stripped to bare words in a length-prefixed binary blob it is **1.9 MB, about
  1 MB gzipped**, and it is fetched **lazily** — only when a compressed frame
  actually arrives. Heartbeats, compound frames and directed commands never
  touch it.

### Validation

Ground truth comes from JS8Call itself. `reference/build_reference_frames.sh`
compiles JS8Call's own `varicode.cpp` and `jsc.cpp` under Qt6 in a rootless
podman container and has them unpack a batch of frames; `js8_frames_test.mjs`
requires `js8.js` to produce identical output for identical input.

```
js8.js vs JS8Call: 5020 frames
  compound     635 frames  all match
  data        3763 frames  all match
  directed     298 frames  all match
  heartbeat    324 frames  all match
```

Most vectors are pseudorandom rather than realistic, deliberately: random frames
sweep the callsign, grid and command unpackers across their whole range,
including corners (base-27 padding, the Swaziland and Guinea workarounds, the
grid-versus-command overloading of the same field) that a handful of tidy
example messages never reach. It was run at 20020 frames during development
with the same result; 5020 are committed as the regression fixture.

Two bugs that only this test would have caught:

- **The pad scan ran over 75 bits instead of 72**, so `i3bit` leaked into the
  data-frame payload and appended stray characters.
- **A commented-out table entry was being parsed.** `// {" ", 14 }` sits right
  above the live `{" ACK", 14}` in `varicode.cpp`, and it won the
  "first key in sorted order" tie-break — silently turning every ACK into a
  blank command. The extractor now strips comments before matching.

`js8_chain_test.mjs` then runs the whole thing together: real JS8Call-packed
frames → synthesised audio at −12 dB → `js8.wasm` → `js8.js` → text, which is
what proves the payload handoff (byte order, bit order) is right.

## Phase 3: reassembly

`frontend/src/modules/js8-reassembler.js` holds the cross-slot state that
`js8.js` deliberately does not. The policy is transcribed from JS8Call's
`mainwindow.cpp` (`m_messageBuffer`):

- buffers are keyed by audio offset in Hz and matched within a per-submode
  tolerance — **10 / 16 / 32 / 10 / 50 Hz** for Normal / Fast / Turbo / Slow /
  Ultra — and they **migrate** to the newest offset as the signal drifts
- a frame flagged *first* abandons whatever was open at that frequency
- a directed frame carrying a **buffered** command (MSG, relay, the queries)
  opens a buffer and waits for the data frames that carry its text
- a buffer closes on a frame flagged *last*; after **60 s** idle it closes
  anyway, and after **90 s** it is discarded
- after **1.5 T/R periods** of silence an idle marker (`……`) is appended, so a
  stalled message reads as unfinished rather than as finished-and-short
- buffered commands carry a **CRC-16/KERMIT** checksum, packed base-41, at the
  end of the assembled text; a message that fails it is dropped, as upstream does

Time is injected rather than read from the clock, so the 60 s and 90 s rules are
testable without waiting.

### Validation

The checksum is mechanical, so it is diffed against JS8Call directly —
**510/510 vectors** from `Varicode::checksum16`. It gates whether a multi-frame
MSG or relay is accepted at all, so getting it wrong would silently drop real
traffic.

The buffering policy itself lives in UI-level code that cannot be driven
headlessly, so those are scenario tests of the transcribed rules, each naming
the rule it pins. What *is* real ground truth is the frame sequences:
`Varicode::buildMessageFrames()` is JS8Call's actual transmit path, so the
multi-frame vectors are what a real station would put on the air, first/last
flags and all. Each one must reassemble back to its original text.

`js8_chain_test.mjs` then runs those through everything — one audio slot per
frame at −12 dB, wasm, `js8.js`, reassembler:

```
  4 slots  "HELLO BRAVE NEW WORLD THIS IS A LONG MES..."  ok
  3 slots  "THE QUICK BROWN FOX JUMPS OVER THE LAZY ..."  ok
  4 slots  "GOOD MORNING FROM GREECE THE WEATHER IS ..."  ok
```

## Phase 4: wired into the receiver

`audio.js` now schedules JS8 slots alongside FT8/FT4/FT2, and
`decoder.worker.js` runs the decode off the main thread. The public API is
`setJS8Decoding(bool)`, `setJS8Submode(0..4)`, `js8Pending()`, and the
`onJS8Message` / `onJS8Frames` callbacks.

A decoded slot goes: worker → `js8.js` per frame → reassembler → `onJS8Message`.
The mini spectrum gets the same `{hz, snr, text}` marks the FTx modes use, and
the existing DT auto-sync works unchanged (one lead-in per submode, since their
start delays are 0.5 / 0.2 / 0.1 / 0.5 / 0.1 s).

### The 28-versus-30 second trap

**Slow's T/R cycle is 30 s, but a station only transmits for 28 of them.** The
Fortran `NTXDUR` is the transmit duration; `JS8E_TX_SECONDS` in `commons.h` is
the cycle. Phases 0–3 had been using `NTXDUR` as the period throughout — wrong
for Slow, and it would have mis-aligned every Slow slot and skewed the
reassembler's idle timing. Both values are now carried and both are asserted
against upstream:

| | Normal | Fast | Turbo | Slow | Ultra |
|---|---|---|---|---|---|
| Cycle (align to this) | 15 | 10 | 6 | **30** | 4 |
| Transmit (capture this) | 15 | 10 | 6 | **28** | 4 |

### Slot scheduling is tested, not inspected

The geometry lives in `js8-slots.js` rather than inline in `audio.js`
specifically so it can be driven directly. The FT8 path already hit the failure
mode this guards: an acceptance window a shade too wide lets the next capture
latch early, and every slot then creeps earlier until it wraps. It never
errors — it just decodes badly, sometimes.

`js8_slots_test.mjs` simulates ten minutes of audio callbacks per submode and
asserts one complete capture per cycle, no drift between captures, and a stable
start phase — across block sizes, mid-cycle starts and every capture lead-in.

## Phase 5: the UI

JS8 is now a decoder you can select. `App.svelte` gains a `JS8` button and
dropdown entry, and a panel with a speed selector (Normal / Fast / Turbo /
Slow / Ultra), slot progress, the shared `FtxSpectrum`, the existing sync-offset
slider, and two message lists. Both the desktop and the mobile decoder sections
carry it — they are separate copies in the same file.

**Two lists, because JS8 is not FT8.** Completed messages go in the main list;
messages still arriving are shown above it in green with a blinking caret. A
JS8 message can span four slots — a minute on Normal — and without the partial
text the mode looks stalled rather than live. Messages closed by a timeout
rather than by a last-frame marker are italicised and dimmed: the text is real,
but it may be cut short.

The row is three columns (Hz, dB, message) with the text free to wrap, not the
seven-column `ftx-grid`. A JS8 message is a sentence, and truncating it would
throw away the point of the mode.

Selecting JS8 switches the receiver to USB, like the other digital modes.
Changing speed abandons everything in flight — the buffers hold frames from a
different slot cadence, and the grouping tolerance differs per speed — and
re-reads that submode's stored sync offset.

Message formatting lives in `js8-format.js` rather than in the template, so the
panel and the spectrum marks cannot drift and the strings are testable.

### Verified

The frontend builds, and the running receiver serves the result: both panels
are present in the bundle, and `/decoders/js8.wasm` (30 kB) and
`/decoders/js8_dict.bin` (1.9 MB) both return 200 at their expected sizes.

**Not verified: how it looks or behaves in an actual browser.** There is no
browser automation in this environment, so the panel has been checked by
building, by serving, and by testing the logic behind it — not by looking at
it. Clicking JS8 on a live receiver is the remaining step, and the first place
a layout or wiring problem would show up.

## Phase 6: spotting, and the first real signal

The headless autorun engine now knows about JS8. `autorun/bandplan.js` carries
the nine HF calling frequencies from JS8Call's own `FrequencyList.cpp`,
`decodeworker.js` decodes a slot into structured frames, and `spotparse.js`
decides what is reportable. `autorun/probe-js8.js` runs the whole chain against
a live band and prints what it hears.

Only **Normal** is spotted. The other speeds exist, but a spotting receiver
wants the calling speed — that is where heartbeats and CQs are, and it is the
one every station can hear.

### What is reportable

Heartbeats and compound frames carry the sender and a grid; directed frames
carry the sender without one (the grid in a directed frame belongs to the
target). Data frames carry no callsign at all. Two things must **never** be
uploaded, because the result is bad data on someone else's map:

- `@ALLCALL`, `@JS8NET`, `@DX/EU`, `@REGION/1` … are **destinations, not
  stations**
- `<....>` is a callsign the decoder could not resolve

Both are rejected, along with anything that does not look like a callsign.

### On the air

**`MM0ZFG: F4LPU HEARTBEAT SNR +03` — 20 m, 14079.0 kHz, −4 dB, 09:43 UTC.**

That is the first real JS8 signal this decoder has seen: a directed frame from
a station in Scotland to one in France, decoded, reassembled and formatted by
the full chain. Everything before this phase was synthesised audio from our own
encoder.

Getting there took some digging, and the digging is worth recording:

- The first live runs decoded **nothing**. The FT8 probe on the same tap got 24
  decodes at 14074, and the captured audio at 14078 had the same RMS, so it was
  neither the band nor the gain.
- Spectral analysis of a 75 s capture found a **47 Hz-wide** signal at
  955–1002 Hz — exactly a JS8 Normal signature — and the sync search was
  scoring it 14 against a noise floor of 10, where a clean synthetic signal
  scores 27.
- A 4-minute capture showed 15 s slot-aligned bursts, confirming real activity.

The answer turned out to be that **20 m JS8 was simply very quiet** — roughly
one transmission every couple of minutes at that hour. But chasing it exposed a
real bug, below.

### The synthesiser, and a wrong turn worth recording

This phase added GFSK shaping to the test synthesiser on the assumption that
JS8, like FT8, is GFSK — and re-fitted the STFT timing correction from one
symbol to half a symbol to match.

**That assumption was wrong, and Phase 10 undid it.** JS8Call's `Modulator.cpp`
holds the phase increment constant for a whole symbol with no shaping: JS8
transmits plain **CPFSK**. The synthesiser is back to CPFSK by default (the
GFSK path is kept so the difference can be re-measured), and the timing
correction is back to one symbol.

Left uncorrected this would have been a quiet 80 ms timing bias. It also, less
quietly, made coherent subtraction useless — see Phase 10.

## Phase 7: against JS8Call's own receiver

Everything before this checked us against JS8Call's *encoder* or its
*unpackers*. This checks our **receiver** against theirs, on identical audio.

`reference/build_reference_decoder.sh` compiles JS8Call's `js8a_decode` — sync,
belief propagation, OSD and four-pass subtraction — into a standalone binary in
a container, and runs it over a raw recording. `js8_ab_test.mjs` runs ours over
the same file and diffs the results.

Both print the 12-character frame text, so the comparison is on recovered
**bits**, not on formatted messages: no room for a difference to hide behind
presentation.

### Result: 5/5, bit-identical

Ten minutes of live 20 m audio, 39 slots:

```
  = slot 10 1084Hz  -9dB  ALfl2Ol1uU9O i3=1  IZ2WMD JN45
      JS8Call  -3dB 1085Hz  ALfl2Ol1uU9O i3=1
  = slot 11 1088Hz -11dB  KkmRkVW0O+N8 i3=0  @ARIRE
      JS8Call -11dB 1086Hz  KkmRkVW0O+N8 i3=0
  = slot 12 1088Hz  -8dB  tuhyL-BDSud+ i3=2  CQ CQ CQ JN45
      JS8Call -12dB 1086Hz  tuhyL-BDSud+ i3=2
  = slot 24 1088Hz  -6dB  2Lfl2Ol1vU9O i3=3  IZ2WMD JN45 HB
      JS8Call -11dB 1087Hz  2Lfl2Ol1vU9O i3=3
  = slot 35 1088Hz  -9dB  2Lfl2Ol1vU9O i3=3  IZ2WMD JN45 HB
      JS8Call  -6dB 1087Hz  2Lfl2Ol1vU9O i3=3

caught 5/5 of JS8Call's decodes (100%)
```

Slots 10–12 are one three-frame message — IZ2WMD in JN45 calling CQ to the
@ARIRE group — which our reassembler stitches back together.

This does **not** retire the sensitivity question. Five frames on a quiet band,
all at comfortable SNR, says we lose nothing on signals either decoder can
hear — not how the two compare at threshold. Phase 11 measures that directly.

### It did find a real defect: the SNR was 13 dB optimistic

Our reported SNR is a proxy — the Costas sync score, scaled — not a
measurement. Against JS8Call it read a **median 13 dB high**, with a 7–18 dB
spread:

| | slot 10 | 11 | 12 | 24 | 35 |
|---|---|---|---|---|---|
| before | +4 | +2 | +5 | +7 | +4 |
| JS8Call | −3 | −11 | −12 | −11 | −6 |

That matters, because this number goes to PSK Reporter. The offset is now
re-centred (`SNR_ADJ`), which independently improved the synthetic tests: those
slots are generated at exactly −10 dB and now report −7…−14, where before they
read +1…+7.

The **spread** is untouched and is the real weakness — only a proper
per-candidate signal-versus-noise estimate will fix that. The offset is
calibrated on five frames: enough to justify re-centring, not enough to justify
a slope. Re-derive it with `js8_ab_test.mjs` on a busier band before treating
these numbers as accurate.

### Running it

```sh
# 1. record a band (any raw float32 mono at 12 kHz will do)
# 2. JS8Call's decoder over it
./reference/build_reference_decoder.sh recording.f32 <startOffsetSamples> <slots>
# 3. ours, and the diff
node js8_ab_test.mjs recording.f32 <startMs> <slots>
```

It is not part of `run_tests.sh`: it needs a recording and a container build,
so it is a deliberate step, not a regression gate.

## Phase 8: a real SNR measurement

Phase 7 found the reported SNR was a median 13 dB optimistic with a 7–18 dB
spread, and "fixed" it by shifting a constant. That was a patch on a proxy: the
number was the Costas **sync score**, scaled, which is not a measurement of
anything.

It is now measured. Once the CRC passes we know which tone every symbol used,
so signal power is read from exactly those bins, and noise from a median over a
±24-bin window around the candidate with the signal's own tones excluded. Two
corrections, both physical rather than fitted:

- `10·log10(2500/baud)` — the reference bandwidth; 26.0 dB for Normal's 6.25 Hz
  tones, correspondingly less for the faster submodes
- `10·log10(1.5)` = 1.76 dB — the Hann window's equivalent noise bandwidth

### Accuracy against a known truth

`js8_decode_test --snracc` synthesises slots at a known SNR and compares:

| true dB | reported | error |
|---|---|---|
| −6 | −6.5 | −0.5 |
| −10 | −10.5 | −0.5 |
| −14 | −14.4 | −0.4 |
| −18 | −18.3 | −0.3 |
| −20 | −20.0 | +0.0 |

**Worst error 0.5 dB, spread ~0.5 dB** — against 13 dB bias and 18 dB spread
before. That the residual before the ENBW term was flat at +1.4…+1.7 dB, within
0.3 dB of the 1.76 dB the window predicts, is what makes it a correction rather
than a curve fit. It is now a stage of `run_tests.sh`.

### JS8Call is not the reference here

Run against a slot synthesised at exactly −10 dB, **JS8Call reports −17 dB** —
7 dB pessimistic. So the Phase 7 disagreement was never one-sided, and
calibrating to JS8Call would have been calibrating to its bias.

### What is still unresolved

On real air the two still disagree by 5–13 dB, and an independent estimate
computed straight from the spectrum agrees with neither consistently — closer
to ours on one frame, closer to JS8Call's on another. Real-signal SNR is hard:
fading within the slot, adjacent signals, a noise floor that is not flat.

So: **validated against a known truth, unvalidated in absolute terms on air.**
It is a large and defensible improvement over a scaled sync score, and it is
what goes to PSK Reporter, but a claim of on-air accuracy would not be honest.

A note on the diagnosis, because it nearly went wrong: the first attempt read
the noise floor across the whole 200–3000 Hz band, and a spectral check
appeared to show the floor near the signal was 12 dB higher, which would have
explained the whole disagreement. It was an artefact — the "local" window
included the signal itself. With the signal excluded, local and band-wide
floors agree to 0.4 dB. The local window is kept because noise density is not
guaranteed flat, but it was not the explanation it looked like.

## Phase 9: OSD, and a negative result

The sensitivity gap against JS8Call was believed to be ~5 dB at this point (it
is actually 0.5 dB — Phase 11). It comes from two things JS8Call does that we
did not: ordered-statistics decoding when belief propagation fails, and
multi-pass decoding with signal subtraction. This phase went after the first.

`js8_osd.c` is a faithful order-1 port of WSJT-X/JS8Call's `osd174.f90`: trust
the K most reliable bits, Gaussian-eliminate the generator into that basis,
re-encode, then flip each basis bit in turn and keep whichever candidate sits
closest to the received word in soft distance.

**It works, and it is not worth enabling.**

| | decode rate |
|---|---|
| Normal −20 dB, OSD off | 37% |
| Normal −20 dB, OSD on | 41% |
| Fast −18 dB, off / on | 33% / 37% |
| Turbo −16 dB, off / on | 9% / 10% |
| Slow −22 dB, off / on | 46% / 47% |

100 trials per point. One to four percentage points — on the local slope, about
**0.13 dB** — for **62% more decode time** (37 s → 60 s over the sweep). It is
off by default; `JS8_OSD_ENABLED` turns it on.

### Why so little, and what would actually work

Two measurements say the implementation is fine and the *order* is the problem:

- OSD returns a **valid codeword on every attempt** (17/17 in a direct probe),
  so the two permutations — on-air → `[parity|message]` → reliability order —
  are handled correctly.
- Raising the gate from 24 unsatisfied checks to 87 (no gate at all) changes
  **nothing measurable**, so OSD is not being starved of candidates.

Where BP fails, order-1 finds the transmitted codeword about **18%** of the
time, because it explores only 88 of the 2^87 possible messages. Upstream's
gain comes from order 2 — 3741 re-encodings per candidate — which is affordable
only with its partial-syndrome pruning (`nt`/`ntheta` in `osd174.f90`, plus a
hashed pre-screen). That is the work this phase did not do, and the order-1
machinery here is what it would build on.

Recording this as a negative result rather than deleting it: the next attempt
should start from "order 1 is measured at 0.13 dB" rather than re-deriving it.

## Phase 10: multi-pass decoding, and the waveform

A strong station masks weaker ones sharing its slot: the sync search locks onto
the loudest and the others never rise above it. `js8_subtract.c` removes what
has been decoded from a working copy of the audio so the next pass can see
underneath, ported from JS8Call's `subtractjs8.f90`:

```
measured   dd(t)    = a(t)·cos(2πf0·t + θ(t))
reference  cref(t)  = exp(j·(2πf0·t + φ(t)))
amplitude  cfilt(t) = LPF[ dd(t)·conj(cref(t)) ]
subtract   dd(t)   -= 2·Re{ cref(t)·cfilt(t) }
```

The low-pass *measures* the signal's amplitude and phase rather than assuming
them, so fading and small frequency errors end up in `cfilt` instead of being
left behind as residue.

`js8_decode_slot()` now owns the pass loop — decode, subtract, search again, up
to three times, stopping as soon as a pass finds nothing new. It lives in the
decoder rather than the wasm wrapper so the native tests exercise the same code
the browser runs, not a copy of it.

### What it buys

A weak signal 25 Hz from one 10 dB stronger, with the weak one at −12 dB
(comfortably decodable alone, so this measures masking and not sensitivity):

```
  1 pass    strong decoded   weak MISS
  3 passes  strong decoded   weak decoded
```

25 Hz is where it matters. Closer than about 12 Hz the two tone sets sit on top
of each other and the residue still hides the weak one; beyond about 50 Hz
there was no masking to undo in the first place.

### The bug underneath: JS8 is CPFSK, not GFSK

The first version of this subtracted almost nothing — **5.6 dB** even with
perfect timing and frequency, where it should be 20 dB or more. The reference
was CPFSK (as upstream builds it) while the test signal was GFSK, and a CPFSK
reference cannot cancel a GFSK signal:

| transmitted | residual after subtraction |
|---|---|
| CPFSK, perfect timing | **−81.3 dB** |
| CPFSK, 20 ms early | −11.7 dB |
| GFSK BT=2, perfect timing | **−5.6 dB** |

So the subtraction was exact and the *waveform assumption* was wrong.
`Modulator.cpp:168` settles it: JS8Call sets one phase increment per symbol and
accumulates, with no Gaussian shaping. **JS8 transmits CPFSK.** FT8 is GFSK;
JS8 is not, despite sharing its frame structure.

That single wrong assumption, introduced in Phase 6, had cost two things: an
80 ms bias in the reported DT (the STFT correction had been re-fitted from one
symbol to half a symbol to match the wrong waveform), and subtraction that
removed 5.6 dB instead of 81 dB. Both are fixed, and the clean-signal timing is
back to within 20 ms:

```
  Normal   6.250   1000   +0.00   -0.020  decoded
  Slow     3.125   1000   +0.00   -0.020  decoded
```

The lesson worth keeping: "it is like FT8" was right about the frame and wrong
about the modulation, and nothing caught it until a test demanded the waveform
be reproduced exactly rather than merely decoded.

## Phase 11: how far behind JS8Call are we, actually?

Every phase since the first has repeated that this decoder is "~5 dB short of
JS8Call". That number came from comparing measured decode rates against the
thresholds in JS8Call's Fortran params comments — `-25.0dB (1.0Eb/N0)` and
friends. Those are **theoretical Eb/N0 figures, not measured decode thresholds
on the 2500 Hz SNR scale**, so the comparison was never valid. Phase 8 had
already found JS8Call's own SNR *reporting* to be 7 dB pessimistic, which was
the same discrepancy showing up from another direction.

This phase measures it properly: both decoders over **identical audio** at a
known SNR, so neither side's SNR scale is involved. 40 slots per point, each a
different message, Normal submode.

| SNR (2500 Hz) | JS8Call | ours |
|---|---|---|
| −19 dB | 39/40 (98%) | 36/40 (90%) |
| −20 dB | 25/40 (63%) | 12/40 (30%) |
| −21 dB | 6/40 (15%) | 1/40 (2.5%) |

50% crossings: **JS8Call ≈ −20.2 dB, ours ≈ −19.65 dB.**

### The gap is 0.5 dB, not 5

And JS8Call had the advantage in this run. The test signals sit at 1500 Hz,
which is what `nfqso` was set to, so `js8dec.f90` selected `ndeep=4` — **order-2
OSD** — on top of its four-pass subtraction. Ours ran with OSD off entirely and
three passes.

Half a dB is close enough that the remaining difference is not worth chasing
with the effort order-2 OSD would take. It also reframes Phase 9: order-1 OSD
buying 0.13 dB is not a disappointing fraction of 5 dB, it is a quarter of the
0.5 dB that actually exists — still not worth 62% more CPU in a browser, but
the trade-off reads differently.

### Repeating it

```sh
# graded file: 40 slots at each SNR, one message per slot
for s in -19 -20 -21; do
  ./js8_decode_test --dumpsweep $s 40 /tmp/h$s.f32
  cat /tmp/h$s.f32 >> /tmp/graded.f32
done

# JS8Call over it, then ours
./reference/build_reference_decoder.sh /tmp/graded.f32 0 120
for s in -19 -20 -21; do ./js8_decode_test --countslots /tmp/h$s.f32 40; done
```

The lesson is the same one Phase 10 taught: a number repeated often enough
starts to feel measured. This one had been in the README for eleven phases
without anyone having run the experiment that would confirm it.

## Phase 12: measuring subtraction on air — tool built, result outstanding

Phase 10 showed multi-pass subtraction recovering a weak signal 25 Hz from one
10 dB stronger, on synthesised audio we designed ourselves. The honest question
is whether it earns anything on real air, where the overlaps are whatever they
happen to be.

`js8_decode_test --realpasses <file.f32> <offsetSamples> <nslots>` answers it:
it decodes each slot of a recording twice, once with a single pass and once with
three, and lists the frames only the extra passes found.

```
slot  1-pass  3-pass   frames only the extra passes found
  10       1       1
  ...
total: 5 with one pass, 5 with three (0 extra)
```

**That result is not yet meaningful.** Both captures made for this — 20 m at two
different times of day — carried one station at a time, so subtraction had
nothing to reveal and correctly reported zero. A recording where two stations
share a slot within about 25 Hz is what the measurement needs.

Left as an explicit gap rather than dressed up: the tool is written and
validated (it reproduces the synthetic result and returns zero where zero is
right), and the number it exists to produce is still missing. Run it against a
busy band.

## Notes for the phases that follow

- **`genjs8`'s 12-character alphabet is a test harness only.** It has no space
  (`character*68` pads the 67-char literal with one, so a space indexes to 67 and
  will not fit in 6 bits). Real payload bits come from the varicode packer.
- **Only the first 64 characters of `alphabet72` can appear in a real frame.**
  `pack72bits()` masks each group to 6 bits, so `/`, `?` and `.` (indices
  64..66) are unreachable. `unpack72bits()` ORs the index in *without* masking,
  so a frame containing one corrupts the neighbouring field. Do not generate
  such frames in tests; they are not behaviour worth matching.
- **The wasm returns 10 bytes, not text.** `js8_get_payload(i)` gives the 75
  bits MSB-first (72 message + 3 frame type); `js8_get_frame_type(i)` breaks the
  last three out for convenience. Frequency and DT come from
  `js8_get_freq`/`js8_get_dt`; the DT already has the one-symbol STFT lag
  removed, so the auto-sync in `audio.js` should converge on a target of zero.
- **Submode indices here are 0..4 (Normal, Fast, Turbo, Slow, Ultra)**, which is
  *not* JS8Call's NSUBMODE numbering (0/1/2/4/8). `js8_submode_name()`,
  `js8_submode_period()`, `js8_submode_baud()` and `js8_submode_start_delay()`
  are exported so the JS side does not hardcode any of it.
- **Nothing has been seen running in a browser.** Every layer is tested
  headlessly and the assets are served correctly, but the glue in `audio.js`
  and the panel in `App.svelte` have not been exercised by a real client.
- **The standalone `/mobile` page does not have JS8.** It is a separate build
  (`build-mobile.sh`); only the mobile *layout* of the main page was patched.
- **SNR is measured now, but only validated against synthetic truth.** Absolute
  accuracy on real signals is unverified; see Phase 8.
- **Sensitivity is within 0.5 dB of JS8Call** (Phase 11), measured on identical
  audio with JS8Call running order-2 OSD. Closing the rest would take order-2
  OSD here too; it is not obviously worth the CPU.
- **Subtraction is still unmeasured on air.** `--realpasses` is ready (Phase 12);
  it needs a recording with two stations sharing a slot within ~25 Hz. Every
  capture attempted so far has been too quiet.
- **Reporting is off by default**, as for every other mode; it is enabled per
  destination in `autorun.json` via the admin panel.
- **No real on-air signal has been decoded yet.** Everything so far is against
  synthesised audio from our own (reference-validated) encoder. Recording a live
  slot on 14078 kHz and A/B-ing against JS8Call is the Phase 7 job, and it is
  the only thing that will confirm the GFSK-vs-CPFSK and passband choices.

## Licence

`js8_constants.{h,c}` are derived from [JS8Call](https://github.com/js8call/js8call),
GPL-3.0. PhantomSDR-Plus is GPL-3.0, so this is compatible.
