/**
 * Captions Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';
import type { CaptionStyle, CaptionsStyleApi } from './caption-style';

/**
 * The captions plugin instance: a core plugin plus the caption style methods
 * ({@link CaptionsStyleApi}).
 */
export type CaptionsPlugin = Plugin & CaptionsStyleApi;

export interface CaptionSource {
  /** BCP 47 language code (e.g., 'en', 'es') */
  language: string;
  /** Human-readable label (e.g., 'English', 'Spanish') */
  label: string;
  /** WebVTT file URL */
  src: string;
  /** Track kind - default: 'subtitles' */
  kind?: 'subtitles' | 'captions';
  /**
   * Select this track once the media loads.
   *
   * Beats `defaultLanguage`, and applies even with `autoSelect` off. A
   * viewer's own pick still wins: selection happens once per media, and a
   * track already showing stands. Mark at most one source.
   */
  default?: boolean;
}

export interface CaptionsPluginConfig {
  /** External caption sources (WebVTT URLs) */
  sources?: CaptionSource[];
  /** Auto-extract subtitle tracks from HLS manifests - default: true */
  extractFromHLS?: boolean;
  /** Auto-select a track on load - default: false */
  autoSelect?: boolean;
  /** Preferred language for auto-select (BCP 47 code) - default: 'en' */
  defaultLanguage?: string;
  /**
   * Default caption text style, under the viewer's own saved choice. Fields
   * left out keep the browser default. Invalid fields are dropped with a
   * warning. With no style here and none saved, no stylesheet is added.
   */
  style?: CaptionStyle;
  /**
   * Save the viewer's caption style in `localStorage` and read it back on the
   * next load - default: true. With false, nothing is read or written and a
   * viewer's change lasts for this player only.
   */
  persistStyle?: boolean;
  /** `localStorage` key for the viewer's caption style - default: 'scarlett-caption-style' */
  styleStorageKey?: string;
  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}
