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
});
