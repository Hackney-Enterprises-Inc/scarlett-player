import { afterEach, describe, expect, it, vi } from 'vitest';
import { finitePercent } from '../src/helpers';
import { createHarness } from './harness';

// HEI-SCARLETT-43: the released 1.x wire meaning of the viewEnd gauges is
// percent, and stays percent. Both viewEnd transports declare it with
// `gaugeScale: 'percent'`, finite gauges are bounded to 0..100, and an
// unavailable gauge is null, never NaN, Infinity or an accidental 0.
describe('viewEnd gauge contract', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** The part of core's load() reset that matters here: no timeupdate. */
  const loadReset = (): void => {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.state.set('ended', false);
    h.state.set('currentTime', 0);
    h.state.set('duration', 0);
    h.state.set('live', false);
  };

  /** Position as a percentage of the harness duration (1000 s). */
  const positionFor = (percent: number): number => percent * 10;

  it.each([0, 0.5, 1, 15.14, 37.5])(
    'declares gaugeScale percent and %s%% completion on the full viewEnd',
    async (percent) => {
      vi.useFakeTimers();
      h = await createHarness({ heartbeatInterval: 60000 });
      h.play();
      h.state.set('currentTime', positionFor(percent));
      h.bus.emit('playback:timeupdate', { currentTime: positionFor(percent) });
      vi.advanceTimersByTime(1000);
      await h.plugin.destroy();

      const viewEnd = h.sent('viewEnd')[0];
      expect(viewEnd).toMatchObject({
        event: 'viewEnd',
        gaugeScale: 'percent',
        completionRate: percent,
        exitType: 'abandoned',
      });
      expect(Number(viewEnd.rebufferRatio)).toBeGreaterThanOrEqual(0);
      expect(Number(viewEnd.rebufferRatio)).toBeLessThanOrEqual(100);
      expect(Number.isFinite(viewEnd.rebufferRatio)).toBe(true);
    },
  );

  it('reports completion 100 for a completed VOD', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    vi.advanceTimersByTime(1000);
    h.state.set('currentTime', 1000);
    h.state.set('ended', true);
    h.bus.emit('playback:ended', undefined);

    expect(h.sent('viewEnd')[0]).toMatchObject({
      gaugeScale: 'percent',
      exitType: 'completed',
      completionRate: 100,
    });
  });

  it('keeps 100 for a completed view whose state was already reset', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('currentTime', 1000);
    // A host's own ended listener calls load() first, zeroing the state
    h.state.set('currentTime', 0);
    h.state.set('duration', 0);
    h.state.set('ended', true);
    h.bus.emit('playback:ended', undefined);

    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'completed', completionRate: 100 });
  });

  it('carries the marker and finite percent gauges on the unload viewEnd', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('currentTime', 375);
    h.bus.emit('playback:timeupdate', { currentTime: 375 });
    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('pagehide'));

    expect(h.sent('viewEnd')[0]).toMatchObject({
      gaugeScale: 'percent',
      completionRate: 37.5,
      exitType: 'abandoned',
    });
    expect(Number.isFinite(h.sent('viewEnd')[0].rebufferRatio)).toBe(true);
  });

  it('reports null completion on every live viewEnd, marker included', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000, isLive: true });
    h.play();
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({
      gaugeScale: 'percent',
      completionRate: null,
      isLive: true,
    });

    h = await createHarness({ heartbeatInterval: 60000, isLive: true });
    h.play();
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('pagehide'));

    expect(h.sent('viewEnd')[0]).toMatchObject({ gaugeScale: 'percent', completionRate: null });
  });

  it('reports null completion when no duration was ever known', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.state.set('duration', 0);
    h.play();
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ completionRate: null });
  });

  it('clamps a negative position to 0 and an over-duration position to 100', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('currentTime', -5);
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();
    expect(h.sent('viewEnd')[0]).toMatchObject({ completionRate: 0 });

    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('currentTime', 1200);
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();
    expect(h.sent('viewEnd')[0]).toMatchObject({ completionRate: 100 });
  });

  it('keeps the last known finite pair when a load() reset the state', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('currentTime', 500);
    h.bus.emit('playback:timeupdate', { currentTime: 500 });
    loadReset();
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ completionRate: 50 });
  });

  it('does not overwrite the trusted pair with Infinity or NaN', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    h.state.set('currentTime', 500);
    h.bus.emit('playback:timeupdate', { currentTime: 500 });
    // A live element reports Infinity duration and NaN positions
    h.state.set('duration', Infinity);
    h.state.set('currentTime', NaN);
    vi.advanceTimersByTime(3000); // heartbeats accrue without clobbering the pair
    await h.plugin.destroy();

    const viewEnd = h.sent('viewEnd')[0];
    expect(viewEnd.completionRate).toBe(50);
    expect(viewEnd).not.toMatchObject({ completionRate: NaN });
  });

  it('reports null completion when only a non-finite duration was ever known', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.state.set('duration', Infinity);
    h.play();
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ completionRate: null });
  });

  it('reports rebuffer as a percent of watch time without touching the counters', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    vi.advanceTimersByTime(2500);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(2500);
    await h.plugin.destroy();

    const viewEnd = h.sent('viewEnd')[0];
    expect(viewEnd.rebufferDuration).toBe(2500);
    expect(viewEnd.watchTime).toBe(5000);
    expect(viewEnd.rebufferRatio).toBe(50);
    expect(viewEnd).toMatchObject({ gaugeScale: 'percent' });
  });

  it('reports rebuffer 0 at zero finite watch time', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    await h.plugin.destroy();

    expect(h.sent('viewEnd')[0]).toMatchObject({ watchTime: 0, rebufferRatio: 0 });
  });

  // The accounting has rebuffer time accrue inside watch time, so a whole-view
  // stall is the most it can reach. No path produced rebufferDuration above
  // watchTime (HEI-SCARLETT-43 records the attempt); the clamp below is the
  // public-gauge guard for that invariant, not a substitute for an accounting
  // fix, and it never alters the raw counters.
  it('keeps the ratio at or below 100 for a stall spanning the whole view', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(10000);
    await h.plugin.destroy();

    const viewEnd = h.sent('viewEnd')[0];
    expect(Number(viewEnd.rebufferDuration)).toBeLessThanOrEqual(Number(viewEnd.watchTime));
    expect(Number(viewEnd.rebufferRatio)).toBeLessThanOrEqual(100);
    expect(Number(viewEnd.rebufferRatio)).toBeGreaterThan(90);
  });

  it('does not let a host custom dimension override the marker or the gauges', async () => {
    vi.useFakeTimers();
    h = await createHarness({
      heartbeatInterval: 60000,
      customDimensions: { gaugeScale: 'ratio', completionRate: 999, rebufferRatio: 999 },
    });
    h.play();
    h.state.set('currentTime', 375);
    h.bus.emit('playback:timeupdate', { currentTime: 375 });
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();

    const viewEnd = h.sent('viewEnd')[0];
    expect(viewEnd).toMatchObject({ gaugeScale: 'percent', completionRate: 37.5 });
    expect(viewEnd.rebufferRatio).not.toBe(999);
  });

  it('sends the marker on both viewEnd transports with the same keys', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();
    const full = Object.keys(h.sent('viewEnd')[0]).sort();

    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('pagehide'));
    const unload = Object.keys(h.sent('viewEnd')[0]).sort();

    expect(full).toContain('gaugeScale');
    expect(unload).toEqual(full);
  });
});

describe('finitePercent gauge helper', () => {
  it('computes a percentage of the denominator', () => {
    expect(finitePercent(375, 1000)).toBe(37.5);
    expect(finitePercent(1514, 10000)).toBe(15.14);
    expect(finitePercent(0, 1000)).toBe(0);
    expect(finitePercent(1000, 1000)).toBe(100);
  });

  it('clamps finite out-of-range percentages to the contract bounds', () => {
    expect(finitePercent(-5, 1000)).toBe(0);
    expect(finitePercent(1200, 1000)).toBe(100);
    // A broken accounting that exceeded watch time could not exceed 100
    expect(finitePercent(3000, 1000)).toBe(100);
  });

  it('rejects non-finite or invalid inputs deliberately', () => {
    expect(finitePercent(NaN, 1000)).toBeNull();
    expect(finitePercent(500, NaN)).toBeNull();
    expect(finitePercent(Infinity, 1000)).toBeNull();
    expect(finitePercent(500, Infinity)).toBeNull();
    expect(finitePercent(500, 0)).toBeNull();
    expect(finitePercent(500, -1)).toBeNull();
    expect(finitePercent(undefined as unknown as number, 1000)).toBeNull();
    expect(finitePercent(500, '1000' as unknown as number)).toBeNull();
  });
});
