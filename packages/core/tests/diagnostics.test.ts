/**
 * Diagnostics snapshot contract and regression tests for Scarlett Player core.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScarlettPlayer } from '../src/scarlett-player';
import type { Plugin, IPluginAPI, PlayerDiagnosticsSnapshot } from '../src/types';
import {
  sanitizeUntrustedContribution,
  projectDiagnosticErrors,
  DIAGNOSTIC_LIMITS,
  type SanitizeReport,
} from '../src/diagnostics';
import { ErrorCode, type PlayerError } from '../src/error-handler';

describe('Player Diagnostics Snapshots (Core)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-player-container';
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

  describe('contract and schema', () => {
    it('returns a PlayerDiagnosticsSnapshot with schemaVersion 1 and safe baseline fields', () => {
      const player = new ScarlettPlayer({ container });
      const snapshot: PlayerDiagnosticsSnapshot = player.getDiagnostics();

      expect(snapshot).toBeDefined();
      expect(snapshot.schemaVersion).toBe(1);
      expect(typeof snapshot.timestamp).toBe('number');
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(typeof snapshot.playerVersion).toBe('string');
      expect(snapshot.playbackState).toBeDefined();
      expect(snapshot.playbackState.playbackState).toBe('idle');
      expect(snapshot.playbackState.playing).toBe(false);
      expect(snapshot.playbackState.paused).toBe(true);
      expect(snapshot.playbackState.ended).toBe(false);
      expect(snapshot.playbackState.buffering).toBe(false);
      expect(snapshot.playbackState.seeking).toBe(false);
      expect(snapshot.playbackState.currentTime).toBe(0);
      expect(snapshot.playbackState.duration).toBeNull();
      expect(snapshot.playbackState.volume).toBe(1.0);
      expect(snapshot.playbackState.muted).toBe(false);
      expect(snapshot.playbackState.playbackRate).toBe(1.0);
      expect(snapshot.playbackState.mediaType).toBeNull();
      expect(snapshot.playbackState.live).toBe(false);
      expect(snapshot.playbackState.seekableRange).toBeNull();
      expect(snapshot.playbackState.liveEdge).toBeNull();
      expect(snapshot.playbackState.liveLatency).toBeNull();
      expect(snapshot.playbackState.dimensions).toBeNull();
      expect(snapshot.playbackState.source).toBeNull();

      expect(Array.isArray(snapshot.errors)).toBe(true);
      expect(snapshot.errors.length).toBe(0);
      expect(snapshot.providers).toBeDefined();
    });

    it('returns an unavailable snapshot after player is destroyed rather than throwing', () => {
      const player = new ScarlettPlayer({ container });
      player.destroy();

      const snapshot = player.getDiagnostics();
      expect(snapshot).toBeDefined();
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.playbackState.playbackState).toBe('destroyed');
      expect(snapshot.providers).toEqual({});
      expect(snapshot.errors).toEqual([]);
    });

    it('is synchronous and side-effect free (repeated calls do not mutate state)', () => {
      const player = new ScarlettPlayer({ container });
      const snap1 = player.getDiagnostics();
      const snap2 = player.getDiagnostics();

      expect(snap1.schemaVersion).toBe(snap2.schemaVersion);
      expect(snap1.playerVersion).toBe(snap2.playerVersion);
      expect(snap1.playbackState).toEqual(snap2.playbackState);
    });

    it('caller mutation does not affect subsequent snapshots or live state', () => {
      const player = new ScarlettPlayer({ container });
      const snap1 = player.getDiagnostics();
      (snap1.playbackState as any).volume = 0.123;
      (snap1.errors as any).push({ code: 'HACKED' });

      const snap2 = player.getDiagnostics();
      expect(snap2.playbackState.volume).toBe(1.0);
      expect(snap2.errors.length).toBe(0);
      expect(player.volume).toBe(1.0);
    });
  });

  describe('provider collection and filtering', () => {
    it('only collects from ready plugins of type "provider"', async () => {
      const providerPlugin: Plugin = {
        id: 'mock-provider',
        name: 'Mock Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => ({
          engine: 'hls.js',
          bitrate: 500000,
        }),
      };

      const featurePlugin: Plugin = {
        id: 'mock-feature',
        name: 'Mock Feature',
        version: '1.0.0',
        type: 'feature',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => ({
          featureActive: true,
        }),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [providerPlugin, featurePlugin],
      });
      await (player as any).pluginManager.initAll();

      const snapshot = player.getDiagnostics();
      expect(snapshot.providers['mock-provider']).toEqual({
        engine: 'hls.js',
        bitrate: 500000,
      });
      // Non-provider plugins are NOT collected in v1
      expect(snapshot.providers['mock-feature']).toBeUndefined();
    });

    it('skips providers that are not ready (e.g. initializing, error, destroyed)', async () => {
      let initResolve: () => void = () => {};
      const slowProvider: Plugin = {
        id: 'slow-provider',
        name: 'Slow Provider',
        version: '1.0.0',
        type: 'provider',
        init: () => new Promise<void>((res) => { initResolve = res; }),
        destroy: vi.fn(),
        getDiagnostics: () => ({ ready: false }),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [slowProvider],
      });

      const initPromise = (player as any).pluginManager.initPlugin('slow-provider');

      // While initializing
      const snapDuringInit = player.getDiagnostics();
      expect(snapDuringInit.providers['slow-provider']).toBeUndefined();

      initResolve();
      await initPromise;

      const snapAfterInit = player.getDiagnostics();
      expect(snapAfterInit.providers['slow-provider']).toEqual({ ready: false });
    });

    it('handles providers without getDiagnostics hook cleanly', async () => {
      const basicProvider: Plugin = {
        id: 'basic-provider',
        name: 'Basic Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [basicProvider],
      });
      await (player as any).pluginManager.initPlugin('basic-provider');

      const snapshot = player.getDiagnostics();
      expect(snapshot.providers['basic-provider']).toBeNull();
    });
  });

  describe('untrusted third-party boundary and sanitization', () => {
    it('catches throwing getDiagnostics hook and returns unavailable record without exception text', async () => {
      const throwingProvider: Plugin = {
        id: 'throwing-provider',
        name: 'Throwing Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => {
          throw new Error('SUPER_SECRET_LEAK: password123');
        },
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [throwingProvider],
      });
      await (player as any).pluginManager.initPlugin('throwing-provider');

      const snapshot = player.getDiagnostics();

      // Should not contain exception text
      const snapshotStr = JSON.stringify(snapshot);
      expect(snapshotStr).not.toContain('SUPER_SECRET_LEAK');
      expect(snapshotStr).not.toContain('password123');
      expect(snapshot.providers['throwing-provider']).toEqual({
        unavailable: true,
      });
    });

    it('guards against cyclic structures, throwing getters, promises, non-finite values', async () => {
      const cyclicObj: any = { a: 1 };
      cyclicObj.self = cyclicObj;

      const badProvider: Plugin = {
        id: 'bad-provider',
        name: 'Bad Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => ({
          cyclic: cyclicObj,
          promise: Promise.resolve('ignored'),
          nan: NaN,
          infinity: Infinity,
          get explosive() {
            throw new Error('BOOM');
          },
          validNumber: 42,
          validString: 'safe',
        }),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [badProvider],
      });
      await (player as any).pluginManager.initPlugin('bad-provider');

      const snapshot = player.getDiagnostics();

      const providerData = snapshot.providers['bad-provider'] as any;
      expect(providerData).toBeDefined();
      expect(providerData.nan).toBeNull();
      expect(providerData.infinity).toBeNull();
      expect(providerData.validNumber).toBe(42);
      // Arbitrary strings are omitted at the untrusted boundary
      expect(providerData.validString).toBeUndefined();
      // Cyclic reference should be omitted or sanitized
      expect(providerData.cyclic?.self).toBeUndefined();
      // Promise should be omitted
      expect(providerData.promise).toBeUndefined();
      // Throwing getter should not crash snapshot
      expect(providerData.explosive).toBeUndefined();
    });

    it('rejects prototype-mutating keys and null-prototype map', async () => {
      const protoProvider: Plugin = {
        id: 'proto-provider',
        name: 'Proto Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () =>
          JSON.parse(
            '{"__proto__":{"injected":true},"constructor":{"injected":true},"prototype":{"injected":true},"normal":"connected"}'
          ),
      };

      const maliciousIdProvider: Plugin = {
        id: '__proto__',
        name: 'Malicious ID',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => ({ evil: true }),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [protoProvider, maliciousIdProvider],
      });
      await (player as any).pluginManager.initPlugin('proto-provider');
      try {
        await (player as any).pluginManager.initPlugin('__proto__');
      } catch {
        // Ignored
      }

      const snapshot = player.getDiagnostics();

      expect(snapshot.providers['__proto__']).toBeUndefined();
      expect((Object.prototype as any).injected).toBeUndefined();
      expect((Object.prototype as any).evil).toBeUndefined();
      expect((snapshot.providers as any)['proto-provider']?.normal).toBe('connected');
      expect((snapshot.providers as any)['proto-provider']?.__proto__?.injected).toBeUndefined();
    });

    it('enforces concrete bounds: max depth 4, max 64 keys, max 50 array items', async () => {
      const oversizedProvider: Plugin = {
        id: 'oversized-provider',
        name: 'Oversized Provider',
        version: '1.0.0',
        type: 'provider',
        init: vi.fn(),
        destroy: vi.fn(),
        getDiagnostics: () => {
          const deepObj: any = { level: 1 };
          let curr = deepObj;
          for (let i = 2; i <= 10; i++) {
            curr.next = { level: i };
            curr = curr.next;
          }

          const manyKeys: Record<string, number> = {};
          for (let i = 0; i < 100; i++) {
            manyKeys[`key_${i}`] = i;
          }

          const largeArray = Array.from({ length: 100 }, (_, i) => i);

          return {
            deep: deepObj,
            manyKeys,
            largeArray,
          };
        },
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [oversizedProvider],
      });
      await (player as any).pluginManager.initPlugin('oversized-provider');

      const snapshot = player.getDiagnostics();
      const pData = snapshot.providers['oversized-provider'] as any;

      expect(pData).toBeDefined();
      expect(Object.keys(pData.manyKeys).length).toBeLessThanOrEqual(64);
      expect(pData.largeArray.length).toBeLessThanOrEqual(50);

      // Verify max depth 4 (depth 1: root pData, 2: deep, 3: next, 4: next, 5: truncated)
      let depth = 0;
      let curr = pData.deep;
      while (curr && typeof curr === 'object') {
        depth++;
        curr = curr.next;
      }
      expect(depth).toBeLessThanOrEqual(4);
    });
  });

  describe('untrusted string and truncation policy', () => {
    const makeProvider = (id: string, diagnostics: () => unknown, onInit?: (api: IPluginAPI) => void): Plugin => ({
      id,
      name: id,
      version: '1.0.0',
      type: 'provider',
      init: vi.fn((api: IPluginAPI) => onInit?.(api)),
      destroy: vi.fn(),
      getDiagnostics: diagnostics,
    });

    it('exports no sentinel secret from signed URLs, credentials, API keys, userinfo or identity fields', async () => {
      const leaky = makeProvider('leaky-provider', () => ({
        apiKey: 'sk-live-SENTINEL1',
        message: 'Authorization: Bearer SENTINEL2',
        userId: 'viewer-SENTINEL3',
        signedPath: '/play.m3u8?hdnts=exp=999~hmac=SENTINEL4',
        source: 'ftp://user:SENTINEL5@cdn.example/live.m3u8',
        nested: { label: 'SENTINEL6', list: ['SENTINEL7', 3] },
        engine: 'hls.js',
        connectionState: 'connected',
        bitrate: 500000,
      }));
      const player = new ScarlettPlayer({ container, plugins: [leaky] });
      await (player as any).pluginManager.initPlugin('leaky-provider');

      const snapshot = player.getDiagnostics();
      const json = JSON.stringify(snapshot);

      expect(json).not.toMatch(/SENTINEL/);
      const data = snapshot.providers['leaky-provider'] as any;
      expect(data.engine).toBe('hls.js');
      expect(data.connectionState).toBe('connected');
      expect(data.bitrate).toBe(500000);
      expect(data.nested.list).toEqual([3]);
    });

    it('marks a contribution truncated when caps or omissions dropped data, and not otherwise', async () => {
      const big = makeProvider('big-provider', () => {
        const manyKeys: Record<string, number> = {};
        for (let i = 0; i < 100; i++) manyKeys[`key_${i}`] = i;
        return { manyKeys };
      });
      const clean = makeProvider('clean-provider', () => ({ bitrate: 1, live: false }));
      const player = new ScarlettPlayer({ container, plugins: [big, clean] });
      await (player as any).pluginManager.initAll();

      const snapshot = player.getDiagnostics();

      expect(snapshot.truncatedProviders).toEqual(['big-provider']);
      expect(JSON.stringify(snapshot)).not.toContain('key_64');
    });

    it('stops re-entrant collection instead of recursing', async () => {
      let pluginApi: IPluginAPI | null = null;
      let calls = 0;
      const reentrant = makeProvider(
        'reentrant-provider',
        () => {
          calls++;
          const inner = pluginApi?.getProviderDiagnostics?.();
          return { innerKeys: inner ? Object.keys(inner).length : -1 };
        },
        (api) => {
          pluginApi = api;
        }
      );
      const player = new ScarlettPlayer({ container, plugins: [reentrant] });
      await (player as any).pluginManager.initPlugin('reentrant-provider');

      const snapshot = player.getDiagnostics();

      expect(calls).toBe(1);
      expect((snapshot.providers['reentrant-provider'] as any).innerKeys).toBe(0);
    });

    it('reports no truncated providers on a destroyed player', () => {
      const player = new ScarlettPlayer({ container });
      player.destroy();
      expect(player.getDiagnostics().truncatedProviders).toEqual([]);
    });
  });

  describe('error projection bounds', () => {
    it('projects structured errors with known enum strings and max 20 capped', () => {
      const player = new ScarlettPlayer({ container });

      // Trigger errors through error handler
      const errorHandler = (player as any).errorHandler;
      if (errorHandler) {
        for (let i = 0; i < 25; i++) {
          errorHandler.handle({
            code: 'MEDIA_PLAYBACK_STALLED',
            message: `Sensitive error message with secret token=abc_${i}`,
            category: 'playback',
            fatal: false,
          });
        }
      }

      const snapshot = player.getDiagnostics();
      expect(snapshot.errors.length).toBeLessThanOrEqual(20);
      for (const err of snapshot.errors) {
        expect(err.code).toBeDefined();
        expect(err.category).toBeDefined();
        expect(typeof err.fatal).toBe('boolean');
        expect(typeof err.timestamp).toBe('number');
        // Raw message or arbitrary text containing secrets must NOT be exported
        expect((err as any).message).toBeUndefined();
      }
      expect(JSON.stringify(snapshot.errors)).not.toContain('secret token');
    });
  });

  describe('IPluginAPI provider diagnostics collector', () => {
    it('exposes getProviderDiagnostics() on IPluginAPI', async () => {
      let pluginApi: IPluginAPI | null = null;
      const testPlugin: Plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        type: 'feature',
        init: (api) => {
          pluginApi = api;
        },
        destroy: vi.fn(),
      };

      const player = new ScarlettPlayer({
        container,
        plugins: [testPlugin],
      });
      await player.init();

      expect(pluginApi).toBeDefined();
      expect(typeof (pluginApi as any)?.getProviderDiagnostics).toBe('function');
      const provDiag = (pluginApi as any).getProviderDiagnostics();
      expect(provDiag).toBeDefined();
    });
  });

  describe('untrusted contribution bounds', () => {
    it('keeps a 64x64x64x50 probe under a small serialized size', () => {
      const probe: Record<string, unknown> = {};
      for (let a = 0; a < 64; a++) {
        const level2: Record<string, unknown> = {};
        for (let b = 0; b < 64; b++) {
          const level3: Record<string, unknown> = {};
          for (let c = 0; c < 64; c++) {
            level3[`k${c}`] = Array.from({ length: 50 }, (_, i) => i);
          }
          level2[`k${b}`] = level3;
        }
        probe[`k${a}`] = level2;
      }

      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution(probe, 1, new WeakSet(), report);

      expect(JSON.stringify(out).length).toBeLessThan(50 * 1024);
      expect(report.omitted).toBeGreaterThan(0);
    });

    it('applies the depth limit to primitives as well as containers', () => {
      const deep = { a: { b: { c: { d: 1 } }, ok: 2 }, top: 3 };
      const out = sanitizeUntrustedContribution(deep) as any;

      expect(out.top).toBe(3);
      expect(out.a.ok).toBe(2);
      expect(out.a.b.c).toEqual({});
    });

    it('drops URL-like and identity-like keys case-insensitively', () => {
      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution(
        {
          'https://cdn.x/v.m3u8?sig=abc': 1,
          userId: 42,
          UID: 1,
          Email: 1,
          ip: 1,
          src: 1,
          href: 1,
          key: 1,
          'has space': 1,
          '1leading': 1,
          retryCount: 3,
          reconnect_attempts: 2,
        },
        1,
        new WeakSet(),
        report
      );

      expect(out).toEqual({ retryCount: 3, reconnect_attempts: 2 });
      expect(report.omitted).toBe(10);
    });

    it('rejects typed arrays, Map, Set, Date and class instances', () => {
      class Custom {
        value = 1;
      }
      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution(
        {
          typed: new Float64Array(1_000_000),
          map: new Map([['a', 1]]),
          set: new Set([1]),
          date: new Date(),
          custom: new Custom(),
          plain: { ok: 1 },
        },
        1,
        new WeakSet(),
        report
      );

      expect(out).toEqual({ plain: { ok: 1 } });
      expect(report.omitted).toBe(5);
    });

    it('counts keys it never reads once the key cap is reached', () => {
      let reads = 0;
      const big: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        Object.defineProperty(big, `k${i}`, {
          enumerable: true,
          get: () => {
            reads++;
            return i;
          },
        });
      }
      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution(big, 1, new WeakSet(), report) as Record<string, number>;

      expect(Object.keys(out).length).toBe(DIAGNOSTIC_LIMITS.MAX_OBJECT_KEYS);
      expect(reads).toBe(DIAGNOSTIC_LIMITS.MAX_OBJECT_KEYS);
      expect(report.omitted).toBe(1000 - DIAGNOSTIC_LIMITS.MAX_OBJECT_KEYS);
    });

    it('accepts null-prototype objects', () => {
      const obj = Object.create(null);
      obj.attempts = 2;
      expect(sanitizeUntrustedContribution(obj)).toEqual({ attempts: 2 });
    });

    it('drops array elements whose then getter throws', () => {
      const el: Record<string, unknown> = {};
      Object.defineProperty(el, 'then', {
        get() {
          throw new Error('boom');
        },
      });
      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution([1, el, 3], 1, new WeakSet(), report);

      expect(out).toEqual([1, 3]);
      expect(report.omitted).toBeGreaterThanOrEqual(1);
    });

    it('drops array elements whose index accessor throws', () => {
      const arr = [1, 2, 3];
      Object.defineProperty(arr, 1, {
        get() {
          throw new Error('boom');
        },
      });
      const report: SanitizeReport = { omitted: 0 };
      const out = sanitizeUntrustedContribution(arr, 1, new WeakSet(), report);

      expect(out).toEqual([1, 3]);
      expect(report.omitted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error projection', () => {
    it('keeps the newest errors from oldest-first history', () => {
      const history: PlayerError[] = Array.from({ length: 30 }, (_, i) => ({
        code: ErrorCode.PLAYBACK_FAILED,
        message: `e${i}`,
        fatal: false,
        timestamp: 1000 + i,
      }));

      const out = projectDiagnosticErrors(history);

      expect(out.length).toBe(DIAGNOSTIC_LIMITS.MAX_ERRORS);
      expect(out[0]?.timestamp).toBe(1010);
      expect(out[out.length - 1]?.timestamp).toBe(1029);
    });
  });
});
