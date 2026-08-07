/**
 * HLS plugin lifecycle tests (Phase 1 of fix/scarlett-error-absorption).
 *
 * Covers teardown unification and the load-session guard: destroy(),
 * loadSource() supersede, the load watchdog, the error-storm circuit
 * breaker, and reconnect races must never leave a load promise hanging,
 * fire a stale timer into a newer pipeline, or write state from a
 * superseded session.
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

describe('HLS plugin lifecycle', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: IPluginAPI;
  /** Every hls.js instance created during the test, in creation order. */
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC_A = 'http://example.com/a.m3u8';
  const SRC_B = 'http://example.com/b.m3u8';
  const SRC_C = 'http://example.com/c.m3u8';

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

  describe('destroy() with a load in flight', () => {
    it('settles the pending load promise instead of leaving it hanging', async () => {
      await plugin.init(api);

      const rejection = vi.fn();
      const loadPromise = plugin.loadSource(SRC_A);
      loadPromise.catch(rejection);
      await flush();
      expect(created).toHaveLength(1);

      await plugin.destroy();
      await flush();

      expect(rejection).toHaveBeenCalled();
      expect(created[0].instance.destroy).toHaveBeenCalled();
    });

    it('is idempotent: a second destroy() does not double-free the pipeline', async () => {
      await plugin.init(api);

      const loadPromise = plugin.loadSource(SRC_A);
      loadPromise.catch(() => {});
      await flush();

      await plugin.destroy();
      await plugin.destroy();

      expect(created[0].instance.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('load supersede (loadSource while a load is pending)', () => {
    it('settles the superseded load promise immediately', async () => {
      await plugin.init(api);

      const rejectionA = vi.fn();
      const promiseA = plugin.loadSource(SRC_A);
      promiseA.catch(rejectionA);
      await flush();

      const promiseB = plugin.loadSource(SRC_B);
      promiseB.catch(() => {});
      await flush();

      expect(rejectionA).toHaveBeenCalled();

      fireManifest(created[1]);
      await flush();
      await expect(promiseB).resolves.toBeUndefined();
    });

    it("does not let the superseded load's watchdog tear down the replacement pipeline", async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const promiseA = plugin.loadSource(SRC_A);
      promiseA.catch(() => {});
      await flush();

      // Let session A age so its watchdog deadline lands before B's
      await vi.advanceTimersByTimeAsync(10000);

      const promiseB = plugin.loadSource(SRC_B);
      promiseB.catch(() => {});
      await flush();
      expect(created).toHaveLength(2);

      // Cross A's original 30s watchdog deadline; B is only ~21s in
      await vi.advanceTimersByTimeAsync(21000);

      expect(created[1].instance.destroy).not.toHaveBeenCalled();

      fireManifest(created[1]);
      await flush();
      await expect(promiseB).resolves.toBeUndefined();
    });

    it('ignores a stale hls error event from the superseded session', async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const promiseA = plugin.loadSource(SRC_A);
      promiseA.catch(() => {});
      await flush();
      const stale = created[0];

      const promiseB = plugin.loadSource(SRC_B);
      promiseB.catch(() => {});
      await flush();

      (api.emit as ReturnType<typeof vi.fn>).mockClear();

      // Simulates an event queued before session A was torn down (the real
      // analog is an in-flight transmuxer/worker message landing late)
      fireError(stale, { type: 'networkError', details: 'fragLoadError', fatal: true });

      expect(api.emit).not.toHaveBeenCalledWith('error:network', expect.anything());

      // No retry may have been armed against session B's instance
      await vi.advanceTimersByTimeAsync(5000);
      expect(created[1].instance.startLoad).not.toHaveBeenCalled();

      fireManifest(created[1]);
      await flush();
      await expect(promiseB).resolves.toBeUndefined();
    });

    it('ignores a stale retry timer armed before the supersede', async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const promiseA = plugin.loadSource(SRC_A);
      promiseA.catch(() => {});
      await flush();

      // Fatal network error arms a backoff retry (default budget is 3)
      fireError(created[0], { type: 'networkError', details: 'fragLoadError', fatal: true });

      const promiseB = plugin.loadSource(SRC_B);
      promiseB.catch(() => {});
      await flush();

      // A's retry delay is ~0.7-1s; well past it, nothing may fire into B
      await vi.advanceTimersByTimeAsync(5000);
      expect(created[1].instance.startLoad).not.toHaveBeenCalled();
      expect(created[0].instance.startLoad).not.toHaveBeenCalled();
    });
  });

  describe('load watchdog', () => {
    it('tears down through the unified path and a fresh load recovers', async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const rejection = vi.fn();
      const promise = plugin.loadSource(SRC_A);
      promise.catch(rejection);
      await flush();

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      expect(video).toBeTruthy();
      const removeSpy = vi.spyOn(video, 'removeEventListener');

      await vi.advanceTimersByTimeAsync(30000);

      expect(rejection).toHaveBeenCalled();
      expect(String(rejection.mock.calls[0][0])).toMatch(/took too long/);
      expect(created[0].instance.destroy).toHaveBeenCalled();
      // Unified teardown also detaches the video element handlers
      expect(removeSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));

      // A fresh load after the watchdog fired must work
      const promise2 = plugin.loadSource(SRC_B);
      promise2.catch(() => {});
      await flush();
      fireManifest(created[1]);
      await flush();
      await expect(promise2).resolves.toBeUndefined();
    });
  });

  describe('error-storm circuit breaker', () => {
    it('settles the pending load, detaches video handlers, and clears armed retries', async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const rejection = vi.fn();
      const promise = plugin.loadSource(SRC_A);
      promise.catch(rejection);
      await flush();
      const c = created[0];

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      const removeSpy = vi.spyOn(video, 'removeEventListener');

      // A fatal network error arms a backoff retry...
      fireError(c, { type: 'networkError', details: 'fragLoadError', fatal: true });
      // ...then an error storm trips the breaker (10 errors in the window)
      for (let i = 0; i < 9; i++) {
        fireError(c, { type: 'mediaError', details: 'bufferAppendError', fatal: false });
      }
      await flush();

      expect(rejection).toHaveBeenCalled();
      expect(c.instance.destroy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));

      // The armed retry must not fire into the dead (or any future) pipeline
      await vi.advanceTimersByTimeAsync(5000);
      expect(c.instance.startLoad).not.toHaveBeenCalled();
    });
  });

  describe('auto-reconnect supersede', () => {
    it('a reconnect attempt superseded by a user load cannot revive itself or stomp the new session', async () => {
      vi.useFakeTimers();
      const reconnectPlugin = createHLSPlugin({ maxNetworkRetries: 0 });
      await reconnectPlugin.init(api);

      // Successful initial load (manifest parsed -> played content)
      const promiseA = reconnectPlugin.loadSource(SRC_A);
      await flush();
      fireManifest(created[0]);
      await flush();
      await promiseA;

      // Fatal mid-playback network error -> auto-reconnect gets scheduled
      fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });

      // Reconnect fires (base 2s with 70-100% jitter) and starts pipeline B,
      // which never gets a manifest
      await vi.advanceTimersByTimeAsync(2500);
      expect(created).toHaveLength(2);

      // The viewer starts a new load before the reconnect resolves
      const promiseC = reconnectPlugin.loadSource(SRC_C);
      promiseC.catch(() => {});
      await flush();
      fireManifest(created[2]);
      await flush();
      await promiseC;

      (api.emit as ReturnType<typeof vi.fn>).mockClear();

      // The stale reconnect pipeline's manifest arrives late: it must not
      // resolve the abandoned attempt into 'error:recovered' state writes
      fireManifest(created[1]);
      await flush();
      expect(api.emit).not.toHaveBeenCalledWith('error:recovered', undefined);

      // And the abandoned attempt must not respawn reconnect timers
      await vi.advanceTimersByTimeAsync(120000);
      expect(created).toHaveLength(3);

      await reconnectPlugin.destroy();
    });
  });
});
