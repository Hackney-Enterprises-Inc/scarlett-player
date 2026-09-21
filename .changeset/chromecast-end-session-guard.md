---
"@scarlett-player/chromecast": patch
---

`endSession()` no longer throws when the cast session has already gone. A viewer who pressed Stop casting after the transport dropped got an uncaught error from the Cast SDK's synchronous throw (TSP-WEB-2E7); the call is now guarded the way `destroy()` already was, logged at debug, and the session-ended handler restores state as before.
