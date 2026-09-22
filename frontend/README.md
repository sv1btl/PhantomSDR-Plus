# Web Frontend for PhantomSDR-Plus

Svelte + Vite. `src/App.svelte` is the single entry component for the desktop
page — the old per-variant copies were merged into it, so edit it directly.
`src/mobile/Mobile.svelte` is a second Vite entry that produces the audio-only
`/mobile` page.

## Building

Normally you build from the repository root, which rebuilds the backend and/or
the frontend and installs the result where the server serves it from:

```bash
../recompile.sh
```

The individual build scripts in this directory do one version each, and
`build-all.sh` does the lot plus `/mobile`. Each of them swaps `src/main.js` for
the version it is building and restores it afterwards, so do not run two at
once:

```bash
./build-all.sh        # every version, plus /mobile
./build-default.sh    # the default page only
./build-mobile.sh     # /mobile only, leaving the desktop build in place
```

## Developing

```bash
npx vite serve
```

`npm run build` runs a plain `vite build` without the title and favicon fixups
the scripts above apply, so prefer the scripts for anything you intend to
deploy.

## Layout

- `src/App.svelte` — the desktop UI: waterfall wiring, controls, the Decoders
  button row and the decoder windows
- `src/waterfall.js` — spectrum and waterfall rendering, colormaps, auto-adjust
- `src/audio.js` — the audio WebSocket and FLAC/Opus decoding; it also
  distributes raw PCM to the mode decoders
- `src/lib/` — the Svelte components (`ModesSelector`, `BandSelector`,
  `PassbandTuner`, `FrequencyInput`, `FrequencyMarkers`, `Spectrogram`, the
  S-meters, …) plus shared helpers
- Mode decoders follow an engine + `*.worker.js` + `*WorkerProxy.js` triplet, so
  decoding never blocks audio or the waterfall
- `site_information.json` — the sysop's public site details, read at build time

See [../docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md) for the full
tree and [../docs/DECODERS.md](../docs/DECODERS.md) for the decoders.
