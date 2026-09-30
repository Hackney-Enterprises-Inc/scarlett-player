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
