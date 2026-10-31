/**
 * serverport.js — where the internal taps find spectrumserver.
 *
 * A tap connects DIRECTLY to spectrumserver (loopback + token), bypassing the
 * proxy, so it needs spectrumserver's own [server] port — NOT the public/proxy
 * port. Shared by the autorun daemon (index.js) and the DRM helper.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Parse the [server] port out of a TOML file (the port spectrumserver binds). */
export function portFromToml(path) {
    try {
        const toml = readFileSync(path, 'utf8');
        // Grab the first `port = N` at/after the [server] header, ignoring
        // public_port/proxy_port and inline "# ..." comments.
        const seg = toml.split(/^\s*\[/m).find((s) => s.startsWith('server]')) ?? toml;
        const m = seg.match(/^\s*port\s*=\s*(\d+)/m);
        if (m) return Number(m[1]);
    } catch { /* unreadable — caller falls back */ }
    return 0;
}

/**
 * Resolve spectrumserver's listen port. Different installs run different config
 * files (config.toml, config-rx888mk2.toml, config-rtl.toml, …) on different
 * ports, so we first ask the RUNNING spectrumserver which config it was launched
 * with (`--config <file>` or a positional `<file>.toml`) and read that file's
 * [server] port. Falls back to config.toml, then the caller's default.
 */
export function readServerPort() {
    try {
        const out = execFileSync('pgrep', ['-af', 'spectrumserver'], { encoding: 'utf8' });
        for (const line of out.split('\n')) {
            if (!/spectrumserver/.test(line) || /pgrep/.test(line)) continue;
            const cfg = line.match(/--config\s+(\S+)/)?.[1] || line.match(/(\S+\.toml)\b/)?.[1];
            if (!cfg) continue;
            const path = cfg.startsWith('/') ? cfg : join(ROOT, cfg);
            const p = portFromToml(path);
            if (p) return p;
        }
    } catch { /* pgrep absent or nothing running — fall back to config.toml */ }
    return portFromToml(join(ROOT, 'config.toml'));
}

/**
 * The receivers listed in receivers.toml, as [{ id, port, isDefault }]. Empty
 * on a single-receiver station that has no receivers.toml. Only the keys the
 * taps need are read; a hand parse keeps the helper free of a TOML dependency.
 */
export function readReceivers() {
    let text;
    try { text = readFileSync(join(ROOT, 'receivers.toml'), 'utf8'); } catch { return []; }
    const out = [];
    for (const block of text.split(/^\s*\[\[receiver\]\]\s*$/m).slice(1)) {
        const val = (k) => block.match(new RegExp(`^\\s*${k}\\s*=\\s*("([^"]*)"|[^\\s#]+)`, 'm'));
        const id = val('id')?.[2] ?? val('id')?.[1];
        const port = Number(val('port')?.[1]);
        if (!id || !port) continue;
        out.push({ id, port, isDefault: val('default')?.[1] === 'true' });
    }
    return out;
}

/**
 * spectrumserver port for a receiver id (the page's ?rx=). An unknown or empty
 * id means the default receiver; no receivers.toml means the one running server.
 */
export function receiverPort(rxId) {
    const list = readReceivers();
    if (list.length === 0) return readServerPort();
    const hit = list.find((r) => r.id === rxId) || list.find((r) => r.isDefault) || list[0];
    return hit.port;
}
