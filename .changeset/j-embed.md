---
'@scarlett-player/embed': minor
---

Video embeds ship touch gestures.

`@scarlett-player/gestures` gives a phone viewer double-tap seeking on the sides
of the picture and tap to toggle the controls. tsp-web's wrapper already
registered it; no embed build did, and neither did the demo, so every
CDN embed on a phone was missing the interaction every phone viewer already
knows from YouTube. It matters more now that the control bar moves the skip
buttons into its overflow tray on a narrow player: gestures are what replaces
them there.

On by default for `type="video"`, with `data-gestures="false"` (or
`gestures: false`) as the kill switch for a page that owns those gestures
itself. The audio builds do not ship it, and the plugin self-disables for audio
anyway. It arms itself by input type, not by user agent: `enabled` defaults to
`'auto'`, gated on `matchMedia('(pointer: coarse)')`, so a mouse never triggers
any of it.
