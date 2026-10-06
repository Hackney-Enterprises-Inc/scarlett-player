import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateQoEScore } from '../src/helpers';
import { createHarness } from './harness';

// HEI-30 (analytics half): a live stream that ends is not a completion, and a
// position over a sliding window is no completion rate, however the view ends.
describe('live endings', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Classify the source the way a provider does once its metadata loads. */
  function classify(live: boolean): void {
    h.state.set('live', live);
    h.bus.emit('media:loadedmetadata', { duration: 1000 });
  }

  /** Play a classified source to a position inside its window. */
  async function playLive(): Promise<void> {
    h = await createHarness({ heartbeatInterval: 1000 });
    classify(true);
    h.play();
    h.state.set('currentTime', 600);
    vi.advanceTimersByTime(3000);
  }

  /** Report the element's `ended` the way a provider does. */
  function end(): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:ended', undefined);
  }

  it('ends a live view as liveEnded with a null completionRate', async () => {
    await playLive();
    end();

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'liveEnded', completionRate: null, isLive: true });
  });

  it('scores a live ending like a completion, not a failure', async () => {
    await playLive();
    end();

    const viewEnd = h.sent('viewEnd')[0];
    expect(viewEnd.qoeScore).toBeGreaterThan(0);
    expect(viewEnd.qoeScore).toBe(calculateQoEScore({
      startupTime: viewEnd.startupTime as number | null,
      rebufferCount: 0,
      rebufferDuration: 0,
      watchTime: 3000,
      maxBitrate: null,
      exitType: 'completed',
      warningCount: 0,
      fatalErrorCategory: null,
    }));
  });

  it('gives liveEnded the same QoE score as completed', () => {
    const base = { startupTime: 4000, rebufferCount: 1, rebufferDuration: 500, watchTime: 10000, maxBitrate: 2000000, warningCount: 1, fatalErrorCategory: null };
    expect(calculateQoEScore({ ...base, exitType: 'liveEnded' })).toBe(calculateQoEScore({ ...base, exitType: 'completed' }));
  });

  it.each([
    ['unload', () => window.dispatchEvent(new Event('pagehide'))],
    ['destroy', () => h.plugin.destroy()],
    ['setVideo', () => h.plugin.setVideo({ videoId: 'next' })],
  ] as const)('reports a null completionRate when a live view ends by %s', async (_exit, exit) => {
    await playLive();
    await exit();

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', completionRate: null });
  });

  it('reports a null completionRate when a live view ends idle', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    classify(true);
    h.play();
    h.state.set('currentTime', 600);
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
    vi.advanceTimersByTime(5000);

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', completionRate: null });
  });

  it('reports a null completionRate when a live view ends in error', async () => {
    await playLive();
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'gone', fatal: true } as any);

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'error', completionRate: null });
  });

  it('nulls completionRate on a host-declared live video before the provider classifies it', async () => {
    h = await createHarness({ heartbeatInterval: 1000, isLive: true });
    h.play();
    h.state.set('currentTime', 600);
    end();

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'liveEnded', completionRate: null });
  });

  it('keeps a replay of an ended live source live', async () => {
    await playLive();
    end();
    h.play();
    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('pagehide'));

    const [first, replay] = h.sent('viewEnd');
    expect(replay.viewId).not.toBe(first.viewId);
    expect(replay).toMatchObject({ isLive: true, completionRate: null });
  });

  it('honours host-declared VOD when the provider classifies the source live', async () => {
    h = await createHarness({ heartbeatInterval: 1000, isLive: false });
    classify(true);
    h.play();
    h.state.set('currentTime', 250);
    window.dispatchEvent(new Event('pagehide'));

    expect(h.plugin.getMetrics().lastKnownIsLive).toBe(true);
    expect(h.sent('viewEnd')[0]).toMatchObject({ isLive: false, completionRate: 25 });

    h.play();
    end();
    expect(h.sent('viewEnd').at(-1)).toMatchObject({ isLive: false, exitType: 'completed', completionRate: 100 });
  });

  it('completes an unclassified source without inventing a live classification', async () => {
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    end();

    expect(h.plugin.getMetrics().lastKnownIsLive).toBeNull();
    expect(h.sent('viewEnd')[0]).toMatchObject({ isLive: null, exitType: 'completed', completionRate: 100 });
  });

  it('measures a VOD video loaded after a live view', async () => {
    await playLive();
    end();
    h.plugin.setVideo({ videoId: 'vod' });
    classify(false);
    h.play();
    h.state.set('currentTime', 250);
    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('pagehide'));

    expect(h.sent('viewEnd').at(-1)).toMatchObject({ isLive: false, exitType: 'abandoned', completionRate: 25 });
  });

  it('measures a VOD source loaded over an ended live view with the same videoId', async () => {
    await playLive();
    end();
    // load() resets `live`, then the new source classifies as VOD
    classify(false);
    h.play();
    h.state.set('currentTime', 500);
    vi.advanceTimersByTime(2000);
    end();

    expect(h.sent('viewEnd').at(-1)).toMatchObject({ isLive: false, exitType: 'completed', completionRate: 100 });
  });

  it('still completes a VOD view at 100', async () => {
    h = await createHarness({ heartbeatInterval: 1000 });
    classify(false);
    h.play();
    h.state.set('currentTime', 1000);
    end();

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'completed', completionRate: 100 });
  });
});
