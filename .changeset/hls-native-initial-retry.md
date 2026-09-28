---
'@scarlett-player/hls': patch
---

Native HLS (Safari, iOS) now retries the first load. A media element error before `loadedmetadata` used to fail the load at once, and core reported it as `SOURCE_LOAD_FAILED` without the `MediaError` code. The first load now spends `maxNetworkRetries` / `maxMediaRetries` with the usual backoff (`MEDIA_ERR_DECODE` on the media budget, every other code, including `MEDIA_ERR_SRC_NOT_SUPPORTED`, on the network budget). `loadTimeoutMs` remains one ceiling over the whole load. A load that fails for good, or times out, emits a structured fatal `error` (`MEDIA_NETWORK_ERROR` or `MEDIA_DECODE_ERROR`) whose `detail` adds `mediaErrorCode`, `mediaErrorMessage` and, for a timeout, `timedOut`. Set `maxNetworkRetries: 0` to keep failing on the first error.
