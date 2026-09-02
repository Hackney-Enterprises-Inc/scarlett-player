---
'@scarlett-player/ui': patch
---

Big play button over the poster, on by default.

A poster with no visible play affordance is worse for the viewer than no
poster: on desktop a click on the picture only revealed the control bar
(touch taps belong to `@scarlett-player/gestures`), so the only way to start a
video was the small button in the bar. `BigPlayButton` is a real `<button>`
with an `aria-label`, rendered into the container like the error overlay,
sized past the control bar's 44 px minimum target and coloured with
`--sp-accent`.

It is visible before playback starts and again as Replay when playback ends,
hidden from the first `playing` onward, hidden while the source is loading
(the spinner owns that state) and while an error is set or the error overlay
is showing. It updates from the same `scheduleUpdate()` pass as every other
control, and its z-index puts it above the gestures plugin's tap surface, so a
tap starts playback rather than toggling the controls, exactly as the control
bar's play button already behaved.

`UIPluginConfig.bigPlayButton: false` turns it off for a host page that draws
its own affordance.

It reads `video.ended` rather than the `ended` state key. Measured in Chrome
on 2026-09-02: neither provider clears that key on a replay (only `load()`
does), so it stays true for the rest of the session, and a control trusting it
would sit over playing video. The control bar's play button has the same
source and does show "Replay" while a replayed video plays; that is a separate
provider defect, untouched here.
