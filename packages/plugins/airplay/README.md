# @scarlett-player/airplay

AirPlay casting plugin for Scarlett Player. Enables wireless streaming to Apple TV and AirPlay-compatible devices.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/airplay
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { airplayPlugin } from '@scarlett-player/airplay';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [createHLSPlugin(), airplayPlugin()],
});

// Show AirPlay picker (Safari only)
player.requestAirPlay();
```

## Browser Support

AirPlay is only supported in **Safari** on macOS and iOS.

## API

```typescript
// Check if AirPlay is available
const plugin = player.getPlugin('airplay');
plugin.isAvailable();  // true if AirPlay devices detected

// Check if currently casting
plugin.isActive();     // true if casting to AirPlay

// Show device picker
plugin.showPicker();
```

## Events

```typescript
player.on('airplay:available', () => {
  // AirPlay devices detected
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
