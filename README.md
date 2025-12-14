# Scarlett Player

**A modular, plugin-based video player for the modern web**

**[Live Demo](https://thestreamplatform.github.io/scarlett-player/demo/)**

## Features

- **Plugin Architecture** - Modular design with core + plugins
- **HLS Playback** - Native Safari HLS + hls.js fallback
- **Quality Selection** - Adaptive bitrate with manual override
- **AirPlay & Chromecast** - Built-in casting support
- **Modern UI** - Sleek controls inspired by Mux Player & Vidstack
- **TypeScript** - Fully typed API
- **Lightweight** - ~15KB core, plugins loaded on demand

## Quick Start

```bash
npm install @scarlett-player/core @scarlett-player/hls @scarlett-player/ui
```

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [
    createHLSPlugin(),
    uiPlugin({
      hideDelay: 3000,
      theme: { accentColor: '#e50914' },
    }),
  ],
});

await player.load('https://example.com/video.m3u8');
```

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@scarlett-player/core` | Core player engine | ~15KB |
| `@scarlett-player/hls` | HLS playback provider | ~8KB |
| `@scarlett-player/ui` | UI controls plugin | ~20KB |
| `@scarlett-player/preset-web` | All-in-one bundle | ~40KB |

## UI Controls

The UI plugin provides a modern video player interface:

- Gradient overlay (no solid background)
- Thin progress bar (3px default, 5px on hover)
- Progress bar positioned above controls
- Smooth 200ms transitions
- Keyboard shortcuts (Space/K, M, F, arrows)
- Reduced motion support

### Theming

```typescript
uiPlugin({
  theme: {
    accentColor: '#e50914',    // Progress bar, highlights
    primaryColor: '#ffffff',    // Text, icons
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    controlBarHeight: 48,
    iconSize: 24,
  },
});
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play/Pause |
| M | Toggle mute |
| F | Toggle fullscreen |
| Left Arrow | Seek -5s |
| Right Arrow | Seek +5s |
| Up Arrow | Volume +10% |
| Down Arrow | Volume -10% |

## HLS Plugin

Provides HLS playback with automatic fallback:

- Uses hls.js for quality selection and ABR
- Falls back to native HLS in Safari
- Seamless switching for AirPlay compatibility
- Low-latency mode support
- Error recovery

```typescript
createHLSPlugin({
  debug: false,
  lowLatencyMode: false,
  maxBufferLength: 30,
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build demo
node demo/build.cjs
```

## Project Structure

```
packages/
  core/           # Core player engine
  plugins/
    hls/          # HLS provider plugin
    ui/           # UI controls plugin
  presets/
    web/          # All-in-one preset
demo/             # Interactive demo
docs/             # GitHub Pages demo
```

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+

## Roadmap

- [x] Core player engine
- [x] HLS playback (hls.js + native)
- [x] UI controls plugin
- [x] Quality selection
- [x] AirPlay & Chromecast casting
- [ ] Playlists & queue management
- [ ] Closed captions (WebVTT)
- [ ] Thumbnail preview on seek
- [ ] Vue 3 component wrapper
- [ ] React component wrapper

## License

MIT License

### Attribution

Scarlett Player is inspired by [Vidstack Player](https://github.com/vidstack/player) (Copyright 2023 Rahim Alwer, MIT License). We reference Vidstack's architecture patterns for educational purposes.

## Credits

Built with inspiration from:
- **Vidstack** - Provider architecture reference
- **Mux Player** - UI design inspiration
- **HLS.js** - Battle-tested HLS streaming

---

**Scarlett Player** - Modular. Extensible. Yours.
