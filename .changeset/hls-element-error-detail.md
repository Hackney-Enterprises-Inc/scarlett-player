---
'@scarlett-player/hls': patch
---

Video element errors now include the element's `networkState` and `readyState` in `detail`, and name codes 4 ("Media source not supported") and 2 ("Media network error") when the browser gives no message.
