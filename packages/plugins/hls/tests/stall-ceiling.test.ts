/**
 * Stall ceiling and watchdog gating tests (HEI-SCARLETT-70).
 *
 * Production saw 24 sessions stalled over ten minutes (one logged 359
 * rebuffers over 72 minutes with zero errors) because the stall watchdog's
 * reconnect never ended for live and kept resetting for VOD. These tests pin:
 *
 * - a stall that persists across reconnect attempts ends in one fatal `error`
 *   with `detail.stalled: true` once `stallTimeoutMs` passes (native and
 *   hls.js), for live and VOD;
 * - playback progress resets the ceiling clock;
 * - `stallTimeoutMs: 0` disables the ceiling;
 * - a hidden tab or an offline browser is not a stall.
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
} from './helpers';

const SRC = 'http://example.com/vod/stream.m3u8';

describe('stall ceiling', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;
  let hidden = false;
  let onLine = true;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    hidden = false;
    onLine = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);

    state = { live: false, playing: false, seeking: false, paused: false };
    listeners = [];
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
    delete (document as any).hidden;
  });

  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  const stubCurrentTime = (value: number): void => {
    Object.defineProperty(getVideo(), 'currentTime', {
      value,
      writable: true,
      configurable: true,
    });
  };

  const setPlaying = (value: boolean): void => {
    state.playing = value;
    listeners.forEach((listener) => listener({ key: 'playing', value }));
  };

  /** Fatal `error` emissions that carry `detail.stalled`. */
  const stalledErrors = () =>
    api.emit.mock.calls.filter(
      ([event, payload]) =>
        event === 'error' && (payload as any)?.detail?.stalled === true && (payload as any).fatal
    );

  const stallDetections = () =>
    api.logger.warn.mock.calls.filter(([msg]) =>
      String(msg).startsWith('Playback stall detected')
    );

  describe('native HLS', () => {
    beforeEach(() => {
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    });

    const loadNatively = async (config: Record<string, unknown> = {}) => {
      const plugin = createHLSPlugin(config);
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      await promise;
      return plugin;
    };

    it('ends a persistent VOD stall with one fatal stalled error', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);

      // Detection at ~30s, then reconnect attempts that never load
      await vi.advanceTimersByTimeAsync(30001);
      expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());
      expect(stalledErrors()).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(61000);
      expect(stalledErrors()).toHaveLength(1);
      expect(api.emit).toHaveBeenCalledWith('error:reconnect-exhausted', expect.anything());

      // Terminal: nothing further is scheduled
      const reconnecting = () =>
        api.emit.mock.calls.filter(([e]) => e === 'error:reconnecting').length;
      const before = reconnecting();
      await vi.advanceTimersByTimeAsync(300000);
      expect(reconnecting()).toBe(before);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('ends a persistent live stall too, which the reconnect window never would', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      state.live = true;
      listeners.forEach((l) => l({ key: 'live', value: true }));
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001 + 61000);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('defaults to a 120 s ceiling', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively();
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001 + 100000);
      expect(stalledErrors()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(25000);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('resets the ceiling clock when playback progresses', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001); // stall detected, reconnect scheduled
      expect(stallDetections()).toHaveLength(1);

      // The reconnect lands and the viewer plays on
      await vi.advanceTimersByTimeAsync(3000);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      setPlaying(false);
      setPlaying(true);
      for (let i = 0; i < 8; i++) {
        stubCurrentTime(getVideo().currentTime + 10);
        await vi.advanceTimersByTimeAsync(15000);
      }
      expect(stalledErrors()).toHaveLength(0);

      // A later stall starts a fresh clock: the first detection is now
      // 120s+ old, which would have fired the 60s ceiling twice over
      await vi.advanceTimersByTimeAsync(50000);
      expect(stallDetections().length).toBeGreaterThan(1);
      expect(stalledErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('treats endless seeking as a stall even while currentTime keeps jumping forward', async () => {
      // Seen in desktop Chrome on a live stream whose segments never answer:
      // the player stays `seeking`, hls.js re-seeks to the moving live window
      // (+6 s every 6 s) and no frame is ever shown. The jumps are not
      // progress and the seek never ends, so neither the watchdog nor the
      // ceiling used to fire.
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      state.live = true;
      listeners.forEach((l) => l({ key: 'live', value: true }));
      stubCurrentTime(10);
      setPlaying(true);
      state.seeking = true;

      for (let i = 0; i < 17; i++) {
        stubCurrentTime(getVideo().currentTime + 6);
        await vi.advanceTimersByTimeAsync(6000);
      }
      // ~102 s: detection at ~30 s of continuous seeking, ceiling 60 s later
      expect(stallDetections().length).toBeGreaterThan(0);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('does not call a short seek a stall', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);

      // A seek that settles within one check interval
      state.seeking = true;
      await vi.advanceTimersByTimeAsync(10000);
      state.seeking = false;
      for (let i = 0; i < 8; i++) {
        stubCurrentTime(getVideo().currentTime + 10);
        await vi.advanceTimersByTimeAsync(15000);
      }
      expect(stallDetections()).toHaveLength(0);
      expect(stalledErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('stallTimeoutMs: 0 disables the ceiling', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 0 });
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(400000);
      expect(stallDetections().length).toBeGreaterThan(0);
      expect(stalledErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('does not treat a hidden tab as a stall', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);
      hidden = true;

      await vi.advanceTimersByTimeAsync(300000);
      expect(stallDetections()).toHaveLength(0);
      expect(api.emit).not.toHaveBeenCalledWith('error:reconnecting', expect.anything());

      // Coming back does not count the hidden time as stalled time
      hidden = false;
      await vi.advanceTimersByTimeAsync(15001);
      expect(stallDetections()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(15001);
      expect(stallDetections()).toHaveLength(1);

      await plugin.destroy();
    });

    it('does not treat an offline browser as a stall', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);
      onLine = false;

      await vi.advanceTimersByTimeAsync(300000);
      expect(stallDetections()).toHaveLength(0);
      expect(stalledErrors()).toHaveLength(0);

      await plugin.destroy();
    });

    it('does not give up on a stall whose ceiling timer ran late (suspended page)', async () => {
      // TSP-571: iOS suspends timers with the page but the wall clock runs on,
      // so a ceiling timer that wakes ten minutes late measured the sleep as
      // stall time and ended playback with a fatal. Live, so the reconnect
      // window is not what ends it.
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      state.live = true;
      listeners.forEach((l) => l({ key: 'live', value: true }));
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001);
      expect(stallDetections()).toHaveLength(1);

      // The page sleeps for ten minutes with no timer running, then wakes
      vi.setSystemTime(Date.now() + 600_000);
      await vi.advanceTimersByTimeAsync(61000);
      expect(stalledErrors()).toHaveLength(0);

      // The clock started over: a stall that really lasts the ceiling still ends
      await vi.advanceTimersByTimeAsync(61000);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('does not fire the ceiling while hidden mid-stall', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ stallTimeoutMs: 60000 });
      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001);
      expect(stallDetections()).toHaveLength(1);
      hidden = true;
      await vi.advanceTimersByTimeAsync(120000);
      expect(stalledErrors()).toHaveLength(0);

      await plugin.destroy();
    });
  });

  describe('hls.js', () => {
    let created: CapturedHls[];
    const mockCtor = createMockHlsConstructor();

    beforeEach(() => {
      created = [];
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(false);
      vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
        const captured = createCapturedHls();
        created.push(captured);
        return captured.instance as any;
      });
    });

    it('ends a persistent stall with a fatal stalled error', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ stallTimeoutMs: 60000 });
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();
      fireManifest(created[0]);
      await flush();
      await promise;

      stubCurrentTime(10);
      setPlaying(true);

      await vi.advanceTimersByTimeAsync(30001);
      expect(stallDetections()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(61000);
      expect(stalledErrors()).toHaveLength(1);

      await plugin.destroy();
    });

    it('keeps the stall clock across a pause/play during a stall (HEI-SCARLETT-62)', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ stallTimeoutMs: 60000 });
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();
      fireManifest(created[0]);
      await flush();
      await promise;

      stubCurrentTime(10);
      setPlaying(true);
      await vi.advanceTimersByTimeAsync(10_000);

      // The viewer pauses and plays again: a pause neither adds nor resets
      state.paused = true;
      setPlaying(false);
      await vi.advanceTimersByTimeAsync(1000);
      state.paused = false;
      setPlaying(true);

      // 10 s before the pause + 20 s after it: detected at the second tick
      await vi.advanceTimersByTimeAsync(19_001);
      expect(stallDetections()).toHaveLength(1);

      await plugin.destroy();
    });

    it('does not count paused time as stalled time', async () => {
      vi.useFakeTimers();
      const plugin = createHLSPlugin({ stallTimeoutMs: 60000 });
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();
      fireManifest(created[0]);
      await flush();
      await promise;

      stubCurrentTime(10);
      setPlaying(true);
      state.paused = true;
      setPlaying(false);

      await vi.advanceTimersByTimeAsync(300_000);
      expect(stallDetections()).toHaveLength(0);

      await plugin.destroy();
    });
  });
});
