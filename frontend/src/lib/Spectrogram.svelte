<script>
  /**
   * Spectrogram — audio analyser for the demodulated signal.
   *
   * Taken from PhantomSDR-ORSAT (github.com/f1nsk40260/PhantomSDR-ORSAT),
   * translated to English:
   *   • canvas at the screen's real resolution (HiDPI), no blur;
   *   • each pixel column takes the maximum of the FFT bins it covers
   *     (no gaps, no aliasing), filled curve + peak-hold line;
   *   • instantaneous spectrum with a dB grid, optional scrolling history;
   *   • linear scale (range follows the mode) or logarithmic;
   *   • recommended-bandwidth markers per mode and the current filter;
   *   • occupied width / splatter overlay, RF view in AM and FM.
   *
   * API for App.svelte: initialize(), feedPCMData(), start(), stop(),
   * setDisplayGain(), setFrequencyRange(), destroy().
   */
  import { onMount, onDestroy, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let minHz = 50;
  export let maxHzLimit = 10000;
  export let fftSize = 4096;
  export let displayGain = 1.0;
  export let colorScheme = "rainbow";
  export let showLabels = true;
  export let height = 300;
  export let enabled = true;
  export let frequencyCalibration = 1.0;
  /** Current demodulation mode (USB, LSB, CW, AM, FM…). */
  export let mode = "USB";
  /** Audio pitch (Hz) of a CW signal on the dial. */
  export let cwPitch = 600;
  /** Current filter as audio frequencies [low, high] (Hz), or null. */
  export let passband = null;
  /** "lin" (range follows the mode) or "log". */
  export let scale = "lin";
  /** Show the bandwidth markers. */
  export let showMarkers = true;
  /** RF measurement of the occupied width { status, text, alo, ahi, normHi }. */
  export let occupied = null;
  /** Scrolling history under the spectrum (off by default). */
  export let showHistory = false;
  /** Receiver dial frequency (kHz), shown in the header. */
  export let baseKhz = null;
  /** Long-term voice spectrum { step, db[] } and the stored curve A. */
  export let ltas = null;
  export let ltasRef = null;
  /** (centreHz, halfSpanHz) => RF slice of the waterfall (AM/FM RF view). */
  export let rfSlice = null;
  /** Modes offered by the mode badge's menu (the main page's list). */
  export let modes = [];
  /** Receiver mute state (shown in the header). */
  export let muted = false;

  // Automatic RF view in AM / FM: the demodulated audio has no carrier any
  // more (it lands on 0 Hz), so the station is shown as it is in RF, carrier
  // in the centre and the sidebands either side.
  $: rfMode = symmetric && typeof rfSlice === "function";
  $: rfHalf = modeU === "WBFM" ? 120000 : modeU === "FM" ? 8000 : 6000;
  let rfAvg = null, rfPeak = null, rfTop = null;

  /** Audio sample for the SSB report (spectrum + waveform). */
  export function sampleAudio() {
    if (!analyser || !isRunning || !audioContext) return null;
    const f = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(f);
    const t = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(t);
    return { f, t, binHz: (audioContext.sampleRate / analyser.fftSize) * frequencyCalibration, sr: audioContext.sampleRate };
  }

  // Dial frequency and the audio → RF mapping.
  $: base = Number(baseKhz);
  $: hasBase = Number.isFinite(base) && base > 0;
  $: modeU = String(mode || "").toUpperCase();
  $: isCw = modeU.startsWith("CW");
  $: symmetric = ["AM", "QUAM", "FM", "WBFM", "SAM"].includes(modeU);
  /** Audio frequency (Hz) of the dial frequency: 0 Hz, or the CW note. */
  $: baseAudio = isCw ? cwPitch : 0;
  export function fmtKhz(k) {
    return Number(k).toFixed(3);
  }
  function rfOf(a) {
    if (!hasBase) return null;
    if (symmetric) return null;
    const off = a - baseAudio;
    return base + (mirrored ? -off : off) / 1000;
  }

  // Read-out under the mouse pointer.
  let geo = null, hoverX = null, hover = null;
  function onMove(e) {
    if (!geo) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr;
    if (x < geo.left || x > geo.left + geo.pw) { onLeave(); return; }
    hoverX = x;
    if (geo.rf) {
      const off = ((x - geo.left) / geo.pw) * 2 * geo.rf - geo.rf;
      hover = {
        px: e.clientX - r.left, flip: e.clientX - r.left > r.width - 170,
        rf: hasBase ? fmtKhz(base + off / 1000) + " kHz" : "",
        audio: (off >= 0 ? "+" : "−") + Math.abs(Math.round(off)) + " Hz from carrier",
      };
      return;
    }
    const a = fOf(x, geo.lo, geo.hi, geo.left, geo.pw);
    const rf = rfOf(a);
    hover = {
      px: e.clientX - r.left,
      flip: e.clientX - r.left > r.width - 170,
      audio: Math.round(a) + " Hz audio",
      rf: rf != null ? fmtKhz(rf) + " kHz"
        : hasBase && symmetric ? `${fmtKhz(base)} ± ${(a / 1000).toFixed(3)} kHz` : "",
    };
  }
  function onLeave() { hoverX = null; hover = null; }

  let canvas, ctx, wrap;
  let audioContext, analyser, gainNode;
  let fdata = null;           // dB per FFT bin
  let peak = null;            // peak-hold line per column
  // Noise floor per column (dB), for colouring by the level above the noise:
  // in speech pauses the receiver's AGC lifts the noise inside the filter to
  // almost the voice level, and colours tied to the absolute level then paint
  // the whole filter window alike. Reset when the station or the mode changes.
  let nfCols = null, nfWarm = 0;
  const NF_SPAN_DB = 36;      // dB above the noise that the colour scale spans
  $: { base; modeU; nfCols = null; nfWarm = 0; }
  let animationId, isRunning = false, playTime = 0;
  let dpr = 1, W = 0, H = 0;
  let wfImg = null;           // scrolling spectrogram (ImageData)
  let lut = null, lutScheme = "";

  const DB_MIN = -110, DB_MAX = -20;

  onMount(() => {
    ctx = canvas.getContext("2d", { alpha: false });
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(wrap);
    return () => ro.disconnect();
  });
  onDestroy(() => { stop(); destroy(); });

  $: if (canvas && height) resizeCanvas();

  function resizeCanvas() {
    if (!canvas || !wrap) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w; canvas.height = h; W = w; H = h;
      canvas.style.height = height + "px";
      wfImg = null;
      peak = null;
    }
  }

  export async function initialize(sampleRate = 12000) {
    if (audioContext) return audioContext;
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate, latencyHint: "interactive" });
    if (audioContext.state === "suspended") await audioContext.resume();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.minDecibels = -120;
    analyser.maxDecibels = 0;
    analyser.smoothingTimeConstant = 0.55;
    gainNode = audioContext.createGain();
    gainNode.gain.value = displayGain;
    gainNode.connect(analyser);
    fdata = new Float32Array(analyser.frequencyBinCount);
    playTime = audioContext.currentTime;
    dispatch("initialized");
    return audioContext;
  }

  // The last 30 s of raw audio, kept for the listening report.
  const REC_S = 30;
  let rec = null, recPos = 0, recFill = 0;
  function remember(pcm) {
    const sr = audioContext.sampleRate;
    if (!rec || rec.length !== REC_S * sr) { rec = new Float32Array(REC_S * sr); recPos = 0; recFill = 0; }
    for (let i = 0; i < pcm.length; i++) { rec[recPos] = pcm[i]; recPos = (recPos + 1) % rec.length; }
    recFill = Math.min(rec.length, recFill + pcm.length);
  }
  /** The last `sec` seconds of raw audio: { pcm, sr } or null. */
  export function getRecentAudio(sec = 20) {
    if (!rec || !recFill || !audioContext) return null;
    const n = Math.min(recFill, Math.round(sec * audioContext.sampleRate));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = rec[(recPos - n + i + rec.length) % rec.length];
    return { pcm: out, sr: audioContext.sampleRate };
  }
  // Dial frequency tuned like the main dial: hover a digit and scroll, or
  // left-click it to step up and right-click to step down; a click beside
  // the digits opens the page's number pad. App does the tuning ("tune" with
  // a step in Hz, "keypad").
  let dialHover = -1;
  $: dialChars = (() => {
    if (!hasBase) return [];
    const str = fmtKhz(base), dot = str.indexOf(".");
    return str.split("").map((ch, i) => {
      if (ch === ".") return { sep: true };
      const pos = dot < 0 ? str.length - 1 - i : i < dot ? dot - 1 - i : dot - i;
      return { ch, hz: Math.round(Math.pow(10, pos) * 1000) };   // kHz digit → step in Hz
    });
  })();
  function stepDial(e, hz, d) {
    e.preventDefault(); e.stopPropagation();
    dispatch("tune", d * hz);
  }
  function dialWheel(node) {
    const onWheel = (e) => {
      if (dialHover < 0 || !dialChars[dialHover] || dialChars[dialHover].sep) return;
      e.preventDefault();
      dispatch("tune", (e.deltaY > 0 ? -1 : 1) * dialChars[dialHover].hz);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return { destroy() { node.removeEventListener("wheel", onWheel); } };
  }

  // Mode badge: a click opens a menu of the page's modes; picking one is
  // handed to App ("mode"), which sets it as the main mode buttons do.
  let modeMenu = false, modeWrap;
  function pickMode(m) { modeMenu = false; dispatch("mode", m); }
  function onDocDown(e) { if (modeMenu && modeWrap && !modeWrap.contains(e.target)) modeMenu = false; }
  onMount(() => { document.addEventListener("mousedown", onDocDown); });
  onDestroy(() => { document.removeEventListener("mousedown", onDocDown); });

  /** PNG image of the spectrum on screen. */
  export function getSnapshot() {
    try { return canvas ? canvas.toDataURL("image/png") : null; } catch (e) { return null; }
  }

  export function feedPCMData(pcmArray) {
    if (!audioContext || !gainNode || !isRunning || !enabled) return;
    try { remember(pcmArray); } catch (e) {}
    try {
      const buf = audioContext.createBuffer(1, pcmArray.length, audioContext.sampleRate);
      buf.copyToChannel(pcmArray, 0, 0);
      const src = audioContext.createBufferSource();
      src.buffer = buf;
      src.connect(gainNode);
      const now = audioContext.currentTime;
      if (playTime < now) playTime = now;
      src.start(playTime);
      playTime += buf.duration;
      src.onended = () => src.disconnect();
    } catch (e) {
      console.error("Error feeding PCM data:", e);
    }
  }

  export function start() {
    if (isRunning || !audioContext) return;
    isRunning = true;
    playTime = audioContext.currentTime;
    setTimeout(resizeCanvas, 10);
    draw();
  }

  export function stop() {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
  }

  export function setDisplayGain(g) {
    displayGain = g;
    if (gainNode) gainNode.gain.value = g;
  }

  export function setFrequencyRange(min, max) {
    minHz = Math.max(min, 20);
    maxHzLimit = max;
  }

  // ── Palette (256-colour table, built once per scheme) ──
  function buildLut() {
    lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      let r, g, b;
      if (colorScheme === "blue") { [r, g, b] = hsl(210, 1, 0.04 + v * 0.7); }
      else if (colorScheme === "green") { [r, g, b] = hsl(120, 1, 0.04 + v * 0.6); }
      else if (colorScheme === "white") { r = g = b = Math.round(v * 255); }
      else {
        // Rainbow in six distinct steps, no green: dark blue (noise), blue,
        // cyan, yellow, orange, red. Each colour holds over a band of levels
        // and the change to the next is short; cyan → yellow is the shortest,
        // so the greenish shade between them never shows as a band. Every
        // colour is held to about 80 % intensity.
        const t = v;
        const st = [[0, 2, 2, 24], [0.18, 6, 10, 90], [0.3, 6, 10, 90],     // dark blue
                    [0.36, 0, 80, 200], [0.46, 0, 80, 200],                // blue
                    [0.52, 0, 170, 190], [0.61, 0, 170, 190],              // cyan
                    [0.63, 240, 225, 0], [0.77, 240, 225, 0],              // yellow
                    [0.8, 204, 112, 0], [0.83, 204, 112, 0],               // orange (short)
                    [0.86, 204, 24, 16], [1, 204, 24, 16]];                // red
        for (let k = 0; k < st.length - 1; k++) {
          const [t0, r0, g0, b0] = st[k], [t1, r1, g1, b1] = st[k + 1];
          if (t <= t1) { const f = (t - t0) / (t1 - t0); r = r0 + f * (r1 - r0); g = g0 + f * (g1 - g0); b = b0 + f * (b1 - b0); break; }
        }
      }
      lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
    }
    lutScheme = colorScheme;
  }
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }

  // ── Frequency scale ──
  function range() {
    const nyq = audioContext ? audioContext.sampleRate / 2 : 6000;
    if (scale === "log") return [Math.max(minHz, 40), Math.min(maxHzLimit, nyq)];
    const m = String(mode || "").toUpperCase();
    let top = m.startsWith("CW") ? 2000 : m === "AM" || m === "QUAM" || m === "FM" || m === "WBFM" ? 5500 : 4500;
    return [0, Math.min(top, nyq)];
  }
  // LSB: the axis is reversed (highs on the left) to follow the RF spectrum.
  $: mirrored = ["LSB", "RADEL", "CW-L"].includes(String(mode || "").toUpperCase());
  function xOf(f, lo, hi, x0, w) {
    let a = scale === "log" ? Math.log(Math.max(f, lo) / lo) / Math.log(hi / lo) : (f - lo) / (hi - lo);
    if (mirrored) a = 1 - a;
    return x0 + a * w;
  }
  function fOf(x, lo, hi, x0, w) {
    let a = (x - x0) / w;
    if (mirrored) a = 1 - a;
    return scale === "log" ? lo * Math.pow(hi / lo, a) : lo + a * (hi - lo);
  }

  // ── Recommended-bandwidth markers per mode ──
  function markersFor(m) {
    m = String(m || "").toUpperCase();
    if (m === "USB" || m === "LSB" || m.startsWith("RADE")) return [
      { lo: 300, hi: 2700, label: "SSB standard 300–2700 Hz", color: "34,211,238" },
      { lo: 50, hi: 4000, label: "ESSB 50–4000 Hz", color: "56,189,248", dash: true },
    ];
    if (m.startsWith("CW")) return [
      { lo: 500, hi: 1000, label: "CW 500 Hz", color: "34,211,238" },
      { lo: 625, hi: 875, label: "CW 250 Hz", color: "56,189,248", dash: true },
    ];
    if (m === "AM" || m === "QUAM") return [
      { lo: 50, hi: 4500, label: "AM broadcast ≤ 4.5 kHz", color: "34,211,238" },
      { lo: 100, hi: 3000, label: "AM amateur ≤ 3 kHz", color: "56,189,248", dash: true },
    ];
    if (m === "FM") return [{ lo: 300, hi: 3000, label: "FM voice 300–3000 Hz", color: "34,211,238" }];
    return [];
  }

  // Spectrum bars as a lit relief: light from the upper right, as on the
  // site's metal panels. Slopes facing the light are brighter, the others
  // darker; a soft shadow falls to the lower left, the bars darken close to
  // their base and a glossy line runs along the top. vals are 0..1.
  function drawRelief(vals, left, top, pw, specH, colVals = null) {
    const s = dpr, base = top + specH;
    const yOf = (x) => base - vals[x] * specH;
    const curve = (dx, dy) => {
      ctx.beginPath(); ctx.moveTo(left + dx, base);
      for (let x = 0; x < pw; x++) ctx.lineTo(left + x + dx, Math.min(base, yOf(x) + dy));
      ctx.lineTo(left + pw - 1 + dx, base); ctx.closePath();
    };
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, pw, specH); ctx.clip();
    // Shadow, two offsets for a soft edge
    ctx.fillStyle = "rgba(0,0,0,0.18)"; curve(-4 * s, 4 * s); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)"; curve(-2 * s, 2 * s); ctx.fill();
    // Bars, shaded by the slope of the curve. The slope is taken on a
    // smoothed curve (±4 px): from pixel to pixel a noisy spectrum would
    // shade as stripes.
    const r = Math.max(2, Math.round(4 * s)), sm = new Float32Array(pw), cum = new Float64Array(pw + 1);
    for (let x = 0; x < pw; x++) cum[x + 1] = cum[x] + vals[x];
    for (let x = 0; x < pw; x++) {
      const a = Math.max(0, x - r), b = Math.min(pw, x + r + 1);
      sm[x] = (cum[b] - cum[a]) / (b - a);
    }
    for (let x = 0; x < pw; x++) {
      const v = vals[x], h = v * specH;
      if (h <= 0) continue;
      const dh = (sm[Math.min(pw - 1, x + r)] - sm[Math.max(0, x - r)]) * specH / (2 * r);
      const f = 1 + 0.45 * (Math.atan(-2 * dh) / (Math.PI / 2));   // falling to the right = facing the light
      const k = Math.min(255, Math.round((colVals ? colVals[x] : v) * 255)) * 3;
      // Shaded slopes darken (× f); lit slopes also mix towards white, so the
      // light still shows on the dark blue of the noise-coloured bars, where
      // a multiplication alone changes almost nothing.
      const w = f > 1 ? (f - 1) * 0.5 : 0, sh = (c) => Math.min(255, c * Math.min(f, 1) + (255 - c) * w) | 0;
      ctx.fillStyle = `rgb(${sh(lut[k])},${sh(lut[k + 1])},${sh(lut[k + 2])})`;
      ctx.fillRect(left + x, base - h, 1, h);
    }
    // Depth: a touch of light high up, darker only close to the base, so
    // low bars keep their colour
    curve(0, 0); ctx.clip();
    const g = ctx.createLinearGradient(0, top, 0, base);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(0.85, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g; ctx.fillRect(left, top, pw, specH);
    ctx.restore();
    // Gloss along the top edge
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (let x = 0; x < pw; x++) { const y = yOf(x) + 0.5 * s; x ? ctx.lineTo(left + x, y) : ctx.moveTo(left + x, y); }
    ctx.stroke();
  }

  function draw() {
    if (!isRunning || !enabled) return;
    animationId = requestAnimationFrame(draw);
    if (!W || !H || !analyser) return;
    if (lutScheme !== colorScheme || !lut) buildLut();
    if (rfMode) { drawRf(); return; }

    const s = dpr;
    const left = showLabels ? Math.round(38 * s) : Math.round(4 * s);
    const top = showLabels ? Math.round(18 * s) : Math.round(4 * s);
    const pw = W - left - Math.round(4 * s);
    const specH = showHistory ? Math.round((H - top) * 0.45) : H - top - Math.round(2 * s);
    const wfTop = top + specH + Math.round(2 * s);
    const wfH = H - wfTop;
    const [lo, hi] = range();
    geo = { left, pw, lo, hi };

    analyser.getFloatFrequencyData(fdata);
    const binHz = (audioContext.sampleRate / analyser.fftSize) * frequencyCalibration;

    // 0..1 value per column (maximum of the bins it covers)
    const cols = new Float32Array(pw), raw = new Float32Array(pw);
    for (let x = 0; x < pw; x++) {
      const fa = fOf(left + x, lo, hi, left, pw), fb = fOf(left + x + 1, lo, hi, left, pw);
      const f0 = Math.min(fa, fb), f1 = Math.max(fa, fb);
      let i0 = Math.floor(f0 / binHz), i1 = Math.max(i0, Math.floor(f1 / binHz));
      i0 = Math.max(0, i0); i1 = Math.min(fdata.length - 1, i1);
      let m = -Infinity;
      for (let i = i0; i <= i1; i++) if (fdata[i] > m) m = fdata[i];
      raw[x] = m;
      cols[x] = Math.max(0, Math.min(1, (m - DB_MIN) / (DB_MAX - DB_MIN)));
    }
    // Colour = level above the noise floor of that column. The floor falls
    // quickly to the quiet moments and rises slowly (~1 dB/s at 60 frames/s),
    // so a pause does not lift it. For the first 2 s of sound it follows the
    // level quickly both ways: starting from silence it would otherwise take
    // half a minute to climb and everything would read far above the noise.
    if (!nfCols || nfCols.length !== pw) { nfCols = Float32Array.from(raw, (d) => (Number.isFinite(d) ? d : DB_MIN)); nfWarm = 0; }
    const ccols = new Float32Array(pw);
    let heard = false;
    for (let x = 0; x < pw; x++) {
      const d = raw[x];
      if (!Number.isFinite(d) || d <= DB_MIN) continue;
      heard = true;
      if (nfWarm < 120) nfCols[x] += 0.15 * (d - nfCols[x]);
      else if (d < nfCols[x]) nfCols[x] += 0.25 * (d - nfCols[x]);
      else nfCols[x] += Math.min(0.0167, d - nfCols[x]);
      ccols[x] = Math.max(0, Math.min(1, (d - nfCols[x]) / NF_SPAN_DB));
    }
    if (heard && nfWarm < 120) nfWarm++;
    if (!peak || peak.length !== pw) peak = new Float32Array(pw);
    for (let x = 0; x < pw; x++) peak[x] = Math.max(cols[x], peak[x] - 0.004);

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // ── Spectrum: dB grid ──
    ctx.font = `${Math.round(11.5 * s)}px monospace`;
    ctx.textBaseline = "middle";
    for (let db = -100; db <= -40; db += 20) {
      const y = top + specH - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * specH;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + pw, y); ctx.stroke();
      if (showLabels && db > DB_MIN && db < DB_MAX) { ctx.fillStyle = "#aaa"; ctx.textAlign = "right"; ctx.fillText(db + "", left - 4 * s, y); }
    }

    // ── Spectrum: lit colour relief + peak hold ──
    drawRelief(cols, left, top, pw, specH, ccols);
    ctx.strokeStyle = "rgba(243,231,166,0.85)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (let x = 0; x < pw; x++) {
      const y = top + specH - peak[x] * specH;
      x ? ctx.lineTo(left + x, y) : ctx.moveTo(left + x, y);
    }
    ctx.stroke();

    // ── Scrolling spectrogram (optional) ──
    if (!showHistory) { wfImg = null; }
    else {
    if (!wfImg || wfImg.width !== pw || wfImg.height !== wfH) {
      wfImg = ctx.createImageData(pw, Math.max(1, wfH));
      for (let i = 3; i < wfImg.data.length; i += 4) wfImg.data[i] = 255;
    }
    const d = wfImg.data, row = pw * 4;
    d.copyWithin(row, 0, d.length - row);           // everything moves down one row
    for (let x = 0; x < pw; x++) {
      const k = Math.min(255, Math.round(ccols[x] * 255)) * 3, o = x * 4;
      d[o] = lut[k]; d[o + 1] = lut[k + 1]; d[o + 2] = lut[k + 2]; d[o + 3] = 255;
    }
    ctx.putImageData(wfImg, left, wfTop);
    }

    // ── Bandwidth markers and current filter ──
    const yTop = top, yBot = showHistory ? H : top + specH;
    if (showMarkers) {
      let ly = top + Math.round(3 * s);
      for (const mk of markersFor(mode)) {
        const xa = xOf(mk.lo, lo, hi, left, pw), xb = xOf(mk.hi, lo, hi, left, pw);
        const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        if (x1 < left || x0 > left + pw) continue;
        const a = Math.max(left, x0), b = Math.min(left + pw, x1);
        ctx.fillStyle = `rgba(${mk.color},0.07)`;
        ctx.fillRect(a, yTop, b - a, specH);
        ctx.strokeStyle = `rgba(${mk.color},0.9)`;
        ctx.lineWidth = 1.2 * s;
        ctx.setLineDash(mk.dash ? [5 * s, 4 * s] : []);
        for (const xx of [x0, x1]) {
          if (xx < left || xx > left + pw) continue;
          ctx.beginPath(); ctx.moveTo(xx, yTop); ctx.lineTo(xx, yBot); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.font = `bold ${Math.round(11.5 * s)}px sans-serif`;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        const tw = ctx.measureText(mk.label).width + 6 * s;
        const tx = Math.min(Math.max(a + 3 * s, left), left + pw - tw);
        ctx.fillStyle = "rgba(34,34,34,0.85)";
        ctx.fillRect(tx - 2 * s, ly - 1 * s, tw, 15.5 * s);
        ctx.fillStyle = `rgb(${mk.color})`;
        ctx.fillText(mk.label, tx, ly);
        ly += Math.round(17 * s);
      }
    }
    if (passband && passband.length === 2 && passband[1] > passband[0]) {
      const xa = xOf(passband[0], lo, hi, left, pw), xb = xOf(passband[1], lo, hi, left, pw);
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1 * s;
      ctx.setLineDash([2 * s, 3 * s]);
      ctx.strokeRect(Math.max(left, x0), top + 1, Math.min(left + pw, x1) - Math.max(left, x0), specH - 2);
      ctx.setLineDash([]);
      ctx.font = `${Math.round(11 * s)}px sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`Current filter ${Math.round(passband[0])}–${Math.round(passband[1])} Hz`,
        Math.min(left + pw - 2 * s, Math.max(left + 140 * s, x1 - 2 * s)), top + specH - 2 * s);
    }

    // ── Measured occupied width: overflow in red (amber when only "wide") ──
    if (occupied && (occupied.status === "wide" || occupied.status === "splatter") && Number.isFinite(occupied.ahi)) {
      const col = occupied.status === "splatter" ? "255,60,60" : "245,158,11";
      const segs = [];
      if (occupied.normHi != null) segs.push([occupied.normHi, occupied.ahi]);
      else segs.push([occupied.alo, occupied.ahi]);
      for (const [f0, f1] of segs) {
        const xa = xOf(f0, lo, hi, left, pw), xb = xOf(f1, lo, hi, left, pw);
        const x0 = Math.max(left, Math.min(xa, xb)), x1 = Math.min(left + pw, Math.max(xa, xb));
        if (x1 <= x0) continue;
        ctx.fillStyle = `rgba(${col},0.18)`;
        ctx.fillRect(x0, top, x1 - x0, specH);
        ctx.fillStyle = `rgba(${col},0.95)`;
        ctx.fillRect(x0, top + specH - 3 * s, x1 - x0, 3 * s);
      }
    }

    // ── Long-term voice spectrum (SSB report) and stored curve A ──
    const curve = (c, style, dash) => {
      if (!c || !c.db) return;
      ctx.strokeStyle = style; ctx.lineWidth = 1.6 * s; ctx.setLineDash(dash);
      ctx.beginPath();
      let on = false;
      for (let i = 0; i < c.db.length; i++) {
        const f = (i + 0.5) * c.step, v = c.db[i];
        if (f < lo || f > hi || !Number.isFinite(v)) { on = false; continue; }
        const x = xOf(f, lo, hi, left, pw);
        const y = top + specH - Math.max(0, Math.min(1, (v - DB_MIN) / (DB_MAX - DB_MIN))) * specH;
        on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(ltasRef, "rgba(255,255,255,0.8)", [4 * s, 3 * s]);
    curve(ltas, "rgba(56,189,248,0.95)", []);
    if (ltas || ltasRef) {
      ctx.font = `bold ${Math.round(11 * s)}px sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "top";
      let ly = top + Math.round(3 * s);
      if (ltas) { ctx.fillStyle = "rgb(56,189,248)"; ctx.fillText("— average voice", left + pw - 4 * s, ly); ly += 14 * s; }
      if (ltasRef) { ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText("- - curve A", left + pw - 4 * s, ly); }
    }

    // ── Dial frequency: cyan line at its audio position ──
    if (hasBase && baseAudio >= lo && baseAudio <= hi) {
      const xb = Math.min(left + pw - s, Math.max(left + s, xOf(baseAudio, lo, hi, left, pw)));
      ctx.strokeStyle = "rgba(34,211,238,0.95)";
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(xb, top); ctx.lineTo(xb, yBot); ctx.stroke();
      const tag = (isCw ? "CW " : symmetric ? "Carrier " : "Dial ") + fmtKhz(base);
      ctx.font = `bold ${Math.round(12 * s)}px monospace`;
      ctx.textBaseline = "bottom";
      const tw = ctx.measureText(tag).width + 8 * s;
      const right = xb > left + pw / 2;
      const tx = right ? xb - tw - 2 * s : xb + 3 * s;
      const ty = top + Math.round(specH * 0.55);
      ctx.fillStyle = "rgba(34,34,34,0.85)";
      ctx.fillRect(tx, ty - 15.5 * s, tw, 15.5 * s);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(tag, tx + 4 * s, ty - 1 * s);
    }
    if (hoverX != null) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hoverX, top); ctx.lineTo(hoverX, yBot); ctx.stroke();
    }

    // ── Frequency ticks ──
    if (showLabels) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, top);
      ctx.font = `${Math.round(12 * s)}px monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const ticks = [];
      if (scale === "log") {
        for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
          for (const m of [1, 2, 5]) { const f = m * 10 ** e; if (f >= lo && f <= hi) ticks.push(f); }
      } else {
        const step = hi - lo > 3000 ? 500 : 250;
        for (let f = Math.ceil(lo / step) * step; f <= hi; f += step) ticks.push(f);
      }
      for (const f of ticks) {
        const x = xOf(f, lo, hi, left, pw);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + specH); ctx.stroke();
        ctx.fillStyle = "#aaa";
        ctx.fillText(f >= 1000 ? +(f / 1000).toFixed(2) + "k" : f + "", x, 3 * s);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = "#aaa";
      ctx.fillText("dB", 4 * s, 3 * s);
      if (mirrored) {
        ctx.font = `bold ${Math.round(11 * s)}px sans-serif`;
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#aaa";
        ctx.fillText("◂ LSB: reversed axis", left + 4 * s, top + specH - 2 * s);
      }
    }
  }

  // ── RF view (AM / FM) ──
  function drawRf() {
    const s = dpr;
    const left = Math.round(38 * s), top = Math.round(18 * s);
    const pw = W - left - Math.round(4 * s), specH = H - top - Math.round(2 * s);
    const half = rfHalf;
    geo = { left, pw, rf: half };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const msg = (t) => {
      ctx.fillStyle = "#9ca3af"; ctx.font = `italic ${Math.round(13 * s)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t, left + pw / 2, top + specH / 2);
    };
    if (!hasBase) { msg("Frequency unknown"); return; }
    const sl = rfSlice(base * 1000, half);
    if (!sl || !(sl.hzPerBin > 0)) { msg("No waterfall data"); return; }
    // At least ~50 points across the span (≤ 240 Hz per point in AM) are
    // needed to tell the carrier from the sidebands. No slice at all (v null)
    // means the whole span fits in under 3 bins: zoomed out, not missing data.
    if (!sl.v || sl.hzPerBin > (2 * half) / 50) {
      msg(`Zoom the waterfall in on the station for the RF view (${Math.round(sl.hzPerBin)} Hz per point, needs ≤ ${Math.round((2 * half) / 50)})`);
      rfAvg = null; return;
    }
    const xOff = (off) => left + ((off + half) / (2 * half)) * pw;

    // Value (waterfall dB) per column: maximum of the bins it covers
    const cols = new Float32Array(pw);
    let mx = -Infinity;
    const hzPx = (2 * half) / pw, last = sl.v.length - 1;
    for (let x = 0; x < pw; x++) {
      const f0 = base * 1000 - half + x * hzPx;
      let m;
      if (sl.hzPerBin < hzPx) {
        // Several bins per pixel: keep the strongest.
        let i0 = Math.max(0, Math.floor((f0 - sl.lo) / sl.hzPerBin)), i1 = Math.min(last, Math.floor((f0 + hzPx - sl.lo) / sl.hzPerBin));
        m = -Infinity;
        for (let i = i0; i <= Math.max(i0, i1); i++) if (sl.v[i] > m) m = sl.v[i];
      } else {
        // Bins wider than a pixel: linear interpolation, a smooth curve instead of steps.
        const p = Math.max(0, Math.min(last, (f0 + hzPx / 2 - sl.lo) / sl.hzPerBin));
        const i = Math.min(last - 1, Math.floor(p)), t = p - i;
        m = sl.v[i] * (1 - t) + sl.v[i + 1] * t;
      }
      cols[x] = m; if (m > mx) mx = m;
    }
    if (!rfAvg || rfAvg.length !== pw) { rfAvg = Float32Array.from(cols); rfPeak = Float32Array.from(cols); }
    for (let x = 0; x < pw; x++) {
      rfAvg[x] = 0.55 * rfAvg[x] + 0.45 * cols[x];
      rfPeak[x] = Math.max(rfAvg[x], rfPeak[x] - 0.25);
    }
    // Waterfall values are 0.5 dB per unit (the server stores 20·log10 of
    // the bin power): 20 units = 10 dB. At least 30 dB of range is shown.
    const floor = Number.isFinite(sl.noise) ? sl.noise - 6 : Math.min(...rfAvg);
    const nz = floor + 6;
    rfTop = rfTop == null ? Math.max(floor + 60, mx + 4) : Math.max(floor + 60, rfTop + 0.08 * ((mx + 4) - rfTop));
    const yOf = (v) => top + specH - Math.max(0, Math.min(1, (v - floor) / (rfTop - floor))) * specH;

    // Grid: dB above the noise, every 10 dB
    ctx.font = `${Math.round(11.5 * s)}px monospace`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    for (let d = 10; nz + 2 * d < rfTop; d += 10) {
      const y = yOf(nz + 2 * d);
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + pw, y); ctx.stroke();
      ctx.fillStyle = "#aaa"; ctx.fillText("+" + d, left - 4 * s, y);
    }

    // Recommended-width markers, symmetric around the carrier
    let ly = top + Math.round(3 * s);
    const rfMk = modeU === "WBFM" ? [{ hi: 100000, label: "Wide FM ±100 kHz", color: "34,211,238" }]
      : modeU === "FM" ? [{ hi: 5500, label: "Narrow FM ±5.5 kHz (Carson)", color: "34,211,238" }]
      : [{ hi: 4500, label: "AM broadcast ±4.5 kHz", color: "34,211,238" },
         { hi: 3000, label: "AM amateur ±3 kHz", color: "56,189,248", dash: true }];
    for (const mk of rfMk) {
      const x0 = xOff(-mk.hi), x1 = xOff(mk.hi);
      ctx.fillStyle = `rgba(${mk.color},0.06)`; ctx.fillRect(x0, top, x1 - x0, specH);
      ctx.strokeStyle = `rgba(${mk.color},0.9)`; ctx.lineWidth = 1.2 * s; ctx.setLineDash(mk.dash ? [5 * s, 4 * s] : []);
      for (const xx of [x0, x1]) { ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top + specH); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = `bold ${Math.round(11.5 * s)}px sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const lbl = mk.label;
      const tw = ctx.measureText(lbl).width + 6 * s;
      ctx.fillStyle = "rgba(34,34,34,0.85)"; ctx.fillRect(left + 3 * s, ly - s, tw, 15.5 * s);
      ctx.fillStyle = `rgb(${mk.color})`; ctx.fillText(lbl, left + 5 * s, ly);
      ly += Math.round(17 * s);
    }

    // RF spectrum, lit relief
    const rv = new Float32Array(pw);
    for (let x = 0; x < pw; x++) rv[x] = Math.max(0, Math.min(1, (rfAvg[x] - floor) / (rfTop - floor)));
    drawRelief(rv, left, top, pw, specH);
    ctx.strokeStyle = "rgba(243,231,166,0.85)"; ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (let x = 0; x < pw; x++) { const y = yOf(rfPeak[x]); x ? ctx.lineTo(left + x, y) : ctx.moveTo(left + x, y); }
    ctx.stroke();

    // Current filter (symmetric)
    if (passband && passband.length === 2 && passband[1] > 0) {
      const x0 = xOff(-passband[1]), x1 = xOff(passband[1]);
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1 * s; ctx.setLineDash([2 * s, 3 * s]);
      ctx.strokeRect(Math.max(left, x0), top + 1, Math.min(left + pw, x1) - Math.max(left, x0), specH - 2);
      ctx.setLineDash([]);
    }
    // Measured overflow (splatter) on both sides
    if (occupied && (occupied.status === "wide" || occupied.status === "splatter") && Number.isFinite(occupied.ahi) && occupied.normHi != null) {
      const col = occupied.status === "splatter" ? "255,60,60" : "245,158,11";
      for (const sg of [-1, 1]) {
        const xa = xOff(sg * occupied.normHi), xb = xOff(sg * occupied.ahi);
        const x0 = Math.max(left, Math.min(xa, xb)), x1 = Math.min(left + pw, Math.max(xa, xb));
        if (x1 <= x0) continue;
        ctx.fillStyle = `rgba(${col},0.18)`; ctx.fillRect(x0, top, x1 - x0, specH);
        ctx.fillStyle = `rgba(${col},0.95)`; ctx.fillRect(x0, top + specH - 3 * s, x1 - x0, 3 * s);
      }
    }

    // Carrier in the centre
    const xc = xOff(0);
    ctx.strokeStyle = "rgba(34,211,238,0.95)"; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(xc, top); ctx.lineTo(xc, top + specH); ctx.stroke();
    const tag = "Carrier " + fmtKhz(base);
    ctx.font = `bold ${Math.round(12 * s)}px monospace`; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    const tw = ctx.measureText(tag).width + 8 * s, ty = top + Math.round(specH * 0.55);
    ctx.fillStyle = "rgba(34,34,34,0.85)"; ctx.fillRect(xc + 3 * s, ty - 15.5 * s, tw, 15.5 * s);
    ctx.fillStyle = "#fff"; ctx.fillText(tag, xc + 7 * s, ty - s);
    if (hoverX != null) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hoverX, top); ctx.lineTo(hoverX, top + specH); ctx.stroke();
    }

    // Ticks: offset from the carrier
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, top);
    ctx.font = `${Math.round(12 * s)}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const step = half > 50000 ? 20000 : half > 7000 ? 2000 : 1000;
    const nk = Math.floor(half / step);
    for (let k = -nk; k <= nk; k++) {
      const off = k * step, x = xOff(off);
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + specH); ctx.stroke();
      const kh = Math.abs(k * step) / 1000;
      const txt = k === 0 ? "0" : (k > 0 ? "+" : "-") + kh + "k";
      ctx.fillStyle = k === 0 ? "#fff" : "#aaa";
      ctx.textAlign = k === -nk ? "left" : k === nk ? "right" : "center";
      ctx.fillText(txt, k === -nk ? Math.max(x, left) : k === nk ? Math.min(x, left + pw) : x, 3 * s);
    }
    ctx.textAlign = "left"; ctx.fillStyle = "#aaa"; ctx.fillText("dB", 4 * s, 3 * s);
  }

  export function destroy() {
    stop();
    try { gainNode && gainNode.disconnect(); } catch (e) {}
    try { analyser && analyser.disconnect(); } catch (e) {}
    gainNode = analyser = null;
    if (audioContext && audioContext.state !== "closed") audioContext.close();
    audioContext = null;
    fdata = null; peak = null; wfImg = null;
  }
</script>

<div class="spg" bind:this={wrap}>
  {#if hasBase}
    <div class="spg-base" title="Frequency shown by the receiver; the cyan line places it in the audio spectrum">
      <span class="lbl">Dial frequency</span>
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <span class="val dial" use:dialWheel on:contextmenu|preventDefault on:click={() => dispatch("keypad")}
        title="Hover a digit: scroll or left-click = up, right-click = down · Click beside the digits for the number pad">
        {#each dialChars as c, i}{#if c.sep}<span class="sep">.</span>{:else}<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions --><span class="dg" class:hov={dialHover === i}
          on:mouseenter={() => (dialHover = i)} on:mouseleave={() => (dialHover = -1)}
          on:click={(e) => stepDial(e, c.hz, 1)} on:contextmenu={(e) => stepDial(e, c.hz, -1)}>{c.ch}</span>{/if}{/each}<span class="unit">kHz</span>
      </span>
      <span class="modewrap" bind:this={modeWrap}>
        <button class="mode" class:open={modeMenu} on:click={() => (modeMenu = !modeMenu)}
          title="Change the mode" aria-haspopup="menu" aria-expanded={modeMenu}>{modeU} ▾</button>
        {#if modeMenu && modes && modes.length}
          <div class="modemenu" role="menu">
            {#each modes as m}
              <button role="menuitem" class:cur={String(m).toUpperCase() === modeU} on:click={() => pickMode(m)}>{m}</button>
            {/each}
          </div>
        {/if}
      </span>
      <span class="hint">{isCw ? `CW note at ${cwPitch} Hz audio` : symmetric ? "automatic RF view: carrier in the centre, sidebands either side" : mirrored ? "0 Hz audio = carrier, RF frequency falls to the right" : "0 Hz audio = carrier"}</span>
      <span style="flex:1"></span>
      <button class="spg-mute" class:on={muted} on:click={() => dispatch("togglemute")}
        title={muted ? "Unmute the receiver" : "Mute the receiver (analysis continues): to analyse your own transmission without feeding the audio back into your microphone"}>
        <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        <span>{muted ? "Muted" : "Mute"}</span>
      </button>
    </div>
  {/if}
  <div class="spg-cv">
    <canvas bind:this={canvas} on:mousemove={onMove} on:mouseleave={onLeave}></canvas>
    {#if hover}
      <div class="spg-tip" class:flip={hover.flip} style="left:{hover.px}px">{#if hover.rf}<b>{hover.rf}</b><br />{/if}{hover.audio}</div>
    {/if}
  </div>
  <div class="spg-obw {occupied && occupied.text ? occupied.status : 'empty'}">{occupied && occupied.text ? occupied.text : "\u00a0"}</div>
</div>

<style>
  /* Site default colours: grey frame (#222 / #444), grey labels, buttons as
     the page's own (gray-700, hover gray-600, active blue-600). */
  .spg { width: 100%; }
  .spg-base {
    display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 4px;
    padding: 3px 8px; border-radius: 4px; border: 1px solid #444; background: #222;
    /* the height it had before the larger text; min, not fixed, so it can
       still wrap onto two lines on a phone */
    min-height: 2.18rem; box-sizing: border-box;
  }
  .spg-base .lbl { font-size: 0.84rem; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .spg-base .val { font-family: monospace; font-size: 1.22rem; line-height: 1.2; font-weight: 700; color: #fff; }
  .spg-base .dial { cursor: pointer; display: inline-flex; align-items: baseline; user-select: none; }
  .spg-base .dial .dg { padding: 0 1px; border-radius: 3px; transition: background-color 0.1s; }
  .spg-base .dial .dg.hov { background: #0891b2; }
  .spg-base .dial .unit { margin-left: 0.4em; }
  .spg-base .mode { font-size: 0.84rem; font-weight: 700; color: #fff; background: #2563eb; border-radius: 3px; padding: 0 5px; cursor: pointer; border: 0; }
  .spg-base .mode:hover, .spg-base .mode.open { background: #1d4ed8; }
  .spg-base .modewrap { position: relative; display: inline-block; }
  .spg-base .modemenu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 30; display: flex; flex-direction: column; min-width: 5.5rem;
    background: #222; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 3px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
  }
  .spg-base .modemenu button {
    text-align: left; font-size: 0.75rem; font-weight: 600; color: #fff; background: transparent; border: 0;
    border-radius: 0.25rem; padding: 0.2rem 0.5rem; cursor: pointer; white-space: nowrap;
  }
  .spg-base .modemenu button:hover { background: #4b5563; }
  .spg-base .modemenu button.cur { background: #2563eb; }
  .spg-mute {
    display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.6rem; border-radius: 0.375rem;
    font-size: 0.86rem; font-weight: 600; white-space: nowrap; cursor: pointer; line-height: 1.25;
    color: #fff; background: #374151; border: 1px solid #4b5563;
  }
  .spg-mute:hover { background: #4b5563; }
  .spg-mute.on { background: #2563eb; border-color: #4b5563; }
  .spg-base .hint { font-size: 0.8rem; color: #9ca3af; font-style: italic; }
  .spg-cv { position: relative; }
  .spg-tip {
    position: absolute; top: 20px; transform: translateX(8px); pointer-events: none; white-space: nowrap;
    font: 11px/1.3 monospace; color: #e5e7eb; background: rgba(34, 34, 34, 0.95);
    border: 1px solid #444; border-radius: 4px; padding: 2px 6px; z-index: 2;
  }
  .spg-tip.flip { transform: translateX(calc(-100% - 8px)); }
  .spg-tip b { color: #fff; }
  .spg-obw { background: #222; margin-top: 4px; font-size: 0.72rem; line-height: 1.1rem; height: calc(1.1rem + 6px); padding: 2px 8px; border-radius: 4px; border: 1px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spg-obw.ok { color: #86efac; border-color: rgba(134, 239, 172, 0.35); background: linear-gradient(rgba(22, 101, 52, 0.15), rgba(22, 101, 52, 0.15)), #222; }
  .spg-obw.wide { color: #fcd34d; border-color: rgba(252, 211, 77, 0.4); background: linear-gradient(rgba(146, 64, 14, 0.18), rgba(146, 64, 14, 0.18)), #222; }
  .spg-obw.splatter { color: #fecaca; font-weight: 700; border-color: rgba(248, 113, 113, 0.6); background: linear-gradient(rgba(153, 27, 27, 0.35), rgba(153, 27, 27, 0.35)), #222; }
  .spg-obw.info { color: #d1d5db; font-style: italic; border-color: #444; }
  .spg-obw.empty { background: transparent; }
  canvas {
    width: 100%;
    display: block;
    background: #000;
    border-radius: 4px;
    border: 1px solid #444;
  }
</style>
