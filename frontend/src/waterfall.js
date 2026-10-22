import getColormap, { computeColormapArray } from './lib/colormaps.js'
import { JitterBuffer, createWaterfallDecoder } from './lib/wrappers.js'
import Denque from 'denque'
import 'core-js/actual/set-immediate'
import 'core-js/actual/clear-immediate'
import { eventBus } from './eventBus';
// Added to fix an error when printing the waterfall during the handleBandChange //
// function in App.svelte //
import { siteRegion } from './siteInfo.js';
import { bands, MODES } from './bands-config.js';
import { ConnectionRefused, isRefusal } from './refused'
import WaterfallAutoLevel from './lib/wfAutoLevel.js'
import { isAnonymousName } from './lib/identity.js'

export default class SpectrumWaterfall {
  constructor(endpoint, settings) {

    this.markers = [];
    this.currentBand = null;

    this.endpoint = endpoint

    this.zoomFactor = 1

    // "Auto Adj." — automatic brightness/contrast, see lib/wfAutoLevel.js.
    // minWaterfall/maxWaterfall stay frozen while it runs.
    this.autoAdjust = false;
    this.autoLevel = new WaterfallAutoLevel();
    // Measured floor/ceiling for the (disabled) Min/Max sliders — telemetry only.
    this.autoAdjustDisplayMin = null
    this.autoAdjustDisplayMax = null

    this.spectrum = false
    this.big = false
    this.waterfall = false

    this.frequencyMarkerComponent = null; // Reference to the Svelte component
    this.pendingMarkers = []; // Store markers temporarily

    this.waterfallQueue = new Denque(10)
    this.drawnWaterfallQueue = new Denque(4096)
    this.lagTime = 0
    this.spectrumAlpha = 0.5
    this.spectrumFiltered = [[-1, -1], [0]]
    // Spectral SNR estimation. The noise floor is the QUIETEST patch of the
    // visible span (rescanned on a timer), so an in-passband signal can never
    // inflate it — that is what stops SNR from collapsing to 0 dB.
    // SNR = passband peak − that floor.
    this.snrPassbandHz = null   // [lowHz, highHz] set by App on tune
    this.snrDb = null           // smoothed SNR estimate (dB)
    this.snrNoiseDb = null      // "written-down" band-noise floor (waterfall dB)
    this.nfScanIntervalMs = 1000 // how often the floor is rescanned / rewritten
    this._nfScanNextTs = 0      // timestamp of the next floor rescan
    this.snrScale = 0.5         // dB per waterfall unit: the server stores
                                // 20·log10 of the bin power, so one unit is 0.5 dB

    this.waterfallColourShift = 130
    this.minWaterfall = -30
    this.maxWaterfall = 110
    // https://gist.github.com/mikhailov-work/ee72ba4191942acecc03fe6da94fc73f
    this.colormap = []
    this.view3d = null    // 3D spectrum hooks, set by lib/Waterfall3D.svelte while it is open

    this.setColormap('gqrx')

    this.clients = {}
    this.clientColormap = computeColormapArray(getColormap('rainbow'))
    this._flagCache = {}   // cc → HTMLImageElement | null (loading) | undefined (error)

    this.updateTimeout = setTimeout(() => { }, 0)

    this.lineResets = 0

    // BUG FIX (RESOURCE LEAK): drawSpectrogram's rAF loop had no stop flag.
    // Each call to stop()+init() launched a new loop on top of previous ones;
    // after N reconnections there were N+1 competing draw loops, each posting
    // at 60 Hz.  _drawLoopActive is checked on every tick and cleared by stop().
    this._drawLoopActive = false;

    this.wfheight = 200 * window.devicePixelRatio

    this.bands = bands;

    // Spectrum rainbow colormap — edit the index numbers to move colours earlier
    // or later. 0 = noise floor, 255 = strongest signal. boost=60 means the
    // visible range starts at index 60, so stop [0] is never actually shown.
    // The last stop MUST be [255] so strong signals don't glitch.
    // Adapted from a MATLAB 256-row colormap. Expressed as stops at the segment
    // boundaries; the linear interpolation below reproduces each MATLAB segment
    // exactly. Note there is NO green band — cyan ramps straight to yellow.
    var scStops = [
      [  0,  [  0,   0,  51, 255]],  // very dark navy blue (noise floor)
      [  1,  [  0,   0,  77, 255]],  // dark navy blue (starts at 1)
      [ 14,  [  0,  45, 183, 255]],  // royal blue (13-step ramp keeps the floor smooth)
      [ 30,  [  0, 158, 255, 255]],  // azure blue
      [ 46,  [  0, 255, 255, 255]],  // cyan
      [ 92,  [255, 255,   0, 255]],  // yellow (long smooth ramp through chartreuse)
      [124,  [255, 128,   0, 255]],  // orange
      [156,  [255,   0,   0, 255]],  // red
      [255,  [179,   0,   0, 255]],  // dark red / maroon
    ];
    this.spectrumColormap = [];
    for (var sci = 0; sci < 256; sci++) {
      var sc0 = scStops[0], sc1 = scStops[scStops.length - 1];
      for (var si = 0; si < scStops.length - 1; si++) {
        if (sci >= scStops[si][0] && sci <= scStops[si + 1][0]) {
          sc0 = scStops[si]; sc1 = scStops[si + 1]; break;
        }
      }
      var scSpan = sc1[0] - sc0[0];
      var scF = scSpan > 0 ? (sci - sc0[0]) / scSpan : 0;
      this.spectrumColormap.push([
        Math.round(sc0[1][0] + (sc1[1][0] - sc0[1][0]) * scF),
        Math.round(sc0[1][1] + (sc1[1][1] - sc0[1][1]) * scF),
        Math.round(sc0[1][2] + (sc1[1][2] - sc0[1][2]) * scF),
        255
      ]);
    }
  }


  addMarker(frequency, name, mode) {
    this.markers.push({ frequency, name, mode });
    this.markers.sort((a, b) => a.frequency - b.frequency);
  }


  initCanvas(settings) {
    this.canvasElem = settings.canvasElem
    this.ctx = this.canvasElem.getContext('2d')
    this.ctx.imagesmoothingEnabled = false
    //this.ctx.imageSmoothingQuality = "high"
    this.canvasWidth = this.canvasElem.width
    this.canvasHeight = this.canvasElem.height
    this.backgroundColor = window.getComputedStyle(document.body, null).getPropertyValue('background-color')

    this.curLine = this.canvasHeight / 2

    this.ctx.fillRect(0, 0, this.canvasElem.width, this.canvasElem.height)

    this.graduationCanvasElem = settings.graduationCanvasElem
    this.graduationCtx = this.graduationCanvasElem.getContext('2d')

    this.bandPlanCanvasElem = settings.bandPlanCanvasElem
    this.bandPlanCtx = this.bandPlanCanvasElem.getContext('2d')

    this.clientsCanvasElem = settings.clientsCanvasElem
    this.clientsCtx = this.clientsCanvasElem.getContext('2d')

    this.spectrumCanvasElem = settings.spectrumCanvasElem
    this.spectrumCtx = this.spectrumCanvasElem.getContext('2d')

    this.spectrumCanvasElem.addEventListener('mousemove', this.spectrumMouseMove.bind(this))
    this.spectrumCanvasElem.addEventListener('mouseleave', this.spectrumMouseLeave.bind(this))

    this.tempCanvasElem = settings.tempCanvasElem
    this.tempCtx = this.tempCanvasElem.getContext('2d')
    this.tempCanvasElem.height = this.wfheight

    this.waterfall = true

    this.mobile = false

    let resizeTimeout;
    this.resizeCallback = () => {

      this.setCanvasWidth()

      // Create a new canvas and copy over new canvas
      let resizeCanvas = document.createElement('canvas')
      resizeCanvas.width = this.canvasElem.width
      resizeCanvas.height = this.canvasElem.height
      let resizeCtx = resizeCanvas.getContext('2d')
      resizeCtx.imagesmoothingEnabled = false;
      resizeCtx.drawImage(this.canvasElem, 0, 0)


      this.curLine = Math.ceil(this.curLine * this.canvasElem.height / resizeCanvas.height)
      // Copy resizeCanvas to new canvas with scaling
      this.ctx.imagesmoothingEnabled = false;
      this.ctx.drawImage(resizeCanvas, 0, 0, resizeCanvas.width, resizeCanvas.height, 0, 0, this.canvasElem.width, this.canvasElem.height)
      this.updateGraduation()
      this.updateBandPlan()
      //this.redrawWaterfall()
      resizeTimeout = undefined
    }
    window.addEventListener('resize', () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      //this.resizeCallback()
      //resizeTimeout = setTimeout(this.resizeCallback, 250)
    })
  }

  async init() {
    if (this.promise) {
      return this.promise
    }

    this.waterfallSocket = new WebSocket(this.endpoint)
    this.waterfallSocket.binaryType = 'arraybuffer'
    this.firstWaterfallMessage = true
    this.waterfallSocket.onmessage = this.socketMessageInitial.bind(this)

    this.promise = new Promise((resolve, reject) => {
      this.resolvePromise = resolve
      this.rejectPromise = reject
    })

    // Nothing else here ever settles this promise on failure: without this the
    // page would await a waterfall that the server has already refused, and
    // simply never finish loading.
    this.waterfallSocket.onclose = (evt) => {
      if (isRefusal(evt) && this.rejectPromise) {
        this.rejectPromise(new ConnectionRefused(evt.reason, evt.code))
      }
    }

    return this.promise
  }

  // ── Detail stream for the audio analyser ───────────────────────────────
  // The analyser's RF measurements need fine resolution around the station,
  // but the page's waterfall only carries the zoom being viewed. While the
  // analyser is open a second, hidden /waterfall connection is kept at the
  // resolution the mode needs, centred on the dial; it is never drawn. The
  // server counts listeners by their /audio connection, so it adds no user.

  // Start (if needed) and centre the detail stream on dialHz for mode.
  detailFollow(dialHz, mode) {
    if (!Number.isFinite(dialHz) || !(this.totalBandwidth > 0) || !this.waterfallMaxSize) return
    const md = String(mode || '').toUpperCase()
    const rawHz = this.totalBandwidth / this.waterfallMaxSize
    // AM, SSB, CW: full resolution (1024 FFT bins, as the deepest zoom). FM:
    // ±20 kHz, its measurement needs the noise beside the channel. Wide FM ±150 kHz.
    const half = md === 'WBFM' ? Math.round(150000 / rawHz) : md === 'FM' ? Math.round(20000 / rawHz) : 512
    const c = Math.min(this.waterfallMaxSize - half, Math.max(half, Math.round(this.freqToIdx(dialHz))))
    const l = c - half, r = c + half
    const d = this._detail || (this._detail = { ws: null, dec: null, frame: null, l: -1, r: -1 })
    // Re-centre only when the dial has moved a quarter of the span, or the span changed.
    if (d.r - d.l === r - l && Math.abs((d.l + d.r) / 2 - c) < half / 4) return
    d.l = l; d.r = r
    if (!d.ws) {
      let ws
      try { ws = new WebSocket(this.endpoint) } catch (e) { return }
      ws.binaryType = 'arraybuffer'
      d.ws = ws
      ws.onmessage = (evt) => {
        if (!d.dec) {                               // first message: the settings
          try {
            const settings = JSON.parse(evt.data)
            d.dec = createWaterfallDecoder(settings.waterfall_compression)
            ws.send(JSON.stringify({ cmd: 'window', l: d.l, r: d.r }))
          } catch (e) { /* not the settings yet */ }
          return
        }
        if (!(evt.data instanceof ArrayBuffer)) return
        try {
          // Until the window command takes effect the server still sends the
          // full span: only frames as narrow as the window asked for count.
          d.dec.decode(evt.data).forEach((f) => { if (f.r - f.l <= (d.r - d.l) * 1.5) { f._ts = performance.now(); d.frame = f } })
        } catch (e) { /* skip a bad frame */ }
      }
      ws.onclose = () => { if (d.ws === ws) { d.ws = null; d.dec = null; d.frame = null; d.l = d.r = -1 } }
      return
    }
    if (d.dec && d.ws.readyState === WebSocket.OPEN) d.ws.send(JSON.stringify({ cmd: 'window', l, r }))
  }

  detailStop() {
    const d = this._detail
    if (!d) return
    this._detail = null
    if (d.ws) { try { d.ws.close() } catch (e) { /* already closed */ } }
  }

  // The frame to measure hzAt on: the detail stream's when it is fresh (< 1.5 s)
  // and covers that frequency, otherwise the page's own waterfall.
  _frameFor(hzAt) {
    const d = this._detail, f = d && d.frame
    if (f && performance.now() - f._ts < 1500 && Number.isFinite(hzAt)) {
      const i = this.freqToIdx(hzAt)
      if (i > f.l && i < f.r) return f
    }
    return this._lastFrame
  }

  // Noise floor (waterfall units) for a frame from _frameFor: the page's own
  // band floor for its own waterfall; for a detail frame its 20th percentile,
  // the same fallback the SNR estimate uses at deep zoom. The page's floor is
  // the quietest patch of whatever view is on screen, which zoomed out can sit
  // far below the noise around the station.
  _noiseOf(frame) {
    if (frame === this._lastFrame) return this.snrNoiseDb
    if (frame._nf == null) {
      const q = []
      for (let i = 0; i < frame.data.length; i++) if (Number.isFinite(frame.data[i])) q.push(frame.data[i])
      q.sort((x, y) => x - y)
      frame._nf = q.length ? q[Math.floor(q.length * 0.2)] : null
    }
    return frame._nf
  }

  stop() {
    this.detailStop()
    // BUG FIX (RESOURCE LEAK): set flag so the rAF draw loop exits on its next
    // tick instead of running forever after the socket has been closed.
    this._drawLoopActive = false;

    // BUG FIX (CRASH): guard against stop() being called before init() or after
    // a failed connection where waterfallSocket was never assigned.
    if (this.waterfallSocket) {
      this.waterfallSocket.close();
      this.waterfallSocket = null;
    }
  }

  setCanvasWidth() {
    const dpr = window.devicePixelRatio;
    const screenWidth = window.innerWidth;

    let canvasWidth = screenWidth > 1380 ? 1380 : screenWidth;
    canvasWidth *= dpr;
    if (canvasWidth < 1200) {
      this.mobile = true;
    }


    this.canvasElem.width = canvasWidth;
    this.canvasScale = canvasWidth / 1380;

    // Aspect ratio is 1380 to 128px; 1.6× taller on the phone layout, where
    // the plain ratio gives a ~35 px spectrum.
    this.spectrumCanvasElem.width = canvasWidth;
    this.spectrumCanvasElem.height = (canvasWidth / 1380) * 128 * (this.mobileLayout ? 1.6 : 1);

    // Aspect ratio is 1380 to 20px
    this.graduationCanvasElem.width = canvasWidth;
    this.graduationCanvasElem.height = (canvasWidth / 1380) * 30;

    // Aspect ratio is 1380 to 20px
    this.bandPlanCanvasElem.width = canvasWidth;
    this.bandPlanCanvasElem.height = (canvasWidth / 1380) * 40;

    this.clientsCanvasElem.width = canvasWidth;
    this.clientsCanvasElem.height = (canvasWidth / 1380) * 20;

    this.canvasElem.height = this.wfheight;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = this.canvasElem.height;

    // Create a new canvas that will be used as a buffer
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.canvasWidth;
    this.bufferCanvas.height = this.canvasHeight;
    this.bufferContext = this.bufferCanvas.getContext('2d', { alpha: false });

  }

  setFrequencyMarkerComponent(component) {
    this.frequencyMarkerComponent = component;
    this.addMarkersToComponent();
  }

  addMarkersToComponent() {
    if (this.frequencyMarkerComponent && this.pendingMarkers.length > 0) {
      this.frequencyMarkerComponent.insertAll(this.pendingMarkers);
      this.frequencyMarkerComponent.finalizeList();
      this.pendingMarkers = []; // Clear pending markers
    }
  }

  socketMessageInitial(event) {
    // First message gives the parameters in json
    if (!(event.data instanceof ArrayBuffer)) {
      const settings = JSON.parse(event.data)
      if (!settings.fft_size) {
        return
      }

      // Handle markers
      if (settings.markers) {
        try {
          const markersData = JSON.parse(settings.markers);
          if (markersData.markers && Array.isArray(markersData.markers)) {
            this.pendingMarkers = markersData.markers.map(marker => ({
              f: marker.frequency,
              d: marker.name,
              m: marker.mode
            }));
            this.addMarkersToComponent();
          }
        } catch (error) {
          console.error("Error parsing markers:", error);
        }
      }
      this.waterfallMaxSize = settings.fft_result_size
      this.fftSize = settings.fft_size
      this.baseFreq = settings.basefreq
      this.sps = settings.sps
      this.totalBandwidth = settings.total_bandwidth
      this.overlap = settings.overlap

      this.setCanvasWidth()
      this.tempCanvasElem.width = settings.waterfall_size


      this.ctx.fillRect(0, 0, this.canvasElem.width, this.canvasElem.height)

      const skipNum = Math.max(1, Math.floor((this.sps / this.fftSize) / 5.0) * 2)
      const waterfallFPS = (this.sps / this.fftSize) / (skipNum / 2)
      //this.waterfallQueue = new JitterBuffer(1000 / waterfallFPS)

      console.log('Waterfall FPS: ' + waterfallFPS)

      requestAnimationFrame(this.drawSpectrogram.bind(this));

      this.waterfallL = 0
      this.waterfallR = this.waterfallMaxSize
      this.waterfallSocket.onmessage = this.socketMessage.bind(this)
      this.firstWaterfallMessage = false

      this.waterfallDecoder = createWaterfallDecoder(settings.waterfall_compression)
      this.updateGraduation()
      this.updateBandPlan()
      this.resolvePromise(settings)

      //eventBus.publish('frequencyChange', { detail: 1e6 });
    }
  }

  socketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      this.enqueueSpectrogram(event.data)
    }
  }

  getMouseX(canvas, evt) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width

    return (evt.clientX - rect.left) * scaleX
  }

  enqueueSpectrogram(array) {

    // Decode and extract header
    this.waterfallDecoder.decode(array).forEach((waterfallArray) => {
      // Kept so getPeakFreq() can look at the current spectrum on demand.
      this._lastFrame = waterfallArray
      this._updateSnr(waterfallArray)
      this.waterfallQueue.unshift(waterfallArray)
    })

    // Do draw if not requested
    if (!this.waterfall && !this.spectrum) {
      this.waterfallQueue.clear()
      return
    }

    while (this.waterfallQueue.length > 2) {
      this.waterfallQueue.pop()
    }
  }

  // ── ka9q-style SNR estimation ─────────────────────────────────────────
  // Noise is estimated per waterfall frame as the MEDIAN of the spectrum
  // bins flanking the tuned passband (guard band excluded).  The median is
  // robust: it ignores the signal and nearby QSOs, so the estimate holds
  // even under a continuous carrier — no reliance on speech pauses.
  // SNR = total passband power − (per-bin noise + 10·log10(Nbins)),
  // i.e. bandwidth-normalized like ka9q-radio / UberSDR.

  setSnrPassband(lowHz, highHz) {
    if (Number.isFinite(lowHz) && Number.isFinite(highHz) && highHz > lowHz) {
      this.snrPassbandHz = [lowHz, highHz]
    } else {
      this.snrPassbandHz = null
    }
  }

  getSnrEstimate() {
    return { snrDb: this.snrDb, noiseDb: this.snrNoiseDb, gateSnrDb: this.gateSnrDb }
  }

  /**
   * Occupied bandwidth of the tuned station (the "−26 dB" method), measured
   * on the RF spectrum: everything above (peak − 26 dB) and at least 10 dB
   * above the noise, grown outwards from the peak (gaps under 300 Hz are
   * tolerated, speech is not continuous). For the audio analyser; from
   * PhantomSDR-ORSAT. Returns { ok, lo, hi, width, snr } in absolute Hz, or
   * { ok:false, reason }.
   */
  measureOccupied(dialHz, mode) {
    try {
      const frame = this._frameFor(dialHz)
      if (!frame || !frame.data) return { ok: false, reason: 'nodata' }
      const { data, l } = frame
      const n = data.length, span = frame.r - l
      if (n < 8 || !(span > 0)) return { ok: false, reason: 'nodata' }
      const hzPerBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
      if (!(hzPerBin > 0) || hzPerBin > 400) return { ok: false, reason: 'zoom' }
      const idx = (hz) => Math.round((this.freqToIdx(hz) - l) / span * n)
      const hzOf = (i) => this.idxToFreq(l + (i / n) * span)
      const m = String(mode || '').toUpperCase()
      let pk0, pk1, w0, w1
      if (m === 'LSB' || m === 'RADEL') { pk0 = dialHz - 3000; pk1 = dialHz; w0 = dialHz - 9000; w1 = dialHz + 1500 }
      else if (m.startsWith('CW')) { pk0 = dialHz - 400; pk1 = dialHz + 400; w0 = dialHz - 3000; w1 = dialHz + 3000 }
      else if (m === 'AM' || m === 'QUAM' || m === 'FM') { pk0 = dialHz - 5000; pk1 = dialHz + 5000; w0 = dialHz - 15000; w1 = dialHz + 15000 }
      else { pk0 = dialHz; pk1 = dialHz + 3000; w0 = dialHz - 1500; w1 = dialHz + 9000 }
      const clamp = (i) => Math.max(0, Math.min(n - 1, i))
      let a = clamp(idx(Math.min(pk0, pk1))), b = clamp(idx(Math.max(pk0, pk1)))
      const wa = clamp(idx(w0)), wb = clamp(idx(w1))
      if (b - a < 2) return { ok: false, reason: 'zoom' }
      let peak = -Infinity, pi = -1
      for (let i = a; i <= b; i++) { const v = data[i]; if (Number.isFinite(v) && v > peak) { peak = v; pi = i } }
      // AM / FM: the carrier sits in one narrow bin and at fine zoom outweighs
      // every sideband bin by far more than 26 dB, so a threshold taken from it
      // keeps the carrier alone (width 0.0 kHz). Take the threshold from the
      // strongest sideband bin instead and grow outwards from the carrier.
      if (m === 'AM' || m === 'QUAM' || m === 'FM') {
        const c = clamp(idx(dialHz)), cw = Math.max(1, Math.round(60 / hzPerBin))
        let sb = -Infinity
        for (let i = a; i <= b; i++) { const v = data[i]; if (Math.abs(i - c) > cw && Number.isFinite(v) && v > sb) sb = v }
        if (Number.isFinite(sb)) { peak = sb; pi = c }
      }
      const noise = Number.isFinite(this._noiseOf(frame)) ? this._noiseOf(frame) : null
      if (pi < 0 || noise == null) return { ok: false, reason: 'nodata' }
      // One waterfall unit is 0.5 dB (the server stores 20·log10 of the bin
      // power), so every dB figure below is twice as many units.
      const snr = (peak - noise) / 2
      if (snr < 15) return { ok: false, reason: 'weak', snr }
      // Static crash (QRN): a crash lifts the whole trace at once. If the
      // middle of the trace (sampled median) is well above the noise floor,
      // the trace is ignored. Only bins outside the measurement window count:
      // zoomed in, the station itself fills most of the trace and would look
      // like a crash. Too few bins left outside it → no test.
      {
        const st = Math.max(1, Math.floor(n / 256)), smp = []
        for (let i = 0; i < n; i += st) if ((i < wa || i > wb) && Number.isFinite(data[i])) smp.push(data[i])
        smp.sort((x, y) => x - y)
        if (smp.length >= 16 && smp[smp.length >> 1] > noise + 12) return { ok: false, reason: 'impulse' }
      }
      const thr = Math.max(peak - 52, noise + 20)
      const gap = Math.max(1, Math.round(300 / hzPerBin))
      let lo = pi, hi = pi, miss = 0
      for (let i = pi + 1; i <= wb; i++) { if (data[i] >= thr) { hi = i; miss = 0 } else if (++miss > gap) break }
      miss = 0
      for (let i = pi - 1; i >= wa; i--) { if (data[i] >= thr) { lo = i; miss = 0 } else if (++miss > gap) break }
      // Edges at the centre of the outermost bins: without the half bin on
      // each side, which added a whole bin of width at medium zoom.
      const loHz = hzOf(lo), hiHz = Math.max(hzOf(hi), loHz + hzPerBin)
      return { ok: true, lo: loHz, hi: hiHz, width: hiHz - loHz, snr, hzPerBin }
    } catch (e) { return { ok: false, reason: 'error' } }
  }

  /**
   * RF measurements of an SSB signal for the SSB audio report, on the last
   * trace: mean level (power) of the wanted sideband 300–2700 Hz and of the
   * opposite one, wanted peak, carrier line within ±60 Hz of the dial.
   */
  measureSsb(dialHz, mode) {
    try {
      const frame = this._frameFor(dialHz)
      if (!frame || !frame.data) return { ok: false, reason: 'nodata' }
      const { data, l } = frame
      const n = data.length, span = frame.r - l
      if (n < 8 || !(span > 0)) return { ok: false, reason: 'nodata' }
      const hzPerBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
      if (!(hzPerBin > 0) || hzPerBin > 300) return { ok: false, reason: 'zoom' }
      // One waterfall unit is 0.5 dB (the server stores 20·log10 of the bin
      // power): everything is returned in real dB, as units / 2.
      const noise = Number.isFinite(this._noiseOf(frame)) ? this._noiseOf(frame) / 2 : null
      if (noise == null) return { ok: false, reason: 'nodata' }
      const idx = (hz) => Math.max(0, Math.min(n - 1, Math.round((this.freqToIdx(hz) - l) / span * n)))
      const sgn = String(mode || '').toUpperCase() === 'LSB' ? -1 : 1
      const band = (f0, f1) => {
        let a = idx(dialHz + sgn * f0), b = idx(dialHz + sgn * f1)
        if (b < a) { const t = a; a = b; b = t }
        let sum = 0, pk = -Infinity, k = 0
        for (let i = a; i <= b; i++) { const v = data[i] / 2; if (!Number.isFinite(v)) continue; sum += Math.pow(10, v / 10); if (v > pk) pk = v; k++ }
        return k ? { mean: 10 * Math.log10(sum / k), pk, k } : null
      }
      const want = band(300, 2700), opp = band(-2700, -300)
      if (!want || !opp || want.k < 3) return { ok: false, reason: 'zoom' }
      let car = null
      if (hzPerBin <= 60) {
        const w = Math.max(60, hzPerBin * 1.5)
        let a = idx(dialHz - w), b = idx(dialHz + w)
        if (b < a) { const t = a; a = b; b = t }
        car = -Infinity
        for (let i = a; i <= b; i++) if (Number.isFinite(data[i]) && data[i] > car) car = data[i]
        car = Number.isFinite(car) && car < 127 ? car / 2 : null   // 127 = top of the 8-bit scale: clipped, unusable
      }
      return { ok: true, want: want.mean, wantPk: want.pk, opp: opp.mean, car, noise, hzPerBin }
    } catch (e) { return { ok: false, reason: 'error' } }
  }

  /**
   * RF measurements of an AM or FM station for the AM/FM report, on the last
   * trace. The server stores 20·log10 of the bin power, so one waterfall unit
   * is 0.5 dB: powers are 10^(v/20) here and every dB figure returned is a
   * real dB. Powers are noise-subtracted sums over bins, so a carrier (spread
   * over its window lobe) and a sideband (spread over many bins) compare
   * fairly.
   *   AM: carrier near the dial (±300 Hz), lower and upper sideband power out
   *       to 5 kHz, modulation depth m = √(2·P_sidebands / P_carrier) (the
   *       depth of a sine giving the same sideband power), carrier offset.
   *   FM: 99 % power bandwidth within ±9 kHz of the dial, and the offset of
   *       its power centre from the dial.
   * Returns { ok:true, ... } or { ok:false, reason }.
   */
  measureAmFm(dialHz, mode) {
    try {
      const frame = this._frameFor(dialHz)
      if (!frame || !frame.data) return { ok: false, reason: 'nodata' }
      const { data, l } = frame
      const n = data.length, span = frame.r - l
      if (n < 8 || !(span > 0)) return { ok: false, reason: 'nodata' }
      const hzPerBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
      const fm = String(mode || '').toUpperCase() === 'FM'
      if (!(hzPerBin > 0) || hzPerBin > (fm ? 400 : 40)) return { ok: false, reason: 'zoom' }
      const lin = (v) => Math.pow(10, v / 20)
      const dB = (p) => 10 * Math.log10(Math.max(p, 1e-30))
      const idx = (hz) => Math.max(0, Math.min(n - 1, Math.round((this.freqToIdx(hz) - l) / span * n)))
      const hzOf = (i) => this.idxToFreq(l + (i / n) * span)
      const ok = (i) => Number.isFinite(data[i])
      // Noise power per bin, measured locally on both sides of the station
      // (f1..f2 Hz away): snrNoiseDb is the quietest patch of the whole view
      // and can sit several dB under the noise around the station. Median of
      // the flank bins, which ignores a neighbour on one side; a single FFT
      // bin is exponentially distributed, so its mean is the median × 1.44,
      // bins that sum many FFT bins have mean ≈ median.
      const localNoise = (f1, f2, minHz) => {
        const q = []
        for (const sg of [-1, 1]) {
          const p1 = (this.freqToIdx(dialHz + sg * f1) - l) / span * n, p2 = (this.freqToIdx(dialHz + sg * f2) - l) / span * n
          const a = Math.max(0, Math.ceil(Math.min(p1, p2))), b = Math.min(n - 1, Math.floor(Math.max(p1, p2)))
          for (let i = a; i <= b; i++) if (ok(i)) q.push(lin(data[i]))
        }
        if (q.length < 8 || q.length * hzPerBin < minHz) return null    // too little flank in view
        q.sort((x, y) => x - y)
        const k = hzPerBin / (this.totalBandwidth / this.waterfallMaxSize)   // FFT bins per point
        return q[q.length >> 1] * (k <= 1.5 ? 1.44 : k >= 8 ? 1 : 1.2)
      }
      if (fm) {
        const a = idx(dialHz - 9000), b = idx(dialHz + 9000)
        if (b - a < 8) return { ok: false, reason: 'zoom' }
        // At least 4 kHz of flank beyond ±10 kHz must be in view: at the
        // deepest zoom the view is too narrow for FM.
        const nl = localNoise(10000, 30000, 4000)
        if (nl == null) return { ok: false, reason: 'zoomout' }
        const noise = 20 * Math.log10(nl)
        const p = []
        let tot = 0, pk = -Infinity
        for (let i = a; i <= b; i++) {
          const v = ok(i) ? Math.max(0, lin(data[i]) - nl) : 0
          p.push(v); tot += v
          if (ok(i) && data[i] > pk) pk = data[i]
        }
        const snr = dB(tot / (nl * p.length))
        if (!(snr >= 10) || !((pk - noise) / 2 >= 15)) return { ok: false, reason: 'weak', snr }
        let c = 0, lo = a, hi = b, ctr = 0
        for (let k = 0; k < p.length; k++) { c += p[k]; ctr += p[k] * k; if (c < 0.005 * tot) lo = a + k + 1 }
        c = 0
        for (let k = p.length - 1; k >= 0; k--) { c += p[k]; if (c < 0.005 * tot) hi = a + k - 1 }
        const loHz = hzOf(lo), hiHz = Math.max(hzOf(hi), loHz + hzPerBin)
        return { ok: true, fm: true, b99: hiHz - loHz, lo: loHz, hi: hiHz, edge: lo <= a + 1 || hi >= b - 1,
                 off: hzOf(a + ctr / tot) - dialHz, snr, hzPerBin }
      }
      // AM: the carrier is the strongest bin within ±300 Hz of the dial; its
      // window (Hann) lobe is ±2 bins, never less than ±45 Hz.
      let c = -1, cv = -Infinity
      for (let i = idx(dialHz - 300); i <= idx(dialHz + 300); i++) if (ok(i) && data[i] > cv) { cv = data[i]; c = i }
      if (c < 0) return { ok: false, reason: 'nodata' }
      // Noise just outside the sidebands (at the deepest zoom the view
      // reaches about ±7 kHz).
      let nl = localNoise(5500, 7000, 1000)
      if (nl == null) { const nf = this._noiseOf(frame); if (!Number.isFinite(nf)) return { ok: false, reason: 'nodata' }; nl = lin(nf) }
      const noise = 20 * Math.log10(nl)
      // 127 is the top of the waterfall's 8-bit scale: a carrier that reaches
      // it is clipped, and the depth would read too high.
      if (cv >= 127) return { ok: false, reason: 'clip' }
      const carSnr = (cv - noise) / 2
      if (carSnr < 20) return { ok: false, reason: 'weak', snr: carSnr }
      const cw = Math.max(2, Math.ceil(45 / hzPerBin))
      const sum = (i0, i1) => {
        let s = 0, k = 0
        for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) if (ok(i)) { s += lin(data[i]); k++ }
        return { s: Math.max(0, s - k * nl), k }
      }
      const car = sum(c - cw, c + cw).s
      const sbN = Math.round(5000 / hzPerBin)
      const L = sum(c - cw - sbN, c - cw - 1), U = sum(c + cw + 1, c + cw + sbN)
      if (!(car > 0) || L.k < sbN / 2 || U.k < sbN / 2) return { ok: false, reason: 'zoom' }
      // Carrier frequency to a fraction of a bin: parabola through the peak
      // and its neighbours.
      let frac = 0
      if (c > 0 && c < n - 1 && ok(c - 1) && ok(c + 1)) {
        const y0 = data[c - 1], y1 = data[c], y2 = data[c + 1], d = y0 - 2 * y1 + y2
        if (d < 0) frac = Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / d))
      }
      const sbPow = L.s + U.s
      return { ok: true, fm: false, m: Math.sqrt((2 * sbPow) / car),
               lsb: dB(L.s), usb: dB(U.s), car: dB(car),
               sbSnr: dB(sbPow / ((L.k + U.k) * nl)),
               off: hzOf(c + frac) - dialHz, snr: carSnr, hzPerBin }
    } catch (e) { return { ok: false, reason: 'error' } }
  }

  /**
   * RF slice of the last trace around a frequency, for the audio analyser's
   * RF view (AM / FM: carrier in the centre).
   * Returns { lo, hzPerBin, v: Float32Array (waterfall dB units), noise }.
   */
  getRfSlice(centerHz, halfSpanHz) {
    try {
      const frame = this._frameFor(centerHz)
      if (!frame || !frame.data) return null
      const { data, l } = frame
      const n = data.length, span = frame.r - l
      if (n < 8 || !(span > 0)) return null
      const hzPerBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
      const idx = (hz) => (this.freqToIdx(hz) - l) / span * n
      let a = Math.floor(idx(centerHz - halfSpanHz)), b = Math.ceil(idx(centerHz + halfSpanHz))
      a = Math.max(0, a); b = Math.min(n - 1, b)
      if (b - a < 2) return { hzPerBin, v: null }
      const v = new Float32Array(b - a + 1)
      for (let i = a; i <= b; i++) v[i - a] = data[i]
      return { lo: this.idxToFreq(l + (a / n) * span), hzPerBin, v, noise: this._noiseOf(frame) }
    } catch (e) { return null }
  }

  // Frequency of the strongest bin within +/-halfSpanHz of centerHz, from the
  // last frame, or null when the frame is too coarse there to mean anything.
  // This is a POSITIONING aid only — it says where a signal sits, never how
  // strong it is, so it needs no calibration against any other measurement.
  getPeakFreq(centerHz, halfSpanHz) {
    try {
      const frame = this._lastFrame
      if (!frame || !frame.data) return null
      const { data, l } = frame
      const n = data.length
      const span = frame.r - l
      if (n < 8 || !(span > 0)) return null
      const toDataIdx = (hz) => Math.round((this.freqToIdx(hz) - l) / span * n)

      let a = toDataIdx(centerHz - halfSpanHz)
      let b = toDataIdx(centerHz + halfSpanHz)
      if (b < a) { const t = a; a = b; b = t }
      a = Math.max(0, Math.min(n - 1, a))
      b = Math.max(0, Math.min(n - 1, b))
      if (b - a < 2) return null // fewer than 3 bins across: nothing to resolve

      let best = -Infinity, bestI = -1
      for (let i = a; i <= b; i++) {
        const v = data[i]
        if (Number.isFinite(v) && v > best) { best = v; bestI = i }
      }
      if (bestI < 0) return null
      return this.idxToFreq(l + (bestI / n) * span)
    } catch (e) { return null }
  }

  _updateSnr(frame) {
    try {
      if (!frame || !frame.data) return
      const { data, l } = frame
      const n = data.length
      if (n < 8) return
      // Bins are the waterfall's int8 dB-scale values (bigger = stronger).

      // The frame carries `n` data points spanning ABSOLUTE bins [l, r]; when
      // zoomed out the server downsamples so n << (r - l). So an absolute bin
      // index (what freqToIdx returns) must be scaled by n/(r-l) to land in the
      // data array — NOT just offset by l.
      const span = frame.r - l
      if (!(span > 0)) return
      const toDataIdx = (hz) => Math.round((this.freqToIdx(hz) - l) / span * n)

      // --- Tuned passband → data-array indices, and its centre ---
      let i0 = -1, i1 = -1, hasPb = false, center = n >> 1
      if (this.snrPassbandHz) {
        const [lowHz, highHz] = this.snrPassbandHz
        let a = toDataIdx(lowHz)
        let b = toDataIdx(highHz)
        if (b < a) { const t = a; a = b; b = t }
        // require the passband to actually overlap this frame's span
        if (b >= 0 && a <= n - 1) {
          i0 = Math.max(0, Math.min(n - 1, a))
          i1 = Math.max(0, Math.min(n - 1, b))
          center = (i0 + i1) >> 1
          hasPb = true
        }
      }

      // ==== Noise floor: quietest patch of the visible span ==================
      // Rescanned every nfScanIntervalMs ("write it down"). We slide a small
      // ~3 kHz window across the whole visible frame and keep the MINIMUM of
      // the per-window medians: any window containing a signal reads high, so
      // the minimum is the closest signal-free patch = true band noise. Using
      // a window median (not the single lowest bin) ignores notches / dropouts.
      const ts = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (this.snrNoiseDb == null || ts >= this._nfScanNextTs) {
        this._nfScanNextTs = ts + this.nfScanIntervalMs
        // ~3 kHz window expressed in THIS frame's downsampled data bins
        const hzPerDataBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
        const winBins = Math.max(4, Math.round(3000 / hzPerDataBin))
        const r0 = 0            // scan the whole visible span
        const r1 = n - 1
        // exclude the tuned passband (+guard) so its own signal never counts
        const guard = hasPb ? Math.max(winBins, (i1 - i0) + winBins) : 0

        let quiet = Infinity
        const buf = []
        for (let w = r0; w + winBins <= r1 + 1; w += winBins) {
          if (hasPb && w <= i1 + guard && (w + winBins - 1) >= i0 - guard) continue
          buf.length = 0
          for (let i = w; i < w + winBins; i++) { const v = data[i]; if (Number.isFinite(v)) buf.push(v) }
          if (buf.length < 3) continue
          buf.sort((a, b) => a - b)
          const med = buf[buf.length >> 1]
          if (med < quiet) quiet = med
        }
        // Fallback (region too small / all excluded): low percentile of frame
        if (!Number.isFinite(quiet)) {
          const samp = []
          const stride = Math.max(1, Math.floor(n / 1024))
          for (let i = 0; i < n; i += stride) { const v = data[i]; if (Number.isFinite(v)) samp.push(v) }
          if (samp.length >= 4) { samp.sort((a, b) => a - b); quiet = samp[Math.floor(samp.length * 0.2)] }
        }
        if (Number.isFinite(quiet)) {
          // light smoothing so the written-down floor doesn't jump between scans
          this.snrNoiseDb = this.snrNoiseDb == null ? quiet : this.snrNoiseDb + 0.5 * (quiet - this.snrNoiseDb)
        }
      }
      if (this.snrNoiseDb == null) return

      // ==== Signal: peak bin in the tuned passband (every frame) → SNR =======
      let peak = -Infinity
      if (hasPb) { for (let i = i0; i <= i1; i++) { const v = data[i]; if (v > peak) peak = v } }
      if (!Number.isFinite(peak)) { for (let i = 0; i < n; i++) { const v = data[i]; if (v > peak) peak = v } }
      if (!Number.isFinite(peak)) return

      const snr = Math.max(0, this.snrScale * (peak - this.snrNoiseDb))
      this.snrDb = this.snrDb == null ? snr : this.snrDb + 0.3 * (snr - this.snrDb)

      // ==== Local SNR for the VHF/UHF meter gate (lib/sUnits.js) ============
      // The figure above measures against the quietest patch of the whole
      // span, which on a wide IQ receiver lies at the band edge where the
      // front-end filter rolls off — so pure noise in mid-band reads a few dB
      // "above the noise". The gate only asks "is anything in the passband?",
      // and answers it locally: the passband's strongest bin against the 80th
      // percentile of its own neighbourhood (±100 kHz, with a guard band),
      // where the noise is flat. An empty channel reads about 0 dB; a carrier
      // or an FM signal stands clear; one busy channel nearby barely moves a
      // percentile. The SNR figure itself is unchanged.
      let gate = null
      if (hasPb) {
        const hzPerBin = (this.totalBandwidth / this.waterfallMaxSize) * (span / n)
        const reach = Math.max(8, Math.round(100000 / hzPerBin))
        const guard = Math.max(1, Math.round(5000 / hzPerBin))
        const ring = []
        for (let i = i0 - guard - reach; i <= i1 + guard + reach; i++) {
          if (i < 0 || i >= n || (i >= i0 - guard && i <= i1 + guard)) continue
          const v = data[i]
          if (Number.isFinite(v)) ring.push(v)
        }
        if (ring.length >= 8) {
          ring.sort((x, y) => x - y)
          const p80 = ring[Math.floor(ring.length * 0.8)]
          gate = this.snrScale * (peak - p80)
        }
      }
      this.gateSnrDb = gate == null ? null
        : this.gateSnrDb == null ? gate : this.gateSnrDb + 0.3 * (gate - this.gateSnrDb)
    } catch (e) { /* estimation is best-effort */ }
  }

  transformValue(value) {
    // Clamp value between minValue and maxValue
    let clampedValue = Math.max(this.minWaterfall, Math.min(this.maxWaterfall, value));

    // Normalize to 0-1 based on min and max settings
    let normalizedValue = (clampedValue - this.minWaterfall) / (this.maxWaterfall - this.minWaterfall);

    // Scale normalized value to colormap range (0-255)
    let colormapIndex = Math.floor(normalizedValue * 255);

    // Ensure index is within the bounds of the colormap array
    return Math.max(0, Math.min(255, colormapIndex));
  }


  // Helper functions

  idxToFreq(idx) {
    return idx / this.waterfallMaxSize * this.totalBandwidth + this.baseFreq
  }

  idxToCanvasX(idx) {
    return (idx - this.waterfallL) / (this.waterfallR - this.waterfallL) * this.canvasWidth
  }

  canvasXtoFreq(x) {
    const idx = x / this.canvasWidth * (this.waterfallR - this.waterfallL) + this.waterfallL
    return this.idxToFreq(idx)
  }

  freqToIdx(freq) {
    return (freq - this.baseFreq) / (this.totalBandwidth) * this.waterfallMaxSize
  }

  // Drawing functions
  // live=false for history lines being redrawn: they are levelled with the
  // current auto-adjust state but must not feed back into it.
  calculateOffsets(waterfallArray, curL, curR, live = false) {
    // Correct for zooming or shifting
    const pxPerIdx = this.canvasWidth / (this.waterfallR - this.waterfallL)
    const pxL = (curL - this.waterfallL) * pxPerIdx
    const pxR = (curR - this.waterfallL) * pxPerIdx

    let source = waterfallArray
    if (this.autoAdjust) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      source = this.autoLevel.process(waterfallArray, curL + ':' + curR, this.minWaterfall, this.maxWaterfall, now, live)
      if (live) {
        const st = this.autoLevel.stats
        if (Number.isFinite(st.floorDb)) {
          this.autoAdjustDisplayMin = st.floorDb - 3
          this.autoAdjustDisplayMax = st.ceilingDb
        }
      }
    }

    const arr = new Uint8Array(source.length)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = this.transformValue(source[i])
    }
    return [arr, pxL, pxR]
  }

  drawSpectrogram() {
    // BUG FIX (RESOURCE LEAK): set the loop-active flag before entering the
    // rAF loop.  stop() clears it, causing the loop to exit on its next tick
    // rather than running forever after the socket has closed.  Without this,
    // each reconnection launched a fresh loop on top of all previous ones.
    this._drawLoopActive = true;
    const draw = () => {
      if (!this._drawLoopActive) return;   // exit cleanly when stop() is called

      if (this.waterfallQueue.length === 0) {
        requestAnimationFrame(draw);
        return;
      }

      const { data: waterfallArray, l: curL, r: curR } = this.waterfallQueue.pop();
      const [arr, pxL, pxR] = this.calculateOffsets(waterfallArray, curL, curR, true);

      if (this.waterfall) {
        this.drawWaterfall(arr, pxL, pxR, curL, curR);
      }
      if (this.spectrum) {
        // Auto Adj. levels the waterfall only: the spectrum trace keeps its
        // true dB shape so it still lines up with its dB scale.
        let specArr = arr
        if (this.autoAdjust) {
          specArr = new Uint8Array(waterfallArray.length)
          for (let i = 0; i < specArr.length; i++) specArr[i] = this.transformValue(waterfallArray[i])
        }
        this.drawSpectrum(specArr, pxL, pxR, curL, curR);
      }
      // The 3D view takes the waterfall's own levels (Min/Max and Auto Adj.).
      if (this.view3d) {
        this.view3d.pushLine(arr, curL, curR);
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }


  async redrawWaterfall() {

    const toDraw = this.drawnWaterfallQueue.toArray()
    const curLineReset = this.lineResets
    const curLine = this.curLine
    const drawLine = (i) => {
      const toDrawLine = curLine + 1 + i + (this.lineResets - curLineReset) * this.canvasHeight / 2

      const [waterfallArray, curL, curR] = toDraw[i]

      const [arr, pxL, pxR] = this.calculateOffsets(waterfallArray, curL, curR)

      // BUG FIX (CRASH): previously called drawWaterfallLine without the 5th
      // `ctx` argument, leaving it undefined.  ctx.createImageData() inside the
      // function then threw TypeError: Cannot read properties of undefined.
      this.drawWaterfallLine(arr, pxL, pxR, toDrawLine, this.ctx)
      if (i + 1 < toDraw.length) {
        this.updateImmediate = setImmediate(() => drawLine(i + 1))
      }
    }
    clearImmediate(this.updateImmediate)
    if (toDraw.length) {
      drawLine(0)
    }
  }

  drawWaterfall(arr, pxL, pxR, curL, curR) {
    // Ensure integer pixel values
    pxL = Math.floor(pxL);
    pxR = Math.ceil(pxR);

    // PERF (#2): scroll the waterfall up by one pixel IN PLACE instead of
    // routing every frame through a second buffer canvas. The old path did
    // copy→buffer, draw line, clearRect(main), blit buffer back — two full
    // canvas blits plus a full clear per frame. Drawing a canvas onto itself
    // with an integer, non-scaled, overlapping source/dest is well-defined by
    // the HTML spec (the source is snapshotted before the copy), so this is
    // pixel-identical to the buffered version — same 1px integer shift, no
    // resampling, no cumulative blur — while doing a single blit.
    //
    // Guardrail: the shift height must stay positive. On a 0/1px canvas
    // (canvasHeight <= 1) there is nothing to scroll; skip the self-blit and
    // just paint the newest line, which avoids a spec-invalid drawImage with a
    // zero/negative source height.
    if (this.canvasHeight > 1) {
      this.ctx.drawImage(
        this.canvasElem,
        0, 1, this.canvasWidth, this.canvasHeight - 1,   // src: everything below the top row
        0, 0, this.canvasWidth, this.canvasHeight - 1    // dst: shifted up by one pixel
      );
    }

    // Draw the freshest line into the now-vacated bottom row (line 0 maps to
    // y = canvas.height - 1 inside drawWaterfallLine).
    this.drawWaterfallLine(arr, pxL, pxR, 0, this.ctx);
  }

  drawWaterfallLine(arr, pxL, pxR, line, ctx) {
    // Ensure integer pixel values
    pxL = Math.floor(pxL);
    pxR = Math.ceil(pxR);
    line = Math.floor(line);

    const width = pxR - pxL;

    // BUG FIX (CRASH): createImageData(0, 1) and createImageData(negative, 1)
    // both throw IndexSizeError.  Guard before touching the canvas API.
    if (width <= 0 || !arr || arr.length === 0) return;

    // PERF: reuse a width-keyed ImageData instead of allocating one per line
    // every frame. The loop below overwrites all `width` pixels, so no clear is
    // needed and the output is identical. ImageData is not bound to a context,
    // so the same cached object is valid for whichever ctx is passed in.
    if (!this._lineImg || this._lineImg.width !== width) {
      this._lineImg = ctx.createImageData(width, 1);
    }
    const colorarr = this._lineImg;

    for (let i = 0; i < width; i++) {
      // BUG FIX (NaN pixels): when width === 1, (width - 1) === 0 and the
      // division produces NaN.  arr[NaN] returns undefined, Math.floor(undefined)
      // returns NaN, and colorarr.data.set(undefined) throws a TypeError.
      // Guard: for a single-pixel strip just use the first (and only) array element.
      const arrIndex = width > 1
        ? Math.floor(i * (arr.length - 1) / (width - 1))
        : 0;
      const colorIndex = Math.floor(arr[arrIndex]);

      // Set the color for this pixel
      const pixelStart = i * 4;
      colorarr.data.set(this.colormap[colorIndex], pixelStart);
    }

    // Draw directly to the buffer canvas
    ctx.putImageData(colorarr, pxL, ctx.canvas.height - 1 - line);
  }


  // PERF (#3) helper: precompute the spectrum fill's vertical colour gradient,
  // one RGBA entry per canvas row. Depends only on `height` and the fixed
  // spectrumColormap. Written through a Uint8ClampedArray so the float→byte
  // rounding matches the ImageData buffer exactly, keeping the fill pixel-
  // identical to the old per-pixel lerp. Rebuilt whenever height or the
  // colormap reference changes (see the cache check in drawSpectrum).
  _buildSpectrumGradient(height) {
    const grad = new Uint8ClampedArray(Math.max(0, height) * 4);
    const boost = 0;   // MATLAB map spans the full 0–255 range (navy at the floor)
    const denom = height - 1;
    for (let row = 0; row < height; row++) {
      // Guardrail: at height === 1 the old code divided by 0 (NaN → crash).
      // Fall back to t = 0 there; for height > 1 this is identical to before.
      const t = denom > 0 ? (height - 1 - row) / denom : 0; // 0 at bottom, 1 at top
      const rawIdx = boost + (255 - boost) * t;             // float index
      const i0 = Math.max(0, Math.min(255, Math.floor(rawIdx)));
      const i1 = Math.min(255, i0 + 1);
      const frac = rawIdx - i0;
      const c0 = this.spectrumColormap[i0];
      const c1 = this.spectrumColormap[i1];
      const g = row * 4;
      grad[g]     = c0[0] + (c1[0] - c0[0]) * frac;
      grad[g + 1] = c0[1] + (c1[1] - c0[1]) * frac;
      grad[g + 2] = c0[2] + (c1[2] - c0[2]) * frac;
      grad[g + 3] = 255;
    }
    this._specGradient = grad;
    this._specGradientHeight = height;
    this._specGradientColormap = this.spectrumColormap;
  }

  drawSpectrum(arr, pxL, pxR, curL, curR) {
    if (curL !== this.spectrumFiltered[0][0] || curR !== this.spectrumFiltered[0][1]) {
      this.spectrumFiltered[1] = arr;
      this.spectrumFiltered[0] = [curL, curR];
    }

    // Smooth the spectrogram with the previous values
    for (let i = 0; i < arr.length; i++) {
      this.spectrumFiltered[1][i] = this.spectrumAlpha * arr[i] + (1 - this.spectrumAlpha) * this.spectrumFiltered[1][i];
    }

    // Take the smoothed value
    arr = this.spectrumFiltered[1];

    const pixels = (pxR - pxL) / arr.length;
    const scale = this.canvasScale;
    const height = this.spectrumCanvasElem.height;
    const width = this.spectrumCanvasElem.width;
    const ctx = this.spectrumCtx;

    // Normalize the array — y=0 is top (strong signal), y=height is bottom (noise floor)
    const normalizedArr = arr.map(x => height - (x / 255) * height);

    // ── Background ─────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // ── UberSDR-style rainbow fill ──────────────────────────────────────────────
    // For every pixel in the filled area the colour is determined by its ABSOLUTE
    // y-position on the canvas (not relative to the signal peak):
    //   y = 0        → colormap[255]  (top = strongest = "hot" colour)
    //   y = height-1 → colormap[0]    (bottom = weakest = "cold" colour)
    // This is exactly how UberSDR renders it: the fill is a vertical slice of
    // the waterfall colormap, clipped to the shape of the spectrum curve.
    const fillW = Math.ceil(pxR - pxL);

    // PERF (#3): the fill colour at any pixel depends ONLY on its row (absolute
    // y position), never on the column — every column paints the identical
    // vertical gradient, just starting at a different signalY. So precompute
    // that gradient once and copy slices out of it, instead of recomputing a
    // floor/clamp/lerp per pixel every frame. The gradient is built through a
    // Uint8ClampedArray with the same float→byte rounding the ImageData buffer
    // uses, so the fill stays byte-identical to the old per-pixel version.
    //
    // Guardrail: the cache is keyed on BOTH `height` and the spectrumColormap
    // reference, so a canvas resize or a colormap swap transparently rebuilds
    // it — a stale cache can never paint the wrong height or palette.
    if (this._specGradient === undefined ||
        this._specGradientHeight !== height ||
        this._specGradientColormap !== this.spectrumColormap) {
      this._buildSpectrumGradient(height);
    }
    const grad = this._specGradient;

    // PERF: reuse a (fillW × height)-keyed ImageData instead of allocating
    // ~fillW*height*4 bytes every frame (the single biggest render-path
    // allocation). fill(0) replicates createImageData's zero-init so the rows
    // ABOVE signalY (which the loop never writes) stay transparent-black every
    // frame exactly as before — byte-identical output, no per-frame GC.
    if (!this._specImg || this._specImg.width !== fillW || this._specImg.height !== height) {
      this._specImg = ctx.createImageData(fillW, height);
    }
    const specImgData = this._specImg;
    const sp = specImgData.data;
    sp.fill(0);

    for (let col = 0; col < fillW; col++) {
      const arrIdx = Math.min(Math.floor(col * arr.length / fillW), arr.length - 1);
      let signalY = Math.floor(normalizedArr[arrIdx]);
      if (signalY < 0) signalY = 0;   // guardrail: never index a negative row

      for (let row = signalY; row < height; row++) {
        const g = row * 4;
        const base = (row * fillW + col) * 4;
        sp[base]     = grad[g];
        sp[base + 1] = grad[g + 1];
        sp[base + 2] = grad[g + 2];
        sp[base + 3] = 255;
      }
    }
    ctx.putImageData(specImgData, Math.floor(pxL), 0);

    // ── dB grid lines and axis labels (drawn AFTER fill so never overwritten) ──
    const dBRange = this.maxWaterfall - this.minWaterfall;
    const gridStep = 10;
    const dBStart = Math.ceil(this.minWaterfall / gridStep) * gridStep;
    const fontSize = Math.max(9, Math.round(9 * scale));

    ctx.font = fontSize + 'px monospace';
    ctx.textAlign = 'right';
    ctx.shadowBlur = 0;

    for (let dB = dBStart; dB <= this.maxWaterfall; dB += gridStep) {
      // y=0 → maxWaterfall (hottest), y=height → minWaterfall (coldest)
      const y = height - ((dB - this.minWaterfall) / dBRange) * height;

      // Very light horizontal grid line across the full width for every scale value
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Label on the RIGHT with dark backing for readability
      const label = String(dB);
      const tw = ctx.measureText(label).width;
      const labelRight = width - 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(labelRight - tw - 2, Math.max(y - fontSize - 1, 0), tw + 4, fontSize + 2);
      ctx.fillStyle = 'rgba(210, 210, 210, 0.90)';
      ctx.fillText(label, labelRight, Math.max(y - 2, fontSize));
    }

    // ── Spectrum trace (white line on top) ─────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(pxL, normalizedArr[0]);
    for (let i = 1; i < normalizedArr.length; i++) {
      ctx.lineTo(pxL + i * pixels, normalizedArr[i]);
    }
    ctx.lineTo(pxR, normalizedArr[normalizedArr.length - 1]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // ── Frequency crosshair on mouse hover ─────────────────────────────────────
    if (this.spectrumFreq !== undefined) {
      const labelFontSize = Math.max(10, Math.round(11 * scale));
      ctx.font = labelFontSize + 'px monospace';
      ctx.fillStyle = 'rgba(255, 255, 180, 0.95)';
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
      ctx.fillText((this.spectrumFreq / 1e6).toFixed(6) + ' MHz', 10, labelFontSize + 4);

      ctx.strokeStyle = 'rgba(255, 240, 80, 0.60)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(this.spectrumX, 0);
      ctx.lineTo(this.spectrumX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  checkBandAndSetMode(frequency) {
    let newBand = null;
    let newMode = null;
  
    for (const band of this.bands) {

      // This comparator will fix an issue of printing the band name multiple times //
      // because of the ITU regions added in the this.bands[] array //
      // I import the region from site_information and do a comparison against //
      // the site ITU region and the band.ITU value. //
//This copied "as is" by sv2amk from below to fix the same issue but for the modes.//
            if (band.ITU === siteRegion || band.ITU == 123) {

      if (frequency >= band.startFreq && frequency <= band.endFreq) {
        newBand = band;
        for (const modeRange of band.modes) {
          if (frequency >= modeRange.startFreq && frequency <= modeRange.endFreq) {
            newMode = modeRange.mode;
            
            break;
          }
        }
        break;
      }
     } 
    }

    if (newBand !== this.currentBand || (newBand && newMode !== this.currentMode)) {
      this.currentBand = newBand;
      this.currentMode = newMode;
      
      if (newBand) {
        eventBus.publish('setMode', newMode);
        return newMode;
      } else {
        // We've moved out of all defined bands
        eventBus.publish('outOfBand');
        return null;
      }
    }
  
    return null; // No change in band or mode
  }



  updateGraduation() {
    const freqL = this.idxToFreq(this.waterfallL)
    const freqR = this.idxToFreq(this.waterfallR)
    const scale = this.canvasScale

    let graduationSpacing = 1

    // Calculate the scale where at least 20 graduation spacings will be drawn
    while ((freqR - freqL) / graduationSpacing > 8) {
      graduationSpacing *= 10
    }
    graduationSpacing /= 10

    this.graduationCtx.fillStyle = 'white'
    this.graduationCtx.strokeStyle = 'white'
    this.graduationCtx.clearRect(0, 0, this.graduationCanvasElem.width, this.graduationCanvasElem.height)

    // Find the first graduation frequency
    let freqLStart = freqL
    if (freqL % graduationSpacing !== 0) {
      freqLStart = freqL + (graduationSpacing - (freqL % graduationSpacing))
    }

    // Find the least amount of trailing zeros
    let minimumTrailingZeros = 5
    for (let freqStart = freqLStart; freqStart <= freqR; freqStart += graduationSpacing) {
      if (freqStart != 0) {
        const trailingZeros = freqStart.toString().match(/0*$/g)[0].length
        minimumTrailingZeros = Math.min(minimumTrailingZeros, trailingZeros)
      }
    }

    if (this.mobile) {
      this.graduationCtx.font = `${28 * scale}px Inter`
    } else {
      this.graduationCtx.font = `${10 * scale}px Inter`
    }

    for (; freqLStart <= freqR; freqLStart += graduationSpacing) {
      // find the middle pixel
      const middlePixel = (freqLStart - freqL) / (freqR - freqL) * this.canvasWidth

      let lineHeight = 5
      let printFreq = false
      if (freqLStart % (graduationSpacing * 10) === 0) {
        lineHeight = 10
        printFreq = true
      } else if (freqLStart % (graduationSpacing * 5) === 0) {
        lineHeight = 7
        printFreq = true
      }

      if (printFreq) {
        this.graduationCtx.textAlign = 'center'
        // Convert Hz to kHz by dividing by 1000, then round to remove decimal places
        const freqInKHz = (freqLStart / 1000)
        this.graduationCtx.fillText(freqInKHz.toString(), middlePixel, 20 * scale)
      }
      // draw a line in the middle of it
      this.graduationCtx.lineWidth = 1 * scale
      this.graduationCtx.beginPath()
      this.graduationCtx.moveTo(middlePixel, (5 + (5 - lineHeight)) * scale)
      this.graduationCtx.lineTo(middlePixel, (10) * scale)
      this.graduationCtx.stroke()
    }



    this.drawClients()
  }

  updateBandPlan() {
    const freqL = this.idxToFreq(this.waterfallL);
    const freqR = this.idxToFreq(this.waterfallR);
    const scale = this.canvasScale;

    // Clear the bandplan canvas
    this.bandPlanCtx.clearRect(0, 0, this.bandPlanCanvasElem.width, this.bandPlanCanvasElem.height);

    // Define the height of the band marker
    const bandHeight = 10 * scale;
    const bandOffset = 25 * scale;

    this.bands.forEach(band => {

      // This comparator will fix an issue of printing the band name multiple times //
      // because of the ITU regions added in the this.bands[] array //
      // I import the region from site_information and do a comparison against //
      // the site ITU region and the band.ITU value. //
      if (band.ITU === siteRegion || band.ITU == 123) {
        const startIdx = this.freqToIdx(band.startFreq);
        const endIdx = this.freqToIdx(band.endFreq);
        const startX = this.idxToCanvasX(startIdx);
        const endX = this.idxToCanvasX(endIdx);
        const bandWidth = endX - startX;

        // Calculate the y-position for the band
        const bandY = this.bandPlanCanvasElem.height - bandHeight - bandOffset;

        // Draw the band line with improved styling
        this.bandPlanCtx.strokeStyle = band.color;
        this.bandPlanCtx.lineWidth = 2 * scale;
        this.bandPlanCtx.lineCap = 'round';
        this.bandPlanCtx.beginPath();
        this.bandPlanCtx.moveTo(startX, bandY);
        this.bandPlanCtx.lineTo(endX, bandY);

        // Add a subtle glow effect
        this.bandPlanCtx.shadowColor = band.color;
        this.bandPlanCtx.shadowBlur = 3 * scale;
        this.bandPlanCtx.stroke();

        // Reset shadow for text
        this.bandPlanCtx.shadowColor = 'transparent';
        this.bandPlanCtx.shadowBlur = 0;

        // Set the font for the band label
        let fontSize = this.mobile ? 12 * scale : 10 * scale;
        this.bandPlanCtx.font = `${fontSize}px Inter`;
        this.bandPlanCtx.fillStyle = 'white';
        this.bandPlanCtx.textAlign = 'center';
        this.bandPlanCtx.textBaseline = 'top';

        // Only draw text if it fits fully within the band width
        if (this.bandPlanCtx.measureText(band.name).width <= bandWidth - 4 * scale) {
          const textY = bandY + bandHeight + 2 * scale;

          // Draw the text with a subtle shadow for better visibility
          this.bandPlanCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          this.bandPlanCtx.shadowBlur = 2 * scale;
          this.bandPlanCtx.shadowOffsetY = 1 * scale;
          this.bandPlanCtx.fillText(band.name, (startX + endX) / 2, textY);
          // Reset shadow
          this.bandPlanCtx.shadowColor = 'transparent';
          this.bandPlanCtx.shadowBlur = 0;
          this.bandPlanCtx.shadowOffsetY = 0;
        }
      }
    });

  }



  freqToCanvasX(freq) {
    const idx = this.freqToIdx(freq);
    return this.idxToCanvasX(idx);
  }



  // Helper function to abbreviate band names
  abbreviateBandName(name, width, fontSize) {
    this.bandPlanCtx.font = `${fontSize}px Inter`;
    if (this.bandPlanCtx.measureText(name).width <= width - 4 * this.canvasScale) {
      return name;
    }

    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, Math.floor(width / (fontSize * 0.6)));
    }

    return words.map(word => word[0]).join('');
  }



  // Deterministically map any server id string to a stable 6-digit number
  _idToSixDigits(id) {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0
    }
    return String(h % 900000 + 100000)  // always 100000–999999
  }

  setClients(clients, myId, myUsername) {
    this.clients = clients
    this.myId = myId || null
    this.myUsername = myUsername || null
  }

  // Called from App.svelte with { uuid → "GR · Athens" } built from /users.
  // UUIDs are shared between /users and the WebSocket signal protocol,
  // so this is an exact per-user match that works even for same-frequency users.
  setClientGeo(map) {
    this.clientGeoMap = (map && !Array.isArray(map)) ? map : {}
  }

  // { uuid → name/callsign } from /users, for the listeners who typed one.
  setClientNames(map) {
    this.clientNameMap = (map && !Array.isArray(map)) ? map : {}
  }

  drawClients() {
    const scale    = this.canvasScale
    const fontSize = Math.max(10, Math.round(11 * scale))
    const pillH    = fontSize + 4 * scale
    const tickLen  = 15
    const rowStep  = pillH + 3 * scale
    const padTop   = tickLen + 2 * scale
    const hPad     = Math.round(4 * scale)
    const flagSz   = Math.round(fontSize * 1.15)
    const flagGap  = Math.round(3 * scale)

    this.clientsCtx.font = `bold ${fontSize}px monospace`
    this._clientPills = []

    const geoMap = this.clientGeoMap || {}

    // Build entries for all OTHER users (not me)
    const entries = Object.entries(this.clients)
      .filter(([id, x]) => x[1] < this.waterfallR && x[1] >= this.waterfallL && id !== this.myId)
      .map(([id, range]) => {
        const displayId = id.length <= 12 ? id : this._idToSixDigits(id)
        const geoVal    = geoMap[id]

        let flagImg = null
        if (geoVal) {
          const cc = geoVal.split('·')[0].trim()
          flagImg = this._getFlagImg(cc)
        }

        const cityPart = geoVal && geoVal.includes('·')
          ? geoVal.split('·')[1].trim()
          : geoVal
        // As on a WebSDR: the name/callsign, then the location after it
        // ("SV1BTL-Larissa"); the location alone when there is no name.
        const nameVal = this.clientNameMap && this.clientNameMap[id]
        const place   = geoVal ? cityPart : ''
        const label   = nameVal
          ? (place ? `${nameVal}-${place}` : nameVal)
          : (place || displayId)

        const textW = this.clientsCtx.measureText(label).width
        const flagW = flagImg ? flagSz + flagGap : 0
        const pillW = hPad + flagW + textW + hPad
        const midX  = this.idxToCanvasX(range[1])
        const pillX = midX - pillW / 2
        return { id, fftOffset: range[1], midX, label, flagImg, flagW, flagSz, pillW, pillX, isStar: false }
      })

    // Add own ★ as a frameless entry so it joins the row-assignment and never
    // overlaps another user's pill when sharing the same frequency.
    if (this.myId && this.clients[this.myId]) {
      const myRange = this.clients[this.myId]
      if (myRange[1] < this.waterfallR && myRange[1] >= this.waterfallL) {
        const midX  = this.idxToCanvasX(myRange[1])
        // Your own name/callsign beside the ★ (none while anonymous).
        const myName = this.myUsername && !isAnonymousName(this.myUsername) ? this.myUsername : ''
        const starSize = Math.max(10, Math.round(fontSize * 1.4))
        this.clientsCtx.font = `bold ${starSize}px monospace`
        const starTextW = this.clientsCtx.measureText('★').width
        this.clientsCtx.font = `bold ${fontSize}px monospace`
        const nameW = myName ? flagGap + this.clientsCtx.measureText(myName).width : 0
        const starW = starTextW + nameW + hPad * 2
        const pillX = midX - starTextW / 2 - hPad
        entries.push({ fftOffset: myRange[1], midX, pillW: starW, pillX, isStar: true, myName, starTextW })
      }
    }

    // Greedy left-to-right row assignment (★ entry participates like any other)
    entries.sort((a, b) => a.pillX - b.pillX)
    const rowRights = []
    entries.forEach(e => {
      let row = rowRights.findIndex(r => e.pillX > r + 2 * scale)
      if (row === -1) row = rowRights.length
      rowRights[row] = e.pillX + e.pillW
      e.row = row
    })

    const numRows = Math.max(rowRights.length, 1)
    const targetH = Math.ceil(padTop + numRows * rowStep + 2 * scale)
    if (this.clientsCanvasElem.height !== targetH) {
      this.clientsCanvasElem.height = targetH
      this.clientsCtx.font = `bold ${fontSize}px monospace`
    }
    this.clientsCtx.clearRect(0, 0, this.clientsCanvasElem.width, this.clientsCanvasElem.height)

    // Pass 1 — all tick lines first so pill backgrounds cover any crossing segments
    this.clientsCtx.lineWidth = 1 * scale
    entries.forEach(e => {
      const pillY = padTop + e.row * rowStep
      this.clientsCtx.strokeStyle = e.isStar
        ? 'rgba(255,220,0,0.6)'   // faint yellow tick for own position
        : 'rgba(255,255,255,0.5)' // white tick for others
      this.clientsCtx.beginPath()
      this.clientsCtx.moveTo(e.midX, pillY)
      this.clientsCtx.lineTo(e.midX, 0)
      this.clientsCtx.stroke()
    })

    // Pass 2 — draw pills; ★ entry gets no frame, just the character
    entries.forEach(e => {
      const pillY = padTop + e.row * rowStep

      if (e.isStar) {
        // Own marker: yellow ★, no pill background, no border, no geo
        const starSize = Math.max(10, Math.round(fontSize * 1.4))
        this.clientsCtx.font         = `bold ${starSize}px monospace`
        this.clientsCtx.fillStyle    = 'rgba(255,220,0,0.95)'
        this.clientsCtx.textAlign    = 'center'
        this.clientsCtx.textBaseline = 'middle'
        this.clientsCtx.fillText('★', e.midX, pillY + pillH / 2)
        this.clientsCtx.font         = `bold ${fontSize}px monospace`  // restore
        if (e.myName) {
          this.clientsCtx.textAlign = 'left'
          this.clientsCtx.fillText(e.myName, e.midX + e.starTextW / 2 + flagGap, pillY + pillH / 2)
          this.clientsCtx.textAlign = 'center'
        }
        return
      }

      this._clientPills.push({ id: e.id, x: e.pillX, y: pillY, w: e.pillW, h: pillH, fftOffset: e.fftOffset })

      // Pill background (opaque — covers any tick line passing through)
      this.clientsCtx.fillStyle = 'rgba(0,0,0,0.95)'
      this.clientsCtx.beginPath()
      this.clientsCtx.roundRect(e.pillX, pillY, e.pillW, pillH, 3 * scale)
      this.clientsCtx.fill()

      // Pill border
      this.clientsCtx.strokeStyle = 'rgba(0,200,0,0.7)'
      this.clientsCtx.lineWidth   = 1 * scale
      this.clientsCtx.beginPath()
      this.clientsCtx.roundRect(e.pillX, pillY, e.pillW, pillH, 3 * scale)
      this.clientsCtx.stroke()

      // Flag image
      if (e.flagImg) {
        const fy = pillY + (pillH - e.flagSz) / 2
        this.clientsCtx.drawImage(e.flagImg, e.pillX + hPad, fy, e.flagSz, e.flagSz)
      }

      // Label text
      this.clientsCtx.fillStyle    = 'rgba(0,220,0,0.95)'
      this.clientsCtx.textAlign    = 'left'
      this.clientsCtx.textBaseline = 'middle'
      this.clientsCtx.fillText(e.label, e.pillX + hPad + e.flagW, pillY + pillH / 2)
    })
  }

  // Load a Twemoji flag PNG for the given 2-letter country code (e.g. "GR").
  // Returns the cached HTMLImageElement once loaded, null while still loading.
  // On first call for a given cc, kicks off an async load; redraws clients when done.
  _getFlagImg(cc) {
    if (!cc || cc.length !== 2) return null
    const key = cc.toUpperCase()
    if (key in this._flagCache) return this._flagCache[key] || null
    // Mark as in-flight so we don't fire duplicate requests
    this._flagCache[key] = null
    // Regional Indicator Symbol letters: A=U+1F1E6 … Z=U+1F1FF
    const cp = c => (0x1F1E6 + c.charCodeAt(0) - 65).toString(16)
    // Use the gh/jdecked base — the npm @twemoji/api package ships only the JS,
    // not the image assets (that path 404s). This is the same base twemoji.min.js
    // uses by default.
    const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${cp(key[0])}-${cp(key[1])}.png`
    const img = new Image()
    // No crossOrigin: we only drawImage() the flag (never read pixels back), and
    // requesting it with CORS can make Chrome/Edge reject a cached non-CORS copy
    // of the same CDN PNG -> onerror -> no flag. Plain load works everywhere.
    img.onload  = () => { this._flagCache[key] = img;      this.drawClients() }
    img.onerror = () => { this._flagCache[key] = undefined; /* keep text-only */ }
    img.src = url
    return null
  }

  // The listener whose label is under the mouse, for the hover tooltip:
  // { id, name, freq } or null.
  clientPillAt(canvasX, canvasY) {
    for (const pill of this._clientPills || []) {
      if (canvasX >= pill.x && canvasX <= pill.x + pill.w &&
          canvasY >= pill.y && canvasY <= pill.y + pill.h) {
        return { id: pill.id, name: (this.clientNameMap || {})[pill.id] || '',
                 freq: this.idxToFreq(pill.fftOffset) }
      }
    }
    return null
  }

  checkClientClick(canvasX, canvasY) {
    if (!this._clientPills) return null
    for (const pill of this._clientPills) {
      if (canvasX >= pill.x && canvasX <= pill.x + pill.w &&
          canvasY >= pill.y && canvasY <= pill.y + pill.h) {
        return this.idxToFreq(pill.fftOffset)
      }
    }
    return null
  }

  applyBlur(imageData, width, height, radius) {
    const pixels = imageData.data;
    const tempPixels = new Uint8ClampedArray(pixels);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const i = (py * width + px) * 4;
              r += tempPixels[i];
              g += tempPixels[i + 1];
              b += tempPixels[i + 2];
              a += tempPixels[i + 3];
              count++;
            }
          }
        }

        const i = (y * width + x) * 4;
        pixels[i] = r / count;
        pixels[i + 1] = g / count;
        pixels[i + 2] = b / count;
        pixels[i + 3] = a / count;
      }
    }

    return imageData;
  }

  setWaterfallRange(waterfallL, waterfallR) {
    if (waterfallL >= waterfallR) {
      return;
    }

    const width = waterfallR - waterfallL;
    // If there is out of bounds, fix the bounds
    if (waterfallL < 0 && waterfallR > this.waterfallMaxSize) {
      waterfallL = 0;
      waterfallR = this.waterfallMaxSize;
    } else if (waterfallL < 0) {
      waterfallL = 0;
      waterfallR = width;
    } else if (waterfallR > this.waterfallMaxSize) {
      waterfallR = this.waterfallMaxSize;
      waterfallL = waterfallR - width;
    }

    const prevL = this.waterfallL;
    const prevR = this.waterfallR;
    this.waterfallL = waterfallL;
    this.waterfallR = waterfallR;

    // BUG FIX (CRASH): sending while the socket is connecting, closed, or null
    // (e.g. during a reconnect race with a concurrent zoom/pan gesture) throws
    // InvalidStateError.  Only send if the socket is fully open.
    if (this.waterfallSocket && this.waterfallSocket.readyState === WebSocket.OPEN) {
      this.waterfallSocket.send(JSON.stringify({
        cmd: 'window',
        l: this.waterfallL,
        r: this.waterfallR
      }));
    }

    const newCanvasX1 = this.idxToCanvasX(prevL)
    const newCanvasX2 = this.idxToCanvasX(prevR)
    const newCanvasWidth = newCanvasX2 - newCanvasX1

    this.ctx.drawImage(this.canvasElem, 0, 0, this.canvasWidth, this.canvasHeight, newCanvasX1, 0, newCanvasWidth, this.canvasHeight)
    // Every 3D row keeps its own FFT range, so the view only needs the new window.
    if (this.view3d) this.view3d.setView(this.waterfallL, this.waterfallR)


    // Special case for zoom out or panning, blank the borders
    if ((prevR - prevL) <= (waterfallR - waterfallL) + 1) {
      this.ctx.fillRect(0, 0, newCanvasX1, this.canvasHeight);
      this.ctx.fillRect(newCanvasX2, 0, this.canvasWidth - newCanvasX2, this.canvasHeight);
    }

    this.updateGraduation();
    this.updateBandPlan();
    this.drawSpectrogram();
  }

  getWaterfallRange() {
    return [this.waterfallL, this.waterfallR]
  }

  setWaterfallLagTime(lagTime) {
    this.lagTime = Math.max(0, lagTime)
  }

  setOffset(offset) {
    this.waterfallColourShift = offset
  }
  setMinOffset(offset) {
    this.minWaterfall = offset
  }
  setMaxOffset(offset) {
    this.maxWaterfall = offset
  }

  setAutoAdjustConfig(config) {
    this.autoLevel.setConfig(config);
  }

  enableAutoAdjust(config) {
    this.autoAdjust = true;
    if (config) this.autoLevel.setConfig(config);
    // Start from the current spectrum, not whatever an earlier run or
    // another band left behind.
    this.autoLevel.reset();
    this.autoLevel.setColormap(this.colormap);
  }

  getAutoAdjustStatus() {
    const st = this.autoLevel.stats
    if (!Number.isFinite(st.snrDb)) return { adaptiveEnabled: true, condition: "WAITING", avgSNR: "0.0" }
    let condition = "VERY_POOR"
    if (st.snrDb > 50) condition = "EXCELLENT"
    else if (st.snrDb > 35) condition = "GOOD"
    else if (st.snrDb > 25) condition = "MODERATE"
    else if (st.snrDb > 15) condition = "POOR"
    return {
      adaptiveEnabled: true,
      condition,
      avgSNR: st.snrDb.toFixed(1),
      noiseFloor: st.floorDb.toFixed(1),
      sigma: st.sigmaDb.toFixed(1),
    }
  }

  setAlpha(alpha) {
    this.spectrumAlpha = alpha
  }

  setColormapArray(colormap) {
    this.colormap = computeColormapArray(colormap)
    this.autoLevel.setColormap(this.colormap)
    if (this.view3d) this.view3d.setColormap(this.colormap)
  }

  setColormap(name) {
    this.setColormapArray(getColormap(name))
  }

  setUserID(userID) {
    this.waterfallSocket.send(JSON.stringify({
      cmd: 'userid',
      userid: userID
    }))
  }


  // bysv2amkMobile
  // Compute waterfall canvas height from BOTH flags (spectrum + big) so the
  // two toggles no longer clobber each other. Priority: "big" wins; otherwise
  // spectrum-on halves the normal height.
  _applyWaterfallHeight(mobile) {
    const dpr = window.devicePixelRatio;
    // The phone layout (Device.isMobile) — setCanvasWidth() sizes its
    // spectrum from this too.
    this.mobileLayout = !!mobile;
    let base;
    if (mobile) {
      // Was 150 / 25 / 50: on a 412 px phone that left a 23 px waterfall.
      base = this.big ? 200 : (this.spectrum ? 45 : 90);
    } else {
      base = this.big ? 300 : (this.spectrum ? 100 : 200);
    }
    this.wfheight = base * dpr;
    if (typeof this.resizeCallback == 'function') {
      this.resizeCallback();
    }
  }

  setSpectrum(spectrum,mobile) {
    this.spectrum = spectrum
    this._applyWaterfallHeight(mobile)
  }

  setWaterfallBig(big,mobile) {
    this.big = big
    this._applyWaterfallHeight(mobile)
  }
 // bysv2amkMobile end
   setWaterfall(waterfall) {
     this.waterfall = waterfall
   }

  resetRedrawTimeout(timeout) {
    return;
    if (this.updateTimeout !== undefined) {
      clearTimeout(this.updateTimeout)
    }
    this.updateTimeout = setTimeout(this.redrawWaterfall.bind(this), timeout)
  }

  canvasWheel(e) {
    const computedStyle = window.getComputedStyle(e.target);
    const cursorStyle = computedStyle.cursor;
    if (cursorStyle == 'resize') {
      return;
    }
    // For UI to pass custom zoom range
    const x = (e.coords || { x: this.getMouseX(this.spectrumCanvasElem, e) }).x
    e.preventDefault()

    const zoomAmount = e.deltaY || e.scale
    const l = this.waterfallL
    const r = this.waterfallR
    // For UI to pass in a custom scale amount
    const scale = e.scaleAmount || 0.85

    // Prevent zooming beyond a certain point
    if (r - l <= 128 && zoomAmount < 0) {
      return false
    }
    if (zoomAmount > 0) {
      if (this.zoomFactor != 1) {
        this.zoomFactor = this.zoomFactor - 1
      }
    } else if (zoomAmount < 0) {

      this.zoomFactor = this.zoomFactor + 1
    }



    const centerfreq = (r - l) * x / this.canvasWidth + l
    let widthL = centerfreq - l
    let widthR = r - centerfreq
    if (zoomAmount < 0) {
      widthL *= scale
      widthR *= scale
    } else if (zoomAmount > 0) {
      widthL *= 1 / scale
      widthR *= 1 / scale
    }
    const waterfallL = Math.round(centerfreq - widthL)
    const waterfallR = Math.round(centerfreq + widthR)

    this.setWaterfallRange(waterfallL, waterfallR)

    return false
  }

  mouseMove(e) {
    // Clear the waterfall queue to remove old data
    // Figure out how much is dragged
    const mouseMovement = e.movementX
    const frequencyMovement = Math.round(mouseMovement / this.canvasElem.getBoundingClientRect().width * (this.waterfallR - this.waterfallL))


    const newL = this.waterfallL - frequencyMovement
    const newR = this.waterfallR - frequencyMovement
    this.setWaterfallRange(newL, newR)
  }

  spectrumMouseMove(e) {
    const x = this.getMouseX(this.spectrumCanvasElem, e)
    const freq = this.canvasXtoFreq(x)
    this.spectrumFreq = freq
    this.spectrumX = x
  }

  // Hover over the waterfall: the spectrum draws its dashed cursor line at the
  // same fraction (0-1) of the panel width.
  setHoverFraction(f) {
    this.spectrumX = f * this.spectrumCanvasElem.width
    this.spectrumFreq = this.canvasXtoFreq(f * this.canvasWidth)
  }

  spectrumMouseLeave(e) {
    this.spectrumFreq = undefined
    this.spectrumX = undefined
  }
}