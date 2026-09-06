# @scarlett-player/playlist

Playlist plugin for [Scarlett Player](https://scarlettplayer.com). Queue management (add, insert, remove, move, clear), shuffle with a Fisher-Yates order, repeat modes, auto-advance when a track ends, optional localStorage persistence, and control-bar buttons for previous, next and a queue panel when `@scarlett-player/ui` is installed.

## Installation

```bash
pnpm add @scarlett-player/playlist @scarlett-player/core
```

`@scarlett-player/core` is a required peer dependency. `@scarlett-player/ui` is an optional peer: the control-bar controls register only when it is present, and everything else works without it.

## Usage

This matches the audio example in the root README.

```ts
import { createPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createPlaylistPlugin, type IPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';

const player = await createPlayer({
  container: document.getElementById('audio-player'),
  plugins: [
    createNativePlugin(),
    createAudioUIPlugin({ layout: 'full' }),
    createPlaylistPlugin({
      tracks: [
        { id: '1', src: '/track1.mp3', title: 'Track 1', artist: 'Artist', artwork: '/art1.jpg' },
        { id: '2', src: '/track2.mp3', title: 'Track 2', artist: 'Artist', artwork: '/art2.jpg' },
      ],
    }),
    createMediaSessionPlugin(),
  ],
});

// Start the first track through the playlist, not through `src` or
// player.load(). The playlist owns the current index: play() sets it, writes
// the track's title and artwork into state, and emits `media:load-request`,
// which the player loads and plays. Loading a source behind the playlist's
// back leaves its index pointing at nothing, so next/previous and
// auto-advance start from the wrong place.
const playlist = player.getPlugin<IPlaylistPlugin>('playlist');
playlist?.play(0);
```

If you do pass `src` to `createPlayer()` for the first track, set `initialIndex: 0` so the playlist knows which track is already loaded.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `tracks` | `PlaylistTrack[]` | `[]` | Initial queue. Tracks without an `id` get a generated one |
| `autoAdvance` | `boolean` | `true` | Select the next track on `playback:ended` |
| `advanceDelay` | `number` | `0` | Milliseconds to wait before auto-advancing |
| `autoLoad` | `boolean` | `true` | Emit `media:load-request` with `autoplay: true` whenever the current track changes, so the player loads it. Set to `false` to load from `playlist:change` yourself |
| `shuffle` | `boolean` | `false` | Initial shuffle state |
| `repeat` | `'none' \| 'one' \| 'all'` | `'none'` | Initial repeat mode |
| `initialIndex` | `number` | `-1` | Index of the track already loaded by the player. `-1` means no track is active. Out-of-range values fall back to `-1` |
| `persist` | `boolean` | `false` | Save tracks, index, shuffle and repeat to localStorage and restore them on init |
| `persistKey` | `string` | `'scarlett-playlist'` | localStorage key used by `persist` |
| `preloadNext` | `boolean` | `true` | Accepted and stored, but no code path currently reads it |

A `PlaylistTrack` is `{ id, src, title?, artist?, album?, artwork?, duration?, type?, mimeType?, metadata? }` plus any extra properties you want to carry. `type` defaults to `'audio'` in player state when omitted.

## Plugin API

Registered under the id `playlist`; retrieve it with `player.getPlugin<IPlaylistPlugin>('playlist')`.

| Method | Description |
|---|---|
| `add(track \| track[])` | Append to the queue |
| `insert(index, track)` | Insert at a position (clamped to the queue length) |
| `remove(idOrIndex)` | Remove by id or index. Removing the current track selects the track that slides into its slot |
| `move(fromIndex, toIndex)` | Reorder |
| `clear()` | Empty the queue and reset the index to `-1` |
| `play(idOrIndex?)` | Select a track. With no argument, resumes the current track or starts the first |
| `next()` / `previous()` | Step through the queue honouring shuffle and repeat. `previous()` restarts the current track when more than 3 seconds in |
| `toggleShuffle()` / `setShuffle(enabled)` | Shuffle control. The current track stays first in the new order |
| `cycleRepeat()` / `setRepeat(mode)` | Repeat control. `cycleRepeat()` goes none, all, one |
| `getState()` | `{ tracks, currentIndex, currentTrack, shuffle, repeat, shuffleOrder, hasNext, hasPrevious }` |
| `getTracks()` / `getCurrentTrack()` / `getTrack(id)` | Read the queue |

With the player focused, the `N` and `P` keys call `next()` and `previous()`. Keystrokes inside inputs or with a modifier held are left alone.

## Events

All payload types live in `PlayerEventMap` in `@scarlett-player/core`.

| Event | Payload | When |
|---|---|---|
| `playlist:change` | `{ track, index }` | The current track changed. `track` is `null` after `clear()` |
| `playlist:add` | `{ track, index }` | `add()` (once per track) or `insert()` |
| `playlist:remove` | `{ track, index }` | `remove()` |
| `playlist:reorder` | `{ tracks }` | `move()` |
| `playlist:clear` | `void` | `clear()` |
| `playlist:shuffle` | `{ enabled }` | Shuffle changed |
| `playlist:repeat` | `{ mode }` | Repeat mode changed |
| `playlist:ended` | `void` | The last track ended with nothing to advance to |

On every track change the plugin also writes `title`, `poster` (from `artwork`) and `mediaType` into player state, clearing title and poster when the track has none so a previous track's values never leak.

## Control-bar controls

When `@scarlett-player/ui` is installed, three controls are registered. Nothing is placed until you list them in the UI layout:

```ts
uiPlugin({ controls: ['playlist-previous', 'play', 'playlist-next', 'progress', 'spacer', 'playlist', 'fullscreen'] })
```

| Control id | Renders |
|---|---|
| `playlist-previous` / `playlist-next` | Skip buttons, disabled at the ends of the queue |
| `playlist` | A button that opens the queue as a list |

All three hide themselves when the queue has one track or fewer. The classes `PlaylistSkipButton`, `PlaylistPanel` and the `PLAYLIST_ICONS` map are exported for custom layouts.

## Styling

A stylesheet is injected once per document (style element id `sp-playlist-styles`). Override these classes to restyle: `sp-playlist-skip` (with `--previous` / `--next` and the `[disabled]` state), `sp-playlist`, `sp-playlist--open`, `sp-playlist__button`, `sp-playlist__panel`, `sp-playlist__item`, `sp-playlist__item--active`, `sp-playlist__position`, `sp-playlist__text`, `sp-playlist__title` and `sp-playlist__artist`. No CSS custom properties are used.

## License

MIT
