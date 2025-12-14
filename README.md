# Scarlett Player

**A lightweight, plugin-based video player for the modern web**

**[Live Demo](https://scarlettplayer.com/demo/)** | **[Documentation](https://scarlettplayer.com/)**

## Features

- **Plugin Architecture** - Modular design with core + plugins. Only bundle what you need.
- **HLS Playback** - Native Safari HLS + hls.js fallback
- **Native Video** - MP4, WebM, MOV, MKV support
- **Quality Selection** - Adaptive bitrate with manual override
- **AirPlay & Chromecast** - Built-in casting support
- **Modern UI** - Sleek controls with keyboard shortcuts and theming
- **TypeScript** - Fully typed API

## Quick Start

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin } from '@scarlett-player/ui';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [
    createHLSPlugin(),       // HLS streams (.m3u8)
    createNativePlugin(),    // Native formats (MP4, WebM, MOV, MKV)
    uiPlugin({
      theme: { accentColor: '#e50914' },
    }),
  ],
});

// Load and play
await player.load('https://example.com/video.m3u8');
```

## Vue 3

```vue
<template>
  <ScarlettPlayer
    :src="videoUrl"
    :plugins="plugins"
    @ready="onPlayerReady"
  />
</template>

<script setup>
import ScarlettPlayer from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const videoUrl = 'https://example.com/video.m3u8';
const plugins = [createHLSPlugin(), uiPlugin()];

function onPlayerReady(player) {
  console.log('Player ready!', player);
}
</script>
```

[See full Vue 3 docs →](./packages/vue/README.md)

## Packages

| Package | Description |
|---------|-------------|
| `@scarlett-player/core` | Core player engine with state management and event system |
| `@scarlett-player/hls` | HLS playback provider (hls.js + native Safari fallback) |
| `@scarlett-player/native` | Native video provider (MP4, WebM, MOV, MKV) |
| `@scarlett-player/ui` | UI controls with keyboard shortcuts and theming |
| `@scarlett-player/airplay` | AirPlay casting support |
| `@scarlett-player/chromecast` | Chromecast casting support |
| `@scarlett-player/vue` | Vue 3 component wrapper |

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

## Theming

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
    native/       # Native video provider
    ui/           # UI controls plugin
    airplay/      # AirPlay casting plugin
    chromecast/   # Chromecast casting plugin
  vue/            # Vue 3 component wrapper
demo/             # Interactive demo
docs/             # Landing page
```

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+

## Roadmap

- [x] Core player engine
- [x] HLS playback (hls.js + native)
- [x] Native video (MP4, WebM, MOV, MKV)
- [x] UI controls plugin
- [x] Quality selection
- [x] AirPlay & Chromecast casting
- [x] Vue 3 component wrapper
- [ ] Playlists & queue management
- [ ] Closed captions (WebVTT)
- [ ] Thumbnail preview on seek
- [ ] React component wrapper

## License

MIT License

### Attribution

Scarlett Player is inspired by [Vidstack Player](https://github.com/vidstack/player) (Copyright 2023 Rahim Alwer, MIT License).

---

**Scarlett Player** - Modular. Extensible. Yours.
