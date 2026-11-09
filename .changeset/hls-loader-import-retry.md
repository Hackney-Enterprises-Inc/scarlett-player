---
'@scarlett-player/hls': patch
---

Playback no longer fails on a single flaky hls.js download: the library load is retried once after a short delay before reporting an error.
