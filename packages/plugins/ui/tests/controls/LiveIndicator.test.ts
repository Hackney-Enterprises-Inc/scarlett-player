/**
 * LiveIndicator Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveIndicator } from '../../src/controls/LiveIndicator';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(overrides: Record<string, unknown> = {}): IPluginAPI {
  const state: Record<string, unknown> = {
    live: true,
    liveEdge: true,
    seekableRange: { start: 0, end: 100 },
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  let videoCurrentTime = 100;
  Object.defineProperty(video, 'currentTime', {
    get: () => videoCurrentTime,
    set: (v) => { videoCurrentTime = v; },
    configurable: true,
  });
  container.appendChild(video);

  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => { state[key] = value; }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
  };
}

describe('LiveIndicator', () => {
  let api: ReturnType<typeof createMockApi>;
  let liveIndicator: LiveIndicator;

  beforeEach(() => {
    api = createMockApi();
    liveIndicator = new LiveIndicator(api);
  });

  afterEach(() => {
    liveIndicator.destroy();
  });

  it('should render live indicator', () => {
    const el = liveIndicator.render();
    expect(el.classList.contains('sp-live')).toBe(true);
  });

  it('should have dot and LIVE text', () => {
    const el = liveIndicator.render();
    expect(el.querySelector('.sp-live__dot')).not.toBeNull();
    expect(el.textContent).toContain('LIVE');
  });

  it('should be visible when live', () => {
    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.style.display).toBe('');
  });

  it('should be hidden when not live', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return false;
      return null;
    });

    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.style.display).toBe('none');
  });

  it('should not have behind class when at live edge', () => {
    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.classList.contains('sp-live--behind')).toBe(false);
  });

  it('should have behind class when not at live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'liveEdge') return false;
      return null;
    });

    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.classList.contains('sp-live--behind')).toBe(true);
  });

  it('should have button role', () => {
    const el = liveIndicator.render();
    expect(el.getAttribute('role')).toBe('button');
  });

  it('should be keyboard accessible', () => {
    const el = liveIndicator.render();
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('should show "LIVE" text and "At live edge" aria when at live edge', () => {
    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.textContent).toContain('LIVE');
    expect(el.getAttribute('aria-label')).toBe('At live edge');
  });

  it('should show "GO LIVE" text and "Seek to live" aria when behind live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'liveEdge') return false;
      return null;
    });

    liveIndicator.update();
    const el = liveIndicator.render();
    expect(el.textContent).toContain('GO LIVE');
    expect(el.getAttribute('aria-label')).toBe('Seek to live');
  });

  it('should seek to live edge on click', () => {
    const el = liveIndicator.render();
    const video = api.container.querySelector('video')!;
    el.click();
    expect(video.currentTime).toBe(100);
  });

  it('should seek to live edge on Enter key', () => {
    const el = liveIndicator.render();
    const video = api.container.querySelector('video')!;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(video.currentTime).toBe(100);
  });

  it('should remove element on destroy', () => {
    const el = liveIndicator.render();
    document.body.appendChild(el);

    liveIndicator.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
