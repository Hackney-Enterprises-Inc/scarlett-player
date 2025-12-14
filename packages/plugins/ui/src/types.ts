/**
 * UI Controls Plugin Types
 */

import type { Plugin, IPluginAPI } from '@scarlett-player/core';

/**
 * Available control slot identifiers.
 */
export type ControlSlot =
  | 'play'
  | 'volume'
  | 'progress'
  | 'time'
  | 'live-indicator'
  | 'quality'
  | 'airplay'
  | 'chromecast'
  | 'pip'
  | 'fullscreen'
  | 'spacer';

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
