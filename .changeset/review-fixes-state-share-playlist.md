---
'@scarlett-player/core': minor
'@scarlett-player/share': minor
'@scarlett-player/media-session': minor
'@scarlett-player/playlist': minor
'@scarlett-player/ui': minor
'@scarlett-player/audio-ui': minor
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
- `ui` and `audio-ui` require `@scarlett-player/core` `^1.10.0`, the release
  that adds the `SHARED_ICON_PATHS` and `formatTime` exports they import.
