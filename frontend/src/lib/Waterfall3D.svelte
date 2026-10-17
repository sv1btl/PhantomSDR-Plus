<script>
  /**
   * Waterfall3D — the last spectrum lines stacked in relief: frequency across,
   * time into the screen, level as height.
   *
   * Adapted from the 3D spectrum of PhantomSDR-ORSAT by F1NSK
   * (github.com/f1nsk40260/PhantomSDR-ORSAT, GPLv3).
   *
   * All drawing is done by the GPU (WebGL2): the line history is a circular
   * W×H texture updated one row per frame, and the vertex shader reads the
   * height of every mesh point from it. The CPU only resamples each incoming
   * line onto W points.
   *
   * Every row keeps the FFT range it was received with in a small texture, so
   * the shader places it exactly in the visible window — zoom and pan are
   * followed without smearing the history.
   *
   * Hook-up: waterfall.view3d = { pushLine, setColormap, setView }, called by
   * waterfall.js (draw loop, setWaterfallRange, setColormapArray) only while
   * this view is open. Closed, it costs nothing.
   *
   * Mouse events on the view are forwarded to the parent (on:mousedown,
   * on:wheel, on:mousemove, on:mouseleave), which handles them like the 2D
   * spectrum: the front row lines up exactly with the waterfall below, so
   * click-to-tune, drag and wheel zoom all work unchanged.
   */
  import { onMount, onDestroy } from "svelte";

  export let waterfall;          // the waterfall object from lib/backend.js
  export let onClose = () => {};

  const W = 1024;                // history width (frequency points)
  const H = 96;                  // history depth (lines): fewer, taller rows at 190 px
  const GX = 1024, GY = 96;      // displayed mesh

  let canvas, gl, prog, vao, histTex, rangeTex, cmapTex, nIdx = 0;
  let viewL = 0, viewR = 1;      // visible window (FFT indices)
  const hist = new Uint8Array(W * H);
  let head = 0;                  // most recent row
  let ro, raf = 0, failed = "";

  // Geometry, in screen units (-1..1).
  const RISE = 0.9;    // how far the floor climbs from front to back (lower = flatter angle)
  const AMP = 1.7;     // peak height at the front (height only; colour follows the level)
  const K = 0.16;      // perspective: at the back, signals close in on the centre by 1/(1+K)
  const FLOORV = "0.0";   // level outside a row's range (the waterfall's black), as a GLSL literal
  const HPOW = "1.0";     // height curve: linear, so height follows the waterfall's level exactly

  const VS = `#version 300 es
  in vec2 aUV;
  uniform highp usampler2D uHist;
  uniform highp sampler2D uRange;   // per row: range [L, R] in FFT indices
  uniform int uHead;
  uniform vec2 uView;               // visible window [L, R]
  uniform float uRise;
  uniform float uAmp;
  out float vVal;
  out float vAge;
  out float vRow;
  out float vLight;

  // Level (0-1) of a row at position u of the visible window.
  float sampleAt(float u, int age) {
    int row = (uHead - age + ${H}) % ${H};
    vec2 rr = texelFetch(uRange, ivec2(row, 0), 0).rg;
    float idx = uView.x + u * (uView.y - uView.x);
    float t = (idx - rr.x) / max(rr.y - rr.x, 1e-6);
    if (t < 0.0 || t >= 1.0) return ${FLOORV};   // outside the row: noise level
    int x = int(t * float(${W}));
    return float(texelFetch(uHist, ivec2(min(x, ${W - 1}), row), 0).r) / 255.0;
  }

  void main() {
    int age = int(aUV.y * float(${H - 1}) + 0.5);
    float d = aUV.y;                              // 0 = newest row (front)
    // Every row spans the full screen width; the further back, the more
    // frequencies it shows (factor 1/s), so signals converge gently on the
    // centre while the sheet keeps straight edges.
    float s = 1.0 / (1.0 + ${K} * d);
    float sx = aUV.x * 2.0 - 1.0;
    float u = 0.5 + 0.5 * sx / s;
    float v = sampleAt(u, age);
    float du = 1.0 / float(${GX - 1}) / s;
    float vl = sampleAt(u - du, age);
    float vr = sampleAt(u + du, age);
    float vf = sampleAt(u, max(age - 1, 0));
    float vb = sampleAt(u, min(age + 1, ${H - 1}));

    // At the front s = 1: the newest row lines up exactly with the waterfall.
    float sBack = 1.0 / (1.0 + ${K});
    // The noise floor (≈ FLOORV) sits on the bottom edge: no black gap below.
    float ground = -1.0 - pow(${FLOORV}, ${HPOW}) * uAmp + uRise * (1.0 - s) / (1.0 - sBack);
    float amp = uAmp * s;
    float y = ground + pow(v, ${HPOW}) * amp;

    // Lighting from the neighbouring slopes. One light source, from the upper
    // right, like the rest of the console.
    vec3 n = normalize(vec3((pow(vl, ${HPOW}) - pow(vr, ${HPOW})) * amp * 45.0, 1.0, (pow(vf, ${HPOW}) - pow(vb, ${HPOW})) * amp * 25.0));
    // Shaded sides keep 75 % (was 50 %), so the relief stays bright.
    vLight = 0.75 + 0.25 * max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0);

    vVal = v;
    vAge = d;
    vRow = aUV.y * float(${GY - 1});
    gl_Position = vec4(sx, y, d * 0.98, 1.0);
  }`;

  const FS = `#version 300 es
  precision mediump float;
  in float vVal;
  in float vAge;
  in float vRow;
  in float vLight;
  uniform sampler2D uCmap;     // the waterfall's palette: same colours as the waterfall
  out vec4 frag;

  void main() {
    vec3 base = texture(uCmap, vec2(vVal, 0.5)).rgb;
    vec3 c = base * vLight;
    // A faint line every fourth row: the wire-frame look.
    float r = vRow * 0.25;
    float g = min(fract(r), 1.0 - fract(r));
    float line = 1.0 - smoothstep(0.0, fwidth(r) * 1.2, g);
    c += line * 0.10 * vec3(0.7, 0.85, 1.0);
    c *= 1.0 - 0.15 * vAge;                 // the past fades gently (15 % at the back)
    c *= 1.18;                              // overall lift, closer to the 2D spectrum
    frag = vec4(min(c, vec3(1.0)), 1.0);
  }`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  let uLoc = {};
  function initGL() {
    // preserveDrawingBuffer: the video recorder copies this canvas outside
    // our render frame, which would otherwise read back an empty buffer.
    gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for (const n of ["uHist", "uCmap", "uRange", "uView", "uHead", "uRise", "uAmp"])
      uLoc[n] = gl.getUniformLocation(prog, n);

    // GX×GY mesh (u,v coordinates) + triangle indices.
    const uv = new Float32Array(GX * GY * 2);
    for (let j = 0, k = 0; j < GY; j++)
      for (let i = 0; i < GX; i++) { uv[k++] = i / (GX - 1); uv[k++] = j / (GY - 1); }
    const idx = new Uint32Array((GX - 1) * (GY - 1) * 6);
    for (let j = 0, k = 0; j < GY - 1; j++)
      for (let i = 0; i < GX - 1; i++) {
        const a = j * GX + i, b = a + 1, c = a + GX, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    nIdx = idx.length;
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aUV");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    // History: 8-bit integer texture (exact reads with texelFetch).
    histTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, histTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, W, H, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, hist);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    rangeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rangeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, H, 1, 0, gl.RG, gl.FLOAT, new Float32Array(H * 2));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    cmapTex = gl.createTexture();
    setColormap(waterfall && waterfall.colormap);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.01, 0.02, 0.07, 1);
  }

  /** Waterfall palette: 256 RGBA colours. */
  function setColormap(cm) {
    if (!gl || !cm || !cm.length) return;
    loadCmap(cmapTex, cm);
  }

  function loadCmap(tex, cm) {
    const px = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) px.set(cm[Math.floor((i * cm.length) / 256)], i * 4);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    schedule();
  }

  /** New line: palette indices 0-255 covering FFT indices [l, r]. */
  const line = new Uint8Array(W);
  const times = new Float64Array(H);   // arrival time of every row
  // Scale marks over the view (recomputed 4 times a second).
  let dbMarks = [], timeMarks = [], lastMarks = 0;
  const norm = new Float32Array(W), prev = new Float32Array(W);
  let havePrev = false, prevL = 0, prevR = 0;
  const rng = new Float32Array(2);
  function pushLine(arr, l, r) {
    if (!gl || !arr || !arr.length || !(r > l)) return;
    if (l !== prevL || r !== prevR) { havePrev = false; prevL = l; prevR = r; }
    const n = arr.length;
    for (let x = 0; x < W; x++) {
      const i0 = Math.floor((x * n) / W);
      const i1 = Math.max(i0 + 1, Math.floor(((x + 1) * n) / W));
      let m = 0;
      for (let i = i0; i < i1 && i < n; i++) if (arr[i] > m) m = arr[i];   // max keeps thin carriers
      line[x] = m;
    }
    // The levels are the waterfall's own (Min/Max sliders and Auto Adj.
    // already applied by waterfall.js), mapped straight to height and colour,
    // so the 3D view brightens, darkens and levels exactly like the waterfall.
    for (let x = 0; x < W; x++) norm[x] = line[x] / 255;
    // No smoothing across frequency (keeps narrow signals sharp); a light
    // 10 % carry-over in time steadies the noise floor. (An unsharp mask was
    // tried and removed: it tore the ridges into jagged, shimmering spikes.)
    for (let x = 0; x < W; x++) {
      let v = norm[x];
      if (havePrev) v = 0.9 * v + 0.1 * prev[x];
      prev[x] = v;
      line[x] = Math.round(v * 255);
    }
    havePrev = true;
    head = (head + 1) % H;
    times[head] = performance.now();
    gl.bindTexture(gl.TEXTURE_2D, histTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, head, W, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, line);
    rng[0] = l; rng[1] = r;
    gl.bindTexture(gl.TEXTURE_2D, rangeTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, head, 0, 1, 1, gl.RG, gl.FLOAT, rng);
    schedule();
  }

  /** Zoom / pan: new visible window (FFT indices). */
  function setView(l, r) {
    if (!(r > l)) return;
    viewL = l; viewR = r;
    schedule();
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(render); }

  // ── Scale marks: same formulas as the vertex shader, in JavaScript ──
  const fl = Math.pow(Number(FLOORV), Number(HPOW));
  const sOf = (d) => 1 / (1 + K * d);
  const sBack = 1 / (1 + K);
  const groundOf = (d) => -1 - fl * AMP + RISE * (1 - sOf(d)) / (1 - sBack);
  const pct = (y) => ((1 - y) / 2) * 100;          // screen y (-1..1) → % from the top

  function updateMarks() {
    // dB above the Min (brightness) level, on the newest row (front, right).
    // Hidden under Auto Adj.: its level remap is not a fixed dB scale.
    const db = [];
    const span = waterfall ? waterfall.maxWaterfall - waterfall.minWaterfall : 0;
    if (waterfall && !waterfall.autoAdjust && span > 0 && canvas) {
      // Step so the labels sit at least 14 px apart.
      const pxPerDb = (AMP / span) * (canvas.clientHeight / 2);
      const step = [10, 20, 30, 50].find((st) => st * pxPerDb >= 14) || 100;
      for (let k = step; k < span; k += step) {
        const v = k / span;
        if (v >= 1) break;
        const y = groundOf(0) + Math.pow(Math.max(v, 0), Number(HPOW)) * AMP;
        if (y > 0.7) break;   // keep clear of the ✕ 2D button
        db.push({ k, top: pct(y) });
      }
    }
    dbMarks = db;

    // Time marks into the depth (−5 s, −10 s…), on the left.
    const tm = [];
    const now = times[head];
    let oldest = 0;
    for (let a = H - 1; a > 0; a--) { const t = times[(head - a + H) % H]; if (t > 0) { oldest = a; break; } }
    if (now > 0 && oldest > 4) {
      const total = (now - times[(head - oldest + H) % H]) / 1000;
      const step = [1, 2, 5, 10, 15, 30, 60, 120].find((st) => total / st <= 5) || 300;
      let a = 1;
      for (let sec = step; sec < total; sec += step) {
        while (a < oldest && (now - times[(head - a + H) % H]) / 1000 < sec) a++;
        const d = a / (H - 1);
        const y = groundOf(d) + fl * AMP * sOf(d);
        tm.push({ sec, top: pct(y) });
      }
    }
    timeMarks = tm;
  }

  function render() {
    raf = 0;
    const tnow = performance.now();
    if (tnow - lastMarks > 250) { lastMarks = tnow; updateMarks(); }
    if (!gl) return;
    // The view can open (remembered from last visit) before the waterfall has
    // a window: take the live one whenever it is valid.
    if (waterfall && waterfall.waterfallR > waterfall.waterfallL) {
      viewL = waterfall.waterfallL; viewR = waterfall.waterfallR;
    }
    if (!(viewR > viewL)) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, histTex);
    gl.uniform1i(uLoc.uHist, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cmapTex);
    gl.uniform1i(uLoc.uCmap, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, rangeTex);
    gl.uniform1i(uLoc.uRange, 2);
    gl.uniform2f(uLoc.uView, viewL, viewR);
    gl.uniform1i(uLoc.uHead, head);
    gl.uniform1f(uLoc.uRise, RISE);
    gl.uniform1f(uLoc.uAmp, AMP);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    schedule();
  }

  onMount(() => {
    try {
      initGL();
    } catch (err) {
      failed = "The 3D view needs WebGL2, which this browser does not offer.";
      console.warn("Waterfall3D:", err);
      return;
    }
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (waterfall) waterfall.view3d = { pushLine, setColormap, setView };
  });

  onDestroy(() => {
    if (waterfall && waterfall.view3d && waterfall.view3d.pushLine === pushLine) waterfall.view3d = null;
    if (ro) ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
    const ext = gl && gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
    gl = null;
  });

  /** The WebGL canvas, for the video recorder. */
  export function getCanvas() { return canvas; }

  /** Paint the scale marks (HTML on screen) into a recorded frame: the
   *  canvas was drawn at (x, y) with size w×h. */
  export function drawOverlay(ctx, x, y, w, h) {
    if (!canvas || !canvas.clientHeight) return;
    const k = h / canvas.clientHeight;          // CSS px → frame px
    ctx.save();
    ctx.font = `${Math.round(10 * k)}px sans-serif`;
    ctx.textBaseline = "middle";
    for (const m of timeMarks) {
      const yy = y + (m.top / 100) * h;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
      ctx.setLineDash([4 * k, 3 * k]);
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      ctx.fillStyle = "rgba(165, 243, 252, 0.85)";
      ctx.textAlign = "left";
      ctx.fillText(`−${m.sec} s`, x + 8 * k, yy);
    }
    ctx.setLineDash([]);
    for (const m of dbMarks) {
      const yy = y + (m.top / 100) * h;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
      ctx.beginPath(); ctx.moveTo(x + w - 46 * k, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      ctx.fillStyle = "rgba(165, 243, 252, 0.9)";
      ctx.textAlign = "right";
      ctx.fillText(`+${m.k} dB`, x + w - 6 * k, yy - 7 * k);
    }
    ctx.restore();
  }

  // Keep the tool buttons from starting a tune/drag in the parent.
  const stop = (e) => e.stopPropagation();
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="w3d"
  title="Click to tune, drag to move, wheel to zoom"
  on:mousedown
  on:wheel
  on:mousemove
  on:mouseleave
>
  <canvas bind:this={canvas} class="w3d-canvas"></canvas>
  <div class="w3d-glass"></div>
  {#if failed}<div class="w3d-msg">{failed}</div>{/if}
  <!-- Scale marks: time into the depth (left), dB above the noise (right) -->
  {#each timeMarks as m (m.sec)}
    <div class="w3d-tline" style="top:{m.top}%"><span>−{m.sec} s</span></div>
  {/each}
  {#each dbMarks as m (m.k)}
    <div class="w3d-db" style="top:{m.top}%"><span>+{m.k} dB</span></div>
  {/each}
  <div class="w3d-tools" on:mousedown={stop} on:wheel={stop} on:mousemove={stop}>
    <button class="w3d-btn" on:click={onClose} title="Back to the 2D spectrum">✕ 2D</button>
  </div>
</div>

<style>
  .w3d {
    position: absolute; inset: 0; z-index: 20;
    background: #02040f; cursor: crosshair; overflow: hidden;
  }
  .w3d-canvas { width: 100%; height: 100%; display: block; }

  /* The display is glazed and cut into the metal, like .recess-window: light
     from the upper right, so the top and right walls fall into shadow and the
     bottom and left walls catch it; a faint sheen falls away from the upper
     right across the glass. */
  .w3d-glass {
    position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(
      215deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.012) 24%,
      rgba(255, 255, 255, 0) 45%
    );
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.92),
      inset 0 7px 9px -7px rgba(0, 0, 0, 0.95),
      inset -7px 0 9px -7px rgba(0, 0, 0, 0.85),
      inset 0 -1px 0 rgba(255, 255, 255, 0.13),
      inset 1px 0 0 rgba(255, 255, 255, 0.08);
  }

  .w3d-tools {
    position: absolute; top: 8px; right: 10px; display: flex; gap: 6px;
    cursor: default;
  }
  /* Small machined plates: lit edge on the top/right, shade on the bottom/left. */
  .w3d-btn {
    padding: 2px 9px; border-radius: 5px; font-size: 11px; font-weight: 600;
    color: rgb(34, 211, 238);
    background:
      linear-gradient(215deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0) 60%),
      #1b2129;
    border: 1px solid rgba(0, 0, 0, 0.85);
    box-shadow:
      inset -1px 1px 0 rgba(255, 255, 255, 0.14),
      inset 1px -1px 0 rgba(0, 0, 0, 0.5),
      -1px 2px 3px rgba(0, 0, 0, 0.6);
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .w3d-btn:hover { background-color: #232b35; color: rgb(103, 232, 249); }
  .w3d-btn:active {
    box-shadow: inset 1px -1px 0 rgba(255, 255, 255, 0.08), inset -1px 2px 3px rgba(0, 0, 0, 0.7);
  }

  .w3d-tline {
    position: absolute; left: 0; right: 0; height: 0; pointer-events: none;
    border-top: 1px dashed rgba(34, 211, 238, 0.22);
  }
  .w3d-tline span {
    position: absolute; left: 8px; top: -8px; font-size: 10px; line-height: 1;
    color: rgba(165, 243, 252, 0.85); background: rgba(2, 4, 15, 0.6);
    padding: 1px 3px; border-radius: 3px;
  }
  .w3d-db {
    position: absolute; right: 0; width: 46px; height: 0; pointer-events: none;
    border-top: 1px solid rgba(34, 211, 238, 0.4);
  }
  .w3d-db span {
    position: absolute; right: 6px; top: -13px; font-size: 10px; line-height: 1;
    color: rgba(165, 243, 252, 0.9); text-shadow: 0 0 3px #000;
  }
  .w3d-msg {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: rgb(34, 211, 238); font-size: 13px;
  }
</style>
