<script>
  // The Service list at the top of every SERVICES panel (HFDL, DSC, ...).
  // Entries with a `group` (e.g. "Krypto500") are shown under an <optgroup>.
  import { createEventDispatcher } from "svelte";
  export let value = "hfdl";
  /** [{ key, label, title, group? }] */
  export let services = [];
  const dispatch = createEventDispatcher();

  // consecutive entries of the same group form one block
  $: blocks = services.reduce((acc, s) => {
    const g = s.group || "";
    const last = acc[acc.length - 1];
    if (last && last.group === g) last.items.push(s);
    else acc.push({ group: g, items: [s] });
    return acc;
  }, []);
</script>

<select
  {value}
  on:change={(e) => dispatch("change", e.currentTarget.value)}
  title="SERVICES: choose what to decode"
  class="glass-select text-white text-xs font-semibold px-2 py-0.5 rounded-md"
>
  {#each blocks as b}
    {#if b.group}
      <optgroup label={b.group}>
        {#each b.items as s}
          <option value={s.key} title={s.title || ""}>{s.label}</option>
        {/each}
      </optgroup>
    {:else}
      {#each b.items as s}
        <option value={s.key} title={s.title || ""}>{s.label}</option>
      {/each}
    {/if}
  {/each}
</select>
