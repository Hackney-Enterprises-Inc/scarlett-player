/**
 * Drag-to-scrub integration (task 3.5), wired through the plugin with a fake
 * video element in a jsdom container. The pointer channel is driven exactly
 * like selector.test.ts does (jsdom has no PointerEvent constructor, so
 * `MouseEvent('pointerdown' | ...)` stands in), and the plugin's overlay
 * callbacks (pause/suspend, throttled seek, seek-to-start/resume/play-restore)
 * are asserted against the recorded `currentTime` writes.
 *
 * The seek throttle runs on Date.now, so the throttle test fakes system time
 * to land moves at controlled offsets.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import type { ClipsPluginConfig } from '../src/types';
import { createClipsPlugin } from '../src/index';

type Handler = (payload?: unknown) => unknown;

function createMockApi(state: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  container.appendChild(video);
  document.body.appendChild(container);

  const store: Record<string, unknown> = {
    currentTime: 100,
    duration: 600,
    live: false,
    mediaType: 'video',
    seekableRange: null,
    ...state,
  };
  const subs: Array<{ event: string; handler: Handler }> = [];

  const api = {
    pluginId: 'clips',
    container,
    video,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => store[key]),
    setState: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    defineState: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      const entry = { event, handler };
      subs.push(entry);
      return vi.fn(() => {
        const index = subs.indexOf(entry);
        if (index >= 0) subs.splice(index, 1);
      });
    }),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    store,
    fire(event: string, payload?: unknown): void {
      for (const entry of [...subs]) {
        if (entry.event === event) entry.handler(payload);
      }
    },
  };
  return api;
}

type MockApi = ReturnType<typeof createMockApi>;

interface ScrubHarness {
  api: MockApi;
  plugin: ReturnType<typeof createClipsPlugin>;
  video: HTMLVideoElement;
  track: HTMLElement;
  /** The IN handle inside the track, for grabbing at its own position. */
  startHandle: HTMLElement;
  /** The OUT handle inside the track. */
  endHandle: HTMLElement;
  seeks: number[];
  isPlaying: () => boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

/**
 * Open a session with the overlay mounted and a fully instrumented video:
 * every `currentTime` write is recorded in `seeks`, and play/pause state is
 * scriptable (jsdom media elements never actually play).
 */
function setupScrub(
  config: Partial<ClipsPluginConfig> = {},
  options: { playing?: boolean } = {},
): ScrubHarness {
  const api = createMockApi();
  const plugin = createClipsPlugin({
    mediaId: 'video-42',
    // Generous max so drags land where the pointer asks, not on a clamp.
    maxDuration: 300,
    onCreate: vi.fn(),
    ...config,
  });
  plugin.init(api as unknown as IPluginAPI);
  plugin.open(); // preroll with currentTime 100 -> {70, 100}

  const video = api.video;
  const seeks: number[] = [];
  let playing = options.playing ?? false;
  let currentTime = 0;

  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
      seeks.push(value);
    },
  });
  Object.defineProperty(video, 'paused', {
    configurable: true,
    get: () => !playing,
  });
  video.pause = vi.fn(() => {
    playing = false;
  });
  video.play = vi.fn(() => {
    playing = true;
    return Promise.resolve();
  });

  const track = api.container.querySelector<HTMLElement>('.sp-clip-track')!;
  expect(track).not.toBeNull();
  // 600px wide over the 0..600s bounds: clientX == seconds.
  track.getBoundingClientRect = () =>
    ({
      left: 0, top: 0, width: 600, height: 44,
      right: 600, bottom: 44, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;

  return {
    api,
    plugin,
    video,
    track,
    startHandle: track.querySelector<HTMLElement>('[data-clip-handle="start"]')!,
    endHandle: track.querySelector<HTMLElement>('[data-clip-handle="end"]')!,
    seeks,
    isPlaying: () => playing,
    play: video.play as ReturnType<typeof vi.fn>,
    pause: video.pause as ReturnType<typeof vi.fn>,
  };
}

function pointer(target: EventTarget, type: string, clientX: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('drag-to-scrub (task 3.5)', () => {
  it('a drag pauses playback and suspends the preview loop', () => {
    const h = setupScrub({}, { playing: true });
    pointer(h.track, 'pointerdown', 150); // grabs the end handle

    expect(h.pause).toHaveBeenCalledTimes(1);
    expect(h.isPlaying()).toBe(false);

    // The loop is suspended: a timeupdate past the out point must NOT rewind
    // to the selection start (the drag owns the seek).
    h.seeks.length = 0;
    h.api.fire('playback:timeupdate', { currentTime: 500 });
    expect(h.seeks).toEqual([]);

    pointer(h.track, 'pointerup', 150);
  });

  it('seeks during the drag are throttled to <= 1 per 100ms and land on the handle time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const h = setupScrub({}, { playing: false });

    // Grabbed exactly on the out handle (100), so the drag applies no offset
    // and every landed time below is the pointer's own.
    pointer(h.endHandle, 'pointerdown', 100);
    // First move: 1_000_000, throttle window is fresh -> seeks immediately.
    pointer(h.track, 'pointermove', 140);
    // 30ms and 60ms later: inside the window, dropped.
    vi.setSystemTime(1_000_030);
    pointer(h.track, 'pointermove', 145);
    vi.setSystemTime(1_000_060);
    pointer(h.track, 'pointermove', 148);
    // 110ms after the last accepted seek: through.
    vi.setSystemTime(1_000_110);
    pointer(h.track, 'pointermove', 150);
    // 40ms later: dropped again.
    vi.setSystemTime(1_000_150);
    pointer(h.track, 'pointermove', 155);
    pointer(h.track, 'pointerup', 155);

    // Exactly the two allowed mid-drag seeks, at the dragged (end) handle's
    // landed times - not the raw pointer positions that were throttled.
    expect(h.seeks).toEqual([140, 150, 70]); // + the release seek to start
  });

  it('release seeks to the selection start, resumes the loop and plays again after `seeked`', () => {
    const h = setupScrub({}, { playing: true });

    pointer(h.endHandle, 'pointerdown', 100); // out handle; wasPlaying captured
    pointer(h.track, 'pointermove', 150); // drag end -> 150 (first move always seeks)
    expect(h.seeks).toEqual([150]);
    expect(h.play).not.toHaveBeenCalled(); // playing waits for the release + seeked

    h.seeks.length = 0;
    pointer(h.track, 'pointerup', 150);

    // The release seek lands on the in point, and play() is deferred until
    // the media reports the seek done (ProgressBar's no-stutter pattern).
    expect(h.seeks).toEqual([70]);
    expect(h.play).not.toHaveBeenCalled();

    h.video.dispatchEvent(new Event('seeked'));
    expect(h.play).toHaveBeenCalledTimes(1);
    expect(h.isPlaying()).toBe(true);

    // The loop is live again over the dragged selection {70, 150}.
    h.seeks.length = 0;
    h.api.fire('playback:timeupdate', { currentTime: 150 });
    expect(h.seeks).toEqual([70]);
  });

  it('a drag that started while paused does not resume playback', () => {
    const h = setupScrub({}, { playing: false });

    pointer(h.track, 'pointerdown', 150);
    pointer(h.track, 'pointermove', 150);
    pointer(h.track, 'pointerup', 150);
    h.video.dispatchEvent(new Event('seeked'));

    expect(h.play).not.toHaveBeenCalled();
  });

  it('drag moves route committed selections through clip:changed { reason: user }', () => {
    const h = setupScrub({}, { playing: false });

    pointer(h.endHandle, 'pointerdown', 100);
    pointer(h.track, 'pointermove', 160);
    pointer(h.track, 'pointerup', 160);

    const changed = h.api.emit.mock.calls
      .filter(([name]) => name === 'clip:changed')
      .map(([, payload]) => payload);
    expect(changed).toContainEqual({ start: 70, end: 160, reason: 'user' });
    expect(h.api.store.clipSelection).toEqual({ start: 70, end: 160 });
  });

  it('a host setRange() landing mid-drag does not re-arm the suspended loop', () => {
    const h = setupScrub({}, { playing: true });
    pointer(h.track, 'pointerdown', 150); // drag owns the media, loop suspended

    h.plugin.setRange(200, 260); // host-driven change under the drag
    h.seeks.length = 0;
    h.api.fire('playback:timeupdate', { currentTime: 600 });
    // Retargeted, but NOT resumed: no rewind seek while the drag lives.
    expect(h.seeks).toEqual([]);

    pointer(h.track, 'pointerup', 150);
    // Release: selector continued from the host's selection - lands on its
    // in point...
    expect(h.seeks).toEqual([200]);
    h.seeks.length = 0;
    // ...and the loop runs over it again.
    h.api.fire('playback:timeupdate', { currentTime: 261 });
    expect(h.seeks).toEqual([200]);
  });

  it('closing mid-drag tears the panel down; the dangling release does nothing', () => {
    const h = setupScrub({}, { playing: true });
    pointer(h.track, 'pointerdown', 150);
    pointer(h.track, 'pointermove', 150);

    // A source change tears the session down while the pointer is still down.
    h.api.fire('media:load-request', { src: 'next.m3u8' });

    expect(h.api.container.querySelector('.sp-clip-editor')).toBeNull();
    // The dangling pointerup lands on a destroyed selector's detached track:
    // nothing throws and nothing new seeks.
    const before = h.seeks.length;
    expect(() => pointer(h.track, 'pointerup', 150)).not.toThrow();
    expect(h.seeks.length).toBe(before);
    // The captured play intent is dropped with the session, not applied later.
    h.video.dispatchEvent(new Event('seeked'));
    expect(h.play).not.toHaveBeenCalled();
  });
});
