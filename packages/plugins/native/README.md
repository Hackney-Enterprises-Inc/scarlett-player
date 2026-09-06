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

- **MP4 / M4V** - H.264/AAC (most common)
- **WebM** - VP8/VP9/Opus
- **MOV** - QuickTime (H.264/AAC)
- **MKV** - Matroska (browser support varies)
- **OGV/OGG** - Theora/Vorbis

Audio:

- **MP3**, **WAV**, **OGG**, **FLAC**, **AAC**, **M4A**, **Opus**, **WebA**
  (pairs with `@scarlett-player/audio-ui` and `@scarlett-player/media-session`
  for a full audio player)

The plugin claims a source by extension, then asks the browser whether it can
play that MIME type, so an `.mkv` in a browser without Matroska support is
declined rather than played into a black frame.

## Configuration

```typescript
createNativePlugin({
  preload: 'metadata',  // 'none' | 'metadata' | 'auto'
  loadTimeoutMs: 30000, // Load watchdog; 0 disables
});
```

## License

MIT
