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

    api.use('share' as never, vi.fn(() => mockSharePlugin));
    expect(creators.share).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Accepted names: chapters, clips'));
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

  it('warns that a use() after players exist applies only to later players', async () => {
    const creators = freshVideoCreators();
    const api = createScarlettPlayerAPI(creators, videoOnlyTypes, '1.0.0', uiFns);
    await api.create({ container, src: 'v.m3u8' });

    api.use('chapters', vi.fn(() => chaptersPlugin));
    expect(creators.chapters).toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('initAll()'));
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

  it('warns in an audio build that captions, chapters and clips need a video build, installing nothing', async () => {
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
    expect(warnings).toHaveLength(3);
    expect(warnings.every((w) => /video build/.test(w))).toBe(true);
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

