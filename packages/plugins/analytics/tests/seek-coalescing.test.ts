import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

// HEI-32: element seeks (native controls, or whatever drives the iPad seek
// storm) come in bursts. A burst is element seeks each within 2 s of the
// previous one; it sends one `seeking` beacon and counts once in seekCount.
// elementSeekCount counts every element seek that is not a player seek's
// echo, and element seeking beacons stop at 30 per view.
describe('element seek coalescing', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    h = await createHarness({ heartbeatInterval: 100000 });
  });

  afterEach(async () => {
    await h.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** One complete element seek: seeking goes true, then false. */
  function seek(time: number): void {
    h.elementSeek(time);
    h.state.set('seeking', false);
  }

  /** Bursts of one element seek each, far enough apart not to coalesce. */
  function separateBursts(count: number): void {
    for (let i = 0; i < count; i++) {
      vi.advanceTimersByTime(2001);
      seek(i);
    }
  }

  it('sends one beacon and one seekCount for a burst, counting every seek in elementSeekCount', () => {
    seek(10);
    vi.advanceTimersByTime(500);
    seek(20);
    vi.advanceTimersByTime(500);
    seek(30);

    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.sent('seeking')[0]).toMatchObject({ seekTo: 10, seekCount: 1, seekSource: 'element' });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 3 });
  });

  it('measures the window from the previous element seek, so a burst extends', () => {
    // Each gap is under 2 s; the burst spans 6 s from its first seek.
    for (const time of [10, 20, 30, 40]) {
      seek(time);
      vi.advanceTimersByTime(1999);
    }
    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 4 });
  });

  it('extends a burst at exactly 2 s and starts a new one after it', () => {
    seek(10);
    vi.advanceTimersByTime(2000);
    seek(20);
    expect(h.sent('seeking')).toHaveLength(1);

    vi.advanceTimersByTime(2001);
    seek(30);
    expect(h.sent('seeking').map((b) => [b.seekTo, b.seekCount])).toEqual([[10, 1], [30, 2]]);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 2, elementSeekCount: 3 });
  });

  it('leaves player seeks and their echoes out of elementSeekCount and out of bursts', () => {
    h.bus.emit('playback:seeking', { time: 40 });
    h.elementSeek(40); // The player's own echo.
    h.state.set('seeking', false);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 0 });

    // An echo does not open a burst, so the next element seek still beacons.
    vi.advanceTimersByTime(1001);
    seek(50);
    expect(h.sent('seeking').map((b) => b.seekSource)).toEqual(['player', 'element']);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 2, elementSeekCount: 1 });
  });

  it('still counts a player seek in the middle of an element burst', () => {
    seek(10);
    vi.advanceTimersByTime(100);
    h.bus.emit('playback:seeking', { time: 20 });
    h.elementSeek(20);
    h.state.set('seeking', false);
    vi.advanceTimersByTime(100);
    seek(30);

    expect(h.sent('seeking').map((b) => b.seekSource)).toEqual(['element', 'player']);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 2, elementSeekCount: 2 });
  });

  it('caps element seeking beacons at 30 per view and keeps counting past the cap', () => {
    separateBursts(32);

    expect(h.sent('seeking')).toHaveLength(30);
    expect(h.sent('seeking').at(-1)).toMatchObject({ seekCount: 30 });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 32, elementSeekCount: 32 });

    // Player seeks are not capped.
    h.bus.emit('playback:seeking', { time: 5 });
    expect(h.sent('seeking')).toHaveLength(31);
    expect(h.sent('seeking').at(-1)).toMatchObject({ seekSource: 'player', seekCount: 33 });
  });

  it('starts a fresh burst when the clock moves backwards', () => {
    seek(10);
    vi.setSystemTime(9000);
    seek(20);
    vi.setSystemTime(11001);
    seek(30);

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 30]);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 3, elementSeekCount: 3 });
  });

  it('does not extend the element burst with a player echo at exactly 1 s', () => {
    seek(10);
    vi.advanceTimersByTime(500);
    h.bus.emit('playback:seeking', { time: 20 });
    vi.advanceTimersByTime(1000);
    seek(20); // Echo at the inclusive boundary; neither element counter changes.
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 2, elementSeekCount: 1 });
    vi.advanceTimersByTime(501);
    seek(30); // 2001 ms since the previous non-echo element seek.

    expect(h.sent('seeking').map((b) => b.seekSource)).toEqual(['element', 'player', 'element']);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 3, elementSeekCount: 2 });
  });

  it('ignores seeks on a closed view and resets both burst and cap on replay', () => {
    separateBursts(30);
    h.bus.emit('playback:ended', undefined);
    const oldId = h.plugin.getViewId();
    seek(10);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 30, elementSeekCount: 30 });
    h.bus.emit('playback:play', undefined);
    expect(h.plugin.getViewId()).not.toBe(oldId);
    seek(20);

    expect(h.sent('seeking')).toHaveLength(31);
    expect(h.sent('seeking').at(-1)).toMatchObject({ seekTo: 20, seekCount: 1 });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 1 });
  });

  it('cancels a pending rebuffer even for a coalesced element seek', () => {
    h.play();
    seek(10);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(100);
    seek(20);
    vi.advanceTimersByTime(250);

    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 0, elementSeekCount: 2 });
  });

  it('marks every coalesced and capped live element seek for fresh latency classification', async () => {
    await h.plugin.destroy();
    h = await createHarness({ heartbeatInterval: 100000, isLive: true });
    h.state.set('live', true);
    h.state.set('liveEdge', true);
    h.play();
    separateBursts(30);
    for (const delay of [0, 2001]) {
      h.state.set('liveEdge', true);
      h.bus.emit('live:edgechange', { atEdge: true });
      h.bus.emit('live:latency', { latency: 4 });
      await Promise.resolve();
      vi.advanceTimersByTime(delay);
      seek(100);
      h.state.set('liveEdge', false);
      h.bus.emit('live:latency', { latency: 1000 });
      await Promise.resolve();
    }

    expect(h.sent('seeking')).toHaveLength(30);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 31, elementSeekCount: 32 });
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd').at(-1)).toMatchObject({ liveLatencySamples: 2, liveLatencyMax: 4 });
  });

  it('carries elementSeekCount on the heartbeat and both viewEnds', async () => {
    await h.plugin.destroy();
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    seek(10);
    seek(20);
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat').at(-1)).toMatchObject({ seekCount: 1, elementSeekCount: 2 });

    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ seekCount: 1, elementSeekCount: 2 });

    await h.plugin.destroy();
    h = await createHarness({ heartbeatInterval: 100000 });
    h.play();
    seek(10);
    h.plugin.setVideo({ videoId: 'next' });
    expect(h.sent('viewEnd')[0]).toMatchObject({ seekCount: 1, elementSeekCount: 1 });
  });

  it('resets the burst, the cap and elementSeekCount for a new view', () => {
    separateBursts(30);
    seek(10); // Coalesced into the last burst.
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 30, elementSeekCount: 31 });

    h.plugin.setVideo({ videoId: 'next' });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 0, elementSeekCount: 0 });
    seek(20); // Same instant as the previous view's last seek.
    expect(h.sent('seeking').at(-1)).toMatchObject({ videoId: 'next', seekTo: 20, seekCount: 1 });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 1 });
  });

  it('turns an iPad seek storm of about a thousand element seeks in 18 s into one beacon', () => {
    h.play();
    for (let i = 0; i < 1000; i++) {
      seek(i / 10);
      vi.advanceTimersByTime(18);
    }

    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1, elementSeekCount: 1000 });
  });
});
