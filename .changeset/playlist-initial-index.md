---
'@scarlett-player/playlist': patch
---

Add `initialIndex` config option to playlist plugin. When tracks are provided via config and the player loads the first source through the constructor, `initialIndex` syncs the playlist's internal state so auto-advance works correctly (track 0 → track 1 instead of replaying track 0).
