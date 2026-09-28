/**
 * Native HLS retry budget tests (fix/scarlett-core-lifecycle Fix 2).
 *
 * The MSE branch absorbs transient network/media errors behind
 * maxNetworkRetries/maxMediaRetries. The native (Safari/iOS) path used to
 * declare the FIRST media element error fatal, so a decode hiccup flashed
 * the error overlay on a stream that recovered on its own moments later.
 * These tests pin the parity: absorb, reload, restore position, reset the
 * budget on `playing`, and only go fatal once the budget is spent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { createMockAPI, installMediaStubs, flush, fireVideoError } from './helpers';

/** MediaError codes used by the native classifier */
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/** Shape of the fatal `error` payload the assertions read. */
interface FatalPayload {
  fatal?: boolean;
  message?: string;
  detail?: Record<string, unknown>;
}

describe('native HLS retry budget', () => {
  let api: IPluginAPI;
  let live_state = false;

  const SRC = 'http://example.com/live/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    live_state = false;

    // Safari/iOS: native HLS only, no MSE
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);

    api = createMockAPI();
    (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'live') return live_state;
      return undefined;
    });

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

  /**
   * Drive a native load to completion by firing `loadedmetadata`, which is
   * what resolves loadNative() and attaches the fatal-error listener.
   */
  const completeNativeLoad = async (): Promise<void> => {
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
  };

  /** Give the video element a writable currentTime (jsdom leaves it at 0). */
  const stubCurrentTime = (value: number): void => {
    Object.defineProperty(getVideo(), 'currentTime', {
      value,
      writable: true,
      configurable: true,
    });
  };

  /** Assert whether a fatal `error` event was emitted. */
  const fatalErrorEmitted = (): boolean =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls.some(
      ([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal
    );

  /** Every fatal `error` payload emitted so far. */
  const fatalErrors = (): FatalPayload[] =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter(([event, payload]) => event === 'error' && (payload as FatalPayload)?.fatal)
      .map(([, payload]) => payload as FatalPayload);

  /** How many times the element was told to (re)load its source. */
  const loadCalls = (): number =>
    (HTMLVideoElement.prototype.load as ReturnType<typeof vi.fn>).mock.calls.length;

  /**
   * Start a native load without completing it.
   *
   * @param config - Plugin configuration overrides
   * @returns The plugin and a record of how the load promise settled
   */
  const startNativeLoad = async (config: Record<string, unknown> = {}) => {
    const plugin = createHLSPlugin({ autoReconnect: false, ...config });
    await plugin.init(api);
    const outcome: { status: 'pending' | 'resolved' | 'rejected'; error?: Error } = {
      status: 'pending',
    };
    plugin.loadSource(SRC).then(
      () => {
        outcome.status = 'resolved';
      },
      (error: Error) => {
        outcome.status = 'rejected';
        outcome.error = error;
      }
    );
    await flush();
    return { plugin, outcome };
  };

  /**
   * Load a source natively and settle the initial load.
   *
   * @param config - Plugin configuration overrides
   */
  const loadNatively = async (config: Record<string, unknown> = {}) => {
    const plugin = createHLSPlugin({ autoReconnect: false, ...config });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await completeNativeLoad();
    await promise;
    return plugin;
  };

  it('absorbs the first decode error instead of declaring it fatal', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 2 });

    fireVideoError(getVideo(), MEDIA_ERR_DECODE, 'decode hiccup');
    await flush();

    expect(fatalErrorEmitted()).toBe(false);
    expect(api.emit).toHaveBeenCalledWith('error:media', expect.anything());

    await plugin.destroy();
  });

  it('absorbs the first MEDIA_ERR_NETWORK instead of declaring it fatal', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxNetworkRetries: 3 });

    fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'network dropped');
    await flush();

    expect(fatalErrorEmitted()).toBe(false);
    expect(api.emit).toHaveBeenCalledWith('error:network', expect.anything());

    await plugin.destroy();
  });

  it('reloads the source and restores position after an absorbed error', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 2 });

    const video = getVideo();
    stubCurrentTime(137);
    (HTMLVideoElement.prototype.load as ReturnType<typeof vi.fn>).mockClear();

    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');

    // Recovery is scheduled on the retry backoff (0.7-1s for attempt 1)
    await vi.advanceTimersByTimeAsync(1200);

    expect(video.load).toHaveBeenCalled();
    expect(video.src).toContain('/live/stream.m3u8');

    // The reload completes when metadata arrives, and only then is the
    // viewer's position (captured at the failure) restored
    stubCurrentTime(0);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();

    expect(video.currentTime).toBe(137);
    expect(api.setState).toHaveBeenCalledWith('playbackState', 'ready');
    expect(fatalErrorEmitted()).toBe(false);

    await plugin.destroy();
  });

  it('rejoins the live edge rather than restoring position for a live stream', async () => {
    vi.useFakeTimers();
    live_state = true;
    const plugin = await loadNatively({ maxMediaRetries: 2 });

    const video = getVideo();
    stubCurrentTime(137);

    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
    await vi.advanceTimersByTimeAsync(1200);

    stubCurrentTime(0);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();

    // No seek back: a live viewer wants the edge, not where the blip hit
    expect(video.currentTime).toBe(0);

    await plugin.destroy();
  });

  it('emits fatal with the retries-exceeded suffix once the media budget is spent', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 1 });

    const video = getVideo();

    // First error is absorbed and recovery reloads the source
    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
    await vi.advanceTimersByTimeAsync(1200);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(fatalErrorEmitted()).toBe(false);

    // Second error has no budget left
    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
    await flush();

    expect(api.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        fatal: true,
        message: expect.stringContaining('(max retries exceeded)'),
      })
    );

    await plugin.destroy();
  });

  it('emits fatal once the network budget is spent', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxNetworkRetries: 1 });

    const video = getVideo();

    fireVideoError(video, MEDIA_ERR_NETWORK, 'network dropped');
    await vi.advanceTimersByTimeAsync(1200);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(fatalErrorEmitted()).toBe(false);

    fireVideoError(video, MEDIA_ERR_NETWORK, 'network dropped');
    await flush();

    expect(api.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        fatal: true,
        message: expect.stringContaining('(max retries exceeded)'),
        detail: expect.objectContaining({ type: 'network', retriesExhausted: true }),
      })
    );

    await plugin.destroy();
  });

  it('goes fatal immediately when the budget is configured to zero', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 0 });

    fireVideoError(getVideo(), MEDIA_ERR_DECODE, 'decode hiccup');
    await flush();

    expect(fatalErrorEmitted()).toBe(true);

    await plugin.destroy();
  });

  it('resets both budgets once playback is flowing again', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 1, maxNetworkRetries: 1 });

    const video = getVideo();

    // Spend the media budget, recover, then confirm playback resumed
    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
    await vi.advanceTimersByTimeAsync(1200);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();
    video.dispatchEvent(new Event('playing'));
    await flush();

    // Budget restored: the next error is absorbed rather than fatal
    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
    await flush();

    expect(fatalErrorEmitted()).toBe(false);

    await plugin.destroy();
  });

  it('does not recover into a session superseded by a user load', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxMediaRetries: 2 });

    const video = getVideo();
    fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');

    // A viewer switches source before the scheduled recovery fires
    const promise = plugin.loadSource('http://example.com/other.m3u8');
    promise.catch(() => {});
    await completeNativeLoad();
    await promise;

    (HTMLVideoElement.prototype.load as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(5000);

    // The stale recovery must not reload the abandoned source
    expect(video.load).not.toHaveBeenCalled();
    expect(video.src).toContain('/other.m3u8');

    await plugin.destroy();
  });

  it('keeps MEDIA_ERR_SRC_NOT_SUPPORTED on the media budget once playing', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively({ maxNetworkRetries: 0, maxMediaRetries: 2 });

    fireVideoError(getVideo(), MEDIA_ERR_SRC_NOT_SUPPORTED, 'segment unsupported');
    await flush();

    expect(fatalErrorEmitted()).toBe(false);
    expect(api.emit).toHaveBeenCalledWith('error:media', expect.anything());

    await plugin.destroy();
  });

  /**
   * SCAR-HLS-4: an error BEFORE `loadedmetadata` used to reject the load with
   * a plain Error on the first element error, so the budgets above never
   * applied to the first load and core filed it as SOURCE_LOAD_FAILED with
   * the MediaError code lost (Sentry TSP-WEB-2JJ, TSP-WEB-2JS).
   */
  describe('initial load', () => {
    it('retries MEDIA_ERR_NETWORK up to maxNetworkRetries, then emits one structured fatal', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ maxNetworkRetries: 3 });
      const video = getVideo();
      expect(loadCalls()).toBe(1);

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(1100);
      expect(loadCalls()).toBe(2);
      expect(video.src).toContain('/live/stream.m3u8');
      expect(outcome.status).toBe('pending');

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(2100);
      expect(loadCalls()).toBe(3);

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(4100);
      expect(loadCalls()).toBe(4);
      expect(fatalErrors()).toHaveLength(0);

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await flush();

      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({
          type: 'network',
          mediaErrorCode: MEDIA_ERR_NETWORK,
          mediaErrorMessage: 'manifest 503',
          attempts: 3,
          retriesExhausted: true,
        })
      );
      expect(outcome.status).toBe('rejected');
      expect(loadCalls()).toBe(4);

      await plugin.destroy();
    });

    it('spends the network budget on MEDIA_ERR_SRC_NOT_SUPPORTED: fatal at once with none', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        maxNetworkRetries: 0,
        maxMediaRetries: 2,
      });

      fireVideoError(getVideo(), MEDIA_ERR_SRC_NOT_SUPPORTED, 'manifest 403');
      await vi.advanceTimersByTimeAsync(5000);

      expect(loadCalls()).toBe(1);
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({
          type: 'network',
          mediaErrorCode: MEDIA_ERR_SRC_NOT_SUPPORTED,
          retriesExhausted: true,
        })
      );
      expect(outcome.status).toBe('rejected');

      await plugin.destroy();
    });

    it('spends the network budget on MEDIA_ERR_SRC_NOT_SUPPORTED: retries twice with two', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        maxNetworkRetries: 2,
        maxMediaRetries: 0,
      });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_SRC_NOT_SUPPORTED, 'manifest 403');
      await vi.advanceTimersByTimeAsync(1100);
      fireVideoError(video, MEDIA_ERR_SRC_NOT_SUPPORTED, 'manifest 403');
      await vi.advanceTimersByTimeAsync(2100);

      expect(loadCalls()).toBe(3);
      expect(fatalErrors()).toHaveLength(0);
      expect(api.emit).toHaveBeenCalledWith('error:network', expect.anything());

      fireVideoError(video, MEDIA_ERR_SRC_NOT_SUPPORTED, 'manifest 403');
      await flush();

      expect(fatalErrors()).toHaveLength(1);
      expect(outcome.status).toBe('rejected');

      await plugin.destroy();
    });

    it('spends the media budget on MEDIA_ERR_DECODE: fatal at once with none', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        maxNetworkRetries: 2,
        maxMediaRetries: 0,
      });

      fireVideoError(getVideo(), MEDIA_ERR_DECODE, 'bad init segment');
      await vi.advanceTimersByTimeAsync(5000);

      expect(loadCalls()).toBe(1);
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({
          type: 'media',
          mediaErrorCode: MEDIA_ERR_DECODE,
          mediaErrorMessage: 'bad init segment',
          retriesExhausted: true,
        })
      );
      expect(outcome.status).toBe('rejected');

      await plugin.destroy();
    });

    it('spends the media budget on MEDIA_ERR_DECODE: retries twice with two', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        maxNetworkRetries: 0,
        maxMediaRetries: 2,
      });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_DECODE, 'bad init segment');
      await vi.advanceTimersByTimeAsync(1100);
      fireVideoError(video, MEDIA_ERR_DECODE, 'bad init segment');
      await vi.advanceTimersByTimeAsync(2100);

      expect(loadCalls()).toBe(3);
      expect(fatalErrors()).toHaveLength(0);
      expect(api.emit).toHaveBeenCalledWith('error:media', expect.anything());

      fireVideoError(video, MEDIA_ERR_DECODE, 'bad init segment');
      await flush();

      expect(fatalErrors()).toHaveLength(1);
      expect(outcome.status).toBe('rejected');

      await plugin.destroy();
    });

    it('resolves when a retry succeeds and leaves the budgets reset', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ maxNetworkRetries: 1 });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(1100);
      video.dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(outcome.status).toBe('resolved');
      expect(fatalErrors()).toHaveLength(0);

      // The one network retry was spent on the load; playback starts fresh
      fireVideoError(video, MEDIA_ERR_NETWORK, 'network dropped');
      await flush();

      expect(fatalErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('cancels the pending retry when a new load supersedes it', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ maxNetworkRetries: 3 });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await flush();
      expect(outcome.status).toBe('pending');

      const next = plugin.loadSource('http://example.com/other.m3u8');
      next.catch(() => {});
      await flush();
      expect(loadCalls()).toBe(2);

      await vi.advanceTimersByTimeAsync(5000);

      expect(loadCalls()).toBe(2);
      expect(video.src).toContain('/other.m3u8');
      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('cancels the pending retry on destroy', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ maxNetworkRetries: 3 });

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'manifest 503');
      await flush();
      expect(outcome.status).toBe('pending');

      await plugin.destroy();
      await vi.advanceTimersByTimeAsync(5000);

      expect(loadCalls()).toBe(1);
      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(0);
    });

    it('lets the watchdog win during a backoff: no further attempt, one structured timeout', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        maxNetworkRetries: 3,
        retryDelayMs: 4000,
        loadTimeoutMs: 2000,
      });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(2000);

      expect(outcome.status).toBe('rejected');
      expect(outcome.error?.message).toBe('Video took too long to load (network timeout)');
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].message).toBe('Video took too long to load (network timeout)');
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({
          timedOut: true,
          attempts: 1,
          mediaErrorCode: MEDIA_ERR_NETWORK,
          mediaErrorMessage: 'manifest 503',
        })
      );

      const src_after_timeout = video.src;
      await vi.advanceTimersByTimeAsync(10000);

      expect(loadCalls()).toBe(1);
      expect(video.src).toBe(src_after_timeout);
      expect(fatalErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('reports a watchdog timeout before any error without media error fields', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ loadTimeoutMs: 2000 });

      await vi.advanceTimersByTimeAsync(2000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      const detail = fatalErrors()[0].detail;
      expect(detail).toEqual(expect.objectContaining({ timedOut: true, attempts: 0 }));
      expect(detail).not.toHaveProperty('mediaErrorCode');
      expect(detail).not.toHaveProperty('mediaErrorMessage');

      await plugin.destroy();
    });

    it('never emits the fatal twice when a mid-play recovery reload fails', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxMediaRetries: 1, maxNetworkRetries: 1 });
      const video = getVideo();

      // Mid-play error: recovery reloads through loadNative()
      fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
      await vi.advanceTimersByTimeAsync(1200);

      // The reload itself fails before metadata, which spends what is left
      fireVideoError(video, MEDIA_ERR_DECODE, 'decode hiccup');
      await vi.advanceTimersByTimeAsync(10000);

      expect(fatalErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('still rejects promptly when a live failure hands off to auto-reconnect', async () => {
      vi.useFakeTimers();
      live_state = true;
      // Deliver the `live` state write so the plugin treats the source as
      // classified live, which is what lets reconnect run before first play
      const listeners: Array<(event: { key: string }) => void> = [];
      (api.subscribeToState as ReturnType<typeof vi.fn>).mockImplementation(
        (listener: (event: { key: string }) => void) => {
          listeners.push(listener);
          return vi.fn();
        }
      );

      const { plugin, outcome } = await startNativeLoad({
        autoReconnect: true,
        maxNetworkRetries: 0,
      });
      listeners.forEach((listener) => listener({ key: 'live' }));

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'manifest 404');
      await flush();

      expect(fatalErrors()).toHaveLength(1);
      expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());
      expect(outcome.status).toBe('rejected');

      await plugin.destroy();
    });
  });
});
