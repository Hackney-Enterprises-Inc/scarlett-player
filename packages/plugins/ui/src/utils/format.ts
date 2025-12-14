/**
 * Formatting utility functions
 */

/**
 * Format seconds as time string (mm:ss or h:mm:ss).
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
 * Pad number with leading zero if needed.
 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format time for live streams (relative to live edge).
 */
export function formatLiveTime(behindLive: number): string {
  if (behindLive <= 0) {
    return 'LIVE';
  }
  return `-${formatTime(behindLive)}`;
}
