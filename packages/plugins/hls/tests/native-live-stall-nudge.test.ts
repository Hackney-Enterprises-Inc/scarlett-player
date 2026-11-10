/**
 * Native live stall nudge (HEI-SCARLETT-62 part 1).
 *
 * On a native (iOS Safari) live stream the stall watchdog ticked every 15 s and
 * its only remedy was a full reload, so a stalled viewer waited 15 to 30 s for
 * anything to happen, and a pause/play during the stall reset the clock (and,
 * because a stalled element fires `waiting`, not `playing`, never re-armed it).
 *
 * These tests pin the fast path: a 1 s tick, a seek to the live sync position
 * after `liveStallNudgeMs` of stalled time, a reload at 15 s, and a stall clock
 * that a pause/play does not reset. Fake timers throughout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { createMockAPI, installMediaStubs, flush } from './helpers';

const SRC = 'http://example.com/live/stream.m3u8';

describe('native live stall nudge', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;
  /** Every value written to the element's `currentTime`, in order. */
  let seekWrites: number[];
  /** The seekable window's end; tests move it to model an advancing playlist. */
  let seekEnd = 60;

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

  /** A currentTime that records writes, and a seekable window ending at `end`. */
  const stubElement = (position: number, end = 60): void => {
    seekEnd = end;
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
      value: { length: 1, start: () => 0, end: () => seekEnd },
      configurable: true,
    });
  };

  const setPlaying = (value: boolean): void => api.setState('playing', value);

  const loadLive = async (config: Record<string, unknown> = {}) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    api.setState('live', true);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    await promise;
    return plugin;
  };

  const reconnecting = () =>
    api.emit.mock.calls.filter(([event]) => event === 'error:reconnecting').length;

  it('a native live stall is nudged to the live edge after 4 s, and a pause/play does not reset it', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(seekWrites).toEqual([]);

    // Pause, then play: the stalled element fires `waiting`, never `playing`
    api.setState('paused', true);
    setPlaying(false);
    await vi.advanceTimersByTimeAsync(1000);
    api.setState('paused', false);
    await vi.advanceTimersByTimeAsync(2000);

    // 2 s before the pause + 2 s after it = 4 s of stalled time
    expect(seekWrites).toEqual([57]);
    expect(reconnecting()).toBe(0);

    // Still frozen: the reload lands at 15 s of stalled time, not later
    // (2 + 2 s before and after the 1 s pause, the pause itself not counted)
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reconnecting()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(reconnecting()).toBe(1);

    await plugin.destroy();
  });

  it('nudges once per stall episode, and progress re-enables it', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(seekWrites).toEqual([57]);

    // Playback resumes from the nudge while the playlist advances: progress
    // ends the episode
    seekEnd = 100;
    for (let i = 0; i < 3; i++) {
      getVideo().currentTime = getVideo().currentTime + 2;
      await vi.advanceTimersByTimeAsync(1000);
    }
    seekWrites.length = 0;
    await vi.advanceTimersByTimeAsync(5000);
    expect(seekWrites).toEqual([97]);

    await plugin.destroy();
  });

  it('does not read its own nudge as progress', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive({ stallTimeoutMs: 60_000 });
    stubElement(40);
    setPlaying(true);

    // Nudge at 4 s, reload hand-off at 15 s, ceiling 60 s after the nudge
    await vi.advanceTimersByTimeAsync(4000 + 61_000);
    expect(
      api.emit.mock.calls.filter(
        ([event, payload]) => event === 'error' && (payload as any)?.detail?.stalled === true
      )
    ).toHaveLength(1);

    await plugin.destroy();
  });

  it('counts one element seek pair per episode', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(10_000);
    // The element reports the nudge's seek as it would
    getVideo().dispatchEvent(new Event('seeking'));
    getVideo().dispatchEvent(new Event('seeked'));
    await vi.advanceTimersByTimeAsync(2000);

    const seeked = api.emit.mock.calls.filter(([event]) => event === 'playback:seeked');
    expect(seeked).toHaveLength(1);
    expect(seekWrites).toEqual([57]);

    await plugin.destroy();
  });

  it('liveStallNudgeMs: 0 disables the nudge', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive({ liveStallNudgeMs: 0 });
    stubElement(40);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(14_000);
    expect(seekWrites).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(reconnecting()).toBe(1);

    await plugin.destroy();
  });

  it('skips the nudge when no window lies ahead of the viewer', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    // Sitting at the sync position already: the playlist is not advancing
    stubElement(57);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(seekWrites).toEqual([]);

    await plugin.destroy();
  });

  it('ticks at 1 s on native live', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    setPlaying(true);

    const delays = setTimeoutSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === 'number');
    expect(delays).toContain(1000);

    await plugin.destroy();
  });

  it('does not read a 1 s tick that ran 3 s late as a suspension', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    setPlaying(true);

    await vi.advanceTimersByTimeAsync(1000);
    vi.setSystemTime(Date.now() + 3000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.logger.info).not.toHaveBeenCalledWith(
      'Stall check ran late; page was suspended, not stalled',
      expect.anything()
    );
    // The late tick's gap was counted: 1 s + 4 s crosses the nudge threshold
    expect(seekWrites).toEqual([57]);

    await plugin.destroy();
  });

  it('still treats a long gap as a suspension', async () => {
    vi.useFakeTimers();
    const plugin = await loadLive();
    stubElement(40);
    setPlaying(true);

    vi.setSystemTime(Date.now() + 600_000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seekWrites).toEqual([]);
    expect(reconnecting()).toBe(0);

    await plugin.destroy();
  });
});
