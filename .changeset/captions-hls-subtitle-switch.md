---
'@scarlett-player/captions': minor
---

Captions: follow hls.js subtitle track switches so the player's caption state
stays in sync when hls.js or Safari changes the track.

An automatic rendition switch, or Safari's own subtitle menu, never routes
through `selectTrack()`, so `currentTextTrack` went stale and the UI kept a
checkmark on the wrong entry. The plugin now also listens for
`hlsSubtitleTrackSwitch` and re-reads the element's `textTracks` through the
existing single writer of that state. It deliberately does not write back to
`hlsInstance.subtitleTrack`: creating player-owned tracks for hls.js renditions
is what caused the duplicate-caption incident of 2026-08-10.
