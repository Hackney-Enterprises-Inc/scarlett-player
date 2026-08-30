/**
 * HLS Provider Plugin for Scarlett Player
 *
 * Provides HLS playback using hls.js or native HLS (Safari).
 * Thin wrapper around the shared factory in `create-hls-plugin.ts`; the
 * light entry (`light.ts`) wraps the same factory with the hls.js/light
 * loader, so both builds always carry identical error handling, retry,
 * reconnect, and playlist-validation machinery.
 */

import type { HLSPluginConfig, IHLSPlugin } from './types';
import * as hlsLoader from './hls-loader';
import { createHLSPluginWith } from './create-hls-plugin';

// Re-export types
export type {
  HLSPluginConfig,
  HLSQualityLevel,
  HLSError,
  HLSLiveInfo,
  IHLSPlugin,
} from './types';

// Telemetry helper used to build the `detail.url` on emitted fatal errors
export { sanitizeUrl } from './sanitize-url';

/**
 * Create an HLS Provider Plugin instance.
 *
 * @param config - Plugin configuration
 * @returns HLS Plugin instance
 *
 * @example
 * ```ts
 * import { createHLSPlugin } from '@scarlett-player/hls';
 *
 * const player = new ScarlettPlayer({
 *   container: document.getElementById('player'),
 *   plugins: [createHLSPlugin()],
 * });
 *
 * await player.load('video.m3u8');
 * ```
 */
export function createHLSPlugin(config?: Partial<HLSPluginConfig>): IHLSPlugin {
  return createHLSPluginWith(
    hlsLoader,
    {
      name: 'HLS Provider',
      description: 'HLS playback provider using hls.js',
      logSuffix: '',
      engineLabel: 'hls.js',
    },
    config
  );
}

// Default export
export default createHLSPlugin;
