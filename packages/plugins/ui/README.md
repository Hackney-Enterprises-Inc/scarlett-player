# @scarlett-player/ui

UI controls plugin for Scarlett Player. Provides a modern, customizable player interface.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/ui
```

## Usage

```typescript
import { ScarlettPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const player = new ScarlettPlayer({
  container: document.getElementById('player'),
  plugins: [
    createHLSPlugin(),
    uiPlugin({
      theme: { accentColor: '#e50914' },
    }),
  ],
});
```

## Features

- Play/pause, seek, volume controls
- Fullscreen toggle
- Quality selector
- Progress bar with buffering indicator
- Time display (current / duration)
- Keyboard shortcuts
- Customizable theming
- Auto-hide controls

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
    accentColor: '#e50914',      // Progress bar, highlights
    primaryColor: '#ffffff',      // Text, icons
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    controlBarHeight: 48,
    iconSize: 24,
  },
  hideDelay: 3000,  // Auto-hide delay in ms
});
```

## License

MIT
