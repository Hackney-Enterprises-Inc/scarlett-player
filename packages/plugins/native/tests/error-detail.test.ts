/**
 * Element error `detail` (HEI-23, HEI-37, plan B2).
 *
 * The fatal `error` carries the MediaError code and the element's
 * `networkState` and `readyState` read when the error fired, so telemetry
 * can tell a network failure from an unsupported source. Codes and messages
 * are unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNativePlugin } from '../src/index';

describe('element error detail', () => {
  let mockApi: any;

  const videoEl = (): HTMLVideoElement =>
    mockApi.container.querySelector('video') as HTMLVideoElement;

  /** Give the element a MediaError and element state, since jsdom produces neither. */
  const failWith = (error: { code: number; message: string } | null, networkState: number, readyState: number): void => {
    const el = videoEl();
    Object.defineProperty(el, 'error', { configurable: true, value: error });
    Object.defineProperty(el, 'networkState', { configurable: true, value: networkState });
    Object.defineProperty(el, 'readyState', { configurable: true, value: readyState });
    el.dispatchEvent(new Event('error'));
  };

  const emittedError = (): any =>
    mockApi.emit.mock.calls.filter(([event]: [string]) => event === 'error').pop()?.[1];

  beforeEach(async () => {
    const plugin = createNativePlugin({ loadTimeoutMs: 0 });
    const state: Record<string, unknown> = {};

    mockApi = {
      container: document.createElement('div'),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      on: vi.fn(() => vi.fn()),
      emit: vi.fn(),
      getState: vi.fn((key: string) => state[key]),
      setState: vi.fn((key: string, value: unknown) => {
        state[key] = value;
      }),
      subscribeToState: vi.fn().mockReturnValue(vi.fn()),
      onDestroy: vi.fn(),
    };

    await plugin.init(mockApi);
    void plugin.loadSource('https://example.com/video.mp4').catch(() => {});
  });

  it('carries mediaErrorCode, networkState and readyState', () => {
    failWith({ code: 4, message: '' }, 3, 0);

    expect(emittedError()).toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Format not supported',
      fatal: true,
      detail: { mediaErrorCode: 4, networkState: 3, readyState: 0 },
    });
  });

  it('reads the element state at error time', () => {
    failWith({ code: 2, message: 'net' }, 2, 1);

    expect(emittedError().detail).toEqual({ mediaErrorCode: 2, networkState: 2, readyState: 1 });
  });

  it('leaves mediaErrorCode out when there is no MediaError', () => {
    failWith(null, 3, 0);

    expect(emittedError().detail).toEqual({ networkState: 3, readyState: 0 });
  });
});
