import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
import { calculateQoEScore } from '../src/helpers';

// HEI-SCARLETT-87: under qoeVersion 3 a view that never showed a first frame
// is scored by cause instead of flattering the headline score. It tried to
// play and failed: 0. It never asked, or the browser refused autoplay and it
// is still waiting for a tap: null (excluded, not the player's fault). A view
// that played is scored exactly as before.
describe('QoE of a view with no first frame (qoeVersion 3)', () => {
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

  const end = () => {
    window.dispatchEvent(new Event('pagehide'));
    return h.sent('viewEnd')[0] as Record<string, unknown>;
  };

  /** A play request the browser refused: core announced it, the element stayed paused. */
  function blockedPlay(): void {
    h.attachVideo(false);
    h.play(false);
    h.state.set('playing', false);
    h.bus.emit('playback:blocked', { reason: 'autoplay', name: 'NotAllowedError' });
  }

  describe('calculateQoEScore noFrameCause', () => {
    const base = {
      startupTime: null, rebufferCount: 0, rebufferDuration: 0, watchTime: 10000,
      maxBitrate: 0, warningCount: 0, exitType: null, fatalErrorCategory: null,
    };

    it('leaves the score alone when the cause is absent', () => {
      expect(calculateQoEScore(base)).toBe(100);
      expect(calculateQoEScore({ ...base, startupTime: 4000 })).toBe(75);
    });

    it('scores a tried view 0 and an idle or open view null', () => {
      expect(calculateQoEScore({ ...base, noFrameCause: 'tried' })).toBe(0);
      expect(calculateQoEScore({ ...base, noFrameCause: 'idle' })).toBeNull();
      expect(calculateQoEScore({ ...base, noFrameCause: 'open' })).toBeNull();
    });

    it('keeps the error exit rules ahead of the cause', () => {
      expect(calculateQoEScore({ ...base, exitType: 'error', fatalErrorCategory: 'network', noFrameCause: 'idle' })).toBe(0);
      expect(calculateQoEScore({ ...base, exitType: 'error', fatalErrorCategory: 'access', noFrameCause: 'tried' })).toBeNull();
    });
  });

  it('scores a view that played as before, with the new version', async () => {
    h = await createHarness();
    const v = h.attachVideo();
    h.play(false);
    v.frame();
    vi.advanceTimersByTime(5000);
    const viewEnd = end();
    expect(viewEnd.qoeVersion).toBe(3);
    expect(viewEnd.qoeScore).toBeGreaterThan(0);
    expect(viewEnd.qoeScore).toBe(calculateQoEScore({
      startupTime: viewEnd.startupTime as number, rebufferCount: viewEnd.rebufferCount as number,
      rebufferDuration: viewEnd.rebufferDuration as number, watchTime: viewEnd.watchTime as number, maxBitrate: (viewEnd.maxBitrate as number | null) ?? null,
      exitType: 'abandoned', warningCount: 0, fatalErrorCategory: null,
    }));
  });

  it('scores a view that asked to play and never got a frame 0', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    vi.advanceTimersByTime(5000);
    const viewEnd = end();
    expect(viewEnd).toMatchObject({ startState: 'never', qoeScore: 0, qoeVersion: 3 });
  });

  it('scores a view that never asked to play null', async () => {
    h = await createHarness();
    h.attachVideo(false);
    vi.advanceTimersByTime(5000);
    const viewEnd = end();
    expect(viewEnd).toMatchObject({ startState: 'never', qoeScore: null, qoeVersion: 3 });
  });

  it('scores a view still awaiting a tap null', async () => {
    h = await createHarness();
    blockedPlay();
    vi.advanceTimersByTime(5000);
    expect(end()).toMatchObject({ startState: 'awaitingTap', qoeScore: null, qoeVersion: 3 });
  });

  it('scores a blocked view that was tapped and played like any played view', async () => {
    h = await createHarness();
    const v = h.attachVideo();
    h.play(false);
    h.state.set('playing', false);
    h.bus.emit('playback:blocked', { reason: 'autoplay' });
    h.play(false);
    v.frame();
    vi.advanceTimersByTime(5000);
    const viewEnd = end();
    expect(viewEnd.startState).toBe('played');
    expect(viewEnd.qoeScore).toBeGreaterThan(0);
  });

  it('scores a blocked view that was tapped and still got no frame 0', async () => {
    h = await createHarness();
    blockedPlay();
    h.play(false);
    vi.advanceTimersByTime(5000);
    // Not awaitingTap any more: the viewer tapped, so this view tried and failed
    expect(end()).toMatchObject({ startState: 'never', qoeScore: 0, qoeVersion: 3 });
  });

  it('keeps the error exit rules: 0, and null for an access denial', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'offline', fatal: true } as any);
    expect(h.sent('viewEnd')[0]).toMatchObject({ exitType: 'error', qoeScore: 0, qoeVersion: 3 });
    await h.plugin.destroy();

    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    h.bus.emit('error', { code: 'SOURCE_LOAD_FAILED', message: 'denied', fatal: true, detail: { httpStatus: 403 } } as any);
    expect(h.sent('viewEnd')[0]).toMatchObject({ fatalErrorCategory: 'access', qoeScore: null, qoeVersion: 3 });
  });

  it('sends a null running score in heartbeats until the first frame, then a number', async () => {
    h = await createHarness({ heartbeatInterval: 1000 });
    const v = h.attachVideo();
    h.play(false);
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat').at(-1)).toMatchObject({ qoeScore: null, qoeVersion: 3 });

    v.frame();
    vi.advanceTimersByTime(1000);
    const after = h.sent('heartbeat').at(-1) as Record<string, unknown>;
    expect(after.qoeVersion).toBe(3);
    expect(after.qoeScore).toBeGreaterThan(0);
  });

  it('exposes the same score from getQoEScore()', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    expect(h.plugin.getQoEScore()).toBeNull();
    end();
    expect(h.plugin.getQoEScore()).toBe(0);
  });
});
