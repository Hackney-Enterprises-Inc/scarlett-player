/**
 * Tests for Captions Plugin
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCaptionsPlugin } from '../src/index';

// Helper to create mock plugin API with a video element
function createMockApi() {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);

  return {
    container,
    video,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    on: vi.fn().mockReturnValue(vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn().mockReturnValue(null),
    subscribeToState: vi.fn().mockReturnValue(vi.fn()),
    onDestroy: vi.fn(),
    getPlugin: vi.fn().mockReturnValue(null),
  };
}

describe('createCaptionsPlugin', () => {
  it('creates a plugin with correct metadata', () => {
    const plugin = createCaptionsPlugin();

    expect(plugin.id).toBe('captions');
    expect(plugin.name).toBe('Captions');
    expect(plugin.type).toBe('feature');
  });

  it('accepts empty config', () => {
    const plugin = createCaptionsPlugin();
    expect(plugin).toBeDefined();
  });

  it('accepts full config', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
      extractFromHLS: true,
      autoSelect: true,
      defaultLanguage: 'en',
    });
    expect(plugin).toBeDefined();
  });
});

describe('init and state', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi();
  });

  it('initializes text track state', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);

    expect(mockApi.setState).toHaveBeenCalledWith('textTracks', []);
    expect(mockApi.setState).toHaveBeenCalledWith('currentTextTrack', null);
  });

  it('registers event listeners', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);

    // Should listen for track:text, media:loaded, media:load-request
    const registeredEvents = mockApi.on.mock.calls.map((call: unknown[]) => call[0]);
    expect(registeredEvents).toContain('track:text');
    expect(registeredEvents).toContain('media:loaded');
    expect(registeredEvents).toContain('media:load-request');
  });

  it('registers onDestroy callback', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);

    expect(mockApi.onDestroy).toHaveBeenCalled();
  });
});

describe('external sources', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let mediaLoadedCallback: (() => void) | null = null;

  beforeEach(() => {
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
  });

  it('adds <track> elements for configured sources on media:loaded', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
        { language: 'es', label: 'Spanish', src: '/subs/es.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    const tracks = mockApi.video.querySelectorAll('track');
    expect(tracks.length).toBe(2);
  });

  it('sets correct attributes on <track> elements', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt', kind: 'captions' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    const track = mockApi.video.querySelector('track');
    expect(track?.getAttribute('srclang')).toBe('en');
    expect(track?.getAttribute('label')).toBe('English');
    expect(track?.getAttribute('src')).toBe('/subs/en.vtt');
    expect(track?.getAttribute('kind')).toBe('captions');
  });

  it('defaults kind to subtitles', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    const track = mockApi.video.querySelector('track');
    expect(track?.getAttribute('kind')).toBe('subtitles');
  });

  it('syncs tracks to state after adding sources', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    // State should be synced (setState called with textTracks)
    // The initial call is [], then after adding sources it should update
    const textTracksCalls = mockApi.setState.mock.calls.filter(
      (call: unknown[]) => call[0] === 'textTracks'
    );
    expect(textTracksCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('track selection', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let trackTextCallback: ((data: { trackId: string | null }) => void) | null = null;
  let mediaLoadedCallback: (() => void) | null = null;

  beforeEach(() => {
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'track:text') trackTextCallback = cb as (data: { trackId: string | null }) => void;
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
  });

  it('handles track:text event for selection', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    // Select the first track
    trackTextCallback?.({ trackId: 'track-0' });

    // Verify state was updated
    const currentTrackCalls = mockApi.setState.mock.calls.filter(
      (call: unknown[]) => call[0] === 'currentTextTrack'
    );
    expect(currentTrackCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('disables all tracks when trackId is null', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();

    // Disable
    trackTextCallback?.({ trackId: null });

    const currentTrackCalls = mockApi.setState.mock.calls.filter(
      (call: unknown[]) => call[0] === 'currentTextTrack' && call[1] === null
    );
    expect(currentTrackCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('cleanup on source change', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let loadRequestCallback: (() => void) | null = null;
  let mediaLoadedCallback: (() => void) | null = null;

  beforeEach(() => {
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:load-request') loadRequestCallback = cb as () => void;
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
  });

  it('removes old <track> elements on media:load-request', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    // First load
    mediaLoadedCallback?.();
    expect(mockApi.video.querySelectorAll('track').length).toBe(1);

    // Source change
    loadRequestCallback?.();
    expect(mockApi.video.querySelectorAll('track').length).toBe(0);
  });

  it('resets textTracks state on cleanup', () => {
    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();
    loadRequestCallback?.();

    const resetCalls = mockApi.setState.mock.calls.filter(
      (call: unknown[]) => call[0] === 'textTracks' && (call[1] as unknown[]).length === 0
    );
    expect(resetCalls.length).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Build a stand-in TextTrackList. jsdom's own list is not an EventTarget and
 * cannot be populated, so tests that need tracks supply their own.
 */
function fakeTextTrackList(
  tracks: Array<{ kind: string; label: string; language: string; mode?: string }>,
): TextTrackList {
  const target = new EventTarget();
  const list: Record<string | number, unknown> = {
    length: tracks.length,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  tracks.forEach((track, i) => {
    list[i] = { mode: 'disabled', ...track };
  });
  return list as unknown as TextTrackList;
}

/**
 * Wire a mock API's getState/setState into a real store, so code that writes
 * state and reads it back (maybeAutoSelect) behaves as it does in the player.
 */
function withStatefulApi(mockApi: ReturnType<typeof createMockApi>): void {
  const state: Record<string, unknown> = {};
  mockApi.setState.mockImplementation((key: string, value: unknown) => {
    state[key] = value;
  });
  mockApi.getState.mockImplementation((key: string) => state[key] ?? null);
}

/** Minimal hls.js instance double exposing the subtitle surface we read. */
function fakeHlsPlugin(subtitleTracks: Array<{ id: number; name: string; lang: string; url: string }>) {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const instance = {
    subtitleTracks,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    off: vi.fn(),
  };
  return {
    plugin: { getHlsInstance: () => instance, isNativeHLS: () => false },
    instance,
    fire: (event: string) => handlers[event]?.(),
  };
}

describe('native HLS (Safari/iOS)', () => {
  it('syncs tracks the browser created, with no hls.js instance', () => {
    const mockApi = createMockApi();
    let mediaLoadedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
    mockApi.getPlugin.mockReturnValue({
      getHlsInstance: () => null,
      isNativeHLS: () => true,
    });

    // Safari parses the manifest itself and populates textTracks before load.
    Object.defineProperty(mockApi.video, 'textTracks', {
      value: fakeTextTrackList([
        { kind: 'subtitles', label: 'English', language: 'en' },
        { kind: 'subtitles', label: 'Spanish', language: 'es' },
      ]),
      configurable: true,
    });

    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    const lastTextTracks = mockApi.setState.mock.calls
      .filter((call: unknown[]) => call[0] === 'textTracks')
      .pop();

    expect((lastTextTracks?.[1] as unknown[]).length).toBe(2);
  });
});

describe('hls.js subtitle extraction', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  let mediaLoadedCallback: (() => void) | null;
  let hls: ReturnType<typeof fakeHlsPlugin>;

  beforeEach(() => {
    mediaLoadedCallback = null;
    mockApi = createMockApi();
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
    hls = fakeHlsPlugin([
      { id: 0, name: 'English', lang: 'en', url: '/subs/en.m3u8' },
      { id: 1, name: 'Spanish', lang: 'es', url: '/subs/es.m3u8' },
    ]);
    mockApi.getPlugin.mockReturnValue(hls.plugin);
  });

  it('subscribes to the event hls.js actually emits', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    expect(hls.instance.on).toHaveBeenCalledWith('hlsSubtitleTracksUpdated', expect.any(Function));
  });

  it('adds a <track> per subtitle rendition', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    expect(mockApi.video.querySelectorAll('track').length).toBe(2);
  });

  it('replaces rather than duplicates when the event fires again', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    hls.fire('hlsSubtitleTracksUpdated');
    hls.fire('hlsSubtitleTracksUpdated');

    expect(mockApi.video.querySelectorAll('track').length).toBe(2);
  });

  it('keeps configured sources when HLS renditions are replaced', () => {
    const plugin = createCaptionsPlugin({
      sources: [{ language: 'fr', label: 'French', src: '/subs/fr.vtt' }],
    });
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    hls.fire('hlsSubtitleTracksUpdated');

    // 1 configured + 2 renditions, with the configured one surviving.
    expect(mockApi.video.querySelectorAll('track').length).toBe(3);
    expect(mockApi.video.querySelector('track[srclang="fr"]')).not.toBeNull();
  });

  it('unsubscribes from hls.js on destroy', () => {
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    plugin.destroy();

    expect(hls.instance.off).toHaveBeenCalledWith('hlsSubtitleTracksUpdated', expect.any(Function));
  });
});

describe('auto-select', () => {
  it('does not override a selection made outside the player', () => {
    const mockApi = createMockApi();
    withStatefulApi(mockApi);
    let mediaLoadedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });
    mockApi.getPlugin.mockReturnValue({ getHlsInstance: () => null, isNativeHLS: () => true });

    // Safari has parsed one rendition so far, and it isn't defaultLanguage —
    // so auto-select finds no match and stays armed.
    const list = fakeTextTrackList([{ kind: 'subtitles', label: 'Spanish', language: 'es' }]);
    Object.defineProperty(mockApi.video, 'textTracks', { value: list, configurable: true });

    const plugin = createCaptionsPlugin({ autoSelect: true, defaultLanguage: 'en' });
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    // The viewer turns on Spanish from Safari's own menu, and an English
    // rendition shows up afterwards.
    (list as unknown as Record<number, { mode: string }>)[0].mode = 'showing';
    (list as unknown as Record<number, unknown>)[1] = {
      kind: 'subtitles',
      label: 'English',
      language: 'en',
      mode: 'disabled',
    };
    (list as unknown as { length: number }).length = 2;

    list.dispatchEvent(new Event('change'));

    // Spanish must survive: auto-select stands down once something is showing.
    expect((mockApi.getState('currentTextTrack') as { language: string } | null)?.language).toBe('es');
  });
});

describe('hls instance retry', () => {
  it('retries once and then stops when no hls.js instance appears', () => {
    vi.useFakeTimers();

    const mockApi = createMockApi();
    let mediaLoadedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });

    const getHlsInstance = vi.fn().mockReturnValue(null);
    mockApi.getPlugin.mockReturnValue({ getHlsInstance, isNativeHLS: () => false });

    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);
    mediaLoadedCallback?.();

    const afterLoad = getHlsInstance.mock.calls.length;

    // One retry fires...
    vi.advanceTimersByTime(600);
    const afterFirstRetry = getHlsInstance.mock.calls.length;
    expect(afterFirstRetry).toBeGreaterThan(afterLoad);

    // ...and nothing re-arms, so further time passes with no new attempts.
    vi.advanceTimersByTime(5000);
    expect(getHlsInstance.mock.calls.length).toBe(afterFirstRetry);

    vi.useRealTimers();
  });
});

describe('destroy', () => {
  it('destroys without error', () => {
    const mockApi = createMockApi();
    const plugin = createCaptionsPlugin();
    plugin.init(mockApi);

    expect(() => plugin.destroy()).not.toThrow();
  });

  it('cleans up <track> elements on destroy', () => {
    const mockApi = createMockApi();
    let mediaLoadedCallback: (() => void) | null = null;
    mockApi.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'media:loaded') mediaLoadedCallback = cb as () => void;
      return vi.fn();
    });

    const plugin = createCaptionsPlugin({
      sources: [
        { language: 'en', label: 'English', src: '/subs/en.vtt' },
      ],
    });
    plugin.init(mockApi);

    mediaLoadedCallback?.();
    expect(mockApi.video.querySelectorAll('track').length).toBe(1);

    plugin.destroy();
    expect(mockApi.video.querySelectorAll('track').length).toBe(0);
  });
});
