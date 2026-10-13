---
"@scarlett-player/core": patch
---

`unload()`, and `load()` switching to a different provider, no longer hang when the old provider's `init()` or `destroy()` never settles: after 10 seconds the player logs a warning, cuts the old provider off (its listeners, state writes and media element) and goes ahead.
