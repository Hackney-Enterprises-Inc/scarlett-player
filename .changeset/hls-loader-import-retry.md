---
'@scarlett-player/hls': patch
---

The hls.js library load is retried once after a short delay on a failed download; this is best-effort, as some browsers cache a failed import and will not refetch.
