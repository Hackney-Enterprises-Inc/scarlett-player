# Changelog

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
