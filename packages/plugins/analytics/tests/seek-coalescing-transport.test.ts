/**
 * Player seek coalescing through the real transports (HEI-SCARLETT-42).
 *
 * Leading and trailing player `seeking` beacons ride the ordinary batch
 * queue like any other beacon. A target still pending at pagehide goes out
 * exactly once on the synchronous unload transport, ahead of the unload
 * viewEnd and without awaiting a deferred headers() promise.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
import type { BatchEnvelope } from '../src/transport';

describe('player seek coalescing transport', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
  });

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A player seek request on the bus, as core seek()/UI/gestures emit it. */
  function playerSeek(time: number): void {
    h.bus.emit('playback:seeking', { time });
  }

  /** Read a sendBeacon Blob's text (jsdom FileReader schedules I/O on timers). */
  async function blobText(blob: Blob): Promise<string> {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
  }

  it('queues leading and trailing seeks in creation order through the batch transport', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    h = await createHarness({ customBeacon: undefined, batch: { intervalMs: 60000, maxEvents: 50 } });

    playerSeek(10);
    playerSeek(20); // Pending.
    vi.advanceTimersByTime(1000); // The trailing send joins the same queue.
    expect(fetchMock).not.toHaveBeenCalled();

    h.bus.emit('playback:ended', undefined); // viewEnd drains the queue.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as BatchEnvelope;
    expect(body.batch).toBe(1);
    expect(body.events.map((e) => [e.event, e.seekTo ?? null])).toEqual([
      ['viewStart', null],
      ['seeking', 10],
      ['seeking', 20],
      ['viewEnd', null],
    ]);
    expect(body.events.map((e) => e.beaconSeq)).toEqual([1, 2, 3, 4]);
  });

  it('sends the pending target once on the unload transport ahead of the unload viewEnd', async () => {
    const unload = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { userAgent: navigator.userAgent, sendBeacon: unload });
    h = await createHarness({ customBeacon: undefined, heartbeatInterval: 100000 });

    playerSeek(10);
    playerSeek(20); // Pending.
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload')); // No second flush.

    expect(unload).toHaveBeenCalledTimes(2);
    vi.useRealTimers(); // Playback timing is done; FileReader needs real I/O.
    const first = JSON.parse(await blobText(unload.mock.calls[0][1] as Blob));
    const second = JSON.parse(await blobText(unload.mock.calls[1][1] as Blob));
    expect(first).toMatchObject({ event: 'seeking', seekTo: 20, seekSource: 'player', seekCount: 2 });
    expect(second).toMatchObject({ event: 'viewEnd', seekCount: 2 });
    expect(second.beaconSeq).toBe(first.beaconSeq + 1);
  });

  it('does not wait for deferred headers() on the unload fetch fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { userAgent: 'test' }); // No sendBeacon: fetch fallback.
    const headers = vi.fn(async () => ({ 'X-Deferred': 'late' }));
    h = await createHarness({ customBeacon: undefined, headers, heartbeatInterval: 100000 });

    playerSeek(10);
    playerSeek(20); // Pending.
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [seekingInit, viewEndInit] = fetchMock.mock.calls.map(([, init]) => init);
    expect((seekingInit.headers as Headers).get('X-Deferred')).toBeNull();
    expect((viewEndInit.headers as Headers).get('X-Deferred')).toBeNull();
    expect(JSON.parse(seekingInit.body as string)).toMatchObject({
      event: 'seeking', seekTo: 20, seekSource: 'player', seekCount: 2,
    });
    expect(JSON.parse(viewEndInit.body as string)).toMatchObject({ event: 'viewEnd', seekCount: 2 });
    await Promise.resolve(); // Let the dropped headers promise settle.
    expect(headers).toHaveBeenCalled();
  });
});
