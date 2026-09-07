/**
 * Scarlett Player Demo
 */

import { createPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { createNativePlugin } from '../packages/plugins/native/src/index';
import { uiPlugin } from '../packages/plugins/ui/src/index';
import { airplayPlugin } from '../packages/plugins/airplay/src/index';
import { chromecastPlugin } from '../packages/plugins/chromecast/src/index';
import { createPlaylistPlugin } from '../packages/plugins/playlist/src/index';
import { createMediaSessionPlugin } from '../packages/plugins/media-session/src/index';
import { createAudioUIPlugin } from '../packages/plugins/audio-ui/src/index';
import { createWatermarkPlugin } from '../packages/plugins/watermark/src/index';
import { createSharePlugin } from '../packages/plugins/share/src/index';
import { createGesturesPlugin } from '../packages/plugins/gestures/src/index';
import { createCaptionsPlugin } from '../packages/plugins/captions/src/index';
import { createChaptersPlugin } from '../packages/plugins/chapters/src/index';
import { createClipsPlugin } from '../packages/plugins/clips/src/index';
import { createAnalyticsPlugin } from '../packages/plugins/analytics/src/index';
import type { Chapter } from '../packages/core/src/index';
import type { BeaconPayload } from '../packages/plugins/analytics/src/index';
import type { ClipRange } from '../packages/plugins/clips/src/index';

// Version injected at build time
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// Expose version globally
(window as any).SCARLETT_VERSION = VERSION;

// Demo video URL - supports both HLS (.m3u8) and native formats (.mp4, .webm, .mov, .mkv)
const VIDEO_URL = 'https://vod.thestreamplatform.com/demo/bbb-2160p-stereo/playlist.m3u8';

// Big Buck Bunny runs about 10:34. Everything below is timed against that.
const VIDEO_DURATION_SECONDS = 634;

/**
 * Demo English subtitles, as WebVTT source.
 *
 * Kept inline so the demo needs no hosted .vtt file: it is turned into a
 * `blob:` URL at runtime, which the captions plugin hands to a `<track>`
 * element like any other subtitle URL. The blob is same origin as the page, so
 * no CORS headers and no `crossorigin` attribute are involved.
 */
const CAPTIONS_VTT_EN = `WEBVTT

1
00:00:03.000 --> 00:00:08.000
Big Buck Bunny, a Blender Foundation open movie.

2
00:00:14.000 --> 00:00:19.000
These subtitles are a demo, parsed from an inline WebVTT string.

3
00:00:36.000 --> 00:00:41.000
Morning light spreads across the meadow.

4
00:01:02.000 --> 00:01:08.000
A very large rabbit steps out of his burrow.

5
00:01:40.000 --> 00:01:46.000
Three rodents decide the day needs a victim.

6
00:02:18.000 --> 00:02:24.000
The first acorn finds its target.

7
00:02:58.000 --> 00:03:04.000
Enough is enough.

8
00:03:44.000 --> 00:03:50.000
The rabbit starts building.

9
00:04:26.000 --> 00:04:32.000
Every trap gets tested exactly once.
`;

/** Demo Spanish subtitles, the same cues in the same slots. */
const CAPTIONS_VTT_ES = `WEBVTT

1
00:00:03.000 --> 00:00:08.000
Big Buck Bunny, una pelicula abierta de la Blender Foundation.

2
00:00:14.000 --> 00:00:19.000
Estos subtitulos son una demostracion, leidos de un texto WebVTT incrustado.

3
00:00:36.000 --> 00:00:41.000
La luz de la manana se extiende por el prado.

4
00:01:02.000 --> 00:01:08.000
Un conejo enorme sale de su madriguera.

5
00:01:40.000 --> 00:01:46.000
Tres roedores deciden que el dia necesita una victima.

6
00:02:18.000 --> 00:02:24.000
La primera bellota da en el blanco.

7
00:02:58.000 --> 00:03:04.000
Ya basta.

8
00:03:44.000 --> 00:03:50.000
El conejo empieza a construir.

9
00:04:26.000 --> 00:04:32.000
Cada trampa se prueba una sola vez.
`;

/**
 * Publish an inline WebVTT string as a `blob:` URL.
 *
 * @param vtt - WebVTT source text
 * @returns Object URL that resolves to that text as `text/vtt`
 */
function vttObjectUrl(vtt: string): string {
  return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
}

/**
 * Chapter list for the demo video, hard coded rather than fetched.
 *
 * The last chapter carries an explicit `endTime` so the progress bar stops its
 * marker at the end of the film instead of running to a duration the manifest
 * may report slightly differently.
 */
const VIDEO_CHAPTERS: Chapter[] = [
  { time: 0, label: 'Opening', subtitle: 'Titles and sunrise' },
  { time: 34, label: 'The Meadow', subtitle: 'Big Buck Bunny wakes up' },
  { time: 96, label: 'The Bullies', subtitle: 'Frank, Rinky and Gamera' },
  { time: 215, label: 'Preparations', subtitle: 'Building the traps' },
  { time: 340, label: 'Payback', subtitle: 'One trap at a time' },
  { time: 520, label: 'Credits', subtitle: 'Peach open movie', endTime: VIDEO_DURATION_SECONDS },
];

/** Rows kept in the Analytics Log panel before the oldest are dropped. */
const ANALYTICS_LOG_LIMIT = 50;

/**
 * Beacon fields worth showing in the log, in the order they are rendered.
 *
 * A beacon carries roughly twenty environment fields that are identical on
 * every row (browser, os, screen size), so the panel shows only the handful
 * that change from event to event.
 */
const ANALYTICS_DETAIL_KEYS = [
  'startupTime',
  'currentTime',
  'seekTo',
  'duration',
  'bitrate',
  'height',
  'watchTime',
  'playTime',
  'qoeScore',
  'rebufferCount',
  'errorMessage',
  'exitType',
  'completionRate',
];

/**
 * Render the interesting part of a beacon as a short `key=value` string.
 *
 * @param payload - Beacon the analytics plugin was about to transmit
 * @returns Up to three formatted fields, or an empty string when none apply
 */
function formatBeaconDetail(payload: BeaconPayload): string {
  const parts: string[] = [];

  for (const key of ANALYTICS_DETAIL_KEYS) {
    if (parts.length >= 3) break;

    const value = payload[key];
    if (value === undefined || value === null || value === '') continue;

    parts.push(`${key}=${typeof value === 'number' ? Math.round(value * 10) / 10 : String(value)}`);
  }

  return parts.join('  ');
}

/**
 * Add one beacon to the Analytics Log panel, newest first.
 *
 * @param payload - Beacon the analytics plugin was about to transmit
 */
function appendAnalyticsRow(payload: BeaconPayload): void {
  const log = document.getElementById('analytics-log');
  if (!log) return;

  log.querySelector('.analytics-empty')?.remove();

  const row = document.createElement('div');
  row.className = 'analytics-row';

  const time = document.createElement('span');
  time.className = 'analytics-time';
  time.textContent = new Date(payload.timestamp).toLocaleTimeString();

  const event = document.createElement('span');
  event.className = 'analytics-event';
  event.textContent = String(payload.event);

  const detail = document.createElement('span');
  detail.className = 'analytics-detail';
  detail.textContent = formatBeaconDetail(payload);

  row.append(time, event, detail);
  log.prepend(row);

  while (log.childElementCount > ANALYTICS_LOG_LIMIT) {
    log.lastElementChild?.remove();
  }
}

/**
 * Empty the Analytics Log panel and put its placeholder line back.
 */
function clearAnalyticsLog(): void {
  const log = document.getElementById('analytics-log');
  if (!log) return;

  log.innerHTML = '<div class="analytics-empty">Beacons will appear here as you play the video...</div>';
}

/** Rows kept in the Clip Log panel before the oldest are dropped. */
const CLIP_LOG_LIMIT = 30;

/**
 * Add one line to the Clip Log panel, newest first.
 *
 * Modelled on the Analytics Log rows: time, event, short detail - plus an
 * optional pretty-printed JSON block underneath, which is how the payload of
 * a requested clip is shown. The JSON goes in via `textContent`, never
 * innerHTML: it contains viewer-entered title text.
 *
 * @param event - The clip event name or simulated server status
 * @param detail - One-line summary shown next to the event
 * @param json - Optional payload rendered as a JSON block
 */
function appendClipRow(event: string, detail: string, json?: unknown): void {
  const log = document.getElementById('clip-log');
  if (!log) return;

  log.querySelector('.clip-log-empty')?.remove();

  const row = document.createElement('div');
  row.className = 'clip-row';

  const head = document.createElement('div');
  head.className = 'clip-row-head';

  const time = document.createElement('span');
  time.className = 'clip-time';
  time.textContent = new Date().toLocaleTimeString();

  const eventName = document.createElement('span');
  eventName.className = 'clip-event';
  eventName.textContent = event;

  const detailEl = document.createElement('span');
  detailEl.className = 'clip-detail';
  detailEl.textContent = detail;

  head.append(time, eventName, detailEl);
  row.append(head);

  if (json !== undefined) {
    const pre = document.createElement('pre');
    pre.className = 'clip-json';
    pre.textContent = JSON.stringify(json, null, 2);
    row.append(pre);
  }

  log.prepend(row);

  while (log.childElementCount > CLIP_LOG_LIMIT) {
    log.lastElementChild?.remove();
  }
}

/**
 * Empty the Clip Log panel and put its placeholder line back.
 */
function clearClipLog(): void {
  const log = document.getElementById('clip-log');
  if (!log) return;

  log.innerHTML = '<div class="clip-log-empty">Clips you create will appear here...</div>';
}

/**
 * The clips server faked, so the demo needs no API behind it.
 *
 * Stands in for the Laravel package: prints the payload the plugin captured,
 * then plays out a simulated rendering-to-ready sequence (202 today,
 * "rendering" at ~2s, "ready" with a URL at ~4s). The resolved value is the
 * realistic 202 body, which `clip:created` carries as `result`.
 *
 * @param range - The captured clip range, exactly what a real host POSTs
 * @returns Resolves with the fake 202 body right away, statuses follow
 */
function fakeClipCreation(range: ClipRange): Promise<{ uuid: string; status_url: string }> {
  const uuid = crypto.randomUUID();
  const clipUrl = `https://example.com/clips/${uuid}`;

  appendClipRow('clip:requested', `POST /api/clips (simulated)`, range);
  window.setTimeout(() => appendClipRow('status', 'rendering'), 2000);
  window.setTimeout(() => appendClipRow('status', `ready  url=${clipUrl}`), 4000);

  return Promise.resolve({ uuid, status_url: clipUrl });
}

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('player');
  if (!container) {
    console.error('Player container not found');
    return;
  }

  // Create and initialise the player with its plugins. createPlayer() is the
  // documented entry point every README teaches: it constructs, initialises
  // the plugins and loads `src`, and its promise resolves after `player:ready`
  // has been emitted.
  //
  // The clips plugin instance is kept in scope because the Clip Controls
  // panel below calls configure()/open() on it. The demo fakes the server
  // through onCreate (task 4.3 of the clips plan); a real host running the
  // Laravel package would write `endpoint: { url: '/api/clips' }` instead.
  const clipsPlugin = createClipsPlugin({
    mediaId: 'demo-bbb',
    onCreate: fakeClipCreation,
  });

  // Provider plugins (HLS and Native) are tried in order - first one that can play the source wins
  const player = await createPlayer({
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
        // Spelled out because 'share', 'chapters' and 'clip' are not in the
        // default layout - those plugins register their controls, but a layout
        // has to ask for them. This is the default order with 'chapters'
        // inserted before the settings menu, 'clip' before it too, and 'share'
        // before the cast buttons.
        controls: [
          'play',
          'skip-backward',
          'skip-forward',
          'volume',
          'time',
          'live-indicator',
          'bandwidth-indicator',
          'spacer',
          'clip',
          'chapters',
          'settings',
          'captions',
          'share',
          'chromecast',
          'airplay',
          'pip',
          'fullscreen',
        ],
      }),
      airplayPlugin(),
      chromecastPlugin(),
      createWatermarkPlugin({
        imageUrl: 'https://thestreamplatform.com/img/the-stream-platform-logo-with-text.png',
        position: 'bottom-right',
        opacity: 0.5,
        imageHeight: 64,
      }),
      // Shares the demo page itself, with the playback position appended. On a
      // phone this opens the OS share sheet directly.
      //
      // The embed target points at the published iframe helper, the same path
      // the release workflow uploads to (CDN + /latest/) and the embed README
      // documents - not anything under /packages, which the site does not serve.
      createSharePlugin({
        embedBaseUrl: 'https://assets.thestreamplatform.com/scarlett-player/latest/iframe.html',
      }),
      // Touch only, and it arms itself: `enabled` defaults to 'auto', gated on
      // matchMedia('(any-pointer: coarse)'). It matters most here, where the
      // responsive control bar moves the skip buttons into the overflow tray
      // on a phone and double-tap seeking is what replaces them.
      createGesturesPlugin(),
      // Two demo subtitle tracks, served from blob: URLs built out of the
      // strings above. The plugin appends a <track> per source on media:loaded
      // and mirrors the video's TextTrackList into `textTracks` state, which is
      // what lights up the captions button and the settings menu's Captions
      // row. `autoSelect` is left off so captions start hidden, the way a
      // viewer expects.
      createCaptionsPlugin({
        sources: [
          { language: 'en', label: 'English', src: vttObjectUrl(CAPTIONS_VTT_EN) },
          { language: 'es', label: 'Spanish', src: vttObjectUrl(CAPTIONS_VTT_ES) },
        ],
      }),
      // An inline list, so no chapters file is fetched. The plugin writes
      // `chapters` state (the progress bar paints a marker per boundary) and
      // registers the 'chapters' control listed above.
      createChaptersPlugin({
        chapters: VIDEO_CHAPTERS,
      }),
      // Viewer-created clips: the button above (in the 'clip' slot) opens a
      // two-handle selector that loops the selection, and Confirm hands the
      // captured range to fakeClipCreation - the stand-in for the highlights
      // server. Video-only, so this plugin is deliberately absent from the
      // audio player. The instance lives outside the array so the Clip
      // Controls panel can reconfigure and open it.
      clipsPlugin,
      // Nothing leaves the page: `customBeacon` replaces the transport, so the
      // plugin never calls navigator.sendBeacon or fetch, and `beaconUrl` -
      // required by the factory, and passed to the custom beacon as its first
      // argument - is a reserved .invalid host that cannot resolve.
      createAnalyticsPlugin({
        beaconUrl: 'https://beacon.example.invalid/scarlett-demo',
        videoId: 'big-buck-bunny',
        videoTitle: 'Big Buck Bunny',
        videoDuration: VIDEO_DURATION_SECONDS,
        isLive: false,
        viewerPlan: 'free',
        // Faster than the 10s default so the demo panel fills while someone is
        // still looking at it.
        heartbeatInterval: 5000,
        customBeacon: (_url, payload) => appendAnalyticsRow(payload),
      }),
    ].filter(Boolean),
  });

  // Analytics Log panel controls
  document.getElementById('analytics-clear')?.addEventListener('click', clearAnalyticsLog);

  // Clip Log panel controls. The lookups are optional-chained because the
  // served page (docs/demo/index.html) is a manually synced mirror that can
  // trail demo/index.html - a missing panel must not take the player down.
  document.getElementById('clip-clear')?.addEventListener('click', clearClipLog);

  // Clip Controls panel, modelled on Watermark Controls: the four limit
  // sliders feed plugin.configure() as one patch, and "Open selector" calls
  // plugin.open(). Wired here rather than in the page's inline script so the
  // handlers see the live instance - unlike the watermark capture below,
  // which reads window.watermarkPlugin before the async init has set it.
  const clipLimitInputs = {
    minDuration: document.getElementById('clip-min') as HTMLInputElement | null,
    maxDuration: document.getElementById('clip-max') as HTMLInputElement | null,
    defaultDuration: document.getElementById('clip-preroll') as HTMLInputElement | null,
    step: document.getElementById('clip-step') as HTMLInputElement | null,
  };
  const clipLimitLabels = {
    minDuration: document.getElementById('clip-min-value'),
    maxDuration: document.getElementById('clip-max-value'),
    defaultDuration: document.getElementById('clip-preroll-value'),
    step: document.getElementById('clip-step-value'),
  };

  function applyClipLimits(): void {
    const values = {
      minDuration: Number(clipLimitInputs.minDuration?.value ?? 5),
      maxDuration: Number(clipLimitInputs.maxDuration?.value ?? 60),
      defaultDuration: Number(clipLimitInputs.defaultDuration?.value ?? 30),
      step: Number(clipLimitInputs.step?.value ?? 1),
    };
    for (const key of Object.keys(values) as Array<keyof typeof values>) {
      const label = clipLimitLabels[key];
      if (label) label.textContent = String(values[key]);
    }
    clipsPlugin.configure(values);
  }

  for (const input of Object.values(clipLimitInputs)) {
    input?.addEventListener('input', applyClipLimits);
  }
  document.getElementById('clip-open-btn')?.addEventListener('click', () => clipsPlugin.open());

  // Log events for debugging
  player.on('playback:play', () => console.log('▶️ Playing'));
  player.on('playback:pause', () => console.log('⏸️ Paused'));
  player.on('media:loaded', (e) => console.log('📺 Media loaded:', e));
  player.on('media:loadedmetadata', (e) => console.log('📊 Metadata:', e));
  player.on('quality:levels', (e) => console.log('🎯 Quality levels:', e));
  player.on('chapter:change', (e) => console.log('🔖 Chapter:', e.chapter?.label ?? 'none'));
  player.on('track:text', (e) => console.log('💬 Text track:', e.trackId ?? 'off'));
  player.on('error', (e) => console.error('❌ Error:', e));
  // The clip:* events are declared by merging into PlayerEventMap from the
  // clips package's own type surface; the demo's mixed source/dist program
  // resolves that augmentation against a different copy of core than the
  // player's own events, so they are cast like the 'playlist:change' handler
  // in the audio section below.
  player.on('clip:opened' as any, (e: any) => console.log(`🎬 Clip opened: ${e.start}s – ${e.end}s`));
  player.on('clip:changed' as any, (e: any) => console.log(`✂️ Clip range: ${e.start}s – ${e.end}s (${e.reason})`));
  player.on('clip:created' as any, (e: any) => console.log('✂️ Clip created:', e.result));
  player.on('clip:cancelled' as any, (e: any) => console.log(`🚫 Clip cancelled (${e.reason})`));
  player.on('clip:error' as any, (e: any) => console.error('❌ Clip error:', e.error?.message ?? e.error));

  // Expose player globally for debugging
  (window as any).player = player;
  (window as any).watermarkPlugin = player.getPlugin('watermark');
  (window as any).clipsPlugin = clipsPlugin;

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
    const audioPlayer = await createPlayer({
      container: audioContainer,
      logLevel: 'debug',
      plugins: [
        createNativePlugin(),   // Native audio support
        createPlaylistPlugin({
          autoAdvance: true,
          autoLoad: false,
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
    const miniPlayer = await createPlayer({
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

    // Load the same audio track
    await miniPlayer.load('https://vod.thestreamplatform.com/demo/winamp-it-really-whips-the-llamas-ass.mp3');

    // Expose mini player globally
    (window as any).miniPlayer = miniPlayer;

    console.log('🎵 Mini Player Demo Ready');
  }
});
