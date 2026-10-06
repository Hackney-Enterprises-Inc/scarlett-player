---
'@scarlett-player/analytics': patch
---

`playTime` no longer counts time while the player is not actually playing: a play request that never reaches its first frame, or playback stopped by a `load()` without autoplay, used to keep accruing play time and kept the view from ever reaching `idleTimeout`.
