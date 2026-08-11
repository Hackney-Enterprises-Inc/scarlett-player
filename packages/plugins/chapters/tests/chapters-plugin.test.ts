/**
 * Tests for the Chapters Plugin.
 *
 * The behaviour that matters to a viewer: the right chapter is marked active,
 * a seek lands where the chapter starts, and none of it breaks on live media
 * where duration is Infinity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChaptersPlugin } from '../src/index';
import { formatChapterTime } from '../src/ChapterList';

const CHAPTERS = [
  { time: 0, label: 'Preshow' },
  { time: 60, label: 'Fight 1', subtitle: 'Lightweight' },
  { time: 120, label: 'Fight 2' },
];

type StateListener = (event: { key: string; value: unknown }) => void;

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    currentTime: 0,
    duration: 600,
    live: false,
    seekableRange: null,
    chapters: [],
    currentChapter: null,
    ...state,
  };

  const listeners: StateListener[] = [];

  const api = {
    pluginId: 'chapters',
    container,
    video,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((listener: StateListener) => {
      listeners.push(listener);
      return vi.fn();
    }),
    /** Move the playhead and fire the subscription the plugin listens on. */
    setTime(time: number) {
      store.currentTime = time;
      listeners.forEach((listener) => listener({ key: 'currentTime', value: time }));
    },
    store,
  };

  return api;
}

describe('createChaptersPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes the configured chapters to state', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });

    plugin.init(api as never);

    expect(api.setState).toHaveBeenCalledWith('chapters', expect.any(Array));
    expect(plugin.getChapters()).toHaveLength(3);
    expect(plugin.getChapters()[0].endTime).toBe(60);
  });

  it('emits chapter:loaded with the resolved list', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });

    plugin.init(api as never);

    expect(api.emit).toHaveBeenCalledWith('chapter:loaded', {
      chapters: expect.arrayContaining([expect.objectContaining({ label: 'Preshow' })]),
    });
  });

  it('marks the chapter under the playhead active on load', () => {
    const api = createMockApi({ currentTime: 70 });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });

    plugin.init(api as never);

    expect(api.setState).toHaveBeenCalledWith(
      'currentChapter',
      expect.objectContaining({ label: 'Fight 1' })
    );
  });

  it('emits chapter:change when the playhead crosses a boundary', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);
    api.emit.mockClear();

    api.setTime(65);

    expect(api.emit).toHaveBeenCalledWith('chapter:change', {
      chapter: expect.objectContaining({ label: 'Fight 1' }),
      previous: expect.objectContaining({ label: 'Preshow' }),
    });
  });

  it('does not re-emit while the playhead stays inside one chapter', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    api.setTime(65);
    api.emit.mockClear();
    api.setTime(70);
    api.setTime(80);

    expect(api.emit).not.toHaveBeenCalledWith('chapter:change', expect.anything());
  });

  it('reports a single change when a seek crosses several boundaries at once', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);
    api.emit.mockClear();

    api.setTime(150);

    const changes = api.emit.mock.calls.filter(([event]) => event === 'chapter:change');
    expect(changes).toHaveLength(1);
    expect(changes[0][1]).toEqual({
      chapter: expect.objectContaining({ label: 'Fight 2' }),
      previous: expect.objectContaining({ label: 'Preshow' }),
    });
  });

  it('seeks the media element to the chapter start', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.seekToChapter(2);

    expect(api.video.currentTime).toBe(120);
  });

  it('emits chapter:select when a chapter is picked', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);
    api.emit.mockClear();

    plugin.seekToChapter(1);

    expect(api.emit).toHaveBeenCalledWith('chapter:select', {
      chapter: expect.objectContaining({ label: 'Fight 1' }),
    });
  });

  it('ignores a seek to an index that does not exist', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.seekToChapter(99);

    expect(api.video.currentTime).toBe(0);
  });

  it('next() moves to the following chapter', () => {
    const api = createMockApi({ currentTime: 10 });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.next();

    expect(api.video.currentTime).toBe(60);
  });

  it('next() is inert inside the last chapter', () => {
    const api = createMockApi({ currentTime: 300 });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.next();

    expect(api.video.currentTime).toBe(0);
  });

  it('previous() restarts the current chapter, then steps back', () => {
    const api = createMockApi({ currentTime: 100 });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.previous();
    expect(api.video.currentTime).toBe(60);

    api.store.currentTime = 61;
    plugin.previous();
    expect(api.video.currentTime).toBe(0);
  });

  it('clamps a chapter seek to the live seekable range', () => {
    const api = createMockApi({
      live: true,
      seekableRange: { start: 200, end: 400 },
    });
    const plugin = createChaptersPlugin({
      chapters: [{ time: 0, label: 'Way behind the window' }],
    });
    plugin.init(api as never);

    plugin.seekToChapter(0);

    expect(api.video.currentTime).toBe(200);
  });

  it('does not clamp against a non-finite duration', () => {
    const api = createMockApi();
    Object.defineProperty(api.video, 'duration', { value: Infinity, configurable: true });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    plugin.seekToChapter(2);

    expect(api.video.currentTime).toBe(120);
  });

  it('setChapters replaces the list and resets tracking', () => {
    const api = createMockApi({ currentTime: 70 });
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);
    api.emit.mockClear();

    plugin.setChapters([{ time: 0, label: 'Only one' }]);

    expect(plugin.getChapters()).toHaveLength(1);
    expect(api.emit).toHaveBeenCalledWith('chapter:change', {
      chapter: expect.objectContaining({ label: 'Only one' }),
      previous: null,
    });
  });

  it('handles an empty chapter list without touching state', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({});
    plugin.init(api as never);

    expect(plugin.getChapters()).toEqual([]);
    expect(api.emit).not.toHaveBeenCalledWith('chapter:loaded', expect.anything());
  });

  it('injects its stylesheet once per document', () => {
    const first = createMockApi();
    const second = createMockApi();

    createChaptersPlugin({ chapters: CHAPTERS }).init(first as never);
    createChaptersPlugin({ chapters: CHAPTERS }).init(second as never);

    expect(document.querySelectorAll('#sp-chapters-styles')).toHaveLength(1);
  });

  it('cleans up its stylesheet on destroy', () => {
    const api = createMockApi();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });

    plugin.init(api as never);
    plugin.destroy();

    expect(document.getElementById('sp-chapters-styles')).toBeNull();
    expect(plugin.getChapters()).toEqual([]);
  });

  it('survives a chapter seek when the container has no media element', () => {
    const api = createMockApi();
    api.container.querySelector('video')?.remove();
    const plugin = createChaptersPlugin({ chapters: CHAPTERS });
    plugin.init(api as never);

    expect(() => plugin.seekToChapter(1)).not.toThrow();
  });
});

describe('formatChapterTime', () => {
  it('uses m:ss below an hour', () => {
    expect(formatChapterTime(75)).toBe('1:15');
  });

  it('uses h:mm:ss at an hour and beyond, which event VODs always reach', () => {
    expect(formatChapterTime(3725)).toBe('1:02:05');
  });

  it('pads seconds', () => {
    expect(formatChapterTime(65)).toBe('1:05');
  });

  it('treats unusable input as zero', () => {
    expect(formatChapterTime(Number.NaN)).toBe('0:00');
    expect(formatChapterTime(-10)).toBe('0:00');
  });
});
