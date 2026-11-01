---
"@scarlett-player/hls": patch
---

An iOS element error that only reports the page releasing the video's source (code 4, no source on the element) is no longer recorded as a playback warning, so viewers leaving a page stop adding bursts of "Media source not supported" warnings to analytics.
