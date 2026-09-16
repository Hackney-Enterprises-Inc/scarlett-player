/**
 * Tests for the failure classification: the README's error table in code.
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import { classifyResponse, classifyTransport, parseRetryAfter, readErrorEnvelope, WHEPError } from '../src/errors';

const URL = 'https://box.example.com:8889/whep/v1/streams/s?token=secret';

describe('parseRetryAfter', () => {
  it('reads a delta in seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter(' 30 ')).toBe(30000);
  });

  it('reads an HTTP-date against now', () => {
    const now = Date.parse('Wed, 16 Sep 2026 10:00:00 GMT');
    expect(parseRetryAfter('Wed, 16 Sep 2026 10:00:07 GMT', now)).toBe(7000);
    expect(parseRetryAfter('Wed, 16 Sep 2026 09:59:00 GMT', now)).toBeUndefined();
  });

  it('yields nothing for an absent or unreadable value', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('readErrorEnvelope', () => {
  it('reads the Tmesis envelope', () => {
    expect(readErrorEnvelope('{"error":{"code":"not_live","message":"no media yet"}}')).toEqual({
      code: 'not_live',
      message: 'no media yet',
    });
  });

  it('yields nothing for other bodies', () => {
    expect(readErrorEnvelope('')).toEqual({});
    expect(readErrorEnvelope('v=0')).toEqual({});
    expect(readErrorEnvelope('{"error":"string"}')).toEqual({});
    expect(readErrorEnvelope('{"error":{"code":5}}')).toEqual({ code: undefined, message: undefined });
  });
});

describe('classifyResponse', () => {
  const body = (code: string) => JSON.stringify({ error: { code, message: `m-${code}` } });

  it.each([
    [400, 'bad_request', ErrorCode.SOURCE_LOAD_FAILED, false],
    [401, undefined, ErrorCode.SOURCE_LOAD_FAILED, false],
    [403, undefined, ErrorCode.SOURCE_LOAD_FAILED, false],
    [404, 'not_found', ErrorCode.SOURCE_LOAD_FAILED, false],
    [405, 'method_not_allowed', ErrorCode.SOURCE_LOAD_FAILED, false],
    [406, 'unsupported_media', ErrorCode.SOURCE_LOAD_FAILED, false],
    [409, 'not_live', ErrorCode.MEDIA_NETWORK_ERROR, true],
    [413, 'payload_too_large', ErrorCode.SOURCE_LOAD_FAILED, false],
    [415, 'unsupported_media_type', ErrorCode.SOURCE_LOAD_FAILED, false],
    [418, undefined, ErrorCode.SOURCE_LOAD_FAILED, false],
    [500, 'internal', ErrorCode.MEDIA_NETWORK_ERROR, true],
    [503, 'max_monitors', ErrorCode.MEDIA_NETWORK_ERROR, true],
    [503, 'preview_disabled', ErrorCode.MEDIA_NETWORK_ERROR, true],
  ])('%i %s maps onto %s (recoverable: %s)', (status, code, expected, recoverable) => {
    const failure = classifyResponse(status, 'application/json', null, code ? body(code) : '', URL);
    expect(failure.code).toBe(expected);
    expect(failure.recoverable).toBe(recoverable);
    expect(failure.serverCode).toBe(code);
    expect(failure.detail.httpStatus).toBe(status);
    expect(failure.detail.url).toBe('https://box.example.com:8889/whep/v1/streams/s');
    if (code) expect(failure.message).toContain(`m-${code}`);
  });

  it('carries the Retry-After', () => {
    expect(classifyResponse(409, 'application/json', '5', body('not_live'), URL).retryAfterMs).toBe(5000);
    expect(classifyResponse(503, 'application/json', '30', body('max_monitors'), URL).retryAfterMs).toBe(30000);
    expect(classifyResponse(409, 'application/json', null, body('not_live'), URL).retryAfterMs).toBeUndefined();
  });

  it('names a 406 counter-offer as unsupported', () => {
    const failure = classifyResponse(406, 'application/sdp; charset=utf-8', null, 'v=0\r\n', URL);
    expect(failure.code).toBe(ErrorCode.SOURCE_LOAD_FAILED);
    expect(failure.recoverable).toBe(false);
    expect(failure.message).toContain('counter-offer');
    expect(failure.detail.type).toBe('media');
  });

  it('classes a token refusal as network with the status', () => {
    const failure = classifyResponse(401, null, null, '', URL);
    expect(failure.detail).toEqual({ type: 'network', httpStatus: 401, url: 'https://box.example.com:8889/whep/v1/streams/s' });
  });
});

describe('classifyTransport', () => {
  it('every kind is recoverable and carries the sanitized URL', () => {
    for (const kind of ['fetch', 'ice', 'timeout', 'answer'] as const) {
      const failure = classifyTransport(kind, URL, 'why');
      expect(failure.code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
      expect(failure.recoverable).toBe(true);
      expect(failure.message).toContain('why');
      expect(failure.detail.url).toBe('https://box.example.com:8889/whep/v1/streams/s');
    }
    expect(classifyTransport('answer', URL).detail.type).toBe('media');
    expect(classifyTransport('ice', URL).detail.type).toBe('network');
  });
});

describe('WHEPError', () => {
  it('carries the failure and reads as an Error', () => {
    const failure = classifyTransport('fetch', URL);
    const error = new WHEPError(failure);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WHEPError');
    expect(error.message).toBe(failure.message);
    expect(error.failure).toBe(failure);
  });
});
