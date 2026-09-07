/**
 * Provider switch tests (AirPlay connect/disconnect).
 *
 * `switchToNative()` and `switchToHlsJs()` tear the pipeline down with the
 * full `cleanup()`, which also drops the source identity. Neither reload
 * path re-sets it, so the source had to be restored explicitly: without it
 * the switch back bailed with 'No source loaded' and the viewer stayed on
 * native HLS for the rest of the session.
 *
 * `cleanup()` also leaves the reconnect timer armed, so both switches cancel
 * it: a reconnect scheduled against the pipeline being replaced would
 * otherwise fire into the new one and tear down a healthy player.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireManifest,
  fireError,
} from './helpers';

describe('HLS provider switches', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: IPluginAPI;
  /** Every hls.js instance created during the test, in creation order. */
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });
    // Safari: both pipelines are available, which is what AirPlay needs
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);

    plugin = createHLSPlugin();
    api = createMockAPI();

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** The video element the plugin created inside the mock container. */
  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  /** Load SRC through hls.js and settle the load. */
  const loadWithHlsJs = async (): Promise<void> => {
    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[created.length - 1]);
    await promise;
  };

  it('switches back to hls.js after a switch to native, on the same source', async () => {
    await plugin.init(api);
    await loadWithHlsJs();
    expect(plugin.isNativeHLS()).toBe(false);

    // AirPlay connects
    const toNative = plugin.switchToNative();
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await toNative;

    expect(plugin.isNativeHLS()).toBe(true);

    // AirPlay disconnects: the source must still be known, or this is a no-op
    const backToHlsJs = plugin.switchToHlsJs();
    await flush();
    fireManifest(created[created.length - 1]);
    await backToHlsJs;

    expect(plugin.isNativeHLS()).toBe(false);
    expect(created).toHaveLength(2);
    expect(created[1].instance.loadSource).toHaveBeenCalledWith(SRC);
    expect(api.logger.warn).not.toHaveBeenCalledWith('No source loaded');
  });

  it('drops a scheduled reconnect when a provider switch replaces the pipeline', async () => {
    vi.useFakeTimers();
    // maxNetworkRetries: 0 makes the first fatal network error terminal, so it
    // goes straight to the reconnect scheduler instead of an in-pipeline retry
    const reconnectPlugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await reconnectPlugin.init(api);

    const load = reconnectPlugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await load;

    // Mid-playback fatal network error arms the reconnect timer
    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });
    await flush();
    expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

    // AirPlay connects before the timer fires: the switch builds a fresh,
    // healthy native pipeline on the same source
    const toNative = reconnectPlugin.switchToNative();
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await toNative;
    expect(reconnectPlugin.isNativeHLS()).toBe(true);

    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    // Past every backoff the scheduler could have picked: the abandoned
    // reconnect must not fire into the pipeline that replaced it
    await vi.advanceTimersByTimeAsync(120000);

    expect(reconnectPlugin.isNativeHLS()).toBe(true);
    expect(created).toHaveLength(1);
    expect(api.emit).not.toHaveBeenCalledWith('error:reconnecting', expect.anything());
    expect(api.emit).not.toHaveBeenCalledWith('error:recovered', expect.anything());

    await reconnectPlugin.destroy();
  });
});
