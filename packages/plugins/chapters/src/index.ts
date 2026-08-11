/**
 * Chapters Plugin for Scarlett Player
 *
 * Turns a long recording into something navigable. A three hour fight card is
 * unusable with a scrubber alone: chapters put every fight one click away, on
 * the progress bar and in a list.
 *
 * Reads and writes the chapter contract core already defines - the `chapters`
 * and `currentChapter` state keys and the `chapter:loaded` / `chapter:change` /
 * `chapter:select` events - so a host that only wants markers can set
 * `chapters` state directly and never install this plugin. What this adds is
 * loading, boundary tracking, the chapter list UI and seek helpers.
 *
 * @example
 * ```ts
 * import { createChaptersPlugin } from '@scarlett-player/chapters';
 *
 * const player = new ScarlettPlayer({
 *   container: '#player',
 *   plugins: [
 *     uiPlugin({ controls: ['play', 'chapters', 'time', 'spacer', 'fullscreen'] }),
 *     createChaptersPlugin({
 *       chapters: [
 *         { time: 0, label: 'Preshow' },
 *         { time: 480, label: 'Alvarez vs Reyes', subtitle: 'Lightweight' },
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */

import type { Chapter, IPluginAPI, Plugin, PluginType } from '@scarlett-player/core';
import type { ChaptersPluginConfig, ResolvedChapter } from './types';
import {
  chapterIndexAt,
  nextChapterIndex,
  normaliseChapters,
  previousChapterIndex,
} from './normalise';
import { loadChaptersFromTrack } from './vtt';
import { ChapterList } from './ChapterList';
import { styles } from './styles';

export type { ChaptersPluginConfig, ResolvedChapter } from './types';
export {
  chapterIndexAt,
  nextChapterIndex,
  normaliseChapters,
  previousChapterIndex,
} from './normalise';

const STYLE_ID = 'sp-chapters-styles';
const DEFAULT_PREVIOUS_THRESHOLD = 3;

/** Public surface, for hosts that want to drive chapter navigation themselves. */
export interface ChaptersPlugin extends Plugin {
  /** Replace the chapter list at runtime, for example after a source change. */
  setChapters(chapters: Chapter[]): void;
  /** The chapter list as the plugin sees it, end times resolved. */
  getChapters(): ResolvedChapter[];
  /** Seek to a chapter by index. Out of range indexes are ignored. */
  seekToChapter(index: number): void;
  /** Seek to the next chapter. No-op when the playhead is in the last one. */
  next(): void;
  /** Restart the current chapter, or step back one when it just started. */
  previous(): void;
}

/**
 * Create a Chapters Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Chapters Plugin instance
 */
export function createChaptersPlugin(config: ChaptersPluginConfig = {}): ChaptersPlugin {
  let api: IPluginAPI | null = null;
  let chapters: ResolvedChapter[] = [];
  let activeIndex = -1;
  let list: ChapterList | null = null;
  let styleEl: HTMLStyleElement | null = null;
  let trackCleanup: (() => void) | null = null;

  const previousThreshold = config.previousThreshold ?? DEFAULT_PREVIOUS_THRESHOLD;

  /**
   * Publish a new list to state and announce it.
   *
   * Boundary tracking is reset rather than preserved: after a source change the
   * old active index means nothing, and emitting a change from it would report
   * a chapter the viewer was never in.
   */
  const publish = (next: Chapter[]): void => {
    chapters = normaliseChapters(next);
    activeIndex = -1;

    if (!api) return;

    api.setState('chapters', chapters);
    api.setState('currentChapter', null);
    api.emit('chapter:loaded', { chapters });
    list?.setChapters(chapters);

    // A list arriving mid-playback should light up the chapter under the
    // playhead straight away rather than waiting for the next boundary.
    syncActive();
  };

  /** Recompute the active chapter and emit when it changed. */
  const syncActive = (): void => {
    if (!api) return;

    const currentTime = (api.getState('currentTime') as number | undefined) ?? 0;
    const index = chapterIndexAt(chapters, currentTime);

    if (index === activeIndex) return;

    const previous = activeIndex === -1 ? null : (chapters[activeIndex] ?? null);
    const chapter = index === -1 ? null : (chapters[index] ?? null);

    activeIndex = index;
    api.setState('currentChapter', chapter);
    api.emit('chapter:change', { chapter, previous });
    list?.setActiveIndex(index);
  };

  /**
   * Seek, clamped to what the media allows.
   *
   * Live DVR is clamped to the seekable range rather than to duration, which is
   * Infinity for a live stream and would let a chapter seek run off the edge.
   */
  const seekTo = (time: number): void => {
    if (!api) return;

    const video = api.container.querySelector('video');
    if (!video) return;

    const live = api.getState('live');
    const seekableRange = api.getState('seekableRange');

    if (live && seekableRange) {
      video.currentTime = Math.max(seekableRange.start, Math.min(seekableRange.end, time));
      return;
    }

    const duration = video.duration;
    const upperBound = Number.isFinite(duration) && duration > 0 ? duration : null;

    video.currentTime = upperBound === null ? Math.max(0, time) : Math.max(0, Math.min(upperBound, time));
  };

  const seekToChapter = (index: number): void => {
    const chapter = chapters[index];
    if (!chapter || !api) return;

    seekTo(chapter.time);
    api.emit('chapter:select', { chapter });

    // Seeking does not guarantee a timeupdate before the next paint, and a
    // chapter list that lags a click feels broken.
    syncActive();
  };

  return {
    id: 'chapters',
    name: 'Chapters',
    version: '1.0.0',
    type: 'feature' as PluginType,

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;

      if (!document.getElementById(STYLE_ID)) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }

      list = new ChapterList({
        onSelect: (index) => seekToChapter(index),
      });

      // Registering does not place the control anywhere - the host opts in by
      // listing 'chapters' in its control layout. Runtime import so a headless
      // host never needs @scarlett-player/ui installed.
      void import('@scarlett-player/ui')
        .then(({ registerControl }) => {
          registerControl('chapters', (controlApi) => {
            list?.attach(controlApi);
            return list as unknown as ReturnType<Parameters<typeof registerControl>[1]>;
          });
        })
        .catch(() => {
          api?.logger.debug('@scarlett-player/ui not present, chapters control not registered');
        });

      if (config.chapters?.length) {
        publish(config.chapters);
      } else if (config.src) {
        trackCleanup = loadChaptersFromTrack(api.container, config.src, {
          onLoad: (loaded) => publish(loaded),
          onError: (message) => api?.logger.warn(`[chapters] ${message}`),
        });
      }

      const unsubscribe = api.subscribeToState((event) => {
        if (event.key === 'currentTime') {
          syncActive();
        }
      });

      api.onDestroy(() => {
        unsubscribe();
        trackCleanup?.();
        trackCleanup = null;
      });
    },

    destroy(): void {
      trackCleanup?.();
      trackCleanup = null;
      list?.destroy();
      list = null;
      styleEl?.remove();
      styleEl = null;
      chapters = [];
      activeIndex = -1;
      api = null;
    },

    setChapters(next: Chapter[]): void {
      publish(next);
    },

    getChapters(): ResolvedChapter[] {
      return chapters;
    },

    seekToChapter,

    next(): void {
      if (!api) return;

      const currentTime = (api.getState('currentTime') as number | undefined) ?? 0;
      const index = nextChapterIndex(chapters, currentTime);
      if (index !== -1) {
        seekToChapter(index);
      }
    },

    previous(): void {
      if (!api) return;

      const currentTime = (api.getState('currentTime') as number | undefined) ?? 0;
      const index = previousChapterIndex(chapters, currentTime, previousThreshold);
      if (index !== -1) {
        seekToChapter(index);
      }
    },
  };
}

export default createChaptersPlugin;
