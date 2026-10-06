/**
 * Live reload lands at the live edge (HEI-30 player half, plan task M step 4).
 *
 * After the 2026-10-04 producer drop, reconnected live views reported 5,000
 * to 7,000 s of latency: playback resumed at the start of the DVR window.
 * Both live reload paths skipped the VOD position restore and trusted the
 * pipeline to pick the edge. With default config and no EXT-X-START, hls.js
 * uses `liveSyncPosition`; the native element does not have to, and on a
 * long window it can come back at the window start. These tests pin:
 *
 * - a native live reload (error recovery and auto-reconnect) seeks to the
 *   live sync position, the same target seek-to-live uses;
 * - a native live source already at the edge after the reload is left alone;
 * - a discontinuity (two seekable ranges) still targets the newest edge;
 * - the initial native load preserves host and Safari start selection;
 * - VOD reconnects still restore the viewer's position, on both pipelines;
 * - an hls.js live reconnect hands start selection to hls.js (`-1`) and does
 *   not write the stale position back.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Hls from 'hls.js';
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
  fireError,
  fireVideoError,
} from './helpers';

const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;

/** Two-hour DVR window, the shape of the 10-04 replacement views. */
const WINDOW_END = 7200;
/** Native target latency when nothing better is known (live-metrics.ts). */
const DEFAULT_TARGET_LATENCY = 3;

describe('live reload lands at the live edge', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;

  const SRC = 'http://example.com/live/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();

    state = { live: false, playing: false, paused: false };
    listeners = [];

    // State the plugin writes is state it reads back, and every write is
    // announced, so a `live` write classifies the source as it does in core
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

  /**
   * Give the video element `seekable` ranges, as Safari reports a live window.
   *
   * @param ranges - `[start, end]` pairs in seconds, oldest first
   */
  const stubSeekable = (ranges: Array<[number, number]>): void => {
    Object.defineProperty(getVideo(), 'seekable', {
      value: {
        length: ranges.length,
        start: (i: number) => ranges[i][0],
        end: (i: number) => ranges[i][1],
      },
      configurable: true,
    });
  };

  /**
   * Make the element report a live (infinite) duration and announce it, the
   * way Safari classifies a native live source.
   */
  const announceLiveDuration = (): void => {
    Object.defineProperty(getVideo(), 'duration', { value: Infinity, configurable: true });
    getVideo().dispatchEvent(new Event('durationchange'));
  };

  /**
   * Make the element report a finite VOD duration and announce it.
   *
   * @param seconds - Duration in seconds
   */
  const announceVodDuration = (seconds: number): void => {
    Object.defineProperty(getVideo(), 'duration', { value: seconds, configurable: true });
    getVideo().dispatchEvent(new Event('durationchange'));
  };

  describe('native HLS', () => {
    beforeEach(() => {
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    });

    /**
     * Load natively and settle the initial load.
     *
     * @param config - Plugin configuration overrides
     * @param live - Whether the element reports a live window
     */
    const loadNatively = async (config: Record<string, unknown>, live: boolean) => {
      const plugin = createHLSPlugin(config);
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      promise.catch(() => {});
      await flush();
      if (live) {
        stubSeekable([[0, WINDOW_END]]);
        stubCurrentTime(WINDOW_END - 5);
        announceLiveDuration();
      } else {
        stubCurrentTime(0);
        announceVodDuration(3600);
      }
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
      await promise;
      return plugin;
    };

    /**
     * Complete a pending reload the way a long-window live playlist comes
     * back on Safari: metadata lands with the element at the window start.
     *
     * @param ranges - Seekable ranges the reloaded element reports
     * @param position - Where the element sits when metadata lands
     */
    const completeReload = async (
      ranges: Array<[number, number]> = [[0, WINDOW_END]],
      position = 0
    ): Promise<void> => {
      stubSeekable(ranges);
      stubCurrentTime(position);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();
    };

    it('error recovery of a live source seeks to the live sync position', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ autoReconnect: false, maxMediaRetries: 2 }, true);

      fireVideoError(getVideo(), MEDIA_ERR_DECODE, 'decode hiccup');
      await vi.advanceTimersByTimeAsync(1200);
      await completeReload();

      expect(getVideo().currentTime).toBe(WINDOW_END - DEFAULT_TARGET_LATENCY);

      await plugin.destroy();
    });

    it('auto-reconnect of a live source seeks to the live sync position', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await flush();
      expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

      // First reconnect attempt: base 2s with 70-100% jitter
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload();

      expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());
      expect(getVideo().currentTime).toBe(WINDOW_END - DEFAULT_TARGET_LATENCY);

      await plugin.destroy();
    });

    it('targets the newest edge when a discontinuity splits the window', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      // The producer rejoined behind an EXT-X-DISCONTINUITY
      await completeReload([
        [0, 3600],
        [3600.5, WINDOW_END],
      ]);

      expect(getVideo().currentTime).toBe(WINDOW_END - DEFAULT_TARGET_LATENCY);

      await plugin.destroy();
    });

    it('leaves a reload that already landed at the edge where it is', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([[0, WINDOW_END]], WINDOW_END - 6);

      expect(getVideo().currentTime).toBe(WINDOW_END - 6);

      await plugin.destroy();
    });

    it('does not seek when the reloaded element reports no window yet', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([], 0);

      expect(getVideo().currentTime).toBe(0);

      await plugin.destroy();
    });

    it('a VOD auto-reconnect still restores the viewer position', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, false);
      stubCurrentTime(137);

      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'network dropped');
      await vi.advanceTimersByTimeAsync(2500);
      stubCurrentTime(0);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());
      expect(getVideo().currentTime).toBe(137);

      await plugin.destroy();
    });

    it.each([0, 137, WINDOW_END - 5])('the first live DVR/EVENT load preserves Safari’s chosen position %s', async (position) => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();

      stubSeekable([[0, WINDOW_END]]);
      stubCurrentTime(position);
      announceLiveDuration();
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await promise;

      expect(getVideo().currentTime).toBe(position);

      await plugin.destroy();
    });

    it('preserves a finite-duration EVENT start chosen by Safari', async () => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();
      stubSeekable([[0, WINDOW_END]]);
      stubCurrentTime(137);
      announceVodDuration(WINDOW_END);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await promise;
      expect(state.live).toBe(false);
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it('does not force the first load to the edge when live classification arrives after metadata', async () => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();
      stubCurrentTime(137);
      Object.defineProperty(getVideo(), 'duration', { value: Infinity, configurable: true });
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await promise;
      // loadedmetadata alone writes duration; durationchange classifies live.
      expect(state.live).toBe(false);
      stubSeekable([[0, WINDOW_END]]);
      announceLiveDuration();
      getVideo().dispatchEvent(new Event('canplay'));
      expect(state.live).toBe(true);
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it.each(['loadedmetadata', 'durationchange'])('preserves a host start/resume/share position on %s', async (event) => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();
      stubSeekable([[0, WINDOW_END]]);
      announceLiveDuration();
      // Hosts can seek synchronously from metadata, before loadSource resolves.
      const seek = api.on.mock.calls.find(([event]) => event === 'playback:seeking')![1] as (payload: { time: number }) => void;
      getVideo().addEventListener(event, () => seek({ time: 137 }), { once: true });
      if (event === 'durationchange') announceLiveDuration();
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await promise;
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it('does not override a viewer seek still in progress after reload', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      Object.defineProperty(getVideo(), 'seeking', { value: true, configurable: true });
      await completeReload([[0, WINDOW_END]], 137);
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it('rejoins once when the seekable window arrives after metadata', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([], 0);
      stubSeekable([[0, WINDOW_END]]);
      getVideo().dispatchEvent(new Event('canplay'));
      expect(getVideo().currentTime).toBe(WINDOW_END - DEFAULT_TARGET_LATENCY);
      stubCurrentTime(137);
      getVideo().dispatchEvent(new Event('canplay'));
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it('clamps to the last range start when that range is shorter than target latency', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([[0, 3600], [7199, WINDOW_END]], 0);
      expect(getVideo().currentTime).toBe(7199);
      await plugin.destroy();
    });

    it('cancels a pending edge rejoin when the viewer seeks before the window arrives', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([], 0);
      stubCurrentTime(137);
      getVideo().dispatchEvent(new Event('seeking'));
      getVideo().dispatchEvent(new Event('seeked'));
      stubSeekable([[0, WINDOW_END]]);
      getVideo().dispatchEvent(new Event('canplay'));
      expect(getVideo().currentTime).toBe(137);
      await plugin.destroy();
    });

    it('removes a pending edge rejoin on pipeline teardown', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload([], 0);
      const media = getVideo();
      await plugin.destroy();
      Object.defineProperty(media, 'seekable', { value: { length: 1, start: () => 0, end: () => WINDOW_END }, configurable: true });
      media.dispatchEvent(new Event('canplay'));
      expect(media.currentTime).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('an edge seek does not loop into recovery while playback advances', async () => {
      vi.useFakeTimers();
      const plugin = await loadNatively({ maxNetworkRetries: 0 }, true);
      fireVideoError(getVideo(), MEDIA_ERR_NETWORK, 'producer dropped');
      await vi.advanceTimersByTimeAsync(2500);
      await completeReload();
      api.emit.mockClear();
      getVideo().dispatchEvent(new Event('seeking'));
      getVideo().dispatchEvent(new Event('seeked'));
      getVideo().dispatchEvent(new Event('playing'));
      for (let i = 0; i < 4; i++) {
        getVideo().currentTime += 1;
        getVideo().dispatchEvent(new Event('timeupdate'));
        await vi.advanceTimersByTimeAsync(15000);
      }
      expect(api.emit).not.toHaveBeenCalledWith('error:reconnecting', expect.anything());
      expect(api.emit).not.toHaveBeenCalledWith('error:media', expect.anything());
      await plugin.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('the initial load of a VOD source does not move the start', async () => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();

      stubCurrentTime(0);
      announceVodDuration(3600);
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await promise;

      expect(getVideo().currentTime).toBe(0);

      await plugin.destroy();
    });
  });

  describe('hls.js', () => {
    let created: CapturedHls[];
    const mockCtor = createMockHlsConstructor();

    beforeEach(() => {
      created = [];
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
        const captured = createCapturedHls();
        created.push(captured);
        return captured.instance as any;
      });
    });

    /**
     * Load through hls.js, settle the manifest, and fail it fatally so the
     * first auto-reconnect attempt builds a second instance.
     *
     * @param live - Whether the source is classified live
     * @param position - Viewer position at the failure
     * @returns The plugin
     */
    const failAndReconnect = async (live: boolean, position: number, startPosition = -1) => {
      const plugin = createHLSPlugin({ maxNetworkRetries: 0, startPosition });
      await plugin.init(api);
      const promise = plugin.loadSource(SRC);
      await flush();
      fireManifest(created[0]);
      await flush();
      await promise;
      if (live) api.setState('live', true);

      stubCurrentTime(position);
      fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });
      await vi.advanceTimersByTimeAsync(2500);
      expect(created).toHaveLength(2);

      // hls.destroy() detaches the element, which resets it
      stubCurrentTime(0);
      stubSeekable([[0, WINDOW_END]]);
      fireManifest(created[1]);
      await flush();
      expect(api.emit).toHaveBeenCalledWith('error:recovered', expect.anything());
      return plugin;
    };

    it('a live reconnect lets hls.js pick the live sync position', async () => {
      vi.useFakeTimers();
      const plugin = await failAndReconnect(true, 1800);

      const config = (hlsLoader.createHlsInstance as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(config.startPosition).toBe(-1);
      expect(getVideo().currentTime).toBe(0);

      await plugin.destroy();
    });

    it('retains an explicit hls.js startPosition on live reconnect', async () => {
      vi.useFakeTimers();
      const plugin = await failAndReconnect(true, 1800, 137);
      const config = (hlsLoader.createHlsInstance as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(config.startPosition).toBe(137);
      expect(getVideo().currentTime).toBe(0);
      await plugin.destroy();
    });

    it.each([null, 137])('installed hls.js resolves default live start with EXT-X-START %s', (offset) => {
      const realHls = new Hls({ autoStartLoad: false });
      const controller = (realHls as any).streamController;
      Object.defineProperty(realHls, 'liveSyncPosition', { value: 7197 });
      controller.startPosition = -1;
      controller.setStartPosition({ live: true, startTimeOffset: offset, edge: WINDOW_END, totalduration: WINDOW_END }, 0);
      expect(controller.nextLoadPosition).toBe(offset ?? 7197);
      realHls.destroy();
    });

    it('a VOD reconnect still restores the viewer position', async () => {
      vi.useFakeTimers();
      const plugin = await failAndReconnect(false, 137);

      expect(getVideo().currentTime).toBe(137);

      await plugin.destroy();
    });
  });
});
