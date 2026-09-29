import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressBar } from '../src/controls/ProgressBar';
import { PlayButton } from '../src/controls/PlayButton';
import { uiPlugin } from '../src/index';
import type { MockPluginAPI } from './mock-api';

function createHarness(live = false) {
  const state: Record<string, unknown> = {
    currentTime: 30, duration: 100, live, seekableRange: live ? { start: 50, end: 150 } : null,
    paused: true, playing: false, ended: false, volume: 1, muted: false,
    qualities: [], textTracks: [], chapters: [], playbackState: 'ready', playbackRate: 1,
  };
  const trace: Array<[string, number]> = [];
  const container = document.createElement('div');
  const video = document.createElement('video');
  let time = live ? 100 : 30;
  Object.defineProperty(video, 'currentTime', {
    get: () => time,
    set: (value: number) => { time = value; trace.push(['write', value]); },
  });
  Object.defineProperty(video, 'duration', { value: 100 });
  video.play = vi.fn().mockImplementation(() => {
    trace.push(['play', video.currentTime]);
    return Promise.resolve();
  });
  video.pause = vi.fn();
  container.appendChild(video);
  document.body.appendChild(container);
  const api: MockPluginAPI = {
    pluginId: 'ui-controls', container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => { state[key] = value; }),
    defineState: vi.fn(), subscribeToState: vi.fn(() => vi.fn()),
    on: vi.fn(() => vi.fn()), off: vi.fn(),
    emit: vi.fn((event: string, payload: { time: number }) => {
      if (event === 'playback:seeking') trace.push(['emit', payload.time]);
    }),
    getPlugin: vi.fn(() => null), onDestroy: vi.fn(),
  };
  return { api, video, trace, container };
}

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.innerHTML = '';
  document.querySelectorAll('style').forEach((style) => style.remove());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function createBar(live = false) {
  const h = createHarness(live);
  const bar = new ProgressBar(h.api);
  cleanups.push(() => bar.destroy());
  const wrapper = bar.render();
  h.container.appendChild(wrapper);
  const slider = wrapper.querySelector<HTMLElement>('.sp-progress')!;
  slider.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
  return { ...h, wrapper, slider };
}

function touch(target: EventTarget, type: string, clientX: number) {
  const point = { clientX } as Touch;
  target.dispatchEvent(new TouchEvent(type, {
    bubbles: true, cancelable: true,
    touches: type === 'touchend' ? [] : [point], changedTouches: [point],
  }));
}

describe.each([false, true])('UI seeking bus events (live=%s)', (live) => {
  const start = live ? 50 : 0;
  const end = live ? 150 : 100;

  it.each([
    ['ArrowLeft', start + 2, start],
    ['ArrowRight', end - 2, end],
    ['Home', 70, start],
    ['End', 70, end],
  ] as const)('progress key %s emits once immediately after the clamped write', (key, from, to) => {
    const h = createBar(live);
    h.video.currentTime = from;
    h.trace.length = 0;
    h.slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(h.trace).toEqual([['write', to], ['emit', to]]);
  });

  it.each([
    ['ArrowLeft', start + 2, start],
    ['ArrowRight', end - 2, end],
  ] as const)('document shortcut %s emits once immediately after the clamped write', async (key, from, to) => {
    const h = createHarness(live);
    const plugin = uiPlugin();
    cleanups.push(() => plugin.destroy());
    await plugin.init(h.api);
    h.container.focus();
    h.video.currentTime = from;
    h.trace.length = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(h.trace).toEqual([['write', to], ['emit', to]]);
  });

  it.each(['mouse', 'touch'])('%s press and release emit clamped targets immediately after each write', (input) => {
    const h = createBar(live);
    if (input === 'mouse') {
      h.wrapper.dispatchEvent(new MouseEvent('mousedown', { clientX: -20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 120 }));
    } else {
      touch(h.wrapper, 'touchstart', -20);
      touch(document, 'touchend', 120);
    }
    expect(h.trace).toEqual([['write', start], ['emit', start], ['write', end], ['emit', end]]);
  });
});

describe('UI seeking gestures and guards', () => {
  it.each(['mouse', 'touch'])('%s drag writes five throttled moves but emits only on press and release', (input) => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    const h = createBar();
    if (input === 'mouse') h.wrapper.dispatchEvent(new MouseEvent('mousedown', { clientX: 10 }));
    else touch(h.wrapper, 'touchstart', 10);
    for (const clientX of [20, 30, 40, 50, 60]) {
      vi.advanceTimersByTime(100);
      if (input === 'mouse') document.dispatchEvent(new MouseEvent('mousemove', { clientX }));
      else touch(document, 'touchmove', clientX);
    }
    if (input === 'mouse') document.dispatchEvent(new MouseEvent('mouseup', { clientX: 70 }));
    else touch(document, 'touchend', 70);
    expect(h.trace).toEqual([
      ['write', 10], ['emit', 10],
      ['write', 20], ['write', 30], ['write', 40], ['write', 50], ['write', 60],
      ['write', 70], ['emit', 70],
    ]);
    expect(h.api.emit.mock.calls.filter(([name]) => name === 'playback:seeking')).toHaveLength(2);
  });

  it('keeps a throttled mid-drag write silent on the bus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    const h = createBar();
    h.wrapper.dispatchEvent(new MouseEvent('mousedown', { clientX: 10 }));
    h.trace.length = 0;
    vi.advanceTimersByTime(100);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20 }));
    expect(h.trace).toEqual([['write', 20]]);
  });

  it('does not emit or write for a non-finite pointer target', () => {
    const h = createBar();
    h.api.setState('duration', Infinity);
    h.wrapper.dispatchEvent(new MouseEvent('mousedown', { clientX: 50 }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 50 }));
    expect(h.trace).toEqual([]);
  });

  it('does not emit or write without a media element', () => {
    const h = createBar();
    h.video.remove();
    h.wrapper.dispatchEvent(new MouseEvent('mousedown', { clientX: 50 }));
    h.slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(h.trace).toEqual([]);
  });

  it('does not emit or write for an unrelated progress key', () => {
    const h = createBar();
    h.slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(h.trace).toEqual([]);
  });

  it('a focused progress key bubbles to document without a second seek event', async () => {
    const h = createHarness();
    const plugin = uiPlugin();
    cleanups.push(() => plugin.destroy());
    await plugin.init(h.api);
    const slider = h.container.querySelector<HTMLElement>('.sp-progress')!;
    slider.focus();
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(h.trace).toEqual([['write', 35], ['emit', 35]]);
  });

  it('replay emits time zero immediately after the write and before play', () => {
    const h = createHarness();
    const button = new PlayButton(h.api);
    cleanups.push(() => button.destroy());
    h.api.setState('ended', true);
    button.render().click();
    expect(h.trace).toEqual([['write', 0], ['emit', 0], ['play', 0]]);
  });

  it('ordinary play does not emit a seek', () => {
    const h = createHarness();
    const button = new PlayButton(h.api);
    cleanups.push(() => button.destroy());
    button.render().click();
    expect(h.trace).toEqual([['play', 30]]);
  });
});
