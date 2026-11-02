---
'@scarlett-player/analytics': minor
---

Report why a view never played: a `playBlocked` beacon, a `startState` on `viewEnd` (`played`, `awaitingTap`, `failed`, `never`), and error beacons for failed plugin init and code-less errors that used to be dropped.
