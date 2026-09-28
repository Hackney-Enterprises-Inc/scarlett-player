# Wire-fixture capture

`scripts/capture-wire-fixtures.mjs` records the HTTP requests the real
analytics and clips transports send from headless Chromium, checks them
against the wire contract, and writes them as the test fixtures of the Laravel
package (`hei/laravel-scarlett-player`). The output belongs to that package,
never to this repo. Design and rationale:
`.docs/plans/wire-fixtures-and-embed-attributes.md`, Part A (SCAR-TOOL-5).

```bash
node scripts/capture-wire-fixtures.mjs --smoke          # temp dir, print manifest (what CI runs)
node scripts/capture-wire-fixtures.mjs                  # ../packages/laravel-scarlett-player/tests/Fixtures/wire/<version>/
node scripts/capture-wire-fixtures.mjs --out=<dir> --force
WIRE_DEBUG=1 node scripts/capture-wire-fixtures.mjs --smoke   # also list every request received
```

Needs Playwright's Chromium, ffmpeg (the HLS fixture) and openssl (the beacon
origin's certificate). It starts its own servers; no `:8899` server is needed.
Capture after the release you want to pin: `<version>` is read from
`packages/plugins/analytics/package.json`.

## What it produces

One JSON per request, `<event>.<transport>[.<variant>].json`, each
`{ fixture, request, response? }`, plus `_session.sequence.json` (every beacon
of the full session in arrival order) and `manifest.json` (versions, files,
expected-but-absent fixtures with a reason, assertion results). Six
scenarios, each in a fresh browser context: full session ending on `ended`,
unload (`sendBeacon`), `destroy()`, fatal playlist 404, a clip whose first
POST gets a 500 and whose retry gets a 202, and a live stream abandoned by
navigation (`viewStart.fetch.live.json`, `heartbeat.fetch.live.json`,
`viewEnd.sendBeacon.live-unload.json`). `rebufferStart`/`rebufferEnd` are
best effort; everything else is required.

The live scenario plays `/__wire/live.m3u8`, a rolling playlist the page
server builds over the same 2 s segments (six-segment window, no `ENDLIST`,
standard latency, so `lowLatency` is `false`). The page never configures
`isLive`; analytics classifies from player state. `viewStart` leaves before
any manifest is parsed and carries `isLive: null` (not yet known) on every
scenario; later beacons carry the classification, `false` on VOD and `true`
on live. Each scenario's `isLiveByEvent` in the manifest records the value per
event.

The page plays a one-variant master playlist the runner serves over the
shared fixture's `vod.m3u8` (`BANDWIDTH=264000,RESOLUTION=320x180`): the
fixture is a media playlist, so hls.js would build its level with no bitrate
or size and the `qualityChange` fixture would carry zeros. The page's HLS
plugin keeps a 4 s forward buffer so parking segments in the page server
produces a real stall. `trackEvent('wireCustom')` goes over the wire as
`custom:wireCustom`, written as `custom-wireCustom.fetch.json`.

## What it asserts before writing

`playerVersion`/`playerName` on every beacon; `X-API-Key` and the host header
on every fetch beacon and only `?api_key=` on the unload beacon; the preflight
names `x-api-key`; the unload `viewEnd` is the documented field subset of the
ended one; `videoStart.startupTime` is above zero on VOD; `isLive` is `null`
on every `viewStart`, `false` on the VOD `videoStart` and ended `viewEnd`, and
`true` on the live `videoStart`; a fatal error sends `error` (with `errorCode`) and then a `viewEnd`
with `exitType: 'error'`; the live heartbeat and live unload `viewEnd` carry
`isLive: true` and all five latency summary keys (`liveLatencySamples`,
`liveLatencyMean`, `liveLatencyP95`, `liveLatencyMax`, `lowLatency`, which must
be `false` on the standard-latency playlist) and no VOD beacon carries any; custom dimensions at the top level; clip create and retry share
`clientRequestId` and body (`capturedAt` is minted per attempt) and carry the
CSRF header; heartbeats never go backwards; every bus `quality:change` produced
a matching `qualityChange` beacon; nothing left `127.0.0.1`. Any failure
exits non-zero and writes nothing.

## Traps a future edit could reintroduce

- **`--ignore-certificate-errors` on the browser launch is required.** With
  only the context's `ignoreHTTPSErrors`, the unload `sendBeacon` to the
  self-signed origin is dropped entirely, preflight included (measured
  2026-09-27, Playwright 1.62.1).
- **The beacon origin must be HTTPS.** The plugin attaches the API key, in
  either position, only to an https `beaconUrl`.
- **No `page.route` / `context.route`.** Any route turns on interception and
  Playwright then answers CORS preflights itself, so the recorder never sees
  an `OPTIONS` and the unload beacon never arrives. The external-origin guard
  is `--host-resolver-rules` and the buffer stall is held in the page server.
