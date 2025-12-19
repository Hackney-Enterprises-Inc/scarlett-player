/**
 * Player type determines which UI to use
 */
export type PlayerType = 'video' | 'audio' | 'audio-mini';

/**
 * Configuration options that can be set via data attributes
 */
export interface EmbedConfig {
  /** Video/audio source URL (required) */
  src: string;
  /** Player type: 'video' (default), 'audio', or 'audio-mini' */
  type?: PlayerType;
  /** Autoplay the media */
  autoplay?: boolean;
  /** Mute the media */
  muted?: boolean;
  /** Poster/artwork image URL */
  poster?: string;
  /** Show/hide UI controls */
  controls?: boolean;
  /** Brand/accent color for the player UI */
  brandColor?: string;
  /** Primary color for UI elements */
  primaryColor?: string;
  /** Background color for controls */
  backgroundColor?: string;
  /** Auto-hide controls delay in milliseconds */
  hideDelay?: number;
  /** Player width (CSS value) */
  width?: string;
  /** Player height (CSS value) */
  height?: string;
  /** Aspect ratio (e.g., "16:9", "4:3") - video only */
  aspectRatio?: string;
  /** Enable/disable keyboard shortcuts */
  keyboard?: boolean;
  /** Loop the media */
  loop?: boolean;
  /** Playback rate (speed) */
  playbackRate?: number;
  /** Start time in seconds */
  startTime?: number;
  /** Custom class name for the container */
  className?: string;
  /** Media title (for audio/media session) */
  title?: string;
  /** Artist name (for audio/media session) */
  artist?: string;
  /** Album name (for audio/media session) */
  album?: string;
  /** Artwork URL (alias for poster, for audio) */
  artwork?: string;
  /** Playlist items */
  playlist?: PlaylistItem[];
  /** Analytics configuration */
  analytics?: AnalyticsConfig;
}

/**
 * Playlist item configuration
 */
export interface PlaylistItem {
  src: string;
  title?: string;
  artist?: string;
  poster?: string;
  artwork?: string;
  duration?: number;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  beaconUrl?: string;
  apiKey?: string;
  videoId?: string;
}

/**
 * Programmatic API options
 */
export interface EmbedPlayerOptions extends Partial<EmbedConfig> {
  /** Target container element or selector */
  container: string | HTMLElement;
}

/**
 * Global ScarlettPlayer API exposed on window
 */
export interface ScarlettPlayerGlobal {
  /** Create a new player instance programmatically */
  create(options: EmbedPlayerOptions): Promise<any>;
  /** Initialize all players with data-scarlett-player attribute */
  initAll(): Promise<void>;
  /** Version of the embed package */
  version: string;
  /** Available player types in this build */
  availableTypes: PlayerType[];
}

declare global {
  interface Window {
    ScarlettPlayer: ScarlettPlayerGlobal;
  }
}
