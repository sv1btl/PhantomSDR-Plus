// Mobile page entry. No app.css / Tailwind import on purpose — the mobile UI
// is self-contained plain CSS inside Mobile.svelte, so it does not inherit the
// desktop app's global reset and utility layer.
import { preloadSiteInfo } from '../lib/rx'

// Mobile is imported only after preloadSiteInfo(), so a page for a second
// receiver reads that receiver's site information (see siteInfo.js).
preloadSiteInfo().then(async () => {
  const { default: Mobile } = await import('./Mobile.svelte')
  new Mobile({
    target: document.getElementById('app')
  })
})
