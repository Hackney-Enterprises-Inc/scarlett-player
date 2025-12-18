/**
 * Scarlett Player Demo
 */

import { ScarlettPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { createNativePlugin } from '../packages/plugins/native/src/index';
import { uiPlugin } from '../packages/plugins/ui/src/index';
import { airplayPlugin } from '../packages/plugins/airplay/src/index';
import { chromecastPlugin } from '../packages/plugins/chromecast/src/index';

// Version injected at build time
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// Expose version globally
(window as any).SCARLETT_VERSION = VERSION;

// Demo video URL - supports both HLS (.m3u8) and native formats (.mp4, .webm, .mov, .mkv)
const VIDEO_URL = 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo/playlist.m3u8';

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('player');
  if (!container) {
    console.error('Player container not found');
    return;
  }

  // Create player with plugins
  // Provider plugins (HLS and Native) are tried in order - first one that can play the source wins
  const player = new ScarlettPlayer({
    container,
    src: VIDEO_URL,
    logLevel: 'debug',
    plugins: [
      createHLSPlugin(),      // HLS streams (.m3u8)
      createNativePlugin(),   // Native formats (MP4, WebM, MOV, MKV)
      uiPlugin({
        hideDelay: 3000,
        theme: {
          accentColor: '#e50914',
        },
      }),
      airplayPlugin(),
      chromecastPlugin(),
    ].filter(Boolean),
  });

  // Initialize player (inits UI plugins, then loads source)
  await player.init();

  // Log events for debugging
  player.on('playback:play', () => console.log('▶️ Playing'));
  player.on('playback:pause', () => console.log('⏸️ Paused'));
  player.on('media:loaded', (e) => console.log('📺 Media loaded:', e));
  player.on('media:loadedmetadata', (e) => console.log('📊 Metadata:', e));
  player.on('quality:levels', (e) => console.log('🎯 Quality levels:', e));
  player.on('error', (e) => console.error('❌ Error:', e));

  // Expose player globally for debugging
  (window as any).player = player;

  console.log(`🎬 Scarlett Player v${VERSION} Demo Ready`);
  console.log('Access player via window.player');
});
