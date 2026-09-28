/**
 * Analytics Plugin Tests
 *
 * Comprehensive test suite for the Analytics plugin.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import { isHttpsUrl } from '../src/helpers';
import { EventBus, StateManager } from '@scarlett-player/core';
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

// Analytics has no dependency on the hls package; the provider's event map is
// loaded from the workspace source instead. The specifier is a variable so tsc
// does not pull hls sources into this package's program (TS6059, outside
// rootDir); vitest resolves it at run time.
const hlsEventMap = '../../hls/src/event-map';

// Collected beacons
let beacons: BeaconPayload[] = [];

// Mock beacon function
const mockBeacon = (url: string, payload: BeaconPayload) => {
  beacons.push(payload);
};

/**
 * Plugin API over core's real StateManager and EventBus.
 *
 * `subscribeToState` was a no-op until SCAR-ANALYTICS-4, so anything analytics
 * derived from state changes passed or failed for the wrong reason. The real
 * store dispatches `{ key, value, previousValue }` only on an actual change,
 * which is the contract a state-driven listener depends on.
 */
function createMockAPI(): IPluginAPI {
  const state = new StateManager({ duration: 100 });
  const bus = new EventBus();

  return {
    pluginId: 'analytics',
    container: document.createElement('div'),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getState: vi.fn((key: any) => state.getValue(key)),
    setState: vi.fn((key: any, value: any) => state.set(key, value)),
    on: vi.fn((event: any, handler: any) => bus.on(event, handler)),
    off: vi.fn((event: any, handler: any) => bus.off(event, handler)),
    emit: vi.fn((event: any, payload: any) => bus.emit(event, payload)),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((callback: any) => state.subscribe(callback)),
    // Helper to trigger events
    _trigger(event: any, payload?: any) {
      bus.emit(event, payload);
    },
    // Helper to update state
    _updateState(updates: Record<string, any>) {
      state.update(updates);
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

    it('should send videoStart with the startup time at the first frame', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      // The request alone is not a start: until 1.18 `playback:play` sent
      // videoStart from the same handler as playRequest, so startupTime was
      // always about 0 and the QoE startup factor always 100.
      (api as any)._trigger('playback:play');
      expect(beacons.find((b) => b.event === 'videoStart')).toBeUndefined();

      vi.advanceTimersByTime(400);
      (api as any)._updateState({ paused: false, playing: true });

      const videoStartEvent = beacons.find((b) => b.event === 'videoStart');
      expect(videoStartEvent?.startupTime).toBe(400);
    });

    it('should send exactly one videoStart per view', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('playback:play');
      (api as any)._updateState({ paused: false, playing: true });
      (api as any)._updateState({ paused: true, playing: false });
      (api as any)._trigger('playback:pause');
      (api as any)._trigger('playback:play');
      (api as any)._updateState({ paused: false, playing: true });

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

  // SCAR-ANALYTICS-4: startupTime is the first frame (the first `playing: true`
  // of the view) minus the earliest request signal. Driven through the real HLS
  // element handlers on the analytics bus, so the order of state writes and
  // bus emits is the provider's own.
  describe('Startup time', () => {
    let video: HTMLVideoElement;
    let gate: { corePlayRequested: boolean; corePauseRequested: boolean };

    /** Dispatch an element event on the test video. */
    const fire = (type: string) => video.dispatchEvent(new Event(type));

    /** Beacons of one event type sent so far. */
    const sent = (event: string) => beacons.filter((b) => b.event === event);

    /**
     * What `ScarlettPlayer.play()` does: emit `playback:play` synchronously,
     * which the HLS plugin answers by arming the gate before `video.play()`.
     */
    const corePlay = (target: IPluginAPI = api) => {
      target.emit('playback:play', undefined);
      gate.corePlayRequested = true;
    };

    /** Mount the real HLS element handlers on `target`'s bus and state. */
    const mountHls = async (target: IPluginAPI = api) => {
      const { setupVideoEventHandlers } = await import(/* @vite-ignore */ hlsEventMap);
      video = document.createElement('video');
      gate = { corePlayRequested: false, corePauseRequested: false };
      setupVideoEventHandlers(video, target, undefined, gate);
    };

    beforeEach(async () => {
      await mountHls();
    });

    it('measures from the core play request, not from the element play event', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);
      beacons = [];

      corePlay();
      vi.advanceTimersByTime(50);
      fire('play');
      vi.advanceTimersByTime(100);
      fire('playing');

      expect(sent('videoStart')).toHaveLength(1);
      expect(sent('videoStart')[0]?.startupTime).toBe(150);
      expect(sent('playRequest')).toHaveLength(1);
      expect(plugin.getMetrics().startupTime).toBe(150);
    });

    it('measures a direct video.play() from the element play event', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);
      beacons = [];

      fire('play');
      vi.advanceTimersByTime(120);
      fire('playing');

      expect(sent('videoStart')).toHaveLength(1);
      expect(sent('videoStart')[0]?.startupTime).toBe(120);
      // The provider emits playback:play at `playing` for an element-driven
      // start; that is the same request arriving late, not a second one.
      expect(sent('playRequest')).toHaveLength(1);
    });

    it('measures an autoplay start the same way', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);
      beacons = [];

      // The provider's own video.play() once the source is ready: no core
      // request, no gate.
      video.autoplay = true;
      fire('loadedmetadata');
      fire('play');
      vi.advanceTimersByTime(300);
      fire('playing');

      expect(sent('videoStart')).toHaveLength(1);
      expect(sent('videoStart')[0]?.startupTime).toBe(300);
      expect(sent('playRequest')).toHaveLength(1);
    });

    it('sends no second videoStart on a resume after pause', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);
      beacons = [];

      fire('play');
      vi.advanceTimersByTime(120);
      fire('playing');
      vi.advanceTimersByTime(1000);
      fire('pause');
      vi.advanceTimersByTime(2000);
      fire('play');
      vi.advanceTimersByTime(80);
      fire('playing');

      expect(sent('videoStart')).toHaveLength(1);
      expect(plugin.getMetrics().startupTime).toBe(120);
      // One per start and one per resume, as before
      expect(sent('playRequest')).toHaveLength(2);
      expect(plugin.getMetrics().pauseCount).toBe(1);
    });

    it('still ends a rebuffer on the playback:play the element emits after a stall', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);

      fire('play');
      vi.advanceTimersByTime(120);
      fire('playing');
      beacons = [];

      // `playing` stays true across a stall, so only the bus event can end it
      fire('waiting');
      vi.advanceTimersByTime(1000);
      fire('playing');

      expect(sent('rebufferStart')).toHaveLength(1);
      expect(sent('rebufferEnd')).toHaveLength(1);
      expect(sent('rebufferEnd')[0]?.duration).toBe(1000);
      expect(plugin.getMetrics().rebufferCount).toBe(1);
      // Recovering from a stall is not a play request
      expect(sent('playRequest')).toHaveLength(0);
      expect(sent('videoStart')).toHaveLength(0);
    });

    it('lets a slow start lower the QoE score', async () => {
      const fastPlugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await fastPlugin.init(api);
      fire('play');
      vi.advanceTimersByTime(100);
      fire('playing');

      const slowApi = createMockAPI();
      await mountHls(slowApi);
      const slowPlugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await slowPlugin.init(slowApi);
      fire('play');
      vi.advanceTimersByTime(5000);
      fire('playing');

      expect(slowPlugin.getMetrics().startupTime).toBe(5000);
      expect(slowPlugin.getQoEScore()).toBeLessThan(fastPlugin.getQoEScore());
    });
  });

  // SCAR-ANALYTICS-6 (decision #159): a view carries its last known live
  // classification, null until one is known. Classification arrives through
  // the real HLS element handlers; core's `load()` reset is replayed on the
  // real state store, which is what makes the playlist cases meaningful.
  describe('isLive classification', () => {
    let video: HTMLVideoElement;
    let duration = NaN;
    const unknownConfig = { ...mockConfig, isLive: undefined, customBeacon: mockBeacon };

    /** Send a probe beacon and return the isLive it carried. */
    const probe = (plugin: ReturnType<typeof createAnalyticsPlugin>) => {
      plugin.trackEvent('probe');
      return beacons.at(-1)?.isLive;
    };

    /** The element reports its duration: VOD with a number, live with Infinity. */
    const metadata = (value: number) => {
      duration = value;
      video.dispatchEvent(new Event('durationchange'));
    };

    /** What core's `load()` writes before the next source's provider runs. */
    const coreLoadReset = () => {
      (api as any)._updateState({
        playing: false,
        paused: true,
        ended: false,
        buffering: true,
        currentTime: 0,
        duration: 0,
        bufferedAmount: 0,
        playbackState: 'loading',
        error: null,
        live: false,
      });
    };

    beforeEach(async () => {
      const { setupVideoEventHandlers } = await import(/* @vite-ignore */ hlsEventMap);
      video = document.createElement('video');
      duration = NaN;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => duration });
      setupVideoEventHandlers(video, api);
    });

    it('sends null on viewStart and false once VOD metadata has loaded', async () => {
      const plugin = createAnalyticsPlugin(unknownConfig);
      await plugin.init(api);

      expect(beacons[0]?.event).toBe('viewStart');
      expect(beacons[0]?.isLive).toBeNull();
      expect(probe(plugin)).toBeNull();

      metadata(60);
      expect(probe(plugin)).toBe(false);
    });

    it('sends null on viewStart and true once live metadata has loaded', async () => {
      const plugin = createAnalyticsPlugin(unknownConfig);
      await plugin.init(api);

      expect(beacons[0]?.isLive).toBeNull();

      metadata(Infinity);
      expect(probe(plugin)).toBe(true);
    });

    it('sends true as soon as live turns true, before any metadata', async () => {
      const plugin = createAnalyticsPlugin(unknownConfig);
      await plugin.init(api);

      expect(probe(plugin)).toBeNull();
      // hls.js classifies at hlsLevelLoaded, ahead of the element's metadata
      api.setState('live', true);
      expect(probe(plugin)).toBe(true);
    });

    it('lets config.isLive win, false included', async () => {
      const vod = createAnalyticsPlugin({ ...unknownConfig, isLive: false });
      await vod.init(api);
      expect(beacons[0]?.isLive).toBe(false);
      metadata(Infinity);
      expect(probe(vod)).toBe(false);
      await vod.destroy();

      beacons = [];
      api = createMockAPI();
      const live = createAnalyticsPlugin({ ...unknownConfig, isLive: true });
      await live.init(api);
      expect(beacons[0]?.isLive).toBe(true);
      api.emit('media:loadedmetadata', { duration: 60 });
      expect(probe(live)).toBe(true);
    });

    it('keeps a live item classified live across the load reset until the next item has metadata', async () => {
      const plugin = createAnalyticsPlugin(unknownConfig);
      await plugin.init(api);
      metadata(Infinity);
      expect(probe(plugin)).toBe(true);

      // Playlist advance: the view survives, core resets `live` to false
      coreLoadReset();
      expect(probe(plugin)).toBe(true);

      // The next item is VOD
      metadata(60);
      expect(api.getState('live')).toBe(false);
      expect(probe(plugin)).toBe(false);
    });

    it('keeps a VOD item classified VOD across the load reset until the next item is classified live', async () => {
      const plugin = createAnalyticsPlugin(unknownConfig);
      await plugin.init(api);
      metadata(60);
      expect(probe(plugin)).toBe(false);

      coreLoadReset();
      expect(probe(plugin)).toBe(false);

      metadata(Infinity);
      expect(probe(plugin)).toBe(true);
    });

    it('carries the classification on the unload beacon too', async () => {
      const sent: BeaconPayload[] = [];
      const plugin = createAnalyticsPlugin({
        ...unknownConfig,
        customBeacon: (_url: string, payload: BeaconPayload) => {
          sent.push(payload);
        },
      });
      await plugin.init(api);
      metadata(Infinity);
      coreLoadReset();

      window.dispatchEvent(new Event('pagehide'));

      const viewEnd = sent.find((b) => b.event === 'viewEnd');
      expect(viewEnd?.isLive).toBe(true);
      await plugin.destroy();
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
      (api as any)._updateState({ paused: false, playing: true });
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

    // SCAR-HLS-3: drive the real HLS provider event map on the same bus, so
    // this fails if the provider's quality:change payload stops matching the
    // `qualities[].id` form analytics resolves against.
    it('should record an hls.js level switch as a bitrate change', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });
      await plugin.init(api);

      const { setupHlsEventHandlers } = await import(/* @vite-ignore */ hlsEventMap);

      const hlsHandlers = new Map<string, Function>();
      const hls = {
        levels: [
          { width: 1920, height: 1080, bitrate: 5000000 },
          { width: 1280, height: 720, bitrate: 2500000 },
          { width: 854, height: 480, bitrate: 1000000 },
        ],
        currentLevel: -1,
        autoLevelEnabled: true,
        on: (event: string, handler: Function) => hlsHandlers.set(event, handler),
        off: () => {},
      };
      setupHlsEventHandlers(hls as any, api, { getIsAutoQuality: () => true });

      hlsHandlers.get('hlsManifestParsed')!('hlsManifestParsed', { levels: hls.levels });
      beacons = [];
      hlsHandlers.get('hlsLevelSwitched')!('hlsLevelSwitched', { level: 1 });

      const qualityEvent = beacons.find((b) => b.event === 'qualityChange');
      expect(qualityEvent).toBeDefined();
      expect(qualityEvent?.bitrate).toBe(2500000);
      expect(qualityEvent?.width).toBe(1280);
      expect(qualityEvent?.height).toBe(720);
      expect(qualityEvent?.auto).toBe(true);

      const metrics = plugin.getMetrics();
      expect(metrics.qualityChanges).toBe(1);
      expect(metrics.bitrateHistory).toHaveLength(1);
      expect(metrics.bitrateHistory?.[0]).toMatchObject({ bitrate: 2500000, width: 1280, height: 720 });
      expect(metrics.maxBitrate).toBe(2500000);
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

    // SCAR-ANALYTICS-5: providers emit `error` as a plain PlayerError-shaped
    // object (the HLS provider's fatal path), not an Error instance.
    it('should record a structured fatal error from the error event', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });
      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('error', {
        code: 'MEDIA_NETWORK_ERROR',
        message: 'HLS error: manifestLoadError (max retries exceeded)',
        fatal: true,
        timestamp: Date.now(),
        detail: { type: 'network', httpStatus: 404 },
      });

      const errorEvent = beacons.find((b) => b.event === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.errorType).toBe('MEDIA_NETWORK_ERROR');
      expect(errorEvent?.errorCode).toBe('MEDIA_NETWORK_ERROR');
      expect(errorEvent?.errorMessage).toBe('HLS error: manifestLoadError (max retries exceeded)');
      expect(errorEvent?.fatal).toBe(true);

      expect(plugin.getMetrics().errorCount).toBe(1);
      const viewEndEvent = beacons.find((b) => b.event === 'viewEnd');
      expect(viewEndEvent?.exitType).toBe('error');
      expect(viewEndEvent?.errorCount).toBe(1);
    });

    it('should keep recording an Error on the error event as before, adding its code', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });
      await plugin.init(api);
      beacons = [];

      const originalError = new TypeError('Plugin init failed');
      (api as any)._trigger('error', {
        code: 'PLUGIN_INIT_FAILED',
        message: 'wrapped',
        fatal: false,
        timestamp: Date.now(),
        originalError,
      });

      const errorEvent = beacons.find((b) => b.event === 'error');
      expect(errorEvent?.errorType).toBe('TypeError');
      expect(errorEvent?.errorMessage).toBe('Plugin init failed');
      expect(errorEvent?.errorCode).toBe('PLUGIN_INIT_FAILED');
      expect(errorEvent?.fatal).toBe(false);
      expect(beacons.find((b) => b.event === 'viewEnd')).toBeUndefined();

      beacons = [];
      (api as any)._trigger('error', new Error('bare'));
      const bare = beacons.find((b) => b.event === 'error');
      expect(bare?.errorType).toBe('Error');
      expect(bare?.errorMessage).toBe('bare');
      expect(bare?.errorCode).toBeUndefined();
      expect(plugin.getMetrics().errorCount).toBe(2);
    });

    it('should not put a structured name or message from a payload into the beacon', async () => {
      const plugin = createAnalyticsPlugin({ ...mockConfig, customBeacon: mockBeacon });
      await plugin.init(api);
      beacons = [];

      // Hand-built payloads, deliberately outside the PlayerError type.
      (api as any)._trigger('error', { code: 'MEDIA_NETWORK_ERROR', message: { nested: true }, name: 42, fatal: false });
      (api as any)._trigger('error', { message: 'plain message', name: { not: 'a string' } });

      const errors = beacons.filter((b) => b.event === 'error');
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        errorType: 'MEDIA_NETWORK_ERROR',
        errorCode: 'MEDIA_NETWORK_ERROR',
        errorMessage: 'Unknown core error',
      });
      expect(errors[1]).toMatchObject({ errorType: 'CoreError', errorMessage: 'plain message' });
      expect(errors[1]?.errorCode).toBeUndefined();
    });

    it('should ignore an error payload with neither code nor message', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });
      await plugin.init(api);
      beacons = [];

      (api as any)._trigger('error', { fatal: true });
      (api as any)._trigger('error', { code: 42 });

      expect(beacons).toHaveLength(0);
      expect(plugin.getMetrics().errorCount).toBe(0);
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

  // A new video is a new view. Until 1.19 the view was bound to config.videoId
  // for the plugin's lifetime: a pre-roll's `ended` sent viewEnd and stopped
  // the heartbeat, so the main video that followed ran with no heartbeat, no
  // watch time and no final beacon (pagehide saw viewEnd already set).
  describe('Track changes', () => {
    /** Play the current source through to its first frame. */
    const startPlayback = (): void => {
      (api as any)._updateState({ ended: false });
      (api as any)._trigger('playback:play');
      (api as any)._updateState({ paused: false, playing: true });
    };

    /** Core's load(): writes the `source` state before the provider loads. */
    const loadSource = (src: string): void => {
      (api as any)._updateState({ source: { src, type: 'application/x-mpegurl' } });
    };

    /** The current source plays to its end. */
    const endPlayback = (): void => {
      (api as any)._updateState({ playing: false, paused: true, ended: true });
      (api as any)._trigger('playback:ended');
    };

    it('measures the main video after a pre-roll ends: new view, heartbeat, final beacon', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        videoId: 'preroll',
        videoTitle: 'Pre-roll',
        isLive: undefined,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      const prerollViewId = plugin.getViewId();

      startPlayback();
      vi.advanceTimersByTime(1500);
      endPlayback();

      const prerollEnd = beacons.find((b) => b.event === 'viewEnd');
      expect(prerollEnd?.viewId).toBe(prerollViewId);
      expect(prerollEnd?.videoId).toBe('preroll');
      expect(prerollEnd?.exitType).toBe('completed');

      // The playlist advances to the main video and loads it
      beacons = [];
      (api as any)._trigger('playlist:change', {
        track: { id: 'main-video', src: 'main.m3u8', title: 'Main Video' },
        index: 1,
      });
      loadSource('main.m3u8');

      const mainViewId = plugin.getViewId();
      expect(mainViewId).not.toBe(prerollViewId);
      // The pre-roll view already ended; it is not ended twice
      expect(beacons.filter((b) => b.event === 'viewEnd')).toHaveLength(0);
      expect(beacons[0]).toMatchObject({
        event: 'viewStart',
        viewId: mainViewId,
        videoId: 'main-video',
        videoTitle: 'Main Video',
      });

      startPlayback();
      vi.advanceTimersByTime(1000);

      const heartbeats = beacons.filter((b) => b.event === 'heartbeat');
      expect(heartbeats).toHaveLength(1);
      expect(heartbeats[0]).toMatchObject({ viewId: mainViewId, videoId: 'main-video' });
      // Counted from the main view's start, none of the pre-roll's time
      expect(heartbeats[0].watchTime).toBe(1000);
      expect(heartbeats[0].playTime).toBe(1000);

      // The viewer leaves
      window.dispatchEvent(new Event('pagehide'));

      const finalBeacon = beacons[beacons.length - 1];
      expect(finalBeacon).toMatchObject({
        event: 'viewEnd',
        viewId: mainViewId,
        videoId: 'main-video',
        watchTime: 1000,
        exitType: 'abandoned',
      });

      await plugin.destroy();
    });

    it('keeps the view when the current playlist track is removed without a load', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      const viewId = plugin.getViewId();
      startPlayback();
      beacons = [];

      // playlist.remove(current): the next track becomes current, nothing loads
      (api as any)._trigger('playlist:change', {
        track: { id: 'next-track', src: 'next.m3u8' },
        index: 0,
      });
      vi.advanceTimersByTime(1000);

      expect(plugin.getViewId()).toBe(viewId);
      expect(beacons.every((b) => b.videoId === mockConfig.videoId)).toBe(true);
      expect(beacons.filter((b) => b.event === 'viewStart' || b.event === 'viewEnd')).toHaveLength(0);

      // When that track does load, it becomes the video
      loadSource('next.m3u8');
      expect(plugin.getViewId()).not.toBe(viewId);
      expect(beacons.find((b) => b.event === 'viewStart')?.videoId).toBe('next-track');

      await plugin.destroy();
    });

    it('lets setVideo() win over a playlist track still waiting to load', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      (api as any)._trigger('playlist:change', {
        track: { id: 'queued-track', src: 'queued.m3u8' },
        index: 1,
      });
      plugin.setVideo({ videoId: 'host-video' });
      loadSource('host.m3u8');

      const starts = beacons.filter((b) => b.event === 'viewStart').map((b) => b.videoId);
      expect(starts).toEqual([mockConfig.videoId, 'host-video']);

      await plugin.destroy();
    });

    it('does not start a new view on a token refresh of the same video', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      const viewId = plugin.getViewId();
      startPlayback();
      beacons = [];

      // The host re-loads a freshly signed URL for the same video
      plugin.setVideo({ videoId: mockConfig.videoId });
      (api as any)._updateState({ playing: false, paused: true, currentTime: 0 });
      loadSource('main.m3u8?token=new');
      (api as any)._trigger('media:loaded', { src: 'main.m3u8?token=new', type: 'hls' });
      startPlayback();
      // A playlist edit re-emits the current track unchanged
      (api as any)._trigger('playlist:change', {
        track: { id: mockConfig.videoId, src: 'main.m3u8?token=new' },
        index: 0,
      });

      vi.advanceTimersByTime(1000);

      expect(plugin.getViewId()).toBe(viewId);
      expect(beacons.filter((b) => b.event === 'viewStart' || b.event === 'viewEnd')).toHaveLength(0);
      expect(beacons.filter((b) => b.event === 'heartbeat')).toHaveLength(1);
      expect(beacons.every((b) => b.viewId === viewId)).toBe(true);

      await plugin.destroy();
    });

    it('ends a view still playing when setVideo() names another video', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      const firstViewId = plugin.getViewId();
      startPlayback();
      vi.advanceTimersByTime(500);
      beacons = [];

      plugin.setVideo({ videoId: 'next-video', videoTitle: 'Next', isLive: true });

      expect(beacons.map((b) => b.event)).toEqual(['viewEnd', 'viewStart']);
      expect(beacons[0]).toMatchObject({
        viewId: firstViewId,
        videoId: mockConfig.videoId,
        exitType: 'abandoned',
      });
      expect(beacons[1]).toMatchObject({
        videoId: 'next-video',
        videoTitle: 'Next',
        isLive: true,
      });
      expect(beacons[1].viewId).not.toBe(firstViewId);

      // One heartbeat timer, not one per view
      beacons = [];
      vi.advanceTimersByTime(1000);
      expect(beacons.filter((b) => b.event === 'heartbeat')).toHaveLength(1);

      await plugin.destroy();
    });

    it('keeps the source classification on a replay, which does not reload it', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        isLive: undefined,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      (api as any)._trigger('media:loadedmetadata', { duration: 100 });
      startPlayback();
      endPlayback();

      beacons = [];
      startPlayback();

      expect(beacons[0].event).toBe('viewStart');
      expect(beacons.every((b) => b.isLive === false)).toBe(true);

      // Another video starts unknown until its own metadata
      plugin.setVideo({ videoId: 'other-video' });
      expect(beacons[beacons.length - 1]).toMatchObject({ event: 'viewStart', isLive: null });

      await plugin.destroy();
    });

    it('measures a replay after the video ends as a new view of the same video', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        heartbeatInterval: 1000,
        customBeacon: mockBeacon,
      });

      await plugin.init(api);
      const firstViewId = plugin.getViewId();
      startPlayback();
      vi.advanceTimersByTime(1000);
      endPlayback();

      beacons = [];
      startPlayback();

      const replayViewId = plugin.getViewId();
      expect(replayViewId).not.toBe(firstViewId);
      expect(beacons.map((b) => b.event)).toEqual(['viewStart', 'playRequest', 'videoStart']);
      expect(beacons.every((b) => b.videoId === mockConfig.videoId)).toBe(true);

      vi.advanceTimersByTime(1000);
      const heartbeat = beacons.find((b) => b.event === 'heartbeat');
      expect(heartbeat).toMatchObject({ viewId: replayViewId, watchTime: 1000 });

      await plugin.destroy();
    });

    it('reports the video set before init() in the first view', async () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      plugin.setVideo({ videoId: 'chosen-later' });
      await plugin.init(api);

      expect(beacons).toHaveLength(1);
      expect(beacons[0]).toMatchObject({ event: 'viewStart', videoId: 'chosen-later' });

      await plugin.destroy();
    });

    it('rejects setVideo() without a videoId', () => {
      const plugin = createAnalyticsPlugin({
        ...mockConfig,
        customBeacon: mockBeacon,
      });

      expect(() => plugin.setVideo({ videoId: '' })).toThrow('requires videoId');
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
      expect(typeof plugin.setVideo).toBe('function');
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

    /**
     * One header off the nth fetch call, looked up the way a server would.
     *
     * The request carries a `Headers`, not a plain object, so that a host's
     * own spelling of a field replaces ours rather than joining it; `get()` is
     * case-insensitive and returns null for a field that was never set.
     */
    const sentHeader = (call: number, name: string): string | null =>
      (fetchMock.mock.calls[call][1].headers as Headers).get(name);

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
      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-API-Key')).toBe('secret-key-123');
    });

    it('omits X-API-Key header when beaconUrl uses HTTP', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'http://insecure.example.com/analytics',
        videoId: 'insecure-vid',
        apiKey: 'secret-key-123',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-API-Key')).toBeNull();
    });

    it('omits X-API-Key header when apiKey is not provided', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'no-key-vid',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-API-Key')).toBeNull();
    });

    it('omits X-API-Key header when beaconUrl is not a valid HTTPS URL', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'ftp://files.example.com/analytics',
        videoId: 'ftp-vid',
        apiKey: 'secret-key-123',
      });

      await plugin.init(api);

      expect(fetchMock).toHaveBeenCalled();
      expect(sentHeader(0, 'X-API-Key')).toBeNull();
    });

    it('merges static headers over the defaults', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'static-headers-vid',
        apiKey: 'secret-key-123',
        headers: { 'X-CSRF-Token': 'csrf-1', 'X-Tenant': '42' },
      });

      await plugin.init(api);

      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-API-Key')).toBe('secret-key-123');
      expect(sentHeader(0, 'X-CSRF-Token')).toBe('csrf-1');
      expect(sentHeader(0, 'X-Tenant')).toBe('42');
    });

    it('lets a host override a base header whatever case it spells it in', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'case-headers-vid',
        apiKey: 'secret-key-123',
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-api-key': 'host-key' },
      });

      await plugin.init(api);

      // Merged as a plain object, both spellings would reach the request and
      // the server would read 'application/json, application/json; charset=utf-8'.
      expect(sentHeader(0, 'Content-Type')).toBe('application/json; charset=utf-8');
      expect(sentHeader(0, 'X-API-Key')).toBe('host-key');
    });

    it('resolves a headers function per beacon', async () => {
      let issued = 0;
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'fn-headers-vid',
        headers: async () => ({ 'X-CSRF-Token': `csrf-${++issued}` }),
      });

      await plugin.init(api);
      // The resolved path runs through a promise chain, which a synchronous
      // assertion here would miss - the static path above deliberately does
      // not. Draining the queue beats counting ticks: the chain's length is an
      // implementation detail (it grew one link so that a headers() throwing
      // synchronously lands in the same catch as one that rejects).
      await vi.advanceTimersByTimeAsync(0);

      plugin.trackEvent('custom-event');
      await vi.advanceTimersByTimeAsync(0);

      const tokens = fetchMock.mock.calls.map((_call: unknown, i: number) =>
        sentHeader(i, 'X-CSRF-Token')
      );
      // A rotating token is the reason the function form exists: each beacon
      // must carry the value current when it was sent.
      expect(tokens).toEqual(['csrf-1', 'csrf-2']);
    });

    it('still sends the beacon when headers() rejects', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'rejecting-headers-vid',
        headers: () => Promise.reject(new Error('token service down')),
      });

      await plugin.init(api);
      await vi.advanceTimersByTimeAsync(0);

      // Analytics is not worth losing over a token the server would refuse.
      expect(fetchMock).toHaveBeenCalled();
      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-CSRF-Token')).toBeNull();
    });

    it('still sends the beacon when headers() throws synchronously', async () => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://api.example.com/analytics',
        videoId: 'throwing-headers-vid',
        headers: () => {
          throw new Error('no CSRF cookie');
        },
      });

      // A throw from headers() is resolved inside the promise chain, so it
      // never escapes into the player event handler that triggered the beacon.
      await expect(plugin.init(api)).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalled();
      expect(sentHeader(0, 'Content-Type')).toBe('application/json');
      expect(sentHeader(0, 'X-CSRF-Token')).toBeNull();
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

    it('keeps the query string intact when the endpoint is a relative URL', async () => {
      sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      // A relative endpoint is HTTPS when the page is, which is how
      // isHttpsUrl() reads it - so the key is attached here too, and the URL
      // has to be built against the same base or it is not parseable at all.
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: new URL('https://app.example.com/watch'),
        configurable: true,
        writable: true,
      });

      try {
        const plugin = createAnalyticsPlugin({
          beaconUrl: '/analytics/beacon?tenant=42',
          videoId: 'relative-vid',
          apiKey: 'key-123',
        });

        await plugin.init(api);
        sendBeaconMock.mockClear();

        window.dispatchEvent(new Event('pagehide'));

        const urlUsed = new URL(sendBeaconMock.mock.calls[0][0], 'https://app.example.com');
        expect(urlUsed.pathname).toBe('/analytics/beacon');
        expect(urlUsed.searchParams.get('tenant')).toBe('42');
        expect(urlUsed.searchParams.get('api_key')).toBe('key-123');
      } finally {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
