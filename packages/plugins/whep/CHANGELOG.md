# @scarlett-player/whep

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
