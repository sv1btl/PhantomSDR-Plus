<script>
  // IQ demodulators: several receivers inside the 12 kHz IQ stream, each with
  // its own offset, mode, filter, level and pan (the engine is lib/iqDemod.js,
  // fed by audio.js). Shown while the receiver is in IQ. The picture is the
  // 12 kHz around the dial; click it to move the selected demodulator, turn
  // the wheel over it to nudge it (Shift = 100 Hz steps).
  import { onMount, onDestroy } from "svelte";
  import { MAX_DEMODS, DEMOD_MODES, DEMOD_COLORS, BW_RANGE } from "./iqDemod.js";

  export let audio;
  /** Dial frequency in kHz (the centre of the IQ stream). */
  export let dialKhz = 0;

  const STORE_KEY = "phantom.iqdemod.v1";
  const HEIGHT = 120;
  const SPAN = 12000;          // Hz shown, centred on the dial

  let bank = null;
  let demods = [];             // configs, as the bank reports them
  let selected = null;         // id
  let listening = true;
  let levels = {};
  let canvas, raf = 0, lastDraw = 0, lastW = 0;
  let floorDb = null;

  const colorOf = (d) => DEMOD_COLORS[demods.indexOf(d) % DEMOD_COLORS.length];
  const khz = (off) => (Number(dialKhz) + off / 1000).toFixed(3);

  // Passband [lo, hi] in Hz relative to the dial, as the engine filters it.
  function passband(d) {
    switch (d.mode) {
      case "USB": return [d.offset + 50, d.offset + d.bw];
      case "LSB": return [d.offset - d.bw, d.offset - 50];
      default:    return [d.offset - d.bw / 2, d.offset + d.bw / 2];
    }
  }

  function refresh() {
    demods = bank.configs();
    if (!demods.some((d) => d.id === selected)) selected = demods.length ? demods[0].id : null;
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ listening, demods: bank.configs() }));
    } catch (e) { /* private window: settings just are not kept */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && Array.isArray(s.demods)) {
        bank.load(s.demods.map(({ id, ...c }) => c));
        listening = s.listening !== false;
        return true;
      }
    } catch (e) { /* ignore a damaged entry */ }
    return false;
  }

  function add(offset = 0) {
    const sel = demods.find((d) => d.id === selected);
    const id = bank.add({ mode: sel ? sel.mode : "AM", offset });
    if (id != null) selected = id;
    refresh();
  }

  function remove(id) {
    bank.remove(id);
    refresh();
  }

  function set(id, patch) {
    bank.update(id, patch);
    refresh();
  }

  function setListening(v) {
    listening = v;
    bank.listening = v;
    save();
  }

  // ── picture ──────────────────────────────────────────────────────────────
  const xToHz = (x, w) => Math.round(((x / w) * SPAN - SPAN / 2) / 10) * 10;

  function canvasClick(e) {
    const r = canvas.getBoundingClientRect();
    const hz = Math.max(-6000, Math.min(6000, xToHz(e.clientX - r.left, r.width)));
    if (selected == null) add(hz);
    else set(selected, { offset: hz });
  }

  function canvasWheel(e) {
    if (selected == null) return;
    e.preventDefault();
    const d = demods.find((x) => x.id === selected);
    const step = e.shiftKey ? 100 : 10;
    set(selected, { offset: Math.round(d.offset / step) * step + (e.deltaY < 0 ? step : -step) });
  }

  function draw(t) {
    raf = requestAnimationFrame(draw);
    if (!canvas || !bank || t - lastDraw < 66) return;     // ~15 frames/s
    lastDraw = t;
    levels = bank.levels();
    const sp = bank.spectrum();
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    if (!cssW) return;
    const w = Math.round(cssW * dpr), h = Math.round(HEIGHT * dpr);
    if (w !== lastW) { canvas.width = w; canvas.height = h; lastW = w; }
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const xOf = (hz) => ((hz + SPAN / 2) / SPAN) * w;

    // grid: every 2 kHz, labelled with the real frequency
    ctx.font = `${10 * dpr}px monospace`;
    ctx.textAlign = "center";
    for (let hz = -6000; hz <= 6000; hz += 2000) {
      const x = xOf(hz);
      ctx.strokeStyle = hz === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h - 12 * dpr); ctx.stroke();
      if (hz > -6000 && hz < 6000) {
        ctx.fillStyle = "rgba(200,220,255,0.6)";
        ctx.fillText(khz(hz), x, h - 2 * dpr);
      }
    }

    // passbands under the trace
    for (const d of demods) {
      const [lo, hi] = passband(d);
      const col = colorOf(d);
      ctx.globalAlpha = d.id === selected ? 0.28 : 0.14;
      ctx.fillStyle = col;
      ctx.fillRect(xOf(lo), 0, Math.max(1, xOf(hi) - xOf(lo)), h - 12 * dpr);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = (d.id === selected ? 2 : 1) * dpr;
      ctx.beginPath(); ctx.moveTo(xOf(d.offset), 0); ctx.lineTo(xOf(d.offset), h - 12 * dpr); ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (sp) {
      const n = sp.db.length;
      const sorted = Float32Array.from(sp.db).sort();
      const med = sorted[n >> 1];
      floorDb = floorDb === null ? med : floorDb + 0.1 * (med - floorDb);
      const lo = floorDb - 6, range = 60, top = h - 14 * dpr;
      ctx.strokeStyle = "rgba(220,235,255,0.9)";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = top - Math.max(0, Math.min(1, (sp.db[i] - lo) / range)) * (top - 4 * dpr);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const levelPct = (id) => {
    const v = levels[id];
    // The IQ stream holds band noise near −45 dBFS and stations near −20,
    // so −60…−10 dBFS spans an empty passband to a strong station.
    return v == null ? 0 : Math.max(0, Math.min(100, ((v + 60) / 50) * 100));
  };

  onMount(() => {
    bank = audio.getIQDemodBank();
    if (bank.demods.length) {
      listening = bank.listening;          // back in IQ: as it was left
    } else {
      if (!load()) bank.add({ mode: "AM", offset: 0 });
      bank.listening = listening;
    }
    refresh();
    raf = requestAnimationFrame(draw);
  });
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel">
  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
    <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
      <span class="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
      IQ Demodulators
      <span class="text-xs text-gray-400 font-normal">{demods.length} of {MAX_DEMODS}</span>
    </h4>
    <div class="flex items-center gap-1">
      <button
        title="Hear the demodulators below"
        class="text-xs px-2 py-0.5 rounded border transition-colors {listening
          ? 'bg-cyan-700 border-cyan-500 text-white'
          : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}"
        on:click={() => setListening(true)}>Demodulators</button
      >
      <button
        title="Hear the raw I/Q: I left, Q right"
        class="text-xs px-2 py-0.5 rounded border transition-colors {!listening
          ? 'bg-cyan-700 border-cyan-500 text-white'
          : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}"
        on:click={() => setListening(false)}>Raw I/Q</button
      >
      <button
        title="Add a demodulator at the dial"
        class="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700 transition-colors disabled:opacity-40"
        disabled={demods.length >= MAX_DEMODS}
        on:click={() => add(0)}>+ Add</button
      >
    </div>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <canvas
    bind:this={canvas}
    class="w-full rounded border border-gray-700 cursor-crosshair block"
    style="height:{HEIGHT}px"
    title="Click: move the selected demodulator here · wheel: 10 Hz (Shift 100 Hz)"
    on:click={canvasClick}
    on:wheel={canvasWheel}
  ></canvas>

  <div class="mt-2 flex flex-col gap-1">
    {#each demods as d (d.id)}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="rounded border px-2 py-1 {d.id === selected ? 'border-gray-500 bg-gray-800/60' : 'border-gray-800'}"
        on:click={() => (selected = d.id)}
      >
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="inline-block w-3 h-3 rounded-full" style="background:{colorOf(d)}"></span>
          <select
            class="glass-select text-white text-xs px-1 py-0.5 rounded"
            value={d.mode}
            on:change={(e) => set(d.id, { mode: e.currentTarget.value, bw: null })}
            title="Mode"
          >
            {#each DEMOD_MODES as m}<option value={m}>{m}</option>{/each}
          </select>
          <button class="px-1 rounded bg-gray-700 hover:bg-gray-600 text-white" title="−100 Hz"
            on:click|stopPropagation={() => set(d.id, { offset: d.offset - 100 })}>«</button>
          <button class="px-1 rounded bg-gray-700 hover:bg-gray-600 text-white" title="−10 Hz"
            on:click|stopPropagation={() => set(d.id, { offset: d.offset - 10 })}>‹</button>
          <span class="font-mono text-cyan-300 w-24 text-center" title="{d.offset >= 0 ? '+' : ''}{d.offset} Hz from the dial"
            >{khz(d.offset)}</span>
          <button class="px-1 rounded bg-gray-700 hover:bg-gray-600 text-white" title="+10 Hz"
            on:click|stopPropagation={() => set(d.id, { offset: d.offset + 10 })}>›</button>
          <button class="px-1 rounded bg-gray-700 hover:bg-gray-600 text-white" title="+100 Hz"
            on:click|stopPropagation={() => set(d.id, { offset: d.offset + 100 })}>»</button>
          <div class="flex-1 min-w-[3rem] h-1.5 rounded bg-gray-800 overflow-hidden" title="Level in the passband">
            <div class="h-full" style="width:{levelPct(d.id)}%; background:{colorOf(d)}"></div>
          </div>
          <button
            class="px-1.5 rounded {d.mute ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            title={d.mute ? "Unmute" : "Mute"}
            on:click|stopPropagation={() => set(d.id, { mute: !d.mute })}>M</button
          >
          <button class="px-1.5 rounded bg-gray-700 hover:bg-red-700 text-gray-200" title="Remove"
            on:click|stopPropagation={() => remove(d.id)}>✕</button>
        </div>
        {#if d.id === selected}
          <div class="grid grid-cols-3 gap-3 mt-1.5 text-[11px] text-gray-400">
            <label class="flex flex-col">
              <span>Width {(d.bw / 1000).toFixed(2)} kHz</span>
              <input type="range" class="glass-slider" min={BW_RANGE[d.mode][0]} max={BW_RANGE[d.mode][1]} step="50"
                value={d.bw} on:input={(e) => set(d.id, { bw: +e.currentTarget.value })} />
            </label>
            <label class="flex flex-col">
              <span>Volume {Math.round(d.vol * 100)} %</span>
              <input type="range" class="glass-slider" min="0" max="2" step="0.05"
                value={d.vol} on:input={(e) => set(d.id, { vol: +e.currentTarget.value })} />
            </label>
            <label class="flex flex-col">
              <span>Pan {d.pan === 0 ? "centre" : d.pan < 0 ? `left ${Math.round(-d.pan * 100)} %` : `right ${Math.round(d.pan * 100)} %`}</span>
              <input type="range" class="glass-slider" min="-1" max="1" step="0.1"
                value={d.pan} on:input={(e) => set(d.id, { pan: +e.currentTarget.value })} />
            </label>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="text-[11px] text-gray-500 mt-2">
    Each demodulator listens somewhere in the 12 kHz around the dial, in its own mode, without retuning the receiver; they move with the dial. Recording in IQ records the I/Q itself, not these.
  </div>
</div>
