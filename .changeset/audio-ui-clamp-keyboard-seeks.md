---
'@scarlett-player/audio-ui': patch
---

Clamp progress-bar keyboard seeks (ArrowLeft, ArrowRight, Home, End) into the active live DVR window, so a stale `currentTime` reported outside `seekableRange` can no longer produce a seek outside it.
