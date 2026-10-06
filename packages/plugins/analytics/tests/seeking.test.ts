/**
 * Seeking beacon tests (SCAR-ANALYTICS-14).
 *
 * Core emits `playback:seeking` with the seek target before it writes
 * `currentTime`, so the beacon's `seekTo` must come from the payload; the
 * state still holds the position the seek started from.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import { EventBus, StateManager } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import type { BeaconPayload } from '../src/types';
import { createHarness } from './harness';

let beacons: BeaconPayload[] = [];

/** Plugin API over core's real StateManager and EventBus. */
function createMockAPI(): IPluginAPI {
  const state = new StateManager({ duration: 100 });
  const bus = new EventBus();

  return {
    pluginId: 'analytics',
    container: document.createElement('div'),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: any) => state.getValue(key)),
    setState: vi.fn((key: any, value: any) => state.set(key, value)),
    on: vi.fn((event: any, handler: any) => bus.on(event, handler)),
    off: vi.fn((event: any, handler: any) => bus.off(event, handler)),
    emit: vi.fn((event: any, payload: any) => bus.emit(event, payload)),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((callback: any) => state.subscribe(callback)),
    _trigger(event: any, payload?: any) {
      bus.emit(event, payload);
    },
    _updateState(updates: Record<string, any>) {
      state.update(updates);
    },
  } as any;
}

describe('seeking beacon', () => {
  let api: any;

  beforeEach(async () => {
    beacons = [];
    vi.useFakeTimers();
    api = createMockAPI();
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://api.example.com/analytics',
      videoId: 'test-video-123',
      disableInDev: false,
      customBeacon: (_url: string, payload: BeaconPayload) => {
        beacons.push(payload);
      },
    });
    await plugin.init(api);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports the seek target from the payload, not the lagging state', () => {
    api._updateState({ currentTime: 0.000002 });

    api._trigger('playback:seeking', { time: 19805 });

    const seeking = beacons.find((b) => b.event === 'seeking');
    expect(seeking).toBeDefined();
    expect(seeking!.seekTo).toBe(19805);
    expect(seeking!.seekCount).toBe(1);
  });

  it('falls back to state currentTime when the emit carries no payload', () => {
    api._updateState({ currentTime: 42 });

    api._trigger('playback:seeking');

    const seeking = beacons.find((b) => b.event === 'seeking');
    expect(seeking).toBeDefined();
    expect(seeking!.seekTo).toBe(42);
  });

  it('falls back to state when the payload time is not finite', () => {
    api._updateState({ currentTime: 7 });

    api._trigger('playback:seeking', { time: Number.NaN });

    expect(beacons.find((b) => b.event === 'seeking')!.seekTo).toBe(7);
  });
});

describe('element-driven seeking', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    h = await createHarness();
  });

  afterEach(async () => {
    await h.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('counts an element seek with its freshly written target', () => {
    h.elementSeek(450);
    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.sent('seeking')[0]).toMatchObject({ seekTo: 450, seekCount: 1 });
    expect(h.plugin.getMetrics().seekCount).toBe(1);
  });

  it('counts a core bus seek and its element echo once', () => {
    h.bus.emit('playback:seeking', { time: 40 });
    h.elementSeek(40);
    expect(h.sent('seeking')).toHaveLength(1);
    expect(h.sent('seeking')[0]).toMatchObject({ seekTo: 40, seekCount: 1 });
    expect(h.plugin.getMetrics().seekCount).toBe(1);
  });

  it('counts three rapid core seeks with their echoes exactly three times', () => {
    for (const time of [10, 20, 30]) h.bus.emit('playback:seeking', { time });
    for (const time of [10, 20, 30]) {
      h.elementSeek(time);
      h.state.set('seeking', false);
    }
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 30]);
    expect(h.plugin.getMetrics().seekCount).toBe(3);
  });

  it('consumes every pending echo, then counts the next element seek', () => {
    for (const time of [10, 20, 30]) h.bus.emit('playback:seeking', { time });
    for (const time of [10, 20, 30, 40]) {
      h.elementSeek(time);
      h.state.set('seeking', false);
    }
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 20, 30, 40]);
    expect(h.plugin.getMetrics().seekCount).toBe(4);
  });

  it('absorbs an echo at exactly 1000 ms', () => {
    h.bus.emit('playback:seeking', { time: 40 });
    vi.advanceTimersByTime(1000);
    h.elementSeek(40);
    expect(h.sent('seeking')).toHaveLength(1);
  });

  it('counts an echo after 1000 ms as an element seek and clears stale echoes', () => {
    h.bus.emit('playback:seeking', { time: 20 });
    h.bus.emit('playback:seeking', { time: 30 });
    vi.advanceTimersByTime(1001);
    h.elementSeek(40);
    h.state.set('seeking', false);
    h.elementSeek(50); // Within 2 s of 40: the same element seek burst (HEI-32).
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([20, 30, 40]);
    expect(h.plugin.getMetrics()).toMatchObject({ seekCount: 3, elementSeekCount: 2 });
  });

  it.each([1000, 1001, 1100])('expires coalesced echoes before a new bus request at %i ms', (delay) => {
    h.bus.emit('playback:seeking', { time: 10 });
    h.bus.emit('playback:seeking', { time: 20 });
    h.elementSeek(20); // Two requests coalesce into one state transition.
    h.state.set('seeking', false);
    vi.advanceTimersByTime(delay);
    h.bus.emit('playback:seeking', { time: 30 });
    h.elementSeek(30);
    h.state.set('seeking', false);
    h.elementSeek(40);

    const expired = delay > 1000;
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual(expired ? [10, 20, 30, 40] : [10, 20, 30]);
    expect(h.sent('seeking').map((b) => b.seekSource)).toEqual(
      expired ? ['player', 'player', 'player', 'element'] : ['player', 'player', 'player']
    );
    expect(h.sent('seeking').map((b) => b.seekCount)).toEqual(expired ? [1, 2, 3, 4] : [1, 2, 3]);
    expect(h.plugin.getMetrics().seekCount).toBe(expired ? 4 : 3);
  });

  it.each(['bus', 'element', 'bus and echo'] as const)(
    'ignores %s seeks after viewEnd and starts exactly one clean replay view', (path) => {
      h.play();
      h.elementSeek(90);
      h.state.set('seeking', false);
      h.state.set('playing', false);
      h.state.set('paused', true);
      h.state.set('ended', true);
      h.bus.emit('playback:ended', undefined);
      const oldId = h.plugin.getViewId();
      const oldBeacons = h.beacons.slice();
      const final = h.sent('viewEnd')[0];
      expect(final).toMatchObject({ viewId: oldId, seekCount: 1 });
      expect(vi.getTimerCount()).toBe(0);

      if (path !== 'element') h.bus.emit('playback:seeking', { time: 0 });
      if (path !== 'bus') h.elementSeek(0);
      h.state.set('seeking', false);
      expect(h.plugin.getMetrics().seekCount).toBe(1);
      expect(h.beacons).toEqual(oldBeacons);
      expect(h.plugin.getViewId()).toBe(oldId);

      h.state.set('ended', false);
      h.play();
      const newId = h.plugin.getViewId();
      expect(newId).not.toBe(oldId);
      expect(h.sent('viewStart')).toHaveLength(2);
      expect(h.plugin.getMetrics().seekCount).toBe(0);
      expect(h.beacons.filter((b) => b.viewId === newId).map((b) => [b.event, b.beaconSeq])).toEqual([
        ['viewStart', 1], ['playRequest', 2], ['videoStart', 3],
      ]);
      h.elementSeek(5); // No ignored bus token must leak into the new view.
      expect(h.sent('seeking').at(-1)).toMatchObject({
        viewId: newId, seekTo: 5, seekSource: 'element', seekCount: 1, beaconSeq: 4,
      });
      expect(h.beacons.filter((b) => b.viewId === oldId)).toEqual(oldBeacons);
      expect(oldBeacons.at(-1)).toBe(final);
      expect(oldBeacons.map((b) => b.beaconSeq)).toEqual(oldBeacons.map((_, i) => i + 1));
    }
  );

  it('cancels a pending grace on an element seek', () => {
    h.play();
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(11);
    h.elementSeek(80);
    h.state.set('seeking', false);
    vi.advanceTimersByTime(300);
    expect(h.sent('rebufferStart')).toHaveLength(0);
    expect(h.plugin.getMetrics()).toMatchObject({ rebufferCount: 0, seekCount: 1 });
    expect(vi.getTimerCount()).toBe(1); // Only the heartbeat.
  });

  it('dispatches one state transition for the UI/provider double write', () => {
    const changes = vi.fn();
    h.state.subscribe((event) => {
      if (event.key === 'seeking') changes(event);
    });
    h.state.set('currentTime', 40); // UI direct write, before its bus event.
    h.bus.emit('playback:seeking', { time: 40 });
    h.elementSeek(40); // First queued element seeking.
    h.elementSeek(40); // Provider's repeated write queues another seeking.
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toMatchObject({ previousValue: false, value: true });
    expect(h.sent('seeking')).toHaveLength(1);
  });

  it('simulates a drag with press, five throttled moves and release producing two seeks', () => {
    const video = document.createElement('video');
    video.addEventListener('seeking', () => h.elementSeek(video.currentTime));
    h.bus.on('playback:seeking', ({ time }) => { video.currentTime = time; });
    const write = (time: number, force: boolean) => {
      video.currentTime = time;
      if (force) h.bus.emit('playback:seeking', { time });
      // Browsers dispatch seeking asynchronously, after UI emits and the
      // provider repeats the write. Both events see the same seeking state.
      video.dispatchEvent(new Event('seeking'));
      if (force) video.dispatchEvent(new Event('seeking'));
    };
    write(10, true);
    for (const time of [20, 30, 40, 50, 60]) {
      vi.advanceTimersByTime(100);
      write(time, false);
    }
    write(70, true);
    h.state.set('seeking', false);
    expect(h.sent('seeking').map((b) => b.seekTo)).toEqual([10, 70]);
    expect(h.plugin.getMetrics().seekCount).toBe(2);
  });

  it('resets pending bus echoes for a new view', () => {
    h.bus.emit('playback:seeking', { time: 20 });
    h.plugin.setVideo({ videoId: 'next' });
    h.elementSeek(50);
    expect(h.sent('seeking')).toHaveLength(2);
    expect(h.sent('seeking')[1]).toMatchObject({ seekCount: 1, seekTo: 50, videoId: 'next' });
  });
});
