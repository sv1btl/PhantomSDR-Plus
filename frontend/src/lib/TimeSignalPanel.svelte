<script>
  // Time Signals panel inside SERVICES (DCF77, MSF, RWM, WWV/WWVH).
  // The decoding is timesig.js in services.worker.js; App.svelte switches it on.
  import { onMount, onDestroy } from "svelte";
  import { TIME_STATIONS } from "../timesig.js";
  import { locatorToLatLon } from "./aprsMap.js";

  export let audio;
  export let dialKhz = 0;
  /** Called with (carrier kHz, station key) when Tune is clicked. */
  export let onTune = () => {};
  /** Called with the station key when the station list changes. */
  export let onStation = () => {};
  export let station = "dcf77";
  /** The station's QTH locator: its time zone is worked out from it. */
  export let homeLocator = "";

  // The station's time zone, from its locator: tz-lookup (CC0, offline) gives
  // the IANA zone for the square's centre; it is loaded only when this panel
  // opens. "" when there is no usable locator.
  let stationZone = "";
  $: _zoneFor(homeLocator);
  async function _zoneFor(loc) {
    const p = locatorToLatLon(loc);
    if (!p) { stationZone = ""; return; }
    try {
      const { default: tzlookup } = await import("./tzLookup.js");
      stationZone = tzlookup(p.lat, p.lon) || "";
    } catch (e) {
      console.warn("[TIME] time zone lookup failed", e);
      stationZone = "";
    }
  }

  // Decoded UTC in the station's own time zone; the browser applies summer
  // and winter time for that zone.
  $: stationFmt = (() => {
    if (!stationZone) return null;
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: stationZone, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" });
    } catch (e) { return null; }
  })();
  $: stationDateFmt = stationZone ? new Intl.DateTimeFormat("en-GB", { timeZone: stationZone, weekday: "short", day: "2-digit", month: "short" }) : null;
  const stationTime = (ms) => (stationFmt && Number.isFinite(ms) ? stationFmt.format(new Date(ms)) : "");
  const stationDate = (ms) => (stationDateFmt && Number.isFinite(ms) ? stationDateFmt.format(new Date(ms)) : "");

  // The carrier sits 1 kHz above the USB dial.
  const OFFSET_KHZ = 1.0;
  const MAX_ROWS = 120;

  let selectedFreq = "";
  let status = "Waiting for the signal…";
  let metrics = null;
  let last = null;
  let rows = [];
  let nextId = 1;

  $: st = TIME_STATIONS.find((s) => s.key === station) || TIME_STATIONS[0];
  $: if (st && !st.khz.some((f) => String(f) === selectedFreq)) selectedFreq = String(_closest(st.khz, Number(dialKhz) + OFFSET_KHZ));
  $: carrierKhz = Number(dialKhz) + OFFSET_KHZ;
  $: onFreq = st.khz.some((f) => Math.abs(f - carrierKhz) < 0.05);

  function _closest(list, khz) {
    return [...list].sort((a, b) => Math.abs(a - khz) - Math.abs(b - khz))[0];
  }

  function stationChanged(e) {
    const key = e.currentTarget.value;
    last = null;
    metrics = null;
    onStation(key);
  }

  function tune() {
    const khz = Number(selectedFreq);
    if (khz > 0) onTune(khz, station);
  }

  const fmtOffset = (ms) => `${ms >= 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toFixed(2)} s`;

  function onEvent(e) {
    if (!e || (e.service && e.service !== "time")) return;
    if (e.type === "status") status = e.text;
    else if (e.type === "metrics") metrics = e;
    else if (e.type === "message" && e.msg) {
      last = e.msg;
      rows = [...rows, { ...e.msg, id: nextId++, freq: carrierKhz.toFixed(1) }].slice(-MAX_ROWS);
    } else if (e.type === "error") status = "Decoder error: " + e.message;
  }

  function clear() { rows = []; last = null; }

  function save() {
    const lines = rows.map((r) => [r.received + " (page clock)", r.station.toUpperCase(), r.freq + " kHz",
      r.timingOnly ? r.text : `${r.utc} UTC${r.date ? " " + r.date : ""}${r.local ? " (" + r.local + ")" : ""}`,
      r.dut1 != null ? `DUT1 ${r.dut1 >= 0 ? "+" : ""}${r.dut1} s` : "",
      stationFmt && r.utcMs ? `station time ${stationTime(r.utcMs)}` : "",
      `arrived ${fmtOffset(r.offsetMs)}`, ...(r.flags || [])].filter(Boolean).join(" | "));
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timesignals-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  onMount(() => { if (audio && audio.setServicesCallback) audio.setServicesCallback(onEvent); });
  onDestroy(() => { if (audio && audio.setServicesCallback && audio.servicesCallback === onEvent) audio.setServicesCallback(null); });

  const cellClass = (b, i, sec) =>
    i === sec ? "bg-sky-400" : b === 1 ? "bg-green-400" : b === 0 ? "bg-green-900" : b === 2 ? "bg-amber-400" : "bg-gray-700";
</script>

<div class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel">
  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
      <span class="inline-block w-2 h-2 rounded-full {last ? 'bg-green-400' : 'bg-sky-400'} animate-pulse"></span>
      <slot name="service" />
      Time Signals
      <span class="text-xs text-gray-500 italic font-normal">{status}</span>
    </h4>
    <div class="flex items-center gap-1">
      <button title="Save the decoded minutes (text)"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={save} disabled={rows.length === 0}>💾 Save</button>
      <button title="Clear"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={clear}>Clear</button>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 mb-2">
    <select value={station} on:change={stationChanged} title="Time-signal station"
      class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0">
      {#each TIME_STATIONS as s}
        <option value={s.key} title={s.note}>{s.label}</option>
      {/each}
    </select>
    <select bind:value={selectedFreq} title="Carrier frequency (the dial goes 1 kHz below it, USB)"
      class="glass-select text-white text-xs px-2 py-1 rounded-md">
      {#each st.khz as f}
        <option value={String(f)}>{f >= 1000 ? `${(f / 1000).toFixed(3).replace(/\.?0+$/, "")} MHz` : `${f} kHz`}</option>
      {/each}
    </select>
    <button title="Tune the receiver 1 kHz below this carrier in USB and set the IF filter"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune &amp; Set IF</button>
  </div>
  <div class="text-[11px] text-gray-500 mb-2">{st.note}</div>

  <div class="rounded-md bg-gray-900 recess-window p-3 mb-2">
    {#if last}
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {#if last.timingOnly}
          <span class="font-mono text-3xl text-green-300">{last.utc} <span class="text-base text-gray-400">UTC</span></span>
          <span class="text-gray-300 text-sm">minute pulse (RWM sends no date)</span>
        {:else}
          <span class="font-mono text-3xl text-green-300">{last.utc} <span class="text-base text-gray-400">UTC</span></span>
          <span class="text-gray-200 text-sm">{last.weekday || ""} {last.date || ""}</span>
          {#if last.local}<span class="text-gray-400 text-sm" title="The time as the transmitting station sends it (its own civil time)">sent as {last.local}</span>{/if}
        {/if}
      </div>
      {#if stationFmt && last.utcMs}
        <div class="text-sm text-gray-200 mt-1" title="The decoded time in this receiver's own time zone ({stationZone}), found from its QTH locator">
          Station time{homeLocator ? ` (${homeLocator})` : ""}: <span class="font-mono text-green-200">{stationTime(last.utcMs)}</span>
          <span class="text-gray-400">{stationDate(last.utcMs)}</span>
        </div>
      {/if}
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
        <span title="When the minute mark reached this page, against your computer's clock. It includes the WebSDR's own delay (a few tenths of a second) and your computer clock's error.">
          Arrived: <span class="font-mono text-gray-200">{fmtOffset(last.offsetMs)}</span> vs your clock</span>
        {#if last.dut1 != null}<span title="UT1 − UTC">DUT1: <span class="font-mono text-gray-200">{last.dut1 >= 0 ? "+" : ""}{last.dut1} s</span></span>{/if}
        {#if last.details}<span>{last.details}</span>{/if}
        {#each last.flags || [] as f}<span class="text-amber-300">⚠ {f}</span>{/each}
      </div>
    {:else}
      <div class="text-gray-500 italic text-sm">
        Pick a station, click Tune and wait: a full minute has to come in clean before the time can be shown (one to two minutes on a good signal).
      </div>
    {/if}
  </div>

  {#if metrics && !(st.key === "rwm")}
    <div class="flex items-center gap-[2px] mb-1" title="The seconds of the current minute: dark = 0, bright = 1, amber = marker, grey = not read, blue = now">
      {#each Array(60) as _, i}
        <span class="h-3 flex-1 rounded-sm {cellClass(metrics.bits[i], i, metrics.second)}"></span>
      {/each}
    </div>
  {/if}
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
    <span>Carrier: <span class="font-mono text-gray-200">{carrierKhz >= 1000 ? (carrierKhz / 1000).toFixed(4) + " MHz" : carrierKhz.toFixed(1) + " kHz"}</span>
      {#if !onFreq}<span class="text-amber-400"> ⚠ not on {st.label.split(" ·")[0]}</span>{/if}</span>
    {#if metrics}
      <span title="How deep the keying is: carrier on vs off (DCF77 about 16 dB)">Keying depth: <span class="font-mono text-gray-200">{metrics.depthDb} dB</span></span>
      <span>Second: <span class="font-mono text-gray-200">{metrics.second ?? "—"}</span></span>
      <span>Minutes decoded: <span class="font-mono text-gray-200">{metrics.decoded}</span></span>
    {/if}
  </div>

  <div class="rounded-md bg-gray-900 recess-window overflow-y-auto custom-scrollbar text-xs font-mono" style="max-height: 180px;">
    {#each [...rows].reverse() as r (r.id)}
      <div class="px-2 py-1 border-b border-gray-800 text-gray-300">
        <span class="text-gray-500">{r.received}</span>
        <span class="text-sky-300">{r.station.toUpperCase()}</span>
        {#if r.timingOnly}{r.text}{:else}{r.utc} UTC {r.date || ""}{/if}
        {#if stationFmt && r.utcMs}<span class="text-green-200">· {stationTime(r.utcMs)}</span>{/if}
        <span class="text-gray-500">arrived {fmtOffset(r.offsetMs)}</span>
      </div>
    {/each}
  </div>
  <p class="text-[11px] text-gray-500 mt-2 font-sans">
    DCF77 and MSF are read from the carrier's on/off keying, WWV/WWVH from its 100 Hz subcarrier, RWM from its pulses. CHU (Canada) closed on 22 June 2026.
  </p>
</div>
