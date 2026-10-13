---
"@scarlett-player/analytics": minor
---

`videoStart` now waits for a frame to actually be shown, and a stall where the picture freezes without the browser reporting buffering now counts as a rebuffer, so startup times and rebuffer counts (mostly on iOS Safari) will read higher than on 1.24.
