class PhantomSDRAudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = (options && options.processorOptions) || {};
    this.sampleRateHint = processorOptions.sampleRate || sampleRate || 12000;
    this.maxBufferedFrames = Math.max(4096, Math.floor((processorOptions.maxBufferedSeconds || 1.5) * this.sampleRateHint));

    this.queue = [];
    this.current = null;
    this.currentIndex = 0;
    this.bufferedFrames = 0;
    this.droppedFrames = 0;
    this.underruns = 0;
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
        this.underruns = 0;
      }
    };
  }

  _pushChunk(pcm, channels) {
    const samples = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
    const ch = channels === 2 ? 2 : 1;
    const frames = ch === 2 ? Math.floor(samples.length / 2) : samples.length;
    if (frames <= 0) return;

    // Drop oldest queued audio if buffering runs too deep.
    while (this.bufferedFrames + frames > this.maxBufferedFrames && this.queue.length > 0) {
      const old = this.queue.shift();
      this.droppedFrames += old.frames;
      this.bufferedFrames -= old.frames;
      if (this.bufferedFrames < 0) this.bufferedFrames = 0;
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

    for (let i = 0; i < left.length; i++) {
      if (!this.current && !this._beginNextChunk()) {
        left[i] = 0;
        if (output[1]) right[i] = 0;
        this.underruns++;
        continue;
      }

      const chunk = this.current;
      if (chunk.channels === 2) {
        const base = this.currentIndex * 2;
        left[i] = chunk.samples[base] || 0;
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
