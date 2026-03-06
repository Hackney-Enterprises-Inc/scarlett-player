# Scarlett Player

**A lightweight, plugin-based media player for the modern web**

**[Live Demo](https://scarlettplayer.com/demo/)** | **[Documentation](https://scarlettplayer.com/)**

> **Built for [The Stream Platform](https://thestreamplatform.com)** — the official player powering live streaming, VOD, and PPV for combat sports events.

## Features

- **Plugin Architecture** — Modular core + plugins. Only bundle what you need.
- **HLS Playback** — Native Safari HLS + hls.js fallback with quality selection and live DVR
- **Native Media** — Video (MP4, WebM, MOV, MKV, OGV) and audio (MP3, WAV, OGG, FLAC, AAC, M4A, Opus)
- **Adaptive Bitrate** — ABR with manual quality override
- **Live Streaming** — Live indicator, DVR seeking, seek-to-live, latency tracking
- **AirPlay & Chromecast** — Built-in casting with session management
- **Playlists** — Queue management, shuffle, repeat modes, auto-advance
- **Analytics** — QoE metrics, engagement tracking, beacon transport
- **Audio Player** — Compact audio UI with artwork, progress, and media session integration
- **Modern UI** — Video and audio controls with keyboard shortcuts and theming
- **Vue 3 Integration** — Component wrapper and composable with reactive state
- **CDN Embed** — Drop-in script tag, no bundler required
- **TypeScript** — Fully typed API across all packages
- **1,200+ Tests** — Comprehensive test coverage with Vitest

## Installation

```bash
# Core + HLS + UI (most common video setup)
npm install @scarlett-player/core @scarlett-player/hls @scarlett-player/ui

# Audio setup (compact player with lock screen controls)
npm install @scarlett-player/core @scarlett-player/native @scarlett-player/audio-ui @scarlett-player/media-session

# Optional plugins
npm install @scarlett-player/native        # Native media (MP4, WebM, MP3, WAV, FLAC, etc.)
npm install @scarlett-player/airplay       # AirPlay casting
npm install @scarlett-player/chromecast    # Chromecast casting
npm install @scarlett-player/analytics     # QoE metrics & engagement tracking
npm install @scarlett-player/playlist      # Playlist/queue management
npm install @scarlett-player/media-session # Lock screen & media key controls
npm install @scarlett-player/audio-ui      # Compact audio player UI
npm install @scarlett-player/captions      # Closed captions (WebVTT)
npm install @scarlett-player/watermark     # Anti-piracy watermark overlay

# Vue 3 wrapper
npm install @scarlett-player/vue

# CDN embed script (drop-in, no bundler required)
npm install @scarlett-player/embed
```

## Quick Start

### Video (HLS)

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

await player.load('https://example.com/video.m3u8');
```

### Audio (with playlist and lock screen controls)

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';

const player = new ScarlettPlayer({
  container: document.getElementById('audio-player'),
  plugins: [
    createNativePlugin(),
    createAudioUIPlugin({ layout: 'full' }),
    createPlaylistPlugin({
      tracks: [
        { id: '1', src: '/track1.mp3', title: 'Track 1', artist: 'Artist', artwork: '/art1.jpg' },
        { id: '2', src: '/track2.mp3', title: 'Track 2', artist: 'Artist', artwork: '/art2.jpg' },
      ],
    }),
    createMediaSessionPlugin(),
  ],
});
```

## Vue 3

### Component

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

### Composable

```vue
<template>
  <div ref="container" style="width: 100%; aspect-ratio: 16/9;"></div>
  <p>{{ currentTime }}s / {{ duration }}s ({{ progress.toFixed(0) }}%)</p>
</template>

<script setup>
import { ref } from 'vue';
import { useScarlettPlayer } from '@scarlett-player/vue';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const container = ref(null);
const { player, isReady, currentTime, duration, progress, play, pause, seek } =
  useScarlettPlayer({
    container,
    plugins: [createHLSPlugin(), uiPlugin()],
    src: 'https://example.com/video.m3u8',
  });
</script>
```

[See full Vue 3 docs →](./packages/vue/README.md)

## CDN Embed (No Bundler)

```html
<!-- Full build (video + audio + HLS + analytics + playlist) -->
<script src="https://cdn.example.com/scarlett-player/embed.js"></script>

<!-- Video player via data attributes -->
<div data-scarlett-player
     data-type="video"
     data-src="https://example.com/video.m3u8"
     data-poster="https://example.com/poster.jpg"
     style="aspect-ratio: 16/9;">
</div>

<!-- Audio player -->
<div data-scarlett-player
     data-type="audio"
     data-src="https://example.com/track.mp3"
     data-title="Track Name"
     data-artist="Artist">
</div>
```

Lighter builds available: `embed.video.js` (video only) and `embed.audio.js` (audio only).

## Packages

| Package | Description |
|---------|-------------|
| `@scarlett-player/core` | Core engine — reactive state, event bus, plugin system, error handling |
| `@scarlett-player/hls` | HLS provider — hls.js + native Safari fallback, ABR, quality selection, live DVR |
| `@scarlett-player/native` | Native provider — video (MP4, WebM, MOV, MKV, OGV) and audio (MP3, WAV, OGG, FLAC, AAC, M4A, Opus) |
| `@scarlett-player/ui` | Video UI — play/pause, progress, volume, fullscreen, PiP, quality menu, live indicator, keyboard shortcuts |
| `@scarlett-player/audio-ui` | Audio UI — compact player with artwork, progress, shuffle/repeat controls, multiple layouts |
| `@scarlett-player/airplay` | AirPlay casting — Safari AirPlay with auto-detect |
| `@scarlett-player/chromecast` | Chromecast — Google Cast SDK, session management, remote control |
| `@scarlett-player/analytics` | Analytics — startup time, rebuffer ratio, bitrate tracking, engagement metrics, beacon transport |
| `@scarlett-player/playlist` | Playlist — queue management, shuffle (Fisher-Yates), repeat modes, auto-advance, persistence |
| `@scarlett-player/media-session` | Media Session — lock screen controls, media keys, album art, seek bar |
| `@scarlett-player/captions` | Captions — WebVTT subtitles/closed captions, HLS subtitle extraction, auto-select by language |
| `@scarlett-player/watermark` | Watermark — anti-piracy text/image overlay, configurable position, opacity, dynamic repositioning |
| `@scarlett-player/vue` | Vue 3 — `<ScarlettPlayer>` component + `useScarlettPlayer()` composable |
| `@scarlett-player/embed` | CDN embed — auto-init via data attributes, UMD + ESM bundles, video/audio/full entry points |

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
pnpm install          # Install dependencies
pnpm build            # Build all packages (core first, then plugins)
pnpm test             # Run all 1,200+ tests
pnpm typecheck        # Type check all packages
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm validate         # lint + typecheck + test + build (CI check)
node demo/build.cjs   # Rebuild demo site
```

### Versioning

Uses [Changesets](https://github.com/changesets/changesets) with fixed versioning — all 12 packages share the same version number.

```bash
pnpm changeset        # Create a changeset for your changes
pnpm version          # Bump versions + update changelogs
pnpm release          # Build + publish to npm
```

## Project Structure

```
packages/
  core/             # Core engine — state, events, plugins, error handling
  plugins/
    hls/            # HLS provider (hls.js + native Safari)
    native/         # Native media (video + audio formats)
    ui/             # Video UI controls
    audio-ui/       # Audio player UI (full, compact, mini layouts)
    airplay/        # AirPlay casting
    chromecast/     # Chromecast casting
    analytics/      # QoE metrics & engagement
    playlist/       # Queue, shuffle, repeat
    media-session/  # Lock screen & media keys
    captions/       # WebVTT closed captions
    watermark/      # Anti-piracy watermark overlay
  vue/              # Vue 3 component + composable
  embed/            # CDN embed (video, audio, and full builds)
demo/               # Interactive demo (video + audio players)
docs/               # Landing page + architecture docs
```

## Browser Support

- Chrome / Edge 80+
- Firefox 78+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## Roadmap

- [x] Core player engine
- [x] HLS playback (hls.js + native)
- [x] Native video (MP4, WebM, MOV, MKV)
- [x] UI controls plugin
- [x] Quality selection
- [x] AirPlay & Chromecast casting
- [x] Vue 3 component wrapper
- [x] Playlists & queue management
- [x] Media Session API (lock screen controls)
- [x] Audio player UI
- [x] Thumbnail preview on seek
- [x] Analytics & QoE tracking
- [x] Live DVR controls
- [x] Touch/mobile support (basic)
- [x] Closed captions (WebVTT)
- [x] Anti-piracy watermark overlay
- [ ] Mobile gesture controls (double-tap seek, swipe) — Sprint 1
- [ ] DRM support — Sprint 2
- [ ] Low-latency HLS (LL-HLS) — Sprint 2
- [ ] Internationalization (i18n) — Sprint 2
- [ ] React component wrapper — Sprint 3
- [ ] Web Component wrapper — Sprint 3

## License

MIT License — see [LICENSE](./LICENSE).

Inspired by [Vidstack Player](https://github.com/vidstack/player) (Copyright 2023 Rahim Alwer, MIT License).
