/**
 * Review-round-2 fixes for the native stall / deferral work
 * (HEI-SCARLETT-62 part 1 and HEI-SCARLETT-68: H1-R2, H8-R2, H2/H5-R2, H6-R2).
 *
 * The mock `setState` de-duplicates like core's state store (listeners only
 * hear a CHANGE), and the stalls are driven with real element events, so a
 * transition production never produces cannot hide a bug.
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
  type CapturedHls,
} from './helpers';

const SRC = 'http://example.com/stream.m3u8';

type Listener = (event: { key: string; value?: unknown }) => void;

/** Wire a mock API's state to a de-duplicating store, as core's is. */
const wireState = (
  api: ReturnType<typeof createMockAPI>,
  initial: Record<string, unknown>
): Record<string, unknown> => {
  const state = { ...initial };
  const listeners: Listener[] = [];
  api.getState.mockImplementation((key: string) => state[key]);
  api.setState.mockImplementation((key: string, value: unknown) => {
    if (state[key] === value) return;
    state[key] = value;
    listeners.forEach((listener) => listener({ key, value }));
  });
  api.subscribeToState.mockImplementation((listener: Listener) => {
    listeners.push(listener);
    return vi.fn();
  });
  return state;
};

const quiet = (): void => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
};

describe('native stall review fixes, round 2', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let position = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    position = 0;
    api = createMockAPI();
    state = wireState(api, { live: false, playing: false, seeking: false, paused: false });
    quiet();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  const stubElement = (): void => {
    Object.defineProperty(getVideo(), 'currentTime', {
      get: () => position,
      set: (value: number) => {
        position = value;
      },
      configurable: true,
    });
    Object.defineProperty(getVideo(), 'seekable', {
      value: { length: 1, start: () => 0, end: () => 60 },
      configurable: true,
    });
  };

  const emits = (name: string) => api.emit.mock.calls.filter(([event]) => event === name);
  const stalledFatals = () =>
    emits('error').filter(([, payload]) => (payload as any)?.detail?.stalled === true);

  /** Load natively and reach `playing` through the element's own events. */
  const startPlaying = async (config: Record<string, unknown>, live: boolean, at = 10) => {
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
    getVideo().dispatchEvent(new Event('playing'));
    return plugin;
  };

  it('H1-R2: a stall that recovers without a pause re-arms the watchdog and clears the ceiling', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    // Frozen: detected at the 30 s check, the ceiling (40 s) is armed there
    await vi.advanceTimersByTimeAsync(20_000);
    getVideo().dispatchEvent(new Event('waiting'));
    await vi.advanceTimersByTimeAsync(11_000);
    expect(stalledFatals()).toHaveLength(0);

    // Recovers at t=35 s: the element reports `playing`, the position moves.
    // `playing` is already true, so core publishes no change for it
    await vi.advanceTimersByTimeAsync(4_000);
    position = 20;
    getVideo().dispatchEvent(new Event('playing'));
    for (let at = 30; at <= 140; at += 10) {
      await vi.advanceTimersByTimeAsync(10_000);
      position = at;
    }

    expect(stalledFatals()).toHaveLength(0);
    expect(state.playbackState).not.toBe('error');

    await plugin.destroy();
  });

  /** Advance `seconds` one second at a time, the position moving each second. */
  const playFor = async (seconds: number): Promise<void> => {
    for (let i = 0; i < seconds; i++) {
      await vi.advanceTimersByTimeAsync(1_000);
      position += 1;
    }
  };

  it('H1-R3 (a): recovery with no `waiting` event at all never ends in a stalled fatal', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    // Frozen, no `waiting`: detected at the 30 s check, ceiling due at 70 s
    await vi.advanceTimersByTimeAsync(35_000);
    // Recovers at t=35 with nothing the store would publish
    await playFor(60);

    expect(stalledFatals()).toHaveLength(0);
    expect(state.playbackState).not.toBe('error');
    await plugin.destroy();
  });

  it('H1-R3 (b): `waiting` then `canplay` before the recovery never ends in a stalled fatal', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    await vi.advanceTimersByTimeAsync(20_000);
    getVideo().dispatchEvent(new Event('waiting'));
    await vi.advanceTimersByTimeAsync(15_000); // hand-off at 30, now t=35
    getVideo().dispatchEvent(new Event('canplay'));
    // `waiting` is cleared and the watchdog re-armed (t=35), but the stream is
    // still frozen: its second check (t=65) hands off again and stops. Only
    // after that does the stream recover (t=66), with no further store change
    await vi.advanceTimersByTimeAsync(31_000);
    await playFor(60);

    expect(stalledFatals()).toHaveLength(0);
    await plugin.destroy();
  });

  it('H1-R3 (c): a recovery at t=65 is seen by the ceiling at t=70 although the first re-armed check is at 80', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    await vi.advanceTimersByTimeAsync(20_000);
    getVideo().dispatchEvent(new Event('waiting'));
    await vi.advanceTimersByTimeAsync(45_000); // hand-off at 30; t=65
    getVideo().dispatchEvent(new Event('playing')); // clears `waiting`, re-arms
    await playFor(7); // through t=72, past the ceiling at 70

    expect(stalledFatals()).toHaveLength(0);
    await plugin.destroy();
  });

  it('H1-R3 (d): a stream that stays frozen still gets the stalled fatal at the ceiling', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    await vi.advanceTimersByTimeAsync(69_000);
    expect(stalledFatals()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(stalledFatals()).toHaveLength(1);

    await plugin.destroy();
  });

  it('H1-R4 (1): live reconnects whose edge rejoin seeks forward while frozen still end in the stalled fatal', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ stallTimeoutMs: 50_000 }, true, 40);

    let handled = 0;
    for (let t = 0; t < 200 && stalledFatals().length === 0; t++) {
      await vi.advanceTimersByTimeAsync(1_000);
      const reconnects = emits('error:reconnecting').length;
      while (handled < reconnects) {
        handled++;
        const el = getVideo();
        el.dispatchEvent(new Event('loadedmetadata'));
        el.dispatchEvent(new Event('seeking'));
        position += 40;
        el.dispatchEvent(new Event('seeked'));
      }
    }

    expect(stalledFatals().length).toBeGreaterThanOrEqual(1);
    await plugin.destroy();
  });

  it('H1-R4 (2): a viewer seeking back after the hand-off, then playing on, is not a stalled fatal', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false, 100);

    await vi.advanceTimersByTimeAsync(35_000); // hand-off at 30, watchdog stopped
    const el = getVideo();
    el.dispatchEvent(new Event('seeking'));
    position = 2;
    el.dispatchEvent(new Event('seeked'));
    await playFor(60);

    expect(stalledFatals()).toHaveLength(0);
    await plugin.destroy();
  });

  it('H1-R4 (3): a stream that advances and then freezes again in one episode still gets the fatal', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 40_000 }, false);

    await vi.advanceTimersByTimeAsync(35_000);
    await playFor(36); // advances through the ceiling at 70, then freezes
    await vi.advanceTimersByTimeAsync(200_000);

    expect(stalledFatals().length).toBeGreaterThanOrEqual(1);
    await plugin.destroy();
  });

  it('H1-R3: buffering during startup does not arm the watchdog', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ autoReconnect: false, stallTimeoutMs: 20_000 });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    await promise;
    position = 10;
    stubElement();
    // Startup buffering: the element waits, then can play, and never `playing`
    getVideo().dispatchEvent(new Event('waiting'));
    expect(state.waiting).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    const timersBefore = vi.getTimerCount();
    getVideo().dispatchEvent(new Event('canplay'));
    expect(state.waiting).toBe(false);

    // The `waiting` clearing must not have armed the watchdog (a check timer
    // would show up here). The check's own `stallCountable` gate would hide a
    // wrongly armed watchdog from any behavioural assertion
    expect(vi.getTimerCount()).toBe(timersBefore);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(stalledFatals()).toHaveLength(0);
    expect(emits('error')).toHaveLength(0);

    await plugin.destroy();
  });

  it('H8-R2: the ceiling that fires during a pause still expires after the viewer resumes into the stall', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ autoReconnect: false, stallTimeoutMs: 20_000 }, false);

    // Detected at the 30 s check; ceiling (20 s) armed there, due at 50 s
    await vi.advanceTimersByTimeAsync(40_000);
    api.setState('paused', true); // t=40: 10 s of the ceiling used
    await vi.advanceTimersByTimeAsync(25_000); // t=65: the timer fired at 50, paused
    api.setState('paused', false);
    expect(stalledFatals()).toHaveLength(0);

    // The remaining ~10 s of unpaused stall still end it
    await vi.advanceTimersByTimeAsync(12_000);
    expect(stalledFatals()).toHaveLength(1);

    await plugin.destroy();
  });

  it('H6-R2: a failed resume with autoReconnect off detaches the timed-out fetch', async () => {
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
    expect(getVideo().getAttribute('src')).toBe(SRC);
    const load = HTMLVideoElement.prototype.load as ReturnType<typeof vi.fn>;
    load.mockClear();
    await vi.advanceTimersByTimeAsync(5_001);

    expect(emits('error').filter(([, p]) => (p as any).fatal)).toHaveLength(1);
    // The fetch is gone: a late manifest cannot play behind the error overlay
    expect(getVideo().getAttribute('src')).toBeNull();
    expect(load).toHaveBeenCalled();

    await plugin.destroy();
  });

  it('H5 (beginNativeFetch): a viewer who pauses while a released source resumes gets the release again', async () => {
    vi.useFakeTimers();
    const plugin = await startPlaying({ nativePauseReleaseMs: 30_000 }, true);

    api.setState('paused', true);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(getVideo().getAttribute('src')).toBeNull();

    // Tap: the resume fetch starts, the viewer pauses before it loads
    api.setState('paused', false);
    void getVideo().play();
    expect(getVideo().getAttribute('src')).toBe(SRC);
    api.setState('paused', true);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(getVideo().getAttribute('src')).toBe(SRC);

    await vi.advanceTimersByTimeAsync(30_001);
    expect(getVideo().getAttribute('src')).toBeNull();

    await plugin.destroy();
  });
});

describe('switchToNative pause release (hls.js pipeline), round 2', () => {
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
    quiet();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('H2/H5-R2: a live viewer who played then paused is released after the switch load', async () => {
    vi.useFakeTimers();
    const api = createMockAPI();
    wireState(api, { live: true, playing: false, paused: true });
    const getVideo = (): HTMLVideoElement =>
      (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

    const plugin = createHLSPlugin({ autoStartLoad: false, nativePauseReleaseMs: 30_000 });
    await plugin.init(api);
    const load = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[created.length - 1]);
    await load;
    // hls.js classifies the stream live from its level details
    api.setState('live', true);

    api.setState('paused', false);
    api.setState('playing', true);
    api.setState('playing', false);
    api.setState('paused', true);

    const switching = plugin.switchToNative();
    await flush();
    expect(getVideo().getAttribute('src')).toBe(SRC);
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await switching;

    // Still paused: the pause policy releases it
    await vi.advanceTimersByTimeAsync(30_001);
    expect(getVideo().getAttribute('src')).toBeNull();

    await plugin.destroy();
  });
});
