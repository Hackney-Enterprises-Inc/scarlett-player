import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

// HEI-33: a view left paused, stalled or never started stops reporting after
// `idleTimeout`, and playback that comes back opens exactly one new view.
describe('idle timeout', () => {
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

  /** Pause playback the way a provider reports it. */
  function pause(): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
  }

  /** Beacons of one event type sent for one view. */
  function sentIn(viewId: string, event: string) {
    return h.sent(event).filter((beacon) => beacon.viewId === viewId);
  }

  it('ends a paused view as abandoned after idleTimeout and stops its heartbeat', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    vi.advanceTimersByTime(2000);
    pause();
    vi.advanceTimersByTime(4000);
    expect(h.sent('viewEnd')).toHaveLength(0);

    vi.advanceTimersByTime(1000);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', watchTime: 7000, playTime: 2000 });

    const heartbeats = h.sent('heartbeat').length;
    vi.advanceTimersByTime(60000);
    expect(h.sent('heartbeat')).toHaveLength(heartbeats);
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it('settles the open pause once on an idle end', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    pause();
    vi.advanceTimersByTime(5000);

    expect(h.sent('viewEnd')[0]).toMatchObject({ pauseCount: 1, pauseDuration: 5000 });
    expect(h.plugin.getMetrics().pauseDuration).toBe(5000);

    // Resuming opens a new view that inherits none of the old pause
    vi.advanceTimersByTime(3000);
    h.play();
    vi.advanceTimersByTime(1000);
    const heartbeat = h.sent('heartbeat').at(-1)!;
    expect(heartbeat.viewId).not.toBe(h.sent('viewEnd')[0].viewId);
    expect(heartbeat).toMatchObject({ pauseCount: 0, pauseDuration: 0 });
  });

  it('keeps a playing view open past idleTimeout', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    vi.advanceTimersByTime(60000);

    expect(h.sent('viewEnd')).toHaveLength(0);
    expect(h.sent('heartbeat')).toHaveLength(60);
  });

  it('ends a view that never played', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    vi.advanceTimersByTime(5000);

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned' });
  });

  it('defaults to 30 minutes', async () => {
    h = await createHarness({ heartbeatInterval: 10000 });
    h.play();
    pause();
    vi.advanceTimersByTime(30 * 60 * 1000 - 10000);
    expect(h.sent('viewEnd')).toHaveLength(0);

    vi.advanceTimersByTime(10000);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned' });
  });

  it.each([0, -1, Number.NaN])('treats %s as the given rule (0 disables, invalid uses the default)', async (idleTimeout) => {
    h = await createHarness({ heartbeatInterval: 10000, idleTimeout });
    h.play();
    pause();
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(h.sent('viewEnd')).toHaveLength(idleTimeout === 0 ? 0 : 1);
  });

  it('counts a stall as not playing', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000, rebufferGraceMs: 0 });
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(5000);

    expect(h.sent('rebufferEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', rebufferDuration: 5000 });
  });

  it('ends a view whose core play request never reached a frame, with no play time', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    // ScarlettPlayer.play() emits this before the element has started
    h.bus.emit('playback:play', undefined);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(5000);

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', watchTime: 5000, playTime: 0 });
  });

  it('counts no play time between a core play request and the first frame', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 60000 });
    h.bus.emit('playback:play', undefined);
    vi.advanceTimersByTime(3000);
    h.state.set('paused', false);
    h.state.set('playing', true);
    vi.advanceTimersByTime(2000);

    expect(h.sent('heartbeat').at(-1)).toMatchObject({ watchTime: 5000, playTime: 2000 });
  });

  it('ends a playing view that a load without autoplay left stopped, with no pause event', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    vi.advanceTimersByTime(1500);
    // core load() resets the state; the old element is gone, so no
    // playback:pause follows
    h.state.update({ playing: false, paused: true });
    vi.advanceTimersByTime(4500);
    expect(h.sent('viewEnd')).toHaveLength(0);

    vi.advanceTimersByTime(1000);
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', watchTime: 7000, playTime: 1500 });
  });

  describe('reopening', () => {
    it('starts one new view on a play after an idle end with a request still pending', async () => {
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
      // A request that never reached a first frame
      h.state.set('paused', false);
      expect(h.sent('playRequest')).toHaveLength(1);
      vi.advanceTimersByTime(5000);
      const ended = h.sent('viewEnd')[0];
      expect(ended).toMatchObject({ exitType: 'abandoned' });

      // core play() again: playback:play while `playing` is still false
      h.bus.emit('playback:play', undefined);

      const starts = h.sent('viewStart');
      expect(starts).toHaveLength(2);
      const viewId = starts[1].viewId;
      expect(viewId).not.toBe(ended.viewId);
      expect(sentIn(viewId, 'playRequest')).toHaveLength(1);

      vi.advanceTimersByTime(3000);
      expect(sentIn(viewId, 'heartbeat')).toHaveLength(3);
      expect(h.sent('viewStart')).toHaveLength(2);
    });

    it('starts one new view when a stall outlasting idleTimeout recovers by itself', async () => {
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000, rebufferGraceMs: 0 });
      h.play();
      h.bus.emit('media:waiting', undefined);
      vi.advanceTimersByTime(8000);
      const ended = h.sent('viewEnd')[0];
      expect(ended).toMatchObject({ exitType: 'abandoned' });

      // The element's `playing` after a stall: `playing` never went false,
      // so only playback:play reaches the bus
      h.bus.emit('playback:play', undefined);

      const starts = h.sent('viewStart');
      expect(starts).toHaveLength(2);
      const viewId = starts[1].viewId;
      expect(sentIn(viewId, 'videoStart')).toHaveLength(1);
      expect(sentIn(viewId, 'videoStart')[0]).toMatchObject({ startupTime: null });
      expect(sentIn(viewId, 'rebufferEnd')).toHaveLength(0);

      vi.advanceTimersByTime(3000);
      expect(sentIn(viewId, 'heartbeat')).toHaveLength(3);
      expect(sentIn(viewId, 'heartbeat').at(-1)).toMatchObject({ playTime: 3000, rebufferCount: 0 });
      expect(h.sent('viewStart')).toHaveLength(2);
      expect(h.sent('viewEnd')).toHaveLength(1);
    });

    it('starts one new view when a reconnect recovers after idleTimeout', async () => {
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000, rebufferGraceMs: 0 });
      h.play();
      h.bus.emit('media:waiting', undefined);
      vi.advanceTimersByTime(8000);
      expect(h.sent('viewEnd')).toHaveLength(1);

      h.bus.emit('error:recovered', { attempt: 2, elapsedMs: 8000 });
      // The provider's own resume follows
      h.bus.emit('playback:play', undefined);

      const starts = h.sent('viewStart');
      expect(starts).toHaveLength(2);
      expect(sentIn(starts[1].viewId, 'videoStart')).toHaveLength(1);
      vi.advanceTimersByTime(3000);
      expect(sentIn(starts[1].viewId, 'heartbeat')).toHaveLength(3);
      expect(h.sent('viewStart')).toHaveLength(2);
    });

    it('does not reopen on a recovery while the viewer is paused', async () => {
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
      h.play();
      pause();
      vi.advanceTimersByTime(5000);
      expect(h.sent('viewEnd')).toHaveLength(1);

      h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 3000 });
      vi.advanceTimersByTime(3000);

      expect(h.sent('viewStart')).toHaveLength(1);
      expect(h.sent('heartbeat').filter((b) => b.timestamp > 15000)).toHaveLength(0);
    });

    it('starts one new view when `playing` turns true after an idle end', async () => {
      h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
      h.play();
      pause();
      vi.advanceTimersByTime(5000);

      // An element-driven resume: `paused` and `playing` change, then playback:play
      h.play();

      const starts = h.sent('viewStart');
      expect(starts).toHaveLength(2);
      expect(sentIn(starts[1].viewId, 'videoStart')).toHaveLength(1);
      expect(sentIn(starts[1].viewId, 'playRequest')).toHaveLength(1);
    });
  });

  it.each(['fatal', 'ended', 'pagehide', 'destroy'])('does not reopen on late resume signals after %s', async (reason) => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    if (reason === 'fatal') {
      h.bus.emit('media:error', { error: Object.assign(new Error('boom'), { fatal: true }) });
    } else if (reason === 'ended') {
      h.bus.emit('playback:ended', undefined);
    } else if (reason === 'pagehide') {
      window.dispatchEvent(new Event('pagehide'));
    } else {
      await h.plugin.destroy();
    }
    const starts = h.sent('viewStart').length;
    const frames = h.sent('videoStart').length;
    h.bus.emit('error:recovered', { attempt: 1, elapsedMs: 1000 });
    h.state.set('playing', false);
    h.state.set('playing', true);
    h.bus.emit('playback:play', undefined);
    vi.advanceTimersByTime(1000);
    expect(h.sent('viewStart')).toHaveLength(starts);
    expect(h.sent('videoStart')).toHaveLength(frames);
    expect(h.sent('heartbeat')).toHaveLength(0);
  });

  // A pagehide is not always the end of the page: bfcache restores it, and a
  // cancelled beforeunload never leaves. A play after either is a new view.
  it.each(['pagehide', 'beforeunload'])('starts a new view on a play request after %s', async (event) => {
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    window.dispatchEvent(new Event(event));
    expect(h.sent('viewEnd')).toHaveLength(1);

    h.state.set('playing', false);
    h.state.set('paused', true);
    h.play();
    vi.advanceTimersByTime(1000);

    const starts = h.sent('viewStart');
    expect(starts).toHaveLength(2);
    expect(sentIn(starts[1].viewId, 'playRequest')).toHaveLength(1);
    expect(sentIn(starts[1].viewId, 'heartbeat')).toHaveLength(1);
  });

  it('ends an idle background view as abandoned with its counters', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    pause();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'abandoned', pauseCount: 1, pauseDuration: 5000 });
  });

  it('measures idle time from a pause after prolonged continuous playback', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    h.play();
    vi.advanceTimersByTime(60250);
    pause();
    vi.advanceTimersByTime(4749);
    expect(h.sent('viewEnd')).toHaveLength(0);
    vi.advanceTimersByTime(1001);
    expect(h.sent('viewEnd')[0]).toMatchObject({ playTime: 60250, pauseDuration: 5750 });
  });

  it('clears a pending request when a fatal error ends the view, so a retry is a new view', async () => {
    h = await createHarness({ heartbeatInterval: 100000 });
    h.state.set('paused', false);
    const error = Object.assign(new Error('boom'), { fatal: true });
    h.bus.emit('media:error', { error });
    expect(h.sent('viewEnd')).toHaveLength(1);

    h.bus.emit('playback:play', undefined);

    expect(h.sent('viewStart')).toHaveLength(2);
    expect(sentIn(h.sent('viewStart')[1].viewId, 'playRequest')).toHaveLength(1);
  });
});
