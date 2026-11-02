---
"@scarlett-player/analytics": minor
"@scarlett-player/core": patch
---

The error beacon carries `stalled: true` when playback ended in the HLS stall ceiling, so an ingest can tell a stall from a reconnect window that ran out.
