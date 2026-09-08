/**
 * Live metrics tests (LL-HLS phase 1).
 *
 * `live-metrics.ts` is the single writer for `liveLatency`, `liveEdge`,
 * `seekableRange` and `lowLatencyMode`. These suites pin the three things that
 * made low latency impossible before it existed:
 *
 *   - the edge threshold is latency-relative, not a fixed 10 seconds;
 *   - effective LL is derived from the manifest, not from the config flag;
 *   - the `timeupdate` handler can no longer clobber what `hlsLevelLoaded`
 *     computed (the regression suite at the bottom fails without the fix).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import {
  applyLiveMetrics,
  computeLiveMetrics,
  resetLiveMetrics,
  DEFAULT_TARGET_LATENCY,
  MIN_EDGE_TOLERANCE,
  NATIVE_EDGE_TOLERANCE,
  type HlsLevelDetails,
} from '../src/live-metrics';
import { setupHlsEventHandlers, setupVideoEventHandlers } from '../src/event-map';
import type { HlsInstance } from '../src/types';
import { createMockAPI, type MockPluginAPI } from './helpers';

/** A media element stub with exactly the two members the metrics read. */
const fakeMedia = (currentTime: number, start: number | null, end?: number): HTMLMediaElement =>
  ({
    currentTime,
    seekable:
      start === null
        ? { length: 0, start: () => 0, end: () => 0 }
        : { length: 1, start: () => start, end: () => end as number },
  }) as unknown as HTMLMediaElement;

/** An hls.js stub carrying only the live fields the metrics read. */
const fakeHls = (
  fields: Partial<Pick<HlsInstance, 'latency' | 'targetLatency' | 'media'>>
): HlsInstance => ({ media: null, ...fields }) as unknown as HlsInstance;

/** An LL-HLS level-details object: 4s segments, 1s parts, 3s part hold-back. */
const llDetails = (overrides: Partial<HlsLevelDetails> = {}): HlsLevelDetails => ({
  live: true,
  targetduration: 4,
  partTarget: 1,
  partHoldBack: 3,
  partList: [{}, {}, {}],
  canBlockReload: true,
  fragmentStart: 100,
  edge: 160,
  ...overrides,
});

/**
 * A state-backed mock API: `getState` answers what `setState` last wrote, so
 * the change-only writes in applyLiveMetrics can be observed at all.
 */
function createStatefulApi(initial: Record<string, unknown> = {}): MockPluginAPI {
  const api = createMockAPI();
  const state: Record<string, unknown> = {
    live: false,
    liveEdge: false,
    liveLatency: 0,
    seekableRange: null,
    lowLatencyMode: false,
    ...initial,
  };

  (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => state[key]);
  (api.setState as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: unknown) => {
    state[key] = value;
  });

  return api;
}

describe('computeLiveMetrics() - hls.js source', () => {
  it('reports hls.js latency and target latency verbatim', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2.4, targetLatency: 3 }),
      details: llDetails(),
    });

    expect(metrics?.latency).toBe(2.4);
    expect(metrics?.targetLatency).toBe(3);
  });

  it('takes the DVR window from level details, not from video.seekable', () => {
    // Under MSE seekable.start(0) stays 0 rather than following the sliding
    // window; the details carry the real one.
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, targetLatency: 3, media: fakeMedia(150, 0, 160) }),
      details: llDetails({ fragmentStart: 100, edge: 160 }),
    });

    expect(metrics?.seekableRange).toEqual({ start: 100, end: 160 });
  });

  it('falls back to video.seekable when no details have been seen', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, targetLatency: 3, media: fakeMedia(150, 20, 160) }),
      details: null,
    });

    expect(metrics?.seekableRange).toEqual({ start: 20, end: 160 });
  });

  it('places the window end on the timeline when details carry no edge', () => {
    // `totalduration` is the LENGTH of the window, not a position: on a
    // sliding playlist it has to be added to the window start. Used raw it
    // reported an end (60) behind the viewer (150), i.e. a backwards DVR bar
    // and a fallback latency pinned at 0.
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: undefined, targetLatency: 3, media: fakeMedia(150, 0, 160) }),
      details: llDetails({ fragmentStart: 100, edge: undefined, totalduration: 60 }),
    });

    expect(metrics?.seekableRange).toEqual({ start: 100, end: 160 });
    expect(metrics?.latency).toBe(10);
  });

  it('falls back to the distance to the edge before hls.js has a latency', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: undefined, targetLatency: 3, media: fakeMedia(154, 100, 160) }),
      details: llDetails(),
    });

    expect(metrics?.latency).toBe(6);
  });

  it('derives the target latency from PART-HOLD-BACK when hls.js has none', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, media: fakeMedia(150, 100, 160) }),
      details: llDetails({ partHoldBack: 2.5 }),
    });

    expect(metrics?.targetLatency).toBe(2.5);
  });

  it('derives the target latency from HOLD-BACK on a plain live playlist', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, media: fakeMedia(150, 100, 160) }),
      details: { live: true, targetduration: 6, holdBack: 18, edge: 160 },
    });

    expect(metrics?.targetLatency).toBe(18);
  });

  it('falls back to three target durations, then to the default', () => {
    const fromDuration = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, media: fakeMedia(150, 100, 160) }),
      details: { live: true, targetduration: 6, edge: 160 },
    });
    expect(fromDuration?.targetLatency).toBe(18);

    const fromNothing = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: 2, media: fakeMedia(150, 100, 160) }),
      details: null,
    });
    expect(fromNothing?.targetLatency).toBe(DEFAULT_TARGET_LATENCY);
  });

  it('ignores NaN and Infinity from hls.js', () => {
    const metrics = computeLiveMetrics({
      kind: 'hls',
      hls: fakeHls({ latency: NaN, targetLatency: Infinity, media: fakeMedia(154, 100, 160) }),
      details: llDetails(),
    });

    expect(metrics?.latency).toBe(6);
    expect(metrics?.targetLatency).toBe(3); // partHoldBack
  });

  it('returns null when neither latency nor a window can be measured', () => {
    expect(
      computeLiveMetrics({ kind: 'hls', hls: fakeHls({ media: null }), details: null })
    ).toBeNull();
  });

  // --- The edge threshold: latency > targetLatency + tolerance ---

  describe('edge threshold', () => {
    // targetLatency 3, partTarget 1 -> tolerance max(1.5, 1) = 1.5 -> 4.5s
    const at = (latency: number) =>
      computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency, targetLatency: 3, media: fakeMedia(150, 100, 160) }),
        details: llDetails(),
      })?.atEdge;

    it('is at the edge exactly on the boundary', () => {
      expect(at(4.5)).toBe(true);
    });

    it('is behind just past the boundary', () => {
      expect(at(4.6)).toBe(false);
    });

    it('is behind at 6s on a 3s-target stream', () => {
      // The case the old `latency < 10` could never report
      expect(at(6)).toBe(false);
    });

    it('uses the part target as the tolerance when it exceeds the floor', () => {
      // partTarget 2 -> tolerance 2 -> boundary 5
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 5, targetLatency: 3, media: fakeMedia(150, 100, 160) }),
        details: llDetails({ partTarget: 2 }),
      });
      expect(metrics?.atEdge).toBe(true);
    });

    it('floors the tolerance so a sub-second part target cannot make it twitch', () => {
      // partTarget 0.2 would give a 3.2s boundary; the floor keeps it at 4.5
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 4.4, targetLatency: 3, media: fakeMedia(150, 100, 160) }),
        details: llDetails({ partTarget: 0.2 }),
      });
      expect(metrics?.atEdge).toBe(true);
      expect(MIN_EDGE_TOLERANCE).toBe(1.5);
    });

    it('uses half a segment as the tolerance on a playlist without parts', () => {
      // targetduration 10 -> tolerance 5, target 30 (3 x 10) -> boundary 35
      const details: HlsLevelDetails = { live: true, targetduration: 10, edge: 160 };
      const behind = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 35.5, media: fakeMedia(120, 100, 160) }),
        details,
      });
      const atEdge = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 35, media: fakeMedia(120, 100, 160) }),
        details,
      });

      expect(behind?.atEdge).toBe(false);
      expect(atEdge?.atEdge).toBe(true);
    });
  });

  // --- Effective LL, not requested LL ---

  describe('effective low latency', () => {
    it('is true when the playlist carries parts', () => {
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 2, targetLatency: 3 }),
        details: llDetails({ canBlockReload: false }),
      });
      expect(metrics?.lowLatency).toBe(true);
    });

    it('is true when the playlist advertises blocking reloads', () => {
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 2, targetLatency: 3 }),
        details: llDetails({ partList: [] }),
      });
      expect(metrics?.lowLatency).toBe(true);
    });

    it('is false on a plain live playlist, whatever the host requested', () => {
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 2, targetLatency: 3 }),
        details: { live: true, targetduration: 6, edge: 160 },
        lowLatencyRequested: true,
      });
      expect(metrics?.lowLatency).toBe(false);
    });

    it('is false on an LL manifest the host did not ask for LL on', () => {
      // hls.js will not load the parts, so latency is not low - a badge here
      // would tell the viewer something untrue.
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 2, targetLatency: 3 }),
        details: llDetails(),
        lowLatencyRequested: false,
      });
      expect(metrics?.lowLatency).toBe(false);
    });

    it('assumes the request when the caller does not say', () => {
      const metrics = computeLiveMetrics({
        kind: 'hls',
        hls: fakeHls({ latency: 2, targetLatency: 3 }),
        details: llDetails(),
      });
      expect(metrics?.lowLatency).toBe(true);
    });
  });
});

describe('computeLiveMetrics() - media element source', () => {
  it('approximates latency as the distance to the seekable end', () => {
    const metrics = computeLiveMetrics({ kind: 'media', media: fakeMedia(154, 100, 160) });

    expect(metrics?.latency).toBe(6);
    expect(metrics?.seekableRange).toEqual({ start: 100, end: 160 });
  });

  it('never reports a negative latency past the edge', () => {
    const metrics = computeLiveMetrics({ kind: 'media', media: fakeMedia(162, 100, 160) });
    expect(metrics?.latency).toBe(0);
  });

  it('keeps the historical 10s threshold when no target latency is known', () => {
    // Nothing on the native path exposes the hold-back, and Safari parks a
    // standard live viewer three target durations back by design.
    expect(computeLiveMetrics({ kind: 'media', media: fakeMedia(151, 100, 160) })?.atEdge).toBe(
      true
    );
    expect(computeLiveMetrics({ kind: 'media', media: fakeMedia(149, 100, 160) })?.atEdge).toBe(
      false
    );
    expect(DEFAULT_TARGET_LATENCY + NATIVE_EDGE_TOLERANCE).toBe(10);
  });

  it('tightens the threshold once a target latency is carried over', () => {
    // target 2 -> tolerance max(1.5, 1) = 1.5 -> boundary 3.5
    const atEdge = computeLiveMetrics({
      kind: 'media',
      media: fakeMedia(156.5, 100, 160),
      targetLatency: 2,
    });
    const behind = computeLiveMetrics({
      kind: 'media',
      media: fakeMedia(156.4, 100, 160),
      targetLatency: 2,
    });

    expect(atEdge?.atEdge).toBe(true);
    expect(behind?.atEdge).toBe(false);
  });

  it('carries the effective-LL flag across a handoff', () => {
    const metrics = computeLiveMetrics({
      kind: 'media',
      media: fakeMedia(158, 100, 160),
      targetLatency: 2,
      lowLatency: true,
    });

    expect(metrics?.lowLatency).toBe(true);
  });

  it('returns null when the element reports no seekable range', () => {
    expect(computeLiveMetrics({ kind: 'media', media: fakeMedia(0, null) })).toBeNull();
  });
});

describe('applyLiveMetrics()', () => {
  let api: MockPluginAPI;

  beforeEach(() => {
    api = createStatefulApi();
  });

  const metrics = {
    latency: 2.4,
    targetLatency: 3,
    atEdge: true,
    seekableRange: { start: 100, end: 160 },
    lowLatency: true,
  };

  it('writes every live key and announces each change once', () => {
    applyLiveMetrics(api, metrics);

    expect(api.getState('liveLatency')).toBe(2.4);
    expect(api.getState('liveEdge')).toBe(true);
    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });
    expect(api.getState('lowLatencyMode')).toBe(true);

    expect(api.emit).toHaveBeenCalledWith('live:latency', { latency: 2.4 });
    expect(api.emit).toHaveBeenCalledWith('live:edgechange', { atEdge: true });
    expect(api.emit).toHaveBeenCalledWith('live:seekablerange', { start: 100, end: 160 });
    expect(api.emit).toHaveBeenCalledWith('live:lowlatency', { enabled: true });
  });

  it('emits nothing on a restatement, so a 4Hz timeupdate cannot spam the bus', () => {
    applyLiveMetrics(api, metrics);
    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    applyLiveMetrics(api, metrics);

    expect(api.emit).not.toHaveBeenCalled();
  });

  it('ignores floating-point noise below the epsilon', () => {
    applyLiveMetrics(api, metrics);
    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    applyLiveMetrics(api, { ...metrics, latency: 2.41 });

    expect(api.emit).not.toHaveBeenCalled();
    expect(api.getState('liveLatency')).toBe(2.4);
  });

  it('emits only the key that actually moved', () => {
    applyLiveMetrics(api, metrics);
    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    applyLiveMetrics(api, { ...metrics, atEdge: false });

    expect(api.emit).toHaveBeenCalledTimes(1);
    expect(api.emit).toHaveBeenCalledWith('live:edgechange', { atEdge: false });
  });

  it('is a no-op on an unmeasurable moment rather than a reset', () => {
    applyLiveMetrics(api, metrics);
    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    applyLiveMetrics(api, null);

    expect(api.getState('liveEdge')).toBe(true);
    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });
    expect(api.emit).not.toHaveBeenCalled();
  });

  it('leaves a known window alone when a later snapshot has none', () => {
    applyLiveMetrics(api, metrics);
    applyLiveMetrics(api, { ...metrics, seekableRange: null });

    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });
  });
});

describe('resetLiveMetrics()', () => {
  it('clears the LL badge, latency and window and announces the badge going off', () => {
    const api = createStatefulApi();
    applyLiveMetrics(api, {
      latency: 2.4,
      targetLatency: 3,
      atEdge: true,
      seekableRange: { start: 100, end: 160 },
      lowLatency: true,
    });
    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    resetLiveMetrics(api);

    expect(api.getState('lowLatencyMode')).toBe(false);
    expect(api.getState('liveLatency')).toBe(0);
    expect(api.getState('liveEdge')).toBe(false);
    expect(api.getState('seekableRange')).toBeNull();
    expect(api.emit).toHaveBeenCalledWith('live:lowlatency', { enabled: false });
  });

  it('does not announce a badge that was already off', () => {
    const api = createStatefulApi();
    resetLiveMetrics(api);

    expect(api.emit).not.toHaveBeenCalledWith('live:lowlatency', expect.anything());
  });
});

/**
 * The clobber regression.
 *
 * `hlsLevelLoaded` computes the edge flag from the playlist; the `timeupdate`
 * handler then runs 4x a second. Before live-metrics.ts the second one
 * recomputed `liveEdge` unconditionally as `latency < 10` off `video.seekable`,
 * so on a 3s-target stream a viewer 6s behind was reported at the edge and
 * "GO LIVE" could never appear. These fail on the pre-LL tree.
 */
describe('liveEdge survives a timeupdate tick', () => {
  let api: MockPluginAPI;
  let video: HTMLVideoElement;
  let hls: HlsInstance;
  let handlers: Record<string, (...args: unknown[]) => void>;

  /** Position the viewer 6s behind a 160s edge on a 3s-target LL stream. */
  const LATENCY_BEHIND = 6;

  beforeEach(() => {
    api = createStatefulApi({ live: true });

    video = document.createElement('video');
    Object.defineProperty(video, 'currentTime', { value: 154, configurable: true });
    Object.defineProperty(video, 'duration', { value: NaN, configurable: true });
    // Under MSE the element reports a window starting at 0 - the source the
    // old code trusted, and the reason it read `latency < 10` as "at the edge".
    Object.defineProperty(video, 'seekable', {
      value: { length: 1, start: () => 0, end: () => 160 },
      configurable: true,
    });

    handlers = {};
    hls = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      },
      off: vi.fn(),
      media: video,
      latency: LATENCY_BEHIND,
      targetLatency: 3,
      levels: [],
      currentLevel: -1,
      audioTracks: [],
      audioTrack: -1,
    } as unknown as HlsInstance;
  });

  it('stays behind after a tick, and the DVR window keeps the sliding start', () => {
    setupHlsEventHandlers(hls, api as IPluginAPI, {});
    const cleanupVideo = setupVideoEventHandlers(video, api as IPluginAPI, () =>
      computeLiveMetrics({ kind: 'hls', hls, details: llDetails() })
    );

    handlers['hlsLevelLoaded']?.('hlsLevelLoaded', { details: llDetails() });

    expect(api.getState('live')).toBe(true);
    expect(api.getState('liveEdge')).toBe(false);
    expect(api.getState('lowLatencyMode')).toBe(true);
    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });

    video.dispatchEvent(new Event('timeupdate'));

    expect(api.getState('liveEdge')).toBe(false);
    expect(api.getState('liveLatency')).toBe(LATENCY_BEHIND);
    // Not { start: 0, end: 160 }: the element's window is wrong under MSE
    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });

    cleanupVideo();
  });

  it('reports the edge again once the viewer catches up', () => {
    setupHlsEventHandlers(hls, api as IPluginAPI, {});
    const cleanupVideo = setupVideoEventHandlers(video, api as IPluginAPI, () =>
      computeLiveMetrics({ kind: 'hls', hls, details: llDetails() })
    );

    handlers['hlsLevelLoaded']?.('hlsLevelLoaded', { details: llDetails() });
    expect(api.getState('liveEdge')).toBe(false);

    (hls as { latency?: number }).latency = 2.5;
    video.dispatchEvent(new Event('timeupdate'));

    expect(api.getState('liveEdge')).toBe(true);
    expect(api.emit).toHaveBeenCalledWith('live:edgechange', { atEdge: true });

    cleanupVideo();
  });

  it('measures from the element on the native path, where nothing else can', () => {
    const cleanupVideo = setupVideoEventHandlers(video, api as IPluginAPI);

    video.dispatchEvent(new Event('timeupdate'));

    // 160 - 154 = 6, inside the native 10s threshold
    expect(api.getState('liveLatency')).toBe(6);
    expect(api.getState('liveEdge')).toBe(true);
    expect(api.getState('seekableRange')).toEqual({ start: 0, end: 160 });

    cleanupVideo();
  });
});

/**
 * A live stream that ends (EXT-X-ENDLIST) or a VOD source loaded after a live
 * one arrives as `hlsLevelLoaded` with `details.live === false`. Only the
 * `live` key used to follow: `applyLiveMetrics` ignores a null snapshot by
 * design and the `timeupdate` path stops measuring once `live` is false, so
 * the previous stream's latency readout, LL badge and DVR window stayed on
 * screen over the new one.
 */
describe('a playlist that is no longer live clears the live metrics', () => {
  it('resets the metrics when details.live goes false', () => {
    const api = createStatefulApi({ live: true });
    const video = document.createElement('video');
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const hls = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      },
      off: vi.fn(),
      media: video,
      latency: 6,
      targetLatency: 3,
      levels: [],
      currentLevel: -1,
      audioTracks: [],
      audioTrack: -1,
    } as unknown as HlsInstance;

    setupHlsEventHandlers(hls, api as IPluginAPI, {});

    handlers['hlsLevelLoaded']?.('hlsLevelLoaded', { details: llDetails() });

    expect(api.getState('lowLatencyMode')).toBe(true);
    expect(api.getState('liveLatency')).toBe(6);
    expect(api.getState('seekableRange')).toEqual({ start: 100, end: 160 });

    handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
      details: { live: false, targetduration: 4, totalduration: 60 },
    });

    expect(api.getState('live')).toBe(false);
    expect(api.getState('lowLatencyMode')).toBe(false);
    expect(api.getState('liveLatency')).toBe(0);
    expect(api.getState('liveEdge')).toBe(false);
    expect(api.getState('seekableRange')).toBeNull();
    expect(api.emit).toHaveBeenCalledWith('live:lowlatency', { enabled: false });
  });
});
