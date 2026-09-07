/**
 * Media Session Plugin for Scarlett Player
 *
 * Integrates with the browser's Media Session API for:
 * - Lock screen controls on mobile devices
 * - Notification center playback controls
 * - Hardware media key support (keyboard play/pause/next/prev)
 * - Album art and track info in system media UI
 * - Seek bar with position state
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';
import type {
  MediaSessionPluginConfig,
  MediaSessionMetadata,
  IMediaSessionPlugin,
} from './types';

// Re-export types
export type {
  MediaSessionPluginConfig,
  MediaSessionMetadata,
  MediaSessionArtwork,
  IMediaSessionPlugin,
} from './types';
import { PKG_VERSION } from './version';

/** Default configuration */
const DEFAULT_CONFIG: MediaSessionPluginConfig = {
  enablePlayPause: true,
  enableSeek: true,
  enableTrackNavigation: true,
  seekOffset: 10,
  updatePositionState: true,
};

/**
 * Check if Media Session API is supported
 */
function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * Create a Media Session Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Media Session Plugin instance
 *
 * @example
 * ```ts
 * import { createPlayer } from '@scarlett-player/core';
 * import { createMediaSessionPlugin } from '@scarlett-player/media-session';
 *
 * const player = await createPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [
 *     createMediaSessionPlugin({
 *       seekOffset: 15,
 *       defaultArtwork: [{ src: '/default-artwork.png', sizes: '512x512' }],
 *     }),
 *   ],
 * });
 * ```
 */
export function createMediaSessionPlugin(config?: Partial<MediaSessionPluginConfig>): IMediaSessionPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Plugin state
  let api: IPluginAPI | null = null;
  let currentMetadata: MediaSessionMetadata = {};

  /**
   * Update the MediaSession metadata
   */
  const updateMetadata = (): void => {
    if (!isMediaSessionSupported()) return;

    const artwork: { src: string; sizes?: string; type?: string }[] = [];

    // Use current metadata artwork or default
    const artworkSources = currentMetadata.artwork || mergedConfig.defaultArtwork || [];

    for (const art of artworkSources) {
      artwork.push({
        src: art.src,
        sizes: art.sizes || '512x512',
        type: art.type || 'image/png',
      });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentMetadata.title || 'Unknown',
        artist: currentMetadata.artist || '',
        album: currentMetadata.album || '',
        artwork,
      });
    } catch (e) {
      api?.logger.warn('Failed to set media session metadata', e);
    }
  };

  /**
   * Update position state for seek bar
   */
  const updatePositionState = (): void => {
    if (!isMediaSessionSupported() || !mergedConfig.updatePositionState) return;

    const duration = api?.getState('duration') || 0;
    const position = api?.getState('currentTime') || 0;
    const playbackRate = api?.getState('playbackRate') || 1;

    // Only update if we have valid duration
    if (duration > 0 && isFinite(duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(position, duration),
          playbackRate,
        });
      } catch (e) {
        // Position state might fail if position > duration due to race conditions
        api?.logger.debug('Failed to set position state', e);
      }
    }
  };

  /**
   * Set up action handlers
   */
  const setupActionHandlers = (): void => {
    if (!isMediaSessionSupported()) return;

    const seekOffset = mergedConfig.seekOffset || 10;

    /**
     * Bounds for a seek: the DVR window on live, `[0, duration]` otherwise.
     *
     * Read per handler call rather than captured: a live window slides, and the
     * handlers are registered once per source. On a live stream `duration` is
     * `Infinity` or arbitrary and the window starts at `seekableRange.start`,
     * so clamping against `[0, duration]` seeks outside the buffer.
     *
     * An unknown duration yields an open upper bound rather than `0`: before
     * metadata arrives, clamping an OS scrubber's request to the start of the
     * stream is worse than not clamping it.
     *
     * @returns The lowest and highest seekable positions, in seconds
     */
    const seekBounds = (): { min: number; max: number } => {
      const live = api?.getState('live');
      const seekable = api?.getState('seekableRange');

      if (live && Number.isFinite(seekable?.start) && Number.isFinite(seekable?.end)) {
        return { min: seekable!.start, max: seekable!.end };
      }

      const duration = api?.getState('duration') || 0;
      return {
        min: 0,
        max: Number.isFinite(duration) && duration > 0 ? duration : Infinity,
      };
    };

    // Play/Pause actions
    if (mergedConfig.enablePlayPause) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          api?.logger.debug('Media session: play');
          api?.emit('playback:play', undefined as any);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          api?.logger.debug('Media session: pause');
          api?.emit('playback:pause', undefined as any);
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          // The start of the seekable window, not 0: on a live DVR stream 0 is
          // outside the buffer entirely.
          const { min } = seekBounds();
          api?.logger.debug('Media session: stop', { time: min });
          api?.emit('playback:pause', undefined as any);
          api?.emit('playback:seeking', { time: min });
        });
      } catch (e) {
        api?.logger.debug('Some play/pause actions not supported', e);
      }
    }

    // Seek actions
    if (mergedConfig.enableSeek) {
      try {
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const offset = details.seekOffset || seekOffset;
          const currentTime = api?.getState('currentTime') || 0;
          const { min, max } = seekBounds();
          // Clamped at both ends, not just the one the seek moves toward: a
          // currentTime recorded before the DVR window slid can already sit
          // outside the range, and a one-sided clamp would leave the target
          // outside it too.
          const newTime = Math.min(max, Math.max(min, currentTime - offset));
          api?.logger.debug('Media session: seekbackward', { offset, newTime });
          api?.emit('playback:seeking', { time: newTime });
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const offset = details.seekOffset || seekOffset;
          const currentTime = api?.getState('currentTime') || 0;
          const { min, max } = seekBounds();
          const newTime = Math.max(min, Math.min(max, currentTime + offset));
          api?.logger.debug('Media session: seekforward', { offset, newTime });
          api?.emit('playback:seeking', { time: newTime });
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            // The OS scrubber reports a position against the duration it was
            // told about, which on live is not the seekable window.
            const { min, max } = seekBounds();
            const newTime = Math.max(min, Math.min(max, details.seekTime));
            api?.logger.debug('Media session: seekto', { time: newTime });
            api?.emit('playback:seeking', { time: newTime });
          }
        });
      } catch (e) {
        api?.logger.debug('Some seek actions not supported', e);
      }
    }

    // Track navigation
    if (mergedConfig.enableTrackNavigation) {
      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          api?.logger.debug('Media session: previoustrack');

          // Try to get playlist plugin
          const playlist = api?.getPlugin<{ previous: () => Promise<void> }>('playlist');
          if (playlist) {
            playlist.previous();
          } else {
            // Fallback: seek to start
            api?.emit('playback:seeking', { time: 0 });
          }
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          api?.logger.debug('Media session: nexttrack');

          // Try to get playlist plugin
          const playlist = api?.getPlugin<{ next: () => Promise<void> }>('playlist');
          if (playlist) {
            playlist.next();
          }
        });
      } catch (e) {
        api?.logger.debug('Track navigation not supported', e);
      }
    }
  };

  /**
   * Clear action handlers
   */
  const clearActionHandlers = (): void => {
    if (!isMediaSessionSupported()) return;

    const actions: MediaSessionAction[] = [
      'play',
      'pause',
      'stop',
      'seekbackward',
      'seekforward',
      'seekto',
      'previoustrack',
      'nexttrack',
    ];

    for (const action of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch (e) {
        // Ignore - action might not be supported
      }
    }
  };

  // Plugin implementation
  const plugin: IMediaSessionPlugin = {
    id: 'media-session',
    name: 'Media Session',
    version: PKG_VERSION,
    type: 'feature' as PluginType,
    description: 'Media Session API integration for system-level media controls',

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;

      if (!isMediaSessionSupported()) {
        api.logger.info('Media Session API not supported in this browser');
        return;
      }

      api.logger.info('Media Session plugin initialized');

      // Setup action handlers
      setupActionHandlers();

      // Listen for playback state changes
      const unsubPlay = api.on('playback:play', () => {
        if (isMediaSessionSupported()) {
          navigator.mediaSession.playbackState = 'playing';
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        if (isMediaSessionSupported()) {
          navigator.mediaSession.playbackState = 'paused';
        }
      });

      const unsubEnded = api.on('playback:ended', () => {
        if (isMediaSessionSupported()) {
          navigator.mediaSession.playbackState = 'none';
        }
      });

      // Listen for time updates to update position state
      let lastPositionUpdate = 0;
      const unsubTimeUpdate = api.on('playback:timeupdate', () => {
        // Throttle position state updates to once per second
        const now = Date.now();
        if (now - lastPositionUpdate >= 1000) {
          lastPositionUpdate = now;
          updatePositionState();
        }
      });

      // Listen for metadata loaded
      const unsubMetadata = api.on('media:loadedmetadata', () => {
        updatePositionState();
      });

      // Listen for title/poster changes from state
      const unsubState = api.subscribeToState((event) => {
        if (event.key === 'title' && typeof event.value === 'string') {
          currentMetadata.title = event.value;
          updateMetadata();
        } else if (event.key === 'poster' && typeof event.value === 'string') {
          currentMetadata.artwork = [{ src: event.value, sizes: '512x512' }];
          updateMetadata();
        }
      });

      // Listen for playlist changes (if playlist plugin is present)
      const unsubPlaylist = api.on('playlist:change' as any, (payload: any) => {
        if (payload?.track) {
          const track = payload.track;
          currentMetadata = {
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork ? [{ src: track.artwork, sizes: '512x512' }] : undefined,
          };
          updateMetadata();
        }
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubEnded();
        unsubTimeUpdate();
        unsubMetadata();
        unsubState();
        unsubPlaylist();
        clearActionHandlers();
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info('Media Session plugin destroying');
      clearActionHandlers();

      if (isMediaSessionSupported()) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }

      api = null;
    },

    isSupported(): boolean {
      return isMediaSessionSupported();
    },

    setMetadata(metadata: MediaSessionMetadata): void {
      currentMetadata = { ...currentMetadata, ...metadata };
      updateMetadata();
    },

    setPlaybackState(state: 'none' | 'paused' | 'playing'): void {
      if (isMediaSessionSupported()) {
        navigator.mediaSession.playbackState = state;
      }
    },

    setPositionState(state: { duration: number; position: number; playbackRate: number }): void {
      if (isMediaSessionSupported()) {
        try {
          navigator.mediaSession.setPositionState(state);
        } catch (e) {
          api?.logger.debug('Failed to set position state', e);
        }
      }
    },

    setActionHandler(action: string, handler: (() => void) | null): void {
      if (isMediaSessionSupported()) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
        } catch (e) {
          api?.logger.debug(`Action ${action} not supported`, e);
        }
      }
    },
  };

  return plugin;
}

// Default export
export default createMediaSessionPlugin;
