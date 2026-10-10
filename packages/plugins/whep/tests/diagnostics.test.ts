import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayer } from '@scarlett-player/core';
import { createWHEPPlugin } from '../src/index';
import type { IPluginAPI } from '@scarlett-player/core';
import {
  FakePeerConnection,
  answer,
  createMockApi,
  envelope,
  installBrowserFakes,
  installFetch,
} from './fakes';

describe('WHEP Provider Diagnostics', () => {
  let container: HTMLElement;
  let mockApi: IPluginAPI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockApi = {
      pluginId: 'whep-provider',
      container,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getState: vi.fn((key: string) => {
        if (key === 'liveLatency') return 0.25;
        return null;
      }) as any,
      setState: vi.fn(),
      defineState: vi.fn(),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      getPlugin: vi.fn(() => null),
      onDestroy: vi.fn(),
      subscribeToState: vi.fn(() => vi.fn()),
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes getDiagnostics before loadSource with safe defaults and no leaks', async () => {
    const plugin = createWHEPPlugin({
      token: 'SUPER_SECRET_TOKEN_DO_NOT_LEAK',
    });
    await plugin.init(mockApi);

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.connectionState).toBeNull();
    expect(diagnostics.iceConnectionState).toBeNull();
    expect(diagnostics.signalingState).toBeNull();
    expect(diagnostics.receiverLatency).toBe(0.25);
    expect(diagnostics.stats).toBeNull();
    expect(diagnostics.reconnectAttempts).toBe(0);
    expect(diagnostics.isReconnecting).toBe(false);

    // Verify secrets, SDP, tokens, peer objects never leak
    const jsonStr = JSON.stringify(diagnostics);
    expect(jsonStr).not.toContain('SUPER_SECRET_TOKEN');
    expect((diagnostics as any).peer).toBeUndefined();
    expect((diagnostics as any).sessionUrl).toBeUndefined();
    expect((diagnostics as any).sdp).toBeUndefined();
    expect((diagnostics as any).iceCandidates).toBeUndefined();
  });

  it('does not trigger new getStats() calls or polling timers during getDiagnostics', async () => {
    const plugin = createWHEPPlugin();
    await plugin.init(mockApi);

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const diag1 = plugin.getDiagnostics();
    const diag2 = plugin.getDiagnostics();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(diag1).toEqual(diag2);
  });

  it('cleans up safely after destroy', async () => {
    const plugin = createWHEPPlugin();
    await plugin.init(mockApi);
    await plugin.destroy();

    const diagnostics = plugin.getDiagnostics();
    expect(diagnostics).toBeDefined();
    expect(diagnostics.connectionState).toBeNull();
    expect(diagnostics.receiverLatency).toBeNull();
    expect(diagnostics.stats).toBeNull();
  });
});

describe('WHEP Provider Diagnostics across an outage', () => {
  const SRC = 'https://origin.example.com:8889/whep/v1/streams/show-1';
  const settle = (ms = 1) => vi.advanceTimersByTimeAsync(ms);
  const inbound = {
    id: 'in',
    type: 'inbound-rtp',
    kind: 'video',
    jitterBufferDelay: 6,
    jitterBufferEmittedCount: 120,
    jitter: 0.004,
    framesReceived: 300,
    framesDecoded: 298,
    framesDropped: 2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    installBrowserFakes();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    FakePeerConnection.options = { stats: [inbound] };
  });

  afterEach(async () => {
    await settle();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('reports null measurements once the connection is gone', async () => {
    installFetch([answer(), envelope(503, 'unavailable', 'offline')]);
    const plugin = createWHEPPlugin();
    const api = createMockApi();
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await settle();
    await settle(1000);

    const live = plugin.getDiagnostics();
    expect(live.receiverLatency).toBeGreaterThan(0);
    expect(live.stats).toMatchObject({ framesReceived: 300, framesDecoded: 298 });

    FakePeerConnection.instances[0].setConnectionState('failed');
    await settle();

    const down = plugin.getDiagnostics();
    expect(down.connectionState).toBeNull();
    expect(down.receiverLatency).toBeNull();
    expect(down.stats).toBeNull();

    await plugin.destroy();
  });

  it('ignores a getStats that resolves after the connection dropped', async () => {
    installFetch([answer(), envelope(503, 'unavailable', 'offline')]);
    const plugin = createWHEPPlugin();
    const api = createMockApi();
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await settle();

    const realGetStats = FakePeerConnection.prototype.getStats;
    let release: () => void = () => {};
    vi.spyOn(FakePeerConnection.prototype, 'getStats').mockImplementation(function (this: FakePeerConnection) {
      return new Promise<Map<string, unknown>>((resolve) => {
        release = () => resolve(new Map([['in', inbound]]));
      });
    });
    await settle(1000);

    FakePeerConnection.instances[0].setConnectionState('failed');
    await settle();
    release();
    await settle();

    const down = plugin.getDiagnostics();
    expect(down.receiverLatency).toBeNull();
    expect(down.stats).toBeNull();
    vi.mocked(FakePeerConnection.prototype.getStats).mockImplementation(realGetStats);

    await plugin.destroy();
  });

  it('reports a null round trip until a candidate pair measured one', async () => {
    installFetch([answer()]);
    const plugin = createWHEPPlugin();
    const api = createMockApi();
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await settle();
    await settle(1000);

    const unknown = plugin.getDiagnostics();
    expect(unknown.receiverLatency).toBeCloseTo(0.05, 5);
    expect(unknown.stats?.roundTripTime).toBeNull();

    FakePeerConnection.options = {
      stats: [
        { ...inbound, jitterBufferDelay: 18, jitterBufferEmittedCount: 240 },
        { id: 'p', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0 },
      ],
    };
    await settle(1000);
    expect(plugin.getDiagnostics().stats?.roundTripTime).toBe(0);

    await plugin.destroy();
  });

  it('reports isReconnecting while the attempt is in flight, and not after it joins', async () => {
    let posts = 0;
    let release: (response: Response) => void = () => {};
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 200 });
      posts++;
      if (posts === 1) return answer();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const plugin = createWHEPPlugin();
    const api = createMockApi();
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await settle();
    expect(plugin.getDiagnostics().isReconnecting).toBe(false);

    FakePeerConnection.instances[0].setConnectionState('failed');
    await settle();
    expect(plugin.getDiagnostics().isReconnecting).toBe(true);

    await settle(10000);
    expect(posts).toBe(2);
    expect(plugin.getDiagnostics()).toMatchObject({ isReconnecting: true, reconnectAttempts: 1 });

    release(answer('/whep/v1/streams/show-1/sessions/second'));
    await settle(10);
    expect(plugin.getDiagnostics().isReconnecting).toBe(false);

    await plugin.destroy();
  });

  it('reports isReconnecting false once the reconnect window is exhausted', async () => {
    installFetch([envelope(409, 'not_live', 'x', '5')]);
    const plugin = createWHEPPlugin({ reconnectWindowMs: 12000 });
    const api = createMockApi();
    await plugin.init(api);
    plugin.loadSource(SRC).catch(() => {});
    await settle();
    expect(plugin.getDiagnostics().isReconnecting).toBe(true);

    await settle(5000);
    await settle(10000);
    expect(api.emitted('error:reconnect-exhausted')).toHaveLength(1);
    expect(plugin.getDiagnostics().isReconnecting).toBe(false);

    await plugin.destroy();
  });
});

describe('WHEP provider through the player sanitizer', () => {
  beforeEach(() => {
    installBrowserFakes();
    FakePeerConnection.options = {};
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('contributes every key to player.getDiagnostics() with nothing omitted', async () => {
    installFetch([answer()]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = await createPlayer({ container, plugins: [createWHEPPlugin()] });

    await player.load('https://origin.example.com:8889/whep/v1/streams/show-1');
    // The fake peer carries no ICE or signaling state of its own.
    Object.assign(FakePeerConnection.instances[0], {
      iceConnectionState: 'connected',
      signalingState: 'stable',
    });
    const snapshot = player.getDiagnostics();

    expect(snapshot.truncatedProviders).toEqual([]);
    expect(Object.keys(snapshot.providers['whep-provider'] as object).sort()).toEqual([
      'autoReconnect',
      'connectionState',
      'iceConnectionState',
      'isReconnecting',
      'receiverLatency',
      'reconnectAttempts',
      'signalingState',
      'stats',
    ]);

    player.destroy();
  });
});
