/**
 * Provider switch tests (AirPlay connect/disconnect).
 *
 * `switchToNative()` and `switchToHlsJs()` tear the pipeline down with the
 * full `cleanup()`, which also drops the source identity. Neither reload
 * path re-sets it, so the source had to be restored explicitly: without it
 * the switch back bailed with 'No source loaded' and the viewer stayed on
 * native HLS for the rest of the session.
 *
 * `cleanup()` also leaves the reconnect timer armed, so both switches cancel
 * it: a reconnect scheduled against the pipeline being replaced would
 * otherwise fire into the new one and tear down a healthy player.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import { ScarlettPlayer, type IPluginAPI } from '@scarlett-player/core';
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

describe('HLS provider switches', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: IPluginAPI;
  /** Every hls.js instance created during the test, in creation order. */
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
    // Safari: both pipelines are available, which is what AirPlay needs
    vi.spyOn(hlsLoader, 'supportsNativeHLS').mockReturnValue(true);

    plugin = createHLSPlugin();
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

  /** The video element the plugin created inside the mock container. */
  const getVideo = (): HTMLVideoElement =>
    (api.container as HTMLElement).querySelector('video') as HTMLVideoElement;

  /** Load SRC through hls.js and settle the load. */
  const loadWithHlsJs = async (): Promise<void> => {
    const promise = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[created.length - 1]);
    await promise;
  };

  it('switches back to hls.js after a switch to native, on the same source', async () => {
    await plugin.init(api);
    await loadWithHlsJs();
    expect(plugin.isNativeHLS()).toBe(false);

    // AirPlay connects
    const toNative = plugin.switchToNative();
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await toNative;

    expect(plugin.isNativeHLS()).toBe(true);

    // AirPlay disconnects: the source must still be known, or this is a no-op
    const backToHlsJs = plugin.switchToHlsJs();
    await flush();
    fireManifest(created[created.length - 1]);
    await backToHlsJs;

    expect(plugin.isNativeHLS()).toBe(false);
    expect(created).toHaveLength(2);
    expect(created[1].instance.loadSource).toHaveBeenCalledWith(SRC);
    expect(api.logger.warn).not.toHaveBeenCalledWith('No source loaded');
  });

  it('drops a scheduled reconnect when a provider switch replaces the pipeline', async () => {
    vi.useFakeTimers();
    // maxNetworkRetries: 0 makes the first fatal network error terminal, so it
    // goes straight to the reconnect scheduler instead of an in-pipeline retry
    const reconnectPlugin = createHLSPlugin({ maxNetworkRetries: 0 });
    await reconnectPlugin.init(api);

    const load = reconnectPlugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await flush();
    await load;

    // Mid-playback fatal network error arms the reconnect timer
    fireError(created[0], { type: 'networkError', details: 'levelLoadTimeOut', fatal: true });
    await flush();
    expect(api.emit).toHaveBeenCalledWith('error:reconnecting', expect.anything());

    // AirPlay connects before the timer fires: the switch builds a fresh,
    // healthy native pipeline on the same source
    const toNative = reconnectPlugin.switchToNative();
    await flush();
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    await toNative;
    expect(reconnectPlugin.isNativeHLS()).toBe(true);

    (api.emit as ReturnType<typeof vi.fn>).mockClear();

    // Past every backoff the scheduler could have picked: the abandoned
    // reconnect must not fire into the pipeline that replaced it
    await vi.advanceTimersByTimeAsync(120000);

    expect(reconnectPlugin.isNativeHLS()).toBe(true);
    expect(created).toHaveLength(1);
    expect(api.emit).not.toHaveBeenCalledWith('error:reconnecting', expect.anything());
    expect(api.emit).not.toHaveBeenCalledWith('error:recovered', expect.anything());

    await reconnectPlugin.destroy();
  });

  /**
   * HEI-SCARLETT-56 (Sentry TSP-WEB-2K5): AirPlay was active when the load
   * started, so it went native, then disconnected before `loadedmetadata`.
   * The switch used to abort the user's load with "HLS load cancelled:
   * switching to hls.js", and core reported that as a fatal. The switch now
   * takes the pending load over and the user load finishes on the new
   * pipeline.
   */
  describe('a switch while the initial load is pending', () => {
    let airplay_active = true;
    const SRC_B = 'http://example.com/other.m3u8';

    beforeEach(() => {
      airplay_active = true;
      (api.getState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'airplayActive') return airplay_active;
        if (key === 'live') return false;
        if (key === 'muted') return true;
        if (key === 'volume') return 0.25;
        return undefined;
      });
    });

    /**
     * Start a user load without settling it.
     *
     * @param target - Plugin under test
     * @param src - Source to load
     * @returns A record of how the load promise settled
     */
    const startLoad = (target: ReturnType<typeof createHLSPlugin>, src = SRC) => {
      const outcome: { status: 'pending' | 'resolved' | 'rejected'; error?: Error } = {
        status: 'pending',
      };
      target.loadSource(src).then(
        () => {
          outcome.status = 'resolved';
        },
        (error: Error) => {
          outcome.status = 'rejected';
          outcome.error = error;
        }
      );
      return outcome;
    };

    /** Every fatal `error` payload emitted so far. */
    const fatalErrors = () =>
      (api.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([event, payload]) => event === 'error' && (payload as { fatal?: boolean })?.fatal
      );

    /** Values written to a state key, in order. */
    const stateWrites = (key: string): unknown[] =>
      (api.setState as ReturnType<typeof vi.fn>).mock.calls
        .filter(([k]) => k === key)
        .map(([, value]) => value);

    it('does not reject the user load when switchToHlsJs takes over a pending native load', async () => {
      await plugin.init(api);
      const outcome = startLoad(plugin);
      await flush();
      expect(plugin.isNativeHLS()).toBe(true);

      // AirPlay disconnects before loadedmetadata
      airplay_active = false;
      const toHlsJs = plugin.switchToHlsJs();
      toHlsJs.catch(() => {});
      await flush();

      expect(outcome.status).toBe('pending');

      fireManifest(created[0]);
      await flush();
      await toHlsJs;

      expect(outcome.status).toBe('resolved');
      expect(created[0].instance.loadSource).toHaveBeenCalledWith(SRC);
      expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    it('finishes the user load on the hls.js pipeline', async () => {
      await plugin.init(api);
      const outcome = startLoad(plugin);
      await flush();

      airplay_active = false;
      void plugin.switchToHlsJs().catch(() => {});
      await flush();
      fireManifest(created[0]);
      await flush();

      expect(outcome.status).toBe('resolved');
      expect(plugin.isNativeHLS()).toBe(false);
      expect(stateWrites('playbackState').at(-1)).toBe('ready');
      expect(stateWrites('buffering').at(-1)).toBe(false);
      expect(getVideo().muted).toBe(true);
      expect(getVideo().volume).toBe(0.25);
    });

    it('lets switchToNative take over a pending hls.js load inside the loader import', async () => {
      airplay_active = false;
      await plugin.init(api);
      const outcome = startLoad(plugin);

      // AirPlay connects while hls.js is still being imported
      airplay_active = true;
      void plugin.switchToNative().catch(() => {});
      await flush();

      expect(outcome.status).toBe('pending');
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(outcome.status).toBe('resolved');
      expect(plugin.isNativeHLS()).toBe(true);
      expect(created).toHaveLength(0);
      expect(stateWrites('playbackState').at(-1)).toBe('ready');
      expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    it('lets switchToNative take over a pending hls.js load waiting on its manifest', async () => {
      airplay_active = false;
      await plugin.init(api);
      const outcome = startLoad(plugin);
      await flush();
      expect(created).toHaveLength(1);

      airplay_active = true;
      void plugin.switchToNative().catch(() => {});
      await flush();

      expect(outcome.status).toBe('pending');
      expect(created[0].instance.destroy).toHaveBeenCalled();
      getVideo().dispatchEvent(new Event('loadedmetadata'));
      await flush();

      expect(outcome.status).toBe('resolved');
      expect(plugin.isNativeHLS()).toBe(true);
      expect(getVideo().muted).toBe(true);
      expect(stateWrites('playbackState').at(-1)).toBe('ready');
      expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    /**
     * Review finding (Sol, P1): the hls.js import is still pending when
     * AirPlay connects and the native takeover finishes. The user load must
     * finish with the takeover, whatever the abandoned import does later.
     */
    describe('while the original hls.js import is still pending', () => {
      let release: { resolve: (value: unknown) => void; reject: (error: Error) => void };

      beforeEach(() => {
        airplay_active = false;
        vi.spyOn(hlsLoader, 'loadHlsJs').mockImplementation(
          () =>
            new Promise((resolve, reject) => {
              release = { resolve, reject };
            }) as never
        );
      });

      /** Start a hls.js load, then let AirPlay take it over natively. */
      const startAndTakeOver = async () => {
        await plugin.init(api);
        const outcome = startLoad(plugin);
        await flush();
        airplay_active = true;
        void plugin.switchToNative().catch(() => {});
        await flush();
        return outcome;
      };

      it('finishes the user load when the native takeover loads, then ignores a late import', async () => {
        const outcome = await startAndTakeOver();
        getVideo().dispatchEvent(new Event('loadedmetadata'));
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(getVideo().muted).toBe(true);
        expect(stateWrites('playbackState').at(-1)).toBe('ready');

        release.resolve(mockCtor);
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(created).toHaveLength(0);
        expect(fatalErrors()).toHaveLength(0);
      });

      it('ignores the abandoned import rejecting after the takeover loaded', async () => {
        const outcome = await startAndTakeOver();
        getVideo().dispatchEvent(new Event('loadedmetadata'));
        await flush();
        release.reject(new Error('chunk load failed'));
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(fatalErrors()).toHaveLength(0);
      });

      it('ignores the abandoned import rejecting before the takeover loads', async () => {
        const outcome = await startAndTakeOver();
        release.reject(new Error('chunk load failed'));
        await flush();
        expect(outcome.status).toBe('pending');

        getVideo().dispatchEvent(new Event('loadedmetadata'));
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(stateWrites('playbackState').at(-1)).toBe('ready');
        expect(fatalErrors()).toHaveLength(0);
      });

      it('resolves quietly on destroy while both the takeover and the import are pending', async () => {
        const outcome = await startAndTakeOver();
        (api.setState as ReturnType<typeof vi.fn>).mockClear();

        await plugin.destroy();
        await flush();
        expect(outcome.status).toBe('resolved');

        release.resolve(mockCtor);
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(stateWrites('playbackState')).not.toContain('ready');
        expect(created).toHaveLength(0);
        expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
      });
    });

    /**
     * Review finding (Sol fix round, P2): native A is taken over by
     * switchToHlsJs() while the hls.js import is still pending. That import
     * is the carrying load, and it has no abort hook yet, so cancelling the
     * user load must not wait for it: a destroy, a core unload or a new load
     * releases A quietly at once.
     */
    describe('while the carrying hls.js import is still pending', () => {
      let release: { resolve: (value: unknown) => void; reject: (error: Error) => void };

      beforeEach(() => {
        vi.spyOn(hlsLoader, 'loadHlsJs').mockImplementation(
          () =>
            new Promise((resolve, reject) => {
              release = { resolve, reject };
            }) as never
        );
      });

      /** Start native A, then let switchToHlsJs() take it over. */
      const takeOverIntoImport = async (target: ReturnType<typeof createHLSPlugin>) => {
        const outcome = startLoad(target);
        await flush();
        expect(target.isNativeHLS()).toBe(true);
        airplay_active = false;
        void target.switchToHlsJs().catch(() => {});
        await flush();
        expect(outcome.status).toBe('pending');
        return outcome;
      };

      it('resolves the taken-over load quietly on destroy', async () => {
        await plugin.init(api);
        const outcome = await takeOverIntoImport(plugin);
        (api.setState as ReturnType<typeof vi.fn>).mockClear();

        await plugin.destroy();
        await flush();

        expect(outcome.status).toBe('resolved');
        expect(stateWrites('playbackState')).not.toContain('ready');
        expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());

        release.resolve(mockCtor);
        await flush();
        expect(created).toHaveLength(0);
      });

      it('resolves the taken-over load quietly when a new load succeeds first', async () => {
        await plugin.init(api);
        const first = await takeOverIntoImport(plugin);

        airplay_active = true; // B goes native
        const second = startLoad(plugin, SRC_B);
        await flush();
        expect(first.status).toBe('resolved');

        getVideo().dispatchEvent(new Event('loadedmetadata'));
        await flush();

        expect(second.status).toBe('resolved');
        expect(first.status).toBe('resolved');
        expect(stateWrites('playbackState').filter((v) => v === 'ready')).toHaveLength(1);
        expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());

        release.resolve(mockCtor);
        await flush();
        expect(created).toHaveLength(0);
        expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
      });

      it('settles core load() quietly on player.unload()', async () => {
        const player = new ScarlettPlayer({ container: document.createElement('div'), plugins: [plugin] });
        (player as unknown as { stateManager: { set(key: string, value: unknown): void } }).stateManager.set(
          'airplayActive',
          true
        );
        const outcome: { status: 'pending' | 'settled' } = { status: 'pending' };
        void player.load(SRC).then(() => {
          outcome.status = 'settled';
        });
        for (let i = 0; i < 5; i++) await flush();
        expect(plugin.isNativeHLS()).toBe(true);

        (player as unknown as { stateManager: { set(key: string, value: unknown): void } }).stateManager.set(
          'airplayActive',
          false
        );
        void plugin.switchToHlsJs().catch(() => {});
        await flush();
        expect(outcome.status).toBe('pending');

        await player.unload();
        for (let i = 0; i < 5; i++) await flush();

        expect(outcome.status).toBe('settled');
        expect(player.getState().error).toBeNull();

        release.resolve(mockCtor);
        await flush();
        await player.destroy();
      });
    });

    it('rejects the user load when the hls.js takeover load itself times out', async () => {
      vi.useFakeTimers();
      const short = createHLSPlugin({ loadTimeoutMs: 1000, autoReconnect: false });
      await short.init(api);
      const outcome = startLoad(short);
      await flush();

      airplay_active = false;
      void short.switchToHlsJs().catch(() => {});
      await flush();
      await vi.advanceTimersByTimeAsync(1000);

      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);

      await short.destroy();
    });

    it('rejects the user load when the native takeover load itself times out', async () => {
      vi.useFakeTimers();
      airplay_active = false;
      const short = createHLSPlugin({ loadTimeoutMs: 1000, autoReconnect: false });
      await short.init(api);
      const outcome = startLoad(short);
      await flush();

      airplay_active = true;
      void short.switchToNative().catch(() => {});
      await flush();
      await vi.advanceTimersByTimeAsync(1000);

      // The takeover load is the user's initial load now, so its watchdog
      // reports the timeout itself rather than leaving core a bare rejection
      expect(outcome.status).toBe('rejected');
      expect(fatalErrors()).toHaveLength(1);
      expect((fatalErrors()[0][1] as { detail?: { timedOut?: boolean } }).detail?.timedOut).toBe(true);

      await short.destroy();
    });

    it('resolves a load superseded during a takeover without writing ready for it', async () => {
      await plugin.init(api);
      const first = startLoad(plugin);
      await flush();

      airplay_active = false;
      void plugin.switchToHlsJs().catch(() => {});
      await flush();
      (api.setState as ReturnType<typeof vi.fn>).mockClear();

      const second = startLoad(plugin, SRC_B);
      await flush();

      expect(first.status).toBe('resolved');
      expect(second.status).toBe('pending');
      expect(stateWrites('playbackState')).not.toContain('ready');

      fireManifest(created[created.length - 1]);
      await flush();

      expect(second.status).toBe('resolved');
      expect(stateWrites('playbackState').filter((v) => v === 'ready')).toHaveLength(1);
      expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    it('resolves the user load quietly when destroy lands during a takeover', async () => {
      await plugin.init(api);
      const outcome = startLoad(plugin);
      await flush();

      airplay_active = false;
      void plugin.switchToHlsJs().catch(() => {});
      await flush();
      (api.setState as ReturnType<typeof vi.fn>).mockClear();

      await plugin.destroy();
      await flush();

      expect(outcome.status).toBe('resolved');
      expect(stateWrites('playbackState')).not.toContain('ready');
      expect(api.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });
  });
});
