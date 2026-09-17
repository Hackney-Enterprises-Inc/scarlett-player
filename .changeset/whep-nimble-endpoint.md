---
'@scarlett-player/whep': patch
---

Claim Nimble Streamer WHEP endpoints. Nimble serves WHEP at
`/<app>/<stream>/whep.stream`, and `canPlay` only matched a standalone `whep`
path segment, so the core reported `PROVIDER_NOT_FOUND` for a Nimble URL.
A trailing `whep.stream` segment is now claimed alongside `/whep/` and `/whep`.
