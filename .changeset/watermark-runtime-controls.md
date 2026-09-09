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

Fix the watermark runtime API, which the plugin's own anti-tamper observer had
been undoing.

**`@scarlett-player/watermark`**

- `setOpacity()` now sticks. The `MutationObserver` installed by `init()` wrote
  `element.style.opacity = String(opacity)` from the original config on every
  style mutation, so a runtime opacity was reverted on the next microtask.
  Opacity is runtime state now, and the observer restores the value the plugin
  last applied. The existing tests passed only because they asserted
  synchronously, before the observer callback ran; the new ones await it.
- `setPosition()`, `setPadding()` and `setImageHeight()` no longer reset
  opacity as a side effect — each of them writes inline styles, and every write
  triggered that same revert.
- The observer's style branch is scoped to the watermark element. It observes
  the player container with `subtree: true` (needed to catch the mark being
  removed), so a style write anywhere else under the container — the control
  bar animating, the progress bar, the clip range selector — was treated as
  tampering and re-asserted the config opacity. It also only writes a property
  when it differs, instead of queueing another mutation record for itself on
  every callback.
- `show()` / `hide()` do something. They only swapped `sp-watermark--visible` /
  `sp-watermark--hidden`, and no stylesheet in the repo defines either class,
  so the calls were inert and the mark was visible from `init()`. Visibility is
  now an inline `visibility` (the classes stay as consumer hooks), and the
  observer restores the tracked state rather than forcing the mark visible.
- **Behaviour change:** the documented lifecycle now actually happens — the
  mark is hidden until the first `playback:play` (after `showDelay`), stays
  visible while paused, and hides on `playback:ended`. A consumer who was
  seeing it over the poster will no longer see it there.
- README: the overlay stays visible while paused, which is what the code has
  always done; "hidden on pause" was wrong.
