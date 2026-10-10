import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

describe('Analytics Plugin Diagnostics', () => {
  let container: HTMLElement;
  let mockApi: IPluginAPI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockApi = {
      pluginId: 'analytics',
      container,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn((key: string) => {
        if (key === 'playbackState') return 'playing';
        if (key === 'playing') return true;
        if (key === 'paused') return false;
        if (key === 'currentTime') return 12.5;
        if (key === 'duration') return 120;
        if (key === 'volume') return 0.8;
        if (key === 'muted') return false;
        if (key === 'playbackRate') return 1.0;
        if (key === 'mediaType') return 'video';
        if (key === 'source') return { src: 'https://cdn.example.com/stream.m3u8?token=SECRET_123', type: 'application/x-mpegURL' };
        return null;
      }) as any,
      setState: vi.fn(),
      defineState: vi.fn(),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      getPlugin: vi.fn(() => null),
      onDestroy: vi.fn(),
      subscribeToState: vi.fn(() => vi.fn()),
      getProviderDiagnostics: vi.fn(() => ({
        'hls-provider': { engine: 'hls.js', bandwidthEstimate: 5000000 },
      })),
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  /** The handler analytics registered for core 'error' events on the mock API. */
  const errorHandler = (): ((err: unknown) => void) => {
    const call = (mockApi.on as any).mock.calls.find((c: unknown[]) => c[0] === 'error');
    expect(call).toBeDefined();
    return call[1];
  };

  it('exposes getDiagnostics before init with documented unavailable defaults', () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-init',
    });
    const diagnostics = plugin.getDiagnostics();

    expect(diagnostics).toBeDefined();
    expect(diagnostics.schemaVersion).toBe(1);
    expect(diagnostics.viewId).toBeNull();
    expect(diagnostics.playbackState.playbackState).toBe('destroyed');
    expect(diagnostics.providers).toEqual({});
    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.qoe.score).toBeNull();
    expect(diagnostics.qoe.version).toBe(2);
  });

  it('composes safe playback state, provider diagnostics, viewId, metrics, and QoE', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-123',
    });
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.schemaVersion).toBe(1);
    expect(typeof diagnostics.viewId).toBe('string');
    expect(diagnostics.playbackState.playbackState).toBe('playing');
    expect(diagnostics.playbackState.currentTime).toBe(12.5);
    expect(diagnostics.playbackState.source).toEqual({
      hostname: 'cdn.example.com',
      type: 'application/x-mpegURL',
    });
    expect(diagnostics.providers['hls-provider']).toEqual({
      engine: 'hls.js',
      bandwidthEstimate: 5000000,
    });
    expect(diagnostics.metrics).toBeDefined();
    expect(diagnostics.qoe.version).toBe(2);

    // Whitelist check: must NOT dump ViewSession secrets or custom dimensions
    const jsonStr = JSON.stringify(diagnostics);
    expect(jsonStr).not.toContain('SECRET_123');
    expect((diagnostics as any).sessionId).toBeUndefined();
    expect((diagnostics as any).userId).toBeUndefined();
    expect((diagnostics as any).customDimensions).toBeUndefined();
  });

  it('is synchronous and side-effect free (repeated calls do not mutate session or beacons)', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-456',
    });
    await plugin.init(mockApi);

    const emitSpy = vi.spyOn(mockApi, 'emit');
    const diag1 = plugin.getDiagnostics();
    const metrics1 = plugin.getMetrics();

    const diag2 = plugin.getDiagnostics();
    const metrics2 = plugin.getMetrics();

    expect(emitSpy).not.toHaveBeenCalled();
    expect(diag1.viewId).toBe(diag2.viewId);
    expect(metrics1.avgBitrate).toBe(metrics2.avgBitrate);
    expect(metrics1.watchTime).toBe(metrics2.watchTime);
    expect(metrics1.playTime).toBe(metrics2.playTime);
  });

  it('distinguishes open from settled play, pause, and outage durations', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-789',
    });
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(typeof diagnostics.metrics.playTime).toBe('number');
    expect(typeof diagnostics.metrics.settledPlayTime).toBe('number');
    expect(typeof diagnostics.metrics.pauseDuration).toBe('number');
    expect(typeof diagnostics.metrics.settledPauseDuration).toBe('number');
    expect(typeof diagnostics.metrics.reconnectDuration).toBe('number');
    expect(typeof diagnostics.metrics.settledReconnectDuration).toBe('number');
  });

  it('caps exported errors to max 20 without message secrets', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-err',
    });
    await plugin.init(mockApi);

    // Trigger 25 non-fatal core errors through the real 'error' subscription
    const coreError = errorHandler();
    for (let i = 0; i < 25; i++) {
      coreError({
        name: 'NetworkError',
        message: `Sensitive message token=xyz_${i}`,
        code: 'MEDIA_NETWORK_ERROR',
        fatal: false,
        detail: { httpStatus: 503 },
      });
    }

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics.errors.length).toBe(20);
    const jsonStr = JSON.stringify(diagnostics.errors);
    expect(jsonStr).not.toContain('Sensitive message');
    expect(jsonStr).not.toContain('token=xyz');
  });

  it('exports only known error codes and categories, never an error name or free string', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-err-enum',
    });
    await plugin.init(mockApi);

    const coreError = errorHandler();
    coreError({ name: 'TypeError', message: 'x', fatal: false });
    coreError({ name: 'Error', message: 'y', code: 'CUSTOM-SENTINEL', fatal: false });
    coreError({ name: 'Error', message: 'z', code: 'SOURCE_LOAD_FAILED', fatal: false });

    const known = new Set(['access', 'network', 'media', 'source', 'playback', 'player', 'unknown']);
    const errors = plugin.getDiagnostics().errors;
    expect(errors.map((e) => e.code)).toEqual(['UNKNOWN_ERROR', 'UNKNOWN_ERROR', 'SOURCE_LOAD_FAILED']);
    for (const e of errors) expect(known.has(e.category)).toBe(true);
    expect(JSON.stringify(errors)).not.toMatch(/TypeError|SENTINEL/);
  });

  it('returns unavailable snapshot after destroy', async () => {
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://beacon.example.com',
      videoId: 'vid-destroy',
    });
    await plugin.init(mockApi);
    await plugin.destroy();

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.viewId).toBeNull();
    expect(diagnostics.playbackState.playbackState).toBe('destroyed');
    expect(diagnostics.providers).toEqual({});
    expect(diagnostics.errors).toEqual([]);
  });

  it.each([
    [undefined],
    [null],
    [[1, 2] as unknown],
    [Promise.resolve({ a: 1 })],
    ['text' as unknown],
    [new (class X { a = 1 })() as unknown],
  ])(
    'rejects %p from getProviderDiagnostics, providers stays {}',
    async (badValue) => {
      const plugin = createAnalyticsPlugin({
        beaconUrl: 'https://beacon.example.com',
        videoId: 'vid-bad-provider',
      });
      (mockApi.getProviderDiagnostics as any).mockReturnValue(badValue);
      await plugin.init(mockApi);

      const diagnostics = plugin.getDiagnostics();
      expect(diagnostics.providers).toEqual({});
    }
  );
});
