/**
 * HLS Event Mapping
 *
 * Maps hls.js events to Scarlett Player events.
 */

import type { IPluginAPI, PlayerEventMap } from '@scarlett-player/core';
import type { AudioTrack } from '@scarlett-player/core';
import type { HlsAudioTrack, HlsInstance, HlsLevel, HLSError, HLSErrorType } from './types';
import { formatLevel } from './quality';
import { sanitizeUrl } from './sanitize-url';
import type { ManifestMediaFlags } from './media-type';
import {
  applyLiveMetrics,
  computeLiveMetrics,
  resetLiveMetrics,
  type HlsLevelDetails,
  type LiveMetrics,
} from './live-metrics';

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

/**
 * Parse hls.js error data into our format.
 *
 * @param data - Raw `hlsError` payload from hls.js
 * @returns The normalised error, with the request URL recovered from
 *          whichever field the originating error type populated
 */
export function parseHlsError(data: Record<string, unknown>): HLSError {
  const frag = data.frag as { url?: string } | undefined;
  const response = data.response as { code?: number; text?: string; url?: string } | undefined;
  const context = data.context as { url?: string } | undefined;

  return {
    type: mapErrorType(data.type as string),
    details: data.details as string || 'Unknown error',
    fatal: data.fatal as boolean || false,
    // hls.js puts the request URL in a different place per error type:
    // playlist errors set data.url, while fragment and key load errors set
    // data.url not at all and carry it on data.frag.url and data.response.url.
    // Reading only data.url dropped the failing segment from every diagnostic
    // an origin outage produces - which is the case the diagnostics exist for.
    url: (data.url as string | undefined)
      ?? frag?.url
      ?? response?.url
      ?? context?.url,
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

  // Anchored, and the whole id must match. parseInt on a stripped prefix
  // accepted anything with a leading number - 'audio-2invalid' parsed as 2,
  // and so did 'audio-02', which is not an id audioTrackId() can produce.
  const match = /^audio-(0|[1-9]\d*)$/.exec(id);

  return match ? Number.parseInt(match[1]!, 10) : -1;
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

/** Read only completed, measurable media fragment requests; never infer zeroes. */
function segmentFromFragment(frag: unknown, ok: boolean): PlayerEventMap['media:segment'] | null {
  if (!frag || typeof frag !== 'object') return null;
  const { type, stats } = frag as {
    type?: unknown;
    stats?: { loading?: { start?: number; end?: number }; loaded?: number };
  };
  if (type !== 'main' && type !== 'audio' && type !== 'subtitle') return null;
  const start = stats?.loading?.start;
  const end = stats?.loading?.end;
  const bytes = stats?.loaded;
  if (typeof start !== 'number' || !Number.isFinite(start)
    || typeof end !== 'number' || !Number.isFinite(end) || end < start
    || typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  return { durationMs: end - start, bytes, ok, kind: type };
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
    onManifestParsed?: (levels: HlsLevel[], data: ManifestMediaFlags) => void;
    onLevelSwitched?: (level: number) => void;
    onBufferUpdate?: () => void;
    onError?: (error: HLSError) => void;
    onLiveUpdate?: () => void;
    onLevelDetails?: (details: HlsLevelDetails) => void;
    onPlaylistDetails?: (details: HlsLevelDetails) => void;
    isLowLatencyRequested?: () => boolean;
    onFragLoaded?: () => void;
    onFragBuffered?: () => void;
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
  addHandler('hlsManifestParsed', (_event: string, data: { levels: HlsLevel[] } & ManifestMediaFlags) => {
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

    // `data` also carries hls.js's own `audio` / `video` booleans, which
    // establish the media type before a frame is decoded. Passed through
    // verbatim so ./media-type.ts can decide what (if anything) they prove.
    callbacks.onManifestParsed?.(data.levels, data);
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

    // Emit quality change event. `quality` is the level id (`level-<index>`,
    // the form core emits and `qualities[].id` holds), never the display
    // label: analytics resolves it against that list.
    api.emit('quality:change', {
      quality: level ? `level-${data.level}` : 'auto',
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

  // Fragment loaded - update bandwidth estimate and report measured segments.
  let lastBandwidthUpdate = 0;
  addHandler('hlsFragLoaded', (_event: string, data: { frag?: unknown }) => {
    const segment = segmentFromFragment(data?.frag, true);
    if (segment) api.emit('media:segment', segment);
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
    callbacks.onFragBuffered?.();
  });

  // Fragment loading - update buffering state
  addHandler('hlsFragLoading', () => {
    api.setState('buffering', true);
  });

  // Level loaded - may contain live stream info and DVR window.
  //
  // This handler owns the `live` key. Every other live key (seekableRange,
  // liveLatency, liveEdge, lowLatencyMode) is written by live-metrics.ts and
  // by nothing else, so the `timeupdate` handler below can no longer clobber
  // the edge flag computed here.
  addHandler('hlsLevelLoaded', (_event: string, data: { details: HlsLevelDetails }) => {
    // Every playlist, live or ended: the final ENDLIST playlist still knows
    // where its window starts, which the cleared live keys no longer say
    if (data.details) callbacks.onPlaylistDetails?.(data.details);

    if (data.details?.live !== undefined) {
      api.setState('live', data.details.live);

      if (data.details.live) {
        // Handed to the plugin so the timeupdate path and getLiveInfo() can
        // measure against the same playlist this handler just saw
        callbacks.onLevelDetails?.(data.details);
        applyLiveMetrics(
          api,
          computeLiveMetrics({
            kind: 'hls',
            hls,
            details: data.details,
            lowLatencyRequested: callbacks.isLowLatencyRequested?.() ?? true,
          })
        );
      } else {
        // The playlist went VOD (EXT-X-ENDLIST on a stream that was live, or a
        // VOD source after a live one). applyLiveMetrics() ignores a null
        // snapshot by design, and the timeupdate path stops measuring once
        // `live` is false, so without this the previous stream's latency
        // readout, LL badge and DVR window would sit on top of the new one.
        resetLiveMetrics(api);
      }

      callbacks.onLiveUpdate?.();
    }
  });

  // Error handling
  addHandler('hlsError', (_event: string, data: Record<string, unknown>) => {
    const error = parseHlsError(data);

    if (!error.fatal && (error.details === 'fragLoadError' || error.details === 'fragLoadTimeOut')) {
      const segment = segmentFromFragment(data.frag, false);
      if (segment) api.emit('media:segment', segment);
    }

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
        status: error.response?.code,
        url: sanitizeUrl(error.url),
      });
    } else {
      api.logger.warn(`HLS error: ${error.details} (type=${error.type}, fatal=${error.fatal})`, {
        type: error.type,
        details: error.details,
        fatal: error.fatal,
        status: error.response?.code,
        url: sanitizeUrl(error.url),
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

    // Renditions belong to the manifest these handlers were bound to. Leaving
    // them in state outlives that: the next source, or a switch to the native
    // provider (which clears `qualities` but has never touched these two),
    // would show the previous stream's audio menu.
    api.setState('audioTracks', []);
    api.setState('currentAudioTrack', null);
  };
}

/**
 * Which playback commands the plugin itself put in flight.
 *
 * `ScarlettPlayer.play()` and `.pause()` emit `playback:play` / `playback:pause`
 * on the bus BEFORE the provider touches the element, so the element event they
 * cause must not emit a second one. Every other route to the element - the UI's
 * play buttons call `video.play()` directly, as do the keyboard shortcuts and
 * the browser's own native controls - produces no bus event at all unless the
 * element handlers emit it.
 *
 * One gate object is shared by the plugin and by whichever pipeline is mounted,
 * so a flag set by a command survives the handoff between the hls.js and native
 * paths.
 */
export interface PlaybackGate {
  /** A `playback:play` command is in flight; the next `playing` consumes it. */
  corePlayRequested: boolean;
  /** A `playback:pause` command is in flight; the next `pause` consumes it. */
  corePauseRequested: boolean;
}

/**
 * A reload of the native source that the provider itself started.
 *
 * Auto-reconnect, native error recovery and an AirPlay switch all re-run the
 * element's load algorithm on the same URL, which puts `readyState` back to 0.
 * A failure of that reload before `loadedmetadata` is reported by WebKit as
 * code 4 (`MEDIA_ERR_SRC_NOT_SUPPORTED`) whatever the real cause was, so it
 * says nothing about the stream's format (TSP-571).
 */
export interface NativeReloadContext {
  /** Which provider path started the reload. Logged only, never beaconed. */
  phase: 'reconnect' | 'recovery' | 'switch' | 'resume';
  /** 1-based attempt number of this outage's reload. */
  attempt: number;
  /**
   * Whether this failure is the first of its outage and so is reported on
   * `media:error`. When false it is logged at info and nothing is emitted.
   */
  report: boolean;
}

/** Pipeline context for {@link setupVideoEventHandlers}. */
export interface VideoHandlerOptions {
  /**
   * The handlers are attached to the native pipeline. `durationchange` then
   * treats a finite duration as the end of a live stream (EXT-X-ENDLIST), which
   * hls.js reports through level details instead. Its MSE duration is finite
   * while live, so the hls.js path must leave this unset.
   */
  native?: boolean;
  /**
   * Reports the provider reload in flight, or null when there is none.
   *
   * Called once per element error that has the failed-reload shape (code 4,
   * `readyState` 0), so an implementation may record the first report as a
   * side effect of the call.
   */
  reload?: () => NativeReloadContext | null;
}

/**
 * Setup HTML5 video element event handlers.
 *
 * Emits `playback:play` on `playing` and `playback:pause` on `pause` for every
 * transition the plugin did not command itself (see {@link PlaybackGate}).
 *
 * @param video - Video element
 * @param api - Plugin API
 * @param getLiveMetrics - Live measurement for the active pipeline. Supplied on
 *        the hls.js path, where hls.js is the source of latency truth; omitted
 *        on the native path, where the element's own `seekable` range is all
 *        there is and this handler measures from it directly.
 * @param gate - Shared record of the play/pause commands the plugin issued, so
 *        the element event they cause is not echoed back onto the bus. Omitted
 *        (in tests, and by any caller with no commands of its own) means every
 *        transition is treated as element-driven.
 * @param options - Pipeline context, see {@link VideoHandlerOptions}. Omitted
 *        (the hls.js path, tests) means no provider reload is ever in flight
 *        and `durationchange` follows the MSE rules.
 * @returns A function that removes every handler this call attached
 */
export function setupVideoEventHandlers(
  video: HTMLVideoElement,
  api: IPluginAPI,
  getLiveMetrics?: () => LiveMetrics | null,
  gate?: PlaybackGate,
  options?: VideoHandlerOptions
): () => void {
  const handlers: Array<{ event: string; handler: EventListener }> = [];

  // Diagnostics for a failed provider reload, logged and never beaconed: the
  // last event the element fired and when its position last advanced.
  let lastEvent: string | null = null;
  let lastProgressAt: number | null = null;
  let lastProgressTime = video.currentTime;

  const addHandler = (event: string, handler: EventListener) => {
    const tracked: EventListener = (e) => {
      if (event === 'timeupdate' && video.currentTime !== lastProgressTime) {
        lastProgressTime = video.currentTime;
        lastProgressAt = Date.now();
      }
      if (event !== 'error') lastEvent = event;
      handler(e);
    };
    video.addEventListener(event, tracked);
    handlers.push({ event, handler: tracked });
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

    // Playback is running, so a pause command can no longer be in flight; a
    // flag left over from one would swallow the viewer's next real pause.
    if (gate) gate.corePauseRequested = false;

    if (gate?.corePlayRequested) {
      // ScarlettPlayer.play() already emitted playback:play
      gate.corePlayRequested = false;
    } else {
      // Direct video.play() call (PlayButton, BigPlayButton, keyboard, native
      // controls). Without this the bus never heard about playback starting on
      // an HLS source at all, and every consumer of the event - watermark,
      // analytics, media-session - was dark for the whole session.
      api.emit('playback:play', undefined);
    }
  });

  addHandler('pause', () => {
    api.setState('playing', false);
    api.setState('paused', true);
    api.setState('playbackState', 'paused');

    // An intervening pause cancels a pending core play: the `playing` that
    // would have consumed the flag is never coming.
    if (gate) gate.corePlayRequested = false;

    if (gate?.corePauseRequested) {
      // ScarlettPlayer.pause() already emitted playback:pause
      gate.corePauseRequested = false;
    } else {
      api.emit('playback:pause', undefined);
    }
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

    // Refresh the live measurement on every timeupdate. Also detect live from
    // non-finite duration (native HLS on Safari), since hlsLevelLoaded never
    // runs on the native path.
    //
    // The measurement comes from `getLiveMetrics` when the caller supplied one:
    // this handler used to recompute the edge flag here as `latency < 10` off
    // `video.seekable`, which under MSE is both the wrong source and, at a
    // low-latency target, permanently true.
    if (api.getState('live') || !Number.isFinite(video.duration)) {
      applyLiveMetrics(
        api,
        getLiveMetrics ? getLiveMetrics() : computeLiveMetrics({ kind: 'media', media: video })
      );
    }
  });

  addHandler('durationchange', () => {
    const rawDuration = video.duration;
    if (Number.isNaN(rawDuration)) {
      // NaN is the reset value while a reload re-runs the load algorithm: no
      // duration is known yet, so it classifies nothing. Counting it as live
      // flipped a reloaded native VOD to `live` for good. `duration` is still
      // zeroed, as it always was.
      api.setState('duration', 0);
    } else if (!Number.isFinite(rawDuration)) {
      api.setState('live', true);
      api.setState('duration', 0);
    } else {
      // A live stream's native duration turns finite once the playlist ends
      // (EXT-X-ENDLIST), which hls.js reports through level details. Native
      // only: under MSE the duration is finite while the stream is live.
      if (options?.native && api.getState('live') === true) {
        api.setState('live', false);
        resetLiveMetrics(api);
        api.logger.info('Native live stream ended (finite duration)');
      }
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
    // Seeking subscribers need the target, not the last timeupdate position.
    api.setState('currentTime', video.currentTime);
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
  });

  // `mediaType` is deliberately NOT written here. Zero intrinsic dimensions at
  // loadedmetadata are a missing measurement, not evidence of audio, and this
  // handler used to publish `audio` for every mobile browser that had not
  // measured the frame yet. Classification lives in ./media-type.ts, which the
  // factory attaches to the same element; it listens to loadedmetadata,
  // loadeddata, resize and playing itself.

  // Errors
  addHandler('error', () => {
    const error = video.error;
    if (error) {
      // Code 4 on an element with no source at all (networkState NO_SOURCE,
      // no `src`, no `currentSrc`) is the page releasing its media, which iOS
      // reports in bursts ~10 ms apart as a viewer leaves (HEI-71). Nothing
      // failed to play, so it is neither an element error nor an advisory
      // `media:error`. A load that failed keeps its source on the element and
      // is unaffected, as is every other error code.
      if (
        error.code === 4 &&
        video.networkState === 3 &&
        !video.currentSrc &&
        !video.getAttribute('src')
      ) {
        api.logger.debug('Video element released its source (not a playback error)', {
          code: error.code,
          readyState: video.readyState,
        });
        return;
      }

      // Code 4 with nothing loaded, while the provider's own reload is in
      // flight, is that reload failing (WebKit reports any pre-metadata
      // failure as "not supported", TSP-571). Only the first failure of an
      // outage is reported, tagged so a dashboard can tell it from a format
      // problem; the retries after it are logged. Every other error, and any
      // error with no reload in flight, takes the path below unchanged.
      let reloadDetail: Record<string, unknown> | null = null;
      if (error.code === 4 && video.readyState === 0) {
        const reload = options?.reload?.() ?? null;
        if (reload) {
          if (!reload.report) {
            api.logger.info('Native reload failed (not reported)', {
              phase: reload.phase,
              attempt: reload.attempt,
              code: error.code,
              networkState: video.networkState,
              currentSrcSet: Boolean(video.currentSrc),
              msSinceProgress: lastProgressAt === null ? undefined : Date.now() - lastProgressAt,
              lastEvent: lastEvent ?? undefined,
              visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
            });
            return;
          }
          reloadDetail = { reconnecting: true, attempts: reload.attempt };
        }
      }

      api.logger.error('Video element error', { code: error.code, message: error.message });
      // Browsers often leave MediaError.message empty; name the two codes
      // that matter most rather than report a generic error.
      const fallbackMessage = error.code === 4 ? 'Media source not supported'
        : error.code === 2 ? 'Media network error'
          : 'Video playback error';
      const playbackError = new Error(error.message || fallbackMessage);
      if (typeof error.code === 'number' && error.code > 0) {
        Object.assign(playbackError, {
          code: error.code,
          detail: {
            mediaErrorCode: error.code,
            networkState: video.networkState,
            readyState: video.readyState,
            ...reloadDetail,
          },
        });
      }
      api.emit('media:error', { error: playbackError });
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
    // The mode before each change: only a picture-in-picture -> inline exit
    // resumes. AVKit fullscreen -> inline also lands on `inline`, and resuming
    // there restarted a video the viewer had paused in fullscreen (HEI-25 D6).
    let previousMode = webkitVideo.webkitPresentationMode;
    addHandler('webkitpresentationmodechanged', () => {
      const mode = webkitVideo.webkitPresentationMode;
      const leftPip = previousMode === 'picture-in-picture' && mode === 'inline';
      previousMode = mode;
      const isInPip = mode === 'picture-in-picture';
      api.setState('pip', isInPip);
      api.logger.debug(`PiP: mode changed to ${mode} (webkit)`);

      // Resume playback when exiting PiP on Safari
      if (leftPip && video.paused) {
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
