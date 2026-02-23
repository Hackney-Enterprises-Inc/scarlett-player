# @scarlett-player/ui

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@0.5.3

## 0.5.2

### Patch Changes

- [#30](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/30) [`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471) Thanks [@alexhackney](https://github.com/alexhackney)! - Stability, accessibility, and test coverage improvements

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

- Updated dependencies [[`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471)]:
  - @scarlett-player/core@0.5.2

## 0.5.1

### Patch Changes

- [#28](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/28) [`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59) Thanks [@alexhackney](https://github.com/alexhackney)! - Lint and type safety fixes
  - Fixed all 31 ESLint warnings across the codebase (unused imports, variables, args)
  - Added ThumbnailConfig type and thumbnails state to core StateStore
  - Added error:retry and error:dismiss events to core PlayerEventMap
  - Fixed VolumeControl missing event listener cleanup in destroy
  - Fixed LiveIndicator inline handlers converted to proper named methods with cleanup
  - Updated README with analytics plugin and completed roadmap items

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1

## 0.5.0

### Minor Changes

- [#25](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/25) [`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734) Thanks [@alexhackney](https://github.com/alexhackney)! - End-user experience polish sprint
  - Enhanced live stream controls: LiveIndicator shows "GO LIVE" when behind live edge, ProgressBar supports DVR seeking with live time tooltip, SkipButton respects seekable range bounds
  - Added touch event support to ProgressBar and VolumeControl for mobile devices
  - Fixed keyboard shortcuts not being intercepted when typing in input fields
  - Fixed ErrorOverlay memory leaks (anonymous listeners, retry button debounce)
  - Wrapped CSS hover states in @media (hover: hover) for touch devices
  - Fixed Chromecast SESSION_RESUMED handling to avoid reloading media on reconnect
  - Fixed Chromecast destroy crash when Cast SDK not loaded (optional chaining)
  - Replaced SVG text-based icons (forward10/replay10) with path-only versions for reliable rendering
  - Added ThumbnailPreview error handling for failed sprite sheet loads
  - Improved ErrorOverlay user-facing messages (separated manifest vs network errors)
  - Fixed VolumeControl and LiveIndicator missing event listener cleanup in destroy
  - Added ThumbnailConfig and error:retry/error:dismiss to core type definitions

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
