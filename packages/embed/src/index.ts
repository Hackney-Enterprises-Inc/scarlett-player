/**
 * Scarlett Player - Full Embed Build
 *
 * Complete player with all features:
 * - Video UI (full video player controls)
 * - Audio UI (full + mini audio player)
 * - HLS streaming
 * - Analytics
 * - Playlist management
 * - Media Session (lock screen controls)
 *
 * @packageDocumentation
 */

import { createHLSPlugin } from '@scarlett-player/hls';
import { uiPlugin } from '@scarlett-player/ui';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import type { ScarlettPlayerGlobal, PlayerType } from './types';
import { createScarlettPlayerAPI, setupAutoInit, type PluginCreators } from './create-embed';

// Re-export types
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal, PlayerType } from './types';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

const VERSION = '0.5.3';

const AVAILABLE_TYPES: PlayerType[] = ['video', 'audio', 'audio-mini'];

const pluginCreators: PluginCreators = {
  hls: createHLSPlugin,
  videoUI: uiPlugin,
  audioUI: createAudioUIPlugin,
  analytics: createAnalyticsPlugin,
  playlist: createPlaylistPlugin,
  mediaSession: createMediaSessionPlugin,
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
