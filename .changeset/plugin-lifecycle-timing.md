---
'@scarlett-player/playlist': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
'@scarlett-player/hls': minor
---

Playlist: validate persisted state, respect caller tracks, stop double-arming
auto-advance and carry an explicit autoplay intent. Chapters: load `config.src`
once a media element exists. Gestures: follow `mediaType` changes. HLS: remove
the unused `shouldPreferNativeHLS` helper.

**Playlist**

- Restored state is validated. Storage is untrusted input - another tab, an
  older release, a hand-edited key - and a non-array `tracks`, entries without a
  `src`, an out-of-range `currentIndex` or an unknown `repeat` mode were all
  restored as-is.
- A caller that supplied `config.tracks` now keeps them. Storage silently
  overrode them, so two players sharing a `persistKey` could replace each
  other's list.
- Auto-advance clears a pending timer before arming the next one. Two `ended`
  events inside `advanceDelay` armed two timers and loaded the track twice.
- `setCurrentTrack` takes an explicit `{ autoplay }`. Auto-advance passes
  whether playback was actually running, so a paused playlist no longer starts
  playing on its own; manual selection still passes `true`.

**Chapters**

`config.src` was attached during `init()`, and the WebVTT loader returns a no-op
cleanup and never retries when the container has no media element yet. A
provider that had not attached its element lost its chapters permanently. The
attach is now retried on `media:loadedmetadata`, and is idempotent.

**Gestures**

`mediaType` was sampled once during `init()`, where it still defaults to
`'unknown'`, so an audio source that loaded a moment later kept a tap surface
over an audio player. The surface is now built and torn down as `mediaType`
changes, and `ownsTapInteraction()` follows the surface rather than the enabled
flag.
