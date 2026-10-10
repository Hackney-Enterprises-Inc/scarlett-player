---
'@scarlett-player/embed': patch
---

`data-keyboard="false"` and the iframe's `keyboard=false` (or `0`) query parameter now turn off the video player's keyboard shortcuts; the attribute was parsed but ignored.
