/**
 * LiveIndicator Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveIndicator } from '../../src/controls/LiveIndicator';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    live: true,
    liveEdge: true,
    seekableRange: { start: 0, end: 100 },
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  Object.defineProperty(video, 'currentTime', {
    get: () => 100,
    set: vi.fn(),
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
    expect(el.getAttribute('aria-label')).toBe('Seek to live');
  });

  it('should be keyboard accessible', () => {
    const el = liveIndicator.render();
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('should remove element on destroy', () => {
    const el = liveIndicator.render();
    document.body.appendChild(el);

    liveIndicator.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
