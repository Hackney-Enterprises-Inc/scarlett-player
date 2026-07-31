---
'@scarlett-player/core': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
---

Make failure handling viewer-friendly: no silent hangs, self-healing reconnects, accurate error messages, and a Try Again that actually recovers.

**No more permanent spinners.** Manifest-phase network errors (404/403, expired token, origin down) previously died silently after one recovery attempt because `startLoad()` cannot retry a manifest that never parsed, leaving `player.init()` pending forever. Manifest errors now retry with `loadSource()`, and a load watchdog (`loadTimeoutMs`, default 30s) guarantees every load attempt terminates with a real error.

**Self-healing playback.** After a fatal network/media error mid-playback, the HLS provider now auto-reconnects with capped exponential backoff (configurable via `autoReconnect`, `reconnectBaseDelayMs`, `reconnectMaxDelayMs`, `reconnectWindowMs`), reconnects immediately when the browser comes back online, restores the viewer's VOD position from the moment of failure, and rejoins live streams at the live edge. The overlay shows "Connection lost. Reconnecting..." while working and hides itself on recovery. Retry budgets also reset once media flows again, so transient blips spread across a long live event no longer permanently consume them.

**Accurate error messages.** Fatal HLS errors now carry structured codes (`MEDIA_NETWORK_ERROR`, `MEDIA_DECODE_ERROR`, `PLAYBACK_FAILED`) and the overlay maps codes before falling back to prose matching, so a network outage shows the connection message instead of "Something went wrong." The `error` state key is now populated from every error event (and cleared on successful load); it was previously declared but never written. New events: `error:reconnecting` and `error:recovered`.

**Try Again fixed.** The overlay's retry now emits `error:retry`, which the core handles by reloading through the provider path and restoring position (live streams rejoin the live edge). It previously wrote the raw manifest URL onto the MSE-backed video element and reset playback to 0.

Native HLS (Safari) fatal video errors are now surfaced as structured player errors instead of failing silently, and the native provider gained the same load watchdog.
