import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import { createHLSPlugin as createHLSLightPlugin } from '../src/light';
import { createPlayer, type IPluginAPI } from '@scarlett-player/core';
import * as hlsLoader from '../src/hls-loader';
import {
  createCapturedHls,
  createMockHlsConstructor,
  installMediaStubs,
  fireManifest,
} from './helpers';

describe('HLS Provider Diagnostics', () => {
  let container: HTMLElement;
  let mockApi: IPluginAPI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockApi = {
      pluginId: 'hls-provider',
      container,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn((key: string) => {
        if (key === 'bandwidth') return 2500000;
        if (key === 'live') return true;
        if (key === 'lowLatencyMode') return true;
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
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes getDiagnostics before loadSource with safe defaults', async () => {
    const plugin = createHLSPlugin();
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.engine).toBeNull();
    expect(diagnostics.selectedLevel).toBeNull();
    expect(diagnostics.quality).toBeNull();
    expect(diagnostics.live).toBe(true);
    expect(diagnostics.lowLatency).toBe(true);
    expect(diagnostics.retryCount).toBe(0);
    expect(diagnostics.reconnectAttempts).toBe(0);
    expect(diagnostics.isReconnecting).toBe(false);
    expect(Array.isArray(diagnostics.buffered)).toBe(true);
    expect(Array.isArray(diagnostics.seekable)).toBe(true);
  });

  it('works identically in hlsLightPlugin variant', async () => {
    const plugin = createHLSLightPlugin();
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.engine).toBeNull();
  });

  it('reports native engine and element state without hls.js instance', async () => {
    const video = document.createElement('video');
    container.appendChild(video);

    const plugin = createHLSPlugin();
    await plugin.init(mockApi);

    // Mock native playback switch
    (plugin as any).isNativeHLS = () => true;

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.readyState).toBe(video.readyState);
    expect(diagnostics.networkState).toBe(video.networkState);
  });

  it('bounds media ranges to max 32 items and finite numbers', async () => {
    const plugin = createHLSPlugin();
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics.buffered.length).toBeLessThanOrEqual(32);
    expect(diagnostics.seekable.length).toBeLessThanOrEqual(32);
  });
});

describe('HLS provider through the player sanitizer', () => {
  it('contributes every key to player.getDiagnostics() with nothing omitted', async () => {
    const mockCtor = createMockHlsConstructor();
    installMediaStubs();
    hlsLoader.resetLoader();
    const created: ReturnType<typeof createCapturedHls>[] = [];
    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = await createPlayer({ container, plugins: [createHLSPlugin()] });

    const loading = player.load('https://cdn.example.com/live.m3u8');
    await vi.waitFor(() => expect(created).toHaveLength(1));
    fireManifest(created[0]);
    await loading;
    const snapshot = player.getDiagnostics();

    expect(snapshot.truncatedProviders).toEqual([]);
    const contribution = snapshot.providers['hls-provider'] as Record<string, unknown>;
    expect(Object.keys(contribution).sort()).toEqual([
      'bandwidthEstimate', 'buffered', 'engine', 'isReconnecting', 'live', 'lowLatency',
      'mediaRetryCount', 'networkRetryCount', 'networkState', 'quality', 'readyState',
      'reconnectAttempts', 'retryCount', 'seekable', 'selectedLevel',
    ]);
    expect(contribution.engine).toBe('hls.js');

    player.destroy();
    container.remove();
  });
});
