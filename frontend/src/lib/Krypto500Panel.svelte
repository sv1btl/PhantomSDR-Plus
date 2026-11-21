<script>
  // SERVICES → Krypto500 group: one panel for the five decoders that run in
  // services.worker.js (krypto500/*.js, AQC in ale.js). `service` picks the
  // wording, the frequency list and the controls.
  import { srFeed } from "./a11y.js";
  import { onMount, onDestroy, tick } from "svelte";

  export let audio;
  export let service = "k5aqc";
  /** USB dial frequency shown by the receiver, in kHz. */
  export let dialKhz = 0;
  /** Called with a dial frequency in kHz (USB). */
  export let onTune = () => {};

  const MAX_ROWS = 400;

  // Frequencies where the mode has been reported in public monitoring logs
  // (dial frequency, USB). Activity comes and goes: these are starting points.
  const FREQS = {
    k5aqc: [
      { group: "USAF Special Ops net (Hurlburt sounds in AQC-ALE, 2018 — ominous-valve ALE list)", list: [4625.0, 5100.0, 7500.0, 8425.0, 8501.4, 10476.4, 12100.0, 12501.4, 13465.0, 14774.4, 14980.0] },
    ],
    k5fsk: [
      { group: "SITOR-A — MFA Cairo and others (i56578-swl logs)", list: [[17415.0, "MFA Cairo, 2016"], [18046.8, "MFA Cairo, 2015"], [16766.5, "unidentified, 2016"]] },
    ],
    k5s4285: [
      { group: "French Navy OMAR net (4285 / 188-110A variants)", list: [5884.0, 6828.0, 7582.0, 7720.0, 8276.0, 9073.0, 9190.0, 14716.6, 14800.0, 19215.0] },
      { group: "Logged STANAG 4285", list: [[5155.0, "Turkish, idle, 2016"], [5838.0, "STANAG 5066 e-mail net, 2016"], [8013.2, "UK DHFCS?, 1200L, 2025"], [10008.2, "UK DHFCS?, 1200L, 2025"], [10568.2, "NCSA Naples, 600L, 2014"], [12857.0, "French Navy Dakar 6WW, 600L, 2015"]] },
    ],
    k5m110a: [
      { group: "Logged MIL-STD-188-110A serial", list: [[5094.0, "Polish CD/TDF net, STANAG 5066, 2022"], [8968.0, "USAF HFGCS, 1200S, 2015"], [9073.0, "French Navy 5CI, 2015"], [10315.0, "Romanian MFA / NATO, 2016"], [11480.0, "Algerian AF air defence, 2024"], [15091.0, "STANAG 4415 (75 bps), 2025"]] },
    ],
    k5ale3g: [
      { group: "Logged 3G ALE (BW0 / FLSU bursts)", list: [[5365.0, "3G-HF FLSU + wideband, 2018"], [6910.0, "US Army MARS, 2020"], [6953.0, "listed 3G ALE"], [6968.0, "listed 3G ALE"]] },
    ],
  };
  const TITLES = {
    k5aqc: "AQC-ALE (MIL-STD-188-141B)",
    k5fsk: "FSK modes: SITOR-A · ARQ-E · ARQ-E3",
    k5s4285: "STANAG 4285",
    k5m110a: "MIL-STD-188-110A serial tone",
    k5ale3g: "3G ALE (MIL-STD-188-141B App. C)",
  };
  const NOTES = {
    k5aqc: "AQC-ALE uses the 8-FSK 2G ALE modem (125 Bd) with packed 6-character addresses and data-exchange fields: calls, responses, acknowledgements, soundings and inlink transactions are shown with their traffic type, noise reports and LQA. Plain 2G ALE calls on the same channel are shown too. Tune exactly: about ±60 Hz off is the blind spot of the shared 2G ALE front end.",
    k5fsk: "Synchronous ARQ teleprinter systems. SITOR-A: 100 Bd blocks of three CCIR 476 characters, repeats dropped. ARQ-E: ITA2-P, every 4th or 8th character inverted. ARQ-E3: ITA3 constant-ratio code. Polarity and character phase are found automatically; baud and shift must match. Most ARQ-E/E3 networks of the past have gone quiet: no current public log was found, tune by ear.",
    k5s4285: "2400 symbols/s 8-PSK frames on 1800 Hz. STANAG 4285 does not announce its rate: after locking to the frames the decoder reads the constellation and tries every rate and interleaver it allows, the best Viterbi fit wins (a long interleaver needs 10 s). Most traffic is encrypted or STANAG 5066: then you see hex. Checked on the air: 12857 kHz (French Navy) read as 600 bps long interleave. Uncoded modes carrying very regular text can be mistaken for a coded rate.",
    k5m110a: "The 188-110A preamble names the rate (75–4800 bps) and interleaver, so the decoder knows the mode at once. Text sent as async 8N1 characters is shown as text, anything else as hex; the end-of-message pattern closes it. Entry needs the preamble: a transmission already running when you tune in is caught at its next preamble.",
    k5ale3g: "3G ALE link-setup PDUs travel in BW0 bursts (613 ms, PSK, Walsh-coded): LE_Call, LE_Handshake, LE_Notification, LE_Broadcast, scanning calls and time PDUs are decoded and CRC-checked. 3G addresses are numbers (group.member); BW1–BW4 traffic bursts are not decoded.",
  };
  const FSK_MODES = [
    { key: "sitora", label: "SITOR-A", bauds: [100], shifts: [170, 400, 850] },
    { key: "arqe", label: "ARQ-E", bauds: [46.2, 48, 50, 64, 72, 85.7, 96, 144, 192, 288], shifts: [170, 400, 850] },
    { key: "arqe3", label: "ARQ-E3", bauds: [48, 50, 64, 72, 96, 100, 192, 200], shifts: [170, 270, 300, 400, 850] },
  ];

  const freqVal = (f) => (Array.isArray(f) ? f[0] : f);
  const freqTip = (f) => (Array.isArray(f) ? f[1] : "");
  $: groups = FREQS[service] || [];
  $: all = groups.flatMap((g) => g.list.map(freqVal));
  let selectedFreq = "";
  $: if (!selectedFreq || !all.includes(Number(selectedFreq))) selectedFreq = String(all.find((f) => Math.abs(f - Number(dialKhz)) < 0.05) ?? all[0] ?? "");
  $: onListed = all.some((f) => Math.abs(f - Number(dialKhz)) < 0.05);

  // FSK-mode settings (remembered per browser)
  let fsk = (() => {
    try { return { mode: "sitora", baud: 100, shift: 170, centerHz: 1700, ...JSON.parse(localStorage.getItem("k5fskOpts") || "{}") }; }
    catch (_) { return { mode: "sitora", baud: 100, shift: 170, centerHz: 1700 }; }
  })();
  $: fskMode = FSK_MODES.find((m) => m.key === fsk.mode) || FSK_MODES[0];
  function fskChanged(patch) {
    fsk = { ...fsk, ...patch };
    const m = FSK_MODES.find((x) => x.key === fsk.mode);
    if (!m.bauds.includes(fsk.baud)) fsk.baud = m.bauds[m.bauds.length > 5 ? 6 : 0];
    if (!m.shifts.includes(fsk.shift)) fsk.shift = m.shifts.includes(400) ? 400 : m.shifts[0];
    try { localStorage.setItem("k5fskOpts", JSON.stringify(fsk)); } catch (_) {}
    if (audio && audio.setServicesOptions) audio.setServicesOptions({ ...fsk });
  }

  let status = "Starting…";
  let metrics = {};
  let rows = [];
  let nextId = 1;
  let openRow = null;
  let scrollEl;
  let followTail = true;

  function tune() {
    const khz = Number(selectedFreq);
    if (khz > 0) onTune(khz);
  }

  function push(row) {
    rows = [...rows, { ...row, id: nextId++ }].slice(-MAX_ROWS);
    return rows[rows.length - 1];
  }
  function scroll() { if (followTail) tick().then(() => { if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight; }); }

  function onEvent(e) {
    if (!e || (e.service && e.service !== service)) return;
    if (e.type === "status") { status = e.text; return; }
    if (e.type === "metrics") { metrics = e; return; }
    if (e.type === "error") { status = "Decoder error: " + e.message; return; }
    if (e.type !== "message" || !e.msg) return;
    const m = e.msg, freq = Number(dialKhz).toFixed(1);
    if (m.kind === "text") {
      if (!openRow) openRow = push({ time: m.time, freq, cls: "text-sky-300", head: "Text", body: "", text: true });
      openRow.body += m.text;
      rows = rows;
    } else if (m.kind === "start") {
      openRow = push({ time: m.time, freq, cls: "text-green-300", head: "▶ " + m.mode, body: "", text: true });
    } else if (m.kind === "mode") {
      if (openRow) { openRow.head = "▶ " + m.mode; rows = rows; }
    } else if (m.kind === "end") {
      push({ time: m.time, freq, cls: "text-gray-400", head: "■ " + (m.reason || "end"), body: m.mode || "" });
      openRow = null;
    } else if (m.kind === "info") {
      push({ time: m.time, freq, cls: "text-gray-400 italic", head: m.text, body: "" });
      if (openRow) { const o = openRow; openRow = null; openRow = push({ time: m.time, freq, cls: o.cls, head: "…", body: "", text: true }); }
    } else if (m.kind === "pdu") {
      const f = Object.entries(m).filter(([k]) => !["kind", "type", "time", "snrDb", "quality", "calledMember"].includes(k))
        .map(([k, v]) => `${k}: ${v && typeof v === "object" ? v.text : v}`);
      push({ time: m.time, freq, cls: m.type === "LE_Call" ? "text-yellow-300" : "text-teal-300", head: m.type, body: f.join(" · "), extra: `q ${m.quality} %` });
    } else if (m.kind === "burst") {
      push({ time: m.time, freq, cls: "text-gray-500", head: m.text, body: "" });
    } else {
      // ALE (2G or AQC) call / sounding
      const who = `${m.from ? m.from : ""}${m.to ? " → " + m.to : ""}`;
      const det = [...(m.details || []), ...(m.cmds || []).map((c) => `[${c.type}${c.text ? ": " + c.text : ""}]`)].join(" · ");
      push({ time: m.time, freq, cls: m.protocol === "AQC" ? "text-yellow-300" : "text-teal-300", head: `${m.protocol === "AQC" ? "" : "2G "}${m.kind}`, body: who + (det ? "  " + det : ""), extra: m.ber !== undefined ? `BER ${m.ber}` : "" });
    }
    scroll();
  }

  function onScroll() {
    if (!scrollEl) return;
    followTail = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 20;
  }
  function clear() { rows = []; openRow = null; }
  function save() {
    const lines = rows.map((r) => [r.time + " UTC", r.freq + " kHz", r.head, r.body, r.extra || ""].filter(Boolean).join(" | "));
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${service}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  onMount(() => {
    if (audio && audio.setServicesCallback) audio.setServicesCallback(onEvent);
    if (service === "k5fsk") fskChanged({});
  });
  onDestroy(() => {
    if (audio && audio.setServicesCallback && audio.servicesCallback === onEvent) audio.setServicesCallback(null);
  });
</script>

<div class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel">
  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
      <span class="inline-block w-2 h-2 rounded-full {metrics.receiving ? 'bg-green-400 animate-pulse' : 'bg-sky-400 animate-pulse'}"></span>
      <slot name="service" />
      {TITLES[service]}
      <span class="text-xs {metrics.receiving ? 'text-green-300 font-mono' : 'text-gray-500 italic'} font-normal">{status}</span>
    </h4>
    <div class="flex items-center gap-1">
      <button title="Save the decoded output (text)"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={save} disabled={rows.length === 0}>💾 Save</button>
      <button title="Clear the output"
        class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
        on:click={clear}>Clear</button>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 mb-2">
    <select bind:value={selectedFreq} title="Frequencies where this mode has been reported (USB dial). Activity comes and goes."
      class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0">
      {#each groups as g}
        <optgroup label={g.group}>
          {#each g.list as f}
            <option value={String(freqVal(f))} title={freqTip(f)}>{freqVal(f).toFixed(1)} kHz{freqTip(f) ? " — " + freqTip(f) : ""}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
    <button title="Tune the receiver to this frequency (USB) and set the IF filter"
      class="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors whitespace-nowrap"
      on:click={tune}>⇒ Tune &amp; Set IF</button>
  </div>

  {#if service === "k5fsk"}
    <div class="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-300">
      <label class="flex items-center gap-1" title="The ARQ system to read">System
        <select class="glass-select text-white text-xs px-2 py-0.5 rounded-md" value={fsk.mode} on:change={(e) => fskChanged({ mode: e.currentTarget.value })}>
          {#each FSK_MODES as m}<option value={m.key}>{m.label}</option>{/each}
        </select></label>
      <label class="flex items-center gap-1" title="Baud rate (must match the signal)">Baud
        <select class="glass-select text-white text-xs px-2 py-0.5 rounded-md" value={String(fsk.baud)} on:change={(e) => fskChanged({ baud: Number(e.currentTarget.value) })}>
          {#each fskMode.bauds as b}<option value={String(b)}>{b}</option>{/each}
        </select></label>
      <label class="flex items-center gap-1" title="Frequency shift between the two tones">Shift
        <select class="glass-select text-white text-xs px-2 py-0.5 rounded-md" value={String(fsk.shift)} on:change={(e) => fskChanged({ shift: Number(e.currentTarget.value) })}>
          {#each fskMode.shifts as s}<option value={String(s)}>{s} Hz</option>{/each}
        </select></label>
      <label class="flex items-center gap-1" title="Audio centre of the two tones (USB)">Centre
        <select class="glass-select text-white text-xs px-2 py-0.5 rounded-md" value={String(fsk.centerHz)} on:change={(e) => fskChanged({ centerHz: Number(e.currentTarget.value) })}>
          {#each [1000, 1500, 1700, 2000] as c}<option value={String(c)}>{c} Hz</option>{/each}
        </select></label>
    </div>
  {/if}

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
    <span>Dial: <span class="font-mono text-gray-200">{Number(dialKhz).toFixed(1)} kHz USB</span>
      {#if all.length && !onListed}<span class="text-amber-400" title="Not one of the listed frequencies"> ⚠ not listed</span>{/if}
    </span>
    {#if metrics.mode}<span>Mode: <span class="font-mono text-gray-200">{metrics.mode}</span></span>{/if}
    {#if metrics.snrDb !== null && metrics.snrDb !== undefined}<span title="Signal-to-noise on the known symbols">S/N: <span class="font-mono text-gray-200">{metrics.snrDb.toFixed(1)} dB</span></span>{/if}
    {#if metrics.offsetHz !== null && metrics.offsetHz !== undefined}<span title="Carrier offset from 1800 Hz">Offset: <span class="font-mono text-gray-200">{metrics.offsetHz > 0 ? "+" : ""}{metrics.offsetHz.toFixed(1)} Hz</span></span>{/if}
    {#if metrics.bursts !== undefined}<span>Bursts: <span class="font-mono text-gray-200">{metrics.good}/{metrics.bursts}</span></span>{/if}
    {#if metrics.words !== undefined}<span>ALE words: <span class="font-mono text-gray-200">{metrics.words}</span></span>{/if}
    {#if metrics.chars !== undefined}<span>Characters: <span class="font-mono text-gray-200">{metrics.chars}</span>{#if metrics.errors} <span class="text-amber-400">({metrics.errors} bad)</span>{/if}</span>{/if}
    {#if metrics.cands}<span title="Viterbi fit of each rate/interleaver being tried">Trying: <span class="font-mono text-gray-200">{metrics.cands.map((c) => `${c[0].replace(' interleave', '')} ${c[1]}%`).join(", ")}</span></span>{/if}
  </div>

  <div bind:this={scrollEl} use:srFeed={{ name: TITLES[service] }} on:scroll={onScroll}
    class="rounded-md bg-gray-900 recess-window overflow-y-auto custom-scrollbar text-xs font-mono" style="height: 320px;">
    {#if rows.length === 0}
      <div class="p-3 text-gray-500 italic font-sans">Pick a frequency, click Tune and wait: these networks are on the air only now and then.</div>
    {/if}
    {#each rows as r (r.id)}
      <div class="px-2 py-1.5 border-b border-gray-800">
        <div class="flex flex-wrap items-center gap-x-2">
          <span class="text-gray-500">{r.time}</span>
          <span class="text-gray-400">{r.freq}</span>
          <span class="font-semibold {r.cls}">{r.head}</span>
          {#if r.extra}<span class="text-gray-500">{r.extra}</span>{/if}
        </div>
        {#if r.body}
          <div class="text-gray-100 mt-0.5 {r.text ? 'whitespace-pre-wrap break-all' : 'font-sans'}">{r.body}</div>
        {/if}
      </div>
    {/each}
  </div>
  <p class="text-[11px] text-gray-500 mt-2 font-sans">{NOTES[service]}</p>
</div>
