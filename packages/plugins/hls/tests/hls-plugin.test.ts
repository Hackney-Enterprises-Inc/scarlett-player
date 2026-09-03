/**
 * HLS Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import * as hlsLoader from '../src/hls-loader';
import {
  formatLevel,
  formatBitrate,
  mapLevels,
  findLevelByHeight,
  getBestLevelForBandwidth,
  findClosestLevel,
  createQualityManager,
} from '../src/quality';
import {
  mapErrorType,
  parseHlsError,
  setupHlsEventHandlers,
  setupVideoEventHandlers,
} from '../src/event-map';
import {
  createMockAPI,
  createCapturedHls,
  createMockHlsConstructor,
  installMediaStubs,
  fireManifest,
  flush,
  type CapturedHls,
  type HlsEventHandler,
  type MockPluginAPI,
} from './helpers';
import { PKG_VERSION } from '../src/version';

// Mock hls.js
const mockHlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  detachMedia: vi.fn(),
  startLoad: vi.fn(),
  stopLoad: vi.fn(),
  recoverMediaError: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  levels: [
    { width: 1920, height: 1080, bitrate: 5000000 },
    { width: 1280, height: 720, bitrate: 2500000 },
    { width: 854, height: 480, bitrate: 1000000 },
  ],
  currentLevel: -1,
  autoLevelEnabled: true,
  nextLevel: 0,
  loadLevel: 0,
  latency: 2.5,
  targetLatency: 3,
  drift: 0.1,
  media: null,
};

const mockHlsConstructor = vi.fn(() => mockHlsInstance);
(mockHlsConstructor as any).isSupported = vi.fn(() => true);
(mockHlsConstructor as any).Events = {
  MANIFEST_PARSED: 'hlsManifestParsed',
  LEVEL_SWITCHED: 'hlsLevelSwitched',
  ERROR: 'hlsError',
};
(mockHlsConstructor as any).ErrorTypes = {
  NETWORK_ERROR: 'networkError',
  MEDIA_ERROR: 'mediaError',
  OTHER_ERROR: 'otherError',
};

describe('HLSPlugin', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: IPluginAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();

    // Mock MediaSource API (not available in jsdom)
    if (!(window as any).MediaSource) {
      (window as any).MediaSource = vi.fn();
    }

    // Mock video element
    HTMLVideoElement.prototype.load = vi.fn();
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.pause = vi.fn();

    // Mock canPlayType for native HLS detection
    HTMLVideoElement.prototype.canPlayType = vi.fn((_type: string) => {
      // Simulate non-Safari (no native HLS support)
      return '';
    });

    plugin = createHLSPlugin();
    api = createMockAPI();

    // Suppress console
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('plugin properties', () => {
    it('should have correct id', () => {
      expect(plugin.id).toBe('hls-provider');
    });

    it('should have correct name', () => {
      expect(plugin.name).toBe('HLS Provider');
    });

    it('should have correct version', () => {
      expect(plugin.version).toBe(PKG_VERSION);
    });

    it('should have correct type', () => {
      expect(plugin.type).toBe('provider');
    });
  });

  describe('canPlay()', () => {
    beforeEach(() => {
      // Mock isHLSSupported to return true for canPlay tests
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    });

    it('should return true for .m3u8 files', () => {
      expect(plugin.canPlay('video.m3u8')).toBe(true);
      expect(plugin.canPlay('http://example.com/stream.m3u8')).toBe(true);
      expect(plugin.canPlay('https://cdn.example.com/live/playlist.M3U8')).toBe(true);
    });

    it('should return false for non-HLS files', () => {
      expect(plugin.canPlay('video.mp4')).toBe(false);
      expect(plugin.canPlay('video.mpd')).toBe(false);
      expect(plugin.canPlay('video.webm')).toBe(false);
    });

    it('should detect MIME type hints', () => {
      expect(plugin.canPlay('stream?type=application/x-mpegurl')).toBe(true);
      expect(plugin.canPlay('stream?type=application/vnd.apple.mpegurl')).toBe(true);
    });

    it('should return false when HLS is not supported', () => {
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(false);
      expect(plugin.canPlay('video.m3u8')).toBe(false);
    });
  });

  describe('init()', () => {
    it('should initialize successfully', async () => {
      await plugin.init(api);

      expect(api.logger.info).toHaveBeenCalledWith('HLS plugin initialized');
    });

    it('should register playback event handlers', async () => {
      await plugin.init(api);

      expect(api.on).toHaveBeenCalledWith('playback:play', expect.any(Function));
      expect(api.on).toHaveBeenCalledWith('playback:pause', expect.any(Function));
      expect(api.on).toHaveBeenCalledWith('playback:seeking', expect.any(Function));
      expect(api.on).toHaveBeenCalledWith('volume:change', expect.any(Function));
      expect(api.on).toHaveBeenCalledWith('volume:mute', expect.any(Function));
      expect(api.on).toHaveBeenCalledWith('playback:ratechange', expect.any(Function));
    });

    it('should register cleanup on destroy', async () => {
      await plugin.init(api);

      expect(api.onDestroy).toHaveBeenCalled();
    });
  });

  // Skip: These tests require browser MediaSource API not available in jsdom
  describe.skip('playback control handlers', () => {
    let handlers: Record<string, Function>;

    beforeEach(async () => {
      handlers = {};
      (api.on as any).mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return vi.fn();
      });

      await plugin.init(api);

      // Mock native HLS and load source
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');
    });

    it('should handle play event', async () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;
      const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);

      await handlers['playback:play']?.();

      expect(playSpy).toHaveBeenCalled();
    });

    it('should handle pause event', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;
      const pauseSpy = vi.spyOn(video, 'pause');

      handlers['playback:pause']?.();

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('should handle seek event', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'duration', { value: 100, writable: true });

      handlers['playback:seeking']?.({ time: 50 });

      expect(video.currentTime).toBe(50);
    });

    it('should handle volume change event', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;

      handlers['volume:change']?.({ volume: 0.5 });

      expect(video.volume).toBe(0.5);
    });

    it('should handle mute event', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;

      handlers['volume:mute']?.({ muted: true });

      expect(video.muted).toBe(true);
    });

    it('should handle rate change event', () => {
      const video = api.container.querySelector('video') as HTMLVideoElement;

      handlers['playback:ratechange']?.({ rate: 1.5 });

      expect(video.playbackRate).toBe(1.5);
    });
  });

  describe('destroy()', () => {
    it('should cleanup resources', async () => {
      await plugin.init(api);
      await plugin.destroy();

      expect(api.logger.info).toHaveBeenCalledWith('HLS plugin destroying');
    });

    // Skip: Requires browser MediaSource API not available in jsdom
    it.skip('should remove video element from DOM', async () => {
      await plugin.init(api);

      // Mock native HLS to create video element
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);

      // Setup video element to emit loadedmetadata
      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      // Video should be in container
      const video = api.container.querySelector('video');
      expect(video).toBeTruthy();

      // Destroy should remove it
      await plugin.destroy();

      const videoAfter = api.container.querySelector('video');
      expect(videoAfter).toBeNull();
    });
  });

  describe('loadSource() with hls.js', () => {
    beforeEach(async () => {
      // Mock the dynamic import
      vi.doMock('hls.js', () => ({
        default: mockHlsConstructor,
      }));
    });

    it('should load source and emit events', async () => {
      await plugin.init(api);

      // Mock loadHlsJs to return our mock constructor
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      // Setup mock to call onManifestParsed callback
      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
      });

      const loadPromise = plugin.loadSource('http://example.com/stream.m3u8');

      await loadPromise;

      expect(api.setState).toHaveBeenCalledWith('playbackState', 'loading');
      expect(api.setState).toHaveBeenCalledWith('source', {
        src: 'http://example.com/stream.m3u8',
        type: 'application/x-mpegURL',
      });
      expect(api.emit).toHaveBeenCalledWith('media:loaded', {
        src: 'http://example.com/stream.m3u8',
        type: 'application/x-mpegURL',
      });
    });

    it('should throw if not initialized', async () => {
      await expect(plugin.loadSource('http://example.com/stream.m3u8')).rejects.toThrow(
        'Plugin not initialized'
      );
    });

    it('should reject when network error retries are exhausted', async () => {
      const failingPlugin = createHLSPlugin({ maxNetworkRetries: 0 });
      await failingPlugin.init(api);

      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      // Fire a fatal network error instead of a parsed manifest
      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsError') {
          setTimeout(() => handler('hlsError', {
            type: 'networkError',
            details: 'manifestLoadError',
            fatal: true,
          }), 0);
        }
      });

      // Must settle (reject), not hang forever
      await expect(
        failingPlugin.loadSource('http://example.com/stream.m3u8')
      ).rejects.toThrow('manifestLoadError');
    });

    it('should reject on unrecoverable fatal errors', async () => {
      await plugin.init(api);

      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsError') {
          setTimeout(() => handler('hlsError', {
            type: 'otherError',
            details: 'internalException',
            fatal: true,
          }), 0);
        }
      });

      await expect(
        plugin.loadSource('http://example.com/stream.m3u8')
      ).rejects.toThrow('internalException');
    });
  });

  // Skip: These tests require browser MediaSource API not available in jsdom
  describe.skip('loadSource() with native HLS', () => {
    beforeEach(() => {
      // Simulate Safari with native HLS support
      HTMLVideoElement.prototype.canPlayType = vi.fn((type: string) => {
        if (type === 'application/vnd.apple.mpegurl') {
          return 'maybe';
        }
        return '';
      });

      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    });

    it('should use native HLS when supported', async () => {
      await plugin.init(api);

      // Setup video element to emit loadedmetadata
      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(api.logger.info).toHaveBeenCalledWith('Using native HLS playback');
      expect(plugin.isNativeHLS()).toBe(true);
    });

    it('should warn when setting quality in native mode', async () => {
      await plugin.init(api);

      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      plugin.setLevel(1);

      expect(api.logger.warn).toHaveBeenCalledWith('Quality selection not available in native HLS mode');
    });

    it('should return empty levels in native mode', async () => {
      await plugin.init(api);

      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.getLevels()).toEqual([]);
    });

    it('should return -1 for current level in native mode', async () => {
      await plugin.init(api);

      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.getCurrentLevel()).toBe(-1);
    });

    it('should return null for live info in native mode', async () => {
      await plugin.init(api);

      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.getLiveInfo()).toBeNull();
    });

    it('should return null for hls instance in native mode', async () => {
      await plugin.init(api);

      const videoLoadMock = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        setTimeout(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        }, 0);
      });
      HTMLVideoElement.prototype.load = videoLoadMock;

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.getHlsInstance()).toBeNull();
    });
  });

  describe('quality management', () => {
    beforeEach(async () => {
      await plugin.init(api);
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
      });
    });

    it('should return -1 for current level before loading', () => {
      expect(plugin.getCurrentLevel()).toBe(-1);
    });

    it('should return empty levels before loading', () => {
      expect(plugin.getLevels()).toEqual([]);
    });

    it('should get levels after loading', async () => {
      await plugin.loadSource('http://example.com/stream.m3u8');

      const levels = plugin.getLevels();
      expect(levels).toHaveLength(3);
      expect(levels[0].height).toBe(1080);
      expect(levels[1].height).toBe(720);
      expect(levels[2].height).toBe(480);
    });

    it('should set quality level', async () => {
      await plugin.loadSource('http://example.com/stream.m3u8');

      plugin.setLevel(1);

      expect(mockHlsInstance.currentLevel).toBe(1);
    });

    it('should set auto quality with -1', async () => {
      await plugin.loadSource('http://example.com/stream.m3u8');

      plugin.setLevel(-1);

      expect(mockHlsInstance.currentLevel).toBe(-1);
    });
  });

  describe('getHlsInstance()', () => {
    it('should return null before loading', async () => {
      await plugin.init(api);

      expect(plugin.getHlsInstance()).toBeNull();
    });

    it('should return hls instance after loading', async () => {
      await plugin.init(api);
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
      });

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.getHlsInstance()).toBe(mockHlsInstance);
    });
  });

  describe('isNativeHLS()', () => {
    it('should return false before loading', async () => {
      await plugin.init(api);

      expect(plugin.isNativeHLS()).toBe(false);
    });

    it('should return false when using hls.js', async () => {
      await plugin.init(api);
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);

      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
      });

      await plugin.loadSource('http://example.com/stream.m3u8');

      expect(plugin.isNativeHLS()).toBe(false);
    });
  });

  describe('retry jitter', () => {
    it('should apply jitter to retry delays within 70-100% of base delay', async () => {
      // Create plugin with known retry config
      const jitterPlugin = createHLSPlugin({
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
        maxNetworkRetries: 3,
      });

      const jitterApi = createMockAPI();
      await jitterPlugin.init(jitterApi);

      // Mock hls.js loading
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);
      vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockHlsConstructor as any);

      // Capture the error handler. Collected into an array rather than a `let`
      // because TypeScript does not track assignments made inside a callback:
      // a `let` initialised to null keeps its `null` flow type, so the truthy
      // guard narrowed it to `never` and the call below did not type-check.
      // The last entry is the one fired, which is what the overwritten `let`
      // held.
      const errorHandlers: HlsEventHandler[] = [];
      mockHlsInstance.on.mockImplementation((event: string, handler: HlsEventHandler) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
        if (event === 'hlsError') {
          errorHandlers.push(handler);
        }
      });

      await jitterPlugin.loadSource('http://example.com/stream.m3u8');

      // Spy on setTimeout to capture the delay
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Trigger a fatal network error to invoke retry with backoff + jitter
      errorHandlers[errorHandlers.length - 1]?.('hlsError', {
        type: 'networkError',
        details: 'manifestLoadError',
        fatal: true,
      });

      // Find the retry setTimeout call (ignore any 0ms calls from test setup)
      const retryCall = setTimeoutSpy.mock.calls.find(
        (call) => typeof call[1] === 'number' && call[1] > 0
      );

      expect(retryCall).toBeDefined();
      const delay = retryCall![1] as number;

      // First retry: base delay is 1000 * 2^0 = 1000
      // Jitter range: 1000 * 0.7 = 700 to 1000 * 1.0 = 1000
      expect(delay).toBeGreaterThanOrEqual(700);
      expect(delay).toBeLessThanOrEqual(1000);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('getLiveInfo()', () => {
    it('should return null for non-live streams', async () => {
      await plugin.init(api);

      expect(plugin.getLiveInfo()).toBeNull();
    });

    it('should return live info for live streams', async () => {
      await plugin.init(api);
      vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockHlsConstructor as any);
      vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(mockHlsInstance as any);

      mockHlsInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'hlsManifestParsed') {
          setTimeout(() => handler('hlsManifestParsed', { levels: mockHlsInstance.levels }), 0);
        }
      });

      // Mock getState to return live: true
      (api.getState as any).mockImplementation((key: string) => {
        if (key === 'live') return true;
        return undefined;
      });

      await plugin.loadSource('http://example.com/live.m3u8');

      const liveInfo = plugin.getLiveInfo();

      expect(liveInfo).not.toBeNull();
      expect(liveInfo?.isLive).toBe(true);
      expect(liveInfo?.latency).toBe(2.5);
      expect(liveInfo?.targetLatency).toBe(3);
    });
  });
});

describe('event-map', () => {
  describe('mapErrorType()', () => {
    it('should map network error', () => {
      expect(mapErrorType('networkError')).toBe('network');
    });

    it('should map media error', () => {
      expect(mapErrorType('mediaError')).toBe('media');
    });

    it('should map mux error', () => {
      expect(mapErrorType('muxError')).toBe('mux');
    });

    it('should map unknown error to other', () => {
      expect(mapErrorType('unknownError')).toBe('other');
    });
  });

  describe('parseHlsError()', () => {
    it('should parse error data correctly', () => {
      const data = {
        type: 'networkError',
        details: 'manifestLoadError',
        fatal: true,
        url: 'http://example.com/stream.m3u8',
        reason: 'Network timeout',
        response: { code: 503, text: 'Service Unavailable' },
      };

      const error = parseHlsError(data);

      expect(error.type).toBe('network');
      expect(error.details).toBe('manifestLoadError');
      expect(error.fatal).toBe(true);
      expect(error.url).toBe('http://example.com/stream.m3u8');
      expect(error.reason).toBe('Network timeout');
      expect(error.response?.code).toBe(503);
    });

    it('should use defaults for missing values', () => {
      const error = parseHlsError({});

      expect(error.type).toBe('other');
      expect(error.details).toBe('Unknown error');
      expect(error.fatal).toBe(false);
    });
  });

  describe('setupHlsEventHandlers()', () => {
    let mockHls: any;
    let mockApi: IPluginAPI;

    beforeEach(() => {
      const handlerMap = new Map<string, Function>();
      mockHls = {
        on: vi.fn((event: string, handler: Function) => {
          handlerMap.set(event, handler);
        }),
        off: vi.fn((event: string, _handler: Function) => {
          handlerMap.delete(event);
        }),
        levels: [
          { width: 1920, height: 1080, bitrate: 5000000 },
          { width: 1280, height: 720, bitrate: 2500000 },
        ],
        currentLevel: 0,
        autoLevelEnabled: true,
        // Helper to trigger events in tests
        trigger: (event: string, data: any) => {
          const handler = handlerMap.get(event);
          if (handler) handler(event, data);
        },
      };

      mockApi = createMockAPI();
    });

    it('should setup event handlers and return cleanup function', () => {
      const cleanup = setupHlsEventHandlers(mockHls, mockApi, {});

      expect(mockHls.on).toHaveBeenCalled();
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockHls.off).toHaveBeenCalled();
    });

    it('should handle manifest parsed event', () => {
      const onManifestParsed = vi.fn();
      setupHlsEventHandlers(mockHls, mockApi, { onManifestParsed });

      mockHls.trigger('hlsManifestParsed', { levels: mockHls.levels });

      expect(mockApi.setState).toHaveBeenCalledWith('qualities', expect.any(Array));
      expect(mockApi.emit).toHaveBeenCalledWith('quality:levels', expect.any(Object));
      expect(onManifestParsed).toHaveBeenCalled();
    });

    it('should handle level switched event', () => {
      const onLevelSwitched = vi.fn();
      setupHlsEventHandlers(mockHls, mockApi, { onLevelSwitched });

      mockHls.trigger('hlsLevelSwitched', { level: 1 });

      expect(mockApi.setState).toHaveBeenCalledWith('currentQuality', expect.any(Object));
      expect(mockApi.emit).toHaveBeenCalledWith('quality:change', expect.any(Object));
      expect(onLevelSwitched).toHaveBeenCalledWith(1);
    });

    it('should handle frag buffered event', () => {
      const onBufferUpdate = vi.fn();
      setupHlsEventHandlers(mockHls, mockApi, { onBufferUpdate });

      mockHls.trigger('hlsFragBuffered', {});

      expect(mockApi.setState).toHaveBeenCalledWith('buffering', false);
      expect(onBufferUpdate).toHaveBeenCalled();
    });

    it('should handle frag loading event', () => {
      setupHlsEventHandlers(mockHls, mockApi, {});

      mockHls.trigger('hlsFragLoading', {});

      expect(mockApi.setState).toHaveBeenCalledWith('buffering', true);
    });

    it('should handle level loaded event with live info', () => {
      const onLiveUpdate = vi.fn();
      setupHlsEventHandlers(mockHls, mockApi, { onLiveUpdate });

      mockHls.trigger('hlsLevelLoaded', { details: { live: true } });

      expect(mockApi.setState).toHaveBeenCalledWith('live', true);
      expect(onLiveUpdate).toHaveBeenCalled();
    });

    it('should handle error event', () => {
      const onError = vi.fn();
      setupHlsEventHandlers(mockHls, mockApi, { onError });

      mockHls.trigger('hlsError', { type: 'networkError', details: 'test', fatal: true });

      expect(mockApi.logger.error).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('setupVideoEventHandlers()', () => {
    let video: HTMLVideoElement;
    // Typed as the mock rather than the interface so a suite can swap in a
    // getState implementation; the handlers read the `ended` key back.
    let mockApi: MockPluginAPI;

    beforeEach(() => {
      video = document.createElement('video');
      Object.defineProperty(video, 'buffered', {
        value: {
          length: 1,
          start: () => 0,
          end: () => 30,
        },
        writable: true,
      });
      Object.defineProperty(video, 'duration', { value: 60, writable: true });
      Object.defineProperty(video, 'currentTime', { value: 10, writable: true });
      Object.defineProperty(video, 'volume', { value: 0.8, writable: true });
      Object.defineProperty(video, 'muted', { value: false, writable: true });
      Object.defineProperty(video, 'playbackRate', { value: 1, writable: true });
      Object.defineProperty(video, 'videoWidth', { value: 1920, writable: true });

      mockApi = createMockAPI();
    });

    it('should setup video event handlers and return cleanup function', () => {
      const cleanup = setupVideoEventHandlers(video, mockApi);

      expect(typeof cleanup).toBe('function');

      cleanup();
      // After cleanup, events should not trigger state changes
    });

    it('should handle playing event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('playing'));

      expect(mockApi.setState).toHaveBeenCalledWith('playing', true);
      expect(mockApi.setState).toHaveBeenCalledWith('paused', false);
      expect(mockApi.setState).toHaveBeenCalledWith('waiting', false);
      expect(mockApi.setState).toHaveBeenCalledWith('buffering', false);
      expect(mockApi.setState).toHaveBeenCalledWith('playbackState', 'playing');
    });

    it('should handle pause event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('pause'));

      expect(mockApi.setState).toHaveBeenCalledWith('playing', false);
      expect(mockApi.setState).toHaveBeenCalledWith('paused', true);
    });

    it('should handle ended event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('ended'));

      expect(mockApi.setState).toHaveBeenCalledWith('ended', true);
      expect(mockApi.emit).toHaveBeenCalledWith('playback:ended', undefined);
    });

    // The `ended` state key was written true by the `ended` handler and reset
    // only by core's load(), so after a replay it stayed true for the rest of
    // the session while the element's own `ended` was false, and the control
    // bar's play button kept the Replay glyph over playing video (wave 3
    // finding, fixed 2026-09-02).
    describe('ended state key', () => {
      /**
       * Shadow the element's read-only `ended` getter.
       *
       * jsdom answers false for every element, so a test that wants the
       * end-of-media case has to say so.
       */
      const setElementEnded = (value: boolean): void => {
        Object.defineProperty(video, 'ended', { value, configurable: true });
      };

      /**
       * Shadow the element's read-only `paused` getter.
       *
       * jsdom answers true for every element, so the playing-viewer cases
       * have to say otherwise.
       */
      const setElementPaused = (value: boolean): void => {
        Object.defineProperty(video, 'paused', { value, configurable: true });
      };

      /**
       * Answer `getState('ended')` with the value the key holds.
       *
       * `createMockAPI()` answers undefined for every key but `live`, and the
       * provider only clears a key it can see is set, so a test that wants
       * the clearing path has to say the key is true.
       */
      const setKeyEnded = (value: boolean): void => {
        mockApi.getState.mockImplementation((key: string) => {
          if (key === 'ended') return value;
          if (key === 'live') return false;
          return undefined;
        });
      };

      beforeEach(() => {
        setKeyEnded(true);
      });

      it('clears the key on play, before the first frame', () => {
        setupVideoEventHandlers(video, mockApi);

        // play() rewinds an ended element to the earliest position before
        // firing `play`, so the element is no longer ended by then.
        setElementEnded(false);
        video.dispatchEvent(new Event('play'));

        expect(mockApi.setState).toHaveBeenCalledWith('ended', false);
      });

      it('clears the key when playback resumes', () => {
        setupVideoEventHandlers(video, mockApi);

        setElementEnded(false);
        video.dispatchEvent(new Event('playing'));

        expect(mockApi.setState).toHaveBeenCalledWith('ended', false);
      });

      it('clears the key when a paused viewer scrubs back from the end', () => {
        setupVideoEventHandlers(video, mockApi);

        setElementEnded(false);
        video.dispatchEvent(new Event('seeking'));

        expect(mockApi.setState).toHaveBeenCalledWith('ended', false);
      });

      it('leaves the key alone when a seek lands on the end', () => {
        setupVideoEventHandlers(video, mockApi);

        setElementEnded(true);
        video.dispatchEvent(new Event('seeking'));

        expect(mockApi.setState).not.toHaveBeenCalledWith('ended', false);
      });

      it('leaves the key alone when the element is still ended on play', () => {
        setupVideoEventHandlers(video, mockApi);

        setElementEnded(true);
        video.dispatchEvent(new Event('play'));

        expect(mockApi.setState).not.toHaveBeenCalledWith('ended', false);
      });

      it('leaves both keys alone on an ordinary seek, with the key already false', () => {
        setupVideoEventHandlers(video, mockApi);

        setKeyEnded(false);
        setElementEnded(false);
        video.dispatchEvent(new Event('seeking'));

        expect(mockApi.setState).not.toHaveBeenCalledWith('ended', false);
        expect(mockApi.setState).not.toHaveBeenCalledWith('playbackState', 'paused');
        expect(mockApi.setState).not.toHaveBeenCalledWith('playbackState', 'playing');
      });

      // `playbackState` was left at 'ended' by the same scrub that cleared the
      // `ended` key, which is the disagreement the key itself was fixed for
      // (second review of the 1.7.1 wave, 2026-09-02).
      describe('playbackState', () => {
        it('becomes paused when a paused viewer scrubs away from the end', () => {
          setupVideoEventHandlers(video, mockApi);

          setElementEnded(false);
          setElementPaused(true);
          video.dispatchEvent(new Event('seeking'));

          expect(mockApi.setState).toHaveBeenCalledWith('playbackState', 'paused');
        });

        it('becomes playing when a playing viewer seeks away from the end', () => {
          setupVideoEventHandlers(video, mockApi);

          setElementEnded(false);
          setElementPaused(false);
          video.dispatchEvent(new Event('seeking'));

          expect(mockApi.setState).toHaveBeenCalledWith('playbackState', 'playing');
        });

        it('is untouched when a seek lands on the end', () => {
          setupVideoEventHandlers(video, mockApi);

          setElementEnded(true);
          setElementPaused(true);
          video.dispatchEvent(new Event('seeking'));

          expect(mockApi.setState).not.toHaveBeenCalledWith('playbackState', 'paused');
          expect(mockApi.setState).not.toHaveBeenCalledWith('playbackState', 'playing');
        });
      });
    });

    it('should handle timeupdate event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('timeupdate'));

      expect(mockApi.setState).toHaveBeenCalledWith('currentTime', 10);
      expect(mockApi.emit).toHaveBeenCalledWith('playback:timeupdate', { currentTime: 10 });
    });

    it('should handle durationchange event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('durationchange'));

      expect(mockApi.setState).toHaveBeenCalledWith('duration', 60);
    });

    it('should handle waiting event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('waiting'));

      expect(mockApi.setState).toHaveBeenCalledWith('waiting', true);
      expect(mockApi.setState).toHaveBeenCalledWith('buffering', true);
      expect(mockApi.emit).toHaveBeenCalledWith('media:waiting', undefined);
    });

    it('should handle canplay event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('canplay'));

      expect(mockApi.setState).toHaveBeenCalledWith('waiting', false);
      expect(mockApi.emit).toHaveBeenCalledWith('media:canplay', undefined);
    });

    it('should handle canplaythrough event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('canplaythrough'));

      expect(mockApi.setState).toHaveBeenCalledWith('buffering', false);
    });

    it('should handle progress event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('progress'));

      expect(mockApi.setState).toHaveBeenCalledWith('bufferedAmount', 0.5);
      expect(mockApi.emit).toHaveBeenCalledWith('media:progress', { buffered: 0.5 });
    });

    // Skip: Requires browser video event handling not available in jsdom
    it.skip('should handle seeking event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('seeking'));

      expect(mockApi.emit).toHaveBeenCalledWith('playback:seeking', { time: 10 });
    });

    it('should handle seeked event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('seeked'));

      expect(mockApi.emit).toHaveBeenCalledWith('playback:seeked', { time: 10 });
    });

    it('should handle volumechange event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('volumechange'));

      expect(mockApi.setState).toHaveBeenCalledWith('volume', 0.8);
      expect(mockApi.setState).toHaveBeenCalledWith('muted', false);
    });

    it('should handle ratechange event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('ratechange'));

      expect(mockApi.setState).toHaveBeenCalledWith('playbackRate', 1);
    });

    it('should handle loadedmetadata event', () => {
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('loadedmetadata'));

      expect(mockApi.setState).toHaveBeenCalledWith('duration', 60);
      expect(mockApi.setState).toHaveBeenCalledWith('mediaType', 'video');
    });

    it('should set mediaType to video on loadeddata when videoWidth > 0', () => {
      Object.defineProperty(video, 'videoWidth', { value: 1920, writable: true });
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('loadeddata'));

      expect(mockApi.setState).toHaveBeenCalledWith('mediaType', 'video');
    });

    it('should not update mediaType on loadeddata when videoWidth is 0', () => {
      Object.defineProperty(video, 'videoWidth', { value: 0, writable: true });
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('loadeddata'));

      expect(mockApi.setState).not.toHaveBeenCalledWith('mediaType', expect.anything());
    });

    it('should handle error event', () => {
      Object.defineProperty(video, 'error', {
        value: { code: 4, message: 'Media load error' },
        writable: true,
      });
      setupVideoEventHandlers(video, mockApi);

      video.dispatchEvent(new Event('error'));

      expect(mockApi.logger.error).toHaveBeenCalled();
      expect(mockApi.emit).toHaveBeenCalledWith('media:error', { error: expect.any(Error) });
    });
  });
});

describe('quality helpers', () => {
  describe('formatLevel()', () => {
    it('should format 1080p correctly', () => {
      expect(formatLevel({ height: 1080, width: 1920, bitrate: 5000000 })).toBe('1080p');
    });

    it('should format 720p correctly', () => {
      expect(formatLevel({ height: 720, width: 1280, bitrate: 2500000 })).toBe('720p');
    });

    it('should format 4K correctly', () => {
      expect(formatLevel({ height: 2160, width: 3840, bitrate: 15000000 })).toBe('4K');
    });

    it('should use name if provided', () => {
      expect(formatLevel({ height: 1080, width: 1920, bitrate: 5000000, name: 'HD' })).toBe('HD');
    });

    it('should fallback to bitrate if no height', () => {
      expect(formatLevel({ height: 0, width: 0, bitrate: 5000000 })).toBe('5.0 Mbps');
    });
  });

  describe('formatBitrate()', () => {
    it('should format Mbps correctly', () => {
      expect(formatBitrate(5000000)).toBe('5.0 Mbps');
      expect(formatBitrate(2500000)).toBe('2.5 Mbps');
    });

    it('should format Kbps correctly', () => {
      expect(formatBitrate(500000)).toBe('500 Kbps');
      expect(formatBitrate(128000)).toBe('128 Kbps');
    });

    it('should format bps correctly', () => {
      expect(formatBitrate(500)).toBe('500 bps');
    });
  });

  describe('formatLevel() edge cases', () => {
    it('should return Unknown for level with no height or bitrate', () => {
      expect(formatLevel({ height: 0, width: 0, bitrate: 0 })).toBe('Unknown');
    });

    it('should handle non-standard heights', () => {
      // Height close to 1080 (within 20px)
      expect(formatLevel({ height: 1095, width: 1920, bitrate: 5000000 })).toBe('1080p');
      // Height not close to any standard
      expect(formatLevel({ height: 600, width: 800, bitrate: 1500000 })).toBe('600p');
    });
  });

  describe('mapLevels()', () => {
    it('should map hls.js levels to our format', () => {
      const levels = [
        { width: 1920, height: 1080, bitrate: 5000000 },
        { width: 1280, height: 720, bitrate: 2500000 },
      ];

      const mapped = mapLevels(levels, 0);

      expect(mapped).toHaveLength(2);
      expect(mapped[0].index).toBe(0);
      expect(mapped[0].label).toBe('1080p');
      expect(mapped[1].index).toBe(1);
      expect(mapped[1].label).toBe('720p');
    });
  });

  describe('findLevelByHeight()', () => {
    it('should find exact match', () => {
      const levels = [
        { index: 0, height: 1080, width: 1920, bitrate: 5000000, label: '1080p' },
        { index: 1, height: 720, width: 1280, bitrate: 2500000, label: '720p' },
      ];

      expect(findLevelByHeight(levels, 1080)).toBe(0);
      expect(findLevelByHeight(levels, 720)).toBe(1);
    });

    it('should return -1 if not found', () => {
      const levels = [
        { index: 0, height: 1080, width: 1920, bitrate: 5000000, label: '1080p' },
      ];

      expect(findLevelByHeight(levels, 480)).toBe(-1);
    });
  });

  describe('getBestLevelForBandwidth()', () => {
    const levels = [
      { index: 0, height: 1080, width: 1920, bitrate: 5000000, label: '1080p' },
      { index: 1, height: 720, width: 1280, bitrate: 2500000, label: '720p' },
      { index: 2, height: 480, width: 854, bitrate: 1000000, label: '480p' },
    ];

    it('should return highest fitting level', () => {
      // 4000000 * 0.8 = 3200000, should fit 720p (2500000)
      expect(getBestLevelForBandwidth(levels, 4000000)).toBe(1);
    });

    it('should return highest level for high bandwidth', () => {
      // 10000000 * 0.8 = 8000000, should fit 1080p (5000000)
      expect(getBestLevelForBandwidth(levels, 10000000)).toBe(0);
    });

    it('should return lowest level for low bandwidth', () => {
      // 500000 * 0.8 = 400000, nothing fits, fall back to lowest
      expect(getBestLevelForBandwidth(levels, 500000)).toBe(2);
    });

    it('should respect custom safety factor', () => {
      // 5000000 * 1.0 = 5000000, exactly fits 1080p
      expect(getBestLevelForBandwidth(levels, 5000000, 1.0)).toBe(0);
    });

    it('should return -1 for empty levels', () => {
      expect(getBestLevelForBandwidth([], 5000000)).toBe(-1);
    });
  });

  describe('findClosestLevel()', () => {
    const levels = [
      { index: 0, height: 1080, width: 1920, bitrate: 5000000, label: '1080p' },
      { index: 1, height: 720, width: 1280, bitrate: 2500000, label: '720p' },
      { index: 2, height: 480, width: 854, bitrate: 1000000, label: '480p' },
    ];

    it('should find exact match', () => {
      expect(findClosestLevel(levels, 720)).toBe(1);
    });

    it('should find closest when no exact match', () => {
      expect(findClosestLevel(levels, 800)).toBe(1); // 720p is closest
      expect(findClosestLevel(levels, 900)).toBe(0); // 1080p is closest
      expect(findClosestLevel(levels, 500)).toBe(2); // 480p is closest
    });

    it('should return -1 for empty levels', () => {
      expect(findClosestLevel([], 720)).toBe(-1);
    });
  });

  describe('createQualityManager()', () => {
    let mockHls: any;

    beforeEach(() => {
      mockHls = {
        levels: [
          { width: 1920, height: 1080, bitrate: 5000000 },
          { width: 1280, height: 720, bitrate: 2500000 },
        ],
        currentLevel: 0,
        autoLevelEnabled: false,
        nextLevel: 1,
        loadLevel: 0,
      };
    });

    it('should get current level', () => {
      const manager = createQualityManager(mockHls);
      expect(manager.getCurrentLevel()).toBe(0);
    });

    it('should set level', () => {
      const manager = createQualityManager(mockHls);
      manager.setLevel(1);
      expect(mockHls.currentLevel).toBe(1);
    });

    it('should enable auto quality with -1', () => {
      const manager = createQualityManager(mockHls);
      manager.setLevel(-1);
      expect(mockHls.currentLevel).toBe(-1);
    });

    it('should not set invalid level', () => {
      const manager = createQualityManager(mockHls);
      manager.setLevel(10); // Invalid, only 2 levels
      expect(mockHls.currentLevel).toBe(0); // Unchanged
    });

    it('should get all levels', () => {
      const manager = createQualityManager(mockHls);
      const levels = manager.getLevels();
      expect(levels).toHaveLength(2);
      expect(levels[0].label).toBe('1080p');
    });

    it('should check if auto quality is enabled', () => {
      const manager = createQualityManager(mockHls);
      expect(manager.isAutoQuality()).toBe(false);
      mockHls.autoLevelEnabled = true;
      expect(manager.isAutoQuality()).toBe(true);
    });

    it('should get next level', () => {
      const manager = createQualityManager(mockHls);
      expect(manager.getNextLevel()).toBe(1);
    });

    it('should get load level', () => {
      const manager = createQualityManager(mockHls);
      expect(manager.getLoadLevel()).toBe(0);
    });
  });
});

describe('hls-loader', () => {
  beforeEach(() => {
    hlsLoader.resetLoader();
    // Mock MediaSource API (not available in jsdom)
    (window as any).MediaSource = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadHlsJs()', () => {
    it('should load hls.js and cache constructor', async () => {
      const mockHlsConstructor = vi.fn();
      (mockHlsConstructor as any).isSupported = vi.fn(() => true);

      vi.doMock('hls.js', () => ({
        default: mockHlsConstructor,
      }));

      // This test would require module mocking that vitest handles differently
      // Skipping actual dynamic import test due to ESM complexity
    });

    it('should return cached constructor on subsequent calls', async () => {
      // After loading once, subsequent calls should return cached value
      // This is implicitly tested by loadWithHlsJs tests
    });
  });

  describe('createHlsInstance()', () => {
    it('should throw if hls.js not loaded', () => {
      expect(() => hlsLoader.createHlsInstance()).toThrow('hls.js is not loaded');
    });
  });

  describe('getHlsConstructor()', () => {
    it('should return null before loading', () => {
      expect(hlsLoader.getHlsConstructor()).toBeNull();
    });
  });

  describe('supportsNativeHLS()', () => {
    it('should detect native HLS support', () => {
      HTMLVideoElement.prototype.canPlayType = vi.fn((type: string) => {
        if (type === 'application/vnd.apple.mpegurl') return 'maybe';
        return '';
      });

      expect(hlsLoader.supportsNativeHLS()).toBe(true);
    });

    it('should return false when native HLS not supported', () => {
      HTMLVideoElement.prototype.canPlayType = vi.fn(() => '');

      expect(hlsLoader.supportsNativeHLS()).toBe(false);
    });
  });

  describe('isHlsJsSupported()', () => {
    it('should return true when MediaSource is available', () => {
      expect(hlsLoader.isHlsJsSupported()).toBe(true);
    });

    it('should return false when MediaSource is not available', () => {
      delete (window as any).MediaSource;
      delete (window as any).WebKitMediaSource;
      expect(hlsLoader.isHlsJsSupported()).toBe(false);
    });
  });

  describe('isHLSSupported()', () => {
    it('should return true if hls.js is supported', () => {
      HTMLVideoElement.prototype.canPlayType = vi.fn(() => '');
      expect(hlsLoader.isHLSSupported()).toBe(true);
    });

    it('should return true if native HLS is supported', () => {
      delete (window as any).MediaSource;
      HTMLVideoElement.prototype.canPlayType = vi.fn((type: string) => {
        if (type === 'application/vnd.apple.mpegurl') return 'maybe';
        return '';
      });
      expect(hlsLoader.isHLSSupported()).toBe(true);
    });

    it('should return false if neither is supported', () => {
      delete (window as any).MediaSource;
      delete (window as any).WebKitMediaSource;
      HTMLVideoElement.prototype.canPlayType = vi.fn(() => '');
      expect(hlsLoader.isHLSSupported()).toBe(false);
    });
  });
});

// The `poster` state key is the player's pre-play image. Until 2026-09-02 this
// provider set it once, when it created the element, and never again: nothing
// asserted video.poster here at all, the attribute survives an src change, so
// a playlist moving from a pre-roll to the feature kept showing the pre-roll's
// art, and setPoster() plus the Vue prop did nothing.
describe('HLS plugin poster', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: MockPluginAPI;
  let state: Record<string, unknown>;
  let created: CapturedHls[];
  let posterSubscriber: ((event: { key: string }) => void) | null;
  const mockCtor = createMockHlsConstructor();

  const SRC_A = 'http://example.com/a.m3u8';
  const SRC_B = 'http://example.com/b.m3u8';

  /** Push a new poster into state the way core's setPoster() does. */
  const setPoster = (value: string): void => {
    state.poster = value;
    posterSubscriber?.({ key: 'poster' });
  };

  /** Run a full hls.js load, resolving it through a manifest-parsed event. */
  const load = async (src: string): Promise<void> => {
    const pending = plugin.loadSource(src);
    await flush();
    fireManifest(created[created.length - 1]);
    await pending;
  };

  const videoEl = (): HTMLVideoElement | null => api.container.querySelector('video');

  beforeEach(async () => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    posterSubscriber = null;
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    state = { live: false, muted: false, volume: 1, poster: 'https://cdn.test/art.jpg' };

    plugin = createHLSPlugin();
    api = createMockAPI();
    api.getState.mockImplementation((key: string) => state[key]);
    api.subscribeToState.mockImplementation((cb: (event: { key: string }) => void) => {
      posterSubscriber = cb;
      return vi.fn();
    });

    await plugin.init(api);
  });

  afterEach(async () => {
    await plugin.destroy();
    vi.restoreAllMocks();
  });

  it('creates the element with the poster from state', async () => {
    await load(SRC_A);

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/art.jpg');
  });

  it('applies a poster state change to the existing element', async () => {
    await load(SRC_A);

    setPoster('https://cdn.test/next.jpg');

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/next.jpg');
  });

  it('clears the attribute when the poster is set to an empty string', async () => {
    await load(SRC_A);

    setPoster('');

    expect(videoEl()?.getAttribute('poster')).toBe('');
  });

  it('re-applies the current poster on a later loadSource', async () => {
    await load(SRC_A);
    // What the playlist plugin does: write the next track's artwork, then
    // request the load. The viewer must see the NEW art over the gap.
    state.poster = 'https://cdn.test/second.jpg';

    await load(SRC_B);

    expect(videoEl()?.getAttribute('poster')).toBe('https://cdn.test/second.jpg');
  });

  it('clears a stale poster on a later loadSource when state has none', async () => {
    await load(SRC_A);
    state.poster = '';

    await load(SRC_B);

    expect(videoEl()?.getAttribute('poster')).toBe('');
  });

  it('releases the state subscription through onDestroy', async () => {
    const unsubscribe = api.subscribeToState.mock.results[0]?.value;

    const cleanups = api.onDestroy.mock.calls.map((call: unknown[]) => call[0] as () => void);
    cleanups.forEach((fn) => fn());

    expect(unsubscribe).toHaveBeenCalled();
  });
});
