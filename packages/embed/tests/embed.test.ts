/**
 * Embed Tests - Player creation and initialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmbedPlayer, initElement, initAll, createScarlettPlayerAPI, type PluginCreators, setupAutoInit } from '../src/create-embed';
import type { PlayerType } from '../src/types';
import { createPlayer, type Plugin, type PlayerOptions, type ScarlettPlayer } from '@scarlett-player/core';

/**
 * Build a stand-in plugin.
 *
 * A full `Plugin`, not just an id and a name: the embed only ever passes these
 * through to `createPlayer`, but typing them properly is what stops this
 * fixture drifting away from the interface the real plugins implement.
 */
/** What the stubbed tone helper returns, whatever it is handed. */
const DERIVED_TONE = '#8f8fff';

const mockPlugin = (id: string, name: string): Plugin => ({
  id,
  name,
  version: '0.0.0-test',
  type: 'feature',
  init: vi.fn(),
  destroy: vi.fn(),
});

// Mock plugins
const mockHLSPlugin = mockPlugin('hls-provider', 'HLS Provider');
const mockNativePlugin = mockPlugin('native-provider', 'Native Media Provider');
const mockVideoUIPlugin = mockPlugin('ui', 'Video UI Plugin');
const mockAudioUIPlugin = mockPlugin('audio-ui', 'Audio UI Plugin');
const mockAnalyticsPlugin = mockPlugin('analytics', 'Analytics Plugin');
const mockPlaylistPlugin = mockPlugin('playlist', 'Playlist Plugin');
const mockMediaSessionPlugin = mockPlugin('media-session', 'Media Session Plugin');
const mockGesturesPlugin = mockPlugin('gestures', 'Gestures Plugin');
const mockSharePlugin = mockPlugin('share', 'Share Plugin');
const mockWatermarkPlugin = mockPlugin('watermark', 'Watermark Plugin');

// Mock plugin creators
const fullPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  native: vi.fn(() => mockNativePlugin),
  videoUI: vi.fn(() => mockVideoUIPlugin),
  // A stand-in for `accentTextTone` from the UI package: the real derivation
  // is measured against WCAG in that package's own tests, and importing it
  // here would drag the unmocked core into a suite that mocks it.
  accentTextTone: vi.fn(() => DERIVED_TONE),
  audioUI: vi.fn(() => mockAudioUIPlugin),
  analytics: vi.fn(() => mockAnalyticsPlugin),
  playlist: vi.fn(() => mockPlaylistPlugin),
  mediaSession: vi.fn(() => mockMediaSessionPlugin),
  gestures: vi.fn(() => mockGesturesPlugin),
  share: vi.fn(() => mockSharePlugin),
};

const videoOnlyPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  native: vi.fn(() => mockNativePlugin),
  videoUI: vi.fn(() => mockVideoUIPlugin),
  gestures: vi.fn(() => mockGesturesPlugin),
  share: vi.fn(() => mockSharePlugin),
};

// A build with a video UI but no share plugin: the audio build is one, and so
// is any bundle published before sharing reached the embed. The slot is
// optional, so such a build must still assemble and must not pin a layout with
// a share slot nothing can fill.
const noSharePluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  native: vi.fn(() => mockNativePlugin),
  videoUI: vi.fn(() => mockVideoUIPlugin),
};

// A build that supplies no native provider. Kept to prove the slot is optional
// and that nothing is pushed when it is absent.
const hlsOnlyPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
};

const fullAvailableTypes: PlayerType[] = ['video', 'audio', 'audio-mini'];
const videoOnlyTypes: PlayerType[] = ['video'];

/**
 * Read the plugin array createEmbedPlayer() assembled.
 *
 * The core mock below returns the config it was handed, which is the only
 * place the assembled array is observable. ScarlettPlayer itself exposes no
 * `config`, so this keeps the cast in one documented place.
 *
 * @param player - Value returned by createEmbedPlayer with the core mock active
 * @returns The plugins passed to createPlayer(), or an empty array
 */
const pluginsOf = (player: unknown): unknown[] =>
  (player as { config?: { plugins?: unknown[] } } | null)?.config?.plugins ?? [];

/**
 * Read the config object a mocked plugin creator was called with.
 *
 * `toHaveBeenCalledWith` can only assert what IS in that object; proving a key
 * is absent needs the object itself. `vi.clearAllMocks()` in beforeEach makes
 * call 0 the current test's call.
 *
 * @param creator - A mocked creator from one of the PluginCreators sets above
 * @returns The first argument of its first call
 * @throws If the creator was never called, which would make an absence
 *   assertion pass for the wrong reason
 */
const uiConfigOf = (creator: unknown): Record<string, unknown> => {
  const calls = vi.mocked(creator as (config: Record<string, unknown>) => unknown).mock.calls;
  const first = calls[0];
  if (!first) {
    throw new Error('Expected the UI plugin creator to have been called');
  }
  return first[0];
};

// Mock the core dependencies
vi.mock('@scarlett-player/core', () => ({
  ScarlettPlayer: vi.fn(),
  // The addon runtime hands this to addons; the embed itself never calls it.
  injectSharedStyles: vi.fn(),
  createPlayer: vi.fn(async (config) => {
    return {
      container: config.container,
      config,
      destroy: vi.fn(),
      unload: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn(),
      // Records handlers so a suite can fire the event the player would.
      once: vi.fn(),
    };
  }),
}));

describe('createEmbedPlayer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player';
    document.body.appendChild(container);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // 1.28 warns about attributes whose addon is not loaded, so this suite
    // silences and asserts on warnings too.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('should create a video player with minimal config', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'https://example.com/video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should return null when src is missing', async () => {
    const player = await createEmbedPlayer(
      container,
      {},
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(player).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No source URL')
    );
  });

  it('should throw error for unavailable type', async () => {
    await expect(
      createEmbedPlayer(
        container,
        { src: 'video.m3u8', type: 'audio' },
        videoOnlyPluginCreators,
        videoOnlyTypes
      )
    ).rejects.toThrow('Player type "audio" is not available');
  });

  it('should create audio player when type is audio', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(player).not.toBeNull();
    expect(fullPluginCreators.audioUI).toHaveBeenCalled();
    expect(fullPluginCreators.videoUI).not.toHaveBeenCalled();
  });

  it('should create audio-mini player when type is audio-mini', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio-mini' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(player).not.toBeNull();
    expect(fullPluginCreators.audioUI).toHaveBeenCalledWith(
      expect.objectContaining({ layout: 'compact' })
    );
  });

  it('should apply container styles for video', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', width: '640px', aspectRatio: '16:9' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(container.style.width).toBe('640px');
    expect(container.style.paddingBottom).toBe('56.25%');
  });

  it('should apply container styles for audio', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(container.style.height).toBe('120px');
  });

  it('should apply container styles for audio-mini', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio-mini' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(container.style.height).toBe('64px');
  });

  it('should include video UI plugin by default', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.videoUI).toHaveBeenCalled();
  });

  it('should exclude UI plugin when controls is false', async () => {
    vi.clearAllMocks();

    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', controls: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.videoUI).not.toHaveBeenCalled();
  });

  it('should forward bigPlayButton false to the video UI', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', bigPlayButton: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.videoUI).toHaveBeenCalledWith(
      expect.objectContaining({ bigPlayButton: false })
    );
  });

  it('should omit bigPlayButton from the video UI config when it is unset', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // The key has to be absent, not present as `undefined`: the ui plugin
    // reads `config.bigPlayButton !== false` and owns the default, so the
    // embed must not hand it a value nobody asked for.
    const uiConfig = uiConfigOf(fullPluginCreators.videoUI);
    expect(uiConfig).not.toHaveProperty('bigPlayButton');
  });

  it('should forward keyboard false to the video UI', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', keyboard: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.videoUI).toHaveBeenCalledWith(
      expect.objectContaining({ keyboard: false })
    );
  });

  it('should omit keyboard from the video UI config when it is unset', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(uiConfigOf(fullPluginCreators.videoUI)).not.toHaveProperty('keyboard');
  });

  it('should not pass keyboard to the audio UI', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio', keyboard: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(uiConfigOf(fullPluginCreators.audioUI)).not.toHaveProperty('keyboard');
  });

  it('derives a readable accent text colour from the brand colour', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', brandColor: '#00008b' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // An iframe host has no CSS of its own inside the player, so a dark brand
    // colour would otherwise render the LIVE label and active menu rows below
    // 4.5:1 with no way to fix it from outside.
    const theme = uiConfigOf(fullPluginCreators.videoUI).theme as Record<string, string>;
    expect(theme.accentColor).toBe('#00008b');
    expect(theme.accentTextColor).toBe(DERIVED_TONE);
    expect(fullPluginCreators.accentTextTone).toHaveBeenCalledWith('#00008b');
  });

  it('lets brandTextColor override the derived tone', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', brandColor: '#00008b', brandTextColor: '#c0ffee' },
      fullPluginCreators,
      fullAvailableTypes
    );

    const theme = uiConfigOf(fullPluginCreators.videoUI).theme as Record<string, string>;
    expect(theme.accentTextColor).toBe('#c0ffee');
  });

  it('leaves accent text alone when the build ships no tone helper', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', brandColor: '#00008b' },
      noSharePluginCreators,
      fullAvailableTypes
    );

    // The audio-only bundle deliberately has no UI package to take the helper
    // from; the token then falls back to --sp-accent, as it always did.
    const theme = uiConfigOf(noSharePluginCreators.videoUI).theme as Record<string, string>;
    expect(theme).not.toHaveProperty('accentTextColor');
  });

  it('should not pass bigPlayButton to the audio UI', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.m3u8', type: 'audio', bigPlayButton: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    // The audio UIs have no big play button; the option is video only.
    expect(uiConfigOf(fullPluginCreators.audioUI)).not.toHaveProperty('bigPlayButton');
    expect(fullPluginCreators.videoUI).not.toHaveBeenCalled();
  });

  // Double-tap seek and tap to toggle the controls, on by default for video.
  // The skip buttons are the first controls the responsive bar moves into the
  // overflow tray on a phone, and this is what replaces them there.
  it('should add gestures to a video player by default', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.gestures).toHaveBeenCalled();
    expect(pluginsOf(player)).toContain(mockGesturesPlugin);
  });

  it('should not add gestures when the embed asked for none', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8', gestures: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.gestures).not.toHaveBeenCalled();
    expect(pluginsOf(player)).not.toContain(mockGesturesPlugin);
  });

  it('should not add gestures to an audio player', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.mp3', type: 'audio' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.gestures).not.toHaveBeenCalled();
  });

  it('should not add gestures to a mini audio player', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.mp3', type: 'audio-mini' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.gestures).not.toHaveBeenCalled();
  });

  it('should build without a gestures creator', async () => {
    // The slot is optional, so a build that omits it must still assemble.
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      hlsOnlyPluginCreators,
      videoOnlyTypes
    );

    expect(player).not.toBeNull();
    expect(pluginsOf(player)).not.toContain(mockGesturesPlugin);
  });

  // Sharing is opt in through shareUrl. The button is a visible change to the
  // control bar, and the plugin has nothing to share without a page URL: it
  // refuses to fall back to the media src, which is frequently signed.
  it('should add the share plugin when a share URL is given', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/watch/abc' })
    );
    expect(pluginsOf(player)).toContain(mockSharePlugin);
  });

  it('should not add the share plugin without a share URL', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.share).not.toHaveBeenCalled();
    expect(pluginsOf(player)).not.toContain(mockSharePlugin);
  });

  it('should put the share control in the video UI layout when sharing is on', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // registerControl() alone places nothing: the button exists only in a
    // player whose layout lists the slot, and the UI plugin's own default
    // layout has none.
    const controls = uiConfigOf(fullPluginCreators.videoUI).controls as string[];
    expect(controls).toContain('share');
    expect(controls).toContain('fullscreen');
  });

  it('should leave the video UI layout alone when sharing is off', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // Absent, not an explicit copy of the default: the UI plugin owns its own
    // layout, so an embed that never asked for sharing cannot drift from it.
    expect(uiConfigOf(fullPluginCreators.videoUI)).not.toHaveProperty('controls');
  });

  it('should forward the embed base URL to the share plugin', async () => {
    await createEmbedPlayer(
      container,
      {
        src: 'video.m3u8',
        shareUrl: 'https://example.com/watch/abc',
        embedBaseUrl: 'https://cdn.example.com/iframe.html',
      },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.share).toHaveBeenCalledWith(
      expect.objectContaining({ embedBaseUrl: 'https://cdn.example.com/iframe.html' })
    );
  });

  it('should omit the embed base URL from the share config when it is unset', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // The key has to be absent: the plugin drops the `embed` target when there
    // is no base URL, rather than copying a snippet that points nowhere.
    expect(uiConfigOf(fullPluginCreators.share)).not.toHaveProperty('embedBaseUrl');
  });

  it('should forward the media title to the share plugin', async () => {
    await createEmbedPlayer(
      container,
      {
        src: 'video.m3u8',
        shareUrl: 'https://example.com/watch/abc',
        title: 'Bout 13: Main Event',
      },
      fullPluginCreators,
      fullAvailableTypes
    );

    // Otherwise the native sheet is offered document.title, which inside
    // iframe.html is the embed page's title rather than the media's.
    expect(fullPluginCreators.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bout 13: Main Event' })
    );
  });

  it('should not add the share plugin to an audio player', async () => {
    await createEmbedPlayer(
      container,
      { src: 'audio.mp3', type: 'audio', shareUrl: 'https://example.com/watch/abc' },
      fullPluginCreators,
      fullAvailableTypes
    );

    // The audio UIs render a fixed template with no control registry, so there
    // is nowhere to put the button.
    expect(fullPluginCreators.share).not.toHaveBeenCalled();
    expect(uiConfigOf(fullPluginCreators.audioUI)).not.toHaveProperty('controls');
  });

  it('should not add the share plugin when controls are off', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc', controls: false },
      fullPluginCreators,
      fullAvailableTypes
    );

    // The button in the control bar is the only way into the sheet.
    expect(fullPluginCreators.share).not.toHaveBeenCalled();
    expect(pluginsOf(player)).not.toContain(mockSharePlugin);
  });

  it('should build without a share creator', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc' },
      noSharePluginCreators,
      videoOnlyTypes
    );

    expect(player).not.toBeNull();
    expect(pluginsOf(player)).not.toContain(mockSharePlugin);
    // And no share slot in the layout: nothing could fill it.
    expect(uiConfigOf(noSharePluginCreators.videoUI)).not.toHaveProperty('controls');
    // 1.28 (§4.3): the attribute cannot take effect, so say which addon would.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.share.js'));
  });

  it('should share from the video build', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'video.m3u8', shareUrl: 'https://example.com/watch/abc' },
      videoOnlyPluginCreators,
      videoOnlyTypes
    );

    expect(videoOnlyPluginCreators.share).toHaveBeenCalled();
    expect(pluginsOf(player)).toContain(mockSharePlugin);
  });

  it('should always include HLS plugin', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.hls).toHaveBeenCalled();
  });

  // Provider registration. Up to 1.7.0 no embed build registered the native
  // provider, so `PluginManager.selectProvider` found nothing for an .mp3 or
  // .mp4 source and the player failed with PROVIDER_NOT_FOUND. selectProvider
  // takes the FIRST registered provider whose canPlay() accepts the source,
  // so the order these are pushed in is part of the contract.
  it('should register the native provider for an .mp3 audio source', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'https://example.com/episode-42.mp3', type: 'audio' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.native).toHaveBeenCalled();
    expect(pluginsOf(player)).toContain(mockNativePlugin);
  });

  it('should register the native provider for an .mp4 video source', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'https://example.com/bout-13.mp4', type: 'video' },
      videoOnlyPluginCreators,
      videoOnlyTypes
    );

    expect(videoOnlyPluginCreators.native).toHaveBeenCalled();
    expect(pluginsOf(player)).toContain(mockNativePlugin);
  });

  it('should register the HLS provider before the native provider', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'https://example.com/stream.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    const plugins = pluginsOf(player);
    expect(plugins[0]).toBe(mockHLSPlugin);
    expect(plugins[1]).toBe(mockNativePlugin);
  });

  it('should register only the HLS provider when the build has no native creator', async () => {
    const player = await createEmbedPlayer(
      container,
      { src: 'https://example.com/stream.m3u8', controls: false },
      hlsOnlyPluginCreators,
      fullAvailableTypes
    );

    expect(pluginsOf(player)).toEqual([mockHLSPlugin]);
  });

  it('should include analytics plugin when configured', async () => {
    await createEmbedPlayer(
      container,
      {
        src: 'video.m3u8',
        analytics: { beaconUrl: 'https://analytics.example.com' },
      },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.analytics).toHaveBeenCalled();
  });

  it('forwards privacy, batching and programmatic hooks to analytics only with a beacon URL', async () => {
    const beforeSend = vi.fn((payload) => payload);
    const analytics = {
      beaconUrl: 'https://analytics.example.com',
      anonymous: true,
      respectDoNotTrack: false,
      batch: { intervalMs: 2500, maxEvents: 5 },
      beforeSend,
      playerInitTime: 12345,
    };
    await createEmbedPlayer(container, { src: 'video.m3u8', analytics }, fullPluginCreators, fullAvailableTypes);
    expect(fullPluginCreators.analytics).toHaveBeenCalledWith(expect.objectContaining({
      ...analytics,
      videoId: 'video.m3u8',
    }));

    vi.clearAllMocks();
    await createEmbedPlayer(container, {
      src: 'video.m3u8',
      analytics: { anonymous: true, respectDoNotTrack: true, batch: true },
    }, fullPluginCreators, fullAvailableTypes);
    expect(fullPluginCreators.analytics).not.toHaveBeenCalled();
  });

  it('should include playlist plugin when playlist provided', async () => {
    await createEmbedPlayer(
      container,
      {
        src: 'video.m3u8',
        playlist: [{ src: 'video1.m3u8' }, { src: 'video2.m3u8' }],
      },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.playlist).toHaveBeenCalled();
  });

  it('should pass each playlist item videoId through to its track', async () => {
    await createEmbedPlayer(
      container,
      {
        src: 'video.m3u8',
        playlist: [{ src: 'video1.m3u8', videoId: 'vid-1' }, { src: 'video2.m3u8' }],
      },
      fullPluginCreators,
      fullAvailableTypes
    );

    const { tracks } = (fullPluginCreators.playlist as any).mock.calls.at(-1)[0];
    expect(tracks[0]).toMatchObject({ id: 'item-0', videoId: 'vid-1' });
    expect(tracks[1]).not.toHaveProperty('videoId');
  });
});

describe('initElement', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.setAttribute('data-src', 'https://example.com/video.m3u8');
    document.body.appendChild(element);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    element.remove();
    vi.restoreAllMocks();
  });

  it('should initialize player from element', async () => {
    const player = await initElement(element, fullPluginCreators, fullAvailableTypes);

    expect(player).not.toBeNull();
    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should not reinitialize already initialized element', async () => {
    const player1 = await initElement(element, fullPluginCreators, fullAvailableTypes);
    const player2 = await initElement(element, fullPluginCreators, fullAvailableTypes);

    expect(player1).not.toBeNull();
    expect(player2).toBeNull();
  });

  it('should parse type attribute', async () => {
    element.setAttribute('data-type', 'audio');

    const player = await initElement(element, fullPluginCreators, fullAvailableTypes);

    expect(player).not.toBeNull();
    expect(fullPluginCreators.audioUI).toHaveBeenCalled();
  });

  it('should parse the share URL attribute through to the share plugin', async () => {
    element.setAttribute('data-share-url', 'https://example.com/watch/abc');

    const player = await initElement(element, fullPluginCreators, fullAvailableTypes);

    expect(player).not.toBeNull();
    expect(fullPluginCreators.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/watch/abc' })
    );
  });
});

describe('initAll', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.querySelectorAll('[data-scarlett-player], [data-sp], .scarlett-player').forEach((el) => {
      el.remove();
    });
    vi.restoreAllMocks();
  });

  it('should initialize all players with data-scarlett-player', async () => {
    const element1 = document.createElement('div');
    element1.setAttribute('data-scarlett-player', '');
    element1.setAttribute('data-src', 'video1.m3u8');

    const element2 = document.createElement('div');
    element2.setAttribute('data-scarlett-player', '');
    element2.setAttribute('data-src', 'video2.m3u8');

    document.body.appendChild(element1);
    document.body.appendChild(element2);

    await initAll(fullPluginCreators, fullAvailableTypes);

    expect(element1.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(element2.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Initialized 2 player(s)')
    );
  });

  it('should initialize players with data-sp shorthand', async () => {
    const element = document.createElement('div');
    element.setAttribute('data-sp', '');
    element.setAttribute('data-src', 'video.m3u8');
    document.body.appendChild(element);

    await initAll(fullPluginCreators, fullAvailableTypes);

    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should initialize players with class selector', async () => {
    const element = document.createElement('div');
    element.classList.add('scarlett-player');
    element.setAttribute('data-src', 'video.m3u8');
    document.body.appendChild(element);

    await initAll(fullPluginCreators, fullAvailableTypes);

    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('starts every player concurrently rather than one after another', async () => {
    const started: number[] = [];
    // A holder, not a bare `let`: TS narrows a variable only assigned inside a
    // callback to its initialiser, and would then reject the call below.
    const gateControl: { release?: () => void } = {};
    const gate = new Promise<void>((resolve) => {
      gateControl.release = resolve;
    });

    vi.mocked(createPlayer).mockImplementation(async (config: PlayerOptions) => {
      started.push(started.length);
      await gate;

      return { container: config.container, destroy: vi.fn() } as unknown as ScarlettPlayer;
    });

    for (let i = 0; i < 3; i++) {
      const element = document.createElement('div');
      element.setAttribute('data-scarlett-player', '');
      element.setAttribute('data-src', `video${i}.m3u8`);
      document.body.appendChild(element);
    }

    const pending = initAll(fullPluginCreators, fullAvailableTypes);

    // All three are in flight before any of them finishes. Sequentially this
    // would be 1, and the last embed on the page would wait out the others.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started.length).toBe(3);

    gateControl.release?.();
    await pending;
  });

  it('initializes the healthy players when one throws', async () => {
    vi.mocked(createPlayer).mockImplementation(async (config: PlayerOptions) => {
      if (config.src === 'bad.m3u8') throw new Error('boom');

      return { container: config.container, destroy: vi.fn() } as unknown as ScarlettPlayer;
    });

    const good = document.createElement('div');
    good.setAttribute('data-scarlett-player', '');
    good.setAttribute('data-src', 'good.m3u8');

    const bad = document.createElement('div');
    bad.setAttribute('data-scarlett-player', '');
    bad.setAttribute('data-src', 'bad.m3u8');

    const alsoGood = document.createElement('div');
    alsoGood.setAttribute('data-scarlett-player', '');
    alsoGood.setAttribute('data-src', 'also-good.m3u8');

    document.body.append(good, bad, alsoGood);

    await initAll(fullPluginCreators, fullAvailableTypes);

    expect(good.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(alsoGood.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(bad.hasAttribute('data-scarlett-initialized')).toBe(false);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Initialized 2 player(s)'));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('1 player(s) failed to initialize')
    );
  });
});

describe('startTime', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('waits for metadata before seeking', async () => {
    const player = (await createEmbedPlayer(
      container,
      { src: 'https://example.com/video.m3u8', startTime: 42 },
      fullPluginCreators,
      fullAvailableTypes
    )) as unknown as { seek: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> };

    // Nothing yet: seeking before the duration is parsed is silently dropped.
    expect(player.seek).not.toHaveBeenCalled();
    expect(player.once).toHaveBeenCalledWith('media:loadedmetadata', expect.any(Function));

    // Fire the event the player would have fired.
    const [, onMetadata] = player.once.mock.calls[0] as [string, () => void];
    onMetadata();

    expect(player.seek).toHaveBeenCalledWith(42);
  });

  it('seeks straight away when metadata is already parsed', async () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true });
    container.appendChild(video);

    const player = (await createEmbedPlayer(
      container,
      { src: 'https://example.com/video.m3u8', startTime: 12 },
      fullPluginCreators,
      fullAvailableTypes
    )) as unknown as { seek: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> };

    expect(player.seek).toHaveBeenCalledWith(12);
    expect(player.once).not.toHaveBeenCalled();
  });

  it('does not touch playback position without a startTime', async () => {
    const player = (await createEmbedPlayer(
      container,
      { src: 'https://example.com/video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    )) as unknown as { seek: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> };

    expect(player.seek).not.toHaveBeenCalled();
    expect(player.once).not.toHaveBeenCalled();
  });
});

describe('createScarlettPlayerAPI', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'player-container';
    document.body.appendChild(container);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('should create API with version', () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    expect(api.version).toBe('1.0.0');
  });

  it('should expose availableTypes', () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    expect(api.availableTypes).toEqual(['video', 'audio', 'audio-mini']);
  });

  it('should create player with HTMLElement container', async () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    const player = await api.create({
      container,
      src: 'video.m3u8',
    });

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should create player with CSS selector', async () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    const player = await api.create({
      container: '#player-container',
      src: 'video.m3u8',
    });

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should return null for non-existent selector', async () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    const player = await api.create({
      container: '#non-existent',
      src: 'video.m3u8',
    });

    expect(player).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Container not found')
    );
  });

  it('should create audio player with type option', async () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    const player = await api.create({
      container,
      src: 'audio.m3u8',
      type: 'audio',
    });

    expect(player).not.toBeNull();
    expect(fullPluginCreators.audioUI).toHaveBeenCalled();
  });
  it('hands back the core player itself, so unload() reaches the host', async () => {
    const api = createScarlettPlayerAPI(fullPluginCreators, fullAvailableTypes, '1.0.0');
    const player = await api.create({ container, src: 'live.m3u8' });

    expect(player).toBe(await vi.mocked(createPlayer).mock.results[0]?.value);
    await player.unload();
    expect(player.unload).toHaveBeenCalledTimes(1);
  });
});

describe('addons: use() and addonRuntime', () => {
  const chaptersPlugin = mockPlugin('chapters', 'Chapters');
  const clipsPlugin = mockPlugin('clips', 'Clips');
  let container: HTMLElement;

  /** A fresh creators map per test: use() mutates the one it is given. */
  const freshVideoCreators = (): PluginCreators => ({
    hls: vi.fn(() => mockHLSPlugin),
    native: vi.fn(() => mockNativePlugin),
    videoUI: vi.fn(() => mockVideoUIPlugin),
    captions: vi.fn(() => mockPlugin('captions', 'Captions')),
    share: vi.fn(() => mockSharePlugin),
  });

  const freshAudioCreators = (): PluginCreators => ({
    hls: vi.fn(() => mockHLSPlugin),
    native: vi.fn(() => mockNativePlugin),
    audioUI: vi.fn(() => mockAudioUIPlugin),
  });

  /**
   * The audio entry's own map: playlist and media session bundled, and not
   * deprecated, because O2 keeps them in that build past 2.0.0.
   */
  const freshAudioEntryCreators = (): PluginCreators => ({
    ...freshAudioCreators(),
    playlist: vi.fn(() => mockPlaylistPlugin),
    mediaSession: vi.fn(() => mockMediaSessionPlugin),
  });

  /**
   * A full-build creators map: every creator the full entry ships, the five
   * 1.28 deprecates included. Fresh per test, because `use()` mutates it.
   */
  const freshFullCreators = (): PluginCreators => ({
    hls: vi.fn(() => mockHLSPlugin),
    native: vi.fn(() => mockNativePlugin),
    videoUI: vi.fn(() => mockVideoUIPlugin),
    accentTextTone: vi.fn(() => DERIVED_TONE),
    audioUI: vi.fn(() => mockAudioUIPlugin),
    analytics: vi.fn(() => mockAnalyticsPlugin),
    playlist: vi.fn(() => mockPlaylistPlugin),
    mediaSession: vi.fn(() => mockMediaSessionPlugin),
    gestures: vi.fn(() => mockGesturesPlugin),
    share: vi.fn(() => mockSharePlugin),
    watermark: vi.fn(() => mockWatermarkPlugin),
  });

  /** What the full entry passes as `deprecatedBundled` (plan §4.2). */
  const FULL_DEPRECATED = ['analytics', 'playlist', 'mediaSession', 'watermark', 'share'] as const;

  /** What the video entry passes as `deprecatedBundled`. */
  const VIDEO_DEPRECATED = ['watermark', 'share'] as const;

  const uiFns = { registerControl: vi.fn(), unregisterControl: vi.fn(() => true) };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    document.head.querySelector('meta[name="csrf-token"]')?.remove();
    vi.restoreAllMocks();
  });

  it('writes into the creators map that create() and initAll() read', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0-video', uiFns);
    const chapters = vi.fn(() => chaptersPlugin);

    api.use('chapters', chapters);
    expect(creators.chapters).toBe(chapters);

    const player = await api.create({ container, src: 'v.m3u8', chapters: { src: 'c.vtt' } });
    expect(pluginsOf(player)).toContain(chaptersPlugin);
    expect(chapters).toHaveBeenCalledWith({ src: 'c.vtt' });

    // initAll() goes through the same map.
    const el = document.createElement('div');
    el.setAttribute('data-scarlett-player', '');
    el.setAttribute('data-src', 'v.m3u8');
    el.setAttribute('data-chapters', '[{"time":0,"label":"Intro"}]');
    document.body.appendChild(el);
    await api.initAll();
    el.remove();
    expect(chapters).toHaveBeenCalledTimes(2);
  });

  it('refuses a name the build already provides', () => {
    const provided = vi.fn(() => chaptersPlugin);
    const creators = { ...freshVideoCreators(), chapters: provided };
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);

    api.use('chapters', vi.fn(() => chaptersPlugin));
    expect(creators.chapters).toBe(provided);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('chapters is already provided by this build'));
  });

  it('refuses an unknown name and lists the accepted ones', () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);

    // 'share' was the example here until 1.28 made it a real addon name.
    api.use('airplay' as never, vi.fn(() => mockSharePlugin));
    expect(creators.share).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Accepted names: chapters, clips, analytics, playlist, mediaSession, watermark, share'
      )
    );
  });

  it('replaces an earlier use() with a warning', () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    const second = vi.fn(() => clipsPlugin);

    api.use('clips', vi.fn(() => clipsPlugin));
    expect(console.warn).not.toHaveBeenCalled();
    api.use('clips', second);
    expect(creators.clips).toBe(second);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('replaces an earlier registration'));
  });

  // 1.28 (plan §4.2): a name the build bundles but deprecates is left out of
  // `builtIn`, so an addon loaded beside the build replaces the bundled copy
  // instead of being refused. That is what lets a host migrate before 2.0.0
  // takes the bundled copies away.
  it('replaces a creator the build bundles but deprecates, silently, and uses the addon', async () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns, {
      deprecatedBundled: FULL_DEPRECATED,
    });
    const addonAnalytics = vi.fn(() => mockAnalyticsPlugin);

    api.use('analytics', addonAnalytics);

    expect(creators.analytics).toBe(addonAnalytics);
    expect(console.warn).not.toHaveBeenCalled();

    const player = await api.create({
      container,
      src: 'v.m3u8',
      analytics: { beaconUrl: 'https://beacon.example' },
    });

    expect(addonAnalytics).toHaveBeenCalledTimes(1);
    expect(pluginsOf(player)).toContain(mockAnalyticsPlugin);
    // The bundled copy is gone, and its deprecation notice with it.
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('notices once per page that a deprecated bundled creator is still the one in use', async () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns, {
      deprecatedBundled: FULL_DEPRECATED,
    });

    await api.create({ container, src: 'v.m3u8', analytics: { beaconUrl: 'https://beacon.example' } });
    await api.create({ container, src: 'v.m3u8', analytics: { beaconUrl: 'https://beacon.example' } });

    expect(creators.analytics).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.analytics.js'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('2.0.0'));
  });

  it('warns and replaces on a second use() of a deprecated-bundled name', () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns, {
      deprecatedBundled: FULL_DEPRECATED,
    });
    const first = vi.fn(() => mockAnalyticsPlugin);
    const second = vi.fn(() => mockAnalyticsPlugin);

    api.use('analytics', first);
    expect(console.warn).not.toHaveBeenCalled();

    api.use('analytics', second);
    expect(creators.analytics).toBe(second);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('replaces an earlier registration'));
  });

  it('still refuses a name the build provides and does not deprecate', () => {
    // The audio build keeps playlist and media session past 2.0.0 (O2), so it
    // passes no deprecatedBundled and use() refuses them as before.
    const creators = freshAudioEntryCreators();
    const bundled = creators.playlist;
    const api = createScarlettPlayerAPI(creators, ['audio', 'audio-mini'], '1.0.0-audio');

    api.use('playlist', vi.fn(() => mockPlaylistPlugin));

    expect(creators.playlist).toBe(bundled);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('playlist is already provided by this build')
    );
  });

  it('lets an addon take over the video build\'s deprecated watermark', () => {
    const creators = { ...freshVideoCreators(), watermark: vi.fn(() => mockWatermarkPlugin) };
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0-video', uiFns, {
      deprecatedBundled: VIDEO_DEPRECATED,
    });
    const addonWatermark = vi.fn(() => mockWatermarkPlugin);

    api.use('watermark', addonWatermark);

    expect(creators.watermark).toBe(addonWatermark);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('says nothing about a creator the audio build keeps bundled and undeprecated', async () => {
    const creators = freshAudioEntryCreators();
    const api = createScarlettPlayerAPI(creators, ['audio', 'audio-mini'], '1.0.0-audio');

    await api.create({ container, type: 'audio', src: 'a.mp3' });

    expect(creators.mediaSession).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('notices the deprecated bundled share creator once per page', async () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns, {
      deprecatedBundled: FULL_DEPRECATED,
    });
    const config = { src: 'v.m3u8', shareUrl: 'https://example.com/watch/abc' };

    await api.create({ container, ...config });
    await api.create({ container, ...config });

    expect(creators.share).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.share.js'));
  });

  it('installs analytics exactly once per player when the addon replaces the bundled copy', async () => {
    const creators = freshFullCreators();
    const bundled = creators.analytics;
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns, {
      deprecatedBundled: FULL_DEPRECATED,
    });
    const addonAnalytics = vi.fn(() => mockAnalyticsPlugin);
    api.use('analytics', addonAnalytics);

    await api.create({ container, src: 'v.m3u8', analytics: { beaconUrl: 'https://beacon.example' } });
    await api.create({ container, src: 'v.m3u8', analytics: { beaconUrl: 'https://beacon.example' } });

    // One viewStart path per player: the bundled creator is never reached, so
    // no player can end up carrying two analytics plugins.
    expect(bundled).not.toHaveBeenCalled();
    expect(addonAnalytics).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  // F2: the map is marked consumed before `await createPlayer`, so a use()
  // that lands while the first player is still pending is told it is late.
  it('tells a use() that lands while the first create() is pending that it is late', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    const release: { resolve?: () => void } = {};
    const gate = new Promise<void>((resolve) => {
      release.resolve = resolve;
    });
    // Held once: the first createPlayer() waits, every later one runs as usual.
    vi.mocked(createPlayer).mockImplementationOnce(async (config: PlayerOptions) => {
      await gate;

      return {
        container: config.container,
        config,
        destroy: vi.fn(),
        unload: vi.fn().mockResolvedValue(undefined),
        seek: vi.fn(),
        once: vi.fn(),
      } as unknown as ScarlettPlayer;
    });

    const pending = api.create({ container, src: 'v.m3u8', chapters: { src: 'c.vtt' } });
    // Not awaited: the player is still in flight, its plugin array long since
    // assembled.
    api.use('chapters', vi.fn(() => chaptersPlugin));

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('initAll()'));

    release.resolve?.();
    const inFlight = await pending;
    // The in-flight player is not retroactively changed: the creator was not
    // in the map when its plugin array was assembled, so it warned and
    // installed nothing.
    expect(pluginsOf(inFlight)).not.toContain(chaptersPlugin);

    const next = await api.create({ container, src: 'v.m3u8', chapters: { src: 'c.vtt' } });
    expect(pluginsOf(next)).toContain(chaptersPlugin);
  });

  it('warns that a use() after players exist applies only to later players', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    await api.create({ container, src: 'v.m3u8' });

    api.use('chapters', vi.fn(() => chaptersPlugin));
    expect(creators.chapters).toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('initAll()'));
  });

  // F6: the once-per-page key is the addon plus the reason, so one reason
  // cannot hide a more actionable one.
  it('says each distinct chapters warning once: audio "video only", then video "load the addon"', async () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns);

    await api.create({ container, type: 'audio', src: 'a.mp3', chapters: { src: 'c.vtt' } });
    await api.create({ container, type: 'video', src: 'v.m3u8', chapters: { src: 'c.vtt' } });
    await api.create({ container, type: 'audio', src: 'a.mp3', chapters: { src: 'c.vtt' } });
    await api.create({ container, type: 'video', src: 'v.m3u8', chapters: { src: 'c.vtt' } });

    const messages = vi.mocked(console.warn).mock.calls.map((call) => String(call[0]));
    expect(messages.filter((m) => m.includes('applies to video players only'))).toHaveLength(1);
    expect(messages.filter((m) => m.includes('embed.addon.chapters.js'))).toHaveLength(1);
    expect(messages).toHaveLength(2);
  });

  it('warns once for the same missing chapters addon across two video players', async () => {
    const creators = freshFullCreators();
    const api = createScarlettPlayerAPI(creators, fullAvailableTypes, '1.0.0', uiFns);

    await api.create({ container, type: 'video', src: 'v.m3u8', chapters: { src: 'c.vtt' } });
    await api.create({ container, type: 'video', src: 'v.m3u8', chapters: { src: 'c.vtt' } });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.chapters.js'));
  });

  // F7: pending plus created players are counted per map, so a rejected first
  // create no longer leaves the map marked consumed.
  it('does not warn "after players were created" when the only create() rejected', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    vi.mocked(createPlayer).mockRejectedValueOnce(new Error('PROVIDER_NOT_FOUND'));

    await expect(api.create({ container, src: 'v.m3u8' })).rejects.toThrow('PROVIDER_NOT_FOUND');
    api.use('chapters', vi.fn(() => chaptersPlugin));

    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('after players were created'));
  });

  it('keeps the late warning when a second create() is still pending as the first rejects', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    const release: { resolve?: () => void } = {};
    const gate = new Promise<void>((resolve) => {
      release.resolve = resolve;
    });
    vi.mocked(createPlayer).mockRejectedValueOnce(new Error('PROVIDER_NOT_FOUND'));
    vi.mocked(createPlayer).mockImplementationOnce(async (config: PlayerOptions) => {
      await gate;
      return { container: config.container, config, destroy: vi.fn(), once: vi.fn() } as unknown as ScarlettPlayer;
    });

    const first = api.create({ container, src: 'v.m3u8' });
    const second = api.create({ container, src: 'v.m3u8' });
    await expect(first).rejects.toThrow('PROVIDER_NOT_FOUND');

    api.use('chapters', vi.fn(() => chaptersPlugin));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('after players were created'));

    release.resolve?.();
    await second;
  });

  it('exposes a frozen addonRuntime with the bare package version and the build\'s UI functions', async () => {
    const api = createScarlettPlayerAPI(freshVideoCreators(), videoOnlyTypes, '9.9.9-video', uiFns);
    const { injectSharedStyles } = await import('@scarlett-player/core');
    const { PKG_VERSION } = await import('../src/version');

    expect(Object.isFrozen(api.addonRuntime)).toBe(true);
    expect(api.addonRuntime.version).toBe(PKG_VERSION);
    expect(api.addonRuntime.version).not.toContain('-video');
    expect(api.addonRuntime.registerControl).toBe(uiFns.registerControl);
    expect(api.addonRuntime.unregisterControl).toBe(uiFns.unregisterControl);
    expect(api.addonRuntime.injectSharedStyles).toBe(injectSharedStyles);
  });

  it('gives an audio build use() and an addonRuntime whose UI functions refuse', () => {
    const api = createScarlettPlayerAPI(freshAudioCreators(), ['audio', 'audio-mini'], '1.0.0-audio');
    expect(typeof api.use).toBe('function');
    expect(() => api.addonRuntime.registerControl('x', () => null)).toThrow(/no video UI/);
  });

  it('installs chapters from either form when the addon is registered, and adds the control', async () => {
    const creators = { ...freshVideoCreators(), chapters: vi.fn(() => chaptersPlugin) };
    const inline = [{ time: 0, label: 'Intro' }];

    await createEmbedPlayer(container, { src: 'v.m3u8', chapters: { chapters: inline } }, creators, videoOnlyTypes);
    await createEmbedPlayer(container, { src: 'v.m3u8', chapters: { src: 'c.vtt' } }, creators, videoOnlyTypes);

    expect(creators.chapters).toHaveBeenNthCalledWith(1, { chapters: inline });
    expect(creators.chapters).toHaveBeenNthCalledWith(2, { src: 'c.vtt' });
    expect(uiConfigOf(creators.videoUI).controls).toContain('chapters');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('installs clips only with the csrf opt-in, with headers() reading the meta tag', async () => {
    const creators = { ...freshVideoCreators(), clips: vi.fn(() => clipsPlugin) };
    const meta = document.createElement('meta');
    meta.name = 'csrf-token';
    meta.content = 'tok-123';
    document.head.appendChild(meta);

    const player = await createEmbedPlayer(
      container,
      { src: 'v.m3u8', clips: { endpoint: '/api/clips', csrf: 'meta', mediaId: 'abc', maxDuration: 60 } },
      creators,
      videoOnlyTypes
    );

    expect(pluginsOf(player)).toContain(clipsPlugin);
    const cfg = uiConfigOf(creators.clips) as unknown as {
      endpoint: { url: string; headers: () => Record<string, string> };
      mediaId: string;
      maxDuration: number;
    };
    expect(cfg.endpoint.url).toBe('/api/clips');
    expect(cfg.mediaId).toBe('abc');
    expect(cfg.maxDuration).toBe(60);
    expect(cfg).not.toHaveProperty('minDuration');
    // Read per request, not captured at creation.
    meta.content = 'tok-456';
    expect(cfg.endpoint.headers()).toEqual({ 'X-CSRF-TOKEN': 'tok-456' });
    meta.remove();
    expect(cfg.endpoint.headers()).toEqual({ 'X-CSRF-TOKEN': '' });
    expect(uiConfigOf(creators.videoUI).controls).toContain('clip');
  });

  it('falls back to analytics.videoId, then src, for the clips mediaId', async () => {
    const creators = { ...freshVideoCreators(), clips: vi.fn(() => clipsPlugin) };

    await createEmbedPlayer(
      container,
      { src: 'v.m3u8', analytics: { videoId: 'vid-42' }, clips: { endpoint: '/x', csrf: 'meta' } },
      creators,
      videoOnlyTypes
    );
    await createEmbedPlayer(container, { src: 'v.m3u8', clips: { endpoint: '/x', csrf: 'meta' } }, creators, videoOnlyTypes);

    const calls = vi.mocked(creators.clips).mock.calls as unknown as Array<[{ mediaId: string }]>;
    expect(calls[0]?.[0].mediaId).toBe('vid-42');
    expect(calls[1]?.[0].mediaId).toBe('v.m3u8');
  });

  it('installs nothing and warns once without the csrf opt-in', async () => {
    const creators = { ...freshVideoCreators(), clips: vi.fn(() => clipsPlugin) };
    await createEmbedPlayer(container, { src: 'v.m3u8', clips: { endpoint: '/api/clips' } }, creators, videoOnlyTypes);

    expect(creators.clips).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('data-clips-csrf="meta"'));
    expect(uiConfigOf(creators.videoUI)).not.toHaveProperty('controls');
  });

  it('warns with the addon file name when the addon is not loaded', async () => {
    const creators = freshVideoCreators();
    await createEmbedPlayer(
      container,
      { src: 'v.m3u8', chapters: { src: 'c.vtt' }, clips: { endpoint: '/x', csrf: 'meta' } },
      creators,
      videoOnlyTypes
    );

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.chapters.js'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.clips.js'));
    expect(uiConfigOf(creators.videoUI)).not.toHaveProperty('controls');
  });

  // DC1: once per page, not once per player. A page with ten players says each
  // thing once, and every test map starts clean with no reset.
  it('warns once per page for a missing chapters or clips addon, across two players', async () => {
    const creators = freshVideoCreators();
    const config = {
      src: 'v.m3u8',
      chapters: { src: 'c.vtt' },
      clips: { endpoint: '/api/clips', csrf: 'meta' as const },
    };

    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);
    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.chapters.js'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.clips.js'));
  });

  it('warns once per page when the analytics addon is not loaded at all', async () => {
    const creators = freshVideoCreators();
    const config = { src: 'v.m3u8', analytics: { beaconUrl: 'https://beacon.example' } };

    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);
    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);

    // No beacons at all: the plugin is what sends them.
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('data-analytics-beacon-url'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.analytics.js'));
  });

  // F6: what is lost without the playlist addon is navigation, not playback.
  // The source precedence is unchanged, so a configured src still wins.
  it('keeps the configured src as the playback source when the playlist addon is absent', async () => {
    const creators = freshVideoCreators();
    const player = await createEmbedPlayer(
      container,
      { src: 'standalone.m3u8', playlist: [{ src: 'one.m3u8' }, { src: 'two.m3u8' }] },
      creators,
      videoOnlyTypes
    );

    expect((player as unknown as { config: { src: string } }).config.src).toBe('standalone.m3u8');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('only the first item plays'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.playlist.js'));
  });

  // DC3: no media session warning for a titled video player, because
  // `data-title` is on nearly every embed and also feeds share.
  it('warns on an audio player when the media session addon is missing, and stays silent on a titled video player', async () => {
    const audio = freshAudioCreators();
    const audioTypes: PlayerType[] = ['audio', 'audio-mini'];

    await createEmbedPlayer(container, { src: 'a.mp3', type: 'audio' }, audio, audioTypes);
    await createEmbedPlayer(container, { src: 'a.mp3', type: 'audio-mini' }, audio, audioTypes);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('embed.addon.media-session.js'));

    vi.clearAllMocks();
    const video = freshVideoCreators();
    await createEmbedPlayer(container, { src: 'v.m3u8', title: 'Bout 13' }, video, videoOnlyTypes);

    expect(console.warn).not.toHaveBeenCalled();
  });

  // DC4: a missing anti-piracy overlay is a content-protection loss, so this
  // one is an error rather than a warning.
  it('errors once when the watermark addon is missing', async () => {
    const creators = freshVideoCreators();
    const config = { src: 'v.m3u8', watermark: { text: 'DRAFT' } };

    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);
    await createEmbedPlayer(container, { ...config }, creators, videoOnlyTypes);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('embed.addon.watermark.js'));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('builds the layout in the agreed order when share, clip and chapters are all on', async () => {
    const creators = {
      ...freshVideoCreators(),
      chapters: vi.fn(() => chaptersPlugin),
      clips: vi.fn(() => clipsPlugin),
    };
    await createEmbedPlayer(
      container,
      {
        src: 'v.m3u8',
        shareUrl: 'https://example.com/w',
        chapters: { src: 'c.vtt' },
        clips: { endpoint: '/x', csrf: 'meta', mediaId: 'm' },
      },
      creators,
      videoOnlyTypes
    );

    const controls = uiConfigOf(creators.videoUI).controls as string[];
    const at = (id: string) => controls.indexOf(id);
    expect(at('spacer')).toBeLessThan(at('share'));
    expect(at('share')).toBeLessThan(at('clip'));
    expect(at('clip')).toBeLessThan(at('chapters'));
    expect(at('chapters')).toBeLessThan(at('settings'));
  });

  it('warns in an audio build that captions, chapters and clips need a video build, and media session its addon', async () => {
    const creators = freshAudioCreators();
    const api = createScarlettPlayerAPI(creators, ['audio', 'audio-mini'], '1.0.0-audio');
    const chapters = vi.fn(() => chaptersPlugin);
    const clips = vi.fn(() => clipsPlugin);
    api.use('chapters', chapters);
    api.use('clips', clips);

    const player = await api.create({
      container,
      type: 'audio',
      src: 'a.mp3',
      captions: { sources: [{ language: 'en', label: 'English', src: 'en.vtt' }] },
      chapters: { src: 'c.vtt' },
      clips: { endpoint: '/x', csrf: 'meta' },
    });

    expect(chapters).not.toHaveBeenCalled();
    expect(clips).not.toHaveBeenCalled();
    expect(pluginsOf(player)).toEqual([mockHLSPlugin, mockNativePlugin, mockAudioUIPlugin]);
    const warnings = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
    // Captions, chapters and clips need a video build; media session is not
    // video-only, so it names its addon file instead (§4.3).
    expect(warnings).toHaveLength(4);
    expect(warnings.filter((w) => /video build/.test(w))).toHaveLength(3);
    expect(warnings.some((w) => w.includes('embed.addon.media-session.js'))).toBe(true);
  });

  it('leaves config and plugin list byte-identical for an embed with no new attributes and no addon', async () => {
    const before = freshVideoCreators();
    const withUse = freshVideoCreators();
    // An API with use() available but never called, beside a plain creators map.
    createScarlettPlayerAPI(withUse, videoOnlyTypes, '1.0.0', uiFns);

    const config = { src: 'v.m3u8', title: 'T', shareUrl: 'https://example.com/w' };
    const a = await createEmbedPlayer(container, { ...config }, before, videoOnlyTypes);
    const b = await createEmbedPlayer(container, { ...config }, withUse, videoOnlyTypes);

    expect(JSON.stringify(pluginsOf(a))).toBe(JSON.stringify(pluginsOf(b)));
    expect(JSON.stringify(uiConfigOf(before.videoUI))).toBe(JSON.stringify(uiConfigOf(withUse.videoUI)));
    // share-only keeps the pre-addon layout exactly.
    expect(uiConfigOf(before.videoUI).controls).toEqual([
      'play', 'skip-backward', 'skip-forward', 'volume', 'time', 'live-indicator',
      'bandwidth-indicator', 'spacer', 'share', 'settings', 'captions', 'chromecast',
      'airplay', 'pip', 'fullscreen',
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe('setupAutoInit', () => {
  /** A player element the scan will pick up; initialised means the marker attribute was set. */
  const mount = () => {
    const el = document.createElement('div');
    el.setAttribute('data-scarlett-player', '');
    el.setAttribute('data-src', 'https://example.com/video.m3u8');
    document.body.appendChild(el);
    return el;
  };
  const initialised = (el: HTMLElement) => el.hasAttribute('data-scarlett-initialized');
  const setReadyState = (value: DocumentReadyState) =>
    Object.defineProperty(document, 'readyState', { value, configurable: true });

  afterEach(() => {
    document.body.innerHTML = '';
    setReadyState('complete');
  });

  it('waits for DOMContentLoaded while the document is loading', () => {
    setReadyState('loading');
    const el = mount();
    setupAutoInit(videoOnlyPluginCreators, videoOnlyTypes);
    expect(initialised(el)).toBe(false);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(initialised(el)).toBe(true);
  });

  // `defer` and `type="module"` scripts run after parsing, when readyState is
  // already 'interactive' but before DOMContentLoaded. Initialising right
  // then would run before the addon scripts that follow the embed in document
  // order, so those players would never see the addon's registration.
  it('waits for DOMContentLoaded when run from a deferred or module script (readyState interactive)', () => {
    setReadyState('interactive');
    const el = mount();
    setupAutoInit(videoOnlyPluginCreators, videoOnlyTypes);
    expect(initialised(el)).toBe(false);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(initialised(el)).toBe(true);
  });

  it('falls back to the load event when DOMContentLoaded has already fired', () => {
    setReadyState('interactive');
    const el = mount();
    setupAutoInit(videoOnlyPluginCreators, videoOnlyTypes);
    expect(initialised(el)).toBe(false);
    window.dispatchEvent(new Event('load'));
    expect(initialised(el)).toBe(true);
    // Only once: a later DOMContentLoaded must not scan again.
    el.removeAttribute('data-scarlett-initialized');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(initialised(el)).toBe(false);
  });

  it('initialises immediately once the document is complete', () => {
    setReadyState('complete');
    const el = mount();
    setupAutoInit(videoOnlyPluginCreators, videoOnlyTypes);
    expect(initialised(el)).toBe(true);
  });
});
