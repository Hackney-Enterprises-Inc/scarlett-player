import { describe, expect, it } from 'vitest';
import { setupHlsEventHandlers, setupVideoEventHandlers } from '../src/event-map';
import { createCapturedHls, createMockAPI } from './helpers';

describe('hls.js fragment segment events', () => {
  it.each(['main', 'audio', 'subtitle'] as const)('emits a successful %s fragment from hls.js stats', (kind) => {
    const hls = createCapturedHls();
    const api = createMockAPI();
    setupHlsEventHandlers(hls.instance, api, {});

    hls.handlers.hlsFragLoaded?.('hlsFragLoaded', {
      frag: { type: kind, stats: { loading: { start: 120, end: 370 }, loaded: 4096 } },
    });

    expect(api.emit).toHaveBeenCalledWith('media:segment', {
      durationMs: 250, bytes: 4096, ok: true, kind,
    });
  });

  it.each(['fragLoadError', 'fragLoadTimeOut'])('emits a failed non-fatal fragment for %s', (details) => {
    const hls = createCapturedHls();
    const api = createMockAPI();
    setupHlsEventHandlers(hls.instance, api, {});

    hls.handlers.hlsError?.('hlsError', {
      type: 'networkError', details, fatal: false,
      frag: { type: 'audio', stats: { loading: { start: 10, end: 90 }, loaded: 200 } },
    });

    expect(api.emit).toHaveBeenCalledWith('media:segment', {
      durationMs: 80, bytes: 200, ok: false, kind: 'audio',
    });
  });

  it('does not invent measurements for missing/invalid stats, unrelated or fatal errors', () => {
    const hls = createCapturedHls();
    const api = createMockAPI();
    setupHlsEventHandlers(hls.instance, api, {});

    hls.handlers.hlsFragLoaded?.('hlsFragLoaded', {});
    hls.handlers.hlsFragLoaded?.('hlsFragLoaded', {
      frag: { type: 'main', stats: { loading: { start: 100, end: 50 }, loaded: 1 } },
    });
    hls.handlers.hlsFragLoaded?.('hlsFragLoaded', {
      frag: { type: 'initSegment', stats: { loading: { start: 10, end: 20 }, loaded: 1 } },
    });
    for (const [details, fatal] of [['fragLoadError', true], ['keyLoadError', false]] as const) {
      hls.handlers.hlsError?.('hlsError', {
        type: 'networkError', details, fatal,
        frag: { type: 'main', stats: { loading: { start: 10, end: 20 }, loaded: 1 } },
      });
    }
    expect(api.emit).not.toHaveBeenCalledWith('media:segment', expect.anything());
  });

  it('stops emitting after cleanup, and element-only/native playback never emits segments', () => {
    const hls = createCapturedHls();
    const api = createMockAPI();
    const cleanup = setupHlsEventHandlers(hls.instance, api, {});
    cleanup();
    expect(hls.instance.off).toHaveBeenCalledWith('hlsFragLoaded', hls.handlers.hlsFragLoaded);
    expect(hls.instance.off).toHaveBeenCalledWith('hlsError', hls.handlers.hlsError);

    const video = document.createElement('video');
    const nativeApi = createMockAPI();
    setupVideoEventHandlers(video, nativeApi);
    video.dispatchEvent(new Event('progress'));
    video.dispatchEvent(new Event('waiting'));
    expect(nativeApi.emit).not.toHaveBeenCalledWith('media:segment', expect.anything());
  });
});
