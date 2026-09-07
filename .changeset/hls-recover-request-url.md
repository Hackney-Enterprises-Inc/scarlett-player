---
'@scarlett-player/hls': minor
---

HLS: recover the request URL from fragment and key load errors so error
diagnostics and logs carry the failing segment and its HTTP status.

`parseHlsError` read only `data.url`, which hls.js sets on playlist errors and
never sets on a fragment or key load failure - it carries the URL on
`data.frag.url` and `data.response.url` instead. So the diagnostic block on
fatal errors, which exists because the 2026-08-29 origin outage could not be
diagnosed without a status and a URL, has never carried a URL for exactly the
error class an origin outage produces. The URL is now read from whichever field
the originating error type populated, and both log sites report the HTTP status
that was already being parsed and thrown away.
