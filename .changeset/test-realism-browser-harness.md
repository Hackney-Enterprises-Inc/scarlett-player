---
'@scarlett-player/hls': minor
'@scarlett-player/analytics': minor
'@scarlett-player/core': minor
---

Testing: the browser harness runs on bundled Chromium against local fixtures
and runs in CI, and an HLS integration suite loads the real hls.js.

- `scripts/verify-browser.mjs` launches Playwright's bundled Chromium instead
  of requiring a system Google Chrome, which is what kept it out of CI. Every
  scenario now plays the local HLS fixture, and each page hard-blocks
  non-local origins, so a run cannot depend on the demo origin being up - the
  503 that produced the URL-recovery fix above would otherwise have taken the
  harness down with it. Scenario 7 also waits for the control bar to settle
  before measuring, rather than racing the rebuild that follows a late control
  registration.
- CI installs Chromium, generates the fixture and runs the harness after the
  unit tests. `scripts/hls-fixture.mjs` now reports a missing ffmpeg instead of
  surfacing a raw spawn error.
- New `packages/plugins/hls/tests/integration.test.ts` imports hls.js itself
  and asserts what the mocks cannot: that the event names and error-detail
  strings the plugin switches on still exist, that `parseHlsError` recovers the
  URL from a fragment error built the way hls.js builds it, and that the
  `MANIFEST_PARSED` and `LEVEL_LOADED` payloads carry the fields `event-map.ts`
  reads - checked against manifests hls.js actually parsed.
- Two tests that encoded current behaviour were rewritten: analytics'
  `startupTime` assertion no longer passes for `null`, and `seekToLive()` now
  covers the fallback chain a real provider reaches instead of only the mocked
  `getLiveInfo()` branch.
