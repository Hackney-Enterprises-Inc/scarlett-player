---
"@scarlett-player/analytics": minor
---

Calling `trackEvent()` before `init()` now queues the event (up to 50, oldest dropped) and sends it on the first view with a `queuedForMs` field instead of throwing; `getViewId()` and `getSessionId()` now return `string | null` (null before `init()`), a typing change for callers that assumed `string`.
