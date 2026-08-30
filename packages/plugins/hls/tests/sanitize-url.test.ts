/**
 * sanitizeUrl tests (fix/scarlett-core-lifecycle Fix 3).
 *
 * The helper feeds `detail.url` on emitted fatal errors, so it must never
 * leak a query string (signed-URL tokens, signatures, session ids) and must
 * never throw from inside an error path.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../src/sanitize-url';

describe('sanitizeUrl', () => {
  it('keeps origin and pathname', () => {
    expect(sanitizeUrl('https://cdn.example.com/live/show/index.m3u8')).toBe(
      'https://cdn.example.com/live/show/index.m3u8'
    );
  });

  it('strips the query string', () => {
    expect(
      sanitizeUrl('https://cdn.example.com/live/index.m3u8?token=secret&exp=123')
    ).toBe('https://cdn.example.com/live/index.m3u8');
  });

  it('strips the fragment', () => {
    expect(sanitizeUrl('https://cdn.example.com/live/index.m3u8#t=10')).toBe(
      'https://cdn.example.com/live/index.m3u8'
    );
  });

  it('strips both a query string and a fragment', () => {
    expect(
      sanitizeUrl('https://cdn.example.com/live/index.m3u8?sig=abc#frag')
    ).toBe('https://cdn.example.com/live/index.m3u8');
  });

  it('keeps a non-default port', () => {
    expect(sanitizeUrl('http://origin.example.com:8080/hls/a.m3u8?k=v')).toBe(
      'http://origin.example.com:8080/hls/a.m3u8'
    );
  });

  it('returns undefined for a malformed URL instead of throwing', () => {
    expect(() => sanitizeUrl('not a url?token=secret')).not.toThrow();
    expect(sanitizeUrl('not a url?token=secret')).toBeUndefined();
  });

  it('returns undefined for absent input', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl(null)).toBeUndefined();
    expect(sanitizeUrl('')).toBeUndefined();
  });
});
