// Volume slider (0–100) for both pages: the curve, the startup value and the
// listener's own remembered setting.
//
// Curve, in dB relative to the 50 % position:
//   50–100  0.4 dB per step, exactly as before (+20 dB at 100 %), so a
//           listener at a usual setting hears no change.
//   1–50    a quadratic that leaves 50 % with the same slope and reaches
//           −58 dB at 1 %, so the low end gets fine steps and fades out
//           smoothly instead of stopping 20 dB down.
//   0       true silence (gain 0). The old curve still gave ×1.3 here.
//
// The 50 % reference keeps the historical level: 10^2.6, which audio.js
// setGain() divides by 30.

const REF_EXP = 2.6          // log10 of the gain at 50 %
const STEP_DB = 0.4          // dB per step above and at 50 %
const LOW_CURVE = -0.016     // quadratic term below 50 %: −60 dB at x = −50

export const VOLUME_FALLBACK = 50
const STORE_KEY = 'phantomsdr.volume'

export function volumeToDb (v) {
  const x = clampVolume(v) - 50
  return x >= 0 ? STEP_DB * x : STEP_DB * x + LOW_CURVE * x * x
}

/** Gain for audio.setGain(): 0 at 0 %, the historical curve from 50 % up. */
export function volumeToGain (v) {
  if (clampVolume(v) <= 0) return 0
  return Math.pow(10, REF_EXP + volumeToDb(v) / 20)
}

export function clampVolume (v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return VOLUME_FALLBACK
  return Math.min(100, Math.max(0, n))
}

/**
 * Startup volume: the listener's own last setting wins; otherwise the
 * receiver's [input.defaults] volume (settings.defaults.volume, absent on a
 * receiver that never set it); otherwise 50 %.
 */
export function initialVolume (serverDefault) {
  const saved = loadSavedVolume()
  if (saved !== null) return saved
  const d = Number(serverDefault)
  if (serverDefault !== undefined && serverDefault !== null && Number.isFinite(d) && d >= 0) {
    return clampVolume(d)
  }
  return VOLUME_FALLBACK
}

export function loadSavedVolume () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw === null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? clampVolume(n) : null
  } catch (_) {
    return null
  }
}

/** Remember a volume the listener set with the slider, never the startup value. */
export function saveVolume (v) {
  try { localStorage.setItem(STORE_KEY, String(clampVolume(v))) } catch (_) {}
}
