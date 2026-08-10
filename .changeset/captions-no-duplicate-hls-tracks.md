---
'@scarlett-player/captions': patch
---

Captions no longer appear twice for HLS subtitle renditions.

`extractHlsSubtitles()` appended a `<track>` element for every entry in `hls.subtitleTracks`. hls.js already owns those: with `renderTextTracksNatively` (its default) it creates a `TextTrack` per rendition and fetches and parses the VTT segments itself, so they are in the video's `TextTrackList` before this plugin runs. `syncTracksToState()` reads that list wholesale, so every rendition was counted twice and the viewer saw two identical "English" options.

The copy we added was also the broken one. `HlsSubtitleTrack.url` is the rendition **playlist** (`subs/en.m3u8`), and a `<track>` element can only parse WebVTT, so it loaded and produced no cues. Measured in production on a premium HLS asset:

```
0 'English' 'disabled' undefined   <- ours
1 'English' 'showing'  110         <- hls.js's
```

Whichever landed first was a coin flip, so roughly half the time selecting "English" appeared to do nothing.

`extractHlsSubtitles()` now only calls `syncTracksToState()` and `maybeAutoSelect()`. `addTrackElement()` is unchanged for externally configured `sources`, which are real `.vtt` URLs and remain this plugin's to manage — the per-origin bookkeeping that existed solely to replace rendition tracks (`hlsTrackElements`, `removeHlsTrackElements()`, the `origin` parameter) is gone with them.

No API change. Hosts passing `sources` are unaffected; hosts relying on in-manifest subtitles get one entry per rendition instead of two.
