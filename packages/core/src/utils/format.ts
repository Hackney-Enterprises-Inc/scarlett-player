/**
 * Time formatting shared across packages.
 *
 * Lives in core because `ui` and `audio-ui` both render a clock and had
 * independent copies of this logic, which is exactly the kind of duplication
 * that drifts: one package fixing negative offsets or the hour rollover left
 * the other rendering something different for the same number of seconds.
 * Core is already a peer dependency of both, so sharing adds no coupling.
 */

/**
 * Pad a number to two digits.
 *
 * @param n - Value to pad
 * @returns The value with a leading zero when it is below 10
 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format seconds as a time string (`m:ss`, or `h:mm:ss` past an hour).
 *
 * @param seconds - Position in seconds; may be negative for an offset
 * @returns The formatted time, or `'0:00'` for a non-finite input
 *
 * @example
 * ```ts
 * formatTime(75);    // '1:15'
 * formatTime(3675);  // '1:01:15'
 * formatTime(-30);   // '-0:30'
 * formatTime(NaN);   // '0:00'
 * ```
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) {
    return '0:00';
  }

  const absSeconds = Math.abs(seconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = Math.floor(absSeconds % 60);

  const sign = seconds < 0 ? '-' : '';

  if (h > 0) {
    return `${sign}${h}:${pad(m)}:${pad(s)}`;
  }

  return `${sign}${m}:${pad(s)}`;
}

/**
 * Format a live stream position as a distance behind the live edge.
 *
 * @param behindLive - Seconds behind the live edge; zero or less means live
 * @returns `'LIVE'` at the edge, otherwise a negative offset such as `'-0:12'`
 *
 * @example
 * ```ts
 * formatLiveTime(0);  // 'LIVE'
 * formatLiveTime(12); // '-0:12'
 * ```
 */
export function formatLiveTime(behindLive: number): string {
  if (behindLive <= 0) {
    return 'LIVE';
  }

  return `-${formatTime(behindLive)}`;
}
