/**
 * ProgressBar Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../../src/controls/ProgressBar';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    currentTime: 30,
    duration: 100,
    buffered: null,
    live: false,
    liveEdge: false,
    seekableRange: null,
    ...overrides,
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

describe('ProgressBar - Live DVR', () => {
  let api: ReturnType<typeof createMockApi>;
  let progressBar: ProgressBar;

  beforeEach(() => {
    api = createMockApi({
      live: true,
      liveEdge: false,
      seekableRange: { start: 50, end: 150 },
      currentTime: 100,
      duration: 0,
    });
    progressBar = new ProgressBar(api);
  });

  afterEach(() => {
    progressBar.destroy();
  });

  it('should add live class to progress bar when live', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    expect(el.classList.contains('sp-progress--live')).toBe(true);
  });

  it('should calculate progress relative to seekable range', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;

    // currentTime=100, range=50..150, so (100-50)/(150-50) = 50%
    expect(filled.style.width).toBe('50%');
  });

  it('should show 0% progress at start of seekable range', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 50, end: 150 };
      if (key === 'currentTime') return 50;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;
    expect(filled.style.width).toBe('0%');
  });

  it('should show 100% progress at end of seekable range (live edge)', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 50, end: 150 };
      if (key === 'currentTime') return 150;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;
    expect(filled.style.width).toBe('100%');
  });

  it('should set aria-valuetext showing seconds behind live', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    // currentTime=100, seekableRange.end=150 -> 50 seconds behind
    expect(el.getAttribute('aria-valuetext')).toBe('50 seconds behind live');
  });

  it('should update buffered relative to seekable range in live mode', () => {
    const mockBuffered = {
      length: 1,
      start: vi.fn(() => 90),
      end: vi.fn(() => 120),
    };
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 50, end: 150 };
      if (key === 'currentTime') return 100;
      if (key === 'buffered') return mockBuffered;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const buffered = wrapper.querySelector('.sp-progress__buffered') as HTMLElement;

    // bufferedEnd=120, range=50..150, (120-50)/100 = 70%
    expect(buffered.style.width).toBe('70%');
  });

  it('should not have live class when not live', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return false;
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 100;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    expect(el.classList.contains('sp-progress--live')).toBe(false);
  });
});
