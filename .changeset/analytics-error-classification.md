---
'@scarlett-player/analytics': minor
---

Video element errors are now classified from their MediaError code (2 network, 3 media, 4 source) instead of reporting `unknown`, and every `error` beacon carries `online`, `sourceHost` (host name only) and, when the provider supplies them, the element's `networkState` and `readyState`.
