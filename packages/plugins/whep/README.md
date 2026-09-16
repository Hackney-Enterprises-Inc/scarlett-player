# @scarlett-player/whep

WebRTC playback over WHEP (WebRTC-HTTP Egress Protocol, `draft-ietf-wish-whep`)
for Scarlett Player: sub-second live monitoring into an ordinary `<video>`.
Built for the Tmesis low-delay preview (`/whep/v1/streams/<id>` on a Tmesis
box), and it plays any WHEP server that answers offers with a `201`.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/whep
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createWHEPPlugin } from '@scarlett-player/whep';

const player = await createPlayer({
  container: document.getElementById('monitor'),
  src: 'https://origin.example.com:8889/whep/v1/streams/show-1',
  plugins: [createWHEPPlugin()],
});
```

The plugin claims any URL with a path segment named `whep`, which is where
every WHEP server it has met puts its endpoint: a Tmesis box at
`/whep/v1/streams/<id>`, MediaMTX at `/<path>/whep`, the WISH drafts'
examples at `/whep/<id>`. It can therefore sit next to the HLS and native
providers and the core picks it for a WHEP source. A server whose endpoint
path carries no `whep` segment is not claimed; put the plugin in front of a
host-side `canPlay` wrapper for that.

## What it does

On `load()`, the plugin creates a video element the way the native provider
does (absolute inside the container, `playsInline`, no native controls, the
`poster` key mirrored), then:

1. builds an `RTCPeerConnection` with a receive-only video transceiver and a
   receive-only audio transceiver, makes an offer, and waits up to a second
   for ICE gathering so the offer carries the browser's host candidates;
2. `POST`s the offer as `application/sdp` (with `Authorization: Bearer` when
   a token is configured), applies the `201` answer, and remembers the session
   resource from `Location`. A `Location` on another origin is ignored (the
   bearer token must not travel to a host the endpoint did not name; the
   server then frees the session by ICE timeout, as when it sends none);
3. attaches the remote tracks to the element and calls `play()`. When the
   browser's autoplay policy refuses (sound on, no gesture yet), the element
   stays paused and the viewer's own play works;
4. polls `getStats()` once a second for a latency estimate (below).

`destroy()` `DELETE`s the session, closes the connection, and removes the
element. A closing or navigating tab also `DELETE`s on `pagehide`, with
`keepalive`, so the monitor slot is free at once instead of after the server's
ICE timeout.

## What the player reports

The same keys the HLS provider sets for a live source with no DVR window:

| Key | Value |
|---|---|
| `live` | `true` |
| `liveEdge` | `true` (WebRTC is always at the edge) |
| `seekableRange` | `null` (no DVR) |
| `duration` | `0` |
| `lowLatencyMode` | `true`, with `live:lowlatency` emitted |
| `liveLatency` | the estimate below, in seconds, with `live:latency` emitted on change |
| `source` | `{ src, type: 'application/sdp' }` |
| `mediaType` | `'video'` |

Seeking and playback-rate changes have no meaning on a live WebRTC stream and
are not wired.

### The latency estimate

`liveLatency` is the mean time a video frame spent in the browser's jitter
buffer over the frames emitted since the previous poll (the change in
`jitterBufferDelay` over the change in `jitterBufferEmittedCount` on the
inbound video track, read once a second) plus half the round trip on the
selected candidate pair. It is the **receiver's share of the delay, an
estimate**, not glass to glass: it cannot see the encoder, the server's tap,
or the publisher's uplink. An end-to-end number needs a clock burned into the
picture and read off the screen.

## Configuration

```typescript
createWHEPPlugin({
  token: undefined,               // Bearer token; a Tmesis v1 preview needs none
  tokenProvider: undefined,       // async () => token, asked before every request
  iceServers: [],                 // RTCIceServer[]; none needed for a reachable box
  autoReconnect: true,            // Reconnect after recoverable failures
  reconnectBaseDelayMs: 2000,     // First delay (a server Retry-After replaces it)
  reconnectMaxDelayMs: 30000,     // The backoff doubles up to this and holds
  reconnectWindowMs: 300000,      // Give up after this long; Infinity keeps trying
  loadTimeoutMs: 10000,           // Watchdog for one join attempt; 0 disables
});
```

`tokenProvider` wins over `token`. It is called before the first offer and
before every reconnect attempt, so a host holding a short-lived token hands
over a fresh one instead of the one that expired during an outage. A Tmesis
v1 preview endpoint is open (the firewall is the gate) and ignores an
`Authorization` header rather than refusing it; other WHEP servers, and the
later Tmesis token shape, read it.

## Errors and reconnect

Every failure is reported as a fatal `error` with the code below and a
`detail` carrying `type`, `httpStatus` (when there was one) and the endpoint
URL stripped of its query string. Recoverable failures then enter the same
reconnect scheduler the HLS provider uses: `error:reconnecting` on each
scheduled attempt, `error:recovered` when one connects, and
`error:reconnect-exhausted` followed by a final fatal `error` carrying
`detail.reconnectExhausted` when the window closes. Inside a window only the
first recoverable failure emits the fatal `error`; the recoverable failures
that follow emit `error:reconnecting` again, so a stream that is not live for
a while does not flash an error every poll. A terminal failure inside the
window (the stream deleted mid-outage, say) still emits its fatal `error` and
ends the window, so a "reconnecting" overlay always has something to take it
down.

| Answer | Meaning (Tmesis) | Code | Reconnect |
|---|---|---|---|
| `201` | joined | | |
| `400` | the offer could not be applied | `SOURCE_LOAD_FAILED` | no |
| `401`, `403` | the token was refused (`detail.type: 'network'`, the status in `detail.httpStatus`; core has no auth-flavoured code) | `SOURCE_LOAD_FAILED` | no |
| `404` | no such stream or session | `SOURCE_LOAD_FAILED` | no on the first join (a wrong URL); yes once the source has played, because the endpoint is known and the publisher left (MediaMTX answers a path with no publisher this way, where Tmesis answers `409`) |
| `405`, `413`, `415` | the request was not a WHEP offer the server takes | `SOURCE_LOAD_FAILED` | no |
| `406` with a JSON body | the offer accepts neither H.264 (Constrained Baseline) nor Opus (`detail.type: 'media'`) | `SOURCE_LOAD_FAILED` | no |
| `406` with an `application/sdp` body | a server counter-offer, which this plugin does not answer (below) | `SOURCE_LOAD_FAILED` | no |
| `409` `not_live` | the publisher is not there yet, or the tap has not delivered its init | `MEDIA_NETWORK_ERROR` | yes, at `Retry-After` (5 s), doubling |
| `503` `max_monitors` | the stream is at its monitor cap | `MEDIA_NETWORK_ERROR` | yes, at `Retry-After` (30 s) |
| `503` `preview_disabled` | the preview is off for this stream | `MEDIA_NETWORK_ERROR` | yes, at `Retry-After` (30 s) |
| other `5xx` | the server failed | `MEDIA_NETWORK_ERROR` | yes, from `reconnectBaseDelayMs` |
| the request failed (offline, DNS, CORS) | | `MEDIA_NETWORK_ERROR` | yes |
| the answer could not be applied | | `MEDIA_NETWORK_ERROR` (`detail.type: 'media'`) | yes |
| the connection `failed`, or stayed `disconnected` past 5 s | | `MEDIA_NETWORK_ERROR` | yes |
| a join did not connect inside `loadTimeoutMs` | | `MEDIA_NETWORK_ERROR` | yes |
| the video element reported an error | | `MEDIA_DECODE_ERROR` | yes |

The reconnect delay doubles from the server's `Retry-After` when the failure
carried one (a `409` polls at 5, 10, 20, 30, 30 s) and from
`reconnectBaseDelayMs` otherwise, jittered down by up to 30% but never below
what the server asked for, and holds at `reconnectMaxDelayMs`. Giving up is
decided by `reconnectWindowMs`, not an attempt count. Every attempt `DELETE`s
the dead session first.

`load()` resolves once the connection is up, after any reconnect attempts the
join needed (so a monitor opened before the producer starts plays as soon as
the stream goes live; on Tmesis, which answers `409` until then. MediaMTX
answers `404`, which is terminal on a first join, so open a MediaMTX monitor
after the publisher), and rejects when the failure is terminal, the window
closes, or a newer load or `destroy()` supersedes it.

### Not in v1

- **Server offers.** WHEP lets a server answer `406` with an SDP counter-offer
  that the player answers over `PATCH`. This plugin consumes a `201` answer
  only and reports a counter-offer as `SOURCE_LOAD_FAILED`, which limits
  "any WHEP server" to servers that answer offers (Tmesis and MediaMTX do).
- **Trickle ICE and ICE restart** (`PATCH`). The offer is sent after gathering
  completes, bounded at one second.
- **A data channel** for cues, captions, or viewer counts. When wanted, an
  `RTCDataChannel` on the same connection is an additive change on both sides.

## Imperative API

```typescript
const whep = createWHEPPlugin();
// after load():
whep.getSessionUrl(); // the session resource, absolute, or null while not joined
```

`DEFAULT_WHEP_CONFIG` exports the defaults above. `classifyResponse`,
`classifyTransport`, `parseRetryAfter`, `readErrorEnvelope`, `WHEPError` and
`estimateLatency` are exported for hosts that want the same classification or
measurement outside the plugin. `estimateLatency(report, previousSample)`
returns the counters it read as `sample`; hand them to the next call so the
estimate covers only the frames emitted in between, as the plugin's own
poll does. `readErrorEnvelope` reads both the Tmesis envelope
(`{"error":{"code","message"}}`) and MediaMTX's flat one
(`{"status":"error","error":"..."}`).

Types: `IWHEPPlugin`, `WHEPPluginConfig`, `WHEPTokenProvider`, `WHEPFailure`,
`TransportFailureKind`, `LatencyEstimate`, `LatencySample`. `PKG_VERSION` is
the package version the build was produced from.

## Trying it locally

There is no public WHEP stream. [MediaMTX](https://github.com/bluenviron/mediamtx)
(one binary, default config) plus an ffmpeg test publisher gives you an
endpoint on this machine; the demo page at `demo/index.html` has a WHEP box
that joins it:

```bash
./mediamtx &
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440 \
  -c:v libx264 -preset ultrafast -tune zerolatency -profile:v baseline -pix_fmt yuv420p -g 30 \
  -c:a libopus -f rtsp rtsp://localhost:8554/live
# then join  http://localhost:8889/live/whep
```

Stop the ffmpeg process mid-play to watch the reconnect scheduler: the
connection fails, the attempts that follow get MediaMTX's `404` (recoverable
once the source has played), and the stream recovers when ffmpeg is
restarted.

## License

MIT
