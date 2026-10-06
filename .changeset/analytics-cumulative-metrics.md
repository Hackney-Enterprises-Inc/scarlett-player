---
'@scarlett-player/analytics': minor
---

Heartbeats now include pause, seek, error and quality counters and maximum bitrate; page-unload `viewEnd` includes the same metrics and scores as a normal `viewEnd`, including completion. `pauseDuration` includes a pause still in progress, final average bitrate is current between heartbeats, and `maxBitrate`/`avgBitrate` are `null` instead of `0` until the player reports a positive bitrate.
