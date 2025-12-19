/**
 * Basic Analytics Plugin Usage Example
 *
 * This example demonstrates how to integrate the Analytics plugin
 * with Scarlett Player for a live PPV event.
 */

import { createPlayer } from '@scarlett-player/core';
import { hlsPlugin } from '@scarlett-player/hls';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { uiPlugin } from '@scarlett-player/ui';

// Example: TSP Live Event with Analytics
async function initializePlayer() {
  // Event data (from your API)
  const event = {
    id: 'event-123',
    title: 'Championship Fight Night',
    promoter: 'UFC',
    streamUrl: 'https://cdn.example.com/live/event-123/playlist.m3u8',
    isPpv: true,
    price: 49.99,
  };

  // User data (from your auth system)
  const user = {
    id: 'user-456',
    subscription: null, // or 'premium', 'monthly', etc.
  };

  // Create player with analytics
  const player = await createPlayer({
    container: '#player',
    src: event.streamUrl,
    plugins: [
      // HLS provider with low-latency mode
      hlsPlugin({
        lowLatencyMode: true,
      }),

      // Analytics plugin - tracks QoE and engagement
      createAnalyticsPlugin({
        // Required config
        beaconUrl: 'https://api.tsp.com/analytics/beacon',
        videoId: event.id,

        // Video metadata
        videoTitle: event.title,
        isLive: true,

        // Viewer information
        viewerId: user.id,
        viewerPlan: user.subscription ? 'subscriber' : 'ppv',

        // Custom dimensions for your business
        customDimensions: {
          eventType: 'fight',
          promoter: event.promoter,
          isPpv: event.isPpv,
          price: event.price,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },

        // Behavior settings
        heartbeatInterval: 15000, // 15 seconds for live
        errorSampleRate: 1.0, // Track all errors
        disableInDev: false, // Track even in development
      }),

      // UI plugin
      uiPlugin(),
    ],
  });

  // Get analytics plugin instance for custom tracking
  const analytics = player.plugins.get('analytics');

  // Track PPV purchase
  document.getElementById('purchase-btn')?.addEventListener('click', async () => {
    try {
      const result = await purchaseEvent(event.id, event.price);

      if (result.success) {
        analytics?.trackEvent('ppv_purchase', {
          price: event.price,
          currency: 'USD',
          paymentMethod: result.paymentMethod,
          promotionCode: result.promoCode || null,
        });
      }
    } catch (error) {
      analytics?.trackEvent('ppv_purchase_failed', {
        error: error.message,
      });
    }
  });

  // Track social sharing
  document.querySelectorAll('.share-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const platform = e.target.dataset.platform;
      analytics?.trackEvent('share_clicked', {
        platform,
        eventId: event.id,
      });
    });
  });

  // Monitor QoE score
  setInterval(() => {
    const qoeScore = analytics?.getQoEScore();
    console.log('Current QoE Score:', qoeScore);

    // Alert ops team if QoE drops below threshold
    if (qoeScore && qoeScore < 50) {
      alertOpsTeam({
        eventId: event.id,
        qoeScore,
        metrics: analytics.getMetrics(),
      });
    }
  }, 30000); // Check every 30 seconds

  return player;
}

// Example: VOD Content with Analytics
async function initializeVODPlayer() {
  const player = await createPlayer({
    container: '#player',
    src: 'https://cdn.example.com/vod/fight-replay.m3u8',
    plugins: [
      hlsPlugin(),
      createAnalyticsPlugin({
        beaconUrl: 'https://api.tsp.com/analytics/beacon',
        videoId: 'vod-789',
        videoTitle: 'Fight Replay - Round 3',
        videoDuration: 3600, // 1 hour
        isLive: false,
        viewerId: 'user-456',
        viewerPlan: 'subscriber',
        customDimensions: {
          contentType: 'replay',
          category: 'fights',
        },
      }),
      uiPlugin(),
    ],
  });

  return player;
}

// Example: Anonymous Viewer (no user ID)
async function initializeAnonymousPlayer() {
  const player = await createPlayer({
    container: '#player',
    src: 'https://cdn.example.com/preview.m3u8',
    plugins: [
      hlsPlugin(),
      createAnalyticsPlugin({
        beaconUrl: 'https://api.tsp.com/analytics/beacon',
        videoId: 'preview-123',
        videoTitle: 'Event Preview',
        isLive: false,
        // viewerId omitted - will auto-generate anonymous ID
        viewerPlan: 'free',
      }),
      uiPlugin(),
    ],
  });

  return player;
}

// Example: GDPR Compliant (conditional analytics)
async function initializePlayerWithConsent() {
  const hasAnalyticsConsent = checkUserConsent();

  const player = await createPlayer({
    container: '#player',
    src: 'https://cdn.example.com/stream.m3u8',
    plugins: [
      hlsPlugin(),
      // Only load analytics if user gave consent
      ...(hasAnalyticsConsent
        ? [
            createAnalyticsPlugin({
              beaconUrl: 'https://api.tsp.com/analytics/beacon',
              videoId: 'event-123',
            }),
          ]
        : []),
      uiPlugin(),
    ],
  });

  return player;
}

// Helper functions (implement these based on your backend)
async function purchaseEvent(eventId: string, price: number) {
  // Call your payment API
  return {
    success: true,
    paymentMethod: 'stripe',
    promoCode: null,
  };
}

function alertOpsTeam(data: any) {
  // Send alert to your monitoring system
  console.error('QoE Alert:', data);
}

function checkUserConsent(): boolean {
  // Check GDPR consent
  return localStorage.getItem('analytics_consent') === 'true';
}

// Initialize player
initializePlayer().catch(console.error);
