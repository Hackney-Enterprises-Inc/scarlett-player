---
'@scarlett-player/ui': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/core': minor
'@scarlett-player/hls': minor
---

UI: the progress tooltip returns after a mouse leave, a leaked keydown listener
is removed, `--sp-*` is no longer declared on `:root`, and a window-resize
fallback covers viewports without `ResizeObserver`. Audio UI: keyboard support
on the progress and volume sliders, and no more per-tick `innerHTML` rewrites.

**UI**

- `ProgressBar` set `tooltip.style.opacity = '0'` on mouse leave and touch end.
  An inline style outranks the stylesheet's hover rule, so the tooltip never
  came back on a later hover. The inline value is now cleared instead.
- `ProgressBar.destroy()` removes its `keydown` listener, which was the only
  one it left attached.
- The stylesheet no longer declares `--sp-accent`, `--sp-color`, `--sp-bg`,
  `--sp-control-height` and `--sp-icon-size` on `:root`, which wrote five names
  into the host document. Defaults live at the use sites as `var()` fallbacks,
  so a host theming through its own `:root` keeps working and `setTheme()`
  still wins on the container.
- Where `ResizeObserver` is unavailable the bar refits on a debounced window
  resize. It was previously fitted at init and on control changes and never
  again.

**Audio UI**

- The progress bar and volume slider respond to arrow keys, Home and End. Both
  already carried `role="slider"` and `tabindex="0"`, so a keyboard viewer
  could focus them and had nothing to press.
- Button icons are only rewritten when they change. `updateUI()` runs on every
  `currentTime` tick and each `innerHTML` write reparsed the SVG.

**Shared code**

`formatTime`/`formatLiveTime` and the SVG paths both UI packages draw now live
in `@scarlett-player/core`, which is already a peer dependency of both. `ui`
re-exports the formatters, so its public surface is unchanged.
`@scarlett-player/hls`'s `sanitizeUrl` re-exports core's implementation rather
than duplicating it; it remains exported from both HLS entries.
