/**
 * AirPlay Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { airplayPlugin, isAirPlaySupported } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import type { WebkitVideoElement, WebkitPlaybackTargetAvailabilityEvent } from '../src/types';
import { PKG_VERSION } from '../src/version';

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
      expect(plugin.version).toBe(PKG_VERSION);
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

      it('should log debug when no video element found (with webkit support)', async () => {
        // Enable webkit support
        (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();

        const api = createMockApi(); // No video element
        const plugin = airplayPlugin();

        await plugin.init(api);

        // Implementation uses debug logging for missing video during init
        expect(api.logger.debug).toHaveBeenCalledWith('AirPlay: No video element yet');
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

      it('should warn when no video element (with webkit support)', async () => {
        // Must enable webkit support to get past isAirPlaySupported() check
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

/**
 * Install a fake Remote Playback API on an element.
 *
 * `HTMLMediaElement.remote` is a read-only accessor in lib.dom and absent in
 * jsdom, so it has to be defined as an own property rather than assigned.
 */
function stubRemote(video: HTMLVideoElement, remote: unknown): void {
  Object.defineProperty(video, 'remote', { configurable: true, value: remote });
}

describe('AirPlay Plugin - provider swaps and picker safety', () => {
  let originalWebkitMethod: unknown;
  let loadedHandlers: Array<() => void>;

  const createApi = (
    container: HTMLElement,
    hlsPlugin?: unknown
  ): IPluginAPI => {
    const state: Record<string, unknown> = {};

    return {
      pluginId: 'airplay',
      container,
      getState: (key: string) => state[key],
      setState: (key: string, value: unknown) => {
        state[key] = value;
      },
      emit: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'media:loaded') loadedHandlers.push(handler);
        return () => {};
      }),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getPlugin: vi.fn((id: string) => (id === 'hls-provider' ? hlsPlugin : null)),
    } as unknown as IPluginAPI;
  };

  const emitLoaded = (): void => loadedHandlers.forEach((h) => h());

  beforeEach(() => {
    loadedHandlers = [];
    originalWebkitMethod = (HTMLVideoElement.prototype as WebkitVideoElement)
      .webkitShowPlaybackTargetPicker;
    (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker = vi.fn();
  });

  afterEach(() => {
    (HTMLVideoElement.prototype as WebkitVideoElement).webkitShowPlaybackTargetPicker =
      originalWebkitMethod as never;
    vi.restoreAllMocks();
  });

  it('re-attaches when the provider replaces the video element', async () => {
    const container = document.createElement('div');
    const first = createMockVideo();
    container.appendChild(first);

    const api = createApi(container);
    const plugin = airplayPlugin();
    await plugin.init(api);

    // A provider swap: the old element goes, a new one takes its place.
    const second = createMockVideo();
    const removeSpy = vi.spyOn(first, 'removeEventListener');
    const addSpy = vi.spyOn(second, 'addEventListener');
    first.remove();
    container.appendChild(second);

    emitLoaded();

    expect(removeSpy).toHaveBeenCalledWith(
      'webkitcurrentplaybacktargetiswirelesschanged',
      expect.any(Function)
    );
    expect(addSpy).toHaveBeenCalledWith(
      'webkitcurrentplaybacktargetiswirelesschanged',
      expect.any(Function)
    );

    // Availability now comes from the new element.
    second.dispatchEvent(
      Object.assign(new Event('webkitplaybacktargetavailabilitychanged'), {
        availability: 'available',
      })
    );
    expect(plugin.isAvailable()).toBe(true);
  });

  it('does not detach and re-attach when the element is unchanged', async () => {
    const container = document.createElement('div');
    const video = createMockVideo();
    container.appendChild(video);

    const api = createApi(container);
    const plugin = airplayPlugin();
    await plugin.init(api);

    const removeSpy = vi.spyOn(video, 'removeEventListener');
    emitLoaded();

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('opens the picker without switching to native HLS first', async () => {
    const container = document.createElement('div');
    const video = createMockVideo();
    container.appendChild(video);

    const switchToNative = vi.fn().mockResolvedValue(undefined);
    const api = createApi(container, {
      isNativeHLS: () => false,
      switchToNative,
      switchToHlsJs: vi.fn().mockResolvedValue(undefined),
    });

    const plugin = airplayPlugin();
    await plugin.init(api);
    await plugin.showPicker();

    // Cancelling the picker must leave the viewer exactly where they were.
    expect(switchToNative).not.toHaveBeenCalled();
    expect(video.webkitShowPlaybackTargetPicker).toHaveBeenCalled();
  });

  it('switches to native HLS once a device actually connects', async () => {
    const container = document.createElement('div');
    const video = createMockVideo();
    container.appendChild(video);

    const switchToNative = vi.fn().mockResolvedValue(undefined);
    const api = createApi(container, {
      isNativeHLS: () => false,
      switchToNative,
      switchToHlsJs: vi.fn().mockResolvedValue(undefined),
    });

    const plugin = airplayPlugin();
    await plugin.init(api);
    await plugin.showPicker();

    video.webkitCurrentPlaybackTargetIsWireless = true;
    video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));

    expect(switchToNative).toHaveBeenCalledTimes(1);
    expect(plugin.isActive()).toBe(true);
  });

  it('cancels the remote-playback watch on destroy', async () => {
    const container = document.createElement('div');
    const video = createMockVideo();
    const cancelWatchAvailability = vi.fn().mockResolvedValue(undefined);
    stubRemote(video, {
      watchAvailability: vi.fn().mockResolvedValue(7),
      cancelWatchAvailability,
    });
    container.appendChild(video);

    const api = createApi(container);
    const plugin = airplayPlugin();
    await plugin.init(api);

    // Let watchAvailability() resolve so the id is recorded.
    await Promise.resolve();
    await Promise.resolve();

    await plugin.destroy();

    expect(cancelWatchAvailability).toHaveBeenCalledWith(7);
  });

  it('cancels the old element`s watch when the provider swaps it out', async () => {
    const container = document.createElement('div');
    const first = createMockVideo();
    const cancelFirst = vi.fn().mockResolvedValue(undefined);
    stubRemote(first, {
      watchAvailability: vi.fn().mockResolvedValue(1),
      cancelWatchAvailability: cancelFirst,
    });
    container.appendChild(first);

    const api = createApi(container);
    const plugin = airplayPlugin();
    await plugin.init(api);
    await Promise.resolve();
    await Promise.resolve();

    first.remove();
    const second = createMockVideo();
    stubRemote(second, {
      watchAvailability: vi.fn().mockResolvedValue(2),
      cancelWatchAvailability: vi.fn().mockResolvedValue(undefined),
    });
    container.appendChild(second);
    emitLoaded();

    expect(cancelFirst).toHaveBeenCalledWith(1);
  });
});
