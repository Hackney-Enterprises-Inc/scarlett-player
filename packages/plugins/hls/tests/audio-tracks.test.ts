/**
 * Alternate audio rendition tests (PR-2.6 / SP-54).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHLSPlugin } from '../src/index';
import * as hlsLoader from '../src/hls-loader';
import {
  type CapturedHls,
  type MockPluginAPI,
  createCapturedHls,
  createMockHlsConstructor,
  createMockAPI as createHarnessApi,
  installMediaStubs,
  flush,
  fireManifest,
} from './helpers';
import {
  setupHlsEventHandlers,
  audioTrackId,
  audioTrackIndex,
  formatAudioTrack,
} from '../src/event-map';
import type { IPluginAPI } from '@scarlett-player/core';

const TRACKS = [
  { id: 0, name: 'English', lang: 'en', default: true },
  { id: 1, name: 'Director Commentary', lang: 'en' },
  { id: 2, lang: 'es' },
  { id: 3 },
];

function createMockApi(): IPluginAPI {
  const state: Record<string, unknown> = {};

  return {
    pluginId: 'hls-provider',
    container: document.createElement('div'),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: unknown) => {
      state[key] = value;
    }),
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
    onDestroy: vi.fn(),
    subscribeToState: vi.fn(() => vi.fn()),
    getPlugin: vi.fn(() => null),
  } as unknown as IPluginAPI;
}

describe('audio track ids', () => {
  it('round-trips an index through an id', () => {
    expect(audioTrackId(2)).toBe('audio-2');
    expect(audioTrackIndex('audio-2')).toBe(2);
  });

  it('rejects an id it did not mint', () => {
    expect(audioTrackIndex(null)).toBe(-1);
    expect(audioTrackIndex('level-1')).toBe(-1);
    expect(audioTrackIndex('')).toBe(-1);
  });

  it('rejects an id that only starts like one of ours', () => {
    // Stripping the prefix and calling parseInt took the leading digits of
    // whatever was left, so these all parsed as a real rendition index.
    expect(audioTrackIndex('audio-2invalid')).toBe(-1);
    expect(audioTrackIndex('audio-02')).toBe(-1);
    expect(audioTrackIndex('audio-2.5')).toBe(-1);
    expect(audioTrackIndex('audio-')).toBe(-1);
    expect(audioTrackIndex('audio--1')).toBe(-1);

    // ...while the canonical form still round-trips.
    expect(audioTrackIndex('audio-0')).toBe(0);
    expect(audioTrackIndex('audio-12')).toBe(12);
  });
});

describe('formatAudioTrack', () => {
  it('prefers the manifest NAME', () => {
    expect(formatAudioTrack(TRACKS[1], 1, false)).toEqual({
      id: 'audio-1',
      label: 'Director Commentary',
      language: 'en',
      active: false,
    });
  });

  it('falls back to the language, then to a numbered label', () => {
    expect(formatAudioTrack(TRACKS[2], 2, false).label).toBe('es');
    expect(formatAudioTrack(TRACKS[3], 3, false).label).toBe('Audio 4');
  });
});

describe('audio rendition events', () => {
  let mockHls: any;
  let mockApi: IPluginAPI;
  let handlerMap: Map<string, Function>;

  const trigger = (event: string, data: unknown): void => {
    handlerMap.get(event)?.(event, data);
  };

  const lastState = (key: string): unknown =>
    (mockApi.setState as unknown as { mock: { calls: [string, unknown][] } }).mock.calls
      .filter(([name]) => name === key)
      .pop()?.[1];

  beforeEach(() => {
    handlerMap = new Map();
    mockHls = {
      on: vi.fn((event: string, handler: Function) => handlerMap.set(event, handler)),
      off: vi.fn((event: string) => handlerMap.delete(event)),
      levels: [],
      currentLevel: 0,
      autoLevelEnabled: true,
      audioTracks: TRACKS,
      audioTrack: 0,
    };
    mockApi = createMockApi();
    setupHlsEventHandlers(mockHls, mockApi, {});
  });

  it('publishes the rendition list and the active one', () => {
    trigger('hlsAudioTracksUpdated', { audioTracks: TRACKS });

    expect(lastState('audioTracks')).toEqual([
      { id: 'audio-0', label: 'English', language: 'en', active: true },
      { id: 'audio-1', label: 'Director Commentary', language: 'en', active: false },
      { id: 'audio-2', label: 'es', language: 'es', active: false },
      { id: 'audio-3', label: 'Audio 4', language: undefined, active: false },
    ]);
    expect(lastState('currentAudioTrack')).toMatchObject({ id: 'audio-0', active: true });
  });

  it('clears state for a manifest with no alternate audio', () => {
    trigger('hlsAudioTracksUpdated', { audioTracks: [] });

    expect(lastState('audioTracks')).toEqual([]);
    expect(lastState('currentAudioTrack')).toBeNull();
  });

  it('moves the active flag when a switch completes', () => {
    trigger('hlsAudioTracksUpdated', { audioTracks: TRACKS });
    trigger('hlsAudioTrackSwitched', { id: 1 });

    expect(lastState('currentAudioTrack')).toMatchObject({
      id: 'audio-1',
      label: 'Director Commentary',
      active: true,
    });
    expect((lastState('audioTracks') as Array<{ active: boolean }>)[0].active).toBe(false);
  });

  it('reports the callbacks', () => {
    const onAudioTracksUpdated = vi.fn();
    const onAudioTrackSwitched = vi.fn();
    handlerMap.clear();
    setupHlsEventHandlers(mockHls, mockApi, { onAudioTracksUpdated, onAudioTrackSwitched });

    trigger('hlsAudioTracksUpdated', { audioTracks: TRACKS });
    trigger('hlsAudioTrackSwitched', { id: 2 });

    expect(onAudioTracksUpdated).toHaveBeenCalledWith(TRACKS);
    expect(onAudioTrackSwitched).toHaveBeenCalledWith(2);
  });

  it('clears the rendition state when the handlers are torn down', () => {
    const mockApi = createMockApi();
    const handlers = new Map<string, (event: string, data: unknown) => void>();
    const mockHls = {
      on: vi.fn((event: string, handler: (e: string, d: unknown) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
      audioTrack: 1,
    } as never;

    const cleanup = setupHlsEventHandlers(mockHls, mockApi, {});
    handlers.get('hlsAudioTracksUpdated')?.('hlsAudioTracksUpdated', { audioTracks: TRACKS });

    expect(mockApi.getState('audioTracks')).toHaveLength(TRACKS.length);
    expect(mockApi.getState('currentAudioTrack')).not.toBeNull();

    // Renditions belong to the manifest we just detached from. Left behind,
    // the next source - or the native provider, which clears `qualities` and
    // has never touched these - shows the previous stream's audio menu.
    cleanup();

    expect(mockApi.getState('audioTracks')).toEqual([]);
    expect(mockApi.getState('currentAudioTrack')).toBeNull();
  });
});

describe('track:audio selection routing', () => {
  let plugin: ReturnType<typeof createHLSPlugin>;
  let api: MockPluginAPI;
  let created: CapturedHls[];
  const mockCtor = createMockHlsConstructor();

  const SRC = 'http://example.com/multi-audio.m3u8';

  /** Invoke the handler the plugin registered for a player event. */
  const fire = (event: string, payload: unknown): void => {
    api.on.mock.calls
      .filter(([name]: [string]) => name === event)
      .forEach(([, handler]: [string, (p: unknown) => void]) => handler(payload));
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    hlsLoader.resetLoader();
    created = [];
    installMediaStubs();

    vi.spyOn(hlsLoader, 'loadHlsJs').mockResolvedValue(mockCtor as never);
    vi.spyOn(hlsLoader, 'getHlsConstructor').mockReturnValue(mockCtor as never);
    vi.spyOn(hlsLoader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      captured.instance.audioTracks = TRACKS;
      created.push(captured);

      return captured.instance as never;
    });

    plugin = createHLSPlugin();
    api = createHarnessApi();
    await plugin.init(api);

    const loading = plugin.loadSource(SRC);
    await flush();
    fireManifest(created[0]);
    await loading;
  });

  afterEach(async () => {
    await plugin.destroy();
    vi.restoreAllMocks();
  });

  it('routes a selection to hls.audioTrack', () => {
    fire('track:audio', { trackId: 'audio-2' });

    expect(created[0].instance.audioTrack).toBe(2);
  });

  it('ignores an id outside the rendition list', () => {
    created[0].instance.audioTrack = 1;

    fire('track:audio', { trackId: 'audio-99' });

    expect(created[0].instance.audioTrack).toBe(1);
    expect(api.logger.warn).toHaveBeenCalledWith(
      'Ignoring unknown audio track selection',
      { trackId: 'audio-99' }
    );
  });

  it('ignores a null selection', () => {
    created[0].instance.audioTrack = 1;

    fire('track:audio', { trackId: null });

    expect(created[0].instance.audioTrack).toBe(1);
  });
});
