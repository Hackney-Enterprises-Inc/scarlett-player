---
"@scarlett-player/ui": patch
"@scarlett-player/hls": minor
---

Replay restarts a finished stream at the start of its window instead of position 0 (on hls.js, the playlist's real start, which the HLS provider now reports through `getPlaylistStart()`), and reloads a live stream that stopped without ending so it rejoins the live edge.
