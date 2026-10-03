import './app.css'
import { preloadSiteInfo } from './lib/rx'

// The variant is a build-time define, not a rewrite of this file — see the
// "Which S-meter variant is this?" block in vite.config.js.  Keeping this file
// constant is what lets build-all.sh build the variants in parallel.
//
// App is imported only after preloadSiteInfo(): several modules read the
// site information at load time, and on a page for a second receiver it has
// to be that receiver's (see siteInfo.js).
preloadSiteInfo().then(async () => {
  const { default: App } = await import('./App.svelte')
  new App({
    target: document.getElementById('app'),
    props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
  })
})
