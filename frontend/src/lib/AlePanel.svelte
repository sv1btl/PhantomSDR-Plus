<script>
  // ALE 2G inside the FSK panel: FLDIGI "ALE 2G HAM" (scope "ham", the
  // amateur nets) and SERVICES "ALE 2G" (scope "util", every other net). The
  // decoding is ale.js in the FSK worker (fsk.js); App passes its events to
  // onEvent(). The panel header carries the title, status and Clear.
  import { tick } from "svelte";
  import { ALE_NETS as ALL_NETS } from "./aleNets.js";

  /** "ham" (FLDIGI) or "util" (SERVICES); App remounts the panel on a change. */
  export let scope = "ham";
  const ALE_NETS = ALL_NETS.filter((n) => (n.cat === "Amateur") === (scope === "ham"));
  export let dialKhz = 0;
  /** Called with (kHz, lsb) when Tune is clicked. The dial is the channel. */
  export let onTune = () => {};

  const MAX_ROWS = 300;
  const CAT_LABELS = { Govt: "Government", Milcom: "Military" };
  const CATS = [...new Set(ALE_NETS.map((n) => n.cat))];

  let netIdx = String(_netForDial(dialKhz) ?? 0);
  let selectedFreq = "";
  let words = 0, synced = 0;
  let rows = [];
  let nextId = 1;
  let scrollEl, followTail = true;

  $: net = ALE_NETS[Number(netIdx)] || ALE_NETS[0];
  $: if (net && !net.khz.some((f) => String(f) === selectedFreq)) selectedFreq = String(_closest(net.khz, Number(dialKhz)));
  $: onNetFreq = ALE_NETS.some((n) => n.khz.some((f) => Math.abs(f - Number(dialKhz)) < 0.05));

  function _netForDial(khz) {
    const i = ALE_NETS.findIndex((n) => n.khz.some((f) => Math.abs(f - Number(khz)) < 0.05));
    return i >= 0 ? i : null;
  }
  function _closest(list, khz) {
    return [...list].sort((a, b) => Math.abs(a - khz) - Math.abs(b - khz))[0];
  }

  function tune() {
    const khz = Number(selectedFreq);
    if (khz > 0) onTune(khz, !!net.lsb);
  }

  const same = (a, b) => a && b && a.kind === b.kind && a.from === b.from && a.to === b.to && !a.cmds.length && !b.cmds.length;

  export function onEvent(e) {
    if (!e) return;
    if (e.type === "metrics") { words = e.words; synced = e.synced; }
    else if (e.type === "message" && e.msg) {
      const m = { ...e.msg, freq: Number(dialKhz).toFixed(1) };
      const lastRow = rows[rows.length - 1];
      if (same(lastRow, m) && lastRow.freq === m.freq) {
        lastRow.count = (lastRow.count || 1) + 1;
        lastRow.time = m.time;
        rows = rows;
      } else {
        rows = [...rows, { ...m, id: nextId++, count: 1 }].slice(-MAX_ROWS);
      }
      if (followTail) tick().then(() => { if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight; });
    }
  }

  function onScroll() {
    if (scrollEl) followTail = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 20;
  }

  const kindClass = (k) =>
    k.startsWith("Link") ? "text-green-300" : k.startsWith("Call") ? "text-amber-300" : k.startsWith("Sounding") ? "text-sky-300" : "text-teal-300";

  export function clear() { rows = []; }

  function save() {
    const lines = rows.map((r) => [r.time + " UTC", r.freq + " kHz", r.kind + (r.count > 1 ? ` ×${r.count}` : ""),
      r.from ? "from " + r.from : "", r.to ? "to " + r.to : "", `BER ${r.ber}`,
      ...r.cmds.map((c) => `[${c.type}${c.text ? ": " + c.text : ""}]`)].filter(Boolean).join(" | "));
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ale-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

</script>

<div class="w-full text-left">
  <div class="flex flex-wrap items-center gap-2 mb-2">
    <select bind:value={netIdx} title="ALE network (frequencies from public lists; may be out of date)"
      class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0">
      {#each CATS as c}
        <optgroup label={CAT_LABELS[c] || c}>
          {#each ALE_NETS as n, i}
            {#if n.cat === c}<option value={String(i)}>{n.net}{n.lsb ? " (LSB)" : ""}</option>{/if}
          {/each}
        </optgroup>
      {/each}
    </select>
    <select bind:value={selectedFreq} title="Channel (kHz, the dial frequency)"
      class="glass-select text-white text-xs px-2 py-1 rounded-md">
      {#each net.khz as f}
        <option value={String(f)}>{f} kHz</option>
      {/each}
    </select>
    <button title="Tune the receiver to this ALE channel ({net.lsb ? 'LSB' : 'USB'}) and set the IF filter"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune &amp; Set IF</button>
    <button title="Save the decoded ALE events (text)"
      class="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap disabled:opacity-50"
      on:click={save} disabled={rows.length === 0}>💾 Save</button>
  </div>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
    <span>Dial: <span class="font-mono text-gray-200">{Number(dialKhz).toFixed(1)} kHz</span>
      {#if !onNetFreq}<span class="text-amber-400" title="Not on a listed ALE channel"> ⚠ not a listed channel</span>{/if}</span>
    <span title="Decoders currently reading ALE words (of 17 frequency-offset decoders)">In sync: <span class="font-mono text-gray-200">{synced}</span></span>
    <span>Events: <span class="font-mono text-gray-200">{rows.length}</span></span>
  </div>

  <div bind:this={scrollEl} on:scroll={onScroll}
    class="rounded-md bg-gray-900 recess-window overflow-y-auto custom-scrollbar text-xs font-mono" style="height: 300px;">
    {#if rows.length === 0}
      <div class="p-3 text-gray-500 italic font-sans">
        Pick a network and a channel, click Tune and wait. ALE stations scan their channels and send short soundings (a few seconds) every half hour or hour; calls come when a link is needed, so a channel can be quiet for a long time.
      </div>
    {/if}
    {#each rows as r (r.id)}
      <div class="px-2 py-1.5 border-b border-gray-800">
        <div class="flex flex-wrap items-center gap-x-2">
          <span class="text-gray-500">{r.time}</span>
          <span class="text-gray-400">{r.freq}</span>
          <span class="font-semibold {kindClass(r.kind)}">{r.kind}{r.count > 1 ? ` ×${r.count}` : ""}</span>
          {#if r.from}<span class="text-gray-400">from</span> <span class="text-yellow-300 font-semibold">{r.from}</span>{/if}
          {#if r.to}<span class="text-gray-400">to</span> <span class="text-yellow-300 font-semibold">{r.to}</span>{/if}
          <span class="text-gray-600" title="Bit errors the decoder corrected in the last word (0 = clean)">BER {r.ber}</span>
        </div>
        {#each r.cmds as c}
          <div class="mt-0.5 font-sans"><span class="text-teal-300">{c.type}</span>{#if c.text}<span class="text-gray-100"> {c.text}</span>{/if}</div>
        {/each}
      </div>
    {/each}
  </div>
  <p class="text-[11px] text-gray-500 mt-2 font-sans">
    MIL-STD-188-141 2G ALE: 8 tones 750–2500 Hz, 125 Bd, Golay FEC with triple redundancy; decoder ported from gr-ale / LinuxALE as in KiwiSDR's ALE 2G extension. {scope === "ham" ? "Amateur channels from HFLINK; government, military and utility networks are in SERVICES → ALE 2G." : "Network list from KiwiSDR's ALE_nets; the amateur (HFLINK) channels are in FLDIGI → ALE 2G HAM."}
  </p>
</div>
