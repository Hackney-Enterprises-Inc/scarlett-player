/**
 * Buffering spinner after `player.unload()`.
 *
 * Core's unloaded state (HEI-27) is its own reset, not the loading one: the
 * loading reset leaves `waiting` and `seeking` alone and sets `playbackState`
 * to `loading`, and this plugin shows the spinner on any of those. These tests
 * push the exact keys `ScarlettPlayer.unload()` writes and check the spinner
 * goes away, so a later change to either side cannot strand it on screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiPlugin } from '../src/index';
import type { MockPluginAPI } from './mock-api';

/** The keys and values `ScarlettPlayer.unload()` applies. */
const UNLOADED_STATE: Record<string, unknown> = {
  source: null,
  playbackState: 'idle',
  playing: false,
  paused: true,
  ended: false,
  buffering: false,
  waiting: false,
  seeking: false,
  currentTime: 0,
  duration: 0,
  buffered: null,
  bufferedAmount: 0,
  error: null,
  mediaType: 'unknown',
  qualities: [],
  currentQuality: null,
  audioTracks: [],
  currentAudioTrack: null,
  textTracks: [],
  currentTextTrack: null,
  live: false,
  liveEdge: false,
  seekableRange: null,
  liveLatency: 0,
  lowLatencyMode: false,
};

/** A mock plugin API over a plain state record, seeded with a loaded source. */
function createMockApi(): { api: MockPluginAPI; notify: () => void } {
  const state: Record<string, unknown> = {
    ...UNLOADED_STATE,
    source: { src: 'live.m3u8', type: 'application/x-mpegURL' },
    playbackState: 'playing',
    playing: true,
    paused: false,
    duration: 100,
    volume: 1,
    muted: false,
    fullscreen: false,
    pip: false,
    controlsVisible: true,
    chromecastAvailable: false,
    chromecastActive: false,
    airplayAvailable: false,
    airplayActive: false,
  };

  const container = document.createElement('div');
  container.appendChild(document.createElement('video'));
  document.body.appendChild(container);

  let subscriber: (() => void) | null = null;
  const api: MockPluginAPI = {
    pluginId: 'ui-controls',
    container,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    defineState: vi.fn((key: string, value: unknown) => {
      if (!(key in state)) state[key] = value;
    }),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    getPlugin: vi.fn(() => null),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn((cb: () => void) => {
      subscriber = cb;
      return vi.fn();
    }),
  };
  return { api, notify: () => subscriber?.() };
}

describe('buffering spinner after unload()', () => {
  let api: MockPluginAPI;
  let notify: () => void;
  let frames: Array<(t: number) => void>;

  const spinnerVisible = (): boolean =>
    api.container.querySelector('.sp-buffering')?.classList.contains('sp-buffering--visible') ??
    false;

  /** Write state, notify the plugin, and run the frame it queued. */
  const apply = (updates: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(updates)) {
      api.setState(key as never, value as never);
    }
    notify();
    const queued = frames;
    frames = [];
    queued.forEach((cb) => cb(0));
  };

  beforeEach(() => {
    ({ api, notify } = createMockApi());
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    api.container.remove();
    document.querySelectorAll('style').forEach((s) => s.remove());
    vi.unstubAllGlobals();
  });

  it('hides the spinner shown for a stalled source', async () => {
    const plugin = uiPlugin();
    await plugin.init(api);
    apply({ waiting: true, buffering: true });
    expect(spinnerVisible()).toBe(true);

    apply(UNLOADED_STATE);

    expect(spinnerVisible()).toBe(false);
    await plugin.destroy();
  });

  it('hides the spinner shown for a seek while playing', async () => {
    const plugin = uiPlugin();
    await plugin.init(api);
    apply({ seeking: true });
    expect(spinnerVisible()).toBe(true);

    apply(UNLOADED_STATE);

    expect(spinnerVisible()).toBe(false);
    await plugin.destroy();
  });

  it('would keep it with the loading reset, which is why unload has its own', async () => {
    const plugin = uiPlugin();
    await plugin.init(api);
    apply({ waiting: true });

    // What load() writes: waiting untouched, playbackState loading
    apply({ playing: false, paused: true, buffering: true, playbackState: 'loading' });

    expect(spinnerVisible()).toBe(true);
    await plugin.destroy();
  });
});

// Exercise the actual core reset, rather than only a copied state fixture.
describe('core unload integration', () => {
  it.each(['waiting', 'seeking'] as const)('hides the spinner after unloading while %s', async (key) => {
    // Runtime source import exercises this working tree; keep the UI typecheck
    // inside its package root, using the published API types for the provider.
    const coreSource = '../../../core/src/scarlett-player';
    const { ScarlettPlayer } = await import(coreSource);
    let api!: import('@scarlett-player/core').IPluginAPI;
    const container = document.createElement('div');
    document.body.appendChild(container);
    let frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const flush = () => {
      const queued = frames;
      frames = [];
      queued.forEach((cb) => cb(0));
    };
    const player = new ScarlettPlayer({ container, plugins: [uiPlugin(), {
      id: 'unload-test-provider', name: 'Unload test provider', version: '1.0.0',
      type: 'provider', canPlay: () => true,
      init(pluginApi: import('@scarlett-player/core').IPluginAPI) { api = pluginApi; }, destroy() {},
    }] });
    try {
      await player.load('video.mp4');
      api.setState('playing', true);
      api.setState('paused', false);
      api.setState('playbackState', 'playing');
      api.setState('buffering', false);
      api.setState(key, true);
      flush();
      const spinner = container.querySelector('.sp-buffering');
      expect(spinner?.classList.contains('sp-buffering--visible')).toBe(true);
      await player.unload();
      flush();
      expect(spinner?.classList.contains('sp-buffering--visible')).toBe(false);
    } finally {
      await player.destroy();
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
