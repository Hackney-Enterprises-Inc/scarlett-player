---
'@scarlett-player/analytics': minor
---

A live stream that ends now reports exitType `liveEnded` instead of `completed`, and live views report `completionRate: null` however they end, since a position in a sliding window is not a completion.
