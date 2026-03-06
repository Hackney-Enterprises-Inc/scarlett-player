# Changelog

## 1.0.2

### Patch Changes

- Updated dependencies [[`e2d5469`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/e2d54691f9b5297ce564c4089bb7c05482a3269d)]:
  - @scarlett-player/watermark@1.0.2
  - @scarlett-player/core@1.0.2
  - @scarlett-player/hls@1.0.2
  - @scarlett-player/ui@1.0.2
  - @scarlett-player/analytics@1.0.2
  - @scarlett-player/playlist@1.0.2
  - @scarlett-player/media-session@1.0.2
  - @scarlett-player/audio-ui@1.0.2
  - @scarlett-player/captions@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`8a36597`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8a365974bb67fa7ea945a3f2594112ac27cd75f4)]:
  - @scarlett-player/playlist@1.0.1
  - @scarlett-player/core@1.0.1
  - @scarlett-player/hls@1.0.1
  - @scarlett-player/ui@1.0.1
  - @scarlett-player/analytics@1.0.1
  - @scarlett-player/media-session@1.0.1
  - @scarlett-player/audio-ui@1.0.1
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/watermark@1.0.0

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
  - @scarlett-player/playlist@1.0.0
  - @scarlett-player/hls@1.0.0
  - @scarlett-player/watermark@1.0.0
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/analytics@1.0.0
  - @scarlett-player/audio-ui@1.0.0
  - @scarlett-player/media-session@1.0.0
  - @scarlett-player/ui@1.0.0

## 0.5.3

### Patch Changes

- Bug fixes, stability improvements, and live DVR wiring

  **Bug Fixes:**
  - Fix MIME type detection for URLs with query params/fragments (e.g., `video.m3u8?token=abc`)
  - Fix spinner stuck on screen — `playing` event handler now clears `waiting` and `buffering` states
  - Fix `setPlaybackRate()` accepting invalid values — now clamped to 0.0625–16 range
  - Fix `setQuality()` accepting out-of-bounds indices — now validates against available quality levels
  - Fix analytics memory leak — cap `errors` array at 100 and `bitrateHistory` at 500 entries for long sessions
  - Fix HLS error test expecting `logger.warn` for fatal errors (should be `logger.error`)
  - Fix demo page crash when `getState` called before player initialization

  **Live DVR:**
  - Wire up `seekableRange`, `liveEdge`, and `liveLatency` state in HLS plugin — existing UI controls (LiveIndicator, ProgressBar DVR, TimeDisplay, SkipButton) now receive live stream data

  **Dependencies:**
  - Remove unused `hls.js` dependency from `@scarlett-player/core`
  - Align `hls.js` versions: embed and HLS plugin dev dep updated to `^1.6.0`, peer dep to `^1.5.0`

  **Docs:**
  - Update README roadmap — mark captions and mobile gestures as planned (Sprint 1), add Sprint 2/3 items
  - Update CHANGELOG with entries for versions 0.3.0 through 0.5.2
  - Update package version table to 0.5.2

- Updated dependencies []:
  - @scarlett-player/core@0.5.3
  - @scarlett-player/hls@0.5.3
  - @scarlett-player/analytics@0.5.3
  - @scarlett-player/audio-ui@0.5.3
  - @scarlett-player/media-session@0.5.3
  - @scarlett-player/playlist@0.5.3
  - @scarlett-player/ui@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471)]:
  - @scarlett-player/core@0.5.2
  - @scarlett-player/ui@0.5.2
  - @scarlett-player/analytics@0.5.2
  - @scarlett-player/audio-ui@0.5.2
  - @scarlett-player/hls@0.5.2
  - @scarlett-player/media-session@0.5.2
  - @scarlett-player/playlist@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1
  - @scarlett-player/ui@0.5.1
  - @scarlett-player/analytics@0.5.1
  - @scarlett-player/audio-ui@0.5.1
  - @scarlett-player/hls@0.5.1
  - @scarlett-player/media-session@0.5.1
  - @scarlett-player/playlist@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
  - @scarlett-player/ui@0.5.0
  - @scarlett-player/hls@0.5.0
  - @scarlett-player/analytics@0.5.0
  - @scarlett-player/playlist@0.5.0
  - @scarlett-player/media-session@0.5.0
  - @scarlett-player/audio-ui@0.5.0

All notable changes to the @scarlett-player/embed package will be documented in this file.

## [0.1.0] - 2025-12-14

### Added

- Initial release of the embed package
- Auto-initialization via data attributes (`data-scarlett-player`)
- Global API (`window.ScarlettPlayer`) for programmatic control
- Support for all common configuration options via data attributes:
  - `data-src` - Video source URL
  - `data-autoplay` - Auto-play on load
  - `data-muted` - Start muted
  - `data-poster` - Poster image
  - `data-controls` - Show/hide UI
  - `data-brand-color` - Custom branding
  - `data-aspect-ratio` - Responsive sizing
  - And many more...
- UMD bundle for CDN/script tag usage
- ES module bundle for modern bundlers
- iframe embed helper page with URL parameter support
- TypeScript type definitions
- Comprehensive demo page with 5+ examples
- Full documentation and setup guide

### Features

- **Self-contained Bundle**: Includes core, HLS, and UI plugins
- **Multi-tenant Support**: Easy branding via color attributes
- **Auto-initialization**: Finds and initializes all players on page load
- **Programmatic API**: Create and control players with JavaScript
- **iframe Support**: Helper page for secure iframe embeds
- **Keyboard Shortcuts**: Built-in keyboard navigation
- **Responsive**: Aspect ratio support for responsive layouts
- **TypeScript**: Full type definitions included

### Bundle Output

- `embed.js` - ES module (~260KB minified, ~85KB gzipped)
- `embed.umd.cjs` - UMD bundle for script tags
- `embed.d.ts` - TypeScript definitions
- Source maps for both bundles

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

### Dependencies

- @scarlett-player/core ^0.1.0
- @scarlett-player/hls ^0.1.0
- @scarlett-player/ui ^0.1.0
- hls.js ^1.5.0

### Notes

This is the first release designed for The Stream Platform's multi-tenant live streaming service. The package provides both declarative and programmatic APIs for maximum flexibility in different embedding scenarios.
