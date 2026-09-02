# @scarlett-player/ui

UI controls plugin for Scarlett Player. Provides a modern, customizable player interface.

## Installation

```bash
npm install @scarlett-player/core @scarlett-player/ui
```

## Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/video.m3u8',
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
- Big play button over the poster, shown until playback first starts and again
  as Replay when it ends (`bigPlayButton: false` turns it off)
- Fullscreen toggle
- Picture-in-Picture toggle (disabled until media metadata is loaded; hidden
  when the browser has no PiP support; Safari webkit presentation mode
  supported)
- Quality selector
- Progress bar with buffering indicator
- Time display (current / duration)
- Error overlay with viewer-friendly copy per error code, a Try Again action,
  and a reconnecting state while the player self-heals
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

## Big Play Button

```typescript
uiPlugin({
  bigPlayButton: false,  // Default: true
});
```

On by default because it is the only play affordance on the picture itself: a
mouse click on the video surface only reveals the control bar, and touch taps
belong to `@scarlett-player/gestures`, so a poster with the button off leaves
the viewer hunting for the small button in the bar. It is a real `<button>`
with an `aria-label`, sized past the 44 px minimum target, coloured with
`--sp-accent`, and it sits above the gestures surface so a tap starts playback
instead of toggling the controls.

Turn it off when the host page draws its own play affordance over the player.

## License

MIT
