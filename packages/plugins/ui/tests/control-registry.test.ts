/**
 * Custom control registry tests.
 *
 * Covers the contract plugin packages rely on: register a factory under an id,
 * have it render when a layout asks for it, and have that work whether the
 * registration happens before or after the UI plugin initialises.
 *
 * A registration after init queues one rebuild on the microtask queue rather
 * than rebuilding inline, so every test that registers after `plugin.init`
 * awaits {@link flushRebuild} before reading the bar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uiPlugin,
  registerControl,
  unregisterControl,
  unregisterControlsFor,
  getControlFactory,
  resetControlRegistry,
  UNRESOLVED_SLOT_GRACE_MS,
} from '../src/index';
import type { Control } from '../src/types';
import type { IPluginAPI } from '@scarlett-player/core';
import type { MockPluginAPI } from './mock-api';

function createMockApi(): MockPluginAPI {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    duration: 100,
    currentTime: 0,
    volume: 1,
    qualities: [],
    textTracks: [],
    buffered: null,
    seekableRange: null,
  };

  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);

  return {
    pluginId: 'ui-controls',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockPluginAPI;
}

/** Minimal control, standing in for one a plugin package would ship. */
function createTestControl(label: string): Control {
  const el = document.createElement('button');
  el.className = `sp-${label}`;
  el.textContent = label;

  return {
    render: () => el,
    update: vi.fn(),
    destroy: vi.fn(() => el.remove()),
  };
}

/**
 * Let the rebuild a late registration queued run.
 *
 * The plugin coalesces registrations onto one `queueMicrotask`, so one
 * microtask turn is exactly what separates "registered" from "rendered".
 */
const flushRebuild = (): Promise<void> => Promise.resolve();

describe('control registry', () => {
  let api: MockPluginAPI;

  beforeEach(() => {
    resetControlRegistry();
    api = createMockApi();
  });

  afterEach(() => {
    resetControlRegistry();
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  describe('registration', () => {
    it('stores and returns a factory', () => {
      const factory = vi.fn(() => createTestControl('demo'));
      registerControl('demo', factory);

      expect(getControlFactory('demo')).toBe(factory);
    });

    it('returns null for an unregistered id', () => {
      expect(getControlFactory('nope')).toBeNull();
    });

    it('unregisters', () => {
      registerControl('demo', () => createTestControl('demo'));

      expect(unregisterControl('demo')).toBe(true);
      expect(getControlFactory('demo')).toBeNull();
      expect(unregisterControl('demo')).toBe(false);
    });
  });

  describe('rendering', () => {
    it('renders a registered control listed in the layout', async () => {
      registerControl('demo', () => createTestControl('demo'));

      const plugin = uiPlugin({ controls: ['play', 'demo'] });
      await plugin.init(api);

      expect(api.container.querySelector('.sp-demo')).not.toBeNull();
    });

    it('passes the player api to the factory', async () => {
      const factory = vi.fn(() => createTestControl('demo'));
      registerControl('demo', factory);

      const plugin = uiPlugin({ controls: ['demo'] });
      await plugin.init(api);

      expect(factory).toHaveBeenCalledWith(api);
    });

    it('warns and skips an unknown slot with nothing registered', async () => {
      vi.useFakeTimers();
      try {
        const plugin = uiPlugin({ controls: ['play', 'ghost'] });
        await plugin.init(api);

        expect(api.container.querySelector('.sp-ghost')).toBeNull();
        // Not yet: the plugin that owns the slot may simply not have run.
        expect(api.logger.warn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(UNRESOLVED_SLOT_GRACE_MS);

        expect(api.logger.warn).toHaveBeenCalledTimes(1);
        expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining('ghost'));

        await plugin.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('survives a factory that throws', async () => {
      registerControl('broken', () => {
        throw new Error('factory blew up');
      });

      const plugin = uiPlugin({ controls: ['play', 'broken'] });
      await expect(plugin.init(api)).resolves.not.toThrow();

      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('broken'),
        expect.anything(),
      );
      // The rest of the bar still built.
      expect(api.container.querySelector('.sp-play')).not.toBeNull();
    });
  });

  describe('registration after init', () => {
    it('rebuilds the control bar so a late control still appears', async () => {
      // Plugin init order is not guaranteed: the UI plugin can build its bar
      // before the plugin contributing the control has run.
      const plugin = uiPlugin({ controls: ['play', 'demo'] });
      await plugin.init(api);

      expect(api.container.querySelector('.sp-demo')).toBeNull();

      registerControl('demo', () => createTestControl('demo'));
      await flushRebuild();

      expect(api.container.querySelector('.sp-demo')).not.toBeNull();
    });

    it('keeps the configured order after a rebuild', async () => {
      const plugin = uiPlugin({ controls: ['demo', 'play'] });
      await plugin.init(api);

      registerControl('demo', () => createTestControl('demo'));
      await flushRebuild();

      const bar = api.container.querySelector('.sp-controls');
      const rendered = Array.from(bar?.children ?? []);
      expect(rendered[0]?.classList.contains('sp-demo')).toBe(true);
    });

    it('does not rebuild for an id absent from the layout', async () => {
      const plugin = uiPlugin({ controls: ['play'] });
      await plugin.init(api);

      const bar = api.container.querySelector('.sp-controls');
      const before = bar?.children.length;

      registerControl('unused', () => createTestControl('unused'));
      await flushRebuild();

      expect(api.container.querySelector('.sp-unused')).toBeNull();
      expect(bar?.children.length).toBe(before);
    });

    it('destroys the previous controls when rebuilding', async () => {
      const first = createTestControl('demo');
      registerControl('demo', () => first);

      const plugin = uiPlugin({ controls: ['demo'] });
      await plugin.init(api);

      const initial = api.container.querySelectorAll('.sp-demo').length;
      expect(initial).toBe(1);

      // Re-registering replaces the factory and rebuilds; the old instance must
      // be destroyed rather than left orphaned in the DOM.
      registerControl('demo', () => createTestControl('demo'));
      await flushRebuild();

      expect(api.container.querySelectorAll('.sp-demo').length).toBe(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
    });

    it('rebuilds once for several registrations in one tick', async () => {
      // The playlist plugin registers three ids back to back. Each used to
      // tear the bar down and build it again, so every control was destroyed
      // and recreated once per registration.
      const plugin = uiPlugin({ controls: ['one', 'play', 'two', 'three'] });
      await plugin.init(api);

      // All three land before anything is rebuilt, so `one` is created by the
      // first rebuild. A rebuild destroys every control it replaces exactly
      // once, so its destroy count is the number of rebuilds that followed.
      const one = createTestControl('one');
      registerControl('one', () => one, { owner: api.container });
      registerControl('two', () => createTestControl('two'), { owner: api.container });
      registerControl('three', () => createTestControl('three'), { owner: api.container });

      expect(api.container.querySelector('.sp-one')).toBeNull();

      await flushRebuild();

      const bar = api.container.querySelector('.sp-controls');
      const rendered = Array.from(bar?.children ?? []);
      expect(rendered[0]?.classList.contains('sp-one')).toBe(true);
      expect(rendered[1]?.classList.contains('sp-play')).toBe(true);
      expect(rendered[2]?.classList.contains('sp-two')).toBe(true);
      expect(rendered[3]?.classList.contains('sp-three')).toBe(true);
      expect(one.destroy).not.toHaveBeenCalled();

      // Nothing else was queued: a second turn changes nothing.
      await flushRebuild();
      expect(one.destroy).not.toHaveBeenCalled();
      expect(api.container.querySelectorAll('.sp-one').length).toBe(1);

      await plugin.destroy();
    });

    it('stays quiet about a slot registered inside the grace period', async () => {
      vi.useFakeTimers();
      try {
        const plugin = uiPlugin({ controls: ['play', 'late'] });
        await plugin.init(api);

        vi.advanceTimersByTime(UNRESOLVED_SLOT_GRACE_MS - 1);
        registerControl('late', () => createTestControl('late'));
        await flushRebuild();

        vi.advanceTimersByTime(UNRESOLVED_SLOT_GRACE_MS * 2);

        expect(api.logger.warn).not.toHaveBeenCalled();
        expect(api.container.querySelector('.sp-late')).not.toBeNull();

        await plugin.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops rebuilding once the plugin is destroyed', async () => {
      const plugin = uiPlugin({ controls: ['play', 'demo'] });
      await plugin.init(api);
      await plugin.destroy();

      expect(() => registerControl('demo', () => createTestControl('demo'))).not.toThrow();
      await flushRebuild();
      expect(document.querySelector('.sp-demo')).toBeNull();
    });

    it('drops a queued rebuild when destroyed before it flushes', async () => {
      const existing = createTestControl('existing');
      registerControl('existing', () => existing);

      const plugin = uiPlugin({ controls: ['existing', 'demo'] });
      await plugin.init(api);

      const late = createTestControl('demo');
      registerControl('demo', () => late);
      await plugin.destroy();

      // Teardown destroyed the rendered control once. The flush that lands
      // now must not rebuild a bar that is gone, so no further destroy calls
      // and no late control ever created.
      await expect(flushRebuild()).resolves.toBeUndefined();

      expect(existing.destroy).toHaveBeenCalledTimes(1);
      expect(late.destroy).not.toHaveBeenCalled();
      expect(api.container.querySelector('.sp-controls')).toBeNull();
      expect(api.container.querySelector('.sp-demo')).toBeNull();
      expect(api.container.querySelector('.sp-existing')).toBeNull();
    });

    it('clears the grace timer when destroyed before it fires', async () => {
      vi.useFakeTimers();
      try {
        const plugin = uiPlugin({ controls: ['play', 'ghost'] });
        await plugin.init(api);
        await plugin.destroy();

        vi.advanceTimersByTime(UNRESOLVED_SLOT_GRACE_MS * 2);

        expect(api.logger.warn).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('control registry - per-player scoping', () => {
  let apiA: IPluginAPI;
  let apiB: IPluginAPI;

  beforeEach(() => {
    resetControlRegistry();
    apiA = createMockApi();
    apiB = createMockApi();
  });

  afterEach(() => {
    resetControlRegistry();
    apiA.container.remove();
    apiB.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('serves each player its own factory for the same id', () => {
    const factoryA = vi.fn(() => createTestControl('a'));
    const factoryB = vi.fn(() => createTestControl('b'));

    registerControl('demo', factoryA, { owner: apiA.container });
    registerControl('demo', factoryB, { owner: apiB.container });

    expect(getControlFactory('demo', apiA.container)).toBe(factoryA);
    expect(getControlFactory('demo', apiB.container)).toBe(factoryB);
  });

  it('falls back to a global factory when the player registered none', () => {
    const global = vi.fn(() => createTestControl('global'));
    registerControl('demo', global);

    expect(getControlFactory('demo', apiA.container)).toBe(global);
  });

  it('prefers the player-owned factory over a global one', () => {
    const global = vi.fn(() => createTestControl('global'));
    const owned = vi.fn(() => createTestControl('owned'));

    registerControl('demo', global);
    registerControl('demo', owned, { owner: apiA.container });

    expect(getControlFactory('demo', apiA.container)).toBe(owned);
    expect(getControlFactory('demo', apiB.container)).toBe(global);
    expect(getControlFactory('demo')).toBe(global);
  });

  it('hides a scoped factory from a lookup with no owner', () => {
    registerControl('demo', () => createTestControl('a'), { owner: apiA.container });

    expect(getControlFactory('demo')).toBeNull();
  });

  it('drops everything a player registered', () => {
    registerControl('one', () => createTestControl('one'), { owner: apiA.container });
    registerControl('two', () => createTestControl('two'), { owner: apiA.container });
    registerControl('one', () => createTestControl('other'), { owner: apiB.container });

    expect(unregisterControlsFor(apiA.container)).toBe(2);

    expect(getControlFactory('one', apiA.container)).toBeNull();
    expect(getControlFactory('two', apiA.container)).toBeNull();
    expect(getControlFactory('one', apiB.container)).not.toBeNull();
  });

  it('unregisters a scoped factory without touching the global one', () => {
    const global = vi.fn(() => createTestControl('global'));
    registerControl('demo', global);
    registerControl('demo', () => createTestControl('owned'), { owner: apiA.container });

    expect(unregisterControl('demo', { owner: apiA.container })).toBe(true);
    expect(getControlFactory('demo', apiA.container)).toBe(global);
  });

  it('builds each player its own control from its own factory', async () => {
    registerControl('demo', () => createTestControl('from-a'), { owner: apiA.container });
    registerControl('demo', () => createTestControl('from-b'), { owner: apiB.container });

    const pluginA = uiPlugin({ controls: ['demo'], responsive: false });
    const pluginB = uiPlugin({ controls: ['demo'], responsive: false });
    await pluginA.init(apiA);
    await pluginB.init(apiB);

    expect(apiA.container.querySelector('.sp-from-a')).not.toBeNull();
    expect(apiA.container.querySelector('.sp-from-b')).toBeNull();
    expect(apiB.container.querySelector('.sp-from-b')).not.toBeNull();
    expect(apiB.container.querySelector('.sp-from-a')).toBeNull();

    await pluginA.destroy();
    await pluginB.destroy();
  });
});

describe('multi-player isolation', () => {
  let apiA: IPluginAPI;
  let apiB: IPluginAPI;

  beforeEach(() => {
    resetControlRegistry();
    document.head.innerHTML = '';
    apiA = createMockApi();
    apiB = createMockApi();
  });

  afterEach(() => {
    resetControlRegistry();
    apiA.container.remove();
    apiB.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('leaves the surviving player styled and working after the other is destroyed', async () => {
    const pluginA = uiPlugin({ responsive: false });
    const pluginB = uiPlugin({ responsive: false });
    await pluginA.init(apiA);
    await pluginB.init(apiB);

    // One shared sheet, not one per player.
    expect(document.querySelectorAll('#sp-ui-styles')).toHaveLength(1);

    await pluginA.destroy();

    // B is still mounted, so the sheet must still be there.
    expect(document.getElementById('sp-ui-styles')).not.toBeNull();
    expect(apiB.container.querySelector('.sp-controls')).not.toBeNull();
    expect(apiB.container.querySelector('.sp-play')).not.toBeNull();

    // B's controls still respond.
    pluginB.hide();
    expect(
      apiB.container.querySelector('.sp-controls')?.classList.contains('sp-controls--hidden')
    ).toBe(true);
    pluginB.show();
    expect(
      apiB.container.querySelector('.sp-controls')?.classList.contains('sp-controls--visible')
    ).toBe(true);

    await pluginB.destroy();
    expect(document.getElementById('sp-ui-styles')).toBeNull();
  });

  it('does not rebuild one player for another player`s registration', async () => {
    const pluginA = uiPlugin({ controls: ['play', 'demo'], responsive: false });
    await pluginA.init(apiA);

    const before = apiA.container.querySelector('.sp-controls')?.children.length;

    registerControl('demo', () => createTestControl('b-only'), { owner: apiB.container });
    await flushRebuild();

    expect(apiA.container.querySelector('.sp-b-only')).toBeNull();
    expect(apiA.container.querySelector('.sp-controls')?.children.length).toBe(before);

    await pluginA.destroy();
  });
});
