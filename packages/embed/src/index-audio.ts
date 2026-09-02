/**
 * Scarlett Player - Audio Only Build
 *
 * Audio player with:
 * - Audio UI (full + mini layouts)
 * - HLS streaming (hls.js/light)
 * - Native progressive playback (MP3, AAC, M4A, WAV, ...)
 * - Playlist management
 * - Media Session (lock screen controls)
 *
 * Does NOT include: Video UI, Analytics
 * Use embed.js for full features or embed.video.js for video.
 *
 * @packageDocumentation
 */

// hls.js/light, not the full build. The light build of hls.js drops in-stream
// subtitle parsing, ID3 tag parsing and EME/DRM. This build ships no captions
// plugin and audio embeds are not DRM sources, so ID3 timed metadata is the one
// capability an audio embed gives up for the smaller bundle (documented in
// README.md under "Audio build: hls.js/light").
import { createHLSPlugin } from '@scarlett-player/hls/light';
import { createNativePlugin } from '@scarlett-player/native';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import type { ScarlettPlayerGlobal, PlayerType } from './types';
import { createScarlettPlayerAPI, setupAutoInit, type PluginCreators } from './create-embed';
import { PKG_VERSION } from './version';

// Re-export types
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal, PlayerType } from './types';
export { parseDataAttributes, applyContainerStyles, aspectRatioToPercent } from './parser';

const VERSION = `${PKG_VERSION}-audio`;

const AVAILABLE_TYPES: PlayerType[] = ['audio', 'audio-mini'];

const pluginCreators: PluginCreators = {
  hls: createHLSPlugin,
  native: createNativePlugin,
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
