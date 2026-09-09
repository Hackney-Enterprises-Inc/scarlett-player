/**
 * Media-type classification tests.
 *
 * The regression these exist for: `videoWidth === 0` at `loadedmetadata` used
 * to publish `mediaType: 'audio'`, so a phone that had not measured the frame
 * yet was told it was playing an audio file. Nothing here may classify from an
 * absent measurement - only from positive evidence.
 *
 * Two layers are covered: the classifier itself (./src/media-type.ts) and the
 * factory wiring, so both `createHLSPlugin` and the light variant are exercised
 * through the same public path a host uses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaTypeClassifier } from '../src/media-type';
import { createHLSPlugin } from '../src/index';
import { createHLSPlugin as createLightPlugin } from '../src/light';
import * as hlsLoader from '../src/hls-loader';
import * as lightLoader from '../src/hls-loader-light';
import type { CapturedHls, MockPluginAPI } from './helpers';
import {
  createCapturedHls,
  createMockAPI,
  createMockHlsConstructor,
  flush,
  installMediaStubs,
} from './helpers';

/** Read back the last value written to a state key, or undefined. */
function lastState(api: MockPluginAPI, key: string): unknown {
  const calls = api.setState.mock.calls.filter((call) => call[0] === key);
  return calls.length > 0 ? calls[calls.length - 1][1] : undefined;
}

/** Every value ever written to a state key, in order. */
function stateWrites(api: MockPluginAPI, key: string): unknown[] {
  return api.setState.mock.calls.filter((call) => call[0] === key).map((call) => call[1]);
}

/** Give a video element an intrinsic width jsdom would otherwise report as 0. */
function setVideoWidth(video: HTMLVideoElement, width: number): void {
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
}

/** Give a video element a readyState jsdom pins at 0. */
function setReadyState(video: HTMLVideoElement, readyState: number): void {
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
}

/**
 * Install a stand-in track list on an element.
 *
 * jsdom exposes `videoTracks` / `audioTracks` as getter-only properties, so a
 * plain assignment throws; the classifier only ever reads them, which a
 * configurable own property satisfies.
 *
 * @param video - Element to install on
 * @param name - Which list
 * @param list - The stand-in
 */
function installTrackList(video: HTMLVideoElement, name: 'videoTracks' | 'audioTracks', list: unknown): void {
  Object.defineProperty(video, name, { value: list, configurable: true });
}

/** A minimal `VideoTrackList` / `AudioTrackList` stand-in with working events. */
function trackList(length: number): {
  length: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  fire: (type: string) => void;
} {
  const listeners = new Map<string, Set<() => void>>();
  return {
    length,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

describe('createMediaTypeClassifier', () => {
  let api: MockPluginAPI;
  let video: HTMLVideoElement;

  beforeEach(() => {
    api = createMockAPI();
    video = document.createElement('video');
  });

  it('publishes unknown for a new source, before any metadata', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');

    expect(lastState(api, 'mediaType')).toBe('unknown');
    expect(classifier.current()).toBe('unknown');
  });

  it('stays unknown when loadedmetadata reports zero intrinsic width', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');
    classifier.attach(video);

    video.dispatchEvent(new Event('loadedmetadata'));

    expect(classifier.current()).toBe('unknown');
    expect(stateWrites(api, 'mediaType')).toEqual(['unknown']);
  });

  it('establishes video from positive intrinsic dimensions', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');
    classifier.attach(video);

    setVideoWidth(video, 1280);
    video.dispatchEvent(new Event('loadeddata'));

    expect(classifier.current()).toBe('video');
    expect(lastState(api, 'mediaType')).toBe('video');
  });

  it('promotes to video on a delayed resize, with no loadeddata at all', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');
    classifier.attach(video);
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(classifier.current()).toBe('unknown');

    setVideoWidth(video, 640);
    video.dispatchEvent(new Event('resize'));

    expect(classifier.current()).toBe('video');
  });

  it('promotes to video on playing, the last event a phone gives us', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');
    classifier.attach(video);

    setVideoWidth(video, 320);
    video.dispatchEvent(new Event('playing'));

    expect(classifier.current()).toBe('video');
  });

  it('never downgrades confirmed video when dimensions go back to zero', () => {
    const classifier = createMediaTypeClassifier(api);
    classifier.beginSource('a.m3u8');
    classifier.attach(video);

    setVideoWidth(video, 1280);
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(classifier.current()).toBe('video');

    setVideoWidth(video, 0);
    video.dispatchEvent(new Event('resize'));

    expect(classifier.current()).toBe('video');
    expect(stateWrites(api, 'mediaType')).toEqual(['unknown', 'video']);
  });

  describe('hls.js manifest flags', () => {
    it('establishes video from video: true before any frame decodes', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      classifier.noteManifestParsed({ audio: true, video: true });

      expect(classifier.current()).toBe('video');
    });

    it('keeps manifest video through subsequent zero-width events', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      classifier.noteManifestParsed({ audio: true, video: true });

      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('loadeddata'));

      expect(classifier.current()).toBe('video');
    });

    it('establishes audio only when both flags are present and unambiguous', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      classifier.noteManifestParsed({ audio: true, video: false });

      expect(classifier.current()).toBe('audio');
      expect(lastState(api, 'mediaType')).toBe('audio');
    });

    it('stays unknown when the payload omits the fields', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      classifier.noteManifestParsed({});
      classifier.noteManifestParsed({ video: undefined, audio: undefined });
      classifier.noteManifestParsed(null);

      expect(classifier.current()).toBe('unknown');
    });

    it('does not let a later audio manifest downgrade confirmed video', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      setVideoWidth(video, 1280);
      classifier.evaluate();

      classifier.noteManifestParsed({ audio: true, video: false });

      expect(classifier.current()).toBe('video');
    });
  });

  describe('native track lists', () => {
    it('establishes audio from an empty video list beside a non-empty audio list', () => {
      const classifier = createMediaTypeClassifier(api);
      installTrackList(video, 'videoTracks', trackList(0));
      installTrackList(video, 'audioTracks', trackList(1));
      setReadyState(video, 1);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      expect(classifier.current()).toBe('audio');
    });

    it('establishes video from a present video track with no dimensions yet', () => {
      const classifier = createMediaTypeClassifier(api);
      installTrackList(video, 'videoTracks', trackList(1));
      installTrackList(video, 'audioTracks', trackList(1));
      setReadyState(video, 1);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      expect(classifier.current()).toBe('video');
    });

    it('ignores track lists before HAVE_METADATA', () => {
      const classifier = createMediaTypeClassifier(api);
      installTrackList(video, 'videoTracks', trackList(0));
      installTrackList(video, 'audioTracks', trackList(1));
      setReadyState(video, 0);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      expect(classifier.current()).toBe('unknown');
    });

    it('stays unknown when the browser ships no track lists', () => {
      const classifier = createMediaTypeClassifier(api);
      setReadyState(video, 1);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      video.dispatchEvent(new Event('loadedmetadata'));

      expect(classifier.current()).toBe('unknown');
    });

    it('stays unknown when videoTracks is empty and audioTracks is unsupported', () => {
      const classifier = createMediaTypeClassifier(api);
      installTrackList(video, 'videoTracks', trackList(0));
      setReadyState(video, 1);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      expect(classifier.current()).toBe('unknown');
    });

    it('re-evaluates when a track is added after metadata', () => {
      const classifier = createMediaTypeClassifier(api);
      const videoTracks = trackList(0);
      installTrackList(video, 'videoTracks', videoTracks);
      installTrackList(video, 'audioTracks', trackList(1));
      setReadyState(video, 1);

      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      expect(classifier.current()).toBe('audio');

      videoTracks.length = 1;
      videoTracks.fire('addtrack');

      expect(classifier.current()).toBe('video');
    });
  });

  describe('source identity', () => {
    it('resets to unknown on a new source', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      setVideoWidth(video, 1280);
      classifier.evaluate();
      expect(classifier.current()).toBe('video');

      classifier.beginSource('b.m3u8');

      expect(classifier.current()).toBe('unknown');
      expect(stateWrites(api, 'mediaType')).toEqual(['unknown', 'video', 'unknown']);
    });

    it('retains confirmed classification across a same-source pipeline handoff', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      classifier.noteManifestParsed({ audio: true, video: true });
      expect(classifier.current()).toBe('video');

      // AirPlay handoff: same source, brand new element with nothing measured.
      const nextEl = document.createElement('video');
      classifier.beginSource('a.m3u8');
      classifier.attach(nextEl);
      nextEl.dispatchEvent(new Event('loadedmetadata'));

      expect(classifier.current()).toBe('video');
    });

    it('stops listening to the previous element after a re-attach', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);

      const nextEl = document.createElement('video');
      classifier.attach(nextEl);

      setVideoWidth(video, 1280);
      video.dispatchEvent(new Event('resize'));

      expect(classifier.current()).toBe('unknown');
    });

    it('classifies nothing after destroy', () => {
      const classifier = createMediaTypeClassifier(api);
      classifier.beginSource('a.m3u8');
      classifier.attach(video);
      classifier.destroy();

      setVideoWidth(video, 1280);
      video.dispatchEvent(new Event('resize'));
      classifier.noteManifestParsed({ audio: false, video: true });
      classifier.beginSource('b.m3u8');

      expect(stateWrites(api, 'mediaType')).toEqual(['unknown']);
    });
  });
});

describe('HLS plugin media classification wiring', () => {
  const mockCtor = createMockHlsConstructor();
  const SRC = 'http://example.com/stream.m3u8';

  /** The loader module a variant resolves hls.js through. */
  type Loader = typeof hlsLoader | typeof lightLoader;

  /**
   * Spy a variant's loader so `loadSource()` builds a captured mock instance.
   *
   * @param loader - The variant's loader module
   * @param created - Collector every created instance is pushed into
   */
  function stubLoader(loader: Loader, created: CapturedHls[]): void {
    loader.resetLoader();
    vi.spyOn(loader, 'loadHlsJs').mockResolvedValue(mockCtor as never);
    vi.spyOn(loader, 'getHlsConstructor').mockReturnValue(mockCtor as never);
    vi.spyOn(loader, 'createHlsInstance').mockImplementation(() => {
      const captured = createCapturedHls();
      created.push(captured);
      return captured.instance as never;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    installMediaStubs();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Load a source through one variant and fire its manifest event.
   *
   * @param plugin - The plugin instance under test
   * @param loader - Its loader module
   * @param manifest - Extra `MANIFEST_PARSED` payload fields (the media flags)
   * @returns The mock api and the element the plugin created
   */
  async function loadThrough(
    plugin: ReturnType<typeof createHLSPlugin>,
    loader: Loader,
    manifest: Record<string, unknown>
  ): Promise<{ api: MockPluginAPI; video: HTMLVideoElement; created: CapturedHls[] }> {
    const created: CapturedHls[] = [];
    stubLoader(loader, created);

    const api = createMockAPI();
    await plugin.init(api);
    const load = plugin.loadSource(SRC);
    await flush();

    created[0].handlers['hlsManifestParsed']?.('hlsManifestParsed', {
      levels: created[0].instance.levels,
      ...manifest,
    });
    await load;

    const video = api.container.querySelector('video') as HTMLVideoElement;
    return { api, video, created };
  }

  it('classifies video from the manifest on the full build, through zero-width metadata', async () => {
    const plugin = createHLSPlugin();
    const { api, video } = await loadThrough(plugin, hlsLoader, { audio: true, video: true });

    video.dispatchEvent(new Event('loadedmetadata'));
    video.dispatchEvent(new Event('loadeddata'));

    expect(lastState(api, 'mediaType')).toBe('video');
    expect(stateWrites(api, 'mediaType')).not.toContain('audio');
    await plugin.destroy();
  });

  it('classifies video from the manifest on the light build too', async () => {
    const plugin = createLightPlugin();
    const { api, video } = await loadThrough(plugin, lightLoader, { audio: true, video: true });

    video.dispatchEvent(new Event('loadedmetadata'));

    expect(lastState(api, 'mediaType')).toBe('video');
    expect(stateWrites(api, 'mediaType')).not.toContain('audio');
    await plugin.destroy();
  });

  it('stays unknown when the manifest says nothing and no frame is measured', async () => {
    const plugin = createHLSPlugin();
    const { api, video } = await loadThrough(plugin, hlsLoader, {});

    video.dispatchEvent(new Event('loadedmetadata'));
    video.dispatchEvent(new Event('loadeddata'));
    video.dispatchEvent(new Event('playing'));

    expect(lastState(api, 'mediaType')).toBe('unknown');
    await plugin.destroy();
  });

  it('classifies an audio-only manifest as audio', async () => {
    const plugin = createHLSPlugin();
    const { api } = await loadThrough(plugin, hlsLoader, { audio: true, video: false });

    expect(lastState(api, 'mediaType')).toBe('audio');
    await plugin.destroy();
  });

  it('resets to unknown when a second source is loaded', async () => {
    const plugin = createHLSPlugin();
    const { api, created } = await loadThrough(plugin, hlsLoader, { audio: true, video: true });
    expect(lastState(api, 'mediaType')).toBe('video');

    const load = plugin.loadSource('http://example.com/other.m3u8');
    await flush();
    expect(lastState(api, 'mediaType')).toBe('unknown');

    created[1].handlers['hlsManifestParsed']?.('hlsManifestParsed', {
      levels: created[1].instance.levels,
    });
    await load;

    expect(lastState(api, 'mediaType')).toBe('unknown');
    await plugin.destroy();
  });

  it('writes no media type after destroy', async () => {
    const plugin = createHLSPlugin();
    const { api, video } = await loadThrough(plugin, hlsLoader, { audio: true, video: true });
    await plugin.destroy();

    const before = stateWrites(api, 'mediaType').length;
    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
    video.dispatchEvent(new Event('resize'));

    expect(stateWrites(api, 'mediaType')).toHaveLength(before);
  });
});
