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

## Layout

`controls` is the order of slots in the bar. The default is:

```typescript
uiPlugin({
  controls: [
    'play', 'skip-backward', 'skip-forward', 'volume', 'time',
    'live-indicator', 'bandwidth-indicator', 'spacer', 'settings',
    'captions', 'chromecast', 'airplay', 'pip', 'fullscreen',
  ],
});
```

Any id a plugin registers through the control registry (`share`, `chapters`,
`playlist-previous`, `playlist-next`, ...) can be placed in the same list. A
control whose plugin is not loaded is skipped.

## Timeline extensions

The control registry lets a plugin contribute a *button*. `registerTimelineExtension` lets one contribute an editing layer over the **playback timeline** - the clip plugin's in/out handles are the first, and the reason it exists: an editor with its own miniature track cannot express a 30-second selection on a two-hour source, and makes the viewer pick points on a rail that is not the one they were just scrubbing.

```typescript
import { registerTimelineExtension } from '@scarlett-player/ui';

const release = registerTimelineExtension(api.container, (surface) => {
  surface.element.appendChild(myHandles);

  return {
    update: () => reposition(surface.getRailRect()),
    onSeekStart: () => suspendMyPreview(),
    onSeekEnd: () => {},
    destroy: () => myHandles.remove(),
  };
});
```

`surface` gives an extension four things and nothing else:

| Member | What it is |
|---|---|
| `element` | The layer to paint into: a sibling of the `role="slider"` seek element (never a child of it), positioned with exactly the rail's horizontal geometry and centred on it. `pointer-events: none`, so plain presses on the rail keep seeking; give your own hit targets `pointer-events: auto` |
| `getRailRect()` | The rail's box, in client coordinates - the same box the slider maps a press against, so a `clientX`-to-time mapping agrees with the player's own seeking to the pixel |
| `setEditing(active)` | Holds the control bar and progress bar visible and reserves the vertical room an editor needs around the rail. Independent of any control's `isMenuOpen()`, so an extension opened from a host's own button still holds the bar |
| `setDragging(active)` | Suppresses ordinary seeking while the extension owns the pointer, and gets the hover tooltip out of the way |

The extension gives back `update()` (called with the progress bar's own update, so it never has to observe the rail itself), `onSeekStart()` / `onSeekEnd()` for ordinary seeks it does **not** own - mouse, touch, keyboard and cancellation alike - and `destroy()`.

There is one active extension per player, keyed by container. Registering again replaces and destroys the previous one; the returned disposer only ever removes the registration it made, so a late cleanup cannot unmount its successor. Registration works before or after the UI plugin initialises. `unregisterTimelineExtension(container)` drops a player's registration wholesale, and `hasTimelineExtension(container)` reports whether one is present.

The UI package reads no plugin-specific state and gains no `IPluginAPI` surface for this: it offers a positioned layer and four lifecycle calls, and an extension paints into it.

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
