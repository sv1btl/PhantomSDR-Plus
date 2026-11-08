<script>
  // Signal strength plotter: the S-meter's dBm reading as a scrolling strip
  // chart, for fading, QSB and propagation comparisons. The newest point is
  // at the right; the plot spans 10 s (Fast), 30 s (Medium) or 60 s (Slow).
  // Left axis S-units (IARU R1: S9 = -73 dBm, -93 dBm above 30 MHz), right
  // axis dBm; the range follows the signal. A frequency change is marked
  // with a yellow line and the new frequency.
  import { onMount, onDestroy } from "svelte";
  import { sUnitLiftDb } from "./sUnits.js";

  /** () => the dBm figure the digital S-meter shows. */
  export let getDbm = () => -130;
  /** Tuned frequency in Hz (S-unit scale, and the change markers). */
  export let frequencyHz = 0;
  /** "fast" | "medium" | "slow" */
  export let speed = "slow";

  const SPAN_S = { fast: 10, medium: 30, slow: 60 };
  const SAMPLE_MS = 50;                  // 20 readings a second
  const KEEP_S = 60;                     // what Slow shows; Fast/Medium show the newest part
  const HEIGHT = 150;
  const WARMUP_MS = 2000;                // the S-meter settles after a (re)load; skip that
  const AXIS_L = 38, AXIS_R = 62;        // px for the S-unit and dBm labels
  const FONT = 12;                       // px, all text in the plot

  let canvas;
  let samples = [];                      // { t (ms), v (dBm), f (Hz) }
  let paused = false;
  let timer = 0, raf = 0, lastDraw = 0;
  let lo = -120, hi = -60;               // axis range, eased towards the data
  let startedAt = 0;
  let btnW = 60;                         // width of the Pause / PNG buttons (measured)

  const span = () => (SPAN_S[speed] || 60) * 1000;

  function sample() {
    if (paused) return;
    if (Date.now() - startedAt < WARMUP_MS) return;
    const v = Number(getDbm());
    if (!Number.isFinite(v)) return;
    const t = Date.now();
    samples.push({ t, v, f: Number(frequencyHz) || 0 });
    const cut = t - KEEP_S * 1000 - 1000;
    let i = 0;
    while (i < samples.length && samples[i].t < cut) i++;
    if (i) samples.splice(0, i);
  }

  function sLabel(dbm, f) {
    const s9 = -73 - sUnitLiftDb(f);
    if (dbm >= s9 + 1) return `S9+${Math.round(dbm - s9)}`;
    const s = Math.round(9 + (dbm - s9) / 6);
    return s < 0 ? "S0" : `S${s}`;
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!canvas || now - lastDraw < 66) return;        // ~15 frames/s
    lastDraw = now;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    if (!cssW) return;
    const W = Math.round(cssW * dpr), H = Math.round(HEIGHT * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext("2d");
    const aL = AXIS_L * dpr, aR = AXIS_R * dpr, top = 18 * dpr, bot = H - 14 * dpr;
    const pw = W - aL - aR;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const tEnd = paused && samples.length ? samples[samples.length - 1].t : Date.now();
    const tStart = tEnd - span();
    const vis = samples.filter((s) => s.t >= tStart);
    const f = vis.length ? vis[vis.length - 1].f : Number(frequencyHz) || 0;

    // Range: the visible data plus a margin, in whole 10 dB, at least 30 dB;
    // eased so the axis does not jump with every peak.
    if (vis.length) {
      let mn = Infinity, mx = -Infinity;
      for (const s of vis) { if (s.v < mn) mn = s.v; if (s.v > mx) mx = s.v; }
      let wlo = Math.floor((mn - 4) / 10) * 10, whi = Math.ceil((mx + 4) / 10) * 10;
      if (whi - wlo < 30) { const c = (whi + wlo) / 2; wlo = Math.floor((c - 15) / 10) * 10; whi = wlo + 30; }
      lo += (wlo - lo) * 0.25; hi += (whi - hi) * 0.25;
      if (Math.abs(wlo - lo) < 0.3) lo = wlo;
      if (Math.abs(whi - hi) < 0.3) hi = whi;
    }
    const yOf = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
    const xOf = (t) => aL + ((t - tStart) / span()) * pw;

    ctx.font = `${FONT * dpr}px monospace`;
    ctx.textBaseline = "middle";
    // dBm grid, labelled on the right: every 10 dB, or 20 / 30 dB over a wide range
    ctx.textAlign = "left";
    const gstep = hi - lo <= 60 ? 10 : hi - lo <= 120 ? 20 : 30;
    for (let v = Math.ceil(lo / gstep) * gstep; v <= hi; v += gstep) {
      const y = yOf(v);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(aL, Math.round(y), pw, 1);
      ctx.fillStyle = "rgba(200,220,255,0.7)";
      ctx.fillText(`${v} dBm`, aL + pw + 4 * dpr, y);
    }
    // S-unit ticks on the left: S1..S9 every 6 dB, then S9+10, +20 ...
    ctx.textAlign = "right";
    const s9 = -73 - sUnitLiftDb(f);
    const marks = [];
    for (let s = 1; s <= 9; s += 2) marks.push([s9 - 6 * (9 - s), `S${s}`]);
    for (let p = 10; p <= 60; p += 10) marks.push([s9 + p, `+${p}`]);
    let lastY = Infinity;
    for (const [v, lab] of marks) {
      if (v < lo || v > hi) continue;
      const y = yOf(v);
      if (Math.abs(lastY - y) < (FONT + 1) * dpr) continue;      // no labels on top of each other
      lastY = y;
      ctx.fillStyle = v === s9 ? "rgba(255,90,90,0.9)" : "rgba(160,235,235,0.75)";
      ctx.fillRect(aL - 4 * dpr, Math.round(y), 4 * dpr, 1);
      ctx.fillText(lab, aL - 6 * dpr, y);
    }

    // time marks: every 1 s (Fast), 5 s (Medium), 10 s (Slow), labelled in seconds ago
    const step = { fast: 1, medium: 5, slow: 10 }[speed] * 1000;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let k = 0; k * step <= span(); k++) {
      const t = tEnd - k * step;
      const x = xOf(t);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(Math.round(x), top, 1, bot - top);
      if (k > 0 && (speed !== "fast" || k % 2 === 0)) {
        ctx.fillStyle = "rgba(200,220,255,0.55)";
        ctx.fillText(`-${(k * step) / 1000}s`, x, H - 2 * dpr);
      }
    }

    // frequency changes: a yellow line and the new frequency
    ctx.textAlign = "left";
    for (let i = 1; i < vis.length; i++) {
      if (vis[i].f && vis[i - 1].f && Math.abs(vis[i].f - vis[i - 1].f) >= 1) {
        const x = xOf(vis[i].t);
        ctx.fillStyle = "rgba(255,210,60,0.8)";
        ctx.fillRect(Math.round(x), top, 1, bot - top);
        ctx.fillText(`${(vis[i].f / 1000).toFixed(1)}`, x + 3 * dpr, top + FONT * dpr);
      }
    }

    if (!vis.length) return;
    // peak over the visible span
    let peak = vis[0];
    for (const s of vis) if (s.v > peak.v) peak = s;
    ctx.strokeStyle = "rgba(255,120,120,0.55)";
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(aL, yOf(peak.v)); ctx.lineTo(aL + pw, yOf(peak.v)); ctx.stroke();
    ctx.setLineDash([]);

    // the trace
    ctx.save();
    ctx.beginPath(); ctx.rect(aL, top - 2 * dpr, pw, bot - top + 4 * dpr); ctx.clip();
    ctx.strokeStyle = "#5ee6ff";
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    vis.forEach((s, i) => { const x = xOf(s.t), y = yOf(s.v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.restore();

    // readout: now and peak
    const cur = vis[vis.length - 1].v;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#5ee6ff";
    ctx.fillText(`${Math.round(cur)} dBm ${sLabel(cur, f)}`, aL + 4 * dpr, 13 * dpr);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,140,140,0.95)";
    ctx.fillText(`pk ${Math.round(peak.v)} dBm ${sLabel(peak.v, f)}`, W - (btnW + 9) * dpr, 13 * dpr);   // ends left of the buttons
  }

  function savePng() {
    if (!canvas) return;
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}_${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
    const khz = Math.round((Number(frequencyHz) || 0) / 1000);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `PhantomSDR_signal_${stamp}_${khz}kHz.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  onMount(() => {
    startedAt = Date.now();
    timer = setInterval(sample, SAMPLE_MS);
    raf = requestAnimationFrame(draw);
  });
  onDestroy(() => { clearInterval(timer); cancelAnimationFrame(raf); });
</script>

<div class="w-full mt-1 relative">
  <canvas bind:this={canvas} class="w-full rounded" style="height:{HEIGHT}px; display:block;"></canvas>
  <!-- Pause and Save, small, in the plot's top right corner over the dBm
       scale, where the two readouts on the top line do not reach -->
  <div class="absolute flex gap-1" style="right:3px; top:2px;" bind:clientWidth={btnW}>
    <button
      class="text-[10px] leading-none px-1.5 py-0.5 rounded border transition-colors {paused
        ? 'bg-yellow-600 border-yellow-400 text-black'
        : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'}"
      on:click={() => (paused = !paused)}
      title={paused ? "Paused — click to carry on plotting" : "Hold the plot as it is"}>{paused ? "▶" : "❚❚"}</button
    >
    <button
      class="text-[10px] leading-none px-1.5 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-200 hover:bg-green-700 transition-colors"
      on:click={savePng}
      title="Save the plot as a PNG picture">PNG</button
    >
  </div>
</div>
