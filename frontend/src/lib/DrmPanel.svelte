<script>
  // DRM (Digital Radio Mondiale) panel. The decoding runs on the server, in
  // autorun/drm-helper.js (one ubersdr-drm per listener, the UberSDR model);
  // App.svelte switches it on, this panel shows its status and offers the
  // DRM broadcast schedule as a station selector.
  import { onMount, onDestroy } from "svelte";
  import { DRM_SCHEDULE_SNAPSHOT, scheduleRows, daysText,
           gridToLatLon, slotRemoteness, NEAR_KM } from "./drmSchedule.js";

  export let audio;
  /** Dial frequency (kHz) — in DRM the dial is the centre of the channel. */
  export let dialKhz = 0;
  /** Called with a DRM frequency in kHz when Tune is clicked. */
  export let onTune = () => {};

  let state = "connecting"; // connecting | ready | error | closed
  let errorText = "";
  let st = null;            // last status line from ubersdr-drm
  let schedule = DRM_SCHEDULE_SNAPSHOT;
  let scheduleLive = false;
  let now = new Date();
  let selected = "";
  // Only broadcasts confirmed on air by listeners, registered with HFCC by
  // the broadcaster or decoded on this receiver (heard); the rest of
  // drmrx.org's list behind a tick box.
  let confirmedOnly = true;
  let gotReady = false;     // the helper accepted the session at least once

  // Only what this receiver can tune: ±5 kHz around the centre must fit.
  $: minKhz = audio && audio.baseFreq ? audio.baseFreq / 1000 + 5 : 0;
  $: maxKhz = audio && audio.totalBandwidth ? (audio.baseFreq + audio.totalBandwidth) / 1000 - 5 : Infinity;
  $: allRows = scheduleRows(schedule, now, minKhz, maxKhz);
  $: rows = confirmedOnly ? allRows.filter((r) => r.verified || r.registered || r.heard) : allRows;
  // On-air broadcasts ranked by this station's grid locator: the ones aimed
  // at it first, the rest nearest first. No locator: one list, as scheduled.
  $: locator = audio && audio.grid_locator && audio.grid_locator !== "-" ? audio.grid_locator : "";
  $: qth = gridToLatLon(locator);
  $: swOnAir = rows.filter((r) => r.onAir && r.region !== "MW")
    .map((r) => ({ ...r, far: slotRemoteness(r, qth) }))
    .sort((a, b) => a.far - b.far || a.khz - b.khz);
  // Heard here but listed nowhere (no target to rank by): a group of its own.
  $: heardNow = swOnAir.filter((r) => r.heardOnly);
  $: nearNow = qth ? swOnAir.filter((r) => !r.heardOnly && r.far <= NEAR_KM) : [];
  $: swNow = swOnAir.filter((r) => !r.heardOnly && !(qth && r.far <= NEAR_KM));
  $: swLater = rows.filter((r) => !r.onAir && r.region !== "MW" && r.wait < 1440);
  $: mw = rows.filter((r) => r.region === "MW");
  $: onSchedule = rows.filter((r) => r.onAir && Math.abs(r.khz - Number(dialKhz)) < 0.5);

  const LAMPS = [
    ["acq", "Signal"],
    ["tsync", "Time"],
    ["fsync", "Frame"],
    ["fac", "FAC"],
    ["sdc", "SDC"],
    ["audio", "Audio"],
  ];
  // ubersdr-drm: 0 not present, 1 CRC error, 2 data error, 3 OK. acq is 0/1.
  function lampClass(key, v) {
    if (key === "acq") return v ? "lamp-ok" : "lamp-off";
    return ["lamp-off", "lamp-bad", "lamp-warn", "lamp-ok"][v] || "lamp-off";
  }
  function lampTitle(key, v) {
    if (key === "acq") return v ? "DRM signal acquired" : "No DRM signal";
    return ["not present", "CRC error", "data error", "OK"][v] || "";
  }

  $: decoding = st && st.audio === 3;
  $: headline = state === "error" ? "helper error"
    : state === "connecting" ? "connecting to the decoder…"
    : state === "closed" ? "decoder stopped — silent"
    : !st || !st.acq ? "searching for a DRM signal…"
    : decoding ? "decoding" : "syncing…";

  function fmtWait(min) {
    if (min <= 0) return "on air";
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `in ${h} h ${String(m).padStart(2, "0")} m` : `in ${m} m`;
  }
  const label = (r) =>
    `${r.khz} kHz · ${r.station} · ${r.start}–${r.end} UTC` +
    (r.days && r.days !== "1111111" ? ` (${daysText(r.days)})` : "") +
    (r.target ? ` → ${r.target}` : "") +
    (r.verified ? " ✓" : "") + (r.registered ? " · HFCC" : "") + (r.heard ? " · heard here" : "");
  const keyOf = (r) => `${r.khz}|${r.station}|${r.start}`;

  function tune() {
    const khz = Number(String(selected).split("|")[0]);
    if (khz > 0) onTune(khz);
  }

  async function loadSchedule() {
    try {
      const res = await fetch(audio.drmHelperHttp() + "/schedule", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const list = await res.json();
      if (Array.isArray(list) && list.length) { schedule = list; scheduleLive = true; }
    } catch (e) {
      scheduleLive = false;   // keep the bundled snapshot
    }
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === "connected") { state = "connecting"; errorText = ""; }
    else if (ev.type === "ready") { state = "ready"; gotReady = true; }
    else if (ev.type === "status") { state = "ready"; gotReady = true; st = ev; }
    else if (ev.type === "error") { state = "error"; errorText = ev.msg || ""; }
    else if (ev.type === "closed") {
      if (state === "error") return;
      if (!gotReady) {
        // Closed before it ever answered: the helper is not there.
        state = "error";
        errorText = "The DRM decoder on the server cannot be reached right now — the receiver stays silent while DRM is on.";
      } else {
        state = "closed";
      }
    }
  }

  let clock;
  onMount(() => {
    if (audio && typeof audio.setDRMCallback === "function") audio.setDRMCallback(onEvent);
    loadSchedule();
    clock = setInterval(() => (now = new Date()), 30000);
  });
  onDestroy(() => {
    clearInterval(clock);
    if (audio && typeof audio.setDRMCallback === "function") audio.setDRMCallback(null);
  });

  // Pre-select what the dial is on, else the first service on air.
  $: if (!selected && rows.length) {
    const here = rows.find((r) => Math.abs(r.khz - Number(dialKhz)) < 0.5);
    const pick = here || nearNow[0] || swNow[0] || swLater[0] || rows[0];
    if (pick) selected = keyOf(pick);
  }
</script>

<div class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
      <span class="inline-block w-2 h-2 rounded-full {state === 'error' ? 'bg-red-500' : decoding ? 'bg-green-400' : 'bg-sky-400 animate-pulse'}"></span>
      DRM Receiver
      <span class="text-xs font-normal {state === 'error' ? 'text-red-400' : decoding ? 'text-green-300' : 'text-gray-500 italic'}"
        title={errorText}>{headline}</span>
    </h4>
    <span class="text-xs text-gray-500" title="Dial = centre of the DRM channel">
      Dial: <span class="font-mono text-gray-200">{Number(dialKhz).toFixed(1)} kHz</span>
      {#if onSchedule.length}<span class="text-green-300"> · {onSchedule[0].station} on air</span>{/if}
    </span>
  </div>

  {#if state === "error" && errorText}
    <div class="text-xs text-red-400 mb-2">{errorText}</div>
  {/if}

  <!-- Station selector from the DRM schedule -->
  <div class="flex flex-wrap items-center gap-2 mb-1">
    <select
      bind:value={selected}
      title="DRM broadcasts this receiver can tune (UTC), from the DRM Reception Project schedule"
      class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0 w-0"
    >
      {#if heardNow.length}
        <optgroup label="Heard on this receiver — on air now, in no schedule">
          {#each heardNow as r}<option value={keyOf(r)}>{label(r)}</option>{/each}
        </optgroup>
      {/if}
      {#if nearNow.length}
        <optgroup label="Beamed at this station ({locator}) — on air now">
          {#each nearNow as r}<option value={keyOf(r)}>{label(r)}</option>{/each}
        </optgroup>
      {/if}
      {#if swNow.length}
        <optgroup label={qth ? "On air now — beamed elsewhere, nearest first" : "On air now"}>
          {#each swNow as r}<option value={keyOf(r)}>{label(r)}</option>{/each}
        </optgroup>
      {/if}
      {#if swLater.length}
        <optgroup label="Later (next 24 h)">
          {#each swLater as r}<option value={keyOf(r)}>{label(r)} — {fmtWait(r.wait)}</option>{/each}
        </optgroup>
      {/if}
      {#if mw.length}
        <optgroup label="Medium wave (India, Asia)">
          {#each mw as r}<option value={keyOf(r)}>{label(r)}{r.onAir ? "" : ` — ${fmtWait(r.wait)}`}</option>{/each}
        </optgroup>
      {/if}
    </select>
    <button
      title="Tune the receiver to this DRM channel"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune</button>
  </div>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mb-3">
    <span>
      Schedule: <a href="https://www.drmrx.org/" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-300">DRM Reception Project</a>
      {scheduleLive ? "(live)" : "(saved copy)"} · ✓ confirmed on air by listeners (KiwiSDR) · HFCC registered by the broadcaster · heard here: decoded on this receiver in the last 30 days
    </span>
    <label class="flex items-center gap-1 cursor-pointer" title="Show only broadcasts confirmed on air, registered with HFCC or heard on this receiver">
      <input type="checkbox" bind:checked={confirmedOnly} /> Confirmed only
    </label>
  </div>

  <!-- Sync ladder -->
  <div class="flex flex-wrap items-center gap-3 mb-3">
    {#each LAMPS as [key, name]}
      {@const v = st ? st[key] : 0}
      <span class="flex items-center gap-1 text-xs text-gray-300" title={lampTitle(key, v)}>
        <span class="lamp {lampClass(key, v)}"></span>{name}
      </span>
    {/each}
  </div>

  <!-- Figures -->
  <div class="rounded-md bg-gray-900 recess-window p-3 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mb-3">
    <span title="Weighted MER of the MSC: the figure that predicts whether audio decodes (about 10 dB and up)">WMER <span class="text-gray-100">{st && st.acq ? st.wmer.toFixed(1) + " dB" : "—"}</span></span>
    <span title="Modulation error ratio">MER <span class="text-gray-100">{st && st.acq ? st.mer.toFixed(1) + " dB" : "—"}</span></span>
    <span title="Signal-to-noise ratio">SNR <span class="text-gray-100">{st && st.acq ? st.snr.toFixed(1) + " dB" : "—"}</span></span>
    <span title="Robustness mode (A to E)">Mode <span class="text-gray-100">{st && st.acq ? st.robm : "—"}</span></span>
    <span title="Channel bandwidth as signalled">BW <span class="text-gray-100">{st && st.acq ? st.bandwidth + " kHz" : "—"}</span></span>
    <span title="MSC constellation">QAM <span class="text-gray-100">{st && st.acq ? st.qam : "—"}</span></span>
    <span title="Protection levels A / B">Prot <span class="text-gray-100">{st && st.acq ? `${st.protA} / ${st.protB}` : "—"}</span></span>
    <span title="Audio codec and mode signalled in the SDC">Codec <span class="text-gray-100">{st && st.codec ? `${st.codec}${st.sbr ? "+SBR" : ""}` : "—"}</span></span>
  </div>

  <!-- Service -->
  <div class="rounded-md bg-gray-900 recess-window p-3 mb-2" style="min-height: 4.5rem;">
    {#if st && st.service}
      <div class="text-sm text-yellow-300 font-semibold">{st.service}</div>
      <div class="text-xs text-gray-400">
        {[st.country && st.country.toUpperCase(), st.language, st.audioMode].filter(Boolean).join(" · ")}
      </div>
      {#if st.text}<div class="text-xs text-gray-100 mt-1 break-words">{st.text}</div>{/if}
      {#if st.codec && !st.decoder}
        <div class="text-xs text-amber-400 mt-1">No decoder on the server for {st.codec} — this service stays silent.</div>
      {/if}
    {:else}
      <div class="text-xs text-gray-500 italic font-sans">
        Pick a broadcast and click Tune, or tune the dial to the centre of a DRM channel. The station name and its text messages appear here once the decoder locks.
      </div>
    {/if}
  </div>

  <p class="text-[11px] text-gray-500 font-sans">
    Decoded on the station's server by ubersdr-drm (Dream, GPL) — the same decoder UberSDR uses. The receiver's own audio is muted while DRM plays.
    {#if st && st.dropped}<span class="text-amber-400"> · {st.dropped} samples dropped (server busy)</span>{/if}
  </p>
</div>

<style>
  .lamp {
    display: inline-block; width: 10px; height: 10px; border-radius: 9999px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .lamp-off  { background: #374151; }
  .lamp-bad  { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.7); }
  .lamp-warn { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.7); }
  .lamp-ok   { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.7); }
</style>
