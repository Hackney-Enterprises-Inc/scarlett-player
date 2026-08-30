---
'@scarlett-player/core': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': patch
---

Core lifecycle and error telemetry hardening.

**Core**

- `ScarlettPlayer.destroy()` now bumps the load generation, so a destroy during an in-flight `load()` self-cancels the continuation instead of reading a torn-down state manager. Destroying a player mid-load (navigation, SPA unmount, a consumer rebuilding the player) no longer crashes.
- The `error:retry` and `media:load-request` handlers re-check `destroyed` after their awaits. Both are unawaited async closures, so a throw there previously escaped as an unhandled rejection.
- `StateManager` reads after `destroy()` now throw `[StateManager] Manager is destroyed (reading '<key>')` instead of the misleading `Unknown state key` message, which reported a typo-class error for a lifecycle-class problem. A genuine typo still fails with the unknown-key message.
- `PlayerError` gains an optional `detail` block (new exported `PlayerErrorDetail` type) for provider diagnostics.

**HLS**

- The native (Safari/iOS) path now has the same retry budgets as the hls.js path. A media element error is retried up to `maxMediaRetries` (media) or `maxNetworkRetries` (network) by reloading the source and restoring position, instead of the first error being declared fatal. Both budgets reset once playback is flowing again. Exhausting a budget emits the same "(max retries exceeded)" fatal error as the hls.js branch.
- Fatal errors carry a `detail` block: `type`, `retriesExhausted`, `attempts`, plus `httpStatus` and a sanitized `url` for network failures. The new exported `sanitizeUrl()` helper strips the query string and fragment, so signed-URL tokens never reach a consumer's telemetry.
- `error:reconnecting` gains `elapsedMs` and `windowMs` so a UI can show progress toward giving up (reconnect is capped by a time window, not an attempt count). `error:recovered` now carries `{ attempt, elapsedMs }` instead of `undefined`. Both changes are additive; `attempt` and `delayMs` keep their names and meanings.
- Reconnect-window exhaustion is no longer silent. It used to log a warning and return, emitting nothing, so a consumer that showed "Reconnecting..." had no signal to ever take it down and an outage longer than the window left a permanent spinner. Exhaustion now emits a new `error:reconnect-exhausted` event (`{ attempts, elapsedMs, windowMs }`) followed by a final fatal `error` carrying `detail.reconnectExhausted`. A reconnect cycle is now guaranteed to end in exactly one of `error:recovered` or `error:reconnect-exhausted`; the ordering guarantee is documented in the event map TSDoc.

**UI**

- The error overlay drops its reconnecting presentation and restores Try Again when a reconnect cycle ends in exhaustion, via the terminal fatal error the HLS plugin now emits.
