// Site information for the receiver this page belongs to.
//
// The build-time site_information.json describes the default receiver. A page
// opened on another one (?rx=, see lib/rx.js) overlays that receiver's own
// copy, which main.js / mobile/main.js fetch BEFORE they import the app — so
// every module reading these values at load time (band buttons, VFO start,
// the users list address, the region filter) already sees the right receiver.
import buildTime from '../site_information.json'

let runtime = {}
try {
  runtime = window.__PHANTOM_SITE_INFO__ || {}
} catch (e) {}

export const siteInfo = { ...buildTime, ...runtime }

// A typed "http://" in front of an address the file then prefixes again — an
// older add-receiver.sh wrote exactly that — leaves "http://http://host:port/…",
// and every fetch or link built from it fails (the receiver picker then shows
// no buttons at all). Collapse a repeated scheme to its last one, for every
// address in the file, before anything reads it.
for (const [key, value] of Object.entries(siteInfo)) {
  if (typeof value === 'string') {
    siteInfo[key] = value.replace(/^\s*(?:https?:\/\/\s*)+(https?:\/\/)/i, '$1')
  }
}
export default siteInfo

export const {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteReceiverURL,
  siteAntenna,
  siteAntennaURL,
  siteNote,
  siteIP,
  siteStats,
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} = siteInfo
