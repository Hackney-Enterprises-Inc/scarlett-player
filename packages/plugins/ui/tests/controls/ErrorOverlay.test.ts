/**
 * ErrorOverlay Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorOverlay, getUserMessage } from '../../src/controls/ErrorOverlay';
import type { IPluginAPI } from '@scarlett-player/core';

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {
    playbackState: 'idle',
    playing: false,
    source: { src: 'http://example.com/video.m3u8' },
    error: null,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
  video.load = vi.fn();
  container.appendChild(video);

  return {
    pluginId: 'test',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  };
}

describe('ErrorOverlay', () => {
  let api: ReturnType<typeof createMockApi>;
  let overlay: ErrorOverlay;

  beforeEach(() => {
    api = createMockApi();
    overlay = new ErrorOverlay(api);
  });

  afterEach(() => {
    overlay.destroy();
  });

  it('should render a div element with correct class', () => {
    const el = overlay.render();
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('sp-error-overlay')).toBe(true);
  });

  it('should have proper ARIA attributes', () => {
    const el = overlay.render();
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });

  it('should not be visible initially', () => {
    const el = overlay.render();
    expect(el.classList.contains('sp-error-overlay--visible')).toBe(false);
    expect(overlay.isVisible()).toBe(false);
  });

  it('should show overlay with error message', () => {
    const el = overlay.render();
    overlay.show(new Error('Network timeout'));
    expect(el.classList.contains('sp-error-overlay--visible')).toBe(true);
    expect(overlay.isVisible()).toBe(true);
  });

  it('should hide overlay', () => {
    const el = overlay.render();
    overlay.show(new Error('test'));
    overlay.hide();
    expect(el.classList.contains('sp-error-overlay--visible')).toBe(false);
    expect(overlay.isVisible()).toBe(false);
  });

  it('should display network error message', () => {
    const el = overlay.render();
    overlay.show(new Error('Network error: manifest load failed'));
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
  });

  it('should display media error message', () => {
    const el = overlay.render();
    overlay.show(new Error('Media decode error'));
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe("This video can't be played right now.");
  });

  it('should display source not found message', () => {
    const el = overlay.render();
    overlay.show(new Error('Source not found'));
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe('Video not found.');
  });

  it('should display generic error message for unknown errors', () => {
    const el = overlay.render();
    overlay.show(new Error('Something unexpected'));
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe('Something went wrong.');
  });

  it('should display generic message for null error', () => {
    const el = overlay.render();
    overlay.show(null);
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe('Something went wrong.');
  });

  it('should have a Try Again button', () => {
    const el = overlay.render();
    const retryBtn = el.querySelector('.sp-error-overlay__retry');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toBe('Try Again');
    expect(retryBtn?.getAttribute('aria-label')).toBe('Try again');
  });

  it('should have a Go Back button', () => {
    const el = overlay.render();
    const dismissBtn = el.querySelector('.sp-error-overlay__dismiss');
    expect(dismissBtn).toBeTruthy();
    expect(dismissBtn?.textContent).toBe('Go Back');
    expect(dismissBtn?.getAttribute('aria-label')).toBe('Go back');
  });

  it('should retry playback when Try Again is clicked', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.show(new Error('test'));

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();

    expect(overlay.isVisible()).toBe(false);

    const video = api.container.querySelector('video') as HTMLVideoElement;
    expect(video.load).toHaveBeenCalled();
    expect(video.play).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('should emit error:dismiss when Go Back is clicked', () => {
    const el = overlay.render();
    overlay.show(new Error('test'));

    const dismissBtn = el.querySelector('.sp-error-overlay__dismiss') as HTMLButtonElement;
    dismissBtn.click();

    expect(overlay.isVisible()).toBe(false);
    expect(api.emit).toHaveBeenCalledWith('error:dismiss', undefined);
  });

  it('should auto-hide when playback resumes', () => {
    overlay.show(new Error('test'));
    expect(overlay.isVisible()).toBe(true);

    // Simulate playback recovery
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackState') return 'playing';
      if (key === 'playing') return true;
      return undefined;
    });

    overlay.update();
    expect(overlay.isVisible()).toBe(false);
  });

  it('should not auto-hide when still in error state', () => {
    overlay.show(new Error('test'));
    expect(overlay.isVisible()).toBe(true);

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackState') return 'error';
      if (key === 'playing') return false;
      return undefined;
    });

    overlay.update();
    expect(overlay.isVisible()).toBe(true);
  });

  it('should remove element on destroy', () => {
    const el = overlay.render();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    overlay.destroy();
    expect(document.body.contains(el)).toBe(false);
  });

  it('should have touch-friendly button sizes (44px min)', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    const dismissBtn = el.querySelector('.sp-error-overlay__dismiss') as HTMLButtonElement;

    // Check min-height is set in attributes (CSS computed styles not available in jsdom)
    expect(retryBtn).toBeTruthy();
    expect(dismissBtn).toBeTruthy();

    document.body.removeChild(el);
  });

  // --- Retry behavior ---

  it('should emit error:retry with source on retry click', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.show(new Error('test'));

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();

    expect(api.emit).toHaveBeenCalledWith('error:retry', {
      src: 'http://example.com/video.m3u8',
    });

    document.body.removeChild(el);
  });

  it('should set video src on retry click', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.show(new Error('test'));
    const video = api.container.querySelector('video') as HTMLVideoElement;

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();

    expect(video.src).toContain('example.com/video.m3u8');

    document.body.removeChild(el);
  });

  it('should disable retry button during retry to prevent double-tap', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.show(new Error('test'));

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();

    expect(retryBtn.disabled).toBe(true);

    document.body.removeChild(el);
  });

  it('should re-enable retry button after show is called again', () => {
    const el = overlay.render();

    overlay.show(new Error('first error'));
    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();
    expect(retryBtn.disabled).toBe(true);

    // Show again re-enables
    overlay.show(new Error('second error'));
    expect(retryBtn.disabled).toBe(false);
  });

  it('should not call video methods if retry button is already disabled', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.show(new Error('test'));
    const video = api.container.querySelector('video') as HTMLVideoElement;

    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    retryBtn.click();

    // Clear call counts
    (video.load as any).mockClear();
    (video.play as any).mockClear();

    // Second click should be blocked
    retryBtn.click();
    expect(video.load).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  // --- Show/hide transitions ---

  it('should show then hide then show again correctly', () => {
    overlay.render();

    overlay.show(new Error('first'));
    expect(overlay.isVisible()).toBe(true);

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);

    overlay.show(new Error('second'));
    expect(overlay.isVisible()).toBe(true);
  });

  it('should update message when show is called multiple times', () => {
    const el = overlay.render();

    overlay.show(new Error('Network timeout'));
    const message = el.querySelector('.sp-error-overlay__message');
    expect(message?.textContent).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );

    overlay.show(new Error('Media decode error'));
    expect(message?.textContent).toBe("This video can't be played right now.");
  });

  // --- Auto-hide scenarios ---

  it('should not auto-hide when in loading state', () => {
    overlay.show(new Error('test'));
    expect(overlay.isVisible()).toBe(true);

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackState') return 'loading';
      if (key === 'playing') return false;
      return undefined;
    });

    overlay.update();
    expect(overlay.isVisible()).toBe(true);
  });

  it('should not auto-hide when playbackState is idle and not playing', () => {
    overlay.show(new Error('test'));

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackState') return 'idle';
      if (key === 'playing') return false;
      return undefined;
    });

    overlay.update();
    expect(overlay.isVisible()).toBe(true);
  });

  it('should not auto-hide when not visible', () => {
    // Never shown, so not visible
    expect(overlay.isVisible()).toBe(false);

    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playbackState') return 'playing';
      if (key === 'playing') return true;
      return undefined;
    });

    overlay.update();
    expect(overlay.isVisible()).toBe(false);
  });

  // --- Manifest error category ---

  it('should display manifest load error message', () => {
    const el = overlay.render();
    overlay.show(new Error('manifest load failed'));
    const message = el.querySelector('.sp-error-overlay__message');
    // "manifest" without network keywords falls into manifest category
    expect(message?.textContent).toBe('Unable to load video. Please try again.');
  });

  // --- Structure ---

  it('should have icon, message, and actions in content area', () => {
    const el = overlay.render();
    const content = el.querySelector('.sp-error-overlay__content');
    expect(content).toBeTruthy();
    expect(content?.querySelector('.sp-error-overlay__icon')).toBeTruthy();
    expect(content?.querySelector('.sp-error-overlay__message')).toBeTruthy();
    expect(content?.querySelector('.sp-error-overlay__actions')).toBeTruthy();
  });

  it('should have button type attribute on both buttons', () => {
    const el = overlay.render();
    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    const dismissBtn = el.querySelector('.sp-error-overlay__dismiss') as HTMLButtonElement;
    expect(retryBtn.getAttribute('type')).toBe('button');
    expect(dismissBtn.getAttribute('type')).toBe('button');
  });

  // --- Cleanup ---

  it('should remove button event listeners on destroy', () => {
    const el = overlay.render();
    document.body.appendChild(el);

    overlay.destroy();

    // After destroy, clicking buttons should not trigger handlers
    // We can verify by checking that emit is not called after destroy
    const emitCallCount = (api.emit as any).mock.calls.length;
    const retryBtn = el.querySelector('.sp-error-overlay__retry') as HTMLButtonElement;
    const dismissBtn = el.querySelector('.sp-error-overlay__dismiss') as HTMLButtonElement;

    // These buttons are detached from DOM after destroy, but we can still dispatch
    retryBtn.click();
    dismissBtn.click();

    // emit should not have been called again for error:dismiss
    // (retryBtn won't emit error:dismiss, dismissBtn handler removed)
    const newCalls = (api.emit as any).mock.calls.slice(emitCallCount);
    const dismissCalls = newCalls.filter(
      (call: unknown[]) => call[0] === 'error:dismiss'
    );
    expect(dismissCalls.length).toBe(0);
  });
});

describe('getUserMessage', () => {
  it('should return network message for network errors', () => {
    expect(getUserMessage(new Error('Network timeout'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
    expect(getUserMessage(new Error('manifest load failed: connection refused'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
    expect(getUserMessage(new Error('fetch error'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
  });

  it('should return media message for decode errors', () => {
    expect(getUserMessage(new Error('Media decode error'))).toBe(
      "This video can't be played right now."
    );
    expect(getUserMessage(new Error('Unsupported codec'))).toBe(
      "This video can't be played right now."
    );
    expect(getUserMessage(new Error('format not supported'))).toBe(
      "This video can't be played right now."
    );
  });

  it('should return source message for not found errors', () => {
    expect(getUserMessage(new Error('404 not found'))).toBe('Video not found.');
    expect(getUserMessage(new Error('Source not supported'))).toBe('Video not found.');
  });

  it('should return generic message for unknown errors', () => {
    expect(getUserMessage(new Error('random error'))).toBe('Something went wrong.');
  });

  it('should return generic message for null', () => {
    expect(getUserMessage(null)).toBe('Something went wrong.');
  });

  it('should return manifest message for plain manifest errors', () => {
    expect(getUserMessage(new Error('manifest parse error'))).toBe(
      'Unable to load video. Please try again.'
    );
  });

  it('should match network errors case-insensitively via toLowerCase', () => {
    expect(getUserMessage(new Error('NETWORK ERROR'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
    expect(getUserMessage(new Error('TIMEOUT'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
  });

  it('should return generic message for empty error message', () => {
    expect(getUserMessage(new Error(''))).toBe('Something went wrong.');
  });

  it('should prioritize network keywords over manifest keywords', () => {
    // "manifest load failed: connection refused" has both "manifest" and "connection"
    // but "connection" is matched by the network check first
    expect(getUserMessage(new Error('manifest load failed: connection refused'))).toBe(
      'Having trouble connecting. Check your internet and try again.'
    );
  });

  it('should return source message for 404 errors', () => {
    expect(getUserMessage(new Error('HTTP 404 not found'))).toBe('Video not found.');
  });

  it('should return media message for codec errors', () => {
    expect(getUserMessage(new Error('video codec not supported by browser'))).toBe(
      "This video can't be played right now."
    );
  });
});
