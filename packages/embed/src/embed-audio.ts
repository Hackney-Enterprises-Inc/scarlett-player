/**
 * Audio Embed - Optimized for audio streaming
 *
 * Includes: core, HLS, audio-ui, media-session, playlist
 * Perfect for podcasts, music, live audio streams
 */

import { ScarlettPlayer, createPlayer, type Plugin } from '@scarlett-player/core';
import { createHLSPlugin } from '@scarlett-player/hls';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import { createPlaylistPlugin } from '@scarlett-player/playlist';

export interface AudioEmbedConfig {
  src?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  // Audio UI options
  compact?: boolean;
  // Theming
  brandColor?: string;
  primaryColor?: string;
  backgroundColor?: string;
  // Playlist
  playlist?: Array<{
    src: string;
    title?: string;
    artist?: string;
    artwork?: string;
    duration?: number;
  }>;
  // Media session
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

/**
 * Parse audio-specific data attributes
 */
export function parseAudioDataAttributes(element: HTMLElement): AudioEmbedConfig {
  const dataset = element.dataset;

  const config: AudioEmbedConfig = {
    src: dataset.src,
    autoplay: dataset.autoplay !== undefined && dataset.autoplay !== 'false',
    muted: dataset.muted !== undefined && dataset.muted !== 'false',
    loop: dataset.loop !== undefined && dataset.loop !== 'false',
    compact: dataset.compact !== undefined && dataset.compact !== 'false',
    brandColor: dataset.brandColor,
    primaryColor: dataset.primaryColor,
    backgroundColor: dataset.backgroundColor,
    title: dataset.title,
    artist: dataset.artist,
    album: dataset.album,
    artwork: dataset.artwork || dataset.poster,
  };

  // Parse playlist from JSON if provided
  if (dataset.playlist) {
    try {
      config.playlist = JSON.parse(dataset.playlist);
    } catch (e) {
      console.warn('[Scarlett Audio] Invalid playlist JSON');
    }
  }

  return config;
}

/**
 * Create an audio player instance
 */
export async function createAudioPlayer(
  container: HTMLElement,
  config: AudioEmbedConfig
): Promise<ScarlettPlayer | null> {
  if (!config.src && !config.playlist?.length) {
    console.error('[Scarlett Audio] No source URL or playlist provided');
    return null;
  }

  try {
    // Apply container styles for audio
    container.style.position = container.style.position || 'relative';
    if (config.compact) {
      container.style.height = container.style.height || '64px';
    } else {
      container.style.height = container.style.height || '120px';
    }
    container.style.width = container.style.width || '100%';

    // Build plugins array
    const plugins: Plugin[] = [
      createHLSPlugin(),
      createMediaSessionPlugin({
        title: config.title || config.playlist?.[0]?.title,
        artist: config.artist || config.playlist?.[0]?.artist,
        album: config.album,
        artwork: config.artwork || config.playlist?.[0]?.artwork,
      }),
    ];

    // Add playlist plugin if playlist provided
    if (config.playlist?.length) {
      plugins.push(createPlaylistPlugin({
        items: config.playlist.map((item, index) => ({
          id: `track-${index}`,
          src: item.src,
          title: item.title,
          artist: item.artist,
          poster: item.artwork,
          duration: item.duration,
        })),
      }));
    }

    // Add audio UI plugin
    plugins.push(createAudioUIPlugin({
      layout: config.compact ? 'compact' : 'full',
      theme: {
        primary: config.brandColor,
        text: config.primaryColor,
        background: config.backgroundColor,
      },
    }));

    // Create player
    const player = await createPlayer({
      container,
      src: config.src || config.playlist?.[0]?.src || '',
      autoplay: config.autoplay || false,
      muted: config.muted || false,
      loop: config.loop || false,
      plugins,
    });

    return player;
  } catch (error) {
    console.error('[Scarlett Audio] Failed to create player:', error);
    return null;
  }
}

/**
 * Initialize an audio player from a DOM element
 */
export async function initElement(element: HTMLElement): Promise<ScarlettPlayer | null> {
  if (element.hasAttribute('data-scarlett-initialized')) {
    return null;
  }

  const config = parseAudioDataAttributes(element);
  element.setAttribute('data-scarlett-initialized', 'true');

  const player = await createAudioPlayer(element, config);

  if (!player) {
    element.removeAttribute('data-scarlett-initialized');
  }

  return player;
}

const AUDIO_SELECTORS = [
  '[data-scarlett-audio]',
  '[data-audio-player]',
  '.scarlett-audio',
];

/**
 * Initialize all audio players on the page
 */
export async function initAll(): Promise<void> {
  const selector = AUDIO_SELECTORS.join(', ');
  const elements = document.querySelectorAll<HTMLElement>(selector);

  const promises = Array.from(elements).map((element) => initElement(element));
  await Promise.all(promises);

  if (elements.length > 0) {
    console.log(`[Scarlett Audio] Initialized ${elements.length} player(s)`);
  }
}

/**
 * Programmatic API for creating audio players
 */
export async function create(options: {
  container: string | HTMLElement;
} & AudioEmbedConfig): Promise<ScarlettPlayer | null> {
  let container: HTMLElement | null = null;

  if (typeof options.container === 'string') {
    container = document.querySelector<HTMLElement>(options.container);
    if (!container) {
      console.error(`[Scarlett Audio] Container not found: ${options.container}`);
      return null;
    }
  } else {
    container = options.container;
  }

  return createAudioPlayer(container, options);
}
