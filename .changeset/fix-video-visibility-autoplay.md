---
"@scarlett-player/hls": patch
"@scarlett-player/native": patch
"@scarlett-player/embed": patch
---

fix: video visibility and muted autoplay for embed

- Fixed video not visible when container uses aspect ratio padding technique
  - Video element now uses `position: absolute` to properly fill the container
  - Affects HLS plugin, HLS light plugin, and native plugin
- Fixed autoplay with muted not working
  - Initial muted/volume state is now applied to video element before autoplay
  - Browsers require muted=true for autoplay to work without user interaction
