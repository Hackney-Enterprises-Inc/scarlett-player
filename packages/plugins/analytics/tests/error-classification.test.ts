import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyError, errorDetail, sourceHost } from '../src/errors';
import { ErrorCode } from '@scarlett-player/core';
import { createHarness } from './harness';

// HEI-23, HEI-37: element errors carry a numeric MediaError code, which used
// to classify as `unknown`, and the beacon lacked the context to explain them.
describe('classifyError on a MediaError code', () => {
  it.each([
    [2, 'network'],
    [3, 'media'],
    [4, 'source'],
  ])('maps mediaErrorCode %i to %s', (mediaErrorCode, category) => {
    expect(classifyError({ code: mediaErrorCode, detail: { mediaErrorCode } })).toBe(category);
  });

  it('leaves an aborted load (code 1) unknown', () => {
    expect(classifyError({ code: 1, detail: { mediaErrorCode: 1 } })).toBe('unknown');
  });

  it('prefers a player code and detail.type over the MediaError code', () => {
    // The native provider reports a mid-stream code 4 as a network error
    expect(classifyError({ code: 'MEDIA_NETWORK_ERROR', detail: { mediaErrorCode: 4 } })).toBe('network');
    expect(classifyError({ code: 4, detail: { type: 'media', mediaErrorCode: 4 } })).toBe('media');
    expect(classifyError({ code: 'PLAYBACK_FAILED', detail: { mediaErrorCode: 2 } })).toBe('playback');
  });

  it('never classifies by message', () => {
    expect(classifyError({ message: 'network error', detail: {} })).toBe('unknown');
  });
});

describe('errorDetail', () => {
  it('passes networkState and readyState through', () => {
    expect(errorDetail({ mediaErrorCode: 4, networkState: 3, readyState: 0, url: 'https://x' }))
      .toEqual({ mediaErrorCode: 4, networkState: 3, readyState: 0 });
  });

  it('drops non-numeric states', () => {
    expect(errorDetail({ networkState: '3', readyState: NaN })).toEqual({});
  });
});

describe('sourceHost', () => {
  it('returns the host name only', () => {
    expect(sourceHost('https://user:pw@cdn.example.com:8443/live/a.m3u8?token=secret#t=1')).toBe('cdn.example.com');
  });

  it('returns undefined for a source with no host', () => {
    expect(sourceHost('blob:https://example.com/0f0e')).toBeUndefined();
    expect(sourceHost('data:video/mp4;base64,AAAA')).toBeUndefined();
    expect(sourceHost('')).toBeUndefined();
    expect(sourceHost(undefined)).toBeUndefined();
  });

  it('resolves a relative source against the page', () => {
    expect(sourceHost('/media/a.mp4')).toBe(window.location.hostname || undefined);
  });
});

describe('error beacon context', () => {
  let h: Awaited<ReturnType<typeof createHarness>>;

  afterEach(async () => {
    await h?.plugin.destroy();
    vi.restoreAllMocks();
  });

  it('adds online, sourceHost and the element states to a media:error beacon', async () => {
    h = await createHarness();
    h.state.set('source', { src: 'https://cdn.example.com/vod/a.m3u8?token=secret' });
    h.play();

    const error = Object.assign(new Error(''), {
      code: 4,
      detail: { mediaErrorCode: 4, networkState: 3, readyState: 0 },
    });
    h.bus.emit('media:error', { error });

    expect(h.sent('error')[0]).toMatchObject({
      errorCategory: 'source',
      online: true,
      sourceHost: 'cdn.example.com',
      mediaErrorCode: 4,
      networkState: 3,
      readyState: 0,
    });
    expect(JSON.stringify(h.sent('error')[0])).not.toContain('secret');
  });

  it('reports offline and the host on a core error beacon', async () => {
    h = await createHarness();
    h.state.set('source', { src: 'https://origin.example.com/live/index.m3u8' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    h.bus.emit('error', { code: ErrorCode.MEDIA_NETWORK_ERROR, message: 'manifest failed', fatal: true, timestamp: Date.now() });

    expect(h.sent('error')[0]).toMatchObject({
      errorCategory: 'network',
      online: false,
      sourceHost: 'origin.example.com',
    });
  });

  it('omits sourceHost when there is no source', async () => {
    h = await createHarness();
    h.bus.emit('media:error', { error: new Error('boom') });

    expect(h.sent('error')[0]).not.toHaveProperty('sourceHost');
    expect(h.sent('error')[0]).toHaveProperty('online', true);
  });
});
