import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import { createHarness } from './harness';

// HEI-26, SCAR-ANALYTICS-15: a provider that will auto-reconnect marks its
// fatal error with `detail.reconnecting`. The view stays open across the
// outage, which is reported as reconnect beacons, counters and a rebuffer;
// only a terminal failure ends it as `error`.
describe('reconnect reporting', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** The fatal `error` a provider emits when auto-reconnect will follow. */
  function markedFatal(): void {
    h.bus.emit('error', {
      code: ErrorCode.MEDIA_NETWORK_ERROR,
      message: 'HLS error: levelLoadTimeOut',
      fatal: true,
      timestamp: Date.now(),
      detail: { type: 'network', retriesExhausted: true, attempts: 0, reconnecting: true },
    });
  }

  function reconnecting(attempt: number, extra: Record<string, unknown> = {}): void {
    h.bus.emit('error:reconnecting', { attempt, delayMs: 2000, elapsedMs: (attempt - 1) * 2000, windowMs: Infinity, ...extra });
  }

  /** The marked fatal and the first `error:reconnecting` that follows it. */
  function outage(): void {
    markedFatal();
    reconnecting(1);
  }

  /** The terminal error a provider emits when its reconnect window closes. */
  function exhausted(): void {
    h.bus.emit('error', {
      code: ErrorCode.MEDIA_NETWORK_ERROR,
      message: 'HLS auto-reconnect gave up',
      fatal: true,
      timestamp: Date.now(),
      detail: { type: 'network', retriesExhausted: true, attempts: 3, reconnectExhausted: true },
    });
  }

  it('reports a marked fatal as a reconnecting warning and keeps the view open', async () => {
    h = await createHarness();
    h.play();
    markedFatal();

    expect(h.sent('viewEnd')).toEqual([]);
    expect(h.sent('error')).toHaveLength(1);
    expect(h.sent('error')[0]).toMatchObject({
      fatal: true,
      errorSeverity: 'warning',
      reconnecting: true,
      errorCategory: 'network',
    });
    expect(h.plugin.getMetrics()).toMatchObject({
      errorCount: 1,
      warningCount: 1,
      fatalErrorCategory: null,
      exitType: null,
    });
    expect(h.plugin.getQoEScore()).not.toBe(0);
  });

  it('keeps the view open on a marked media:error too', async () => {
    h = await createHarness();
    h.play();
    h.bus.emit('media:error', {
      error: Object.assign(new Error('lost'), { fatal: true, detail: { reconnecting: true } }),
    });

    expect(h.sent('viewEnd')).toEqual([]);
    expect(h.sent('error')[0]).toMatchObject({ errorSeverity: 'warning', reconnecting: true });
    expect(h.plugin.getMetrics().warningCount).toBe(1);
  });

  it('sends one reconnecting beacon per outage, not one per attempt', async () => {
    h = await createHarness();
    h.play();
    outage();
    reconnecting(2);
    reconnecting(3);

    const sent = h.sent('reconnecting');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ attempt: 1, delayMs: 2000, elapsedMs: 0 });
    expect(h.plugin.getMetrics().reconnectCount).toBe(1);
  });

  it('carries only the fields the payload provides', async () => {
    h = await createHarness();
    h.play();
    h.bus.emit('error:reconnecting', { attempt: 1, delayMs: 3000 });

    const [sent] = h.sent('reconnecting');
    expect(sent).toMatchObject({ attempt: 1, delayMs: 3000 });
    expect(sent).not.toHaveProperty('elapsedMs');
  });

  it('repeats the reconnecting beacon once for a long outage', async () => {
    h = await createHarness();
    h.play();
    outage();
    reconnecting(21, { longOutage: true, delayMs: 0, elapsedMs: 610000 });
    reconnecting(21);
    reconnecting(22, { longOutage: true, delayMs: 0, elapsedMs: 640000 });

    const sent = h.sent('reconnecting');
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ attempt: 21, elapsedMs: 610000, longOutage: true });
  });

  it('counts the outage as a rebuffer and sends recovered with its duration', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    vi.advanceTimersByTime(1000);
    outage();

    expect(h.sent('rebufferStart')).toHaveLength(1);
    expect(h.plugin.getMetrics().rebufferCount).toBe(1);

    vi.advanceTimersByTime(4000);
    h.bus.emit('error:recovered', { attempt: 2, elapsedMs: 4000 });

    expect(h.sent('rebufferEnd')).toHaveLength(1);
    expect(h.sent('rebufferEnd')[0]).toMatchObject({ duration: 4000 });
    expect(h.sent('recovered')).toHaveLength(1);
    expect(h.sent('recovered')[0]).toMatchObject({ duration: 4000, attempt: 2, elapsedMs: 4000 });
    expect(h.plugin.getMetrics()).toMatchObject({
      reconnectCount: 1,
      reconnectDuration: 4000,
      rebufferDuration: 4000,
      playTime: 1000,
    });
    expect(h.sent('viewStart')).toHaveLength(1);
    expect(h.sent('viewEnd')).toEqual([]);
  });

  it('confirms a waiting still in its grace as the outage rebuffer, from the waiting', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000, rebufferGraceMs: 250 });
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(100);
    outage();
    vi.advanceTimersByTime(1000);
    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 1000 });

    expect(h.sent('rebufferStart')).toHaveLength(1);
    expect(h.sent('rebufferEnd')[0]).toMatchObject({ duration: 1100 });
  });

  it('opens no second rebuffer when one is already open', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000, rebufferGraceMs: 0 });
    h.play();
    h.bus.emit('media:waiting', undefined);
    outage();

    expect(h.sent('rebufferStart')).toHaveLength(1);
    expect(h.plugin.getMetrics().rebufferCount).toBe(1);
  });

  // The same rule as a `waiting`: startup is not a rebuffer, and a pause
  // closes one. The outage itself is still counted and timed.
  it('does not count an outage as rebuffering before the first frame or while paused', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    outage();
    vi.advanceTimersByTime(1000);
    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 10 });
    expect(h.sent('rebufferStart')).toHaveLength(0);

    h.play();
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
    outage();
    vi.advanceTimersByTime(2000);
    h.bus.emit('error:recovered', undefined);

    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.sent('rebufferEnd')).toHaveLength(0);
    expect(h.sent('reconnecting')).toHaveLength(2);
    expect(h.sent('recovered')).toHaveLength(2);
    expect(h.plugin.getMetrics()).toMatchObject({
      rebufferCount: 0, rebufferDuration: 0, reconnectCount: 2, reconnectDuration: 3000,
    });
  });

  it('carries reconnectCount and reconnectDuration on heartbeats and the viewEnd', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 0 });
    h.play();
    outage();
    vi.advanceTimersByTime(1000);

    expect(h.sent('heartbeat').at(-1)).toMatchObject({ reconnectCount: 1, reconnectDuration: 1000 });

    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 1500 });
    vi.advanceTimersByTime(500);
    outage();
    vi.advanceTimersByTime(500);
    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 500 });
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ reconnectCount: 2, reconnectDuration: 1500 });
  });

  it('reports zero reconnects on a view without an outage', async () => {
    h = await createHarness();
    h.play();
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ reconnectCount: 0, reconnectDuration: 0 });
  });

  it.each(['destroy', 'pagehide', 'source:unloaded'] as const)('settles an open outage and its rebuffer once at %s', async (end) => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    outage();
    vi.advanceTimersByTime(2000);
    if (end === 'destroy') await h.plugin.destroy();
    else if (end === 'pagehide') window.dispatchEvent(new Event('pagehide'));
    else h.bus.emit('source:unloaded', { src: null });

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ reconnectCount: 1, reconnectDuration: 2000, rebufferCount: 1, rebufferDuration: 2000, playTime: 0 });
    vi.advanceTimersByTime(1000);
    h.bus.emit('error:recovered', undefined);
    await h.plugin.destroy();
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('recovered')).toEqual([]);
    expect(h.plugin.getMetrics()).toMatchObject({ reconnectDuration: 2000, rebufferDuration: 2000 });
  });

  it('ends the view as error on exhaustion, with the open outage counted', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000, idleTimeout: 0 });
    h.play();
    outage();
    vi.advanceTimersByTime(3000);
    reconnecting(2);
    exhausted();

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({
      exitType: 'error',
      reconnectCount: 1,
      reconnectDuration: 3000,
      fatalErrorCategory: 'network',
    });
    expect(h.sent('error').at(-1)).toMatchObject({ errorSeverity: 'fatal', reconnectExhausted: true });
    expect(h.sent('error').at(-1)).not.toHaveProperty('reconnecting');
    expect(h.sent('rebufferEnd')).toHaveLength(1);
  });

  it('ends the view as error on a terminal failure without the marker', async () => {
    h = await createHarness();
    h.play();
    outage();
    h.bus.emit('error', {
      code: ErrorCode.SOURCE_LOAD_FAILED,
      message: 'WHEP: stream not found (404)',
      fatal: true,
      timestamp: Date.now(),
      detail: { type: 'network', httpStatus: 404, attempts: 1 },
    });

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'error' });
  });

  it('sends no recovered beacon for a recovery without a reconnecting', async () => {
    h = await createHarness();
    h.play();
    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 100 });

    expect(h.sent('recovered')).toEqual([]);
    expect(h.plugin.getMetrics().reconnectCount).toBe(0);
  });

  describe('an outage that outlasts idleTimeout', () => {
    it('ends the view as abandoned and opens a clean one at recovery', async () => {
      vi.useFakeTimers();
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
      h.play();
      outage();
      vi.advanceTimersByTime(5000);

      expect(h.sent('viewEnd')).toHaveLength(1);
      const ended = h.sent('viewEnd')[0];
      expect(ended).toMatchObject({ exitType: 'abandoned', reconnectCount: 1, reconnectDuration: 5000 });
      const closedViewId = ended.viewId;

      // The provider keeps trying; the closed view hears none of it
      const before = h.beacons.length;
      reconnecting(2);
      reconnecting(3, { longOutage: true });
      expect(h.beacons.length).toBe(before);

      vi.advanceTimersByTime(2000);
      h.bus.emit('error:recovered', { attempt: 3, elapsedMs: 7000 });

      expect(h.sent('viewStart')).toHaveLength(2);
      const opened = h.sent('viewStart')[1].viewId;
      expect(opened).not.toBe(closedViewId);
      expect(h.sent('recovered')).toEqual([]);
      expect(h.sent('videoStart').at(-1)?.viewId).toBe(opened);
      expect(h.plugin.getMetrics()).toMatchObject({
        reconnectCount: 0,
        reconnectDuration: 0,
        rebufferCount: 0,
        rebufferDuration: 0,
      });

      // Nothing from the old outage leaks: a later outage is this view's first
      outage();
      vi.advanceTimersByTime(1000);
      h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 1000 });
      expect(h.sent('reconnecting').at(-1)?.viewId).toBe(opened);
      expect(h.sent('recovered')).toHaveLength(1);
      expect(h.sent('recovered')[0]).toMatchObject({ viewId: opened, duration: 1000 });
      expect(h.plugin.getMetrics()).toMatchObject({ reconnectCount: 1, reconnectDuration: 1000, rebufferCount: 1 });
    });
  });
});
