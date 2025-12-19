/**
 * Tests for Playlist Plugin
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlaylistPlugin, type PlaylistTrack, type IPlaylistPlugin } from '../src/index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

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

// Sample tracks for testing
const sampleTracks: PlaylistTrack[] = [
  { id: '1', src: 'track1.mp3', title: 'Track 1', artist: 'Artist A' },
  { id: '2', src: 'track2.mp3', title: 'Track 2', artist: 'Artist B' },
  { id: '3', src: 'track3.mp3', title: 'Track 3', artist: 'Artist A' },
  { id: '4', src: 'track4.mp3', title: 'Track 4', artist: 'Artist C' },
];

describe('createPlaylistPlugin', () => {
  it('creates a plugin with correct metadata', () => {
    const plugin = createPlaylistPlugin();

    expect(plugin.id).toBe('playlist');
    expect(plugin.name).toBe('Playlist');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('feature');
    expect(plugin.description).toContain('Playlist management');
  });

  it('has required methods', () => {
    const plugin = createPlaylistPlugin();

    expect(typeof plugin.add).toBe('function');
    expect(typeof plugin.insert).toBe('function');
    expect(typeof plugin.remove).toBe('function');
    expect(typeof plugin.clear).toBe('function');
    expect(typeof plugin.play).toBe('function');
    expect(typeof plugin.next).toBe('function');
    expect(typeof plugin.previous).toBe('function');
    expect(typeof plugin.toggleShuffle).toBe('function');
    expect(typeof plugin.setShuffle).toBe('function');
    expect(typeof plugin.cycleRepeat).toBe('function');
    expect(typeof plugin.setRepeat).toBe('function');
    expect(typeof plugin.move).toBe('function');
    expect(typeof plugin.getState).toBe('function');
    expect(typeof plugin.getTracks).toBe('function');
    expect(typeof plugin.getCurrentTrack).toBe('function');
    expect(typeof plugin.getTrack).toBe('function');
  });

  it('accepts initial tracks via config', () => {
    const plugin = createPlaylistPlugin({ tracks: sampleTracks });
    expect(plugin.getTracks()).toHaveLength(4);
  });

  it('generates IDs for tracks without them', () => {
    const trackWithoutId = { src: 'test.mp3', title: 'Test' } as PlaylistTrack;
    const plugin = createPlaylistPlugin({ tracks: [trackWithoutId] });
    const tracks = plugin.getTracks();

    expect(tracks[0].id).toBeDefined();
    expect(tracks[0].id).toMatch(/^track-/);
  });
});

describe('init and destroy', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin();
    mockApi = createMockApi();
  });

  it('initializes without error', async () => {
    await expect(plugin.init(mockApi)).resolves.not.toThrow();
    expect(mockApi.logger.info).toHaveBeenCalledWith('Playlist plugin initialized');
  });

  it('registers playback:ended listener for auto-advance', async () => {
    await plugin.init(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('playback:ended', expect.any(Function));
  });

  it('registers onDestroy callback', async () => {
    await plugin.init(mockApi);
    expect(mockApi.onDestroy).toHaveBeenCalled();
  });

  it('destroys without error', async () => {
    await plugin.init(mockApi);
    await expect(plugin.destroy()).resolves.not.toThrow();
  });
});

describe('add', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin();
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('adds a single track to empty playlist', () => {
    plugin.add(sampleTracks[0]);

    const tracks = plugin.getTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe('Track 1');
  });

  it('adds multiple tracks at once', () => {
    plugin.add(sampleTracks);

    expect(plugin.getTracks()).toHaveLength(4);
  });

  it('appends tracks to existing playlist', () => {
    plugin.add(sampleTracks[0]);
    plugin.add(sampleTracks[1]);

    const tracks = plugin.getTracks();
    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe('Track 1');
    expect(tracks[1].title).toBe('Track 2');
  });

  it('emits playlist:add event', () => {
    plugin.add(sampleTracks[0]);

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:add', expect.objectContaining({
      track: expect.objectContaining({ title: 'Track 1' }),
      index: 0,
    }));
  });

  it('generates ID for track without one', () => {
    const trackWithoutId = { src: 'test.mp3', title: 'Test' } as PlaylistTrack;
    plugin.add(trackWithoutId);

    const tracks = plugin.getTracks();
    expect(tracks[0].id).toBeDefined();
    expect(tracks[0].id).toMatch(/^track-/);
  });
});

describe('insert', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks.slice(0, 3) });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('inserts track at specified position', () => {
    const newTrack: PlaylistTrack = { id: 'new', src: 'new.mp3', title: 'New Track' };
    plugin.insert(1, newTrack);

    const tracks = plugin.getTracks();
    expect(tracks).toHaveLength(4);
    expect(tracks[1].title).toBe('New Track');
    expect(tracks[2].title).toBe('Track 2');
  });

  it('inserts at start when index is 0', () => {
    const newTrack: PlaylistTrack = { id: 'new', src: 'new.mp3', title: 'New Track' };
    plugin.insert(0, newTrack);

    const tracks = plugin.getTracks();
    expect(tracks[0].title).toBe('New Track');
  });

  it('clamps index to valid range', () => {
    const newTrack: PlaylistTrack = { id: 'new', src: 'new.mp3', title: 'New Track' };
    plugin.insert(100, newTrack);

    const tracks = plugin.getTracks();
    expect(tracks[tracks.length - 1].title).toBe('New Track');
  });

  it('adjusts current index when inserting before it', () => {
    plugin.play(1); // Play Track 2
    const newTrack: PlaylistTrack = { id: 'new', src: 'new.mp3', title: 'New Track' };
    plugin.insert(0, newTrack);

    const state = plugin.getState();
    expect(state.currentIndex).toBe(2); // Shifted by 1
    expect(state.currentTrack?.title).toBe('Track 2');
  });
});

describe('remove', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('removes track by index', () => {
    plugin.remove(1);

    const tracks = plugin.getTracks();
    expect(tracks).toHaveLength(3);
    expect(tracks[1].title).toBe('Track 3');
  });

  it('removes track by ID', () => {
    plugin.remove('2');

    const tracks = plugin.getTracks();
    expect(tracks).toHaveLength(3);
    expect(tracks.find(t => t.id === '2')).toBeUndefined();
  });

  it('emits playlist:remove event', () => {
    plugin.remove(0);

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:remove', expect.objectContaining({
      track: expect.objectContaining({ title: 'Track 1' }),
      index: 0,
    }));
  });

  it('warns when track not found by ID', () => {
    plugin.remove('nonexistent');

    expect(mockApi.logger.warn).toHaveBeenCalledWith('Track not found', { id: 'nonexistent' });
  });

  it('warns when index is out of range', () => {
    plugin.remove(100);

    expect(mockApi.logger.warn).toHaveBeenCalledWith('Invalid track index', { index: 100 });
  });

  it('adjusts current index when removing before it', () => {
    plugin.play(2); // Play Track 3
    plugin.remove(0);

    const state = plugin.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.title).toBe('Track 3');
  });
});

describe('clear', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('removes all tracks', () => {
    plugin.clear();

    expect(plugin.getTracks()).toHaveLength(0);
  });

  it('resets current index to -1', () => {
    plugin.play(0);
    plugin.clear();

    const state = plugin.getState();
    expect(state.currentIndex).toBe(-1);
    expect(state.currentTrack).toBeNull();
  });

  it('emits playlist:clear event', () => {
    plugin.clear();

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:clear', undefined);
  });
});

describe('play', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('plays track by index', () => {
    plugin.play(2);

    const state = plugin.getState();
    expect(state.currentIndex).toBe(2);
    expect(state.currentTrack?.title).toBe('Track 3');
  });

  it('plays track by ID', () => {
    plugin.play('3');

    expect(plugin.getCurrentTrack()?.title).toBe('Track 3');
  });

  it('plays first track when called without arguments', () => {
    plugin.play();

    expect(plugin.getState().currentIndex).toBe(0);
  });

  it('resumes current track when called without arguments after playing', () => {
    plugin.play(2);
    plugin.play();

    expect(plugin.getState().currentIndex).toBe(2);
  });

  it('emits playlist:change event', () => {
    plugin.play(0);

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:change', expect.objectContaining({
      track: expect.objectContaining({ title: 'Track 1' }),
      index: 0,
    }));
  });

  it('updates state with track metadata', () => {
    plugin.play(0);

    expect(mockApi.setState).toHaveBeenCalledWith('title', 'Track 1');
    expect(mockApi.setState).toHaveBeenCalledWith('mediaType', 'audio');
  });

  it('warns when playlist is empty', () => {
    plugin.clear();
    plugin.play();

    expect(mockApi.logger.warn).toHaveBeenCalledWith('Playlist is empty');
  });

  it('warns when track not found by ID', () => {
    plugin.play('nonexistent');

    expect(mockApi.logger.warn).toHaveBeenCalledWith('Track not found', { id: 'nonexistent' });
  });
});

describe('next and previous', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
    plugin.play(0);
  });

  it('advances to next track', () => {
    plugin.next();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 2');
  });

  it('goes to previous track', () => {
    plugin.play(2);
    mockApi.getState.mockReturnValue(0); // currentTime = 0
    plugin.previous();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 2');
  });

  it('restarts current track if more than 3 seconds in', () => {
    plugin.play(2);
    mockApi.getState.mockReturnValue(5); // currentTime = 5
    plugin.previous();

    expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
    expect(plugin.getCurrentTrack()?.title).toBe('Track 3');
  });

  it('stops at end of playlist without repeat', () => {
    plugin.play(3); // Last track
    plugin.next();

    expect(mockApi.logger.info).toHaveBeenCalledWith('No next track');
  });

  it('stops at start of playlist without repeat', () => {
    mockApi.getState.mockReturnValue(0);
    plugin.previous();

    expect(mockApi.logger.info).toHaveBeenCalledWith('No previous track');
  });
});

describe('repeat modes', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
    plugin.play(0);
  });

  it('cycles through repeat modes', () => {
    expect(plugin.getState().repeat).toBe('none');

    plugin.cycleRepeat();
    expect(plugin.getState().repeat).toBe('all');

    plugin.cycleRepeat();
    expect(plugin.getState().repeat).toBe('one');

    plugin.cycleRepeat();
    expect(plugin.getState().repeat).toBe('none');
  });

  it('sets repeat mode directly', () => {
    plugin.setRepeat('one');
    expect(plugin.getState().repeat).toBe('one');
  });

  it('emits playlist:repeat event', () => {
    plugin.setRepeat('all');

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:repeat', { mode: 'all' });
  });

  it('loops to first track with repeat all', () => {
    plugin.setRepeat('all');
    plugin.play(3); // Last track
    plugin.next();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 1');
  });

  it('loops to last track with repeat all going backwards', () => {
    plugin.setRepeat('all');
    mockApi.getState.mockReturnValue(0);
    plugin.previous();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 4');
  });

  it('stays on same track with repeat one', () => {
    plugin.setRepeat('one');
    plugin.play(1);
    plugin.next();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 2');
  });
});

describe('shuffle', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('toggles shuffle mode', () => {
    expect(plugin.getState().shuffle).toBe(false);

    plugin.toggleShuffle();
    expect(plugin.getState().shuffle).toBe(true);

    plugin.toggleShuffle();
    expect(plugin.getState().shuffle).toBe(false);
  });

  it('sets shuffle mode directly', () => {
    plugin.setShuffle(true);
    expect(plugin.getState().shuffle).toBe(true);
  });

  it('emits playlist:shuffle event', () => {
    plugin.setShuffle(true);

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:shuffle', { enabled: true });
  });

  it('generates shuffle order when enabled', () => {
    plugin.setShuffle(true);

    const state = plugin.getState();
    expect(state.shuffleOrder).toHaveLength(4);
    // All indices should be present
    expect(state.shuffleOrder.sort()).toEqual([0, 1, 2, 3]);
  });

  it('clears shuffle order when disabled', () => {
    plugin.setShuffle(true);
    plugin.setShuffle(false);

    expect(plugin.getState().shuffleOrder).toHaveLength(0);
  });

  it('keeps current track at front of shuffle order', () => {
    plugin.play(2); // Play Track 3
    plugin.setShuffle(true);

    const state = plugin.getState();
    expect(state.shuffleOrder[0]).toBe(2);
  });
});

describe('move', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('moves track to new position', () => {
    plugin.move(0, 2);

    const tracks = plugin.getTracks();
    expect(tracks[0].title).toBe('Track 2');
    expect(tracks[1].title).toBe('Track 3');
    expect(tracks[2].title).toBe('Track 1');
  });

  it('adjusts current index when moving current track', () => {
    plugin.play(0);
    plugin.move(0, 2);

    expect(plugin.getState().currentIndex).toBe(2);
    expect(plugin.getCurrentTrack()?.title).toBe('Track 1');
  });

  it('adjusts current index when moving track from before to after', () => {
    plugin.play(2);
    plugin.move(0, 3);

    expect(plugin.getState().currentIndex).toBe(1);
    expect(plugin.getCurrentTrack()?.title).toBe('Track 3');
  });

  it('adjusts current index when moving track from after to before', () => {
    plugin.play(1);
    plugin.move(3, 0);

    expect(plugin.getState().currentIndex).toBe(2);
    expect(plugin.getCurrentTrack()?.title).toBe('Track 2');
  });

  it('emits playlist:reorder event', () => {
    plugin.move(0, 2);

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:reorder', expect.objectContaining({
      tracks: expect.any(Array),
    }));
  });

  it('does nothing for same from and to index', () => {
    const tracksBefore = plugin.getTracks().map(t => t.id);
    plugin.move(1, 1);
    const tracksAfter = plugin.getTracks().map(t => t.id);

    expect(tracksAfter).toEqual(tracksBefore);
  });

  it('ignores invalid indices', () => {
    const tracksBefore = plugin.getTracks().map(t => t.id);
    plugin.move(-1, 2);
    plugin.move(0, 100);
    const tracksAfter = plugin.getTracks().map(t => t.id);

    expect(tracksAfter).toEqual(tracksBefore);
  });
});

describe('getState', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('returns complete playlist state', () => {
    plugin.play(1);
    plugin.setShuffle(true);
    plugin.setRepeat('all');

    const state = plugin.getState();

    expect(state.tracks).toHaveLength(4);
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.title).toBe('Track 2');
    expect(state.shuffle).toBe(true);
    expect(state.repeat).toBe('all');
    expect(state.hasNext).toBe(true);
    expect(state.hasPrevious).toBe(true);
  });

  it('returns immutable tracks array', () => {
    const state = plugin.getState();
    state.tracks.push({ id: 'x', src: 'x.mp3' } as PlaylistTrack);

    expect(plugin.getTracks()).toHaveLength(4);
  });
});

describe('getTrack', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('returns track by ID', () => {
    const track = plugin.getTrack('2');

    expect(track?.title).toBe('Track 2');
  });

  it('returns null for unknown ID', () => {
    const track = plugin.getTrack('unknown');

    expect(track).toBeNull();
  });
});

describe('hasNext and hasPrevious', () => {
  let plugin: IPlaylistPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(async () => {
    localStorageMock.clear();
    plugin = createPlaylistPlugin({ tracks: sampleTracks });
    mockApi = createMockApi();
    await plugin.init(mockApi);
  });

  it('hasNext is true in middle of playlist', () => {
    plugin.play(1);

    expect(plugin.getState().hasNext).toBe(true);
  });

  it('hasNext is false at end without repeat', () => {
    plugin.play(3);

    expect(plugin.getState().hasNext).toBe(false);
  });

  it('hasNext is true at end with repeat all', () => {
    plugin.setRepeat('all');
    plugin.play(3);

    expect(plugin.getState().hasNext).toBe(true);
  });

  it('hasPrevious is true in middle of playlist', () => {
    plugin.play(1);

    expect(plugin.getState().hasPrevious).toBe(true);
  });

  it('hasPrevious is false at start without repeat', () => {
    plugin.play(0);

    expect(plugin.getState().hasPrevious).toBe(false);
  });

  it('hasPrevious is true at start with repeat all', () => {
    plugin.setRepeat('all');
    plugin.play(0);

    expect(plugin.getState().hasPrevious).toBe(true);
  });
});

describe('persistence', () => {
  it('saves playlist to localStorage when persist is true', async () => {
    localStorageMock.clear();
    const plugin = createPlaylistPlugin({ persist: true, persistKey: 'test-playlist' });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    plugin.add(sampleTracks[0]);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-playlist',
      expect.any(String)
    );
  });

  it('loads playlist from localStorage on init', async () => {
    localStorageMock.clear();
    const savedData = {
      tracks: [{ id: 'saved', src: 'saved.mp3', title: 'Saved Track' }],
      currentIndex: 0,
      shuffle: true,
      repeat: 'all',
      shuffleOrder: [0],
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

    const plugin = createPlaylistPlugin({ persist: true, persistKey: 'test-playlist' });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    const state = plugin.getState();
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].title).toBe('Saved Track');
    expect(state.shuffle).toBe(true);
    expect(state.repeat).toBe('all');
  });

  it('does not persist when persist is false', async () => {
    localStorageMock.clear();
    vi.clearAllMocks(); // Clear the mock call count
    const plugin = createPlaylistPlugin({ persist: false });
    const mockApi = createMockApi();
    await plugin.init(mockApi);

    plugin.add(sampleTracks[0]);

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

describe('auto-advance', () => {
  it('advances to next track on playback:ended', async () => {
    localStorageMock.clear();
    const plugin = createPlaylistPlugin({ tracks: sampleTracks, autoAdvance: true });
    const mockApi = createMockApi();

    let endedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event, cb) => {
      if (event === 'playback:ended') {
        endedCallback = cb;
      }
      return vi.fn();
    });

    await plugin.init(mockApi);
    plugin.play(0);

    // Simulate playback ended
    endedCallback?.();

    expect(plugin.getCurrentTrack()?.title).toBe('Track 2');
  });

  it('does not auto-advance when disabled', async () => {
    localStorageMock.clear();
    const plugin = createPlaylistPlugin({ tracks: sampleTracks, autoAdvance: false });
    const mockApi = createMockApi();

    let endedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event, cb) => {
      if (event === 'playback:ended') {
        endedCallback = cb;
      }
      return vi.fn();
    });

    await plugin.init(mockApi);
    plugin.play(0);

    endedCallback?.();

    // Should still be on first track
    expect(plugin.getCurrentTrack()?.title).toBe('Track 1');
  });

  it('emits playlist:ended when no more tracks', async () => {
    localStorageMock.clear();
    const plugin = createPlaylistPlugin({ tracks: sampleTracks, autoAdvance: true });
    const mockApi = createMockApi();

    let endedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event, cb) => {
      if (event === 'playback:ended') {
        endedCallback = cb;
      }
      return vi.fn();
    });

    await plugin.init(mockApi);
    plugin.play(3); // Last track

    endedCallback?.();

    expect(mockApi.emit).toHaveBeenCalledWith('playlist:ended', undefined);
  });
});
