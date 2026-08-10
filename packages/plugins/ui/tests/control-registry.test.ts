/**
 * Custom control registry tests.
 *
 * Covers the contract plugin packages rely on: register a factory under an id,
 * have it render when a layout asks for it, and have that work whether the
 * registration happens before or after the UI plugin initialises.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin, registerControl, unregisterControl, getControlFactory, resetControlRegistry } from '../src/index';
import type { Control } from '../src/types';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
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
  } as unknown as IPluginAPI;
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

describe('control registry', () => {
  let api: IPluginAPI;

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
      const plugin = uiPlugin({ controls: ['play', 'ghost'] });
      await plugin.init(api);

      expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining('ghost'));
      expect(api.container.querySelector('.sp-ghost')).toBeNull();
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

      expect(api.container.querySelector('.sp-demo')).not.toBeNull();
    });

    it('keeps the configured order after a rebuild', async () => {
      const plugin = uiPlugin({ controls: ['demo', 'play'] });
      await plugin.init(api);

      registerControl('demo', () => createTestControl('demo'));

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

      expect(api.container.querySelector('.sp-unused')).toBeNull();
      expect(bar?.children.length).toBe(before);
    });

    it('destroys the previous controls when rebuilding', async () => {
      const firstControl = createTestControl('play-stub');
      registerControl('demo', () => createTestControl('demo'));

      const plugin = uiPlugin({ controls: ['demo'] });
      await plugin.init(api);

      const initial = api.container.querySelectorAll('.sp-demo').length;
      expect(initial).toBe(1);

      // Re-registering replaces the factory and rebuilds; the old instance must
      // be destroyed rather than left orphaned in the DOM.
      registerControl('demo', () => createTestControl('demo'));

      expect(api.container.querySelectorAll('.sp-demo').length).toBe(1);
      expect(firstControl).toBeDefined();
    });

    it('stops rebuilding once the plugin is destroyed', async () => {
      const plugin = uiPlugin({ controls: ['play', 'demo'] });
      await plugin.init(api);
      await plugin.destroy();

      expect(() => registerControl('demo', () => createTestControl('demo'))).not.toThrow();
      expect(document.querySelector('.sp-demo')).toBeNull();
    });
  });
});
