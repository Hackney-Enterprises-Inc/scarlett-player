/**
 * Analytics Plugin Tests
 *
 * Comprehensive test suite for the Analytics plugin.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import { isHttpsUrl } from '../src/helpers';
import type { IPluginAPI } from '@scarlett-player/core';
import type { BeaconPayload, AnalyticsConfig } from '../src/types';

// Mock data
const mockConfig: AnalyticsConfig = {
  beaconUrl: 'https://api.example.com/analytics',
  videoId: 'test-video-123',
  videoTitle: 'Test Video',
  isLive: false,
  viewerId: 'test-viewer-456',
  viewerPlan: 'ppv',
  heartbeatInterval: 100, // Fast for testing
  disableInDev: false,
};

// Collected beacons
let beacons: BeaconPayload[] = [];

// Mock beacon function
const mockBeacon = (url: string, payload: BeaconPayload) => {
  beacons.push(payload);
};

// Mock PluginAPI
function createMockAPI(): IPluginAPI {
  // Typed as an index signature on purpose: the mock's getState/setState take a
  // plain string key, and a bare object literal has no index signature, so both
  // accesses below were implicit `any` (TS7053) once the package started
  // type-checking its tests on 2026-09-02.
  const state: Record<string, unknown> = {
    currentTime: 0,
    duration: 100,
    playing: false,
    paused: true,
    live: false,
    qualities: [],
  };

  const eventHandlers = new Map<string, Set<Function>>();

  return {
    pluginId: 'analytics',
    container: document.createElement('div'),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: any) => {
      state[key] = value;
    }),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
      return () => {
        eventHandlers.get(event)?.delete(handler);
      };
    }),
    off: vi.fn((event: string, handler: Function) => {
      eventHandlers.get(event)?.delete(handler);
    }),
    emit: vi.fn((event: string, payload: any) => {
      eventHandlers.get(event)?.forEach((handler) => handler(payload));
    }),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => () => {}),
    // Helper to trigger events
    _trigger(event: string, payload?: any) {
      eventHandlers.get(event)?.forEach((handler) => handler(payload));
    },
    // Helper to update state
    _updateState(updates: Record<string, any>) {
      Object.assign(state, updates);
    },
  } as any;
}

describe('Analytics Plugin', () => {
  let api: IPluginAPI;

  beforeEach(() => {
    beacons = [];
    api = createMockAPI();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should require beaconUrl', () => {
      expect(() => {
        createAnalyticsPlugin({ videoId: 'test' } as any);
      }).toThrow('requires beaconUrl');
    });

    it('should require videoId', () => {
      expect(() => {
        createAnalyticsPlugin({ beaconUrl: 'https://api.example.com' } as any);
      }).toThrow('requires videoId');
    });

    it('should initialize with valid config', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      expect(plugin.id).toBe('analytics');
      expect(plugin.name).toBe('Analytics');
      expect(plugin.type).toBe('analytics');
    });

    it('should send viewStart event on init', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      expect(beacons).toHaveLength(1);
      expect(beacons[0].event).toBe('viewStart');
      expect(beacons[0].videoId).toBe('test-video-123');
    });

    it('should generate unique view IDs', async () => {
      const plugin1 = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin1.init(api);
      const viewId1 = plugin1.getViewId();

      await plugin1.destroy();
      beacons = [];

      const plugin2 = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin2.init(createMockAPI());
      const viewId2 = plugin2.getViewId();

      expect(viewId1).not.toBe(viewId2);
    });
  });

  describe('Playback Events', () => {
    it('should track play request', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:play');

      // Should send playRequest and videoStart (first play)
      expect(beacons.length).toBeGreaterThanOrEqual(1);
      expect(beacons.find(b => b.event === 'playRequest')).toBeDefined();
    });

    it('should track video start and calculate startup time', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:play');

      const videoStartEvent = beacons.find((b) => b.event === 'videoStart');
      expect(videoStartEvent).toBeDefined();

      // The previous assertion here was `toBeDefined()`, which passes for null
      // as readily as for a number: it could not tell a working metric from a
      // broken one, and the metric is in fact degenerate.
      //
      // `playback:play` runs onPlayRequest() and onPlaying() back to back in
      // one handler, so the two Date.now() reads that bracket the measurement
      // are one synchronous tick apart no matter how long startup actually
      // took. startupTime therefore measures the handler, not the viewer's
      // wait. Asserted as a real number in single-digit milliseconds rather
      // than waved through, so that wiring videoStart to an actual first-frame
      // signal fails here and this expectation gets updated with it.
      expect(typeof videoStartEvent?.startupTime).toBe('number');
      expect(videoStartEvent?.startupTime).toBeLessThan(10);
    });

    it('should send exactly one videoStart per view', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:play');
      (api as any)._trigger('playback:pause');
      (api as any)._trigger('playback:play');

      expect(beacons.filter((b) => b.event === 'videoStart')).toHaveLength(1);
    });

    it('should track pause events', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:pause');

      expect(beacons).toHaveLength(1);
      expect(beacons[0].event).toBe('pause');

      const metrics = plugin.getMetrics();
      expect(metrics.pauseCount).toBe(1);
    });

    it('should track seeking', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._updateState({ currentTime: 50 });
      (api as any)._trigger('playback:seeking', { time: 50 });

      expect(beacons).toHaveLength(1);
      expect(beacons[0].event).toBe('seeking');

      const metrics = plugin.getMetrics();
      expect(metrics.seekCount).toBe(1);
    });

    it('should track playback ended', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:ended');

      const viewEndEvent = beacons.find((b) => b.event === 'viewEnd');
      expect(viewEndEvent).toBeDefined();
      expect(viewEndEvent?.exitType).toBe('completed');
    });
  });

  describe('Rebuffering', () => {
    it('should track rebuffer events', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      // Start playback first
      (api as any)._trigger('playback:play');
      (api as any)._trigger('playback:play'); // playing
      beacons = [];

      // Start rebuffer
      (api as any)._trigger('media:waiting');

      const rebufferStart = beacons.find((b) => b.event === 'rebufferStart');
      expect(rebufferStart).toBeDefined();

      beacons = [];
      vi.advanceTimersByTime(1000);

      // End rebuffer
      (api as any)._trigger('playback:play');

      const rebufferEnd = beacons.find((b) => b.event === 'rebufferEnd');
      expect(rebufferEnd).toBeDefined();
      expect(rebufferEnd?.duration).toBeGreaterThan(0);

      const metrics = plugin.getMetrics();
      expect(metrics.rebufferCount).toBe(1);
    });
  });

  describe('Quality Tracking', () => {
    it('should track quality changes', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      (api as any)._updateState({
        qualities: [
          { id: '720p', bitrate: 2500000, width: 1280, height: 720 },
          { id: '1080p', bitrate: 5000000, width: 1920, height: 1080 },
        ],
      });

      beacons = [];

      (api as any)._trigger('quality:change', {
        quality: '1080p',
        auto: false,
      });

      const qualityEvent = beacons.find((b) => b.event === 'qualityChange');
      expect(qualityEvent).toBeDefined();
      expect(qualityEvent?.bitrate).toBe(5000000);

      const metrics = plugin.getMetrics();
      expect(metrics.qualityChanges).toBe(1);
      expect(metrics.maxBitrate).toBe(5000000);
    });
  });

  describe('Error Tracking', () => {
    it('should track errors', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      const error = new Error('Test error');
      (api as any)._trigger('media:error', { error });

      const errorEvent = beacons.find((b) => b.event === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.errorMessage).toBe('Test error');

      const metrics = plugin.getMetrics();
      expect(metrics.errorCount).toBe(1);
      expect(metrics.errors).toHaveLength(1);
    });

    it('should handle fatal errors', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      const error = Object.assign(new Error('Fatal error'), { fatal: true });
      (api as any)._trigger('media:error', { error });

      const viewEndEvent = beacons.find((b) => b.event === 'viewEnd');
      expect(viewEndEvent).toBeDefined();
      expect(viewEndEvent?.exitType).toBe('error');
    });
  });

  describe('Heartbeat', () => {
    it('should send periodic heartbeats', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      // Wait for first heartbeat
      vi.advanceTimersByTime(1000);

      expect(beacons).toHaveLength(1);
      expect(beacons[0].event).toBe('heartbeat');
      expect(beacons[0].watchTime).toBeGreaterThan(0);
    });

    it('should track watch time and play time separately', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      // Start playing
      (api as any)._trigger('playback:play');
      (api as any)._trigger('playback:play');
      beacons = [];

      // Advance time
      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat).toBeDefined();
      expect(heartbeat?.watchTime).toBeGreaterThan(0);
      expect(heartbeat?.playTime).toBeGreaterThan(0);
    });
  });

  // Live latency (LL-11). The only way to know whether low latency is holding
  // in production, and the reason the sampler aggregates rather than stores:
  // the provider emits `live:latency` at the timeupdate cadence.
  describe('Live latency', () => {
    /** Feed a sequence of latency readings through the event bus. */
    const feed = (latencies: number[]) => {
      for (const latency of latencies) {
        (api as any)._trigger('live:latency', { latency });
      }
    };

    it('carries mean, p95, max and the sample count on the heartbeat', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      feed([2, 2, 2, 2, 8]);
      beacons = [];

      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat?.liveLatencySamples).toBe(5);
      expect(heartbeat?.liveLatencyMean).toBe(3.2);
      expect(heartbeat?.liveLatencyMax).toBe(8);
      // The 95th of five readings is the largest one
      expect(heartbeat?.liveLatencyP95).toBe(8);
    });

    it('reports the p95 at the bucket edge, never optimistically', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      // 95 readings at 2s and 5 at 9s: the 95th sample is the last 2s one
      feed([...Array(95).fill(2), ...Array(5).fill(9)]);
      beacons = [];

      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat?.liveLatencySamples).toBe(100);
      expect(heartbeat?.liveLatencyP95).toBeGreaterThanOrEqual(2);
      expect(heartbeat?.liveLatencyP95).toBeLessThan(3);
    });

    it('reports the overflow bucket at the documented clamp', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      // Everything past two minutes lands in the overflow bucket, which has no
      // upper edge to report: the clamp is the answer, not a bucket width past it
      feed(Array(10).fill(500));
      beacons = [];

      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat?.liveLatencyP95).toBe(120);
      expect(heartbeat?.liveLatencyMax).toBe(500);
    });

    it('carries the summary on the unload beacon as well as on viewEnd', async () => {
      // A local capture: plugins from earlier tests are still listening on the
      // window and would push their own (sampler-less) viewEnd into `beacons`
      const sent: any[] = [];
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        customBeacon: (_url: string, payload: any) => {
          sent.push(payload);
        },
      });

      await plugin.init(api);
      feed([2, 2, 2, 2, 8]);

      window.dispatchEvent(new Event('pagehide'));

      const viewEnd = sent.find((b) => b.event === 'viewEnd');
      expect(viewEnd?.liveLatencySamples).toBe(5);
      expect(viewEnd?.liveLatencyMean).toBe(3.2);
      expect(viewEnd?.liveLatencyMax).toBe(8);
    });

    it('reports effective low latency, and stays sticky once seen', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      // The manifest announces LL before the first timeupdate reading
      (api as any)._trigger('live:lowlatency', { enabled: true });
      feed([2, 2.5]);
      (api as any)._trigger('live:lowlatency', { enabled: false });
      beacons = [];

      vi.advanceTimersByTime(1000);

      expect(beacons.find((b) => b.event === 'heartbeat')?.lowLatency).toBe(true);
    });

    it('omits the live keys entirely on a VOD session', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat).not.toHaveProperty('liveLatencyMean');
      expect(heartbeat).not.toHaveProperty('liveLatencyP95');
      expect(heartbeat).not.toHaveProperty('lowLatency');
    });

    it('carries the session summary on viewEnd', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 100000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      feed([1, 3]);
      beacons = [];

      await plugin.destroy();

      const viewEnd = beacons.find((b) => b.event === 'viewEnd');
      expect(viewEnd?.liveLatencyMean).toBe(2);
      expect(viewEnd?.liveLatencySamples).toBe(2);
    });

    it('ignores a nonsensical reading rather than skewing the mean', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      feed([2, NaN, -5, Infinity, 4]);
      beacons = [];

      vi.advanceTimersByTime(1000);

      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat?.liveLatencySamples).toBe(2);
      expect(heartbeat?.liveLatencyMean).toBe(3);
    });

    it('stops recording after destroy', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: true,
        heartbeatInterval: 100000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      await plugin.destroy();
      beacons = [];

      // The unsubscribes ran; nothing should still be listening
      expect(() => feed([5])).not.toThrow();
      expect(beacons).toHaveLength(0);
    });
  });

  describe('QoE Score', () => {
    it('should calculate QoE score', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      // Start playback
      (api as any)._trigger('playback:play');
      vi.advanceTimersByTime(500);
      (api as any)._trigger('playback:play');

      const qoeScore = plugin.getQoEScore();
      expect(qoeScore).toBeGreaterThan(0);
      expect(qoeScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Custom Events', () => {
    it('should track custom events', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      plugin.trackEvent('ppv_purchase', { price: 49.99, currency: 'USD' });

      const customEvent = beacons.find((b) => b.event === 'custom:ppv_purchase');
      expect(customEvent).toBeDefined();
      expect(customEvent?.price).toBe(49.99);
      expect(customEvent?.currency).toBe('USD');
    });
  });

  describe('Custom Dimensions', () => {
    it('should include custom dimensions in all events', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customDimensions: {
          promoter: 'UFC',
          eventType: 'fight',
        },
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      expect(beacons[0].promoter).toBe('UFC');
      expect(beacons[0].eventType).toBe('fight');
    });
  });

  describe('Cleanup', () => {
    it('should send viewEnd on destroy', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      await plugin.destroy();

      const viewEndEvent = beacons.find((b) => b.event === 'viewEnd');
      expect(viewEndEvent).toBeDefined();
      expect(viewEndEvent?.exitType).toBe('abandoned');
    });

    it('should stop heartbeat on destroy', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      await plugin.destroy();

      beacons = [];

      // Advance time - should not trigger heartbeat
      vi.advanceTimersByTime(2000);

      expect(beacons).toHaveLength(0);
    });
  });

  describe('Environment Detection', () => {
    it('should detect browser and OS', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      expect(beacons[0].browser).toBeDefined();
      expect(beacons[0].os).toBeDefined();
      expect(beacons[0].deviceType).toBeDefined();
    });
  });

  describe('Public API', () => {
    it('should expose public methods', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      expect(typeof plugin.getViewId).toBe('function');
      expect(typeof plugin.getSessionId).toBe('function');
      expect(typeof plugin.getQoEScore).toBe('function');
      expect(typeof plugin.getMetrics).toBe('function');
      expect(typeof plugin.trackEvent).toBe('function');
    });

    it('should return metrics', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);

      const metrics = plugin.getMetrics();
      expect(metrics.viewId).toBeDefined();
      expect(metrics.sessionId).toBeDefined();
      expect(metrics.viewerId).toBeDefined();
    });
  });

  describe('Fetch Fallback Transport & API Key Security', () => {
    let originalSendBeacon: any;
    let originalFetch: any;
    let fetchMock: any;

    beforeEach(() => {
      originalSendBeacon = navigator.sendBeacon;
      originalFetch = globalThis.fetch;
      // Force fetch fallback by removing sendBeacon
      Object.defineProperty(navigator, 'sendBeacon', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      fetchMock = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchMock;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: originalSendBeacon,
        configurable: true,
        writable: true,
      });
      globalThis.fetch = originalFetch;
    });

    it('attaches apiKey as X-API-Key header when beaconUrl uses HTTPS', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'secure-vid',
        apiKey: 'secret-key-123',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key-123',
      });
    });

    it('omits X-API-Key header when beaconUrl uses HTTP', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'http://insecure.example.com/analytics',
        videoId: 'insecure-vid',
        apiKey: 'secret-key-123',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
      expect(options.headers['X-API-Key']).toBeUndefined();
    });

    it('omits X-API-Key header when apiKey is not provided', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'no-key-vid',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
      expect(options.headers['X-API-Key']).toBeUndefined();
    });

    it('omits X-API-Key header when beaconUrl is not a valid HTTPS URL', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'ftp://files.example.com/analytics',
        videoId: 'ftp-vid',
        apiKey: 'secret-key-123',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-API-Key']).toBeUndefined();
    });
  });

  describe('isHttpsUrl Helper', () => {
    it('identifies valid HTTPS URLs', () => {
      expect(isHttpsUrl('https://api.example.com')).toBe(true);
      expect(isHttpsUrl('https://api.example.com/beacon?query=1')).toBe(true);
      expect(isHttpsUrl('HTTPS://API.EXAMPLE.COM/ANALYTICS')).toBe(true);
      expect(isHttpsUrl('https://localhost:8443')).toBe(true);
    });

    it('rejects non-HTTPS URLs and invalid strings', () => {
      expect(isHttpsUrl('http://api.example.com')).toBe(false);
      expect(isHttpsUrl('http://localhost:3000')).toBe(false);
      expect(isHttpsUrl('ftp://example.com')).toBe(false);
      expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
      expect(isHttpsUrl('')).toBe(false);
      expect(isHttpsUrl('   ')).toBe(false);
      expect(isHttpsUrl(null as any)).toBe(false);
      expect(isHttpsUrl(undefined as any)).toBe(false);
    });
  });

  describe('Unload beacon handling', () => {
    let originalSendBeacon: any;
    let originalFetch: any;
    let fetchMock: any;
    let sendBeaconMock: any;

    beforeEach(() => {
      originalSendBeacon = navigator.sendBeacon;
      originalFetch = globalThis.fetch;
      fetchMock = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchMock;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: originalSendBeacon,
        configurable: true,
        writable: true,
      });
      globalThis.fetch = originalFetch;
    });

    it('falls back to keepalive fetch when navigator.sendBeacon returns false', async () => {
      sendBeaconMock = vi.fn().mockReturnValue(false);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'fallback-vid',
        apiKey: 'key-123',
      });

      await plugin.init(api);

      // Trigger beforeunload
      fetchMock.mockClear();
      window.dispatchEvent(new Event('beforeunload'));

      expect(sendBeaconMock).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/analytics',
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
        })
      );
    });

    it('deduplicates between beforeunload and pagehide so viewEnd is only sent once', async () => {
      sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics?existing=param',
        videoId: 'dedup-vid',
        apiKey: 'key-123',
      });

      await plugin.init(api);
      sendBeaconMock.mockClear();

      // Dispatch beforeunload then pagehide
      window.dispatchEvent(new Event('beforeunload'));
      window.dispatchEvent(new Event('pagehide'));

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      const urlUsed = sendBeaconMock.mock.calls[0][0];
      expect(urlUsed).toContain('existing=param');
      expect(urlUsed).toContain('api_key=key-123');
    });
  });
});
