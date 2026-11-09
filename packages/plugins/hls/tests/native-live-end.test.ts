/**
 * Native `live` follows EXT-X-ENDLIST, and a NaN duration classifies nothing
 * (HEI-SCARLETT-62 part 2).
 *
 * The `durationchange` handler only ever wrote `live: true`: a native stream
 * that ended (Safari reports a finite duration) stayed live forever, and a NaN
 * duration, the element's reset value while a reload re-runs the load
 * algorithm, flipped a reloaded VOD to live. hls.js clears `live` from its
 * level details instead, and its MSE duration is finite while live, so only
 * the native pipeline may read a finite duration as the end.
 */

import { describe, it, expect } from 'vitest';
import { setupVideoEventHandlers } from '../src/event-map';
import { createMockAPI } from './helpers';

describe('durationchange and the live state', () => {
  /**
   * Wire the handlers to a video and a mock API holding a `live` state.
   *
   * @param live - Initial `live` state
   * @param native - Whether the handlers belong to the native pipeline
   */
  function setup(live: boolean, native: boolean) {
    const video = document.createElement('video');
    const api = createMockAPI();
    const state: Record<string, unknown> = { live };
    api.getState.mockImplementation((key: string) => state[key]);
    api.setState.mockImplementation((key: string, value: unknown) => {
      state[key] = value;
    });
    setupVideoEventHandlers(video, api, undefined, undefined, native ? { native: true } : undefined);

    /** Set the element's duration and fire `durationchange`. */
    const changeDuration = (duration: number): void => {
      Object.defineProperty(video, 'duration', { value: duration, configurable: true });
      video.dispatchEvent(new Event('durationchange'));
    };
    const setStateCalls = (key: string) =>
      api.setState.mock.calls.filter(([k]) => k === key).map(([, value]) => value);

    return { api, state, changeDuration, setStateCalls };
  }

  describe('native pipeline', () => {
    it('clears live when the duration turns finite (ENDLIST)', () => {
      const { api, state, changeDuration, setStateCalls } = setup(false, true);

      changeDuration(Infinity);
      expect(state.live).toBe(true);

      changeDuration(7200);
      expect(api.setState).toHaveBeenCalledWith('live', false);
      expect(setStateCalls('live')).toEqual([true, false]);
      expect(state.duration).toBe(7200);
      expect(api.logger.info).toHaveBeenCalledWith('Native live stream ended (finite duration)');
    });

    it('resets the live metrics when the stream ends', () => {
      const { api, state, changeDuration } = setup(false, true);

      changeDuration(Infinity);
      state.seekableRange = { start: 0, end: 60 };
      changeDuration(7200);

      expect(api.setState).toHaveBeenCalledWith('seekableRange', null);
    });

    it('does not set live for a NaN duration on a VOD', () => {
      const { api, changeDuration } = setup(false, true);

      changeDuration(NaN);

      expect(api.setState).not.toHaveBeenCalledWith('live', true);
      expect(api.setState).toHaveBeenCalledWith('duration', 0);
      expect(api.emit).toHaveBeenCalledWith('media:loadedmetadata', { duration: 0 });
    });

    it('does not end a live stream on a NaN duration', () => {
      const { api, state, changeDuration } = setup(true, true);

      changeDuration(NaN);

      expect(api.setState).not.toHaveBeenCalledWith('live', false);
      expect(state.live).toBe(true);
    });

    it('leaves a finite VOD duration alone', () => {
      const { api, state, changeDuration } = setup(false, true);

      changeDuration(120);

      expect(api.setState).not.toHaveBeenCalledWith('live', expect.anything());
      expect(state.duration).toBe(120);
      expect(api.logger.info).not.toHaveBeenCalledWith('Native live stream ended (finite duration)');
    });

    it('keeps live true for an Infinity duration', () => {
      const { api, changeDuration } = setup(true, true);

      changeDuration(Infinity);

      expect(api.setState).toHaveBeenCalledWith('live', true);
      expect(api.setState).toHaveBeenCalledWith('duration', 0);
    });
  });

  describe('hls.js pipeline (no native flag)', () => {
    it('leaves live alone when a finite duration arrives while live', () => {
      const { api, state, changeDuration } = setup(true, false);

      changeDuration(7200);

      expect(api.setState).not.toHaveBeenCalledWith('live', expect.anything());
      expect(state.live).toBe(true);
      expect(state.duration).toBe(7200);
    });
  });
});
