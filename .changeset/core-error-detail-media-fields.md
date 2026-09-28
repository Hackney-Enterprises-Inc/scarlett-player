---
'@scarlett-player/core': patch
---

`PlayerErrorDetail` now declares the optional `mediaErrorCode`, `mediaErrorMessage` and `timedOut` fields that the HLS provider's native path sets, so TypeScript hosts can read them from `PlayerError.detail` without a cast.
