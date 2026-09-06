/**
 * UI Controls Plugin Types
 */

import type { Plugin, IPluginAPI } from '@scarlett-player/core';
import type { FitRank } from './fit';

/**
 * Control slots this package implements itself.
 */
export type BuiltinControlSlot =
  | 'play'
  | 'skip-backward'
  | 'skip-forward'
  | 'volume'
  | 'progress'
  | 'time'
  | 'live-indicator'
  | 'quality'
  | 'settings'
  | 'captions'
  | 'airplay'
  | 'chromecast'
  | 'pip'
  | 'fullscreen'
  | 'spacer'
  | 'bandwidth-indicator';

/**
 * A control slot: a built-in, or any id a plugin registered through
 * {@link registerControl}.
 *
 * `string & {}` keeps editor autocomplete listing the built-ins while still
 * accepting custom ids - a plain `| string` would collapse the union and lose
 * the suggestions.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type ControlSlot = BuiltinControlSlot | (string & {});

/**
 * Builds a control instance. Receives the same plugin API the built-ins get.
 */
export type ControlFactory = (api: IPluginAPI) => Control;

/**
 * Layout configuration for the control bar.
 */
export interface LayoutConfig {
  /** Order of controls in the control bar */
  controls?: ControlSlot[];
  /** Delay in ms before hiding controls (default: 3000) */
  hideDelay?: number;
}

/**
 * Theme configuration for styling the controls.
 */
export interface ThemeConfig {
  /** Primary text/icon color (default: '#fff') */
  primaryColor?: string;
  /** Accent color for active states (default: '#e50914') */
  accentColor?: string;
  /** Control bar background (default: 'rgba(0,0,0,0.7)') */
  backgroundColor?: string;
  /** Control bar height in px (default: 48) */
  controlBarHeight?: number;
  /** Icon size in px (default: 24) */
  iconSize?: number;
}

/**
 * UI plugin configuration.
 */
export interface UIPluginConfig extends LayoutConfig {
  /** Theme configuration */
  theme?: ThemeConfig;
  /**
   * Show the centred big play button over the poster (default: true).
   *
   * It is the only play affordance on the picture itself: a mouse click on
   * the video surface only reveals the control bar, and touch taps belong to
   * the gestures plugin, so a player showing a poster with this off asks the
   * viewer to find the small button in the bar. Set it to `false` when the
   * host page draws its own play affordance over the player.
   */
  bigPlayButton?: boolean;
  /**
   * Let the bar move low-priority controls into a tray when it does not fit
   * (default: true).
   *
   * The bar is a single non-wrapping row of fixed-width items inside a host
   * that clips, so without this a narrow player simply renders its right-hand
   * controls past the edge: on a 390px phone with tsp-web's 17-slot layout that
   * is settings, captions, cast, PiP and fullscreen, all of them off canvas
   * (measured 2026-09-05). With it on, the bar measures itself and relocates
   * the least important controls into a tray behind a "More controls" button.
   *
   * `false` restores the pre-1.8 behaviour exactly: no measuring, no observer,
   * no tray button and no extra DOM. It is the escape hatch for a host that
   * pins its own layout and would rather clip.
   */
  responsive?: boolean;
  /**
   * Override how eagerly individual controls leave the bar.
   *
   * Keyed by control slot id; lower ranks leave first and `'never'` pins a
   * control in the bar at every width. Unlisted slots keep their default
   * ({@link DEFAULT_PRIORITY}), and any id that is not a built-in defaults to
   * rank 3. Use it to pin a registered control that owns an overlay positioned
   * against its own button, or to make a control the host cares about outlive
   * the rest.
   *
   * @example
   * ```ts
   * uiPlugin({ priority: { share: 'never', 'skip-forward': 6 } });
   * ```
   */
  priority?: Record<string, FitRank>;
}

/**
 * Base interface for all control components.
 */
export interface Control {
  /** Render the control element */
  render(): HTMLElement;
  /** Update control state */
  update(): void;
  /** Cleanup when control is destroyed */
  destroy(): void;
}

/**
 * Control constructor signature.
 */
export type ControlConstructor = new (api: IPluginAPI) => Control;

/**
 * UI Controls Plugin interface.
 */
export interface IUIPlugin extends Plugin {
  readonly id: 'ui-controls';

  /** Show the controls */
  show(): void;

  /** Hide the controls */
  hide(): void;

  /** Apply a theme configuration */
  setTheme(theme: ThemeConfig): void;

  /** Get the control bar element */
  getControlBar(): HTMLElement | null;
}
