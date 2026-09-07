/**
 * Plugin lifecycle tests - the acceptance lists "Live gate (v1)",
 * "Submission", "Lifecycle" and the title/mediaId rules from
 * .docs/plans/scarlett-clips-plugin.md, exercised headlessly against a mock
 * IPluginAPI (shape copied from packages/plugins/share/tests/share.test.ts,
 * extended with a subscription registry so tests can fire real events).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import type { ClipRange, ClipsPluginConfig } from '../src/types';
import { createClipsPlugin } from '../src/index';
import type { ClipOperationError } from '../src/index';

const SIGNED_SRC = 'https://cdn.example.com/master.m3u8?token=SECRET-DO-NOT-SHARE';

/** Default session: 600s VOD, playhead at 100 -> preroll {70, 100}. */
const DEFAULT_STATE = {
  currentTime: 100,
  duration: 600,
  live: false,
  mediaType: 'video',
  seekableRange: null,
  src: SIGNED_SRC,
};

type Handler = (payload?: unknown) => unknown;

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = { ...DEFAULT_STATE, ...state };
  const subs: Array<{ event: string; handler: Handler }> = [];
  const cleanups: Array<() => void> = [];

  const api = {
    pluginId: 'clips',
    container,
    video,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    // Passes through to the store so getState reflects what was written.
    setState: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      const entry = { event, handler };
      subs.push(entry);
      return vi.fn(() => {
        const index = subs.indexOf(entry);
        if (index >= 0) subs.splice(index, 1);
      });
    }),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn((fn: () => void) => {
      cleanups.push(fn);
    }),
    subscribeToState: vi.fn(() => vi.fn()),

    // --- test helpers (not part of IPluginAPI) ---
    store,
    fire(event: string, payload?: unknown): void {
      for (const entry of [...subs]) {
        if (entry.event === event) entry.handler(payload);
      }
    },
    listenersFor(event: string): number {
      return subs.filter((s) => s.event === event).length;
    },
    runCleanups(): void {
      for (const fn of cleanups.splice(0)) fn();
    },
  };

  return api;
}

type MockApi = ReturnType<typeof createMockApi>;

/** payloads of every `event` emission, in order. */
function emitted(api: MockApi, event: string): unknown[] {
  return api.emit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload);
}

function lastEmitted<T = unknown>(api: MockApi, event: string): T {
  const all = emitted(api, event);
  return all[all.length - 1] as T;
}

/** Init a plugin against a fresh mock api. */
function setup(
  config: Partial<ClipsPluginConfig> = {},
  state: Record<string, unknown> = {},
): { api: MockApi; plugin: ReturnType<typeof createClipsPlugin> } {
  const api = createMockApi(state);
  const plugin = createClipsPlugin({
    mediaId: 'video-42',
    onCreate: vi.fn().mockResolvedValue({ uuid: 'clip-1', status: 'rendering' }),
    ...config,
  });
  plugin.init(api as unknown as IPluginAPI);
  return { api, plugin };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let warn: MockInstance<any[], any>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  document.body.innerHTML = '';
});

describe('constructor', () => {
  it('throws TypeError when neither onCreate nor endpoint is set', () => {
    expect(() => createClipsPlugin({})).toThrow(TypeError);
    expect(() => createClipsPlugin({ mediaId: 'm' })).toThrow(/exactly one of/);
  });

  it('throws TypeError when both onCreate and endpoint are set', () => {
    expect(() => createClipsPlugin({ onCreate: () => undefined, endpoint: { url: '/api/clips' } })).toThrow(TypeError);
  });

  it('accepts exactly one submission path', () => {
    expect(() => createClipsPlugin({ onCreate: () => undefined })).not.toThrow();
    expect(() => createClipsPlugin({ endpoint: { url: '/api/clips' } })).not.toThrow();
  });

  it('clamps a nonsense defaultDuration at construction with a warning', () => {
    createClipsPlugin({ onCreate: () => undefined, defaultDuration: 500 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('defaultDuration');
  });
});

describe('open() gates', () => {
  it('errors live-unsupported on live and opens nothing', () => {
    const { api, plugin } = setup({}, { live: true });
    plugin.open();

    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:opened')).toHaveLength(0);
    const error = lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error;
    expect(error.code).toBe('live-unsupported');
    expect(api.store.clipOpen).toBeUndefined();
  });

  it('errors media-type-unsupported on audio', () => {
    const { api, plugin } = setup({}, { mediaType: 'audio' });
    plugin.open();
    expect(lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error.code).toBe('media-type-unsupported');
    expect(plugin.isOpen()).toBe(false);
  });

  it.each([
    ['Infinity (live-like)', Infinity],
    ['zero', 0],
    ['undefined', undefined],
  ])('errors duration-unknown when duration is %s', (_label, duration) => {
    const { api, plugin } = setup({}, { duration });
    plugin.open();
    expect(lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error.code).toBe('duration-unknown');
    expect(plugin.isOpen()).toBe(false);
  });

  it('errors media-id-unresolved when mediaId is unset or null', () => {
    const { api, plugin } = setup({ mediaId: undefined });
    plugin.open();
    expect(lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error.code).toBe('media-id-unresolved');
    expect(plugin.isOpen()).toBe(false);
  });

  it('catches a throwing mediaId function and reports it, nothing opens', () => {
    const onError = vi.fn();
    const boom = new Error('token lookup failed');
    const { api, plugin } = setup({ mediaId: () => { throw boom; }, onError });

    expect(() => plugin.open()).not.toThrow();
    expect(onError).toHaveBeenCalledWith(boom);
    expect(lastEmitted<{ error: Error }>(api, 'clip:error').error).toBe(boom);
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:opened')).toHaveLength(0);
  });

  it('opens with a preroll selection, state writes and a started loop', () => {
    const { api, plugin } = setup();
    plugin.open();

    expect(plugin.isOpen()).toBe(true);
    expect(lastEmitted(api, 'clip:opened')).toEqual({ start: 70, end: 100 });
    expect(api.store.clipSelection).toEqual({ start: 70, end: 100 });
    expect(api.store.clipOpen).toBe(true);
    // Preview loop subscribed.
    expect(api.listenersFor('playback:timeupdate')).toBe(1);
    expect(api.listenersFor('playback:ended')).toBe(1);

    // The loop actually runs over the session.
    api.fire('playback:timeupdate', { currentTime: 100.2 });
    expect(api.video.currentTime).toBe(70);
  });

  it('resets the title on open', () => {
    const { api, plugin } = setup();
    plugin.setTitle('stale title');
    plugin.open();
    expect(api.store.clipTitle).toBe('');
    expect(plugin.getRange()?.title).toBeNull();
  });

  it('resolves a mediaId function once per session', () => {
    const mediaId = vi.fn(() => 'playback-token');
    const { plugin } = setup({ mediaId });
    plugin.open();
    expect(plugin.getRange()?.mediaId).toBe('playback-token');
    expect(mediaId).toHaveBeenCalledTimes(1);
  });

  it('is a no-op while already open (no second clientRequestId)', () => {
    const { api, plugin } = setup();
    plugin.open();
    const first = plugin.getRange()?.clientRequestId;
    plugin.open();
    expect(emitted(api, 'clip:opened')).toHaveLength(1);
    expect(plugin.getRange()?.clientRequestId).toBe(first);
  });
});

describe('close() and source changes', () => {
  it('emits exactly one clip:cancelled for repeated closes', () => {
    const onCancel = vi.fn();
    const { api, plugin } = setup({ onCancel });
    plugin.open();
    plugin.close();
    plugin.close();

    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'user' }]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(api.store.clipSelection).toBeNull();
    expect(api.store.clipOpen).toBe(false);
  });

  it('load-request then playlist:change cancels once with source-change and stops the loop', () => {
    const { api, plugin } = setup();
    plugin.open();
    const disposers = api.on.mock.results.map((r) => r.value as ReturnType<typeof vi.fn>);

    api.fire('media:load-request', { src: 'next.m3u8' });
    api.fire('playlist:change', { track: null, index: 1 });

    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'source-change' }]);
    expect(plugin.isOpen()).toBe(false);
    // The loop's two subscriptions (registered after init's two) are
    // released; the init-level load-request/playlist:change listeners stay.
    expect(disposers.slice(2).every((off) => off.mock.calls.length === 1)).toBe(true);
    expect(disposers[0].mock.calls.length).toBe(0);
    expect(disposers[1].mock.calls.length).toBe(0);
    expect(api.listenersFor('playback:timeupdate')).toBe(0);
    // And the closed session cannot be re-looped by a stray timeupdate.
    api.fire('playback:timeupdate', { currentTime: 120 });
    expect(api.video.currentTime).toBe(0);
  });

  it('source-change while closed emits nothing', () => {
    const { api, plugin } = setup();
    plugin.open();
    plugin.close();
    const count = emitted(api, 'clip:cancelled').length;
    api.fire('playlist:change', { track: null, index: 1 });
    expect(emitted(api, 'clip:cancelled')).toHaveLength(count);
  });
});

describe('setRange / setTitle / getRange', () => {
  it('clamps and snaps a requested range and emits clip:changed user', () => {
    const { api, plugin } = setup();
    plugin.open();
    plugin.setRange(50.4, 200.6); // snap -> 50/201, maxDuration 60 -> end 110

    const sel = { start: 50, end: 110 };
    expect(api.store.clipSelection).toEqual(sel);
    expect(lastEmitted(api, 'clip:changed')).toEqual({ ...sel, reason: 'user' });
    // The loop follows the retargeted selection without resubscribing.
    expect(api.listenersFor('playback:timeupdate')).toBe(1);
    api.fire('playback:timeupdate', { currentTime: 111 });
    expect(api.video.currentTime).toBe(50);
  });

  it('does nothing while closed', () => {
    const { api, plugin } = setup();
    plugin.setRange(10, 20);
    expect(api.store.clipSelection).toBeUndefined();
    expect(emitted(api, 'clip:changed')).toHaveLength(0);
  });

  it('trims titles and truncates to maxLength', () => {
    const { api, plugin } = setup({ title: { maxLength: 5 } });
    plugin.open();
    plugin.setTitle('  abcdefghij  ');
    expect(api.store.clipTitle).toBe('abcde');

    plugin.setTitle('   ');
    expect(api.store.clipTitle).toBe('');
  });

  it('getRange returns null when closed and the full VOD payload when open', () => {
    const { plugin } = setup();
    expect(plugin.getRange()).toBeNull();
    plugin.open();

    const range = plugin.getRange();
    expect(range).not.toBeNull();
    expect(range).toMatchObject({
      startTime: 70,
      endTime: 100,
      duration: 30,
      mediaId: 'video-42',
      title: null,
      isLive: false,
      seekableStart: null,
      seekableEnd: null,
      startDate: null,
      endDate: null,
    });
    expect(range?.clientRequestId).toBeTruthy();
    expect(Number.isNaN(Date.parse(range!.capturedAt))).toBe(false);
    expect(range).not.toHaveProperty('src');
    // The signed URL must not reach a host's endpoint under any key, so assert
    // on what actually goes on the wire rather than on the one field name.
    const wire = JSON.stringify(range);
    expect(wire).not.toContain(SIGNED_SRC);
    expect(wire).not.toContain('SECRET-DO-NOT-SHARE');

    plugin.close();
    expect(plugin.getRange()).toBeNull();
  });
});

describe('commit() - onCreate path', () => {
  it('emits clip:created with range and result, then closes without a cancel', async () => {
    const onCreate = vi.fn().mockResolvedValue({ uuid: 'clip-1' });
    const onCancel = vi.fn();
    const { api, plugin } = setup({ onCreate, onCancel });
    plugin.open();

    await plugin.commit();

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0] as ClipRange;
    expect(payload.mediaId).toBe('video-42');
    expect(lastEmitted(api, 'clip:created')).toEqual({ range: payload, result: { uuid: 'clip-1' } });
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:cancelled')).toHaveLength(0);
    expect(onCancel).not.toHaveBeenCalled();
    expect(api.store.clipOpen).toBe(false);
  });

  it('sends the title state in the payload; title:false forces null', async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const { plugin } = setup({ onCreate });
    plugin.open();
    plugin.setTitle('  Game-winning goal  ');
    await plugin.commit();
    expect(onCreate.mock.calls[0][0].title).toBe('Game-winning goal');

    const offSetup = setup({ onCreate: onCreate, title: false });
    offSetup.plugin.open();
    offSetup.plugin.setTitle('ignored');
    await offSetup.plugin.commit();
    expect(onCreate.mock.calls[1][0].title).toBeNull();
  });

  it('reports validation and mediaId failures through onError + clip:error and stays open', async () => {
    const onCreate = vi.fn();
    const onError = vi.fn();
    let resolvable = false;
    const { api, plugin } = setup({
      onCreate,
      onError,
      title: { required: true },
      mediaId: () => (resolvable ? 'video-42' : null),
    });
    resolvable = true;
    plugin.open();
    resolvable = false;

    await plugin.commit();
    expect(onCreate).not.toHaveBeenCalled();
    expect(lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error.code).toBe('media-id-unresolved');
    expect(plugin.isOpen()).toBe(true);
    expect(api.store.clipOpen).toBe(true);

    resolvable = true;
    await plugin.commit(); // required title still empty -> title-required
    expect(onCreate).not.toHaveBeenCalled();
    expect(lastEmitted<{ error: ClipOperationError }>(api, 'clip:error').error.code).toBe('title-required');
    expect(plugin.isOpen()).toBe(true);

    plugin.setTitle('Nice');
    await plugin.commit();
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(plugin.isOpen()).toBe(false);
  });

  it('a rejected onCreate keeps the selector open and a re-submit succeeds', async () => {
    const boom = new Error('server said no');
    const onCreate = vi.fn().mockRejectedValueOnce(boom).mockResolvedValue({ uuid: 'clip-2' });
    const onError = vi.fn();
    const { api, plugin } = setup({ onCreate, onError });
    plugin.open();

    await plugin.commit();
    expect(onError).toHaveBeenCalledWith(boom);
    expect(lastEmitted<{ error: Error }>(api, 'clip:error').error).toBe(boom);
    expect(plugin.isOpen()).toBe(true);
    expect(emitted(api, 'clip:created')).toHaveLength(0);

    await plugin.commit();
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:created')).toHaveLength(1);
  });

  it('keeps one clientRequestId across retries in a session, and mints a new one next open', async () => {
    const onCreate = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ uuid: 'clip-3' });
    const { plugin } = setup({ onCreate });
    plugin.open();

    await plugin.commit(); // fails
    const first = onCreate.mock.calls[0][0] as ClipRange;
    await plugin.commit(); // succeeds
    const second = onCreate.mock.calls[1][0] as ClipRange;
    expect(second.clientRequestId).toBe(first.clientRequestId);

    plugin.open();
    await plugin.commit();
    const third = onCreate.mock.calls[2][0] as ClipRange;
    expect(third.clientRequestId).not.toBe(first.clientRequestId);
  });

  it('ignores a second commit while one is pending, with a debug log', async () => {
    const gate = deferred<{ uuid: string }>();
    const onCreate = vi.fn(() => gate.promise);
    const { api, plugin } = setup({ onCreate });
    plugin.open();

    const first = plugin.commit();
    const second = plugin.commit();
    await second;
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(api.logger.debug).toHaveBeenCalledWith(expect.stringContaining('in flight'));

    gate.resolve({ uuid: 'x' });
    await first;
    expect(plugin.isOpen()).toBe(false);
  });

  it('a submission settling after close still emits clip:created but touches no other state', async () => {
    const gate = deferred<{ uuid: string }>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();

    const pending = plugin.commit();
    plugin.close();
    const writesAfterClose = api.setState.mock.calls.length;
    gate.resolve({ uuid: 'late' });
    await pending;

    expect(lastEmitted(api, 'clip:created')).toMatchObject({ result: { uuid: 'late' } });
    expect(api.setState.mock.calls.length).toBe(writesAfterClose);
    expect(plugin.isOpen()).toBe(false);
  });

  it('a submission settling after destroy is dropped', async () => {
    const gate = deferred<{ uuid: string }>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();
    const pending = plugin.commit();
    plugin.destroy();
    gate.resolve({ uuid: 'ghost' });
    await pending;

    expect(emitted(api, 'clip:created')).toHaveLength(0);
    expect(emitted(api, 'clip:error')).toHaveLength(0);
  });

  it('a submission settling after destroy AND re-init is dropped (generation guard)', async () => {
    const gate = deferred<{ uuid: string }>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();
    const pending = plugin.commit();
    plugin.destroy();
    // A fresh lifecycle on the same api: the dead generation's settle must
    // emit nothing into it.
    plugin.init(api as unknown as IPluginAPI);
    gate.resolve({ uuid: 'ghost' });
    await pending;

    expect(emitted(api, 'clip:created')).toHaveLength(0);
    expect(emitted(api, 'clip:error')).toHaveLength(0);
    expect(plugin.isOpen()).toBe(false);
  });

  it('destroy releases the in-flight guard so the re-inited plugin can commit', async () => {
    const gate = deferred<{ uuid: string }>();
    const onCreate = vi.fn(() => gate.promise); // deliberately never settles on its own
    const { api, plugin } = setup({ onCreate });
    plugin.open();
    const hungAttempt = plugin.commit();
    expect(onCreate).toHaveBeenCalledTimes(1);

    plugin.destroy();
    plugin.init(api as unknown as IPluginAPI);
    plugin.open();
    const freshAttempt = plugin.commit();
    // A stale `inFlight` from the dead lifecycle must not swallow this one.
    expect(onCreate).toHaveBeenCalledTimes(2);

    gate.resolve({ uuid: 'either-way' });
    await hungAttempt; // dropped: its generation no longer exists
    await freshAttempt; // runs the normal success close
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:created')).toHaveLength(1);
  });

  it('a failing submission settling after close reports clip:error without reopening state', async () => {
    const gate = deferred<unknown>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();
    const pending = plugin.commit();
    plugin.close();
    gate.reject(new Error('too late'));
    await pending;

    expect(emitted(api, 'clip:error')).toHaveLength(1);
    expect(emitted(api, 'clip:cancelled')).toHaveLength(1); // only the user close
    expect(plugin.isOpen()).toBe(false);
  });

  it('commit while closed is a no-op', async () => {
    const onCreate = vi.fn();
    const { plugin } = setup({ onCreate });
    await plugin.commit();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('commit() - endpoint path', () => {
  it('submits via the injected transport and closes on success', async () => {
    const result = { uuid: 'clip-9', status: 'rendering' };
    const endpoint = {
      url: '/api/clips',
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify(result),
      }),
    };
    const { api, plugin } = setup({ onCreate: undefined, endpoint });
    plugin.open();

    await plugin.commit();

    expect(endpoint.fetch).toHaveBeenCalledTimes(1);
    expect(lastEmitted(api, 'clip:created')).toMatchObject({ result });
    expect(plugin.isOpen()).toBe(false);
  });

  it('a transport failure keeps the selector open for retry', async () => {
    const endpoint = {
      url: '/api/clips',
      fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    };
    const onError = vi.fn();
    const { plugin } = setup({ onCreate: undefined, endpoint, onError });
    plugin.open();

    await plugin.commit();

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).name).toBe('ClipSubmitError');
    expect(plugin.isOpen()).toBe(true);
  });
});

describe('configure()', () => {
  it('re-clamps an open selection below maxDuration and emits clip:changed clamp', () => {
    const { api, plugin } = setup();
    plugin.open(); // {70, 100}

    plugin.configure({ maxDuration: 10 });

    expect(api.store.clipSelection).toEqual({ start: 70, end: 80 });
    expect(lastEmitted(api, 'clip:changed')).toEqual({ start: 70, end: 80, reason: 'clamp' });
    // The loop retargeted to the shrunk selection.
    api.fire('playback:timeupdate', { currentTime: 85 });
    expect(api.video.currentTime).toBe(70);
  });

  it('emits nothing when the selection still satisfies the new limits', () => {
    const { api, plugin } = setup();
    plugin.open();
    plugin.configure({ maxDuration: 200 });
    expect(emitted(api, 'clip:changed')).toHaveLength(0);
    expect(api.store.clipSelection).toEqual({ start: 70, end: 100 });
  });

  it('warns and clamps min > max, leaving a valid selection', () => {
    const { api, plugin } = setup();
    plugin.open(); // {70, 100}

    plugin.configure({ minDuration: 500 });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('minDuration'));
    const sel = api.store.clipSelection as { start: number; end: number };
    expect(sel.end - sel.start).toBeCloseTo(60); // maxDuration authority kept
    expect(lastEmitted(api, 'clip:changed')).toMatchObject({ reason: 'clamp' });
  });

  it('updates the loop target for later commits without a session reset', async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const { plugin } = setup({ onCreate });
    plugin.open();
    plugin.configure({ maxDuration: 10 });
    await plugin.commit();
    expect(onCreate.mock.calls[0][0]).toMatchObject({ startTime: 70, endTime: 80, duration: 10 });
  });
});

describe('overlay integration (Group 3 wiring)', () => {
  it('mounts the panel on open and unmounts it on close', () => {
    const { api, plugin } = setup();
    expect(api.container.querySelector('.sp-clip-panel')).toBeNull();

    plugin.open();
    expect(api.container.querySelector('.sp-clip-panel')).not.toBeNull();

    plugin.close();
    expect(api.container.querySelector('.sp-clip-panel')).toBeNull();
  });

  it('the panel Cancel button closes the session like plugin.close()', () => {
    const { api, plugin } = setup();
    plugin.open();
    api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--cancel')!.click();
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'user' }]);
    expect(api.container.querySelector('.sp-clip-panel')).toBeNull();
  });

  it('a configure() re-clamp flashes the clamp reason in the notice', () => {
    const { api, plugin } = setup();
    plugin.open(); // {70, 100}, 30s long
    plugin.configure({ maxDuration: 10 });

    const notice = api.container.querySelector<HTMLElement>('.sp-clip-notice')!;
    expect(notice.textContent).toBe('Max 10s');
    expect(notice.classList.contains('sp-clip-notice--visible')).toBe(true);
  });

  it('setRange while open re-renders the panel from clipSelection', () => {
    const { api, plugin } = setup();
    plugin.open();
    plugin.setRange(250, 300);
    const readout = api.container.querySelector<HTMLElement>('.sp-clip-readout')!;
    expect(readout.textContent).toBe('4:10 – 5:00 · 50s');
  });

  it('typing in the title field updates clipTitle state', () => {
    const { api, plugin } = setup();
    plugin.open();
    const input = api.container.querySelector<HTMLInputElement>('.sp-clip-title')!;
    input.value = 'Best bit';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(api.store.clipTitle).toBe('Best bit');
  });

  it('commit success shows the transient toast, closes the panel, then removes the toast', async () => {
    vi.useFakeTimers();
    try {
      const { api, plugin } = setup();
      plugin.open();
      await plugin.commit(); // microtask-only chain; fake timers do not block it

      expect(plugin.isOpen()).toBe(false);
      expect(api.container.querySelector('.sp-clip-panel')).toBeNull();
      const toast = api.container.querySelector<HTMLElement>('.sp-clip-toast')!;
      expect(toast.textContent).toBe('Clip requested');
      expect(toast.getAttribute('role')).toBe('status');

      vi.advanceTimersByTime(2000);
      expect(api.container.querySelector('.sp-clip-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('commit failure keeps the panel open and shows the server message as literal text', async () => {
    const serverMessage = '<b>Clips may be at most 60 seconds</b>';
    const endpoint = {
      url: '/api/clips',
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ message: serverMessage }),
      }),
    };
    const { api, plugin } = setup({ onCreate: undefined, endpoint });
    plugin.open();
    await plugin.commit();

    const panel = api.container.querySelector<HTMLElement>('.sp-clip-panel');
    expect(panel).not.toBeNull(); // selector stays open for a retry
    const notice = panel!.querySelector<HTMLElement>('.sp-clip-notice')!;
    // textContent only: the markup must survive as text, never as elements.
    expect(notice.textContent).toBe(serverMessage);
    expect(notice.querySelector('b')).toBeNull();
    expect(notice.classList.contains('sp-clip-notice--error')).toBe(true);
    expect(notice.classList.contains('sp-clip-notice--visible')).toBe(true);

    const confirm = panel!.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!;
    expect(confirm.disabled).toBe(false); // re-enabled for the retry
    expect(confirm.classList.contains('sp-clip-btn--submitting')).toBe(false);
    expect(plugin.isOpen()).toBe(true);
    expect(api.container.querySelector('.sp-clip-toast')).toBeNull();
  });

  it('a transport failure with no server body shows the generic line', async () => {
    const endpoint = {
      url: '/api/clips',
      fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    };
    const { api, plugin } = setup({ onCreate: undefined, endpoint });
    plugin.open();
    await plugin.commit();
    const notice = api.container.querySelector<HTMLElement>('.sp-clip-notice')!;
    expect(notice.textContent).toBe("Couldn't create the clip. Please try again.");
  });

  it('a submission settling after close emits but adds no DOM (no toast, no panel)', async () => {
    const gate = deferred<{ uuid: string }>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();
    const pending = plugin.commit();
    plugin.close();
    gate.resolve({ uuid: 'late' });
    await pending;

    expect(lastEmitted(api, 'clip:created')).toMatchObject({ result: { uuid: 'late' } });
    expect(api.container.querySelector('.sp-clip-panel')).toBeNull();
    expect(api.container.querySelector('.sp-clip-toast')).toBeNull();
  });

  it('Confirm click enters the submitting state until the attempt settles', async () => {
    const gate = deferred<{ uuid: string }>();
    const { api, plugin } = setup({ onCreate: () => gate.promise });
    plugin.open();
    const confirm = api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--confirm')!;
    confirm.click();

    // In flight: both buttons down, spinner on Confirm.
    expect(confirm.classList.contains('sp-clip-btn--submitting')).toBe(true);
    expect(confirm.disabled).toBe(true);
    expect(confirm.querySelector('.sp-clip-spinner')).not.toBeNull();
    const cancel = api.container.querySelector<HTMLButtonElement>('.sp-clip-btn--cancel')!;
    expect(cancel.disabled).toBe(true);
    // A second click while pending must not double-submit.
    confirm.click();
    expect(plugin.isOpen()).toBe(true);

    gate.resolve({ uuid: 'ok' });
    await vi.waitFor(() => {
      expect(plugin.isOpen()).toBe(false);
    });
  });

  it('Escape through the panel routes to a user cancel', () => {
    const { api, plugin } = setup();
    plugin.open();
    const panel = api.container.querySelector<HTMLElement>('.sp-clip-panel')!;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(plugin.isOpen()).toBe(false);
    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'user' }]);
  });

  it('renders nothing on a gated open: live media errors without mounting a panel', () => {
    const { api, plugin } = setup({}, { live: true });
    plugin.open();
    expect(plugin.isOpen()).toBe(false);
    expect(api.container.querySelector('.sp-clip-panel')).toBeNull();
    // Only the <video> is in the container - the gate mounted no DOM at all.
    expect(api.container.children).toHaveLength(1);
  });

  it('a late SUCCESS after close -> re-open emits but leaves the NEW session alone', async () => {
    const gate = deferred<{ uuid: string }>();
    const onCreate = vi.fn(() => gate.promise);
    const { api, plugin } = setup({ onCreate });
    plugin.open();
    const firstKey = plugin.getRange()?.clientRequestId;

    const pending = plugin.commit();
    plugin.close();
    plugin.open(); // fresh session while the request is still in flight
    const secondKey = plugin.getRange()?.clientRequestId;
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);

    gate.resolve({ uuid: 'late-but-real' });
    await pending;

    // The event still fires: the server may well have created that clip.
    expect(lastEmitted(api, 'clip:created')).toMatchObject({
      range: { clientRequestId: firstKey },
      result: { uuid: 'late-but-real' },
    });
    // ...but the new session survives intact: no kill, no toast, no cancel.
    expect(plugin.isOpen()).toBe(true);
    expect(plugin.getRange()?.clientRequestId).toBe(secondKey);
    expect(api.store.clipOpen).toBe(true);
    expect(api.container.querySelector('.sp-clip-panel')).not.toBeNull();
    expect(api.container.querySelector('.sp-clip-toast')).toBeNull();
    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'user' }]); // only the real close
  });

  it('a late FAILURE after close -> re-open emits clip:error and does not touch the new panel', async () => {
    const gate = deferred<unknown>();
    const onError = vi.fn();
    const { api, plugin } = setup({ onCreate: () => gate.promise, onError });
    plugin.open();

    const pending = plugin.commit();
    plugin.close();
    plugin.open(); // new session, new panel, before the attempt settles

    gate.reject(new Error('stale server verdict'));
    await pending;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(emitted(api, 'clip:error')).toHaveLength(1);
    // The NEW session's panel notice stays pristine - no cross-session chrome.
    const notice = api.container.querySelector<HTMLElement>('.sp-clip-notice')!;
    expect(notice.textContent).toBe('');
    expect(notice.classList.contains('sp-clip-notice--visible')).toBe(false);
    expect(plugin.isOpen()).toBe(true);
  });
});

describe('loopPreview and destroy', () => {
  it('loopPreview: false never subscribes the loop', () => {
    const { api, plugin } = setup({ loopPreview: false });
    plugin.open();
    expect(api.listenersFor('playback:timeupdate')).toBe(0);
    api.fire('playback:timeupdate', { currentTime: 500 });
    expect(api.video.currentTime).toBe(0);
  });

  it('destroy unsubscribes everything, cancels an open session and is idempotent', () => {
    const { api, plugin } = setup();
    plugin.open();
    const disposers = api.on.mock.results.map((r) => r.value as ReturnType<typeof vi.fn>);
    expect(disposers.length).toBeGreaterThan(2);

    plugin.destroy();
    // core may run api.onDestroy cleanups after destroy() - must not throw
    // or double-emit.
    api.runCleanups();

    expect(disposers.every((off) => off.mock.calls.length === 1)).toBe(true);
    expect(api.listenersFor('playback:timeupdate')).toBe(0);
    expect(api.listenersFor('media:load-request')).toBe(0);
    expect(api.listenersFor('playlist:change')).toBe(0);
    expect(emitted(api, 'clip:cancelled')).toEqual([{ reason: 'destroy' }]);
    expect(plugin.isOpen()).toBe(false);
  });

  it('a second player is unaffected by the first one destroying', async () => {
    const first = setup();
    const second = setup();
    second.plugin.open();

    first.plugin.destroy();
    first.api.runCleanups();

    expect(second.plugin.isOpen()).toBe(true);
    await second.plugin.commit();
    expect(lastEmitted(second.api, 'clip:created')).toMatchObject({});
    expect(second.api.store.clipOpen).toBe(false);
  });

  it('re-init after destroy restores a working lifecycle', () => {
    const { api, plugin } = setup();
    plugin.destroy();
    plugin.init(api as unknown as IPluginAPI);
    expect(api.defineState).toHaveBeenCalledTimes(6); // idempotent re-defines
    plugin.open();
    expect(plugin.isOpen()).toBe(true);
  });
});
