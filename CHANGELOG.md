# Changelog

All notable changes to the Scarlett Player project will be documented in this file.

This project uses [Changesets](https://github.com/changesets/changesets) for version management. All packages are versioned together (fixed versioning).

## [0.2.0] - 2024-12-18

### Added

#### New Packages
- **@scarlett-player/playlist** - Playlist management plugin
  - Queue management (add, remove, insert, reorder)
  - Shuffle mode with Fisher-Yates algorithm
  - Repeat modes (none, one, all)
  - Auto-advance to next track
  - LocalStorage persistence
  - 74 tests with full coverage

- **@scarlett-player/media-session** - Media Session API plugin
  - Lock screen controls on mobile devices
  - Notification center playback controls
  - Hardware media key support (play/pause/next/prev)
  - Album art and track info in system media UI
  - Seek bar with position state
  - 44 tests with full coverage

- **@scarlett-player/audio-ui** - Compact audio player interface
  - Album artwork display
  - Track title and artist
  - Progress bar with seek
  - Play/pause, next/previous controls
  - Volume control
  - Shuffle/repeat buttons (integrates with playlist plugin)
  - Multiple layout modes (full, compact, mini)
  - Customizable theming
  - 53 tests with full coverage

#### Enhancements
- **@scarlett-player/native** - Extended to support audio formats
  - Added MP3, WAV, OGG, FLAC, AAC, M4A, Opus, WEBA support
  - Renamed from "Native Video Provider" to "Native Media Provider"

### Changed
- Updated documentation (README.md) with new packages
- Updated website (docs/index.html) with new features and packages
- Updated changeset config for fixed versioning of all 11 packages

## [0.1.0] - 2024-12-14

### Added

#### Core Packages
- **@scarlett-player/core** - Core player engine
  - Plugin architecture with lifecycle management
  - Reactive state management with signals
  - Type-safe event bus with 60+ events
  - Logger with configurable levels
  - Error handler with error classification
  - 457 tests with 97%+ coverage

- **@scarlett-player/hls** - HLS playback provider
  - hls.js integration for cross-browser HLS support
  - Native Safari HLS fallback
  - Quality level selection
  - ABR (Adaptive Bitrate) support
  - 127 tests (113 passing, 14 browser-specific skipped)

- **@scarlett-player/native** - Native video provider
  - MP4, WebM, MOV, MKV, OGV support
  - Browser capability detection
  - 19 tests

- **@scarlett-player/ui** - UI controls plugin
  - Play/pause button
  - Progress bar with seek
  - Volume control with mute
  - Time display (current/duration)
  - Fullscreen toggle
  - Picture-in-Picture button
  - Quality menu
  - Live indicator
  - Keyboard shortcuts (Space, M, F, arrows)
  - Customizable theming

- **@scarlett-player/airplay** - AirPlay casting
  - Safari AirPlay integration
  - Automatic button visibility based on support
  - 20 tests

- **@scarlett-player/chromecast** - Chromecast casting
  - Google Cast SDK integration
  - Session management
  - Remote playback control
  - 39 tests

- **@scarlett-player/vue** - Vue 3 component wrapper
  - Composition API composable (`useScarlettPlayer`)
  - Full TypeScript support
  - Reactive state bindings

- **@scarlett-player/embed** - CDN embed script
  - Auto-initialization via data attributes
  - Global API for programmatic control
  - UMD and ES module bundles
  - iframe embed support

### Browser Support
- Chrome/Edge 80+
- Firefox 78+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

---

## Package Versions

All packages follow fixed versioning - they share the same version number:

| Package | Current Version |
|---------|-----------------|
| @scarlett-player/core | 0.2.0 |
| @scarlett-player/hls | 0.2.0 |
| @scarlett-player/native | 0.2.0 |
| @scarlett-player/ui | 0.2.0 |
| @scarlett-player/audio-ui | 0.2.0 |
| @scarlett-player/airplay | 0.2.0 |
| @scarlett-player/chromecast | 0.2.0 |
| @scarlett-player/playlist | 0.2.0 |
| @scarlett-player/media-session | 0.2.0 |
| @scarlett-player/vue | 0.2.0 |
| @scarlett-player/embed | 0.2.0 |

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
