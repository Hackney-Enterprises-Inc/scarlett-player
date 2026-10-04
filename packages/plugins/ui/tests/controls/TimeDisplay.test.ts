/**
 * TimeDisplay Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeDisplay } from '../../src/controls/TimeDisplay';
import type { MockPluginAPI } from '../mock-api';

function createMockApi(): MockPluginAPI {
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
    defineState: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
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

  /** Point the mock at a live stream; `liveEdge` is the plugin-owned edge flag. */
  function setLive(opts: {
    liveEdge: boolean;
    currentTime: number;
    seekableRange: { start: number; end: number } | null;
  }): void {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'liveEdge') return opts.liveEdge;
      if (key === 'seekableRange') return opts.seekableRange;
      if (key === 'currentTime') return opts.currentTime;
      return null;
    });
  }

  it('shows no time at the live edge, even though the edge sits behind the seekable end', () => {
    // hls.js holds playback a target latency behind seekableRange.end, so
    // the old readout counted "-0:18" while the viewer was live.
    setLive({ liveEdge: true, currentTime: 82, seekableRange: { start: 0, end: 100 } });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no time on live without a seekable range (WHEP, before the first playlist)', () => {
    setLive({ liveEdge: true, currentTime: 50, seekableRange: null });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('');
    expect(el.style.display).toBe('none');
  });

  it('shows no time when off the edge but the range is unknown', () => {
    // resetLiveMetrics() leaves liveEdge false with no range during a source change.
    setLive({ liveEdge: false, currentTime: 50, seekableRange: null });

    timeDisplay.update();
    expect(timeDisplay.render().textContent).toBe('');
  });

  it('shows the distance behind live once the viewer has scrubbed back', () => {
    setLive({ liveEdge: false, currentTime: 58, seekableRange: { start: 0, end: 100 } });

    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('-0:42');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('should display negative minutes:seconds when behind live edge', () => {
    setLive({ liveEdge: false, currentTime: 170, seekableRange: { start: 0, end: 300 } });

    timeDisplay.update();
    expect(timeDisplay.render().textContent).toBe('-2:10');
  });

  it('should display negative time with hours when very far behind live edge', () => {
    setLive({ liveEdge: false, currentTime: 2335, seekableRange: { start: 0, end: 10000 } });

    timeDisplay.update();
    expect(timeDisplay.render().textContent).toBe('-2:07:45');
  });

  it('never prints LIVE: a non-positive offset off the edge renders nothing', () => {
    setLive({ liveEdge: false, currentTime: 100, seekableRange: { start: 0, end: 100 } });

    timeDisplay.update();
    expect(timeDisplay.render().textContent).toBe('');
  });

  it('keeps its slot while a DVR stream sits at the edge, so scrubbing back does not shift the bar', () => {
    setLive({ liveEdge: true, currentTime: 95, seekableRange: { start: 0, end: 100 } });
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.style.display).toBe('');
    expect(el.classList.contains('sp-time--live')).toBe(true);

    setLive({ liveEdge: false, currentTime: 58, seekableRange: { start: 0, end: 100 } });
    timeDisplay.update();
    expect(el.style.display).toBe('');
    expect(el.classList.contains('sp-time--live')).toBe(true);
    expect(el.textContent).toBe('-0:42');

    setLive({ liveEdge: true, currentTime: 95, seekableRange: { start: 0, end: 100 } });
    timeDisplay.update();
    expect(el.textContent).toBe('');
    expect(el.style.display).toBe('');
  });

  // --- State transitions ---

  it('should switch from VOD to live display when state changes', () => {
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('1:05 / 1:01:05');

    setLive({ liveEdge: true, currentTime: 100, seekableRange: { start: 0, end: 100 } });
    timeDisplay.update();
    expect(el.textContent).toBe('');
  });

  it('should switch from live to VOD display when state changes', () => {
    setLive({ liveEdge: false, currentTime: 40, seekableRange: { start: 0, end: 100 } });
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.textContent).toBe('-1:00');

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return false;
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 60;
      return null;
    });

    timeDisplay.update();
    expect(el.textContent).toBe('0:30 / 1:00');
    expect(el.classList.contains('sp-time--live')).toBe(false);
    expect(el.style.display).toBe('');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('restores a VOD readout after a WHEP stream hid the element', () => {
    setLive({ liveEdge: true, currentTime: 0, seekableRange: null });
    timeDisplay.update();
    const el = timeDisplay.render();
    expect(el.style.display).toBe('none');

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return false;
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 60;
      return null;
    });
    timeDisplay.update();
    expect(el.style.display).toBe('');
    expect(el.textContent).toBe('0:30 / 1:00');
  });

  // --- Edge Cases ---

  it('should handle zero-second edge case in live mode (behind by < 1 second)', () => {
    setLive({ liveEdge: false, currentTime: 99.5, seekableRange: { start: 0, end: 100 } });

    timeDisplay.update();
    // formatLiveTime(0.5) => behindLive > 0, so "-0:00"
    expect(timeDisplay.render().textContent).toBe('-0:00');
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
