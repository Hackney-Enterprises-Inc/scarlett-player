import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

describe('rebuffer grace', () => {
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

  it('drops an 11 ms waiting blip, excluding it from play but not watch time', async () => {
    h = await createHarness();
    h.play();
    vi.advanceTimersByTime(100);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(11);
    h.bus.emit('playback:play', undefined);
    vi.advanceTimersByTime(100);
    h.bus.emit('playback:ended', undefined);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.sent('rebufferEnd')).toHaveLength(0);
    expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 0, watchTime: 211, playTime: 200 });
  });

  it('opens at 250 ms and measures all 400 ms of a confirmed stall', async () => {
    h = await createHarness();
    h.play();
    vi.advanceTimersByTime(100);
    const started = Date.now();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(249);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(h.sent('rebufferStart')).toHaveLength(1);
    expect(h.sent('rebufferStart')[0]).toMatchObject({ timestamp: started + 250, rebufferCount: 1 });
    vi.advanceTimersByTime(150);
    h.bus.emit('playback:play', undefined);
    expect(h.sent('rebufferEnd')[0]).toMatchObject({ duration: 400, totalRebufferTime: 400 });
    expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 1, rebufferDuration: 400, watchTime: 500, playTime: 100 });
  });

  it('keeps zero-grace rebuffer beacons synchronous', async () => {
    h = await createHarness({ rebufferGraceMs: 0 });
    h.play();
    h.bus.emit('media:waiting', undefined);
    expect(h.sent('rebufferStart')).toHaveLength(1);
    h.bus.emit('playback:play', undefined);
    expect(h.sent('rebufferEnd')[0]).toMatchObject({ duration: 0 });
    expect(h.plugin.getMetrics().rebufferCount).toBe(1);
  });

  it.each(['pause', 'seek', 'viewEnd', 'unload', 'destroy', 'view switch', 'fatal error'] as const)(
    'cancels pending grace on %s without leaking a grace timer', async (action) => {
      h = await createHarness();
      h.play();
      h.bus.emit('media:waiting', undefined);
      vi.advanceTimersByTime(11);
      switch (action) {
        case 'pause': h.bus.emit('playback:pause', undefined); break;
        case 'seek': h.bus.emit('playback:seeking', { time: 50 }); break;
        case 'viewEnd': h.bus.emit('playback:ended', undefined); break;
        case 'unload': window.dispatchEvent(new Event('pagehide')); break;
        case 'destroy': await h.plugin.destroy(); break;
        case 'view switch': h.plugin.setVideo({ videoId: 'next' }); break;
        case 'fatal error': h.bus.emit('media:error', { error: Object.assign(new Error('fatal'), { fatal: true }) }); break;
      }
      // Pause/seek/new-view keep their normal heartbeat; no grace timer remains.
      expect(vi.getTimerCount()).toBe(['pause', 'seek', 'view switch'].includes(action) ? 1 : 0);
      vi.advanceTimersByTime(500);
      expect(h.sent('rebufferStart')).toHaveLength(0);
      expect(h.sent('rebufferEnd')).toHaveLength(0);
      expect(h.plugin.getMetrics().rebufferCount).toBe(0);
      await h.plugin.destroy();
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('does not credit pending grace to playTime at a heartbeat', async () => {
    h = await createHarness({ heartbeatInterval: 100 });
    h.play();
    vi.advanceTimersByTime(50);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(50);
    expect(h.sent('heartbeat')[0]).toMatchObject({ watchTime: 100, playTime: 50, rebufferCount: 0 });
    h.bus.emit('playback:play', undefined);
    expect(h.plugin.getMetrics().playTime).toBe(50);
  });

  it('drops the production element-seek tails of 11 ms and 0 ms', async () => {
    h = await createHarness();
    h.play();
    for (const delay of [11, 0]) {
      h.elementSeek(50 + delay);
      h.state.set('seeking', false);
      h.bus.emit('media:waiting', undefined);
      vi.advanceTimersByTime(delay);
      h.bus.emit('playback:play', undefined);
    }
    vi.advanceTimersByTime(250);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.sent('rebufferEnd')).toHaveLength(0);
    expect(h.plugin.getMetrics().rebufferCount).toBe(0);
  });

  it.each([-1, Number.NaN, Infinity, -Infinity])('uses 250 ms for invalid grace %s', async (rebufferGraceMs) => {
    h = await createHarness({ rebufferGraceMs });
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(249);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(h.sent('rebufferStart')).toHaveLength(1);
  });

  it('does not restart a pending grace on repeated waiting', async () => {
    h = await createHarness();
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(200);
    h.bus.emit('media:waiting', undefined);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(h.sent('rebufferStart')).toHaveLength(1);
    vi.advanceTimersByTime(100);
    h.bus.emit('playback:play', undefined);
    expect(h.sent('rebufferEnd')[0]?.duration).toBe(350);
  });
});
