/**
 * Cast SDK Loader
 *
 * Dynamically loads the Google Cast SDK.
 */

const CAST_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

/**
 * How long to wait for the SDK before giving up.
 *
 * gstatic.com being slow, blocked by an extension, or unreachable behind a
 * corporate proxy used to hang the load forever, and every caller awaiting it
 * with it - which meant the whole player waited on a cast button nobody asked
 * for. Ten seconds is well past a normal load and short enough that a viewer
 * on a broken network still gets a player.
 */
export const CAST_SDK_TIMEOUT_MS = 10_000;

/** SDK loading state */
let loadPromise: Promise<void> | null = null;

/**
 * Cancels the in-flight load's timeout without settling it.
 *
 * Set while a load is pending so {@link resetCastLoader} can drop it without
 * leaving a timer that would later reject a promise nobody holds.
 */
let abortPendingLoad: (() => void) | null = null;

/**
 * Load the Google Cast SDK.
 *
 * Returns a promise that resolves when the SDK is ready. Safe to call multiple
 * times - it returns the same promise.
 *
 * Rejects rather than hanging when the SDK does not arrive within
 * {@link CAST_SDK_TIMEOUT_MS}. Callers should treat a rejection as
 * non-fatal: casting is simply unavailable, and the player carries on.
 *
 * @returns Promise that resolves when the SDK is loaded
 * @throws Error when the environment has no DOM, the script fails to load, the
 *   SDK reports itself unavailable, or the load times out
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

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearPendingTimeout = (): void => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    abortPendingLoad = () => {
      settled = true;
      clearPendingTimeout();
    };

    const settle = (error?: Error): void => {
      if (settled) return;
      settled = true;
      abortPendingLoad = null;

      clearPendingTimeout();

      if (error) {
        loadPromise = null; // Allow a later retry
        reject(error);
        return;
      }

      resolve();
    };

    // The SDK calls whatever sits on this global exactly once. Another sender
    // on the page (or a host that loaded the SDK itself) may already own it, so
    // chain rather than overwrite - clobbering it silently breaks them.
    const previousCallback = (window as { __onGCastApiAvailable?: (a: boolean) => void })
      .__onGCastApiAvailable;

    (window as { __onGCastApiAvailable?: (a: boolean) => void }).__onGCastApiAvailable = (
      isAvailable: boolean
    ) => {
      try {
        previousCallback?.(isAvailable);
      } catch {
        // A third party's callback throwing is not this loader's problem.
      }

      if (isAvailable && isCastSDKLoaded()) {
        settle();
      } else {
        settle(new Error('Cast SDK reported not available'));
      }
    };

    // Create and inject script
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;

    script.onerror = () => {
      settle(new Error('Failed to load Cast SDK script'));
    };

    document.head.appendChild(script);

    timeoutId = setTimeout(() => {
      settle(new Error(`Cast SDK did not load within ${CAST_SDK_TIMEOUT_MS}ms`));
    }, CAST_SDK_TIMEOUT_MS);
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
  abortPendingLoad?.();
  abortPendingLoad = null;
  loadPromise = null;
  if (typeof window !== 'undefined') {
    delete (window as any).__onGCastApiAvailable;
  }
}
