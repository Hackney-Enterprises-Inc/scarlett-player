# @scarlett-player/chromecast

Chromecast plugin for Scarlett Player. Enables casting to Chromecast and Google Cast-compatible devices.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/chromecast
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { chromecastPlugin, type IChromecastPlugin } from '@scarlett-player/chromecast';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.m3u8',
  plugins: [createHLSPlugin(), chromecastPlugin()],
});

// Start casting
await player.requestChromecast();

// Stop casting
const chromecast = player.getPlugin<IChromecastPlugin>('chromecast');
chromecast?.endSession();
```

## Configuration

`chromecastPlugin()` takes no options. It loads the Google Cast SDK on demand,
casts to the default media receiver, and uses the `ORIGIN_SCOPED` auto-join
policy. A custom receiver application ID is not configurable in this version.

## API

```typescript
import { isCastSupported, type IChromecastPlugin } from '@scarlett-player/chromecast';

// Feature-detect before registering the plugin (optional)
isCastSupported();     // true in Chromium browsers that can load the Cast SDK

const plugin = player.getPlugin<IChromecastPlugin>('chromecast');

// Check availability
plugin?.isAvailable();  // true when Cast devices are reachable

// Check if casting
plugin?.isConnected();  // true while a session is connected
plugin?.getDeviceName(); // Connected device name, or null

// Show device picker
await plugin?.requestSession();

// Stop casting
plugin?.endSession();

// Control the remote player directly
plugin?.play();
plugin?.pause();
plugin?.seek(30);
plugin?.setVolume(0.5);
plugin?.setMuted(true);
```

## Events

```typescript
player.on('chromecast:available', () => {
  // Cast devices reachable
});

player.on('chromecast:unavailable', () => {
  // No Cast devices reachable
});

player.on('chromecast:connected', ({ deviceName }) => {
  // Connected to device
});

player.on('chromecast:disconnected', () => {
  // Disconnected
});

player.on('chromecast:error', ({ error }) => {
  // SDK load or session failure
});
```

## License

MIT
