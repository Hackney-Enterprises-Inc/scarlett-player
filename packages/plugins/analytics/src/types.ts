/**
 * Analytics Plugin Type Definitions
 *
 * Type-safe analytics events, metrics, and configuration for Scarlett Player.
 */

import type { Plugin } from '@scarlett-player/core';

/**
 * Mirrors `@scarlett-player/core`'s `DiagnosticTimeRange` structurally.
 * Declared locally so analytics' own declarations do not require a core
 * version newer than its peer range (`^1.8.0`).
 */
export interface AnalyticsDiagnosticTimeRange {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/**
 * Mirrors `@scarlett-player/core`'s `DiagnosticsPlaybackState` structurally.
 * Declared locally so analytics' own declarations do not require a core
 * version newer than its peer range (`^1.8.0`).
 */
export interface AnalyticsDiagnosticsPlaybackState {
  /** Current playback state ('idle', 'loading', 'playing', 'paused', 'ended', 'error', 'destroyed') */
  playbackState: string;
  /** Whether media is currently playing */
  playing: boolean;
  /** Whether media is currently paused */
  paused: boolean;
  /** Whether playback has ended */
  ended: boolean;
  /** Whether media is buffering */
  buffering: boolean;
  /** Whether media is seeking */
  seeking: boolean;
  /** Current playback time in seconds, or null if unavailable */
  currentTime: number | null;
  /** Total duration in seconds, or null if unknown or non-finite */
  duration: number | null;
  /** Volume level (0.0 to 1.0), or null if unavailable */
  volume: number | null;
  /** Whether audio is muted, or null if unavailable */
  muted: boolean | null;
  /** Playback rate, or null if unavailable */
  playbackRate: number | null;
  /** Media type ('video' | 'audio'), or null if unknown / not set */
  mediaType: string | null;
  /** Whether stream is live, or null if unavailable */
  live: boolean | null;
  /** Safe seekable range for live/DVR, or null */
  seekableRange: AnalyticsDiagnosticTimeRange | null;
  /** Whether playback is at live edge (or live edge position), or null */
  liveEdge: boolean | number | null;
  /** Latency from live edge in seconds, or null */
  liveLatency: number | null;
  /** Intrinsic media dimensions in pixels, or null if unavailable */
  dimensions: { width: number; height: number } | null;
  /** Media source hostname and optional type (never contains query, fragments or tokens) */
  source: { hostname: string | null; type?: string | null } | null;
}

/**
 * Mirrors `@scarlett-player/core`'s `DiagnosticError` structurally.
 * Declared locally so analytics' own declarations do not require a core
 * version newer than its peer range (`^1.8.0`).
 */
export interface AnalyticsDiagnosticError {
  /** Error code enum string */
  code: string;
  /** Error category enum string */
  category: string;
  /** Whether the error was fatal */
  fatal: boolean;
  /** Timestamp in epoch milliseconds */
  timestamp: number;
  /** Allowlisted numeric and boolean error details */
  detail?: Record<string, number | boolean>;
}

/**
 * Analytics event types.
 */
export type AnalyticsEventType =
  | 'viewStart'
  | 'viewEnd'
  | 'playRequest'
  | 'videoStart'
  | 'heartbeat'
  | 'pause'
  | 'seeking'
  | 'rebufferStart'
  | 'rebufferEnd'
  | 'qualityChange'
  | 'error'
  | 'reconnecting'
  | 'recovered';

/**
 * Viewer plan/subscription type.
 */
export type ViewerPlan = 'free' | 'ppv' | 'subscriber' | 'premium' | string;

/**
 * Exit type enumeration. `liveEnded` is a live stream that ended: the
 * broadcast is over, which is not the viewer completing it.
 */
export type ExitType = 'completed' | 'liveEnded' | 'abandoned' | 'error' | 'background' | null;

/**
 * Playback state for session tracking.
 */
export type SessionPlaybackState = 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/**
 * Device type enumeration.
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv' | 'unknown';

/**
 * Analytics plugin configuration.
 */
export interface AnalyticsConfig {
  /** Your API endpoint for receiving analytics beacons */
  beaconUrl: string;

  /**
   * Optional API key for authentication.
   *
   * HTTPS endpoints only. Sent as `X-API-Key` on the fetch transport, and as
   * an `api_key` query parameter on the unload beacon, which `sendBeacon`
   * cannot give a header to.
   */
  apiKey?: string;

  /**
   * Extra headers for the fetch transport: an object, or a function resolved
   * per beacon for a rotating CSRF or Bearer token. Merged over
   * `Content-Type` and `X-API-Key`, so either can be overridden.
   *
   * The unload beacon (`viewEnd` on pagehide) goes out through
   * `navigator.sendBeacon`, which carries no headers at all. Its fetch
   * fallback merges a static object, and calls a function once without
   * waiting: a plain object it returns is used, but a promise is not awaited
   * (one awaited in a pagehide handler may never settle), so an async
   * function's headers are left off that request. A throwing or rejecting
   * function is logged at debug and the beacon still goes out. Authenticate
   * the unload beacon with `apiKey`, which rides the URL.
   */
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);

  // === Video Metadata ===
  /** Unique video identifier (required) */
  videoId: string;

  /** Human-readable video title */
  videoTitle?: string;

  /** Video series/collection name */
  videoSeries?: string;

  /** Total video duration in seconds (if known) */
  videoDuration?: number;

  /** Whether this is live content */
  isLive?: boolean;

  // === Viewer Information ===
  /** Unique viewer identifier (auto-generated if not provided) */
  viewerId?: string;

  /** Viewer's plan/subscription type */
  viewerPlan?: ViewerPlan;

  // === Custom Dimensions ===
  /** Additional custom dimensions to include with all events */
  customDimensions?: Record<string, string | number | boolean>;

  // === Behavior Configuration ===
  /** Heartbeat interval in milliseconds (default: 10000) */
  heartbeatInterval?: number;

  /**
   * Minimum waiting time before counting a rebuffer (ms, default: 250).
   * Zero opens synchronously; negative or non-finite values use 250.
   * Confirmed stalls include the grace in their duration, but rebufferStart's
   * timestamp is its send time, not the original waiting time.
   */
  rebufferGraceMs?: number;

  /**
   * End a view that has not been playing for this long (ms, default: 1800000,
   * 30 minutes). Paused, stalled, still loading or never started all count as
   * not playing. The view sends its `viewEnd` with exitType `abandoned` and
   * stops its heartbeat; playback that resumes later (a play, a stall that
   * recovers, a reconnect) starts a new view. Checked at each heartbeat, so the
   * end can come up to one `heartbeatInterval` late. Zero disables; negative or
   * non-finite values use the default.
   */
  idleTimeout?: number;

  /** Error sampling rate 0-1 (default: 1.0 = 100%) */
  errorSampleRate?: number;

  /** Disable analytics in development (default: false) */
  disableInDev?: boolean;

  /** Honor DNT (`1`) and Global Privacy Control on every beacon; default false. */
  respectDoNotTrack?: boolean;
  /** Use fresh viewer and session IDs for each view, without reading or writing storage. */
  anonymous?: boolean;
  /** Last per-beacon hook, including unload and queued events. Return null to discard; non-object results fall back to the original payload. */
  beforeSend?: (payload: BeaconPayload) => BeaconPayload | null;
  /** Host-captured epoch milliseconds at player script startup. */
  playerInitTime?: number;
  /** Opt in to the batch envelope; requires a compatible custom ingest. Default false. */
  batch?: boolean | { intervalMs?: number; maxEvents?: number };

  /** Custom beacon transport function (for testing) */
  customBeacon?: BeaconFunction;
}

/**
 * Bitrate/quality change event.
 */
export interface BitrateChange {
  /** Timestamp when bitrate changed */
  time: number;

  /** New bitrate in bits per second */
  bitrate: number;

  /** Video width in pixels */
  width: number;

  /** Video height in pixels */
  height: number;
}

/**
 * Error event details.
 */
export interface ErrorEvent {
  /** Timestamp when error occurred */
  time: number;

  /** Error type/category */
  type: string;

  /** Error message */
  message: string;

  /** Whether error was fatal (stopped playback) */
  fatal: boolean;

  /** Optional error code */
  code?: string | number;
}

/**
 * View session data - tracks a single viewing attempt.
 */
export interface ViewSession {
  // === Session Identifiers ===
  /** Unique view ID (one per playback attempt) */
  viewId: string;

  /** Last dispatched beacon number in this view; starts at zero before viewStart. */
  beaconSeq: number;

  /** Identity mode fixed for the lifetime of this view. */
  anonymous: boolean;

  /** Session ID (persists across views in same browsing session) */
  sessionId: string;

  /** Viewer ID (persists across sessions) */
  viewerId: string;

  // === Timestamps ===
  /** When view started (player initialized) */
  viewStart: number;

  /** When play was requested (user clicked play) */
  playRequestTime: number | null;

  /** When first frame rendered */
  firstFrameTime: number | null;

  /** When view ended */
  viewEnd: number | null;

  // === Engagement Metrics ===
  /** Total time from viewStart to viewEnd (ms) */
  watchTime: number;

  /** Actual playback time (excludes waiting, including dropped grace, and pauses) (ms) */
  playTime: number;

  /**
   * Playback time spent behind the live edge after a seek (ms): the
   * `playTime` rule, counted only while the view is in DVR mode. Zero on VOD,
   * and only sent on live views.
   */
  dvrTime: number;

  /** Number of times user paused */
  pauseCount: number;

  /** Total time spent paused (ms) */
  pauseDuration: number;

  /**
   * Number of seeks: player seeks plus element seek bursts (element seeks
   * each within 2 s of the previous one count once).
   */
  seekCount: number;

  /**
   * Every element (native controls or media) seek that was not the echo of
   * a player seek, uncoalesced, so a seek storm shows without one beacon per
   * seek.
   */
  elementSeekCount: number;

  // === Quality of Experience (QoE) Metrics ===
  /** Time from play request to first frame (ms) */
  startupTime: number | null;

  /** Number of rebuffer events */
  rebufferCount: number;

  /** Total rebuffer time (ms) */
  rebufferDuration: number;

  /**
   * Provider auto-reconnect outages in this view: each run of
   * `error:reconnecting` up to its `error:recovered` or the view's end
   * counts once, however many attempts it took.
   */
  reconnectCount: number;

  /** Total time spent in those outages within this view (ms) */
  reconnectDuration: number;

  /** Number of errors encountered */
  errorCount: number;

  /** Non-fatal errors in this view, including sampled-out beacons. */
  warningCount: number;

  /** Category of the fatal error ending this view, if any. */
  fatalErrorCategory: ErrorCategory | null;

  /** Array of error events */
  errors: ErrorEvent[];

  // === Quality Metrics ===
  /** History of bitrate changes */
  bitrateHistory: BitrateChange[];

  /** Number of quality level changes */
  qualityChanges: number;

  /** Maximum bitrate achieved (bps), or null until a quality change supplies one */
  maxBitrate: number | null;

  /**
   * Average bitrate during playback (bps), weighted by time at each level, or
   * null until a quality change supplies one
   */
  avgBitrate: number | null;

  // === Exit Information ===
  /** Current playback state */
  playbackState: SessionPlaybackState;

  /** How the view ended */
  exitType: ExitType;

  // === Classification ===
  /**
   * Last known live classification: null until the provider has classified
   * the source, then set at each `media:loadedmetadata` and whenever `live`
   * turns true. Core's `live: false` reset on `load()` is ignored, so after a
   * playlist advance this keeps the previous item's value until the new
   * item's metadata.
   */
  lastKnownIsLive: boolean | null;
}

/**
 * Beacon payload structure sent to analytics endpoint.
 */
export interface BeaconPayload {
  // === Event Info ===
  /** Event type */
  event: AnalyticsEventType | string;

  /** Event timestamp */
  timestamp: number;

  /**
   * Per-view dispatch order, starting at 1 on viewStart. Sampled-out errors
   * and disabled analytics do not consume numbers. Ingests that drop events
   * (such as heartbeats) will see gaps. Custom dimensions cannot override it.
   */
  beaconSeq: number;

  /** On seeking beacons: a player bus request or an element/native-controls seek. */
  seekSource?: 'player' | 'element';

  /** Present only when persistent IDs are disabled for this view. */
  anonymous?: true;

  /** Sanitized origin plus pathname on viewStart only. */
  pageUrl?: string;
  /** Origin of the document referrer on viewStart, when parseable. */
  referrerOrigin?: string;
  /** Milliseconds from page navigation to plugin initialization. */
  pageLoadToInitMs?: number;
  /** Milliseconds from host-supplied playerInitTime to plugin initialization. */
  playerInitMs?: number;

  /** Continuous QoE scoring contract identifier. */
  qoeVersion?: 2;
  /** Null for an access-denied fatal view. */
  qoeScore?: number | null;

  /**
   * The units of the viewEnd gauges `completionRate` and `rebufferRatio`.
   * This plugin always sends `percent`: both gauges are 0..100, or null when
   * the measurement is unavailable (live or unknown completion, unusable
   * inputs). `ratio` (0..1) belongs to explicitly compatible external
   * producers; ingests normalize either declared scale into canonical 0..1
   * columns and never infer units from a value's magnitude.
   */
  gaugeScale?: 'percent' | 'ratio';

  /** Structured error category on error events. */
  errorCategory?: ErrorCategory;
  /** Fatal error or non-fatal warning. */
  errorSeverity?: 'fatal' | 'warning';
  /** Validated, numeric HTTP status from the player error detail. */
  httpStatus?: number;
  /** Browser media error code when supplied by the provider. */
  mediaErrorCode?: number;
  /** Number of connection/load attempts when provided. */
  attempts?: number;
  /** Whether the provider exhausted retries. */
  retriesExhausted?: boolean;
  /** Whether reconnect attempts were exhausted. */
  reconnectExhausted?: boolean;
  /**
   * On an error beacon: the provider will auto-reconnect, so the fatal
   * error is reported as a warning and the view stays open.
   */
  reconnecting?: boolean;
  /** Whether the provider reported a timeout. */
  timedOut?: boolean;
  /** Non-fatal errors accumulated for this view. */
  warningCount?: number;
  /** Category of the fatal error that ended the view. */
  fatalErrorCategory?: ErrorCategory;

  // === View Context ===
  /** Current view ID */
  viewId: string;

  /** Current session ID */
  sessionId: string;

  /** Viewer ID */
  viewerId: string;

  // === Video Context ===
  /** Video ID */
  videoId: string;

  /** Video title */
  videoTitle?: string;

  /**
   * Whether the video is live: `config.isLive` when set, otherwise the view's
   * last known classification. `null` means not yet known (every `viewStart`
   * without `config.isLive`); treat it as absent and merge true-wins.
   */
  isLive?: boolean | null;

  // === Player Context ===
  /** Player version */
  playerVersion: string;

  /** Player name */
  playerName: string;

  // === Environment ===
  /** Browser name */
  browser: string;

  /** Operating system */
  os: string;

  /** Device type */
  deviceType: DeviceType;

  /** Screen resolution */
  screenSize: string;

  /** Player size */
  playerSize: string;

  /** Network connection type */
  connectionType: string;

  // === Custom Dimensions ===
  /** Any custom dimensions from config */
  [key: string]: unknown;
}

/**
 * Browser information.
 */
export interface BrowserInfo {
  /** Browser name */
  name: string;

  /** Browser version (if detectable) */
  version?: string;
}

/**
 * Operating system information.
 */
export interface OSInfo {
  /** OS name */
  name: string;

  /** OS version (if detectable) */
  version?: string;
}

/**
 * Custom beacon transport function.
 */
export type BeaconFunction = (
  url: string,
  payload: BeaconPayload
) => void | Promise<void>;

/** Structured player error groups; classification never examines message text. */
export type ErrorCategory = 'access' | 'network' | 'media' | 'source' | 'playback' | 'player' | 'unknown';

/**
 * The video a view is about: what `setVideo()` takes.
 *
 * A different `videoId` from the current one ends the current view and starts
 * a new one; the same `videoId` (a token refresh, a re-signed URL) changes
 * nothing.
 */
export interface AnalyticsVideo {
  /** Unique video identifier */
  videoId: string;

  /** Human-readable video title */
  videoTitle?: string;

  /**
   * Whether this video is live. Omitted, the view classifies the source from
   * the player's `live` state, as it does without `config.isLive`.
   */
  isLive?: boolean;
}

/**
 * Public API exposed by Analytics plugin.
 */
export interface IAnalyticsPlugin {
  /** Plugin metadata */
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: 'analytics';

  /** Initialize plugin */
  init(api: unknown, config?: Partial<AnalyticsConfig>): void | Promise<void>;

  /** Destroy plugin */
  destroy(): void | Promise<void>;

  // === Public Methods ===

  /**
   * Get current view ID.
   * @returns Current view ID
   */
  getViewId(): string;

  /**
   * Get current session ID.
   * @returns Current session ID
   */
  getSessionId(): string;

  /**
   * Get calculated QoE score (0-100).
   * @returns Quality of Experience score
   */
  getQoEScore(): number | null;

  /** Switch persistent/ephemeral identity for the next view only. @param anonymous - True to avoid all storage for the next view. */
  setAnonymous(anonymous: boolean): void;

  /**
   * Get current metrics/session data.
   * @returns Partial view session data
   */
  getMetrics(): Partial<ViewSession>;

  /**
   * Switch the view to another video.
   *
   * A different `videoId` ends the current view (`viewEnd`, exit type
   * `abandoned` unless it already ended) and starts a new one with a new view
   * ID, a `viewStart` for the new video and a fresh heartbeat. The same
   * `videoId` is a no-op, so re-loading a refreshed URL for the video already
   * playing never splits its view. Call it before `player.load()` so the new
   * view sees the source's metadata. Before `init()`, it only replaces the
   * video the first view will report.
   *
   * A playlist does this by itself: after `playlist:change`, the next source
   * load starts a view for that track, reporting its `videoId` (or the
   * configured one when it has none) and `title`. Calling `setVideo()` drops
   * a playlist track still waiting to load.
   *
   * @param video - The video now playing
   * @throws Error if `videoId` is empty
   */
  setVideo(video: AnalyticsVideo): void;

  /**
   * Track a custom event.
   * @param name - Event name
   * @param data - Event data
   */
  trackEvent(name: string, data?: Record<string, unknown>): void;

  /**
   * Get synchronous troubleshooting snapshot of player state, provider contributions,
   * whitelisted session metrics and QoE v2.
   *
   * Side-effect free; does not alter heartbeats, timers, sequence numbers or session metrics.
   *
   * @returns AnalyticsDiagnosticsSnapshot adhering to schemaVersion: 1
   */
  getDiagnostics(): AnalyticsDiagnosticsSnapshot;
}

/**
 * Concrete plugin instance returned by createAnalyticsPlugin.
 */
export type AnalyticsPluginInstance = Omit<Plugin, 'init' | 'getDiagnostics'> &
  IAnalyticsPlugin & {
    getDiagnostics(): AnalyticsDiagnosticsSnapshot;
  };

/**
 * Whitelisted session metrics for diagnostics snapshot.
 */
export interface AnalyticsMetricsSnapshot {
  /** Time since the view started, in milliseconds, including the open interval since the last heartbeat. */
  watchTime: number;
  /** Time spent actually playing, in milliseconds, including the open interval. */
  playTime: number;
  /** `playTime` as of the last heartbeat, in milliseconds, without the open interval. */
  settledPlayTime: number;
  /** Rebuffer events so far. */
  rebufferCount: number;
  /** Total time spent rebuffering, in milliseconds. */
  rebufferDuration: number;
  /** Reconnect episodes so far. */
  reconnectCount: number;
  /** Total time spent reconnecting, in milliseconds, including an open episode. */
  reconnectDuration: number;
  /** `reconnectDuration` without an open episode, in milliseconds. */
  settledReconnectDuration: number;
  /** Times the viewer paused. */
  pauseCount: number;
  /** Total time spent paused, in milliseconds, including an open pause. */
  pauseDuration: number;
  /** `pauseDuration` without an open pause, in milliseconds. */
  settledPauseDuration: number;
  /** Seeks so far (player seeks plus coalesced element seek bursts). */
  seekCount: number;
  /** Errors recorded so far. */
  errorCount: number;
  /** Warnings recorded so far. */
  warningCount: number;
  /** Quality level changes so far. */
  qualityChanges: number;
  /** Time-weighted average bitrate in bits per second; `null` until a quality is known. */
  avgBitrate: number | null;
  /** Highest bitrate seen in bits per second; `null` until a quality is known. */
  maxBitrate: number | null;
  /** Time from play request to first frame, in milliseconds; `null` until the first frame. */
  startupTime: number | null;
  /** Playback time spent behind the live edge, in milliseconds; present only on live views. */
  dvrTime?: number | null;
}

/**
 * QoE score and schema version for diagnostics snapshot.
 */
export interface AnalyticsQoESnapshot {
  score: number | null;
  version: 2;
}

/**
 * Full analytics troubleshooting diagnostics snapshot.
 */
export interface AnalyticsDiagnosticsSnapshot {
  schemaVersion: 1;
  timestamp: number;
  playerVersion: string;
  viewId: string | null;
  playbackState: AnalyticsDiagnosticsPlaybackState;
  errors: AnalyticsDiagnosticError[];
  providers: Record<string, unknown>;
  metrics: AnalyticsMetricsSnapshot;
  qoe: AnalyticsQoESnapshot;
}
