import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockAPI,
  createMockHlsConstructor,
  fireManifest,
  installMediaStubs,
} from './helpers';

const fireHlsEvent = (captured: CapturedHls, event: string, data: unknown): void => {
  captured.handlers[event]?.(event, data);
};

beforeEach(() => {
  installMediaStubs();
  hlsLoader.resetLoader();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it.each(['fragLoadError', 'fragLoadTimeOut'])('reports a zero-end %s with measured elapsed time and bytes', async (details) => {
  const captured = createCapturedHls();
  const ctor = createMockHlsConstructor();
  vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(ctor as any);
  vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(ctor as any);
  vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(captured.instance as any);
  vi.spyOn(performance, 'now').mockReturnValue(250);

  const api = createMockAPI();
  const plugin = createHLSPlugin();
  await plugin.init(api);
  const loading = plugin.loadSource('https://example.test/a.m3u8');
  await vi.waitFor(() => expect(captured.handlers.hlsError).toBeDefined());
  fireManifest(captured);
  await loading;

  fireHlsEvent(captured, 'hlsError', {
    type: 'networkError', details, fatal: false,
    frag: { type: 'audio', stats: { loading: { start: 100, end: 0 }, loaded: 512 } },
  });
  expect(api.emit).toHaveBeenCalledWith('media:segment', {
    kind: 'audio', durationMs: 150, bytes: 512, ok: false,
  });

  await plugin.destroy();
});

it('does not duplicate completed failures, alter success, or emit unmeasurable failures', async () => {
  const captured = createCapturedHls();
  const ctor = createMockHlsConstructor();
  vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(ctor as any);
  vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(ctor as any);
  vi.spyOn(hlsLoader, 'createHlsInstance').mockReturnValue(captured.instance as any);
  vi.spyOn(performance, 'now').mockReturnValue(250);

  const api = createMockAPI();
  const plugin = createHLSPlugin();
  await plugin.init(api);
  const loading = plugin.loadSource('https://example.test/a.m3u8');
  await vi.waitFor(() => expect(captured.handlers.hlsError).toBeDefined());
  fireManifest(captured);
  await loading;

  fireHlsEvent(captured, 'hlsError', {
    type: 'networkError', details: 'fragLoadError', fatal: false,
    frag: { type: 'main', stats: { loading: { start: 100, end: 200 }, loaded: 300 } },
  });
  expect(api.emit).toHaveBeenCalledWith('media:segment', {
    kind: 'main', durationMs: 100, bytes: 300, ok: false,
  });
  expect(api.emit.mock.calls.filter(([event]) => event === 'media:segment')).toHaveLength(1);

  for (const frag of [
    { type: 'main', stats: { loading: { start: NaN, end: 0 }, loaded: 300 } },
    { type: 'main', stats: { loading: { start: 100, end: 0 }, loaded: -1 } },
    { type: 'initSegment', stats: { loading: { start: 100, end: 0 }, loaded: 300 } },
    { type: 'main', stats: { loading: { start: 300, end: 0 }, loaded: 300 } },
  ]) {
    fireHlsEvent(captured, 'hlsError', {
      type: 'networkError', details: 'fragLoadError', fatal: false, frag,
    });
  }
  fireHlsEvent(captured, 'hlsError', {
    type: 'networkError', details: 'fragLoadError', fatal: true,
    frag: { type: 'main', stats: { loading: { start: 100, end: 0 }, loaded: 300 } },
  });
  expect(api.emit.mock.calls.filter(([event]) => event === 'media:segment')).toHaveLength(1);

  fireHlsEvent(captured, 'hlsFragLoaded', {
    frag: { type: 'subtitle', stats: { loading: { start: 50, end: 150 }, loaded: 1024 } },
  });
  expect(api.emit).toHaveBeenCalledWith('media:segment', {
    kind: 'subtitle', durationMs: 100, bytes: 1024, ok: true,
  });

  const fallback = captured.instance.on.mock.calls.filter(([name]) => name === 'hlsError')[1]?.[1];
  await plugin.destroy();
  expect(captured.instance.off).toHaveBeenCalledWith('hlsError', fallback);
  api.emit.mockClear();
  fallback?.('hlsError', {
    type: 'networkError', details: 'fragLoadError', fatal: false,
    frag: { type: 'main', stats: { loading: { start: 100, end: 0 }, loaded: 300 } },
  });
  expect(api.emit).not.toHaveBeenCalledWith('media:segment', expect.anything());
});

it('ignores queued incomplete failures from a superseded source', async () => {
  const first = createCapturedHls();
  const second = createCapturedHls();
  const ctor = createMockHlsConstructor();
  vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(ctor as any);
  vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(ctor as any);
  vi.spyOn(hlsLoader, 'createHlsInstance')
    .mockReturnValueOnce(first.instance as any)
    .mockReturnValueOnce(second.instance as any);
  vi.spyOn(performance, 'now').mockReturnValue(250);

  const api = createMockAPI();
  const plugin = createHLSPlugin();
  await plugin.init(api);
  const firstLoad = plugin.loadSource('https://example.test/a.m3u8');
  await vi.waitFor(() => expect(first.handlers.hlsError).toBeDefined());
  fireManifest(first);
  await firstLoad;
  const stale = first.instance.on.mock.calls.filter(([name]) => name === 'hlsError')[1]?.[1];

  const secondLoad = plugin.loadSource('https://example.test/b.m3u8');
  await vi.waitFor(() => expect(second.handlers.hlsError).toBeDefined());
  fireManifest(second);
  await secondLoad;
  api.emit.mockClear();
  stale?.('hlsError', {
    type: 'networkError', details: 'fragLoadTimeOut', fatal: false,
    frag: { type: 'main', stats: { loading: { start: 100, end: 0 }, loaded: 300 } },
  });
  expect(api.emit).not.toHaveBeenCalledWith('media:segment', expect.anything());

  fireHlsEvent(second, 'hlsError', {
    type: 'networkError', details: 'fragLoadTimeOut', fatal: false,
    frag: { type: 'main', stats: { loading: { start: 100, end: 0 }, loaded: 300 } },
  });
  expect(api.emit).toHaveBeenCalledWith('media:segment', {
    kind: 'main', durationMs: 150, bytes: 300, ok: false,
  });
  await plugin.destroy();
});
