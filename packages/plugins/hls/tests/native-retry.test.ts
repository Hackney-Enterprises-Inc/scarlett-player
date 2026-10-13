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

      // The stalled fetch is aborted (src removed, element reloaded empty)
      // and nothing re-requests the source afterwards
      expect(video.hasAttribute('src')).toBe(false);
      expect(loadCalls()).toBe(2);
      await vi.advanceTimersByTimeAsync(10000);

      expect(loadCalls()).toBe(2);
      expect(video.hasAttribute('src')).toBe(false);
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).not.toHaveProperty('reconnecting');

      await plugin.destroy();
    });

    it('lets the watchdog win during a backoff and hands the timeout to auto-reconnect', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        autoReconnect: true,
        maxNetworkRetries: 3,
        retryDelayMs: 4000,
        loadTimeoutMs: 2000,
      });
      const video = getVideo();

      fireVideoError(video, MEDIA_ERR_NETWORK, 'manifest 503');
      await vi.advanceTimersByTimeAsync(2000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({ timedOut: true, attempts: 1, reconnecting: true })
      );
      expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

      // The in-load retry stays cancelled; only the reconnect re-requests
      await vi.advanceTimersByTimeAsync(2000);
      expect(loadCalls()).toBe(3);
      expect(video.getAttribute('src')).toBe(SRC);

      await plugin.destroy();
    });

    it('reports a watchdog timeout before any error without media error fields', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ loadTimeoutMs: 2000 });

      await vi.advanceTimersByTimeAsync(2000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      const detail = fatalErrors()[0].detail;
      expect(detail).toEqual(
        expect.objectContaining({ timedOut: true, attempts: 0, retriesExhausted: false })
      );
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

  /**
   * HEI-SCARLETT-57 (Sentry TSP-WEB-2G9): a stalled Safari load never fires
   * `error`, so the 30 s watchdog is what ends it. Live is only classified
   * after metadata, so the timeout used to be a dead-end fatal even on a live
   * stream. A timeout now hands off to auto-reconnect: a stall is transient,
   * and the unclassified window stays finite (`reconnectWindowMs`).
   */
  /**
   * Review finding (Sol, P2): A's metadata settles A's load, and B starts in
   * the microtasks before A's loadSource() continuation runs. A must not then
   * write `ready` (or audio state) into B, which has no metadata yet. Tried at
   * several microtask depths so it does not hinge on how many awaits the
   * chain has.
   */
  it('never writes ready into a load that superseded it after its metadata', async () => {
    for (let depth = 0; depth <= 8; depth++) {
      (api.setState as ReturnType<typeof vi.fn>).mockClear();
      const { plugin } = await startNativeLoad();

      const startB = () => {
        plugin.loadSource('http://example.com/other.m3u8').catch(() => {});
      };
      let schedule = startB;
      for (let i = 0; i < depth; i++) {
        const next = schedule;
        schedule = () => queueMicrotask(next);
      }

      getVideo().dispatchEvent(new Event('loadedmetadata'));
      queueMicrotask(schedule);
      await flush();
      await flush();

      const writes = (api.setState as ReturnType<typeof vi.fn>).mock.calls
        .filter(([key]) => key === 'playbackState')
        .map(([, value]) => value);
      const last_loading = writes.lastIndexOf('loading');
      expect({ depth, after: writes.slice(last_loading + 1) }).toEqual({ depth, after: [] });

      await plugin.destroy();
    }
  });

  describe('native load timeout', () => {
    const TIMEOUT = 30000;

    /** Payloads of every emit of one event, in order. */
    const emitted = (event: string): unknown[] =>
      (api.emit as ReturnType<typeof vi.fn>).mock.calls
        .filter(([name]) => name === event)
        .map(([, payload]) => payload);

    it('hands a stalled initial load to auto-reconnect', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ autoReconnect: true });

      await vi.advanceTimersByTimeAsync(TIMEOUT);

      expect(outcome.status).toBe('rejected');
      expect(outcome.error?.message).toBe('Video took too long to load (network timeout)');
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].message).toBe('Video took too long to load (network timeout)');
      expect(fatalErrors()[0].detail).toEqual(
        expect.objectContaining({
          timedOut: true,
          attempts: 0,
          retriesExhausted: false,
          reconnecting: true,
        })
      );
      expect(emitted('error:reconnecting')).toHaveLength(1);

      // Backoff for attempt 1 is at most 2 s (2000 ms x 0.7-1.0 jitter)
      await vi.advanceTimersByTimeAsync(2000);
      expect(loadCalls()).toBe(3); // initial, abort, reconnect
      expect(getVideo().getAttribute('src')).toBe(SRC);

      await plugin.destroy();
    });

    it('recovers when a reconnect attempt reaches metadata', async () => {
      vi.useFakeTimers();
      const { plugin } = await startNativeLoad({ autoReconnect: true });

      await vi.advanceTimersByTimeAsync(TIMEOUT);
      await vi.advanceTimersByTimeAsync(2000);
      (api.setState as ReturnType<typeof vi.fn>).mockClear();

      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(emitted('error:recovered')).toHaveLength(1);
      expect(emitted('media:loaded')).toHaveLength(1);
      const playback_states = (api.setState as ReturnType<typeof vi.fn>).mock.calls
        .filter(([key]) => key === 'playbackState')
        .map(([, value]) => value);
      expect(playback_states.at(-1)).toBe('ready');
      expect(fatalErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it("applies the viewer's audio state before announcing the recovery", async () => {
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
          at_recovery.muted = getVideo().muted;
          at_recovery.volume = getVideo().volume;
        }
      });

      const { plugin } = await startNativeLoad({ autoReconnect: true });
      expect(getVideo().muted).toBe(false);

      await vi.advanceTimersByTimeAsync(TIMEOUT);
      await vi.advanceTimersByTimeAsync(2000);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(at_recovery).toEqual({ muted: true, volume: 0.25 });

      await plugin.destroy();
    });

    it('aborts the stalled element fetch, so a late loadedmetadata loads nothing', async () => {
      vi.useFakeTimers();
      const { plugin } = await startNativeLoad({ autoReconnect: true });
      const video = getVideo();

      await vi.advanceTimersByTimeAsync(TIMEOUT);

      expect(video.hasAttribute('src')).toBe(false);
      expect(loadCalls()).toBe(2);

      // Before the reconnect fires
      video.dispatchEvent(new Event('loadedmetadata'));
      await flush();
      expect(emitted('media:loaded')).toHaveLength(0);

      await plugin.destroy();
    });

    it('stays terminal with autoReconnect: false', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({ autoReconnect: false });

      await vi.advanceTimersByTimeAsync(TIMEOUT);
      await vi.advanceTimersByTimeAsync(60000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).not.toHaveProperty('reconnecting');
      expect(emitted('error:reconnecting')).toHaveLength(0);
      // The initial load and the abort, nothing after
      expect(loadCalls()).toBe(2);
      expect(getVideo().hasAttribute('src')).toBe(false);

      await plugin.destroy();
    });

    it('gives up once reconnectWindowMs has passed', async () => {
      vi.useFakeTimers();
      const { plugin } = await startNativeLoad({
        autoReconnect: true,
        loadTimeoutMs: 2000,
        reconnectBaseDelayMs: 1000,
        reconnectMaxDelayMs: 2000,
        reconnectWindowMs: 10000,
      });

      await vi.advanceTimersByTimeAsync(60000);

      expect(emitted('error:reconnect-exhausted')).toHaveLength(1);
      const finals = fatalErrors().filter((e) => e.detail?.reconnectExhausted === true);
      expect(finals).toHaveLength(1);
      // The timeout that opened the window, then the final one
      expect(fatalErrors()).toHaveLength(2);

      await plugin.destroy();
    });

    /**
     * Review finding (Sol, P2): a host's synchronous listener loads a backup
     * source B from inside A's timeout report. A's reconnect must not attach
     * to B: B loads on its own and nothing tears it down afterwards.
     */
    it.each([
      ['the fatal error', 'error'],
      ['error:reconnecting', 'error:reconnecting'],
    ])('does not reconnect into a source loaded from %s listener', async (_label, trigger) => {
      vi.useFakeTimers();
      const SRC_B = 'http://example.com/backup.m3u8';
      let target: ReturnType<typeof createHLSPlugin> | null = null;
      let swapped = false;
      (api.emit as ReturnType<typeof vi.fn>).mockImplementation((event: string) => {
        if (event === trigger && !swapped && target) {
          swapped = true;
          target.loadSource(SRC_B).catch(() => {});
        }
      });

      const { plugin } = await startNativeLoad({ autoReconnect: true });
      target = plugin;
      await vi.advanceTimersByTimeAsync(TIMEOUT);
      expect(swapped).toBe(true);

      // B gets its metadata and is healthy
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      expect(getVideo().getAttribute('src')).toBe(SRC_B);
      const loads_after_b = loadCalls();
      const reconnecting_after_b = emitted('error:reconnecting').length;
      (api.setState as ReturnType<typeof vi.fn>).mockClear();

      await vi.advanceTimersByTimeAsync(60000);

      expect(loadCalls()).toBe(loads_after_b);
      expect(emitted('error:reconnecting')).toHaveLength(reconnecting_after_b);
      expect(emitted('error:recovered')).toHaveLength(0);
      const playback_states = (api.setState as ReturnType<typeof vi.fn>).mock.calls
        .filter(([key]) => key === 'playbackState')
        .map(([, value]) => value);
      expect(playback_states).not.toContain('loading');

      await plugin.destroy();
    });

    it('keeps an element error at the initial load manual while unclassified', async () => {
      vi.useFakeTimers();
      const { plugin, outcome } = await startNativeLoad({
        autoReconnect: true,
        maxNetworkRetries: 0,
      });

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'manifest 404');
      await flush();
      await vi.advanceTimersByTimeAsync(60000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      expect(fatalErrors()[0].detail).not.toHaveProperty('reconnecting');
      expect(emitted('error:reconnecting')).toHaveLength(0);

      await plugin.destroy();
    });
  });
});
