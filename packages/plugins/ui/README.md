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

- Responsive control bar: measures itself and moves low-priority controls into
  an overflow tray rather than rendering them past a narrow player's edge
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

## Responsive control bar

The bar is a single non-wrapping row of fixed-width controls, and both known
hosts clip what does not fit. On a 390px phone with a 17-slot layout that meant
the whole right-hand group (settings, captions, cast, PiP, fullscreen) rendered
off canvas: captions and playback speed were not broken, they were unreachable.

The bar now measures itself and moves the least important controls into a tray
behind a "More controls" button. It runs at first paint, whenever the player is
resized, and whenever a control shows or hides itself.

```typescript
uiPlugin({
  responsive: true,                 // Default: true
  priority: { share: 'never' },     // Pin a control, or re-rank one
});
```

`responsive: false` restores the pre-1.8 behaviour exactly: no measuring, no
observer, no tray button, no extra DOM.

### Priority

Lower ranks leave first. Ties go to the control that is later in the layout.

| Slot | Rank | Leaves to |
|---|---|---|
| `bandwidth-indicator` | 0 | hidden (a status glyph, not an action) |
| `skip-backward`, `skip-forward` | 1 | tray (gestures cover the same seek on touch) |
| `pip` | 2 | tray |
| any registered control (`share`, `chapters`, the playlist buttons, ...) | 3 | tray |
| `chromecast`, `airplay` | 4 | tray (AirPlay is how an iPhone reaches a television, so it is never hidden) |
| `volume` | 5 | tray (iOS `video.volume` is read only) |
| `captions` | 6 | tray (also lives inside the settings menu) |
| `quality` | 6 | hidden (its menu is anchored in the bar, and the settings menu carries a Quality row, so `quality` needs `settings` in the layout) |
| `time` | 7 | hidden (a readout in a tray says nothing; the scrub tooltip still shows position) |
| `play`, `live-indicator`, `settings`, `fullscreen`, `spacer` | never | stays |

Settings never moves, so playback speed and captions are at most two taps away
at every width.

Because `quality` hides, a layout with `quality` and no `settings` would lose
quality selection entirely below the width where the bar fits. `uiPlugin()`
throws on that layout unless `quality` is pinned
(`priority: { quality: 'never' }`) or `responsive` is off.

### The floor

The controls that never move (play, settings, the tray button and fullscreen)
need 188px of inner width, which is about 212px of player width, or about 280px
on a live stream where the live indicator also stays. Below that the bar clips
again, exactly as it did before.

### Menus

The settings and quality menus are bounded to the player's height
(`--sp-menu-max-height`, written by the plugin) and scroll inside it. Without
that, the Speed sub-panel is 253px tall against a 211px portrait phone player
and loses its Back header and its first three speeds to the host's
`overflow: hidden`.

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
