---
'@scarlett-player/core': patch
'@scarlett-player/playlist': patch
'@scarlett-player/ui': patch
'@scarlett-player/airplay': patch
'@scarlett-player/chromecast': patch
'@scarlett-player/hls': patch
---

Playlist auto-advance starts the next track again when the viewer was playing. The `playback:ended` handler read the `paused` state key, which the media element had already set to true (it fires `pause` before `ended`), so every advance loaded the next track paused. The plugin now tracks whether the current source actually played, ignores the element's end-of-media pause, and forgets the answer when the source changes.

`load()` takes an optional `{ autoplay }` override, and the `media:load-request` handler passes the request's flag through it. A request carrying `autoplay: false` now stays paused on a player constructed with `autoplay: true`, and a request carrying `autoplay: true` no longer calls `play()` twice.

The big play button returns for a source that loads and sits paused after something has already played (a paused playlist advance, a second `load()`). It latched on the first `playing` for the whole session; it now resets when the source changes, and stays hidden while a `play()` is in flight.

The AirPlay plugin no longer reads or writes player state after `destroy()`. A provider switch that settled after teardown read `airplayActive` from the destroyed StateManager and surfaced as an unhandled rejection (Sentry TSP-WEB-2HT); `isActive()` and `isAvailable()` now answer false after destroy instead of throwing.

The Chromecast plugin gets the same guard: its SDK listeners and `isAvailable()` / `isConnected()` no longer read player state after `destroy()`, the two getters answer false instead of throwing, and a Cast SDK that finishes loading after the player was destroyed installs no listeners.

The UI no longer calls `Element.replaceChildren()`, which is Chrome 86 / Safari 14 and missing on LG NetCast TVs (Sentry TSP-WEB-2JN) while the documented floor is Chrome 80.

The HLS provider claims every `.m3u8` source and, in a browser with neither hls.js (MSE) nor native HLS, fails `load()` with `SOURCE_NOT_SUPPORTED`, the support probes summarised in the error message and in full under `context.probes`, instead of the undiagnosable `PROVIDER_NOT_FOUND` (Sentry TSP-WEB-2JP). The native-HLS probe also accepts `application/x-mpegURL`.
