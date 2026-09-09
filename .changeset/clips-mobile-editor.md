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
'@scarlett-player/clips': minor
---

Make the clip editor usable on a portrait-phone player.

**`@scarlett-player/clips`**

- **The details dialog was crushed.** `applyAnchor()` applied the range stage's
  anchor formula on every layout, but below `regular` the details stage covers
  the picture and the CSS stretches it to `top: 8px / bottom: 8px` — the anchor
  bounds nothing there. The panel came out 81px tall on a 197px player: an 8px
  body over 199px of content, with the time fields, the readout and the title
  all out of reach behind 8px-at-a-time scrolling. The covering stage now gets
  the player, less the 8px inset top and bottom; `tiny` and `regular` are
  unchanged.
- **Handle labels no longer leave the player.** The `IN 0:12` / `OUT 0:47`
  pill is centred on its handle, so at either end of the rail a ~60px label
  hung half its width past it and the player's `overflow: hidden` cut the
  prefix off (measured on a 350px player: the IN pill spanned x=2..63 against a
  player starting at 20). Only the label slides now, by the smallest shift that
  brings it back inside the track. The handle and its stem stay exactly on the
  timestamp they point at, and the clamp is recomputed on resize.
- **Slimmer chrome on a phone.** Under `.sp-clip-editing--minimal` only — the
  layout that has already given up the control bar, which is where every
  portrait phone lands — the handle lanes drop from 44px to 32px, the pills to
  10px/2px-6px, and the timeline sits 36px off the bottom instead of 44px. The
  range stage's chrome goes from 143px to ~123px, so a 197px player keeps ~74px
  of picture instead of ~45px. Desktop and tablet keep the 44px lanes.
  Documented trade-off: the pill's touch target is 32px tall on a phone (it
  stays ~55px wide); the toolbar and the IN/OUT-here buttons keep the 44px
  floor.
