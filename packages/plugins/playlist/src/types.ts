/**
 * Playlist Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

/**
 * A track in the playlist
 */
export interface PlaylistTrack {
  /** Unique track ID */
  id: string;

  /** Media source URL */
  src: string;

  /** Track title */
  title?: string;

  /** Artist/creator name */
  artist?: string;

  /** Album name */
  album?: string;

  /** Album art / thumbnail URL */
  artwork?: string;

  /** Duration in seconds (if known) */
  duration?: number;

  /** Media type */
  type?: 'audio' | 'video';

  /** MIME type hint */
  mimeType?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Repeat mode
 */
export type RepeatMode = 'none' | 'one' | 'all';

/**
 * Playlist state
 */
export interface PlaylistState {
  /** All tracks in the playlist */
  tracks: PlaylistTrack[];

  /** Current track index (-1 if no track) */
  currentIndex: number;

  /** Currently playing track */
  currentTrack: PlaylistTrack | null;

  /** Shuffle mode enabled */
  shuffle: boolean;

  /** Repeat mode */
  repeat: RepeatMode;

  /** Shuffled order (indices into tracks array) */
  shuffleOrder: number[];

  /** Whether there's a next track available */
  hasNext: boolean;

  /** Whether there's a previous track available */
  hasPrevious: boolean;
}

/**
 * Playlist plugin configuration
 */
export interface PlaylistPluginConfig {
  /** Auto-advance to next track when current ends (default: true) */
  autoAdvance?: boolean;

  /** Preload next track for gapless playback (default: true) */
  preloadNext?: boolean;

  /** Persist playlist to localStorage (default: false) */
  persist?: boolean;

  /** localStorage key for persistence (default: 'scarlett-playlist') */
  persistKey?: string;

  /** Initial tracks */
  tracks?: PlaylistTrack[];

  /** Initial shuffle state */
  shuffle?: boolean;

  /** Initial repeat mode */
  repeat?: RepeatMode;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

/**
 * Playlist plugin interface
 */
export interface IPlaylistPlugin extends Plugin<PlaylistPluginConfig> {
  /**
   * Add a track to the end of the playlist
   */
  add(track: PlaylistTrack | PlaylistTrack[]): void;

  /**
   * Insert a track at a specific position
   */
  insert(index: number, track: PlaylistTrack): void;

  /**
   * Remove a track by ID or index
   */
  remove(idOrIndex: string | number): void;

  /**
   * Clear all tracks
   */
  clear(): void;

  /**
   * Select a specific track by ID or index.
   * Emits playlist:change event - consumer should load and play from that event.
   */
  play(idOrIndex?: string | number): void;

  /**
   * Select the next track.
   * Emits playlist:change event - consumer should load and play from that event.
   */
  next(): void;

  /**
   * Select the previous track.
   * Emits playlist:change event - consumer should load and play from that event.
   */
  previous(): void;

  /**
   * Toggle shuffle mode
   */
  toggleShuffle(): void;

  /**
   * Set shuffle mode
   */
  setShuffle(enabled: boolean): void;

  /**
   * Cycle through repeat modes (none -> all -> one -> none)
   */
  cycleRepeat(): void;

  /**
   * Set repeat mode
   */
  setRepeat(mode: RepeatMode): void;

  /**
   * Move a track to a new position
   */
  move(fromIndex: number, toIndex: number): void;

  /**
   * Get current playlist state
   */
  getState(): PlaylistState;

  /**
   * Get all tracks
   */
  getTracks(): PlaylistTrack[];

  /**
   * Get current track
   */
  getCurrentTrack(): PlaylistTrack | null;

  /**
   * Get track by ID
   */
  getTrack(id: string): PlaylistTrack | null;
}

/**
 * Playlist events (extend core event map)
 */
export interface PlaylistEventMap {
  /** Track added to playlist */
  'playlist:add': { track: PlaylistTrack; index: number };

  /** Track removed from playlist */
  'playlist:remove': { track: PlaylistTrack; index: number };

  /** Playlist cleared */
  'playlist:clear': void;

  /** Current track changed */
  'playlist:change': { track: PlaylistTrack | null; index: number };

  /** Shuffle mode changed */
  'playlist:shuffle': { enabled: boolean };

  /** Repeat mode changed */
  'playlist:repeat': { mode: RepeatMode };

  /** Playlist order changed (reorder/move) */
  'playlist:reorder': { tracks: PlaylistTrack[] };

  /** Playlist ended (no more tracks) */
  'playlist:ended': void;
}
