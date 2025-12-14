/**
 * Native HTML5 Provider Plugin - Demo/Test Implementation
 *
 * Provides basic HTML5 video playback for mp4, webm, ogg files.
 * This is a minimal implementation for testing purposes.
 */

import type { Plugin, PluginAPI } from '../src/types';

export interface NativeProviderConfig {
  preload?: 'none' | 'metadata' | 'auto';
  controls?: boolean;
}

/**
 * Native HTML5 video provider plugin.
 */
export const createNativeProvider = (): Plugin<NativeProviderConfig> => {
  let videoElement: HTMLVideoElement | null = null;
  let api: PluginAPI | null = null;
  let config: NativeProviderConfig | undefined;

  const setupVideoListeners = () => {
    if (!videoElement || !api) return;

    // Forward video events to player
    videoElement.addEventListener('playing', () => {
      api?.events.emit('playback:playing', undefined);
    });

    videoElement.addEventListener('pause', () => {
      api?.events.emit('playback:paused', undefined);
    });

    videoElement.addEventListener('timeupdate', () => {
      if (!videoElement) return;
      api?.events.emit('playback:timeupdate', {
        currentTime: videoElement.currentTime,
      });
    });

    videoElement.addEventListener('durationchange', () => {
      if (!videoElement) return;
      api?.events.emit('media:durationchange', {
        duration: videoElement.duration || 0,
      });
    });

    videoElement.addEventListener('loadedmetadata', () => {
      if (!videoElement) return;
      api?.events.emit('media:loadedmetadata', {
        duration: videoElement.duration || 0,
      });
    });

    videoElement.addEventListener('canplay', () => {
      api?.events.emit('media:canplay', undefined);
    });

    videoElement.addEventListener('canplaythrough', () => {
      api?.events.emit('media:canplaythrough', undefined);
    });

    videoElement.addEventListener('progress', () => {
      if (!videoElement || !videoElement.buffered.length) return;
      const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
      const duration = videoElement.duration || 0;
      const buffered = duration > 0 ? bufferedEnd / duration : 0;
      api?.events.emit('media:progress', { buffered });
    });

    videoElement.addEventListener('ended', () => {
      api?.events.emit('playback:ended', undefined);
    });

    videoElement.addEventListener('waiting', () => {
      api?.events.emit('media:waiting', undefined);
    });

    videoElement.addEventListener('seeking', () => {
      api?.events.emit('playback:seeking', {
        time: videoElement?.currentTime || 0,
      });
    });

    videoElement.addEventListener('seeked', () => {
      api?.events.emit('playback:seeked', {
        time: videoElement?.currentTime || 0,
      });
    });

    videoElement.addEventListener('error', (e) => {
      const error = videoElement?.error;
      api?.logger.error('Video error', {
        code: error?.code,
        message: error?.message,
      });
      api?.events.emit('media:error', {
        error: new Error(error?.message || 'Unknown video error'),
      });
    });
  };

  const loadSource = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!api) {
        reject(new Error('Plugin API not initialized'));
        return;
      }

      api.logger.info('Loading source', { src });

      // Clean up any existing video elements in container
      // This ensures we don't have stale elements from other providers
      const existingVideos = api.container.querySelectorAll('video');
      existingVideos.forEach((video) => {
        if (video !== videoElement) {
          api?.logger.info('Removing stale video element from container');
          video.remove();
        }
      });

      // Create video element if it doesn't exist
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.display = 'block';
        videoElement.style.objectFit = 'contain';
        videoElement.style.backgroundColor = '#000';
        videoElement.preload = config?.preload ?? 'metadata';
        videoElement.controls = config?.controls ?? false;

        // Add to container
        api.container.appendChild(videoElement);

        api.logger.info('Video element created and added to DOM', {
          width: videoElement.offsetWidth,
          height: videoElement.offsetHeight,
          containerWidth: api.container.offsetWidth,
          containerHeight: api.container.offsetHeight,
        });

        // Setup video event listeners
        setupVideoListeners();
      }

      // Wait for metadata to be loaded before resolving
      const onLoadedMetadata = () => {
        videoElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoElement?.removeEventListener('error', onError);
        api?.events.emit('media:loaded', { src, type: detectMimeType(src) });
        resolve();
      };

      const onError = () => {
        videoElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoElement?.removeEventListener('error', onError);
        reject(new Error('Failed to load video source'));
      };

      videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      videoElement.addEventListener('error', onError, { once: true });

      videoElement.src = src;
      videoElement.load();
    });
  };

  // Helper to detect MIME type
  const detectMimeType = (source: string): string => {
    const ext = source.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      default:
        return 'video/mp4';
    }
  };

  const plugin: Plugin<NativeProviderConfig> = {
    name: 'native-provider',
    type: 'provider',
    version: '1.0.0',

    setup: async (pluginAPI: PluginAPI, pluginConfig?: NativeProviderConfig) => {
      api = pluginAPI;
      config = pluginConfig;

      api.logger.info('Native provider initialized (video element will be created on load)');

      // Listen to playback events
      const unsubPlay = api.events.on('playback:play', async () => {
        if (!videoElement) return;

        try {
          await videoElement.play();
        } catch (error) {
          api?.logger.error('Play failed', error);
        }
      });

      const unsubPause = api.events.on('playback:pause', () => {
        if (!videoElement) return;
        videoElement.pause();
      });

      const unsubSeeking = api.events.on('playback:seeking', ({ time }) => {
        if (!videoElement) {
          api?.logger.warn('Seeking requested but video element not initialized');
          return;
        }
        api?.logger.debug('Seeking to time', { time, currentTime: videoElement.currentTime });
        videoElement.currentTime = time;
      });

      const unsubVolume = api.events.on('volume:change', ({ volume }) => {
        if (!videoElement) return;
        videoElement.volume = volume;
      });

      const unsubMute = api.events.on('volume:mute', ({ muted }) => {
        if (!videoElement) return;
        videoElement.muted = muted;
      });

      const unsubRate = api.events.on('playback:ratechange', ({ rate }) => {
        if (!videoElement) return;
        videoElement.playbackRate = rate;
      });

      // Cleanup subscriptions
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubSeeking();
        unsubVolume();
        unsubMute();
        unsubRate();
      });
    },

    destroy: () => {
      if (videoElement && videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement);
      }
      videoElement = null;
      api = null;
    },

    // Provider capability check
    canPlay: (source: string): boolean => {
      const ext = source.split('.').pop()?.toLowerCase();
      return ext === 'mp4' || ext === 'webm' || ext === 'ogg';
    },

    // Provider load method
    loadSource,
  };

  return plugin;
};
