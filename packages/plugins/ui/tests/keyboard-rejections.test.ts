/**
 * Keyboard shortcut rejection-safety tests
 * (Phase 4 of fix/scarlett-error-absorption).
 *
 * The space/'k' play toggle and the 'f' fullscreen toggle call promise
 * APIs that reject under autoplay policy or fullscreen denial; those
 * rejections must never escape to onunhandledrejection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function createMockApi(): { api: IPluginAPI; container: HTMLElement; video: HTMLVideoElement } {
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

  const api = {
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
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as IPluginAPI;

  return { api, container, video };
}

describe('keyboard shortcut rejection safety', () => {
  let api: IPluginAPI;
  let container: HTMLElement;
  let video: HTMLVideoElement;
  let plugin: ReturnType<typeof uiPlugin>;

  const pressKey = (key: string) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  beforeEach(async () => {
    ({ api, container, video } = createMockApi());
    plugin = uiPlugin();
    await plugin.init(api);

    // Focus inside the container so the shortcut handler engages
    const btn = container.querySelector('button');
    (btn as HTMLButtonElement | null)?.focus();
  });

  afterEach(async () => {
    await plugin.destroy?.();
    container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
    delete (document as any).fullscreenElement;
    vi.restoreAllMocks();
  });

  it('catches a rejected play() from the space/k shortcut', async () => {
    const play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    (video as any).play = play;

    pressKey(' ');
    await flush();

    // An escaped rejection would fail the run; the call itself must happen
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('catches a rejected requestFullscreen() from the f shortcut', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Permission denied'));
    (container as any).requestFullscreen = request;

    pressKey('f');
    await flush();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('catches a rejected exitFullscreen() from the f shortcut', async () => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: container,
      configurable: true,
    });
    (document as any).exitFullscreen = vi.fn().mockRejectedValue(new Error('denied'));

    pressKey('f');
    await flush();

    expect((document as any).exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
