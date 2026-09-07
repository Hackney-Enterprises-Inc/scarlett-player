# @scarlett-player/vue

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

## 1.8.1

### Patch Changes

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - Peer dependency ranges now name the current major line: `@scarlett-player/core`
  and `@scarlett-player/ui` move from `^1.7.0` to `^1.8.0` in the Vue wrapper and
  in every plugin that had not already been bumped, leaving the whole fixed
  version group asking for one range. Nothing was resolving wrongly before, since
  `^1.7.0` already admits 1.8.0, but the declared floor now matches the version
  these packages are actually built and tested against rather than trailing a
  release behind it.

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - Use core payload types for Vue error, loaded, loadedmetadata, and qualitylevels
  events, and normalize non-Error initialization failures to Error instances.
  Correct the audio UI quick start to register a native playback provider and the
  Chromecast quick start to end casting through the plugin's endSession method.

- [#79](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/79) [`71863ee`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/71863ee8681a29d847da079218a6bfe410f722d1) Thanks [@alexhackney](https://github.com/alexhackney)! - `ScarlettPlayer.vue` now types its `timeupdate` event as `{ currentTime }`,
  which is what it has always emitted: the handler forwards core's
  `playback:timeupdate` payload unchanged, and that payload carries no
  `duration`. The old typing promised one, so a TypeScript consumer reading
  `payload.duration` got `undefined` at runtime with no compiler complaint. Read
  the duration off the exposed `player` (`playerRef.value.player.duration`), as
  the README examples do.

## 1.8.0

## 1.7.1

### Patch Changes

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Vue wrapper hygiene: no more spurious warnings, and honest `options` docs.

  `useScarlettPlayer()` registers `onMounted`/`onBeforeUnmount` only when it
  runs inside a component `setup()`. Outside one, Vue has no instance to
  attach them to, so it warned "onMounted is called when there is no active
  component instance" and dropped them; the caller owns `init()` and
  `destroy()` there, which the TSDoc and the README now say.

  `ScarlettPlayer.vue` no longer imports `defineExpose` (a compiler macro, and
  the source of a `@vue/compiler-sfc` warning on every build), and no longer
  subscribes to `player:ready`: core emits that event during the first
  initialisation, which has already completed by the time the component wires
  its listeners. The explicit `emit('ready', player)` is unchanged, so the
  `ready` event still fires exactly as before.

  The `options` prop is documented as construction-time only: it cannot be
  re-applied to a live player because plugins cannot be re-registered.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - Ships the type declarations its `types` field has pointed at, and requires
  `@scarlett-player/core@^1.7.0`.

  `package.json` promised `./dist/index.d.ts` and the 1.7.0 tarball contained no
  `.d.ts` at all: `npm pack --dry-run @scarlett-player/vue@1.7.0` lists 8 files
  (measured 2026-09-02). The build is `tsc && vite build`, `outDir` sits inside the
  project root, so Vite's default emptied the directory and deleted the
  declarations tsc had just emitted. A consumer with `noImplicitAny` on (what
  `strict` gives you) could not compile an import of the package at all, error
  TS7016; with it off the whole module was typed `any` in silence. This is the
  same defect that shipped in `@scarlett-player/embed@1.7.0`.

  `build.emptyOutDir` is now `false`, the `build` script does the cleaning itself
  with `rimraf dist tsconfig.tsbuildinfo` (the buildinfo because a stale one makes
  a composite project emit nothing), tsc emits declarations only so its compiled
  JS no longer lands beside the Vite bundles, and `types` comes first in
  `exports["."]` because TypeScript matches export conditions in order. The
  tarball now lists 11 files including `dist/index.d.ts` and
  `dist/composables/useScarlettPlayer.d.ts`, and
  `scripts/check-package-artifacts.mjs` fails the build if any manifest points at
  a file that is not on disk.

  `useScarlettPlayer` and `ScarlettPlayerPlugin` are fully typed for consumers
  again. The component export is still `any`: `dist/index.d.ts` imports
  `./ScarlettPlayer.vue`, and plain `tsc` cannot emit a declaration for a single
  file component, so nothing in the tarball describes it. Typing the component
  needs `vue-tsc` in the build and is a follow-up.

  The `@scarlett-player/core` peer range moves from `^1.0.3` to `^1.7.0`.

- [#74](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/74) [`170dba5`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/170dba59110517acdb214099414052c99a2d6ad8) Thanks [@alexhackney](https://github.com/alexhackney)! - The `poster` prop is reactive, and the composable exposes `setPoster`.

  `poster` was read once, at construction: a page that swapped the artwork left
  the old image on the element with nothing to say why. It is watched now and
  calls `setPoster()` on the running player, writing `''` when the prop is
  unset, because clearing the prop means "take the image away". `setPoster` is
  also on the component's ref surface and in `useScarlettPlayer()`'s return.

  Adds the package's first component test: mounted with plain `createApp`,
  since this package does not depend on @vue/test-utils.

## 1.7.0

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0

## 1.2.0

## 1.1.1

## 1.1.0

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
