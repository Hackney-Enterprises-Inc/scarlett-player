/**
 * HLS Provider Plugin - Light Build
 *
 * Same functionality as the main plugin but uses hls.js/light for smaller bundle.
 * The light build excludes: subtitles, ID3 tags, and DRM/EME support.
 *
 * @packageDocumentation
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
  isHLSSupported,
  isHlsJsSupported,
  loadHlsJs,
  createHlsInstance,
  getHlsConstructor,
} from './hls-loader-light';
import { setupHlsEventHandlers, setupVideoEventHandlers } from './event-map';
import { mapLevels, formatLevel } from './quality';

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
  maxNetworkRetries: 3,
  maxMediaRetries: 2,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
};

/**
 * Create an HLS Provider Plugin instance (Light build).
 *
 * This version uses hls.js/light which is ~35% smaller but excludes:
 * - Subtitle/caption support (WebVTT)
 * - ID3 tag parsing
 * - DRM/EME support
 *
 * @param config - Plugin configuration
 * @returns HLS Plugin instance
 */
export function createHLSPlugin(config?: Partial<HLSPluginConfig>): IHLSPlugin {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  let api: IPluginAPI | null = null;
  let hls: HlsInstance | null = null;
  let video: HTMLVideoElement | null = null;
  let isNative = false;
  let currentSrc: string | null = null;
  let cleanupHlsEvents: (() => void) | null = null;
  let cleanupVideoEvents: (() => void) | null = null;
  let isAutoQuality = true;

  let networkRetryCount = 0;
  let mediaRetryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  let errorCount = 0;
  let errorWindowStart = 0;
  const MAX_ERRORS_IN_WINDOW = 10;
  const ERROR_WINDOW_MS = 5000;

  const getOrCreateVideo = (): HTMLVideoElement => {
    if (video) return video;

    const existing = api?.container.querySelector('video');
    if (existing) {
      video = existing as HTMLVideoElement;
      return video;
    }

    video = document.createElement('video');
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000';
    video.preload = 'metadata';
    video.controls = false;
    video.playsInline = true;

    api?.container.appendChild(video);
    return video;
  };

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
    isAutoQuality = true;
    networkRetryCount = 0;
    mediaRetryCount = 0;
    errorCount = 0;
    errorWindowStart = 0;
  };

  const buildHlsConfig = (): Record<string, unknown> => ({
    debug: mergedConfig.debug,
    autoStartLoad: mergedConfig.autoStartLoad,
    startPosition: mergedConfig.startPosition,
    startLevel: -1,
    lowLatencyMode: mergedConfig.lowLatencyMode,
    maxBufferLength: mergedConfig.maxBufferLength,
    maxMaxBufferLength: mergedConfig.maxMaxBufferLength,
    backBufferLength: mergedConfig.backBufferLength,
    enableWorker: mergedConfig.enableWorker,
    fragLoadingMaxRetry: 1,
    manifestLoadingMaxRetry: 1,
    levelLoadingMaxRetry: 1,
    fragLoadingRetryDelay: 500,
    manifestLoadingRetryDelay: 500,
    levelLoadingRetryDelay: 500,
  });

  const getRetryDelay = (retryCount: number): number => {
    const baseDelay = mergedConfig.retryDelayMs ?? 1000;
    const backoffFactor = mergedConfig.retryBackoffFactor ?? 2;
    return baseDelay * Math.pow(backoffFactor, retryCount);
  };

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

  const handleHlsError = (error: HLSError) => {
    const Hls = getHlsConstructor();
    if (!Hls || !hls) return;

    const now = Date.now();
    if (now - errorWindowStart > ERROR_WINDOW_MS) {
      errorCount = 1;
      errorWindowStart = now;
    } else {
      errorCount++;
    }

    if (errorCount >= MAX_ERRORS_IN_WINDOW) {
      api?.logger.error(`Too many errors (${errorCount} in ${ERROR_WINDOW_MS}ms), giving up`);
      emitFatalError(error, true);
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

          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

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

          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }

          retryTimeout = setTimeout(() => {
            if (hls) {
              hls.recoverMediaError();
            }
          }, delay);
          break;
        }

        default:
          emitFatalError(error, false);
          break;
      }
    }
  };

  const loadNative = async (src: string): Promise<void> => {
    const videoEl = getOrCreateVideo();
    isNative = true;

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

  const loadWithHlsJs = async (src: string): Promise<void> => {
    await loadHlsJs();

    const videoEl = getOrCreateVideo();
    isNative = false;

    hls = createHlsInstance(buildHlsConfig());

    if (api) {
      cleanupVideoEvents = setupVideoEventHandlers(videoEl, api);
    }

    return new Promise((resolve, reject) => {
      if (!hls || !api) {
        reject(new Error('HLS not initialized'));
        return;
      }

      let resolved = false;

      cleanupHlsEvents = setupHlsEventHandlers(hls, api, {
        onManifestParsed: () => {
          if (!resolved) {
            resolved = true;
            api?.setState('source', { src, type: 'application/x-mpegURL' });
            api?.emit('media:loaded', { src, type: 'application/x-mpegURL' });
            resolve();
          }
        },
        onLevelSwitched: () => {},
        onError: (error) => {
          handleHlsError(error);
          if (error.fatal && !resolved && error.type !== 'network' && error.type !== 'media') {
            resolved = true;
            reject(new Error(error.details));
          }
        },
        getIsAutoQuality: () => isAutoQuality,
      });

      hls.attachMedia(videoEl);
      hls.loadSource(src);
    });
  };

  const plugin: IHLSPlugin = {
    id: 'hls-provider',
    name: 'HLS Provider (Light)',
    version: '1.0.0',
    type: 'provider' as PluginType,
    description: 'HLS playback provider using hls.js/light (smaller bundle)',

    canPlay(src: string): boolean {
      if (!isHLSSupported()) return false;

      const url = src.toLowerCase();
      const urlWithoutQuery = url.split('?')[0].split('#')[0];
      if (urlWithoutQuery.endsWith('.m3u8')) return true;

      if (url.includes('application/x-mpegurl')) return true;
      if (url.includes('application/vnd.apple.mpegurl')) return true;

      return false;
    },

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      api.logger.info('HLS plugin (light) initialized');

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

      const unsubQuality = api.on('quality:select', ({ quality, auto }: { quality: string; auto?: boolean }) => {
        if (!hls || isNative) {
          api?.logger.warn('Quality selection not available');
          return;
        }

        if (auto || quality === 'auto') {
          isAutoQuality = true;
          hls.currentLevel = -1;
          api?.logger.debug('Quality: auto selection enabled');

          api?.setState('currentQuality', {
            id: 'auto',
            label: 'Auto',
            width: 0,
            height: 0,
            bitrate: 0,
            active: true,
          });
        } else {
          isAutoQuality = false;
          const levelIndex = parseInt(quality.replace('level-', ''), 10);
          if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < hls.levels.length) {
            hls.nextLevel = levelIndex;
            api?.logger.debug(`Quality: queued switch to level ${levelIndex}`);

            // Show pending state - actual switch happens when chunks load
            const targetLevel = hls.levels[levelIndex];
            if (targetLevel) {
              const label = formatLevel(targetLevel);
              api?.setState('currentQuality', {
                id: `level-${levelIndex}`,
                label: `${label}...`, // Ellipsis indicates switching in progress
                width: targetLevel.width,
                height: targetLevel.height,
                bitrate: targetLevel.bitrate,
                active: false, // Not yet active
              });
            }
          }
        }
      });

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
      api?.logger.info('HLS plugin (light) destroying');
      cleanup();

      if (video?.parentNode) {
        video.parentNode.removeChild(video);
      }
      video = null;
      api = null;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      api.logger.info('Loading HLS source (light)', { src });

      cleanup();
      currentSrc = src;

      api.setState('playbackState', 'loading');
      api.setState('buffering', true);

      if (isHlsJsSupported()) {
        api.logger.info('Using hls.js/light for HLS playback');
        await loadWithHlsJs(src);
      } else if (supportsNativeHLS()) {
        api.logger.info('Using native HLS playback (hls.js not supported)');
        await loadNative(src);
      } else {
        throw new Error('HLS playback not supported in this browser');
      }

      // Apply initial volume/muted state to video element
      // This must happen before autoplay for muted autoplay to work
      if (video) {
        const muted = api.getState('muted');
        const volume = api.getState('volume');
        if (muted !== undefined) video.muted = muted;
        if (volume !== undefined) video.volume = volume;
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

      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      cleanup();

      await loadNative(savedSrc);

      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

      if (wasPlaying && video) {
        try {
          await video.play();
        } catch (e) {
          api?.logger.debug('Could not auto-resume after switch');
        }
      }

      api?.logger.info('Switched to native HLS');
    },

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

      const wasPlaying = api?.getState('playing') || false;
      const currentTime = video?.currentTime || 0;
      const savedSrc = currentSrc;

      cleanup();

      await loadWithHlsJs(savedSrc);

      if (video && currentTime > 0) {
        video.currentTime = currentTime;
      }

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

export default createHLSPlugin;
