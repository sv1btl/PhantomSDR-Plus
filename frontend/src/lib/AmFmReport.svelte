<script>
  /**
   * AmFmReport — AM / FM report, the AM and FM counterpart of SsbReport.
   *
   * In AM and FM the receiver's audio says little about the transmitter: the
   * AM carrier is removed from the audio and the AGC sets the level, FM audio
   * is AGC'd too. So the transmitter is judged mostly on the RF waterfall
   * (waterfall.measureAmFm) over a sliding 20 s window:
   *   • AM: modulation depth from the sideband/carrier power ratio, balance of
   *     the two sidebands, carrier offset from the dial, occupied width;
   *   • FM: 99 % power bandwidth, deviation estimated from it (Carson's rule),
   *     frequency offset of the station from the dial, CTCSS tone;
   *   • both: audio bandwidth (top of the long-term audio spectrum) and mains
   *     hum (steady lines at 50/100/150 Hz or 60/120/180 Hz).
   * The waterfall must be zoomed in on the station. A listening report (HTML
   * with an audio clip) can be downloaded.
   */
  import { onDestroy } from "svelte";

  export let spectro = null;          // Spectrogram component (sampleAudio)
  export let rfMeasure = null;        // (dialHz, mode) => waterfall.measureAmFm result
  export let ctcss = null;            // () => { toneHz, snrDb } | null (FM only)
  export let mode = "AM";
  export let baseKhz = null;
  export let passband = null;         // receive filter in audio Hz
  export let occupied = null;         // occupied width (App._obwTick), AM only
  export let enabled = true;

  const WINDOW = 200;                 // 20 s at 10 measurements/s
  const STEP = 50, NB = 120;          // long-term audio spectrum: 120 bins of 50 Hz (0–6 kHz)
  const ROWS_AM = [
    { key: "depth", label: "Modulation depth" },
    { key: "bal", label: "Sideband balance" },
    { key: "off", label: "Carrier offset" },
    { key: "abw", label: "Audio bandwidth" },
    { key: "hum", label: "Mains hum" },
    { key: "obw", label: "Occupied width" },
  ];
  const ROWS_FM = [
    { key: "dev", label: "Deviation (approx.)" },
    { key: "b99", label: "Occupied width (99 %)" },
    { key: "off", label: "Frequency offset" },
    { key: "abw", label: "Audio bandwidth" },
    { key: "tone", label: "CTCSS tone" },
    { key: "hum", label: "Mains hum" },
  ];
  // Last verdict of each row, kept until a new measurement replaces it: the
  // panel keeps its size and does not flicker.
  let held = {};

  $: m = String(mode || "").toUpperCase();
  $: isFm = m === "FM";
  $: active = enabled && (m === "AM" || m === "QUAM" || m === "FM");
  $: ROWS = isFm ? ROWS_FM : ROWS_AM;

  let aud = [], rf = [], tones = [];
  let nbm = null, nbL = null;         // audio noise floor: voice band, and per 50 Hz bin (dB)
  let rep = null, warm = 0;
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
    aud = []; rf = []; tones = []; nbm = null; nbL = null; rep = null; held = {}; warm = 0;
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
    // RF first: in AM the sidebands tell whether the station is modulating,
    // which also holds for music without pauses, where an audio gate fails.
    const dial = Number(baseKhz) * 1000;
    let r = null;
    if (typeof rfMeasure === "function" && Number.isFinite(dial)) r = rfMeasure(dial, m);
    const s = spectro.sampleAudio();
    let speech = false;
    if (s) {
      const { f, binHz } = s;
      const lm = db(bandPow(f, binHz, 300, 3000));
      // No sound yet (empty analyser, −∞ dB): skip the frame.
      if (!(lm > -160)) { tick++; return; }
      const L = new Float32Array(NB);
      for (let k = 0; k < NB; k++) L[k] = db(bandPow(f, binHz, k * STEP + 1, (k + 1) * STEP));
      if (!nbL) nbL = Array.from(L);
      else for (let k = 0; k < NB; k++) nbL[k] = track(nbL[k], L[k]);
      nbm = track(nbm, lm);
      // 2 s warm-up: the noise floor settles and the analyser fills.
      if (++warm >= 20) {
        speech = isFm ? lm > nbm + 9 : !!(r && r.ok && r.sbSnr >= 0);
        const fr = { sp: speech };
        if (speech) fr.L = L;
        fr.h50 = [50, 100, 150].map((h) => line(f, binHz, h) > 8);
        fr.h60 = [60, 120, 180].map((h) => line(f, binHz, h) > 8);
        aud.push(fr); if (aud.length > WINDOW) aud.shift();
      }
    }
    if (r) {
      // AM: a frame counts when the sidebands stand out of the noise; FM has
      // a constant envelope, so it counts while the audio carries speech.
      if (r.ok) r.sp = r.fm ? speech : r.sbSnr >= 0;
      rf.push(r); if (rf.length > WINDOW) rf.shift();
    }
    if (isFm && typeof ctcss === "function") {
      const t = ctcss();
      tones.push(t && t.snrDb >= 10 ? Math.round(t.toneHz * 10) / 10 : null);
      if (tones.length > WINDOW) tones.shift();
    }
    if (++tick % 10 === 0) compute();
  }

  const sgn = (v, d = 0) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d);
  const khz = (hz) => (hz / 1000).toFixed(1);

  function compute() {
    const out = { rows: [] };
    const okRf = rf.filter((r) => r.ok);
    const rsp = okRf.filter((r) => r.sp);
    const hi = passband ? passband[1] : 5000;
    out.modSec = rsp.length / 10;
    out.ready = out.modSec >= 3;
    out.snr = median(okRf.map((r) => r.snr));
    const rfKeys = isFm ? ["dev", "b99", "off"] : ["depth", "bal", "off"];

    // ── RF measurements ──
    if (rf.length >= 20 && okRf.length < rf.length / 2) {
      const bad = rf.filter((r) => !r.ok);
      const why = bad.some((r) => r.reason === "zoom") ? `zoom the waterfall in on the station (≤ ${isFm ? 400 : 40} Hz per point)`
        : bad.some((r) => r.reason === "zoomout") ? "zoom out a little: FM needs more than ±12 kHz around the station in view"
        : bad.some((r) => r.reason === "clip") ? "carrier too strong for the waterfall scale (clipped): cannot measure"
        : bad.some((r) => r.reason === "weak") ? "signal too weak to measure" : "no waterfall data";
      for (const key of rfKeys) out.rows.push({ key, val: "", lvl: "na", txt: why });
    } else if (!isFm && rsp.length >= 30) {
      // AM. The waterfall averages each trace over ~0.1 s, so the depth is a
      // short-term average: speech peaks read lower than on a scope.
      const ms = rsp.map((r) => 100 * r.m);
      const avg = median(ms), peak = pct(ms, 0.9);
      const lvl = peak > 110 ? "bad" : peak > 100 ? "warn" : peak < 25 ? "warn" : "ok";
      out.rows.push({ key: "depth", val: `avg ${avg.toFixed(0)} % · peak ${peak.toFixed(0)} %`, lvl,
        txt: lvl === "bad" ? "overmodulated" : peak > 100 ? "at the limit (100 %)" : lvl === "warn" ? "low modulation (weak audio)" : "good modulation" });
      const d = median(rsp.map((r) => r.usb - r.lsb));
      const ad = Math.abs(d);
      const lb = ad <= 3 ? "ok" : ad <= 6 ? "warn" : "bad";
      out.rows.push({ key: "bal", val: `USB ${sgn(d, 1)} dB`, lvl: lb,
        txt: lb === "ok" ? "balanced" : lb === "warn" ? "unequal (selective fading, QRM or a TX fault)" : "very unequal (QRM or a TX fault)" });
    }
    if (!isFm && okRf.length >= 20) {
      const off = median(okRf.map((r) => r.off)), res = median(okRf.map((r) => r.hzPerBin));
      const lo = Math.abs(off) <= Math.max(20, res / 2) ? "ok" : "warn";
      out.rows.push({ key: "off", val: `${sgn(off)} Hz`, lvl: lo, txt: lo === "ok" ? "on the dial" : "carrier off the dial (re-tune, or the station is off frequency)" });
    }
    if (isFm && rsp.length >= 30) {
      const b = pct(rsp.map((r) => r.b99), 0.9);
      const edge = rsp.filter((r) => r.edge).length > rsp.length / 3;
      const lw = edge || b > 16000 ? "bad" : "ok";
      out.rows.push({ key: "b99", val: `${edge ? "≥ " : ""}${khz(b)} kHz`, lvl: lw,
        txt: lw === "bad" ? "too wide for a 25 kHz channel" : b <= 11000 ? "fits a 12.5 kHz channel" : "fits a 25 kHz channel" });
      // Carson's rule: B ≈ 2 (Δf + f_audio), with the top of the audio, at most 3 kHz.
      const fa = Math.min(3000, abwTop() || 3000);
      const dev = Math.max(0, b / 2 - fa);
      const lv = edge || dev > 7000 ? "bad" : dev > 5500 ? "warn" : dev < 1000 ? "warn" : "ok";
      out.rows.push({ key: "dev", val: `${edge ? "≥ " : ""}≈ ${khz(dev)} kHz`, lvl: lv,
        txt: lv === "bad" ? "over-deviation" : dev > 5500 ? "high deviation" : dev < 1000 ? "low deviation (quiet audio)"
          : dev <= 3000 ? "narrow FM (12.5 kHz channels)" : "standard FM (25 kHz channels)" });
    }
    if (isFm && okRf.length >= 20) {
      const off = median(okRf.map((r) => r.off));
      const a = Math.abs(off), lo = a <= 300 ? "ok" : a <= 1500 ? "warn" : "bad";
      out.rows.push({ key: "off", val: `${sgn(off)} Hz`, lvl: lo,
        txt: lo === "ok" ? "on frequency" : lo === "warn" ? "a little off frequency" : "off frequency (re-tune)" });
    }

    // ── Audio bandwidth ──
    const top = abwTop();
    if (top != null) {
      const lim = top >= hi - 150;
      const txt = lim ? "limited by the RX filter, widen it to see more"
        : isFm ? (top <= 3300 ? "normal for narrow FM" : "wide audio")
        : top < 3000 ? "narrow (communications audio)" : top <= 5000 ? "typical AM audio" : "wide (hi-fi AM)";
      out.rows.push({ key: "abw", val: `${lim ? "≥ " : ""}${khz(top)} kHz`, lvl: lim ? "na" : "ok", txt });
    }

    // ── CTCSS tone (FM) ──
    if (isFm && tones.length >= 30) {
      const hits = tones.filter((t) => t != null);
      if (hits.length < tones.length / 4) out.rows.push({ key: "tone", val: "", lvl: "na", txt: "none detected" });
      else {
        const cnt = {};
        for (const t of hits) cnt[t] = (cnt[t] || 0) + 1;
        const best = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
        out.tone = Number(best);
        out.rows.push({ key: "tone", val: `${out.tone.toFixed(1)} Hz`, lvl: "ok", txt: "subtone present" });
      }
    }

    // ── Mains hum ──
    if (aud.length >= 30) {
      const lo = passband ? passband[0] : 0;
      // A CTCSS tone next to a hum harmonic is not hum.
      const near = (h) => Number.isFinite(out.tone) && Math.abs(out.tone - h) < 4;
      const frac = (key, hs) => [0, 1, 2].map((i) => near(hs[i]) ? 0 : aud.filter((a) => a[key][i]).length / aud.length);
      const n50 = frac("h50", [50, 100, 150]).filter((v) => v > 0.5).length, n60 = frac("h60", [60, 120, 180]).filter((v) => v > 0.5).length;
      if (lo > 140) out.rows.push({ key: "hum", val: "", lvl: "na", txt: `not measurable: the RX filter cuts below ${Math.round(lo)} Hz` });
      else {
        const hit = n50 >= 2 ? "50" : n60 >= 2 ? "60" : null;
        out.rows.push({ key: "hum", val: hit ? `lines at ${hit === "50" ? "50/100/150" : "60/120/180"} Hz` : "", lvl: hit ? "bad" : "ok",
          txt: hit ? "hum detected (ground, power supply)" : "no hum" });
      }
    }

    // ── Occupied width (AM, from the splatter measurement) ──
    if (!isFm && occupied && occupied.status && occupied.status !== "info" && occupied.text) {
      const w = (occupied.text.match(/([\d.]+) kHz/) || [])[1] || "";
      out.rows.push({ key: "obw", val: w ? `${w} kHz` : "",
        lvl: occupied.status === "ok" ? "ok" : occupied.status === "wide" ? "warn" : "bad",
        txt: occupied.status === "ok" ? "compliant" : occupied.status === "wide" ? "a little wide" : "splatter" });
    }
    rep = out;
    const h = { ...held };
    for (const r of out.rows) h[r.key] = r;
    held = h;
  }

  // Top of the audio: the frequency below which 97 % of the speech power
  // (background noise removed) lies, on the long-term spectrum. Null until
  // 3 s of speech.
  function abwTop() {
    const sp = aud.filter((a) => a.sp);
    if (sp.length < 30 || !nbL) return null;
    const P = new Float64Array(NB);
    for (const a of sp) for (let k = 0; k < NB; k++) P[k] += Math.max(0, Math.pow(10, a.L[k] / 10) - Math.pow(10, nbL[k] / 10));
    let tot = 0;
    for (let k = 1; k < NB; k++) tot += P[k];              // the first bin holds the DC block's rest
    if (!(tot > 0)) return null;
    let c = 0;
    for (let k = 1; k < NB; k++) { c += P[k]; if (c >= 0.97 * tot) return (k + 1) * STEP; }
    return NB * STEP;
  }

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
      if (au && au.pcm.length > au.sr) {
        const wavUrl = await blobToDataUrl(wavBlob(au.pcm, au.sr));
        audioHtml = `<audio controls src="${wavUrl}"></audio>
<p class="n">${(au.pcm.length / au.sr).toFixed(0)} s of raw receiver audio (before any listening processing), level-normalised. <a download="PhantomSDR-${esc(fk.replace(/\s/g, ""))}kHz-${stamp}.wav" href="${wavUrl}">Download the WAV file</a></p>`;
      }
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listening report — ${esc(fk)} kHz ${esc(m)}</title>
<style>body{background:#222;color:#e5e7eb;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px}main{max-width:820px;margin:auto}
h1{color:#fff;font-size:1.4rem;margin:0 0 .2rem}.sub{color:#9ca3af;margin:0 0 1.2rem}.f{font:700 1.6rem monospace;color:#fff}
.m{background:#2563eb;color:#fff;border-radius:4px;padding:0 6px;font-weight:700;margin-left:.4rem}
table{width:100%;border-collapse:collapse;margin:.8rem 0}td{padding:6px 8px;border-top:1px solid #444}.v{font-family:monospace;color:#e5e7eb;white-space:nowrap}
.d{display:inline-block;width:10px;height:10px;border-radius:50%}img{width:100%;border:1px solid #444;border-radius:6px}audio{width:100%;margin-top:.4rem}
.n{color:#9ca3af;font-size:.85rem}a{color:#60a5fa}h2{color:#fff;font-size:1.05rem;margin:1.4rem 0 .3rem}</style></head><body><main>
<h1>Listening report — PhantomSDR+</h1>
<p class="sub">${esc(utc)} · ${esc(location.host)}</p>
<p><span class="f">${esc(fk)} kHz</span><span class="m">${esc(m)}</span></p>
<h2>Audio clip</h2>${audioHtml}
<h2>${isFm ? "FM" : "AM"} report</h2><table>${rows}</table>
${img ? `<h2>${isFm ? "FM" : "AM"} station at the time of the report</h2><img alt="Spectrum" src="${img}"><p class="n">The station as seen on the waterfall: carrier in the centre, cyan line: dial frequency.</p>` : ""}
<p class="n">Indicative measurement over a sliding 20 s window, taken on the RF waterfall (zoomed in) and the receiver audio. Fading, QRM and the receiver's filter affect it.</p>
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
      <span class="sr-title">{isFm ? "FM" : "AM"} report</span>
      <span style="flex:1"></span>
      <button class="sr-btn" on:click={reset} title="Restart the analysis (20 s window)">↺ Restart</button>
      <button class="sr-btn" on:click={fullReport} disabled={building || !Object.keys(held).length}
        title="Download a full listening report (an HTML file to send to the other station): verdicts, spectrum image and the last 20 seconds of audio">{building ? "…" : "🎧 Generate a listening report"}</button>
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
    <div class="sr-line" title="Indicative measurement over a sliding 20 s window, taken on the RF waterfall (zoomed in on the station) and the receiver audio. Fading, QRM and the receiver's filter affect it.">
      {#if !rep || !rep.ready}
        <span>Waiting for modulation…</span>
        <span class="num">{rep ? rep.modSec.toFixed(1) : "0.0"} s / 3 s</span>
        <span>analysed · zoom the waterfall in on the station</span>
      {:else}
        <span>Indicative measurement over a sliding 20 s window, taken on the RF waterfall and the receiver audio. Fading and QRM affect it.</span>
      {/if}
      {#if rep && rep.snr != null && rep.snr < 30 && rep.ready}<span class="weak">Weak signal: reduced reliability.</span>{/if}
    </div>
  </div>
{/if}

<style>
  /* Same look as SsbReport: site default colours, verdict colours keep their meaning. */
  .sr { margin-top: 6px; padding: 6px 8px; border-radius: 4px; border: 1px solid #444; background: #000; position: relative; z-index: 1; }
  .sr-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 4px; }
  .sr-title { font-size: 0.78rem; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
  .sr-btn {
    font-size: 0.68rem; padding: 0.1rem 0.5rem; border-radius: 0.375rem; font-weight: 600; white-space: nowrap;
    color: #fff; border: 1px solid #4b5563; background: #374151;
  }
  .sr-btn:hover:not(:disabled) { background: #4b5563; }
  .sr-btn:disabled { opacity: 0.4; cursor: default; }
  .sr-line {
    font-size: 0.66rem; color: #9ca3af; font-style: italic; display: flex; gap: 0.35rem; align-items: center;
    height: 1.4rem; margin-top: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .sr-line .weak { color: #fcd34d; margin-left: auto; }
  .num { font-family: monospace; font-style: normal; color: #d1d5db; }
  .sr-tab { width: 100%; border-collapse: collapse; font-size: 0.74rem; table-layout: fixed; }
  .sr-tab td { padding: 2px 6px; height: 1.35rem; border-top: 1px solid rgba(255, 255, 255, 0.22); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
