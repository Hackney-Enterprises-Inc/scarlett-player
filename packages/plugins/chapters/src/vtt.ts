/**
 * WebVTT chapter loading.
 *
 * No parser here on purpose. The browser already ships a WebVTT parser, and the
 * captions plugin proved the approach: append a `<track>`, let the browser parse
 * it, read the cues. A `kind="chapters"` track is parsed and never rendered,
 * which is exactly the behaviour this needs.
 */

import type { Chapter } from '@scarlett-player/core';

/**
 * Convert parsed WebVTT cues into chapters.
 *
 * Split out from the loader so the mapping is testable without a browser that
 * can actually parse a VTT file, which jsdom cannot.
 *
 * @param cues - Cue list from a parsed text track
 * @returns Chapters in start order, as the browser reports them
 */
export function chaptersFromCues(cues: TextTrackCueList): Chapter[] {
  const chapters: Chapter[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i] as VTTCue;

    chapters.push({
      time: cue.startTime,
      // An open-ended cue reports Infinity, which is not a usable end time.
      endTime: Number.isFinite(cue.endTime) ? cue.endTime : undefined,
      label: cue.text,
    });
  }

  return chapters;
}

/** Callbacks for {@link loadChaptersFromTrack}. */
export interface LoadChaptersOptions {
  /** Called once with the parsed chapters. Not called when the track has no cues. */
  onLoad: (chapters: Chapter[]) => void;
  /** Called with a human-readable reason when the track cannot be used. */
  onError: (message: string) => void;
}

/**
 * Load chapters from a WebVTT file through a hidden text track.
 *
 * @param container - Player container, used to find the media element
 * @param src - URL of the WebVTT chapters file
 * @param options - Load and error callbacks
 * @returns Cleanup function that removes the track element and listeners
 */
export function loadChaptersFromTrack(
  container: HTMLElement,
  src: string,
  options: LoadChaptersOptions
): () => void {
  const media = container.querySelector('video, audio') as HTMLMediaElement | null;

  if (!media) {
    options.onError('no media element to attach a chapters track to');
    return () => {};
  }

  const trackEl = document.createElement('track');
  trackEl.kind = 'chapters';
  trackEl.src = src;
  trackEl.default = true;

  // A cached track can be parsed before this function runs, in which case the
  // synchronous read below delivers the chapters and the `load` event still
  // fires afterwards. Without this latch that is two `chapter:loaded` events and
  // two full republishes for one file.
  let settled = false;

  const read = (): void => {
    if (settled) return;

    const track = trackEl.track;
    if (!track) return;

    const cues = track.cues;

    // Deliberately not latched: an empty cue list here means the browser has
    // not parsed the file yet, and the `load` event still has work to do.
    if (!cues || cues.length === 0) return;

    settled = true;
    options.onLoad(chaptersFromCues(cues));
  };

  const onLoad = (): void => read();

  const onError = (): void => {
    if (settled) return;

    settled = true;
    options.onError(`failed to load chapters from ${src}`);
  };

  trackEl.addEventListener('load', onLoad);
  trackEl.addEventListener('error', onError);
  media.appendChild(trackEl);

  // `mode` must leave 'disabled' or the browser never parses the file. Chapters
  // tracks are not rendered, so 'hidden' is the correct mode: it parses and
  // populates cues without displaying anything.
  if (trackEl.track) {
    trackEl.track.mode = 'hidden';
  }

  // A track already in the DOM and parsed before this ran fires no load event.
  read();

  return () => {
    trackEl.removeEventListener('load', onLoad);
    trackEl.removeEventListener('error', onError);
    trackEl.remove();
  };
}
