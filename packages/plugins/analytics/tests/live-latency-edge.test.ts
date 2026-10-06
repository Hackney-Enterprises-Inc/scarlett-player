import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';

// HEI-24 / HEI-35: liveLatency* describes delivery latency at the live edge.
// Readings before the first frame, and readings while a viewer has seeked
// back into the DVR window, are not latency; the time played back there is
// reported as dvrTime instead.
describe('live latency at the edge', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A live view whose state starts at the edge, as the HLS provider writes it. */
  async function liveHarness() {
    h = await createHarness({ heartbeatInterval: 1000, isLive: true });
    h.state.set('live', true);
    h.state.set('liveEdge', true);
    return h;
  }

  /**
   * One metrics reading, in the order `applyLiveMetrics` (hls
   * live-metrics.ts) applies it: `live:latency` first, then `liveEdge` and
   * `live:edgechange` only when the edge flag changed. Awaits a microtask so
   * the plugin sees the whole reading.
   */
  async function reading(latency: number, atEdge: boolean): Promise<void> {
    h.state.set('liveLatency', latency);
    h.bus.emit('live:latency', { latency });
    if (h.state.getValue('liveEdge') !== atEdge) {
      h.state.set('liveEdge', atEdge);
      h.bus.emit('live:edgechange', { atEdge });
    }
    await Promise.resolve();
  }

  /** A player seek from request to settle. */
  function playerSeek(time: number): void {
    h.bus.emit('playback:seeking', { time });
    h.state.set('currentTime', time);
    h.state.set('seeking', true);
    h.state.set('seeking', false);
  }

  /** Pause playback the way a provider reports it. */
  function pause(): void {
    h.state.set('playing', false);
    h.state.set('paused', true);
    h.bus.emit('playback:pause', undefined);
  }

  /** The last heartbeat sent. */
  function lastHeartbeat() {
    const heartbeats = h.sent('heartbeat');
    return heartbeats[heartbeats.length - 1];
  }

  it('ignores readings before the first frame', async () => {
    await liveHarness();
    await reading(3600, false);
    h.play();
    await reading(4, true);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4 });
  });

  it('keeps sampling a viewer who drifts behind without seeking', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    await reading(20, false);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 2, liveLatencyMax: 20, dvrTime: 0 });
  });

  it('resumes sampling after a seek that stays within the edge', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    playerSeek(990);
    // No edge transition: liveEdge stays true
    await reading(5, true);
    await reading(6, true);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 3, liveLatencyMax: 6, dvrTime: 0 });
  });

  it('stops sampling after a seek away and counts the time played there as dvrTime', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    vi.advanceTimersByTime(1000);
    playerSeek(100);
    await reading(900, false);
    await reading(901, false);
    vi.advanceTimersByTime(3000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4, dvrTime: 3000 });
  });

  it('treats an element seek on a live view like a player seek', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    h.elementSeek(100);
    h.state.set('seeking', false);
    await reading(900, false);
    vi.advanceTimersByTime(2000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4, dvrTime: 2000 });
  });

  it('resumes sampling after a seek back to the edge', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(2000);
    playerSeek(995);
    await reading(5, true);
    vi.advanceTimersByTime(3000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 2, liveLatencyMax: 5, dvrTime: 2000 });
  });

  it('returns to sampling when playback catches up with the edge on its own', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(30, false);
    vi.advanceTimersByTime(2000);
    await reading(5, true);
    vi.advanceTimersByTime(2000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 5, dvrTime: 2000 });
  });

  it('ignores readings while still seeking', async () => {
    await liveHarness();
    h.play();
    h.bus.emit('playback:seeking', { time: 100 });
    h.state.set('seeking', true);
    await reading(900, false);
    h.state.set('seeking', false);
    await reading(5, true);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 5 });
  });

  it('decides from the liveEdge state at the next heartbeat when no reading arrives', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    h.bus.emit('playback:seeking', { time: 100 });
    h.state.set('seeking', true);
    // The provider wrote the new edge flag while seeking; no reading after
    h.state.set('liveEdge', false);
    h.state.set('seeking', false);
    vi.advanceTimersByTime(1000);
    // The awaiting second counts as neither; the next one is DVR
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, dvrTime: 1000 });
  });

  it('does not count paused time after a seek while paused as dvrTime', async () => {
    await liveHarness();
    h.play();
    await reading(4, true);
    pause();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(5000);
    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, dvrTime: 0 });

    h.play();
    vi.advanceTimersByTime(2000);
    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, dvrTime: 2000 });
  });

  it('carries dvrTime on the viewEnd of a live view', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(1500);
    h.bus.emit('playback:ended', undefined);

    expect(h.sent('viewEnd')[0]).toMatchObject({ dvrTime: 1500 });
    expect(h.sent('viewEnd')[0]).not.toHaveProperty('liveLatencyMean');
  });

  it('starts the next view at the edge with no dvrTime', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(1000);
    pause();
    h.plugin.setVideo({ videoId: 'next-video', isLive: true });
    h.play();
    await reading(4, true);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, dvrTime: 0 });
  });

  it('sends no dvrTime on VOD', async () => {
    h = await createHarness({ heartbeatInterval: 1000 });
    h.play();
    playerSeek(100);
    vi.advanceTimersByTime(1000);

    expect(lastHeartbeat()).not.toHaveProperty('dvrTime');
  });

  it("uses each reading's edge flag when two readings arrive in one tick", async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    h.bus.emit('live:latency', { latency: 900 });
    h.state.set('liveEdge', false);
    h.bus.emit('live:edgechange', { atEdge: false });
    h.bus.emit('live:latency', { latency: 4 });
    h.state.set('liveEdge', true);
    h.bus.emit('live:edgechange', { atEdge: true });
    await Promise.resolve();
    vi.advanceTimersByTime(1000);
    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4 });
  });

  it('does not settle a new seek with a reading from before that seek', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    h.bus.emit('live:latency', { latency: 4 });
    playerSeek(200);
    await Promise.resolve();
    expect(h.plugin.getMetrics()).toMatchObject({ dvrTime: 0 });
    vi.advanceTimersByTime(500);
    await reading(800, false);
    vi.advanceTimersByTime(500);
    expect(lastHeartbeat()).not.toHaveProperty('liveLatencySamples');
    expect(lastHeartbeat()).toMatchObject({ dvrTime: 500 });
  });


  it('does not accrue time when an edge change arrives after viewEnd', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(900, false);
    h.bus.emit('playback:ended', undefined);
    const ended = h.plugin.getMetrics();
    vi.advanceTimersByTime(500);
    h.state.set('liveEdge', true);
    h.bus.emit('live:edgechange', { atEdge: true });
    expect(h.plugin.getMetrics()).toMatchObject({ watchTime: ended.watchTime, dvrTime: ended.dvrTime });
  });

  it('uses the heartbeat fallback for a seek within the edge without an edge event', async () => {
    await liveHarness();
    h.play();
    playerSeek(990);
    vi.advanceTimersByTime(1000);
    await reading(5, true);
    vi.advanceTimersByTime(1000);
    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, dvrTime: 0 });
  });

  it('excludes stalled time from dvrTime, including waiting grace', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(500);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(2000);
    h.bus.emit('playback:play', undefined);
    vi.advanceTimersByTime(500);
    expect(lastHeartbeat()).toMatchObject({ dvrTime: 1000 });
  });

  it('settles the partial DVR interval on unload', async () => {
    await liveHarness();
    h.play();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(1500);
    window.dispatchEvent(new Event('pagehide'));
    expect(h.sent('viewEnd')[0]).toMatchObject({ dvrTime: 1500 });
  });

  it('settles DVR time on idle end and samples after passive reopening', async () => {
    h = await createHarness({ heartbeatInterval: 1000, idleTimeout: 2000, isLive: true });
    h.state.set('live', true);
    h.state.set('liveEdge', true);
    h.play();
    playerSeek(100);
    await reading(900, false);
    vi.advanceTimersByTime(500);
    h.bus.emit('media:waiting', undefined);
    vi.advanceTimersByTime(2500);
    expect(h.sent('viewEnd')[0]).toMatchObject({ dvrTime: 500 });
    h.bus.emit('playback:play', undefined);
    await reading(4, true);
    vi.advanceTimersByTime(1000);
    expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4, dvrTime: 0 });
  });

  it.each(['ended', 'setVideo', 'replay', 'destroy'] as const)(
    'drops a deferred reading across %s', async (transition) => {
      await liveHarness();
      h.play();
      playerSeek(100);
      h.bus.emit('live:latency', { latency: 900 });
      if (transition === 'setVideo') {
        pause();
        h.plugin.setVideo({ videoId: 'next', isLive: true });
      } else if (transition === 'destroy') {
        await h.plugin.destroy();
      } else {
        h.bus.emit('playback:ended', undefined);
        if (transition === 'replay') {
          h.state.set('playing', false);
          h.state.set('paused', true);
          h.play();
        }
      }
      await Promise.resolve();
      if (transition === 'setVideo') h.play();
      if (transition === 'replay' || transition === 'setVideo') {
        await reading(4, true);
        vi.advanceTimersByTime(1000);
        expect(lastHeartbeat()).toMatchObject({ liveLatencySamples: 1, liveLatencyMax: 4, dvrTime: 0 });
      } else {
        expect(h.sent('viewEnd')[0]).not.toHaveProperty('liveLatencySamples');
      }
    },
  );

});
