/**
 * Preview loop tests - acceptance: "preview loop seeks to `start` when
 * `currentTime >= end`; suspended during drag" plus stop()-unsubscribes and
 * the `loopPreview: false` kill switch (plan "Preview loop").
 *
 * The controller is driven through a mock api; seeks land on a real jsdom
 * <video> element whose duration is NaN, so seekClamped() writes the
 * requested time clamped only at 0 - enough to observe every loop rewind.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createPreviewLoop } from '../src/preview';

type Subscriber = (payload?: unknown) => unknown;

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = { live: false, seekableRange: null, currentTime: 0, ...state };
  const subs = new Map<string, Subscriber[]>();

  const api = {
    pluginId: 'clips',
    container,
    video,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn(),
    defineState: vi.fn(),
    on: vi.fn((event: string, handler: Subscriber) => {
      const list = subs.get(event) ?? [];
      list.push(handler);
      subs.set(event, list);
      return vi.fn(() => {
        const index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
      });
    }),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    fire(event: string, payload?: unknown): void {
      for (const handler of [...(subs.get(event) ?? [])]) handler(payload);
    },
    listenerCount(event: string): number {
      return (subs.get(event) ?? []).length;
    },
  };

  return api;
}

type MockApi = ReturnType<typeof createMockApi>;

const asApi = (api: MockApi): IPluginAPI => api as unknown as IPluginAPI;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('preview loop', () => {
  it('seeks back to start when currentTime reaches end', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 10, end: 40 });

    api.fire('playback:timeupdate', { currentTime: 20 });
    expect(api.video.currentTime).toBe(0); // untouched below the out point

    api.fire('playback:timeupdate', { currentTime: 40 }); // >= end, boundary included
    expect(api.video.currentTime).toBe(10);
  });

  it('rewinds to start on playback:ended (out point pinned at duration)', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 55, end: 60 });

    api.fire('playback:ended');
    expect(api.video.currentTime).toBe(55);
  });

  it('retargets without resubscribing when start() is called again', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 10, end: 40 });
    loop.start({ start: 12, end: 30 });

    expect(api.listenerCount('playback:timeupdate')).toBe(1);
    api.fire('playback:timeupdate', { currentTime: 30 });
    expect(api.video.currentTime).toBe(12);
  });

  it('suspend() pauses looping and resume() restarts it', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 10, end: 40 });

    loop.suspend();
    api.fire('playback:timeupdate', { currentTime: 50 });
    api.fire('playback:ended');
    expect(api.video.currentTime).toBe(0); // the drag owns the seek, not the loop

    loop.resume();
    api.fire('playback:timeupdate', { currentTime: 50 });
    expect(api.video.currentTime).toBe(10);
  });

  it('stop() unsubscribes both playback listeners and clears the target', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 10, end: 40 });

    const disposers = api.on.mock.results.map((r) => r.value as ReturnType<typeof vi.fn>);
    expect(disposers).toHaveLength(2);

    loop.stop();
    expect(disposers.every((off) => off.mock.calls.length === 1)).toBe(true);
    expect(api.listenerCount('playback:timeupdate')).toBe(0);
    expect(api.listenerCount('playback:ended')).toBe(0);

    // Even a stale handler invoked directly (registry bypassed) must not seek.
    const staleTimeUpdate = api.on.mock.calls[0][1] as (payload: unknown) => void;
    staleTimeUpdate({ currentTime: 50 });
    expect(api.video.currentTime).toBe(0);

    loop.stop(); // idempotent
  });

  it('start() clears suspension from a previous cycle', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api));
    loop.start({ start: 10, end: 40 });
    loop.suspend();
    loop.start({ start: 20, end: 50 }); // fresh open: must not stay suspended

    api.fire('playback:timeupdate', { currentTime: 55 });
    expect(api.video.currentTime).toBe(20);
  });

  it('never subscribes or seeks when disabled (loopPreview: false)', () => {
    const api = createMockApi();
    const loop = createPreviewLoop(asApi(api), { enabled: false });
    loop.start({ start: 10, end: 40 });
    loop.resume();

    expect(api.on).not.toHaveBeenCalled();
    expect(api.listenerCount('playback:timeupdate')).toBe(0);
    expect(api.video.currentTime).toBe(0);
  });
});
