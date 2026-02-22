/**
 * SkipButton Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkipButton } from '../../src/controls/SkipButton';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    live: false,
    duration: 120,
    seekableRange: null,
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  Object.defineProperty(video, 'duration', { value: 120, writable: true });
  Object.defineProperty(video, 'currentTime', { value: 60, writable: true });
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
    subscribeToState: vi.fn(() => vi.fn()),
  };
}

describe('SkipButton', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    api = createMockApi();
  });

  describe('backward', () => {
    let btn: SkipButton;

    beforeEach(() => {
      btn = new SkipButton(api, 'backward');
    });

    afterEach(() => {
      btn.destroy();
    });

    it('should render a button with correct class', () => {
      const el = btn.render();
      expect(el.tagName).toBe('BUTTON');
      expect(el.classList.contains('sp-skip')).toBe(true);
      expect(el.classList.contains('sp-skip--backward')).toBe(true);
    });

    it('should have correct aria-label', () => {
      const el = btn.render();
      expect(el.getAttribute('aria-label')).toBe('Rewind 10 seconds');
    });

    it('should rewind video by 10 seconds when clicked', () => {
      btn.render();
      const video = api.container.querySelector('video') as HTMLVideoElement;

      btn.render().click();

      expect(video.currentTime).toBe(50); // 60 - 10
    });

    it('should not rewind below 0', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { value: 5, writable: true });

      btn.render().click();

      expect(video.currentTime).toBe(0);
    });

    it('should support custom skip seconds', () => {
      btn.destroy();
      btn = new SkipButton(api, 'backward', 30);
      btn.render();

      const el = btn.render();
      expect(el.getAttribute('aria-label')).toBe('Rewind 30 seconds');

      el.click();
      const video = api.container.querySelector('video') as HTMLVideoElement;
      expect(video.currentTime).toBe(30); // 60 - 30
    });

    it('should be hidden when duration is 0', () => {
      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'duration') return 0;
        return undefined;
      });

      const el = btn.render();
      btn.update();

      expect(el.style.display).toBe('none');
    });

    it('should be visible when duration is available', () => {
      const el = btn.render();
      btn.update();

      expect(el.style.display).toBe('');
    });
  });

  describe('forward', () => {
    let btn: SkipButton;

    beforeEach(() => {
      btn = new SkipButton(api, 'forward');
    });

    afterEach(() => {
      btn.destroy();
    });

    it('should render a button with correct class', () => {
      const el = btn.render();
      expect(el.tagName).toBe('BUTTON');
      expect(el.classList.contains('sp-skip')).toBe(true);
      expect(el.classList.contains('sp-skip--forward')).toBe(true);
    });

    it('should have correct aria-label', () => {
      const el = btn.render();
      expect(el.getAttribute('aria-label')).toBe('Forward 10 seconds');
    });

    it('should skip forward by 10 seconds when clicked', () => {
      btn.render();
      const video = api.container.querySelector('video') as HTMLVideoElement;

      btn.render().click();

      expect(video.currentTime).toBe(70); // 60 + 10
    });

    it('should not skip past duration', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { value: 115, writable: true });

      btn.render().click();

      expect(video.currentTime).toBe(120); // clamped to duration
    });

    it('should be hidden when duration is 0', () => {
      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'duration') return 0;
        return undefined;
      });

      const el = btn.render();
      btn.update();

      expect(el.style.display).toBe('none');
    });

    it('should be visible for VOD content', () => {
      const el = btn.render();
      btn.update();

      expect(el.style.display).toBe('');
    });
  });

  describe('live DVR', () => {
    it('should hide both buttons for live without seekable range', () => {
      const backBtn = new SkipButton(api, 'backward');
      const fwdBtn = new SkipButton(api, 'forward');

      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'live') return true;
        if (key === 'seekableRange') return null;
        if (key === 'duration') return 0;
        return undefined;
      });

      backBtn.update();
      fwdBtn.update();

      expect(backBtn.render().style.display).toBe('none');
      expect(fwdBtn.render().style.display).toBe('none');

      backBtn.destroy();
      fwdBtn.destroy();
    });

    it('should show both buttons for live DVR (seekable range present)', () => {
      const backBtn = new SkipButton(api, 'backward');
      const fwdBtn = new SkipButton(api, 'forward');

      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'live') return true;
        if (key === 'seekableRange') return { start: 50, end: 150 };
        if (key === 'duration') return 0;
        return undefined;
      });

      backBtn.update();
      fwdBtn.update();

      expect(backBtn.render().style.display).toBe('');
      expect(fwdBtn.render().style.display).toBe('');

      backBtn.destroy();
      fwdBtn.destroy();
    });

    it('should clamp backward skip to seekable range start in live DVR', () => {
      const btn = new SkipButton(api, 'backward');
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { value: 55, writable: true });

      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'live') return true;
        if (key === 'seekableRange') return { start: 50, end: 150 };
        return undefined;
      });

      btn.render().click();
      // 55 - 10 = 45, but clamped to start=50
      expect(video.currentTime).toBe(50);

      btn.destroy();
    });

    it('should clamp forward skip to seekable range end in live DVR', () => {
      const btn = new SkipButton(api, 'forward');
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { value: 145, writable: true });

      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'live') return true;
        if (key === 'seekableRange') return { start: 50, end: 150 };
        return undefined;
      });

      btn.render().click();
      // 145 + 10 = 155, but clamped to end=150
      expect(video.currentTime).toBe(150);

      btn.destroy();
    });
  });

  describe('cleanup', () => {
    it('should remove element on destroy', () => {
      const btn = new SkipButton(api, 'backward');
      const el = btn.render();
      document.body.appendChild(el);
      expect(document.body.contains(el)).toBe(true);

      btn.destroy();
      expect(document.body.contains(el)).toBe(false);
    });

    it('should not skip after destroy', () => {
      const btn = new SkipButton(api, 'forward');
      const el = btn.render();
      btn.destroy();

      const video = api.container.querySelector('video') as HTMLVideoElement;
      const currentTime = video.currentTime;

      // Click should not trigger skip since handler was removed
      el.click();
      expect(video.currentTime).toBe(currentTime);
    });
  });
});
