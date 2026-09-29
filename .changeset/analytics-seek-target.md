---
"@scarlett-player/analytics": patch
---

Fix the `seeking` beacon's `seekTo` reporting the position the seek started from instead of its target. Core emits `playback:seeking` with the target as `{ time }` before it updates `currentTime`, but the plugin read `currentTime` from state, so a resume seek to 19805 s was reported as `seekTo: 0.000002`. `seekTo` now comes from the event payload's `time`, falling back to the current state only when an emit carries no finite `time`.
