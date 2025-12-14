/**
 * HLS Plugin Types
 */

import type { Plugin, IPluginAPI } from '@scarlett-player/core';

/** HLS plugin configuration options */
export interface HLSPluginConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Auto start loading when source is set */
  autoStartLoad?: boolean;
  /** Start position in seconds (-1 for default) */
  startPosition?: number;
  /** Enable low latency mode for live streams */
  lowLatencyMode?: boolean;
  /** Max buffer length in seconds */
  maxBufferLength?: number;
  /** Max max buffer length in seconds */
  maxMaxBufferLength?: number;
  /** Back buffer length in seconds for DVR */
  backBufferLength?: number;
  /** Enable worker for hls.js (better performance) */
  enableWorker?: boolean;
  /** Max network error retries before giving up (default: 3) */
  maxNetworkRetries?: number;
  /** Max media error retries before giving up (default: 2) */
  maxMediaRetries?: number;
  /** Base retry delay in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  retryBackoffFactor?: number;
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
  media: HTMLMediaElement | null;
}

/** hls.js constructor type */
export interface HlsConstructor {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: Record<string, string>;
  ErrorTypes: Record<string, string>;
}
