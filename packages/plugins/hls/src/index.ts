/**
 * HLS Provider Plugin for Scarlett Player
 *
 * Provides HLS playback using hls.js or native HLS (Safari).
 * Features:
 * - Lazy loading of hls.js
 * - Native HLS fallback for Safari
 * - Quality level management
 * - Error recovery
 * - Live stream support
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';
import type {
  HLSPluginConfig,
  HLSQualityLevel,
  HLSError,
  HLSLiveInfo,
  IHLSPlugin,
  HlsInstance,
  HlsConstructor,
} from './types';
import {
  supportsNativeHLS,
  shouldPreferNativeHLS,
  isHLSSupported,
  isHlsJsSupported,
  loadHlsJs,
  createHlsInstance,
  getHlsConstructor,
} from './hls-loader';
import { setupHlsEventHandlers, setupVideoEventHandlers } from './event-map';
import { mapLevels, createQualityManager } from './quality';

// Re-export types
export type {
  HLSPluginConfig,
  HLSQualityLevel,
  HLSError,
  HLSLiveInfo,
  IHLSPlugin,
} from './types';

/** Default HLS config */
const DEFAULT_CONFIG: HLSPluginConfig = {
  debug: false,
  autoStartLoad: true,
  startPosition: -1,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 600,
  backBufferLength: 30,
  enableWorker: true,
  // Error recovery settings
  maxNetworkRetries: 3,
  maxMediaRetries: 2,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
};

/**
 * Create an HLS Provider Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns HLS Plugin instance
 *
 * @example
 * ```ts
 * import { createHLSPlugin } from '@scarlett-player/hls';
 *
 * const player = new ScarlettPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [createHLSPlugin()],
 * });
 *
 * await player.load('video.m3u8');
 * ```
 */
export function createHLSPlugin(config?: Partial<HLSPluginConfig>): IHLSPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Plugin state
  let api: IPluginAPI | null = null;
  let hls: HlsInstance | null = null;
  let video: HTMLVideoElement | null = null;
  let isNative = false;
  let currentSrc: string | null = null;
  let cleanupHlsEvents: (() => void) | null = null;
  let cleanupVideoEvents: (() => void) | null = null;
  let isAutoQuality = true; // Track if user has selected auto quality

  // Retry state
  let networkRetryCount = 0;
  let mediaRetryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  // Non-fatal error tracking - give up if too many errors in a short time
  let errorCount = 0;
  let errorWindowStart = 0;
  const MAX_ERRORS_IN_WINDOW = 10;
  const ERROR_WINDOW_MS = 5000; // 5 seconds

  /** Get video element from container */
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
    video.preload = 'metadata';
    video.controls = false;
    video.playsInline = true;

    // Set poster from state if available
    const poster = api?.getState('poster');
    if (poster) {
      video.poster = poster;
    }

    api?.container.appendChild(video);
    return video;
  };

  /** Cleanup current state */
  const cleanup = () => {
    cleanupHlsEvents?.();
    cleanupHlsEvents = null;

    cleanupVideoEvents?.();
    cleanupVideoEvents = null;

    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    if (hls) {
      hls.destroy();
      hls = null;
    }

    currentSrc = null;
    isNative = false;
    isAutoQuality = true; // Reset to auto when loading new source
    networkRetryCount = 0;
    mediaRetryCount = 0;
    errorCount = 0;
    errorWindowStart = 0;
  };

  /** Build hls.js config */
  const buildHlsConfig = (): Record<string, unknown> => ({
    debug: mergedConfig.debug,
    autoStartLoad: mergedConfig.autoStartLoad,
    startPosition: mergedConfig.startPosition,
    startLevel: -1, // Auto quality selection (ABR)
    lowLatencyMode: mergedConfig.lowLatencyMode,
    maxBufferLength: mergedConfig.maxBufferLength,
    maxMaxBufferLength: mergedConfig.maxMaxBufferLength,
    backBufferLength: mergedConfig.backBufferLength,
    enableWorker: mergedConfig.enableWorker,
    // Minimize hls.js internal retries - we handle retries ourselves
    fragLoadingMaxRetry: 1,
    manifestLoadingMaxRetry: 1,
    levelLoadingMaxRetry: 1,
    fragLoadingRetryDelay: 500,
    manifestLoadingRetryDelay: 500,
    levelLoadingRetryDelay: 500,
  });

  /** Calculate retry delay with exponential backoff */
  const getRetryDelay = (retryCount: number): number => {
    const baseDelay = mergedConfig.retryDelayMs ?? 1000;
    const backoffFactor = mergedConfig.retryBackoffFactor ?? 2;
    return baseDelay * Math.pow(backoffFactor, retryCount);
  };

  /** Emit fatal error and stop playback */
  const emitFatalError = (error: HLSError, retriesExhausted: boolean) => {
    const message = retriesExhausted
      ? `HLS error: ${error.details} (max retries exceeded)`
      : `HLS error: ${error.details}`;

    api?.logger.error(message, { type: error.type, details: error.details });
    api?.setState('playbackState', 'error');
    api?.setState('buffering', false);

    api?.emit('error', {
      code: 'MEDIA_ERROR' as any,
      message,
      fatal: true,
      timestamp: Date.now(),
    });
  };

  /** Handle HLS errors with recovery and retry limits */
  const handleHlsError = (error: HLSError) => {
    const Hls = getHlsConstructor();
    if (!Hls || !hls) return;

    // Track all errors (fatal and non-fatal) to detect error storms
    const now = Date.now();
    if (now - errorWindowStart > ERROR_WINDOW_MS) {
      // Reset window
      errorCount = 1;
      errorWindowStart = now;
    } else {
      errorCount++;
    }

    // If too many errors in the time window, treat as fatal
    if (errorCount >= MAX_ERRORS_IN_WINDOW) {
      api?.logger.error(`Too many errors (${errorCount} in ${ERROR_WINDOW_MS}ms), giving up`);
      emitFatalError(error, true);

      // Completely destroy hls.js to stop all activity
      cleanupHlsEvents?.();
      cleanupHlsEvents = null;
      hls.destroy();
      hls = null;
      return;
    }

    if (error.fatal) {
      api?.logger.error('Fatal HLS error', { type: error.type, details: error.details });

      switch (error.type) {
        case 'network': {
          const maxRetries = mergedConfig.maxNetworkRetries ?? 3;

          if (networkRetryCount >= maxRetries) {
            api?.logger.error(`Network error recovery failed after ${networkRetryCount} attempts`);
            emitFatalError(error, true);
            return;
          }

          networkRetryCount++;
          const delay = getRetryDelay(networkRetryCount - 1);

          api?.logger.info(`Attempting network error recovery (attempt ${networkRetryCount}/${maxRetries}) in ${delay}ms`);
          api?.emit('error:network', { error: new Error(error.details) });

          // Clear any existing retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

          // Retry with exponential backoff
          retryTimeout = setTimeout(() => {
            if (hls) {
              hls.startLoad();
            }
          }, delay);
          break;
        }

        case 'media': {
          const maxRetries = mergedConfig.maxMediaRetries ?? 2;

          if (mediaRetryCount >= maxRetries) {
            api?.logger.error(`Media error recovery failed after ${mediaRetryCount} attempts`);
            emitFatalError(error, true);
            return;
          }

          mediaRetryCount++;
          const delay = getRetryDelay(mediaRetryCount - 1);

          api?.logger.info(`Attempting media error recovery (attempt ${mediaRetryCount}/${maxRetries}) in ${delay}ms`);
          api?.emit('error:media', { error: new Error(error.details) });

          // Clear any existing retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

          // Retry with exponential backoff
          retryTimeout = setTimeout(() => {
            if (hls) {
              hls.recoverMediaError();
            }
          }, delay);
          break;
        }

        default:
          // Unrecoverable error - no retry
          emitFatalError(error, false);
          break;
      }
    }
  };

  /** Load source using native HLS */
  const loadNative = async (src: string): Promise<void> => {
    const videoEl = getOrCreateVideo();
    isNative = true;

    // Setup video event handlers
    if (api) {
      cleanupVideoEvents = setupVideoEventHandlers(videoEl, api);
    }

    return new Promise((resolve, reject) => {
      const onLoaded = () => {
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        videoEl.removeEventListener('error', onError);

        api?.setState('source', { src, type: 'application/x-mpegURL' });
        api?.emit('media:loaded', { src, type: 'application/x-mpegURL' });

        resolve();
      };

      const onError = () => {
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        videoEl.removeEventListener('error', onError);

        const error = videoEl.error;
        reject(new Error(error?.message || 'Failed to load HLS source'));
      };

      videoEl.addEventListener('loadedmetadata', onLoaded);
      videoEl.addEventListener('error', onError);
      videoEl.src = src;
      videoEl.load();
    });
  };

  /** Load source using hls.js */
  const loadWithHlsJs = async (src: string): Promise<void> => {
    // Lazy load hls.js
    await loadHlsJs();

    const videoEl = getOrCreateVideo();
    isNative = false;

    // Create hls.js instance
    hls = createHlsInstance(buildHlsConfig());

    // Setup video event handlers
    if (api) {
      cleanupVideoEvents = setupVideoEventHandlers(videoEl, api);
    }

    return new Promise((resolve, reject) => {
      if (!hls || !api) {
        reject(new Error('HLS not initialized'));
        return;
      }

      let resolved = false;

      // Setup hls.js event handlers
      cleanupHlsEvents = setupHlsEventHandlers(hls, api, {
        onManifestParsed: () => {
          if (!resolved) {
            resolved = true;
            api?.setState('source', { src, type: 'application/x-mpegURL' });
            api?.emit('media:loaded', { src, type: 'application/x-mpegURL' });
            resolve();
          }
        },
        onLevelSwitched: () => {
          // Already handled in event-map
        },
        onError: (error) => {
          handleHlsError(error);
          if (error.fatal && !resolved && error.type !== 'network' && error.type !== 'media') {
            resolved = true;
            reject(new Error(error.details));
          }
        },
        getIsAutoQuality: () => isAutoQuality,
      });

      // Attach to video and load
      hls.attachMedia(videoEl);
      hls.loadSource(src);
    });
  };

  // Plugin implementation
  const plugin: IHLSPlugin = {
    id: 'hls-provider',
    name: 'HLS Provider',
    version: '1.0.0',
    type: 'provider' as PluginType,
    description: 'HLS playback provider using hls.js',

    canPlay(src: string): boolean {
      if (!isHLSSupported()) return false;

      // Check file extension (strip query strings and fragments first)
      const url = src.toLowerCase();
      const urlWithoutQuery = url.split('?')[0].split('#')[0];
      if (urlWithoutQuery.endsWith('.m3u8')) return true;

      // Check MIME type hint in URL
      if (url.includes('application/x-mpegurl')) return true;
      if (url.includes('application/vnd.apple.mpegurl')) return true;

      return false;
    },

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('HLS plugin initialized');

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

      // Handle quality selection from UI
      const unsubQuality = api.on('quality:select', ({ quality, auto }: { quality: string; auto?: boolean }) => {
        if (!hls || isNative) {
          api?.logger.warn('Quality selection not available');
          return;
        }

        if (auto || quality === 'auto') {
          // Enable auto quality selection
          isAutoQuality = true;
          hls.currentLevel = -1;
          api?.logger.debug('Quality: auto selection enabled');

          // Update state immediately to show "Auto"
          api?.setState('currentQuality', {
            id: 'auto',
            label: 'Auto',
            width: 0,
            height: 0,
            bitrate: 0,
            active: true,
          });
        } else {
          // Find level index by id (e.g., 'level-0', 'level-1')
          isAutoQuality = false;
          const levelIndex = parseInt(quality.replace('level-', ''), 10);
          if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < hls.levels.length) {
            hls.nextLevel = levelIndex;
            api?.logger.debug(`Quality: queued switch to level ${levelIndex}`);
          }
        }
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubSeek();
        unsubVolume();
        unsubMute();
        unsubRate();
        unsubQuality();
      });
    },

    async destroy(): Promise<void> {
      api?.logger.info('HLS plugin destroying');
      cleanup();

      if (video?.parentNode) {
        video.parentNode.removeChild(video);
      }
      video = null;
      api = null;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      api.logger.info('Loading HLS source', { src });

      // Cleanup previous source
      cleanup();
      currentSrc = src;

      // Update state
      api.setState('playbackState', 'loading');
      api.setState('buffering', true);

      // Use hls.js when available for quality control
      // We'll switch to native HLS dynamically when AirPlay is requested
      if (isHlsJsSupported()) {
        api.logger.info('Using hls.js for HLS playback');
        await loadWithHlsJs(src);
      } else if (supportsNativeHLS()) {
        api.logger.info('Using native HLS playback (hls.js not supported)');
        await loadNative(src);
      } else {
        throw new Error('HLS playback not supported in this browser');
      }

      api.setState('playbackState', 'ready');
      api.setState('buffering', false);
    },

    getCurrentLevel(): number {
      if (isNative || !hls) return -1;
      return hls.currentLevel;
    },

    setLevel(index: number): void {
      if (isNative || !hls) {
        api?.logger.warn('Quality selection not available in native HLS mode');
        return;
      }
      hls.currentLevel = index;
    },

    getLevels(): HLSQualityLevel[] {
      if (isNative || !hls) return [];
      return mapLevels(hls.levels, hls.currentLevel);
    },

    getHlsInstance(): HlsInstance | null {
      return hls;
    },

    isNativeHLS(): boolean {
      return isNative;
    },

    getLiveInfo(): HLSLiveInfo | null {
      if (isNative || !hls) return null;

      const live = api?.getState('live') || false;
      if (!live) return null;

      return {
        isLive: true,
        latency: hls.latency || 0,
        targetLatency: hls.targetLatency || 3,
        drift: hls.drift || 0,
      };
    },

    /**
     * Switch from hls.js to native HLS playback.
     * Used for AirPlay compatibility in Safari.
     * Preserves current playback position.
     */
    async switchToNative(): Promise<void> {
      if (isNative) {
        api?.logger.debug('Already using native HLS');
        return;
      }

      if (!supportsNativeHLS()) {
        api?.logger.warn('Native HLS not supported in this browser');
        return;
      }

      if (!currentSrc) {
        api?.logger.warn('No source loaded');
        return;
      }

      api?.logger.info('Switching to native HLS for AirPlay');

      // Save current state
      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      // Cleanup hls.js
      cleanup();

      // Load with native HLS
      await loadNative(savedSrc);

      // Restore position
      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

      // Resume if was playing
      if (wasPlaying && video) {
        try {
          await video.play();
        } catch (e) {
          api?.logger.debug('Could not auto-resume after switch');
        }
      }

      api?.logger.info('Switched to native HLS');
    },

    /**
     * Switch from native HLS back to hls.js.
     * Restores quality control after AirPlay session ends.
     */
    async switchToHlsJs(): Promise<void> {
      if (!isNative) {
        api?.logger.debug('Already using hls.js');
        return;
      }

      if (!isHlsJsSupported()) {
        api?.logger.warn('hls.js not supported in this browser');
        return;
      }

      if (!currentSrc) {
        api?.logger.warn('No source loaded');
        return;
      }

      api?.logger.info('Switching back to hls.js');

      // Save current state
      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      // Cleanup native
      cleanup();

      // Load with hls.js
      await loadWithHlsJs(savedSrc);

      // Restore position
      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

      // Resume if was playing
      if (wasPlaying && video) {
        try {
          await video.play();
        } catch (e) {
          api?.logger.debug('Could not auto-resume after switch');
        }
      }

      api?.logger.info('Switched to hls.js');
    },
  };

  return plugin;
}

// Default export
export default createHLSPlugin;
