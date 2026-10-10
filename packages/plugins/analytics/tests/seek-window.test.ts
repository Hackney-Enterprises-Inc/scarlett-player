/**
 * Unit tests for the seek emission window helper (HEI-SCARLETT-42) itself:
 * the edges the plugin harness cannot reach with vitest's fake clock, using
 * an injected manual clock — a timer firing after the clock moved backwards,
 * an early-firing timer, and callbacks invalidated by reset().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeekEmissionWindow } from '../src/seek-window';

describe('seek emission window helper', () => {
  let clock: number;
  let sent: Array<{ seekTo: number; unload: boolean }>;

  /** A window over a manual clock, recording every emission. */
  function makeWindow() {
    return createSeekEmissionWindow({
      intervalMs: 1000,
      emit: (seekTo) => sent.push({ seekTo, unload: false }),
      emitUnload: (seekTo) => sent.push({ seekTo, unload: true }),
      now: () => clock,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    clock = 10000;
    sent = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('delivers and closes instead of suppressing when the timer fires after the clock moved backwards', () => {
    const w = makeWindow();
    w.request(10); // Leading edge, window [10000, 11000).
    w.request(20); // Pending; timer armed for the deadline, 1000 ms out.
    clock = 5000; // The clock moves backwards while the timer is armed.
    vi.advanceTimersByTime(1000); // The armed timer fires with now < windowStart.

    expect(sent.map((s) => s.seekTo)).toEqual([10, 20]);
    w.request(30); // Suppression is not frozen: a fresh leading edge.
    expect(sent.map((s) => s.seekTo)).toEqual([10, 20, 30]);
    vi.advanceTimersByTime(5000);
    expect(sent).toHaveLength(3);
  });

  it('waits out the rest of the window when a timer fires ahead of its deadline', () => {
    const w = makeWindow();
    w.request(10);
    clock = 10500;
    w.request(20); // Pending; timer armed for 11000.
    clock = 10000; // Backwards, but still inside the window.
    vi.advanceTimersByTime(500); // The timer fires early: now < deadline.

    expect(sent.map((s) => s.seekTo)).toEqual([10]); // Nothing flushed early.
    clock = 11000;
    vi.advanceTimersByTime(1000); // The re-armed timer reaches the deadline.
    expect(sent.map((s) => s.seekTo)).toEqual([10, 20]);
  });

  it('invalidates an armed timer on reset, so nothing fires for a discarded window', () => {
    const w = makeWindow();
    w.request(10);
    w.request(20); // Pending.
    w.reset(); // New view: drop the target without sending.
    clock = 11000;
    vi.advanceTimersByTime(1000);

    expect(sent.map((s) => s.seekTo)).toEqual([10]);
    w.request(30); // The next window behaves like the first.
    clock = 11500;
    w.request(40);
    clock = 12000;
    vi.advanceTimersByTime(1000);
    expect(sent.map((s) => s.seekTo)).toEqual([10, 30, 40]);
  });

  it('end() delivers the pending target on the unload transport and closes the window', () => {
    const w = makeWindow();
    w.request(10);
    w.request(20); // Pending.
    w.end(true);

    expect(sent).toEqual([
      { seekTo: 10, unload: false },
      { seekTo: 20, unload: true },
    ]);
    clock = 11000;
    vi.advanceTimersByTime(2000); // The closed window owes nothing.
    expect(sent).toHaveLength(2);
    w.request(30); // A fresh leading edge afterwards.
    expect(sent.at(-1)).toEqual({ seekTo: 30, unload: false });
  });

  it('flushPending() delivers without closing, and the window then closes quietly', () => {
    const w = makeWindow();
    w.request(10);
    w.request(20); // Pending.
    w.flushPending(false); // The background-flush path.
    expect(sent.map((s) => s.seekTo)).toEqual([10, 20]);

    clock = 11000;
    vi.advanceTimersByTime(1000); // The deadline: no duplicate of 20.
    expect(sent).toHaveLength(2);
    w.request(30); // A new leading edge in a fresh window.
    expect(sent.map((s) => s.seekTo)).toEqual([10, 20, 30]);
  });
});
