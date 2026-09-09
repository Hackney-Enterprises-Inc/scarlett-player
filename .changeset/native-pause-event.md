---
'@scarlett-player/core': patch
'@scarlett-player/embed': patch
'@scarlett-player/vue': patch
'@scarlett-player/hls': patch
'@scarlett-player/ui': patch
'@scarlett-player/native': patch
'@scarlett-player/airplay': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/analytics': patch
'@scarlett-player/playlist': patch
'@scarlett-player/media-session': patch
'@scarlett-player/audio-ui': patch
'@scarlett-player/captions': patch
'@scarlett-player/watermark': patch
'@scarlett-player/share': patch
'@scarlett-player/chapters': patch
'@scarlett-player/gestures': patch
'@scarlett-player/clips': patch
---

Emit `playback:pause` from the native provider's media element.

**`@scarlett-player/native`**

- The `pause` handler wrote state and emitted nothing, so a pause the viewer
  made through the play button, the keyboard or the browser's native controls
  never reached the bus — only `ScarlettPlayer.pause()` did. Analytics,
  media-session, chromecast and the clips preview all read that event.
- Deduped against core-issued commands with `isCorePauseRequested`, mirroring
  the `isCorePlayRequested` guard the play path has always had, and a pause
  command on an already-paused element now returns before arming it.
