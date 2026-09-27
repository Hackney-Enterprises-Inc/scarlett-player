---
"@scarlett-player/embed": minor
---

Chapters and viewer clips for the CDN embed, as addons. The existing builds are unchanged; new features ship as separate files a page loads after a Full or Video build.

- `ScarlettPlayer.use(name, creator)` registers an addon's plugin creator (`chapters` or `clips`) into the same map `initAll()` and `create()` read. It refuses a name the build already provides or an unknown name, warns when it replaces an earlier registration, and warns when players were already created (they do not pick it up).
- `ScarlettPlayer.addonRuntime`: frozen; the embed's version and its own `injectSharedStyles`, `registerControl` and `unregisterControl`, so an addon's control lands in the embed's control bar. For addon bundles only.
- Two addon bundles, ESM and UMD, flat beside the builds on the CDN: `embed.addon.chapters.js` / `.umd.cjs` and `embed.addon.clips.js` / `.umd.cjs` (package subpaths `./addons/chapters`, `./addons/clips`). Load the embed first; an addon refuses to register with an embed of a different version.
- Seven data attributes: `data-captions` (JSON array of caption tracks, `default` now passes through; Full and Video builds, no addon needed), `data-chapters` (JSON array or WebVTT URL; chapters addon), and `data-clips-endpoint`, `data-clips-csrf`, `data-clips-media-id`, `data-clips-max-duration`, `data-clips-min-duration` (clips addon). Clips stay inert unless the host opts in with `data-clips-csrf="meta"`, which sends the page's `<meta name="csrf-token">` as `X-CSRF-TOKEN`. `data-clips-media-id` falls back to `data-analytics-video-id`, then `data-src`. Invalid JSON warns and is ignored.
- The video control bar gains the `clip` and `chapters` controls (before the settings menu) when their addon is active; an embed with none of share, chapters or clips keeps the UI's default layout.
