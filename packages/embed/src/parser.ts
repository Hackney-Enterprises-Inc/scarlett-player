import type { EmbedConfig } from './types';

/**
 * Helper to get attribute with fallback aliases
 * Tries each name in order until one is found
 */
function getAttr(element: HTMLElement, ...names: string[]): string | null {
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Parse data attributes from an element into EmbedConfig
 * Supports multiple attribute naming conventions for flexibility:
 * - Full: data-src, data-autoplay, data-brand-color
 * - Short: src, autoplay, color
 */
export function parseDataAttributes(element: HTMLElement): Partial<EmbedConfig> {
  const config: Partial<EmbedConfig> = {};

  // Required: source URL (supports: data-src, src, href)
  const src = getAttr(element, 'data-src', 'src', 'href');
  if (src) {
    config.src = src;
  }

  // Boolean attributes (supports: data-autoplay or just autoplay)
  const autoplay = getAttr(element, 'data-autoplay', 'autoplay');
  if (autoplay !== null) {
    config.autoplay = autoplay !== 'false';
  }

  const muted = getAttr(element, 'data-muted', 'muted');
  if (muted !== null) {
    config.muted = muted !== 'false';
  }

  const controls = getAttr(element, 'data-controls', 'controls');
  if (controls !== null) {
    config.controls = controls !== 'false';
  }

  const keyboard = getAttr(element, 'data-keyboard', 'keyboard');
  if (keyboard !== null) {
    config.keyboard = keyboard !== 'false';
  }

  const loop = getAttr(element, 'data-loop', 'loop');
  if (loop !== null) {
    config.loop = loop !== 'false';
  }

  // String attributes (supports: data-poster or just poster)
  const poster = getAttr(element, 'data-poster', 'poster');
  if (poster) {
    config.poster = poster;
  }

  // Brand color (supports: data-brand-color, data-color, color)
  const brandColor = getAttr(element, 'data-brand-color', 'data-color', 'color');
  if (brandColor) {
    config.brandColor = brandColor;
  }

  const primaryColor = element.getAttribute('data-primary-color');
  if (primaryColor) {
    config.primaryColor = primaryColor;
  }

  const backgroundColor = element.getAttribute('data-background-color');
  if (backgroundColor) {
    config.backgroundColor = backgroundColor;
  }

  const width = element.getAttribute('data-width');
  if (width) {
    config.width = width;
  }

  const height = element.getAttribute('data-height');
  if (height) {
    config.height = height;
  }

  const aspectRatio = element.getAttribute('data-aspect-ratio');
  if (aspectRatio) {
    config.aspectRatio = aspectRatio;
  }

  const className = element.getAttribute('data-class');
  if (className) {
    config.className = className;
  }

  // Number attributes
  const hideDelay = element.getAttribute('data-hide-delay');
  if (hideDelay) {
    const parsed = parseInt(hideDelay, 10);
    if (!isNaN(parsed)) {
      config.hideDelay = parsed;
    }
  }

  const playbackRate = element.getAttribute('data-playback-rate');
  if (playbackRate) {
    const parsed = parseFloat(playbackRate);
    if (!isNaN(parsed)) {
      config.playbackRate = parsed;
    }
  }

  const startTime = element.getAttribute('data-start-time');
  if (startTime) {
    const parsed = parseFloat(startTime);
    if (!isNaN(parsed)) {
      config.startTime = parsed;
    }
  }

  return config;
}

/**
 * Convert aspect ratio string (e.g., "16:9") to percentage
 */
export function aspectRatioToPercent(ratio: string): number {
  const parts = ratio.split(':').map(Number);
  const width = parts[0];
  const height = parts[1];
  if (parts.length === 2 && width !== undefined && height !== undefined && !isNaN(width) && !isNaN(height) && width > 0) {
    return (height / width) * 100;
  }
  return 56.25; // Default 16:9
}

/**
 * Apply container styles based on config
 */
export function applyContainerStyles(
  container: HTMLElement,
  config: Partial<EmbedConfig>
): void {
  // Apply custom class
  if (config.className) {
    container.classList.add(...config.className.split(' '));
  }

  // Apply width
  if (config.width) {
    container.style.width = config.width;
  }

  // Apply height or aspect ratio
  if (config.height) {
    container.style.height = config.height;
  } else if (config.aspectRatio) {
    // Use padding-bottom technique for aspect ratio
    container.style.position = 'relative';
    container.style.paddingBottom = `${aspectRatioToPercent(config.aspectRatio)}%`;
    container.style.height = '0';
  }
}
