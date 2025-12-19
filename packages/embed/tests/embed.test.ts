/**
 * Embed Tests - Player creation and initialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmbedPlayer, initElement, initAll, createScarlettPlayerAPI, type PluginCreators } from '../src/create-embed';
import type { PlayerType } from '../src/types';

// Mock plugins
const mockHLSPlugin = { id: 'hls-provider', name: 'HLS Provider' };
const mockVideoUIPlugin = { id: 'ui', name: 'Video UI Plugin' };
const mockAudioUIPlugin = { id: 'audio-ui', name: 'Audio UI Plugin' };
const mockAnalyticsPlugin = { id: 'analytics', name: 'Analytics Plugin' };
const mockPlaylistPlugin = { id: 'playlist', name: 'Playlist Plugin' };
const mockMediaSessionPlugin = { id: 'media-session', name: 'Media Session Plugin' };

// Mock plugin creators
const fullPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  videoUI: vi.fn(() => mockVideoUIPlugin),
  audioUI: vi.fn(() => mockAudioUIPlugin),
  analytics: vi.fn(() => mockAnalyticsPlugin),
  playlist: vi.fn(() => mockPlaylistPlugin),
  mediaSession: vi.fn(() => mockMediaSessionPlugin),
};

const videoOnlyPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  videoUI: vi.fn(() => mockVideoUIPlugin),
};

const audioOnlyPluginCreators: PluginCreators = {
  hls: vi.fn(() => mockHLSPlugin),
  audioUI: vi.fn(() => mockAudioUIPlugin),
  playlist: vi.fn(() => mockPlaylistPlugin),
  mediaSession: vi.fn(() => mockMediaSessionPlugin),
};

const fullAvailableTypes: PlayerType[] = ['video', 'audio', 'audio-mini'];
const videoOnlyTypes: PlayerType[] = ['video'];
const audioOnlyTypes: PlayerType[] = ['audio', 'audio-mini'];

// Mock the core dependencies
vi.mock('@scarlett-player/core', () => ({
  ScarlettPlayer: vi.fn(),
  createPlayer: vi.fn(async (config) => {
    return {
      container: config.container,
      config,
      destroy: vi.fn(),
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

  it('should always include HLS plugin', async () => {
    await createEmbedPlayer(
      container,
      { src: 'video.m3u8' },
      fullPluginCreators,
      fullAvailableTypes
    );

    expect(fullPluginCreators.hls).toHaveBeenCalled();
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
