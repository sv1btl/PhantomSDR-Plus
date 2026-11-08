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
  siteRade,
  siteDrm,
  siteRelay,
} = siteInfo

// The callsign alone, for links that search by callsign (PSK Reporter's FT8 /
// FT4 / JS8 maps, the WSPRnet log). siteSysop is free text: the station wizard
// writes "Name, CALL" when the sysop gives a name, and a name must never reach
// those searches. An explicit "siteCallsign" in site_information.json wins;
// otherwise the first word of siteSysop that looks like a callsign (letters and
// digits with a digit inside, optional /P-style parts); otherwise the part after
// the last comma.
const CALL_RE = /(?:^|[^A-Z0-9/])((?:[A-Z0-9]{1,4}\/)?[A-Z0-9]{0,3}[0-9][A-Z0-9]{0,3}[A-Z](?:\/[A-Z0-9]{1,4})?)(?![A-Z0-9/])/i
export function callsignOf (text) {
  const t = String(text || '').trim()
  const m = t.match(CALL_RE)
  if (m) return m[1].toUpperCase()
  const parts = t.split(',')
  return parts[parts.length - 1].trim()
}
export const siteCallsign = String(siteInfo.siteCallsign || '').trim().toUpperCase() || callsignOf(siteSysop)
