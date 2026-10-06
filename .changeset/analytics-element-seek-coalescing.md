---
'@scarlett-player/analytics': patch
---

Element seeks (native controls, or the browser seeking by itself) that follow each other within 2 seconds now send one `seeking` beacon and count once in `seekCount`, with at most 30 such beacons per view. Bursts still count in `seekCount` after the cap; the new `elementSeekCount` on heartbeats and `viewEnd` counts every non-echo element seek. Echoes of player seeks are excluded, so a seek storm no longer floods the beacons.
