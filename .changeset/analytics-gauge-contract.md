---
'@scarlett-player/analytics': patch
---

viewEnd beacons declare their gauge units with `gaugeScale: 'percent'` and keep the released percentage meaning. `completionRate` and `rebufferRatio` are finite and bounded to 0..100; a completion with no known finite duration is null (was 0), live views stay null, and non-finite positions or durations can no longer reach the wire or overwrite the last known good pair. Raw counters are unchanged.
