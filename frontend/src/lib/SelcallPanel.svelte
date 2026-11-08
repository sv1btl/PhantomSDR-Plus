<script>
  // HF Selcall (CCIR 493-4 / Codan) panel inside SERVICES. The decoding is
  // dsc.js in its selcall mode (services.worker.js); the panel is the DSC
  // one with its own channels and wording.
  import { onMount, onDestroy, tick } from "svelte";

  export let audio;
  /** USB dial frequency shown by the receiver, in kHz. */
  export let dialKhz = 0;
  /** Called with a Selcall channel in kHz (the FSK centre, not the dial). */
  export let onTune = () => {};

  // The FSK centre sits 1.7 kHz above the USB dial.
  const OFFSET_KHZ = 1.7;
  const MAX_ROWS = 300;

  // Channels from KiwiSDR's FSK frequency menus (FSK_freq_menus.cjson,
  // "Selcall 7 MHz" / "8 MHz"), given there as a dial with the tones centred
  // 500 Hz above it; listed here as the FSK centre.
  const centre = (f) => Math.round((f + 0.5) * 100) / 100;
  const DSC_FREQS = [
    { group: "7 MHz channels", list: [7104.78, 7107.78, 7110.78, 7116.78, 7122.78, 7131.78, 7134.78, 7137.78, 7140.78, 7143.78, 7149.78, 7152.78, 7158.78, 7161.78, 7173.78].map(centre) },
    { group: "8 MHz channels", list: [7910.78, 7919.78, 7922.78, 7934.78, 8004.78, 8007.78, 8010.78, 8013.78, 8016.78, 8019.78, 8022.78, 8025.78, 8028.78, 8031.78, 8034.78, 8067.78, 8070.78, 8073.78, 8076.78, 8079.78, 8085.78, 8091.78].map(centre) },
  ];
  const ALL = DSC_FREQS.flatMap((g) => g.list);

  let selectedFreq = String(_nearest(Number(dialKhz) + OFFSET_KHZ) ?? DSC_FREQS[0].list[0]);
  let status = "Waiting for a call…";
  let snrDb = null;
  let offsetHz = 0;
  let receiving = false;
  let calls = [];
  let nextId = 1;
  let scrollEl;
  let followTail = true;

  $: carrierKhz = Number(dialKhz) + OFFSET_KHZ;
  $: onDscFreq = ALL.some((f) => Math.abs(f - carrierKhz) < 0.05);

  function _nearest(khz) {
    const exact = ALL.find((f) => Math.abs(f - khz) < 0.05);
    return exact ?? null;
  }

  function tune() {
    const khz = Number(selectedFreq);
    if (khz > 0) onTune(khz);
  }

  const catClass = (m) =>
    m.format === 112 || m.category === 112 ? "text-red-400"
      : m.category === 110 ? "text-orange-400"
      : m.category === 108 ? "text-yellow-300"
      : "text-sky-300";

  const catText = (m) =>
    m.format === 112 || m.category === 112 ? "EMERGENCY"
      : m.category === 110 ? "URGENCY"
      : m.category === 108 ? "SAFETY"
      : "ROUTINE";

  function mapUrl(p) {
    return `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(4)}&mlon=${p.lon.toFixed(4)}#map=6/${p.lat.toFixed(3)}/${p.lon.toFixed(3)}`;
  }

  function onEvent(e) {
    if (!e || (e.service && e.service !== "selcall")) return;
    if (e.type === "status") status = e.text;
    else if (e.type === "metrics") {
      snrDb = e.snrDb;
      offsetHz = e.offsetHz;
      receiving = e.receiving;
    } else if (e.type === "message" && e.msg) {
      const m = e.msg;
      calls = [...calls, { ...m, id: nextId++, freqKhz: carrierKhz.toFixed(1) }].slice(-MAX_ROWS);
      if (followTail) tick().then(() => { if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight; });
    } else if (e.type === "error") {
      status = "Decoder error: " + e.message;
    }
  }

  function onScroll() {
    if (!scrollEl) return;
    followTail = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 20;
  }

  function clear() {
    calls = [];
  }

  function save() {
    const lines = calls.map((m) =>
      [m.time + " UTC", m.freqKhz + " kHz", m.formatText, catText(m),
        ...m.fields.map((f) => f.join(": ")),
        ].join(" | "));
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `selcall-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  onMount(() => {
    if (audio && audio.setServicesCallback) audio.setServicesCallback(onEvent);
  });
  onDestroy(() => {
    if (audio && audio.setServicesCallback && audio.servicesCallback === onEvent) audio.setServicesCallback(null);
  });
</script>

<div class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel">
  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
      <span class="inline-block w-2 h-2 rounded-full {receiving ? 'bg-green-400 animate-pulse' : 'bg-sky-400 animate-pulse'}"></span>
      <slot name="service" />
      HF Selcall
      <span class="text-xs {receiving ? 'text-green-300 font-mono' : 'text-gray-500 italic'} font-normal">{receiving ? "[call in progress]" : status}</span>
    </h4>
    <div class="flex items-center gap-1">
      <button
        title="Save the decoded Selcall calls (text)"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={save}
        disabled={calls.length === 0}>💾 Save</button
      >
      <button
        title="Clear the Selcall calls"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={clear}>Clear</button
      >
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 mb-2">
    <select
      bind:value={selectedFreq}
      title="Selcall channel (kHz, FSK centre). The dial goes 1.7 kHz below it, in USB."
      class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0"
    >
      {#each DSC_FREQS as g}
        <optgroup label={g.group}>
          {#each g.list as f}
            <option value={String(f)}>{f.toFixed(1)} kHz</option>
          {/each}
        </optgroup>
      {/each}
    </select>
    <button
      title="Tune the receiver to this Selcall channel (dial 1.7 kHz below, USB) and set the IF filter"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune &amp; Set IF</button
    >
  </div>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
    <span title="The FSK centre you are on (the USB dial plus 1.7 kHz)">
      Channel: <span class="font-mono text-gray-200">{carrierKhz.toFixed(2)} kHz</span>
      {#if !onDscFreq}
        <span class="text-amber-400" title="Not a listed Selcall channel"> ⚠ not a listed channel</span>
      {/if}
    </span>
    {#if snrDb !== null}
      <span title="Signal-to-noise of the FSK, measured on the bits">S/N: <span class="font-mono text-gray-200">{snrDb.toFixed(1)} dB</span></span>
    {/if}
    <span title="How far the two tones sit from where they should be (tuning error)">Offset: <span class="font-mono text-gray-200">{offsetHz > 0 ? "+" : ""}{offsetHz} Hz</span></span>
    <span>Calls: <span class="font-mono text-gray-200">{calls.length}</span></span>
  </div>

  <div
    bind:this={scrollEl}
    on:scroll={onScroll}
    class="rounded-md bg-gray-900 recess-window overflow-y-auto custom-scrollbar text-xs font-mono"
    style="height: 320px;"
  >
    {#if calls.length === 0}
      <div class="p-3 text-gray-500 italic font-sans">
        Pick a channel, click Tune and wait. Selcall is used by HF land-mobile and maritime networks (Codan, Barrett and others); calls are short bursts of a second or two, and the calling station's and the called station's numbers (4 or 6 digits) are shown.
      </div>
    {/if}
    {#each calls as m (m.id)}
      <div class="px-2 py-1.5 border-b border-gray-800">
        <div class="flex flex-wrap items-center gap-x-2">
          <span class="text-gray-500">{m.time}</span>
          <span class="text-gray-400">{m.freqKhz}</span>
          <span class="font-semibold {catClass(m)}">{catText(m)}</span>
          <span class="text-teal-300">{m.formatText}</span>
          {#if m.errors}
            <span class="text-amber-400" title="Characters lost in both copies">{m.errors} unread</span>
          {/if}
          {#if m.pos}
            <a href={mapUrl(m.pos)} target="_blank" rel="noopener noreferrer" class="text-green-300 underline"
              title="Show the position on a map">📍 {m.pos.text}</a>
          {/if}
        </div>
        <div class="text-gray-100 mt-0.5 font-sans">
          {#each m.fields as f, i}{#if i}<span class="text-gray-600"> · </span>{/if}<span class="text-gray-400">{f[0]}:</span> {f[1]}{/each}
        </div>
      </div>
    {/each}
  </div>
  <p class="text-[11px] text-gray-500 mt-2 font-sans">
    CCIR 493-4 Selcall: 100 Bd, 170 Hz shift, the same characters as DSC, each sent twice. Either tone polarity is read (stations differ). Channel list from KiwiSDR's FSK menus.
  </p>
</div>
