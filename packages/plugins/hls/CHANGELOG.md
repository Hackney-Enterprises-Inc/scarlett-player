# @scarlett-player/hls

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

- Updated dependencies []:
  - @scarlett-player/core@1.0.0
