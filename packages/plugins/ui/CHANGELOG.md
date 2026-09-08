# @scarlett-player/ui

## 1.12.0

### Minor Changes

- [#93](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/93) [`274ed3e`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/274ed3e47fbac1eddf9f01d3362e9f06e236f806) Thanks [@alexhackney](https://github.com/alexhackney)! - Low-latency HLS (LL-HLS). `lowLatencyMode` stays off by default, so nothing
  changes for an existing consumer; turning it on now produces a complete
  low-latency configuration instead of a single flag, and the live state keys that
  had been declared since the first release are finally written.

  **`@scarlett-player/hls`**
  - `lowLatencyMode: true` now also enables latency catch-up. hls.js ships
    `maxLiveSyncPlaybackRate: 1`, which disables catch-up entirely, so LL-HLS
    previously parsed and loaded parts and then let latency settle wherever the
    buffer landed and never pulled it back. It defaults to `1.1` under low latency
    only, and is overridable.
  - New config: `liveSyncDuration`, `liveSyncDurationCount`,
    `liveMaxLatencyDuration`, `liveMaxLatencyDurationCount`,
    `maxLiveSyncPlaybackRate`, `liveDurationInfinity`. Only keys a host actually
    sets are passed to hls.js — it merges config by assignment, so forwarding
    `undefined` would have overridden its defaults and broken standard live. The
    seconds-based and count-based options are mutually exclusive (hls.js throws on
    a config carrying both), so a mixed config forwards one group and logs which
    half was dropped rather than failing the load.
  - New `live-metrics.ts` is the single writer for `liveLatency`, `liveEdge`,
    `seekableRange` and `lowLatencyMode`. Previously `hlsLevelLoaded` computed an
    edge flag from the playlist and the `timeupdate` handler then recomputed it
    four times a second as `latency < 10` from `video.seekable` — the wrong source
    under MSE, and a threshold that is unconditionally true at a low-latency
    target, so **"GO LIVE" could never appear** no matter how far a viewer
    drifted. The threshold is now latency-relative:
    `latency <= targetLatency + max(1.5, partTarget ?? targetduration / 2)`.
  - `liveLatency` is now real latency from hls.js (measured against
    `EXT-X-PROGRAM-DATE-TIME` drift where the manifest carries it) rather than the
    distance to the end of the loaded playlist. On native Safari HLS it remains an
    approximation, and is documented as one.
  - `lowLatencyMode` state and `live:lowlatency` report whether low latency is
    _effective_ — the manifest carries `EXT-X-PART` or advertises
    `CAN-BLOCK-RELOAD=YES`, and the host asked for it — not what was requested.
  - `getLiveInfo()` gains `lowLatency`, and its native branch stops parking a
    viewer a hard-coded 3 seconds behind the edge on a 2-second-target stream.
  - `live:latency`, `live:edgechange`, `live:seekablerange` and `live:lowlatency`
    are emitted for the first time, each only on change.
  - A playlist that stops being live (`EXT-X-ENDLIST`, or a VOD source after a
    live one) clears the latency readout, LL badge and DVR window instead of
    leaving the previous stream's values on screen.

  **`@scarlett-player/core`**
  - New `live:seektolive` event. `ScarlettPlayer` subscribes and calls
    `seekToLive()`, so the live-sync-position ladder lives in one place.

  **`@scarlett-player/ui`**
  - `LiveIndicator`'s "GO LIVE" emits `live:seektolive` instead of seeking to
    `seekableRange.end` itself. Under low latency that end is beyond the last
    loaded part, and seeking there stalls and rebuffers.

  **`@scarlett-player/analytics`**
  - Live sessions report `liveLatencyMean`, `liveLatencyP95`, `liveLatencyMax`,
    `liveLatencySamples` and `lowLatency` on heartbeat and viewEnd beacons.
    Accumulated into a fixed histogram rather than stored, so memory does not grow
    with watch time and the percentile covers the whole session. The unload
    (`pagehide`/`beforeunload`) beacon carries them too, which is where an
    abandoned live view is recorded. VOD beacons are unchanged — the keys are
    absent.

### Patch Changes

- [#91](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/91) [`52568a9`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/52568a9b2540096f84f741f4541549642e734725) Thanks [@alexhackney](https://github.com/alexhackney)! - Documentation reconcile against the shipped code. No runtime changes.
  - The package count is 18 everywhere it is stated; the root changelog,
    `docs/contributing.md` and the scarlettplayer.com package table said 17 and
    omitted `@scarlett-player/clips`.
  - The CI checklists in `docs/contributing.md` and the development guide now list
    `scripts/check-package-types.mjs` and the push-only real-browser verification
    job, and describe `pnpm validate` in the order it actually runs.
  - `docs/architecture.md` and `docs/plugin-authoring.md` carry the current version
    and list `clips` as a feature plugin.
  - The README test count is 2,300+, measured, and the roadmap records clips as
    shipped.
  - `docs/embed-implementation.md` is rewritten against the package as built: the
    three build entries, the real source layout, the async `create()` contract,
    the actual auto-init selectors, measured bundle sizes, and the automated CDN
    and npm release path. The stale data-attribute table now links to
    `packages/embed/README.md`, and the obsolete manual-publishing section is gone.

## 1.11.0

### Minor Changes

- [#88](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/88) [`e2ebd22`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/e2ebd22b3fde1a38e18e81ee8a1aef0afa7e892c) Thanks [@alexhackney](https://github.com/alexhackney)! - Clips: new `@scarlett-player/clips` plugin - viewer-created clips, player side.
  - `createClipsPlugin(config)` adds a `'clip'` control (when `@scarlett-player/ui` is
    present) that opens a two-handle in/out selector anchored above the control bar:
    Pointer Events, touch and keyboard (arrows, Shift, Home/End), ARIA sliders with
    `formatTime` labels, an optional title field with a live counter, and clamp
    feedback that never pushes the other handle. A drag is owned by the pointer
    that started it: a second finger landing on the track is ignored until the
    first lifts.
  - `minDuration` / `maxDuration` / `defaultDuration` / `step` are all host
    configuration (fallbacks 5 / 60 / 30 / 1s), enforced in a pure range model and
    adjustable at runtime via `configure()`; `open()` pre-rolls a selection behind
    the playhead.
  - The selection loops in a preview while the selector is open; dragging a handle
    pauses and scrubs (100ms throttle) and restores play state on release.
  - v1 is VOD-only: the control hides on live and audio, and `open()` errors
    ('live-unsupported') rather than opening. Live/DVR reconciliation and
    wall-clock mapping are designed and deferred to Phase 2.
  - Two submission paths, host picks one: `onCreate(range)` for hosts with their
    own HTTP client, or a built-in `endpoint` POST transport (per-request header
    resolution, `same-origin` credentials by default, and an `AbortController`
    timeout that covers the response body as well as the headers - a stalled body
    fails as a `status: 0` timeout instead of hanging).
    The wire contract is the `ClipRange` object verbatim, camelCase, with a
    `clientRequestId` minted per open session as the idempotency key and no `src`.
    The player never polls; `clip:created` hands the host the server's `result`.
  - Fully headless with `ui: 'none'`: `open` / `setRange` / `setTitle` / `getRange` /
    `commit` / `close` / `configure`, the `clip:opened|changed|created|cancelled|error`
    events, and the `clipSelection` / `clipOpen` / `clipTitle` state keys all work
    with no UI package installed.
  - Peer ranges state what the package actually needs, as audited at 1.10.0:
    `@scarlett-player/clips` requires core `^1.10.0` (the release that added the
    `formatTime` export it imports); its optional ui peer is `^1.9.0`, which added
    the owner-scoped `registerControl`/`unregisterControl` options it registers with.
  - Core: the `defineState` and `StateStore` declaration-merging docblock examples
    now use `clipSelection`, matching the shipped plugin (comment-only).

## 1.10.0

### Minor Changes

- [#86](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/86) [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8) Thanks [@alexhackney](https://github.com/alexhackney)! - Review pass: state redefinition warnings, share-URL credential coverage, live
  seek clamping and playlist persistence.
  - `StateManager.define()` detects two collisions it used to miss: a key first
    defined with an explicit `undefined` default, and a plugin claiming a core
    key such as `volume`. Core defaults now come from `DEFAULT_STATE`, since core
    keys never reach the plugin default map. Identical re-runs stay silent.
  - That warning no longer builds its message with `JSON.stringify`, which threw
    on a circular default or a BigInt and turned a diagnostic into a broken
    `define()`.
  - `formatLiveTime()` reports `LIVE` for a non-finite distance instead of
    `-0:00`, which read as a precise offset derived from an unknown seekable end.
  - The default share URL also drops `id_token`, `refresh_token`, the AWS SigV4
    `x-amz-*` set and CloudFront's `key-pair-id`, so a page served from a
    presigned URL does not share its signature.
  - Media Session `seekbackward` and `seekforward` clamp at both ends of the DVR
    window. A `currentTime` recorded before the window slid sat outside the
    range, and a one-sided clamp left the target outside it too.
  - Playlist treats `tracks: []` as a supplied empty playlist rather than "no
    preference", so storage can no longer refill a list the host emptied;
    rejects a fractional persisted `currentIndex`, which passed the old `>= 0`
    test and then indexed nothing; and keeps a restored shuffle order that still
    covers every track instead of reshuffling a persisted session on every load.

  Peer dependency ranges now state the version each package actually needs,
  audited against core's and `ui`'s export surface at each release. Every plugin
  declared `^1.8.0` while importing APIs added later, so a consumer could resolve
  a core or `ui` old enough to be missing them:
  - `ui` and `audio-ui` require core `^1.10.0` - the release adding the
    `SHARED_ICON_PATHS` and `formatTime` exports they import.
  - `chapters`, `gestures`, `native`, `playlist` and `share` require core
    `^1.9.0`, which added `injectSharedStyles`, `ReleaseStyles` and
    `sanitizeUrl`.
  - `chapters`, `playlist` and `share` require `ui` `^1.9.0` for their optional
    peer. They register controls with `registerControl(id, factory, { owner })`
    and release them with `unregisterControl(id, { owner })`; the options
    argument arrived in 1.9.0, and against 1.8.0 the registration is silently
    global - the multi-player bug the `owner` scope exists to prevent.
  - `native` and `vue` declare `jsdom`, which their Vitest configs select as the
    test environment. It resolved only because pnpm satisfied Vitest's optional
    peer from another workspace package that did declare it.

- [#86](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/86) [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8) Thanks [@alexhackney](https://github.com/alexhackney)! - UI: the progress tooltip returns after a mouse leave, a leaked keydown listener
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

## 1.9.0

### Minor Changes

- [#84](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/84) [`48ffe30`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/48ffe30b5246e478e175ff9790d62f4ff68665e8) Thanks [@alexhackney](https://github.com/alexhackney)! - Accessibility, multi-player safety, casting stability, audio renditions and
  reactive Vue bindings.

  **UI controls and accessibility**
  - Keyboard shortcuts now stand down for modifier chords (Cmd/Ctrl/Alt), for a
    key another handler already consumed (`defaultPrevented`), and for the keys a
    focused widget acts on itself - Space and Enter on a button or menu item, the
    arrows and Home/End on a slider. One ArrowLeft on the progress bar seeks 5s
    again instead of 10s. Letter shortcuts (`f`, `m`, `k`) still work with a
    control focused.
  - Closing the settings menu returns focus to the gear button instead of dropping
    it to `<body>`, so a keyboard viewer is not stranded outside the player.
    Clicking elsewhere still leaves focus where the viewer put it.
  - Touching the control bar or the scrubber restarts the auto-hide timer even
    when a gestures plugin owns taps on the picture, and the bar no longer hides
    while a settings menu, quality menu or overflow tray is open.
  - The error overlay is cleared when a new source loads, and dismissing an error
    brings the big play button back instead of hiding it for the session.
  - `.sp-container` sets `isolation: isolate`, so the player's overlays stay
    inside the player rather than competing with the host page's layers.

  **Multi-player safety**
  - Plugin-contributed controls can be registered against one player
    (`registerControl(id, factory, { owner: api.container })`), and are dropped on
    that player's teardown. `chapters`, `playlist` and `share` now do this, so a
    second player on the page can no longer take over the first one's controls.
  - Shared stylesheets are reference-counted through the new
    `injectSharedStyles()` helper in core, so destroying one player no longer
    strips the styling from the players still mounted (`ui`, `gestures`,
    `chapters`, `share`, `playlist`).

  **Casting**
  - AirPlay re-attaches to the media element after a provider swap instead of
    holding the first one forever, cancels its Remote Playback availability watch
    on teardown, and opens the device picker inside the user's click gesture. The
    switch to native HLS now happens when a device actually connects, so
    cancelling the picker no longer traps the viewer on the native path.
  - The Cast SDK load times out after 10s instead of hanging player
    initialisation, and chains an existing `__onGCastApiAvailable` callback rather
    than clobbering another sender's.

  **Playback**
  - The native provider reports distinct error codes (`MEDIA_NETWORK_ERROR`,
    `MEDIA_DECODE_ERROR`, `SOURCE_LOAD_FAILED`) instead of collapsing everything
    into `PLAYBACK_FAILED`, and treats a "source not supported" error after the
    stream has parsed as a network failure, which is how Safari's native HLS
    reports a mid-stream outage. It also carries a load-session guard, so a
    superseded `load()` settles its promise and cannot fire a stale watchdog.
  - HLS exposes alternate audio renditions: `audioTracks` and `currentAudioTrack`
    state, selection through the `track:audio` event, and an Audio panel in the
    settings menu when a manifest declares more than one.

  **Embed**
  - `initAll()` initialises every player on the page concurrently, and one bad
    embed no longer stops the rest.
  - `startTime` is applied once metadata has loaded, rather than being dropped on
    a cold load.
  - Class names are tokenised on whitespace runs (a double space no longer throws)
    and a video embed with neither height nor aspect ratio falls back to 16:9
    instead of rendering 0px tall.

  **Core reactivity**
  - `effect()` keeps a stack of executing effects, so nested effects and computeds
    restore the enclosing tracking context, and re-collects dependencies on every
    run, so a signal an effect stops reading stops waking it.
  - `EventBus.once()` removes each handler individually before invoking it, so a
    handler registered from inside another once-handler survives the emit.
  - `StateChangeEvent.previousValue` reports the value the key actually held.
  - New: `ScarlettPlayer.subscribeToState()`, the push side of `getState()`.

  **Vue**
  - The player instance is held in a `shallowRef` and `markRaw`'d, removing the
    reactive-proxy overhead and the broken private-field access.
  - `isBuffering` updates when playback buffers instead of being permanently
    false, and a `live` ref is exposed alongside it.
  - Declarations are emitted with `vue-tsc`, so `@scarlett-player/vue` no longer
    ships a `dist/index.d.ts` importing a `.vue` path consumers cannot resolve.
    `publint` runs as part of the package's build.

  **Build guards**
  - Every package now type-checks its tests (`tsconfig.typecheck.json` added to
    `ui`, `audio-ui`, `playlist`, `media-session`, `embed` and `vue`).
  - New `scripts/check-package-types.mjs` compiles a throwaway consumer against
    every package's published declarations, catching a `.d.ts` that exists but
    does not resolve. Wired into CI and the release workflow.

- [#83](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/83) [`9999776`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9999776062e8e4191a0f542dc4033e8a4a17958c) Thanks [@alexhackney](https://github.com/alexhackney)! - Release v1.9.0

  ### Core
  - Asynchronous `destroy()`: Player destruction now awaits asynchronous plugin teardowns before tearing down the event bus and state manager, and returns a cached promise for concurrent teardown calls.
  - Concurrent and re-entrant plugin initialization: In-flight plugin initialization promises are cached and shared across concurrent callers, with cycle detection preserved.
  - Event contracts: Added `longOutage?: boolean` property to `error:reconnecting` event payload for extended outage notifications.
  - Source loading: Resets live state classification when starting each new source.

  ### HLS Plugin
  - Playback stall watchdog: Added bounded stall watchdog using level target duration that monitors playback progress and synthesizes recoverable errors if playback stalls.
  - Live stream auto-reconnect: Tracks explicit live classification to prevent unclassified or stale live states from bypassing playback checks.
  - Online reconnect guard: Restricts browser online event reconnects to active or in-flight reconnect cycles.
  - Extended outage notifications: Emits `longOutage: true` after prolonged reconnect attempts on live streams.
  - Seekable range fallback: Non-negative clamping for `liveSyncPosition` fallback.

  ### Analytics Plugin
  - Fetch transport: Migrated primary beacon transport to `fetch` with `keepalive: true` to support custom headers (`X-API-Key`).
  - Unload transport fallback: When `navigator.sendBeacon` returns false, falls back to keepalive `fetch`.
  - Query parameter preservation: Constructs unload beacon URL via URL searchParams to cleanly append `api_key`.
  - Unload deduplication: Deduplicates `beforeunload` and `pagehide` invocations via `session.viewEnd`.

  ### Chromecast & Native Providers
  - Chromecast ended detection: Reads `playerState` and `idleReason` from the active media session.
  - Native provider command guard: Suppresses native playback actions while `chromecastActive` is true.
  - Playback event lifecycle: Preserves single `playback:play` emission across core commands and direct element play calls without recursion.

  ### Watermark Plugin
  - Content state handling: Setting text clears previously active image URL, and setting an image clears previously active text.

  ### Vue Integration
  - Stable instance reference: Captures local reference during asynchronous setup and teardown in `ScarlettPlayer.vue`.

  ### UI & Embed
  - Container class management: Preserves host-owned `sp-container` classes during plugin teardown.
  - Seek safety: Non-finite seek position guards preventing unexpected seeks to beginning.
  - Embed release alignment: Deployment documentation aligned with `v${VERSION}` CDN release contracts.

### Patch Changes

- [#84](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/84) [`48ffe30`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/48ffe30b5246e478e175ff9790d62f4ff68665e8) Thanks [@alexhackney](https://github.com/alexhackney)! - Review fixes: control-registration scoping, plugin teardown and reactive
  context correctness.

  **Core**
  - `setCurrentEffect()` now replaces the innermost tracking frame instead of
    pushing a new one. The documented save/restore idiom
    (`const prev = getCurrentEffect(); setCurrentEffect(x); setCurrentEffect(prev)`)
    grew the effect stack by a frame on every restore, so the enclosing
    `effect()`'s own unwind landed on `x` rather than clearing the context.
  - `StateManager` dispatches change events over a snapshot of its subscribers. A
    subscriber that unsubscribed and resubscribed while handling an event was
    re-added mid-iteration and notified twice for one change.
  - `injectSharedStyles()` holds the element it claimed rather than resolving the
    id again at release time. A host that swapped the sheet for its own `<style>`
    under the same id had the replacement deleted by a release that never owned
    it.

  **Control registration (chapters, playlist, share)**
  - Teardown unregisters only the ids the plugin registered.
    `unregisterControlsFor(owner)` dropped every control scoped to the player's
    container, so destroying one plugin also unregistered the controls its
    neighbours had registered against the same container.
  - The runtime `import('@scarlett-player/ui')` is guarded by an init generation.
    A resolve that landed after `destroy()` registered a control wired to a
    torn-down instance, and overwrote a later lifecycle's registration.

  **UI**
  - `QualityMenu` closes itself when the rendition list empties. The control bar's
    auto-hide waits on `isMenuOpen()`, so a menu left open behind the now hidden
    control kept the bar on screen for the rest of the session.
  - Every handler that changes the error overlay's visibility (`error`,
    `error:reconnecting`, `error:recovered`, `media:loaded`) now schedules a
    render. The big play button reads the overlay's visibility rather than state,
    and `media:loaded` carries no state write to drive one, so the button stayed
    hidden over a freshly loaded source.

  **HLS**
  - Tearing down the event handlers clears `audioTracks` and `currentAudioTrack`.
    Neither was reset on a source switch, and the native provider clears
    `qualities` but has never touched these, so the previous stream's audio menu
    survived into the next one.
  - `audioTrackIndex()` requires the whole id to match the canonical `audio-N`
    form. Stripping the prefix and calling `parseInt` accepted `audio-2invalid`
    and `audio-02` as rendition 2.

  **Chromecast**
  - `resetCastLoader()` rejects the in-flight load instead of muting it. Callers
    holding the promise from `loadCastSDK()` were left awaiting one that nothing
    would ever settle.

  **AirPlay**
  - `destroy()` always detaches from the video element. Gating it on
    `isAirPlaySupported()` leaked the listeners whenever support was reported
    differently at teardown than at init.

## 1.8.1

## 1.8.0

### Minor Changes

- [#76](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/76) [`443b52b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/443b52be734250f3b461709c38f6959b0a78c608) Thanks [@alexhackney](https://github.com/alexhackney)! - The control bar fits itself, and the menus fit the player.

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
  oscillating. The volume control is planned at its expanded width, because its
  slider grows from 0 to 64px on hover and on focus without the container
  resizing, which would otherwise push the pinned right-hand controls past the
  clipping edge at any width where the collapsed bar only just fits.
  `priority` re-ranks or pins individual slots, and `responsive: false` restores
  the previous behaviour exactly: no measuring, no observer, no tray, no extra
  DOM.

  The `quality` control hides rather than moving to the tray, which the other
  low-priority controls do. Its menu is bounded by `--sp-menu-max-height`, and
  that bound is sized for a menu anchored in the bar, so a quality menu opened
  from the tray (which sits above the bar) would run off the top of the player.
  The settings menu carries a Quality row whenever there are qualities to choose.
  That is a promise about the layout rather than the control, so `uiPlugin()`
  throws on a layout that has `quality` without `settings`, unless `quality` is
  pinned or `responsive` is off.

  The tray is a horizontal wrapping strip, not a vertical menu: eight 44px rows
  would be over 350px tall against a 211px portrait phone player, and a scrolling
  panel would clip the popovers registered controls own. Controls are moved, never
  re-rendered or wrapped, so a captions button in the tray still emits
  `track:text`.

  The settings and quality menus are now bounded to the player's height through
  `--sp-menu-max-height`, written by the same ResizeObserver, and are
  `box-sizing: border-box` so that bound is the height they actually render:
  `max-height` bounds the content box, and the quality menu's 8px and the settings
  main menu's 4px of vertical padding rendered past it. The speed sub-panel
  is 253px against a 211px player, so without that it lost its Back header and its
  first three speeds to the host's `overflow: hidden`, which kept playback speed
  unreachable even once the bar fitted.

  Wherever a coarse pointer is available (`any-pointer: coarse`, which is also
  true of a touchscreen laptop driven by a mouse, unlike the primary-pointer
  `pointer: coarse`) the progress wrapper grows upward to 44px. The control bar is
  a later sibling at the same z-index and covers 48..56px from the bottom, so the
  exclusive scrub region was 12px, not the 20px the wrapper suggested. The visible
  3px bar does not move.

  The fullscreen button and the `f` shortcut now go through the core fullscreen
  helpers, so they behave the same as `player.requestFullscreen()`, iPhone
  fallback included, and the button decides its direction from the browser rather
  than from a state key that could be stale. `env(safe-area-inset-bottom)` is
  composed in through `--sp-inset-bottom`, scoped to `:fullscreen` (and
  `:-webkit-full-screen`): applied unconditionally it would push an inline
  player's controls up on any `viewport-fit=cover` page.

  The `@scarlett-player/core` peer range moves to `^1.8.0`, which is the version
  that exports those helpers.

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Reports its real version, and requires `@scarlett-player/core@^1.7.0`.

  The descriptor's `version` was the hand-written literal '1.0.0' while the
  package published at 1.7.0, so anything that read a version off the plugin
  reported a number that had not been true since the descriptor was written
  (measured 2026-09-02). It comes from the package's own package.json now:
  `src/version.ts` reads a `__PKG_VERSION__` define set by the new
  `tsup.config.ts`, with a '0.0.0-dev' fallback for test runs. The `build` and
  `dev` scripts call plain `tsup`, so the entry points, formats and `--dts` flag
  are written down once in the config instead of twice in package.json. The
  move does not change what tsup emits: the md5 of `dist/index.d.ts` and
  `dist/index.d.cts` is unchanged across it (compared 2026-09-02).

  The `@scarlett-player/core` peer range moves from `^1.0.3` to `^1.7.0`.
  The old ranges were
  wrong across the workspace, not merely inconsistent: three of the packages
  declaring `^1.0.3` (audio-ui, media-session, ui) call `defineState`, which core
  gained in 1.4.0. Changesets is configured with
  `onlyUpdatePeerDependentsWhenOutOfRange`, so future minors of core will not
  cascade this into a major.

  The `@example` docblock shows `createPlayer()`. The `new ScarlettPlayer(...)`
  shape it used to show left the player with a provider and nothing else before
  core 1.7.1, so anyone copying the example got no controls and no working
  "Try Again".

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Big play button over the poster, on by default.

  A poster with no visible play affordance is worse for the viewer than no
  poster: on desktop a click on the picture only revealed the control bar
  (touch taps belong to `@scarlett-player/gestures`), so the only way to start a
  video was the small button in the bar. `BigPlayButton` is a real `<button>`
  with an `aria-label`, rendered into the container like the error overlay,
  sized past the control bar's 44 px minimum target and coloured with
  `--sp-accent`.

  It is visible before playback starts and again as Replay when playback ends,
  hidden from the first `playing` onward, hidden while the source is loading
  (the spinner owns that state) and while an error is set or the error overlay
  is showing. It updates from the same `scheduleUpdate()` pass as every other
  control, and its z-index puts it above the gestures plugin's tap surface, so a
  tap starts playback rather than toggling the controls, exactly as the control
  bar's play button already behaved.

  `UIPluginConfig.bigPlayButton: false` turns it off for a host page that draws
  its own affordance.

  It reads `video.ended` rather than the `ended` state key. Measured in Chrome
  on 2026-09-02: neither provider clears that key on a replay (only `load()`
  does), so it stays true for the rest of the session, and a control trusting it
  would sit over playing video. The control bar's play button has the same
  source and does show "Replay" while a replayed video plays; that is a separate
  provider defect, untouched here.

## 1.7.0

### Patch Changes

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

## 1.5.1

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

- [#55](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/55) [`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c) Thanks [@alexhackney](https://github.com/alexhackney)! - Picture-in-Picture readiness gate: the PiP button is disabled until media metadata is loaded (entering PiP earlier rejects with InvalidStateError), every PiP call is caught so a failure can never surface as an unhandled rejection, Safari's presentation-mode path gets the same gate, and the button swaps to the exit icon while in PiP. The native provider now tracks PiP events so the pip state stays accurate on that path. Keyboard play and fullscreen shortcuts no longer leak promise rejections, and the error overlay has specific copy for append, buffer-full, and invalid-playlist failures.

## 1.1.1

## 1.1.0

### Minor Changes

- [#46](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/46) [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f) Thanks [@alexhackney](https://github.com/alexhackney)! - Make failure handling viewer-friendly: no silent hangs, self-healing reconnects, accurate error messages, and a Try Again that actually recovers.

  **No more permanent spinners.** Manifest-phase network errors (404/403, expired token, origin down) previously died silently after one recovery attempt because `startLoad()` cannot retry a manifest that never parsed, leaving `player.init()` pending forever. Manifest errors now retry with `loadSource()`, and a load watchdog (`loadTimeoutMs`, default 30s) guarantees every load attempt terminates with a real error.

  **Self-healing playback.** After a fatal network/media error mid-playback, the HLS provider now auto-reconnects with capped exponential backoff (configurable via `autoReconnect`, `reconnectBaseDelayMs`, `reconnectMaxDelayMs`, `reconnectWindowMs`), reconnects immediately when the browser comes back online, restores the viewer's VOD position from the moment of failure, and rejoins live streams at the live edge. The overlay shows "Connection lost. Reconnecting..." while working and hides itself on recovery. Retry budgets also reset once media flows again, so transient blips spread across a long live event no longer permanently consume them.

  **Accurate error messages.** Fatal HLS errors now carry structured codes (`MEDIA_NETWORK_ERROR`, `MEDIA_DECODE_ERROR`, `PLAYBACK_FAILED`) and the overlay maps codes before falling back to prose matching, so a network outage shows the connection message instead of "Something went wrong." The `error` state key is now populated from every error event (and cleared on successful load); it was previously declared but never written. New events: `error:reconnecting` and `error:recovered`.

  **Try Again fixed.** The overlay's retry now emits `error:retry`, which the core handles by reloading through the provider path and restoring position (live streams rejoin the live edge). It previously wrote the raw manifest URL onto the MSE-backed video element and reset playback to 0.

  Native HLS (Safari) fatal video errors are now surfaced as structured player errors instead of failing silently, and the native provider gained the same load watchdog.

### Patch Changes

- [#46](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/46) [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f) Thanks [@alexhackney](https://github.com/alexhackney)! - Fix control clicks being silently dropped, most visibly the first click on the play button.

  `update()` ran on every state change (`timeupdate` and `progress` alone fire several times a second) and unconditionally reassigned `innerHTML`, rebuilding each control's icon even when the markup was identical. When that happened between a user's `mousedown` and `mouseup`, the node that received the `mousedown` no longer existed and the browser never dispatched the `click`, so the press did nothing.

  Control rendering is now idempotent - `innerHTML` and attributes are only written when the value actually changes - and state-driven renders are coalesced to one per animation frame instead of one per state key. In a browser harness clicking play on a freshly loaded HLS stream, dropped first clicks went from 12/12 to 0/12, and play-button DOM mutations over a 40-click run dropped from 644 to 160.

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
