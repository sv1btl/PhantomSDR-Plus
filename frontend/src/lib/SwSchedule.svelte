<script>
  // SW Schedule — search the EiBi broadcast schedule with the criteria
  // shortwave.live uses (station, language, target area, band, UTC time,
  // frequency, transmitter country) and tune a row with one click.
  //
  // Data: /eibi.json, written by frequencylist/update-eibi.sh (once a day,
  // from http://www.eibispace.de/dx/). The HFCC waterfall markers are a
  // separate list and are not touched by this window.
  //
  // Events:
  //   tune    { hz, mode }   mode is a marker mode: AM, USB, LSB, CW, FAX, HFDL
  //   markers [ { frequency, name, mode } ]   current results for the waterfall,
  //                                          [] when the toggle is off / closed
  //   close
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";

  export let dataUrl = "/eibi.json";
  export let lowHz = 0;        // this receiver's range
  export let highHz = 0;
  export let dialKhz = 0;      // the current dial, for the "dial" button
  export let markersShown = false; // green markers still up from the last opening
  export let hfccHidden = false;   // the yellow HFCC markers are hidden
  export let pickedKey = "";       // rowKey() of the station being listened to: shown red

  const dispatch = createEventDispatcher();
  const STORE_KEY = "phantom.swschedule";
  // The table draws PAGE rows at first and PAGE more each time it is scrolled
  // near its bottom, so every result can be reached without drawing thousands
  // of rows at once. The waterfall markers always use every result.
  const PAGE = 400;

  // shortwave.live's band list, plus everything below LW for the utilities.
  const BANDS = [
    { key: "", label: "Any" },
    { key: "vlf", label: "VLF / LF (below 148 kHz)", lo: 0, hi: 148 },
    { key: "lw", label: "Long Wave (148-279 kHz)", lo: 148, hi: 279 },
    { key: "mw", label: "Medium Wave (530-1700 kHz)", lo: 530, hi: 1700 },
    { key: "sw", label: "Standard Shortwave (2300-29999 kHz)", lo: 2300, hi: 29999 },
    { key: "120", label: "120 m (2300-2495 kHz)", lo: 2300, hi: 2495 },
    { key: "90", label: "90 m (3200-3400 kHz)", lo: 3200, hi: 3400 },
    { key: "75", label: "75 m (3900-4000 kHz)", lo: 3900, hi: 4000 },
    { key: "60", label: "60 m (4750-4995 kHz)", lo: 4750, hi: 4995 },
    { key: "49", label: "49 m (5900-6200 kHz)", lo: 5900, hi: 6200 },
    { key: "41", label: "41 m (7200-7450 kHz)", lo: 7200, hi: 7450 },
    { key: "31", label: "31 m (9400-9900 kHz)", lo: 9400, hi: 9900 },
    { key: "25", label: "25 m (11600-12100 kHz)", lo: 11600, hi: 12100 },
    { key: "22", label: "22 m (13570-13870 kHz)", lo: 13570, hi: 13870 },
    { key: "19", label: "19 m (15100-15800 kHz)", lo: 15100, hi: 15800 },
    { key: "16", label: "16 m (17480-17900 kHz)", lo: 17480, hi: 17900 },
    { key: "15", label: "15 m (18900-19020 kHz)", lo: 18900, hi: 19020 },
    { key: "13", label: "13 m (21450-21850 kHz)", lo: 21450, hi: 21850 },
    { key: "11", label: "11 m (25670-26100 kHz)", lo: 25670, hi: 26100 },
  ];
  const DAY_NAMES = ["", "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ── filters (remembered per browser) ──────────────────────────────────
  let f = {
    station: "", lang: "", target: "", band: "", country: "", site: "",
    khz: "", time: "now", hh: "", mm: "", today: true, receivable: true,
    onWf: false, sort: "khz", desc: false,
  };
  // Window position in page coordinates: it opens centred on the screen and
  // scrolls with the page; dragging moves it for this opening only.
  let pos = null; // { x, y }
  let dragged = false;
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (s && typeof s === "object" && s.f) f = { ...f, ...s.f };
  } catch (e) {}
  // "Show on waterfall" is not remembered across page loads: it starts ticked
  // only while the markers of an earlier opening are still on the waterfall.
  f.onWf = markersShown;
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ f: { ...f, onWf: false } })); } catch (e) {}
  }
  $: f, save();

  // ── data ──────────────────────────────────────────────────────────────
  let data = null;
  let error = "";
  let rows = [];        // decoded rows
  let langOpts = [], targetOpts = [], countryOpts = [], siteOpts = [], stationNames = [];

  const byName = (a, b) => a[1].localeCompare(b[1]);

  async function load() {
    error = "";
    try {
      const r = await fetch(dataUrl, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      data = await r.json();
    } catch (e) {
      error = "The schedule is not available on this station yet (" + (e && e.message ? e.message : e) +
        "). The sysop runs frequencylist/update-eibi.sh to fetch it.";
      return;
    }
    const st = data.stations || [];
    const usedL = new Set(), usedT = new Set(), usedC = new Set(), usedS = new Set();
    rows = data.rows.map((r) => {
      const site = r[8] || "";
      const host = site.split("-")[0] || r[4];
      const o = {
        khz: r[0], start: r[1], end: r[2], days: r[3] || "", itu: r[4],
        station: typeof r[5] === "number" ? st[r[5]] || "" : r[5] || "",
        lang: r[6] || "", target: r[7] || "", site, host,
        mode: r[9] || "AM", from: r[10] || "", to: r[11] || "", heard: r[12] || "",
      };
      o.langs = o.lang ? o.lang.split(",") : [];
      o.langs.forEach((l) => usedL.add(l));
      if (o.target) usedT.add(o.target);
      usedC.add(o.itu);
      usedS.add(host);
      o.sLow = o.station.toLowerCase();
      return o;
    });
    langOpts = [...usedL].map((c) => [c, data.lang[c] || c]).sort(byName);
    targetOpts = [...usedT].map((c) => [c, data.target[c] || c]).sort(byName);
    countryOpts = [...usedC].map((c) => [c, countryName(c)]).sort(byName);
    siteOpts = [...usedS].map((c) => [c, countryName(c)]).sort(byName);
    stationNames = [...new Set(st)].sort((a, b) => a.localeCompare(b));
    await tick();
    if (!dragged) place();
  }

  // ── helpers ───────────────────────────────────────────────────────────
  const countryName = (c) => (data && data.country[c] ? data.country[c][0] : c);
  function flag(c) {
    const iso = data && data.country[c] ? data.country[c][1] : "";
    if (!iso || iso.length !== 2) return "";
    return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  }
  function flagHtml(c) {
    const e = flag(c);
    if (!e) return "";
    return window.twemoji ? window.twemoji.parse(e) : e;
  }
  const hhmm = (n) => String(Math.floor(n / 100)).padStart(2, "0") + ":" + String(n % 100).padStart(2, "0");
  const toMin = (n) => Math.floor(n / 100) * 60 + (n % 100);
  const langName = (o) => o.langs.map((l) => (data.lang[l] || l)).join(", ");
  const targetName = (o) => (o.target ? data.target[o.target] || o.target : "");
  function siteName(o) {
    const name = data.site[o.site] || "";
    const ctry = countryName(o.host);
    return name ? `${ctry}, ${name}` : ctry;
  }
  function daysText(d) {
    if (!d) return "daily";
    if (/^[1-7]+$/.test(d)) return [...d].map((c) => DAY_NAMES[+c]).join(",");
    return d;
  }

  // The EiBi day field against a UTC weekday (1 = Monday) and date:
  // true / false, or null when it can't be told (irr, alt, 1.Sa, Ram, test…).
  function dayMatch(d, dow, date) {
    if (!d || d === "USB" || d === "LSB") return true;
    if (/^[1-7]+$/.test(d)) return d.includes(String(dow));
    const dm = d.match(/^(\d{1,2})([A-Z][a-z]{2})$/);
    if (dm) {
      return +dm[1] === date.getUTCDate() && MONTHS.indexOf(dm[2]) === date.getUTCMonth();
    }
    let any = false;
    for (const tok of d.split(",")) {
      const range = tok.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
      if (range) {
        const a = DAY_NAMES.indexOf(range[1]), b = DAY_NAMES.indexOf(range[2]);
        if (a < 1 || b < 1) return null;
        any = true;
        if (a <= b ? dow >= a && dow <= b : dow >= a || dow <= b) return true;
        continue;
      }
      if (/^([A-Z][a-z])+$/.test(tok)) {
        const names = tok.match(/[A-Z][a-z]/g);
        if (names.some((n) => DAY_NAMES.indexOf(n) < 1)) return null;
        any = true;
        if (names.some((n) => DAY_NAMES.indexOf(n) === dow)) return true;
        continue;
      }
      return null;
    }
    return any ? false : null;
  }

  // Entries valid for part of the season carry DDMM dates (no year).
  function dateOk(o, date) {
    if (!o.from && !o.to) return true;
    const y = data.season_year || date.getUTCFullYear();
    const winter = (data.season || "").startsWith("B");
    const toDate = (s) => {
      if (!/^\d{4}$/.test(s)) return null;
      const dd = +s.slice(0, 2), mm = +s.slice(2) - 1;
      return Date.UTC(winter && mm < 6 ? y + 1 : y, mm, dd);
    };
    const t = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const a = toDate(o.from), b = toDate(o.to);
    if (a !== null && t < a) return false;
    if (b !== null && t > b) return false;
    return true;
  }

  // On air at UTC minute m of the given date: the times, then the day of the
  // broadcast's START (an evening broadcast running past midnight started
  // the day before).
  function onAirAt(o, m, date) {
    const s = toMin(o.start), e = toMin(o.end);
    let inTime, started = date;
    if (s === e) inTime = true;
    else if (s < e) inTime = m >= s && m < e;
    else {
      inTime = m >= s || m < e;
      if (m < e) started = new Date(date.getTime() - 86400000);
    }
    if (!inTime) return false;
    if (!dateOk(o, started)) return false;
    const dow = ((started.getUTCDay() + 6) % 7) + 1;
    return dayMatch(o.days, dow, started) !== false;
  }

  // ── live clock ────────────────────────────────────────────────────────
  let now = new Date();
  const clock = setInterval(() => (now = new Date()), 20000);
  // Closing leaves the green markers on the waterfall; unticking
  // "Show on waterfall" (next time the window is open) removes them.
  onDestroy(() => clearInterval(clock));
  $: nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  $: utcText = now.toISOString().slice(11, 16);

  function useNowTime() {
    f.hh = String(now.getUTCHours()).padStart(2, "0");
    f.mm = String(now.getUTCMinutes()).padStart(2, "0");
    f.time = "at";
  }

  // ── filtering ─────────────────────────────────────────────────────────
  $: inRange = (o) => !(lowHz > 0 && highHz > lowHz) || (o.khz * 1000 >= lowHz && o.khz * 1000 < highHz);

  let total = 0;
  let onAirCount = 0;
  let shown = [];
  let results = [];
  let limit = PAGE;
  let lastSig = "";
  let tableEl;
  $: {
    const band = BANDS.find((b) => b.key === f.band);
    const st = f.station.trim().toLowerCase();
    const q = parseFloat(String(f.khz).replace(",", "."));
    const hasQ = Number.isFinite(q) && q > 0;
    let atMin = null;
    if (f.time === "now") atMin = nowMin;
    else if (f.time === "at") {
      const h = parseInt(f.hh, 10), mi = parseInt(f.mm || "0", 10);
      if (Number.isFinite(h) && h >= 0 && h < 24) atMin = h * 60 + (Number.isFinite(mi) ? Math.min(59, Math.max(0, mi)) : 0);
    }
    const todayDow = ((now.getUTCDay() + 6) % 7) + 1;
    const out = [];
    let air = 0;
    for (const o of rows) {
      if (band && band.key && !(o.khz >= band.lo && o.khz <= band.hi)) continue;
      if (hasQ && Math.abs(o.khz - q) > 2) continue;
      if (st && !o.sLow.includes(st)) continue;
      if (f.lang && !o.langs.includes(f.lang)) continue;
      if (f.target && o.target !== f.target) continue;
      if (f.country && o.itu !== f.country) continue;
      if (f.site && o.host !== f.site) continue;
      if (f.receivable && !inRange(o)) continue;
      if (f.today && (!dateOk(o, now) || dayMatch(o.days, todayDow, now) === false)) continue;
      if (atMin !== null && !onAirAt(o, atMin, now)) continue;
      o.live = onAirAt(o, nowMin, now);
      if (o.live) air++;
      out.push(o);
    }
    const dir = f.desc ? -1 : 1;
    const key = {
      khz: (o) => o.khz,
      mode: (o) => o.mode,
      start: (o) => o.start,
      end: (o) => o.end,
      station: (o) => o.sLow,
      lang: (o) => langName(o),
      target: (o) => targetName(o),
      site: (o) => siteName(o),
    }[f.sort] || ((o) => o.khz);
    out.sort((a, b) => {
      const x = key(a), y = key(b);
      if (x < y) return -dir;
      if (x > y) return dir;
      return a.khz - b.khz || a.start - b.start;
    });
    total = out.length;
    onAirCount = air;
    results = out;
    // New filters or sort: back to the first page. The 20 s clock re-runs this
    // block too, and must not undo the user's scrolling.
    const sig = JSON.stringify({ ...f, onWf: false });
    if (sig !== lastSig) {
      lastSig = sig;
      limit = PAGE;
      if (tableEl) tableEl.scrollTop = 0;
    }
  }
  $: shown = results.slice(0, limit);
  function onTableScroll() {
    if (!tableEl || limit >= results.length) return;
    if (tableEl.scrollTop + tableEl.clientHeight > tableEl.scrollHeight - 300) limit += PAGE;
  }

  // Waterfall markers: one per frequency, the on-air entry first.
  $: if (data) {
    if (f.onWf) {
      const seen = new Map();
      for (const o of results) {
        const hz = Math.round(o.khz * 1000);
        if (!seen.has(hz) || (o.live && !seen.get(hz).live)) seen.set(hz, o);
      }
      dispatch("markers", [...seen.values()].map((o) => ({
        frequency: Math.round(o.khz * 1000),
        name: o.station + (o.lang ? ` (${o.lang})` : ""),
        mode: tuneMode(o.mode),
        key: rowKey(o),   // the row it stands for: a click turns that row red
      })));
    } else {
      dispatch("markers", []);
    }
  }

  function sortBy(k) {
    if (f.sort === k) f.desc = !f.desc;
    else { f.sort = k; f.desc = false; }
  }
  function reset() {
    f = { ...f, station: "", lang: "", target: "", band: "", country: "", site: "", khz: "", time: "now", hh: "", mm: "", today: true, receivable: true };
  }
  // One broadcast: frequency, times and station (a station can have several
  // rows on one frequency at different times).
  const rowKey = (o) => `${o.khz}|${o.start}|${o.end}|${o.station}`;
  // Every mode but plain voice starts a decoder. CW counts as one (his call,
  // 2026-11-10): it is sent as the marker mode MORSE, which starts the CW
  // decoder; the list keeps showing "CW".
  function isDecoderMode(m) { return !["AM", "USB", "LSB"].includes(m); }
  function tuneMode(m) { return m === "CW" ? "MORSE" : m; }
  function tune(o) {
    dispatch("tune", { hz: Math.round(o.khz * 1000), mode: tuneMode(o.mode), name: o.station, key: rowKey(o) });
  }
  function tip(o) {
    const parts = [
      `${o.khz} kHz  ${hhmm(o.start)}-${hhmm(o.end)} UTC  ${daysText(o.days)}`,
      o.station + `  (${countryName(o.itu)})`,
      o.lang ? "Language: " + langName(o) : "",
      o.target ? "Target: " + targetName(o) : "",
      "Transmitter: " + siteName(o),
      o.from || o.to ? `Valid: ${o.from ? o.from.slice(0, 2) + " " + MONTHS[+o.from.slice(2) - 1] : "…"} to ${o.to ? o.to.slice(0, 2) + " " + MONTHS[+o.to.slice(2) - 1] : "…"}` : "",
      o.heard ? `Last logged: ${MONTHS[+o.heard.slice(0, 2) - 1] || "?"} 20${o.heard.slice(2)}` : "",
      "Tunes in " + o.mode + (isDecoderMode(o.mode) ? (o.mode === "CW" ? " (starts the CW decoder)" : " (starts the decoder)") : ""),
      inRange(o) ? "" : "Outside this receiver's range: opens the receiver that covers it, if any",
    ];
    return parts.filter(Boolean).join("\n");
  }

  // ── position & dragging ───────────────────────────────────────────────
  let win;
  let drag = null;
  // Viewport → the window's absolute coordinates (its offset parent, or the
  // page when that is a static <body>).
  function origin() {
    const op = win && win.offsetParent;
    if (!op || (op === document.body && getComputedStyle(op).position === "static")) {
      return { left: -window.scrollX, top: -window.scrollY };
    }
    const r = op.getBoundingClientRect();
    return { left: r.left + op.clientLeft, top: r.top + op.clientTop };
  }
  // Viewport position, kept on screen horizontally.
  function setViewportPos(vx, vy) {
    const w = win ? win.offsetWidth : 600;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, vx));
    const o = origin();
    pos = { x: x - o.left, y: vy - o.top };
  }
  // Under the EiBi button, left edges aligned; above it when there is no room below.
  // Centred on the visible screen when it opens (his call, 2026-11-10); a
  // window taller than the screen starts 8 px from the top.
  function place() {
    if (!win) return;
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    setViewportPos((window.innerWidth - w) / 2, Math.max(8, (window.innerHeight - h) / 2));
  }
  function dragStart(e) {
    if (e.button !== 0 || e.target.closest("button")) return;
    const r = win.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    window.addEventListener("pointermove", dragMove);
    window.addEventListener("pointerup", dragEnd, { once: true });
    e.preventDefault();
  }
  function dragMove(e) {
    if (!drag) return;
    dragged = true;
    setViewportPos(e.clientX - drag.dx, Math.max(0, e.clientY - drag.dy));
  }
  function dragEnd() {
    drag = null;
    window.removeEventListener("pointermove", dragMove);
  }
  onDestroy(() => window.removeEventListener("pointermove", dragMove));
  function onKey(e) {
    if (e.key === "Escape") dispatch("close");
  }
  // A click anywhere outside the window closes it. The EiBi button itself
  // (data-eibi-toggle) is left out, or its own click would open it again.
  function onOutside(e) {
    if (!win || drag) return;
    const t = e.target;
    if (win.contains(t)) return;
    if (t && t.closest && t.closest("[data-eibi-toggle]")) return;
    dispatch("close");
  }

  onMount(() => {
    place();
    load();
  });
</script>

<svelte:window on:keydown={onKey} on:pointerdown|capture={onOutside} />

<div
  bind:this={win}
  class="sws decoder-window popup-panel absolute rounded-lg flex flex-col text-white shadow-2xl"
  style={pos ? `left:${pos.x}px; top:${pos.y}px;` : "left:0; top:0; visibility:hidden;"}
  role="dialog"
  aria-label="EiBi Schedule"
>
  <!-- Title bar: drag handle -->
  <div class="sws-title flex items-center justify-between gap-2 px-4 pt-3 pb-2 cursor-move select-none" on:pointerdown={dragStart}>
    <h2 class="text-base font-bold">EiBi Schedule</h2>
    <span class="text-[11px] text-gray-400 truncate">
      {#if data}EiBi {data.season} · {data.file_date} · {utcText} UTC{:else}EiBi{/if}
    </span>
    <button class="text-gray-400 hover:text-white shrink-0" title="Close (Esc)" on:click={() => dispatch("close")}>
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  </div>

  {#if error}
    <p class="px-4 pb-4 text-sm text-amber-300">{error}</p>
  {:else if !data}
    <p class="px-4 pb-4 text-sm text-gray-300">Loading the schedule…</p>
  {:else}
    <!-- Filters -->
    <div class="sws-filters grid gap-x-3 gap-y-1.5 px-4 text-xs">
      <label>Station
        <input class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" list="sws-stations" placeholder="Any" bind:value={f.station} />
        <datalist id="sws-stations">
          {#each stationNames as n}<option value={n}></option>{/each}
        </datalist>
      </label>
      <label>Language
        <select class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" bind:value={f.lang}>
          <option value="">Any</option>
          {#each langOpts as [c, n]}<option value={c}>{n}</option>{/each}
        </select>
      </label>
      <label>Target area
        <select class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" bind:value={f.target}>
          <option value="">Any</option>
          {#each targetOpts as [c, n]}<option value={c}>{n}</option>{/each}
        </select>
      </label>
      <label>Band
        <select class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" bind:value={f.band}>
          {#each BANDS as b}<option value={b.key}>{b.label}</option>{/each}
        </select>
      </label>
      <label>Station country
        <select class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" bind:value={f.country}>
          <option value="">Any</option>
          {#each countryOpts as [c, n]}<option value={c}>{n}</option>{/each}
        </select>
      </label>
      <label>Transmitter in
        <select class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" bind:value={f.site}>
          <option value="">Any</option>
          {#each siteOpts as [c, n]}<option value={c}>{n}</option>{/each}
        </select>
      </label>
      <label>Frequency (kHz, ±2)
        <span class="flex gap-1">
          <input class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" inputmode="decimal" placeholder="Any" bind:value={f.khz} />
          <button class="sws-btn" title="Fill in the dial frequency" on:click={() => (f.khz = String(Math.round(dialKhz * 10) / 10))}>dial</button>
        </span>
      </label>
      <div>Time (UTC)
        <span class="flex items-center gap-1 flex-wrap">
          <select class="glass-select text-white text-xs px-2 py-1 rounded-md" bind:value={f.time}>
            <option value="any">Any time</option>
            <option value="now">On air now</option>
            <option value="at">On air at</option>
          </select>
          {#if f.time === "at"}
            <input class="glass-select text-white text-xs px-1 py-1 rounded-md w-10 text-center" inputmode="numeric" maxlength="2" placeholder="hh" bind:value={f.hh} />:
            <input class="glass-select text-white text-xs px-1 py-1 rounded-md w-10 text-center" inputmode="numeric" maxlength="2" placeholder="mm" bind:value={f.mm} />
            <button class="sws-btn" title="Current UTC time" on:click={useNowTime}>now</button>
          {/if}
        </span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-xs">
      <label class="inline-flex items-center gap-1 cursor-pointer" title="Hide broadcasts not scheduled for today's UTC weekday or date">
        <input type="checkbox" bind:checked={f.today} /> Today only
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer" title="Hide frequencies this receiver does not cover">
        <input type="checkbox" bind:checked={f.receivable} /> Receivable here
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer" title="Show the results as green markers on the waterfall. They stay after the window closes; untick to remove them.">
        <input type="checkbox" bind:checked={f.onWf} /> Show on waterfall
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer" title="Hide the yellow markers from the HFCC schedule. Your own markers and the decoder markers stay. Kept after the window closes.">
        <input type="checkbox" checked={hfccHidden} on:change={(e) => dispatch("hidehfcc", e.currentTarget.checked)} /> Hide HFCC markers
      </label>
      <button class="sws-btn ml-auto" on:click={reset}>Reset</button>
    </div>

    <!-- Results -->
    <div class="sws-table mx-4 mt-2 overflow-auto rounded-md" bind:this={tableEl} on:scroll={onTableScroll}>
      <table class="w-full text-xs">
        <thead>
          <tr>
            {#each [["khz", "kHz"], ["mode", "Mode"], ["start", "Start"], ["end", "End"], ["station", "Station"], ["site", "Transmitter site"], ["lang", "Language"], ["target", "Target"]] as [k, t]}
              <th on:click={() => sortBy(k)} class:sorted={f.sort === k}>{t}{f.sort === k ? (f.desc ? " ▾" : " ▴") : ""}</th>
            {/each}
            <th>Days</th>
          </tr>
        </thead>
        <tbody>
          {#each shown as o}
            <tr
              class:live={o.live}
              class:picked={pickedKey && rowKey(o) === pickedKey}
              class:out={!inRange(o)}
              title={tip(o)}
              on:click={() => tune(o)}
            >
              <td class="text-right font-mono">{o.khz}</td>
              <td class="sws-mode" class:dec={isDecoderMode(o.mode)}>{o.mode}</td>
              <td class="font-mono">{hhmm(o.start)}</td>
              <td class="font-mono">{hhmm(o.end)}</td>
              <td class="sws-station">{o.station}</td>
              <td class="sws-site"><span class="sws-flag">{@html flagHtml(o.host)}</span> {siteName(o)}</td>
              <td class="sws-short">{langName(o)}</td>
              <td class="sws-short">{targetName(o)}</td>
              <td>{daysText(o.days)}</td>
            </tr>
          {/each}
          {#if shown.length === 0}
            <tr><td colspan="9" class="text-center text-gray-400 py-3">Nothing matches. Widen the filters (or untick “Today only”).</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap justify-between gap-2 px-4 pt-1.5 pb-3 text-[11px] text-gray-400">
      <span>
        {total} result{total === 1 ? "" : "s"}{total > shown.length ? ` (${shown.length} shown, scroll for more)` : ""} ·
        <span class="text-green-400">{onAirCount} on air now</span> · click a row to tune
      </span>
      <span>Data: <a class="underline" href="http://www.eibispace.de/dx/" target="_blank" rel="noopener">EiBi</a></span>
    </div>
  {/if}
</div>

<style>
  /* As wide as its content, never wider than the screen. */
  .sws {
    /* .decoder-window (App.svelte, global) sets position: relative, which
       would keep the window in the page flow and leave an empty area of its
       size at the top of the page. This scoped rule outranks it. */
    position: absolute;
    /* Above the waterfall's passband overlay and dial line (z-[9999] in
       App.svelte), which otherwise show through the window. */
    z-index: 10050;
    width: max-content;
    max-width: calc(100vw - 16px);
  }
  /* The results table sets the window width; the filters only fill it
     (width 0 + min-width 100% keeps them out of the max-content sum). */
  .sws-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    width: 0;
    min-width: 100%;
    box-sizing: border-box;
  }
  @media (max-width: 760px) {
    .sws-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  .sws-table {
    scrollbar-width: thin;
    scrollbar-color: #475569 transparent;
  }
  .sws-filters label,
  .sws-filters > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #cbd5e1;
  }
  .sws-btn {
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(51, 65, 85, 0.85);
    color: rgb(0, 225, 255);
    font-size: 11px;
    white-space: nowrap;
  }
  .sws-btn:hover { background: rgba(14, 116, 144, 0.9); }
  .sws-table {
    max-height: min(52vh, 520px);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(148, 163, 184, 0.25);
  }
  .sws-table thead th {
    position: sticky;
    top: 0;
    background: #1e293b;
    color: #e2e8f0;
    text-align: left;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }
  .sws-table thead th.sorted { color: rgb(0, 225, 255); }
  .sws-table td {
    padding: 3px 6px;
    border-top: 1px solid rgba(148, 163, 184, 0.12);
    white-space: nowrap;
    color: #9ca3af;
  }
  .sws-table tbody tr { cursor: pointer; }
  .sws-table tbody tr:hover td { background: rgba(14, 116, 144, 0.35); color: #fff; }
  .sws-table tr.live td { color: #4ade80; }
  .sws-table tr.live td.sws-station { font-weight: 600; }
  /* The station being listened to (as the red waterfall marker). */
  .sws-table tr.picked td { color: #f87171; }
  .sws-table tr.picked td.sws-station { font-weight: 600; }
  .sws-table tr.out td { opacity: 0.45; }
  .sws-table td.sws-mode { font-family: ui-monospace, monospace; }
  .sws-table td.sws-mode.dec { color: #fbbf24; }
  .sws-station { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
  .sws-site { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
  .sws-short { max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
</style>
