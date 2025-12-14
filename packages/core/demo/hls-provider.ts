/**
 * HLS Provider Plugin - Demo/Test Implementation
 *
 * Provides HLS (HTTP Live Streaming) playback for .m3u8 files using hls.js.
 * This is a minimal implementation for testing purposes.
 */

import Hls from 'hls.js';
import type { Plugin, PluginAPI } from '../src/types';

export interface HLSProviderConfig {
  debug?: boolean;
  autoStartLoad?: boolean;
  startPosition?: number;
}

/**
 * HLS video provider plugin using hls.js.
 */
export const createHLSProvider = (): Plugin<HLSProviderConfig> => {
  let videoElement: HTMLVideoElement | null = null;
  let hls: Hls | null = null;
  let api: PluginAPI | null = null;
  let config: HLSProviderConfig | undefined;

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
      api?.logger.error('Video element error', {
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

    api.logger.info('Loading HLS source', { src });

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
      videoElement.preload = 'metadata';
      videoElement.controls = false;

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

    // Clean up existing HLS instance if any
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Check if native HLS is supported (Safari)
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      api.logger.info('Using native HLS playback');
      videoElement.src = src;

      // Wait for metadata to be loaded before resolving
      const onLoadedMetadata = () => {
        videoElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoElement?.removeEventListener('error', onError);
        api?.events.emit('media:loaded', { src, type: 'application/x-mpegURL' });
        resolve();
      };

      const onError = () => {
        videoElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoElement?.removeEventListener('error', onError);
        reject(new Error('Failed to load HLS source'));
      };

      videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      videoElement.addEventListener('error', onError, { once: true });
      videoElement.load();
      return;
    }

    // Create hls.js instance
    hls = new Hls({
      debug: config?.debug ?? false,
      autoStartLoad: config?.autoStartLoad ?? true,
      startPosition: config?.startPosition ?? -1,
    });

    // Attach to video
    hls.attachMedia(videoElement);

    // Load source when media is attached
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      api?.logger.info('HLS media attached, loading source');
      hls?.loadSource(src);
    });

    // Handle manifest loaded
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      api?.logger.info('HLS manifest parsed', {
        levels: data.levels.length,
        firstLevel: data.firstLevel,
      });

      // Emit media:loaded event now that HLS is actually ready
      api?.events.emit('media:loaded', { src, type: 'application/x-mpegURL' });
      resolve();
    });

    // Handle errors
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        api?.logger.error('Fatal HLS error', {
          type: data.type,
          details: data.details,
        });

        const errorMessage = `HLS ${data.type} error: ${data.details}`;
        const error = new Error(errorMessage);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            api?.logger.error('Network error, trying to recover');
            api?.events.emit('error:network', { error });
            hls?.startLoad();
            // Don't reject promise on recoverable network errors
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            api?.logger.error('Media error, trying to recover');
            api?.events.emit('error:media', { error });
            hls?.recoverMediaError();
            // Don't reject promise on recoverable media errors
            break;
          default:
            api?.logger.error('Fatal error, cannot recover');
            api?.events.emit('media:error', { error });
            hls?.destroy();
            reject(error);
            break;
        }
      } else {
        // Non-fatal errors - log but don't emit events
        api?.logger.warn('HLS warning', {
          type: data.type,
          details: data.details,
        });
      }
    });
    });
  };

  const plugin: Plugin<HLSProviderConfig> = {
    name: 'hls-provider',
    type: 'provider',
    version: '1.0.0',

    setup: async (pluginAPI: PluginAPI, pluginConfig?: HLSProviderConfig) => {
      api = pluginAPI;
      config = pluginConfig;

      // Check if HLS is supported
      if (!Hls.isSupported()) {
        const video = document.createElement('video');
        if (!video.canPlayType('application/vnd.apple.mpegurl')) {
          api.logger.error('HLS.js is not supported in this browser');
          return;
        }
      }

      api.logger.info('HLS provider initialized (video element will be created on load)');

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

        // Clamp time to valid range
        const duration = videoElement.duration || 0;
        const clampedTime = Math.max(0, Math.min(time, duration));

        api?.logger.debug('Seeking to time', {
          requestedTime: time,
          clampedTime,
          currentTime: videoElement.currentTime,
          duration,
          buffered: videoElement.buffered.length > 0 ?
            `${videoElement.buffered.start(0)}-${videoElement.buffered.end(videoElement.buffered.length - 1)}` :
            'none'
        });

        // For HLS.js, check if we need to force a buffer flush on large seeks
        if (hls && Math.abs(clampedTime - videoElement.currentTime) > 5) {
          api?.logger.debug('Large seek detected, may trigger HLS buffer reload');
          // HLS.js will automatically handle loading new segments
        }

        videoElement.currentTime = clampedTime;
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
      if (hls) {
        hls.destroy();
        hls = null;
      }

      if (videoElement && videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement);
      }
      videoElement = null;
      api = null;
    },

    // Provider capability check
    canPlay: (source: string): boolean => {
      // Check if HLS is supported first
      if (!Hls.isSupported()) {
        // Check if native HLS is supported (Safari)
        const video = document.createElement('video');
        return video.canPlayType('application/vnd.apple.mpegurl') !== '';
      }

      // Check file extension
      const ext = source.split('.').pop()?.toLowerCase();
      return ext === 'm3u8';
    },

    // Provider load method
    loadSource,
  };

  return plugin;
};
