/**
 * Dedupe marker for the release notification. An HTML comment is invisible on
 * the rendered GitHub release page but survives in the release body.
 */
export const MARKER = '<!-- slack-notified -->';

/**
 * Whether a release body already carries the notified marker.
 * @param {string | null | undefined} body GitHub release body.
 * @returns {boolean}
 */
export function hasMarker(body) {
  return typeof body === 'string' && body.includes(MARKER);
}

/**
 * Append the notified marker to a release body (idempotent).
 * @param {string | null | undefined} body GitHub release body.
 * @returns {string} The body with the marker on its own final line.
 */
export function withMarker(body) {
  const text = body ?? '';
  if (hasMarker(text)) return text;
  return `${text.replace(/\s+$/, '')}\n\n${MARKER}\n`;
}
