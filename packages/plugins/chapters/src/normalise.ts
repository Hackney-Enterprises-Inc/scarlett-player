/**
 * Chapter list normalisation and lookup.
 *
 * Kept free of DOM and player APIs so the rules are testable on their own.
 */

import type { Chapter } from '@scarlett-player/core';
import type { ResolvedChapter } from './types';

/**
 * Sort chapters by start time and resolve every end time.
 *
 * An explicit `endTime` is honoured, which is what keeps sparse chapters sparse:
 * dead air between two fights belongs to neither. Without one, a chapter runs
 * until the next chapter starts, and the last runs to Infinity so it stays
 * correct for live media whose duration is unknown or still growing.
 *
 * Invalid entries are dropped rather than throwing: a bad chapter should cost a
 * marker, not the whole playback session.
 *
 * @param chapters - Raw chapter list, in any order
 * @returns Sorted, end-resolved chapters
 */
export function normaliseChapters(chapters: readonly Chapter[]): ResolvedChapter[] {
  const valid = chapters.filter(
    (chapter) =>
      chapter &&
      typeof chapter.time === 'number' &&
      Number.isFinite(chapter.time) &&
      chapter.time >= 0
  );

  const sorted = [...valid].sort((a, b) => a.time - b.time);

  return sorted.map((chapter, index) => {
    const next = sorted[index + 1];
    const implicitEnd = next ? next.time : Infinity;
    const explicitEnd = chapter.endTime;

    // An explicit end past the next chapter's start would make the two overlap,
    // and overlapping segments paint on top of each other. Clamp instead.
    const endTime =
      typeof explicitEnd === 'number' && Number.isFinite(explicitEnd) && explicitEnd > chapter.time
        ? Math.min(explicitEnd, implicitEnd)
        : implicitEnd;

    return { ...chapter, endTime };
  });
}

/**
 * Find the chapter holding a point on the timeline.
 *
 * @param chapters - Normalised chapters, sorted by start time
 * @param time - Playhead position in seconds
 * @returns Index into `chapters`, or -1 when the time falls in a gap or before the first chapter
 */
export function chapterIndexAt(chapters: readonly ResolvedChapter[], time: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    const chapter = chapters[i];
    if (time >= chapter.time && time < chapter.endTime) {
      return i;
    }
  }

  return -1;
}

/**
 * Index of the chapter a "next chapter" press should land on.
 *
 * @param chapters - Normalised chapters
 * @param time - Playhead position in seconds
 * @returns Index, or -1 when the playhead is already in or past the last chapter
 */
export function nextChapterIndex(chapters: readonly ResolvedChapter[], time: number): number {
  const index = chapters.findIndex((chapter) => chapter.time > time);

  return index;
}

/**
 * Index of the chapter a "previous chapter" press should land on.
 *
 * Restarts the current chapter unless the playhead is still near its start, in
 * which case it steps back one. A press from a gap goes to the chapter before
 * the gap.
 *
 * @param chapters - Normalised chapters
 * @param time - Playhead position in seconds
 * @param threshold - Seconds from a chapter start that count as "just started"
 * @returns Index, or -1 when there is nothing behind the playhead
 */
export function previousChapterIndex(
  chapters: readonly ResolvedChapter[],
  time: number,
  threshold: number
): number {
  const current = chapterIndexAt(chapters, time);

  if (current === -1) {
    // In a gap or ahead of the list: go to the last chapter that has started.
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].time <= time) {
        return i;
      }
    }

    return -1;
  }

  const elapsed = time - chapters[current].time;

  return elapsed <= threshold && current > 0 ? current - 1 : current;
}
