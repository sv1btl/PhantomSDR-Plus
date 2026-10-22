// Receiver picker data: the other receivers of this station (HF / 2 m ...).
//
// proxy.py serves the list as /receivers.json, built from receivers.toml. A
// page served through the proxy reads it from its own origin. A page served
// straight by its spectrumserver (a receiver with its own public port) has no
// such path, so site_information.json may name the list's address in
// siteReceiversList, and the proxy allows reading it cross-origin.
//
// That key ships in the template site_information.json that new stations
// copy, so a list from elsewhere is shown only when it names the host this
// page was opened on — a station that kept someone else's address unedited
// never shows that station's receivers as its own.
import { siteInfo } from '../siteInfo.js'
import { carryIdentity } from './identity'

/**
 * Resolve to { receivers, current, sameOrigin } — receivers as listed (id,
 * name, url, default), current the id of the receiver this page belongs to,
 * sameOrigin whether the list came from this page's own proxy — or null
 * when there is no picker to show (one receiver, no list, a foreign list).
 */
export async function loadReceivers () {
  // Only a web address counts: the template ships a placeholder here, and a
  // station that left it unedited falls back to its own /receivers.json.
  let configured = String(siteInfo.siteReceiversList || '').trim()
  if (!/^https?:\/\//i.test(configured)) configured = ''
  const listUrl = configured || '/receivers.json'
  let list
  try {
    const r = await fetch(listUrl, { cache: 'no-cache' })
    if (!r.ok) return null
    list = await r.json()
  } catch (e) {
    return null
  }
  if (!Array.isArray(list)) return null

  const receivers = list
    .filter((r) => r && typeof r.id === 'string' && typeof r.url === 'string')
    .map((r) => ({
      id: r.id,
      name: String(r.name || r.id),
      url: new URL(r.url, new URL(listUrl, location.href)).href,
      default: !!r.default,
    }))
  if (receivers.length < 2) return null

  const sameOrigin = new URL(listUrl, location.href).origin === location.origin
  const namesThisHost = receivers.some(
    (r) => new URL(r.url).hostname === location.hostname,
  )
  if (!sameOrigin && !namesThisHost) return null

  const own = String(siteInfo.siteReceiverId || '')
  const current =
    (own && receivers.some((r) => r.id === own) && own) ||
    (receivers.find((r) => r.default) || receivers[0]).id
  return { receivers, current, sameOrigin }
}

/** The /mobile page of a receiver whose desktop page is `url`. */
export function mobileUrl (url) {
  const u = new URL(url)
  u.pathname = '/mobile'
  return u.href
}

/**
 * The /waterfall socket of receiver `r`, for its preview strip. A receiver
 * behind this page's own proxy (?rx= in its url) is reached through the
 * address this page was opened on, so a listener on the LAN address does not
 * go out to the public name and back; one with its own address is reached there.
 */
export function waterfallSocketUrl (r, sameOrigin) {
  const u = new URL(r.url)
  const id = u.searchParams.get('rx')
  const viaHere = sameOrigin && !!id
  const proto = (viaHere ? location.protocol : u.protocol).replace('http', 'ws')
  const host = viaHere ? location.host : u.host
  return `${proto}//${host}/waterfall` + (id ? '?rx=' + encodeURIComponent(id) : '')
}

/**
 * The page of receiver `r` tuned to `hz`, in `mode` when one is given.
 * `arrive` says how that page frames it (App.svelte applyArrival):
 *   'view'  the zoom, Min/Max and mode the listener left it with, when `hz`
 *           lies in that view;
 *   'band'  the band `hz` is in — its zoom, Min/Max and mode, as a band
 *           button does (a typed frequency).
 */
export function receiverTuneUrl (r, hz, mode, arrive) {
  const u = new URL(r.url)
  u.searchParams.set('frequency', String(Math.round(hz)))
  if (mode) u.searchParams.set('modulation', mode)
  if (arrive === 'view' || arrive === 'band') u.searchParams.set(arrive, '1')
  carryIdentity(u)
  return u.href
}

// ── Which receiver covers a frequency ─────────────────────────────────────
// A receiver's span is the basefreq / total_bandwidth its /waterfall socket
// announces in its first message. It changes only when the sysop reconfigures
// that receiver, so it is kept in localStorage for a day: a page asks each
// other receiver once, and a receiver strip (RxStrip.svelte) refreshes it for
// free whenever it connects.
const SPAN_KEY = 'rxSpan:'
const SPAN_TTL_MS = 24 * 3600 * 1000
const SPAN_PROBE_MS = 6000

export function rememberSpan (id, base, bw) {
  if (!Number.isFinite(base) || !(bw > 0)) return
  try {
    localStorage.setItem(SPAN_KEY + id, JSON.stringify({ base, bw, t: Date.now() }))
  } catch (e) {}
}

function cachedSpan (id) {
  try {
    const v = JSON.parse(localStorage.getItem(SPAN_KEY + id) || 'null')
    if (v && Number.isFinite(v.base) && v.bw > 0 && Date.now() - v.t < SPAN_TTL_MS) {
      return { base: v.base, bw: v.bw }
    }
  } catch (e) {}
  return null
}

/** Resolve to { base, bw } of receiver `r`, or null when it cannot be read. */
export function receiverSpan (r, sameOrigin) {
  const c = cachedSpan(r.id)
  if (c) return Promise.resolve(c)
  return new Promise((resolve) => {
    let ws
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { ws && ws.close() } catch (e) {}
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), SPAN_PROBE_MS)
    try {
      ws = new WebSocket(waterfallSocketUrl(r, sameOrigin))
    } catch (e) {
      finish(null)
      return
    }
    ws.binaryType = 'arraybuffer'
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      try {
        const s = JSON.parse(ev.data)
        if (!s.fft_size) return
        rememberSpan(r.id, s.basefreq, s.total_bandwidth)
        finish({ base: s.basefreq, bw: s.total_bandwidth })
      } catch (e) {}
    }
    ws.onerror = () => finish(null)
    ws.onclose = () => finish(null)
  })
}

/**
 * The receiver among `receivers` (other than `currentId`) whose span holds
 * `hz`, given the spans known so far ({ id: { base, bw } }); the narrowest
 * when several do. null when none does.
 */
export function receiverFor (hz, receivers, currentId, spans) {
  let best = null
  for (const r of receivers) {
    if (r.id === currentId) continue
    const sp = spans[r.id]
    if (!sp || hz < sp.base || hz >= sp.base + sp.bw) continue
    if (!best || sp.bw < spans[best.id].bw) best = r
  }
  return best
}
