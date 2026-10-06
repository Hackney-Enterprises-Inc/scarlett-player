---
'@scarlett-player/chromecast': patch
---

`player.unload()` during a cast session now stops the media on the receiver (the session stays connected) and the receiver's state is no longer written back into the unloaded player.
