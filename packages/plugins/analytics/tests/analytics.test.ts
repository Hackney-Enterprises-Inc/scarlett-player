/**
 * Analytics Plugin Tests
 *
 * Comprehensive test suite for the Analytics plugin.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
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
  const state = {
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

      // First play triggers playRequest and videoStart together
      (api as any)._trigger('playback:play');

      const videoStartEvent = beacons.find((b) => b.event === 'videoStart');
      expect(videoStartEvent).toBeDefined();
      // Startup time should be 0 or very small since we trigger immediately
      expect(videoStartEvent?.startupTime).toBeDefined();
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
});
