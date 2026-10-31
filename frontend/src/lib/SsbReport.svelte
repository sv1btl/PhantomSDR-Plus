<script>
  /**
   * SsbReport — SSB audio report.
   *
   * Taken from PhantomSDR-ORSAT (github.com/f1nsk40260/PhantomSDR-ORSAT),
   * translated to English.
   *
   * Analyses the modulation of the station being heard in USB / LSB over a
   * sliding 20 s window, keeping only the moments when it is talking:
   *   • tonal balance: bass 100–300 Hz and presence 1.5–2.7 kHz relative to the
   *     mid band 300–1500 Hz, compared with a reference (standard SSB, DX, ESSB);
   *   • static crashes are dropped (short bursts with a flat spectrum), ratios
   *     are taken as a frame-by-frame median;
   *   • compression: crest factor of the waveform over ~340 ms;
   *   • mains hum: steady lines at 50/100/150 Hz (or 60/120/180 Hz);
   *   • residual carrier and opposite sideband: measured on the RF waterfall,
   *     because the receive filter hides them in the audio;
   *   • occupied width: taken from the splatter measurement.
   * Curve A can be stored to compare before / after a change, and a full
   * listening report (HTML with an audio clip) can be downloaded.
   */
  import { onDestroy } from "svelte";

  export let spectro = null;          // Spectrogram component (sampleAudio)
  export let rfMeasure = null;        // (dialHz, mode) => RF measurement or null
  export let mode = "USB";
  export let baseKhz = null;
  export let passband = null;         // receive filter in audio Hz
  export let occupied = null;         // occupied width (App._obwTick)
  export let enabled = true;
  /** Outputs to the spectrogram: long-term voice spectrum and curve A. */
  export let ltas = null;
  export let ltasRef = null;

  const WINDOW = 200;                 // 20 s at 10 measurements/s
  const STEP = 50, NB = 80;           // long-term spectrum: 80 bins of 50 Hz
  const REFS = {
    std:  { name: "Standard SSB", bass: -13, pres: -10, desc: "everyday traffic, 300–2700 Hz filter",
            tip: "Reference for everyday traffic: a balanced voice in a 300–2700 Hz filter" },
    dx:   { name: "DX / punch",   bass: -16, pres: -6, desc: "boosted presence to cut through the noise",
            tip: "DX reference: little bass, boosted presence to stay readable in the noise" },
    essb: { name: "ESSB / hi-fi", bass: -3,  pres: -12, desc: "wideband, bass kept",
            tip: "ESSB reference: wideband hi-fi modulation, bass kept" },
  };
  let refKey = "std";
  const ROWS = [
    { key: "bass", label: "Bass 100–300 Hz" },
    { key: "pres", label: "Presence 1.5–2.7 kHz" },
    { key: "comp", label: "Compression" },
    { key: "hum", label: "Mains hum" },
    { key: "car", label: "Residual carrier" },
    { key: "opp", label: "Opposite sideband" },
    { key: "obw", label: "Occupied width" },
  ];
  // Last verdict of each row, kept until a new measurement replaces it: the
  // panel keeps its size and does not flicker.
  let held = {};

  $: m = String(mode || "").toUpperCase();
  $: active = enabled && (m === "USB" || m === "LSB");

  let aud = [], rf = [];
  let nb = { b: null, m: null, p: null };   // audio noise floor per band (dB)
  let rep = null, A = null;
  let impHold = 0, warm = 0;
  let timer = null, tick = 0, lastBase = null, lastMode = "";

  $: if (active && !timer) timer = setInterval(sample, 100);
  $: if (!active && timer) { clearInterval(timer); timer = null; reset(); }
  onDestroy(() => timer && clearInterval(timer));

  // Reset as soon as the station or the mode changes.
  $: {
    const b = Number(baseKhz);
    if (lastBase != null && Number.isFinite(b) && Math.abs(b - lastBase) > 0.05) reset();
    if (lastMode && m !== lastMode) reset();
    if (Number.isFinite(b)) lastBase = b;
    lastMode = m;
  }

  export function reset() {
    aud = []; rf = []; nb = { b: null, m: null, p: null }; rep = null; ltas = null; held = {}; impHold = 0; warm = 0;
  }

  const db = (p) => 10 * Math.log10(Math.max(p, 1e-20));
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  function track(prev, v) {             // floor: falls fast, rises slowly
    if (prev == null || v < prev) return v;
    return prev + Math.min(0.25, v - prev);           // ~2.5 dB/s
  }

  function bandPow(f, binHz, f0, f1) {
    let s = 0;
    const a = Math.max(1, Math.round(f0 / binHz)), b = Math.min(f.length - 1, Math.round(f1 / binHz));
    for (let i = a; i <= b; i++) s += Math.pow(10, f[i] / 10);
    return s;
  }
  function line(f, binHz, hz) {         // how far a line stands above its neighbourhood
    const c = Math.round(hz / binHz), w = Math.max(1, Math.round(2 / binHz));
    let pk = -Infinity;
    for (let i = c - w; i <= c + w; i++) if (f[i] > pk) pk = f[i];
    const nbh = [];
    for (let d = Math.round(8 / binHz); d <= Math.round(25 / binHz); d++) { nbh.push(f[c - d], f[c + d]); }
    return pk - median(nbh.filter(Number.isFinite));
  }

  function sample() {
    if (!spectro || typeof spectro.sampleAudio !== "function") return;
    const s = spectro.sampleAudio();
    if (s) {
      const { f, t, binHz } = s;
      const pb = bandPow(f, binHz, 100, 300), pm = bandPow(f, binHz, 300, 1500), pp = bandPow(f, binHz, 1500, 2700);
      const lb = db(pb), lm = db(pm), lp = db(pp);
      // No sound yet (empty analyser, −∞ dB): skip the frame, otherwise the
      // noise floor drops to −200 dB and everything afterwards passes for voice.
      if (!(lm > -160)) { tick++; return; }
      // 2 s warm-up: the noise floor settles and the analyser fills.
      if (++warm < 20) { nb = { b: track(nb.b, lb), m: track(nb.m, lm), p: track(nb.p, lp) }; tick++; return; }
      nb = { b: track(nb.b, lb), m: track(nb.m, lm), p: track(nb.p, lp) };
      // Static crashes (QRN): very short and spectrally flat. The analyser
      // window is cut into 128-sample slices (~11 ms): a crash fills only a few
      // of them, far above the rest, while a voice onset fills many. Voice also
      // has much less energy in the presence band than in the mid band; a crash
      // has nearly as much.
      const nbk = t.length >> 7, br = new Float32Array(nbk);
      for (let k = 0; k < nbk; k++) { let e = 0; for (let i = k << 7; i < (k + 1) << 7; i++) e += t[i] * t[i]; br[k] = e / 128; }
      const sorted = Array.from(br).sort((x, y) => x - y);
      const bmed = Math.max(sorted[nbk >> 1], 1e-12), bmax = sorted[nbk - 1];
      const burst = db(bmax / bmed), nHigh = sorted.filter((v) => v > bmed * 10).length;
      const flat = lp - lm;
      // Both criteria together: short AND flat. The end of a sentence before a
      // silence is short too, but keeps the sloping spectrum of a voice.
      const hit = flat > -6 && (burst > 8 || nHigh <= 4 && burst > 6);
      if (hit) impHold = 4;                              // + the analyser's smoothing tail
      const imp = impHold > 0; if (impHold > 0) impHold--;
      const speech = !imp && lm > nb.m + 9;
      // Powers with the background noise removed
      const clean = (p, n) => Math.max(0, p - Math.pow(10, n / 10));
      const fr = { sp: speech, imp: hit && lm > nb.m + 9, snr: lm - nb.m };
      if (speech) {
        fr.b = clean(pb, nb.b); fr.m = clean(pm, nb.m); fr.p = clean(pp, nb.p);
        // Crest factor over the analyser window (~340 ms: a syllable or two)
        let pk = 0, e = 0;
        for (let i = 0; i < t.length; i++) { const v = t[i]; e += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
        const rms = Math.sqrt(e / t.length);
        fr.crest = rms > 1e-5 ? 20 * Math.log10(pk / rms) : null;
        const L = new Float32Array(NB);
        for (let k = 0; k < NB; k++) L[k] = bandPow(f, binHz, k * STEP + 1, (k + 1) * STEP) / Math.max(1, Math.round(STEP / binHz));
        fr.L = L;
      }
      fr.h50 = [50, 100, 150].map((h) => line(f, binHz, h) > 8);
      fr.h60 = [60, 120, 180].map((h) => line(f, binHz, h) > 8);
      aud.push(fr); if (aud.length > WINDOW) aud.shift();
    }
    const dial = Number(baseKhz) * 1000;
    if (typeof rfMeasure === "function" && Number.isFinite(dial)) {
      const r = rfMeasure(dial, m);
      if (r) {
        if (r.ok) r.sp = r.want > r.noise + 8;
        rf.push(r); if (rf.length > WINDOW) rf.shift();
      }
    }
    if (++tick % 10 === 0) compute();
  }

  function verdictTone(d, kind) {
    if (d == null) return null;
    const a = Math.abs(d);
    const lvl = a <= 4 ? "ok" : a <= 8 ? "warn" : "bad";
    let txt;
    if (lvl === "ok") txt = "balanced";
    else if (kind === "bass") txt = d > 0 ? (lvl === "bad" ? "far too much bass" : "too much bass") : "lacks bass (thin voice)";
    else txt = d > 0 ? (lvl === "bad" ? "far too much treble (shrill)" : "too much treble") : "lacks presence (muffled voice)";
    return { lvl, txt };
  }
  const sgn = (v) => { const r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r); };   // sign of the rounded value: no "−0"

  function compute() {
    const sp = aud.filter((a) => a.sp);
    const speechSec = sp.length / 10;
    const out = { speechSec, ready: speechSec >= 3, rows: [] };
    const ref = REFS[refKey];

    // ── Tonal balance ──
    const lo = passband ? passband[0] : 0, hi = passband ? passband[1] : 3000;
    let B = 0, M = 0, P = 0;
    for (const a of sp) { B += a.b; M += a.m; P += a.p; }
    // Ratios taken as a frame-by-frame median: a crash that slipped past the
    // filter no longer moves the result.
    const rB = sp.filter((a) => a.m > 0 && a.b > 0).map((a) => db(a.b / a.m));
    const rP = sp.filter((a) => a.m > 0 && a.p > 0).map((a) => db(a.p / a.m));
    const nImp = aud.filter((a) => a.imp).length;
    out.impPct = sp.length + nImp ? Math.round((100 * nImp) / (sp.length + nImp)) : 0;
    const snr = median(sp.map((a) => a.snr));
    out.snr = snr;
    if (out.ready && M > 0) {
      const bass = lo <= 120 && rB.length >= 10 ? median(rB) : null;
      const pres = hi >= 2600 && rP.length >= 10 ? median(rP) : null;
      out.bass = bass; out.pres = pres;
      const vb = bass != null ? verdictTone(bass - ref.bass, "bass") : null;
      const vp = pres != null ? verdictTone(pres - ref.pres, "pres") : null;
      out.rows.push({ key: "bass", label: "Bass 100–300 Hz",
        val: bass != null ? `${sgn(bass)} dB (ref. ${sgn(ref.bass)})` : "",
        lvl: vb ? vb.lvl : "na", txt: vb ? vb.txt : `not measurable: the RX filter cuts below ${Math.round(lo)} Hz` });
      out.rows.push({ key: "pres", label: "Presence 1.5–2.7 kHz",
        val: pres != null ? `${sgn(pres)} dB (ref. ${sgn(ref.pres)})` : "",
        lvl: vp ? vp.lvl : "na", txt: vp ? vp.txt : `not measurable: the RX filter cuts off at ${Math.round(hi)} Hz` });
      // Long-term voice spectrum, for the spectrogram
      const L = new Float64Array(NB);
      for (const a of sp) for (let k = 0; k < NB; k++) L[k] += a.L[k];
      ltas = { step: STEP, db: Array.from(L, (v) => (v > 0 ? db(v / sp.length) : NaN)), mid: db(M / sp.length) };
    }

    // ── Compression ──
    const cr = median(sp.map((a) => a.crest).filter((v) => v != null));
    if (out.ready && cr != null) {
      const lvl = cr > 15 ? "warn" : cr >= 10 ? "ok" : "bad";
      out.rows.push({ key: "comp", label: "Compression", val: `peak/average ${cr.toFixed(1)} dB`, lvl,
        txt: lvl === "ok" ? "compression OK" : lvl === "warn" ? "little or no compression" : "heavily compressed, clipping likely" });
    }

    // ── Mains hum ──
    if (out.ready) {
      const frac = (key) => [0, 1, 2].map((i) => aud.filter((a) => a[key][i]).length / aud.length);
      const f50 = frac("h50"), f60 = frac("h60");
      const n50 = f50.filter((v) => v > 0.5).length, n60 = f60.filter((v) => v > 0.5).length;
      if (lo > 140) out.rows.push({ key: "hum", label: "Mains hum", val: "", lvl: "na", txt: `not measurable: the RX filter cuts below ${Math.round(lo)} Hz` });
      else {
        const hit = n50 >= 2 ? "50" : n60 >= 2 ? "60" : null;
        out.rows.push({ key: "hum", label: "Mains hum", val: hit ? `lines at ${hit === "50" ? "50/100/150" : "60/120/180"} Hz` : "", lvl: hit ? "bad" : "ok",
          txt: hit ? "hum detected (ground, power supply)" : "no hum" });
      }
    }

    // ── RF measurements: carrier and opposite sideband ──
    const okRf = rf.filter((r) => r.ok);
    const rsp = okRf.filter((r) => r.sp), ridle = okRf.filter((r) => !r.sp);
    if (rf.length >= 20 && okRf.length < rf.length / 2) {
      const why = rf.filter((r) => !r.ok).some((r) => r.reason === "zoom") ? "zoom the waterfall in on the station" : "no waterfall data";
      out.rows.push({ key: "car", label: "Residual carrier", val: "", lvl: "na", txt: why });
      out.rows.push({ key: "opp", label: "Opposite sideband", val: "", lvl: "na", txt: why });
    } else if (rsp.length >= 15) {
      const pk = pct(rsp.map((r) => r.wantPk), 0.9);
      const noise = median(rsp.map((r) => r.noise));
      const cars = rsp.map((r) => r.car).filter((v) => v != null);
      if (cars.length < rsp.length / 2) out.rows.push({ key: "car", label: "Residual carrier", val: "", lvl: "na", txt: "zoom in further (≤ 60 Hz per point)" });
      else {
        const car = median(cars);
        // car is the strongest of the ~9 bins around the dial: on noise alone
        // that already reads 6–8 dB over the average noise.
        const visible = car > noise + 10;
        const sup = pk - (visible ? car : noise);
        const lvl = !visible ? (sup >= 40 ? "ok" : "na") : sup >= 40 ? "ok" : sup >= 30 ? "warn" : "bad";
        out.rows.push({ key: "car", label: "Residual carrier", val: visible ? `${sgn(-sup)} dB` : `< ${sgn(-sup)} dB`, lvl,
          txt: !visible ? (lvl === "ok" ? "invisible, well suppressed" : "invisible, signal too weak to tell") : lvl === "ok" ? "well suppressed" : lvl === "warn" ? "carrier visible" : "carrier poorly suppressed" });
      }
      const wantM = db(rsp.reduce((s, r) => s + Math.pow(10, r.want / 10), 0) / rsp.length);
      const oppM = db(rsp.reduce((s, r) => s + Math.pow(10, r.opp / 10), 0) / rsp.length);
      const oppIdle = ridle.length >= 10 ? db(ridle.reduce((s, r) => s + Math.pow(10, r.opp / 10), 0) / ridle.length) : null;
      if (oppIdle != null && oppIdle > noise + 6 && Math.abs(oppM - oppIdle) < 3)
        out.rows.push({ key: "opp", label: "Opposite sideband", val: "", lvl: "na", txt: "occupied by another station (QRM), cannot measure" });
      else {
        const vis = oppM > noise + 3;
        const rej = wantM - (vis ? oppM : noise);
        const lvl = !vis ? (rej >= 40 ? "ok" : "na") : rej >= 40 ? "ok" : rej >= 30 ? "warn" : "bad";
        out.rows.push({ key: "opp", label: "Opposite sideband", val: vis ? `${sgn(-rej)} dB` : `< ${sgn(-rej)} dB`, lvl,
          txt: !vis ? (lvl === "ok" ? "well rejected" : "below the noise, signal too weak to tell") : lvl === "ok" ? "well rejected" : lvl === "warn" ? "opposite sideband visible" : "opposite sideband poorly rejected" });
      }
    }

    // ── Occupied width (from the splatter measurement) ──
    if (occupied && occupied.status && occupied.status !== "info" && occupied.text) {
      const w = (occupied.text.match(/([\d.]+) kHz/) || [])[1] || "";
      out.rows.push({ key: "obw", label: "Occupied width", val: w ? `${w} kHz` : "",
        lvl: occupied.status === "ok" ? "ok" : occupied.status === "wide" ? "warn" : "bad",
        txt: occupied.status === "ok" ? "compliant" : occupied.status === "wide" ? "a little wide" : "splatter" });
    }
    rep = out;
    const h = { ...held };
    for (const r of out.rows) h[r.key] = r;
    held = h;
  }

  function memorize() {
    if (!rep || !ltas) return;
    A = { ltas, bass: rep.bass, pres: rep.pres, when: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
  }
  function forgetA() { A = null; }
  // Curve A re-levelled to the current mid band (fading changes the level, not the shape).
  $: ltasRef = A && A.ltas ? (ltas ? { step: STEP, db: A.ltas.db.map((v) => v + (ltas.mid - A.ltas.mid)) } : A.ltas) : null;

  function fmtKhz(k) {
    return Number(k).toFixed(3);
  }
  // ── Full report with an audio clip (self-contained HTML file) ──
  function wavBlob(pcm, sr) {
    let pk = 0;
    for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > pk) pk = a; }
    const g = pk > 1e-6 ? 0.89 / pk : 1;                 // normalised to −1 dBFS for listening
    const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(pcm[i] * g * 32767))), true);
    return new Blob([buf], { type: "audio/wav" });
  }
  const blobToDataUrl = (b) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(b); });
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let building = false;
  async function fullReport() {
    if (!spectro || building) return;
    building = true;
    try {
      const au = typeof spectro.getRecentAudio === "function" ? spectro.getRecentAudio(20) : null;
      const img = typeof spectro.getSnapshot === "function" ? spectro.getSnapshot() : null;
      const now = new Date();
      const utc = now.toISOString().replace("T", " ").slice(0, 16) + " UTC";
      const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
      const fk = fmtKhz(baseKhz);
      const dot = { ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444", na: "#6b7280" };
      const rows = ROWS.map((row) => {
        const r = held[row.key];
        return `<tr><td><span class="d" style="background:${dot[r ? r.lvl : "na"]}"></span></td><td>${esc(row.label)}</td><td class="v">${esc(r && r.val ? r.val : "—")}</td><td>${esc(r ? r.txt : "not measured")}</td></tr>`;
      }).join("");
      let audioHtml = "<p class=\"n\">No audio clip: open the audio analyser a few seconds before generating the report.</p>";
      let wavUrl = null;
      if (au && au.pcm.length > au.sr) {
        const wav = wavBlob(au.pcm, au.sr);
        wavUrl = await blobToDataUrl(wav);
        audioHtml = `<audio controls src="${wavUrl}"></audio>
<p class="n">${(au.pcm.length / au.sr).toFixed(0)} s of raw receiver audio (before any listening processing), level-normalised. <a download="PhantomSDR-${esc(fk.replace(/\s/g, ""))}kHz-${stamp}.wav" href="${wavUrl}">Download the WAV file</a></p>`;
      }
      const ab = A && rep && rep.ready
        ? `<p>Comparison with curve A (${esc(A.when)}): bass ${A.bass != null ? sgn(A.bass) + " dB" : "—"} → ${rep.bass != null ? sgn(rep.bass) + " dB" : "—"}; presence ${A.pres != null ? sgn(A.pres) + " dB" : "—"} → ${rep.pres != null ? sgn(rep.pres) + " dB" : "—"}.</p>` : "";
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listening report — ${esc(fk)} kHz ${esc(m)}</title>
<style>body{background:#222;color:#e5e7eb;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px}main{max-width:820px;margin:auto}
h1{color:#fff;font-size:1.4rem;margin:0 0 .2rem}.sub{color:#9ca3af;margin:0 0 1.2rem}.f{font:700 1.6rem monospace;color:#fff}
.m{background:#2563eb;color:#fff;border-radius:4px;padding:0 6px;font-weight:700;margin-left:.4rem}
table{width:100%;border-collapse:collapse;margin:.8rem 0}td{padding:6px 8px;border-top:1px solid #444}.v{font-family:monospace;color:#e5e7eb;white-space:nowrap}
.d{display:inline-block;width:10px;height:10px;border-radius:50%}img{width:100%;border:1px solid #444;border-radius:6px}audio{width:100%;margin-top:.4rem}
.n{color:#9ca3af;font-size:.85rem}a{color:#60a5fa}h2{color:#fff;font-size:1.05rem;margin:1.4rem 0 .3rem}</style></head><body><main>
<h1>Listening report — PhantomSDR+</h1>
<p class="sub">${esc(utc)} · ${esc(location.host)} · tonal reference ${esc(REFS[refKey].name)}</p>
<p><span class="f">${esc(fk)} kHz</span><span class="m">${esc(m)}</span></p>
<h2>Audio clip</h2>${audioHtml}
<h2>Modulation report</h2><table>${rows}</table>${ab}
${img ? `<h2>Audio spectrum at the time of the report</h2><img alt="Audio spectrum" src="${img}"><p class="n">Blue curve: average voice shape; white dashes: stored curve A; cyan line: dial frequency.</p>` : ""}
<p class="n">Indicative measurement over a sliding 20 s window, during speech only. Fading and the receiver's filter and AGC affect it.</p>
</main></body></html>`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      a.download = `Listening-report-${fk.replace(/\s/g, "")}kHz-${m}-${stamp}.html`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally { building = false; }
  }

</script>

{#if active}
  <div class="sr">
    <div class="sr-head">
      <span class="sr-title">SSB audio report</span>
      <span style="flex:1"></span>
      <button class="sr-btn" on:click={memorize} disabled={!rep || !ltas}
        title="Store the current curve (dashed) to compare it after the other station changes a setting">Store A</button>
      <button class="sr-btn" on:click={forgetA} disabled={!A} title="Clear curve A">Clear A</button>
      <button class="sr-btn" on:click={reset} title="Restart the analysis (20 s window)">↺ Restart</button>
      <button class="sr-btn" on:click={fullReport} disabled={building || !Object.keys(held).length}
        title="Download a full listening report (an HTML file to send to the other station): verdicts, spectrum image and the last 20 seconds of audio">{building ? "…" : "🎧 Generate a listening report"}</button>
    </div>

    <div class="sr-refbar">
      <span class="sr-reflbl">Judge the voice against:</span>
      <div class="sr-seg" role="radiogroup" aria-label="Tonal reference">
        {#each Object.entries(REFS) as [k, r]}
          <button role="radio" aria-checked={refKey === k} class:on={refKey === k}
            on:click={() => { refKey = k; compute(); }} title={r.tip}>{r.name}</button>
        {/each}
      </div>
      <span class="sr-refdesc">{REFS[refKey].desc}</span>
    </div>
    <table class="sr-tab">
      <colgroup><col style="width:18px" /><col style="width:11.5rem" /><col style="width:12rem" /><col /></colgroup>
      {#each ROWS as row (row.key)}
        {@const r = held[row.key]}
        <tr class={r ? r.lvl : "wait"}>
          <td class="dot"><span></span></td>
          <td class="lbl">{row.label}</td>
          <td class="val">{r && r.val ? r.val : "—"}</td>
          <td class="txt">{r ? r.txt : "waiting"}</td>
        </tr>
      {/each}
    </table>
    <div class="sr-line" title="Indicative measurement over a sliding 20 s window, during speech only. Fading and the receiver's filter and AGC affect it: prefer slow AGC.">
      {#if !rep || !rep.ready}
        <span>Waiting for modulation…</span>
        <span class="num">{rep ? rep.speechSec.toFixed(1) : "0.0"} s / 3 s</span>
        <span>of voice analysed</span>
      {:else if A}
        <span>Curve A</span><span class="num">({A.when})</span>
        <span>bass</span><span class="num">{A.bass != null ? sgn(A.bass) + " dB" : "—"} → {rep.bass != null ? sgn(rep.bass) + " dB" : "—"}</span>
        <span>presence</span><span class="num">{A.pres != null ? sgn(A.pres) + " dB" : "—"} → {rep.pres != null ? sgn(rep.pres) + " dB" : "—"}</span>
      {:else}
        <span>Indicative measurement over a sliding 20 s window, during speech only. Fading and the receiver's filter and AGC affect it: prefer slow AGC.</span>
      {/if}
      {#if rep && rep.impPct >= 10}<span class="imp">Crashes ignored:</span><span class="num">{rep.impPct} %</span>{/if}
      {#if rep && rep.snr != null && rep.snr < 15 && rep.ready}<span class="weak">Weak signal: reduced reliability.</span>{/if}
    </div>
  </div>
{/if}

<style>
  /* Site default colours: grey frame (#222 / #444), grey labels, buttons as
     the page's own (gray-700, hover gray-600, active blue-600). Verdict
     colours (green / amber / red) keep their meaning. */
  .sr { margin-top: 6px; padding: 6px 8px; border-radius: 4px; border: 1px solid #444; background: #000; position: relative; z-index: 1; }
  .sr-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 4px; }
  .sr-title { font-size: 0.9rem; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
  .sr-refbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 2px 0 6px; padding: 5px 8px;
    border-radius: 4px; background: rgba(255, 255, 255, 0.03); border: 1px solid #444; }
  .sr-reflbl { font-size: 0.86rem; font-weight: 600; color: #d1d5db; }
  .sr-seg { display: inline-flex; border: 1px solid #4b5563; border-radius: 0.375rem; overflow: hidden; }
  .sr-seg button { font-size: 0.86rem; font-weight: 600; padding: 0.1rem 0.75rem; line-height: 1.25; color: #fff; background: #374151;
    border-right: 1px solid #4b5563; cursor: pointer; }
  .sr-seg button:last-child { border-right: 0; }
  .sr-seg button:hover { background: #4b5563; }
  .sr-seg button.on { background: #2563eb; }
  .sr-refdesc { font-size: 0.8rem; color: #9ca3af; font-style: italic; }
  .sr-btn {
    font-size: 0.78rem; padding: 0.05rem 0.5rem; line-height: 1.3; border-radius: 0.375rem; font-weight: 600; white-space: nowrap;
    color: #fff; border: 1px solid #4b5563; background: #374151;
  }
  .sr-btn:hover:not(:disabled) { background: #4b5563; }
  .sr-btn:disabled { opacity: 0.4; cursor: default; }
  .sr-line {
    font-size: 0.76rem; color: #9ca3af; font-style: italic; display: flex; gap: 0.35rem; align-items: center;
    height: 1.4rem; margin-top: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .sr-line .weak { color: #fcd34d; }
  .sr-line .imp { color: #fcd34d; margin-left: auto; }
  .num { font-family: monospace; font-style: normal; color: #d1d5db; }
  .sr-tab { width: 100%; border-collapse: collapse; font-size: 0.87rem; table-layout: fixed; }
  .sr-tab td { padding: 2px 6px; height: 1.48rem; line-height: 1.15; border-top: 1px solid rgba(255, 255, 255, 0.22); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sr-tab .wait .txt, .sr-tab .wait .val { color: #6b7280; font-style: italic; }
  .sr-tab .dot { width: 14px; }
  .sr-tab .dot span { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #6b7280; }
  .sr-tab .ok .dot span { background: #22c55e; box-shadow: 0 0 5px #22c55e; }
  .sr-tab .warn .dot span { background: #f59e0b; box-shadow: 0 0 5px #f59e0b; }
  .sr-tab .bad .dot span { background: #ef4444; box-shadow: 0 0 5px #ef4444; }
  .sr-tab .lbl { color: #d1d5db; white-space: nowrap; }
  .sr-tab .val { font-family: monospace; color: #e5e7eb; white-space: nowrap; }
  .sr-tab .txt { color: #e5e7eb; }
  .sr-tab .ok .txt { color: #86efac; }
  .sr-tab .warn .txt { color: #fcd34d; }
  .sr-tab .bad .txt { color: #fca5a5; font-weight: 600; }
  .sr-tab .na .txt { color: #9ca3af; font-style: italic; }
</style>
