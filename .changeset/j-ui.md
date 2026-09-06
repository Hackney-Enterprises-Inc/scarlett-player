---
'@scarlett-player/ui': minor
---

The control bar fits itself, and the menus fit the player.

The bar was a single non-wrapping row of fixed-width flex items inside a host
that clips, with no strategy for not fitting. Measured in Chrome 152 on the
demo: the visible set is 519px, so the bar clips below 543px of player width,
and at 375px the share, cast, PiP and fullscreen buttons render past the edge.
Derived for tsp-web's 17-slot layout on a 390px iPhone, the left group alone is
375px against 366px of inner width, so the entire right group (chapters,
settings, captions, cast, PiP, fullscreen) is off canvas. Captions and playback
speed were never broken; they were unreachable.

`responsive` (default true) makes the bar measure itself and move the
least important controls into a new overflow tray behind a "More controls"
button. The arithmetic is a pure `planFit()` in `src/fit.ts` so it can be unit
tested, which a CSS answer could not be: jsdom has no layout engine, and a width
tier cannot guarantee a fit anyway, because the time readout is 87px or ~130px
depending on the duration, every control hides itself on state, and hosts
register controls of their own. The tray button's own width is part of the
arithmetic, which is what makes the plan deterministic and stops it
oscillating. `priority` re-ranks or pins individual slots, and
`responsive: false` restores the previous behaviour exactly: no measuring, no
observer, no tray, no extra DOM.

The tray is a horizontal wrapping strip, not a vertical menu: eight 44px rows
would be over 350px tall against a 211px portrait phone player, and a scrolling
panel would clip the popovers registered controls own. Controls are moved, never
re-rendered or wrapped, so a captions button in the tray still emits
`track:text`.

The settings and quality menus are now bounded to the player's height through
`--sp-menu-max-height`, written by the same ResizeObserver. The speed sub-panel
is 253px against a 211px player, so without that it lost its Back header and its
first three speeds to the host's `overflow: hidden`, which kept playback speed
unreachable even once the bar fitted.

On a coarse pointer the progress wrapper grows upward to 44px. The control bar
is a later sibling at the same z-index and covers 48..56px from the bottom, so
the exclusive scrub region was 12px, not the 20px the wrapper suggested. The
visible 3px bar does not move.

The fullscreen button and the `f` shortcut now go through the core fullscreen
helpers, so they behave the same as `player.requestFullscreen()`, iPhone
fallback included, and the button decides its direction from the browser rather
than from a state key that could be stale. `env(safe-area-inset-bottom)` is
composed in through `--sp-inset-bottom`, scoped to `:fullscreen` (and
`:-webkit-full-screen`): applied unconditionally it would push an inline
player's controls up on any `viewport-fit=cover` page.

The `@scarlett-player/core` peer range moves to `^1.8.0`, which is the version
that exports those helpers.
