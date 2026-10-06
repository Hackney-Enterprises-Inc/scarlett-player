---
'@scarlett-player/core': minor
'@scarlett-player/vue': minor
'@scarlett-player/embed': minor
---

New `player.unload()` leaves the current source without destroying the player: it stops any load in progress, tears down the provider (a WHEP stream closes its connection and stops retrying), resets the player to its empty state and emits `source:unloaded`, ready for the next `load()`. Available on the Vue component and `useScarlettPlayer()`, and on the player the embed's `ScarlettPlayer.create()` returns.
