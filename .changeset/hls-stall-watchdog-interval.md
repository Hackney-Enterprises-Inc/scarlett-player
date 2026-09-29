---
"@scarlett-player/hls": patch
---

Fix the playback stall watchdog re-checking every ~15ms instead of every ~15s while playing. The target duration it re-arms on was computed in seconds but handed to `setTimeout` unconverted, so the interval cap of 30000 never applied and the watchdog spun continuously instead of polling on a sane cadence; stall detection itself (which compares against a millisecond threshold) was unaffected and still worked.
