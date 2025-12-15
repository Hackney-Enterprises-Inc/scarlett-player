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

  /** Optional API key for authentication */
  apiKey?: string;

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

  /** Error sampling rate 0-1 (default: 1.0 = 100%) */
  errorSampleRate?: number;

  /** Disable analytics in development (default: false) */
  disableInDev?: boolean;

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

  /** Actual playback time (excludes rebuffer/pause) (ms) */
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

  /** Whether video is live */
  isLive?: boolean;

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
  getQoEScore(): number;

  /**
   * Get current metrics/session data.
   * @returns Partial view session data
   */
  getMetrics(): Partial<ViewSession>;

  /**
   * Track a custom event.
   * @param name - Event name
   * @param data - Event data
   */
  trackEvent(name: string, data?: Record<string, unknown>): void;
}
