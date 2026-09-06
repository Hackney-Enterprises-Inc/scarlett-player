---
'@scarlett-player/airplay': patch
'@scarlett-player/analytics': patch
'@scarlett-player/audio-ui': patch
'@scarlett-player/captions': patch
'@scarlett-player/chapters': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/gestures': patch
'@scarlett-player/hls': patch
'@scarlett-player/media-session': patch
'@scarlett-player/native': patch
'@scarlett-player/playlist': patch
'@scarlett-player/share': patch
'@scarlett-player/vue': patch
'@scarlett-player/watermark': patch
---

Peer dependency ranges now name the current major line: `@scarlett-player/core`
and `@scarlett-player/ui` move from `^1.7.0` to `^1.8.0` in the Vue wrapper and
in every plugin that had not already been bumped, leaving the whole fixed
version group asking for one range. Nothing was resolving wrongly before, since
`^1.7.0` already admits 1.8.0, but the declared floor now matches the version
these packages are actually built and tested against rather than trailing a
release behind it.
