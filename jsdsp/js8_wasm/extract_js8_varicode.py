#!/usr/bin/env python3
"""
extract_js8_varicode.py — generate the JS8 message-layer tables from the
JS8Call (GPL-3) sources.

Produces two things:

  frontend/src/modules/js8-tables.js
      Small tables, inlined into the bundle: the character Huffman table used
      by plain data frames, the directed-command table, the special "basecall"
      values (@ALLCALL and friends), the packing alphabets, and the grid
      constants. A few kB in total.

  frontend/public/decoders/js8_dict.bin
      The JSC word dictionary used by COMPRESSED data frames. 262144 entries,
      ~1.9 MB of text. This is far too big to inline, so it ships as a binary
      blob that js8.js fetches lazily -- only when a compressed frame actually
      turns up. See the README for the sizing.

Only the decode direction is generated. JS8Call carries two copies of the
dictionary (`list`, sorted for lookup during compression, and `map`, indexed by
codeword for decompression); a receiver needs only `map`, which halves it.

Usage: extract_js8_varicode.py <js8call-src-root> <repo-root>
"""

import os
import re
import sys
import struct

def read(p):
    with open(p, 'r', encoding='latin-1') as f:
        return f.read()

def strip_comments(text):
    """Remove // and /* */ comments, respecting string literals.

    Necessary because the tables carry commented-out entries -- notably
    `// {" ", 14 }, // reserved` sitting right above the live `{" ACK", 14}`.
    Matching the dead one wins the "first key in sorted order" tie-break and
    silently mislabels every ACK.
    """
    out = []
    i = 0
    in_str = False
    while i < len(text):
        ch = text[i]
        if in_str:
            out.append(ch)
            if ch == '\\' and i + 1 < len(text):
                out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_str = False
            i += 1
            continue
        if ch == '"':
            in_str = True
            out.append(ch)
            i += 1
            continue
        if text.startswith('//', i):
            j = text.find('\n', i)
            i = len(text) if j < 0 else j
            continue
        if text.startswith('/*', i):
            j = text.find('*/', i + 2)
            i = len(text) if j < 0 else j + 2
            continue
        out.append(ch)
        i += 1
    return ''.join(out)

src, repo = sys.argv[1], sys.argv[2]
varicode = strip_comments(read(os.path.join(src, 'varicode.cpp')))
submodes_cpp = strip_comments(read(os.path.join(src, 'JS8Submode.cpp')))
config_cpp   = read(os.path.join(src, 'Configuration.cpp'))

# ── Huffman table for plain (uncompressed) data frames ──────────────────────
def huff_table():
    m = re.search(r'QMap<QString, QString> hufftable = \{(.*?)\n\};', varicode, re.S)
    if not m:
        raise SystemExit('hufftable not found')
    out = {}
    for ch, code in re.findall(r'\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"([01]+)"\s*\}', m.group(1)):
        ch = ch.replace('\\"', '"').replace('\\\\', '\\')
        out[ch] = code
    return out

# ── Directed commands ───────────────────────────────────────────────────────
def directed_cmds():
    m = re.search(r'QMap<QString, int> directed_cmds = \{(.*?)\n\};', varicode, re.S)
    if not m:
        raise SystemExit('directed_cmds not found')
    pairs = []
    for name, val in re.findall(r'\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*(-?\d+)\s*\}', m.group(1)):
        pairs.append((name, int(val)))
    return pairs

# ── Special callsign values ─────────────────────────────────────────────────
def basecalls():
    m = re.search(r'QMap<QString, quint32> basecalls = \{(.*?)\n\};', varicode, re.S)
    if not m:
        raise SystemExit('basecalls not found')
    out = []
    for name, off in re.findall(r'\{\s*"([^"]*)"\s*,\s*nbasecall\s*\+\s*(\d+)\s*\}', m.group(1)):
        out.append((name, int(off)))
    return out

def const_int(name):
    """Pull a scalar like `quint16 nbasegrid = 180 * 180;` and evaluate it."""
    m = re.search(r'\b' + name + r'\s*=\s*([^;]+);', varicode)
    if not m:
        raise SystemExit('constant %s not found' % name)
    expr = m.group(1).strip()
    expr = expr.replace('(1<<15)', str(1 << 15))
    expr = re.sub(r'\bnbasegrid\b', str(180 * 180), expr)
    return int(eval(expr, {'__builtins__': {}}, {}))

def qstring(name):
    m = re.search(r'QString ' + name + r' = \{"([^"]*)"\}', varicode)
    if not m:
        raise SystemExit('QString %s not found' % name)
    return m.group(1)

huff      = huff_table()
cmds      = directed_cmds()
bases     = basecalls()
alphabet72   = qstring('alphabet72')
alphanumeric = qstring('alphanumeric')

nbasecall = 37 * 36 * 10 * 27 * 27 * 27
nbasegrid = const_int('nbasegrid')
nusergrid = const_int('nusergrid')
nmaxgrid  = const_int('nmaxgrid')

# Sets that change how a command is displayed.
def int_set(name):
    m = re.search(r'QSet<int> ' + name + r' = \{([^}]*)\}', varicode)
    return sorted(int(x) for x in re.findall(r'-?\d+', m.group(1))) if m else []

snr_cmds      = int_set('snr_cmds')
buffered_cmds = int_set('buffered_cmds')

def checksum_cmds():
    # NB: [^}]* would stop at the first inner brace -- the entries are
    # themselves brace-delimited -- and silently yield an empty table.
    m = re.search(r'QMap<int, int> checksum_cmds = \{(.*?)\n\};', varicode, re.S)
    if not m:
        raise SystemExit('checksum_cmds not found')
    return sorted((int(a), int(b))
                  for a, b in re.findall(r'\{\s*(\d+)\s*,\s*(\d+)\s*\}', m.group(1)))

csum_cmds = checksum_cmds()

def rx_thresholds():
    """Per-submode frequency tolerance for grouping frames into one message
    buffer, from JS8Submode.cpp. The field is optional and defaults to 10."""
    order = ['Normal', 'Fast', 'Turbo', 'Slow', 'Ultra']
    out = []
    for name in order:
        m = re.search(r'constexpr Data ' + name + r'\s*=\s*\{([^}]*)\}', submodes_cpp)
        if not m:
            raise SystemExit('submode %s not found in JS8Submode.cpp' % name)
        fields = [f.strip() for f in m.group(1).split(',')]
        out.append(int(fields[6]) if len(fields) > 6 else 10)
    return out

rx_threshold = rx_thresholds()

# Submode order used throughout PhantomSDR-Plus: Normal, Fast, Turbo, Slow,
# Ultra -- which is NOT JS8Call's NSUBMODE numbering (0/1/2/4/8). Periods come
# from the Fortran params files, the same source extract_js8_constants.py uses,
# so the two generators cannot disagree.
SUBMODE_LETTERS = [('Normal', 'a'), ('Fast', 'b'), ('Turbo', 'c'),
                   ('Slow', 'e'), ('Ultra', 'i')]

def submode_periods():
    """T/R CYCLE lengths, from commons.h.

    NB: NOT the Fortran NTXDUR, which is how long a station transmits. They
    differ for Slow -- 28 s of signal inside a 30 s cycle -- and slot
    scheduling must align to the cycle.
    """
    commons = read(os.path.join(src, 'commons.h'))
    out = []
    for name, letter in SUBMODE_LETTERS:
        m = re.search(r'#define\s+JS8%s_TX_SECONDS\s+(\d+)' % letter.upper(), commons)
        if not m:
            raise SystemExit('JS8%s_TX_SECONDS not found in commons.h' % letter.upper())
        out.append(int(m.group(1)))
    return out

def submode_txdurs():
    """Seconds of actual transmission -- how much audio a slot must capture."""
    out = []
    for name, letter in SUBMODE_LETTERS:
        p = read(os.path.join(src, 'lib/js8/js8%s_params.f90' % letter))
        m = re.search(r'\bNTXDUR\s*=\s*(\d+)', p)
        if not m:
            raise SystemExit('NTXDUR not found for submode %s' % name)
        out.append(int(m.group(1)))
    return out

submode_period = submode_periods()
submode_txdur  = submode_txdurs()

def config_default(key, fallback):
    m = re.search(r'settings_->value\("' + key + r'",\s*QString\{"([^"]*)"\}\)', config_cpp)
    if not m:
        return fallback
    # The literals are C++ \uXXXX escapes.
    return re.sub(r'\\u([0-9a-fA-F]{4})',
                  lambda mm: chr(int(mm.group(1), 16)), m.group(1))

eot_default = config_default('EOTCharacter', '\u2662')
mfi_default = config_default('MFICharacter', '\u2026\u2026')

assert alphabet72 == '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+/?.'
assert alphanumeric == '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ /@'
assert nbasegrid == 32400 and nusergrid == 32410 and nmaxgrid == 32767

# ── Emit js8-tables.js ──────────────────────────────────────────────────────
def jsstr(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

lines = []
lines.append('/**')
lines.append(' * js8-tables.js — GENERATED by jsdsp/js8_wasm/extract_js8_varicode.py.')
lines.append(' * Do not edit by hand; re-run the generator instead.')
lines.append(' *')
lines.append(' * Derived from JS8Call (https://github.com/js8call/js8call), GPL-3.0.')
lines.append(' * PhantomSDR-Plus is GPL-3.0, so this is license-compatible.')
lines.append(' */')
lines.append('')
lines.append('/** Alphabet the 72 payload bits are grouped into, 6 bits per character. */')
lines.append('export const ALPHABET72 = %s;' % jsstr(alphabet72))
lines.append('')
lines.append('/** Callsign and grid alphabet (38 characters + one extra slot at index 38). */')
lines.append('export const ALPHANUMERIC = %s;' % jsstr(alphanumeric))
lines.append('')
lines.append('export const NBASECALL = %d;' % nbasecall)
lines.append('export const NBASEGRID = %d;' % nbasegrid)
lines.append('export const NUSERGRID = %d;' % nusergrid)
lines.append('export const NMAXGRID  = %d;' % nmaxgrid)
lines.append('')
lines.append('/** i3bit is a bitfield, not a frame type (varicode.h). */')
lines.append('export const I3_FIRST = 1;   // first frame of a message')
lines.append('export const I3_LAST  = 2;   // last frame of a message')
lines.append('export const I3_DATA  = 4;   // raw data frame, no frame-type header')
lines.append('')
lines.append('/** Frame types, held in the first 3 bits of the 72-bit payload. */')
lines.append('export const FRAME_HEARTBEAT         = 0;')
lines.append('export const FRAME_COMPOUND          = 1;')
lines.append('export const FRAME_COMPOUND_DIRECTED = 2;')
lines.append('export const FRAME_DIRECTED          = 3;')
lines.append('export const FRAME_DATA              = 4;  // 10X')
lines.append('export const FRAME_DATA_COMPRESSED   = 6;  // 11X')
lines.append('')
lines.append('/** Special callsign values, stored as offsets from NBASECALL. */')
lines.append('export const BASECALLS = new Map([')
for name, off in bases:
    lines.append('  [NBASECALL + %-3d, %s],' % (off, jsstr(name)))
lines.append(']);')
lines.append('')
lines.append('/** Directed command number -> display text. Several names share a')
lines.append('  * number; JS8Call resolves that with QMap::key(), which returns the')
lines.append('  * FIRST key in sorted order, so that is what is stored here. */')
lines.append('export const DIRECTED_CMDS = new Map([')
by_num = {}
for name, val in cmds:
    # QMap::key() returns the first match in the map's sorted key order.
    if val not in by_num or name < by_num[val]:
        by_num[val] = name
for val in sorted(by_num):
    lines.append('  [%3d, %s],' % (val, jsstr(by_num[val])))
lines.append(']);')
lines.append('')
lines.append('/** 41-character alphabet used by the message checksums. */')
lines.append('export const ALPHABET = %s;' % jsstr(qstring('alphabet')))
lines.append('export const NALPHABET = 41;')
lines.append('')
lines.append('/** Per-submode tolerance, in Hz, for grouping frames into one message.')
lines.append('  * From JS8Submode.cpp; indexed Normal, Fast, Turbo, Slow, Ultra. */')
lines.append('export const RX_THRESHOLD_HZ = [%s];' % ', '.join(str(v) for v in rx_threshold))
lines.append('')
lines.append('/** T/R CYCLE in seconds, same submode order. Slot scheduling aligns to this. */')
lines.append('export const SUBMODE_PERIOD_S = [%s];'
             % ', '.join(str(v) for v in submode_period))
lines.append('')
lines.append('/** Seconds of transmission -- how much audio each slot must capture. */')
lines.append('export const SUBMODE_TXDUR_S = [%s];'
             % ', '.join(str(v_) for v_ in submode_txdur))
lines.append('')
lines.append('/** Submode names, same order. */')
lines.append('export const SUBMODE_NAMES = [%s];'
             % ', '.join(jsstr(n) for n, _ in SUBMODE_LETTERS))
lines.append('')
lines.append('/** Commands that open a buffer and wait for following data frames. */')
lines.append('export const BUFFERED_CMDS = new Set([%s]);'
             % ', '.join(str(v) for v in buffered_cmds))
lines.append('')
lines.append('/** Buffered commands whose assembled text ends with a checksum, and its size. */')
lines.append('export const CHECKSUM_CMDS = new Map([%s]);'
             % ', '.join('[%d, %d]' % (a, b) for a, b in csum_cmds))
lines.append('')
lines.append('/** JS8Call UI defaults: end-of-transmission and message-frame-idle markers. */')
lines.append('export const EOT = %s;' % jsstr(eot_default))
lines.append('export const MFI = %s;' % jsstr(mfi_default))
lines.append('')
lines.append('/** Commands whose extra field carries an SNR rather than a plain number. */')
lines.append('export const SNR_CMDS = new Set(%s);' % ('[' + ', '.join(str(v) for v in snr_cmds) + ']'))
lines.append('')
lines.append('/** Character Huffman table for plain data frames: code string -> character. */')
lines.append('export const HUFF_DECODE = new Map([')
for ch in sorted(huff, key=lambda c: (len(huff[c]), huff[c])):
    lines.append('  [%-11s, %s],' % (jsstr(huff[ch]), jsstr(ch)))
lines.append(']);')
lines.append('')

js_path = os.path.join(repo, 'frontend/src/modules/js8-tables.js')
os.makedirs(os.path.dirname(js_path), exist_ok=True)
open(js_path, 'w').write('\n'.join(lines))

# ── Emit js8_dict.bin ───────────────────────────────────────────────────────
# Only `map` is needed: JSC::decompress() indexes it directly by codeword.
jsc_map = read(os.path.join(src, 'jsc_map.cpp'))
body = jsc_map[jsc_map.index('JSC::map[262144]'):]
# 32 entries hold a single high Latin-1 byte written as a \xNN escape and carry
# an inline /* ... */ comment between the string and its length, so the comment
# has to be optional in the pattern rather than assumed absent.
ENTRY_RE = re.compile(r'\{"((?:[^"\\]|\\.)*)"\s*(?:/\*.*?\*/)?\s*,\s*(\d+),\s*(\d+)\}', re.S)
entries = ENTRY_RE.findall(body)
if len(entries) != 262144:
    raise SystemExit('expected 262144 dictionary entries, parsed %d' % len(entries))

def unescape(raw):
    """C string escapes -> raw bytes. The dictionary is Latin-1, not UTF-8
    (JSC::decompress reads it with QLatin1String), so decode to bytes and keep
    them that way."""
    out = bytearray()
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch != '\\':
            out += ch.encode('latin-1')
            i += 1
            continue
        nxt = raw[i + 1]
        if nxt == 'x':
            j = i + 2
            while j < len(raw) and j < i + 4 and raw[j] in '0123456789abcdefABCDEF':
                j += 1
            out.append(int(raw[i + 2:j], 16))
            i = j
        elif nxt == 'n':  out.append(0x0A); i += 2
        elif nxt == 't':  out.append(0x09); i += 2
        elif nxt == 'r':  out.append(0x0D); i += 2
        elif nxt == '0':  out.append(0x00); i += 2
        else:             out += nxt.encode('latin-1'); i += 2
    return bytes(out)

# The Tuple's `size` field is only used by JSC::compress(); JSC::decompress()
# reads `str` alone, so we keep the actual bytes. Upstream has a couple of
# entries where the two disagree ("@ALLCALL" declared 7, "ROSIDS" declared 1) --
# harmless here, but worth surfacing, and a large count would mean the parse
# went wrong rather than that upstream is quirky.
words = []
size_mismatches = []
for raw, size, _idx in entries:
    b = unescape(raw)
    if len(b) != int(size):
        size_mismatches.append((raw, int(size), len(b)))
    if len(b) > 255:
        raise SystemExit('word too long for a 1-byte length: %r' % raw)
    words.append(b)

if len(size_mismatches) > 5:
    raise SystemExit('%d size mismatches -- the parse is wrong, not upstream'
                     % len(size_mismatches))

# Format: "JS8D" | version u8 | count u32le | count x (len u8) | concatenated bytes.
# Lengths first so the reader can build its offset table in one pass.
blob = bytearray()
blob += b'JS8D'
blob += struct.pack('<BI', 1, len(words))
blob += bytes(len(w) for w in words)
for w in words:
    blob += w

bin_path = os.path.join(repo, 'frontend/public/decoders/js8_dict.bin')
os.makedirs(os.path.dirname(bin_path), exist_ok=True)
open(bin_path, 'wb').write(bytes(blob))

print('huffman table  : %d characters' % len(huff))
print('directed cmds  : %d numbers, %d aliases' % (len(by_num), len(cmds)))
print('basecalls      : %d' % len(bases))
print('rx thresholds  : %s Hz' % rx_threshold)
print('periods        : cycle %s s, tx %s s' % (submode_period, submode_txdur))
print('buffered cmds  : %s' % buffered_cmds)
print('eot/mfi        : %r / %r' % (eot_default, mfi_default))
print('dictionary     : %d words, %d bytes of text' % (len(words), sum(len(w) for w in words)))
for raw, declared, actual in size_mismatches:
    print('  note: upstream size field for %r says %d, string is %d (unused when decoding)'
          % (raw, declared, actual))
print('wrote %s (%d bytes)' % (js_path, os.path.getsize(js_path)))
print('wrote %s (%d bytes)' % (bin_path, len(blob)))
