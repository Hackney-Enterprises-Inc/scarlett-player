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
    defineState: vi.fn((key: string, value: unknown) => {
      if (!(key in state)) {
        state[key] = value;
      }
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
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

  describe('reconnect presentation', () => {
    /**
     * Capture the plugin's event handlers so a reconnect cycle can be driven
     * end to end (the default mock `on` throws the handler away).
     */
    const captureHandlers = (): Record<string, (payload?: unknown) => void> => {
      const handlers: Record<string, (payload?: unknown) => void> = {};
      (api.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, handler: (payload?: unknown) => void) => {
          handlers[event] = handler;
          return vi.fn();
        }
      );
      return handlers;
    };

    const overlay = () =>
      api.container.querySelector('.sp-error-overlay') as HTMLElement;

    it('shows the reconnecting state while the provider retries', async () => {
      const handlers = captureHandlers();
      const plugin = uiPlugin();
      await plugin.init(api);

      handlers['error:reconnecting']?.({ attempt: 1, delayMs: 2000, elapsedMs: 0, windowMs: 300000 });

      expect(overlay().classList.contains('sp-error-overlay--reconnecting')).toBe(true);

      await plugin.destroy();
    });

    it('drops the reconnecting state on the terminal error after exhaustion', async () => {
      const handlers = captureHandlers();
      const plugin = uiPlugin();
      await plugin.init(api);

      handlers['error:reconnecting']?.({ attempt: 1, delayMs: 2000, elapsedMs: 0, windowMs: 8000 });
      expect(overlay().classList.contains('sp-error-overlay--reconnecting')).toBe(true);

      // Exhaustion is announced, then the provider emits its final fatal
      // error: without that second event the viewer would be stranded on a
      // permanent spinner with no Retry
      handlers['error:reconnect-exhausted']?.({ attempts: 3, elapsedMs: 9000, windowMs: 8000 });
      handlers['error']?.({
        code: 'MEDIA_NETWORK_ERROR',
        message: 'HLS auto-reconnect gave up after 3 attempts over 9s',
        fatal: true,
        detail: { reconnectExhausted: true },
      });

      expect(overlay().classList.contains('sp-error-overlay--reconnecting')).toBe(false);
      expect(overlay().classList.contains('sp-error-overlay--visible')).toBe(true);
      expect(
        (overlay().querySelector('.sp-error-overlay__retry') as HTMLButtonElement)?.disabled
      ).toBe(false);

      await plugin.destroy();
    });

    it('hides the overlay when the reconnect recovers instead', async () => {
      const handlers = captureHandlers();
      const plugin = uiPlugin();
      await plugin.init(api);

      handlers['error:reconnecting']?.({ attempt: 1, delayMs: 2000, elapsedMs: 0, windowMs: 300000 });
      handlers['error:recovered']?.({ attempt: 1, elapsedMs: 2150 });

      expect(overlay().classList.contains('sp-error-overlay--visible')).toBe(false);

      await plugin.destroy();
    });
  });

  describe('control rendering', () => {
    it('should render default controls', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const controlBar = api.container.querySelector('.sp-controls');
      expect(controlBar?.querySelector('.sp-play')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-time')).not.toBeNull();
      expect(controlBar?.querySelector('.sp-fullscreen')).not.toBeNull();
      // Progress bar is now rendered above the control bar, not inside it
      expect(api.container.querySelector('.sp-progress-wrapper')).not.toBeNull();

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

      expect(api.subscribeToState).toHaveBeenCalledWith(expect.any(Function));

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

  describe('gesture plugin coordination', () => {
    /** Dispatch a pointer event carrying a pointerType, which jsdom does not model. */
    function pointer(type: string, pointerType: string): Event {
      const event = new MouseEvent(type, { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: pointerType });

      return event;
    }

    /** Report a gestures plugin that claims ownership of taps. */
    function withGestures(): void {
      (api.getPlugin as ReturnType<typeof vi.fn>).mockImplementation((name: string) =>
        name === 'gestures' ? { ownsTapInteraction: () => true } : null
      );
    }

    it('stands down on a touch tap when a gestures plugin owns it', async () => {
      withGestures();
      const plugin = uiPlugin();
      await plugin.init(api);
      plugin.hide();

      api.container.dispatchEvent(pointer('pointerdown', 'touch'));
      api.container.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(api.container.querySelector('.sp-controls--visible')).toBeNull();

      await plugin.destroy();
    });

    it('still shows controls on a mouse hover after an earlier touch tap', async () => {
      withGestures();
      const plugin = uiPlugin();
      await plugin.init(api);
      plugin.hide();

      // The hybrid-device case: a finger tap, then the viewer reaches for the
      // mouse. Tracking only presses left the type stuck at 'touch' and the
      // controls never came back.
      api.container.dispatchEvent(pointer('pointerdown', 'touch'));
      api.container.dispatchEvent(pointer('pointermove', 'mouse'));
      api.container.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(api.container.querySelector('.sp-controls--visible')).not.toBeNull();

      await plugin.destroy();
    });

    it('shows controls on touch when no gestures plugin is installed', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);
      plugin.hide();

      api.container.dispatchEvent(pointer('pointerdown', 'touch'));
      api.container.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(api.container.querySelector('.sp-controls--visible')).not.toBeNull();

      await plugin.destroy();
    });

    it('stops tracking pointer activity after destroy', async () => {
      withGestures();
      const plugin = uiPlugin();
      await plugin.init(api);
      const container = api.container;

      await plugin.destroy();

      expect(() => container.dispatchEvent(pointer('pointermove', 'mouse'))).not.toThrow();
    });
  });
});
