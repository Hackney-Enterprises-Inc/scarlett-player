# @scarlett-player/audio-ui

Compact audio player UI for [Scarlett Player](https://scarlettplayer.com). Album artwork, title and artist, a seekable progress bar that animates smoothly between time updates, play/pause, previous/next, volume, and shuffle/repeat buttons that drive the playlist plugin when it is installed. Three layouts: `full`, `compact` and `mini`.

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/native @scarlett-player/audio-ui
```

`@scarlett-player/core` is a peer dependency. `@scarlett-player/playlist` is optional: previous/next, shuffle and repeat call it when it is present. Without it, previous seeks to the start of the track and next does nothing.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/track.mp3',
  plugins: [createNativePlugin(), createAudioUIPlugin({ layout: 'compact' })],
});
```

The plugin appends its own element to the player container and injects one `<style>` element generated from the theme. The title comes from the `title` state key and the artwork from `poster`. When the playlist plugin is present, the `playlist:change` event supplies title, artist and artwork for each track.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `layout` | `'full' \| 'compact' \| 'mini'` | `'full'` | Initial layout |
| `showArtwork` | `boolean` | `true` | Artwork tile. All layouts |
| `showTitle` | `boolean` | `true` | Track title. In `mini` a long title scrolls as a marquee |
| `showArtist` | `boolean` | `true` | Artist line. `full` and `compact` only |
| `showTime` | `boolean` | `true` | Current time and duration labels. `full` only |
| `showVolume` | `boolean` | `true` | Mute button and volume slider. `full` only |
| `showShuffle` | `boolean` | `true` | Shuffle button. `full` only, needs the playlist plugin |
| `showRepeat` | `boolean` | `true` | Repeat button. `full` only, needs the playlist plugin |
| `showNavigation` | `boolean` | `true` | Previous and next buttons. `full` and `compact` |
| `defaultArtwork` | `string` | - | Artwork URL shown until the media supplies a poster |
| `theme` | `AudioUITheme` | see below | Colours, radius and font, merged over the defaults |
| `classPrefix` | `string` | `'scarlett-audio'` | Prefix for every generated class name |
| `autoHide` | `number` | `0` | Declared on the config interface but not read by the plugin yet |

### Theme

Every key is optional and falls back to the default.

| Key | Default |
|---|---|
| `primary` | `'#6366f1'` |
| `background` | `'#18181b'` |
| `text` | `'#fafafa'` |
| `textSecondary` | `'#a1a1aa'` |
| `progressBackground` | `'#3f3f46'` |
| `progressFill` | `'#6366f1'` |
| `borderRadius` | `'12px'` |
| `fontFamily` | system font stack |

## Imperative API

```ts
const audioUI = createAudioUIPlugin();

audioUI.getElement();               // the root element, or null before init
audioUI.setLayout('mini');          // rebuilds the UI in place
audioUI.setTheme({ primary: '#f43f5e' });  // regenerates the stylesheet
audioUI.show();
audioUI.hide();
audioUI.toggle();
```

## Events

The plugin emits no events of its own. Clicks are translated into core events: `playback:play`, `playback:pause`, `playback:seeking`, `volume:mute` and `volume:change`. It listens to `playback:timeupdate`, `playlist:change`, `playlist:shuffle` and `playlist:repeat`, and re-renders on every state change.

## CSS

There are no CSS custom properties. Theme values are written straight into the injected stylesheet, so restyle through `theme`, `setTheme()`, or by overriding the classes below. Class names use `classPrefix` (default `scarlett-audio`).

| Class | Element |
|---|---|
| `.scarlett-audio` | Root. Also carries `--full`, `--compact` or `--mini`, and `--hidden` after `hide()` |
| `.scarlett-audio__artwork` | Artwork tile, with `__artwork-placeholder` when there is no default artwork |
| `.scarlett-audio__info`, `__title`, `__artist` | Text block |
| `.scarlett-audio__progress`, `__progress-bar`, `__progress-fill`, `__time` | Seek bar and time labels |
| `.scarlett-audio__controls`, `__btn`, `__btn--primary`, `__btn--active` | Buttons. `--play`, `--prev`, `--next`, `--shuffle`, `--repeat`, `--volume` name each one |
| `.scarlett-audio__volume`, `__volume-slider`, `__volume-fill` | Volume control |

## License

MIT
