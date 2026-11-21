// Byte helpers and the request/response discipline every CAT protocol
// shares: one exchange on the wire at a time, a reply picked out of whatever
// else the rig happens to be saying, and a timeout when it says nothing.
//
// Ported from Desktop PhantomSDR+ (src/rig/link.js), with Node's Buffer
// replaced by plain Uint8Array so it runs in a browser tab.

export function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Index of the byte sequence `seq` in `buf` at or after `from`, or -1. */
export function indexOfSeq(buf, seq, from = 0) {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function startsWithBytes(buf, seq, at = 0) {
  if (buf.length < at + seq.length) return false;
  for (let j = 0; j < seq.length; j++) if (buf[at + j] !== seq[j]) return false;
  return true;
}

const enc = new TextEncoder();
const dec = new TextDecoder("latin1");
export const ascii = (text) => enc.encode(text);
export const text = (bytes) => dec.decode(bytes);

/** Frames ending in a terminator byte: ';' for Kenwood/Yaesu. */
export function terminatedFramer(terminator) {
  const byte = terminator.charCodeAt(0);
  return (buffer) => {
    const frames = [];
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === byte) {
        frames.push(buffer.subarray(start, i + 1));
        start = i + 1;
      }
    }
    return { frames, rest: buffer.subarray(start) };
  };
}

/**
 * Serialised exchanges over a transport: { write(bytes), close(),
 * onData(fn), onClose(fn) }.
 *
 * `framer(buffer)` cuts the receive buffer into frames and returns what is
 * left over. Leave it out for protocols with no framing at all (the old
 * five-byte Yaesu CAT) and ask for a byte count instead.
 */
export class Link {
  constructor(transport, framer = null) {
    this.transport = transport;
    this.framer = framer;
    this.rx = new Uint8Array(0);
    this.waiter = null;
    this.chain = Promise.resolve();
    this.closed = false;
    // Frames that answer no question - an Icom's scope stream, transceive
    // broadcasts - go to these listeners (onFrame).
    this.frameListeners = [];
    transport.onData((chunk) => this._onData(chunk));
    transport.onClose(() => {
      this.closed = true;
      if (this.waiter) this.waiter.fail(new Error("Connection closed"));
    });
  }

  _onData(chunk) {
    this.rx = this.rx.length ? concatBytes(this.rx, chunk) : chunk;
    // Nobody listening and nothing to frame: a chatty rig must not grow this
    // buffer for ever between polls.
    if (this.rx.length > 65536) this.rx = this.rx.slice(this.rx.length - 4096);

    if (!this.framer) {
      if (this.waiter && this.waiter.bytes && this.rx.length >= this.waiter.bytes) {
        const frame = this.rx.slice(0, this.waiter.bytes);
        this.rx = this.rx.slice(this.waiter.bytes);
        this.waiter.done(frame);
      }
      return;
    }

    const { frames, rest } = this.framer(this.rx);
    this.rx = rest.slice();
    for (const frame of frames) {
      if (this.waiter && this.waiter.accept && this.waiter.accept(frame)) {
        this.waiter.done(frame.slice());
      } else if (this.frameListeners.length) {
        for (const fn of this.frameListeners) {
          try {
            fn(frame);
          } catch (e) {}
        }
      }
    }
  }

  /** Every frame that is not the reply being waited for. */
  onFrame(fn) {
    this.frameListeners.push(fn);
  }

  _queue(job) {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => {});
    return run;
  }

  /** Write, then wait for the first frame `accept` says is the reply. */
  exchange(bytes, { accept = null, bytes: count = 0, timeoutMs = 1000, flush = false } = {}) {
    return this._queue(
      () =>
        new Promise((resolve, reject) => {
          if (this.closed) return reject(new Error("Connection closed"));
          if (flush) this.rx = new Uint8Array(0);
          const timer = setTimeout(() => {
            this.waiter = null;
            reject(new Error("The rig did not answer"));
          }, timeoutMs);
          this.waiter = {
            accept,
            bytes: count,
            done: (frame) => {
              clearTimeout(timer);
              this.waiter = null;
              resolve(frame);
            },
            fail: (err) => {
              clearTimeout(timer);
              this.waiter = null;
              reject(err);
            },
          };
          try {
            this.transport.write(bytes);
          } catch (err) {
            this.waiter.fail(err);
          }
        }),
    );
  }

  /** Write with no reply expected; `settleMs` gives a slow rig time to act. */
  send(bytes, settleMs = 30) {
    return this._queue(
      () =>
        new Promise((resolve, reject) => {
          if (this.closed) return reject(new Error("Connection closed"));
          try {
            this.transport.write(bytes);
          } catch (err) {
            return reject(err);
          }
          setTimeout(resolve, settleMs);
        }),
    );
  }

  close() {
    this.closed = true;
    return this.transport.close();
  }
}
