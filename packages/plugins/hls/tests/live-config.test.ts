/**
 * Live/LL-HLS configuration tests (LL-1, LL-5).
 *
 * Two things are pinned here.
 *
 * 1. The hls.js config the plugin builds. hls.js merges config by ASSIGNMENT,
 *    so handing it `liveSyncDurationCount: undefined` overrides its own default
 *    with undefined - the easiest way to silently break standard live playback
 *    while adding a low-latency feature. No key may ever be present holding
 *    undefined.
 * 2. `getLiveInfo()`, which now reports effective low latency and stops parking
 *    a native viewer a hard-coded 3 seconds behind the edge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';
import { createHLSPlugin } from '../src/index';
import type { HLSPluginConfig } from '../src/types';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI,
  installMediaStubs,
  flush,
} from './helpers';

const SRC = 'http://example.com/live/stream.m3u8';

/** Every live key the plugin may emit into the hls.js config. */
const LIVE_KEYS = [
  'liveSyncDuration',
  'liveSyncDurationCount',
  'liveMaxLatencyDuration',
  'liveMaxLatencyDurationCount',
  'maxLiveSyncPlaybackRate',
  'liveDurationInfinity',
] as const;

describe('hls.js live configuration', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  beforeEach(() => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as any);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation((config?: Record<string, unknown>) => {
      const captured = createCapturedHls();
      (captured as CapturedHls & { config?: Record<string, unknown> }).config = config;
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
   * Start a load with the given plugin config and return the hls.js config it
   * built. The load never settles (no manifest is fired), which is fine: the
   * instance is created before anything is awaited.
   */
  const builtConfig = async (
    config?: Partial<HLSPluginConfig>
  ): Promise<Record<string, unknown>> => {
    const plugin = createHLSPlugin(config);
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await flush();

    return (hlsLoader.createHlsInstance as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
  };

  describe('defaults (no low latency requested)', () => {
    it('leaves every live tuning key to hls.js', async () => {
      const config = await builtConfig();

      for (const key of LIVE_KEYS) {
        expect(config).not.toHaveProperty(key);
      }
    });

    it('keeps lowLatencyMode off and the segment-tuned retry budget', async () => {
      const config = await builtConfig();

      expect(config.lowLatencyMode).toBe(false);
      expect(config.fragLoadingMaxRetry).toBe(1);
      expect(config.levelLoadingMaxRetry).toBe(1);
      expect(config.fragLoadingRetryDelay).toBe(500);
      expect(config.levelLoadingRetryDelay).toBe(500);
    });
  });

  describe('lowLatencyMode: true', () => {
    it('enables latency catch-up, which hls.js disables by default', async () => {
      const config = await builtConfig({ lowLatencyMode: true });

      // hls.js ships maxLiveSyncPlaybackRate: 1, i.e. no catch-up at all
      expect(config.lowLatencyMode).toBe(true);
      expect(config.maxLiveSyncPlaybackRate).toBe(1.1);
    });

    it('leaves the retry budgets exactly as standard live has them', async () => {
      // Deliberate, and measured: widening these does not stop a part 404
      // punching a fragGap (hls.js counts fragment errors cumulatively per
      // level), so the only effect would have been on ABR level switching.
      // See buildBaseHlsConfig() and verify-browser.mjs scenario 8b.
      const config = await builtConfig({ lowLatencyMode: true });

      expect(config.fragLoadingMaxRetry).toBe(1);
      expect(config.levelLoadingMaxRetry).toBe(1);
      expect(config.manifestLoadingMaxRetry).toBe(1);
      expect(config.fragLoadingRetryDelay).toBe(500);
      expect(config.levelLoadingRetryDelay).toBe(500);
      expect(config.manifestLoadingRetryDelay).toBe(500);
    });

    it('still leaves the latency knobs the host did not set to hls.js', async () => {
      const config = await builtConfig({ lowLatencyMode: true });

      expect(config).not.toHaveProperty('liveSyncDuration');
      expect(config).not.toHaveProperty('liveSyncDurationCount');
      expect(config).not.toHaveProperty('liveMaxLatencyDuration');
      expect(config).not.toHaveProperty('liveMaxLatencyDurationCount');
      expect(config).not.toHaveProperty('liveDurationInfinity');
    });
  });

  describe('explicit overrides', () => {
    const overrides: Partial<HLSPluginConfig> = {
      lowLatencyMode: true,
      liveSyncDuration: 2,
      liveMaxLatencyDuration: 10,
      maxLiveSyncPlaybackRate: 1.05,
      liveDurationInfinity: true,
    };

    it('passes every seconds-based key through verbatim', async () => {
      const config = await builtConfig(overrides);

      expect(config.liveSyncDuration).toBe(2);
      expect(config.liveMaxLatencyDuration).toBe(10);
      expect(config.liveDurationInfinity).toBe(true);
    });

    it('passes every count-based key through verbatim', async () => {
      const config = await builtConfig({
        lowLatencyMode: true,
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 6,
      });

      expect(config.liveSyncDurationCount).toBe(4);
      expect(config.liveMaxLatencyDurationCount).toBe(6);
    });

    it('lets the host override the low-latency catch-up rate', async () => {
      const config = await builtConfig(overrides);
      expect(config.maxLiveSyncPlaybackRate).toBe(1.05);
    });

    it('applies the live knobs to a standard live stream too', async () => {
      const config = await builtConfig({ liveSyncDurationCount: 2 });

      expect(config.liveSyncDurationCount).toBe(2);
      // Catch-up is not turned on behind the host's back outside LL
      expect(config).not.toHaveProperty('maxLiveSyncPlaybackRate');
    });
  });

  /**
   * hls.js THROWS inside `new Hls()` on a config carrying both groups
   * ("Illegal hls.js config: don't mix up liveSyncDurationCount/
   * liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration"),
   * which would take the load down before a frame plays.
   */
  describe('mutually exclusive latency groups', () => {
    it('drops the count-based keys when liveSyncDuration is set', async () => {
      const config = await builtConfig({
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 10,
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 6,
      });

      expect(config.liveSyncDuration).toBe(2);
      expect(config.liveMaxLatencyDuration).toBe(10);
      expect(config).not.toHaveProperty('liveSyncDurationCount');
      expect(config).not.toHaveProperty('liveMaxLatencyDurationCount');
    });

    it('keeps the count group when the seconds group cannot stand alone', async () => {
      // `liveMaxLatencyDuration` with no `liveSyncDuration` beside it is a
      // second thing hls.js throws on, so dropping the counts here would only
      // trade one illegal config for another
      const config = await builtConfig({
        liveSyncDurationCount: 4,
        liveMaxLatencyDuration: 10,
      });

      expect(config.liveSyncDurationCount).toBe(4);
      expect(config).not.toHaveProperty('liveMaxLatencyDuration');
    });

    it('says which half it dropped', async () => {
      await builtConfig({ liveSyncDuration: 2, liveSyncDurationCount: 4 });

      expect(api.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('liveSyncDurationCount')
      );
    });

    it('stays quiet when only one group is set', async () => {
      await builtConfig({ liveSyncDuration: 2, liveMaxLatencyDuration: 10 });
      await builtConfig({ liveSyncDurationCount: 4, liveMaxLatencyDurationCount: 6 });

      expect(api.logger.warn).not.toHaveBeenCalled();
    });
  });

  it('never emits a key holding undefined, in any configuration', async () => {
    const configs = [
      await builtConfig(),
      await builtConfig({ lowLatencyMode: true }),
      await builtConfig({
        lowLatencyMode: true,
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 10,
        maxLiveSyncPlaybackRate: 1.05,
        liveDurationInfinity: true,
      }),
      await builtConfig({
        lowLatencyMode: true,
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 6,
      }),
      // The mixed config one group is dropped from
      await builtConfig({
        liveSyncDuration: 2,
        liveSyncDurationCount: 4,
        liveMaxLatencyDuration: 10,
        liveMaxLatencyDurationCount: 6,
      }),
    ];

    for (const config of configs) {
      const undefinedKeys = Object.keys(config).filter((key) => config[key] === undefined);
      expect(undefinedKeys).toEqual([]);
    }
  });
});

describe('getLiveInfo()', () => {
  let api: IPluginAPI;
  let created: CapturedHls[];
  let state: Record<string, unknown>;
  const mockCtor = createMockHlsConstructor();

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

    state = { live: true };
    api = createMockAPI();
    (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => state[key]);
    (api.setState as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: unknown) => {
      state[key] = value;
    });

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Boot the hls.js pipeline and hand back the plugin plus its instance. */
  const loadHlsJs = async () => {
    const plugin = createHLSPlugin({ lowLatencyMode: true });
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await flush();

    return { plugin, hls: created[0] };
  };

  it('returns null for VOD', async () => {
    state.live = false;
    const { plugin } = await loadHlsJs();

    expect(plugin.getLiveInfo()).toBeNull();
  });

  it('reports hls.js latency and effective low latency from the playlist', async () => {
    const { plugin, hls } = await loadHlsJs();
    Object.assign(hls.instance, {
      latency: 2.4,
      targetLatency: 3,
      drift: 0.2,
      liveSyncPosition: 150,
    });

    hls.handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
      details: {
        live: true,
        targetduration: 4,
        partTarget: 1,
        partHoldBack: 3,
        partList: [{}, {}],
        canBlockReload: true,
        fragmentStart: 100,
        edge: 156,
      },
    });

    expect(plugin.getLiveInfo()).toEqual({
      isLive: true,
      latency: 2.4,
      targetLatency: 3,
      drift: 0.2,
      liveSyncPosition: 150,
      lowLatency: true,
    });
  });

  it('reports lowLatency false on a plain live playlist, even with the flag set', async () => {
    const { plugin, hls } = await loadHlsJs();
    Object.assign(hls.instance, { latency: 12, targetLatency: 18, liveSyncPosition: 140 });

    hls.handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
      details: { live: true, targetduration: 6, fragmentStart: 100, edge: 160 },
    });

    expect(plugin.getLiveInfo()?.lowLatency).toBe(false);
  });

  it('falls back to the target latency, not a hard-coded 3, for the sync position', async () => {
    const { plugin, hls } = await loadHlsJs();
    Object.assign(hls.instance, { latency: 2, targetLatency: 2, liveSyncPosition: undefined });

    // loadSource() clears `live`; the playlist is what puts it back
    hls.handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
      details: {
        live: true,
        targetduration: 4,
        partTarget: 1,
        partHoldBack: 2,
        partList: [{}],
        fragmentStart: 100,
        edge: 160,
      },
    });

    const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'seekable', {
      value: { length: 1, start: () => 100, end: () => 160 },
      configurable: true,
    });

    // 160 - 2 (the stream's own target), not 160 - 3
    expect(plugin.getLiveInfo()?.liveSyncPosition).toBe(158);
  });

  describe('native path', () => {
    beforeEach(() => {
      // Safari/iOS: native HLS only, no MSE
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
      vi.spyOn(hlsLoader, 'isHlsJsSupported').mockReturnValue(false);
      vi.spyOn(hlsLoader, 'isHLSSupported').mockReturnValue(true);
    });

    /** Boot the native pipeline; `loadedmetadata` is what settles the load. */
    const loadNative = async () => {
      const plugin = createHLSPlugin();
      await plugin.init(api);
      plugin.loadSource(SRC).catch(() => {});
      await flush();

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'seekable', {
        value: { length: 1, start: () => 100, end: () => 160 },
        configurable: true,
      });
      // jsdom leaves duration NaN, which is how the native path classifies live
      video.dispatchEvent(new Event('durationchange'));
      video.dispatchEvent(new Event('loadedmetadata'));
      await flush();

      return { plugin, video };
    };

    it('approximates latency from the seekable range and reports no low latency', async () => {
      const { plugin, video } = await loadNative();
      Object.defineProperty(video, 'currentTime', { value: 154, configurable: true });

      expect(plugin.getLiveInfo()).toEqual({
        isLive: true,
        latency: 6,
        targetLatency: 3,
        drift: 0,
        liveSyncPosition: 157,
        lowLatency: false,
      });
    });
  });

  describe('AirPlay handoff', () => {
    beforeEach(() => {
      // MSE available AND native HLS available: the Safari shape where
      // switchToNative() is reachable
      vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);
    });

    it("keeps the stream's own target latency after switching to native", async () => {
      const { plugin, hls } = await loadHlsJs();
      Object.assign(hls.instance, { latency: 2, targetLatency: 2 });
      hls.handlers['hlsLevelLoaded']?.('hlsLevelLoaded', {
        details: {
          live: true,
          targetduration: 4,
          partTarget: 1,
          partHoldBack: 2,
          partList: [{}],
          fragmentStart: 100,
          edge: 160,
        },
      });

      const video = (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'seekable', {
        value: { length: 1, start: () => 100, end: () => 160 },
        configurable: true,
      });
      // Writable: switchToNative() restores the position across the handoff
      let currentTime = 158;
      Object.defineProperty(video, 'currentTime', {
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
        },
        configurable: true,
      });

      // loadNative() settles on loadedmetadata, so the switch has to be driven
      const switching = plugin.switchToNative();
      await flush();
      video.dispatchEvent(new Event('durationchange'));
      video.dispatchEvent(new Event('loadedmetadata'));
      await switching;

      // The same source is still playing, so its 2s hold-back still applies:
      // 160 - 2, not the 160 - 3 a fresh native session would report.
      const info = plugin.getLiveInfo();
      expect(info?.targetLatency).toBe(2);
      expect(info?.liveSyncPosition).toBe(158);
      // ...but the stream is no longer being delivered as parts
      expect(info?.lowLatency).toBe(false);
    });
  });
});
