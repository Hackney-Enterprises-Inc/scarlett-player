/**
 * Keyboard help dialog and the `keyboard-help` control slot (SCAR-DX-3).
 *
 * `?` must open a container-scoped modal that lists the shortcuts the player
 * actually implements, own Escape/Tab while it is open, restore the invoking
 * focus when it closes, and never fight another player or another modal.
 * The optional `keyboard-help` bar control must be a second entry point into
 * the same dialog without changing the default layout.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiPlugin } from '../src/index';
import { KeyboardHelpDialog } from '../src/controls/KeyboardHelpDialog';
import { SHORTCUTS } from '../src/shortcuts';
import { resolveFitItems } from '../src/fit';
import type { MockPluginAPI } from './mock-api';

/**
 * A mounted player harness: state map, container, video and a trace of
 * element writes / bus events, shared by the dialog and the wiring suites.
 */
interface Harness {
  api: MockPluginAPI;
  container: HTMLElement;
  video: HTMLVideoElement;
  state: Record<string, unknown>;
  trace: Array<[string, number | string | null]>;
}

/** See the keyboard-shortcuts suite for the shape of every field. */
function createHarness(stateOverrides: Record<string, unknown> = {}, withVideo = true): Harness {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
    currentTime: 30,
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
    textTracks: [],
    currentTextTrack: null,
    chromecastAvailable: false,
    chromecastActive: false,
    airplayAvailable: false,
    airplayActive: false,
    playbackState: 'ready',
    playbackRate: 1,
    error: null,
    buffered: null,
    seekableRange: null,
    ...stateOverrides,
  };

  const trace: Array<[string, number | string | null]> = [];
  const container = document.createElement('div');
  let video: HTMLVideoElement;
  if (withVideo) {
    video = document.createElement('video');
    let time = 30;
    Object.defineProperty(video, 'currentTime', {
      get: () => time,
      set: (value: number) => {
        time = value;
        trace.push(['write', value]);
      },
    });
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    video.play = vi.fn(() => Promise.resolve());
    video.pause = vi.fn();
    container.appendChild(video);
  } else {
    video = document.createElement('video');
  }
  // The plugin makes the real container a tab stop; the dialog suites that
  // run without the plugin need the same thing for focus to land on it.
  container.tabIndex = 0;
  document.body.appendChild(container);

  const api: MockPluginAPI = {
    pluginId: 'ui-controls',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown) => {
      if (event === 'playback:seeking') {
        trace.push(['emit', (payload as { time: number }).time]);
      }
      if (event === 'track:text') {
        trace.push(['track', (payload as { trackId: string | null }).trackId]);
      }
    }),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
  };

  return { api, container, video, state, trace };
}

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.innerHTML = '';
  document.querySelectorAll('style').forEach((style) => style.remove());
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  delete (Element.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Dispatch a document keydown and report the event for default assertions. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);

  return event;
}

/** Mount the UI plugin on a harness and focus the player itself. */
async function mountPlugin(h: Harness, config: Parameters<typeof uiPlugin>[0] = {}) {
  const plugin = uiPlugin(config);
  cleanups.push(() => plugin.destroy());
  await plugin.init(h.api);
  h.container.focus();

  return plugin;
}

const dialogEl = (h: Harness): HTMLElement | null =>
  h.container.querySelector('.sp-kbd-help');
const closeButton = (h: Harness): HTMLButtonElement | null =>
  h.container.querySelector<HTMLButtonElement>('.sp-kbd-help__close');

describe('shortcut list (single source of truth)', () => {
  it('lists exactly the shortcuts the player implements', () => {
    expect(SHORTCUTS.map((entry) => entry.keys)).toEqual([
      'Space / K',
      'Left / Right arrow',
      'Up / Down arrow',
      'M',
      'F',
      'C',
      '0-9',
      '?',
      'Home / End',
    ]);
  });

  it('advertises no shortcut that is not implemented', () => {
    // The old Sprint 3 plan wanted J/L/P seeking; none of it exists.
    for (const entry of SHORTCUTS) {
      expect(entry.keys).not.toMatch(/(^|[^A-Za-z])(J|L|P)([^A-Za-z]|$)/);
    }
  });

  it('documents the digits live behaviour', () => {
    const digits = SHORTCUTS.find((entry) => entry.keys === '0-9');
    expect(digits?.note).toMatch(/DVR/);
    expect(digits?.note).toMatch(/without DVR/);
  });

  it('marks captions and Home/End as conditional', () => {
    expect(SHORTCUTS.find((entry) => entry.keys === 'C')?.note).toMatch(/track/i);
    expect(SHORTCUTS.find((entry) => entry.keys === 'Home / End')?.note).toMatch(/progress/i);
  });
});

describe('KeyboardHelpDialog', () => {
  it('opens inside the player container as a labelled modal', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());

    expect(dialog.open()).toBe(true);

    const el = dialogEl(h);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('dialog');
    expect(el?.getAttribute('aria-modal')).toBe('true');
    expect(el?.getAttribute('aria-label')).toBe('Keyboard shortcuts');
    expect(closeButton(h)?.getAttribute('aria-label')).toBe('Close keyboard shortcuts');
    // The dialog keeps focus inside itself from the moment it opens.
    expect(document.activeElement).toBe(closeButton(h));
  });

  it('ignores a repeated open', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    dialog.open();

    expect(dialog.open()).toBe(true);
    expect(h.container.querySelectorAll('.sp-kbd-help')).toHaveLength(1);
  });

  it('refuses to steal focus from another modal', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());

    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'dialog');
    const child = document.createElement('button');
    foreign.appendChild(child);
    h.container.appendChild(foreign);
    child.focus();

    expect(dialog.open()).toBe(false);
    expect(dialogEl(h)).toBeNull();
    expect(document.activeElement).toBe(child);
  });

  it('closes on its close button and returns focus to the invoker', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    const invoker = document.createElement('button');
    h.container.appendChild(invoker);
    invoker.focus();
    dialog.open(invoker);

    closeButton(h)?.click();

    expect(dialog.isOpen()).toBe(false);
    expect(dialogEl(h)).toBeNull();
    expect(document.activeElement).toBe(invoker);
  });

  it('closes on Escape and returns focus to the invoking element', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    const invoker = document.createElement('button');
    h.container.appendChild(invoker);
    invoker.focus();
    dialog.open(invoker);

    const event = press('Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.isOpen()).toBe(false);
    expect(document.activeElement).toBe(invoker);
  });

  it('falls back to the player container when the invoker is gone', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    const invoker = document.createElement('button');
    h.container.appendChild(invoker);
    invoker.focus();
    dialog.open(invoker);
    invoker.remove();

    dialog.close();

    expect(document.activeElement).toBe(h.container);
  });

  it('owns Tab while it is open', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    dialog.open();

    const tab = press('Tab');
    const shiftTab = press('Tab', { shiftKey: true });

    expect(tab.defaultPrevented).toBe(true);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(dialog.isOpen()).toBe(true);
    expect(document.activeElement).toBe(closeButton(h));
  });

  it('leaves another player dialog alone when it handles a key', () => {
    const a = createHarness();
    const b = createHarness();
    const dialogA = new KeyboardHelpDialog(a.api);
    const dialogB = new KeyboardHelpDialog(b.api);
    cleanups.push(() => dialogA.destroy(), () => dialogB.destroy());
    dialogA.open();
    b.container.focus();
    dialogB.open();

    // Focus is inside player B, so only B's dialog answers.
    press('Escape');

    expect(dialogB.isOpen()).toBe(false);
    expect(dialogA.isOpen()).toBe(true);
  });

  it('destroy removes the dialog without pulling focus back to the player', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    const invoker = document.createElement('button');
    h.container.appendChild(invoker);
    const focusSpy = vi.spyOn(invoker, 'focus');
    const containerFocus = vi.spyOn(h.container, 'focus');
    dialog.open(invoker);

    expect(() => dialog.destroy()).not.toThrow();
    expect(dialogEl(h)).toBeNull();
    expect(dialog.isOpen()).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(containerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(h.container);
  });

  it('falls back to the container when the invoker cannot take focus', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    const invoker = document.createElement('button');
    h.container.appendChild(invoker);
    invoker.focus = vi.fn();
    dialog.open(invoker);

    dialog.close();

    expect(invoker.focus).toHaveBeenCalled();
    expect(document.activeElement).toBe(h.container);
  });

  it('ignores an invoker outside the player container', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const outsideFocus = vi.spyOn(outside, 'focus');
    dialog.open(outside);

    dialog.close();

    expect(outsideFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(h.container);
  });

  it('keeps Tab inside the dialog after focus moved to the container', () => {
    const h = createHarness();
    const dialog = new KeyboardHelpDialog(h.api);
    cleanups.push(() => dialog.destroy());
    dialog.open();

    h.container.focus();
    const tab = press('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton(h));

    h.container.focus();
    const shiftTab = press('Tab', { shiftKey: true });
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton(h));
  });
});

describe('keyboard help wiring (? and the control)', () => {
  it('opens the dialog on ? for the focused player', async () => {
    const h = createHarness();
    await mountPlugin(h);

    const event = press('?');

    expect(event.defaultPrevented).toBe(true);
    expect(dialogEl(h)).not.toBeNull();
  });

  it('opens before a media element exists', async () => {
    const h = createHarness({}, false);
    await mountPlugin(h);

    press('?');

    expect(dialogEl(h)).not.toBeNull();
  });

  it('does not toggle the dialog on a repeated ?', async () => {
    const h = createHarness();
    await mountPlugin(h);
    press('?');

    press('?');

    expect(h.container.querySelectorAll('.sp-kbd-help')).toHaveLength(1);
  });

  it('restores focus to the player when closed', async () => {
    const h = createHarness();
    await mountPlugin(h);
    press('?');

    press('Escape');

    expect(dialogEl(h)).toBeNull();
    expect(document.activeElement).toBe(h.container);
  });

  it('does not steal focus from another modal', async () => {
    const h = createHarness();
    await mountPlugin(h);
    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'dialog');
    const child = document.createElement('button');
    foreign.appendChild(child);
    h.container.appendChild(foreign);
    child.focus();

    const event = press('?');

    expect(event.defaultPrevented).toBe(false);
    expect(dialogEl(h)).toBeNull();
    expect(document.activeElement).toBe(child);
  });

  it('returns focus to the player when the invoking control is hidden', async () => {
    const h = createHarness();
    await mountPlugin(h);
    const gear = h.container.querySelector<HTMLButtonElement>('.sp-settings__btn');
    gear?.focus();
    // A control inside a closed tray or menu is visibility: hidden in a
    // browser, so focus() on it silently does nothing.
    if (gear) gear.focus = vi.fn();
    press('?');

    press('Escape');

    expect(document.activeElement).toBe(h.container);
  });

  it('closes an open settings menu when opening', async () => {
    const h = createHarness();
    await mountPlugin(h);
    const gear = h.container.querySelector<HTMLButtonElement>('.sp-settings__btn');
    gear?.click();
    expect(gear?.getAttribute('aria-expanded')).toBe('true');

    press('?');

    expect(gear?.getAttribute('aria-expanded')).toBe('false');
    expect(dialogEl(h)).not.toBeNull();
  });

  it('suppresses media shortcuts while it is open', async () => {
    const h = createHarness({
      textTracks: [{ id: 'en', label: 'English', language: 'en', kind: 'subtitles' }],
    });
    await mountPlugin(h);
    const requestFullscreen = vi.fn();
    (h.container as unknown as { requestFullscreen: unknown }).requestFullscreen =
      requestFullscreen;
    press('?');
    expect(document.activeElement).toBe(closeButton(h));
    h.trace.length = 0;

    press('m');
    press('f');
    press('k');
    press('c');
    press('3');

    expect(h.video.muted).toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(h.video.play).not.toHaveBeenCalled();
    expect(h.trace).toEqual([]);
  });

  it('removes the dialog on destroy', async () => {
    const h = createHarness();
    const plugin = await mountPlugin(h);
    press('?');
    expect(dialogEl(h)).not.toBeNull();

    await plugin.destroy();

    expect(dialogEl(h)).toBeNull();
  });
});

describe('the keyboard-help control slot', () => {
  it('does not change the default layout', async () => {
    const h = createHarness();
    await mountPlugin(h);

    expect(h.container.querySelector('.sp-kbd-help-btn')).toBeNull();
  });

  it('renders no button when keyboard shortcuts are off', async () => {
    const h = createHarness();
    await mountPlugin(h, {
      keyboard: false,
      controls: ['play', 'keyboard-help', 'spacer', 'fullscreen'],
    });

    expect(h.container.querySelector('.sp-kbd-help-btn')).toBeNull();
    expect(h.container.querySelector('[aria-label="Play"]')).not.toBeNull();
  });

  it('renders in a custom layout and opens the dialog on click', async () => {
    const h = createHarness();
    await mountPlugin(h, { controls: ['play', 'keyboard-help', 'spacer', 'fullscreen'] });

    const button = h.container.querySelector<HTMLButtonElement>('.sp-kbd-help-btn');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Keyboard shortcuts');

    button?.click();

    expect(dialogEl(h)).not.toBeNull();
    expect(document.activeElement).toBe(closeButton(h));
  });

  it('fits like a registered control and relocates to the tray when the bar is short', async () => {
    // jsdom has no layout engine: the bar reports its configured width and
    // every control reports the 44px a bar button measures in a browser
    // (see the responsive-control-bar suite for the measured numbers). The
    // plugin coalesces renders onto requestAnimationFrame, so that is
    // stubbed and flushed the same way.
    let barWidth = 960;
    const frames: Array<(t: number) => void> = [];
    /** Holder for the container callback the plugin hands to ResizeObserver. */
    const observer: { callback: ResizeObserverCallback | null } = { callback: null };
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('sp-controls') ? barWidth : 0;
      },
    });
    Element.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const width = this.style?.display === 'none' ? 0 : 44;

      return {
        width,
        height: 44,
        top: 0,
        left: 0,
        right: width,
        bottom: 44,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
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
          observer.callback = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    const flushFrame = (): void => {
      const queued = frames.splice(0);
      queued.forEach((cb) => cb(0));
    };

    const h = createHarness();
    await mountPlugin(h, { controls: ['play', 'keyboard-help', 'spacer', 'fullscreen'] });
    const bar = h.container.querySelector('.sp-controls') as HTMLElement;
    const tray = h.container.querySelector('.sp-overflow-tray') as HTMLElement;
    const button = h.container.querySelector('.sp-kbd-help-btn') as HTMLElement;
    expect(button.parentElement).toBe(bar);

    barWidth = 128;
    observer.callback?.(
      [{ contentRect: { height: 400 } }] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver
    );
    flushFrame();

    expect(button.parentElement).toBe(tray);
  });

  it('carries the fit rules of an optional control', () => {
    const [help] = resolveFitItems(['keyboard-help']);

    expect(help.rank).toBe(3);
    expect(help.exit).toBe('overflow');
  });
});
