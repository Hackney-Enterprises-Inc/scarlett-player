/**
 * Fatal error diagnostics and reconnect payload tests
 * (fix/scarlett-core-lifecycle Fix 3).
 *
 * `{ code, message }` alone could not explain why a stream died during the
 * 2026-08-29 origin outage. Fatal errors now carry a `detail` block, and the
 * reconnect events carry enough for a UI to show progress toward giving up.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import { PLAYLIST_INVALID_TEXT } from '../src/playlist-validation';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
  fireManifest,
  fireError,
} from './helpers';

describe('fatal error detail payload', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';
  const SEGMENT_URL = 'https://cdn.example.com/live/720p/00042.ts?token=secret&exp=999#frag';

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

  /** The payload of the last emitted fatal `error` event. */
  const lastFatalError = () => {
    const calls = (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal
    );
    return calls[calls.length - 1]?.[1] as
      | { message: string; detail?: Record<string, unknown> }
      | undefined;
  };

  /**
   * Load a source and fire one hls.js error against it.
   *
   * @param config - Plugin configuration overrides
   * @param errorData - Raw hls.js error data
   */
  const loadAndFail = async (
    config: Record<string, unknown>,
    errorData: Record<string, unknown>
  ) => {
    const plugin = createHLSPlugin({ autoReconnect: false, ...config });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();
    fireError(created[0], errorData);
    await flush();
    return plugin;
  };

  it('reports type, retriesExhausted, attempts, httpStatus, and a sanitized URL', async () => {
    await loadAndFail(
      { maxNetworkRetries: 0 },
      {
        type: 'networkError',
        details: 'fragLoadError',
        fatal: true,
        url: SEGMENT_URL,
        response: { code: 403, text: 'Forbidden' },
      }
    );

    expect(lastFatalError()?.detail).toEqual({
      type: 'network',
      retriesExhausted: true,
      attempts: 0,
      httpStatus: 403,
      url: 'https://cdn.example.com/live/720p/00042.ts',
    });
  });

  it('never leaks the query string of the failing URL', async () => {
    await loadAndFail(
      { maxNetworkRetries: 0 },
      { type: 'networkError', details: 'fragLoadError', fatal: true, url: SEGMENT_URL }
    );

    expect(lastFatalError()?.detail?.url).not.toContain('token');
    expect(lastFatalError()?.detail?.url).not.toContain('?');
  });

  it('counts the recovery attempts that were actually made', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ maxNetworkRetries: 1, autoReconnect: false });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    // First failure is retried, second exhausts the budget
    fireError(created[0], { type: 'networkError', details: 'fragLoadError', fatal: true });
    await vi.advanceTimersByTimeAsync(1500);
    fireError(created[0], { type: 'networkError', details: 'fragLoadError', fatal: true });
    await flush();

    expect(lastFatalError()?.detail).toMatchObject({
      type: 'network',
      retriesExhausted: true,
      attempts: 1,
    });
  });

  it('omits httpStatus for a media error that carries no response', async () => {
    await loadAndFail(
      { maxMediaRetries: 0 },
      { type: 'mediaError', details: 'fragParsingError', fatal: true }
    );

    const detail = lastFatalError()?.detail;
    expect(detail).toMatchObject({ type: 'media', retriesExhausted: true });
    expect(detail).not.toHaveProperty('httpStatus');
    expect(detail).not.toHaveProperty('url');
  });

  it('omits httpStatus for the synthetic playlist-validation error (code 0)', async () => {
    await loadAndFail(
      { maxNetworkRetries: 0 },
      {
        type: 'networkError',
        details: 'levelLoadError',
        fatal: true,
        response: { code: 0, text: PLAYLIST_INVALID_TEXT },
      }
    );

    expect(lastFatalError()?.detail).not.toHaveProperty('httpStatus');
  });
});

describe('reconnect event payloads', () => {
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

  const lastPayload = (name: string) => {
    const calls = (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event]) => event === name
    );
    return calls[calls.length - 1]?.[1] as Record<string, unknown> | undefined;
  };

  it('reports attempt, delay, and window progress on error:reconnecting', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ maxNetworkRetries: 0, reconnectWindowMs: 60000 });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;

    // Fatal mid-playback network error starts the reconnect scheduler
    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });

    expect(lastPayload('error:reconnecting')).toEqual({
      attempt: 1,
      delayMs: expect.any(Number),
      elapsedMs: expect.any(Number),
      windowMs: 60000,
    });

    await plugin.destroy();
  });

  it('reports which attempt recovered and how long the outage lasted', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;

    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });

    // First reconnect attempt fires (base 2s with 70-100% jitter)
    await vi.advanceTimersByTimeAsync(2500);
    expect(created).toHaveLength(2);

    fireManifest(created[1]);
    await flush();

    const recovered = lastPayload('error:recovered');
    expect(recovered).toMatchObject({ attempt: 1 });
    expect(recovered?.elapsedMs).toBeGreaterThanOrEqual(0);

    await plugin.destroy();
  });
});

describe('reconnect window exhaustion', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';
  /** Short window so the scheduler runs out inside the test */
  const WINDOW_MS = 8000;

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

  const emitsOf = (name: string) =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(([event]) => event === name);

  /**
   * Load, play, then fail forever: every reconnect attempt builds a pipeline
   * whose manifest never parses, so the scheduler keeps re-arming until the
   * window closes.
   */
  const exhaustTheWindow = async () => {
    const plugin = createHLSPlugin({
      maxNetworkRetries: 0,
      reconnectWindowMs: WINDOW_MS,
      // Short watchdog so each failed attempt settles inside the window
      loadTimeoutMs: 1000,
    });
    await plugin.init(api);

    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;

    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });

    // Well past the window: attempts keep failing on the load watchdog
    await vi.advanceTimersByTimeAsync(WINDOW_MS * 3);

    return plugin;
  };

  it('announces exhaustion instead of going permanently quiet', async () => {
    vi.useFakeTimers();
    const plugin = await exhaustTheWindow();

    const exhausted = emitsOf('error:reconnect-exhausted');
    expect(exhausted).toHaveLength(1);
    expect(exhausted[0][1]).toMatchObject({
      windowMs: WINDOW_MS,
      attempts: expect.any(Number),
    });
    expect((exhausted[0][1] as { attempts: number }).attempts).toBeGreaterThan(0);
    expect((exhausted[0][1] as { elapsedMs: number }).elapsedMs).toBeGreaterThan(WINDOW_MS);

    await plugin.destroy();
  });

  it('follows exhaustion with a final fatal error carrying reconnectExhausted', async () => {
    vi.useFakeTimers();
    const plugin = await exhaustTheWindow();

    const fatals = (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal
    );
    const terminal = fatals[fatals.length - 1][1] as {
      detail?: Record<string, unknown>;
    };

    expect(terminal.detail).toMatchObject({
      type: 'network',
      retriesExhausted: true,
      reconnectExhausted: true,
    });

    await plugin.destroy();
  });

  it('schedules no further reconnect attempts once the window has closed', async () => {
    vi.useFakeTimers();
    const plugin = await exhaustTheWindow();

    const pipelines_at_exhaustion = created.length;
    const reconnecting_at_exhaustion = emitsOf('error:reconnecting').length;

    await vi.advanceTimersByTimeAsync(WINDOW_MS * 5);

    expect(created).toHaveLength(pipelines_at_exhaustion);
    expect(emitsOf('error:reconnecting')).toHaveLength(reconnecting_at_exhaustion);
    // And the announcement stays exactly once, not once per later failure
    expect(emitsOf('error:reconnect-exhausted')).toHaveLength(1);

    await plugin.destroy();
  });

  it('reopens the window for a fresh source after exhaustion', async () => {
    vi.useFakeTimers();
    const plugin = await exhaustTheWindow();

    // Try Again reloads through loadSource, which resets reconnect state
    const promise = plugin.loadSource('http://example.com/other.m3u8');
    await flush();
    fireManifest(created[created.length - 1]);
    await flush();
    await promise;

    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    fireError(created[created.length - 1], {
      type: 'networkError',
      details: 'levelLoadTimeOut',
      fatal: true,
    });

    expect(emitsOf('error:reconnecting')).toHaveLength(1);

    await plugin.destroy();
  });
});
