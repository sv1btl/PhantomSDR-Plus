<script>
  // Pop-up number pad for typing a frequency.  Opened by a click anywhere in
  // the black frequency / S-meter box (App.svelte, openFreqKeypad).  The two
  // Enter keys pick the unit, so "7.074 MHz" and "7074 kHz" both work without
  // a separate unit toggle.  The physical keyboard works too: digits, "." or
  // ",", Backspace, Delete (clear), Enter (kHz), "m" (MHz), Escape (close).
  import { createEventDispatcher, onMount } from "svelte";

  /** Current dial frequency in kHz, shown greyed until the first key press. */
  export let currentKHz = 0;

  const dispatch = createEventDispatcher();
  let value = "";
  let panel;

  const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

  function press(k) {
    if (k === "⌫") {
      value = value.slice(0, -1);
    } else if (k === ".") {
      if (!value.includes(".")) value = (value || "0") + ".";
    } else if (value.replace(".", "").length < 12) {
      value = value === "0" ? k : value + k;
    }
  }

  function enter(multToKHz) {
    const v = parseFloat(value);
    if (!value || isNaN(v) || v < 0) return;
    dispatch("enter", Math.round(v * multToKHz * 1e3));
  }

  function close() {
    dispatch("close");
  }

  function onKey(e) {
    const k = e.key;
    if (k >= "0" && k <= "9") press(k);
    else if (k === "." || k === ",") press(".");
    else if (k === "Backspace") press("⌫");
    else if (k === "Delete") value = "";
    else if (k === "Enter") enter(1);
    else if (k === "m" || k === "M") enter(1000);
    else if (k === "Escape") close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  onMount(() => panel && panel.focus());
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4"
  on:click|self={close}
>
  <div
    bind:this={panel}
    class="w-64 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-2xl focus:outline-none"
    role="dialog"
    aria-label="Enter frequency"
    tabindex="-1"
    on:keydown={onKey}
  >
    <div class="mb-2 flex items-center justify-between">
      <span class="text-xs font-semibold text-gray-200">Enter frequency</span>
      <button
        class="px-1 text-xs text-gray-400 hover:text-white"
        on:click={close}
        aria-label="Close">✕</button
      >
    </div>
    <div
      class="mb-3 rounded border border-gray-700 bg-black px-3 py-2 text-right font-mono text-2xl {value
        ? 'text-cyan-300'
        : 'text-gray-600'}"
    >
      {value || (Number(currentKHz) || 0).toFixed(3)}
    </div>
    <div class="grid grid-cols-3 gap-2">
      {#each KEYS as k}
        <button
          class="rounded-md border border-gray-600 bg-gray-700 py-2 text-xl font-mono text-white hover:bg-gray-600 active:bg-gray-500"
          on:click={() => press(k)}>{k}</button
        >
      {/each}
      <button
        class="rounded-md border border-gray-600 bg-gray-700 py-2 text-sm font-semibold text-red-300 hover:bg-gray-600 active:bg-gray-500"
        on:click={() => (value = "")}>C</button
      >
      <button
        class="rounded-md border border-cyan-700 bg-cyan-800 py-2 text-sm font-semibold text-white hover:bg-cyan-700 active:bg-cyan-600"
        on:click={() => enter(1)}>kHz</button
      >
      <button
        class="rounded-md border border-cyan-700 bg-cyan-800 py-2 text-sm font-semibold text-white hover:bg-cyan-700 active:bg-cyan-600"
        on:click={() => enter(1000)}>MHz</button
      >
    </div>
  </div>
</div>
