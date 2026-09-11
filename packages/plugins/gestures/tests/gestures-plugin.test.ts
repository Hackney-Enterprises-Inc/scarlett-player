/**
 * Gestures plugin tests.
 *
 * Covers the state gating that decides whether a gesture is even allowed, and
 * the seek clamping, which is where a wrong answer is visible to a viewer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGesturesPlugin } from '../src/index';

type StateListener = (event: { key: string; value: unknown }) => void;

/**
 * Pretend the device has a coarse pointer, which is what enables 'auto'.
 *
 * Query-aware on purpose. `'auto'` is gated on `(any-pointer: coarse)` rather
 * than the primary-pointer `(pointer: coarse)`, and a mock that answered every
 * query the same way could not tell the two apart, so the hybrid case below
 * would pass whichever query the plugin asked. `primary` defaults to `any`, so
 * the cases that just mean "a phone" read unchanged.
 *
 * @param any - What `(any-pointer: coarse)` reports
 * @param primary - What `(pointer: coarse)` reports
 */
function stubCoarsePointer(any: boolean, primary: boolean = any): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn((query: string) => ({
      matches: query.includes('any-pointer') ? any : primary,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    configurable: true,
    writable: true,
  });
}

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  let currentTime = 100;
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
    configurable: true,
  });
  Object.defineProperty(video, 'duration', { value: 600, configurable: true, writable: true });
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    duration: 600,
    live: false,
    seekableRange: null,
    paused: false,
    controlsVisible: false,
    mediaType: 'video',
    chromecastActive: false,
    airplayActive: false,
    ...state,
  };

  const uiPlugin = { show: vi.fn(), hide: vi.fn() };
  const listeners: StateListener[] = [];

  return {
    pluginId: 'gestures',
    container,
    video,
    uiPlugin,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn(),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn((name: string) => (name === 'ui-controls' ? uiPlugin : null)),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((listener: StateListener) => {
      listeners.push(listener);
      return vi.fn();
    }),
    /** Write a state key and fire the subscription the plugin listens on. */
    setStateAndNotify(key: string, value: unknown) {
      store[key] = value;
      listeners.forEach((listener) => listener({ key, value }));
    },
    store,
  };
}

/** Dispatch a touch tap on the gesture surface. */
function tapSurface(surface: HTMLElement, fraction: number, at: number, pointerId = 1): void {
  const x = fraction * 1000;
  const base = { pointerType: 'touch', pointerId, clientX: x, clientY: 300, bubbles: true };

  const down = new MouseEvent('pointerdown', base) as unknown as PointerEvent;
  Object.defineProperties(down, {
    pointerType: { value: 'touch' },
    pointerId: { value: pointerId },
    timeStamp: { value: at },
  });

  const up = new MouseEvent('pointerup', base) as unknown as PointerEvent;
  Object.defineProperties(up, {
    pointerType: { value: 'touch' },
    pointerId: { value: pointerId },
    timeStamp: { value: at + 20 },
  });

  surface.dispatchEvent(down);
  surface.dispatchEvent(up);
}

/** The surface reports 1000px wide so fractions map to round numbers. */
function measureSurface(surface: HTMLElement): void {
  surface.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 600 }) as DOMRect;
}

describe('createGesturesPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    stubCoarsePointer(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs a gesture surface on a touch device', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
  });

  it('installs nothing when the device has no coarse pointer', () => {
    stubCoarsePointer(false);
    const api = createMockApi();
    createGesturesPlugin().init(api as never);

    expect(api.container.querySelector('.sp-gestures')).toBeNull();
  });

  it('arms on a hybrid laptop, where only the secondary pointer is coarse', () => {
    // `(pointer: coarse)` describes the PRIMARY pointer only, so gating on it
    // left a touchscreen laptop being driven by its trackpad with no gesture
    // surface at all for the finger that is also on the glass.
    stubCoarsePointer(true, false);
    const api = createMockApi();
    createGesturesPlugin().init(api as never);

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
  });

  it('leaves the mouse alone on the hybrid laptop it now arms on', () => {
    // Arming for the finger must cost the trackpad nothing: no listener may act
    // on a mouse pointer, and none may stop the event reaching the UI package's
    // own container listeners.
    stubCoarsePointer(true, false);
    const api = createMockApi({ controlsVisible: false });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    const reachedContainer: string[] = [];
    api.container.addEventListener('pointerdown', (e) => reachedContainer.push(e.type));

    const down = new MouseEvent('pointerdown', { clientX: 850, bubbles: true });
    Object.defineProperty(down, 'pointerType', { value: 'mouse' });
    const up = new MouseEvent('pointerup', { clientX: 850, bubbles: true });
    Object.defineProperty(up, 'pointerType', { value: 'mouse' });

    surface.dispatchEvent(down);
    surface.dispatchEvent(up);
    surface.dispatchEvent(down);
    surface.dispatchEvent(up);

    expect(api.video.currentTime).toBe(100);
    expect(api.uiPlugin.show).not.toHaveBeenCalled();
    expect(reachedContainer).toEqual(['pointerdown', 'pointerdown']);
  });

  it('can be forced on regardless of the pointer type', () => {
    stubCoarsePointer(false);
    const api = createMockApi();
    createGesturesPlugin({ enabled: true }).init(api as never);

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
  });

  it('stays out of the way for audio, which has no picture to tap', () => {
    const api = createMockApi({ mediaType: 'audio' });
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    expect(api.container.querySelector('.sp-gestures')).toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(false);
  });

  it('tears the surface down when the source turns out to be audio', () => {
    // mediaType is written when the source loads, so a plugin that sampled it
    // once during init() left the tap surface over an audio player.
    const api = createMockApi({ mediaType: 'video' });
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(true);

    api.setStateAndNotify('mediaType', 'audio');

    expect(api.container.querySelector('.sp-gestures')).toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(false);
  });

  it('waits for video rather than reading unknown as a picture', () => {
    // 'unknown' is "not established yet", not "video". An audio-only source
    // the classifier cannot prove (native HLS where the browser ships no track
    // lists) stays unknown for its whole life, and covering the audio UI with a
    // full-bleed tap surface is not a cost worth paying for an earlier install.
    const api = createMockApi({ mediaType: 'unknown' });
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    expect(api.container.querySelector('.sp-gestures')).toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(false);

    // Nothing is lost by waiting: this runs again on every mediaType change.
    api.setStateAndNotify('mediaType', 'video');

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(true);
  });

  it('rebuilds the surface when the source turns back into video', () => {
    const api = createMockApi({ mediaType: 'audio' });
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    expect(api.container.querySelector('.sp-gestures')).toBeNull();

    api.setStateAndNotify('mediaType', 'video');

    expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(true);
  });

  /**
   * The clips editor turns the whole picture into an editor - drag handles on
   * the timeline, a toolbar, a details dialog. A full-bleed double-tap-to-seek
   * layer over that is two features fighting for the same finger.
   */
  describe('clip sessions', () => {
    it('stands the surface down while a clip session is open', () => {
      const api = createMockApi({ mediaType: 'video' });
      const plugin = createGesturesPlugin();
      plugin.init(api as never);

      expect(api.container.querySelector('.sp-gestures')).not.toBeNull();

      api.setStateAndNotify('clipOpen', true);

      expect(api.container.querySelector('.sp-gestures')).toBeNull();
      expect(plugin.ownsTapInteraction()).toBe(false);
    });

    it('brings it back when the session closes', () => {
      const api = createMockApi({ mediaType: 'video' });
      const plugin = createGesturesPlugin();
      plugin.init(api as never);

      api.setStateAndNotify('clipOpen', true);
      api.setStateAndNotify('clipOpen', false);

      expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
      expect(plugin.ownsTapInteraction()).toBe(true);
    });

    it('stays down while the session is open even if the media type is restated', () => {
      const api = createMockApi({ mediaType: 'video' });
      const plugin = createGesturesPlugin();
      plugin.init(api as never);

      api.setStateAndNotify('clipOpen', true);
      api.setStateAndNotify('mediaType', 'video');

      expect(api.container.querySelector('.sp-gestures')).toBeNull();
    });

    it('installs the surface with no clips plugin in the player at all', () => {
      // The key is defined by @scarlett-player/clips; nothing ever writes it
      // here, and the plugin must not go looking for it.
      const api = createMockApi({ mediaType: 'video' });
      const plugin = createGesturesPlugin();
      plugin.init(api as never);

      expect(api.getState).not.toHaveBeenCalledWith('clipOpen');
      expect(api.container.querySelector('.sp-gestures')).not.toBeNull();
    });

    it('destroys cleanly while a clip session is open', () => {
      const api = createMockApi({ mediaType: 'video' });
      const plugin = createGesturesPlugin();
      plugin.init(api as never);

      api.setStateAndNotify('clipOpen', true);

      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  it('destroys cleanly after the surface was torn down for audio', () => {
    const api = createMockApi({ mediaType: 'video' });
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    api.setStateAndNotify('mediaType', 'audio');

    expect(() => plugin.destroy()).not.toThrow();
  });

  it('ignores state changes for other keys', () => {
    const api = createMockApi();
    const plugin = createGesturesPlugin();
    plugin.init(api as never);
    const surface = api.container.querySelector('.sp-gestures');

    api.setStateAndNotify('currentTime', 42);

    expect(api.container.querySelector('.sp-gestures')).toBe(surface);
  });

  it('seeks forward on a double tap to the right', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(110);
  });

  it('seeks back on a double tap to the left', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.15, 1000);
    tapSurface(surface, 0.15, 1150);

    expect(api.video.currentTime).toBe(90);
  });

  it('accumulates further taps, which is the whole point of the pattern', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);
    tapSurface(surface, 0.85, 1500);
    tapSurface(surface, 0.85, 1900);

    expect(api.video.currentTime).toBe(130);
  });

  it('reports the cumulative total, not the step', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);
    tapSurface(surface, 0.85, 1500);

    const seeks = api.emit.mock.calls.filter(([event]) => event === 'gesture:seek');
    expect(seeks[1][1]).toEqual({ direction: 'forward', seconds: 10, cumulative: 20 });
  });

  it('does nothing on a double tap in the inert middle', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.5, 1000);
    tapSurface(surface, 0.5, 1150);

    expect(api.video.currentTime).toBe(100);
  });

  it('ignores mouse input entirely, so desktop behaviour is unchanged', () => {
    const api = createMockApi();
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    const down = new MouseEvent('pointerdown', { clientX: 850, bubbles: true });
    Object.defineProperty(down, 'pointerType', { value: 'mouse' });
    const up = new MouseEvent('pointerup', { clientX: 850, bubbles: true });
    Object.defineProperty(up, 'pointerType', { value: 'mouse' });

    surface.dispatchEvent(down);
    surface.dispatchEvent(up);
    surface.dispatchEvent(down);
    surface.dispatchEvent(up);

    expect(api.video.currentTime).toBe(100);
  });

  it('clamps a backward seek at the start', () => {
    const api = createMockApi();
    api.video.currentTime = 4;
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.15, 1000);
    tapSurface(surface, 0.15, 1150);

    expect(api.video.currentTime).toBe(0);
  });

  it('clamps a forward seek just short of the end', () => {
    const api = createMockApi();
    api.video.currentTime = 599;
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(599.75);
  });

  it('clamps to the DVR window on live media', () => {
    const api = createMockApi({ live: true, seekableRange: { start: 50, end: 400 } });
    api.video.currentTime = 55;
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.15, 1000);
    tapSurface(surface, 0.15, 1150);

    expect(api.video.currentTime).toBe(50);
  });

  it('refuses a forward seek at the live edge and says so', () => {
    const api = createMockApi({ live: true, seekableRange: { start: 50, end: 400 } });
    api.video.currentTime = 400;
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(400);
    expect(surface.querySelector('[aria-live]')?.textContent).toBe('Already at the live edge');
  });

  it('does not seek on live with no DVR window', () => {
    const api = createMockApi({ live: true, seekableRange: null });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(100);
  });

  it('does not seek the local element while casting', () => {
    const api = createMockApi({ chromecastActive: true });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(100);
  });

  it('shows hidden controls immediately on a single tap', () => {
    const api = createMockApi({ controlsVisible: false });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.5, 1000);

    expect(api.uiPlugin.show).toHaveBeenCalled();
  });

  it('never hides the controls while paused', () => {
    vi.useFakeTimers();
    const api = createMockApi({ controlsVisible: true, paused: true });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.5, 1000);
    vi.advanceTimersByTime(1000);

    expect(api.uiPlugin.hide).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('defers hiding so a double tap is not preceded by a controls flash', () => {
    vi.useFakeTimers();
    const api = createMockApi({ controlsVisible: true, paused: false });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    expect(api.uiPlugin.hide).not.toHaveBeenCalled();

    tapSurface(surface, 0.85, 1150);
    vi.advanceTimersByTime(1000);

    expect(api.uiPlugin.hide).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('hides the controls once the double-tap window closes on a lone tap', () => {
    vi.useFakeTimers();
    const api = createMockApi({ controlsVisible: true, paused: false });
    createGesturesPlugin().init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.5, 1000);
    vi.advanceTimersByTime(300);

    expect(api.uiPlugin.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('claims tap ownership so the UI package stands down', () => {
    const api = createMockApi();
    const plugin = createGesturesPlugin();
    plugin.init(api as never);

    expect(plugin.ownsTapInteraction()).toBe(true);
  });

  it('does not claim tap ownership when tap toggling is off', () => {
    const api = createMockApi();
    const plugin = createGesturesPlugin({ tapToToggleControls: false });
    plugin.init(api as never);

    expect(plugin.ownsTapInteraction()).toBe(false);
  });

  it('removes its surface and styles on destroy', () => {
    const api = createMockApi();
    const plugin = createGesturesPlugin();
    plugin.init(api as never);
    plugin.destroy();

    expect(api.container.querySelector('.sp-gestures')).toBeNull();
    expect(document.getElementById('sp-gestures-styles')).toBeNull();
    expect(plugin.ownsTapInteraction()).toBe(false);
  });

  it('honours a custom seek step', () => {
    const api = createMockApi();
    createGesturesPlugin({ seekSeconds: 30 }).init(api as never);
    const surface = api.container.querySelector('.sp-gestures') as HTMLElement;
    measureSurface(surface);

    tapSurface(surface, 0.85, 1000);
    tapSurface(surface, 0.85, 1150);

    expect(api.video.currentTime).toBe(130);
  });
});
