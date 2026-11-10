---
"@scarlett-player/embed": minor
---

Five new CDN addons ship beside the existing chapters and clips addons:
analytics, playlist, media-session, watermark and share. Every bundled copy
stays in the 1.28 builds. The deprecated ones (analytics, playlist, media
session, watermark and share in Full; watermark and share in Video) log a
one-time deprecation notice when a page relies on them (media session on a titled video player logs none), and a loaded addon
replaces the bundled creator. The Audio build's playlist and media session are
not deprecated and their addons are refused there. The `use()` API
accepts their names (analytics, playlist, mediaSession, watermark, share),
the builds keep everything they carry today, and the embed README's Addons
section now lists seven addons with a Builds column, a migration table, and an
analytics load-order warning. Removal of the bundled copies is a later 2.0
release (not scheduled).
