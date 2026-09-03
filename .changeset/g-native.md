---
'@scarlett-player/native': patch
---

Clears the `ended` state key when playback leaves the end of the media.

The `ended` handler set the key true and nothing in the provider ever set it
back: the only writer that cleared it was core's `load()`. After one replay it
stayed true for the rest of the session while `HTMLMediaElement.ended` was
false, so the control bar's play button kept the Replay glyph over playing
video (the reason `@scarlett-player/ui`'s big play button reads `video.ended`
instead of the key).

The `play`, `playing` and `seeking` handlers now mirror the element's own flag
back onto the key, which covers the three ways the position can leave the end:
`play()` rewinds an ended element before firing `play`, the first frame fires
`playing`, and a paused viewer scrubbing back from the end fires neither. The
element is asked rather than assumed, so a seek that lands on the end leaves
the key set; writing it true stays the `ended` handler's job.
