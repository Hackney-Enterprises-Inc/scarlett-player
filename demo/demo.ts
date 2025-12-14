/**
 * Scarlett Player Demo
 */

import { ScarlettPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { uiPlugin } from '../packages/plugins/ui/src/index';
import { airplayPlugin } from '../packages/plugins/airplay/src/index';
import { chromecastPlugin } from '../packages/plugins/chromecast/src/index';

// Demo video URL
const VIDEO_URL = 'https://vod.thestreamplatform.com/csn/misc/csn-generic-copyright-16s/playlist.m3u8';

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('player');
  if (!container) {
    console.error('Player container not found');
    return;
  }

  // Create player with plugins
  const player = new ScarlettPlayer({
    container,
    src: VIDEO_URL,
    logLevel: 'debug',
    plugins: [
      createHLSPlugin(),
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

  console.log('🎬 Scarlett Player Demo Ready');
  console.log('Access player via window.player');
});
