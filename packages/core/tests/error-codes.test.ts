/**
 * Error code ownership on a failed `load()` (SCAR-HLS-4).
 *
 * A provider that reports its own failure through a structured fatal `error`
 * event before rejecting `loadSource()` owns the error code. Core's `load()`
 * catch must only log in that case: re-classifying the rejection's message
 * is what turned every native iOS load failure into `SOURCE_LOAD_FAILED`
 * and dropped the MediaError code from Sentry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScarlettPlayer } from '../src/scarlett-player';
import { ErrorCode, type PlayerError } from '../src/error-handler';
import type { Plugin, IPluginAPI } from '../src/types/plugin';

type ProviderPlugin = Plugin & {
  canPlay(src: string): boolean;
  loadSource(src: string): Promise<void>;
};

/**
 * Build a provider whose `loadSource()` always rejects, optionally after
 * emitting its own structured fatal error.
 *
 * @param emitStructured - Whether the provider reports the failure itself
 * @returns Provider plugin
 */
const createFailingProvider = (emitStructured: boolean): ProviderPlugin => {
  let api: IPluginAPI | null = null;
  return {
    id: 'failing-provider',
    name: 'Failing Provider',
    type: 'provider',
    version: '1.0.0',
    canPlay: () => true,
    init: vi.fn((pluginApi: IPluginAPI) => {
      api = pluginApi;
    }),
    destroy: vi.fn(),
    loadSource: vi.fn(async () => {
      if (emitStructured) {
        api?.emit('error', {
          code: ErrorCode.MEDIA_NETWORK_ERROR,
          message: 'HLS error: Failed to load HLS source (max retries exceeded)',
          fatal: true,
          timestamp: Date.now(),
          detail: { type: 'network', retriesExhausted: true, attempts: 3 },
        });
      }
      throw new Error('Failed to load HLS source');
    }),
  };
};

describe('load() error code ownership', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("keeps the provider's structured code instead of SOURCE_LOAD_FAILED", async () => {
    const player = new ScarlettPlayer({ container, plugins: [createFailingProvider(true)] });
    const errors: unknown[] = [];
    player.on('error', (err) => {
      errors.push(err);
    });

    await player.load('https://example.com/stream.m3u8');

    const error = player.getState().error as PlayerError | null;
    expect(error?.code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    expect(error?.detail).toEqual(
      expect.objectContaining({ retriesExhausted: true, attempts: 3 })
    );
    expect(errors).toHaveLength(1);

    await player.destroy();
  });

  it('classifies a bare rejection from its message when the provider reported nothing', async () => {
    const player = new ScarlettPlayer({ container, plugins: [createFailingProvider(false)] });

    await player.load('https://example.com/stream.m3u8');

    expect((player.getState().error as PlayerError | null)?.code).toBe(
      ErrorCode.SOURCE_LOAD_FAILED
    );

    await player.destroy();
  });
});
