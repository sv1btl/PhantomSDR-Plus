<script>
  // "Direct USB" part of the CAT window: the rig, its serial settings and
  // the connection. The connection itself lives in App.svelte (startCatUsb),
  // which hands this panel its state and the actions below.
  import { RIG_PRESETS, RIG_BAUD_RATES, parseCivAddress, parseSsbFilters, rigCanPowerOn, rigPortHint, rigBlockedHere } from "./rig/presets.js";

  export let settings;
  export let state = "closed";
  export let message = "";
  export let onChoose = () => {};
  export let onConnect = () => {};
  export let onDisconnect = () => {};
  export let onChange = () => {};
  export let onPowerOn = () => {};
  export let onPowerOff = () => {};

  const makers = [...new Set(RIG_PRESETS.map((p) => p.maker))];
  $: preset = RIG_PRESETS.find((p) => p.id === settings.preset) || null;
  $: isIcom = preset && preset.protocol === "icom";
  $: civBad = isIcom && parseCivAddress(settings.civAddress) === null;
  $: filBad = isIcom && parseSsbFilters(settings.ssbFilters) === null;
  $: busy = state === "connecting";
  $: live = state === "connected" || state === "connecting";
  $: canPowerOn = rigCanPowerOn(preset);
  $: portHint = rigPortHint(preset);
  $: blockedHere = rigBlockedHere(preset);

  function confirmPowerOff() {
    let ok = true;
    try {
      ok = window.confirm(`Switch the ${preset ? preset.model : "rig"} off?`);
    } catch (e) {}
    if (ok) onPowerOff();
  }

  const STATE_TEXT = {
    connected: "Connected",
    connecting: "Connecting…",
    ready: "Not connected",
    "no-port": "No port chosen",
    lost: "Link lost",
    error: "Error",
    closed: "Not connected",
    off: "Switched off",
  };
  $: colour =
    state === "connected" ? "text-green-400" : state === "error" || state === "lost" ? "text-red-400" : "text-gray-400";
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 items-center text-xs">
    <label class="text-gray-400" for="cat-usb-rig">Rig:</label>
    <select
      id="cat-usb-rig"
      class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5"
      bind:value={settings.preset}
      on:change={() => onChange(true)}
      disabled={live}
      title="Your transceiver. Rigs not listed: use TCI with the Hamlib bridge (tci-rigctld.mjs)."
    >
      {#each makers as maker}
        <optgroup label={maker}>
          {#each RIG_PRESETS.filter((p) => p.maker === maker) as p (p.id)}
            <option value={p.id}>{p.model}</option>
          {/each}
        </optgroup>
      {/each}
    </select>

    <label class="text-gray-400" for="cat-usb-baud">Baud:</label>
    <div class="flex items-center gap-2 flex-wrap">
      <select
        id="cat-usb-baud"
        class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5"
        bind:value={settings.baudRate}
        on:change={() => onChange(false)}
        disabled={live}
        title="Must match the rig's own menu (IC-7300: Set > Connectors > CI-V > CI-V USB Baud Rate)."
      >
        {#each RIG_BAUD_RATES as b}
          <option value={b}>{b}</option>
        {/each}
      </select>
      {#if isIcom}
        <label class="text-gray-400" for="cat-usb-civ">CI-V:</label>
        <input
          id="cat-usb-civ"
          type="text"
          class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5 w-12 {civBad ? 'ring-1 ring-red-500' : ''}"
          bind:value={settings.civAddress}
          on:change={() => onChange(false)}
          disabled={live}
          title="The rig's CI-V address in hex, as its menu shows it (IC-7300: 94)."
        />
        <span class="text-gray-500">h</span>
      {/if}
    </div>

    {#if isIcom}
      <label class="text-gray-400" for="cat-usb-fil">SSB FIL1/2/3:</label>
      <input
        id="cat-usb-fil"
        type="text"
        class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5 w-32 {filBad ? 'ring-1 ring-red-500' : ''}"
        bind:value={settings.ssbFilters}
        on:change={() => onChange(false)}
        disabled={live}
        title="Your rig's SSB filter widths in Hz, FIL1,FIL2,FIL3. A passband change on this page selects the nearest filter; the rig's filter widths are never changed."
      />
    {/if}

    <span class="text-gray-400">Lines:</span>
    <div class="flex items-center gap-3 text-gray-300">
      <label class="flex items-center gap-1" title="Leave off unless your CAT cable needs it: on many interfaces DTR or RTS keys the transmitter.">
        <input type="checkbox" bind:checked={settings.dtr} on:change={() => onChange(false)} disabled={live} /> DTR
      </label>
      <label class="flex items-center gap-1" title="Leave off unless your CAT cable needs it: on many interfaces DTR or RTS keys the transmitter.">
        <input type="checkbox" bind:checked={settings.rts} on:change={() => onChange(false)} disabled={live} /> RTS
      </label>
      {#if preset && preset.protocol === "yaesu-legacy"}
        <span class="text-gray-500">2 stop bits</span>
      {/if}
    </div>
  </div>

  {#if blockedHere}
    <p class="text-xs text-center text-amber-300" role="alert">{blockedHere}</p>
  {:else if portHint}
    <p class="text-xs text-center text-gray-400">{portHint}</p>
  {/if}

  <div class="flex items-center justify-center gap-2 flex-wrap">
    <button
      class="retro-button text-white text-xs font-bold px-3 h-7 rounded-md border border-gray-600 bg-gray-700 hover:bg-gray-600"
      on:click={onChoose}
      disabled={busy || !!blockedHere}
      title="Pick the rig's USB serial port in the browser's list (asked once; the browser remembers it for this receiver)."
    >
      Choose port…
    </button>
    {#if live}
      <button
        class="retro-button text-white text-xs font-bold px-3 h-7 rounded-md border border-gray-600 bg-gray-700 hover:bg-gray-600"
        on:click={onDisconnect}
        title="Close the rig's port, so another program can use it."
      >
        Disconnect
      </button>
    {:else if state !== "no-port"}
      <button
        class="retro-button text-white text-xs font-bold px-3 h-7 rounded-md border border-gray-600 bg-gray-700 hover:bg-gray-600"
        on:click={onConnect}
        disabled={civBad || filBad || !!blockedHere}
        title="Open the rig's port with these settings."
      >
        {state === "lost" || state === "error" ? "Reconnect" : "Connect"}
      </button>
    {/if}
    {#if !live && state !== "no-port" && canPowerOn}
      <button
        class="retro-button text-white text-xs font-bold px-3 h-7 rounded-md border border-gray-600 bg-gray-700 hover:bg-gray-600"
        on:click={onPowerOn}
        disabled={civBad || filBad || !!blockedHere}
        title="Switch the rig on over CAT and connect. The rig's power supply must be on; this replaces pressing its power button."
      >
        ⏻ Power on
      </button>
    {/if}
    {#if state === "connected"}
      <button
        class="retro-button text-white text-xs font-bold px-3 h-7 rounded-md border border-gray-600 bg-gray-700 hover:bg-gray-600"
        on:click={confirmPowerOff}
        title="Switch the rig off over CAT{canPowerOn ? ' (Power on brings it back)' : ' (this rig cannot be switched on again over CAT)'}."
      >
        ⏻ Power off
      </button>
    {/if}
  </div>

  <p class="text-xs text-center {colour}" role="status" aria-live="polite">
    ● {STATE_TEXT[state] || state}{message && message !== STATE_TEXT[state] ? ` — ${message}` : ""}
  </p>
</div>
