/**
 * BigPlayButton Control Tests
 *
 * The button is the only play affordance on the picture itself, so the rules
 * about when it is on screen are the whole feature: it must be there over a
 * poster before playback, gone the moment playback starts, out of the way of
 * the spinner and the error overlay, and back as Replay when the video ends.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BigPlayButton } from '../../src/controls/BigPlayButton';
import type { IPluginAPI } from '@scarlett-player/core';

type MockApi = IPluginAPI & { __state: Record<string, unknown> };

function createMockApi(overrides: Record<string, unknown> = {}): MockApi {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
    currentTime: 0,
    playbackState: 'idle',
    error: null,
    ...overrides,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
  container.appendChild(video);

  return {
    pluginId: 'test',
    container,
    __state: state,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockApi;
}

describe('BigPlayButton', () => {
  let api: MockApi;
  let button: BigPlayButton;

  const isVisible = (): boolean =>
    button.render().classList.contains('sp-big-play--visible');

  /**
   * Put the media element into (or out of) the ended state.
   *
   * The control reads `video.ended`, not the `ended` state key: neither
   * provider clears that key on a replay, so it stays true for the rest of
   * the session and would leave this button over playing video.
   */
  const setElementEnded = (value: boolean): void => {
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'ended', { value, configurable: true });
  };

  beforeEach(() => {
    api = createMockApi();
    button = new BigPlayButton(api);
  });

  afterEach(() => {
    button.destroy();
  });

  it('renders a real button with an accessible label', () => {
    const el = button.render();

    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Play');
    expect(el.classList.contains('sp-big-play')).toBe(true);
  });

  it('is visible before playback starts', () => {
    button.update();

    expect(isVisible()).toBe(true);
  });

  it('is visible once the source is ready', () => {
    api.__state.playbackState = 'ready';
    button.update();

    expect(isVisible()).toBe(true);
  });

  it('is hidden while the source is loading (the spinner owns that state)', () => {
    api.__state.playbackState = 'loading';
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden once playback is under way', () => {
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('stays hidden after a pause mid-playback', () => {
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();

    // A viewer who pauses in the first fraction of a second still has
    // currentTime 0, so the latch is what keeps the button off the picture.
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.playbackState = 'paused';
    api.__state.currentTime = 0;
    button.update();

    expect(isVisible()).toBe(false);
  });

  // Fails today (SCAR-UI-BIGPLAY-HASSTARTED): the playing latch held for the
  // whole session, so a second source that loaded and sat paused (a paused
  // playlist advance, a host load()) had no play affordance on the picture.
  it('reappears for a new source loaded paused after an earlier one played', () => {
    api.__state.source = { src: 'a.mp4', type: 'video/mp4' };
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();
    expect(isVisible()).toBe(false);

    // load() writes a fresh source object and resets the playback keys.
    api.__state.source = { src: 'b.mp4', type: 'video/mp4' };
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.currentTime = 0;
    api.__state.playbackState = 'loading';
    button.update();
    expect(isVisible()).toBe(false); // the spinner owns loading

    api.__state.playbackState = 'ready';
    button.update();
    expect(isVisible()).toBe(true);
  });

  // Preservation: an autoplay advance calls play() straight after the load, so
  // the element is already unpaused before `playing` arrives. The button must
  // not flash in that frame once the latch resets per source.
  it('stays hidden across an autoplay advance while play() is in flight', () => {
    api.__state.source = { src: 'a.mp4', type: 'video/mp4' };
    api.__state.playing = true;
    api.__state.playbackState = 'playing';
    button.update();

    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    api.__state.source = { src: 'b.mp4', type: 'video/mp4' };
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.currentTime = 0;
    api.__state.playbackState = 'loading';
    button.update();
    api.__state.playbackState = 'ready';
    button.update();

    expect(isVisible()).toBe(false);
  });

  // Fails today: the same in-flight frame on the very first source, where no
  // latch hides the button, flashed it between `ready` and `playing`.
  it('stays hidden on the first source while an autoplay play() is in flight', () => {
    const video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    api.__state.playbackState = 'ready';
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden when an error is set', () => {
    api.__state.error = { code: 'MEDIA_NETWORK_ERROR', message: 'gone' };
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('is hidden while the error overlay is on screen', () => {
    // A dismissed overlay leaves `error` populated, so the overlay's own
    // visibility is the authority on whether it owns the picture.
    let overlayVisible = true;
    const guarded = new BigPlayButton(api, () => overlayVisible);

    guarded.update();
    expect(guarded.render().classList.contains('sp-big-play--visible')).toBe(false);

    overlayVisible = false;
    guarded.update();
    expect(guarded.render().classList.contains('sp-big-play--visible')).toBe(true);

    guarded.destroy();
  });

  it('comes back as Replay when playback ends', () => {
    api.__state.playing = true;
    button.update();

    api.__state.playing = false;
    api.__state.currentTime = 120;
    api.__state.playbackState = 'ended';
    setElementEnded(true);
    button.update();

    expect(isVisible()).toBe(true);
    expect(button.render().getAttribute('aria-label')).toBe('Replay');
  });

  it('hides again once a replay is under way', () => {
    // The `ended` state key survives a replay (only load() clears it), so a
    // control that trusted it would sit over the picture for the rest of the
    // session. Verified in Chrome on 2026-09-02.
    api.__state.playing = true;
    button.update();
    api.__state.playing = false;
    api.__state.currentTime = 120;
    setElementEnded(true);
    button.update();
    expect(isVisible()).toBe(true);

    api.__state.ended = true; // stale, never cleared by either provider
    setElementEnded(false);
    api.__state.playing = true;
    api.__state.currentTime = 2;
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('stays hidden when a replay is paused', () => {
    api.__state.playing = true;
    button.update();
    api.__state.ended = true; // stale
    api.__state.playing = false;
    api.__state.paused = true;
    api.__state.currentTime = 5;
    setElementEnded(false);
    button.update();

    expect(isVisible()).toBe(false);
  });

  it('falls back to the ended state key before an element exists', () => {
    // A provider has not created the media element yet, so there is nothing
    // to read; the state key is all there is.
    const bare = createMockApi({ ended: true, currentTime: 30 });
    bare.container.querySelector('video')?.remove();
    const orphan = new BigPlayButton(bare);

    orphan.update();

    expect(orphan.render().getAttribute('aria-label')).toBe('Replay');
    orphan.destroy();
  });

  it('calls video.play() when clicked', () => {
    const video = api.container.querySelector('video')!;

    button.render().click();

    expect(video.play).toHaveBeenCalled();
  });

  it('seeks to 0 and plays when clicked after ending', () => {
    setElementEnded(true);
    const video = api.container.querySelector('video')!;

    button.render().click();

    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();
  });

  it('swallows a rejected play() instead of leaking an unhandled rejection', () => {
    const video = api.container.querySelector('video')!;
    video.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));

    expect(() => button.render().click()).not.toThrow();
  });

  it('does not rebuild its icon across repeated no-op updates', () => {
    // Same reason as the control bar's play button: rebuilding the icon
    // between mousedown and mouseup removes the node that took the press, and
    // the browser never dispatches the click.
    const el = button.render();
    button.update();
    const iconBefore = el.firstElementChild;

    for (let i = 0; i < 20; i++) {
      button.update();
    }

    expect(el.firstElementChild).toBe(iconBefore);
  });

  it('removes its element on destroy', () => {
    const el = button.render();
    document.body.appendChild(el);

    button.destroy();

    expect(document.body.contains(el)).toBe(false);
  });

  describe('Replay on an ended stream', () => {
    /** A TimeRanges stand-in with the given [start, end] pairs. */
    const timeRanges = (pairs: Array<[number, number]>): TimeRanges =>
      ({
        length: pairs.length,
        start: (i: number) => (pairs[i] ?? [0, 0])[0],
        end: (i: number) => (pairs[i] ?? [0, 0])[1],
      }) as unknown as TimeRanges;

    /** Set what the element reports as its duration and seekable window. */
    const setElementTimeline = (duration: number, seekable: Array<[number, number]>): HTMLVideoElement => {
      const video = api.container.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: duration, configurable: true });
      Object.defineProperty(video, 'seekable', { value: timeRanges(seekable), configurable: true });
      return video;
    };

    it('hls.js: an ENDLIST after a live window seeks to the start of the recording', () => {
      api.__state.source = { src: 'https://cdn.example.com/event.m3u8', type: 'application/x-mpegURL' };
      setElementTimeline(Infinity, [[100, 400]]);
      api.__state.live = true;
      api.__state.seekableRange = { start: 100, end: 400 };
      api.__state.playing = true;
      button.update();

      // The ENDLIST level update: hls.js sets live false, clears the window,
      // and the element now reports a finite duration over a VOD window.
      api.__state.playing = false;
      api.__state.paused = true;
      api.__state.live = false;
      api.__state.seekableRange = null;
      const video = setElementTimeline(300, [[0, 300]]);
      video.currentTime = 300;
      api.__state.playbackState = 'ended';
      setElementEnded(true);
      button.update();
      expect(button.render().getAttribute('aria-label')).toBe('Replay');

      button.render().click();

      expect(video.currentTime).toBe(0);
      expect(video.play).toHaveBeenCalled();
      expect(api.emit).not.toHaveBeenCalledWith('live:seektolive', undefined);
      expect(api.emit).not.toHaveBeenCalledWith('media:load-request', expect.anything());
      expect(api.logger.warn).not.toHaveBeenCalled();
    });

    it('native: durationchange to Infinity, then to a finite value, then ended restarts the recording', () => {
      api.__state.source = { src: 'https://cdn.example.com/event.m3u8', type: 'application/x-mpegURL' };
      // Native never clears `live`, so it stays set through the whole sequence.
      api.__state.live = true;
      setElementTimeline(Infinity, [[0, 90]]);
      api.__state.playing = true;
      button.update();

      // durationchange to a finite value: the playlist ended, live stays true.
      api.__state.playing = false;
      api.__state.paused = true;
      const video = setElementTimeline(90, [[0, 90]]);
      video.currentTime = 90;
      setElementEnded(true);
      api.__state.playbackState = 'ended';
      button.update();
      expect(button.render().getAttribute('aria-label')).toBe('Replay');

      button.render().click();

      expect(video.currentTime).toBe(0);
      expect(video.play).toHaveBeenCalled();
      expect(api.emit).not.toHaveBeenCalledWith('live:seektolive', undefined);
      expect(api.emit).not.toHaveBeenCalledWith('media:load-request', expect.anything());
    });

    it('a sliding window that ended replays from the window start, not from 0', () => {
      setElementTimeline(600, [[120, 600]]);
      const video = api.container.querySelector('video')!;
      video.currentTime = 600;
      setElementEnded(true);
      api.__state.playbackState = 'ended';
      button.update();

      button.render().click();

      expect(video.currentTime).toBe(120);
      expect(video.play).toHaveBeenCalled();
    });

    it('an element that ended with an infinite duration reloads the source with autoplay', () => {
      const src = 'https://cdn.example.com/stalled/index.m3u8';
      api.__state.source = { src, type: 'application/x-mpegURL' };
      const video = setElementTimeline(Infinity, [[100, 400]]);
      const setTime = vi.fn();
      Object.defineProperty(video, 'currentTime', { get: () => 0, set: setTime, configurable: true });
      setElementEnded(true);
      api.__state.playbackState = 'ended';
      button.update();

      button.render().click();

      expect(setTime).not.toHaveBeenCalled();
      const loadRequests = vi
        .mocked(api.emit)
        .mock.calls.filter(([event]) => event === 'media:load-request');
      expect(loadRequests).toEqual([['media:load-request', { src, autoplay: true }]]);
    });

    it('a VOD that ended still restarts at 0 (regression guard)', () => {
      setElementTimeline(600, [[0, 600]]);
      const video = api.container.querySelector('video')!;
      video.currentTime = 600;
      setElementEnded(true);
      api.__state.playbackState = 'ended';
      button.update();

      button.render().click();

      expect(video.currentTime).toBe(0);
      expect(video.play).toHaveBeenCalled();
      expect(api.emit).not.toHaveBeenCalledWith('media:load-request', expect.anything());
    });
  });
});
