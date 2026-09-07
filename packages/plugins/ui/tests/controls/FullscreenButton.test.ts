/**
 * FullscreenButton Control Tests
 *
 * The button goes through the core fullscreen helpers rather than owning its
 * own branches, so these assert the browser calls the helpers make: that is the
 * behaviour that used to differ between the button, the `f` shortcut and
 * `player.requestFullscreen()`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FullscreenButton } from '../../src/controls/FullscreenButton';
import type { MockPluginAPI } from '../mock-api';

function createMockApi(overrides: Record<string, unknown> = {}): MockPluginAPI {
  const state: Record<string, unknown> = { fullscreen: false, ...overrides };

  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    defineState: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockPluginAPI;
}

/** Let the button's async toggle settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('FullscreenButton', () => {
  let api: MockPluginAPI;
  let btn: FullscreenButton;

  const video = (): HTMLVideoElement =>
    api.container.querySelector('video') as HTMLVideoElement;

  beforeEach(() => {
    api = createMockApi();
    btn = new FullscreenButton(api);
  });

  afterEach(() => {
    btn.destroy();
    api.container.remove();
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
    vi.restoreAllMocks();
  });

  // --- Rendering ---
  it('renders a labelled button', () => {
    const el = btn.render();

    expect(el.tagName).toBe('BUTTON');
    expect(el.classList.contains('sp-fullscreen')).toBe(true);
    expect(el.getAttribute('aria-label')).toBe('Fullscreen');
  });

  it('follows the fullscreen state', () => {
    api = createMockApi({ fullscreen: true });
    const active = new FullscreenButton(api);

    active.update();

    expect(active.render().getAttribute('aria-label')).toBe('Exit fullscreen');
    expect(active.render().innerHTML).toContain('svg');

    active.destroy();
  });

  it('goes back to the enter icon when the state clears', () => {
    btn.update();

    expect(btn.render().getAttribute('aria-label')).toBe('Fullscreen');
  });

  // --- Toggling ---
  it('asks the container for fullscreen when it is not fullscreen', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    (api.container as any).requestFullscreen = request;

    btn.render().click();
    await flush();

    expect(request).toHaveBeenCalled();
  });

  it('exits when the browser says the player is fullscreen', async () => {
    // Read from the browser, not from state: a stale state key would invert
    // the button.
    Object.defineProperty(document, 'fullscreenElement', {
      value: api.container,
      configurable: true,
    });
    (document as any).exitFullscreen = vi.fn().mockResolvedValue(undefined);

    btn.render().click();
    await flush();

    expect((document as any).exitFullscreen).toHaveBeenCalled();
  });

  it('exits even when the fullscreen state key disagrees', async () => {
    api = createMockApi({ fullscreen: false });
    const stale = new FullscreenButton(api);
    Object.defineProperty(document, 'fullscreenElement', {
      value: api.container,
      configurable: true,
    });
    (document as any).exitFullscreen = vi.fn().mockResolvedValue(undefined);

    stale.render().click();
    await flush();

    expect((document as any).exitFullscreen).toHaveBeenCalled();

    stale.destroy();
  });

  it('falls back to the video element on an iPhone', async () => {
    // No Element.requestFullscreen there, so the container has nothing to ask
    // and only the video element's native player is available.
    (api.container as any).requestFullscreen = undefined;
    (api.container as any).webkitRequestFullscreen = undefined;
    (video() as any).webkitEnterFullscreen = vi.fn();

    btn.render().click();
    await flush();

    expect((video() as any).webkitEnterFullscreen).toHaveBeenCalled();
  });

  it('swallows a refused request', async () => {
    // Browsers refuse these routinely (no user gesture, permission policy); an
    // unhandled rejection would fail the run.
    const request = vi.fn().mockRejectedValue(new Error('Permission denied'));
    (api.container as any).requestFullscreen = request;

    btn.render().click();
    await flush();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('swallows a refused exit', async () => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: api.container,
      configurable: true,
    });
    (document as any).exitFullscreen = vi.fn().mockRejectedValue(new Error('denied'));

    btn.render().click();
    await flush();

    expect((document as any).exitFullscreen).toHaveBeenCalledTimes(1);
  });

  // --- Lifecycle ---
  it('stops responding after destroy', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    (api.container as any).requestFullscreen = request;
    const el = btn.render();

    btn.destroy();
    el.click();
    await flush();

    expect(request).not.toHaveBeenCalled();
    expect(el.parentNode).toBeNull();
  });
});
