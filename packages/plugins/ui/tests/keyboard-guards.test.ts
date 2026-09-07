/**
 * Keyboard shortcut guard tests (PR-2.1 / SP-36).
 *
 * The document-level shortcuts must stand down for modifier chords, for keys
 * a nearer handler already consumed, and for the keys a focused button or
 * slider acts on itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

interface Harness {
  api: IPluginAPI;
  container: HTMLElement;
  video: HTMLVideoElement;
}

function createMockApi(): Harness {
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
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const api = {
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

  return { api, container, video };
}

describe('keyboard shortcut guards', () => {
  let harness: Harness;
  let plugin: ReturnType<typeof uiPlugin>;

  const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(event);

    return event;
  };

  beforeEach(async () => {
    harness = createMockApi();
    plugin = uiPlugin();
    await plugin.init(harness.api);
    // Nothing inside the player focused but the player itself: the state the
    // shortcuts are actually for.
    harness.container.focus();
  });

  afterEach(async () => {
    await plugin.destroy?.();
    harness.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('acts on a bare shortcut key', () => {
    harness.video.currentTime = 40;

    press('ArrowLeft');

    expect(harness.video.currentTime).toBe(35);
  });

  it.each([['metaKey'], ['ctrlKey'], ['altKey']])('ignores %s chords', (modifier) => {
    harness.video.currentTime = 40;

    const event = press('ArrowLeft', { [modifier]: true });

    expect(harness.video.currentTime).toBe(40);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a key another handler already consumed', () => {
    harness.video.currentTime = 40;

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(harness.video.currentTime).toBe(40);
  });

  it('leaves Space to a focused button', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    (harness.video as unknown as { play: unknown }).play = play;

    const btn = harness.container.querySelector('button') as HTMLButtonElement;
    btn.focus();

    press(' ');

    expect(play).not.toHaveBeenCalled();
  });

  it('leaves the arrow keys to a focused slider', () => {
    harness.video.currentTime = 40;

    const slider = harness.container.querySelector('[role="slider"]') as HTMLElement;
    slider.focus();

    press('ArrowLeft');

    // The slider's own handler seeks; the shortcut must not seek a second time.
    expect(harness.video.currentTime).toBe(40);
  });

  it('still handles letter shortcuts while a button has focus', () => {
    const btn = harness.container.querySelector('button') as HTMLButtonElement;
    btn.focus();

    expect(harness.video.muted).toBe(false);
    press('m');
    expect(harness.video.muted).toBe(true);
  });
});
