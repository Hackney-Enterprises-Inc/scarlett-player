---
'@scarlett-player/core': minor
---

Fullscreen is owned by core, and its state is tracked for real.

`enterFullscreen()`, `exitFullscreen()` and `isFullscreen()` are new exports.
There were three separate implementations before: the player's own
`requestFullscreen()` (container only), the UI package's fullscreen button (the
only one carrying the iPhone `video.webkitEnterFullscreen()` fallback) and the
`f` keyboard shortcut (container only). A host calling
`player.requestFullscreen()`, which is what the Vue wrapper and the
`useScarlettPlayer` composable both do, therefore did nothing at all on an
iPhone, where `Element.requestFullscreen` does not exist.

The `fullscreen` state key was written only by those two player methods, and
nothing listened for a change the player did not initiate. Entering fullscreen
through the button or the `f` key never flipped the icon to "Exit fullscreen",
`player.fullscreen` stayed false and `fullscreen:change` never fired; and after
a programmatic `requestFullscreen()`, an Escape exit left the state stuck at
true. The player now listens for `fullscreenchange` and
`webkitfullscreenchange` on the document, and for `webkitbeginfullscreen` and
`webkitendfullscreen` in the capture phase on its container, because those two
are dispatched on the video element, do not bubble, and the element is created
later by whichever provider wins the source. All four are removed in
`destroy()`.

A transition is announced once. The spec fires `fullscreenchange` before
`requestFullscreen()` resolves, so the optimistic write that follows the await
now runs only where the browser stayed silent, which is where it is still
needed: jsdom never fires the event.
