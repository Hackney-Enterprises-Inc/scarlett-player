---
'@scarlett-player/core': patch
'@scarlett-player/native': patch
---

Error `detail` gains optional `reconnecting`, `networkState` and `readyState` fields, and the native provider's media element errors now report `mediaErrorCode`, `networkState` and `readyState` in `detail`.
