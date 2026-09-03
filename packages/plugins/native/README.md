# @scarlett-player/native

Native video playback plugin for Scarlett Player. Supports MP4, WebM, MOV, MKV, and OGV formats.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/native
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.mp4',
  plugins: [createNativePlugin()],
});
```

## Supported Formats

Video:

- **MP4** - H.264/AAC (most common)
- **WebM** - VP8/VP9/Opus
- **MOV** - QuickTime (H.264/AAC)
- **MKV** - Matroska (browser support varies)
- **OGV/OGG** - Theora/Vorbis

Audio:

- **MP3**, **WAV**, **OGG**, **FLAC**, **AAC**, **M4A**, **Opus** (pairs with
  `@scarlett-player/audio-ui` and `@scarlett-player/media-session` for a full
  audio player)

## Configuration

```typescript
createNativePlugin({
  preload: 'metadata', // 'none' | 'metadata' | 'auto'
});
```

## License

MIT
