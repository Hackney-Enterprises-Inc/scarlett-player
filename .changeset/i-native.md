---
'@scarlett-player/native': patch
---

Writes `playbackState` during ordinary playback, the way the HLS provider does.

This provider only ever wrote `'loading'` and `'ready'`: `playing`, `pause` and
`ended` left the key at whatever the last load had set, so what a reader of
`playbackState` saw depended on which provider happened to be playing. The
three handlers now write `'playing'`, `'paused'` and `'ended'`, the values
`@scarlett-player/hls` has always written from the same events.

The handlers that clear the `ended` key (`play`, `playing` and `seeking`) also
re-derive `playbackState` from the element, `'paused'` or `'playing'` from
`video.paused`, so a paused scrub away from the end does not leave the key at
`'ended'`. Both writes are gated on the key having been set, so an ordinary
mid-video seek restates neither.

The shipped readers are almost unmoved by this: the error overlay only asks
whether the key is `'error'` or `'loading'`, and the big play button's
`'idle'`/`'ready'` test is reached only while nothing has played yet and the
position is 0, which the `'playing'` and `'ended'` writes and the two
scrub writes cannot be. The one case it does move is a `pause` in that same
window (a `play()` cancelled before the first frame), where the button now
stands down instead of staying up, which is what the HLS provider has always
done there.
