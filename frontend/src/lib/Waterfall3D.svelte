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
   * spectrum: the front row lines up exactly with the waterfall below. For
   * clicks and hover further back, pick() finds the row under the pointer
   * and gives the frequency there as a front-row x position.
   */
  import { onMount, onDestroy } from "svelte";

  export let waterfall;          // the waterfall object from lib/backend.js
  export let onClose = () => {};

  const W = 1024;                // history width (frequency points; the server sends at most 1024)
  const H = 320;                 // history depth (lines): more rows = slower motion, longer history
  const GX = 1024, GY = 320;     // displayed mesh (GY must equal H)

  let canvas, gl, prog, vao, histTex, rangeTex, cmapTex, nIdx = 0;
  let viewL = 0, viewR = 1;      // visible window (FFT indices)
  // Two levels per point: [height, colour]. The height level is shaped
  // (SHARPEN, max over merged bins, 10 % time carry); the colour level is the
  // waterfall's own, untouched, so every point has the waterfall's colour.
  const hist = new Uint8Array(W * H * 2);
  const ranges = new Float64Array(H * 2);   // CPU copy of every row's range, for pick()
  let head = 0;                  // most recent row
  let ro, raf = 0, failed = "";

  // Geometry, in screen units (-1..1).
  const AMP = 1.3;     // peak height at the front (height only; colour follows the level)
  // Angle and depth are set by the ⚙ sliders (remembered per browser);
  // these are the defaults.
  const ANGLE0 = 1.5;  // how far the floor climbs from front to back (lower = flatter angle)
  const DEPTH0 = 0.5;  // 0 = flat-on, 1 = strongest depth
  let angle = ANGLE0, depth = DEPTH0;
  try {
    const g = JSON.parse(localStorage.getItem("view3dGeom") || "null");
    if (g && g.angle >= 0.3 && g.angle <= 1.6) angle = g.angle;
    if (g && g.depth >= 0 && g.depth <= 1) depth = g.depth;
  } catch (e) {}
  let K, BACKH, RISE, angleMax = 1.6;
  $: {
    K = Math.max(0.6 * depth, 0.01);   // perspective: at the back, signals close in on the centre by 1/(1+K); never 0 (the floor rise divides by it)
    BACKH = 1 - depth;   // extra height drop: back-row peaks are this fraction of the perspective height (1 = none)
    // The steepest angle at which a full-level peak on the back row (height
    // AMP·BACKH/(1+K)) still ends at the top edge instead of running off it;
    // it is also the Angle slider's top, so the slider has no dead end.
    angleMax = Math.max(0.3, Math.min(1.6, 2 - AMP * BACKH / (1 + K)));
    if (angle > angleMax) angle = angleMax;
    RISE = angle;
    lastMarks = 0;
    schedule();
    try { localStorage.setItem("view3dGeom", JSON.stringify({ angle, depth })); } catch (e) {}
  }
  let showGeom = false;
  function resetGeom() { angle = ANGLE0; depth = DEPTH0; }
  const FLOORV = "0.0";   // level outside a row's range (the waterfall's black), as a GLSL literal
  const SHARPEN = 0.7;    // column sharpening across frequency: lowers a peak's sides, never lifts the peak (0 = off)
  const HPOW = "2.0";     // height curve: squared, so weak signals stay low and strong ones stand out

  const VS = `#version 300 es
  in vec2 aUV;
  uniform highp usampler2D uHist;
  uniform highp sampler2D uRange;   // per row: range [L, R] in FFT indices
  uniform int uHead;
  uniform vec2 uView;               // visible window [L, R]
  uniform float uRise;
  uniform float uK;                 // perspective (see K)
  uniform float uBackH;             // back-row height fraction (see BACKH)
  uniform float uAmp;
  out float vVal;

  // Levels (0-1) of a row at position u of the visible window: x = height, y = colour.
  vec2 sampleAt(float u, int age) {
    int row = (uHead - age + ${H}) % ${H};
    vec2 rr = texelFetch(uRange, ivec2(row, 0), 0).rg;
    float idx = uView.x + u * (uView.y - uView.x);
    // A row recorded at a much wider range (before a zoom in) holds only a
    // few coarse points here and would show as a bright smeared band: floor.
    if (rr.y - rr.x > 1.5 * (uView.y - uView.x)) return vec2(${FLOORV});
    float t = (idx - rr.x) / max(rr.y - rr.x, 1e-6);
    if (t < 0.0 || t >= 1.0) return vec2(${FLOORV});   // outside the row: noise level
    int x = int(t * float(${W}));
    return vec2(texelFetch(uHist, ivec2(min(x, ${W - 1}), row), 0).rg) / 255.0;
  }

  void main() {
    int age = int(aUV.y * float(${H - 1}) + 0.5);
    float d = aUV.y;                              // 0 = newest row (front)
    // Every row shows exactly the visible window; the further back, the
    // narrower it is drawn (factor s), so the sheet tapers to the back like
    // a table seen at an angle and every frequency runs in a straight line
    // towards the centre.
    float s = 1.0 / (1.0 + uK * d);
    float u = aUV.x;
    float sx = (u * 2.0 - 1.0) * s;
    vec2 hc = sampleAt(u, age);
    float v = hc.x;

    // At the front s = 1: the newest row lines up exactly with the waterfall.
    float sBack = 1.0 / (1.0 + uK);
    // The noise floor (≈ FLOORV) sits on the bottom edge: no black gap below.
    float ground = -1.0 - pow(${FLOORV}, ${HPOW}) * uAmp + uRise * (1.0 - s) / (1.0 - sBack);
    // Heights shrink with the perspective and, on top of that, fall
    // linearly to BACKH at the back row, for a deeper look.
    float amp = uAmp * s * mix(1.0, uBackH, d);
    float y = ground + pow(v, ${HPOW}) * amp;

    // No lighting: the depth comes from the shape alone, and the colour is
    // the waterfall's own level, so every point has the waterfall's colour.
    vVal = hc.y;
    gl_Position = vec4(sx, y, d * 0.98, 1.0);
  }`;

  const FS = `#version 300 es
  precision mediump float;
  in float vVal;
  uniform sampler2D uCmap;     // the waterfall's palette: same colours as the waterfall
  out vec4 frag;

  void main() {
    // Exactly the waterfall's colour for this level: the palette entry itself,
    // with no lighting, fade, grid lines or lift on top.
    int i = int(clamp(vVal, 0.0, 1.0) * 255.0 + 0.5);
    frag = vec4(texelFetch(uCmap, ivec2(i, 0), 0).rgb, 1.0);
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
    // No antialiasing: it averages neighbouring triangles' colours at their
    // edges, and with this dense mesh that turned a third of the sheet into
    // in-between shades. Without it every pixel is a waterfall palette colour.
    gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for (const n of ["uHist", "uCmap", "uRange", "uView", "uHead", "uRise", "uK", "uBackH", "uAmp"])
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

    // History: two 8-bit integer channels, height and colour (exact reads with texelFetch).
    histTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, histTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8UI, W, H, 0, gl.RG_INTEGER, gl.UNSIGNED_BYTE, hist);
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
  const line = new Uint8Array(W * 2);   // [height, colour] per point
  const times = new Float64Array(H);   // arrival time of every row
  // Scale marks over the view (recomputed 4 times a second).
  let dbMarks = [], timeMarks = [], lastMarks = 0;
  const norm = new Float32Array(W), prev = new Float32Array(W);
  const col = new Uint8Array(W);      // colour level: the waterfall's own level of the bin that sets the height
  let src = new Float32Array(W);      // the sharpened line at the server's resolution
  let havePrev = false, prevL = 0, prevR = 0;
  const rng = new Float32Array(2);
  function pushLine(arr, l, r) {
    if (!gl || !arr || !arr.length || !(r > l)) return;
    if (l !== prevL || r !== prevR) { havePrev = false; prevL = l; prevR = r; }
    const n = arr.length;
    // The levels are the waterfall's own (Min/Max sliders and Auto Adj.
    // already applied by waterfall.js), so the 3D view brightens, darkens and
    // levels exactly like the waterfall. The colour takes them as they are
    // (the unsharpened level of the bin that sets the height); only the
    // height is shaped.
    // Columns are sharpened across frequency at the server's own resolution,
    // before the line is stretched to W points, so each point is compared
    // with its real neighbours (zoomed in, the server sends fewer than W).
    if (src.length < n) src = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = arr[i > 0 ? i - 1 : 0], c = arr[i < n - 1 ? i + 1 : n - 1];
      // Never above the point's own level: the peak keeps its true height
      // (so it reads right on the +dB scale), only its sides are lowered.
      const v = Math.min(arr[i], arr[i] + SHARPEN * (arr[i] - 0.5 * (a + c)));
      src[i] = v <= 0 ? 0 : v;
    }
    for (let x = 0; x < W; x++) {
      const i0 = Math.floor((x * n) / W);
      const i1 = Math.max(i0 + 1, Math.floor(((x + 1) * n) / W));
      let m = 0, k = Math.min(i0, n - 1);
      for (let i = i0; i < i1 && i < n; i++) if (src[i] > m) { m = src[i]; k = i; }   // max keeps thin carriers
      norm[x] = m / 255;
      col[x] = arr[k];   // same bin as the height, so a column never takes a neighbour's colour
    }
    // A light 10 % carry-over in time steadies the noise floor.
    for (let x = 0; x < W; x++) {
      let v = norm[x];
      if (havePrev) v = 0.9 * v + 0.1 * prev[x];
      prev[x] = v;
      line[2 * x] = Math.round(v * 255);
      line[2 * x + 1] = col[x];
    }
    havePrev = true;
    head = (head + 1) % H;
    times[head] = performance.now();
    gl.bindTexture(gl.TEXTURE_2D, histTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, head, W, 1, gl.RG_INTEGER, gl.UNSIGNED_BYTE, line);
    hist.set(line, head * W * 2);
    ranges[head * 2] = l; ranges[head * 2 + 1] = r;
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
  const ampOf = (d) => AMP * sOf(d) * (1 + (BACKH - 1) * d);
  const groundOf = (d) => -1 - fl * AMP + RISE * (1 - sOf(d)) / (1 - sOf(1));
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
        const y = groundOf(d) + fl * ampOf(d);
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
    gl.uniform1f(uLoc.uK, K);
    gl.uniform1f(uLoc.uBackH, BACKH);
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

  /** Level (0-1) of a row at position u of the visible window, as sampleAt() in the shader. */
  function levelAt(u, age) {
    const row = (head - age + H) % H;
    const l = ranges[row * 2], r = ranges[row * 2 + 1];
    if (!(r > l) || r - l > 1.5 * (viewR - viewL)) return Number(FLOORV);
    const t = (viewL + u * (viewR - viewL) - l) / (r - l);
    if (t < 0 || t >= 1) return Number(FLOORV);
    return hist[(row * W + Math.min(Math.floor(t * W), W - 1)) * 2] / 255;   // height level
  }

  /** The row under the pointer: the front-most row whose surface reaches
   *  up to it (as the depth test draws them). Returns the frequency there as
   *  a front-row clientX, plus the row's age in seconds; null off the sheet. */
  export function pick(clientX, clientY) {
    if (!canvas || !(viewR > viewL)) return null;
    const rc = canvas.getBoundingClientRect();
    if (!rc.width || !rc.height) return null;
    const xs = ((clientX - rc.left) / rc.width) * 2 - 1;
    const ys = 1 - ((clientY - rc.top) / rc.height) * 2;
    const hp = Number(HPOW);
    for (let a = 0; a < H; a++) {
      const d = a / (H - 1), sd = sOf(d);
      if (Math.abs(xs) > sd) return null;       // beside the tapered sheet
      const u = 0.5 + 0.5 * xs / sd;
      const top = groundOf(d) + Math.pow(levelAt(u, a), hp) * ampOf(d);
      if (ys <= top) {
        const t = times[(head - a + H) % H];
        return {
          clientX: rc.left + u * rc.width,
          age: t > 0 ? (times[head] - t) / 1000 : 0,
        };
      }
    }
    return null;
  }

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
    <button class="w3d-btn" class:w3d-on={showGeom} on:click={() => (showGeom = !showGeom)} title="Angle and depth">⚙</button>
    <button class="w3d-btn" on:click={onClose} title="Back to the 2D spectrum">✕ 2D</button>
  </div>
  {#if showGeom}
    <div class="w3d-geom" on:mousedown={stop} on:wheel={stop} on:mousemove={stop}>
      <label><span>Angle</span><input type="range" min="0.3" max={angleMax} step="any" bind:value={angle} /></label>
      <label><span>Depth</span><input type="range" min="0" max="1" step="0.05" bind:value={depth} /></label>
      <button class="w3d-btn" on:click={resetGeom} title="Back to the default angle and depth">Reset</button>
    </div>
  {/if}
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
  .w3d-btn.w3d-on { color: rgb(165, 243, 252); background-color: #2a3442; }
  .w3d-geom {
    position: absolute; top: 34px; right: 10px; z-index: 1;
    display: flex; flex-direction: column; gap: 4px; align-items: stretch;
    padding: 6px 8px; border-radius: 6px; cursor: default;
    background: rgba(10, 14, 22, 0.88); border: 1px solid rgba(0, 0, 0, 0.85);
    box-shadow: -1px 2px 4px rgba(0, 0, 0, 0.6);
    font-size: 10px; color: rgba(165, 243, 252, 0.9);
  }
  .w3d-geom label { display: flex; align-items: center; gap: 6px; }
  .w3d-geom span { width: 34px; }
  .w3d-geom input { width: 110px; accent-color: rgb(34, 211, 238); }
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
