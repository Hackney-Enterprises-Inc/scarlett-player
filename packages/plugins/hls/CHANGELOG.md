# @scarlett-player/hls

## 0.2.2

### Patch Changes

- [#1](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/1) [`553012a`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/553012ab5e2a29566fe1fb41190f717f76e936d6) Thanks [@alexhackney](https://github.com/alexhackney)! - Add multiple embed bundle variants for optimized CDN distribution
  - **embed.umd.cjs** - Standard video player with full HLS support
  - **embed.light.umd.cjs** - Light video player (~30% smaller, no subtitles/DRM/ID3)
  - **embed.full.umd.cjs** - Full bundle with analytics, playlist, and media-session plugins
  - **embed.audio.umd.cjs** - Audio player with audio-ui, playlist, and media-session
  - **embed.audio.light.umd.cjs** - Light audio player (~30% smaller)

  HLS plugin now exports a light build via `@scarlett-player/hls/light` using hls.js/light.

- [#17](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/17) [`eb51799`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/eb51799bbe60960cc380ddd57a215d11abe87610) Thanks [@alexhackney](https://github.com/alexhackney)! - fix: video visibility and muted autoplay for embed
  - Fixed video not visible when container uses aspect ratio padding technique
    - Video element now uses `position: absolute` to properly fill the container
    - Affects HLS plugin, HLS light plugin, and native plugin
  - Fixed autoplay with muted not working
    - Initial muted/volume state is now applied to video element before autoplay
    - Browsers require muted=true for autoplay to work without user interaction

- Updated dependencies []:
  - @scarlett-player/core@0.2.2
