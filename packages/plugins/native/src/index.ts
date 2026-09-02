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
import { PKG_VERSION } from './version';

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
  /**
   * Watchdog for source loading in milliseconds (default: 30000, 0 disables).
   * Guarantees a load attempt terminates with an error instead of leaving
   * the viewer on a spinner when the network stalls without erroring.
   */
  loadTimeoutMs?: number;
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
 * import { createPlayer } from '@scarlett-player/core';
 * import { createNativePlugin } from '@scarlett-player/native';
 *
 * const player = await createPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [createNativePlugin()],
 * });
 *
 * await player.load('video.mp4');
 * ```
 */
export function createNativePlugin(config?: NativePluginConfig): INativePlugin {
  const preload = config?.preload ?? 'metadata';
  const load_timeout_ms = config?.loadTimeoutMs ?? 30000;

  // Plugin state
  let api: IPluginAPI | null = null;
  let video: HTMLVideoElement | null = null;
  let cleanupEvents: (() => void) | null = null;
  /** Last title THIS plugin derived from a filename (never an external title) */
  let derived_title: string | null = null;
  /**
   * Whether the source currently loaded is audio.
   *
   * Remembered rather than re-derived, because `applyPoster()` runs from a
   * state subscription with no source in hand and an audio player must never
   * grow a poster attribute (the element is display:none, and the audio UI
   * renders the artwork itself).
   */
  let is_audio_source = false;

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

  /**
   * Mirror the `poster` state key onto the media element.
   *
   * Called at element creation, on every `loadSource()`, and from the state
   * subscription in `init()`. The subscription is what makes `setPoster()`,
   * the playlist plugin's per-track artwork and the Vue `poster` prop take
   * effect on an element that already exists: the attribute survives an `src`
   * change, so without a re-apply the gap between a pre-roll and the feature
   * showed the PREVIOUS item's art.
   *
   * An empty state value clears the attribute, so a track without artwork
   * cannot inherit the last one's image.
   *
   * Audio keeps the attribute cleared regardless of state: the element is
   * hidden for audio and the audio UI draws the artwork itself.
   */
  const applyPoster = (): void => {
    if (!video) return;

    if (is_audio_source) {
      video.poster = '';
      return;
    }

    video.poster = api?.getState('poster') || '';
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
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;object-fit:contain;background:#000';
    video.preload = preload;
    video.controls = false;
    video.playsInline = true;

    applyPoster();

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

    /**
     * Mirror the element's own `ended` flag back onto the `ended` state key.
     *
     * `HTMLMediaElement.ended` is derived from the playback position, so it
     * goes false the moment the position leaves the end of the media:
     * `play()` on an ended element seeks to the earliest position before the
     * `play` event is fired, and a scrub back from the end flips it while
     * still paused. The state key is not derived. Until 2026-09-02 the only
     * writer that cleared it was `ScarlettPlayer.load()`, so after one replay
     * it stayed true for the rest of the session and the control bar's play
     * button kept the Replay glyph over playing video (the reason
     * `BigPlayButton` reads `video.ended` instead of the key).
     *
     * Called from `play`, `playing` and `seeking`: the three events that can
     * carry the position away from the end. The element is asked rather than
     * assumed, so a seek that lands ON the end leaves the key alone; setting
     * it true stays the `ended` handler's job.
     */
    const syncEndedFromElement = (): void => {
      if (!videoEl.ended) {
        api?.setState('ended', false);
      }
    };

    // Playback state events
    // 'play' fires immediately when video.play() is called
    on('play', () => {
      api?.setState('paused', false);
      syncEndedFromElement();
    });

    // 'playing' fires when playback actually starts (after buffering)
    on('playing', () => {
      api?.setState('playing', true);
      api?.setState('paused', false);
      api?.emit('playback:play', undefined);
      syncEndedFromElement();
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
      // A scrub back from the end never fires play or playing while paused, so
      // this is the only place the key can be cleared for a paused viewer.
      syncEndedFromElement();
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

    // Stall detection
    on('stalled', () => {
      api?.setState('buffering', true);
      api?.emit('media:stalled', undefined);
      api?.logger.warn('Media stalled - network may be slow');
    });

    on('suspend', () => {
      api?.emit('media:suspend', undefined);
    });

    on('abort', () => {
      api?.emit('media:abort', undefined);
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

    // Picture-in-Picture events (standard API). Without these the `pip`
    // state key never updates on the native provider and the UI's PiP
    // button reports a stale state.
    on('enterpictureinpicture', () => {
      api?.setState('pip', true);
      api?.logger.debug('PiP: entered (standard)');
    });

    on('leavepictureinpicture', () => {
      api?.setState('pip', false);
      api?.logger.debug('PiP: exited (standard)');
      // Resume playback if it was playing
      if (!videoEl.paused || api?.getState('playing')) {
        videoEl.play().catch(() => {});
      }
    });

    // Safari Picture-in-Picture events (webkit API)
    const webkitVideo = videoEl as HTMLVideoElement & {
      webkitPresentationMode?: string;
    };
    if ('webkitPresentationMode' in videoEl) {
      on('webkitpresentationmodechanged', () => {
        const mode = webkitVideo.webkitPresentationMode;
        api?.setState('pip', mode === 'picture-in-picture');
        api?.logger.debug(`PiP: mode changed to ${mode} (webkit)`);

        // Resume playback when exiting PiP on Safari
        if (mode === 'inline' && videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      });
    }

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
    version: PKG_VERSION,
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

      // Re-apply the poster whenever it changes. Without this the element
      // keeps whatever image it was created with, so setPoster(), a playlist
      // track change and a Vue prop change were all invisible to the viewer.
      const unsubPoster = api.subscribeToState((event) => {
        if (event.key === 'poster') applyPoster();
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubSeek();
        unsubVolume();
        unsubMute();
        unsubRate();
        unsubPoster();
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
      derived_title = null;
      is_audio_source = false;
    },

    async loadSource(src: string): Promise<void> {
      if (!api) throw new Error('Plugin not initialized');

      const ext = getExtension(src);
      const mimeType = getMimeType(ext);
      const isAudio = isAudioExtension(ext);
      is_audio_source = isAudio;

      api.logger.info('Loading native media source', { src, mimeType, isAudio });

      // Cleanup previous source
      cleanup();

      // Update state
      api.setState('playbackState', 'loading');
      api.setState('buffering', true);
      api.setState('mediaType', isAudio ? 'audio' : 'video');

      // Fallback title from the filename for audio (#45).
      //
      // Never clobber a title someone else set - e.g. playlist track metadata,
      // which is written to state BEFORE the load request reaches this plugin.
      // We remember the last title WE derived so our own stale fallback from a
      // previous source can be replaced, while an external title is respected.
      if (isAudio) {
        const current_title = api.getState('title');
        if (!current_title || current_title === derived_title) {
          try {
            const url = new URL(src, window.location.href);
            const filename = url.pathname.split('/').pop() || 'Audio';
            const title = decodeURIComponent(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
            derived_title = title;
            api.setState('title', title);
          } catch {
            derived_title = 'Audio';
            api.setState('title', 'Audio');
          }
        }
      }
      // Clear quality levels - native media has only one quality
      api.setState('qualities', []);
      api.setState('currentQuality', null);

      const videoEl = getOrCreateVideo();

      // Hide video element for audio content
      videoEl.style.display = isAudio ? 'none' : 'block';
      applyPoster();

      // Setup event listeners
      cleanupEvents = setupEventListeners(videoEl);

      return new Promise((resolve, reject) => {
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const settle = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onError);
          if (watchdog !== null) {
            clearTimeout(watchdog);
            watchdog = null;
          }
        };

        const onLoaded = () => {
          settle();

          // Apply initial volume/muted state to video element
          // This must happen before autoplay for muted autoplay to work
          const muted = api?.getState('muted');
          const volume = api?.getState('volume');
          if (muted !== undefined) videoEl.muted = muted;
          if (volume !== undefined) videoEl.volume = volume;

          api?.setState('source', { src, type: mimeType });
          api?.setState('playbackState', 'ready');
          api?.setState('buffering', false);
          api?.emit('media:loaded', { src, type: mimeType });

          resolve();
        };

        const onError = () => {
          settle();

          const error = videoEl.error;
          reject(new Error(error?.message || 'Failed to load video source'));
        };

        // Watchdog: a load must terminate. Without this, a request that
        // stalls without erroring pins the viewer on a spinner forever.
        if (load_timeout_ms > 0) {
          watchdog = setTimeout(() => {
            settle();
            reject(new Error('Video took too long to load (network timeout)'));
          }, load_timeout_ms);
        }

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
