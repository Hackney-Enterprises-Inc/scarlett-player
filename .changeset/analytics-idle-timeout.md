---
'@scarlett-player/analytics': minor
---

A view that has not been playing for `idleTimeout` (default 30 minutes, `0` disables) now ends as `abandoned` and stops its heartbeat, and playback that comes back later (a play, a stall that recovers by itself, a successful reconnect) starts a new view instead of going unreported.

A late resume signal after a fatal error, completion or page unload no longer starts an unintended view; only a new play request does.
