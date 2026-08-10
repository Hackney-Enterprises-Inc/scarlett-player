# @scarlett-player/native

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0

## 1.2.0

### Patch Changes

- [#55](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/55) [`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c) Thanks [@alexhackney](https://github.com/alexhackney)! - Picture-in-Picture readiness gate: the PiP button is disabled until media metadata is loaded (entering PiP earlier rejects with InvalidStateError), every PiP call is caught so a failure can never surface as an unhandled rejection, Safari's presentation-mode path gets the same gate, and the button swaps to the exit icon while in PiP. The native provider now tracks PiP events so the pip state stays accurate on that path. Keyboard play and fullscreen shortcuts no longer leak promise rejections, and the error overlay has specific copy for append, buffer-full, and invalid-playlist failures.

## 1.1.1

### Patch Changes

- [#50](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/50) [`db2d670`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/db2d670cdaf2feb287702e4cfe536e5a07d24b54) Thanks [@alexhackney](https://github.com/alexhackney)! - Stop the native provider's audio filename fallback from overwriting playlist track titles (#45).

  The fallback claimed to only set the title "if one doesn't already exist" but never checked, so every audio load replaced the playlist's track title with the derived filename. The native provider now remembers which title it derived itself: it only writes a fallback when the title is empty or still its own previous fallback, and always respects an externally set title.

  The playlist plugin now always writes the title on track change (empty when the track has none), so a previous track's title can no longer leak into a following untitled track; providers fill in the filename fallback for those.

## 1.1.0

### Minor Changes

- [#46](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/46) [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f) Thanks [@alexhackney](https://github.com/alexhackney)! - Make failure handling viewer-friendly: no silent hangs, self-healing reconnects, accurate error messages, and a Try Again that actually recovers.

  **No more permanent spinners.** Manifest-phase network errors (404/403, expired token, origin down) previously died silently after one recovery attempt because `startLoad()` cannot retry a manifest that never parsed, leaving `player.init()` pending forever. Manifest errors now retry with `loadSource()`, and a load watchdog (`loadTimeoutMs`, default 30s) guarantees every load attempt terminates with a real error.

  **Self-healing playback.** After a fatal network/media error mid-playback, the HLS provider now auto-reconnects with capped exponential backoff (configurable via `autoReconnect`, `reconnectBaseDelayMs`, `reconnectMaxDelayMs`, `reconnectWindowMs`), reconnects immediately when the browser comes back online, restores the viewer's VOD position from the moment of failure, and rejoins live streams at the live edge. The overlay shows "Connection lost. Reconnecting..." while working and hides itself on recovery. Retry budgets also reset once media flows again, so transient blips spread across a long live event no longer permanently consume them.

  **Accurate error messages.** Fatal HLS errors now carry structured codes (`MEDIA_NETWORK_ERROR`, `MEDIA_DECODE_ERROR`, `PLAYBACK_FAILED`) and the overlay maps codes before falling back to prose matching, so a network outage shows the connection message instead of "Something went wrong." The `error` state key is now populated from every error event (and cleared on successful load); it was previously declared but never written. New events: `error:reconnecting` and `error:recovered`.

  **Try Again fixed.** The overlay's retry now emits `error:retry`, which the core handles by reloading through the provider path and restoring position (live streams rejoin the live edge). It previously wrote the raw manifest URL onto the MSE-backed video element and reset playback to 0.

  Native HLS (Safari) fatal video errors are now surfaced as structured player errors instead of failing silently, and the native provider gained the same load watchdog.

### Patch Changes

- [#48](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/48) [`d3259c4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d3259c4e33760e59ce038acb2fff6fdc5c1a7d80) Thanks [@alexhackney](https://github.com/alexhackney)! - Stop the native provider's audio filename fallback from overwriting playlist track titles (#45).

  The fallback claimed to only set the title "if one doesn't already exist" but never checked, so every audio load replaced the playlist's track title with the derived filename. The native provider now remembers which title it derived itself: it only writes a fallback when the title is empty or still its own previous fallback, and always respects an externally set title.

  The playlist plugin now always writes the title on track change (empty when the track has none), so a previous track's title can no longer leak into a following untitled track; providers fill in the filename fallback for those.

## 1.0.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@1.0.1

## 1.0.0

### Patch Changes

- Updated dependencies [[`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7)]:
  - @scarlett-player/core@1.0.0

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @scarlett-player/core@0.5.3

## 0.5.2

### Patch Changes

- [#30](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/30) [`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471) Thanks [@alexhackney](https://github.com/alexhackney)! - Stability, accessibility, and test coverage improvements

  **Bug Fixes:**
  - Fix memory leak in effect system - unsubscribe now properly removes effects from all signal subscriber sets
  - Fix analytics avgBitrate calculation - was dividing by total watch time (including paused), now uses actual playback time span
  - Fix race condition in load() - concurrent load calls no longer cause undefined behavior; stale loads are discarded
  - Add stall detection to native provider - handles `stalled`, `suspend`, and `abort` media events

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

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
