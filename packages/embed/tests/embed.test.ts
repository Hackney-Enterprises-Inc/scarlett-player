/**
 * Embed Tests - Player creation and initialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmbedPlayer, initElement, initAll, create } from '../src/embed';

// Mock the dependencies
vi.mock('@scarlett-player/core', () => ({
  ScarlettPlayer: vi.fn(),
  createPlayer: vi.fn((config) => {
    // Return a mock player instance
    return {
      container: config.container,
      config,
      destroy: vi.fn(),
    };
  }),
}));

vi.mock('@scarlett-player/hls', () => ({
  hlsPlugin: vi.fn(() => ({ id: 'hls-provider', name: 'HLS Provider' })),
}));

vi.mock('@scarlett-player/ui', () => ({
  uiPlugin: vi.fn(() => ({ id: 'ui', name: 'UI Plugin' })),
}));

describe('createEmbedPlayer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player';
    document.body.appendChild(container);

    // Suppress console output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('should create a player with minimal config', () => {
    const player = createEmbedPlayer(container, {
      src: 'https://example.com/video.m3u8',
    });

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should return null when src is missing', () => {
    const player = createEmbedPlayer(container, {});

    expect(player).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No source URL provided')
    );
  });

  it('should apply container styles', () => {
    createEmbedPlayer(container, {
      src: 'video.m3u8',
      width: '640px',
      aspectRatio: '16:9',
    });

    expect(container.style.width).toBe('640px');
    expect(container.style.paddingBottom).toBe('56.25%');
  });

  it('should create player with autoplay and muted', () => {
    const player = createEmbedPlayer(container, {
      src: 'video.m3u8',
      autoplay: true,
      muted: true,
    });

    expect(player?.config.autoplay).toBe(true);
    expect(player?.config.muted).toBe(true);
  });

  it('should create player with poster', () => {
    const player = createEmbedPlayer(container, {
      src: 'video.m3u8',
      poster: 'poster.jpg',
    });

    expect(player?.config.poster).toBe('poster.jpg');
  });

  it('should create player with loop enabled', () => {
    const player = createEmbedPlayer(container, {
      src: 'video.m3u8',
      loop: true,
    });

    expect(player?.config.loop).toBe(true);
  });

  it('should include UI plugin by default', async () => {
    const { uiPlugin } = await import('@scarlett-player/ui');

    createEmbedPlayer(container, {
      src: 'video.m3u8',
    });

    expect(uiPlugin).toHaveBeenCalled();
  });

  it('should exclude UI plugin when controls is false', async () => {
    const { uiPlugin } = await import('@scarlett-player/ui');
    vi.clearAllMocks();

    createEmbedPlayer(container, {
      src: 'video.m3u8',
      controls: false,
    });

    expect(uiPlugin).not.toHaveBeenCalled();
  });

  it('should always include HLS plugin', async () => {
    const { hlsPlugin } = await import('@scarlett-player/hls');

    createEmbedPlayer(container, {
      src: 'video.m3u8',
    });

    expect(hlsPlugin).toHaveBeenCalled();
  });

  it('should pass theme config to UI plugin', async () => {
    const { uiPlugin } = await import('@scarlett-player/ui');
    vi.clearAllMocks();

    createEmbedPlayer(container, {
      src: 'video.m3u8',
      brandColor: '#ff5733',
      primaryColor: '#ffffff',
      backgroundColor: '#000000',
    });

    expect(uiPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: expect.objectContaining({
          accentColor: '#ff5733',
          primaryColor: '#ffffff',
          backgroundColor: '#000000',
        }),
      })
    );
  });

  it('should pass hideDelay to UI plugin', async () => {
    const { uiPlugin } = await import('@scarlett-player/ui');
    vi.clearAllMocks();

    createEmbedPlayer(container, {
      src: 'video.m3u8',
      hideDelay: 5000,
    });

    expect(uiPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        hideDelay: 5000,
      })
    );
  });

  it('should handle player creation errors gracefully', async () => {
    const { createPlayer } = await import('@scarlett-player/core');
    (createPlayer as any).mockImplementationOnce(() => {
      throw new Error('Player creation failed');
    });

    const player = createEmbedPlayer(container, {
      src: 'video.m3u8',
    });

    expect(player).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create player'),
      expect.any(Error)
    );
  });
});

describe('initElement', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.setAttribute('data-src', 'https://example.com/video.m3u8');
    document.body.appendChild(element);

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    element.remove();
    vi.restoreAllMocks();
  });

  it('should initialize player from element', () => {
    const player = initElement(element);

    expect(player).not.toBeNull();
    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should not reinitialize already initialized element', () => {
    const player1 = initElement(element);
    const player2 = initElement(element);

    expect(player1).not.toBeNull();
    expect(player2).toBeNull();
  });

  it('should parse data attributes from element', () => {
    element.setAttribute('data-autoplay', 'true');
    element.setAttribute('data-muted', 'true');

    const player = initElement(element);

    expect(player?.config.autoplay).toBe(true);
    expect(player?.config.muted).toBe(true);
  });

  it('should return null when element has no src', () => {
    const elementNoSrc = document.createElement('div');
    document.body.appendChild(elementNoSrc);

    const player = initElement(elementNoSrc);

    expect(player).toBeNull();

    elementNoSrc.remove();
  });

  it('should mark element as initialized even on failure', async () => {
    const { createPlayer } = await import('@scarlett-player/core');
    (createPlayer as any).mockImplementationOnce(() => {
      throw new Error('Init failed');
    });

    const player = initElement(element);

    expect(player).toBeNull();
    // Element should not be marked as initialized if creation failed
    expect(element.hasAttribute('data-scarlett-initialized')).toBe(false);
  });
});

describe('initAll', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up all created elements
    document.querySelectorAll('[data-scarlett-player], [data-sp], .scarlett-player').forEach((el) => {
      el.remove();
    });
    vi.restoreAllMocks();
  });

  it('should initialize all players with data-scarlett-player', () => {
    const element1 = document.createElement('div');
    element1.setAttribute('data-scarlett-player', '');
    element1.setAttribute('data-src', 'video1.m3u8');

    const element2 = document.createElement('div');
    element2.setAttribute('data-scarlett-player', '');
    element2.setAttribute('data-src', 'video2.m3u8');

    document.body.appendChild(element1);
    document.body.appendChild(element2);

    initAll();

    expect(element1.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(element2.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Initialized 2 player(s)')
    );
  });

  it('should initialize players with data-sp shorthand', () => {
    const element = document.createElement('div');
    element.setAttribute('data-sp', '');
    element.setAttribute('data-src', 'video.m3u8');
    document.body.appendChild(element);

    initAll();

    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should initialize players with class selector', () => {
    const element = document.createElement('div');
    element.classList.add('scarlett-player');
    element.setAttribute('data-src', 'video.m3u8');
    document.body.appendChild(element);

    initAll();

    expect(element.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should not log when no players found', () => {
    initAll();

    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Initialized')
    );
  });

  it('should handle mix of different selectors', () => {
    const element1 = document.createElement('div');
    element1.setAttribute('data-scarlett-player', '');
    element1.setAttribute('data-src', 'video1.m3u8');

    const element2 = document.createElement('div');
    element2.classList.add('scarlett-player');
    element2.setAttribute('data-src', 'video2.m3u8');

    const element3 = document.createElement('div');
    element3.setAttribute('data-sp', '');
    element3.setAttribute('data-src', 'video3.m3u8');

    document.body.appendChild(element1);
    document.body.appendChild(element2);
    document.body.appendChild(element3);

    initAll();

    expect(element1.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(element2.hasAttribute('data-scarlett-initialized')).toBe(true);
    expect(element3.hasAttribute('data-scarlett-initialized')).toBe(true);
  });

  it('should skip elements without src', () => {
    const element = document.createElement('div');
    element.setAttribute('data-scarlett-player', '');
    // No src attribute
    document.body.appendChild(element);

    initAll();

    expect(element.hasAttribute('data-scarlett-initialized')).toBe(false);
  });
});

describe('create', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'player-container';
    document.body.appendChild(container);

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('should create player with HTMLElement container', () => {
    const player = create({
      container,
      src: 'video.m3u8',
    });

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should create player with CSS selector', () => {
    const player = create({
      container: '#player-container',
      src: 'video.m3u8',
    });

    expect(player).not.toBeNull();
    expect(player?.container).toBe(container);
  });

  it('should return null for non-existent selector', () => {
    const player = create({
      container: '#non-existent',
      src: 'video.m3u8',
    });

    expect(player).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Container not found')
    );
  });

  it('should pass all options to createEmbedPlayer', () => {
    const player = create({
      container,
      src: 'video.m3u8',
      autoplay: true,
      muted: true,
      poster: 'poster.jpg',
      brandColor: '#ff5733',
      width: '100%',
      aspectRatio: '16:9',
    });

    expect(player).not.toBeNull();
    expect(player?.config.autoplay).toBe(true);
    expect(player?.config.muted).toBe(true);
    expect(player?.config.poster).toBe('poster.jpg');
  });

  it('should handle creation errors gracefully', () => {
    const player = create({
      container,
      // Missing src - should error
    });

    expect(player).toBeNull();
  });
});
