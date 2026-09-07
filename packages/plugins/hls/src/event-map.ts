/**
 * HLS Event Mapping
 *
 * Maps hls.js events to Scarlett Player events.
 */

import type { IPluginAPI } from '@scarlett-player/core';
import type { AudioTrack } from '@scarlett-player/core';
import type { HlsAudioTrack, HlsInstance, HlsLevel, HLSError, HLSErrorType } from './types';
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
  AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
  AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
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
 * Stable id for an alternate audio rendition.
 *
 * Index-based, like the quality ids: hls.js switches renditions by index into
 * `hls.audioTracks`, so an id that carries the index is what lets a selection
 * round-trip without a lookup table.
 *
 * @param index - Position in `hls.audioTracks`
 * @returns The id used in player state and in `track:audio` payloads
 */
export function audioTrackId(index: number): string {
  return `audio-${index}`;
}

/**
 * Parse an id produced by {@link audioTrackId} back to its index.
 *
 * @param id - Track id, or null
 * @returns The index, or -1 when the id is not one of ours
 */
export function audioTrackIndex(id: string | null): number {
  if (!id) return -1;

  const index = Number.parseInt(id.replace('audio-', ''), 10);

  return Number.isNaN(index) ? -1 : index;
}

/**
 * Map an hls.js audio rendition onto the player's own AudioTrack shape.
 *
 * @param track - Rendition as hls.js reports it
 * @param index - Its position in `hls.audioTracks`
 * @param active - Whether it is the rendition currently playing
 * @returns Player-facing audio track
 */
export function formatAudioTrack(
  track: HlsAudioTrack,
  index: number,
  active: boolean
): AudioTrack {
  return {
    id: audioTrackId(index),
    // A manifest may declare neither NAME nor LANGUAGE; a numbered fallback
    // still gives the viewer something selectable rather than a blank row.
    label: track.name || track.lang || `Audio ${index + 1}`,
    language: track.lang,
    active,
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
    onFragLoaded?: () => void;
    getIsAutoQuality?: () => boolean;
    onAudioTracksUpdated?: (tracks: HlsAudioTrack[]) => void;
    onAudioTrackSwitched?: (index: number) => void;
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

  /** Publish the current rendition list and selection to player state. */
  const publishAudioTracks = (tracks: HlsAudioTrack[], activeIndex: number): void => {
    const audioTracks = tracks.map((track, index) =>
      formatAudioTrack(track, index, index === activeIndex)
    );

    api.setState('audioTracks', audioTracks);
    api.setState('currentAudioTrack', audioTracks[activeIndex] ?? null);
  };

  // Alternate audio renditions became available (or changed with the manifest)
  addHandler('hlsAudioTracksUpdated', (_event: string, data: { audioTracks: HlsAudioTrack[] }) => {
    const tracks = data.audioTracks ?? [];
    api.logger.debug('HLS audio tracks updated', { tracks: tracks.length });

    publishAudioTracks(tracks, hls.audioTrack);
    callbacks.onAudioTracksUpdated?.(tracks);
  });

  // Rendition switch completed
  addHandler('hlsAudioTrackSwitched', (_event: string, data: { id: number }) => {
    api.logger.debug('HLS audio track switched', { id: data.id });

    // No event emitted back: `currentAudioTrack` state is the feedback channel,
    // exactly as it is for text tracks, and `track:audio` is the request.
    publishAudioTracks(hls.audioTracks ?? [], data.id);
    callbacks.onAudioTrackSwitched?.(data.id);
  });

  // Fragment loaded - update bandwidth estimate
  let lastBandwidthUpdate = 0;
  addHandler('hlsFragLoaded', () => {
    const now = Date.now();
    if (now - lastBandwidthUpdate >= 2000 && hls.bandwidthEstimate) {
      lastBandwidthUpdate = now;
      api.setState('bandwidth', Math.round(hls.bandwidthEstimate));
    }
    callbacks.onFragLoaded?.();
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

  // Level loaded - may contain live stream info and DVR window
  addHandler('hlsLevelLoaded', (_event: string, data: { details: { live?: boolean; totalduration?: number; targetduration?: number; fragmentStart?: number; edge?: number; fragments?: Array<{ start?: number }> } }) => {
    if (data.details?.live !== undefined) {
      api.setState('live', data.details.live);

      // For live streams, compute seekable range from the level details
      // rather than from the media element. Under MSE (hls.js),
      // video.seekable.start(0) remains 0 instead of reflecting the real
      // sliding window (details.fragmentStart). Scrubbing to the start
      // of the bar then triggers hls.js to jump back to live.
      if (data.details.live) {
        const details = data.details;
        const start = details.fragmentStart ?? (details.fragments?.[0]?.start ?? 0);
        const end = details.edge ?? details.totalduration ?? 0;
        api.setState('seekableRange', { start, end });

        const video = hls.media as HTMLVideoElement | null;
        if (video) {
          const latency = Math.max(0, end - video.currentTime);
          api.setState('liveLatency', latency);
          api.setState('liveEdge', latency < ((details.targetduration ?? 3) * 3));
        }
      }

      callbacks.onLiveUpdate?.();
    }
  });

  // Error handling
  addHandler('hlsError', (_event: string, data: Record<string, unknown>) => {
    const error = parseHlsError(data);

    // Buffer hole/stall seeking is a common non-fatal recovery action, not a real error
    const isBufferHoleSeek = !error.fatal && (
      (error.details as string)?.includes('bufferStalledError') ||
      (data.reason as string)?.includes('buffer holes')
    );

    if (isBufferHoleSeek) {
      api.logger.debug(`HLS buffer recovery: ${error.reason || error.details}`, {
        details: error.details,
        reason: error.reason,
      });
    } else if (error.fatal) {
      api.logger.error(`HLS fatal error: ${error.details} (type=${error.type})`, {
        type: error.type,
        details: error.details,
        url: error.url,
      });
    } else {
      api.logger.warn(`HLS error: ${error.details} (type=${error.type}, fatal=${error.fatal})`, {
        type: error.type,
        details: error.details,
        fatal: error.fatal,
        url: error.url,
      });
    }

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

  /**
   * Mirror the element's own `ended` flag back onto the `ended` state key.
   *
   * `HTMLMediaElement.ended` is derived from the playback position, so it goes
   * false the moment the position leaves the end of the media: `play()` on an
   * ended element seeks to the earliest position before the `play` event is
   * fired, and a scrub back from the end flips it while still paused. The
   * state key is not derived. Until 2026-09-02 the only writer that cleared it
   * was `ScarlettPlayer.load()`, so after one replay it stayed true for the
   * rest of the session and the control bar's play button kept the Replay
   * glyph over playing video (the reason `BigPlayButton` reads `video.ended`
   * instead of the key).
   *
   * Called from `play`, `playing` and `seeking`: the three events that can
   * carry the position away from the end. The element is asked rather than
   * assumed, so a seek that lands ON the end leaves the key alone; setting it
   * true stays the `ended` handler's job.
   *
   * Clearing the key also re-derives `playbackState` from the element, for the
   * same reason: the `ended` handler writes `'ended'` there, and nothing wrote
   * it again after a paused scrub away from the end, so the key sat at
   * `'ended'` over a player the viewer had just parked mid-video (second
   * review of the 1.7.1 wave, 2026-09-02). `video.paused` decides between
   * `'paused'` and `'playing'` rather than the `playing` state key, which the
   * `playing` handler has not written yet during a replay.
   *
   * Both writes are gated on the key having been true, read back through
   * `getState`, so an ordinary seek in the middle of a video (where `ended`
   * was already false) restates neither key.
   */
  const syncEndedFromElement = (): void => {
    if (video.ended || !api.getState('ended')) return;

    api.setState('ended', false);
    api.setState('playbackState', video.paused ? 'paused' : 'playing');
  };

  // Playback events
  // 'play' fires immediately when video.play() is called
  addHandler('play', () => {
    api.setState('paused', false);
    syncEndedFromElement();
  });

  // 'playing' fires when playback actually starts (after buffering)
  addHandler('playing', () => {
    api.setState('playing', true);
    api.setState('paused', false);
    api.setState('waiting', false);
    api.setState('buffering', false);
    api.setState('playbackState', 'playing');
    syncEndedFromElement();
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

    // Update live stream seekable range and live edge on every timeupdate.
    // Also detect live from non-finite duration (native HLS on Safari),
    // since hlsLevelLoaded never runs on the native path.
    if (video.seekable && video.seekable.length > 0) {
      if (api.getState('live') || !Number.isFinite(video.duration)) {
        const start = video.seekable.start(0);
        const end = video.seekable.end(video.seekable.length - 1);
        api.setState('seekableRange', { start, end });

        // Live edge: within 10 seconds of seekable end
        const latency = Math.max(0, end - video.currentTime);
        api.setState('liveEdge', latency < 10);
        api.setState('liveLatency', latency);
      }
    }
  });

  addHandler('durationchange', () => {
    const rawDuration = video.duration;
    const isLive = !Number.isFinite(rawDuration) || rawDuration === Infinity;
    if (isLive) {
      api.setState('live', true);
      api.setState('duration', 0);
    } else {
      api.setState('duration', rawDuration || 0);
    }
    api.emit('media:loadedmetadata', { duration: api.getState('duration') });
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
    // A scrub back from the end never fires play or playing while paused, so
    // this is the only place the key can be cleared for a paused viewer.
    syncEndedFromElement();
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
    // videoWidth may be 0 on mobile at loadedmetadata time; updated again on loadeddata
    api.setState('mediaType', video.videoWidth > 0 ? 'video' : 'audio');
  });

  // Loaded data - re-check mediaType since videoWidth may not be available at loadedmetadata on mobile
  addHandler('loadeddata', () => {
    if (video.videoWidth > 0) {
      api.setState('mediaType', 'video');
    }
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
