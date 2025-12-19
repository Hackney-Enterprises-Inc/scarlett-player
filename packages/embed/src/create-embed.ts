/**
 * Unified embed creator factory
 *
 * This module creates the embed API with configurable plugin availability.
 * Each build (full, video, audio) uses this with different plugin sets.
 */

import { ScarlettPlayer, createPlayer, type Plugin } from '@scarlett-player/core';
import type { EmbedConfig, EmbedPlayerOptions, PlayerType, ScarlettPlayerGlobal } from './types';
import { parseDataAttributes, applyContainerStyles } from './parser';

/**
 * Plugin creators that builds can provide
 */
export interface PluginCreators {
  hls: () => Plugin;
  videoUI?: (config: any) => Plugin;
  audioUI?: (config: any) => Plugin;
  analytics?: (config: any) => Plugin;
  playlist?: (config: any) => Plugin;
  mediaSession?: (config: any) => Plugin;
}

/**
 * Create an embed player with the given plugins
 */
export async function createEmbedPlayer(
  container: HTMLElement,
  config: Partial<EmbedConfig>,
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<ScarlettPlayer | null> {
  const type = config.type || 'video';

  // Validate type is available in this build
  if (!availableTypes.includes(type)) {
    const buildSuggestion = type === 'video'
      ? 'Use embed.js or embed.video.js'
      : 'Use embed.js or embed.audio.js';
    throw new Error(
      `[ScarlettPlayer] Player type "${type}" is not available in this build. ${buildSuggestion}`
    );
  }

  if (!config.src && !config.playlist?.length) {
    console.error('[ScarlettPlayer] No source URL or playlist provided');
    return null;
  }

  try {
    // Apply container styles based on type
    applyContainerStyles(container, config);

    // Build theme config
    const theme: Record<string, string> = {};
    if (config.brandColor) theme.accentColor = config.brandColor;
    if (config.primaryColor) theme.primaryColor = config.primaryColor;
    if (config.backgroundColor) theme.backgroundColor = config.backgroundColor;

    // Build plugins array
    const plugins: Plugin[] = [pluginCreators.hls()];

    // Add playlist plugin if available and playlist provided
    if (pluginCreators.playlist && config.playlist?.length) {
      plugins.push(pluginCreators.playlist({
        items: config.playlist.map((item, index) => ({
          id: `item-${index}`,
          src: item.src,
          title: item.title,
          artist: item.artist,
          poster: item.poster || item.artwork,
          duration: item.duration,
        })),
      }));
    }

    // Add media session plugin if available (for audio types or if metadata provided)
    if (pluginCreators.mediaSession && (type !== 'video' || config.title)) {
      plugins.push(pluginCreators.mediaSession({
        title: config.title || config.playlist?.[0]?.title,
        artist: config.artist || config.playlist?.[0]?.artist,
        album: config.album,
        artwork: config.artwork || config.poster || config.playlist?.[0]?.artwork,
      }));
    }

    // Add analytics plugin if available and configured
    if (pluginCreators.analytics && config.analytics?.beaconUrl) {
      plugins.push(pluginCreators.analytics({
        beaconUrl: config.analytics.beaconUrl,
        apiKey: config.analytics.apiKey,
        videoId: config.analytics.videoId || config.src || 'unknown',
      }));
    }

    // Add UI plugin based on type
    if (config.controls !== false) {
      if (type === 'video' && pluginCreators.videoUI) {
        const uiConfig: Record<string, unknown> = {};
        if (Object.keys(theme).length > 0) uiConfig.theme = theme;
        if (config.hideDelay !== undefined) uiConfig.hideDelay = config.hideDelay;
        plugins.push(pluginCreators.videoUI(uiConfig));
      } else if ((type === 'audio' || type === 'audio-mini') && pluginCreators.audioUI) {
        plugins.push(pluginCreators.audioUI({
          layout: type === 'audio-mini' ? 'compact' : 'full',
          theme: {
            primary: config.brandColor,
            text: config.primaryColor,
            background: config.backgroundColor,
          },
        }));
      }
    }

    // Create player
    const player = await createPlayer({
      container,
      src: config.src || config.playlist?.[0]?.src || '',
      autoplay: config.autoplay || false,
      muted: config.muted || false,
      poster: config.poster || config.artwork || config.playlist?.[0]?.poster,
      loop: config.loop || false,
      plugins,
    });

    // Apply post-initialization settings
    const video = container.querySelector('video');
    if (video) {
      if (config.playbackRate) video.playbackRate = config.playbackRate;
      if (config.startTime) video.currentTime = config.startTime;
    }

    return player;
  } catch (error) {
    console.error('[ScarlettPlayer] Failed to create player:', error);
    throw error;
  }
}

/**
 * Initialize a player from a DOM element with data attributes
 */
export async function initElement(
  element: HTMLElement,
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<ScarlettPlayer | null> {
  if (element.hasAttribute('data-scarlett-initialized')) {
    return null;
  }

  const config = parseDataAttributes(element);
  element.setAttribute('data-scarlett-initialized', 'true');

  try {
    const player = await createEmbedPlayer(element, config, pluginCreators, availableTypes);
    return player;
  } catch (error) {
    element.removeAttribute('data-scarlett-initialized');
    throw error;
  }
}

/**
 * Player selectors for auto-initialization
 */
const PLAYER_SELECTORS = [
  '[data-scarlett-player]',
  '[data-sp]',
  '.scarlett-player',
];

/**
 * Initialize all players on the page
 */
export async function initAll(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): Promise<void> {
  const selector = PLAYER_SELECTORS.join(', ');
  const elements = document.querySelectorAll<HTMLElement>(selector);

  let initialized = 0;
  let errors = 0;

  for (const element of Array.from(elements)) {
    try {
      const player = await initElement(element, pluginCreators, availableTypes);
      if (player) initialized++;
    } catch (error) {
      errors++;
      console.error('[ScarlettPlayer] Failed to initialize element:', error);
    }
  }

  if (initialized > 0) {
    console.log(`[ScarlettPlayer] Initialized ${initialized} player(s)`);
  }
  if (errors > 0) {
    console.warn(`[ScarlettPlayer] ${errors} player(s) failed to initialize`);
  }
}

/**
 * Create the global ScarlettPlayer API
 */
export function createScarlettPlayerAPI(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[],
  version: string
): ScarlettPlayerGlobal {
  return {
    version,
    availableTypes,

    async create(options: EmbedPlayerOptions): Promise<ScarlettPlayer | null> {
      let container: HTMLElement | null = null;

      if (typeof options.container === 'string') {
        container = document.querySelector<HTMLElement>(options.container);
        if (!container) {
          console.error(`[ScarlettPlayer] Container not found: ${options.container}`);
          return null;
        }
      } else {
        container = options.container;
      }

      return createEmbedPlayer(container, options, pluginCreators, availableTypes);
    },

    async initAll(): Promise<void> {
      return initAll(pluginCreators, availableTypes);
    },
  };
}

/**
 * Setup auto-initialization on DOMContentLoaded
 */
export function setupAutoInit(
  pluginCreators: PluginCreators,
  availableTypes: PlayerType[]
): void {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initAll(pluginCreators, availableTypes);
      });
    } else {
      initAll(pluginCreators, availableTypes);
    }
  }
}
