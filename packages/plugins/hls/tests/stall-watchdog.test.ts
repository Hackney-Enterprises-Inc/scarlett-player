/**
 * Playback stall watchdog cadence tests (SCAR-HLS-5).
 *
 * `startStallWatchdog` computes its target duration in seconds but armed
 * `setTimeout` with that same number treated as milliseconds — a missing
 * *1000 conversion before the 30s cap made the re-check interval ~15ms
 * instead of ~15s, so the watchdog re-armed continuously while playing
 * rather than checking for progress every ~15 seconds. Stall *detection*
 * itself was unaffected (the threshold comparison was already in ms), so
 * these tests cover both: the re-check cadence, and that a genuine stall
 * still ends in a scheduled reconnect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { createMockAPI, installMediaStubs, flush } from './helpers';

describe('playback stall watchdog', () => {
  let api: ReturnType<typeof createMockAPI>;
  let state: Record<string, unknown>;
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;

  const SRC = 'http://example.com/vod/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    installMediaStubs();

    // Safari/iOS: native HLS only, no MSE. Simplest path to a `video`
    // element and `hasPlayedContent`, and the watchdog itself is provider-
    // agnostic (it only reads `video.currentTime` and core state).
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

  /**
   * Load a source natively and settle the initial load, which is what sets
   * `hasPlayedContent` (auto-reconnect requires it for VOD).
   */
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

  /** Flip `playing` in mock state and notify the watchdog's own subscription. */
  const setPlaying = (value: boolean): void => {
    state.playing = value;
    listeners.forEach((listener) => listener({ key: 'playing', value }));
  };

  /** Flip `paused` the way the element's `pause`/`play` handlers do. */
  const setPaused = (value: boolean): void => {
    state.paused = value;
    listeners.forEach((listener) => listener({ key: 'paused', value }));
  };

  it('does not re-check at millisecond cadence while playing without a stall', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively();
    stubCurrentTime(10);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    setPlaying(true);

    // Nothing else in the plugin schedules a timer on this path (no error,
    // no reconnect, no native load watchdog once metadata has landed), so
    // every delay captured here is the stall watchdog's own re-arm. At the
    // default ~15s target duration a millisecond-cadence bug re-arms
    // repeatedly within the first second; the fix does not re-arm at all
    // in that window.
    await vi.advanceTimersByTimeAsync(999);

    const delays = setTimeoutSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === 'number');

    expect(delays.length).toBeGreaterThan(0);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(1000);
    }

    await plugin.destroy();
  });

  it('still schedules a reconnect when playback genuinely stalls', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively();
    stubCurrentTime(10);

    setPlaying(true);

    // Two watchdog cycles at the ~15s target duration: the first only
    // confirms no progress yet, the second crosses the stall threshold.
    await vi.advanceTimersByTimeAsync(30001);

    expect(api.logger.warn).toHaveBeenCalledWith(
      'Playback stall detected — no timeupdate progress',
      expect.anything()
    );
    expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

    await plugin.destroy();
  });

  // HEI-SCARLETT-62: a viewer's pause/play used to stop the watchdog and start
  // it again with a fresh baseline, so a stall that outlived a pause/play was
  // never reported at all (a stalled element fires `waiting`, not `playing`).
  it('keeps the stall clock when the viewer pauses and plays during a stall', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively();
    stubCurrentTime(10);
    setPlaying(true);
    await vi.advanceTimersByTimeAsync(10_000);

    setPaused(true);
    setPlaying(false);
    await vi.advanceTimersByTimeAsync(1000);
    // No `playing` follows: the stalled element only fires `waiting`
    setPaused(false);

    await vi.advanceTimersByTimeAsync(19_001);
    expect(api.logger.warn).toHaveBeenCalledWith(
      'Playback stall detected — no timeupdate progress',
      expect.anything()
    );

    await plugin.destroy();
  });

  it('does not count time the viewer spent paused', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively();
    stubCurrentTime(10);
    setPlaying(true);

    setPaused(true);
    setPlaying(false);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(api.logger.warn).not.toHaveBeenCalledWith(
      'Playback stall detected — no timeupdate progress',
      expect.anything()
    );

    await plugin.destroy();
  });

  // TSP-571: iOS suspends timers while a page is backgrounded or locked but
  // the wall clock keeps running, so the first overdue check used to read the
  // whole gap as one stall and reload while the network was still coming back.
  it('does not read a suspended page as a stall', async () => {
    vi.useFakeTimers();
    const plugin = await loadNatively();
    stubCurrentTime(10);
    setPlaying(true);

    // Ten minutes pass with no timer running, then the check fires
    vi.setSystemTime(Date.now() + 600_000);
    await vi.advanceTimersByTimeAsync(15_001);

    expect(api.logger.warn).not.toHaveBeenCalledWith(
      'Playback stall detected — no timeupdate progress',
      expect.anything()
    );
    expect(api.emit).not.toHaveBeenCalledWith('error:reconnecting', expect.anything());

    // The measurement started over, and a genuine freeze is still caught
    await vi.advanceTimersByTimeAsync(30_001);
    expect(api.logger.warn).toHaveBeenCalledWith(
      'Playback stall detected — no timeupdate progress',
      expect.anything()
    );
    expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

    await plugin.destroy();
  });
});
