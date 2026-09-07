/**
 * Cast SDK Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadCastSDK,
  isCastSDKLoaded,
  isCastSupported,
  resetCastLoader,
  CAST_SDK_TIMEOUT_MS,
} from '../src/cast-loader';

describe('Cast Loader', () => {
  beforeEach(() => {
    resetCastLoader();
    // Clear any existing cast SDK
    delete (window as any).cast;
    delete (window as any).chrome;
    delete (window as any).__onGCastApiAvailable;
  });

  afterEach(() => {
    resetCastLoader();
    vi.restoreAllMocks();
  });

  describe('isCastSDKLoaded()', () => {
    it('should return false when SDK is not loaded', () => {
      expect(isCastSDKLoaded()).toBe(false);
    });

    it('should return true when SDK is loaded', () => {
      (window as any).cast = {
        framework: {
          CastContext: {},
        },
      };

      expect(isCastSDKLoaded()).toBe(true);
    });
  });

  describe('isCastSupported()', () => {
    it('should return true for Chrome browser', () => {
      // jsdom default UA doesn't include Chrome
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      expect(isCastSupported()).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should return true for Chromium browser', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chromium/120.0.0.0',
        configurable: true,
      });

      expect(isCastSupported()).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should return false for Edge browser', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0 Edg/120.0.0.0',
        configurable: true,
      });

      expect(isCastSupported()).toBe(false);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should return false for Firefox browser', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Firefox/120.0',
        configurable: true,
      });

      expect(isCastSupported()).toBe(false);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });
  });

  describe('loadCastSDK()', () => {
    it('should resolve immediately if SDK already loaded', async () => {
      (window as any).cast = {
        framework: {
          CastContext: {},
        },
      };

      await expect(loadCastSDK()).resolves.toBeUndefined();
    });

    it('should inject script tag when loading', async () => {
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');

      // Start loading (won't complete because script won't actually load)
      const loadPromise = loadCastSDK();

      // Check script was added
      expect(appendChildSpy).toHaveBeenCalled();
      const script = appendChildSpy.mock.calls[0][0] as HTMLScriptElement;
      expect(script.src).toContain('cast_sender.js');
      expect(script.async).toBe(true);

      // Simulate SDK loaded callback
      (window as any).cast = {
        framework: {
          CastContext: {},
        },
      };
      (window as any).__onGCastApiAvailable?.(true);

      await expect(loadPromise).resolves.toBeUndefined();
    });

    it('should reject if SDK callback reports not available', async () => {
      const loadPromise = loadCastSDK();

      // Simulate SDK not available
      (window as any).__onGCastApiAvailable?.(false);

      await expect(loadPromise).rejects.toThrow('not available');
    });

    it('should return same promise if called multiple times', async () => {
      (window as any).cast = {
        framework: {
          CastContext: {},
        },
      };

      const promise1 = loadCastSDK();
      const promise2 = loadCastSDK();

      expect(promise1).toBe(promise2);
    });

    it('should handle script load error', async () => {
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');

      const loadPromise = loadCastSDK();

      // Get the script element and trigger error
      const script = appendChildSpy.mock.calls[0][0] as HTMLScriptElement;
      script.onerror?.(new Event('error'));

      await expect(loadPromise).rejects.toThrow('Failed to load');
    });
  });

  describe('resetCastLoader()', () => {
    it('should reset loader state', async () => {
      // First load
      (window as any).cast = {
        framework: {
          CastContext: {},
        },
      };
      await loadCastSDK();

      // Reset
      resetCastLoader();

      // Should be able to get a new promise
      const newPromise = loadCastSDK();
      expect(newPromise).toBeDefined();
    });

    it('should clear callback', () => {
      (window as any).__onGCastApiAvailable = vi.fn();

      resetCastLoader();

      expect((window as any).__onGCastApiAvailable).toBeUndefined();
    });
  });
});

describe('Cast Loader - load timeout', () => {
  beforeEach(() => {
    resetCastLoader();
    delete (window as any).cast;
    delete (window as any).__onGCastApiAvailable;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCastLoader();
    vi.restoreAllMocks();
  });

  it('rejects when the SDK never reports in', async () => {
    const loadPromise = loadCastSDK();
    const assertion = expect(loadPromise).rejects.toThrow(/did not load within/);

    await vi.advanceTimersByTimeAsync(CAST_SDK_TIMEOUT_MS);

    await assertion;
  });

  it('does not reject while still inside the window', async () => {
    const loadPromise = loadCastSDK();
    let settled = false;
    void loadPromise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await vi.advanceTimersByTimeAsync(CAST_SDK_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    (window as any).cast = { framework: { CastContext: {} } };
    (window as any).__onGCastApiAvailable?.(true);

    await expect(loadPromise).resolves.toBeUndefined();
  });

  it('allows a retry after a timeout', async () => {
    const first = loadCastSDK();
    const rejected = expect(first).rejects.toThrow(/did not load within/);
    await vi.advanceTimersByTimeAsync(CAST_SDK_TIMEOUT_MS);
    await rejected;

    (window as any).cast = { framework: { CastContext: {} } };

    // The failed promise must not be cached, or casting stays broken for the
    // rest of the session even once the SDK is there.
    await expect(loadCastSDK()).resolves.toBeUndefined();
  });

  it('chains an existing __onGCastApiAvailable callback', async () => {
    const existing = vi.fn();
    (window as any).__onGCastApiAvailable = existing;

    const loadPromise = loadCastSDK();

    (window as any).cast = { framework: { CastContext: {} } };
    (window as any).__onGCastApiAvailable?.(true);

    await expect(loadPromise).resolves.toBeUndefined();
    expect(existing).toHaveBeenCalledWith(true);
  });

  it('survives a chained callback that throws', async () => {
    (window as any).__onGCastApiAvailable = () => {
      throw new Error('third-party sender blew up');
    };

    const loadPromise = loadCastSDK();

    (window as any).cast = { framework: { CastContext: {} } };
    (window as any).__onGCastApiAvailable?.(true);

    await expect(loadPromise).resolves.toBeUndefined();
  });
});
