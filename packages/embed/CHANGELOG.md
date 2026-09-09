# Changelog

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

- Updated dependencies [[`52568a9`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/52568a9b2540096f84f741f4541549642e734725), [`274ed3e`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/274ed3e47fbac1eddf9f01d3362e9f06e236f806)]:
  - @scarlett-player/core@1.12.0

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

### Patch Changes

- Updated dependencies [[`e2ebd22`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/e2ebd22b3fde1a38e18e81ee8a1aef0afa7e892c)]:
  - @scarlett-player/core@1.11.0

## 1.10.0

### Minor Changes

- [#86](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/86) [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8) Thanks [@alexhackney](https://github.com/alexhackney)! - Embed: bundled workspace packages are no longer runtime dependencies, the
  iframe error path escapes its message, and shared CDN chunks are
  version-stamped so a cached bundle cannot pair with a newer chunk.
  - The package declared 12 `@scarlett-player/*` packages plus `hls.js` as
    runtime `dependencies` while `vite.config.ts` bundles every one of them, so
    consumers installed 13 packages they never load. Eleven of them and `hls.js`
    moved to `devDependencies`. `@scarlett-player/core` stays a dependency: the
    emitted declarations import from it, so a TypeScript consumer needs it
    resolvable.
  - `iframe.html` interpolated `${error.message}` into `document.body.innerHTML`.
    The message can carry the `src` from the query string and the page is served
    from the CDN origin, so the error node is now built with `textContent`.
  - The shared hls.js chunks are emitted as `hls.<version>.js` and
    `hls.light.<version>.js`. `latest/` is mutable and cached for an hour while
    `v<version>/` is immutable, so a browser holding a cached `latest/hls.js`
    could pair it with a freshly fetched `latest/embed.js` from the next release.
    A cached bundle now keeps importing the exact chunk it was built against.

### Patch Changes

- Updated dependencies [[`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8), [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8), [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8), [`9b04fc4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9b04fc4408821eff0ce3d11cfba6c70784c2a9e8)]:
  - @scarlett-player/core@1.10.0

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

- Updated dependencies [[`48ffe30`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/48ffe30b5246e478e175ff9790d62f4ff68665e8), [`48ffe30`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/48ffe30b5246e478e175ff9790d62f4ff68665e8), [`9999776`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9999776062e8e4191a0f542dc4033e8a4a17958c), [`48ffe30`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/48ffe30b5246e478e175ff9790d62f4ff68665e8)]:
  - @scarlett-player/hls@1.9.0
  - @scarlett-player/core@1.9.0
  - @scarlett-player/ui@1.9.0
  - @scarlett-player/native@1.9.0
  - @scarlett-player/analytics@1.9.0
  - @scarlett-player/playlist@1.9.0
  - @scarlett-player/media-session@1.9.0
  - @scarlett-player/audio-ui@1.9.0
  - @scarlett-player/captions@1.9.0
  - @scarlett-player/watermark@1.9.0
  - @scarlett-player/share@1.9.0
  - @scarlett-player/gestures@1.9.0

## 1.8.1

### Patch Changes

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - Avoid using window.location.href as embedBaseUrl in iframe.html to prevent leaking signed or credentialed playback URLs in shared embed snippets.

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - The embed can share the page it is on.

  `@scarlett-player/share` now ships in the Full and Video embed builds, and a new
  `data-share-url` attribute, `shareUrl` option and `share-url` iframe parameter
  carry the page URL through to it. The share plugin's `embed` target has been
  writing `shareUrl` into the snippets it generates since it landed, but
  `iframe.html` never read the parameter and no embed build contained the plugin,
  so a snippet copied out of one player produced an iframe with no share button
  and a URL nobody looked at.

  Opt in, and video only. With no share URL the control bar is unchanged, because
  the button has nothing to offer: the plugin will not fall back to the media
  `src`, which is frequently signed. The audio builds are unaffected, since the
  audio UIs have no control registry to register a button into. Inside
  `iframe.html` the page also passes its own URL as `embedBaseUrl`, so the
  sheet's embed code is a working copy of the player the viewer is watching.

- Updated dependencies [[`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1), [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1), [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1), [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1), [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1), [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1)]:
  - @scarlett-player/analytics@1.8.1
  - @scarlett-player/audio-ui@1.8.1
  - @scarlett-player/captions@1.8.1
  - @scarlett-player/gestures@1.8.1
  - @scarlett-player/hls@1.8.1
  - @scarlett-player/media-session@1.8.1
  - @scarlett-player/native@1.8.1
  - @scarlett-player/playlist@1.8.1
  - @scarlett-player/share@1.8.1
  - @scarlett-player/watermark@1.8.1
  - @scarlett-player/core@1.8.1
  - @scarlett-player/ui@1.8.1

## 1.8.0

### Minor Changes

- [#76](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/76) [`443b52b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/443b52be734250f3b461709c38f6959b0a78c608) Thanks [@alexhackney](https://github.com/alexhackney)! - Video embeds ship touch gestures.

  `@scarlett-player/gestures` gives a phone viewer double-tap seeking on the sides
  of the picture and tap to toggle the controls. tsp-web's wrapper already
  registered it; no embed build did, and neither did the demo, so every
  CDN embed on a phone was missing the interaction every phone viewer already
  knows from YouTube. It matters more now that the control bar moves the skip
  buttons into its overflow tray on a narrow player: gestures are what replaces
  them there.

  On by default for `type="video"`, with `data-gestures="false"` (or
  `gestures: false`) as the kill switch for a page that owns those gestures
  itself. The audio builds do not ship it, and the plugin self-disables for audio
  anyway. It arms itself by input type, not by user agent: `enabled` defaults to
  `'auto'`, gated on `matchMedia('(any-pointer: coarse)')`, so it installs
  wherever a coarse pointer exists, a touchscreen laptop included, and a mouse
  still never triggers any of it.

### Patch Changes

- Updated dependencies [[`443b52b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/443b52be734250f3b461709c38f6959b0a78c608), [`443b52b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/443b52be734250f3b461709c38f6959b0a78c608)]:
  - @scarlett-player/core@1.8.0
  - @scarlett-player/ui@1.8.0
  - @scarlett-player/analytics@1.8.0
  - @scarlett-player/audio-ui@1.8.0
  - @scarlett-player/captions@1.8.0
  - @scarlett-player/gestures@1.8.0
  - @scarlett-player/hls@1.8.0
  - @scarlett-player/media-session@1.8.0
  - @scarlett-player/native@1.8.0
  - @scarlett-player/playlist@1.8.0
  - @scarlett-player/watermark@1.8.0

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The embed plays what it advertises, ships every chunk, and ships its types again.

  **Native provider.** No embed build registered one, so `selectProvider()` had
  only the HLS provider to choose from and its `canPlay()` accepts nothing but
  `.m3u8`. Every `.mp3` and `.mp4` source failed with `PROVIDER_NOT_FOUND`, in all
  three builds, including the audio one. `PluginCreators` gains a `native` slot,
  all three entries pass `createNativePlugin`, and it is registered after the HLS
  provider so HLS keeps `.m3u8` (the native provider's extension list has no
  `m3u8` entry, so it never competes for a manifest, not even in Safari).

  **Light hls.js in the audio build.** `index-audio.ts` now imports from
  `@scarlett-player/hls/light`. The light build drops in-stream subtitles, ID3 and
  EME; the audio build ships no captions plugin and audio embeds are not DRM
  sources, so ID3 timed metadata is the one capability lost, and the README says
  so. `embed.audio.umd.cjs` went from 606,592 bytes (181,604 gzip) at 1.7.0 to
  about 433,000 (130,000 gzip), a 29 percent drop, and the audio build's lazy ES
  chunk from 1,115,611 bytes to 734,717. The native provider costs the video and
  full builds about 6 kB each, which is why `embed.umd.cjs` grew slightly.

  **Chunk naming.** `chunkFileNames` was the fixed string `'hls.js'`, which
  assumed one chunk per build. The playlist plugin pulls its controls in through
  `void import('@scarlett-player/ui')`, so the audio build produced a second
  chunk that Rollup deduplicated to `hls2.js`, a name `scripts/upload-cdn.sh`
  never uploaded: `embed.audio.js` on the CDN imported `./hls2.js` and got a 404,
  and the playlist plugin swallowed the failed import with a log line, so the CDN
  audio build had no prev/next controls and nothing went red. That shipped from
  the v1.6.0 release on 2026-08-11, the first release containing the dynamic
  import, and was still reproducible on 2026-09-02 against the v1.6.0, v1.7.0 and
  latest CDN copies. Chunks are now named per build: `hls.js` for the full and
  video builds (byte-identical, so one copy serves both), `hls.light.js` for the
  audio build's light hls.js, and `<build>.<chunk>.js` for anything else, so two
  builds sharing one `dist` cannot overwrite each other. The upload script takes
  dist by glob instead of a hand list, and
  `scripts/check-embed-chunks.mjs` fails the build if any bundle imports a chunk
  that is not there.

  **Declarations.** `package.json` promised `dist/index.d.ts`,
  `dist/index-video.d.ts` and `dist/index-audio.d.ts`, and the 1.7.0 tarball
  contained no `.d.ts` at all: the build runs `tsc` and then three Vite builds
  into one directory, and the first Vite build had `emptyOutDir: true`, which
  deleted the declarations `tsc` had just emitted. A consumer with
  `noImplicitAny` on (the `strict` default) could not compile an import of the
  package at all, error TS7016; with it off the module was typed `any` in
  silence. `emptyOutDir` is now `false`
  for all three builds, the package's `build` script does the cleaning with
  `rimraf dist tsconfig.tsbuildinfo` (the buildinfo because a stale one makes a
  composite project emit nothing), `tsc` emits declarations only so the raw
  compiler output no longer lands in the tarball or on the CDN, and `types` comes
  first in every `exports` condition. `scripts/check-package-artifacts.mjs` fails
  the build if any workspace manifest points at a file that is not on disk.

  **Mixed exports.** `output.exports: 'named'` silences Rollup's "named and
  default exports together" warning for all three entries.
  `scripts/verify-browser.mjs` now loads the built UMD in a real browser and
  asserts `window.ScarlettPlayer.create` is a function, `availableTypes` is
  present, and nothing moved behind `.default`.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - `window.ScarlettPlayer.version` is the version the embed was actually built
  from.

  The three entries carried the hand-written literals '0.5.3', '0.5.3-video' and
  '0.5.3-audio' while the package published at 1.7.0, and the CDN's
  `latest/embed.umd.cjs` still answered `window.ScarlettPlayer.version === '0.5.3'`
  when loaded in Chrome (both measured 2026-09-02). That string is the only thing
  support can read off a live page to tell which build a viewer is running, so it
  was worse than useless: it named a release that never shipped.

  The value comes from the package's own package.json now, through a
  `__PKG_VERSION__` define in `vite.config.ts` read by `src/version.ts`, with a
  '0.0.0-dev' fallback for test runs. The `-video` and `-audio` suffixes stay, as
  `1.7.0-video` and `1.7.0-audio`. `scripts/verify-browser.mjs` loads the built
  UMD in a real browser and asserts the global's `version` equals
  `packages/embed/package.json`, because nothing short of a browser load can prove
  the define survived the bundle.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The iframe embed loads, the big play button is configurable, and the shared hls chunk is guarded.

  **iframe embed.** `iframe.html` never worked, on two counts, both dating to the
  initial release (2b8fd69, 2025-12-14). It called `module.create(config)` on the
  imported bundle, but the ES build exports the API object as its default
  (`ScarlettPlayerAPI as default`) alongside three named helpers, so
  `module.create` was `undefined` and the page rendered its own "Error Loading
  Player" screen; it now calls `module.default.create(config)` and awaits the
  promise that returns. It also imported `./dist/embed.js`, which only matches the
  npm tarball layout. `scripts/upload-cdn.sh` uploads the page BESIDE the bundles,
  so on the CDN it is `latest/iframe.html` next to `latest/embed.js` and
  `latest/dist/embed.js` is a 404: the hosted iframe embed has never loaded a
  player. The import now tries `./embed.js` first and falls back to
  `./dist/embed.js`, so both layouts work.

  **`bigPlayButton`.** `@scarlett-player/ui` has had a `bigPlayButton` option
  since the control landed, but nothing reached it from an embed: a page that
  draws its own play affordance over the player had no way to turn the centred
  one off short of dropping the whole UI plugin with `data-controls="false"`.
  `EmbedConfig` gains the field, the parser reads `data-big-play-button` with
  the same convention as the other booleans (only the exact string `"false"`
  turns it off), `iframe.html` reads a `big-play-button` query parameter, and
  the video branch forwards it to the UI plugin only when it is set, so an
  embed that says nothing keeps the plugin's own default rather than pinning a
  second copy of it. The audio UIs have no such control and are untouched.

  **Shared chunk guard.** The three builds write into one `dist` with
  `emptyOutDir: false`, and `chunkFileNames` leaves two names unprefixed,
  `hls.js` and `hls.light.js`, on the strength of the full and video builds
  emitting the same file. Nothing enforced that:
  `scripts/check-embed-chunks.mjs` asserts only that a chunk a bundle imports
  exists, and after a silent overwrite it still would. A Rollup hook in
  `vite.config.ts` now reads whatever sits at a shared chunk's path before the
  write and fails the build if the bytes differ, which is exactly the moment
  the video build would overwrite the full build's copy. The check script also
  asserts that the unprefixed names in `dist` are exactly those two, so a
  `chunkFileNames` regression that drops a build prefix is caught before it can
  collide.

  **Dead `data-share-url` docs.** The README attribute row and the iframe
  `shareUrl` / `share-url` parameter landed with the share plugin on 2026-08-10
  (044114c) and were never wired up: no embed build registers
  `@scarlett-player/share`, `EmbedConfig` has no `shareUrl`, and
  `parseDataAttributes()` never read the attribute, so the value went nowhere.
  Both are removed rather than left documenting a feature that does not exist.
  Registering the share plugin in the embed builds is a tracked follow-up.

- Updated dependencies [[`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8), [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8)]:
  - @scarlett-player/core@1.7.1
  - @scarlett-player/analytics@1.7.1
  - @scarlett-player/audio-ui@1.7.1
  - @scarlett-player/captions@1.7.1
  - @scarlett-player/hls@1.7.1
  - @scarlett-player/media-session@1.7.1
  - @scarlett-player/native@1.7.1
  - @scarlett-player/playlist@1.7.1
  - @scarlett-player/ui@1.7.1
  - @scarlett-player/watermark@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [[`2194db7`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2194db7037aec7456475d7f9da0fc4a0fb1facb0)]:
  - @scarlett-player/core@1.7.0
  - @scarlett-player/hls@1.7.0
  - @scarlett-player/ui@1.7.0
  - @scarlett-player/analytics@1.7.0
  - @scarlett-player/audio-ui@1.7.0
  - @scarlett-player/captions@1.7.0
  - @scarlett-player/media-session@1.7.0
  - @scarlett-player/playlist@1.7.0
  - @scarlett-player/watermark@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies [[`55cf252`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/55cf2525bf5e92200a121cd0a0796f8786835e4d)]:
  - @scarlett-player/core@1.6.0
  - @scarlett-player/analytics@1.6.0
  - @scarlett-player/audio-ui@1.6.0
  - @scarlett-player/captions@1.6.0
  - @scarlett-player/hls@1.6.0
  - @scarlett-player/media-session@1.6.0
  - @scarlett-player/playlist@1.6.0
  - @scarlett-player/ui@1.6.0
  - @scarlett-player/watermark@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [[`8c2eca3`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8c2eca3d3d53895fa99ae53efac802cf58be81d5)]:
  - @scarlett-player/core@1.5.1
  - @scarlett-player/analytics@1.5.1
  - @scarlett-player/audio-ui@1.5.1
  - @scarlett-player/captions@1.5.1
  - @scarlett-player/hls@1.5.1
  - @scarlett-player/media-session@1.5.1
  - @scarlett-player/playlist@1.5.1
  - @scarlett-player/ui@1.5.1
  - @scarlett-player/watermark@1.5.1

## 1.5.0

### Patch Changes

- [#62](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/62) [`044114c`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/044114ca29c675c4dea643882b966a27bb1b6afa) Thanks [@alexhackney](https://github.com/alexhackney)! - New package: `@scarlett-player/share`.

  A share control for the player - the OS share sheet on mobile, copy link, social targets, embed codes, and playback timestamps. Zero configuration shares the current page URL with the position appended; the host adds `'share'` to its control layout to place the button.

  **Mobile is the primary path.** Where `navigator.share` exists and no custom target list is configured, tapping the button opens the native sheet directly rather than putting an in-player menu in front of it. When the in-player sheet is used it is a bottom sheet within thumb reach, with a grab handle and `env(safe-area-inset-bottom)` honoured, promoting to a popover at 640px and up. Targets are 72px tall with press rather than hover states, the manual-copy fallback uses 16px text so iOS Safari does not zoom the viewport, and `prefers-reduced-motion` is respected. The sheet renders inside the player container so it survives fullscreen, traps focus, closes on Escape, and restores focus to the button.

  **What gets shared is the page, never the media `src`.** Playback URLs are frequently signed, so sharing one would leak a credential and produce a link that expires. There is no configuration or code path that falls back to `src`, and a test asserts it. The URL defaults to `window.location.href` and is overridable - which matters most inside `iframe.html`, where `window.location.href` is the player page and cross-origin rules block reading the parent. `@scarlett-player/embed` now accepts a `shareUrl` parameter for exactly that, and the `embed` target generates snippets with it already set.

  Timestamps are applied through the URL API, so an existing query string or fragment survives and re-sharing replaces the previous timestamp instead of appending a second. Live media never gets one, since an offset into a sliding DVR window is meaningless to the recipient. A dismissed native sheet rejects with `AbortError` and is treated as a choice rather than an error, and the clipboard falls back through `execCommand` to showing the link for manual copying.

- Updated dependencies [[`044114c`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/044114ca29c675c4dea643882b966a27bb1b6afa)]:
  - @scarlett-player/captions@1.5.0
  - @scarlett-player/core@1.5.0
  - @scarlett-player/hls@1.5.0
  - @scarlett-player/ui@1.5.0
  - @scarlett-player/analytics@1.5.0
  - @scarlett-player/playlist@1.5.0
  - @scarlett-player/media-session@1.5.0
  - @scarlett-player/audio-ui@1.5.0
  - @scarlett-player/watermark@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [[`61230aa`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/61230aaca8bc8dcbbeb48d662a4f53f8d2c2a46c)]:
  - @scarlett-player/core@1.4.0
  - @scarlett-player/ui@1.4.0
  - @scarlett-player/analytics@1.4.0
  - @scarlett-player/audio-ui@1.4.0
  - @scarlett-player/captions@1.4.0
  - @scarlett-player/hls@1.4.0
  - @scarlett-player/media-session@1.4.0
  - @scarlett-player/playlist@1.4.0
  - @scarlett-player/watermark@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [[`0796a44`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0796a4477bdfd804d2e76468d42a0046a8da3a4f)]:
  - @scarlett-player/captions@1.3.0
  - @scarlett-player/core@1.3.0
  - @scarlett-player/hls@1.3.0
  - @scarlett-player/ui@1.3.0
  - @scarlett-player/analytics@1.3.0
  - @scarlett-player/playlist@1.3.0
  - @scarlett-player/media-session@1.3.0
  - @scarlett-player/audio-ui@1.3.0
  - @scarlett-player/watermark@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [[`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c), [`2828556`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/2828556b09bd2cc2e9c62d7f8e74ce325984c34c)]:
  - @scarlett-player/ui@1.2.0
  - @scarlett-player/hls@1.2.0
  - @scarlett-player/core@1.2.0
  - @scarlett-player/analytics@1.2.0
  - @scarlett-player/audio-ui@1.2.0
  - @scarlett-player/captions@1.2.0
  - @scarlett-player/media-session@1.2.0
  - @scarlett-player/playlist@1.2.0
  - @scarlett-player/watermark@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies [[`db2d670`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/db2d670cdaf2feb287702e4cfe536e5a07d24b54)]:
  - @scarlett-player/playlist@1.1.1
  - @scarlett-player/core@1.1.1
  - @scarlett-player/hls@1.1.1
  - @scarlett-player/ui@1.1.1
  - @scarlett-player/analytics@1.1.1
  - @scarlett-player/media-session@1.1.1
  - @scarlett-player/audio-ui@1.1.1
  - @scarlett-player/captions@1.1.1
  - @scarlett-player/watermark@1.1.1

## 1.1.0

### Patch Changes

- Updated dependencies [[`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f), [`d3259c4`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d3259c4e33760e59ce038acb2fff6fdc5c1a7d80), [`29c560d`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/29c560d3a199acb598f99ff1226b7c602775839f)]:
  - @scarlett-player/core@1.1.0
  - @scarlett-player/hls@1.1.0
  - @scarlett-player/ui@1.1.0
  - @scarlett-player/playlist@1.1.0
  - @scarlett-player/analytics@1.1.0
  - @scarlett-player/audio-ui@1.1.0
  - @scarlett-player/captions@1.1.0
  - @scarlett-player/media-session@1.1.0
  - @scarlett-player/watermark@1.1.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`5125447`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/5125447248d1c6579db18f5d64585016e02a26a9)]:
  - @scarlett-player/hls@1.0.3
  - @scarlett-player/core@1.0.3
  - @scarlett-player/ui@1.0.3
  - @scarlett-player/analytics@1.0.3
  - @scarlett-player/playlist@1.0.3
  - @scarlett-player/media-session@1.0.3
  - @scarlett-player/audio-ui@1.0.3
  - @scarlett-player/captions@1.0.3
  - @scarlett-player/watermark@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`e2d5469`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/e2d54691f9b5297ce564c4089bb7c05482a3269d)]:
  - @scarlett-player/watermark@1.0.2
  - @scarlett-player/core@1.0.2
  - @scarlett-player/hls@1.0.2
  - @scarlett-player/ui@1.0.2
  - @scarlett-player/analytics@1.0.2
  - @scarlett-player/playlist@1.0.2
  - @scarlett-player/media-session@1.0.2
  - @scarlett-player/audio-ui@1.0.2
  - @scarlett-player/captions@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`8a36597`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/8a365974bb67fa7ea945a3f2594112ac27cd75f4)]:
  - @scarlett-player/playlist@1.0.1
  - @scarlett-player/core@1.0.1
  - @scarlett-player/hls@1.0.1
  - @scarlett-player/ui@1.0.1
  - @scarlett-player/analytics@1.0.1
  - @scarlett-player/media-session@1.0.1
  - @scarlett-player/audio-ui@1.0.1
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/watermark@1.0.0

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

### Patch Changes

- Updated dependencies [[`96bbb45`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/96bbb45881c45f2a183d1a56337bab1e47648ba7)]:
  - @scarlett-player/core@1.0.0
  - @scarlett-player/playlist@1.0.0
  - @scarlett-player/hls@1.0.0
  - @scarlett-player/watermark@1.0.0
  - @scarlett-player/captions@1.0.0
  - @scarlett-player/analytics@1.0.0
  - @scarlett-player/audio-ui@1.0.0
  - @scarlett-player/media-session@1.0.0
  - @scarlett-player/ui@1.0.0

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

- Updated dependencies []:
  - @scarlett-player/core@0.5.3
  - @scarlett-player/hls@0.5.3
  - @scarlett-player/analytics@0.5.3
  - @scarlett-player/audio-ui@0.5.3
  - @scarlett-player/media-session@0.5.3
  - @scarlett-player/playlist@0.5.3
  - @scarlett-player/ui@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`42b224b`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/42b224b65270277e28097af5d31f69a3c24ab471)]:
  - @scarlett-player/core@0.5.2
  - @scarlett-player/ui@0.5.2
  - @scarlett-player/analytics@0.5.2
  - @scarlett-player/audio-ui@0.5.2
  - @scarlett-player/hls@0.5.2
  - @scarlett-player/media-session@0.5.2
  - @scarlett-player/playlist@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`4ddc188`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/4ddc18809b81f98133cfe816a857d6f2b5916c59)]:
  - @scarlett-player/core@0.5.1
  - @scarlett-player/ui@0.5.1
  - @scarlett-player/analytics@0.5.1
  - @scarlett-player/audio-ui@0.5.1
  - @scarlett-player/hls@0.5.1
  - @scarlett-player/media-session@0.5.1
  - @scarlett-player/playlist@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`0eeb5c1`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/0eeb5c19777298371490cfad60bca4ef9b4c8734)]:
  - @scarlett-player/core@0.5.0
  - @scarlett-player/ui@0.5.0
  - @scarlett-player/hls@0.5.0
  - @scarlett-player/analytics@0.5.0
  - @scarlett-player/playlist@0.5.0
  - @scarlett-player/media-session@0.5.0
  - @scarlett-player/audio-ui@0.5.0

All notable changes to the @scarlett-player/embed package will be documented in this file.

## [0.1.0] - 2025-12-14

### Added

- Initial release of the embed package
- Auto-initialization via data attributes (`data-scarlett-player`)
- Global API (`window.ScarlettPlayer`) for programmatic control
- Support for all common configuration options via data attributes:
  - `data-src` - Video source URL
  - `data-autoplay` - Auto-play on load
  - `data-muted` - Start muted
  - `data-poster` - Poster image
  - `data-controls` - Show/hide UI
  - `data-brand-color` - Custom branding
  - `data-aspect-ratio` - Responsive sizing
  - And many more...
- UMD bundle for CDN/script tag usage
- ES module bundle for modern bundlers
- iframe embed helper page with URL parameter support
- TypeScript type definitions
- Comprehensive demo page with 5+ examples
- Full documentation and setup guide

### Features

- **Self-contained Bundle**: Includes core, HLS, and UI plugins
- **Multi-tenant Support**: Easy branding via color attributes
- **Auto-initialization**: Finds and initializes all players on page load
- **Programmatic API**: Create and control players with JavaScript
- **iframe Support**: Helper page for secure iframe embeds
- **Keyboard Shortcuts**: Built-in keyboard navigation
- **Responsive**: Aspect ratio support for responsive layouts
- **TypeScript**: Full type definitions included

### Bundle Output

- `embed.js` - ES module (~260KB minified, ~85KB gzipped)
- `embed.umd.cjs` - UMD bundle for script tags
- `embed.d.ts` - TypeScript definitions
- Source maps for both bundles

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

### Dependencies

- @scarlett-player/core ^0.1.0
- @scarlett-player/hls ^0.1.0
- @scarlett-player/ui ^0.1.0
- hls.js ^1.5.0

### Notes

This is the first release designed for The Stream Platform's multi-tenant live streaming service. The package provides both declarative and programmatic APIs for maximum flexibility in different embedding scenarios.
