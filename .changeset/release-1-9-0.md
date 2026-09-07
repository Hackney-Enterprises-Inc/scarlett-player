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
- Asynchronous `destroy()`: Player destruction now awaits asynchronous plugin teardowns before tearing down the event bus and state manager, and returns a cached promise for concurrent teardown calls.
- Concurrent and re-entrant plugin initialization: In-flight plugin initialization promises are cached and shared across concurrent callers, with cycle detection preserved.
- Event contracts: Added `longOutage?: boolean` property to `error:reconnecting` event payload for extended outage notifications.
- Source loading: Resets live state classification when starting each new source.

### HLS Plugin
- Playback stall watchdog: Added bounded stall watchdog using level target duration that monitors playback progress and synthesizes recoverable errors if playback stalls.
- Live stream auto-reconnect: Tracks explicit live classification to prevent unclassified or stale live states from bypassing playback checks.
- Online reconnect guard: Restricts browser online event reconnects to active or in-flight reconnect cycles.
- Extended outage notifications: Emits `longOutage: true` after prolonged reconnect attempts on live streams.
- Seekable range fallback: Non-negative clamping for `liveSyncPosition` fallback.

### Analytics Plugin
- Fetch transport: Migrated primary beacon transport to `fetch` with `keepalive: true` to support custom headers (`X-API-Key`).
- Unload transport fallback: When `navigator.sendBeacon` returns false, falls back to keepalive `fetch`.
- Query parameter preservation: Constructs unload beacon URL via URL searchParams to cleanly append `api_key`.
- Unload deduplication: Deduplicates `beforeunload` and `pagehide` invocations via `session.viewEnd`.

### Chromecast & Native Providers
- Chromecast ended detection: Reads `playerState` and `idleReason` from the active media session.
- Native provider command guard: Suppresses native playback actions while `chromecastActive` is true.
- Playback event lifecycle: Preserves single `playback:play` emission across core commands and direct element play calls without recursion.

### Watermark Plugin
- Content state handling: Setting text clears previously active image URL, and setting an image clears previously active text.

### Vue Integration
- Stable instance reference: Captures local reference during asynchronous setup and teardown in `ScarlettPlayer.vue`.

### UI & Embed
- Container class management: Preserves host-owned `sp-container` classes during plugin teardown.
- Seek safety: Non-finite seek position guards preventing unexpected seeks to beginning.
- Embed release alignment: Deployment documentation aligned with `v${VERSION}` CDN release contracts.
