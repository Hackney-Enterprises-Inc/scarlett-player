import { describe, expect, it } from 'vitest';
import { setupVideoEventHandlers } from '../src/event-map';
import { createMockAPI } from './helpers';

// HEI-23, HEI-37: an element error carries the element's network and ready
// state, and names the two codes browsers most often leave without a message.
describe('video element error detail', () => {
  /** Fire an element error and return the `media:error` it emitted. */
  function fireElementError(
    mediaError: { code: number; message: string } | null,
    states: { networkState?: number; readyState?: number } = {}
  ) {
    const video = document.createElement('video');
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
});
