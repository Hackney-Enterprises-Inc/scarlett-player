/**
 * Configuration options that can be set via data attributes
 */
export interface EmbedConfig {
  /** Video source URL (required) */
  src: string;
  /** Autoplay the video */
  autoplay?: boolean;
  /** Mute the video */
  muted?: boolean;
  /** Poster image URL */
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
  /** Aspect ratio (e.g., "16:9", "4:3") */
  aspectRatio?: string;
  /** Enable/disable keyboard shortcuts */
  keyboard?: boolean;
  /** Loop the video */
  loop?: boolean;
  /** Playback rate (speed) */
  playbackRate?: number;
  /** Start time in seconds */
  startTime?: number;
  /** Custom class name for the container */
  className?: string;
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
  create(options: EmbedPlayerOptions): any;
  /** Initialize all players with data-scarlett-player attribute */
  initAll(): void;
  /** Version of the embed package */
  version: string;
}

declare global {
  interface Window {
    ScarlettPlayer: ScarlettPlayerGlobal;
  }
}
