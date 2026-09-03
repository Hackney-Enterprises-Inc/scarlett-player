# @scarlett-player/core

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - `load()` now initialises the player, and `player:ready` can be observed.

  `new ScarlettPlayer(...)` followed by `load()` (the shape shown in the
  READMEs and in a dozen plugin `@example` blocks) used to leave the player
  with a provider and nothing else: non-provider plugins were never
  initialised and the `media:load-request` and `error:retry` listeners were
  never wired, so the controls, the error overlay's "Try Again" and playlist
  track loading were all dead. `init()` and `load()` now share one idempotent,
  re-entrancy-safe initialisation pass: plugins still in the `registered`
  state are initialised (so a `registerPlugin()` after start-up is picked up
  by the next call), the two listeners are wired exactly once, and providers
  keep their lazy per-source initialisation.

  `player:ready` moved out of the constructor, where it was emitted before any
  consumer or plugin could subscribe and therefore could never be observed. It
  is emitted once, at the end of the first initialisation, to listeners
  attached before `init()` or `load()`.

  Also pins `emptyOutDir: false` in the Vite config: the build is
  `tsc && vite build`, so emptying `dist` would delete the declarations that
  `types` and every plugin's tsconfig `paths` point at.

  One consequence worth knowing: because the pass now runs inside `load()`, a
  non-provider plugin whose `init()` throws surfaces through `load()`'s error
  path, reported through the `ErrorHandler` with `operation: 'load'` and
  populating the `error` state key, rather than only as a rejected `init()` call.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Core's tarball carries only what its manifest points at.

  `tsc` now emits declarations only (`emitDeclarationOnly`), so the compiled
  per-module JavaScript that used to land in `dist` beside the Vite bundles
  (`error-handler.js`, `plugin-api.js` and friends, 32 files nothing could
  import because only `.` is exported) is gone: the tarball drops from 72 files
  to 40. The build cleans `dist` and the composite buildinfo first, the same
  guard embed and vue gained in this release, and `exports["."]` lists `types`
  first, the order TypeScript documents for condition matching.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Core exports the version it was built from, as `VERSION`.

  Nothing in the workspace could read the running player version, so every
  consumer that wanted one wrote its own constant and every one of them drifted:
  the plugin descriptors said '1.0.0' and the embed builds said '0.5.3' while all
  17 packages published at 1.7.0 (measured 2026-09-02). tsp-web tags Sentry with a
  `__SCARLETT_VERSION__` define of its own for the same reason.

  `VERSION` comes from core's own package.json through a `define` in
  `vite.config.ts`, read by `src/version.ts` with a '0.0.0-dev' fallback for a
  consumer that bundles core from source without it. The same `define` reaches
  core's vitest run, so the test asserts the value against package.json rather
  than against a literal that would have to be edited on every release.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - `setPoster()` and a `poster` getter.

  `PlayerOptions.poster` could seed the poster and nothing could change it
  afterwards, so a playlist moving from one track to the next left the previous
  track's artwork on the element and a Vue `poster` prop change did nothing at
  all. `setPoster(url)` writes the `poster` state key (an empty string clears
  it) and both providers now subscribe to that key, so it takes effect on a
  player that is already running. `checkDestroyed()` like every other method.

  `load()` deliberately leaves `poster` alone, and the docblock says why: the
  poster is metadata whoever set it owns, and it is written BEFORE the load it
  belongs to, so clearing it on load would blank the image over exactly the gap
  it exists to cover.

## 1.7.0

### Minor Changes

- [#72](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/72) [`2194db7`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2194db7037aec7456475d7f9da0fc4a0fb1facb0) Thanks [@alexhackney](https://github.com/alexhackney)! - Core lifecycle and error telemetry hardening.

  **Core**
  - `ScarlettPlayer.destroy()` now bumps the load generation, so a destroy during an in-flight `load()` self-cancels the continuation instead of reading a torn-down state manager. Destroying a player mid-load (navigation, SPA unmount, a consumer rebuilding the player) no longer crashes.
  - The `error:retry` and `media:load-request` handlers re-check `destroyed` after their awaits. Both are unawaited async closures, so a throw there previously escaped as an unhandled rejection.
  - `StateManager` reads after `destroy()` now throw `[StateManager] Manager is destroyed (reading '<key>')` instead of the misleading `Unknown state key` message, which reported a typo-class error for a lifecycle-class problem. A genuine typo still fails with the unknown-key message.
  - `PlayerError` gains an optional `detail` block (new exported `PlayerErrorDetail` type) for provider diagnostics.

  **HLS**
  - The native (Safari/iOS) path now has the same retry budgets as the hls.js path. A media element error is retried up to `maxMediaRetries` (media) or `maxNetworkRetries` (network) by reloading the source and restoring position, instead of the first error being declared fatal. Both budgets reset once playback is flowing again. Exhausting a budget emits the same "(max retries exceeded)" fatal error as the hls.js branch.
  - Fatal errors carry a `detail` block: `type`, `retriesExhausted`, `attempts`, plus `httpStatus` and a sanitized `url` for network failures. The new exported `sanitizeUrl()` helper strips the query string and fragment, so signed-URL tokens never reach a consumer's telemetry.
  - `error:reconnecting` gains optional `elapsedMs` and `windowMs` so a UI can show progress toward giving up (reconnect is capped by a time window, not an attempt count). `error:recovered` can now carry `{ attempt, elapsedMs }`. Both are additive and neither compile-breaks a third-party provider: the new `error:reconnecting` fields are optional, and `error:recovered` is a union with its previous `void` payload, so existing emitters keep working. `attempt` and `delayMs` keep their names and meanings. A consumer reading the `error:recovered` fields narrows first (`if (payload) ...`).
  - Reconnect-window exhaustion is no longer silent. It used to log a warning and return, emitting nothing, so a consumer that showed "Reconnecting..." had no signal to ever take it down and an outage longer than the window left a permanent spinner. Exhaustion now emits a new `error:reconnect-exhausted` event (`{ attempts, elapsedMs, windowMs }`) followed by a final fatal `error` carrying `detail.reconnectExhausted`. A reconnect cycle is now guaranteed to end in exactly one of `error:recovered` or `error:reconnect-exhausted`; the ordering guarantee is documented in the event map TSDoc.

  **UI**
  - The error overlay drops its reconnecting presentation and restores Try Again when a reconnect cycle ends in exhaustion, via the terminal fatal error the HLS plugin now emits.

## 1.6.0

### Minor Changes

- [#70](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/70) [`55cf252`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/55cf2525bf5e92200a121cd0a0796f8786835e4d) Thanks [@alexhackney](https://github.com/alexhackney)! - Add chapter markers, touch gestures and playlist skip controls.
  - New `@scarlett-player/chapters` package: chapter list, seek-to-chapter, next/previous, and chapter dividers on the progress bar. Takes chapters inline or from a WebVTT chapters track.
  - New `@scarlett-player/gestures` package: double-tap the left or right of the picture to seek, keep tapping to go further, tap the middle to toggle the controls. Touch only, so mouse behaviour is unchanged.
  - Playlist gains `playlist-previous`, `playlist-next` and `playlist` controls, plus N and P shortcuts, so a viewer can skip a copyright card or preshow.
  - The share button now uses the universal three-node icon and accepts `buttonIcon` and `buttonLabel` overrides.

## 1.5.1

### Patch Changes

- [#68](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/68) [`8c2eca3`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8c2eca3d3d53895fa99ae53efac802cf58be81d5) Thanks [@alexhackney](https://github.com/alexhackney)! - Document the share plugin across the README and package list, and drop the last em dashes from the shipped comments, changelogs and docs.

## 1.5.0

## 1.4.0

### Minor Changes

- [#60](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/60) [`61230aa`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/61230aaca8bc8dcbbeb48d662a4f53f8d2c2a46c) Thanks [@alexhackney](https://github.com/alexhackney)! - Plugins can now extend the player without editing core.

  Adding a control-bar button previously meant editing `@scarlett-player/ui`, and owning state meant editing `@scarlett-player/core` - `ControlSlot` was a closed union consumed by a `switch`, and `StateManager` threw for any key not in `DEFAULT_STATE`. Captions only looked like a self-contained package because core had already reserved its state keys, its event, and its control slot in advance. That does not scale, and it left third-party plugins with no route in at all.

  **Controls.** `registerControl(id, factory)` in `@scarlett-player/ui` registers a control under any id, and `ControlSlot` becomes `BuiltinControlSlot | (string & {})` so custom ids type-check while editors still autocomplete the built-ins. Registering never places a button on its own - a host opts in by listing the id in `uiPlugin({ controls: [...] })`. Because plugin init order is not guaranteed, a control registered after the control bar was built triggers a rebuild rather than being silently dropped, and a factory that throws is contained instead of taking the whole bar down.

  **State.** `api.defineState(key, initialValue)` registers plugin-owned state at runtime. It is idempotent, so a plugin re-running setup after a source change cannot reset state that is already live, and `reset()`/`resetKey()` now restore plugin keys to their defined initial value instead of writing `undefined`. State keys are split into `CoreStateStore` (what core owns, and what its defaults must cover exhaustively) and the open `StateStore`, so a plugin augmenting the latter can no longer break core's own compilation with a confusing missing-properties error.

  **Events** needed no change: `PlayerEventMap` is an interface and the event bus never validated names, so declaration merging already worked. This is now pinned by tests, and `@scarlett-player/core` type-checks the files carrying those guarantees - previously vitest transpiled them without type-checking, so a type-level contract could rot unnoticed.

  See `.claude/docs/plugin-authoring.md` for the conventions, including namespacing events and state keys with the plugin id.

## 1.3.0

## 1.2.0

### Minor Changes

- [#55](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/55) [`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c) Thanks [@alexhackney](https://github.com/alexhackney)! - Playback fault absorption for the watch-page cutover. The HLS plugin now has a unified pipeline teardown with a load-session guard, so a superseded load, watchdog, retry timer, or reconnect attempt can never fire into the current session or leave a load promise hanging. MSE append and quota failures are classified as their own recoverable error codes (MEDIA_APPEND_ERROR, MEDIA_BUFFER_FULL) and still ride the media-recovery and auto-reconnect path. Live playlist refreshes are validated before parsing: an error page, master-only response, or empty document becomes a normal bounded network retry (PLAYLIST_INVALID when exhausted) instead of being indexed blindly, and playback continues on the previous playlist during retries. The light build now shares the full build's machinery (auto-reconnect, load watchdog, structured error codes, playlist validation) through one factory instead of drifting behind it. Core gains ErrorHandler.record() for advisory errors and records media element errors in history without flipping the player's error state.

## 1.1.1

## 1.1.0

### Minor Changes

- [#46](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/46) [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f) Thanks [@alexhackney](https://github.com/alexhackney)! - Make failure handling viewer-friendly: no silent hangs, self-healing reconnects, accurate error messages, and a Try Again that actually recovers.

  **No more permanent spinners.** Manifest-phase network errors (404/403, expired token, origin down) previously died silently after one recovery attempt because `startLoad()` cannot retry a manifest that never parsed, leaving `player.init()` pending forever. Manifest errors now retry with `loadSource()`, and a load watchdog (`loadTimeoutMs`, default 30s) guarantees every load attempt terminates with a real error.

  **Self-healing playback.** After a fatal network/media error mid-playback, the HLS provider now auto-reconnects with capped exponential backoff (configurable via `autoReconnect`, `reconnectBaseDelayMs`, `reconnectMaxDelayMs`, `reconnectWindowMs`), reconnects immediately when the browser comes back online, restores the viewer's VOD position from the moment of failure, and rejoins live streams at the live edge. The overlay shows "Connection lost. Reconnecting..." while working and hides itself on recovery. Retry budgets also reset once media flows again, so transient blips spread across a long live event no longer permanently consume them.

  **Accurate error messages.** Fatal HLS errors now carry structured codes (`MEDIA_NETWORK_ERROR`, `MEDIA_DECODE_ERROR`, `PLAYBACK_FAILED`) and the overlay maps codes before falling back to prose matching, so a network outage shows the connection message instead of "Something went wrong." The `error` state key is now populated from every error event (and cleared on successful load); it was previously declared but never written. New events: `error:reconnecting` and `error:recovered`.

  **Try Again fixed.** The overlay's retry now emits `error:retry`, which the core handles by reloading through the provider path and restoring position (live streams rejoin the live edge). It previously wrote the raw manifest URL onto the MSE-backed video element and reset playback to 0.

  Native HLS (Safari) fatal video errors are now surfaced as structured player errors instead of failing silently, and the native provider gained the same load watchdog.

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

### Minor Changes

- [#35](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/35) [`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7) Thanks [@alexhackney](https://github.com/alexhackney)! - Automatic playlist loading, Chromecast playlist support, AirPlay improvements, watermark and captions plugins

  **Core:**
  - Added `media:load-request` event for plugins to request media loading without direct `player.load()` access
  - Promoted playlist events (`playlist:change`, `playlist:add`, `playlist:remove`, `playlist:clear`, `playlist:shuffle`, `playlist:repeat`, `playlist:reorder`, `playlist:ended`) to core `PlayerEventMap`
  - Added minimal `PlaylistTrack` interface to core types
  - Core player listens for `media:load-request` and routes load to local player (skips when Chromecast is active)

  **Playlist:**
  - New `autoLoad` config option (default: `true`) - automatically emits `media:load-request` on track change, eliminating the need for manual `player.load()` wiring
  - New `advanceDelay` config option - milliseconds to wait before auto-advancing to next track
  - Removed all `as any` casts from event emissions (events now typed in core)

  **Chromecast:**
  - Detects media-ended on Cast device via `isMediaLoaded` state transition (true → false), emitting `playback:ended` so playlists auto-advance during casting
  - Listens for `media:load-request` to load new media on Cast device when Chromecast is active
  - Registered `IS_MEDIA_LOADED_CHANGED` event listener for reliable detection

  **HLS:**
  - Forces native HLS when AirPlay is active during `loadSource()`, preventing hls.js from interfering with wireless playback

  **AirPlay:**
  - Automatically switches back to hls.js when AirPlay disconnects, restoring quality control

  **Watermark (NEW):**
  - Anti-piracy watermark overlay plugin with text or image rendering
  - Configurable position, opacity, font size
  - Dynamic repositioning mode (moves to random position periodically)
  - Configurable show delay
  - Per-track watermark updates via playlist metadata (`watermarkUrl`, `watermarkText`)

  **Captions (NEW):**
  - WebVTT subtitle/caption plugin using browser-native `<track>` element rendering
  - External WebVTT source loading
  - HLS.js subtitle track extraction
  - Track selection via existing `track:text` event (works with CaptionsButton and SettingsMenu)
  - Auto-select with configurable default language
  - Automatic cleanup on source change

  **Embed:**
  - Added watermark and captions plugins to full and video embed builds

  **Breaking Change Note:**
  Existing consumers that manually wire `playlist:change` to `player.load()` will get double-loads when `autoLoad` is `true` (the new default). Set `autoLoad: false` to preserve the previous manual behavior, or remove the manual wiring.

## 0.5.3

### Patch Changes

- Bug fixes, stability improvements, and live DVR wiring

  **Bug Fixes:**
  - Fix MIME type detection for URLs with query params/fragments (e.g., `video.m3u8?token=abc`)
  - Fix spinner stuck on screen - `playing` event handler now clears `waiting` and `buffering` states
  - Fix `setPlaybackRate()` accepting invalid values - now clamped to 0.0625-16 range
  - Fix `setQuality()` accepting out-of-bounds indices - now validates against available quality levels
  - Fix analytics memory leak - cap `errors` array at 100 and `bitrateHistory` at 500 entries for long sessions
  - Fix HLS error test expecting `logger.warn` for fatal errors (should be `logger.error`)
  - Fix demo page crash when `getState` called before player initialization

  **Live DVR:**
  - Wire up `seekableRange`, `liveEdge`, and `liveLatency` state in HLS plugin - existing UI controls (LiveIndicator, ProgressBar DVR, TimeDisplay, SkipButton) now receive live stream data

  **Dependencies:**
  - Remove unused `hls.js` dependency from `@scarlett-player/core`
  - Align `hls.js` versions: embed and HLS plugin dev dep updated to `^1.6.0`, peer dep to `^1.5.0`

  **Docs:**
  - Update README roadmap - mark captions and mobile gestures as planned (Sprint 1), add Sprint 2/3 items
  - Update CHANGELOG with entries for versions 0.3.0 through 0.5.2
  - Update package version table to 0.5.2

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

## 0.5.1

### Patch Changes

- [#28](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/28) [`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59) Thanks [@alexhackney](https://github.com/alexhackney)! - Lint and type safety fixes
  - Fixed all 31 ESLint warnings across the codebase (unused imports, variables, args)
  - Added ThumbnailConfig type and thumbnails state to core StateStore
  - Added error:retry and error:dismiss events to core PlayerEventMap
  - Fixed VolumeControl missing event listener cleanup in destroy
  - Fixed LiveIndicator inline handlers converted to proper named methods with cleanup
  - Updated README with analytics plugin and completed roadmap items

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
