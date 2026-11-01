import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, StateManager } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import { createAnalyticsPlugin, MAX_PRE_INIT_EVENTS } from '../src/index';
import type { BeaconPayload } from '../src/types';

/** Build a plugin that has not been initialised yet, plus a way to init it. */
function setup() {
  const beacons: BeaconPayload[] = [];
  const plugin = createAnalyticsPlugin({
    beaconUrl: 'https://api.example.com/analytics',
    videoId: 'v',
    customBeacon: (_u, p) => { beacons.push(p); },
  });
  const makeApi = () => {
    const state = new StateManager({ duration: 1000 });
    const bus = new EventBus();
    return {
      pluginId: 'analytics',
      container: document.createElement('div'),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getState: (k: string) => state.getValue(k as never),
      setState: (k: string, v: unknown) => state.set(k as never, v as never),
      defineState: (k: string, v: unknown) => state.define(k as never, v as never),
      on: (e: string, h: never) => bus.on(e as never, h),
      off: (e: string, h: never) => bus.off(e as never, h),
      emit: (e: string, p: never) => bus.emit(e as never, p),
      getPlugin: () => null,
      onDestroy: vi.fn(),
      subscribeToState: (cb: never) => state.subscribe(cb),
    } as unknown as IPluginAPI;
  };
  return { plugin, beacons, init: () => plugin.init(makeApi()) };
}

describe('calling the analytics API before init()', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null IDs before init and strings after', async () => {
    const s = setup();
    expect(s.plugin.getViewId()).toBeNull();
    expect(s.plugin.getSessionId()).toBeNull();
    await s.init();
    expect(typeof s.plugin.getViewId()).toBe('string');
    expect(typeof s.plugin.getSessionId()).toBe('string');
    await s.plugin.destroy();
  });

  it('does not throw from trackEvent before init and sends it on the first view', async () => {
    const s = setup();
    expect(() => s.plugin.trackEvent('tap', { x: 1 })).not.toThrow();
    expect(s.beacons).toHaveLength(0);
    vi.advanceTimersByTime(250);
    await s.init();
    expect(s.beacons.map((b) => b.event)).toEqual(['viewStart', 'custom:tap']);
    const tap = s.beacons[1]!;
    expect(tap.viewId).toBe(s.plugin.getViewId());
    expect(tap.beaconSeq).toBe(2);
    expect(tap).toMatchObject({ x: 1, queuedForMs: 250 });
    await s.plugin.destroy();
  });

  it('keeps host call order and does not stamp events sent after init', async () => {
    const s = setup();
    s.plugin.trackEvent('a');
    s.plugin.trackEvent('b');
    await s.init();
    s.plugin.trackEvent('c');
    expect(s.beacons.map((b) => b.event)).toEqual(['viewStart', 'custom:a', 'custom:b', 'custom:c']);
    expect(s.beacons[3]).not.toHaveProperty('queuedForMs');
    await s.plugin.destroy();
  });

  it('bounds the queue and drops the oldest events', async () => {
    const s = setup();
    for (let i = 0; i < MAX_PRE_INIT_EVENTS + 5; i++) s.plugin.trackEvent('e', { i });
    await s.init();
    const sent = s.beacons.filter((b) => b.event === 'custom:e');
    expect(sent).toHaveLength(MAX_PRE_INIT_EVENTS);
    expect(sent[0]).toMatchObject({ i: 5 });
    expect(sent.at(-1)).toMatchObject({ i: MAX_PRE_INIT_EVENTS + 4 });
    await s.plugin.destroy();
  });

  it('drops the queue when destroyed before init, and destroy does not throw', async () => {
    const s = setup();
    s.plugin.trackEvent('lost');
    await expect(s.plugin.destroy()).resolves.toBeUndefined();
    await s.init();
    expect(s.beacons.map((b) => b.event)).toEqual(['viewStart']);
    await s.plugin.destroy();
  });

  it('does not replay queued events on a second init', async () => {
    const s = setup();
    s.plugin.trackEvent('once');
    await s.init();
    await s.plugin.destroy();
    s.beacons.length = 0;
    await s.init();
    expect(s.beacons.map((b) => b.event)).toEqual(['viewStart']);
    await s.plugin.destroy();
  });

  it('snapshots event data when it is queued (CodeRabbit PR 142)', async () => {
    const s = setup();
    const data: Record<string, unknown> = { x: 1 };
    s.plugin.trackEvent('tap', data);
    data.x = 2;
    data.late = true;
    await s.init();
    const tap = s.beacons.find((b) => b.event === 'custom:tap')!;
    expect(tap).toMatchObject({ x: 1 });
    expect(tap).not.toHaveProperty('late');
    await s.plugin.destroy();
  });

  it('measures each queued event\'s wait when it is sent (CodeRabbit PR 142)', async () => {
    const beacons: BeaconPayload[] = [];
    const plugin = createAnalyticsPlugin({
      beaconUrl: 'https://api.example.com/analytics',
      videoId: 'v',
      // A slow transport: every send moves the clock on
      customBeacon: (_u, p) => { beacons.push(p); vi.setSystemTime(Date.now() + 100); },
    });
    plugin.trackEvent('a');
    plugin.trackEvent('b');
    plugin.trackEvent('c');
    vi.advanceTimersByTime(250);
    const state = new StateManager({ duration: 1000 });
    const bus = new EventBus();
    await plugin.init({
      pluginId: 'analytics',
      container: document.createElement('div'),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getState: (k: string) => state.getValue(k as never),
      setState: (k: string, v: unknown) => state.set(k as never, v as never),
      defineState: (k: string, v: unknown) => state.define(k as never, v as never),
      on: (e: string, h: never) => bus.on(e as never, h),
      off: (e: string, h: never) => bus.off(e as never, h),
      emit: (e: string, p: never) => bus.emit(e as never, p),
      getPlugin: () => null,
      onDestroy: vi.fn(),
      subscribeToState: (cb: never) => state.subscribe(cb),
    } as unknown as IPluginAPI);
    const queued = beacons.filter((b) => b.event.startsWith('custom:'));
    expect(queued).toHaveLength(3);
    // timestamp - queuedForMs is the moment trackEvent() was called
    for (const b of queued) {
      expect((b.timestamp as number) - (b.queuedForMs as number)).toBe(10000);
    }
    await plugin.destroy();
  });
});
