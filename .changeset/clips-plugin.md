---
'@scarlett-player/core': minor
'@scarlett-player/embed': minor
'@scarlett-player/vue': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
'@scarlett-player/airplay': minor
'@scarlett-player/chromecast': minor
'@scarlett-player/analytics': minor
'@scarlett-player/playlist': minor
'@scarlett-player/media-session': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/captions': minor
'@scarlett-player/watermark': minor
'@scarlett-player/share': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
'@scarlett-player/clips': minor
---

Clips: new `@scarlett-player/clips` plugin - viewer-created clips, player side.

- `createClipsPlugin(config)` adds a `'clip'` control (when `@scarlett-player/ui` is
  present) that opens a two-handle in/out selector anchored above the control bar:
  Pointer Events, touch and keyboard (arrows, Shift, Home/End), ARIA sliders with
  `formatTime` labels, an optional title field with a live counter, and clamp
  feedback that never pushes the other handle.
- `minDuration` / `maxDuration` / `defaultDuration` / `step` are all host
  configuration (fallbacks 5 / 60 / 30 / 1s), enforced in a pure range model and
  adjustable at runtime via `configure()`; `open()` pre-rolls a selection behind
  the playhead.
- The selection loops in a preview while the selector is open; dragging a handle
  pauses and scrubs (100ms throttle) and restores play state on release.
- v1 is VOD-only: the control hides on live and audio, and `open()` errors
  ('live-unsupported') rather than opening. Live/DVR reconciliation and
  wall-clock mapping are designed and deferred to Phase 2.
- Two submission paths, host picks one: `onCreate(range)` for hosts with their
  own HTTP client, or a built-in `endpoint` POST transport (per-request header
  resolution, `AbortController` timeout, `same-origin` credentials by default).
  The wire contract is the `ClipRange` object verbatim, camelCase, with a
  `clientRequestId` minted per open session as the idempotency key and no `src`.
  The player never polls; `clip:created` hands the host the server's `result`.
- Fully headless with `ui: 'none'`: `open` / `setRange` / `setTitle` / `getRange` /
  `commit` / `close` / `configure`, the `clip:opened|changed|created|cancelled|error`
  events, and the `clipSelection` / `clipOpen` / `clipTitle` state keys all work
  with no UI package installed.
- Peer ranges state what the package actually needs, as audited at 1.10.0:
  `@scarlett-player/clips` requires core `^1.10.0` (the release that added the
  `formatTime` export it imports); its optional ui peer is `^1.9.0`, which added
  the owner-scoped `registerControl`/`unregisterControl` options it registers with.
- Core: the `defineState` and `StateStore` declaration-merging docblock examples
  now use `clipSelection`, matching the shipped plugin (comment-only).
