---
'@scarlett-player/core': patch
---

`setPoster()` and a `poster` getter.

`PlayerOptions.poster` could seed the poster and nothing could change it
afterwards, so a playlist moving from one track to the next left the previous
track's artwork on the element and a Vue `poster` prop change did nothing at
all. `setPoster(url)` writes the `poster` state key (an empty string clears
it) and both providers now subscribe to that key, so it takes effect on a
player that is already running. `checkDestroyed()` like every other method.

`load()` deliberately leaves `poster` alone, and the docblock says why: the
poster is metadata whoever set it owns, and it is written BEFORE the load it
belongs to, so clearing it on load would blank the image over exactly the gap
it exists to cover.
