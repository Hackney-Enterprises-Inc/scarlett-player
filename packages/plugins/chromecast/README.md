# @scarlett-player/chromecast

Chromecast plugin for Scarlett Player. Enables casting to Chromecast and Google Cast-compatible devices.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/chromecast
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { chromecastPlugin } from '@scarlett-player/chromecast';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [
    createHLSPlugin(),
    chromecastPlugin({
      receiverApplicationId: 'YOUR_APP_ID', // Optional, uses default media receiver
    }),
  ],
});

// Start casting
await player.requestChromecast();
```

## Configuration

```typescript
chromecastPlugin({
  // Custom receiver app ID (optional)
  receiverApplicationId: 'YOUR_APP_ID',

  // Auto-join existing session
  autoJoinPolicy: 'ORIGIN_SCOPED',
});
```

## API

```typescript
const plugin = player.getPlugin('chromecast');

// Check availability
plugin.isAvailable();  // true if Cast SDK loaded

// Check if casting
plugin.isActive();     // true if casting

// Show device picker
await plugin.requestSession();

// Stop casting
plugin.stopCasting();
```

## Events

```typescript
player.on('chromecast:available', () => {
  // Cast SDK ready
});

player.on('chromecast:connected', ({ deviceName }) => {
  // Connected to device
});

player.on('chromecast:disconnected', () => {
  // Disconnected
});
```

## License

MIT
