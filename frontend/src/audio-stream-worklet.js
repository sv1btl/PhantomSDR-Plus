// Cushion drain tuning (see _resetDrain()).
const DRAIN_FLOOR_S = 0.070;       // lowest level the drain may leave: 70 + one 35 ms frame covers a ~105 ms gap
const DRAIN_START_EXTRA_S = 0.010; // start/restart gate = floor + this
const DRAIN_STEP_S = 0.020;        // floor raised by this after every underrun
const DRAIN_MAX_EXTRA_S = 0.100;   // ... up to this much in a session
const DRAIN_GRACE_S = 6;           // the stream's first seconds have their own gaps: no history, no floor steps
const DRAIN_RELAX_S = 120;         // ... and lowered by one step after this long without one
const DRAIN_WINDOW_S = 30;         // seconds of per-second minima watched
const DRAIN_WARMUP_S = 15;         // seconds of history before any trimming
const DRAIN_SHORT_S = 2;           // the most recent stretch must also be above the floor
const DRAIN_HYST_S = 0.005;        // trim only while this far above the floor
const DRAIN_RATE = 0.0025;         // extra frames read per output frame while trimming

class PhantomSDRAudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = (options && options.processorOptions) || {};
    this.sampleRateHint = processorOptions.sampleRate || sampleRate || 12000;
    // ── Audio buffer latency tuning ─────────────────────────────────────────
    // This worklet holds the ring buffer that actually decides what a listener
    // hears: playPCM() in audio.js hands PCM over and returns immediately, so
    // its own bufferLimit/bufferThreshold reach only the fallback scheduler.
    // The two dimensions below are the real ones, and both have hard floors
    // enforced by Math.max() — values below those floors are silently clamped.
    //
    //   maxBufferedFrames  — ring buffer ceiling in samples. A chunk that will
    //                        not fit is dropped on arrival (see _pushChunk).
    //                        The Math.max(1024,...) floor = 85ms at 12kHz — do
    //                        not lower the floor below 512 or the worklet will
    //                        drop frames faster than it can fill.
    //                        Fed by processorOptions.maxBufferedSeconds, which
    //                        audio.js derives from bufferLimit — the buffer
    //                        preset a listener picks in the UI.
    //                        Current floor: 1024 frames = 85ms @ 12kHz
    //
    //   minStartFrames     — frames that must be buffered before playback
    //                        starts (or restarts after underrun). The
    //                        Math.max(256,...) floor = 21ms at 12kHz, which is
    //                        2 AudioWorklet quanta — the practical minimum to
    //                        avoid an immediate underrun on start.
    //                        Fed by processorOptions.minStartSeconds, which
    //                        audio.js derives from bufferThreshold.
    //                        Current floor: 256 frames = 21ms @ 12kHz
    //
    // Neither is fixed for the life of the node: a 'config' message re-runs
    // _applyConfig(), which is how a mid-session buffer change is heard.
    //
    // If raising the preset has no effect on choppy audio, check whether the
    // value × sampleRate is still hitting the floor here.
    // Formula: effective ceiling = Math.max(1024, maxBufferedSeconds × 12000)
    // At 0.25s: max(1024, 3000) = 3000 ✓ (floor not active)
    // At 0.08s: max(1024,  960) = 1024 ✗ (clamped — the change is wasted)
    // ────────────────────────────────────────────────────────────────────────
    // Both are computed in _applyConfig() below, which also runs for every
    // 'config' message so a listener changing the buffer preset mid-session
    // is heard immediately instead of on the next page load.
    this.maxBufferedFrames = 0;
    this.minStartFrames = 0;

    this.queue = [];
    this.current = null;
    this.currentIndex = 0;
    this.bufferedFrames = 0;
    this.droppedFrames = 0;
    this.underruns = 0;
    this._resetDrain();
    this._applyConfig(processorOptions);
    this.started = false;
    this._lastStatsFrame = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'push' && data.pcm) {
        this._pushChunk(data.pcm, data.channels || 1);
      } else if (data.type === 'config') {
        this._applyConfig(data);
      } else if (data.type === 'reset') {
        this.queue = [];
        this.current = null;
        this.currentIndex = 0;
        this.bufferedFrames = 0;
        this.droppedFrames = 0;  // reset per-session — lifetime total would persist across reconnects
        this.underruns = 0;
        this.started = false;
        this._resetDrain();
      }
    };
  }

  /**
   * (Re)compute the ring buffer geometry from maxBufferedSeconds /
   * minStartSeconds. Called once from the constructor and again for every
   * 'config' message — see setAudioBufferDelay() in audio.js. The Math.max()
   * floors documented in the constructor still apply, and an absent or
   * nonsensical value leaves that dimension at whatever it already was
   * (falling back to the historical default on the constructor's first call).
   */
  _applyConfig(opts) {
    const o = opts || {};
    if (typeof o.maxBufferedSeconds === 'number' && o.maxBufferedSeconds > 0) {
      this.maxBufferedFrames = Math.max(1024, Math.floor(o.maxBufferedSeconds * this.sampleRateHint));
    } else if (!this.maxBufferedFrames) {
      this.maxBufferedFrames = Math.max(1024, Math.floor(1.5 * this.sampleRateHint));
    }
    if (typeof o.minStartSeconds === 'number' && o.minStartSeconds > 0) {
      this.minStartFrames = Math.max(256, Math.floor(o.minStartSeconds * this.sampleRateHint));
    } else if (!this.minStartFrames) {
      this.minStartFrames = Math.max(256, Math.floor(0.06 * this.sampleRateHint));
    }
    if (typeof o.drain === 'boolean') this.drainEnabled = o.drain;
    else if (this.drainEnabled === undefined) this.drainEnabled = true;
    // The listener's own buffer preset is the drain's lower bound as well.
    this.presetFloorFrames = Math.floor((typeof o.minStartSeconds === 'number' && o.minStartSeconds > 0
      ? o.minStartSeconds : (this.presetFloorFrames || 0) / this.sampleRateHint) * this.sampleRateHint);
    // A shrunken ceiling is not enforced retroactively here: the queue drains
    // at real time and the next _pushChunk() trims it, so there is no need to
    // throw away audio that is already buffered and about to be played.
  }

  // ── Cushion drain ──────────────────────────────────────────────────────────
  // Without it the ring keeps whatever backlog the start or a late frame left
  // (measured 2026-10-16: ~115 ms for good, on a stream that needs ~60). The
  // drain plays very slightly fast (DRAIN_RATE, ~4 cents, inaudible) while the
  // LOWEST level of the last DRAIN_WINDOW_S seconds is still above the floor,
  // so a gap seen in that window pauses it. The floor is DRAIN_FLOOR_S — enough
  // to ride a ~105 ms gap in the 35 ms frame stream (live gaps reached 92 ms) — or the listener's preset if
  // larger, plus DRAIN_STEP_S for every underrun in the session.
  _resetDrain() {
    this.readPhase = 0;          // fractional read position between two frames
    this.secMinFrames = Infinity; this.secFrames = 0;
    this.minRing = [];           // per-second minimum levels, newest last
    this.shortMinFrames = Infinity; this.shortFrames = 0;
    this.lastShortMin = 0;
    this.extraFloorFrames = 0;
    this.secsSinceUnderrun = 0;
    this.playedFrames = 0;       // since the first start of this stream
    this.trimmedFrames = 0;
    this.trimming = false;
  }

  _floorFrames() {
    const base = Math.max(DRAIN_FLOOR_S * this.sampleRateHint, this.presetFloorFrames || 0);
    return Math.floor(base + this.extraFloorFrames);
  }

  // Start gate: with the drain on, start (and restart after an underrun) at the
  // floor plus a little, so the first late frames of a session are covered; the
  // drain removes the surplus later. Without the drain, the old gate.
  _startFrames() {
    if (!this.drainEnabled) return this.minStartFrames;
    return Math.max(this.minStartFrames, Math.floor(this._floorFrames() + DRAIN_START_EXTRA_S * this.sampleRateHint));
  }

  _windowMinFrames() {
    let m = Infinity;
    for (const v of this.minRing) if (v < m) m = v;
    return m;
  }

  // Called once per render quantum with the level left after it.
  _drainTrack(level, frames) {
    this.playedFrames += frames;
    if (this.playedFrames < DRAIN_GRACE_S * this.sampleRateHint) { this.trimming = false; return; }
    if (level < this.secMinFrames) this.secMinFrames = level;
    if (level < this.shortMinFrames) this.shortMinFrames = level;
    this.secFrames += frames; this.shortFrames += frames;
    if (this.shortFrames >= this.sampleRateHint * DRAIN_SHORT_S) {
      this.lastShortMin = this.shortMinFrames; this.shortMinFrames = Infinity; this.shortFrames = 0;
    }
    if (this.secFrames >= this.sampleRateHint) {
      this.minRing.push(this.secMinFrames);
      // A one-off long gap should not cost the rest of the session: give the
      // extra floor back step by step once the link has been clean a while.
      if (++this.secsSinceUnderrun >= DRAIN_RELAX_S && this.extraFloorFrames > 0) {
        this.extraFloorFrames = Math.max(0, this.extraFloorFrames - DRAIN_STEP_S * this.sampleRateHint);
        this.secsSinceUnderrun = 0;
      }
      if (this.minRing.length > DRAIN_WINDOW_S) this.minRing.shift();
      this.secMinFrames = Infinity; this.secFrames = 0;
    }
    const floor = this._floorFrames(), hyst = DRAIN_HYST_S * this.sampleRateHint;
    this.trimming = this.drainEnabled && this.started
      && this.minRing.length >= DRAIN_WARMUP_S
      && this._windowMinFrames() > floor + hyst
      && this.lastShortMin > floor + hyst;
  }

  // Sample `ahead` frames after the read position (0 or 1), across chunks.
  _peek(ahead, ch) {
    const c = this.current;
    if (!c) return 0;
    let idx = this.currentIndex + ahead, chunk = c;
    if (idx >= chunk.frames) {
      chunk = this.queue[0];
      if (!chunk || chunk.channels !== c.channels) chunk = c, idx = c.frames - 1;
      else idx -= c.frames;
    }
    return chunk.channels === 2 ? (chunk.samples[idx * 2 + ch] || 0) : (chunk.samples[idx] || 0);
  }

  // Consume one frame; false when nothing is left.
  _advanceFrame() {
    this.currentIndex++;
    this.bufferedFrames--;
    if (this.bufferedFrames < 0) this.bufferedFrames = 0;
    if (this.currentIndex >= this.current.frames) {
      this.current = null;
      this.currentIndex = 0;
      return this._beginNextChunk();
    }
    return true;
  }

  _pushChunk(pcm, channels) {
    const samples = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
    const ch = channels === 2 ? 2 : 1;
    const frames = ch === 2 ? Math.floor(samples.length / 2) : samples.length;
    if (frames <= 0) return;

    // bufferedFrames is incremented when a chunk is pushed and decremented
    // per-frame consumed in process() — it therefore already includes any
    // remaining frames from the in-progress chunk (this.current).  Adding
    // currentRemaining on top double-counts those frames, making the buffer
    // look ~2× fuller than it is and causing premature drops.
    const totalBuffered = this.bufferedFrames;

    // Overflow: drop the INCOMING chunk, not the oldest queued one.
    //
    // Either choice discards the same amount of audio and leaves the same
    // steady-state latency, but dropping the oldest splices the waveform right
    // where the reader is about to arrive — a discontinuity in the middle of
    // whatever the listener is hearing this instant, and it moves the whole
    // buffered timeline forward under a reader that is already mid-chunk.
    // Dropping the newest puts the splice at the write end instead and leaves
    // everything already buffered contiguous with what is playing.
    //
    // The queue.length guard is the safety valve: a single chunk larger than
    // the whole ceiling would otherwise be refused forever and nothing would
    // ever play. An empty queue always accepts, whatever the size.
    if (totalBuffered + frames > this.maxBufferedFrames && this.queue.length > 0) {
      this.droppedFrames += frames;
      return;
    }

    this.queue.push({ samples, channels: ch, frames });
    this.bufferedFrames += frames;
  }

  _beginNextChunk() {
    if (this.queue.length === 0) {
      this.current = null;
      this.currentIndex = 0;
      return false;
    }
    this.current = this.queue.shift();
    this.currentIndex = 0;
    return true;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const left = output[0];
    const right = output[1] || output[0];
    let hadUnderrun = false;

    // bufferedFrames already includes the remaining frames in this.current
    // (they were counted when the chunk was pushed, and decremented per-sample
    // as they are consumed).  Do NOT add currentRemaining — that double-counts
    // those frames, makes the buffer look ~2× fuller than it is, and delays
    // the restart gate far longer than intended after an underrun.
    const totalBuffered = this.bufferedFrames;
    if (!this.started) {
      if (totalBuffered < this._startFrames()) {
        for (let i = 0; i < left.length; i++) {
          left[i] = 0;
          if (output[1]) right[i] = 0;
        }
        return true;
      }
      this.started = true;
    }

    // Read position = currentIndex + readPhase. Normally it advances exactly
    // one frame per output sample with readPhase 0, which plays the chunks
    // untouched, as before. While trimming it advances 1 + DRAIN_RATE and the
    // output is interpolated between the two neighbouring frames.
    const step = this.trimming ? 1 + DRAIN_RATE : 1;
    for (let i = 0; i < left.length; i++) {
      if (!this.current && !this._beginNextChunk()) {
        left[i] = 0;
        if (output[1]) right[i] = 0;
        hadUnderrun = true;
        continue;
      }

      const f = this.readPhase;
      if (this.current.channels === 2) {
        const l0 = this._peek(0, 0), r0 = this._peek(0, 1);
        left[i] = f ? l0 + (this._peek(1, 0) - l0) * f : l0;
        // Only write right separately if a second output channel actually
        // exists. If output[1] is absent, right===left (same array reference)
        // and writing right[i] would overwrite left[i] with the wrong sample.
        if (output[1]) right[i] = f ? r0 + (this._peek(1, 1) - r0) * f : r0;
      } else {
        const v0 = this._peek(0, 0);
        const v = f ? v0 + (this._peek(1, 0) - v0) * f : v0;
        left[i] = v;
        if (output[1]) right[i] = v;
      }

      this.readPhase += step;
      while (this.readPhase >= 1) {
        this.readPhase -= 1;
        if (!this._advanceFrame()) { this.readPhase = 0; break; }
      }
      if (step !== 1) this.trimmedFrames += DRAIN_RATE;
    }

    if (hadUnderrun) {
      this.underruns++;
      // Reset the start gate so recovery waits for the start level before
      // resuming. Without this, playback restarts on the very next sample —
      // potentially with only 1–2 frames buffered — causing choppy audio
      // on recovery rather than a clean restart.
      this.started = false;
      this.readPhase = 0;
      // The link just showed a gap the cushion could not cover: keep more
      // from now on, and let the drain start over from what it sees next.
      if (this.drainEnabled && this.playedFrames >= DRAIN_GRACE_S * this.sampleRateHint) {
        this.extraFloorFrames = Math.min(this.extraFloorFrames + DRAIN_STEP_S * this.sampleRateHint,
          DRAIN_MAX_EXTRA_S * this.sampleRateHint);
        this.minRing = [];
        this.secsSinceUnderrun = 0;
      }
    }
    this._drainTrack(this.bufferedFrames, left.length);

    this._lastStatsFrame += left.length;
    if (this._lastStatsFrame >= 1024) {
      this._lastStatsFrame = 0;
      const ms = (v) => (Number.isFinite(v) ? v / this.sampleRateHint * 1000 : null);
      this.port.postMessage({
        type: 'stats',
        bufferedFrames: this.bufferedFrames,
        droppedFrames: this.droppedFrames,
        underruns: this.underruns,
        drain: {
          enabled: !!this.drainEnabled,
          trimming: this.trimming,
          trimmedMs: ms(this.trimmedFrames),
          floorMs: ms(this._floorFrames()),
          windowMinMs: this.minRing.length ? ms(this._windowMinFrames()) : null,
          windowSec: this.minRing.length,
        },
      });
    }

    return true;
  }
}

registerProcessor('phantomsdr-audio-stream', PhantomSDRAudioStreamProcessor);