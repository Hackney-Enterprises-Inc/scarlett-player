# Changelog

## 1.0.0

### Minor Changes

- [#1](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/1) [`553012a`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/553012ab5e2a29566fe1fb41190f717f76e936d6) Thanks [@alexhackney](https://github.com/alexhackney)! - Add multiple embed bundle variants for optimized CDN distribution
  - **embed.umd.cjs** - Standard video player with full HLS support
  - **embed.light.umd.cjs** - Light video player (~30% smaller, no subtitles/DRM/ID3)
  - **embed.full.umd.cjs** - Full bundle with analytics, playlist, and media-session plugins
  - **embed.audio.umd.cjs** - Audio player with audio-ui, playlist, and media-session
  - **embed.audio.light.umd.cjs** - Light audio player (~30% smaller)

  HLS plugin now exports a light build via `@scarlett-player/hls/light` using hls.js/light.

### Patch Changes

- Updated dependencies [[`553012a`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/553012ab5e2a29566fe1fb41190f717f76e936d6), [`d3e4da3`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d3e4da34ffbad8252f6bf9b7ef026b041421ce51)]:
  - @scarlett-player/hls@1.0.0
  - @scarlett-player/media-session@1.0.0
  - @scarlett-player/audio-ui@1.0.0
  - @scarlett-player/playlist@1.0.0
  - @scarlett-player/core@1.0.0
  - @scarlett-player/ui@1.0.0
  - @scarlett-player/analytics@1.0.0

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
