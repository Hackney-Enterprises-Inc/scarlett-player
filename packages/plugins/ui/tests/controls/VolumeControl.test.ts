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

  // --- Keyboard Interactions ---

  it('should increase volume on ArrowUp key', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    // video.volume starts at 1, step is 0.1
    // Clamped to max 1, so should stay 1
    Object.defineProperty(video, 'volume', { value: 0.5, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    // 0.5 + 0.1 = 0.6
    expect(video.volume).toBeCloseTo(0.6, 1);
  });

  it('should decrease volume on ArrowDown key', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    Object.defineProperty(video, 'volume', { value: 0.5, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    // 0.5 - 0.1 = 0.4
    expect(video.volume).toBeCloseTo(0.4, 1);
  });

  it('should increase volume on ArrowRight key', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    Object.defineProperty(video, 'volume', { value: 0.5, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(video.volume).toBeCloseTo(0.6, 1);
  });

  it('should decrease volume on ArrowLeft key', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    Object.defineProperty(video, 'volume', { value: 0.5, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(video.volume).toBeCloseTo(0.4, 1);
  });

  it('should clamp volume to 0 when decreasing below zero', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    Object.defineProperty(video, 'volume', { value: 0.05, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    // 0.05 - 0.1 = -0.05, clamped to 0
    expect(video.volume).toBe(0);
  });

  it('should clamp volume to 1 when increasing above max', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    Object.defineProperty(video, 'volume', { value: 0.95, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    // 0.95 + 0.1 = 1.05, clamped to 1
    expect(video.volume).toBe(1);
  });

  // --- State Updates ---

  it('should show low volume icon when volume is below 0.5', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0.3;
      if (key === 'muted') return false;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Mute');
    // It should render the low volume icon (not mute, not high)
    expect(btn.innerHTML).toContain('svg');
  });

  it('should show unmute label when volume is 0', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0;
      if (key === 'muted') return false;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Unmute');
  });

  it('should update aria-valuenow on the slider', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0.75;
      if (key === 'muted') return false;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    expect(slider.getAttribute('aria-valuenow')).toBe('75');
  });

  it('should set aria-valuenow to 0 when muted', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'volume') return 0.75;
      if (key === 'muted') return true;
      return null;
    });

    volumeControl.update();
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  // --- Slider ARIA attributes ---

  it('should have slider role on the slider element', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    expect(slider.getAttribute('role')).toBe('slider');
    expect(slider.getAttribute('aria-label')).toBe('Volume');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
  });

  it('should be keyboard accessible on the slider', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    expect(slider.getAttribute('tabindex')).toBe('0');
  });

  // --- Cleanup ---

  it('should remove document-level event listeners on destroy', () => {
    volumeControl.render();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    volumeControl.destroy();

    const removedEvents = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('mouseup');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
    expect(removedEvents).toContain('touchcancel');

    removeSpy.mockRestore();
  });

  // --- Edge Cases ---

  it('should handle rapid mute toggle without errors', () => {
    const el = volumeControl.render();
    const btn = el.querySelector('button')!;
    const video = api.container.querySelector('video')!;

    btn.click();
    btn.click();
    btn.click();
    btn.click();

    expect(video.muted).toBe(false);
  });

  it('should unmute when setting volume above 0 while muted', () => {
    const el = volumeControl.render();
    const slider = el.querySelector('.sp-volume__slider') as HTMLElement;
    const video = api.container.querySelector('video')!;

    video.muted = true;
    Object.defineProperty(video, 'volume', { value: 0, writable: true, configurable: true });

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    // setVolume(0 + 0.1) should set volume to 0.1 and unmute
    expect(video.volume).toBeCloseTo(0.1, 1);
    expect(video.muted).toBe(false);
  });
});
