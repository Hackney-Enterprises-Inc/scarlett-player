# @scarlett-player/analytics

Analytics plugin for Scarlett Player that collects Quality of Experience (QoE) metrics and engagement data for live events and VOD content.

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
  apiKey?: string;                // Sent as an X-API-Key header on HTTPS fetch fallbacks
  customBeacon?: (url: string, payload: BeaconPayload) => void; // Replace the transport (see Testing)
}
```

## Events Tracked

### Automatic Events

The plugin automatically tracks these events:

| Event | Description | Data |
|-------|-------------|------|
| `viewStart` | Player initialized | viewId, sessionId, environment |
| `playRequest` | User clicked play | timestamp |
| `videoStart` | First frame rendered | startupTime |
| `heartbeat` | Periodic update (10s default) | watchTime, playTime, QoE score |
| `pause` | Playback paused | currentTime, pauseCount |
| `seeking` | User seeked | seekTo, seekCount |
| `rebufferStart` | Buffering started | rebufferCount |
| `rebufferEnd` | Buffering ended | duration, totalRebufferTime |
| `qualityChange` | Quality level changed | bitrate, width, height |
| `error` | Error occurred | errorType, errorMessage, fatal |
| `viewEnd` | View session ended | all metrics, exitType, QoE score |

### Exit Types

- `completed` - Video played to the end
- `abandoned` - User left before completion
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
  isLive?: boolean;

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

### Example Express.js Handler

```javascript
app.post('/analytics/beacon', async (req, res) => {
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
