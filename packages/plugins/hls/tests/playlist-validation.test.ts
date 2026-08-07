/**
 * Playlist refresh validation tests
 * (Phase 3 of fix/scarlett-error-absorption).
 *
 * A live media-playlist refresh that returns an error page, a master-only
 * response, or an empty document must become a normal network error (and
 * ride the existing retry -> reconnect -> retry-UI chain) instead of being
 * indexed blindly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  isValidPlaylistDocument,
  createValidatingPlaylistLoader,
  PLAYLIST_INVALID_TEXT,
} from '../src/playlist-validation';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireError,
} from './helpers';

const MEDIA_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:6',
  '#EXT-X-MEDIA-SEQUENCE:100',
  '#EXTINF:6.000,',
  'segment100.ts',
  '#EXTINF:6.000,',
  'segment101.ts',
].join('\n');

const MASTER_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
  'stream_720.m3u8',
].join('\n');

const ERROR_PAGE = '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>';

describe('isValidPlaylistDocument()', () => {
  it('accepts a media playlist for a level refresh', () => {
    expect(isValidPlaylistDocument(MEDIA_PLAYLIST, 'level')).toBe(true);
  });

  it('accepts a live media playlist with a target duration but no segments yet', () => {
    const empty_window = '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0';
    expect(isValidPlaylistDocument(empty_window, 'level')).toBe(true);
  });

  it('rejects an HTML error page for a level refresh', () => {
    expect(isValidPlaylistDocument(ERROR_PAGE, 'level')).toBe(false);
  });

  it('rejects a master-only response for a level refresh (stream transition case)', () => {
    expect(isValidPlaylistDocument(MASTER_PLAYLIST, 'level')).toBe(false);
  });

  it('rejects empty and non-string documents', () => {
    expect(isValidPlaylistDocument('', 'level')).toBe(false);
    expect(isValidPlaylistDocument(undefined, 'level')).toBe(false);
    expect(isValidPlaylistDocument(new ArrayBuffer(8), 'level')).toBe(false);
  });

  it('accepts both master and media playlists at the manifest phase', () => {
    expect(isValidPlaylistDocument(MASTER_PLAYLIST, 'manifest')).toBe(true);
    expect(isValidPlaylistDocument(MEDIA_PLAYLIST, 'manifest')).toBe(true);
  });

  it('rejects an error page at the manifest phase', () => {
    expect(isValidPlaylistDocument(ERROR_PAGE, 'manifest')).toBe(false);
  });

  it('applies the media-playlist requirement to track refreshes too', () => {
    expect(isValidPlaylistDocument(MASTER_PLAYLIST, 'audioTrack')).toBe(false);
    expect(isValidPlaylistDocument(MEDIA_PLAYLIST, 'subtitleTrack')).toBe(true);
  });
});

describe('createValidatingPlaylistLoader()', () => {
  let receivedCallbacks: any;

  class FakeBaseLoader {
    load(_context: unknown, _config: unknown, callbacks: unknown): void {
      receivedCallbacks = callbacks;
    }
    abort(): void {}
    destroy(): void {}
  }

  const FakeHls = { DefaultConfig: { loader: FakeBaseLoader } };
  const context = { type: 'level', url: 'http://example.com/live.m3u8' };
  const stats = { loading: {} };

  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let loader: any;

  beforeEach(() => {
    receivedCallbacks = null;
    onSuccess = vi.fn();
    onError = vi.fn();
    const LoaderClass = createValidatingPlaylistLoader(FakeHls as any) as any;
    loader = new LoaderClass();
    loader.load(context, {}, { onSuccess, onError });
  });

  it('passes a valid media playlist through untouched', () => {
    receivedCallbacks.onSuccess({ data: MEDIA_PLAYLIST }, stats, context, null);

    expect(onSuccess).toHaveBeenCalledWith({ data: MEDIA_PLAYLIST }, stats, context, null);
    expect(onError).not.toHaveBeenCalled();
  });

  it('converts an error-page refresh into a loader error', () => {
    receivedCallbacks.onSuccess({ data: ERROR_PAGE }, stats, context, null);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      { code: 0, text: PLAYLIST_INVALID_TEXT },
      context,
      null,
      stats
    );
  });

  it('converts a master-only refresh into a loader error', () => {
    receivedCallbacks.onSuccess({ data: MASTER_PLAYLIST }, stats, context, null);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      { code: 0, text: PLAYLIST_INVALID_TEXT },
      context,
      null,
      stats
    );
  });
});

describe('pLoader wiring and terminal classification', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as any;
    });

    api = createMockAPI();

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs the validating pLoader by default', async () => {
    const plugin = createHLSPlugin();
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    const config = (hlsLoader.createHlsInstance as any).mock.calls[0][0];
    expect(config.pLoader).toEqual(expect.any(Function));
  });

  it('omits the pLoader when validatePlaylists is false', async () => {
    const plugin = createHLSPlugin({ validatePlaylists: false });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    const config = (hlsLoader.createHlsInstance as any).mock.calls[0][0];
    expect(config.pLoader).toBeUndefined();
  });

  it('classifies an exhausted invalid-playlist failure as PLAYLIST_INVALID', async () => {
    const plugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    // The synthetic loader error surfaces from hls.js as a level load
    // failure whose response carries the invalid-playlist marker
    fireError(created[0], {
      type: 'networkError',
      details: 'levelLoadError',
      fatal: true,
      response: { code: 0, text: PLAYLIST_INVALID_TEXT },
    });
    await flush();

    expect(api.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: ErrorCode.PLAYLIST_INVALID, fatal: true })
    );
  });
});
