---
"@scarlett-player/hls": minor
---

A load that times out (`loadTimeoutMs`) now hands off to auto-reconnect instead of ending in a dead-end error, even before the stream is known to be live, and both playback paths report it as `Video took too long to load (network timeout)` with `detail.timedOut`. The viewer's muted and volume settings are applied after every reconnect.
