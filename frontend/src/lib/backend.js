import SpectrumAudio from '../audio'
import SpectrumWaterfall from '../waterfall'
import SpectrumEvents from '../events'
import initWrappers from './wrappers'

let settings

const location = window.location
const baseUri = `${location.protocol.replace('http', 'ws')}//${location.host}`
export const waterfall = new SpectrumWaterfall(baseUri + '/waterfall')
export const audio = new SpectrumAudio(baseUri + '/audio')
export const events = new SpectrumEvents(baseUri + '/events')

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

export function getFFTOffsetView () {
  return waterfall.getWaterfallRange()
}
export function getFrequencyView () {
  return waterfall.getWaterfallRange().map(FFTOffsetToFrequency)
}
