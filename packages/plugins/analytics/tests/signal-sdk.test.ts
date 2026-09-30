import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness';
import { calculateQoEScore } from '../src/helpers';
import { classifyError } from '../src/errors';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  delete (navigator as any).globalPrivacyControl;
  delete (navigator as any).doNotTrack;
  delete (navigator as any).sendBeacon;
  vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
});

describe('Signal privacy and context', () => {
  it.each(['doNotTrack', 'globalPrivacyControl'] as const)('suppresses every event on %s only when opted in', async (key) => {
    Object.defineProperty(navigator, key, { configurable: true, value: key === 'doNotTrack' ? '1' : true });
    const h = await createHarness({ respectDoNotTrack: true });
    h.plugin.trackEvent('test');
    window.dispatchEvent(new Event('pagehide'));
    expect(h.beacons).toHaveLength(0);
    await h.plugin.destroy();
    const permitted = await createHarness();
    expect(permitted.sent('viewStart')).toHaveLength(1);
    await permitted.plugin.destroy();
  });

  it('uses no storage for anonymous views and switches mode only at a boundary', async () => {
    const getLocal = vi.spyOn(Storage.prototype, 'getItem');
    const setLocal = vi.spyOn(Storage.prototype, 'setItem');
    const h = await createHarness({ anonymous: true });
    const first = h.beacons[0];
    h.plugin.setAnonymous(false);
    h.plugin.trackEvent('test');
    expect(h.beacons.at(-1)).toMatchObject({ viewerId: first.viewerId, sessionId: first.sessionId, anonymous: true });
    expect(getLocal).not.toHaveBeenCalled();
    expect(setLocal).not.toHaveBeenCalled();
    h.plugin.setVideo({ videoId: 'next' });
    expect(h.beacons.at(-1)).not.toHaveProperty('anonymous');
    await h.plugin.destroy();
  });

  it('passes each payload through beforeSend including unload, and drops without consuming a sequence', async () => {
    const h = await createHarness({ beforeSend: (p) => p.event === 'custom:drop' ? null : { ...p, tag: 'changed' } });
    h.plugin.trackEvent('drop');
    window.dispatchEvent(new Event('pagehide'));
    expect(h.beacons.map(b => b.beaconSeq)).toEqual([1, 2]);
    expect(h.beacons.every(b => b.tag === 'changed')).toBe(true);
    await h.plugin.destroy();
  });

  it('sends the original payload if beforeSend throws and logs the failure', async () => {
    const h = await createHarness({ beforeSend: () => { throw new Error('hook failed'); } });
    expect(h.sent('viewStart')).toHaveLength(1);
    expect(h.api.logger.debug).toHaveBeenCalledWith(expect.stringContaining('beforeSend'), expect.anything());
    await h.plugin.destroy();
  });

  it('includes only sanitized page context on viewStart', async () => {
    const h = await createHarness({ playerInitTime: Date.now() - 300 });
    expect(h.beacons[0]).toMatchObject({ pageUrl: location.origin + location.pathname, playerInitMs: 300 });
    expect(h.beacons[0].pageUrl).not.toMatch(/[?#]/);
    expect(h.beacons[0]).toHaveProperty('pageLoadToInitMs');
    vi.advanceTimersByTime(500);
    h.plugin.setVideo({ videoId: 'next' });
    expect(h.sent('viewStart')[1].playerInitMs).toBe(300);
    expect(h.sent('viewStart')[1].pageLoadToInitMs).toBe(h.sent('viewStart')[0].pageLoadToInitMs);
    await h.plugin.destroy();
  });
});

describe('error classification and QoE v2', () => {
  it.each([
    [{ detail: { httpStatus: 403 }, code: 'MEDIA_NETWORK_ERROR' }, 'access'],
    [{ code: 'MEDIA_NETWORK_ERROR' }, 'network'],
    [{ detail: { type: 'network' } }, 'network'],
    [{ code: 'MEDIA_DECODE_ERROR' }, 'media'],
    [{ detail: { type: 'media' } }, 'media'],
    [{ code: 'SOURCE_NOT_SUPPORTED' }, 'source'],
    [{ code: 'PLAYBACK_FAILED' }, 'playback'],
    [{ code: 'PLUGIN_SETUP_FAILED' }, 'player'],
    [{ message: '403 forbidden network media' }, 'unknown'],
  ] as const)('classifies structured %j as %s', (value, category) => {
    expect(classifyError(value)).toBe(category);
  });

  it('pins the continuous curve, absent bitrate, warnings, fatal and access', () => {
    const base = { startupTime: null, rebufferCount: 0, rebufferDuration: 0, watchTime: 10000, maxBitrate: 0, warningCount: 0, exitType: null, fatalErrorCategory: null };
    expect(calculateQoEScore(base)).toBe(100);
    expect(calculateQoEScore({ ...base, startupTime: 4000 })).toBe(75);
    expect(calculateQoEScore({ ...base, rebufferCount: 2 })).toBe(85);
    expect(calculateQoEScore({ ...base, warningCount: 10 })).toBe(80);
    expect(calculateQoEScore({ ...base, exitType: 'error', fatalErrorCategory: 'network' })).toBe(0);
    expect(calculateQoEScore({ ...base, exitType: 'error', fatalErrorCategory: 'access' })).toBeNull();
  });

  it('emits structured detail and warning counts without leaking URLs', async () => {
    const h = await createHarness({ heartbeatInterval: 1000 });
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'signed https://example.com/?token=secret', fatal: false, detail: { httpStatus: 500, attempts: 2, url: 'https://example.com/?token=secret' } } as any);
    expect(h.sent('error')[0]).toMatchObject({ errorCategory: 'network', errorSeverity: 'warning', httpStatus: 500, attempts: 2 });
    expect(JSON.stringify(h.sent('error')[0])).not.toContain('token=secret');
    vi.advanceTimersByTime(1000);
    expect(h.sent('heartbeat')[0]).toMatchObject({ warningCount: 1, qoeVersion: 2 });
    h.bus.emit('error', { code: 'SOURCE_LOAD_FAILED', message: 'denied', fatal: true, detail: { httpStatus: 403 } } as any);
    expect(h.sent('viewEnd')[0]).toMatchObject({ fatalErrorCategory: 'access', qoeScore: null, qoeVersion: 2 });
    expect(h.plugin.getQoEScore()).toBeNull();
    await h.plugin.destroy();
  });

  it('omits unavailable error fields rather than emitting undefined properties', async () => {
    const h = await createHarness();
    h.bus.emit('media:error', { error: new Error('plain failure') });
    expect(h.sent('error')[0]).toMatchObject({ errorCategory: 'unknown', errorSeverity: 'warning' });
    expect(h.sent('error')[0]).not.toHaveProperty('errorCode');
    expect(h.sent('error')[0]).not.toHaveProperty('httpStatus');
    expect(h.sent('error')[0]).not.toHaveProperty('attempts');
    await h.plugin.destroy();
  });
});

describe('opt-in batch transport', () => {
  const requests = () => (fetch as ReturnType<typeof vi.fn>).mock.calls.map(([, init]) => JSON.parse(init.body as string));
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })));

  it.each(['doNotTrack', 'globalPrivacyControl'] as const)('discards queued events when %s activates before the timer, then permits new events after opt-in ends', async key => {
    const h = await createHarness({ customBeacon: undefined, respectDoNotTrack: true, batch: { intervalMs: 1000 } });
    h.plugin.trackEvent('queued');
    Object.defineProperty(navigator, key, { configurable: true, value: key === 'doNotTrack' ? '1' : true });
    vi.advanceTimersByTime(1000);
    expect(fetch).not.toHaveBeenCalled();
    delete (navigator as any)[key];
    h.plugin.trackEvent('new');
    vi.advanceTimersByTime(1000);
    expect(requests()).toHaveLength(1);
    expect(requests()[0].events.map((p: { event: string }) => p.event)).toEqual(['custom:new']);
    await h.plugin.destroy();
  });

  it('drops queued events on a size flush when privacy activates, without sending the triggering event', async () => {
    const h = await createHarness({ customBeacon: undefined, respectDoNotTrack: true, batch: { maxEvents: 2 }, beforeSend: p => {
      if (p.event === 'custom:trigger') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
      return p;
    } });
    h.plugin.trackEvent('trigger');
    expect(fetch).not.toHaveBeenCalled();
    delete (navigator as any).doNotTrack;
    h.plugin.trackEvent('after');
    await h.plugin.destroy();
    expect(requests()[0].events.map((p: { event: string }) => p.event)).toEqual(['custom:after', 'viewEnd']);
  });

  it('clears pending events when a new payload is suppressed, even if the signal clears before the timer', async () => {
    const h = await createHarness({ customBeacon: undefined, respectDoNotTrack: true, batch: { intervalMs: 1000 } });
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    h.plugin.trackEvent('suppressed');
    delete (navigator as any).doNotTrack;
    vi.advanceTimersByTime(1000);
    expect(fetch).not.toHaveBeenCalled();
    await h.plugin.destroy();
  });

  it('drops queued events on an explicit flush and on unload after opting out', async () => {
    const unload = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: unload });
    const h = await createHarness({ customBeacon: undefined, respectDoNotTrack: true, batch: true });
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    vi.advanceTimersByTime(10000);
    expect(fetch).not.toHaveBeenCalled();
    expect(unload).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await h.plugin.destroy();
  });

  it('flushes previously permitted events when beforeSend drops only the unload payload', async () => {
    const unload = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: unload });
    const h = await createHarness({ customBeacon: undefined, batch: true, beforeSend: p => p.event === 'viewEnd' ? null : p });
    h.plugin.trackEvent('queued');
    window.dispatchEvent(new Event('pagehide'));
    expect(unload).toHaveBeenCalledTimes(1);
    const blob = unload.mock.calls[0][1] as Blob;
    vi.useRealTimers();
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(JSON.parse(text).events.map((p: { event: string }) => p.event)).toEqual(['viewStart', 'custom:queued']);
    await h.plugin.destroy();
  });

  it('blocks async header resolution after privacy activates', async () => {
    let resolveHeaders!: (headers: Record<string, string>) => void;
    const headers = () => new Promise<Record<string, string>>(resolve => { resolveHeaders = resolve; });
    const h = await createHarness({ customBeacon: undefined, respectDoNotTrack: true, headers });
    await Promise.resolve();
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    resolveHeaders({});
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    await h.plugin.destroy();
  });

  it.each([false, true])('gates individual %s beacons when privacy turns on before dispatch', async custom => {
    const customBeacon = vi.fn();
    const h = await createHarness({ customBeacon: custom ? customBeacon : undefined, respectDoNotTrack: true });
    const sentBefore = custom ? customBeacon.mock.calls.length : requests().length;
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    h.plugin.trackEvent('suppressed');
    await h.plugin.destroy();
    expect(custom ? customBeacon.mock.calls.length : requests().length).toBe(sentBefore);
  });

  it('keeps batch-off one POST per event in 1.19.3 order', async () => {
    const h = await createHarness({ customBeacon: undefined });
    h.plugin.trackEvent('one');
    h.plugin.trackEvent('two');
    await h.plugin.destroy();
    expect(requests().map(p => [p.event, p.beaconSeq])).toEqual([['viewStart', 1], ['custom:one', 2], ['custom:two', 3], ['viewEnd', 4]]);
  });

  it('runs beforeSend on the fetch and unload paths, including a dropped unload beacon', async () => {
    const unload = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: unload });
    const h = await createHarness({ customBeacon: undefined, beforeSend: p => p.event === 'viewEnd' ? null : { ...p, checked: true } });
    h.plugin.trackEvent('sent');
    h.plugin.trackEvent('dropped');
    expect(requests().every(p => p.checked === true)).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    expect(unload).not.toHaveBeenCalled();
    expect(requests().map(p => p.beaconSeq)).toEqual([1, 2, 3]);
    await h.plugin.destroy();
  });

  it('keeps customBeacon individual when batch is enabled', async () => {
    const customBeacon = vi.fn();
    const h = await createHarness({ batch: true, customBeacon });
    h.plugin.trackEvent('individual');
    expect(fetch).not.toHaveBeenCalled();
    expect(customBeacon.mock.calls.map(([, payload]) => payload.event)).toEqual(['viewStart', 'custom:individual']);
    await h.plugin.destroy();
  });

  it('flushes on limit and timer with one headers resolution per envelope', async () => {
    const headers = vi.fn(() => ({ Authorization: 'Bearer token' }));
    const h = await createHarness({ customBeacon: undefined, batch: { maxEvents: 2, intervalMs: 1000 }, headers });
    expect(fetch).not.toHaveBeenCalled();
    h.plugin.trackEvent('one');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requests()[0]).toMatchObject({ batch: 1, events: [{ event: 'viewStart' }, { event: 'custom:one' }] });
    expect(headers).toHaveBeenCalledTimes(1);
    h.plugin.trackEvent('two');
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(requests()[1].events[0].event).toBe('custom:two');
    await h.plugin.destroy();
  });

  it('flushes queued and final events in one unload sendBeacon envelope', async () => {
    const unload = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: unload });
    const h = await createHarness({ customBeacon: undefined, batch: true, apiKey: 'key' });
    h.plugin.trackEvent('one');
    window.dispatchEvent(new Event('pagehide'));
    expect(unload).toHaveBeenCalledTimes(1);
    expect(unload.mock.calls[0][0]).toContain('api_key=key');
    const blob = unload.mock.calls[0][1] as Blob;
    vi.useRealTimers();
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const envelope = JSON.parse(text);
    expect(envelope.events.map((p: { event: string }) => p.event)).toEqual(['viewStart', 'custom:one', 'viewEnd']);
    await h.plugin.destroy();
  });

  it('bounds serialized UTF-8 envelopes and sends an oversized single event unwrapped', async () => {
    const h = await createHarness({ customBeacon: undefined, batch: true });
    h.plugin.trackEvent('large', { text: '🦊'.repeat(8000) });
    h.plugin.trackEvent('large', { text: '🦊'.repeat(8000) });
    expect(requests()).toHaveLength(1);
    expect(requests()[0].events.map((event: { event: string }) => event.event)).toEqual(['viewStart', 'custom:large']);
    const firstBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string;
    expect(new TextEncoder().encode(firstBody).length).toBeLessThanOrEqual(60000);
    h.plugin.trackEvent('oversized', { text: '🦊'.repeat(20000) });
    expect(requests().at(-1).event).toBe('custom:oversized');
    await h.plugin.destroy();
  });

  it('flushes on fatal error, viewEnd and a hidden tab', async () => {
    const h = await createHarness({ customBeacon: undefined, batch: true });
    h.bus.emit('error', { code: 'MEDIA_NETWORK_ERROR', message: 'failed', fatal: true } as any);
    expect(requests()[0].events.map((event: { event: string }) => event.event)).toEqual(['viewStart', 'error']);
    expect(requests()[1].events.map((event: { event: string }) => event.event)).toEqual(['viewEnd']);
    await h.plugin.destroy();

    const another = await createHarness({ customBeacon: undefined, batch: true });
    const count = requests().length;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(requests().slice(count).flatMap(p => p.events.map((event: { event: string }) => event.event))).toContain('heartbeat');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await another.plugin.destroy();
  });
});
