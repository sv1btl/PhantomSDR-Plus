// An https page may not open a ws:// socket — the browser blocks it as mixed
// content before it leaves the machine — and most PhantomSDR-Plus stations and
// KiwiSDRs are plain http with no wss:// to offer. So from an https page such a
// socket goes through this site's relay (websdr_relay.py /ws), which is wss://
// to the page and ws:// onward. An http page connects directly, as always.
import { siteRelay } from '../siteInfo.js'
import { sideServiceBase } from './sideService.js'

const DEFAULT_RELAY_PORT = 8898

export function viaRelayIfBlocked (url) {
  const loc = (typeof window !== 'undefined' && window.location) || null
  if (!loc || loc.protocol !== 'https:' || !/^ws:\/\//i.test(url)) return url
  return `${sideServiceBase(siteRelay, DEFAULT_RELAY_PORT).ws}/ws?url=${encodeURIComponent(url)}`
}
