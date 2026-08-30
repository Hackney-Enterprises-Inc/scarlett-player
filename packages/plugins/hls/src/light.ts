/**
 * HLS Provider Plugin - Light Build
 *
 * Same functionality as the main plugin but uses hls.js/light for smaller
 * bundle. The light build of hls.js excludes: subtitles, ID3 tags, and
 * DRM/EME support.
 *
 * Thin wrapper around the shared factory in `create-hls-plugin.ts`, so
 * the light entry always carries the same error handling, retry,
 * auto-reconnect, load watchdog, and playlist-validation machinery as the
 * full build (before 1.2.0 this file was a hand-maintained fork that had
 * silently missed all of that hardening).
 *
 * @packageDocumentation
 */

import type { HLSPluginConfig, IHLSPlugin } from './types';
import * as hlsLoaderLight from './hls-loader-light';
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
 * Create an HLS Provider Plugin instance (Light build).
 *
 * This version uses hls.js/light which is ~35% smaller but excludes:
 * - Subtitle/caption support (WebVTT)
 * - ID3 tag parsing
 * - DRM/EME support
 *
 * @param config - Plugin configuration
 * @returns HLS Plugin instance
 */
export function createHLSPlugin(config?: Partial<HLSPluginConfig>): IHLSPlugin {
  return createHLSPluginWith(
    hlsLoaderLight,
    {
      name: 'HLS Provider (Light)',
      description: 'HLS playback provider using hls.js/light (smaller bundle)',
      logSuffix: ' (light)',
      engineLabel: 'hls.js/light',
    },
    config
  );
}

export default createHLSPlugin;
