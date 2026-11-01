/**
 * Shared URL sanitizer for error telemetry.
 *
 * Strips query strings and hash fragments from URLs before they reach log
 * payloads or error context, and redacts path segments that look like auth
 * tokens. Signed-URL tokens, HMAC signatures, and session ids live in query
 * strings (and, for some CDNs, in a path segment) and must not leak into
 * telemetry.
 *
 * Re-exported from `@scarlett-player/core` so every package shares the same
 * implementation without duplicating the logic.
 */

/** Marker that replaces a path segment recognised as a token. */
const REDACTED_SEGMENT = ':redacted';

/** A pure hex run of at least 32 characters (128-bit digest or longer). */
const LONG_HEX = /^[0-9a-fA-F]{32,}$/;

/** A part that can plausibly carry signature material. */
const TOKEN_PART_CHARS = /^[A-Za-z0-9-]+$/;

/**
 * Percent-decode a path segment for matching only (a token may arrive with its
 * `_` delimiters as `%5F`). The caller keeps the original segment when it does
 * not match; an invalid escape leaves the segment as it was.
 *
 * @param segment - One path segment, without slashes
 * @returns The decoded segment, or the input when it cannot be decoded
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Decide whether one path segment looks like a credential.
 *
 * Deliberately conservative; only two shapes qualify:
 * 1. The whole segment is a hex run of 32+ characters (MD5/SHA digests, HMACs).
 * 2. The segment is underscore-joined with 3+ parts (the
 *    `<expiry>_<nonce>_<sig>` scheme), every part is `[A-Za-z0-9-]`, and at
 *    least one part is signature-like: 16+ hex characters, or 20+ characters
 *    mixing letters and digits.
 *
 * Plain words, resolutions (`1080p`), dates, short numeric ids, dashed UUIDs,
 * snake_case names and file names are not matched.
 *
 * @param segment - One path segment, without slashes
 * @returns True when the segment should be redacted
 */
function looksLikeToken(segment: string): boolean {
  if (LONG_HEX.test(segment)) return true;

  const parts = segment.split('_');
  if (parts.length < 3 || !parts.every((p) => TOKEN_PART_CHARS.test(p))) return false;

  return parts.some(
    (p) =>
      /^[0-9a-fA-F]{16,}$/.test(p) || (p.length >= 20 && /[A-Za-z]/.test(p) && /[0-9]/.test(p))
  );
}

/**
 * Reduce a URL to origin + pathname, dropping the query string and fragment,
 * and replacing token-looking path segments with `:redacted` (see
 * {@link looksLikeToken} for the heuristic: long hex, or underscore-joined
 * `<expiry>_<nonce>_<sig>` segments).
 *
 * @param url - Raw URL, if any
 * @returns Sanitized `origin + pathname` with token segments redacted, or undefined when there is
 *          nothing usable to report (absent, null, or unparseable URL)
 *
 * @example
 * ```ts
 * sanitizeUrl('https://cdn.example.com/live/x.m3u8?token=secret#frag');
 * // 'https://cdn.example.com/live/x.m3u8'
 *
 * sanitizeUrl('https://cdn.example.com/1735689600_ab12cd34ef56ab78_<sig>/hls/x.m3u8');
 * // 'https://cdn.example.com/:redacted/hls/x.m3u8'
 * ```
 */
export function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    const path = parsed.pathname
      .split('/')
      .map((segment) => (looksLikeToken(decodeSegment(segment)) ? REDACTED_SEGMENT : segment))
      .join('/');
    return `${parsed.origin}${path}`;
  } catch {
    return undefined;
  }
}
