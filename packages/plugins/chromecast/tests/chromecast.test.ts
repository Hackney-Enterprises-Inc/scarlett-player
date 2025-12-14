/**
 * Chromecast Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chromecastPlugin, isCastSupported } from '../src/index';
import { resetCastLoader } from '../src/cast-loader';
import type { IPluginAPI } from '@scarlett-player/core';
import type { CastFramework } from '../src/types';

// Mock Cast SDK
const createMockCastSDK = () => {
  const sessionHandlers: Array<(event: any) => void> = [];
  const castStateHandlers: Array<(event: any) => void> = [];
  const remotePlayerHandlers: Array<(event: any) => void> = [];

  const mockSession = {
    getSessionId: vi.fn(() => 'session-123'),
    getCastDevice: vi.fn(() => ({
      friendlyName: 'Living Room TV',
      deviceId: 'device-123',
    })),
    loadMedia: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn(),
    getMediaSession: vi.fn(() => null),
  };

  const mockCastContext = {
    setOptions: vi.fn(),
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'sessionstatechanged') {
        sessionHandlers.push(handler);
      } else if (type === 'caststatechanged') {
        castStateHandlers.push(handler);
      }
    }),
    removeEventListener: vi.fn(),
    requestSession: vi.fn().mockResolvedValue(undefined),
    getCurrentSession: vi.fn(() => mockSession),
    endCurrentSession: vi.fn(),
    getCastState: vi.fn(() => 'NOT_CONNECTED'),
  };

  const mockRemotePlayer = {
    currentTime: 0,
    duration: 100,
    isPaused: true,
    isMediaLoaded: false,
    volumeLevel: 1,
    isMuted: false,
    playerState: 'IDLE',
  };

  const mockRemotePlayerController = {
    addEventListener: vi.fn((type: string, handler: any) => {
      remotePlayerHandlers.push(handler);
    }),
    removeEventListener: vi.fn(),
    playOrPause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolumeLevel: vi.fn(),
    muteOrUnmute: vi.fn(),
  };

  return {
    mockSession,
    mockCastContext,
    mockRemotePlayer,
    mockRemotePlayerController,
    sessionHandlers,
    castStateHandlers,
    remotePlayerHandlers,
    setup: () => {
      (window as any).cast = {
        framework: {
          CastContext: {
            getInstance: () => mockCastContext,
          },
          RemotePlayer: vi.fn(() => mockRemotePlayer),
          RemotePlayerController: vi.fn(() => mockRemotePlayerController),
          CastContextEventType: {
            SESSION_STATE_CHANGED: 'sessionstatechanged',
            CAST_STATE_CHANGED: 'caststatechanged',
          },
          RemotePlayerEventType: {
            ANY_CHANGE: 'anyChanged',
          },
          CastState: {
            NO_DEVICES_AVAILABLE: 'NO_DEVICES_AVAILABLE',
            NOT_CONNECTED: 'NOT_CONNECTED',
            CONNECTING: 'CONNECTING',
            CONNECTED: 'CONNECTED',
          },
          SessionState: {
            NO_SESSION: 'NO_SESSION',
            SESSION_STARTING: 'SESSION_STARTING',
            SESSION_STARTED: 'SESSION_STARTED',
            SESSION_START_FAILED: 'SESSION_START_FAILED',
            SESSION_ENDING: 'SESSION_ENDING',
            SESSION_ENDED: 'SESSION_ENDED',
            SESSION_RESUMED: 'SESSION_RESUMED',
          },
        },
      };
      (window as any).chrome = {
        cast: {
          media: {
            DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845',
            MediaInfo: vi.fn().mockImplementation((id, type) => ({ contentId: id, contentType: type })),
            LoadRequest: vi.fn().mockImplementation((info) => ({ mediaInfo: info, autoplay: false, currentTime: 0 })),
          },
          AutoJoinPolicy: {
            ORIGIN_SCOPED: 'origin_scoped',
          },
        },
      };
    },
  };
};

// Create mock plugin API
const createMockApi = (): { api: IPluginAPI; state: Record<string, unknown>; video: HTMLVideoElement } => {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);

  const state: Record<string, unknown> = {
    currentTime: 30,
    source: { src: 'https://example.com/video.m3u8' },
  };

  const api = {
    pluginId: 'chromecast',
    container,
    getState: vi.fn((key?: string) => (key ? state[key] : state)),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    once: vi.fn(() => () => {}),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getPlugin: vi.fn(),
    addCleanup: vi.fn(),
    runCleanups: vi.fn(),
  } as unknown as IPluginAPI;

  return { api, state, video };
};

describe('Chromecast Plugin', () => {
  let mockSDK: ReturnType<typeof createMockCastSDK>;

  beforeEach(() => {
    resetCastLoader();
    delete (window as any).cast;
    delete (window as any).chrome;

    // Suppress console output
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetCastLoader();
    vi.restoreAllMocks();
  });

  describe('chromecastPlugin()', () => {
    it('should create plugin with correct properties', () => {
      const plugin = chromecastPlugin();

      expect(plugin.id).toBe('chromecast');
      expect(plugin.name).toBe('Chromecast');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.type).toBe('feature');
    });

    describe('init() - non-Chrome browser', () => {
      it('should initialize state to false when not supported', async () => {
        const { api, state } = createMockApi();
        const plugin = chromecastPlugin();

        await plugin.init(api);

        expect(state.chromecastAvailable).toBe(false);
        expect(state.chromecastActive).toBe(false);
      });

      it('should log debug message when not supported', async () => {
        const { api } = createMockApi();
        const plugin = chromecastPlugin();

        await plugin.init(api);

        expect(api.logger.debug).toHaveBeenCalledWith('Chromecast not supported in this browser');
      });
    });

    describe('init() - Chrome browser with SDK', () => {
      beforeEach(() => {
        // Mock Chrome UA
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
          configurable: true,
        });

        mockSDK = createMockCastSDK();
        mockSDK.setup();
      });

      afterEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 jsdom',
          configurable: true,
        });
      });

      it('should initialize Cast API when SDK loads', async () => {
        const { api } = createMockApi();
        const plugin = chromecastPlugin();

        await plugin.init(api);

        expect(mockSDK.mockCastContext.setOptions).toHaveBeenCalled();
        expect(api.logger.debug).toHaveBeenCalledWith('Chromecast plugin initialized');
      });

      it('should set up event listeners', async () => {
        const { api } = createMockApi();
        const plugin = chromecastPlugin();

        await plugin.init(api);

        expect(mockSDK.mockCastContext.addEventListener).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('session management', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      mockSDK = createMockCastSDK();
      mockSDK.setup();
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 jsdom',
        configurable: true,
      });
    });

    it('should call requestSession on castContext', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      await plugin.requestSession();

      expect(mockSDK.mockCastContext.requestSession).toHaveBeenCalled();
    });

    it('should handle session started event', async () => {
      const { api, state, video } = createMockApi();
      const pauseSpy = vi.spyOn(video, 'pause');
      const plugin = chromecastPlugin();

      await plugin.init(api);

      // Simulate session started
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_STARTED',
      });

      expect(state.chromecastActive).toBe(true);
      expect(api.emit).toHaveBeenCalledWith('chromecast:connected', { deviceName: 'Living Room TV' });
      expect(pauseSpy).toHaveBeenCalled();
      expect(mockSDK.mockSession.loadMedia).toHaveBeenCalled();
    });

    it('should handle session ended event', async () => {
      const { api, state, video } = createMockApi();
      const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
      const plugin = chromecastPlugin();

      await plugin.init(api);

      // First connect
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_STARTED',
      });

      // Then disconnect
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_ENDED',
      });

      expect(state.chromecastActive).toBe(false);
      expect(api.emit).toHaveBeenCalledWith('chromecast:disconnected', undefined);
      expect(playSpy).toHaveBeenCalled();
    });

    it('should emit error on session start failure', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_START_FAILED',
      });

      expect(api.emit).toHaveBeenCalledWith('chromecast:error', expect.objectContaining({
        error: expect.any(Error),
      }));
    });

    it('should end session on endSession()', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      // Connect first
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_STARTED',
      });

      plugin.endSession();

      expect(mockSDK.mockSession.endSession).toHaveBeenCalledWith(true);
    });
  });

  describe('cast state changes', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      mockSDK = createMockCastSDK();
      mockSDK.setup();
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 jsdom',
        configurable: true,
      });
    });

    it('should emit available when devices found', async () => {
      const { api, state } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      mockSDK.castStateHandlers[0]?.({
        castState: 'NOT_CONNECTED',
      });

      expect(state.chromecastAvailable).toBe(true);
      expect(api.emit).toHaveBeenCalledWith('chromecast:available', undefined);
    });

    it('should emit unavailable when no devices', async () => {
      const { api, state } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      mockSDK.castStateHandlers[0]?.({
        castState: 'NO_DEVICES_AVAILABLE',
      });

      expect(state.chromecastAvailable).toBe(false);
      expect(api.emit).toHaveBeenCalledWith('chromecast:unavailable', undefined);
    });
  });

  describe('playback control', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      mockSDK = createMockCastSDK();
      mockSDK.setup();
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 jsdom',
        configurable: true,
      });
    });

    it('should proxy play() to remote player', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      plugin.play();

      expect(mockSDK.mockRemotePlayerController.playOrPause).toHaveBeenCalled();
    });

    it('should proxy pause() to remote player when not paused', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      mockSDK.mockRemotePlayer.isPaused = false;
      plugin.pause();

      expect(mockSDK.mockRemotePlayerController.playOrPause).toHaveBeenCalled();
    });

    it('should not call playOrPause on pause() when already paused', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      mockSDK.mockRemotePlayer.isPaused = true;
      plugin.pause();

      expect(mockSDK.mockRemotePlayerController.playOrPause).not.toHaveBeenCalled();
    });

    it('should proxy seek() to remote player', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      plugin.seek(45);

      expect(mockSDK.mockRemotePlayer.currentTime).toBe(45);
      expect(mockSDK.mockRemotePlayerController.seek).toHaveBeenCalled();
    });

    it('should proxy setVolume() to remote player', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      plugin.setVolume(0.5);

      expect(mockSDK.mockRemotePlayer.volumeLevel).toBe(0.5);
      expect(mockSDK.mockRemotePlayerController.setVolumeLevel).toHaveBeenCalled();
    });

    it('should clamp volume to 0-1', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      plugin.setVolume(-0.5);
      expect(mockSDK.mockRemotePlayer.volumeLevel).toBe(0);

      plugin.setVolume(1.5);
      expect(mockSDK.mockRemotePlayer.volumeLevel).toBe(1);
    });

    it('should proxy setMuted() to remote player', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      mockSDK.mockRemotePlayer.isMuted = false;
      plugin.setMuted(true);

      expect(mockSDK.mockRemotePlayerController.muteOrUnmute).toHaveBeenCalled();
    });
  });

  describe('state getters', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      mockSDK = createMockCastSDK();
      mockSDK.setup();
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 jsdom',
        configurable: true,
      });
    });

    it('should return isAvailable from state', async () => {
      const { api, state } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      state.chromecastAvailable = true;

      expect(plugin.isAvailable()).toBe(true);
    });

    it('should return isConnected from state', async () => {
      const { api, state } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      state.chromecastActive = true;

      expect(plugin.isConnected()).toBe(true);
    });

    it('should return device name when connected', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      // Connect
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_STARTED',
      });

      expect(plugin.getDeviceName()).toBe('Living Room TV');
    });

    it('should return null device name when not connected', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      expect(plugin.getDeviceName()).toBeNull();
    });
  });

  describe('destroy()', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      mockSDK = createMockCastSDK();
      mockSDK.setup();
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 jsdom',
        configurable: true,
      });
    });

    it('should end session on destroy', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);

      // Connect first
      mockSDK.sessionHandlers[0]?.({
        sessionState: 'SESSION_STARTED',
      });

      await plugin.destroy();

      expect(mockSDK.mockSession.endSession).toHaveBeenCalledWith(true);
    });

    it('should remove event listeners on destroy', async () => {
      const { api } = createMockApi();
      const plugin = chromecastPlugin();

      await plugin.init(api);
      await plugin.destroy();

      expect(mockSDK.mockCastContext.removeEventListener).toHaveBeenCalled();
      expect(mockSDK.mockRemotePlayerController.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('should not throw when methods called before init', () => {
      const plugin = chromecastPlugin();

      expect(() => plugin.requestSession()).not.toThrow();
      expect(() => plugin.endSession()).not.toThrow();
      expect(() => plugin.play()).not.toThrow();
      expect(() => plugin.pause()).not.toThrow();
      expect(() => plugin.seek(10)).not.toThrow();
      expect(() => plugin.setVolume(0.5)).not.toThrow();
      expect(() => plugin.setMuted(true)).not.toThrow();
    });
  });
});
