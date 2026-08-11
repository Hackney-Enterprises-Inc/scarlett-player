---
'@scarlett-player/core': minor
---

Add chapter markers, touch gestures and playlist skip controls.

- New `@scarlett-player/chapters` package: chapter list, seek-to-chapter, next/previous, and chapter dividers on the progress bar. Takes chapters inline or from a WebVTT chapters track.
- New `@scarlett-player/gestures` package: double-tap the left or right of the picture to seek, keep tapping to go further, tap the middle to toggle the controls. Touch only, so mouse behaviour is unchanged.
- Playlist gains `playlist-previous`, `playlist-next` and `playlist` controls, plus N and P shortcuts, so a viewer can skip a copyright card or preshow.
- The share button now uses the universal three-node icon and accepts `buttonIcon` and `buttonLabel` overrides.
