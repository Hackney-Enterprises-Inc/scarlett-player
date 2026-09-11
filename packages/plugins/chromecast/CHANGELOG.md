# @scarlett-player/chromecast

## 1.14.0

### Patch Changes

- [#97](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/97) [`f4908eb`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/f4908eb42d3f3816afeb691d1a2ef05d56c0c1ba) Thanks [@alexhackney](https://github.com/alexhackney)! - Make the clip editor usable on a portrait-phone player.

  **`@scarlett-player/clips`**
  - **The details dialog was crushed.** `applyAnchor()` applied the range stage's
    anchor formula on every layout, but below `regular` the details stage covers
    the picture and the CSS stretches it to `top: 8px / bottom: 8px` — the anchor
    bounds nothing there. The panel came out 81px tall on a 197px player: an 8px
    body over 199px of content, with the time fields, the readout and the title
    all out of reach behind 8px-at-a-time scrolling. The covering stage now gets
    the player, less the 8px inset top and bottom; `tiny` and `regular` are
    unchanged.
  - **Handle labels no longer leave the player.** The `IN 0:12` / `OUT 0:47`
    pill is centred on its handle, so at either end of the rail a ~60px label
    hung half its width past it and the player's `overflow: hidden` cut the
    prefix off (measured on a 350px player: the IN pill spanned x=2..63 against a
    player starting at 20). Only the label slides now, by the smallest shift that
    brings it back inside the track. The handle and its stem stay exactly on the
    timestamp they point at, and the clamp is recomputed on resize.
  - **Slimmer chrome on a phone.** Under `.sp-clip-editing--minimal` only — the
    layout that has already given up the control bar, which is where every
    portrait phone lands — the handle lanes drop from 44px to 32px, the pills to
    10px/2px-6px, and the timeline sits 36px off the bottom instead of 44px. The
    range stage's chrome goes from 143px to ~123px, so a 197px player keeps ~74px
    of picture instead of ~45px. Desktop and tablet keep the 44px lanes.
    Documented trade-off: the pill's touch target is 32px tall on a phone (it
    stays ~55px wide); the toolbar and the IN/OUT-here buttons keep the 44px
    floor.
  - **The clamp stopped measuring twice per pointermove.** Placing the pills
    needs the track's width, and the render read it back after repositioning the
    handles - a layout flush the browser had to do mid-drag, for a box the move
    itself had just measured to map its `clientX`. That measurement is now passed
    through to the render, and the pill (as wide as its text and nothing else) is
    re-measured only when it has actually been relabelled. Same clamping, same
    pixels; the reads just no longer follow the writes.

- [#97](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/97) [`f4908eb`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/f4908eb42d3f3816afeb691d1a2ef05d56c0c1ba) Thanks [@alexhackney](https://github.com/alexhackney)! - Stand the gesture surface down while a clip session is open.

  **`@scarlett-player/gestures`**
  - `syncSurface()` keyed on `mediaType` alone, so the full-bleed
    double-tap-to-seek layer stayed armed over an open clip editor — two features
    competing for the same finger on the one screen where both are touch-only.
    The surface is now torn down while `clipOpen` is true and rebuilt when the
    session closes, through the existing construct/destroy path.
  - The key belongs to `@scarlett-player/clips` and is tracked from the state
    stream rather than read back, so a player with no clips plugin installed is
    unaffected.

- [#97](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/97) [`f4908eb`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/f4908eb42d3f3816afeb691d1a2ef05d56c0c1ba) Thanks [@alexhackney](https://github.com/alexhackney)! - Emit `playback:play` and `playback:pause` from the HLS provider's own media
  element, so the bus hears about playback the viewer started.

  **`@scarlett-player/hls`**
  - The element handlers wrote state on `playing` and `pause` and emitted
    nothing. Every play control in the UI package calls `video.play()` /
    `video.pause()` on the element directly, so on an HLS source `playback:play`
    never fired at all — for the whole session. Anything waiting on it was dark:
    the watermark (which is hidden until the first play by contract), the
    analytics QoE timeline, media-session, the clips preview. Measured on the
    demo 2026-09-09: video playing, `.sp-watermark` still `visibility: hidden`.
    The native provider has always emitted play from its element; this is the
    same bridge on the shared factory, so both the hls.js and the native-HLS
    pipeline get it.
  - `playback:pause` is emitted the same way, on both providers. Nothing emitted
    it before except `ScarlettPlayer.pause()`, so a viewer pausing with the play
    button, the keyboard or the browser's own controls produced no event.
  - Neither is emitted twice. `ScarlettPlayer.play()` / `.pause()` put their
    event on the bus before the provider touches the element, and a shared
    `PlaybackGate` swallows exactly one matching element event. Commands that
    have nothing to do (play on a playing element, pause on a paused one) return
    without arming the gate, since no element event follows them and a flag left
    standing would swallow the viewer's next real transition instead. The one
    exception is a pause command that arrives while a play command is still in
    flight: it cancels that play rather than passing over it, and clears its
    flag, so the play the viewer makes next is heard.
  - A load that replaces the source clears both gate flags. They are armed
    before the element is touched and consumed by the element event that
    follows, and once the source is abandoned that event never arrives — the
    handlers are detached, and on the hls.js path the new ones wait behind the
    loader import. A `pause()` a playlist issues just before advancing therefore
    left the flag standing, and it swallowed the viewer's first real pause on the
    new item. A same-source pipeline switch (`switchToNative()` /
    `switchToHlsJs()`) deliberately keeps the flags, which is what the gate
    outliving a pipeline is for.
  - **Behaviour note:** the watermark stays hidden until the first play, which is
    its documented lifecycle. What changes is that on an HLS source the first
    play now arrives. A consumer who had grown used to never seeing the mark on
    HLS will see it from the first play onwards.

- [#97](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/97) [`f4908eb`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/f4908eb42d3f3816afeb691d1a2ef05d56c0c1ba) Thanks [@alexhackney](https://github.com/alexhackney)! - Emit `playback:pause` from the native provider's media element.

  **`@scarlett-player/native`**
  - The `pause` handler wrote state and emitted nothing, so a pause the viewer
    made through the play button, the keyboard or the browser's native controls
    never reached the bus — only `ScarlettPlayer.pause()` did. Analytics,
    media-session, chromecast and the clips preview all read that event.
  - Deduped against core-issued commands with `isCorePauseRequested`, mirroring
    the `isCorePlayRequested` guard the play path has always had, and a pause
    command on an already-paused element now returns before arming it — unless a
    play command is still in flight, which that pause cancels rather than passing
    over, clearing its flag so the viewer's next play is heard.
  - Both guards are cleared when a source is torn down, so a command left in
    flight by the previous source cannot dedupe an event belonging to the next
    one. The consuming element event cannot arrive once the listeners are gone,
    and the standing flag swallowed the viewer's first real pause (or play) after
    a playlist advance.

## 1.13.0

### Patch Changes

- [#95](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/95) [`9cef6a8`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9cef6a8f698b2cbc607839deb35223852da77ffa) Thanks [@alexhackney](https://github.com/alexhackney)! - Fixes from review of the clip-editing pass: guards that were written but never
  took effect, and two classifications that believed stale evidence.

  **`@scarlett-player/clips`**
  - The exact-time field the viewer is editing is now re-rendered on Enter and
    Escape. `renderTimeFields()` skipped any focused input so as not to overwrite
    typing, but Enter and Escape are both handled with the input still focused -
    so the one field the viewer had just acted on was the one field never updated.
    Escape left the half-typed value on screen, a refused value stayed next to the
    notice rejecting it, and a committed value never showed the snapped, clamped
    time the endpoint actually landed on. Other fields are still left alone.
  - The preview loop rewinds again when the out point is pinned at the media's
    duration. It asked `paused` state inside its `playback:ended` handler, and a
    media element that reaches its end sets `paused` and fires `pause` _before_
    `ended` - so state said "the viewer stopped" for every natural end and the
    rewind never ran. Playback intent is now tracked as playback happens, which
    still declines to restart a video the viewer paused and walked away from.
  - `setInteractive(false)` now holds against the keyboard and the pointer.
    `tabindex="-1"` keeps a frozen handle out of tabbing but does not blur one
    that already had focus, and a focused element still receives keydown, so the
    range could be walked out from under a submission already carrying it. The
    freeze is enforced in the handlers rather than only in CSS and the tab order.
  - The range toolbar buttons and the details Back button are 44px tall, matching
    the touch-target floor the other clip controls already used.

  **`@scarlett-player/hls`**
  - `mediaType` no longer inherits the previous source's frame size. The
    classifier attaches to a _reused_ `<video>` before `attachMedia()`/
    `loadSource()` has replaced anything, so an audio-only source loaded after a
    video one arrived with `videoWidth` still measuring the old frame. Believing
    it was permanent: video evidence is sticky, so the manifest's `video: false`
    could no longer correct it, and an audio-only source stayed labelled `video`.
    Intrinsic dimensions now count only once the element has reported on the
    source now loading.

  **`@scarlett-player/gestures`**
  - The tap surface is built for `mediaType: 'video'`, not for anything that is
    not `'audio'`. `'unknown'` means "not established yet": an audio-only source
    the classifier cannot prove (native HLS where the browser ships no track
    lists) stays unknown for its whole life, and was getting a full-bleed tap
    surface over the audio UI. Nothing is lost by waiting - the surface is built
    the moment the source is confirmed as video.

  **`@scarlett-player/ui`**
  - The progress handle stops growing on hover while a timeline extension owns the
    pointer. The `--ext-dragging` rule sat above the `:hover` rule it was meant to
    beat and at lower specificity, and an extension drag is a pointer drag, so the
    hover rule always won and the override never applied.

  **`@scarlett-player/watermark`**
  - `playback:ended` cancels a pending `showDelay`. The handler hid the watermark
    but left the timer armed, so media shorter than the delay ended hidden and
    then went visible - and, with `dynamic` on, started repositioning itself over
    a finished player.

- [#95](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/95) [`9cef6a8`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9cef6a8f698b2cbc607839deb35223852da77ffa) Thanks [@alexhackney](https://github.com/alexhackney)! - Clips on the playback timeline, and an end to video being mislabelled as audio.

  **Video is no longer classified as audio because nobody measured it yet.**
  `@scarlett-player/hls` derived `mediaType` from one expression in its
  `loadedmetadata` handler - `video.videoWidth > 0 ? 'video' : 'audio'` - which
  reads a _missing_ measurement as positive evidence of audio. Intrinsic
  dimensions are simply not available at that point on several mobile browsers, so
  an ordinary phone playing an ordinary video was labelled `audio`, and everything
  gated on that quietly refused to work. Classification now needs evidence:
  positive dimensions or a present native video track establish video and stay
  sticky for the source; hls.js's `MANIFEST_PARSED` flags establish it before a
  frame decodes; native track lists (feature-detected, consulted only from
  `HAVE_METADATA`) establish audio. Anything else stays `unknown`, which is a
  third answer and not a synonym for audio. Evidence survives retries, native
  error-recovery reloads and AirPlay handoffs, and resets on a new source.

  **The clip IN/OUT handles now live on the playback timeline.**
  `@scarlett-player/ui` gains `registerTimelineExtension(owner, factory)`, a
  second extension seam beside the control registry: it offers a positioned layer
  over the rail, the rail's measured geometry, and leases for holding the control
  bar visible and suppressing ordinary seeking while an extension owns a pointer.
  One extension per player, keyed by container, registerable before or after the
  UI plugin initialises. The UI package reads no plugin-specific state and gains
  no `IPluginAPI` surface for it.

  `@scarlett-player/clips` mounts its handles there in two 44px lanes, IN above
  the rail and OUT below, each labelled with its own timestamp. Two lanes because
  a 30-second selection on a two-hour source is about a pixel wide, and two
  targets on one line cannot both be hit. Presses that miss a handle fall through
  and seek as usual. Without the seam - no UI package, or one too old to have it -
  the same selector instance renders on its own rail, and it moves between the two
  without losing the selection, the title or the request id.

  **Editing and preview stopped fighting the viewer.** Drags preserve the grab
  offset, lock one pointer, survive a failed pointer capture, apply the release
  position once, and treat a cancelled gesture as a cancellation (range kept,
  playback not resumed). Endpoints can also be placed at the playhead, stepped
  with the keyboard against their own reachable limits, or typed exactly
  (`93`, `1:33.5`, `0:01:33.250`). An ordinary seek takes the preview loop's
  ownership of the playhead and keeps it, so scrubbing past the out point no
  longer snaps back; "Preview clip" is how it is asked for again.

  **The editor fits on a phone.** Layout is measured on the player, never the
  device. Below 600x360 range editing and naming become two steps so neither is
  cut off; below 220px tall the control bar is given up for the duration of the
  edit with Play/Pause moved into the toolbar; below 160px the editor becomes a
  bounded scrollable sheet. Range editing is a nonmodal labelled region (no
  document-wide focus trap), the details step is a labelled `aria-modal="false"`
  dialog, and Escape is scoped to focus inside its own player so two players never
  answer each other.

  New clip error codes: `media-type-unknown` ("Video information is not available
  yet. Press Play and try again.") and `native-fullscreen-active`, for the iPhone's
  own fullscreen player where no custom DOM control can exist. The gate is
  re-checked at commit, so a selection is never submitted against a source that
  has changed under it.

- [#95](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/95) [`9cef6a8`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/9cef6a8f698b2cbc607839deb35223852da77ffa) Thanks [@alexhackney](https://github.com/alexhackney)! - Fix the watermark runtime API, which the plugin's own anti-tamper observer had
  been undoing.

  **`@scarlett-player/watermark`**
  - `setOpacity()` now sticks. The `MutationObserver` installed by `init()` wrote
    `element.style.opacity = String(opacity)` from the original config on every
    style mutation, so a runtime opacity was reverted on the next microtask.
    Opacity is runtime state now, and the observer restores the value the plugin
    last applied. The existing tests passed only because they asserted
    synchronously, before the observer callback ran; the new ones await it.
  - `setPosition()`, `setPadding()` and `setImageHeight()` no longer reset
    opacity as a side effect — each of them writes inline styles, and every write
    triggered that same revert.
  - The observer's style branch is scoped to the watermark element. It observes
    the player container with `subtree: true` (needed to catch the mark being
    removed), so a style write anywhere else under the container — the control
    bar animating, the progress bar, the clip range selector — was treated as
    tampering and re-asserted the config opacity. It also only writes a property
    when it differs, instead of queueing another mutation record for itself on
    every callback.
  - `show()` / `hide()` do something. They only swapped `sp-watermark--visible` /
    `sp-watermark--hidden`, and no stylesheet in the repo defines either class,
    so the calls were inert and the mark was visible from `init()`. Visibility is
    now an inline `visibility` (the classes stay as consumer hooks), and the
    observer restores the tracked state rather than forcing the mark visible.
  - **Behaviour change:** the documented lifecycle now actually happens — the
    mark is hidden until the first `playback:play` (after `showDelay`), stays
    visible while paused, and hides on `playback:ended`. A consumer who was
    seeing it over the poster will no longer see it there.
  - README: the overlay stays visible while paused, which is what the code has
    always done; "hidden on pause" was wrong.

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

## 1.8.0

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
