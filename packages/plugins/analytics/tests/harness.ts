import { EventBus, StateManager } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import { vi } from 'vitest';
import { createAnalyticsPlugin } from '../src/index';
import type { AnalyticsConfig, BeaconPayload } from '../src/types';

/**
 * Initialize analytics over the real core state store and event bus.
 * @param config - Overrides for this test's analytics configuration
 * @returns The initialized plugin, real state/bus, and collected beacons
 */
export async function createHarness(config: Partial<AnalyticsConfig> = {}) {
  const state = new StateManager({ duration: 1000 });
  const bus = new EventBus();
  const beacons: BeaconPayload[] = [];
  const api = {
    pluginId: 'analytics',
    container: document.createElement('div'),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: (key) => state.getValue(key),
    setState: (key, value) => state.set(key, value),
    defineState: (key, value) => state.define(key, value),
    on: (event, handler) => bus.on(event, handler),
    off: (event, handler) => bus.off(event, handler),
    emit: (event, payload) => bus.emit(event, payload),
    getPlugin: () => null,
    onDestroy: vi.fn(),
    subscribeToState: (callback) => state.subscribe(callback),
  } as IPluginAPI;
  const plugin = createAnalyticsPlugin({
    beaconUrl: 'https://api.example.com/analytics',
    videoId: 'test-video',
    customBeacon: (_url, payload) => { beacons.push(payload); },
    ...config,
  });
  await plugin.init(api);
  /** Confirm an advancing frame without moving the scenario's state position. */
  const confirmFrame = () => bus.emit('playback:timeupdate', { currentTime: state.getValue('currentTime') + 0.01 });
  /** Attach a controllable video with manual frame callbacks. */
  const attachVideo = (rvfc = true) => {
    const video = document.createElement('video');
    const callbacks = new Map<number, VideoFrameRequestCallback>();
    let handle = 0;
    if (rvfc) {
      video.requestVideoFrameCallback = vi.fn(callback => { callbacks.set(++handle, callback); return handle; });
      video.cancelVideoFrameCallback = vi.fn(id => { callbacks.delete(id); });
    }
    api.container.append(video);
    return { video, callbacks, frame: () => {
      const pending = [...callbacks.values()]; callbacks.clear();
      for (const callback of pending) callback(performance.now(), {} as VideoFrameCallbackMetadata);
    } };
  };
  return {
    plugin, api, state, bus, beacons, confirmFrame, attachVideo,
    advancePosition: (time: number) => {
      const video = api.container.querySelector('video');
      if (video) video.currentTime = time;
      state.set('currentTime', time);
      bus.emit('playback:timeupdate', { currentTime: time });
    },
    sent: (event: string) => beacons.filter((beacon) => beacon.event === event),
    play: (confirm = true) => {
      state.set('paused', false);
      state.set('playing', true);
      bus.emit('playback:play', undefined);
      if (confirm) confirmFrame();
    },
    elementSeek: (time: number) => {
      state.set('currentTime', time);
      state.set('seeking', true);
    },
  };
}
