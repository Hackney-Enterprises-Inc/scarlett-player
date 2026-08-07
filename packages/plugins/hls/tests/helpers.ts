/**
 * Shared test harness for HLS plugin suites.
 *
 * Provides per-instance mock hls.js objects that capture their event
 * handlers so tests can fire (or replay stale) events deterministically,
 * plus the jsdom media stubs and a mock IPluginAPI.
 */

import { vi } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';

export type HlsEventHandler = (...args: unknown[]) => void;

/** A mock hls.js instance plus its captured event handlers. */
export interface CapturedHls {
  instance: {
    loadSource: ReturnType<typeof vi.fn>;
    attachMedia: ReturnType<typeof vi.fn>;
    detachMedia: ReturnType<typeof vi.fn>;
    startLoad: ReturnType<typeof vi.fn>;
    stopLoad: ReturnType<typeof vi.fn>;
    recoverMediaError: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    levels: Array<{ width: number; height: number; bitrate: number }>;
    currentLevel: number;
    autoLevelEnabled: boolean;
    nextLevel: number;
    loadLevel: number;
    media: null;
  };
  handlers: Record<string, HlsEventHandler>;
}

/**
 * Create a fresh mock hls.js instance that records its event handlers.
 *
 * Unlike a shared singleton mock, every load gets its OWN instance so
 * cross-session assertions (A's timer must not touch B's instance) hold.
 *
 * @returns The mock instance and its captured handler map
 */
export const createCapturedHls = (): CapturedHls => {
  const handlers: Record<string, HlsEventHandler> = {};
  const instance = {
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    detachMedia: vi.fn(),
    startLoad: vi.fn(),
    stopLoad: vi.fn(),
    recoverMediaError: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: HlsEventHandler) => {
      handlers[event] = handler;
    }),
    off: vi.fn(),
    levels: [{ width: 1280, height: 720, bitrate: 2500000 }],
    currentLevel: -1,
    autoLevelEnabled: true,
    nextLevel: 0,
    loadLevel: 0,
    media: null,
  };
  return { instance, handlers };
};

/**
 * Create a mock hls.js constructor exposing the static surface the plugin
 * reads (isSupported, Events, ErrorTypes).
 *
 * @returns Mock constructor function
 */
export const createMockHlsConstructor = () => {
  const ctor = vi.fn();
  (ctor as any).isSupported = vi.fn(() => true);
  (ctor as any).Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
    ERROR: 'hlsError',
  };
  (ctor as any).ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    OTHER_ERROR: 'otherError',
  };
  (ctor as any).DefaultConfig = {
    loader: class MockPlaylistLoader {
      load(): void {}
      abort(): void {}
      destroy(): void {}
    },
  };
  return ctor;
};

/**
 * Build a stubbed IPluginAPI backed by a real container element.
 *
 * @returns Mock plugin API
 */
export const createMockAPI = (): IPluginAPI => {
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
  } as unknown as IPluginAPI;
};

/**
 * Install the jsdom media stubs the hls.js code path needs (MediaSource
 * feature detect, video element methods, non-Safari canPlayType).
 */
export const installMediaStubs = (): void => {
  if (!(window as any).MediaSource) {
    (window as any).MediaSource = vi.fn();
  }
  HTMLVideoElement.prototype.load = vi.fn();
  HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLVideoElement.prototype.pause = vi.fn();
  // Non-Safari: no native HLS, force the hls.js path
  HTMLVideoElement.prototype.canPlayType = vi.fn(() => '');
};

/** Flush microtasks (and zero-delay timers when fake timers are active). */
export const flush = async (): Promise<void> => {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(0);
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

/**
 * Fire a manifest-parsed event on a captured instance.
 *
 * @param c - Captured mock instance
 */
export const fireManifest = (c: CapturedHls): void => {
  c.handlers['hlsManifestParsed']?.('hlsManifestParsed', { levels: c.instance.levels });
};

/**
 * Fire an hls.js error event on a captured instance.
 *
 * @param c - Captured mock instance
 * @param data - Raw hls.js error data (type/details/fatal)
 */
export const fireError = (c: CapturedHls, data: Record<string, unknown>): void => {
  c.handlers['hlsError']?.('hlsError', data);
};
