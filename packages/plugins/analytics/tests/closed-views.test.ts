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

// HEI-52: a host load() on a closed view opens the next view at once, so a
// source that fails before it plays still sends its error beacon. A provider
// re-writing the same src (hls.js manifest parsed, WHEP recovery) never opens
// one; a pending playlist track still wins the load.
describe('a new source on a closed view', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  const SRC_A = 'https://cdn.example.com/a.m3u8';
  const SRC_B = 'https://cdn.example.com/b.m3u8';

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Core load(): resets playback (`playing` false, `paused` true), then
   * writes the `source` state before the provider loads.
   */
  function load(src: string): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    rewrite(src);
  }

  /** A provider writing `source` again during a load or a recovery. */
  function rewrite(src: string): void {
    h.state.set('source', { src, type: 'application/x-mpegURL' });
  }

  /** Core unload(): source written null, then the source:unloaded event. */
  function unload(): void {
    h.state.set('source', null);
    h.bus.emit('source:unloaded', { src: SRC_A });
  }

  function fatal(message = 'fatal'): void {
    h.bus.emit('media:error', { error: Object.assign(new Error(message), { fatal: true }) });
  }

  /** The element's `ended`, the way a provider reports it. */
  function end(): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:ended', undefined);
  }

  it('reports a fatal before any play in the view a load after unload opens', async () => {
    h = await createHarness();
    load(SRC_A);
    h.play();
    unload();
    expect(h.sent('viewEnd')).toHaveLength(1);

    load(SRC_B);
    expect(h.sent('viewStart')).toHaveLength(2);

    fatal('404');
    const secondViewId = h.sent('viewStart')[1].viewId;
    expect(h.sent('error')).toHaveLength(1);
    expect(h.sent('error')[0].viewId).toBe(secondViewId);
    expect(h.sent('viewEnd')).toHaveLength(2);
    expect(h.sent('viewEnd')[1]).toMatchObject({ viewId: secondViewId, exitType: 'error' });
  });

  it('opens a view on a load of the same URL after unload', async () => {
    h = await createHarness();
    load(SRC_A);
    h.play();
    unload();

    load(SRC_A);

    expect(h.sent('viewStart')).toHaveLength(2);
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it.each(['ended', 'fatal'] as const)('opens a view on a load of a different URL after %s, and the play after it opens no third view', async (reason) => {
    h = await createHarness();
    load(SRC_A);
    h.play();
    if (reason === 'ended') end();
    else fatal();
    expect(h.sent('viewEnd')).toHaveLength(1);

    load(SRC_B);
    expect(h.sent('viewStart')).toHaveLength(2);
    expect(h.sent('playRequest')).toHaveLength(1);

    h.play();
    expect(h.sent('viewStart')).toHaveLength(2);
    const secondViewId = h.sent('viewStart')[1].viewId;
    expect(h.sent('playRequest').at(-1)?.viewId).toBe(secondViewId);
    expect(h.sent('videoStart').at(-1)?.viewId).toBe(secondViewId);
  });

  it('opens no view when a provider re-writes the same src after a fatal', async () => {
    h = await createHarness();
    load(SRC_A);
    h.play();
    fatal();
    expect(h.sent('viewEnd')).toHaveLength(1);

    // hls.js manifest parsed re-writes the source with a fresh object
    rewrite(SRC_A);

    expect(h.sent('viewStart')).toHaveLength(1);
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it('opens no view on a same-src re-write after an idle end; the passive-resume rule still decides', async () => {
    vi.useFakeTimers();
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 5000 });
    load(SRC_A);
    h.play();
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
    vi.advanceTimersByTime(5000);
    expect(h.sent('viewEnd')).toHaveLength(1);

    // WHEP recovery re-writes the same source, signed again
    rewrite(`${SRC_A}?token=2`);
    expect(h.sent('viewStart')).toHaveLength(1);

    h.play();
    expect(h.sent('viewStart')).toHaveLength(2);
  });

  it('opens exactly one view when a playlist track loads on a closed view', async () => {
    h = await createHarness();
    load(SRC_A);
    h.play();
    end();
    expect(h.sent('viewEnd')).toHaveLength(1);

    h.bus.emit('playlist:change', { track: { id: 'item-1', src: SRC_B, videoId: 'track-b' }, index: 1 });
    load(SRC_B);

    expect(h.sent('viewStart')).toHaveLength(2);
    expect(h.sent('viewStart')[1]).toMatchObject({ videoId: 'track-b' });
    expect(h.sent('viewEnd')).toHaveLength(1);
  });

  it('never ends or opens a view on a source write while a view is open', async () => {
    h = await createHarness();
    load(SRC_A);
    h.play();

    load(SRC_B);
    load(SRC_A);

    expect(h.sent('viewStart')).toHaveLength(1);
    expect(h.sent('viewEnd')).toHaveLength(0);
  });
});
