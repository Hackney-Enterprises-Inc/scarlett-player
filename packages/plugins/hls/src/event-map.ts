/**
 * HLS Event Mapping
 *
 * Maps hls.js events to Scarlett Player events.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { HlsInstance, HlsLevel, HLSError, HLSErrorType } from './types';
import { formatLevel } from './quality';

/** hls.js event names (avoiding import to keep bundle small) */
export const HLS_EVENTS = {
  MEDIA_ATTACHED: 'hlsMediaAttached',
  MEDIA_DETACHED: 'hlsMediaDetached',
  MANIFEST_LOADING: 'hlsManifestLoading',
  MANIFEST_LOADED: 'hlsManifestLoaded',
  MANIFEST_PARSED: 'hlsManifestParsed',
  LEVEL_LOADED: 'hlsLevelLoaded',
  LEVEL_SWITCHING: 'hlsLevelSwitching',
  LEVEL_SWITCHED: 'hlsLevelSwitched',
  FRAG_LOADING: 'hlsFragLoading',
  FRAG_LOADED: 'hlsFragLoaded',
  FRAG_BUFFERED: 'hlsFragBuffered',
  BUFFER_APPENDING: 'hlsBufferAppending',
  BUFFER_APPENDED: 'hlsBufferAppended',
  ERROR: 'hlsError',
} as const;

/** hls.js error types */
export const HLS_ERROR_TYPES = {
  NETWORK_ERROR: 'networkError',
  MEDIA_ERROR: 'mediaError',
  KEY_SYSTEM_ERROR: 'keySystemError',
  MUX_ERROR: 'muxError',
  OTHER_ERROR: 'otherError',
} as const;

/** Map hls.js error type to our error type */
export function mapErrorType(hlsType: string): HLSErrorType {
  switch (hlsType) {
    case HLS_ERROR_TYPES.NETWORK_ERROR:
      return 'network';
    case HLS_ERROR_TYPES.MEDIA_ERROR:
      return 'media';
    case HLS_ERROR_TYPES.MUX_ERROR:
      return 'mux';
    default:
      return 'other';
  }
}

/** Parse hls.js error data into our format */
export function parseHlsError(data: Record<string, unknown>): HLSError {
  return {
    type: mapErrorType(data.type as string),
    details: data.details as string || 'Unknown error',
    fatal: data.fatal as boolean || false,
    url: data.url as string | undefined,
    reason: data.reason as string | undefined,
    response: data.response as { code: number; text: string } | undefined,
  };
}

/**
 * Setup hls.js event handlers that map to Scarlett events.
 *
 * @param hls - hls.js instance
 * @param api - Plugin API
 * @param onLevelsReady - Callback when quality levels are available
 * @param onError - Callback for error handling
 */
export function setupHlsEventHandlers(
  hls: HlsInstance,
  api: IPluginAPI,
  callbacks: {
    onManifestParsed?: (levels: HlsLevel[]) => void;
    onLevelSwitched?: (level: number) => void;
    onBufferUpdate?: () => void;
    onError?: (error: HLSError) => void;
    onLiveUpdate?: () => void;
    getIsAutoQuality?: () => boolean;
  }
): () => void {
  const handlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  const addHandler = (event: string, handler: (...args: any[]) => void) => {
    hls.on(event, handler);
    handlers.push({ event, handler });
  };

  // Manifest parsed - quality levels available
  addHandler('hlsManifestParsed', (_event: string, data: { levels: HlsLevel[] }) => {
    api.logger.debug('HLS manifest parsed', { levels: data.levels.length });

    // Update qualities in state
    const levels = data.levels.map((level, index) => ({
      id: `level-${index}`,
      label: formatLevel(level),
      width: level.width,
      height: level.height,
      bitrate: level.bitrate,
      active: index === hls.currentLevel,
    }));

    api.setState('qualities', levels);

    // Emit quality levels event
    api.emit('quality:levels', {
      levels: levels.map((l) => ({ id: l.id, label: l.label })),
    });

    callbacks.onManifestParsed?.(data.levels);
  });

  // Level switched
  addHandler('hlsLevelSwitched', (_event: string, data: { level: number }) => {
    const level = hls.levels[data.level];
    // Use our tracked auto quality state, fallback to hls.autoLevelEnabled
    const isAuto = callbacks.getIsAutoQuality?.() ?? hls.autoLevelEnabled;
    api.logger.debug('HLS level switched', { level: data.level, height: level?.height, auto: isAuto });

    // Update current quality in state
    // Show "Auto" label when ABR is enabled, otherwise show the actual level
    if (level) {
      const label = isAuto ? `Auto (${formatLevel(level)})` : formatLevel(level);
      api.setState('currentQuality', {
        id: isAuto ? 'auto' : `level-${data.level}`,
        label,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        active: true,
      });
    }

    // Emit quality change event
    api.emit('quality:change', {
      quality: level ? formatLevel(level) : 'auto',
      auto: isAuto,
    });

    callbacks.onLevelSwitched?.(data.level);
  });

  // Fragment buffered - update buffering state
  addHandler('hlsFragBuffered', () => {
    api.setState('buffering', false);
    callbacks.onBufferUpdate?.();
  });

  // Fragment loading - update buffering state
  addHandler('hlsFragLoading', () => {
    api.setState('buffering', true);
  });

  // Level loaded - may contain live stream info
  addHandler('hlsLevelLoaded', (_event: string, data: { details: { live?: boolean } }) => {
    if (data.details?.live !== undefined) {
      api.setState('live', data.details.live);
      callbacks.onLiveUpdate?.();
    }
  });

  // Error handling
  addHandler('hlsError', (_event: string, data: Record<string, unknown>) => {
    const error = parseHlsError(data);
    api.logger.warn('HLS error', { error });
    callbacks.onError?.(error);
  });

  // Return cleanup function
  return () => {
    for (const { event, handler } of handlers) {
      hls.off(event, handler);
    }
    handlers.length = 0;
  };
}

/**
 * Setup HTML5 video element event handlers.
 *
 * @param video - Video element
 * @param api - Plugin API
 */
export function setupVideoEventHandlers(
  video: HTMLVideoElement,
  api: IPluginAPI
): () => void {
  const handlers: Array<{ event: string; handler: EventListener }> = [];

  const addHandler = (event: string, handler: EventListener) => {
    video.addEventListener(event, handler);
    handlers.push({ event, handler });
  };

  // Playback events
  addHandler('playing', () => {
    api.setState('playing', true);
    api.setState('paused', false);
    api.setState('playbackState', 'playing');
  });

  addHandler('pause', () => {
    api.setState('playing', false);
    api.setState('paused', true);
    api.setState('playbackState', 'paused');
  });

  addHandler('ended', () => {
    api.setState('playing', false);
    api.setState('ended', true);
    api.setState('playbackState', 'ended');
    api.emit('playback:ended', undefined);
  });

  // Time updates
  addHandler('timeupdate', () => {
    api.setState('currentTime', video.currentTime);
    api.emit('playback:timeupdate', { currentTime: video.currentTime });
  });

  addHandler('durationchange', () => {
    api.setState('duration', video.duration || 0);
    api.emit('media:loadedmetadata', { duration: video.duration || 0 });
  });

  // Buffering
  addHandler('waiting', () => {
    api.setState('waiting', true);
    api.setState('buffering', true);
    api.emit('media:waiting', undefined);
  });

  addHandler('canplay', () => {
    api.setState('waiting', false);
    api.setState('playbackState', 'ready');
    api.emit('media:canplay', undefined);
  });

  addHandler('canplaythrough', () => {
    api.setState('buffering', false);
    api.emit('media:canplaythrough', undefined);
  });

  addHandler('progress', () => {
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedAmount = video.duration > 0 ? bufferedEnd / video.duration : 0;
      api.setState('bufferedAmount', bufferedAmount);
      api.setState('buffered', video.buffered);
      api.emit('media:progress', { buffered: bufferedAmount });
    }
  });

  // Seeking - only emit state update, not playback:seeking (which would cause a loop)
  addHandler('seeking', () => {
    api.setState('seeking', true);
  });

  addHandler('seeked', () => {
    api.setState('seeking', false);
    api.emit('playback:seeked', { time: video.currentTime });
  });

  // Volume
  addHandler('volumechange', () => {
    api.setState('volume', video.volume);
    api.setState('muted', video.muted);
    api.emit('volume:change', { volume: video.volume, muted: video.muted });
  });

  // Rate
  addHandler('ratechange', () => {
    api.setState('playbackRate', video.playbackRate);
    api.emit('playback:ratechange', { rate: video.playbackRate });
  });

  // Metadata loaded
  addHandler('loadedmetadata', () => {
    api.setState('duration', video.duration);
    api.setState('mediaType', video.videoWidth > 0 ? 'video' : 'audio');
  });

  // Errors
  addHandler('error', () => {
    const error = video.error;
    if (error) {
      api.logger.error('Video element error', { code: error.code, message: error.message });
      api.emit('media:error', { error: new Error(error.message || 'Video playback error') });
    }
  });

  // Picture-in-Picture events (standard API)
  addHandler('enterpictureinpicture', () => {
    api.setState('pip', true);
    api.logger.debug('PiP: entered (standard)');
  });

  addHandler('leavepictureinpicture', () => {
    api.setState('pip', false);
    api.logger.debug('PiP: exited (standard)');
    // Resume playback if it was playing
    if (!video.paused || api.getState('playing')) {
      video.play().catch(() => {});
    }
  });

  // Safari Picture-in-Picture events (webkit API)
  const webkitVideo = video as HTMLVideoElement & {
    webkitPresentationMode?: string;
  };
  if ('webkitPresentationMode' in video) {
    addHandler('webkitpresentationmodechanged', () => {
      const mode = webkitVideo.webkitPresentationMode;
      const isInPip = mode === 'picture-in-picture';
      api.setState('pip', isInPip);
      api.logger.debug(`PiP: mode changed to ${mode} (webkit)`);

      // Resume playback when exiting PiP on Safari
      if (mode === 'inline' && video.paused) {
        video.play().catch(() => {});
      }
    });
  }

  // Return cleanup function
  return () => {
    for (const { event, handler } of handlers) {
      video.removeEventListener(event, handler);
    }
    handlers.length = 0;
  };
}
