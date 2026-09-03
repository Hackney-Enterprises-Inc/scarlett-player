---
'@scarlett-player/hls': patch
---

Raises the `hls.js` peer floor to `^1.6.0`, and keeps `playbackState` honest
after a scrub away from the end.

The `hls.js` peer range was `^1.5.0` while the devDependency, the lockfile
(1.6.15) and every test in this package have been on 1.6 for the whole 1.7.x
line, and `@scarlett-player/embed` depends on `^1.6.0`. The floor now names the
version the plugin is actually built and tested against, so an installer
resolving 1.5 no longer looks supported.

`playbackState` used to stay at `'ended'` after a paused viewer scrubbed back
from the end: the `ended` handler wrote it and only `playing`, `pause` and
core's `load()` ever wrote it again. The handlers that clear the `ended` key
now re-derive `playbackState` from the element in the same breath, `'paused'`
or `'playing'` from `video.paused`. Both writes are gated on the key having
been set, so an ordinary mid-video seek restates neither. This is the same
disagreement between the element and the state key that the `ended` key itself
was fixed for in this release, and it is now fixed identically in
`@scarlett-player/native`, so the two providers write the key in one shape.
