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

import type { IPluginAPI, PlayerEventMap, Plugin, QualityLevel, StateChangeEvent } from '@scarlett-player/core';
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
} from './helpers';
import { createTransport } from './transport';
import { privacyOptOut } from './privacy';
import { pageContext } from './context';
import { classifyError, errorDetail, safeErrorMessage, sourceHost } from './errors';
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

/** How long a view may go without playing before it ends (ms): 30 minutes. */
const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000;

/**
 * Default analytics configuration.
 */
const DEFAULT_CONFIG: Partial<AnalyticsConfig> = {
  heartbeatInterval: 10000,
  rebufferGraceMs: 250,
  idleTimeout: DEFAULT_IDLE_TIMEOUT,
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
  let nextAnonymous = mergedConfig.anonymous === true;
  const rebufferGraceMs = typeof mergedConfig.rebufferGraceMs === 'number'
    && Number.isFinite(mergedConfig.rebufferGraceMs) && mergedConfig.rebufferGraceMs >= 0
    ? mergedConfig.rebufferGraceMs
    : 250;
  const idleTimeout = typeof mergedConfig.idleTimeout === 'number'
    && Number.isFinite(mergedConfig.idleTimeout) && mergedConfig.idleTimeout >= 0
    ? mergedConfig.idleTimeout
    : DEFAULT_IDLE_TIMEOUT;

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
  // When watch/play time was last accrued (see accrueTime)
  let lastHeartbeatTime = 0;
  // When the view was last seen playing, or its start (see onHeartbeatTick)
  let lastPlayingAt = 0;
  // The player's `playing` state key as of the last accrual. `playbackState`
  // alone says playing from a core play request that has not reached a frame,
  // and after a load() that stopped playback with no pause event.
  let statePlaying = false;
  // Only idle ends may reopen without a new play request.
  let idleEnded = false;
  // The last position and duration seen with a duration, so a view whose
  // state was already reset by a load() still reports how far it got (see
  // onTimeUpdate)
  let lastKnownCurrentTime = 0;
  let lastKnownDuration = 0;
  let isRebuffering = false;
  let rebufferStartTime: number | null = null;
  let waitingSince: number | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  // The provider auto-reconnect outage open in this view, from its first
  // `error:reconnecting`, and whether its long-outage beacon went (see
  // onReconnecting). Reset with every view, so nothing crosses a view end.
  let outageStartedAt: number | null = null;
  let outageLongSent = false;
  // Bus seeks precede asynchronous element events. Keep one echo per request,
  // expiring the batch so a coalesced/missing echo cannot hide a later seek.
  let pendingEchoes = 0;
  let lastBusSeekAt = 0;
  // Element seek bursts (see onStateChange): when the last non-echo element
  // seek happened, and how many element seeking beacons this view has sent.
  let lastElementSeekAt: number | null = null;
  let elementSeekBeacons = 0;
  let pauseStartTime: number | null = null;
  // A pause near the end of the media, held until it is known whether
  // `ended` follows it (see onPause)
  let pendingPause: {
    time: number;
    currentTime: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  // A play request is waiting for its first frame (see onPlayRequest)
  let playRequestPending = false;
  // A playlist track that has not been loaded yet (see onPlaylistChange)
  let pendingTrack: { trackId: string; src: string | null; video: AnalyticsVideo } | null = null;
  // The playlist track the current view is about, null outside a playlist
  let currentTrackId: string | null = null;
  let cleanupFns: Array<() => void> = [];
  // Live latency, accumulated at constant memory across the whole session.
  // Reset alongside the session so a second view does not inherit the first
  // one's readings.
  let latencySampler = createLatencySampler();
  // Whether latency readings are delivery latency: 'edge' samples them,
  // 'awaiting' waits for the first reading after a seek on a live view, and
  // 'dvr' (behind the edge after a seek) counts play time as dvrTime instead
  // (see onLiveLatency)
  let liveMode: 'edge' | 'awaiting' | 'dvr' = 'edge';
  // Finish a reading once its edge flag lands, or before the next reading.
  let pendingLiveReading: (() => void) | null = null;
  let transport = createTransport(mergedConfig, { debug: (...args) => api?.logger.debug(...args) }, () => privacyOptOut(mergedConfig.respectDoNotTrack));
  let viewContext: Record<string, string | number> = {};
  // Only retain interval totals, never fragment data or signed segment URLs.
  let segmentCount = 0;
  let segmentBytes = 0;
  let segmentDurationMs = 0;
  let segmentMaxMs = 0;
  let segmentErrors = 0;
  let mainBytes = 0;
  let mainDurationMs = 0;
  let frameBaseline: { video: HTMLVideoElement; decoded: number; dropped: number } | null = null;

  /** Record a measured fragment; failed requests and alternate renditions count too. */
  function onSegment(segment: PlayerEventMap['media:segment']): void {
    if (session.viewEnd !== null || !segment ||
      !Number.isFinite(segment.bytes) || segment.bytes < 0 ||
      !Number.isFinite(segment.durationMs) || segment.durationMs < 0 ||
      (segment.kind !== 'main' && segment.kind !== 'audio' && segment.kind !== 'subtitle')) return;
    segmentCount++;
    segmentBytes += segment.bytes;
    segmentDurationMs += segment.durationMs;
    segmentMaxMs = Math.max(segmentMaxMs, segment.durationMs);
    if (segment.ok === false) segmentErrors++;
    if (segment.kind === 'main') {
      mainBytes += segment.bytes;
      mainDurationMs += segment.durationMs;
    }
  }

  /** Take and clear the measured fragment interval, omitting unavailable throughput. */
  function segmentSummary(): Record<string, number> {
    if (segmentCount === 0) return {};
    const result = {
      segmentCount, segmentBytes,
      segmentLoadAvgMs: segmentDurationMs / segmentCount,
      segmentLoadMaxMs: segmentMaxMs,
      segmentErrors,
      ...(mainDurationMs > 0 ? { segmentThroughputBps: mainBytes * 8 * 1000 / mainDurationMs } : {}),
    };
    resetSegments();
    return result;
  }

  /** Reset interval totals when starting a new view. */
  function resetSegments(): void {
    segmentCount = segmentBytes = segmentDurationMs = segmentMaxMs = segmentErrors = 0;
    mainBytes = mainDurationMs = 0;
  }

  /** Read counters only from a video with the standard playback-quality API. */
  function readFrames(): { video: HTMLVideoElement; decoded: number; dropped: number } | null {
    const video = api?.container.querySelector('video');
    if (!video || typeof video.getVideoPlaybackQuality !== 'function') return null;
    try {
      const quality = video.getVideoPlaybackQuality();
      const decoded = quality?.totalVideoFrames;
      const dropped = quality?.droppedVideoFrames;
      if (!Number.isFinite(decoded) || decoded < 0 || !Number.isFinite(dropped) || dropped < 0) return null;
      return { video, decoded, dropped };
    } catch {
      return null;
    }
  }

  /** Baseline at source/view boundaries to avoid counting the previous video's frames. */
  function resetFrames(): void {
    frameBaseline = readFrames();
  }

  /** Frame increments since the previous heartbeat (or source/view boundary). */
  function frameSummary(): Record<string, number> {
    const current = readFrames();
    const previous = frameBaseline;
    frameBaseline = current;
    if (!current || !previous || current.video !== previous.video ||
      current.decoded < previous.decoded || current.dropped < previous.dropped) return {};
    return {
      decodedFrames: current.decoded - previous.decoded,
      droppedFrames: current.dropped - previous.dropped,
    };
  }

  /**
   * Initialize view session.
   */
  function initSession(): ViewSession {
    latencySampler = createLatencySampler();

    const anonymous = nextAnonymous;

    return {
      viewId: generateId(),
      beaconSeq: 0,
      sessionId: anonymous ? generateId() : getSessionId(),
      viewerId: anonymous ? generateId() : mergedConfig.viewerId || getAnonymousViewerId(),
      anonymous,
      viewStart: Date.now(),
      playRequestTime: null,
      firstFrameTime: null,
      viewEnd: null,
      watchTime: 0,
      playTime: 0,
      dvrTime: 0,
      pauseCount: 0,
      pauseDuration: 0,
      seekCount: 0,
      elementSeekCount: 0,
      startupTime: null,
      rebufferCount: 0,
      rebufferDuration: 0,
      reconnectCount: 0,
      reconnectDuration: 0,
      errorCount: 0,
      warningCount: 0,
      fatalErrorCategory: null,
      errors: [],
      bitrateHistory: [],
      qualityChanges: 0,
      maxBitrate: null,
      avgBitrate: null,
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

  /** Build once for both normal and unload paths, applying all per-beacon guards. */
  function buildPayload(eventType: AnalyticsEventType | string, data: Record<string, unknown>): BeaconPayload | null {
    if (mergedConfig.disableInDev && isDevelopment()) return null;
    if (privacyOptOut(mergedConfig.respectDoNotTrack)) {
      transport.flush(); // Also discard beacons queued before the signal changed.
      return null;
    }
    if (eventType === 'error' && Math.random() > (mergedConfig.errorSampleRate ?? 1.0)) return null;
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
      ...(session.anonymous ? { anonymous: true as const } : {}),
      ...mergedConfig.customDimensions,
      ...data,
      beaconSeq: session.beaconSeq + 1,
    };
    if (mergedConfig.beforeSend) {
      try {
        const result = mergedConfig.beforeSend(payload);
        if (result === null) return null;
        if (typeof result !== 'object') {
          session.beaconSeq++;
          return payload;
        }
        session.beaconSeq++;
        return { ...result, beaconSeq: session.beaconSeq };
      } catch (error) {
        api?.logger.debug('Analytics beforeSend() failed; sending unmodified beacon', { error });
      }
    }
    session.beaconSeq++;
    return payload;
  }

  /** Send a normal event, preserving creation order and per-view sequence. */
  function sendBeacon(eventType: AnalyticsEventType | string, data: Record<string, unknown> = {}): void {
    const payload = buildPayload(eventType, data);
    if (payload) transport.send(payload);
  }

  /** Send an unload event without waiting for asynchronous headers. */
  function sendUnloadBeacon(eventType: AnalyticsEventType | string, data: Record<string, unknown> = {}): void {
    const payload = buildPayload(eventType, data);
    if (payload) transport.sendUnload(payload);
    else transport.flushUnload();
  }

  /**
   * Accrue watch and play time up to now.
   *
   * Adds the time since the last accrual to `watchTime`, and to `playTime`
   * only while playback is running and not stalled: the view's
   * `playbackState` is playing and the player's `playing` state key is true.
   * Called by every heartbeat, before every change to `playbackState`,
   * `isRebuffering` or the `playing` key (so each stretch is credited under
   * the state it was spent in), and
   * before either viewEnd payload (so the final partial interval is not
   * lost). Also records the position and duration while the duration is
   * known, for `completionRate` once a `load()` has zeroed them, and the last
   * time the view was playing, for the idle timeout.
   *
   * @param now - The accrual time; defaults to `Date.now()`
   */
  function accrueTime(now: number = Date.now()): void {
    const elapsed = now - lastHeartbeatTime;
    session.watchTime += elapsed;
    if (session.playbackState === 'playing' && statePlaying && !isRebuffering && waitingSince === null) {
      session.playTime += elapsed;
      if (liveMode === 'dvr') session.dvrTime += elapsed;
      lastPlayingAt = now;
    }
    lastHeartbeatTime = now;

    const duration = api?.getState('duration');
    if (typeof duration === 'number' && duration > 0) {
      lastKnownDuration = duration;
      lastKnownCurrentTime = api?.getState('currentTime') ?? 0;
    }
  }

  /**
   * Update `avgBitrate` to now: the bitrate of each level weighted by the
   * time spent at it. Left null while no level has supplied a bitrate.
   *
   * @param now - The end of the last level's stretch
   */
  function updateAvgBitrate(now: number): void {
    const history = session.bitrateHistory;
    if (history.length === 0) return;
    const totalBitrateTime = history.reduce((sum, b, i, arr) => {
      const nextTime = i < arr.length - 1 ? arr[i + 1].time : now;
      return sum + b.bitrate * (nextTime - b.time);
    }, 0);
    const timeSpan = now - history[0].time;
    // No time spent yet: the level just switched to is the average so far
    session.avgBitrate = timeSpan > 0
      ? Math.round(totalBitrateTime / timeSpan)
      : history[history.length - 1].bitrate;
  }

  /**
   * Time spent paused in this view up to `now`, the pause still in progress
   * included. Reads only: `settlePause()` folds the open interval in.
   *
   * @param now - The time to measure an open pause up to
   * @returns Total pause time (ms)
   */
  function pauseDurationAt(now: number): number {
    return session.pauseDuration + (pauseStartTime !== null ? Math.max(0, now - pauseStartTime) : 0);
  }

  /**
   * Fold the pause still in progress into `pauseDuration` and close it. No-op
   * when none is open. Called when playback resumes and by every finalizer
   * of a view, so each pause is counted exactly once.
   *
   * @param now - When the pause ended
   */
  function settlePause(now: number = Date.now()): void {
    if (pauseStartTime === null) return;
    session.pauseDuration = pauseDurationAt(now);
    pauseStartTime = null;
  }

  /**
   * Time spent in reconnect outages in this view up to `now`, the outage
   * still open included. Reads only: `settleOutage()` folds the open one in.
   *
   * @param now - The time to measure an open outage up to
   * @returns Total outage time (ms)
   */
  function reconnectDurationAt(now: number): number {
    return session.reconnectDuration + (outageStartedAt !== null ? Math.max(0, now - outageStartedAt) : 0);
  }

  /**
   * Fold the open reconnect outage into `reconnectDuration` and close it.
   * No-op when none is open. Called at `error:recovered` and by every
   * finalizer of a view, so each outage is counted exactly once and none
   * reaches the next view.
   *
   * @param now - When the outage ended
   */
  function settleOutage(now: number = Date.now()): void {
    if (outageStartedAt !== null) session.reconnectDuration = reconnectDurationAt(now);
    outageStartedAt = null;
    outageLongSent = false;
  }

  /**
   * The cumulative metrics of the current view, current to `now`.
   *
   * The one builder behind the heartbeat and both viewEnd payloads (see
   * `viewEndMetrics()`), so no payload can drift from the others. Updates
   * `avgBitrate`; otherwise reads only, and reports an open pause without
   * settling it. Callers accrue time first.
   *
   * @param now - The time the metrics are measured at
   * @returns The counters and running scores every one of those beacons carries
   */
  function cumulativeMetrics(now: number): Record<string, unknown> {
    updateAvgBitrate(now);
    return {
      watchTime: session.watchTime,
      playTime: session.playTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      reconnectCount: session.reconnectCount,
      reconnectDuration: reconnectDurationAt(now),
      avgBitrate: session.avgBitrate,
      maxBitrate: session.maxBitrate,
      qualityChanges: session.qualityChanges,
      pauseCount: session.pauseCount,
      pauseDuration: pauseDurationAt(now),
      seekCount: session.seekCount,
      elementSeekCount: session.elementSeekCount,
      errorCount: session.errorCount,
      warningCount: session.warningCount,
      qoeScore: getQoEScore(),
      qoeVersion: 2,
      // Absent entirely on VOD: nothing ever emitted a live:latency reading
      ...(latencySampler.summary() ?? {}),
      ...(resolveIsLive() === true ? { dvrTime: session.dvrTime } : {}),
      ...segmentSummary(),
      ...frameSummary(),
    };
  }

  /**
   * The final metrics of a view: the cumulative ones plus startup time,
   * rebuffer ratio, exit type and completion. Shared by the full and the
   * unload viewEnd so the two carry the same fields.
   *
   * @param now - The time the view ended
   * @returns The viewEnd payload data
   */
  function viewEndMetrics(now: number): Record<string, unknown> {
    const currentTime = api?.getState('currentTime') ?? 0;
    const duration = api?.getState('duration') ?? 0;

    // A completed view is 100 even when a host's own `ended` listener already
    // called load(), which zeroes currentTime and duration before this runs.
    // Otherwise the live state, or the last position seen with a duration.
    // A live view has none: a position over a sliding window is no completion.
    let completionRate: number | null = 0;
    if (resolveIsLive() === true) {
      completionRate = null;
    } else if (session.exitType === 'completed') {
      completionRate = 100;
    } else if (duration > 0) {
      completionRate = (currentTime / duration) * 100;
    } else if (lastKnownDuration > 0) {
      completionRate = (lastKnownCurrentTime / lastKnownDuration) * 100;
    }

    return {
      ...cumulativeMetrics(now),
      startupTime: session.startupTime,
      rebufferRatio:
        session.watchTime > 0
          ? (session.rebufferDuration / session.watchTime) * 100
          : 0,
      ...(session.fatalErrorCategory ? { fatalErrorCategory: session.fatalErrorCategory } : {}),
      exitType: session.exitType,
      completionRate,
    };
  }

  /**
   * The heartbeat timer's tick: end the view as abandoned when it has not been
   * playing for `idleTimeout`, otherwise send the heartbeat.
   *
   * A view counts as playing only while it accrues play time, so a pause, a
   * stall, a load that never reached a frame, or no play at all lets the
   * timeout run. Checked here rather than on a timer of its own, so the end
   * comes at the first tick past the timeout.
   */
  function onHeartbeatTick(): void {
    if (!api) return;

    const now = Date.now();
    accrueTime(now);

    if (idleTimeout > 0 && now - lastPlayingAt >= idleTimeout) {
      session.exitType = 'abandoned';
      sendViewEnd();
      idleEnded = true;
      api.logger.debug('Analytics ended an idle view', { viewId: session.viewId, idleTimeout });
      return;
    }

    sendHeartbeat();
  }

  /**
   * Send periodic heartbeat with current metrics.
   */
  function sendHeartbeat(): void {
    if (!api) return;

    const now = Date.now();
    accrueTime(now);
    // A seek that no fresh reading followed is decided from state instead
    settleLiveMode();

    sendBeacon('heartbeat', {
      ...cumulativeMetrics(now),
      currentTime: api.getState('currentTime'),
      duration: api.getState('duration'),
    });
  }

  /**
   * Calculate current QoE score.
   */
  function getQoEScore(): number | null {
    return calculateQoEScore({
      startupTime: session.startupTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      watchTime: session.watchTime,
      maxBitrate: session.maxBitrate,
      exitType: session.exitType,
      warningCount: session.warningCount,
      fatalErrorCategory: session.fatalErrorCategory,
    });
  }

  /**
   * Close the current view: the steps every finalizer shares (the full
   * viewEnd, which the idle end and every other in-page end use, and the
   * unload viewEnd).
   *
   * Accrues the last interval, commits a held near-end pause, closes an open
   * rebuffer, stops the heartbeat, stamps `viewEnd`, settles an open pause,
   * and clears the per-request state, so a play request still waiting for a
   * first frame or a seek echo cannot reach into the next view.
   *
   * @param sendRebufferEnd - Send `rebufferEnd` for a rebuffer still open.
   *   False on unload, where only the unload viewEnd should go out.
   * @returns The time the view ended
   */
  function finalizeView(sendRebufferEnd: boolean): number {
    // The time since the last heartbeat belongs to this view too
    accrueTime();

    // A near-end pause still held when the view ends was the viewer's
    commitPendingPause();

    // A rebuffer still open when the view ends (ended, a fatal error, a view
    // switch, destroy(), idle, unload) would otherwise lose its time entirely.
    closeRebuffer(sendRebufferEnd);

    // Stop heartbeat so it does not keep ticking after viewEnd
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    playRequestPending = false;
    pendingEchoes = 0;

    idleEnded = false;
    session.viewEnd = Date.now();
    settlePause(session.viewEnd);
    // An outage still open (exhaustion, idle, unload) ends with its view
    settleOutage(session.viewEnd);
    return session.viewEnd;
  }

  /**
   * Send view end event with final metrics.
   */
  function sendViewEnd(): void {
    if (!api) return;

    const viewEnd = finalizeView(true);
    sendBeacon('viewEnd', viewEndMetrics(viewEnd));
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
    // A held pause belongs to the view it happened in, never the next one
    commitPendingPause();
    cancelPendingRebuffer();
    idleEnded = false;
    session = initSession();
    resetSegments();
    resetFrames();
    session.lastKnownIsLive = lastKnownIsLive;
    lastHeartbeatTime = Date.now();
    lastPlayingAt = lastHeartbeatTime;
    lastKnownCurrentTime = 0;
    lastKnownDuration = 0;
    isRebuffering = false;
    rebufferStartTime = null;
    outageStartedAt = null;
    outageLongSent = false;
    pendingEchoes = 0;
    lastBusSeekAt = 0;
    lastElementSeekAt = null;
    elementSeekBeacons = 0;
    pauseStartTime = null;
    playRequestPending = false;
    liveMode = 'edge';

    sendBeacon('viewStart', viewContext);

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(
      onHeartbeatTick,
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
    payload: { track: { id: string; src?: unknown; videoId?: unknown; title?: unknown } | null }
  ): void {
    const track = payload?.track;
    if (!track || typeof track.id !== 'string' || track.id === '' || track.id === currentTrackId) {
      pendingTrack = null;
      return;
    }

    pendingTrack = {
      trackId: track.id,
      src: typeof track.src === 'string' && track.src !== '' ? track.src : null,
      video: trackVideo(track),
    };
  }

  /**
   * A URL without its query string and fragment.
   *
   * A signed or refreshed URL for the same media differs only there, so two
   * URLs that agree without them are the same track's source.
   *
   * @param url - Media source URL
   * @returns The URL up to its query string or fragment
   */
  function sourceKey(url: string): string {
    return url.split(/[?#]/, 1)[0];
  }

  /**
   * Start the view for a pending playlist track once its source loads.
   *
   * Core writes the `source` state in `load()` before the provider loads, so
   * the new view exists before that source's play request and metadata.
   *
   * Only the pending track's own source commits it. Any other load, such as
   * a token refresh of the track still playing after its entry was removed,
   * leaves the view and the pending track as they are. A host that loads a
   * track from a URL other than its `src` names the video with `setVideo()`.
   *
   * Every track gets its own view, including two tracks that report the same
   * `videoId` (both falling back to the configured one, say). The exception is
   * the first track of a view no track owns yet, before anything has
   * happened in it, when it reports the video that view already reports: it
   * takes that view over rather than ending it empty, so a playlist
   * announcing its first track does not cost a view.
   *
   * @param src - URL of the source now loading
   */
  function onSourceChange(src: string): void {
    if (!pendingTrack) return;
    if (pendingTrack.src !== null && sourceKey(pendingTrack.src) !== sourceKey(src)) return;

    const { trackId, video: next } = pendingTrack;
    const ownedByTrack = currentTrackId !== null;
    pendingTrack = null;
    currentTrackId = trackId;

    const untouched =
      !ownedByTrack &&
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
    // Before the dedup: a request the closed view left pending must not
    // swallow the one that reopens it
    if (!api) return;
    ensureOpenView(true);
    if (playRequestPending) return;

    playRequestPending = true;
    session.playRequestTime = Date.now();
    sendBeacon('playRequest');
  }

  /**
   * Start a new view of the same video if the current one has ended.
   *
   * Playing again after the view ended (a replay after `ended`, a retry after
   * a fatal error, a resume after an idle end) is a new view, not activity
   * inside one that already sent its viewEnd. Passive signals only reopen
   * idle-ended views. A play request reopens any closed view, one closed by
   * the unload viewEnd included: a page restored from bfcache, or one whose
   * beforeunload was cancelled, is still there. Called by the play-request path
   * and by the paths where playback resumes with no request: `playing` turning
   * true, `playback:play` while already playing (a stall recovering), and
   * `error:recovered`.
   *
   * @param playRequest - A new request may replay a completed or failed view.
   *   Passive resume signals may reopen only an idle-ended view.
   * @returns True when a new view was started
   */
  function ensureOpenView(playRequest = false): boolean {
    if (session.viewEnd === null || !api) return false;
    if (!playRequest && !idleEnded) return false;
    startView(session.lastKnownIsLive);
    return true;
  }

  /**
   * Handle `error:recovered`: the end of a reconnect outage.
   *
   * In a view that saw the outage's `error:reconnecting`, closes it: folds
   * its time into `reconnectDuration`, closes the rebuffer it opened, and
   * sends `recovered` with the outage's `duration` (plus the provider's
   * `attempt` and `elapsedMs` when the payload has them). A view that never
   * saw the `error:reconnecting` (one the outage outlasted, or a recovery
   * with no reconnect) gets no `recovered` beacon.
   *
   * A reconnect that succeeds resumes playback, so it also reopens a view
   * the outage outlasted. Not while the viewer is paused: the provider keeps
   * a paused player paused, and nothing is being watched. Its `videoStart`
   * comes now if `playing` is already true, otherwise from the `playing`
   * change that follows.
   *
   * @param payload - `{ attempt, elapsedMs }`, or nothing from an older provider
   */
  function onRecovered(payload?: PlayerEventMap['error:recovered']): void {
    if (!api) return;
    if (session.viewEnd === null && outageStartedAt !== null) {
      const now = Date.now();
      const duration = Math.max(0, now - outageStartedAt);
      settleOutage(now);
      closeRebuffer(true);
      sendBeacon('recovered', {
        duration,
        reconnectCount: session.reconnectCount,
        ...finiteFields(payload, ['attempt', 'elapsedMs']),
      });
    }
    if (api.getState('paused') === true) return;
    if (ensureOpenView() && api.getState('playing')) onFirstFrame();
  }

  /**
   * The finite numeric fields of a provider payload, by name.
   *
   * @param payload - The event payload, possibly absent
   * @param keys - The fields to copy
   * @returns Only those of `keys` the payload has as finite numbers
   */
  function finiteFields(payload: unknown, keys: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    if (!payload || typeof payload !== 'object') return result;
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    }
    return result;
  }

  /**
   * Handle `error:reconnecting`: the provider is auto-reconnecting.
   *
   * The first one in a view opens an outage: counts it in `reconnectCount`,
   * starts its `reconnectDuration` clock, and sends `reconnecting` with the
   * `attempt`, `delayMs` and `elapsedMs` the payload provides. The outage is
   * also a stall: a rebuffer opens at once (a `waiting` still in its grace is
   * confirmed from when it began), unless one is open already, or nobody is
   * waiting on playback: before the first frame or while paused the outage
   * still counts in `reconnectCount` and `reconnectDuration`, but not as a
   * rebuffer. Later attempts send
   * nothing, except the first carrying `longOutage`, which sends
   * `reconnecting` once more with `longOutage: true`. Ignored after the
   * view's viewEnd: a closed view hears nothing of an outage.
   *
   * @param payload - The provider's attempt, delay and window progress
   */
  function onReconnecting(payload: PlayerEventMap['error:reconnecting']): void {
    if (!api || session.viewEnd !== null) return;

    const first = outageStartedAt === null;
    const long = payload?.longOutage === true && !outageLongSent;
    if (!first && !long) return;

    if (first) {
      const now = Date.now();
      outageStartedAt = now;
      session.reconnectCount++;
      // A stall only where a viewer is waiting on playback, the same rule as
      // onWaiting(): not before the first frame (that is startup) and not
      // while paused (a pause closes a rebuffer, see onPause)
      if (!isRebuffering && session.firstFrameTime !== null && api.getState('paused') !== true) {
        const startedAt = waitingSince ?? now;
        cancelPendingRebuffer();
        openRebuffer(startedAt);
      }
    }
    if (long) outageLongSent = true;

    sendBeacon('reconnecting', {
      reconnectCount: session.reconnectCount,
      ...finiteFields(payload, ['attempt', 'delayMs', 'elapsedMs']),
      ...(payload?.longOutage === true ? { longOutage: true } : {}),
    });
  }

  /**
   * Handle `source:unloaded` (`player.unload()`): the host stopped playback,
   * so the open view ends as `abandoned` with the full viewEnd. A no-op on a
   * closed view. The next source's play request starts a new view.
   */
  function onSourceUnloaded(): void {
    if (!api || session.viewEnd !== null) return;
    session.exitType = 'abandoned';
    sendViewEnd();
  }

  /**
   * Whether a player error's `detail` says the provider will auto-reconnect
   * (`reconnecting: true`). A fatal error so marked is reported as a
   * warning and the view stays open.
   *
   * @param detail - The error's `detail`, if any
   * @returns True when marked `reconnecting`
   */
  function markedReconnecting(detail: unknown): boolean {
    return !!detail && typeof detail === 'object'
      && (detail as Record<string, unknown>).reconnecting === true;
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
    if (event.key === 'seeking' && event.previousValue === false && event.value === true) {
      // Replay preparation must not change an already-finalized view.
      if (session.viewEnd !== null) return;
      markLiveSeek();
      if (pendingEchoes > 0 && Date.now() - lastBusSeekAt <= 1000) {
        pendingEchoes--;
        return;
      }
      pendingEchoes = 0;
      cancelPendingRebuffer();
      // Element seeks each within 2 s of the previous one are one burst: only
      // its first counts in seekCount and may send a beacon (HEI-32).
      const now = Date.now();
      session.elementSeekCount++;
      const inBurst = lastElementSeekAt !== null && now >= lastElementSeekAt && now - lastElementSeekAt <= 2000;
      lastElementSeekAt = now;
      if (inBurst) return;
      session.seekCount++;
      if (elementSeekBeacons >= 30) return;
      elementSeekBeacons++;
      // Providers write the element's target before setting seeking true.
      sendBeacon('seeking', {
        seekCount: session.seekCount,
        seekTo: api?.getState('currentTime'),
        seekSource: 'element',
      });
      return;
    }

    if (event.key === 'paused') {
      if (event.previousValue === true && event.value === false && !api?.getState('playing')) {
        onPlayRequest();
      }
      return;
    }

    if (event.key === 'playing') {
      // Credit the stretch that just ended under the value it was spent in
      if (session.viewEnd === null) accrueTime();
      statePlaying = event.value === true;
    }

    if (event.key === 'playing' && event.value === true) {
      ensureOpenView();
      playRequestPending = false;
      onFirstFrame();
      return;
    }

    if (event.key === 'source' && event.value) {
      const src = (event.value as { src?: unknown }).src;
      onSourceChange(typeof src === 'string' ? src : '');
      resetFrames();
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
    if (session.viewEnd !== null || session.firstFrameTime !== null) return;

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
   * Close an open rebuffer, if one is open: add its elapsed time to
   * `session.rebufferDuration` and clear the tracking flags.
   *
   * The resume path (`onPlaying`) is not the only way a stall ends - the
   * viewer can pause mid-stall, the view can end (`ended`, a fatal error, a
   * view switch, `destroy()`), or the page can unload. Every one of those
   * closes the rebuffer through this helper so its time is never lost.
   *
   * @param sendEndBeacon - Send the same `rebufferEnd` beacon `onPlaying()`
   *   sends on resume. False on unload, where only the unload `viewEnd`
   *   should go out.
   */
  function closeRebuffer(sendEndBeacon: boolean): void {
    cancelPendingRebuffer();
    if (!isRebuffering || rebufferStartTime === null) return;

    // The stall's time is watch time, never play time
    accrueTime();

    const rebufferDuration = Date.now() - rebufferStartTime;
    session.rebufferDuration += rebufferDuration;
    isRebuffering = false;
    rebufferStartTime = null;

    if (sendEndBeacon) {
      sendBeacon('rebufferEnd', {
        duration: rebufferDuration,
        totalRebufferTime: session.rebufferDuration,
      });
    }
  }

  /**
   * Handle playback started/resumed.
   *
   * A resume with no request (a stall recovering on its own after the view
   * ended) opens a new view, whose first frame is this one.
   */
  function onPlaying(): void {
    if (ensureOpenView() && api?.getState('playing')) onFirstFrame();
    if (!api || session.viewEnd !== null) return;

    const now = Date.now();
    accrueTime(now);

    closeRebuffer(true);

    // A held near-end pause that playback resumed from was the viewer's
    commitPendingPause();

    // End pause?
    settlePause(now);

    session.playbackState = 'playing';
  }

  /**
   * Handle pause.
   *
   * The element fires `pause` just before `ended` when the media runs out,
   * in the same task, and the providers emit `playback:ended` synchronously
   * from the element's `ended`. That pause is not the viewer's, so it is not
   * counted: no `pause` beacon, no `pauseCount` increment, no pause duration.
   * A pause while the `ended` state is already set is dropped at once. A
   * pause near the end of VOD media is held for one macrotask
   * (`setTimeout(0)`): `onEnded()` discards it, and otherwise it is counted
   * as the viewer's, with its own time and position. A pause anywhere else
   * is counted immediately. Every pause still settles a pending play request
   * and closes an open rebuffer. A pause after the view's viewEnd is ignored.
   */
  function onPause(): void {
    if (!api || session.viewEnd !== null) return;

    accrueTime();

    // A stall that ends in a pause rather than a resume still closes.
    closeRebuffer(true);

    // A pause settles any request still waiting for its first frame
    playRequestPending = false;
    session.playbackState = 'paused';

    if (api.getState('ended') === true || pendingPause) return;

    const now = Date.now();
    const currentTime = api.getState('currentTime');

    if (isNearEndOfMedia()) {
      pendingPause = {
        time: now,
        currentTime,
        timer: setTimeout(commitPendingPause, 0),
      };
      return;
    }

    recordPause(now, currentTime);
  }

  /**
   * Count a viewer pause: `pauseCount`, the start of its duration, and the
   * `pause` beacon.
   *
   * @param time - When the pause happened
   * @param currentTime - The position it happened at
   */
  function recordPause(time: number, currentTime: number): void {
    session.pauseCount++;
    pauseStartTime = time;

    sendBeacon('pause', { currentTime });
  }

  /**
   * Count a held near-end pause as the viewer's (see onPause). No-op when
   * none is held. Called when its deferral runs out, and before anything
   * that would otherwise leave it held: playback resuming, the view ending,
   * the page unloading, a new view starting.
   */
  function commitPendingPause(): void {
    if (!pendingPause) return;

    const { time, currentTime, timer } = pendingPause;
    clearTimeout(timer);
    pendingPause = null;
    recordPause(time, currentTime);
  }

  /**
   * Drop a held near-end pause: `ended` followed it, so it was the
   * element's. No-op when none is held.
   */
  function discardPendingPause(): void {
    if (!pendingPause) return;

    clearTimeout(pendingPause.timer);
    pendingPause = null;
  }

  /**
   * Whether a VOD position is within half a second of a known duration.
   *
   * Only a reason to hold a pause until `ended` has had its chance, never
   * proof of the end on its own: a viewer can pause there too.
   *
   * @returns True when a pause now may be the element's end-of-media pause
   */
  function isNearEndOfMedia(): boolean {
    if (!api) return false;
    if (resolveIsLive() === true || api.getState('live') === true) return false;

    const duration = api.getState('duration');
    const currentTime = api.getState('currentTime');
    return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      && typeof currentTime === 'number' && currentTime >= duration - 0.5;
  }

  /**
   * Record the view's progress from a `playback:timeupdate`.
   *
   * The position is the payload's, the duration the state's, and only while
   * the duration is known. Core's load() zeroes both in state but emits no
   * timeupdate, so the outgoing view's last snapshot survives the reset for
   * its `completionRate`. accrueTime() records the same pair from state, as a
   * fallback for a provider that emits no timeupdate.
   *
   * @param payload - The `playback:timeupdate` payload, `{ currentTime }`
   */
  function onTimeUpdate(payload?: { currentTime?: number }): void {
    if (!api) return;

    const currentTime = payload?.currentTime;
    const duration = api.getState('duration');
    if (
      typeof currentTime === 'number' && Number.isFinite(currentTime)
      && typeof duration === 'number' && duration > 0
    ) {
      lastKnownCurrentTime = currentTime;
      lastKnownDuration = duration;
    }
  }

  /**
   * Handle buffering/waiting. Ignored after the view's viewEnd.
   */
  function onWaiting(): void {
    if (!api || session.viewEnd !== null) return;

    // Only count as rebuffer if we've started playing AND are not
    // mid-seek (seeks trigger waiting which is not a rebuffer).
    if (session.firstFrameTime !== null && !isRebuffering && waitingSince === null && !api.getState('seeking')) {
      // Time up to the stall was spent playing
      accrueTime();
      waitingSince = Date.now();
      if (rebufferGraceMs === 0) {
        openRebuffer(waitingSince);
        waitingSince = null;
      } else {
        graceTimer = setTimeout(() => {
          if (waitingSince !== null && !api?.getState('seeking')) {
            openRebuffer(waitingSince);
          }
          cancelPendingRebuffer();
        }, rebufferGraceMs);
      }
    }
  }

  /**
   * Count a confirmed stall, including its grace in the measured duration.
   * The beacon timestamp stays the send time, never backdated to waiting.
   * @param startedAt - Time of the original waiting event
   */
  function openRebuffer(startedAt: number): void {
    accrueTime();
    isRebuffering = true;
    rebufferStartTime = startedAt;
    session.rebufferCount++;
    sendBeacon('rebufferStart', {
      rebufferCount: session.rebufferCount,
      currentTime: api?.getState('currentTime'),
    });
  }

  /** Drop unconfirmed waiting without counting or beaconing a rebuffer. */
  function cancelPendingRebuffer(): void {
    // Credit pending waiting as watch time before clearing its play-time guard.
    if (waitingSince !== null) accrueTime();
    if (graceTimer !== null) clearTimeout(graceTimer);
    graceTimer = null;
    waitingSince = null;
  }

  /**
   * Handle seeking in an open view: count the seek and send a `seeking` beacon.
   * Ignore seeks after viewEnd; only a play request starts the replay view.
   *
   * `seekTo` is the seek target from the event payload. Core emits
   * `playback:seeking` before it writes `currentTime`, so the state still
   * holds the position the seek started from; it is only the fallback for an
   * emit without a finite `time`.
   *
   * @param payload - The `playback:seeking` payload, `{ time }` (the target)
   */
  function onSeeking(payload?: { time?: number }): void {
    if (!api || session.viewEnd !== null) return;

    markLiveSeek();
    cancelPendingRebuffer();
    const now = Date.now();
    // Coalesced requests can leave unused echoes. Do not renew expired ones.
    if (now - lastBusSeekAt > 1000) pendingEchoes = 0;
    pendingEchoes++;
    lastBusSeekAt = now;
    session.seekCount++;

    const target = payload?.time;
    sendBeacon('seeking', {
      seekCount: session.seekCount,
      seekSource: 'player',
      seekTo: typeof target === 'number' && Number.isFinite(target)
        ? target
        : api.getState('currentTime'),
    });
  }

  /**
   * Handle playback ended: `completed` for VOD, `liveEnded` for a live
   * stream, whose end is the broadcast's, not the viewer finishing it.
   */
  function onEnded(): void {
    // The pause just before this was the element's, not the viewer's
    discardPendingPause();
    accrueTime();
    session.playbackState = 'ended';
    session.exitType = resolveIsLive() === true ? 'liveEnded' : 'completed';
    sendViewEnd();
  }

  /**
   * Context for an error beacon: whether the browser reports itself online,
   * and the playing source's host name (no scheme, path, query or fragment).
   * @returns `online`, and `sourceHost` when the source has one
   */
  function errorContext(): { online?: boolean; sourceHost?: string } {
    const context: { online?: boolean; sourceHost?: string } = {};
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      context.online = navigator.onLine;
    }
    const host = sourceHost(api?.getState('source')?.src);
    if (host) context.sourceHost = host;
    return context;
  }

  /**
   * Handle errors (from media:error subscription).
   *
   * An error after the view's viewEnd belongs to no open view: no beacon,
   * no count. A fatal error marked `detail.reconnecting` is sent as a
   * warning and leaves the view open; the outage is reported by
   * onReconnecting and onRecovered.
   */
  function onError(payload: { error: Error }): void {
    if (session.viewEnd !== null) return;
    const error = payload.error;
    session.errorCount++;
    const category = classifyError(error as Error & { code?: unknown; detail?: unknown });
    const fatal = (error as Error & { fatal?: boolean }).fatal === true;
    // A fatal the provider will reconnect from does not end the view
    const terminal = fatal && !markedReconnecting((error as Error & { detail?: unknown }).detail);
    if (terminal) session.fatalErrorCategory = category;
    else session.warningCount++;

    const errorEvent: ErrorEvent = {
      time: Date.now(),
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      fatal,
    };

    session.errors.push(errorEvent);
    // Cap errors array to prevent memory growth during long sessions
    if (session.errors.length > 100) {
      session.errors = session.errors.slice(-100);
    }

    sendBeacon('error', {
      errorType: errorEvent.type,
      errorMessage: safeErrorMessage(errorEvent.message),
      ...((typeof (error as any).code === 'string' || typeof (error as any).code === 'number')
        ? { errorCode: (error as any).code } : {}),
      fatal: errorEvent.fatal,
      errorCategory: category,
      errorSeverity: terminal ? 'fatal' : 'warning',
      ...errorDetail((error as Error & { detail?: unknown }).detail),
      ...errorContext(),
    });

    if (terminal) {
      accrueTime();
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
   * payload with neither a string `code` nor a string `message` is ignored,
   * as is any error after the view's viewEnd. A fatal error marked
   * `detail.reconnecting` is sent as a warning and leaves the view open.
   */
  function onCoreError(err: any): void {
    if (!err || session.viewEnd !== null) return;
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
    const category = classifyError(err);
    const fatal = err.fatal === true;
    // A fatal the provider will reconnect from does not end the view
    const terminal = fatal && !markedReconnecting(err.detail);
    if (terminal) session.fatalErrorCategory = category;
    else session.warningCount++;
    const errorEvent: ErrorEvent = {
      time: Date.now(),
      type,
      message,
      fatal,
    };

    session.errors.push(errorEvent);
    if (session.errors.length > 100) {
      session.errors = session.errors.slice(-100);
    }

    sendBeacon('error', {
      errorType: errorEvent.type,
      errorMessage: safeErrorMessage(errorEvent.message),
      ...(code !== undefined ? { errorCode: code } : {}),
      fatal: errorEvent.fatal,
      errorCategory: category,
      errorSeverity: terminal ? 'fatal' : 'warning',
      ...errorDetail(err.detail),
      ...errorContext(),
    });

    if (terminal) {
      accrueTime();
      session.playbackState = 'error';
      session.exitType = 'error';
      sendViewEnd();
    }
  }

  /**
   * Handle quality/bitrate changes. Ignored after the view's viewEnd.
   */
  function onQualityChange(payload: { quality: string; auto: boolean }): void {
    if (!api || session.viewEnd !== null) return;

    const now = Date.now();
    session.qualityChanges++;

    // Try to get bitrate from quality levels
    const qualities = api.getState('qualities');
    const currentQuality = qualities.find((q: QualityLevel) => q.id === payload.quality);

    if (currentQuality) {
      // A level with no known bitrate (0) leaves the bitrate fields null
      // rather than averaging a 0 into them
      if (currentQuality.bitrate > 0) recordBitrate(now, currentQuality);

      sendBeacon('qualityChange', {
        bitrate: currentQuality.bitrate,
        width: currentQuality.width,
        height: currentQuality.height,
        auto: payload.auto,
      });
    }
  }

  /**
   * Add a level's bitrate to the history and to `maxBitrate`.
   *
   * @param now - When playback switched to the level
   * @param currentQuality - The level switched to, with a known bitrate
   */
  function recordBitrate(now: number, currentQuality: QualityLevel): void {
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

    if (session.maxBitrate === null || currentQuality.bitrate > session.maxBitrate) {
      session.maxBitrate = currentQuality.bitrate;
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
   * Only readings at the live edge are latency. A reading before the view's
   * first frame is dropped (the position is not yet where playback will be),
   * and so is one taken while the viewer watches the DVR window after a seek:
   * that offset is the viewer's choice, not delivery latency. A viewer who
   * drifts behind without seeking is still sampled.
   *
   * After a seek the first reading with `seeking` false decides, from the
   * `liveEdge` state, whether the view is back at the edge or in DVR mode.
   * The provider emits `live:latency` before it writes `liveEdge` for the
   * same reading (hls `applyLiveMetrics`), so the decision waits for its edge
   * event or a microtask. A following reading finishes the preceding one
   * before its own edge flag is written; a new seek discards a pending reading.
   *
   * @param payload - Latency behind the live edge, in seconds
   */
  function onLiveLatency(payload: { latency: number }): void {
    pendingLiveReading?.();
    if (session.firstFrameTime === null) return;
    if (liveMode === 'edge') {
      latencySampler.add(payload.latency);
      return;
    }
    if (api?.getState('seeking')) return;

    const reading = session;
    const finish = () => {
      if (pendingLiveReading !== finish) return;
      pendingLiveReading = null;
      if (!api || session !== reading || session.viewEnd !== null || api.getState('seeking')) return;
      settleLiveMode();
      if (liveMode === 'edge') latencySampler.add(payload.latency);
    };
    pendingLiveReading = finish;
    void Promise.resolve().then(finish);
  }

  /**
   * Finish a pending fresh reading with its edge flag, and leave DVR mode
   * when playback reaches the live edge again. Without a pending reading,
   * an edge change does not settle an awaiting seek.
   *
   * @param payload - The `live:edgechange` payload
   */
  function onLiveEdgeChange(payload: { atEdge: boolean }): void {
    pendingLiveReading?.();
    if (!api || session.viewEnd !== null) return;
    if (liveMode === 'dvr' && payload.atEdge) setLiveMode('edge');
  }

  /**
   * Mark a seek on a live view: latency readings wait for the first fresh
   * reading after the seek settles. No-op on VOD.
   */
  function markLiveSeek(): void {
    if (resolveIsLive() !== true && api?.getState('live') !== true) return;
    pendingLiveReading = null;
    setLiveMode('awaiting');
  }

  /**
   * Decide a pending or DVR live mode from the `liveEdge` state: at the edge,
   * sampling resumes; behind it, the view is in DVR mode. No-op at the edge
   * or while a seek is still in progress.
   */
  function settleLiveMode(): void {
    if (liveMode === 'edge' || !api || api.getState('seeking')) return;
    setLiveMode(api.getState('liveEdge') === true ? 'edge' : 'dvr');
  }

  /**
   * Switch live mode, accruing first so each stretch of play time is credited
   * to the mode it was spent in.
   *
   * @param next - The mode to switch to
   */
  function setLiveMode(next: typeof liveMode): void {
    if (next === liveMode) return;
    accrueTime();
    liveMode = next;
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
   * Handle page visibility change. Ignored after the view's viewEnd, whose
   * exit type stands.
   */
  function onVisibilityChange(): void {
    if (session.viewEnd !== null) return;
    if (document.hidden) {
      session.exitType = 'background';
      sendHeartbeat();
      transport.flush();
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

    // The page is going away: fold an open rebuffer's time into
    // rebufferDuration, but without its own beacon - only the unload viewEnd
    // below is sent.
    const viewEnd = finalizeView(false);

    if (!session.exitType) {
      session.exitType = 'abandoned';
    }
    // The same metrics as sendViewEnd(), latency included: an abandoned live
    // view is the one most worth having it for
    sendUnloadBeacon('viewEnd', viewEndMetrics(viewEnd));
  }

  // === Plugin Interface ===

  return {
    id: 'analytics',
    name: 'Analytics',
    version: PLUGIN_VERSION,
    type: 'analytics',
    description: 'Quality of Experience and engagement analytics',

    /** Begin the first view and subscribe to player and page events. @param pluginApi - Core plugin API. */
    async init(pluginApi: IPluginAPI): Promise<void> {
      api = pluginApi;
      statePlaying = api.getState('playing') === true;
      viewContext = pageContext(mergedConfig.playerInitTime);

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
      const unsubTimeUpdate = api.on('playback:timeupdate', onTimeUpdate);
      const unsubError = api.on('media:error', onError);
      const unsubCoreError = api.on('error', onCoreError);
      const unsubRecovered = api.on('error:recovered', onRecovered);
      const unsubReconnecting = api.on('error:reconnecting', onReconnecting);
      const unsubUnloaded = api.on('source:unloaded', onSourceUnloaded);
      const unsubQuality = api.on('quality:change', onQualityChange);
      const unsubSegment = api.on('media:segment', onSegment);
      // Live latency. The HLS provider emits this at the timeupdate cadence
      // for live content only, so a VOD session records nothing and the live
      // keys stay out of its beacons entirely.
      const unsubLatency = api.on('live:latency', onLiveLatency);
      const unsubEdgeChange = api.on('live:edgechange', onLiveEdgeChange);
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
        unsubRecovered,
        unsubReconnecting,
        unsubUnloaded,
        unsubQuality,
        unsubSegment,
        unsubLatency,
        unsubEdgeChange,
        unsubLowLatency,
        unsubPlaylist,
        unsubTimeUpdate
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

    /** End an open view, flush pending batches and remove all listeners. */
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
      transport.flush();

      discardPendingPause();
      cancelPendingRebuffer();

      // Cleanup event listeners
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];

      api?.logger.info('Analytics plugin destroyed');
      api = null;
    },

    // === Public API ===

    /** @returns Current view ID. */
    getViewId(): string {
      return session.viewId;
    },

    /** @returns Current session ID. */
    getSessionId(): string {
      return session.sessionId;
    },

    /** @returns QoE v2 score or null after fatal access denial. */
    getQoEScore(): number | null {
      return getQoEScore();
    },

    /** Set the identity mode for the next view; current IDs remain unchanged. @param anonymous - Disable storage for future views. */
    setAnonymous(anonymous: boolean): void {
      nextAnonymous = anonymous;
    },

    /** @returns Shallow snapshot of the current view metrics. */
    getMetrics(): Partial<ViewSession> {
      return { ...session };
    },

    /** Switch videos at a view boundary, ignoring same-video token refreshes. @param next - New video metadata. @throws Error if videoId is missing. */
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

    /** Send a host event through the normal privacy and transport rules. @param name - Custom event name. @param data - Event fields. */
    trackEvent(name: string, data: Record<string, unknown> = {}): void {
      sendBeacon(`custom:${name}`, data);
    },
  };
}

// Default export
export default createAnalyticsPlugin;
