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

  describe('path-embedded tokens', () => {
    const SIG = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

    it('redacts the Fastly-shaped <expiry>_<nonce>_<sig> segment', () => {
      expect(
        sanitizeUrl(
          `https://live.combatsportsnow.com/1735689600_a1b2c3d4e5f60718_${SIG}/hls/event/playlist.m3u8?x=1`
        )
      ).toBe('https://live.combatsportsnow.com/:redacted/hls/event/playlist.m3u8');
    });

    it('redacts an underscore-joined segment with a base64url signature', () => {
      expect(
        sanitizeUrl('https://cdn.example.com/1735689600_k3Jd9sLx_Qm7ZpR2vT8nWc4YbH6aF1eUg0Xo/a/b.m3u8')
      ).toBe('https://cdn.example.com/:redacted/a/b.m3u8');
    });

    it('redacts a long hex segment', () => {
      expect(sanitizeUrl(`https://cdn.example.com/${SIG}/live/index.m3u8`)).toBe(
        'https://cdn.example.com/:redacted/live/index.m3u8'
      );
    });

    it('redacts several token segments independently', () => {
      expect(
        sanitizeUrl(`https://cdn.example.com/${SIG}/x/${SIG.slice(0, 32)}/i.m3u8`)
      ).toBe('https://cdn.example.com/:redacted/x/:redacted/i.m3u8');
    });

    it('still strips the query and fragment alongside', () => {
      expect(sanitizeUrl(`https://cdn.example.com/${SIG}/i.m3u8?t=1#f`)).toBe(
        'https://cdn.example.com/:redacted/i.m3u8'
      );
    });
  });

  describe('ordinary paths are left unchanged', () => {
    it.each([
      'https://cdn.example.com/hls/live/1080p/playlist.m3u8',
      'https://cdn.example.com/live/my_stream_hd/index.m3u8',
      'https://cdn.example.com/live/main_event_2026_11_01/index.m3u8',
      'https://cdn.example.com/live/international_broadcasting_channel/index.m3u8',
      'https://cdn.example.com/vod/1735689600/seg_00012.ts',
      'https://cdn.example.com/2026/11/01/replay/index.m3u8',
      'https://cdn.example.com/videos/12345678/master.m3u8',
      'https://cdn.example.com/a/123e4567-e89b-12d3-a456-426614174000/index.m3u8',
      'https://cdn.example.com/live/deadbeef/index.m3u8',
      'https://cdn.example.com/',
    ])('%s', (url) => {
      expect(sanitizeUrl(url)).toBe(url);
    });
  });
});
