# @scarlett-player/gestures

Touch gestures for [Scarlett Player](https://scarlettplayer.com). Double-tap the right of the picture to jump forward, the left to jump back, keep tapping to go further, and single-tap to toggle the controls. Gestures are gated on `pointerType === 'touch'`, so a mouse or pen never triggers any of them and desktop behaviour is unchanged.

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/gestures
```

`@scarlett-player/core` is a peer dependency. `@scarlett-player/ui` is optional: tap-to-toggle needs it, double-tap seeking does not.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { uiPlugin } from '@scarlett-player/ui';
import { createGesturesPlugin } from '@scarlett-player/gestures';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/video.m3u8',
  plugins: [uiPlugin(), createGesturesPlugin({ seekSeconds: 10 })],
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean \| 'auto'` | `'auto'` | `'auto'` installs the gesture surface when `matchMedia('(any-pointer: coarse)')` matches, so a touchscreen laptop counts. `true` forces it, `false` disables the plugin. No user agent sniffing |
| `seekSeconds` | `number` | `10` | Seconds moved per seek step |
| `doubleTapWindowMs` | `number` | `275` | Second tap within this window makes a double tap |
| `accumulationWindowMs` | `number` | `650` | A further tap in the same zone within this window extends the seek |
| `zones` | `{ left?, right? }` | `{ left: 0.33, right: 0.33 }` | Fractions of the width given to each seek zone. The middle is inert on purpose |
| `slopPx` | `number` | `10` | Movement in CSS pixels that turns a tap into a drag and cancels it |
| `feedback` | `boolean` | `true` | Show the zone highlight and cumulative seconds label |
| `haptics` | `boolean` | `true` | `navigator.vibrate(10)` on each seek step where supported. iOS Safari ignores it |
| `tapToToggleControls` | `boolean` | `true` | Let a single tap show or hide the controls |

## Behaviour

- Not installed for audio: when `mediaType` is `'audio'` at init the plugin stays inactive.
- Seeking is refused while Chromecast or AirPlay is active, on live streams with no seekable range, and on VOD until a finite duration is known.
- On live DVR a seek is clamped to the seekable range. A forward tap at the live edge announces "Already at the live edge" instead of showing a ripple.
- Each tap in a run adds `seekSeconds`; the label shows the cumulative total. A tap in the opposite zone ends the run rather than reversing it, and a drag or a second finger cancels it.
- A single tap shows hidden controls immediately. Hiding waits out `doubleTapWindowMs` so a seek is never preceded by the controls blinking away, and nothing hides while paused.
- The surface never calls `preventDefault` or `stopPropagation`, so document-level click handlers (menus closing, for example) still fire.

The plugin exposes `ownsTapInteraction()`, which the UI package checks before running its own show-controls logic on touch. It returns `true` while the plugin is active and `tapToToggleControls` is on.

## Events

| Event | Payload | When |
|---|---|---|
| `gesture:tap` | `{ zone }` | A single tap landed. `zone` is `'left'`, `'middle'` or `'right'` |
| `gesture:seek` | `{ direction, seconds, cumulative }` | A seek step moved the playhead. `direction` is `'forward'` or `'backward'` |

Each seek step also emits the core `playback:seeking` event with the target time.

## CSS

Styles are injected once per document in a `<style id="sp-gestures-styles">`. There are no CSS custom properties.

| Class | Element |
|---|---|
| `.sp-gestures` | The surface. Absolutely positioned at `z-index: 6`, leaving the bottom 64px to the progress and control bars |
| `.sp-gestures__zone` | One seek zone, `--left` or `--right`, sized from `zones`. `--active` while feedback is showing |
| `.sp-gestures__label` | The cumulative seconds label inside a zone |
| `.sp-gestures__live` | Visually hidden polite live region carrying the announcement |

The zone transition is disabled under `prefers-reduced-motion: reduce`.

## Lower level exports

`createRecognizer`, `zoneFor` and `DEFAULT_RECOGNIZER_OPTIONS` expose the pure tap state machine, and `GestureOverlay` the DOM surface, for hosts that want to build their own handling on top.

## License

MIT
