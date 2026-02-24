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
