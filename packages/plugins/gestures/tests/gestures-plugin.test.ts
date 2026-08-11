/**
 * Gestures plugin tests.
 *
 * Covers the state gating that decides whether a gesture is even allowed, and
 * the seek clamping, which is where a wrong answer is visible to a viewer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGesturesPlugin } from '../src/index';

/** Pretend the device has a coarse pointer, which is what enables 'auto'. */
function stubCoarsePointer(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => ({ matches, media: '', addListener: vi.fn(), removeListener: vi.fn() })),
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
    subscribeToState: vi.fn(() => vi.fn()),
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
