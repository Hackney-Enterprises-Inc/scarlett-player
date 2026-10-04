# @scarlett-player/analytics

Analytics plugin for Scarlett Player that collects Quality of Experience (QoE) metrics and engagement data for live events and VOD content.

> **Docs:** [scarlettplayer.com/documentation](https://scarlettplayer.com/documentation/) · **For AI coding agents:** [llms.txt](https://scarlettplayer.com/llms.txt) (index) and [llms-full.txt](https://scarlettplayer.com/llms-full.txt) (every guide as one Markdown file)

## Features

- **Quality of Experience (QoE) Metrics**
  - Startup time tracking
  - Rebuffering detection and measurement
  - Quality level changes
  - Error tracking

- **Engagement Analytics**
  - Watch time vs. play time
  - Pause/seek behavior
  - Completion rates
  - Exit type detection

- **Automatic Tracking**
  - Periodic heartbeat reporting
  - Page visibility handling
  - Persistent viewer identification
  - Session management

- **Custom Events**
  - Track business events (purchases, signups, etc.)
  - Custom dimensions support
  - Flexible data collection

## Installation

```bash
npm install @scarlett-player/analytics
```

Or with pnpm:

```bash
pnpm add @scarlett-player/analytics
```

## Basic Usage

```typescript
import { createPlayer } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { uiPlugin } from '@scarlett-player/ui';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/stream.m3u8',
  plugins: [
    createHLSPlugin(),
    createAnalyticsPlugin({
      beaconUrl: 'https://api.example.com/analytics/beacon',
      videoId: 'event-123',
      videoTitle: 'Live Fight Night',
      isLive: true,
      viewerId: user?.id,
      viewerPlan: 'ppv',
    }),
    uiPlugin(),
  ],
});
```

## Configuration

### Required Options

```typescript
{
  beaconUrl: string;    // Your analytics API endpoint
  videoId: string;      // Unique video identifier
}
```

### Optional Options

```typescript
{
  // Video metadata
  videoTitle?: string;
  videoSeries?: string;
  videoDuration?: number;
  isLive?: boolean;

  // Viewer information
  viewerId?: string;              // Auto-generated if not provided
  viewerPlan?: string;            // 'free', 'ppv', 'subscriber', 'premium', or your own

  // Custom dimensions (string, number or boolean values; merged into every beacon without redaction)
  customDimensions?: Record<string, string | number | boolean>;

  // Behavior
  heartbeatInterval?: number;     // Default: 10000ms (10 seconds)
  rebufferGraceMs?: number;       // Default: 250ms; 0 opens synchronously; negative/non-finite uses 250
  errorSampleRate?: number;       // Default: 1.0 (100%)
  disableInDev?: boolean;         // Default: false
  respectDoNotTrack?: boolean;    // Default: false; suppress beacons for DNT=1 or GPC
  anonymous?: boolean;            // Default: false; per-view IDs without storage
  beforeSend?: (payload: BeaconPayload) => BeaconPayload | null; // Alter/drop each beacon
  playerInitTime?: number;        // Host epoch ms; used for viewStart.playerInitMs
  batch?: boolean | { intervalMs?: number; maxEvents?: number }; // Off by default; 10s/20 events
  apiKey?: string;                // HTTPS endpoints only: X-API-Key header, or ?api_key= on unload (see API key transport)
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
                                  // Extra headers for the fetch transport; a function is resolved per beacon (CSRF, Bearer)
  customBeacon?: (url: string, payload: BeaconPayload) => void; // Replace the transport (see Testing)
}
```

## Events Tracked

### Automatic Events

The plugin automatically tracks these events:

| Event | Description | Data |
|-------|-------------|------|
| `viewStart` | A view began: player initialized, another video (see [Views and track changes](#views-and-track-changes)), or a replay after `ended` | viewId, sessionId, environment, pageUrl (origin + pathname only), optional referrerOrigin, pageLoadToInitMs, optional playerInitMs |
| `playRequest` | Play requested: core `play()`, a control or autoplay | timestamp |
| `videoStart` | First frame rendered, once per view | startupTime: play request (core `play()`, control or autoplay) to first frame, in ms |
| `heartbeat` | Periodic update (10s default) | watchTime, playTime (only the time actually spent playing, not stalled or paused), warningCount, qoeScore, qoeVersion: 2 |
| `pause` | Playback paused by the viewer. Not sent, and not counted in pauseCount, for the pause the element fires when the media ends (the one `ended` follows). A pause in the last half-second of VOD is sent a moment later, once `ended` has not followed it | currentTime, pauseCount |
| `seeking` | A player-requested or element-driven seek started (see [Seek tracking](#seek-tracking)) | seekTo: the seek target in seconds (not the position the seek left), seekCount, seekSource: `'player'` or `'element'` |
| `rebufferStart` | Buffering persisted through `rebufferGraceMs` (250 ms default); duration is measured from the first eligible `waiting`, not this beacon's timestamp | rebufferCount |
| `rebufferEnd` | Confirmed buffering ended, whether by resuming or the stall ending in a pause or the view ending (another video, `ended`, a fatal error, `destroy()`) | duration, totalRebufferTime (ms, including the grace) |
| `qualityChange` | Quality level changed (manual selection or an automatic ABR switch) | bitrate, width, height, auto |
| `error` | Error occurred: a media element error or player `error` event | errorType, errorMessage (URL query/fragment stripped), errorCode, fatal, errorCategory, errorSeverity; validated httpStatus, mediaErrorCode, attempts, retriesExhausted, reconnectExhausted, timedOut when provided. Classification uses code/detail, not message text; no raw detail or signed URL is sent |
| `viewEnd` | View ended: the video ended, a fatal error, another video, the page unloading, or the plugin being destroyed | Final metrics, exitType, warningCount, optional fatalErrorCategory, qoeScore, qoeVersion: 2 (except unload's 1.19.3 field subset). watchTime and playTime include the time since the last heartbeat. completionRate is 100 for a `completed` view; otherwise the position over the duration, or the last known pair when a `load()` has already zeroed them |

### Rebuffer grace and time accounting

`rebufferGraceMs` defaults to **250 ms**. Waiting before the first frame or
while seeking is not a rebuffer. After playback has started, an eligible
`waiting` opens a pending stall; repeated waiting does not restart its timer.
Resuming, pausing, seeking (either path below), ending or switching the view,
unloading, or destroying the plugin during the grace cancels it without
rebuffer beacons or an increase in `rebufferCount`.

- `rebufferGraceMs: 0` restores immediate counting: `rebufferStart` is sent
  synchronously on eligible waiting, without a timer.
- Negative or non-finite values (`NaN`, `Infinity`, `-Infinity`) fall back to
  250 ms; they do not disable tracking.
- A confirmed stall sends `rebufferStart` after the grace. Its `timestamp` is
  the send time (about 250 ms after waiting by default), **not backdated**.
  `rebufferEnd.duration`, `totalRebufferTime` and the `rebufferDuration` metric
  include the full stall from the original waiting, including the grace. Do
  not derive stall duration by subtracting the two beacon timestamps.
- `watchTime` includes elapsed time in the view, including pending waiting.
  `playTime` accrues only while playing, with neither a pending nor a confirmed
  stall. Even an 11 ms blip that is dropped from rebuffer metrics counts as
  watch time but not play time; a heartbeat during the grace follows the same
  rule. A 400 ms stall confirmed at 250 ms therefore excludes all 400 ms from
  play time, not just the final 150 ms.

This reduces short Safari post-seek rebuffer rows and counts without hiding
the full duration of a real stall. This is a JavaScript analytics option;
there is no embed data attribute for it.

### Seek tracking

While the view is open, both seek paths send `seeking` and increment `seekCount`:

- **`seekSource: 'player'`**: a `playback:seeking { time }` bus request. This
  includes core `player.seek()`, gesture seeks, media-session seek actions,
  audio UI and playlist seek requests, and the video UI's progress-bar
  presses/releases, keyboard arrows and Home/End on the focused progress bar,
  the skip-backward/forward buttons, and control-bar replay to zero. `seekTo` uses the requested target.
- **`seekSource: 'element'`**: the provider reports `seeking` changing from
  false to true without a recent pending bus echo. This covers browser/native
  controls, OS seeks that reach the media element directly, and direct
  `currentTime` writes (including the video UI's big-overlay replay, which
  does not emit a seek request). HLS (including native Safari) and native providers
  publish the element's new `currentTime` before setting `seeking: true`, so
  `seekTo` is the target rather than the previous timeupdate position.

`seekSource` identifies the path, not a particular input device: an OS action
handled by media-session is `'player'`, not `'element'`. Analytics consumes
pending bus echoes within 1000 ms (inclusive) to avoid double-counting; an echo
after that window is treated as element-driven. Before a new bus request is
recorded, expired pending echoes are discarded, so a coalesced or missing echo
cannot be revived by the new request. The video progress bar emits on press
and release (two bus requests for a drag), not each throttled mid-drag write.
Mid-drag element transitions not absorbed as echoes can still count as element
seeks. Providers do not re-emit `playback:seeking` from the element, which
would feed back into their seek command handler. WHEP is not seekable.

After `viewEnd`, both bus requests and element transitions are ignored for
seek accounting until playback starts a new view. In particular, a replay's
pre-play seek does not change the finalized view's `seekCount` or send a
post-end `seeking` beacon. Seeking alone does not create a view; the replay's
play request still starts exactly one new view with fresh counts and sequence.

### Exit Types

- `completed` - Video played to the end
- `abandoned` - User left before completion, or moved to another video
- `error` - Fatal error stopped playback
- `background` - Tab/window was backgrounded

## Custom Event Tracking

Track custom business events. Event data is merged into the beacon without redaction;
only send necessary data after applying the [privacy guidance](#privacy-considerations) below.

```typescript
import type { IAnalyticsPlugin } from '@scarlett-player/analytics';

const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');

// Track PPV purchase
analytics.trackEvent('ppv_purchase', {
  price: 49.99,
  currency: 'USD',
  paymentMethod: 'stripe',
});

// Track user signup
analytics.trackEvent('user_signup', {
  plan: 'premium',
  referral: 'social',
});

// Track engagement
analytics.trackEvent('share_clicked', {
  platform: 'twitter',
});
```

## Beacon Payload Structure

Every beacon sent includes:

```typescript
{
  // Event info
  event: string;              // Event type
  timestamp: number;          // Unix timestamp in milliseconds at send time

  // View context
  viewId: string;             // Unique per playback attempt
  sessionId: string;          // Persists across views in session
  viewerId: string;           // Persists across sessions

  // Video context
  videoId: string;
  videoTitle?: string;
  isLive: boolean | null;     // null until known (see below)

  // Player context
  playerVersion: string;
  playerName: string;

  // Environment
  browser: string;            // 'Chrome', 'Safari', etc.
  os: string;                 // 'Windows', 'macOS', 'iOS' (iPhone, iPad), 'Android', etc.
  deviceType: string;         // 'desktop', 'mobile', 'tablet'
  screenSize: string;         // '1920x1080'
  playerSize: string;         // '1280x720'
  connectionType: string;     // '4g', 'wifi', etc.

  // Custom dimensions
  ...customDimensions,

  // Event-specific data
  ...eventData,

  beaconSeq: number;          // Reserved per-view sequence; cannot be overwritten by the spreads above
}
```

### Beacon ordering

Every beacon carries `beaconSeq`, starting at **1 on `viewStart`** and
increasing by one per dispatched beacon in that view. It restarts for a new
view (including `setVideo()` changing the video, a playlist track change, or
replay after `ended`). Heartbeats, custom events and the unload `viewEnd` all
use the same counter, including when using `customBeacon`.

The counter increments only after `disableInDev` and error-sampling filters:
a suppressed beacon does not consume a number. Custom dimensions and event
data cannot override `beaconSeq`. A receiver can nevertheless see gaps from
transport loss or ingest filtering; an ingest that drops heartbeats from its
raw event table **will see gaps**, which alone do not prove missing seeks.

Within each `viewId`, sort by **`timestamp, beaconSeq`**, never by HTTP arrival
order or database row ID. Requests can arrive out of order, and `beaconSeq`
breaks ties when timestamps share a millisecond. `seekSource` is added by the
plugin only to `seeking` beacons, not to the common fields of other events.

### `isLive`

`isLive` is `config.isLive` when you set it. Otherwise it is the view's last
known classification, taken from the player's `live` state:

- `null` means not yet known. Every `viewStart` without `config.isLive` carries
  `null`, because it leaves before any manifest is read. Treat `null` as absent
  and merge the view's beacons true-wins.
- It becomes `true` or `false` at the source's `media:loadedmetadata`, or
  `true` as soon as the provider reports the stream live.
- Another video starts a new view, which starts unknown again. A `load()`
  that keeps the same video (a token refresh) keeps the view, and with it the
  last classification until the new source's metadata replaces it.
- `setVideo({ isLive })` sets it for that video the way `config.isLive` does
  for the first one.

Before 1.18, `isLive` was `false` rather than `null` while unknown, so a live
view's `viewStart` said `false`.

## Views and track changes

A view is one video played from start to finish or exit. It has its own
`viewId`, `viewStart`, heartbeat and `viewEnd`, and its watch time counts from
its own `viewStart`.

- **Another video** starts a new view. The current one ends with exit type
  `abandoned` (or keeps the `viewEnd` it already sent, such as a pre-roll that
  played to the end), and the new one starts with a new `viewId` and the new
  `videoId`. The heartbeat carries on for the new view.
- **The same video re-loaded** (a token refresh, a re-signed URL) is not a new
  view. The plugin only knows the video changed when told its ID, never from
  the URL.
- **Playing again after the view ended** (a replay after `ended`, a retry
  after a fatal error) starts a new view of the same video. A replay keeps
  the ended view's `isLive`, since nothing reloads the source to classify it
  again.

A playlist tells the plugin by itself. After `playlist:change`, the next
source load starts a view for that track. The view reports the track's
`videoId` when it has one, and the plugin's configured `videoId` when it does
not. The track's `id` is never reported: it is the playlist's own identity,
positional in the embed (`item-0`) and generated for a track without one.

- Every track that loads gets its own view, even two that report the same
  `videoId`. Re-loading the current track (a token refresh) keeps its view.
- The switch waits for that track's own source to load, because the event
  alone does not mean another track is playing. Removing the current track
  moves the playlist onto the next one without loading it, so the view stays
  with the track still on screen, including through a token refresh of it.
  The load matches on the track's `src` without its query string, so a signed
  URL for the track counts; a host that loads a track from another URL names
  it with `setVideo()`.
- A playlist announcing its first track before anything has played takes over
  the first view when it reports the same video, rather than ending it empty,
  and the view carries the track's title from then on. Only the first track
  does this; a later one always gets its own view. A first track reporting
  another video ends that view and starts its own.
- It works whether the playlist loads the track itself (`autoLoad`) or your
  code calls `player.load()`, and `setVideo()` overrides a track still waiting
  to load.

```typescript
createPlaylistPlugin({
  tracks: [
    { id: 'preroll', src: preroll, videoId: 'ad-42' },
    { id: 'main', src: main, videoId: 'event-123', title: 'Main Event' },
  ],
});
```

A host that calls `player.load()` itself, a pre-roll followed by the main video
for instance, names the video with `setVideo()` before loading it:

```typescript
const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');

// Pre-roll ended: the main video gets its own view
analytics.setVideo({ videoId: 'event-123', videoTitle: 'Main Event' });
await player.load(mainUrl);

// Token refresh on the same video: same videoId, same view
analytics.setVideo({ videoId: 'event-123' });
await player.load(refreshedUrl);
```

`setVideo()` before the plugin initialises only changes the video the first
view reports. Before 1.19, the view was bound to `config.videoId` for the
plugin's lifetime: after a pre-roll's `viewEnd` the main video ran with no
heartbeat and no final beacon, and a replay after `ended` was not measured.

## Quality of Experience (QoE) Score

`qoeVersion: 2` identifies the continuous scoring contract on each heartbeat
and ordinary `viewEnd` carrying `qoeScore`. The score averages the available
components: startup `100 × 0.5^(startupTime/4000)` (100 if unknown), smoothness
`min(100 / sqrt(1 + (rebufferCount/2)^2), 100 × exp(-10 × rebufferDuration/watchTime))`,
and bitrate quality `clamp(20 + 15 × log2(maxBitrate/250000), 10, 100)`.
Bitrate quality is **omitted** when unknown (native HLS, MP4, WHEP), not scored
as low quality. Non-fatal warnings subtract `min(20, 3 × warningCount)` from
the mean. A fatal playback exit scores 0; a view ended by a structured 401,
403 or 451 access error scores **null**, rather than counting an entitlement
denial as playback failure. The final result is rounded and clamped to 0–100.
`getQoEScore()` therefore returns `number | null`.

Access the score:

```typescript
const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');
const qoeScore = analytics.getQoEScore(); // 0–100, or null for a fatal access denial
```

## Metrics API

Get current session metrics:

```typescript
const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');
const metrics = analytics.getMetrics();

console.log({
  viewId: analytics.getViewId(),
  sessionId: analytics.getSessionId(),
  watchTime: metrics.watchTime,
  playTime: metrics.playTime,
  rebufferCount: metrics.rebufferCount,
  qoeScore: analytics.getQoEScore(),
});
```

## Backend Integration

### Laravel release prerequisite

For `hei/laravel-scarlett-player` integrations, install **v0.3.0 before or
together with player 1.19.3**. That ingest recognises `beaconSeq` and
`seekSource` and adds the `seq` column. In tsp-web, update the Composer package,
publish and run its new migration, then bump the npm player packages in the
same deploy. Older ingests still accept the payload, but store the new keys
as host custom dimensions in `scarlett_views.custom`, not as recognised
ordering/source fields. Recapture the Laravel wire fixtures after the player
release and repin their `player_version`.

**Batching is not supported by Laravel v0.3.0:** it rejects batch envelopes
with HTTP 422. Leave `batch` off with that version. Only enable batching for a
custom ingest that explicitly accepts both the single-event and batch shapes;
do not infer compatibility from the client version.

### Opt-in batching

`batch` defaults to **off**. The off path keeps one POST per beacon, the same
`beaconSeq`/`seekSource` order, fetch keepalive and unload fallback as 1.19.3.
With `batch: true` (or `{ intervalMs: 10000, maxEvents: 20 }`), queued events
flush on the timer, count limit, viewEnd, fatal error, hidden tab, pagehide or
destroy. The JSON body is `{ "batch": 1, "sentAt": <epoch ms>, "events": [ ... ] }`;
each envelope is at most **60,000 UTF-8 bytes**. An individual beacon too large
for an envelope is sent alone without wrapping. Event timestamps and sequence
numbers are assigned when events occur, not at flush time. Dynamic `headers()`
is called once per batch. On pagehide the queued events and unload viewEnd use
`navigator.sendBeacon()` (including the HTTPS-only `api_key` URL parameter),
falling back to keepalive fetch. `customBeacon` always receives individual
payloads, even when batching is enabled.

### Endpoint Requirements

Your beacon endpoint should:

1. Accept `POST` requests
2. Handle `application/json` content type
3. Support the `navigator.sendBeacon()` API (for reliability)
4. Return quickly (don't block analytics on slow processing)
5. Authenticate from either the `X-API-Key` header or the `api_key` query
   parameter, if you set `apiKey` (see below)

### API key transport

`apiKey` reaches your endpoint two different ways, and an endpoint that only
reads the header will reject the most important beacon you get.

| Path | Transport | Where the key is |
|------|-----------|------------------|
| Every in-session beacon (`viewStart`, `heartbeat`, `pause`, `error`, ...) | `fetch` with `keepalive` | `X-API-Key` request header |
| `viewEnd` on `pagehide` / `beforeunload` | `navigator.sendBeacon` | `api_key` query parameter |
| `viewEnd` when `sendBeacon` is missing or refuses the payload | `fetch` with `keepalive` | `X-API-Key` request header |

The unload path cannot use the header: `navigator.sendBeacon()` takes a URL and
a body and has no way to set one, and it is the only transport that survives
iOS Safari terminating the page on `pagehide`. Dropping the key there would
cost you every `viewEnd` - the beacon carrying watch time, exit type and the
final QoE score - so the key goes on the URL instead.

Two consequences worth designing for:

- **Accept both.** Read `X-API-Key`, and fall back to the `api_key` query
  parameter. Rejecting the query form loses `viewEnd` and nothing else, which
  looks like viewers who never stop watching.
- **Treat the key as logged.** Query strings land in access logs, proxy logs
  and `Referer` headers. Issue the player a key scoped to beacon ingest only -
  write-only, no read access to analytics - and rotate it on its own schedule.

### Extra headers

`headers` adds to the fetch transport - an object, or a function resolved per
beacon so a rotating CSRF or Bearer token is current when it is sent:

```typescript
createAnalyticsPlugin({
  beaconUrl: '/analytics/beacon',
  videoId: 'abc123',
  headers: () => ({ 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')!.content }),
});
```

They merge over `Content-Type` and `X-API-Key`, so either can be overridden -
in whatever case you spell it, since header names are matched the way a server
matches them. A function that rejects, or throws where it stands, costs the
headers and not the beacon: the request still goes out without them rather than
being dropped.

The unload beacon is the exception, and it is the same exception as everywhere
else here: it travels by `navigator.sendBeacon`, which carries no headers at
all. Its fetch fallback merges a static object, but never calls a function -
the handler runs during pagehide, where a promise may never settle and a beacon
that waits for a token is a beacon that never leaves. Authenticate that one
with `apiKey`, which rides the URL.

The key is attached only when `beaconUrl` resolves to HTTPS (a relative URL
counts when the page itself is HTTPS). Over plain HTTP it is sent on neither
path, header or query, so a local `http://` endpoint will see unauthenticated
beacons by design.

### Example Express.js Handler

```javascript
app.post('/analytics/beacon', async (req, res) => {
  // Either transport, or the unload beacon is turned away (see above)
  const key = req.get('X-API-Key') ?? req.query.api_key;
  if (key !== process.env.BEACON_KEY) {
    return res.status(401).send();
  }

  // Immediately respond
  res.status(204).send();

  // Process asynchronously
  const event = req.body;

  // Validate event
  if (!event.viewId || !event.videoId) {
    return;
  }

  // Store in database
  await db.analyticsEvents.insert({
    event_type: event.event,
    view_id: event.viewId,
    session_id: event.sessionId,
    viewer_id: event.viewerId,
    video_id: event.videoId,
    timestamp: new Date(event.timestamp),
    payload: event,
  });

  // Update aggregations if needed
  if (event.event === 'viewEnd') {
    await updateVideoStats(event.videoId, event);
  }
});
```

### Laravel Example

```php
Route::post('/analytics/beacon', function (Request $request) {
    // Immediately respond
    return response('', 204);
})->middleware(['throttle:1000,1']); // Rate limit

// Queue processing
Queue::push(new ProcessAnalyticsEvent($request->all()));
```

## TSP Integration Example

For The Stream Platform (TSP) live events:

```typescript
const player = await createPlayer({
  container: '#player',
  src: event.streamUrl,
  plugins: [
    createHLSPlugin({
      lowLatencyMode: true,
    }),
    createAnalyticsPlugin({
      beaconUrl: `${import.meta.env.VITE_API_URL}/analytics/beacon`,
      apiKey: import.meta.env.VITE_ANALYTICS_KEY,

      // Video context
      videoId: event.id,
      videoTitle: event.title,
      isLive: true,

      // Viewer context
      viewerId: user?.id,
      viewerPlan: user?.subscription ? 'subscriber' : 'ppv',

      // Custom dimensions for TSP
      customDimensions: {
        eventType: 'fight',
        promoter: event.promoter,
        isPpv: event.isPpv,
        price: event.price,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },

      // Behavior
      heartbeatInterval: 15000, // 15s for live
      errorSampleRate: 1.0,     // Track all errors
      disableInDev: false,       // Track even in dev
    }),
    uiPlugin(),
  ],
});

// Track PPV purchase
if (purchaseSuccessful) {
  const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');
  analytics.trackEvent('ppv_purchase', {
    price: event.price,
    currency: 'USD',
    paymentMethod: paymentData.method,
    promotionCode: paymentData.promoCode,
  });
}
```

## Privacy Considerations

The plugin does not guarantee that analytics data is free of personally identifiable information (PII).

- **Viewer Identification**: Beacon payloads contain `viewerId`. If not provided, the plugin generates an ID stored in localStorage (with sessionStorage or ephemeral fallback). A persistent ID is not a guarantee of anonymity.
- **Data Minimization and Redaction**: Callers must limit collected data to what is necessary and remove or redact personal or sensitive information before supplying `customDimensions`, custom event data, or other metadata. Custom dimensions and event data are merged into payloads without automatic PII filtering or redaction.
- **Consent and Opt-out**: Callers are responsible for obtaining any required consent before initializing analytics and for honoring opt-out or consent withdrawal. `disableInDev` only suppresses beacons in development; it is not a production consent control.
- **Environment Data**: The plugin also collects browser, OS, device, screen/player size, and connection information using browser APIs.

### Privacy controls and page context

Analytics is never installed implicitly: a host must supply `beaconUrl` and
`videoId`; there is **no default endpoint**. In normal mode the plugin uses
`sp_session_id` in sessionStorage and `sp_viewer_id` in localStorage (falling
back to sessionStorage and then ephemeral IDs when storage is unavailable).
`anonymous: true` ignores even an explicit `viewerId`, never reads or writes
storage, generates fresh viewer/session IDs per view, and adds `anonymous: true`
to its beacons. `analytics.setAnonymous(true | false)` changes identity mode at
the **next view** only (for example, on a video switch or replay), not mid-view.

`respectDoNotTrack: true` suppresses each beacon while `navigator.doNotTrack`
is `'1'` or Global Privacy Control is `true`; the default is false. This does
not replace your consent gate. `beforeSend(payload)` receives each payload
after custom dimensions and event data are merged, including unload events and
events destined for batches. Return a modified payload or `null` to drop it;
if the hook throws, the original beacon is sent and the error is debug-logged.
Returning `undefined` or another non-object value also sends the original
payload, consuming its sequence number once. Object results remain valid transformations.
It is the host's responsibility to redact sensitive custom fields there.

`viewStart.pageUrl` includes **only origin + pathname**, never URL query or
fragment. `referrerOrigin` contains only the referrer's origin when parseable;
`pageLoadToInitMs` uses `performance.now()` at plugin initialization. If the
host supplies an epoch-ms `playerInitTime`, `playerInitMs` measures elapsed time
to that initialization. Other beacons do not carry these page-context fields.

### Consent-Gated Initialization Example

```typescript
const hasAnalyticsConsent = cookieConsent.analytics;

const player = await createPlayer({
  container: '#player',
  plugins: [
    createHLSPlugin(),
    // Only load analytics if user consented
    ...(hasAnalyticsConsent ? [
      createAnalyticsPlugin({
        beaconUrl: API_URL,
        videoId: video.id,
      })
    ] : []),
    uiPlugin(),
  ],
});
```

## Testing

The plugin includes comprehensive tests. Run them:

```bash
pnpm test
```

For coverage:

```bash
pnpm test:coverage
```

### Mock Beacon for Testing

```typescript
import { createAnalyticsPlugin } from '@scarlett-player/analytics';

const beacons = [];
const mockBeacon = (url, payload) => {
  beacons.push(payload);
};

const plugin = createAnalyticsPlugin({
  beaconUrl: 'http://test',
  videoId: 'test-123',
  customBeacon: mockBeacon, // Use mock instead of real beacon
});

// ... test your code ...

expect(beacons).toHaveLength(1);
expect(beacons[0].event).toBe('viewStart');
```

## Performance

The plugin is designed for minimal performance impact:

- **Async Beacons**: Uses keepalive fetch for normal events; `navigator.sendBeacon()` on unload
- **Efficient Timers**: Single heartbeat interval per player
- **Lazy Calculation**: QoE score calculated only when needed
- **Memory Efficient**: Limits error history and bitrate tracking

## Troubleshooting

### Beacons Not Sending

1. Check browser console for CORS errors
2. Verify `beaconUrl` is correct
3. Check network tab for beacon requests
4. Ensure endpoint accepts POST with JSON
5. If only `viewEnd` is missing, check the endpoint's auth: that beacon
   carries the key as `?api_key=` rather than a header (see
   [API key transport](#api-key-transport))

### Missing Events

1. Verify plugin is loaded before playback
2. Check event subscriptions in browser DevTools
3. Enable debug logging: `disableInDev: false`

### Incorrect Metrics

1. Verify player state is correct
2. Check for multiple plugin instances
3. Ensure cleanup on destroy

## License

MIT

## Support

For issues and questions:
- GitHub: https://github.com/Hackney-Enterprises-Inc/scarlett-player/issues
- Docs: https://scarlettplayer.com

## Related Packages

- [@scarlett-player/core](../../core) - Core player
- [@scarlett-player/hls](../hls) - HLS provider
- [@scarlett-player/ui](../ui) - UI components
