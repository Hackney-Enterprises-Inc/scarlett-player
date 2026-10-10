/**
 * Digit-percentage seeking and the C captions shortcut (SCAR-DX-3).
 *
 * The document-level handler must map 0-9 to a fraction of the media, live or
 * VOD, one clamped element write and one `playback:seeking` emit per accepted
 * key, and stand down for everything it cannot map. The C shortcut must match
 * the captions button's own toggle exactly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiPlugin } from '../src/index';
import { CaptionsButton } from '../src/controls/CaptionsButton';
import type { MockPluginAPI } from './mock-api';

/**
 * A mounted player plus the trace of every element write, bus seek and
 * caption command that reaches it.
 */
interface Harness {
  api: MockPluginAPI;
  container: HTMLElement;
  video: HTMLVideoElement;
  state: Record<string, unknown>;
  trace: Array<[string, number | string | null]>;
}

/**
 * Build a player harness with a real (jsdom) video element whose
 * `currentTime` writes and the bus events they produce both land in a trace,
 * in arrival order, so write-before-emit can be asserted per key.
 */
function createHarness(stateOverrides: Record<string, unknown> = {}): Harness {
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
  const video = document.createElement('video');
  let time = 30;
  Object.defineProperty(video, 'currentTime', {
    get: () => time,
    set: (value: number) => {
      time = value;
      trace.push(['write', value]);
    },
  });
  Object.defineProperty(video, 'duration', { value: 100, configurable: true });
  video.play = vi.fn(() => {
    trace.push(['play', time]);
    return Promise.resolve();
  });
  video.pause = vi.fn();
  container.appendChild(video);
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
  vi.restoreAllMocks();
});

/** Dispatch a document keydown and report the event for default assertions. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);

  return event;
}

/** Mount the UI plugin on a harness and focus the player itself. */
async function mountPlugin(h: Harness) {
  const plugin = uiPlugin();
  cleanups.push(() => plugin.destroy());
  await plugin.init(h.api);
  h.container.focus();

  return plugin;
}

describe('digit seeking (VOD)', () => {
  it.each([
    ['0', 0],
    ['3', 30],
    ['5', 50],
    ['9', 90],
  ] as const)('%s writes %s%% of the duration and emits once, after the write', async (key, target) => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press(key);

    expect(h.trace).toEqual([['write', target], ['emit', target]]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('seeks once per keydown, not once per key', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');
    press('5');

    expect(h.trace).toEqual([
      ['write', 50],
      ['emit', 50],
      ['write', 50],
      ['emit', 50],
    ]);
  });

  it('does not implicitly play a paused source', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');

    expect(h.video.play).not.toHaveBeenCalled();
    expect(h.trace).not.toContainEqual(['play', expect.any(Number)]);
  });

  it('prefers the player duration over the element duration', async () => {
    const h = createHarness();
    Object.defineProperty(h.video, 'duration', { value: 40, configurable: true });
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');

    // State carries the latest known duration; the element may lag behind it.
    expect(h.trace).toEqual([['write', 50], ['emit', 50]]);
  });

  it('falls back to the element duration when state has none', async () => {
    const h = createHarness();
    h.state.duration = undefined;
    Object.defineProperty(h.video, 'duration', { value: 200, configurable: true });
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');

    expect(h.trace).toEqual([['write', 100], ['emit', 100]]);
  });

  it.each([0, NaN, Infinity])('does nothing when no duration is finite (both %s)', async (invalid) => {
    const h = createHarness();
    h.state.duration = invalid;
    Object.defineProperty(h.video, 'duration', { value: invalid, configurable: true });
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('5');

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing without a media element', async () => {
    const h = createHarness();
    h.video.remove();
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('5');

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('digit seeking (live)', () => {
  it.each([
    ['0', 50],
    ['5', 100],
    ['9', 140],
  ] as const)('%s maps across the DVR window from its start', async (key, target) => {
    const h = createHarness({ live: true, seekableRange: { start: 50, end: 150 } });
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press(key);

    expect(h.trace).toEqual([['write', target], ['emit', target]]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('clamps the mapped target inside the window', async () => {
    const h = createHarness({ live: true, seekableRange: { start: 10, end: 20 } });
    await mountPlugin(h);
    h.trace.length = 0;

    press('9');

    expect(h.trace).toEqual([['write', 19], ['emit', 19]]);
  });

  it('does nothing on live without a DVR window', async () => {
    const h = createHarness({ live: true, seekableRange: null });
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('5');

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing for a non-finite window', async () => {
    const h = createHarness({ live: true, seekableRange: { start: 0, end: Infinity } });
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');

    expect(h.trace).toEqual([]);
  });

  it('does nothing for an empty window', async () => {
    const h = createHarness({ live: true, seekableRange: { start: 30, end: 30 } });
    await mountPlugin(h);
    h.trace.length = 0;

    press('5');

    expect(h.trace).toEqual([]);
  });
});

describe('digit guards', () => {
  it('does not repurpose Shift+digit', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('3', { shiftKey: true });

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not repurpose AltGraph+digit', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    const event = new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'getModifierState', {
      value: (modifier: string) => modifier === 'AltGraph',
    });
    document.dispatchEvent(event);

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('captions shortcut', () => {
  const tracks = [
    { id: 'en', label: 'English', language: 'en', kind: 'subtitles' },
    { id: 'es', label: 'Espanol', language: 'es', kind: 'subtitles' },
  ];

  it('enables the first available track on lowercase c', async () => {
    const h = createHarness({ textTracks: tracks });
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('c');

    expect(h.trace).toEqual([['track', 'en']]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('enables the first available track on uppercase C as well', async () => {
    const h = createHarness({ textTracks: tracks });
    await mountPlugin(h);
    h.trace.length = 0;

    press('C');

    expect(h.trace).toEqual([['track', 'en']]);
  });

  it('turns the current track off', async () => {
    const h = createHarness({ textTracks: tracks, currentTextTrack: tracks[0] });
    await mountPlugin(h);
    h.trace.length = 0;

    press('C');

    expect(h.trace).toEqual([['track', null]]);
  });

  it('does nothing without tracks, and does not consume the key', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    const event = press('c');

    expect(h.trace).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores modifier chords', async () => {
    const h = createHarness({ textTracks: tracks });
    await mountPlugin(h);
    h.trace.length = 0;

    press('c', { ctrlKey: true });

    expect(h.trace).toEqual([]);
  });

  it('ignores typing in an editable field', async () => {
    const h = createHarness({ textTracks: tracks });
    await mountPlugin(h);
    const input = document.createElement('input');
    h.container.appendChild(input);
    input.focus();
    h.trace.length = 0;

    press('c');

    expect(h.trace).toEqual([]);
  });

  it('still fires while a control button has focus', async () => {
    const h = createHarness({ textTracks: tracks });
    await mountPlugin(h);
    const button = h.container.querySelector('button') as HTMLButtonElement;
    button.focus();
    h.trace.length = 0;

    press('c');

    // Letter keys are not widget-owned: the widget guard leaves them to the
    // player, exactly as it already does for 'm'.
    expect(h.trace).toEqual([['track', 'en']]);
  });

  it('matches the captions button behaviour exactly', async () => {
    const off = createHarness({ textTracks: tracks, currentTextTrack: tracks[0] });
    const button = new CaptionsButton(off.api);
    cleanups.push(() => button.destroy());
    button.render().click();
    expect(off.trace).toEqual([['track', null]]);

    const on = createHarness({ textTracks: tracks });
    const shortcut = createHarness({ textTracks: tracks });
    const onButton = new CaptionsButton(on.api);
    cleanups.push(() => onButton.destroy());
    onButton.render().click();
    await mountPlugin(shortcut);
    press('c');
    expect(on.trace).toEqual(shortcut.trace);
  });
});

describe('existing shortcuts keep their behaviour', () => {
  it('keeps M as mute and does not add Shift+M', async () => {
    const h = createHarness();
    await mountPlugin(h);

    press('m');
    expect(h.video.muted).toBe(true);

    press('M');
    expect(h.video.muted).toBe(true);
  });

  it('keeps the arrow shortcuts seeking', async () => {
    const h = createHarness();
    await mountPlugin(h);
    h.trace.length = 0;

    press('ArrowLeft');

    expect(h.trace).toEqual([['write', 25], ['emit', 25]]);
  });
});

describe('keyboard option', () => {
  /** Mount the UI plugin with the given config and focus the player itself. */
  async function mountWith(h: Harness, config: Parameters<typeof uiPlugin>[0]) {
    const plugin = uiPlugin(config);
    cleanups.push(() => plugin.destroy());
    await plugin.init(h.api);
    h.container.focus();

    return plugin;
  }

  /**
   * Count the document keydown listeners a mount adds. Controls such as the
   * settings menu add their own, so only the difference between configs says
   * whether the global shortcut handler was attached.
   */
  async function documentKeydownListeners(config: Parameters<typeof uiPlugin>[0]) {
    const h = createHarness();
    const add = vi.spyOn(document, 'addEventListener');
    await mountWith(h, config);
    const count = add.mock.calls.filter(([type]) => type === 'keydown').length;
    add.mockRestore();

    return count;
  }

  it('attaches one fewer document keydown listener when keyboard is false', async () => {
    const defaults = await documentKeydownListeners({});
    const explicit = await documentKeydownListeners({ keyboard: true });
    const off = await documentKeydownListeners({ keyboard: false });

    expect(explicit).toBe(defaults);
    expect(off).toBe(defaults - 1);
  });

  it('ignores Space, ? and digits when keyboard is false', async () => {
    const h = createHarness();
    await mountWith(h, { keyboard: false });
    h.trace.length = 0;

    const space = press(' ');
    const help = press('?');
    const digit = press('5');

    expect(h.trace).toEqual([]);
    expect(h.video.play).not.toHaveBeenCalled();
    expect(h.container.querySelector('[role="dialog"]')).toBeNull();
    expect(space.defaultPrevented).toBe(false);
    expect(help.defaultPrevented).toBe(false);
    expect(digit.defaultPrevented).toBe(false);
  });

  it('keeps the container focusable when keyboard is false', async () => {
    const h = createHarness();
    await mountWith(h, { keyboard: false });

    expect(h.container.getAttribute('tabindex')).toBe('0');
  });

  it('still seeks on a digit when keyboard is true', async () => {
    const h = createHarness();
    await mountWith(h, { keyboard: true });
    h.trace.length = 0;

    press('5');

    expect(h.trace).toEqual([['write', 50], ['emit', 50]]);
  });
});
