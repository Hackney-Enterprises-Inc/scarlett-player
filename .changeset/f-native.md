---
'@scarlett-player/native': patch
---

Re-applies the poster whenever it changes.

The provider set `video.poster` when it created the element and on each
`loadSource()`, but nothing re-applied it in between, so `setPoster()`, a
playlist track change and a Vue prop change were all invisible to the viewer.
One `applyPoster()` now serves element creation, `loadSource()` and a
`subscribeToState()` subscription released through `api.onDestroy()`.

An empty poster clears the attribute rather than being skipped, so a track
without artwork can no longer inherit the previous one's image. The audio rule
is unchanged and now holds against state changes too: while the current source
is audio the attribute stays cleared whatever the poster says.

First tests to assert `video.poster` on this provider at all.
