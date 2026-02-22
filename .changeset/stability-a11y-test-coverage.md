---
'@scarlett-player/core': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
'@scarlett-player/analytics': minor
'@scarlett-player/audio-ui': minor
---

Stability, accessibility, and test coverage improvements

**Bug Fixes:**
- Fix memory leak in effect system — unsubscribe now properly removes effects from all signal subscriber sets
- Fix analytics avgBitrate calculation — was dividing by total watch time (including paused), now uses actual playback time span
- Fix race condition in load() — concurrent load calls no longer cause undefined behavior; stale loads are discarded
- Add stall detection to native provider — handles `stalled`, `suspend`, and `abort` media events

**Accessibility (WCAG):**
- Add keyboard navigation to SettingsMenu (Arrow Up/Down, Enter/Space, Escape, focus trap)
- Add 44x44px minimum touch targets to all button controls (WCAG 2.5.5)
- Add descriptive ARIA labels to LiveIndicator (not just color-dependent)
- Add aria-valuetext to VolumeControl and default ARIA values to ProgressBar
- Add comprehensive ARIA labels to all Audio UI interactive elements

**Test Coverage:**
- Add 105 new tests for UI controls (ProgressBar, VolumeControl, SettingsMenu, TimeDisplay, LiveIndicator, ErrorOverlay)
- Total test count: 1,214 (up from 1,109)
