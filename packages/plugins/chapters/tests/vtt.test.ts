/**
 * WebVTT chapter loading.
 *
 * jsdom cannot parse a real VTT file, so the track element is stood in for.
 * That is enough to pin down what actually goes wrong here: delivering the same
 * chapter list twice when a cached track is already parsed before we look.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chaptersFromCues, loadChaptersFromTrack } from '../src/vtt';

/** Minimal stand-in for a parsed cue list. */
function cueList(cues: Array<{ startTime: number; endTime: number; text: string }>) {
  return Object.assign([...cues], { length: cues.length }) as unknown as TextTrackCueList;
}

/**
 * Replace document.createElement for 'track' with an element whose `track`
 * property is ours, since jsdom's is a read-only getter that never populates.
 */
function stubTrackElement(track: unknown): HTMLElement {
  const trackEl = document.createElement('span');
  Object.defineProperty(trackEl, 'track', { value: track, configurable: true });
  Object.defineProperty(trackEl, 'kind', { value: '', writable: true });
  Object.defineProperty(trackEl, 'default', { value: false, writable: true });

  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...rest: unknown[]) =>
    tag === 'track' ? (trackEl as never) : (original(tag as never, ...(rest as never[])) as never)
  );

  return trackEl;
}

describe('chaptersFromCues', () => {
  it('maps cues to chapters', () => {
    const chapters = chaptersFromCues(
      cueList([
        { startTime: 0, endTime: 60, text: 'Preshow' },
        { startTime: 60, endTime: 120, text: 'Fight 1' },
      ])
    );

    expect(chapters).toEqual([
      { time: 0, endTime: 60, label: 'Preshow' },
      { time: 60, endTime: 120, label: 'Fight 1' },
    ]);
  });

  it('drops a non-finite end time rather than passing Infinity along', () => {
    const chapters = chaptersFromCues(cueList([{ startTime: 0, endTime: Infinity, text: 'Live' }]));

    expect(chapters[0].endTime).toBeUndefined();
  });

  it('returns an empty list for no cues', () => {
    expect(chaptersFromCues(cueList([]))).toEqual([]);
  });
});

describe('loadChaptersFromTrack', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.appendChild(document.createElement('video'));
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an error when there is no media element to attach to', () => {
    const onError = vi.fn();
    const empty = document.createElement('div');

    loadChaptersFromTrack(empty, '/chapters.vtt', { onLoad: vi.fn(), onError });

    expect(onError).toHaveBeenCalledWith('no media element to attach a chapters track to');
  });

  it('delivers chapters from a track that was already parsed', () => {
    stubTrackElement({ mode: 'disabled', cues: cueList([{ startTime: 0, endTime: 30, text: 'A' }]) });
    const onLoad = vi.fn();

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad, onError: vi.fn() });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith([{ time: 0, endTime: 30, label: 'A' }]);
  });

  it('delivers once when the load event follows an already parsed track', () => {
    const trackEl = stubTrackElement({
      mode: 'disabled',
      cues: cueList([{ startTime: 0, endTime: 30, text: 'A' }]),
    });
    const onLoad = vi.fn();

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad, onError: vi.fn() });
    trackEl.dispatchEvent(new Event('load'));

    // The whole point of the latch: a cached track parsed before we looked used
    // to publish the list twice, once here and once on the event.
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('waits for the load event when the track is not parsed yet', () => {
    const track: { mode: string; cues: TextTrackCueList | null } = {
      mode: 'disabled',
      cues: cueList([]),
    };
    const trackEl = stubTrackElement(track);
    const onLoad = vi.fn();

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad, onError: vi.fn() });
    expect(onLoad).not.toHaveBeenCalled();

    track.cues = cueList([{ startTime: 5, endTime: 10, text: 'Late' }]);
    trackEl.dispatchEvent(new Event('load'));

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith([{ time: 5, endTime: 10, label: 'Late' }]);
  });

  it('reports a load failure once', () => {
    const trackEl = stubTrackElement({ mode: 'disabled', cues: cueList([]) });
    const onError = vi.fn();

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad: vi.fn(), onError });
    trackEl.dispatchEvent(new Event('error'));
    trackEl.dispatchEvent(new Event('error'));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('failed to load chapters from /chapters.vtt');
  });

  it('does not report an error after chapters already arrived', () => {
    const trackEl = stubTrackElement({
      mode: 'disabled',
      cues: cueList([{ startTime: 0, endTime: 30, text: 'A' }]),
    });
    const onError = vi.fn();

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad: vi.fn(), onError });
    trackEl.dispatchEvent(new Event('error'));

    expect(onError).not.toHaveBeenCalled();
  });

  it('sets the track to hidden so the browser parses without rendering', () => {
    const track = { mode: 'disabled', cues: cueList([]) };
    stubTrackElement(track);

    loadChaptersFromTrack(container, '/chapters.vtt', { onLoad: vi.fn(), onError: vi.fn() });

    expect(track.mode).toBe('hidden');
  });

  it('removes the track and stops listening on cleanup', () => {
    const trackEl = stubTrackElement({ mode: 'disabled', cues: cueList([]) });
    const onLoad = vi.fn();

    const cleanup = loadChaptersFromTrack(container, '/chapters.vtt', {
      onLoad,
      onError: vi.fn(),
    });
    cleanup();
    trackEl.dispatchEvent(new Event('load'));

    expect(onLoad).not.toHaveBeenCalled();
    expect(container.querySelector('video')?.contains(trackEl)).toBe(false);
  });
});
