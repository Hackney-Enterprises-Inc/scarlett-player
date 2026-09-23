---
'@scarlett-player/ui': patch
'@scarlett-player/embed': patch
---

**UI: `accentTextTone()` reads named and `rgb()` colours.** It used to parse only
`#rgb` and `#rrggbb`, so a `data-brand-color` or `theme.accentColor` of `navy` or
`rgb(0 0 139)` came back unchanged and the LIVE label and active menu rows kept
an accent too dark to read. It now also reads `#rgba`, `#rrggbbaa`,
`rgb()`/`rgba()` in the comma or space syntax (numbers or percentages, optional
alpha) and the CSS named colours, ignoring case and surrounding space, so those
accents get the same readable accent-text tone a hex one always did. A
translucent accent is composited over the menus before it is measured, and the
result is always an opaque `#rrggbb`: a named colour that already clears AA
comes back as its hex (`white` gives `#ffffff`). `hsl()`, `var()`, gradients and
`transparent` are still handed back as given.
