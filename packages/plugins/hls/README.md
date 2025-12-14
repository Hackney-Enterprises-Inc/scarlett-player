# @scarlett-player/hls

HLS playback plugin for Scarlett Player. Uses hls.js with native Safari fallback.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/hls
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [createHLSPlugin()],
});

await player.init();
await player.load('https://example.com/video.m3u8');
```

## Features

- Adaptive bitrate streaming
- Quality level selection
- Live stream support with DVR
- Native Safari HLS fallback
- Automatic hls.js loading

## Configuration

```typescript
createHLSPlugin({
  // hls.js config options
  hlsConfig: {
    maxBufferLength: 30,
    maxMaxBufferLength: 600,
  },
  // Prefer native HLS when available (Safari)
  preferNativeHLS: false,
});
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
