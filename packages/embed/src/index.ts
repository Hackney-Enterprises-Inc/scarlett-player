/**
 * Scarlett Player - Full Embed Build
 *
 * Complete player with all features:
 * - Video UI (full video player controls)
 * - Audio UI (full + mini audio player)
 * - HLS streaming
 * - Native progressive playback (MP4, WebM, MP3, ...)
 * - Analytics
 * - Playlist management
 * - Media Session (lock screen controls)
 * - Sharing (video, opt in via `shareUrl`)
 *
 * Chapters and clips are addons: load `embed.addon.chapters` /
 * `embed.addon.clips` after this file and they register through `use()`.
 *
 * Analytics, playlist, media session, watermark and share are still bundled
 * here, but deprecated as of 1.28: load `embed.addon.<name>` beside this file
 * to take over from the bundled copy, and to keep the feature in 2.0.0, when
 * the bundled copies are removed. Until then the bundled copy warns once per
 * page that it is on its way out.
 *
 * @packageDocumentation
 */

import { createHLSPlugin } from '@scarlett-player/hls';
import { createNativePlugin } from '@scarlett-player/native';
import { uiPlugin, accentTextTone, registerControl, unregisterControl } from '@scarlett-player/ui';
import { createAudioUIPlugin } from '@scarlett-player/audio-ui';
import { createAnalyticsPlugin } from '@scarlett-player/analytics';
import { createPlaylistPlugin } from '@scarlett-player/playlist';
import { createMediaSessionPlugin } from '@scarlett-player/media-session';
import { createWatermarkPlugin } from '@scarlett-player/watermark';
import { createCaptionsPlugin } from '@scarlett-player/captions';
import { createGesturesPlugin } from '@scarlett-player/gestures';
import { createSharePlugin } from '@scarlett-player/share';
import type { ScarlettPlayerGlobal, PlayerType } from './types';
import { createScarlettPlayerAPI, setupAutoInit, type PluginCreators } from './create-embed';
import { PKG_VERSION } from './version';

// Re-export types
export type { EmbedConfig, EmbedPlayerOptions, ScarlettPlayerGlobal, PlayerType } from './types';
export {
  parseDataAttributes,
  applyContainerStyles,
  aspectRatioToPercent,
  DEFAULT_ASPECT_RATIO,
} from './parser';

const VERSION = PKG_VERSION;

const AVAILABLE_TYPES: PlayerType[] = ['video', 'audio', 'audio-mini'];

const pluginCreators: PluginCreators = {
  hls: createHLSPlugin,
  native: createNativePlugin,
  videoUI: uiPlugin,
  accentTextTone,
  audioUI: createAudioUIPlugin,
  analytics: createAnalyticsPlugin,
  playlist: createPlaylistPlugin,
  mediaSession: createMediaSessionPlugin,
  watermark: createWatermarkPlugin,
  captions: createCaptionsPlugin,
  gestures: createGesturesPlugin,
  share: createSharePlugin,
};

// Create and expose global API
const ScarlettPlayerAPI: ScarlettPlayerGlobal = createScarlettPlayerAPI(
  pluginCreators,
  AVAILABLE_TYPES,
  VERSION,
  // The addon runtime hands addons THIS bundle's control registry, so a
  // control an addon registers lands in this build's control bar.
  { registerControl, unregisterControl },
  // 1.28: the five plugins this build still carries but deprecates. Each is
  // left out of `builtIn`, so `use()` of one replaces the bundled copy
  // silently instead of being refused, and the bundled copy warns once per
  // page until an addon takes over. 2.0.0 drops both the list and the copies.
  { deprecatedBundled: ['analytics', 'playlist', 'mediaSession', 'watermark', 'share'] }
);

if (typeof window !== 'undefined') {
  window.ScarlettPlayer = ScarlettPlayerAPI;
}

// Auto-initialize on DOMContentLoaded
setupAutoInit(pluginCreators, AVAILABLE_TYPES);

export default ScarlettPlayerAPI;
