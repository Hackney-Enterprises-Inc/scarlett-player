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
  errorSampleRate?: number;       // Default: 1.0 (100%)
  disableInDev?: boolean;         // Default: false
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
| `viewStart` | A view began: player initialized, another video (see [Views and track changes](#views-and-track-changes)), or a replay after `ended` | viewId, sessionId, environment |
| `playRequest` | Play requested: core `play()`, a control or autoplay | timestamp |
| `videoStart` | First frame rendered, once per view | startupTime: play request (core `play()`, control or autoplay) to first frame, in ms |
| `heartbeat` | Periodic update (10s default) | watchTime, playTime, QoE score |
| `pause` | Playback paused | currentTime, pauseCount |
| `seeking` | User seeked | seekTo, seekCount |
| `rebufferStart` | Buffering started | rebufferCount |
| `rebufferEnd` | Buffering ended | duration, totalRebufferTime |
| `qualityChange` | Quality level changed (manual selection or an automatic ABR switch) | bitrate, width, height, auto |
| `error` | Error occurred: a media element error, or a player `error` event (including a provider's fatal error such as an HLS manifest 404) | errorType, errorMessage, errorCode, fatal. `errorType` is the `Error` name when there is one, otherwise the player error code; `errorCode` is the player error code (for example `MEDIA_NETWORK_ERROR`), absent when there is none |
| `viewEnd` | View ended: the video ended, a fatal error, another video, the page unloading, or the plugin being destroyed | all metrics, exitType, QoE score |

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
  timestamp: number;          // Unix timestamp

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
  os: string;                 // 'Windows', 'macOS', etc.
  deviceType: string;         // 'desktop', 'mobile', 'tablet'
  screenSize: string;         // '1920x1080'
  playerSize: string;         // '1280x720'
  connectionType: string;     // '4g', 'wifi', etc.

  // Custom dimensions
  ...customDimensions,

  // Event-specific data
  ...eventData
}
```

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

The plugin calculates a QoE score (0-100) based on:

- **Success Score (30%)** - Did playback succeed without errors?
- **Startup Score (25%)** - How fast did video start?
  - <1s: 100
  - <2s: 85
  - <4s: 70
  - <8s: 50
  - 8s+: 30

- **Smoothness Score (30%)** - How much rebuffering?
  - <0.1% rebuffer ratio: 100
  - <1%: 85
  - <2%: 70
  - <5%: 50
  - 5%+: 30

- **Quality Score (15%)** - What bitrate was achieved?
  - >4 Mbps (4K): 100
  - >2 Mbps (1080p): 90
  - >1 Mbps (720p): 75
  - >500 Kbps (480p): 60
  - Lower: 40

Access the score:

```typescript
const analytics = player.getPlugin<IAnalyticsPlugin>('analytics');
const qoeScore = analytics.getQoEScore(); // 0-100
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

- **Async Beacons**: Uses `navigator.sendBeacon()` for non-blocking sends
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
