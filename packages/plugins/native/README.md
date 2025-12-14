# @scarlett-player/native

Native video playback plugin for Scarlett Player. Supports MP4, WebM, MOV, MKV, and OGV formats.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/native
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [createNativePlugin()],
});

await player.init();
await player.load('https://example.com/video.mp4');
```

## Supported Formats

- **MP4** - H.264/AAC (most common)
- **WebM** - VP8/VP9/Opus
- **MOV** - QuickTime (H.264/AAC)
- **MKV** - Matroska (browser support varies)
- **OGV/OGG** - Theora/Vorbis

## Configuration

```typescript
createNativePlugin({
  preload: 'metadata', // 'none' | 'metadata' | 'auto'
});
```

## License

MIT
