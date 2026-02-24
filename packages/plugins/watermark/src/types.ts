/**
 * Watermark Plugin Types
 */

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
  /** Font size in px — default: 14 */
  fontSize?: number;
  /** Whether to periodically move the watermark to a random position — default: false */
  dynamic?: boolean;
  /** Interval in ms for dynamic repositioning — default: 10000 */
  dynamicInterval?: number;
  /** Delay in ms before showing watermark after play — default: 0 */
  showDelay?: number;
  /** Index signature for PluginConfig compatibility */
  [key: string]: unknown;
}
