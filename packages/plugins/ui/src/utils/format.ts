/**
 * Formatting utility functions.
 *
 * The implementations live in `@scarlett-player/core` so `ui` and `audio-ui`
 * share one clock. Re-exported rather than moved outright because
 * `formatTime` and `formatLiveTime` are public API on this package
 * (`ui/src/index.ts`), and dropping them would be a breaking change.
 */

export { formatTime, formatLiveTime } from '@scarlett-player/core';
