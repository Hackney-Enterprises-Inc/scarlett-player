import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('interval segment and frame signals', () => {
  it('aggregates every rendition for count, bytes, duration and errors, but only main for throughput', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    h.bus.emit('media:segment', { kind: 'main', ok: true, bytes: 1000, durationMs: 100 });
    h.bus.emit('media:segment', { kind: 'audio', ok: true, bytes: 500, durationMs: 200 });
    h.bus.emit('media:segment', { kind: 'subtitle', ok: false, bytes: 250, durationMs: 50 });
    h.bus.emit('media:segment', { kind: 'main', ok: false, bytes: 500, durationMs: 100 });
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[0]).toMatchObject({
      segmentCount: 4, segmentBytes: 2250, segmentLoadAvgMs: 112.5,
      segmentLoadMaxMs: 200, segmentThroughputBps: 60000, segmentErrors: 2,
    });
    vi.advanceTimersByTime(1000);
    for (const key of ['segmentCount', 'segmentBytes', 'segmentLoadAvgMs', 'segmentLoadMaxMs', 'segmentThroughputBps', 'segmentErrors']) {
      expect(h.sent('heartbeat')[1]).not.toHaveProperty(key);
    }
    h.bus.emit('media:segment', { kind: 'main', ok: true, bytes: 300, durationMs: 50 });
    await h.plugin.destroy();
    expect(h.sent('viewEnd')[0]).toMatchObject({ segmentCount: 1, segmentBytes: 300, segmentLoadAvgMs: 50, segmentLoadMaxMs: 50, segmentThroughputBps: 48000, segmentErrors: 0 });
  });

  it('omits throughput without a positive main load interval and ignores late/unmeasurable segments', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    h.bus.emit('media:segment', { kind: 'audio', ok: true, bytes: 100, durationMs: 20 });
    h.bus.emit('media:segment', { kind: 'main', ok: false, bytes: 0, durationMs: 0 });
    h.bus.emit('media:segment', { kind: 'main', ok: true, bytes: NaN, durationMs: 10 });
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[0]).toMatchObject({ segmentCount: 2, segmentBytes: 100, segmentLoadAvgMs: 10, segmentLoadMaxMs: 20, segmentErrors: 1 });
    expect(h.sent('heartbeat')[0]).not.toHaveProperty('segmentThroughputBps');
    await h.plugin.destroy();
    h.bus.emit('media:segment', { kind: 'main', ok: true, bytes: 10, durationMs: 2 });
    expect(h.sent('viewEnd')[0]).not.toHaveProperty('segmentCount');
  });

  it('leaves segment and frame keys absent for native HLS, MP4, WHEP and old core buses', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    vi.advanceTimersByTime(1000);
    await h.plugin.destroy();
    for (const payload of [...h.sent('heartbeat'), ...h.sent('viewEnd')]) {
      for (const key of ['segmentCount', 'segmentBytes', 'segmentLoadAvgMs', 'segmentLoadMaxMs', 'segmentThroughputBps', 'segmentErrors', 'decodedFrames', 'droppedFrames']) {
        expect(payload).not.toHaveProperty(key);
      }
    }
  });

  it('keeps each view separate and includes pending segment totals on pagehide', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    h.bus.emit('media:segment', { kind: 'main', ok: false, bytes: 80, durationMs: 10 });
    h.plugin.setVideo({ videoId: 'next' });
    expect(h.sent('viewEnd')[0]).toMatchObject({ segmentCount: 1, segmentErrors: 1, segmentThroughputBps: 64000 });
    h.bus.emit('media:segment', { kind: 'audio', ok: true, bytes: 20, durationMs: 5 });
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[1]).toMatchObject({ segmentCount: 1, segmentBytes: 20, segmentErrors: 0 });
    expect(h.sent('viewEnd')[1]).not.toHaveProperty('segmentThroughputBps');
    await h.plugin.destroy();
    expect(h.sent('viewEnd')).toHaveLength(2);
  });

  it('reports frame deltas and rebaselines on source loads, view changes and counter resets', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    const video = document.createElement('video');
    const quality = { totalVideoFrames: 50, droppedVideoFrames: 5 };
    video.getVideoPlaybackQuality = vi.fn(() => quality as VideoPlaybackQuality);
    h.api.container.append(video);
    // The first observation is a baseline, not frames from before this view.
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[0]).not.toHaveProperty('decodedFrames');
    quality.totalVideoFrames = 80;
    quality.droppedVideoFrames = 8;
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[1]).toMatchObject({ decodedFrames: 30, droppedFrames: 3 });
    h.state.set('source', { src: 'other.m3u8', type: 'application/x-mpegURL' });
    quality.totalVideoFrames = 90;
    quality.droppedVideoFrames = 9;
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[2]).toMatchObject({ decodedFrames: 10, droppedFrames: 1 });
    h.plugin.setVideo({ videoId: 'next' });
    quality.totalVideoFrames = 95;
    quality.droppedVideoFrames = 10;
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[3]).toMatchObject({ decodedFrames: 5, droppedFrames: 1 });
    quality.totalVideoFrames = 1;
    quality.droppedVideoFrames = 0;
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[4]).not.toHaveProperty('decodedFrames');
    quality.totalVideoFrames = 4;
    quality.droppedVideoFrames = 1;
    await h.plugin.destroy();
    expect(h.sent('viewEnd').at(-1)).toMatchObject({ decodedFrames: 3, droppedFrames: 1 });
  });
});

it('retains frame totals after a hidden heartbeat consumes the delta, and resets totals per view', async () => {
  const h = await createHarness(); const video = document.createElement('video');
  const quality = { totalVideoFrames: 50, droppedVideoFrames: 5 };
  video.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality; h.api.container.append(video);
  h.state.set('source', { src: 'first.mp4' }); quality.totalVideoFrames = 80; quality.droppedVideoFrames = 8;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  expect(h.sent('heartbeat')[0]).toMatchObject({ decodedFrames: 30, droppedFrames: 3, decodedFramesTotal: 30, droppedFramesTotal: 3 });
  window.dispatchEvent(new Event('pagehide'));
  expect(h.sent('viewEnd')[0]).toMatchObject({ decodedFrames: 0, droppedFrames: 0, decodedFramesTotal: 30, droppedFramesTotal: 3 });
  h.plugin.setVideo({ videoId: 'next' }); quality.totalVideoFrames = 90; quality.droppedVideoFrames = 9; await h.plugin.destroy();
  expect(h.sent('viewEnd')[1]).toMatchObject({ decodedFramesTotal: 10, droppedFramesTotal: 1 });
});

it('keeps view totals through counter resets and element replacement while preserving absent deltas', async () => {
  const h = await createHarness({ heartbeatInterval: 1000 }); let quality = { totalVideoFrames: 0, droppedVideoFrames: 0 };
  const video = document.createElement('video'); video.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality; h.api.container.append(video);
  h.state.set('source', { src: 'one.mp4' }); quality = { totalVideoFrames: 20, droppedVideoFrames: 2 }; vi.advanceTimersByTime(1000);
  quality = { totalVideoFrames: 0, droppedVideoFrames: 0 }; vi.advanceTimersByTime(1000);
  expect(h.sent('heartbeat').at(-1)).not.toHaveProperty('decodedFrames'); expect(h.sent('heartbeat').at(-1)).toMatchObject({ decodedFramesTotal: 20, droppedFramesTotal: 2 });
  const replacement = document.createElement('video'); replacement.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality; video.replaceWith(replacement); vi.advanceTimersByTime(1000);
  expect(h.sent('heartbeat').at(-1)).not.toHaveProperty('decodedFrames'); expect(h.sent('heartbeat').at(-1)).toMatchObject({ decodedFramesTotal: 20, droppedFramesTotal: 2 });
  quality = { totalVideoFrames: 5, droppedVideoFrames: 1 }; await h.plugin.destroy();
  expect(h.sent('viewEnd')[0]).toMatchObject({ decodedFrames: 5, droppedFrames: 1, decodedFramesTotal: 25, droppedFramesTotal: 3 });
});

it('retains measured view totals if the provider removes the element before unload', async () => {
  const h = await createHarness({ heartbeatInterval: 1000 }); const video = document.createElement('video');
  const quality = { totalVideoFrames: 0, droppedVideoFrames: 0 }; video.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality;
  h.api.container.append(video); h.state.set('source', { src: 'one.mp4' }); quality.totalVideoFrames = 30; quality.droppedVideoFrames = 3;
  vi.advanceTimersByTime(1000); video.remove(); h.bus.emit('source:unloaded', { src: 'one.mp4' });
  expect(h.sent('viewEnd')[0]).not.toHaveProperty('decodedFrames'); expect(h.sent('viewEnd')[0]).toMatchObject({ decodedFramesTotal: 30, droppedFramesTotal: 3 });
  h.plugin.setVideo({ videoId: 'next' }); await h.plugin.destroy(); expect(h.sent('viewEnd')[1]).not.toHaveProperty('decodedFramesTotal');
});

it('folds the pending delta into totals before a mid-view source re-write rebaselines', async () => {
  const h = await createHarness({ heartbeatInterval: 1000 }); const video = document.createElement('video');
  const quality = { totalVideoFrames: 0, droppedVideoFrames: 0 }; video.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality;
  h.api.container.append(video); h.state.set('source', { src: 'live.m3u8' });
  quality.totalVideoFrames = 100; quality.droppedVideoFrames = 10; vi.advanceTimersByTime(1000);
  // A reconnect reload re-writes the same source between heartbeats
  quality.totalVideoFrames = 140; quality.droppedVideoFrames = 12; h.state.set('source', { src: 'live.m3u8' });
  quality.totalVideoFrames = 150; quality.droppedVideoFrames = 13; await h.plugin.destroy();
  expect(h.sent('viewEnd')[0]).toMatchObject({ decodedFrames: 10, droppedFrames: 1, decodedFramesTotal: 150, droppedFramesTotal: 13 });
});

it('counts frames since a counter reset and from a replacement element, plus the old element\'s pending delta', async () => {
  const h = await createHarness({ heartbeatInterval: 1000 }); const video = document.createElement('video');
  const quality = { totalVideoFrames: 0, droppedVideoFrames: 0 }; video.getVideoPlaybackQuality = () => quality as VideoPlaybackQuality;
  h.api.container.append(video); h.state.set('source', { src: 'one.mp4' });
  quality.totalVideoFrames = 20; quality.droppedVideoFrames = 2; vi.advanceTimersByTime(1000);
  // The element reloaded: its counters restarted and have counted 7 since
  quality.totalVideoFrames = 7; quality.droppedVideoFrames = 1; vi.advanceTimersByTime(1000);
  expect(h.sent('heartbeat').at(-1)).not.toHaveProperty('decodedFrames');
  expect(h.sent('heartbeat').at(-1)).toMatchObject({ decodedFramesTotal: 27, droppedFramesTotal: 3 });
  // The old element decodes 3 more before a new one replaces it, which has counted 4
  quality.totalVideoFrames = 10; quality.droppedVideoFrames = 1;
  const replacement = document.createElement('video'); const next = { totalVideoFrames: 4, droppedVideoFrames: 0 };
  replacement.getVideoPlaybackQuality = () => next as VideoPlaybackQuality; video.replaceWith(replacement); vi.advanceTimersByTime(1000);
  expect(h.sent('heartbeat').at(-1)).not.toHaveProperty('decodedFrames');
  expect(h.sent('heartbeat').at(-1)).toMatchObject({ decodedFramesTotal: 34, droppedFramesTotal: 3 });
  await h.plugin.destroy();
});
