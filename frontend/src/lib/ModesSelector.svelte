<script>
  /**
   * ModesSelector.svelte — the USB/LSB/CW/AM/QUAM/FM button row.
   *
   * Extracted from the App variants so the v1 and v2 layouts, which place this
   * block in a different position inside the same panel, can each render it with
   * one tag instead of carrying a copy of the markup.
   *
   * The markup is unchanged.  `onSelect` replaces the direct SetMode() call so
   * the component does not need to know about the parent's demodulation plumbing.
   */

  /** Currently selected demodulation, e.g. "USB". */
  export let demodulation = "USB";
  /** C-QUAM pilot detected — turns the QUAM label green. */
  export let cquamPilotDetected = false;
  /** SAM locked onto the AM carrier — turns the AM label yellow. */
  export let samLocked = false;
  /** SAM active — relabels the AM button "SAM". */
  export let samEnabled = false;
  /** The server offers IQ ([server] iq) — adds the IQ button. */
  export let iqAvailable = false;
  const MODES = ["USB", "LSB", "CW", "AM", "QUAM", "FM"];
  /** Called with the chosen mode string. */
  export let onSelect = () => {};
  /** Called with "RADE2"/"RADEL"/"RADEU" — one-touch RADE decoder launch (RADE2 = V2 beta, USB). */
  export let onRade = () => {};
  /** The decoder currently running: "rade2", "radel", "radeu", "ft8" … or "none". */
  export let activeDecoder = "none";
</script>

                  <!-- Begin Modes Selection -->
                  <div
                    class="flex items-center justify-between gap-2 mb-2 w-full max-w-md"
                  >
                    <h3 class="text-white text-base font-semibold">
                      Modes
                    </h3>
                    <!-- RADE one-touch decoder launch: RADE2 (V2 beta, USB), then v1 -->
                    <div class="flex items-center gap-1">
                      {#each [["RADE-v2U", "rade2", "RADE2"], ["RADE-v1L", "radel", "RADEL"], ["RADE-v1U", "radeu", "RADEU"]] as [label, key, mode]}
                        <button
                          class="retro-button text-xs font-bold text-white h-7 px-2 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {activeDecoder ===
                          key
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          title={mode === "RADE2" ? "Start the RADE V2 (beta) decoder — USB" : `Start the RADE v1 ${mode} decoder`}
                          on:click={() => onRade(mode)}
                        >
                          {label}
                        </button>
                      {/each}
                    </div>
                  </div>
                  <div
                    id="demodulationModes"
                    class="grid {iqAvailable
                      ? 'grid-cols-4 sm:grid-cols-7'
                      : 'grid-cols-3 sm:grid-cols-6'} gap-2 w-full max-w-md"
                  >
                    {#each iqAvailable ? [...MODES, "IQ"] : MODES as mode}
                      <button
                        on:click={() => onSelect(mode)}
                        class="retro-button text-xs font-bold {mode === 'QUAM' &&
                        cquamPilotDetected
                          ? 'text-green-400 font-bold'
                          : mode === 'AM' && samLocked
                            ? 'text-yellow-400 font-bold'
                            : 'text-white'} h-7 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                        mode
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                      >
                        {mode === "AM" && demodulation === "AM" && samEnabled
                          ? "SAM"
                          : mode}
                      </button>
                    {/each}
                  </div>
                  <!-- End of Mode Content -->
