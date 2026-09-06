# @scarlett-player/media-session

Media Session plugin for [Scarlett Player](https://scarlettplayer.com). Wires the player into the browser's Media Session API so playback can be controlled from the lock screen, the notification shade, hardware media keys and the system media UI, with track title, artist, album, artwork and a live seek bar. Where the API is missing the plugin logs a notice and does nothing, so it is safe to include everywhere.

## Installation

```bash
pnpm add @scarlett-player/media-session @scarlett-player/core
```

`@scarlett-player/core` is a peer dependency.

## Usage

```ts
import { createPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '@scarlett-player/native';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';

const player = await createPlayer({
  container: document.getElementById('player'),
  src: 'https://example.com/track.mp3',
  plugins: [
    createNativePlugin(),
    createMediaSessionPlugin({
      seekOffset: 15,
      defaultArtwork: [{ src: '/default-artwork.png', sizes: '512x512' }],
    }),
  ],
});
```

With no configuration the plugin registers play, pause, stop, seek and track navigation handlers, mirrors the player's playing, paused and ended states, and updates the system seek bar about once a second while playing.

Metadata comes from three places, in order of arrival: the player's `title` and `poster` state (the poster becomes the artwork), a `playlist:change` event from `@scarlett-player/playlist` (title, artist, album and artwork are read from the track), and calls to `setMetadata()`. When no artwork is available `defaultArtwork` is used.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `enablePlayPause` | `boolean` | `true` | Register the `play`, `pause` and `stop` action handlers |
| `enableSeek` | `boolean` | `true` | Register the `seekbackward`, `seekforward` and `seekto` action handlers |
| `enableTrackNavigation` | `boolean` | `true` | Register `previoustrack` and `nexttrack`. Both call the playlist plugin when it is present; without one, previous seeks to 0 and next does nothing |
| `seekOffset` | `number` | `10` | Seconds to skip for `seekbackward` and `seekforward` when the OS does not supply its own offset |
| `defaultArtwork` | `MediaSessionArtwork[]` | `undefined` | Artwork used when the current metadata has none. Each entry is `{ src, sizes?, type? }`; `sizes` defaults to `'512x512'` and `type` to `'image/png'` |
| `updatePositionState` | `boolean` | `true` | Push duration, position and playback rate to the system seek bar on `playback:timeupdate` (throttled to once per second) and on `media:loadedmetadata` |

## Plugin API

The plugin is registered under the id `media-session`:

```ts
import type { IMediaSessionPlugin } from '@scarlett-player/media-session';

const session = player.getPlugin<IMediaSessionPlugin>('media-session');

session?.isSupported();
session?.setMetadata({
  title: 'Track 1',
  artist: 'Artist',
  album: 'Album',
  artwork: [{ src: '/art1.jpg', sizes: '512x512', type: 'image/jpeg' }],
});
session?.setPlaybackState('playing');
session?.setPositionState({ duration: 240, position: 12, playbackRate: 1 });
session?.setActionHandler('nexttrack', () => goToNextEpisode());
session?.setActionHandler('nexttrack', null); // remove it again
```

| Method | Description |
|---|---|
| `isSupported()` | `true` when `navigator.mediaSession` exists |
| `setMetadata(metadata)` | Merge `title`, `artist`, `album` and `artwork` into the current metadata and push it to the OS |
| `setPlaybackState(state)` | Set `'none'`, `'paused'` or `'playing'` directly |
| `setPositionState({ duration, position, playbackRate })` | Update the system seek bar directly |
| `setActionHandler(action, handler)` | Replace one of the built-in handlers, or pass `null` to clear it |

## Events

The plugin emits no events of its own. In response to OS actions it emits the core events `playback:play`, `playback:pause` and `playback:seeking`, and it listens to `playback:play`, `playback:pause`, `playback:ended`, `playback:timeupdate`, `media:loadedmetadata` and `playlist:change`.

On destroy every action handler is cleared, the metadata is set to `null` and the playback state returns to `'none'`.

## License

MIT
