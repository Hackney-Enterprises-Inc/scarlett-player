/**
 * PlayButton Control Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayButton } from '../../src/controls/PlayButton';
import type { MockPluginAPI } from '../mock-api';

function createMockApi(): MockPluginAPI {
  const state: Record<string, unknown> = {
    playing: false,
    paused: true,
    ended: false,
  };

  const container = document.createElement('div');
  const video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
  video.pause = vi.fn();
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
    defineState: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  };
}

describe('PlayButton', () => {
  let api: ReturnType<typeof createMockApi>;
  let button: PlayButton;

  beforeEach(() => {
    api = createMockApi();
    button = new PlayButton(api);
  });

  afterEach(() => {
    button.destroy();
  });

  it('should render a button element', () => {
    const el = button.render();
    expect(el.tagName).toBe('BUTTON');
    expect(el.classList.contains('sp-play')).toBe(true);
  });

  it('should have play icon when paused', () => {
    button.update();
    const el = button.render();
    expect(el.innerHTML).toContain('svg');
    expect(el.getAttribute('aria-label')).toBe('Play');
  });

  it('should have pause icon when playing', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return true;
      if (key === 'paused') return false;
      if (key === 'ended') return false;
      return null;
    });

    button.update();
    const el = button.render();
    expect(el.getAttribute('aria-label')).toBe('Pause');
  });

  it('should have replay icon when ended', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return false;
      if (key === 'paused') return true;
      if (key === 'ended') return true;
      return null;
    });

    button.update();
    const el = button.render();
    expect(el.getAttribute('aria-label')).toBe('Replay');
  });

  // Regression for the stale `ended` key (found in wave 3, fixed 2026-09-02):
  // the key was written true by both providers and reset only by core's
  // load(), so once a viewer replayed a video this button kept the Replay
  // glyph over playing video for the rest of the session. The providers now
  // clear the key from their play, playing and seeking handlers; this is the
  // control that has to follow it back.
  it('should leave the Replay label once the ended key is cleared', () => {
    const el = button.render();

    api.setState('ended', true);
    button.update();
    expect(el.getAttribute('aria-label')).toBe('Replay');

    // What a provider now does when playback leaves the end of the media.
    api.setState('ended', false);
    api.setState('playing', true);
    button.update();

    expect(el.getAttribute('aria-label')).toBe('Pause');
  });

  it('should call video.play() when clicked while paused', () => {
    const video = api.container.querySelector('video')!;
    button.render().click();
    expect(video.play).toHaveBeenCalled();
  });

  it('should call video.pause() when clicked while playing', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'playing') return true;
      return false;
    });

    const video = api.container.querySelector('video')!;
    // The toggle() method checks video.paused directly on the DOM element,
    // so we need to simulate the video actually playing
    Object.defineProperty(video, 'paused', { value: false, writable: true });
    button.render().click();
    expect(video.pause).toHaveBeenCalled();
  });

  it('should seek to 0 and play when clicked while ended', () => {
    (api.getState as any).mockImplementation((key: string) => {
      if (key === 'ended') return true;
      return false;
    });

    const video = api.container.querySelector('video')!;
    button.render().click();
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalled();
  });

  // Regression: update() runs on every state change (timeupdate/progress fire
  // several times a second). Rebuilding the icon each time removes the node
  // that received the user's mousedown, so the browser never dispatches the
  // click and the press is silently swallowed.
  describe('idempotent rendering', () => {
    it('should not replace icon child nodes when state is unchanged', () => {
      const el = button.render();
      button.update();

      const iconBefore = el.firstElementChild;
      expect(iconBefore).not.toBeNull();

      for (let i = 0; i < 20; i++) {
        button.update();
      }

      // Same node object, never torn out and rebuilt
      expect(el.firstElementChild).toBe(iconBefore);
    });

    it('should record no DOM mutations across repeated no-op updates', () => {
      const el = button.render();
      document.body.appendChild(el);
      button.update();

      const records: MutationRecord[] = [];
      const observer = new MutationObserver((recs) => records.push(...recs));
      observer.observe(el, { childList: true, subtree: true, attributes: true });

      for (let i = 0; i < 10; i++) {
        button.update();
      }

      // Flush microtask queue so the observer delivers
      return Promise.resolve().then(() => {
        observer.disconnect();
        expect(records).toHaveLength(0);
      });
    });

    it('should still swap the icon when playing state actually changes', () => {
      const el = button.render();
      button.update();
      const pausedIcon = el.innerHTML;

      (api.getState as any).mockImplementation((key: string) => key === 'playing');
      button.update();

      expect(el.innerHTML).not.toBe(pausedIcon);
      expect(el.getAttribute('aria-label')).toBe('Pause');
    });
  });

  describe('Replay on an ended stream', () => {
    const timeRanges = (pairs: Array<[number, number]>): TimeRanges =>
      ({
        length: pairs.length,
        start: (i: number) => (pairs[i] ?? [0, 0])[0],
        end: (i: number) => (pairs[i] ?? [0, 0])[1],
      }) as unknown as TimeRanges;

    const setElementTimeline = (duration: number, seekable: Array<[number, number]>): HTMLVideoElement => {
      const video = api.container.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: duration, configurable: true });
      Object.defineProperty(video, 'seekable', { value: timeRanges(seekable), configurable: true });
      return video;
    };

    it('native: durationchange to Infinity, then finite, then ended restarts the recording at 0', () => {
      api.setState('live', true);
      setElementTimeline(Infinity, [[0, 90]]);
      setElementTimeline(90, [[0, 90]]);
      api.setState('ended', true);
      button.update();

      const video = api.container.querySelector('video')!;
      button.render().click();

      expect(video.currentTime).toBe(0);
      expect(api.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
      expect(api.emit).not.toHaveBeenCalledWith('live:seektolive', undefined);
    });

    it('a sliding window that ended replays from the window start and announces it', () => {
      setElementTimeline(600, [[120, 600]]);
      api.setState('ended', true);

      const video = api.container.querySelector('video')!;
      button.render().click();

      expect(video.currentTime).toBe(120);
      expect(api.emit).toHaveBeenCalledWith('playback:seeking', { time: 120 });
      expect(video.play).toHaveBeenCalled();
    });

    it('an element that ended with an infinite duration reloads the source with autoplay', () => {
      const src = 'https://cdn.example.com/stalled/index.m3u8';
      api.setState('source', { src, type: 'application/x-mpegURL' });
      const video = setElementTimeline(Infinity, [[100, 400]]);
      const setTime = vi.fn();
      Object.defineProperty(video, 'currentTime', { get: () => 0, set: setTime, configurable: true });
      api.setState('ended', true);

      button.render().click();

      expect(setTime).not.toHaveBeenCalled();
      expect(api.emit).toHaveBeenCalledWith('media:load-request', { src, autoplay: true });
      expect(api.emit).not.toHaveBeenCalledWith('playback:seeking', expect.anything());
    });

    it('a VOD that ended still restarts at 0 (regression guard)', () => {
      setElementTimeline(600, [[0, 600]]);
      api.setState('ended', true);

      const video = api.container.querySelector('video')!;
      button.render().click();

      expect(video.currentTime).toBe(0);
      expect(api.emit).toHaveBeenCalledWith('playback:seeking', { time: 0 });
      expect(api.emit).not.toHaveBeenCalledWith('media:load-request', expect.anything());
    });
  });

  it('should remove element on destroy', () => {
    const el = button.render();
    document.body.appendChild(el);
    expect(document.body.contains(el)).toBe(true);

    button.destroy();
    expect(document.body.contains(el)).toBe(false);
  });
});
