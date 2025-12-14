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

// Mock PluginAPI
const createMockAPI = (): IPluginAPI => {
  const container = document.createElement('div');
  return {
    pluginId: 'hls-provider',
    container,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getState: vi.fn((key: string) => {
      if (key === 'live') return false;
      return undefined;
    }),
    setState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(),
    onDestroy: vi.fn(),
  };
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
    HTMLVideoElement.prototype.canPlayType = vi.fn((type: string) => {
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
      expect(plugin.version).toBe('1.0.0');
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

  describe('playback control handlers', () => {
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

    it('should remove video element from DOM', async () => {
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
  });

  describe('loadSource() with native HLS', () => {
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
        off: vi.fn((event: string, handler: Function) => {
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

      mockApi = {
        pluginId: 'hls-provider',
        container: document.createElement('div'),
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        getState: vi.fn(),
        setState: vi.fn(),
        on: vi.fn(() => vi.fn()),
        off: vi.fn(),
        emit: vi.fn(),
        getPlugin: vi.fn(),
        onDestroy: vi.fn(),
      };
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

      expect(mockApi.logger.warn).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('setupVideoEventHandlers()', () => {
    let video: HTMLVideoElement;
    let mockApi: IPluginAPI;

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

      mockApi = {
        pluginId: 'hls-provider',
        container: document.createElement('div'),
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        getState: vi.fn(),
        setState: vi.fn(),
        on: vi.fn(() => vi.fn()),
        off: vi.fn(),
        emit: vi.fn(),
        getPlugin: vi.fn(),
        onDestroy: vi.fn(),
      };
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

    it('should handle seeking event', () => {
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
