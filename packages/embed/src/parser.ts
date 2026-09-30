import type { EmbedClipsConfig, EmbedConfig, PlayerType } from './types';

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

  // Left unset when the attribute is absent, so createEmbedPlayer() can tell
  // "not asked for" from "asked for false" and leave the ui plugin's own
  // default (true) in charge. Like the other booleans here, only the exact
  // string "false" turns it off; "0" or "no" read as true.
  const bigPlayButton = getAttr(element, 'data-big-play-button', 'big-play-button');
  if (bigPlayButton !== null) {
    config.bigPlayButton = bigPlayButton !== 'false';
  }

  // Same shape as data-big-play-button: absent means "not asked for", and only
  // the exact string "false" turns it off.
  const gestures = getAttr(element, 'data-gestures', 'gestures');
  if (gestures !== null) {
    config.gestures = gestures !== 'false';
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

  // Sharing. Setting a share URL is what adds the share button: absent means
  // the control bar keeps the layout it has always had. The value is the page
  // the viewer should be sent to, never the media src.
  const shareUrl = getAttr(element, 'data-share-url', 'share-url');
  if (shareUrl) {
    config.shareUrl = shareUrl;
  }

  // Only does anything alongside data-share-url: it enables the `embed` target
  // inside the share sheet.
  const embedBaseUrl = getAttr(element, 'data-embed-base-url', 'embed-base-url');
  if (embedBaseUrl) {
    config.embedBaseUrl = embedBaseUrl;
  }

  // Theme colors
  const brandColor = getAttr(element, 'data-brand-color', 'data-color', 'color');
  if (brandColor) {
    config.brandColor = brandColor;
  }

  const brandTextColor = getAttr(element, 'data-brand-text-color', 'brand-text-color');
  if (brandTextColor) {
    config.brandTextColor = brandTextColor;
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
    // Only the exact string "false" disables a present boolean, as with the
    // other embed flags. Absent keys stay absent to preserve plugin defaults.
    const analyticsFlags = [
      ['data-analytics-anonymous', 'anonymous'],
      ['data-analytics-respect-dnt', 'respectDoNotTrack'],
      ['data-analytics-batch', 'batch'],
    ] as const;
    for (const [attribute, option] of analyticsFlags) {
      const value = element.getAttribute(attribute);
      if (value !== null) config.analytics[option] = value !== 'false';
    }
  }

  // Captions (JSON array of sources). Installed by the captions plugin in the
  // full and video builds; the audio builds warn in createEmbedPlayer().
  const captions = element.getAttribute('data-captions');
  if (captions) {
    const sources = parseJsonArray(captions, 'data-captions');
    if (sources) {
      config.captions = { sources };
    }
  }

  // Chapters: a JSON array when the value starts with `[`, otherwise a WebVTT
  // chapters URL. Needs the chapters addon; createEmbedPlayer() warns without it.
  const chapters = element.getAttribute('data-chapters')?.trim();
  if (chapters) {
    if (chapters.startsWith('[')) {
      const list = parseJsonArray(chapters, 'data-chapters');
      if (list) {
        config.chapters = { chapters: list };
      }
    } else {
      config.chapters = { src: chapters };
    }
  }

  // Clips. Parsed whenever an endpoint is set; createEmbedPlayer() keeps it
  // inert unless the host also opted in with data-clips-csrf="meta", so a
  // programmatic create() without the opt-in gets the same rule.
  const clipsEndpoint = element.getAttribute('data-clips-endpoint');
  if (clipsEndpoint) {
    const clips: EmbedClipsConfig = { endpoint: clipsEndpoint };

    const csrf = element.getAttribute('data-clips-csrf');
    if (csrf === 'meta') {
      clips.csrf = 'meta';
    } else if (csrf !== null) {
      console.warn(`[ScarlettPlayer] Invalid data-clips-csrf "${csrf}": the only accepted value is "meta"`);
    }

    // data-analytics-video-id is read here as the fallback because it only
    // reaches config.analytics when a beacon URL is set too; a page that names
    // its video without enabling analytics must still clip under that id.
    // createEmbedPlayer() adds the fallback to config.analytics.videoId (the
    // programmatic path) and then to the source.
    const mediaId =
      element.getAttribute('data-clips-media-id') ||
      element.getAttribute('data-analytics-video-id');
    if (mediaId) {
      clips.mediaId = mediaId;
    }

    const maxDuration = parseNumber(element.getAttribute('data-clips-max-duration'));
    if (maxDuration !== undefined) {
      clips.maxDuration = maxDuration;
    }

    const minDuration = parseNumber(element.getAttribute('data-clips-min-duration'));
    if (minDuration !== undefined) {
      clips.minDuration = minDuration;
    }

    config.clips = clips;
  }

  return config;
}

/**
 * Parse an attribute holding a JSON array.
 *
 * Invalid JSON, or JSON that is not an array, warns and yields `undefined`
 * so the caller leaves the config key out (the `data-playlist` precedent).
 *
 * @param value - The attribute value
 * @param attribute - The attribute name, for the warning
 * @returns The parsed array, or `undefined` when it is not one
 */
function parseJsonArray(value: string, attribute: string): any[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to the warning
  }
  console.warn(`[ScarlettPlayer] Invalid ${attribute} JSON: expected an array`);
  return undefined;
}

/**
 * Parse a numeric attribute.
 *
 * @param value - The attribute value, or `null` when absent
 * @returns The number, or `undefined` when absent or not a number
 */
function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Aspect ratio used when a video embed declares neither height nor ratio.
 */
export const DEFAULT_ASPECT_RATIO = '16:9';

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

  // Apply custom class. Split on runs of whitespace and drop the empties:
  // `split(' ')` on "a  b" yields an empty token, and `classList.add('')`
  // throws a SyntaxError that takes the whole embed down.
  if (config.className) {
    const classNames = config.className.split(/\s+/).filter(Boolean);
    if (classNames.length > 0) {
      container.classList.add(...classNames);
    }
  }

  // Apply width
  if (config.width) {
    container.style.width = config.width;
  }

  if (type === 'video') {
    // Video: use aspect ratio padding technique.
    //
    // An explicit height wins; otherwise the padding technique always runs,
    // falling back to 16:9. Without the fallback a host that gave neither
    // dimension got a container of zero height and an invisible player.
    if (config.height) {
      container.style.height = config.height;
    } else {
      container.style.position = 'relative';
      container.style.paddingBottom = `${aspectRatioToPercent(
        config.aspectRatio || DEFAULT_ASPECT_RATIO
      )}%`;
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
