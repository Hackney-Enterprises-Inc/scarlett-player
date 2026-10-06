/**
 * `detail.reconnecting` marker on fatal errors (HEI-26, SCAR-ANALYTICS-15).
 *
 * A fatal error is emitted before the reconnect is scheduled, so a listener
 * (analytics) could not tell a recoverable failure from a terminal one. The
 * fatal `error` now carries `detail.reconnecting: true` when auto-reconnect
 * will take over. `fatal` and the event order are unchanged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  fireVideoError,
} from './helpers';

describe('reconnecting marker on fatal errors', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/stream.m3u8';
  const NETWORK_FATAL = { type: 'networkError', details: 'levelLoadTimeOut', fatal: true };

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

  const emits = () => (api.emit as ReturnType<typeof vi.fn>).mock.calls;

  const fatals = () =>
    emits()
      .filter(([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal)
      .map(([, payload]) => payload as { fatal: boolean; detail?: Record<string, unknown> });

  /** Load a source and let its manifest parse, so the stream has played. */
  const loadAndPlay = async (config: Record<string, unknown>) => {
    const plugin = createHLSPlugin({ maxNetworkRetries: 0, ...config });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await promise;
    return plugin;
  };

  it('marks a fatal that auto-reconnect will handle, before error:reconnecting', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({});

    fireError(created[0], NETWORK_FATAL);

    const fatal = fatals()[0];
    expect(fatal.fatal).toBe(true);
    expect(fatal.detail?.reconnecting).toBe(true);

    const names = emits().map(([event]) => event);
    expect(names.indexOf('error')).toBeLessThan(names.indexOf('error:reconnecting'));

    await plugin.destroy();
  });

  it('does not mark a fatal when autoReconnect is off', async () => {
    const plugin = await loadAndPlay({ autoReconnect: false });

    fireError(created[0], NETWORK_FATAL);

    expect(fatals()[0].detail).not.toHaveProperty('reconnecting');
    expect(emits().some(([event]) => event === 'error:reconnecting')).toBe(false);

    await plugin.destroy();
  });

  it('does not mark an initial VOD load failure, which stays manual', async () => {
    const plugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);
    const promise = plugin.loadSource(SRC);
    promise.catch(() => {});
    await flush();

    fireError(created[0], NETWORK_FATAL);
    await flush();

    expect(fatals()[0].detail).not.toHaveProperty('reconnecting');
    expect(emits().some(([event]) => event === 'error:reconnecting')).toBe(false);

    await plugin.destroy();
  });

  it('does not mark mux errors or schedule a reconnect for them', async () => {
    const plugin = await loadAndPlay({});
    fireError(created[0], { type: 'muxError', details: 'fragParsingError', fatal: true });
    expect(fatals()[0].detail).not.toHaveProperty('reconnecting');
    expect(emits().some(([event]) => event === 'error:reconnecting')).toBe(false);
    await plugin.destroy();
  });

  it('immediately follows a marked failed hls.js attempt past the window with exhaustion', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const plugin = await loadAndPlay({ reconnectWindowMs: 150, reconnectBaseDelayMs: 100, loadTimeoutMs: 0 });
    fireError(created[0], NETWORK_FATAL);
    await vi.advanceTimersByTimeAsync(100);
    expect(created).toHaveLength(2);
    vi.setSystemTime(Date.now() + 100);
    fireError(created[1], NETWORK_FATAL);

    const errors = fatals();
    expect(errors).toHaveLength(3);
    expect(errors[1].detail?.reconnecting).toBe(true);
    expect(errors[2].detail?.reconnectExhausted).toBe(true);
    expect(errors[2].detail).not.toHaveProperty('reconnecting');
    await flush();
    expect(fatals()).toHaveLength(3);
    await plugin.destroy();
  });

  it('settles a failed native attempt past the window without another timer tick', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
    vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    const plugin = createHLSPlugin({ maxNetworkRetries: 0, reconnectWindowMs: 150, reconnectBaseDelayMs: 100, loadTimeoutMs: 0 });
    await plugin.init(api);
    const loading = plugin.loadSource(SRC);
    await flush();
    const video = api.container.querySelector('video')!;
    video.dispatchEvent(new Event('loadedmetadata'));
    await loading;
    fireVideoError(video, 2, 'network failure');
    expect(fatals()[0].detail?.reconnecting).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    vi.setSystemTime(Date.now() + 100);
    fireVideoError(video, 2, 'network failure');
    await flush();

    expect(fatals().at(-1)?.detail?.reconnectExhausted).toBe(true);
    expect(fatals().at(-1)?.detail).not.toHaveProperty('reconnecting');
    expect(emits().filter(([event]) => event === 'error:reconnecting')).toHaveLength(1);
    await plugin.destroy();
  });

  it('does not mark the terminal error when the reconnect window is exhausted', async () => {
    vi.useFakeTimers();
    const plugin = await loadAndPlay({ reconnectWindowMs: 8000, loadTimeoutMs: 1000 });

    fireError(created[0], NETWORK_FATAL);
    await vi.advanceTimersByTimeAsync(24000);

    const all = fatals();
    const terminal = all[all.length - 1];
    expect(terminal.detail?.reconnectExhausted).toBe(true);
    expect(terminal.detail).not.toHaveProperty('reconnecting');

    await plugin.destroy();
  });
});
