/**
 * Replay helper tests.
 *
 * Replay keys on the element's duration, not on `live`: hls.js clears `live`
 * on ENDLIST while native leaves it set, so `live` cannot say whether the
 * stream is a finished recording. These cases pin the three outcomes: a seek
 * to the start of the window, a seek to 0 when there is no window, and a
 * reload when the element ended without a finite duration.
 */

import { describe, it, expect, vi } from 'vitest';
import { replayFromEnd } from '../../src/controls/replay';
import type { MockPluginAPI } from '../mock-api';

function createApi(source: unknown = null, plugins: Record<string, unknown> = {}): MockPluginAPI {
  const state: Record<string, unknown> = { source };
  return {
    pluginId: 'test',
    container: document.createElement('div'),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn((id: string) => plugins[id] ?? null),
    defineState: vi.fn(),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
  } as unknown as MockPluginAPI;
}

/** A TimeRanges stand-in with the given [start, end] pairs. */
function timeRanges(pairs: Array<[number, number]>): TimeRanges {
  return {
    length: pairs.length,
    start: (i: number) => (pairs[i] ?? [0, 0])[0],
    end: (i: number) => (pairs[i] ?? [0, 0])[1],
  } as unknown as TimeRanges;
}

/** A media element whose duration and seekable window are set, with a spied currentTime. */
function createVideo(duration: number, seekable: Array<[number, number]>) {
  const video = document.createElement('video');
  Object.defineProperty(video, 'duration', { value: duration, configurable: true });
  Object.defineProperty(video, 'seekable', { value: timeRanges(seekable), configurable: true });
  const setTime = vi.fn();
  Object.defineProperty(video, 'currentTime', {
    get: () => 0,
    set: setTime,
    configurable: true,
  });
  return { video, setTime };
}

describe('replayFromEnd', () => {
  it('seeks a finite sliding window to its start, not to 0', () => {
    const api = createApi();
    const { video, setTime } = createVideo(600, [[120, 600]]);

    const target = replayFromEnd(api, video);

    expect(target).toBe(120);
    expect(setTime).toHaveBeenCalledTimes(1);
    expect(setTime).toHaveBeenCalledWith(120);
  });

  /**
   * Review finding (Sol, P2): an hls.js sliding window that ended with
   * ENDLIST at 120-600. The MSE element's finite `seekable` is 0-600, so the
   * start has to come from the provider's final playlist.
   */
  it("seeks an ended hls.js sliding window to the playlist's start, not the MSE range start", () => {
    const api = createApi(null, { 'hls-provider': { getPlaylistStart: () => 120 } });
    const { video, setTime } = createVideo(600, [[0, 600]]);

    expect(replayFromEnd(api, video)).toBe(120);
    expect(setTime).toHaveBeenCalledWith(120);
  });

  it('uses the element range when the HLS provider has no playlist start (native)', () => {
    const api = createApi(null, { 'hls-provider': { getPlaylistStart: () => null } });
    const { video, setTime } = createVideo(600, [[120, 600]]);

    expect(replayFromEnd(api, video)).toBe(120);
    expect(setTime).toHaveBeenCalledWith(120);
  });

  it('ignores a playlist start outside the finite duration', () => {
    const api = createApi(null, { 'hls-provider': { getPlaylistStart: () => 900 } });
    const { video, setTime } = createVideo(600, [[0, 600]]);

    expect(replayFromEnd(api, video)).toBe(0);
    expect(setTime).toHaveBeenCalledWith(0);
  });

  it('seeks a finite VOD window to 0', () => {
    const api = createApi();
    const { video, setTime } = createVideo(600, [[0, 600]]);

    expect(replayFromEnd(api, video)).toBe(0);
    expect(setTime).toHaveBeenCalledWith(0);
  });

  it('seeks to 0 when the element reports no seekable ranges', () => {
    const api = createApi();
    const { video, setTime } = createVideo(600, []);

    expect(replayFromEnd(api, video)).toBe(0);
    expect(setTime).toHaveBeenCalledWith(0);
  });

  it('never calls seekToLive() and never warns on a finite duration', () => {
    const api = createApi();
    const { video } = createVideo(600, [[120, 600]]);

    replayFromEnd(api, video);

    expect(api.emit).not.toHaveBeenCalledWith('live:seektolive', undefined);
    expect(api.logger.warn).not.toHaveBeenCalled();
  });

  it('reloads the current source with autoplay when the duration is infinite', () => {
    const src = 'https://cdn.example.com/live/index.m3u8';
    const api = createApi({ src, type: 'application/x-mpegURL' });
    const { video, setTime } = createVideo(Infinity, [[100, 400]]);

    const target = replayFromEnd(api, video);

    expect(target).toBeNull();
    expect(setTime).not.toHaveBeenCalled();
    expect(api.emit).toHaveBeenCalledTimes(1);
    expect(api.emit).toHaveBeenCalledWith('media:load-request', { src, autoplay: true });
  });

  it('does nothing when the duration is infinite and no source is loaded', () => {
    const api = createApi(null);
    const { video, setTime } = createVideo(Infinity, [[100, 400]]);

    expect(replayFromEnd(api, video)).toBeNull();
    expect(setTime).not.toHaveBeenCalled();
    expect(api.emit).not.toHaveBeenCalled();
  });
});
