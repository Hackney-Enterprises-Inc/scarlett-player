---
'@scarlett-player/ui': patch
'@scarlett-player/native': patch
'@scarlett-player/analytics': patch
---

Accessibility, error-state and analytics-auth fixes.

UI: the player container shows a focus ring again. The plugin makes the
container a tab stop (`tabindex="0"`) so the keyboard shortcuts have somewhere
to land, while the stylesheet cleared its outline unconditionally - so tabbing
into the player moved focus somewhere invisible. The outline stays suppressed
for a pointer press and is drawn on `:focus-visible` only, inset by 3px so a
host page's own overflow cannot clip it.

Native provider: a source that fails to load now leaves `playbackState` at
`'error'` with `buffering` false, matching what the HLS and WHEP providers
already write on their fatal path. The element fires nothing after a failed
load, so both keys kept the values the load set - the UI drew its error overlay
over a spinner that never stopped. The load watchdog (a source that stalls
without ever erroring) writes the same two keys, since on that path the
element's own `error` listener never runs.

Analytics: the unload beacon's `?api_key=` is now appended correctly for a
relative `beaconUrl`. `new URL()` was called without a base, so every relative
endpoint fell through to the string fallback, and on one that already carried a
query string (`/analytics/beacon?tenant=42`) the key was appended with a second
`?` - the server read the previous parameter's value as `42?api_key=...` and
the authenticated `viewEnd` beacon failed. The README now documents both
transports: `X-API-Key` on every in-session beacon, `?api_key=` on the unload
beacon that `navigator.sendBeacon` sends, which cannot carry headers at all.
