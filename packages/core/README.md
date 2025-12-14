# @scarlett-player/core

Core player engine for Scarlett Player - a lightweight, plugin-based video player.

## Installation

```bash
npm install @scarlett-player/core
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [createHLSPlugin(), uiPlugin()],
});

await player.init();
await player.load('https://example.com/video.m3u8');
```

## API

### ScarlettPlayer

```typescript
const player = new ScarlettPlayer({
  container: HTMLElement,      // Required: container element
  src?: string,                // Initial source URL
  poster?: string,             // Poster image URL
  autoplay?: boolean,          // Auto-play on load (default: false)
  muted?: boolean,             // Start muted (default: false)
  loop?: boolean,              // Loop playback (default: false)
  volume?: number,             // Initial volume 0-1 (default: 1)
  plugins?: Plugin[],          // Plugins to register
  logLevel?: 'debug' | 'info' | 'warn' | 'error',
});
```

### Methods

```typescript
player.init()                  // Initialize player
player.load(src)               // Load a source
player.play()                  // Start playback
player.pause()                 // Pause playback
player.seek(time)              // Seek to time in seconds
player.setVolume(0-1)          // Set volume
player.setMuted(boolean)       // Mute/unmute
player.setPlaybackRate(rate)   // Set playback speed
player.requestFullscreen()     // Enter fullscreen
player.exitFullscreen()        // Exit fullscreen
player.destroy()               // Cleanup and destroy
```

### Events

```typescript
player.on('playback:play', () => {});
player.on('playback:pause', () => {});
player.on('playback:ended', () => {});
player.on('playback:timeupdate', ({ currentTime }) => {});
player.on('playback:seeking', ({ time }) => {});
player.on('volume:change', ({ volume, muted }) => {});
player.on('fullscreen:change', ({ fullscreen }) => {});
player.on('quality:change', ({ quality, auto }) => {});
player.on('error', (error) => {});
```

## Plugins

The core package provides the foundation. Add plugins for functionality:

- `@scarlett-player/hls` - HLS streaming
- `@scarlett-player/native` - MP4, WebM, MOV, MKV
- `@scarlett-player/ui` - Player controls
- `@scarlett-player/airplay` - AirPlay casting
- `@scarlett-player/chromecast` - Chromecast casting

## License

MIT
