---
'@scarlett-player/hls': patch
---

Reject the pending load() promise when HLS error recovery is exhausted (network/media retries spent, error storm, or unrecoverable fatal error) instead of leaving it pending forever. Previously a stream that failed to load (e.g. manifest 403/404 on a live event) left `player.init()` hanging, so consumers never got control back to tear down or retry cleanly.
