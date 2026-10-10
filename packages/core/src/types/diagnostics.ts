/**
 * Type definitions for Scarlett Player diagnostics snapshots.
 *
 * Provides a synchronous, typed, bounded and side-effect free snapshot
 * of player playback state, recent errors, and provider contributions.
 */

/**
 * Permitted JSON primitive values in diagnostics.
 */
export type DiagnosticPrimitive = string | number | boolean | null;

/**
 * Permitted diagnostic values (bounded JSON-serializable primitives, arrays, and objects).
 */
export type DiagnosticValue =
  | DiagnosticPrimitive
  | DiagnosticValue[]
  | { [key: string]: DiagnosticValue };

/**
 * Bounded time range representation for media buffered / seekable ranges.
 */
export interface DiagnosticTimeRange {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/**
 * Safe, whitelisted playback state projection.
 */
export interface DiagnosticsPlaybackState {
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
  /** Total duration in seconds, or null if unknown / non-finite */
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
  seekableRange: DiagnosticTimeRange | null;
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
 * Structured diagnostic error entry (max 20 entries exported).
 */
export interface DiagnosticError {
  /** Error code enum string */
  code: string;
  /** Error category enum string */
  category: string;
  /** Whether error was fatal */
  fatal: boolean;
  /** Timestamp in epoch milliseconds */
  timestamp: number;
  /** Whitelisted numeric and boolean error details */
  detail?: Record<string, number | boolean>;
}

/**
 * Complete player diagnostics snapshot (schema version 1).
 */
export interface PlayerDiagnosticsSnapshot {
  /** Schema version constant (1) */
  schemaVersion: 1;
  /** Snapshot generation timestamp in epoch milliseconds */
  timestamp: number;
  /** Player library semantic version */
  playerVersion: string;
  /** Whitelisted playback state projection */
  playbackState: DiagnosticsPlaybackState;
  /** Bounded recent structured errors (max 20, core defaults to at most 10) */
  errors: DiagnosticError[];
  /** Sanitized provider contributions keyed by plugin ID */
  providers: Record<string, unknown>;
  /**
   * Sorted ids of providers whose contribution had values omitted or cut short
   * (strings outside the categorical allowlist, sensitive keys, caps). Empty
   * when every contribution came through whole.
   */
  truncatedProviders: string[];
}
