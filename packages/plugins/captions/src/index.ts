/**
 * Captions Plugin for Scarlett Player
 *
 * Provides WebVTT subtitle/caption support with:
 * - External WebVTT file loading via <track> elements
 * - HLS.js subtitle track extraction, driven by Hls.Events.SUBTITLE_TRACKS_UPDATED
 *   (emitted as 'hlsSubtitleTracksUpdated')
 * - Native HLS support (Safari/iOS) by observing the video's TextTrackList
 * - Browser-native rendering (no custom VTT parser)
 * - State sync with core textTracks/currentTextTrack
 * - Automatic cleanup on source change
 *
 * Works with existing UI controls:
 * - CaptionsButton (toggle on/off)
 * - SettingsMenu captions submenu
 */

import type { IPluginAPI, Plugin, PluginType, TextTrack as ScarlettTextTrack } from '@scarlett-player/core';
import type { CaptionsPluginConfig, CaptionSource } from './types';

export type { CaptionsPluginConfig, CaptionSource } from './types';

/** HLS.js subtitle track shape (subset we need) */
interface HlsSubtitleTrack {
  id: number;
  name: string;
  lang?: string;
  type: string;
  url: string;
}

/** HLS plugin interface (subset we access) */
interface HlsPluginLike {
  getHlsInstance(): {
    subtitleTracks?: HlsSubtitleTrack[];
    subtitleTrack?: number;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
  } | null;
  isNativeHLS(): boolean;
}

/**
 * hls.js emits this once the manifest's subtitle renditions are known. It can
 * fire before or after media:loaded depending on manifest size, which is why we
 * subscribe rather than sampling on a timer.
 *
 * This is the emitted value of `Hls.Events.SUBTITLE_TRACKS_UPDATED`, not the
 * enum key. Subscribing with the string 'SUBTITLE_TRACKS_UPDATED' silently
 * matches nothing — the bug this constant exists to prevent.
 */
const HLS_SUBTITLE_TRACKS_UPDATED = 'hlsSubtitleTracksUpdated';

/** Only used when the HLS instance isn't reachable yet at media:loaded. */
const HLS_INSTANCE_RETRY_MS = 500;

/**
 * Create a Captions Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Captions Plugin instance
 *
 * @example
 * ```ts
 * import { createCaptionsPlugin } from '@scarlett-player/captions';
 *
 * const player = new ScarlettPlayer({
 *   container: '#player',
 *   plugins: [
 *     createCaptionsPlugin({
 *       sources: [
 *         { language: 'en', label: 'English', src: '/subs/en.vtt' },
 *         { language: 'es', label: 'Spanish', src: '/subs/es.vtt' },
 *       ],
 *       autoSelect: true,
 *       defaultLanguage: 'en',
 *     }),
 *   ],
 * });
 * ```
 */
export function createCaptionsPlugin(config: CaptionsPluginConfig = {}): Plugin {
  let api: IPluginAPI | null = null;
  let video: HTMLVideoElement | null = null;
  let addedTrackElements: HTMLTrackElement[] = [];
  let hlsSubtitleHandler: ((...args: unknown[]) => void) | null = null;
  let observedTextTracks: TextTrackList | null = null;
  let hlsRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let hlsRetryUsed = false;
  let hasAutoSelected = false;

  const extractFromHLS = config.extractFromHLS !== false;
  const autoSelect = config.autoSelect ?? false;
  const defaultLanguage = config.defaultLanguage ?? 'en';

  /**
   * Get video element from container.
   */
  const getVideo = (): HTMLVideoElement | null => {
    if (video) return video;
    video = api?.container.querySelector('video') ?? null;
    return video;
  };

  /**
   * Remove the <track> elements we added, and reset track state.
   *
   * Tracks the browser owns (native HLS renditions) are not ours to remove —
   * they go away with the source change, and the TextTrackList listener picks
   * up their replacements.
   */
  const cleanupTracks = (): void => {
    for (const trackEl of addedTrackElements) {
      trackEl.parentNode?.removeChild(trackEl);
    }
    addedTrackElements = [];

    // Reset state
    api?.setState('textTracks', []);
    api?.setState('currentTextTrack', null);
  };

  /**
   * Add a <track> element to the video.
   *
   * Only ever used for externally configured sources, which are real `.vtt` URLs. HLS renditions
   * are NOT added this way - hls.js creates and drives those itself (see extractHlsSubtitles).
   *
   * @param source - Caption source to attach
   */
  const addTrackElement = (source: CaptionSource): HTMLTrackElement => {
    const videoEl = getVideo();
    if (!videoEl) throw new Error('No video element');

    const trackEl = document.createElement('track');
    trackEl.kind = source.kind || 'subtitles';
    trackEl.label = source.label;
    trackEl.srclang = source.language;
    trackEl.src = source.src;
    trackEl.default = false; // We manage selection ourselves

    videoEl.appendChild(trackEl);
    addedTrackElements.push(trackEl);

    // Ensure the track starts disabled
    if (trackEl.track) {
      trackEl.track.mode = 'disabled';
    }

    return trackEl;
  };

  /**
   * Sync browser TextTrack state to Scarlett state.
   *
   * Reads the video's TextTrackList directly, so it covers tracks we appended
   * and tracks the browser created itself for native HLS.
   */
  const syncTracksToState = (): void => {
    const videoEl = getVideo();
    if (!videoEl) return;

    const tracks: ScarlettTextTrack[] = [];
    let currentTrack: ScarlettTextTrack | null = null;

    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const track = videoEl.textTracks[i];
      // Only include subtitles/captions (skip chapters, metadata, etc.)
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;

      const scarlettTrack: ScarlettTextTrack = {
        id: `track-${i}`,
        label: track.label || `Track ${i + 1}`,
        language: track.language || '',
        kind: track.kind as 'subtitles' | 'captions',
        active: track.mode === 'showing',
      };

      tracks.push(scarlettTrack);

      if (track.mode === 'showing') {
        currentTrack = scarlettTrack;
      }
    }

    api?.setState('textTracks', tracks);
    api?.setState('currentTextTrack', currentTrack);
  };

  /**
   * Select a text track by ID (or null to disable all).
   */
  const selectTrack = (trackId: string | null): void => {
    const videoEl = getVideo();
    if (!videoEl) return;

    // An explicit choice ends auto-selection for this media, so re-syncing
    // never reinstates the default language over the user's pick.
    hasAutoSelected = true;

    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const track = videoEl.textTracks[i];
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;

      const id = `track-${i}`;
      if (trackId && id === trackId) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }

    syncTracksToState();
  };

  /**
   * Auto-select a track matching the default language, at most once per media.
   *
   * A track that is already showing counts as the selection for this media —
   * whether the browser restored it or the viewer picked it from Safari's own
   * subtitle menu, neither of which routes through selectTrack. Standing down
   * keeps a later re-sync from replacing that pick with defaultLanguage.
   */
  const maybeAutoSelect = (): void => {
    if (!autoSelect || hasAutoSelected) return;

    if (api?.getState('currentTextTrack')) {
      hasAutoSelected = true;
      return;
    }

    const tracks = api?.getState('textTracks') || [];
    const match = tracks.find(t => t.language === defaultLanguage);
    if (!match) return;

    selectTrack(match.id);
    api?.logger.debug('Auto-selected caption track', { language: defaultLanguage, id: match.id });
  };

  /**
   * Re-read the TextTrackList after the browser changed it.
   *
   * Fires for native HLS renditions appearing after load, for our own appended
   * tracks, and when something outside the player (Safari's native subtitle
   * menu) switches tracks.
   */
  const handleTextTracksChanged = (): void => {
    syncTracksToState();
    maybeAutoSelect();
  };

  /**
   * Observe the video's TextTrackList so track changes reach Scarlett state
   * regardless of who created the tracks.
   */
  const observeTextTracks = (): void => {
    const videoEl = getVideo();
    if (!videoEl || observedTextTracks === videoEl.textTracks) return;

    unobserveTextTracks();

    const list = videoEl.textTracks;
    // TextTrackList is an EventTarget in every browser we support, but not in
    // every test environment — degrade to the one-shot sync rather than throwing.
    if (typeof list?.addEventListener !== 'function') return;

    observedTextTracks = list;
    observedTextTracks.addEventListener('addtrack', handleTextTracksChanged);
    observedTextTracks.addEventListener('removetrack', handleTextTracksChanged);
    observedTextTracks.addEventListener('change', handleTextTracksChanged);
  };

  /**
   * Stop observing the current TextTrackList.
   */
  const unobserveTextTracks = (): void => {
    if (typeof observedTextTracks?.removeEventListener !== 'function') {
      observedTextTracks = null;
      return;
    }

    observedTextTracks.removeEventListener('addtrack', handleTextTracksChanged);
    observedTextTracks.removeEventListener('removetrack', handleTextTracksChanged);
    observedTextTracks.removeEventListener('change', handleTextTracksChanged);
    observedTextTracks = null;
  };

  /**
   * Mirror the hls.js subtitle renditions onto <track> elements.
   *
   * Safe to call repeatedly — previously derived tracks are replaced, not
   * appended to.
   */
  const extractHlsSubtitles = (): void => {
    if (!extractFromHLS || !api) return;

    const hlsPlugin = api.getPlugin<HlsPluginLike>('hls-provider');
    if (!hlsPlugin || hlsPlugin.isNativeHLS()) return;

    const hlsInstance = hlsPlugin.getHlsInstance();
    if (!hlsInstance?.subtitleTracks?.length) return;

    api.logger.debug('Syncing HLS subtitle tracks', {
      count: hlsInstance.subtitleTracks.length,
    });

    // We do NOT create track elements for these. hls.js owns its subtitle renditions: with
    // renderTextTracksNatively (its default) it has already created a TextTrack per rendition and
    // fetches and parses the VTT segments itself, so they are in videoEl.textTracks before we get
    // here and syncTracksToState() below picks them up.
    //
    // Appending a <track> per rendition duplicated every entry in the picker, and our copy was dead
    // on arrival: hlsTrack.url is the rendition PLAYLIST (subs/en.m3u8), which a <track> element
    // cannot parse as WebVTT, so it produced zero cues. Measured in production 2026-08-10 on a
    // premium HLS asset:
    //
    //   0 'English' 'disabled' undefined   <- ours
    //   1 'English' 'showing'  110         <- hls.js's
    //
    // The viewer saw two identical "English" options, one of which did nothing.
    syncTracksToState();
    maybeAutoSelect();
  };

  /**
   * Stop listening for hls.js subtitle updates.
   */
  const unsubscribeFromHls = (): void => {
    if (hlsRetryTimer) {
      clearTimeout(hlsRetryTimer);
      hlsRetryTimer = null;
    }

    if (!hlsSubtitleHandler) return;

    const hlsInstance = api?.getPlugin<HlsPluginLike>('hls-provider')?.getHlsInstance();
    hlsInstance?.off(HLS_SUBTITLE_TRACKS_UPDATED, hlsSubtitleHandler);
    hlsSubtitleHandler = null;
  };

  /**
   * Subscribe to hls.js subtitle updates and pick up anything already parsed.
   *
   * The manifest may be parsed before or after media:loaded, so we do both:
   * read what's there now, and listen for what arrives later.
   */
  const syncFromHls = (): void => {
    if (!extractFromHLS || !api) return;

    const hlsPlugin = api.getPlugin<HlsPluginLike>('hls-provider');
    if (!hlsPlugin || hlsPlugin.isNativeHLS()) return;

    const hlsInstance = hlsPlugin.getHlsInstance();

    if (!hlsInstance) {
      // The provider hasn't built its instance yet. Retry exactly once — a
      // still-missing instance after that means this source isn't running
      // through hls.js, and polling would never resolve it. Guarded by a flag
      // rather than by hlsRetryTimer being null, so the retry cannot re-arm
      // itself from inside its own callback.
      if (!hlsRetryUsed) {
        hlsRetryUsed = true;
        hlsRetryTimer = setTimeout(() => {
          hlsRetryTimer = null;
          syncFromHls();
        }, HLS_INSTANCE_RETRY_MS);
      }
      return;
    }

    unsubscribeFromHls();
    hlsSubtitleHandler = (): void => extractHlsSubtitles();
    hlsInstance.on(HLS_SUBTITLE_TRACKS_UPDATED, hlsSubtitleHandler);

    extractHlsSubtitles();
  };

  /**
   * Initialize external sources from config.
   */
  const initSources = (): void => {
    if (!config.sources?.length) return;

    for (const source of config.sources) {
      addTrackElement(source);
    }
  };

  return {
    id: 'captions',
    name: 'Captions',
    version: '1.0.0',
    type: 'feature' as PluginType,
    description: 'WebVTT subtitles and closed captions with HLS extraction',

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;
      api.logger.debug('Captions plugin initialized');

      // Initialize state
      api.setState('textTracks', []);
      api.setState('currentTextTrack', null);

      // Listen for track:text events (from CaptionsButton / SettingsMenu)
      const unsubTrackText = api.on('track:text', ({ trackId }) => {
        selectTrack(trackId);
      });

      // On media loaded, initialize tracks
      const unsubLoaded = api.on('media:loaded', () => {
        // Reset video reference (may be new element after source switch)
        video = null;
        hasAutoSelected = false;
        hlsRetryUsed = false;

        // Clean up previous tracks
        cleanupTracks();

        // Add external sources
        initSources();

        // Watch the TextTrackList before syncing, so nothing added between the
        // two is missed.
        observeTextTracks();

        // Pick up whatever already exists — our own <track> elements, and the
        // renditions the browser parsed itself on the native HLS path, which
        // never emit an addtrack event we could have waited for.
        syncTracksToState();
        maybeAutoSelect();

        // hls.js path: subscribe, and read anything already parsed.
        syncFromHls();
      });

      // On source change via load-request, clean up
      const unsubLoadRequest = api.on('media:load-request', () => {
        video = null;
        hasAutoSelected = false;
        hlsRetryUsed = false;
        unsubscribeFromHls();
        unobserveTextTracks();
        cleanupTracks();
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubTrackText();
        unsubLoaded();
        unsubLoadRequest();
        unsubscribeFromHls();
        unobserveTextTracks();
        cleanupTracks();
      });
    },

    destroy(): void {
      api?.logger.debug('Captions plugin destroyed');
      unsubscribeFromHls();
      unobserveTextTracks();
      cleanupTracks();
      video = null;
      api = null;
    },
  };
}

export default createCaptionsPlugin;
