/**
 * VolumeControl Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VolumeControl } from '../../src/controls/VolumeControl';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    volume: 1,
    muted: false,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  Object.defineProperty(video, 'volume', {
    get: () => state.volume,
    set: (v) => {
      state.volume = v;
    },
    configurable: true,
  });
  Object.defineProperty(video, 'muted', {
    get: () => state.muted,
    set: (v) => {
      state.muted = v;
    },
    configurable: true,
  });
  container.appendChild(video);

  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
  };
}

describe('VolumeControl', () => {
  let api: ReturnType<typeof createMockApi>;
  let volumeControl: VolumeControl;

  beforeEach(() => {
    api = createMockApi();
    volumeControl = new VolumeControl(api);
  });

  afterEach(() => {
    volumeControl.destroy();
  });

  it('should render volume container', () => {
    const el = volumeControl.render();
    expect(el.classList.contains('sp-volume')).toBe(true);
  });

  it('should have button and slider', () => {
    const el = volumeControl.render();
    expect(el.querySelector('button')).not.toBeNull();
    expect(el.querySelector('.sp-volume__slider')).not.toBeNull();
  });

  it('should have high volume icon when volume is high', () => {
    volumeControl.update();
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Mute');
  });

  it('should have mute icon when muted', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'muted') return true;
      if (key === 'volume') return 1;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Unmute');
  });

  it('should toggle mute on button click', () => {
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    const video = api.container.querySelector('video')!;

    btn.click();
    expect(video.muted).toBe(true);

    btn.click();
    expect(video.muted).toBe(false);
  });

  it('should update slider level', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0.5;
      if (key === 'muted') return false;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const level = el.querySelector('.sp-volume__level') as HTMLElement;
    expect(level.style.width).toBe('50%');
  });

  it('should show 0% when muted', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0.5;
      if (key === 'muted') return true;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const level = el.querySelector('.sp-volume__level') as HTMLElement;
    expect(level.style.width).toBe('0%');
  });

  it('should remove element on destroy', () => {
    const el = volumeControl.render();
    document.body.appendChild(el);

    volumeControl.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
