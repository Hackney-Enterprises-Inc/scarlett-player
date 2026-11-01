---
"@scarlett-player/core": patch
"@scarlett-player/hls": patch
---

`sanitizeUrl` now also redacts token-looking path segments (long hex, or `<expiry>_<nonce>_<sig>`) as `:redacted`, so path-signed CDN URLs no longer leak into logs and error details.
