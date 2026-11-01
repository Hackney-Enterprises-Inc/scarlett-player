import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../../src/utils/url';

describe('sanitizeUrl', () => {
  it('keeps origin and pathname for https URLs', () => {
    expect(sanitizeUrl('https://cdn.example.com/live/show/index.m3u8')).toBe(
      'https://cdn.example.com/live/show/index.m3u8'
    );
  });

  it('keeps origin and pathname for http URLs', () => {
    expect(sanitizeUrl('http://origin.example.com:8080/hls/a.m3u8?k=v')).toBe(
      'http://origin.example.com:8080/hls/a.m3u8'
    );
  });

  it('strips query strings and fragments', () => {
    expect(
      sanitizeUrl('https://cdn.example.com/live/index.m3u8?token=secret#frag')
    ).toBe('https://cdn.example.com/live/index.m3u8');
  });

  it('returns undefined for non-http/https protocols', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('data:text/html,<h1>test</h1>')).toBeUndefined();
    expect(sanitizeUrl('blob:https://example.com/uuid')).toBeUndefined();
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('returns undefined for invalid or absent URLs', () => {
    expect(sanitizeUrl('not a url')).toBeUndefined();
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl(null)).toBeUndefined();
    expect(sanitizeUrl('')).toBeUndefined();
  });

  it('redacts token-looking path segments', () => {
    expect(
      sanitizeUrl('https://cdn.example.com/1735689600_a1b2c3d4e5f60718_9f86d081884c7d659a2feaa0c55ad015/hls/x.m3u8')
    ).toBe('https://cdn.example.com/:redacted/hls/x.m3u8');
    expect(sanitizeUrl('https://cdn.example.com/live/my_stream_hd/1080p/x.m3u8')).toBe(
      'https://cdn.example.com/live/my_stream_hd/1080p/x.m3u8'
    );
  });
});
