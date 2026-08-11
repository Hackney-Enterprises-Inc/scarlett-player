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

  // --- Keyboard Interactions ---

  it('should seek forward 5 seconds on ArrowRight key', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // currentTime was 30, should be 35 after ArrowRight
    expect(video.currentTime).toBe(35);
  });

  it('should seek backward 5 seconds on ArrowLeft key', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    // currentTime was 30, should be 25 after ArrowLeft
    expect(video.currentTime).toBe(25);
  });

  it('should not seek below 0 on ArrowLeft key', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 2;
      if (key === 'duration') return 100;
      return null;
    });
    // Also set the video element's currentTime
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 2, writable: true, configurable: true });

    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(video.currentTime).toBe(0);
  });

  it('should not seek past duration on ArrowRight key', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 97;
      if (key === 'duration') return 100;
      return null;
    });
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 97, writable: true, configurable: true });

    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(video.currentTime).toBe(100);
  });

  it('should seek to 0 on Home key', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(video.currentTime).toBe(0);
  });

  it('should seek to end on End key', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(video.currentTime).toBe(100);
  });

  // --- Edge Cases ---

  it('should handle zero duration without errors', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 0;
      if (key === 'duration') return 0;
      return null;
    });

    expect(() => progressBar.update()).not.toThrow();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;
    // With zero duration the else-if branch is skipped, filled width stays at default
    expect(filled.style.width).toBe('');
  });

  it('should handle NaN currentTime gracefully', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return NaN;
      if (key === 'duration') return 100;
      return null;
    });

    expect(() => progressBar.update()).not.toThrow();
  });

  it('should set aria-valuetext to formatted time in VOD mode', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'currentTime') return 65;
      if (key === 'duration') return 3600;
      if (key === 'live') return false;
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    expect(el.getAttribute('aria-valuetext')).toBe('1:05');
  });

  it('should update handle position matching filled width', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;
    const handle = wrapper.querySelector('.sp-progress__handle') as HTMLElement;

    expect(filled.style.width).toBe('30%');
    expect(handle.style.left).toBe('30%');
  });

  it('should have aria-valuemin of 0', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress');
    expect(el?.getAttribute('aria-valuemin')).toBe('0');
  });

  it('should initialize tooltip with 0:00', () => {
    const wrapper = progressBar.render();
    const tooltip = wrapper.querySelector('.sp-progress__tooltip') as HTMLElement;
    expect(tooltip.textContent).toBe('0:00');
  });

  // --- Mouse Interactions ---

  it('should add dragging class on mousedown', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));

    expect(el.classList.contains('sp-progress--dragging')).toBe(true);
  });

  it('should remove dragging class on mouseup', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
    expect(el.classList.contains('sp-progress--dragging')).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 50 }));
    expect(el.classList.contains('sp-progress--dragging')).toBe(false);
  });

  it('should hide tooltip on mouse leave when not dragging', () => {
    const wrapper = progressBar.render();
    const tooltip = wrapper.querySelector('.sp-progress__tooltip') as HTMLElement;

    wrapper.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(tooltip.style.opacity).toBe('0');
  });

  // --- Show / Hide ---

  it('should add visible class on show()', () => {
    const wrapper = progressBar.render();
    progressBar.show();
    expect(wrapper.classList.contains('sp-progress-wrapper--visible')).toBe(true);
  });

  it('should remove visible class on hide()', () => {
    const wrapper = progressBar.render();
    progressBar.show();
    progressBar.hide();
    expect(wrapper.classList.contains('sp-progress-wrapper--visible')).toBe(false);
  });

  // --- Cleanup ---

  it('should remove document-level event listeners on destroy', () => {
    progressBar.render();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    progressBar.destroy();

    const removedEvents = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('mouseup');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
    expect(removedEvents).toContain('touchcancel');

    removeSpy.mockRestore();
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

  // --- Keyboard Interactions in Live DVR ---

  it('should seek forward 5 seconds on ArrowRight, constrained to seekable range end', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // currentTime was 100, should be 105 (within 50..150 range)
    expect(video.currentTime).toBe(105);
  });

  it('should seek backward 5 seconds on ArrowLeft, constrained to seekable range start', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    // currentTime was 100, should be 95 (within 50..150 range)
    expect(video.currentTime).toBe(95);
  });

  it('should clamp ArrowLeft to seekable range start', () => {
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', {
      get: () => 52,
      set: vi.fn((v) => {
        Object.defineProperty(video, 'currentTime', { value: v, writable: true, configurable: true });
      }),
      configurable: true,
    });

    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    // 52 - 5 = 47, clamped to start=50
    expect(video.currentTime).toBe(50);
  });

  it('should clamp ArrowRight to seekable range end', () => {
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', {
      get: () => 148,
      set: vi.fn((v) => {
        Object.defineProperty(video, 'currentTime', { value: v, writable: true, configurable: true });
      }),
      configurable: true,
    });

    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // 148 + 5 = 153, clamped to end=150
    expect(video.currentTime).toBe(150);
  });

  it('should seek to seekable range start on Home key in live DVR', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(video.currentTime).toBe(50);
  });

  it('should seek to seekable range end (live edge) on End key in live DVR', () => {
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;
    const video = api.container.querySelector('video')!;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(video.currentTime).toBe(150);
  });

  it('should set aria-valuemax to seekable range end', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    expect(el.getAttribute('aria-valuemax')).toBe('150');
  });

  it('should set aria-valuenow to current time in live DVR', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const el = wrapper.querySelector('.sp-progress') as HTMLElement;

    expect(el.getAttribute('aria-valuenow')).toBe('100');
  });

  it('should update handle position matching filled in live mode', () => {
    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;
    const handle = wrapper.querySelector('.sp-progress__handle') as HTMLElement;

    expect(filled.style.width).toBe('50%');
    expect(handle.style.left).toBe('50%');
  });

  it('should clamp filled width to 0-100% range for live mode', () => {
    // currentTime before seekable range start
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'live') return true;
      if (key === 'seekableRange') return { start: 50, end: 150 };
      if (key === 'currentTime') return 30; // before start
      return null;
    });

    progressBar.update();
    const wrapper = progressBar.render();
    const filled = wrapper.querySelector('.sp-progress__filled') as HTMLElement;

    // (30-50)/(150-50) = -20%, clamped to 0%
    expect(filled.style.width).toBe('0%');
  });

  describe('chapter markers', () => {
    const CHAPTERS = [
      { time: 0, label: 'Preshow' },
      { time: 25, label: 'Fight 1' },
      { time: 50, label: 'Fight 2' },
    ];

    /** Build a bar whose state also carries chapters. */
    function withChapters(chapters: unknown, overrides: Record<string, unknown> = {}) {
      const chapterApi = createMockApi({ chapters, ...overrides });
      const bar = new ProgressBar(chapterApi);
      bar.update();
      return { api: chapterApi, bar };
    }

    it('renders one marker per chapter', () => {
      const { bar } = withChapters(CHAPTERS);

      // The chapter at 0 is deliberately skipped: a divider on the left edge is
      // a smudge, not information.
      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(2);
      bar.destroy();
    });

    it('positions markers as a percentage of duration', () => {
      const { bar } = withChapters(CHAPTERS);
      const markers = bar.render().querySelectorAll('.sp-progress__marker');

      expect((markers[0] as HTMLElement).style.left).toBe('25%');
      expect((markers[1] as HTMLElement).style.left).toBe('50%');
      bar.destroy();
    });

    it('renders nothing when there are no chapters', () => {
      const { bar } = withChapters([]);

      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(0);
      bar.destroy();
    });

    it('survives chapters state being absent entirely', () => {
      progressBar.update();

      expect(progressBar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(0);
    });

    it('drops markers that fall outside the timeline', () => {
      const { bar } = withChapters([
        { time: 25, label: 'inside' },
        { time: 500, label: 'past the end' },
      ]);

      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(1);
      bar.destroy();
    });

    it('does not rebuild the marker layer on every update', () => {
      const { bar } = withChapters(CHAPTERS);
      const first = bar.render().querySelector('.sp-progress__marker');

      bar.update();
      bar.update();

      expect(bar.render().querySelector('.sp-progress__marker')).toBe(first);
      bar.destroy();
    });

    it('clears markers when the chapter list is emptied', () => {
      const { api: chapterApi, bar } = withChapters(CHAPTERS);
      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(2);

      (chapterApi.getState as any).mockImplementation((key: string) => {
        if (key === 'chapters') return [];
        if (key === 'duration') return 100;
        return null;
      });
      bar.update();

      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(0);
      bar.destroy();
    });

    it('places markers relative to the DVR window on live media', () => {
      const { bar } = withChapters([{ time: 150, label: 'mid window' }], {
        live: true,
        seekableRange: { start: 100, end: 300 },
      });

      // (150-100)/(300-100) = 25%
      expect((bar.render().querySelector('.sp-progress__marker') as HTMLElement).style.left).toBe(
        '25%'
      );
      bar.destroy();
    });

    it('renders no markers on live media with no DVR window', () => {
      const { bar } = withChapters(CHAPTERS, { live: true, seekableRange: null });

      expect(bar.render().querySelectorAll('.sp-progress__marker')).toHaveLength(0);
      bar.destroy();
    });

    it('names the chapter under the cursor in the tooltip', () => {
      const { bar } = withChapters(CHAPTERS);
      const wrapper = bar.render();
      const el = wrapper.querySelector('.sp-progress') as HTMLElement;
      el.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

      wrapper.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, bubbles: true }));

      const chapterLabel = wrapper.querySelector('.sp-progress__tooltip-chapter');
      expect(chapterLabel?.textContent).toBe('Fight 1');
      bar.destroy();
    });

    it('leaves the tooltip alone in a gap between sparse chapters', () => {
      const { bar } = withChapters([
        { time: 10, label: 'Fight 1', endTime: 20 },
        { time: 80, label: 'Fight 2' },
      ]);
      const wrapper = bar.render();
      const el = wrapper.querySelector('.sp-progress') as HTMLElement;
      el.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

      wrapper.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, bubbles: true }));

      expect(wrapper.querySelector('.sp-progress__tooltip-chapter')).toBeNull();
      bar.destroy();
    });
  });
});
