---
'@scarlett-player/playlist': patch
---

Writes the poster on every track change, empty when the track has no artwork.

The write was conditional on `track.artwork`, so a track without any kept the
PREVIOUS track's image on the media element: the same leak that was fixed for
titles in #45, and the rule is now the same for both. The providers read an
empty value as "clear the attribute".
