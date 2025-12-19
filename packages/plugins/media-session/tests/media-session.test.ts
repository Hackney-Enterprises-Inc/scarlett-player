/**
 * Tests for Media Session Plugin
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaSessionPlugin, type IMediaSessionPlugin } from '../src/index';

// Mock MediaSession API
const mockSetActionHandler = vi.fn();
const mockSetPositionState = vi.fn();

interface MockMediaSession {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler: typeof mockSetActionHandler;
  setPositionState: typeof mockSetPositionState;
}

const mockMediaSession: MockMediaSession = {
  metadata: null,
  playbackState: 'none',
  setActionHandler: mockSetActionHandler,
  setPositionState: mockSetPositionState,
};

// Mock MediaMetadata
class MockMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: MediaImage[];

  constructor(init: { title?: string; artist?: string; album?: string; artwork?: MediaImage[] }) {
    this.title = init.title || '';
    this.artist = init.artist || '';
    this.album = init.album || '';
    this.artwork = init.artwork || [];
  }
}

// Setup global mocks
const originalNavigator = globalThis.navigator;

function setupMediaSessionMock() {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      ...originalNavigator,
      mediaSession: mockMediaSession,
    },
    writable: true,
    configurable: true,
  });

  // @ts-expect-error - Mock global MediaMetadata
  globalThis.MediaMetadata = MockMediaMetadata;
}

function teardownMediaSessionMock() {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    writable: true,
    configurable: true,
  });
}

// Helper to create mock plugin API
function createMockApi() {
  return {
    container: document.createElement('div'),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    on: vi.fn().mockReturnValue(vi.fn()),
    emit: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn().mockReturnValue(0),
    subscribeToState: vi.fn().mockReturnValue(vi.fn()),
    onDestroy: vi.fn(),
    getPlugin: vi.fn(),
  };
}

describe('createMediaSessionPlugin', () => {
  beforeEach(() => {
    setupMediaSessionMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('creates a plugin with correct metadata', () => {
    const plugin = createMediaSessionPlugin();

    expect(plugin.id).toBe('media-session');
    expect(plugin.name).toBe('Media Session');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('feature');
    expect(plugin.description).toContain('Media Session API');
  });

  it('has required methods', () => {
    const plugin = createMediaSessionPlugin();

    expect(typeof plugin.init).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
    expect(typeof plugin.isSupported).toBe('function');
    expect(typeof plugin.setMetadata).toBe('function');
    expect(typeof plugin.setPlaybackState).toBe('function');
    expect(typeof plugin.setPositionState).toBe('function');
    expect(typeof plugin.setActionHandler).toBe('function');
  });

  it('accepts custom configuration', () => {
    const plugin = createMediaSessionPlugin({
      seekOffset: 15,
      enablePlayPause: false,
      enableSeek: false,
      enableTrackNavigation: false,
    });

    expect(plugin).toBeDefined();
  });
});

describe('isSupported', () => {
  it('returns true when Media Session API is available', () => {
    setupMediaSessionMock();
    const plugin = createMediaSessionPlugin();

    expect(plugin.isSupported()).toBe(true);

    teardownMediaSessionMock();
  });

  it('returns false when Media Session API is not available', () => {
    teardownMediaSessionMock();
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const plugin = createMediaSessionPlugin();

    expect(plugin.isSupported()).toBe(false);
  });
});

describe('init and destroy', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('initializes without error', async () => {
    await expect(plugin.init(mockApi)).resolves.not.toThrow();
    expect(mockApi.logger.info).toHaveBeenCalledWith('Media Session plugin initialized');
  });

  it('sets up action handlers on init', async () => {
    await plugin.init(mockApi);

    expect(mockSetActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('stop', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('seekbackward', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('seekforward', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('seekto', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(mockSetActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
  });

  it('registers event listeners on init', async () => {
    await plugin.init(mockApi);

    expect(mockApi.on).toHaveBeenCalledWith('playback:play', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:pause', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:ended', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:timeupdate', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('media:loadedmetadata', expect.any(Function));
  });

  it('subscribes to state changes', async () => {
    await plugin.init(mockApi);

    expect(mockApi.subscribeToState).toHaveBeenCalled();
  });

  it('registers onDestroy callback', async () => {
    await plugin.init(mockApi);
    expect(mockApi.onDestroy).toHaveBeenCalled();
  });

  it('clears action handlers on destroy', async () => {
    await plugin.init(mockApi);
    vi.clearAllMocks();

    await plugin.destroy();

    expect(mockSetActionHandler).toHaveBeenCalledWith('play', null);
    expect(mockSetActionHandler).toHaveBeenCalledWith('pause', null);
    expect(mockSetActionHandler).toHaveBeenCalledWith('seekbackward', null);
    expect(mockSetActionHandler).toHaveBeenCalledWith('seekforward', null);
  });

  it('clears metadata on destroy', async () => {
    await plugin.init(mockApi);
    await plugin.destroy();

    expect(mockMediaSession.metadata).toBeNull();
  });

  it('resets playback state on destroy', async () => {
    await plugin.init(mockApi);
    await plugin.destroy();

    expect(mockMediaSession.playbackState).toBe('none');
  });

  it('handles missing Media Session API gracefully', async () => {
    teardownMediaSessionMock();
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const unsupportedPlugin = createMediaSessionPlugin();
    const unsupportedApi = createMockApi();

    await expect(unsupportedPlugin.init(unsupportedApi)).resolves.not.toThrow();
    expect(unsupportedApi.logger.info).toHaveBeenCalledWith(
      'Media Session API not supported in this browser'
    );
  });
});

describe('setMetadata', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('updates media metadata', () => {
    plugin.setMetadata({
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
    });

    expect(mockMediaSession.metadata).toBeInstanceOf(MockMediaMetadata);
    expect(mockMediaSession.metadata?.title).toBe('Test Song');
    expect(mockMediaSession.metadata?.artist).toBe('Test Artist');
    expect(mockMediaSession.metadata?.album).toBe('Test Album');
  });

  it('updates artwork', () => {
    plugin.setMetadata({
      title: 'Test',
      artwork: [{ src: 'https://example.com/art.png', sizes: '512x512' }],
    });

    expect(mockMediaSession.metadata?.artwork).toHaveLength(1);
    expect(mockMediaSession.metadata?.artwork[0].src).toBe('https://example.com/art.png');
  });

  it('uses default artwork when none provided', () => {
    const pluginWithDefaults = createMediaSessionPlugin({
      defaultArtwork: [{ src: 'https://example.com/default.png', sizes: '256x256' }],
    });
    pluginWithDefaults.init(mockApi);

    pluginWithDefaults.setMetadata({ title: 'Test' });

    expect(mockMediaSession.metadata?.artwork).toHaveLength(1);
    expect(mockMediaSession.metadata?.artwork[0].src).toBe('https://example.com/default.png');
  });

  it('defaults title to Unknown when not provided', () => {
    plugin.setMetadata({});

    expect(mockMediaSession.metadata?.title).toBe('Unknown');
  });
});

describe('setPlaybackState', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('sets playback state to playing', () => {
    plugin.setPlaybackState('playing');

    expect(mockMediaSession.playbackState).toBe('playing');
  });

  it('sets playback state to paused', () => {
    plugin.setPlaybackState('paused');

    expect(mockMediaSession.playbackState).toBe('paused');
  });

  it('sets playback state to none', () => {
    plugin.setPlaybackState('none');

    expect(mockMediaSession.playbackState).toBe('none');
  });
});

describe('setPositionState', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('sets position state', () => {
    plugin.setPositionState({
      duration: 300,
      position: 60,
      playbackRate: 1,
    });

    expect(mockSetPositionState).toHaveBeenCalledWith({
      duration: 300,
      position: 60,
      playbackRate: 1,
    });
  });
});

describe('setActionHandler', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
    vi.clearAllMocks(); // Clear calls from init
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('sets custom action handler', () => {
    const handler = vi.fn();
    plugin.setActionHandler('play', handler);

    expect(mockSetActionHandler).toHaveBeenCalledWith('play', handler);
  });

  it('clears action handler with null', () => {
    plugin.setActionHandler('pause', null);

    expect(mockSetActionHandler).toHaveBeenCalledWith('pause', null);
  });
});

describe('playback event handling', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;
  let eventCallbacks: Record<string, Function>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();

    eventCallbacks = {};
    mockApi.on.mockImplementation((event: string, cb: Function) => {
      eventCallbacks[event] = cb;
      return vi.fn();
    });

    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('updates playback state to playing on playback:play', () => {
    eventCallbacks['playback:play']();

    expect(mockMediaSession.playbackState).toBe('playing');
  });

  it('updates playback state to paused on playback:pause', () => {
    eventCallbacks['playback:pause']();

    expect(mockMediaSession.playbackState).toBe('paused');
  });

  it('updates playback state to none on playback:ended', () => {
    eventCallbacks['playback:ended']();

    expect(mockMediaSession.playbackState).toBe('none');
  });
});

describe('action handlers', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;
  let actionHandlers: Record<string, Function>;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin({ seekOffset: 10 });
    mockApi = createMockApi();

    actionHandlers = {};
    mockSetActionHandler.mockImplementation((action: string, handler: Function | null) => {
      if (handler) {
        actionHandlers[action] = handler;
      } else {
        delete actionHandlers[action];
      }
    });

    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('play action emits playback:play event', () => {
    actionHandlers['play']();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:play', undefined);
  });

  it('pause action emits playback:pause event', () => {
    actionHandlers['pause']();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
  });

  it('stop action emits pause and seeks to start', () => {
    actionHandlers['stop']();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
  });

  it('seekbackward action seeks back by configured offset', () => {
    mockApi.getState.mockReturnValue(30); // currentTime = 30
    actionHandlers['seekbackward']({});

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 20 });
  });

  it('seekbackward action uses provided offset', () => {
    mockApi.getState.mockReturnValue(30);
    actionHandlers['seekbackward']({ seekOffset: 5 });

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 25 });
  });

  it('seekbackward action clamps to 0', () => {
    mockApi.getState.mockReturnValue(5);
    actionHandlers['seekbackward']({ seekOffset: 10 });

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
  });

  it('seekforward action seeks forward by configured offset', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'currentTime') return 30;
      if (key === 'duration') return 300;
      return 0;
    });
    actionHandlers['seekforward']({});

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 40 });
  });

  it('seekforward action clamps to duration', () => {
    mockApi.getState.mockImplementation((key: string) => {
      if (key === 'currentTime') return 295;
      if (key === 'duration') return 300;
      return 0;
    });
    actionHandlers['seekforward']({ seekOffset: 10 });

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 300 });
  });

  it('seekto action seeks to specified time', () => {
    actionHandlers['seekto']({ seekTime: 120 });

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 120 });
  });

  it('previoustrack action calls playlist.previous when available', () => {
    const mockPlaylist = { previous: vi.fn() };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    actionHandlers['previoustrack']();

    expect(mockPlaylist.previous).toHaveBeenCalled();
  });

  it('previoustrack action seeks to start when no playlist', () => {
    mockApi.getPlugin.mockReturnValue(null);

    actionHandlers['previoustrack']();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
  });

  it('nexttrack action calls playlist.next when available', () => {
    const mockPlaylist = { next: vi.fn() };
    mockApi.getPlugin.mockReturnValue(mockPlaylist);

    actionHandlers['nexttrack']();

    expect(mockPlaylist.next).toHaveBeenCalled();
  });
});

describe('configuration options', () => {
  beforeEach(() => {
    setupMediaSessionMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('does not set play/pause handlers when disabled', async () => {
    const plugin = createMediaSessionPlugin({ enablePlayPause: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    expect(mockSetActionHandler).not.toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockSetActionHandler).not.toHaveBeenCalledWith('pause', expect.any(Function));
  });

  it('does not set seek handlers when disabled', async () => {
    const plugin = createMediaSessionPlugin({ enableSeek: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    expect(mockSetActionHandler).not.toHaveBeenCalledWith('seekbackward', expect.any(Function));
    expect(mockSetActionHandler).not.toHaveBeenCalledWith('seekforward', expect.any(Function));
    expect(mockSetActionHandler).not.toHaveBeenCalledWith('seekto', expect.any(Function));
  });

  it('does not set track navigation handlers when disabled', async () => {
    const plugin = createMediaSessionPlugin({ enableTrackNavigation: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    expect(mockSetActionHandler).not.toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(mockSetActionHandler).not.toHaveBeenCalledWith('nexttrack', expect.any(Function));
  });
});

describe('state subscription', () => {
  let plugin: IMediaSessionPlugin;
  let mockApi: ReturnType<typeof createMockApi>;
  let stateCallback: (event: { key: string; value: unknown }) => void;

  beforeEach(async () => {
    setupMediaSessionMock();
    vi.clearAllMocks();
    plugin = createMediaSessionPlugin();
    mockApi = createMockApi();

    mockApi.subscribeToState.mockImplementation((cb) => {
      stateCallback = cb;
      return vi.fn();
    });

    await plugin.init(mockApi);
  });

  afterEach(() => {
    teardownMediaSessionMock();
  });

  it('updates metadata when title state changes', () => {
    stateCallback({ key: 'title', value: 'New Title' });

    expect(mockMediaSession.metadata?.title).toBe('New Title');
  });

  it('updates artwork when poster state changes', () => {
    stateCallback({ key: 'poster', value: 'https://example.com/poster.jpg' });

    expect(mockMediaSession.metadata?.artwork[0].src).toBe('https://example.com/poster.jpg');
  });
});
