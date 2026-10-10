/**
 * Rolling live HLS origin for the wire-capture harness.
 *
 * Reuses the fixture's 30 two-second segments with discontinuity tags so
 * media sequence and timestamps keep advancing through a ten-minute outage.
 * Outage and ENDLIST are independent of the clock and reset per scenario.
 */

export const LIVE_SEGMENTS = 30;
export const LIVE_SEGMENT_SECONDS = 2;
export const LIVE_WINDOW = 6;
export const LIVE_PRIME_SECONDS = 12;

/**
 * @param {{ now?: () => number }} [options]
 */
export function createLiveOrigin(options = {}) {
  const nowFn = options.now ?? Date.now;
  let startedAt = null;
  let outage = false;
  let endlist = false;
  let frozenPublished = null;

  const publishedCount = () => {
    if (frozenPublished !== null) return frozenPublished;
    startedAt ??= nowFn();
    const elapsed = LIVE_PRIME_SECONDS + (nowFn() - startedAt) / 1000;
    return Math.max(0, Math.floor(elapsed / LIVE_SEGMENT_SECONDS));
  };

  return {
    /** Clear clock, outage and ENDLIST independently of other scenarios. */
    reset() {
      startedAt = null;
      outage = false;
      endlist = false;
      frozenPublished = null;
    },
    startOutage() {
      outage = true;
    },
    endOutage() {
      outage = false;
    },
    isOutage() {
      return outage;
    },
    /**
     * Freeze publication at the current window and append ENDLIST on the
     * next playlist, after the stream was already classified live.
     */
    finishWithEndlist() {
      frozenPublished = publishedCount();
      endlist = true;
    },
    hasEndlist() {
      return endlist;
    },
    startedAt() {
      return startedAt;
    },
    publishedCount,
    /**
     * @returns {string} A live media playlist as of now
     */
    playlist() {
      const published = publishedCount();
      const first = Math.max(0, published - LIVE_WINDOW);
      const discSeq = Math.floor(first / LIVE_SEGMENTS);
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-TARGETDURATION:${LIVE_SEGMENT_SECONDS}`,
        `#EXT-X-MEDIA-SEQUENCE:${first}`,
      ];
      if (discSeq > 0) lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${discSeq}`);
      for (let i = first; i < published; i++) {
        if (i > 0 && i % LIVE_SEGMENTS === 0 && i !== first) {
          lines.push('#EXT-X-DISCONTINUITY');
        }
        lines.push(
          `#EXTINF:${LIVE_SEGMENT_SECONDS.toFixed(6)},`,
          `/scripts/fixtures/hls/seg${i % LIVE_SEGMENTS}.ts`
        );
      }
      if (endlist) lines.push('#EXT-X-ENDLIST');
      return `${lines.join('\n')}\n`;
    },
  };
}
