/**
 * AirPlay Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { airplayPlugin, isAirPlaySupported } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import type { WebkitVideoElement, WebkitPlaybackTargetAvailabilityEvent } from '../src/types';

// Create a mock video element with webkit APIs
const createMockVideo = (): WebkitVideoElement => {
  const video = document.createElement('video') as WebkitVideoElement;
  video.webkitShowPlaybackTargetPicker = vi.fn();
  video.webkitCurrentPlaybackTargetIsWireless = false;
  return video;
};

// Create a mock plugin API
const createMockApi = (video?: WebkitVideoElement): IPluginAPI => {
  const container = document.createElement('div');
  if (video) {
    container.appendChild(video);
  }

  const state: Record<string, unknown> = {};

  return {
    pluginId: 'airplay',
    container,
    getState: (key?: string) => (key ? state[key] : state),
    setState: (key: string, value: unknown) => {
      state[key] = value;
    },
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
};

describe('AirPlay Plugin', () => {
  let originalWebkitMethod: unknown;

  beforeEach(() => {
    // Store original value
    originalWebkitMethod = (HTMLVideoElement.prototype as WebkitVideoElement)
      .webkitShowPlaybackTargetPicker;

    // Suppress console output
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original value
    (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker =
      originalWebkitMethod as () => void;
    vi.restoreAllMocks();
  });

  describe('isAirPlaySupported()', () => {
    it('should return false in jsdom (no webkit APIs)', () => {
      expect(isAirPlaySupported()).toBe(false);
    });

    it('should return true when webkit API is available', () => {
      (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

      expect(isAirPlaySupported()).toBe(true);
    });
  });

  describe('airplayPlugin()', () => {
    it('should create plugin with correct id and name', () => {
      const plugin = airplayPlugin();

      expect(plugin.id).toBe('airplay');
      expect(plugin.name).toBe('AirPlay');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.type).toBe('feature');
    });

    describe('init()', () => {
      it('should initialize state to false', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(api.getState('airplayAvailable')).toBe(false);
        expect(api.getState('airplayActive')).toBe(false);
      });

      it('should log debug message when not supported', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(api.logger.debug).toHaveBeenCalledWith('AirPlay not supported in this browser');
      });

      it('should warn when no video element found (with webkit support)', async () => {
        // Enable webkit support
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const api = createMockApi(); // No video element
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(api.logger.warn).toHaveBeenCalledWith('No video element found for AirPlay');
      });

      it('should add event listeners when supported and video exists', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const addEventListenerSpy = vi.spyOn(video, 'addEventListener');
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'webkitplaybacktargetavailabilitychanged',
          expect.any(Function)
        );
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'webkitcurrentplaybacktargetiswirelesschanged',
          expect.any(Function)
        );
      });
    });

    describe('destroy()', () => {
      it('should remove event listeners', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const removeEventListenerSpy = vi.spyOn(video, 'removeEventListener');
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);
        await plugin.destroy();

        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'webkitplaybacktargetavailabilitychanged',
          expect.any(Function)
        );
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'webkitcurrentplaybacktargetiswirelesschanged',
          expect.any(Function)
        );
      });
    });

    describe('showPicker()', () => {
      it('should call webkitShowPlaybackTargetPicker when supported', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);
        plugin.showPicker();

        expect(video.webkitShowPlaybackTargetPicker).toHaveBeenCalled();
      });

      it('should warn when no video element', async () => {
        const api = createMockApi(); // No video
        const plugin = airplayPlugin();

        await plugin.init(api);
        plugin.showPicker();

        expect(api.logger.warn).toHaveBeenCalledWith('Cannot show AirPlay picker: no video element');
      });

      it('should warn when no video element (with webkit support)', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const api = createMockApi(); // No video
        const plugin = airplayPlugin();

        await plugin.init(api);
        plugin.showPicker();

        expect(api.logger.warn).toHaveBeenCalledWith('Cannot show AirPlay picker: no video element');
      });
    });

    describe('isAvailable()', () => {
      it('should return false by default', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(plugin.isAvailable()).toBe(false);
      });

      it('should return true when airplayAvailable state is true', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);
        api.setState('airplayAvailable', true);

        expect(plugin.isAvailable()).toBe(true);
      });
    });

    describe('isActive()', () => {
      it('should return false by default', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);

        expect(plugin.isActive()).toBe(false);
      });

      it('should return true when airplayActive state is true', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);
        api.setState('airplayActive', true);

        expect(plugin.isActive()).toBe(true);
      });
    });

    describe('stop()', () => {
      it('should log debug message', async () => {
        const api = createMockApi();
        const plugin = airplayPlugin();

        await plugin.init(api);
        plugin.stop();

        expect(api.logger.debug).toHaveBeenCalledWith(
          'AirPlay stop requested (use system controls to disconnect)'
        );
      });
    });

    describe('event handling', () => {
      it('should update state and emit event on availability change', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);

        // Simulate availability change event
        const availableEvent = new Event('webkitplaybacktargetavailabilitychanged') as WebkitPlaybackTargetAvailabilityEvent;
        (availableEvent as any).availability = 'available';
        video.dispatchEvent(availableEvent);

        expect(api.getState('airplayAvailable')).toBe(true);
        expect(api.emit).toHaveBeenCalledWith('airplay:available', undefined);
      });

      it('should emit unavailable event when availability is not-available', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);

        // Simulate unavailability change event
        const unavailableEvent = new Event('webkitplaybacktargetavailabilitychanged') as WebkitPlaybackTargetAvailabilityEvent;
        (unavailableEvent as any).availability = 'not-available';
        video.dispatchEvent(unavailableEvent);

        expect(api.getState('airplayAvailable')).toBe(false);
        expect(api.emit).toHaveBeenCalledWith('airplay:unavailable', undefined);
      });

      it('should update state and emit event on target change (connected)', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);

        // Simulate connection
        video.webkitCurrentPlaybackTargetIsWireless = true;
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));

        expect(api.getState('airplayActive')).toBe(true);
        expect(api.emit).toHaveBeenCalledWith('airplay:connected', undefined);
      });

      it('should emit disconnected event when not wireless', async () => {
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const video = createMockVideo();
        const api = createMockApi(video);
        const plugin = airplayPlugin();

        await plugin.init(api);

        // First connect
        video.webkitCurrentPlaybackTargetIsWireless = true;
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));

        // Then disconnect
        video.webkitCurrentPlaybackTargetIsWireless = false;
        video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));

        expect(api.getState('airplayActive')).toBe(false);
        expect(api.emit).toHaveBeenCalledWith('airplay:disconnected', undefined);
      });
    });
  });

  describe('graceful degradation', () => {
    it('should not throw errors on non-Safari browsers', async () => {
      const api = createMockApi();
      const plugin = airplayPlugin();

      // Should not throw
      await expect(plugin.init(api)).resolves.toBeUndefined();
      expect(() => plugin.showPicker()).not.toThrow();
      expect(() => plugin.isAvailable()).not.toThrow();
      expect(() => plugin.isActive()).not.toThrow();
      expect(() => plugin.stop()).not.toThrow();
      await expect(plugin.destroy()).resolves.toBeUndefined();
    });
  });
});
