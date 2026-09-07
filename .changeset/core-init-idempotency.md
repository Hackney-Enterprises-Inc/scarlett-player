---
'@scarlett-player/core': minor
---

Core: `init()` no longer reloads `initialSrc` on a second call, and
`StateManager.define()` warns on a conflicting redefinition.

- `init()` documented itself as idempotent while unconditionally reloading
  `initialSrc`, so a second `init()` clobbered active playback, and an
  `init()` after a host's own `load()` replaced the source the host asked for.
  The initial load now happens once, and a `load()` of any kind claims the
  source.
- `define()` returned silently when a key already existed. Two plugins
  claiming one key with different defaults produced diverging state with no
  diagnostic. The first definition still wins - unchanged behaviour - but a
  conflicting default is now reported.
