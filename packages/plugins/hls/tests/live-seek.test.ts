/**
 * Live seek clamp (HEI-SCARLETT-18).
 *
 * Every seek source - the progress bar (drag, click, touch, keyboard),
 * `player.seek()` and `player.seekToLive()` - ends in the provider's
 * `playback:seeking` handler. It used to clamp only to `[0, duration]`, which
 * on a live stream let a seek land on the very end of the window: there is no
 * media past that point yet, so playback paused and buffered until the next
 * segment arrived. A live seek is now held at the live sync position (the
 * stream's own target latency behind the edge), and VOD is unchanged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
} from './helpers';

const SRC = 'http://example.com/live/stream.m3u8';

describe('live seek clamp', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  let state: Record<string, unknown>;
  let handlers: Record<string, (payload: { time: number }) => void>;
  let currentTime: number;
  const mockCtor = createMockHlsConstructor();

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    handlers = {};
    currentTime = 0;
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });

    state = { live: true };
    api = createMockAPI();
    (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => state[key]);
    (api.setState as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: unknown) => {
      state[key] = value;
    });
    (api.on as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string, handler: (payload: { time: number }) => void) => {
        handlers[event] = handler;
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

  /** Give the element a writable position and the given seekable window. */
  const stubElement = (
    video: HTMLVideoElement,
    window: { start: number; end: number },
    duration?: number
  ) => {
    Object.defineProperty(video, 'seekable', {
      value: { length: 1, start: () => window.start, end: () => window.end },
      configurable: true,
    });
    Object.defineProperty(video, 'currentTime', {
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
      configurable: true,
    });
    if (duration !== undefined) {
      Object.defineProperty(video, 'duration', { value: duration, configurable: true });
    }
  };

  const seek = (time: number) => handlers['playback:seeking']?.({ time });

  describe('hls.js path', () => {
    /** Boot hls.js and deliver a live playlist with a 100-160 window. */
    const loadLive = async (liveSyncPosition: number | undefined, targetLatency = 3) => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      plugin.loadSource(SRC).catch(() => {});
      await flush();

      const hls = created[0];
      Object.assign(hls.instance, { latency: targetLatency, targetLatency, liveSyncPosition });
      // loadSource() clears `live`; the playlist is what puts it back
      hls.handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
        details: { live: true, targetduration: 2, fragmentStart: 100, edge: 160 },
      });

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      // Under MSE hls.js sets duration to the playlist end, and seekable starts at 0
      stubElement(video, { start: 0, end: 160 }, 160);
      currentTime = 120;
      return { plugin, video };
    };

    it('holds a seek to the end of the window at the live sync position', async () => {
      await loadLive(157);

      seek(160);

      expect(currentTime).toBe(157);
    });

    it('holds a seek past the end at the live sync position', async () => {
      await loadLive(157);

      seek(500);

      expect(currentTime).toBe(157);
    });

    it('leaves a seek inside the safe part of the window untouched', async () => {
      await loadLive(157);

      seek(130);

      expect(currentTime).toBe(130);
    });

    it('raises a seek before the window to its start (the playlist window, not seekable.start)', async () => {
      await loadLive(157);

      seek(20);

      expect(currentTime).toBe(100);
    });

    it("falls back to the edge minus the stream's target latency when hls.js has no sync position", async () => {
      await loadLive(undefined, 2);

      seek(160);

      expect(currentTime).toBe(158);
    });
  });

  describe('VOD is unchanged', () => {
    it('clamps to [0, duration] and nothing else', async () => {
      state.live = false;
      const plugin = createHLSPlugin();
      await plugin.init(api);
      plugin.loadSource(SRC).catch(() => {});
      await flush();

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      stubElement(video, { start: 0, end: 100 }, 100);

      seek(100);
      expect(currentTime).toBe(100);
      seek(150);
      expect(currentTime).toBe(100);
      seek(-5);
      expect(currentTime).toBe(0);
      seek(42);
      expect(currentTime).toBe(42);
    });
  });

  describe('native path', () => {
    beforeEach(() => {
      // Safari/iOS: native HLS only, no MSE
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    });

    /** Boot the native pipeline on a live 100-160 window. */
    const loadNative = async (duration?: number) => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      plugin.loadSource(SRC).catch(() => {});
      await flush();

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      stubElement(video, { start: 100, end: 160 }, duration);
      // A non-finite duration is how the native path classifies live
      video.dispatchEvent(new Event('durationchange'));
      video.dispatchEvent(new Event('loadedmetadata'));
      await flush();
      currentTime = 120;
      return { plugin, video };
    };

    it('holds a seek to seekable.end at the live sync position', async () => {
      // Safari reports a live stream's duration as Infinity
      await loadNative(Infinity);

      seek(160);

      expect(currentTime).toBe(157);
    });

    it('keeps a seek inside the window, even when duration is not a number', async () => {
      // NaN used to collapse the old `video.duration || 0` clamp to 0
      await loadNative();

      seek(130);

      expect(currentTime).toBe(130);
    });
  });
});
