/**
 * Analytics Plugin for Scarlett Player
 *
 * Collects Quality of Experience (QoE) metrics and engagement data.
 * Designed for live event monitoring and viewer analytics.
 *
 * Features:
 * - QoE metrics (startup time, rebuffering, errors)
 * - Engagement tracking (watch time, pause/seek behavior)
 * - Quality tracking (bitrate changes, quality levels)
 * - Custom event tracking
 * - Automatic heartbeat reporting
 * - Persistent viewer identification
 */

import type { IPluginAPI, Plugin, PluginType, QualityLevel } from '@scarlett-player/core';
import type {
  AnalyticsConfig,
  ViewSession,
  BitrateChange,
  ErrorEvent,
  BeaconPayload,
  IAnalyticsPlugin,
  AnalyticsEventType,
} from './types';
import {
  generateId,
  getSessionId,
  getAnonymousViewerId,
  getBrowserInfo,
  getOSInfo,
  getDeviceType,
  getScreenSize,
  getPlayerSize,
  getConnectionType,
  calculateQoEScore,
  isDevelopment,
  safeStringify,
} from './helpers';

// Re-export types
export type {
  AnalyticsConfig,
  ViewSession,
  BitrateChange,
  ErrorEvent,
  BeaconPayload,
  IAnalyticsPlugin,
  AnalyticsEventType,
} from './types';

// Plugin version
const PLUGIN_VERSION = '0.1.0';
const PLUGIN_NAME = 'scarlett-player';

/**
 * Default analytics configuration.
 */
const DEFAULT_CONFIG: Partial<AnalyticsConfig> = {
  heartbeatInterval: 10000,
  errorSampleRate: 1.0,
  disableInDev: false,
};

/**
 * Create an Analytics Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Analytics Plugin instance
 *
 * @example
 * ```ts
 * import { createAnalyticsPlugin } from '@scarlett-player/analytics';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   src: 'video.m3u8',
 *   plugins: [
 *     hlsPlugin(),
 *     createAnalyticsPlugin({
 *       beaconUrl: 'https://api.example.com/analytics',
 *       videoId: 'event-123',
 *       videoTitle: 'Live Event',
 *       isLive: true,
 *       viewerId: user?.id,
 *       viewerPlan: 'ppv',
 *     }),
 *     uiPlugin(),
 *   ],
 * });
 * ```
 */
export function createAnalyticsPlugin(
  config: AnalyticsConfig
): Plugin & IAnalyticsPlugin {
  // Validate required config
  if (!config.beaconUrl) {
    throw new Error('Analytics plugin requires beaconUrl');
  }
  if (!config.videoId) {
    throw new Error('Analytics plugin requires videoId');
  }

  // Merge with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config } as AnalyticsConfig;

  // Plugin state
  let api: IPluginAPI | null = null;
  let session: ViewSession;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastHeartbeatTime = 0;
  let isRebuffering = false;
  let rebufferStartTime: number | null = null;
  let pauseStartTime: number | null = null;
  let cleanupFns: Array<() => void> = [];

  /**
   * Initialize view session.
   */
  function initSession(): ViewSession {
    return {
      viewId: generateId(),
      sessionId: getSessionId(),
      viewerId: mergedConfig.viewerId || getAnonymousViewerId(),
      viewStart: Date.now(),
      playRequestTime: null,
      firstFrameTime: null,
      viewEnd: null,
      watchTime: 0,
      playTime: 0,
      pauseCount: 0,
      pauseDuration: 0,
      seekCount: 0,
      startupTime: null,
      rebufferCount: 0,
      rebufferDuration: 0,
      errorCount: 0,
      errors: [],
      bitrateHistory: [],
      qualityChanges: 0,
      maxBitrate: 0,
      avgBitrate: 0,
      playbackState: 'loading',
      exitType: null,
    };
  }

  /**
   * Send analytics beacon to server.
   */
  function sendBeacon(
    eventType: AnalyticsEventType | string,
    data: Record<string, unknown> = {}
  ): void {
    // Skip if disabled in dev
    if (mergedConfig.disableInDev && isDevelopment()) {
      return;
    }

    // Apply error sampling
    if (eventType === 'error' && Math.random() > (mergedConfig.errorSampleRate ?? 1.0)) {
      return;
    }

    const payload: BeaconPayload = {
      // Event info
      event: eventType,
      timestamp: Date.now(),

      // View context
      viewId: session.viewId,
      sessionId: session.sessionId,
      viewerId: session.viewerId,

      // Video context
      videoId: mergedConfig.videoId,
      videoTitle: mergedConfig.videoTitle,
      isLive: mergedConfig.isLive ?? api?.getState('live') ?? false,

      // Player context
      playerVersion: PLUGIN_VERSION,
      playerName: PLUGIN_NAME,

      // Environment
      browser: getBrowserInfo().name,
      os: getOSInfo().name,
      deviceType: getDeviceType(),
      screenSize: getScreenSize(),
      playerSize: getPlayerSize(api?.container ?? null),
      connectionType: getConnectionType(),

      // Custom dimensions
      ...mergedConfig.customDimensions,

      // Event-specific data
      ...data,
    };

    // Use custom beacon function if provided (for testing)
    if (mergedConfig.customBeacon) {
      mergedConfig.customBeacon(mergedConfig.beaconUrl, payload);
      return;
    }

    // Use sendBeacon API for reliability (survives page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([safeStringify(payload)], {
        type: 'application/json',
      });
      navigator.sendBeacon(mergedConfig.beaconUrl, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(mergedConfig.beaconUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mergedConfig.apiKey ? { 'X-API-Key': mergedConfig.apiKey } : {}),
        },
        body: safeStringify(payload),
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't disrupt playback
      });
    }
  }

  /**
   * Send periodic heartbeat with current metrics.
   */
  function sendHeartbeat(): void {
    if (!api) return;

    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeatTime;

    // Update watch time
    session.watchTime += timeSinceLastHeartbeat;

    // Update play time (only if playing and not rebuffering)
    if (session.playbackState === 'playing' && !isRebuffering) {
      session.playTime += timeSinceLastHeartbeat;
    }

    // Calculate average bitrate
    if (session.bitrateHistory.length > 0) {
      const totalBitrateTime = session.bitrateHistory.reduce((sum, b, i, arr) => {
        const nextTime = i < arr.length - 1 ? arr[i + 1]?.time : now;
        const duration = nextTime - b.time;
        return sum + b.bitrate * duration;
      }, 0);
      session.avgBitrate = Math.round(totalBitrateTime / session.watchTime);
    }

    const state = {
      currentTime: api.getState('currentTime'),
      duration: api.getState('duration'),
    };

    sendBeacon('heartbeat', {
      watchTime: session.watchTime,
      playTime: session.playTime,
      currentTime: state.currentTime,
      duration: state.duration,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      avgBitrate: session.avgBitrate,
      qoeScore: getQoEScore(),
    });

    lastHeartbeatTime = now;
  }

  /**
   * Calculate current QoE score.
   */
  function getQoEScore(): number {
    return calculateQoEScore({
      startupTime: session.startupTime,
      rebufferDuration: session.rebufferDuration,
      watchTime: session.watchTime,
      maxBitrate: session.maxBitrate,
      exitType: session.exitType,
      errorCount: session.errorCount,
    });
  }

  /**
   * Send view end event with final metrics.
   */
  function sendViewEnd(): void {
    if (!api) return;

    session.viewEnd = Date.now();

    const state = {
      currentTime: api.getState('currentTime'),
      duration: api.getState('duration'),
    };

    const completionRate = state.duration
      ? (state.currentTime / state.duration) * 100
      : 0;

    sendBeacon('viewEnd', {
      watchTime: session.watchTime,
      playTime: session.playTime,
      startupTime: session.startupTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      rebufferRatio:
        session.watchTime > 0
          ? (session.rebufferDuration / session.watchTime) * 100
          : 0,
      avgBitrate: session.avgBitrate,
      maxBitrate: session.maxBitrate,
      qualityChanges: session.qualityChanges,
      pauseCount: session.pauseCount,
      pauseDuration: session.pauseDuration,
      seekCount: session.seekCount,
      errorCount: session.errorCount,
      exitType: session.exitType,
      qoeScore: getQoEScore(),
      completionRate,
    });
  }

  // === Event Handlers ===

  /**
   * Handle play request (user clicks play).
   */
  function onPlayRequest(): void {
    session.playRequestTime = Date.now();
    sendBeacon('playRequest');
  }

  /**
   * Handle playback started/resumed.
   */
  function onPlaying(): void {
    const now = Date.now();

    // First frame?
    if (session.firstFrameTime === null) {
      session.firstFrameTime = now;
      session.startupTime = session.playRequestTime
        ? now - session.playRequestTime
        : null;

      sendBeacon('videoStart', {
        startupTime: session.startupTime,
      });
    }

    // End rebuffer?
    if (isRebuffering && rebufferStartTime) {
      const rebufferDuration = now - rebufferStartTime;
      session.rebufferDuration += rebufferDuration;
      isRebuffering = false;
      rebufferStartTime = null;

      sendBeacon('rebufferEnd', {
        duration: rebufferDuration,
        totalRebufferTime: session.rebufferDuration,
      });
    }

    // End pause?
    if (pauseStartTime) {
      const pauseDuration = now - pauseStartTime;
      session.pauseDuration += pauseDuration;
      pauseStartTime = null;
    }

    session.playbackState = 'playing';
  }

  /**
   * Handle pause.
   */
  function onPause(): void {
    if (!api) return;

    session.pauseCount++;
    session.playbackState = 'paused';
    pauseStartTime = Date.now();

    sendBeacon('pause', {
      currentTime: api.getState('currentTime'),
    });
  }

  /**
   * Handle buffering/waiting.
   */
  function onWaiting(): void {
    if (!api) return;

    // Only count as rebuffer if we've started playing
    if (session.firstFrameTime !== null && !isRebuffering) {
      isRebuffering = true;
      rebufferStartTime = Date.now();
      session.rebufferCount++;

      sendBeacon('rebufferStart', {
        rebufferCount: session.rebufferCount,
        currentTime: api.getState('currentTime'),
      });
    }
  }

  /**
   * Handle seeking.
   */
  function onSeeking(): void {
    if (!api) return;

    session.seekCount++;

    sendBeacon('seeking', {
      seekCount: session.seekCount,
      seekTo: api.getState('currentTime'),
    });
  }

  /**
   * Handle playback ended.
   */
  function onEnded(): void {
    session.playbackState = 'ended';
    session.exitType = 'completed';
    sendViewEnd();
  }

  /**
   * Handle errors.
   */
  function onError(payload: { error: Error }): void {
    const error = payload.error;
    session.errorCount++;

    const errorEvent: ErrorEvent = {
      time: Date.now(),
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      fatal: (error as any).fatal ?? false,
    };

    session.errors.push(errorEvent);

    sendBeacon('error', {
      errorType: errorEvent.type,
      errorMessage: errorEvent.message,
      errorCode: (error as any).code,
      fatal: errorEvent.fatal,
    });

    if (errorEvent.fatal) {
      session.playbackState = 'error';
      session.exitType = 'error';
      sendViewEnd();
    }
  }

  /**
   * Handle quality/bitrate changes.
   */
  function onQualityChange(payload: { quality: string; auto: boolean }): void {
    if (!api) return;

    const now = Date.now();
    session.qualityChanges++;

    // Try to get bitrate from quality levels
    const qualities = api.getState('qualities');
    const currentQuality = qualities.find((q: QualityLevel) => q.id === payload.quality);

    if (currentQuality) {
      const bitrateChange: BitrateChange = {
        time: now,
        bitrate: currentQuality.bitrate,
        width: currentQuality.width,
        height: currentQuality.height,
      };

      session.bitrateHistory.push(bitrateChange);

      if (currentQuality.bitrate > session.maxBitrate) {
        session.maxBitrate = currentQuality.bitrate;
      }

      sendBeacon('qualityChange', {
        bitrate: currentQuality.bitrate,
        width: currentQuality.width,
        height: currentQuality.height,
        auto: payload.auto,
      });
    }
  }

  /**
   * Handle page visibility change.
   */
  function onVisibilityChange(): void {
    if (document.hidden) {
      session.exitType = 'background';
      sendHeartbeat();
    }
  }

  /**
   * Handle page unload.
   */
  function onBeforeUnload(): void {
    if (!session.exitType) {
      session.exitType = 'abandoned';
    }
    sendViewEnd();
  }

  // === Plugin Interface ===

  return {
    id: 'analytics',
    name: 'Analytics',
    version: PLUGIN_VERSION,
    type: 'analytics',
    description: 'Quality of Experience and engagement analytics',

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      session = initSession();
      lastHeartbeatTime = Date.now();

      // Send view start
      sendBeacon('viewStart');

      // Subscribe to player events
      const unsubPlay = api.on('playback:play', () => {
        onPlayRequest();
        onPlaying();
      });
      const unsubPause = api.on('playback:pause', onPause);
      const unsubWaiting = api.on('media:waiting', onWaiting);
      const unsubSeeking = api.on('playback:seeking', onSeeking);
      const unsubEnded = api.on('playback:ended', onEnded);
      const unsubError = api.on('media:error', onError);
      const unsubQuality = api.on('quality:change', onQualityChange);

      cleanupFns.push(
        unsubPlay,
        unsubPause,
        unsubWaiting,
        unsubSeeking,
        unsubEnded,
        unsubError,
        unsubQuality
      );

      // Page lifecycle events
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('beforeunload', onBeforeUnload);

      cleanupFns.push(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('beforeunload', onBeforeUnload);
      });

      // Start heartbeat
      heartbeatTimer = setInterval(
        sendHeartbeat,
        mergedConfig.heartbeatInterval || 10000
      );

      api.logger.info('Analytics plugin initialized', {
        viewId: session.viewId,
        videoId: mergedConfig.videoId,
      });
    },

    async destroy(): Promise<void> {
      // Stop heartbeat
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // Send final view end if not already sent
      if (!session.viewEnd) {
        session.exitType = session.exitType || 'abandoned';
        sendViewEnd();
      }

      // Cleanup event listeners
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];

      api?.logger.info('Analytics plugin destroyed');
      api = null;
    },

    // === Public API ===

    getViewId(): string {
      return session.viewId;
    },

    getSessionId(): string {
      return session.sessionId;
    },

    getQoEScore(): number {
      return getQoEScore();
    },

    getMetrics(): Partial<ViewSession> {
      return { ...session };
    },

    trackEvent(name: string, data: Record<string, unknown> = {}): void {
      sendBeacon(`custom:${name}`, data);
    },
  };
}

// Default export
export default createAnalyticsPlugin;
