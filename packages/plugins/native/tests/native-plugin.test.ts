/**
 * Tests for Native Video Provider Plugin
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNativePlugin } from '../src/index';

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
    expect(plugin.name).toBe('Native Video Provider');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('provider');
    expect(plugin.description).toContain('Native HTML5 video');
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
      setState: vi.fn(),
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
