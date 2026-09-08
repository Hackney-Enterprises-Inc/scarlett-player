---
'@scarlett-player/core': minor
'@scarlett-player/embed': minor
'@scarlett-player/vue': minor
'@scarlett-player/hls': minor
'@scarlett-player/ui': minor
'@scarlett-player/native': minor
'@scarlett-player/airplay': minor
'@scarlett-player/chromecast': minor
'@scarlett-player/analytics': minor
'@scarlett-player/playlist': minor
'@scarlett-player/media-session': minor
'@scarlett-player/audio-ui': minor
'@scarlett-player/captions': minor
'@scarlett-player/watermark': minor
'@scarlett-player/share': minor
'@scarlett-player/chapters': minor
'@scarlett-player/gestures': minor
'@scarlett-player/clips': minor
---

Low-latency HLS (LL-HLS). `lowLatencyMode` stays off by default, so nothing
changes for an existing consumer; turning it on now produces a complete
low-latency configuration instead of a single flag, and the live state keys that
had been declared since the first release are finally written.

**`@scarlett-player/hls`**

- `lowLatencyMode: true` now also enables latency catch-up. hls.js ships
  `maxLiveSyncPlaybackRate: 1`, which disables catch-up entirely, so LL-HLS
  previously parsed and loaded parts and then let latency settle wherever the
  buffer landed and never pulled it back. It defaults to `1.1` under low latency
  only, and is overridable.
- New config: `liveSyncDuration`, `liveSyncDurationCount`,
  `liveMaxLatencyDuration`, `liveMaxLatencyDurationCount`,
  `maxLiveSyncPlaybackRate`, `liveDurationInfinity`. Only keys a host actually
  sets are passed to hls.js — it merges config by assignment, so forwarding
  `undefined` would have overridden its defaults and broken standard live. The
  seconds-based and count-based options are mutually exclusive (hls.js throws on
  a config carrying both), so a mixed config forwards one group and logs which
  half was dropped rather than failing the load.
- New `live-metrics.ts` is the single writer for `liveLatency`, `liveEdge`,
  `seekableRange` and `lowLatencyMode`. Previously `hlsLevelLoaded` computed an
  edge flag from the playlist and the `timeupdate` handler then recomputed it
  four times a second as `latency < 10` from `video.seekable` — the wrong source
  under MSE, and a threshold that is unconditionally true at a low-latency
  target, so **"GO LIVE" could never appear** no matter how far a viewer
  drifted. The threshold is now latency-relative:
  `latency <= targetLatency + max(1.5, partTarget ?? targetduration / 2)`.
- `liveLatency` is now real latency from hls.js (measured against
  `EXT-X-PROGRAM-DATE-TIME` drift where the manifest carries it) rather than the
  distance to the end of the loaded playlist. On native Safari HLS it remains an
  approximation, and is documented as one.
- `lowLatencyMode` state and `live:lowlatency` report whether low latency is
  *effective* — the manifest carries `EXT-X-PART` or advertises
  `CAN-BLOCK-RELOAD=YES`, and the host asked for it — not what was requested.
- `getLiveInfo()` gains `lowLatency`, and its native branch stops parking a
  viewer a hard-coded 3 seconds behind the edge on a 2-second-target stream.
- `live:latency`, `live:edgechange`, `live:seekablerange` and `live:lowlatency`
  are emitted for the first time, each only on change.
- A playlist that stops being live (`EXT-X-ENDLIST`, or a VOD source after a
  live one) clears the latency readout, LL badge and DVR window instead of
  leaving the previous stream's values on screen.

**`@scarlett-player/core`**

- New `live:seektolive` event. `ScarlettPlayer` subscribes and calls
  `seekToLive()`, so the live-sync-position ladder lives in one place.

**`@scarlett-player/ui`**

- `LiveIndicator`'s "GO LIVE" emits `live:seektolive` instead of seeking to
  `seekableRange.end` itself. Under low latency that end is beyond the last
  loaded part, and seeking there stalls and rebuffers.

**`@scarlett-player/analytics`**

- Live sessions report `liveLatencyMean`, `liveLatencyP95`, `liveLatencyMax`,
  `liveLatencySamples` and `lowLatency` on heartbeat and viewEnd beacons.
  Accumulated into a fixed histogram rather than stored, so memory does not grow
  with watch time and the percentile covers the whole session. The unload
  (`pagehide`/`beforeunload`) beacon carries them too, which is where an
  abandoned live view is recorded. VOD beacons are unchanged — the keys are
  absent.
