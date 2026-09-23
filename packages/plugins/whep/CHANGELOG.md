# @scarlett-player/whep

## 1.16.2

## 1.16.1

### Patch Changes

- [#112](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/112) [`705f8ec`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/705f8eccf08bd97dea716d7d521408dbf6316d15) Thanks [@alexhackney](https://github.com/alexhackney)! - Each package README now links the documentation site (scarlettplayer.com/documentation/) and the Markdown published for AI coding agents: llms.txt, an index of the guides and packages, and llms-full.txt, every guide in one file. Documentation only; no code changes.

## 1.16.0

### Patch Changes

- [#110](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/110) [`d7fce95`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/d7fce95ca3fa4e293dc4636f961c894698edee97) Thanks [@alexhackney](https://github.com/alexhackney)! - Config options that were declared but never read are now wired up or gone, the
  accent-text token reaches hosts that cannot write CSS, and a WHEP endpoint that
  does not speak WHEP fails in seconds instead of five minutes.

  **Playlist: `preloadNext` does something.** It was declared and defaulted to
  `true` while no code path read it. When a track starts, the next one is now
  warmed through a detached media element with `preload="metadata"` - DNS, TLS
  and the container header done before the viewer gets there, without pulling the
  next file down while the current one still needs the bandwidth. Nothing is
  warmed at the end of a playlist that does not repeat, or when `repeat` is
  `'one'`, and the element is released as soon as there is no next track left -
  on `clear()` and on destroy too - rather than left fetching one the viewer has
  moved past.

  **Captions: `CaptionSource.default` does something.** A source marked `default`
  is now selected when the media loads. It beats `defaultLanguage` and applies
  even with `autoSelect` off - the flag is the host naming a track, not a
  preference to weigh - while a track the browser is already showing still
  stands, so a viewer's own pick is never overridden. The marked source is found
  through the TextTrack of the `<track>` element added for it, not by language
  and label: a native rendition carrying the same pair - which is what the
  manifest offers on the native HLS path - would otherwise answer for it.
  `<track default>` is still never set on the element itself:
  the browser would show it before the plugin has synced any state.

  **Audio UI: `autoHide` is removed** from `AudioUIPluginConfig`. It was declared,
  defaulted to `0` and read nowhere, and there is no hide path to hang it off.
  Nothing breaks if you still pass it - the config carries an index signature for
  `PluginConfig` compatibility, so the key still compiles and is still ignored -
  but it is no longer documented or suggested, and deleting the line is the whole
  migration.

  **Analytics: `headers` on `AnalyticsConfig`**, mirroring `ClipEndpointConfig`:
  an object, or a function resolved per beacon for a rotating CSRF or Bearer
  token, merged over `Content-Type` and `X-API-Key` case-insensitively, so a
  host's `content-type` replaces ours instead of being comma-joined onto it. A
  function that rejects, or throws where it stands, costs the headers and not the
  beacon. The unload beacon is the exception, as it is
  for the API key: it travels by `navigator.sendBeacon`, which carries no headers
  at all, and its fetch fallback merges a static object but never calls a
  function, because a promise awaited in a pagehide handler may never settle.

  **UI: `theme.accentTextColor`, and an exported `accentTextTone()`.** The
  `--sp-accent-text` token that shipped in 1.15.4 was reachable only from CSS, so
  an iframe embed - whose host has no CSS inside the player - could not set it at
  all. `setTheme({ accentTextColor })` writes it, and `accentTextTone(color)`
  returns a colour unchanged when it already clears 4.5:1 on the menus, or the
  nearest lighter tone of the same hue that does. A theme that sets only
  `accentColor` behaves exactly as before. The LIVE label - the one place accent
  text sits on the control bar rather than on a menu - now carries its own opaque
  `#202020` chip, since the bar is a gradient over the picture and reached about
  `#333` over a bright frame, lighter than any surface a tone is measured
  against.

  **Embed: `data-brand-text-color`, and a readable default.** The embed now
  derives the accent-text tone from `data-brand-color` unless the new attribute
  overrides it, so a dark brand colour no longer renders sub-AA labels that the
  host cannot reach. Audio-only bundles are unaffected: the helper rides on the
  plugin creators, so nothing pulls the UI package into a build that has no video
  UI.

  **WHEP: 501 and 505 are permanent failures.** Every `status >= 500` was treated
  as recoverable, so a URL that is not a WHEP endpoint at all - a plain HTTP
  server answers a WHEP POST with 501 - entered the reconnect scheduler and held
  `load()` pending for the whole `reconnectWindowMs`, five minutes by default.
  500, 502, 503 and 504 still reconnect.

  **Docs: what `load()` promises.** The whep and hls READMEs and
  `docs/architecture.md` now say that `load()` stays pending while a provider's
  reconnect scheduler is working, that a stream which is not live yet is a wait
  rather than a failure, and that hosts needing progress listen to
  `error:reconnecting` / `error:recovered` / fatal `error` instead of awaiting
  the promise.

## 1.15.4

## 1.15.3

## 1.15.2

## 1.15.1

### Patch Changes

- [#102](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/102) [`60b4b1e`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/60b4b1eef739007a29cec6d990fdaef8f6bcd27a) Thanks [@alexhackney](https://github.com/alexhackney)! - Maintenance release: the demo page and the browser verification harness, no
  change to the published package code.

  Demo: the WHEP Monitor panel's 500ms readout timer now stops on
  `player:destroy`. It held the player instance in a closure, so once the
  player was destroyed it threw `Cannot call methods on destroyed player` on
  every tick as an uncaught error; the page's own stats poller reads
  `window.player` and never had the problem.

  Browser harness (`scripts/verify-browser.mjs`): the clip editor's touch-drag
  check now aims CDP touch input in visual-viewport coordinates. Under mobile
  emulation the demo page lays out wider than 320px, so Chromium keeps a 320x568
  visual viewport inside a 431x766 layout viewport, and focusing the editor's
  toolbar on open scrolls the visual viewport by its full 198px. The check took
  its target from `getBoundingClientRect()` (layout viewport) and every touch
  landed 198px low, on the page below the player. It had passed until 1.13.0
  only because the toolbar's bottom edge happened to sit 4px inside the visual
  viewport; the slimmer minimal-layout lanes in 1.14.0 crossed it, and the WHEP
  URL bar in 1.15.0 pushed the player further still. The `main` verification
  step has failed on every push since 2026-09-11 for these two reasons.

- [#102](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/102) [`60b4b1e`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/60b4b1eef739007a29cec6d990fdaef8f6bcd27a) Thanks [@alexhackney](https://github.com/alexhackney)! - Claim Nimble Streamer WHEP endpoints. Nimble serves WHEP at
  `/<app>/<stream>/whep.stream`, and `canPlay` only matched a standalone `whep`
  path segment, so the core reported `PROVIDER_NOT_FOUND` for a Nimble URL.
  A trailing `whep.stream` segment is now claimed alongside `/whep/` and `/whep`.

## 1.15.0

### Minor Changes

- [#99](https://github.com/Hackney-Enterprises-Inc/scarlett-player/pull/99) [`23d8708`](https://github.com/Hackney-Enterprises-Inc/scarlett-player/commit/23d87081d4628b753ddcb5bf4b00a845205b3069) Thanks [@alexhackney](https://github.com/alexhackney)! - WHEP: new `@scarlett-player/whep` provider plugin - WebRTC playback over WHEP
  (WebRTC-HTTP Egress Protocol) for sub-second live monitoring.

  `createWHEPPlugin(config)` claims any URL with a path segment named `whep`
  (`/whep/v1/streams/<id>` on a Tmesis box, `/<path>/whep` on MediaMTX),
  offers receive-only H.264 and Opus, `POST`s the offer as `application/sdp`
  (with `Authorization: Bearer` from `token` or an async `tokenProvider`),
  applies the `201` answer, remembers the session `Location`, and plays the
  remote tracks into a video element created the way the native provider
  creates its own. It reports the live keys the HLS provider sets for a source
  with no DVR (`live`, `liveEdge`, `seekableRange: null`, `lowLatencyMode`) and
  a receiver-side `liveLatency` estimate from `getStats()` (the jitter buffer
  over the last second's frames plus half the round trip), emitted as
  `live:latency`.

  Failures map onto the core's error codes (the package README carries the
  table: `401`/`404`/`406`/`415` are `SOURCE_LOAD_FAILED`, `409 not_live` and
  `503 max_monitors`/`preview_disabled` are `MEDIA_NETWORK_ERROR`) and the
  recoverable ones enter a WHEP-specific reconnect scheduler, with the same
  configurable knobs and base defaults as the HLS provider (`autoReconnect`, `reconnectBaseDelayMs`,
  `reconnectMaxDelayMs`, `reconnectWindowMs`) plus `loadTimeoutMs` (10 s), the
  server's `Retry-After` setting the first delay. `destroy()` and `pagehide`
  `DELETE` the session (`keepalive`) so a closed tab frees its monitor slot at
  once. Server counter-offers (`406` with an SDP body) and trickle ICE are not
  supported in v1.

  Built for the Tmesis low-delay preview; plays any WHEP server that answers
  offers. The demo page gains a WHEP Monitor panel: a URL box for an endpoint
  (there is no public WHEP stream to preload), the session, the latency
  estimate and the reconnect state.
