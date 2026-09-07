---
'@scarlett-player/audio-ui': patch
---

Bounds keyboard seeks on the audio progress bar to the live DVR window: when `live` is true and a `seekableRange` is reported, ArrowLeft/ArrowRight/Home/End clamp to the window instead of `[0, duration]` (which stays the fallback when no window is available). Home and ArrowLeft no longer target a time before the live window start, and End rides the window edge rather than the infinite duration a live stream reports.
