#!/usr/bin/env python3
"""
rade_helper.py — RADE sidecar for PhantomSDR-Plus (V1, and V2 beta via rade_c)
=====================================================

PER-CONNECTION ARCHITECTURE
----------------------------
Each browser connection gets its own independent decode pipeline:

  radae_rxe.py + lpcnet_demo  (one pair per connected client)

This allows each user to tune to a different frequency independently.
PyTorch thread count is limited so each instance uses ~2 cores instead
of all available cores.

Pipeline per connection:
  Browser (f32 real PCM @ audioOutputSps)
      | resample continuously to 8000 Hz
      | zero-pad to complex f32
      v
  radae_rxe.py  --model_name <path>   [OMP_NUM_THREADS=2]
      | vocoder features f32  (OS pipe)
      v
  lpcnet_demo  -fargan-synthesis  -  -
      | s16 PCM @ 16000 Hz -> f32
      v
  Browser (_radePlayPCM @ 16000 Hz)

Environment variables
---------------------
  RADE_HELPER_PORT      TCP port (default 8074)
  RADE_HELPER_HOST      Bind address (default 0.0.0.0)
  RADAE_DIR             Root of the radae repo (default ~/radae)
  RADE_MODEL            Path to .pth checkpoint
  LPCNET_DEMO           Path to lpcnet_demo binary
  RADE_AUXDATA          Set to '0' to add --noauxdata flag
  RADE_TORCH_THREADS    PyTorch/OpenBLAS threads per instance (default 2)

Compatible with websockets 10.x through 16.x+.
"""
from __future__ import annotations

import asyncio
import json
import os
import struct
import sys
from pathlib import Path

# websockets version-agnostic
try:
    import websockets
    try:
        from websockets.asyncio.server import serve as _ws_serve
    except ImportError:
        from websockets.legacy.server import serve as _ws_serve
    import websockets.exceptions
except ImportError:
    sys.exit("[RADE] ERROR: 'websockets' not found.  pip3 install websockets")

# Configuration
PORT          = int(os.environ.get("RADE_HELPER_PORT", 8074))
HOST          = os.environ.get("RADE_HELPER_HOST", "0.0.0.0")
RADAE_DIR     = Path(os.environ.get("RADAE_DIR", Path.home() / "radae")).expanduser()
RADAE_RX      = str(RADAE_DIR / "radae_rxe.py")
RADE_MODEL    = os.environ.get(
    "RADE_MODEL",
    str(RADAE_DIR / "model19_check3" / "checkpoints" / "checkpoint_epoch_100.pth")
)
LPCNET_DEMO   = os.environ.get("LPCNET_DEMO", str(RADAE_DIR / "build" / "src" / "lpcnet_demo"))
USE_AUXDATA   = os.environ.get("RADE_AUXDATA", "1") != "0"
# RADE V2 (beta) runs on FreeDV's C port, kept in its own tree so the V1
# install above is never touched. A client asks for it with "version": 2 in
# its init frame; without rade_c that client gets an error and V1 is unaffected.
RADE_C_DIR    = Path(os.environ.get("RADE_C_DIR", Path.home() / "rade_c")).expanduser()
RADE_C_RX     = os.environ.get("RADE_C_RX", str(RADE_C_DIR / "build" / "src" / "radae_rx"))
RADE_C_LPCNET = os.environ.get("RADE_C_LPCNET", str(RADE_C_DIR / "build" / "src" / "lpcnet_demo"))
# V2 (beta) false-locks on busy LSB phone traffic heard on USB: on 40 m it sat
# in "sync" 65 % of the time at -12..-1 dB and played garbled speech, where V1
# never synced on the same audio. Below this SNR its audio is dropped and the
# panel says "Searching"; it blocked 97 % of that false-lock time.
V2_MIN_SNR    = float(os.environ.get("RADE_V2_MIN_SNR", "-2"))
# Real V2 still decodes 3-4 dB below that mute. Between RADE_V2_WEAK_SNR and
# V2_MIN_SNR the audio also passes when the last 2 s look like real V2: the
# decoder's own signal flag set >= 60 % of the time and its frequency estimate
# steady (std <= 0.05 Hz over the 2 s). Real V2 on air (3690/3697/3790/7087
# kHz) passes that 77-99 % of the time with a median of 0.01-0.035 Hz; the
# 40 m false locks wander ~0.8 Hz and never pass. Bench (2026-10-30,
# ~/sdr-shots/radev2/bench): AWGN -5 dB 2 % -> 84 % of the speech decoded
# right, -3 dB 82 -> 96 %, poor-HF fading 0 dB 69 -> 85 %, with the 40 m
# false-lock garbage about unchanged (0.8 -> 0.9 s in 40 s). Set it to
# V2_MIN_SNR or higher to switch it off.
V2_WEAK_SNR   = float(os.environ.get("RADE_V2_WEAK_SNR", "-6"))
# Decoded RADE speech is as loud as the sender's microphone. A V2 station on
# 3697 kHz decoded ~16 dB below a normal decode and, after the page's 0.20
# RADE trim, was all but silent for listeners. V2 output gets a slow level
# control towards this target (0 = off); a normal-level decode is left as is.
# -16 dBFS is where a normal V1 decode sits: -12 was tried first and, with the
# page's 2.65x RADE gain (0.20 x volume), clipped 2-3 % of the samples.
V2_TARGET_DB  = float(os.environ.get("RADE_V2_TARGET_DB", "-16"))
# PyTorch/OpenBLAS threads per radae_rxe.py instance.
# 1 thread = ~70-80% of one core, sufficient for real-time RADE decode.
# 2 threads = ~100% of one core, use if you hear dropouts with 1 thread.
TORCH_THREADS = os.environ.get("RADE_TORCH_THREADS", "1")

SPS_RADAE = 8000
SPS_OUT   = 16000

# Core pinning: spread decode pipelines across cores so no single core
# thermally saturates. RADE pins one thread hard, so without this a couple
# of clients can push individual cores to ~90 C while total CPU looks idle.
PIN_CORES        = os.environ.get("RADE_PIN_CORES", "1") != "0"
CORES_PER_CLIENT = int(os.environ.get("RADE_CORES_PER_CLIENT", "2"))
try:
    _NCPU = len(os.sched_getaffinity(0))
except AttributeError:
    _NCPU = os.cpu_count() or 1
_pin_next = 0   # round-robin cursor


def _taskset_prefix():
    """Return ['taskset','-c','a,b'] for the next client, rotating cores."""
    global _pin_next
    if not PIN_CORES or _NCPU <= 1:
        return []
    cores = [str((_pin_next + i) % _NCPU) for i in range(CORES_PER_CLIENT)]
    _pin_next = (_pin_next + CORES_PER_CLIENT) % _NCPU
    return ["taskset", "-c", ",".join(cores)]


class _StreamResampler:
    """Continuous resampler to SPS_RADAE for both pipelines.

    Resampling every browser chunk on its own (as V1 once did) leaves a small
    glitch at the edge of each ~512-sample chunk. V1 rode over it at a cost of
    weak-signal decodes; V2 loses lock on it and re-acquires again and again, and every acquisition replays
    the speech it buffered while searching. On a live 3697 kHz over that gave
    56 s of audio for 40 s and 17 acquisitions, against 1 when resampled in one
    pass. This keeps the input history and the fractional read position from
    one chunk to the next, so chunk boundaries leave no trace: a Kaiser-windowed
    sinc evaluated at each output instant."""
    HALF = 32                                   # taps on each side of the read point

    def __init__(self, in_sps, out_sps=SPS_RADAE, cutoff_hz=3800.0):
        import numpy as np
        self.np = np
        self.step = float(in_sps) / float(out_sps)      # input samples per output sample
        self.fc = min(cutoff_hz, 0.475 * out_sps) / float(in_sps)
        self.hist = np.zeros(2 * self.HALF, np.float32)
        self.pos = float(self.HALF)
        self.win = np.kaiser(2 * self.HALF + 1, 8.0)
        self.win_x = np.linspace(-self.HALF, self.HALF, 2 * self.HALF + 1)
        self.k = np.arange(-self.HALF + 1, self.HALF + 1)

    def process(self, real_bytes):
        np = self.np
        x = np.concatenate([self.hist, np.frombuffer(real_bytes, dtype=np.float32)])
        last = len(x) - self.HALF - 1
        if self.pos > last:
            self.hist = x
            return b""
        n = int(np.floor((last - self.pos) / self.step)) + 1
        p = self.pos + self.step * np.arange(n)
        idx = np.floor(p).astype(np.int64)[:, None] + self.k[None, :]
        d = p[:, None] - idx
        h = 2 * self.fc * np.sinc(2 * self.fc * d) * np.interp(d, self.win_x, self.win)
        y = (x[idx] * h).sum(axis=1).astype(np.float32)
        nxt = self.pos + self.step * n
        keep_from = int(np.floor(nxt)) - self.HALF
        self.hist = x[keep_from:]
        self.pos = nxt - keep_from
        return y.tobytes()


class _V2Mute:
    """Decides, per radae_rx --v2 -v 2 status line, whether V2 audio passes.

    Open while in sync at or above V2_MIN_SNR, or at or above V2_WEAK_SNR
    while the last WIN symbols (~2 s) look like real V2 (see V2_WEAK_SNR)."""
    WIN, SIG_MIN, JIT_MAX = 100, 0.6, 0.05

    def __init__(self, min_snr=V2_MIN_SNR, weak_snr=V2_WEAK_SNR):
        from collections import deque
        self.min_snr, self.weak_snr = min_snr, weak_snr
        self.sig, self.foff = deque(maxlen=self.WIN), deque(maxlen=self.WIN)

    def update(self, state, sig, f_off, snr):
        self.sig.append(sig)
        self.foff.append(f_off)
        if state != 'sync' or snr < self.weak_snr:
            return False
        if snr >= self.min_snr:
            return True
        if len(self.sig) < self.WIN or sum(self.sig) < self.SIG_MIN * self.WIN:
            return False
        n = float(len(self.foff))
        mean = sum(self.foff) / n
        return sum((f - mean) ** 2 for f in self.foff) / n <= self.JIT_MAX ** 2


class _SpeechLevel:
    """Slow level control for decoded V2 speech. A level follower that rises
    fast on speech and falls back slowly (pauses between words do not pull it
    down) sets the gain towards target_db: never below unity, at most +24 dB,
    ramped across each chunk, with a hard limit against clipping."""

    def __init__(self, target_db, sps=SPS_OUT, max_db=24.0, floor_db=-55.0, rise_s=0.05, fall_s=4.0):
        import numpy as np
        self.np = np
        self.target = 10 ** (target_db / 20.0)
        self.maxg = 10 ** (max_db / 20.0)
        self.floor = 10 ** (floor_db / 20.0)
        self.sps, self.rise, self.fall = sps, rise_s, fall_s
        self.level = None
        self.g = 1.0

    def process(self, f32_bytes):
        np = self.np
        x = np.frombuffer(f32_bytes, dtype=np.float32)
        if len(x) == 0:
            return f32_bytes
        rms = float(np.sqrt(np.mean(x * x)))
        dt = len(x) / float(self.sps)
        if rms > self.floor:
            if self.level is None:
                self.level = rms
            tc = self.rise if rms > self.level else self.fall
            self.level += (rms - self.level) * (1 - np.exp(-dt / tc))
        want = 1.0 if self.level is None else min(self.maxg, max(1.0, self.target / self.level))
        g0 = self.g
        self.g += (want - self.g) * (1 - np.exp(-dt / 0.5))
        y = x * np.linspace(g0, self.g, len(x), dtype=np.float32)
        pk = float(np.max(np.abs(y)))
        if pk > 0.98:
            y = y * (0.98 / pk)
        return y.astype(np.float32).tobytes()


class _InputLevel:
    """Slow gain on V2's input. The page sends receiver audio at RMS ~0.0005;
    at that level rade_c's V2 stays in sync but decodes only the first few
    seconds of each over to speech and the rest to near-silence. Brought to
    RMS ~0.1 first, a real 3697 kHz over gave 25 s of speech instead of 4 s.
    V2's own AGC does the fine work; this only puts the signal in its range."""

    def __init__(self, target_rms=0.1, sps=SPS_RADAE, tc_s=1.0, min_g=0.1, max_g=3000.0):
        import numpy as np
        self.np = np
        self.target, self.sps, self.tc = target_rms, sps, tc_s
        self.min_g, self.max_g = min_g, max_g
        self.rms = None
        self.g = None

    def process(self, f32_bytes):
        np = self.np
        x = np.frombuffer(f32_bytes, dtype=np.float32)
        if len(x) == 0:
            return f32_bytes
        r = float(np.sqrt(np.mean(x * x)))
        if r > 1e-7:
            a = 1 - np.exp(-len(x) / (self.sps * self.tc))
            self.rms = r if self.rms is None else self.rms + (r - self.rms) * a
        if self.rms is None:
            return f32_bytes
        want = min(self.max_g, max(self.min_g, self.target / self.rms))
        g0 = want if self.g is None else self.g
        self.g = want
        return (x * np.linspace(g0, want, len(x), dtype=np.float32)).astype(np.float32).tobytes()


def _to_complex_f32(real_bytes):
    """Zero-pad real f32 → complex f32 pairs (real, 0.0 imaginary).
    Uses numpy for speed — a Python loop over individual samples is ~100x slower."""
    try:
        import numpy as np
        real = np.frombuffer(real_bytes, dtype=np.float32)
        # Interleave real samples with zeros: [r0, 0, r1, 0, ...]
        out = np.zeros(len(real) * 2, dtype=np.float32)
        out[0::2] = real
        return out.tobytes()
    except ImportError:
        # Fallback: pure Python (slow but correct)
        n   = len(real_bytes) // 4
        out = bytearray(n * 8)
        for i in range(n):
            out[i*8 : i*8+4] = real_bytes[i*4 : i*4+4]
        return bytes(out)


def _s16_to_f32(s16_bytes):
    """Convert lpcnet_demo s16 LE output → f32.
    Uses numpy for speed — struct.pack with a generator is ~100x slower."""
    try:
        import numpy as np
        samples = np.frombuffer(s16_bytes, dtype=np.int16).astype(np.float32)
        samples /= 32768.0
        return samples.tobytes()
    except ImportError:
        # Fallback: pure Python
        n = len(s16_bytes) // 2
        if n == 0:
            return b""
        return struct.pack("%df" % n,
                           *(s / 32768.0 for s in struct.unpack("<%dh" % n, s16_bytes)))


async def _send_json(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def handle_client(websocket):
    remote = getattr(websocket, "remote_address", None) or ("?", "?")
    addr   = "%s:%s" % (remote[0], remote[1])
    print("[RADE] client connected: %s" % addr, file=sys.stderr)

    input_sps = SPS_RADAE
    version   = 1

    # Wait for JSON init frame
    try:
        raw = await asyncio.wait_for(websocket.recv(), timeout=8.0)
        if isinstance(raw, str):
            cfg       = json.loads(raw)
            input_sps = int(cfg.get("sps", SPS_RADAE))
            sideband  = cfg.get("sideband", "USB")
            version   = 2 if str(cfg.get("version", 1)) == "2" else 1
            print("[RADE] %s  sps=%d sideband=%s version=V%d" % (addr, input_sps, sideband, version), file=sys.stderr)
    except asyncio.TimeoutError:
        print("[RADE] %s timeout waiting for init frame" % addr, file=sys.stderr)
    except Exception as exc:
        print("[RADE] %s init error: %s" % (addr, exc), file=sys.stderr)

    # Validate paths
    if version == 2:
        needed = [("rade_c radae_rx", RADE_C_RX), ("rade_c lpcnet_demo", RADE_C_LPCNET)]
    else:
        needed = [("radae_rxe.py", RADAE_RX), ("model", RADE_MODEL), ("lpcnet_demo", LPCNET_DEMO)]
    for label, path in needed:
        if not Path(path).exists():
            msg = "%s not found: %s" % (label, path)
            print("[RADE] ERROR: %s" % msg, file=sys.stderr)
            if version == 2:
                # The listener sees this; the path stays in rade.log.
                msg = "RADE V2 is not installed on this station yet — the station owner can add it by running ./install_rade.sh"
            await _send_json(websocket, {"type": "error", "msg": msg})
            return

    # OS pipe: radae stdout -> lpcnet stdin
    r_fd, w_fd = os.pipe()

    pin        = _taskset_prefix()
    radae_env  = os.environ.copy()
    if version == 2:
        # -v 2 prints one status line per OFDM symbol, which carries the sync
        # state and SNR the panel shows. The C port needs no PyTorch threads.
        radae_cmd  = pin + [RADE_C_RX, "--v2", "-v", "2"]
        lpcnet_cmd = pin + [RADE_C_LPCNET, "-fargan-synthesis", "-", "-"]
    else:
        radae_cmd  = pin + ["python3", RADAE_RX, "--model_name", RADE_MODEL]
        if not USE_AUXDATA:
            radae_cmd.append("--noauxdata")
        lpcnet_cmd = pin + [LPCNET_DEMO, "-fargan-synthesis", "-", "-"]
        # Limit PyTorch threads to prevent CPU exhaustion
        radae_env["OMP_NUM_THREADS"]      = TORCH_THREADS
        radae_env["MKL_NUM_THREADS"]      = TORCH_THREADS
        radae_env["OPENBLAS_NUM_THREADS"] = TORCH_THREADS
        radae_env["NUMEXPR_NUM_THREADS"]  = TORCH_THREADS
    if pin:
        print("[RADE] %s pinned to cores %s" % (addr, pin[2]), file=sys.stderr)

    print("[RADE] %s spawning V%d pipeline%s" % (addr, version,
          "" if version == 2 else " (torch_threads=%s)" % TORCH_THREADS), file=sys.stderr)

    try:
        proc_radae = await asyncio.create_subprocess_exec(
            *radae_cmd,
            stdin  = asyncio.subprocess.PIPE,
            stdout = w_fd,
            stderr = asyncio.subprocess.PIPE,   # capture for sync/SNR parsing
            env    = radae_env,
            # rade_c's radae_rx always creates eoo_rx.f32 in its working
            # directory; keep it in rade_c's own build tree, not this repo.
            cwd    = str(Path(RADE_C_RX).parent) if version == 2 else None,
        )
        os.close(w_fd)
        w_fd = -1   # mark closed so exception handler doesn't double-close

        proc_lpcnet = await asyncio.create_subprocess_exec(
            *lpcnet_cmd,
            stdin  = r_fd,
            stdout = asyncio.subprocess.PIPE,
            stderr = asyncio.subprocess.DEVNULL,
        )
        os.close(r_fd)
        r_fd = -1   # mark closed

    except Exception as exc:
        msg = "failed to spawn subprocess: %s" % exc
        print("[RADE] ERROR: %s" % msg, file=sys.stderr)
        # Close any FDs that are still open
        for fd in (r_fd, w_fd):
            if fd != -1:
                try:
                    os.close(fd)
                except Exception:
                    pass
        # If radae spawned but lpcnet failed, terminate radae
        try:
            proc_radae.terminate()
        except Exception:
            pass
        await _send_json(websocket, {"type": "error", "msg": msg})
        return

    await _send_json(websocket, {"type": "status", "connected": True})

    send_q = asyncio.Queue(maxsize=128)
    # Both versions resample continuously (see _StreamResampler) from the rate the
    # old per-chunk resampler ran at: 8000/sps rounded to a ratio with a
    # denominator <= 50, which for the page's reported 12016.29 Hz is 2/3,
    # i.e. 12000 Hz. That is the stream's real rate: V2 locks once at 12000 Hz
    # and re-acquires from about 250 ppm away, so the reported 12016.29 Hz
    # (1390 ppm off) cannot be used as it is. V1 used to resample each chunk
    # on its own; continuously it decoded 25 points more of the speech right
    # on the 2026-10-30 bench (AWGN -3 dB 30 -> 82 %, poor-HF fading 2 dB
    # 41 -> 74 %, disturbed 4 dB 58 -> 86 %).
    v2_level = _SpeechLevel(V2_TARGET_DB) if version == 2 and V2_TARGET_DB != 0 else None
    v2_input = _InputLevel() if version == 2 else None
    from fractions import Fraction
    r = Fraction(SPS_RADAE, max(1, int(input_sps))).limit_denominator(50)
    resampler = _StreamResampler(SPS_RADAE * r.denominator / r.numerator)
    print("[RADE] %s V%d input resampled continuously from %.1f Hz" % (addr, version, SPS_RADAE * r.denominator / r.numerator), file=sys.stderr)
    # V2 only: audio passes while _V2Mute says so.
    v2_gate = {"open": version != 2}
    v2_mute = _V2Mute() if version == 2 else None

    async def pump_radae_stderr():
        """Parse radae_rxe.py stderr for sync state and SNR, forward to browser.

        radae_rxe.py emits lines like:
          1 state: search     ... SNRdB:  0.00 ...
          5 state: sync       ... SNRdB:  4.03 uw_err: 0
          6 state: sync       ... SNRdB:  7.58 uw_err: 0

        rade_c's radae_rx --v2 -v 2 emits one line per OFDM symbol instead:
          36   11 sync sig: 1 f_off:  0.09 snr:   5.0 dB eoo: 0.544
          497  241 idle sig: 0 f_off:  0.09 snr: -18.9 dB eoo: 0.000

        We forward {type:'snr', synced:bool, snr:float} JSON frames so the
        browser panel can show the green 'Synced · SNR x.x dB' indicator.
        V2 prints ~25 lines a second, so its frames go out only when the state
        changes or every 10th line. Every V2 line updates the audio mute: a V2
        "sync" that _V2Mute keeps closed is reported as not synced ("weak") and
        its audio dropped.
        """
        import re
        if version == 2:
            snr_re   = re.compile(r'snr:\s*([\-0-9.]+)\s*dB')
            state_re = re.compile(r'^\s*\d+\s+\d+\s+(\w+)\s+sig:\s*(\d)\s+f_off:\s*([\-0-9.]+)')
        else:
            snr_re   = re.compile(r'SNRdB:\s*([\-0-9.]+)')
            state_re = re.compile(r'state:\s*(\w+)')
        last_state = None
        n_lines    = 0
        try:
            while True:
                line = await proc_radae.stderr.readline()
                if not line:
                    break
                text = line.decode('utf-8', errors='replace').strip()
                # Parse state
                sm = state_re.search(text)
                ss = snr_re.search(text)
                if sm and version == 2:
                    snr_now = float(ss.group(1)) if ss else -99.0
                    v2_gate["open"] = v2_mute.update(sm.group(1), int(sm.group(2)), float(sm.group(3)), snr_now)
                    n_lines += 1
                    key = 'sync' if v2_gate["open"] else 'nosync'
                    if key == last_state and n_lines % 10:
                        continue
                    last_state = key
                if sm:
                    state  = sm.group(1)          # 'search', 'candidate', 'sync'
                    synced = (state == 'sync')
                    snr    = float(ss.group(1)) if ss else 0.0
                    if version == 2 and synced and not v2_gate["open"]:
                        synced, state = False, "weak"
                    await _send_json(websocket, {
                        "type":   "snr",
                        "synced": synced,
                        "snr":    round(snr, 1),
                        "state":  state,
                    })
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print("[RADE] %s stderr pump: %s" % (addr, exc), file=sys.stderr)

    async def pump_lpcnet():
        try:
            while True:
                chunk = await proc_lpcnet.stdout.read(4096)
                if not chunk:
                    break
                if not v2_gate["open"]:
                    continue
                pcm = _s16_to_f32(chunk)
                if v2_level is not None:
                    pcm = v2_level.process(pcm)
                await send_q.put(pcm)
        except Exception as exc:
            print("[RADE] %s lpcnet pump: %s" % (addr, exc), file=sys.stderr)
        finally:
            await send_q.put(b"")

    async def pump_ws_send():
        try:
            while True:
                chunk = await send_q.get()
                if chunk == b"":
                    break
                await websocket.send(chunk)
        except Exception as exc:
            print("[RADE] %s ws send: %s" % (addr, exc), file=sys.stderr)

    t_lpcnet = asyncio.create_task(pump_lpcnet())
    t_send   = asyncio.create_task(pump_ws_send())
    t_stderr = asyncio.create_task(pump_radae_stderr())

    # Main receive loop: browser PCM -> resample -> zero-pad -> radae stdin
    try:
        async for msg in websocket:
            if isinstance(msg, bytes):
                if proc_radae.stdin is None or proc_radae.stdin.is_closing():
                    break
                data = resampler.process(msg)
                if v2_input is not None:
                    data = v2_input.process(data)
                data = _to_complex_f32(data)
                proc_radae.stdin.write(data)
                try:
                    await proc_radae.stdin.drain()
                except Exception:
                    break
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as exc:
        print("[RADE] %s receive error: %s" % (addr, exc), file=sys.stderr)
    finally:
        t_lpcnet.cancel()
        t_send.cancel()
        t_stderr.cancel()
        for proc in (proc_radae, proc_lpcnet):
            try:
                proc.stdin.close()
            except Exception:
                pass
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        try:
            await _send_json(websocket, {"type": "status", "connected": False})
        except Exception:
            pass
        print("[RADE] client disconnected: %s" % addr, file=sys.stderr)


async def main():
    print("[RADE] helper starting on ws://%s:%d" % (HOST, PORT), file=sys.stderr)
    print("[RADE] radae_rx.py    : %s" % RADAE_RX, file=sys.stderr)
    print("[RADE] model          : %s" % RADE_MODEL, file=sys.stderr)
    print("[RADE] lpcnet_demo    : %s" % LPCNET_DEMO, file=sys.stderr)
    print("[RADE] auxdata        : %s" % ("ON (default)" if USE_AUXDATA else "OFF (--noauxdata)"), file=sys.stderr)
    print("[RADE] torch threads  : %s per instance (RADE_TORCH_THREADS to override)" % TORCH_THREADS, file=sys.stderr)
    print("[RADE] architecture   : per-connection (each user tunes independently)", file=sys.stderr)
    v2_ok = Path(RADE_C_RX).exists() and Path(RADE_C_LPCNET).exists()
    print("[RADE] V2 (beta)      : %s" % (("rade_c at %s, muted below %.1f dB SNR (%.1f dB when it looks like real V2), speech level %s" % (RADE_C_DIR, V2_MIN_SNR, V2_WEAK_SNR, ("towards %.0f dBFS" % V2_TARGET_DB) if V2_TARGET_DB != 0 else "off")) if v2_ok
          else "not installed (no %s)" % RADE_C_RX), file=sys.stderr)

    for label, path in [("radae_rxe.py", RADAE_RX),
                        ("model",        RADE_MODEL),
                        ("lpcnet_demo",  LPCNET_DEMO)]:
        if not Path(path).exists():
            print("[RADE] WARNING: %s not found: %s" % (label, path), file=sys.stderr)

    async with _ws_serve(handle_client, HOST, PORT):
        print("[RADE] listening — waiting for PhantomSDR-Plus clients", file=sys.stderr)
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[RADE] helper stopped", file=sys.stderr)
