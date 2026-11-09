/**
 * Failed provider reloads on the native path (TSP-571).
 *
 * Auto-reconnect and native error recovery reload the same URL through
 * `loadNative()`, which re-runs the element's load algorithm (`readyState`
 * back to 0). WebKit reports a failure of that reload before `loadedmetadata`
 * as code 4 / NETWORK_NO_SOURCE whatever the real cause, and the element
 * `error` handler used to turn every one into an advisory `media:error`: one
 * "Media source not supported" warning per attempt, for a source that had
 * been playing.
 *
 * These tests pin that the FIRST failed reload of an outage is reported once,
 * tagged `reconnecting` with its attempt number; the retries after it are
 * logged only; the next outage reports again; and every other element error
 * (an initial load, readyState >= 1, the HEI-71 no-source shape) is unchanged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireManifest,
  fireVideoError,
} from './helpers';

const SRC = 'http://example.com/vod/stream.m3u8';

/** What the assertions read off a `media:error` payload. */
type MediaErrorPayload = Error & { code?: number; detail?: Record<string, unknown> };

describe('native provider reload failures', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();

    // Safari/iOS: native HLS only, no MSE
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);

    state = { live: false, playing: false, seeking: false, paused: false };
    listeners = [];
    api = createMockAPI();
    api.getState.mockImplementation((key: string) => state[key]);
    api.subscribeToState.mockImplementation(
      (listener: (event: { key: string; value?: unknown }) => void) => {
        listeners.push(listener);
        return vi.fn();
      }
    );

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

  /** Give the video element a writable currentTime (jsdom leaves it at 0). */
  const stubCurrentTime = (value: number): void => {
    Object.defineProperty(getVideo(), 'currentTime', {
      value,
      writable: true,
      configurable: true,
    });
  };

  /** Put element states on the video, as a failed or playing load has them. */
  const stubElementStates = (networkState: number, readyState: number): void => {
    Object.defineProperty(getVideo(), 'networkState', { value: networkState, configurable: true });
    Object.defineProperty(getVideo(), 'readyState', { value: readyState, configurable: true });
  };

  /** Flip `playing` in mock state and notify the watchdog's own subscription. */
  const setPlaying = (value: boolean): void => {
    state.playing = value;
    listeners.forEach((listener) => listener({ key: 'playing', value }));
  };

  /**
   * Fail the load in flight the way WebKit does: code 4, NETWORK_NO_SOURCE,
   * HAVE_NOTHING, with the `src` attribute the reload just set still on the
   * element.
   */
  const failReload = async (): Promise<void> => {
    stubElementStates(3, 0);
    fireVideoError(getVideo(), 4, '');
    await flush();
  };

  /** Settle the load in flight by firing `loadedmetadata`. */
  const completeLoad = async (): Promise<void> => {
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
  };

  /** Every `media:error` payload emitted so far. */
  const mediaErrors = (): MediaErrorPayload[] =>
    api.emit.mock.calls
      .filter(([event]) => event === 'media:error')
      .map(([, payload]) => (payload as { error: MediaErrorPayload }).error);

  /** How many `error:reconnecting` events were emitted so far. */
  const reconnectingCount = (): number =>
    api.emit.mock.calls.filter(([event]) => event === 'error:reconnecting').length;

  /**
   * Load a source natively, settle the initial load and start playing.
   *
   * VOD, so no live-edge rejoin is involved in a reconnect that succeeds.
   *
   * @param config - Plugin configuration overrides
   */
  const loadAndPlay = async (config: Record<string, unknown> = {}) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    await completeLoad();
    await promise;
    stubCurrentTime(10);
    setPlaying(true);
    return plugin;
  };

  /** Freeze playback until the watchdog schedules a reconnect. */
  const stall = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(30001);
  };

  it('reports the first failed reconnect reload once, tagged', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay();

    await stall();
    expect(reconnectingCount()).toBe(1);

    // First backoff is 2 s at most: the reconnect reloads the source
    await vi.advanceTimersByTimeAsync(2001);
    await failReload();

    const errors = mediaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(4);
    expect(errors[0].detail).toEqual({
      mediaErrorCode: 4,
      networkState: 3,
      readyState: 0,
      reconnecting: true,
      attempts: 1,
    });
    // The failure sends the loop round again
    expect(reconnectingCount()).toBe(2);

    await plugin.destroy();
  });

  it('logs the later failed reloads of the same outage instead of reporting them', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay();

    await stall();
    await vi.advanceTimersByTimeAsync(2001); // attempt 1
    await failReload();
    await vi.advanceTimersByTimeAsync(4001); // attempt 2
    await failReload();
    await vi.advanceTimersByTimeAsync(8001); // attempt 3
    await failReload();

    expect(mediaErrors()).toHaveLength(1);
    expect(api.logger.info).toHaveBeenCalledWith(
      'Native reload failed (not reported)',
      expect.objectContaining({ phase: 'reconnect', attempt: 2, code: 4 })
    );
    expect(api.logger.info).toHaveBeenCalledWith(
      'Native reload failed (not reported)',
      expect.objectContaining({ phase: 'reconnect', attempt: 3, code: 4 })
    );
    // Still reconnecting: the unreported failures are not given up on
    expect(reconnectingCount()).toBe(4);

    await plugin.destroy();
  });

  it('reports again for the next outage once a reconnect succeeded', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay();

    // Outage 1: the first reload fails, the second one loads
    await stall();
    await vi.advanceTimersByTimeAsync(2001);
    await failReload();
    await vi.advanceTimersByTimeAsync(4001);
    await completeLoad();
    expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());
    expect(mediaErrors()).toHaveLength(1);

    // Outage 2: playback freezes again and its first reload fails
    stubElementStates(4, 4);
    await stall();
    await vi.advanceTimersByTimeAsync(2001);
    await failReload();

    const errors = mediaErrors();
    expect(errors).toHaveLength(2);
    expect(errors[1].detail).toMatchObject({ reconnecting: true, attempts: 1 });

    await plugin.destroy();
  });

  it('tags the failed reload of a native error recovery', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ autoReconnect: false });

    // A mid-play network error with metadata loaded: reported as it always was
    stubElementStates(2, 4);
    fireVideoError(getVideo(), 2, 'network hiccup');
    await flush();
    expect(mediaErrors()).toHaveLength(1);
    expect(mediaErrors()[0].detail).toEqual({
      mediaErrorCode: 2,
      networkState: 2,
      readyState: 4,
    });

    // The recovery reload (1 s backoff) then fails before metadata
    await vi.advanceTimersByTimeAsync(1001);
    await failReload();

    const errors = mediaErrors();
    expect(errors).toHaveLength(2);
    expect(errors[1].detail).toMatchObject({
      mediaErrorCode: 4,
      readyState: 0,
      reconnecting: true,
      attempts: 1,
    });

    await plugin.destroy();
  });

  it('reports the failed AirPlay switch reload, again after a switch back and forth', async () => {
    // Safari with both pipelines, which is what AirPlay needs
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(true);
    const mockCtor = createMockHlsConstructor();
    const created: CapturedHls[] = [];
    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });

    const plugin = createHLSPlugin({ autoReconnect: false });
    await plugin.init(api);
    const loading = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[created.length - 1]);
    await loading;
    expect(plugin.isNativeHLS()).toBe(false);

    // AirPlay connects and the switch reload fails: one tagged error
    const toNative = plugin.switchToNative();
    toNative.catch(() => {});
    await flush();
    await failReload();
    expect(mediaErrors()).toHaveLength(1);
    expect(mediaErrors()[0].detail).toMatchObject({ reconnecting: true, attempts: 1 });

    // AirPlay disconnects and connects again: a new outage reports again
    const backToHlsJs = plugin.switchToHlsJs();
    backToHlsJs.catch(() => {});
    await flush();
    fireManifest(created[created.length - 1]);
    await backToHlsJs;

    const toNativeAgain = plugin.switchToNative();
    toNativeAgain.catch(() => {});
    await flush();
    await failReload();
    expect(mediaErrors()).toHaveLength(2);
    expect(mediaErrors()[1].detail).toMatchObject({ reconnecting: true, attempts: 1 });

    await plugin.destroy();
  });

  describe('errors that are not a failed provider reload', () => {
    it('keeps a code 4 on the initial user load untagged', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ autoReconnect: false });
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();

      await failReload();

      const errors = mediaErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toEqual({ mediaErrorCode: 4, networkState: 3, readyState: 0 });

      await plugin.destroy();
    });

    it('keeps a mid-play code 4 with metadata untagged', async () => {
      vi.useFakeTimers();
      const plugin = await loadAndPlay({ autoReconnect: false });

      stubElementStates(2, 1);
      fireVideoError(getVideo(), 4, '');
      await flush();

      const errors = mediaErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toEqual({ mediaErrorCode: 4, networkState: 2, readyState: 1 });

      await plugin.destroy();
    });

    it('keeps the HEI-71 no-source shape silent', async () => {
      vi.useFakeTimers();
      const plugin = await loadAndPlay({ autoReconnect: false });

      getVideo().removeAttribute('src');
      await failReload();

      expect(mediaErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('stops treating code 4 as a reload failure once the reload has loaded', async () => {
      vi.useFakeTimers();
      const plugin = await loadAndPlay();

      await stall();
      await vi.advanceTimersByTimeAsync(2001);
      await completeLoad();
      expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());

      // A later code 4 with nothing loaded is no longer inside a reload
      await failReload();

      const errors = mediaErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toEqual({ mediaErrorCode: 4, networkState: 3, readyState: 0 });

      await plugin.destroy();
    });
  });
});
