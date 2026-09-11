# @scarlett-player/clips

## 1.14.0

### Minor Changes

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

### Patch Changes

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

### Minor Changes

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
