import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
import type { BeaconPayload } from '../src/types';

describe('beacon ordering and seek source', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

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

  it('sequences every dispatched beacon without a gap for a sampled-out error', async () => {
    h = await createHarness({ errorSampleRate: 0, heartbeatInterval: 100 });
    h.play();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    h.bus.emit('media:error', { error: new Error('sampled out') });
    vi.advanceTimersByTime(100);
    h.bus.emit('playback:seeking', { time: 40 });
    h.plugin.trackEvent('test');
    h.bus.emit('playback:ended', undefined);
    expect(h.sent('error')).toHaveLength(0);
    expect(h.beacons.map((b) => b.event)).toEqual(['viewStart', 'playRequest', 'videoStart', 'heartbeat', 'seeking', 'custom:test', 'viewEnd']);
    expect(h.beacons.map((b) => b.beaconSeq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each(['setVideo', 'playlist change', 'replay'] as const)('restarts the sequence at one on %s', async (action) => {
    h = await createHarness();
    h.play();
    const oldView = h.plugin.getViewId();
    vi.advanceTimersByTime(1);
    switch (action) {
      case 'setVideo': h.plugin.setVideo({ videoId: 'next' }); break;
      case 'playlist change':
        h.bus.emit('playlist:change', { track: { id: 'next', src: 'next.mp4', videoId: 'next' }, index: 1 });
        h.state.set('source', { src: 'next.mp4' });
        break;
      case 'replay':
        h.bus.emit('playback:ended', undefined);
        h.state.set('playing', false);
        h.state.set('paused', true);
        h.bus.emit('playback:play', undefined);
        break;
    }
    h.plugin.trackEvent('next');
    const nextView = h.plugin.getViewId();
    expect(nextView).not.toBe(oldView);
    for (const id of [oldView, nextView]) {
      const view = h.beacons.filter((b) => b.viewId === id);
      expect(view[0]).toMatchObject({ event: 'viewStart', beaconSeq: 1 });
      expect(view.map((b) => b.beaconSeq)).toEqual(view.map((_b, i) => i + 1));
    }
  });

  it('gives custom-transport unload viewEnd the next number exactly once', async () => {
    h = await createHarness();
    h.play();
    const next = h.beacons.length + 1;
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));
    expect(h.sent('viewEnd')).toHaveLength(1);
    expect(h.sent('viewEnd')[0]?.beaconSeq).toBe(next);
  });

  it('sequences the real fetch and navigator.sendBeacon payload builders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const unload = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { userAgent: navigator.userAgent, sendBeacon: unload });
    h = await createHarness({ customBeacon: undefined, customDimensions: { beaconSeq: 999 } });
    h.plugin.trackEvent('test', { beaconSeq: 888 });
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body) as BeaconPayload);
    expect(bodies.map((b) => b.beaconSeq)).toEqual([1, 2]);
    window.dispatchEvent(new Event('pagehide'));
    expect(unload).toHaveBeenCalledTimes(1);
    // jsdom FileReader schedules I/O through timers; playback timing is done.
    vi.useRealTimers();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(unload.mock.calls[0][1]);
    });
    expect(JSON.parse(text)).toMatchObject({ event: 'viewEnd', beaconSeq: 3 });
  });

  it('protects sequence numbers from custom dimensions and event data on both builders', async () => {
    h = await createHarness({ customDimensions: { beaconSeq: 999 } });
    h.plugin.trackEvent('test', { beaconSeq: 888 });
    window.dispatchEvent(new Event('pagehide'));
    expect(h.beacons.map((b) => b.beaconSeq)).toEqual([1, 2, 3]);
  });

  it('labels bus seeks player and state seeks element, only on seeking beacons', async () => {
    h = await createHarness();
    h.bus.emit('playback:seeking', { time: 30 });
    h.elementSeek(30);
    h.state.set('seeking', false);
    h.elementSeek(60);
    h.bus.emit('playback:ended', undefined);
    expect(h.sent('seeking').map((b) => b.seekSource)).toEqual(['player', 'element']);
    for (const beacon of h.beacons.filter((b) => b.event !== 'seeking')) {
      expect(beacon).not.toHaveProperty('seekSource');
    }
  });
});
