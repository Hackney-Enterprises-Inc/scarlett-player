---
"@scarlett-player/hls": minor
---

On iOS and other native-HLS browsers, `autoStartLoad: false` now loads nothing until the viewer presses Play, an optional `nativePauseReleaseMs` stops a paused live stream from downloading, and a stalled native live stream is nudged to the live edge after 4 seconds; pausing no longer resets stall detection.
