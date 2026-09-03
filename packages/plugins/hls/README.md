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
  lowLatencyMode: false,
  loadTimeoutMs: 30000,         // Load watchdog; 0 disables

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
// Get available qualities
const qualities = player.getQualities();
// [{ index: 0, height: 1080, bitrate: 5000000 }, ...]

// Set quality (use -1 for auto)
player.setQuality(0);  // Highest quality
player.setQuality(-1); // Auto/ABR

// Get current quality
const current = player.getCurrentQuality();
```

## License

MIT
