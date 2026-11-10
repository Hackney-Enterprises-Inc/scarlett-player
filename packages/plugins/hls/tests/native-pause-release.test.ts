/**
 * Native pause policy (HEI-SCARLETT-68).
 *
 * WebKit keeps refreshing a live playlist and topping up its buffer while the
 * element is paused, and a native source has no buffer controls. With
 * `nativePauseReleaseMs` set, a paused native LIVE source is released after
 * that long (`src` removed, `load()` called) and the next play fetches it again
 * and rejoins the live edge. VOD is never released, and the default (0) changes
 * nothing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { createMockAPI, installMediaStubs, flush } from './helpers';

const SRC = 'http://example.com/live/stream.m3u8';

describe('native pause release', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;
  let seekWrites: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);

    state = { live: false, playing: false, seeking: false, paused: true };
    listeners = [];
    seekWrites = [];
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

  const stubElement = (position: number, end = 60): void => {
    let current = position;
    Object.defineProperty(getVideo(), 'currentTime', {
      get: () => current,
      set: (value: number) => {
        seekWrites.push(value);
        current = value;
      },
      configurable: true,
    });
    Object.defineProperty(getVideo(), 'seekable', {
      value: { length: 1, start: () => 0, end: () => end },
      configurable: true,
    });
  };

  const emits = (name: string) => api.emit.mock.calls.filter(([event]) => event === name);

  /** Load natively and get to "playing". */
  const startPlaying = async (config: Record<string, unknown>, live = true) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    if (live) api.setState('live', true);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    await promise;
    stubElement(40);
    getVideo().dispatchEvent(new Event('play'));
    getVideo().dispatchEvent(new Event('playing'));
    return plugin;
  };

  it('a native live source paused for nativePauseReleaseMs drops its src and rejoins the edge on play', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000 });

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(getVideo().getAttribute('src')).toBe(SRC);
    await vi.advanceTimersByTimeAsync(2);

    expect(getVideo().getAttribute('src')).toBeNull();
    expect(emits('media:error')).toHaveLength(0);
    expect(emits('error')).toHaveLength(0);
    expect(state.live).toBe(true);

    let srcAtPlay: string | null | undefined;
    (HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>).mockImplementation(function (
      this: HTMLVideoElement
    ) {
      srcAtPlay = this.getAttribute('src');
      return Promise.resolve();
    });
    void getVideo().play();
    expect(srcAtPlay).toBe(SRC);

    // After metadata, the viewer lands at the sync position (60 - 3)
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(seekWrites).toContain(57);

    await plugin.destroy();
  });

  it('a play before the timer fires keeps the source', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000 });

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(20_000);
    getVideo().dispatchEvent(new Event('play'));
    getVideo().dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getVideo().getAttribute('src')).toBe(SRC);

    await plugin.destroy();
  });

  it('is off by default', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({});

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(getVideo().getAttribute('src')).toBe(SRC);

    await plugin.destroy();
  });

  it('never releases a VOD source', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000 }, false);

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(300_000);
    expect(getVideo().getAttribute('src')).toBe(SRC);

    await plugin.destroy();
  });

  it('a pause of 60 s with release on, then play, is not a stall', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000 });

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(60_000);
    void getVideo().play();
    getVideo().dispatchEvent(new Event('play'));
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    await vi.advanceTimersByTimeAsync(3000);

    expect(emits('error:reconnecting')).toHaveLength(0);

    await plugin.destroy();
  });

  it('a failed resume hands off to auto-reconnect', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000, loadTimeoutMs: 5000 });

    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(30_001);
    void getVideo().play();
    getVideo().dispatchEvent(new Event('play'));
    // The origin never answers
    await vi.advanceTimersByTimeAsync(5001);

    expect(emits('error:reconnecting')).toHaveLength(1);

    await plugin.destroy();
  });

  it('destroy while released restores the element', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30000 });
    const video = getVideo();

    video.dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(30_001);
    expect(Object.prototype.hasOwnProperty.call(video, 'play')).toBe(true);

    await plugin.destroy();
    expect(Object.prototype.hasOwnProperty.call(video, 'play')).toBe(false);
  });
});
