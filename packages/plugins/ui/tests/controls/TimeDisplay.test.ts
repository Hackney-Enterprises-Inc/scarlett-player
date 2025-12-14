/**
 * TimeDisplay Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeDisplay } from '../../src/controls/TimeDisplay';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    currentTime: 65,
    duration: 3665,
    live: false,
    seekableRange: null,
  };

  const container = document.createElement('div');

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

describe('TimeDisplay', () => {
  let api: ReturnType<typeof createMockApi>;
  let timeDisplay: TimeDisplay;

  beforeEach(() => {
    api = createMockApi();
    timeDisplay = new TimeDisplay(api);
  });

  afterEach(() => {
    timeDisplay.destroy();
  });

  it('should render time element', () => {
    const el = timeDisplay.render();
    expect(el.classList.contains('sp-time')).toBe(true);
  });

  it('should display VOD time format', () => {
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('1:05 / 1:01:05');
  });

  it('should display LIVE when at live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 100 };
      if (key === 'currentTime') return 100;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('LIVE');
  });

  it('should display negative time when behind live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 100 };
      if (key === 'currentTime') return 35;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('-1:05');
  });

  it('should have aria-live off', () => {
    const el = timeDisplay.render();
    expect(el.getAttribute('aria-live')).toBe('off');
  });

  it('should remove element on destroy', () => {
    const el = timeDisplay.render();
    document.body.appendChild(el);

    timeDisplay.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
