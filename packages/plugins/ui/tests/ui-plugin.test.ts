/**
 * UI Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

/**
 * Create a mock plugin API
 */
function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
    currentTime: 0,
    duration: 100,
    volume: 1,
    muted: false,
    live: false,
    liveEdge: false,
    fullscreen: false,
    pip: false,
    controlsVisible: true,
    qualities: [],
    currentQuality: null,
    chromecastAvailable: false,
    chromecastActive: false,
    airplayAvailable: false,
    airplayActive: false,
    buffered: null,
    seekableRange: null,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  return {
    pluginId: 'ui-controls',
    container,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
  };
}

describe('UI Plugin', () => {
  let api: IPluginAPI;

  beforeEach(() => {
    api = createMockApi();
  });

  afterEach(() => {
    api.container.remove();
    // Remove any injected style tags
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  describe('initialization', () => {
    it('should create plugin with correct metadata', () => {
      const plugin = uiPlugin();
      expect(plugin.id).toBe('ui-controls');
      expect(plugin.name).toBe('UI Controls');
      expect(plugin.type).toBe('ui');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should inject styles on init', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const styles = document.querySelectorAll('style');
      expect(styles.length).toBeGreaterThan(0);

      await plugin.destroy();
    });

    it('should create control bar on init', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar).not.toBeNull();

      await plugin.destroy();
    });

    it('should create gradient overlay', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const gradient = api.container.querySelector('.sp-gradient');
      expect(gradient).not.toBeNull();

      await plugin.destroy();
    });

    it('should set container to relative positioning if static', async () => {
      api.container.style.position = 'static';
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(api.container.style.position).toBe('relative');

      await plugin.destroy();
    });
  });

  describe('control rendering', () => {
    it('should render default controls', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar?.querySelector('.sp-play')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-progress')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-time')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-fullscreen')).not.toBeNull();

      await plugin.destroy();
    });

    it('should render custom control layout', async () => {
      const plugin = uiPlugin({
        controls: ['play', 'spacer', 'fullscreen'],
      });
      await plugin.init(api);

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar?.querySelector('.sp-play')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-spacer')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-fullscreen')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-progress')).toBeNull();

      await plugin.destroy();
    });
  });

  describe('show/hide controls', () => {
    it('should hide controls', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      plugin.hide();

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar?.classList.contains('sp-controls--hidden')).toBe(true);

      await plugin.destroy();
    });

    it('should show controls', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      plugin.hide();
      plugin.show();

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar?.classList.contains('sp-controls--hidden')).toBe(false);

      await plugin.destroy();
    });
  });

  describe('theming', () => {
    it('should apply theme on init', async () => {
      const plugin = uiPlugin({
        theme: {
          primaryColor: '#fff',
          accentColor: '#ff0000',
        },
      });
      await plugin.init(api);

      expect(api.container.style.getPropertyValue('--sp-color')).toBe('#fff');
      expect(api.container.style.getPropertyValue('--sp-accent')).toBe('#ff0000');

      await plugin.destroy();
    });

    it('should apply theme with setTheme()', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      plugin.setTheme({
        accentColor: '#00ff00',
        controlBarHeight: 60,
        iconSize: 32,
      });

      expect(api.container.style.getPropertyValue('--sp-accent')).toBe('#00ff00');
      expect(api.container.style.getPropertyValue('--sp-control-height')).toBe('60px');
      expect(api.container.style.getPropertyValue('--sp-icon-size')).toBe('32px');

      await plugin.destroy();
    });
  });

  describe('getControlBar()', () => {
    it('should return control bar element', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const controlBar = plugin.getControlBar();
      expect(controlBar).not.toBeNull();
      expect(controlBar?.classList.contains('sp-controls')).toBe(true);

      await plugin.destroy();
    });

    it('should return null before init', () => {
      const plugin = uiPlugin();
      expect(plugin.getControlBar()).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should remove control bar on destroy', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      await plugin.destroy();

      expect(api.container.querySelector('.sp-controls')).toBeNull();
    });

    it('should remove styles on destroy', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const styleCountBefore = document.querySelectorAll('style').length;

      await plugin.destroy();

      const styleCountAfter = document.querySelectorAll('style').length;
      expect(styleCountAfter).toBeLessThan(styleCountBefore);
    });

    it('should return null from getControlBar after destroy', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);
      await plugin.destroy();

      expect(plugin.getControlBar()).toBeNull();
    });
  });

  describe('state subscription', () => {
    it('should subscribe to state changes', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(api.on).toHaveBeenCalledWith('state:change', expect.any(Function));

      await plugin.destroy();
    });
  });

  describe('interaction handling', () => {
    it('should add tabindex to container', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(api.container.getAttribute('tabindex')).toBe('0');

      await plugin.destroy();
    });
  });
});
