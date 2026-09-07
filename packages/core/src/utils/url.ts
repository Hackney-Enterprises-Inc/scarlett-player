/**
 * Shared URL sanitizer for error telemetry.
 *
 * Strips query strings and hash fragments from URLs before they reach log
 * payloads or error context. Signed-URL tokens, HMAC signatures, and session
 * ids all live in query strings and must not leak into telemetry.
 *
 * Re-exported from `@scarlett-player/core` so every package shares the same
 * implementation without duplicating the logic.
 */

/**
 * Reduce a URL to origin + pathname, dropping the query string and fragment.
 *
 * @param url - Raw URL, if any
 * @returns Sanitized `origin + pathname`, or undefined when there is
 *          nothing usable to report (absent, null, or unparseable URL)
 *
 * @example
 * ```ts
 * sanitizeUrl('https://cdn.example.com/live/x.m3u8?token=secret#frag');
 * // 'https://cdn.example.com/live/x.m3u8'
 * ```
 */
export function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}
