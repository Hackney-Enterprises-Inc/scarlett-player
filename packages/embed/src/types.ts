import type { AddonCreator, AddonName, AddonRuntime } from './addons/runtime';

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
  /**
   * Show the centred big play button over the poster (video only, default:
   * true).
   *
   * Mirrors `UIPluginConfig.bigPlayButton` in `@scarlett-player/ui`, which is
   * where the default lives: the embed forwards this to the video UI plugin
   * only when it is set, so leaving it out keeps the plugin's own default
   * rather than pinning a second copy of it here. Set it to `false` when the
   * host page draws its own play affordance over the player. The audio UIs
   * have no such control and ignore it.
   */
  bigPlayButton?: boolean;
  /**
   * Touch gestures on the video surface (video only, default: true).
   *
   * Double-tap the right of the picture to jump forward, the left to jump
   * back, and tap once to toggle the controls. Touch only, decided by input
   * type rather than user agent, so a mouse or pen never triggers any of it,
   * and seeking is suppressed while casting and on live without a DVR window.
   *
   * Set it to `false` on a third-party page that owns those gestures itself.
   */
  gestures?: boolean;
  /**
   * Canonical page URL to share, which also turns the share button on (video
   * only).
   *
   * There is no default and no fallback to the media `src`: playback URLs are
   * frequently signed, so sharing one leaks a credential and produces a link
   * that expires. Leaving this unset leaves the control bar exactly as it was,
   * which is why an existing embed never grows a button it did not ask for.
   *
   * Inside an iframe embed this is the parameter that makes sharing correct at
   * all. `window.location.href` there is the player page, not the page the
   * viewer is on, and cross-origin rules stop the plugin reading the parent, so
   * the host has to pass the real page in.
   */
  shareUrl?: string;
  /**
   * Base URL of the iframe embed page, which enables the `embed` share target.
   *
   * Only meaningful alongside {@link EmbedConfig.shareUrl}. The share sheet
   * drops the `embed` target rather than offering a broken snippet when this is
   * absent, so a share button without it still offers the OS sheet and copy
   * link. `iframe.html` reads it from `embed-base-url` / `embedBaseUrl`.
   */
  embedBaseUrl?: string;
  /** Brand/accent color for the player UI */
  brandColor?: string;
  /**
   * Accent colour for TEXT and active-state glyphs - the LIVE label, the
   * active rows in the settings and quality menus.
   *
   * Defaults to a readable tone derived from {@link EmbedConfig.brandColor},
   * because text answers to 4.5:1 where a fill answers to 3:1 and an iframe
   * host has no CSS of its own inside the player. Set it to take that over.
   */
  brandTextColor?: string;
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
  /** Watermark configuration */
  watermark?: WatermarkConfig;
  /** Captions configuration */
  captions?: CaptionsConfig;
  /**
   * Chapters, from `data-chapters`: an inline list or a WebVTT chapters URL.
   * Needs the `embed.addon.chapters` addon and a video player; without them
   * the embed warns and installs nothing.
   */
  chapters?: EmbedChaptersConfig;
  /**
   * Viewer-created clips, from the `data-clips-*` attributes. Needs the
   * `embed.addon.clips` addon, a video player and `csrf: 'meta'`; without
   * any of them the embed warns and installs nothing.
   */
  clips?: EmbedClipsConfig;
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
 * Watermark configuration for embed
 */
export interface WatermarkConfig {
  text?: string;
  imageUrl?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity?: number;
  fontSize?: number;
  dynamic?: boolean;
  dynamicInterval?: number;
  showDelay?: number;
}

/**
 * Captions configuration for embed
 */
export interface CaptionsConfig {
  sources?: Array<{
    language: string;
    label: string;
    src: string;
    kind?: 'subtitles' | 'captions';
    /** Select this track when the player loads */
    default?: boolean;
  }>;
  extractFromHLS?: boolean;
  autoSelect?: boolean;
  defaultLanguage?: string;
}

/**
 * One chapter, in the chapters plugin's own shape (`Chapter` in
 * `@scarlett-player/core`), restated here so the embed's types stand alone.
 */
export interface EmbedChapter {
  /** Start time in seconds */
  time: number;
  /** Chapter title */
  label: string;
  /** End time in seconds, exclusive. Omit to run until the next chapter */
  endTime?: number;
  /** Secondary line under the label in the chapter list */
  subtitle?: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Free-form chapter metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chapters configuration for embed: an inline list or a WebVTT chapters URL,
 * never both. `data-chapters` produces the first when its trimmed value
 * starts with `[` and the second otherwise.
 */
export type EmbedChaptersConfig = { chapters: EmbedChapter[] } | { src: string };

/**
 * Clips configuration for embed, from the `data-clips-*` attributes.
 *
 * The embed turns this into the clips plugin's own config: `endpoint` becomes
 * `endpoint.url`, and `csrf: 'meta'` adds an `X-CSRF-TOKEN` header read from
 * the host page's `<meta name="csrf-token">` on every submission.
 */
export interface EmbedClipsConfig {
  /** URL the clip is POSTed to (`data-clips-endpoint`) */
  endpoint: string;
  /**
   * The host's opt-in to reading its CSRF meta tag (`data-clips-csrf`).
   * `'meta'` is the only accepted value; without it the endpoint is inert.
   */
  csrf?: 'meta';
  /**
   * Id of the media being clipped (`data-clips-media-id`). When absent the
   * embed falls back to the analytics video id, then the source URL.
   */
  mediaId?: string;
  /** Longest clip allowed, in seconds (`data-clips-max-duration`) */
  maxDuration?: number;
  /** Shortest clip allowed, in seconds (`data-clips-min-duration`) */
  minDuration?: number;
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
  /**
   * Register a plugin creator an addon provides. Call before players
   * initialise; a player created earlier does not pick it up.
   */
  use(name: AddonName, creator: AddonCreator): void;
  /**
   * The embed's own instances of the functions addons need. Frozen. For addon
   * bundles only, not a public API for host code.
   */
  addonRuntime: AddonRuntime;
}

declare global {
  interface Window {
    ScarlettPlayer: ScarlettPlayerGlobal;
  }
}
