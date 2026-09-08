---
'@scarlett-player/core': patch
'@scarlett-player/embed': patch
'@scarlett-player/vue': patch
'@scarlett-player/hls': patch
'@scarlett-player/ui': patch
'@scarlett-player/native': patch
'@scarlett-player/airplay': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/analytics': patch
'@scarlett-player/playlist': patch
'@scarlett-player/media-session': patch
'@scarlett-player/audio-ui': patch
'@scarlett-player/captions': patch
'@scarlett-player/watermark': patch
'@scarlett-player/share': patch
'@scarlett-player/chapters': patch
'@scarlett-player/gestures': patch
'@scarlett-player/clips': patch
---

Documentation reconcile against the shipped code. No runtime changes.

- The package count is 18 everywhere it is stated; the root changelog,
  `docs/contributing.md` and the scarlettplayer.com package table said 17 and
  omitted `@scarlett-player/clips`.
- The CI checklists in `docs/contributing.md` and the development guide now list
  `scripts/check-package-types.mjs` and the push-only real-browser verification
  job, and describe `pnpm validate` in the order it actually runs.
- `docs/architecture.md` and `docs/plugin-authoring.md` carry the current version
  and list `clips` as a feature plugin.
- The README test count is 2,300+, measured, and the roadmap records clips as
  shipped.
- `docs/embed-implementation.md` is rewritten against the package as built: the
  three build entries, the real source layout, the async `create()` contract,
  the actual auto-init selectors, measured bundle sizes, and the automated CDN
  and npm release path. The stale data-attribute table now links to
  `packages/embed/README.md`, and the obsolete manual-publishing section is gone.
