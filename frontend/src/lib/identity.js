// The listener's name/callsign, typed in the box next to "Open Additional
// Info" and shown in the users list, on the other listeners' waterfall labels
// and on chat lines. Kept in localStorage ("chatusername" is the chat's old
// key), so it survives a reload and a switch to another receiver on the same
// address.
//
// A receiver on another address (another host or port) has its own
// localStorage, so receiverTuneUrl() carries the name across in the URL
// (?idname=) and loadIdentity() takes it from there once, saves it and strips
// it from the address bar.

const NAME_KEY = 'chatusername'
export const NAME_PARAM = 'idname'

export function anonymousName () {
  return 'anonymous' + Math.floor(Math.random() * 10000)
}

// The placeholder names (ours and the old "user1234") mean nobody typed one.
export function isAnonymousName (name) {
  return /^(anonymous|user)\d*$/i.test(String(name || '').trim())
}

// The WebSDR's rule for a name or callsign: at most 10 characters, no spaces,
// and (ours) at least one letter or digit. Returns the name, "" for none, or
// null when what was typed is not a name or callsign (so it counts as none).
export function cleanName (raw) {
  const n = String(raw || '').trim()
  if (!n) return ''
  if (n.length > 10 || /\s/.test(n) || !/[\p{L}\p{N}]/u.test(n)) return null
  return n
}

function read (key) {
  try { return localStorage.getItem(key) || '' } catch (e) { return '' }
}

export function saveIdentity (name) {
  try { localStorage.setItem(NAME_KEY, name) } catch (e) {}
}

export function loadIdentity () {
  try {
    // A QTH locator field existed briefly (5.3.0 development); drop it.
    localStorage.removeItem('chatlocator')
  } catch (e) {}
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has(NAME_PARAM) || url.searchParams.has('idloc')) {
      const name = cleanName(url.searchParams.get(NAME_PARAM)) || ''
      if (name) saveIdentity(name)
      url.searchParams.delete(NAME_PARAM)
      url.searchParams.delete('idloc')
      history.replaceState(history.state, '', url.href)
    }
  } catch (e) {}
  let name = read(NAME_KEY).trim()
  // Saved before the chat default became "anonymous": keep the number.
  const old = /^user(\d+)$/i.exec(name)
  if (old) name = 'anonymous' + old[1]
  // Saved under the older, looser rule: not a name or callsign → none.
  else if (!isAnonymousName(name) && cleanName(name) === null) name = ''
  return name || anonymousName()
}

// Add the name to a link that opens a receiver on another address.
export function carryIdentity (u) {
  if (u.origin === window.location.origin) return
  const name = read(NAME_KEY).trim()
  if (!name || isAnonymousName(name)) return
  u.searchParams.set(NAME_PARAM, name)
}
