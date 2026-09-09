---
'@scarlett-player/clips': patch
'@scarlett-player/hls': patch
'@scarlett-player/gestures': patch
'@scarlett-player/ui': patch
'@scarlett-player/watermark': patch
'@scarlett-player/core': patch
'@scarlett-player/embed': patch
'@scarlett-player/vue': patch
'@scarlett-player/native': patch
'@scarlett-player/airplay': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/analytics': patch
'@scarlett-player/playlist': patch
'@scarlett-player/media-session': patch
'@scarlett-player/audio-ui': patch
'@scarlett-player/captions': patch
'@scarlett-player/share': patch
'@scarlett-player/chapters': patch
---

Fixes from review of the clip-editing pass: guards that were written but never
took effect, and two classifications that believed stale evidence.

**`@scarlett-player/clips`**

- The exact-time field the viewer is editing is now re-rendered on Enter and
  Escape. `renderTimeFields()` skipped any focused input so as not to overwrite
  typing, but Enter and Escape are both handled with the input still focused -
  so the one field the viewer had just acted on was the one field never updated.
  Escape left the half-typed value on screen, a refused value stayed next to the
  notice rejecting it, and a committed value never showed the snapped, clamped
  time the endpoint actually landed on. Other fields are still left alone.
- The preview loop rewinds again when the out point is pinned at the media's
  duration. It asked `paused` state inside its `playback:ended` handler, and a
  media element that reaches its end sets `paused` and fires `pause` *before*
  `ended` - so state said "the viewer stopped" for every natural end and the
  rewind never ran. Playback intent is now tracked as playback happens, which
  still declines to restart a video the viewer paused and walked away from.
- `setInteractive(false)` now holds against the keyboard and the pointer.
  `tabindex="-1"` keeps a frozen handle out of tabbing but does not blur one
  that already had focus, and a focused element still receives keydown, so the
  range could be walked out from under a submission already carrying it. The
  freeze is enforced in the handlers rather than only in CSS and the tab order.
- The range toolbar buttons and the details Back button are 44px tall, matching
  the touch-target floor the other clip controls already used.

**`@scarlett-player/hls`**

- `mediaType` no longer inherits the previous source's frame size. The
  classifier attaches to a *reused* `<video>` before `attachMedia()`/
  `loadSource()` has replaced anything, so an audio-only source loaded after a
  video one arrived with `videoWidth` still measuring the old frame. Believing
  it was permanent: video evidence is sticky, so the manifest's `video: false`
  could no longer correct it, and an audio-only source stayed labelled `video`.
  Intrinsic dimensions now count only once the element has reported on the
  source now loading.

**`@scarlett-player/gestures`**

- The tap surface is built for `mediaType: 'video'`, not for anything that is
  not `'audio'`. `'unknown'` means "not established yet": an audio-only source
  the classifier cannot prove (native HLS where the browser ships no track
  lists) stays unknown for its whole life, and was getting a full-bleed tap
  surface over the audio UI. Nothing is lost by waiting - the surface is built
  the moment the source is confirmed as video.

**`@scarlett-player/ui`**

- The progress handle stops growing on hover while a timeline extension owns the
  pointer. The `--ext-dragging` rule sat above the `:hover` rule it was meant to
  beat and at lower specificity, and an extension drag is a pointer drag, so the
  hover rule always won and the override never applied.

**`@scarlett-player/watermark`**

- `playback:ended` cancels a pending `showDelay`. The handler hid the watermark
  but left the timer armed, so media shorter than the delay ended hidden and
  then went visible - and, with `dynamic` on, started repositioning itself over
  a finished player.
