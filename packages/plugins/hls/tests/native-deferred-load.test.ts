/**
 * Deferred native load (HEI-SCARLETT-68).
 *
 * With `autoStartLoad: false` the native (iOS Safari) pipeline used to set
 * `src` and call `load()` at once, so a page that waits for the viewer's Play
 * still fetched the playlist and segments. Now `loadSource()` resolves with the
 * element untouched, and the first `video.play()` (the UI plays the element
 * directly) sets `src` synchronously, inside the tap, before it plays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { createMockAPI, installMediaStubs, flush, fireVideoError } from './helpers';

const SRC = 'http://example.com/live/stream.m3u8';

describe('deferred native load (autoStartLoad: false)', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);

    state = { live: false, playing: false, seeking: false, paused: true };
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
  });

  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  const emits = (name: string) => api.emit.mock.calls.filter(([event]) => event === name);

  it('resolves loadSource without setting src, and the first video.play() sets src before playing', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);

    // Resolves with no `loadedmetadata` dispatched
    await plugin.loadSource(SRC);

    const video = getVideo();
    expect(video.getAttribute('src')).toBeNull();
    expect(video.preload).toBe('none');
    expect(state.playbackState).toBe('ready');
    expect(emits('media:loaded')).toHaveLength(0);
    expect(plugin.isNativeHLS()).toBe(true);
    // No `loadTimeoutMs` watchdog (nor anything else) is pending
    expect(vi.getTimerCount()).toBe(0);

    let srcAtPlay: string | null | undefined;
    (HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>).mockImplementation(function (
      this: HTMLVideoElement
    ) {
      srcAtPlay = this.getAttribute('src');
      return Promise.resolve();
    });
    void video.play();
    expect(srcAtPlay).toBe(SRC);

    await plugin.destroy();
  });

  it('media:loaded waits for real metadata after the first play', async () => {
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    void getVideo().play();
    expect(emits('media:loaded')).toHaveLength(0);

    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(emits('media:loaded')).toHaveLength(1);

    await plugin.destroy();
  });

  it('loads normally when autoStartLoad is left on', async () => {
    const plugin = createHLSPlugin();
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    await flush();

    expect(getVideo().getAttribute('src')).toBe(SRC);
    expect(getVideo().preload).toBe('metadata');
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await promise;

    await plugin.destroy();
  });

  it('puts the element back without an own play property once the fetch starts', async () => {
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    const video = getVideo();
    expect(Object.prototype.hasOwnProperty.call(video, 'play')).toBe(true);
    void video.play();
    expect(Object.prototype.hasOwnProperty.call(video, 'play')).toBe(false);

    await plugin.destroy();
  });

  it('destroy before any play restores the element and never fetches', async () => {
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);
    const video = getVideo();

    await plugin.destroy();
    expect(Object.prototype.hasOwnProperty.call(video, 'play')).toBe(false);
    void video.play();
    expect(video.getAttribute('src')).toBeNull();
  });

  it('a new source before any play does not leave the old one to fetch', async () => {
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);
    const next = 'http://example.com/live/next.m3u8';
    await plugin.loadSource(next);

    void getVideo().play();
    expect(getVideo().getAttribute('src')).toBe(next);

    await plugin.destroy();
  });

  it('starts the load watchdog at the play, not at loadSource', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ autoStartLoad: false, loadTimeoutMs: 5000 });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(emits('error')).toHaveLength(0);

    void getVideo().play();
    await vi.advanceTimersByTimeAsync(4999);
    expect(emits('error')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2);
    const fatals = emits('error').filter(([, payload]) => (payload as any).fatal);
    expect(fatals).toHaveLength(1);
    expect((fatals[0][1] as any).detail.timedOut).toBe(true);

    await plugin.destroy();
  });

  it('a first-load failure on the tap reports a fatal and leaves no unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const plugin = createHLSPlugin({ autoStartLoad: false, maxNetworkRetries: 0 });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    void getVideo().play();
    fireVideoError(getVideo(), 2, 'Network error');
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emits('error').filter(([, payload]) => (payload as any).fatal)).toHaveLength(1);
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);

    await plugin.destroy();
  });

  it('plays again after an in-load retry, so the tap is not lost', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    const play = HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>;
    play.mockClear();
    void getVideo().play();
    // The tap's `play` event takes the core state off paused
    api.setState('paused', false);
    expect(play).toHaveBeenCalledTimes(1);

    // One 403 on the first tap: the retry re-runs the load algorithm
    fireVideoError(getVideo(), 4, 'forbidden');
    await vi.advanceTimersByTimeAsync(5000);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();

    expect(play).toHaveBeenCalledTimes(2);

    await plugin.destroy();
  });

  it('a reconnect that lands while paused loads nothing and ends the cycle', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ autoStartLoad: false });
    await plugin.init(api);
    await plugin.loadSource(SRC);

    // Tap, load, play
    void getVideo().play();
    api.setState('live', true);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    Object.defineProperty(getVideo(), 'currentTime', { value: 10, writable: true, configurable: true });
    getVideo().dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(emits('error:reconnecting').length).toBeGreaterThan(0);

    // The viewer pauses before the attempt lands
    getVideo().dispatchEvent(new Event('pause'));
    await vi.advanceTimersByTimeAsync(3000);
    await flush();

    expect(getVideo().getAttribute('src')).toBeNull();
    expect(emits('error:recovered')).toHaveLength(1);
    expect(state.playbackState).toBe('ready');

    // The next tap loads again
    void getVideo().play();
    expect(getVideo().getAttribute('src')).toBe(SRC);

    await plugin.destroy();
  });
});
