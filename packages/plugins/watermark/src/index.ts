/**
 * Watermark Plugin for Scarlett Player
 *
 * Provides anti-piracy watermark overlay with:
 * - Text or image rendering
 * - Configurable position and opacity
 * - Dynamic repositioning mode (moves periodically)
 * - Show delay
 * - Per-track watermark updates via playlist:change metadata
 */

import type { IPluginAPI, PluginType } from '@scarlett-player/core';
import type { IWatermarkPlugin, WatermarkConfig, WatermarkPosition } from './types';

export type { IWatermarkPlugin, WatermarkConfig, WatermarkPosition } from './types';

const POSITIONS: WatermarkPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

function getPositionStyles(padding: number, bottomPadding: number): Record<WatermarkPosition, string> {
  return {
    'top-left': `top:${padding}px;left:${padding}px;`,
    'top-right': `top:${padding}px;right:${padding}px;`,
    'bottom-left': `bottom:${bottomPadding}px;left:${padding}px;`,
    'bottom-right': `bottom:${bottomPadding}px;right:${padding}px;`,
    'center': 'top:50%;left:50%;transform:translate(-50%,-50%);',
  };
}

/**
 * Create a Watermark Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns Watermark Plugin instance
 *
 * @example
 * ```ts
 * import { createWatermarkPlugin } from '@scarlett-player/watermark';
 *
 * const player = new ScarlettPlayer({
 *   container: '#player',
 *   plugins: [
 *     createWatermarkPlugin({
 *       text: 'user@example.com',
 *       position: 'bottom-right',
 *       opacity: 0.4,
 *       dynamic: true,
 *       dynamicInterval: 15000,
 *       showDelay: 20000,
 *     }),
 *   ],
 * });
 * ```
 */
export function createWatermarkPlugin(config: WatermarkConfig = {}): IWatermarkPlugin {
  let api: IPluginAPI | null = null;
  let element: HTMLDivElement | null = null;
  let dynamicTimer: ReturnType<typeof setInterval> | null = null;
  let showDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let currentPosition: WatermarkPosition = config.position || 'bottom-right';

  const opacity = config.opacity ?? 0.5;
  const fontSize = config.fontSize ?? 14;
  let currentImageHeight = config.imageHeight ?? 40;
  let currentPadding = config.padding ?? 10;
  let currentBottomPadding = config.padding ?? 40; // Higher default for bottom to clear player controls
  const dynamic = config.dynamic ?? false;
  const dynamicInterval = config.dynamicInterval ?? 10000;
  const showDelay = config.showDelay ?? 0;

  let positionStyles = getPositionStyles(currentPadding, currentBottomPadding);

  /**
   * Create the watermark DOM element.
   */
  const createElement = (): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'sp-watermark sp-watermark--hidden';
    el.style.cssText = `position:absolute;z-index:10;pointer-events:none;opacity:${opacity};font-size:${fontSize}px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.6);font-family:sans-serif;transition:all 0.5s ease;${positionStyles[currentPosition]}`;
    el.setAttribute('data-position', currentPosition);

    updateContent(el);
    return el;
  };

  /**
   * Update the watermark content (text or image).
   */
  const updateContent = (el: HTMLDivElement, imageUrl?: string, text?: string): void => {
    const img = imageUrl || config.imageUrl;
    const txt = text || config.text;

    el.innerHTML = '';
    if (img) {
      const imgEl = document.createElement('img');
      imgEl.src = img;
      imgEl.style.cssText = `max-height:${currentImageHeight}px;opacity:inherit;display:block;`;
      imgEl.alt = '';
      el.appendChild(imgEl);
    } else if (txt) {
      el.textContent = txt;
    }
  };

  /**
   * Move the watermark to a new position.
   */
  const setPosition = (position: WatermarkPosition): void => {
    if (!element) return;
    currentPosition = position;

    // Reset all position styles
    element.style.top = '';
    element.style.right = '';
    element.style.bottom = '';
    element.style.left = '';
    element.style.transform = '';

    // Apply new position
    const styles = positionStyles[position];
    styles.split(';').filter(Boolean).forEach(rule => {
      const colonIdx = rule.indexOf(':');
      if (colonIdx === -1) return;
      const prop = rule.slice(0, colonIdx).trim();
      const val = rule.slice(colonIdx + 1).trim();
      if (prop && val) {
        element!.style.setProperty(prop, val);
      }
    });
    element.setAttribute('data-position', position);
    const isVisible = element.classList.contains('sp-watermark--visible');
    const visClass = isVisible ? ' sp-watermark--visible' : ' sp-watermark--hidden';
    element.className = `sp-watermark sp-watermark--${position}${visClass}${dynamic ? ' sp-watermark--dynamic' : ''}`;
  };

  /**
   * Move to a random position (different from current).
   */
  const randomizePosition = (): void => {
    const available = POSITIONS.filter(p => p !== currentPosition);
    const next = available[Math.floor(Math.random() * available.length)];
    setPosition(next);
  };

  /**
   * Show the watermark.
   */
  const show = (): void => {
    if (!element) return;
    element.classList.remove('sp-watermark--hidden');
    element.classList.add('sp-watermark--visible');
  };

  /**
   * Hide the watermark.
   */
  const hide = (): void => {
    if (!element) return;
    element.classList.remove('sp-watermark--visible');
    element.classList.add('sp-watermark--hidden');
  };

  /**
   * Start dynamic repositioning timer.
   */
  const startDynamic = (): void => {
    if (!dynamic || dynamicTimer) return;
    dynamicTimer = setInterval(randomizePosition, dynamicInterval);
  };

  /**
   * Stop dynamic repositioning timer.
   */
  const stopDynamic = (): void => {
    if (dynamicTimer) {
      clearInterval(dynamicTimer);
      dynamicTimer = null;
    }
  };

  /**
   * Cleanup all timers and DOM.
   */
  const cleanup = (): void => {
    stopDynamic();
    if (showDelayTimer) {
      clearTimeout(showDelayTimer);
      showDelayTimer = null;
    }
    if (element?.parentNode) {
      element.parentNode.removeChild(element);
    }
    element = null;
  };

  return {
    id: 'watermark',
    name: 'Watermark',
    version: '1.0.0',
    type: 'feature' as PluginType,
    description: 'Anti-piracy watermark overlay with text/image support and dynamic repositioning',

    init(pluginApi: IPluginAPI): void {
      api = pluginApi;
      api.logger.debug('Watermark plugin initialized');

      // Create and attach element
      element = createElement();
      api.container.appendChild(element);

      // Show on play (with optional delay)
      const unsubPlay = api.on('playback:play', () => {
        if (showDelay > 0) {
          showDelayTimer = setTimeout(() => {
            show();
            startDynamic();
          }, showDelay);
        } else {
          show();
          startDynamic();
        }
      });

      // Hide on pause/ended
      const unsubPause = api.on('playback:pause', () => {
        hide();
        stopDynamic();
        if (showDelayTimer) {
          clearTimeout(showDelayTimer);
          showDelayTimer = null;
        }
      });

      const unsubEnded = api.on('playback:ended', () => {
        hide();
        stopDynamic();
      });

      // Update watermark per-track from playlist metadata
      const unsubChange = api.on('playlist:change', ({ track }) => {
        if (!element || !track) return;
        const metadata = (track as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
        if (metadata) {
          const watermarkUrl = metadata.watermarkUrl as string | undefined;
          const watermarkText = metadata.watermarkText as string | undefined;
          if (watermarkUrl || watermarkText) {
            updateContent(element, watermarkUrl, watermarkText);
          }
        }
      });

      // Register cleanup
      api.onDestroy(() => {
        unsubPlay();
        unsubPause();
        unsubEnded();
        unsubChange();
        cleanup();
      });
    },

    destroy(): void {
      api?.logger.debug('Watermark plugin destroyed');
      cleanup();
      api = null;
    },

    setText(text: string): void {
      if (element) updateContent(element, undefined, text);
    },

    setImage(imageUrl: string): void {
      if (element) updateContent(element, imageUrl);
    },

    setPosition: setPosition,

    setOpacity(value: number): void {
      if (element) element.style.opacity = String(Math.max(0, Math.min(1, value)));
    },

    setImageHeight(height: number): void {
      currentImageHeight = Math.max(1, height);
      if (element) {
        const img = element.querySelector('img');
        if (img) img.style.maxHeight = `${currentImageHeight}px`;
      }
    },

    setPadding(value: number): void {
      currentPadding = Math.max(0, value);
      currentBottomPadding = currentPadding;
      positionStyles = getPositionStyles(currentPadding, currentBottomPadding);
      // Re-apply current position with new padding
      setPosition(currentPosition);
    },

    show,

    hide,

    getConfig(): WatermarkConfig {
      return { ...config, position: currentPosition, opacity: element ? parseFloat(element.style.opacity) || opacity : opacity, imageHeight: currentImageHeight, padding: currentPadding };
    },
  };
}

export default createWatermarkPlugin;
