/**
 * Cast SDK Loader
 *
 * Dynamically loads the Google Cast SDK.
 */

const CAST_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

/** SDK loading state */
let loadPromise: Promise<void> | null = null;

/**
 * Load the Google Cast SDK.
 *
 * Returns a promise that resolves when the SDK is ready.
 * Safe to call multiple times - will return the same promise.
 *
 * @returns Promise that resolves when SDK is loaded
 */
export function loadCastSDK(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Already loaded?
    if (isCastSDKLoaded()) {
      resolve();
      return;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Cast SDK requires browser environment'));
      return;
    }

    // Set callback before loading script
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable && isCastSDKLoaded()) {
        resolve();
      } else {
        reject(new Error('Cast SDK reported not available'));
      }
    };

    // Create and inject script
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;

    script.onerror = () => {
      loadPromise = null; // Allow retry
      reject(new Error('Failed to load Cast SDK script'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if Cast SDK is already loaded and available.
 */
export function isCastSDKLoaded(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    (window as any).cast?.framework?.CastContext
  );
}

/**
 * Check if Cast is supported in current environment.
 * Chrome and Chromium-based browsers support Cast.
 */
export function isCastSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Cast only works in Chrome/Chromium browsers
  const ua = navigator.userAgent;
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isChromium = /Chromium/.test(ua);

  return isChrome || isChromium;
}

/**
 * Reset the loader state (for testing).
 * @internal
 */
export function resetCastLoader(): void {
  loadPromise = null;
  if (typeof window !== 'undefined') {
    delete (window as any).__onGCastApiAvailable;
  }
}
