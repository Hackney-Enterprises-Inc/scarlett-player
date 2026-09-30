/**
 * Analytics Plugin Type Definitions
 *
 * Type-safe analytics events, metrics, and configuration for Scarlett Player.
 */

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
  | 'error';

/**
 * Viewer plan/subscription type.
 */
export type ViewerPlan = 'free' | 'ppv' | 'subscriber' | 'premium' | string;

/**
 * Exit type enumeration.
 */
export type ExitType = 'completed' | 'abandoned' | 'error' | 'background' | null;

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
   * `navigator.sendBeacon`, which carries no headers at all; its fetch
   * fallback merges a static object but never calls a function, because a
   * promise awaited in a pagehide handler may never settle. Authenticate that
   * one with `apiKey`, which rides the URL.
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

  /** Number of times user paused */
  pauseCount: number;

  /** Total time spent paused (ms) */
  pauseDuration: number;

  /** Number of seek operations */
  seekCount: number;

  // === Quality of Experience (QoE) Metrics ===
  /** Time from play request to first frame (ms) */
  startupTime: number | null;

  /** Number of rebuffer events */
  rebufferCount: number;

  /** Total rebuffer time (ms) */
  rebufferDuration: number;

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

  /** Maximum bitrate achieved (bps) */
  maxBitrate: number;

  /** Average bitrate during playback (bps) */
  avgBitrate: number;

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
}
