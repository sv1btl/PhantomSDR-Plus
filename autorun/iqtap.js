/**
 * iqtap.js — an AudioTap in the server's IQ mode, for the DRM helper.
 *
 * spectrumserver grants demodulation "IQ" to internal taps on the raw PCM
 * codec only (src/signal.cpp): it then sends zero-IF complex baseband as
 * stereo int16, I left and Q right, with no AGC, noise blanker or noise gate.
 * The window is centred on the DRM channel, ±5 kHz, which carries the 4.5 to
 * 10 kHz DRM30 modes.
 *
 * Events: as AudioTap, but 'iq' replaces 'pcm' and carries an Int16Array of
 * interleaved I/Q, ready for ubersdr-drm's stdin.
 */
import { AudioTap } from './audiotap.js';

const HALF_SPAN_HZ = 5000;

export class IQTap extends AudioTap {
    /**
     * @param {object} opts  AudioTap options; opts.dialHz is the DRM centre.
     */
    constructor(opts) {
        super({ ...opts, mode: 'IQ', agc: false, label: opts.label ?? `IQ@${opts.dialHz}` });
        this.on('pcm', (f32) => {
            // AudioTap hands back int16/32768; undo it exactly for the pipe.
            const i16 = new Int16Array(f32.length);
            for (let i = 0; i < f32.length; i++) i16[i] = Math.round(f32[i] * 32768);
            this.emit('iq', i16);
        });
    }

    /**
     * The rate the I/Q really arrives at: the channel is a whole number of FFT
     * bins (rounded up to a multiple of 4, as the browser computes
     * trueAudioSps), so it sits slightly off the nominal audio_max_sps — 12016 Hz
     * on a 60 Msps RX-888. ubersdr-drm paces its reads to the rate it is told,
     * so telling it 12000 would let a backlog grow by the difference.
     */
    get trueSampleRate() {
        const i = this.info;
        if (!i) return 12000;
        const bins = Math.ceil(i.audio_max_sps * i.fft_result_size / i.sps / 4) * 4;
        return bins / i.fft_result_size * i.sps;
    }

    /** Move the IQ window to a new centre frequency. */
    retune(centreHz) {
        this.dialHz = centreHz;
        if (this.info) this._sendWindow(this.info);
    }

    _tune(info) {
        this._send({ cmd: 'set_codec', codec: 'pcm' });
        this._sendWindow(info);
        // The server debounces demodulation changes for 100 ms from connection
        // (see AudioTap._tune), so repeat once it has passed.
        setTimeout(() => this._sendWindow(info), 250);
    }

    _sendWindow(info) {
        const binOf = (f) => ((f - info.basefreq) / info.total_bandwidth) * info.fft_result_size;
        const m = binOf(this.dialHz);
        const l = Math.floor(binOf(this.dialHz - HALF_SPAN_HZ));
        const r = Math.ceil(binOf(this.dialHz + HALF_SPAN_HZ));
        this._send({ cmd: 'demodulation', demodulation: 'IQ' });
        this._send({ cmd: 'window', l, m, r });
    }

    /** True when the centre ±5 kHz lies inside this receiver's coverage. */
    covers(centreHz) {
        const i = this.info;
        if (!i) return false;
        return centreHz - HALF_SPAN_HZ >= i.basefreq &&
               centreHz + HALF_SPAN_HZ <= i.basefreq + i.total_bandwidth;
    }
}
