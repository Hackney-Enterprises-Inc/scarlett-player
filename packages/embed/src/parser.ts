import type { EmbedConfig, PlayerType } from './types';

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
 * Supports multiple attribute naming conventions for flexibility
 */
export function parseDataAttributes(element: HTMLElement): Partial<EmbedConfig> {
  const config: Partial<EmbedConfig> = {};

  // Required: source URL (supports: data-src, src, href)
  const src = getAttr(element, 'data-src', 'src', 'href');
  if (src) {
    config.src = src;
  }

  // Player type (video, audio, audio-mini)
  const type = getAttr(element, 'data-type', 'type') as PlayerType | null;
  if (type && ['video', 'audio', 'audio-mini'].includes(type)) {
    config.type = type;
  }

  // Boolean attributes
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

  // String attributes
  const poster = getAttr(element, 'data-poster', 'poster');
  if (poster) {
    config.poster = poster;
  }

  // Artwork (alias for poster, for audio)
  const artwork = getAttr(element, 'data-artwork', 'artwork');
  if (artwork) {
    config.artwork = artwork;
  }

  // Audio metadata
  const title = getAttr(element, 'data-title', 'title');
  if (title) {
    config.title = title;
  }

  const artist = getAttr(element, 'data-artist', 'artist');
  if (artist) {
    config.artist = artist;
  }

  const album = getAttr(element, 'data-album', 'album');
  if (album) {
    config.album = album;
  }

  // Theme colors
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

  // Dimensions
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

  // Playlist (JSON)
  const playlist = element.getAttribute('data-playlist');
  if (playlist) {
    try {
      config.playlist = JSON.parse(playlist);
    } catch {
      console.warn('[ScarlettPlayer] Invalid playlist JSON');
    }
  }

  // Analytics
  const analyticsBeaconUrl = element.getAttribute('data-analytics-beacon-url');
  if (analyticsBeaconUrl) {
    config.analytics = {
      beaconUrl: analyticsBeaconUrl,
      apiKey: element.getAttribute('data-analytics-api-key') || undefined,
      videoId: element.getAttribute('data-analytics-video-id') || undefined,
    };
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
 * Apply container styles based on config and player type
 */
export function applyContainerStyles(
  container: HTMLElement,
  config: Partial<EmbedConfig>
): void {
  const type = config.type || 'video';

  // Apply custom class
  if (config.className) {
    container.classList.add(...config.className.split(' '));
  }

  // Apply width
  if (config.width) {
    container.style.width = config.width;
  }

  if (type === 'video') {
    // Video: use aspect ratio padding technique
    if (config.height) {
      container.style.height = config.height;
    } else if (config.aspectRatio) {
      container.style.position = 'relative';
      container.style.paddingBottom = `${aspectRatioToPercent(config.aspectRatio)}%`;
      container.style.height = '0';
    }
  } else if (type === 'audio') {
    // Audio full: fixed height
    container.style.position = container.style.position || 'relative';
    container.style.height = config.height || '120px';
    container.style.width = container.style.width || '100%';
  } else if (type === 'audio-mini') {
    // Audio mini: compact height
    container.style.position = container.style.position || 'relative';
    container.style.height = config.height || '64px';
    container.style.width = container.style.width || '100%';
  }
}
