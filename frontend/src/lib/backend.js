import SpectrumAudio from '../audio'
import { CLIENT_VERSION } from '../clientVersion'
import SpectrumWaterfall from '../waterfall'
import SpectrumEvents from '../events'
import initWrappers from './wrappers'
import Device from 'svelte-device-info'

let settings

const location = window.location
const baseUri = `${location.protocol.replace('http', 'ws')}//${location.host}`
export const waterfall = new SpectrumWaterfall(baseUri + '/waterfall')
export const audio = new SpectrumAudio(baseUri + '/audio?v=' + CLIENT_VERSION)
export const events = new SpectrumEvents(baseUri + '/events')

// This bundle is also what /mobile's "Mobile extended view" loads, so it runs
// on handsets as well as desktops. Phones get the device's own sample rate,
// with audio.js resampling the stream to match — see _wantsNativeContextRate()
// for why that is worth doing there and not here. ?ctxrate= overrides either.
try { audio.preferNativeContextRate = !!Device.isMobile } catch (e) {}

// Expose live instances for browser-console debugging
try {
  window.audio = audio
  window.waterfall = waterfall
  window.events = events
} catch (e) {}

let _initDone = false
export function markInitDone () { _initDone = true }

export function sendUserID (id) {
  if (!id) return
  ;[waterfall, events].forEach((s) => {
    try { s.setUserID(id) } catch (e) {}
  })
}

export async function init (username) {
  await initWrappers()
  await Promise.all([waterfall.init(), audio.init(), events.init()])
  settings = audio.settings
  // Send username immediately after sockets open, before server assigns a random key
  if (username) sendUserID(username)
  markInitDone()
}


export function frequencyToWaterfallOffset (frequency) {
  // FIX: settings is undefined until init() resolves; guard to prevent TypeError
  if (!settings) return 0
  const [waterfallL, waterfallR] = waterfall.getWaterfallRange()
  const frequencyOffset = (frequency - FFTOffsetToFrequency(waterfallL))
  return frequencyOffset / (((waterfallR - waterfallL) / settings.fft_result_size) * settings.total_bandwidth)
}
export function waterfallOffsetToFrequency (offset) {
  // FIX: settings is undefined until init() resolves; guard to prevent TypeError
  if (!settings) return 0
  const [waterfallL, waterfallR] = waterfall.getWaterfallRange()
  const frequencyOffset = offset * ((waterfallR - waterfallL) / settings.fft_result_size) * settings.total_bandwidth
  return frequencyOffset + FFTOffsetToFrequency(waterfallL)
}
export function frequencyToFFTOffset (frequency) {
  // FIX: settings is undefined until init() resolves; guard to prevent TypeError
  if (!settings) return 0
  const offset = (frequency - settings.basefreq) / settings.total_bandwidth
  return offset * settings.fft_result_size
}
export function FFTOffsetToFrequency (offset) {
  // FIX: settings is undefined until init() resolves; guard to prevent TypeError
  if (!settings) return 0
  const frequency = offset / settings.fft_result_size * settings.total_bandwidth
  return frequency + settings.basefreq
}
export function bandwidthToWaterfallOffset (bandwidth) {
  // FIX: settings is undefined until init() resolves; guard to prevent TypeError
  if (!settings) return 0
  const [waterfallL, waterfallR] = waterfall.getWaterfallRange()
  return bandwidth / settings.total_bandwidth * settings.fft_result_size / (waterfallR - waterfallL)
}
export function getMaximumBandwidth () {
  return audio.trueAudioSps
}

// ── Playback diagnostics on the console: ?diag=1 ──────────────────────────
// The mobile page shows these on screen; the desktop page has no room for
// them, so it logs one line every 10 s instead. Numbers in ms unless marked.
try {
  if (new URLSearchParams(window.location.search).has('diag')) {
    setInterval(() => {
      const d = audio.getPlaybackDiagnostics()
      if (!d || !d.link || !d.drain) return
      const r = (x) => (x === null || x === undefined) ? '…' : Math.round(x)
      console.log(
        `[diag] ${d.path} · latency ${r(d.latency.total * 1000)} (buf ${r(d.latency.buffered * 1000)})` +
        ` · jitter ${r(d.link.jitterMs)} worst ${r(d.link.jitterWorstMs)}` +
        ` · drift ${d.link.driftPpm === null ? '…' : d.link.driftPpm + ' ppm'}` +
        ` · cushion min/avg/max ${r(d.drain.cushionMinMs)}/${r(d.drain.cushionAvgMs)}/${r(d.drain.cushionMaxMs)}` +
        ` · drain ${d.drain.enabled ? d.drain.windowSec + 's' : 'OFF'} −${r(d.drain.trimmedMs)}/+${r(d.drain.filledMs)}` +
        ` · gaps ${d.fallbackRestarts} sheds ${d.fallbackDrops}`
      )
    }, 10000)
  }
} catch (e) { /* no URL; no diagnostics */ }

// ── Receive diversity ──────────────────────────────────────────────────────
// Thin pass-throughs so the UI never has to reach into the audio instance.
// The wiring lives here rather than in SpectrumAudio's constructor so that
// mobile/backend.js, which builds its own SpectrumAudio, is unaffected.
export function startDiversity (endpoint, options) {
  return audio.startDiversity(endpoint, options)
}
export function stopDiversity () {
  return audio.stopDiversity()
}
export function getDiversityStatus () {
  return audio.getDiversityStatus()
}
export function setDiversityCalib (db) {
  return audio.setDiversityCalib(db)
}
export function isDiversityActive () {
  return audio.isDiversityActive()
}

export function getFFTOffsetView () {
  return waterfall.getWaterfallRange()
}
export function getFrequencyView () {
  return waterfall.getWaterfallRange().map(FFTOffsetToFrequency)
}
