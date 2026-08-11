/**
 * WebVTT chapter loading.
 *
 * No parser here on purpose. The browser already ships a WebVTT parser, and the
 * captions plugin proved the approach: append a `<track>`, let the browser parse
 * it, read the cues. A `kind="chapters"` track is parsed and never rendered,
 * which is exactly the behaviour this needs.
 */

import type { Chapter } from '@scarlett-player/core';

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

  const read = (): void => {
    const track = trackEl.track;
    if (!track) return;

    const cues = track.cues;
    if (!cues || cues.length === 0) return;

    const chapters: Chapter[] = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i] as VTTCue;
      chapters.push({
        time: cue.startTime,
        endTime: Number.isFinite(cue.endTime) ? cue.endTime : undefined,
        label: cue.text,
      });
    }

    options.onLoad(chapters);
  };

  const onLoad = (): void => read();
  const onError = (): void => options.onError(`failed to load chapters from ${src}`);

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
