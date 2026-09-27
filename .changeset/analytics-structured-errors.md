---
"@scarlett-player/analytics": patch
---

Record structured player errors. The `error` event carries a `PlayerError`, and providers emit it as a plain `{ code, message, fatal }` object (the HLS provider's fatal path, reconnect exhaustion and probe failure), but analytics only accepted an `Error` instance, so every HLS fatal error was dropped: no `error` beacon, `errorCount` stayed 0, and the view never ended with `exitType: 'error'`. A payload with a string `code` or `message` is now recorded, with `errorType` set to the code, and a fatal one ends the view as an error. The `error` beacon from the `error` event also carries `errorCode` (the player error code) whichever shape it arrived in. (SCAR-ANALYTICS-5)
