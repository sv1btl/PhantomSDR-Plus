<script>
  /**
   * StatusIndicators.svelte — the MUTED / SQ / NR / NB / NS / AN / CTCSS chips.
   *
   * Extracted because the two S-meter faces put this row in different places:
   * the analog layout keeps it in the left column under the frequency readout,
   * the digital one stacks it above the bar meter in the right column, with
   * slightly wider chips.  Rather than carry the row twice in App.svelte, it
   * moves here and each layout renders one tag.
   *
   * Both Tailwind width classes appear as complete literals on purpose — a
   * computed class name like `w-{n}` would be invisible to Tailwind's scanner
   * and get purged from the stylesheet.
   */

  export let mute = false;
  export let squelchEnable = false;
  export let NREnabled = false;
  export let NBEnabled = false;
  export let NSEnabled = false;
  export let ANEnabled = false;
  export let CTCSSSupressEnabled = false;
  /** Digital face: wider chips in a tighter row. */
  export let wide = false;
</script>

<div
  class={wide
    ? "flex space-x-1 mb-1"
    : "flex items-center justify-center text-xs w-48 w-full"}
>
  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {mute
        ? 'text-red-500'
        : 'text-red-500 opacity-20 relative z-10'}"
      >MUTED</span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {squelchEnable
        ? `text-orange-500`
        : `text-orange-500 opacity-20 relative z-10`}"
      >SQ</span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NREnabled
        ? `text-green-500`
        : `text-green-500 opacity-20 relative z-10`}"
      >NR</span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NBEnabled
        ? `text-green-500`
        : `text-green-500 opacity-20 relative z-10`}"
      >NB<span> </span></span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NSEnabled
        ? `text-green-500`
        : `text-green-500 opacity-20 relative z-10`}"
      >NS</span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {ANEnabled
        ? `text-green-500`
        : `text-green-500 opacity-20 relative z-10`}"
      >AN</span
    >
  </div>

  <div
    class="px-1 py-0.5 flex items-center justify-center {wide
                ? 'w-10'
                : 'w-8'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {CTCSSSupressEnabled
        ? `text-yellow-500`
        : `text-yellow-500 opacity-20 relative z-10`}"
      >CTCSS</span
    >
  </div>
</div>
