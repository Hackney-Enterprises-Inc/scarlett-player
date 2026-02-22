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

  // --- VOD Time Formatting ---

  it('should display 0:00 / 0:00 when both currentTime and duration are 0', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 0;
      if (key === 'duration') return 0;
      if (key === 'live') return false;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('0:00 / 0:00');
  });

  it('should display short format for times under one hour', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 125; // 2:05
      if (key === 'duration') return 600; // 10:00
      if (key === 'live') return false;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('2:05 / 10:00');
  });

  it('should display hour format for very long durations', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 7384; // 2:03:04
      if (key === 'duration') return 36000; // 10:00:00
      if (key === 'live') return false;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('2:03:04 / 10:00:00');
  });

  it('should handle currentTime at exactly duration', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 100;
      if (key === 'duration') return 100;
      if (key === 'live') return false;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('1:40 / 1:40');
  });

  // --- Live Mode ---

  it('should display LIVE when live with no seekable range', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return null;
      if (key === 'currentTime') return 50;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('LIVE');
  });

  it('should display LIVE when exactly at live edge', () => {
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

  it('should display negative minutes:seconds when behind live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 300 };
      if (key === 'currentTime') return 170; // 130 seconds behind
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('-2:10');
  });

  it('should display negative time with hours when very far behind live edge', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 10000 };
      if (key === 'currentTime') return 2335; // 7665 seconds behind = 2:07:45
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('-2:07:45');
  });

  // --- State transitions ---

  it('should switch from VOD to live display when state changes', () => {
    // Start in VOD mode
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('1:05 / 1:01:05');

    // Switch to live
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 100 };
      if (key === 'currentTime') return 100;
      return null;
    });

    timeDisplay.update();
    expect(el.textContent).toBe('LIVE');
  });

  it('should switch from live to VOD display when state changes', () => {
    // Start in live mode
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 100 };
      if (key === 'currentTime') return 100;
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('LIVE');

    // Switch to VOD
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return false;
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 60;
      return null;
    });

    timeDisplay.update();
    expect(el.textContent).toBe('0:30 / 1:00');
  });

  // --- Edge Cases ---

  it('should handle zero-second edge case in live mode (behind by < 1 second)', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 0, end: 100 };
      if (key === 'currentTime') return 99.5; // 0.5 seconds behind
      return null;
    });

    timeDisplay.update();
    const el = timeDisplay.render();
    // formatLiveTime(0.5) => behindLive > 0, so "-0:00"
    expect(el.textContent).toBe('-0:00');
  });

  // --- Cleanup ---

  it('should not leave stale content after destroy and re-create', () => {
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('1:05 / 1:01:05');

    timeDisplay.destroy();

    // Create a new instance
    const newTimeDisplay = new TimeDisplay(api);
    const newEl = newTimeDisplay.render();
    // New instance should start with empty content (no update called yet)
    expect(newEl.textContent).toBe('');
    newTimeDisplay.destroy();
  });
});
