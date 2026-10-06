---
'@scarlett-player/whep': patch
---

A fatal `error` that the provider will attempt to recover from now carries `detail.reconnecting: true`, so listeners can tell it from a terminal failure; destroying or replacing the source from an error listener no longer leaves a reconnect timer behind.
