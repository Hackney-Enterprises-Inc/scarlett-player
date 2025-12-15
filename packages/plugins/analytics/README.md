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
import { hlsPlugin } from '@scarlett-player/hls';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { uiPlugin } from '@scarlett-player/ui';

const player = await createPlayer({
  container: '#player',
  src: 'https://example.com/stream.m3u8',
  plugins: [
    hlsPlugin(),
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
  viewerPlan?: string;            // 'free', 'ppv', 'subscriber', etc.

  // Custom dimensions
  customDimensions?: {
    promoter?: string;
    eventType?: string;
    [key: string]: any;
  };

  // Behavior
  heartbeatInterval?: number;     // Default: 10000ms (10 seconds)
  errorSampleRate?: number;       // Default: 1.0 (100%)
  disableInDev?: boolean;         // Default: false
  apiKey?: string;                // Optional API key for authentication
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

Track custom business events:

```typescript
const analytics = player.plugins.get('analytics');

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
const analytics = player.plugins.get('analytics');
const qoeScore = analytics.getQoEScore(); // 0-100
```

## Metrics API

Get current session metrics:

```typescript
const analytics = player.plugins.get('analytics');
const metrics = analytics.getMetrics();

console.log({
  viewId: metrics.viewId,
  watchTime: metrics.watchTime,
  playTime: metrics.playTime,
  rebufferCount: metrics.rebufferCount,
  startupTime: metrics.startupTime,
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
    hlsPlugin({
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
  const analytics = player.plugins.get('analytics');
  analytics.trackEvent('ppv_purchase', {
    price: event.price,
    currency: 'USD',
    paymentMethod: paymentData.method,
    promotionCode: paymentData.promoCode,
  });
}
```

## Privacy Considerations

The plugin respects user privacy:

- **Anonymous Tracking**: If no `viewerId` is provided, generates anonymous IDs stored in localStorage
- **No PII**: Doesn't collect personally identifiable information
- **User Agent Only**: Uses standard browser APIs for environment detection
- **Opt-out Support**: Can disable with `disableInDev` or custom logic

### GDPR Compliance Example

```typescript
const hasAnalyticsConsent = cookieConsent.analytics;

const player = await createPlayer({
  container: '#player',
  plugins: [
    hlsPlugin(),
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
npm test
```

For coverage:

```bash
npm run test:coverage
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

- [@scarlett-player/core](../core) - Core player
- [@scarlett-player/hls](../hls) - HLS provider
- [@scarlett-player/ui](../ui) - UI components
