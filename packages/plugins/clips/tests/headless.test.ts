/**
 * Headless-mode tests (plan "Headless"): with `ui: 'none'` the whole
 * imperative API must work while the plugin adds nothing to the player
 * container - the mock container starts with exactly one child (the
 * <video>) and ends the same way after a full open -> edit -> commit cycle.
 *
 * `@scarlett-player/ui` is mocked as unresolvable for the WHOLE file (the
 * plan's Headless design): the headless cases never touch it, and the
 * Group 3 case at the bottom proves the overlay mode survives it too - the
 * dynamic import rejects, the plugin's catch path logs, and the overlay +
 * imperative API keep working without the UI package. (Verified against
 * vitest 1.6: a throwing vi.mock factory intercepts dynamic `import()` as
 * well as static ones; the rejection it surfaces is vitest's wrapper
 * message, which is still an Error, which is all the plugin's catch needs.)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import type { ClipRange, ClipsPluginConfig } from '../src/types';
import { createClipsPlugin } from '../src/index';

vi.mock('@scarlett-player/ui', () => {
  throw new Error('unresolvable');
});

/** Let queued promise callbacks run - the dynamic ui import settles there. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Same mock api shape as plugin.test.ts, kept minimal here. */
function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    currentTime: 100,
    duration: 600,
    live: false,
    mediaType: 'video',
    seekableRange: null,
    ...state,
  };
  const subs = new Map<string, Array<(payload?: unknown) => unknown>>();

  return {
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    defineState: vi.fn((key: string, initial: unknown) => {
      if (!(key in store)) store[key] = initial;
    }),
    on: vi.fn((event: string, handler: (payload?: unknown) => unknown) => {
      const list = subs.get(event) ?? [];
      list.push(handler);
      subs.set(event, list);
      return vi.fn(() => subs.set(event, list.filter((h) => h !== handler)));
    }),
    emit: vi.fn(),
    off: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    store,
  };
}

let warn: MockInstance<any[], any>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  document.body.innerHTML = '';
});

describe('headless clips (ui: none)', () => {
  it('runs the whole imperative API and adds no DOM to the container', async () => {
    const onCreate = vi.fn().mockResolvedValue({ uuid: 'clip-h1', status: 'rendering' });
    const config: ClipsPluginConfig = { ui: 'none', mediaId: 'slug/abc', onCreate };
    const api = createMockApi();
    const plugin = createClipsPlugin(config);
    plugin.init(api as unknown as IPluginAPI);

    const childrenBefore = [...api.container.children];

    plugin.open();
    expect(plugin.isOpen()).toBe(true);
    plugin.setRange(20, 45.6); // snap(45.6) rounds to 46
    plugin.setTitle('from headless');

    const range = plugin.getRange() as ClipRange;
    expect(range).toMatchObject({ startTime: 20, endTime: 46, duration: 26, mediaId: 'slug/abc' });

    await plugin.commit();
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(plugin.isOpen()).toBe(false);

    const events = api.emit.mock.calls.map(([name]) => name);
    expect(events).toEqual(
      expect.arrayContaining(['clip:opened', 'clip:changed', 'clip:created']),
    );
    expect(api.store.clipSelection).toBeNull();
    expect(api.store.clipOpen).toBe(false);

    // No styles, no overlay, no buttons - the container is byte-identical.
    expect([...api.container.children]).toEqual(childrenBefore);
    expect(api.container.querySelectorAll('*').length).toBe(childrenBefore.length);
  });

  it('cancel path works without any UI', () => {
    const onCancel = vi.fn();
    const api = createMockApi();
    const plugin = createClipsPlugin({ ui: 'none', mediaId: 'm', onCreate: vi.fn(), onCancel });
    plugin.init(api as unknown as IPluginAPI);

    plugin.open();
    plugin.close();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(api.emit).toHaveBeenCalledWith('clip:cancelled', { reason: 'user' });
    expect(plugin.getRange()).toBeNull();
  });

  it('headless setTitle() is what commit() sends (trimmed; whitespace-only null)', async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const api = createMockApi();
    const plugin = createClipsPlugin({ ui: 'none', mediaId: 'm', onCreate });
    plugin.init(api as unknown as IPluginAPI);

    plugin.open();
    plugin.setTitle('  Game-winning goal  ');
    await plugin.commit();
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect((onCreate.mock.calls[0][0] as ClipRange).title).toBe('Game-winning goal');

    // An all-whitespace title is an empty title: null on the wire.
    plugin.open();
    plugin.setTitle('   ');
    await plugin.commit();
    expect((onCreate.mock.calls[1][0] as ClipRange).title).toBeNull();
  });

  it('overlay mode survives @scarlett-player/ui being unresolvable', async () => {
    // The plan's Headless guarantee, Group 3 form: ui:'none' was never the
    // only headless host. A host with the overlay but no UI package still
    // gets the whole product - just no control-bar button. The dynamic
    // import rejects; the plugin's catch path logs it and moves on.
    const api = createMockApi();
    const plugin = createClipsPlugin({ mediaId: 'm', onCreate: vi.fn().mockResolvedValue(null) });
    plugin.init(api as unknown as IPluginAPI);

    await flush(); // let the rejected import settle onto its catch path
    expect(api.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('@scarlett-player/ui not present'),
    );

    // Overlay + imperative API + events all still work: open() mounts the
    // panel (the only ui dependency is the control registration).
    plugin.open();
    expect(plugin.isOpen()).toBe(true);
    expect(api.container.querySelector('.sp-clip-editor')).not.toBeNull();

    plugin.setRange(20, 50);
    expect(api.emit).toHaveBeenCalledWith('clip:changed', { start: 20, end: 50, reason: 'user' });

    await plugin.commit();
    expect(plugin.isOpen()).toBe(false);
    expect(api.emit).toHaveBeenCalledWith('clip:created', expect.objectContaining({ result: null }));
  });

  it('a rejected import does not produce an unhandled rejection', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const api = createMockApi();
      const plugin = createClipsPlugin({ mediaId: 'm', onCreate: vi.fn() });
      plugin.init(api as unknown as IPluginAPI);
      await flush();
      await new Promise((resolve) => setImmediate(resolve));
      expect(onUnhandled).not.toHaveBeenCalled();
      plugin.destroy();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
