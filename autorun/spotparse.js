/**
 * spotparse.js — extract the transmitting callsign (and grid, if present) from
 * an FT8/FT4 message so it can be reported to PSK Reporter.
 *
 * FT8/FT4 standard message is "<to> <from> <report|grid>". The station we are
 * spotting is the SENDER:
 *   "CQ IK4LZH JN54"        -> call IK4LZH, grid JN54   (CQ: sender follows CQ[/mod])
 *   "CQ POTA K4CAE EM94"    -> call K4CAE,  grid EM94
 *   "LB4PI IK4LZH R-16"     -> call IK4LZH, no grid     (2nd token is the sender)
 *   "IK0VTG KC8ZKS -17"     -> call KC8ZKS, no grid
 *   "PI4TS YO4GIY RR73"     -> call YO4GIY, no grid
 * Hashed calls (<...>), telemetry and free text yield null (nothing to report).
 *
 * Only spots with a valid sender callsign are reportable; the grid is optional
 * (PSK Reporter accepts spots without one).
 */

// Maidenhead grid: 4 or 6 chars. Reports (R-16, -05, +02, RR73, RRR, 73) do NOT match.
const GRID_RE = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i;

// A plausible callsign: letters+digits, must contain a digit and a letter, may
// carry a /P /MM /<region> suffix or prefix. Rejects pure grids and reports.
const CALL_RE = /^[A-Z0-9]{0,3}[0-9][A-Z]{1,3}(\/[A-Z0-9]+)?$/i;

// CQ modifiers that sit between "CQ" and the callsign (CQ DX, CQ POTA, CQ TEST…).
const CQ_MOD_RE = /^([A-Z]{2,4}|[0-9]{3})$/i; // e.g. DX, POTA, TEST, NA, 020 (band/region)

// Reports/signoffs that must NEVER be read as a grid. RR73 in particular
// collides with the 4-char grid pattern (RR + 73) but is always a signoff here.
const REPORT_RE = /^(RR73|RRR|73|R?[+-][0-9]{2})$/i;

function isGrid(tok)  { return GRID_RE.test(tok) && !REPORT_RE.test(tok); }
function isCall(tok)  { return CALL_RE.test(tok) && /[0-9]/.test(tok) && /[A-Z]/i.test(tok); }

/**
 * @param {string} text raw FT8/FT4 message
 * @returns {{call:string, grid:string|null}|null}
 */
export function parseFtxSpot(text) {
    if (!text) return null;
    const toks = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (toks.length < 2) return null;
    if (text.includes('<')) {
        // Hashed call somewhere. If the SENDER is hashed we can't report it; if
        // only the "to" call is hashed we still can. Handle below per-branch.
    }

    let call = null;
    let grid = null;

    if (toks[0] === 'CQ') {
        // Skip an optional modifier, then the sender callsign, then optional grid.
        let i = 1;
        if (i < toks.length && !isCall(toks[i]) && CQ_MOD_RE.test(toks[i])) i++;
        if (i < toks.length && isCall(toks[i])) {
            call = toks[i];
            const last = toks[toks.length - 1];
            if (last !== call && isGrid(last)) grid = last;
        }
    } else {
        // "<to> <from> <report|grid>" — sender is the 2nd token.
        if (isCall(toks[1])) {
            call = toks[1];
            const last = toks[toks.length - 1];
            if (last !== call && isGrid(last)) grid = last;
        }
    }

    if (!call) return null;
    return { call, grid: grid || null };
}
