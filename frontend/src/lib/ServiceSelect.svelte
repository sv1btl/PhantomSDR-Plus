<script>
  // The Service list at the top of every SERVICES panel (HFDL, DSC, ...).
  import { createEventDispatcher } from "svelte";
  export let value = "hfdl";
  /** [{ key, label, title }] */
  export let services = [];
  const dispatch = createEventDispatcher();
</script>

<select
  {value}
  on:change={(e) => dispatch("change", e.currentTarget.value)}
  title="SERVICES: choose what to decode"
  class="glass-select text-white text-xs font-semibold px-2 py-0.5 rounded-md"
>
  {#each services as s}
    <option value={s.key} title={s.title || ""}>{s.label}</option>
  {/each}
</select>
