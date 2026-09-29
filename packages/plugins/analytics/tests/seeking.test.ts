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
