import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

// HEI-SCARLETT-69: a view that never plays says why. An autoplay block, a
// failed plugin and a code-less error each leave a trace the server can read.
describe('play blocked and start state', () => {
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

  /** A play request the browser refused: core announced it, the element stayed paused. */
  function blockedPlay(): void {
    h.attachVideo(false);
    h.play(false);
    h.state.set('playing', false);
    h.bus.emit('playback:blocked', { reason: 'autoplay', name: 'NotAllowedError' });
  }

  it('sends a playBlocked beacon with the reason and error name', async () => {
    h = await createHarness();
    blockedPlay();
    expect(h.sent('playBlocked')).toHaveLength(1);
    expect(h.sent('playBlocked')[0]).toMatchObject({ reason: 'autoplay', errorName: 'NotAllowedError' });
  });

  it('does not count a blocked view as playing', async () => {
    h = await createHarness();
    blockedPlay();
    vi.advanceTimersByTime(3000);
    expect(h.plugin.getMetrics().playTime).toBe(0);
  });

  it('ends a blocked view with startState awaitingTap', async () => {
    h = await createHarness();
    blockedPlay();
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'awaitingTap', exitType: 'abandoned', startupTime: null });
  });

  it('reports played once a frame is confirmed after the tap', async () => {
    h = await createHarness();
    const v = h.attachVideo();
    h.play(false);
    h.state.set('playing', false);
    h.bus.emit('playback:blocked', { reason: 'autoplay' });
    expect(h.sent('playBlocked')[0]?.errorName).toBeUndefined();
    h.play(false);
    v.frame();
    expect(h.sent('videoStart')).toHaveLength(1);
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'played' });
  });

  it('reports never when nothing started and nothing explains it', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'never' });
  });

  it('reports failed when the view ended in a fatal error before a frame', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'offline', fatal: true } as any);
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'failed', exitType: 'error' });
  });

  it('reports failed when a non-fatal error was logged and no frame came', async () => {
    h = await createHarness();
    h.attachVideo(false);
    h.play(false);
    h.bus.emit('error', { code: 'X', message: 'warn', fatal: false } as any);
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'failed' });
  });

  it('reports played for a view that played then errored', async () => {
    h = await createHarness();
    h.attachVideo();
    h.play(true);
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'x', fatal: true } as any);
    expect(h.sent('viewEnd')[0]).toMatchObject({ startState: 'played', exitType: 'error' });
  });

  it('reports a plugin:error as an error beacon', async () => {
    h = await createHarness();
    h.bus.emit('plugin:error', { name: 'hls', error: new TypeError('init boom') });
    const errors = h.sent('error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ errorCode: 'PLUGIN_SETUP_FAILED', errorCategory: 'player', errorSeverity: 'warning' });
    expect(String(errors[0]?.errorMessage)).toContain('hls');
    expect(String(errors[0]?.errorMessage)).toContain('init boom');
    expect(h.plugin.getMetrics().errorCount).toBe(1);
  });

  it('does not drop an error payload with neither code nor message', async () => {
    h = await createHarness();
    h.bus.emit('error', { code: 42 } as any);
    expect(h.sent('error')).toHaveLength(1);
    expect(h.sent('error')[0]).toMatchObject({ errorType: 'CoreError', errorMessage: 'Unknown core error', errorCategory: 'unknown' });
    expect(h.plugin.getMetrics().errorCount).toBe(1);
  });
});
