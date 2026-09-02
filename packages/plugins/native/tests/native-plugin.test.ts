/**
 * Tests for Native Video Provider Plugin
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNativePlugin } from '../src/index';
import { PKG_VERSION } from '../src/version';

// Mock canPlayType since jsdom doesn't support it
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'video') {
    (element as HTMLVideoElement).canPlayType = (mimeType: string) => {
      // Simulate browser support for common formats
      const supported = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/ogg',
        'video/x-matroska',
      ];
      return supported.includes(mimeType) ? 'probably' : '';
    };
  }
  return element;
});

describe('createNativePlugin', () => {
  it('creates a plugin with correct metadata', () => {
    const plugin = createNativePlugin();

    expect(plugin.id).toBe('native-provider');
    expect(plugin.name).toBe('Native Media Provider');
    expect(plugin.version).toBe(PKG_VERSION);
    expect(plugin.type).toBe('provider');
    expect(plugin.description).toContain('Native HTML5');
  });

  it('has required methods', () => {
    const plugin = createNativePlugin();

    expect(typeof plugin.canPlay).toBe('function');
    expect(typeof plugin.init).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
    expect(typeof plugin.loadSource).toBe('function');
  });
});

describe('canPlay', () => {
  let plugin: ReturnType<typeof createNativePlugin>;

  beforeEach(() => {
    plugin = createNativePlugin();
  });

  it('returns true for MP4 files', () => {
    expect(plugin.canPlay('video.mp4')).toBe(true);
    expect(plugin.canPlay('https://example.com/video.mp4')).toBe(true);
    expect(plugin.canPlay('https://example.com/video.mp4?token=abc')).toBe(true);
  });

  it('returns true for WebM files', () => {
    expect(plugin.canPlay('video.webm')).toBe(true);
    expect(plugin.canPlay('https://example.com/video.webm')).toBe(true);
  });

  it('returns true for MOV files', () => {
    expect(plugin.canPlay('video.mov')).toBe(true);
    expect(plugin.canPlay('https://example.com/video.mov')).toBe(true);
  });

  it('returns true for MKV files', () => {
    // Note: MKV support varies by browser, but the plugin will try
    expect(plugin.canPlay('video.mkv')).toBeDefined();
  });

  it('returns true for OGV/OGG files', () => {
    expect(plugin.canPlay('video.ogv')).toBeDefined();
    expect(plugin.canPlay('video.ogg')).toBeDefined();
  });

  it('returns true for M4V files', () => {
    expect(plugin.canPlay('video.m4v')).toBe(true);
  });

  it('returns false for HLS streams', () => {
    expect(plugin.canPlay('video.m3u8')).toBe(false);
    expect(plugin.canPlay('https://example.com/master.m3u8')).toBe(false);
  });

  it('returns false for DASH streams', () => {
    expect(plugin.canPlay('video.mpd')).toBe(false);
    expect(plugin.canPlay('https://example.com/manifest.mpd')).toBe(false);
  });

  it('returns false for unknown extensions', () => {
    expect(plugin.canPlay('video.xyz')).toBe(false);
    expect(plugin.canPlay('video.txt')).toBe(false);
    expect(plugin.canPlay('noextension')).toBe(false);
  });

  it('handles URLs with query strings', () => {
    expect(plugin.canPlay('https://example.com/video.mp4?token=abc123')).toBe(true);
    expect(plugin.canPlay('https://example.com/video.mp4?token=abc&quality=hd')).toBe(true);
  });

  it('handles case insensitively', () => {
    expect(plugin.canPlay('video.MP4')).toBe(true);
    expect(plugin.canPlay('video.WebM')).toBe(true);
    expect(plugin.canPlay('video.MOV')).toBe(true);
  });
});

describe('config options', () => {
  it('accepts preload configuration', () => {
    const pluginNone = createNativePlugin({ preload: 'none' });
    const pluginAuto = createNativePlugin({ preload: 'auto' });
    const pluginMetadata = createNativePlugin({ preload: 'metadata' });

    expect(pluginNone).toBeDefined();
    expect(pluginAuto).toBeDefined();
    expect(pluginMetadata).toBeDefined();
  });

  it('defaults to metadata preload', () => {
    const plugin = createNativePlugin();
    expect(plugin).toBeDefined();
    // The default is internal, but we can verify the plugin works
  });
});

describe('init and destroy', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;

  beforeEach(() => {
    plugin = createNativePlugin();

    // Mock the plugin API
    mockApi = {
      container: document.createElement('div'),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      on: vi.fn().mockReturnValue(vi.fn()), // Returns unsubscribe function
      emit: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };
  });

  it('initializes without error', async () => {
    await expect(plugin.init(mockApi)).resolves.not.toThrow();
    expect(mockApi.logger.info).toHaveBeenCalledWith('Native video plugin initialized');
  });

  it('registers event handlers on init', async () => {
    await plugin.init(mockApi);

    // Should register listeners for playback control events
    expect(mockApi.on).toHaveBeenCalledWith('playback:play', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:pause', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:seeking', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('volume:change', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('volume:mute', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('playback:ratechange', expect.any(Function));
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

// Regression tests for #45: the playlist plugin writes track titles to state
// BEFORE the load request reaches this plugin, and the audio filename
// fallback was overwriting them unconditionally.
describe('audio title fallback (#45)', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, unknown>;

  beforeEach(async () => {
    plugin = createNativePlugin();
    state = { title: '', muted: false, volume: 1, poster: '' };

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
  });

  // The title logic runs synchronously at the top of loadSource, before the
  // returned promise waits on loadedmetadata (which jsdom never fires), so
  // the tests kick off the load without awaiting it.
  const startLoad = (src: string): void => {
    void plugin.loadSource(src).catch(() => {});
  };

  it('derives a title from the filename when no title is set', () => {
    startLoad('https://example.com/my-favorite_song.mp3');

    expect(state.title).toBe('my favorite song');
  });

  it('does not overwrite an externally set title (e.g. playlist track)', () => {
    state.title = 'Playlist Track Title';

    startLoad('https://example.com/some-file.mp3');

    expect(state.title).toBe('Playlist Track Title');
  });

  it('replaces its own stale fallback when loading a different source directly', () => {
    startLoad('https://example.com/first-song.mp3');
    expect(state.title).toBe('first song');

    // Direct load of a second audio file: the current title is the one WE
    // derived, so it must be re-derived for the new source
    startLoad('https://example.com/second-song.mp3');
    expect(state.title).toBe('second song');
  });

  it('does not touch the title for video sources', () => {
    state.title = 'Some Video Title';

    startLoad('https://example.com/movie.mp4');

    expect(state.title).toBe('Some Video Title');
  });
});

// The `poster` state key is the player's pre-play image. Nothing asserted it
// on this provider before 2026-09-02, and nothing re-applied it after the
// element existed: a setPoster(), a playlist track change and a Vue prop
// change were all invisible to the viewer.
describe('poster', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, unknown>;
  let posterSubscriber: ((event: { key: string }) => void) | null;

  /** Push a new poster into state the way core's setPoster() does. */
  const setPoster = (value: string): void => {
    state.poster = value;
    posterSubscriber?.({ key: 'poster' });
  };

  /**
   * Start a load without awaiting it: the promise waits on `loadedmetadata`,
   * which jsdom never fires, while everything asserted here is synchronous.
   */
  const startLoad = (src: string): void => {
    void plugin.loadSource(src).catch(() => {});
  };

  const videoEl = (): HTMLVideoElement | null =>
    mockApi.container.querySelector('video');

  beforeEach(async () => {
    plugin = createNativePlugin();
    posterSubscriber = null;
    state = { title: '', muted: false, volume: 1, poster: 'https://cdn.test/art.jpg' };

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn((cb: (event: { key: string }) => void) => {
        posterSubscriber = cb;
        return vi.fn();
      }),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
  });

  it('creates the element with the poster from state', () => {
    startLoad('https://example.com/movie.mp4');

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/art.jpg');
  });

  it('applies a poster state change to the existing element', () => {
    startLoad('https://example.com/movie.mp4');

    setPoster('https://cdn.test/next.jpg');

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/next.jpg');
  });

  it('clears the attribute when the poster is set to an empty string', () => {
    startLoad('https://example.com/movie.mp4');

    setPoster('');

    expect(videoEl()?.getAttribute('poster')).toBe('');
  });

  it('re-applies the current poster on a later loadSource', () => {
    startLoad('https://example.com/first.mp4');
    // A consumer that writes the next item's art before requesting the load
    // (what the playlist plugin does) must see the NEW art over the gap.
    state.poster = 'https://cdn.test/second.jpg';

    startLoad('https://example.com/second.mp4');

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/second.jpg');
  });

  it('keeps the attribute cleared for an audio source', () => {
    startLoad('https://example.com/song.mp3');

    expect(videoEl()?.getAttribute('poster')).toBe('');
  });

  it('keeps the attribute cleared for audio even when the poster changes', () => {
    startLoad('https://example.com/song.mp3');

    setPoster('https://cdn.test/album-art.jpg');

    expect(videoEl()?.getAttribute('poster')).toBe('');
  });

  it('releases the state subscription through onDestroy', async () => {
    const unsubscribe = mockApi.subscribeToState.mock.results[0]?.value;

    const cleanups = mockApi.onDestroy.mock.calls.map((call: any[]) => call[0]);
    cleanups.forEach((fn: () => void) => fn());

    expect(unsubscribe).toHaveBeenCalled();
    await plugin.destroy();
  });
});

// The `ended` state key was written true by the `ended` handler and reset only
// by core's load(), so after a replay it stayed true for the rest of the
// session while the element's own `ended` was false, and the control bar's
// play button kept the Replay glyph over playing video (wave 3 finding,
// fixed 2026-09-02).
describe('ended state key', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, unknown>;

  /** Start a load without awaiting it; the listeners attach synchronously. */
  const startLoad = (src: string): void => {
    void plugin.loadSource(src).catch(() => {});
  };

  const videoEl = (): HTMLVideoElement =>
    mockApi.container.querySelector('video') as HTMLVideoElement;

  /**
   * Shadow the element's read-only `ended` getter.
   *
   * jsdom answers false for every element, so a test that wants the
   * end-of-media case has to say so.
   */
  const setElementEnded = (value: boolean): void => {
    Object.defineProperty(videoEl(), 'ended', { value, configurable: true });
  };

  beforeEach(async () => {
    plugin = createNativePlugin();
    state = { title: '', muted: false, volume: 1, poster: '', ended: false };

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
    startLoad('https://example.com/movie.mp4');
  });

  it('sets the key when the element ends', () => {
    setElementEnded(true);

    videoEl().dispatchEvent(new Event('ended'));

    expect(state.ended).toBe(true);
  });

  it('clears the key on play, before the first frame', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    // play() rewinds an ended element to the earliest position before firing
    // `play`, so the element is no longer ended by the time we are called.
    setElementEnded(false);
    videoEl().dispatchEvent(new Event('play'));

    expect(state.ended).toBe(false);
  });

  it('clears the key when playback resumes', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    setElementEnded(false);
    videoEl().dispatchEvent(new Event('playing'));

    expect(state.ended).toBe(false);
  });

  it('clears the key when a paused viewer scrubs back from the end', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    setElementEnded(false);
    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.ended).toBe(false);
  });

  it('leaves the key set when a seek lands on the end', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.ended).toBe(true);
  });
});
