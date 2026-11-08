<script>
  // DSC (Digital Selective Calling, MF/HF) panel inside SERVICES.
  // The decoding is dsc.js in services.worker.js, switched on by App.svelte;
  // this panel receives the calls and lays them out.
  import { onMount, onDestroy, tick } from "svelte";

  export let audio;
  /** USB dial frequency shown by the receiver, in kHz. */
  export let dialKhz = 0;
  /** Called with a DSC frequency in kHz (the carrier, not the dial). */
  export let onTune = () => {};

  // The DSC carrier sits 1.7 kHz above the USB dial.
  const OFFSET_KHZ = 1.7;
  const MAX_ROWS = 300;

  const DSC_FREQS = [
    { group: "Distress & safety (watched by every coast station)", list: [2187.5, 4207.5, 6312.0, 8414.5, 12577.0, 16804.5] },
    { group: "Coast → ship calling", list: [2177.0, 4219.5, 6331.0, 8436.5, 12657.0, 16903.0, 19703.5, 22444.0, 26121.0] },
    { group: "Ship → coast calling", list: [2189.5, 4208.0, 6312.5, 8415.0, 12577.5, 16805.0, 18898.5, 22374.5, 25208.5] },
  ];
  const ALL = DSC_FREQS.flatMap((g) => g.list);

  let selectedFreq = String(_nearest(Number(dialKhz) + OFFSET_KHZ) ?? 8414.5);
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
    m.format === 112 ? "DISTRESS"
      : m.category === 112 ? "DISTRESS"
      : m.category === 110 ? "URGENCY"
      : m.category === 108 ? "SAFETY"
      : "ROUTINE";

  function mapUrl(p) {
    return `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(4)}&mlon=${p.lon.toFixed(4)}#map=6/${p.lat.toFixed(3)}/${p.lon.toFixed(3)}`;
  }

  function onEvent(e) {
    if (!e || (e.service && e.service !== "dsc")) return;
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
        m.eccOk === true ? "ECC ok" : m.recovered ? "1 character rebuilt from ECC" : m.eccOk === false ? "ECC error" : "ECC not checked"].join(" | "));
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dsc-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
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
      DSC Receiver
      <span class="text-xs {receiving ? 'text-green-300 font-mono' : 'text-gray-500 italic'} font-normal">{receiving ? "[call in progress]" : status}</span>
    </h4>
    <div class="flex items-center gap-1">
      <button
        title="Save the decoded DSC calls (text)"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={save}
        disabled={calls.length === 0}>💾 Save</button
      >
      <button
        title="Clear the DSC calls"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={clear}>Clear</button
      >
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 mb-2">
    <select
      bind:value={selectedFreq}
      title="DSC frequency (kHz). The dial goes 1.7 kHz below it, in USB."
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
      title="Tune the receiver to this DSC frequency (dial 1.7 kHz below, USB) and set the IF filter"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune &amp; Set IF</button
    >
  </div>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
    <span title="The DSC frequency you are on (the USB dial plus 1.7 kHz)">
      DSC: <span class="font-mono text-gray-200">{carrierKhz.toFixed(1)} kHz</span>
      {#if !onDscFreq}
        <span class="text-amber-400" title="Not a DSC frequency: pick one and Tune"> ⚠ off DSC frequency</span>
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
        Pick a frequency, click Tune and wait. Coast stations answer and test on the distress &amp; safety channels many times an hour; 8414.5 and 12577 kHz are usually the busiest by day, 2187.5 and 4207.5 kHz at night.
      </div>
    {/if}
    {#each calls as m (m.id)}
      <div class="px-2 py-1.5 border-b border-gray-800">
        <div class="flex flex-wrap items-center gap-x-2">
          <span class="text-gray-500">{m.time}</span>
          <span class="text-gray-400">{m.freqKhz}</span>
          <span class="font-semibold {catClass(m)}">{catText(m)}</span>
          <span class="text-teal-300">{m.formatText}</span>
          {#if m.eccOk === true}
            <span class="text-green-500" title="Error-check character agrees">✓</span>
          {:else if m.recovered}
            <span class="text-sky-300" title="One character was lost in both copies and rebuilt from the error-check character">✓ (1 rebuilt)</span>
          {:else if m.eccOk === false}
            <span class="text-amber-400" title="Error-check character disagrees: some characters may be wrong">ECC ✗</span>
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
    MF/HF DSC (ITU-R M.493): 100 Bd, 170 Hz shift, tones at 1615 / 1785 Hz in USB. Each character is sent twice; the decoder keeps the copy that passes its check bits.
  </p>
</div>
