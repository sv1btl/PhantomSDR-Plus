class PhantomSDRAudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = (options && options.processorOptions) || {};
    this.sampleRateHint = processorOptions.sampleRate || sampleRate || 12000;
    // ── Audio buffer latency tuning ─────────────────────────────────────────
    // These two lines control the worklet ring buffer size and startup gate.
    // Both have hard floors enforced by Math.max() — values passed from
    // audio.js below these floors are silently clamped and have no effect.
    //
    //   maxBufferedFrames  — ring buffer ceiling in samples. When the queue
    //                        exceeds this, the oldest chunks are dropped until
    //                        it fits. The Math.max(1024,...) floor = 85ms at
    //                        12kHz — do not lower the floor below 512 or the
    //                        worklet will drop frames faster than it can fill.
    //                        Controlled via processorOptions.maxBufferedSeconds
    //                        in audio.js (search "processorOptions").
    //                        Current floor: 1024 frames = 85ms @ 12kHz
    //                        Current ceiling from audio.js: 0.25s = 3000 frames
    //
    //   minStartFrames     — frames that must be buffered before playback
    //                        starts (or restarts after underrun). The
    //                        Math.max(256,...) floor = 21ms at 12kHz, which is
    //                        2 AudioWorklet quanta — the practical minimum to
    //                        avoid an immediate underrun on start.
    //                        Controlled via processorOptions.minStartSeconds
    //                        in audio.js (search "processorOptions").
    //                        Current floor: 256 frames = 21ms @ 12kHz
    //
    // If raising maxBufferedSeconds in audio.js has no effect on choppy audio,
    // check whether the value × sampleRate is still hitting the floor here.
    // Formula: effective ceiling = Math.max(1024, maxBufferedSeconds × 12000)
    // At 0.15s: max(1024, 1800) = 1800 ✓ (floor not active)
    // At 0.08s: max(1024,  960) = 1024 ✗ (clamped — audio.js change wasted)
    // ────────────────────────────────────────────────────────────────────────
    this.maxBufferedFrames = Math.max(1024, Math.floor((processorOptions.maxBufferedSeconds || 1.5) * this.sampleRateHint));

    this.queue = [];
    this.current = null;
    this.currentIndex = 0;
    this.bufferedFrames = 0;
    this.droppedFrames = 0;
    this.underruns = 0;
    // FIX: minStartSeconds was being passed in via processorOptions by
    // audio.js but never read here — the start gate was silently hardcoded
    // to 0.06s no matter what the caller configured, making that config
    // value dead code. Honor it now; fall back to the old hardcoded value
    // only if the caller doesn't supply one.
    const minStartSeconds = (typeof processorOptions.minStartSeconds === 'number' && processorOptions.minStartSeconds > 0)
      ? processorOptions.minStartSeconds
      : 0.06;
    this.minStartFrames = Math.max(256, Math.floor(this.sampleRateHint * minStartSeconds));
    this.started = false;
    this._lastStatsFrame = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'push' && data.pcm) {
        this._pushChunk(data.pcm, data.channels || 1);
      } else if (data.type === 'reset') {
        this.queue = [];
        this.current = null;
        this.currentIndex = 0;
        this.bufferedFrames = 0;
        this.droppedFrames = 0;  // reset per-session — lifetime total would persist across reconnects
        this.underruns = 0;
        this.started = false;
      }
    };
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
    let totalBuffered = this.bufferedFrames;

    // Drop oldest queued audio if buffering runs too deep.
    while (totalBuffered + frames > this.maxBufferedFrames && this.queue.length > 0) {
      const old = this.queue.shift();
      this.droppedFrames += old.frames;
      this.bufferedFrames -= old.frames;
      if (this.bufferedFrames < 0) this.bufferedFrames = 0;
      totalBuffered = this.bufferedFrames;
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
      if (totalBuffered < this.minStartFrames) {
        for (let i = 0; i < left.length; i++) {
          left[i] = 0;
          if (output[1]) right[i] = 0;
        }
        return true;
      }
      this.started = true;
    }

    for (let i = 0; i < left.length; i++) {
      if (!this.current && !this._beginNextChunk()) {
        left[i] = 0;
        if (output[1]) right[i] = 0;
        hadUnderrun = true;
        continue;
      }

      const chunk = this.current;
      if (chunk.channels === 2) {
        const base = this.currentIndex * 2;
        left[i] = chunk.samples[base] || 0;
        // Only write right separately if a second output channel actually
        // exists. If output[1] is absent, right===left (same array reference)
        // and writing right[i] would overwrite left[i] with the wrong sample.
        if (output[1]) right[i] = chunk.samples[base + 1] || 0;
      } else {
        const v = chunk.samples[this.currentIndex] || 0;
        left[i] = v;
        if (output[1]) right[i] = v;
      }

      this.currentIndex++;
      this.bufferedFrames--;
      if (this.bufferedFrames < 0) this.bufferedFrames = 0;

      if (this.currentIndex >= chunk.frames) {
        this.current = null;
        this.currentIndex = 0;
      }
    }

    if (hadUnderrun) {
      this.underruns++;
      // Reset the start gate so recovery waits for minStartFrames before
      // resuming. Without this, playback restarts on the very next sample —
      // potentially with only 1–2 frames buffered — causing choppy audio
      // on recovery rather than a clean restart.
      this.started = false;
    }

    this._lastStatsFrame += left.length;
    if (this._lastStatsFrame >= 1024) {
      this._lastStatsFrame = 0;
      this.port.postMessage({
        type: 'stats',
        bufferedFrames: this.bufferedFrames,
        droppedFrames: this.droppedFrames,
        underruns: this.underruns
      });
    }

    return true;
  }
}

registerProcessor('phantomsdr-audio-stream', PhantomSDRAudioStreamProcessor);