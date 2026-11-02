---
'@scarlett-player/core': minor
---

Add a `playback:blocked` event, emitted when the browser's autoplay policy refuses a play request, so a view waiting for a tap can be told apart from a failed or offline stream.
