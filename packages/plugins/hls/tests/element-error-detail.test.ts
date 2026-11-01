import { describe, expect, it } from 'vitest';
import { setupVideoEventHandlers } from '../src/event-map';
import { createMockAPI } from './helpers';

// HEI-23, HEI-37: an element error carries the element's network and ready
// state, and names the two codes browsers most often leave without a message.
describe('video element error detail', () => {
  /** Fire an element error and return the `media:error` it emitted. */
  function fireElementError(
    mediaError: { code: number; message: string } | null,
    states: { networkState?: number; readyState?: number; src?: string } = {}
  ) {
    const video = document.createElement('video');
    // A real failed load keeps its source on the element; teardown does not.
    const src = states.src ?? 'https://cdn.example.com/live/playlist.m3u8';
    if (src) video.setAttribute('src', src);
    const api = createMockAPI();
    Object.defineProperty(video, 'error', { value: mediaError, configurable: true });
    Object.defineProperty(video, 'networkState', { value: states.networkState ?? 3, configurable: true });
    Object.defineProperty(video, 'readyState', { value: states.readyState ?? 0, configurable: true });
    setupVideoEventHandlers(video, api);
    video.dispatchEvent(new Event('error'));
    const call = (api.emit as any).mock.calls.find(([name]: [string]) => name === 'media:error');
    return call?.[1]?.error as (Error & { code?: number; detail?: Record<string, unknown> }) | undefined;
  }

  it('adds networkState and readyState to the detail', () => {
    const error = fireElementError({ code: 3, message: 'PIPELINE_ERROR_DECODE' }, { networkState: 2, readyState: 1 });
    expect(error?.detail).toEqual({ mediaErrorCode: 3, networkState: 2, readyState: 1 });
    expect(error?.message).toBe('PIPELINE_ERROR_DECODE');
  });

  it('names code 4 when the browser gives no message', () => {
    expect(fireElementError({ code: 4, message: '' })?.message).toBe('Media source not supported');
  });

  it('names code 2 when the browser gives no message', () => {
    expect(fireElementError({ code: 2, message: '' })?.message).toBe('Media network error');
  });

  it('keeps the generic message for other codes without one', () => {
    expect(fireElementError({ code: 3, message: '' })?.message).toBe('Video playback error');
  });

  it('keeps the browser message when there is one', () => {
    expect(fireElementError({ code: 4, message: 'Format error' })?.message).toBe('Format error');
  });

  // HEI-71: iOS reports code 4 / NO_SOURCE / HAVE_NOTHING in bursts as a page
  // releases its media element. With no source on the element that is
  // teardown, not a playback failure, and must not count as a warning.
  describe('an error from an element with no source (teardown)', () => {
    it('emits no media:error for code 4, NO_SOURCE and no src', () => {
      expect(fireElementError({ code: 4, message: '' }, { src: '' })).toBeUndefined();
    });

    it('logs it at debug, not as an element error', () => {
      const video = document.createElement('video');
      const api = createMockAPI();
      Object.defineProperty(video, 'error', { value: { code: 4, message: '' }, configurable: true });
      Object.defineProperty(video, 'networkState', { value: 3, configurable: true });
      setupVideoEventHandlers(video, api);
      video.dispatchEvent(new Event('error'));
      expect(api.logger.debug).toHaveBeenCalled();
      expect(api.logger.error).not.toHaveBeenCalled();
    });

    it('still emits code 4 when the element holds a source', () => {
      expect(fireElementError({ code: 4, message: '' }, { src: 'https://cdn.example.com/a.m3u8' })?.code).toBe(4);
    });

    it('still emits code 4 when the network state is not NO_SOURCE', () => {
      expect(fireElementError({ code: 4, message: '' }, { src: '', networkState: 2 })?.code).toBe(4);
    });

    it('still emits other codes with no source', () => {
      expect(fireElementError({ code: 3, message: '' }, { src: '' })?.code).toBe(3);
      expect(fireElementError({ code: 2, message: '' }, { src: '' })?.code).toBe(2);
    });
  });
});
