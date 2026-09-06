# @scarlett-player/watermark

Anti-piracy watermark plugin for [Scarlett Player](https://scarlettplayer.com). Overlays text (typically the viewer's email or account id) or an image on the player, at a fixed corner or moving to a random position on a timer, with an optional delay before it first appears. The overlay is shown on play and hidden on pause and ended, so it never sits on the poster.

## Installation

```bash
pnpm add @scarlett-player/watermark @scarlett-player/core
```

`@scarlett-player/core` is a peer dependency.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createWatermarkPlugin } from '@scarlett-player/watermark';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/video.m3u8',
  plugins: [
    createHLSPlugin(),
    createWatermarkPlugin({
      text: 'user@example.com',
      position: 'bottom-right',
      opacity: 0.4,
      dynamic: true,
      dynamicInterval: 15000,
      showDelay: 20000,
    }),
  ],
});
```

Pass `imageUrl` instead of `text` to render a logo. When both are set the image wins.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | `undefined` | Text to render. Ignored when `imageUrl` is set |
| `imageUrl` | `string` | `undefined` | Image to render instead of text |
| `position` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right' \| 'center'` | `'bottom-right'` | Starting position |
| `opacity` | `number` | `0.5` | Opacity from 0 to 1 |
| `fontSize` | `number` | `14` | Font size in px for text watermarks |
| `imageHeight` | `number` | `40` | Maximum image height in px. Only applies with `imageUrl` |
| `padding` | `number` | `10` (top and sides), `40` (bottom) | Distance from the edges in px. The larger bottom default keeps the mark clear of the control bar. Setting a value applies it to every edge |
| `dynamic` | `boolean` | `false` | Move to a different random position on a timer |
| `dynamicInterval` | `number` | `10000` | Milliseconds between moves when `dynamic` is on |
| `showDelay` | `number` | `0` | Milliseconds to wait after play before the mark first appears. A pause during the delay cancels it |

The `dynamic` timer starts when the mark is shown and stops on pause and ended, so a paused player never keeps a timer alive.

## Plugin API

The plugin is registered under the id `watermark`:

```ts
import type { IWatermarkPlugin } from '@scarlett-player/watermark';

const watermark = player.getPlugin<IWatermarkPlugin>('watermark');

watermark?.setText('session 8f3a');
watermark?.setImage('/logo.png');
watermark?.setPosition('top-left');
watermark?.setOpacity(0.3);
watermark?.setImageHeight(60);
watermark?.setPadding(24);
watermark?.hide();
watermark?.show();
watermark?.getConfig();
```

| Method | Description |
|---|---|
| `setText(text)` | Replace the content with text |
| `setImage(imageUrl)` | Replace the content with an image |
| `setPosition(position)` | Move to one of the five positions |
| `setOpacity(opacity)` | Set opacity, clamped to 0 to 1 |
| `setImageHeight(height)` | Set the maximum image height in px |
| `setPadding(padding)` | Set the edge padding in px for every edge and re-apply the current position |
| `show()` / `hide()` | Toggle visibility without touching the timers |
| `getConfig()` | The original config merged with the current position, opacity, image height and padding |

## Per-track watermarks

When `@scarlett-player/playlist` is present the plugin listens for `playlist:change` and reads `metadata.watermarkUrl` or `metadata.watermarkText` from the new track. If either is set the content is replaced for that track; tracks without them keep the current content.

```ts
{ id: '2', src: '/episode-2.mp4', metadata: { watermarkText: 'Screener: press only' } }
```

## Styling

The overlay is a single `div` appended to the player container with inline positioning, `pointer-events: none`, white text with a subtle shadow, and a 0.5s transition. It carries these classes for your own CSS:

| Class | When |
|---|---|
| `sp-watermark` | Always |
| `sp-watermark--visible` / `sp-watermark--hidden` | Current visibility |
| `sp-watermark--top-left`, `sp-watermark--top-right`, `sp-watermark--bottom-left`, `sp-watermark--bottom-right`, `sp-watermark--center` | Current position, applied after the first `setPosition()` or dynamic move |
| `sp-watermark--dynamic` | Present when `dynamic` is on, applied after the first position change |

The element also has a `data-position` attribute holding the current position. No CSS custom properties are used.

## Events

The plugin emits no events. It listens to `playback:play`, `playback:pause`, `playback:ended` and `playlist:change`.

## License

MIT
