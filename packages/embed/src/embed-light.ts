import { ScarlettPlayer, createPlayer, type Plugin } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls/light';
import { uiPlugin } from '@scarlett-player/ui';
import type { EmbedConfig, EmbedPlayerOptions } from './types';
import { parseDataAttributes, applyContainerStyles } from './parser';

/**
 * Create a player instance from configuration (Light build)
 * Uses hls.js/light for smaller bundle size (~35% smaller)
 */
export async function createEmbedPlayer(
  container: HTMLElement,
  config: Partial<EmbedConfig>
): Promise<ScarlettPlayer | null> {
  if (!config.src) {
    console.error('[Scarlett Player] No source URL provided');
    return null;
  }

  try {
    // Apply container styles
    applyContainerStyles(container, config);

    // Build theme config
    const theme: Record<string, string> = {};
    if (config.brandColor) {
      theme.accentColor = config.brandColor;
    }
    if (config.primaryColor) {
      theme.primaryColor = config.primaryColor;
    }
    if (config.backgroundColor) {
      theme.backgroundColor = config.backgroundColor;
    }

    // Build UI plugin config
    const uiConfig: Record<string, unknown> = {};
    if (Object.keys(theme).length > 0) {
      uiConfig.theme = theme;
    }
    if (config.hideDelay !== undefined) {
      uiConfig.hideDelay = config.hideDelay;
    }

    // Build plugins array
    const plugins: Plugin[] = [createHLSPlugin()];

    // Only add UI plugin if controls are enabled (default: true)
    if (config.controls !== false) {
      plugins.push(uiPlugin(uiConfig));
    }

    // Create player
    const player = await createPlayer({
      container,
      src: config.src,
      autoplay: config.autoplay || false,
      muted: config.muted || false,
      poster: config.poster,
      loop: config.loop || false,
      plugins,
    });

    // Apply post-initialization settings
    const video = container.querySelector('video');
    if (video) {
      if (config.playbackRate) {
        video.playbackRate = config.playbackRate;
      }
      if (config.startTime) {
        video.currentTime = config.startTime;
      }
    }

    return player;
  } catch (error) {
    console.error('[Scarlett Player] Failed to create player:', error);
    return null;
  }
}

/**
 * Initialize a player from a DOM element with data attributes
 */
export async function initElement(element: HTMLElement): Promise<ScarlettPlayer | null> {
  // Check if already initialized
  if (element.hasAttribute('data-scarlett-initialized')) {
    return null;
  }

  // Parse data attributes
  const config = parseDataAttributes(element);

  // Mark as initializing to prevent double-init
  element.setAttribute('data-scarlett-initialized', 'true');

  // Create player
  const player = await createEmbedPlayer(element, config);

  if (!player) {
    // Remove marker if initialization failed
    element.removeAttribute('data-scarlett-initialized');
  }

  return player;
}

/**
 * Selectors for auto-initialization (in order of preference)
 * Supports multiple patterns for simpler drop-in usage
 */
const PLAYER_SELECTORS = [
  '[data-scarlett-player]',  // Full name: <div data-scarlett-player>
  '[data-sp]',               // Short: <div data-sp>
  '[data-video-player]',     // Generic: <div data-video-player>
  '.scarlett-player',        // Class-based: <div class="scarlett-player">
];

/**
 * Initialize all players on the page
 * Supports multiple selector patterns for flexibility
 */
export async function initAll(): Promise<void> {
  const selector = PLAYER_SELECTORS.join(', ');
  const elements = document.querySelectorAll<HTMLElement>(selector);

  const promises = Array.from(elements).map((element) => initElement(element));
  await Promise.all(promises);

  if (elements.length > 0) {
    console.log(`[Scarlett Player] Initialized ${elements.length} player(s) (light build)`);
  }
}

/**
 * Programmatic API for creating players
 */
export async function create(options: EmbedPlayerOptions): Promise<ScarlettPlayer | null> {
  // Resolve container
  let container: HTMLElement | null = null;

  if (typeof options.container === 'string') {
    container = document.querySelector<HTMLElement>(options.container);
    if (!container) {
      console.error(`[Scarlett Player] Container not found: ${options.container}`);
      return null;
    }
  } else {
    container = options.container;
  }

  // Build config from options
  const config: Partial<EmbedConfig> = { ...options };

  // Create player
  return createEmbedPlayer(container, config);
}
