/**
 * Scarlett Player - Video Only Build
 *
 * Lightweight video player with:
 * - Video UI (full video player controls)
 * - HLS streaming
 *
 * Does NOT include: Audio UI, Analytics, Playlist, Media Session
 * Use embed.js for full features or embed.audio.js for audio.
 *
 * @packageDocumentation
 */

import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';
import type { ScarlettPlayerGlobal, PlayerType } from './types';
import { createScarlettPlayerAPI, setupAutoInit, type PluginCreators } from './create-embed';

// Re-export types
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal, PlayerType } from './types';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

const VERSION = '0.3.0-video';

const AVAILABLE_TYPES: PlayerType[] = ['video'];

const pluginCreators: PluginCreators = {
  hls: createHLSPlugin,
  videoUI: uiPlugin,
  // Audio UI not available in this build
  // Analytics not available in this build
  // Playlist not available in this build
  // Media Session not available in this build
};

// Create and expose global API
const ScarlettPlayerAPI: ScarlettPlayerGlobal = createScarlettPlayerAPI(
  pluginCreators,
  AVAILABLE_TYPES,
  VERSION
);

if (typeof window !== 'undefined') {
  window.ScarlettPlayer = ScarlettPlayerAPI;
}

// Auto-initialize on DOMContentLoaded
setupAutoInit(pluginCreators, AVAILABLE_TYPES);

export default ScarlettPlayerAPI;
