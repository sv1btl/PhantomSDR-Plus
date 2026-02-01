<script>
  import { onMount } from 'svelte';
  
  const versions = [
    { id: 'default', name: 'Analog S-Meter', path: '/' },
    { id: 'digital', name: 'Digital S-Meter', path: '/digital/index.html' },
    { id: 'v2-analog', name: 'V2 Analog S-Meter', path: '/v2-analog/index.html' },
    { id: 'v2-digital', name: 'V2 Digital S-Meter', path: '/v2-digital/index.html' }
  ];
  
  let currentVersion = 'default';
  
  // Detect current version from URL path
  onMount(() => {
    const path = window.location.pathname;
    if (path.includes('/analog/')) {
      currentVersion = 'analog';
    } else if (path.includes('/digital/')) {
      currentVersion = 'digital';
    } else if (path.includes('/v2-analog/')) {
      currentVersion = 'v2-analog';
    } else if (path.includes('/v2-digital/')) {
      currentVersion = 'v2-digital';
    } else {
      currentVersion = 'default';
    }
  });
  
  function handleVersionChange(event) {
    const selectedVersion = event.target.value;
    const version = versions.find(v => v.id === selectedVersion);
    if (version) {
      // Navigate to the selected version
      window.location.href = version.path;
    }
  }
</script>

<div class="version-selector">
  <label for="version-select">⚙️</label>
  <select id="version-select" bind:value={currentVersion} on:change={handleVersionChange}>
    {#each versions as version}
      <option value={version.id}>{version.name}</option>
    {/each}
  </select>
</div>

<style>
  .version-selector {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.75);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  label {
    color: white;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 500;
    margin: 0;
  }
  
  select {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    outline: none;
    min-width: 90px;
  }
  
  select:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  select:focus {
    border-color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }
  
  select option {
    background: #2a2a2a;
    color: white;
    padding: 8px;
  }
  
  /* Mobile responsive */
  @media (max-width: 600px) {
    .version-selector {
      top: 5px;
      right: 5px;
      padding: 6px 8px;
      gap: 6px;
    }
    
    label {
      font-size: 12px;
    }
    
    select {
      font-size: 12px;
      padding: 4px 8px;
      min-width: 90px;
    }
  }
</style>
