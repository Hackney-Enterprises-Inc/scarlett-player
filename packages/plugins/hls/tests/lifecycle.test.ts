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

    /** Fatal `error` payloads emitted so far. */
    const fatalErrors = () =>
      (api.emit as ReturnType<typeof vi.fn>).mock.calls
        .filter(([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal)
        .map(([, payload]) => payload as { message: string; detail: Record<string, unknown> });

    it('reports a manifest timeout as timedOut and not exhausted', async () => {
      vi.useFakeTimers();
      await plugin.init(api);
      plugin.loadSource(SRC_A).catch(() => {});
      await flush();

      await vi.advanceTimersByTimeAsync(30000);

      expect(fatalErrors()).toHaveLength(1);
      // Same message as the native watchdog: no "HLS error:" prefix and no
      // "(max retries exceeded)" suffix, since no retry budget was spent
      expect(fatalErrors()[0].message).toBe('Video took too long to load (network timeout)');
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({ type: 'network', timedOut: true, retriesExhausted: false, attempts: 0 })
      );
    });

    it('reconnects after a manifest timeout and recovers on the next manifest', async () => {
      vi.useFakeTimers();
      await plugin.init(api);
      const rejection = vi.fn();
      plugin.loadSource(SRC_A).catch(rejection);
      await flush();

      await vi.advanceTimersByTimeAsync(30000);

      // load() still settles at the timeout; reconnect carries on behind it
      expect(rejection).toHaveBeenCalled();
      expect(fatalErrors()[0].detail).toEqual(expect.objectContaining({ reconnecting: true }));
      expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

      await vi.advanceTimersByTimeAsync(2000);
      expect(created).toHaveLength(2);
      expect(created[1].instance.loadSource).toHaveBeenCalledWith(SRC_A);

      fireManifest(created[1]);
      await flush();

      expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());
      expect(api.emit).toHaveBeenCalledWith('media:loaded', { src: SRC_A, type: 'application/x-mpegURL' });
      expect(fatalErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    /**
     * Review finding (Sol, P2): a synchronous listener loads source B from
     * inside A's timeout report. A's watchdog must neither tear B's pipeline
     * down nor schedule a reconnect against it.
     */
    it.each([
      ['the fatal error', 'error'],
      ['error:reconnecting', 'error:reconnecting'],
    ])('leaves a source loaded from %s listener alone', async (_label, trigger) => {
      vi.useFakeTimers();
      let swapped = false;
      (api.emit as ReturnType<typeof vi.fn>).mockImplementation((event: string) => {
        if (event === trigger && !swapped) {
          swapped = true;
          plugin.loadSource(SRC_B).catch(() => {});
        }
      });

      await plugin.init(api);
      plugin.loadSource(SRC_A).catch(() => {});
      await flush();
      await vi.advanceTimersByTimeAsync(30000);
      expect(swapped).toBe(true);
      await flush();

      expect(created).toHaveLength(2);
      expect(created[1].instance.destroy).not.toHaveBeenCalled();
      fireManifest(created[1]);
      await flush();

      const reconnects = (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([event]) => event === 'error:reconnecting'
      ).length;
      await vi.advanceTimersByTimeAsync(60000);

      expect(created).toHaveLength(2);
      expect(created[1].instance.destroy).not.toHaveBeenCalled();
      expect(
        (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(([event]) => event === 'error:reconnecting')
      ).toHaveLength(reconnects);
      expect(api.emit).not.toHaveBeenCalledWith('error:recovered', expect.anything());

      await plugin.destroy();
    });

    it("applies the viewer's audio state before announcing a reconnect recovery", async () => {
      vi.useFakeTimers();
      (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'live') return false;
        if (key === 'muted') return true;
        if (key === 'volume') return 0.25;
        if (key === 'paused') return true;
        return undefined;
      });
      const at_recovery: { muted?: boolean; volume?: number } = {};
      (api.emit as ReturnType<typeof vi.fn>).mockImplementation((event: string) => {
        if (event === 'error:recovered') {
          const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
          at_recovery.muted = video.muted;
          at_recovery.volume = video.volume;
        }
      });

      await plugin.init(api);
      plugin.loadSource(SRC_A).catch(() => {});
      await flush();

      await vi.advanceTimersByTimeAsync(30000);
      await vi.advanceTimersByTimeAsync(2000);
      fireManifest(created[1]);
      await flush();

      expect(at_recovery).toEqual({ muted: true, volume: 0.25 });

      await plugin.destroy();
    });
  });

  describe('error-storm circuit breaker', () => {
    it('non-fatal errors do not trip the breaker', async () => {
      vi.useFakeTimers();
      await plugin.init(api);

      const rejection = vi.fn();
      const promise = plugin.loadSource(SRC_A);
      promise.catch(rejection);
      await flush();
      const c = created[0];

      // Fire 20 non-fatal buffer errors — these are normal recovery actions
      // and must NOT accumulate toward the storm counter.
      for (let i = 0; i < 20; i++) {
        fireError(c, { type: 'mediaError', details: 'bufferAppendError', fatal: false });
      }
      await flush();

      // Pipeline must still be alive (no destroy called, promise still pending)
      expect(c.instance.destroy).not.toHaveBeenCalled();

      // Cancel the load so the test cleans up
      await plugin.destroy();
    });

    it('a single fatal error rejects the pending load', async () => {
      vi.useFakeTimers();
      // maxNetworkRetries: 0 makes the first fatal network error terminal
      const terminalPlugin = createHLSPlugin({ maxNetworkRetries: 0 });
      await terminalPlugin.init(api);

      const rejection = vi.fn();
      const promise = terminalPlugin.loadSource(SRC_A);
      promise.catch(rejection);
      await flush();
      const c = created[0];

      // A single fatal error is terminal when retries are exhausted
      fireError(c, { type: 'networkError', details: 'fragLoadError', fatal: true });
      await flush();

      expect(rejection).toHaveBeenCalled();
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
