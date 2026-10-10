import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayer } from '@scarlett-player/core';
import { createNativePlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

describe('Native Provider Diagnostics', () => {
  let container: HTMLElement;
  let mockApi: IPluginAPI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockApi = {
      pluginId: 'native-provider',
      container,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn((key: string) => {
        if (key === 'volume') return 1.0;
        if (key === 'muted') return false;
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
    const plugin = createNativePlugin();
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.readyState).toBeNull();
    expect(diagnostics.networkState).toBeNull();
    expect(diagnostics.dimensions).toBeNull();
    expect(diagnostics.buffered).toEqual([]);
    expect(diagnostics.seekable).toEqual([]);
  });

  it('reports element state and dimensions when video element exists', async () => {
    const video = document.createElement('video');
    container.appendChild(video);

    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    Object.defineProperty(video, 'networkState', { value: 1, configurable: true });
    video.src = 'https://secret.cdn.example.com/stream.mp4?token=supersecret123';

    const plugin = createNativePlugin();
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics.readyState).toBe(4);
    expect(diagnostics.networkState).toBe(1);
    expect(diagnostics.dimensions).toEqual({ width: 1920, height: 1080 });

    // Must never leak currentSrc, src or URLs
    const str = JSON.stringify(diagnostics);
    expect(str).not.toContain('secret.cdn.example.com');
    expect(str).not.toContain('supersecret123');
    expect((diagnostics as any).src).toBeUndefined();
    expect((diagnostics as any).currentSrc).toBeUndefined();
  });

  it('returns safe values after destroy', async () => {
    const plugin = createNativePlugin();
    await plugin.init(mockApi);
    await plugin.destroy();

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.dimensions).toBeNull();
    expect(diagnostics.readyState).toBeNull();
  });
});

describe('Native provider through the player sanitizer', () => {
  it('contributes every key to player.getDiagnostics() with nothing omitted', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const player = await createPlayer({ container, plugins: [createNativePlugin()] });

    const loading = player.load('https://cdn.example.com/video.mp4');
    await vi.waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const video = container.querySelector('video') as HTMLVideoElement;
    await vi.waitFor(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
      return loading.then(() => undefined);
    });
    await loading;
    const snapshot = player.getDiagnostics();

    expect(snapshot.truncatedProviders).toEqual([]);
    expect(Object.keys(snapshot.providers['native-provider'] as object).sort()).toEqual([
      'buffered',
      'dimensions',
      'networkState',
      'readyState',
      'seekable',
    ]);

    player.destroy();
    container.remove();
  });
});
