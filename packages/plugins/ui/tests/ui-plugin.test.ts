/**
 * UI Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import { PKG_VERSION } from '../src/version';
import { registerControl, resetControlRegistry } from '../src/control-registry';

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
    playbackState: 'idle',
    error: null,
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
      expect(plugin.version).toBe(PKG_VERSION);
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
  // The big play button is the only play affordance on the picture itself: a
  // mouse click on the video surface only reveals the control bar, and touch
  // taps belong to the gestures plugin. Before it existed a poster had no
  // visible way to start playback except the small button in the bar.
  describe('big play button', () => {
    /** The plugin's state subscriber, captured so a change can be pushed in. */
    let notify: (() => void) | null;
    /** Frame callbacks the plugin has queued but not yet run. */
    let frames: Array<(t: number) => void>;

    const button = (): HTMLElement | null =>
      api.container.querySelector('.sp-big-play');

    const isVisible = (): boolean =>
      button()?.classList.contains('sp-big-play--visible') ?? false;

    /**
     * Run the queued frame.
     *
     * Deliberately not a synchronous requestAnimationFrame stub: the plugin
     * assigns the handle AFTER the call returns, so a stub that ran the
     * callback inline would leave the handle set forever and every later
     * update would be dropped as already scheduled.
     */
    const flushFrame = (): void => {
      const queued = frames;
      frames = [];
      queued.forEach((cb) => cb(0));
    };

    /** Push a state change through the plugin's own scheduleUpdate() pass. */
    const setState = (key: string, value: unknown): void => {
      api.setState(key as never, value as never);
      notify?.();
      flushFrame();
    };

    beforeEach(() => {
      notify = null;
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      (api.subscribeToState as any).mockImplementation((cb: () => void) => {
        notify = cb;
        return vi.fn();
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('renders the button by default', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(button()).not.toBeNull();
      expect(button()?.tagName).toBe('BUTTON');
      expect(button()?.getAttribute('aria-label')).toBe('Play');

      await plugin.destroy();
    });

    it('does not render the button when bigPlayButton is false', async () => {
      const plugin = uiPlugin({ bigPlayButton: false });
      await plugin.init(api);

      expect(button()).toBeNull();

      await plugin.destroy();
    });

    it('is visible before playback starts', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(isVisible()).toBe(true);

      await plugin.destroy();
    });

    it('hides once playback starts', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      setState('playing', true);

      expect(isVisible()).toBe(false);

      await plugin.destroy();
    });

    it('hides while an error is set', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      setState('error', { code: 'MEDIA_NETWORK_ERROR', message: 'gone' });

      expect(isVisible()).toBe(false);

      await plugin.destroy();
    });

    it('comes back as Replay when playback ends', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      setState('playing', true);
      // The control reads video.ended, not the `ended` state key: neither
      // provider clears that key on a replay, so it stays true for the rest
      // of the session (measured in Chrome, 2026-09-02).
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'ended', { value: true, configurable: true });
      setState('playing', false);
      setState('currentTime', 120);
      setState('ended', true);

      expect(isVisible()).toBe(true);
      expect(button()?.getAttribute('aria-label')).toBe('Replay');

      await plugin.destroy();
    });

    it('hides again once a replay is under way', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const video = api.container.querySelector('video') as HTMLVideoElement;
      setState('playing', true);
      Object.defineProperty(video, 'ended', { value: true, configurable: true });
      setState('playing', false);
      setState('ended', true);
      expect(isVisible()).toBe(true);

      // Replay: the element leaves the end, the state key does not.
      Object.defineProperty(video, 'ended', { value: false, configurable: true });
      setState('playing', true);

      expect(isVisible()).toBe(false);

      await plugin.destroy();
    });

    it('starts playback when clicked', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      const video = api.container.querySelector('video') as HTMLVideoElement;
      video.play = vi.fn(() => Promise.resolve());

      button()?.click();

      expect(video.play).toHaveBeenCalled();

      await plugin.destroy();
    });

    it('removes the button on destroy', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      await plugin.destroy();

      expect(button()).toBeNull();
    });
  });

  // The bar had no strategy for not fitting: every control is a fixed-width
  // flex item in a non-wrapping row, and both known hosts clip. On a 390px
  // phone with tsp-web's 17-slot layout the whole right-hand group rendered
  // past the clipping edge, so captions and playback speed were not broken,
  // they were unreachable.
  describe('responsive control bar', () => {
    /** Width the stubbed control bar reports. */
    let barWidth = 960;
    /** The plugin's state subscriber, captured so a change can be pushed in. */
    let notify: (() => void) | null;
    /** Frame callbacks the plugin has queued but not yet run. */
    let frames: Array<(t: number) => void>;
    /** The container callback the plugin handed to ResizeObserver. */
    let observed: ResizeObserverCallback | null;
    /** disconnect() spy on the stubbed observer. */
    let disconnect: ReturnType<typeof vi.fn>;

    const bar = (): HTMLElement =>
      api.container.querySelector('.sp-controls') as HTMLElement;
    const tray = (): HTMLElement | null =>
      api.container.querySelector('.sp-overflow-tray');
    const trayButton = (): HTMLElement | null =>
      api.container.querySelector('.sp-overflow');
    const inBar = (selector: string): boolean =>
      (api.container.querySelector(selector) as HTMLElement | null)?.parentElement ===
      bar();
    const inTray = (selector: string): boolean =>
      (api.container.querySelector(selector) as HTMLElement | null)?.parentElement ===
      tray();

    const flushFrame = (): void => {
      const queued = frames;
      frames = [];
      queued.forEach((cb) => cb(0));
    };

    /** Push a state change through the plugin's own scheduleUpdate() pass. */
    const setState = (key: string, value: unknown): void => {
      api.setState(key as never, value as never);
      notify?.();
      flushFrame();
    };

    beforeEach(() => {
      barWidth = 960;
      notify = null;
      frames = [];
      observed = null;
      disconnect = vi.fn();

      // jsdom has no layout engine. These stubs stand in for the widths
      // measured in Chrome on scarlettplayer.com/demo (2026-09-05): every
      // .sp-control is 44px, the time readout is 87px, and anything hidden is
      // zero.
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains('sp-controls') ? barWidth : 0;
        },
      });
      Element.prototype.getBoundingClientRect = function (this: HTMLElement) {
        const hidden =
          this.style?.display === 'none' ||
          this.classList.contains('sp-control--collapsed');
        const width = hidden ? 0 : this.classList.contains('sp-time') ? 87 : 44;

        return { width, height: 44, top: 0, left: 0, right: width, bottom: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      } as typeof Element.prototype.getBoundingClientRect;

      vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: ResizeObserverCallback) {
            observed = cb;
          }
          observe = vi.fn();
          unobserve = vi.fn();
          disconnect = disconnect;
        }
      );
      (api.subscribeToState as any).mockImplementation((cb: () => void) => {
        notify = cb;
        return vi.fn();
      });

      // AirPlay and PiP decide support in their constructors, and jsdom
      // supports neither, so without these two the bar would have nothing but
      // pinned controls and skips to move.
      (HTMLVideoElement.prototype as any).webkitShowPlaybackTargetPicker = () => {};
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete (HTMLElement.prototype as any).clientWidth;
      delete (Element.prototype as any).getBoundingClientRect;
      delete (HTMLVideoElement.prototype as any).webkitShowPlaybackTargetPicker;
      resetControlRegistry();
    });

    it('leaves a desktop bar exactly as it was', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      // 471px of visible controls against 936px of inner width.
      expect(inBar('.sp-play')).toBe(true);
      expect(inBar('.sp-skip--backward')).toBe(true);
      expect(inBar('.sp-volume')).toBe(true);
      expect(inBar('.sp-pip')).toBe(true);
      expect(tray()?.children.length).toBe(0);
      expect(trayButton()?.style.display).toBe('none');

      await plugin.destroy();
    });

    it('moves the low-priority controls into the tray on a 320px player', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);

      // The controls that keep the player usable stay put, and settings
      // staying put is what keeps speed and captions two taps away.
      expect(inBar('.sp-play')).toBe(true);
      expect(inBar('.sp-settings')).toBe(true);
      expect(inBar('.sp-fullscreen')).toBe(true);
      expect(inBar('.sp-time')).toBe(true);

      expect(inTray('.sp-skip--backward')).toBe(true);
      expect(inTray('.sp-skip--forward')).toBe(true);
      expect(inTray('.sp-volume')).toBe(true);
      expect(inTray('.sp-pip')).toBe(true);
      expect(inTray('.sp-cast--airplay')).toBe(true);

      expect(trayButton()?.style.display).toBe('');

      await plugin.destroy();
    });

    it('keeps the tray button immediately before fullscreen', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);

      expect(trayButton()?.nextSibling).toBe(api.container.querySelector('.sp-fullscreen'));

      await plugin.destroy();
    });

    it('does not relocate a control that hid itself', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);

      // Chromecast is unsupported in jsdom, so it renders display: none. It
      // occupies nothing, so moving it would only make its own next update()
      // fight the fit.
      expect(inBar('.sp-cast--chromecast')).toBe(true);

      await plugin.destroy();
    });

    it('refits when a control appears after load', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);
      expect(inBar('.sp-captions')).toBe(true);

      // Text tracks arrive with the manifest, long after the first fit, and
      // the captions button shows itself. The bar was already full.
      setState('textTracks', [
        { id: 'en', label: 'English', language: 'en', kind: 'subtitles', active: false },
      ]);

      expect(inTray('.sp-captions')).toBe(true);

      await plugin.destroy();
    });

    it('gives controls back when the player is widened', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);
      expect(inTray('.sp-volume')).toBe(true);

      barWidth = 960;
      observed?.([{ contentRect: { height: 540 } }] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      flushFrame();

      expect(inBar('.sp-volume')).toBe(true);
      expect(inBar('.sp-pip')).toBe(true);
      expect(trayButton()?.style.display).toBe('none');

      await plugin.destroy();
    });

    it('restores a returning control to its layout position', async () => {
      barWidth = 320;
      const plugin = uiPlugin();
      await plugin.init(api);

      barWidth = 960;
      observed?.([{ contentRect: { height: 540 } }] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      flushFrame();

      const rendered = Array.from(bar().children)
        .map((child) => (child as HTMLElement).className)
        .filter((name) => !name.includes('sp-overflow'));

      expect(rendered[0]).toContain('sp-play');
      expect(rendered[1]).toContain('sp-skip--backward');
      expect(rendered[2]).toContain('sp-skip--forward');
      expect(rendered[3]).toContain('sp-volume');
      expect(rendered[4]).toContain('sp-time');

      await plugin.destroy();
    });

    it('bounds the menus to the player height from the same observer', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      // A 375x211 portrait phone player: the settings Speed panel is 253px, so
      // without this it loses its Back header and the first three speeds.
      observed?.([{ contentRect: { height: 211 } }] as unknown as ResizeObserverEntry[], {} as ResizeObserver);

      expect(api.container.style.getPropertyValue('--sp-menu-max-height')).toBe('139px');

      await plugin.destroy();
    });

    it('keeps a floor under the bounded menu height', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);

      observed?.([{ contentRect: { height: 100 } }] as unknown as ResizeObserverEntry[], {} as ResizeObserver);

      expect(api.container.style.getPropertyValue('--sp-menu-max-height')).toBe('120px');

      await plugin.destroy();
    });

    it('disconnects the observer and clears the menu bound on destroy', async () => {
      const plugin = uiPlugin();
      await plugin.init(api);
      observed?.([{ contentRect: { height: 211 } }] as unknown as ResizeObserverEntry[], {} as ResizeObserver);

      await plugin.destroy();

      expect(disconnect).toHaveBeenCalled();
      // The container is the host's, and may be reused for a second player.
      expect(api.container.style.getPropertyValue('--sp-menu-max-height')).toBe('');
    });

    it('fits again after a control registers late and the bar is rebuilt', async () => {
      barWidth = 280;
      const plugin = uiPlugin({
        controls: ['play', 'time', 'spacer', 'example', 'settings', 'fullscreen'],
      });
      await plugin.init(api);

      registerControl('example', () => {
        const el = document.createElement('button');
        el.className = 'sp-control sp-example';

        return { render: () => el, update: () => {}, destroy: () => el.remove() };
      });

      // Rebuilt from scratch, so the tray is a new instance and every cached
      // width describes an element that no longer exists.
      expect(api.container.querySelector('.sp-example')).not.toBeNull();
      expect(inBar('.sp-play')).toBe(true);
      expect(inBar('.sp-settings')).toBe(true);
      expect(inBar('.sp-fullscreen')).toBe(true);
      expect(inTray('.sp-example')).toBe(true);
      expect(api.container.querySelectorAll('.sp-overflow').length).toBe(1);

      await plugin.destroy();
    });

    it('creates no tray and no observer when responsive is off', async () => {
      barWidth = 320;
      const plugin = uiPlugin({ responsive: false });
      await plugin.init(api);

      expect(trayButton()).toBeNull();
      expect(observed).toBeNull();
      expect(inBar('.sp-volume')).toBe(true);
      expect(inBar('.sp-pip')).toBe(true);

      await plugin.destroy();
    });

    it('pins a control the host asked to keep', async () => {
      barWidth = 320;
      const plugin = uiPlugin({ priority: { volume: 'never' } });
      await plugin.init(api);

      expect(inBar('.sp-volume')).toBe(true);
      expect(inTray('.sp-pip')).toBe(true);

      await plugin.destroy();
    });

    it('hides the time readout rather than putting it in the tray', async () => {
      // Only pinned controls and the time readout, so the arithmetic has to
      // reach for the one item whose exit is "hide".
      barWidth = 160;
      const plugin = uiPlugin({
        controls: ['play', 'time', 'spacer', 'settings', 'fullscreen'],
      });
      await plugin.init(api);

      const time = api.container.querySelector('.sp-time') as HTMLElement;
      expect(time.classList.contains('sp-control--collapsed')).toBe(true);
      expect(inBar('.sp-time')).toBe(true);

      await plugin.destroy();
    });
  });
});
