---
'@scarlett-player/hls': patch
---

Applies the poster on every load, and when it changes.

The provider set `video.poster` once, when it created the element, and never
again. The attribute survives an `src` change, so a playlist moving from a
copyright pre-roll to the feature kept showing the pre-roll's frame over the
gap, and `setPoster()` plus the Vue `poster` prop did nothing. One
`applyPoster()` now serves element creation, the top of `loadSource()` and a
`subscribeToState()` subscription released through `api.onDestroy()`; an empty
poster clears the attribute.

First tests to assert `video.poster` on this provider at all.
