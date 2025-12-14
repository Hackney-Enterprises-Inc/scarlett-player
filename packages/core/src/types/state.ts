/**
 * State management type definitions for Scarlett Player.
 *
 * All player state is managed through reactive signals.
 * Each property in StateStore will be a Signal<T> in the actual implementation.
 */

import type { Signal } from '../state/signal';

/**
 * Playback state enumeration.
 */
export type PlaybackState =
  | 'idle'        // Not loaded
  | 'loading'     // Loading media
  | 'ready'       // Ready to play
  | 'playing'     // Currently playing
  | 'paused'      // Paused
  | 'ended'       // Playback ended
  | 'error';      // Error occurred

/**
 * Media type enumeration.
 */
export type MediaType =
  | 'video'
  | 'audio'
  | 'unknown';

/**
 * Media source information.
 */
export interface MediaSource {
  /** Source URL */
  src: string;

  /** MIME type (e.g., 'application/x-mpegURL', 'application/dash+xml') */
  type?: string;

  /** Quality label (e.g., '1080p', '720p') */
  quality?: string;

  /** Bitrate in bits per second */
  bitrate?: number;
}

/**
 * Chapter/marker for VOD or live content.
 */
export interface Chapter {
  /** Chapter start time in seconds */
  time: number;

  /** Chapter label/title */
  label: string;

  /** Optional thumbnail URL */
  thumbnail?: string;

  /** Optional chapter metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Text track (subtitles/captions) information.
 */
export interface TextTrack {
  /** Track ID */
  id: string;

  /** Track label (e.g., 'English', 'Spanish') */
  label: string;

  /** Language code (e.g., 'en', 'es') */
  language: string;

  /** Track kind */
  kind: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';

  /** Whether track is currently active */
  active: boolean;
}

/**
 * Audio track information.
 */
export interface AudioTrack {
  /** Track ID */
  id: string;

  /** Track label (e.g., 'English', 'Director Commentary') */
  label: string;

  /** Language code (e.g., 'en', 'es') */
  language?: string;

  /** Whether track is currently active */
  active: boolean;
}

/**
 * Quality level information.
 */
export interface QualityLevel {
  /** Quality ID */
  id: string;

  /** Quality label (e.g., '1080p', '720p', 'auto') */
  label: string;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Bitrate in bits per second */
  bitrate: number;

  /** Whether this is the currently active quality */
  active: boolean;
}

/**
 * Seekable time range for live/DVR content.
 */
export interface SeekableRange {
  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;
}

/**
 * Complete player state store.
 * In StateManager, each property will be wrapped in a Signal<T>.
 */
export interface StateStore {
  // === Core Playback State ===
  /** Current playback state */
  playbackState: PlaybackState;

  /** Whether media is currently playing */
  playing: boolean;

  /** Whether media is paused */
  paused: boolean;

  /** Whether playback has ended */
  ended: boolean;

  /** Whether media is buffering/loading */
  buffering: boolean;

  /** Whether media is waiting for data */
  waiting: boolean;

  /** Whether media is currently seeking */
  seeking: boolean;

  // === Time & Duration ===
  /** Current playback time in seconds */
  currentTime: number;

  /** Total duration in seconds (NaN if unknown) */
  duration: number;

  /** Buffered time ranges */
  buffered: TimeRanges | null;

  /** Amount of media buffered ahead of current time (seconds) */
  bufferedAmount: number;

  // === Media Info ===
  /** Media type (video/audio) */
  mediaType: MediaType;

  /** Current media source */
  source: MediaSource | null;

  /** Media title */
  title: string;

  /** Media poster/thumbnail URL */
  poster: string;

  // === Volume & Audio ===
  /** Volume level (0-1) */
  volume: number;

  /** Whether audio is muted */
  muted: boolean;

  // === Playback Controls ===
  /** Playback rate/speed (1.0 = normal) */
  playbackRate: number;

  /** Whether player is in fullscreen */
  fullscreen: boolean;

  /** Whether player is in picture-in-picture */
  pip: boolean;

  /** Whether controls are visible */
  controlsVisible: boolean;

  // === Quality & Tracks ===
  /** Available quality levels */
  qualities: QualityLevel[];

  /** Currently active quality level */
  currentQuality: QualityLevel | null;

  /** Available audio tracks */
  audioTracks: AudioTrack[];

  /** Currently active audio track */
  currentAudioTrack: AudioTrack | null;

  /** Available text tracks (subtitles/captions) */
  textTracks: TextTrack[];

  /** Currently active text track */
  currentTextTrack: TextTrack | null;

  // === Live/DVR State (NEW for TSP) ===
  /** Whether this is live content */
  live: boolean;

  /** Whether playback is at the live edge */
  liveEdge: boolean;

  /** Seekable range for DVR (null if not DVR/live) */
  seekableRange: SeekableRange | null;

  /** Current latency from live edge in seconds */
  liveLatency: number;

  /** Whether low-latency mode is enabled */
  lowLatencyMode: boolean;

  // === Chapters (NEW for TSP) ===
  /** All available chapters */
  chapters: Chapter[];

  /** Currently active chapter (based on currentTime) */
  currentChapter: Chapter | null;

  // === Error State ===
  /** Current error (null if no error) */
  error: Error | null;

  // === Network & Performance ===
  /** Estimated network bandwidth in bits per second */
  bandwidth: number;

  /** Whether autoplay is enabled */
  autoplay: boolean;

  /** Whether loop is enabled */
  loop: boolean;

  // === Casting State ===
  /** Whether AirPlay devices are available */
  airplayAvailable: boolean;

  /** Whether currently casting via AirPlay */
  airplayActive: boolean;

  /** Whether Chromecast is available */
  chromecastAvailable: boolean;

  /** Whether currently casting via Chromecast */
  chromecastActive: boolean;

  // === UI State ===
  /** Whether user is currently interacting with player */
  interacting: boolean;

  /** Whether user is hovering over player */
  hovering: boolean;

  /** Whether player is in focus */
  focused: boolean;
}

/**
 * Type-safe state keys.
 */
export type StateKey = keyof StateStore;

/**
 * Type-safe state value for a given key.
 */
export type StateValue<K extends StateKey> = StateStore[K];

/**
 * State update payload for batch updates.
 */
export type StateUpdate = Partial<StateStore>;

/**
 * State change event payload.
 */
export interface StateChangeEvent<K extends StateKey = StateKey> {
  /** State key that changed */
  key: K;

  /** New value */
  value: StateValue<K>;

  /** Previous value */
  previousValue: StateValue<K>;
}

/**
 * State manager interface (to be implemented).
 */
export interface IStateManager {
  /** Get a state signal by key */
  get<K extends StateKey>(key: K): Signal<StateValue<K>>;

  /** Set a state value */
  set<K extends StateKey>(key: K, value: StateValue<K>): void;

  /** Update multiple state values at once */
  update(updates: StateUpdate): void;

  /** Reset all state to initial values */
  reset(): void;

  /** Subscribe to any state change */
  subscribe(callback: (event: StateChangeEvent) => void): () => void;

  /** Destroy state manager and cleanup */
  destroy(): void;
}
