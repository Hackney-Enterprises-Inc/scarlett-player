/**
 * HLS fatal error code classification tests
 * (Phase 2 of fix/scarlett-error-absorption).
 *
 * Append and quota failures from hls.js (error.details) must surface as
 * their own structured codes so the UI can show accurate copy, while the
 * media-recovery path still runs before anything goes terminal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCode } from '@scarlett-player/core';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireError,
} from './helpers';

describe('HLS fatal error code classification', () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Load a source with the given plugin config, fire one fatal hls.js
   * error, and return once the load promise settles.
   */
  const loadAndFail = async (
    config: Record<string, unknown>,
    errorData: Record<string, unknown>
  ) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    fireError(created[0], errorData);
    await flush();
    return plugin;
  };

  const expectEmittedCode = (code: ErrorCode) => {
    expect(api.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code, fatal: true })
    );
  };

  it('classifies bufferFullError as MEDIA_BUFFER_FULL', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'bufferFullError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_BUFFER_FULL);
  });

  it('classifies bufferAppendError as MEDIA_APPEND_ERROR', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'bufferAppendError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_APPEND_ERROR);
  });

  it('classifies bufferAppendingError as MEDIA_APPEND_ERROR', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'bufferAppendingError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_APPEND_ERROR);
  });

  it('classifies bufferAddCodecError as MEDIA_APPEND_ERROR', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'bufferAddCodecError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_APPEND_ERROR);
  });

  it('keeps classifying generic media errors as MEDIA_DECODE_ERROR', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'fragParsingError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_DECODE_ERROR);
  });

  it('keeps classifying network errors as MEDIA_NETWORK_ERROR', async () => {
    await loadAndFail(
      { maxNetworkRetries: 0 },
      { type: 'networkError', details: 'manifestLoadError', fatal: true }
    );
    expectEmittedCode(ErrorCode.MEDIA_NETWORK_ERROR);
  });

  it('still runs media recovery before an append failure goes terminal', async () => {
    vi.useFakeTimers();

    const plugin = createHLSPlugin({ maxMediaRetries: 1 });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    const c = created[0];

    // First append failure: recovery is attempted, nothing terminal yet
    fireError(c, { type: 'mediaError', details: 'bufferAppendError', fatal: true });
    await vi.advanceTimersByTimeAsync(1500); // recovery delay is 0.7-1s
    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(api.emit).not.toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ fatal: true })
    );

    // Second failure exhausts the budget: terminal with the append code
    fireError(c, { type: 'mediaError', details: 'bufferAppendError', fatal: true });
    await flush();
    expectEmittedCode(ErrorCode.MEDIA_APPEND_ERROR);
  });
});
