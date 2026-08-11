/**
 * Chapter normalisation and lookup rules.
 *
 * These are the parts that decide whether a marker lands in the right place, so
 * they are tested without a DOM or a player.
 */

import { describe, it, expect } from 'vitest';
import {
  chapterIndexAt,
  nextChapterIndex,
  normaliseChapters,
  previousChapterIndex,
} from '../src/normalise';

describe('normaliseChapters', () => {
  it('sorts by start time', () => {
    const result = normaliseChapters([
      { time: 100, label: 'B' },
      { time: 0, label: 'A' },
      { time: 50, label: 'C' },
    ]);

    expect(result.map((c) => c.label)).toEqual(['A', 'C', 'B']);
  });

  it('fills each end time from the next start', () => {
    const result = normaliseChapters([
      { time: 0, label: 'A' },
      { time: 60, label: 'B' },
    ]);

    expect(result[0].endTime).toBe(60);
  });

  it('leaves the last chapter open ended so live media stays correct', () => {
    const result = normaliseChapters([{ time: 0, label: 'A' }]);

    expect(result[0].endTime).toBe(Infinity);
  });

  it('honours an explicit end time, which is what keeps sparse chapters sparse', () => {
    const result = normaliseChapters([
      { time: 0, label: 'Fight 3', endTime: 40 },
      { time: 100, label: 'Fight 4' },
    ]);

    // The dead air from 40 to 100 belongs to neither chapter.
    expect(result[0].endTime).toBe(40);
    expect(chapterIndexAt(result, 70)).toBe(-1);
  });

  it('clamps an explicit end that would overlap the next chapter', () => {
    const result = normaliseChapters([
      { time: 0, label: 'A', endTime: 500 },
      { time: 60, label: 'B' },
    ]);

    expect(result[0].endTime).toBe(60);
  });

  it('ignores an explicit end that is not after the start', () => {
    const result = normaliseChapters([
      { time: 30, label: 'A', endTime: 30 },
      { time: 90, label: 'B' },
    ]);

    expect(result[0].endTime).toBe(90);
  });

  it('drops entries with an unusable start time rather than throwing', () => {
    const result = normaliseChapters([
      { time: 0, label: 'A' },
      { time: Number.NaN, label: 'bad' },
      { time: -5, label: 'negative' },
      { time: Infinity, label: 'infinite' },
    ] as never);

    expect(result.map((c) => c.label)).toEqual(['A']);
  });

  it('returns an empty list for an empty input', () => {
    expect(normaliseChapters([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [
      { time: 100, label: 'B' },
      { time: 0, label: 'A' },
    ];
    normaliseChapters(input);

    expect(input.map((c) => c.label)).toEqual(['B', 'A']);
  });
});

describe('chapterIndexAt', () => {
  const chapters = normaliseChapters([
    { time: 0, label: 'A' },
    { time: 60, label: 'B' },
    { time: 120, label: 'C' },
  ]);

  it('finds the chapter holding the playhead', () => {
    expect(chapterIndexAt(chapters, 75)).toBe(1);
  });

  it('treats a start time as inside its own chapter', () => {
    expect(chapterIndexAt(chapters, 60)).toBe(1);
  });

  it('treats an end time as belonging to the next chapter', () => {
    expect(chapterIndexAt(chapters, 120)).toBe(2);
  });

  it('returns -1 before the first chapter starts', () => {
    const late = normaliseChapters([{ time: 30, label: 'A' }]);

    expect(chapterIndexAt(late, 10)).toBe(-1);
  });

  it('returns -1 for an empty list', () => {
    expect(chapterIndexAt([], 10)).toBe(-1);
  });
});

describe('nextChapterIndex', () => {
  const chapters = normaliseChapters([
    { time: 0, label: 'A' },
    { time: 60, label: 'B' },
    { time: 120, label: 'C' },
  ]);

  it('moves to the chapter after the playhead', () => {
    expect(nextChapterIndex(chapters, 10)).toBe(1);
  });

  it('returns -1 inside the last chapter', () => {
    expect(nextChapterIndex(chapters, 200)).toBe(-1);
  });

  it('skips forward from before the first chapter', () => {
    const late = normaliseChapters([{ time: 30, label: 'A' }]);

    expect(nextChapterIndex(late, 0)).toBe(0);
  });
});

describe('previousChapterIndex', () => {
  const chapters = normaliseChapters([
    { time: 0, label: 'A' },
    { time: 60, label: 'B' },
    { time: 120, label: 'C' },
  ]);

  it('restarts the current chapter when it has been playing a while', () => {
    expect(previousChapterIndex(chapters, 90, 3)).toBe(1);
  });

  it('steps back one when the current chapter just started', () => {
    expect(previousChapterIndex(chapters, 61, 3)).toBe(0);
  });

  it('stays on the first chapter rather than falling off the front', () => {
    expect(previousChapterIndex(chapters, 1, 3)).toBe(0);
  });

  it('goes back to the chapter before a gap', () => {
    const sparse = normaliseChapters([
      { time: 0, label: 'A', endTime: 30 },
      { time: 100, label: 'B' },
    ]);

    expect(previousChapterIndex(sparse, 60, 3)).toBe(0);
  });

  it('returns -1 when nothing has started yet', () => {
    const late = normaliseChapters([{ time: 30, label: 'A' }]);

    expect(previousChapterIndex(late, 10, 3)).toBe(-1);
  });
});
