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

// HEI-SCARLETT-42: the player-requested path was the remaining unbounded one
// (1,041 seeks in one 51 s production view). Every `playback:seeking` request
// still counts in seekCount, reserves its element echo, marks live seeks and
// cancels pending waiting; what is bounded is how many `seeking` beacons the
// requests may send: a per-view, leading-and-trailing one-second window. The
// first request sends immediately, further requests inside the window replace
// one pending target, and the latest target sends once at the deadline.
describe('player seek coalescing', () => {
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

  /** A player seek request on the bus, as core seek()/UI/gestures emit it. */
  function playerSeek(time: number): void {
    h.bus.emit('playback:seeking', { time });
  }

  it('sends the first request immediately, with no trailing duplicate for a single seek', () => {
    playerSeek(10);
    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.sent('seeking')[0]).toMatchObject({ seekTo: 10, seekCount: 1, seekSource: 'player' });
    expect(h.sent('seeking')[0].timestamp).toBe(10000);

    vi.advanceTimersByTime(5000);
    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.plugin.getMetrics().seekCount).toBe(1);
  });

  it('sends only the latest target of a rapid burst once, at the window deadline', () => {
    playerSeek(10); // Leading edge: immediate.
    playerSeek(20); // Pending.
    playerSeek(30); // Replaces the pending target.

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10]);
    vi.advanceTimersByTime(999);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10]);

    vi.advanceTimersByTime(1);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 30]);
    expect(h.sent('seeking')[1]).toMatchObject({ seekCount: 3, seekSource: 'player', timestamp: 11000 });
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it('processes the window deadline before a request at that instant', () => {
    // The plan's example: 10 at 0 ms, 20 at 500 ms, 30 at 1000 ms emit 10 at
    // 0 ms, 20 at 1000 ms and 30 at 2000 ms; the third request is pending
    // after the trailing send, not an additional immediate send.
    playerSeek(10);
    vi.advanceTimersByTime(500);
    playerSeek(20);
    vi.advanceTimersByTime(500);

    expect(h.sent('seeking').map((b) => [b.seekTo, b.timestamp])).toEqual([[10, 10000], [20, 11000]]);

    playerSeek(30);
    expect(h.sent('seeking')).toHaveLength(2);
    vi.advanceTimersByTime(999);
    expect(h.sent('seeking')).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(h.sent('seeking').map((b) => [b.seekTo, b.timestamp])).toEqual([
      [10, 10000], [20, 11000], [30, 12000],
    ]);
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it.each([999, 1000, 1001])('a request %i ms into the window', (delay) => {
    playerSeek(10);
    vi.advanceTimersByTime(500);
    playerSeek(20);
    vi.advanceTimersByTime(delay - 500);
    playerSeek(30);
    vi.advanceTimersByTime(3000); // Quiescence.

    if (delay < 1000) {
      // Still inside the window: 30 replaces the pending 20, never sent.
      expect(h.sent('seeking').map((b) => [b.seekTo, b.timestamp])).toEqual([[10, 10000], [30, 11000]]);
    } else {
      // At/past the deadline the timer already flushed 20; 30 trails the
      // window that trailing send opened.
      expect(h.sent('seeking').map((b) => [b.seekTo, b.timestamp])).toEqual([
        [10, 10000], [20, 11000], [30, 12000],
      ]);
    }
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it('flushes a due pending target once when the timer ran late, with no catch-up send', () => {
    playerSeek(10);
    vi.advanceTimersByTime(500);
    playerSeek(20); // Pending; deadline 11000.
    // The deadline passes with the timer starved (a busy event loop).
    vi.setSystemTime(11500);
    playerSeek(30); // Processes the expired window first: one flush of 20.
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);

    vi.advanceTimersByTime(499); // Runs the overdue timer: no double send.
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    vi.advanceTimersByTime(1); // 30's own trailing deadline at 12000.
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 30]);
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it('bounds a sustained scrub to one beacon per second after the first', () => {
    h.play();
    for (let i = 0; i < 200; i++) {
      playerSeek(i);
      vi.advanceTimersByTime(50); // 20 requests per second for 10 s
    }
    vi.advanceTimersByTime(1000); // Quiescence.

    expect(h.sent('seeking').length).toBeLessThanOrEqual(11);
    expect(h.sent('seeking').at(-1)).toMatchObject({ seekTo: 199, seekSource: 'player' });
    expect(h.plugin.getMetrics().seekCount).toBe(200);
  });

  it('turns the production storm (1,041 requests over 51 s) into a bounded beacon run', () => {
    h.play();
    for (let i = 0; i < 1041; i++) {
      playerSeek(i);
      vi.advanceTimersByTime(49); // 1041 * 49 ms = 51,009 ms
    }
    vi.advanceTimersByTime(1000); // Quiescence.

    // A deterministic transport bound, not a claim about gesture behaviour:
    // one leading beacon plus at most one trailing beacon per started second.
    expect(h.sent('seeking').length).toBeLessThanOrEqual(53);
    expect(h.sent('seeking').at(-1)).toMatchObject({ seekTo: 1040, seekSource: 'player' });
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 1041, elementSeekCount: 0 });
  });

  it('resolves the target once at request time, from a finite payload time or state', () => {
    h.state.set('currentTime', 42);
    playerSeek(Number.NaN); // Invalid payload: state fallback.
    expect(h.sent('seeking')[0].seekTo).toBe(42);

    vi.advanceTimersByTime(1001);
    h.state.set('currentTime', 100);
    // No payload at all (an older emitter): state at request time.
    h.bus.emit('playback:seeking', undefined as unknown as { time: number });
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([42, 100]);

    // A pending target is the scalar resolved at request time: a later state
    // write does not rewrite it at the flush.
    vi.advanceTimersByTime(1001);
    playerSeek(200);
    playerSeek(300);
    h.state.set('currentTime', 999);
    vi.advanceTimersByTime(1000);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([42, 100, 200, 300]);
  });

  it('reads the cumulative seekCount at trailing emission, including intervening element seeks', () => {
    playerSeek(10);
    vi.advanceTimersByTime(500);
    playerSeek(20); // Pending; deadline 11000.
    vi.setSystemTime(11600); // Event-loop delay starves the timer.
    h.elementSeek(55); // 1,100 ms after the last request: no longer its echo.
    h.state.set('seeking', false);
    playerSeek(30); // Counts (4).
    // The held 20 flushed ahead of the element beacon with its own count.
    expect(h.sent('seeking').map((b) => [b.seekTo, b.seekCount, b.seekSource])).toEqual([
      [10, 1, 'player'], [20, 2, 'player'], [55, 3, 'element'], [30, 4, 'player'],
    ]);
    vi.advanceTimersByTime(400);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 55, 30]);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 4, elementSeekCount: 1 });
  });

  it('keeps echo suppression independent of emitted beacons: three requests, one echo, one late echo', () => {
    playerSeek(10);
    playerSeek(20);
    playerSeek(30); // Three requests, two beacons owed (leading + trailing).
    h.elementSeek(30); // The one element transition they coalesce into.
    h.state.set('seeking', false);
    expect(h.plugin.getMetrics().elementSeekCount).toBe(0);

    vi.advanceTimersByTime(1000); // Trailing flush of 30 at the deadline.
    expect(h.sent('seeking').map((b) => [b.seekTo, b.seekSource, b.seekCount])).toEqual([
      [10, 'player', 1], [30, 'player', 3],
    ]);

    vi.advanceTimersByTime(1001);
    h.elementSeek(40); // No live echo: an element seek of its own.
    h.state.set('seeking', false);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 30, 40]);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 4, elementSeekCount: 1 });
  });

  it('resets the window safely when the clock moves backwards between requests', () => {
    playerSeek(10);
    vi.advanceTimersByTime(500);
    playerSeek(20); // Pending.
    vi.setSystemTime(9000); // Backwards across the window start.
    playerSeek(30); // Delivers the held 20 once, then leads a fresh window.

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 30]);
    vi.advanceTimersByTime(5000); // No frozen suppression, no negative delay.
    expect(h.sent('seeking')).toHaveLength(3);
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it('cancels pending waiting on a coalesced request that sends no beacon', () => {
    h.play();
    playerSeek(10); // Beacon.
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(100);
    playerSeek(20); // Coalesced: no beacon, still cancels the rebuffer grace.
    vi.advanceTimersByTime(1000);

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.plugin.getMetrics().rebufferCount).toBe(0);
  });

  it('marks every raw request on a live view, beacon or not', async () => {
    await h.plugin.destroy();
    h = await createHarness({ heartbeatInterval: 1000, isLive: true });
    h.state.set('live', true);
    h.state.set('liveEdge', true);
    h.play();

    /** One metrics reading, in the provider's latency-then-edge order. */
    const reading = async (latency: number, atEdge: boolean) => {
      h.state.set('liveLatency', latency);
      h.bus.emit('live:latency', { latency });
      if (h.state.getValue('liveEdge') !== atEdge) {
        h.state.set('liveEdge', atEdge);
        h.bus.emit('live:edgechange', { atEdge });
      }
      await Promise.resolve();
    };

    await reading(3, true);
    playerSeek(10); // Beacon; latency sampling now awaits a fresh reading.
    h.state.set('seeking', true);
    h.state.set('seeking', false);
    await reading(4, true); // Settles back at the edge: 2 samples.
    playerSeek(20); // Coalesced, but still a live seek mark.
    h.state.set('seeking', true);
    h.state.set('seeking', false);
    await reading(900, false); // Settles into DVR only if 20 was marked.
    vi.advanceTimersByTime(1000); // Trailing flush of 20; heartbeat at 11000.

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('heartbeat').at(-1)).toMatchObject({ liveLatencySamples: 2, dvrTime: 1000 });
  });
});

// The window belongs to one view generation: every finalizer delivers the
// held target exactly once, ahead of that view's viewEnd, and nothing
// seek-related outlives the view or leaks into the next one.
describe('player seek coalescing lifecycle', () => {
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

  /** A player seek request on the bus, as core seek()/UI/gestures emit it. */
  function playerSeek(time: number): void {
    h.bus.emit('playback:seeking', { time });
  }

  it('flushes the pending target before a normal viewEnd, then sends nothing more', () => {
    playerSeek(10);
    playerSeek(20); // Pending when the view ends.
    h.bus.emit('playback:ended', undefined);

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('seeking')[1].beaconSeq).toBe(h.sent('viewEnd')[0].beaconSeq - 1);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(5000); // No orphan timer, no beacon after viewEnd.
    expect(h.sent('seeking')).toHaveLength(2);
    expect(h.beacons.at(-1)?.event).toBe('viewEnd');
  });

  it('flushes before a video change and lets nothing cross into the next view', () => {
    playerSeek(10);
    playerSeek(20); // Pending.
    h.plugin.setVideo({ videoId: 'next' });

    expect(h.sent('seeking').map((b) => [b.seekTo, b.videoId])).toEqual([
      [10, 'test-video'], [20, 'test-video'],
    ]);
    expect(h.sent('seeking')[1].seekCount).toBe(2);
    const newView = h.plugin.getViewId();

    playerSeek(30); // A fresh window in the new view: immediate again.
    expect(h.sent('seeking').at(-1)).toMatchObject({
      viewId: newView, videoId: 'next', seekTo: 30, seekCount: 1, beaconSeq: 2,
    });
    expect(h.sent('seeking')).toHaveLength(3);
    vi.advanceTimersByTime(2000); // Only 30's quiet close; no more beacons.
    expect(h.sent('seeking')).toHaveLength(3);
  });

  it('flushes before replay finalization and starts the replay view clean', () => {
    h.play();
    playerSeek(10);
    playerSeek(20); // Pending.
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:ended', undefined);
    const oldId = h.plugin.getViewId();
    const oldBeacons = h.beacons.slice();

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('viewEnd')[0]).toMatchObject({ viewId: oldId, seekCount: 2 });

    h.state.set('ended', false);
    h.play(); // paused false announces the request; playing true settles it.
    const newId = h.plugin.getViewId();
    playerSeek(30);

    expect(newId).not.toBe(oldId);
    expect(h.sent('seeking').at(-1)).toMatchObject({
      viewId: newId, seekTo: 30, seekCount: 1, beaconSeq: 4,
    });
    expect(h.beacons.filter((b) => b.viewId === oldId)).toEqual(oldBeacons);
    vi.advanceTimersByTime(2000);
    expect(h.sent('seeking')).toHaveLength(3);
  });

  it('flushes the pending target when the idle timeout finalizes the view', async () => {
    await h.plugin.destroy();
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 1500 });
    vi.advanceTimersByTime(1500); // One heartbeat at 11000; not yet idle.
    playerSeek(10);
    playerSeek(20); // Pending, deadline 12500 — but the view ends first.
    vi.advanceTimersByTime(500); // Heartbeat at 12000 sees the idle timeout.

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', seekCount: 2 });
    expect(h.sent('seeking')[1].beaconSeq).toBe(h.sent('viewEnd')[0].beaconSeq - 1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(h.sent('seeking')).toHaveLength(2);
  });

  it('flushes the pending target on destroy and leaves no timer behind', async () => {
    playerSeek(10);
    playerSeek(20); // Pending.
    await h.plugin.destroy();

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(h.sent('seeking')).toHaveLength(2);
  });

  it('flushes exactly once across pagehide and beforeunload, before the unload viewEnd', () => {
    playerSeek(10);
    playerSeek(20); // Pending.
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));

    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20]);
    expect(h.sent('viewEnd')).toHaveLength(1);
    // Two unload dispatches, in creation order: the trailing seeking, then
    // the unload viewEnd with the full cumulative count.
    expect(h.sent('seeking')[1].beaconSeq).toBe(h.sent('viewEnd')[0].beaconSeq - 1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ seekCount: 2 });

    vi.advanceTimersByTime(5000);
    expect(h.sent('seeking')).toHaveLength(2);
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it('flushes the pending target before the background heartbeat and batch flush', () => {
    h.play();
    playerSeek(10);
    playerSeek(20); // Pending.
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));

    const events = h.beacons.map((b) => b.event);
    expect(events).toEqual(['viewStart', 'playRequest', 'videoStart', 'seeking', 'seeking', 'heartbeat']);
    expect(h.sent('seeking')[1]).toMatchObject({ seekTo: 20, seekCount: 2 });
    expect(h.sent('heartbeat').at(-1)).toMatchObject({ seekCount: 2 });

    vi.advanceTimersByTime(2000); // The flushed window closes quietly.
    expect(h.sent('seeking')).toHaveLength(2);
  });

  it('flushes a pending player seek before a later element seek beacon', () => {
    h.bus.emit('playback:seeking', { time: 10 });
    h.bus.emit('playback:seeking', { time: 20 });
    h.elementSeek(10); // Echoes of the two requests.
    h.state.set('seeking', false);
    h.elementSeek(20);
    h.state.set('seeking', false);
    vi.advanceTimersByTime(500);
    h.elementSeek(40);
    h.state.set('seeking', false);
    vi.advanceTimersByTime(1000);

    const beacons = h.sent('seeking');
    expect(beacons.map((b) => b.seekTo)).toEqual([10, 20, 40]);
    expect(beacons.map((b) => b.seekSource)).toEqual(['player', 'player', 'element']);
    expect(beacons.map((b) => b.seekCount)).toEqual([1, 2, 3]);
  });
});
