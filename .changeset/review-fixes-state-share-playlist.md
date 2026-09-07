---
'@scarlett-player/core': minor
'@scarlett-player/share': minor
'@scarlett-player/media-session': minor
'@scarlett-player/playlist': minor
'@scarlett-player/ui': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
'@scarlett-player/native': minor
'@scarlett-player/vue': minor
---

Review pass: state redefinition warnings, share-URL credential coverage, live
seek clamping and playlist persistence.

- `StateManager.define()` detects two collisions it used to miss: a key first
  defined with an explicit `undefined` default, and a plugin claiming a core
  key such as `volume`. Core defaults now come from `DEFAULT_STATE`, since core
  keys never reach the plugin default map. Identical re-runs stay silent.
- That warning no longer builds its message with `JSON.stringify`, which threw
  on a circular default or a BigInt and turned a diagnostic into a broken
  `define()`.
- `formatLiveTime()` reports `LIVE` for a non-finite distance instead of
  `-0:00`, which read as a precise offset derived from an unknown seekable end.
- The default share URL also drops `id_token`, `refresh_token`, the AWS SigV4
  `x-amz-*` set and CloudFront's `key-pair-id`, so a page served from a
  presigned URL does not share its signature.
- Media Session `seekbackward` and `seekforward` clamp at both ends of the DVR
  window. A `currentTime` recorded before the window slid sat outside the
  range, and a one-sided clamp left the target outside it too.
- Playlist treats `tracks: []` as a supplied empty playlist rather than "no
  preference", so storage can no longer refill a list the host emptied;
  rejects a fractional persisted `currentIndex`, which passed the old `>= 0`
  test and then indexed nothing; and keeps a restored shuffle order that still
  covers every track instead of reshuffling a persisted session on every load.

Peer dependency ranges now state the version each package actually needs,
audited against core's and `ui`'s export surface at each release. Every plugin
declared `^1.8.0` while importing APIs added later, so a consumer could resolve
a core or `ui` old enough to be missing them:

- `ui` and `audio-ui` require core `^1.10.0` - the release adding the
  `SHARED_ICON_PATHS` and `formatTime` exports they import.
- `chapters`, `gestures`, `native`, `playlist` and `share` require core
  `^1.9.0`, which added `injectSharedStyles`, `ReleaseStyles` and
  `sanitizeUrl`.
- `chapters`, `playlist` and `share` require `ui` `^1.9.0` for their optional
  peer. They register controls with `registerControl(id, factory, { owner })`
  and release them with `unregisterControl(id, { owner })`; the options
  argument arrived in 1.9.0, and against 1.8.0 the registration is silently
  global - the multi-player bug the `owner` scope exists to prevent.
- `native` and `vue` declare `jsdom`, which their Vitest configs select as the
  test environment. It resolved only because pnpm satisfied Vitest's optional
  peer from another workspace package that did declare it.
