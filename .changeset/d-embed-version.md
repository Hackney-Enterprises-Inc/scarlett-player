---
'@scarlett-player/embed': patch
---

`window.ScarlettPlayer.version` is the version the embed was actually built
from.

The three entries carried the hand-written literals '0.5.3', '0.5.3-video' and
'0.5.3-audio' while the package published at 1.7.0, and the CDN's
`latest/embed.umd.cjs` still answered `window.ScarlettPlayer.version === '0.5.3'`
when loaded in Chrome (both measured 2026-09-02). That string is the only thing
support can read off a live page to tell which build a viewer is running, so it
was worse than useless: it named a release that never shipped.

The value comes from the package's own package.json now, through a
`__PKG_VERSION__` define in `vite.config.ts` read by `src/version.ts`, with a
'0.0.0-dev' fallback for test runs. The `-video` and `-audio` suffixes stay, as
`1.7.0-video` and `1.7.0-audio`. `scripts/verify-browser.mjs` loads the built
UMD in a real browser and asserts the global's `version` equals
`packages/embed/package.json`, because nothing short of a browser load can prove
the define survived the bundle.
