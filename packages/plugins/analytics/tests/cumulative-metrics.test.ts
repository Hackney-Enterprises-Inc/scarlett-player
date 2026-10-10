import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
import { calculateQoEScore } from '../src/helpers';

// HEI-31, HEI-34: the heartbeat, the full viewEnd and the unload viewEnd are
// built from one set of cumulative metrics, so none of them can lose a
// counter again, and a bitrate nothing measured is null rather than 0.
describe('cumulative metrics', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  const COUNTERS = ['maxBitrate', 'avgBitrate', 'qualityChanges', 'pauseCount', 'pauseDuration', 'seekCount', 'errorCount'];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Offer two quality levels to switch between. */
  function offerQualities(): void {
    h.state.set('qualities', [
      { id: 'low', label: 'low', bitrate: 1000000, width: 640, height: 360, active: false },
      { id: 'high', label: 'high', bitrate: 3000000, width: 1920, height: 1080, active: false },
    ]);
  }

  /** Pause playback the way a provider reports it. */
  function pause(): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
  }

  it('carries every counter on the heartbeat', async () => {
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    vi.advanceTimersByTime(1000);

    const heartbeat = h.sent('heartbeat')[0];
    for (const key of COUNTERS) expect(heartbeat).toHaveProperty(key);
    expect(heartbeat).toMatchObject({ qualityChanges: 0, pauseCount: 0, pauseDuration: 0, seekCount: 0, errorCount: 0 });
  });

  it('carries every counter and the final scores on the unload viewEnd', async () => {
    h = await createHarness({ heartbeatInterval: 100000 });
    h.play();
    h.bus.emit('playback:seeking', { time: 40 });
    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('pagehide'));

    const viewEnd = h.sent('viewEnd')[0];
    for (const key of [...COUNTERS, 'rebufferRatio', 'qoeScore', 'qoeVersion', 'completionRate']) {
      expect(viewEnd).toHaveProperty(key);
    }
    expect(viewEnd).toMatchObject({ seekCount: 1, qoeVersion: 2, exitType: 'abandoned' });
    expect(viewEnd.qoeScore).toBeGreaterThan(0);
  });

  it('sends the same counters on the full and the unload viewEnd', async () => {
    h = await createHarness({ heartbeatInterval: 100000 });
    h.play();
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();
    const full = Object.keys(h.sent('viewEnd')[0]).sort();

    h = await createHarness({ heartbeatInterval: 100000 });
    h.play();
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('pagehide'));
    const unload = Object.keys(h.sent('viewEnd')[0]).sort();

    expect(unload).toEqual(full);
  });

  describe('bitrate', () => {
    it('is null on every beacon until a quality change supplies one', async () => {
      h = await createHarness({ heartbeatInterval: 1000 });
      h.play();
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event('pagehide'));

      expect(h.sent('heartbeat')[0]).toMatchObject({ maxBitrate: null, avgBitrate: null });
      expect(h.sent('viewEnd')[0]).toMatchObject({ maxBitrate: null, avgBitrate: null });
      expect(h.plugin.getMetrics()).toMatchObject({ maxBitrate: null, avgBitrate: null });
    });

    it('stays null for a level with no known bitrate', async () => {
      h = await createHarness({ heartbeatInterval: 1000 });
      h.state.set('qualities', [{ id: 'auto', label: 'auto', bitrate: 0, width: 0, height: 0, active: false }]);
      h.play();
      h.bus.emit('quality:change', { quality: 'auto', auto: true });
      vi.advanceTimersByTime(1000);

      expect(h.sent('heartbeat')[0]).toMatchObject({ qualityChanges: 1, maxBitrate: null, avgBitrate: null });
      expect(h.sent('qualityChange')).toHaveLength(1);
      expect(h.sent('qualityChange')[0]).toMatchObject({ bitrate: 0 });
    });

    it.each(['destroy', 'pagehide'])('weights unequal intervals and gives an immediate switch no extra weight on %s', async (exit) => {
      h = await createHarness({ heartbeatInterval: 100000 });
      offerQualities();
      h.play();
      h.bus.emit('quality:change', { quality: 'low', auto: true });
      vi.advanceTimersByTime(3000);
      h.bus.emit('quality:change', { quality: 'high', auto: true });
      vi.advanceTimersByTime(1000);
      h.bus.emit('quality:change', { quality: 'low', auto: true });
      if (exit === 'destroy') await h.plugin.destroy();
      else window.dispatchEvent(new Event('pagehide'));

      expect(h.sent('heartbeat')).toHaveLength(0);
      expect(h.sent('viewEnd')[0]).toMatchObject({ avgBitrate: 1500000, maxBitrate: 3000000, qualityChanges: 3 });
    });

    it('reports the time-weighted average in the diagnostics snapshot after the view ends', async () => {
      h = await createHarness({ heartbeatInterval: 100000 });
      offerQualities();
      h.play();
      h.bus.emit('quality:change', { quality: 'low', auto: true });
      vi.advanceTimersByTime(10000);
      h.bus.emit('quality:change', { quality: 'high', auto: true });
      vi.advanceTimersByTime(10000);
      window.dispatchEvent(new Event('pagehide'));

      const settled = h.plugin.getMetrics().avgBitrate;
      expect(settled).toBe(2000000);
      expect(h.plugin.getDiagnostics().metrics.avgBitrate).toBe(settled);
    });

    it('is current on a viewEnd sent between heartbeats', async () => {
      h = await createHarness({ heartbeatInterval: 100000 });
      offerQualities();
      h.play();
      h.bus.emit('quality:change', { quality: 'low', auto: true });
      vi.advanceTimersByTime(1000);
      h.bus.emit('quality:change', { quality: 'high', auto: true });
      vi.advanceTimersByTime(1000);
      await h.plugin.destroy();

      expect(h.sent('heartbeat')).toHaveLength(0);
      expect(h.sent('viewEnd')[0]).toMatchObject({ maxBitrate: 3000000, avgBitrate: 2000000, qualityChanges: 2 });
    });

    it('is current on the heartbeat', async () => {
      h = await createHarness({ heartbeatInterval: 2000 });
      offerQualities();
      h.play();
      h.bus.emit('quality:change', { quality: 'high', auto: true });
      vi.advanceTimersByTime(1000);
      h.bus.emit('quality:change', { quality: 'low', auto: true });
      vi.advanceTimersByTime(1000);

      expect(h.sent('heartbeat')[0]).toMatchObject({ maxBitrate: 3000000, avgBitrate: 2000000 });
    });

    it('scores null as no bitrate factor, the same as before', () => {
      const base = { startupTime: 4000, rebufferCount: 0, rebufferDuration: 0, watchTime: 10000, warningCount: 0, exitType: null, fatalErrorCategory: null };
      expect(calculateQoEScore({ ...base, maxBitrate: null })).toBe(calculateQoEScore({ ...base, maxBitrate: 0 }));
      expect(calculateQoEScore({ ...base, maxBitrate: null })).toBe(75);
    });
  });

  describe('pause duration', () => {
    it('includes a pause in progress on the heartbeat without settling it', async () => {
      h = await createHarness({ heartbeatInterval: 3000 });
      h.play();
      pause();
      vi.advanceTimersByTime(3000);

      expect(h.sent('heartbeat')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 3000 });
      expect(h.plugin.getMetrics().pauseDuration).toBeLessThanOrEqual(2000);
    });

    it('counts a resume after a heartbeat once', async () => {
      h = await createHarness({ heartbeatInterval: 3000 });
      h.play();
      pause();
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(2000);
      h.play();
      await h.plugin.destroy();

      expect(h.sent('heartbeat')[0]?.pauseDuration).toBe(3000);
      expect(h.sent('viewEnd')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 5000 });
    });

    it('settles a pause still open when the view ends', async () => {
      h = await createHarness({ heartbeatInterval: 3000 });
      h.play();
      pause();
      vi.advanceTimersByTime(4000);
      await h.plugin.destroy();

      expect(h.sent('heartbeat')[0]?.pauseDuration).toBe(3000);
      expect(h.sent('viewEnd')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 4000 });
      expect(h.plugin.getMetrics().pauseDuration).toBe(4000);
    });

    it('settles a pause still open when the page unloads, once', async () => {
      h = await createHarness({ heartbeatInterval: 100000 });
      h.play();
      pause();
      vi.advanceTimersByTime(2500);
      window.dispatchEvent(new Event('pagehide'));
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event('beforeunload'));

      expect(h.sent('viewEnd')).toHaveLength(1);
      expect(h.sent('viewEnd')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 2500 });
      expect(h.plugin.getMetrics().pauseDuration).toBe(2500);
    });

    it('does not count the settled pause again when playback resumes after the view ended', async () => {
      h = await createHarness({ heartbeatInterval: 100000 });
      h.play();
      pause();
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('pagehide'));
      vi.advanceTimersByTime(2000);
      h.play();

      expect(h.plugin.getMetrics().pauseDuration).toBeLessThanOrEqual(2000);
    });
  });

  it('keeps the unload viewEnd well under the 64 KiB sendBeacon limit with custom dimensions', async () => {
    const unload = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { userAgent: navigator.userAgent, sendBeacon: unload });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const customDimensions = Object.fromEntries(
      Array.from({ length: 50 }, (_v, i) => [`dimension${i}`, 'x'.repeat(100)])
    );
    h = await createHarness({ customBeacon: undefined, customDimensions, heartbeatInterval: 100000 });
    h.play();
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('pagehide'));

    expect(unload).toHaveBeenCalledTimes(1);
    const body = unload.mock.calls[0][1] as Blob;
    expect(body.size).toBeLessThan(16 * 1024);
  });
});
