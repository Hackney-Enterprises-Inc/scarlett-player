---
"@scarlett-player/analytics": minor
---

Every beacon the built-in transport sends now carries `sentAt`, the time it left the browser, so an ingest can correct for a viewer's clock being wrong. A batch carries it once on its envelope, and `customBeacon` payloads have none.
