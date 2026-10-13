/**
 * hls.js `mux` fatal retry and auto-reconnect tests (HEI-SCARLETT-54).
 *
 * hls.js 1.6 emits `muxError` only from the remuxer (`remuxAllocError`) and
 * escalates it to fatal once its own level-switch recovery cannot resolve it.
 * Until 1.24 that fatal fell to this plugin's unrecoverable branch: the
 * overlay at once, no `recoverMediaError()`, no live auto-reconnect, and
 * `detail.attempts` always 0. `mux` now shares the `media` path - the same
 * `maxMediaRetries` budget, `error:media` event and `recoverMediaError()`
 * recovery, the same live auto-reconnect - with `detail.type` staying 'mux'
 * so telemetry can still tell the classes apart.
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
  fireManifest,
  fireError,
} from './helpers';

/** A fatal hls.js remux failure, as the remuxer raises it. */
const MUX_FATAL = { type: 'muxError', details: 'remuxAllocError', fatal: true };

describe('hls.js mux fatal errors', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  /** State the plugin writes, read back through the mock API. */
  let state: Record<string, unknown>;
  /** State subscribers, so a `live` write classifies the source as in core. */
  let listeners: Array<(event: { key: string; value?: unknown }) => void>;
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/live/stream.m3u8';

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

    // State the plugin writes is state it reads back, and every write is
    // announced, so a `live` write classifies the source as it does in core
    state = { live: false };
    listeners = [];
    const mockApi = createMockAPI();
    mockApi.getState.mockImplementation((key: string) => state[key]);
    mockApi.setState.mockImplementation((key: string, value: unknown) => {
      state[key] = value;
      listeners.forEach((listener) => listener({ key, value }));
    });
    mockApi.subscribeToState.mockImplementation(
      (listener: (event: { key: string; value?: unknown }) => void) => {
        listeners.push(listener);
        return vi.fn();
      }
    );
    api = mockApi;

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Every fatal `error` payload emitted so far. */
  const fatalErrors = () =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls
      .filter(([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal)
      .map(([, payload]) => payload as { code?: ErrorCode; detail?: Record<string, unknown> });

  /** How many times an event name was emitted. */
  const emitsOf = (name: string): number =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(([event]) => event === name).length;

  /**
   * Load through hls.js and let the manifest parse, so the stream counts as
   * played. Live classification comes separately, from a `live` state write.
   *
   * @param config - Plugin configuration overrides
   */
  const loadAndPlay = async (config: Record<string, unknown> = {}) => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;
    return plugin;
  };

  it('retries up to maxMediaRetries, then goes fatal with both retries counted', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ maxMediaRetries: 2, autoReconnect: false });
    const c = created[0];

    // First fatal: absorbed behind the media budget
    fireError(c, MUX_FATAL);
    expect(emitsOf('error:media')).toBe(1);
    await vi.advanceTimersByTimeAsync(1200); // retry backoff is 0.7-1s
    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(fatalErrors()).toHaveLength(0);

    // Second fatal: the last of the budget
    fireError(c, MUX_FATAL);
    await vi.advanceTimersByTimeAsync(2400); // attempt 2 backoff is 1.4-2s
    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(fatalErrors()).toHaveLength(0);

    // Third fatal: budget spent, terminal, both attempts reported
    fireError(c, MUX_FATAL);
    await flush();

    expect(fatalErrors()).toHaveLength(1);
    expect(fatalErrors()[0].code).toBe(ErrorCode.MEDIA_DECODE_ERROR);
    expect(fatalErrors()[0].detail).toEqual({
      type: 'mux',
      retriesExhausted: true,
      attempts: 2,
    });

    await plugin.destroy();
  });

  it('marks the exhausted fatal on a live classified source and reconnects behind it', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ maxMediaRetries: 1 });
    api.setState('live', true);

    // First fatal is absorbed; the second has no budget left
    fireError(created[0], MUX_FATAL);
    await vi.advanceTimersByTimeAsync(1200);
    expect(created[0].instance.recoverMediaError).toHaveBeenCalledTimes(1);

    fireError(created[0], MUX_FATAL);
    await flush();

    // The fatal carries the reconnect marker before the reconnect is
    // scheduled, and error:reconnecting follows it (a live stream reconnects
    // even though nothing beyond the manifest ever played)
    expect(fatalErrors()).toHaveLength(1);
    expect(fatalErrors()[0].detail).toMatchObject({
      type: 'mux',
      retriesExhausted: true,
      attempts: 1,
      reconnecting: true,
    });
    expect(emitsOf('error:reconnecting')).toBe(1);

    // The reconnect keeps trying behind the fatal: a fresh pipeline
    await vi.advanceTimersByTimeAsync(2500); // first attempt: base 2s, 70-100% jitter
    expect(created).toHaveLength(2);

    await plugin.destroy();
  });

  /** A fragment download finishing, before the worker remuxes it. */
  const fragLoaded = (c: CapturedHls) => c.handlers['hlsFragLoaded']?.('hlsFragLoaded', {});
  /** A fragment remuxed and appended to the SourceBuffer. */
  const fragBuffered = (c: CapturedHls) => c.handlers['hlsFragBuffered']?.('hlsFragBuffered', {});

  it('does not refill the budget from a download whose remux then fails', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ maxMediaRetries: 2, autoReconnect: false });
    const c = created[0];

    // hls.js reports FRAG_LOADED before the remuxer fails on the same
    // fragment, so the download alone must not restore the media budget
    for (let attempt = 1; attempt <= 2; attempt++) {
      fragLoaded(c);
      fireError(c, MUX_FATAL);
      await vi.advanceTimersByTimeAsync(2400);
      expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(attempt);
    }
    fragLoaded(c);
    fireError(c, MUX_FATAL);
    await flush();

    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(fatalErrors()).toHaveLength(1);
    expect(fatalErrors()[0].detail).toMatchObject({ type: 'mux', retriesExhausted: true, attempts: 2 });

    await plugin.destroy();
  });

  it('refills the budget once a fragment is buffered', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ maxMediaRetries: 1, autoReconnect: false });
    const c = created[0];

    fireError(c, MUX_FATAL);
    await vi.advanceTimersByTimeAsync(1200);
    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(1);

    // The recovery worked: media was remuxed and appended again
    fragBuffered(c);
    fireError(c, MUX_FATAL);
    await vi.advanceTimersByTimeAsync(1200);

    expect(c.instance.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(fatalErrors()).toHaveLength(0);

    await plugin.destroy();
  });

  it('cancels a scheduled recovery when the next error is terminal', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ maxMediaRetries: 1, autoReconnect: false });
    const c = created[0];

    // Two failures inside one backoff (audio then video remux): the first
    // schedules a recovery, the second spends no budget and is terminal
    fireError(c, MUX_FATAL);
    fireError(c, { type: 'mediaError', details: 'bufferAppendError', fatal: true });
    expect(fatalErrors()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(c.instance.recoverMediaError).not.toHaveBeenCalled();

    await plugin.destroy();
  });

  it('reconnects a VOD whose manifest loaded, even before it played', async () => {
    vi.useFakeTimers();
    // The gate is the parsed manifest, not a play: no `playing` was written
    const plugin = await loadAndPlay({ maxMediaRetries: 0 });

    fireError(created[0], MUX_FATAL);
    await flush();

    expect(fatalErrors()[0].detail).toMatchObject({ type: 'mux', reconnecting: true });
    expect(emitsOf('error:reconnecting')).toBe(1);

    await plugin.destroy();
  });

  it('does not reconnect a VOD whose manifest never loaded', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ maxMediaRetries: 0 });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    // No manifest parsed: nothing played, so the fatal stays manual
    fireError(created[0], MUX_FATAL);
    await flush();

    expect(fatalErrors()).toHaveLength(1);
    expect(fatalErrors()[0].detail).toEqual({
      type: 'mux',
      retriesExhausted: true,
      attempts: 0,
    });
    expect(emitsOf('error:reconnecting')).toBe(0);

    await plugin.destroy();
  });
});