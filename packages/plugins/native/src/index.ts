/**
 * Native Media Provider Plugin for Scarlett Player
 *
 * Provides playback for native browser-supported formats:
 *
 * Video:
 * - MP4 (H.264/AAC)
 * - WebM (VP8/VP9/Opus)
 * - MOV (H.264/AAC)
 * - MKV (varies by browser)
 * - OGG/OGV (Theora/Vorbis)
 *
 * Audio:
 * - MP3 (MPEG Audio Layer 3)
 * - WAV (Waveform Audio)
 * - OGG (Vorbis)
 * - FLAC (Free Lossless Audio Codec)
 * - AAC (Advanced Audio Coding)
 * - M4A (MPEG-4 Audio)
 */

import { ErrorCode, type IPluginAPI, type PluginType } from '@scarlett-player/core';

/** Supported video extensions */
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'ogv', 'm4v'];

/** Supported audio extensions */
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba'];

/** All supported extensions */
const SUPPORTED_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];

const MIME_TYPES: Record<string, string> = {
  // Video
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  opus: 'audio/opus',
  weba: 'audio/webm',
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
      const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
      return ext;
    } catch {
      const rawExt = src.split('.').pop()?.toLowerCase() ?? '';
      return rawExt.split('?')[0] ?? ''; // Remove query string
    }
  };

  /** Get MIME type for extension */
  const getMimeType = (ext: string): string => {
    return MIME_TYPES[ext] || 'video/mp4';
  };

  /** Check if extension is audio */
  const isAudioExtension = (ext: string): boolean => {
    return AUDIO_EXTENSIONS.includes(ext);
  };

  /** Check if browser can play this MIME type */
  const canBrowserPlay = (mimeType: string): boolean => {
    // Use audio element for audio MIME types, video for video
    const isAudio = mimeType.startsWith('audio/');
    const testElement = isAudio
      ? document.createElement('audio')
      : document.createElement('video');
    const canPlay = testElement.canPlayType(mimeType);
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

    // Set poster from state if available
    const poster = api?.getState('poster');
    if (poster) {
      video.poster = poster;
    }

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
      api?.emit('playback:play', undefined);
    });

    on('pause', () => {
      api?.setState('playing', false);
      api?.setState('paused', true);
      api?.emit('playback:pause', undefined);
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
    });

    // Loading events
    on('loadedmetadata', () => {
      api?.setState('duration', videoEl.duration || 0);
      api?.emit('media:loadedmetadata', { duration: videoEl.duration || 0 });
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

    // Seeking events - only emit state update, not playback:seeking (which would cause a loop)
    on('seeking', () => {
      api?.setState('seeking', true);
    });

    on('seeked', () => {
      api?.setState('seeking', false);
      api?.emit('playback:seeked', { time: videoEl.currentTime });
    });

    // Volume events
    on('volumechange', () => {
      api?.setState('volume', videoEl.volume);
      api?.setState('muted', videoEl.muted);
      api?.emit('volume:change', { volume: videoEl.volume, muted: videoEl.muted });
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
        code: ErrorCode.PLAYBACK_FAILED,
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
    name: 'Native Media Provider',
    version: '1.0.0',
    type: 'provider' as PluginType,
    description: 'Native HTML5 playback for video (MP4, WebM, MOV) and audio (MP3, WAV, FLAC, AAC)',

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

      const unsubVolume = api.on('volume:change', ({ volume, muted }: { volume: number; muted: boolean }) => {
        if (video) {
          video.volume = volume;
          video.muted = muted;
        }
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
      const isAudio = isAudioExtension(ext);

      api.logger.info('Loading native media source', { src, mimeType, isAudio });

      // Cleanup previous source
      cleanup();

      // Update state
      api.setState('playbackState', 'loading');
      api.setState('buffering', true);
      api.setState('mediaType', isAudio ? 'audio' : 'video');

      // Set title from filename if audio and no title is already set
      if (isAudio) {
        try {
          const url = new URL(src, window.location.href);
          const filename = url.pathname.split('/').pop() || 'Audio';
          const title = decodeURIComponent(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
          api.setState('title', title);
        } catch {
          api.setState('title', 'Audio');
        }
      }
      // Clear quality levels - native media has only one quality
      api.setState('qualities', []);
      api.setState('currentQuality', null);

      const videoEl = getOrCreateVideo();

      // Hide video element for audio content
      if (isAudio) {
        videoEl.style.display = 'none';
        videoEl.poster = ''; // Clear poster for audio
      } else {
        videoEl.style.display = 'block';
        // Set poster from state if available
        const poster = api.getState('poster');
        if (poster) {
          videoEl.poster = poster;
        }
      }

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
