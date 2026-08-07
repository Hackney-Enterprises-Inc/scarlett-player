/**
 * Light-build smoke tests (Phase 5 of fix/scarlett-error-absorption).
 *
 * The light entry used to be a hand-maintained fork of the full plugin
 * that silently missed the 1.1.x hardening: its load promise hung forever
 * when retries were exhausted (the original endless-spinner bug), it
 * emitted an error code that was not a member of ErrorCode, and it had no
 * watchdog, reconnect, or playlist validation. Both entries now wrap the
 * same factory; these tests pin the behaviors that used to drift.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin as createLightPlugin } from '../src/light';
import * as lightLoader from '../src/hls-loader-light';
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

describe('HLS light entry', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    lightLoader.resetLoader();
    created = [];
    installMediaStubs();

    vi.spyOn(lightLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(lightLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(lightLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });

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

  it('carries the light metadata', () => {
    const plugin = createLightPlugin();

    expect(plugin.id).toBe('hls-provider');
    expect(plugin.name).toBe('HLS Provider (Light)');
    expect(plugin.description).toContain('hls.js/light');
  });

  it('rejects (not hangs) when network retries are exhausted - the old endless-spinner bug', async () => {
    const plugin = createLightPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    fireError(created[0], { type: 'networkError', details: 'manifestLoadError', fatal: true });

    await expect(promise).rejects.toThrow('manifestLoadError');
  });

  it('emits a real ErrorCode member instead of the out-of-enum MEDIA_ERROR string', async () => {
    const plugin = createLightPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    fireError(created[0], { type: 'networkError', details: 'manifestLoadError', fatal: true });
    await flush();

    expect(api.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: ErrorCode.MEDIA_NETWORK_ERROR, fatal: true })
    );
    expect(api.emit).not.toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'MEDIA_ERROR' })
    );
  });

  it('has the load watchdog (a silent load rejects instead of spinning forever)', async () => {
    vi.useFakeTimers();
    const plugin = createLightPlugin();
    await plugin.init(api);

    const rejection = vi.fn();
    const promise = plugin.loadSource(SRC);
    promise.catch(rejection);
    await flush();

    await vi.advanceTimersByTimeAsync(30000);

    expect(rejection).toHaveBeenCalled();
    expect(String(rejection.mock.calls[0][0])).toMatch(/took too long/);
  });

  it('has auto-reconnect (schedules recovery after a mid-playback fatal error)', async () => {
    vi.useFakeTimers();
    const plugin = createLightPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;

    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });

    expect(api.emit).toHaveBeenCalledWith(
      'error:reconnecting',
      expect.objectContaining({ attempt: 1 })
    );

    await plugin.destroy();
  });

  it('installs the validating pLoader by default', async () => {
    const plugin = createLightPlugin();
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    const config = (lightLoader.createHlsInstance as any).mock.calls[0][0];
    expect(config.pLoader).toEqual(expect.any(Function));
  });
});
