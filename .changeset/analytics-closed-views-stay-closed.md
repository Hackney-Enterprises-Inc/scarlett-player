---
'@scarlett-player/analytics': patch
---

Once a view has sent its `viewEnd`, later errors, pauses, stalls, quality changes and page visibility changes no longer send beacons or change its counters, so a second fatal error no longer sends a second `viewEnd`.
