/**
 * HLS.js Lazy Loader
 *
 * Lazily loads hls.js only when needed (not in Safari which uses native HLS).
 * This keeps bundle size small when hls.js isn't required.
 */

import type { HlsConstructor, HlsInstance } from './types';

/** Cached hls.js constructor */
let hlsConstructor: HlsConstructor | null = null;

/** Loading promise to prevent duplicate loads */
let loadingPromise: Promise<HlsConstructor> | null = null;

/**
 * Check if browser supports native HLS (Safari/iOS).
 * In these browsers, we don't need hls.js at all.
 */
export function supportsNativeHLS(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Check if we should prefer native HLS over hls.js.
 * Safari should use native HLS for AirPlay compatibility.
 * hls.js uses MSE which doesn't work with AirPlay.
 */
export function shouldPreferNativeHLS(): boolean {
  if (!supportsNativeHLS()) return false;

  // Detect Safari (but not Chrome on iOS which also has native HLS)
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);

  return isSafari;
}

/**
 * Check if hls.js is supported in this browser.
 * Returns false if MediaSource API is not available.
 */
export function isHlsJsSupported(): boolean {
  if (hlsConstructor) {
    return hlsConstructor.isSupported();
  }

  // Check MediaSource API availability
  if (typeof window === 'undefined') return false;
  return !!(
    window.MediaSource ||
    (window as any).WebKitMediaSource
  );
}

/**
 * Check if HLS playback is supported (either native or via hls.js).
 */
export function isHLSSupported(): boolean {
  return supportsNativeHLS() || isHlsJsSupported();
}

/**
 * Lazily load hls.js library.
 * Only loads once, subsequent calls return cached constructor.
 *
 * @returns Promise resolving to hls.js constructor
 * @throws Error if hls.js is not available
 */
export async function loadHlsJs(): Promise<HlsConstructor> {
  // Return cached constructor
  if (hlsConstructor) {
    return hlsConstructor;
  }

  // Return existing loading promise to prevent duplicate loads
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    try {
      // Dynamic import - hls.js is not bundled with the plugin
      const hlsModule = await import('hls.js');
      hlsConstructor = hlsModule.default as HlsConstructor;

      if (!hlsConstructor.isSupported()) {
        throw new Error('hls.js is not supported in this browser');
      }

      return hlsConstructor;
    } catch (error) {
      // Reset loading state on error
      loadingPromise = null;
      throw new Error(
        `Failed to load hls.js: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  })();

  return loadingPromise;
}

/**
 * Create a new hls.js instance with configuration.
 *
 * @param config - hls.js configuration options
 * @returns New hls.js instance
 * @throws Error if hls.js is not loaded
 */
export function createHlsInstance(config?: Record<string, unknown>): HlsInstance {
  if (!hlsConstructor) {
    throw new Error('hls.js is not loaded. Call loadHlsJs() first.');
  }
  return new hlsConstructor(config);
}

/**
 * Get the cached hls.js constructor (null if not loaded).
 */
export function getHlsConstructor(): HlsConstructor | null {
  return hlsConstructor;
}

/**
 * Reset the loader state (for testing).
 * @internal
 */
export function resetLoader(): void {
  hlsConstructor = null;
  loadingPromise = null;
}
