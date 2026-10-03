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

/**
 * Resolve to { receivers, current } — receivers as listed (id, name, url,
 * default), current the id of the receiver this page belongs to — or null
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
  return { receivers, current }
}

/** The /mobile page of a receiver whose desktop page is `url`. */
export function mobileUrl (url) {
  const u = new URL(url)
  u.pathname = '/mobile'
  return u.href
}
