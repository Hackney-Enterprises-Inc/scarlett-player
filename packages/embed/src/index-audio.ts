/**
 * Scarlett Player - Audio Only Build
 *
 * Audio player with:
 * - Audio UI (full + mini layouts)
 * - HLS streaming
 * - Playlist management
 * - Media Session (lock screen controls)
 *
 * Does NOT include: Video UI, Analytics
 * Use embed.js for full features or embed.video.js for video.
 *
 * @packageDocumentation
 */

import { createHLSPlugin } from '@scarlett-player/hls';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import type { ScarlettPlayerGlobal, PlayerType } from './types';
import { createScarlettPlayerAPI, setupAutoInit, type PluginCreators } from './create-embed';

// Re-export types
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal, PlayerType } from './types';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

const VERSION = '0.3.0-audio';

const AVAILABLE_TYPES: PlayerType[] = ['audio', 'audio-mini'];

const pluginCreators: PluginCreators = {
  hls: createHLSPlugin,
  audioUI: createAudioUIPlugin,
  playlist: createPlaylistPlugin,
  mediaSession: createMediaSessionPlugin,
  // Video UI not available in this build
  // Analytics not available in this build
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
