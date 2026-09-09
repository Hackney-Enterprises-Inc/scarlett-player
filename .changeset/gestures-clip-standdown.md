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

Stand the gesture surface down while a clip session is open.

**`@scarlett-player/gestures`**

- `syncSurface()` keyed on `mediaType` alone, so the full-bleed
  double-tap-to-seek layer stayed armed over an open clip editor — two features
  competing for the same finger on the one screen where both are touch-only.
  The surface is now torn down while `clipOpen` is true and rebuilt when the
  session closes, through the existing construct/destroy path.
- The key belongs to `@scarlett-player/clips` and is tracked from the state
  stream rather than read back, so a player with no clips plugin installed is
  unaffected.
