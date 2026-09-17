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
'@scarlett-player/clips': patch
'@scarlett-player/whep': patch
---

Maintenance release: the demo page and the browser verification harness, no
change to the published package code.

Demo: the WHEP Monitor panel's 500ms readout timer now stops on
`player:destroy`. It held the player instance in a closure, so once the
player was destroyed it threw `Cannot call methods on destroyed player` on
every tick as an uncaught error; the page's own stats poller reads
`window.player` and never had the problem.

Browser harness (`scripts/verify-browser.mjs`): the clip editor's touch-drag
check now aims CDP touch input in visual-viewport coordinates. Under mobile
emulation the demo page lays out wider than 320px, so Chromium keeps a 320x568
visual viewport inside a 431x766 layout viewport, and focusing the editor's
toolbar on open scrolls the visual viewport by its full 198px. The check took
its target from `getBoundingClientRect()` (layout viewport) and every touch
landed 198px low, on the page below the player. It had passed until 1.13.0
only because the toolbar's bottom edge happened to sit 4px inside the visual
viewport; the slimmer minimal-layout lanes in 1.14.0 crossed it, and the WHEP
URL bar in 1.15.0 pushed the player further still. The `main` verification
step has failed on every push since 2026-09-11 for these two reasons.
