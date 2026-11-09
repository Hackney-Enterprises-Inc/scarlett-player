---
"@scarlett-player/hls": patch
---

Native HLS live streams now report `live: false` once the stream ends, as hls.js does, and a reloaded native VOD is no longer marked live by a NaN duration.
