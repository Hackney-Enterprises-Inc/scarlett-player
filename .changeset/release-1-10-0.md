---
'@scarlett-player/core': minor
'@scarlett-player/embed': minor
'@scarlett-player/vue': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
'@scarlett-player/airplay': minor
'@scarlett-player/chromecast': minor
'@scarlett-player/analytics': minor
'@scarlett-player/playlist': minor
'@scarlett-player/media-session': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/captions': minor
'@scarlett-player/watermark': minor
'@scarlett-player/share': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
---

Accessibility, multi-player safety, casting stability, audio renditions and
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
