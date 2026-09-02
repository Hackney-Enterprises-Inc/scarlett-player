# @scarlett-player/core

Core player engine for Scarlett Player - a lightweight, plugin-based video player.

## Installation

```bash
npm install @scarlett-player/core
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

// createPlayer() constructs, initialises every plugin, and loads `src`.
const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.m3u8',
  plugins: [createHLSPlugin(), uiPlugin()],
});
```

## API

### createPlayer(options)

```typescript
const player = await createPlayer({
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
player.init()                  // Initialise plugins and load `src` (createPlayer calls this)
player.load(src)               // Load a source (initialises the player first if needed)
player.play()                  // Start playback
player.pause()                 // Pause playback
player.seek(time)              // Seek to time in seconds
player.setVolume(0-1)          // Set volume
player.setMuted(boolean)       // Mute/unmute
player.setPoster(url)          // Change the poster ('' clears it); load() never touches it
player.setPlaybackRate(rate)   // Set playback speed
player.requestFullscreen()     // Enter fullscreen
player.exitFullscreen()        // Exit fullscreen
player.destroy()               // Cleanup and destroy
```

### State getters

```typescript
player.playing                 // boolean
player.paused                  // boolean
player.currentTime             // seconds
player.duration                // seconds
player.volume                  // 0-1
player.muted                   // boolean
player.poster                  // Current poster URL, '' when there is none
player.playbackRate            // number
player.fullscreen              // boolean
player.live                    // boolean
```

The poster is state, not an element attribute: the provider plugins mirror it
onto the media element and re-apply it whenever it changes, so `setPoster()`
takes effect on a player that is already running. `load()` leaves it alone,
because the poster belongs to whoever set it (a consumer, or the playlist
plugin on a track change) and is written before the load it goes with.

### Events

```typescript
player.on('player:ready', () => {});                  // Fires once, at the end of the first init()/load()
player.on('playback:play', () => {});
player.on('playback:pause', () => {});
player.on('playback:ended', () => {});
player.on('playback:timeupdate', ({ currentTime }) => {});
player.on('playback:seeking', ({ time }) => {});
player.on('volume:change', ({ volume, muted }) => {});
player.on('fullscreen:change', ({ fullscreen }) => {});
player.on('quality:change', ({ quality, auto }) => {});
player.on('error', (error) => {});                    // Structured PlayerError { code, message, fatal }
player.on('error:reconnecting', ({ attempt, delayMs }) => {}); // Self-heal attempt scheduled
player.on('error:recovered', () => {});               // Self-heal succeeded, playback resumed
player.on('error:retry', ({ src }) => {});            // Viewer pressed Try Again
```

`player:ready` is emitted once, at the end of the first initialisation pass, so
a listener has to be attached before `init()` or `load()` runs. With
`createPlayer()` the returned promise is the readiness signal and the event is
redundant.

## Plugins

The core package provides the foundation. Add plugins for functionality:

- `@scarlett-player/hls` - HLS streaming
- `@scarlett-player/native` - MP4, WebM, MOV, MKV
- `@scarlett-player/ui` - Player controls
- `@scarlett-player/airplay` - AirPlay casting
- `@scarlett-player/chromecast` - Chromecast casting

## License

MIT
