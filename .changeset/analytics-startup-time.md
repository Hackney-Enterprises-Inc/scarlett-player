---
'@scarlett-player/analytics': patch
---

`videoStart.startupTime` now measures the play request to the first frame.
Until now `playback:play` sent both `playRequest` and `videoStart` from one
handler, so `startupTime` was always about 0 ms and the QoE startup factor
always 100.

The request is the earliest of core's `play()` (`playback:play`) or the
`paused` state key going false (a control or autoplay calling `video.play()`
directly); the first frame is the view's first `playing: true`. The late
`playback:play` a provider emits for an element-driven start is not a second
request, and neither is the one it emits when a stall ends, so recovering from
a rebuffer no longer sends a `playRequest`. Startup buffering before the first
frame is no longer counted as a rebuffer.
