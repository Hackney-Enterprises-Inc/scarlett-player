/**
 * Scarlett Player Demo
 */

import { ScarlettPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { createNativePlugin } from '../packages/plugins/native/src/index';
import { uiPlugin } from '../packages/plugins/ui/src/index';
import { airplayPlugin } from '../packages/plugins/airplay/src/index';
import { chromecastPlugin } from '../packages/plugins/chromecast/src/index';
import { createPlaylistPlugin } from '../packages/plugins/playlist/src/index';
import { createMediaSessionPlugin } from '../packages/plugins/media-session/src/index';
import { createAudioUIPlugin } from '../packages/plugins/audio-ui/src/index';

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
    poster: 'https://vod.thestreamplatform.com/demo/scarlett-player-169-thumb-web.jpg',
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

  // ===== Audio Player Demo =====
  const audioContainer = document.getElementById('audio-player');
  if (audioContainer) {
    // Sample audio tracks for the playlist
    const audioTracks = [
      {
        id: 'llama',
        src: 'https://vod.thestreamplatform.com/demo/winamp-it-really-whips-the-llamas-ass.mp3',
        title: "Winamp - It Really Whips the Llama's Ass",
        artist: 'Winamp',
        artwork: 'https://vod.thestreamplatform.com/demo/scarlett-player-sq-thumb.jpg',
      },
    ];

    // Create audio player with playlist, media session, and audio UI
    const audioPlayer = new ScarlettPlayer({
      container: audioContainer,
      logLevel: 'debug',
      plugins: [
        createNativePlugin(),   // Native audio support
        createPlaylistPlugin({
          autoAdvance: true,
          persist: false,
        }),
        createMediaSessionPlugin({
          seekOffset: 10,
        }),
        createAudioUIPlugin({
          layout: 'full',
          showShuffle: true,
          showRepeat: true,
          theme: {
            primary: '#6366f1',
            background: '#18181b',
          },
        }),
      ].filter(Boolean),
    });

    // Initialize audio player
    await audioPlayer.init();

    // Get playlist plugin
    const playlist = audioPlayer.getPlugin<any>('playlist');

    // Handle playlist track changes - load the source through the player
    // The audio-ui plugin automatically updates title/artwork from this event
    audioPlayer.on('playlist:change' as any, async (e: any) => {
      if (e?.track?.src) {
        console.log('🎵 Loading track:', e.track.title);
        try {
          await audioPlayer.load(e.track.src);
          // Don't auto-play - let user click the play button
        } catch (err) {
          console.error('Failed to load track:', err);
        }
      }
    });

    // Add tracks to playlist and select first track (but don't play)
    if (playlist) {
      playlist.add(audioTracks);
      // Select the first track to load it (emits playlist:change)
      playlist.play(0);
    }

    // Log audio player events
    audioPlayer.on('playback:play', () => console.log('🎵 Audio Playing'));
    audioPlayer.on('playback:pause', () => console.log('🎵 Audio Paused'));

    // Expose audio player globally
    (window as any).audioPlayer = audioPlayer;

    console.log('🎵 Audio Player Demo Ready');
    console.log('Access audio player via window.audioPlayer');
  }

  // ===== Mini Audio Player Demo =====
  const miniContainer = document.getElementById('mini-player');
  if (miniContainer) {
    // Create mini audio player with compact UI (no artwork)
    const miniPlayer = new ScarlettPlayer({
      container: miniContainer,
      logLevel: 'debug',
      plugins: [
        createNativePlugin(),
        createAudioUIPlugin({
          layout: 'mini',
          showArtwork: false,
          showArtist: false,
          showTime: false,
          showVolume: false,
          showShuffle: false,
          showRepeat: false,
          showNavigation: false,
          theme: {
            primary: '#e50914',
            background: '#1f2937',
          },
        }),
      ].filter(Boolean),
    });

    // Initialize mini player
    await miniPlayer.init();

    // Load the same audio track
    await miniPlayer.load('https://vod.thestreamplatform.com/demo/winamp-it-really-whips-the-llamas-ass.mp3');

    // Expose mini player globally
    (window as any).miniPlayer = miniPlayer;

    console.log('🎵 Mini Player Demo Ready');
  }
});
