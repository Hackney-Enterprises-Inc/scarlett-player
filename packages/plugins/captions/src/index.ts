/**
 * Captions Plugin for Scarlett Player
 *
 * Provides WebVTT subtitle/caption support with:
 * - External WebVTT file loading via <track> elements
 * - HLS.js subtitle track extraction
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
   * Remove all track elements we added.
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
   * Extract subtitle tracks from HLS.js instance and add as <track> elements.
   */
  const extractHlsSubtitles = (): void => {
    if (!extractFromHLS || !api) return;

    const hlsPlugin = api.getPlugin<HlsPluginLike>('hls-provider');
    if (!hlsPlugin || hlsPlugin.isNativeHLS()) return;

    const hlsInstance = hlsPlugin.getHlsInstance();
    if (!hlsInstance?.subtitleTracks?.length) return;

    api.logger.debug('Extracting HLS subtitle tracks', {
      count: hlsInstance.subtitleTracks.length,
    });

    for (const hlsTrack of hlsInstance.subtitleTracks) {
      addTrackElement({
        language: hlsTrack.lang || 'unknown',
        label: hlsTrack.name || `Subtitle ${hlsTrack.id}`,
        src: hlsTrack.url,
        kind: 'subtitles',
      });
    }

    syncTracksToState();

    // Auto-select if configured
    if (autoSelect) {
      autoSelectTrack();
    }
  };

  /**
   * Auto-select a track matching the default language.
   */
  const autoSelectTrack = (): void => {
    const tracks = api?.getState('textTracks') || [];
    const match = tracks.find(t => t.language === defaultLanguage);
    if (match) {
      selectTrack(match.id);
      api?.logger.debug('Auto-selected caption track', { language: defaultLanguage, id: match.id });
    }
  };

  /**
   * Initialize external sources from config.
   */
  const initSources = (): void => {
    if (!config.sources?.length) return;

    for (const source of config.sources) {
      addTrackElement(source);
    }

    syncTracksToState();

    if (autoSelect) {
      autoSelectTrack();
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

        // Clean up previous tracks
        cleanupTracks();

        // Add external sources
        initSources();

        // Extract HLS subtitles (with short delay to let hls.js parse manifest)
        if (extractFromHLS) {
          setTimeout(extractHlsSubtitles, 500);
        }
      });

      // On source change via load-request, clean up
      const unsubLoadRequest = api.on('media:load-request', () => {
        video = null;
        cleanupTracks();
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubTrackText();
        unsubLoaded();
        unsubLoadRequest();
        cleanupTracks();

        // Remove HLS subtitle listener if any
        if (hlsSubtitleHandler) {
          const hlsPlugin = api?.getPlugin<HlsPluginLike>('hls-provider');
          const hlsInstance = hlsPlugin?.getHlsInstance();
          if (hlsInstance) {
            hlsInstance.off('SUBTITLE_TRACKS_UPDATED', hlsSubtitleHandler);
          }
          hlsSubtitleHandler = null;
        }
      });
    },

    destroy(): void {
      api?.logger.debug('Captions plugin destroyed');
      cleanupTracks();
      video = null;
      api = null;
    },
  };
}

export default createCaptionsPlugin;
