# @scarlett-player/hls

HLS playback plugin for Scarlett Player. Uses hls.js with native Safari fallback.

> **Docs:** [scarlettplayer.com/documentation](https://scarlettplayer.com/documentation/) · **For AI coding agents:** [llms.txt](https://scarlettplayer.com/llms.txt) (index) and [llms-full.txt](https://scarlettplayer.com/llms-full.txt) (every guide as one Markdown file)

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/hls
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.m3u8',
  plugins: [createHLSPlugin()],
});
```

## Features

- Adaptive bitrate streaming with quality level selection
- Live stream support with DVR
- Low-latency HLS (LL-HLS): part loading, latency catch-up, and live metrics
  reported through player state
- Native Safari HLS fallback (and hls.js lazy loading everywhere else)
- Self-healing error recovery: bounded retries with jittered backoff,
  auto-reconnect after mid-playback failures (VOD resumes at position, live
  rejoins the edge), and a load watchdog so a dead source never leaves the
  viewer on an endless spinner
- Playlist refresh validation: a live refresh that returns an error page, a
  master-only response, or an empty document is treated as a transient
  network error instead of being indexed blindly
- Structured error codes (MEDIA_NETWORK_ERROR, MEDIA_APPEND_ERROR,
  MEDIA_BUFFER_FULL, PLAYLIST_INVALID, ...) so UIs can show accurate copy

## Seek state and events

On the media element's `seeking` event, the provider publishes its new
`currentTime` before setting `seeking: true`. This applies to both hls.js and
native Safari playback, and lets state subscribers read the seek target even
before the next timeupdate. It does not emit `playback:seeking` from that
handler: that event is an incoming seek command and re-emitting it would loop.
On completion it sets `seeking: false` and emits `playback:seeked { time }`.
The [analytics plugin](../analytics/README.md#seek-tracking) uses this state
transition to track native/element-driven seeks without duplicating recent
player-requested seeks.

**Live seeks stop at the live sync position.** A `playback:seeking` request on
a live stream is clamped to the DVR window, and its upper end is the live sync
position (`getLiveInfo().liveSyncPosition`: the stream's target latency behind
the edge), not the end of the seekable range. Nothing is loaded past the last
segment, so a seek to the very end used to pause and buffer; dragging the
progress bar to the end, pressing End, or calling `player.seek()` past the sync
position now lands where `seekToLive()` would and keeps playing. This holds on
both hls.js and native Safari playback. VOD seeks still clamp to
`[0, duration]`.

## Segment measurements

Both the regular and light hls.js builds emit the core `media:segment` event
when a media fragment request completes, and on a non-fatal fragment load error
or timeout with measurable hls.js stats:

```typescript
player.on('media:segment', ({ durationMs, bytes, ok, kind }) => {
  // durationMs: loading.end - loading.start on completed requests;
  // on incomplete non-fatal failures (loading.end === 0): performance.now() - loading.start
  // bytes: stats.loaded
  // ok: true on load, false on non-fatal load error/timeout
  // kind: 'main' | 'audio' | 'subtitle'
});
```

This event is emitted only for hls.js fragments with valid load timing and
byte measurements. It is not emitted on native Safari HLS, or by progressive
MP4 or WHEP providers; missing events are not zero-byte or zero-duration loads.
The existing `bandwidth` state updates remain unchanged.

## Configuration

All options are optional; defaults shown.

```typescript
createHLSPlugin({
  debug: false,                 // hls.js debug logging

  // Buffering
  maxBufferLength: 30,          // Forward buffer target (seconds)
  maxMaxBufferLength: 600,      // Hard forward buffer cap (seconds)
  backBufferLength: 30,         // Back buffer kept for DVR (seconds)
  enableWorker: true,           // Transmux in a Web Worker
  capLevelToPlayerSize: true,   // Cap ABR to the player element size
  initialBandwidthEstimate: undefined, // Override initial ABR estimate (bps)

  // Loading
  autoStartLoad: true,
  startPosition: -1,
  loadTimeoutMs: 30000,         // Load watchdog; 0 disables

  // Live / low latency (see below). Every key here except lowLatencyMode is
  // left to hls.js unless you set it - none is ever passed as undefined.
  lowLatencyMode: false,
  liveSyncDuration: undefined,          // Target latency in seconds
  liveSyncDurationCount: undefined,     // ...or as a count of target durations
  liveMaxLatencyDuration: undefined,    // Seek forward past this latency
  liveMaxLatencyDurationCount: undefined,
  maxLiveSyncPlaybackRate: undefined,   // Defaults to 1.1 when lowLatencyMode
  liveDurationInfinity: undefined,      // Report live duration as Infinity

  // Error recovery
  maxNetworkRetries: 3,
  maxMediaRetries: 2,
  retryDelayMs: 1000,           // Base backoff delay
  retryBackoffFactor: 2,
  validatePlaylists: true,      // Reject malformed playlist refreshes

  // Auto-reconnect (after a fatal error once playback had started)
  autoReconnect: true,
  reconnectBaseDelayMs: 2000,
  reconnectMaxDelayMs: 30000,
  reconnectWindowMs: 300000,    // Keep trying for 5 minutes
});
```

## Low-Latency HLS

`lowLatencyMode` is off by default and opt-in, so upgrading changes nothing for
an existing consumer. Turning it on does more than set the hls.js flag:

```typescript
createHLSPlugin({ lowLatencyMode: true });
```

- hls.js loads `EXT-X-PART` parts and issues blocking playlist reloads.
- **Latency catch-up is enabled.** hls.js ships `maxLiveSyncPlaybackRate: 1`,
  which disables catch-up entirely, so LL-HLS would otherwise parse and load
  parts and then let latency settle wherever the buffer landed and never pull
  it back. The plugin defaults it to `1.1` when (and only when) low latency is
  requested. Override it - `1.05` is gentler and slower to recover.
- `liveSyncDuration` / `liveSyncDurationCount` override the target latency the
  manifest asks for; `liveMaxLatencyDuration` / `liveMaxLatencyDurationCount`
  set the latency at which the player seeks forward instead of speeding up.

**The manifest has to support it.** Low latency needs
`#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=<n>` and
`#EXT-X-PART` (declared with `#EXT-X-PART-INF:PART-TARGET=<n>`). Setting the
flag against a plain live playlist changes nothing but the config.

### What the player reports

| Key | Meaning |
|---|---|
| `live` | The playlist has no `EXT-X-ENDLIST` |
| `liveLatency` | Seconds behind the live edge |
| `liveEdge` | `latency <= targetLatency + max(1.5, partTarget ?? targetduration / 2)` |
| `seekableRange` | The DVR window, from the playlist rather than `video.seekable` |
| `lowLatencyMode` | Low latency is EFFECTIVE - see below |

Each has a matching event: `live:latency`, `live:edgechange`,
`live:seekablerange`, `live:lowlatency`. All four fire only on change.

`lowLatencyMode` reports effect, not intent: it is true only when the manifest
actually carries parts (or advertises blocking reloads) **and** the config
requested low latency. A host that sets the flag against a plain live manifest
gets no LL badge, and neither does an LL manifest played without the flag,
because hls.js will not load its parts either way.

`getLiveInfo()` returns the same truth from the provider directly:

```typescript
const provider = player.getPlugin('hls-provider');
provider.getLiveInfo();
// { isLive: true, latency: 1.53, targetLatency: 1.5, drift: 1.0,
//   liveSyncPosition: 24.55, lowLatency: true }
```

On native Safari HLS there is no latency API, so `latency` is the distance to
`video.seekable.end` - a buffer distance, not a measured latency - and the edge
threshold stays deliberately loose. Treat those numbers as an approximation.

### Rejoining the live edge

Call `player.seekToLive()`, or emit `live:seektolive` from a control. Both land
on the provider's `liveSyncPosition` before falling back to the end of the
seekable range. Under low latency that distinction matters: the end of the
seekable range is past the last loaded part, and seeking there stalls.

## Error Recovery

Recoverable errors retry with jittered exponential backoff; the retry budget
restores itself once media flows again, so a long live event's transient blips
never accumulate into a terminal failure. When retries are exhausted after
playback had started, the plugin tears down and rebuilds the pipeline
automatically (emitting `error:reconnecting` and `error:recovered` for the
UI), and reconnects immediately when the browser comes back online. Only after
the reconnect window closes does the viewer see the retry UI.

`maxNetworkRetries` and `maxMediaRetries` also cover the first load on native
HLS (Safari, iOS). A media element error before `loadedmetadata` re-requests
the source on the same backoff instead of failing at once. On that first load,
`MEDIA_ERR_DECODE` spends the media budget and every other code spends the
network budget, including `MEDIA_ERR_SRC_NOT_SUPPORTED`, which is how Safari
reports a manifest that answered 4xx or 5xx. Set `maxNetworkRetries: 0` to fail
on the first error. `loadTimeoutMs` stays one ceiling over the whole load,
retries included, and a timeout ends the load even with budget left.

A load that fails for good emits a fatal `error` with a structured code
(`MEDIA_NETWORK_ERROR` or `MEDIA_DECODE_ERROR`) before `load()` settles, so the
host never sees a generic `SOURCE_LOAD_FAILED` for it. Its `detail` carries
`type`, `attempts` and `retriesExhausted`, and on the native path also:

| Field | Meaning |
|---|---|
| `mediaErrorCode` | `MediaError.code` of the element error (1 aborted, 2 network, 3 decode, 4 source not supported) |
| `mediaErrorMessage` | `MediaError.message`, when the browser gave one |
| `timedOut` | `true` when `loadTimeoutMs` ended the load. The message stays `Video took too long to load (network timeout)`, and the media error fields describe the last error seen, if any |

`player.load(url)` resolves when the manifest has been parsed and the source is
playable, and stays pending while that reconnect window is open rather than
rejecting on the first failure inside it - the same contract the WHEP provider
documents. Hosts that need progress listen to `error:reconnecting`,
`error:recovered` and fatal `error`; a host that needs a hard bound sets a
shorter `reconnectWindowMs` or races the promise itself.

### Unsupported browsers

`canPlay()` accepts a source whose path ends in `.m3u8` or whose URL carries an
mpegurl MIME hint, regardless of browser support, so an HLS source is never
reported as `PROVIDER_NOT_FOUND`. A browser with neither hls.js (MSE) nor
native HLS gets a fatal `SOURCE_NOT_SUPPORTED` from `load()`: the error
message summarises the support probes (both `canPlayType()` answers,
`MediaSource`, `ManagedMediaSource`, `WebKitMediaSource`, hls.js), and
`context.probes` carries them in full along with the user agent.

## Light Build

`@scarlett-player/hls/light` uses hls.js/light (roughly 35% smaller, no
subtitles, ID3, or DRM support). Both entries wrap the same internal factory,
so the light build carries identical error handling and recovery.

```typescript
import { createHLSPlugin } from '@scarlett-player/hls/light';
```

## Quality Selection

```typescript
// Get available qualities (HLSQualityLevel[], empty on native Safari HLS)
const qualities = player.getQualities();
// [{ index: 0, width: 1920, height: 1080, bitrate: 5000000, label: '1080p', codec: 'avc1,mp4a' }, ...]

// Set quality by index (use -1 for auto)
player.setQuality(0);
player.setQuality(-1); // Auto/ABR

// Get current quality index (-1 while auto)
const current = player.getCurrentQuality();
```

## License

MIT
