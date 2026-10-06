import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

// HEI-27: `player.unload()` emits `source:unloaded`. Analytics ends the open
// view as abandoned with the full viewEnd; the next source's play starts a
// new view through the usual play-request path.
describe('ending the view on unload', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function unload(src: string | null = 'https://cdn.example.com/a.m3u8'): void {
    h.bus.emit('source:unloaded', { src });
  }

  it('ends the open view as abandoned, with its counters, and stops the heartbeat', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    vi.advanceTimersByTime(2500);
    h.state.set('playing', false);
    h.state.set('paused', true);
    unload();

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({
      exitType: 'abandoned',
      seekCount: 0,
      pauseCount: 0,
      qualityChanges: 0,
    });
    expect(h.sent('viewEnd')[0].playTime).toBeGreaterThanOrEqual(2500);

    const heartbeats = h.sent('heartbeat').length;
    vi.advanceTimersByTime(5000);
    expect(h.sent('heartbeat')).toHaveLength(heartbeats);
  });

  it('is a no-op on a view that already ended', async () => {
    h = await createHarness();
    h.play();
    h.bus.emit('media:error', { error: Object.assign(new Error('boom'), { fatal: true }) });
    unload();

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'error' });
  });

  it('starts a new view when a newly loaded source plays', async () => {
    h = await createHarness();
    h.play();
    unload();
    const firstViewId = h.sent('viewEnd')[0].viewId;

    h.state.set('playing', false);
    h.state.set('paused', true);
    h.state.set('source', { src: 'https://cdn.example.com/b.m3u8' } as never);
    h.play();

    expect(h.sent('viewStart')).toHaveLength(2);
    const secondViewId = h.sent('viewStart')[1].viewId;
    expect(secondViewId).not.toBe(firstViewId);
    expect(h.sent('playRequest').at(-1)?.viewId).toBe(secondViewId);
    expect(h.sent('videoStart').at(-1)?.viewId).toBe(secondViewId);
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it('closes an outage still open at unload', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.bus.emit('error:reconnecting', { attempt: 1, delayMs: 2000, elapsedMs: 0 });
    vi.advanceTimersByTime(1500);
    unload();

    expect(h.sent('viewEnd')[0]).toMatchObject({
      exitType: 'abandoned',
      reconnectCount: 1,
      reconnectDuration: 1500,
      rebufferCount: 1,
      rebufferDuration: 1500,
    });
  });

  it('settles an open pause once and clears it before the next view', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 60000 });
    h.play();
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
    vi.advanceTimersByTime(2000);
    unload();
    unload();

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 2000, exitType: 'abandoned' });
    vi.advanceTimersByTime(1000);
    h.play();
    expect(h.sent('viewStart')).toHaveLength(2);
    expect(h.plugin.getMetrics()).toMatchObject({ pauseCount: 0, pauseDuration: 0, reconnectCount: 0, reconnectDuration: 0 });
  });
});
