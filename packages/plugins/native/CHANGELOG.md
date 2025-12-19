# @scarlett-player/native

## 0.2.2

### Patch Changes

- [#17](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/17) [`eb51799`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/eb51799bbe60960cc380ddd57a215d11abe87610) Thanks [@alexhackney](https://github.com/alexhackney)! - fix: video visibility and muted autoplay for embed
  - Fixed video not visible when container uses aspect ratio padding technique
    - Video element now uses `position: absolute` to properly fill the container
    - Affects HLS plugin, HLS light plugin, and native plugin
  - Fixed autoplay with muted not working
    - Initial muted/volume state is now applied to video element before autoplay
    - Browsers require muted=true for autoplay to work without user interaction

- [#5](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/5) [`d3e4da3`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d3e4da34ffbad8252f6bf9b7ef026b041421ce51) Thanks [@alexhackney](https://github.com/alexhackney)! - Minor updates and QOL Fixes

- Updated dependencies []:
  - @scarlett-player/core@0.2.2
