---
'@scarlett-player/native': patch
'@scarlett-player/playlist': patch
---

Stop the native provider's audio filename fallback from overwriting playlist track titles (#45).

The fallback claimed to only set the title "if one doesn't already exist" but never checked, so every audio load replaced the playlist's track title with the derived filename. The native provider now remembers which title it derived itself: it only writes a fallback when the title is empty or still its own previous fallback, and always respects an externally set title.

The playlist plugin now always writes the title on track change (empty when the track has none), so a previous track's title can no longer leak into a following untitled track; providers fill in the filename fallback for those.
