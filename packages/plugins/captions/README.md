# @scarlett-player/captions

WebVTT subtitles and closed captions for [Scarlett Player](https://scarlettplayer.com). External `.vtt` files are attached as `<track>` elements, subtitle renditions that hls.js parses out of an HLS manifest are picked up as they arrive, and on native HLS (Safari, iOS) the browser's own text tracks are observed. Rendering is left to the browser; there is no custom VTT parser.

> **Docs:** [scarlettplayer.com/documentation](https://scarlettplayer.com/documentation/) · **For AI coding agents:** [llms.txt](https://scarlettplayer.com/llms.txt) (index) and [llms-full.txt](https://scarlettplayer.com/llms-full.txt) (every guide as one Markdown file)

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/captions
```

`@scarlett-player/core` 1.11 or later is a peer dependency. Two optional companions:

- `@scarlett-player/ui` supplies the captions button and the settings menu entries that let the viewer pick a track and style the caption text.
- `@scarlett-player/hls` is what `extractFromHLS` talks to. Without it, HLS extraction is simply skipped.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { uiPlugin } from '@scarlett-player/ui';
import { createCaptionsPlugin } from '@scarlett-player/captions';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/video.m3u8',
  plugins: [
    uiPlugin(),
    createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
        { language: 'es', label: 'Spanish', src: '/subs/es.vtt', kind: 'captions' },
      ],
      autoSelect: true,
      defaultLanguage: 'en',
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `sources` | `CaptionSource[]` | - | External WebVTT tracks, attached to the video on every `media:loaded` |
| `extractFromHLS` | `boolean` | `true` | Sync the subtitle renditions hls.js has parsed into player state. Ignored on native HLS, where the browser's tracks are observed instead |
| `autoSelect` | `boolean` | `false` | Select the track matching `defaultLanguage` once per media. Stands down if a track is already showing, for example one picked from Safari's own subtitle menu |
| `defaultLanguage` | `string` | `'en'` | BCP 47 language code used by `autoSelect` |
| `style` | `CaptionStyle` | - | Default caption text style, under the viewer's own saved choice. See [Caption style](#caption-style) |
| `persistStyle` | `boolean` | `true` | Save the viewer's caption style in `localStorage` and read it back on the next load |
| `styleStorageKey` | `string` | `'scarlett-caption-style'` | `localStorage` key for the viewer's caption style |

### CaptionSource

| Field | Type | Default | Description |
|---|---|---|---|
| `language` | `string` | required | BCP 47 code, written to the track's `srclang` |
| `label` | `string` | required | Human readable name shown in the picker |
| `src` | `string` | required | WebVTT URL. Cross-origin URLs need CORS |
| `kind` | `'subtitles' \| 'captions'` | `'subtitles'` | Track kind |
| `default` | `boolean` | - | Select this source once the media loads. Beats `defaultLanguage` and applies even with `autoSelect` off, so it is how you name one specific track. A track the browser is already showing still wins, and selection happens once per media. Mark at most one source |

## How tracks reach the player

The plugin does not render cues or add controls. It keeps two track state keys current:

- `textTracks`: every subtitle or caption track on the video element, as `{ id, label, language, kind, active }`. Ids are `track-<index>` into the video's `TextTrackList`, so they are only stable for the current media.
- `currentTextTrack`: the track whose mode is `showing`, or `null`.

Selection happens through the `track:text` event with a payload of `{ trackId }`, where `trackId` is `null` to turn captions off. The UI package's captions button and settings menu emit it; any other plugin can emit it through the plugin API. An explicit selection ends auto-selection for that media.

```ts
player.getState().textTracks;        // what the picker shows
player.getState().currentTextTrack;  // what is on screen
```

HLS renditions are never mirrored onto `<track>` elements. hls.js already creates a `TextTrack` per rendition and feeds it cues, so they show up in `textTracks` through the same sync as everything else.

## Caption style

Viewers can change how caption text looks, and you can set the defaults they start from. Each field has three layers, highest first:

1. the viewer's own choice, saved in `localStorage`
2. your `style` config
3. the browser default

```ts
createCaptionsPlugin({
  style: { fontSize: 150, color: 'yellow', backgroundOpacity: 0.5 },
});
```

### Fields

Every field is optional. A field left out keeps the browser default.

| Field | Values | CSS written |
|---|---|---|
| `fontSize` | `50`, `75`, `100`, `150`, `200` | `font-size: N%`, relative to the browser's own cue size |
| `color` | a palette key or hex | `color` |
| `backgroundColor` | a palette key or hex | `background-color: rgba(...)`. Drawn at 0.8 opacity (the browser default) unless `backgroundOpacity` is set |
| `backgroundOpacity` | `0`, `0.25`, `0.5`, `0.75`, `1` | the alpha of the background. On black unless `backgroundColor` is set |
| `edgeStyle` | `'none'`, `'drop-shadow'`, `'raised'`, `'depressed'`, `'outline'` | `text-shadow` |
| `fontFamily` | `'sans-serif'`, `'serif'`, `'monospace'` | `font-family` |

Colours are one of the palette keys `white`, `yellow`, `green`, `cyan`, `blue`, `magenta`, `red`, `black`, or a `#rgb` / `#rrggbb` hex string (for a brand colour). Other CSS colour syntax is not accepted.

Config and stored values are both validated against these lists. Anything else is dropped, with one warning naming the dropped keys, so no free-form CSS reaches the page.

### Viewer changes

With `@scarlett-player/ui` 1.28 or later, the settings menu's Captions panel gains a **Style** row leading to these options and a Reset. Without the UI package, call the methods yourself:

```ts
import type { CaptionsStyleApi } from '@scarlett-player/captions';

const captions = player.getPlugin<CaptionsStyleApi>('captions');

captions.setCaptionStyle({ fontSize: 200, color: 'white' });
captions.setCaptionStyle({ color: null }); // back to your default, or the browser's
captions.resetCaptionStyle();              // drop every viewer choice
```

| Method | Description |
|---|---|
| `getCaptionStyle()` | The style in effect: your `style` with the viewer's choices on top |
| `getCaptionStyleOverrides()` | The viewer's choices only |
| `setCaptionStyle(patch)` | Set fields, or pass `null` for a field to clear the viewer's choice. Invalid values are ignored with a warning. Saved, applied at once, and written to state |
| `resetCaptionStyle()` | Clear every viewer choice and delete the saved style |

The effective style is also the `captionStyle` state key, so a headless host can subscribe to it:

```ts
player.getState().captionStyle; // e.g. { fontSize: 200, color: 'yellow' }
```

### Storage

The viewer's choices are saved under the `localStorage` key `scarlett-caption-style` (change it with `styleStorageKey`) as `{ "v": 1, "style": { ... } }`. The key is per origin, so one choice follows the viewer across every player on your site. It is written only when the viewer changes something, and removed when they reset. It holds nothing that identifies the viewer.

Set `persistStyle: false` to neither read nor write it. A viewer's change then lasts for that player only.

When `localStorage` is blocked (a sandboxed iframe, Safari private mode) the choice is kept in memory for the page instead, and nothing throws. The in-memory copy wins while storage is unreadable, or still holds what it held when the write failed, so a write or a reset that storage refused cannot leave a stale preference behind for the next player. When storage could not be read at that moment either, there is nothing to compare against: the first readable answer becomes the baseline and the copy stays until storage is seen to change after that. It does not mask storage for good: once storage is seen to hold something different (another tab saved a choice, or storage came back changed), the stored value wins and the in-memory copy is dropped.

A change applies to the player it was made on, and to players created afterwards. Other players already on the page, and other open tabs, pick it up on their next load.

### Known limits

- **Only what `::cue` allows.** Caption position, a window box behind the whole caption, padding, and text opacity separate from colour cannot be set.
- **System caption settings can win.** The caption preferences in macOS and iOS (Accessibility > Captions), and in Android and Windows, can override page styles. The plugin does not fight them.
- **iPhone fullscreen.** The iPhone's native fullscreen player draws captions with the system settings, not the page's.
- **Picture-in-Picture and Cast.** The PiP window and Chromecast receivers do not use the page's styles.
- **Browsers differ.** `::cue` support varies by browser, so an option can look different, or have no effect, in one of them.

## Lifecycle

- `init`: the container gets a `data-sp-caption-scope` attribute, the saved viewer style is read, and the scoped stylesheet is added if there is a style to apply.
- `media:load-request`: the plugin removes the `<track>` elements it added, stops observing the old track list and clears both state keys. Tracks the browser created itself are left alone.
- `media:loaded`: external sources are re-attached, the new `TextTrackList` is observed for `addtrack`, `removetrack` and `change`, state is synced, and the hls.js subscription is set up. If the hls.js instance is not ready yet it retries once after 500 ms.
- Caption style is not touched by a source change: the rule matches any `<video>` in the container, so a replaced element is styled without further work. It also holds in fullscreen, because the player puts its container fullscreen.
- `destroy`: the stylesheet and the scope attribute are removed.

## Events

None emitted. The plugin listens to `track:text`, `media:loaded` and `media:load-request`.

## CSS

The browser draws the cues, so the only styling hook is the `::cue` pseudo-element.

With no `style` configured and no viewer style saved, the plugin adds no stylesheet, and your own `video::cue` rules apply as before.

Once there is a style to apply, the plugin adds one `<style data-sp-caption-style>` inside the player container, holding a single rule: `[data-sp-caption-scope="<n>"] video::cue { ... }`. It sets only the properties that have a value. For those properties a plain host `video::cue` rule loses to it on specificity; properties the plugin does not set are still yours. The element is removed again when the style becomes empty and when the player is destroyed.

The `<n>` is unique to each player, and stays unique when two separately bundled copies of the plugin share one page (the embed full and video builds, say), so one player's rule never reaches another player's cues. The copies share a counter on the global object; if the page has frozen its globals or the engine has no `globalThis`, the plugin still starts and each copy counts on its own, so uniqueness across copies is then best effort.

A page with a Content Security Policy that blocks inline styles (`style-src` without `'unsafe-inline'`) blocks this stylesheet too; the caption style is then not applied, and nothing else is affected.

## License

MIT
