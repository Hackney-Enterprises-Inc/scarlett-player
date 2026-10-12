/**
 * When `loadSource()` settles on the hls.js path (HEI-SCARLETT-53, decision
 * #162). A fatal error settles the pending load at once, even when the source
 * is classified live and auto-reconnect takes over behind it: hosts follow
 * `error:reconnecting` and `error:recovered`, not the promise. The native path
 * is pinned by native-retry.test.ts ("still rejects promptly when a live
 * failure hands off to auto-reconnect").
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
  fireError,
} from './helpers';

const NETWORK_FATAL = { type: 'networkError', details: 'manifestLoadError', fatal: true };

describe('hls.js load() settling on a live failure', () => {
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
      .map(([, payload]) => payload as { detail?: Record<string, unknown> });

  /** How many times an event name was emitted. */
  const emitsOf = (name: string): number =>
    (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(([event]) => event === name).length;

  it('rejects the pending load at the fatal while a live reconnect is scheduled', async () => {
    vi.useFakeTimers();
    const plugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await plugin.init(api);
    let outcome: 'pending' | 'resolved' | 'rejected' = 'pending';
    plugin.loadSource(SRC).then(
      () => { outcome = 'resolved'; },
      () => { outcome = 'rejected'; }
    );
    await flush();
    api.setState('live', true);

    fireError(created[0], NETWORK_FATAL);
    await flush();

    expect(fatalErrors()).toHaveLength(1);
    expect(fatalErrors()[0].detail).toMatchObject({ reconnecting: true });
    expect(emitsOf('error:reconnecting')).toBe(1);
    expect(outcome).toBe('rejected');

    await plugin.destroy();
  });
});
