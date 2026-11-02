---
"@scarlett-player/hls": minor
---

A playback stall that outlasts the new `stallTimeoutMs` (default 120 s, 0 disables) now ends in a fatal error with `detail.stalled: true` instead of rebuffering silently, a seek that never ends (no segment arriving) now counts as a stall, and the stall watchdog no longer fires while the tab is hidden or the browser is offline.
