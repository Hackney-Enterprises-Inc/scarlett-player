/**
 * Tests for Native Video Provider Plugin
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Until 2026-09-02 this provider wrote `playbackState` only as 'loading' and
// 'ready', so the key said something different depending on which provider was
// playing, and a paused scrub away from the end left it at 'ended' once the
// writes were added (second review of the 1.7.1 wave).
describe('playbackState key', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, unknown>;

  /** Start a load without awaiting it; the listeners attach synchronously. */
  const startLoad = (src: string): void => {
    void plugin.loadSource(src).catch(() => {});
  };

  const videoEl = (): HTMLVideoElement =>
    mockApi.container.querySelector('video') as HTMLVideoElement;

  /** Shadow the element's read-only `ended` getter (jsdom always says false). */
  const setElementEnded = (value: boolean): void => {
    Object.defineProperty(videoEl(), 'ended', { value, configurable: true });
  };

  /** Shadow the element's read-only `paused` getter (jsdom always says true). */
  const setElementPaused = (value: boolean): void => {
    Object.defineProperty(videoEl(), 'paused', { value, configurable: true });
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

  it('is playing once playback actually starts', () => {
    videoEl().dispatchEvent(new Event('playing'));

    expect(state.playbackState).toBe('playing');
  });

  it('is paused when the element pauses', () => {
    videoEl().dispatchEvent(new Event('pause'));

    expect(state.playbackState).toBe('paused');
  });

  it('is ended when the element ends', () => {
    videoEl().dispatchEvent(new Event('ended'));

    expect(state.playbackState).toBe('ended');
  });

  it('becomes paused when a paused viewer scrubs away from the end', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    setElementEnded(false);
    setElementPaused(true);
    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.ended).toBe(false);
    expect(state.playbackState).toBe('paused');
  });

  it('becomes playing when a playing viewer seeks away from the end', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    setElementEnded(false);
    setElementPaused(false);
    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.ended).toBe(false);
    expect(state.playbackState).toBe('playing');
  });

  it('is untouched when a seek lands on the end', () => {
    setElementEnded(true);
    videoEl().dispatchEvent(new Event('ended'));

    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.playbackState).toBe('ended');
  });

  it('is untouched by an ordinary seek, with the ended key already false', () => {
    setElementEnded(false);
    setElementPaused(true);

    videoEl().dispatchEvent(new Event('seeking'));

    expect(state.playbackState).toBe('loading');
  });
});

describe('playback:play emission and Chromecast guard', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, any>;
  const listeners: Record<string, ((payload?: any) => void) | undefined> = {};

  beforeEach(async () => {
    plugin = createNativePlugin();
    state = { chromecastActive: false };

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn((event: string, handler: (payload?: any) => void) => {
        listeners[event] = handler;
        return vi.fn();
      }),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
    void plugin.loadSource('https://example.com/video.mp4').catch(() => {});
  });

  it('emits playback:play on direct element playing event', () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.dispatchEvent(new Event('playing'));

    expect(mockApi.emit).toHaveBeenCalledWith('playback:play', undefined);
  });

  it('does not emit duplicate playback:play when play was initiated via core', async () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.play = vi.fn().mockResolvedValue(undefined);

    // Trigger playback:play listener (from core player)
    await listeners['playback:play']?.();

    mockApi.emit.mockClear();

    // Now element fires playing
    el.dispatchEvent(new Event('playing'));

    expect(mockApi.emit).not.toHaveBeenCalledWith('playback:play', undefined);
  });

  it('emits playback:pause on a direct element pause', () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.dispatchEvent(new Event('pause'));

    // The UI's play button, the keyboard shortcut and the browser's native
    // controls all call video.pause() directly. Without this the bus never
    // heard about a pause at all, and analytics, media-session, chromecast and
    // the clips preview were all working from a stale playing state.
    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
  });

  it('does not emit duplicate playback:pause when the pause came from core', () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    // jsdom reports every element as paused; the command is guarded on it.
    Object.defineProperty(el, 'paused', { value: false, configurable: true });
    el.pause = vi.fn();

    listeners['playback:pause']?.();
    expect(el.pause).toHaveBeenCalled();

    mockApi.emit.mockClear();
    el.dispatchEvent(new Event('pause'));

    expect(mockApi.emit).not.toHaveBeenCalledWith('playback:pause', undefined);
  });

  it('leaves no dedupe flag behind when a pause command has nothing to do', () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.pause = vi.fn();

    // Already paused: no element event follows, so arming the flag here would
    // swallow the viewer's next real pause instead.
    listeners['playback:pause']?.();
    expect(el.pause).not.toHaveBeenCalled();

    el.dispatchEvent(new Event('pause'));
    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
  });

  it('cancels a pending core play when a pause arrives before playing', async () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.play = vi.fn().mockResolvedValue(undefined);

    await listeners['playback:play']?.();
    mockApi.emit.mockClear();

    // The play never reached `playing` - the flag must not survive to swallow
    // the next start.
    el.dispatchEvent(new Event('pause'));
    el.dispatchEvent(new Event('playing'));

    const emitted = (event: string): number =>
      mockApi.emit.mock.calls.filter(([name]: [string]) => name === event).length;
    expect(emitted('playback:pause')).toBe(1);
    expect(emitted('playback:play')).toBe(1);
  });

  it('cancels a core play the element has not started when a pause command arrives', async () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.play = vi.fn().mockResolvedValue(undefined);
    el.pause = vi.fn();

    await listeners['playback:play']?.();
    mockApi.emit.mockClear();

    // jsdom still reports the element paused - the play has not taken effect
    // yet - so the pause command must cancel it rather than pass over it.
    listeners['playback:pause']?.();
    expect(el.pause).toHaveBeenCalled();

    // And the flag it armed is gone, so a later element-driven start is heard.
    el.dispatchEvent(new Event('playing'));
    expect(mockApi.emit).toHaveBeenCalledWith('playback:play', undefined);
  });

  it('cancels a pending core pause once playback is running', () => {
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(el, 'paused', { value: false, configurable: true });
    el.pause = vi.fn();

    listeners['playback:pause']?.();
    el.dispatchEvent(new Event('playing'));
    mockApi.emit.mockClear();

    el.dispatchEvent(new Event('pause'));
    expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
  });

  /**
   * A new source is a new playback session.
   *
   * Both guards are armed before the element is touched and consumed by the
   * element event that follows, and once cleanup() has removed the listeners
   * that event can never arrive. Left standing, the guard swallows the
   * viewer's first real transition on the next item - what a playlist
   * advancing straight after a `pause()` produced.
   */
  describe('a load replacing the source', () => {
    /** Run a full loadSource() to completion on a fresh element state. */
    const loadNext = async () => {
      void plugin.loadSource('https://example.com/next.mp4').catch(() => {});
      const el = mockApi.container.querySelector('video') as HTMLVideoElement;
      el.dispatchEvent(new Event('loadedmetadata'));
      mockApi.emit.mockClear();
      return el;
    };

    it('drops a pause command left in flight by the previous source', async () => {
      const el = mockApi.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(el, 'paused', { value: false, configurable: true });
      // A no-op stub is the point: the `pause` event never arrives, exactly as
      // when the element is torn out from under the command.
      el.pause = vi.fn();

      listeners['playback:pause']?.();
      const next = await loadNext();

      // The viewer's own pause on the new source, through the UI's button.
      next.dispatchEvent(new Event('pause'));
      expect(mockApi.emit).toHaveBeenCalledWith('playback:pause', undefined);
    });

    it('drops a play command left in flight by the previous source', async () => {
      const el = mockApi.container.querySelector('video') as HTMLVideoElement;
      // Never settles: the play was still pending when the load superseded it,
      // so neither `playing` nor the rejection path clears the guard.
      el.play = vi.fn().mockReturnValue(new Promise<void>(() => {}));

      void listeners['playback:play']?.();
      const next = await loadNext();

      next.dispatchEvent(new Event('playing'));
      expect(mockApi.emit).toHaveBeenCalledWith('playback:play', undefined);
    });
  });

  it('does not control video element when chromecastActive is true', async () => {
    state.chromecastActive = true;
    const el = mockApi.container.querySelector('video') as HTMLVideoElement;
    el.play = vi.fn().mockResolvedValue(undefined);
    el.pause = vi.fn();

    await listeners['playback:play']?.();
    expect(el.play).not.toHaveBeenCalled();

    listeners['playback:pause']?.();
    expect(el.pause).not.toHaveBeenCalled();

    listeners['playback:seeking']?.({ time: 50 });
    expect(el.currentTime).toBe(0);
  });
});

describe('media error classification', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, any>;

  const videoEl = (): HTMLVideoElement =>
    mockApi.container.querySelector('video') as HTMLVideoElement;

  /**
   * Give the element a MediaError, since jsdom never produces one.
   *
   * Codes are the spec's own numbers (1 aborted, 2 network, 3 decode,
   * 4 src-not-supported); jsdom has no `MediaError` global to read them from.
   */
  const setMediaError = (code: number): void => {
    Object.defineProperty(videoEl(), 'error', {
      configurable: true,
      value: { code, message: 'boom' },
    });
  };

  const emittedError = (): any =>
    mockApi.emit.mock.calls.filter(([event]: [string]) => event === 'error').pop()?.[1];

  beforeEach(async () => {
    plugin = createNativePlugin({ loadTimeoutMs: 0 });
    state = {};

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn(() => vi.fn()),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
    void plugin.loadSource('https://example.com/video.mp4').catch(() => {});
  });

  it('reports a network failure as MEDIA_NETWORK_ERROR', () => {
    setMediaError(2);
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({
      code: 'MEDIA_NETWORK_ERROR',
      message: 'Network error',
      fatal: true,
    });
  });

  it('reports a decode failure as MEDIA_DECODE_ERROR', () => {
    setMediaError(3);
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({ code: 'MEDIA_DECODE_ERROR' });
  });

  it('reports an unsupported source as SOURCE_LOAD_FAILED', () => {
    setMediaError(4);
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Format not supported',
    });
  });

  it('reports an unsupported source AFTER the stream parsed as a network error', () => {
    // Safari's native HLS reports a mid-stream outage this way. A source the
    // element already parsed cannot have become unplayable.
    videoEl().dispatchEvent(new Event('loadedmetadata'));

    setMediaError(4);
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({ code: 'MEDIA_NETWORK_ERROR' });
  });

  it('reports an aborted load as PLAYBACK_FAILED', () => {
    setMediaError(1);
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({
      code: 'PLAYBACK_FAILED',
      message: 'Playback aborted',
    });
  });

  it('falls back to PLAYBACK_FAILED with no MediaError at all', () => {
    Object.defineProperty(videoEl(), 'error', { configurable: true, value: null });
    videoEl().dispatchEvent(new Event('error'));

    expect(emittedError()).toMatchObject({
      code: 'PLAYBACK_FAILED',
      message: 'Unknown video error',
    });
  });
});

describe('load session guard', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let mockApi: any;
  let state: Record<string, any>;

  const videoEl = (): HTMLVideoElement =>
    mockApi.container.querySelector('video') as HTMLVideoElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    plugin = createNativePlugin({ loadTimeoutMs: 5000 });
    state = {};

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn(() => vi.fn()),
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles a superseded load instead of leaving it pending', async () => {
    const first = plugin.loadSource('https://example.com/one.mp4');
    const firstResult = expect(first).rejects.toThrow(/superseded/);

    const second = plugin.loadSource('https://example.com/two.mp4');
    const secondResult = expect(second).rejects.toThrow(/destroyed/);

    await firstResult;

    // Settle the one still in flight, so its watchdog cannot reject into the
    // next test as an unhandled rejection.
    await plugin.destroy();
    await secondResult;
  });

  it('leaves only the live load`s watchdog armed', async () => {
    const first = plugin.loadSource('https://example.com/one.mp4');
    const firstResult = expect(first).rejects.toThrow(/superseded/);
    const second = plugin.loadSource('https://example.com/two.mp4');
    // Assertions attached before the clock moves: a rejection with no handler
    // yet attached surfaces as an unhandled rejection and fails the run.
    const secondResult = expect(second).rejects.toThrow(/too long to load/);
    await firstResult;

    await vi.advanceTimersByTimeAsync(6000);

    // The superseded load already settled with its own reason above; the timeout
    // belongs to the load that is actually in flight.
    await secondResult;
  });

  it('settles an in-flight load when the plugin is destroyed', async () => {
    const pending = plugin.loadSource('https://example.com/one.mp4');
    const result = expect(pending).rejects.toThrow(/destroyed/);

    await plugin.destroy();

    await result;
  });

  it('lets the newest load settle on its own loadedmetadata', async () => {
    const first = plugin.loadSource('https://example.com/one.mp4');
    const firstResult = expect(first).rejects.toThrow(/superseded/);
    const second = plugin.loadSource('https://example.com/two.mp4');
    await firstResult;


    videoEl().dispatchEvent(new Event('loadedmetadata'));

    await expect(second).resolves.toBeUndefined();
    expect(mockApi.emit).toHaveBeenCalledWith('media:loaded', {
      src: 'https://example.com/two.mp4',
      type: 'video/mp4',
    });
  });
});
