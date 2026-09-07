# Phase 1 Release 1.9 — Deepwork Progress

## Goal
Implement all 7 PRs from the phase-1-release-1.9 plan: core teardown resilience, HLS reconnect/stall watchdog, DVR sliding window, analytics overhaul, chromecast command routing, watermark hardening, and release pipeline gating.

## Phase Order & Dependencies

| Phase | PRs | Specialist | Gate | Rationale |
|-------|-----|-----------|------|-----------|
| 1 | PR-1.1 (Core Lifecycle) | @fixer | @oracle | Foundation: async destroy affects all plugins |
| 2 | PR-1.2 + PR-1.3 (HLS Reconnect + DVR) | @fixer | @oracle | Largest single-package change, depends on Phase 1 async destroy |
| 3 | PR-1.4 (Analytics) + PR-1.5 (Chromecast) | @fixer (parallel lanes) | @oracle | Independent plugins, no cross-dependencies |
| 4 | PR-1.6 (Watermark) + PR-1.7 (CI) | @fixer (parallel lanes) | @oracle | Independent, smallest scope |

## Accepted Research

### PR-1.1 — Core Lifecycle
- `scarlett-player.ts:1105` — `destroy()` is sync, calls `pluginManager.destroyAll()` without await
- `plugin-manager.ts:152-168` — `destroyPlugin()` has try/catch but `runCleanups()` is outside `finally`
- `plugin-manager.ts:98-99` — `initPlugin()` throws on re-entrant `initializing` state
- `useScarlettPlayer.ts:61-94` — `init()` has no unmount guard
- `ScarlettPlayer.vue:118-157` — `onMounted` init has no unmount guard

### PR-1.2 — HLS Reconnect
- `create-hls-plugin.ts:90` — `reconnectWindowMs: 300000` (5 min cap)
- `create-hls-plugin.ts:996-998` — `maybeScheduleReconnect` gates on `hasPlayedContent`
- `create-hls-plugin.ts:1077-1082` — `video.play()` called unconditionally after reconnect
- `create-hls-plugin.ts:1201-1211` — online listener only clears timer, doesn't reset exhausted flag
- No stall watchdog exists

### PR-1.3 — DVR Sliding Window
- `event-map.ts:169-194` — `hlsLevelLoaded` uses `video.seekable.start(0)` which is 0 under MSE
- `event-map.ts:176-179` — seekableRange computed from element, not from `details.fragmentStart`

### PR-1.4 — Analytics
- `analytics/src/index.ts:216-237` — sendBeacon used as primary, can't attach headers
- `analytics/src/index.ts:354-390` — `onPlaying()` only called by `playback:play`, rebuffer never clears
- `analytics/src/index.ts:569` — subscribes only to `media:error`, not core `error`
- `analytics/src/index.ts:592-595` — heartbeat timer not cleared in sendViewEnd
- `native/src/index.ts:258-264` — `playing` handler emits `playback:play` (duplicate)

### PR-1.5 — Chromecast
- `chromecast/src/index.ts:219-237` — disconnect resumes at cast time (outside DVR window for live)
- `chromecast/src/index.ts:349` — `endSession(true)` forces TV stop on destroy
- `chromecast/src/index.ts:288-293` — media ended synthesized from isMediaLoaded transitions
- No command interception for play/pause/seek

### PR-1.6 — Watermark
- `watermark/src/index.ts:226-233` — hides on pause
- `watermark/src/index.ts:291-297` — `setPadding` sets `currentBottomPadding = currentPadding` (collapses 40px default)
- `watermark/src/index.ts:90-104` — `updateContent` with imageUrl takes precedence over text
- No DOM hardening

### PR-1.7 — Release Pipeline
- `release.yml:52-53` — no lint/typecheck/test before publish
- `release.yml:345` — CDN gated on `published == 'true'` but not on npm success
- `check-package-artifacts.mjs:142` — `entry.path.startsWith('.')` misses paths without `./` prefix
- `upload-cdn.sh:156-158` — verifies HTTP 200 only, not content

## Current Phase: 1 — Core Lifecycle & Teardown Resilience
