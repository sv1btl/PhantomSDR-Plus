// Which receiver this page belongs to when several share one public port.
//
// proxy.py routes every request on ?rx=<id> first, then on the rx cookie it
// sets, then to the default receiver. The page URL carries the id, and so must
// every socket, poll and link the page makes: the cookie is shared by all tabs
// of the browser, so a second tab opened on another receiver would otherwise
// pull this tab's next request over to itself.
//
// On a single-receiver station there is no ?rx= and withRx() changes nothing.
export const rx = (() => {
  try {
    return new URLSearchParams(window.location.search).get('rx') || ''
  } catch (e) {
    return ''
  }
})()

/** Append rx=<id> to a URL that may or may not already have a query. */
export function withRx (url) {
  if (!rx) return url
  return url + (url.includes('?') ? '&' : '?') + 'rx=' + encodeURIComponent(rx)
}

/**
 * Fetch this receiver's own site_information.json into
 * window.__PHANTOM_SITE_INFO__ (read by siteInfo.js), before the app loads.
 * Only a page tied to a receiver by ?rx= or the rx cookie asks: the default
 * receiver's info is already built in, so a plain visit costs no request.
 */
export async function preloadSiteInfo () {
  let cookie = ''
  try { cookie = document.cookie } catch (e) {}
  if (!rx && !/(^|;\s*)rx=/.test(cookie)) return
  try {
    const r = await fetch(withRx('/site_information.json'), { cache: 'no-cache' })
    if (r.ok) window.__PHANTOM_SITE_INFO__ = await r.json()
  } catch (e) {
    // Unreachable or not JSON: the page starts with the built-in info.
  }
}
