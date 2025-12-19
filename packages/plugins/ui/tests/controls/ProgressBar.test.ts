/**
 * ProgressBar Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../../src/controls/ProgressBar';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    currentTime: 30,
    duration: 100,
    buffered: null,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  Object.defineProperty(video, 'currentTime', {
    get: () => state.currentTime,
    set: (v) => {
      state.currentTime = v;
    },
    configurable: true,
  });
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

describe('ProgressBar', () => {
  let api: ReturnType<typeof createMockApi>;
  let progressBar: ProgressBar;

  beforeEach(() => {
    api = createMockApi();
    progressBar = new ProgressBar(api);
  });

  afterEach(() => {
    progressBar.destroy();
  });

  it('should render progress bar wrapper element', () => {
    const wrapper = progressBar.render();
    expect(wrapper.classList.contains('sp-progress-wrapper')).toBe(true);
  });

  it('should have slider role on inner progress element', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress');
    expect(el?.getAttribute('role')).toBe('slider');
    expect(el?.getAttribute('aria-label')).toBe('Seek');
  });

  it('should have track, filled, buffered, handle, and tooltip elements', () => {
    const wrapper = progressBar.render();
    expect(wrapper.querySelector('.sp-progress__track')).not.toBeNull();
    expect(wrapper.querySelector('.sp-progress__filled')).not.toBeNull();
    expect(wrapper.querySelector('.sp-progress__buffered')).not.toBeNull();
    expect(wrapper.querySelector('.sp-progress__handle')).not.toBeNull();
    expect(wrapper.querySelector('.sp-progress__tooltip')).not.toBeNull();
  });

  it('should update filled width based on progress', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;

    // 30 / 100 = 30%
    expect(filled.style.width).toBe('30%');
  });

  it('should update aria values on inner progress element', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress');

    expect(el?.getAttribute('aria-valuemax')).toBe('100');
    expect(el?.getAttribute('aria-valuenow')).toBe('30');
  });

  it('should update buffered width when buffered ranges exist', () => {
    const mockBuffered = {
      length: 1,
      start: vi.fn(() => 0),
      end: vi.fn(() => 60),
    };
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'buffered') return mockBuffered;
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 100;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const buffered = wrapper.querySelector('.sp-progress__buffered') as HTMLElement;

    expect(buffered.style.width).toBe('60%');
  });

  it('should be keyboard accessible on inner progress element', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress');
    expect(el?.getAttribute('tabindex')).toBe('0');
  });

  it('should remove element on destroy', () => {
    const wrapper = progressBar.render();
    document.body.appendChild(wrapper);
    expect(document.body.contains(wrapper)).toBe(true);

    progressBar.destroy();
    expect(document.body.contains(wrapper)).toBe(false);
  });
});
