/**
 * HLS Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

/** HLS plugin configuration options */
export interface HLSPluginConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Auto start loading when source is set */
  autoStartLoad?: boolean;
  /** Start position in seconds (-1 for default) */
  startPosition?: number;
  /**
   * Enable low-latency HLS for live streams (default: false).
   *
   * Turning this on does more than set the hls.js flag: it also enables
   * latency catch-up (`maxLiveSyncPlaybackRate`, which hls.js leaves at 1 and
   * therefore disabled). Without it, LL-HLS parses and loads parts but latency
   * settles wherever the buffer lands and is never pulled back. The retry
   * budgets are deliberately left at their standard-live values; see
   * `buildBaseHlsConfig()` for why widening them changes nothing a viewer
   * could see.
   *
   * Opt-in, and it is a REQUEST: the manifest has to carry `EXT-X-PART` or
   * advertise `CAN-BLOCK-RELOAD=YES` for low latency to actually happen. The
   * `lowLatencyMode` state key and the `live:lowlatency` event report what the
   * manifest supports, not what was requested here.
   */
  lowLatencyMode?: boolean;
  /**
   * Target latency for live streams in seconds, overriding the manifest's
   * `PART-HOLD-BACK` / `HOLD-BACK`. Left unset, hls.js derives the target from
   * the manifest, which is what a correctly packaged stream wants.
   */
  liveSyncDuration?: number;
  /**
   * Target latency expressed as a count of target durations (hls.js default:
   * 3). Mutually exclusive with `liveSyncDuration`: hls.js THROWS on a config
   * carrying both, so the plugin forwards one group only and logs which half
   * it dropped.
   */
  liveSyncDurationCount?: number;
  /**
   * Maximum latency in seconds before the player seeks forward to catch up.
   * Left unset, hls.js uses `liveMaxLatencyDurationCount`.
   */
  liveMaxLatencyDuration?: number;
  /**
   * Maximum latency as a count of target durations (hls.js default: Infinity,
   * i.e. never force a catch-up seek).
   */
  liveMaxLatencyDurationCount?: number;
  /**
   * Playback rate ceiling used to catch up to the live edge (hls.js default:
   * 1, which disables catch-up entirely).
   *
   * Defaults to 1.1 when `lowLatencyMode` is true and is left at hls.js's
   * default otherwise, so standard live and VOD are unchanged. 1.1 recovers a
   * second of drift in ten and the pitch shift is barely audible; 1.05 is
   * safer and slower.
   */
  maxLiveSyncPlaybackRate?: number;
  /**
   * Report live streams with an Infinity duration rather than the length of
   * the current sliding window (hls.js default: false).
   */
  liveDurationInfinity?: boolean;
  /** Max buffer length in seconds */
  maxBufferLength?: number;
  /** Max max buffer length in seconds */
  maxMaxBufferLength?: number;
  /** Back buffer length in seconds for DVR */
  backBufferLength?: number;
  /** Enable worker for hls.js (better performance) */
  enableWorker?: boolean;
  /**
   * Max network error retries before giving up (default: 3).
   *
   * Governs both playback branches: hls.js retries the load, and the native
   * (Safari/iOS) path reloads the source and restores position.
   */
  maxNetworkRetries?: number;
  /**
   * Max media error retries before giving up (default: 2).
   *
   * Governs both playback branches: hls.js calls recoverMediaError(), and the
   * native (Safari/iOS) path reloads the source and restores position.
   */
  maxMediaRetries?: number;
  /** Cap quality to player element dimensions (default: true) */
  capLevelToPlayerSize?: boolean;
  /** Override initial bandwidth estimate in bits per second */
  initialBandwidthEstimate?: number;
  /** Base retry delay in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  retryBackoffFactor?: number;
  /**
   * Watchdog for source loading in milliseconds (default: 30000, 0 disables).
   * If the manifest has not parsed within this window the load fails with an
   * error instead of leaving the viewer on a spinner forever.
   */
  loadTimeoutMs?: number;
  /**
   * Automatically attempt to reconnect after a fatal network/media error
   * once the stream had been playing (default: true). Viewers should not
   * have to press anything when a connection blip resolves itself.
   */
  autoReconnect?: boolean;
  /** First auto-reconnect delay in milliseconds (default: 2000) */
  reconnectBaseDelayMs?: number;
  /** Cap for the auto-reconnect backoff in milliseconds (default: 30000) */
  reconnectMaxDelayMs?: number;
  /** Total window to keep auto-reconnecting in milliseconds (default: 300000 = 5 min) */
  reconnectWindowMs?: number;
  /**
   * Validate every playlist response before it reaches the M3U8 parser
   * (default: true). A live refresh that returns an error page, a
   * master-only response, or an empty document becomes a normal network
   * error (bounded retries, then reconnect, then the retry UI) instead of
   * being indexed blindly.
   */
  validatePlaylists?: boolean;
  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

/** Quality level information */
export interface HLSQualityLevel {
  /** Level index in hls.js */
  index: number;
  /** Video width */
  width: number;
  /** Video height */
  height: number;
  /** Bitrate in bits per second */
  bitrate: number;
  /** Human-readable label (e.g., "1080p") */
  label: string;
  /** Codec info */
  codec?: string;
}

/** HLS error types */
export type HLSErrorType = 'network' | 'media' | 'mux' | 'other';

/** HLS error details */
export interface HLSError {
  type: HLSErrorType;
  details: string;
  fatal: boolean;
  url?: string;
  reason?: string;
  response?: { code: number; text: string };
}

/** Live stream info */
export interface HLSLiveInfo {
  /** Whether stream is live */
  isLive: boolean;
  /** Edge latency in seconds */
  latency: number;
  /** Target latency for low latency mode */
  targetLatency: number;
  /** Drift from live edge */
  drift: number;
  /** Position to seek to for live sync (seconds from start), when known */
  liveSyncPosition?: number;
  /**
   * Whether the stream is EFFECTIVELY low latency - the manifest carries
   * `EXT-X-PART` or advertises `CAN-BLOCK-RELOAD=YES` - rather than whether
   * `lowLatencyMode` was requested in the plugin config.
   */
  lowLatency: boolean;
}

/** HLS Plugin interface extending base Plugin */
export interface IHLSPlugin extends Plugin<HLSPluginConfig> {
  readonly id: 'hls-provider';

  /** Check if this provider can play a source */
  canPlay(src: string): boolean;

  /** Load and play a source */
  loadSource(src: string): Promise<void>;

  /** Get current quality level index (-1 = auto) */
  getCurrentLevel(): number;

  /** Set quality level (-1 for auto) */
  setLevel(index: number): void;

  /** Get all available quality levels */
  getLevels(): HLSQualityLevel[];

  /** Get the raw hls.js instance (for advanced use) */
  getHlsInstance(): unknown | null;

  /** Check if using native HLS (Safari) */
  isNativeHLS(): boolean;

  /** Get live stream info */
  getLiveInfo(): HLSLiveInfo | null;

  /** Switch from hls.js to native HLS (for AirPlay) */
  switchToNative(): Promise<void>;

  /** Switch from native HLS back to hls.js */
  switchToHlsJs(): Promise<void>;
}

/** Type guard for hls.js level */
export interface HlsLevel {
  width: number;
  height: number;
  bitrate: number;
  codecSet?: string;
  name?: string;
}

/** Minimal hls.js interface for type safety */
export interface HlsInstance {
  loadSource(src: string): void;
  attachMedia(media: HTMLMediaElement): void;
  detachMedia(): void;
  startLoad(startPosition?: number): void;
  stopLoad(): void;
  recoverMediaError(): void;
  destroy(): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  levels: HlsLevel[];
  currentLevel: number;
  autoLevelEnabled: boolean;
  nextLevel: number;
  loadLevel: number;
  latency?: number;
  targetLatency?: number;
  drift?: number;
  liveSyncPosition?: number;
  bandwidthEstimate?: number;
  media: HTMLMediaElement | null;
  /** Alternate audio renditions declared by the manifest. */
  audioTracks: HlsAudioTrack[];
  /** Index into {@link audioTracks} of the rendition currently playing. */
  audioTrack: number;
}

/**
 * One alternate audio rendition, as hls.js reports it.
 *
 * Only the fields this plugin reads; hls.js attaches several more.
 */
export interface HlsAudioTrack {
  /** hls.js's own numeric id for the track. */
  id?: number;
  /** Human-readable NAME from the manifest, e.g. "Director Commentary". */
  name?: string;
  /** BCP 47 language tag from the manifest, when it declares one. */
  lang?: string;
  /** Whether the manifest marked this the default rendition. */
  default?: boolean;
  /** Rendition group the track belongs to. */
  groupId?: string;
}

/** hls.js constructor type */
export interface HlsConstructor {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: Record<string, string>;
  ErrorTypes: Record<string, string>;
  /** hls.js default config (provides the base loader class for pLoader wrapping) */
  DefaultConfig?: Record<string, unknown>;
}
