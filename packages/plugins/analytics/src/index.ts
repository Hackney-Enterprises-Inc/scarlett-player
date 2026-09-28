/**
 * Analytics Plugin for Scarlett Player
 *
 * Collects Quality of Experience (QoE) metrics and engagement data.
 * Designed for live event monitoring and viewer analytics.
 *
 * Features:
 * - QoE metrics (startup time, rebuffering, errors)
 * - Engagement tracking (watch time, pause/seek behavior)
 * - Quality tracking (bitrate changes, quality levels)
 * - Custom event tracking
 * - Automatic heartbeat reporting
 * - Persistent viewer identification
 */

import type { IPluginAPI, Plugin, QualityLevel, StateChangeEvent } from '@scarlett-player/core';
import type {
  AnalyticsConfig,
  ViewSession,
  BitrateChange,
  ErrorEvent,
  BeaconPayload,
  IAnalyticsPlugin,
  AnalyticsEventType,
  AnalyticsVideo,
} from './types';
import {
  generateId,
  getSessionId,
  getAnonymousViewerId,
  getBrowserInfo,
  getOSInfo,
  getDeviceType,
  getScreenSize,
  getPlayerSize,
  getConnectionType,
  calculateQoEScore,
  createLatencySampler,
  isDevelopment,
  safeStringify,
  isHttpsUrl,
} from './helpers';
import { PKG_VERSION } from './version';

// Re-export types
export type {
  AnalyticsConfig,
  ViewSession,
  BitrateChange,
  ErrorEvent,
  BeaconPayload,
  IAnalyticsPlugin,
  AnalyticsEventType,
  AnalyticsVideo,
} from './types';

/**
 * Version this plugin reports, both as its descriptor `version` and as the
 * `playerVersion` on every beacon.
 *
 * It was the literal '0.1.0' while the package published at 1.7.0 (measured
 * 2026-09-02), so every beacon in the analytics store carries a version string
 * that never matched a release. It now comes from the package's own
 * package.json through the build-time define in tsup.config.ts.
 */
const PLUGIN_VERSION = PKG_VERSION;
const PLUGIN_NAME = 'scarlett-player';

/**
 * Default analytics configuration.
 */
const DEFAULT_CONFIG: Partial<AnalyticsConfig> = {
  heartbeatInterval: 10000,
  errorSampleRate: 1.0,
  disableInDev: false,
};

/**
 * Create an Analytics Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Analytics Plugin instance
 *
 * @example
 * ```ts
 * import { createAnalyticsPlugin } from '@scarlett-player/analytics';
 *
 * const player = await createPlayer({
 *   container: '#player',
 *   src: 'video.m3u8',
 *   plugins: [
 *     hlsPlugin(),
 *     createAnalyticsPlugin({
 *       beaconUrl: 'https://api.example.com/analytics',
 *       videoId: 'event-123',
 *       videoTitle: 'Live Event',
 *       isLive: true,
 *       viewerId: user?.id,
 *       viewerPlan: 'ppv',
 *     }),
 *     uiPlugin(),
 *   ],
 * });
 * ```
 */
export function createAnalyticsPlugin(
  config: AnalyticsConfig
): Plugin & IAnalyticsPlugin {
  // Validate required config
  if (!config.beaconUrl) {
    throw new Error('Analytics plugin requires beaconUrl');
  }
  if (!config.videoId) {
    throw new Error('Analytics plugin requires videoId');
  }

  // Merge with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config } as AnalyticsConfig;

  // The configured video: the first view's, and the one a playlist track
  // without its own `videoId` reports.
  const configuredVideo: AnalyticsVideo = {
    videoId: mergedConfig.videoId,
    videoTitle: mergedConfig.videoTitle,
    isLive: mergedConfig.isLive,
  };

  // The video the current view is about. Replaced by setVideo() or a playlist
  // track loading, each of which starts a new view.
  let video: AnalyticsVideo = { ...configuredVideo };

  // Plugin state
  let api: IPluginAPI | null = null;
  let session: ViewSession;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastHeartbeatTime = 0;
  let isRebuffering = false;
  let rebufferStartTime: number | null = null;
  let pauseStartTime: number | null = null;
  // A play request is waiting for its first frame (see onPlayRequest)
  let playRequestPending = false;
  // A playlist track that has not been loaded yet (see onPlaylistChange)
  let pendingTrack: { trackId: string; video: AnalyticsVideo } | null = null;
  // The playlist track the current view is about, null outside a playlist
  let currentTrackId: string | null = null;
  let cleanupFns: Array<() => void> = [];
  // Live latency, accumulated at constant memory across the whole session.
  // Reset alongside the session so a second view does not inherit the first
  // one's readings.
  let latencySampler = createLatencySampler();

  /**
   * Initialize view session.
   */
  function initSession(): ViewSession {
    latencySampler = createLatencySampler();

    return {
      viewId: generateId(),
      sessionId: getSessionId(),
      viewerId: mergedConfig.viewerId || getAnonymousViewerId(),
      viewStart: Date.now(),
      playRequestTime: null,
      firstFrameTime: null,
      viewEnd: null,
      watchTime: 0,
      playTime: 0,
      pauseCount: 0,
      pauseDuration: 0,
      seekCount: 0,
      startupTime: null,
      rebufferCount: 0,
      rebufferDuration: 0,
      errorCount: 0,
      errors: [],
      bitrateHistory: [],
      qualityChanges: 0,
      maxBitrate: 0,
      avgBitrate: 0,
      playbackState: 'loading',
      exitType: null,
      lastKnownIsLive: null,
    };
  }

  /**
   * The `isLive` a beacon carries.
   *
   * The current video's `isLive` when the host set it (`config.isLive`, or
   * `setVideo()`), otherwise the view's last known
   * classification: `null` until the provider has classified the source, so
   * a consumer can tell "not yet known" from VOD.
   *
   * @returns Whether the view is live, or null while unknown
   */
  function resolveIsLive(): boolean | null {
    return video.isLive ?? session.lastKnownIsLive;
  }

  /**
   * Send analytics beacon to server.
   */
  function sendBeacon(
    eventType: AnalyticsEventType | string,
    data: Record<string, unknown> = {}
  ): void {
    // Skip if disabled in dev
    if (mergedConfig.disableInDev && isDevelopment()) {
      return;
    }

    // Apply error sampling
    if (eventType === 'error' && Math.random() > (mergedConfig.errorSampleRate ?? 1.0)) {
      return;
    }

    const payload: BeaconPayload = {
      // Event info
      event: eventType,
      timestamp: Date.now(),

      // View context
      viewId: session.viewId,
      sessionId: session.sessionId,
      viewerId: session.viewerId,

      // Video context
      videoId: video.videoId,
      videoTitle: video.videoTitle,
      isLive: resolveIsLive(),

      // Player context
      playerVersion: PLUGIN_VERSION,
      playerName: PLUGIN_NAME,

      // Environment
      browser: getBrowserInfo().name,
      os: getOSInfo().name,
      deviceType: getDeviceType(),
      screenSize: getScreenSize(),
      playerSize: getPlayerSize(api?.container ?? null),
      connectionType: getConnectionType(),

      // Custom dimensions
      ...mergedConfig.customDimensions,

      // Event-specific data
      ...data,
    };

    // Use custom beacon function if provided (for testing)
    if (mergedConfig.customBeacon) {
      mergedConfig.customBeacon(mergedConfig.beaconUrl, payload);
      return;
    }

    const body = safeStringify(payload);

    /** Post `body` with the base headers plus whatever `headers` resolved to. */
    const post = (extra: Record<string, string>): void => {
      // Primary transport: fetch with keepalive. Unlike sendBeacon, fetch
      // supports custom headers (X-API-Key), which is how the backend
      // authenticates beacons. 100% of sendBeacon-based beacons arrived
      // without the header — sendBeacon cannot attach custom headers at all.
      fetch(mergedConfig.beaconUrl, {
        method: 'POST',
        headers: beaconHeaders(extra),
        body,
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't disrupt playback
      });
    };

    const configured = mergedConfig.headers;

    if (typeof configured !== 'function') {
      // Static (or absent) headers keep this path synchronous, which is what
      // a beacon sent from a visibilitychange handler needs.
      post(configured ?? {});
      return;
    }

    // A function is resolved per request, so a rotating CSRF or Bearer token
    // is current. A rejection must not cost the beacon: analytics is not worth
    // losing over a token the server will simply refuse.
    //
    // Called from inside the chain rather than before it, so a headers()
    // that throws synchronously - reading a cookie that is not there, say -
    // lands in the same catch as one that rejects. Called directly, the throw
    // would escape sendBeacon() into whichever player event handler triggered
    // the beacon, and the beacon itself would never be sent.
    Promise.resolve()
      .then(() => configured())
      .then(post)
      .catch((error) => {
        api?.logger.debug('Analytics headers() failed; sending without them', { error });
        post({});
      });
  }

  /**
   * Headers every fetch-transport beacon carries.
   *
   * The API key rides here rather than on the URL whenever the transport can
   * hold it; see `sendUnloadBeacon` for the one path that cannot.
   */
  function baseHeaders(): Record<string, string> {
    const shouldAttachApiKey = Boolean(mergedConfig.apiKey && isHttpsUrl(mergedConfig.beaconUrl));

    return {
      'Content-Type': 'application/json',
      ...(shouldAttachApiKey ? { 'X-API-Key': mergedConfig.apiKey! } : {}),
    };
  }

  /**
   * The base headers with `extra` applied on top, as a `Headers`.
   *
   * `Headers.set` matches field names case-insensitively, so a host that
   * configures `content-type` replaces ours instead of sitting beside it.
   * Spreading into a plain object cannot do that: both spellings survive into
   * the request, where the `Headers` constructor APPENDS rather than replaces
   * and the beacon goes out with the two values comma-joined.
   *
   * @param extra - Resolved `headers` entries, which win over the base ones
   * @returns Headers for the beacon request
   */
  function beaconHeaders(extra: Record<string, string>): Headers {
    const headers = new Headers(baseHeaders());

    for (const [name, value] of Object.entries(extra)) {
      headers.set(name, value);
    }

    return headers;
  }

  /**
   * Send a beacon on page unload using navigator.sendBeacon.
   *
   * sendBeacon cannot attach custom headers, so the API key is appended
   * as a query parameter instead. This is the only path that survives
   * iOS Safari's aggressive process termination on pagehide.
   */
  function sendUnloadBeacon(
    eventType: AnalyticsEventType | string,
    data: Record<string, unknown> = {}
  ): void {
    if (mergedConfig.disableInDev && isDevelopment()) return;
    if (eventType === 'error' && Math.random() > (mergedConfig.errorSampleRate ?? 1.0)) return;

    const payload: BeaconPayload = {
      event: eventType,
      timestamp: Date.now(),
      viewId: session.viewId,
      sessionId: session.sessionId,
      viewerId: session.viewerId,
      videoId: video.videoId,
      videoTitle: video.videoTitle,
      isLive: resolveIsLive(),
      playerVersion: PLUGIN_VERSION,
      playerName: PLUGIN_NAME,
      browser: getBrowserInfo().name,
      os: getOSInfo().name,
      deviceType: getDeviceType(),
      screenSize: getScreenSize(),
      playerSize: getPlayerSize(api?.container ?? null),
      connectionType: getConnectionType(),
      ...mergedConfig.customDimensions,
      ...data,
    };

    if (mergedConfig.customBeacon) {
      mergedConfig.customBeacon(mergedConfig.beaconUrl, payload);
      return;
    }

    const body = safeStringify(payload);

    if (navigator.sendBeacon) {
      // Append API key as query parameter — sendBeacon cannot set headers
      let urlWithApiKey = mergedConfig.beaconUrl;
      if (mergedConfig.apiKey && isHttpsUrl(mergedConfig.beaconUrl)) {
        try {
          // Parsed against the page, the way isHttpsUrl() judged it HTTPS in
          // the first place: a relative beaconUrl such as `/analytics/beacon`
          // is legal here and `new URL()` alone rejects it, which dropped
          // every relative endpoint into the string fallback below.
          const base =
            typeof window !== 'undefined' && window.location?.href
              ? window.location.href
              : undefined;
          const urlObj = base
            ? new URL(mergedConfig.beaconUrl, base)
            : new URL(mergedConfig.beaconUrl);
          urlObj.searchParams.set('api_key', mergedConfig.apiKey);
          urlWithApiKey = urlObj.toString();
        } catch {
          // Last resort for a URL neither parse could take. Appending with the
          // right separator matters: a `?` on an endpoint that already carries
          // a query string folds the key into the previous parameter's value.
          const separator = mergedConfig.beaconUrl.includes('?') ? '&' : '?';
          urlWithApiKey = `${mergedConfig.beaconUrl}${separator}api_key=${encodeURIComponent(mergedConfig.apiKey)}`;
        }
      }
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(urlWithApiKey, blob);
      if (sent) return;
    }

    // Fallback to fetch with keepalive when sendBeacon is unavailable or returns false.
    //
    // Static `headers` are merged; a `headers()` function is NOT called here.
    // This runs inside pagehide, where the page can be torn down before a
    // promise resolves, and a beacon that waits for a token is a beacon that
    // never leaves. A host that needs authenticated unload beacons uses the
    // `api_key` query parameter above, which is the only thing sendBeacon can
    // carry anyway.
    const staticHeaders = typeof mergedConfig.headers === 'function' ? {} : mergedConfig.headers;

    fetch(mergedConfig.beaconUrl, {
      method: 'POST',
      headers: beaconHeaders(staticHeaders ?? {}),
      body,
      keepalive: true,
    }).catch(() => {
      // Silently fail - don't disrupt playback
    });
  }

  /**
   * Send periodic heartbeat with current metrics.
   */
  function sendHeartbeat(): void {
    if (!api) return;

    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeatTime;

    // Update watch time
    session.watchTime += timeSinceLastHeartbeat;

    // Update play time (only if playing and not rebuffering)
    if (session.playbackState === 'playing' && !isRebuffering) {
      session.playTime += timeSinceLastHeartbeat;
    }

    // Calculate average bitrate (weighted by time spent at each level)
    if (session.bitrateHistory.length > 0) {
      const totalBitrateTime = session.bitrateHistory.reduce((sum, b, i, arr) => {
        const nextTime = i < arr.length - 1 ? arr[i + 1]?.time : now;
        const duration = nextTime - b.time;
        return sum + b.bitrate * duration;
      }, 0);
      const timeSpan = now - session.bitrateHistory[0].time;
      session.avgBitrate = timeSpan > 0 ? Math.round(totalBitrateTime / timeSpan) : 0;
    }

    const state = {
      currentTime: api.getState('currentTime'),
      duration: api.getState('duration'),
    };

    sendBeacon('heartbeat', {
      watchTime: session.watchTime,
      playTime: session.playTime,
      currentTime: state.currentTime,
      duration: state.duration,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      avgBitrate: session.avgBitrate,
      qoeScore: getQoEScore(),
      ...(latencySampler.summary() ?? {}),
    });

    lastHeartbeatTime = now;
  }

  /**
   * Calculate current QoE score.
   */
  function getQoEScore(): number {
    return calculateQoEScore({
      startupTime: session.startupTime,
      rebufferDuration: session.rebufferDuration,
      watchTime: session.watchTime,
      maxBitrate: session.maxBitrate,
      exitType: session.exitType,
      errorCount: session.errorCount,
    });
  }

  /**
   * Send view end event with final metrics.
   */
  function sendViewEnd(): void {
    if (!api) return;

    // Stop heartbeat so it does not keep ticking after viewEnd
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    session.viewEnd = Date.now();

    const state = {
      currentTime: api.getState('currentTime'),
      duration: api.getState('duration'),
    };

    const completionRate = state.duration
      ? (state.currentTime / state.duration) * 100
      : 0;

    sendBeacon('viewEnd', {
      watchTime: session.watchTime,
      playTime: session.playTime,
      startupTime: session.startupTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      rebufferRatio:
        session.watchTime > 0
          ? (session.rebufferDuration / session.watchTime) * 100
          : 0,
      avgBitrate: session.avgBitrate,
      maxBitrate: session.maxBitrate,
      qualityChanges: session.qualityChanges,
      pauseCount: session.pauseCount,
      pauseDuration: session.pauseDuration,
      seekCount: session.seekCount,
      errorCount: session.errorCount,
      exitType: session.exitType,
      qoeScore: getQoEScore(),
      completionRate,
      // Absent entirely on VOD: nothing ever emitted a live:latency reading
      ...(latencySampler.summary() ?? {}),
    });
  }

  /**
   * Start a view: new view ID, `viewStart`, and a heartbeat counted from now.
   *
   * Used for the first view at init and for every one after it (another
   * video, or a replay after the previous view ended). Per-view trackers are
   * reset with the session so the new view inherits nothing from the last.
   *
   * @param lastKnownIsLive - Classification to carry over. A replay of the
   *   same source passes the ended view's value, because nothing reloads the
   *   source to classify it again; another video starts unknown.
   */
  function startView(lastKnownIsLive: boolean | null = null): void {
    session = initSession();
    session.lastKnownIsLive = lastKnownIsLive;
    lastHeartbeatTime = Date.now();
    isRebuffering = false;
    rebufferStartTime = null;
    pauseStartTime = null;
    playRequestPending = false;

    sendBeacon('viewStart');

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(
      sendHeartbeat,
      mergedConfig.heartbeatInterval || 10000
    );
  }

  /**
   * Move to another video: end the current view if it is still open, then
   * start one for `next`.
   *
   * The same `videoId` does nothing. That is what keeps a token refresh, which
   * re-loads a new URL for the video already playing, inside its view.
   *
   * @param next - The video now playing
   */
  function switchVideo(next: AnalyticsVideo): void {
    if (next.videoId === video.videoId) return;

    if (!api) {
      // Not initialised: the first view has not started, so it simply
      // reports the new video.
      video = { ...next };
      return;
    }

    beginView(next);
  }

  /**
   * End the current view if it is still open and start one for `next`,
   * whether or not `next` has the same `videoId`.
   *
   * @param next - The video the new view is about
   */
  function beginView(next: AnalyticsVideo): void {
    if (!api) return;

    if (session.viewEnd === null) {
      session.exitType = session.exitType || 'abandoned';
      sendViewEnd();
    }

    video = { ...next };
    startView();

    api.logger.debug('Analytics started a view', {
      viewId: session.viewId,
      videoId: video.videoId,
    });
  }

  /**
   * The video a playlist track reports.
   *
   * The track's own `videoId` when the host gave one. Otherwise the configured
   * video, never the track's `id`: that is the playlist's internal identity,
   * positional in the embed (`item-0`) and generated for a track without one
   * (`track-<time>-<random>`), and no backend can map it to a video.
   *
   * @param track - The playlist track
   * @returns The video for the track's view
   */
  function trackVideo(track: { videoId?: unknown; title?: unknown }): AnalyticsVideo {
    const title = typeof track.title === 'string' && track.title !== '' ? track.title : undefined;

    if (typeof track.videoId === 'string' && track.videoId !== '') {
      return { videoId: track.videoId, videoTitle: title };
    }

    return { ...configuredVideo, videoTitle: title ?? configuredVideo.videoTitle };
  }

  /**
   * Handle a playlist track change: remember the track, switch on its load.
   *
   * The event alone does not mean another track is playing. Removing the
   * current track moves the playlist onto the next one without loading it,
   * so the removed track keeps playing. The track is held as pending and
   * starts its view at the next source load (`onSourceChange`), which covers
   * the playlist's own `media:load-request` and a host that loads the track
   * itself. A change back to the current track, or an empty playlist, drops
   * anything pending.
   *
   * @param payload - The current track, or null when the playlist is empty
   */
  function onPlaylistChange(
    payload: { track: { id: string; videoId?: unknown; title?: unknown } | null }
  ): void {
    const track = payload?.track;
    if (!track || typeof track.id !== 'string' || track.id === '' || track.id === currentTrackId) {
      pendingTrack = null;
      return;
    }

    pendingTrack = { trackId: track.id, video: trackVideo(track) };
  }

  /**
   * Start the view for a pending playlist track once a source is loaded.
   *
   * Core writes the `source` state in `load()` before the provider loads, so
   * the new view exists before that source's play request and metadata.
   *
   * Every track gets its own view, including two tracks that report the same
   * `videoId` (both falling back to the configured one, say). The exception is
   * a view nothing has happened in yet, where the track's video is the one it
   * already reports: the track takes that view over rather than ending it
   * empty, so a playlist announcing its first track does not cost a view.
   */
  function onSourceChange(): void {
    if (!pendingTrack) return;

    const { trackId, video: next } = pendingTrack;
    pendingTrack = null;
    currentTrackId = trackId;

    const untouched =
      session.viewEnd === null &&
      session.playRequestTime === null &&
      session.firstFrameTime === null;

    if (untouched && next.videoId === video.videoId) {
      // Same view, but the track's metadata from here on: its title is the
      // one the rest of the view should carry.
      video = { ...next };
      return;
    }

    beginView(next);
  }

  // === Event Handlers ===

  /**
   * Record a play request: the start of a startup-time measurement.
   *
   * Two signals can announce the same request. Core's `play()` emits
   * `playback:play` synchronously, before the element's `play` event; a
   * control or autoplay calling `video.play()` directly is seen first as the
   * `paused` key going false. Whichever arrives first wins, and the other is
   * absorbed until the request settles at the next `playing: true` or pause.
   */
  function onPlayRequest(): void {
    if (playRequestPending) return;

    // Playing again after the view ended (a replay after `ended`, a retry
    // after a fatal error) is a new view of the same video, not a request
    // inside one that already sent its viewEnd.
    if (session.viewEnd !== null && api) {
      startView(session.lastKnownIsLive);
    }

    playRequestPending = true;
    session.playRequestTime = Date.now();
    sendBeacon('playRequest');
  }

  /**
   * Handle `playback:play`.
   *
   * A request unless playback is already running: an element-driven start
   * reaches the bus only at `playing`, after the `paused` key announced it,
   * and a stall ending emits it again while `playing` never went false. It
   * still ends a rebuffer, which no state key can do, because `playing` does
   * not change across a stall.
   */
  function onPlayEvent(): void {
    if (!api?.getState('playing')) {
      onPlayRequest();
    }
    onPlaying();
  }

  /**
   * Handle a player state change.
   *
   * @param event - The change, dispatched only when the value actually changed
   */
  function onStateChange(event: StateChangeEvent): void {
    if (event.key === 'paused') {
      if (event.previousValue === true && event.value === false && !api?.getState('playing')) {
        onPlayRequest();
      }
      return;
    }

    if (event.key === 'playing' && event.value === true) {
      playRequestPending = false;
      onFirstFrame();
      return;
    }

    if (event.key === 'source' && event.value) {
      onSourceChange();
      return;
    }

    // Only a change to true classifies. Core writes `live: false` on every
    // load(), which is a reset rather than a classification: the next
    // media:loadedmetadata re-classifies.
    if (event.key === 'live' && event.value === true) {
      session.lastKnownIsLive = true;
    }
  }

  /**
   * Classify the source once its metadata has loaded.
   *
   * Every provider has written `live` by then: hls.js at `hlsLevelLoaded`,
   * native HLS at `durationchange`, WHEP before `media:loaded`.
   */
  function onLoadedMetadata(): void {
    if (!api) return;
    session.lastKnownIsLive = api.getState('live') === true;
  }

  /**
   * Send `videoStart` on the first frame of the view.
   *
   * The first `playing: true` the view sees, so a resume after pause is not a
   * second start. Another video, or a replay after `ended`, is a new view
   * with a start of its own.
   */
  function onFirstFrame(): void {
    if (session.firstFrameTime !== null) return;

    const now = Date.now();
    session.firstFrameTime = now;
    session.startupTime = session.playRequestTime !== null
      ? now - session.playRequestTime
      : null;

    sendBeacon('videoStart', {
      startupTime: session.startupTime,
    });
  }

  /**
   * Handle playback started/resumed.
   */
  function onPlaying(): void {
    const now = Date.now();

    // End rebuffer?
    if (isRebuffering && rebufferStartTime) {
      const rebufferDuration = now - rebufferStartTime;
      session.rebufferDuration += rebufferDuration;
      isRebuffering = false;
      rebufferStartTime = null;

      sendBeacon('rebufferEnd', {
        duration: rebufferDuration,
        totalRebufferTime: session.rebufferDuration,
      });
    }

    // End pause?
    if (pauseStartTime) {
      const pauseDuration = now - pauseStartTime;
      session.pauseDuration += pauseDuration;
      pauseStartTime = null;
    }

    session.playbackState = 'playing';
  }

  /**
   * Handle pause.
   */
  function onPause(): void {
    if (!api) return;

    // A pause settles any request still waiting for its first frame
    playRequestPending = false;
    session.pauseCount++;
    session.playbackState = 'paused';
    pauseStartTime = Date.now();

    sendBeacon('pause', {
      currentTime: api.getState('currentTime'),
    });
  }

  /**
   * Handle buffering/waiting.
   */
  function onWaiting(): void {
    if (!api) return;

    // Only count as rebuffer if we've started playing AND are not
    // mid-seek (seeks trigger waiting which is not a rebuffer).
    if (session.firstFrameTime !== null && !isRebuffering && !api.getState('seeking')) {
      isRebuffering = true;
      rebufferStartTime = Date.now();
      session.rebufferCount++;

      sendBeacon('rebufferStart', {
        rebufferCount: session.rebufferCount,
        currentTime: api.getState('currentTime'),
      });
    }
  }

  /**
   * Handle seeking.
   */
  function onSeeking(): void {
    if (!api) return;

    session.seekCount++;

    sendBeacon('seeking', {
      seekCount: session.seekCount,
      seekTo: api.getState('currentTime'),
    });
  }

  /**
   * Handle playback ended.
   */
  function onEnded(): void {
    session.playbackState = 'ended';
    session.exitType = 'completed';
    sendViewEnd();
  }

  /**
   * Handle errors (from media:error subscription).
   */
  function onError(payload: { error: Error }): void {
    const error = payload.error;
    session.errorCount++;

    const errorEvent: ErrorEvent = {
      time: Date.now(),
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      fatal: (error as any).fatal ?? false,
    };

    session.errors.push(errorEvent);
    // Cap errors array to prevent memory growth during long sessions
    if (session.errors.length > 100) {
      session.errors = session.errors.slice(-100);
    }

    sendBeacon('error', {
      errorType: errorEvent.type,
      errorMessage: errorEvent.message,
      errorCode: (error as any).code,
      fatal: errorEvent.fatal,
    });

    if (errorEvent.fatal) {
      session.playbackState = 'error';
      session.exitType = 'error';
      sendViewEnd();
    }
  }

  /**
   * Handle core error events (in addition to media:error).
   *
   * Core errors (e.g. provider not found, plugin init failure) are not
   * reported through media:error but should still be counted and sent.
   *
   * The payload is a `PlayerError`, a plain object: core's ErrorHandler may
   * wrap an `Error` in `originalError`, while providers (the HLS fatal path)
   * emit `{ code, message, fatal }` with no `Error` at all. An `Error` keeps
   * its `name` as the error type; a structured error without one reports its
   * `code`. Either way `errorCode` carries the code when there is one. A
   * payload with neither a string `code` nor a string `message` is ignored.
   */
  function onCoreError(err: any): void {
    if (!err) return;
    const original = err.originalError || err;
    const code: string | undefined =
      typeof err.code === 'string' ? err.code
        : typeof original.code === 'string' ? original.code
          : undefined;

    let type: string;
    let message: string;
    if (original instanceof Error) {
      type = original.name || 'CoreError';
      message = original.message || 'Unknown core error';
    } else if (code !== undefined || typeof err.message === 'string') {
      // Only strings reach the beacon: a structured `name` or `message` on a
      // hand-built payload falls back rather than being serialised in.
      const name = typeof err.name === 'string' ? err.name : '';
      type = code || name || 'CoreError';
      message = (typeof err.message === 'string' && err.message) || 'Unknown core error';
    } else {
      return;
    }

    session.errorCount++;
    const errorEvent: ErrorEvent = {
      time: Date.now(),
      type,
      message,
      fatal: err.fatal ?? false,
    };

    session.errors.push(errorEvent);
    if (session.errors.length > 100) {
      session.errors = session.errors.slice(-100);
    }

    sendBeacon('error', {
      errorType: errorEvent.type,
      errorMessage: errorEvent.message,
      errorCode: code,
      fatal: errorEvent.fatal,
    });

    if (errorEvent.fatal) {
      session.playbackState = 'error';
      session.exitType = 'error';
      sendViewEnd();
    }
  }

  /**
   * Handle quality/bitrate changes.
   */
  function onQualityChange(payload: { quality: string; auto: boolean }): void {
    if (!api) return;

    const now = Date.now();
    session.qualityChanges++;

    // Try to get bitrate from quality levels
    const qualities = api.getState('qualities');
    const currentQuality = qualities.find((q: QualityLevel) => q.id === payload.quality);

    if (currentQuality) {
      const bitrateChange: BitrateChange = {
        time: now,
        bitrate: currentQuality.bitrate,
        width: currentQuality.width,
        height: currentQuality.height,
      };

      session.bitrateHistory.push(bitrateChange);
      // Cap bitrate history to prevent memory growth during long sessions
      if (session.bitrateHistory.length > 500) {
        session.bitrateHistory = session.bitrateHistory.slice(-500);
      }

      if (currentQuality.bitrate > session.maxBitrate) {
        session.maxBitrate = currentQuality.bitrate;
      }

      sendBeacon('qualityChange', {
        bitrate: currentQuality.bitrate,
        width: currentQuality.width,
        height: currentQuality.height,
        auto: payload.auto,
      });
    }
  }

  /**
   * Record a live latency reading.
   *
   * Accumulated rather than beaconed: the provider emits this several times a
   * second, and one beacon per reading would be a denial of service against
   * the host's own endpoint. The heartbeat and viewEnd payloads carry the
   * mean, p95 and max instead.
   *
   * @param payload - Latency behind the live edge, in seconds
   */
  function onLiveLatency(payload: { latency: number }): void {
    latencySampler.add(payload.latency);
  }

  /**
   * Record the stream turning out to be effectively low latency.
   *
   * Sticky for the session, and separate from the latency readings because the
   * event can fire before the first one: `hlsLevelLoaded` announces effective
   * LL from the manifest, ahead of any `timeupdate`.
   *
   * @param payload - Whether low latency is effective
   */
  function onLowLatencyChange(payload: { enabled: boolean }): void {
    if (payload.enabled) latencySampler.markLowLatency();
  }

  /**
   * Handle page visibility change.
   */
  function onVisibilityChange(): void {
    if (document.hidden) {
      session.exitType = 'background';
      sendHeartbeat();
    } else {
      // Reset exitType when returning to foreground so that a subsequent
      // pagehide does not inherit the stale 'background' label.
      session.exitType = null;
    }
  }

  /**
   * Handle page unload (beforeunload + pagehide).
   *
   * `pagehide` is essential for iOS Safari where `beforeunload` is not
   * reliably fired. Both handlers use `sendUnloadBeacon` which falls back
   * to `navigator.sendBeacon` (the only API that survives process
   * termination).
   */
  function onBeforeUnload(): void {
    if (session.viewEnd) return;
    session.viewEnd = Date.now();

    if (!session.exitType) {
      session.exitType = 'abandoned';
    }
    sendUnloadBeacon('viewEnd', {
      watchTime: session.watchTime,
      playTime: session.playTime,
      startupTime: session.startupTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      avgBitrate: session.avgBitrate,
      maxBitrate: session.maxBitrate,
      exitType: session.exitType,
      // Absent entirely on VOD, exactly as in sendViewEnd(): an abandoned live
      // view is the one most worth having latency for
      ...(latencySampler.summary() ?? {}),
    });
  }

  // === Plugin Interface ===

  return {
    id: 'analytics',
    name: 'Analytics',
    version: PLUGIN_VERSION,
    type: 'analytics',
    description: 'Quality of Experience and engagement analytics',

    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;

      // First view: viewStart and the heartbeat
      startView();

      // Subscribe to player events
      const unsubPlay = api.on('playback:play', onPlayEvent);
      const unsubState = api.subscribeToState(onStateChange);
      const unsubMetadata = api.on('media:loadedmetadata', onLoadedMetadata);
      const unsubPause = api.on('playback:pause', onPause);
      const unsubWaiting = api.on('media:waiting', onWaiting);
      const unsubSeeking = api.on('playback:seeking', onSeeking);
      const unsubEnded = api.on('playback:ended', onEnded);
      const unsubError = api.on('media:error', onError);
      const unsubCoreError = api.on('error', onCoreError);
      const unsubQuality = api.on('quality:change', onQualityChange);
      // Live latency. The HLS provider emits this at the timeupdate cadence
      // for live content only, so a VOD session records nothing and the live
      // keys stay out of its beacons entirely.
      const unsubLatency = api.on('live:latency', onLiveLatency);
      const unsubLowLatency = api.on('live:lowlatency', onLowLatencyChange);
      // A playlist track change is a new video once its source loads
      const unsubPlaylist = api.on('playlist:change', onPlaylistChange);

      cleanupFns.push(
        unsubPlay,
        unsubState,
        unsubMetadata,
        unsubPause,
        unsubWaiting,
        unsubSeeking,
        unsubEnded,
        unsubError,
        unsubCoreError,
        unsubQuality,
        unsubLatency,
        unsubLowLatency,
        unsubPlaylist
      );

      // Page lifecycle events
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('beforeunload', onBeforeUnload);
      window.addEventListener('pagehide', onBeforeUnload);

      cleanupFns.push(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('pagehide', onBeforeUnload);
      });

      api.logger.info('Analytics plugin initialized', {
        viewId: session.viewId,
        videoId: video.videoId,
      });
    },

    async destroy(): Promise<void> {
      // Stop heartbeat
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // Send final view end if not already sent
      if (!session.viewEnd) {
        session.exitType = session.exitType || 'abandoned';
        sendViewEnd();
      }

      // Cleanup event listeners
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];

      api?.logger.info('Analytics plugin destroyed');
      api = null;
    },

    // === Public API ===

    getViewId(): string {
      return session.viewId;
    },

    getSessionId(): string {
      return session.sessionId;
    },

    getQoEScore(): number {
      return getQoEScore();
    },

    getMetrics(): Partial<ViewSession> {
      return { ...session };
    },

    setVideo(next: AnalyticsVideo): void {
      if (!next || typeof next.videoId !== 'string' || next.videoId === '') {
        throw new Error('Analytics setVideo() requires videoId');
      }
      // The host named the video; a playlist track still waiting to load
      // must not replace it at the next load.
      pendingTrack = null;
      // Moving to another video leaves the playlist track behind, so loading
      // that track again is a return to it, not a reload of the current one.
      if (next.videoId !== video.videoId) {
        currentTrackId = null;
      }
      switchVideo(next);
    },

    trackEvent(name: string, data: Record<string, unknown> = {}): void {
      sendBeacon(`custom:${name}`, data);
    },
  };
}

// Default export
export default createAnalyticsPlugin;
