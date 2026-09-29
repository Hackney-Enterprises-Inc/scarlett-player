---
"@scarlett-player/analytics": patch
"@scarlett-player/hls": patch
"@scarlett-player/native": patch
"@scarlett-player/ui": patch
---

Track progress-bar, keyboard and native/OS element seeks in open views
with `seeking` beacons and `seekCount`, deduplicating recent element echoes of
player seek requests without reviving expired echoes. Ignore seek accounting
after `viewEnd`, including pre-play replay seeks, so finalized metrics stay
unchanged. HLS and native providers publish the target `currentTime`
before `seeking: true`, so analytics reports the target, not the previous
timeupdate position.

The video UI now emits `playback:seeking { time }` after its direct seeks:
progress-bar press/release, keyboard and replay. Throttled mid-drag writes stay
silent on the bus; a drag emits at its two endpoints. Providers continue to
report element seeking through state rather than re-emitting the seek command.
