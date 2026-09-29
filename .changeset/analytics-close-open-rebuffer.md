---
"@scarlett-player/analytics": patch
---

Fix a rebuffer that never closes when a stall ends in something other than a resume. Until now `onPlaying()` was the only place that added a stall's duration to `rebufferDuration`, so a viewer pausing mid-stall, the video ending, a fatal error, a view switch, `destroy()`, or the page unloading all left the rebuffer open and its time uncounted - understating `rebufferDuration`, `rebufferRatio` and the QoE score on exactly the views with the worst stalls. A pause or a view ending (`ended`, a fatal error, a view switch, `destroy()`) now closes an open rebuffer and sends the same `rebufferEnd` beacon resume already sends; the unload path closes it too, folding the time into the unload `viewEnd`, but without a separate beacon since the page is already going away.
