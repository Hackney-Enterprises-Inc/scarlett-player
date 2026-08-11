/**
 * Types for the Chapters Plugin.
 */

import type { Chapter } from '@scarlett-player/core';

/**
 * Configuration for the Chapters Plugin.
 *
 * Supply exactly one source. `chapters` wins if both are given, because an
 * inline list is unambiguous and a fetch is not.
 */
export interface ChaptersPluginConfig {
  /**
   * Chapter list, already in memory. This is the path an app uses when its own
   * API already returns chapter data alongside the media URL.
   */
  chapters?: Chapter[];

  /**
   * URL of a WebVTT chapters file. Loaded through a `<track kind="chapters">`
   * element so the browser parses it, exactly how the captions plugin handles
   * subtitles. Cross-origin URLs need CORS, same as any text track.
   */
  src?: string;

  /**
   * Seek to the start of the previous chapter rather than the current one when
   * the playhead is within this many seconds of the current chapter's start.
   *
   * Matches how a music player's "previous track" button behaves: pressed once
   * it restarts the chapter, pressed again straight away it goes back one.
   *
   * @defaultValue 3
   */
  previousThreshold?: number;
}

/** Normalised chapter with a resolved end time, used internally. */
export interface ResolvedChapter extends Chapter {
  /** Always present after normalisation. Infinity for an open-ended last chapter. */
  endTime: number;
}
