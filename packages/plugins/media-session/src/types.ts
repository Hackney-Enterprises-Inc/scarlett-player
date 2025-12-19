/**
 * Media Session Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

/**
 * Media metadata for the session
 */
export interface MediaSessionMetadata {
  /** Track/video title */
  title?: string;

  /** Artist name */
  artist?: string;

  /** Album name */
  album?: string;

  /** Artwork URLs (multiple sizes for different displays) */
  artwork?: MediaSessionArtwork[];
}

/**
 * Artwork definition
 */
export interface MediaSessionArtwork {
  /** Image URL */
  src: string;

  /** Image size (e.g., '96x96', '256x256', '512x512') */
  sizes?: string;

  /** MIME type */
  type?: string;
}

/**
 * Media session action handlers
 */
export interface MediaSessionActions {
  /** Play action */
  play?: () => void;

  /** Pause action */
  pause?: () => void;

  /** Stop action */
  stop?: () => void;

  /** Seek backward action */
  seekbackward?: (details: { seekOffset?: number }) => void;

  /** Seek forward action */
  seekforward?: (details: { seekOffset?: number }) => void;

  /** Seek to position action */
  seekto?: (details: { seekTime: number; fastSeek?: boolean }) => void;

  /** Previous track action */
  previoustrack?: () => void;

  /** Next track action */
  nexttrack?: () => void;
}

/**
 * Media session plugin configuration
 */
export interface MediaSessionPluginConfig {
  /** Enable play/pause actions (default: true) */
  enablePlayPause?: boolean;

  /** Enable seek actions (default: true) */
  enableSeek?: boolean;

  /** Enable previous/next track actions (default: true) */
  enableTrackNavigation?: boolean;

  /** Seek offset in seconds for seekbackward/seekforward (default: 10) */
  seekOffset?: number;

  /** Default artwork to use when none provided */
  defaultArtwork?: MediaSessionArtwork[];

  /** Update position state on timeupdate (default: true) */
  updatePositionState?: boolean;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

/**
 * Media session plugin interface
 */
export interface IMediaSessionPlugin extends Plugin<MediaSessionPluginConfig> {
  /**
   * Check if Media Session API is supported
   */
  isSupported(): boolean;

  /**
   * Update media metadata
   */
  setMetadata(metadata: MediaSessionMetadata): void;

  /**
   * Update playback state
   */
  setPlaybackState(state: 'none' | 'paused' | 'playing'): void;

  /**
   * Update position state (for seek bar in system UI)
   */
  setPositionState(state: { duration: number; position: number; playbackRate: number }): void;

  /**
   * Set a custom action handler
   */
  setActionHandler(action: keyof MediaSessionActions, handler: (() => void) | null): void;
}
