<!--
  Preview of another receiver of this station (HF page → 2 m, 2 m page → HF):
  its whole span as a small spectrum + waterfall, with its markers under it.
  A click opens that receiver's page tuned there, in the same tab.

  It is one waterfall-only socket to the other spectrumserver (/waterfall?rx=),
  so it is not a listener there: it does not show in that receiver's user
  count and spends a socket slot, not a per_ip listener slot. The proxy sets
  its rx cookie on HTTP responses only, never on this socket, so the strip
  cannot pull the page's own requests over to the other receiver.

  Cost is kept down in the browser only (no server change): every frame is
  decoded — the zstd stream needs them all — but only one in FRAME_SKIP is
  drawn, and the socket is closed while the tab is hidden.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { createWaterfallDecoder } from "./wrappers.js";
  import { waterfall as mainWaterfall, wrappersReady } from "./backend.js";
  import getColormap, { computeColormapArray } from "./colormaps.js";
  import { bands } from "../bands-config.js";
  import { isRefusal } from "../refused";
  import { waterfallSocketUrl, receiverTuneUrl, rememberSpan } from "./receivers.js";

  export let receiver;
  export let sameOrigin = false;
  // The main waterfall and spectrum canvases: the strip's waterfall is
  // WF_RATIO of the main one's height, its spectrum SPEC_RATIO (none while
  // the main spectrum is off).
  export let refEl = null;
  export let specRefEl = null;

  const FRAME_SKIP = 1; // draw every frame (was 1 in 3; trying N = 1, 2026-10-15)
  const RETRY_MS = 30000; // after a drop that was not a refusal
  const SNAP_PX = 6; // a click this close to a marker tunes the marker
  const SCALE_H = 30; // CSS px of the marker + frequency row
  const SPEC_RATIO = 0.5; // strip spectrum height / main spectrum height
  const WF_RATIO = 0.9; // strip waterfall height / main waterfall height
  // The receiver page's own defaults (App.svelte: currentColormap,
  // min_waterfall, max_waterfall), so the strip looks as that page does when
  // it opens — not as this page's sliders are set.
  const DEFAULT_COLORMAP = "PhantomSDR";
  const DEFAULT_MIN = -30;
  const DEFAULT_MAX = 110;

  let specCanvas, wfCanvas, scaleCanvas, areaEl;
  let specH = 40;
  let wfH = 100;
  let status = "connecting"; // connecting | live | offline | refused
  let span = null; // { base, bw }: the receiver's whole span
  let view = null; // { base, bw }: what the frames now arriving cover
  let fftResult = 0; // bins in the whole span (fft_result_size)
  // The view the listener left that receiver's page with (App.svelte
  // saveRxView: lo, hi, min, max, f), shown instead of the whole span while
  // useSaved is on.
  let saved = null;
  let useSaved = true;
  let markers = []; // { f, name, mode }, sorted by f
  let hover = null; // { x, hz, marker }

  let socket = null;
  let connecting = false;
  let decoder = null;
  let frameNo = 0;
  let retryTimer = null;
  let destroyed = false;
  let cmap = null; // waterfall palette, 0..255 → RGBA
  let levels = [DEFAULT_MIN, DEFAULT_MAX];
  let specSmooth = null;
  let rowImg = null;
  let resizeObs = null;


  // ── Socket ────────────────────────────────────────────────────────────
  async function connect() {
    if (destroyed || socket || connecting || document.hidden) return;
    clearTimeout(retryTimer);
    connecting = true;
    try {
      await wrappersReady();
    } catch (e) {
      connecting = false;
      status = "offline";
      return;
    }
    connecting = false;
    if (destroyed || socket || document.hidden) return;

    let ws;
    try {
      ws = new WebSocket(waterfallSocketUrl(receiver, sameOrigin));
    } catch (e) {
      status = "offline";
      return;
    }
    ws.binaryType = "arraybuffer";
    socket = ws;
    status = "connecting";
    frameNo = 0;

    ws.onmessage = (ev) => {
      if (socket !== ws) return;
      if (!(ev.data instanceof ArrayBuffer)) {
        onSettings(ev.data);
        return;
      }
      if (!decoder) return;
      let frames;
      try {
        frames = decoder.decode(ev.data);
      } catch (e) {
        return;
      }
      for (const f of frames) {
        if (frameNo++ % FRAME_SKIP === 0) drawFrame(f);
      }
    };
    ws.onclose = (ev) => {
      if (socket !== ws) return;
      socket = null;
      freeDecoder();
      if (isRefusal(ev)) {
        // Kicked or over the per-IP limit there: stay quiet, never retry.
        status = "refused";
        return;
      }
      status = "offline";
      if (!destroyed && !document.hidden) {
        retryTimer = setTimeout(connect, RETRY_MS);
      }
    };
  }

  function disconnect() {
    clearTimeout(retryTimer);
    const ws = socket;
    socket = null;
    freeDecoder();
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
    }
  }

  function freeDecoder() {
    if (decoder) {
      try {
        decoder.destroy();
      } catch (e) {}
      decoder = null;
    }
  }

  function onSettings(text) {
    let s;
    try {
      s = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!s.fft_size) return;
    span = { base: s.basefreq, bw: s.total_bandwidth };
    rememberSpan(receiver.id, span.base, span.bw);
    view = span;
    fftResult = s.fft_result_size || 0;
    saved = readSaved();
    markers = [];
    if (s.markers) {
      try {
        const m = JSON.parse(s.markers);
        if (m && Array.isArray(m.markers)) {
          markers = m.markers
            .filter((x) => Number.isFinite(x.frequency))
            .map((x) => ({ f: x.frequency, name: String(x.name || ""), mode: x.mode || "" }))
            .sort((a, b) => a.f - b.f);
        }
      } catch (e) {}
    }
    decoder = createWaterfallDecoder(s.waterfall_compression);
    specSmooth = null;
    status = "live";
    applyView();
    drawScale();
  }

  function readSaved() {
    let v;
    try {
      v = JSON.parse(localStorage.getItem("rxView:" + receiver.id) || "null");
    } catch (e) {
      return null;
    }
    if (!v || !span) return null;
    const lo = Math.max(Number(v.lo), span.base);
    const hi = Math.min(Number(v.hi), span.base + span.bw);
    if (!(hi > lo)) return null;
    // A view of the whole span is no different from the default one.
    if (hi - lo > span.bw * 0.98) return null;
    const ok = (x) => Number.isFinite(Number(x));
    return {
      lo,
      hi,
      min: ok(v.min) ? Number(v.min) : null,
      max: ok(v.max) ? Number(v.max) : null,
      f: ok(v.f) ? Number(v.f) : null,
      m: typeof v.m === "string" ? v.m : "",
    };
  }

  // Ask for the saved view or the whole span, and set the levels to match:
  // the saved Min/Max with the saved view, the page defaults with the span.
  function applyView() {
    if (!span) return;
    const zoom = useSaved && saved;
    levels =
      zoom && saved.min !== null && saved.max !== null && saved.max > saved.min
        ? [saved.min, saved.max]
        : defaultLevels(span);
    specSmooth = null;
    if (!socket || socket.readyState !== WebSocket.OPEN || !fftResult) return;
    let l = 0;
    let r = fftResult;
    if (zoom) {
      l = Math.max(0, Math.floor(((saved.lo - span.base) / span.bw) * fftResult));
      r = Math.min(fftResult, Math.ceil(((saved.hi - span.base) / span.bw) * fftResult));
    }
    try {
      socket.send(JSON.stringify({ cmd: "window", l, r }));
    } catch (e) {}
  }

  function toggleView() {
    useSaved = !useSaved;
    applyView();
  }

  // ── Drawing ───────────────────────────────────────────────────────────
  // Brightness/contrast as the receiver page opens: its default Min/Max,
  // or the band's own from bands-config.js when one band fills most of the
  // span (2 m: 144–146 MHz of 143.8–146.2). HF's 0–30 MHz is no one band.
  function defaultLevels(sp) {
    for (const b of bands) {
      const lo = Math.max(b.startFreq, sp.base);
      const hi = Math.min(b.endFreq, sp.base + sp.bw);
      if (hi - lo >= sp.bw / 2) {
        const mn = parseInt(b.min);
        const mx = parseInt(b.max);
        if (Number.isFinite(mn) && Number.isFinite(mx) && mx > mn) return [mn, mx];
      }
    }
    return [DEFAULT_MIN, DEFAULT_MAX];
  }

  // The palette the receiver page would open with: the listener's saved
  // choice (shared by every receiver page of this address), else the default.
  function loadColormap() {
    let name = DEFAULT_COLORMAP;
    try {
      name = localStorage.getItem("selectedColormap") || DEFAULT_COLORMAP;
    } catch (e) {}
    try {
      cmap = computeColormapArray(getColormap(name));
    } catch (e) {
      cmap = computeColormapArray(getColormap(DEFAULT_COLORMAP));
    }
  }

  // waterfall.js transformValue(): clamp to Min/Max, 0..255.
  function toIndex(v, lo, hi) {
    const c = Math.max(lo, Math.min(hi, v));
    return Math.max(0, Math.min(255, Math.floor(((c - lo) / (hi - lo)) * 255)));
  }

  function drawFrame(frame) {
    const data = frame && frame.data;
    if (!wfCanvas || !specCanvas || !data || !data.length || !span) return;
    const n = data.length;
    const [lo, hi] = levels;

    // Every frame says which bins it covers (whole-span units). When that
    // changes — the window request took effect — the old rows belong to
    // another range: start the picture afresh and redraw the scale.
    if (fftResult && Number.isFinite(frame.l) && Number.isFinite(frame.r) && frame.r > frame.l) {
      const base = span.base + (frame.l / fftResult) * span.bw;
      const bw = ((frame.r - frame.l) / fftResult) * span.bw;
      if (!view || Math.abs(view.base - base) > 1 || Math.abs(view.bw - bw) > 1) {
        view = { base, bw };
        const c = wfCanvas.getContext("2d");
        c.fillStyle = "#000";
        c.fillRect(0, 0, wfCanvas.width, wfCanvas.height);
        specSmooth = null;
        drawScale();
      }
    }

    // Waterfall: newest row at the top, the picture moving down (the user's
    // choice for the strip, whatever direction the main waterfall runs).
    if (wfCanvas.width !== n) wfCanvas.width = n;
    const wctx = wfCanvas.getContext("2d");
    const h = wfCanvas.height;
    if (h > 1) wctx.drawImage(wfCanvas, 0, 0, n, h - 1, 0, 1, n, h - 1);
    if (!rowImg || rowImg.width !== n) rowImg = wctx.createImageData(n, 1);
    const px = rowImg.data;
    for (let i = 0; i < n; i++) px.set(cmap[toIndex(data[i], lo, hi)], i * 4);
    wctx.putImageData(rowImg, 0, 0);

    // Spectrum, as waterfall.js drawSpectrum(): the 0..255 values smoothed
    // half-and-half with the previous frame, then drawn on that scale.
    if (!specSmooth || specSmooth.length !== n) {
      specSmooth = new Float32Array(n);
      for (let i = 0; i < n; i++) specSmooth[i] = toIndex(data[i], lo, hi);
    }
    for (let i = 0; i < n; i++) specSmooth[i] = 0.5 * toIndex(data[i], lo, hi) + 0.5 * specSmooth[i];
    if (specCanvas.width !== n) specCanvas.width = n;
    const sctx = specCanvas.getContext("2d");
    const sh = specCanvas.height;
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, n, sh);
    const y = (v) => sh - (v / 255) * sh;
    sctx.beginPath();
    sctx.moveTo(0, sh);
    for (let i = 0; i < n; i++) sctx.lineTo(i, y(specSmooth[i]));
    sctx.lineTo(n, sh);
    sctx.closePath();
    sctx.fillStyle = spectrumFill(sctx, sh);
    sctx.fill();
    sctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) sctx.moveTo(0, y(specSmooth[0]));
      else sctx.lineTo(i, y(specSmooth[i]));
    }
    sctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    sctx.lineWidth = 1;
    sctx.stroke();
  }

  // The main spectrum's palette (waterfall.js spectrumColormap), coloured
  // the same way: by height on the canvas, the floor navy, the top red. Every
  // entry becomes a stop, so the canvas gradient reproduces it exactly.
  let fillCache = null;
  function spectrumFill(ctx, h) {
    const map = mainWaterfall && mainWaterfall.spectrumColormap;
    if (fillCache && fillCache.h === h && fillCache.map === map && fillCache.ctx === ctx) {
      return fillCache.g;
    }
    let g;
    if (map && map.length > 1) {
      g = ctx.createLinearGradient(0, h, 0, 0);
      const last = map.length - 1;
      for (let i = 0; i <= last; i++) {
        const c = map[i];
        g.addColorStop(i / last, `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
      }
    } else {
      g = "rgb(0, 158, 255)";
    }
    fillCache = { h, map, ctx, g };
    return g;
  }

  function niceStep(rawHz) {
    const p = Math.pow(10, Math.floor(Math.log10(rawHz)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= rawHz) return m * p;
    return 10 * p;
  }

  function fmtMHz(hz, step) {
    const dec = Math.min(3, Math.max(0, Math.ceil(-Math.log10(step / 1e6) - 1e-9)));
    return (hz / 1e6).toFixed(dec);
  }

  // Marker labels on the top half, frequency ticks on the bottom half.
  // A label that would overlap the one before it is left out; its tick stays.
  function drawScale() {
    if (!scaleCanvas || !view) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = scaleCanvas.clientWidth || 1;
    const W = Math.round(cssW * dpr);
    const H = Math.round(SCALE_H * dpr);
    if (scaleCanvas.width !== W) scaleCanvas.width = W;
    if (scaleCanvas.height !== H) scaleCanvas.height = H;
    const ctx = scaleCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cssW, SCALE_H);
    const xOf = (hz) => ((hz - view.base) / view.bw) * cssW;

    ctx.font = "10px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Frequency ticks.
    const step = niceStep(view.bw / Math.max(2, Math.floor(cssW / 90)));
    ctx.strokeStyle = "rgba(200, 200, 200, 0.6)";
    ctx.fillStyle = "rgba(200, 200, 200, 0.9)";
    for (let f = Math.ceil(view.base / step) * step; f <= view.base + view.bw; f += step) {
      const x = Math.round(xOf(f)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, SCALE_H - 4);
      ctx.lineTo(x, SCALE_H);
      ctx.stroke();
      ctx.fillText(fmtMHz(f, step), x, SCALE_H - 10);
    }

    // Markers.
    let lastRight = -Infinity;
    ctx.strokeStyle = "rgba(255, 209, 102, 0.9)";
    ctx.fillStyle = "#ffd166";
    for (const m of markers) {
      const x = xOf(m.f);
      if (x < 0 || x > cssW) continue;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, 4);
      ctx.stroke();
      const w = ctx.measureText(m.name).width;
      let lx = Math.min(Math.max(x, w / 2 + 1), cssW - w / 2 - 1);
      if (m.name && lx - w / 2 > lastRight + 4) {
        ctx.fillText(m.name, lx, 9);
        lastRight = lx + w / 2;
      }
    }

    // Where the listener was tuned when they left that page.
    if (useSaved && saved && saved.f !== null) {
      const x = xOf(saved.f);
      if (x >= 0 && x <= cssW) {
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.lineTo(x + 5, 0);
        ctx.lineTo(x, 7);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ── Pointer ───────────────────────────────────────────────────────────
  function pointAt(clientX) {
    if (!view || !areaEl) return null;
    const rect = areaEl.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const pxPerHz = rect.width / view.bw;
    let marker = null;
    let best = SNAP_PX;
    for (const m of markers) {
      const d = Math.abs((m.f - view.base) * pxPerHz - x);
      if (d <= best) {
        best = d;
        marker = m;
      }
    }
    let hz;
    if (marker) hz = marker.f;
    else {
      // 12.5 kHz channels above HF; on HF 1 kHz over the whole span (a pixel
      // is ~20 kHz there) and 100 Hz once zoomed in on a band.
      const snap = view.base >= 30e6 ? 12500 : 1 / pxPerHz > 500 ? 1000 : 100;
      hz = Math.round((view.base + (x / rect.width) * view.bw) / snap) * snap;
    }
    return { x: marker ? (marker.f - view.base) * pxPerHz : x, hz, marker };
  }

  function onMove(e) {
    hover = pointAt(e.clientX);
  }

  function onClick(e) {
    const p = pointAt(e.clientX);
    if (!p) return;
    // A marker brings its own mode; anywhere else in the saved view, the mode
    // the listener had there. The page restores the rest of that view itself.
    const inSaved = saved && p.hz >= saved.lo && p.hz <= saved.hi;
    const mode = p.marker ? p.marker.mode : inSaved ? saved.m : "";
    window.location.href = receiverTuneUrl(receiver, p.hz, mode, "view");
  }

  // ── Size ──────────────────────────────────────────────────────────────
  function resize() {
    const ref = refEl && refEl.clientHeight;
    const w = Math.max(60, Math.round((ref || 200) * WF_RATIO));
    if (Math.abs(w - wfH) > 2) wfH = w;
    const sp = specRefEl ? Math.round(specRefEl.clientHeight * SPEC_RATIO) : 40;
    if (sp !== specH) specH = sp;
    // One waterfall row per CSS pixel; keep the history across a resize.
    requestAnimationFrame(() => {
      if (wfCanvas && wfCanvas.height !== wfH) {
        const old = document.createElement("canvas");
        old.width = wfCanvas.width;
        old.height = wfCanvas.height;
        old.getContext("2d").drawImage(wfCanvas, 0, 0);
        wfCanvas.height = wfH;
        const ctx = wfCanvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, wfCanvas.width, wfH);
        // The newest rows are at the top: keep the top of the old picture.
        const keep = Math.min(old.height, wfH);
        ctx.drawImage(old, 0, 0, old.width, keep, 0, 0, old.width, keep);
      }
      if (specCanvas) specCanvas.height = Math.max(1, Math.round(specH * (window.devicePixelRatio || 1)));
      drawScale();
    });
  }

  function onVisibility() {
    if (document.hidden) disconnect();
    else if (status !== "refused") connect();
  }

  onMount(() => {
    loadColormap();
    resize();
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(resize);
      if (refEl) resizeObs.observe(refEl);
      if (specRefEl) resizeObs.observe(specRefEl);
      if (areaEl) resizeObs.observe(areaEl);
    }
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    connect();
  });

  onDestroy(() => {
    destroyed = true;
    disconnect();
    if (resizeObs) resizeObs.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
  });
</script>

<div class="w-full mt-1">
  <div
    class="flex items-center justify-between text-xs px-2 py-0.5"
    style="background:rgba(0,0,0,0.7);color:rgba(0, 225, 255, 0.993)"
  >
    <span>
      {receiver.name}
      {#if status === "live"}
        <span style="color:#aaa">· click to switch</span>
      {:else if status === "connecting"}
        <span style="color:#aaa">· connecting…</span>
      {:else if status === "refused"}
        <span style="color:#ef4444">· not available</span>
      {:else}
        <span style="color:#ef4444">· offline</span>
      {/if}
    </span>
    {#if saved && status === "live"}
      <button
        type="button"
        class="px-2 rounded"
        style="border:1px solid rgba(0, 225, 255, 0.6);color:rgba(0, 225, 255, 0.993)"
        title={useSaved
          ? "Show the whole span of " + receiver.name
          : "Show the view you last had on " + receiver.name}
        on:click={toggleView}
        >{useSaved
          ? (saved.lo / 1e6).toFixed(3) + "–" + (saved.hi / 1e6).toFixed(3) + " MHz · Full span"
          : "Last view"}</button
      >
    {/if}
    {#if hover && status === "live"}
      <span style="color:#ffd166">
        {(hover.hz / 1e6).toFixed(4)} MHz{hover.marker ? " · " + hover.marker.name : ""}
      </span>
    {/if}
  </div>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    bind:this={areaEl}
    class="relative w-full cursor-pointer"
    title={"Open " + receiver.name}
    on:mousemove={onMove}
    on:mouseleave={() => (hover = null)}
    on:click={onClick}
  >
    <canvas
      bind:this={specCanvas}
      class="block w-full bg-black"
      style="height:{specH}px;display:{specH > 0 ? 'block' : 'none'}"
      width="1024"
    ></canvas>
    <canvas
      bind:this={wfCanvas}
      class="block w-full bg-black"
      style="height:{wfH}px"
      width="1024"
    ></canvas>
    <canvas
      bind:this={scaleCanvas}
      class="block w-full bg-black"
      style="height:{SCALE_H}px"
    ></canvas>
    {#if hover && status === "live"}
      <div
        class="pointer-events-none absolute top-0 bottom-0"
        style="left:{hover.x}px;width:0;border-left:1px dashed rgba(255,240,80,0.8)"
      ></div>
    {/if}
  </div>
</div>
