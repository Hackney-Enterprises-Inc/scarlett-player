---
"@scarlett-player/hls": patch
---

hls.js mux errors now get the same retries and live auto-reconnect as media errors instead of failing at once. The media retry budget now refills only once a fragment is buffered, not merely downloaded, and a terminal error cancels any recovery still waiting to run.