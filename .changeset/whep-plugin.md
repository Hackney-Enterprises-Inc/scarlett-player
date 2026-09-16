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
'@scarlett-player/clips': minor
'@scarlett-player/whep': minor
---

WHEP: new `@scarlett-player/whep` provider plugin - WebRTC playback over WHEP
(WebRTC-HTTP Egress Protocol) for sub-second live monitoring.

`createWHEPPlugin(config)` claims any URL whose path contains `/whep/v1/`,
offers receive-only H.264 and Opus, `POST`s the offer as `application/sdp`
(with `Authorization: Bearer` from `token` or an async `tokenProvider`),
applies the `201` answer, remembers the session `Location`, and plays the
remote tracks into a video element created the way the native provider
creates its own. It reports the live keys the HLS provider sets for a source
with no DVR (`live`, `liveEdge`, `seekableRange: null`, `lowLatencyMode`) and
a receiver-side `liveLatency` estimate from `getStats()` (jitter buffer plus
half the round trip), emitted as `live:latency`.

Failures map onto the core's error codes (the package README carries the
table: `401`/`404`/`406`/`415` are `SOURCE_LOAD_FAILED`, `409 not_live` and
`503 max_monitors`/`preview_disabled` are `MEDIA_NETWORK_ERROR`) and the
recoverable ones enter the same reconnect scheduler as the HLS provider, with
the same knobs and defaults (`autoReconnect`, `reconnectBaseDelayMs`,
`reconnectMaxDelayMs`, `reconnectWindowMs`) plus `loadTimeoutMs` (10 s), the
server's `Retry-After` setting the first delay. `destroy()` and `pagehide`
`DELETE` the session (`keepalive`) so a closed tab frees its monitor slot at
once. Server counter-offers (`406` with an SDP body) and trickle ICE are not
supported in v1.

Built for the Tmesis low-delay preview; plays any WHEP server that answers
offers.
