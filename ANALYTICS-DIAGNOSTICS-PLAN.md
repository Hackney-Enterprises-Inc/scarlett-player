# Scarlett Player — Analytics & Diagnostics Plan

**Created**: 2026-03-06
**Status**: Approved, ready for implementation
**Related package**: `@scarlett-player/analytics`

## Vision

Evolve the existing analytics plugin into a Mux Data-style open-source player analytics SDK. Privacy-first, transparent, developer-friendly. Any developer using Scarlett Player can opt into analytics, configure what's collected, and receive the data at their own endpoint.

### Design Principles

- **Privacy-first**: Explicit about what's collected, opt-in for invasive features, no PII by default
- **Open-source transparency**: All collection logic is in the public repo
- **Mux Data model**: Developer passes a playback ID / viewer ID, gets a viewer score, sees per-viewer playback health
- **Developer-controlled**: Data goes to the developer's endpoint, not ours (unless they're a TSP customer)
- **Decoupled storage**: TSP analytics stored in ClickHouse, not the main MySQL database

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Store all events? | Yes, optimize later | Start broad, tune based on actual volume |
| Console capture | Opt-in (`collectConsole: true`) | Privacy concern, too invasive for default |
| HLS coupling | Plugin interface convention | `getDiagnostics()` on Plugin interface, any plugin contributes |
| Unify issue endpoints | No | TSP-specific, analytics is a general package |
| Analytics storage | ClickHouse | Time-series optimized, separate from main MySQL |
| Privacy UX | Privacy policy documentation | No cookie banner needed since no PII collected |

---

## Goal 1: Analytics Plugin API Redesign

### 1.1 — Rework AnalyticsConfig to match the Mux model

- `playbackId` (required) — unique ID for this playback session, passed by the developer
- `viewerId` (optional) — anonymous or authenticated viewer identifier
- `beaconUrl` (required) — where data goes (developer's endpoint)
- `collectConsole` (default: `false`) — opt-in console.error/warn capture
- `collectionPolicy` object — explicit manifest of what's being collected:

```ts
collectionPolicy: {
  playerState: true,      // play/pause/buffer/error states
  qualityMetrics: true,   // bitrate, resolution, QoE score
  engagement: true,       // watch time, seek, pause counts
  errorDetails: true,     // error codes, messages
  environment: true,      // browser, OS, device type, screen size
  networkInfo: true,       // connection type, bandwidth estimate
  consoleCapture: false,  // console.error/warn ring buffer (opt-in)
  hlsDiagnostics: true,   // HLS-specific: levels, fragments, manifest
}
```

- Each section toggleable by the developer
- Collection policy included in the `viewStart` beacon
- Collection policy is **immutable for the session** — freeze config after init to prevent mid-session changes that the backend can't track

### 1.2 — Add getViewerScore() public method

- Rename/alias from `getQoEScore()` to match Mux "viewer experience score" language
- Keep `getQoEScore()` as backward-compat alias
- Headline metric: "How is this viewer's experience right now?" (0-100)

### 1.3 — Add getDiagnostics() public method

Returns a point-in-time JSON-serializable snapshot:

```ts
interface DiagnosticsSnapshot {
  timestamp: number;
  playbackId: string;
  viewerId?: string;
  viewerScore: number;
  playerState: { ... };
  session: { ... };          // metrics from ViewSession
  errors: PlayerError[];     // from ErrorHandler history
  environment: { ... };      // browser, OS, device, screen, connection
  plugins: Record<string, any>;  // contributed by each plugin via convention
  console?: string[];        // if consoleCapture is on
}
```

The `plugins` section populated via the convention in Goal 2.

### 1.4 — Add DiagnosticsSnapshot and updated types to types.ts

### 1.5 — Tests for new API surface

- `getViewerScore()` returns 0-100
- `getDiagnostics()` returns complete snapshot
- Collection policy respects toggle flags
- `collectConsole: true` captures errors, `false` doesn't
- Console ring buffer caps at configurable size (default 20)

---

## Goal 2: Plugin Diagnostics Convention

### 2.1 — Add optional getDiagnostics() to the Plugin interface in core

```ts
interface Plugin {
  // ...existing
  getDiagnostics?(): Record<string, any>;
}
```

When analytics `getDiagnostics()` is called, it iterates **ready** plugins only (via `PluginManager.getReadyPlugins()`) and calls `getDiagnostics()` on each that implements it. This avoids calling into plugins that haven't finished initializing (analytics has no dependency on provider plugins and shouldn't). Results merged into `snapshot.plugins[pluginId]`.

### 2.2 — Implement getDiagnostics() on the HLS plugin

Returns: current level index, available levels, bandwidth estimate, fragment load errors (count + last error), manifest URL, latency mode, live edge status. All from the hls.js instance already held by the plugin.

### 2.3 — Implement getDiagnostics() on the native plugin

Returns: video element readyState, networkState, buffered ranges, videoWidth/Height, currentSrc.

### 2.4 — Tests for plugin diagnostics convention

- Analytics collects from all **ready** plugins that implement it
- Gracefully handles plugins without getDiagnostics()
- Plugins in non-ready states are silently skipped (not errored)

---

## Goal 3: TSP Backend — Beacon Receiver + ClickHouse Storage

### 3.1 — Set up ClickHouse for analytics storage

- Separate from main MySQL database
- Laravel app makes API requests and handles storage behind the scenes
- Scarlett Player only knows about the beacon URL

### 3.2 — Create POST /api/analytics/beacon endpoint in tsp-web

- Accepts JSON from navigator.sendBeacon()
- `sendBeacon` has a ~64KB browser limit and silently returns `false` when exceeded. The SDK must detect this and fall back to `fetch({ method: 'POST', keepalive: true })`. Truncate largest fields (errors, console buffer) first if payload is still too large.
- Validates: requires playbackId, event, beaconToken
- Returns 204 immediately
- Dispatches ProcessAnalyticsBeacon job to queue
- Rate limited per IP
- **Authentication**: Requires a signed `beaconToken` (HMAC) issued by the server when the player page loads. Token binds to the site + playback session. Validated on the backend before dispatching the job. This prevents third parties from poisoning analytics data and viewer scores.

### 3.3 — Create ProcessAnalyticsBeacon job

- Writes to ClickHouse
- Handles batching if needed for high-volume live events

### 3.4 — Create GET /api/analytics/viewer-score/{playbackId} endpoint

- Returns latest viewer score for a playback session
- Useful for producer dashboard showing per-viewer health during live events

---

## Goal 4: TSP Issue Reports Enhanced

### 4.1 — Update VideoPlayerIssueReporting.vue

- Accept a playerInstance prop (or use provide/inject)
- On "Report Issue", call `player.plugins.get('analytics')?.getDiagnostics()`
- Send diagnostics JSON alongside issue and details
- Show note: "We'll include technical data about your playback session to help us fix the issue" with expandable "What data?" section

### 4.2 — Update VideoController::reportIssue() and ShowController::reportIssue()

- Accept optional diagnostics JSON field (validated, max ~50KB)
- Store in player_diagnostics_reports table (MySQL — low volume, user-initiated)
- Include QoE score, error codes, browser, connection type in Zammad ticket body

### 4.3 — Migration for player_diagnostics_reports table

- id, site_id, user_id (nullable), reportable_type, reportable_id (polymorphic), issue_type, issue_details, diagnostics (JSON), created_at
- Use `$table->timestamp('created_at')->nullable()` — reports are write-once, no `updated_at` needed. Set `const UPDATED_AT = null` on the model.
- `playback_id` and `viewer_score` are already inside the `diagnostics` JSON — no need for redundant top-level columns

---

## Out of Scope

- Admin dashboard / real-time monitoring UI
- Alerting and threshold notifications
- Revenue/conversion analytics aggregation
- Mobile app (React Native) diagnostics
- Replacing Bugsnag
- Public analytics API for third-party users (future SaaS)
- Documentation site for analytics SDK
- Cookie consent banner (sufficient to document in privacy policy)

---

## Implementation Order

1. Goal 2 (plugin convention) — core change, unblocks everything
2. Goal 1 (analytics API redesign) — depends on 2.1
3. Goal 4.3 (migration) — no dependencies, can parallel
4. Goal 3 (backend) — can parallel with 1
5. Goal 4.1-4.2 (issue report enhancement) — depends on 1.3
