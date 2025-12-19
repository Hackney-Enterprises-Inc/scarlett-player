/**
 * Full Embed - All plugins included
 *
 * Includes: core, HLS, UI, analytics, playlist, media-session, airplay, chromecast
 */

import { ScarlettPlayer, createPlayer, type Plugin } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import type { EmbedConfig, EmbedPlayerOptions } from './types';
import { parseDataAttributes, applyContainerStyles } from './parser';

/**
 * Create a full-featured player instance
 */
export async function createEmbedPlayer(
  container: HTMLElement,
  config: Partial<EmbedConfig> & {
    analytics?: {
      beaconUrl?: string;
      apiKey?: string;
      videoId?: string;
    };
    playlist?: Array<{ src: string; title?: string; poster?: string }>;
  }
): Promise<ScarlettPlayer | null> {
  if (!config.src && !config.playlist?.length) {
    console.error('[Scarlett Player] No source URL or playlist provided');
    return null;
  }

  try {
    applyContainerStyles(container, config);

    // Build theme config
    const theme: Record<string, string> = {};
    if (config.brandColor) theme.accentColor = config.brandColor;
    if (config.primaryColor) theme.primaryColor = config.primaryColor;
    if (config.backgroundColor) theme.backgroundColor = config.backgroundColor;

    // Build UI plugin config
    const uiConfig: Record<string, unknown> = {};
    if (Object.keys(theme).length > 0) uiConfig.theme = theme;
    if (config.hideDelay !== undefined) uiConfig.hideDelay = config.hideDelay;

    // Build plugins array
    const plugins: Plugin[] = [
      createHLSPlugin(),
      createMediaSessionPlugin(),
    ];

    // Add playlist plugin if playlist provided
    if (config.playlist?.length) {
      plugins.push(createPlaylistPlugin({
        items: config.playlist.map((item, index) => ({
          id: `item-${index}`,
          src: item.src,
          title: item.title,
          poster: item.poster,
        })),
      }));
    }

    // Add analytics if beaconUrl provided
    if (config.analytics?.beaconUrl) {
      plugins.push(createAnalyticsPlugin({
        beaconUrl: config.analytics.beaconUrl,
        apiKey: config.analytics.apiKey,
        videoId: config.analytics.videoId || config.src || 'unknown',
      }));
    }

    // Add UI plugin if controls enabled
    if (config.controls !== false) {
      plugins.push(uiPlugin(uiConfig));
    }

    // Create player
    const player = await createPlayer({
      container,
      src: config.src || config.playlist?.[0]?.src || '',
      autoplay: config.autoplay || false,
      muted: config.muted || false,
      poster: config.poster || config.playlist?.[0]?.poster,
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
    console.error('[Scarlett Player] Failed to create player:', error);
    return null;
  }
}

/**
 * Initialize a player from a DOM element with data attributes
 */
export async function initElement(element: HTMLElement): Promise<ScarlettPlayer | null> {
  if (element.hasAttribute('data-scarlett-initialized')) {
    return null;
  }

  const config = parseDataAttributes(element);

  // Parse additional data attributes for full bundle
  const analyticsBeaconUrl = element.dataset.analyticsBeaconUrl;
  const analyticsApiKey = element.dataset.analyticsApiKey;
  const analyticsVideoId = element.dataset.analyticsVideoId;

  const extendedConfig: any = { ...config };

  if (analyticsBeaconUrl) {
    extendedConfig.analytics = {
      beaconUrl: analyticsBeaconUrl,
      apiKey: analyticsApiKey,
      videoId: analyticsVideoId,
    };
  }

  element.setAttribute('data-scarlett-initialized', 'true');

  const player = await createEmbedPlayer(element, extendedConfig);

  if (!player) {
    element.removeAttribute('data-scarlett-initialized');
  }

  return player;
}

const PLAYER_SELECTORS = [
  '[data-scarlett-player]',
  '[data-sp]',
  '[data-video-player]',
  '.scarlett-player',
];

/**
 * Initialize all players on the page
 */
export async function initAll(): Promise<void> {
  const selector = PLAYER_SELECTORS.join(', ');
  const elements = document.querySelectorAll<HTMLElement>(selector);

  const promises = Array.from(elements).map((element) => initElement(element));
  await Promise.all(promises);

  if (elements.length > 0) {
    console.log(`[Scarlett Player] Initialized ${elements.length} player(s) (full build)`);
  }
}

/**
 * Programmatic API for creating players
 */
export async function create(options: EmbedPlayerOptions & {
  analytics?: { beaconUrl?: string; apiKey?: string; videoId?: string };
  playlist?: Array<{ src: string; title?: string; poster?: string }>;
}): Promise<ScarlettPlayer | null> {
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

  return createEmbedPlayer(container, options);
}
