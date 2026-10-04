---
"@scarlett-player/hls": patch
---

Live streams no longer stall when scrubbed to the very end: a seek on live now stops at the live sync position (a safe distance behind the live edge), so dragging the progress bar to the end lands at live and keeps playing. On native Safari playback, a live seek no longer jumps to 0 when the stream reports no duration. VOD seeking is unchanged.
