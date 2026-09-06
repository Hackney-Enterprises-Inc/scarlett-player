---
"@scarlett-player/vue": patch
"@scarlett-player/audio-ui": patch
"@scarlett-player/chromecast": patch
---

Use core payload types for Vue error, loaded, loadedmetadata, and qualitylevels
events, and normalize non-Error initialization failures to Error instances.
Correct the audio UI quick start to register a native playback provider and the
Chromecast quick start to end casting through the plugin's endSession method.
