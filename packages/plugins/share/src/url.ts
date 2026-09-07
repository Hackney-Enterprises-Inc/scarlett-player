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
 * Query parameters removed from a default share URL.
 *
 * Signed-playback and session credentials, matched case-insensitively. This is
 * deliberately a denylist, not a whole-query strip: page identity often lives
 * in the query (`/watch?v=abc123`), and dropping it would share the wrong page.
 * A host whose credentials use other names should pass `config.url` explicitly.
 */
const CREDENTIAL_PARAMS = new Set([
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'auth',
  'authorization',
  'jwt',
  'sig',
  'signature',
  'hmac',
  'key',
  'apikey',
  'api_key',
  'session',
  'sessionid',
  'expires',
  'policy',
  // CloudFront signed URLs. `signature`, `expires` and `policy` above cover
  // the rest of the canned-policy set.
  'key-pair-id',
  // AWS SigV4 presigned URLs, which a page served straight out of S3 carries.
  // The whole set goes, not just the signature: the remainder is unusable
  // without it and only makes the shared link unreadable.
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-security-token',
  'x-amz-expires',
  'x-amz-algorithm',
  'x-amz-date',
  'x-amz-signedheaders',
]);

/**
 * Strip credential query parameters and the fragment from a page URL.
 *
 * @param href - The page URL to clean
 * @returns The URL without credential params or fragment; `href` unchanged
 *          when it cannot be parsed
 *
 * @example
 * ```ts
 * stripCredentials('https://site.com/watch?v=abc123&token=xyz#t=1');
 * // 'https://site.com/watch?v=abc123'
 * ```
 */
export function stripCredentials(href: string): string {
  try {
    const parsed = new URL(href);

    // Snapshot the keys: deleting while iterating the live iterator skips entries.
    for (const name of [...parsed.searchParams.keys()]) {
      if (CREDENTIAL_PARAMS.has(name.toLowerCase())) {
        parsed.searchParams.delete(name);
      }
    }

    // Implicit-flow tokens land in the fragment, and a fragment is never
    // meaningful to a share recipient.
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return href;
  }
}

/**
 * The page URL to share.
 *
 * Defaults to `window.location.href` with credential query parameters and the
 * fragment removed (see {@link stripCredentials}). There is deliberately no
 * `src` fallback: playback URLs are often signed, so sharing one would leak a
 * credential and hand the recipient a link that expires.
 *
 * An explicitly supplied `config.url` is returned verbatim - the host said
 * what to share.
 */
export function resolveBaseUrl(config: SharePluginConfig): string {
  return resolve(config.url, () =>
    typeof window === 'undefined' ? '' : stripCredentials(window.location.href),
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
