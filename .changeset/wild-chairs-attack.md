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

UI: accent text meets WCAG AA. The LIVE label, the active rows in the settings
and quality menus and the active captions/cast glyphs read a new
`--sp-accent-text` token instead of `--sp-accent`; the brand red is 4.38:1 on
black and 3.84:1 on the menus' own background, against the 4.5:1 AA asks for
11-13px labels, and the default tone here clears it at 6.4:1 and 5.7:1 - and
at 5.0:1 against the worst case, those same menus over a white video frame,
since their background is 95% opaque rather than opaque.
`--sp-accent` is unchanged and still colours the progress fill, big play button
and focus rings, which are non-text and answer to 3:1. `--sp-accent-text` falls
back to `--sp-accent`, so `theme.accentColor` still colours that text for a
host that themes the player; set the new token as well when the accent is too
dark to read at that size (see the ui README).

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
