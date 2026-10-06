import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import { createHarness } from './harness';

// HEI-38: once a view has sent its viewEnd, nothing more is reported or
// counted against it. Only a play request (or an idle-end resume) opens the
// next view.
describe('closed views stay closed', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  afterEach(async () => {
    setHidden(false);
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  }

  function fatal(message = 'fatal'): void {
    h.bus.emit('media:error', { error: Object.assign(new Error(message), { fatal: true }) });
  }

  /** Beacons sent after the first viewEnd. */
  function afterViewEnd() {
    const index = h.beacons.findIndex((beacon) => beacon.event === 'viewEnd');
    return h.beacons.slice(index + 1);
  }

  it('sends one viewEnd and counts one error for two fatals', async () => {
    h = await createHarness();
    h.play();
    fatal('first');
    fatal('second');

    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('error')).toHaveLength(1);
    expect(h.plugin.getMetrics().errorCount).toBe(1);
  });

  it('ignores a core error and a warning after a fatal', async () => {
    h = await createHarness();
    h.play();
    fatal();
    h.bus.emit('error', { code: ErrorCode.MEDIA_NETWORK_ERROR, message: 'again', fatal: true, timestamp: Date.now() });
    h.bus.emit('media:error', { error: new Error('warning') });

    expect(afterViewEnd()).toEqual([]);
    expect(h.plugin.getMetrics()).toMatchObject({ errorCount: 1, warningCount: 0 });
  });

  it('sends no pause beacon and counts no pause after a fatal', async () => {
    h = await createHarness();
    h.play();
    fatal();
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);

    expect(afterViewEnd()).toEqual([]);
    expect(h.plugin.getMetrics().pauseCount).toBe(0);
  });

  it('sends no heartbeat and keeps the exit type when the page hides after a fatal', async () => {
    h = await createHarness();
    h.play();
    fatal();
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(afterViewEnd()).toEqual([]);
    expect(h.plugin.getMetrics().exitType).toBe('error');
  });

  it('opens no rebuffer after a fatal', async () => {
    vi.useFakeTimers();
    h = await createHarness();
    h.play();
    fatal();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(5000);

    expect(afterViewEnd()).toEqual([]);
    expect(h.plugin.getMetrics().rebufferCount).toBe(0);
  });

  it('counts no quality change after a fatal', async () => {
    h = await createHarness();
    h.state.set('qualities', [{ id: 'q1', label: '720p', width: 1280, height: 720, bitrate: 2_000_000, active: true }]);
    h.play();
    fatal();
    h.bus.emit('quality:change', { quality: 'q1', auto: true });

    expect(afterViewEnd()).toEqual([]);
    expect(h.plugin.getMetrics().qualityChanges).toBe(0);
  });

  it('still reports errors in the view a replay opens', async () => {
    h = await createHarness();
    h.play();
    fatal('first');
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.play();
    fatal('second');

    expect(h.sent('viewEnd')).toHaveLength(2);
    expect(h.sent('error')).toHaveLength(2);
  });
});
