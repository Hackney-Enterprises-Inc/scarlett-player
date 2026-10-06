/**
 * headers() on the unload fetch fallback (HEI-1).
 *
 * The fallback runs inside pagehide, so it calls a headers() function
 * synchronously, uses a plain object result, never waits on a promise, and
 * never lets a throwing or rejecting headers() reach global error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTransport } from '../src/transport';
import type { AnalyticsConfig, BeaconPayload } from '../src/types';

const payload = { event: 'viewEnd' } as unknown as BeaconPayload;

describe('unload fetch fallback headers()', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logger: { debug: ReturnType<typeof vi.fn> };
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };

  /** Build a transport with no sendBeacon, so unload goes to fetch. */
  function transportWith(headers: AnalyticsConfig['headers']) {
    const config = { beaconUrl: 'https://ingest.example.com/beacon', videoId: 'v', headers } as AnalyticsConfig;
    return createTransport(config, logger, () => false);
  }

  /** The headers object passed to the one fetch call. */
  function sentHeaders(): Headers {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return fetchMock.mock.calls[0][1].headers as Headers;
  }

  /** Let pending microtasks and a macrotask run so rejections surface. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { userAgent: 'test' });
    logger = { debug: vi.fn() };
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    vi.unstubAllGlobals();
  });

  it('uses a plain object returned synchronously by headers()', async () => {
    const headers = vi.fn(() => ({ 'X-CSRF-Token': 'csrf-sync' }));
    transportWith(headers).sendUnload(payload);
    expect(headers).toHaveBeenCalledTimes(1);
    expect(sentHeaders().get('X-CSRF-Token')).toBe('csrf-sync');
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
    await settle();
    expect(unhandled).toEqual([]);
  });

  it('sends without extra headers when headers() throws synchronously', async () => {
    transportWith(() => { throw new Error('no token'); }).sendUnload(payload);
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
    expect(sentHeaders().get('X-CSRF-Token')).toBeNull();
    expect(logger.debug).toHaveBeenCalled();
    await settle();
    expect(unhandled).toEqual([]);
  });

  it('does not wait for a resolving promise and does not use its result', async () => {
    transportWith(async () => ({ 'X-CSRF-Token': 'csrf-async' })).sendUnload(payload);
    // The fetch went out synchronously, before the promise could settle.
    expect(sentHeaders().get('X-CSRF-Token')).toBeNull();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
  });

  it('handles a rejecting promise without an unhandled rejection', async () => {
    transportWith(() => Promise.reject(new Error('token service down'))).sendUnload(payload);
    expect(sentHeaders().get('X-CSRF-Token')).toBeNull();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it('still merges a static headers object', () => {
    transportWith({ 'X-Tenant': '42' }).sendUnload(payload);
    expect(sentHeaders().get('X-Tenant')).toBe('42');
  });

  it.each([null, 'token', 42, ['token'], new Date()])('ignores a non-record result: %s', (result) => {
    transportWith((() => result) as unknown as NonNullable<AnalyticsConfig['headers']>).sendUnload(payload);
    expect([...sentHeaders().entries()]).toEqual([['content-type', 'application/json']]);
  });

  it('contains a throwing then getter and still sends', () => {
    const result = Object.defineProperty({}, 'then', { get() { throw new Error('broken then'); } });
    expect(() => transportWith(() => result).sendUnload(payload)).not.toThrow();
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
  });

  it('handles a rejecting custom thenable without waiting or leaking headers', async () => {
    const result = { 'X-CSRF-Token': 'unused', then(_resolve: unknown, reject: (error: Error) => void) { reject(new Error('custom rejection')); } };
    transportWith((() => result) as unknown as NonNullable<AnalyticsConfig['headers']>).sendUnload(payload);
    expect(sentHeaders().get('X-CSRF-Token')).toBeNull();
    await settle();
    expect(logger.debug).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it('preserves static overrides and the HTTPS-only API key', () => {
    const config = { beaconUrl: 'https://ingest.example.com/beacon', videoId: 'v', apiKey: 'secret', headers: { 'content-type': 'text/plain', 'x-api-key': 'override' } };
    createTransport(config, logger, () => false).sendUnload(payload);
    expect(sentHeaders().get('Content-Type')).toBe('text/plain');
    expect(sentHeaders().get('X-API-Key')).toBe('override');
    fetchMock.mockClear();
    createTransport({ ...config, headers: {}, beaconUrl: 'http://ingest.example.com/beacon' }, logger, () => false).sendUnload(payload);
    expect(sentHeaders().get('X-API-Key')).toBeNull();
    fetchMock.mockClear();
    createTransport({ ...config, headers: {} }, logger, () => false).sendUnload(payload);
    expect(sentHeaders().get('X-API-Key')).toBe('secret');
  });

  it('uses sendBeacon with the URL API key without calling headers()', () => {
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    vi.stubGlobal('navigator', { sendBeacon });
    const headers = vi.fn(() => ({ 'X-Tenant': '42' }));
    createTransport({ beaconUrl: 'https://ingest.example.com/beacon', videoId: 'v', apiKey: 'secret', headers }, logger, () => false).sendUnload(payload);
    expect(new URL(sendBeacon.mock.calls[0][0]).searchParams.get('api_key')).toBe('secret');
    expect(headers).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
