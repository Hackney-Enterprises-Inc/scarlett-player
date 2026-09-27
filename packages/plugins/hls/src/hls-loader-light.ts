/**
 * HLS.js Light Loader
 *
 * Same as hls-loader but imports hls.js/light for smaller bundle size.
 * The light build excludes: subtitles, ID3 tags, and DRM/EME support.
 * Use this when you don't need those features to save ~35% bundle size.
 *
 * hls.js is the standard playback path. Native HLS is chosen only when
 * AirPlay is active (hls.js uses MSE, which AirPlay cannot mirror) or when
 * MSE is unsupported - both decisions live in `create-hls-plugin.ts`, not
 * here.
 */

import type { HlsConstructor, HlsInstance, HlsSupportProbes } from './types';

/** Cached hls.js constructor */
let hlsConstructor: HlsConstructor | null = null;

/** Loading promise to prevent duplicate loads */
let loadingPromise: Promise<HlsConstructor> | null = null;

/** The two MIME strings an HLS manifest goes by; WebKit answers both alike. */
const HLS_MIME_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegURL'] as const;

/**
 * Check if browser supports native HLS (Safari/iOS).
 * In these browsers, we don't need hls.js at all.
 *
 * @returns True when the media element answers either HLS MIME string
 */
export function supportsNativeHLS(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return HLS_MIME_TYPES.some((type) => video.canPlayType(type) !== '');
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
 * Report what every support probe answers in this browser.
 *
 * For diagnosis only: the provider attaches it to the `SOURCE_NOT_SUPPORTED`
 * fatal when both probes fail, so the error says why. Nothing here decides
 * playback. `ManagedMediaSource` is recorded but not accepted by
 * {@link isHlsJsSupported} (Tarnock decision #148).
 *
 * @returns The probe values
 */
export function describeSupport(): HlsSupportProbes {
  const video = typeof document === 'undefined' ? null : document.createElement('video');
  const answer = (type: string): string => (video ? video.canPlayType(type) : '');
  const win = (typeof window === 'undefined' ? {} : window) as Record<string, unknown>;

  return {
    canPlayType: {
      'application/vnd.apple.mpegurl': answer('application/vnd.apple.mpegurl'),
      'application/x-mpegURL': answer('application/x-mpegURL'),
    },
    MediaSource: typeof win.MediaSource,
    ManagedMediaSource: typeof win.ManagedMediaSource,
    WebKitMediaSource: typeof win.WebKitMediaSource,
    hlsJsLoaded: hlsConstructor !== null,
    hlsJsSupported: hlsConstructor ? hlsConstructor.isSupported() : null,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  };
}

/**
 * Lazily load hls.js LIGHT library.
 * Only loads once, subsequent calls return cached constructor.
 *
 * Note: This loads the light build which excludes:
 * - Subtitle/caption parsing (WebVTT)
 * - ID3 tag parsing
 * - EME/DRM support
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
      // Dynamic import - use LIGHT build for smaller bundle
      const hlsModule = await import('hls.js/light');
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
