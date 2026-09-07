/**
 * Built-in endpoint transport tests (plan "Submission" acceptance).
 *
 * A fake fetch double stands in for the network: every assertion inspects
 * the RequestInit the transport built and the outcome for the response the
 * double produced. Documented failure contract: every rejection is a
 * ClipSubmitError - HTTP failures carry the status and parsed body,
 * transport failures and timeouts carry status 0.
 */

import { describe, it, expect } from 'vitest';
import { ClipSubmitError } from '../src/types';
import type { ClipEndpointConfig, ClipRange } from '../src/types';
import { submitViaEndpoint } from '../src/submit';

const RANGE: ClipRange = {
  startTime: 70,
  endTime: 100,
  duration: 30,
  mediaId: 'video-42',
  clientRequestId: 'crq-1',
  title: 'Best bit',
  isLive: false,
  seekableStart: null,
  seekableEnd: null,
  startDate: null,
  endDate: null,
  capturedAt: '2026-09-07T12:00:00.000Z',
};

function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function textResponse(status: number, text: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as unknown as Response;
}

function fakeFetch(response: Response) {
  const fn = async () => response;
  return Object.assign(fn, { calls: [] as Array<[string, RequestInit]> }) as unknown as typeof globalThis.fetch & {
    calls: Array<[string, RequestInit]>;
  };
}

/** Fetch mock whose init capture survives the caller's inspection. */
function captureFetch(responseFactory: (init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = async (_url: unknown, init: RequestInit) => {
    calls.push({ url: String(_url), init });
    return responseFactory(init);
  };
  return Object.assign(fn, { calls }) as unknown as typeof globalThis.fetch & {
    calls: Array<{ url: string; init: RequestInit }>;
  };
}

const cfg = (overrides: Partial<ClipEndpointConfig> = {}): ClipEndpointConfig => ({
  url: '/api/clips',
  fetch: fakeFetch(jsonResponse(201, { uuid: 'clip-1', status: 'rendering' })),
  ...overrides,
});

describe('submitViaEndpoint', () => {
  it('resolves the parsed JSON on 2xx', async () => {
    await expect(submitViaEndpoint(RANGE, cfg())).resolves.toEqual({
      uuid: 'clip-1',
      status: 'rendering',
    });
  });

  it('POSTs the ClipRange verbatim, same-origin, with JSON content type', async () => {
    const fetchImpl = captureFetch(() => jsonResponse(200, null));
    await submitViaEndpoint(RANGE, { url: '/api/clips', fetch: fetchImpl });

    expect(fetchImpl.calls).toHaveLength(1);
    const { url, init } = fetchImpl.calls[0];
    expect(url).toBe('/api/clips');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(RANGE);
  });

  it('treats an empty 2xx body as a success with result null', async () => {
    await expect(submitViaEndpoint(RANGE, cfg({ fetch: fakeFetch(textResponse(204, '')) }))).resolves.toBeNull();
  });

  it('treats a non-JSON 2xx body as a success with result null', async () => {
    await expect(submitViaEndpoint(RANGE, cfg({ fetch: fakeFetch(textResponse(200, 'ok')) }))).resolves.toBeNull();
  });

  it('rejects a 422 with ClipSubmitError carrying status and the parsed body', async () => {
    const error = await submitViaEndpoint(
      RANGE,
      cfg({ fetch: fakeFetch(jsonResponse(422, { message: 'Clips may be at most 60 seconds' })) }),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClipSubmitError);
    expect((error as ClipSubmitError).status).toBe(422);
    expect((error as ClipSubmitError).body).toEqual({ message: 'Clips may be at most 60 seconds' });
  });

  it('rejects a 429 with status 429 and a null body when the server sends none', async () => {
    const error = await submitViaEndpoint(RANGE, cfg({ fetch: fakeFetch(jsonResponse(429)) })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClipSubmitError);
    expect((error as ClipSubmitError).status).toBe(429);
    expect((error as ClipSubmitError).body).toBeNull();
  });

  it('wraps a network error as ClipSubmitError with status 0', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof globalThis.fetch;

    const error = await submitViaEndpoint(RANGE, cfg({ fetch: failing })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClipSubmitError);
    expect((error as ClipSubmitError).status).toBe(0);
    expect((error as Error).message).toContain('Failed to fetch');
  });

  it('aborts at timeoutMs and reports a status-0 timeout error', async () => {
    const hanging = ((..._args: unknown[]) =>
      new Promise((_resolve, reject) => {
        const init = _args[1] as RequestInit;
        init.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      })) as unknown as typeof globalThis.fetch;

    const error = await submitViaEndpoint(RANGE, cfg({ fetch: hanging, timeoutMs: 10 })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClipSubmitError);
    expect((error as ClipSubmitError).status).toBe(0);
    expect((error as Error).message).toContain('timed out');
  });

  it('resolves a headers function per request, merged over the JSON default', async () => {
    let token = 'Bearer t1';
    let resolutions = 0;
    const fetchImpl = captureFetch(() => jsonResponse(200, null));
    const endpoint: ClipEndpointConfig = {
      url: '/api/clips',
      fetch: fetchImpl,
      headers: async () => {
        resolutions += 1;
        return { Authorization: token };
      },
    };

    await submitViaEndpoint(RANGE, endpoint);
    token = 'Bearer t2';
    await submitViaEndpoint(RANGE, endpoint);

    expect(resolutions).toBe(2);
    expect((fetchImpl.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer t1');
    expect((fetchImpl.calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer t2');
    expect((fetchImpl.calls[1].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('accepts static headers, PUT, explicit credentials and a body reshaper', async () => {
    const fetchImpl = captureFetch(() => jsonResponse(200, null));
    await submitViaEndpoint(RANGE, {
      url: '/api/clips',
      method: 'PUT',
      headers: { 'X-Key': 'abc' },
      credentials: 'include',
      body: (range) => ({ media: range.mediaId, from: range.startTime, to: range.endTime }),
      fetch: fetchImpl,
    });

    const { init } = fetchImpl.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-Key']).toBe('abc');
    expect(JSON.parse(init.body as string)).toEqual({ media: 'video-42', from: 70, to: 100 });
  });
});
