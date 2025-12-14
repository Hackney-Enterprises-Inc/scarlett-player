/**
 * Native Video Provider Plugin for Scarlett Player
 *
 * Provides playback for native browser-supported formats:
 * - MP4 (H.264/AAC)
 * - WebM (VP8/VP9/Opus)
 * - MOV (H.264/AAC)
 * - MKV (varies by browser)
 * - OGG/OGV (Theora/Vorbis)
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';

/** Supported MIME types and extensions */
const SUPPORTED_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'ogv', 'ogg', 'm4v'];

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
};

export interface NativePluginConfig {
  /** Preload behavior: 'none' | 'metadata' | 'auto' */
  preload?: 'none' | 'metadata' | 'auto';
}

export interface INativePlugin {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  canPlay(src: string): boolean;
  init(api: IPluginAPI): Promise<void>;
  destroy(): Promise<void>;
  loadSource(src: string): Promise<void>;
}

/**
 * Create a Native Video Provider Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Native Plugin instance
 *
 * @example
 * ```ts
 * import { createNativePlugin } from '@scarlett-player/native';
 *
 * const player = new ScarlettPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [createNativePlugin()],
 * });
 *
 * await player.load('video.mp4');
 * ```
 */
export function createNativePlugin(config?: NativePluginConfig): INativePlugin {
  const preload = config?.preload ?? 'metadata';

  // Plugin state
  let api: IPluginAPI | null = null;
  let video: HTMLVideoElement | null = null;
  let cleanupEvents: (() => void) | null = null;

  /** Get file extension from URL */
  const getExtension = (src: string): string => {
    try {
      const url = new URL(src, window.location.href);
      const pathname = url.pathname;
      const ext = pathname.split('.').pop()?.toLowerCase() || '';
      return ext;
    } catch {
      const ext = src.split('.').pop()?.toLowerCase() || '';
      return ext.split('?')[0]; // Remove query string
    }
  };

  /** Get MIME type for extension */
  const getMimeType = (ext: string): string => {
    return MIME_TYPES[ext] || 'video/mp4';
  };

  /** Check if browser can play this MIME type */
  const canBrowserPlay = (mimeType: string): boolean => {
    const testVideo = document.createElement('video');
    const canPlay = testVideo.canPlayType(mimeType);
    return canPlay === 'probably' || canPlay === 'maybe';
  };

  /** Get or create video element */
  const getOrCreateVideo = (): HTMLVideoElement => {
    if (video) return video;

    // Look for existing video element
    const existing = api?.container.querySelector('video');
    if (existing) {
      video = existing as HTMLVideoElement;
      return video;
    }

    // Create new video element
    video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;background:#000';
    video.preload = preload;
    video.controls = false;
    video.playsInline = true;

    api?.container.appendChild(video);
    return video;
  };

  /** Setup video event listeners */
  const setupEventListeners = (videoEl: HTMLVideoElement): () => void => {
    const handlers: Array<[string, EventListener]> = [];

    const on = (event: string, handler: EventListener) => {
      videoEl.addEventListener(event, handler);
      handlers.push([event, handler]);
    };

    // Playback state events
    on('playing', () => {
      api?.setState('playing', true);
      api?.setState('paused', false);
      api?.emit('playback:playing', undefined);
    });

    on('pause', () => {
      api?.setState('playing', false);
      api?.setState('paused', true);
      api?.emit('playback:paused', undefined);
    });

    on('ended', () => {
      api?.setState('playing', false);
      api?.setState('ended', true);
      api?.emit('playback:ended', undefined);
    });

    // Time updates
    on('timeupdate', () => {
      api?.setState('currentTime', videoEl.currentTime);
      api?.emit('playback:timeupdate', { currentTime: videoEl.currentTime });
    });

    on('durationchange', () => {
      api?.setState('duration', videoEl.duration || 0);
      api?.emit('media:durationchange', { duration: videoEl.duration || 0 });
    });

    // Loading events
    on('loadedmetadata', () => {
      api?.setState('duration', videoEl.duration || 0);
      api?.emit('media:loadedmetadata', { duration: videoEl.duration || 0 });
    });

    on('loadeddata', () => {
      api?.emit('media:loadeddata', undefined);
    });

    on('canplay', () => {
      api?.setState('buffering', false);
      api?.emit('media:canplay', undefined);
    });

    on('canplaythrough', () => {
      api?.emit('media:canplaythrough', undefined);
    });

    // Buffering events
    on('waiting', () => {
      api?.setState('buffering', true);
      api?.emit('media:waiting', undefined);
    });

    on('progress', () => {
      if (videoEl.buffered.length > 0) {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        const duration = videoEl.duration || 0;
        const buffered = duration > 0 ? bufferedEnd / duration : 0;
        api?.setState('bufferedAmount', buffered);
        api?.emit('media:progress', { buffered });
      }
    });

    // Seeking events
    on('seeking', () => {
      api?.setState('seeking', true);
      api?.emit('playback:seeking', { time: videoEl.currentTime });
    });

    on('seeked', () => {
      api?.setState('seeking', false);
      api?.emit('playback:seeked', { time: videoEl.currentTime });
    });

    // Volume events
    on('volumechange', () => {
      api?.setState('volume', videoEl.volume);
      api?.setState('muted', videoEl.muted);
      api?.emit('volume:change', { volume: videoEl.volume });
    });

    // Playback rate
    on('ratechange', () => {
      api?.setState('playbackRate', videoEl.playbackRate);
      api?.emit('playback:ratechange', { rate: videoEl.playbackRate });
    });

    // Error handling
    on('error', () => {
      const error = videoEl.error;
      let message = 'Unknown video error';

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = 'Playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Decode error - format may not be supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Format not supported';
            break;
        }
      }

      api?.logger.error('Video error', { code: error?.code, message });
      api?.emit('error', {
        code: 'MEDIA_ERROR',
        message,
        fatal: true,
        timestamp: Date.now(),
      });
    });

    // Return cleanup function
    return () => {
      handlers.forEach(([event, handler]) => {
        videoEl.removeEventListener(event, handler);
      });
    };
  };

  /** Cleanup current state */
  const cleanup = () => {
    cleanupEvents?.();
    cleanupEvents = null;

    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load(); // Reset the element
    }
  };

  // Plugin implementation
  const plugin: INativePlugin = {
    id: 'native-provider',
    name: 'Native Video Provider',
    version: '1.0.0',
    type: 'provider' as PluginType,
    description: 'Native HTML5 video playback for MP4, WebM, MOV, MKV',

    canPlay(src: string): boolean {
      const ext = getExtension(src);

      // Check if extension is in our list
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return false;
      }

      // Check if browser can play this format
      const mimeType = getMimeType(ext);
      return canBrowserPlay(mimeType);
    },

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('Native video plugin initialized');

      // Setup playback control listeners
      const unsubPlay = api.on('playback:play', async () => {
        if (!video) return;
        try {
          await video.play();
        } catch (e) {
          api?.logger.error('Play failed', e);
        }
      });

      const unsubPause = api.on('playback:pause', () => {
        video?.pause();
      });

      const unsubSeek = api.on('playback:seeking', ({ time }: { time: number }) => {
        if (!video) return;
        const clampedTime = Math.max(0, Math.min(time, video.duration || 0));
        video.currentTime = clampedTime;
      });

      const unsubVolume = api.on('volume:change', ({ volume }: { volume: number }) => {
        if (video) video.volume = volume;
      });

      const unsubMute = api.on('volume:mute', ({ muted }: { muted: boolean }) => {
        if (video) video.muted = muted;
      });

      const unsubRate = api.on('playback:ratechange', ({ rate }: { rate: number }) => {
        if (video) video.playbackRate = rate;
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubSeek();
        unsubVolume();
        unsubMute();
        unsubRate();
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info('Native video plugin destroying');
      cleanup();

      if (video?.parentNode) {
        video.parentNode.removeChild(video);
      }
      video = null;
      api = null;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      const ext = getExtension(src);
      const mimeType = getMimeType(ext);

      api.logger.info('Loading native video source', { src, mimeType });

      // Cleanup previous source
      cleanup();

      // Update state
      api.setState('playbackState', 'loading');
      api.setState('buffering', true);

      const videoEl = getOrCreateVideo();

      // Setup event listeners
      cleanupEvents = setupEventListeners(videoEl);

      return new Promise((resolve, reject) => {
        const onLoaded = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onError);

          api?.setState('source', { src, type: mimeType });
          api?.setState('playbackState', 'ready');
          api?.setState('buffering', false);
          api?.emit('media:loaded', { src, type: mimeType });

          resolve();
        };

        const onError = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onError);

          const error = videoEl.error;
          reject(new Error(error?.message || 'Failed to load video source'));
        };

        videoEl.addEventListener('loadedmetadata', onLoaded);
        videoEl.addEventListener('error', onError);
        videoEl.src = src;
        videoEl.load();
      });
    },
  };

  return plugin;
}

// Default export
export default createNativePlugin;
