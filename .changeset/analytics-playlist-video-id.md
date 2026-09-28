---
"@scarlett-player/analytics": patch
"@scarlett-player/playlist": patch
"@scarlett-player/embed": patch
---

Analytics: playlist views report the track's `videoId`, never the playlist's internal track `id`. A playlist track without a `videoId` reports the plugin's configured `videoId`, so an embed `data-playlist` no longer reports positional ids (`item-0`, `item-1`) and a track without an `id` no longer reports a generated `track-<time>-<random>` that no backend can map. Every playlist track that loads still gets its own view, and re-loading the current track (a token refresh) keeps it. A playlist announcing its first track before anything has played takes over the first view instead of ending it empty. `PlaylistTrack` gains an optional `videoId`, and each `data-playlist` item can carry one; the first item's applies from the embed's first view. Calling `setVideo()` for another video and then going back to a playlist track starts that track's view again.
