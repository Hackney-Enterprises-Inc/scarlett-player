---
'@scarlett-player/hls': patch
---

A fatal `error` that auto-reconnect will recover from now carries `detail.reconnecting: true`, so listeners can tell it from a terminal failure; the event and its order are otherwise unchanged.
