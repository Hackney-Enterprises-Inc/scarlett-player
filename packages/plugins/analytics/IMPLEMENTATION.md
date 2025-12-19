# Analytics Plugin Implementation Summary

## Overview

Successfully implemented a comprehensive Analytics plugin for Scarlett Player that collects Quality of Experience (QoE) metrics and engagement data for The Stream Platform's live events and VOD content.

## What Was Built

### Core Files

1. **src/types.ts** (236 lines)
   - Complete TypeScript type definitions
   - Event types, session tracking, beacon payloads
   - Public API interfaces

2. **src/helpers.ts** (364 lines)
   - Environment detection (browser, OS, device type)
   - ID generation and storage (session, viewer)
   - QoE score calculation
   - Utility functions for formatting and detection

3. **src/index.ts** (603 lines)
   - Main plugin implementation
   - Event tracking (play, pause, seek, rebuffer, quality, errors)
   - Heartbeat reporting
   - Beacon transmission (navigator.sendBeacon + fetch fallback)
   - Session lifecycle management
   - Page visibility and unload handling

4. **tests/analytics.test.ts** (479 lines)
   - 24 comprehensive tests covering:
     - Plugin initialization
     - Playback events
     - Rebuffering
     - Quality tracking
     - Error handling
     - Heartbeat system
     - QoE scoring
     - Custom events
     - Cleanup and lifecycle
   - All tests passing ✓

### Configuration Files

- **package.json** - Dependencies and build scripts
- **tsconfig.json** - TypeScript configuration
- **vitest.config.ts** - Test configuration
- **README.md** - Comprehensive documentation (400+ lines)
- **examples/basic-usage.ts** - Usage examples for TSP

## Features Implemented

### Quality of Experience (QoE) Metrics

- **Startup Time Tracking**
  - Measures time from play request to first frame
  - Categorized scoring: <1s (100), <2s (85), <4s (70), etc.

- **Rebuffer Detection**
  - Tracks rebuffer count and total duration
  - Calculates rebuffer ratio
  - Sends start/end events with timing

- **Quality Level Tracking**
  - Monitors bitrate changes
  - Tracks quality switches (manual and auto)
  - Records max and average bitrate

- **Error Tracking**
  - Captures all errors (fatal and non-fatal)
  - Error sampling support
  - Detailed error metadata

### Engagement Analytics

- **Watch Time vs Play Time**
  - Watch time: Total time player was open
  - Play time: Actual playback time (excludes buffering/pauses)

- **User Behavior**
  - Pause count and duration
  - Seek count and positions
  - Exit type detection (completed, abandoned, error, background)

- **Completion Rate**
  - Percentage of video watched
  - Sent with viewEnd event

### Automatic Tracking

- **Periodic Heartbeats**
  - Default: 10 seconds (configurable)
  - Sends current metrics without disrupting playback
  - Includes real-time QoE score

- **Session Management**
  - ViewID: Unique per playback attempt
  - SessionID: Persists across views (sessionStorage)
  - ViewerID: Persists across sessions (localStorage)

- **Page Lifecycle**
  - Visibility change detection (tab backgrounded)
  - Before unload handling (page close)
  - Graceful session termination

### Custom Event Tracking

- **Business Events**
  - PPV purchases
  - User signups
  - Social sharing
  - Any custom event with arbitrary data

- **Custom Dimensions**
  - Global dimensions (sent with all events)
  - Event-specific data
  - Full flexibility for business metrics

## QoE Score Calculation

Weighted average of 4 factors (0-100 scale):

1. **Success Score (30%)** - Did playback complete without fatal errors?
2. **Startup Score (25%)** - How fast did video start?
3. **Smoothness Score (30%)** - How much rebuffering occurred?
4. **Quality Score (15%)** - What bitrate was achieved?

## Events Tracked

| Event | Trigger | Data Included |
|-------|---------|---------------|
| `viewStart` | Player init | Environment, identifiers |
| `playRequest` | User clicks play | Timestamp |
| `videoStart` | First frame | Startup time |
| `heartbeat` | Periodic (10s) | All metrics, QoE score |
| `pause` | User pauses | Current time, pause count |
| `seeking` | User seeks | Seek position, seek count |
| `rebufferStart` | Buffering starts | Rebuffer count |
| `rebufferEnd` | Buffering ends | Duration |
| `qualityChange` | Quality switches | Bitrate, dimensions |
| `error` | Error occurs | Type, message, fatal flag |
| `viewEnd` | Session ends | Final metrics, exit type |
| `custom:*` | Custom events | User-defined data |

## Beacon Payload

Every beacon includes:
- Event metadata (type, timestamp)
- View context (viewId, sessionId, viewerId)
- Video context (videoId, title, isLive)
- Player context (version, name)
- Environment (browser, OS, device, connection)
- Custom dimensions
- Event-specific data

## Backend Integration

### Requirements
- Accepts POST requests with JSON
- Supports `navigator.sendBeacon()` API
- Quick response (don't block on processing)
- Optional API key authentication

### Example Endpoint Structure
```
POST /analytics/beacon
Content-Type: application/json
X-API-Key: optional-key

{
  "event": "heartbeat",
  "timestamp": 1234567890,
  "viewId": "...",
  ...
}
```

## Privacy & Compliance

- **Anonymous Tracking**: Auto-generates IDs if no viewerId provided
- **No PII**: Doesn't collect personal information
- **GDPR Ready**: Can conditionally load based on consent
- **Development Mode**: Can disable in dev environments
- **Error Sampling**: Reduce data volume if needed

## Performance Optimizations

- **Non-Blocking Beacons**: Uses `navigator.sendBeacon()`
- **Efficient Timers**: Single heartbeat interval
- **Lazy Calculation**: QoE score computed on demand
- **Memory Efficient**: Limited history tracking
- **Async Processing**: Event handlers don't block playback

## Testing Coverage

- ✓ 24 tests, all passing
- ✓ Initialization and validation
- ✓ All playback events
- ✓ Rebuffering detection
- ✓ Quality tracking
- ✓ Error handling (fatal and non-fatal)
- ✓ Heartbeat system
- ✓ QoE score calculation
- ✓ Custom events
- ✓ Cleanup and lifecycle
- ✓ Public API methods
- ✓ Environment detection

## TSP-Specific Features

### Live Event Monitoring
- Low-latency mode support
- Real-time QoE alerts
- Concurrent viewer tracking (via backend)
- Fight-specific metadata (promoter, event type)

### PPV Analytics
- Purchase tracking
- Viewer plan detection (free, PPV, subscriber)
- Revenue attribution
- Conversion funnel tracking

### Custom Dimensions for TSP
```typescript
{
  eventType: 'fight',
  promoter: 'UFC',
  isPpv: true,
  price: 49.99,
  timezone: 'America/New_York'
}
```

## Files Created

```
packages/plugins/analytics/
├── src/
│   ├── index.ts           (603 lines) - Main plugin
│   ├── types.ts           (236 lines) - Type definitions
│   └── helpers.ts         (364 lines) - Utilities
├── tests/
│   └── analytics.test.ts  (479 lines) - Test suite
├── examples/
│   └── basic-usage.ts     (195 lines) - Usage examples
├── dist/                  - Built output (ESM + CJS + types)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md              (400+ lines) - Documentation
```

## Build Output

- **ESM**: `dist/index.js` (17 KB)
- **CJS**: `dist/index.cjs` (18 KB)
- **Types**: `dist/index.d.ts` (7.8 KB)

## Next Steps for Integration

1. **Backend Setup**
   - Create `/analytics/beacon` endpoint
   - Database schema for events
   - Aggregation queries for dashboards

2. **Dashboard Implementation**
   - Real-time viewer metrics
   - QoE score monitoring
   - Error tracking and alerting
   - Engagement analytics

3. **TSP Integration**
   - Add to event player template
   - Configure for VOD content
   - Set up custom dimensions
   - Implement purchase tracking

4. **Monitoring & Alerts**
   - QoE threshold alerts
   - Error rate monitoring
   - Concurrent viewer tracking
   - Revenue analytics

## Usage Example

```typescript
const player = await createPlayer({
  container: '#player',
  src: event.streamUrl,
  plugins: [
    hlsPlugin(),
    createAnalyticsPlugin({
      beaconUrl: 'https://api.tsp.com/analytics/beacon',
      videoId: event.id,
      videoTitle: event.title,
      isLive: true,
      viewerId: user?.id,
      viewerPlan: user?.subscription || 'ppv',
      customDimensions: {
        eventType: 'fight',
        promoter: event.promoter,
      },
    }),
    uiPlugin(),
  ],
});

// Track custom events
const analytics = player.plugins.get('analytics');
analytics.trackEvent('ppv_purchase', { price: 49.99 });
```

## Success Metrics

✓ Production-ready code
✓ Comprehensive test coverage
✓ Full TypeScript type safety
✓ Zero runtime dependencies
✓ Follows Scarlett Player patterns
✓ Detailed documentation
✓ Usage examples for TSP
✓ GDPR compliant
✓ Performance optimized
✓ All tests passing
