---
"@scarlett-player/embed": patch
"@scarlett-player/share": patch
---

Avoid using window.location.href as embedBaseUrl in iframe.html to prevent leaking signed or credentialed playback URLs in shared embed snippets.
