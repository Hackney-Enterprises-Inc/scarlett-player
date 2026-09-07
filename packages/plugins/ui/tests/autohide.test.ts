/**
 * Control bar auto-hide tests (PR-2.1 / SP-38).
 *
 * The bar must not vanish while the viewer is using it: a touch on the bar
 * restarts the timer even when a gestures plugin owns taps on the picture, and
 * an open menu holds the timer off entirely.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

const HIDE_DELAY = 3000;

interface Harness {
  api: IPluginAPI;
  container: HTMLElement;
  ownsTaps: { value: boolean };
}

function createMockApi(): Harness {
  const state: Record<string, unknown> = {
    playing: true,
    paused: false,
    ended: false,
    currentTime: 5,
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
    playbackState: 'playing',
    playbackRate: 1,
    error: null,
    buffered: null,
    seekableRange: null,
  };

  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);

  const ownsTaps = { value: true };

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
    getPlugin: vi.fn((id: string) =>
      id === 'gestures' ? { ownsTapInteraction: () => ownsTaps.value } : null
    ),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as IPluginAPI;

  return { api, container, ownsTaps };
}

describe('control bar auto-hide', () => {
  let harness: Harness;
  let plugin: ReturnType<typeof uiPlugin>;

  const bar = (): HTMLElement => harness.container.querySelector('.sp-controls') as HTMLElement;
  const isHidden = (): boolean => bar().classList.contains('sp-controls--hidden');

  /** Mark the interaction that follows as coming from a finger. */
  const usePointer = (pointerType: string): void => {
    const event = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    harness.container.dispatchEvent(event);
  };

  const touch = (target: HTMLElement): void => {
    usePointer('touch');
    const event = new Event('touchstart', { bubbles: true });
    // jsdom has no TouchEvent; controls that read `touches` (the progress bar
    // starts a scrub from it) need a realistic-enough shape.
    Object.defineProperty(event, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    target.dispatchEvent(event);
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    harness = createMockApi();
    plugin = uiPlugin({ hideDelay: HIDE_DELAY });
    await plugin.init(harness.api);
    plugin.show();
  });

  afterEach(async () => {
    await plugin.destroy?.();
    harness.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
    vi.useRealTimers();
  });

  it('hides after the delay with no interaction', () => {
    vi.advanceTimersByTime(HIDE_DELAY);

    expect(isHidden()).toBe(true);
  });

  it('resets the timer when a finger lands on the control bar', () => {
    vi.advanceTimersByTime(HIDE_DELAY - 100);
    expect(isHidden()).toBe(false);

    // The gestures plugin owns taps on the picture, but this tap is on the bar.
    touch(bar());

    vi.advanceTimersByTime(HIDE_DELAY - 100);
    expect(isHidden()).toBe(false);

    vi.advanceTimersByTime(100);
    expect(isHidden()).toBe(true);
  });

  it('resets the timer when a finger lands on the progress bar', () => {
    const progress = harness.container.querySelector('.sp-progress') as HTMLElement;
    expect(progress).not.toBeNull();

    vi.advanceTimersByTime(HIDE_DELAY - 100);
    touch(progress);

    vi.advanceTimersByTime(HIDE_DELAY - 100);
    expect(isHidden()).toBe(false);
  });

  it('still leaves taps on the picture to the gestures plugin', () => {
    vi.advanceTimersByTime(HIDE_DELAY - 100);

    touch(harness.container);

    // No reset: the tap belonged to the gestures plugin, so the original
    // deadline still stands.
    vi.advanceTimersByTime(100);
    expect(isHidden()).toBe(true);
  });

  it('does not hide while the settings menu is open', () => {
    const gear = harness.container.querySelector('.sp-settings__btn') as HTMLButtonElement;
    gear.click();

    vi.advanceTimersByTime(HIDE_DELAY * 3);
    expect(isHidden()).toBe(false);

    // Closing it lets the bar hide again on the next expiry.
    gear.click();
    vi.advanceTimersByTime(HIDE_DELAY);
    expect(isHidden()).toBe(true);
  });
});
