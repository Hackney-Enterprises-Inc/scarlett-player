/**
 * Watermark Plugin Types
 */

import type { Plugin } from '@scarlett-player/core';

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface WatermarkConfig {
  /** Text content to display (ignored if imageUrl is set) */
  text?: string;
  /** Image URL to display instead of text */
  imageUrl?: string;
  /** Position on the player — default: 'bottom-right' */
  position?: WatermarkPosition;
  /** Opacity 0-1 — default: 0.5 */
  opacity?: number;
  /** Font size in px for text watermarks — default: 14 */
  fontSize?: number;
  /** Image height in px — default: 40. Only applies when imageUrl is set. */
  imageHeight?: number;
  /** Padding from edges in px — default: 10 (40 for bottom to clear controls) */
  padding?: number;
  /** Whether to periodically move the watermark to a random position — default: false */
  dynamic?: boolean;
  /** Interval in ms for dynamic repositioning — default: 10000 */
  dynamicInterval?: number;
  /** Delay in ms before showing watermark after play — default: 0 */
  showDelay?: number;
  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}

export interface IWatermarkPlugin extends Plugin {
  /** Update the watermark to display the given text */
  setText(text: string): void;
  /** Update the watermark to display the given image */
  setImage(imageUrl: string): void;
  /** Move the watermark to a new position */
  setPosition(position: WatermarkPosition): void;
  /** Set watermark opacity (0-1) */
  setOpacity(opacity: number): void;
  /** Show the watermark */
  show(): void;
  /** Hide the watermark */
  hide(): void;
  /** Get the current watermark configuration */
  getConfig(): WatermarkConfig;
}
