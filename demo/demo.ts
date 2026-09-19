/**
 * Scarlett Player playground: player and plugin setup.
 *
 * This file builds the three players (video, full audio, mini audio) with
 * every plugin the playground demonstrates, then hands them to the site
 * controller (site-controller.ts), which owns everything the page shows
 * around them. Nothing in here touches the page layout.
 */

import { ScarlettPlayer } from '../packages/core/src/index';
import { createHLSPlugin } from '../packages/plugins/hls/src/index';
import { createNativePlugin } from '../packages/plugins/native/src/index';
import { createWHEPPlugin } from '../packages/plugins/whep/src/index';
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
import type { IPlaylistPlugin } from '../packages/plugins/playlist/src/index';
import type { ClipRange } from '../packages/plugins/clips/src/index';
import { SAMPLE, SCENARIOS, parseLocation } from './scenarios';
import { createSiteController, type AudioTrackSpec, type SiteController } from './site-controller';

// Version injected at build time
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// Expose version globally
(window as any).SCARLETT_VERSION = VERSION;

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

/**
 * The caption tracks as the code panel describes them: hosted .vtt files in
 * place of the blob URLs the demo really uses, since a blob URL is useless
 * outside this page.
 */
const SNIPPET_CAPTIONS = [
  { language: 'en', label: 'English', src: 'captions/en.vtt' },
  { language: 'es', label: 'Spanish', src: 'captions/es.vtt' },
];

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('player');
  const audioContainer = document.getElementById('audio-player');
  const miniContainer = document.getElementById('mini-player');
  if (!container || !audioContainer || !miniContainer) {
    console.error('Player containers not found');
    return;
  }

  // The scenario the page opens on decides which sample, if any, the video
  // player starts loading. A page opened on #audio fetches no video manifest.
  const initial = parseLocation(window.location.hash, window.location.search);
  const initialScenario = SCENARIOS[initial.id];
  const initialVideoSrc = initialScenario.group === 'cinema' ? initialScenario.src : null;

  // Player and plugin instances live outside the arrays so the controller can
  // call their public methods (configure/open on clips, the watermark
  // setters, setTheme on the UIs, getSessionUrl on WHEP).
  let controller: SiteController | null = null;

  // The clips server faked, so the demo needs no API behind it. Stands in for
  // the Laravel package: records the payload the plugin captured, then plays
  // out a simulated rendering-to-ready sequence (202 today, "rendering" at
  // ~2s, "ready" with a URL at ~4s). Nothing is processed or published.
  const fakeClipCreation = (range: ClipRange): Promise<{ uuid: string; status_url: string }> => {
    const uuid = crypto.randomUUID();
    const clipUrl = `https://example.com/clips/${uuid}`;

    // Also kept in memory for the browser harness (scripts/verify-browser.mjs),
    // which needs the exact payload rather than the rendered log row - and
    // needs it locally, because no scenario in that harness may depend on an
    // external origin.
    const captures = ((window as unknown as { __clipCaptures?: ClipRange[] }).__clipCaptures ??= []);
    captures.push(range);

    controller?.logClip('clip:requested', 'POST /api/clips (simulated)', range);
    window.setTimeout(() => controller?.logClip('status', 'rendering (simulated)'), 2000);
    window.setTimeout(() => controller?.logClip('status', `ready (simulated)  url=${clipUrl}`), 4000);

    return Promise.resolve({ uuid, status_url: clipUrl });
  };

  const clipsPlugin = createClipsPlugin({
    mediaId: 'demo-bbb',
    onCreate: fakeClipCreation,
  });

  // Off by default for the public showcase: the plugin still mounts and
  // shows on play, but with no text and no image it renders nothing. The
  // Customize panel gives it content when the switch is turned on.
  const watermarkPlugin = createWatermarkPlugin({
    position: 'bottom-right',
    opacity: 0.5,
    imageHeight: 64,
  });

  const whepPlugin = createWHEPPlugin();

  const videoUI = uiPlugin({
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
  });

  const chaptersPlugin = createChaptersPlugin({
    chapters: VIDEO_CHAPTERS,
  });

  // Provider plugins (HLS, Native, WHEP) are tried in order - first one that
  // can play the source wins.
  const player = new ScarlettPlayer({
    container,
    src: initialVideoSrc ?? undefined,
    poster: SAMPLE.poster,
    logLevel: 'debug',
    plugins: [
      // lowLatencyMode is opt-in for consumers and off by default; the demo
      // turns it on so the Live panel can show LL-HLS against a low-latency
      // source. It changes nothing for VOD or for a plain live manifest -
      // hls.js only takes the LL path when the playlist carries EXT-X-PART.
      createHLSPlugin({ lowLatencyMode: true }), // HLS streams (.m3u8)
      createNativePlugin(),   // Native formats (MP4, WebM, MOV, MKV)
      // WebRTC over WHEP, claimed by a `whep` path segment. There is no
      // public WHEP stream to preload; the Live monitor scenario takes an
      // endpoint from the visitor.
      whepPlugin,
      videoUI,
      airplayPlugin(),
      chromecastPlugin(),
      watermarkPlugin,
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
      chaptersPlugin,
      // Viewer-created clips: the button above (in the 'clip' slot) opens a
      // two-handle selector that loops the selection, and Confirm hands the
      // captured range to fakeClipCreation - the stand-in for the highlights
      // server. Video-only, so this plugin is deliberately absent from the
      // audio player.
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
        customBeacon: (_url, payload) => controller?.logBeacon(payload),
      }),
    ],
  });

  // ===== Audio players =====
  const audioUI = createAudioUIPlugin({
    layout: 'full',
    showShuffle: true,
    showRepeat: true,
    theme: {
      primary: '#e50914',
      progressFill: '#e50914',
      background: '#14161c',
    },
  });

  const audioPlayer = new ScarlettPlayer({
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
      audioUI,
    ],
  });

  const miniUI = createAudioUIPlugin({
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
      progressFill: '#e50914',
      background: '#14161c',
    },
  });

  const miniPlayer = new ScarlettPlayer({
    container: miniContainer,
    logLevel: 'debug',
    plugins: [createNativePlugin(), miniUI],
  });

  // The playlist loads nothing by itself (autoLoad: false); this handler
  // loads whatever track it selects, without autoplay. The promise is kept
  // so loadAudioTrack() below can await the load the selection triggered.
  const playlist = audioPlayer.getPlugin<IPlaylistPlugin>('playlist');
  let pendingAudioLoad: Promise<void> = Promise.resolve();
  audioPlayer.on('playlist:change', (e) => {
    if (!e.track?.src) return;
    console.log('🎵 Loading track:', e.track.title);
    const load = audioPlayer.load(e.track.src);
    // Handled here so an unawaited selection (auto-advance) never surfaces as
    // an unhandled rejection; the awaiting caller still sees the failure.
    load.catch((err) => console.error('Failed to load track:', err));
    pendingAudioLoad = load;
  });

  /**
   * Put one track in the full audio player's playlist and load it. The
   * playlist drives the audio UI's title and artwork.
   *
   * @param track - The track to load
   * @returns Resolves once the source has loaded
   */
  const loadAudioTrack = async (track: AudioTrackSpec): Promise<void> => {
    if (!playlist) {
      await audioPlayer.load(track.src);
      return;
    }
    playlist.clear();
    playlist.add([{ ...track, artwork: track.artwork ?? SAMPLE.artwork }]);
    playlist.play(track.id);
    await pendingAudioLoad;
  };

  // Log events for the browser console; the page's own event log is the
  // controller's, scoped to the active player.
  player.on('playback:play', () => console.log('▶️ Playing'));
  player.on('playback:pause', () => console.log('⏸️ Paused'));
  player.on('media:loaded', (e) => console.log('📺 Media loaded:', e));
  player.on('error', (e) => console.error('❌ Error:', e));
  audioPlayer.on('playback:play', () => console.log('🎵 Audio Playing'));
  audioPlayer.on('playback:pause', () => console.log('🎵 Audio Paused'));

  // Expose the instances globally: the browser harness drives window.player,
  // window.clipsPlugin and window.watermarkPlugin, and they are handy in a
  // devtools console. Set before the controller runs, so a page-script fault
  // cannot take them with it.
  (window as any).player = player;
  (window as any).watermarkPlugin = watermarkPlugin;
  (window as any).clipsPlugin = clipsPlugin;
  (window as any).whepPlugin = whepPlugin;
  (window as any).audioPlayer = audioPlayer;
  (window as any).miniPlayer = miniPlayer;

  // init() is what createPlayer() does after construction: it initialises
  // the plugins and, for the video player, loads the initial source. Started
  // before the controller routes, so the page reflects the hash while the
  // first manifest is still on its way; the controller awaits the promise
  // for the player it is about to load through.
  const ready = {
    video: player.init().catch((err) => console.error('Player init failed:', err)),
    audio: audioPlayer.init().catch((err) => console.error('Audio player init failed:', err)),
    mini: miniPlayer.init().catch((err) => console.error('Mini player init failed:', err)),
  };

  controller = createSiteController({
    version: VERSION,
    players: { video: player, audio: audioPlayer, mini: miniPlayer },
    ui: videoUI,
    audioUI,
    miniUI,
    clips: clipsPlugin,
    watermark: watermarkPlugin,
    whep: whepPlugin,
    chapters: chaptersPlugin,
    captions: SNIPPET_CAPTIONS,
    chapterList: VIDEO_CHAPTERS,
    initialVideoSrc,
    ready,
    loadAudioTrack,
  });
  controller.start();

  await Promise.all(Object.values(ready));

  console.log(`🎬 Scarlett Player v${VERSION} Playground Ready`);
  console.log('Access the players via window.player, window.audioPlayer and window.miniPlayer');
});
