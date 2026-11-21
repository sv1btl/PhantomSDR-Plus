<!--
  The listener's own transceiver's spectrum scope, as a waterfall strip under
  the receiver's waterfall (Direct USB, Icom CI-V 27 00 — lib/rig/drivers.js
  IcomScopeParser). Each sweep is drawn under the SAME frequencies as the
  receiver's waterfall above it, so a signal sits in one vertical line in both:
  the station's antenna above, yours below. Outside the rig's span the strip
  stays dark. The rig's own span, centre/fixed mode and reference level decide
  what arrives; nothing here changes them.

  meterOnly: a rig with an S-meter over CAT but no scope a browser can read
  (the Yaesu new-CAT rigs): a short bar with the S-meter alone.

  Only in this listener's browser: nothing goes to the server.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { waterfall as mainWaterfall } from "./backend.js";
  import getColormap, { computeColormapArray } from "./colormaps.js";

  export let label = "Rig";
  export let refEl = null; // the main waterfall canvas: width and height follow it
  export let onTune = () => {};
  export let meterOnly = false;
  // meterOnly: why there is no waterfall ({ text, link }), shown beside the meter
  export let note = null;

  const HEIGHT_RATIO = 0.7;
  const MIN_H = 96;   // room for the label, the sliders and the rig S-meter
  const DARK = [11, 15, 20, 255];

  let canvas, wrap;
  let width = 0;
  let height = 80;
  let last = null; // the newest sweep, for the label and clicks
  let fallbackMap = null;
  let floorLv = null, peakLv = null;

  // Brightness and Contrast, 0..100 (50 = as it starts), remembered in this
  // browser under the same names Desktop PhantomSDR+ uses.
  const loadPct = (key) => {
    try { const v = localStorage.getItem(key); const n = Number(v); return v !== null && n >= 0 && n <= 100 ? n : 50; } catch (_) { return 50; }
  };
  let brightness = loadPct("rigScopeBrightness");
  let contrast = loadPct("rigScopeContrast5");
  /** 0 -> 4.5 (soft), 50 -> 1.65, 100 -> 0.6 (strong) */
  const stretch = () => 4.5 * Math.pow(0.6 / 4.5, contrast / 100);
  function savePct(key, v) { try { localStorage.setItem(key, String(v)); } catch (_) {} }
  let ro = null;

  function colormap() {
    const m = mainWaterfall && mainWaterfall.colormap;
    if (m && m.length >= 256) return m;
    if (!fallbackMap) fallbackMap = computeColormapArray(getColormap("PhantomSDR"));
    return fallbackMap;
  }

  // Hz at canvas x, by the main waterfall's current view.
  function hzAtX(x, w) {
    const wf = mainWaterfall;
    if (!wf || !wf.waterfallMaxSize) return null;
    const idx = wf.waterfallL + (x / w) * (wf.waterfallR - wf.waterfallL);
    return wf.idxToFreq(idx);
  }

  function resize() {
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
    const refH = refEl ? refEl.clientHeight : 0;
    const h = Math.max(MIN_H, Math.round((refH || 140) * HEIGHT_RATIO));
    if (w !== width || h !== height) {
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = Math.round(h * dpr);
      // the history has room above for the largest slide-in
      hist.width = w;
      hist.height = canvas.height + 24 * Math.max(1, Math.round(dpr));
      for (const c of [canvas, hist]) {
        const ctx = c.getContext("2d");
        ctx.fillStyle = `rgb(${DARK[0]},${DARK[1]},${DARK[2]})`;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      lag = 0;
      paintedY = -1;
    }
  }

  /** One sweep: { lo, hi, levels, max, outOfRange }. */
  export function addLine(line) {
    if (!canvas || !line || !line.levels || !(line.hi > line.lo)) return;
    if (!hist.width) resize();
    if (!hist.width) return;
    last = line;
    const now = performance.now();
    if (lastArrival) {
      const gap = now - lastArrival;
      if (gap > 30 && gap < 2000) interval = interval * 0.8 + gap * 0.2;
    }
    lastArrival = now;
    const ctx = hist.getContext("2d");
    const w = hist.width;
    const rowH = rowPx();
    // Scroll the history down by one sweep's rows, the new sweep on top.
    ctx.drawImage(hist, 0, 0, w, hist.height - rowH, 0, rowH, w, hist.height - rowH);
    const img = ctx.createImageData(w, 1);
    const cmap = colormap();
    const n = line.levels.length;
    const span = line.hi - line.lo;
    // As Desktop PhantomSDR+ colours it: the noise floor (three bins in four
    // at or below it) sits at the bottom of the scale, the strongest signals
    // reach the top; Brightness moves the floor, Contrast stretches the range.
    const sorted = Array.from(line.levels).sort((a, b) => a - b);
    const p75 = sorted[Math.floor(n * 0.75)];
    const p995 = sorted[Math.min(n - 1, Math.floor(n * 0.995))];
    floorLv = floorLv == null ? p75 : floorLv * 0.9 + p75 * 0.1;
    peakLv = peakLv == null ? p995 : peakLv * 0.95 + p995 * 0.05;
    const lo = floorLv - 6 - (brightness - 50) * 1.4;
    const range = Math.max(60, peakLv - lo) * stretch();
    for (let x = 0; x < w; x++) {
      const hz = hzAtX(x + 0.5, w);
      let c = DARK;
      if (hz != null && hz >= line.lo && hz <= line.hi) {
        const i = Math.min(n - 1, Math.max(0, Math.round(((hz - line.lo) / span) * (n - 1))));
        const t = Math.min(1, Math.max(0, (line.levels[i] - lo) / range));
        c = cmap[Math.round(t * 255)] || DARK;
      }
      img.data.set(c, x * 4);
    }
    for (let y = 0; y < rowH; y++) ctx.putImageData(img, 0, y);
    // never more than three sweeps behind the rig
    lag = Math.min(lag + rowH, 3 * rowH);
    paintedY = -1;
    animate();
  }

  // ── Smooth motion, as in Desktop PhantomSDR+ (src/rig/scope/scope.js) ──
  // The rig sends a sweep only every ~250 ms (an IC-7300 at FAST), so each
  // sweep is drawn into an off-screen history and the strip slides it in at
  // ~30 frames a second: `lag` is how many pixels of new rows are still
  // hidden above the top; it drains at one sweep's rows per sweep interval
  // (twice as fast while catching up). Rows per sweep follow the sweep rate:
  // 3 for ~4 sweeps/s (IC-7300 over USB), 1 for ~26/s (IC-705 over WiFi).
  const hist = document.createElement("canvas");
  let lag = 0;
  let interval = 250; // ms between sweeps, measured
  let lastArrival = 0;
  let rafId = 0;
  let lastFrame = 0;
  let paintedY = -1;
  const FRAME_MS = 33;
  const rowPx = () => Math.max(1, Math.min(3, Math.round(interval / 80))) * Math.max(1, Math.round(window.devicePixelRatio || 1));

  function paint(force) {
    if (!canvas || !hist.width) return;
    const y = Math.round(lag);
    if (!force && y === paintedY) return;
    paintedY = y;
    canvas.getContext("2d").drawImage(hist, 0, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  }

  function frame(t) {
    rafId = 0;
    if (lastFrame && t - lastFrame < FRAME_MS - 2) { rafId = requestAnimationFrame(frame); return; }
    const dt = lastFrame ? Math.min(100, t - lastFrame) : 16;
    lastFrame = t;
    const row = rowPx();
    const speed = (row / Math.max(60, interval)) * (lag > 2 * row ? 2 : 1);
    lag = Math.max(0, lag - speed * dt);
    paint(false);
    if (lag > 0) rafId = requestAnimationFrame(frame);
    else lastFrame = 0;
  }

  function animate() {
    paint(true);
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  // ── The rig's own S-meter (Icom CI-V 15 02: 0 = S0, 120 = S9, 241 = S9+60) ──
  // Drawn exactly as Desktop PhantomSDR+ draws it (src/rig/scope/scope.js),
  // which follows PhantomSDR's digital S-meter (SMeterDigital.svelte): 30
  // segments of 6 px with 3 px gaps, cyan up to S9 and red above, dark when
  // unlit; under them a cyan/red scale line with ticks and S1 3 5 7 9 +20
  // +40 +60dB. One S unit = 16.7 px up to S9 (at 150), then 1.67 px per dB.
  const METER_W = 270;
  const METER_H = 36;
  const S9_X = 150.27;
  const METER_FULL = 241;
  let meterCanvas;
  let meterRaw = null;
  let meterX = 0; // smoothed position
  let meterTx = false;

  function rawToX(raw) {
    if (raw <= 120) return (raw / 120) * S9_X;
    return S9_X + Math.min(60, ((raw - 120) / 121) * 60) * 1.6697;
  }

  function drawMeter(x) {
    const c = meterCanvas;
    if (!c) return;
    const d = window.devicePixelRatio || 1;
    if (c.width !== Math.round(METER_W * d)) { c.width = Math.round(METER_W * d); c.height = Math.round(METER_H * d); }
    const ctx = c.getContext("2d");
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, METER_W, METER_H);
    const lit = Math.ceil(x / 9);
    for (let i = 0; i < 30; i++) {
      // up to S9 the blue of the analog S-meter's S1..S9 band (SMeterAnalog.svelte),
      // shading from rgb(0,120,200) to rgb(20,100,160) as it does
      const p = i / 16;
      const blue = `rgb(${Math.floor(20 * p)},${Math.floor(120 - 20 * p)},${Math.floor(200 - 40 * p)})`;
      ctx.fillStyle = i < lit ? (i < 17 ? blue : "#d9191c") : (i < 17 ? "#00182b" : "#330000");
      ctx.fillRect(i * 9, 0, 6, 8);
    }
    const lineY = 15;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(0,120,200)";   // the segments' blue, up to S9
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(S9_X, lineY); ctx.stroke();
    ctx.strokeStyle = "#ed1c24";
    ctx.beginPath(); ctx.moveTo(S9_X, lineY); ctx.lineTo(268, lineY); ctx.stroke();
    ctx.font = "13px monospace";
    const labels = ["S1", "3", "5", "7", "9", "+20", "+40", "+60dB"];
    for (let i = 0; i <= 16; i++) {
      const tx = i * 16.6970588235;
      ctx.fillStyle = tx <= S9_X ? "rgb(0,120,200)" : "#f00";
      ctx.fillRect(tx, lineY, 1, i % 2 === 1 ? 7 : 5);
      if (i % 2 === 1 && (i - 1) / 2 < labels.length) {
        const label = labels[(i - 1) / 2];
        // the last label would run off the canvas: keep it inside
        ctx.textAlign = label === "+60dB" ? "right" : "center";
        ctx.fillStyle = tx <= S9_X ? "#cfe3ff" : "#f00";   // S1..9 in the strip label's colour, the + labels red
        ctx.fillText(label, label === "+60dB" ? METER_W : tx, 33);
      }
    }
  }

  export function setMeter(raw, tx = false) {
    if (!(raw >= 0)) return;
    meterRaw = Math.min(255, raw);
    meterTx = !!tx;
    const x = rawToX(meterRaw);
    // fast up, slower down, as a meter needle
    meterX = x >= meterX ? x : meterX * 0.6 + x * 0.4;
    drawMeter(meterTx ? 0 : meterX);
  }
  // the canvas appears with the first reading: draw it once it exists
  $: if (meterCanvas) drawMeter(meterTx ? 0 : meterX);

  function sText(raw) {
    if (raw == null) return "—";
    if (raw <= 120) return `S${Math.round((raw / 120) * 9)}`;
    return `S9+${Math.round(((raw - 120) / 121) * 60)}`;
  }

  function click(e) {
    if (!last || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const hz = hzAtX(((e.clientX - r.left) / r.width) * canvas.width, canvas.width);
    if (hz != null && hz >= last.lo && hz <= last.hi) onTune(Math.round(hz));
  }

  function fmtSpan(l) {
    if (!l) return "";
    const kHz = (l.hi - l.lo) / 1000;
    return l.mode === 0
      ? `±${(kHz / 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz around ${((l.lo + l.hi) / 2e6).toFixed(3)} MHz`
      : `${(l.lo / 1e6).toFixed(3)}–${(l.hi / 1e6).toFixed(3)} MHz`;
  }

  onMount(() => {
    resize();
    ro = new ResizeObserver(resize);
    ro.observe(wrap);
    if (refEl) ro.observe(refEl);
  });
  onDestroy(() => {
    if (ro) ro.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

{#if meterOnly}
<div class="rig-scope rig-meter-only" bind:this={wrap}>
  <span class="rig-meter-only-label">{label} S-meter</span>
  {#if meterRaw != null}
    <div
      class="rig-meter"
      role="meter"
      aria-label="{label} S-meter"
      aria-valuemin="0"
      aria-valuemax={METER_FULL}
      aria-valuenow={meterRaw}
      aria-valuetext={meterTx ? "transmitting" : sText(meterRaw)}
      title="Your transceiver's own S-meter, as it reports it over CAT (its antenna, not the receiver's)."
    >
      <canvas bind:this={meterCanvas} class="rig-meter-canvas" width="270" height="36" aria-hidden="true"></canvas>
      <b class="rig-meter-text" class:over={!meterTx && meterRaw > 120} class:tx={meterTx}>{meterTx ? "TX" : sText(meterRaw)}</b>
    </div>
  {:else}
    <span class="rig-meter-wait">waiting for the rig…</span>
  {/if}
  {#if note}
    <span class="rig-meter-note" role="note">
      {note.text}
      {#if note.link}<a href="https://phantomsdr.psychomed.gr/desktop.html" target="_blank" rel="noopener">Get Desktop PhantomSDR+</a>{/if}
    </span>
  {/if}
</div>
{:else}
<div class="rig-scope" bind:this={wrap}>
  <canvas
    bind:this={canvas}
    style="width:100%;height:{height}px;display:block;cursor:crosshair"
    on:click={click}
    title="Your transceiver's own scope, under the same frequencies as the waterfall above. Click to tune there."
    aria-label="{label} scope waterfall"
  ></canvas>
  <div class="rig-scope-label">
    {label} scope{last ? ` · ${fmtSpan(last)}` : " · waiting for the rig…"}
    {#if last && last.outOfRange}<span class="oor">out of range</span>{/if}
  </div>
  <div class="rig-ctl">
    <div class="rig-sliders">
      <label title="Waterfall brightness: left darker (weak signals hidden), right brighter (noise shows)">
        <span>Brightness</span>
        <input type="range" min="0" max="100" step="1" bind:value={brightness} on:change={() => savePct("rigScopeBrightness", brightness)} aria-label="Rig waterfall brightness" />
      </label>
      <label title="Waterfall contrast: left softer, right stronger">
        <span>Contrast</span>
        <input type="range" min="0" max="100" step="1" bind:value={contrast} on:change={() => savePct("rigScopeContrast5", contrast)} aria-label="Rig waterfall contrast" />
      </label>
    </div>
    {#if meterRaw != null}
      <div
        class="rig-meter"
        role="meter"
        aria-label="{label} S-meter"
        aria-valuemin="0"
        aria-valuemax={METER_FULL}
        aria-valuenow={meterRaw}
        aria-valuetext={meterTx ? "transmitting" : sText(meterRaw)}
        title="Your transceiver's own S-meter, as it reports it over CAT (its antenna, not the receiver's)."
      >
        <canvas bind:this={meterCanvas} class="rig-meter-canvas" width="270" height="36" aria-hidden="true"></canvas>
        <b class="rig-meter-text" class:over={!meterTx && meterRaw > 120} class:tx={meterTx}>{meterTx ? "TX" : sText(meterRaw)}</b>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .rig-scope {
    position: relative;
    width: 100%;
    margin-top: 2px;
    border-top: 1px solid rgba(120, 160, 200, 0.25);
  }
  .rig-scope-label {
    position: absolute;
    top: 3px;
    left: 6px;
    font-size: 11px;
    line-height: 1.2;
    color: #cfe3ff;
    background: rgba(8, 12, 18, 0.65);
    padding: 1px 6px;
    border-radius: 4px;
    pointer-events: none;
  }
  .rig-ctl {
    position: absolute;
    left: 6px;
    bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 3px 6px 4px;
    background: rgba(8, 12, 18, 0.72);
    border: 1px solid rgba(120, 160, 200, 0.3);
    border-radius: 4px;
  }
  .rig-sliders {
    display: flex;
    gap: 10px;
  }
  .rig-sliders label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #9fb4cc;
  }
  .rig-sliders input {
    width: 70px;
    height: 12px;
    accent-color: #2ad4e6;
  }
  .rig-meter {
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
  }
  /* as in Desktop PhantomSDR+ (src/rig/scope/scope.css), at 80 % so the
     rig's waterfall stays visible behind it */
  .rig-meter-canvas {
    width: 216px;
    height: 29px;
    display: block;
  }
  .rig-meter-text {
    min-width: 43px;
    color: #a3eced;
    font: 600 10.5px/1 monospace;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .rig-meter-text.over {
    color: #f33;
  }
  .rig-meter-text.tx {
    color: #fff;
    background: #d9191c;
    padding: 1px 4px;
    border-radius: 2px;
  }
  .rig-meter-only {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px;
    background: rgb(11, 15, 20);
  }
  .rig-meter-only-label {
    font-size: 11px;
    line-height: 1.2;
    color: #cfe3ff;
  }
  .rig-meter-note {
    margin-left: auto;
    max-width: 52%;
    font-size: 11px;
    line-height: 1.3;
    color: #ffcf70;
    text-align: right;
  }
  .rig-meter-note a {
    color: #7fd6ff;
    text-decoration: underline;
    white-space: nowrap;
  }
  .rig-meter-wait {
    font-size: 11px;
    color: #9fb4cc;
  }
  .oor {
    margin-left: 6px;
    color: #ffb347;
    font-weight: 600;
  }
</style>
