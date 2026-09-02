---
'@scarlett-player/core': patch
---

`load()` now initialises the player, and `player:ready` can be observed.

`new ScarlettPlayer(...)` followed by `load()` (the shape shown in the
READMEs and in a dozen plugin `@example` blocks) used to leave the player
with a provider and nothing else: non-provider plugins were never
initialised and the `media:load-request` and `error:retry` listeners were
never wired, so the controls, the error overlay's "Try Again" and playlist
track loading were all dead. `init()` and `load()` now share one idempotent,
re-entrancy-safe initialisation pass: plugins still in the `registered`
state are initialised (so a `registerPlugin()` after start-up is picked up
by the next call), the two listeners are wired exactly once, and providers
keep their lazy per-source initialisation.

`player:ready` moved out of the constructor, where it was emitted before any
consumer or plugin could subscribe and therefore could never be observed. It
is emitted once, at the end of the first initialisation, to listeners
attached before `init()` or `load()`.

Also pins `emptyOutDir: false` in the Vite config: the build is
`tsc && vite build`, so emptying `dist` would delete the declarations that
`types` and every plugin's tsconfig `paths` point at.
