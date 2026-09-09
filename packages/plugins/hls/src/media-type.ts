/**
 * HLS media classification.
 *
 * `mediaType` decides whether a source is clippable, whether the audio UI
 * takes over, and what a host shows around the player. Until 2026-09-08 this
 * package derived it from one expression in the `loadedmetadata` handler -
 * `video.videoWidth > 0 ? 'video' : 'audio'` - which reads a *missing*
 * measurement as positive evidence of audio. Intrinsic dimensions are simply
 * not available yet at that point on several mobile browsers (the WHATWG
 * definition of `videoWidth` says they are zero until they are known), so a
 * perfectly ordinary phone playing a perfectly ordinary video was labelled
 * `audio`, and everything gated on that quietly refused to work.
 *
 * This module replaces the guess with evidence. Nothing is classified until
 * something actually establishes it:
 *
 * 1. **Positive intrinsic dimensions or a present native video track establish
 *    video.** That evidence is *sticky* for the source: a later zero-width
 *    event, a track list that empties during a pipeline handoff, or a
 *    `resize` to 0x0 never downgrades a source already known to carry video.
 * 2. **hls.js `MANIFEST_PARSED` establishes it before a frame decodes.** Its
 *    payload carries `audio` / `video` booleans. `video === true` is video.
 *    `video === false && audio === true` is audio - but only when both fields
 *    are really booleans, so a partial mock or a future hls.js that drops a
 *    field cannot be read as "no video".
 * 3. **Native HLS uses the element's track lists.** They are feature-detected
 *    (Chrome ships neither), and only consulted from `HAVE_METADATA` onward:
 *    a supported, empty `videoTracks` list next to a supported, non-empty
 *    `audioTracks` list is audio. Track list mutations re-evaluate.
 * 4. **Everything else stays `unknown`.** Zero dimensions, elapsed time, the
 *    HLS MIME type, the presence of an audio rendition, and the fact that the
 *    element is a `<video>` are all non-evidence. A native audio-only stream
 *    on a browser without track lists therefore stays `unknown` - correct,
 *    and consumers treat it as "not yet known", never as "audio".
 *
 * Evidence is keyed by source URL. A new source resets to `unknown` before
 * any of its metadata is published; a retry, an error recovery reload or an
 * AirPlay handoff between the hls.js and native pipelines keeps what the same
 * source already proved, so the classification does not flicker back to
 * `unknown` halfway through a session.
 */

import type { IPluginAPI } from '@scarlett-player/core';

/**
 * `HTMLMediaElement.videoTracks` / `.audioTracks` as this module uses them.
 *
 * Declared locally and structurally rather than relying on the DOM lib: the
 * lists are optional (Chrome and Firefox ship neither by default), and the
 * only members read here are `length` and the event plumbing.
 */
interface TrackListLike {
  readonly length: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/** A media element that may expose the optional track lists. */
interface ElementWithTrackLists extends HTMLVideoElement {
  videoTracks?: TrackListLike;
  audioTracks?: TrackListLike;
}

/**
 * The `MANIFEST_PARSED` payload fields this module reads.
 *
 * hls.js's own `ManifestParsedData` declares `audio` and `video` as booleans,
 * but the event is also produced by test doubles and by older versions, so
 * both are optional here and only trusted when they really are booleans.
 */
export interface ManifestMediaFlags {
  /** Whether the manifest yielded an audio track. */
  audio?: unknown;
  /** Whether the manifest yielded a video track. */
  video?: unknown;
}

/** The events on the media element that can change the classification. */
const ELEMENT_EVENTS = ['loadedmetadata', 'loadeddata', 'resize', 'playing'] as const;

/** Track-list events that can change the classification. */
const TRACK_LIST_EVENTS = ['addtrack', 'removetrack', 'change'] as const;

/** `HTMLMediaElement.HAVE_METADATA`; the element's own constant is not always present in jsdom. */
const HAVE_METADATA = 1;

/**
 * Per-source classification state, driven by element events, native track
 * lists and hls.js manifest data.
 */
export interface MediaTypeClassifier {
  /**
   * Begin (or continue) classifying a source.
   *
   * A different `src` than the one currently held forgets all evidence and
   * republishes `mediaType: 'unknown'` immediately, before any of the new
   * source's metadata can arrive. The **same** `src` keeps its evidence, which
   * is what carries a confirmed classification across a retry, a native error
   * recovery reload and an AirPlay handoff between pipelines.
   *
   * @param src - The source URL about to be loaded
   */
  beginSource(src: string): void;

  /**
   * Attach to a media element and evaluate it once.
   *
   * Replaces any element this classifier was already attached to (the previous
   * element's listeners are removed first), so a pipeline handoff cannot leave
   * a dead element driving state.
   *
   * @param video - The element the current pipeline is playing through
   */
  attach(video: HTMLVideoElement): void;

  /**
   * Record the `audio` / `video` flags from an hls.js `MANIFEST_PARSED` event.
   *
   * @param data - The event payload; missing or non-boolean fields are ignored
   */
  noteManifestParsed(data: ManifestMediaFlags | null | undefined): void;

  /** Re-read every available signal and publish the resulting media type. */
  evaluate(): void;

  /**
   * The media type this classifier currently stands behind.
   *
   * @returns `'video'`, `'audio'` or `'unknown'`
   */
  current(): 'video' | 'audio' | 'unknown';

  /**
   * Detach every listener and forget the element.
   *
   * Evidence and the published state are left alone: teardown is not new
   * information about the media, and a pipeline handoff detaches before it
   * re-attaches. Idempotent.
   */
  destroy(): void;
}

/**
 * Whether a value is a usable track list.
 *
 * @param list - Candidate `videoTracks` / `audioTracks` value
 * @returns True when the browser supports the list and it can be counted
 */
function isTrackList(list: unknown): list is TrackListLike {
  return (
    typeof list === 'object' &&
    list !== null &&
    typeof (list as TrackListLike).length === 'number'
  );
}

/**
 * Create a media-type classifier bound to one player.
 *
 * The classifier writes the `mediaType` state key and nothing else. It is
 * created once per plugin instance and reused for every source and pipeline,
 * so that evidence survives the handoffs that would otherwise reset it.
 *
 * @param api - The plugin API whose `mediaType` state is published
 * @returns The classifier (see {@link MediaTypeClassifier})
 *
 * @example
 * ```ts
 * const classifier = createMediaTypeClassifier(api);
 * classifier.beginSource(src);        // publishes 'unknown' for a new source
 * classifier.attach(videoEl);         // watches metadata / resize / tracks
 * classifier.noteManifestParsed(data) // hls.js told us before decoding
 * ```
 */
export function createMediaTypeClassifier(api: IPluginAPI): MediaTypeClassifier {
  /** The source the evidence below belongs to; null before the first load. */
  let source: string | null = null;
  /** Sticky: something established that this source carries video. */
  let videoConfirmed = false;
  /** Something established that this source is audio only. */
  let audioConfirmed = false;

  let element: ElementWithTrackLists | null = null;
  /** Detach functions for everything attached to the current element. */
  let elementDisposers: Array<() => void> = [];
  /** Last value written, so an unchanged classification writes nothing. */
  let published: 'video' | 'audio' | 'unknown' | null = null;
  let destroyed = false;

  /** Resolve the evidence to a media type, video evidence winning outright. */
  const decide = (): 'video' | 'audio' | 'unknown' => {
    if (videoConfirmed) return 'video';
    if (audioConfirmed) return 'audio';
    return 'unknown';
  };

  /** Write the decision to state, but only when it actually moved. */
  const publish = (): void => {
    const next = decide();
    if (next === published) return;
    published = next;
    api.setState('mediaType', next);
  };

  /**
   * Read the element for evidence.
   *
   * Only ever *adds* evidence: `videoWidth` returning to 0 during a source
   * switch, or a track list that empties while a pipeline is being swapped,
   * must not undo what this source already proved.
   */
  const readElement = (): void => {
    const video = element;
    if (!video) return;

    if (video.videoWidth > 0) {
      videoConfirmed = true;
      return;
    }

    // Track lists are the only other positive signal, and they mean nothing
    // before the element has metadata: an empty list at HAVE_NOTHING is just
    // a list that has not been populated yet.
    if (video.readyState < HAVE_METADATA) return;

    const videoTracks = video.videoTracks;
    const audioTracks = video.audioTracks;
    if (!isTrackList(videoTracks)) return;

    if (videoTracks.length > 0) {
      videoConfirmed = true;
      return;
    }

    // An empty video-track list alone is not audio: the browser may simply
    // not populate it for this stream. Audio needs its own positive list.
    if (isTrackList(audioTracks) && audioTracks.length > 0) {
      audioConfirmed = true;
    }
  };

  const evaluate = (): void => {
    if (destroyed) return;
    readElement();
    publish();
  };

  /** Remove everything bound to the current element. Idempotent. */
  const detachElement = (): void => {
    for (const off of elementDisposers) off();
    elementDisposers = [];
    element = null;
  };

  return {
    beginSource(src: string): void {
      if (destroyed) return;
      if (source === src) return; // retry / recovery / pipeline handoff: keep evidence
      source = src;
      videoConfirmed = false;
      audioConfirmed = false;
      // Publish immediately: the next thing that happens is this source's
      // metadata, and it must not be read against the previous source's
      // classification.
      published = null;
      publish();
    },

    attach(video: HTMLVideoElement): void {
      if (destroyed) return;
      detachElement();
      element = video as ElementWithTrackLists;

      for (const event of ELEMENT_EVENTS) {
        const handler = (): void => evaluate();
        video.addEventListener(event, handler);
        elementDisposers.push(() => video.removeEventListener(event, handler));
      }

      // Track lists mutate after metadata on Safari (and during an AirPlay
      // handoff). Subscribing is best-effort: the lists are optional, and so
      // is their event plumbing.
      for (const list of [element.videoTracks, element.audioTracks]) {
        if (!isTrackList(list) || typeof list.addEventListener !== 'function') continue;
        for (const event of TRACK_LIST_EVENTS) {
          const handler = (): void => evaluate();
          list.addEventListener(event, handler);
          elementDisposers.push(() => list.removeEventListener?.(event, handler));
        }
      }

      evaluate();
    },

    noteManifestParsed(data: ManifestMediaFlags | null | undefined): void {
      if (destroyed || !data) return;
      const hasVideo = typeof data.video === 'boolean' ? data.video : null;
      const hasAudio = typeof data.audio === 'boolean' ? data.audio : null;

      if (hasVideo === true) {
        videoConfirmed = true;
      } else if (hasVideo === false && hasAudio === true) {
        // Both fields present and unambiguous: a manifest that yielded audio
        // and no video is audio. Sticky video evidence still wins in decide().
        audioConfirmed = true;
      }
      publish();
    },

    evaluate,

    current(): 'video' | 'audio' | 'unknown' {
      return decide();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      detachElement();
    },
  };
}
