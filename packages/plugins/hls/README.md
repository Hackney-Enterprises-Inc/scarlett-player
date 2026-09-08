# @scarlett-player/hls

HLS playback plugin for Scarlett Player. Uses hls.js with native Safari fallback.

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
