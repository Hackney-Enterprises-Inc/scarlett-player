# @scarlett-player/captions

## 1.3.0

### Minor Changes

- [#57](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/57) [`0796a44`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0796a4477bdfd804d2e76468d42a0046a8da3a4f) Thanks [@alexhackney](https://github.com/alexhackney)! - Captions now work on native HLS and no longer race the manifest.

  Subtitle renditions are picked up from hls.js via its `hlsSubtitleTracksUpdated` event instead of a blind 500ms `setTimeout`, so slow manifests no longer lose their tracks. The previous unsubscribe path referenced a handler that was never assigned and used the enum key `SUBTITLE_TRACKS_UPDATED` rather than the value hls.js emits, so it could never have matched; both are fixed, and repeated events now replace the derived `<track>` elements instead of appending duplicates.

  On the native HLS path (Safari and iOS), extraction previously returned early and nothing synced the track list, leaving `textTracks` empty and the captions button hidden even though the browser had parsed the renditions itself. The plugin now observes the video's `TextTrackList` and syncs once on load, so browser-created tracks reach player state and become selectable. Selection made outside the player — Safari's own subtitle menu — is reflected back into state too.

  Auto-select is now applied at most once per media item, and stands down entirely when a track is already showing — so a selection made outside the player, such as from Safari's own subtitle menu, is never replaced with the default language.

## 1.2.0

## 1.1.1

## 1.1.0

## 1.0.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.2

## 1.0.0

### Minor Changes

- [#35](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/35) [`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7) Thanks [@alexhackney](https://github.com/alexhackney)! - Automatic playlist loading, Chromecast playlist support, AirPlay improvements, watermark and captions plugins

  **Core:**
  - Added `media:load-request` event for plugins to request media loading without direct `player.load()` access
  - Promoted playlist events (`playlist:change`, `playlist:add`, `playlist:remove`, `playlist:clear`, `playlist:shuffle`, `playlist:repeat`, `playlist:reorder`, `playlist:ended`) to core `PlayerEventMap`
  - Added minimal `PlaylistTrack` interface to core types
  - Core player listens for `media:load-request` and routes load to local player (skips when Chromecast is active)

  **Playlist:**
  - New `autoLoad` config option (default: `true`) — automatically emits `media:load-request` on track change, eliminating the need for manual `player.load()` wiring
  - New `advanceDelay` config option — milliseconds to wait before auto-advancing to next track
  - Removed all `as any` casts from event emissions (events now typed in core)

  **Chromecast:**
  - Detects media-ended on Cast device via `isMediaLoaded` state transition (true → false), emitting `playback:ended` so playlists auto-advance during casting
  - Listens for `media:load-request` to load new media on Cast device when Chromecast is active
  - Registered `IS_MEDIA_LOADED_CHANGED` event listener for reliable detection

  **HLS:**
  - Forces native HLS when AirPlay is active during `loadSource()`, preventing hls.js from interfering with wireless playback

  **AirPlay:**
  - Automatically switches back to hls.js when AirPlay disconnects, restoring quality control

  **Watermark (NEW):**
  - Anti-piracy watermark overlay plugin with text or image rendering
  - Configurable position, opacity, font size
  - Dynamic repositioning mode (moves to random position periodically)
  - Configurable show delay
  - Per-track watermark updates via playlist metadata (`watermarkUrl`, `watermarkText`)

  **Captions (NEW):**
  - WebVTT subtitle/caption plugin using browser-native `<track>` element rendering
  - External WebVTT source loading
  - HLS.js subtitle track extraction
  - Track selection via existing `track:text` event (works with CaptionsButton and SettingsMenu)
  - Auto-select with configurable default language
  - Automatic cleanup on source change

  **Embed:**
  - Added watermark and captions plugins to full and video embed builds

  **Breaking Change Note:**
  Existing consumers that manually wire `playlist:change` to `player.load()` will get double-loads when `autoLoad` is `true` (the new default). Set `autoLoad: false` to preserve the previous manual behavior, or remove the manual wiring.

### Patch Changes

- Updated dependencies [[`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7)]:
  - @scarlett-player/core@1.0.0
