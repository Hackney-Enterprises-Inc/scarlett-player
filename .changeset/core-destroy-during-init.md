---
'@scarlett-player/core': patch
---

Switching source (or unloading) while a provider was still initialising no longer leaves that provider running with its listeners attached: the teardown now waits for the init to finish and then destroys it once. If initialization fails, its registered cleanups still run so listeners are removed. `player.destroy()` does not wait for a plugin that is still initialising; that plugin is destroyed when its init finishes.
