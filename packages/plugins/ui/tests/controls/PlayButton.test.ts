/**
 * PlayButton Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayButton } from '../../src/controls/PlayButton';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
  container.appendChild(video);

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
    onDestroy: vi.fn(),
  };
}

describe('PlayButton', () => {
  let api: ReturnType<typeof createMockApi>;
  let button: PlayButton;

  beforeEach(() => {
    api = createMockApi();
    button = new PlayButton(api);
  });

  afterEach(() => {
    button.destroy();
  });

  it('should render a button element', () => {
    const el = button.render();
    expect(el.tagName).toBe('BUTTON');
    expect(el.classList.contains('sp-play')).toBe(true);
  });

  it('should have play icon when paused', () => {
    button.update();
    const el = button.render();
    expect(el.innerHTML).toContain('svg');
    expect(el.getAttribute('aria-label')).toBe('Play');
  });

  it('should have pause icon when playing', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return true;
      if (key === 'paused') return false;
      if (key === 'ended') return false;
      return null;
    });

    button.update();
    const el = button.render();
    expect(el.getAttribute('aria-label')).toBe('Pause');
  });

  it('should have replay icon when ended', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return false;
      if (key === 'paused') return true;
      if (key === 'ended') return true;
      return null;
    });

    button.update();
    const el = button.render();
    expect(el.getAttribute('aria-label')).toBe('Replay');
  });

  it('should call video.play() when clicked while paused', () => {
    const video = api.container.querySelector('video')!;
    button.render().click();
    expect(video.play).toHaveBeenCalled();
  });

  it('should call video.pause() when clicked while playing', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return true;
      return false;
    });

    const video = api.container.querySelector('video')!;
    button.render().click();
    expect(video.pause).toHaveBeenCalled();
  });

  it('should seek to 0 and play when clicked while ended', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'ended') return true;
      return false;
    });

    const video = api.container.querySelector('video')!;
    button.render().click();
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();
  });

  it('should remove element on destroy', () => {
    const el = button.render();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    button.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
