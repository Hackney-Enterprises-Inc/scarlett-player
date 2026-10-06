---
'@scarlett-player/analytics': minor
---

A view now stays open while the player auto-reconnects: the failure is reported as a warning, the outage as `reconnecting` and `recovered` beacons and a rebuffer, and every view carries `reconnectCount` and `reconnectDuration`; only a reconnect that gives up or a terminal failure ends the view as `error`. `player.unload()` now ends the open view as `abandoned`.
