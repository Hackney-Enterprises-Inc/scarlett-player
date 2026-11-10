/**
 * Review-round-1 fixes for the native stall / deferral work
 * (HEI-SCARLETT-62 part 1 and HEI-SCARLETT-68, findings H1 to H9).
 *
 * Every test pins the exact clock/state sequence from the review record, on
 * fake timers. The stall watchdog, the stall ceiling, the reconnect, the
 * pause release and the deferral share closures, so the cases are kept together.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireManifest,
  fireVideoError,
  type CapturedHls,
} from './helpers';

const SRC = 'http://example.com/stream.m3u8';
const SRC_B = 'http://example.com/other.m3u8';

describe('native stall / deferral review fixes', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;
  let position = 0;
  let seekWrites: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);

    state = { live: false, playing: false, seeking: false, paused: false };
    listeners = [];
    seekWrites = [];
    position = 0;
    api = createMockAPI();
    api.getState.mockImplementation((key: string) => state[key]);
    api.setState.mockImplementation((key: string, value: unknown) => {
      state[key] = value;
      listeners.forEach((listener) => listener({ key, value }));
    });
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

  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  const stubElement = (end = 60): void => {
    Object.defineProperty(getVideo(), 'currentTime', {
      get: () => position,
      set: (value: number) => {
        seekWrites.push(value);
        position = value;
      },
      configurable: true,
    });
    Object.defineProperty(getVideo(), 'seekable', {
      value: { length: 1, start: () => 0, end: () => end },
      configurable: true,
    });
  };

  const emits = (name: string) => api.emit.mock.calls.filter(([event]) => event === name);
  const stalledFatals = () =>
    emits('error').filter(([, payload]) => (payload as any)?.detail?.stalled === true);

  /** Load natively (immediate fetch) and reach `playing`, position frozen at `at`. */
  const startPlaying = async (config: Record<string, unknown>, live: boolean, at = 40) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    if (live) api.setState('live', true);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    await promise;
    position = at;
    stubElement();
    api.setState('paused', false);
    api.setState('playing', true);
    return plugin;
  };

  it('H1: a stream that recovers after the hand-off clears the stall ceiling (autoReconnect off)', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false, 10);

    // Frozen: detected at the 30 s check, the ceiling (40 s) is armed there
    await vi.advanceTimersByTimeAsync(31_000);
    expect(stalledFatals()).toHaveLength(0);

    // Recovers at t=35 s: `playing` again, the position moves
    await vi.advanceTimersByTimeAsync(4_000);
    position = 20;
    api.setState('playing', false);
    api.setState('playing', true);
    // Keeps advancing; the re-armed watchdog's checks see progress
    await vi.advanceTimersByTimeAsync(10_000);
    position = 30;
    await vi.advanceTimersByTimeAsync(10_000);
    position = 40;
    await vi.advanceTimersByTimeAsync(10_000);
    position = 50;
    await vi.advanceTimersByTimeAsync(40_000);

    expect(stalledFatals()).toHaveLength(0);
    expect(state.playbackState).not.toBe('error');

    await plugin.destroy();
  });

  it('H7: paused seconds inside a tick do not count as stalled time', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({}, false, 10);

    const setPaused = (value: boolean) => api.setState('paused', value);
    await vi.advanceTimersByTimeAsync(1_000);
    setPaused(true); // t=1
    await vi.advanceTimersByTimeAsync(13_000);
    setPaused(false); // t=14
    await vi.advanceTimersByTimeAsync(2_000); // t=16, check at 15 ran
    setPaused(true); // t=16
    await vi.advanceTimersByTimeAsync(13_000);
    setPaused(false); // t=29
    await vi.advanceTimersByTimeAsync(2_000); // t=31, check at 30 ran

    expect(emits('error:reconnecting')).toHaveLength(0);

    await plugin.destroy();
  });

  it('H8: paused time is not part of the stall ceiling', async () => {
    vi.useFakeTimers();
    // autoReconnect off isolates the ceiling from the reload loop
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 20_000 }, false, 10);

    // Detected at the 30 s check; the ceiling (20 s) is armed there and would fire at 50 s
    await vi.advanceTimersByTimeAsync(30_500);
    api.setState('paused', true); // t=30.5
    await vi.advanceTimersByTimeAsync(18_000);
    api.setState('paused', false); // t=48.5, ~18 s of the 20 s was paused
    await vi.advanceTimersByTimeAsync(2_000); // t=50.5: past the wall-clock ceiling

    expect(stalledFatals()).toHaveLength(0);

    await plugin.destroy();
  });

  describe('deferred native source', () => {
    it('H4: a viewer who paused during the retry backoff is not played again', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ autoStartLoad: false });
      await plugin.init(api);
      await plugin.loadSource(SRC);

      const play = HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>;
      play.mockClear();
      api.setState('paused', true);
      void getVideo().play(); // tap: fetch starts
      api.setState('paused', false);
      expect(play).toHaveBeenCalledTimes(1);

      fireVideoError(getVideo(), 4, 'forbidden');
      api.setState('paused', true); // viewer pauses inside the backoff
      await vi.advanceTimersByTimeAsync(5000);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(play).toHaveBeenCalledTimes(1);

      await plugin.destroy();
    });

    it('H3: a paused VOD reconnect under deferral reloads and restores the position', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ autoStartLoad: false });
      await plugin.init(api);
      await plugin.loadSource(SRC);

      void getVideo().play();
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      position = 100;
      stubElement();
      api.setState('paused', false);
      api.setState('playing', true);
      await vi.advanceTimersByTimeAsync(31_000);
      expect(emits('error:reconnecting').length).toBeGreaterThan(0);

      api.setState('paused', true);
      await vi.advanceTimersByTimeAsync(5_000);
      await flush();

      // VOD is never released: the reconnect loads normally
      expect(getVideo().getAttribute('src')).toBe(SRC);
      position = 0;
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      expect(position).toBe(100);

      await plugin.destroy();
    });

    it('H9: loading B while A is attached detaches A', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ autoStartLoad: false });
      await plugin.init(api);
      await plugin.loadSource(SRC);
      void getVideo().play();
      expect(getVideo().getAttribute('src')).toBe(SRC);

      await plugin.loadSource(SRC_B);

      expect(getVideo().getAttribute('src')).toBeNull();

      await plugin.destroy();
    });
  });

  describe('native pause release', () => {
    it('H5: a reconnect that completes while paused re-arms the pause release', async () => {
      vi.useFakeTimers();
      const plugin = await startPlaying({ nativePauseReleaseMs: 30_000 }, true);

      // Live stall: the fast path reloads at 15 s of stalled time
      await vi.advanceTimersByTimeAsync(15_000);
      expect(emits('error:reconnecting').length).toBeGreaterThan(0);

      api.setState('paused', true);
      await vi.advanceTimersByTimeAsync(5_000);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      expect(getVideo().getAttribute('src')).toBe(SRC);

      await vi.advanceTimersByTimeAsync(30_001);
      expect(getVideo().getAttribute('src')).toBeNull();

      await plugin.destroy();
    });

    it('H6: a failed resume with autoReconnect off ends in a terminal error, not a spinner', async () => {
      vi.useFakeTimers();
      const plugin = await startPlaying(
        { nativePauseReleaseMs: 30_000, autoReconnect: false, loadTimeoutMs: 5_000 },
        true
      );

      api.setState('paused', true);
      await vi.advanceTimersByTimeAsync(30_001);
      expect(getVideo().getAttribute('src')).toBeNull();

      api.setState('paused', false);
      void getVideo().play();
      await vi.advanceTimersByTimeAsync(5_001);

      expect(emits('error').filter(([, p]) => (p as any).fatal)).toHaveLength(1);
      expect(state.buffering).toBe(false);
      expect(state.playbackState).toBe('error');

      await plugin.destroy();
    });
  });
});

describe('switchToNative with deferred loading (hls.js pipeline)', () => {
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

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
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('H2: a viewer who played then paused gets a normal native load at the saved position', async () => {
    const api = createMockAPI();
    const state: Record<string, unknown> = { live: false, playing: false, paused: true };
    const listeners: Array<(event: { key: string; value?: unknown }) => void> = [];
    api.getState.mockImplementation((key: string) => state[key]);
    api.setState.mockImplementation((key: string, value: unknown) => {
      state[key] = value;
      listeners.forEach((listener) => listener({ key, value }));
    });
    api.subscribeToState.mockImplementation(
      (listener: (event: { key: string; value?: unknown }) => void) => {
        listeners.push(listener);
        return vi.fn();
      }
    );
    const getVideo = (): HTMLVideoElement =>
      (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    const load = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[created.length - 1]);
    await load;

    // Played, then paused at 42 s
    api.setState('paused', false);
    api.setState('playing', true);
    api.setState('playing', false);
    api.setState('paused', true);
    let current = 42;
    Object.defineProperty(getVideo(), 'currentTime', {
      get: () => current,
      set: (value: number) => {
        current = value;
      },
      configurable: true,
    });

    const switching = plugin.switchToNative();
    await flush();

    // Not deferred: the source is fetched without a play
    expect(getVideo().getAttribute('src')).toBe(SRC);
    current = 0;
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await switching;
    expect(current).toBe(42);

    await plugin.destroy();
  });
});
