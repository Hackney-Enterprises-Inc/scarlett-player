---
"@scarlett-player/hls": patch
---

On iOS/Safari, the first failed reload of an outage (auto-reconnect, error recovery or the AirPlay switch reload) is still reported as a `source` media error tagged `reconnecting` with its attempt number, while repeat failures are only logged instead of raising a "Media source not supported" warning per attempt, and a suspended page is no longer mistaken for a playback stall.
