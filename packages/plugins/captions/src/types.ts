/**
 * Captions Plugin Types
 */

export interface CaptionSource {
  /** BCP 47 language code (e.g., 'en', 'es') */
  language: string;
  /** Human-readable label (e.g., 'English', 'Spanish') */
  label: string;
  /** WebVTT file URL */
  src: string;
  /** Track kind — default: 'subtitles' */
  kind?: 'subtitles' | 'captions';
  /** Whether this track should be selected by default */
  default?: boolean;
}

export interface CaptionsPluginConfig {
  /** External caption sources (WebVTT URLs) */
  sources?: CaptionSource[];
  /** Auto-extract subtitle tracks from HLS manifests — default: true */
  extractFromHLS?: boolean;
  /** Auto-select a track on load — default: false */
  autoSelect?: boolean;
  /** Preferred language for auto-select (BCP 47 code) — default: 'en' */
  defaultLanguage?: string;
  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}
