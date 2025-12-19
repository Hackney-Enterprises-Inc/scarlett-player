/**
 * Audio UI Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

/**
 * Audio UI layout modes
 */
export type AudioUILayout = 'full' | 'compact' | 'mini';

/**
 * Audio UI theme
 */
export interface AudioUITheme {
  /** Primary color (buttons, progress) */
  primary?: string;

  /** Background color */
  background?: string;

  /** Text color */
  text?: string;

  /** Secondary text color (artist, duration) */
  textSecondary?: string;

  /** Progress bar background */
  progressBackground?: string;

  /** Progress bar fill */
  progressFill?: string;

  /** Border radius */
  borderRadius?: string;

  /** Font family */
  fontFamily?: string;
}

/**
 * Audio UI plugin configuration
 */
export interface AudioUIPluginConfig {
  /** Layout mode (default: 'full') */
  layout?: AudioUILayout;

  /** Show album artwork (default: true) */
  showArtwork?: boolean;

  /** Show track title (default: true) */
  showTitle?: boolean;

  /** Show artist name (default: true) */
  showArtist?: boolean;

  /** Show duration/time (default: true) */
  showTime?: boolean;

  /** Show volume control (default: true) */
  showVolume?: boolean;

  /** Show shuffle button - requires playlist plugin (default: true) */
  showShuffle?: boolean;

  /** Show repeat button - requires playlist plugin (default: true) */
  showRepeat?: boolean;

  /** Show next/previous buttons (default: true) */
  showNavigation?: boolean;

  /** Default artwork URL when none provided */
  defaultArtwork?: string;

  /** Custom theme */
  theme?: AudioUITheme;

  /** CSS class prefix (default: 'scarlett-audio') */
  classPrefix?: string;

  /** Auto-hide controls after inactivity (ms, 0 to disable) */
  autoHide?: number;

  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

/**
 * Audio UI plugin interface
 */
export interface IAudioUIPlugin extends Plugin<AudioUIPluginConfig> {
  /**
   * Get the UI container element
   */
  getElement(): HTMLElement | null;

  /**
   * Set the layout mode
   */
  setLayout(layout: AudioUILayout): void;

  /**
   * Update the theme
   */
  setTheme(theme: Partial<AudioUITheme>): void;

  /**
   * Show the UI
   */
  show(): void;

  /**
   * Hide the UI
   */
  hide(): void;

  /**
   * Toggle UI visibility
   */
  toggle(): void;
}
