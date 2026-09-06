# @scarlett-player/captions

WebVTT subtitles and closed captions for [Scarlett Player](https://scarlettplayer.com). External `.vtt` files are attached as `<track>` elements, subtitle renditions that hls.js parses out of an HLS manifest are picked up as they arrive, and on native HLS (Safari, iOS) the browser's own text tracks are observed. Rendering is left to the browser; there is no custom VTT parser.

## Installation

```bash
pnpm add @scarlett-player/core @scarlett-player/captions
```

`@scarlett-player/core` is a peer dependency. Two optional companions:

- `@scarlett-player/ui` supplies the captions button and the settings menu entry that let the viewer pick a track.
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

### CaptionSource

| Field | Type | Default | Description |
|---|---|---|---|
| `language` | `string` | required | BCP 47 code, written to the track's `srclang` |
| `label` | `string` | required | Human readable name shown in the picker |
| `src` | `string` | required | WebVTT URL. Cross-origin URLs need CORS |
| `kind` | `'subtitles' \| 'captions'` | `'subtitles'` | Track kind |
| `default` | `boolean` | - | Declared on the interface but not read. Every track starts disabled and selection is managed by the plugin; use `autoSelect` and `defaultLanguage` instead |

## How tracks reach the player

The plugin does not render anything or add controls. It keeps two state keys current:

- `textTracks`: every subtitle or caption track on the video element, as `{ id, label, language, kind, active }`. Ids are `track-<index>` into the video's `TextTrackList`, so they are only stable for the current media.
- `currentTextTrack`: the track whose mode is `showing`, or `null`.

Selection happens through the `track:text` event with a payload of `{ trackId }`, where `trackId` is `null` to turn captions off. The UI package's captions button and settings menu emit it; any other plugin can emit it through the plugin API. An explicit selection ends auto-selection for that media.

```ts
player.getState().textTracks;        // what the picker shows
player.getState().currentTextTrack;  // what is on screen
```

HLS renditions are never mirrored onto `<track>` elements. hls.js already creates a `TextTrack` per rendition and feeds it cues, so they show up in `textTracks` through the same sync as everything else.

## Lifecycle

- `media:load-request`: the plugin removes the `<track>` elements it added, stops observing the old track list and clears both state keys. Tracks the browser created itself are left alone.
- `media:loaded`: external sources are re-attached, the new `TextTrackList` is observed for `addtrack`, `removetrack` and `change`, state is synced, and the hls.js subscription is set up. If the hls.js instance is not ready yet it retries once after 500 ms.

## Events

None emitted. The plugin listens to `track:text`, `media:loaded` and `media:load-request`.

## CSS

None. The browser draws the cues; style them with the `::cue` pseudo-element if you need to.

## License

MIT
