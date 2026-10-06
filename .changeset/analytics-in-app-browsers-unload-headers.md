---
'@scarlett-player/analytics': patch
---

Analytics now names in-app browsers (Instagram, Facebook, Google App, LinkedIn, TikTok) instead of reporting them as Safari, Chrome or Unknown, recognizes Chrome on iOS, and the page-unload fetch fallback now uses plain headers returned synchronously by a `headers()` function while safely ignoring invalid or async results (async results are still not awaited on unload).
