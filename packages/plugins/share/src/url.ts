/**
 * Share URL resolution.
 *
 * Kept separate from the plugin so the one security-relevant rule in this
 * package is easy to find and easy to test: the URL comes from the host or from
 * `window.location`, and never from the media `src`.
 */

import type { SharePluginConfig } from './types';

/** Resolve a value that may be a literal or a getter. */
function resolve(value: string | (() => string) | undefined, fallback: () => string): string {
  if (typeof value === 'function') {
    return value();
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return fallback();
}

/**
 * The page URL to share.
 *
 * Defaults to `window.location.href`. There is deliberately no `src` fallback:
 * playback URLs are often signed, so sharing one would leak a credential and
 * hand the recipient a link that expires.
 */
export function resolveBaseUrl(config: SharePluginConfig): string {
  return resolve(config.url, () =>
    typeof window === 'undefined' ? '' : window.location.href,
  );
}

/** The title to pass to the native share sheet. */
export function resolveTitle(config: SharePluginConfig): string {
  return resolve(config.title, () => (typeof document === 'undefined' ? '' : document.title));
}

/**
 * Apply the playback position to a URL as a query parameter.
 *
 * Uses the URL API rather than string concatenation so an existing query string
 * or fragment survives intact, and a repeated share replaces the previous
 * timestamp instead of appending a second one.
 *
 * Live streams are skipped: an offset into a sliding DVR window means nothing
 * to whoever opens the link.
 */
export function applyTimestamp(
  baseUrl: string,
  currentTime: number,
  isLive: boolean,
  config: SharePluginConfig,
): string {
  const enabled = config.withTimestamp !== false;

  if (!enabled || isLive || !Number.isFinite(currentTime) || currentTime <= 0) {
    return baseUrl;
  }

  const param = config.timestampParam ?? 't';
  const rounded = config.roundTimestamp === false ? currentTime : Math.floor(currentTime);

  if (rounded <= 0) {
    return baseUrl;
  }

  try {
    // Second argument covers relative URLs, which a host may legitimately pass.
    const base = typeof window === 'undefined' ? undefined : window.location.href;
    const url = new URL(baseUrl, base);
    url.searchParams.set(param, String(rounded));
    return url.toString();
  } catch {
    // An unparseable URL is the host's to fix; sharing it unchanged is better
    // than throwing inside a click handler.
    return baseUrl;
  }
}
