# @scarlett-player/airplay

AirPlay casting plugin for Scarlett Player. Enables wireless streaming to Apple TV and AirPlay-compatible devices.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/airplay
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { airplayPlugin } from '@scarlett-player/airplay';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.m3u8',
  plugins: [createHLSPlugin(), airplayPlugin()],
});

// Show AirPlay picker (Safari only)
player.requestAirPlay();
```

## Browser Support

AirPlay is only supported in **Safari** on macOS and iOS.

## API

```typescript
import { isAirPlaySupported, type IAirPlayPlugin } from '@scarlett-player/airplay';

// Feature-detect before registering the plugin (optional)
isAirPlaySupported();  // true when the browser exposes the WebKit AirPlay API

// Check if AirPlay is available
const plugin = player.getPlugin<IAirPlayPlugin>('airplay');
plugin?.isAvailable();  // true if AirPlay devices detected

// Check if currently casting
plugin?.isActive();     // true if casting to AirPlay

// Show device picker
await plugin?.showPicker();
```

## Events

```typescript
player.on('airplay:available', () => {
  // AirPlay devices detected
});

player.on('airplay:unavailable', () => {
  // No AirPlay devices reachable
});

player.on('airplay:connected', () => {
  // Started casting
});

player.on('airplay:disconnected', () => {
  // Stopped casting
});
```

## License

MIT
