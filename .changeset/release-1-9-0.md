---
'@scarlett-player/core': minor
'@scarlett-player/embed': minor
'@scarlett-player/vue': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
'@scarlett-player/airplay': minor
'@scarlett-player/chromecast': minor
'@scarlett-player/analytics': minor
'@scarlett-player/playlist': minor
'@scarlett-player/media-session': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/captions': minor
'@scarlett-player/watermark': minor
'@scarlett-player/share': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
---

Release v1.9.0

### Core
- Asynchronous `destroy()`: Player destruction now awaits asynchronous plugin teardowns before tearing down the event bus and state manager.
- Graceful re-entrant plugin initialization: Re-entrant `init()` calls during loading return cleanly rather than throwing a false-positive circular dependency error.
- Event contracts: Added `longOutage?: boolean` property to `error:reconnecting` event payload for extended outage notifications.

### HLS Plugin
- Playback stall watchdog: Added stall watchdog that monitors playback progress and synthesizes recoverable errors to reconnect if playback freezes while the player remains in a playing state.
- Extended outage notifications: Emits `longOutage: true` after prolonged reconnect attempts on live streams.
- Seekable range fallback: Non-negative clamping for `liveSyncPosition` fallback.

### Analytics Plugin
- Fetch transport: Migrated primary beacon transport to `fetch` with `keepalive: true` to support custom headers (`X-API-Key`).
- Page unload fallback: Maintained `navigator.sendBeacon` fallback for page unload scenarios with query-based API key forwarding.

### Chromecast & Watermark Plugins
- Improved Chromecast connection and media-loading lifecycle state synchronization.
- Enhanced watermark positioning and dynamic repositioning behavior.

### UI & Embed
- Container class management: Preserves host-owned `sp-container` classes during plugin teardown.
- Seek safety: Non-finite seek position guards preventing unexpected seeks to beginning.
- Embed release alignment: Deployment documentation aligned with `v${VERSION}` CDN release contracts.
