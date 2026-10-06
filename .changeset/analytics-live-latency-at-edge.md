---
'@scarlett-player/analytics': patch
---

`liveLatency*` now measures delivery latency at the live edge only: readings before the first frame, and readings while a viewer watches the DVR window after seeking back, are left out, and the time played back there is reported as a new `dvrTime` (ms) on live heartbeats and `viewEnd`.
