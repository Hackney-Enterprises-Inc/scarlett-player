/**
 * URL sanitizer for error telemetry.
 *
 * Segment and playlist URLs are the single most useful field when
 * diagnosing a dead stream, and the single most dangerous one to hand to a
 * consumer's telemetry: signed-URL tokens, HMAC signatures, and session ids
 * all live in the query string. Stripping the whole query (and fragment) is
 * the privacy-safe default for EVERY consumer; anyone who genuinely needs
 * the parameters can subscribe to hls.js directly.
 */

/**
 * Reduce a URL to origin + pathname, dropping the query string and fragment.
 *
 * @param url - Raw URL from a provider error, if any
 * @returns Sanitized `origin + pathname`, or undefined when there is
 *          nothing usable to report (absent or unparseable URL)
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
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // Relative or malformed URLs reach here. Reporting nothing beats
    // reporting a string that may still carry a query, and a telemetry
    // helper must never be the thing that throws inside an error path.
    return undefined;
  }
}
